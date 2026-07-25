// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · pdfExport.js — Generador de PDFs profesionales del borrador
//
// PROPÓSITO:
//   Genera un PDF del borrador F-110 (jurídica) o F-210 (natural) listo
//   para enviar al contador. Cierra el ciclo del producto: el user puede
//   compartir su trabajo con el contador real para validación.
//
// FORMATO:
//   - Tamaño: Letter (US standard, compatible Colombia)
//   - Header con branding FINPATHIA + datos del owner + año
//   - Resumen ejecutivo con números clave (saldo, retención, impuesto)
//   - Tabla detallada de renglones por sección
//   - Footer con disclaimer legal
//
// FILOSOFÍA:
//   - Tipografía profesional pero legible
//   - Colores sobrios (negro, gris, verde para totales positivos)
//   - El PDF debe parecer un documento de contabilidad serio
//   - Lo suficientemente claro para que cualquier contador lo entienda
// ═══════════════════════════════════════════════════════════════════════════

// 25-jul-2026: jsPDF y jspdf-autotable se cargan bajo demanda.
// Eran la mayor carga muerta del bundle principal (123 referencias): se
// descargaban en CADA visita aunque el usuario nunca exportara un PDF.
// Al hacerlas dinámicas, solo las baja quien realmente aprieta "Exportar".
import { generarBorradorF110, SECCIONES_F110 } from "./borradorDeclaracion.js";
import { generarBorradorF210, SECCIONES_F210 } from "./borradorDeclaracionF210.js";

// Helpers de formato
const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
const fmDate = () => {
  const d = new Date();
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
};

/**
 * Genera y descarga un PDF del borrador para el owner indicado.
 *
 * @param {object} user - User completo
 * @param {object} owner - Owner fiscal (juridica o natural)
 * @param {object} estimacion - Output de estimarImpuesto(user)
 * @param {number} ano - Año gravable (default 2025)
 */
