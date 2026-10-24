// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { fmtPctEs, fmtMilesEs, fmtPlataCortaEs } from "../lib/formato.js";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, cienMillones, valorizacionHintPct, rendimientoHintPct, validarMezcla, leerFuturos, migrarConfigF10, avisoRetornoAlto, estimadoPreset, resumenReinvertir, esCripto, pareceIngresoFuturo, tasaDeuda, leerObra, TIPOS_ACTIVO_FUTURO, TIPOS_OBRA } from "../lib/futuro10.js";
import { track } from "../lib/analytics";

const C = { bg: "#111827", bg2: "#1f2937", bd: "rgba(255,255,255,0.1)", tx: "#e5e7eb", tx2: "#9ca3af", gn: "#22c55e", rd: "#ef4444", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(34,197,94,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const PASOS = ["Hoy", "Decide", "Reinvierte", "Resultado", "Escenarios", "Cada inversión"];
const ANIOS_SEL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const plata = (v) => (Math.round(Number(v) || 0) < 0 ? "−$" : "$") + fmtMilesEs(Math.abs(Number(v) || 0));
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos generales que puedes ajustar en algunos pasos; no es una recomendación de inversión. No incluye impuestos.";

// Al guardar, un ingreso o activo futuro sin nombre queda «Ingreso futuro N» / «Activo futuro N».
export const conNombres = (cfg) => {
  const f = cfg.futuros || {};
  const pon = (arr = [], base) => arr.map((x, k) => (String(x.nombre || "").trim() ? x : { ...x, nombre: `${base} ${k + 1}` }));
  return { ...cfg, futuros: { ...f, ingresos: pon(f.ingresos, "Ingreso futuro"), activos: pon(f.activos, "Activo futuro") } };
};
const CONFIG_INICIAL = { version: 2, escenario: "base", decisiones: {}, activos: {}, deudas: {}, norte: "equilibrio", mezcla: null, nuevas: [], futuros: { ingresos: [], activos: [] } };
export const AUTOSAVE_MS = 1500;
export const SIN_PLATA_ANIO = "No tienes plata disponible este año; esta inversión queda como faltante.";
export const ESTADO_GUARDADO = { guardando: "Guardando…", listo: "Guardado hace un momento", offline: "Sin conexión, se guarda al volver" };
export const NOTA_SIMULADOR = "¿Por qué no coincide con el Simulador? Aquí cada activo sigue su propio supuesto, las deudas pagan interés, las ventas tienen año y todo se muestra en pesos de hoy. El Simulador usa un retorno único sobre tu patrimonio.";
export const AVISO_VENTAS = "Las ventas se toman por su valor bruto: no incluye costos de venta ni impuestos.";
const GRUPOS_ALERTA = [
  ["Plata que falta", ["nueva_sin_plata", "faltante", "cf_negativo", "exceso"]],
  ["Liquidez", ["liquidez_baja", "inversion_adicional", "pago_futuro"]],
  ["Revisa tus datos", ["tasa_estimada", "deuda_sin_saldo", "retorno_alto"]],
];
export function agruparAlertas(alertas = []) {
  const vistos = new Set();
  const d = alertas.filter((a) => { const k = a.tipo === "pago_futuro" || a.tipo === "inversion_adicional" || GRUPOS_ALERTA[2][1].includes(a.tipo) ? a.texto : a.tipo; return vistos.has(k) ? false : vistos.add(k); });
  return GRUPOS_ALERTA.map(([t, tipos]) => [t, d.filter((a) => tipos.includes(a.tipo))]).filter(([, xs]) => xs.length);
}

// 24-oct-2026 (Finanzas/Soporte, PR #56): ninguna cifra que dependa del dólar se muestra ni
// se guarda con la TRM provisional (4.200). Mientras carga: aviso en vez de cifras. Si la
// fuente falla: última tasa guardada, con su fecha a la vista.
export const MSG_CARGANDO_TRM = "Cargando tasa del dólar…";
const esUSD = (x) => String(x?.moneda || x?.currency || "").toUpperCase() === "USD";
export const usaDolar = (user = {}) => [...(user.inv || []), ...(user.deu || []), ...(user.ingresos || []), ...Object.values(user.gas || user.gastos || {}).flat()].some(esUSD);
export const textoTasaUsada = (tasa = {}) => `Tasa usada: ${plata(tasa.trm)}${tasa.fecha ? ` (${String(tasa.fecha).slice(0, 10)})` : ""}`;
/** tasa: { estado: "cargando" | "ok" | "respaldo", trm, fecha }. Sin prop → se asume lista (pruebas, usos viejos). */
export const tasaProvisional = (tasa) => !!tasa && tasa.estado === "cargando";

export const MSG_SIN_TASA = "No pudimos traer la tasa del dólar y no tienes una tasa guardada. Las cifras en dólares se mostrarán cuando la tasa esté disponible.";
/** Sin tasa real (ni la de hoy ni una guardada): nunca se calcula con el 4.200 por defecto. */
export const tasaSinDato = (tasa) => !!tasa && tasa.estado === "respaldo" && !(Number(tasa.trm) > 0);

// 24-oct-2026 (QA PR #56, faltante BTG no determinista): un monto se confirma al salir del
// campo (o con Enter). Mientras se teclea no cambia cfg: no se recalcula, no se guarda y no
// aparecen alertas con montos intermedios. El resultado es función pura del monto final.
export const EdicionF10 = createContext({ editando: false, marcar: () => {} });
export function MontoF10({ value, onChange, onKeyDown, ...p }) {
  const foco = useRef(false);
  const { marcar } = useContext(EdicionF10);
  const cambio = (v) => { if (foco.current) return; if (v !== value) onChange(v); };
  return (
    <span style={{ display: "contents" }}
      onFocusCapture={() => { foco.current = true; marcar(true); }}
      onBlurCapture={() => { foco.current = false; marcar(false); }}>
      <NumberInput {...p} value={value} onChange={cambio}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); onKeyDown && onKeyDown(e); }} />
    </span>
  );
}

