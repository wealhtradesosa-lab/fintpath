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

      {/* Explicación contextual */}
      <div style={{ fontSize: 11, color: T.txt3, background: T.bg3 + "50", padding: "8px 10px", borderRadius: 6, lineHeight: 1.5 }}>
        {frecuencia === "mensual" && (
          <>💡 Se paga <strong style={{ color: T.txt2 }}>los 12 meses del año</strong>.</>
        )}
        {frecuencia === "trimestral" && (
          <>💡 4 pagos al año en {MESES.find(m=>m.v===Number(mesPago))?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+3)%12)+1)?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+6)%12)+1)?.l}, {MESES.find(m=>m.v===((Number(mesPago)-1+9)%12)+1)?.l}.
            {montoNum > 0 && <> Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></>}</>
        )}
        {frecuencia === "semestral" && (
          <>💡 2 pagos al año: {mesNombre} y {MESES.find(m=>m.v===((Number(mesPago)-1+6)%12)+1)?.l}.
            {montoNum > 0 && <> Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></>}</>
        )}
        {frecuencia === "anual" && (
          <>💡 Un pago en <strong style={{ color: T.txt2 }}>{mesNombre}</strong>. El resto del año no pesa.
            {montoNum > 0 && <> Promedio: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></>}</>
        )}
        {frecuencia === "unico" && (
          <>💡 Pago único en <strong style={{ color: T.txt2 }}>{mesNombre}</strong>. No se repite.</>
        )}
      </div>
    </div>
  );
}
