// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { tx, esUS, pct as fmtPctR, miles, plata as plataR, ejemploMonto, monedaBase, localeCifras } from "../lib/region.js";
import { proyectarFuturo10, supuestosF10, nombreSup, retornoNominalPreset, rendimientoHintPct, leerFuturos, migrarModifica, resumenEscenario, migrarClaves, anioCal, indexacionDefaultPct, gastosLista, tarifaCiclo, regimenSugerido, sugerirVinculados, rentasDuplicadas, rentasFuturasDelActivo, inversionesHoy, leerCambios, finalesDeDatos, sugerirActivoDeDeuda, deudaActivo, ingresosSueltosHoy, leerPropiedadRaiz, hayAlertaLiquidez, cuentaPorAnio, fotosPorAnio, holguraPorAnio, CDT_CO } from "../lib/futuro10.js";
import { track } from "../lib/analytics";
import PlanInforme from "./PlanInforme";
import PlanComparador from "./PlanComparador";
import EscenariosCreados, { AvisoCalculo } from "./infografia/EscenariosCreados";
import BarraFuturo10 from "./BarraFuturo10";

import { fmtPlataEs } from "../lib/formato.js";
const C = { bg: "var(--fp-card)", bg2: "var(--fp-raised)", bd: "rgba(var(--fp-ink),0.1)", tx: "var(--fp-txt)", tx2: "var(--fp-txt2)", gn: "#00c805", rd: "#ff5000", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
// 24-nov-2026 (Santiago: "cuesta entender qué es título, subtítulo y texto: todo es como igual, todo grita igual";
// "eso le pasa mucho a FINPATHIA"). Una sola escala, tres niveles que se distinguen por tamaño, peso y color:
//   título de sección 22/600 (blanco) · título de ficha 16/600 (blanco) · subtítulo 14 (gris) · texto 14 · nota 12 (gris).
const TIPO = {
  seccion: { fontSize: 22, fontWeight: 600, color: C.tx, margin: 0, lineHeight: 1.25 },
  sub: { fontSize: 14, color: C.tx2, lineHeight: 1.5, margin: "6px 0 0", maxWidth: 720 },
  ficha: { fontSize: 16, fontWeight: 600, color: C.tx, lineHeight: 1.3 },
  meta: { fontSize: 13, color: C.tx2, lineHeight: 1.45 },
};
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(0,200,5,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
// 24-nov-2026 (Santiago: "esto debería verse con más jerarquía, unos botones verdes: pasa desapercibido"). Las acciones principales de un
// paso (qué haces con tu capital, qué viene en tus próximos años) van en verde; la que está abierta, verde lleno.
const btnAccion = (on) => ({ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.gn}`, background: on ? C.gn : "rgba(0,200,5,0.12)", color: on ? "#000" : C.gn, cursor: "pointer", fontSize: 14, fontWeight: 600 });
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
  // 24-nov-2026 (Santiago: "elegí invertir en algo que ya tengo y uno no sabe si guardó o no").
  // Lo que pasa con el guardado se ve en la barra de abajo de Tu plata: guardando, guardado o error.
  const [estadoGuardado, setEstadoGuardado] = useState(null);
  useEffect(() => {
    if (demo || !onGuardar) return;
    const json = JSON.stringify(cfg);
    if (json === ultimoGuardado.current || JSON.stringify({ ...cfg, _clavesV2: undefined }) === JSON.stringify(CONFIG_INICIAL)) return;
    setEstadoGuardado("guardando");
    const t = setTimeout(() => {
      ultimoGuardado.current = json;
      const g = guardadoRef.current || {};
      // Si estás editando un escenario, cada cambio queda guardado en él.
      const id = editandoRef.current;
      const escs = id ? (g.escenarios || []).map((e) => (e.id === id ? { ...e, config: cfg, editado: new Date().toISOString() } : e)) : g.escenarios;
      Promise.resolve(onGuardar({ ...g, borrador: cfg, ...(escs ? { escenarios: escs } : {}) })).then(() => setEstadoGuardado("listo"), () => setEstadoGuardado("error"));
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
  // Lo que se escribe para un año siguiente va en pesos de hoy (se paga indexado): se convierte con factorHoy.
  const quedaEnAnio = (anio) => { const g = cuenta.find((y) => y.anio === anio) || {}; return (g.porInvertir || 0) / (g.factorHoy || 1); };
  // 24-nov-2026: agregar desde la cascada ya no salta a las tarjetas de abajo; la movida se edita en su fila.
  const reinvEnAnio = (activoId, anio) => {
    const q = quedaEnAnio(anio), k = cfg.reinversiones.length;
    set("reinversiones", [...cfg.reinversiones, { activoId, monto: q > 0.5 ? montoHoyQueCabe(cuenta, anio) : "", anio, rentaMensual: "", rentaDesdeMes: 0, fuente: anio > 1 ? "liquidez" : "venta" }]);
    return "r" + k;
  };
  const nuevaEnAnio = (anio, queda) => {
    const k = cfg.nuevas.length;
    set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: queda > 0.5 ? montoHoyQueCabe(cuenta, anio) : "", fuente: anio > 1 ? "liquidez" : "venta", anio }]);
    return "n" + k;
  };
  // 24-nov-2026 (Santiago: "uno no sabe que tiene que ir dejando cada año organizado… llené hoy, pero no queda
  // claro que ya quedó ok y que sigue 2027"). Cada año se deja listo y se pasa al siguiente.
  const irAnio = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 60); };
  const dejarListo = (anio) => {
    set("aniosListos", { ...(cfg.aniosListos || {}), [anio]: true });
    const N = cuenta.length;
    if (anio < N) irAnio(anio + 1); else { ir(3); window.scrollTo?.({ top: 0, behavior: "smooth" }); }
  };
  const esc = r.escenario;
  const escenarios = guardado.escenarios || [];
  const SUP = supuestosF10();
  const PASOS = pasosF10();
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
          <TituloPaso n={1}>{tx("Lo que tienes hoy", "What you have today")}</TituloPaso>
          {/* 25-oct-2026 (Santiago: "deberíamos explicar que ahí se puede revisar y ajustar valores y rentabilidad de cada inversión"). */}
          <div style={{ ...SUB_PASO, marginBottom: 14 }}>
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
        {/* 24-nov-2026 (Santiago: "limpiamos y damos orden"; "fichas más recogidas, no todo desplegado"; "de acuerdo a lo que quiere hacer se abre el menú"). Pagar deudas, invertir en lo que ya tienes, inversiones nuevas y lo que sobra viven dentro de cada año y se abren al elegir qué hacer. */}
        <AnioPorAnio r={r} cfg={cfg} set={set} cuenta={cuenta} anioSel={anioSel} setAnioSel={setAnioSel} nuevaEnAnio={nuevaEnAnio} reinvEnAnio={reinvEnAnio} esc={esc} irResultado={() => { ir(3); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}  dejarListo={dejarListo} irAnio={irAnio}
          paneles={{
            deudas: <div id="f10-deudas">
          {(r.deudas || []).length + (r.deudasSinSaldo || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} anioSel={anioSel} setAnioSel={setAnioSel} /> : <p style={{ color: C.tx2, fontSize: 13 }}>{tx("No tienes deudas con saldo.", "You have no outstanding debt.")}</p>}
            </div>,
            tienes: <div id="f10-reinv">
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
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2 }}>{tx(`La creaste en el plan en ${anioCal(a.anio)}. Lo que inviertes se suma a ella y rinde igual${detR && detR.rendimientoPct != null ? ` (${fmtPctEs(detR.rendimientoPct, 1)} al año)` : ""}; si te paga una parte, te paga en la misma proporción.`, `You created it in the plan in ${anioCal(a.anio)}. What you add joins it and earns the same${detR && detR.rendimientoPct != null ? ` (${fmtPctEs(detR.rendimientoPct, 1)} a year)` : ""}; if it pays you a share, it pays in the same proportion.`)}</div>
                  <label style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿Cuánto inviertes? ($)", "How much do you invest? ($)")}<NumberInput style={inp} value={x0.monto} onChange={(v) => upR({ monto: v })} />
                    <BotonSaldo disponible={Math.max(0, quedaEnAnio(anioSel) + (Number(x0.monto) || 0))} actual={Number(x0.monto) || 0} anio={anioSel} on={(v) => upR({ monto: v })} /></label>
                  <div style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿De dónde sale?", "Where does it come from?")}<div style={{ fontSize: 13.5, color: C.tx, padding: "8px 0" }}>{tx(`Del saldo de ${anioCal(anioSel)}`, `From the ${anioCal(anioSel)} balance`)}</div></div>
                </div>}
                {activo && !a.delPlan && <div style={{ marginTop: 8 }}><AporteCampos x={cfg.reinversiones[iR]} up={upR} det={detR} activos={r.activos} vendidos={r.vendidos || []} saldoDisp={Math.max(0, quedaEnAnio(anioSel) + (Number(cfg.reinversiones[iR].monto) || 0))} sinRenta={!(Number(cfg.reinversiones[iR].rentaMensual) > 0) && rentasFuturasDelActivo(cfg, a, r.activos).some((f) => f.vinculada)} /></div>}
              </div>
            );
          })}
          {(() => { const libres = activosParaAportar(r, cfg, anioSel); if (!libres.length) return null; return (
            <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 10, marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: C.tx2 }}>
              <span>{tx(`+ Invertir más en algo que ya tienes ${anioSel === 1 ? "hoy" : "en " + anioCal(anioSel)}:`, `+ Add more to something you own in ${anioSel === 1 ? "today" : anioCal(anioSel)}:`)}</span>
              <select style={{ ...inp, width: "auto", maxWidth: "100%" }} value="" onChange={(e) => { if (e.target.value) reinvEnAnio(e.target.value, anioSel); }}>
                <option value="">{tx("Elegir…", "Choose…")}</option>
                <OpcionesAportar libres={libres} />
              </select>
            </div>); })()}
            </div>,
          }} />
        <SaldoFijo cuenta={cuenta} cfg={cfg} anioSel={anioSel} estadoGuardado={demo ? "demo" : estadoGuardado} dejarListo={dejarListo} onVer={() => document.getElementById("f10-anios")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      </>)}

      {paso === 3 && (<>
        <div style={{ ...card, marginBottom: 14 }}>
          <TituloPaso n={4}>{tx("Resultado a 10 años", "10-year result")}</TituloPaso>
          <div style={SUB_PASO}>{tx("Así se ve este escenario. Guárdalo en el paso 5 para compararlo con otros.", "Here's how this scenario looks. Save it in step 5 to compare it with others.")}</div>
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
          <TituloPaso n={5}>{editando ? `${tx("Estás editando", "You're editing")} «${editando.nombre}»` : tx("Ponle nombre a este escenario", "Name this scenario")}</TituloPaso>
          <div style={{ ...SUB_PASO, marginBottom: 8 }}>{editando ? tx("Cada cambio se guarda solo en este escenario. El nombre se cambia tocando el título de arriba.", "Every change is saved to this scenario automatically. Rename it by tapping the title at the top.") : tx("Con nombre queda guardado y lo puedes comparar con los demás y con «Si me quedo como estoy».", "What you built in steps 1–3 doesn't have a name yet. Name it to save it and compare it with the others.")}</div>
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
          <TituloPaso n={5}>{tx("No hay nada por guardar", "Nothing to save")}</TituloPaso>
          <div style={SUB_PASO}>{tx("Para crear un escenario, cambia algo en los pasos 1 a 3 y vuelve aquí a ponerle nombre.", "To create a scenario, change something in steps 1–3 and come back here to name it.")}</div>
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
      {paso <= 2 && <AvisoCalculo testId="f10-aviso-calculo-barra" style={{ margin: "0 0 8px" }} />}
      {/* En Tu plata manda la barra del año (SaldoFijo): dos barras pegadas abajo se tapan y cargan la pantalla. */}
      {paso <= 1 && <BarraFuturo10 rPlan={r} rHoy={(planesComparar[0] || {}).r} onIr={() => { ir(3); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />}
      </>}

      <details style={card}>
        <summary style={{ cursor: "pointer" }}>{tx("Supuestos (inflación y cuánto rinden las inversiones)", "Assumptions (inflation and investment returns)")}</summary>
        <p style={{ color: C.tx2, fontSize: 12 }}>{tx("No son tus escenarios: es cómo se comporta el mercado. «Normales» es lo esperado; «Prudentes» supone más inflación y menos rendimiento; «Favorables», lo contrario.", "These aren't your scenarios: they're how the market behaves. \"Typical\" is what's expected; \"Cautious\" assumes higher inflation and lower returns; \"Favorable\", the opposite.")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>{tx("Supuestos del mercado:", "Market assumptions:")}</span>
        {Object.entries(SUP.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{nombreSup(e)}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>{tx("inflación", "inflation")} {fmtPctEs(esc.inflacionPct)}</span>
      </div>
      {/* 24-nov-2026 (indexación, Luis + Finanzas): cuánto suben al año tus ingresos y gastos; aparte de la inflación. */}
      <label data-testid="f10-indexacion" style={{ fontSize: 12, color: C.tx2, display: "flex", flexDirection: "column", gap: 4, maxWidth: 360, marginBottom: 8 }}>
        {tx("¿Cuánto suben al año tus ingresos y gastos? (%)", "How much do your income and expenses rise each year? (%)")}
        <InputDecimalEs style={{ ...inp, width: 120 }} placeholder={fmtPctEs(indexacionDefaultPct(SUP))} value={cfg.indexacionPct ?? ""} onChange={(v) => set("indexacionPct", v)} />
        <span>{tx(`Sueldo, gastos, rentas e ingresos y gastos futuros. Si no sabes, déjalo en ${fmtPctEs(indexacionDefaultPct(SUP))}. Las cuotas fijas de tus créditos no suben. Lo que anotas para años futuros (compras, aportes) sube con la inflación.`, `Salary, expenses, rents and future income and expenses. If unsure, leave it at ${fmtPctEs(indexacionDefaultPct(SUP))}. Fixed loan payments don't rise. What you enter for future years (purchases, contributions) rises with inflation.`)}</span>
      </label>

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
  // 24-nov-2026 (Santiago: "le doy click a los botones y no abre nada… se me crearon como 10 actividades, solo me di cuenta cuando
  // bajé… y no pregunta en qué año se crea el nuevo ingreso o gasto: los está creando todos en 2027 por defecto"). Cada botón abre un
  // formulario corto ahí mismo, que pregunta el año; el hito se crea solo al tocar «Agregar», la página baja hasta él y se resalta.
  const [borrador, setBorrador] = useState(null); // { k: "ingresos" | "gastos" | "activos", x }
  const [recien, setRecien] = useState(null);
  const [enfocar, setEnfocar] = useState(null);
  useEffect(() => {
    if (!enfocar) return undefined;
    const t = setTimeout(() => {
      const el = typeof document !== "undefined" ? document.getElementById("f10-hito-" + enfocar.replace(/[^a-z0-9]/gi, "-")) : null;
      if (el) try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { el.scrollIntoView(); }
      setEnfocar(null);
    }, 80);
    return () => clearTimeout(t);
  }, [enfocar]);
  useEffect(() => { if (!recien) return undefined; const t = setTimeout(() => setRecien(null), 5000); return () => clearTimeout(t); }, [recien]);
  // Los hitos que quedaron vacíos (sin nombre ni monto, por ejemplo de tocar varias veces un botón) se quitan solos al entrar.
  useEffect(() => {
    const sinNombre = (x) => !String((x && x.nombre) || "").trim();
    const vI = (x) => x && sinNombre(x) && !(Number(x.mensual) > 0);
    const vG = (x) => x && sinNombre(x) && !(Number(x.anual) > 0);
    const vA = (x) => x && sinNombre(x) && !(Number(x.valor) > 0) && !(Number(x.cuotaInicial) > 0) && !x.desglose && !(Array.isArray(x.pagos) && x.pagos.length);
    const gs = f.gastos || [];
    if (f.ingresos.some(vI) || gs.some(vG) || f.activos.some(vA)) set("futuros", { ...f, ingresos: f.ingresos.filter((x) => !vI(x)), gastos: gs.filter((x) => !vG(x)), activos: f.activos.filter((x) => !vA(x)) });
    // Solo al entrar al paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    g.aportes.forEach((x) => pon(anio, { key: "p1a" + x.id, paso1: true, nombre: x.nombre, que: tx("inviertes más", "you invest more"), capital: -x.monto, capTxt: tx("pones", "you put in") }));
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
  const BORRADOR = {
    ingresos: { nombre: "", mensual: "", desde: "", hasta: "" },
    gastos: { nombre: "", anual: "", desde: "", anios: "", periodo: "año" },
    activos: { nombre: "", clase: "vivienda", valor: "", cuotaInicial: "", anioCuota: "", entrega: "", rentaMensual: "", rentaDesde: "", fuentes: [] },
  };
  const abrirBorrador = (k) => { setDeudaNueva(null); setAbierto(null); setBorrador((b) => (b && b.k === k ? null : { k, x: { ...BORRADOR[k] } })); };
  const upB = (v) => setBorrador((b) => (b ? { ...b, x: { ...b.x, ...v } } : b));
  const agregarBorrador = () => {
    if (!borrador) return;
    const { k, x } = borrador, arr = k === "gastos" ? (f.gastos || []) : f[k];
    const y = Number(k === "activos" ? x.entrega : x.desde) || 0; if (!y) return;
    put(k, [...arr, k === "activos" ? { ...x, entrega: y, anioCuota: y } : { ...x, desde: y }]);
    const clave = (k === "ingresos" ? "i:" : k === "gastos" ? "g:" : "a:") + arr.length;
    setBorrador(null); setRecien(clave); setEnfocar(clave);
  };
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
      {(() => { const dd = rentasDuplicadas(cfg, activos).find((y) => y.k === i); return dd && aviso(dd.seguro ? tx(`Esta renta ya está en lo que inviertes en ${dd.activo} (${plata(dd.contada)} al mes): se cuenta una sola vez, la de allá.`, `This income is already in what you add to ${dd.activo} (${plata(dd.contada)} a month): counted once, from there.`) : tx(`¿Es la misma renta de ${dd.activo} (${plata(dd.contada)} al mes)? Mientras no lo confirmes, se suman las dos.`, `Is this the same ${dd.activo} income (${plata(dd.contada)} a month)? Until you confirm, both are added.`),
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
    {(Number(x.anual) || 0) > 0 && <div style={{ fontSize: 12, color: C.am }}>{tx(`Sale ${plata(Math.round(Number(x.anual) / 12))} al mes (${plata(Number(x.anual))} al año) desde ${anioCal(Math.max(1, Number(x.desde) || 1))}${n ? `, durante ${enAnios(n)}` : ", siempre"}. Sube cada año como tus ingresos y gastos (${fmtPctEs(esc.indexacionPct ?? indexacionDefaultPct(SUP))} al año).`, `${plata(Math.round(Number(x.anual) / 12))} a month (${plata(Number(x.anual))} a year) from ${anioCal(Math.max(1, Number(x.desde) || 1))}${n ? `, for ${enAnios(n)}` : ", ongoing"}. It rises every year like your income and expenses (${fmtPctEs(esc.indexacionPct ?? indexacionDefaultPct(SUP))} a year).`)}</div>}
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
      <div style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>{tx("¿Qué viene en tus próximos 10 años?", "What's coming in your next 10 years?")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 8, marginBottom: 14 }}>
        {[[tx("+ Ingreso que empieza", "+ Income that starts"), tx("Pensión, sueldo, honorarios", "Pension, salary, fees"), () => abrirBorrador("ingresos"), borrador && borrador.k === "ingresos"],
          [tx("+ Gasto que empieza", "+ Expense that starts"), tx("Universidad, aportes a pensión", "College, pension contributions"), () => abrirBorrador("gastos"), borrador && borrador.k === "gastos"],
          [tx("+ Compra o construcción", "+ Purchase or build"), tx("Tu casa, un local, un lote", "Your home, a storefront, a lot"), () => abrirBorrador("activos"), borrador && borrador.k === "activos"],
          [tx("+ Pago de una deuda", "+ Paying off a debt"), tx("El saldo de un local, una hipoteca", "A property balance, a mortgage"), () => { setBorrador(null); setDeudaNueva(deudaNueva ? null : { id: (deudasLibres[0] || {}).id || "", anio: 2 }); }, !!deudaNueva],
        ].map(([l, ej, on, activo], k) => <button key={k} type="button" aria-expanded={!!activo} onClick={on} style={{ ...btnAccion(!!activo), textAlign: "left", display: "grid", gap: 2 }}><span>{l}</span><span style={{ fontSize: 12, fontWeight: 400, color: activo ? "rgba(0,0,0,0.7)" : C.tx2 }}>{ej}</span></button>)}
      </div>
      {borrador && (() => {
        const { k, x } = borrador, anioK = k === "activos" ? "entrega" : "desde", y = Number(x[anioK]) || 0;
        const monto = Number(k === "ingresos" ? x.mensual : k === "gastos" ? x.anual : x.valor) || 0;
        const listo = y > 0 && (!!String(x.nombre || "").trim() || monto > 0);
        const mesG = x.periodo === "mes";
        const selY = (v, on) => <select style={inp} value={v || ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}><option value="">{tx("Elige el año", "Choose the year")}</option>{ANIOS.map((a) => <option key={a} value={a}>{a === 1 ? tx(`Hoy (${anioCal(1)})`, `Today (${anioCal(1)})`) : anioCal(a)}</option>)}</select>;
        const titulo = k === "ingresos" ? tx("Ingreso que empieza", "Income that starts") : k === "gastos" ? tx("Gasto que empieza", "Expense that starts") : tx("Compra o construcción", "Purchase or build");
        const pesosHoy = esUS() ? tx("dólares de hoy", "today's dollars") : tx("pesos de hoy", "today's pesos");
        return <div style={{ background: C.bg, border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{titulo}</div>
          <div style={fila4}>
            {k === "activos" && campo(tx("¿Qué es?", "What is it?"), <select style={inp} value={x.clase} onChange={(e) => upB({ clase: e.target.value })}><option value="vivienda">{tx("Casa para vivir", "Home to live in")}</option><option value="inmueble">{tx("Inmueble para rentar", "Rental property")}</option><option value="lote">{tx("Lote", "Lot")}</option><option value="negocio">{tx("Negocio", "Business")}</option><option value="otro">{tx("Otro", "Other")}</option></select>)}
            {campo(tx("Nombre", "Name"), <input style={inp} autoFocus value={x.nombre} placeholder={k === "ingresos" ? tx("Ej.: pensión", "e.g. pension") : k === "gastos" ? tx("Ej.: universidad de los hijos", "e.g. kids' college") : tx("Ej.: casa finca", "e.g. lake house")} onChange={(e) => upB({ nombre: e.target.value })} />)}
            {k === "ingresos" && campo(tx(`¿Cuánto al mes? ($, ${pesosHoy})`, `How much a month? ($, ${pesosHoy})`), <NumberInput style={inp} value={x.mensual} onChange={(v) => upB({ mensual: v })} />)}
            {k === "gastos" && campo(tx(`¿Cuánto? ($, ${pesosHoy})`, `How much? ($, ${pesosHoy})`), <div style={{ display: "flex", gap: 6 }}>
              <NumberInput style={{ ...inp, flex: 1, minWidth: 0 }} value={mesG ? (vacio(x.anual) ? "" : Math.round((Number(x.anual) || 0) / 12)) : x.anual} onChange={(v) => upB({ anual: mesG ? (vacio(v) ? "" : (Number(v) || 0) * 12) : v })} />
              <select aria-label={tx("Al mes o al año", "Monthly or yearly")} style={{ ...inp, width: "auto" }} value={x.periodo} onChange={(e) => upB({ periodo: e.target.value })}><option value="año">{tx("al año", "yearly")}</option><option value="mes">{tx("al mes", "monthly")}</option></select>
            </div>)}
            {k === "activos" && campo(tx("Presupuesto ($)", "Budget ($)"), <NumberInput style={inp} value={x.valor} onChange={(v) => upB({ valor: v })} />)}
            {campo(k === "activos" ? tx("¿En qué año está lista?", "What year is it ready?") : tx("¿En qué año empieza?", "What year does it start?"), selY(y, (v) => upB(k === "ingresos" && Number(x.hasta) && Number(x.hasta) < v ? { [anioK]: v, hasta: v } : { [anioK]: v })))}
            {k === "ingresos" && campo(tx("¿Hasta cuándo?", "Until when?"), <select style={inp} value={vacio(x.hasta) ? "" : x.hasta} onChange={(e) => upB({ hasta: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Sigue siempre", "Ongoing")}</option>{ANIOS.filter((a) => a >= (y || 1)).map((a) => <option key={a} value={a}>{tx(`Hasta ${anioCal(a)}`, `Until ${anioCal(a)}`)}</option>)}</select>)}
            {k === "gastos" && campo(tx("¿Cuántos años?", "For how many years?"), <select style={inp} value={vacio(x.anios) ? "" : x.anios} onChange={(e) => upB({ anios: e.target.value === "" ? "" : Number(e.target.value) })}><option value="">{tx("Siempre", "Ongoing")}</option>{ANIOS.map((a) => <option key={a} value={a}>{enAnios(a)}</option>)}</select>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={!listo} onClick={agregarBorrador} style={{ ...btn(listo), padding: "8px 14px", opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "not-allowed" }}>{tx("Agregar", "Add")}</button>
            <button type="button" onClick={() => setBorrador(null)} style={{ ...btn(false), padding: "8px 14px" }}>{tx("Cancelar", "Cancel")}</button>
            {!listo && <span style={{ fontSize: 12, color: C.tx2 }}>{!y ? tx("Elige el año para agregarlo.", "Choose the year to add it.") : tx("Ponle un nombre o un monto.", "Add a name or an amount.")}</span>}
            {listo && k !== "activos" && <span style={{ fontSize: 12, color: C.tx2 }}>{tx("Lo demás (si sale de un activo, el titular) lo completas con «Editar».", "The rest (whether it comes from an asset, the owner) you complete with \"Edit\".")}</span>}
            {listo && k === "activos" && <span style={{ fontSize: 12, color: C.tx2 }}>{tx("La cuota inicial, la renta y de dónde sale la plata los completas con «Editar».", "Down payment, rent and where the money comes from you complete with \"Edit\".")}</span>}
          </div>
        </div>;
      })()}
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
            {hs.map((h) => <div key={h.key} id={"f10-hito-" + h.key.replace(/[^a-z0-9]/gi, "-")} style={recien && (h.key === recien || h.key.startsWith(recien + ":")) ? { background: "rgba(0,200,5,0.10)", borderRadius: 8, transition: "background .4s" } : undefined}>
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
                  : editable(h) ? <button type="button" style={{ ...btn(abierto === h.key), padding: "6px 12px", flex: "0 0 auto" }} onClick={() => abrir(h.key)}>{abierto === h.key ? tx("Listo", "Done") : tx("Editar", "Edit")}</button>
                    : <span style={{ width: 64 }} />}
              </div>
              {/* 24-nov-2026 (Santiago: "sí funciona; lo que pasa es que uno no ve que se creó"). El formulario abierto se ve enmarcado. */}
              {abierto === h.key && <div style={{ border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", margin: "8px 0" }}>{formDe(h.key)}</div>}
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

// 24-nov-2026 (Santiago: "sea coherente: si la sección dos tiene número 2 en el título, lo mismo debería pasar en la sección 1").
// Los cinco pasos llevan su número en el título, igual.
function NumPaso({ n }) {
  return <span aria-hidden="true" style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 999, background: "rgba(0,200,5,0.15)", color: C.gn, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{n}</span>;
}
function TituloPaso({ n, children }) {
  return <h2 style={{ ...TIPO.seccion, display: "flex", alignItems: "center", gap: 10 }}><NumPaso n={n} /><span style={{ minWidth: 0 }}>{children}</span></h2>;
}
const SUB_PASO = { ...TIPO.sub, paddingLeft: 38 };
function Seccion({ n, titulo, sub }) {
  return <div style={{ marginBottom: 10 }}><TituloPaso n={n}>{titulo}</TituloPaso>{sub && <div style={SUB_PASO}>{sub}</div>}</div>;
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
// 24-nov-2026 (Santiago: "invierto 600 MM y pone 624 MM"; "Te pasaste $1"). Lo que queda por usar en un año, guardado en pesos de hoy
// (como guarda el plan sus montos) para que en pesos de ese año dé los pesos enteros que caben, sin pasarse.
export function montoHoyQueCabe(cuenta, anio) {
  const g = (cuenta || []).find((y) => y.anio === anio) || {}, f = g.factorHoy || 1;
  return Math.floor(Math.max(0, g.porInvertir || 0)) / f;
}
function BotonSaldo({ disponible, actual = 0, anio, on }) {
  if (!(disponible > 0.5) || Math.floor(disponible) === Math.round(actual)) return null;
  // 24-nov-2026 (Santiago: "Te pasaste $1"). Hacia abajo: al volver a pesos del año, redondear hacia arriba te pasaba por un peso.
  return <button type="button" onClick={() => on(Math.floor(disponible))} style={{ justifySelf: "start", background: "rgba(0,200,5,0.08)", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "4px 10px", color: C.gn, fontSize: 12.5, cursor: "pointer", textAlign: "left", fontVariantNumeric: "tabular-nums" }}>
    {anio === 1 ? tx(`Usar saldo pendiente de hoy: ${plata(Math.floor(disponible))}`, `Use today's remaining balance: ${plata(Math.floor(disponible))}`) : tx(`Usar lo que queda en ${anioCal(anio)}: ${plata(Math.floor(disponible))}`, `Use what's left in ${anioCal(anio)}: ${plata(Math.floor(disponible))}`)}
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
    <ResumenAporte det={det} esInm={esInm} vendidos={vendidos} />
  </>);
}

// Lo que queda valiendo, lo que rinde, lo que te llega y con qué se paga un aporte.
function ResumenAporte({ det, esInm, vendidos = [] }) {
  if (!det || !(det.aporte > 0 || det.rentaMensual > 0 || det.rindeAnual > 0)) return null;
  const pct = (v) => fmtPctEs(v, 1);
  return <div style={{ marginTop: 8, background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
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
  </div>;
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
// 24-nov-2026 (Santiago: "esto no funciona bien: no muestra las otras inversiones, como fondos"). Para meterle a algo en un año,
// además de lo que ya podías: lo que ya tiene un aporte este año y lo que creas este mismo año. Elegirlos abre su fila para cambiar
// el monto, en vez de esconderlos.
// 24-nov-2026 (Santiago: "en la lista de poder invertir en inversiones actuales no me sale IBKR… deberían salir todas").
// Salen todas: lo que ya recibe plata este año (también lo creado en el plan en un año anterior), y al final, sin poder
// elegirse, lo que ya no tienes ese año con el porqué (se vendió, se acabó o lo retiraste). Solo se quedan fuera los vehículos.
// 24-nov-2026 (Santiago: "¿qué es eso de ya le metes este año? eso no se entiende"; "¿la creas este año? eso enreda… aparece si se crea, si
// no, no"). La nota dice cuánto ya inviertes ahí ese año, y lo creado ese año solo sale si ya tiene monto.
export function opcionesParaMeter(r, cfg = {}, anio = 1, montos = {}) {
  const base = activosParaAportar(r, cfg, anio).map((a) => ({ ...a }));
  const lib = (r.liberados || []).filter((l) => l && l.anio <= anio);
  const fuera = new Set(lib.filter((l) => !String(l.id).endsWith("_retiro")).map((l) => l.id));
  const retiradas = new Set(lib.filter((l) => String(l.id).endsWith("_retiro") && !l.parcial).map((l) => String(l.id).replace(/_retiro$/, "")));
  const yaRef = {};
  (cfg.reinversiones || []).forEach((x, k) => { if (x && Math.max(1, Number(x.anio) || 1) === anio) yaRef[x.activoId] = "r" + k; });
  const montoDe = (ref) => { const m = Number(montos[ref]); if (m > 0.5) return m; const [t, i] = [String(ref)[0], Number(String(ref).slice(1))]; const x = (t === "r" ? cfg.reinversiones : cfg.nuevas || [])[i]; return Number(x && x.monto) || 0; };
  // Sin monto, no hay nada que decir: sale como cualquier otra y al elegirla se abre su fila para ponerle el monto.
  const nota = (ref) => { const m = montoDe(ref); return m > 0.5 ? tx(`ya inviertes ${plata(Math.round(m))} este año`, `already investing ${plata(Math.round(m))} this year`) : undefined; };
  const conAporte = (r.activos || []).filter((a) => a && a.clase !== "vehiculo" && !fuera.has(a.id) && yaRef[a.id]).map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, abrir: yaRef[a.id], nota: nota(yaRef[a.id]) }));
  const planConAporte = (r.nuevasDetalle || []).filter((x) => x && String(x.id || "").startsWith("nueva_") && !x.pr && (x.anio || 1) < anio && yaRef[x.id] && !retiradas.has(x.id))
    .map((x) => ({ id: x.id, nombre: x.nombre, clase: "nueva", delPlan: true, anio: x.anio || 1, abrir: yaRef[x.id], nota: nota(yaRef[x.id]) }));
  const anioDe = (id) => (lib.find((l) => l.id === id) || {}).anio;
  const yaNo = [
    ...(r.vendidos || []).filter((v) => v && v.clase !== "vehiculo").map((v) => ({ id: "no_" + v.id, nombre: v.nombre, noDisp: true, nota: tx("la vendes hoy", "you sell it today") })),
    ...(r.activos || []).filter((a) => a && a.clase !== "vehiculo" && fuera.has(a.id)).map((a) => ({ id: "no_" + a.id, nombre: a.nombre, noDisp: true,
      nota: a.clase === "inmueble" ? tx(`se vende en ${anioCal(anioDe(a.id))}`, `sold in ${anioCal(anioDe(a.id))}`) : tx(`se acaba en ${anioCal(anioDe(a.id))}`, `ends in ${anioCal(anioDe(a.id))}`) })),
    ...(r.nuevasDetalle || []).filter((x) => x && retiradas.has(x.id)).map((x) => ({ id: "no_" + x.id, nombre: x.nombre, noDisp: true, nota: tx(`la retiras en ${anioCal(anioDe(x.id + "_retiro"))}`, `withdrawn in ${anioCal(anioDe(x.id + "_retiro"))}`) })),
  ];
  const delAnio = (cfg.nuevas || []).map((x, k) => [x, k]).filter(([x, k]) => x && x.preset !== "_fuera" && !(x.preset === "fincaRaiz" && x.pr) && Math.max(1, Number(x.anio) || 1) === anio && montoDe("n" + k) > 0.5)
    .map(([x, k]) => { const d = (r.nuevasDetalle || []).find((y) => y.id === "nueva_" + k); return { id: "nueva_" + k, nombre: (d && d.nombre) || x.nombre || tx("Inversión nueva", "New investment"), clase: "nueva", delPlan: true, abrir: "n" + k, nota: nota("n" + k) }; });
  // En el mismo orden en que los tienes: el que ya recibe plata no se va al final.
  const orden = new Map([...(r.activos || []).map((a) => a && a.id), ...(r.nuevasDetalle || []).map((x) => x && x.id)].map((id, k) => [id, k]));
  const enOrden = [...base, ...conAporte, ...planConAporte].sort((a, b) => (orden.get(a.id) ?? 1e9) - (orden.get(b.id) ?? 1e9));
  return [...enOrden, ...delAnio, ...yaNo];
}
// Las opciones del selector, en dos grupos: lo que ya tenías y lo que creaste en el plan.
function OpcionesAportar({ libres }) {
  const yaNo = libres.filter((a) => a.noDisp), disp = libres.filter((a) => !a.noDisp);
  const propios = disp.filter((a) => !a.delPlan), delPlan = disp.filter((a) => a.delPlan);
  const etq = (a) => (a.nota ? `${a.nombre} · ${a.nota}` : a.delPlan && a.anio ? `${a.nombre} (${tx("desde", "since")} ${anioCal(a.anio)})` : a.nombre);
  const op = (a) => <option key={a.id} value={a.id} disabled={!!a.noDisp}>{etq(a)}</option>;
  if (!delPlan.length && !yaNo.length) return propios.map(op);
  return <>
    {propios.length > 0 && <optgroup label={tx("Lo que ya tenías", "What you already had")}>{propios.map(op)}</optgroup>}
    {delPlan.length > 0 && <optgroup label={tx("Lo que creaste en el plan", "What you created in the plan")}>{delPlan.map(op)}</optgroup>}
    {yaNo.length > 0 && <optgroup label={tx("Ya no lo tienes ese año", "No longer yours that year")}>{yaNo.map(op)}</optgroup>}
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
// Un renglón de la cuenta: texto a la izquierda, cifra a la derecha (tabular).
function Renglon({ l, v, signo = "", col, fuerte, nota, linea }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 0", fontSize: fuerte ? 15 : 14, fontWeight: fuerte ? 600 : 400, borderTop: linea ? `1px solid ${C.bd}` : "none", marginTop: linea ? 4 : 0 }}>
    <span style={{ color: fuerte ? C.tx : C.tx2, minWidth: 0, lineHeight: 1.4 }}>{l}{nota && <span style={{ display: "block", fontSize: 12, color: C.tx2, fontWeight: 400 }}>{nota}</span>}</span>
    <span style={{ color: col || C.tx, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signo}{plata(Math.round(Math.abs(v)))}</span>
  </div>;
}
const Etq = ({ children }) => <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, margin: "18px 0 6px" }}>{children}</div>;
// Al mes y al año, lado a lado (Santiago: "ver cómo me queda el año mensual y anual").
function MesAnio({ filas, cabecera = true }) {
  const celda = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", columnGap: 14, rowGap: 6, fontSize: 14, alignItems: "baseline" }}>
    {cabecera && <><span /><span style={{ ...celda, fontSize: 12, color: C.tx2 }}>{tx("al mes", "a month")}</span><span style={{ ...celda, fontSize: 12, color: C.tx2 }}>{tx("al año", "a year")}</span></>}
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
    (r.deudas || []).filter((d) => d.finPorCuota && !d.finAbono && d.finNatural === anio && d.cuotaMes > 0.5).forEach((d) => out.push({ nombre: tx(`Cuota de ${d.nombre}`, `${d.nombre} payment`), mes: d.cuotaMes, que: tx("terminas de pagarla", "paid off") }));
    (r.deudas || []).filter((d) => d.finAbono && d.finAbono + 1 === anio && d.cuotaMes > 0.5).forEach((d) => out.push({ nombre: tx(`Cuota de ${d.nombre}`, `${d.nombre} payment`), mes: d.cuotaMes, ahorro: true, que: tx("ya no la pagas: la terminaste con tus abonos", "no longer paid: finished with your extra payments") }));
  }
  // 24-nov-2026 (Santiago: "me sale como si ya estuviera ahorrando cosas de la propiedad que se vende en 2027"). Se dice por qué se acaba
  // cada cosa (la venta de un activo, la fecha de fin de su página o el paso 1) y un gasto que deja de salir se lee como ahorro, no con «+».
  const porque = (x, pag) => (x.conVentaDe ? tx(`se va con la venta de ${x.conVentaDe}`, `goes with the sale of ${x.conVentaDe}`) : x.origen === "datos" ? tx(`su fecha de fin está en ${pag}`, `its end date is on ${pag === "Ingresos" ? "Income" : "Expenses"}`) : tx("lo marcaste en el paso 1", "you marked it in step 1"));
  (r.ingSeVan || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: -x.mensual, que: tx(`se acaba: ${porque(x, "Ingresos")}`, `stops: ${porque(x, "Ingresos")}`) }));
  (cfg.nuevas || []).forEach((x, k) => { const p = x && x.pagaAnios ? x.pagaAnios[anio] : null; if (p == null || p === "") return; const a = (foto.porActivo || []).find((y) => y.id === "nueva_" + k); out.push({ nombre: (a && a.nombre) || x.nombre || tx("Tu inversión", "Your investment"), mes: a && a.renta > 0.5 ? a.renta / 12 : null, que: tx(`te paga el ${p} % de lo que rinde, solo este año`, `pays you ${p}% of what it earns, this year only`), quitarPaga: { k, anio } }); });
  (r.seVan || []).filter((x) => x.desde === anio).forEach((x) => out.push({ nombre: x.nombre, mes: x.mensual, ahorro: true, que: tx(`ya no lo pagas: ${porque(x, "Egresos")}`, `no longer paid: ${porque(x, "Egresos")}`) }));
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
        <span style={{ fontSize: 13, fontWeight: 600 }}>{tx("Cuesta", "It costs")} <span style={{ fontWeight: 400, fontSize: 12, color: C.tx2 }}>{tx("(pesos de hoy; en cada año se paga con la inflación)", "(today's money; each year it's paid with inflation)")}</span></span>
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

// 24-nov-2026 (Santiago: "hoy tengo 800 MM para invertir, elegí invertir en algo que ya tengo, y uno no sabe
// si guardó o no, y sigue viendo 800 MM disponibles"). Cada movida se edita en su fila, dentro de la cascada:
// lo básico aquí (cuánto, en qué, cuánto rinde y cuánto te llega) y lo poco usado en su tarjeta de abajo.
// 24-nov-2026 (Santiago: "este botón de más opciones no está habilitado"). «Más opciones» abría otro panel más arriba, fuera
// de la vista, y parecía no hacer nada. Ahora las opciones de más se abren aquí mismo, debajo del formulario corto, y la
// propiedad raíz trae todo su formulario en su fila. Si la pasas a otro año, la vista se va con ella y queda abierta allá.
export function MovidaEditor({ r, cfg, set, refMov, anio, esc, quedaHoy = 0, factor = 1, onAnio, onListo }) {
  const [verMas, setVerMas] = useState(false);
  const SUP = supuestosF10();
  const t = String(refMov)[0], k = Number(String(refMov).slice(1));
  const lbl = { fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0, alignContent: "start" };
  const fila4 = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,160px),1fr))", gap: 10, alignItems: "start" };
  // Las opciones de más guardan su ancho de columna (un solo campo no se estira a todo el ancho).
  const filaMas = { ...fila4, gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,200px),1fr))" };
  const ayuda = { fontSize: 12, color: C.tx2, lineHeight: 1.35 };
  // 24-nov-2026 (Santiago: "invierto 600 MM y pone 624 MM"). Lo que escribes para un año va en pesos de ese año: es la cifra que
  // ves en su cuenta. El plan lo sigue guardando en pesos de hoy (÷ factor), así que lo que ya estaba escrito no cambia de valor.
  const f = anio > 1 ? factor || 1 : 1;
  const enHoy = anio > 1 ? tx(` (pesos de ${anioCal(anio)})`, ` (${anioCal(anio)} money)`) : "";
  const verAnio = (vHoy) => (vHoy === "" || vHoy == null ? "" : Math.round(Number(vHoy) * f));
  const guardarHoy = (vAnio) => (vAnio === "" || vAnio == null ? "" : Number(vAnio) / f);
  const pie = (quitar, conMas) => <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
    {conMas && <button type="button" aria-expanded={verMas} onClick={() => setVerMas(!verMas)} style={{ background: "transparent", border: "none", padding: 0, color: verMas ? C.gn : C.tx2, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", marginRight: "auto" }}>{verMas ? tx("Menos opciones", "Fewer options") : tx("Más opciones", "More options")}</button>}
    <button type="button" style={{ ...btn(false), padding: "6px 12px", marginLeft: conMas ? 0 : "auto" }} onClick={() => { quitar(); onListo && onListo(); }}>{tx("Quitar", "Remove")}</button>
    <button type="button" style={{ ...btn(true), padding: "6px 12px" }} onClick={onListo}>{tx("Listo", "Done")}</button>
  </div>;
  const caja = (hijos) => <div style={{ background: C.bg2, border: `1px solid ${C.gn}`, borderRadius: 10, padding: 12, margin: "4px 0 8px", display: "grid", gap: 10 }}>{hijos}</div>;
  const masCaja = (hijos) => <div style={{ display: "grid", gap: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>{hijos}</div>;
  // Otro año: en un año siguiente sale del saldo de ese año (salvo plata nueva de afuera).
  const moverA = (x, up, a2) => { up({ anio: a2, ...(a2 > 1 && x.fuente !== "nuevo" ? { fuente: "liquidez" } : {}) }); if (a2 !== anio && onAnio) onAnio(a2); };
  const selAnio = (x, up, l = tx("¿Cuándo?", "When?")) => <label style={lbl}>{l}<select style={inp} value={Math.max(1, Number(x.anio) || 1)} onChange={(e) => moverA(x, up, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>;
  const selFuente = (x, up) => anio === 1 && <label style={lbl}>{tx("¿De dónde sale?", "Where does it come from?")}<FuenteSel value={x.fuente} on={(v) => up({ fuente: v })} /></label>;
  const saldo = (actual, on) => <BotonSaldo disponible={Math.max(0, (quedaHoy + actual) * f)} actual={actual * f} anio={anio} on={(vAnio) => on(guardarHoy(vAnio))} />;
  if (t === "n") {
    const x = (cfg.nuevas || [])[k]; if (!x) return null;
    const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => (j === k ? { ...y, ...v } : y)));
    const quitar = () => set("nuevas", cfg.nuevas.filter((_, j) => j !== k));
    // 24-nov-2026 (Santiago: "quiero hacer una inversión nueva y podría ser propiedad raíz: no le veo las opciones").
    const selEnQue = <select style={inp} value={x.preset} onChange={(e) => { const v = e.target.value; if (v === "fincaRaiz") { up({ preset: "fincaRaiz", pr: x.pr || { tipo: "planos", final: "vende", cuotaPct: 30, plazo: 2, valEntregaPct: 20, valAnualPct: 6, ...(Number(x.monto) > 0 ? { valor: Number(x.monto) } : {}) } }); return; } up({ preset: v }); }}>{Object.entries(SUP.presets).map(([key, pz]) => <option key={key} value={key}>{nombreSup(pz)}</option>)}<option value="custom">{tx("Otra (personalizada)", "Other (custom)")}</option></select>;
    if (x.preset === "fincaRaiz" && x.pr) {
      // Su formulario completo, aquí mismo: modalidad, pagos, entrega y si se queda, se vende o se repite.
      const capital = leerPropiedadRaiz(x, 10).capital;
      const upPR = (v) => { if (v.anio != null && Number(v.anio) !== Math.max(1, Number(x.anio) || 1)) { moverA(x, up, Number(v.anio)); return; } up(v); };
      return caja(<>
        <div style={fila4}>
          <label style={lbl}>{tx("¿En qué?", "In what?")}{selEnQue}</label>
          <label style={lbl}>{tx("Nombre (opcional)", "Name (optional)")}<input style={inp} value={x.nombre || ""} placeholder={tx("Ej.: proyecto, constructora", "e.g. project, developer")} onChange={(e) => up({ nombre: e.target.value })} /></label>
          {selFuente(x, up)}
        </div>
        {anio !== Math.max(1, Number(x.anio) || 1) && <div style={{ fontSize: 12.5, color: C.tx, lineHeight: 1.45 }}>{tx(`Es otra vuelta del proyecto que empieza en ${anioCal(Math.max(1, Number(x.anio) || 1))}. Lo que cambies aquí cambia todas sus vueltas, y «Quitar» lo quita completo del plan.`, `This is another round of the project that starts in ${anioCal(Math.max(1, Number(x.anio) || 1))}. Changes here apply to every round, and "Remove" removes it from the whole plan.`)}</div>}
        <PropiedadRaiz x={x} up={upPR} usarSaldo={saldo(capital, (v) => up({ pr: { ...x.pr, valor: v } }))} />
        {pie(quitar, false)}
      </>);
    }
    const esCustom = x.preset === "custom";
    const hint = rendimientoHintPct(esc);
    const supPct = esCustom ? hint : SUP.presets[x.preset] ? retornoNominalPreset(x.preset, esc, SUP) : hint;
    const rend = vacio(x.rendimientoNomPct) ? supPct : Number(x.rendimientoNomPct);
    const pRec = (x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)) / 100;
    const mes = (Number(x.monto) || 0) * rend / 100 * pRec / 12;
    const inicio = Math.max(1, Number(x.anio) || 1), hasta = Number(x.hasta) > inicio ? Number(x.hasta) : 0;
    return caja(<>
      <div style={fila4}>
        <label style={lbl}>{tx("¿En qué?", "In what?")}{selEnQue}</label>
        <label style={lbl}>{esCustom ? tx("Nombre", "Name") : tx("Entidad (opcional)", "Institution (optional)")}<input style={inp} value={x.nombre || ""} placeholder={esUS() ? tx("Ej.: Vanguard", "e.g. Vanguard") : tx("Ej.: BTG, Skandia", "e.g. BTG, Skandia")} onChange={(e) => up({ nombre: e.target.value })} /></label>
        <label style={lbl}>{tx(`¿Cuánto?${enHoy}`, `How much?${enHoy}`)}<NumberInput style={inp} value={verAnio(x.monto)} onChange={(v) => up({ monto: guardarHoy(v) })} />{saldo(Number(x.monto) || 0, (v) => up({ monto: v }))}</label>
        <label style={lbl}>{tx("Rendimiento anual (%)", "Annual return (%)")}<InputDecimalEs style={inp} placeholder={fmtPctEs(supPct, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} /></label>
        <label style={lbl}>{tx("¿Cuánto te llega?", "How much do you receive?")}<select style={inp} value={x.pctRecibe ?? (x.tipo === "renta" ? 100 : 0)} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{partesF10().map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><span style={{ fontSize: 12, color: mes > 0 ? C.gn : C.tx2 }}>{mes > 0 ? tx(`${plata(Math.round(mes))} al mes`, `${plata(Math.round(mes))} a month`) : tx("Se reinvierte todo", "All reinvested")}</span></label>
      </div>
      {verMas && masCaja(<div style={filaMas}>
        {selAnio(x, up)}
        {selFuente(x, up)}
        <label style={lbl}>{tx("¿Hasta cuándo?", "Until when?")}<select style={inp} value={hasta || ""} onChange={(e) => up({ hasta: e.target.value ? Number(e.target.value) : "" })}><option value="">{tx("Indefinida", "Ongoing")}</option>{ANIOS.filter((y) => y > inicio).map((y) => <option key={y} value={y}>{tx(`Hasta ${anioCal(y)}`, `Until ${anioCal(y)}`)}</option>)}</select>{hasta > 0 && <span style={ayuda}>{tx(`En ${anioCal(hasta)} la sacas y entra a tu capital de ese año.`, `In ${anioCal(hasta)} you take it out and it joins that year's capital.`)}</span>}</label>
        {hasta > 0 && <label style={lbl}>{tx(`En ${anioCal(hasta)} retiras`, `In ${anioCal(hasta)} you withdraw`)}<select style={inp} value={x.retiraParte ? "parte" : "todo"} onChange={(e) => up({ retiraParte: e.target.value === "parte" })}><option value="todo">{tx("Todo", "Everything")}</option><option value="parte">{tx("Una parte", "Part of it")}</option></select></label>}
        {hasta > 0 && x.retiraParte && <label style={lbl}>{tx("¿Cuánto retiras? ($)", "How much do you withdraw? ($)")}<NumberInput style={inp} placeholder={tx("Monto", "Amount")} value={x.retira ?? ""} onChange={(v) => up({ retira: v })} /></label>}
        {esCustom && !esUS() && <label style={lbl}>{tx("Moneda", "Currency")}<select style={inp} value={x.moneda || monedaBase()} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>{x.moneda === "USD" && <span style={{ ...ayuda, color: C.am }}>{tx("El resultado en pesos depende también de la tasa de cambio.", "The peso result also depends on the exchange rate.")}</span>}</label>}
      </div>)}
      {pie(quitar, true)}
    </>);
  }
  const x = (cfg.reinversiones || [])[k]; if (!x) return null;
  const up = (v) => set("reinversiones", cfg.reinversiones.map((y, j) => (j === k ? { ...y, ...v } : y)));
  const quitar = () => set("reinversiones", cfg.reinversiones.filter((_, j) => j !== k));
  const a = (r.activos || []).find((y) => y.id === x.activoId) || delPlanDe(r, x.activoId) || {};
  const det = (r.reinversionesDetalle || []).find((y) => y.i === k);
  const esInm = a.clase === "inmueble";
  const desdeMes = Number(x.rentaDesdeMes) || 0;
  const pct = (v) => fmtPctEs(v, 1);
  return caja(<>
    <div style={fila4}>
      <label style={lbl}>{tx(`¿Cuánto inviertes?${enHoy}`, `How much do you invest?${enHoy}`)}<NumberInput style={inp} value={verAnio(x.monto)} onChange={(v) => up({ monto: guardarHoy(v) })} />{saldo(Number(x.monto) || 0, (v) => up({ monto: v }))}</label>
      {esInm ? <>
        <label style={lbl}>{tx("¿Va a dar renta? ($ al mes, opcional)", "Will it earn rent? ($ a month, optional)")}<NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>
        {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>{tx("¿Desde cuándo renta?", "Rented out from when?")}<select style={inp} value={desdeMes} onChange={(e) => up({ rentaDesdeMes: Number(e.target.value) })}>{opcionesMes(desdeMes).map((mm) => <option key={mm} value={mm}>{textoMes(mm)}</option>)}</select></label>}
      </> : !a.delPlan && <>
        <label style={lbl}>{tx("¿Cuánto rinde al año? (%)", "Annual return (%)")}<InputDecimalEs style={inp} placeholder={det && det.rendimientoPct != null ? pct(det.rendimientoPct) : ""} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} /></label>
        <label style={lbl}>{tx("De lo que rinde, ¿cuánto te llega?", "Of what it earns, how much do you receive?")}<select style={inp} value={Number(x.pctRecibe) || 0} onChange={(e) => up({ pctRecibe: Number(e.target.value) })}>{partesF10().map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </>}
    </div>
    {a.delPlan && <div style={{ fontSize: 12, color: C.tx2 }}>{tx(`La creaste en el plan en ${anioCal(a.anio)}: lo que inviertes rinde igual que ella.`, `You created it in the plan in ${anioCal(a.anio)}: what you add earns the same.`)}</div>}
    {verMas && !a.delPlan && masCaja(<>
      <div style={filaMas}>
        {selAnio(x, up)}
        {selFuente(x, up)}
        {esInm && <>
          <label style={lbl}>{tx("¿Cuánto queda valiendo al terminar? ($, opcional)", "What is it worth when finished? ($, optional)")}<NumberInput style={inp} placeholder={ejemploMonto(1500000000, 400000)} value={x.valorAlTerminar ?? ""} onChange={(v) => up({ valorAlTerminar: v })} /><span style={ayuda}>{tx("Si con la obra vale más que lo que tenías más lo que inviertes.", "If after the work it's worth more than what you had plus what you invest.")}</span></label>
          <label style={lbl}>{tx("¿Cuánto se valoriza al año? (%)", "Annual appreciation (%)")}<InputDecimalEs style={inp} placeholder={det && det.valorizacionPct != null ? pct(det.valorizacionPct) : ""} value={x.valorizacionNomPct ?? ""} onChange={(v) => up({ valorizacionNomPct: v })} /><span style={ayuda}>{tx("Lo que sube el valor cada año. Si no sabes, déjalo vacío.", "How much the value rises each year. If you're not sure, leave it blank.")}</span></label>
        </>}
      </div>
      <ResumenAporte det={det} esInm={esInm} vendidos={r.vendidos || []} />
    </>)}
    {pie(quitar, !a.delPlan)}
  </>);
}

// 24-nov-2026 (Santiago: "fichas más recogidas, no todo desplegado, para que sea más simple de ver").
// Una ficha: título, una cifra y su contenido; si se puede recoger, recogida muestra un resumen de una línea.
function Ficha({ titulo, sub, cifra, cifraSub, col, abierta = true, onToggle, resumen, fuerte, tam, id, accion, children }) {
  const cabeza = <>
    <div style={{ minWidth: 0 }}>
      <div style={{ ...TIPO.ficha, display: "flex", alignItems: "center", gap: 8 }}>{onToggle && <span aria-hidden="true" style={{ color: C.tx2, fontSize: 12, width: 12 }}>{abierta ? "▾" : "▸"}</span>}{titulo}</div>
      {(abierta ? sub : resumen) && <div style={{ ...TIPO.meta, marginTop: 4 }}>{abierta ? sub : resumen}</div>}
    </div>
    {cifra != null && <div style={{ textAlign: "right", marginLeft: "auto", flex: "0 0 auto" }}>
      <div style={{ fontSize: tam || (fuerte ? 28 : 20), fontWeight: 700, color: col || C.tx, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{cifra}</div>
      {cifraSub && <div style={{ fontSize: 12, color: C.tx2 }}>{cifraSub}</div>}
    </div>}
    {accion && <div style={{ marginLeft: "auto", flex: "0 0 auto" }}>{accion}</div>}
  </>;
  const estiloCabeza = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" };
  return <section id={id} style={{ background: C.bg, border: `1px solid ${fuerte ? C.gn : C.bd}`, borderRadius: 12, padding: "16px 18px", marginTop: 12 }}>
    {onToggle ? <button type="button" aria-expanded={abierta} onClick={onToggle} style={{ ...estiloCabeza, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>{cabeza}</button> : <div style={estiloCabeza}>{cabeza}</div>}
    {abierta && children && <div style={{ marginTop: 10 }}>{children}</div>}
  </section>;
}
const enlace = { background: "transparent", border: "none", padding: 0, color: C.gn, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" };
// Estado de un año: listo (lo dejaste listo y cuadra), con problema (te pasaste o falta plata) o pendiente.
const estadoAnio = (y, cfg) => (y.porInvertir < -1 || y.faltaSinCubrir > 0.5 ? "problema" : (cfg.aniosListos || {})[y.anio] ? "listo" : "pendiente");
// Lo que se reinvierte de lo que sobra: la regla de siempre (D) o la de ese año.
function reglaSobra(r, cfg, anio) {
  const dest = (Array.isArray(cfg.sobraDestinos) ? cfg.sobraDestinos : []).filter((d) => d && d.id && Number(d.pct) > 0);
  const total = Math.min(100, dest.reduce((sm, d) => sm + Number(d.pct), 0));
  const pa = (cfg.sobraPctAnios || {})[anio];
  const pct = pa != null && pa !== "" && total > 0 ? Math.min(100, Math.max(0, Number(pa))) : total;
  const nom = (id) => ((r.fuentes || []).find((f) => f.id === id) || {}).nombre || { c_liquidez: tx("liquidez", "cash"), c_renta: tx("renta fija", "fixed income"), c_crecimiento: tx("crecimiento", "growth"), c_disponible: tx("disponible", "available") }[id] || id;
  return { pct, total, propia: pa != null && pa !== "" && total > 0, destinos: dest.map((d) => nom(d.id)) };
}

function AnioPorAnio({ r, cfg, set, cuenta, anioSel, setAnioSel, nuevaEnAnio, reinvEnAnio, esc, irResultado, dejarListo, irAnio, paneles = {} }) {
  const [abierto, setAbierto] = useState(null);
  // La movida que se está editando en su fila y la recién agregada (se resalta y se confirma).
  const [editMov, setEditMov] = useState(null);
  const [recien, setRecien] = useState(null);
  // Qué está abierto: lo que cambia en tu mes empieza recogido; la opción elegida abre su menú.
  const [verCambios, setVerCambios] = useState(false);
  const [verOrigen, setVerOrigen] = useState(false);
  const [panel, setPanel] = useState(null);
  // 24-nov-2026 (Santiago: "va uno a editar y no pasa nada… ¿cerrar qué es?"). La reserva se edita en su fila, donde uno está mirando.
  const [resEnFila, setResEnFila] = useState(false);
  const [editarListo, setEditarListo] = useState(false);
  useEffect(() => { if (!recien) return undefined; const t = setTimeout(() => setRecien(null), 6000); return () => clearTimeout(t); }, [recien]);
  // Al cambiar de año todo se cierra, salvo la movida que se pasó a ese año: queda abierta, resaltada y a la vista.
  const seVaCon = useRef(null);
  const moverMovida = (ref, a2) => { seVaCon.current = ref; setAnioSel(a2); };
  useEffect(() => {
    const m = seVaCon.current; seVaCon.current = null;
    setEditMov(m); setRecien(m); setPanel(null); setEditarListo(false); setVerOrigen(false);
    if (m) setTimeout(() => document.getElementById("f10-mov-" + m)?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 120);
  }, [anioSel]);
  // En el celular, la pestaña del año elegido queda a la vista.
  const tabsRef = useRef(null);
  useEffect(() => { const l = tabsRef.current, t = l && l.querySelector('[aria-selected="true"]'); if (l && t && l.scrollTo) l.scrollTo({ left: Math.max(0, t.offsetLeft - l.clientWidth / 2 + t.clientWidth / 2), behavior: "smooth" }); }, [anioSel]);
  const holg = useMemo(() => holguraPorAnio(cuenta), [cuenta]);
  const N = cuenta.length;
  const g = cuenta.find((y) => y.anio === anioSel) || cuenta[0];
  if (!g) return null;
  const Y = nombreAnio(g.anio), anio = g.anio, enY = anio === 1 ? tx("hoy", "today") : tx("en " + Y, "in " + Y), sigY = anio < N ? anioCal(anio + 1) : null;
  const ir = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50); };
  const fo = g.foto || {};
  const cambios = cambiosDelAnio(r, cfg, anio, fo);
  const bd = r.bolsaDetalle || {};
  const sinCubrir = Math.max(0, (bd.excesoVentas || 0) - (bd.excesoCubierto || 0));
  const nomMov = (m) => (m.tipo === "B" && !/^(Obras|Build-outs)/.test(m.nombre) ? tx(`Inviertes en ${m.nombre}`, `Invest in ${m.nombre}`) : m.nombre);
  const rva = cfg.reservaAnual || {};
  const ponerReserva = (v) => { const x = { ...rva }; if (v === "" || !(Number(v) > 0)) delete x[anio]; else x[anio] = v; set("reservaAnual", x); };
  const tasaR = fmtPctEs((g.tasaReserva || 0) * 100, 1);
  const h = holg.find((x) => x.anio === anio) || { libre: 0, guardar: 0, para: [] };
  const listaAnios = (l) => {
    const tramos = []; [...l].sort((a, b) => a - b).forEach((y) => { const u = tramos[tramos.length - 1]; if (u && y === u[1] + 1) u[1] = y; else tramos.push([y, y]); });
    const t = tramos.map(([a, b]) => (a === b ? anioCal(a) : b === a + 1 ? `${anioCal(a)} ${tx("y", "and")} ${anioCal(b)}` : tx(`de ${anioCal(a)} a ${anioCal(b)}`, `from ${anioCal(a)} to ${anioCal(b)}`)));
    const txt = t.length <= 1 ? t.join("") : `${t.slice(0, -1).join(", ")} ${tx("y", "and")} ${t[t.length - 1]}`;
    return /^(de|from) /.test(txt) ? txt : tx(`en ${txt}`, `in ${txt}`);
  };
  const fCon = (r.filas || [])[anio] || {};
  // 24-nov-2026 (Santiago: "¿y esto de guardar en tu reserva no dice hasta cuándo?"). Se usa sola el año que no te alcance;
  // según tu plan, en qué años, y cuánto queda al final.
  const usosRes = cuenta.filter((y) => y.anio > anio && y.usoReserva > 0.5).map((y) => y.anio), resFinal = cuenta[N - 1] ? partesReserva(cuenta[N - 1], null).fin : 0;
  const tasaN = g.tasaReserva || 0, destino = (cfg.reservaHasta || {})[anio];
  const vuelveCon = Math.round((g.aApartado || Number(rva[anio]) || 0) * Math.pow(1 + tasaN, (destino || anio) - anio));
  const hastaCuando = destino ? tx(`Queda guardada aparte hasta ${anioCal(destino)}: ese año vuelve a tu capital con lo que rindió (unos ${plata(vuelveCon)}).`, `It's kept aside until ${anioCal(destino)}: that year it returns to your capital with what it earned (about ${plata(vuelveCon)}).`)
    : tx("La usas en cualquier año siguiente con «Usar tu reserva este año», y se usa sola si un año no te alcanza.", "Use it in any later year with \"Use your reserve this year\"; it's also used automatically if a year falls short.");
  const hastaCuandoViejo = usosRes.length ? tx(`Se queda rindiendo y se usa sola el año que no te alcance: según tu plan, ${listaAnios(usosRes)}.${resFinal > 0.5 ? ` Al final de ${anioCal(N)} quedarían ${plata(Math.round(resFinal))}.` : ""}`, `It keeps earning and is used automatically the year you fall short: per your plan, ${listaAnios(usosRes)}.${resFinal > 0.5 ? ` By the end of ${anioCal(N)} ${plata(Math.round(resFinal))} would be left.` : ""}`)
    : tx(`Se queda rindiendo y se usa sola el año que no te alcance. Con tu plan no hace falta usarla${resFinal > 0.5 ? `: al final de ${anioCal(N)} tendrías ${plata(Math.round(resFinal))}` : ""}.`, `It keeps earning and is used automatically the year you fall short. Your plan doesn't need it${resFinal > 0.5 ? `: by the end of ${anioCal(N)} you'd have ${plata(Math.round(resFinal))}` : ""}.`);
  // Fondo de emergencia para el año que viene: 6 meses de lo que te cuesta vivir ese año, frente a lo que tendrías en tu reserva.
  const sigRow = cuenta.find((y) => y.anio === anio + 1);
  const gastosMesSig = ((((sigRow || g).foto) || {}).gastos || 0) / 12, metaEmerg = 6 * gastosMesSig;
  const reservaSig = sigRow ? (() => { const x = reservaDelAnio(sigRow); return x.inicio + x.vuelve; })() : reservaDelAnio(g).cierre;
  const faltaEmerg = Math.max(0, metaEmerg - reservaSig);
  const sugerido = Math.min(Math.max(0, g.porInvertir), Math.max(faltaEmerg, h.guardar || 0));
  const ponerHasta = (v) => { const x = { ...(cfg.reservaHasta || {}) }; if (!v) delete x[anio]; else x[anio] = Number(v); set("reservaHasta", x); };
  const listo = !!(cfg.aniosListos || {})[anio], problema = g.faltaSinCubrir > 0.5 || g.porInvertir < -1;
  const usado = Math.max(0, g.movido) + (g.reservaDeAqui || 0);
  const partesDesc = [g.comprometido > 0.5 && tx(`lo comprometido para este año (${plata(Math.round(g.comprometido))})`, `this year's commitments (${plata(Math.round(g.comprometido))})`), g.faltaMes > 0.5 && tx(`lo que te falta para vivir este año (${plata(Math.round(g.faltaMes))})`, `this year's living shortfall (${plata(Math.round(g.faltaMes))})`)].filter(Boolean);
  const descuenta = partesDesc.length ? tx(` Ya le restamos ${partesDesc.join(" y ")}.`, ` Already net of ${partesDesc.join(" and ")}.`) : "";
  const yLista = (l) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} ${tx("y", "and")} ${l[l.length - 1]}`);
  const origenCap = yLista([
    g.antes > 0.5 && tx(`lo que te sobró de ${anioCal(anio - 1)}`, `what was left from ${anioCal(anio - 1)}`),
    g.llegan.some((l) => l.tipo === "venta" || l.tipo === "vence") && tx("tus ventas", "your sales"),
    g.llegan.some((l) => l.tipo === "retiro") && tx("lo que retiras de tus inversiones", "what you withdraw from your investments"),
    g.llegan.some((l) => String(l.id).startsWith("reserva_")) && tx("lo que guardaste para este año", "what you kept for this year"),
  ].filter(Boolean));
  // El formulario de la reserva: se abre arriba con «Guardar en tu reserva» o en su fila con «Editar».
  const panelReserva = <>
          <div style={{ ...TIPO.meta, marginBottom: 8 }}>{tx("Para años que vienen.", "For coming years.")} {hastaCuando}{g.porInvertir > 0.5 ? tx(` Te quedan ${plata(Math.round(g.porInvertir))} de tu capital.`, ` ${plata(Math.round(g.porInvertir))} of your capital is left.`) : ""}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <NumberInput aria-label={tx("Monto para tu fondo de reserva", "Amount for your reserve fund")} style={{ ...inp, flex: "1 1 180px" }} placeholder="$0" value={rva[anio] ?? ""} onChange={ponerReserva} />
            {g.porInvertir > 0.5 && <button type="button" style={{ ...btn(false), padding: "6px 10px", whiteSpace: "nowrap" }} onClick={() => ponerReserva(Math.round((Number(rva[anio]) || 0) + g.porInvertir))}>{tx(`Todo lo que queda (${plata(Math.round(g.porInvertir))})`, `All that's left (${plata(Math.round(g.porInvertir))})`)}</button>}
          </div>
          {/* 24-nov-2026 (Santiago: "este botón «Todo lo que queda» no sirve"): si ya usaste todo tu capital no hay qué agregar; se dice. */}
          {g.porInvertir <= 0.5 && <div style={{ ...TIPO.meta, marginTop: 6 }}>{tx("Ya usaste todo tu capital de este año. Para guardar más, baja una inversión, o manda a tu reserva lo que te sobra al mes, en «2 · Tu mes».", "You've used all your capital this year. To keep more, lower an investment, or send your monthly surplus to your reserve in \"2 · Your month\".")}</div>}
          {anio < N && <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, color: C.tx2, marginTop: 10 }}>{tx("¿Para cuándo?", "For when?")}
            <select style={{ ...inp, width: "auto", maxWidth: "100%", padding: "6px 10px" }} value={destino || ""} onChange={(e) => ponerHasta(e.target.value)}>
              <option value="">{tx("Para cualquier año que no alcance", "For any year that falls short")}</option>
              {Array.from({ length: N - anio }, (_, k) => anio + 1 + k).map((y) => <option key={y} value={y}>{tx(`Para ${anioCal(y)}`, `For ${anioCal(y)}`)}</option>)}
            </select></label>}
          <TasaReserva r={r} cfg={cfg} set={set} />
  </>;
  const pagaste = g.compromisos.filter((c) => c.tipo === "A").reduce((sm, c) => sm + c.monto, 0);
  const regla = reglaSobra(r, cfg, anio);
  const abrir = (k) => { if (k === "reserva") setResEnFila(false); setPanel(panel === k ? null : k); };
  const editarReservaFila = () => { if (panel === "reserva" && resEnFila) { setPanel(null); return; } setResEnFila(true); setPanel("reserva"); };
  const libresAportar = opcionesParaMeter(r, cfg, anio, Object.fromEntries(g.movidas.filter((m) => m.ref).map((m) => [m.ref, m.monto])));

  // 24-nov-2026 (Santiago: "«Hoy quedó listo», ¿qué? ¿qué es ese título? Es terrible. Es mejor «Así quedó tu 2026»: resumen de tu 2026
  // después de las inversiones ejecutadas"). El resumen de un año que dejaste organizado suma de arriba abajo: tu capital disponible, lo
  // que hiciste con él, lo que te quedó de tu mes y lo que pasa al año siguiente. La reserva dice de dónde salió (capital o mes).
  const resumenListo = (() => {
    const A = anioCal(anio);
    return <Ficha fuerte titulo={tx(`Así quedó tu ${A}`, `How your ${A} turned out`)} sub={tx(`Resumen de tu ${A} después de tus inversiones y pagos. Si cambias algo, se guarda solo.`, `Summary of your ${A} after your investments and payments. Any change saves automatically.`)} accion={<button type="button" style={btnAccion(false)} onClick={() => setEditarListo(true)}>{tx(`Editar tu ${A}`, `Edit your ${A}`)}</button>}>
      <SumaCierre g={g} sig={cuenta.find((y) => y.anio === anio + 1)} anio={anio} cf={fCon.cf || 0} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {sigY ? <button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => (irAnio ? irAnio(anio + 1) : ir(anio + 1))}>{tx(`Seguir con ${sigY} →`, `Go on to ${sigY} →`)}</button> : <button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={irResultado}>{tx("Ver el resultado →", "See the result →")}</button>}
      </div>
    </Ficha>;
  })();

  return <div style={{ ...card, padding: 0, overflow: "visible" }} id="f10-anios">
    <div style={{ padding: "14px 16px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <TituloPaso n={3}>{tx("Tu plata año por año", "Your money year by year")}</TituloPaso>
        {(() => { const listos = cuenta.filter((y) => estadoAnio(y, cfg) === "listo").length, sigue = cuenta.find((y) => estadoAnio(y, cfg) !== "listo"); return <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.tx2 }}>
          <span style={{ width: 90, height: 6, borderRadius: 999, background: C.bd, overflow: "hidden", display: "inline-block" }} aria-hidden="true"><span style={{ display: "block", height: "100%", width: `${Math.round(listos / Math.max(1, N) * 100)}%`, background: C.gn }} /></span>
          <span>{listos === N ? tx("Organizaste los 10 años ✓", "All 10 years organized ✓") : tx(`Organizaste ${listos} de ${N} años`, `${listos} of ${N} years organized`)}</span>
          {sigue && sigue.anio !== anioSel && <button type="button" onClick={() => ir(sigue.anio)} style={enlace}>{tx(`Sigue: ${sigue.anio === 1 ? "hoy" : anioCal(sigue.anio)}`, `Next: ${sigue.anio === 1 ? "today" : anioCal(sigue.anio)}`)}</button>}
          {listos === N && <button type="button" onClick={irResultado} style={enlace}>{tx("Ver el resultado →", "See the result →")}</button>}
        </div>; })()}
      </div>
      <p style={SUB_PASO}>{tx("Cada año decides dos cosas: qué haces con tu capital disponible y qué haces con lo que te sobra cada mes. Lo que no uses pasa al año siguiente. Cifras en pesos de cada año.", "Each year you decide two things: what to do with your available capital and what to do with your monthly surplus. What you don't use carries to the next year. Figures in each year's money.")}</p>
    </div>
    <div ref={tabsRef} role="tablist" aria-label={tx("Años del plan", "Plan years")} style={{ position: "sticky", top: 52, zIndex: 6, background: C.bg2, display: "flex", gap: 6, overflowX: "auto", padding: "8px 16px", borderBottom: `1px solid ${C.bd}` }}>
      {cuenta.map((y) => { const on = y.anio === anioSel, q = y.porInvertir, malo = q < -0.5 || y.faltaSinCubrir > 0.5; return <button key={y.anio} role="tab" aria-selected={on} type="button" onClick={() => ir(y.anio)} style={{ flex: "0 0 auto", textAlign: "left", padding: "6px 12px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(0,200,5,0.12)" : "transparent", border: `1px solid ${on ? C.gn : C.bd}`, color: C.tx }}>
        {(() => { const est = estadoAnio(y, cfg); return <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
          {est === "listo" && <span aria-label={tx("Listo", "Done")} style={{ color: C.gn, fontSize: 12 }}>✓</span>}
          {y.anio === 1 ? tx("Hoy", "Today") : anioCal(y.anio)}
          {est === "problema" && <span title={tx("Revisa este año", "Check this year")} aria-label={tx("Revisa este año", "Check this year")} style={{ width: 7, height: 7, borderRadius: 999, background: C.rd, display: "inline-block" }} />}
        </div>; })()}
        {/* 24-nov-2026 (Santiago: "no es muy claro qué son estos números verdes: mostrar un poco más en estas fichas"). Dos datos con
            nombre: el capital que te queda por usar ese año (lo que falta decidir) y lo que te sobra o falta al mes. */}
        {(() => { const mesY = (y.cfPrev || 0) / 12; return <div style={{ display: "grid", gap: 1, fontSize: 12, color: C.tx2, fontVariantNumeric: "tabular-nums", marginTop: 2, whiteSpace: "nowrap" }}>
          {y.faltaSinCubrir > 0.5 ? <span>{tx("Te faltan ", "Short ")}<b style={{ color: C.rd, fontWeight: 600 }}>{plata(Math.round(y.faltaSinCubrir))}</b></span>
            : q < -1 ? <span>{tx("Te pasaste ", "Over by ")}<b style={{ color: C.rd, fontWeight: 600 }}>{plata(Math.round(-q))}</b></span>
            : <span>{tx("Por usar ", "To use ")}<b style={{ color: q > 0.5 ? C.gn : C.tx, fontWeight: 600 }}>{plata(Math.round(Math.max(0, q)))}</b></span>}
          <span>{tx("Al mes ", "Monthly ")}<b style={{ color: mesY < -0.5 ? C.am : mesY > 0.5 ? C.gn : C.tx, fontWeight: 600 }}>{mesY < -0.5 ? "−" : "+"}{plata(Math.round(Math.abs(mesY)))}</b></span>
          {(() => { const rv = reservaDelAnio(y).queda; return rv > 0.5 && <span>{tx("Reserva ", "Reserve ")}<b style={{ color: C.tx, fontWeight: 600 }}>{plata(Math.round(rv))}</b></span>; })()}
        </div>; })()}
      </button>; })}
    </div>
    <div style={{ padding: "4px 16px 16px" }}>
      {listo && !problema && !editarListo ? resumenListo : <>
      {/* 24-nov-2026 (Santiago: "uno aquí se pierde: arranca el año con… y luego tu reserva hoy… no sé con qué cuento finalmente";
          "demos orden: tienes para este año 1.000 MM disponibles y 300 MM en reserva"; "tienes este año 2.000 MM disponibles y 250 MM en reserva"; "lo más importante es el capital disponible y lo
          segundo la reserva"; "uno cree que lo único que hay es la reserva"). Arriba, una sola respuesta: con qué cuentas este año. Tu
          capital disponible, grande, y al lado tu reserva, aparte y más pequeña: las dos se suman sin contar nada dos veces. De dónde
          sale va plegado; lo que cambia en tu mes pasó a «2 · Tu mes». */}
      <section id="f10-cuentas" style={{ background: C.bg, border: `1px solid ${C.gn}`, borderRadius: 12, padding: "16px 18px", marginTop: 12 }}>
        <div style={TIPO.ficha}>{anio === 1 ? tx("Tienes este año", "This year you have") : tx(`Tienes en ${Y}`, `In ${Y} you have`)}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12, alignItems: "flex-start" }}>
          <div style={{ flex: "1.6 1 300px", minWidth: 0 }}>
            <div style={{ fontSize: "clamp(26px, 8vw, 40px)", fontWeight: 700, lineHeight: 1.1, color: g.disponible > 0.5 ? C.gn : C.tx, fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{plata(Math.round(g.disponible))}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.tx, marginTop: 2 }}>{tx("de capital disponible", "of available capital")}</div>
            {/* 24-nov-2026 (Santiago: "¿tengo 272 MM disponibles o tengo 58 MM? Uno no sabe qué es qué"). Lo que ya usaste y lo que te queda, aquí mismo. */}
            {usado > 0.5 && <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 6, fontSize: 14, color: C.tx2, fontVariantNumeric: "tabular-nums" }}>
              <span>{tx("Ya usaste ", "Already used ")}<b style={{ color: C.tx, fontWeight: 600 }}>{plata(Math.round(usado))}</b>{(() => { const n = [...g.movidas.filter((m) => m.cuenta && m.monto > 0.5).map((m) => m.nombre), ...((g.reservaDeAqui || 0) > 0.5 ? [tx("tu reserva", "your reserve")] : [])]; return n.length ? tx(` en ${n.length <= 2 ? n.join(" y ") : `${n.slice(0, 2).join(", ")} y ${n.length - 2} más`}`, ` on ${n.length <= 2 ? n.join(" and ") : `${n.slice(0, 2).join(", ")} and ${n.length - 2} more`}`) : ""; })()}</span>
              <span>{g.porInvertir < -1 ? tx("Te pasaste ", "Over by ") : tx("Te quedan por usar ", "Left to use ")}<b style={{ color: g.porInvertir < -1 ? C.rd : C.gn, fontWeight: 600 }}>{plata(Math.round(g.porInvertir < -1 ? -g.porInvertir : Math.max(0, g.porInvertir)))}</b></span>
            </div>}
            <div style={{ ...TIPO.meta, marginTop: 6 }}>{origenCap ? tx(`Viene de ${origenCap}. `, `From ${origenCap}. `) : ""}{tx("Para invertir, pagar deudas o guardar en tu reserva.", "To invest, pay off debt or keep in your reserve.")}{descuenta}</div>
            {(g.sacasReserva || 0) > 0.5 && <div style={{ fontSize: 14, color: C.tx, marginTop: 6, lineHeight: 1.45 }}>{tx(`Incluye ${plata(Math.round(g.sacasReserva))} que sacas de tu reserva.`, `Includes ${plata(Math.round(g.sacasReserva))} you take from your reserve.`)}</div>}
            <button type="button" onClick={() => setVerOrigen(!verOrigen)} style={{ ...enlace, color: C.tx2, marginTop: 8 }} aria-expanded={verOrigen}>{verOrigen ? tx("Ocultar de dónde sale", "Hide where it comes from") : tx("¿De dónde sale?", "Where does it come from?")}</button>
            {verOrigen && <div style={{ marginTop: 6 }}>
              {/* Lo que tienes, renglón por renglón: lo que traes y cada venta o plata que te llega. */}
              {g.antes > 0.5 && <Renglon l={tx(`Saldo que traes de ${nombreAnio(anio - 1)}`, `Balance carried from ${nombreAnio(anio - 1)}`)} v={g.antes} />}
              {g.llegan.map((l, k) => <Renglon key={"ll" + k} l={(g.antes > 0.5 || k > 0 ? "+ " : "") + (l.tipo === "venta" || l.tipo === "reserva" ? l.nombre : l.tipo === "retiro" ? tx(`Sacas de ${l.nombre}${l.parcial ? " (una parte)" : ""}`, `Taken out of ${l.nombre}${l.parcial ? " (part of it)" : ""}`) : tx(`Te llega de ${l.nombre}`, `Arrives from ${l.nombre}`))} v={l.monto} nota={l.pagoDeuda > 0.5 ? tx(`Ya descontada su deuda (${plata(Math.round(l.pagoDeuda))}).`, `Its debt (${plata(Math.round(l.pagoDeuda))}) already deducted.`) : null} />)}
              {(g.antes > 0.5 ? 1 : 0) + g.llegan.length > 1 && <Renglon fuerte l={tx("= Lo que tienes", "= What you have")} v={g.tienes} />}
              {g.tienes <= 0.5 && <Renglon l={tx(anio === 1 ? "Lo que tienes (hoy no vendes nada)" : "Lo que tienes (no traes saldo ni te llega plata)", "What you have (nothing sold or carried)")} v={0} />}
              {g.faltaMes > 0.5 && <Renglon l={tx("− Lo que falta para vivir", "− Short on living costs")} v={g.faltaMes} col={C.am} nota={tx("Se aparta primero, antes de invertir.", "Set aside first, before investing.")} />}
              {g.compromisos.map((c, k) => { const clave = c.tipo === "F" && c.idx != null && c.k === 0 ? `dc:${c.idx}` : null; const xa = clave ? ((cfg.futuros || {}).activos || [])[c.idx] : null; return <div key={k}>
              <Renglon l={`− ${c.nombre}`} v={c.monto} col={C.tx2} nota={c.nota || (c.tipo === "F" && c.k > 0 ? tx("Otra parte de esa compra.", "Another part of that purchase.") : null)} />
              {clave && <button type="button" onClick={() => setAbierto(abierto === clave ? null : clave)} style={{ ...enlace, padding: "0 0 6px" }}>{abierto === clave ? tx("Cerrar el detalle", "Close the detail") : xa && xa.desglose ? tx("Ver el detalle de la compra", "See the purchase detail") : tx("Detallar cómo la compras", "Detail how you buy it")}</button>}
              {clave && abierto === clave && <DesgloseCompra r={r} cfg={cfg} set={set} idx={c.idx} anio0={anio} />}
              </div>; })}
              {g.cubreMes > 0.5 && <Renglon l={tx("+ Lo cubre lo que te sobra en el año", "+ Covered by this year's surplus")} v={g.cubreMes} nota={tx("Lo comprometido no cabía en tu capital: una parte la paga tu mes.", "Commitments didn't fit your capital: part is paid by your month.")} />}
              {g.usoReserva > 0.5 && <Renglon l={tx("+ Sale de tu fondo de reserva", "+ From your reserve fund")} v={g.usoReserva} col={C.am} nota={tx("Lo que tienes no alcanza para vivir y pagar lo comprometido; lo cubre tu reserva.", "What you have doesn't cover living costs and commitments; your reserve does.")} />}
              <Renglon fuerte linea l={tx("= Capital disponible", "= Available capital")} v={g.disponible} col={g.disponible > 0.5 ? C.gn : C.tx} />
            </div>}
          </div>
          <ReservaAnio r={r} g={g} sig={cuenta.find((y) => y.anio === anio + 1)} cuenta={cuenta} cfg={cfg} set={set} anio={anio} tasaR={tasaR} />
        </div>
        {/* Compras de Lo que viene que todavía no tienen valor: se detallan en su año. */}
        {((cfg.futuros || {}).activos || []).map((x, i) => [x, i]).filter(([x, i]) => x && !(Number(x.valor) > 0) && !(r.pagosFuturos || []).some((p) => p.idx === i) && Math.max(1, Number((x.desglose || {}).anio0) || Number(x.entrega) || 1) === anio).map(([x, i]) => <div key={"dp" + i} style={{ marginTop: 6 }}>
          <Renglon l={tx(`${x.nombre || "Compra"}: todavía sin valor`, `${x.nombre || "Purchase"}: no value yet`)} v={0} col={C.tx2} />
          <button type="button" onClick={() => setAbierto(abierto === `dc:${i}` ? null : `dc:${i}`)} style={{ ...enlace, padding: "0 0 6px" }}>{abierto === `dc:${i}` ? tx("Cerrar el detalle", "Close the detail") : tx("Detallar cómo la compras", "Detail how you buy it")}</button>
          {abierto === `dc:${i}` && <DesgloseCompra r={r} cfg={cfg} set={set} idx={i} anio0={anio} />}
        </div>)}
        {g.faltaSinCubrir > 0.5 && <div role="alert" style={{ fontSize: 12.5, color: C.rd, margin: "6px 0 2px", lineHeight: 1.45 }}>{tx(`No alcanza: faltan ${plata(Math.round(g.faltaSinCubrir))} para vivir y pagar lo comprometido este año. Salen de tus cuentas e inversiones líquidas.`, `Not enough: ${plata(Math.round(g.faltaSinCubrir))} short for living costs and commitments this year. It comes out of your accounts and liquid investments.`)}</div>}
      </section>
      {/* 1 · Qué haces con tu capital: cada opción abre su menú. */}
      <Ficha tam={24} id="f10-capital" titulo={tx(`1 · Qué haces con tu capital ${enY}`, `1 · What you do with your capital ${enY}`)} sub={sigY ? tx(`Pagar deudas, invertir o guardar en tu reserva. Lo que no uses pasa a ${sigY}.`, `Pay off debt, invest or keep in your reserve. What you don't use carries to ${sigY}.`) : tx("Pagar deudas, invertir o guardar en tu reserva.", "Pay off debt, invest or keep in your reserve.")}
        cifra={usado > 0.5 ? `${g.porInvertir < -1 ? "−" : ""}${plata(Math.round(g.porInvertir < -1 ? -g.porInvertir : Math.max(0, g.porInvertir)))}` : null} cifraSub={g.porInvertir < -1 ? tx("te pasaste", "over") : tx("te quedan por usar", "left to use")} col={g.porInvertir < -1 ? C.rd : g.porInvertir > 0.5 ? C.gn : C.tx}>
        {g.disponible > 0.5 && usado > 0.5 && (() => { const pctU = Math.min(100, usado / g.disponible * 100); return <div style={{ margin: "0 0 10px" }}>
          <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: C.bd, overflow: "hidden" }}><div style={{ height: "100%", width: `${pctU}%`, background: g.porInvertir < -1 ? C.rd : C.gn, transition: "width 400ms cubic-bezier(.2,.8,.2,1)" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: C.tx2, marginTop: 4, fontVariantNumeric: "tabular-nums" }}><span>{tx(`Usaste ${plata(Math.round(usado))} de ${plata(Math.round(g.disponible))}`, `You used ${plata(Math.round(usado))} of ${plata(Math.round(g.disponible))}`)}</span><span>{g.porInvertir < -1 ? tx(`te pasaste ${plata(Math.round(-g.porInvertir))}`, `over by ${plata(Math.round(-g.porInvertir))}`) : tx(`te quedan ${plata(Math.round(g.porInvertir))}`, `${plata(Math.round(g.porInvertir))} left`)}</span></div>
        </div>; })()}
        {/* 24-nov-2026 (Santiago: "recuerda anticipar un fondo de emergencia para el año que viene… elige un valor y pon la tasa"). */}
        {g.porInvertir > 0.5 && sugerido > 0.5 && <FondoEmergencia r={r} cfg={cfg} set={set} sigY={sigY} gastosMes={gastosMesSig} meta={metaEmerg} reservaSig={reservaSig} falta={faltaEmerg} sugerido={sugerido}
          extra={h.guardar > 0.5 ? (() => { const uno = h.para.length === 1, solos = h.para.length > 0 && (cuenta.find((y) => y.anio === h.para[0]) || {}).propio < -0.5; const razon = solos ? (uno ? tx("ese año no te alcanza con lo que entra", "that year falls short on its own") : tx("esos años no te alcanzan con lo que entra", "those years fall short on their own")) : tx("ya decidiste usar esa plata en algo", "you already decided to use that money"); return tx(`Además, ${listaAnios(h.para)} vas a necesitar ${plata(Math.round(h.guardar))} de lo que te queda hoy: ${razon}.`, `Also, ${listaAnios(h.para)} you'll need ${plata(Math.round(h.guardar))} of what's left today: ${razon}.`); })() : null}
          guardar={(v) => ponerReserva(Math.round((Number(rva[anio]) || 0) + v))} />}
        <Etq>{tx("¿Qué haces con él?", "What do you do with it?")}</Etq>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["deudas", tx("Pagar deudas", "Pay off debt")],
            ["tienes", tx("Invertir en lo que tienes", "Invest in what you own")],
            ["nueva", tx("Inversión nueva", "New investment")],
            ["reserva", tx("Guardar en tu reserva", "Keep in your reserve")],
          ].map(([k, l]) => <button key={k} type="button" aria-expanded={k === "nueva" ? undefined : panel === k} onClick={() => { if (k === "nueva") { const ref = nuevaEnAnio(anio, g.porInvertir / (g.factorHoy || 1)); setPanel(null); setEditMov(ref); setRecien(ref); } else abrir(k); }} style={btnAccion(k !== "nueva" && panel === k)}>{k === "nueva" ? "+ " : ""}{l}</button>)}
        </div>
        {panel === "deudas" && <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>{paneles.deudas}</div>}
        {panel === "tienes" && <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>
          {libresAportar.some((a) => !a.noDisp) ? <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: C.tx2 }}>{tx("¿En cuál inviertes?", "Which one?")}
            <select aria-label={tx("Invertir en algo que ya tienes", "Invest in something you own")} style={{ ...inp, width: "auto", maxWidth: "100%", padding: "8px 12px", cursor: "pointer" }} value="" onChange={(e) => { const v = e.target.value; if (!v) return; const op = libresAportar.find((a) => a.id === v); if (op && op.abrir) { setEditMov(op.abrir); setRecien(null); setPanel(null); return; } const ref = reinvEnAnio(v, anio); setEditMov(null); setRecien(ref); setPanel(null); }}>
              <option value="">{tx("Elegir…", "Choose…")}</option>
              <OpcionesAportar libres={libresAportar} />
            </select></label> : <div style={{ fontSize: 12.5, color: C.tx2 }}>{tx("No tienes inversiones en las que puedas invertir más este año.", "You have no investments you can add to this year.")}</div>}
          <button type="button" onClick={() => setPanel("tienes-todo")} style={{ ...enlace, color: C.tx2, marginTop: 8 }}>{tx("Ver todo lo que inviertes en lo que tienes", "See everything you add to what you own")}</button>
        </div>}
        {panel === "tienes-todo" && <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>{paneles.tienes}</div>}
        {panel === "reserva" && !resEnFila && <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>{panelReserva}</div>}
        <Etq>{tx(`Lo que haces con tu capital ${enY}`, `What you do with your capital ${enY}`)}</Etq>
        {g.movidas.length === 0 && !(g.reservaDeAqui > 0.5) && pagaste <= 0.5 && <div style={{ fontSize: 12.5, color: C.tx2, padding: "4px 0" }}>{tx("Todavía nada. Elige arriba qué haces con él.", "Nothing yet. Choose above what to do with it.")}</div>}
        {g.compromisos.filter((c) => c.tipo === "A").map((c, k) => <Renglon key={"pd" + k} l={`− ${c.nombre}`} v={c.monto} col={C.tx2} nota={c.nota} />)}
        {g.movidas.map((m, k) => <div key={k} id={m.ref ? "f10-mov-" + m.ref : undefined} style={{ background: recien && m.ref === recien ? "rgba(0,200,5,0.10)" : "transparent", borderRadius: 8, transition: "background 600ms", padding: "0 6px", margin: "0 -6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Renglon l={<>{`− ${nomMov(m)}`}{m.tipo === "C" && <span style={{ fontSize: 12, color: C.tx2 }}> · {tx("inversión nueva", "new investment")}</span>}</>} v={m.monto} col={m.cuenta ? C.tx : C.tx2}
              nota={m.sinMonto ? tx("Sin monto todavía: ponle cuánto con «Editar», o quítala.", "No amount yet: set it with \"Edit\", or remove it.") : !m.cuenta ? (m.fuente === "nuevo" ? tx("Con plata nueva de afuera: no sale de aquí.", "With new money from outside: not taken from here.") : tx("De tus cuentas de hoy: no sale de aquí.", "From your current accounts: not taken from here.")) : null} /></div>
            {m.ref && <button type="button" onClick={() => setEditMov(editMov === m.ref ? null : m.ref)} style={{ ...enlace, padding: "4px 0", color: editMov === m.ref ? C.gn : C.tx2, flex: "0 0 auto" }}>{editMov === m.ref ? tx("Listo", "Done") : tx("Editar", "Edit")}</button>}
          </div>
          {m.ref && editMov === m.ref && <MovidaEditor r={r} cfg={cfg} set={set} refMov={m.ref} anio={anio} esc={esc} quedaHoy={g.porInvertir / (g.factorHoy || 1)} factor={g.factorHoy || 1} onAnio={(a2) => moverMovida(m.ref, a2)} onListo={() => setEditMov(null)} />}
        </div>)}
        {(g.reservaDeAqui > 0.5 || (Number(rva[anio]) || 0) > 0.5) && <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Renglon l={destino ? tx(`− A tu reserva, para ${anioCal(destino)}`, `− To your reserve, for ${anioCal(destino)}`) : tx("− A tu fondo de reserva", "− To your reserve fund")} v={g.reservaDeAqui || 0}
              nota={((g.reservaDeAqui || 0) + 0.5 < (Number(rva[anio]) || 0) ? tx(`Pediste guardar ${plata(Math.round(Number(rva[anio])))}; ${(g.reservaDeAqui || 0) > 0.5 ? `solo caben ${plata(Math.round(g.reservaDeAqui))}` : "no queda capital para guardar"}${(g.sacasReserva || 0) > 0.5 ? ": lo que sacas de tu reserva no vuelve a ella" : ""}. `, `You asked to keep ${plata(Math.round(Number(rva[anio])))}; ${(g.reservaDeAqui || 0) > 0.5 ? `only ${plata(Math.round(g.reservaDeAqui))} fits` : "there's no capital left to keep"}. `) : "") + tx(`Rinde ${tasaR} al año. `, `Earns ${tasaR} a year. `) + hastaCuando} /></div>
            <button type="button" onClick={editarReservaFila} style={{ ...enlace, padding: "4px 0", color: panel === "reserva" && resEnFila ? C.gn : C.tx2, flex: "0 0 auto" }}>{panel === "reserva" && resEnFila ? tx("Listo", "Done") : tx("Editar", "Edit")}</button>
            <button type="button" onClick={() => { ponerReserva(""); setPanel(null); }} style={{ ...enlace, padding: "4px 0", color: C.tx2, flex: "0 0 auto" }}>{tx("Quitar", "Remove")}</button>
          </div>
          {panel === "reserva" && resEnFila && <div style={{ border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", margin: "8px 0" }}>{panelReserva}</div>}
        </div>}
        {editMov && !g.movidas.some((m) => m.ref === editMov) && <MovidaEditor r={r} cfg={cfg} set={set} refMov={editMov} anio={anio} esc={esc} quedaHoy={g.porInvertir / (g.factorHoy || 1)} factor={g.factorHoy || 1} onAnio={(a2) => moverMovida(editMov, a2)} onListo={() => setEditMov(null)} />}
        {recien && (() => { const m = g.movidas.find((y) => y.ref === recien); return <div role="status" style={{ fontSize: 12.5, color: C.gn, margin: "4px 0" }}>{m ? tx(`✓ Listo: ${plata(Math.round(m.monto))} en ${nomMov(m).replace(/^Inviertes en /, "")}. ${g.porInvertir < -1 ? `Te pasaste ${plata(Math.round(-g.porInvertir))}.` : `Te quedan ${plata(Math.round(g.porInvertir))}.`} Quedó en tu plan.`, `✓ Done: ${plata(Math.round(m.monto))} in ${m.nombre}. ${g.porInvertir < -1 ? `Over by ${plata(Math.round(-g.porInvertir))}.` : `${plata(Math.round(g.porInvertir))} left.`} It's in your plan.`) : editMov === recien ? tx("✓ Agregada. Escribe el monto.", "✓ Added. Enter the amount.") : null}</div>; })()}
        {/* 24-nov-2026 (Santiago: "aquí diría que pasa la reserva para 2027"; luego: "no me cuadra"). La reserva ya está arriba, con su
            monto: aquí solo se dice que pasa aparte, sin otro renglón que parezca plata de más. */}
        <Renglon fuerte linea l={g.porInvertir < -1 ? tx("Te pasaste", "You went over") : sigY ? tx(`Te queda (pasa a ${sigY})`, `Left (carries to ${sigY})`) : tx("Te queda", "Left")} v={g.porInvertir < -1 ? g.porInvertir : Math.max(0, g.porInvertir)} col={g.porInvertir < -1 ? C.rd : g.porInvertir > 0.5 ? C.gn : C.tx} signo={g.porInvertir < -1 ? "−" : ""}
          nota={g.reservaDeAqui > 0.5 && sigY ? (destino ? tx(`Tu reserva para ${anioCal(destino)} también pasa, aparte: ese año vuelve a tu capital.`, `Your reserve for ${anioCal(destino)} also carries over, kept aside: that year it returns to your capital.`) : tx(`Tu reserva también pasa, aparte: en ${sigY} o después la usas con «Usar tu reserva este año».`, `Your reserve also carries over, kept aside: from ${sigY} on, use it with "Use your reserve this year".`)) : null} />
        {g.porInvertir < -1 && <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.45 }}>{tx("Lo que te pasaste sale de tus cuentas e inversiones líquidas. Si prefieres, baja un monto o pásalo a otro año.", "What you went over comes out of your accounts and liquid investments. Or lower an amount or move it to another year.")}</div>}
        {anio === 1 && sinCubrir > 0.5 && <div style={{ fontSize: 12, color: C.rd, marginTop: 4 }}>{tx(`Pediste ${plata(Math.round(sinCubrir))} más de lo que hay, también en tus cuentas: esa parte no se invierte.`, `You asked for ${plata(Math.round(sinCubrir))} more than there is, even in your accounts: that part isn't invested.`)}</div>}
        {anio === 1 && (bd.usos || []).some((u) => (u.anio || 1) === 1) && <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: C.tx2 }}>{tx("De dónde sale la plata de cada inversión de hoy", "Where each of today's investments gets its money")}</summary>
          {(bd.usos || []).filter((u) => (u.anio || 1) === 1).map((u, k) => {
            const partes = [u.deVenta > 0.5 && `${plata(Math.round(u.deVenta))} ${tx("de lo que vendes", "from sales")}`, u.deCuentas > 0.5 && `${plata(Math.round(u.deCuentas))} ${tx("de tus cuentas", "from your accounts")}`, u.deNuevo > 0.5 && `${plata(Math.round(u.deNuevo))} ${tx("plata nueva", "new money")}`].filter(Boolean);
            return <div key={k} style={{ fontSize: 12, padding: "5px 0", borderTop: `1px solid ${C.bd}`, display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ color: C.tx }}>{u.nombre}<span style={{ display: "block", color: C.tx2 }}>{partes.join(" + ") || "—"}</span></span><span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{plata(Math.round(u.monto))}</span></div>;
          })}
        </details>}
      </Ficha>

      {/* 2 · Tu mes: qué haces con lo que te sobra cada mes (con tus movidas). */}
      {(() => { const cf = fCon.cf || 0, sobra = cf > 0.5, reinv = sobra ? cf * (1 - (g.libre ?? 1)) : 0; return <Ficha tam={24} id="f10-mes" titulo={tx(`2 · Tu mes ${enY}`, `2 · Your month ${enY}`)} sub={cf > 0.5 ? tx(`Cada mes te quedan disponibles ${plata(Math.round(cf / 12))}. Decide qué haces con ellos.`, `Each month you have ${plata(Math.round(cf / 12))} available. Decide what to do with it.`)
          : cf < -0.5 ? tx(`Cada mes te faltan ${plata(Math.round(-cf / 12))} para vivir.${g.faltaMes > 0.5 ? " Ya los restamos de tu capital disponible." : ""}`, `Each month you're ${plata(Math.round(-cf / 12))} short.`)
          : tx("Este año lo que entra cada mes alcanza justo para lo que gastas.", "This year your monthly income just covers your spending.")}
        cifra={`${cf < -0.5 ? "−" : "+"}${plata(Math.round(Math.abs(cf / 12)))}`} cifraSub={cf < -0.5 ? tx("te faltan al mes", "short each month") : tx("te sobran al mes", "left each month")} col={cf < -0.5 ? C.am : C.gn}>
        <MesAnio filas={[
          [tx("Te entra", "Comes in"), fCon.ingresos || 0],
          [tx("Vivir te cuesta", "Living costs"), fCon.gastos || 0],
          [cf < -0.5 ? tx("Te faltan", "Short") : tx("Te sobran", "Left over"), cf, { fuerte: true, linea: true, col: cf < -0.5 ? C.am : C.gn, signo: cf < -0.5 ? "−" : "" }],
        ]} />
        {Math.abs(cf - (fo.cf || 0)) > 6 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>{tx(`Sin lo que decidiste este año ${(fo.cf || 0) < -0.5 ? "te faltarían" : "te sobrarían"} ${plata(Math.round(Math.abs((fo.cf || 0) / 12)))} al mes: la diferencia es lo que te pagan tus inversiones nuevas y las cuotas que dejas de pagar.`, `Before your moves you were ${(fo.cf || 0) < -0.5 ? "short" : "left with"} ${plata(Math.round(Math.abs((fo.cf || 0) / 12)))} a month: your new investments pay you and the payments you stop making add up.`)}</div>}
        {/* 24-nov-2026: lo que cambia en tu mes este año (antes estaba en «Así arranca»). */}
        {cambios.length > 0 && <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setVerCambios(!verCambios)} style={{ ...enlace, color: C.tx2 }} aria-expanded={verCambios}>{verCambios ? tx("Ocultar lo que cambia este año", "Hide what changes this year") : tx(`Lo que cambia en tu mes este año (${cambios.length})`, `What changes in your month this year (${cambios.length})`)}</button>
          {verCambios && <div style={{ marginTop: 6 }}>
            {cambios.map((c, k) => { const clave = c.ajustar ? `aj:${c.ajustar.tipo}:${c.ajustar.idx}` : null; return <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "4px 0", fontSize: 13, flexWrap: "wrap" }}>
                <span style={{ color: C.tx, minWidth: 0 }}>{c.nombre} <span style={{ fontSize: 12, color: C.tx2 }}>· {c.que}{c.paso1 ? tx(" · del paso 1", " · from step 1") : ""}</span>
                  {clave && <button type="button" onClick={() => setAbierto(abierto === clave ? null : clave)} style={{ ...enlace, fontSize: 12, paddingLeft: 8 }}>{abierto === clave ? tx("Listo", "Done") : tx("Ajustar", "Adjust")}</button>}
                  {c.quitarPaga && <button type="button" onClick={() => set("nuevas", cfg.nuevas.map((x, j) => { if (j !== c.quitarPaga.k) return x; const pa = { ...(x.pagaAnios || {}) }; delete pa[c.quitarPaga.anio]; return { ...x, pagaAnios: pa }; }))} style={{ ...enlace, color: C.tx2, fontSize: 12, paddingLeft: 8 }}>{tx("Quitar", "Remove")}</button>}</span>
                {c.mes != null && <span style={{ color: c.mes > 0 ? C.gn : C.am, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{c.ahorro ? tx(`te ahorras ${plata(Math.round(Math.abs(c.mes)))} al mes`, `you save ${plata(Math.round(Math.abs(c.mes)))} a month`) : <>{c.mes > 0 ? "+" : "−"}{plata(Math.round(Math.abs(c.mes)))} {tx("al mes", "a month")}</>}</span>}
              </div>
              {clave && abierto === clave && <AjustarHito cfg={cfg} set={set} tipo={c.ajustar.tipo} idx={c.ajustar.idx} />}
            </div>; })}
          </div>}
        </div>}
        {cf < -0.5 && <>
          <div style={{ fontSize: 12.5, color: C.tx, margin: "8px 0 4px", lineHeight: 1.45 }}>{g.faltaMes > 0.5 ? tx("Lo que te falta ya lo apartaste de tu capital, antes de invertir.", "What you're short was already set aside from your capital, before investing.") : tx("Lo que te falta sale de lo que tienes.", "The shortfall comes out of what you have.")}</div>
          {(g.flujoFoto < -0.5) && <FaltaExplica r={r} cfg={cfg} set={set} anio={anio} falta={-g.flujoFoto} />}
        </>}
        {sobra && <RepartoMes r={r} cfg={cfg} set={set} g={g} anio={anio} Y={Y} sigY={sigY} regla={regla} reinv={reinv} tasaR={tasaR} />}
      </Ficha>; })()}
      <ResultadoAnio r={r} cfg={cfg} set={set} cuenta={cuenta} anioSel={anioSel} setAnioSel={setAnioSel} dejarListo={dejarListo} irAnio={irAnio} />
      </>}
    </div>
  </div>;
}
// 24-nov-2026 (Santiago: "no veo cómo puede uno disponer de la reserva… la reserva va apareciendo acumulada cada año; debería poder usarse
// si se necesita, un botón como de usar reserva este año"). Lo que sacas entra a tu capital de ese año; lo demás sigue rindiendo.
// «compacto»: solo el botón (o Cambiar y Quitar) y el formulario; el texto lo pone quien lo usa.
function UsarReserva({ g, cfg, set, anio, compacto = false }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const total = Math.round(g.reservaAntes || 0), sacas = Math.round(g.sacasReserva || 0);
  const poner = (v) => { const x = { ...(cfg.usarReserva || {}) }; if (!(Number(v) > 0)) delete x[anio]; else x[anio] = Math.min(total, Math.round(Number(v))); set("usarReserva", x); };
  const ok = Number(monto) > 0;
  return <div style={compacto ? { display: "grid", gap: 8, marginTop: 4 } : { border: `1px solid ${C.bd}`, borderRadius: 12, padding: "10px 12px", margin: "0 0 10px", display: "grid", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {!compacto && <span style={{ flex: "1 1 240px", fontSize: 14, color: C.tx, lineHeight: 1.45 }}>{sacas > 0.5
        ? tx(`Sacas ${plata(sacas)} de tu reserva: entran a tu capital de este año.${sacas < total ? ` Te quedan ${plata(total - sacas)} en ella.` : ""}`, `You take ${plata(sacas)} from your reserve into this year's capital.${sacas < total ? ` ${plata(total - sacas)} stays in it.` : ""}`)
        : tx(`Tienes ${plata(total)} en tu reserva.`, `You have ${plata(total)} in your reserve.`)}</span>}
      {sacas > 0.5
        ? <span style={{ display: "flex", gap: 12 }}><button type="button" onClick={() => { setMonto(sacas); setAbierto(!abierto); }} style={{ ...enlace, color: C.tx2 }}>{tx("Cambiar lo que sacas", "Change the amount")}</button><button type="button" onClick={() => { poner(0); setAbierto(false); }} style={{ ...enlace, color: C.tx2 }}>{tx("Quitar", "Remove")}</button></span>
        : <button type="button" aria-expanded={abierto} onClick={() => { setMonto(total); setAbierto(!abierto); }} style={btnAccion(abierto)}>{tx("Usar tu reserva este año", "Use your reserve this year")}</button>}
    </div>
    {abierto && <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿Cuánto sacas? ($)", "How much do you take? ($)")}<span style={{ width: 200, maxWidth: "100%" }}><NumberInput style={inp} value={monto} onChange={setMonto} /></span></label>
      <button type="button" onClick={() => setMonto(total)} style={{ ...btn(false), padding: "8px 12px" }}>{tx(`Todo (${plata(total)})`, `All (${plata(total)})`)}</button>
      <button type="button" disabled={!ok} onClick={() => { poner(monto); setAbierto(false); }} style={{ ...btn(ok), padding: "8px 14px", opacity: ok ? 1 : 0.5, cursor: ok ? "pointer" : "not-allowed" }}>{tx("Usar", "Use")}</button>
      <button type="button" onClick={() => setAbierto(false)} style={{ ...btn(false), padding: "8px 14px" }}>{tx("Cancelar", "Cancel")}</button>
    </div>}
    {!compacto && <div style={TIPO.meta}>{tx("Lo que no saques sigue rindiendo, y se usa sola si un año no te alcanza.", "What you don't take keeps earning, and is used automatically if a year falls short.")}</div>}
  </div>;
}
// 24-nov-2026 (Santiago: "lo más importante es el capital disponible y lo segundo la reserva"; "uno cree que lo único que hay es la
// reserva"; "la reserva es un fondo que está disponible para cualquier emergencia"). Lo que queda guardado aparte en el año: sin lo que
// sacas o se usa, que ya está en tu capital. Así las dos cifras de arriba se suman sin contar nada dos veces.
export function reservaDelAnio(g = {}) {
  const libre = g.reservaAntes || 0, guardada = g.apartadoAntes || 0, inicio = libre + guardada;
  const vuelve = (g.llegan || []).filter((l) => String(l.id).startsWith("reserva_")).reduce((sm, l) => sm + (l.monto || 0), 0);
  const sacas = g.sacasReserva || 0, uso = g.usoReserva || 0;
  const queda = Math.max(0, inicio - sacas - uso);
  const cierre = (g.reservaFin || 0) + (g.apartadoFin || 0);
  return { libre, guardada, inicio, vuelve, sacas, uso, queda, cierre, guardas: Math.max(0, cierre - queda) };
}
// 24-nov-2026 (Santiago: "¿me quedan 228 o 292, o una es la suma de la otra?"; "y esos 592, ¿de qué son, de dónde vienen? Cada valor
// debemos entender qué es y de dónde proviene"). Tu reserva en un año, como una suma de arriba abajo: lo que tienes al empezar, lo que
// sale, lo que guardas (de dónde) y lo que rinde = lo que tienes al terminar, que es con lo que empieza el año siguiente. En pesos
// redondeados y con lo que rinde como la parte que cierra la cuenta, para que lo que se ve sume exacto.
export function partesReserva(g = {}, sig = null) {
  const R = Math.round, rv = reservaDelAnio(g), s = sig ? reservaDelAnio(sig) : null;
  const empieza = R(rv.inicio + rv.vuelve), vuelve = R(rv.vuelve), sacas = R(rv.sacas), uso = R(rv.uso);
  const queda = empieza - vuelve - sacas - uso;
  const capRaw = Math.min(g.reservaDeAqui || 0, rv.guardas), fijoRaw = Math.min(g.repartoReserva || 0, Math.max(0, rv.guardas - capRaw));
  const todoRaw = g.mesAReserva ? Math.max(0, rv.guardas - capRaw - fijoRaw) : 0;
  const deCapital = R(capRaw), deMesFijo = R(fijoRaw), deMesTodo = R(todoRaw), otros = R(Math.max(0, rv.guardas - capRaw - fijoRaw - todoRaw));
  const guardas = deCapital + deMesFijo + deMesTodo + otros;
  const fin = s ? R(s.inicio + s.vuelve) : queda + guardas;
  const guardadaFin = R(s ? s.guardada + s.vuelve : g.apartadoFin || 0);
  return { ...rv, empieza, vuelve, sacas, uso, queda, deCapital, deMesFijo, deMesTodo, otros, guardas, rinde: s ? fin - queda - guardas : 0, fin, guardadaFin };
}
// De dónde sale lo que tienes en tu reserva al terminar un año, desde que empieza tu plan: lo que guardaste de tu capital o de lo que te
// sobraba al mes, lo que rindió y lo que sacaste o se usó, cada parte con sus años. Cada año empieza con lo que terminó el anterior, así
// que las partes suman exacto lo que tienes al terminar.
export function origenReserva(cuenta = [], hasta = 1) {
  const o = { inicial: 0, fin: 0, capital: [], mes: [], otros: [], rinde: [], sacas: [], uso: [], vuelve: [] };
  cuenta.filter((y) => y.anio <= hasta).sort((a, b) => a.anio - b.anio).forEach((g, i) => {
    const p = partesReserva(g, cuenta.find((y) => y.anio === g.anio + 1) || null);
    if (i === 0) o.inicial = p.empieza;
    [["capital", p.deCapital], ["mes", p.deMesFijo + p.deMesTodo], ["otros", p.otros], ["rinde", p.rinde], ["sacas", p.sacas], ["uso", p.uso], ["vuelve", p.vuelve]]
      .forEach(([k, v]) => { if (Math.abs(v) > 0.5) o[k].push({ anio: g.anio, v }); });
    o.fin = p.fin;
  });
  o.total = Object.fromEntries(["capital", "mes", "otros", "rinde", "sacas", "uso", "vuelve"].map((k) => [k, o[k].reduce((sm, x) => sm + x.v, 0)]));
  return o;
}
// Tu fondo de reserva, al lado del capital y más pequeño. 24-nov-2026 (Santiago: "aquí sería más claro: reserva este año cero, reserva
// para el año entrante XXXX, y que uno sepa de dónde viene o cómo se logró"; "¿me quedan 228 o 292, o una es la suma de la otra?";
// "cada valor debemos entender qué es y de dónde proviene"). Una suma de arriba abajo con todos los renglones del mismo tamaño: lo que
// tienes al empezar el año (lo que tenías al terminar el anterior), lo que sale, lo que guardas (de tu capital o de lo que te sobra al
// mes, cada parte con «Quitar») y lo que rinde = lo que tienes al terminar. Solo el total va resaltado; debajo se abre de dónde sale,
// año por año, desde que empieza tu plan.
export function ReservaAnio({ r, g, sig, cuenta = [], cfg, set, anio, tasaR }) {
  const [verTasa, setVerTasa] = useState(false);
  const [verOrigen, setVerOrigen] = useState(false);
  const tasaPropia = !(cfg.reservaTasaPct === "" || cfg.reservaTasaPct == null);
  const p = partesReserva(g, sig);
  const hayAntes = p.vuelve > 0.5 || p.sacas > 0.5 || p.uso > 0.5;
  const nada = p.empieza + p.guardas < 0.5;
  const quitarCapital = () => { const x = { ...(cfg.reservaAnual || {}) }; delete x[anio]; set("reservaAnual", x); };
  const quitarMesTodo = () => { const x = { ...(cfg.mesAReserva || {}) }; delete x[anio]; set("mesAReserva", x); };
  const quitarMesFijo = () => { const x = { ...(cfg.mesReparto || {}) }; const arr = (Array.isArray(x[anio]) ? x[anio] : []).filter((f) => f && f.tipo !== "reserva"); if (arr.length) x[anio] = arr; else delete x[anio]; set("mesReparto", x); };
  const A = anioCal(anio), antA = anio > 1 ? anioCal(anio - 1) : null, sigA = sig ? anioCal(sig.anio) : null;
  const notaGuardada = p.guardada > 0.5 ? tx(`De esto, ${plata(Math.round(p.guardada))} están guardados para un año siguiente y vuelven solos ese año.`, `Of this, ${plata(Math.round(p.guardada))} is kept for a later year and returns on its own.`) : null;
  const notaEmpieza = [anio === 1 ? tx("Tu plan empieza sin fondo de reserva.", "Your plan starts with no reserve fund.") : p.empieza > 0.5 ? tx(`Es lo que tenías al terminar ${antA}.`, `It's what you had at the end of ${antA}.`) : tx(`Al terminar ${antA} no tenías reserva.`, `You had no reserve at the end of ${antA}.`), !hayAntes && notaGuardada].filter(Boolean).join(" ");
  const promedioMes = (v) => tx(`En promedio, ${plata(Math.round(v / 12))} al mes durante los 12 meses de ${A}.`, `On average ${plata(Math.round(v / 12))} a month over the 12 months of ${A}.`);
  return <div id="f10-reserva" style={{ flex: "1 1 260px", minWidth: 0, background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 10, padding: "12px 14px", display: "grid", gap: 6, alignContent: "start" }}>
    <div style={{ fontSize: 15, fontWeight: 600, color: C.tx }}>{tx("Tu fondo de reserva", "Your reserve fund")}</div>
    <div style={{ fontSize: 12.5, color: C.tx2, lineHeight: 1.45 }}>{tx("Plata guardada aparte para cualquier emergencia.", "Money kept aside for any emergency.")} {nada
      ? tx("Aún no tienes: la empiezas con «Guardar en tu reserva», de tu capital, o con «Ahorrar en tu reserva», de lo que te sobra al mes.", "You don't have one yet: start it with \"Keep in your reserve\" from your capital, or \"Save in your reserve\" from your monthly surplus.")
      : tx(`Rinde ${tasaR} al año${tasaPropia ? " (el que escribiste)" : esUS() ? "" : " (el promedio de un CDT a un año)"} y no hace parte de tu capital disponible: la usas cuando la necesites, y si un año no te alcanza la plata, se usa sola.`, `It earns ${tasaR} a year${tasaPropia ? " (your rate)" : ""} and isn't part of your available capital: use it when you need it; if a year falls short it's used automatically.`)}
      {" "}<button type="button" onClick={() => setVerTasa(!verTasa)} aria-expanded={verTasa} style={{ ...enlace, color: C.tx2, fontSize: 12.5 }}>{verTasa ? tx("Listo", "Done") : tx("Cambiar el rendimiento", "Change the rate")}</button></div>
    {verTasa && r && <TasaReserva r={r} cfg={cfg} set={set} />}
    {!nada && <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
      <FilaSuma l={tx(`Tienes al empezar ${A}`, `You have at the start of ${A}`)} v={p.empieza} nota={notaEmpieza} />
      {p.vuelve > 0.5 && <FilaSuma l={tx(`− Vuelve a tu capital disponible: la guardaste para ${A}`, `− Returns to your available capital: you kept it for ${A}`)} v={p.vuelve} />}
      {p.sacas > 0.5 && <FilaSuma l={tx(`− Sacas para tu capital disponible de ${A}`, `− You take it into your ${A} available capital`)} v={p.sacas} />}
      {p.uso > 0.5 && <FilaSuma l={tx(`− Se usa sola: en ${A} no alcanza para vivir y pagar lo comprometido`, `− Used automatically: ${A} falls short`)} v={p.uso} />}
      {hayAntes && <FilaSuma linea l={tx(`= Te queda en tu reserva en ${A}`, `= Left in your reserve in ${A}`)} v={p.queda} nota={notaGuardada} />}
      {p.deCapital > 0.5 && <FilaSuma l={tx(`+ Guardas de tu capital disponible de ${A}`, `+ You keep from your ${A} available capital`)} v={p.deCapital} quitar={quitarCapital} />}
      {p.deMesFijo > 0.5 && <FilaSuma l={tx("+ Guardas de lo que te sobra al mes", "+ You save from your monthly surplus")} v={p.deMesFijo} quitar={quitarMesFijo} nota={promedioMes(p.deMesFijo)} />}
      {p.deMesTodo > 0.5 && <FilaSuma l={tx("+ Guardas todo lo que te sobra al mes", "+ You save all your monthly surplus")} v={p.deMesTodo} quitar={quitarMesTodo} nota={promedioMes(p.deMesTodo)} />}
      {p.otros > 0.5 && <FilaSuma l={tx("+ Otros aportes a tu reserva", "+ Other additions to your reserve")} v={p.otros} />}
      {p.rinde > 0.5 && <FilaSuma l={tx(`+ Rinde en ${A} (${tasaR} al año)`, `+ Earns in ${A} (${tasaR} a year)`)} v={p.rinde} />}
      <FilaSuma fuerte linea l={tx(`= Tienes al terminar ${A}`, `= You have at the end of ${A}`)} v={p.fin} col={p.fin > 0.5 ? C.gn : C.tx2} nota={sigA ? tx(`Con esto empiezas ${sigA}.`, `You start ${sigA} with this.`) : null} />
      {anio > 1 && p.fin > 0.5 && <button type="button" onClick={() => setVerOrigen(!verOrigen)} aria-expanded={verOrigen} style={{ ...enlace, color: C.tx2, fontSize: 12.5, justifySelf: "start", textAlign: "left" }}>{verOrigen ? tx("Ocultar de dónde sale", "Hide where it comes from") : tx(`¿De dónde salen los ${plata(p.fin)}?`, `Where does ${plata(p.fin)} come from?`)}</button>}
      {verOrigen && <OrigenReserva cuenta={cuenta} anio={anio} />}
    </div>}
    {anio > 1 && p.libre > 0.5 && <UsarReserva g={g} cfg={cfg} set={set} anio={anio} compacto />}
  </div>;
}
// Un renglón de una suma pequeña: el texto a la izquierda, la cifra a la derecha y, si hace falta, de dónde sale debajo. Todos del mismo
// tamaño; solo el total (fuerte) se resalta, para que ningún renglón parezca el resultado.
function FilaSuma({ l, v, fuerte, col, quitar, nota, linea }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", columnGap: 10, alignItems: "baseline", ...(linea ? { borderTop: `1px solid ${C.bd}`, paddingTop: 6, marginTop: 2 } : {}) }}>
    <span style={{ fontSize: fuerte ? 14 : 13, fontWeight: fuerte ? 600 : 400, color: fuerte ? C.tx : C.tx2, lineHeight: 1.4 }}>{l}{quitar && <button type="button" onClick={quitar} style={{ ...enlace, color: C.tx2, fontSize: 12, marginLeft: 8 }}>{tx("Quitar", "Remove")}</button>}</span>
    <span style={{ fontSize: fuerte ? 15 : 13, fontWeight: fuerte ? 600 : 400, color: col || C.tx, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{plata(Math.round(Math.abs(v)))}</span>
    {nota && <span style={{ gridColumn: "1 / -1", fontSize: 12, color: C.tx2, lineHeight: 1.4 }}>{nota}</span>}
  </div>;
}
// De dónde sale lo que tienes en tu reserva, desde que empieza tu plan hasta el final del año que ves: cada parte dice de dónde vino y en
// qué años, y la suma da exacto lo que tienes al terminar.
function OrigenReserva({ cuenta, anio }) {
  const o = origenReserva(cuenta, anio), A = anioCal(anio), A1 = anioCal(1);
  const anios = (xs) => xs.map((x) => `${anioCal(x.anio)}: ${plata(Math.round(x.v))}`).join(" · ");
  const t = o.total;
  return <div style={{ display: "grid", gap: 6, borderLeft: `2px solid ${C.bd}`, paddingLeft: 10 }}>
    <div style={{ fontSize: 12.5, color: C.tx2, lineHeight: 1.4 }}>{tx(`Desde ${A1}, cuando empieza tu plan, hasta el final de ${A}:`, `From ${A1}, when your plan starts, to the end of ${A}:`)}</div>
    {o.inicial > 0.5 && <FilaSuma l={tx(`Tenías al empezar ${A1}`, `You had at the start of ${A1}`)} v={o.inicial} />}
    {t.capital > 0.5 && <FilaSuma l={tx("+ Guardaste de tu capital disponible", "+ Kept from your available capital")} v={t.capital} nota={anios(o.capital)} />}
    {t.mes > 0.5 && <FilaSuma l={tx("+ Guardaste de lo que te sobraba al mes", "+ Saved from your monthly surplus")} v={t.mes} nota={anios(o.mes)} />}
    {t.otros > 0.5 && <FilaSuma l={tx("+ Otros aportes a tu reserva", "+ Other additions")} v={t.otros} nota={anios(o.otros)} />}
    {t.rinde > 0.5 && <FilaSuma l={tx("+ Rindió", "+ Earned")} v={t.rinde} nota={anios(o.rinde)} />}
    {t.sacas > 0.5 && <FilaSuma l={tx("− Sacaste para tu capital disponible", "− Taken into your available capital")} v={t.sacas} nota={anios(o.sacas)} />}
    {t.uso > 0.5 && <FilaSuma l={tx("− Se usó sola para vivir", "− Used automatically for living costs")} v={t.uso} nota={anios(o.uso)} />}
    {t.vuelve > 0.5 && <FilaSuma l={tx("− Volvió a tu capital disponible: la guardaste para ese año", "− Returned to your available capital")} v={t.vuelve} nota={anios(o.vuelve)} />}
    <FilaSuma fuerte linea l={tx(`= Tienes al terminar ${A}`, `= You have at the end of ${A}`)} v={o.fin} />
  </div>;
}
// 24-nov-2026 (Santiago: "de lo que sobra cada mes, ¿qué quiere hacer? abonar a deudas mensualmente, abonar a inversión existente
// mensualmente, gastar para ocio, o ahorrar mensualmente en el fondo de reserva, que está disponible para cuando se quiera usar en un
// año siguiente"; "lo que sobra pasa al año siguiente como saldo disponible"). Cuatro opciones en verde que abren un formulario corto;
// cada fila del año va al mes y al año, con su acción; al final, lo que pasa al año siguiente.
function RepartoMes({ r, cfg, set, g, anio, Y, sigY, regla, reinv, tasaR }) {
  const [abierto, setAbierto] = useState(null); // "deuda" | "inversion" | "gasto" | "reserva"
  const [form, setForm] = useState({});
  const filas = Array.isArray((cfg.mesReparto || {})[anio]) ? cfg.mesReparto[anio] : [];
  const ponerFilas = (arr) => { const x = { ...(cfg.mesReparto || {}) }; if (arr.length) x[anio] = arr; else delete x[anio]; set("mesReparto", x); };
  const libre = Math.max(0, (g.mes || 0) - (g.repartoFuera || 0) - (g.repartoReserva || 0)); // al año
  const abrir = (k) => { setAbierto((a) => (a === k ? null : k)); setForm({ mensual: libre > 0.5 ? Math.round(libre / 12) : "" }); };
  const deudas = (r.deudas || []).filter((d) => d && !d.unica && !(d.pagado > 0.5) && !d.porVenta && d.saldo > 0.5 && (!d.pagaAnio || d.pagaAnio > anio) && (!d.ventaAnio || d.ventaAnio > anio) && (!d.finAbono || d.finAbono >= anio) && (d.finNatural == null || d.finNatural > anio));
  const invs = opcionesParaMeter(r, cfg, anio).filter((a) => !a.noDisp);
  const listo = !!abierto && Number(form.mensual) > 0 && (abierto === "gasto" || abierto === "reserva" || !!form.id);
  const agregar = () => { if (!listo) return; ponerFilas([...filas, { tipo: abierto, id: form.id || null, mensual: Number(form.mensual), nombre: abierto === "gasto" ? String(form.nombre || "").trim() : "" }]); setAbierto(null); };
  const quitar = (i) => ponerFilas(filas.filter((_, j) => j !== i));
  const setCfgRegla = () => { set("sobraDestinos", []); set("sobraPctAnios", {}); };
  const quitarReservaTodo = () => { const x = { ...(cfg.mesAReserva || {}) }; delete x[anio]; set("mesAReserva", x); };
  const opciones = [["deuda", tx("Abonar a una deuda", "Pay down a debt")], ["inversion", tx("Invertir en lo que tienes", "Invest in what you own")], ["gasto", tx("Gastar (ocio, viajes)", "Spend (leisure, travel)")], ["reserva", tx("Ahorrar en tu reserva", "Save in your reserve")]];
  const celda = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const accion = (txt, on) => <button type="button" onClick={on} style={{ ...enlace, fontSize: 12.5, color: C.tx2, padding: 0 }}>{txt}</button>;
  // En celular el nombre va en su línea y las cifras debajo; en pantalla grande, en una sola línea con las columnas alineadas.
  const cifras = (a, b, c, st = {}) => <span style={{ display: "flex", gap: 14, marginLeft: "auto", alignItems: "baseline" }}>
    <span style={{ ...celda, width: 118, ...st }}>{a}</span><span style={{ ...celda, width: 128, ...st }}>{b}</span><span style={{ width: 48, textAlign: "right" }}>{c}</span>
  </span>;
  const fila = (key, { l, v, col, acc, nota, fuerte, linea }) => <div key={key} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 14, rowGap: 2, ...(linea ? { borderTop: `1px solid ${C.bd}`, paddingTop: 8, marginTop: 2 } : {}) }}>
    <span style={{ flex: "1 1 220px", minWidth: 0, color: fuerte ? C.tx : C.tx2, fontWeight: fuerte ? 600 : 400 }}>{l}</span>
    {cifras(plata(Math.round(Math.abs(v) / 12)), plata(Math.round(Math.abs(v))), acc || null, { color: col || C.tx, fontWeight: fuerte ? 600 : 400 })}
    {nota && <span style={{ flexBasis: "100%", fontSize: 12, color: C.tx2 }}>{nota}</span>}
  </div>;
  const aparte = (g.mes || 0) - Math.max(0, (g.flujo || 0) - (g.cubreMes || 0));
  const lbl = { fontSize: 12, color: C.tx2, display: "grid", gap: 4, minWidth: 0 };
  return <>
    <Etq>{tx("¿Qué haces con lo que te sobra cada mes?", "What do you do with your monthly surplus?")}</Etq>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opciones.map(([k, l]) => <button key={k} type="button" aria-expanded={abierto === k} onClick={() => abrir(k)} style={btnAccion(abierto === k)}>{l}</button>)}
    </div>
    {abierto && <div style={{ border: `1px solid ${C.gn}`, borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10, alignItems: "end" }}>
        {abierto === "deuda" && <label style={lbl}>{tx("¿A cuál deuda?", "Which debt?")}<select style={inp} value={form.id || ""} onChange={(e) => setForm({ ...form, id: e.target.value })}><option value="">{tx("Elige la deuda", "Choose the debt")}</option>{deudas.map((d) => <option key={d.id} value={d.id}>{`${d.nombre} · ${tx("debes", "owe")} ${plata(Math.round(d.saldo))}`}</option>)}</select></label>}
        {abierto === "inversion" && <label style={lbl}>{tx("¿En cuál inviertes?", "Which one?")}<select style={inp} value={form.id || ""} onChange={(e) => setForm({ ...form, id: e.target.value })}><option value="">{tx("Elige la inversión", "Choose the investment")}</option><OpcionesAportar libres={invs.map((a) => ({ ...a, nota: undefined }))} /></select></label>}
        {abierto === "gasto" && <label style={lbl}>{tx("¿En qué? (opcional)", "On what? (optional)")}<input style={inp} value={form.nombre || ""} placeholder={tx("Ej.: viajes, ocio", "e.g. travel, leisure")} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>}
        <label style={lbl}>{tx(`¿Cuánto al mes? ($, pesos de ${anio === 1 ? "hoy" : Y})`, `How much a month? ($)`)}<NumberInput style={inp} value={form.mensual ?? ""} onChange={(v) => setForm({ ...form, mensual: v })} /></label>
      </div>
      {abierto === "deuda" && deudas.length === 0 && <div style={{ ...TIPO.meta, marginTop: 8 }}>{tx(`No tienes deudas con saldo en ${anio === 1 ? "este año" : Y}.`, `You have no debts with a balance in ${Y}.`)}</div>}
      {abierto === "deuda" && <div style={{ ...TIPO.meta, marginTop: 8 }}>{tx("Baja lo que debes. Si con tus abonos la terminas de pagar, su cuota deja de salir desde el año siguiente.", "It lowers what you owe. If your extra payments finish it, its installment stops the following year.")}</div>}
      {abierto === "inversion" && <div style={{ ...TIPO.meta, marginTop: 8 }}>{tx("Se suma a esa inversión mes a mes y rinde como ella.", "It's added to that investment month by month and earns like it.")}</div>}
      {abierto === "gasto" && <div style={{ ...TIPO.meta, marginTop: 8 }}>{tx("Lo gastas: no se invierte ni pasa al año siguiente.", "You spend it: it isn't invested or carried over.")}</div>}
      {abierto === "reserva" && <div style={{ ...TIPO.meta, marginTop: 8 }}>{tx(`Queda en tu fondo de reserva: rinde ${tasaR} y está disponible para cuando la quieras usar en un año siguiente.`, `It stays in your reserve fund: earns ${tasaR} and is available whenever you want to use it in a later year.`)}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" disabled={!listo} onClick={agregar} style={{ ...btn(listo), padding: "8px 14px", opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "not-allowed" }}>{tx("Agregar", "Add")}</button>
        <button type="button" onClick={() => setAbierto(null)} style={{ ...btn(false), padding: "8px 14px" }}>{tx("Cancelar", "Cancel")}</button>
        <span style={TIPO.meta}>{tx(`Te quedan ${plata(Math.round(libre / 12))} al mes por repartir.`, `${plata(Math.round(libre / 12))} a month left to allocate.`)}</span>
      </div>
    </div>}
    <div style={{ display: "grid", rowGap: 6, fontSize: 14, marginTop: 12 }}>
      <div style={{ display: "flex" }}>{cifras(tx("al mes", "a month"), tx("al año", "a year"), null, { fontSize: 12, color: C.tx2 })}</div>
      {reinv > 0.5 && fila("regla", { l: tx(`− Se reinvierte solo (${Math.round(regla.pct)} %) en ${regla.destinos.join(", ")}`, `− Reinvested automatically (${Math.round(regla.pct)}%) in ${regla.destinos.join(", ")}`), v: reinv, col: C.tx2, acc: accion(tx("Quitar", "Remove"), () => setCfgRegla()), nota: tx("Es una regla de antes y aplica a todos tus años. Si la quitas, decides con los botones de arriba qué haces con lo que te sobra.", "It's an old rule that applies to all your years. Remove it and decide with the buttons above what to do with your surplus.") })}
      {g.cubreMes > 0.5 && fila("cubre", { l: tx("− Paga lo comprometido que no cabía en tu capital", "− Pays commitments that didn't fit your capital"), v: g.cubreMes, col: C.tx2 })}
      {aparte > 0.5 && fila("aparte", { l: tx("+ Lo que apartaste para vivir y ya no hizo falta", "+ What you set aside for living and didn't need"), v: aparte })}
      {(g.reparto || []).filter((x) => x.tipo !== "nada").map((x) => fila("rep" + x.i, { l: `− ${x.nombre}`, v: x.usado, acc: accion(tx("Quitar", "Remove"), () => quitar(x.i)),
        nota: x.usado + 0.5 < x.pedido ? (x.tipo === "deuda" && x.usado > 0.5 ? tx(`Con ${plata(Math.round(x.usado / 12))} al mes la terminas de pagar este año.`, `${plata(Math.round(x.usado / 12))} a month finishes it this year.`) : tx(`Pediste ${plata(Math.round(x.pedido / 12))} al mes: solo alcanzan ${plata(Math.round(x.usado / 12))}.`, `You asked for ${plata(Math.round(x.pedido / 12))} a month: only ${plata(Math.round(x.usado / 12))} fits.`)) : x.tipo === "reserva" ? tx(`Rinde ${tasaR}; la usas en un año siguiente.`, `Earns ${tasaR}; use it in a later year.`) : null }))}
      {g.mesAReserva && fila("todo-res", { l: tx("− A tu reserva: todo lo que queda", "− To your reserve: everything left"), v: libre, acc: accion(tx("Quitar", "Remove"), quitarReservaTodo) })}
      {fila("pasa", { l: tx("= Te queda de lo que te sobra al mes", "= Left from your monthly surplus"), v: g.mesAReserva ? 0 : libre, col: C.gn, fuerte: true, linea: true,
        nota: !g.mesAReserva && (g.porInvertir || 0) < -1 ? tx(`De esto, ${plata(Math.round(Math.min(libre, -g.porInvertir)))} cubren lo que te pasaste en tu capital.`, `Of this, ${plata(Math.round(Math.min(libre, -g.porInvertir)))} covers what you went over in your capital.`)
          : sigY && !g.mesAReserva && libre > 0.5 ? tx(`Pasa a ${sigY} como capital disponible.`, `It carries to ${sigY} as available capital.`) : null })}
    </div>
  </>;
}
// 24-nov-2026 (Santiago: "¿me quedó de tu mes 446 MM? Eso es incorrecto: me queda a fin de año"; "cada valor debemos entender qué es y
// de dónde proviene"). El cierre de un año suma de arriba abajo: tu capital disponible (el de arriba), lo que hiciste con él, lo que te
// sobró en el año mes a mes (con su promedio al mes) y lo que va a tu reserva = lo que pasa al año siguiente como capital disponible.
// Aparte, tu fondo de reserva al terminar el año y cómo se formó. Lo usan «3 · Así cierra» y «Así quedó tu año».
export function SumaCierre({ g, sig, anio, cf = 0 }) {
  const A = anioCal(anio), sigY = sig ? anioCal(sig.anio) : null, R = (v) => plata(Math.round(v));
  const deCap = Math.min(g.reservaDeAqui || 0, g.aReserva || 0), deMes = Math.max(0, (g.aReserva || 0) - deCap);
  const mesQueda = (g.mes || 0) - (g.repartoFuera || 0);
  const reinvSolo = cf > 0.5 ? Math.max(0, cf - (g.flujo || 0)) : 0;
  const nInv = (g.movidas || []).filter((m) => m.cuenta).length;
  const sinEsto = [reinvSolo > 0.5 && tx(`lo que se reinvierte solo (${R(reinvSolo)} en el año)`, `what's reinvested automatically (${R(reinvSolo)} a year)`),
    (g.repartoFuera || 0) > 0.5 && tx(`lo que repartiste en abonos, inversiones y gastos (${R(g.repartoFuera)} en el año)`, `what you allocated to payments, investments and spending (${R(g.repartoFuera)} a year)`)].filter(Boolean);
  const notaMes = tx(`En promedio, ${R(Math.abs(mesQueda) / 12)} al mes durante los 12 meses${mesQueda > 0 && sinEsto.length ? `, ya sin ${sinEsto.join(" ni ")}` : ""}.`, `On average ${R(Math.abs(mesQueda) / 12)} a month over the 12 months.`);
  const p = partesReserva(g, sig);
  const formo = [p.empieza > 0.5 ? tx(`tenías ${R(p.empieza)} al empezar ${A}`, `you had ${R(p.empieza)} at the start of ${A}`) : tx(`empiezas ${A} sin reserva`, `you start ${A} with no reserve`),
    p.vuelve > 0.5 && tx(`vuelven a tu capital ${R(p.vuelve)}`, `${R(p.vuelve)} returns to your capital`), p.sacas > 0.5 && tx(`sacas ${R(p.sacas)}`, `you take out ${R(p.sacas)}`),
    p.uso > 0.5 && tx(`se usan solos ${R(p.uso)}`, `${R(p.uso)} is used automatically`), p.guardas > 0.5 && tx(`guardas ${R(p.guardas)}`, `you keep ${R(p.guardas)}`),
    p.rinde > 0.5 && tx(`rinde ${R(p.rinde)}`, `it earns ${R(p.rinde)}`)].filter(Boolean);
  const frase = formo.length > 1 ? `${formo.slice(0, -1).join(", ")}${tx(" y ", " and ")}${formo[formo.length - 1]}` : formo[0];
  const notaReserva = `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.${p.guardadaFin > 0.5 ? tx(` De esto, ${R(p.guardadaFin)} están guardados para un año siguiente.`, ` Of this, ${R(p.guardadaFin)} is kept for a later year.`) : ""}${sigY ? tx(` Con esto empiezas ${sigY}.`, ` You start ${sigY} with this.`) : ""}`;
  const pasa = g.pasa || 0;
  return <>
    <Renglon l={tx(`Capital disponible de ${A}`, `Available capital for ${A}`)} v={g.disponible || 0} nota={tx(`Es el de arriba, en «${anio === 1 ? "Tienes este año" : `Tienes en ${A}`}».`, "The same one shown at the top.")} />
    {(g.faltaSinCubrir || 0) > 0.5 && <Renglon l={tx("− Te falta para vivir y pagar lo comprometido, y tu reserva no alcanza", "− Short for living costs and commitments, and your reserve doesn't cover it")} v={g.faltaSinCubrir} col={C.rd} />}
    {(g.movido || 0) > 0.5 && <Renglon l={tx(`− Invertiste (${nInv} ${nInv === 1 ? "inversión" : "inversiones"})`, `− You invested (${nInv})`)} v={g.movido} />}
    {deCap > 0.5 && <Renglon l={tx("− A tu fondo de reserva, de tu capital", "− To your reserve fund, from your capital")} v={deCap} />}
    {Math.abs(mesQueda) > 0.5 && <Renglon l={mesQueda > 0 ? tx(`+ Te sobró en ${A}, mes a mes`, `+ Your surplus in ${A}, month by month`) : tx(`− Te faltó en ${A}, mes a mes`, `− Your shortfall in ${A}, month by month`)} v={mesQueda} col={mesQueda > 0 ? C.gn : C.am} nota={notaMes} />}
    {deMes > 0.5 && <Renglon l={tx("− A tu fondo de reserva, de lo que te sobra al mes", "− To your reserve fund, from your monthly surplus")} v={deMes} />}
    {(g.queda || 0) < -0.5 ? <Renglon fuerte linea l={tx("= Te falta", "= Short")} v={g.queda} col={C.rd} nota={tx("Sale de tus cuentas e inversiones líquidas. Baja un monto o pásalo a otro año si prefieres no tocarlas.", "It comes out of your accounts and liquid investments. Lower an amount or move it to another year if you'd rather not touch them.")} />
      : <Renglon fuerte linea l={sigY ? tx(`= Pasa a ${sigY} como capital disponible`, `= Carries to ${sigY} as available capital`) : tx(`= Te queda al terminar ${A}`, `= Left at the end of ${A}`)} v={pasa} col={pasa > 0.5 ? C.gn : C.tx}
        nota={sigY && pasa > 0.5 ? tx(`Para invertir o pagar deudas en ${sigY}. Mientras no lo uses, no rinde: si es para algo que viene, guárdalo en tu reserva.`, `To invest or pay off debt in ${sigY}. It earns nothing until you use it: if it's for something coming up, keep it in your reserve.`) : null} />}
    {p.empieza + p.guardas > 0.5 && <>
      <Etq>{tx("Tu fondo de reserva", "Your reserve fund")}</Etq>
      <Renglon l={tx(`Tienes al terminar ${A}`, `You have at the end of ${A}`)} v={p.fin} nota={notaReserva} />
    </>}
  </>;
}
// 4 · Así te queda el año (Santiago: "al final, después de mover inversiones del año, un resultado
// final: el 2026 le sobran al mes tanto y anual tanto; ¿qué desea hacer con eso? ahorrar en fondo
// de reserva para años futuros, una inversión de renta corta, o dejarlo disponible para inversiones
// del año siguiente").
function ResultadoAnio({ r, cfg, cuenta, anioSel, setAnioSel, dejarListo, irAnio }) {
  const g = cuenta.find((y) => y.anio === anioSel);
  if (!g) return null;
  const N = cuenta.length, anio = g.anio, Y = nombreAnio(anio);
  const sig = cuenta.find((y) => y.anio === anio + 1), sigY = anio < N ? anioCal(anio + 1) : null;
  const ir = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50); };
  const cambiosSig = sig ? cambiosDelAnio(r, cfg, sig.anio, sig.foto || {}).filter((c) => c.mes != null && c.mes < 0).map((c) => c.nombre) : [];
  const listo = !!(cfg.aniosListos || {})[anio], problema = g.faltaSinCubrir > 0.5 || g.porInvertir < -1;
  // 24-nov-2026 (Santiago: "quedaría cada año con el resumen de lo que se hizo"; "¿me quedó de tu mes 446 MM? Me queda a fin de año").
  // Arriba, con lo que terminas el año: el capital disponible que pasa al siguiente (lo más importante). Debajo, la suma que lo explica
  // y tu fondo de reserva al terminar el año, con cómo se formó.
  const A = anioCal(anio), falta = g.queda < -0.5, pasa = g.pasa || 0;
  return <Ficha tam={24} id="f10-resultado-anio" titulo={tx(`3 · Así cierra ${anio === 1 ? "este año" : Y}`, `3 · How ${anio === 1 ? "this year" : Y} ends`)}
    sub={sigY ? tx(`Con lo que terminas ${A}: el capital disponible que pasa a ${sigY} y tu fondo de reserva.`, `What you end ${A} with: the available capital that carries to ${sigY} and your reserve fund.`) : tx(`Con lo que terminas ${A}: tu capital disponible y tu fondo de reserva.`, `What you end ${A} with: your available capital and your reserve fund.`)}
    cifra={`${falta ? "−" : ""}${plata(Math.round(falta ? -g.queda : pasa))}`} cifraSub={falta ? tx("te falta", "short") : sigY ? tx(`de capital disponible para ${sigY}`, `available capital for ${sigY}`) : tx(`de capital disponible al terminar ${A}`, `available capital at the end of ${A}`)} col={falta ? C.rd : pasa > 0.5 ? C.gn : C.tx}>
    <SumaCierre g={g} sig={sig} anio={anio} cf={((r.filas || [])[anio] || {}).cf || 0} />
    {/* Lo que viene el año siguiente: si te va a faltar para vivir, se dice con qué se cubre. */}
    {sig && sig.flujoFoto < -0.5 && <div style={{ fontSize: 12.5, color: C.tx, marginTop: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
      {tx(`En ${anioCal(sig.anio)} te van a faltar unos ${plata(Math.round(-sig.flujoFoto / 12))} al mes para vivir${cambiosSig.length ? ` (${cambiosSig.slice(0, 2).join(", ")})` : ""}. `, `In ${anioCal(sig.anio)} you'll be about ${plata(Math.round(-sig.flujoFoto / 12))} a month short on living costs${cambiosSig.length ? ` (${cambiosSig.slice(0, 2).join(", ")})` : ""}. `)}
      {sig.faltaSinCubrir > 0.5 ? <b style={{ color: C.rd }}>{tx(`Con lo que tengas ese año y tu fondo de reserva no alcanza: faltarían ${plata(Math.round(sig.faltaSinCubrir))}. Guarda más en tu reserva o haz que una inversión te pague cada mes.`, `What you'll have that year plus your reserve won't cover it: ${plata(Math.round(sig.faltaSinCubrir))} short. Save more in your reserve or have an investment pay you monthly.`)}</b>
        : sig.usoReserva > 0.5 ? tx(`Lo cubres con lo que tengas ese año y ${plata(Math.round(sig.usoReserva))} de tu fondo de reserva.`, `You cover it with what you'll have that year and ${plata(Math.round(sig.usoReserva))} from your reserve fund.`)
          : tx("Lo cubres con lo que tengas ese año.", "You cover it with what you'll have that year.")}
    </div>}
    {/* 24-nov-2026 (Santiago: "llené hoy qué hacer con la plata pero no queda claro que ya quedó ok y que sigue el 2027, y así sucesivamente"). */}
    {problema && <div style={{ fontSize: 12.5, color: C.rd, marginTop: 12 }}>{tx("Antes de seguir, revisa este año: te pasaste o falta plata.", "Before moving on, check this year: you went over or you're short.")}</div>}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      {anio > 1 ? <button type="button" style={{ ...btn(false), padding: "8px 12px" }} onClick={() => ir(anio - 1)}>← {anio === 2 ? tx("Hoy", "Today") : anioCal(anio - 1)}</button> : <span />}
      {listo && !problema ? (sigY ? <button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => (irAnio ? irAnio(anio + 1) : ir(anio + 1))}>{tx(`Seguir con ${sigY} →`, `Go on to ${sigY} →`)}</button> : <button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => dejarListo && dejarListo(anio)}>{tx("Ver el resultado →", "See the result →")}</button>)
        : <button type="button" disabled={problema} style={{ ...btn(true), padding: "8px 12px", opacity: problema ? 0.5 : 1, cursor: problema ? "not-allowed" : "pointer" }} onClick={() => dejarListo && dejarListo(anio)}>{sigY ? tx(`Terminé ${anioCal(anio)}, seguir con ${sigY} →`, `Done with ${anioCal(anio)}, go on to ${sigY} →`) : tx(`Terminé ${anioCal(anio)}, ver el resultado →`, `Done with ${anioCal(anio)}, see the result →`)}</button>}
    </div>
  </Ficha>;
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
  const pctCubre = cand ? [25, 50, 75, 100].find((p) => cand.a.crece * p / 100 >= falta) : null;
  const pct = cand ? pctCubre || 100 : null, alcanza = !!pctCubre;
  const Yx = anio === 1 ? tx("este año", "this year") : anioCal(anio);
  const pagarEnAnio = () => set("nuevas", cfg.nuevas.map((x, j) => (j === cand.k ? { ...x, pagaAnios: { ...(x.pagaAnios || {}), [anio]: pct } } : x)));
  const anioDe = Object.fromEntries((r.nuevasDetalle || []).map((x) => [x.id, x.anio || 1]));
  const repetido = (a) => reinv.filter((b) => b.nombre === a.nombre).length > 1;
  const nomDe = (a) => (repetido(a) && anioDe[a.id] ? tx(`${a.nombre} (desde ${anioCal(anioDe[a.id])})`, `${a.nombre} (since ${anioCal(anioDe[a.id])})`) : a.nombre);
  const top = reinv.slice(0, 3).map((a) => ({ ...a, nombre: nomDe(a) }));
  if (!top.length) return null;
  return <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.5, margin: "4px 0 6px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 10px" }}>
    {tx(`¿Por qué te falta? Tus inversiones sí producen, pero ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} al mes)`).join(", ")} reinvierten todo lo que ganan: eso no entra a tu mes.`, `Why the shortfall? Your investments do earn, but ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} a month)`).join(", ")} reinvest everything they earn: that doesn't reach your month.`)}
    {/* 24-nov-2026 (Santiago: "que me diga: puede cambiar el porcentaje de lo que reinvierte de estas inversiones, pero para ese año, no para todos"). */}
    {cand && pct && <div style={{ marginTop: 8 }}><button type="button" style={{ ...btn(true), padding: "8px 12px", textAlign: "left" }} onClick={pagarEnAnio}>{tx(`Que ${nomDe(cand.a)} me pague ${pct === 100 ? "todo lo que rinde" : `el ${pct} % de lo que rinde`} en ${Yx} (unos ${plata(Math.round(cand.a.crece * pct / 100 / 12))} al mes)`, `Have ${nomDe(cand.a)} pay me ${pct === 100 ? "all it earns" : `${pct}% of what it earns`} in ${Yx} (about ${plata(Math.round(cand.a.crece * pct / 100 / 12))} a month)`)}</button>
      <div style={{ marginTop: 4 }}>{alcanza ? tx(`Solo ${anio === 1 ? "este año" : "en " + anioCal(anio)}: los demás años sigue reinvirtiendo. Lo que sacas deja de crecer, por eso conviene solo en los años que lo necesitan.`, `Only ${anio === 1 ? "this year" : "in " + anioCal(anio)}: the other years it keeps reinvesting. What you take out stops growing, so it's best only in the years that need it.`) : tx(`Cubre una parte de lo que falta, solo ${anio === 1 ? "este año" : "en " + anioCal(anio)}. El resto sale de lo que tienes ese año o de tu reserva.`, `It covers part of the shortfall, only ${anio === 1 ? "this year" : "in " + anioCal(anio)}. The rest comes from your reserve or what you carry.`)}{" "}
        <button type="button" onClick={() => set("nuevas", cfg.nuevas.map((x, j) => (j === cand.k ? { ...x, pctRecibe: pct } : x)))} style={{ background: "transparent", border: "none", padding: 0, color: C.tx2, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tx("Prefiero que sea todos los años", "I'd rather do it every year")}</button></div></div>}
  </div>;
}
// 24-nov-2026 (Santiago: "recuerda anticipar un fondo de emergencia para el año que viene: se recomienda al menos 6 meses de costos
// fijos garantizados; eso equivale a X según tu flujo; hoy una renta corta en Colombia, un CDT, está en un rango de X y X %: elige un valor
// y pon la tasa"; "que no sea una tasa fija ni un valor fijo que uno no pueda editar"). El monto sugerido y el rendimiento se cambian aquí.
function FondoEmergencia({ r, cfg, set, sigY, gastosMes, meta, reservaSig, falta, sugerido, extra, guardar }) {
  const sug = Math.round(sugerido);
  const [monto, setMonto] = useState(sug);
  useEffect(() => { setMonto(sug); }, [sug]);
  const ok = Number(monto) > 0;
  const para = sigY || tx("el año que viene", "next year");
  const p = { margin: 0, fontSize: 13, color: C.tx, lineHeight: 1.5 };
  return <div style={{ background: "rgba(0,200,5,0.06)", border: "1px solid rgba(0,200,5,0.35)", borderRadius: 10, padding: "12px 14px", margin: "10px 0 0", display: "grid", gap: 6 }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{tx("Lo seguro primero: tu fondo de emergencia", "Safety first: your emergency fund")}</div>
    <p style={p}>{tx(`Ten un fondo de emergencia para ${para}: se recomienda al menos 6 meses de lo que te cuesta vivir. Según tu flujo, eso son ${plata(Math.round(meta))} (${plata(Math.round(gastosMes))} al mes).`, `Keep an emergency fund for ${para}: at least 6 months of your living costs is recommended. Based on your cash flow, that's ${plata(Math.round(meta))} (${plata(Math.round(gastosMes))} a month).`)}</p>
    <p style={p}>{reservaSig > 0.5 ? tx(`Para ${para} tendrías ${plata(Math.round(reservaSig))} en tu reserva${falta > 0.5 ? `: te faltan ${plata(Math.round(falta))}.` : ": ya lo cubres."}`, `For ${para} you'd have ${plata(Math.round(reservaSig))} in your reserve${falta > 0.5 ? `: ${plata(Math.round(falta))} short.` : ": it's covered."}`) : tx(`Para ${para} todavía no tienes reserva.`, `You don't have a reserve for ${para} yet.`)}</p>
    {extra && <p style={p}>{extra}</p>}
    {!esUS() && <p style={{ ...p, color: C.tx2 }}>{tx(`Un CDT a un año en Colombia paga hoy entre ${fmtPctEs(CDT_CO.min, 2)} y ${fmtPctEs(CDT_CO.max, 1)} (promedio ${fmtPctEs(CDT_CO.pct, 2)}, ${CDT_CO.fecha}). Elige el monto y el rendimiento que esperas.`, `A one-year CDT in Colombia pays between ${fmtPctEs(CDT_CO.min, 2)} and ${fmtPctEs(CDT_CO.max, 1)} today (average ${fmtPctEs(CDT_CO.pct, 2)}, ${CDT_CO.fecha}). Choose the amount and the rate you expect.`)}</p>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 4 }}>
      <label style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿Cuánto guardas? ($)", "How much do you keep? ($)")}<span style={{ width: 200, maxWidth: "100%" }}><NumberInput style={inp} value={monto} onChange={setMonto} /></span></label>
      <TasaReserva r={r} cfg={cfg} set={set} />
      <button type="button" disabled={!ok} onClick={() => ok && guardar(Number(monto))} style={{ ...btnAccion(false), opacity: ok ? 1 : 0.5, cursor: ok ? "pointer" : "not-allowed" }}>{tx("Guardar en mi reserva", "Keep in my reserve")}</button>
    </div>
  </div>;
}
// 24-nov-2026 (Santiago: "esto debería poder poner uno el interés que considera, no 6,6 % por defecto").
// La tasa de tu fondo de reserva: la que tú consideras; vacío, la de renta fija corta del escenario.
function TasaReserva({ r, cfg, set }) {
  const def = fmtPctEs((r.tasaReservaEscenario || 0) * 100, 1);
  return <label style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: C.tx2, marginTop: 8 }}>
    {tx("¿Cuánto rinde al año? (%)", "Annual return (%)")}
    <InputDecimalEs style={{ ...inp, width: 90 }} placeholder={def} value={cfg.reservaTasaPct ?? ""} onChange={(v) => set("reservaTasaPct", v)} />
    <span>{cfg.reservaTasaPct === "" || cfg.reservaTasaPct == null ? (esUS() ? tx(`Vacío: ${def}, renta fija corta del escenario.`, `Blank: ${def}, the scenario's short-term fixed income.`) : tx(`Vacío: ${def}, el promedio de un CDT a un año en Colombia (${CDT_CO.fecha}). Si esperas otro, escríbelo.`, `Blank: ${def}, the average one-year CDT in Colombia (${CDT_CO.fecha}). Enter your own if you expect another.`)) : tx(`Usas el que escribiste. Bórralo para volver a ${def}${esUS() ? "" : ", el promedio de un CDT"}.`, `You're using your own rate. Clear it to go back to ${def}.`)}</span>
  </label>;
}
// Barra fija abajo en Tu plata: cómo va el año elegido, si quedó guardado y el siguiente paso, siempre a la vista.
// 24-nov-2026 (Santiago: "uno no sabe si guardó o no"; "no queda claro que ya quedó ok y que sigue el 2027").
function SaldoFijo({ cuenta, cfg = {}, anioSel = 1, estadoGuardado = null, dejarListo, onVer }) {
  const g = cuenta.find((y) => y.anio === anioSel);
  if (!g) return null;
  const N = cuenta.length, Y = anioCal(anioSel), sigY = anioSel < N ? anioCal(anioSel + 1) : null;
  const falta = g.faltaSinCubrir > 0.5, pasado = g.porInvertir < -1, ok = !falta && !pasado;
  const listo = !!(cfg.aniosListos || {})[anioSel];
  const txt = falta ? tx(`${Y}: faltan ${plata(Math.round(g.faltaSinCubrir))} este año`, `${Y}: ${plata(Math.round(g.faltaSinCubrir))} short this year`)
    : pasado ? tx(`${Y}: te pasaste ${plata(Math.round(-g.porInvertir))}`, `${Y}: over by ${plata(Math.round(-g.porInvertir))}`)
      : tx(`${Y}: te quedan ${plata(Math.round(g.porInvertir))} de tu capital`, `${Y}: ${plata(Math.round(g.porInvertir))} of your capital left`);
  const guard = { guardando: tx("Guardando…", "Saving…"), listo: tx("Guardado ✓", "Saved ✓"), error: tx("No se pudo guardar", "Couldn't save"), demo: tx("En la demo no se guarda", "The demo doesn't save") }[estadoGuardado] || null;
  const sub = [guard, listo && ok ? tx(`Ya organizaste tu ${anioCal(anioSel)}`, `Your ${anioCal(anioSel)} is organized`) : null].filter(Boolean).join(" · ");
  return <div onClick={onVer} style={{ position: "sticky", bottom: 8, zIndex: 5, margin: "8px 0", padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: ok ? "rgba(15,42,26,0.97)" : "rgba(58,20,20,0.97)", border: `1px solid ${ok ? C.gn : C.rd}`, boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
      <span style={{ fontWeight: 700, color: ok ? C.gn : C.rd, fontVariantNumeric: "tabular-nums" }}>{txt}</span>
      {sub && <span role="status" style={{ fontSize: 12, color: estadoGuardado === "error" ? C.rd : C.tx2 }}>{sub}</span>}
    </div>
    {ok && dejarListo && <button type="button" onClick={(e) => { e.stopPropagation(); dejarListo(anioSel); }} style={{ ...btn(true), padding: "8px 12px", whiteSpace: "nowrap" }}>{sigY ? (listo ? tx(`Seguir con ${sigY} →`, `Go on to ${sigY} →`) : tx(`Terminé ${Y}, seguir con ${sigY} →`, `Done with ${Y}, go on to ${sigY} →`)) : (listo ? tx("Ver el resultado →", "See the result →") : tx(`Terminé ${Y}, ver el resultado →`, `Done with ${Y}, see the result →`))}</button>}
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
    [tx("Ingresos y gastos (suben al año)", "Income and expenses (yearly rise)"), `${fmtPctEs(esc.indexacionPct ?? indexacionDefaultPct(s))} ${alAnio}`],
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
function SeVaConVenta({ user, activoId, d, setD, cfg = {}, set, valor = 0, anioVenta = 1 }) {
  const luego = anioVenta > 1;
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
      <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{tx("¿Qué se va con la venta?", "What goes with the sale?")}</div>
      <div style={{ ...TIPO.meta, marginBottom: 6 }}>{luego ? tx(`Marca las rentas y gastos de este activo: salarios, servicios, predial… Siguen hasta ${anioCal(anioVenta - 1)} y dejan de contar desde ${anioCal(anioVenta)}, cuando se vende.`, `Check this asset's income and expenses: wages, utilities, property tax… They continue through ${anioCal(anioVenta - 1)} and stop counting from ${anioCal(anioVenta)}, when it's sold.`) : tx("Marca las rentas y gastos de este activo. Dejan de contar desde la venta.", "Check this asset's income and expenses. They stop counting from the sale.")}</div>
      {auto.map((x) => fila(x, true, true))}
      {visibles.map((x) => fila(x, elegidos.has(x.key), false))}
      {auto.length + visibles.length === 0 && <div style={{ fontSize: 12, color: C.tx2 }}>{tx("No encontré rentas ni gastos con este nombre. Búscalos abajo.", "No income or expenses found with this name. Look for them below.")}</div>}
      {lista.length > 0 && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setVerTodo(!verTodo)}>{verTodo ? tx("Ver solo los marcados", "Show only checked") : tx("Buscar otro ingreso o gasto", "Find another income or expense")}</button>}
      {deudasU.length > 0 && <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 10, paddingTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{tx("¿Tiene una deuda? Se paga con esta venta", "Does it have a debt? It's paid with this sale")}</div>
        <div style={{ ...TIPO.meta, marginBottom: 6 }}>{tx("Marca la deuda de este activo (su crédito o hipoteca). Se cancela con la plata de la venta y su cuota deja de salir.", "Check this asset's debt (its loan or mortgage). It's paid off with the sale proceeds and its payment stops.")}</div>
        {suyas.map((x) => filaDeuda(x, true))}
        {sugeridas.map((x) => filaDeuda(x, false))}
        {verDeudas && otras.map((x) => filaDeuda(x, false))}
        {suyas.length + sugeridas.length === 0 && !verDeudas && <div style={{ fontSize: 12, color: C.tx2 }}>{tx("No hay una deuda ligada a este activo.", "No debt is linked to this asset.")}</div>}
        {otras.length > 0 && <button style={{ ...btn(false), marginTop: 6, fontSize: 12 }} onClick={() => setVerDeudas(!verDeudas)}>{verDeudas ? tx("Ocultar las otras deudas", "Hide other debts") : tx("Buscar otra deuda", "Find another debt")}</button>}
        {totalDeuda > 0.5 && luego && <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>{tx(`Lo que debas en ${anioCal(anioVenta)} sale primero de la venta; hasta entonces sigues pagando la cuota.`, `Whatever you owe in ${anioCal(anioVenta)} comes out of the sale first; until then you keep paying.`)}</div>}
        {totalDeuda > 0.5 && !luego && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600, borderTop: `1px solid ${C.bd}`, marginTop: 8, paddingTop: 6 }}><span>{tx(`Te queda de la venta: ${plata(Math.round(valor))} − ${plata(Math.round(totalDeuda))} de deuda`, `Left from the sale: ${plata(Math.round(valor))} − ${plata(Math.round(totalDeuda))} of debt`)}</span><span style={{ color: valor - totalDeuda >= 0 ? C.gn : C.rd, whiteSpace: "nowrap" }}>{plata(Math.round(valor - totalDeuda))}</span></div>}
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
              ? (esInm ? tx("Si la renta nueva sale de la obra, déjalo vacío: esa renta se pone con la inversión en el paso 3.", "If the new rent comes from the works, leave it blank: that rent goes with the investment in step 3.") : tx("Si lo que te va a pagar sale de lo que vas a invertir, déjalo vacío: eso se pone con la inversión en el paso 3.", "If what it pays comes from the money you'll add, leave it blank: that goes with the investment in step 3."))
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
            <div><div style={etq}>{esInm ? tx("¿Cuánto le vas a invertir? ($) — obra, remodelación, ampliación", "How much will you invest? ($) — works, remodel, expansion") : tx("¿Cuánto vas a invertir? ($)", "How much will you invest? ($)")}</div>
              <NumberInput style={ctl} placeholder={tx("Nada", "Nothing")} value={re?.monto ?? ""} onChange={(val) => upRe({ monto: val })} /></div>
            <div><div style={etq}>{tx("¿Cuándo?", "When?")}</div>
              <select style={ctl} value={Number(re?.anio) || 1} onChange={(e) => upRe({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></div>
          </div>
          <div style={{ fontSize: 12, color: Number(re?.monto) > 0 ? C.gn : C.tx2, marginTop: 6, lineHeight: 1.5 }}>{!(Number(re?.monto) > 0) ? tx("Vacío = no inviertes más. ", "Blank = you add nothing. ") : ""}{Number(re?.monto) > 0 ? tx(`Queda en ${plata(Math.round(x.valor + Number(re.monto)))} (${plata(Math.round(x.valor))} de hoy + ${plata(Math.round(Number(re.monto)))}). `, `It becomes ${plata(Math.round(x.valor + Number(re.monto)))} (${plata(Math.round(x.valor))} today + ${plata(Math.round(Number(re.monto)))}). `) : ""}{esInm ? tx("De dónde sale la plata y la renta que traiga la obra se eligen en el paso 3 · Tu plata, donde se descuenta de tu saldo.", "Where the money comes from and the rent the works bring are chosen in step 3 · Your money, where it's deducted from your balance.") : tx("De dónde sale la plata se elige en el paso 3 · Tu plata, donde se descuenta de tu saldo.", "Where the money comes from is chosen in step 3 · Your money, where it's deducted from your balance.")}</div>
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
  const gIngPct = escR.indexacionPct != null ? Number(escR.indexacionPct) : null; // 24-nov-2026: las rentas suben con la indexación
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
  const fila = { borderTop: `1px solid ${C.bd}`, padding: "14px 0" };
  const totalInv = invs.filter((x) => !x.vende).reduce((sm, x) => sm + x.usada, 0), totalSue = sueltos.filter((x) => !(x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1))).reduce((sm, x) => sm + x.mensual, 0);
  return <>
    <div style={card}>
      {/* 24-nov-2026 (Santiago: "yo daría prioridad al título de la sección: Decide qué haces con tus activos; luego cada activo, el título importante, por ejemplo Puerto Madero"; "uno ve un resumen con los datos más importantes; si abre, ve el detalle"). */}
      <h2 style={TIPO.seccion}>{tx("Decide qué haces con tus activos", "Decide what to do with your assets")}</h2>
      <p style={{ ...TIPO.sub, marginBottom: 6 }}>{tx("Cada uno se conserva, se modifica (inviertes más o cambia lo que te paga) o se vende. Toca uno para ver el detalle y decidir.", "Each one is kept, modified (you add money or what it pays changes) or sold. Tap one to see the detail and decide.")}</p>
      {invs.map((x) => { const ab = abierto === x.id; return (
        <div key={x.id} style={fila}>
          {(() => {
            // Resumen de una línea: qué decidiste y los datos que importan.
            const verbo = palabrasTipo(x).sale.split(tx(" o ", " or "))[0];
            const reinvX = (cfg.reinversiones || []).filter((y) => y.activoId === x.id && Number(y.monto) > 0);
            const dec = x.vende ? tx(`${verbo} hoy`, `${verbo} today`) : x.termina ? tx(`${verbo} en ${anioCal(x.termina)}`, `${verbo} in ${anioCal(x.termina)}`) : x.cambio || reinvX.length ? tx("Se modifica", "Modified") : tx("Se conserva", "Kept");
            const desdeTxt = (t) => (t <= 1 ? tx("desde ya", "from now") : tx(`desde ${anioCal(t)}`, `from ${anioCal(t)}`));
            const datos = [
              x.usada > 0 ? tx(`renta ${plata(Math.round(x.usada))}/mes`, `income ${plata(Math.round(x.usada))}/mo`) : null,
              x.termina ? tx(`recibes ${plata(Math.round(devuelve(x)))}`, `you get ${plata(Math.round(devuelve(x)))}`) : null,
              !x.vende && !x.termina && x.cambio ? (x.cambio.modo === "propio" ? tx(`uso propio ${desdeTxt(x.cambio.desde)}`, `personal use ${desdeTxt(x.cambio.desde)}`) : tx(`renta nueva ${plata(Math.round(x.cambio.mensual))}/mes ${desdeTxt(x.cambio.desde)}`, `new income ${plata(Math.round(x.cambio.mensual))}/mo ${desdeTxt(x.cambio.desde)}`)) : null,
              reinvX.length ? tx(`inviertes ${plata(Math.round(reinvX.reduce((sm, y) => sm + Number(y.monto), 0)))}`, `you add ${plata(Math.round(reinvX.reduce((sm, y) => sm + Number(y.monto), 0)))}`) : null,
              !x.vende && !x.termina ? (x.crecPct == null ? tx("pierde valor cada año", "loses value every year") : x.capitalPlano ? tx("su capital no cambia", "principal doesn't change") : tx(`sube ${pctTxt(x.crecPct)}`, `grows ${pctTxt(x.crecPct)}`)) : null,
            ].filter(Boolean);
            const cambiado = dec !== tx("Se conserva", "Kept");
            return <button type="button" aria-expanded={ab} onClick={() => setAbierto(ab ? null : x.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit" }}>
              <span style={{ minWidth: 0, display: "grid", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ ...TIPO.ficha, color: x.vende ? C.tx2 : C.tx }}>{x.nombre}</span>
                  <span style={{ fontSize: 12, color: C.tx2 }}>{palabrasTipo(x).etq}</span>
                </span>
                <span style={TIPO.meta}><span style={{ color: cambiado ? C.tx : C.tx2, fontWeight: cambiado ? 600 : 400 }}>{dec}</span>{datos.length ? " · " + datos.join(" · ") : ""}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                <span style={{ ...TIPO.ficha, fontVariantNumeric: "tabular-nums", color: x.vende ? C.tx2 : C.tx }}>{plata(Math.round(x.valor))}</span>
                <span aria-hidden="true" style={{ color: C.tx2, fontSize: 12, width: 12 }}>{ab ? "▴" : "▾"}</span>
              </span>
            </button>;
          })()}
          {ab && <>
            <div style={{ ...TIPO.meta, marginTop: 10 }}>{x.crecPct == null ? tx(`Pierde valor cada año: ${dec1(-supuestosF10().vehiculo.depAnios1a3Pct)} % los primeros 3 años y ${dec1(-supuestosF10().vehiculo.depDespuesPct)} % después`, `Loses value every year: ${dec1(-supuestosF10().vehiculo.depAnios1a3Pct)}% for the first 3 years, then ${dec1(-supuestosF10().vehiculo.depDespuesPct)}%`) : x.capitalPlano ? tx("Su capital no cambia: te devuelven lo mismo que pusiste", "Its principal doesn't change: you get back what you put in") : `${tx("Su valor sube", "Its value grows")} ${pctTxt(x.crecPct)}`}{x.crecPct != null && !x.capitalPlano ? (x.crecCorregido ? tx(" · lo pusiste tú", " · set by you") : tx(" · supuesto general, corrígelo", " · general assumption, edit it")) : ""}{x.usada > 0 && !x.vende && gIngPct != null ? tx(` · Su renta sube ${dec1(gIngPct)} % al año (inflación${Number(escR.ingresosSpread) > 0 ? " + " + dec1(escR.ingresosSpread) : ""})`, ` · Its income grows ${dec1(gIngPct)}% a year (inflation${Number(escR.ingresosSpread) > 0 ? " + " + dec1(escR.ingresosSpread) : ""})`) : ""}</div>
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
                  <select style={{ ...inp, width: "auto" }} value={x.termina || 1} onChange={(e) => { const y = Number(e.target.value); setCfg((p) => { const d0 = (p.decisiones || {})[x.id] || {}, guarda = Array.isArray(d0.seVan) ? { seVan: d0.seVan } : {}; return { ...p, decisiones: { ...p.decisiones, [x.id]: y <= 1 ? { accion: "vende", ...guarda } : { accion: "termina", desde: y, ...guarda } } }; }); }}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select></label>
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
              {(x.vende || x.termina) && <SeVaConVenta user={user} activoId={x.id} d={d} cfg={cfg} set={set} valor={x.valor} anioVenta={x.termina || 1} setD={(nx) => setCfg((p) => ({ ...p, decisiones: { ...p.decisiones, [x.id]: { ...d, ...nx } } }))} />}
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
          </>}
        </div>); })}
      {/* 22-nov-2026 (Santiago: "llevar a una persona al paso 3 sin terminar es sacarla del proceso… más bien una nota"). Aquí solo se decide lo de hoy; la inversión futura tiene su paso. */}
      <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{tx("Rentas de inversiones", "Investment income")}{invs.some((x) => x.vende) ? tx(" (sin las que vendes)", " (excluding sold)") : ""}</span><span>{plata(Math.round(totalInv))}{tx("/mes", "/mo")}</span></div>
    </div>
    <div style={card}>
      <h2 style={TIPO.seccion}>{tx("Tus otros ingresos", "Your other income")}</h2>
      {/* 25-oct-2026 (Santiago: "confunde… aquí no se pueden editar o quitar y después en el paso 2 aparecen otra vez"). Un ingreso, un lugar: aquí se corrige el monto y se decide si sigue o se acaba. */}
      <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>{tx(<>Fees, salarios y rentas que no están ligados a una inversión de arriba. De cada uno: <b style={{ color: C.tx }}>cuánto te entra</b> (corrígelo si no es real) y <b style={{ color: C.tx }}>si sigue o se acaba</b> en este escenario.</>, <>Fees, salaries and income not tied to an investment above. For each one: <b style={{ color: C.tx }}>how much comes in</b> (fix it if it's off) and <b style={{ color: C.tx }}>whether it continues or ends</b> in this scenario.</>)}</p>
      {sueltos.length === 0 && <div style={{ fontSize: 13, color: C.tx2 }}>{tx("No tienes otros ingresos.", "You have no other income.")}</div>}
      {sueltos.map((x) => (
        <div key={x.key} style={fila}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b style={{ textDecoration: noSuma(x) ? "line-through" : "none", color: noSuma(x) ? C.tx2 : C.tx }}>{x.nombre}</b><span style={{ fontSize: 12, color: C.tx2 }}>{x.renta ? tx("renta", "passive") : tx("trabajo", "work")}</span></div>
          {x.seVa && <div style={{ fontSize: 12, color: noSuma(x) ? C.am : C.tx2 }}>{x.seVa === "ventaLuego" ? textoVentaLuego(x) : x.seVa === "venta" ? tx("Se va con una venta que marcaste arriba: no suma.", "Goes with a sale you marked above: not counted.") : tx(`Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`, `Ends ${Number(x.acabaAnio) <= 1 ? "now: not counted" : `in ${anioCal(x.acabaAnio)}`}.`)}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enIngresos))} value={ih[x.key] ?? ""} onChange={(v) => setI(x.key, v)} /></span>
            <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? tx(`corregido (en Ingresos: ${plata(Math.round(x.enIngresos))})`, `edited (on Income: ${plata(Math.round(x.enIngresos))})`) : tx(`${plata(Math.round(x.mensual))}/mes, de tu página Ingresos`, `${plata(Math.round(x.mensual))}/mo, from your Income page`)}</span>
            {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setI(x.key, null)}>{tx("Quitar", "Remove")}</button>}
          </div>
          {x.nota && !x.corregido && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{x.nota}</div>}
          {x.finDeDatos && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`En tu página Ingresos dice que termina en ${x.finAnio}. Si va a seguir, elige «Sigue».`, `Your Income page says it ends in ${x.finAnio}. If it will continue, choose "Continues".`)}</div>}
          {x.seVa !== "venta" && x.seVa !== "ventaLuego" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>{tx("Sigue", "Continues")}</button>
            <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 2)}>{tx("Se acaba", "Ends")}</button>
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


// 25-oct-2026 (Santiago: "¿cómo edita uno los gastos si algún valor cambia?
// Por ejemplo, el arriendo ya no es 16 M"). Igual que los ingresos: cada gasto
// en un solo lugar, con su monto corregible y Sigue / Se acaba.
// Lo que ya no suma hoy (se tacha): lo que se va con una venta de hoy o se acaba desde ya.
const noSuma = (x) => x.seVa === "venta" || (x.seVa === "acaba" && Number(x.acabaAnio) <= 1);
// 24-nov-2026 (Santiago: "en 2026 me aparece que me ahorro gastos que se vienen a ahorrar en el año siguiente").
const textoVentaLuego = (x) => tx(`Se va con la venta de ${x.ventaDe}: cuenta hasta ${anioCal(x.ventaAnio - 1)} y deja de contar desde ${anioCal(x.ventaAnio)}.${x.deActivo ? ` Está conectado a ${x.deActivo} en Egresos.` : ` Si no va con esa venta, desmárcalo en «¿Qué se va con la venta?» de ${x.ventaDe}.`}`, `Goes with the sale of ${x.ventaDe}: counts until ${anioCal(x.ventaAnio - 1)} and stops in ${anioCal(x.ventaAnio)}.${x.deActivo ? ` It's linked to ${x.deActivo} on your Expenses page.` : ` If it doesn't go with that sale, uncheck it in "What goes with the sale?" for ${x.ventaDe}.`}`);
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
    <h2 style={TIPO.seccion}>{tx("Tus gastos", "Your expenses")}</h2>
    <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>{tx(<>De tu página Egresos. De cada uno: <b style={{ color: C.tx }}>cuánto sale al mes</b> (corrígelo si cambió, por ejemplo un arriendo nuevo) y <b style={{ color: C.tx }}>si sigue o se acaba</b>. Solo cambia el plan; Egresos no se toca. Los gastos futuros (la universidad) van en el paso 2.</>, <>From your Expenses page. For each one: <b style={{ color: C.tx }}>how much goes out monthly</b> (fix it if it changed, e.g. a new rent) and <b style={{ color: C.tx }}>whether it continues or ends</b>. It only changes the plan; Expenses isn't touched. Future expenses (college) go in step 2.</>)}</p>
    {visibles.map((x) => (
      <div key={x.key} style={fila}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <b style={{ textDecoration: noSuma(x) ? "line-through" : "none", color: noSuma(x) ? C.tx2 : C.tx }}>{x.nombre}</b>
          <span style={{ fontSize: 12, color: C.tx2 }}>{x.cat}{x.deActivo ? ` · ${tx("de", "from")} ${x.deActivo}` : ""}</span>
        </div>
        {x.seVa && <div style={{ fontSize: 12, color: noSuma(x) ? C.am : C.tx2 }}>{x.seVa === "ventaLuego" ? textoVentaLuego(x) : x.seVa === "venta" ? tx("Se va con una venta que marcaste arriba: no suma.", "Goes with a sale you marked above: not counted.") : tx(`Se acaba ${Number(x.acabaAnio) <= 1 ? "desde ya: no suma" : `en ${anioCal(x.acabaAnio)}`}.`, `Ends ${Number(x.acabaAnio) <= 1 ? "now: not counted" : `in ${anioCal(x.acabaAnio)}`}.`)}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          <span style={{ width: 170 }}><NumberInput style={inp} placeholder={fmtMilesEs(Math.round(x.enEgresos))} value={gh[x.key] ?? ""} onChange={(v) => setG(x.key, v)} /></span>
          <span style={{ fontSize: 12, color: x.corregido ? C.gn : C.tx2 }}>{x.corregido ? tx(`corregido (en Egresos: ${plata(Math.round(x.enEgresos))})`, `edited (on Expenses: ${plata(Math.round(x.enEgresos))})`) : tx(`${plata(Math.round(x.mensual))}/mes, de tu página Egresos`, `${plata(Math.round(x.mensual))}/mo, from your Expenses page`)}</span>
          {x.corregido && <button style={{ ...btn(false), fontSize: 12, padding: "4px 8px" }} onClick={() => setG(x.key, null)}>{tx("Quitar", "Remove")}</button>}
        </div>
        {x.finDeDatos && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`En tu página Egresos dice que termina en ${x.finAnio}. Si va a seguir, elige «Sigue».`, `Your Expenses page says it ends in ${x.finAnio}. If it will continue, choose "Continues".`)}</div>}
        {x.seVa !== "venta" && x.seVa !== "ventaLuego" && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <button style={{ ...btn(!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, null)}>{tx("Sigue", "Continues")}</button>
          <button style={{ ...btn(!!x.acabaAnio), padding: "4px 10px" }} onClick={() => setT(x.key, x.acabaAnio || 2)}>{tx("Se acaba", "Ends")}</button>
          {x.acabaAnio && <select style={{ ...inp, width: "auto" }} value={x.acabaAnio} onChange={(e) => setT(x.key, Number(e.target.value))}>{ANIOS.map((y) => <option key={y} value={y}>{etqAnio(y)}</option>)}</select>}
        </div>}
      </div>))}
    {orden.length > 10 && <button style={{ ...btn(false), marginTop: 6 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? tx("Ver menos", "Show less") : `${tx("Ver todos", "Show all")} (${orden.length})`}</button>}
    <div style={{ ...fila, display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{tx("Gastos de hoy en el plan", "Today's expenses in the plan")}</span><span>{plata(Math.round(total))}{tx("/mes", "/mo")}</span></div>
  </div>;
}
