// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { tx, esUS, pct as fmtPctR, miles, plata as plataR, ejemploMonto, monedaBase, localeCifras } from "../lib/region.js";
import { proyectarFuturo10, supuestosF10, nombreSup, retornoNominalPreset, rendimientoHintPct, validarMezcla, leerFuturos, migrarModifica, resumenEscenario, migrarClaves, anioCal, gastosLista, tarifaCiclo, regimenSugerido, sugerirVinculados, inversionesHoy, ingresosSueltosHoy } from "../lib/futuro10.js";
import { track } from "../lib/analytics";
import PlanInforme from "./PlanInforme";
import PlanComparador from "./PlanComparador";
import EscenariosCreados from "./infografia/EscenariosCreados";

const C = { bg: "var(--fp-card)", bg2: "var(--fp-raised)", bd: "rgba(var(--fp-ink),0.1)", tx: "var(--fp-txt)", tx2: "var(--fp-txt2)", gn: "#00c805", rd: "#ff5000", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(0,200,5,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
// 25-oct-2026 (Santiago: "uno ve ese primer listado y cree que van a ser
// tenidas en cuenta… no es intuitivo"). Cada cosa que tienes se revisa y se
// decide en un solo lugar (paso 1): valor, renta, si sigue o se vende, si se
// acaba. El paso 2 queda solo para lo que viene.
// 3-nov-2026: textos en el idioma de la sesión (region.js); se resuelven al pintar.
const pasosF10 = () => [tx("Lo que tienes", "What you have"), tx("Lo que viene", "What's coming"), tx("Tu plata", "Your money"), tx("Resultado", "Result"), tx("Escenarios", "Scenarios")];
// Cifras con el formato del país (CO: $1.234.567 · US: $1,234,567).
const plata = (v) => "$" + miles(v);
const fmtPctEs = (v, d = 1) => fmtPctR(v, d);
const fmtMilesEs = (v) => miles(v);
// Decimal sin símbolo con el formato del país (4,5 · 4.5).
const dec1 = (v) => (Math.round(v * 10) / 10).toLocaleString(localeCifras());
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos generales que puedes ajustar en algunos pasos; no es una recomendación de inversión. No incluye impuestos.";
export const avisoF10 = () => tx(AVISO_F10, "Illustrative projection, not advice. It's an estimate based on general assumptions you can adjust in some steps; it isn't an investment recommendation. Taxes aren't included.");

const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [], gastos: [] } };

