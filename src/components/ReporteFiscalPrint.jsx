// ═══════════════════════════════════════════════════════════════════════════
// REPORTE FISCAL PRINT — Commit 7
// ─────────────────────────────────────────────────────────────────────────
// Vista optimizada para exportar a PDF vía window.print(). Estructura:
//   · Header: logo + owner + fecha de generación
//   · Sección 1: Resumen fiscal del año actual (simulación motor)
//   · Sección 2: Declaraciones históricas cargadas (tabla)
//   · Sección 3: Diff año-a-año (si hay declaración previa)
//   · Sección 4: Alertas fiscales detectadas
//   · Sección 5: Recomendaciones con números concretos
//   · Footer: "Generado por FINPATHIA · finpathia.com · [fecha]"
//
// Diseño: papel A4, tipografía grande, colores que funcionan en B/N, sin
// dependencias externas. El usuario hace Cmd+P → "Guardar como PDF" desde
// cualquier browser moderno.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect } from "react";

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
const pc = (v) => (Number(v) || 0).toFixed(1) + "%";

const PRINT_STYLES = `
  @media print {
    @page { size: A4; margin: 14mm; }
    body { background: white !important; }
    .rf-no-print { display: none !important; }
    .rf-page-break { page-break-before: always; }
    .rf-avoid-break { page-break-inside: avoid; }
  }
  .rf-report {
    background: white;
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px 24px;
  }
  .rf-report h1 { font-size: 20px; margin: 0 0 4px; color: #111; }
  .rf-report h2 { font-size: 14px; margin: 20px 0 8px; color: #111; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .rf-report h3 { font-size: 12px; margin: 14px 0 6px; color: #333; }
  .rf-report table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  .rf-report th { text-align: left; background: #f3f4f6; padding: 6px 8px; font-size: 10px; font-weight: 700; border-bottom: 1px solid #111; }
  .rf-report th.right { text-align: right; }
  .rf-report td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  .rf-report td.right { text-align: right; font-family: "SF Mono", Monaco, monospace; }
  .rf-report td.pos { color: #15803d; font-weight: 600; }
  .rf-report td.neg { color: #b91c1c; font-weight: 600; }
  .rf-report .rf-kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 8px 0; }
  .rf-report .rf-kpi { border: 1px solid #d1d5db; padding: 8px 10px; border-radius: 4px; }
  .rf-report .rf-kpi-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .rf-report .rf-kpi-value { font-size: 16px; font-weight: 800; color: #111; font-family: "SF Mono", Monaco, monospace; }
  .rf-report .rf-kpi-delta { font-size: 9px; color: #6b7280; margin-top: 2px; }
  .rf-report .rf-alert { padding: 8px 10px; margin: 4px 0; border-left: 3px solid #d97706; background: #fef3c7; font-size: 10px; border-radius: 3px; }
  .rf-report .rf-alert.error { border-left-color: #dc2626; background: #fee2e2; }
  .rf-report .rf-alert.info { border-left-color: #2563eb; background: #dbeafe; }
  .rf-report .rf-rec { padding: 10px; margin: 6px 0; border: 1px solid #d1d5db; border-radius: 4px; }
  .rf-report .rf-rec-title { font-weight: 700; font-size: 11px; margin-bottom: 3px; color: #111; }
  .rf-report .rf-rec-desc { font-size: 10px; color: #374151; margin-bottom: 4px; }
  .rf-report .rf-rec-ahorro { font-size: 14px; font-weight: 800; color: #15803d; font-family: "SF Mono", Monaco, monospace; }
  .rf-report .rf-rec-base { font-size: 9px; color: #6b7280; font-family: "SF Mono", Monaco, monospace; }
  .rf-report .rf-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 9px; color: #6b7280; text-align: center; }
  .rf-report .rf-meta { font-size: 10px; color: #6b7280; margin-bottom: 6px; }
  .rf-report .rf-disclaimer { background: #f9fafb; padding: 10px; border-radius: 4px; font-size: 9px; color: #6b7280; line-height: 1.5; margin-top: 12px; border-left: 3px solid #9ca3af; }
`;