export const MSG_DEMO_F10 = "En modo demo no se guardan escenarios.";

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0, demo = false, tasa = null }) {
  const provisional = tasaProvisional(tasa);
  const sinTasa = tasaSinDato(tasa) && usaDolar(user);
  const ocultarCifras = (provisional && usaDolar(user)) || sinTasa;
  const [editando, setEditando] = useState(false);
  const edicion = useMemo(() => ({ editando, marcar: setEditando }), [editando]);
  const provRef = useRef(provisional); provRef.current = provisional;
  const borrador = !demo && guardado?.borrador?.cfg ? guardado.borrador : null;
  const [paso, setPaso] = useState(borrador ? Math.min(PASOS.length - 1, Number(borrador.paso) || 0) : pasoInicial);
  const [cfg, setCfg] = useState(() => (borrador ? { ...CONFIG_INICIAL, ...migrarConfigF10(borrador.cfg, user) } : CONFIG_INICIAL));
  const [estadoGuardado, setEstadoGuardado] = useState(null);
  const ultimo = useRef({ guardado, onGuardar });
  ultimo.current = { guardado, onGuardar };
  const primera = useRef(true);
  const visto = useRef({ cfg: null, paso: null });
  // 24-oct-2026 (QA PR #56): quitar una inversión se guarda de inmediato, y si el
  // usuario sale de «Mi futuro» con un guardado pendiente, se escribe al desmontar.
  const urgente = useRef(false);
  const pendiente = useRef(null);
  const escribirAhora = () => {
    const { guardado: g, onGuardar: og } = ultimo.current;
    const b = pendiente.current; pendiente.current = null;
    if (!b || !og || provRef.current) { if (provRef.current) pendiente.current = b; return; }
    og({ ...g, borrador: { ...b, actualizado: new Date().toISOString() } });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("fp3-flush-save"));
  };
  useEffect(() => () => { if (pendiente.current && !provRef.current) escribirAhora(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (demo || !onGuardar) return undefined; // la demo nunca escribe
    if (primera.current) { primera.current = false; visto.current = { cfg, paso }; return undefined; }
    const sinCambios = visto.current.cfg === cfg && visto.current.paso === paso; visto.current = { cfg, paso };
    if (provisional) { if (!sinCambios) pendiente.current = { cfg, paso }; return undefined; } // con TRM provisional no se guarda; se guarda al llegar la tasa
    if (sinCambios && !pendiente.current) return undefined; // solo cambió el estado de la tasa
    pendiente.current = { cfg, paso };
    if (urgente.current) { urgente.current = false; escribirAhora(); setEstadoGuardado("listo"); return undefined; }
    setEstadoGuardado("guardando");
    const escribir = () => {
      const { guardado: g, onGuardar: og } = ultimo.current;
      pendiente.current = null;
      og && og({ ...g, borrador: { cfg, paso, actualizado: new Date().toISOString() } });
      setEstadoGuardado("listo");
    };
    let quitar = () => {};
    const id = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setEstadoGuardado("offline");
        const alVolver = () => { window.removeEventListener("online", alVolver); escribir(); };
        window.addEventListener("online", alVolver);
        quitar = () => window.removeEventListener("online", alVolver);
      } else escribir();
    }, AUTOSAVE_MS);
    return () => { clearTimeout(id); quitar(); };
  }, [cfg, paso, demo, provisional]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mercado, setMercado] = useState(null);
  useEffect(() => {
    if (typeof fetch === "undefined") return;
    let vivo = true;
    fetch("/api/datos-mercado").then((x) => (x.ok ? x.json() : null)).then((j) => { if (vivo && j) setMercado(j); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const [nombreEsc, setNombreEsc] = useState("");
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  // Se calcula una sola vez con la tasa final: con TRM provisional y datos en dólares no se calcula.
  const r = useMemo(() => (ocultarCifras ? null : proyectarFuturo10(user, cfg)), [user, cfg, ocultarCifras]);
  const esc = r?.escenario;
  const escenarios = guardado.escenarios || [];
  const mezcla = cfg.mezcla || SUPUESTOS_F10.nortes[cfg.norte] || SUPUESTOS_F10.nortes.equilibrio;
  const ir = (i) => { setPaso(i); track("futuro10_paso", { paso: i + 1 }); };
  const bolsa = (user.inv || []).filter((a) => cfg.decisiones[a.id]?.accion === "vende").length;

  const guardar = () => {
    if (demo || provisional) return; // la demo nunca escribe; con TRM provisional tampoco
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `Escenario ${escenarios.length + 1}`, creado: new Date().toISOString(), config: { ...conNombres(cfg), version: 2 } };
    onGuardar && onGuardar({ ...guardado, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, escenarios: escenarios.filter((e) => e.id !== id) });

  if (ocultarCifras) return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label="Mi futuro a 10 años" title="¿Cómo se ve tu patrimonio en 10 años?" compact subtitle="Tienes datos en dólares: esperamos la tasa del día para calcular." />
      {sinTasa
        ? <div role="note" data-testid="f10-sin-tasa" style={{ ...card, fontSize: 13, color: C.tx2 }}>{MSG_SIN_TASA}</div>
        : <div role="status" data-testid="f10-cargando-trm" style={{ ...card, fontSize: 13, color: C.tx2 }}>{MSG_CARGANDO_TRM}</div>}
    </div>
  );

  return (<EdicionF10.Provider value={edicion}>
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label="Mi futuro a 10 años" title="¿Cómo se ve tu patrimonio en 10 años?" compact
        subtitle="Decide qué hacer con cada activo, reinvierte y mira el resultado en pesos de hoy. Tus datos reales no se tocan." />
      <div style={{ ...card, borderColor: C.am, fontSize: 12, color: C.tx2 }}>{AVISO_F10}</div>
      {tasa?.estado === "respaldo" && usaDolar(user) && <div role="note" data-testid="f10-tasa-usada" style={{ ...card, fontSize: 12, color: C.tx2 }}>{textoTasaUsada(tasa)}. No pudimos traer la tasa de hoy; usamos la última guardada.</div>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>Escenario:</span>
        {Object.entries(SUPUESTOS_F10.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{e.nombre}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>inflación {fmtPctEs(esc.inflacionPct)}</span>
        {!demo && estadoGuardado && <span role="status" style={{ marginLeft: "auto", fontSize: 12, color: estadoGuardado === "offline" ? C.am : C.tx2 }}>{ESTADO_GUARDADO[estadoGuardado]}</span>}
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
            ["Colchón (igual que en Patrimonio)", plata(r.metaColchon)],
          ]} />
          <p style={{ color: C.tx2, fontSize: 12 }}>Tus activos. El % es solo la valorización anual; la renta va aparte.</p>
          {(user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
            const info = r.activos.find((x) => x.id === a.id) || {};
            const pr = (cfg.activos || {})[a.id] || {};
            const setP = (v) => set("activos", { ...(cfg.activos || {}), [a.id]: { ...pr, ...v } });
            const hint = valorizacionHintPct(a, esc);
            const aviso = avisoRetornoAlto(pr.rendimientoPct, esc);
            const veh = info.clase === "vehiculo";
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
                <div><b>{a.n || a.nombre}</b><div style={{ color: C.tx2, fontSize: 12 }}>{ETQ[info.clase] || "Otros"} · {plata(a.va)}{info.usd ? " USD" : ""}</div></div>
                <label style={{ fontSize: 12, color: C.tx2 }}>Valorización anual (%)
                  {veh ? <div style={{ color: C.tx, fontSize: 13 }}>{fmtPctEs(SUPUESTOS_F10.vehiculo.depAnios1a3Pct)} años 1–3, {fmtPctEs(SUPUESTOS_F10.vehiculo.depDespuesPct)} después</div>
                    : <CampoRendimiento estimado={hint} value={pr.rendimientoPct} onChange={(v) => setP({ rendimientoPct: v })} fuente={fuenteClase(info.clase)}
                        nota={info.clase === "otro" ? "0% real: sin supuesto de valorización, ajústalo." : null} cripto={esCripto(a)} />}
                  {veh && <span style={{ fontSize: 11 }}>{SUPUESTOS_F10.fuentes.vehiculo}</span>}
                  {aviso && <span role="alert" style={{ display: "block", fontSize: 11, color: C.am }}>{aviso}</span>}</label>
                {info.rentaMensual > 0 && <div style={{ fontSize: 12, color: C.tx2 }}>Renta neta {plata(info.rentaMensual)}/mes
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {[["retira", "La retiras"], ["reinvierte", "Se reinvierte"]].map(([k, l]) => <button key={k} style={btn((pr.renta || "retira") === k)} onClick={() => setP({ renta: k })}>{l}</button>)}
                  </div>
                  <span style={{ fontSize: 11 }}>{(pr.renta || "retira") === "retira" ? "Entra a tu flujo de caja." : "Se suma al valor del activo."}</span></div>}
              </div>
            );
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
            const lbl = { display: "block", fontSize: 12, color: C.tx2 };
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{a.n || a.nombre}</b><span style={{ color: C.tx2 }}>{plata(a.va)}{String(a.moneda).toUpperCase() === "USD" ? " USD" : ""}</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {[["continua", "Continúa"], ["vende", "Vender"], ["construye", "Construir o mejorar"]].map(([k, l]) => <button key={k} style={btn((d.accion || "continua") === k)} onClick={() => setD({ accion: k })}>{l}</button>)}
                </div>
                {d.accion === "vende" && <div style={{ marginTop: 6, maxWidth: 220 }}><label style={lbl}>¿En qué año lo vendes?
                  <select style={inp} value={d.anioVenta || 1} onChange={(e) => setD({ anioVenta: Number(e.target.value) })}>{ANIOS_SEL.map((y) => <option key={y} value={y}>Año {y}{y === 1 ? " (hoy)" : ""}</option>)}</select>
                  <span style={{ fontSize: 11 }}>Desde ese año sale su renta y sus gastos. {AVISO_VENTAS}</span></label></div>}
                {d.accion === "construye" && <Obra a={a} d={d} setD={setD} />}
              </div>
            );
          })}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que vendes va a una bolsa para reinvertir ({bolsa} activo{bolsa === 1 ? "" : "s"}). Primero se completa tu colchón de {plata(r.metaColchon)}.</p>
          <Deudas user={user} cfg={cfg} set={set} />
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} />
        </div>
      )}

      {paso === 2 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Reinvierte</h3>
          <BarraReinvertir disponible={r.disponible} />
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
              <select style={inp} value={x.preset} onChange={(e) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, preset: e.target.value, rendimientoNomPct: "" } : y))}>
                {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                <option value="custom">Otra (personalizada)</option>
              </select>
              <MontoF10 allowDecimals={false} style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              {x.preset !== "custom" && <RendimientoPreset x={x} esc={esc} up={(v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y))} />}
              {x.preset === "custom" && (() => {
                const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y));
                const hint = rendimientoHintPct(esc);
                const lbl = { fontSize: 12, color: C.tx2 };
                return (<>
                  <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder="Ej.: negocio, CDT, finca" /></label>
                  <label style={lbl}>¿En qué año?<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                  <CampoRendimiento estimado={hint} value={x.rendimientoNomPct} onChange={(v) => up({ rendimientoNomPct: v })} />
                  <label style={lbl}>Moneda<select style={inp} value={x.moneda || "COP"} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>
                    {x.moneda === "USD" && <span style={{ fontSize: 11, color: C.am }}>En dólares, el resultado en pesos también depende de cómo se mueva la tasa de cambio.</span>}</label>
                  <label style={lbl}>¿Cómo te da plata?<select style={inp} value={x.tipo || "valoriza"} onChange={(e) => up({ tipo: e.target.value })}><option value="renta">Paga renta (te entra al flujo)</option><option value="valoriza">Solo se valoriza (crece el valor)</option></select></label>
                </>);
              })()}
              <button style={btn(false)} onClick={() => { urgente.current = true; set("nuevas", cfg.nuevas.filter((_, j) => j !== i)); }}>Quitar</button>
              {(() => { const dd = r.disponible[Math.min(10, Math.max(1, Number(x.anio) || 1)) - 1]; return !editando && Number(x.monto) > 0 && dd && dd.antesDeAsignar <= 0 ? <div role="alert" style={{ gridColumn: "1 / -1", color: C.rd, fontSize: 12 }}>{SIN_PLATA_ANIO}</div> : null; })()}
              <AlertaExceso disponible={r.disponible} tipo="nueva" idx={i} />
            </div>
          ))}
          <button style={btn(false)} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "" }])}>+ Crear inversión</button>
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que no asignes a mano se reparte según el norte.</p>
        </div>
      )}

      {paso === 3 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Resultado a 10 años</h3>
          <Grid items={[
            ["Patrimonio en pesos de hoy", plata(r.final.patrimonioReal)],
            ["Renta pasiva/mes en el año 10 (pesos de hoy)", plata(r.final.rentaPasivaReal / 12)],
            ["Patrimonio nominal", plata(r.final.patrimonio)],
          ]} />
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
              <thead><tr style={{ color: C.tx2, textAlign: "right" }}><th style={{ textAlign: "left" }}>Año</th><th>Ingreso/mes*</th><th>Renta pasiva/mes*</th><th>Gasto/mes*</th><th>Patrimonio (hoy)*</th><th>Nominal</th></tr></thead>
              <tbody>{r.filas.slice(1).map((f) => (
                <tr key={f.anio} style={{ textAlign: "right", borderTop: `1px solid ${C.bd}`, color: f.cf < 0 ? C.rd : C.tx }}>
                  <td style={{ textAlign: "left" }}>{f.anio}</td><td>{fmtPlataCortaEs(f.ingresosReal / 12)}</td><td>{fmtPlataCortaEs(f.rentaPasivaReal / 12)}</td><td>{fmtPlataCortaEs(f.gastosReal / 12)}</td><td>{fmtPlataCortaEs(f.patrimonioReal)}</td><td style={{ color: C.tx2 }}>{fmtPlataCortaEs(f.patrimonio)}</td>
                </tr>))}</tbody>
            </table>
            <div style={{ color: C.tx2, fontSize: 11 }}>* En pesos de hoy (se descuenta la inflación una sola vez). La columna nominal es en pesos de cada año.</div>
          </div>
          <InversionesNuevas items={r.nuevasDetalle} />
          {agruparAlertas(r.alertas).map(([titulo, xs]) => (
            <div key={titulo} style={{ ...card, borderColor: titulo === "Plata que falta" ? C.rd : C.am, marginTop: 10 }}>
              <b style={{ color: titulo === "Plata que falta" ? C.rd : C.am }}>{titulo}</b>
              {xs.map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.texto}</div>)}
            </div>))}
          {r.hayVentas && <p style={{ color: C.tx2, fontSize: 12 }}>{AVISO_VENTAS}</p>}
          {!r.hayUSD && r.usdPorNorte && <p style={{ color: C.tx2, fontSize: 12 }}>Parte de lo que se reparte según el norte va a S&amp;P 500, que está en dólares.</p>}
          {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. El escenario {esc.nombre.toLowerCase()} supone devaluación real de {fmtPctEs(esc.devaluacionRealPct)}.</p>}
          <label style={{ fontSize: 12, color: C.tx2, display: "block", maxWidth: 260 }}>Devaluación real anual (%)
            <InputDecimalEs style={inp} placeholder={fmtPctEs(esc.devaluacionRealPct)} value={cfg.devaluacionRealPct ?? ""} onChange={(v) => set("devaluacionRealPct", v)} /></label>
          <p style={{ color: C.tx2, fontSize: 12 }}>{NOTA_SIMULADOR}</p>
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
                    <td><button style={btn(false)} onClick={() => { setCfg({ ...CONFIG_INICIAL, ...migrarConfigF10(e.config, user) }); ir(3); }}>Ver</button> <button style={btn(false)} onClick={() => borrar(e.id)}>Borrar</button></td>
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
        <p style={{ color: C.tx2, fontSize: 12 }}>Puedes cambiar el escenario arriba, la valorización de cada activo en el paso 1, las deudas en el paso 2 y la mezcla o el rendimiento de una inversión personalizada en el paso 3.</p>
        <TablaSupuestos esc={esc} mercado={mercado} />
      </details>
    </div>
  </EdicionF10.Provider>);
}