export const MSG_DEMO_F10 = "En modo demo no se guardan escenarios.";
export const msgDemoF10 = () => tx(MSG_DEMO_F10, "Scenarios aren't saved in demo mode.");

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0, demo = false, vista: vistaProp, onCambiarVista }) {
  const [paso, setPaso] = useState(pasoInicial);
  // 24-oct-2026 (Santiago: "los avances que uno hace en la sección como que
  // no quedan guardados"). Lo que uno va decidiendo se guarda solo como
  // borrador (`futuro10.borrador`) y vuelve al entrar; "Guardar en tu cuenta"
  // sigue siendo para dejar un escenario con nombre y compararlo.
  const [cfg, setCfg] = useState(() => migrarClaves(migrarModifica(guardado.borrador ? { ...CONFIG_INICIAL, ...guardado.borrador } : CONFIG_INICIAL), user));
  const ultimoGuardado = useRef(JSON.stringify(guardado.borrador || null));
  // 25-oct-2026: el guardado automático usaba una copia vieja de `guardado` y,
  // si se guardaba un escenario justo después de un cambio, lo pisaba con la
  // lista anterior (volvían fechas viejas). Ahora usa siempre la última.
  const guardadoRef = useRef(guardado); guardadoRef.current = guardado;
  const editandoRef = useRef(null);
  useEffect(() => {
    if (demo || !onGuardar) return;
    const json = JSON.stringify(cfg);
    if (json === ultimoGuardado.current || JSON.stringify({ ...cfg, _clavesV2: undefined }) === JSON.stringify(CONFIG_INICIAL)) return;
    const t = setTimeout(() => {
      ultimoGuardado.current = json;
      const g = guardadoRef.current || {};
      // Si estás editando un escenario, cada cambio queda guardado en él.
      const id = editandoRef.current;
      const escs = id ? (g.escenarios || []).map((e) => (e.id === id ? { ...e, config: cfg, editado: new Date().toISOString() } : e)) : g.escenarios;
      onGuardar({ ...g, borrador: cfg, ...(escs ? { escenarios: escs } : {}) });
    }, 600);
    return () => clearTimeout(t);
  }, [cfg, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nombreEsc, setNombreEsc] = useState("");
  // 24-oct-2026 (Santiago: "una vez creado el escenario no deja cambiar el
  // nombre"). Al tocar Editar se carga su nombre y resumen, y se guarda sobre
  // el mismo escenario (o como uno nuevo).
  const [editandoId, setEditandoId] = useState(null);
  editandoRef.current = editandoId;
  const [descEsc, setDescEsc] = useState("");
  const [verEsc, setVerEsc] = useState(null);
  // 1-nov-2026 (Santiago): «Escenarios creados» es una subsección propia de
  // Mi futuro a 10 años, no el último paso del proceso. Abre ahí si hay
  // escenarios guardados; si no, en el proceso de creación.
  const [vistaLocal, setVistaLocal] = useState(() => (pasoInicial === 0 && (guardado.escenarios || []).length ? "creados" : "crear"));
  // Con `vista` la manda el menú (subsecciones Creador de escenarios / Escenarios
  // creados); sin ella, el componente la lleva solo (tests, usos sueltos).
  const vista = vistaProp || vistaLocal;
  const setVista = (v) => { if (onCambiarVista) onCambiarVista(v); else setVistaLocal(v); };
  const [verDetalle, setVerDetalle] = useState(false);
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => proyectarFuturo10(user, cfg), [user, cfg]);
  const esc = r.escenario;
  const escenarios = guardado.escenarios || [];
  const SUP = supuestosF10();
  const PASOS = pasosF10();
  const mezcla = cfg.mezcla || SUP.nortes[cfg.norte] || SUP.nortes.equilibrio;
  const ir = (i) => { setPaso(i); setVerEsc(null); track("futuro10_paso", { paso: i + 1 }); };
  // Planes para comparar: seguir como vas, lo que estás armando y los guardados.
  // El borrador solo aparece si es distinto de lo guardado (si no, se repite).
  // 24-oct-2026 (Santiago: "a veces queda un plan fantasma que es lo que uno
  // está armando y no hay dónde quitarlo"). Ahora se nombra y se puede guardar
  // o descartar desde Tus escenarios.
  const igualA = (c) => JSON.stringify({ ...migrarClaves(migrarModifica({ ...CONFIG_INICIAL, ...c }), user), escenario: cfg.escenario }) === JSON.stringify({ ...cfg, _clavesV2: true });
  const hayBorrador = JSON.stringify({ ...cfg, escenario: CONFIG_INICIAL.escenario, _clavesV2: undefined }) !== JSON.stringify(CONFIG_INICIAL) && !escenarios.some((e) => igualA(e.config));
  const editandoEsc = escenarios.find((e) => e.id === editandoId) || null;
  const nombreBorrador = editandoEsc ? `${editandoEsc.nombre} ${tx("(cambios sin guardar)", "(unsaved changes)")}` : tx("Sin guardar: lo que estás armando", "Unsaved: what you're building");
  const planesComparar = useMemo(() => {
    const ps = [{ nombre: tx("Hoy", "Today"), esHoy: true, r: proyectarFuturo10(user, { escenario: cfg.escenario }) }];
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
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `${tx("Escenario", "Scenario")} ${escenarios.length + 1}`, descripcion: descEsc.trim(), creado: new Date().toISOString(), config: cfg };
    onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc(""); setDescEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const editarEsc = (id) => { const e = escenarios.find((x) => x.id === id); if (!e) return; setVista("crear"); setCfg(migrarClaves(migrarModifica({ ...CONFIG_INICIAL, ...e.config }), user)); setEditandoId(e.id); setNombreEsc(e.nombre || ""); setDescEsc(e.descripcion || ""); ir(1); };
  const descartarBorrador = () => { setCfg(editandoEsc ? migrarClaves(migrarModifica({ ...CONFIG_INICIAL, ...editandoEsc.config }), user) : { ...CONFIG_INICIAL, escenario: cfg.escenario }); setEditandoId(null); setNombreEsc(""); setDescEsc(""); };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label={tx("Mi futuro a 10 años", "My 10-year future")} title={tx("¿Cómo se ve tu patrimonio en 10 años?", "What does your net worth look like in 10 years?")} compact
        subtitle={tx("1. Revisa lo que tienes y decide qué sigue · 2. Agrega lo que viene · 3. Mueve tu plata · 4. Mira el resultado. Tus datos reales no se tocan.", "1. Review what you have and decide what stays · 2. Add what's coming · 3. Move your money · 4. See the result. Your real data isn't changed.")} />
      <div style={{ ...card, borderColor: C.am, fontSize: 12, color: C.tx2 }}>{avisoF10()}</div>

      {!vistaProp && <>
      <div role="tablist" aria-label={tx("Mi futuro a 10 años", "My 10-year future")} style={{ display: "flex", gap: 4, background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 999, padding: 4, marginBottom: 14, width: "fit-content", maxWidth: "100%", flexWrap: "wrap" }}>
        {[["creados", `${tx("Escenarios creados", "Saved scenarios")}${escenarios.length ? ` (${escenarios.length})` : ""}`], ["crear", editandoEsc ? `${tx("Editando", "Editing")} «${editandoEsc.nombre}»` : tx("Crear o editar un escenario", "Create or edit a scenario")]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={vista === k} onClick={() => { setVista(k); setVerEsc(null); track("futuro10_vista", { vista: k }); }}
            style={{ minHeight: 40, padding: "0 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: vista === k ? 600 : 500, background: vista === k ? C.tx : "transparent", color: vista === k ? "var(--fp-card)" : C.tx2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </div>
      </>}

      {vista === "creados" && (verEsc ? <>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button style={btn(false)} onClick={() => setVerEsc(null)}>{tx("← Volver a tus escenarios", "← Back to your scenarios")}</button>
          {verEsc.id && !demo && <button style={btn(true)} onClick={() => { setVerEsc(null); editarEsc(verEsc.id); }}>{tx("Editar este escenario", "Edit this scenario")}</button>}
        </div>
        <div style={{ ...card, marginBottom: 14 }}><h3 style={{ margin: 0 }}>{verEsc.nombre}</h3>{verEsc.descripcion ? <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{verEsc.descripcion}</div> : null}</div>
        <PlanInforme r={verEsc.r} nombre={verEsc.nombre} inflacionPct={esc.inflacionPct} />
      </> : <>
        <EscenariosCreados planes={planesComparar} inflacionPct={esc.inflacionPct} demo={demo}
          onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc}
          onCrear={() => { setVista("crear"); ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        {escenarios.length > 0 && <button type="button" onClick={() => setVerDetalle((v) => !v)} style={{ ...btn(false), width: "100%", minHeight: 44, marginBottom: 12 }}>{verDetalle ? tx("Ocultar la comparación detallada", "Hide the detailed comparison") : tx("Ver la comparación detallada: curvas, reparto, ¿da para vivir? y el patrimonio como empresa", "See the detailed comparison: curves, allocation, can you live on it, and your wealth as a business")}</button>}
        {verDetalle && <PlanComparador planes={planesComparar} inflacionPct={esc.inflacionPct} onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc} onBorrar={demo ? null : borrar}
          onRecomendar={demo ? null : (id) => onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.map((e) => ({ ...e, recomendado: e.id === id ? !e.recomendado : false })) })} />}
      </>)}

      {vista === "crear" && <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
      </div>


      {paso === 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{tx("Lo que tienes: revisa y decide", "What you have: review and decide")}</h3>
          {/* 25-oct-2026 (Santiago: "deberíamos explicar que ahí se puede revisar y ajustar valores y rentabilidad de cada inversión"). */}
          <div style={{ fontSize: 13, color: C.tx, background: "rgba(0,200,5,0.08)", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            {tx(<>Todo lo que tienes, cosa por cosa. De cada inversión: <b>cuánto vale, cuánto renta y cuánto sube al año</b>, y si <b>sigue o se vende</b>. De cada ingreso: <b>cuánto te entra</b> y si <b>sigue o se acaba</b>. Lo tachado no cuenta en este escenario. Lo que corrijas solo cambia el plan; tus páginas no.</>, <>Everything you have, item by item. For each investment: <b>what it's worth, what it earns and how much it grows a year</b>, and whether you <b>keep it or sell it</b>. For each income: <b>how much comes in</b> and whether it <b>continues or ends</b>. Crossed-out items don't count in this scenario. Your edits only change the plan, not your other pages.</>)}
          </div>
          <Grid items={[
            [tx("Patrimonio neto", "Net worth"), plata(r.hoy.patrimonio)],
            [tx("Entra al mes", "Monthly inflow"), plata(r.hoy.ingresoMensual)],
            [tx("Sale al mes", "Monthly outflow"), plata(r.hoy.salidaMensual)],
            [tx("Flujo del mes", "Monthly cash flow"), plata(r.hoy.flujoMensual)],
            [tx("Liquidez", "Cash"), plata(r.hoy.liquidos)],
          ]} />
          <p style={{ color: C.tx2, fontSize: 12 }}>{tx("Las cifras de hoy no incluyen impuestos.", "Today's figures don't include taxes.")}</p>
        </div>
      )}
      {paso === 0 && <HoyDetalle user={user} cfg={cfg} set={set} setCfg={setCfg} r={r} />}

      {paso === 1 && (<>
        {/* 24-oct-2026 (Santiago: "veo que se pisan las mangueras de ambas
            secciones"). El paso 2 solo decide; todo lo que mueve plata va en
            el paso 3, Tu plata, con el saldo a la vista y el origen de cada peso. */}
        <div style={card}>
          <Seccion n={2} titulo={tx("Lo que viene", "What's coming")} sub={tx("Lo que empieza más adelante: una pensión, un local que te entregan, tu casa, la universidad de los hijos. Lo que ya tienes (vender, apagar rentas) se decide en el paso 1.", esUS() ? "Things that start later: a pension or Social Security, a property you take over, your home, the kids' college. What you already have (selling, stopping income) is decided in step 1." : "Things that start later: a pension, a property handed over to you, your home, the kids' college. What you already have (selling, stopping income) is decided in step 1.")} />
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} activos={r.activos} gastosHoy={r.gastosHoy || []} ingresosHoy={r.ingresosHoy || []} fuentes={r.fuentes || []} irHoy={() => { ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        </div>
      </>)}

      {paso === 2 && (<>
        <div style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 2 }}>{tx("Tu plata", "Your money")}</h3>
          <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>{tx("Lo que tienes para mover: lo que vendes, capital nuevo que traigas de afuera o tu liquidez de hoy. Cada uso se descuenta y siempre ves cuánto te queda.", "What you can move: what you sell, new capital from outside, or the cash you have today. Each use is deducted and you always see what's left.")}</p>
          <div id="f10-saldo"><Saldo r={r} /></div>
        </div>
        <div style={card}>
          <Seccion n="A" titulo={tx("Pagar deudas", "Pay off debt")} sub={tx("La deuda de un activo que vendes se paga sola con esa venta. Las demás, márcalas si quieres pagarlas con lo vendido.", "Debt tied to an asset you sell is paid off with that sale. Mark any other debt you want to pay with the proceeds.")} />
          {(r.deudas || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} /> : <p style={{ color: C.tx2, fontSize: 13 }}>{tx("No tienes deudas con saldo.", "You have no outstanding debt.")}</p>}
        </div>
        <div style={card}>
          <Seccion n="B" titulo={tx("Invertir en lo que ya tienes", "Invest in what you already own")} sub={tx("Plata que le metes a algo tuyo: una obra (la bodega en tu lote) o más capital (IBKR). Elige de dónde sale.", "Money you put into something you own: a build-out (a warehouse on your lot) or more capital (a brokerage account). Choose where it comes from.")} />
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
                  <button style={btn(activo)} onClick={toggle}>{activo ? tx("Le voy a invertir ✓", "I'll invest in it ✓") : tx("Le voy a invertir", "I'll invest in it")}</button>
                </div>
                {activo && <div style={{ marginTop: 8 }}><AporteCampos x={cfg.reinversiones[iR]} up={upR} det={detR} activos={r.activos} vendidos={r.vendidos || []} /></div>}
              </div>
            );
          })}
        </div>
        <div style={card}>
          <Seccion n="C" titulo={tx("Inversiones nuevas", "New investments")} sub={esUS() ? tx("Algo que todavía no tienes: un CD, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a CD, a fund, another investment. Choose where it comes from.") : tx("Algo que todavía no tienes: un CDT, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a term deposit, a fund, another investment. Choose where it comes from.")} />
          {cfg.nuevas.map((x, i) => {
            const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y));
            const hint = rendimientoHintPct(esc);
            const lbl = { fontSize: 12, color: C.tx2 };
            return (
              <div key={i} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                <label style={lbl}>{tx("Tipo", "Type")}<select style={inp} value={x.preset} onChange={(e) => up({ preset: e.target.value })}>
                  {Object.entries(SUP.presets).map(([k, p]) => <option key={k} value={k}>{nombreSup(p)}</option>)}
                  <option value="custom">{tx("Otra (personalizada)", "Other (custom)")}</option>
                </select></label>
                <label style={lbl}>{tx("¿Cuánto? ($)", "How much? ($)")}<NumberInput style={inp} placeholder={tx("Monto", "Amount")} value={x.monto} onChange={(v) => up({ monto: v })} /></label>
                <label style={lbl}>{tx("¿De dónde sale la plata?", "Where does the money come from?")}<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>
                {x.preset === "custom" && <>
                  <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder={esUS() ? tx("Ej.: negocio, CD, rancho", "e.g. business, CD, ranch") : tx("Ej.: negocio, CDT, finca", "e.g. business, term deposit, farm")} /></label>
                  <label style={lbl}>{tx("¿Cuándo?", "When?")}<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
                  <label style={lbl}>{tx("Rendimiento anual esperado (%)", "Expected annual return (%)")}<InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} />
                    <span style={{ fontSize: 12 }}>{tx("Si no sabes, usa", "If you're not sure, use")} {fmtPctEs(hint, 1)}.</span></label>
                  {/* 3-nov-2026: en EE. UU. todo va en dólares (moneda base); no hay selector de moneda. */}
                  {!esUS() && <label style={lbl}>{tx("Moneda", "Currency")}<select style={inp} value={x.moneda || monedaBase()} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>
                    {x.moneda === "USD" && <span style={{ fontSize: 12, color: C.am }}>{tx("En dólares, el resultado en pesos también depende de cómo se mueva la tasa de cambio.", "In dollars, the result in pesos also depends on how the exchange rate moves.")}</span>}</label>}
                  <label style={lbl}>{tx("De lo que rinde, ¿cuánto te llega?", "Of what it earns, how much do you receive?")}<select style={inp} value={x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{PARTES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                    {(() => { const rend = (x.rendimientoNomPct === "" || x.rendimientoNomPct == null ? hint : Number(x.rendimientoNomPct)) / 100; const p = (x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)) / 100; const mes = (Number(x.monto) || 0) * rend * p / 12;
                      return <span style={{ fontSize: 12, color: mes > 0 ? C.gn : C.tx2 }}>{mes > 0 ? tx(`Te llegan ${plata(Math.round(mes))} al mes; ${p < 1 ? "el resto se reinvierte" : "el capital queda igual"}.`, `You receive ${plata(Math.round(mes))} a month; ${p < 1 ? "the rest is reinvested" : "the principal stays the same"}.`) : tx("Todo se reinvierte: crece con interés compuesto.", "Everything is reinvested: it compounds.")}</span>; })()}</label>
                </>}
                <div><button style={btn(false)} onClick={() => set("nuevas", cfg.nuevas.filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button></div>
              </div>
            );
          })}
          <button style={{ ...btn(true), width: "100%", padding: "12px", marginTop: 6 }} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "", fuente: "venta" }])}>{tx("+ Crear inversión nueva", "+ Add a new investment")}</button>
        </div>
        <div style={card}>
          {/* 25-oct-2026 (Santiago: "asociativos… es un negocio cíclico que sale con un capital una vez pero se sigue haciendo y el dinero que sobra se reinvierte"). */}
          <Seccion n="D" titulo={tx("Negocios que se repiten", "Repeating deals")} sub={tx("Pones un capital una vez y cada ciclo te deja una ganancia: asociativos, construir y vender, un proyecto que se repite. El capital vuelve a entrar en el siguiente ciclo.", "You put in capital once and each cycle leaves a profit: build-to-sell, fix-and-flip, a project you repeat. The capital goes back in for the next cycle.")} />
          <details style={{ fontSize: 12, color: C.tx2, marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", color: C.tx }}>{tx("¿Cuándo uso esto y cuándo lo otro?", "When do I use this vs. the others?")}</summary>
            <div style={{ marginTop: 6, lineHeight: 1.5 }}>
              <div><b style={{ color: C.tx }}>{tx("Negocio que se repite (aquí):", "Repeating deal (here):")}</b> {tx("metes plata, al terminar la sacas con ganancia y la vuelves a meter. Ej.: asociativos de vivienda, comprar–remodelar–vender, un cultivo por cosecha. El capital es el mismo cada vez.", "you put money in, take it out with a profit at the end, and put it back in. e.g. housing development pools, fix-and-flip, a seasonal crop. The capital is the same each time.")}</div>
              <div style={{ marginTop: 4 }}><b style={{ color: C.tx }}>{tx("Inversión nueva (C):", "New investment (C):")}</b> {esUS() ? tx("la plata se queda invertida y rinde un % cada año (un CD, un fondo, acciones). No hay ciclos.", "the money stays invested and earns a % every year (a CD, a fund, stocks). No cycles.") : tx("la plata se queda invertida y rinde un % cada año (un CDT, un fondo, acciones). No hay ciclos.", "the money stays invested and earns a % every year (a term deposit, a fund, stocks). No cycles.")}</div>
              <div style={{ marginTop: 4 }}><b style={{ color: C.tx }}>{tx("Compra o construcción (paso 2, Lo que viene):", "Purchase or build (step 2, What's coming):")}</b> {tx("algo que construyes o compras UNA vez y te quedas con él (tu casa, una bodega para rentar).", "something you build or buy ONCE and keep (your home, a warehouse to rent out).")}</div>
            </div>
          </details>
          <Ciclos lista={cfg.ciclos || []} set={(v) => set("ciclos", v)} det={r.ciclosDetalle || []} destinos={[...(r.fuentes || []).filter((f) => !String(f.id).startsWith("ciclo_") && !String(f.id).startsWith("apartado_")), { id: "c_liquidez", nombre: tx("Liquidez", "Cash") }, { id: "c_disponible", nombre: tx("Se deja disponible (para cualquier eventualidad)", "Kept available (for anything that comes up)") }]} />
        </div>
        <div style={card}>
          <Seccion n="E" titulo={tx("Lo que sobra y en qué lo reinviertes", "Your surplus and where you reinvest it")} sub={tx("Dos cosas distintas: lo que sobra de las ventas (una vez) y lo que te sobra cada mes de tus rentas e ingresos.", "Two different things: what's left from sales (one time) and what's left over every month from your income.")} />
          <SobraMensual r={r} cfg={cfg} set={set} destinos={[...(r.fuentes || []).filter((f) => !String(f.id).startsWith("ciclo_") && !String(f.id).startsWith("apartado_")), { id: "c_liquidez", nombre: tx("Liquidez", "Cash") }, { id: "c_disponible", nombre: tx("Se deja disponible (para cualquier eventualidad)", "Kept available (for anything that comes up)") }]} />
          <div style={{ fontWeight: 700, marginTop: 14 }}>{tx("Lo que sobra de las ventas:", "Left over from sales:")} {plata(Math.round((r.bolsaDetalle || {}).restante || 0))} <span style={{ fontWeight: 400, fontSize: 12, color: C.tx2 }}>{tx("(una sola vez)", "(one time)")}</span></div>
          <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{tx("Así se reparte. También es el reparto de lo que sobre cada mes y no asignes arriba. Son ejemplos de mezcla, no recomendaciones.", "Here's how it's split. The same split applies to any monthly surplus you don't assign above. These are sample mixes, not recommendations.")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button style={btn(!!cfg.repartoDisponible)} onClick={() => setCfg((p) => ({ ...p, repartoDisponible: true }))}>{tx("Dejarlo disponible", "Keep it available")}</button>
            {Object.entries(SUP.nortes).map(([k, nt]) => <button key={k} style={btn(!cfg.repartoDisponible && !cfg.mezcla && cfg.norte === k)} onClick={() => setCfg((p) => ({ ...p, norte: k, mezcla: null, repartoDisponible: false }))}>{nombreSup(nt)}</button>)}
            <button style={btn(!cfg.repartoDisponible && !!cfg.mezcla)} onClick={() => setCfg((p) => ({ ...p, repartoDisponible: false, mezcla: { liquidez: mezcla.liquidez, renta: mezcla.renta, crecimiento: mezcla.crecimiento } }))}>{tx("Personalizado", "Custom")}</button>
          </div>
          {cfg.repartoDisponible && <div style={{ fontSize: 12, color: C.gn, marginTop: 6 }}>{tx("Queda disponible en tu cuenta para cualquier eventualidad (rinde como liquidez), sin invertirse.", "It stays available in your account for anything that comes up (earns like cash), without being invested.")}</div>}
          {!cfg.repartoDisponible && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginTop: 10 }}>
            {["liquidez", "renta", "crecimiento"].map((k) => <label key={k} style={{ fontSize: 12, color: C.tx2 }}>{tx(k[0].toUpperCase() + k.slice(1), { liquidez: "Cash", renta: "Income", crecimiento: "Growth" }[k])} (%)
              {cfg.mezcla ? <InputDecimalEs style={inp} value={cfg.mezcla[k]} onChange={(v) => set("mezcla", { ...cfg.mezcla, [k]: v })} /> : <div style={{ color: C.tx, fontSize: 15 }}>{fmtPctEs(mezcla[k], 0)}</div>}</label>)}
          </div>}
          {validarMezcla(cfg.mezcla) && <p role="alert" style={{ color: C.rd, fontSize: 12 }}>{validarMezcla(cfg.mezcla)}</p>}
        </div>
        <SaldoFijo r={r} onVer={() => document.getElementById("f10-saldo")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
      </>)}

      {paso === 3 && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{tx("Resultado a 10 años", "10-year result")}</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{tx("Así se ve este escenario. Guárdalo en el paso 5 para compararlo con otros.", "Here's how this scenario looks. Save it in step 5 to compare it with others.")}</div>
        </div>
        <PlanInforme r={r} nombre={tx("Este escenario", "This scenario")} inflacionPct={esc.inflacionPct} />
        {r.alertas.length > 0 && <div style={{ ...card, borderColor: C.rd }}>
          <b style={{ color: C.rd }}>{tx("Alertas de liquidez", "Cash alerts")}</b>
          {dedupe(r.alertas).map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.texto}</div>)}
        </div>}
        {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>{tx(`Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. Los supuestos ${esc.nombre.toLowerCase()} suponen devaluación real de ${fmtPctEs(SUP.presets.sp500.devaluacionRealPct)}.`, `What's in dollars carries currency risk: if the peso strengthens, it's worth less in pesos. The ${nombreSup(esc).toLowerCase()} assumptions use a real devaluation of ${fmtPctEs(SUP.presets.sp500.devaluacionRealPct)}.`)}</p>}
      </>)}

      {paso === 4 && (<>
        {/* 25-oct-2026 (Santiago: "le doy click al escenario que quiero ver y me
            sale que le ponga nombre al plan"). Guardar solo aparece cuando hay
            algo sin guardar o estás editando, y nunca encima de un informe. */}
        {!verEsc && (hayBorrador || editando) && <div style={card}>
          <h3 style={{ marginTop: 0 }}>{editando ? `${tx("Estás editando", "You're editing")} «${editando.nombre}»` : tx("Tienes un plan sin guardar", "You have an unsaved plan")}</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginBottom: 8 }}>{editando ? tx("Cada cambio se guarda solo en este escenario. Aquí puedes cambiarle el nombre o guardarlo como uno nuevo.", "Every change is saved to this scenario automatically. Here you can rename it or save it as a new one.") : tx("Lo que armaste en los pasos 1 a 3 todavía no tiene nombre. Ponle uno para guardarlo y compararlo con los otros.", "What you built in steps 1–3 doesn't have a name yet. Name it to save it and compare it with the others.")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder={tx("Nombre del escenario, ej.: Conservador + casa", "Scenario name, e.g. Conservative + house")} value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />
            {editando ? <>
              <button style={btn(!demo)} disabled={demo} onClick={guardarCambios}>{tx("Guardar nombre", "Save name")}</button>
              <button style={btn(false)} disabled={demo} onClick={guardar}>{tx("Guardar como nuevo", "Save as new")}</button>
              <button style={btn(false)} onClick={() => { setEditandoId(null); setNombreEsc(""); setDescEsc(""); }}>{tx("Terminar de editar", "Done editing")}</button>
            </> : <button style={btn(!demo)} disabled={demo} onClick={guardar}>{tx("Guardar este escenario", "Save this scenario")}</button>}
          </div>
          <input style={{ ...inp, marginTop: 6 }} placeholder={`${tx("Resumen en una frase (opcional). Si lo dejas vacío:", "One-line summary (optional). If left blank:")} «${resumenEscenario(r)}»`} value={descEsc} onChange={(e) => setDescEsc(e.target.value)} />
        </div>}
        {!verEsc && demo && <p style={{ color: C.am, fontSize: 12 }}>{msgDemoF10()}</p>}
        {!verEsc && !hayBorrador && !editando && <div style={{ fontSize: 12, color: C.tx2, marginBottom: 10 }}>{tx("Toca una tarjeta para ver ese escenario completo. Para crear otro, cambia algo en los pasos 1 a 3 y vuelve aquí a guardarlo.", "Tap a card to see that full scenario. To create another, change something in steps 1–3 and come back here to save it.")}</div>}
        {verEsc ? <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button style={btn(false)} onClick={() => setVerEsc(null)}>{tx("← Volver a comparar", "← Back to compare")}</button>
            {verEsc.id && !demo && <button style={btn(true)} onClick={() => { setVerEsc(null); editarEsc(verEsc.id); }}>{tx("Editar este escenario", "Edit this scenario")}</button>}
          </div>
          <div style={{ ...card, marginBottom: 14, borderTop: `3px solid ${verEsc.color || C.gn}` }}><h3 style={{ margin: 0 }}>{verEsc.nombre}</h3>{verEsc.descripcion ? <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{verEsc.descripcion}</div> : null}</div>
          <PlanInforme r={verEsc.r} nombre={verEsc.nombre} inflacionPct={esc.inflacionPct} />
        </> : <PlanComparador planes={planesComparar} inflacionPct={esc.inflacionPct} onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc} onBorrar={demo ? null : borrar}
          onGuardarBorrador={demo ? null : () => { if (editandoEsc) guardarCambios(); else { window.scrollTo?.({ top: 0, behavior: "smooth" }); guardar(); } }} onDescartarBorrador={demo ? null : descartarBorrador}
          onRecomendar={demo ? null : (id) => onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.map((e) => ({ ...e, recomendado: e.id === id ? !e.recomendado : false })) })} />}
      </>)}


      {/* 24-oct-2026 (Santiago: "que sea fluido el proceso, una etapa te lleva a
          la siguiente"). Al final de cada paso, el siguiente. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {paso > 0 && <button style={{ ...btn(false), padding: "12px" }} onClick={() => { ir(paso - 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{tx("← Atrás", "← Back")}</button>}
        {paso < PASOS.length - 1 && <button style={{ ...btn(true), flex: 1, padding: "12px", fontWeight: 600 }} onClick={() => { ir(paso + 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{tx("Siguiente:", "Next:")} {PASOS[paso + 1]} →</button>}
      </div>
      </>}

      <details style={card}>
        <summary style={{ cursor: "pointer" }}>{tx("Supuestos (inflación y cuánto rinden las inversiones)", "Assumptions (inflation and investment returns)")}</summary>
        <p style={{ color: C.tx2, fontSize: 12 }}>{tx("No son tus escenarios: es cómo se comporta el mercado. «Normales» es lo esperado; «Prudentes» supone más inflación y menos rendimiento; «Favorables», lo contrario.", "These aren't your scenarios: they're how the market behaves. \"Typical\" is what's expected; \"Cautious\" assumes higher inflation and lower returns; \"Favorable\", the opposite.")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>{tx("Supuestos del mercado:", "Market assumptions:")}</span>
        {Object.entries(SUP.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{nombreSup(e)}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>{tx("inflación", "inflation")} {fmtPctEs(esc.inflacionPct)}</span>
      </div>

        <TablaSupuestos esc={esc} />
      </details>
    </div>
  );
}

const ANIOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// 25-oct-2026 (Santiago: "se cambian fechas… cosas que decía que se activaban
// en X años"). El selector decía «En 5 años» y el resultado «desde el año 6»:
// era lo mismo, pero parecía otra fecha. Ahora todo dice el año del plan.
export const etqAnio = (y) => (y === 1 ? `${tx("Ya", "Now")} (${anioCal(1)})` : `${tx("En", "In")} ${anioCal(y)}`);
// "dentro de N años" / "in N years" en el idioma de la sesión.
const enAnios = (k) => tx(`${k} año${k === 1 ? "" : "s"}`, `${k} year${k === 1 ? "" : "s"}`);
function LoQueViene({ cfg, set, esc, owners, activos = [], gastosHoy = [], ingresosHoy = [], fuentes = [], irHoy }) {
  const [verTodos, setVerTodos] = useState(false);
  const f = { ingresos: [], activos: [], gastos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upG = (i, v) => put("gastos", (f.gastos || []).map((x, j) => (j === i ? { ...x, ...v } : x)));
  const lbl = { fontSize: 12, color: C.tx2 };
  const g = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.bd}` };
  const selAnio = (v, on, vacioTxt) => <select style={inp} value={v ?? ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}>{vacioTxt && <option value="">{vacioTxt}</option>}{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>;
  const SUP = supuestosF10();
  const hintVal = (cl) => fmtPctEs(((1 + esc.inflacionPct / 100) * (1 + (cl === "inmueble" || cl === "vivienda" || cl === "lote" ? SUP.presets.fincaRaiz.valorizacionSpread : SUP.otrosRealSpread) / 100) - 1) * 100, 1);
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
          <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Ingresos futuros", "Future income")}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalIng > 0 ? C.gn : C.tx }}>{totalIng > 0 ? `${plata(totalIng)} ${tx("al mes", "a month")}` : tx("Ninguno", "None")}</div>
          {fut.ingresos.length > 0 && <div style={{ fontSize: 12, color: C.tx2 }}>{fut.ingresos.length} {fut.ingresos.length === 1 ? tx("ingreso", "income") : tx("ingresos", "incomes")} · {tx("el primero", "the first")} {primerAnio === 1 ? tx("desde ya", "starting now") : `${tx("en", "in")} ${enAnios(primerAnio - 1)}`}</div>}
        </div>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Compras y construcciones", "Purchases and builds")}</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{totalAct > 0 ? plata(totalAct) : tx("Ninguno", "None")}</div>
          {f.activos.length > 0 && <div style={{ fontSize: 12, color: C.tx2 }}>{f.activos.length} {f.activos.length === 1 ? tx("activo", "asset") : tx("activos", "assets")}</div>}
        </div>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Gastos futuros", "Future expenses")}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalGas > 0 ? C.am : C.tx }}>{totalGas > 0 ? `${plata(totalGas)} ${tx("al año", "a year")}` : tx("Ninguno", "None")}</div>
          {(fut.gastos || []).length > 0 && <div style={{ fontSize: 12, color: C.tx2 }}>{fut.gastos.length} {fut.gastos.length === 1 ? tx("gasto", "expense") : tx("gastos", "expenses")}</div>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.am, background: "rgba(245,158,11,0.08)", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>{tx("¿La renta sale de un activo que ya tienes? Elígelo en «¿De dónde sale?». Si además le vas a meter plata (construir la bodega en el lote), hazlo en el paso 3, Tu plata → «Invertir en lo que ya tienes»: ahí van la inversión y la renta juntas.", "Does the income come from an asset you already own? Pick it in \"Where does it come from?\". If you're also putting money into it (building on the lot), do it in step 3, Your money → \"Invest in what you already own\": the investment and the income go together there.")}</div>
      <h4 style={{ margin: "8px 0" }}>{tx("Ingresos futuros", "Future income")}</h4>
      {f.ingresos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} placeholder={esUS() ? tx("Ej.: Seguro Social", "e.g. Social Security") : tx("Ej.: pensión", "e.g. pension")} onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>{esUS() ? tx("Al mes ($, dólares de hoy)", "Per month ($, today's dollars)") : tx("Al mes ($, pesos de hoy)", "Per month ($, today's pesos)")}<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            {!x.activoId && <span style={{ fontSize: 12 }}>{esUS() ? tx("Si es el Seguro Social o una pensión, usa el estimado de tu cuenta en ssa.gov o de tu plan. Sube con la inflación.", "For Social Security or a pension, use the estimate from your ssa.gov account or your plan. It grows with inflation.") : tx("Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. Sube con la inflación.", "For a pension, use the monthly estimate from your pension fund. It grows with inflation.")}</span>}</label>
          <label style={lbl}>{tx("¿De dónde sale?", "Where does it come from?")}<select style={inp} value={x.activoId || ""} onChange={(e) => upI(i, { activoId: e.target.value || null })}><option value="">{tx("No sale de un activo (pensión, honorarios…)", "Not from an asset (pension, fees…)")}</option>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label style={lbl}>{tx("Empieza", "Starts")}{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          {x.activoId && <label style={lbl}>{tx(`¿Cuánto sube el valor de ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "ese activo"} al año? (%, opcional)`, `How much does ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "that asset"} appreciate a year? (%, optional)`)}<InputDecimalEs style={inp} placeholder={tx("Ej.: 5", "e.g. 5")} value={x.valorizacionNomPct ?? ""} onChange={(v) => upI(i, { valorizacionNomPct: v })} /><span style={{ fontSize: 12 }}>{tx("Es el valor del activo, no la renta. La renta sube cada año con la inflación.", "This is the asset's value, not the income. The income grows with inflation each year.")}</span></label>}
          {/* 24-oct-2026 (Santiago, con la pensión puesta "termina año 7" sin querer:
              "no veo esa opción"). En el iPhone «Sigue» quedaba escondida arriba de la
              rueda. Ahora son dos botones y el año solo aparece si termina. */}
          <div style={lbl}>{tx("¿Hasta cuándo?", "Until when?")}
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" style={btn(vacio(x.hasta))} onClick={() => upI(i, { hasta: "" })}>{tx("Sigue siempre", "Ongoing")}</button>
              <button type="button" style={btn(!vacio(x.hasta))} onClick={() => upI(i, { hasta: vacio(x.hasta) ? Math.max(Number(x.desde) || 1, 10) : x.hasta })}>{tx("Termina", "Ends")}</button>
            </div>
            {!vacio(x.hasta) && <div style={{ marginTop: 6 }}>{selAnio(x.hasta, (v) => upI(i, { hasta: v === "" ? Number(x.desde) || 1 : v }))}</div>}
          </div>
          {(Number(x.mensual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.gn }}>{textoIngresoFuturo(x)}</div>}
          {owners.length > 1 && <label style={lbl}>{tx("Titular (opcional)", "Owner (optional)")}<select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select></label>}
          <button style={btn(false)} onClick={() => put("ingresos", f.ingresos.filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button>
        </div>))}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("ingresos", [...f.ingresos, { nombre: "", mensual: "", desde: 1, hasta: "" }])}>{tx("+ Agregar ingreso futuro", "+ Add future income")}</button>
      {/* 24-oct-2026 (Santiago: "la parte de activos futuros no está bien
          pensada, solo deja elegir finca raíz y otros… si quiero construir una
          casa, ¿ese es el lugar? ¿y debo decir de dónde sale la plata?"). */}
      <h4 style={{ margin: "16px 0 4px" }}>{tx("Compras y construcciones futuras", "Future purchases and builds")}</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{tx("Algo que vas a comprar o construir: tu casa, un local, un lote. Dices cuánto cuesta, cuándo está listo y de dónde sale la plata.", "Something you'll buy or build: your home, a storefront, a lot. Say what it costs, when it's ready and where the money comes from.")}</div>
      {f.activos.map((x, i) => {
        const tipo = x.clase || "inmueble";
        const renta = tipo === "inmueble" || tipo === "negocio";
        const total = Number(x.valor) || 0, antes = Math.min(total, Number(x.cuotaInicial) || 0);
        const cuando = (y) => (y === 1 ? tx("ya", "now") : `${tx("en", "in")} ${enAnios(y - 1)}`);
        // Fuentes en pesos (Santiago: "el valor que voy a retirar de cada una").
        // Escenarios con % se pasan a pesos sobre el valor total.
        const fps = (Array.isArray(x.fuentes) ? x.fuentes : x.fuenteId ? [{ id: x.fuenteId, pct: 100 }] : []).map((z) => (z.monto == null && z.pct != null ? { id: z.id, monto: Math.round((Number(z.pct) || 0) / 100 * (Number(x.valor) || 0)) } : z));
        const setFps = (arr) => upA(i, { fuentes: arr.map(({ id, monto }) => ({ id, monto })), fuenteId: null });
        const sumaFps = fps.reduce((sm, z) => sm + (Number(z.monto) || 0), 0);
        const nomF = (id) => (fuentes.find((y) => y.id === id) || {}).nombre || tx("una inversión", "an investment");
        const validas = fps.filter((z) => z.id && Number(z.monto) > 0);
        const faltaF = Math.max(0, (Number(x.valor) || 0) - sumaFps);
        const fuenteNom = validas.length ? validas.map((z) => `${plata(Number(z.monto))} ${tx("de", "from")} ${nomF(z.id)}`).join(" + ") + (faltaF > 0 ? ` + ${plata(faltaF)} ${tx("de tus cuentas de hoy", "from your current accounts")}` : "") : tx("tu liquidez", "your cash");
        return (
          <div key={i} style={g}>
            <label style={lbl}>{tx("¿Qué es?", "What is it?")}<select style={inp} value={tipo} onChange={(e) => upA(i, { clase: e.target.value })}>
              <option value="vivienda">{tx("Casa para vivir", "Home to live in")}</option><option value="inmueble">{tx("Inmueble para rentar", "Rental property")}</option><option value="lote">{tx("Lote", "Lot")}</option><option value="negocio">{tx("Negocio", "Business")}</option><option value="otro">{tx("Otro", "Other")}</option></select></label>
            <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} placeholder={tipo === "vivienda" ? tx("Ej.: casa finca", "e.g. lake house") : tx("Ej.: local comercial", "e.g. storefront")} onChange={(e) => upA(i, { nombre: e.target.value })} /></label>
            <label style={lbl}>{tx("¿Cuánto cuesta en total? ($)", "Total cost? ($)")}<NumberInput style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} /></label>
            <label style={lbl}>{tx("¿Cuánto vale cuando está lista? ($, opcional)", "What is it worth when finished? ($, optional)")}<NumberInput style={inp} placeholder={tx("Si vale más de lo que cuesta", "If it's worth more than it costs")} value={x.valorAlTerminar ?? ""} onChange={(v) => upA(i, { valorAlTerminar: v })} />
              <span style={{ fontSize: 12 }}>{tx("Una construcción suele valer más al terminarla. Desde ahí sube con el % de abajo.", "A new build is often worth more once finished. From there it grows at the % below.")}</span></label>
            <label style={lbl}>{tx("¿Cuándo está lista?", "When is it ready?")}{selAnio(x.entrega || 1, (v) => upA(i, { entrega: v || 1, anioCuota: Math.min(Number(x.anioCuota) || 1, v || 1) }))}
              <span style={{ fontSize: 12 }}>{tx("Cuando la recibes o terminas de construir.", "When you take possession or finish building.")}</span></label>
            <div style={{ ...lbl, gridColumn: "1 / -1" }}>{tx("¿De dónde sale la plata?", "Where does the money come from?")}
              {fps.map((fp, k) => <div key={k} style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                <select style={{ ...inp, flex: 1 }} value={fp.id || ""} onChange={(e) => setFps(fps.map((z, j) => (j === k ? { ...z, id: e.target.value } : z)))}><option value="">{tx("Elige una inversión", "Choose an investment")}</option>{fuentes.map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}</select>
                <span style={{ width: 150 }}><NumberInput style={inp} placeholder={tx("¿Cuánto sacas?", "How much?")} value={fp.monto ?? ""} onChange={(v) => setFps(fps.map((z, j) => (j === k ? { ...z, monto: v } : z)))} /></span>
                <button style={{ ...btn(false), padding: "6px 8px" }} onClick={() => setFps(fps.filter((_, j) => j !== k))}>✕</button>
              </div>)}
              <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setFps([...fps, { id: "", monto: faltaF || "" }])}>+ {fps.length ? tx("Otra inversión", "Another investment") : tx("Sale de una inversión", "From an investment")}</button>
              <span style={{ display: "block", fontSize: 12, marginTop: 4 }}>{fps.length === 0 ? tx("Si no eliges, sale de tus cuentas de hoy (ahorros y efectivo).", "If you don't choose, it comes from your current accounts (savings and cash).") : faltaF > 0 ? tx(`Faltan ${plata(faltaF)}: salen de tus cuentas de hoy.`, `${plata(faltaF)} short: it comes from your current accounts.`) : sumaFps > (Number(x.valor) || 0) ? tx("Sacas más de lo que cuesta.", "You're taking more than it costs.") : tx("Completo. Si alguna no alcanza, lo que falta sale de tus cuentas de hoy.", "Covered. If any source falls short, the rest comes from your current accounts.")}</span>
            </div>
            <label style={lbl}>{tx("¿Pagas una parte antes? ($, opcional)", "Do you pay part of it upfront? ($, optional)")}<NumberInput style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} />
              <span style={{ fontSize: 12 }}>{tx("Un anticipo o la primera etapa de la obra. Si no, todo se paga cuando está lista.", "A down payment or the first phase of the build. Otherwise it's all paid when it's ready.")}</span></label>
            {antes > 0 && <label style={lbl}>{tx("¿Cuándo pagas esa parte?", "When do you pay that part?")}{selAnio(x.anioCuota || 1, (v) => upA(i, { anioCuota: Math.min(v || 1, Number(x.entrega) || 1) }))}</label>}
            {renta && <>
              <label style={lbl}>{tx("¿Cuánto renta al mes? ($, neto, opcional)", "Monthly rent? ($, net, optional)")}<NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} /></label>
              {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>{tx("¿Desde cuándo renta?", "Rented out from when?")}{selAnio(x.rentaDesde || x.entrega || 1, (v) => upA(i, { rentaDesde: v || 1 }))}</label>}
            </>}
            <label style={lbl}>{tx("¿Cuánto sube su valor al año? (%)", "Annual appreciation (%)")}<InputDecimalEs style={inp} placeholder={hintVal(tipo)} value={x.valorizacionNomPct ?? ""} onChange={(v) => upA(i, { valorizacionNomPct: v })} />
              <span style={{ fontSize: 12 }}>{tx("Si no sabes, déjalo en", "If you're not sure, leave it at")} {hintVal(tipo)}.</span></label>
            {total > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>
              {antes > 0 ? tx(`Pagas ${plata(antes)} ${cuando(Number(x.anioCuota) || 1)} y ${plata(total - antes)} ${cuando(Number(x.entrega) || 1)}`, `You pay ${plata(antes)} ${cuando(Number(x.anioCuota) || 1)} and ${plata(total - antes)} ${cuando(Number(x.entrega) || 1)}`) : tx(`Pagas ${plata(total)} ${cuando(Number(x.entrega) || 1)}`, `You pay ${plata(total)} ${cuando(Number(x.entrega) || 1)}`)}: {validas.length ? fuenteNom : tx("de tus cuentas de hoy", "from your current accounts")}.
              {renta && (Number(x.rentaMensual) || 0) > 0 ? tx(` Renta ${plata(Number(x.rentaMensual))} al mes ${cuando(Number(x.rentaDesde) || Number(x.entrega) || 1)}.`, ` Rents for ${plata(Number(x.rentaMensual))} a month ${cuando(Number(x.rentaDesde) || Number(x.entrega) || 1)}.`) : ""}
              {(Number(x.valorAlTerminar) || 0) > total ? tx(` Al estar lista vale ${plata(Number(x.valorAlTerminar))} (+${plata(Number(x.valorAlTerminar) - total)}).`, ` Once finished it's worth ${plata(Number(x.valorAlTerminar))} (+${plata(Number(x.valorAlTerminar) - total)}).`) : ""}
              {tipo === "vivienda" ? tx(" Si al mudarte dejas de pagar arriendo, márcalo en «Gastos que se acaban» desde ese año.", " If moving in means you stop paying rent, mark it in \"Expenses that end\" from that year.") : ""}</div>}
            <button style={btn(false)} onClick={() => put("activos", f.activos.filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button>
          </div>
        );
      })}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("activos", [...f.activos, { nombre: "", clase: "vivienda", valor: "", cuotaInicial: "", anioCuota: 1, entrega: 2, rentaMensual: "", rentaDesde: "", fuentes: [] }])}>{tx("+ Agregar compra o construcción", "+ Add a purchase or build")}</button>
      {/* 24-oct-2026 (Santiago: "como vienen nuevas rentas también vienen
          nuevos gastos: la universidad de mis hijos afuera, unos 180 M por
          año, en 3 años"). Pesos de hoy; suben con la inflación. */}
      <h4 style={{ margin: "16px 0 8px" }}>{tx("Gastos futuros", "Future expenses")}</h4>
      {(f.gastos || []).map((x, i) => {
        const d = Math.max(1, Number(x.desde) || 1), n = x.anios === "" || x.anios == null ? null : Math.max(1, Number(x.anios) || 1);
        const cuando = d === 1 ? tx("desde ya", "starting now") : `${tx("dentro de", "in")} ${enAnios(d - 1)}`;
        return (
          <div key={i} style={g}>
            <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} placeholder={tx("Ej.: universidad de los hijos", "e.g. kids' college")} onChange={(e) => upG(i, { nombre: e.target.value })} /></label>
            <label style={lbl}>{esUS() ? tx("Al año ($, dólares de hoy)", "Per year ($, today's dollars)") : tx("Al año ($, pesos de hoy)", "Per year ($, today's pesos)")}<NumberInput style={inp} value={x.anual ?? ""} onChange={(v) => upG(i, { anual: v })} />
              <span style={{ fontSize: 12 }}>{tx("Sube cada año con la inflación.", "It grows with inflation every year.")}</span></label>
            <label style={lbl}>{tx("Empieza", "Starts")}{selAnio(x.desde || 1, (v) => upG(i, { desde: v || 1 }))}</label>
            <div style={lbl}>{tx("¿Cuántos años?", "For how many years?")}
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" style={btn(n == null)} onClick={() => upG(i, { anios: "" })}>{tx("Siempre", "Ongoing")}</button>
                <button type="button" style={btn(n != null)} onClick={() => upG(i, { anios: n ?? 4 })}>{tx("Un tiempo", "For a while")}</button>
              </div>
              {n != null && <select style={{ ...inp, marginTop: 6 }} value={n} onChange={(e) => upG(i, { anios: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{enAnios(y)}</option>)}</select>}
            </div>
            {(Number(x.anual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>{tx(`Sale ${plata(Number(x.anual))} al año (${plata(Math.round(Number(x.anual) / 12))} al mes) ${cuando}${n != null ? `, durante ${enAnios(n)}` : ", siempre"}.`, `${plata(Number(x.anual))} a year goes out (${plata(Math.round(Number(x.anual) / 12))} a month) ${cuando}${n != null ? `, for ${enAnios(n)}` : ", ongoing"}.`)}</div>}
            <button style={btn(false)} onClick={() => put("gastos", (f.gastos || []).filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button>
          </div>
        );
      })}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("gastos", [...(f.gastos || []), { nombre: "", anual: "", desde: 4, anios: 4 }])}>{tx("+ Agregar gasto futuro", "+ Add future expense")}</button>
      {/* 24-oct-2026 (Santiago: "¿cómo quita uno items de gastos que ya no
          van? por ejemplo mantenimientos"). Solo cambia el escenario. */}
      <h4 style={{ margin: "16px 0 4px" }}>{tx("Ingresos que se acaban", "Income that ends")}</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{tx(<>Cada ingreso se revisa en un solo lugar: en <b style={{ color: C.tx }}>1. Lo que tienes</b> corriges cuánto te entra y marcas si sigue o se acaba.</>, <>Each income is reviewed in one place: in <b style={{ color: C.tx }}>1. What you have</b> you fix how much comes in and mark whether it continues or ends.</>)}
        {irHoy && <> <button style={{ ...btn(true), padding: "4px 10px", fontSize: 12 }} onClick={irHoy}>{tx("Ir a mis ingresos en 1. Lo que tienes", "Go to my income in 1. What you have")}</button></>}
        {Object.keys(cfg.ingresosTerminan || {}).length > 0 && <div style={{ marginTop: 4, color: C.am }}>{tx(`Tienes ${Object.keys(cfg.ingresosTerminan || {}).length} que se acaban en este escenario.`, `${Object.keys(cfg.ingresosTerminan || {}).length} end in this scenario.`)}</div>}</div>
      <h4 style={{ margin: "16px 0 4px" }}>{tx("Gastos que se acaban o cambian", "Expenses that end or change")}</h4>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{tx(<>Igual que los ingresos: cada gasto de hoy se revisa en <b style={{ color: C.tx }}>1. Lo que tienes</b>, donde corriges cuánto sale y marcas si sigue o se acaba.</>, <>Same as income: each current expense is reviewed in <b style={{ color: C.tx }}>1. What you have</b>, where you fix how much goes out and mark whether it continues or ends.</>)}
        {irHoy && <> <button style={{ ...btn(true), padding: "4px 10px", fontSize: 12 }} onClick={irHoy}>{tx("Ir a mis gastos en 1. Lo que tienes", "Go to my expenses in 1. What you have")}</button></>}
        {Object.keys(cfg.gastosTerminan || {}).length > 0 && <div style={{ marginTop: 4, color: C.am }}>{tx(`Tienes ${Object.keys(cfg.gastosTerminan || {}).length} que se acaban en este escenario.`, `${Object.keys(cfg.gastosTerminan || {}).length} end in this scenario.`)}</div>}</div>
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
      {bolsa === 0 && <p style={{ color: C.tx2, fontSize: 12 }}>Para pagar una deuda, vende algo en el paso 1: se paga con esa plata.</p>}
      {bd.deudas > 0 && r.cuotasQueSalenMes > 0 && <p style={{ fontSize: 12, color: C.tx2 }}>Pagas {plata(bd.deudas)} y dejas de pagar <b style={{ color: C.gn }}>{plata(r.cuotasQueSalenMes)}</b> de cuotas al mes.</p>}
    </div>
  );
}

function Seccion({ n, titulo, sub }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
    <div style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 999, background: "rgba(0,200,5,0.15)", color: C.gn, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{n}</div>
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
    <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{ETQ_TIPO[clase] || ETQ_TIPO.otro}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {conActivo && <label style={lbl}>¿A cuál?<select style={inp} value={x.activoId} onChange={(e) => up({ activoId: e.target.value })}>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>}
      <label style={lbl}>¿Cuánto le vas a invertir? ($)<NumberInput style={inp} placeholder="Ej.: 600.000.000" value={x.monto} onChange={(v) => up({ monto: v })} /></label>
      <label style={lbl}>¿Cuándo?<select style={inp} value={Number(x.anio) || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
      <label style={lbl}>¿De dónde sale la plata?<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>
      {esInm ? <>
        <label style={lbl}>¿Va a dar renta? ($ al mes, opcional)<NumberInput style={inp} placeholder="Ej.: 8.500.000" value={x.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>
        {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>¿Desde cuándo renta?<select style={inp} value={desdeMes} onChange={(e) => up({ rentaDesdeMes: Number(e.target.value) })}>{opcionesMes(desdeMes).map((mm) => <option key={mm} value={mm}>{textoMes(mm)}</option>)}</select></label>}
        <label style={lbl}>¿Cuánto queda valiendo al terminar? ($, opcional)<NumberInput style={inp} placeholder="Ej.: 1.500.000.000" value={x.valorAlTerminar ?? ""} onChange={(v) => up({ valorAlTerminar: v })} /><span style={{ fontSize: 12 }}>Si con la obra vale más que lo que tenías más lo que inviertes.</span></label>
        <label style={lbl}>¿Cuánto se valoriza al año? (%)<InputDecimalEs style={inp} placeholder={det && det.valorizacionPct != null ? pct(det.valorizacionPct) : ""} value={x.valorizacionNomPct ?? ""} onChange={(v) => up({ valorizacionNomPct: v })} /><span style={{ fontSize: 12 }}>Lo que sube el valor cada año{(Number(x.valorAlTerminar) || 0) > 0 ? ", desde que termina la obra" : ""}. Si no sabes, déjalo vacío.</span></label>
      </> : <>
        <label style={lbl}>¿Cuánto rinde al año? (%)<InputDecimalEs style={inp} placeholder={det && det.rendimientoPct != null ? pct(det.rendimientoPct) : ""} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} /><span style={{ fontSize: 12 }}>Lo que estimas que gana en un año, sobre todo lo que tiene.</span></label>
        <label style={lbl}>De lo que rinde, ¿cuánto te llega?<select style={inp} value={Number(x.pctRecibe) || 0} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{PARTES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><span style={{ fontSize: 12 }}>Lo que no te llega se reinvierte y crece con interés compuesto.</span></label>
      </>}
    </div>
    {det && (det.aporte > 0 || det.rentaMensual > 0 || det.rindeAnual > 0) && <div style={{ marginTop: 8, background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
      <div><div style={{ fontSize: 12, color: C.tx2 }}>Queda valiendo</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.total)}</div><div style={{ fontSize: 12, color: C.tx2 }}>hoy {plata(det.valorHoy)} + {plata(det.aporte)}{det.anio > 1 ? ` en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}` : ""}</div></div>
      {esInm && det.rentaMensual > 0 && <div><div style={{ fontSize: 12, color: C.tx2 }}>Renta al mes</div><div style={{ fontSize: 16, fontWeight: 700, color: C.gn }}>{plata(det.rentaMensual)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{textoMes(det.rentaDesdeMes).toLowerCase()} · {pct(det.rentaPctAnual)} al año sobre el total</div></div>}
      {esInm && det.valorizacionPct != null && <div><div style={{ fontSize: 12, color: C.tx2 }}>Se valoriza</div><div style={{ fontSize: 16, fontWeight: 700 }}>{pct(det.valorizacionPct)} al año</div><div style={{ fontSize: 12, color: C.tx2 }}>≈ {plata(det.total * det.valorizacionPct / 100)} el primer año</div></div>}
      {!esInm && <div><div style={{ fontSize: 12, color: C.tx2 }}>Rinde al año</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.rindeAnual)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{pct(det.rendimientoPct)} sobre {plata(det.total)}</div></div>}
      {!esInm && <div><div style={{ fontSize: 12, color: C.tx2 }}>Te llega al mes</div><div style={{ fontSize: 16, fontWeight: 700, color: det.teLlegaMes > 0 ? C.gn : C.tx }}>{plata(det.teLlegaMes)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{det.pctRecibe >= 100 ? "no se reinvierte nada" : `se reinvierten ${plata(det.rindeAnual * (1 - det.pctRecibe / 100))} al año`}</div></div>}
      {(() => {
        const partes = [];
        if (det.deNuevo > 0) partes.push(`capital nuevo: ${plata(det.deNuevo)}`);
        if (det.deVenta > 0) partes.push(`la venta de ${vendidos.map((v) => v.nombre).join(" y ") || "lo que vendes"}: ${plata(det.deVenta)}`);
        if (det.deLiquidez > 0) partes.push(`tu liquidez de hoy: ${plata(det.deLiquidez)}`);
        if (det.deAnio1 > 0) partes.push(`lo que entre en ${anioCal(1)}: ${plata(det.deAnio1)}`);
        if (det.anio > 1 && det.aporte > 0) partes.push(det.fuente === "nuevo" ? `capital nuevo en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}: ${plata(det.aporte)}` : (det.fuente || "venta") === "venta" ? `lo que vendes (se aparta hoy y entra en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}): ${plata(det.aporte)}` : `lo que tengas en ${det.anio - 1} año${det.anio === 2 ? "" : "s"}: ${plata(det.aporte)}`);
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
// 25-oct-2026 (Santiago: "se dificulta saber qué saldo le va quedando a uno de
// las ventas… no sé si me pasé… uno no sabe si sobra o no"). La cuenta se
// muestra como entra / sale / sobra, con un veredicto grande arriba.
function veredictoSaldo(r) {
  const bd = r.bolsaDetalle || {};
  const exceso = bd.excesoVentas || 0, sobra = bd.restante || 0;
  const cub = bd.excesoCubierto || 0, noAlcanza = Math.max(0, exceso - cub);
  if (exceso > 0.5) return { ok: false, corto: `Te pasaste ${plata(Math.round(exceso))}`, largo: `Te pasaste ${plata(Math.round(exceso))} de lo que vendes.${cub > 0.5 ? ` ${plata(Math.round(cub))} salen de tus cuentas de hoy (ahorros y efectivo).` : ""}${noAlcanza > 0.5 ? ` ${plata(Math.round(noAlcanza))} no alcanzan: esa parte no se invierte. Baja montos o elige «Plata nueva de afuera».` : ""}` };
  if ((bd.vendido || 0) + (bd.capitalNuevo || 0) <= 0) return { ok: true, corto: "Sin ventas", largo: "Todavía no vendes nada. Lo que inviertas sale de tus cuentas de hoy o de plata nueva." };
  return { ok: true, corto: `Te sobran ${plata(Math.round(sobra))}`, largo: `Te sobran ${plata(Math.round(sobra))}: se reparten como digas en E.` };
}
function Saldo({ r }) {
  const bd = r.bolsaDetalle || {};
  const vend = (r.vendidos || []).map((v) => v.nombre).join(", ");
  const v = veredictoSaldo(r);
  const elegidoLiquidez = Math.max(0, (bd.desdeLiquidez || 0) - (bd.excesoCubierto || 0));
  const entra = [
    ...(bd.vendido > 0 ? [[`Lo que vendes (${vend})`, bd.vendido]] : []),
    ...(bd.capitalNuevo > 0 ? [["Plata nueva de afuera", bd.capitalNuevo]] : []),
    ...(elegidoLiquidez > 0.5 ? [["De tus cuentas de hoy (lo elegiste)", elegidoLiquidez]] : []),
  ];
  const sale = [
    ...(bd.deudas > 0 ? [["Pagas deudas", bd.deudas]] : []),
    ...(bd.colchon > 0 ? [[`Colchón de ${SUPUESTOS_F10.colchonMeses} meses`, bd.colchon]] : []),
    ...(bd.obras > 0 ? [["Obras", bd.obras]] : []),
    ...(bd.reinvertido > 0 ? [["B. Inviertes en lo que ya tienes", bd.reinvertido]] : []),
    ...(bd.nuevas > 0 ? [["C. Inversiones nuevas", bd.nuevas]] : []),
    ...(bd.ciclos > 0 ? [["D. Negocios que se repiten", bd.ciclos]] : []),
    ...(bd.reservado > 0 ? [["Apartado para invertir en años siguientes", bd.reservado]] : []),
  ];
  const fila = ([l, val], col) => <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "3px 0" }}><span style={{ color: C.tx2, minWidth: 0 }}>{l}</span><span style={{ color: col, whiteSpace: "nowrap", fontFamily: "monospace" }}>{plata(Math.round(val))}</span></div>;
  return <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
    <div style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 10, background: v.ok ? "rgba(0,200,5,0.12)" : "rgba(255,80,0,0.14)", border: `1px solid ${v.ok ? C.gn : C.rd}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: v.ok ? C.gn : C.rd }}>{v.corto}</div>
      <div style={{ fontSize: 12, color: C.tx }}>{v.largo}</div>
    </div>
    {entra.length > 0 && <><div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1 }}>Entra</div>{entra.map((x) => fila(x, C.tx))}</>}
    {(bd.excesoCubierto || 0) > 0.5 && fila(["Faltó: sale de tus cuentas de hoy", bd.excesoCubierto], C.rd)}
    {sale.length > 0 && <><div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1, marginTop: 8 }}>Sale</div>{sale.map((x) => fila(x, C.tx2))}</>}
    {(bd.usos || []).length > 0 && <details style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, color: C.tx }}>Ver cada inversión y de dónde sale su plata</summary>
      <div style={{ fontSize: 12, color: C.tx2, margin: "4px 0" }}>Solo lo que sale «de lo que vendes» cambia lo que sobra. Lo que sale de tus cuentas, de plata nueva o en años siguientes no lo mueve.</div>
      {bd.usos.map((u, k) => {
        const partes = [u.deVenta > 0.5 && `${plata(Math.round(u.deVenta))} de lo que vendes`, u.deCuentas > 0.5 && `${plata(Math.round(u.deCuentas))} de tus cuentas`, u.deNuevo > 0.5 && `${plata(Math.round(u.deNuevo))} plata nueva`].filter(Boolean);
        const resto = u.monto - u.deVenta - u.deCuentas - u.deNuevo;
        return <div key={k} style={{ fontSize: 12, padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: C.tx }}>{u.seccion}. {u.nombre}</span><span style={{ fontFamily: "monospace" }}>{plata(Math.round(u.monto))}</span></div>
          <div style={{ color: u.anio > 1 ? C.tx2 : resto > 0.5 ? C.am : C.tx2 }}>{u.anio > 1 && u.apartado ? `${partes.join(" + ") || "—"}: se aparta hoy y se invierte en ${anioCal(u.anio)}${u.resto > 0.5 ? `; los ${plata(Math.round(u.resto))} que no alcanzan se pagan ese año con lo que haya` : ""}` : u.anio > 1 ? `En el año ${u.anio}: se paga ese año con lo que haya, no de lo que vendes hoy` : `${partes.join(" + ") || "—"}${resto > 0.5 ? ` · faltan ${plata(Math.round(resto))}` : ""}`}</div>
        </div>;
      })}
    </details>}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 15, fontWeight: 700, borderTop: `1px solid ${C.bd}`, marginTop: 6, paddingTop: 8 }}><span>Sobra para repartir (E)</span><span style={{ color: bd.restante > 0 ? C.gn : C.tx, fontFamily: "monospace" }}>{plata(Math.round(bd.restante || 0))}</span></div>
    {(bd.excesoVentas || 0) - (bd.excesoCubierto || 0) > 0.5 && fila(["Pediste de más y no alcanza: no se invierte", (bd.excesoVentas || 0) - (bd.excesoCubierto || 0)], C.rd)}
    <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>
      {bd.pendienteAnio1 > 0 && <div style={{ color: C.am, marginTop: 4 }}>Lo que inviertes no alcanza con lo vendido y tu liquidez: los {plata(bd.pendienteAnio1)} que faltan salen de lo que vaya entrando en el año 1.</div>}
      {bd.programadas > 0 && <div style={{ marginTop: 4 }}>Además programaste {plata(bd.programadas)} para años siguientes: se pagan ese año.</div>}
      {bd.obrasPedido > bd.obras + 0.5 && <div style={{ color: C.am, marginTop: 4 }}>La obra pide {plata(bd.obrasPedido)}: {plata(bd.obras)} salen de aquí y {plata(bd.obrasPedido - bd.obras)} de lo que entre en el año 1.</div>}

    </div>
  </div>;
}
// Barra fija abajo en Tu plata: el veredicto siempre a la vista.
function SaldoFijo({ r, onVer }) {
  const v = veredictoSaldo(r);
  return <div onClick={onVer} style={{ position: "sticky", bottom: 8, zIndex: 5, margin: "8px 0", padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: v.ok ? "rgba(15,42,26,0.97)" : "rgba(58,20,20,0.97)", border: `1px solid ${v.ok ? C.gn : C.rd}`, boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
    <span style={{ fontWeight: 700, color: v.ok ? C.gn : C.rd }}>{v.corto}</span>
    <span style={{ fontSize: 12, color: C.tx2 }}>{v.ok ? "de lo que vendes" : "sale de tus cuentas"} · ver ↑</span>
  </div>;
}

const MESES_RENTA = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108];
const opcionesMes = (actual) => (MESES_RENTA.includes(actual) ? MESES_RENTA : [...MESES_RENTA, actual].sort((a, b) => a - b));
const textoMes = (mm) => (mm === 0 ? "Ya" : mm % 12 === 0 ? `En ${mm / 12} año${mm === 12 ? "" : "s"}` : `En ${mm} meses`);

const ETQ = { liquido: "Liquidez", inmueble: "Finca raíz", acciones: "Crecimiento", otro: "Otros", vehiculo: "Vehículos (no invertibles)" };
const dedupe = (as) => { const vistos = new Set(); return as.filter((a) => (vistos.has(a.tipo) ? false : vistos.add(a.tipo))); };

function Grid({ items }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
    {items.map(([l, v]) => <div key={l} style={{ background: C.bg, borderRadius: 8, padding: 10 }}><div style={{ color: C.tx2, fontSize: 12 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div></div>)}
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
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 4 }}>Marca las rentas y gastos de este activo. Dejan de contar desde la venta.</div>
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
        {t && <select style={{ ...inp, width: "auto" }} value={t} onChange={(e) => setT(g.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
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
function HoyDetalle({ user, cfg, set, setCfg, r }) {
  const invs = inversionesHoy(user, cfg);
  const sueltos = ingresosSueltosHoy(user, cfg);
  const [abierto, setAbierto] = useState(null);
  const lbl = { fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 };
  const rh = cfg.rentaHoy || {}, ih = cfg.ingresoHoy || {}, ch = cfg.crecHoy || {};
  const setC = (id, v) => { const nx = { ...ch }; if (v === "" || v == null) delete nx[id]; else nx[id] = v; set("crecHoy", nx); };
  const setR = (id, v) => { const nx = { ...rh }; if (v === "" || v == null) delete nx[id]; else nx[id] = v; set("rentaHoy", nx); };
  const setT = (k, v) => { const t = { ...(cfg.ingresosTerminan || {}) }; if (v) t[k] = v; else delete t[k]; set("ingresosTerminan", t); };
  const setI = (k, v) => { const nx = { ...ih }; if (v === "" || v == null) delete nx[k]; else nx[k] = v; set("ingresoHoy", nx); };
  const pctTxt = (v) => `${(Math.round(v * 10) / 10).toLocaleString("es-CO")} % al año`;
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "10px 0" };
  const totalInv = invs.filter((x) => !x.vende).reduce((sm, x) => sm + x.usada, 0), totalSue = sueltos.filter((x) => !(x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1))).reduce((sm, x) => sm + x.mensual, 0);
  return <>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>Cada inversión: cuánto vale y cuánto renta</h3>
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Toca una para ver de dónde sale su renta. Si no es lo que te da hoy, corrígela aquí: solo cambia el plan.</p>
      {invs.map((x) => { const ab = abierto === x.id; return (
        <div key={x.id} style={fila}>
          <div onClick={() => setAbierto(ab ? null : x.id)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b style={{ textDecoration: x.vende ? "line-through" : "none", color: x.vende ? C.tx2 : C.tx }}>{x.nombre}</b><span style={{ color: x.vende ? C.tx2 : C.tx }}>{plata(Math.round(x.valor))}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: x.usada > 0 && !x.vende ? C.gn : C.tx2, textDecoration: x.vende ? "line-through" : "none" }}>
              <span>{x.usada > 0 ? `Renta ${plata(Math.round(x.usada))}/mes${x.corregida ? " (corregida)" : ""}${x.vende ? " · deja de entrar" : ""}` : x.crecPct == null ? "Sin renta" : "Sin renta: crece de valor"}</span>
              <span>{x.usada > 0 ? pctTxt(x.pctAnual) : ""} {ab ? "▴" : "▾"}</span>
            </div>
            <div style={{ fontSize: 12, color: C.tx2 }}>{x.crecPct == null ? "Se deprecia cada año" : `Su valor sube ${pctTxt(x.crecPct)}`}{x.crecPct != null ? (x.crecCorregido ? " · lo pusiste tú" : " · supuesto general, corrígelo") : ""}</div>
          </div>
          {(() => {
            const d = (cfg.decisiones || {})[x.id] || { accion: "continua" };
            const elegir = (k) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: { accion: k } }, reinversiones: k === "vende" ? (p.reinversiones || []).filter((y) => y.activoId !== x.id) : p.reinversiones }));
            const det = (r.reinversionesDetalle || []).find((y) => y.activoId === x.id && y.aporte > 0);
            return <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                <button style={{ ...btn(!x.vende), padding: "4px 10px" }} onClick={() => elegir("continua")}>Sigue</button>
                <button style={{ ...btn(x.vende), padding: "4px 10px" }} onClick={() => elegir("vende")}>Se vende</button>
                {x.vende && <span style={{ fontSize: 12, color: C.am }}>No cuenta: su valor pasa a lo que vendes y su renta deja de entrar.</span>}
                {!x.vende && det && <span style={{ fontSize: 12, color: C.gn }}>Le inviertes {plata(det.aporte)} (paso 3)</span>}
              </div>
              {x.vende && <SeVaConVenta user={user} activoId={x.id} d={d} setD={(nx) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: { ...d, ...nx } } }))} />}
            </>;
          })()}
          {ab && <div style={{ marginTop: 8, fontSize: 12, color: C.tx2 }}>
            {x.ingresos.length === 0 && x.gastos.length === 0 && <div>No tiene ingresos ni gastos ligados en tus páginas Ingresos y Egresos.</div>}
            {x.ingresos.map((y, k) => <div key={"i" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>+ {y.nombre}{y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {x.gastos.map((y, k) => <div key={"g" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>− {y.nombre}{x.manual ? <i> · ya incluido en la renta</i> : y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {(x.ingresos.length > 0 || x.gastos.length > 0) && <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 4, color: C.tx }}><span>Renta neta según tus páginas</span><span>{plata(Math.round(x.neta))}/mes</span></div>}
            <label style={{ ...lbl, marginTop: 8 }}>¿Cuánto te deja al mes, neto? ($, opcional)
              <NumberInput style={inp} placeholder={x.neta > 0 ? fmtMilesEs(Math.round(x.neta)) : "Ej.: 57.500.000"} value={rh[x.id] ?? ""} onChange={(v) => setR(x.id, v)} />
              <span style={{ fontSize: 12 }}>Si lo dejas vacío se usa la renta de tus páginas. {x.valor > 0 ? "Ej.: 21 % al año de " + plata(Math.round(x.valor)) + " = " + plata(Math.round(x.valor * 0.21 / 12)) + "/mes." : ""}</span></label>
            {rh[x.id] != null && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setR(x.id, null)}>Volver a la de mis páginas</button>}
            {x.crecDefaultPct != null && <label style={{ ...lbl, marginTop: 8 }}>¿Cuánto sube su valor al año? (%, opcional)
              <InputDecimalEs style={inp} placeholder={(Math.round(x.crecDefaultPct * 10) / 10).toLocaleString("es-CO")} value={ch[x.id] ?? ""} onChange={(v) => setC(x.id, v)} />
              <span style={{ fontSize: 12 }}>{x.clase === "inmueble" ? "Valorización del inmueble." : x.usada > 0 ? "Aparte de la renta que te llega. Si la renta ya es todo lo que gana, déjalo en la inflación." : "Lo que gana al año y se queda invertido (interés compuesto)."} Si lo dejas vacío se usa el supuesto general: {(Math.round(x.crecDefaultPct * 10) / 10).toLocaleString("es-CO")} %.</span></label>}
          </div>}
        </div>); })}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Rentas de inversiones{invs.some((x) => x.vende) ? " (sin las que vendes)" : ""}</span><span>{plata(Math.round(totalInv))}/mes</span></div>
    </div>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>Tus otros ingresos</h3>
      {/* 25-oct-2026 (Santiago: "confunde… aquí no se pueden editar o quitar y después en el paso 2 aparecen otra vez"). Un ingreso, un lugar: aquí se corrige el monto y se decide si sigue o se acaba. */}
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Fees, salarios y rentas que no están ligados a una inversión de arriba. De cada uno: <b style={{ color: C.tx }}>cuánto te entra</b> (corrígelo si no es real) y <b style={{ color: C.tx }}>si sigue o se acaba</b> en este escenario.</p>
      {sueltos.length === 0 && <div style={{ fontSize: 13, color: C.tx2 }}>No tienes otros ingresos.</div>}
      {sueltos.map((x) => (
        <div key={x.key} style={fila}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b style={{ textDecoration: x.seVa ? "line-through" : "none", color: x.seVa ? C.tx2 : C.tx }}>{x.nombre}</b><span style={{ fontSize: 12, color: C.tx2 }}>{x.renta ? "renta" : "trabajo"}</span></div>
          {x.seVa && <div style={{ fontSize: 12, color: C.am }}>{x.seVa === "venta" ? "Se va con una venta que marcaste arriba: no suma." : `Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enIngresos))} value={ih[x.key] ?? ""} onChange={(v) => setI(x.key, v)} /></span>
            <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? `corregido (en Ingresos: ${plata(Math.round(x.enIngresos))})` : `${plata(Math.round(x.mensual))}/mes, de tu página Ingresos`}</span>
            {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setI(x.key, null)}>Quitar</button>}
          </div>
          {x.nota && !x.corregido && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{x.nota}</div>}
          {x.seVa !== "venta" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>Sigue</button>
            <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 1)}>Se acaba</button>
            {x.acabaAnio && <select style={{ ...inp, width: "auto" }} value={x.acabaAnio} onChange={(e) => setT(x.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
          </div>}
        </div>))}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Otros ingresos{sueltos.some((x) => x.seVa) ? " (sin los que se van)" : ""}</span><span>{plata(Math.round(totalSue))}/mes</span></div>
    </div>
    <TusGastos user={user} cfg={cfg} set={set} />
  </>;
}

