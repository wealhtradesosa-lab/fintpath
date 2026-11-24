// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { tx, esUS, pct as fmtPctR, miles, plata as plataR, ejemploMonto, monedaBase, localeCifras } from "../lib/region.js";
import { proyectarFuturo10, supuestosF10, nombreSup, retornoNominalPreset, rendimientoHintPct, validarMezcla, leerFuturos, migrarModifica, resumenEscenario, migrarClaves, anioCal, gastosLista, tarifaCiclo, regimenSugerido, sugerirVinculados, rentasDuplicadas, rentasFuturasDelActivo, inversionesHoy, leerCambios, finalesDeDatos, sugerirActivoDeDeuda, deudaActivo, ingresosSueltosHoy, leerPropiedadRaiz, hayAlertaLiquidez, cuentaPorAnio, fotosPorAnio } from "../lib/futuro10.js";
import { track } from "../lib/analytics";
import PlanInforme from "./PlanInforme";
import PlanComparador from "./PlanComparador";
import EscenariosCreados from "./infografia/EscenariosCreados";
import BarraFuturo10 from "./BarraFuturo10";

import { fmtPlataEs } from "../lib/formato.js";
const C = { bg: "var(--fp-card)", bg2: "var(--fp-raised)", bd: "rgba(var(--fp-ink),0.1)", tx: "var(--fp-txt)", tx2: "var(--fp-txt2)", gn: "#00c805", rd: "#ff5000", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(0,200,5,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
// 25-oct-2026 (Santiago: "uno ve ese primer listado y cree que van a ser
// tenidas en cuenta… no es intuitivo"). Cada cosa que tienes se revisa y se
// decide en un solo lugar (paso 1): valor, renta, si sigue o se vende, si se
// acaba. El paso 2 queda solo para lo que viene.
// 3-nov-2026: textos en el idioma de la sesión (region.js); se resuelven al pintar.
const pasosF10 = () => [tx("Lo que tienes", "What you have"), tx("Lo que viene", "What's coming"), tx("Tu plata", "Your money"), tx("Resultado", "Result"), tx("Guardar", "Save")];
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
  // 23-nov-2026: inversiones nuevas plegadas en una línea; se abre la que se edita.
  const [nuevaAbierta, setNuevaAbierta] = useState(() => new Set());
  // 23-nov-2026: el paso 3 se recorre año por año; este es el año que se está viendo (1 = hoy).
  const [anioSel, setAnioSel] = useState(1);
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
  // 24-nov-2026: la foto de cada año antes de tus movidas de ese año, y la cuenta en cascada.
  const fotos = useMemo(() => fotosPorAnio(user, cfg, r), [user, cfg, r]);
  const cuenta = useMemo(() => cuentaPorAnio(r, cfg, fotos), [r, cfg, fotos]);
  // Lo que te queda por invertir ese año (estable: sale de lo que puedes usar menos tus movidas).
  // El monto que viene lleno y «Usar saldo pendiente» usan esto: dejan el año exactamente en cero.
  const quedaEnAnio = (anio) => ((cuenta.find((g) => g.anio === anio) || {}).porInvertir || 0);
  const reinvEnAnio = (activoId, anio) => {
    const q = quedaEnAnio(anio);
    set("reinversiones", [...cfg.reinversiones, { activoId, monto: q > 0.5 ? Math.round(q) : "", anio, rentaMensual: "", rentaDesdeMes: 0, fuente: anio > 1 ? "liquidez" : "venta" }]);
    setTimeout(() => document.getElementById("f10-reinv")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 150);
  };
  const nuevaEnAnio = (anio, queda) => {
    const k = cfg.nuevas.length;
    set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: queda > 0.5 ? Math.round(queda) : "", fuente: anio > 1 ? "liquidez" : "venta", anio }]);
    setNuevaAbierta((st) => new Set([...st, k]));
    setTimeout(() => { const el = document.getElementById("f10-nueva-" + k); el?.scrollIntoView?.({ behavior: "smooth", block: "center" }); }, 150);
  };
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
    const ps = [{ nombre: tx("Si me quedo como estoy", "If I stay as I am"), esHoy: true, r: proyectarFuturo10(user, { escenario: cfg.escenario }) }];
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
  const guardar = (nombreForzado) => {
    if (demo) return; // la demo nunca escribe en la cuenta real
    setEditandoId(null);
    const nuevo = { id: "f10_" + Date.now(), nombre: (typeof nombreForzado === "string" ? nombreForzado : nombreEsc).trim() || `${tx("Escenario", "Scenario")} ${escenarios.length + 1}`, descripcion: descEsc.trim(), creado: new Date().toISOString(), config: cfg };
    onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc(""); setDescEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const editarEsc = (id) => { const e = escenarios.find((x) => x.id === id); if (!e) return; setVista("crear"); setCfg(migrarClaves(migrarModifica({ ...CONFIG_INICIAL, ...e.config }), user)); setEditandoId(e.id); setNombreEsc(e.nombre || ""); setDescEsc(e.descripcion || ""); ir(1); };
  const descartarBorrador = () => { setCfg(editandoEsc ? migrarClaves(migrarModifica({ ...CONFIG_INICIAL, ...editandoEsc.config }), user) : { ...CONFIG_INICIAL, escenario: cfg.escenario }); setEditandoId(null); setNombreEsc(""); setDescEsc(""); };
  // 22-nov-2026 (Santiago: "al editar uno podría cambiar el nombre si tiene un título el plan… así no tiene uno un botón cambiar nombre").
  const renombrar = (id, nombre) => { const t = String(nombre || "").trim(); if (demo || !t || !onGuardar) return; onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.map((e) => (e.id === id ? { ...e, nombre: t, editado: new Date().toISOString() } : e)) }); };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      {/* 19-nov-2026 (Santiago: "muchas cosas mal alineadas"). Cuando un título de
          campo ocupaba dos líneas, su casilla quedaba más abajo que las vecinas.
          Cada campo es una grilla: título (alto fijo de dos líneas, pegado abajo),
          casilla y ayuda. Así todas las casillas de una fila quedan a la misma
          altura. Los botones sueltos (Quitar) se alinean con las casillas. */}
      <style>{`.fp10-campos { align-items: start; }
.fp10-campos > label, .fp10-campos > .fp10-campo { display: grid; grid-template-rows: auto auto auto; align-items: end; row-gap: 4px; line-height: 1.3; }
.fp10-campos > label > span { align-self: start; }
.fp10-campos > label > input, .fp10-campos > label > select, .fp10-campos > label > div { min-width: 0; width: 100%; box-sizing: border-box; }
@media (min-width: 600px) {
  .fp10-campos > label, .fp10-campos > .fp10-campo { grid-template-rows: minmax(2.7em, auto) auto auto; }
  .fp10-campos > .fp10-boton { padding-top: calc(2.7em + 4px); }
}
.fp-titulo-edit { font: inherit; color: inherit; background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 2px 6px; margin-left: -7px; width: 100%; min-width: 0; outline: none; }
.fp-titulo-edit:hover { border-color: rgba(var(--fp-ink),0.14); }
.fp-titulo-edit:focus { border-color: var(--fp-azul, #4c7dff); }`}</style>
      <PageHeader label={tx("Mi futuro a 10 años", "My 10-year future")} title={tx("¿Cómo se ve tu patrimonio en 10 años?", "What does your net worth look like in 10 years?")} compact
        subtitle={tx("Cinco pasos: decides sobre lo que tienes, agregas lo que viene, mueves tu plata, miras el resultado y lo guardas. Tus datos reales no se tocan.", "Five steps: decide on what you have, add what's coming, move your money, see the result and save it. Your real data isn't touched.")} />
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
        <div style={{ ...card, marginBottom: 14 }}><h3 style={{ margin: 0 }}>{verEsc.id && !demo ? <TituloEditable valor={verEsc.nombre} onCambiar={(t) => { renombrar(verEsc.id, t); setVerEsc((v) => ({ ...v, nombre: t })); }} /> : verEsc.nombre}</h3>{verEsc.descripcion ? <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{verEsc.descripcion}</div> : null}</div>
        <PlanInforme r={verEsc.r} nombre={verEsc.nombre} inflacionPct={esc.inflacionPct} />
      </> : <>
        <EscenariosCreados planes={planesComparar} inflacionPct={esc.inflacionPct} demo={demo}
          onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc} onBorrar={demo ? null : borrar}
          onCrear={() => { setVista("crear"); ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        {escenarios.length > 0 && <button type="button" onClick={() => setVerDetalle((v) => !v)} style={{ ...btn(false), width: "100%", minHeight: 44, marginBottom: 12 }}>{verDetalle ? tx("Ocultar la comparación detallada", "Hide the detailed comparison") : tx("Ver la comparación detallada: curvas, reparto, ¿da para vivir? y el patrimonio como empresa", "See the detailed comparison: curves, allocation, can you live on it, and your wealth as a business")}</button>}
        {verDetalle && <PlanComparador planes={planesComparar} inflacionPct={esc.inflacionPct} onVer={(p) => { setVerEsc(p); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onEditar={demo ? null : editarEsc} onBorrar={demo ? null : borrar}
          onRecomendar={demo ? null : (id) => onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.map((e) => ({ ...e, recomendado: e.id === id ? !e.recomendado : false })) })} />}
      </>)}

      {vista === "crear" && <>
      {editandoEsc && !demo && <h2 style={{ fontSize: 20, margin: "4px 0 10px", fontWeight: 600 }}><TituloEditable valor={editandoEsc.nombre} onCambiar={(t) => { renombrar(editandoEsc.id, t); setNombreEsc(t); }} /></h2>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
      </div>


      {paso === 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{tx("Lo que tienes: revisa y decide", "What you have: review and decide")}</h3>
          {/* 25-oct-2026 (Santiago: "deberíamos explicar que ahí se puede revisar y ajustar valores y rentabilidad de cada inversión"). */}
          <div style={{ fontSize: 13, color: C.tx, background: "rgba(0,200,5,0.08)", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            {tx(<>Repasa lo que tienes y dile al plan qué va a pasar con cada cosa. Lo tachado ya no cuenta en este escenario. Nada de esto cambia tus páginas.</>, <>Go through what you have and tell the plan what happens to each item. Struck-through items no longer count in this scenario. None of this changes your pages.</>)}
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
        <div style={card} id="f10-lo-que-viene">
          <Seccion n={2} titulo={tx("Lo que viene", "What's coming")} sub={tx("Tus hitos de los próximos 10 años: lo que empieza a entrar, lo que empieza a salir y lo que vas a comprar. Cada uno cae en su año en el paso 3.", "Your milestones for the next 10 years: what starts coming in, what starts going out and what you'll buy. Each one lands in its year in step 3.")} />
          <LoQueViene user={user} cfg={cfg} set={set} esc={esc} owners={user.owners || []} activos={r.activos} fuentes={r.fuentes || []} r={r} irAPlata={(t) => { setAnioSel(t); ir(2); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 200); }} irHoy={() => { ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        </div>
      </>)}

      {paso === 2 && (<>
        <AnioPorAnio r={r} cfg={cfg} set={set} cuenta={cuenta} anioSel={anioSel} setAnioSel={setAnioSel} nuevaEnAnio={nuevaEnAnio} reinvEnAnio={reinvEnAnio} />
        <div style={card} id="f10-deudas">
          <Seccion n="A" titulo={tx(`Pagar deudas · ${anioSel === 1 ? `hoy (${anioCal(1)})` : anioCal(anioSel)}`, `Pay off debt · ${anioSel === 1 ? `today (${anioCal(1)})` : anioCal(anioSel)}`)} sub={tx("Las deudas que siguen vivas este año: deja que sigan con su cuota o págalas con el saldo del año. Las que se pagan con la venta de su activo y las ya pagadas van en una línea.", "Debts still alive this year: keep paying them or pay them off with this year's balance. Those paid with their asset's sale and those already paid are listed in one line.")} />
          {(r.deudas || []).length + (r.deudasSinSaldo || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} anioSel={anioSel} setAnioSel={setAnioSel} /> : <p style={{ color: C.tx2, fontSize: 13 }}>{tx("No tienes deudas con saldo.", "You have no outstanding debt.")}</p>}
        </div>
        <div style={card}>
          <Seccion n="B" titulo={tx(`Inversiones nuevas · ${anioSel === 1 ? `hoy (${anioCal(1)})` : anioCal(anioSel)}`, `New investments · ${anioSel === 1 ? `today (${anioCal(1)})` : anioCal(anioSel)}`)} sub={esUS() ? tx("Algo que todavía no tienes: un CD, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a CD, a fund, another investment. Choose where it comes from.") : tx("Algo que todavía no tienes: un CDT, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a term deposit, a fund, another investment. Choose where it comes from.")} />
          {/* 23-nov-2026 (Santiago: "aquí debería ser muy claro: inversiones nuevas 2026, uno ve ahí cuáles; después inversiones nuevas 2027 y así sucesivamente"). Agrupadas por año, cada grupo con lo que queda ese año, y cada inversión plegada en una línea. */}
          {(() => {
            const anioDe = (x) => Math.max(1, Number(x.anio) || 1);
            const grupos = [anioSel];
            // 23-nov-2026 (Santiago: "me sobran 9.000 MM de 2027, hago una inversión de 4.000 y la segunda me dice por defecto el saldo pendiente, o puedo poner otro valor"). La inversión nueva de un año arranca con lo que queda ese año; se puede cambiar.
            const agregar = (anio, queda) => { const k = cfg.nuevas.length; set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: queda > 0.5 ? Math.round(queda) : "", fuente: anio > 1 ? "liquidez" : "venta", anio }]); setNuevaAbierta((s) => new Set([...s, k])); };
            const montoDe = (x) => (x.preset === "fincaRaiz" && x.pr ? leerPropiedadRaiz(x, 10).capital : Number(x.monto) || 0);
            return grupos.map((anio) => {
              const filas = cfg.nuevas.map((x, i) => [x, i]).filter(([x]) => anioDe(x) === anio);
              const total = filas.reduce((sm, [x]) => sm + montoDe(x), 0);
              const g = cuenta.find((y) => y.anio === anio);
              const queda = g ? g.porInvertir : null;
              return <div key={anio} style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: `1px solid ${C.bd}` }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{anio === 1 ? tx(`Hoy · ${anioCal(1)}`, `Today · ${anioCal(1)}`) : anioCal(anio)}</span>
                  <span style={{ fontSize: 13, color: C.tx2, fontVariantNumeric: "tabular-nums" }}>{tx("Inviertes", "You invest")} {plata(Math.round(total))}{queda != null && <> · {queda >= -0.5 ? tx("queda", "left") : tx("faltan", "short")} <b style={{ color: queda > 0.5 ? C.gn : queda < -0.5 ? C.rd : C.tx }}>{plata(Math.round(Math.abs(queda)))}</b></>}</span>
                </div>
                {filas.map(([x, i]) => {
            // Si se cambia el año de la inversión, la vista se va con ella a ese año.
            const up = (v) => { set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y)); if (v.anio && v.anio !== anioSel) setAnioSel(v.anio); };
            const hint = rendimientoHintPct(esc);
            const lbl = { fontSize: 12, color: C.tx2 };
            const esPR = x.preset === "fincaRaiz" && !!x.pr;
            if (!nuevaAbierta.has(i)) {
              const nom = x.nombre || (esPR ? leerPropiedadRaiz(x, 10).nombre : x.preset === "custom" ? tx("Inversión personalizada", "Custom investment") : nombreSup(SUP.presets[x.preset] || {}));
              const det = esPR ? { planos: tx("Compra en planos", "Off-plan"), lote: tx("Lote y construcción", "Lot and build"), asociativo: tx("Proyecto asociativo", "Joint development"), rentar: tx("Construir para rentar", "Build to rent") }[leerPropiedadRaiz(x, 10).tipo]
                : x.preset === "custom" ? null : nombreSup(SUP.presets[x.preset] || {});
              const rend = !esPR && (x.rendimientoNomPct === "" || x.rendimientoNomPct == null ? (x.preset === "custom" ? hint : SUP.presets[x.preset] ? retornoNominalPreset(x.preset, esc, SUP) : null) : Number(x.rendimientoNomPct));
              return <div key={i} id={"f10-nueva-" + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.bd}`, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}><div style={{ fontWeight: 600 }}>{nom}</div><div style={{ fontSize: 12, color: C.tx2 }}>{[det && det !== nom ? det : null, rend != null && rend !== false ? tx(`rinde ${fmtPctEs(rend, 1)}`, `earns ${fmtPctEs(rend, 1)}`) : null, esPR ? (() => { const q = leerPropiedadRaiz(x, 10); return q.final === "vende" ? (q.repite ? tx(`se vende y se repite cada ${enAnios(q.durAnios)}`, `sold and repeated every ${q.durAnios} years`) : tx("se vende una vez", "sold once")) : tx("te quedas con ella", "you keep it"); })() : null].filter(Boolean).join(" · ")}</div></div>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{plata(Math.round(montoDe(x)))}</span>
                <button style={{ ...btn(false), padding: "6px 12px" }} onClick={() => setNuevaAbierta((s) => new Set([...s, i]))}>{tx("Editar", "Edit")}</button>
              </div>;
            }
            return (
              <div key={i} id={"f10-nueva-" + i} style={{ borderBottom: `1px solid ${C.bd}`, padding: "10px 0", display: "grid", gap: 10 }}>
                {/* 23-nov-2026 (Santiago: "mire estas dos inversiones: preguntan distinto y en diferente orden"). Todas las inversiones preguntan lo mismo y en el mismo orden: qué, cuándo, cuánto, de dónde; después cuánto rinde, cuánto te llega y hasta cuándo. */}
                {x.deLiberado && Number(x.anio) > 1 && <div style={{ fontSize: 12.5, color: C.tx2 }}>{tx(`Con lo que te llega en ${anioCal(x.anio)} de «${x.deLiberado}».`, `With what you receive in ${anioCal(x.anio)} from "${x.deLiberado}".`)}</div>}
                {(() => {
                  const fila4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "start" };
                  const campo = (l, ctrl, ayuda, col) => <label style={{ ...lbl, display: "grid", gap: 4, minWidth: 0 }}>{l}{ctrl}{ayuda && <span style={{ fontSize: 12, color: col || C.tx2, lineHeight: 1.35 }}>{ayuda}</span>}</label>;
                  const tipoSel = <select style={inp} value={x.preset} onChange={(e) => up({ preset: e.target.value, ...(e.target.value === "fincaRaiz" && !x.pr ? { pr: { tipo: "planos", final: "vende", cuotaPct: 30, plazo: 2, valEntregaPct: 20, valAnualPct: 6 } } : {}) })}>
                    {Object.entries(SUP.presets).map(([k, p]) => <option key={k} value={k}>{nombreSup(p)}</option>)}
                    <option value="custom">{tx("Otra (personalizada)", "Other (custom)")}</option>
                  </select>;
                  // 23-nov-2026 (Santiago: "estoy en 2027 usando el saldo de 2027 y me pide elegir estas opciones"). En un año siguiente no se pregunta: sale del saldo de ese año.
                  const anioX = Math.max(1, Number(x.anio) || 1);
                  const fuenteCampo = anioX > 1
                    ? campo(tx("¿De dónde sale?", "Where does it come from?"), <div style={{ fontSize: 13.5, color: C.tx, padding: "8px 0" }}>{tx(`Del saldo de ${anioCal(anioX)}`, `From the ${anioCal(anioX)} balance`)}</div>)
                    : campo(tx("¿De dónde sale?", "Where does it come from?"), <FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} />);
                  // 23-nov-2026 (Santiago: "en el formulario del valor debería darme la opción de traer el saldo que tengo o que me va quedando si hago varias inversiones").
                  // Lo que queda en el año ya descuenta esta inversión; para ella está disponible lo que queda + lo que ya tiene puesto.
                  const dispEsta = queda != null ? Math.max(0, queda + montoDe(x)) : 0;
                  const usarSaldo = <BotonSaldo disponible={dispEsta} actual={montoDe(x)} anio={anio} on={(v) => (esPR ? up({ pr: { ...x.pr, valor: v } }) : up({ monto: v }))} />;
                  if (esPR) return <>
                    <div style={fila4}>{campo(tx("Tipo", "Type"), tipoSel)}{fuenteCampo}{campo(tx("Nombre (opcional)", "Name (optional)"), <input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder={tx("Ej.: proyecto, constructora", "e.g. project, developer")} />)}</div>
                    <PropiedadRaiz x={x} up={up} usarSaldo={usarSaldo} />
                  </>;
                  const esCustom = x.preset === "custom";
                  const supPct = esCustom ? hint : SUP.presets[x.preset] ? retornoNominalPreset(x.preset, esc, SUP) : hint;
                  const rendUsado = x.rendimientoNomPct === "" || x.rendimientoNomPct == null ? supPct : Number(x.rendimientoNomPct);
                  const pRec = (x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)) / 100;
                  const mes = (Number(x.monto) || 0) * rendUsado / 100 * pRec / 12;
                  const inicio = Math.max(1, Number(x.anio) || 1); const hasta = Number(x.hasta) > inicio ? Number(x.hasta) : 0;
                  return <>
                    <div style={fila4}>
                      {campo(tx("Tipo", "Type"), tipoSel)}
                      {campo(tx("¿Cuándo?", "When?"), <select style={inp} value={x.anio || 1} onChange={(e) => { const a2 = Number(e.target.value); up({ anio: a2, ...(a2 > 1 && x.fuente !== "nuevo" ? { fuente: "liquidez" } : {}) }); }}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>)}
                      {campo(tx("¿Cuánto? ($)", "How much? ($)"), <NumberInput style={inp} placeholder={tx("Monto", "Amount")} value={x.monto} onChange={(v) => up({ monto: v })} />, usarSaldo)}
                      {fuenteCampo}
                    </div>
                    <div style={fila4}>
                      {campo(esCustom ? tx("Nombre", "Name") : tx("Entidad (opcional)", "Institution (optional)"), <input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder={esCustom ? tx("Ej.: negocio, CDT", "e.g. business, term deposit") : esUS() ? tx("Ej.: Vanguard", "e.g. Vanguard") : tx("Ej.: BTG, Skandia", "e.g. BTG, Skandia")} />)}
                      {campo(tx("Rendimiento anual (%)", "Annual return (%)"), <InputDecimalEs style={inp} placeholder={fmtPctEs(supPct, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} />, x.rendimientoNomPct === "" || x.rendimientoNomPct == null ? (SUP.presets[x.preset]?.sinSupuesto ? tx(`Sin supuesto confiable: escribe el que esperas. Vacío: ${fmtPctEs(supPct, 1)}, solo la inflación.`, `No reliable assumption: enter what you expect. Blank: ${fmtPctEs(supPct, 1)}, inflation only.`) : tx(`Vacío: ${fmtPctEs(supPct, 1)} del escenario.`, `Blank: ${fmtPctEs(supPct, 1)} from the scenario.`)) : null)}
                      {campo(tx("¿Cuánto te llega?", "How much do you receive?"), <select style={inp} value={x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{partesF10().map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>, mes > 0 ? tx(`${plata(Math.round(mes))} al mes`, `${plata(Math.round(mes))} a month`) : tx("Se reinvierte todo", "All reinvested"), mes > 0 ? C.gn : C.tx2)}
                      {campo(tx("¿Hasta cuándo?", "Until when?"), <select style={inp} value={hasta || ""} onChange={(e) => up({ hasta: e.target.value ? Number(e.target.value) : "" })}>
                        <option value="">{tx("Indefinida", "Ongoing")}</option>
                        {ANIOS.filter((y) => y > inicio).map((y) => <option key={y} value={y}>{tx(`Hasta ${anioCal(y)}`, `Until ${anioCal(y)}`)}</option>)}
                      </select>)}
                    </div>
                    {(hasta > 0 || (esCustom && !esUS())) && <div style={fila4}>
                      {esCustom && !esUS() && campo(tx("Moneda", "Currency"), <select style={inp} value={x.moneda || monedaBase()} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>, x.moneda === "USD" ? tx("El resultado en pesos depende también de la tasa de cambio.", "The peso result also depends on the exchange rate.") : null, C.am)}
                      {hasta > 0 && campo(tx(`En ${anioCal(hasta)} retiras`, `In ${anioCal(hasta)} you withdraw`), <select style={inp} value={x.retiraParte ? "parte" : "todo"} onChange={(e) => up({ retiraParte: e.target.value === "parte" })}>
                        <option value="todo">{tx("Todo", "Everything")}</option>
                        <option value="parte">{tx("Una parte", "Part of it")}</option>
                      </select>, tx(`Aparece en la tarjeta de ${anioCal(hasta)} para reinvertirlo.`, `Shows in the ${anioCal(hasta)} card to reinvest it.`))}
                      {hasta > 0 && x.retiraParte && campo(tx("¿Cuánto retiras? ($)", "How much do you withdraw? ($)"), <NumberInput style={inp} placeholder={tx("Monto", "Amount")} value={x.retira ?? ""} onChange={(v) => up({ retira: v })} />)}
                    </div>}
                    {x.preset === "fincaRaiz" && !x.pr && <div><button style={{ ...btn(true), padding: "6px 12px" }} onClick={() => up({ pr: { tipo: "planos", final: "vende", cuotaPct: 30, plazo: 2, valEntregaPct: 20, valAnualPct: 6, valor: x.monto || "" } })}>{tx("Detallar: compra en planos, lote, asociativo o para rentar", "Detail: off-plan, lot, joint development or to rent")}</button></div>}
                  </>;
                })()}
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={btn(true)} onClick={() => setNuevaAbierta((s) => { const n2 = new Set(s); n2.delete(i); return n2; })}>{tx("Listo", "Done")}</button>
                  <button style={btn(false)} onClick={() => { set("nuevas", cfg.nuevas.filter((_, j) => j !== i)); setNuevaAbierta(new Set()); }}>{tx("Quitar", "Remove")}</button>
                </div>
              </div>
            );
                })}
                <button style={{ ...btn(false), marginTop: 8, padding: "8px 14px" }} onClick={() => agregar(anio, queda)}>{tx(`+ Agregar inversión en ${anioCal(anio)}`, `+ Add an investment in ${anioCal(anio)}`)}</button>
              </div>;
            });
          })()}
          <div style={{ fontSize: 12, color: C.tx2, marginTop: 10 }}>{tx("Para otro año, elige el año arriba, en «Tu plata año por año».", "For another year, pick the year above, in \"Your money year by year\".")}</div>
        </div>
        <div style={card} id="f10-reinv">
          <Seccion n="C" titulo={tx(`Invertir en lo que ya tienes · ${anioSel === 1 ? `hoy (${anioCal(1)})` : anioCal(anioSel)}`, `Invest in what you already own · ${anioSel === 1 ? `today (${anioCal(1)})` : anioCal(anioSel)}`)} sub={tx("Le metes capital a un activo que ya tienes (una obra, una ampliación, un aporte a un fondo). Sale del saldo de este año, igual que una inversión nueva.", "You add capital to an asset you already own (a build, an expansion, a fund contribution). It comes out of this year's balance, like a new investment.")} />
          {/* 22-nov-2026 (Santiago: "si en la primera sección se hace algo, esto se verá reflejado en los siguientes pasos; todo debe tener una lógica, un proceso"). Aquí ya no se vuelve a preguntar activo por activo: llega lo marcado en el paso 1. */}
          {/* 23-nov-2026 (Santiago: "invertir en lo que ya se tiene no está articulado con los saldos de cada año, lo toma como aparte"). Solo los aportes del año elegido; el nuevo aporte arranca con lo que queda ese año. */}
          {/* 23-nov-2026: un activo puede tener varios aportes (uno por año); se lista cada aporte del año elegido. */}
          {!cfg.reinversiones.some((x) => x && Math.max(1, Number(x.anio) || 1) === anioSel && ((r.activos || []).some((a) => a.id === x.activoId && a.clase !== "vehiculo") || delPlanDe(r, x.activoId))) && <p style={{ color: C.tx2, fontSize: 13, margin: "4px 0 8px" }}>{tx(`${anioSel === 1 ? "Hoy" : "En " + anioCal(anioSel)} no le inviertes a ningún activo que ya tienes.`, `Nothing invested in your existing assets in ${anioSel === 1 ? "today" : anioCal(anioSel)}.`)}</p>}
          {cfg.reinversiones.map((x0, iR) => [x0, iR]).filter(([x0]) => x0 && Math.max(1, Number(x0.anio) || 1) === anioSel).map(([x0, iR]) => {
            const a = (r.activos || []).find((y) => y.id === x0.activoId && y.clase !== "vehiculo") || delPlanDe(r, x0.activoId);
            if (!a) return null;
            const activo = true;
            const toggle = () => set("reinversiones", cfg.reinversiones.filter((_, j) => j !== iR));
            const upR = (v) => { set("reinversiones", cfg.reinversiones.map((y, j) => (j === iR ? { ...y, ...v } : y))); if (v.anio && v.anio !== anioSel) setAnioSel(v.anio); };
            const detR = activo ? (r.reinversionesDetalle || []).find((y) => y.i === iR) : null;
            return (
              <div key={a.id + "_" + iR} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <b>{a.nombre}</b>
                  <button type="button" onClick={toggle} style={{ background: "transparent", border: "none", padding: "4px 0", color: C.tx2, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{tx("Quitar", "Remove")}</button>
                </div>
                {activo && !a.delPlan && (() => {
                  // 19-nov-2026: la renta de este activo ya escrita en Lo que viene.
                  // Se ofrece juntarla aquí (una sola renta) o decir que es otra.
                  const futs = rentasFuturasDelActivo(cfg, a, r.activos);
                  if (!futs.length) return null;
                  // 19-nov-2026 (Santiago: "no ponga el ingreso si ya lo pusiste en la
                  // sección anterior"). Si aquí todavía no hay renta, no se vuelve a
                  // pedir: se muestra la de Lo que viene y el campo se esconde.
                  // Sin vínculo (solo el nombre se parece) nunca se da por hecho: se
                  // pregunta. Con 5 bodegas o 10 lotes el nombre no basta.
                  const ingresosQ = cfg.futuros?.ingresos || [];
                  const sueltas = futs.filter((f) => !f.vinculada);
                  const preguntas = sueltas.map((f) => <div key={"q" + f.k} style={{ marginTop: 8, fontSize: 12.5, color: C.tx, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                    {tx(`En Lo que viene hay «${f.x.nombre || "ingreso futuro"}» (${plata(Number(f.x.mensual))} al mes desde ${anioCal(Number(f.x.desde) || 1)}) sin activo. ¿Es la renta de ${a.nombre}?`, `In What's coming there's "${f.x.nombre || "future income"}" (${plata(Number(f.x.mensual))} a month from ${anioCal(Number(f.x.desde) || 1)}) with no asset. Is it ${a.nombre}'s income?`)}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <button style={btn(true)} onClick={() => {
                        if (Number(cfg.reinversiones[iR].rentaMensual) > 0) set("futuros", { ...cfg.futuros, ingresos: ingresosQ.filter((_, j) => j !== f.k) });
                        else set("futuros", { ...cfg.futuros, ingresos: ingresosQ.map((y, j) => (j === f.k ? { ...y, activoId: a.id } : y)) });
                      }}>{Number(cfg.reinversiones[iR].rentaMensual) > 0 ? tx("Sí, es esta: quitarla de Lo que viene", "Yes, this one: remove it from What's coming") : tx(`Sí, es de ${a.nombre}`, `Yes, it's ${a.nombre}'s`)}</button>
                      <button style={btn(false)} onClick={() => set("futuros", { ...cfg.futuros, ingresos: ingresosQ.map((y, j) => (j === f.k ? { ...y, noEsRentaDe: [...new Set([].concat(y.noEsRentaDe || [], a.id))] } : y)) })}>{tx("No, es de otro activo", "No, it's from another asset")}</button>
                    </div>
                  </div>);
                  const vinculadas = futs.filter((f) => f.vinculada);
                  if (!vinculadas.length) return preguntas;
                  if (!(Number(cfg.reinversiones[iR].rentaMensual) > 0)) {
                    const ingresos0 = cfg.futuros?.ingresos || [];
                    return [...preguntas, ...vinculadas.map((f) => <div key={f.k} style={{ marginTop: 8, fontSize: 12.5, color: C.tx, background: "rgba(0,200,5,0.08)", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "8px 10px" }}>
                      {tx(`La renta ya está en Lo que viene: «${f.x.nombre || "ingreso futuro"}», ${plata(Number(f.x.mensual))} al mes desde ${anioCal(Number(f.x.desde) || 1)}. No hace falta ponerla otra vez aquí.`, `The income is already in What's coming: "${f.x.nombre || "future income"}", ${plata(Number(f.x.mensual))} a month from ${anioCal(Number(f.x.desde) || 1)}. No need to enter it again here.`)}
                      <div style={{ marginTop: 6 }}><button style={btn(false)} onClick={() => set("futuros", { ...cfg.futuros, ingresos: ingresos0.map((y, j) => (j === f.k ? { ...y, noEsRentaDe: [...new Set([].concat(y.noEsRentaDe || [], a.id))] } : y)) })}>{tx("Esa es otra renta: quiero poner la de este activo", "That's a different income: I want to enter this asset's")}</button></div>
                    </div>)];
                  }
                  const ingresos = cfg.futuros?.ingresos || [];
                  const juntar = ({ x, k }) => {
                    const re = cfg.reinversiones[iR];
                    const yaTiene = Number(re.rentaMensual) > 0;
                    if (!yaTiene) upR({ rentaMensual: x.mensual, rentaDesdeMes: Math.max(0, ((Number(x.desde) || 1) - 1) * 12) });
                    set("futuros", { ...cfg.futuros, ingresos: ingresos.filter((_, j) => j !== k) });
                  };
                  const otra = ({ k }) => set("futuros", { ...cfg.futuros, ingresos: ingresos.map((y, j) => (j === k ? { ...y, noEsRentaDe: [...new Set([].concat(y.noEsRentaDe || [], a.id))] } : y)) });
                  return [...preguntas, ...vinculadas.map((f) => <div key={f.k} style={{ marginTop: 8, fontSize: 12.5, color: C.tx, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px" }}>
                    {tx(`En Lo que viene pusiste «${f.x.nombre || "ingreso futuro"}» como renta de ${a.nombre} (${plata(Number(f.x.mensual))} al mes desde ${anioCal(Number(f.x.desde) || 1)}) y aquí también pusiste renta. Se cuenta una sola vez, la de aquí. ¿La quitamos de Lo que viene?`, `In What's coming you entered "${f.x.nombre || "future income"}": ${plata(Number(f.x.mensual))} a month from ${anioCal(Number(f.x.desde) || 1)}. Is it ${a.nombre}'s income?`)}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <button style={btn(true)} onClick={() => juntar(f)}>{Number(cfg.reinversiones[iR].rentaMensual) > 0 ? tx("Sí, es la misma: quitarla de Lo que viene", "Yes, same one: remove it from What's coming") : tx("Sí, es la misma: traerla aquí", "Yes, same one: move it here")}</button>
                      <button style={btn(false)} onClick={() => otra(f)}>{tx("No, es otra renta", "No, it's a different income")}</button>
                    </div>
                  </div>)];
                })()}
                {activo && a.delPlan && <div className="fp10-campos" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginTop: 8 }}>
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2 }}>{tx(`La creaste en el plan en ${anioCal(a.anio)}. Lo que le metes se suma a ella y rinde igual${detR && detR.rendimientoPct != null ? ` (${fmtPctEs(detR.rendimientoPct, 1)} al año)` : ""}; si te paga una parte, te paga en la misma proporción.`, `You created it in the plan in ${anioCal(a.anio)}. What you add joins it and earns the same${detR && detR.rendimientoPct != null ? ` (${fmtPctEs(detR.rendimientoPct, 1)} a year)` : ""}; if it pays you a share, it pays in the same proportion.`)}</div>
                  <label style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿Cuánto le metes? ($)", "How much do you add? ($)")}<NumberInput style={inp} value={x0.monto} onChange={(v) => upR({ monto: v })} />
                    <BotonSaldo disponible={Math.max(0, quedaEnAnio(anioSel) + (Number(x0.monto) || 0))} actual={Number(x0.monto) || 0} anio={anioSel} on={(v) => upR({ monto: v })} /></label>
                  <div style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿De dónde sale?", "Where does it come from?")}<div style={{ fontSize: 13.5, color: C.tx, padding: "8px 0" }}>{tx(`Del saldo de ${anioCal(anioSel)}`, `From the ${anioCal(anioSel)} balance`)}</div></div>
                </div>}
                {activo && !a.delPlan && <div style={{ marginTop: 8 }}><AporteCampos x={cfg.reinversiones[iR]} up={upR} det={detR} activos={r.activos} vendidos={r.vendidos || []} saldoDisp={Math.max(0, quedaEnAnio(anioSel) + (Number(cfg.reinversiones[iR].monto) || 0))} sinRenta={!(Number(cfg.reinversiones[iR].rentaMensual) > 0) && rentasFuturasDelActivo(cfg, a, r.activos).some((f) => f.vinculada)} /></div>}
              </div>
            );
          })}
          {(() => { const libres = activosParaAportar(r, cfg, anioSel); if (!libres.length) return null; return (
            <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 10, marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: C.tx2 }}>
              <span>{tx(`+ Meterle más a algo que ya tienes ${anioSel === 1 ? "hoy" : "en " + anioCal(anioSel)}:`, `+ Add more to something you own in ${anioSel === 1 ? "today" : anioCal(anioSel)}:`)}</span>
              <select style={{ ...inp, width: "auto", maxWidth: "100%" }} value="" onChange={(e) => { if (e.target.value) reinvEnAnio(e.target.value, anioSel); }}>
                <option value="">{tx("Elegir…", "Choose…")}</option>
                <OpcionesAportar libres={libres} />
              </select>
            </div>); })()}
        </div>
        <ResultadoAnio r={r} cfg={cfg} set={set} cuenta={cuenta} anioSel={anioSel} setAnioSel={setAnioSel} />
        {/* 23-nov-2026: «Negocios que se repiten» (antes D) vive ahora dentro de Propiedad raíz en C: se repite o no es una opción de cada inversión. */}
        <div style={card}>
          <Seccion n="D" titulo={tx("Lo que sobra y en qué lo reinviertes", "Your surplus and where you reinvest it")} sub={tx("Dos cosas distintas: lo que sobra de las ventas (una vez) y lo que te sobra cada mes de tus rentas e ingresos.", "Two different things: what's left from sales (one time) and what's left over every month from your income.")} />
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
        <SaldoFijo cuenta={cuenta} anioSel={anioSel} onVer={() => document.getElementById("f10-anios")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      </>)}

      {paso === 3 && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{tx("Resultado a 10 años", "10-year result")}</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{tx("Así se ve este escenario. Guárdalo en el paso 5 para compararlo con otros.", "Here's how this scenario looks. Save it in step 5 to compare it with others.")}</div>
        </div>
        <PlanInforme r={r} nombre={tx("Este escenario", "This scenario")} inflacionPct={esc.inflacionPct} />
        {hayAlertaLiquidez(r) && <div style={{ ...card, borderColor: C.rd }}>
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
          <h3 style={{ marginTop: 0 }}>{editando ? `${tx("Estás editando", "You're editing")} «${editando.nombre}»` : tx("Ponle nombre a este escenario", "Name this scenario")}</h3>
          <div style={{ fontSize: 12, color: C.tx2, marginBottom: 8 }}>{editando ? tx("Cada cambio se guarda solo en este escenario. El nombre se cambia tocando el título de arriba.", "Every change is saved to this scenario automatically. Rename it by tapping the title at the top.") : tx("Con nombre queda guardado y lo puedes comparar con los demás y con «Si me quedo como estoy».", "What you built in steps 1–3 doesn't have a name yet. Name it to save it and compare it with the others.")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {!editando && <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder={tx("Nombre del escenario, ej.: Conservador + casa", "Scenario name, e.g. Conservative + house")} value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />}
            {editando ? <>
              <button style={btn(false)} disabled={demo} onClick={() => guardar(`${editando.nombre} ${tx("(copia)", "(copy)")}`)}>{tx("Guardar como nuevo", "Save as new")}</button>
              <button style={btn(false)} onClick={() => { setEditandoId(null); setNombreEsc(""); setDescEsc(""); }}>{tx("Terminar de editar", "Done editing")}</button>
            </> : <button style={btn(!demo)} disabled={demo} onClick={() => { guardar(); setVista("creados"); setVerEsc(null); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{tx("Guardar y comparar", "Save and compare")}</button>}
          </div>
          <input style={{ ...inp, marginTop: 6 }} placeholder={`${tx("Resumen en una frase (opcional). Si lo dejas vacío:", "One-line summary (optional). If left blank:")} «${resumenEscenario(r)}»`} value={descEsc} onChange={(e) => setDescEsc(e.target.value)} />
        </div>}
        {!verEsc && demo && <p style={{ color: C.am, fontSize: 12 }}>{msgDemoF10()}</p>}
        {/* 23-nov-2026 (Santiago: "revise todo el proceso, que sea claro"). Este paso solo guarda. Comparar se hace en
            «Escenarios creados», con las mismas tarjetas y palabras: antes aquí salía otro comparador («Camino A», «Hoy»). */}
        {!hayBorrador && !editando && <div style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{tx("No hay nada por guardar", "Nothing to save")}</h3>
          <div style={{ fontSize: 13, color: C.tx2 }}>{tx("Para crear un escenario, cambia algo en los pasos 1 a 3 y vuelve aquí a ponerle nombre.", "To create a scenario, change something in steps 1–3 and come back here to name it.")}</div>
        </div>}
        <button type="button" onClick={() => { setVista("creados"); setVerEsc(null); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} style={{ ...btn(false), width: "100%", minHeight: 48, marginBottom: 12, fontSize: 14 }}>{tx(`Ver y comparar tus escenarios${escenarios.length ? ` (${escenarios.length})` : ""} →`, `View and compare your scenarios${escenarios.length ? ` (${escenarios.length})` : ""} →`)}</button>
      </>)}


      {/* 24-oct-2026 (Santiago: "que sea fluido el proceso, una etapa te lleva a
          la siguiente"). Al final de cada paso, el siguiente. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {paso > 0 && <button style={{ ...btn(false), padding: "12px" }} onClick={() => { ir(paso - 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{tx("← Atrás", "← Back")}</button>}
        {paso < PASOS.length - 1 && <button style={{ ...btn(true), flex: 1, padding: "12px", fontWeight: 600 }} onClick={() => { ir(paso + 1); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}>{tx("Siguiente:", "Next:")} {PASOS[paso + 1]} →</button>}
      </div>
      {/* 23-nov-2026: resultado en vivo mientras llenas los pasos 1 a 3; al tocarlo, paso 4. */}
      {paso <= 2 && <BarraFuturo10 rPlan={r} rHoy={(planesComparar[0] || {}).r} onIr={() => { ir(3); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />}
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
// 24-nov-2026 — Paso 2 · Lo que viene, como hitos en una sola línea de tiempo (Santiago: "aquí se
// proyectan los ingresos o gastos que van a empezar a aparecer durante esos 10 años"; "si uno aquí
// declara qué hitos importantes vienen —universidad de los hijos, pensión, compra de un local o un
// lote— en cada año aparecen esos pendientes"; "veo como dos veces el proceso"). Lo del paso 1
// aparece marcado (se cambia allá) y lo de aquí se edita en su fila. Cada hito cae en su año en el
// paso 3: lo que se repite, en lo que cuesta vivir; las compras, en lo ya comprometido.
// Lo decidido en el paso 1, por año (lo que se vende o vence, las rentas que empiezan o cambian, lo que
// le metes a lo que ya tienes y los ingresos que se acaban). Montos al mes en pesos de hoy.
function decididoPorAnio(user, cfg, r) {
  const invs = inversionesHoy(user, cfg);
  const reinv = (cfg.reinversiones || []).filter((y) => y && y.activoId);
  const ings = ingresosSueltosHoy(user, cfg);
  const lib = r.liberados || [];
  const anios = {};
  const de = (t) => (anios[t] = anios[t] || { vende: [], rentas: [], aportes: [], ingresos: [] });
  invs.forEach((x) => {
    if (x.vende || x.termina) {
      const t = Math.max(1, Number(x.termina) || 1);
      if (t === 1) {
        const bruto = ((r.vendidos || []).find((y) => y.id === x.id) || {}).valor ?? x.valor;
        const deuda = (r.deudas || []).filter((d) => d.porVenta && d.activoId === x.id).reduce((sm, d) => sm + (d.pagado || 0), 0);
        de(1).vende.push({ id: x.id, nombre: x.nombre, bruto, deuda, renta: Number(x.usada) || 0 });
      } else {
        const l = lib.find((y) => y.id === x.id && y.anio === t);
        const deuda = (l && l.pagoDeuda) || 0;
        de(t).vende.push({ id: x.id, nombre: x.nombre, bruto: (l ? l.monto : devuelve(x)) + deuda, deuda, renta: Number(x.usada) || 0 });
      }
    }
    if (x.cambio) de(x.cambio.desde || 1).rentas.push({ id: x.id, nombre: x.nombre, antes: Number(x.usada) || 0, despues: x.cambio.modo === "propio" ? 0 : x.cambio.mensual });
  });
  reinv.forEach((y, k) => {
    const a = invs.find((x) => x.id === y.activoId); if (!a) return;
    de(Math.max(1, Number(y.anio) || 1)).aportes.push({ id: `${y.activoId}_${k}`, nombre: a.nombre, monto: Number(y.monto) || 0 });
    if (Number(y.rentaMensual) > 0 && !a.cambio) de(Math.floor((Number(y.rentaDesdeMes) || 0) / 12) + 1).rentas.push({ id: `${y.activoId}_r${k}`, nombre: a.nombre, antes: 0, despues: Number(y.rentaMensual) });
  });
  ings.filter((i) => i.seVa === "acaba" && i.acabaAnio > 1).forEach((i) => de(i.acabaAnio).ingresos.push({ id: i.key, nombre: i.nombre, mensual: i.mensual }));
  const conserva = invs.filter((x) => !x.vende && !x.termina && !x.cambio && !reinv.some((y) => y.activoId === x.id));
  return { anios, conserva };
}

function LoQueViene({ user, cfg, set, esc, owners, activos = [], fuentes = [], r, irHoy, irAPlata }) {
  const [abierto, setAbierto] = useState(null);
  const [deudaNueva, setDeudaNueva] = useState(null); // { id, anio } mientras se agrega un pago de deuda
  const f = { ingresos: [], activos: [], gastos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upG = (i, v) => put("gastos", (f.gastos || []).map((x, j) => (j === i ? { ...x, ...v } : x)));
  const SUP = supuestosF10();
  const hintVal = (cl) => fmtPctEs(((1 + esc.inflacionPct / 100) * (1 + (cl === "inmueble" || cl === "vivienda" || cl === "lote" ? SUP.presets.fincaRaiz.valorizacionSpread : SUP.otrosRealSpread) / 100) - 1) * 100, 1);
  const selAnio = (v, on, desde = 1) => <select style={inp} value={v ?? ""} onChange={(e) => on(Number(e.target.value))}>{ANIOS.filter((y) => y >= desde).map((y) => <option key={y} value={y}>{y === 1 ? tx(`Ya (${anioCal(1)})`, `Now (${anioCal(1)})`) : anioCal(y)}</option>)}</select>;
  const campo = (l, ctrl, ayuda, col) => <label style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0, alignContent: "start" }}>{l}{ctrl}{ayuda && <span style={{ fontSize: 12, color: col || C.tx2, lineHeight: 1.35 }}>{ayuda}</span>}</label>;
  const fila4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10, alignItems: "start" };
  const nomActivo = (id) => (activos.find((y) => y.id === id) || {}).nombre || tx("ese activo", "that asset");
  const cambiosP1 = leerCambios(cfg);
  const { anios: p1 } = decididoPorAnio(user, cfg, r);

  // ── Los hitos, año por año ──────────────────────────────────────────────
  const hitos = [];
  const pon = (anio, h) => hitos.push({ anio: Math.min(10, Math.max(1, anio || 1)), ...h });
  Object.entries(p1).forEach(([t, g]) => {
    const anio = Number(t);
    g.vende.forEach((v) => pon(anio, { key: "p1v" + v.id, paso1: true, nombre: v.nombre, que: anio === 1 ? tx("lo vendes", "you sell it") : tx("se vende o vence", "sold or matures"), capital: v.bruto - v.deuda, capTxt: tx("te llegan", "you receive"), nota: v.deuda > 0.5 ? tx(`ya descontada su deuda (${plata(Math.round(v.deuda))})`, `net of its debt (${plata(Math.round(v.deuda))})`) : null, mes: v.renta > 0.5 ? -v.renta : null }));
    g.rentas.forEach((x) => pon(anio, { key: "p1r" + x.id, paso1: true, nombre: x.nombre, que: x.despues < 0.5 ? tx("deja de rentar: lo usas tú", "stops earning: you use it") : x.antes > 0.5 ? tx(`renta ${plata(Math.round(x.despues))} al mes (antes ${plata(Math.round(x.antes))})`, `rents for ${plata(Math.round(x.despues))} a month (was ${plata(Math.round(x.antes))})`) : tx("empieza a rentar", "starts earning"), mes: x.despues - x.antes }));
    g.aportes.forEach((x) => pon(anio, { key: "p1a" + x.id, paso1: true, nombre: x.nombre, que: tx("le metes plata", "you add money"), capital: -x.monto, capTxt: tx("pones", "you put in") }));
    g.ingresos.forEach((x) => pon(anio, { key: "p1i" + x.id, paso1: true, nombre: x.nombre, que: tx("se acaba", "ends"), mes: -x.mensual }));
  });
  f.ingresos.forEach((x, i) => { const d = Math.max(1, Number(x.desde) || 1), h = vacio(x.hasta) ? null : Number(x.hasta); pon(d, { key: "i:" + i, tipo: "ingreso", nombre: x.nombre || tx("Ingreso nuevo", "New income"), que: h ? tx(`hasta ${anioCal(h)}`, `until ${anioCal(h)}`) : tx("sigue siempre", "ongoing"), mes: Number(x.mensual) || 0, dup: !!(x.activoId && cambiosP1[x.activoId] && ![].concat(x.noEsRentaDe || []).includes(x.activoId)) }); if (h && h < 10) pon(h + 1, { key: "i:" + i + ":fin", tipo: "ingreso", fin: true, nombre: x.nombre || tx("Ingreso nuevo", "New income"), que: tx("se acaba", "ends"), mes: -(Number(x.mensual) || 0) }); });
  (f.gastos || []).forEach((x, i) => { const d = Math.max(1, Number(x.desde) || 1), n = vacio(x.anios) ? null : Math.max(1, Number(x.anios) || 1), mes = (Number(x.anual) || 0) / 12; pon(d, { key: "g:" + i, tipo: "gasto", nombre: x.nombre || tx("Gasto nuevo", "New expense"), que: n ? tx(`durante ${enAnios(n)}`, `for ${enAnios(n)}`) : tx("siempre", "ongoing"), mes: -mes }); if (n && d + n <= 10) pon(d + n, { key: "g:" + i + ":fin", tipo: "gasto", fin: true, nombre: x.nombre || tx("Gasto nuevo", "New expense"), que: tx("termina", "ends"), mes }); });
  f.activos.forEach((x, i) => {
    // Los pagos, como los arma el motor: la parte de antes en su año y el resto al recibirla.
    const ent = Math.max(1, Number(x.entrega) || 1), val = Number(x.valor) || 0, cu = Math.min(val, Number(x.cuotaInicial) || 0);
    const pagos = (Array.isArray(x.pagos) && x.pagos.length ? x.pagos.map((p) => ({ anio: Math.max(1, Number(p.anio) || 1), monto: Number(p.monto) || 0 })) : [{ anio: Math.min(Math.max(1, Number(x.anioCuota) || 1), ent), monto: cu }, { anio: ent, monto: val - cu }]).filter((p) => p.monto > 0.5);
    if (!pagos.length) pon(ent, { key: "a:" + i, tipo: "compra", nombre: x.nombre || tx("Compra nueva", "New purchase"), que: tx("falta el valor", "value missing") });
    pagos.forEach((p, k) => pon(p.anio, { key: "a:" + i + (k ? ":" + k : ""), tipo: "compra", nombre: x.nombre || tx("Compra nueva", "New purchase"), que: pagos.length > 1 ? (x.desglose ? tx(`pago ${k + 1} de ${pagos.length}`, `payment ${k + 1} of ${pagos.length}`) : k === 0 ? tx("anticipo", "down payment") : tx("pago al recibirla", "paid on delivery")) : tx("la pagas", "you pay for it"), capital: -p.monto, capTxt: tx("pagas", "you pay"), nota: k === 0 ? (x.desglose ? tx("detallada en el paso 3", "detailed in step 3") : tx("presupuesto", "budget")) : null }));
    if ((Number(x.gastoMensual) || 0) > 0) pon(ent, { key: "a:" + i + ":gasto", tipo: "gasto", nombre: tx(`Lo que cuesta tener ${x.nombre || "la compra"}`, `Cost of owning ${x.nombre || "it"}`), que: tx("desde que la recibes", "from when you get it"), mes: -Number(x.gastoMensual) });
    const renta = Number(x.rentaMensual) || 0;
    if (renta > 0 && (x.clase === "inmueble" || x.clase === "negocio")) pon(Number(x.rentaDesde) || Number(x.entrega) || 1, { key: "a:" + i + ":renta", tipo: "compra", nombre: x.nombre || tx("Compra nueva", "New purchase"), que: tx("empieza a rentar", "starts earning"), mes: renta });
  });
  // 24-nov-2026 (Santiago: "pago de saldo pendiente del local comercial, 437 MM, en 2028"). Pagar una
  // deuda también es un hito: cae en su año como compromiso. Es el mismo dato de «Se paga en» del paso 3.
  const pd = cfg.pagarDeudas || {};
  (r.deudas || []).filter((d) => !d.porVenta && !d.ventaAnio).forEach((d) => {
    const enPlan = d.pagado > 0.5 || d.pagaEnPlan;
    const anio = d.pagado > 0.5 ? 1 : d.pagaAnio;
    const monto = d.pagado > 0.5 ? d.pagado : d.pagoEnAnio;
    if (!anio || !(monto > 0.5)) return;
    pon(anio, { key: "d:" + d.id, deuda: d, enPlan, nombre: tx(`Pagas ${d.nombre}`, `Pay off ${d.nombre}`), que: enPlan ? (d.cuotaMes > 0.5 ? tx("y dejas de pagar su cuota", "and its payment stops") : tx("pago de una vez", "one-time payment")) : tx("vence este año (página Deudas)", "due this year (Debts page)"), capital: -monto, capTxt: tx("pagas", "you pay"), mes: d.cuotaMes > 0.5 ? d.cuotaMes : null });
  });
  const deudasLibres = (r.deudas || []).filter((d) => !d.porVenta && !d.ventaAnio && !(d.pagado > 0.5) && !d.pagaAnio && d.saldo > 0.5);
  const anios = [...new Set(hitos.map((h) => h.anio))].sort((a, b) => a - b);
  const abrir = (k) => setAbierto((a) => (a === k ? null : k));
  const nuevo = (k, arr, item) => { put(k, [...arr, item]); setAbierto((k === "ingresos" ? "i:" : k === "gastos" ? "g:" : "a:") + arr.length); };
  const aviso = (txt, boton) => <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: C.tx, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px", lineHeight: 1.45 }}>{txt}{boton && <div style={{ marginTop: 6 }}>{boton}</div>}</div>;
  const pie = (quitar) => <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
    <button type="button" style={{ ...btn(false), padding: "6px 12px" }} onClick={() => { quitar(); setAbierto(null); }}>{tx("Quitar", "Remove")}</button>
    <button type="button" style={{ ...btn(true), padding: "6px 12px" }} onClick={() => setAbierto(null)}>{tx("Listo", "Done")}</button>
  </div>;

  // ── Formularios (uno por tipo, mismas preguntas en el mismo orden) ───────
  const formIngreso = (i) => { const x = f.ingresos[i]; if (!x) return null; const d = Math.max(1, Number(x.desde) || 1); return <div style={{ display: "grid", gap: 10 }}>
    <div style={fila4}>
      {campo(tx("Nombre", "Name"), <input style={inp} value={x.nombre || ""} placeholder={esUS() ? tx("Ej.: Seguro Social", "e.g. Social Security") : tx("Ej.: pensión", "e.g. pension")} onChange={(e) => upI(i, { nombre: e.target.value })} />)}
      {campo(esUS() ? tx("Al mes ($, dólares de hoy)", "Per month ($, today's dollars)") : tx("Al mes ($, pesos de hoy)", "Per month ($, today's pesos)"), <NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />)}
      {campo(tx("Empieza", "Starts"), selAnio(d, (v) => upI(i, { desde: v, ...(Number(x.hasta) && Number(x.hasta) < v ? { hasta: v } : {}) })))}
      {campo(tx("¿Hasta cuándo?", "Until when?"), <select style={inp} value={vacio(x.hasta) ? "" : x.hasta} onChange={(e) => upI(i, { hasta: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Sigue siempre", "Ongoing")}</option>{ANIOS.filter((y) => y >= d).map((y) => <option key={y} value={y}>{tx(`Hasta ${anioCal(y)}`, `Until ${anioCal(y)}`)}</option>)}</select>)}
      {campo(tx("¿Sale de un activo tuyo?", "From an asset you own?"), <select style={inp} value={x.activoId || ""} onChange={(e) => upI(i, { activoId: e.target.value || null })}><option value="">{tx("No (pensión, sueldo, honorarios…)", "No (pension, salary, fees…)")}</option>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>)}
      {owners.length > 1 && campo(tx("Titular (opcional)", "Owner (optional)"), <select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select>)}
      {x.activoId && aviso(cambiosP1[x.activoId] && ![].concat(x.noEsRentaDe || []).includes(x.activoId)
        ? tx(`La renta de ${nomActivo(x.activoId)} ya la cambiaste en el paso 1: se cuenta una sola vez, la de allá.`, `You already changed ${nomActivo(x.activoId)}'s income in step 1: it's counted once, from there.`)
        : tx(`Esta renta es de ${nomActivo(x.activoId)}: va en el paso 1, en ese activo («Cambia»). Ponla allá y quítala de aquí.`, `This income is ${nomActivo(x.activoId)}'s: it goes in step 1, on that asset ("Changes"). Enter it there and remove it here.`),
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" style={btn(true)} onClick={irHoy}>{tx("Ir al paso 1", "Go to step 1")}</button>{cambiosP1[x.activoId] && <button type="button" style={btn(false)} onClick={() => upI(i, { noEsRentaDe: [...new Set([].concat(x.noEsRentaDe || [], x.activoId))] })}>{tx("Es otra renta", "It's a different income")}</button>}</div>)}
      {(() => { const dd = rentasDuplicadas(cfg, activos).find((y) => y.k === i); return dd && aviso(dd.seguro ? tx(`Esta renta ya está en lo que le metes a ${dd.activo} (${plata(dd.contada)} al mes): se cuenta una sola vez, la de allá.`, `This income is already in what you add to ${dd.activo} (${plata(dd.contada)} a month): counted once, from there.`) : tx(`¿Es la misma renta de ${dd.activo} (${plata(dd.contada)} al mes)? Mientras no lo confirmes, se suman las dos.`, `Is this the same ${dd.activo} income (${plata(dd.contada)} a month)? Until you confirm, both are added.`),
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" style={btn(true)} onClick={() => { put("ingresos", f.ingresos.filter((_, j) => j !== i)); setAbierto(null); }}>{tx("Quitarla de aquí", "Remove it here")}</button><button type="button" style={btn(false)} onClick={() => upI(i, { noEsRentaDe: [...new Set([].concat(x.noEsRentaDe || [], dd.activoId))] })}>{tx("Es otra renta", "It's a different income")}</button></div>); })()}
    </div>
    {(Number(x.mensual) || 0) > 0 && <div style={{ fontSize: 12, color: C.gn }}>{textoIngresoFuturo(x)}</div>}
    {pie(() => put("ingresos", f.ingresos.filter((_, j) => j !== i)))}
  </div>; };
  const formGasto = (i) => { const x = (f.gastos || [])[i]; if (!x) return null; const n = vacio(x.anios) ? "" : Math.max(1, Number(x.anios) || 1); const mesP = x.periodo === "mes"; return <div style={{ display: "grid", gap: 10 }}>
    <div style={fila4}>
      {campo(tx("Nombre", "Name"), <input style={inp} value={x.nombre || ""} placeholder={tx("Ej.: universidad de los hijos", "e.g. kids' college")} onChange={(e) => upG(i, { nombre: e.target.value })} />)}
      {/* El selector al mes / al año va fuera de la etiqueta: un botón dentro de <label> se lleva el clic del campo. */}
      <div style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0, alignContent: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
          <span id={"f10-gmonto-" + i}>{esUS() ? tx("Monto ($, dólares de hoy)", "Amount ($, today's dollars)") : tx("Monto ($, pesos de hoy)", "Amount ($, today's pesos)")}</span>
          <span role="group" aria-label={tx("Al mes o al año", "Monthly or yearly")} style={{ display: "inline-flex", border: `1px solid ${C.bd}`, borderRadius: 999, overflow: "hidden" }}>{[["mes", tx("al mes", "monthly")], ["año", tx("al año", "yearly")]].map(([k, l]) => <button key={k} type="button" aria-pressed={(k === "mes") === mesP} onClick={() => upG(i, { periodo: k })} style={{ border: "none", padding: "2px 8px", fontSize: 11.5, cursor: "pointer", background: (k === "mes") === mesP ? "rgba(0,200,5,0.15)" : "transparent", color: (k === "mes") === mesP ? C.gn : C.tx2 }}>{l}</button>)}</span>
        </div>
        <NumberInput aria-labelledby={"f10-gmonto-" + i} style={inp} value={mesP ? (vacio(x.anual) ? "" : Math.round((Number(x.anual) || 0) / 12)) : (x.anual ?? "")} onChange={(v) => upG(i, { anual: mesP ? (vacio(v) ? "" : (Number(v) || 0) * 12) : v })} />
      </div>
      {campo(tx("Empieza", "Starts"), selAnio(Math.max(1, Number(x.desde) || 1), (v) => upG(i, { desde: v })))}
      {campo(tx("¿Cuántos años?", "For how many years?"), <select style={inp} value={n} onChange={(e) => upG(i, { anios: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Siempre", "Ongoing")}</option>{ANIOS.map((y) => <option key={y} value={y}>{enAnios(y)}</option>)}</select>)}
    </div>
    {(Number(x.anual) || 0) > 0 && <div style={{ fontSize: 12, color: C.am }}>{tx(`Sale ${plata(Math.round(Number(x.anual) / 12))} al mes (${plata(Number(x.anual))} al año) desde ${anioCal(Math.max(1, Number(x.desde) || 1))}${n ? `, durante ${enAnios(n)}` : ", siempre"}. Sube cada año con la inflación.`, `${plata(Math.round(Number(x.anual) / 12))} a month (${plata(Number(x.anual))} a year) from ${anioCal(Math.max(1, Number(x.desde) || 1))}${n ? `, for ${enAnios(n)}` : ", ongoing"}. Grows with inflation.`)}</div>}
    {pie(() => put("gastos", (f.gastos || []).filter((_, j) => j !== i)))}
  </div>; };
  const formCompra = (i) => {
    const x = f.activos[i]; if (!x) return null;
    const tipo = x.clase || "inmueble", renta = tipo === "inmueble" || tipo === "negocio";
    const total = Number(x.valor) || 0, antes = Math.min(total, Number(x.cuotaInicial) || 0);
    const fps = (Array.isArray(x.fuentes) ? x.fuentes : x.fuenteId ? [{ id: x.fuenteId, pct: 100 }] : []).map((z) => (z.monto == null && z.pct != null ? { id: z.id, monto: Math.round((Number(z.pct) || 0) / 100 * total) } : z));
    const setFps = (arr) => upA(i, { fuentes: arr.map(({ id, monto }) => ({ id, monto })), fuenteId: null });
    const sumaFps = fps.reduce((sm, z) => sm + (Number(z.monto) || 0), 0), faltaF = Math.max(0, total - sumaFps);
    const anio0 = Math.max(1, Number((x.desglose || {}).anio0) || (antes > 0 ? Math.min(Number(x.anioCuota) || 1, Number(x.entrega) || 1) : Number(x.entrega) || 1));
    const irDetalle = <button type="button" style={{ ...btn(true), padding: "6px 12px" }} onClick={() => irAPlata && irAPlata(anio0)}>{x.desglose ? tx(`Ver el detalle en ${anioCal(anio0)}`, `See the detail in ${anioCal(anio0)}`) : tx(`Detallar en ${anioCal(anio0)}`, `Detail it in ${anioCal(anio0)}`)}</button>;
    if (x.desglose) return <div style={{ display: "grid", gap: 10 }}>
      <div style={fila4}>
        {campo(tx("¿Qué es?", "What is it?"), <select style={inp} value={tipo} onChange={(e) => upA(i, { clase: e.target.value })}><option value="vivienda">{tx("Casa para vivir", "Home to live in")}</option><option value="inmueble">{tx("Inmueble para rentar", "Rental property")}</option><option value="lote">{tx("Lote", "Lot")}</option><option value="negocio">{tx("Negocio", "Business")}</option><option value="otro">{tx("Otro", "Other")}</option></select>)}
        {campo(tx("Nombre", "Name"), <input style={inp} value={x.nombre || ""} onChange={(e) => upA(i, { nombre: e.target.value })} />)}
      </div>
      <div style={{ fontSize: 12.5, color: C.tx, lineHeight: 1.5 }}>{tx(`Ya la detallaste en ${anioCal(anio0)} (${(MODOS_COMPRA().find(([k]) => k === x.desglose.modo) || [, ""])[1].toLowerCase()}): cuesta ${plata(Math.round(total))} y la recibes en ${anioCal(Math.max(1, Number(x.entrega) || 1))}.${x.presupuesto != null ? ` Tu presupuesto era ${plata(Math.round(x.presupuesto))}.` : ""}`, `You detailed it in ${anioCal(anio0)}: it costs ${plata(Math.round(total))} and you get it in ${anioCal(Math.max(1, Number(x.entrega) || 1))}.`)}</div>
      <div>{irDetalle}</div>
      {pie(() => put("activos", f.activos.filter((_, j) => j !== i)))}
    </div>;
    return <div style={{ display: "grid", gap: 10 }}>
      <div style={fila4}>
        {campo(tx("¿Qué es?", "What is it?"), <select style={inp} value={tipo} onChange={(e) => upA(i, { clase: e.target.value })}><option value="vivienda">{tx("Casa para vivir", "Home to live in")}</option><option value="inmueble">{tx("Inmueble para rentar", "Rental property")}</option><option value="lote">{tx("Lote", "Lot")}</option><option value="negocio">{tx("Negocio", "Business")}</option><option value="otro">{tx("Otro", "Other")}</option></select>)}
        {campo(tx("Nombre", "Name"), <input style={inp} value={x.nombre || ""} placeholder={tipo === "vivienda" ? tx("Ej.: casa finca", "e.g. lake house") : tx("Ej.: local comercial", "e.g. storefront")} onChange={(e) => upA(i, { nombre: e.target.value })} />)}
        {campo(tx("Presupuesto ($)", "Budget ($)"), <NumberInput style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} />, tx("Lo que calculas hoy. El detalle lo armas en su año.", "Your estimate today. You detail it in its year."))}
        {campo(tx("¿Cuándo está lista?", "When is it ready?"), selAnio(Math.max(1, Number(x.entrega) || 1), (v) => upA(i, { entrega: v, anioCuota: Math.min(Number(x.anioCuota) || 1, v) })))}
      </div>
      <div style={fila4}>
        {campo(tx("¿Pagas una parte antes? ($, opcional)", "Pay part upfront? ($, optional)"), <NumberInput style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} />)}
        {antes > 0 && campo(tx("¿Cuándo pagas esa parte?", "When do you pay that part?"), selAnio(Math.max(1, Number(x.anioCuota) || 1), (v) => upA(i, { anioCuota: Math.min(v, Number(x.entrega) || 1) })))}
        {renta && campo(tx("¿Cuánto renta al mes? ($, opcional)", "Monthly rent? ($, optional)"), <NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} />)}
        {renta && (Number(x.rentaMensual) || 0) > 0 && campo(tx("¿Desde cuándo renta?", "Rented from when?"), selAnio(Math.max(1, Number(x.rentaDesde) || Number(x.entrega) || 1), (v) => upA(i, { rentaDesde: v })))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: C.tx2 }}>
        <span style={{ flex: "1 1 260px" }}>{tx(`¿La vas a construir o comprar sobre planos? El detalle (lote, metros, valor del m², valorización) lo armas en ${anioCal(anio0)}, en el paso 3.`, `Will you build it or buy off-plan? You detail it (lot, m², value per m², appreciation) in ${anioCal(anio0)}, in step 3.`)}</span>
        {irDetalle}
      </div>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 12.5, color: C.tx2 }}>{tx("Más detalles: cuánto vale lista, cuánto sube y de dónde sale la plata", "More details: value when ready, appreciation and where the money comes from")}</summary>
        <div style={{ ...fila4, marginTop: 10 }}>
          {campo(tx("¿Cuánto vale cuando está lista? ($, opcional)", "Worth when ready? ($, optional)"), <NumberInput style={inp} placeholder={tx("Si vale más de lo que cuesta", "If worth more than it costs")} value={x.valorAlTerminar ?? ""} onChange={(v) => upA(i, { valorAlTerminar: v })} />)}
          {campo(tx("¿Cuánto sube su valor al año? (%)", "Annual appreciation (%)"), <InputDecimalEs style={inp} placeholder={hintVal(tipo)} value={x.valorizacionNomPct ?? ""} onChange={(v) => upA(i, { valorizacionNomPct: v })} />, tx(`Si no sabes, déjalo en ${hintVal(tipo)}.`, `If unsure, leave it at ${hintVal(tipo)}.`))}
        </div>
        <div style={{ fontSize: 12, color: C.tx2, marginTop: 10 }}>{tx("¿Sale de una inversión en particular? Si no eliges, sale de la plata de ese año (paso 3).", "Paid from a specific investment? If you don't choose, it comes from that year's money (step 3).")}</div>
        {fps.map((fp, k) => <div key={k} style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <select style={{ ...inp, flex: 1 }} value={fp.id || ""} onChange={(e) => setFps(fps.map((z, j) => (j === k ? { ...z, id: e.target.value } : z)))}><option value="">{tx("Elige una inversión", "Choose an investment")}</option>{fuentes.map((y) => <option key={y.id} value={y.id}>{y.nombre}</option>)}</select>
          <span style={{ width: 160 }}><NumberInput style={inp} placeholder={tx("¿Cuánto sacas?", "How much?")} value={fp.monto ?? ""} onChange={(v) => setFps(fps.map((z, j) => (j === k ? { ...z, monto: v } : z)))} /></span>
          <button type="button" aria-label={tx("Quitar esta fuente", "Remove this source")} style={{ ...btn(false), padding: "6px 10px" }} onClick={() => setFps(fps.filter((_, j) => j !== k))}>✕</button>
        </div>)}
        <button type="button" style={{ ...btn(false), marginTop: 6, padding: "6px 12px" }} onClick={() => setFps([...fps, { id: "", monto: faltaF || "" }])}>+ {fps.length ? tx("Otra inversión", "Another investment") : tx("Sale de una inversión", "From an investment")}</button>
      </details>
      {total > 0 && <div style={{ fontSize: 12, color: C.am }}>{antes > 0 ? tx(`Pagas ${plata(antes)} en ${anioCal(Math.max(1, Number(x.anioCuota) || 1))} y ${plata(total - antes)} en ${anioCal(Math.max(1, Number(x.entrega) || 1))}`, `You pay ${plata(antes)} in ${anioCal(Math.max(1, Number(x.anioCuota) || 1))} and ${plata(total - antes)} in ${anioCal(Math.max(1, Number(x.entrega) || 1))}`) : tx(`Pagas ${plata(total)} en ${anioCal(Math.max(1, Number(x.entrega) || 1))}`, `You pay ${plata(total)} in ${anioCal(Math.max(1, Number(x.entrega) || 1))}`)}{sumaFps > 0.5 ? tx(`, ${plata(Math.min(sumaFps, total))} de las inversiones que elegiste`, `, ${plata(Math.min(sumaFps, total))} from the investments you chose`) : tx(", con la plata de esos años", ", with those years' money")}.{renta && (Number(x.rentaMensual) || 0) > 0 ? tx(` Renta ${plata(Number(x.rentaMensual))} al mes desde ${anioCal(Number(x.rentaDesde) || Number(x.entrega) || 1)}.`, ` Rents ${plata(Number(x.rentaMensual))} a month from ${anioCal(Number(x.rentaDesde) || Number(x.entrega) || 1)}.`) : ""}{tipo === "vivienda" ? tx(" Si al mudarte dejas de pagar arriendo, márcalo en el paso 1.", " If moving in means you stop paying rent, mark it in step 1.") : ""}</div>}
      {pie(() => put("activos", f.activos.filter((_, j) => j !== i)))}
    </div>;
  };
  const formDe = (k) => { const [t, i] = String(k).split(":"); return t === "i" ? formIngreso(Number(i)) : t === "g" ? formGasto(Number(i)) : t === "a" ? formCompra(Number(i)) : null; };
  const editable = (h) => !h.paso1 && /^[iga]:\d+$/.test(String(h.key));
  const color = (h) => (h.mes != null ? (h.mes > 0 ? C.gn : C.am) : h.capital > 0 ? C.gn : C.tx);
  return (
    <div>
      <div style={{ fontSize: 13, color: C.tx2, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "10px 12px", margin: "10px 0 14px", lineHeight: 1.5 }}>{tx(<><b style={{ color: C.tx }}>Declara aquí los hitos que proyectas para los próximos 10 años</b>: una pensión, la universidad de los hijos, unos aportes, una compra. En el año que corresponda, en el paso 3, los amplías con más detalle o ajustas las cifras si hace falta. Lo de tus activos (venderlos, cambiar su renta o meterles plata) va en el paso 1 y aquí aparece marcado.</>, <><b style={{ color: C.tx }}>Here goes what doesn't come from an asset you already own</b>: a pension, the kids' college, contributions, a purchase. What concerns your assets (selling, changing their income, adding money) goes in step 1 and shows here, marked.</>)}</div>
      {/* 24-nov-2026 (Santiago: "llevar a las personas paso a paso, fácilmente, que no sea un proceso complicado"). */}
      <div style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{tx("¿Qué viene en tus próximos 10 años?", "What's coming in your next 10 years?")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8, marginBottom: 14 }}>
        {[[tx("+ Ingreso que empieza", "+ Income that starts"), tx("Pensión, sueldo, honorarios", "Pension, salary, fees"), () => nuevo("ingresos", f.ingresos, { nombre: "", mensual: "", desde: 2, hasta: "" })],
          [tx("+ Gasto que empieza", "+ Expense that starts"), tx("Universidad, aportes a pensión", "College, pension contributions"), () => nuevo("gastos", f.gastos || [], { nombre: "", anual: "", desde: 2, anios: 4, periodo: "año" })],
          [tx("+ Compra o construcción", "+ Purchase or build"), tx("Tu casa, un local, un lote", "Your home, a storefront, a lot"), () => nuevo("activos", f.activos, { nombre: "", clase: "vivienda", valor: "", cuotaInicial: "", anioCuota: 2, entrega: 2, rentaMensual: "", rentaDesde: "", fuentes: [] })],
          [tx("+ Pago de una deuda", "+ Paying off a debt"), tx("El saldo de un local, una hipoteca", "A property balance, a mortgage"), () => setDeudaNueva(deudaNueva ? null : { id: (deudasLibres[0] || {}).id || "", anio: 2 })],
        ].map(([l, ej, on], k) => <button key={k} type="button" onClick={on} style={{ ...btn(k === 3 && !!deudaNueva), textAlign: "left", padding: "10px 12px", display: "grid", gap: 2 }}><span style={{ fontSize: 13, fontWeight: 600, color: C.gn }}>{l}</span><span style={{ fontSize: 12, color: C.tx2 }}>{ej}</span></button>)}
      </div>
      {deudaNueva && <div style={{ background: C.bg, border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        {deudasLibres.length === 0 ? <div style={{ fontSize: 13, color: C.tx2 }}>{tx("No tienes deudas con saldo pendiente por programar. Las que ya tienen año aparecen abajo, en su año.", "No outstanding debts left to schedule. Those with a year show below, in their year.")}</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 10, alignItems: "end" }}>
          {campo(tx("¿Qué deuda?", "Which debt?"), <select style={inp} value={deudaNueva.id} onChange={(e) => setDeudaNueva({ ...deudaNueva, id: e.target.value })}>{deudasLibres.map((d) => <option key={d.id} value={d.id}>{`${d.nombre} · ${tx("debes", "owe")} ${plata(Math.round(d.saldo))}`}</option>)}</select>)}
          {campo(tx("¿Cuándo la pagas?", "When do you pay it off?"), <select style={inp} value={deudaNueva.anio} onChange={(e) => setDeudaNueva({ ...deudaNueva, anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? tx(`Hoy (${anioCal(1)})`, `Today (${anioCal(1)})`) : anioCal(y)}</option>)}</select>)}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...btn(true), padding: "8px 14px" }} onClick={() => { if (deudaNueva.id) set("pagarDeudas", { ...pd, [deudaNueva.id]: anioCal(deudaNueva.anio) }); setDeudaNueva(null); }}>{tx("Agregar", "Add")}</button>
            <button type="button" style={{ ...btn(false), padding: "8px 14px" }} onClick={() => setDeudaNueva(null)}>{tx("Cancelar", "Cancel")}</button>
          </div>
        </div>}
      </div>}
      {anios.length === 0 && <div style={{ fontSize: 13, color: C.tx2, padding: "4px 0 12px" }}>{tx("Todavía no hay hitos en los próximos 10 años. Empieza con una de las preguntas de arriba.", "No milestones in the next 10 years yet. Start with one of the questions above.")}</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {anios.map((t) => {
          const hs = hitos.filter((h) => h.anio === t);
          const dMes = hs.reduce((sm, h) => sm + (h.mes != null && !h.dup ? h.mes : 0), 0);
          return <div key={t} style={{ background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", paddingBottom: 6, borderBottom: `1px solid ${C.bd}` }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t === 1 ? tx(`Hoy · ${anioCal(1)}`, `Today · ${anioCal(1)}`) : anioCal(t)}</span>
              {Math.abs(dMes) > 0.5 && <span style={{ fontSize: 13, color: C.tx2 }}>{tx("Tu mes cambia", "Your month changes")} <b style={{ color: dMes > 0 ? C.gn : C.am, fontVariantNumeric: "tabular-nums" }}>{dMes > 0 ? "+" : "−"}{plata(Math.round(Math.abs(dMes)))}</b></span>}
            </div>
            {hs.map((h) => <div key={h.key} id={"f10-hito-" + h.key.replace(/[^a-z0-9]/gi, "-")}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.bd}`, flexWrap: "wrap" }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flex: "0 0 auto", background: h.paso1 ? "transparent" : color(h), border: `2px solid ${h.paso1 ? C.tx2 : color(h)}` }} />
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: C.tx }}>{h.nombre}{h.dup && <span style={{ fontSize: 12, color: C.am }}> · {tx("ya está en el paso 1: se cuenta una vez", "already in step 1: counted once")}</span>}</div>
                  <div style={{ fontSize: 12, color: C.tx2 }}>{h.que}{h.nota ? ` · ${h.nota}` : ""}{h.paso1 ? tx(" · del paso 1", " · from step 1") : ""}</div>
                </div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginLeft: "auto" }}>
                  {h.mes != null && Math.abs(h.mes) > 0.5 && <div style={{ fontSize: 13.5, color: h.dup ? C.tx2 : color(h), textDecoration: h.dup ? "line-through" : "none" }}>{h.mes > 0 ? "+" : "−"}{plata(Math.round(Math.abs(h.mes)))} <span style={{ fontSize: 12, color: C.tx2 }}>{tx("al mes", "a month")}</span></div>}
                  {h.capital != null && Math.abs(h.capital) > 0.5 && <div style={{ fontSize: 13.5, color: h.capital > 0 ? C.gn : C.tx }}><span style={{ fontSize: 12, color: C.tx2 }}>{h.capTxt} </span>{plata(Math.round(Math.abs(h.capital)))}</div>}
                </div>
                {h.deuda ? (h.enPlan ? <select aria-label={tx("Año de pago", "Payoff year")} style={{ ...inp, width: "auto", flex: "0 0 auto" }} value={h.anio} onChange={(e) => set("pagarDeudas", { ...pd, [h.deuda.id]: e.target.value === "" ? false : anioCal(Number(e.target.value)) })}>
                    <option value="">{tx("No se paga (sigue)", "Not paid off (keep)")}</option>
                    {ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? tx(`Se paga hoy (${anioCal(1)})`, `Paid today (${anioCal(1)})`) : tx(`Se paga en ${anioCal(y)}`, `Paid in ${anioCal(y)}`)}</option>)}
                  </select> : <span style={{ width: 64 }} />)
                  : h.paso1 ? <button type="button" onClick={irHoy} style={{ background: "transparent", border: "none", padding: "4px 0", color: C.tx2, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", flex: "0 0 auto" }}>{tx("Cambiar en el paso 1", "Change in step 1")}</button>
                  : editable(h) ? <button type="button" style={{ ...btn(abierto === h.key), padding: "6px 12px", flex: "0 0 auto" }} onClick={() => abrir(h.key)}>{abierto === h.key ? tx("Cerrar", "Close") : tx("Editar", "Edit")}</button>
                    : <span style={{ width: 64 }} />}
              </div>
              {abierto === h.key && <div style={{ padding: "12px 0 6px", borderBottom: `1px solid ${C.bd}` }}>{formDe(h.key)}</div>}
            </div>)}
          </div>;
        })}
      </div>
      {/* Un hito recién creado sin año todavía visible (p. ej. sin monto) se edita aquí. */}
      {abierto && !hitos.some((h) => h.key === abierto) && <div style={{ background: C.bg, border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>{formDe(abierto)}</div>}
    </div>
  );
}

// 24-oct-2026 (Santiago: "si vendo Orlando la idea es pagar la deuda de
// Orlando… tengo otras deudas que me gustaría pagar con plata de los activos
// que se venden"). La deuda que cuelga de un activo vendido se paga sola con
// esa venta; las demás se marcan aquí. Solo se pagan con lo vendido.
function Deudas({ r, cfg, set, inv, bolsa, anioSel = 1, setAnioSel }) {
  const sel = cfg.pagarDeudas || {};
  const nombreActivo = (id) => { const a = inv.find((x) => x.id === id); return a ? a.n || a.nombre : tx("el activo", "the asset"); };
  const bd = r.bolsaDetalle || {};
  // 23-nov-2026 (Santiago: "pagué la Volvo en 2027 y sigue apareciendo en 2029"; "me sigue
  // apareciendo local la Macarena que se pagó en 2027"). En cada año solo se listan las deudas
  // que siguen vivas ese año; las ya pagadas van en una línea, con el año en que se pagaron.
  // 23-nov-2026 (Santiago: "se vendió la Volvo en 2026 y se supone que se pagó la deuda, y sigue
  // apareciendo aquí como una opción de pagar"). La deuda que se paga sola con la venta de su
  // activo no es una decisión: va en una línea aparte, no como fila con botones.
  const pagadas = (r.deudas || []).filter((d) => d.finAnio != null && d.finAnio < anioSel).sort((a, b) => a.finAnio - b.finAnio);
  const conVenta = (r.deudas || []).filter((d) => (d.porVenta || d.ventaAnio) && !(d.finAnio != null && d.finAnio < anioSel));
  const vivas = (r.deudas || []).filter((d) => !(d.finAnio != null && d.finAnio < anioSel) && !d.porVenta && !d.ventaAnio);
  const enlace = (d) => <button type="button" onClick={() => setAnioSel && setAnioSel(Math.max(1, d.finAnio || 1))} style={{ background: "transparent", border: "none", padding: 0, color: C.tx, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{d.nombre}</button>;
  return (
    <div>
      {conVenta.length > 0 && <div style={{ fontSize: 12.5, color: C.tx2, padding: "4px 0 6px" }}>
        {tx("Se pagan con la venta de su activo:", "Paid with the sale of their asset:")} {conVenta.map((d, k) => <span key={d.id}>{k > 0 ? " · " : ""}<b style={{ color: C.tx, fontWeight: 500 }}>{d.nombre}</b> ({nombreActivo(d.activoId)}, {d.porVenta ? tx("hoy", "today") : anioCal(d.ventaAnio)})</span>)}
      </div>}
      {pagadas.length > 0 && <div style={{ fontSize: 12.5, color: C.tx2, padding: "4px 0 8px" }}>
        {tx("Ya pagadas:", "Already paid:")} {pagadas.map((d, k) => <span key={d.id}>{k > 0 ? " · " : ""}{enlace(d)} ({d.finAnio <= 1 ? tx("hoy", "today") : anioCal(d.finAnio)}{d.finPorCuota ? tx(", con su cuota", ", by its payments") : d.porVenta || d.ventaAnio ? tx(", con la venta", ", with the sale") : ""})</span>)}
      </div>}
      {vivas.length === 0 && <p style={{ color: C.tx2, fontSize: 13, margin: "4px 0" }}>{tx(`${anioSel === 1 ? "Hoy" : "En " + anioCal(anioSel)} ya no tienes deudas con saldo.`, `No outstanding debt in ${anioSel === 1 ? "today" : anioCal(anioSel)}.`)}</p>}
      {[...vivas].sort((x, y) => y.saldo - x.saldo).map((d) => {
        const corto = d.pagar && d.pagado < d.saldo - 0.5;
        return (
          <div key={d.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{d.nombre}</b><span style={{ color: C.tx2 }}>{plata(d.saldo)}</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
              {d.porVenta
                ? <span style={{ fontSize: 13, color: C.gn }}>{tx("Se paga hoy con la venta de", "Paid off today with the sale of")} {nombreActivo(d.activoId)}</span>
                : d.ventaAnio
                  ? <span style={{ fontSize: 13, color: C.gn }}>{tx(`Se paga en ${anioCal(d.ventaAnio)} con la venta de ${nombreActivo(d.activoId)}; hasta entonces sigues pagando la cuota.`, `Paid off in ${anioCal(d.ventaAnio)} with the sale of ${nombreActivo(d.activoId)}; until then you keep paying.`)}</span>
                  : (() => {
                    // 23-nov-2026 (Santiago: "un solo botón «Se paga» y da la opción de
                    // cualquier año, así no hay que poner varios botones"). Se guarda el
                    // año calendario; true (escenarios viejos) = hoy.
                    const anioPago = d.pagar ? 1 : d.pagaAnio || null;
                    const sePaga = anioPago != null;
                    return <>
                      <button style={btn(!sePaga)} onClick={() => set("pagarDeudas", { ...sel, [d.id]: false })}>{tx("Sigue", "Keep")}</button>
                      <button style={btn(sePaga)} onClick={() => !sePaga && set("pagarDeudas", { ...sel, [d.id]: anioCal(anioSel) })}>{tx("Se paga", "Pay off")}</button>
                      {sePaga && <select aria-label={tx("Año de pago", "Payoff year")} style={{ ...inp, width: "auto" }} value={anioPago} onChange={(e) => set("pagarDeudas", { ...sel, [d.id]: anioCal(Number(e.target.value)) })}>
                        {ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}
                      </select>}
                    </>;
                  })()}
              {corto && <span style={{ fontSize: 12, color: C.am }}>{tx("alcanza", "covers")} {plata(d.pagado)}</span>}
              {!d.porVenta && !d.ventaAnio && (d.pagar || d.pagaAnio) && <div style={{ flexBasis: "100%", fontSize: 12, color: C.tx2 }}>{d.pagar
                ? tx("Se cancela hoy con lo que vendes; ese capital ya no queda para invertir.", "Paid off today with what you sell; that capital is no longer available to invest.")
                : tx(`Se cancela en ${anioCal(d.pagaAnio)} con el disponible de ese año${d.unica ? "" : "; hasta entonces sigues pagando la cuota"}.`, `Paid off in ${anioCal(d.pagaAnio)} with that year's available funds${d.unica ? "" : "; until then you keep paying"}.`)}</div>}
            </div>
            {/* 23-nov-2026 (Santiago: "la idea es vender la Volvo y esa deuda se paga con la misma venta del activo, no con Cascadas"). De qué activo es la deuda: se dice aquí, solo para el plan. */}
            {(() => { const dd = cfg.deudaDe || {}; const ligar = (id) => set("deudaDe", { ...dd, [d.id]: id });
              const sug = !d.activoId && dd[d.id] == null ? sugerirActivoDeDeuda(d.nombre, inv.filter((a) => a && a.sim !== false).map((a) => ({ id: a.id, nombre: a.n || a.nombre }))) : null;
              return <div style={{ marginTop: 6, fontSize: 12, color: C.tx2 }}>
                {sug && <div style={{ marginBottom: 6, padding: "8px 10px", border: `1px solid ${C.bd}`, borderRadius: 8, color: C.tx }}>{tx(`¿Es la deuda de ${nombreActivo(sug)}? Si la ligas, se paga con la venta de ese activo y no con otra plata.`, `Is this the debt on ${nombreActivo(sug)}? If you link it, it's paid with that asset's sale and not with other money.`)} <button style={{ ...btn(true), padding: "4px 10px", marginLeft: 6 }} onClick={() => ligar(sug)}>{tx(`Sí, es de ${nombreActivo(sug)}`, `Yes, it's ${nombreActivo(sug)}'s`)}</button></div>}
                <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{tx("¿De qué activo es esta deuda?", "Which asset is this debt on?")}
                  <select style={{ ...inp, width: "auto", maxWidth: "100%" }} value={d.activoId || ""} onChange={(e) => ligar(e.target.value)}>
                    <option value="">{tx("De ninguno (crédito libre)", "None (unsecured)")}</option>
                    {inv.filter((a) => a && a.sim !== false).map((a) => <option key={a.id} value={a.id}>{a.n || a.nombre}</option>)}
                  </select></label>
                {d.activoId && !d.porVenta && !d.ventaAnio && <div style={{ marginTop: 4 }}>{tx(`Si en el paso 1 marcas que ${nombreActivo(d.activoId)} se vende, esta deuda se paga con esa venta.`, `If you mark ${nombreActivo(d.activoId)} as sold in step 1, this debt is paid with that sale.`)}</div>}
              </div>; })()}
          </div>
        );
      })}
      {(r.deudasSinSaldo || []).map((d) => <div key={d.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{d.nombre}</b><span style={{ color: C.tx2 }}>{tx(`cuota ${plata(d.cuota)} al mes`, `payment ${plata(d.cuota)}/mo`)}</span></div>
        <div style={{ fontSize: 12, color: C.am, marginTop: 4 }}>{tx("No tiene saldo cargado, así que no se puede pagar con la venta y su cuota sigue. Ponle cuánto debes en tu página de Deudas para poder elegir «Se paga».", "It has no balance entered, so it can't be paid off with the sale and its payment continues. Enter how much you owe on your Debts page to choose \"Pay off\".")}</div>
      </div>)}
      {bolsa === 0 && (r.deudas || []).some((d) => d.pagar && !d.porVenta) && <p style={{ color: C.am, fontSize: 12 }}>{tx("Hoy no vendes ningún activo: para pagar hoy, marca una venta en el paso 1 o elige un año siguiente.", "You're not selling any asset today: to pay off today, mark a sale in step 1 or choose a later year.")}</p>}
      {bd.deudas > 0 && r.cuotasQueSalenMes > 0 && <p style={{ fontSize: 12, color: C.tx2 }}>{tx(<>Pagas {plata(bd.deudas)} y dejas de pagar <b style={{ color: C.gn }}>{plata(r.cuotasQueSalenMes)}</b> de cuotas al mes.</>, <>You pay {plata(bd.deudas)} and stop paying <b style={{ color: C.gn }}>{plata(r.cuotasQueSalenMes)}</b> a month in payments.</>)}</p>}
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
  const cuando = (y) => (y === 1 ? tx("desde ya", "starting now") : `${tx("dentro de", "in")} ${enAnios(y - 1)}`);
  if (h == null) return tx(`Te llegan ${monto} al mes ${cuando(d)}, siempre.`, `You receive ${monto} a month ${cuando(d)}, ongoing.`);
  if (h === d) return tx(`Te llegan ${monto} al mes ${cuando(d)}, solo durante un año.`, `You receive ${monto} a month ${cuando(d)}, for one year only.`);
  return tx(`Te llegan ${monto} al mes ${cuando(d)}, durante ${h - d + 1} años.`, `You receive ${monto} a month ${cuando(d)}, for ${h - d + 1} years.`);
};

// 24-oct-2026: según el tipo de activo, la plataforma pregunta lo suyo.
const partesF10 = () => [[0, tx("Nada: todo se reinvierte", "None: all reinvested")], [25, tx("Una cuarta parte", "A quarter")], [50, tx("La mitad", "Half")], [75, tx("Tres cuartas partes", "Three quarters")], [100, tx("Todo: me llega cada mes", "All of it: paid to me monthly")]];
const etqTipo = () => ({ inmueble: tx("Inmueble: da renta y se valoriza", "Property: earns rent and appreciates"), liquido: tx("Renta fija o cuenta: rinde una tasa al año", "Fixed income or account: earns a yearly rate"), acciones: tx("Fondos, trading o acciones: rinde al año", "Funds, trading or stocks: returns per year"), otro: tx("Otra inversión: rinde al año", "Other investment: returns per year"), vehiculo: tx("Vehículo", "Vehicle") });
// 23-nov-2026 (Santiago: "a medida que uno va invirtiendo la plata que sobró de un
// año debería poder elegir saldo pendiente para la inversión; como está tiene uno
// que tener calculadora al lado para dejar el saldo en cero"). Botón visible junto
// al monto: pone lo que queda del año (más lo que ya tenía esa inversión).
function BotonSaldo({ disponible, actual = 0, anio, on }) {
  if (!(disponible > 0.5) || Math.round(disponible) === Math.round(actual)) return null;
  return <button type="button" onClick={() => on(Math.round(disponible))} style={{ justifySelf: "start", background: "rgba(0,200,5,0.08)", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "4px 10px", color: C.gn, fontSize: 12.5, cursor: "pointer", textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
    {tx(`Usar saldo pendiente de ${anio === 1 ? "hoy" : anioCal(anio)}: ${plata(Math.round(disponible))}`, `Use remaining balance${anio === 1 ? " today" : " for " + anioCal(anio)}: ${plata(Math.round(disponible))}`)}
  </button>;
}

function AporteCampos({ x, up, det, activos, conActivo = false, vendidos = [], sinRenta = false, saldoDisp = 0 }) {
  const lbl = { fontSize: 12, color: C.tx2 };
  const desdeMes = Number(x.rentaDesdeMes) || 0;
  const clase = (activos.find((a) => a.id === x.activoId) || {}).clase || "otro";
  const esInm = clase === "inmueble";
  const pct = (v) => fmtPctEs(v, 1);
  const ETQ_TIPO = etqTipo();
  return (<>
    <div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{ETQ_TIPO[clase] || ETQ_TIPO.otro}</div>
    <div className="fp10-campos" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
      {conActivo && <label style={lbl}>{tx("¿A cuál?", "Which one?")}<select style={inp} value={x.activoId} onChange={(e) => up({ activoId: e.target.value })}>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>}
      <label style={{ ...lbl, display: "grid", gap: 4 }}>{tx("¿Cuánto le vas a invertir? ($)", "How much will you invest? ($)")}<NumberInput style={inp} placeholder={ejemploMonto(600000000, 150000)} value={x.monto} onChange={(v) => up({ monto: v })} />
        <BotonSaldo disponible={saldoDisp} actual={Number(x.monto) || 0} anio={Math.max(1, Number(x.anio) || 1)} on={(v) => up({ monto: v })} /></label>
      <label style={lbl}>{tx("¿Cuándo?", "When?")}<select style={inp} value={Number(x.anio) || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
      {/* 23-nov-2026: en un año siguiente sale del saldo de ese año; no se pregunta de dónde. */}
      {(Number(x.anio) || 1) > 1
        ? <div style={{ ...lbl, display: "grid", gap: 4 }}>{tx("¿De dónde sale?", "Where does it come from?")}<div style={{ fontSize: 13.5, color: C.tx, padding: "8px 0" }}>{tx(`Del saldo de ${anioCal(Number(x.anio))}`, `From the ${anioCal(Number(x.anio))} balance`)}</div></div>
        : <label style={lbl}>{tx("¿De dónde sale?", "Where does it come from?")}<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>}
      {esInm ? <>
{!sinRenta &&         <label style={lbl}>{tx("¿Va a dar renta? ($ al mes, opcional)", "Will it earn rent? ($ a month, optional)")}<NumberInput style={inp} placeholder={ejemploMonto(8500000, 2500)} value={x.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>}
        {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>{tx("¿Desde cuándo renta?", "Rented out from when?")}<select style={inp} value={desdeMes} onChange={(e) => up({ rentaDesdeMes: Number(e.target.value) })}>{opcionesMes(desdeMes).map((mm) => <option key={mm} value={mm}>{textoMes(mm)}</option>)}</select></label>}
        <label style={lbl}>{tx("¿Cuánto queda valiendo al terminar? ($, opcional)", "What is it worth when finished? ($, optional)")}<NumberInput style={inp} placeholder={ejemploMonto(1500000000, 400000)} value={x.valorAlTerminar ?? ""} onChange={(v) => up({ valorAlTerminar: v })} /><span style={{ fontSize: 12 }}>{tx("Si con la obra vale más que lo que tenías más lo que inviertes.", "If after the work it's worth more than what you had plus what you invest.")}</span></label>
        <label style={lbl}>{tx("¿Cuánto se valoriza al año? (%)", "Annual appreciation (%)")}<InputDecimalEs style={inp} placeholder={det && det.valorizacionPct != null ? pct(det.valorizacionPct) : ""} value={x.valorizacionNomPct ?? ""} onChange={(v) => up({ valorizacionNomPct: v })} /><span style={{ fontSize: 12 }}>{tx(`Lo que sube el valor cada año${(Number(x.valorAlTerminar) || 0) > 0 ? ", desde que termina la obra" : ""}. Si no sabes, déjalo vacío.`, `How much the value rises each year${(Number(x.valorAlTerminar) || 0) > 0 ? ", once the work is done" : ""}. If you're not sure, leave it blank.`)}</span></label>
      </> : <>
        <label style={lbl}>{tx("¿Cuánto rinde al año? (%)", "Annual return (%)")}<InputDecimalEs style={inp} placeholder={det && det.rendimientoPct != null ? pct(det.rendimientoPct) : ""} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} /><span style={{ fontSize: 12 }}>{tx("Lo que estimas que gana en un año, sobre todo lo que tiene.", "What you expect it to earn in a year, on its total value.")}</span></label>
        <label style={lbl}>{tx("De lo que rinde, ¿cuánto te llega?", "Of what it earns, how much do you receive?")}<select style={inp} value={Number(x.pctRecibe) || 0} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{partesF10().map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><span style={{ fontSize: 12 }}>{tx("Lo que no te llega se reinvierte y crece con interés compuesto.", "What you don't receive is reinvested and compounds.")}</span></label>
      </>}
    </div>
    {det && (det.aporte > 0 || det.rentaMensual > 0 || det.rindeAnual > 0) && <div style={{ marginTop: 8, background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
      <div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Queda valiendo", "Ends up worth")}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.total)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("hoy", "today")} {plata(det.valorHoy)} + {plata(det.aporte)}{det.anio > 1 ? ` ${tx("en", "in")} ${enAnios(det.anio - 1)}` : ""}</div></div>
      {esInm && det.rentaMensual > 0 && <div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Renta al mes", "Monthly rent")}</div><div style={{ fontSize: 16, fontWeight: 700, color: C.gn }}>{plata(det.rentaMensual)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{textoMes(det.rentaDesdeMes).toLowerCase()} · {pct(det.rentaPctAnual)} {tx("al año sobre el total", "a year on the total")}</div></div>}
      {esInm && det.valorizacionPct != null && <div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Se valoriza", "Appreciates")}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{pct(det.valorizacionPct)} {tx("al año", "a year")}</div><div style={{ fontSize: 12, color: C.tx2 }}>≈ {plata(det.total * det.valorizacionPct / 100)} {tx("el primer año", "the first year")}</div></div>}
      {!esInm && <div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Rinde al año", "Earns a year")}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.rindeAnual)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{pct(det.rendimientoPct)} {tx("sobre", "on")} {plata(det.total)}</div></div>}
      {!esInm && <div><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Te llega al mes", "You receive monthly")}</div><div style={{ fontSize: 16, fontWeight: 700, color: det.teLlegaMes > 0 ? C.gn : C.tx }}>{plata(det.teLlegaMes)}</div><div style={{ fontSize: 12, color: C.tx2 }}>{det.pctRecibe >= 100 ? tx("no se reinvierte nada", "nothing is reinvested") : tx(`se reinvierten ${plata(det.rindeAnual * (1 - det.pctRecibe / 100))} al año`, `${plata(det.rindeAnual * (1 - det.pctRecibe / 100))} a year is reinvested`)}</div></div>}
      {(() => {
        const partes = [];
        if (det.deNuevo > 0) partes.push(`${tx("capital nuevo", "new capital")}: ${plata(det.deNuevo)}`);
        if (det.deVenta > 0) partes.push(`${tx("la venta de", "the sale of")} ${vendidos.map((v) => v.nombre).join(tx(" y ", " and ")) || tx("lo que vendes", "what you sell")}: ${plata(det.deVenta)}`);
        if (det.deLiquidez > 0) partes.push(`${tx("tu liquidez de hoy", "your current cash")}: ${plata(det.deLiquidez)}`);
        if (det.deAnio1 > 0) partes.push(`${tx("lo que entre en", "what comes in during")} ${anioCal(1)}: ${plata(det.deAnio1)}`);
        if (det.anio > 1 && det.aporte > 0) partes.push(det.fuente === "nuevo" ? `${tx("plata nueva en", "new money in")} ${anioCal(det.anio)}: ${plata(det.aporte)}` : (det.fuente || "venta") === "venta" ? tx(`lo que vendes hoy (queda apartado hasta ${anioCal(det.anio)}): ${plata(det.aporte)}`, `what you sell today (set aside until ${anioCal(det.anio)}): ${plata(det.aporte)}`) : tx(`la plata que tengas en ${anioCal(det.anio)} (lo que te llegue ese año y tus cuentas): ${plata(det.aporte)}`, `the money you have in ${anioCal(det.anio)} (what arrives that year plus your accounts): ${plata(det.aporte)}`));
        if (!partes.length) return null;
        return <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2, borderTop: `1px solid ${C.bd}`, paddingTop: 6 }}><b style={{ color: C.tx }}>{tx("Se paga con", "Paid with")}</b> {partes.join(" · ")}</div>;
      })()}
    </div>}
  </>);
}

// Origen de la plata de cada inversión (motor: fuente venta | nuevo | liquidez).
// 23-nov-2026: en un año siguiente, «de mis cuentas de hoy» se leía raro; ese año
// la inversión se paga con lo disponible ese año (lo mismo que hace el motor).
function FuenteSel({ value, on, anio = 1 }) {
  const despues = anio > 1;
  return <select style={inp} value={value || "venta"} onChange={(e) => on(e.target.value)}>
    <option value="venta">{despues ? tx("De lo que vendo (se aparta desde hoy)", "From what I sell (set aside from today)") : tx("De lo que vendo (la plata de las ventas)", "From what I sell (sale proceeds)")}</option>
    <option value="liquidez">{despues ? tx(`De lo disponible en ${anioCal(anio)}`, `From what's available in ${anioCal(anio)}`) : tx("De mis cuentas de hoy (ahorros y efectivo que ya tengo)", "From my current accounts (savings and cash I already have)")}</option>
    <option value="nuevo">{tx("Plata nueva que entra de afuera (prima, crédito, herencia)", "New money from outside (bonus, loan, inheritance)")}</option>
  </select>;
}

// El saldo de Tu plata: de dónde viene y en qué se va, siempre a la vista.
// 25-oct-2026 (Santiago: "se dificulta saber qué saldo le va quedando a uno de
// las ventas… no sé si me pasé… uno no sabe si sobra o no"). La cuenta se
// muestra como entra / sale / sobra, con un veredicto grande arriba.
// 22-nov-2026 (Santiago: "voy a invertir 600 M en una bodega pero no se altera
// el valor de lo que queda, o no se ve qué queda"). Lo programado para un año
// siguiente con plata propia (no «plata nueva») sale de la misma plata que hoy
// sobra —el motor la saca de la liquidez donde quedó ese sobrante—, así que se
// resta a la vista: sobra hoy − ya tiene destino = queda libre.
// 23-nov-2026 (Santiago: "súper perdido con esto… no sabe uno de dónde provienen esos 165 M, y más
// perdido cuando el disponible de hoy se va para LOTE+CASA y BTG"). La cuenta baja año por año y
// cada cosa resta solo en SU año: hoy = lo de hoy; cada año siguiente = lo que viene de antes + lo
// que llega ese año − lo que inviertes ese año. Lo que sobra pasa al año siguiente; si un año no
// alcanza, ese año lo dice. («Plata nueva de afuera» no resta: no sale de esta plata.)
// 23-nov-2026 (Santiago: "el sistema debería llevarlo a uno muy bien en cómo
// invertir la plata que sobra de cada año, e ir llevando el saldo de ese año de
// forma visible"). La cuenta de cada año, del 2.º al último: lo que viene del año
// anterior + lo que te sobró del flujo el año anterior (la parte que no tiene
// destino fijo en D) + lo que te llega ese año (ventas, vencimientos) − lo que
// usas ese año (inversiones, deudas que pagas, compras de «Lo que viene»).
// Es la misma plata que el motor saca ese año (colchón, liquidez y lo invertido
// de lo que sobra); el crecimiento de esas inversiones no se suma (conservador).
// cuentaPorAnio vive en lib/futuro10.js (la usan el paso 3 y el Resultado).
export { cuentaPorAnio };
// 23-nov-2026 (Santiago: "cuando quiero invertir en IBKR no me lo muestra, y me sigue
// mostrando Puerto Madero cuando hace rato se vendió"). Activos a los que se les puede
// meter capital en un año: los que siguen ese año (no vendidos ni vencidos antes o ese
// mismo año), sin vehículos, y que no tengan ya un aporte en ese año. Un activo puede
// tener aportes en varios años.
// 23-nov-2026 (Santiago: "uno no necesariamente invierte en activos que tenía; puede ampliar su
// inversión en los fondos de renta, CDTs…"). También las inversiones que creaste en el plan en
// un año anterior (no la propiedad raíz), mientras sigan (no retiradas del todo).
export function activosParaAportar(r, cfg = {}, anio = 1) {
  const fuera = new Set((r.liberados || []).filter((l) => l && !String(l.id).endsWith("_retiro") && l.anio <= anio).map((l) => l.id));
  const retiradas = new Set((r.liberados || []).filter((l) => l && String(l.id).endsWith("_retiro") && !l.parcial && l.anio <= anio).map((l) => String(l.id).replace(/_retiro$/, "")));
  const yaEsteAnio = new Set((cfg.reinversiones || []).filter((x) => x && Math.max(1, Number(x.anio) || 1) === anio).map((x) => x.activoId));
  const propios = (r.activos || []).filter((a) => a && a.clase !== "vehiculo" && !fuera.has(a.id) && !yaEsteAnio.has(a.id));
  const delPlan = (r.nuevasDetalle || []).filter((x) => x && String(x.id || "").startsWith("nueva_") && !x.pr && (x.anio || 1) < anio && !yaEsteAnio.has(x.id) && !retiradas.has(x.id))
    .map((x) => ({ id: x.id, nombre: x.nombre, clase: "nueva", delPlan: true, anio: x.anio || 1 }));
  return [...propios, ...delPlan];
}
// Las opciones del selector, en dos grupos: lo que ya tenías y lo que creaste en el plan.
function OpcionesAportar({ libres }) {
  const propios = libres.filter((a) => !a.delPlan), delPlan = libres.filter((a) => a.delPlan);
  if (!delPlan.length) return propios.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>);
  return <>
    {propios.length > 0 && <optgroup label={tx("Lo que ya tenías", "What you already had")}>{propios.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</optgroup>}
    <optgroup label={tx("Lo que creaste en el plan", "What you created in the plan")}>{delPlan.map((a) => <option key={a.id} value={a.id}>{`${a.nombre} (${tx("desde", "since")} ${anioCal(a.anio)})`}</option>)}</optgroup>
  </>;
}
// Lo creado en el plan, como «activo» de la sección C (para nombrarlo y armar su formulario).
const delPlanDe = (r, id) => { const x = (r.nuevasDetalle || []).find((y) => y.id === id && !y.pr); return x ? { id: x.id, nombre: x.nombre, clase: "nueva", delPlan: true, anio: x.anio || 1 } : null; };

// 24-nov-2026 — Tu plata año por año, en cascada (Santiago: "lo que tengo, lo que me vale vivir,
// lo que puedo hacer con la plata que tengo y, después de mis movidas, ver cómo me queda el año
// mensual y anual, y si sobra qué hacer"). Arriba los años; del año elegido: 1. lo que tienes,
// 2. lo que te cuesta vivir (la foto antes de tus movidas de ese año), 3. lo que puedes hacer con
// tu plata (un número que no se mueve al invertir) y tus movidas. El 4 (así te queda) va después
// de las secciones donde se hacen las movidas (A, B y C). La cuenta sale de cuentaPorAnio.
const nombreAnio = (t) => (t === 1 ? tx(`hoy (${anioCal(1)})`, `today (${anioCal(1)})`) : anioCal(t));
function Bloque({ n, titulo, sub, cifra, cifraSub, col, fuerte, children, id }) {
  return <section id={id} style={{ background: C.bg, border: `1px solid ${fuerte ? C.gn : C.bd}`, borderRadius: 12, padding: "14px 16px", marginTop: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0, flex: "1 1 260px" }}>
        <span aria-hidden="true" style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: 999, border: `1px solid ${fuerte ? C.gn : C.bd}`, color: fuerte ? C.gn : C.tx2, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, marginTop: 1 }}>{n}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{titulo}</div>
          {sub && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}
        </div>
      </div>
      {cifra != null && <div style={{ textAlign: "right", marginLeft: "auto" }}>
        <div style={{ fontSize: fuerte ? 32 : 20, fontWeight: fuerte ? 700 : 600, color: col || C.tx, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, whiteSpace: "nowrap" }}>{cifra}</div>
        {cifraSub && <div style={{ fontSize: 12, color: C.tx2, marginTop: 3 }}>{cifraSub}</div>}
      </div>}
    </div>
    {children && <div style={{ marginTop: 12 }}>{children}</div>}
  </section>;
}
// Un renglón de la cuenta: texto a la izquierda, cifra a la derecha (tabular).
function Renglon({ l, v, signo = "", col, fuerte, nota, linea }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 0", fontSize: fuerte ? 14 : 13, fontWeight: fuerte ? 600 : 400, borderTop: linea ? `1px solid ${C.bd}` : "none", marginTop: linea ? 4 : 0 }}>
    <span style={{ color: fuerte ? C.tx : C.tx2, minWidth: 0, lineHeight: 1.4 }}>{l}{nota && <span style={{ display: "block", fontSize: 12, color: C.tx2, fontWeight: 400 }}>{nota}</span>}</span>
    <span style={{ color: col || C.tx, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signo}{plata(Math.round(Math.abs(v)))}</span>
  </div>;
}
const Etq = ({ children }) => <div style={{ fontSize: 12, fontWeight: 600, color: C.tx2, margin: "12px 0 2px" }}>{children}</div>;
// Al mes y al año, lado a lado (Santiago: "ver cómo me queda el año mensual y anual").
function MesAnio({ filas }) {
  const celda = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", columnGap: 14, rowGap: 6, fontSize: 13, alignItems: "baseline" }}>
    <span /><span style={{ ...celda, fontSize: 12, color: C.tx2 }}>{tx("al mes", "a month")}</span><span style={{ ...celda, fontSize: 12, color: C.tx2 }}>{tx("al año", "a year")}</span>
    {filas.map(([l, anual, op = {}], k) => <Fragment key={k}>
      {op.linea && <span aria-hidden="true" style={{ gridColumn: "1 / -1", borderTop: `1px solid ${C.bd}`, height: 0 }} />}
      <span style={{ color: op.fuerte ? C.tx : C.tx2, fontWeight: op.fuerte ? 600 : 400, minWidth: 0 }}>{l}</span>
      <span style={{ ...celda, color: op.col || C.tx, fontWeight: op.fuerte ? 600 : 400 }}>{op.signo || ""}{plata(Math.round(Math.abs(anual) / 12))}</span>
      <span style={{ ...celda, color: op.col || C.tx, fontWeight: op.fuerte ? 600 : 400 }}>{op.signo || ""}{plata(Math.round(Math.abs(anual)))}</span>
      {op.nota && <span style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2, marginTop: -4 }}>{op.nota}</span>}
    </Fragment>)}
  </div>;
}
// Lo que cambia en tu mes ese año: lo que empieza, lo que se acaba y lo del paso 1.
function cambiosDelAnio(r, cfg, anio, foto) {
  const out = [];
  const N = Math.max(1, (r.filas || []).length - 1);
  const prev = (r.filas || [])[anio - 1] || {};
  (foto.gastosFut || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: -x.anual / 12, que: tx("empieza", "starts"), ajustar: x.idx != null && x.deCompra == null ? { tipo: "gastos", idx: x.idx } : null }));
  (foto.ingresosFut || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: x.anual / 12, que: tx("empieza", "starts"), ajustar: x.idx != null ? { tipo: "ingresos", idx: x.idx } : null }));
  if (anio > 1) {
    (prev.gastosFut || []).filter((x) => x.hasta === anio - 1).forEach((x) => out.push({ nombre: x.nombre, mes: x.anual / 12, que: tx("termina", "ends") }));
    (r.liberados || []).filter((l) => l.anio === anio && !String(l.id).endsWith("_retiro")).forEach((l) => { const p = (prev.porActivo || []).find((a) => a.id === l.id); if (p && p.renta > 0.5) out.push({ nombre: tx(`Renta de ${l.nombre}`, `${l.nombre} income`), mes: -p.renta / 12, que: tx("se acaba", "stops") }); });
    (r.deudas || []).filter((d) => d.finPorCuota && d.finNatural === anio && d.cuotaMes > 0.5).forEach((d) => out.push({ nombre: tx(`Cuota de ${d.nombre}`, `${d.nombre} payment`), mes: d.cuotaMes, que: tx("terminas de pagarla", "paid off") }));
  }
  (r.ingSeVan || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: -x.mensual, que: tx("se acaba", "stops"), paso1: true }));
  (r.seVan || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: x.mensual, que: tx("ya no lo pagas", "no longer paid"), paso1: true }));
  Object.entries(leerCambios(cfg, N)).filter(([, c]) => c.desde === anio).forEach(([id, c]) => {
    const a = (r.activos || []).find((x) => x.id === id); if (!a) return;
    const rentaDe = (fila) => ((fila && fila.porActivo) || []).find((x) => x.id === id)?.renta || 0;
    const d = anio > 1 ? (rentaDe((r.filas || [])[anio]) - rentaDe(prev)) / 12 : null;
    out.push({ nombre: a.nombre, mes: d != null && Math.abs(d) > 0.5 ? d : null, que: c.modo === "propio" ? tx("pasa a uso propio", "becomes personal use") : tx("renta nueva", "new rent"), paso1: true });
  });
  return out;
}

// 24-nov-2026 (Santiago: "en 5 años quiero comprar una casa, presupuesto 3.500 MM; ahí queda
// declarado, pero en 2031 ya sí me desglosa esa inversión: lote + casa, valor del lote, valor del
// metro cuadrado, estimado de valorización"; "en el año que corresponda ya ampliará con más detalle
// o incluso ajustará las cifras"). La compra se declara en el paso 2 con su presupuesto y en su año
// se detalla cómo se compra. El detalle ajusta el MISMO hito (cfg.futuros.activos[idx]): su costo,
// sus pagos por año, cuánto vale al terminar, la valorización y lo que cuesta tenerla.
const MODOS_COMPRA = () => [["lote", tx("Lote + construcción", "Lot + build")], ["planos", tx("Sobre planos", "Off-plan")], ["lista", tx("Ya hecha", "Ready-built")]];
export function calcularCompra(d = {}, anio0 = 1, N = 10) {
  const v = (k) => Math.max(0, Number(d[k]) || 0);
  const m = d.modo || "lote";
  const pagos = [];
  let total = 0, entrega = anio0, partes = [], valorFinal = 0;
  if (m === "lote") {
    const obra = v("m2") * v("costoM2"), nA = Math.min(5, Math.max(1, Math.round(v("obraAnios")) || 1));
    total = v("lote") + obra;
    for (let k = 0; k < nA; k++) pagos.push({ anio: Math.min(N, anio0 + k), monto: (k === 0 ? v("lote") : 0) + obra / nA });
    entrega = Math.min(N, anio0 + nA - 1);
    partes = [[tx("Lote", "Lot"), v("lote")], [tx(`Construcción: ${miles(v("m2"))} m² × ${plata(v("costoM2"))}`, `Build: ${miles(v("m2"))} m² × ${plata(v("costoM2"))}`), obra]];
    valorFinal = v("m2") > 0 && v("ventaM2") > 0 ? v("m2") * v("ventaM2") : 0;
  } else if (m === "planos") {
    total = v("precio");
    const cuota = total * Math.min(100, v("cuotaPct")) / 100, nA = Math.min(5, Math.round(v("entregaAnios")));
    if (nA < 1) pagos.push({ anio: anio0, monto: total });
    else { for (let k = 0; k < nA; k++) pagos.push({ anio: Math.min(N, anio0 + k), monto: cuota / nA }); pagos.push({ anio: Math.min(N, anio0 + nA), monto: total - cuota }); }
    entrega = Math.min(N, anio0 + Math.max(0, nA));
    partes = [[tx(`Cuota inicial (${fmtPctEs(v("cuotaPct"), 0)})`, `Down payment (${fmtPctEs(v("cuotaPct"), 0)})`), cuota], [tx("Al recibirla", "On delivery"), total - cuota]];
    valorFinal = v("valorFinal");
  } else {
    total = v("precio"); pagos.push({ anio: anio0, monto: total }); entrega = anio0;
    partes = [[tx("Precio", "Price"), total]];
    valorFinal = v("valorFinal");
  }
  const porAnio = {};
  pagos.forEach((p) => { porAnio[p.anio] = (porAnio[p.anio] || 0) + p.monto; });
  return { total, entrega, partes, valorFinal, pagos: Object.entries(porAnio).map(([a, monto]) => ({ anio: Number(a), monto: Math.round(monto) })).filter((p) => p.monto > 0.5) };
}
function DesgloseCompra({ r, cfg, set, idx, anio0 }) {
  const f = { ingresos: [], activos: [], gastos: [], ...(cfg.futuros || {}) };
  const x = f.activos[idx];
  if (!x) return null;
  const N = Math.max(1, (r.filas || []).length - 1);
  const d = { modo: "lote", obraAnios: 2, cuotaPct: 30, entregaAnios: 2, ...(x.desglose || {}), anio0: (x.desglose && x.desglose.anio0) || anio0 };
  const up = (v) => set("futuros", { ...f, activos: f.activos.map((y, j) => (j === idx ? { ...y, ...v } : y)) });
  const aplicar = (cambio) => {
    const d2 = { ...d, ...cambio }, c = calcularCompra(d2, d2.anio0, N);
    up({ desglose: d2, presupuesto: x.presupuesto ?? (Number(x.valor) || 0), valor: c.total, pagos: c.pagos, entrega: c.entrega, valorAlTerminar: c.valorFinal > c.total ? c.valorFinal : "", cuotaInicial: "" });
  };
  const quitar = () => up({ desglose: undefined, pagos: undefined, valor: x.presupuesto ?? x.valor, presupuesto: undefined, valorAlTerminar: "", entrega: d.anio0 });
  const c = calcularCompra(d, d.anio0, N);
  const fa = ((r.futuros || {}).activos || []).find((y) => y.idx === idx);
  const crec = fa ? fa.crec : 0;
  const base = c.valorFinal > c.total ? c.valorFinal : c.total;
  const alFinal = base * Math.pow(1 + (crec || 0), Math.max(0, N - c.entrega));
  const pres = x.presupuesto ?? (x.desglose ? null : Number(x.valor) || 0);
  const dif = pres != null && x.desglose ? c.total - pres : null;
  const lbl = { fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0, alignContent: "start" };
  const fila4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10, alignItems: "start" };
  const num = (k, l, ayuda) => <label style={lbl}>{l}<NumberInput style={inp} value={d[k] ?? ""} onChange={(v) => aplicar({ [k]: v })} />{ayuda && <span style={{ fontSize: 12, lineHeight: 1.35 }}>{ayuda}</span>}</label>;
  const anios = (k, l, desde, hasta, etq) => <label style={lbl}>{l}<select style={inp} value={Number(d[k]) || desde} onChange={(e) => aplicar({ [k]: Number(e.target.value) })}>{Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map((y) => <option key={y} value={y}>{etq(y)}</option>)}</select></label>;
  return <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 10, padding: 12, margin: "6px 0 10px", display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12.5, color: C.tx2, marginRight: 4 }}>{tx("¿Cómo la compras?", "How do you buy it?")}</span>
      {MODOS_COMPRA().map(([k, l]) => <button key={k} type="button" style={{ ...btn(d.modo === k), padding: "6px 12px" }} onClick={() => aplicar({ modo: k })}>{l}</button>)}
    </div>
    <div style={fila4}>
    {d.modo === "lote" && <>
      {num("lote", tx("Valor del lote ($)", "Lot value ($)"))}
      {num("m2", tx("Metros a construir (m²)", "Square meters to build (m²)"))}
      {num("costoM2", tx("Costo de construir el m² ($)", "Build cost per m² ($)"))}
      {anios("obraAnios", tx("¿Cuánto dura la obra?", "How long is the build?"), 1, 4, (y) => enAnios(y))}
      {num("ventaM2", tx("Valor del m² construido al terminar ($, opcional)", "Value per built m² when done ($, optional)"), tx("Lo que vale el m² en esa zona. Si no sabes, déjalo vacío.", "What a m² is worth in that area. Leave blank if unsure."))}
    </>}
    {d.modo === "planos" && <>
      {num("precio", tx("Precio ($)", "Price ($)"))}
      <label style={lbl}>{tx("Cuota inicial (%)", "Down payment (%)")}<InputDecimalEs style={inp} value={d.cuotaPct ?? ""} onChange={(v) => aplicar({ cuotaPct: v })} /></label>
      {anios("entregaAnios", tx("¿En cuánto te la entregan?", "Delivered in?"), 1, 5, (y) => enAnios(y))}
      {num("valorFinal", tx("¿Cuánto vale al recibirla? ($, opcional)", "Worth on delivery? ($, optional)"))}
    </>}
    {d.modo === "lista" && <>
      {num("precio", tx("Precio ($)", "Price ($)"))}
      {num("valorFinal", tx("¿Cuánto vale de verdad? ($, opcional)", "What is it really worth? ($, optional)"), tx("Si la compras por debajo de lo que vale.", "If you buy it below its value."))}
    </>}
      <label style={lbl}>{tx("¿Cuánto se valoriza al año? (%)", "Annual appreciation (%)")}<InputDecimalEs style={inp} placeholder={fmtPctEs((crec || 0) * 100, 1)} value={x.valorizacionNomPct ?? ""} onChange={(v) => up({ valorizacionNomPct: v })} /><span style={{ fontSize: 12 }}>{tx("Desde que la recibes. Vacío: el supuesto del escenario.", "From when you get it. Blank: the scenario's assumption.")}</span></label>
      <label style={lbl}>{tx("Lo que cuesta tenerla al mes ($, opcional)", "Monthly cost of owning it ($, optional)")}<NumberInput style={inp} value={x.gastoMensual ?? ""} onChange={(v) => up({ gastoMensual: v })} /><span style={{ fontSize: 12 }}>{tx("Predial, administración, mantenimiento. Entra en lo que te cuesta vivir desde que la recibes.", "Property tax, fees, upkeep. Added to your living costs once you get it.")}</span></label>
    </div>
    {c.total > 0.5 && <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 10, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{tx("Cuesta", "It costs")}</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(c.total))}</span>
      </div>
      {c.partes.filter(([, v]) => v > 0.5).map(([l, v], k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.tx2 }}><span>{l}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(v))}</span></div>)}
      {dif != null && Math.abs(dif) <= 0.5 && <div style={{ fontSize: 12.5, color: C.gn }}>{tx(`Cuadra con tu presupuesto (${plata(Math.round(pres))}).`, `Matches your budget (${plata(Math.round(pres))}).`)}</div>}
      {dif != null && Math.abs(dif) > 0.5 && <div style={{ fontSize: 12.5, color: dif > 0 ? C.am : C.gn }}>{tx(`Tu presupuesto era ${plata(Math.round(pres))}: ${dif > 0 ? "te pasas" : "te sobran"} ${plata(Math.round(Math.abs(dif)))}.`, `Your budget was ${plata(Math.round(pres))}: ${dif > 0 ? "over by" : "under by"} ${plata(Math.round(Math.abs(dif)))}.`)}</div>}
      <div style={{ fontSize: 12.5, color: C.tx }}><b style={{ fontWeight: 600 }}>{tx("Lo pagas así: ", "You pay it like this: ")}</b>{c.pagos.map((p) => `${anioCal(p.anio)}: ${plata(p.monto)}`).join(" · ")}</div>
      <div style={{ fontSize: 12.5, color: C.tx }}>{c.valorFinal > c.total ? tx(`Al terminar vale ${plata(Math.round(c.valorFinal))} (${plata(Math.round(c.valorFinal - c.total))} más de lo que cuesta).`, `When done it's worth ${plata(Math.round(c.valorFinal))} (${plata(Math.round(c.valorFinal - c.total))} more than it costs).`) : tx(`La recibes en ${anioCal(c.entrega)}.`, `You get it in ${anioCal(c.entrega)}.`)}{" "}{c.entrega < N ? tx(`En ${anioCal(N)} valdría unos ${plata(Math.round(alFinal))}.`, `By ${anioCal(N)} it would be worth about ${plata(Math.round(alFinal))}.`) : ""}</div>
    </div>}
    {x.desglose && <div><button type="button" onClick={quitar} style={{ background: "transparent", border: "none", padding: 0, color: C.tx2, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{tx(`Quitar el detalle y volver al presupuesto${x.presupuesto != null ? ` (${plata(Math.round(x.presupuesto))})` : ""}`, `Remove the detail and go back to the budget${x.presupuesto != null ? ` (${plata(Math.round(x.presupuesto))})` : ""}`)}</button></div>}
  </div>;
}
// Ajustar desde su año un hito que se repite (universidad, pensión, aportes): el mismo de Lo que viene.
function AjustarHito({ cfg, set, tipo, idx }) {
  const f = { ingresos: [], activos: [], gastos: [], ...(cfg.futuros || {}) };
  const lista = f[tipo] || [], x = lista[idx];
  if (!x) return null;
  const up = (v) => set("futuros", { ...f, [tipo]: lista.map((y, j) => (j === idx ? { ...y, ...v } : y)) });
  const lbl = { fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0 };
  const d = Math.max(1, Number(x.desde) || 1);
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10, background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 10, padding: 12, margin: "4px 0 8px" }}>
    {tipo === "gastos" ? <>
      <label style={lbl}>{tx(`${x.periodo === "mes" ? "Al mes" : "Al año"} ($, pesos de hoy)`, `${x.periodo === "mes" ? "Per month" : "Per year"} ($, today's pesos)`)}<NumberInput style={inp} value={x.periodo === "mes" ? (vacio(x.anual) ? "" : Math.round((Number(x.anual) || 0) / 12)) : (x.anual ?? "")} onChange={(v) => up({ anual: x.periodo === "mes" ? (vacio(v) ? "" : (Number(v) || 0) * 12) : v })} /></label>
      <label style={lbl}>{tx("¿Cuántos años?", "For how many years?")}<select style={inp} value={vacio(x.anios) ? "" : x.anios} onChange={(e) => up({ anios: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Siempre", "Ongoing")}</option>{ANIOS.map((y) => <option key={y} value={y}>{enAnios(y)}</option>)}</select></label>
    </> : <>
      <label style={lbl}>{tx("Al mes ($, pesos de hoy)", "Per month ($, today's pesos)")}<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => up({ mensual: v })} /></label>
      <label style={lbl}>{tx("¿Hasta cuándo?", "Until when?")}<select style={inp} value={vacio(x.hasta) ? "" : x.hasta} onChange={(e) => up({ hasta: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Sigue siempre", "Ongoing")}</option>{ANIOS.filter((y) => y >= d).map((y) => <option key={y} value={y}>{tx(`Hasta ${anioCal(y)}`, `Until ${anioCal(y)}`)}</option>)}</select></label>
    </>}
    <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2 }}>{tx("Es el mismo hito de Lo que viene (paso 2): lo que cambies aquí se ve allá.", "It's the same milestone from What's coming (step 2): changes here show there.")}</div>
  </div>;
}

function AnioPorAnio({ r, cfg, set, cuenta, anioSel, setAnioSel, nuevaEnAnio, reinvEnAnio }) {
  const [abierto, setAbierto] = useState(null);
  const N = cuenta.length;
  const g = cuenta.find((y) => y.anio === anioSel) || cuenta[0];
  if (!g) return null;
  const Y = nombreAnio(g.anio), anio = g.anio;
  const ir = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50); };
  const scroll = (id) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const fo = g.foto || {};
  const cambios = cambiosDelAnio(r, cfg, anio, fo);
  const bd = r.bolsaDetalle || {};
  const sinCubrir = Math.max(0, (bd.excesoVentas || 0) - (bd.excesoCubierto || 0));
  const libre = r.sobraLibre ?? 1;
  const nomMov = (m) => (m.tipo === "B" && !/^(Obras|Build-outs)/.test(m.nombre) ? tx(`Le metes a ${m.nombre}`, `Add to ${m.nombre}`) : m.nombre);
  return <div style={{ ...card, padding: 0, overflow: "visible" }} id="f10-anios">
    <div style={{ padding: "14px 16px 8px" }}>
      <h3 style={{ margin: 0 }}>{tx("Tu plata año por año", "Your money year by year")}</h3>
      <p style={{ color: C.tx2, fontSize: 12.5, margin: "4px 0 0", lineHeight: 1.45 }}>{tx("Elige un año. Primero ves lo que tienes, lo que te cuesta vivir y lo que puedes hacer con tu plata; abajo haces tus movidas y ves cómo te queda.", "Pick a year. First see what you have, what living costs and what you can do with your money; below, make your moves and see how the year ends.")}</p>
    </div>
    <div role="tablist" aria-label={tx("Años del plan", "Plan years")} style={{ position: "sticky", top: 52, zIndex: 6, background: C.bg2, display: "flex", gap: 6, overflowX: "auto", padding: "8px 16px", borderBottom: `1px solid ${C.bd}` }}>
      {cuenta.map((y) => { const on = y.anio === anioSel, q = y.porInvertir, malo = q < -0.5 || y.faltaSinCubrir > 0.5; return <button key={y.anio} role="tab" aria-selected={on} type="button" onClick={() => ir(y.anio)} style={{ flex: "0 0 auto", textAlign: "left", padding: "6px 12px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(0,200,5,0.12)" : "transparent", border: `1px solid ${on ? C.gn : C.bd}`, color: C.tx }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>{y.anio === 1 ? tx("Hoy", "Today") : anioCal(y.anio)}{y.flujoFoto < -0.5 && <span title={tx("Este año te falta para vivir", "This year you're short on living costs")} aria-label={tx("Este año te falta para vivir", "This year you're short on living costs")} style={{ width: 7, height: 7, borderRadius: 999, background: C.am, display: "inline-block" }} />}</div>
        <div style={{ fontSize: 11.5, color: malo ? C.rd : q > 0.5 ? C.gn : C.tx2, fontVariantNumeric: "tabular-nums" }}>{y.faltaSinCubrir > 0.5 ? `−${plata(Math.round(y.faltaSinCubrir))}` : `${q < -0.5 ? "−" : ""}${plata(Math.round(Math.abs(q)))}`}</div>
      </button>; })}
    </div>
    <div style={{ padding: "4px 16px 16px" }}>
      {/* 1 · Lo que tienes */}
      <Bloque n={1} titulo={tx(`Lo que tienes ${anio === 1 ? "hoy" : "en " + Y}`, `What you have ${anio === 1 ? "today" : "in " + Y}`)} cifra={plata(Math.round(g.tienes))}>
        {g.antes > 0.5 && <Renglon l={tx(`Saldo que traes de ${nombreAnio(anio - 1)}`, `Balance carried from ${nombreAnio(anio - 1)}`)} v={g.antes} />}
        {g.llegan.map((l, k) => <Renglon key={k} l={(g.antes > 0.5 || k > 0 ? "+ " : "") + (l.tipo === "venta" ? l.nombre : l.tipo === "retiro" ? tx(`Sacas de ${l.nombre}${l.parcial ? " (una parte)" : ""}`, `Taken out of ${l.nombre}${l.parcial ? " (part of it)" : ""}`) : tx(`Te llega de ${l.nombre}`, `Arrives from ${l.nombre}`))} nota={l.pagoDeuda > 0.5 ? tx(`Ya descontada su deuda (${plata(Math.round(l.pagoDeuda))}).`, `Its debt (${plata(Math.round(l.pagoDeuda))}) already deducted.`) : null} v={l.monto} />)}
        {g.tienes <= 0.5 && <div style={{ fontSize: 12.5, color: C.tx2 }}>{tx(anio === 1 ? "Hoy no vendes nada ni te llega plata de una venta." : "Este año no te llega plata de ventas ni vencimientos, y no traes saldo.", anio === 1 ? "You're not selling anything today." : "No money from sales or maturities this year, and no balance carried.")}</div>}
        {g.reservaAntes > 0.5 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>{tx(`Aparte, en tu fondo de reserva: ${plata(Math.round(g.reservaAntes))}.`, `Separately, in your reserve fund: ${plata(Math.round(g.reservaAntes))}.`)}</div>}
      </Bloque>
      {/* 2 · Lo que te cuesta vivir (la foto, antes de tus movidas) */}
      <Bloque n={2} titulo={tx(`Lo que te cuesta vivir ${anio === 1 ? "este año" : "en " + Y}`, `What living costs ${anio === 1 ? "this year" : "in " + Y}`)} sub={tx("Tu mes con lo que ya decidiste, antes de tus movidas de este año.", "Your month with what you've decided, before this year's moves.")}
        cifra={`${(fo.cf || 0) < -0.5 ? "−" : "+"}${plata(Math.round(Math.abs((fo.cf || 0) / 12)))}`} cifraSub={(fo.cf || 0) < -0.5 ? tx("te faltan al mes", "short each month") : tx("te sobran al mes", "left each month")} col={(fo.cf || 0) < -0.5 ? C.am : C.gn}>
        <MesAnio filas={[
          [tx("Te entra", "Comes in"), fo.ingresos || 0],
          [tx("Vivir te cuesta", "Living costs"), fo.gastos || 0, { nota: (fo.cuota || 0) > 0.5 ? tx(`Incluye ${plata(Math.round(fo.cuota / 12))} al mes de cuotas de deudas.`, `Includes ${plata(Math.round(fo.cuota / 12))} a month in loan payments.`) : null }],
          [(fo.cf || 0) < -0.5 ? tx("Te faltan", "Short") : tx("Te sobran", "Left over"), fo.cf || 0, { fuerte: true, linea: true, col: (fo.cf || 0) < -0.5 ? C.am : C.gn, signo: (fo.cf || 0) < -0.5 ? "−" : "" }],
        ]} />
        {cambios.length > 0 && <>
          <Etq>{tx("Lo que cambia este año", "What changes this year")}</Etq>
          {cambios.map((c, k) => { const clave = c.ajustar ? `aj:${c.ajustar.tipo}:${c.ajustar.idx}` : null; return <div key={k}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "4px 0", fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ color: C.tx, minWidth: 0 }}>{c.nombre} <span style={{ fontSize: 12, color: C.tx2 }}>· {c.que}{c.paso1 ? tx(" · del paso 1", " · from step 1") : ""}</span>
                {clave && <button type="button" onClick={() => setAbierto(abierto === clave ? null : clave)} style={{ background: "transparent", border: "none", padding: "0 0 0 8px", color: C.gn, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{abierto === clave ? tx("Listo", "Done") : tx("Ajustar", "Adjust")}</button>}</span>
              {c.mes != null && <span style={{ color: c.mes > 0 ? C.gn : C.am, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{c.mes > 0 ? "+" : "−"}{plata(Math.round(Math.abs(c.mes)))} {tx("al mes", "a month")}</span>}
            </div>
            {clave && abierto === clave && <AjustarHito cfg={cfg} set={set} tipo={c.ajustar.tipo} idx={c.ajustar.idx} />}
          </div>; })}
        </>}
        {libre < 0.995 && (fo.cf || 0) > 0.5 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 8 }}>{tx(`De lo que te sobra, el ${Math.round((1 - libre) * 100)} % se reinvierte solo (lo eliges en D); aquí cuenta el resto.`, `Of your surplus, ${Math.round((1 - libre) * 100)}% is reinvested automatically (set in D); the rest counts here.`)}</div>}
      </Bloque>
      {/* 3 · Lo que puedes hacer con tu plata, y tus movidas */}
      <Bloque n={3} fuerte titulo={tx(`Lo que puedes hacer con tu plata ${anio === 1 ? "hoy" : "en " + Y}`, `What you can do with your money ${anio === 1 ? "today" : "in " + Y}`)} sub={tx("Lo que tienes, después de asegurar lo de vivir y lo ya comprometido. No cambia cuando inviertes.", "What you have after covering living costs and commitments. It doesn't change as you invest.")} cifra={plata(Math.round(g.disponible))} col={g.disponible > 0.5 ? C.gn : C.tx}>
        <Renglon l={tx("Lo que tienes", "What you have")} v={g.tienes} />
        {g.flujoFoto > 0.5 && <Renglon l={tx("+ Lo que te sobra para vivir", "+ Left over after living costs")} v={g.flujoFoto} />}
        {g.flujoFoto < -0.5 && <Renglon l={tx("− Lo que falta para vivir", "− Short on living costs")} v={-g.flujoFoto} col={C.am} nota={tx("Se aparta primero, antes de invertir.", "Set aside first, before investing.")} />}
        {g.compromisos.map((c, k) => { const clave = c.tipo === "F" && c.idx != null && c.k === 0 ? `dc:${c.idx}` : null; const xa = clave ? ((cfg.futuros || {}).activos || [])[c.idx] : null; return <div key={k}>
          <Renglon l={`− ${c.nombre}`} v={c.monto} col={C.tx2} nota={c.nota || (c.tipo === "F" && c.k > 0 ? tx("Otra parte de esa compra.", "Another part of that purchase.") : null)} />
          {clave && <button type="button" onClick={() => setAbierto(abierto === clave ? null : clave)} style={{ background: "transparent", border: "none", padding: "0 0 6px", color: C.gn, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{abierto === clave ? tx("Cerrar el detalle", "Close the detail") : xa && xa.desglose ? tx("Ver el detalle de la compra", "See the purchase detail") : tx("Detallar cómo la compras", "Detail how you buy it")}</button>}
          {clave && abierto === clave && <DesgloseCompra r={r} cfg={cfg} set={set} idx={c.idx} anio0={anio} />}
        </div>; })}
        {((cfg.futuros || {}).activos || []).map((x, i) => [x, i]).filter(([x, i]) => x && !(Number(x.valor) > 0) && !(r.pagosFuturos || []).some((p) => p.idx === i) && Math.max(1, Number((x.desglose || {}).anio0) || Number(x.entrega) || 1) === anio).map(([x, i]) => <div key={"dp" + i}>
          <Renglon l={tx(`− ${x.nombre || "Compra"} (todavía sin valor)`, `− ${x.nombre || "Purchase"} (no value yet)`)} v={0} col={C.tx2} />
          <button type="button" onClick={() => setAbierto(abierto === `dc:${i}` ? null : `dc:${i}`)} style={{ background: "transparent", border: "none", padding: "0 0 6px", color: C.gn, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{abierto === `dc:${i}` ? tx("Cerrar el detalle", "Close the detail") : tx("Detallar cómo la compras", "Detail how you buy it")}</button>
          {abierto === `dc:${i}` && <DesgloseCompra r={r} cfg={cfg} set={set} idx={i} anio0={anio} />}
        </div>)}
        {g.usoReserva > 0.5 && <Renglon l={tx("+ Sale de tu fondo de reserva", "+ From your reserve fund")} v={g.usoReserva} col={C.am} nota={tx("Lo que tienes no alcanza para vivir y pagar lo comprometido; lo cubre tu reserva.", "What you have doesn't cover living costs and commitments; your reserve does.")} />}
        <Renglon fuerte linea l={tx("Puedes usar", "You can use")} v={g.disponible} col={g.disponible > 0.5 ? C.gn : C.tx} />
        {g.faltaSinCubrir > 0.5 && <div role="alert" style={{ fontSize: 12.5, color: C.rd, margin: "4px 0 2px", lineHeight: 1.45 }}>{tx(`No alcanza: faltan ${plata(Math.round(g.faltaSinCubrir))} para vivir y pagar lo comprometido este año. Salen de tus cuentas e inversiones líquidas.`, `Not enough: ${plata(Math.round(g.faltaSinCubrir))} short for living costs and commitments this year. It comes out of your accounts and liquid investments.`)}</div>}
        {g.flujoFoto < -0.5 && <FaltaExplica r={r} cfg={cfg} set={set} anio={anio} falta={-g.flujoFoto} />}
        <Etq>{tx(`Tus movidas ${anio === 1 ? "de hoy" : "de " + Y}`, `Your moves ${anio === 1 ? "today" : "in " + Y}`)}</Etq>
        {g.movidas.length === 0 && <div style={{ fontSize: 12.5, color: C.tx2, padding: "4px 0" }}>{tx("Todavía no haces nada con esta plata. Agrega una inversión, métele a algo que ya tienes o paga una deuda.", "Nothing done with this money yet. Add an investment, add to something you own or pay off a debt.")}</div>}
        {g.movidas.map((m, k) => <Renglon key={k} l={<>{`− ${nomMov(m)}`}{m.tipo === "C" && <span style={{ fontSize: 12, color: C.tx2 }}> · {tx("inversión nueva", "new investment")}</span>}</>} v={m.monto} col={m.cuenta ? C.tx : C.tx2}
          nota={!m.cuenta ? (m.fuente === "nuevo" ? tx("Con plata nueva de afuera: no sale de aquí.", "With new money from outside: not taken from here.") : tx("De tus cuentas de hoy: no sale de aquí.", "From your current accounts: not taken from here.")) : m.abono ? tx("Abono: no alcanza para pagarla toda.", "Partial payment: not enough to pay it all.") : null} />)}
        <Renglon fuerte linea l={g.porInvertir < -0.5 ? tx("Te pasaste", "You went over") : tx("Te queda por invertir", "Left to invest")} v={g.porInvertir} col={g.porInvertir < -0.5 ? C.rd : g.porInvertir > 0.5 ? C.gn : C.tx} signo={g.porInvertir < -0.5 ? "−" : ""} />
        {g.porInvertir < -0.5 && <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.45 }}>{tx("Lo que te pasaste sale de tus cuentas e inversiones líquidas. Si prefieres, baja un monto o pásalo a otro año.", "What you went over comes out of your accounts and liquid investments. Or lower an amount or move it to another year.")}</div>}
        {anio === 1 && sinCubrir > 0.5 && <div style={{ fontSize: 12, color: C.rd, marginTop: 4 }}>{tx(`Pediste ${plata(Math.round(sinCubrir))} más de lo que hay, también en tus cuentas: esa parte no se invierte.`, `You asked for ${plata(Math.round(sinCubrir))} more than there is, even in your accounts: that part isn't invested.`)}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" style={{ ...btn(true), padding: "9px 14px" }} onClick={() => nuevaEnAnio(anio, g.porInvertir)}>{tx(`+ Inversión nueva ${anio === 1 ? "hoy" : "en " + Y}`, `+ New investment ${anio === 1 ? "today" : "in " + Y}`)}</button>
          {(() => { const libres = activosParaAportar(r, cfg, anio); return libres.length > 0 &&
            <select aria-label={tx("Meterle a algo que ya tienes", "Add to something you own")} style={{ ...inp, width: "auto", maxWidth: "100%", padding: "9px 12px", cursor: "pointer" }} value="" onChange={(e) => { if (e.target.value) reinvEnAnio(e.target.value, anio); }}>
              <option value="">{tx("+ Meterle a algo que ya tienes…", "+ Add to something you own…")}</option>
              <OpcionesAportar libres={libres} />
            </select>; })()}
          <button type="button" style={{ ...btn(false), padding: "9px 14px" }} onClick={() => scroll("f10-deudas")}>{tx("Pagar una deuda", "Pay off a debt")}</button>
        </div>
        {anio === 1 && (bd.usos || []).some((u) => (u.anio || 1) === 1) && <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: C.tx2 }}>{tx("De dónde sale la plata de cada inversión de hoy", "Where each of today's investments gets its money")}</summary>
          {(bd.usos || []).filter((u) => (u.anio || 1) === 1).map((u, k) => {
            const partes = [u.deVenta > 0.5 && `${plata(Math.round(u.deVenta))} ${tx("de lo que vendes", "from sales")}`, u.deCuentas > 0.5 && `${plata(Math.round(u.deCuentas))} ${tx("de tus cuentas", "from your accounts")}`, u.deNuevo > 0.5 && `${plata(Math.round(u.deNuevo))} ${tx("plata nueva", "new money")}`].filter(Boolean);
            return <div key={k} style={{ fontSize: 12, padding: "5px 0", borderTop: `1px solid ${C.bd}`, display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: C.tx }}>{u.nombre}<span style={{ display: "block", color: C.tx2 }}>{partes.join(" + ") || "—"}</span></span><span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{plata(Math.round(u.monto))}</span></div>;
          })}
        </details>}
      </Bloque>
    </div>
  </div>;
}
// 4 · Así te queda el año (Santiago: "al final, después de mover inversiones del año, un resultado
// final: el 2026 le sobran al mes tanto y anual tanto; ¿qué desea hacer con eso? ahorrar en fondo
// de reserva para años futuros, una inversión de renta corta, o dejarlo disponible para inversiones
// del año siguiente").
function ResultadoAnio({ r, cfg, set, cuenta, anioSel, setAnioSel }) {
  const g = cuenta.find((y) => y.anio === anioSel);
  if (!g) return null;
  const N = cuenta.length, anio = g.anio, Y = nombreAnio(anio);
  const f = (r.filas || [])[anio] || {};
  const sig = cuenta.find((y) => y.anio === anio + 1);
  const rva = cfg.reservaAnual || {};
  const ponerReserva = (v) => { const x = { ...rva }; if (v === "" || !(Number(v) > 0)) delete x[anio]; else x[anio] = v; set("reservaAnual", x); };
  const ir = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50); };
  const tasa = fmtPctEs((g.tasaReserva || 0) * 100, 1);
  const cambiosSig = sig ? cambiosDelAnio(r, cfg, sig.anio, sig.foto || {}).filter((c) => c.mes != null && c.mes < 0).map((c) => c.nombre) : [];
  return <div style={card} id="f10-resultado-anio">
    <Seccion n={4} titulo={tx(`Así te queda ${anio === 1 ? "este año" : Y}`, `How ${anio === 1 ? "this year" : Y} ends up`)} sub={tx("Después de tus movidas: tu mes, lo que no usaste y qué haces con eso.", "After your moves: your month, what you didn't use and what you do with it.")} />
    <div style={{ background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{tx("Tu mes", "Your month")}</div>
      <MesAnio filas={[
        [tx("Te entra", "Comes in"), f.ingresos || 0],
        [tx("Vivir te cuesta", "Living costs"), f.gastos || 0],
        [(f.cf || 0) < -0.5 ? tx("Te faltan", "Short") : tx("Te sobran", "Left over"), f.cf || 0, { fuerte: true, linea: true, col: (f.cf || 0) < -0.5 ? C.am : C.gn, signo: (f.cf || 0) < -0.5 ? "−" : "" }],
      ]} />
      {g.efecto > 0.5 && <div style={{ fontSize: 12, color: C.gn, marginTop: 8 }}>{tx(`Tus movidas te suman ${plata(Math.round(g.efecto))} este año (${plata(Math.round(g.efecto / 12))} al mes): lo que te pagan tus inversiones nuevas y las cuotas que dejas de pagar.`, `Your moves add ${plata(Math.round(g.efecto))} this year (${plata(Math.round(g.efecto / 12))} a month): what your new investments pay and the loan payments you stop making.`)}</div>}
    </div>
    <div style={{ background: C.bg, border: `1px solid ${g.queda < -0.5 ? C.rd : C.bd}`, borderRadius: 12, padding: "14px 16px", marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{g.queda < -0.5 ? tx("Te falta plata este año", "You're short this year") : tx("Te queda sin usar", "Left unused")}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: g.queda < -0.5 ? C.rd : g.queda > 0.5 ? C.gn : C.tx, fontVariantNumeric: "tabular-nums" }}>{g.queda < -0.5 ? "−" : ""}{plata(Math.round(Math.abs(g.queda)))}</div>
      </div>
      <div style={{ fontSize: 12, color: C.tx2, marginTop: 4, lineHeight: 1.45 }}>{g.queda < -0.5 ? tx("Sale de tus cuentas e inversiones líquidas. Baja un monto o pásalo a otro año si prefieres no tocarlas.", "It comes out of your accounts and liquid investments. Lower an amount or move it to another year if you'd rather not touch them.") : tx(`Lo que te quedó por invertir${g.efecto > 0.5 ? " más lo que tus movidas te pagan este año" : ""}.`, `What was left to invest${g.efecto > 0.5 ? " plus what your moves pay this year" : ""}.`)}</div>
      {g.queda > 0.5 && <>
        <div style={{ fontSize: 13, fontWeight: 600, margin: "14px 0 8px" }}>{tx(`¿Qué haces con los ${plata(Math.round(g.queda))}?`, `What do you do with ${plata(Math.round(g.queda))}?`)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
          <div style={{ border: `1px solid ${g.aReserva > 0.5 ? C.gn : C.bd}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{tx("A tu fondo de reserva", "To your reserve fund")}</div>
            <div style={{ fontSize: 12, color: C.tx2, margin: "2px 0 8px", lineHeight: 1.45 }}>{tx(`Para años futuros. Rinde como renta fija corta (${tasa} al año) y, si un año no te alcanza para vivir, sale de ahí.`, `For future years. Earns like short-term fixed income (${tasa} a year) and, if a year falls short on living costs, it's used there.`)}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <NumberInput aria-label={tx("Monto para tu fondo de reserva", "Amount for your reserve fund")} style={{ ...inp, flex: "1 1 auto" }} placeholder="$0" value={rva[anio] ?? ""} onChange={ponerReserva} />
              <button type="button" style={{ ...btn(false), padding: "6px 10px", whiteSpace: "nowrap" }} onClick={() => ponerReserva(Math.round(g.queda))}>{tx("Todo", "All")}</button>
            </div>
          </div>
          <div style={{ border: `1px solid ${g.pasa > 0.5 ? C.gn : C.bd}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{anio < N ? tx(`Disponible para invertir en ${anioCal(anio + 1)}`, `Available to invest in ${anioCal(anio + 1)}`) : tx(`Queda disponible al cierre de ${Y}`, `Available at the end of ${Y}`)}</div>
            <div style={{ fontSize: 12, color: C.tx2, margin: "2px 0 8px", lineHeight: 1.45 }}>{anio < N ? tx("Pasa como saldo al año siguiente: ahí lo inviertes o lo guardas.", "Carries as a balance to next year: invest it or save it there.") : tx("Es lo último del plan.", "It's the end of the plan.")}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: g.pasa > 0.5 ? C.gn : C.tx, fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(g.pasa))}</div>
          </div>
        </div>
      </>}
      {g.reservaFin > 0.5 && <div style={{ fontSize: 12.5, color: C.tx, marginTop: 10 }}>{tx(`Tu fondo de reserva al cierre ${anio === 1 ? "de este año" : "de " + Y}: `, `Your reserve fund at the end of ${anio === 1 ? "this year" : Y}: `)}<b style={{ fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(g.reservaFin))}</b>{g.usoReserva > 0.5 ? tx(` · usaste ${plata(Math.round(g.usoReserva))} para vivir`, ` · you used ${plata(Math.round(g.usoReserva))} for living costs`) : ""}</div>}
    </div>
    {/* Lo que viene el año siguiente: si te va a faltar para vivir, se dice con qué se cubre. */}
    {sig && sig.flujoFoto < -0.5 && <div style={{ fontSize: 12.5, color: C.tx, marginTop: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
      {tx(`En ${anioCal(sig.anio)} te van a faltar unos ${plata(Math.round(-sig.flujoFoto / 12))} al mes para vivir${cambiosSig.length ? ` (${cambiosSig.slice(0, 2).join(", ")})` : ""}. `, `In ${anioCal(sig.anio)} you'll be about ${plata(Math.round(-sig.flujoFoto / 12))} a month short on living costs${cambiosSig.length ? ` (${cambiosSig.slice(0, 2).join(", ")})` : ""}. `)}
      {sig.faltaSinCubrir > 0.5 ? <b style={{ color: C.rd }}>{tx(`Con lo que tengas ese año y tu fondo de reserva no alcanza: faltarían ${plata(Math.round(sig.faltaSinCubrir))}. Guarda más en tu reserva o haz que una inversión te pague cada mes.`, `What you'll have that year plus your reserve won't cover it: ${plata(Math.round(sig.faltaSinCubrir))} short. Save more in your reserve or have an investment pay you monthly.`)}</b>
        : sig.usoReserva > 0.5 ? tx(`Lo cubres con lo que tengas ese año y ${plata(Math.round(sig.usoReserva))} de tu fondo de reserva.`, `You cover it with what you'll have that year and ${plata(Math.round(sig.usoReserva))} from your reserve fund.`)
          : tx("Lo cubres con lo que tengas ese año.", "You cover it with what you'll have that year.")}
    </div>}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
      {anio > 1 ? <button type="button" style={{ ...btn(false), padding: "8px 12px" }} onClick={() => ir(anio - 1)}>← {anio === 2 ? tx("Hoy", "Today") : anioCal(anio - 1)}</button> : <span />}
      {anio < N && <button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => ir(anio + 1)}>{tx(`Seguir con ${anioCal(anio + 1)} →`, `Go on to ${anioCal(anio + 1)} →`)}</button>}
    </div>
  </div>;
}
// 24-nov-2026 (Santiago: "¿por qué me faltarían 234 MM de flujo, si las inversiones de los años
// anteriores dan para vivir?"). Cuando un año sale más de lo que entra, se dice cuánto al mes y por
// qué: las inversiones que reinvierten todo lo que ganan no entran al mes. Si una inversión del plan
// alcanza a cubrirlo pagándote una parte, se ofrece con un toque.
function FaltaExplica({ r, cfg, set, anio, falta }) {
  const f = (r.filas || [])[anio] || {};
  const reinv = (f.porActivo || []).filter((a) => !["canasta", "inmueble", "vehiculo", "ingreso", "ciclo"].includes(a.clase) && (a.crece || 0) > 0.5 && !((a.renta || 0) > 0.5)).sort((a, b) => b.crece - a.crece);
  const idx = (id) => { const m = /^nueva_(\d+)$/.exec(String(id)); return m ? Number(m[1]) : -1; };
  const cand = reinv.map((a) => ({ a, k: idx(a.id) })).find((x) => x.k >= 0 && (cfg.nuevas || [])[x.k] && !(cfg.nuevas[x.k].preset === "fincaRaiz" && cfg.nuevas[x.k].pr));
  const pct = cand ? [25, 50, 75, 100].find((p) => cand.a.crece * p / 100 >= falta) : null;
  const anioDe = Object.fromEntries((r.nuevasDetalle || []).map((x) => [x.id, x.anio || 1]));
  const repetido = (a) => reinv.filter((b) => b.nombre === a.nombre).length > 1;
  const nomDe = (a) => (repetido(a) && anioDe[a.id] ? tx(`${a.nombre} (desde ${anioCal(anioDe[a.id])})`, `${a.nombre} (since ${anioCal(anioDe[a.id])})`) : a.nombre);
  const top = reinv.slice(0, 3).map((a) => ({ ...a, nombre: nomDe(a) }));
  if (!top.length) return null;
  return <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.5, margin: "4px 0 6px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 10px" }}>
    {tx(`¿Por qué te falta? Tus inversiones sí producen, pero ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} al mes)`).join(", ")} reinvierten todo lo que ganan: eso no entra a tu mes.`, `Why the shortfall? Your investments do earn, but ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} a month)`).join(", ")} reinvest everything they earn: that doesn't reach your month.`)}
    {cand && pct && <div style={{ marginTop: 8 }}><button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => set("nuevas", cfg.nuevas.map((x, j) => (j === cand.k ? { ...x, pctRecibe: pct } : x)))}>{tx(`Que ${nomDe(cand.a)} me pague ${pct === 100 ? "todo lo que rinde" : `el ${pct} % de lo que rinde`} (unos ${plata(Math.round(cand.a.crece * pct / 100 / 12))} al mes)`, `Have ${nomDe(cand.a)} pay me ${pct === 100 ? "all it earns" : `${pct}% of what it earns`} (about ${plata(Math.round(cand.a.crece * pct / 100 / 12))} a month)`)}</button>
      <div style={{ marginTop: 4 }}>{tx("Te paga cada mes desde que la creas y el resto sigue reinvirtiéndose. Lo cambias en esa inversión, en «¿Cuánto te llega?».", "It pays you every month from when you create it; the rest keeps compounding. Change it in that investment under \"How much do you receive?\".")}</div></div>}
  </div>;
}
// Barra fija abajo en Tu plata: cómo va el año elegido, siempre a la vista.
function SaldoFijo({ cuenta, anioSel = 1, onVer }) {
  const g = cuenta.find((y) => y.anio === anioSel);
  if (!g) return null;
  const Y = anioSel === 1 ? tx("Hoy", "Today") : anioCal(anioSel);
  const falta = g.faltaSinCubrir > 0.5, pasado = g.porInvertir < -0.5, ok = !falta && !pasado;
  const txt = falta ? tx(`${Y}: faltan ${plata(Math.round(g.faltaSinCubrir))} este año`, `${Y}: ${plata(Math.round(g.faltaSinCubrir))} short this year`)
    : pasado ? tx(`${Y}: te pasaste ${plata(Math.round(-g.porInvertir))}`, `${Y}: over by ${plata(Math.round(-g.porInvertir))}`)
      : tx(`${Y}: te quedan ${plata(Math.round(g.porInvertir))} por invertir`, `${Y}: ${plata(Math.round(g.porInvertir))} left to invest`);
  return <div onClick={onVer} style={{ position: "sticky", bottom: 8, zIndex: 5, margin: "8px 0", padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: ok ? "rgba(15,42,26,0.97)" : "rgba(58,20,20,0.97)", border: `1px solid ${ok ? C.gn : C.rd}`, boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
    <span style={{ fontWeight: 700, color: ok ? C.gn : C.rd, fontVariantNumeric: "tabular-nums" }}>{txt}</span>
    <span style={{ fontSize: 12, color: C.tx2 }}>{tx(`puedes usar ${plata(Math.round(g.disponible))} · ver ↑`, `you can use ${plata(Math.round(g.disponible))} · see ↑`)}</span>
  </div>;
}

const MESES_RENTA = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108];
const opcionesMes = (actual) => (MESES_RENTA.includes(actual) ? MESES_RENTA : [...MESES_RENTA, actual].sort((a, b) => a - b));
const textoMes = (mm) => (mm === 0 ? tx("Ya", "Now") : mm % 12 === 0 ? `${tx("En", "In")} ${enAnios(mm / 12)}` : tx(`En ${mm} meses`, `In ${mm} months`));

const dedupe = (as) => { const vistos = new Set(); return as.filter((a) => (vistos.has(a.tipo) ? false : vistos.add(a.tipo))); };

function Grid({ items }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
    {items.map(([l, v]) => <div key={l} style={{ background: C.bg, borderRadius: 8, padding: 10 }}><div style={{ color: C.tx2, fontSize: 12 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div></div>)}
  </div>;
}

function TablaSupuestos({ esc }) {
  const s = supuestosF10(), p = s.presets;
  const inf = tx("inflación", "inflation"), alAnio = tx("al año", "a year");
  const vSpread = p.fincaRaiz.valorizacionSpread ? ` + ${fmtPctEs(p.fincaRaiz.valorizacionSpread)}` : "";
  const filas = [
    [tx("Inflación", "Inflation"), `${fmtPctEs(esc.inflacionPct)} ${alAnio}`],
    [esUS() ? nombreSup(p.rfCorto) : tx("Renta fija corto", "Short-term fixed income"), `${inf} + ${fmtPctEs(p.rfCorto.realSpread + esc.retornoSpread)} ≈ ${fmtPctEs(retornoNominalPreset("rfCorto", esc))} ${alAnio}`],
    [esUS() ? nombreSup(p.rfLargo) : tx("Renta fija largo", "Long-term fixed income"), `${inf} + ${fmtPctEs(p.rfLargo.realSpread)} (${tx("tope", "cap")} + ${fmtPctEs(p.rfLargo.topeSpread)})`],
    [nombreSup(p.fincaRaiz), tx(`renta neta ${fmtPctEs(p.fincaRaiz.rentaNetaPct)} + valorización = inflación${vSpread}`, `net rent ${fmtPctEs(p.fincaRaiz.rentaNetaPct)} + appreciation = inflation${vSpread}`)],
    ...(p.cripto ? [[nombreSup(p.cripto), tx("sin supuesto: el rendimiento que escribas (vacío, solo la inflación)", "no assumption: the return you enter (blank, inflation only)")]] : []),
    [nombreSup(p.sp500), s.sinRiesgoCambiario ? tx(`${fmtPctEs(esc.spRealPct)} real`, `${fmtPctEs(esc.spRealPct)} real`) : tx(`${fmtPctEs(esc.spRealPct)} real; devaluación real ${fmtPctEs(p.sp500.devaluacionRealPct)}`, `${fmtPctEs(esc.spRealPct)} real; real devaluation ${fmtPctEs(p.sp500.devaluacionRealPct)}`)],
    [tx("Vehículos", "Vehicles"), tx(`${fmtPctEs(s.vehiculo.depAnios1a3Pct)} años 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} después`, `${fmtPctEs(s.vehiculo.depAnios1a3Pct)} years 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} after`)],
    [tx("Ingresos / gastos", "Income / expenses"), `${inf} + ${fmtPctEs(esc.ingresosSpread)} / + ${fmtPctEs(esc.gastosSpread)}`],
    [tx("Ajuste de retornos del escenario", "Scenario return adjustment"), fmtPctEs(esc.retornoSpread)],
    [tx("Colchón de liquidez", "Cash cushion"), tx(`${s.colchonMeses} meses de gastos`, `${s.colchonMeses} months of expenses`)],
  ];
  return <div style={{ fontSize: 12, marginTop: 8 }}>{filas.map(([a, b]) => (
    <div key={a} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 8px", padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
      <span style={{ color: C.tx2 }}>{a}</span><span style={{ textAlign: "right", overflowWrap: "anywhere", minWidth: 0 }}>{b}</span>
    </div>))}</div>;
}

// 24-oct-2026 (Santiago: "¿por qué aparece la renta de Puerto Madero si se
// vende? Lo mismo Orlando… aparecen rentas que ya no van"). Al marcar «Se
// vende», se ve y se confirma qué ingresos y gastos se van con la venta.
function SeVaConVenta({ user, activoId, d, setD, cfg = {}, set, valor = 0 }) {
  const [verTodo, setVerTodo] = useState(false);
  const [verDeudas, setVerDeudas] = useState(false);
  // 23-nov-2026 (Santiago: "vendo un vehículo y se van una serie de gastos, impuestos, seguro, SOAT… pero también se va la deuda, y no la ve uno").
  const trmD = Number(user.trm) || 4200, fxD = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trmD : 1);
  const deudasU = (user.deudas || user.deu || []).filter((x) => x && x.sim !== false && Number(x.mt) > 0);
  const activosN = (user.inv || []).filter((a) => a && a.sim !== false).map((a) => ({ id: a.id, nombre: a.n || a.nombre }));
  const dd = cfg.deudaDe || {};
  const suyas = deudasU.filter((x) => deudaActivo(x, cfg) === activoId);
  const sugeridas = deudasU.filter((x) => !deudaActivo(x, cfg) && dd[x.id] == null && sugerirActivoDeDeuda(x.n || x.nombre, activosN) === activoId);
  const otras = deudasU.filter((x) => !deudaActivo(x, cfg) && !sugeridas.includes(x));
  const ligar = (id, on) => set && set("deudaDe", { ...dd, [id]: on ? activoId : "" });
  const totalDeuda = suyas.reduce((sm, x) => sm + Number(x.mt) * fxD(x), 0);
  const filaDeuda = (x, on) => (
    <label key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "3px 0", color: on ? C.tx : C.tx2 }}>
      <input type="checkbox" checked={on} onChange={() => ligar(x.id, !on)} />
      <span style={{ flex: 1, minWidth: 0 }}>{x.n || x.nombre || tx("Deuda", "Debt")}{Number(x.pg ?? x.pago) > 0 ? <span style={{ color: C.tx2 }}> · {tx("cuota", "payment")} {plata(Math.round(Number(x.pg ?? x.pago) * fxD(x)))}{tx("/mes", "/mo")}</span> : null}</span>
      <span style={{ whiteSpace: "nowrap" }}>{plata(Math.round(Number(x.mt) * fxD(x)))}</span>
    </label>);
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
      <span style={{ whiteSpace: "nowrap" }}>{x.tipo === "gas" || x.cat ? "−" : "+"}{plata(Math.round(x.mensual))}{String(x.moneda).toUpperCase() === "USD" && !esUS() ? " USD" : ""}{tx("/mes", "/mo")}</span>
    </label>);
  return (
    <div style={{ marginTop: 8, padding: "8px 10px", border: `1px solid ${C.bd}`, borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{tx("¿Qué se va con la venta?", "What goes with the sale?")}</div>
      <div style={{ fontSize: 12, color: C.tx2, marginBottom: 4 }}>{tx("Marca las rentas y gastos de este activo. Dejan de contar desde la venta.", "Check this asset's income and expenses. They stop counting from the sale.")}</div>
      {auto.map((x) => fila(x, true, true))}
      {visibles.map((x) => fila(x, elegidos.has(x.key), false))}
      {auto.length + visibles.length === 0 && <div style={{ fontSize: 12, color: C.tx2 }}>{tx("No encontré rentas ni gastos con este nombre. Búscalos abajo.", "No income or expenses found with this name. Look for them below.")}</div>}
      {lista.length > 0 && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setVerTodo(!verTodo)}>{verTodo ? tx("Ver solo los marcados", "Show only checked") : tx("Buscar otro ingreso o gasto", "Find another income or expense")}</button>}
      {deudasU.length > 0 && <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 10, paddingTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{tx("¿Tiene una deuda? Se paga con esta venta", "Does it have a debt? It's paid with this sale")}</div>
        <div style={{ fontSize: 12, color: C.tx2, marginBottom: 4 }}>{tx("Marca la deuda de este activo (su crédito o hipoteca). Se cancela con la plata de la venta y su cuota deja de salir.", "Check this asset's debt (its loan or mortgage). It's paid off with the sale proceeds and its payment stops.")}</div>
        {suyas.map((x) => filaDeuda(x, true))}
        {sugeridas.map((x) => filaDeuda(x, false))}
        {verDeudas && otras.map((x) => filaDeuda(x, false))}
        {suyas.length + sugeridas.length === 0 && !verDeudas && <div style={{ fontSize: 12, color: C.tx2 }}>{tx("No hay una deuda ligada a este activo.", "No debt is linked to this asset.")}</div>}
        {otras.length > 0 && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setVerDeudas(!verDeudas)}>{verDeudas ? tx("Ocultar las otras deudas", "Hide other debts") : tx("Buscar otra deuda", "Find another debt")}</button>}
        {totalDeuda > 0.5 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600, borderTop: `1px solid ${C.bd}`, marginTop: 8, paddingTop: 6 }}><span>{tx(`Te queda de la venta: ${plata(Math.round(valor))} − ${plata(Math.round(totalDeuda))} de deuda`, `Left from the sale: ${plata(Math.round(valor))} − ${plata(Math.round(totalDeuda))} of debt`)}</span><span style={{ color: valor - totalDeuda >= 0 ? C.gn : C.rd, whiteSpace: "nowrap" }}>{plata(Math.round(valor - totalDeuda))}</span></div>}
      </div>}
    </div>);
}

// Lista Sigue / Se acaba (desde un año). La usan los ingresos que se acaban.
function SeAcaba({ lista, term, setTerm, frase }) {
  const [verTodos, setVerTodos] = useState(false);
  const orden = [...lista].sort((a, b) => (!!term[b.key] - !!term[a.key]) || b.mensual - a.mensual);
  const visibles = verTodos ? orden : orden.slice(0, 8);
  const setT = (k, v) => { const nx = { ...term }; if (v) nx[k] = v; else delete nx[k]; setTerm(nx); };
  const total = orden.filter((g) => term[g.key]).reduce((sm, g) => sm + g.mensual, 0);
  if (!orden.length) return <div style={{ fontSize: 12, color: C.tx2 }}>{tx("No tienes ingresos cargados.", "You haven't added any income.")}</div>;
  return <>
    {visibles.map((g) => { const t = term[g.key]; return (
      <div key={g.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "6px 0", borderTop: `1px solid ${C.bd}` }}>
        <span style={{ flex: "1 1 160px", minWidth: 0, textDecoration: t ? "line-through" : "none", color: t ? C.tx2 : C.tx }}>{g.nombre}</span>
        <span style={{ fontSize: 13, whiteSpace: "nowrap", color: C.tx2 }}>{plata(Math.round(g.mensual))}{tx("/mes", "/mo")}</span>
        <button style={btn(!t)} onClick={() => setT(g.key, null)}>{tx("Sigue", "Continues")}</button>
        <button style={btn(!!t)} onClick={() => setT(g.key, t || 1)}>{tx("Se acaba", "Ends")}</button>
        {t && <select style={{ ...inp, width: "auto" }} value={t} onChange={(e) => setT(g.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
      </div>); })}
    {orden.length > 8 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? tx("Ver menos", "Show less") : `${tx("Ver todos", "Show all")} (${orden.length})`}</button>}
    {total > 0 && <div style={{ fontSize: 12, color: C.am, marginTop: 6 }}>{frase} {plata(Math.round(total))} {tx("al mes.", "a month.")}</div>}
  </>;
}

// 24-oct-2026 (Santiago: "uno debería poder revisar cada inversión, cuánto
// vale, cuánto renta… veo que carga promedios de otro lado… el paso uno debe
// editar también los ingresos como fees, rentas de otras inversiones").
// 22-nov-2026 (Santiago: "quiero dejar Puerto Madero para uso propio… no
// puedo editar esa renta"; "fácil y claro"). Cambia = lo usas tú o renta
// distinto, desde un año. Meterle plata va en el paso 3; ingresos nuevos que
// no son de algo que ya tienes, en «Lo que viene». Cada cosa, una sola vez.
function ModificaActivo({ x, d, setD, invierte, toggleInv, det, re, upRe, crec, setCrec }) {
  const desde = Number(d.desde) || 1;
  const v = vacioTxt(d.mensual) ? null : Math.max(0, Number(d.mensual) || 0);
  const sub = { fontSize: 13, fontWeight: 600, color: C.tx, marginBottom: 8 };
  const etq = { fontSize: 12, color: C.tx2, marginBottom: 4, textAlign: "left" };
  const ctl = { ...inp, width: "100%", boxSizing: "border-box", height: 40, margin: 0 };
  // 23-nov-2026 (Santiago: "esto es un error", con PORTAFOLIO IBKR). A un portafolio o
  // un fondo no se le "construye" ni "renta" como un inmueble: las palabras van según
  // el tipo de activo. Y las etiquetas quedaban corridas a la derecha (las clases
  // fp10-campos las ponían en otra grilla): ahora cada etiqueta va encima de su campo.
  const esInm = x.clase === "inmueble";
  const conRenta = esInm || x.usada > 0 || !vacioTxt(d.mensual) || x.crecDefaultPct == null;
  return (
    <div style={{ marginTop: 8, padding: "12px 14px", border: `1px solid ${C.bd}`, borderRadius: 8 }}>
      {conRenta ? <>
      <div style={sub}>{esInm ? tx("1. Su renta", "1. Its rent") : tx("1. Lo que te paga al mes", "1. What it pays you monthly")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <div><div style={etq}>{esInm ? tx("Nueva renta al mes, neta ($)", "New monthly rent, net ($)") : tx("Cuánto te va a llegar al mes ($)", "How much you'll receive a month ($)")}</div>
            <NumberInput style={ctl} placeholder={x.usada > 0 ? fmtMilesEs(Math.round(x.usada)) : tx("No cambia", "No change")} value={d.mensual ?? ""} onChange={(val) => setD({ accion: "cambia", mensual: val })} /></div>
          <div><div style={etq}>{tx("¿Desde cuándo?", "Starting when?")}</div>
            <select style={ctl} value={desde} onChange={(e) => setD({ accion: "cambia", desde: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></div>
        </div>
        <div style={{ fontSize: 12, color: C.tx2, marginTop: 6, lineHeight: 1.5 }}>
          {v == null ? (invierte
              ? (esInm ? tx("Si la renta nueva sale de la obra, déjalo vacío: esa renta se pone con la inversión en el paso 3.", "If the new rent comes from the works, leave it blank: that rent goes with the investment in step 3.") : tx("Si lo que te va a pagar sale de la plata que le vas a meter, déjalo vacío: eso se pone con la inversión en el paso 3.", "If what it pays comes from the money you'll add, leave it blank: that goes with the investment in step 3."))
              : (esInm ? tx("Vacío = no cambia. Pon 0 si deja de rentar (por ejemplo, si la vas a usar tú).", "Blank = no change. Enter 0 if it stops earning (e.g. you'll use it yourself).") : tx("Vacío = no cambia. Pon 0 si deja de pagarte.", "Blank = no change. Enter 0 if it stops paying you.")))
            : v === 0 ? <>{esInm ? tx("Deja de rentar.", "Stops earning.") : tx("Deja de pagarte.", "Stops paying you.")}{x.costoLigado > 0.5 ? tx(` Sus gastos (${plata(Math.round(x.costoLigado))}/mes) siguen y salen de tu bolsillo.`, ` Its expenses (${plata(Math.round(x.costoLigado))}/mo) continue and come out of your pocket.`) : ""}{esInm ? tx(" Se sigue valorizando.", " It keeps appreciating.") : ""}</>
            : tx(`Pasa de ${plata(Math.round(x.usada))} a ${plata(Math.round(v))} al mes.`, `Goes from ${plata(Math.round(x.usada))} to ${plata(Math.round(v))} a month.`)}
        </div>
      </> : <>
        {/* 23-nov-2026 (Santiago: "IBKR es una plataforma para invertir en la bolsa… yo no sé el valor que rente fijo, tal vez puedo poner un porcentaje aprox"). Sin renta mensual: se pregunta cuánto rinde al año. */}
        <div style={sub}>{tx("1. Cuánto rinde al año", "1. Yearly return")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <div><div style={etq}>{tx("Rendimiento esperado al año (%)", "Expected yearly return (%)")}</div>
            <InputDecimalEs style={ctl} placeholder={x.crecDefaultPct != null ? dec1(x.crecDefaultPct) : ""} value={crec ?? ""} onChange={(val) => setCrec(val)} /></div>
        </div>
        <div style={{ fontSize: 12, color: C.tx2, marginTop: 6, lineHeight: 1.5 }}>{tx(`Un aproximado está bien. Lo que gana se queda invertido y crece. Vacío usa el supuesto general: ${x.crecDefaultPct != null ? dec1(x.crecDefaultPct) : "—"} %.`, `An estimate is fine. Gains stay invested and compound. Blank uses the general assumption: ${x.crecDefaultPct != null ? dec1(x.crecDefaultPct) : "—"}%.`)}</div>
      </>}
      {x.clase !== "vehiculo" && <>
        <div style={{ ...sub, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>{esInm ? tx("2. Obra o adecuación", "2. Works or improvements") : tx("2. Más capital", "2. More capital")}</div>
        {<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
            <div><div style={etq}>{esInm ? tx("¿Cuánto le vas a invertir? ($) — obra, remodelación, ampliación", "How much will you invest? ($) — works, remodel, expansion") : tx("¿Cuánto le vas a meter? ($)", "How much will you add? ($)")}</div>
              <NumberInput style={ctl} placeholder={tx("Nada", "Nothing")} value={re?.monto ?? ""} onChange={(val) => upRe({ monto: val })} /></div>
            <div><div style={etq}>{tx("¿Cuándo?", "When?")}</div>
              <select style={ctl} value={Number(re?.anio) || 1} onChange={(e) => upRe({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 12, color: Number(re?.monto) > 0 ? C.gn : C.tx2, marginTop: 6, lineHeight: 1.5 }}>{!(Number(re?.monto) > 0) ? tx("Vacío = no le metes plata. ", "Blank = you add nothing. ") : ""}{Number(re?.monto) > 0 ? tx(`Queda en ${plata(Math.round(x.valor + Number(re.monto)))} (${plata(Math.round(x.valor))} de hoy + ${plata(Math.round(Number(re.monto)))}). `, `It becomes ${plata(Math.round(x.valor + Number(re.monto)))} (${plata(Math.round(x.valor))} today + ${plata(Math.round(Number(re.monto)))}). `) : ""}{esInm ? tx("De dónde sale la plata y la renta que traiga la obra se eligen en el paso 3 · Tu plata, donde se descuenta de tu saldo.", "Where the money comes from and the rent the works bring are chosen in step 3 · Your money, where it's deducted from your balance.") : tx("De dónde sale la plata se elige en el paso 3 · Tu plata, donde se descuenta de tu saldo.", "Where the money comes from is chosen in step 3 · Your money, where it's deducted from your balance.")}</div>
        </>}
      </>}
    </div>);
}
const vacioTxt = (v) => v === "" || v == null;
// Lo que vale un activo al empezar el año en que sale (su valor de hoy con lo que sube cada año).
const devuelve = (x) => x.valor * Math.pow(1 + (Number(x.crecPct) || 0) / 100, Math.max(0, (Number(x.termina) || 1) - 1));
// 23-nov-2026 (Santiago: "el sistema debe saber bien qué tipo de inversión es, y de
// acuerdo a eso deben corresponder los campos y los textos"). Las palabras de cada
// activo salen de su tipo en Patrimonio.
function palabrasTipo(x) {
  const tp = String(x.tipo || "");
  if (x.clase === "vehiculo") return { etq: tx("Vehículo", "Vehicle"), sinRenta: tx("No renta", "No income"), sale: tx("Se vende", "Sell"), cuando: tx("¿Cuándo se vende?", "When is it sold?") };
  if (x.clase === "inmueble") return { etq: tx("Inmueble", "Property"), sinRenta: tx("Sin arriendo hoy: se valoriza", "Not rented today: it appreciates"), sale: tx("Se vende", "Sell"), cuando: tx("¿Cuándo se vende?", "When is it sold?") };
  if (x.clase === "acciones") return { etq: tx("Bolsa: acciones y ETF", "Stocks and ETFs"), sinRenta: tx("No paga renta: lo que gana se queda invertido", "No payout: gains stay invested"), sale: tx("Se vende", "Sell"), cuando: tx("¿Cuándo se vende?", "When is it sold?") };
  if (/cript|crypto/i.test(tp)) return { etq: tx("Cripto", "Crypto"), sinRenta: tx("No paga renta: sube o baja de valor", "No payout: its value goes up or down"), sale: tx("Se vende", "Sell"), cuando: tx("¿Cuándo se vende?", "When is it sold?") };
  if (/cdt|renta fija/i.test(tp)) return { etq: /cdt/i.test(tp) ? "CDT" : tx("Renta fija", "Fixed income"), sinRenta: tx("Los intereses se quedan invertidos", "Interest stays invested"), sale: tx("Vence o se retira", "Matures or withdrawn"), cuando: tx("¿Cuándo vence o retiras el capital?", "When does it mature or do you withdraw?") };
  if (/fondo/i.test(tp)) return { etq: tx("Fondo de inversión", "Investment fund"), sinRenta: tx("No te paga al mes: lo que gana se queda invertido", "No monthly payout: gains stay invested"), sale: tx("Termina o se retira", "Ends or withdrawn"), cuando: tx("¿Cuándo termina o retiras el capital?", "When does it end or do you withdraw?") };
  if (/negocio/i.test(tp)) return { etq: tx("Negocio", "Business"), sinRenta: tx("No te paga al mes", "No monthly payout"), sale: tx("Se vende o termina", "Sell or ends"), cuando: tx("¿Cuándo se vende o termina?", "When is it sold or does it end?") };
  if (x.clase === "liquido") return { etq: tx("Cuenta o efectivo", "Account or cash"), sinRenta: tx("Plata disponible", "Available cash"), sale: tx("Se retira", "Withdraw"), cuando: tx("¿Cuándo lo retiras?", "When do you withdraw it?") };
  return { etq: tx("Otra inversión", "Other investment"), sinRenta: tx("No te paga al mes", "No monthly payout"), sale: tx("Se vende o termina", "Sell or ends"), cuando: tx("¿Cuándo se vende o termina?", "When is it sold or does it end?") };
}

// 22-nov-2026 (Santiago: "si en la primera sección se hace algo, esto se verá
// reflejado en los siguientes pasos"). Lo decidido en el paso 1, a la vista en
// los pasos 2 y 3.
// 23-nov-2026 (Santiago: "estoy muy seguro que puede diagramar muchísimo mejor";
// "que esta sección traiga lo nuevo de ingresos de la sección anterior, las rentas
// de los locales o bodegas, para que uno vea que sí está tenido en cuenta"; "uno
// empieza a trazar el plan en la sección uno y en la dos empieza a ver cómo va
// quedando"). Ahora va año por año, como el paso 3 y el Resultado: en cada año lo
// que vendes o termina (y lo que te deja, ya descontada su deuda), las rentas que
// empiezan o cambian, lo que le inviertes a lo que tienes y los ingresos que se
// acaban. Lo que liberas es la suma de lo que vendes ese año.
// Título que se edita tocándolo (Enter o salir guarda; Esc cancela).
function TituloEditable({ valor, onCambiar }) {
  const [t, setT] = useState(valor || "");
  useEffect(() => { setT(valor || ""); }, [valor]);
  const fin = () => { const v = t.trim(); if (v && v !== valor) onCambiar(v); else setT(valor || ""); };
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}><input className="fp-titulo-edit" aria-label={tx("Nombre del escenario (toca para cambiarlo)", "Scenario name (tap to change it)")} title={tx("Toca para cambiar el nombre", "Tap to rename")} value={t} maxLength={60}
    onChange={(e) => setT(e.target.value)} onBlur={fin} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setT(valor || ""); setTimeout(() => e.target.blur(), 0); } }} />
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.45 }}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></span>;
}

// Hoy = revisar y corregir PARA EL PLAN lo que tienes y lo que te entra.
// Las páginas Patrimonio, Ingresos y Egresos no se tocan.
function HoyDetalle({ user, cfg, set, setCfg, r }) {
  const invs = inversionesHoy(user, cfg);
  const sueltos = ingresosSueltosHoy(user, cfg);
  // 22-nov-2026 (Santiago: "si se conserva, ¿todas deberían tener un incremento anual? y un vehículo al revés, se deprecia"). Ya se calcula así; ahora se dice en cada renglón.
  const escR = r.escenario || {};
  const gIngPct = escR.inflacionPct != null ? ((1 + Number(escR.inflacionPct) / 100) * (1 + Number(escR.ingresosSpread || 0) / 100) - 1) * 100 : null;
  const [abierto, setAbierto] = useState(null);
  const lbl = { fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 };
  const rh = cfg.rentaHoy || {}, ih = cfg.ingresoHoy || {}, ch = cfg.crecHoy || {};
  const setC = (id, v) => { const nx = { ...ch }; if (v === "" || v == null) delete nx[id]; else nx[id] = v; set("crecHoy", nx); };
  const setR = (id, v) => { const nx = { ...rh }; if (v === "" || v == null) delete nx[id]; else nx[id] = v; set("rentaHoy", nx); };
  // Si el ingreso trae fecha de fin desde su página, «Sigue» tiene que quedar dicho (si no, la fecha vuelve a aplicar).
  const finI = finalesDeDatos(user).ingresos;
  const setT = (k, v) => { const t = { ...(cfg.ingresosTerminan || {}) }; if (v) t[k] = v; else if (finI[k]) t[k] = "sigue"; else delete t[k]; set("ingresosTerminan", t); };
  const setI = (k, v) => { const nx = { ...ih }; if (v === "" || v == null) delete nx[k]; else nx[k] = v; set("ingresoHoy", nx); };
  const pctTxt = (v) => `${dec1(v)}${esUS() ? "%" : " %"} ${tx("al año", "a year")}`;
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "10px 0" };
  const totalInv = invs.filter((x) => !x.vende).reduce((sm, x) => sm + x.usada, 0), totalSue = sueltos.filter((x) => !(x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1))).reduce((sm, x) => sm + x.mensual, 0);
  return <>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>{tx("Cada inversión: cuánto vale y cuánto renta", "Each investment: what it's worth and what it earns")}</h3>
      <p style={{ color: C.tx2, fontSize: 13, marginTop: 0 }}>{tx(<>De cada una, tres opciones: <b style={{ color: C.tx }}>se conserva</b> tal como está, <b style={{ color: C.tx }}>se modifica</b> (le metes plata o cambia lo que te paga) o <b style={{ color: C.tx }}>sale</b> (se vende, vence o la retiras, hoy o en el año que digas).</>, <>For each one, three options: <b style={{ color: C.tx }}>keep</b> as it is, <b style={{ color: C.tx }}>modify</b> (add money or what it pays changes) or <b style={{ color: C.tx }}>it leaves</b> (sold, matures or withdrawn, today or in the year you say).</>)}</p>
      {invs.map((x) => { const ab = abierto === x.id; return (
        <div key={x.id} style={fila}>
          <div onClick={() => setAbierto(ab ? null : x.id)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span style={{ minWidth: 0 }}><b style={{ textDecoration: x.vende ? "line-through" : "none", color: x.vende ? C.tx2 : C.tx }}>{x.nombre}</b> <span style={{ fontSize: 11.5, color: C.tx2, border: `1px solid ${C.bd}`, borderRadius: 999, padding: "1px 8px", marginLeft: 4, whiteSpace: "nowrap" }}>{palabrasTipo(x).etq}</span></span><span style={{ color: x.vende ? C.tx2 : C.tx }}>{plata(Math.round(x.valor))}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 13, color: x.usada > 0 && !x.vende ? C.gn : C.tx2, textDecoration: x.vende ? "line-through" : "none" }}>
              <span>{x.usada > 0 ? `${tx("Renta hoy", "Income today")} ${plata(Math.round(x.usada))}${tx("/mes", "/mo")}${x.corregida ? tx(" (corregida)", " (edited)") : ""}${x.vende ? tx(" · deja de entrar", " · stops") : ""}` : x.bruta > 0.5 ? tx(`Renta ${plata(Math.round(x.bruta))}/mes, pero sus gastos se la comen: no deja neto`, `Earns ${plata(Math.round(x.bruta))}/mo, but its expenses use it up: no net income`) : palabrasTipo(x).sinRenta}{x.termina ? <b style={{ color: C.am }}>{" → "}{x.usada > 0 ? tx(`te paga hasta ${anioCal(x.termina - 1)} · `, `pays until ${anioCal(x.termina - 1)} · `) : ""}{tx(`en ${anioCal(x.termina)} ${x.clase === "inmueble" || x.clase === "vehiculo" || x.clase === "acciones" ? "recibes" : "te regresan"} ${plata(Math.round(devuelve(x)))}`, `in ${anioCal(x.termina)} you get ${plata(Math.round(devuelve(x)))}`)}</b> : null}{!x.vende && !x.termina && x.cambio ? <b style={{ color: C.am }}>{" → "}{x.cambio.modo === "propio" ? tx(`sin renta ${x.cambio.desde <= 1 ? "desde ya" : "desde " + anioCal(x.cambio.desde)}`, `no income ${x.cambio.desde <= 1 ? "from now" : "from " + anioCal(x.cambio.desde)}`) : tx(`${plata(Math.round(x.cambio.mensual))}/mes ${x.cambio.desde <= 1 ? "desde ya" : "desde " + anioCal(x.cambio.desde)}`, `${plata(Math.round(x.cambio.mensual))}/mo ${x.cambio.desde <= 1 ? "from now" : "from " + anioCal(x.cambio.desde)}`)}</b> : null}</span>
              <span>{x.usada > 0 ? pctTxt(x.pctAnual) : ""} {ab ? "▴" : "▾"}</span>
            </div>
            <div style={{ fontSize: 12, color: C.tx2 }}>{x.crecPct == null ? tx(`Pierde valor cada año: ${dec1(-supuestosF10().vehiculo.depAnios1a3Pct)} % los primeros 3 años y ${dec1(-supuestosF10().vehiculo.depDespuesPct)} % después`, `Loses value every year: ${dec1(-supuestosF10().vehiculo.depAnios1a3Pct)}% for the first 3 years, then ${dec1(-supuestosF10().vehiculo.depDespuesPct)}%`) : x.capitalPlano ? tx("Su capital no cambia: te devuelven lo mismo que pusiste", "Its principal doesn't change: you get back what you put in") : `${tx("Su valor sube", "Its value grows")} ${pctTxt(x.crecPct)}`}{x.crecPct != null && !x.capitalPlano ? (x.crecCorregido ? tx(" · lo pusiste tú", " · set by you") : tx(" · supuesto general, corrígelo", " · general assumption, edit it")) : ""}{x.usada > 0 && !x.vende && gIngPct != null ? tx(` · Su renta sube ${dec1(gIngPct)} % al año (inflación${Number(escR.ingresosSpread) > 0 ? " + " + dec1(escR.ingresosSpread) : ""})`, ` · Its income grows ${dec1(gIngPct)}% a year (inflation${Number(escR.ingresosSpread) > 0 ? " + " + dec1(escR.ingresosSpread) : ""})`) : ""}</div>
          </div>
          {(() => {
            const d = (cfg.decisiones || {})[x.id] || { accion: "continua" };
            const elegir = (k) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: k === "cambia" ? { accion: "cambia", desde: d.desde || 1, mensual: d.mensual ?? "" } : { accion: k } }, reinversiones: k !== "cambia" ? (p.reinversiones || []).filter((y) => y.activoId !== x.id) : p.reinversiones }));
            const setD = (nx) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: { ...((p.decisiones || {})[x.id] || {}), ...nx } } }));
            const cambia = d.accion === "cambia";
            const invierte = !x.vende && (cfg.reinversiones || []).some((y) => y.activoId === x.id);
            const sale = x.vende || !!x.termina;
            const modifica = !sale && (cambia || invierte);
            const toggleInv = () => set("reinversiones", invierte ? (cfg.reinversiones || []).filter((y) => y.activoId !== x.id) : [...(cfg.reinversiones || []), { activoId: x.id, monto: "", anio: 1, rentaMensual: "", rentaDesdeMes: 0, fuente: "venta" }]);
            const det = (r.reinversionesDetalle || []).find((y) => y.activoId === x.id && y.aporte > 0);
            return <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
                {/* 22-nov-2026 (Santiago: "tengo un lote y el año entrante le construyo una bodega: ¿sigue igual?… un sistema profesional diría Se conserva y Se modifica: la renta o las adecuaciones o inversiones"). Tres estados que no se pisan. */}
                <button style={{ ...btn(!sale && !modifica), padding: "4px 10px" }} onClick={() => elegir("continua")}>{tx("Se conserva", "Keep")}</button>
                {(x.clase !== "vehiculo" || x.usada > 0 || modifica) && <button style={{ ...btn(modifica), padding: "4px 10px" }} onClick={() => { if (!modifica) elegir("cambia"); }}>{tx("Se modifica", "Modify")}</button>}
                <button style={{ ...btn(sale), padding: "4px 10px" }} onClick={() => { if (!sale) elegir("vende"); }}>{palabrasTipo(x).sale}</button>
              </div>
              {/* 22-nov-2026 (Santiago: "esta inversión dura 2 años: me devuelven el capital y dejo de recibir la renta"). Vender o vencer tiene un cuándo: ya, o un año siguiente. */}
              {sale && <div style={{ marginTop: 8, padding: "10px 12px", border: `1px solid ${C.bd}`, borderRadius: 8 }}>
                <label style={{ fontSize: 12, color: C.tx2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{palabrasTipo(x).cuando}
                  <select style={{ ...inp, width: "auto" }} value={x.termina || 1} onChange={(e) => { const y = Number(e.target.value); setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: y <= 1 ? { accion: "vende" } : { accion: "termina", desde: y } } })); }}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
                {x.terminaDePatrimonio && <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>{tx(`En tu Patrimonio dice que vence en ${x.venceAnio}. Si la vas a renovar, elige «Se conserva».`, `Your Net worth page says it matures in ${x.venceAnio}. If you'll renew it, choose "Keep".`)}</div>}
                {/* 23-nov-2026 (Santiago: "revise todo el proceso, que sea claro"; "no solo hasta dónde va la renta sino cuándo se libera el capital"). Dos datos, uno por renglón, con cifras. */}
                {x.termina ? <div style={{ fontSize: 13, color: C.tx, marginTop: 8, lineHeight: 1.6 }}>
                  {x.usada > 0 && <div>{tx("Te paga hasta", "Pays until")} <b>{anioCal(x.termina - 1)}</b>: {plata(Math.round(x.usada))}{tx("/mes", "/mo")}.</div>}
                  <div>{tx("En", "In")} <b>{anioCal(x.termina)}</b> {tx("te llega el capital", "the capital arrives")}: <b>{plata(Math.round(devuelve(x)))}</b>{Math.abs(devuelve(x) - x.valor) > 1 ? tx(" (lo que valdría ese año)", " (its value that year)") : ""}.</div>
                  <div style={{ fontSize: 12, color: C.tx2 }}>{tx(`Esa plata la armas en el paso 3, en el recuadro de ${anioCal(x.termina)}. Si tiene una deuda ligada, se paga primero.`, `You allocate that money in step 3, in the ${anioCal(x.termina)} box. If it has a linked debt, that's paid first.`)}</div>
                </div> : <div style={{ fontSize: 13, color: C.tx, marginTop: 8, lineHeight: 1.6 }}>
                  <div>{tx("Sale", "Leaves")} <b>{tx("hoy", "today")}</b>: {plata(Math.round(x.valor))} {tx("entran a tu plata de hoy (paso 3)", "go into today's money (step 3)")}{x.usada > 0 ? tx(` y dejas de recibir ${plata(Math.round(x.usada))}/mes`, ` and you stop receiving ${plata(Math.round(x.usada))}/mo`) : ""}.</div>
                  <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Si sale más adelante, cambia el año aquí arriba.", "If it leaves later, change the year above.")}</div>
                </div>}
              </div>}
              {x.vende && <SeVaConVenta user={user} activoId={x.id} d={d} cfg={cfg} set={set} valor={x.valor} setD={(nx) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: { ...d, ...nx } } }))} />}
              {modifica && <ModificaActivo x={x} d={d} setD={setD} invierte={invierte} toggleInv={toggleInv} det={det}
                re={(cfg.reinversiones || []).find((y) => y.activoId === x.id)} upRe={(nx) => setCfg((p) => { const l = p.reinversiones || [], hay = l.some((y) => y.activoId === x.id);
                  // Al borrar el monto se quita la inversión, pero el recuadro sigue abierto (queda en «Se modifica»).
                  if ("monto" in nx && (nx.monto === "" || nx.monto == null)) { const dd = (p.decisiones || {})[x.id]; return { ...p, reinversiones: l.filter((y) => y.activoId !== x.id), decisiones: { ...p.decisiones, [x.id]: dd && dd.accion === "cambia" ? dd : { accion: "cambia", desde: 1, mensual: "" } } }; }
                  return { ...p, reinversiones: hay ? l.map((y) => (y.activoId === x.id ? { ...y, ...nx } : y)) : [...l, { activoId: x.id, monto: "", anio: 1, rentaMensual: "", rentaDesdeMes: 0, fuente: "venta", ...nx }] }; })}
                crec={ch[x.id]} setCrec={(val) => setC(x.id, val)} />}
            </>;
          })()}
          {ab && <div style={{ marginTop: 8, fontSize: 12, color: C.tx2 }}>
            {x.ingresos.length === 0 && x.gastos.length === 0 && <div>{tx("No tiene ingresos ni gastos ligados en tus páginas Ingresos y Egresos.", "It has no linked income or expenses on your Income and Expenses pages.")}</div>}
            {x.ingresos.map((y, k) => <div key={"i" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>+ {y.nombre}{y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {x.gastos.map((y, k) => <div key={"g" + k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>− {y.nombre}{x.manual ? <i> · {tx("ya incluido en la renta", "already included in the income")}</i> : y.nota ? <i> · {y.nota}</i> : null}</span><span>{plata(Math.round(y.mensual))}</span></div>)}
            {(x.ingresos.length > 0 || x.gastos.length > 0) && <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 4, color: C.tx }}><span>{tx("Renta neta según tus páginas", "Net income per your pages")}</span><span>{plata(Math.round(x.neta))}{tx("/mes", "/mo")}</span></div>}
            {/* 22-nov-2026: la renta se cambia con «Su renta va a cambiar» (un solo lugar). Aquí solo se deshace una corrección vieja. */}
            {rh[x.id] != null && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setR(x.id, null)}>{tx(`Quitar la renta corregida (${plata(Math.round(Number(rh[x.id]) || 0))}) y volver a la de mis páginas`, `Remove the edited income and use the one from my pages`)}</button>}
            {x.crecDefaultPct != null && <label style={{ ...lbl, marginTop: 8 }}>{tx("¿Cuánto sube su valor al año? (%, opcional)", "Annual appreciation (%, optional)")}
              <InputDecimalEs style={inp} placeholder={dec1(x.crecDefaultPct)} value={ch[x.id] ?? ""} onChange={(v) => setC(x.id, v)} />
              <span style={{ fontSize: 12 }}>{x.clase === "inmueble" ? tx("Valorización del inmueble.", "Property appreciation.") : x.usada > 0 ? tx("Aparte de la renta que te llega. Si la renta ya es todo lo que gana, déjalo en la inflación.", "On top of the income you receive. If the income is all it earns, leave it at inflation.") : tx("Lo que gana al año y se queda invertido (interés compuesto).", "What it earns a year and stays invested (compounding).")} {tx("Si lo dejas vacío se usa el supuesto general:", "If left blank, the general assumption is used:")} {dec1(x.crecDefaultPct)} %.</span></label>}
          </div>}
        </div>); })}
      {/* 22-nov-2026 (Santiago: "llevar a una persona al paso 3 sin terminar es sacarla del proceso… más bien una nota"). Aquí solo se decide lo de hoy; la inversión futura tiene su paso. */}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{tx("Rentas de inversiones", "Investment income")}{invs.some((x) => x.vende) ? tx(" (sin las que vendes)", " (excluding sold)") : ""}</span><span>{plata(Math.round(totalInv))}{tx("/mes", "/mo")}</span></div>
    </div>
    <div style={card}>
      <h3 style={{ marginTop: 0, marginBottom: 2 }}>{tx("Tus otros ingresos", "Your other income")}</h3>
      {/* 25-oct-2026 (Santiago: "confunde… aquí no se pueden editar o quitar y después en el paso 2 aparecen otra vez"). Un ingreso, un lugar: aquí se corrige el monto y se decide si sigue o se acaba. */}
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>{tx(<>Fees, salarios y rentas que no están ligados a una inversión de arriba. De cada uno: <b style={{ color: C.tx }}>cuánto te entra</b> (corrígelo si no es real) y <b style={{ color: C.tx }}>si sigue o se acaba</b> en este escenario.</>, <>Fees, salaries and income not tied to an investment above. For each one: <b style={{ color: C.tx }}>how much comes in</b> (fix it if it's off) and <b style={{ color: C.tx }}>whether it continues or ends</b> in this scenario.</>)}</p>
      {sueltos.length === 0 && <div style={{ fontSize: 13, color: C.tx2 }}>{tx("No tienes otros ingresos.", "You have no other income.")}</div>}
      {sueltos.map((x) => (
        <div key={x.key} style={fila}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b style={{ textDecoration: x.seVa ? "line-through" : "none", color: x.seVa ? C.tx2 : C.tx }}>{x.nombre}</b><span style={{ fontSize: 12, color: C.tx2 }}>{x.renta ? tx("renta", "passive") : tx("trabajo", "work")}</span></div>
          {x.seVa && <div style={{ fontSize: 12, color: C.am }}>{x.seVa === "venta" ? tx("Se va con una venta que marcaste arriba: no suma.", "Goes with a sale you marked above: not counted.") : tx(`Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`, `Ends ${Number(x.acabaAnio) <= 1 ? "now: not counted" : `in ${anioCal(x.acabaAnio)}`}.`)}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enIngresos))} value={ih[x.key] ?? ""} onChange={(v) => setI(x.key, v)} /></span>
            <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? tx(`corregido (en Ingresos: ${plata(Math.round(x.enIngresos))})`, `edited (on Income: ${plata(Math.round(x.enIngresos))})`) : tx(`${plata(Math.round(x.mensual))}/mes, de tu página Ingresos`, `${plata(Math.round(x.mensual))}/mo, from your Income page`)}</span>
            {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setI(x.key, null)}>{tx("Quitar", "Remove")}</button>}
          </div>
          {x.nota && !x.corregido && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{x.nota}</div>}
          {x.finDeDatos && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`En tu página Ingresos dice que termina en ${x.finAnio}. Si va a seguir, elige «Sigue».`, `Your Income page says it ends in ${x.finAnio}. If it will continue, choose "Continues".`)}</div>}
          {x.seVa !== "venta" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>{tx("Sigue", "Continues")}</button>
            <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 1)}>{tx("Se acaba", "Ends")}</button>
            {x.acabaAnio && <select style={{ ...inp, width: "auto" }} value={x.acabaAnio} onChange={(e) => setT(x.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
          </div>}
        </div>))}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{tx("Otros ingresos", "Other income")}{sueltos.some((x) => x.seVa) ? tx(" (sin los que se van)", " (excluding ended)") : ""}</span><span>{plata(Math.round(totalSue))}{tx("/mes", "/mo")}</span></div>
    </div>
    <TusGastos user={user} cfg={cfg} set={set} />
  </>;
}

