// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · excelExport.js — Exportación profesional a Excel por módulo
//
// PROPÓSITO:
//   Centraliza la lógica de export XLSX de los 4 módulos principales
//   (Ingresos, Gastos, Deudas, Patrimonio). Reutilizable, consistente,
//   respeta toggles (sim !== false).
//
// TÉCNICA:
//   Dynamic import de xlsx (SheetJS) — la lib pesa ~500KB comprimida, no
//   la queremos en el bundle inicial. Se carga solo cuando el user hace
//   click en un botón de exportar.
//
// PATRÓN DE USO:
//   import { exportIngresosExcel } from "../lib/excelExport";
//   <button onClick={() => exportIngresosExcel(items, owners)}>📊 Excel</button>
//
// FORMATO DE ARCHIVO:
//   FINPATHIA_[Modulo]_YYYY-MM-DD.xlsx
//   Cada módulo tiene 1-3 hojas: detalle + agregados útiles.
// ═══════════════════════════════════════════════════════════════════════════

// Helper: nombre de archivo con fecha ISO limpia
const buildFilename = (modulo) => {
  const date = new Date().toISOString().slice(0, 10);
  return `FINPATHIA_${modulo}_${date}.xlsx`;
};

// 12-ago-2026: mismo defecto que se corrigió en pdfSectionExport.js. Los
// montos entraban crudos, así que un ítem cargado en USD se sumaba como si
// fueran pesos y el total del Excel no coincidía con el de la pantalla.
// Regla igual al resto de la app (flowHelpers): sin campo moneda se asume COP.
const aCOP = (monto, item, trm) =>
  (Number(monto) || 0) * (item?.moneda === "USD" ? (trm || 4200) : 1);

// Helper: encontrar el nombre del owner por su ID
const ownerName = (ownerId, owners) => {
  if (!ownerId) return "";
  const o = (owners || []).find((x) => x.id === ownerId);
  return o ? o.name || o.n || "" : "";
};