function Ciclos({ lista, set, det, destinos = [] }) {
  const lbl = { fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 };
  const up = (i, v) => set(lista.map((y, j) => (j === i ? { ...y, ...v } : y)));
  const mm = (v) => `$${Math.round((Number(v) || 0) / 1e6).toLocaleString("es-CO")}M`;
  return <>
    {lista.map((x, i) => {
      const cap = Number(x.capital) || 0, vf = Number(x.valorFinal) || 0, meses = Number(x.meses) || 12, costos = Number(x.costosPct) || 0;
      const reg = TARIFA_CICLO[x.regimen] ? x.regimen : regimenSugerido(meses);
      const impPct = x.impuestoPct == null || x.impuestoPct === "" ? TARIFA_CICLO[reg].pct : Number(x.impuestoPct) || 0;
      const bruta = Math.max(0, vf - cap) * (1 - costos / 100), imp = bruta * impPct / 100;
      const gan = bruta - imp, anual = gan * 12 / meses;
      const siempre = x.hasta == null || x.hasta === "";
      return (
        <div key={i} style={{ borderTop: `1px solid ${C.bd}`, padding: "10px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <label style={lbl}>Nombre<input style={inp} placeholder="Ej.: Asociativos" value={x.nombre ?? ""} onChange={(e) => up(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>¿Cuánto capital pones? ($)<NumberInput style={inp} placeholder="1.350.000.000" value={x.capital ?? ""} onChange={(v) => up(i, { capital: v })} /></label>
          <label style={lbl}>¿Cuánto recibes al final de cada ciclo? ($)<NumberInput style={inp} placeholder="1.900.000.000" value={x.valorFinal ?? ""} onChange={(v) => up(i, { valorFinal: v })} /><span style={{ fontSize: 12 }}>Lo que vale o en lo que vendes al terminar.</span></label>
          <label style={lbl}>¿Cuánto dura cada ciclo?<select style={inp} value={meses} onChange={(e) => up(i, { meses: Number(e.target.value) })}>{[6, 9, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m === 12 ? "1 año" : m === 24 ? "2 años" : m === 36 ? "3 años" : `${m} meses`}</option>)}</select></label>
          <label style={lbl}>Otros costos sobre la ganancia (%, opcional)<InputDecimalEs style={inp} placeholder="0" value={x.costosPct ?? ""} onChange={(v) => up(i, { costosPct: v })} /><span style={{ fontSize: 12 }}>Comisiones, fiducia, escrituras.</span></label>
          <div style={{ ...lbl, gridColumn: "1 / -1", border: `1px solid ${C.bd}`, borderRadius: 8, padding: 8 }}>Impuesto sobre la ganancia
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select style={{ ...inp, flex: "1 1 220px", width: "auto" }} value={reg} onChange={(e) => up(i, { regimen: e.target.value, impuestoPct: "" })}>{Object.entries(TARIFA_CICLO).map(([k, t]) => <option key={k} value={k}>{t.nombre}{k !== "otro" ? ` · ${t.pct} %` : ""}</option>)}</select>
              <span style={{ display: "flex", alignItems: "center", gap: 4, width: 110 }}><InputDecimalEs style={inp} placeholder={String(TARIFA_CICLO[reg].pct)} value={x.impuestoPct ?? ""} onChange={(v) => up(i, { impuestoPct: v })} />%</span>
            </div>
            <span style={{ fontSize: 12 }}>Sugerido: {TARIFA_CICLO[reg].pct} %. {TARIFA_CICLO[reg].nota} Puedes cambiar el %. Es una estimación, confírmala con tu contador.</span>
            {cap > 0 && vf > cap && <span style={{ fontSize: 12, color: C.am }}>Impuesto estimado: {mm(imp)} por ciclo ({mm(imp * 12 / meses)} al año).</span>}
          </div>
          <label style={lbl}>¿Desde cuándo?<select style={inp} value={x.desde || 1} onChange={(e) => up(i, { desde: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
          <div style={lbl}>¿Hasta cuándo?
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={btn(siempre)} onClick={() => up(i, { hasta: "" })}>Sigue siempre</button>
              <button style={btn(!siempre)} onClick={() => up(i, { hasta: Math.max(Number(x.desde) || 1, 5) })}>Termina</button>
              {!siempre && <select style={{ ...inp, width: "auto" }} value={x.hasta} onChange={(e) => up(i, { hasta: Number(e.target.value) })}>{ANIOS.filter((y) => y >= (Number(x.desde) || 1)).map((y) => <option key={y} value={y}>Último ciclo en {anioCal(y)}</option>)}</select>}
            </div></div>
          <label style={lbl}>¿De dónde sale el capital?<FuenteSel value={x.fuente} on={(v) => up(i, { fuente: v })} /><span style={{ fontSize: 12 }}>Sale una sola vez; después el mismo capital se vuelve a usar.</span></label>
          <div style={{ ...lbl, gridColumn: "1 / -1" }}>¿Qué haces con la ganancia de cada ciclo? <span style={{ fontSize: 12 }}>El capital vuelve a entrar al negocio; esto es solo lo que ganas.</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={btn(x.destino !== "flujo")} onClick={() => up(i, { destino: "reinvierte" })}>La reinvierto</button>
              <button style={btn(x.destino === "flujo")} onClick={() => up(i, { destino: "flujo" })}>Me llega al mes</button>
            </div>
            {x.destino !== "flujo" ? <label style={{ ...lbl, marginTop: 4 }}>¿En qué la reinviertes?
              <select style={inp} value={x.destinoId || ""} onChange={(e) => up(i, { destinoId: e.target.value || null })}>
                <option value="">En lo que sobra (se reparte como en E)</option>
                {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select></label>
            : <span style={{ fontSize: 12 }}>Entra a tu flujo como un ingreso.</span>}</div>
          {cap > 0 && vf > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: vf > cap ? C.gn : C.am }}>
            {vf > cap ? <>Pones {mm(cap)} y recibes {mm(vf)} cada {meses === 12 ? "año" : `${meses} meses`}: te quedan <b>{mm(gan)}</b> por ciclo después de impuestos ({mm(anual)} al año, {(Math.round(anual / cap * 1000) / 10).toLocaleString("es-CO")} % sobre el capital). {x.destino === "flujo" ? "Esa ganancia te llega" : `Esa ganancia se reinvierte en ${(destinos.find((d) => d.id === x.destinoId) || { nombre: "lo que sobra (E)" }).nombre}`} {siempre ? "todos los años" : `hasta ${anioCal(x.hasta)}`}{siempre ? "" : "; después el capital vuelve"}.</> : "Recibes menos de lo que pones: no hay ganancia."}
          </div>}
          <div style={{ gridColumn: "1 / -1" }}><button style={btn(false)} onClick={() => set(lista.filter((_, j) => j !== i))}>Quitar</button></div>
        </div>);
    })}
    <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => set([...lista, { nombre: "", capital: "", valorFinal: "", meses: 12, desde: 1, hasta: "", fuente: "venta", destino: "reinvierte" }])}>+ Agregar negocio que se repite</button>
  </>;
}

// 25-oct-2026 (Santiago: "debería ser más clara la sección E, qué hacer con lo
// que sobra cada mes, que salga lo que sobra por cada inversión o renta y que
// sumen… me sobran al mes 100 M, en qué los quiero reinvertir, poder elegir").
function SobraMensual({ r, cfg, set, destinos }) {
  const [ver, setVer] = useState(false);
  const d = r.desglose || { entra: [], sale: [] };
  const f1 = (r.filas || [])[1] || {};
  const entra = (d.entra || []).filter((x) => x.mensual > 0.5).sort((a, b) => b.mensual - a.mensual);
  const tEntra = entra.reduce((sm, x) => sm + x.mensual, 0);
  const tSale = (d.sale || []).reduce((sm, x) => sm + x.mensual, 0);
  const sobra = (f1.cf || 0) / 12;
  const lista = Array.isArray(cfg.sobraDestinos) ? cfg.sobraDestinos : [];
  const up = (i, v) => set("sobraDestinos", lista.map((y, j) => (j === i ? { ...y, ...v } : y)));
  const usado = lista.reduce((sm, x) => sm + (Number(x.pct) || 0), 0);
  const resto = Math.max(0, 100 - usado);
  const fila = (nombre, v, col, nota) => <div key={nombre + v} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "2px 0" }}><span style={{ color: C.tx2, minWidth: 0 }}>{nombre}{nota ? <span style={{ fontSize: 12 }}> · {nota}</span> : null}</span><span style={{ color: col, fontFamily: "monospace", whiteSpace: "nowrap" }}>{plata(Math.round(v))}</span></div>;
  return <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontWeight: 700 }}>Cada mes te {sobra >= 0 ? "sobran" : "faltan"}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: sobra >= 0 ? C.gn : C.rd }}>{plata(Math.round(Math.abs(sobra)))}</span>
    </div>
    <div style={{ fontSize: 12, color: C.tx2 }}>En {anioCal(1)}: entra {plata(Math.round(tEntra))} y sale {plata(Math.round(tSale))}. {sobra < 0 ? "Lo que falta sale de tu liquidez." : ""}</div>
    <button style={{ ...btn(false), marginTop: 6, fontSize: 12, padding: "4px 10px" }} onClick={() => setVer(!ver)}>{ver ? "Ocultar" : "Ver"} de dónde sale cada peso</button>
    {ver && <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1 }}>Entra cada mes</div>
      {entra.map((x) => fila(x.nombre, x.mensual, C.tx, x.nota))}
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2 }}>{fila("Total que entra", tEntra, C.tx)}</div>
      <div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1, marginTop: 6 }}>Sale cada mes</div>
      {(d.sale || []).slice(0, 6).map((x) => fila(x.nombre, x.mensual, C.tx2))}
      {(d.sale || []).length > 6 && fila(`y ${(d.sale || []).length - 6} gastos más`, (d.sale || []).slice(6).reduce((sm, x) => sm + x.mensual, 0), C.tx2)}
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2 }}>{fila("Total que sale", tSale, C.tx2)}</div>
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2, fontWeight: 700 }}>{fila(sobra >= 0 ? "Te sobra al mes" : "Te falta al mes", Math.abs(sobra), sobra >= 0 ? C.gn : C.rd)}</div>
      {(d.reinvierte || []).length > 0 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>No cuenta lo que rinden y no te llega ({(d.reinvierte || []).map((x) => x.nombre).join(", ")}): eso ya se reinvierte solo.</div>}
    </div>}
    {sobra > 0 && <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700 }}>¿En qué reinviertes lo que sobra cada mes?</div>
      {lista.map((x, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <select style={{ ...inp, flex: "1 1 160px", width: "auto" }} value={x.id || ""} onChange={(e) => up(i, { id: e.target.value })}>
            <option value="">Elige una inversión</option>
            {destinos.map((dd) => <option key={dd.id} value={dd.id}>{dd.nombre}</option>)}
          </select>
          <span style={{ display: "flex", alignItems: "center", gap: 4, width: 80 }}><InputDecimalEs style={inp} value={x.pct ?? ""} onChange={(v) => up(i, { pct: v })} />%</span>
          <span style={{ fontSize: 12, color: C.gn, whiteSpace: "nowrap" }}>{plata(Math.round(sobra * (Number(x.pct) || 0) / 100))}/mes</span>
          <button style={{ ...btn(false), padding: "4px 10px" }} onClick={() => set("sobraDestinos", lista.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
        </div>))}
      <button style={{ ...btn(true), marginTop: 8 }} onClick={() => set("sobraDestinos", [...lista, { id: "", pct: resto }])}>+ Reinvertir en una inversión</button>
      <div style={{ fontSize: 12, color: usado > 100 ? C.rd : C.tx2, marginTop: 6 }}>
        {usado > 100 ? "Los porcentajes suman más de 100 %." : resto > 0 ? `${resto} % (${plata(Math.round(sobra * resto / 100))}/mes) ${cfg.repartoDisponible ? "queda disponible, como elegiste abajo." : "se reparte como lo de las ventas, abajo."}` : "Asignaste el 100 % de lo que sobra."}
      </div>
    </div>}
  </div>;
}

