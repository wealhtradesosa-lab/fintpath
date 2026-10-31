import { useState } from "react";
import { C, F, R } from "../lib/designTokens";
import { mesesDePago } from "../lib/impuestoReferente";

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
const mm = (n) => "$" + Math.round((Number(n) || 0) / 1e6).toLocaleString("es-CO") + " MM";

/** Texto de la fecha de pago de un titular: "26 de octubre", "mayo y julio"… */
export function textoFechaPago(owner) {
  const ps = mesesDePago(owner);
  if (ps.length > 1) return "en " + ps.map((p) => MESES[p.mes - 1].toLowerCase()).join(" y ") + " (dos cuotas)";
  const p = ps[0];
  return p.dia ? `el ${p.dia} de ${MESES[p.mes - 1].toLowerCase()}` : `en ${MESES[p.mes - 1].toLowerCase()}`;
}

// Fila por titular: de dónde sale, cuánto y cuándo paga.
function FilaTitular({ o, modo, anoDecl, conBase, anos, d, onCambiarMes, ajustado }) {
  const jur = o.type === "juridica";
  const ps = mesesDePago(o);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
      <span>
        <b style={{ color: C.text }}>{o.name}</b>
        {" · "}{conBase ? (modo === "actual" ? `declaración ${anoDecl}` : "Calculadora") : anos.length ? `tiene ${anos.join(", ")}; falta ${anoDecl}` : "sin declaración"}
        {d ? ` · por pagar ${mm(Math.max(0, (Number(d.impBruto ?? d.impuesto) || 0) - (Number(d.reteN) || 0)))}` : ""}
        {" · paga "}<b style={{ color: C.text }}>{textoFechaPago(o)}</b>{ps[0]?.auto ? " (según su NIT)" : ""}
        {ajustado && <div style={{ color: C.warn }}>El «saldo a pagar» leído del PDF es mayor que el impuesto: era un saldo a favor, así que no se cobra. Revísalo abajo en «¿Algún valor quedó mal leído?».</div>}
      </span>
      {onCambiarMes && (
        <select value={Number(o.mesDeclaracion) || 0} onChange={(ev) => onCambiarMes(o.id, Number(ev.target.value) || null)} style={{ ...inp, width: "auto", height: 30, fontSize: 12, cursor: "pointer" }}>
          <option value={0}>Fecha automática</option>
          {(jur ? [4, 5, 6] : [8, 9, 10]).map((k) => <option key={k} value={k}>{MESES[k - 1]}{jur ? ` y ${MESES[k + 1]}` : ""}</option>)}
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
  if (!owners.length) return null;
  const anoDecl = modo === "actual" ? hoy - 1 : hoy;
  const { conBase, faltan, anos } = estado(owners, cal, detalle, modo);
  const link = (txt, pg) => <button type="button" onClick={() => onNavigate?.(pg)} style={{ ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{txt}</button>;
  return (
    <details style={{ ...F.caption, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.md, padding: "8px 12px", marginTop: 14 }}>
      <summary style={{ cursor: "pointer", color: C.muted }}>
        {modo === "actual" ? `Impuesto de este año: tu declaración ${hoy - 1}` : `Renta de ${hoy} (se paga en ${hoy + 1}): de la Calculadora de declaración`}
        {faltan.length > 0 && <span style={{ color: C.warn }}> · falta la de {faltan.map((o) => o.name).join(", ")} (por ahora, aproximado)</span>}
        <span style={{ color: C.accent }}> · ver detalle</span>
      </summary>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        <div>
          {modo === "actual"
            ? <>Lo que pagas en {hoy} sale de la declaración {hoy - 1}: retenciones cada mes y el saldo de un solo pago en la fecha que te toca. La renta de {hoy} se paga en {hoy + 1} y se ve en el {link(`Simulador ${hoy + 1}+`, "simf")}.</>
            : <>La renta de {hoy} se paga en {hoy + 1}, de una vez. Sale de la {link("Calculadora de declaración", "taxcalc")}.</>}
        </div>
        {owners.map((o) => <FilaTitular key={o.id} o={o} modo={modo} anoDecl={anoDecl} conBase={conBase(o)} anos={anos(o)} d={detalle.find((x) => x.name === o.name)} />)}
        <div>Las declaraciones y las fechas de pago se manejan en {link("Impuestos › Historial", "prevtax")}.</div>
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