const fuenteClase = (cl) => ({ inmueble: SUPUESTOS_F10.fuentes.fincaRaiz, liquido: SUPUESTOS_F10.fuentes.rfCorto, acciones: SUPUESTOS_F10.fuentes.sp500 }[cl] || "solo inflación, sin supuesto propio");

// «Construir o mejorar»: inversión por año, año en que queda lista, renta desde ahí, valor final y tipo.
export function Obra({ a, d, setD }) {
  const o = { inversiones: [{ monto: "", anio: 1 }], anioLista: "", rentaMensual: "", renta: "retira", valorFinal: "", tipoNuevo: "", ...(d.obra || {}) };
  const up = (v) => setD({ obra: { ...o, ...v } });
  const L = leerObra(o);
  const sugerido = Number(a.va || 0) + L.inversiones.reduce((s, x) => s + x.monto, 0);
  const lbl = { display: "block", fontSize: 12, color: C.tx2 };
  return (
    <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8 }}>
      {o.inversiones.map((iv, k) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 4 }}>
          <label style={lbl}>Monto en pesos de hoy<MontoF10 allowDecimals={false} style={inp} placeholder="0" value={iv.monto ?? ""} onChange={(v) => up({ inversiones: o.inversiones.map((x, j) => (j === k ? { ...x, monto: v } : x)) })} /></label>
          <label style={lbl}>Año<select style={inp} value={iv.anio || 1} onChange={(e) => up({ inversiones: o.inversiones.map((x, j) => (j === k ? { ...x, anio: Number(e.target.value) } : x)) })}>{ANIOS_SEL.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        </div>))}
      <div style={{ display: "flex", alignItems: "end", gap: 6 }}>
        <button style={btn(false)} onClick={() => up({ inversiones: [...o.inversiones, { monto: "", anio: Math.min(10, (o.inversiones.at(-1)?.anio || 1) + 1) }] })}>+ Otro año</button>
        {o.inversiones.length > 1 && <button style={btn(false)} onClick={() => up({ inversiones: o.inversiones.slice(0, -1) })}>Quitar año</button>}
      </div>
      <label style={lbl}>¿En qué año queda lista?<select style={inp} value={L.anioLista} onChange={(e) => up({ anioLista: Number(e.target.value) })}>{ANIOS_SEL.map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
      <label style={lbl}>Renta neta al mes desde ese año ($, pesos de hoy)<MontoF10 allowDecimals={false} style={inp} placeholder="0" value={o.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>
      {L.rentaMensual > 0 && <div style={lbl}>Esa renta…<div style={{ display: "flex", gap: 6, marginTop: 4 }}>{[["retira", "La retiras"], ["reinvierte", "Se reinvierte"]].map(([k, l]) => <button key={k} style={btn(L.renta === k)} onClick={() => up({ renta: k })}>{l}</button>)}</div></div>}
      <label style={lbl}>Valor estimado cuando quede lista ($, pesos de hoy)<MontoF10 allowDecimals={false} style={inp} placeholder={plata(sugerido)} value={o.valorFinal ?? ""} onChange={(v) => up({ valorFinal: v })} />
        <span style={{ fontSize: 11 }}>Si no sabes, déjalo vacío: valor de hoy + lo que inviertes ({plata(sugerido)}).</span></label>
      <label style={lbl}>¿Cambia el tipo de activo?<select style={inp} value={o.tipoNuevo || ""} onChange={(e) => up({ tipoNuevo: e.target.value })}>{TIPOS_OBRA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <span style={{ fontSize: 11 }}>Por ejemplo, un lote que se vuelve bodega o local.</span></label>
      <span style={{ gridColumn: "1 / -1", fontSize: 11, color: C.tx2 }}>La inversión sale de tu plata disponible y se suma al valor del activo.</span>
    </div>
  );
}

// Deudas: tasa (si falta, la promedio publicada) y «¿En UVR?».
function Deudas({ user, cfg, set }) {
  const ds = (user.deu || []).filter((d) => d && (Number(d.mt) > 0 || Number(d.pg ?? d.pago) > 0));
  if (!ds.length) return null;
  const lbl = { display: "block", fontSize: 12, color: C.tx2 };
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "8px 0" }}>Tus deudas</h4>
      <p style={{ color: C.tx2, fontSize: 12 }}>La cuota es fija en pesos. Si tu crédito está en UVR, la cuota sube con la inflación.</p>
      {ds.map((d) => {
        const ov = (cfg.deudas || {})[d.id] || {};
        const t = tasaDeuda(d, ov);
        const setO = (v) => set("deudas", { ...(cfg.deudas || {}), [d.id]: { ...ov, ...v } });
        return (
          <div key={d.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 8 }}>
            <div><b>{d.n || d.nombre || "Deuda"}</b><div style={{ color: C.tx2, fontSize: 12 }}>Saldo {plata(d.mt)} · cuota {plata(d.pg ?? d.pago)}/mes</div>
              {!(Number(d.mt) > 0) && <div style={{ color: C.am, fontSize: 11 }}>Agrega el saldo: por ahora la cuota se mantiene los 10 años.</div>}</div>
            <label style={lbl}>{ov.uvr ? "Tasa real sobre UVR (%)" : "Tasa anual E.A. (%)"}<InputDecimalEs style={inp} placeholder={fmtPctEs(t.pct)} value={ov.tasaPct ?? (Number(d.ts) > 0 ? d.ts : "")} onChange={(v) => setO({ tasaPct: v })} />
              {t.estimada && <span style={{ fontSize: 11, color: C.am }}>Tasa estimada, agrégala. Usamos {t.real ? `UVR + ${fmtPctEs(t.pct)} (Superfinanciera, promedio No VIS en UVR, ${t.fecha}). Es un promedio, no tu tasa.` : `${fmtPctEs(t.pct)} E.A. Fuente: ${t.fuente}, ${t.fecha}. Es un promedio, no tu tasa.`}</span>}
              {!t.estimada && t.real && <span style={{ fontSize: 11, color: C.tx2 }}>En UVR: escribe la tasa real (la que va sobre la UVR).</span>}</label>
            <label style={{ ...lbl, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!ov.uvr} onChange={(e) => setO({ uvr: e.target.checked })} /> ¿En UVR?</label>
          </div>);
      })}
    </div>
  );
}

const ANIOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export function LoQueViene({ cfg, set, esc, owners }) {
  const f = { ingresos: [], activos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const lbl = { fontSize: 12, color: C.tx2 };
  const g = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.bd}` };
  const selAnio = (v, on, vacioTxt) => <select style={inp} value={v ?? ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}>{vacioTxt && <option value="">{vacioTxt}</option>}{ANIOS.map((y) => <option key={y} value={y}>Año {y}</option>)}</select>;
  const hintVal = (cl) => {
    const a = leerFuturos({ activos: [{ clase: cl, valor: 1, entrega: 1 }] }, esc).activos[0];
    return a.crec == null ? `${fmtPctEs(SUPUESTOS_F10.vehiculo.depAnios1a3Pct)} (años 1–3)` : fmtPctEs(a.crec * 100, 1);
  };
  const moverAIngresos = (i) => {
    const x = f.activos[i];
    set("futuros", { ...f, activos: f.activos.filter((_, j) => j !== i), ingresos: [...f.ingresos, { nombre: x.nombre || "Pensión", mensual: x.rentaMensual || "", desde: x.rentaDesde || x.entrega || 1, hasta: "" }] });
  };
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "8px 0" }}>Lo que viene</h4>
      <p style={{ color: C.tx2, fontSize: 12 }}>Lo que empieza más adelante. Primero los ingresos, después los activos.</p>
      <div style={{ ...card, background: C.bg, borderColor: C.gn, marginBottom: 8 }}>
      <b style={{ fontSize: 15 }}>Ingresos futuros</b>
      <p style={{ color: C.tx2, fontSize: 12, margin: "4px 0" }}>Plata que te va a entrar cada mes y que no compras: una pensión, un arriendo con contrato firmado, un salario futuro. Si es algo que compras o pagas (un apartamento, un local), va en Activos futuros.</p>
      {f.ingresos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder={`Ingreso futuro ${i + 1}`} onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Al mes ($, pesos de hoy)<MontoF10 allowDecimals={false} style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            <span style={{ fontSize: 11 }}>Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. {x.fijo ? "Monto fijo: no sube con la inflación." : "Sube con la inflación."}</span></label>
          <label style={{ ...lbl, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={!!x.fijo} onChange={(e) => upI(i, { fijo: e.target.checked })} /> Monto fijo en pesos</label>
          <label style={lbl}>Empieza{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          <label style={lbl}>Termina (opcional){selAnio(x.hasta, (v) => upI(i, { hasta: v }), "Sigue")}</label>
          {owners.length > 1 && <label style={lbl}>Titular (opcional)<select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select></label>}
          <button style={btn(false)} onClick={() => put("ingresos", f.ingresos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={btn(false)} onClick={() => put("ingresos", [...f.ingresos, { nombre: "", mensual: "", desde: 1, hasta: "" }])}>+ Ingreso futuro</button>
      </div>
      <div style={{ marginTop: 10 }}><b style={{ fontSize: 13 }}>Activos futuros</b></div>
      <p style={{ color: C.tx2, fontSize: 12, margin: "4px 0" }}>Algo que compras o te entregan más adelante: un apartamento sobre planos, un local, un lote.</p>
      {f.activos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder={`Activo futuro ${i + 1}`} onChange={(e) => upA(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Tipo<select style={inp} value={x.clase || "inmueble"} onChange={(e) => upA(i, { clase: e.target.value })}>{TIPOS_ACTIVO_FUTURO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {pareceIngresoFuturo(x.nombre) && <div role="note" style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>Una pensión es un ingreso, no un activo. <button style={btn(false)} onClick={() => moverAIngresos(i)}>Mover a Ingresos futuros</button></div>}
          <label style={lbl}>Valor total ($)<MontoF10 allowDecimals={false} style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} /></label>
          <label style={lbl}>Cuota inicial ($)<MontoF10 allowDecimals={false} style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} /></label>
          <label style={lbl}>Año de la cuota inicial{selAnio(x.anioCuota || 1, (v) => upA(i, { anioCuota: v || 1 }))}</label>
          <label style={lbl}>Año de entrega{selAnio(x.entrega || 1, (v) => upA(i, { entrega: v || 1 }))}
            <span style={{ fontSize: 11 }}>El resto se paga en la entrega. Los pagos salen de tu liquidez; desde la entrega se valoriza.</span></label>
          <label style={lbl}>Renta neta al mes ($, pesos de hoy, opcional)<MontoF10 allowDecimals={false} style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} /></label>
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
/** Inversión predefinida: % nominal estimado (editable) con su fuente; «restaurar estimado» si lo cambiaste. */
export function RendimientoPreset({ x, esc, up }) {
  const e = estimadoPreset(x.preset, esc);
  if (!e) return null;
  return <CampoRendimiento estimado={e.pct} value={x.rendimientoNomPct} onChange={(v) => up({ rendimientoNomPct: v })} fuente={e.fuente} esc={esc} />;
}

const editadoOk = (v) => v !== "" && v != null && Number.isFinite(Number(v));
/** Rendimiento anual prellenado con el estimado (nunca vacío ni NaN), editable, con fuente y «restaurar estimado». */
export function CampoRendimiento({ estimado, value, onChange, fuente, nota = null, cripto = false, esc = null }) {
  const est = Math.round(Number(estimado) * 10) / 10;
  const ed = editadoOk(value);
  const efectivo = ed ? Number(value) : est;
  return (
    <label style={{ fontSize: 12, color: C.tx2, display: "block" }}>Rendimiento anual (%)
      <InputDecimalEs style={inp} value={efectivo} onChange={(v) => onChange(editadoOk(v) ? v : "")} />
      <span style={{ display: "block", fontSize: 12, color: C.tx }}>{fmtPctEs(efectivo, 1)} anual antes de impuestos</span>
      {!ed && <span style={{ display: "block", fontSize: 11 }}>Estimado. Si tienes una tasa real, ponla.</span>}
      {nota && <span style={{ display: "block", fontSize: 11, color: C.am }}>{nota}</span>}
      {cripto && <span style={{ display: "block", fontSize: 11, color: C.am }}>Bitcoin y otras criptomonedas son muy volátiles: pueden caer más de 50% en un año. No sugerimos un rendimiento.</span>}
      {fuente && <span style={{ display: "block", fontSize: 11 }}>Fuente: {fuente}.</span>}
      {ed && <button type="button" onClick={() => onChange("")} style={{ background: "none", border: 0, padding: 0, color: C.gn, textDecoration: "underline", cursor: "pointer", fontSize: 11 }}>restaurar estimado ({fmtPctEs(est, 1)})</button>}
      {esc && ed && avisoRetornoAlto(value, esc) && <span style={{ display: "block", fontSize: 11, color: C.am }}>Supuesto alto, revisa.</span>}
    </label>
  );
}

/** Barra fija arriba en «Reinvierte»: se actualiza en vivo (10 años, pesos de hoy). */
export function BarraReinvertir({ disponible = [] }) {
  const b = resumenReinvertir(disponible);
  const it = (t, v, color = C.tx, sub = null) => (<div style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: C.tx2 }}>{t}</div><div style={{ fontSize: 17, fontWeight: 700, color }}>{plata(v)}</div>{sub && <div style={{ fontSize: 11, color: C.tx2 }}>{sub}</div>}</div>);
  const frase = (t, color, sub = null) => (<div style={{ minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 700, color }}>{t}</div>{sub && <div style={{ fontSize: 11, color: C.tx2 }}>{sub}</div>}</div>);
  return (
    <div role="status" aria-live="polite" style={{ position: "sticky", top: 0, zIndex: 5, background: C.bg2, border: `1px solid ${b.faltan > 0 ? C.rd : C.bd}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 8 }}>
      {frase(`Tienes ${plata(b.disponible)} para invertir`, b.disponible <= 0 ? C.rd : C.tx, `${plata(b.deVentas)} de ventas · ${plata(b.deCaja)} de tu caja${b.comprometido > 0 ? ` · −${plata(b.comprometido)} comprometido en el paso 2` : ""}`)}
      {it("Ya asignado", b.asignado)}
      {b.faltan > 0 ? frase(`Te faltan ${plata(b.faltan)}`, C.rd, "Lo que no alcanza en el año de cada inversión. Mismo número que en Resultado.") : frase(`Te queda ${plata(b.queda)}`, C.gn)}
      <div style={{ gridColumn: "1 / -1", fontSize: 11, color: C.tx2 }}>10 años, en pesos de hoy. Caja = liquidez por encima del colchón + lo que te sobra cada año. Las ventas van por su valor bruto: no incluye costos de venta ni impuestos.</div>
    </div>
  );
}