// 25-oct-2026 (Santiago: "¿cómo edita uno los gastos si algún valor cambia?
// Por ejemplo, el arriendo ya no es 16 M"). Igual que los ingresos: cada gasto
// en un solo lugar, con su monto corregible y Sigue / Se acaba.
function TusGastos({ user, cfg, set }) {
  const [verTodos, setVerTodos] = useState(false);
  const lista = gastosLista(user, cfg);
  const gh = cfg.gastoHoy || {}, term = cfg.gastosTerminan || {};
  const setG = (k, v) => { const nx = { ...gh }; if (v === "" || v == null) delete nx[k]; else nx[k] = v; set("gastoHoy", nx); };
  const setT = (k, v) => { const nx = { ...term }; if (v) nx[k] = v; else delete nx[k]; set("gastosTerminan", nx); };
  const orden = [...lista].sort((a, b) => (!!(b.corregido || b.seVa) - !!(a.corregido || a.seVa)) || b.mensual - a.mensual);
  const visibles = verTodos ? orden : orden.slice(0, 10);
  const cuenta = (x) => !(x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1));
  const total = lista.filter(cuenta).reduce((sm, x) => sm + x.mensual, 0);
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "10px 0" };
  return <div style={card}>
    <h3 style={{ marginTop: 0, marginBottom: 2 }}>Tus gastos</h3>
    <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>De tu página Egresos. De cada uno: <b style={{ color: C.tx }}>cuánto sale al mes</b> (corrígelo si cambió, por ejemplo un arriendo nuevo) y <b style={{ color: C.tx }}>si sigue o se acaba</b>. Solo cambia el plan; Egresos no se toca. Los gastos futuros (la universidad) van en el paso 2.</p>
    {visibles.map((x) => (
      <div key={x.key} style={fila}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <b style={{ textDecoration: x.seVa ? "line-through" : "none", color: x.seVa ? C.tx2 : C.tx }}>{x.nombre}</b>
          <span style={{ fontSize: 12, color: C.tx2 }}>{x.cat}{x.deActivo ? ` · de ${x.deActivo}` : ""}</span>
        </div>
        {x.seVa && <div style={{ fontSize: 12, color: C.am }}>{x.seVa === "venta" ? "Se va con una venta que marcaste arriba: no suma." : `Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enEgresos))} value={gh[x.key] ?? ""} onChange={(v) => setG(x.key, v)} /></span>
          <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? `corregido (en Egresos: ${plata(Math.round(x.enEgresos))})` : `${plata(Math.round(x.mensual))}/mes, de tu página Egresos`}</span>
          {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setG(x.key, null)}>Quitar</button>}
        </div>
        {x.seVa !== "venta" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>Sigue</button>
          <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 1)}>Se acaba</button>
          {x.acabaAnio && <select style={{ ...inp, width: "auto" }} value={x.acabaAnio} onChange={(e) => setT(x.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
        </div>}
      </div>))}
    {orden.length > 10 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Ver menos" : `Ver todos (${orden.length})`}</button>}
    <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>Gastos de hoy en el plan</span><span>{plata(Math.round(total))}/mes</span></div>
  </div>;
}
