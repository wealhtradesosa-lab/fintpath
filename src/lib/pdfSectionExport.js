// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · pdfSectionExport.js — PDF por módulo (Patrimonio, Ingresos,
// Gastos, Deudas)
//
// PROPÓSITO:
//   Genera un PDF legible de cada sección, para imprimir, archivar o mandar
//   al contador / al banco / a la familia.
//
// POR QUÉ NO ES UN CLON DE excelExport.js:
//   El Excel es el volcado completo: 10-12 columnas, todos los campos, para
//   que el que recibe pueda filtrar y recalcular. El PDF es un documento que
//   alguien lee. Meter 12 columnas en una hoja Letter da una tabla de 7pt
//   ilegible. Por eso acá cada sección lleva las columnas que sostienen la
//   lectura, más un resumen arriba y un desglose por categoría abajo.
//   Los dos exports conviven: Excel para trabajar los datos, PDF para leerlos.
//
// CONSISTENCIA CON excelExport.js (deliberada, no accidental):
//   - Mismo filtro sim !== false en las 4 secciones
//   - Mismos campos de origen (i.mensual, g.m, d.mt, i.va…)
//   - Mismos totales, para que un Excel y un PDF de la misma fecha no puedan
//     contradecirse. Si cambia el criterio en un lado, cambia en los dos.
//
// TÉCNICA:
//   jsPDF + jspdf-autotable con import dinámico, igual que pdfExport.js: son
//   la mayor carga muerta del bundle y solo debe bajarlas quien exporta.
// ═══════════════════════════════════════════════════════════════════════════

// ── Helpers de formato ──────────────────────────────────────────────────────
// El signo va delante del $, no entre el $ y el número: "-$9.000.000" y no
// "$-9.000.000", que es como lo escribe toLocaleString y se lee mal en una
// columna de pérdidas.
const fm = (v) => {
  const n = Math.round(Number(v) || 0);
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-CO");
};
const pct = (v) => (Number(v) || 0).toFixed(1) + "%";

const fmDate = () =>
  new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

const buildFilename = (modulo) =>
  `FINPATHIA_${modulo}_${new Date().toISOString().slice(0, 10)}.pdf`;

const ownerName = (ownerId, owners) => {
  if (!ownerId) return "";
  const o = (owners || []).find((x) => x.id === ownerId);
  return o ? o.name || o.n || "" : "";
};

// Paleta alineada con pdfExport.js para que los PDFs de FINPATHIA se vean
// como una familia y no como cuatro documentos sueltos.
const PURPLE = [124, 58, 237];
const INK = [20, 20, 24];
const GRAY = [120, 120, 130];
const LINE = [220, 220, 225];

/**
 * Header + footer comunes. Devuelve la Y donde puede empezar el contenido.
 */
function chrome(doc, { titulo, subtitulo }) {
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("FINPATHIA", M, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Tu family office", M, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(titulo, W - M, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(subtitulo || fmDate(), W - M, 25, { align: "right" });

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(M, 30, W - M, 30);

  return 38;
}

/**
 * Bloque de cifras clave. Hasta 4 por fila para que no se apelmacen.
 */
function resumen(doc, y, stats) {
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const cols = Math.min(stats.length, 4);
  const cw = (W - M * 2) / cols;

  stats.forEach((s, i) => {
    const x = M + cw * (i % cols);
    const row = Math.floor(i / cols);
    const yy = y + row * 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(String(s.label).toUpperCase(), x, yy);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...(s.color || INK));
    doc.text(String(s.value), x, yy + 7);
  });

  return y + Math.ceil(stats.length / cols) * 18 + 4;
}

/**
 * Pie de página con numeración y la aclaración de qué incluye el documento.
 * Se dibuja al final, cuando ya se sabe cuántas páginas hay.
 */
function footer(doc, nota) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const total = doc.internal.getNumberOfPages();

  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, H - 16, W - M, H - 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(nota, M, H - 11, { maxWidth: W - M * 2 - 25 });
    doc.text(`${p} / ${total}`, W - M, H - 11, { align: "right" });
  }
}

/**
 * Envoltorio: carga las libs, arma el doc, dibuja y descarga.
 */
