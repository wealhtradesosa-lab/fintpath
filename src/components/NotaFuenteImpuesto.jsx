import { useState } from "react";
import { C, F, R } from "../lib/designTokens";
import { mesesDePago } from "../lib/impuestoReferente";
import { tx, esUS, esEN, plata, nombreMes } from "../lib/region.js";

import { fmtPlataEs } from "../lib/formato.js";
/**
 * Explica de dónde sale el impuesto que usa cada simulador (29-oct-2026, Santiago:
 * "eso me tenía bien confundido en mis números… que sea claro y explicado").
 *   Año actual → se corre sobre la declaración del AÑO ANTERIOR (real).
 *   Año siguiente → el estimado de la Calculadora de declaración (la renta de este año).
 * Sin bloquear: quien no tenga el PDF escribe lo que pagó y queda guardado como su
 * declaración del año anterior (fuenteCaptura "manual").
 */
const inp = { height: 38, boxSizing: "border-box", background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "0 10px", fontSize: 14, width: "100%" };

function Plata({ value, onChange, placeholder = "$0" }) {
  const txt = value ? Math.round(Number(value)).toLocaleString("es-CO") : "";
  return <input inputMode="numeric" style={inp} placeholder={placeholder} value={txt ? "$" + txt : ""} onChange={(ev) => { const d = ev.target.value.replace(/[^0-9]/g, ""); onChange(d ? Number(d) : 0); }} />;
}

function LoQuePague({ owner, ano, onGuardar }) {
  const [v, setV] = useState({ saldo: 0, ret: 0, ing: 0 });
  const jur = owner.type === "juridica";
  const guardar = () => {
    const imp = (v.saldo || 0) + (v.ret || 0);
    const renglones = jur
      ? { ingresosBrutos: v.ing || 0, impuestoCalculado: imp, impuestoNeto: imp, autorretencion: v.ret || 0, saldoPagar: v.saldo || 0 }
      : { ingresosBrutos: v.ing || 0, impuestoCalculado: imp, retefuente: v.ret || 0, saldoPagar: v.saldo || 0 };
    onGuardar(owner.id, { tipo: jur ? "F110" : "F210", anoGravable: ano, capturadoEl: new Date().toISOString(), fuenteCaptura: "manual", renglones });
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 8, alignItems: "end", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ ...F.h3, alignSelf: "center" }}>{owner.name}</div>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Saldo que pagaste al declarar {ano}</span><Plata value={v.saldo} onChange={(x) => setV({ ...v, saldo: x })} /></label>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Retenciones del año (si las sabes)</span><Plata value={v.ret} onChange={(x) => setV({ ...v, ret: x })} /></label>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Ingresos del año (opcional)</span><Plata value={v.ing} onChange={(x) => setV({ ...v, ing: x })} /></label>
      <button type="button" disabled={!v.saldo && !v.ret} onClick={guardar} style={{ height: 38, borderRadius: R.md, border: "none", background: v.saldo || v.ret ? C.accent : C.raised, color: C.text, fontWeight: 700, fontSize: 13, cursor: v.saldo || v.ret ? "pointer" : "default" }}>Guardar</button>
    </div>
  );
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mm = (n) => fmtPlataEs(n);
// 3-nov-2026: mes en el idioma de la sesión (en español, igual que antes).
const mesN = (m) => (esEN() ? nombreMes(m) : MESES[m - 1]);
const mesF = (m) => (esEN() ? nombreMes(m) : MESES[m - 1].toLowerCase());

/** Texto de la fecha de pago de un titular: "26 de octubre", "mayo y julio"… */
export function textoFechaPago(owner) {
  const ps = mesesDePago(owner);
  // EE. UU.: 4 pagos estimados (15 de enero, abril, junio y septiembre).
  if (esUS()) return tx("en 4 pagos estimados: 15 de enero, abril, junio y septiembre", "in 4 estimated payments: Jan 15, Apr 15, Jun 15 and Sep 15");
  if (ps.length > 1) return tx("en " + ps.map((p) => MESES[p.mes - 1].toLowerCase()).join(" y ") + " (dos cuotas)", "in " + ps.map((p) => mesF(p.mes)).join(" and ") + " (two installments)");
  const p = ps[0];
  return p.dia ? tx(`el ${p.dia} de ${MESES[p.mes - 1].toLowerCase()}`, `on ${mesF(p.mes)} ${p.dia}`) : tx(`en ${MESES[p.mes - 1].toLowerCase()}`, `in ${mesF(p.mes)}`);
}

