// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { fmtPctEs, fmtMilesEs, fmtPlataCortaEs } from "../lib/formato.js";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, rendimientoHintPct, validarMezcla, leerFuturos, migrarModifica, resumenEscenario, sugerirVinculados, inversionesHoy, ingresosSueltosHoy } from "../lib/futuro10.js";
import { track } from "../lib/analytics";
import PlanInforme from "./PlanInforme";
import PlanComparador from "./PlanComparador";

const C = { bg: "#111827", bg2: "#1f2937", bd: "rgba(255,255,255,0.1)", tx: "#e5e7eb", tx2: "#9ca3af", gn: "#22c55e", rd: "#ef4444", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(34,197,94,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const PASOS = ["Hoy", "Decide", "Tu plata", "Resultado", "Escenarios"];
const plata = (v) => "$" + fmtMilesEs(v);
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos generales que puedes ajustar en algunos pasos; no es una recomendación de inversión. No incluye impuestos.";

const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [], gastos: [] } };

export const MSG_DEMO_F10 = "En modo demo no se guardan escenarios.";

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0, demo = false }) {
  const [paso, setPaso] = useState(pasoInicial);
  // 24-oct-2026 (Santiago: "los avances que uno hace en la sección como que
  // no quedan guardados"). Lo que uno va decidiendo se guarda solo como
  // borrador (`futuro10.borrador`) y vuelve al entrar; "Guardar en tu cuenta"
  // sigue siendo para dejar un escenario con nombre y compararlo.
  const [cfg, setCfg] = useState(() => migrarModifica(guardado.borrador ? { ...CONFIG_INICIAL, ...guardado.borrador } : CONFIG_INICIAL));
  const ultimoGuardado = useRef(JSON.stringify(guardado.borrador || null));
  useEffect(() => {
    if (demo || !onGuardar) return;
    const json = JSON.stringify(cfg);
    if (json === ultimoGuardado.current || json === JSON.stringify(CONFIG_INICIAL)) return;
    const t = setTimeout(() => { ultimoGuardado.current = json; onGuardar({ ...guardado, borrador: cfg }); }, 600);
    return () => clearTimeout(t);
  }, [cfg, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nombreEsc, setNombreEsc] = useState("");
  // 24-oct-2026 (Santiago: "una vez creado el escenario no deja cambiar el
  // nombre"). Al tocar Editar se carga su nombre y resumen, y se guarda sobre
  // el mismo escenario (o como uno nuevo).
  const [editandoId, setEditandoId] = useState(null);
  const [descEsc, setDescEsc] = useState("");
  const [verEsc, setVerEsc] = useState(null);
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => proyectarFuturo10(user, cfg), [user, cfg]);
  const esc = r.escenario;
  const escenarios = guardado.escenarios || [];
  const mezcla = cfg.mezcla || SUPUESTOS_F10.nortes[cfg.norte] || SUPUESTOS_F10.nortes.equilibrio;
  const ir = (i) => { setPaso(i); setVerEsc(null); track("futuro10_paso", { paso: i + 1 }); };
  // Planes para comparar: seguir como vas, lo que estás armando y los guardados.
  // El borrador solo aparece si es distinto de lo guardado (si no, se repite).
  // 24-oct-2026 (Santiago: "a veces queda un plan fantasma que es lo que uno
  // está armando y no hay dónde quitarlo"). Ahora se nombra y se puede guardar
  // o descartar desde Tus escenarios.
  const igualA = (c) => JSON.stringify({ ...migrarModifica({ ...CONFIG_INICIAL, ...c }), escenario: cfg.escenario }) === JSON.stringify({ ...cfg });
  const hayBorrador = JSON.stringify({ ...cfg, escenario: CONFIG_INICIAL.escenario }) !== JSON.stringify(CONFIG_INICIAL) && !escenarios.some((e) => igualA(e.config));
  const editandoEsc = escenarios.find((e) => e.id === editandoId) || null;
  const nombreBorrador = editandoEsc ? `${editandoEsc.nombre} (cambios sin guardar)` : "Sin guardar: lo que estás armando";
  const planesComparar = useMemo(() => {
    const ps = [{ nombre: "Hoy", esHoy: true, r: proyectarFuturo10(user, { escenario: cfg.escenario }) }];
    if (hayBorrador) ps.push({ nombre: nombreBorrador, r });
    escenarios.forEach((e) => ps.push({ id: e.id, nombre: e.nombre, descripcion: e.descripcion || "", recomendado: !!e.recomendado, r: proyectarFuturo10(user, { ...migrarModifica({ ...CONFIG_INICIAL, ...e.config }), escenario: cfg.escenario }) }));
    return ps;
  }, [user, cfg, r, escenarios, hayBorrador, nombreBorrador]);
  const bolsa = (user.inv || []).filter((a) => cfg.decisiones[a.id]?.accion === "vende").length;

  const editando = escenarios.find((e) => e.id === editandoId) || null;
  const guardarCambios = () => {
    if (demo || !editando) return;
    const lista = escenarios.map((e) => (e.id === editando.id ? { ...e, nombre: nombreEsc.trim() || e.nombre, descripcion: descEsc.trim(), config: cfg, editado: new Date().toISOString() } : e));
    onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: lista });
    setEditandoId(null); setNombreEsc(""); setDescEsc("");
  };
  const guardar = () => {
    if (demo) return; // la demo nunca escribe en la cuenta real
    setEditandoId(null);
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `Escenario ${escenarios.length + 1}`, descripcion: descEsc.trim(), creado: new Date().toISOString(), config: cfg };
    onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc(""); setDescEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const editarEsc = (id) => { const e = escenarios.find((x) => x.id === id); if (!e) return; setCfg(migrarModifica({ ...CONFIG_INICIAL, ...e.config })); setEditandoId(e.id); setNombreEsc(e.nombre || ""); setDescEsc(e.descripcion || ""); ir(1); };
  const descartarBorrador = () => { setCfg(editandoEsc ? migrarModifica({ ...CONFIG_INICIAL, ...editandoEsc.config }) : { ...CONFIG_INICIAL, escenario: cfg.escenario }); setEditandoId(null); setNombreEsc(""); setDescEsc(""); };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label="Mi futuro a 10 años" title="¿Cómo se ve tu patrimonio en 10 años?" compact
        subtitle="Decide qué hacer con cada activo, mueve tu plata y mira el resultado en pesos de hoy. Tus datos reales no se tocan." />
      <div style={{ ...card, borderColor: C.am, fontSize: 12, color: C.tx2 }}>{AVISO_F10}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
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
          <p style={{ color: C.tx2, fontSize: 12 }}>Las cifras de hoy no incluyen impuestos.</p>
        </div>
      )}
      {paso === 0 && <HoyDetalle user={user} cfg={cfg} set={set} />}

      {paso === 1 && (<>
        {/* 24-oct-2026 (Santiago: "veo que se pisan las mangueras de ambas
            secciones"). El paso 2 solo decide; todo lo que mueve plata va en
            el paso 3, Tu plata, con el saldo a la vista y el origen de cada peso. */}
        <div style={card}>
          <Seccion n={1} titulo="Tus inversiones de hoy" sub="De cada una: sigue igual o se vende. Lo que le vayas a invertir (la bodega en tu lote) va en el paso 3, Tu plata." />
          {(user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
            const d = cfg.decisiones[a.id] || { accion: "continua" };
            const vende = d.accion === "vende";
            const elegir = (k) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [a.id]: { accion: k } }, reinversiones: k === "vende" ? p.reinversiones.filter((x) => x.activoId !== a.id) : p.reinversiones }));
            const det = (r.reinversionesDetalle || []).find((y) => y.activoId === a.id && (y.aporte > 0 || y.rentaMensual > 0 || y.rendimientoPct != null));
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{a.n || a.nombre}</b><span style={{ color: C.tx2 }}>{plata(a.va)}{String(a.moneda).toUpperCase() === "USD" ? " USD" : ""}</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                  {[["continua", "Sigue igual"], ["vende", "Se vende"]].map(([k, l]) => <button key={k} style={btn((k === "vende") === vende)} onClick={() => elegir(k)}>{l}</button>)}
                  {!vende && det && <span style={{ fontSize: 12, color: C.gn }}>Le inviertes {plata(det.aporte)} en el paso 3</span>}
                </div>
                {vende && <SeVaConVenta user={user} activoId={a.id} d={d} setD={(nx) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [a.id]: { ...d, ...nx } } }))} />}
              </div>
            );
          })}
        </div>
        <div style={card}>
          <Seccion n={2} titulo="Lo que viene" sub="Lo que empieza más adelante: una pensión, un local que te entregan, la universidad de los hijos." />
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} activos={r.activos} gastosHoy={r.gastosHoy || []} ingresosHoy={r.ingresosHoy || []} fuentes={r.fuentes || []} />
        </div>
      </>)}

      {paso === 2 && (<>
        <div style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 2 }}>Tu plata</h3>
          <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Lo que tienes para mover: lo que vendes, capital nuevo que traigas de afuera o tu liquidez de hoy. Cada uso se descuenta y siempre ves cuánto te queda.</p>
          <Saldo r={r} />
        </div>
        <div style={card}>
          <Seccion n="A" titulo="Pagar deudas" sub="La deuda de un activo que vendes se paga sola con esa venta. Las demás, márcalas si quieres pagarlas con lo vendido." />
          {(r.deudas || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} /> : <p style={{ color: C.tx2, fontSize: 13 }}>No tienes deudas con saldo.</p>}
        </div>
        <div style={card}>
          <Seccion n="B" titulo="Invertir en lo que ya tienes" sub="Plata que le metes a algo tuyo: una obra (la bodega en tu lote) o más capital (IBKR). Elige de dónde sale." />
          {(r.activos || []).filter((a) => a.clase !== "vehiculo").map((a) => {
            const iR = cfg.reinversiones.findIndex((x) => x.activoId === a.id);
            const activo = iR >= 0;
            const toggle = () => set("reinversiones", activo ? cfg.reinversiones.filter((x) => x.activoId !== a.id) : [...cfg.reinversiones, { activoId: a.id, monto: "", anio: 1, rentaMensual: "", rentaDesdeMes: 0, fuente: "venta" }]);
            const upR = (v) => set("reinversiones", cfg.reinversiones.map((y, j) => (j === iR ? { ...y, ...v } : y)));
            const detR = activo ? (r.reinversionesDetalle || []).find((y) => y.i === iR) : null;
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <b>{a.nombre}</b>
                  <button style={btn(activo)} onClick={toggle}>{activo ? "Le voy a invertir ✓" : "Le voy a invertir"}</button>
                </div>
                {activo && <div style={{ marginTop: 8 }}><AporteCampos x={cfg.reinversiones[iR]} up={upR} det={detR} activos={r.activos} vendidos={r.vendidos || []} /></div>}
              </div>
            );
          })}
        </div>
        <div style={card}>
          <Seccion n="C" titulo="Inversiones nuevas" sub="Algo que todavía no tienes: un CDT, un fondo, una inversión en otra cosa. Elige de dónde sale." />
          {cfg.nuevas.map((x, i) => {
            const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y));
            const hint = rendimientoHintPct(esc);
            const lbl = { fontSize: 12, color: C.tx2 };
            return (
              <div key={i} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                <label style={lbl}>Tipo<select style={inp} value={x.preset} onChange={(e) => up({ preset: e.target.value })}>
                  {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                  <option value="custom">Otra (personalizada)</option>
                </select></label>
                <label style={lbl}>¿Cuánto? ($)<NumberInput style={inp} placeholder="Monto" value={x.monto} onChange={(v) => up({ monto: v })} /></label>
                <label style={lbl}>¿De dónde sale la plata?<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>
                {x.preset === "custom" && <>
                  <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder="Ej.: negocio, CDT, finca" /></label>
                  <label style={lbl}>¿Cuándo?<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Ya" : `En ${y - 1} año${y === 2 ? "" : "s"}`}</option>)}</select></label>
                  <label style={lbl}>Rendimiento anual esperado (%)<InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} />
                    <span style={{ fontSize: 11 }}>Si no sabes, usa {fmtPctEs(hint, 1)}.</span></label>
                  <label style={lbl}>Moneda<select style={inp} value={x.moneda || "COP"} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>
                    {x.moneda === "USD" && <span style={{ fontSize: 11, color: C.am }}>En dólares, el resultado en pesos también depende de cómo se mueva la tasa de cambio.</span>}</label>
                  <label style={lbl}>De lo que rinde, ¿cuánto te llega?<select style={inp} value={x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{PARTES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                    {(() => { const rend = (x.rendimientoNomPct === "" || x.rendimientoNomPct == null ? hint : Number(x.rendimientoNomPct)) / 100; const p = (x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)) / 100; const mes = (Number(x.monto) || 0) * rend * p / 12;
                      return <span style={{ fontSize: 11, color: mes > 0 ? C.gn : C.tx2 }}>{mes > 0 ? `Te llegan ${plata(Math.round(mes))} al mes; ${p < 1 ? "el resto se reinvierte" : "el capital queda igual"}.` : "Todo se reinvierte: crece con interés compuesto."}</span>; })()}</label>
                </>}
                <div><button style={btn(false)} onClick={() => set("nuevas", cfg.nuevas.filter((_, j) => j !== i))}>Quitar</button></div>
              </div>
            );
          })}
          <button style={{ ...btn(true), width: "100%", padding: "12px", marginTop: 6 }} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "", fuente: "venta" }])}>+ Crear inversión nueva</button>
        </div>
        <div style={card}>
          <Seccion n="D" titulo="El resto se reparte así" sub="Lo que quede de lo que vendes, después de todo lo anterior. Son ejemplos de mezcla, no recomendaciones." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(SUPUESTOS_F10.nortes).map(([k, nt]) => <button key={k} style={btn(!cfg.mezcla && cfg.norte === k)} onClick={() => setCfg((p) => ({ ...p, norte: k, mezcla: null }))}>{nt.nombre}</button>)}
            <button style={btn(!!cfg.mezcla)} onClick={() => set("mezcla", { liquidez: mezcla.liquidez, renta: mezcla.renta, crecimiento: mezcla.crecimiento })}>Personalizado</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginTop: 10 }}>
            {["liquidez", "renta", "crecimiento"].map((k) => <label key={k} style={{ fontSize: 12, color: C.tx2 }}>{k[0].toUpperCase() + k.slice(1)} (%)
              {cfg.mezcla ? <InputDecimalEs style={inp} value={cfg.mezcla[k]} onChange={(v) => set("mezcla", { ...cfg.mezcla, [k]: v })} /> : <div style={{ color: C.tx, fontSize: 15 }}>{fmtPctEs(mezcla[k], 0)}</div>}</label>)}
          </div>
          {validarMezcla(cfg.mezcla) && <p role="alert" style={{ color: C.rd, fontSize: 12 }}>{validarMezcla(cfg.mezcla)}</p>}
        </div>
      </>)}

      {paso === 3 && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Resultado a 10 años</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>Así se ve este escenario. Guárdalo en el paso 5 para compararlo con otros.</div>
        </div>
        <PlanInforme r={r} nombre="Este escenario" inflacionPct={esc.inflacionPct} />
        {r.alertas.length > 0 && <div style={{ ...card, borderColor: C.rd }}>
          <b style={{ color: C.rd }}>Alertas de liquidez</b>
          {dedupe(r.alertas).map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.texto}</div>)}
        </div>}
        {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. Los supuestos {esc.nombre.toLowerCase()} suponen devaluación real de {fmtPctEs(SUPUESTOS_F10.presets.sp500.devaluacionRealPct)}.</p>}
      </>)}

      {paso === 4 && (<>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Tus escenarios</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginBottom: 8 }}>Guarda lo que armaste con un nombre y compáralo con los otros. Toca una tarjeta para verla con todo; ahí mismo la editas o la borras.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder="Nombre del escenario, ej.: Conservador + casa" value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />
            {editando ? <>
              <button style={btn(!demo)} disabled={demo} onClick={guardarCambios}>Guardar cambios</button>
              <button style={btn(false)} disabled={demo} onClick={guardar}>Guardar como nuevo</button>
            </> : <button style={btn(!demo)} disabled={demo} onClick={guardar}>Guardar este escenario</button>}
          </div>
          {editando && <div style={{ fontSize: 12, color: C.gn, marginTop: 6 }}>Estás editando «{editando.nombre}». Aquí le cambias el nombre; toca Guardar cambios. <button style={{ ...btn(false), padding: "2px 8px", fontSize: 12 }} onClick={() => { setEditandoId(null); setNombreEsc(""); setDescEsc(""); }}>Cancelar</button></div>}
          <input style={{ ...inp, marginTop: 6 }} placeholder={`Resumen en una frase (opcional). Si lo dejas vacío: «${resumenEscenario(r)}»`} value={descEsc} onChange={(e) => setDescEsc(e.target.value)} />
          {demo && <p style={{ color: C.am, fontSize: 12 }}>{MSG_DEMO_F10}</p>}
        </div>
        {verEsc ? <>
          <button style={{ ...btn(false), marginBottom: 10 }} onClick={() => setVerEsc(null)}>← Volver a comparar</button>
          <div style={{ ...card, marginBottom: 14, borderTop: `3px solid ${verEsc.color || C.gn}` }}><h3 style={{ margin: 0 }}>{verEsc.nombre}</h3></div>
          <PlanInforme r={verEsc.r} nombre={verEsc.nombre} inflacionPct={esc.inflacionPct} />
        </> : <PlanComparador planes={planesComparar} inflacionPct={esc.inflacionPct} onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc} onBorrar={demo ? null : borrar}
          onGuardarBorrador={demo ? null : () => { if (editandoEsc) guardarCambios(); else { window.scrollTo?.({ top: 0, behavior: "smooth" }); guardar(); } }} onDescartarBorrador={demo ? null : descartarBorrador}
          onRecomendar={demo ? null : (id) => onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.map((e) => ({ ...e, recomendado: e.id === id ? !e.recomendado : false })) })} />}
      </>)}


      {/* 24-oct-2026 (Santiago: "que sea fluido el proceso, una etapa te lleva a
          la siguiente"). Al final de cada paso, el siguiente. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {paso > 0 && <button style={{ ...btn(false), padding: "12px" }} onClick={() => { ir(paso - 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>← Atrás</button>}
        {paso < PASOS.length - 1 && <button style={{ ...btn(true), flex: 1, padding: "12px", fontWeight: 600 }} onClick={() => { ir(paso + 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>Siguiente: {PASOS[paso + 1]} →</button>}
      </div>

      <details style={card}>
        <summary style={{ cursor: "pointer" }}>Supuestos (inflación y cuánto rinden las inversiones)</summary>
        <p style={{ color: C.tx2, fontSize: 12 }}>No son tus escenarios: es cómo se comporta el mercado. «Normales» es lo esperado; «Prudentes» supone más inflación y menos rendimiento; «Favorables», lo contrario.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>Supuestos del mercado:</span>
        {Object.entries(SUPUESTOS_F10.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{e.nombre}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>inflación {fmtPctEs(esc.inflacionPct)}</span>
      </div>

        <TablaSupuestos esc={esc} />
      </details>
    </div>
  );
}

const ANIOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function LoQueViene({ cfg, set, esc, owners, activos = [], gastosHoy = [], ingresosHoy = [], fuentes = [] }) {
  const [verTodos, setVerTodos] = useState(false);
  const f = { ingresos: [], activos: [], gastos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upG = (i, v) => put("gastos", (f.gastos || []).map((x, j) => (j === i ? { ...x, ...v } : x)));
  const lbl = { fontSize: 12, color: C.tx2 };
  const g = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.bd}` };
  const selAnio = (v, on, vacioTxt) => <select style={inp} value={v ?? ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}>{vacioTxt && <option value="">{vacioTxt}</option>}{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Ya" : `En ${y - 1} año${y === 2 ? "" : "s"}`}</option>)}</select>;
  const hintVal = (cl) => fmtPctEs(((1 + esc.inflacionPct / 100) * (1 + (cl === "inmueble" || cl === "vivienda" || cl === "lote" ? SUPUESTOS_F10.presets.fincaRaiz.valorizacionSpread : SUPUESTOS_F10.otrosRealSpread) / 100) - 1) * 100, 1);
  const fut = leerFuturos(f, esc); // mismo motor que la proyección
  const totalIng = fut.ingresos.reduce((sm, x) => sm + x.mensual, 0);
  const primerAnio = fut.ingresos.length ? Math.min(...fut.ingresos.map((x) => x.desde)) : null;
  const totalAct = f.activos.reduce((sm, x) => sm + (Number(x.valor) || 0), 0);
  const totalGas = (fut.gastos || []).reduce((sm, x) => sm + x.anual, 0);
  return (
    <div>
      {/* 24-oct-2026 (Santiago: "es muy poco visible lo de ingresos futuros;
          debería verse muy bien"). Pasa a paso propio, con resumen arriba. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, margin: "10px 0 14px" }}>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.tx2 }}>Ingresos futuros</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalIng > 0 ? C.gn : C.tx }}>{totalIng > 0 ? `${plata(totalIng)} al mes` : "Ninguno"}</div>
          {fut.ingresos.length > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>{fut.ingresos.length} {fut.ingresos.length === 1 ? "ingreso" : "ingresos"} · el primero {primerAnio === 1 ? "desde ya" : `en ${primerAnio - 1} año${primerAnio === 2 ? "" : "s"}`}</div>}
        </div>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.tx2 }}>Compras y construcciones</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{totalAct > 0 ? plata(totalAct) : "Ninguno"}</div>
          {f.activos.length > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>{f.activos.length} {f.activos.length === 1 ? "activo" : "activos"}</div>}
        </div>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.tx2 }}>Gastos futuros</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalGas > 0 ? C.am : C.tx }}>{totalGas > 0 ? `${plata(totalGas)} al año` : "Ninguno"}</div>
          {(fut.gastos || []).length > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>{fut.gastos.length} {fut.gastos.length === 1 ? "gasto" : "gastos"}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.am, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>¿La renta sale de un activo que ya tienes? Elígelo en «¿De dónde sale?». Si además le vas a meter plata (construir la bodega en el lote), hazlo en el paso 3, Tu plata → «Invertir en lo que ya tienes»: ahí van la inversión y la renta juntas.</div>
      <h4 style={{ margin: "8px 0" }}>Ingresos futuros</h4>
      {f.ingresos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder="Ej.: pensión" onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Al mes ($, pesos de hoy)<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            {!x.activoId && <span style={{ fontSize: 11 }}>Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. Sube con la inflación.</span>}</label>
          <label style={lbl}>¿De dónde sale?<select style={inp} value={x.activoId || ""} onChange={(e) => upI(i, { activoId: e.target.value || null })}><option value="">No sale de un activo (pensión, honorarios…)</option>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label style={lbl}>Empieza{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          {x.activoId && <label style={lbl}>¿Cuánto sube el valor de {(activos.find((y) => y.id === x.activoId) || {}).nombre || "ese activo"} al año? (%, opcional)<InputDecimalEs style={inp} placeholder="Ej.: 5" value={x.valorizacionNomPct ?? ""} onChange={(v) => upI(i, { valorizacionNomPct: v })} /><span style={{ fontSize: 11 }}>Es el valor del activo, no la renta. La renta sube cada año con la inflación.</span></label>}
          {/* 24-oct-2026 (Santiago, con la pensión puesta "termina año 7" sin querer:
              "no veo esa opción"). En el iPhone «Sigue» quedaba escondida arriba de la
              rueda. Ahora son dos botones y el año solo aparece si termina. */}
          <div style={lbl}>¿Hasta cuándo?
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" style={btn(vacio(x.hasta))} onClick={() => upI(i, { hasta: "" })}>Sigue siempre</button>
              <button type="button" style={btn(!vacio(x.hasta))} onClick={() => upI(i, { hasta: vacio(x.hasta) ? Math.max(Number(x.desde) || 1, 10) : x.hasta })}>Termina</button>
            </div>
            {!vacio(x.hasta) && <div style={{ marginTop: 6 }}>{selAnio(x.hasta, (v) => upI(i, { hasta: v === "" ? Number(x.desde) || 1 : v }))}</div>}
          </div>
          {(Number(x.mensual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.gn }}>{textoIngresoFuturo(x)}</div>}
          {owners.length > 1 && <label style={lbl}>Titular (opcional)<select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select></label>}
          <button style={btn(false)} onClick={() => put("ingresos", f.ingresos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("ingresos", [...f.ingresos, { nombre: "", mensual: "", desde: 1, hasta: "" }])}>+ Agregar ingreso futuro</button>
      {/* 24-oct-2026 (Santiago: "la parte de activos futuros no está bien
          pensada, solo deja elegir finca raíz y otros… si quiero construir una
          casa, ¿ese es el lugar? ¿y debo decir de dónde sale la plata?"). */}
      <h4 style={{ margin: "16px 0 4px" }}>Compras y construcciones futuras</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>Algo que vas a comprar o construir: tu casa, un local, un lote. Dices cuánto cuesta, cuándo está listo y de dónde sale la plata.</div>
      {f.activos.map((x, i) => {
        const tipo = x.clase || "inmueble";
        const renta = tipo === "inmueble" || tipo === "negocio";
        const total = Number(x.valor) || 0, antes = Math.min(total, Number(x.cuotaInicial) || 0);
        const cuando = (y) => (y === 1 ? "ya" : `en ${y - 1} año${y === 2 ? "" : "s"}`);
        // Fuentes en pesos (Santiago: "el valor que voy a retirar de cada una").
        // Escenarios con % se pasan a pesos sobre el valor total.
        const fps = (Array.isArray(x.fuentes) ? x.fuentes : x.fuenteId ? [{ id: x.fuenteId, pct: 100 }] : []).map((z) => (z.monto == null && z.pct != null ? { id: z.id, monto: Math.round((Number(z.pct) || 0) / 100 * (Number(x.valor) || 0)) } : z));
        const setFps = (arr) => upA(i, { fuentes: arr.map(({ id, monto }) => ({ id, monto })), fuenteId: null });
        const sumaFps = fps.reduce((sm, z) => sm + (Number(z.monto) || 0), 0);
        const nomF = (id) => (fuentes.find((y) => y.id === id) || {}).nombre || "una inversión";
        const validas = fps.filter((z) => z.id && Number(z.monto) > 0);
        const faltaF = Math.max(0, (Number(x.valor) || 0) - sumaFps);
        const fuenteNom = validas.length ? validas.map((z) => `${plata(Number(z.monto))} de ${nomF(z.id)}`).join(" + ") + (faltaF > 0 ? ` + ${plata(faltaF)} de tus cuentas de hoy` : "") : "tu liquidez";
        return (
          <div key={i} style={g}>
            <label style={lbl}>¿Qué es?<select style={inp} value={tipo} onChange={(e) => upA(i, { clase: e.target.value })}>
              <option value="vivienda">Casa para vivir</option><option value="inmueble">Inmueble para rentar</option><option value="lote">Lote</option><option value="negocio">Negocio</option><option value="otro">Otro</option></select></label>
            <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder={tipo === "vivienda" ? "Ej.: casa finca" : "Ej.: local comercial"} onChange={(e) => upA(i, { nombre: e.target.value })} /></label>
            <label style={lbl}>¿Cuánto cuesta en total? ($)<NumberInput style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} /></label>
            <label style={lbl}>¿Cuánto vale cuando está lista? ($, opcional)<NumberInput style={inp} placeholder="Si vale más de lo que cuesta" value={x.valorAlTerminar ?? ""} onChange={(v) => upA(i, { valorAlTerminar: v })} />
              <span style={{ fontSize: 11 }}>Una construcción suele valer más al terminarla. Desde ahí sube con el % de abajo.</span></label>
            <label style={lbl}>¿Cuándo está lista?{selAnio(x.entrega || 1, (v) => upA(i, { entrega: v || 1, anioCuota: Math.min(Number(x.anioCuota) || 1, v || 1) }))}
              <span style={{ fontSize: 11 }}>Cuando la recibes o terminas de construir.</span></label>
            <div style={{ ...lbl, gridColumn: "1 / -1" }}>¿De dónde sale la plata?
              {fps.map((fp, k) => <div key={k} style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                <select style={{ ...inp, flex: 1 }} value={fp.id || ""} onChange={(e) => setFps(fps.map((z, j) => (j === k ? { ...z, id: e.target.value } : z)))}><option value="">Elige una inversión</option>{fuentes.map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}</select>
                <span style={{ width: 150 }}><NumberInput style={inp} placeholder="¿Cuánto sacas?" value={fp.monto ?? ""} onChange={(v) => setFps(fps.map((z, j) => (j === k ? { ...z, monto: v } : z)))} /></span>
                <button style={{ ...btn(false), padding: "6px 8px" }} onClick={() => setFps(fps.filter((_, j) => j !== k))}>✕</button>
              </div>)}
              <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setFps([...fps, { id: "", monto: faltaF || "" }])}>+ {fps.length ? "Otra inversión" : "Sale de una inversión"}</button>
              <span style={{ display: "block", fontSize: 11, marginTop: 4 }}>{fps.length === 0 ? "Si no eliges, sale de tus cuentas de hoy (ahorros y efectivo)." : faltaF > 0 ? `Faltan ${plata(faltaF)}: salen de tus cuentas de hoy.` : sumaFps > (Number(x.valor) || 0) ? "Sacas más de lo que cuesta." : "Completo. Si alguna no alcanza, lo que falta sale de tus cuentas de hoy."}</span>
            </div>
            <label style={lbl}>¿Pagas una parte antes? ($, opcional)<NumberInput style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} />
              <span style={{ fontSize: 11 }}>Un anticipo o la primera etapa de la obra. Si no, todo se paga cuando está lista.</span></label>
            {antes > 0 && <label style={lbl}>¿Cuándo pagas esa parte?{selAnio(x.anioCuota || 1, (v) => upA(i, { anioCuota: Math.min(v || 1, Number(x.entrega) || 1) }))}</label>}
            {renta && <>
              <label style={lbl}>¿Cuánto renta al mes? ($, neto, opcional)<NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} /></label>
              {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>¿Desde cuándo renta?{selAnio(x.rentaDesde || x.entrega || 1, (v) => upA(i, { rentaDesde: v || 1 }))}</label>}
            </>}
            <label style={lbl}>¿Cuánto sube su valor al año? (%)<InputDecimalEs style={inp} placeholder={hintVal(tipo)} value={x.valorizacionNomPct ?? ""} onChange={(v) => upA(i, { valorizacionNomPct: v })} />
              <span style={{ fontSize: 11 }}>Si no sabes, déjalo en {hintVal(tipo)}.</span></label>
            {total > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>
              {antes > 0 ? `Pagas ${plata(antes)} ${cuando(Number(x.anioCuota) || 1)} y ${plata(total - antes)} ${cuando(Number(x.entrega) || 1)}` : `Pagas ${plata(total)} ${cuando(Number(x.entrega) || 1)}`}: {validas.length ? fuenteNom : "de tus cuentas de hoy"}.
              {renta && (Number(x.rentaMensual) || 0) > 0 ? ` Renta ${plata(Number(x.rentaMensual))} al mes ${cuando(Number(x.rentaDesde) || Number(x.entrega) || 1)}.` : ""}
              {(Number(x.valorAlTerminar) || 0) > total ? ` Al estar lista vale ${plata(Number(x.valorAlTerminar))} (+${plata(Number(x.valorAlTerminar) - total)}).` : ""}
              {tipo === "vivienda" ? " Si al mudarte dejas de pagar arriendo, márcalo en «Gastos que se acaban» desde ese año." : ""}</div>}
            <button style={btn(false)} onClick={() => put("activos", f.activos.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        );
      })}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("activos", [...f.activos, { nombre: "", clase: "vivienda", valor: "", cuotaInicial: "", anioCuota: 1, entrega: 2, rentaMensual: "", rentaDesde: "", fuentes: [] }])}>+ Agregar compra o construcción</button>
      {/* 24-oct-2026 (Santiago: "como vienen nuevas rentas también vienen
          nuevos gastos: la universidad de mis hijos afuera, unos 180 M por
          año, en 3 años"). Pesos de hoy; suben con la inflación. */}
      <h4 style={{ margin: "16px 0 8px" }}>Gastos futuros</h4>
      {(f.gastos || []).map((x, i) => {
        const d = Math.max(1, Number(x.desde) || 1), n = x.anios === "" || x.anios == null ? null : Math.max(1, Number(x.anios) || 1);
        const cuando = d === 1 ? "desde ya" : `dentro de ${d - 1} año${d === 2 ? "" : "s"}`;
        return (
          <div key={i} style={g}>
            <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder="Ej.: universidad de los hijos" onChange={(e) => upG(i, { nombre: e.target.value })} /></label>
            <label style={lbl}>Al año ($, pesos de hoy)<NumberInput style={inp} value={x.anual ?? ""} onChange={(v) => upG(i, { anual: v })} />
              <span style={{ fontSize: 11 }}>Sube cada año con la inflación.</span></label>
            <label style={lbl}>Empieza{selAnio(x.desde || 1, (v) => upG(i, { desde: v || 1 }))}</label>
            <div style={lbl}>¿Cuántos años?
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" style={btn(n == null)} onClick={() => upG(i, { anios: "" })}>Siempre</button>
                <button type="button" style={btn(n != null)} onClick={() => upG(i, { anios: n ?? 4 })}>Un tiempo</button>
              </div>
              {n != null && <select style={{ ...inp, marginTop: 6 }} value={n} onChange={(e) => upG(i, { anios: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{y} año{y === 1 ? "" : "s"}</option>)}</select>}
            </div>
            {(Number(x.anual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>Sale {plata(Number(x.anual))} al año ({plata(Math.round(Number(x.anual) / 12))} al mes) {cuando}{n != null ? `, durante ${n} año${n === 1 ? "" : "s"}` : ", siempre"}.</div>}
            <button style={btn(false)} onClick={() => put("gastos", (f.gastos || []).filter((_, j) => j !== i))}>Quitar</button>
          </div>
        );
      })}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("gastos", [...(f.gastos || []), { nombre: "", anual: "", desde: 4, anios: 4 }])}>+ Agregar gasto futuro</button>
      {/* 24-oct-2026 (Santiago: "¿cómo quita uno items de gastos que ya no
          van? por ejemplo mantenimientos"). Solo cambia el escenario. */}
      <h4 style={{ margin: "16px 0 4px" }}>Ingresos que se acaban</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>Tus ingresos de hoy (de Ingresos). Apaga los que ya no van en este escenario y desde cuándo; tus datos de Ingresos no cambian.</div>
      <SeAcaba lista={ingresosHoy} term={cfg.ingresosTerminan || {}} setTerm={(nx) => set("ingresosTerminan", nx)} frase="Dejas de recibir" />
      <h4 style={{ margin: "16px 0 4px" }}>Gastos que se acaban</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>Tus gastos de hoy (de Egresos). Marca los que dejas de pagar en este escenario y desde cuándo; tus datos de Egresos no cambian.</div>
      {(() => {
        const term = cfg.gastosTerminan || {};
        const lista = gastosHoy.filter((g) => !g.neteado).sort((a, b) => (!!term[b.key] - !!term[a.key]) || b.mensual - a.mensual);
        const visibles = verTodos ? lista : lista.slice(0, 8);
        const setT = (k, v) => { const nx = { ...term }; if (v) nx[k] = v; else delete nx[k]; set("gastosTerminan", nx); };
        const ahorro = lista.filter((g) => term[g.key]).reduce((sm, g) => sm + g.mensual, 0);
        return <>
          {visibles.map((g) => { const t = term[g.key]; return (
            <div key={g.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "6px 0", borderTop: `1px solid ${C.bd}` }}>
              <span style={{ flex: "1 1 160px", minWidth: 0 }}><span style={{ textDecoration: t ? "line-through" : "none", color: t ? C.tx2 : C.tx }}>{g.nombre}</span> <span style={{ fontSize: 11, color: C.tx2 }}>{g.cat !== g.nombre ? `· ${g.cat}` : ""}</span></span>
              <span style={{ fontSize: 13, whiteSpace: "nowrap", color: C.tx2 }}>{plata(Math.round(g.mensual))}/mes</span>
              <button style={btn(!t)} onClick={() => setT(g.key, null)}>Sigue</button>
              <button style={btn(!!t)} onClick={() => setT(g.key, t || 1)}>Se acaba</button>
              {t && <select style={{ ...inp, width: "auto" }} value={t} onChange={(e) => setT(g.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Desde ya" : `En ${y - 1} año${y === 2 ? "" : "s"}`}</option>)}</select>}
            </div>); })}
          {lista.length > 8 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Ver menos" : `Ver todos (${lista.length})`}</button>}
          {ahorro > 0 && <div style={{ fontSize: 12, color: C.gn, marginTop: 6 }}>Dejas de pagar {plata(Math.round(ahorro))} al mes en gastos que se acaban.</div>}
        </>;
      })()}
    </div>
  );
}

// 24-oct-2026 (Santiago: "si vendo Orlando la idea es pagar la deuda de
// Orlando… tengo otras deudas que me gustaría pagar con plata de los activos
// que se venden"). La deuda que cuelga de un activo vendido se paga sola con
// esa venta; las demás se marcan aquí. Solo se pagan con lo vendido.
function Deudas({ r, cfg, set, inv, bolsa }) {
  const sel = cfg.pagarDeudas || {};
  const nombreActivo = (id) => { const a = inv.find((x) => x.id === id); return a ? a.n || a.nombre : "el activo"; };
  const bd = r.bolsaDetalle || {};
  return (
    <div>
      {r.deudas.map((d) => {
        const corto = d.pagar && d.pagado < d.saldo - 0.5;
        return (
          <div key={d.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{d.nombre}</b><span style={{ color: C.tx2 }}>{plata(d.saldo)}</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
              {d.porVenta
                ? <span style={{ fontSize: 12, color: C.gn }}>Se paga con la venta de {nombreActivo(d.activoId)}</span>
                : [[false, "Sigue"], [true, "Se paga"]].map(([v, l]) => <button key={l} style={btn(!!sel[d.id] === v)} onClick={() => set("pagarDeudas", { ...sel, [d.id]: v })}>{l}</button>)}
              {corto && <span style={{ fontSize: 12, color: C.am }}>alcanza {plata(d.pagado)}</span>}
            </div>
          </div>
        );
      })}
      {bolsa === 0 && <p style={{ color: C.tx2, fontSize: 12 }}>Para pagar una deuda, vende algo en el paso 2: se paga con esa plata.</p>}
      {bd.deudas > 0 && r.cuotasQueSalenMes > 0 && <p style={{ fontSize: 12, color: C.tx2 }}>Pagas {plata(bd.deudas)} y dejas de pagar <b style={{ color: C.gn }}>{plata(r.cuotasQueSalenMes)}</b> de cuotas al mes.</p>}
    </div>
  );
}

function Seccion({ n, titulo, sub }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
    <div style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 999, background: "rgba(34,197,94,0.15)", color: C.gn, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{n}</div>
    <div style={{ minWidth: 0 }}><h3 style={{ margin: "2px 0 2px" }}>{titulo}</h3><div style={{ color: C.tx2, fontSize: 12 }}>{sub}</div></div>
  </div>;
}

const vacio = (v) => v === "" || v == null;
// Una línea en palabras para cada ingreso futuro: evita que «termina año 7» pase inadvertido.
const textoIngresoFuturo = (x) => {
  const d = Math.max(1, Number(x.desde) || 1), h = vacio(x.hasta) ? null : Math.max(d, Number(x.hasta) || d);
  const monto = "$" + fmtMilesEs(Number(x.mensual) || 0);
  const cuando = (y) => (y === 1 ? "desde ya" : `dentro de ${y - 1} año${y === 2 ? "" : "s"}`);
  if (h == null) return `Te llegan ${monto} al mes ${cuando(d)}, siempre.`;
  if (h === d) return `Te llegan ${monto} al mes ${cuando(d)}, solo durante un año.`;
  return `Te llegan ${monto} al mes ${cuando(d)}, durante ${h - d + 1} años.`;
};

// 24-oct-2026: según el tipo de activo, la plataforma pregunta lo suyo.
const PARTES = [[0, "Nada: todo se reinvierte"], [25, "Una cuarta parte"], [50, "La mitad"], [75, "Tres cuartas partes"], [100, "Todo: me llega cada mes"]];
const ETQ_TIPO = { inmueble: "Inmueble: da renta y se valoriza", liquido: "Renta fija o cuenta: rinde una tasa al año", acciones: "Fondos, trading o acciones: rinde al año", otro: "Otra inversión: rinde al año", vehiculo: "Vehículo" };
function AporteCampos({ x, up, det, activos, conActivo = false, vendidos = [] }) {
  const lbl = { fontSize: 12, color: C.tx2 };
  const desdeMes = Number(x.rentaDesdeMes) || 0;
  const clase = (activos.find((a) => a.id === x.activoId) || {}).clase || "otro";
  const esInm = clase === "inmueble";
  const pct = (v) => fmtPctEs(v, 1);
  return (<>
    <div style={{ fontSize: 11, color: C.tx2, marginBottom: 6 }}>{ETQ_TIPO[clase] || ETQ_TIPO.otro}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {conActivo && <label style={lbl}>¿A cuál?<select style={inp} value={x.activoId} onChange={(e) => up({ activoId: e.target.value })}>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>}
      <label style={lbl}>¿Cuánto le vas a invertir? ($)<NumberInput style={inp} placeholder="Ej.: 600.000.000" value={x.monto} onChange={(v) => up({ monto: v })} /></label>
      <label style={lbl}>¿Cuándo?<select style={inp} value={Number(x.anio) || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Ya" : `En ${y - 1} año${y === 2 ? "" : "s"}`}</option>)}</select></label>
      <label style={lbl}>¿De dónde sale la plata?<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>
      {esInm ? <>
        <label style={lbl}>¿Va a dar renta? ($ al mes, opcional)<NumberInput style={inp} placeholder="Ej.: 8.500.000" value={x.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>
        {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>¿Desde cuándo renta?<select style={inp} value={desdeMes} onChange={(e) => up({ rentaDesdeMes: Number(e.target.value) })}>{opcionesMes(desdeMes).map((mm) => <option key={mm} value={mm}>{textoMes(mm)}</option>)}</select></label>}
        <label style={lbl}>¿Cuánto queda valiendo al terminar? ($, opcional)<NumberInput style={inp} placeholder="Ej.: 1.500.000.000" value={x.valorAlTerminar ?? ""} onChange={(v) => up({ valorAlTerminar: v })} /><span style={{ fontSize: 11 }}>Si con la obra vale más que lo que tenías más lo que inviertes.</span></label>
        <label style={lbl}>¿Cuánto se valoriza al año? (%)<InputDecimalEs style={inp} placeholder={det && det.valorizacionPct != null ? pct(det.valorizacionPct) : ""} value={x.valorizacionNomPct ?? ""} onChange={(v) => up({ valorizacionNomPct: v })} /><span style={{ fontSize: 11 }}>Lo que sube el valor cada año{(Number(x.valorAlTerminar) || 0) > 0 ? ", desde que termina la obra" : ""}. Si no sabes, déjalo vacío.</span></label>
      </> : <>
        <label style={lbl}>¿Cuánto rinde al año? (%)<InputDecimalEs style={inp} placeholder={det && det.rendimientoPct != null ? pct(det.rendimientoPct) : ""} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} /><span style={{ fontSize: 11 }}>Lo que estimas que gana en un año, sobre todo lo que tiene.</span></label>
        <label style={lbl}>De lo que rinde, ¿cuánto te llega?<select style={inp} value={Number(x.pctRecibe) || 0} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{PARTES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><span style={{ fontSize: 11 }}>Lo que no te llega se reinvierte y crece con interés compuesto.</span></label>
      </>}
    </div>
    {det && (det.aporte > 0 || det.rentaMensual > 0 || det.rindeAnual > 0) && <div style={{ marginTop: 8, background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
      <div><div style={{ fontSize: 11, color: C.tx2 }}>Queda valiendo</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.total)}</div><div style={{ fontSize: 11, color: C.tx2 }}>hoy {plata(det.valorHoy)} + {plata(det.aporte)}{det.anio > 1 ? ` en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}` : ""}</div></div>
      {esInm && det.rentaMensual > 0 && <div><div style={{ fontSize: 11, color: C.tx2 }}>Renta al mes</div><div style={{ fontSize: 16, fontWeight: 700, color: C.gn }}>{plata(det.rentaMensual)}</div><div style={{ fontSize: 11, color: C.tx2 }}>{textoMes(det.rentaDesdeMes).toLowerCase()} · {pct(det.rentaPctAnual)} al año sobre el total</div></div>}
      {esInm && det.valorizacionPct != null && <div><div style={{ fontSize: 11, color: C.tx2 }}>Se valoriza</div><div style={{ fontSize: 16, fontWeight: 700 }}>{pct(det.valorizacionPct)} al año</div><div style={{ fontSize: 11, color: C.tx2 }}>≈ {plata(det.total * det.valorizacionPct / 100)} el primer año</div></div>}
      {!esInm && <div><div style={{ fontSize: 11, color: C.tx2 }}>Rinde al año</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.rindeAnual)}</div><div style={{ fontSize: 11, color: C.tx2 }}>{pct(det.rendimientoPct)} sobre {plata(det.total)}</div></div>}
      {!esInm && <div><div style={{ fontSize: 11, color: C.tx2 }}>Te llega al mes</div><div style={{ fontSize: 16, fontWeight: 700, color: det.teLlegaMes > 0 ? C.gn : C.tx }}>{plata(det.teLlegaMes)}</div><div style={{ fontSize: 11, color: C.tx2 }}>{det.pctRecibe >= 100 ? "no se reinvierte nada" : `se reinvierten ${plata(det.rindeAnual * (1 - det.pctRecibe / 100))} al año`}</div></div>}
      {(() => {
        const partes = [];
        if (det.deNuevo > 0) partes.push(`capital nuevo: ${plata(det.deNuevo)}`);
        if (det.deVenta > 0) partes.push(`la venta de ${vendidos.map((v) => v.nombre).join(" y ") || "lo que vendes"}: ${plata(det.deVenta)}`);
        if (det.deLiquidez > 0) partes.push(`tu liquidez de hoy: ${plata(det.deLiquidez)}`);
        if (det.deAnio1 > 0) partes.push(`lo que entre en el año 1: ${plata(det.deAnio1)}`);
        if (det.anio > 1 && det.aporte > 0) partes.push(det.fuente === "nuevo" ? `capital nuevo en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}: ${plata(det.aporte)}` : `lo que tengas en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}: ${plata(det.aporte)}`);
        if (!partes.length) return null;
        return <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2, borderTop: `1px solid ${C.bd}`, paddingTop: 6 }}><b style={{ color: C.tx }}>Sale de</b> {partes.join(" · ")}</div>;
      })()}
    </div>}
  </>);
}

// Origen de la plata de cada inversión (motor: fuente venta | nuevo | liquidez).
function FuenteSel({ value, on }) {
  return <select style={inp} value={value || "venta"} onChange={(e) => on(e.target.value)}>
    <option value="venta">De lo que vendo (la plata de las ventas)</option>
    <option value="liquidez">De mis cuentas de hoy (ahorros y efectivo que ya tengo)</option>
    <option value="nuevo">Plata nueva que entra de afuera (prima, crédito, herencia)</option>
  </select>;
}

// El saldo de Tu plata: de dónde viene y en qué se va, siempre a la vista.
function Saldo({ r }) {
  const bd = r.bolsaDetalle || {};
  const vend = (r.vendidos || []).map((v) => v.nombre).join(", ");
  const filas = [
    ...(bd.vendido > 0 ? [[`Vendes ${vend}`, bd.vendido, C.tx]] : []),
    ...(bd.capitalNuevo > 0 ? [["+ Capital nuevo", bd.capitalNuevo, C.tx]] : []),
    ...(bd.desdeLiquidez > 0 ? [["+ De tu liquidez de hoy", bd.desdeLiquidez, C.am]] : []),
    ...(bd.deudas > 0 ? [["− Pagas deudas", bd.deudas, C.tx2]] : []),
    ...(bd.colchon > 0 ? [[`− Colchón de ${SUPUESTOS_F10.colchonMeses} meses`, bd.colchon, C.tx2]] : []),
    ...(bd.obras > 0 ? [["− Obras", bd.obras, C.tx2]] : []),
    ...(bd.reinvertido > 0 ? [["− Inviertes en lo que ya tienes", bd.reinvertido, C.tx2]] : []),
    ...(bd.nuevas > 0 ? [["− Inversiones nuevas", bd.nuevas, C.tx2]] : []),
  ];
  return <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
    {filas.length === 0 ? <div style={{ fontSize: 12, color: C.tx2 }}>Todavía no vendes nada ni traes capital nuevo. Si vendes algo en el paso 2, aquí ves esa plata y en qué se va.</div>
    : filas.map(([l, v, col]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "3px 0" }}><span style={{ color: col === C.tx ? C.tx : C.tx2, minWidth: 0 }}>{l}</span><span style={{ color: col, whiteSpace: "nowrap", fontFamily: "monospace" }}>{plata(v)}</span></div>)}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 15, fontWeight: 700, borderTop: `1px solid ${C.bd}`, marginTop: 6, paddingTop: 8 }}><span>Te queda para repartir</span><span style={{ color: bd.restante > 0 ? C.gn : C.tx, fontFamily: "monospace" }}>{plata(bd.restante || 0)}</span></div>
    <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>
      {bd.pendienteAnio1 > 0 && <div style={{ color: C.am, marginTop: 4 }}>Lo que inviertes no alcanza con lo vendido y tu liquidez: los {plata(bd.pendienteAnio1)} que faltan salen de lo que vaya entrando en el año 1.</div>}
      {bd.programadas > 0 && <div style={{ marginTop: 4 }}>Además programaste {plata(bd.programadas)} para años siguientes: se pagan ese año.</div>}
      {bd.obrasPedido > bd.obras + 0.5 && <div style={{ color: C.am, marginTop: 4 }}>La obra pide {plata(bd.obrasPedido)}: {plata(bd.obras)} salen de aquí y {plata(bd.obrasPedido - bd.obras)} de lo que entre en el año 1.</div>}
      {bd.faltante > 0 && <div style={{ color: C.am, marginTop: 4 }}>Pediste {plata(bd.pedido)} en inversiones nuevas y solo alcanza para {plata(bd.pedido - bd.faltante)}: se asigna hasta donde llega.</div>}
    </div>
  </div>;
}