async function build(filename, drawFn, nota) {
  const [jm, am] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  // jspdf expone el constructor distinto según cómo se resuelva el módulo:
  // bundleado por Vite llega como default, en Node ESM el default es el
  // namespace CJS y el constructor cuelga de .jsPDF. Probamos las tres formas
  // en vez de asumir una, así el mismo archivo corre en el navegador y en los
  // tests. Igual para autotable.
  const jsPDF = jm.jsPDF || (jm.default && jm.default.jsPDF) || jm.default;
  const autoTable = (am.default && am.default.default) || am.default || am.autoTable;

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  drawFn(doc, autoTable);
  footer(doc, nota);
  doc.save(filename);
}

// Estilo de tabla único para las 4 secciones.
const tableStyle = {
  theme: "striped",
  headStyles: { fillColor: PURPLE, textColor: 255, fontSize: 8.5, fontStyle: "bold" },
  bodyStyles: { fontSize: 8.5, textColor: INK },
  alternateRowStyles: { fillColor: [248, 248, 250] },
  footStyles: { fillColor: [238, 238, 242], textColor: INK, fontStyle: "bold", fontSize: 8.5 },
  margin: { left: 14, right: 14, bottom: 22 },
};

// Nota de pie compartida. Es importante que esté: los toggles hacen que el
// total del PDF pueda no coincidir con lo que el usuario ve si tiene ítems
// apagados, y sin esta línea parecería un error de cálculo.
const NOTA = "Documento generado por FINPATHIA. Incluye únicamente los ítems activos (los apagados con el toggle quedan fuera de las tablas y de los totales). Cifras de referencia, no constituyen asesoría fiscal ni estados financieros auditados.";

