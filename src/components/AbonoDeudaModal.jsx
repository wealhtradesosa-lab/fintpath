import { useState } from "react";
import NumberInput from "./NumberInput";
import { MESES, getMesActual } from "../lib/flowHelpers.js";
import { tx, nombreMes } from "../lib/region.js";
import { simularAbono, registrarAbono, eliminarAbono, tablaYaTraeAbono } from "../lib/abonosDeuda.js";

// ═══════════════════════════════════════════════════════════════════════════
// 14-nov-2026 — "Registrar abono" en una deuda (Santiago: "pagué 45 mm de
// Deepal, pues que se cargue como abono a ese crédito y baje lo que falta").
// Un formulario corto: valor, mes y qué hizo el banco (bajar plazo o cuota).
// Antes de guardar muestra el efecto: saldo, plazo o cuota, intereses que
// se ahorra. Lo que guarda vive en d.abonos (lib/abonosDeuda.js) y el flujo
// del mes lo suma solo (lib/flujoMes.js).
// ═══════════════════════════════════════════════════════════════════════════

const plazoTxt = (m) => {
  if (m == null) return "—";
  if (m <= 0) return tx("saldada", "paid off");
  const a = Math.floor(m / 12), r = m % 12;
  if (a === 0) return tx(`${r} ${r === 1 ? "mes" : "meses"}`, `${r} mo`);
  return tx(`${a} ${a === 1 ? "año" : "años"}${r ? ` y ${r} ${r === 1 ? "mes" : "meses"}` : ""}`, `${a}y ${r}m`);
};

