// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { fmtPctEs, fmtMilesEs, fmtPlataCortaEs } from "../lib/formato.js";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, cienMillones, valorizacionHintPct, leerModifica, rendimientoHintPct, validarMezcla, leerFuturos } from "../lib/futuro10.js";
import { track } from "../lib/analytics";

const C = { bg: "#111827", bg2: "#1f2937", bd: "rgba(255,255,255,0.1)", tx: "#e5e7eb", tx2: "#9ca3af", gn: "#22c55e", rd: "#ef4444", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(34,197,94,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const PASOS = ["Hoy", "Decide", "Reinvierte", "Resultado", "Escenarios", "Cada inversión"];
const plata = (v) => (Math.round(Number(v) || 0) < 0 ? "−$" : "$") + fmtMilesEs(Math.abs(Number(v) || 0));
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos generales que puedes ajustar en algunos pasos; no es una recomendación de inversión. No incluye impuestos.";

// Al guardar, un ingreso o activo futuro sin nombre queda «Ingreso futuro N» / «Activo futuro N».
export const conNombres = (cfg) => {
  const f = cfg.futuros || {};
  const pon = (arr = [], base) => arr.map((x, k) => (String(x.nombre || "").trim() ? x : { ...x, nombre: `${base} ${k + 1}` }));
  return { ...cfg, futuros: { ...f, ingresos: pon(f.ingresos, "Ingreso futuro"), activos: pon(f.activos, "Activo futuro") } };
};
const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [] } };