// ═══════════════════════════════════════════════════════════════════════════
// 1. PATRIMONIO
// ═══════════════════════════════════════════════════════════════════════════
export async function exportPatrimonioPDF(inversiones, owners) {
  const items = (inversiones || []).filter((i) => i.sim !== false);
  if (items.length === 0) {
    alert("No hay activos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  const totalVa = items.reduce((s, i) => s + (+i.va || 0), 0);
  const totalVc = items.reduce((s, i) => s + (+i.vc || 0), 0);
  const gain = totalVa - totalVc;
  const gainPct = totalVc > 0 ? ((totalVa / totalVc) - 1) * 100 : 0;

  await build(buildFilename("Patrimonio"), (doc, autoTable) => {
    let y = chrome(doc, { titulo: "Patrimonio" });

    y = resumen(doc, y, [
      { label: "Activos", value: String(items.length) },
      { label: "Valor de compra", value: fm(totalVc) },
      { label: "Valor actual", value: fm(totalVa) },
      {
        label: "Ganancia",
        value: `${fm(gain)} (${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%)`,
        color: gain >= 0 ? [22, 163, 74] : [220, 38, 38],
      },
    ]);

    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [["Activo", "Tipo", "Propietario", "Valor compra", "Valor actual", "Ganancia", "%"]],
      body: items
        .slice()
        .sort((a, b) => (+b.va || 0) - (+a.va || 0))
        .map((i) => {
          const vc = +i.vc || 0;
          const va = +i.va || 0;
          const g = va - vc;
          return [
            i.nombre || i.n || "",
            i.tp || i.tipo || "Otro",
            ownerName(i.ownerId, owners),
            fm(vc),
            fm(va),
            fm(g),
            vc > 0 ? `${g >= 0 ? "+" : ""}${(((va / vc) - 1) * 100).toFixed(1)}%` : "—",
          ];
        }),
      foot: [["TOTAL", "", "", fm(totalVc), fm(totalVa), fm(gain), `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%`]],
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" },
        5: { halign: "right" }, 6: { halign: "right" },
      },
    });

    // Desglose por tipo: responde "en qué está concentrado mi patrimonio",
    // que es la pregunta real detrás de exportar esta sección.
    const porTipo = {};
    items.forEach((i) => {
      const tp = i.tp || i.tipo || "Otro";
      if (!porTipo[tp]) porTipo[tp] = { count: 0, va: 0 };
      porTipo[tp].count += 1;
      porTipo[tp].va += +i.va || 0;
    });

    autoTable(doc, {
      ...tableStyle,
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Concentración por tipo", "# Activos", "Valor actual", "% del portafolio"]],
      body: Object.entries(porTipo)
        .sort((a, b) => b[1].va - a[1].va)
        .map(([tp, d]) => [
          tp,
          String(d.count),
          fm(d.va),
          totalVa > 0 ? pct((d.va / totalVa) * 100) : "0.0%",
        ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }, NOTA);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. INGRESOS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportIngresosPDF(ingresos, owners) {
  const items = (ingresos || []).filter((i) => i.sim !== false);
  if (items.length === 0) {
    alert("No hay ingresos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  const totalMes = items.reduce((s, i) => s + (i.mensual || 0), 0);

  await build(buildFilename("Ingresos"), (doc, autoTable) => {
    let y = chrome(doc, { titulo: "Ingresos" });

    y = resumen(doc, y, [
      { label: "Fuentes", value: String(items.length) },
      { label: "Total mensual", value: fm(totalMes), color: [22, 163, 74] },
      { label: "Total anual", value: fm(totalMes * 12), color: [22, 163, 74] },
    ]);

    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [["Fuente", "Categoría DIAN", "Tipo", "Propietario", "Mensual", "Anual"]],
      body: items
        .slice()
        .sort((a, b) => (b.mensual || 0) - (a.mensual || 0))
        .map((i) => [
          i.nombre || "",
          i.categoria || "",
          i.tipo || "fijo",
          ownerName(i.ownerId, owners),
          fm(i.mensual || 0),
          fm((i.mensual || 0) * 12),
        ]),
      foot: [["TOTAL", "", "", "", fm(totalMes), fm(totalMes * 12)]],
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
    });

    const porCat = {};
    items.forEach((i) => {
      const cat = i.categoria || "Sin categoría";
      if (!porCat[cat]) porCat[cat] = { count: 0, mensual: 0 };
      porCat[cat].count += 1;
      porCat[cat].mensual += i.mensual || 0;
    });

    autoTable(doc, {
      ...tableStyle,
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Categoría DIAN", "# Ingresos", "Mensual", "Anual", "% del total"]],
      body: Object.entries(porCat)
        .sort((a, b) => b[1].mensual - a[1].mensual)
        .map(([cat, d]) => [
          cat,
          String(d.count),
          fm(d.mensual),
          fm(d.mensual * 12),
          totalMes > 0 ? pct((d.mensual / totalMes) * 100) : "0.0%",
        ]),
      columnStyles: {
        1: { halign: "right" }, 2: { halign: "right" },
        3: { halign: "right" }, 4: { halign: "right" },
      },
    });
  }, NOTA);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. GASTOS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportGastosPDF(gastos) {
  // gastos llega como objeto { categoria: [items] }, igual que en Excel.
  const flat = [];
  Object.entries(gastos || {}).forEach(([cat, items]) => {
    (items || [])
      .filter((g) => g.sim !== false)
      .forEach((g) => {
        flat.push({
          categoria: cat,
          concepto: g.c || "",
          monto: g.m || 0,
          tipo: g.t === "f" ? "Fijo" : "Variable",
        });
      });
  });

  if (flat.length === 0) {
    alert("No hay gastos activos para exportar. Prendé al menos uno con el toggle ✅.");
    return;
  }

  const totalMes = flat.reduce((s, g) => s + g.monto, 0);
  const fijos = flat.filter((g) => g.tipo === "Fijo").reduce((s, g) => s + g.monto, 0);
  const variables = totalMes - fijos;

  await build(buildFilename("Gastos"), (doc, autoTable) => {
    let y = chrome(doc, { titulo: "Gastos" });

    // Fijos vs variables va arriba a propósito: es el dato que decide cuánto
    // de tu gasto podés mover si necesitás ajustar.
    y = resumen(doc, y, [
      { label: "Ítems", value: String(flat.length) },
      { label: "Total mensual", value: fm(totalMes), color: [220, 38, 38] },
      { label: "Fijos", value: `${fm(fijos)} (${totalMes > 0 ? pct((fijos / totalMes) * 100) : "0.0%"})` },
      { label: "Variables", value: `${fm(variables)} (${totalMes > 0 ? pct((variables / totalMes) * 100) : "0.0%"})` },
    ]);

    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [["Categoría", "Concepto", "Tipo", "Mensual", "Anual"]],
      body: flat
        .slice()
        .sort((a, b) => b.monto - a.monto)
        .map((g) => [g.categoria, g.concepto, g.tipo, fm(g.monto), fm(g.monto * 12)]),
      foot: [["TOTAL", "", "", fm(totalMes), fm(totalMes * 12)]],
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    });

    const porCat = {};
    flat.forEach((g) => {
      if (!porCat[g.categoria]) porCat[g.categoria] = { count: 0, fijos: 0, variables: 0 };
      porCat[g.categoria].count += 1;
      if (g.tipo === "Fijo") porCat[g.categoria].fijos += g.monto;
      else porCat[g.categoria].variables += g.monto;
    });

    autoTable(doc, {
      ...tableStyle,
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Categoría", "# Ítems", "Fijos", "Variables", "Mensual", "% del total"]],
      body: Object.entries(porCat)
        .map(([cat, d]) => ({ cat, ...d, total: d.fijos + d.variables }))
        .sort((a, b) => b.total - a.total)
        .map((d) => [
          d.cat,
          String(d.count),
          fm(d.fijos),
          fm(d.variables),
          fm(d.total),
          totalMes > 0 ? pct((d.total / totalMes) * 100) : "0.0%",
        ]),
      columnStyles: {
        1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
        4: { halign: "right" }, 5: { halign: "right" },
      },
    });
  }, NOTA);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. DEUDAS
// ═══════════════════════════════════════════════════════════════════════════
export async function exportDeudasPDF(deudas, inversiones, owners) {
  // Mismo filtro que el Excel: además de sim !== false, exige saldo > 0.
  // Una deuda saldada no es una deuda.
  const items = (deudas || []).filter((d) => d.sim !== false && (d.mt || 0) > 0);
  if (items.length === 0) {
    alert("No hay deudas activas para exportar. Prendé al menos una con el toggle ✅.");
    return;
  }

  const invName = (invId) => {
    if (!invId) return "";
    const inv = (inversiones || []).find((x) => x.id === invId);
    return inv ? inv.nombre || inv.n || "" : "";
  };

  const totalSaldo = items.reduce((s, d) => s + (d.mt || 0), 0);
  const totalCuota = items.reduce((s, d) => s + (d.pg || 0), 0);
  // Tasa promedio ponderada por saldo: el promedio simple miente cuando hay
  // una tarjeta chica al 30% junto a una hipoteca grande al 12%.
  const tasaPond = totalSaldo > 0
    ? items.reduce((s, d) => s + (d.ts || 0) * (d.mt || 0), 0) / totalSaldo
    : 0;

  await build(buildFilename("Deudas"), (doc, autoTable) => {
    let y = chrome(doc, { titulo: "Deudas" });

    y = resumen(doc, y, [
      { label: "Deudas", value: String(items.length) },
      { label: "Saldo total", value: fm(totalSaldo), color: [220, 38, 38] },
      { label: "Cuota mensual", value: fm(totalCuota) },
      { label: "Tasa promedio", value: pct(tasaPond) },
    ]);

    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [["Deuda", "Propietario", "Vinculada a", "Saldo", "Cuota mes", "Tasa", "Meses"]],
      body: items
        .slice()
        .sort((a, b) => (b.mt || 0) - (a.mt || 0))
        .map((d) => {
          const meses = d.meses || d.n_cuotas || 0;
          return [
            d.n || d.nombre || "",
            ownerName(d.ownerId, owners),
            invName(d.invId),
            fm(d.mt || 0),
            fm(d.pg || 0),
            pct(d.ts || 0),
            meses > 0 ? String(meses) : "—",
          ];
        }),
      foot: [["TOTAL", "", "", fm(totalSaldo), fm(totalCuota), pct(tasaPond), ""]],
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" },
        5: { halign: "right" }, 6: { halign: "right" },
      },
    });

    // Orden por tasa: es el orden en que conviene pagarlas (método avalancha).
    // La tabla de arriba va por saldo, que es lo que pesa; esta va por costo,
    // que es lo que decide cuál atacar primero.
    autoTable(doc, {
      ...tableStyle,
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Orden sugerido de pago (mayor tasa primero)", "Tasa", "Saldo", "Costo anual en intereses"]],
      body: items
        .slice()
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .map((d) => [
          d.n || d.nombre || "",
          pct(d.ts || 0),
          fm(d.mt || 0),
          fm(((d.ts || 0) / 100) * (d.mt || 0)),
        ]),
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    });
  }, NOTA);
}
