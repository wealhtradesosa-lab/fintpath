// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import { fmtPctEs, fmtMilesEs, fmtPlataCortaEs } from "../lib/formato.js";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, cienMillones, valorizacionHintPct, leerModifica } from "../lib/futuro10.js";
import { track } from "../lib/analytics";

const C = { bg: "#111827", bg2: "#1f2937", bd: "rgba(255,255,255,0.1)", tx: "#e5e7eb", tx2: "#9ca3af", gn: "#22c55e", rd: "#ef4444", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(34,197,94,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const PASOS = ["Hoy", "Decide", "Reinvierte", "Resultado", "Escenarios", "Cada inversión"];
const plata = (v) => "$" + fmtMilesEs(v);
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos editables; no es una recomendación de inversión. No incluye impuestos.";

const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [] };

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0 }) {
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
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `Escenario ${escenarios.length + 1}`, creado: new Date().toISOString(), config: cfg };
    onGuardar && onGuardar({ ...guardado, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const borrar = (id) => onGuardar && onGuardar({ ...guardado, escenarios: escenarios.filter((e) => e.id !== id) });

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
                    <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
                      <label style={lbl}>¿Cuánto crees que se valoriza al año? (%)
                        <InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={m.valorizacionNomPct == null ? "" : Math.round(m.valorizacionNomPct * 100) / 100} onChange={(v) => setD({ valorizacionNomPct: v, retornoRealPct: undefined })} />
                        <span style={{ fontSize: 11 }}>Si no sabes, déjalo en {fmtPctEs(hint, 1)}. Es lo que sube el valor cada año, como lo dirías en la calle.</span></label>
                      <label style={lbl}>Inversión adicional ($)
                        <InputDecimalEs style={inp} value={d.inversionMonto ?? ""} onChange={(v) => setD({ inversionMonto: v })} />
                        <span style={{ fontSize: 11 }}>Por ejemplo, una construcción. Sale de tu liquidez y se suma al valor del activo; desde ahí se valoriza todo.</span></label>
                      <label style={lbl}>¿En qué año la haces?
                        <select style={inp} value={m.inversionAnio} onChange={(e) => setD({ inversionAnio: Number(e.target.value) })}>{anios.map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                      <label style={lbl}>Renta nueva al mes ($, pesos de hoy, opcional)
                        <InputDecimalEs style={inp} value={d.rentaNuevaMensual ?? ""} onChange={(v) => setD({ rentaNuevaMensual: v })} />
                        <span style={{ fontSize: 11 }}>Lo que te quedaría libre cada mes, por ejemplo un arriendo después de gastos. Sube con la inflación.</span></label>
                      <label style={lbl}>¿Desde qué año recibes esa renta?
                        <select style={inp} value={m.rentaNuevaDesde} onChange={(e) => setD({ rentaNuevaDesde: Number(e.target.value) })}>{anios.map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que vendes va a una bolsa para reinvertir ({bolsa} activo{bolsa === 1 ? "" : "s"}). Primero se completa un colchón de {SUPUESTOS_F10.colchonMeses} meses de gastos.</p>
        </div>
      )}

      {paso === 2 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Reinvierte</h3>
          <p style={{ color: C.tx2, fontSize: 12 }}>Elige un norte. Son ejemplos de mezcla, no recomendaciones.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(SUPUESTOS_F10.nortes).map(([k, nt]) => <button key={k} style={btn(!cfg.mezcla && cfg.norte === k)} onClick={() => setCfg((p) => ({ ...p, norte: k, mezcla: null }))}>{nt.nombre}</button>)}
            <button style={btn(!!cfg.mezcla)} onClick={() => set("mezcla", { liquidez: mezcla.liquidez, renta: mezcla.renta, crecimiento: mezcla.crecimiento })}>Personalizado</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginTop: 10 }}>
            {["liquidez", "renta", "crecimiento"].map((k) => <label key={k} style={{ fontSize: 12, color: C.tx2 }}>{k[0].toUpperCase() + k.slice(1)} (%)
              {cfg.mezcla ? <InputDecimalEs style={inp} value={cfg.mezcla[k]} onChange={(v) => set("mezcla", { ...cfg.mezcla, [k]: v })} /> : <div style={{ color: C.tx, fontSize: 15 }}>{fmtPctEs(mezcla[k], 0)}</div>}</label>)}
          </div>
          <h4>Inversiones nuevas</h4>
          {cfg.nuevas.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 6, marginBottom: 6 }}>
              <select style={inp} value={x.preset} onChange={(e) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, preset: e.target.value } : y))}>
                {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
              </select>
              <InputDecimalEs style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              <button style={btn(false)} onClick={() => set("nuevas", cfg.nuevas.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <button style={btn(false)} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "" }])}>+ Crear inversión</button>
          <h4>Reinvertir en lo que ya tienes</h4>
          {cfg.reinversiones.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 6, marginBottom: 6 }}>
              <select style={inp} value={x.activoId} onChange={(e) => set("reinversiones", cfg.reinversiones.map((y, j) => j === i ? { ...y, activoId: e.target.value } : y))}>
                {r.activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
              <InputDecimalEs style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("reinversiones", cfg.reinversiones.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              <button style={btn(false)} onClick={() => set("reinversiones", cfg.reinversiones.filter((_, j) => j !== i))}>Quitar</button>
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
          {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. El escenario base supone devaluación real de 0%.</p>}
        </div>
      )}

      {paso === 4 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Guardar y comparar</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder="Nombre del escenario" value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />
            <button style={btn(true)} onClick={guardar}>Guardar en tu cuenta</button>
          </div>
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
        <summary style={{ cursor: "pointer" }}>Supuestos usados (editables, validados por Finanzas)</summary>
        <TablaSupuestos esc={esc} />
      </details>
    </div>
  );
}