const MESES_RENTA = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108];
const opcionesMes = (actual) => (MESES_RENTA.includes(actual) ? MESES_RENTA : [...MESES_RENTA, actual].sort((a, b) => a - b));
const textoMes = (mm) => (mm === 0 ? "Ya" : mm % 12 === 0 ? `En ${mm / 12} año${mm === 12 ? "" : "s"}` : `En ${mm} meses`);

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

// 24-oct-2026 (Santiago: "¿por qué aparece la renta de Puerto Madero si se
// vende? Lo mismo Orlando… aparecen rentas que ya no van"). Al marcar «Se
// vende», se ve y se confirma qué ingresos y gastos se van con la venta.
function SeVaConVenta({ user, activoId, d, setD }) {
  const [verTodo, setVerTodo] = useState(false);
  const sug = sugerirVinculados(user, activoId);
  const lista = [...sug.ingresos.map((x) => ({ ...x, tipo: "ing" })), ...sug.gastos.map((x) => ({ ...x, tipo: "gas" }))];
  const elegidos = new Set(Array.isArray(d.seVan) ? d.seVan : lista.filter((x) => x.sugerido).map((x) => x.key));
  const toggle = (k) => { const nx = new Set(elegidos); nx.has(k) ? nx.delete(k) : nx.add(k); setD({ seVan: [...nx] }); };
  const auto = [...sug.auto.ingresos, ...sug.auto.gastos];
  const visibles = verTodo ? lista : lista.filter((x) => elegidos.has(x.key));
  const fila = (x, on, fijo) => (
    <label key={x.key} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 0", color: on ? C.tx : C.tx2 }}>
      <input type="checkbox" checked={on} disabled={fijo} onChange={() => toggle(x.key)} />
      <span style={{ flex: 1, minWidth: 0, textDecoration: on ? "line-through" : "none" }}>{x.nombre}</span>
      <span style={{ whiteSpace: "nowrap" }}>{x.tipo === "gas" || x.cat ? "−" : "+"}{plata(Math.round(x.mensual))}{String(x.moneda).toUpperCase() === "USD" ? " USD" : ""}/mes</span>
    </label>);
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", border: `1px solid ${C.bd}`, borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>¿Qué se va con la venta?</div>
      <div style={{ fontSize: 11, color: C.tx2, marginBottom: 4 }}>Marca las rentas y gastos de este activo. Dejan de contar desde la venta.</div>
      {auto.map((x) => fila(x, true, true))}
      {visibles.map((x) => fila(x, elegidos.has(x.key), false))}
      {auto.length + visibles.length === 0 && <div style={{ fontSize: 12, color: C.tx2 }}>No encontré rentas ni gastos con este nombre. Búscalos abajo.</div>}
      {lista.length > 0 && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setVerTodo(!verTodo)}>{verTodo ? "Ver solo los marcados" : "Buscar otro ingreso o gasto"}</button>}
    </div>);
}