// ─── EE. UU. ──────────────────────────────────────────────────────────────
// 3-nov-2026: en una sesión de EE. UU. no hay declaración que leer (F-210): el
// impuesto sale del motor de EE. UU. (impuestoUS.js) con el estado civil y el estado
// de residencia de Impuestos. La nota dice de dónde sale y cómo se paga.
const ESTADO_CIVIL = { single: ["Soltero", "Single"], married_jointly: ["Casados, declaración conjunta", "Married filing jointly"], married_separately: ["Casados, por separado", "Married filing separately"], head_of_household: ["Cabeza de hogar", "Head of household"] };
function NotaUS({ modo, detalle = [], onNavigate }) {
  const hoy = new Date().getFullYear();
  const año = modo === "actual" ? hoy : hoy + 1;
  const us = (detalle || []).find((d) => d && d.us)?.us || null;
  const d0 = (detalle || []).find((d) => d && d.us) || null;
  const link = (txt, pg) => <button type="button" onClick={() => onNavigate?.(pg)} style={{ ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{txt}</button>;
  const civil = us ? (ESTADO_CIVIL[us.filingStatus] || ESTADO_CIVIL.single) : null;
  return (
    <details style={{ ...F.caption, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "8px 12px", marginTop: 14 }}>
      <summary style={{ cursor: "pointer", color: C.muted }}>
        {tx(`Impuestos estimados (IRS y estado) de ${año}: calculados con tus ingresos`, `Estimated taxes (IRS & state) for ${año}: calculated from your income`)}
        <span style={{ color: C.accent }}>{tx(" · ver detalle", " · see details")}</span>
      </summary>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        <div>{tx("Se calculan con las tablas vigentes del IRS, tu estado civil y tu estado de residencia. Lo que retiene tu nómina (W-2) sale cada mes; el resto se paga en 4 pagos estimados (Form 1040-ES): 15 de enero, abril, junio y septiembre.", "They're calculated with current IRS tables, your filing status and your state of residence. Payroll withholding (W-2) comes out every month; the rest is paid in 4 estimated payments (Form 1040-ES): Jan 15, Apr 15, Jun 15 and Sep 15.")}</div>
        {us && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
            <b style={{ color: C.text }}>{tx(civil[0], civil[1])} · {us.estado}</b>
            {" · "}{tx("federal", "federal")} {plata(us.federal)}
            {" · "}{tx(`estatal (${us.estado})`, `state (${us.estado})`)} {plata(us.estatal)}
            {us.fica > 0 && <>{" · "}FICA {plata(us.fica)}</>}
            {us.seTax > 0 && <>{" · "}{tx("self-employment", "self-employment")} {plata(us.seTax)}</>}
            <div>{tx(`Retenido por nómina: ${plata(d0?.reteN)} · pagos estimados: ${plata(d0?.impuesto)} al año.`, `Withheld by payroll: ${plata(d0?.reteN)} · estimated payments: ${plata(d0?.impuesto)} a year.`)}</div>
          </div>
        )}
        <div>{tx("Es un estimado: no incluye deducciones detalladas ni créditos, y los arriendos tributan sobre el bruto. ", "This is an estimate: it doesn't include itemized deductions or credits, and rental income is taxed on the gross amount. ")}
          {tx("Tu estado civil y tu estado se cambian en ", "Change your filing status and state in ")}{link(tx("Impuestos", "Tax Planning"), "tax")}.</div>
      </div>
    </details>
  );
}

// Fila por titular: de dónde sale, cuánto y cuándo paga.
function FilaTitular({ o, modo, anoDecl, conBase, anos, d, onCambiarMes, ajustado }) {
  const jur = o.type === "juridica";
  const ps = mesesDePago(o);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
      <span>
        <b style={{ color: C.text }}>{o.name}</b>
        {" · "}{conBase ? (modo === "actual" ? tx(`declaración ${anoDecl}`, `${anoDecl} tax return`) : tx("Calculadora", "Calculator")) : anos.length ? tx(`tiene ${anos.join(", ")}; falta ${anoDecl}`, `has ${anos.join(", ")}; missing ${anoDecl}`) : tx("sin declaración", "no tax return")}
        {d ? tx(` · por pagar ${mm(Math.max(0, (Number(d.impBruto ?? d.impuesto) || 0) - (Number(d.reteN) || 0)))}`, ` · due ${mm(Math.max(0, (Number(d.impBruto ?? d.impuesto) || 0) - (Number(d.reteN) || 0)))}`) : ""}
        {tx(" · paga ", " · pays ")}<b style={{ color: C.text }}>{textoFechaPago(o)}</b>{ps[0]?.auto ? tx(" (según su NIT)", " (by tax ID)") : ""}
        {ajustado && <div style={{ color: C.warn }}>{tx("El «saldo a pagar» leído del PDF es mayor que el impuesto: era un saldo a favor, así que no se cobra. Revísalo abajo en «¿Algún valor quedó mal leído?».", "The “balance due” read from the PDF is larger than the tax: it was a refund, so it isn't charged. Check it below under “Was any value misread?”.")}</div>}
      </span>
      {onCambiarMes && (
        <select value={Number(o.mesDeclaracion) || 0} onChange={(ev) => onCambiarMes(o.id, Number(ev.target.value) || null)} style={{ ...inp, width: "auto", height: 30, fontSize: 12, cursor: "pointer" }}>
          <option value={0}>{tx("Fecha automática", "Automatic date")}</option>
          {(jur ? [4, 5, 6] : [8, 9, 10]).map((k) => <option key={k} value={k}>{mesN(k)}{jur ? tx(` y ${MESES[k + 1]}`, ` and ${mesN(k + 2)}`) : ""}</option>)}
        </select>
      )}
    </div>
  );
}