/** Resultado: cada inversión nueva con su línea, su renta y su valor a 10 años. */
/** Alerta junto a la inversión nueva con faltante (criterio Finanzas #56). */
export const textoFaltanteNueva = (x) => `Faltan ${plata(x.faltante)} para ${x.nombre}. Quedaron invertidos ${plata(Math.max(0, x.invertido ?? 0))}${x.anio > 1 ? ` (pesos del año ${x.anio})` : ""}` +
  (x.rentaMensual > 0 ? `; esa parte renta ${plata(x.rentaMensualFondeada)}/mes.` : ".");
export function InversionesNuevas({ items = [] }) {
  const { editando } = useContext(EdicionF10);
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <h4 style={{ margin: "8px 0" }}>Tus inversiones nuevas</h4>
      {items.map((x) => (
        <div key={x.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "6px 0", fontSize: 12 }}>
          <b>{x.nombre}</b> · {plata(x.monto)} en el año {x.anio}{Number.isFinite(x.rendimientoPct) ? ` · ${fmtPctEs(x.rendimientoPct, 1)} anual` : ""}{x.usd ? " · USD" : ""}
          <div style={{ color: C.tx2 }}>{x.rentaMensual > 0 ? `Renta ${plata(x.rentaMensual)}/mes en pesos del año ${x.anio} · ` : ""}Valor a 10 años {plata(x.valorFinal)} en pesos de hoy</div>
          {!editando && x.faltante > 0 && <div role="alert" style={{ color: C.rd }}>{textoFaltanteNueva(x)}</div>}
        </div>))}
    </div>
  );
}

