import { useState } from "react";
import { C, Cα, F, R } from "../lib/designTokens";

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, alignItems: "end", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ ...F.h3, alignSelf: "center" }}>{owner.name}</div>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Saldo que pagaste al declarar {ano}</span><Plata value={v.saldo} onChange={(x) => setV({ ...v, saldo: x })} /></label>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Retenciones del año (si las sabes)</span><Plata value={v.ret} onChange={(x) => setV({ ...v, ret: x })} /></label>
      <label style={{ display: "grid", gap: 4 }}><span style={F.caption}>Ingresos del año (opcional)</span><Plata value={v.ing} onChange={(x) => setV({ ...v, ing: x })} /></label>
      <button type="button" disabled={!v.saldo && !v.ret} onClick={guardar} style={{ height: 38, borderRadius: R.md, border: "none", background: v.saldo || v.ret ? C.accent : C.raised, color: C.text, fontWeight: 700, fontSize: 13, cursor: v.saldo || v.ret ? "pointer" : "default" }}>Guardar</button>
    </div>
  );
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function NotaFuenteImpuesto({ modo = "actual", cal = {}, owners = [], detalle = [], onNavigate, onGuardarDeclaracion, onCambiarMes }) {
  const hoy = new Date().getFullYear();
  const [abrir, setAbrir] = useState(modo === "actual"); // si falta la declaración, el formulario se ve de una
  if (!owners.length) return null;
  const cs = Object.values(cal);
  const sinBase = owners.filter((o) => !cs.some((c) => c.ownerId === o.id && (modo !== "actual" || c.real)));
  const link = (txt, pg) => <button type="button" onClick={() => onNavigate?.(pg)} style={{ ...F.body, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{txt}</button>;
  return (
    <div style={{ ...F.body, color: C.text, background: Cα.accent08, border: `1px solid ${Cα.accent25}`, borderRadius: R.md, padding: "12px 14px", marginBottom: 14 }}>
      {modo === "actual" ? (
        <>
          <div><b>🧾 El impuesto de este simulador corresponde a tu declaración de renta del año anterior ({hoy - 1}).</b></div>
          <div style={{ marginTop: 4 }}>Lo que pagas este año es real: las retenciones de cada mes y el saldo que pagaste al declarar {hoy - 1}. La renta que estás ganando en {hoy} se declara y se paga en {hoy + 1}: esa se estima en la {link("Calculadora de declaración", "taxcalc")} y se ve en el {link(`Simulador ${hoy + 1}+`, "simf")}.</div>
        </>
      ) : (
        <>
          <div><b>🧾 Los impuestos de {hoy + 1} en adelante son estimados.</b></div>
          <div style={{ marginTop: 4 }}>Salen de la {link("Calculadora de declaración", "taxcalc")}: la renta de {hoy}, que se declara y paga en {hoy + 1}, calculada desde tu declaración {hoy - 1} y lo que le dijiste que cambia.</div>
        </>
      )}
      {onCambiarMes && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${Cα.accent25}` }}>
          <div style={F.body}><b>El saldo no se paga cada mes:</b> sale de un golpe en el mes en que declaras. Las retenciones sí van mes a mes. ¿En qué mes declara cada uno?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {owners.map((o) => {
              const jur = o.type === "juridica";
              const m = Number(o.mesDeclaracion) || (jur ? 5 : 9);
              return (
                <label key={o.id} style={{ display: "grid", gap: 4, minWidth: 200 }}>
                  <span style={F.caption}><b style={{ color: C.text }}>{o.name}</b> · {jur ? "primera cuota (la segunda, dos meses después)" : "según los dos últimos dígitos de la cédula"}</span>
                  <select value={m} onChange={(ev) => onCambiarMes(o.id, Number(ev.target.value))} style={{ ...inp, cursor: "pointer" }}>
                    {(jur ? [4, 5, 6] : [8, 9, 10]).map((k) => <option key={k} value={k}>{MESES[k - 1]}{jur ? ` y ${MESES[k + 1]}` : ""}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {detalle.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ ...F.body, fontWeight: 700, color: C.accent, cursor: "pointer" }}>Ver de dónde sale el impuesto de cada titular</summary>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {detalle.map((d) => {
              const c = cal[d.name]; const bruto = Number(d.impBruto ?? d.impuesto) || 0, ret = Number(d.reteN) || 0;
              const fuente = d.fuente === "declaracion_real" ? `declaración ${hoy - 1} (real)` : d.fuente === "declaracion" ? "estimado desde su declaración" : "cálculo aproximado con lo registrado (sin declaración)";
              return (
                <div key={d.name} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, ...F.caption, color: C.muted, borderTop: `1px solid ${Cα.accent25}`, paddingTop: 4 }}>
                  <span><b style={{ color: C.text }}>{d.name}</b> · {fuente}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: C.text }}>impuesto ${Math.round(bruto / 1e6).toLocaleString("es-CO")} MM · retenido ${Math.round(ret / 1e6).toLocaleString("es-CO")} MM · {c?.real ? "saldo pagado" : "por pagar"} ${Math.round(Math.max(0, bruto - ret) / 1e6).toLocaleString("es-CO")} MM</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
      {sinBase.length > 0 && (
        <div style={{ marginTop: 10, padding: 10, background: Cα.warn08, border: `1px solid ${Cα.warn25}`, borderRadius: R.md }}>
          <div style={F.body}>
            <b>⚠️ Clave para la simulación — falta la declaración {hoy - 1} de:</b> {sinBase.map((o) => o.name).join(", ")}. Mientras tanto usamos un cálculo aproximado.
            {" "}{link("Subir el PDF en Historial", "prevtax")} o, si no lo tienes a mano,{" "}
            <button type="button" onClick={() => setAbrir(!abrir)} style={{ ...F.body, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>escribe lo que pagaste</button>.
          </div>
          {abrir && onGuardarDeclaracion && (
            <div style={{ marginTop: 8 }}>
              {sinBase.map((o) => <LoQuePague key={o.id} owner={o} ano={hoy - 1} onGuardar={(id, d) => { onGuardarDeclaracion(id, d); }} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