export default function AbonoDeudaModal({ deuda, fm, T, onGuardar, onCerrar }) {
  const { año, mes: mesHoy } = getMesActual();
  const [monto, setMonto] = useState("");
  const [mes, setMes] = useState(mesHoy);
  const [efecto, setEfecto] = useState("plazo");
  const [yaDescontado, setYaDescontado] = useState(false);
  // 14-nov-2026 (Santiago: "cada mes pago 3 MM y este mes pagué 25 MM, incluida la
  // cuota o no"). Se pregunta; el abono a capital es lo que pasa de la cuota.
  const cuota = Number(deuda.pg || deuda.pago || 0) || 0;
  const [incluyeCuota, setIncluyeCuota] = useState(true);
  const pagado = Number(monto) || 0;
  const m = Math.max(0, cuota > 0 && incluyeCuota ? pagado - cuota : pagado); // abono a capital
  const faltaCuota = cuota > 0 && incluyeCuota && pagado > 0 && pagado <= cuota;
  const traeAbono = tablaYaTraeAbono(deuda, mes, m);
  const [ajustarTabla, setAjustarTabla] = useState(true);
  const sim = m > 0 ? simularAbono(deuda, m, efecto, { saldoYaDescontado: yaDescontado }) : null;
  const excede = sim && m > sim.saldoAntes;
  const saldo = Number(deuda.mt) || 0;
  const pagarTodo = () => setMonto(String(Math.round(saldo + (cuota > 0 && incluyeCuota ? cuota : 0))));
  const mesL = (x) => (MESES[x - 1]?.l || "").toLowerCase();
  const abonos = (deuda.abonos || []).filter((a) => Number(a.año) === año);

  const lbl = { fontSize: 12, color: T.txt3, marginBottom: 4, display: "block" };
  const chip = (on) => ({
    padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: on ? 700 : 500,
    background: on ? "rgba(0,200,5,0.12)" : T.bg3, color: on ? T.green : T.txt2,
    border: `1px solid ${on ? T.green : T.border}`,
  });
  const fila = (a, b, fuerte) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: T.txt2 }}>{a}</span>
      <span style={{ color: fuerte ? T.txt : T.txt2, fontWeight: fuerte ? 700 : 500, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{b}</span>
    </div>
  );

  const guardar = () => {
    if (!sim || excede || faltaCuota) return;
    const out = registrarAbono(deuda, { año, mes, monto: m, efecto, saldoYaDescontado: yaDescontado, ajustarTabla: traeAbono && ajustarTabla });
    const ab = out.abonos[out.abonos.length - 1];
    out.abonos = [...out.abonos.slice(0, -1), { ...ab, pagadoTotal: pagado, incluyeCuota: cuota > 0 && incluyeCuota }];
    onGuardar(out);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={tx("Registrar abono", "Record extra payment")}
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", width: "min(460px, 100%)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: T.txt3 }}>{tx("Registrar abono", "Record extra payment")}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.txt, marginTop: 2 }}>{deuda.n || tx("Deuda", "Debt")}</div>
        <div style={{ fontSize: 12, color: T.txt3, marginTop: 2, marginBottom: 16 }}>
          {tx("Saldo cargado", "Balance on file")} {fm(deuda.mt || 0)} · {tx("cuota", "payment")} {fm(Number(deuda.pg || deuda.pago || 0))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
          <div>
            <label style={lbl}>{tx("¿Cuánto pagaste?", "How much did you pay?")}</label>
            <NumberInput value={monto} onChange={setMonto} placeholder="0"
              style={{ width: "100%", boxSizing: "border-box", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", color: T.txt, fontSize: 14 }} />
          </div>
          <div>
            <label style={lbl}>{tx("Mes", "Month")}</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", color: T.txt, fontSize: 14 }}>
              {MESES.map((x) => <option key={x.v} value={x.v}>{tx(x.l, nombreMes(x.v))} {año}</option>)}
            </select>
          </div>
        </div>
        <button type="button" onClick={pagarTodo} style={{ background: "none", border: "none", padding: 0, color: "#3b82f6", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", marginBottom: 14 }}>
          {tx(`Pagar todo el saldo (${fm(saldo)})`, "Pay off the whole balance")}
        </button>

        {cuota > 0 && (
          <>
            <label style={lbl}>{tx(`¿Incluye la cuota de ${mesL(mes)} (${fm(cuota)})?`, "Does it include this month's payment?")}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button type="button" style={chip(incluyeCuota)} onClick={() => setIncluyeCuota(true)}>{tx("Sí, la incluye", "Yes")}</button>
              <button type="button" style={chip(!incluyeCuota)} onClick={() => setIncluyeCuota(false)}>{tx("No, la pagué aparte", "No, paid separately")}</button>
            </div>
          </>
        )}
        {faltaCuota && <div style={{ fontSize: 12, color: T.orange, marginTop: -6, marginBottom: 12 }}>{tx(`Si incluye la cuota, el pago tiene que ser mayor que ${fm(cuota)}.`, "Must exceed the regular payment.")}</div>}

        {!sim?.liquida && <label style={lbl}>{tx("¿Qué hizo el banco con el abono?", "What did the lender do with it?")}</label>}
        {!sim?.liquida && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" style={chip(efecto === "plazo")} onClick={() => setEfecto("plazo")}>{tx("Bajó el plazo", "Shorter term")}</button>
          <button type="button" style={chip(efecto === "cuota")} onClick={() => setEfecto("cuota")}>{tx("Bajó la cuota", "Lower payment")}</button>
        </div>}

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: T.txt2, marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={yaDescontado} onChange={(e) => setYaDescontado(e.target.checked)} style={{ marginTop: 2 }} />
          <span>{tx("El saldo cargado ya descuenta este abono (lo actualicé con el extracto)", "The balance on file already reflects this payment")}</span>
        </label>
        {traeAbono && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: T.txt2, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={ajustarTabla} onChange={(e) => setAjustarTabla(e.target.checked)} style={{ marginTop: 2 }} />
            <span>{tx(`La tabla mensual de esta deuda ya tenía el abono en ${MESES[mes - 1]?.l.toLowerCase()}. Dejar ese mes con la cuota normal para no contarlo dos veces`, "The monthly table already had this payment. Reset that month to the regular payment")}</span>
          </label>
        )}

        {sim && (
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", margin: "10px 0 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 4 }}>{tx("Efecto", "Effect")}</div>
            {excede
              ? <div style={{ fontSize: 13, color: T.red }}>{tx("El abono es mayor que el saldo. Revisa el valor o el saldo cargado.", "The payment exceeds the balance.")}</div>
              : <>
                {fila(tx(`Sale en ${mesL(mes)}`, "Leaves that month"), cuota > 0 ? `${fm(cuota + m)}` : fm(m), true)}
                {cuota > 0 && <div style={{ fontSize: 11, color: T.txt3, marginTop: -2, marginBottom: 4, textAlign: "right" }}>{tx(`cuota ${fm(cuota)} + abono a capital ${fm(m)}`, "")}</div>}
                {fila(tx("Saldo", "Balance"), `${fm(sim.saldoAntes)} → ${fm(sim.saldoDespues)}`, true)}
                {sim.liquida
                  ? fila(tx("Estado", "Status"), mes < 12 ? tx(`queda saldada: desde ${mesL(mes + 1)} no se cobra la cuota`, "paid off") : tx("queda saldada", "paid off"), true)
                  : efecto === "plazo"
                    ? fila(tx("Termina en", "Ends in"), `${plazoTxt(sim.mesesAntes)} → ${plazoTxt(sim.mesesDespues)}`)
                    : fila(tx("Cuota", "Payment"), `${fm(sim.cuotaAntes)} → ${fm(sim.cuotaDespues)}`)}
                {sim.ahorroInteres > 0 && fila(tx("Intereses que te ahorras", "Interest saved"), fm(sim.ahorroInteres))}
                <div style={{ fontSize: 11, color: T.txt3, marginTop: 6, lineHeight: 1.5 }}>
                  {tx("El abono a capital es ahorro: baja tu deuda, no es un gasto.", "It's saving, not spending.")}
                </div>
              </>}
          </div>
        )}

        {abonos.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 4 }}>{tx(`Abonos de ${año}`, `${año} extra payments`)}</div>
            {abonos.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span style={{ color: T.txt2 }}>{MESES[a.mes - 1]?.l} · {a.pagadoTotal ? tx(`pagaste ${fm(a.pagadoTotal)}${a.incluyeCuota ? " (con la cuota)" : ""} · abono ${fm(a.monto)}`, fm(a.monto)) : fm(a.monto)}{a.saldoDespues === 0 ? tx(" · saldada", " · paid off") : a.efecto === "cuota" ? tx(" · bajó la cuota", " · lower payment") : tx(" · bajó el plazo", " · shorter term")}</span>
                <button type="button" onClick={() => { if (confirm(tx("¿Quitar este abono? El saldo vuelve a como estaba.", "Remove this payment?"))) onGuardar(eliminarAbono(deuda, a.id), true); }}
                  style={{ background: "none", border: "none", color: T.txt3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tx("Quitar", "Remove")}</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCerrar} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{tx("Cancelar", "Cancel")}</button>
          <button type="button" onClick={guardar} disabled={!sim || excede || faltaCuota}
            style={{ background: T.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: !sim || excede ? "not-allowed" : "pointer", opacity: !sim || excede ? 0.5 : 1 }}>{tx("Guardar abono", "Save")}</button>
        </div>
      </div>
    </div>
  );
}