export function AlertaExceso({ disponible = [], tipo, idx }) {
  const { editando } = useContext(EdicionF10);
  if (editando) return null;
  const d = disponible.find((x) => x.exceso > 0 && x.asignaciones.some((a) => a.tipo === tipo && a.idx === idx));
  return d ? <div role="alert" style={{ ...alertaSt, gridColumn: "1 / -1" }}>{textoExceso(d)}</div> : null;
}

// «Plata disponible para invertir»: números del motor, en pesos de hoy.
export function PlataDisponible({ disponible = [] }) {
  const [abierto, setAbierto] = useState(false);
  const { editando } = useContext(EdicionF10);
  const d1 = disponible[0];
  if (!d1) return null;
  const lineas = (d) => [
    ["Liquidez hoy por encima del colchón", d.liquidezHoy, d.anio === 1],
    ["+ Ventas del paso 2", d.ventas, d.ventas > 0],
    ["− Para completar el colchón", -d.colchon, d.colchon > 0],
    [d.flujo >= 0 ? "+ Flujo libre del año" : "− Te falta en el flujo del año", d.flujo, true],
    ["− Construir o mejorar", -d.adicionales, d.adicionales > 0],
    ["− Pagos de activos futuros", -d.pagosFuturos, d.pagosFuturos > 0],
    ["− Asignado a mano (inversiones nuevas)", -d.asignado, d.asignado > 0],
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
      {!editando && excesos.map((d) => <div key={d.anio} role="alert" style={{ ...alertaSt, marginTop: 6 }}>{textoExceso(d)}</div>)}
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

// Solo referencia en la tabla: NUNCA entra a la proyección (la proyección usa la inflación del escenario).
export const IPC_MANUAL = { pct: 6.29, fuente: "DANE, IPC anual", fecha: "sep-2026", manual: true };
export function TablaSupuestos({ esc, mercado = null }) {
  const s = SUPUESTOS_F10, p = s.presets, F = s.fuentes;
  const ipc = mercado?.ipc?.pct > 0 ? mercado.ipc : IPC_MANUAL;
  const filas = [
    ["IPC observado (referencia)", `${fmtPctEs(ipc.pct)} anual`, `${ipc.fuente}, ${ipc.fecha || "sin fecha"}${ipc.manual ? ` (valor manual del ${ipc.fecha}; no hubo respuesta en vivo; no se usa en la proyección)` : " (no se usa en la proyección)"}`],
    ["Inflación proyectada", `${fmtPctEs(esc.inflacionPct)} al año`, F.inflacion],
    ["Renta fija corto", `inflación + ${fmtPctEs(p.rfCorto.realSpread + esc.retornoSpread)} ≈ ${fmtPctEs(retornoNominalPreset("rfCorto", esc))} al año`, F.rfCorto],
    ["Renta fija largo", `inflación + ${fmtPctEs(p.rfLargo.realSpread)} (tope + ${fmtPctEs(p.rfLargo.topeSpread)})`, F.rfLargo],
    ["Finca raíz", `renta neta ${fmtPctEs(p.fincaRaiz.rentaNetaPct)}; valorización = inflación − ${fmtPctEs(-p.fincaRaiz.valorizacionSpread)}`, F.fincaRaiz],
    ["S&P 500 (USD)", `${fmtPctEs(esc.spRealPct)} real, promedio largo plazo ajustado a valuaciones actuales`, F.sp500],
    ["Devaluación real", `${fmtPctEs(esc.devaluacionRealPct)} al año (editable en Resultado)`, F.devaluacion],
    ["Vehículos", `${fmtPctEs(s.vehiculo.depAnios1a3Pct)} años 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} después`, F.vehiculo],
    ["Ingresos / gastos", `inflación + ${fmtPctEs(esc.ingresosSpread)} / + ${fmtPctEs(esc.gastosSpread)}`, "Supuesto del escenario"],
    ["Deudas sin tasa", Object.values(s.tasasDeuda).map((t) => fmtPctEs(t.pct)).join(" · ") + " (hipotecario · vehículo · consumo · tarjeta)", s.tasasDeuda.hipotecario.fuente],
    ["Colchón de liquidez", `Metas › Fondo de emergencia, o ${s.colchonMeses} meses de gastos + cuotas`, F.colchon],
  ];
  return <div style={{ fontSize: 12, marginTop: 8 }}>{filas.map(([a, b, f]) => (
    <div key={a} style={{ padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 8px" }}>
        <span style={{ color: C.tx2 }}>{a}</span><span style={{ textAlign: "right", overflowWrap: "anywhere", minWidth: 0 }}>{b}</span></div>
      <div style={{ color: C.tx2, fontSize: 11 }}>Fuente: {f}</div>
    </div>))}</div>;
}