export async function exportarBorradorPDF(user, owner, estimacion, ano = 2025) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  if (!owner) {
    alert("Seleccioná un owner fiscal antes de exportar.");
    return;
  }

  const isJuridica = owner.type === "juridica";
  const formulario = isJuridica ? "F-110" : "F-210";

  // Generar renglones según tipo
  const renglones = isJuridica
    ? generarBorradorF110(user, owner, estimacion, ano)
    : generarBorradorF210(user, owner, estimacion, ano);

  if (!renglones || renglones.length === 0) {
    alert("No hay datos suficientes para generar el PDF.");
    return;
  }

  const SECCIONES = isJuridica ? SECCIONES_F110 : SECCIONES_F210;
  const seccionesOrden = isJuridica
    ? ["patrimonio", "ingresos", "costos", "renta", "impuesto", "liquidacion"]
    : ["patrimonio", "trabajo", "deducciones", "capital", "noLaboral", "dividendos", "rentaTotal", "impuesto", "liquidacion"];

  // Datos del motor para resumen
  const det = estimacion?.detalle?.find(d => d.name === owner.name);
  const ingresoTotal = det?.ingreso || 0;
  const impuestoBruto = det?.impBruto || 0;
  const retencionTotal = isJuridica
    ? (det?.retefuenteCalc || det?.retencionDesglose?.total || 0)
    : (det?.retefuenteNat || 0);
  const saldoFinal = det?.impuesto || 0;
  const tasaEfectiva = ingresoTotal > 0 ? ((saldoFinal / ingresoTotal) * 100).toFixed(2) : "0.00";

  // ── INICIALIZAR PDF ────────────────────────────────────────────────────
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14; // margen lateral

  // ── HEADER ──────────────────────────────────────────────────────────────
  // Banda superior color
  doc.setFillColor(124, 58, 237); // purple-600
  doc.rect(0, 0, W, 8, "F");

  // Logo / brand (texto)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 24);
  doc.text("FINPATHIA", M, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text("Agente Tributario IA", M, 25);

  // Título derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 24);
  doc.text(`Borrador ${formulario}`, W - M, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  doc.text(`Año gravable ${ano}`, W - M, 25, { align: "right" });

  // Línea separadora
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.3);
  doc.line(M, 30, W - M, 30);

  // ── DATOS DEL OWNER ─────────────────────────────────────────────────────
  let y = 38;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 24);
  doc.text("Datos del contribuyente", M, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 70);
  doc.text(`Nombre: ${owner.name || "—"}`, M, y);
  y += 5;
  doc.text(`Tipo: ${isJuridica ? "Persona jurídica (sociedad)" : "Persona natural"}`, M, y);
  y += 5;
  if (owner.nit) { doc.text(`NIT/Cédula: ${owner.nit}`, M, y); y += 5; }
  if (isJuridica && owner.regimen) { doc.text(`Régimen: ${owner.regimen}`, M, y); y += 5; }
  doc.text(`Generado: ${fmDate()}`, M, y);
  y += 10;

  // ── RESUMEN EJECUTIVO ───────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 24);
  doc.text("Resumen ejecutivo", M, y);
  y += 6;

  // 4 KPIs en grid
  const kpiW = (W - 2 * M - 6) / 4;
  const kpiH = 22;
  const kpis = [
    { label: "Ingreso total", value: fm(ingresoTotal), color: [60, 60, 70] },
    { label: "Impuesto bruto", value: fm(impuestoBruto), color: [180, 60, 60] },
    { label: "Retenciones", value: fm(retencionTotal), color: [60, 140, 60] },
    { label: "Saldo a pagar", value: fm(saldoFinal), color: [124, 58, 237] },
  ];
  kpis.forEach((kpi, i) => {
    const x = M + i * (kpiW + 2);
    doc.setFillColor(248, 248, 250);
    doc.setDrawColor(220, 220, 225);
    doc.roundedRect(x, y, kpiW, kpiH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 130);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 3, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 150);
    if (i === 3) doc.text(`Tasa efectiva: ${tasaEfectiva}%`, x + 3, y + 19);
  });
  y += kpiH + 10;

  // ── DETALLE POR SECCIONES (TABLA AUTOTABLE) ────────────────────────────
  const renglonesPorSeccion = seccionesOrden.map(sec => ({
    seccion: sec,
    info: SECCIONES[sec],
    items: renglones.filter(r => r.seccion === sec),
  })).filter(s => s.items.length > 0);

  for (const { seccion, info, items } of renglonesPorSeccion) {
    if (y > H - 40) { doc.addPage(); y = 20; }

    // Header de sección
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 24);
    doc.text(`${info?.label || seccion}`, M, y);
    y += 2;

    // Construir filas: número | concepto | valor
    const body = items.map(r => {
      const isFormula = r.tipo === "formula";
      const valor = fm(r.valor || 0);
      return [
        { content: String(r.numero), styles: { halign: "left", cellWidth: 14, fontStyle: isFormula ? "bold" : "normal", textColor: isFormula ? [60, 60, 70] : [120, 120, 130] } },
        { content: r.concepto + (r.articulo ? ` (${r.articulo})` : ""), styles: { fontStyle: r.destacado ? "bold" : "normal", textColor: r.destacado ? [20, 20, 24] : [60, 60, 70] } },
        { content: valor, styles: { halign: "right", fontStyle: isFormula || r.destacado ? "bold" : "normal", textColor: r.destacado ? [124, 58, 237] : [60, 60, 70], cellWidth: 32 } },
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [[{ content: "#", styles: { halign: "left" } }, { content: "Concepto", styles: { halign: "left" } }, { content: "Valor", styles: { halign: "right" } }]],
      body,
      theme: "plain",
      headStyles: { fillColor: [240, 240, 245], textColor: [80, 80, 90], fontSize: 8, fontStyle: "bold", cellPadding: 2 },
      bodyStyles: { fontSize: 9, cellPadding: 1.5, textColor: [60, 60, 70] },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      margin: { left: M, right: M },
      didDrawPage: (data) => { y = data.cursor.y; },
    });

    y = doc.lastAutoTable.finalY + 6;
  }

  // ── DISCLAIMER FINAL ────────────────────────────────────────────────────
  if (y > H - 35) { doc.addPage(); y = 20; }
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 146, 60);
  doc.roundedRect(M, y, W - 2 * M, 22, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(180, 80, 20);
  doc.text("⚠ IMPORTANTE — para tu contador", M + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 60, 40);
  const disclaimer = "Este documento es un BORRADOR generado por inteligencia artificial a partir de los datos cargados por el usuario en FINPATHIA. NO es la declaración final ni constituye asesoría tributaria definitiva. Antes de presentar a la DIAN, debe ser validado y firmado por un contador certificado. FINPATHIA no asume responsabilidad por decisiones tomadas con base en este borrador.";
  const lines = doc.splitTextToSize(disclaimer, W - 2 * M - 8);
  doc.text(lines, M + 4, y + 11);

  // ── FOOTER (en cada página) ─────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 170);
    doc.text(`FINPATHIA · finpathia.com · Generado el ${fmDate()}`, M, H - 8);
    doc.text(`Página ${i} de ${pageCount}`, W - M, H - 8, { align: "right" });
  }

  // ── DESCARGAR ───────────────────────────────────────────────────────────
  const filename = `Borrador_${formulario}_${owner.name?.replace(/[^a-zA-Z0-9]/g, "_") || "owner"}_${ano}.pdf`;
  doc.save(filename);
}