const ETQ = { liquido: "Liquidez", inmueble: "Finca raíz", acciones: "Crecimiento", otro: "Otros", vehiculo: "Vehículos (no invertibles)" };
const dedupe = (as) => { const vistos = new Set(); return as.filter((a) => (vistos.has(a.tipo) ? false : vistos.add(a.tipo))); };

function Grid({ items }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
    {items.map(([l, v]) => <div key={l} style={{ background: C.bg, borderRadius: 8, padding: 10 }}><div style={{ color: C.tx2, fontSize: 11 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div></div>)}
  </div>;
}

function TablaSupuestos({ esc }) {
  const s = SUPUESTOS_F10, p = s.presets;
  const filas = [
    ["Inflación", fmtPctEs(esc.inflacionPct)],
    ["Renta fija corto", `inflación + ${fmtPctEs(p.rfCorto.realSpread)}`],
    ["Renta fija largo", `inflación + ${fmtPctEs(p.rfLargo.realSpread)} (tope + ${fmtPctEs(p.rfLargo.topeSpread)})`],
    ["Finca raíz", `renta neta ${fmtPctEs(p.fincaRaiz.rentaNetaPct)} + valorización = inflación`],
    ["S&P 500 (USD)", `${fmtPctEs(esc.spRealPct)} real; devaluación real ${fmtPctEs(p.sp500.devaluacionRealPct)}`],
    ["Vehículos", `${fmtPctEs(s.vehiculo.depAnios1a3Pct)} años 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} después`],
    ["Ingresos / gastos", `inflación + ${fmtPctEs(esc.ingresosSpread)} / + ${fmtPctEs(esc.gastosSpread)}`],
    ["Ajuste de retornos del escenario", fmtPctEs(esc.retornoSpread)],
    ["Colchón de liquidez", `${s.colchonMeses} meses de gastos`],
  ];
  return <table style={{ width: "100%", fontSize: 12, marginTop: 8 }}><tbody>{filas.map(([a, b]) => <tr key={a}><td style={{ color: C.tx2, padding: "3px 0" }}>{a}</td><td style={{ textAlign: "right" }}>{b}</td></tr>)}</tbody></table>;
}
