import { useState } from "react";
import NumberInput from "./NumberInput";
import { MESES, getMesActual } from "../lib/flowHelpers.js";
import { tx, nombreMes } from "../lib/region.js";
import { calendarioExtra, extraEnPesos, gastoMensualReferencia, esMenorQueUmbral, registrarExtra, crearConExtra, eliminarExtra } from "../lib/gastosExtra.js";
import { TRM_PROVISIONAL, trmUsable } from "../lib/trm.js";

// ═══════════════════════════════════════════════════════════════════════════
// 14-nov-2026 — Gasto extraordinario (Santiago: "gasté 4.500 USD en vacaciones
// pagado con TC […] que pueda marcar ese extra asociado a vacaciones"). Se
// registra sobre un gasto que ya existe o se crea el concepto. La forma de pago
// decide cuándo sale la plata (lib/gastosExtra.js). El texto y el umbral
// cuidan el norte: esto es para lo que se sale del mes normal, no para cada
// compra.
// ═══════════════════════════════════════════════════════════════════════════

const CATS_NUEVO = ["Viajes", "Entretenimiento", "Educación", "Salud", "Vivienda", "Mantenimiento", "Transporte", "Tecnología", "Vestimenta", "Personal", "Otro"];

export default function ExtraGastoModal({ gastos, inicial, fm, T, trm, onGuardar, onCerrar }) {
  const { año, mes: mesHoy } = getMesActual();
  const conceptos = [];
  Object.entries(gastos || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => conceptos.push({ cat, idx, g, key: `${cat}::${idx}` })));
  conceptos.sort((a, b) => (a.g.c || a.cat).localeCompare(b.g.c || b.cat, "es"));
  const [sel, setSel] = useState(inicial ? `${inicial.cat}::${inicial.idx}` : "");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCat, setNuevaCat] = useState("Viajes");
  const [nota, setNota] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("COP");
  const [mes, setMes] = useState(mesHoy);
  const [pago, setPago] = useState("contado");
  const [cuotas, setCuotas] = useState("12");
  const [tasa, setTasa] = useState("");
  const nuevo = sel === "__nuevo";
  const actual = conceptos.find((c) => c.key === sel);

  const m = Number(monto) || 0;
  const fx = moneda === "USD" ? (trmUsable(trm) ?? TRM_PROVISIONAL) : 1;
  const datos = { año, mes, monto: m, moneda, nota, pago, cuotas, tasa };
  const enPesos = extraEnPesos(datos, null, trm);
  const cal = m > 0 ? calendarioExtra({ ...datos, cuotas: Number(cuotas), tasa: Number(tasa) }) : [];
  const enAño = cal.filter((p) => p.año === año);
  const fueraAño = cal.length - enAño.length;
  const pequeño = m > 0 && esMenorQueUmbral(enPesos, gastoMensualReferencia(gastos, trm));
  const listo = m > 0 && (nuevo ? true : !!actual);
  const extrasAct = actual ? (actual.g.extras || []).filter((x) => Number(x.año) === año) : [];

  const lbl = { fontSize: 12, color: T.txt3, marginBottom: 4, display: "block" };
  const inp = { width: "100%", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 10px", color: T.txt, fontSize: 14 };
  const chip = (on) => ({ padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontWeight: on ? 700 : 500,
    background: on ? "rgba(0,200,5,0.12)" : T.bg3, color: on ? T.green : T.txt2, border: `1px solid ${on ? T.green : T.border}` });
  const mesL = (x) => (MESES[x - 1]?.l || "").toLowerCase();

  const guardar = () => {
    if (!listo) return;
    const out = nuevo
      ? crearConExtra(gastos, { nombre: nuevoNombre, cat: nuevaCat }, datos)
      : registrarExtra(gastos, actual.cat, actual.idx, datos);
    onGuardar(out);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={tx("Gasto extraordinario", "One-off expense")} onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", width: "min(480px, 100%)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>{tx("Gasto extraordinario", "One-off expense")}</div>
        <div style={{ fontSize: 12, color: T.txt3, marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>
          {tx("Registra lo que se sale de tu mes normal: un viaje, una compra grande, una reparación. Tu día a día ya está en tus gastos recurrentes.", "Record what falls outside a normal month: a trip, a big purchase, a repair.")}
        </div>

        <label style={lbl}>{tx("¿A qué gasto pertenece?", "Which expense is it?")}</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
          <option value="">{tx("Elige un gasto…", "Choose…")}</option>
          {conceptos.map((c) => <option key={c.key} value={c.key}>{(c.g.c || c.cat)} · {c.cat}</option>)}
          <option value="__nuevo">{tx("+ Crear un concepto nuevo", "+ New concept")}</option>
        </select>
        {nuevo && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={lbl}>{tx("Nombre", "Name")}</label><input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder={tx("Vacaciones", "Vacation")} style={inp} /></div>
            <div><label style={lbl}>{tx("Categoría", "Category")}</label>
              <select value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} style={inp}>{CATS_NUEVO.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><label style={lbl}>{tx("Valor", "Amount")}</label><NumberInput value={monto} onChange={setMonto} placeholder="0" style={inp} /></div>
          <div><label style={lbl}>{tx("Moneda", "Currency")}</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={inp}><option value="COP">COP</option><option value="USD">USD</option></select></div>
          <div><label style={lbl}>{tx("Mes", "Month")}</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} style={inp}>{MESES.map((x) => <option key={x.v} value={x.v}>{tx(x.l, nombreMes(x.v))}</option>)}</select></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={lbl}>{tx("Nota (opcional)", "Note (optional)")}</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={tx("Tiquetes y hotel", "Flights and hotel")} style={inp} /></div>

        <label style={lbl}>{tx("¿Cómo lo pagaste?", "How did you pay?")}</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" style={chip(pago === "contado")} onClick={() => setPago("contado")}>{tx("De contado", "Cash / debit")}</button>
          <button type="button" style={chip(pago === "tarjeta1")} onClick={() => setPago("tarjeta1")}>{tx("Tarjeta, un pago", "Card, one payment")}</button>
          <button type="button" style={chip(pago === "cuotas")} onClick={() => setPago("cuotas")}>{tx("Tarjeta a cuotas", "Card, installments")}</button>
        </div>
        {pago === "cuotas" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div><label style={lbl}>{tx("Número de cuotas", "Installments")}</label><NumberInput value={cuotas} onChange={setCuotas} placeholder="12" style={inp} /></div>
            <div><label style={lbl}>{tx("Tasa de la tarjeta (E.A. %)", "Card rate (APR %)")}</label><NumberInput value={tasa} onChange={setTasa} placeholder={tx("Mira tu extracto", "See statement")} style={inp} /></div>
          </div>
        )}

        {pequeño && (
          <div style={{ fontSize: 12, color: T.orange, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 }}>
            {tx("Este valor ya cabe en tus gastos del mes; no hace falta registrarlo. Si es algo que se repite, súmalo a tu estimado mensual.", "This already fits in your monthly expenses.")}
          </div>
        )}

        {m > 0 && (
          <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", margin: "6px 0 14px", fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 2 }}>{tx("Efecto", "Effect")}</div>
            <div style={{ color: T.txt2 }}>{tx(`Gasto de ${mesL(mes)}:`, "Expense:")} <strong style={{ color: T.txt }}>{fm(enPesos)}</strong>{moneda === "USD" ? <span style={{ color: T.txt3 }}> · {tx("TRM", "FX")} {Math.round(fx).toLocaleString("es-CO")}</span> : null}</div>
            <div style={{ color: T.txt2 }}>
              {pago === "contado" && tx(`Sale de tu cuenta en ${mesL(mes)}.`, "Paid this month.")}
              {pago === "tarjeta1" && (mes < 12 ? tx(`Sale de tu cuenta en ${mesL(mes + 1)}, al pagar la tarjeta.`, "Paid next month.") : tx("Sale de tu cuenta en enero, al pagar la tarjeta (no pesa en el flujo de este año).", "Paid in January."))}
              {pago === "cuotas" && cal.length > 0 && <>
                {tx(`${cal.length} cuotas de ${fm(cal[0].monto * fx)} desde ${mesL(cal[0].mes)}`, `${cal.length} payments of ${fm(cal[0].monto * fx)}`)}
                {fueraAño > 0 ? tx(` (${enAño.length} este año, ${fueraAño} el siguiente).`, ".") : "."}
                {Number(tasa) > 0 && <div>{tx("Intereses de diferirlo:", "Interest:")} <strong style={{ color: T.red }}>{fm(cal.reduce((t, p) => t + p.monto, 0) * fx - enPesos)}</strong></div>}
                {!(Number(tasa) > 0) && <div style={{ color: T.orange }}>{tx("Sin la tasa de la tarjeta, las cuotas quedan sin intereses.", "Without the rate, no interest is counted.")}</div>}
              </>}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>{tx("Suma al total del año de este gasto. No cuenta como gasto recurrente.", "Adds to this expense's yearly total; not treated as recurring.")}</div>
          </div>
        )}

        {extrasAct.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: T.txt3, marginBottom: 4 }}>{tx(`Extras de ${año} en este gasto`, `${año} one-offs`)}</div>
            {extrasAct.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                <span style={{ color: T.txt2 }}>{MESES[x.mes - 1]?.l} · {x.moneda === "USD" ? "US$" + Math.round(x.monto).toLocaleString("es-CO") : fm(x.monto)}{x.nota ? ` · ${x.nota}` : ""}</span>
                <button type="button" onClick={() => { if (confirm(tx("¿Quitar este extra?", "Remove?"))) onGuardar(eliminarExtra(gastos, actual.cat, actual.idx, x.id), true); }}
                  style={{ background: "none", border: "none", color: T.txt3, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tx("Quitar", "Remove")}</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCerrar} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>{tx("Cancelar", "Cancel")}</button>
          <button type="button" disabled={!listo} onClick={guardar}
            style={{ background: T.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: listo ? "pointer" : "not-allowed", opacity: listo ? 1 : 0.5 }}>{tx("Guardar", "Save")}</button>
        </div>
      </div>
    </div>
  );
}