export const MSG_DEMO_F10 = "En modo demo no se guardan escenarios.";

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0, demo = false }) {
  const [paso, setPaso] = useState(pasoInicial);
  const [cfg, setCfg] = useState(CONFIG_INICIAL);
  const [nombreEsc, setNombreEsc] = useState("");
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => proyectarFuturo10(user, cfg), [user, cfg]);
  const esc = r.escenario;
  const escenarios = guardado.escenarios || [];
  const mezcla = cfg.mezcla || SUPUESTOS_F10.nortes[cfg.norte] || SUPUESTOS_F10.nortes.equilibrio;
  const ir = (i) => { setPaso(i); track("futuro10_paso", { paso: i + 1 }); };
  const bolsa = (user.inv || []).filter((a) => cfg.decisiones[a.id]?.accion === "vende").length;

  const guardar = () => {
    if (demo) return; // la demo nunca escribe en la cuenta real
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `Escenario ${escenarios.length + 1}`, creado: new Date().toISOString(), config: conNombres(cfg) };
    onGuardar && onGuardar({ ...guardado, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, escenarios: escenarios.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label="Mi futuro a 10 años" title="¿Cómo se ve tu patrimonio en 10 años?" compact
        subtitle="Decide qué hacer con cada activo, reinvierte y mira el resultado en pesos de hoy. Tus datos reales no se tocan." />
      <div style={{ ...card, borderColor: C.am, fontSize: 12, color: C.tx2 }}>{AVISO_F10}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>Escenario:</span>
        {Object.entries(SUPUESTOS_F10.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{e.nombre}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>inflación {fmtPctEs(esc.inflacionPct)}</span>
      </div>

      {paso === 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Hoy</h3>
          <Grid items={[
            ["Patrimonio neto", plata(r.hoy.patrimonio)],
            ["Entra al mes", plata(r.hoy.ingresoMensual)],
            ["Sale al mes", plata(r.hoy.salidaMensual)],
            ["Flujo del mes", plata(r.hoy.flujoMensual)],
            ["Liquidez", plata(r.hoy.liquidos)],
          ]} />
          <p style={{ color: C.tx2, fontSize: 12 }}>Tus activos, por canasta:</p>
          {["liquido", "inmueble", "acciones", "otro", "vehiculo"].map((cl) => {
            const xs = (user.inv || []).filter((a) => r.activos.find((x) => x.id === a.id && x.clase === cl));
            if (!xs.length) return null;
            return <div key={cl} style={{ fontSize: 13, marginBottom: 4 }}><b>{ETQ[cl]}:</b> {xs.map((a) => a.n || a.nombre).join(", ")}</div>;
          })}
          <p style={{ color: C.tx2, fontSize: 12 }}>Las cifras de hoy no incluyen impuestos.</p>
        </div>
      )}

      {paso === 1 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Decide por activo</h3>
          {(user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
            const d = cfg.decisiones[a.id] || { accion: "continua" };
            const setD = (v) => set("decisiones", { ...cfg.decisiones, [a.id]: { ...d, ...v } });
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{a.n || a.nombre}</b><span style={{ color: C.tx2 }}>{plata(a.va)}{String(a.moneda).toUpperCase() === "USD" ? " USD" : ""}</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {[["continua", "Continúa"], ["vende", "Se vende"], ["modifica", "Se modifica"]].map(([k, l]) => <button key={k} style={btn(d.accion === k)} onClick={() => setD({ accion: k })}>{l}</button>)}
                </div>
                {d.accion === "modifica" && (() => {
                  const hint = valorizacionHintPct(a, esc);
                  const m = leerModifica(d, esc);
                  const lbl = { display: "block", marginTop: 6, fontSize: 12, color: C.tx2 };
                  const anios = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                  return (
                    <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8 }}>
                      <label style={lbl}>¿Cuánto crees que se valoriza al año? (%)
                        <InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={m.valorizacionNomPct == null ? "" : Math.round(m.valorizacionNomPct * 100) / 100} onChange={(v) => setD({ valorizacionNomPct: v, retornoRealPct: undefined })} />
                        <span style={{ fontSize: 11 }}>Si no sabes, déjalo en {fmtPctEs(hint, 1)}. Es lo que sube el valor cada año, como lo dirías en la calle.</span></label>
                      <label style={lbl}>Inversión adicional (opcional)
                        <NumberInput style={inp} placeholder="0" value={d.inversionMonto ?? ""} onChange={(v) => setD({ inversionMonto: v })} />
                        <span style={{ fontSize: 11 }}>Por ejemplo, una construcción. Sale de tu liquidez y se suma al valor del activo; desde ahí se valoriza todo.</span></label>
                      <label style={lbl}>¿En qué año la haces?
                        <select style={inp} value={m.inversionAnio} onChange={(e) => setD({ inversionAnio: Number(e.target.value) })}>{anios.map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                      <label style={lbl}>Renta que empiezas a recibir al mes (opcional)
                        <NumberInput style={inp} placeholder="0" value={d.rentaNuevaMensual ?? ""} onChange={(v) => setD({ rentaNuevaMensual: v })} />
                        <span style={{ fontSize: 11 }}>Lo que te quedaría libre cada mes, por ejemplo un arriendo después de gastos. Sube con la inflación.</span></label>
                      {m.rentaNuevaMensual > 0 && <label style={lbl}>¿Desde qué año recibes esa renta?
                        <select style={inp} value={m.rentaNuevaDesde} onChange={(e) => setD({ rentaNuevaDesde: Number(e.target.value) })}>{anios.map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que vendes va a una bolsa para reinvertir ({bolsa} activo{bolsa === 1 ? "" : "s"}). Primero se completa un colchón de {SUPUESTOS_F10.colchonMeses} meses de gastos.</p>
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} />
        </div>
      )}

      {paso === 2 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Reinvierte</h3>
          <PlataDisponible disponible={r.disponible} />
          <p style={{ color: C.tx2, fontSize: 12 }}>Elige un norte. Son ejemplos de mezcla, no recomendaciones.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(SUPUESTOS_F10.nortes).map(([k, nt]) => <button key={k} style={btn(!cfg.mezcla && cfg.norte === k)} onClick={() => setCfg((p) => ({ ...p, norte: k, mezcla: null }))}>{nt.nombre}</button>)}
            <button style={btn(!!cfg.mezcla)} onClick={() => set("mezcla", { liquidez: mezcla.liquidez, renta: mezcla.renta, crecimiento: mezcla.crecimiento })}>Personalizado</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,100px),1fr))", gap: 8, marginTop: 10 }}>
            {["liquidez", "renta", "crecimiento"].map((k) => <label key={k} style={{ fontSize: 12, color: C.tx2 }}>{k[0].toUpperCase() + k.slice(1)} (%)
              {cfg.mezcla ? <InputDecimalEs style={inp} value={cfg.mezcla[k]} onChange={(v) => set("mezcla", { ...cfg.mezcla, [k]: v })} /> : <div style={{ color: C.tx, fontSize: 15 }}>{fmtPctEs(mezcla[k], 0)}</div>}</label>)}
          </div>
          {validarMezcla(cfg.mezcla) && <p role="alert" style={{ color: C.rd, fontSize: 12 }}>{validarMezcla(cfg.mezcla)}</p>}
          <h4>Inversiones nuevas</h4>
          {cfg.nuevas.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: 6, marginBottom: 6 }}>
              <select style={inp} value={x.preset} onChange={(e) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, preset: e.target.value } : y))}>
                {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                <option value="custom">Otra (personalizada)</option>
              </select>
              <NumberInput style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              {x.preset === "custom" && (() => {
                const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y));
                const hint = rendimientoHintPct(esc);
                const lbl = { fontSize: 12, color: C.tx2 };
                return (<>
                  <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder="Ej.: negocio, CDT, finca" /></label>
                  <label style={lbl}>¿En qué año?<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                  <label style={lbl}>Rendimiento anual esperado (%)<InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} />
                    <span style={{ fontSize: 11 }}>Si no sabes, usa {fmtPctEs(hint, 1)}.</span></label>
                  <label style={lbl}>Moneda<select style={inp} value={x.moneda || "COP"} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>
                    {x.moneda === "USD" && <span style={{ fontSize: 11, color: C.am }}>En dólares, el resultado en pesos también depende de cómo se mueva la tasa de cambio.</span>}</label>
                  <label style={lbl}>¿Cómo te da plata?<select style={inp} value={x.tipo || "valoriza"} onChange={(e) => up({ tipo: e.target.value })}><option value="renta">Paga renta (te entra al flujo)</option><option value="valoriza">Solo se valoriza (crece el valor)</option></select></label>
                </>);
              })()}
              <button style={btn(false)} onClick={() => set("nuevas", cfg.nuevas.filter((_, j) => j !== i))}>Quitar</button>
              <AlertaExceso disponible={r.disponible} tipo="nueva" idx={i} />
            </div>
          ))}
          <button style={btn(false)} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "" }])}>+ Crear inversión</button>
          <h4>Reinvertir en lo que ya tienes</h4>
          {cfg.reinversiones.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: 6, marginBottom: 6 }}>
              <select style={inp} value={x.activoId} onChange={(e) => set("reinversiones", cfg.reinversiones.map((y, j) => j === i ? { ...y, activoId: e.target.value } : y))}>
                {r.activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <NumberInput style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("reinversiones", cfg.reinversiones.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              <button style={btn(false)} onClick={() => set("reinversiones", cfg.reinversiones.filter((_, j) => j !== i))}>Quitar</button>
              <AlertaExceso disponible={r.disponible} tipo="reinversion" idx={i} />
            </div>
          ))}
          {r.activos.length > 0 && <button style={btn(false)} onClick={() => set("reinversiones", [...cfg.reinversiones, { activoId: r.activos[0].id, monto: "" }])}>+ Reinvertir</button>}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que no asignes a mano se reparte según el norte.</p>
        </div>
      )}

      {paso === 3 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Resultado a 10 años</h3>
          <Grid items={[
            ["Patrimonio en pesos de hoy", plata(r.final.patrimonioReal)],
            ["Patrimonio nominal", plata(r.final.patrimonio)],
            ["Invertible vs. inflación", r.vsInflacionReal == null ? "—" : (r.vsInflacionReal >= 0 ? "+" : "") + fmtPctEs(r.vsInflacionReal)],
          ]} />
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 340 }}>
              <thead><tr style={{ color: C.tx2, textAlign: "right" }}><th style={{ textAlign: "left" }}>Año</th><th>Ingreso/mes*</th><th>Gasto/mes*</th><th>Patrimonio*</th><th>Nominal</th></tr></thead>
              <tbody>{r.filas.slice(1).map((f) => (
                <tr key={f.anio} style={{ textAlign: "right", borderTop: `1px solid ${C.bd}`, color: f.cf < 0 ? C.rd : C.tx }}>
                  <td style={{ textAlign: "left" }}>{f.anio}</td><td>{fmtPlataCortaEs(f.ingresosReal / 12)}</td><td>{fmtPlataCortaEs(f.gastosReal / 12)}</td><td>{fmtPlataCortaEs(f.patrimonioReal)}</td><td>{fmtPlataCortaEs(f.patrimonio)}</td>
                </tr>))}</tbody>
            </table>
            <div style={{ color: C.tx2, fontSize: 11 }}>* En pesos de hoy (se descuenta la inflación una sola vez).</div>
          </div>
          {r.alertas.length > 0 && <div style={{ ...card, borderColor: C.rd, marginTop: 10 }}>
            <b style={{ color: C.rd }}>Alertas de liquidez</b>
            {dedupe(r.alertas).map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.texto}</div>)}
          </div>}
          {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. El escenario {esc.nombre.toLowerCase()} supone devaluación real de {fmtPctEs(SUPUESTOS_F10.presets.sp500.devaluacionRealPct)}.</p>}
        </div>
      )}

      {paso === 4 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Guardar y comparar</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder="Nombre del escenario" value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />
            <button style={btn(!demo)} disabled={demo} onClick={guardar}>Guardar en tu cuenta</button>
          </div>
          {demo && <p style={{ color: C.am, fontSize: 12 }}>{MSG_DEMO_F10}</p>}
          {escenarios.length === 0 ? <p style={{ color: C.tx2 }}>Aún no tienes escenarios guardados.</p> : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 320 }}>
                <thead><tr style={{ color: C.tx2, textAlign: "right" }}><th style={{ textAlign: "left" }}>Escenario</th><th>Pesos de hoy</th><th>Nominal</th><th></th></tr></thead>
                <tbody>{escenarios.map((e) => { const x = proyectarFuturo10(user, e.config); return (
                  <tr key={e.id} style={{ textAlign: "right", borderTop: `1px solid ${C.bd}` }}>
                    <td style={{ textAlign: "left" }}>{e.nombre}{x.alertas.length ? " ⚠️" : ""}</td><td>{fmtPlataCortaEs(x.final.patrimonioReal)}</td><td>{fmtPlataCortaEs(x.final.patrimonio)}</td>
                    <td><button style={btn(false)} onClick={() => { setCfg({ ...CONFIG_INICIAL, ...e.config }); ir(3); }}>Ver</button> <button style={btn(false)} onClick={() => borrar(e.id)}>Borrar</button></td>
                  </tr>); })}</tbody>
              </table>
            </div>)}
        </div>
      )}

      {paso === 5 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Cada inversión: $100.000.000 a 3, 5 y 10 años</h3>
          <p style={{ color: C.tx2, fontSize: 12 }}>Ejemplos por tipo de inversión, escenario {esc.nombre.toLowerCase()}. En pesos de hoy; entre paréntesis, nominal.</p>
          {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => (
            <div key={k} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
              <b>{p.nombre}</b> <span style={{ color: C.tx2, fontSize: 12 }}>· {fmtPctEs(retornoNominalPreset(k, esc))} nominal al año</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, fontSize: 12, marginTop: 4 }}>
                {cienMillones(k, esc).map((c) => <div key={c.anios}>{c.anios} años<br /><b>{fmtPlataCortaEs(c.hoy)}</b><br /><span style={{ color: C.tx2 }}>({fmtPlataCortaEs(c.nominal)})</span></div>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <details style={card}>
        <summary style={{ cursor: "pointer" }}>Supuestos de referencia (estimaciones de largo plazo)</summary>
        <p style={{ color: C.tx2, fontSize: 12 }}>Puedes cambiar el escenario arriba, la valorización de cada activo en el paso 2 y la mezcla o el rendimiento de una inversión personalizada en el paso 3.</p>
        <TablaSupuestos esc={esc} />
      </details>
    </div>
  );
}

const ANIOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function LoQueViene({ cfg, set, esc, owners }) {
  const f = { ingresos: [], activos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const lbl = { fontSize: 12, color: C.tx2 };
  const g = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.bd}` };
  const selAnio = (v, on, vacioTxt) => <select style={inp} value={v ?? ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}>{vacioTxt && <option value="">{vacioTxt}</option>}{ANIOS.map((y) => <option key={y} value={y}>Año {y}</option>)}</select>;
  const hintVal = (cl) => fmtPctEs(((1 + esc.inflacionPct / 100) * (1 + (cl === "inmueble" ? SUPUESTOS_F10.presets.fincaRaiz.valorizacionSpread : SUPUESTOS_F10.otrosRealSpread) / 100) - 1) * 100, 1);
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "8px 0" }}>Lo que viene</h4>
      <p style={{ color: C.tx2, fontSize: 12 }}>Ingresos o activos que empiezan más adelante: una pensión, un local que te entregan en 2 años.</p>
      <b style={{ fontSize: 13 }}>Ingresos futuros</b>
      {f.ingresos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder={`Ingreso futuro ${i + 1}`} onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Al mes ($, pesos de hoy)<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            <span style={{ fontSize: 11 }}>Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. Sube con la inflación.</span></label>
          <label style={lbl}>Empieza{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          <label style={lbl}>Termina (opcional){selAnio(x.hasta, (v) => upI(i, { hasta: v }), "Sigue")}</label>
          {owners.length > 1 && <label style={lbl}>Titular (opcional)<select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select></label>}
          <button style={btn(false)} onClick={() => put("ingresos", f.ingresos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={btn(false)} onClick={() => put("ingresos", [...f.ingresos, { nombre: "", mensual: "", desde: 1, hasta: "" }])}>+ Ingreso futuro</button>
      <div style={{ marginTop: 10 }}><b style={{ fontSize: 13 }}>Activos futuros</b></div>
      {f.activos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder={`Activo futuro ${i + 1}`} onChange={(e) => upA(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Tipo<select style={inp} value={x.clase || "inmueble"} onChange={(e) => upA(i, { clase: e.target.value })}><option value="inmueble">Finca raíz</option><option value="otro">Otro</option></select></label>
          <label style={lbl}>Valor total ($)<NumberInput style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} /></label>
          <label style={lbl}>Cuota inicial ($)<NumberInput style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} /></label>
          <label style={lbl}>Año de la cuota inicial{selAnio(x.anioCuota || 1, (v) => upA(i, { anioCuota: v || 1 }))}</label>
          <label style={lbl}>Año de entrega{selAnio(x.entrega || 1, (v) => upA(i, { entrega: v || 1 }))}
            <span style={{ fontSize: 11 }}>El resto se paga en la entrega. Los pagos salen de tu liquidez; desde la entrega se valoriza.</span></label>
          <label style={lbl}>Renta neta al mes ($, pesos de hoy, opcional)<NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} /></label>
          <label style={lbl}>Renta desde{selAnio(x.rentaDesde || x.entrega || 1, (v) => upA(i, { rentaDesde: v || 1 }))}</label>
          <label style={lbl}>¿Cuánto crees que se valoriza al año? (%)<InputDecimalEs style={inp} placeholder={hintVal(x.clase || "inmueble")} value={x.valorizacionNomPct ?? ""} onChange={(v) => upA(i, { valorizacionNomPct: v })} />
            <span style={{ fontSize: 11 }}>Si no sabes, déjalo en {hintVal(x.clase || "inmueble")}.</span></label>
          <AvisoPagosFuturo x={x} i={i} esc={esc} />
          <button style={btn(false)} onClick={() => put("activos", f.activos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={btn(false)} onClick={() => put("activos", [...f.activos, { nombre: "", clase: "inmueble", valor: "", cuotaInicial: "", anioCuota: 1, entrega: 2, rentaMensual: "", rentaDesde: "" }])}>+ Activo futuro</button>
    </div>
  );
}

const ETQ = { liquido: "Liquidez", inmueble: "Finca raíz", acciones: "Crecimiento", otro: "Otros", vehiculo: "Vehículos (no invertibles)" };
// Una alerta por tipo, salvo los pagos de activos futuros: se muestra cada año en que pagas.
const dedupe = (as) => { const vistos = new Set(); return as.filter((a) => { const k = a.tipo === "pago_futuro" ? a.texto : a.tipo; return vistos.has(k) ? false : vistos.add(k); }); };

export const textoExceso = (d) => `En el año ${d.anio} asignas ${plata(d.exceso)} más de lo que tienes.`;
const alertaSt = { color: C.rd, fontSize: 12, background: "rgba(239,68,68,0.08)", border: `1px solid ${C.rd}`, borderRadius: 6, padding: "4px 8px" };

// Alerta junto a la inversión que se pasa de lo disponible en su año.
export function AlertaExceso({ disponible = [], tipo, idx }) {
  const d = disponible.find((x) => x.exceso > 0 && x.asignaciones.some((a) => a.tipo === tipo && a.idx === idx));
  return d ? <div role="alert" style={{ ...alertaSt, gridColumn: "1 / -1" }}>{textoExceso(d)}</div> : null;
}

// «Plata disponible para invertir»: números del motor, en pesos de hoy.
export function PlataDisponible({ disponible = [] }) {
  const [abierto, setAbierto] = useState(false);
  const d1 = disponible[0];
  if (!d1) return null;
  const lineas = (d) => [
    ["Liquidez hoy por encima del colchón", d.liquidezHoy, d.anio === 1],
    ["+ Ventas del paso 2", d.ventas, d.ventas > 0],
    ["− Para completar el colchón", -d.colchon, d.colchon > 0],
    [d.flujo >= 0 ? "+ Flujo libre del año" : "− Te falta en el flujo del año", d.flujo, true],
    ["− Inversiones adicionales (Se modifica)", -d.adicionales, d.adicionales > 0],
    ["− Pagos de activos futuros", -d.pagosFuturos, d.pagosFuturos > 0],
    ["− Asignado a mano (nuevas y reinversiones)", -d.asignado, d.asignado > 0],
  ].filter((l) => l[2]);
  const excesos = disponible.filter((d) => d.exceso > 0);
  const fila = { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "2px 0" };
  return (
    <div style={{ ...card, background: C.bg, borderColor: excesos.length ? C.rd : C.gn }}>
      <div style={{ fontSize: 12, color: C.tx2 }}>Plata disponible para invertir · año 1 · pesos de hoy</div>
      {lineas(d1).map(([l, v]) => <div key={l} style={fila}><span style={{ color: C.tx2 }}>{l}</span><span>{plata(v)}</span></div>)}
      <div style={{ ...fila, borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 6 }}>
        <b>Queda para repartir según el norte</b><b style={{ fontSize: 18, color: d1.queda < 0 ? C.rd : C.gn }}>{plata(d1.queda)}</b>
      </div>
      {excesos.map((d) => <div key={d.anio} role="alert" style={{ ...alertaSt, marginTop: 6 }}>{textoExceso(d)}</div>)}
      <button style={{ ...btn(false), marginTop: 8 }} onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar años 1 a 10" : "Ver años 1 a 10"}</button>
      {abierto && disponible.map((d) => (
        <details key={d.anio} style={{ borderTop: `1px solid ${C.bd}`, padding: "6px 0" }}>
          <summary style={{ ...fila, cursor: "pointer", display: "flex" }}><span>Año {d.anio}</span><span style={{ color: d.queda < 0 ? C.rd : C.tx }}>Queda {plata(d.queda)}</span></summary>
          {lineas(d).map(([l, v]) => <div key={l} style={{ ...fila, fontSize: 12 }}><span style={{ color: C.tx2 }}>{l}</span><span>{plata(v)}</span></div>)}
        </details>
      ))}
      <p style={{ color: C.tx2, fontSize: 11, margin: "6px 0 0" }}>Lo que queda se reparte según el norte que elijas abajo. Si un año sale negativo, se usa tu liquidez.</p>
    </div>
  );
}

// Aviso junto al activo futuro: en qué años sus pagos salen de tu liquidez.
export function AvisoPagosFuturo({ x, i, esc }) {
  const a = leerFuturos({ activos: [{ ...x, nombre: x.nombre || `Activo futuro ${i + 1}` }] }, esc).activos[0];
  if (!a) return null;
  const pagos = a.pagos.filter((p) => p.monto > 0);
  return <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>{pagos.map((p) => `En el año ${p.anio} pagas ${plata(p.monto)} de ${a.nombre} con tu liquidez.`).join(" ")}</div>;
}

function Grid({ items }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,140px),1fr))", gap: 8 }}>
    {items.map(([l, v]) => <div key={l} style={{ background: C.bg, borderRadius: 8, padding: 10 }}><div style={{ color: C.tx2, fontSize: 11 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div></div>)}
  </div>;
}

function TablaSupuestos({ esc }) {
  const s = SUPUESTOS_F10, p = s.presets;
  const filas = [
    ["Inflación", `${fmtPctEs(esc.inflacionPct)} al año`],
    ["Renta fija corto", `inflación + ${fmtPctEs(p.rfCorto.realSpread + esc.retornoSpread)} ≈ ${fmtPctEs(retornoNominalPreset("rfCorto", esc))} al año`],
    ["Renta fija largo", `inflación + ${fmtPctEs(p.rfLargo.realSpread)} (tope + ${fmtPctEs(p.rfLargo.topeSpread)})`],
    ["Finca raíz", `renta neta ${fmtPctEs(p.fincaRaiz.rentaNetaPct)} + valorización = inflación`],
    ["S&P 500 (USD)", `${fmtPctEs(esc.spRealPct)} real; devaluación real ${fmtPctEs(p.sp500.devaluacionRealPct)}`],
    ["Vehículos", `${fmtPctEs(s.vehiculo.depAnios1a3Pct)} años 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} después`],
    ["Ingresos / gastos", `inflación + ${fmtPctEs(esc.ingresosSpread)} / + ${fmtPctEs(esc.gastosSpread)}`],
    ["Ajuste de retornos del escenario", fmtPctEs(esc.retornoSpread)],
    ["Colchón de liquidez", `${s.colchonMeses} meses de gastos`],
  ];
  return <div style={{ fontSize: 12, marginTop: 8 }}>{filas.map(([a, b]) => (
    <div key={a} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 8px", padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
      <span style={{ color: C.tx2 }}>{a}</span><span style={{ textAlign: "right", overflowWrap: "anywhere", minWidth: 0 }}>{b}</span>
    </div>))}</div>;
}