// 23-nov-2026 (Santiago: "en el capítulo de propiedad raíz poder decir si se hace
// una sola vez o se repite: compra en planos a constructora, lote y construcción,
// proyecto asociativo, locales o bodegas… si es permanente o se vende a los 2
// años"). Cinco preguntas en el mismo orden para todas las modalidades y un
// resumen en palabras. El motor lo traduce en leerPropiedadRaiz().
function PropiedadRaiz({ x, up, usarSaldo }) {
  const pr = x.pr || {};
  const set = (v) => up({ pr: { ...pr, ...v } });
  const p = leerPropiedadRaiz(x, 10);
  const tipo = p.tipo;
  const lbl = { fontSize: 12, color: C.tx2 };
  const chip = (on) => ({ ...btn(on), padding: "6px 12px" });
  const num = (k, l, ph, extra) => <label style={{ ...lbl, display: "grid", gap: 4 }}>{l}<NumberInput style={inp} placeholder={ph || tx("Valor", "Amount")} value={pr[k] ?? ""} onChange={(v) => set({ [k]: v })} />{extra}</label>;
  const pct = (k, l, ph) => <label style={lbl}>{l}<InputDecimalEs style={inp} placeholder={ph} value={pr[k] ?? ""} onChange={(v) => set({ [k]: v })} /></label>;
  const anios = (k, l, desde = 0, hasta = 6, f) => <label style={lbl}>{l}<select style={inp} value={Number(pr[k]) || 0} onChange={(e) => set({ [k]: Number(e.target.value) })}>{Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map((y) => <option key={y} value={y}>{f ? f(y) : enAnios(y)}</option>)}</select></label>;
  const fila = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 };
  const paso = (nro, t) => <div style={{ fontSize: 12, color: C.tx2, marginBottom: 4 }}>{nro} · {t}</div>;
  const TIPOS = [["planos", tx("Compra en planos", "Off-plan purchase")], ["lote", tx("Lote y construcción", "Lot and build")], ["asociativo", tx("Proyecto asociativo", "Joint development")], ["rentar", tx("Construir para rentar", "Build to rent")]];
  const vende = p.final === "vende";
  const anioIni = anioCal(p.anio);
  const anioVenta = anioCal(p.anio + p.durAnios);
  const pierde = !p.vacio && vende && p.gananciaAntes < -0.5;
  const resumen = p.vacio ? tx("Escribe los valores para ver el resultado.", "Enter the amounts to see the result.")
    : vende
      ? <>
        {tx(`Entras con ${plata(Math.round(p.capital))} en ${anioIni}. ${tipo === "planos" && !p.vendeEn ? `A la entrega cedes el contrato por ${plata(Math.round(p.ventaBruta))}` : `Vendes en ${plata(Math.round(p.ventaBruta))}`} en ${anioVenta}${p.costoVenta > 0.5 ? `; costos de venta ${plata(Math.round(p.costoVenta))}` : ""}.`, `You put in ${plata(Math.round(p.capital))} in ${anioIni}. You sell for ${plata(Math.round(p.ventaBruta))} in ${anioVenta}${p.costoVenta > 0.5 ? `; sale costs ${plata(Math.round(p.costoVenta))}` : ""}.`)}
        {" "}{pierde
          ? <b style={{ color: C.rd }}>{tx(`Con estos valores pierdes ${plata(Math.round(-p.gananciaAntes))}: el precio de venta es menor que lo que inviertes.`, `With these numbers you lose ${plata(Math.round(-p.gananciaAntes))}: the sale price is below what you invest.`)}</b>
          : tx(`Ganancia por ciclo: ${plata(Math.round(p.gananciaCiclo))} después de costos e impuesto (${fmtPctEs(p.impuestoPct, 0)}, ${p.regimen === "ocasional" ? "ganancia ocasional" : "renta ordinaria"}: ${plata(Math.round(p.impuestoCiclo))}).`, `Profit per cycle: ${plata(Math.round(p.gananciaCiclo))} after costs and tax (${fmtPctEs(p.impuestoPct, 0)}: ${plata(Math.round(p.impuestoCiclo))}).`)}
        {p.repite && tx(` Se repite cada ${enAnios(p.durAnios)}${p.veces > 1 ? `, ${p.veces} veces en el plan` : ""}.`, ` It repeats every ${p.durAnios} years${p.veces > 1 ? `, ${p.veces} times in the plan` : ""}.`)}
        {pierde && p.modoVenta === "m2" && (tipo === "lote" || tipo === "rentar") && <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{tx(`Revisa si el precio por m² incluye el lote: ${fmtMilesEs(p.m2)} m² × ${plata(Math.round(p.ventaBruta / Math.max(1, p.m2)))} = ${plata(Math.round(p.ventaBruta))}, frente a ${plata(Math.round(p.capital))} de lote + obra.`, `Check whether the price per m² includes the lot: ${fmtMilesEs(p.m2)} m² × ${plata(Math.round(p.ventaBruta / Math.max(1, p.m2)))} = ${plata(Math.round(p.ventaBruta))}, vs ${plata(Math.round(p.capital))} lot + build.`)}</div>}
        {p.retencion > 0.5 && <div style={{ fontSize: 12.5, color: C.tx2, marginTop: 6 }}>{tx(`Al vender te retienen ${plata(Math.round(p.retencion))} (${fmtPctEs(p.retencionPct, 1)} de la venta). Es un anticipo del impuesto: en tu declaración ${p.saldoDeclaracion > 0.5 ? `pagas la diferencia, ${plata(Math.round(p.saldoDeclaracion))}` : p.saldoDeclaracion < -0.5 ? `te queda un saldo a favor de ${plata(Math.round(-p.saldoDeclaracion))}` : "queda en cero"}.`, `On sale ${plata(Math.round(p.retencion))} is withheld (${fmtPctEs(p.retencionPct, 1)} of the sale). It's an advance on the tax: in your return you ${p.saldoDeclaracion > 0.5 ? `pay the difference, ${plata(Math.round(p.saldoDeclaracion))}` : p.saldoDeclaracion < -0.5 ? `get a ${plata(Math.round(-p.saldoDeclaracion))} credit` : "owe nothing more"}.`)}</div>}
      </>
      : tx(`Inviertes ${plata(Math.round(p.capital))}${tipo === "planos" ? ` (${plata(Math.round((p.pagos[0] || {}).monto || 0))} en ${anioIni} y el saldo a la entrega)` : ` en ${anioIni}`}. En ${anioCal(p.entrega)} vale ${plata(Math.round(p.valorAlTerminar))} y desde ahí se valoriza ${fmtPctEs(p.crec * 100, 1)} al año${p.renta > 0 ? `; renta ${plata(Math.round(p.renta))} al mes desde la entrega` : ""}. Se queda en tu patrimonio.`,
        `You invest ${plata(Math.round(p.capital))}. In ${anioCal(p.entrega)} it's worth ${plata(Math.round(p.valorAlTerminar))} and then appreciates ${fmtPctEs(p.crec * 100, 1)} a year${p.renta > 0 ? `; it rents ${plata(Math.round(p.renta))} a month from handover` : ""}. It stays in your net worth.`);
  return <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12, background: C.bg, borderRadius: 8, padding: 12 }}>
    <div>{paso(1, tx("Modalidad", "Type"))}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{TIPOS.map(([k, l]) => <button key={k} type="button" style={chip(tipo === k)} onClick={() => set({ tipo: k, ...(k === "asociativo" ? { final: "vende" } : k === "rentar" && !pr.final ? { final: "queda" } : {}) })}>{l}</button>)}</div></div>
    <div>{paso(2, tx("Inversión", "Investment"))}<div style={fila}>
      <label style={lbl}>{tx("¿Cuándo empieza?", "When does it start?")}<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
      {tipo === "planos" && <>{num("valor", tx("Valor del inmueble ($)", "Property price ($)"))}{pct("cuotaPct", tx("Cuota inicial (%)", "Down payment (%)"), "30")}{anios("plazo", tx("Entrega en", "Handover in"), 1, 5)}</>}
      {(tipo === "lote" || tipo === "rentar") && <>{num("lote", tx("Valor del lote ($)", "Lot price ($)"))}{num("m2", tx("Metros cuadrados a construir", "Square meters to build"), "0")}{num("costoM2", tx("Costo de construcción por m² ($)", "Build cost per m² ($)"))}{anios("plazo", tx("Obra lista en", "Ready in"), 0, 5, (y) => (y === 0 ? tx("Ya está lista", "Already built") : enAnios(y)))}</>}
      {tipo === "asociativo" && <>{num("valor", tx("Capital que aportas ($)", "Capital you contribute ($)"), null, usarSaldo)}<label style={lbl}>{tx("Duración del proyecto", "Project length")}<select style={inp} value={Number(pr.meses) || 12} onChange={(e) => set({ meses: Number(e.target.value) })}>{[6, 12, 18, 24, 30, 36, 48, 60].map((m) => <option key={m} value={m}>{m % 12 === 0 ? enAnios(m / 12) : tx(`${m} meses`, `${m} months`)}</option>)}</select></label></>}
      {(tipo === "lote" || tipo === "rentar") && p.capital > 0 && <div style={{ ...lbl, alignSelf: "end" }}>{tx("Inversión total", "Total investment")}: <b style={{ color: C.tx }}>{plata(Math.round(p.capital))}</b></div>}
    </div></div>
    <div>{paso(3, tx("Rentabilidad", "Return"))}<div style={fila}>
      {/* 23-nov-2026 (Santiago: "precio de venta una vez terminada"; "tener la opción de poner valor de venta por m² o margen %: compré en 3.840 MM y estimo vender un 35 % más, o a un valor de m² de X; una o la otra, y si pongo uno se pone el otro"). Tres campos ligados: el que escribes manda y los otros se calculan. */}
      <div style={{ gridColumn: "1 / -1", ...lbl }}>{tipo === "asociativo" ? tx("Lo que recibes al terminar el proyecto (escribe uno; el otro se calcula)", "What you receive when the project ends (enter one; the other is calculated)") : vende ? tx("Precio de venta una vez terminada (escribe uno; los otros se calculan)", "Sale price once finished (enter one; the others are calculated)") : tx("Valor una vez terminada (escribe uno; los otros se calculan)", "Value once finished (enter one; the others are calculated)")}</div>
      {(() => {
        const baseM = tipo === "planos" ? Math.max(0, Number(pr.valor) || 0) : Math.max(0, p.capital || 0);
        const ve = Math.max(0, p.valorEntrega || 0);
        const margen = baseM > 0 && ve > 0 ? Math.round((ve / baseM - 1) * 1000) / 10 : "";
        const porM2 = p.m2 > 0 && ve > 0 ? Math.round(ve / p.m2) : "";
        return <>
          <label style={{ ...lbl, display: "grid", gap: 4 }}>{tipo === "planos" ? tx("Valorización (%)", "Appreciation (%)") : tx("Margen sobre lo que inviertes (%)", "Margin on what you invest (%)")}
            <InputDecimalEs style={inp} placeholder="35" value={p.modoVenta === "pct" ? (pr.valEntregaPct ?? "") : margen} onChange={(v) => set({ ventaModo: "pct", valEntregaPct: v })} /></label>
          {tipo !== "asociativo" && <>
            {tipo === "planos" && <label style={{ ...lbl, display: "grid", gap: 4 }}>{tx("Área (m²)", "Area (m²)")}<NumberInput style={inp} placeholder="0" value={pr.m2 ?? ""} onChange={(v) => set({ m2: v })} /></label>}
            <label style={{ ...lbl, display: "grid", gap: 4 }}>{tx("Precio por m² ($)", "Price per m² ($)")}
              <NumberInput style={inp} placeholder={p.m2 > 0 ? tx("Valor", "Amount") : tx("Pon los m²", "Enter the m²")} value={p.modoVenta === "m2" ? (pr.ventaM2 ?? "") : porM2} onChange={(v) => set({ ventaModo: "m2", ventaM2: v })} /></label>
          </>}
          <label style={{ ...lbl, display: "grid", gap: 4 }}>{tx("Valor total ($)", "Total value ($)")}
            <NumberInput style={inp} placeholder={tx("Valor", "Amount")} value={p.modoVenta === "total" ? (pr.ventaTotal ?? "") : (ve > 0 ? Math.round(ve) : "")} onChange={(v) => set({ ventaModo: "total", ventaTotal: v })} /></label>
        </>;
      })()}
      {tipo !== "asociativo" && (!vende || p.vendeEn > 0 || tipo === "rentar") && pct("valAnualPct", tx("Valorización anual después (%)", "Annual appreciation after (%)"), "6")}
      {(tipo === "rentar" || (tipo !== "asociativo" && !vende)) && num("rentaMensual", tx("Renta neta mensual ($)", "Net monthly rent ($)"), "0")}
    </div></div>
    {tipo !== "asociativo" && <div>{paso(4, tx("Al final", "At the end"))}<div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button type="button" style={chip(!vende)} onClick={() => set({ final: "queda" })}>{tx("Me quedo con ella", "I keep it")}</button>
      <button type="button" style={chip(vende)} onClick={() => set({ final: "vende" })}>{tx("La vendo", "I sell it")}</button>
      {vende && <select aria-label={tx("Cuándo vendes", "When you sell")} style={{ ...inp, width: "auto" }} value={Number(pr.vendeEn) || 0} onChange={(e) => set({ vendeEn: Number(e.target.value) })}>{[0, 1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y === 0 ? (tipo === "planos" ? tx("a la entrega", "at handover") : tx("al terminar la obra", "when finished")) : tx(`${enAnios(y)} después`, `${y} years after`)}</option>)}</select>}
    </div></div>}
    {vende && <div>{paso(tipo === "asociativo" ? 4 : 5, tx("¿Se repite?", "Does it repeat?"))}<div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button type="button" style={chip(!pr.repite)} onClick={() => set({ repite: false })}>{tx("Una sola vez", "Just once")}</button>
      <button type="button" style={chip(!!pr.repite)} onClick={() => set({ repite: true })}>{tx(`Sí, cada ${p.durAnios ? enAnios(p.durAnios) : "ciclo"}`, `Yes, every ${p.durAnios || ""} years`)}</button>
      <select aria-label={tx("Destino de la ganancia", "Where the profit goes")} style={{ ...inp, width: "auto" }} value={pr.destino === "flujo" ? "flujo" : "reinvierte"} onChange={(e) => set({ destino: e.target.value })}>
        <option value="reinvierte">{tx("La ganancia se reinvierte", "Profit is reinvested")}</option>
        <option value="flujo">{tx("La ganancia me llega como ingreso", "Profit comes to me as income")}</option>
      </select>
    </div></div>}
    <div style={{ fontSize: 13, lineHeight: 1.55, color: C.tx, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>{resumen}</div>
    {/* 23-nov-2026 (Santiago: "no veo lo de impuestos estimados; si se vende 4 años después… 15 % ganancia ocasional o renta, que lo siga pero el usuario pueda poner su valor; el impuesto estimado es X pero todo depende de la gestión tributaria del individuo"). Visible, con el régimen sugerido por el tiempo de tenencia y todo editable. */}
    {vende && <div>{paso(tipo === "asociativo" ? 5 : 6, tx("Costos e impuesto estimados", "Estimated costs and tax"))}
      <div style={{ fontSize: 12.5, color: C.tx, marginBottom: 6 }}>{p.regimen === "ocasional"
        ? tx(`La tienes ${enAnios(p.durAnios)}: por ser 2 años o más, la utilidad paga ganancia ocasional (sugerido ${fmtPctEs(p.impuestoPct, 0)}).`, `Held ${p.durAnios} years: 2 years or more pays capital-gains tax (suggested ${fmtPctEs(p.impuestoPct, 0)}).`)
        : tx(`La tienes menos de 2 años: la utilidad va a renta ordinaria (sugerido ${fmtPctEs(p.impuestoPct, 0)}, la tarifa marginal más alta).`, `Held under 2 years: the gain is ordinary income (suggested ${fmtPctEs(p.impuestoPct, 0)}).`)}</div>
      <div style={fila}>
        {pct("costosPct", tx("Costos de venta (%)", "Sale costs (%)"), tipo === "asociativo" ? "0" : "3")}
        {pct("impuestoPct", tx("Impuesto sobre la utilidad (%)", "Tax on the gain (%)"), String(Math.round(p.impuestoPct || 0)))}
        {pct("retencionPct", tx("Retención al vender (%)", "Withholding on sale (%)"), "1")}
        {!p.vacio && <div style={{ ...lbl, alignSelf: "end" }}>{tx("Impuesto estimado", "Estimated tax")}: <b style={{ color: C.tx }}>{plata(Math.round(p.impuestoCiclo || 0))}</b>{p.repite && p.veces > 1 ? tx(" por ciclo", " per cycle") : ""}</div>}
      </div>
      <div style={{ fontSize: 12, color: C.tx2, marginTop: 6, lineHeight: 1.5 }}>{tx("Es un estimado: el impuesto real depende de la planeación tributaria de cada persona (costo fiscal, exenciones como la de la vivienda de habitación, pérdidas que se compensan). Cámbialo si tu contador te da otra cifra. La retención (1 % si vende una persona natural, la cobra el notario) es un anticipo y se descuenta del impuesto en la declaración.", "It's an estimate: the actual tax depends on each person's tax planning. Change it if your accountant gives you another figure. Withholding is an advance that's credited in your return.")}</div>
    </div>}
  </div>;
}

function Ciclos({ lista, set, det, destinos = [] }) {
  const lbl = { fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4 };
  const up = (i, v) => set(lista.map((y, j) => (j === i ? { ...y, ...v } : y)));
  // CO: $1.350M (millones de pesos). US: cifra corta en dólares ($1.4M, $450K).
  const mm = (v) => (esUS() ? plataR(v) : fmtPlataEs(v));
  const TC = tarifaCiclo();
  const nomT = (t) => tx(t.nombre, t.nombreEn), notaT = (t) => tx(t.nota, t.notaEn);
  return <>
    {lista.map((x, i) => {
      const cap = Number(x.capital) || 0, vf = Number(x.valorFinal) || 0, meses = Number(x.meses) || 12, costos = Number(x.costosPct) || 0;
      const reg = TC[x.regimen] ? x.regimen : regimenSugerido(meses);
      const impPct = x.impuestoPct == null || x.impuestoPct === "" ? TC[reg].pct : Number(x.impuestoPct) || 0;
      const bruta = Math.max(0, vf - cap) * (1 - costos / 100), imp = bruta * impPct / 100;
      const gan = bruta - imp, anual = gan * 12 / meses;
      const siempre = x.hasta == null || x.hasta === "";
      return (
        <div key={i} style={{ borderTop: `1px solid ${C.bd}`, padding: "10px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} placeholder={tx("Ej.: Asociativos", "e.g. Fix-and-flip")} value={x.nombre ?? ""} onChange={(e) => up(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>{tx("¿Cuánto capital pones? ($)", "How much capital do you put in? ($)")}<NumberInput style={inp} placeholder={miles(esUS() ? 350000 : 1350000000)} value={x.capital ?? ""} onChange={(v) => up(i, { capital: v })} /></label>
          <label style={lbl}>{tx("¿Cuánto recibes al final de cada ciclo? ($)", "How much do you get back at the end of each cycle? ($)")}<NumberInput style={inp} placeholder={miles(esUS() ? 450000 : 1900000000)} value={x.valorFinal ?? ""} onChange={(v) => up(i, { valorFinal: v })} /><span style={{ fontSize: 12 }}>{tx("Lo que vale o en lo que vendes al terminar.", "What it's worth or what you sell it for at the end.")}</span></label>
          <label style={lbl}>{tx("¿Cuánto dura cada ciclo?", "How long is each cycle?")}<select style={inp} value={meses} onChange={(e) => up(i, { meses: Number(e.target.value) })}>{[6, 9, 12, 18, 24, 36].map((m) => <option key={m} value={m}>{m % 12 === 0 ? enAnios(m / 12) : tx(`${m} meses`, `${m} months`)}</option>)}</select></label>
          <label style={lbl}>{tx("Otros costos sobre la ganancia (%, opcional)", "Other costs on the profit (%, optional)")}<InputDecimalEs style={inp} placeholder="0" value={x.costosPct ?? ""} onChange={(v) => up(i, { costosPct: v })} /><span style={{ fontSize: 12 }}>{esUS() ? tx("Comisiones, cierre, escrituras.", "Commissions, closing costs, title fees.") : tx("Comisiones, fiducia, escrituras.", "Commissions, trust fees, deeds.")}</span></label>
          <div style={{ ...lbl, gridColumn: "1 / -1", border: `1px solid ${C.bd}`, borderRadius: 8, padding: 8 }}>{tx("Impuesto sobre la ganancia", "Tax on the profit")}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select style={{ ...inp, flex: "1 1 220px", width: "auto" }} value={reg} onChange={(e) => up(i, { regimen: e.target.value, impuestoPct: "" })}>{Object.entries(TC).map(([k, t]) => <option key={k} value={k}>{nomT(t)}{k !== "otro" ? ` · ${t.pct} %` : ""}</option>)}</select>
              <span style={{ display: "flex", alignItems: "center", gap: 4, width: 110 }}><InputDecimalEs style={inp} placeholder={String(TC[reg].pct)} value={x.impuestoPct ?? ""} onChange={(v) => up(i, { impuestoPct: v })} />%</span>
            </div>
            <span style={{ fontSize: 12 }}>{tx("Sugerido:", "Suggested:")} {TC[reg].pct} %. {notaT(TC[reg])} {esUS() ? tx("Puedes cambiar el %. Es una estimación, confírmala con tu CPA.", "You can change the %. It's an estimate; confirm it with your CPA.") : tx("Puedes cambiar el %. Es una estimación, confírmala con tu contador.", "You can change the %. It's an estimate; confirm it with your accountant.")}</span>
            {cap > 0 && vf > cap && <span style={{ fontSize: 12, color: C.am }}>{tx(`Impuesto estimado: ${mm(imp)} por ciclo (${mm(imp * 12 / meses)} al año).`, `Estimated tax: ${mm(imp)} per cycle (${mm(imp * 12 / meses)} a year).`)}</span>}
          </div>
          <label style={lbl}>{tx("¿Desde cuándo?", "Starting when?")}<select style={inp} value={x.desde || 1} onChange={(e) => up(i, { desde: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
          <div style={lbl}>{tx("¿Hasta cuándo?", "Until when?")}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={btn(siempre)} onClick={() => up(i, { hasta: "" })}>{tx("Sigue siempre", "Ongoing")}</button>
              <button style={btn(!siempre)} onClick={() => up(i, { hasta: Math.max(Number(x.desde) || 1, 5) })}>{tx("Termina", "Ends")}</button>
              {!siempre && <select style={{ ...inp, width: "auto" }} value={x.hasta} onChange={(e) => up(i, { hasta: Number(e.target.value) })}>{ANIOS.filter((y) => y >= (Number(x.desde) || 1)).map((y) => <option key={y} value={y}>{tx("Último ciclo en", "Last cycle in")} {anioCal(y)}</option>)}</select>}
            </div></div>
          <label style={lbl}>{tx("¿De dónde sale el capital?", "Where does the capital come from?")}<FuenteSel value={x.fuente} on={(v) => up(i, { fuente: v })} /><span style={{ fontSize: 12 }}>{tx("Sale una sola vez; después el mismo capital se vuelve a usar.", "It goes out once; after that the same capital is reused.")}</span></label>
          <div style={{ ...lbl, gridColumn: "1 / -1" }}>{tx("¿Qué haces con la ganancia de cada ciclo?", "What do you do with each cycle's profit?")} <span style={{ fontSize: 12 }}>{tx("El capital vuelve a entrar al negocio; esto es solo lo que ganas.", "The capital goes back into the deal; this is just your profit.")}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button style={btn(x.destino !== "flujo")} onClick={() => up(i, { destino: "reinvierte" })}>{tx("La reinvierto", "Reinvest it")}</button>
              <button style={btn(x.destino === "flujo")} onClick={() => up(i, { destino: "flujo" })}>{tx("Me llega al mes", "Pay it to me monthly")}</button>
            </div>
            {x.destino !== "flujo" ? <label style={{ ...lbl, marginTop: 4 }}>{tx("¿En qué la reinviertes?", "Where do you reinvest it?")}
              <select style={inp} value={x.destinoId || ""} onChange={(e) => up(i, { destinoId: e.target.value || null })}>
                <option value="">{tx("En lo que sobra (se reparte como en E)", "Into the surplus (split as in E)")}</option>
                {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select></label>
            : <span style={{ fontSize: 12 }}>{tx("Entra a tu flujo como un ingreso.", "It goes into your cash flow as income.")}</span>}</div>
          {cap > 0 && vf > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: vf > cap ? C.gn : C.am }}>
            {vf > cap ? tx(<>Pones {mm(cap)} y recibes {mm(vf)} cada {meses === 12 ? "año" : `${meses} meses`}: te quedan <b>{mm(gan)}</b> por ciclo después de impuestos ({mm(anual)} al año, {dec1(anual / cap * 100)} % sobre el capital). {x.destino === "flujo" ? "Esa ganancia te llega" : `Esa ganancia se reinvierte en ${(destinos.find((d) => d.id === x.destinoId) || { nombre: "lo que sobra (E)" }).nombre}`} {siempre ? "todos los años" : `hasta ${anioCal(x.hasta)}`}{siempre ? "" : "; después el capital vuelve"}.</>,
              <>You put in {mm(cap)} and get back {mm(vf)} every {meses === 12 ? "year" : `${meses} months`}: you keep <b>{mm(gan)}</b> per cycle after taxes ({mm(anual)} a year, {dec1(anual / cap * 100)}% on the capital). {x.destino === "flujo" ? "That profit is paid to you" : `That profit is reinvested in ${(destinos.find((d) => d.id === x.destinoId) || { nombre: "the surplus (E)" }).nombre}`} {siempre ? "every year" : `until ${anioCal(x.hasta)}`}{siempre ? "" : "; then the capital comes back"}.</>) : tx("Recibes menos de lo que pones: no hay ganancia.", "You get back less than you put in: no profit.")}
          </div>}
          <div style={{ gridColumn: "1 / -1" }}><button style={btn(false)} onClick={() => set(lista.filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button></div>
        </div>);
    })}
    <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => set([...lista, { nombre: "", capital: "", valorFinal: "", meses: 12, desde: 1, hasta: "", fuente: "venta", destino: "reinvierte" }])}>{tx("+ Agregar negocio que se repite", "+ Add a repeating deal")}</button>
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
  const sobraHoy = tEntra - tSale;
  const lista = Array.isArray(cfg.sobraDestinos) ? cfg.sobraDestinos : [];
  const up = (i, v) => set("sobraDestinos", lista.map((y, j) => (j === i ? { ...y, ...v } : y)));
  const usado = lista.reduce((sm, x) => sm + (Number(x.pct) || 0), 0);
  const resto = Math.max(0, 100 - usado);
  const fila = (nombre, v, col, nota) => <div key={nombre + v} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "2px 0" }}><span style={{ color: C.tx2, minWidth: 0 }}>{nombre}{nota ? <span style={{ fontSize: 12 }}> · {nota}</span> : null}</span><span style={{ color: col, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{plata(Math.round(v))}</span></div>;
  return <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontWeight: 700 }}>{sobraHoy >= 0 ? tx("Cada mes te sobran", "Monthly surplus") : tx("Cada mes te faltan", "Monthly shortfall")}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: sobraHoy >= 0 ? C.gn : C.rd }}>{plata(Math.round(Math.abs(sobraHoy)))}</span>
    </div>
    {/* 23-nov-2026 (Santiago: "¿sobran 79 MM o 78 MM? ... no es claro y el 79 MM no sabe uno qué es"). La cuenta escrita: entra − sale = sobra. */}
    <div style={{ fontSize: 12.5, color: C.tx2, fontVariantNumeric: "tabular-nums" }}>{tx(`Entra al mes ${plata(Math.round(tEntra))} − sale al mes ${plata(Math.round(tSale))} = te sobran ${plata(Math.round(sobraHoy))}.`, `Monthly in ${plata(Math.round(tEntra))} − monthly out ${plata(Math.round(tSale))} = ${plata(Math.round(sobraHoy))} surplus.`)}</div>
    {Math.abs(sobra - sobraHoy) > Math.max(1, Math.abs(sobraHoy)) * 0.005 && <div style={{ fontSize: 12, color: C.tx2 }}>{tx(`En el plan, ${anioCal(1)} cierra con un promedio de ${plata(Math.round(sobra))} al mes, porque incluye lo que cambia durante el año (inflación, deudas que se pagan, rentas que empiezan o se acaban).`, `In the plan, ${anioCal(1)} averages ${plata(Math.round(sobra))} a month, because it includes changes during the year.`)}</div>}
    <div style={{ fontSize: 12, color: C.tx2 }}>{""} {sobra < 0 ? tx("Lo que falta sale de tu liquidez.", "The shortfall comes from your cash.") : ""}</div>
    <button style={{ ...btn(false), marginTop: 6, fontSize: 12, padding: "4px 10px" }} onClick={() => setVer(!ver)}>{ver ? tx("Ocultar de dónde sale cada peso", "Hide where every dollar comes from") : esUS() ? tx("Ver de dónde sale cada dólar", "See where every dollar comes from") : tx("Ver de dónde sale cada peso", "See where every peso comes from")}</button>
    {ver && <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1 }}>{tx("Entra cada mes", "In each month")}</div>
      {entra.map((x) => fila(x.nombre, x.mensual, C.tx, x.nota))}
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2 }}>{fila(tx("Total que entra", "Total in"), tEntra, C.tx)}</div>
      <div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1, marginTop: 6 }}>{tx("Sale cada mes", "Out each month")}</div>
      {(d.sale || []).slice(0, 6).map((x) => fila(x.nombre, x.mensual, C.tx2))}
      {(d.sale || []).length > 6 && fila(tx(`y ${(d.sale || []).length - 6} gastos más`, `and ${(d.sale || []).length - 6} more expenses`), (d.sale || []).slice(6).reduce((sm, x) => sm + x.mensual, 0), C.tx2)}
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2 }}>{fila(tx("Total que sale", "Total out"), tSale, C.tx2)}</div>
      <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 2, fontWeight: 700 }}>{fila(sobra >= 0 ? tx("Te sobra al mes", "Monthly surplus") : tx("Te falta al mes", "Monthly shortfall"), Math.abs(sobra), sobra >= 0 ? C.gn : C.rd)}</div>
      {(d.reinvierte || []).length > 0 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 4 }}>{tx(`No cuenta lo que rinden y no te llega (${(d.reinvierte || []).map((x) => x.nombre).join(", ")}): eso ya se reinvierte solo.`, `Returns you don't receive aren't counted (${(d.reinvierte || []).map((x) => x.nombre).join(", ")}): they're already reinvested.`)}</div>}
    </div>}
    {sobra > 0 && <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700 }}>{tx("¿En qué reinviertes lo que sobra cada mes?", "Where do you reinvest your monthly surplus?")}</div>
      {lista.map((x, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <select style={{ ...inp, flex: "1 1 160px", width: "auto" }} value={x.id || ""} onChange={(e) => up(i, { id: e.target.value })}>
            <option value="">{tx("Elige una inversión", "Choose an investment")}</option>
            {destinos.map((dd) => <option key={dd.id} value={dd.id}>{dd.nombre}</option>)}
          </select>
          <span style={{ display: "flex", alignItems: "center", gap: 4, width: 80 }}><InputDecimalEs style={inp} value={x.pct ?? ""} onChange={(v) => up(i, { pct: v })} />%</span>
          <span style={{ fontSize: 12, color: C.gn, whiteSpace: "nowrap" }}>{plata(Math.round(sobra * (Number(x.pct) || 0) / 100))}{tx("/mes", "/mo")}</span>
          <button style={{ ...btn(false), padding: "4px 10px" }} onClick={() => set("sobraDestinos", lista.filter((_, j) => j !== i))} aria-label={tx("Quitar", "Remove")}>✕</button>
        </div>))}
      <button style={{ ...btn(true), marginTop: 8 }} onClick={() => set("sobraDestinos", [...lista, { id: "", pct: resto }])}>{tx("+ Reinvertir en una inversión", "+ Reinvest in an investment")}</button>
      <div style={{ fontSize: 12, color: usado > 100 ? C.rd : C.tx2, marginTop: 6 }}>
        {usado > 100 ? tx("Los porcentajes suman más de 100 %.", "The percentages add up to more than 100%.") : resto > 0 ? tx(`${resto} % (${plata(Math.round(sobra * resto / 100))}/mes) ${cfg.repartoDisponible ? "queda disponible, como elegiste abajo." : "se reparte como lo de las ventas, abajo."}`, `${resto}% (${plata(Math.round(sobra * resto / 100))}/mo) ${cfg.repartoDisponible ? "stays available, as you chose below." : "is split like the sale proceeds, below."}`) : tx("Asignaste el 100 % de lo que sobra.", "You've allocated 100% of the surplus.")}
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
  const finG = finalesDeDatos(user).gastos;
  const setT = (k, v) => { const nx = { ...term }; if (v) nx[k] = v; else if (finG[k]) nx[k] = "sigue"; else delete nx[k]; set("gastosTerminan", nx); };
  const orden = [...lista].sort((a, b) => (!!(b.corregido || b.seVa) - !!(a.corregido || a.seVa)) || b.mensual - a.mensual);
  const visibles = verTodos ? orden : orden.slice(0, 10);
  const cuenta = (x) => !(x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1));
  const total = lista.filter(cuenta).reduce((sm, x) => sm + x.mensual, 0);
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "10px 0" };
  return <div style={card}>
    <h3 style={{ marginTop: 0, marginBottom: 2 }}>{tx("Tus gastos", "Your expenses")}</h3>
    <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>{tx(<>De tu página Egresos. De cada uno: <b style={{ color: C.tx }}>cuánto sale al mes</b> (corrígelo si cambió, por ejemplo un arriendo nuevo) y <b style={{ color: C.tx }}>si sigue o se acaba</b>. Solo cambia el plan; Egresos no se toca. Los gastos futuros (la universidad) van en el paso 2.</>, <>From your Expenses page. For each one: <b style={{ color: C.tx }}>how much goes out monthly</b> (fix it if it changed, e.g. a new rent) and <b style={{ color: C.tx }}>whether it continues or ends</b>. It only changes the plan; Expenses isn't touched. Future expenses (college) go in step 2.</>)}</p>
    {visibles.map((x) => (
      <div key={x.key} style={fila}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <b style={{ textDecoration: x.seVa ? "line-through" : "none", color: x.seVa ? C.tx2 : C.tx }}>{x.nombre}</b>
          <span style={{ fontSize: 12, color: C.tx2 }}>{x.cat}{x.deActivo ? ` · ${tx("de", "from")} ${x.deActivo}` : ""}</span>
        </div>
        {x.seVa && <div style={{ fontSize: 12, color: C.am }}>{x.seVa === "venta" ? tx("Se va con una venta que marcaste arriba: no suma.", "Goes with a sale you marked above: not counted.") : tx(`Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`, `Ends ${Number(x.acabaAnio) <= 1 ? "now: not counted" : `in ${anioCal(x.acabaAnio)}`}.`)}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enEgresos))} value={gh[x.key] ?? ""} onChange={(v) => setG(x.key, v)} /></span>
          <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? tx(`corregido (en Egresos: ${plata(Math.round(x.enEgresos))})`, `edited (on Expenses: ${plata(Math.round(x.enEgresos))})`) : tx(`${plata(Math.round(x.mensual))}/mes, de tu página Egresos`, `${plata(Math.round(x.mensual))}/mo, from your Expenses page`)}</span>
          {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setG(x.key, null)}>{tx("Quitar", "Remove")}</button>}
        </div>
        {x.finDeDatos && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`En tu página Egresos dice que termina en ${x.finAnio}. Si va a seguir, elige «Sigue».`, `Your Expenses page says it ends in ${x.finAnio}. If it will continue, choose "Continues".`)}</div>}
        {x.seVa !== "venta" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>{tx("Sigue", "Continues")}</button>
          <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 1)}>{tx("Se acaba", "Ends")}</button>
          {x.acabaAnio && <select style={{ ...inp, width: "auto" }} value={x.acabaAnio} onChange={(e) => setT(x.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
        </div>}
      </div>))}
    {orden.length > 10 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? tx("Ver menos", "Show less") : `${tx("Ver todos", "Show all")} (${orden.length})`}</button>}
    <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{tx("Gastos de hoy en el plan", "Today's expenses in the plan")}</span><span>{plata(Math.round(total))}{tx("/mes", "/mo")}</span></div>
  </div>;
}