// Lista Sigue / Se acaba (desde un año). La usan los ingresos que se acaban.
function SeAcaba({ lista, term, setTerm, frase }) {
  const [verTodos, setVerTodos] = useState(false);
  const orden = [...lista].sort((a, b) => (!!term[b.key] - !!term[a.key]) || b.mensual - a.mensual);
  const visibles = verTodos ? orden : orden.slice(0, 8);
  const setT = (k, v) => { const nx = { ...term }; if (v) nx[k] = v; else delete nx[k]; setTerm(nx); };
  const total = orden.filter((g) => term[g.key]).reduce((sm, g) => sm + g.mensual, 0);
  if (!orden.length) return <div style={{ fontSize: 12, color: C.tx2 }}>No tienes ingresos cargados.</div>;
  return <>
    {visibles.map((g) => { const t = term[g.key]; return (
      <div key={g.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "6px 0", borderTop: `1px solid ${C.bd}` }}>
        <span style={{ flex: "1 1 160px", minWidth: 0, textDecoration: t ? "line-through" : "none", color: t ? C.tx2 : C.tx }}>{g.nombre}</span>
        <span style={{ fontSize: 13, whiteSpace: "nowrap", color: C.tx2 }}>{plata(Math.round(g.mensual))}/mes</span>
        <button style={btn(!t)} onClick={() => setT(g.key, null)}>Sigue</button>
        <button style={btn(!!t)} onClick={() => setT(g.key, t || 1)}>Se acaba</button>
        {t && <select style={{ ...inp, width: "auto" }} value={t} onChange={(e) => setT(g.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Desde ya" : `En ${y - 1} año${y === 2 ? "" : "s"}`}</option>)}</select>}
      </div>); })}
    {orden.length > 8 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Ver menos" : `Ver todos (${orden.length})`}</button>}
    {total > 0 && <div style={{ fontSize: 12, color: C.am, marginTop: 6 }}>{frase} {plata(Math.round(total))} al mes.</div>}
  </>;
}

// 24-oct-2026 (Santiago: "uno debería poder revisar cada inversión, cuánto
// vale, cuánto renta… veo que carga promedios de otro lado… el paso uno debe
// editar también los ingresos como fees, rentas de otras inversiones").
// Hoy = revisar y corregir PARA EL PLAN lo que tienes y lo que te entra.
// Las páginas Patrimonio, Ingresos y Egresos no se tocan.
function HoyDetalle({ user, cfg, set }) {
  const invs = inversionesHoy(user, cfg);
  const sueltos = ingresosSueltosHoy(user, cfg);
  const [abierto, setAbierto] = useState(null);
  const lbl = { fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 };
  const rh = cfg.rentaHoy || {}, ih = cfg.ingresoHoy || {};
  const setR = (id, v) => { const nx = { ...rh }; if (v === "" || v == null) delete nx[id]; else nx[id] = v; set("rentaHoy", nx); };
  const setI = (k, v) => { const nx = { ...ih }; if (v === "" || v == null) delete nx[k]; else nx[k] = v; set("ingresoHoy", nx); };
  const pctTxt = (v) => `${(Math.round(v * 10) / 10).toLocaleString("es-CO")} % al año`;
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "10px 0" };
  const totalInv = invs.filter((x) => !x.vende).reduce((sm, x) => sm + x.usada, 0), totalSue = sueltos.reduce((sm, x) => sm + x.mensual, 0);
  return <>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>Cada inversión: cuánto vale y cuánto renta</h3>
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Toca una para ver de dónde sale su renta. Si no es lo que te da hoy, corrígela aquí: solo cambia el plan.</p>
      {invs.map((x) => { const ab = abierto === x.id; return (
        <div key={x.id} style={fila}>
          <div onClick={() => setAbierto(ab ? null : x.id)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{x.nombre}</b><span>{plata(Math.round(x.valor))}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: x.usada > 0 ? C.gn : C.tx2 }}>
              <span>{x.usada > 0 ? `Renta ${plata(Math.round(x.usada))}/mes${x.corregida ? " (corregida)" : ""}` : "Sin renta: crece de valor"}</span>
              <span>{x.usada > 0 ? pctTxt(x.pctAnual) : ""} {ab ? "▴" : "▾"}</span>
            </div>
            {x.vende && <div style={{ fontSize: 11, color: C.am }}>En este plan se vende (paso 2).</div>}
          </div>
          {ab && <div style={{ marginTop: 8, fontSize: 12, color: C.tx2 }}>
            {x.ingresos.length === 0 && x.gastos.length === 0 && <div>No tiene ingresos ni gastos ligados en tus páginas Ingresos y Egresos.</div>}
            {x.ingresos.map((y, k) => <div key={"i" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>+ {y.nombre}{y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {x.gastos.map((y, k) => <div key={"g" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>− {y.nombre}{x.manual ? <i> · ya incluido en la renta</i> : y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {(x.ingresos.length > 0 || x.gastos.length > 0) && <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 4, color: C.tx }}><span>Renta neta según tus páginas</span><span>{plata(Math.round(x.neta))}/mes</span></div>}
            <label style={{ ...lbl, marginTop: 8 }}>¿Cuánto te deja al mes, neto? ($, opcional)
              <NumberInput style={inp} placeholder={x.neta > 0 ? fmtMilesEs(Math.round(x.neta)) : "Ej.: 57.500.000"} value={rh[x.id] ?? ""} onChange={(v) => setR(x.id, v)} />
              <span style={{ fontSize: 11 }}>Si lo dejas vacío se usa la renta de tus páginas. {x.valor > 0 ? "Ej.: 21 % al año de " + plata(Math.round(x.valor)) + " = " + plata(Math.round(x.valor * 0.21 / 12)) + "/mes." : ""}</span></label>
            {rh[x.id] != null && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setR(x.id, null)}>Volver a la de mis páginas</button>}
          </div>}
        </div>); })}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Rentas de inversiones{invs.some((x) => x.vende) ? " (sin las que vendes)" : ""}</span><span>{plata(Math.round(totalInv))}/mes</span></div>
    </div>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>Otros ingresos: fees, salarios, rentas sueltas</h3>
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Lo que te entra y no está ligado a una inversión. Corrige el monto para el plan si no es lo que recibes cada mes. Si alguno se acaba, apágalo en el paso 2.</p>
      {sueltos.length === 0 && <div style={{ fontSize: 13, color: C.tx2 }}>No tienes otros ingresos.</div>}
      {sueltos.map((x) => (
        <div key={x.key} style={fila}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{x.nombre}</b><span style={{ fontSize: 12, color: C.tx2 }}>{x.renta ? "renta" : "trabajo"}</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enIngresos))} value={ih[x.key] ?? ""} onChange={(v) => setI(x.key, v)} /></span>
            <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? `corregido (en Ingresos: ${plata(Math.round(x.enIngresos))})` : `${plata(Math.round(x.mensual))}/mes, de tu página Ingresos`}</span>
            {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setI(x.key, null)}>Quitar</button>}
          </div>
          {x.nota && !x.corregido && <div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>{x.nota}</div>}
        </div>))}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Otros ingresos</span><span>{plata(Math.round(totalSue))}/mes</span></div>
    </div>
  </>;
}
