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

import { useState, useEffect } from "react";
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
  // Fase 4 flujo anual (18-jul-2026): rango de vigencia solo para mensuales
  desdeMes = 1,
  hastaMes = 12,
  // UX iter 3 (18-jul-2026 noche): props que ocultan bloques redundantes.
  // Cuando el user ya eligió un template simple, los chips de frecuencia son
  // redundantes. Estos props permiten que el padre controle qué mostrar.
  mostrarChipsFrecuencia = true,  // los 5 chips Mensual/Trimestral/etc
  mostrarSelectorMes = true,      // dropdown "Mes de pago" (solo si freq!=mensual)
  mostrarVigencia = true,         // toggle "Todo el año / Solo unos meses"
  // UX FIX 2 (19-jul-2026): modo de vigencia PERSISTIDO en el item.
  // Sin esto, guardar con rango transitorio 1-12 y reabrir mostraba
  // "Todo el año" y el user debía reactivar "Solo unos meses" cada vez.
  vigenciaModo = undefined,       // "limitada" | "todo" | undefined (inferir del rango)
}) {
  const freq = FRECUENCIAS.find(f => f.v === frecuencia) || FRECUENCIAS[0];
  const showMes = frecuencia !== "mensual";

  // Calcula el promedio mensualizado para mostrar en la explicación contextual
  const montoNum = Number(monto) || 0;
  // Para mensuales con rango, el promedio se ajusta por meses activos
  const mesesActivos = frecuencia === "mensual" ? Math.max(0, (hastaMes - desdeMes + 1)) : 12;
  const promedioMes = montoNum > 0
    ? (frecuencia === "mensual"
        ? Math.round((montoNum * mesesActivos) / 12)
        : Math.round((montoNum * freq.n) / 12))
    : 0;
  const mesNombre = MESES.find(m => m.v === Number(mesPago))?.l || "Enero";

  // ── VIGENCIA: modo vs rango (BUG FIX 18-jul-2026 noche, Santiago) ──
  // ANTES: vigenciaLimitada se DERIVABA del rango (desde!==1 || hasta!==12).
  // Bug real: user con salario ene-ago tocaba "Desde: Enero" primero → rango
  // pasaba por 1-12 → el sistema interpretaba "todo el año" → colapsaba los
  // selects y "lo sacaba". Imposible elegir enero como primer mes.
  // AHORA: el MODO es estado propio (lo que el user eligió en el toggle) y
  // no colapsa aunque el rango transite por 1-12.
  // Bug fix 2: el check era solo frecuencia==="mensual" → en "variable" los
  // selects jamás aparecían. Ahora ambos.
  const aplicaVigencia = frecuencia === "mensual" || frecuencia === "variable";
  const rangoLimitado = aplicaVigencia && (desdeMes !== 1 || hastaMes !== 12);
  // Modo inicial: el flag persistido manda; si no existe, inferir del rango.
  const [modoLimitado, setModoLimitado] = useState(
    vigenciaModo ? vigenciaModo === "limitada" : rangoLimitado
  );
  // Sincronizar si el flag persistido llega/cambia desde afuera
  useEffect(() => {
    if (vigenciaModo) setModoLimitado(vigenciaModo === "limitada");
  }, [vigenciaModo]);
  // Si el rango llega limitado desde afuera (editar item, cambiar template),
  // encender el modo. Nunca lo apagamos automáticamente.
  useEffect(() => {
    if (rangoLimitado) setModoLimitado(true);
  }, [rangoLimitado]);
  const vigenciaLimitada = modoLimitado; // la UI usa el MODO, no el rango

  const fm = (n) => "$" + Math.round(n).toLocaleString("es-CO");

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Bloque de chips de frecuencia — oculto en templates simples */}
      {mostrarChipsFrecuencia && (
        <>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
            📅 Frecuencia de pago
          </label>
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
        </>
      )}

      {/* Selector de mes (solo si no es mensual y el padre lo permite) */}
      {showMes && mostrarSelectorMes && (
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
          VIGENCIA — solo para frecuencia MENSUAL (Fase 4 flujo anual 18-jul-2026).
          Resuelve caso Santiago: "Rapicredit me paga cada mes desde julio hasta
          diciembre pero no sé cómo poner el valor porque no interpreta que por
          6 meses ese es el ingreso". Ahora sí: pone monto mensual + rango
          de vigencia + sistema respeta ambos.
          Default: enero-diciembre (todo el año) → comportamiento clásico.
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Vigencia — para mensual Y variable (18-jul-2026 noche) */}
      {(frecuencia === "mensual" || frecuencia === "variable") && mostrarVigencia && (
        <div style={{ marginBottom: 8, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 500, color: T.txt3 }}>
              📆 ¿Se recibe/paga todo el año?
            </label>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button"
                onClick={() => { setModoLimitado(false); onChange({ desdeMes: 1, hastaMes: 12, vigenciaModo: "todo" }); }}
                style={{ background: !vigenciaLimitada ? T.gn + "15" : "transparent", border: `1.5px solid ${!vigenciaLimitada ? T.gn : (T.txt3 + "80")}`, borderRadius: 6, padding: "4px 12px", color: !vigenciaLimitada ? T.gn : T.txt2, fontSize: 10, fontWeight: !vigenciaLimitada ? 700 : 600, cursor: "pointer" }}>
                Todo el año
              </button>
              <button type="button"
                onClick={() => { setModoLimitado(true); onChange({ vigenciaModo: "limitada" }); }}
                style={{ background: vigenciaLimitada ? T.gn + "15" : "transparent", border: `1.5px solid ${vigenciaLimitada ? T.gn : (T.txt3 + "80")}`, borderRadius: 6, padding: "4px 12px", color: vigenciaLimitada ? T.gn : T.txt2, fontSize: 10, fontWeight: vigenciaLimitada ? 700 : 600, cursor: "pointer" }}>
                Solo unos meses
              </button>
            </div>
          </div>
          {vigenciaLimitada && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: T.txt3, display: "block", marginBottom: 2 }}>Desde</label>
                <select
                  value={desdeMes}
                  onChange={(e) => {
                    const nuevo = Number(e.target.value);
                    // Auto-ajustar hastaMes si el rango queda invertido
                    const nuevoHasta = nuevo > hastaMes ? nuevo : hastaMes;
                    // vigenciaModo "limitada": tocar el mes ES elegir modo limitado
                    onChange({ desdeMes: nuevo, hastaMes: nuevoHasta, vigenciaModo: "limitada" });
                  }}
                  style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.txt, fontSize: 12, outline: "none" }}
                >
                  {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
              <span style={{ color: T.txt3, fontSize: 10, marginTop: 14 }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, color: T.txt3, display: "block", marginBottom: 2 }}>Hasta</label>
                <select
                  value={hastaMes}
                  onChange={(e) => onChange({ hastaMes: Number(e.target.value), vigenciaModo: "limitada" })}
                  style={{ width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.txt, fontSize: 12, outline: "none" }}
                >
                  {MESES.filter(m => m.v >= desdeMes).map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explicación contextual para mensual con vigencia LIMITADA */}
      {frecuencia === "mensual" && rangoLimitado && (
        <div style={{ fontSize: 11, color: T.txt3, background: T.bg3 + "80", padding: "10px 12px", borderRadius: 8, lineHeight: 1.6, border: `1px solid ${T.border}` }}>
          <div style={{ marginBottom: 4 }}>
            💡 <strong style={{ color: T.txt2 }}>{mesesActivos} {mesesActivos === 1 ? "mes" : "meses"} activos</strong>: {MESES.find(m => m.v === desdeMes)?.l} a {MESES.find(m => m.v === hastaMes)?.l}. El resto del año no pesa.
          </div>
          {montoNum > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
              <span>Por mes: <strong style={{ color: T.txt }}>{fm(montoNum)}</strong></span>
              <span>Total período: <strong style={{ color: T.gn }}>{fm(montoNum * mesesActivos)}</strong></span>
              <span>Promedio anual: <strong style={{ color: T.gn }}>{fm(promedioMes)}/mes</strong></span>
            </div>
          )}
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