function estado(owners, cal, detalle, modo) {
  const conBase = (o) => Object.values(cal).some((c) => c.ownerId === o.id && (modo !== "actual" || c.real));
  // Solo se pide la declaración a quien la necesita: tiene otras declaraciones o le sale impuesto.
  const relevante = (o) => (o.declaraciones || []).length > 0 || detalle.some((d) => d.name === o.name && (Number(d.impBruto ?? d.impuesto) || 0) > 0);
  const faltan = owners.filter((o) => !conBase(o) && relevante(o));
  const anos = (o) => (o.declaraciones || []).map((d) => Number(d.anoGravable)).filter(Boolean).sort();
  return { conBase, faltan, anos };
}

/**
 * 29-oct-2026 (Santiago: "esto es demasiado intrusivo… lo pone como primera información";
 * "debería ir en la sección de impuestos, en lo que se paga, y de ahí se alimenta el simulador").
 * En los simuladores: UNA línea al final que dice de dónde sale el impuesto. Lo que se edita
 * (fecha de pago, escribir lo que pagaste) vive en Impuestos › Historial (PagosDeRenta).
 */
export default function NotaFuenteImpuesto({ modo = "actual", cal = {}, owners = [], detalle = [], onNavigate }) {
  const hoy = new Date().getFullYear();
  if (esUS()) return <NotaUS modo={modo} detalle={detalle} onNavigate={onNavigate} />;
  if (!owners.length) return null;
  const anoDecl = modo === "actual" ? hoy - 1 : hoy;
  const { conBase, faltan, anos } = estado(owners, cal, detalle, modo);
  const link = (txt, pg) => <button type="button" onClick={() => onNavigate?.(pg)} style={{ ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{txt}</button>;
  return (
    <details style={{ ...F.caption, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "8px 12px", marginTop: 14 }}>
      <summary style={{ cursor: "pointer", color: C.muted }}>
        {modo === "actual" ? tx(`Impuesto de este año: tu declaración ${hoy - 1}`, `This year's tax: your ${hoy - 1} tax return`) : tx(`Renta de ${hoy} (se paga en ${hoy + 1}): de la Calculadora de declaración`, `${hoy} income tax (paid in ${hoy + 1}): from the Tax Return Calculator`)}
        {faltan.length > 0 && <span style={{ color: C.warn }}>{tx(` · falta la de ${faltan.map((o) => o.name).join(", ")} (por ahora, aproximado)`, ` · missing for ${faltan.map((o) => o.name).join(", ")} (approximate for now)`)}</span>}
        <span style={{ color: C.accent }}>{tx(" · ver detalle", " · see details")}</span>
      </summary>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        <div>
          {modo === "actual"
            ? <>{tx(`Lo que pagas en ${hoy} sale de la declaración ${hoy - 1}: retenciones cada mes y el saldo de un solo pago en la fecha que te toca. La renta de ${hoy} se paga en ${hoy + 1} y se ve en el `, `What you pay in ${hoy} comes from your ${hoy - 1} tax return: withholding every month and the balance in a single payment on your due date. ${hoy} income tax is paid in ${hoy + 1} and shows up in the `)}{link(tx(`Simulador ${hoy + 1}+`, `${hoy + 1}+ Simulator`), "simf")}.</>
            : <>{tx(`La renta de ${hoy} se paga en ${hoy + 1}, de una vez. Sale de la `, `${hoy} income tax is paid in ${hoy + 1}, all at once. It comes from the `)}{link(tx("Calculadora de declaración", "Tax Return Calculator"), "taxcalc")}.</>}
        </div>
        {owners.map((o) => <FilaTitular key={o.id} o={o} modo={modo} anoDecl={anoDecl} conBase={conBase(o)} anos={anos(o)} d={detalle.find((x) => x.name === o.name)} />)}
        <div>{tx("Las declaraciones y las fechas de pago se manejan en ", "Tax returns and payment dates are managed in ")}{link(tx("Impuestos › Historial", "Taxes › History"), "prevtax")}.</div>
      </div>
    </details>
  );
}

/** Panel de Impuestos › Historial: lo que paga cada titular este año y cuándo. Alimenta los simuladores. */
export function PagosDeRenta({ cal = {}, owners = [], detalle = [], onGuardarDeclaracion, onCambiarMes, onSubir }) {
  const hoy = new Date().getFullYear();
  const [form, setForm] = useState(false);
  if (!owners.length) return null;
  const anoDecl = hoy - 1;
  const { conBase, faltan, anos } = estado(owners, cal, detalle, "actual");
  const btn = { ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" };
  return (
    <div style={{ ...F.caption, color: C.muted, display: "grid", gap: 8 }}>
      <div>Lo que pagas de renta en {hoy}: retenciones cada mes y el saldo de la declaración {anoDecl} en un solo pago. Con esto se calculan los simuladores. La fecha sale del NIT de la declaración; cámbiala solo si no coincide.</div>
      {owners.map((o) => <FilaTitular key={o.id} o={o} modo="actual" anoDecl={anoDecl} conBase={conBase(o)} anos={anos(o)} d={detalle.find((x) => x.name === o.name)} onCambiarMes={onCambiarMes} ajustado={cal[o.name]?.saldoAjustado} />)}
      {faltan.length > 0 && (
        <div style={{ color: C.warn }}>
          Falta la declaración {anoDecl} de {faltan.map((o) => o.name).join(", ")}; mientras tanto se usa un aproximado.{" "}
          {onSubir && <button type="button" onClick={onSubir} style={btn}>Subir PDF</button>}
          {onGuardarDeclaracion && <>{" · "}<button type="button" onClick={() => setForm(!form)} style={btn}>{form ? "cerrar" : "o escribe lo que pagaste"}</button></>}
          {form && faltan.map((o) => <LoQuePague key={o.id} owner={o} ano={anoDecl} onGuardar={(id, d) => onGuardarDeclaracion(id, d)} />)}
        </div>
      )}
    </div>
  );
}