export default function ReporteFiscalPrint({
  owner,
  declaraciones,
  estimacionDetalle,
  patrimonioLiquidoActual,
  alertas,
  recomendaciones,
  onClose,
}) {
  useEffect(() => {
    // Al montar, auto-trigger print dialog después de que el render termine.
    // Pequeño delay para que el browser aplique los estilos antes del diálogo.
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);

  const declarada = declaraciones?.[0];
  const esF110 = declarada?.tipo === "F110";
  const r = declarada?.renglones || {};
  const fechaHoy = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

  const impuestoActual = Number(estimacionDetalle?.impBruto) || Number(estimacionDetalle?.impuesto) || 0;
  const ingresoActual = Number(estimacionDetalle?.ingreso) || 0;
  const tasaActual = ingresoActual > 0 ? (impuestoActual / ingresoActual) * 100 : 0;

  const patrimonioDeclarado = declarada ? (Number(r.patrimonioLiquido) || 0) : null;
  const impuestoDeclarado = declarada
    ? (esF110 ? (Number(r.impuestoNeto) || Number(r.impuestoCalculado) || 0) : (Number(r.impuestoCalculado) || 0))
    : null;
  const ingresoDeclarado = declarada ? (Number(r.ingresosBrutos) || 0) : null;
  const tasaDeclarada = declarada && ingresoDeclarado > 0 ? (impuestoDeclarado / ingresoDeclarado) * 100 : null;

  const accionables = (recomendaciones || []).filter(rec => rec.severity !== "info" && rec.ahorroAnualEstimado > 0);
  const totalAhorroPotencial = accionables.reduce((s, rec) => s + (Number(rec.ahorroAnualEstimado) || 0), 0);

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Toolbar (no se imprime) */}
      <div className="rf-no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000,
        background: "#111", color: "#fff", padding: "10px 20px",
        display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>📄 Vista previa del reporte — Ctrl/Cmd + P para imprimir o guardar como PDF</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 14px", background: "#3b82f6", border: "none", borderRadius: 6, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🖨️ Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} style={{ padding: "8px 14px", background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, color: "#fafafa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ← Volver
          </button>
        </div>
      </div>

      {/* Espaciador para que el toolbar no tape el contenido en pantalla */}
      <div className="rf-no-print" style={{ height: 54 }} />

      {/* Reporte imprimible */}
      <div className="rf-report">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <h1>Reporte Fiscal</h1>
            <div className="rf-meta">
              <strong>{owner?.name}</strong> · {owner?.type === "juridica" ? "Persona Jurídica" : "Persona Natural"}
              {owner?.type === "juridica" && owner?.regimen && ` · Régimen ${owner.regimen}`}
            </div>
            <div className="rf-meta">Generado el {fechaHoy}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#6b7280" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#111" }}>FINPATHIA</div>
            <div>finpathia.com</div>
          </div>
        </div>

        {/* Sección 1: Resumen fiscal actual */}
        <div className="rf-avoid-break">
          <h2>1. Situación fiscal actual (simulación FINPATHIA)</h2>
          <div className="rf-kpi-grid">
            <div className="rf-kpi">
              <div className="rf-kpi-label">Patrimonio líquido</div>
              <div className="rf-kpi-value">{fm(patrimonioLiquidoActual)}</div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi-label">Ingresos estimados anuales</div>
              <div className="rf-kpi-value">{fm(ingresoActual)}</div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi-label">Impuesto estimado (bruto)</div>
              <div className="rf-kpi-value">{fm(impuestoActual)}</div>
            </div>
            <div className="rf-kpi">
              <div className="rf-kpi-label">Tasa efectiva</div>
              <div className="rf-kpi-value">{pc(tasaActual)}</div>
            </div>
          </div>
        </div>

        {/* Sección 2: Historial de declaraciones */}
        {declaraciones && declaraciones.length > 0 && (
          <div className="rf-avoid-break">
            <h2>2. Declaraciones oficiales cargadas</h2>
            <table>
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Tipo</th>
                  <th className="right">Ingresos brutos</th>
                  <th className="right">Patrimonio líquido</th>
                  <th className="right">Impuesto</th>
                  <th className="right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {declaraciones.map((d) => {
                  const rr = d.renglones || {};
                  const is110 = d.tipo === "F110";
                  const imp = is110 ? (Number(rr.impuestoNeto) || Number(rr.impuestoCalculado) || 0) : (Number(rr.impuestoCalculado) || 0);
                  return (
                    <tr key={d.anoGravable}>
                      <td><strong>{d.anoGravable}</strong></td>
                      <td>{d.tipo}</td>
                      <td className="right">{fm(rr.ingresosBrutos)}</td>
                      <td className="right">{fm(rr.patrimonioLiquido)}</td>
                      <td className="right">{fm(imp)}</td>
                      <td className="right">{fm(rr.saldoPagar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sección 3: Diff año-a-año */}
        {declarada && (
          <div className="rf-avoid-break">
            <h2>3. Comparación año {declarada.anoGravable} vs actual</h2>
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="right">{declarada.anoGravable}</th>
                  <th className="right">Actual</th>
                  <th className="right">Δ</th>
                  <th className="right">%</th>
                </tr>
              </thead>
              <tbody>
                {renderDiffRow("Ingresos brutos", ingresoDeclarado, ingresoActual)}
                {renderDiffRow("Patrimonio líquido", patrimonioDeclarado, patrimonioLiquidoActual)}
                {renderDiffRow("Impuesto", impuestoDeclarado, impuestoActual)}
                {renderDiffRow("Tasa efectiva", tasaDeclarada, tasaActual, pc)}
              </tbody>
            </table>
          </div>
        )}

        {/* Sección 4: Alertas */}
        {alertas && alertas.length > 0 && (
          <div>
            <h2>4. Alertas detectadas ({alertas.length})</h2>
            {alertas.map((w, i) => (
              <div key={i} className={"rf-alert " + (w.severity === "error" ? "error" : w.severity === "info" ? "info" : "")}>
                <strong>{w.message}</strong>
                {w.accionSugerida && <div style={{ marginTop: 4, color: "#374151" }}>💡 {w.accionSugerida}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Sección 5: Recomendaciones */}
        {accionables.length > 0 && (
          <div>
            <h2>5. Recomendaciones de optimización</h2>
            <div className="rf-meta" style={{ marginBottom: 8 }}>
              Ahorro potencial total estimado: <strong style={{ color: "#15803d" }}>{fm(totalAhorroPotencial)}/año</strong>
            </div>
            {accionables.map((rec, i) => (
              <div key={i} className="rf-rec rf-avoid-break">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="rf-rec-title">{rec.titulo}</div>
                    <div className="rf-rec-desc">{rec.descripcion}</div>
                    {rec.base && <div className="rf-rec-base">📖 {rec.base}</div>}
                  </div>
                  {rec.ahorroAnualEstimado > 0 && (
                    <div style={{ textAlign: "right", minWidth: 100 }}>
                      <div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase" }}>Ahorro/año</div>
                      <div className="rf-rec-ahorro">{fm(rec.ahorroAnualEstimado)}</div>
                      {rec.aporteSugeridoMensual > 0 && (
                        <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>
                          aportando {fm(rec.aporteSugeridoMensual)}/mes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="rf-disclaimer">
          <strong>Aviso:</strong> Este reporte es una estimación generada por FINPATHIA con base en los datos
          ingresados por el usuario y las reglas del Estatuto Tributario colombiano vigente. No sustituye la
          asesoría de un contador público ni la declaración oficial ante la DIAN. Los montos son aproximados
          y pueden diferir de los valores finales tras aplicar ajustes contables, provisiones y criterios
          profesionales. Usar como herramienta de planeación, no como documento oficial.
        </div>

        {/* Footer */}
        <div className="rf-footer">
          Generado por FINPATHIA · finpathia.com · {fechaHoy}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: fila de diff
// ─────────────────────────────────────────────────────────────────────────
function renderDiffRow(label, declarado, actual, fmt = fm) {
  if (declarado == null) return null;
  const a = Number(actual) || 0;
  const d = Number(declarado) || 0;
  const diff = a - d;
  const pctLabel = d !== 0 ? (((a - d) / Math.abs(d)) * 100).toFixed(1) + "%" : "—";
  const cls = diff > 0 ? "pos" : diff < 0 ? "neg" : "";
  return (
    <tr key={label}>
      <td>{label}</td>
      <td className="right">{fmt(d)}</td>
      <td className="right"><strong>{fmt(a)}</strong></td>
      <td className={"right " + cls}>{diff >= 0 ? "+" : ""}{fmt(diff)}</td>
      <td className={"right " + cls}>{pctLabel}</td>
    </tr>
  );
}
