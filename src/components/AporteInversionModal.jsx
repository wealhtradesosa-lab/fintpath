import { useState } from "react";
import NumberInput from "./NumberInput";
import { MESES, getMesActual } from "../lib/flowHelpers.js";
import { tx, nombreMes } from "../lib/region.js";
import { registrarAporte, eliminarAporte } from "../lib/aportesInversion.js";

// ═══════════════════════════════════════════════════════════════════════════
// 14-nov-2026 — "Registrar aporte" en una inversión (Santiago: "este mes
// invertí 5 mm en IBKR, pues que eso lo sepa"). Valor y mes; el valor de la
// inversión sube y el aporte sale en el flujo de caja de ese mes como
// inversión, no como gasto (lib/aportesInversion.js).
// ═══════════════════════════════════════════════════════════════════════════
export default function AporteInversionModal({ inv, fm, T, onGuardar, onCerrar }) {
  const { año, mes: mesHoy } = getMesActual();
  const [monto, setMonto] = useState("");
  const [mes, setMes] = useState(mesHoy);
  const [yaIncluido, setYaIncluido] = useState(false);
  const usd = inv.moneda === "USD";
  const fmMon = (v) => (usd ? "US$" + Math.round(Number(v) || 0).toLocaleString("es-CO") : fm(v));
  const m = Number(monto) || 0;
  const valor = Number(inv.va ?? inv.valor_actual ?? inv.valor ?? 0) || 0;
  const aportes = (inv.aportes || []).filter((a) => Number(a.año) === año);
  const lbl = { fontSize: 12, color: T.txt3, marginBottom: 4, display: "block" };
  const inp = { width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", color: T.txt, fontSize: 14 };

  return (
    <div role="dialog" aria-modal="true" aria-label={tx("Registrar aporte", "Record contribution")} onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", width: "min(440px, 100%)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: T.txt3 }}>{tx("Registrar aporte", "Record contribution")}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.txt, marginTop: 2 }}>{inv.n || inv.nombre || tx("Inversión", "Investment")}</div>
        <div style={{ fontSize: 12, color: T.txt3, marginTop: 2, marginBottom: 16 }}>{tx("Valor cargado", "Value on file")} {fmMon(valor)}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>{tx("Valor del aporte", "Amount")}{usd ? " (US$)" : ""}</label>
            <NumberInput value={monto} onChange={setMonto} placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>{tx("Mes", "Month")}</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={inp}>
              {MESES.map((x) => <option key={x.v} value={x.v}>{tx(x.l, nombreMes(x.v))} {año}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: T.txt2, marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={yaIncluido} onChange={(e) => setYaIncluido(e.target.checked)} style={{ marginTop: 2 }} />
          <span>{tx("El valor cargado ya incluye este aporte (lo actualicé hace poco)", "The value on file already includes it")}</span>
        </label>

        {m > 0 && (
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", margin: "10px 0 14px", fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 4 }}>{tx("Efecto", "Effect")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: T.txt2 }}>{tx("Valor de la inversión", "Investment value")}</span>
              <strong style={{ color: T.txt, fontVariantNumeric: "tabular-nums" }}>{yaIncluido ? fmMon(valor) : `${fmMon(valor)} → ${fmMon(valor + m)}`}</strong>
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 6, lineHeight: 1.5 }}>
              {tx(`Sale en tu flujo de caja de ${MESES[mes - 1]?.l.toLowerCase()} como inversión, no como gasto: la plata sigue siendo tuya, solo cambia de lugar.`, "It counts in that month's cash flow as an investment, not as spending.")}
            </div>
          </div>
        )}

        {aportes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 4 }}>{tx(`Aportes de ${año}`, `${año} contributions`)}</div>
            {aportes.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span style={{ color: T.txt2 }}>{MESES[a.mes - 1]?.l} · {fmMon(a.monto)}</span>
                <button type="button" onClick={() => { if (confirm(tx("¿Quitar este aporte?", "Remove this contribution?"))) onGuardar(eliminarAporte(inv, a.id), true); }}
                  style={{ background: "none", border: "none", color: T.txt3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tx("Quitar", "Remove")}</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCerrar} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{tx("Cancelar", "Cancel")}</button>
          <button type="button" disabled={m <= 0} onClick={() => onGuardar(registrarAporte(inv, { año, mes, monto: m, yaIncluido }))}
            style={{ background: T.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: m > 0 ? "pointer" : "not-allowed", opacity: m > 0 ? 1 : 0.5 }}>{tx("Guardar aporte", "Save")}</button>
        </div>
      </div>
    </div>
  );
}