// Helper: escribir libro con anchos de columna e imprimir archivo
const writeWorkbook = async (buildFn, filename) => {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  buildFn(XLSX, wb);
  XLSX.writeFile(wb, filename);
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. INGRESOS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportIngresosExcel(ingresos, owners, trm) {
  const items = (ingresos || []).filter((i) => i.sim !== false);
  if (items.length === 0) {
    alert("No hay ingresos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  await writeWorkbook((XLSX, wb) => {
    // ── Hoja 1: Detalle ─────────────────────────────────────────
    const rows = [
      [
        "Fuente / Nombre", "Categoría DIAN", "Origen", "Tipo",
        "Moneda", "Monto Mensual", "Monto Anual",
        "Capital Invertido", "Tasa Anual %",
        "Propietario Fiscal", "Retención Auto %", "Notas",
      ],
    ];
    items
      .sort((a, b) => (b.mensual || 0) - (a.mensual || 0))
      .forEach((i) => {
        rows.push([
          i.nombre || "",
          i.categoria || "",
          i.fuente || "",
          i.tipo || "fijo",
          i.moneda || "COP",
          Math.round(aCOP(i.mensual, i, trm)),
          Math.round(aCOP(i.mensual, i, trm) * 12),
          i.capital || 0,
          i.tasa || 0,
          ownerName(i.ownerId, owners),
          i.retencionConfig?.tasa || 0,
          i.notas || "",
        ]);
      });

    // Total
    const totalMes = items.reduce((s, i) => s + aCOP(i.mensual, i, trm), 0);
    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", Math.round(totalMes), Math.round(totalMes * 12), "", "", "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 32 }, { wch: 24 }, { wch: 20 }, { wch: 10 },
      { wch: 8 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 12 },
      { wch: 22 }, { wch: 14 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Ingresos");

    // ── Hoja 2: Resumen por Categoría ───────────────────────────
    const porCat = {};
    items.forEach((i) => {
      const cat = i.categoria || "Sin categoría";
      if (!porCat[cat]) porCat[cat] = { count: 0, mensual: 0 };
      porCat[cat].count += 1;
      porCat[cat].mensual += aCOP(i.mensual, i, trm);
    });
    const catRows = [["Categoría DIAN", "# Ingresos", "Total Mensual", "Total Anual", "% del Total"]];
    Object.entries(porCat)
      .sort((a, b) => b[1].mensual - a[1].mensual)
      .forEach(([cat, d]) => {
        catRows.push([
          cat,
          d.count,
          Math.round(d.mensual),
          Math.round(d.mensual * 12),
          totalMes > 0 ? Number(((d.mensual / totalMes) * 100).toFixed(1)) : 0,
        ]);
      });
    catRows.push([]);
    catRows.push(["TOTAL", items.length, Math.round(totalMes), Math.round(totalMes * 12), 100]);

    const wsCat = XLSX.utils.aoa_to_sheet(catRows);
    wsCat["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Por Categoría");
  }, buildFilename("Ingresos"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. GASTOS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportGastosExcel(gastos, trm) {
  // gastos es un objeto { categoria: [items] }
  const flat = [];
  Object.entries(gastos || {}).forEach(([cat, items]) => {
    (items || []).filter((g) => g.sim !== false).forEach((g) => {
      flat.push({ categoria: cat, concepto: g.c || "", monto: aCOP(g.m, g, trm), tipo: g.t === "f" ? "Fijo" : "Variable" });
    });
  });

  if (flat.length === 0) {
    alert("No hay gastos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  await writeWorkbook((XLSX, wb) => {
    // ── Hoja 1: Detalle ─────────────────────────────────────────
    const rows = [["Categoría", "Concepto", "Monto Mensual", "Monto Anual", "Tipo"]];
    flat
      .sort((a, b) => b.monto - a.monto)
      .forEach((g) => {
        rows.push([g.categoria, g.concepto, Math.round(g.monto), Math.round(g.monto * 12), g.tipo]);
      });

    const totalMes = flat.reduce((s, g) => s + g.monto, 0);
    rows.push([]);
    rows.push(["TOTAL", "", Math.round(totalMes), Math.round(totalMes * 12), ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");

    // ── Hoja 2: Resumen por Categoría ───────────────────────────
    const porCat = {};
    flat.forEach((g) => {
      if (!porCat[g.categoria]) porCat[g.categoria] = { count: 0, fijos: 0, variables: 0 };
      porCat[g.categoria].count += 1;
      if (g.tipo === "Fijo") porCat[g.categoria].fijos += g.monto;
      else porCat[g.categoria].variables += g.monto;
    });
    const catRows = [["Categoría", "# Ítems", "Fijos", "Variables", "Total Mensual", "Total Anual", "% del Total"]];
    Object.entries(porCat)
      .map(([cat, d]) => ({ cat, ...d, total: d.fijos + d.variables }))
      .sort((a, b) => b.total - a.total)
      .forEach((d) => {
        catRows.push([
          d.cat,
          d.count,
          Math.round(d.fijos),
          Math.round(d.variables),
          Math.round(d.total),
          Math.round(d.total * 12),
          totalMes > 0 ? Number(((d.total / totalMes) * 100).toFixed(1)) : 0,
        ]);
      });

    const fijosTotal = flat.filter((g) => g.tipo === "Fijo").reduce((s, g) => s + g.monto, 0);
    const varTotal = totalMes - fijosTotal;
    catRows.push([]);
    catRows.push(["TOTAL", flat.length, Math.round(fijosTotal), Math.round(varTotal), Math.round(totalMes), Math.round(totalMes * 12), 100]);

    const wsCat = XLSX.utils.aoa_to_sheet(catRows);
    wsCat["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Por Categoría");
  }, buildFilename("Gastos"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DEUDAS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportDeudasExcel(deudas, inversiones, owners, trm) {
  const items = (deudas || []).filter((d) => d.sim !== false && (d.mt || 0) > 0);
  if (items.length === 0) {
    alert("No hay deudas activas para exportar. Prendé al menos una con el toggle ✅.");
    return;
  }

  // Helper para nombre de inversión vinculada
  const invName = (invId) => {
    if (!invId) return "";
    const inv = (inversiones || []).find((x) => x.id === invId);
    return inv ? inv.nombre || inv.n || "" : "";
  };

  await writeWorkbook((XLSX, wb) => {
    const rows = [
      [
        "Nombre", "Saldo Actual", "Cuota Mensual", "Cuota Anual",
        "Tasa % Anual", "Meses Restantes", "Total a Pagar",
        "Vinculada a Activo", "Propietario Fiscal", "Notas",
      ],
    ];
    items
      .sort((a, b) => (b.mt || 0) - (a.mt || 0))
      .forEach((d) => {
        const meses = d.meses || d.n_cuotas || 0;
        const saldo = aCOP(d.mt, d, trm);
        const cuota = aCOP(d.pg, d, trm);
        const totalPagar = meses > 0 && cuota ? Math.round(cuota * meses) : saldo;
        rows.push([
          d.n || d.nombre || "",
          Math.round(saldo),
          Math.round(cuota),
          Math.round(cuota * 12),
          d.ts || 0,
          meses,
          totalPagar,
          invName(d.invId),
          ownerName(d.ownerId, owners),
          d.notas || "",
        ]);
      });

    const totalSaldo = items.reduce((s, d) => s + aCOP(d.mt, d, trm), 0);
    const totalCuota = items.reduce((s, d) => s + aCOP(d.pg, d, trm), 0);
    rows.push([]);
    rows.push(["TOTAL", Math.round(totalSaldo), Math.round(totalCuota), Math.round(totalCuota * 12), "", "", "", "", "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 18 },
      { wch: 28 }, { wch: 22 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Deudas");
  }, buildFilename("Deudas"));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PATRIMONIO / INVERSIONES
// ═══════════════════════════════════════════════════════════════════════════
export async function exportInversionesExcel(inversiones, owners, trm) {
  const items = (inversiones || []).filter((i) => i.sim !== false);
  if (items.length === 0) {
    alert("No hay activos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  await writeWorkbook((XLSX, wb) => {
    // ── Hoja 1: Detalle de activos ──────────────────────────────
    const rows = [
      [
        "Nombre", "Tipo", "Ubicación", "Moneda",
        "Valor Compra", "Valor Actual", "Ganancia $", "Ganancia %",
        "Propietario Fiscal", "Notas",
      ],
    ];
    const totalVal = items.reduce((s, i) => s + aCOP(i.va, i, trm), 0);
    items
      .sort((a, b) => aCOP(b.va, b, trm) - aCOP(a.va, a, trm))
      .forEach((i) => {
        const vc = aCOP(i.vc, i, trm);
        const va = aCOP(i.va, i, trm);
        const gain = va - vc;
        const gainPct = vc > 0 ? Number((((va / vc) - 1) * 100).toFixed(2)) : 0;
        rows.push([
          i.nombre || i.n || "",
          i.tp || i.tipo || "Otro",
          i.ub || i.ubicacion || "",
          i.moneda || "COP",
          Math.round(vc),
          Math.round(va),
          Math.round(gain),
          gainPct,
          ownerName(i.ownerId, owners),
          i.notas || "",
        ]);
      });

    const totalVc = items.reduce((s, i) => s + aCOP(i.vc, i, trm), 0);
    const totalGain = totalVal - totalVc;
    const totalGainPct = totalVc > 0 ? Number((((totalVal / totalVc) - 1) * 100).toFixed(2)) : 0;
    rows.push([]);
    rows.push(["TOTAL", "", "", "", Math.round(totalVc), Math.round(totalVal), Math.round(totalGain), totalGainPct, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
      { wch: 22 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Activos");

    // ── Hoja 2: Resumen por Tipo ────────────────────────────────
    const porTipo = {};
    items.forEach((i) => {
      const tp = i.tp || i.tipo || "Otro";
      if (!porTipo[tp]) porTipo[tp] = { count: 0, vc: 0, va: 0 };
      porTipo[tp].count += 1;
      porTipo[tp].vc += aCOP(i.vc, i, trm);
      porTipo[tp].va += aCOP(i.va, i, trm);
    });
    const tipoRows = [["Tipo", "# Activos", "Valor Compra", "Valor Actual", "Ganancia $", "% del Portafolio"]];
    Object.entries(porTipo)
      .sort((a, b) => b[1].va - a[1].va)
      .forEach(([tp, d]) => {
        tipoRows.push([
          tp,
          d.count,
          Math.round(d.vc),
          Math.round(d.va),
          Math.round(d.va - d.vc),
          totalVal > 0 ? Number(((d.va / totalVal) * 100).toFixed(1)) : 0,
        ]);
      });
    tipoRows.push([]);
    tipoRows.push(["TOTAL", items.length, Math.round(totalVc), Math.round(totalVal), Math.round(totalGain), 100]);

    const wsTipo = XLSX.utils.aoa_to_sheet(tipoRows);
    wsTipo["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsTipo, "Por Tipo");

    // ── Hoja 3: Resumen por Propietario ─────────────────────────
    if (owners && owners.length > 0) {
      const porOwner = {};
      items.forEach((i) => {
        const oName = ownerName(i.ownerId, owners) || "Sin asignar";
        if (!porOwner[oName]) porOwner[oName] = { count: 0, vc: 0, va: 0 };
        porOwner[oName].count += 1;
        porOwner[oName].vc += aCOP(i.vc, i, trm);
        porOwner[oName].va += aCOP(i.va, i, trm);
      });
      const ownerRows = [["Propietario Fiscal", "# Activos", "Valor Compra", "Valor Actual", "Ganancia $", "% del Portafolio"]];
      Object.entries(porOwner)
        .sort((a, b) => b[1].va - a[1].va)
        .forEach(([oName, d]) => {
          ownerRows.push([
            oName,
            d.count,
            Math.round(d.vc),
            Math.round(d.va),
            Math.round(d.va - d.vc),
            totalVal > 0 ? Number(((d.va / totalVal) * 100).toFixed(1)) : 0,
          ]);
        });
      ownerRows.push([]);
      ownerRows.push(["TOTAL", items.length, Math.round(totalVc), Math.round(totalVal), Math.round(totalGain), 100]);

      const wsOwner = XLSX.utils.aoa_to_sheet(ownerRows);
      wsOwner["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsOwner, "Por Propietario");
    }
  }, buildFilename("Patrimonio"));
}
