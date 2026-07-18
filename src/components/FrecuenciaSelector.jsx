// ═══════════════════════════════════════════════════════════════════════════
// FrecuenciaSelector — UI reutilizable para elegir frecuencia + mes de pago
//
// Se usa en formularios de Ingresos, Gastos y Deudas para que el usuario
// pueda definir cuándo se paga cada item. Muestra:
//   • Selector visual con 5 chips (Mensual / Trimestral / Semestral / Anual / Único)
//   • Selector de mes (solo si frecuencia !== mensual)
//   • Explicación contextual de cómo se va a distribuir el gasto/ingreso
//
// USO:
//   <FrecuenciaSelector
//     frecuencia={form.frecuencia}
//     mesPago={form.mesPago}
//     onChange={(patch) => setForm(p => ({ ...p, ...patch }))}
//     monto={form.mensual}  // opcional, para mostrar el impacto mensual
//     tokens={T}
//   />
// ═══════════════════════════════════════════════════════════════════════════

import { FRECUENCIAS, MESES } from "../lib/flowHelpers.js";

// ═══════════════════════════════════════════════════════════════════════════
// Helper: label dinámico para el input MONTO según la frecuencia elegida.
// Responde a la pregunta de Santiago (18-jul-2026): "no sé si poner el
// valor por pago o el anual". Ahora el label DICE exactamente qué esperar.
// ═══════════════════════════════════════════════════════════════════════════
export function labelMontoSegunFrecuencia(frecuencia) {
  switch (frecuencia) {
    case "trimestral": return "Monto por trimestre";
    case "semestral":  return "Monto por semestre";
    case "anual":      return "Monto anual (1 pago)";
    case "unico":      return "Monto del pago único";
    default:           return "Monto mensual";
  }
}

export default function FrecuenciaSelector({
  frecuencia = "mensual",
  mesPago = 1,
  onChange,
  monto,
  tokens: T,
}) {
  const freq = FRECUENCIAS.find(f => f.v === frecuencia) || FRECUENCIAS[0];
  const showMes = frecuencia !== "mensual";

  // Calcula el promedio mensualizado para mostrar en la explicación contextual
  const montoNum = Number(monto) || 0;
  const promedioMes = montoNum > 0 ? Math.round((montoNum * freq.n) / 12) : 0;
  const mesNombre = MESES.find(m => m.v === Number(mesPago))?.l || "Enero";

  const fm = (n) => "$" + Math.round(n).toLocaleString("es-CO");

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
        📅 Frecuencia de pago
      </label>

      {/* Chips de frecuencia */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 6, marginBottom: showMes ? 10 : 6 }}>
        {FRECUENCIAS.map(f => {
          const active = f.v === frecuencia;
          return (
            <button
              key={f.v}
              type="button"
              onClick={() => onChange({ frecuencia: f.v })}
              style={{
                background: active ? T.gn + "15" : T.bg3,
                border: `1px solid ${active ? T.gn : T.border}`,
                borderRadius: 8,
                padding: "8px 6px",
                color: active ? T.gn : T.txt2,
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              <div style={{ fontSize: 15, marginBottom: 2 }}>{f.emoji}</div>
              {f.l}
            </button>
          );
        })}
      </div>

      {/* Selector de mes (solo si no es mensual) */}
      {showMes && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: T.txt3, display: "block", marginBottom: 4 }}>
            {frecuencia === "trimestral" ? "Primer mes de pago" : frecuencia === "semestral" ? "Primer mes de pago" : "Mes en que se paga"}
          </label>
          <select
            value={mesPago}
            onChange={(e) => onChange({ mesPago: Number(e.target.value) })}
            style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, outline: "none" }}
          >
            {MESES.map(m => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          Explicación con AMBOS números visibles (respondiendo pregunta
          Santiago 18-jul-2026): "¿pongo el valor por pago o el anual?".
          Ahora mostramos: monto por pago Y total anual Y promedio mensual.
          Cero ambigüedad — el user ve la conversión completa siempre.
          ═══════════════════════════════════════════════════════════════════ */}
      {frecuencia !== "mensual" && (
        <div style={{ fontSize: 11, color: T.txt3, background: T.bg3 + "80", padding: "10px 12px", borderRadius: 8, lineHeight: 1.6, border: `1px solid ${T.border}` }}>
          {frecuencia === "trimestral" && (
            <>
              <div style={{ marginBottom: 4 }}>💡 <strong style={{ color: T.txt2 }}>4 pagos al año</strong> en {MESES.find(m=>m.v===Number(mesPago))?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+3)%12)+1)?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+6)%12)+1)?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+9)%12)+1)?.l}</div>
              {montoNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
                  <span>Por trimestre: <strong style={{ color: T.txt }}>{fm(montoNum)}</strong></span>
                  <span>Total año: <strong style={{ color: T.gn }}>{fm(montoNum * 4)}</strong></span>
                  <span>Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></span>
                </div>
              )}
            </>
          )}
          {frecuencia === "semestral" && (
            <>
              <div style={{ marginBottom: 4 }}>💡 <strong style={{ color: T.txt2 }}>2 pagos al año</strong>: {mesNombre} y {MESES.find(m=>m.v===((Number(mesPago)-1+6)%12)+1)?.l}</div>
              {montoNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
                  <span>Por semestre: <strong style={{ color: T.txt }}>{fm(montoNum)}</strong></span>
                  <span>Total año: <strong style={{ color: T.gn }}>{fm(montoNum * 2)}</strong></span>
                  <span>Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></span>
                </div>
              )}
            </>
          )}
          {frecuencia === "anual" && (
            <>
              <div style={{ marginBottom: 4 }}>💡 <strong style={{ color: T.txt2 }}>1 pago al año</strong> en {mesNombre}. El resto del año no pesa.</div>
              {montoNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
                  <span>Pago anual: <strong style={{ color: T.txt }}>{fm(montoNum)}</strong></span>
                  <span>Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></span>
                </div>
              )}
            </>
          )}
          {frecuencia === "unico" && (
            <>
              <div style={{ marginBottom: 4 }}>💡 <strong style={{ color: T.txt2 }}>Pago único</strong> en {mesNombre}. No se repite el próximo año.</div>
              {montoNum > 0 && (
                <div style={{ fontSize: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
                  Monto del pago: <strong style={{ color: T.txt }}>{fm(montoNum)}</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
