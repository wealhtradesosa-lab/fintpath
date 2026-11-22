// 22-nov-2026 (Santiago: "poder poner en cualquier gasto, ingreso o inversión
// los periodos que duran, o si no tiene caducidad… opcional, pero si lo pone
// ayuda mucho al sistema"). Un solo dato, opcional: ¿termina en una fecha?
// Lo leen las proyecciones (Mi futuro a 10 años) para no volver a preguntarlo.
import { tx } from "../lib/region.js";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Normaliza lo que se guarda: { finAnio, finMes } o ambos undefined. */
export function finParaGuardar(form = {}) {
  const a = parseInt(form.finAnio, 10);
  if (!(a > 0)) return { finAnio: undefined, finMes: undefined };
  return { finAnio: a, finMes: Math.max(1, Math.min(12, parseInt(form.finMes, 10) || 12)) };
}

export default function FechaFin({ finAnio, finMes, onChange, tokens: T, que = "ingreso" }) {
  const hoy = new Date().getFullYear();
  const tiene = parseInt(finAnio, 10) > 0;
  const chip = (on) => ({ flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, border: "1px solid " + (on ? T.green : T.border), background: on ? "rgba(0,200,5,0.1)" : "transparent", color: on ? T.green : T.txt2 });
  const sel = { width: "100%", background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 13, outline: "none" };
  const lbl = { fontSize: 11, fontWeight: 600, color: T.txt3, letterSpacing: "0.06em", display: "block", marginBottom: 4 };
  return (
    <div style={{ gridColumn: "1/-1", background: T.bg3, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.txt2, marginBottom: 10 }}>{que === "gasto" ? tx("¿Este gasto tiene fecha de fin? (opcional)", "Does this expense have an end date? (optional)") : tx("¿Este ingreso tiene fecha de fin? (opcional)", "Does this income have an end date? (optional)")}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: tiene ? 10 : 0 }}>
        <button type="button" style={chip(!tiene)} onClick={() => onChange({ finAnio: "", finMes: "" })}>{tx("No, sigue indefinidamente", "No, it's ongoing")}</button>
        <button type="button" style={chip(tiene)} onClick={() => { if (!tiene) onChange({ finAnio: String(hoy + 1), finMes: "12" }); }}>{tx("Sí, termina", "Yes, it ends")}</button>
      </div>
      {tiene && (<>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><label style={lbl}>{tx("Último mes", "Last month")}</label>
            <select style={sel} value={String(finMes || "12")} onChange={(e) => onChange({ finMes: e.target.value })}>{MESES.map((m, k) => <option key={k} value={String(k + 1)}>{tx(m, MONTHS[k])}</option>)}</select></div>
          <div style={{ flex: 1 }}><label style={lbl}>{tx("Año", "Year")}</label>
            <select style={sel} value={String(finAnio)} onChange={(e) => onChange({ finAnio: e.target.value })}>{Array.from({ length: 16 }, (_, k) => String(hoy + k)).map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        </div>
        <div style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>{tx("Tus proyecciones (Mi futuro a 10 años) lo van a tener en cuenta solas: desde esa fecha deja de contar.", "Your projections (My 10-year future) will account for it automatically: it stops counting from that date.")}</div>
      </>)}
    </div>
  );
}
