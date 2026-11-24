// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { tx, esUS, pct as fmtPctR, miles, plata as plataR, ejemploMonto, monedaBase, localeCifras } from "../lib/region.js";
import { proyectarFuturo10, supuestosF10, nombreSup, retornoNominalPreset, rendimientoHintPct, validarMezcla, leerFuturos, migrarModifica, resumenEscenario, migrarClaves, anioCal, gastosLista, tarifaCiclo, regimenSugerido, sugerirVinculados, rentasDuplicadas, rentasFuturasDelActivo, inversionesHoy, leerCambios, finalesDeDatos, sugerirActivoDeDeuda, deudaActivo, ingresosSueltosHoy, leerPropiedadRaiz, hayAlertaLiquidez, cuentaPorAnio } from "../lib/futuro10.js";
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
  // 23-nov-2026: invertirle a un activo que ya tienes, con el saldo que queda ese año.
  // Sin tocar el saldo para imprevistos (Santiago: "se supone que dejo un saldo disponible para
  // cualquier eventualidad en 2029 y en 2030 no hay ninguno"): el monto que viene lleno y
  // «Usar saldo pendiente» usan lo que queda por encima de ese saldo.
  const quedaEnAnio = (anio, rr) => (anio === 1 ? ((rr.bolsaDetalle || {}).restante || 0) : ((cuentaPorAnio(rr, cfg).find((g) => g.anio === anio) || {}).saldo || 0)) - reservaDe(cfg);
  const reinvEnAnio = (activoId, anio) => {
    const q = quedaEnAnio(anio, r);
    set("reinversiones", [...cfg.reinversiones, { activoId, monto: q > 0.5 ? Math.round(q) : "", anio, rentaMensual: "", rentaDesdeMes: 0, fuente: anio > 1 ? "liquidez" : "venta" }]);
    setTimeout(() => document.getElementById("f10-reinv")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 150);
  };
  const nuevaEnAnio = (anio, queda) => {
    const k = cfg.nuevas.length;
    set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: queda > 0.5 ? Math.round(queda) : "", fuente: anio > 1 ? "liquidez" : "venta", anio }]);
    setNuevaAbierta((st) => new Set([...st, k]));
    setTimeout(() => { const el = document.getElementById("f10-nueva-" + k); el?.scrollIntoView?.({ behavior: "smooth", block: "center" }); }, 150);
  };
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
        <ResumenPaso1 user={user} cfg={cfg} r={r} irHoy={() => { ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        <div style={card}>
          <Seccion n={2} titulo={tx("Lo que viene", "What's coming")} sub={tx("Lo que empieza más adelante: una pensión, un local que te entregan, tu casa, la universidad de los hijos. Lo que ya tienes (vender, apagar rentas) se decide en el paso 1.", esUS() ? "Things that start later: a pension or Social Security, a property you take over, your home, the kids' college. What you already have (selling, stopping income) is decided in step 1." : "Things that start later: a pension, a property handed over to you, your home, the kids' college. What you already have (selling, stopping income) is decided in step 1.")} />
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} activos={r.activos} gastosHoy={r.gastosHoy || []} ingresosHoy={r.ingresosHoy || []} fuentes={r.fuentes || []} irHoy={() => { ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        </div>
      </>)}

      {paso === 2 && (<>
        <ResumenPaso1 user={user} cfg={cfg} r={r} irHoy={() => { ir(0); window.scrollTo?.({ top: 0, behavior: "smooth" }); }} />
        <AnioPorAnio r={r} cfg={cfg} set={set} anioSel={anioSel} setAnioSel={setAnioSel} nuevaEnAnio={nuevaEnAnio} reinvEnAnio={reinvEnAnio} />
        <div style={card} id="f10-deudas">
          <Seccion n="A" titulo={tx(`Pagar deudas · ${anioSel === 1 ? `hoy (${anioCal(1)})` : anioCal(anioSel)}`, `Pay off debt · ${anioSel === 1 ? `today (${anioCal(1)})` : anioCal(anioSel)}`)} sub={tx("Las deudas que siguen vivas este año: deja que sigan con su cuota o págalas con el saldo del año. Las que se pagan con la venta de su activo y las ya pagadas van en una línea.", "Debts still alive this year: keep paying them or pay them off with this year's balance. Those paid with their asset's sale and those already paid are listed in one line.")} />
          {(r.deudas || []).length + (r.deudasSinSaldo || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} anioSel={anioSel} setAnioSel={setAnioSel} /> : <p style={{ color: C.tx2, fontSize: 13 }}>{tx("No tienes deudas con saldo.", "You have no outstanding debt.")}</p>}
        </div>
        <div style={card}>
          <Seccion n="B" titulo={tx(`Inversiones nuevas · ${anioSel === 1 ? `hoy (${anioCal(1)})` : anioCal(anioSel)}`, `New investments · ${anioSel === 1 ? `today (${anioCal(1)})` : anioCal(anioSel)}`)} sub={esUS() ? tx("Algo que todavía no tienes: un CD, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a CD, a fund, another investment. Choose where it comes from.") : tx("Algo que todavía no tienes: un CDT, un fondo, una inversión en otra cosa. Elige de dónde sale.", "Something you don't own yet: a term deposit, a fund, another investment. Choose where it comes from.")} />
          {/* 23-nov-2026 (Santiago: "aquí debería ser muy claro: inversiones nuevas 2026, uno ve ahí cuáles; después inversiones nuevas 2027 y así sucesivamente"). Agrupadas por año, cada grupo con lo que queda ese año, y cada inversión plegada en una línea. */}
          {(() => {
            const cuenta = cuentaPorAnio(r, cfg);
            const anioDe = (x) => Math.max(1, Number(x.anio) || 1);
            const grupos = [anioSel];
            // 23-nov-2026 (Santiago: "me sobran 9.000 MM de 2027, hago una inversión de 4.000 y la segunda me dice por defecto el saldo pendiente, o puedo poner otro valor"). La inversión nueva de un año arranca con lo que queda ese año; se puede cambiar.
            const agregar = (anio, queda) => { const k = cfg.nuevas.length; set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: queda > 0.5 ? Math.round(queda) : "", fuente: anio > 1 ? "liquidez" : "venta", anio }]); setNuevaAbierta((s) => new Set([...s, k])); };
            const montoDe = (x) => (x.preset === "fincaRaiz" && x.pr ? leerPropiedadRaiz(x, 10).capital : Number(x.monto) || 0);
            return grupos.map((anio) => {
              const filas = cfg.nuevas.map((x, i) => [x, i]).filter(([x]) => anioDe(x) === anio);
              const total = filas.reduce((sm, [x]) => sm + montoDe(x), 0);
              const g = cuenta.find((y) => y.anio === anio);
              const queda = anio === 1 ? (r.bolsaDetalle || {}).restante : g ? g.saldo : null;
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
                    <BotonSaldo disponible={Math.max(0, quedaEnAnio(anioSel, r) + (Number(x0.monto) || 0))} actual={Number(x0.monto) || 0} anio={anioSel} on={(v) => upR({ monto: v })} /></label>
                  <div style={{ fontSize: 12, color: C.tx2, display: "grid", gap: 4 }}>{tx("¿De dónde sale?", "Where does it come from?")}<div style={{ fontSize: 13.5, color: C.tx, padding: "8px 0" }}>{tx(`Del saldo de ${anioCal(anioSel)}`, `From the ${anioCal(anioSel)} balance`)}</div></div>
                </div>}
                {activo && !a.delPlan && <div style={{ marginTop: 8 }}><AporteCampos x={cfg.reinversiones[iR]} up={upR} det={detR} activos={r.activos} vendidos={r.vendidos || []} saldoDisp={Math.max(0, quedaEnAnio(anioSel, r) + (Number(cfg.reinversiones[iR].monto) || 0))} sinRenta={!(Number(cfg.reinversiones[iR].rentaMensual) > 0) && rentasFuturasDelActivo(cfg, a, r.activos).some((f) => f.vinculada)} /></div>}
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
        <SaldoFijo r={r} cfg={cfg} anioSel={anioSel} onVer={() => document.getElementById("f10-anios")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
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
      {/* 23-nov-2026 (Santiago: "yo no entiendo este texto"). Dos frases: qué va aquí y qué va en el paso 1. */}
      <div style={{ fontSize: 13, color: C.tx2, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10, lineHeight: 1.5 }}>{tx(<><b style={{ color: C.tx }}>Aquí van solo ingresos nuevos</b>, que hoy no tienes: una pensión, un contrato, un negocio que arranca. <b style={{ color: C.tx }}>Si lo que cambia es la renta de algo que ya tienes</b> (un local que vas a arrendar, la bodega que construyes en tu lote), eso se pone en el paso 1, en «Se modifica».</>, <><b style={{ color: C.tx }}>Only new income goes here</b>, things you don't have today: a pension, a contract, a business starting up. <b style={{ color: C.tx }}>If what changes is the income from something you already own</b> (a unit you'll rent out, the warehouse you build on your lot), that goes in step 1, under "Modify".</>)}</div>
      <h4 style={{ margin: "8px 0" }}>{tx("Ingresos futuros", "Future income")}</h4>
      {f.ingresos.map((x, i) => (
        <div key={i} className="fp10-campos" style={g}>
          {/* 19-nov-2026: aviso si esta renta ya está puesta en «Invertir en lo que ya tienes». */}
          {(() => { const d = rentasDuplicadas(cfg, activos).find((y) => y.k === i); if (!d) return null; return <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px" }}>{d.seguro
            ? tx(`Esta renta ya está en «Invertir en lo que ya tienes» (${d.activo}, ${plata(d.contada)} al mes). Se cuenta una sola vez, la de allá; puedes borrar esta.`, `This income is already in "Invest in what you own" (${d.activo}, ${plata(d.contada)} a month). It's counted once, from there; you can delete this one.`)
            : tx(`¿Es la misma renta de ${d.activo} que pusiste en «Invertir en lo que ya tienes» (${plata(d.contada)} al mes)? Mientras no lo confirmes, se suman las dos.`, `Is this the same ${d.activo} income you entered in "Invest in what you own" (${plata(d.contada)} a month)? Until you confirm, both are added.`)}
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {d.seguro
                ? <button style={btn(true)} onClick={() => set("futuros", { ...f, ingresos: f.ingresos.filter((_, j) => j !== i) })}>{tx("Quitarla de aquí", "Remove it here")}</button>
                : <button style={btn(true)} onClick={() => set("futuros", { ...f, ingresos: f.ingresos.filter((_, j) => j !== i) })}>{tx(`Sí, es la de ${d.activo}: quitarla de aquí`, `Yes, it's ${d.activo}'s: remove it here`)}</button>}
              {!d.seguro || !x.activoId ? <button style={btn(false)} onClick={() => upI(i, { noEsRentaDe: [...new Set([].concat(x.noEsRentaDe || [], d.activoId))] })}>{tx("Es otra renta", "It's a different income")}</button> : null}
            </div></div>; })()}
          {/* 22-nov-2026: la renta de un activo que ya tienes se cambia en el paso 1, no aquí. */}
          {x.activoId && leerCambios(cfg)[x.activoId] && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px" }}>
            {tx(`Ya cambiaste la renta de ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "ese activo"} en el paso 1. Si este ingreso es esa misma renta, quítalo de aquí para no contarla dos veces.`, `You already changed ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "that asset"}'s income in step 1. If this is the same income, remove it here so it isn't counted twice.`)}
            <div style={{ marginTop: 6 }}><button style={btn(true)} onClick={() => set("futuros", { ...f, ingresos: f.ingresos.filter((_, j) => j !== i) })}>{tx("Quitarlo de aquí", "Remove it here")}</button></div></div>}
          <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} placeholder={esUS() ? tx("Ej.: Seguro Social", "e.g. Social Security") : tx("Ej.: pensión", "e.g. pension")} onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>{esUS() ? tx("Al mes ($, dólares de hoy)", "Per month ($, today's dollars)") : tx("Al mes ($, pesos de hoy)", "Per month ($, today's pesos)")}<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            {!x.activoId && <span style={{ fontSize: 12 }}>{esUS() ? tx("Si es el Seguro Social o una pensión, usa el estimado de tu cuenta en ssa.gov o de tu plan. Sube con la inflación.", "For Social Security or a pension, use the estimate from your ssa.gov account or your plan. It grows with inflation.") : tx("Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. Sube con la inflación.", "For a pension, use the monthly estimate from your pension fund. It grows with inflation.")}</span>}</label>
          <label style={lbl}>{tx("¿De dónde sale?", "Where does it come from?")}<select style={inp} value={x.activoId || ""} onChange={(e) => upI(i, { activoId: e.target.value || null })}><option value="">{tx("No sale de un activo (pensión, honorarios…)", "Not from an asset (pension, fees…)")}</option>{activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label style={lbl}>{tx("Empieza", "Starts")}{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          {x.activoId && <label style={lbl}>{tx(`¿Cuánto sube el valor de ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "ese activo"} al año? (%, opcional)`, `How much does ${(activos.find((y) => y.id === x.activoId) || {}).nombre || "that asset"} appreciate a year? (%, optional)`)}<InputDecimalEs style={inp} placeholder={tx("Ej.: 5", "e.g. 5")} value={x.valorizacionNomPct ?? ""} onChange={(v) => upI(i, { valorizacionNomPct: v })} /><span style={{ fontSize: 12 }}>{tx("Es el valor del activo, no la renta. La renta sube cada año con la inflación.", "This is the asset's value, not the income. The income grows with inflation each year.")}</span></label>}
          {/* 24-oct-2026 (Santiago, con la pensión puesta "termina año 7" sin querer:
              "no veo esa opción"). En el iPhone «Sigue» quedaba escondida arriba de la
              rueda. Ahora son dos botones y el año solo aparece si termina. */}
          <div className="fp10-campo" style={{ ...lbl, gridColumn: "span 2" }}>{tx("¿Hasta cuándo?", "Until when?")}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
          <div key={i} className="fp10-campos" style={g}>
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
          <div key={i} className="fp10-campos" style={g}>
            <label style={lbl}>{tx("Nombre", "Name")}<input style={inp} value={x.nombre || ""} placeholder={tx("Ej.: universidad de los hijos", "e.g. kids' college")} onChange={(e) => upG(i, { nombre: e.target.value })} /></label>
            {/* 21-nov-2026 (Santiago: "debería poder uno poner el valor mensual o anual, como
                se lo sepa"). Se guarda siempre `anual` (el motor no cambia); `periodo` solo
                dice cómo lo escribió el usuario: en "mes" la casilla muestra anual ÷ 12 y
                guarda lo escrito × 12. */}
            <div style={lbl}>
              <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <button type="button" style={btn(x.periodo === "mes")} onClick={() => upG(i, { periodo: "mes" })}>{tx("Al mes", "Monthly")}</button>
                <button type="button" style={btn(x.periodo !== "mes")} onClick={() => upG(i, { periodo: "año" })}>{tx("Al año", "Yearly")}</button>
              </div>
              {esUS() ? tx(x.periodo === "mes" ? "Al mes ($, dólares de hoy)" : "Al año ($, dólares de hoy)", x.periodo === "mes" ? "Per month ($, today's dollars)" : "Per year ($, today's dollars)") : tx(x.periodo === "mes" ? "Al mes ($, pesos de hoy)" : "Al año ($, pesos de hoy)", x.periodo === "mes" ? "Per month ($, today's pesos)" : "Per year ($, today's pesos)")}
              <NumberInput style={inp}
                value={x.periodo === "mes" ? (x.anual === "" || x.anual == null ? "" : Math.round((Number(x.anual) || 0) / 12)) : (x.anual ?? "")}
                onChange={(v) => upG(i, { anual: x.periodo === "mes" ? (v === "" || v == null ? "" : (Number(v) || 0) * 12) : v })} />
              <span style={{ fontSize: 12 }}>{tx("Sube cada año con la inflación.", "It grows with inflation every year.")}</span></div>
            <label style={lbl}>{tx("Empieza", "Starts")}{selAnio(x.desde || 1, (v) => upG(i, { desde: v || 1 }))}</label>
            <div style={lbl}>{tx("¿Cuántos años?", "For how many years?")}
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <button type="button" style={btn(n == null)} onClick={() => upG(i, { anios: "" })}>{tx("Siempre", "Ongoing")}</button>
                <button type="button" style={btn(n != null)} onClick={() => upG(i, { anios: n ?? 4 })}>{tx("Un tiempo", "For a while")}</button>
              </div>
              {n != null && <select style={{ ...inp, marginTop: 6 }} value={n} onChange={(e) => upG(i, { anios: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{enAnios(y)}</option>)}</select>}
            </div>
            {(Number(x.anual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.am }}>{tx(x.periodo === "mes" ? `Sale ${plata(Math.round(Number(x.anual) / 12))} al mes (${plata(Number(x.anual))} al año) ${cuando}${n != null ? `, durante ${enAnios(n)}` : ", siempre"}.` : `Sale ${plata(Number(x.anual))} al año (${plata(Math.round(Number(x.anual) / 12))} al mes) ${cuando}${n != null ? `, durante ${enAnios(n)}` : ", siempre"}.`, `${plata(Number(x.anual))} a year goes out (${plata(Math.round(Number(x.anual) / 12))} a month) ${cuando}${n != null ? `, for ${enAnios(n)}` : ", ongoing"}.`)}</div>}
            <button style={btn(false)} onClick={() => put("gastos", (f.gastos || []).filter((_, j) => j !== i))}>{tx("Quitar", "Remove")}</button>
          </div>
        );
      })}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("gastos", [...(f.gastos || []), { nombre: "", anual: "", desde: 4, anios: 4 }])}>{tx("+ Agregar gasto futuro", "+ Add future expense")}</button>
      {/* 23-nov-2026: los bloques «Ingresos / Gastos que se acaban» solo remitían al paso 1; el resumen de arriba ya lo dice. */}
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

// 23-nov-2026 (Santiago: "cómo hacer que esta sección lo lleve de verdad a uno
// paso a paso, clara y fluida; si yo mismo que soy el creador me enredo").
// El paso 3 se recorre año por año: arriba los años (con lo que queda en cada
// uno), y del año elegido la cuenta completa: lo que llega, lo que usas y lo que
// queda para el siguiente. Las decisiones se agregan desde aquí y la lista de
// inversiones de abajo muestra solo las de ese año.
function AnioPorAnio({ r, cfg, set, anioSel, setAnioSel, nuevaEnAnio, reinvEnAnio }) {
  const cuenta = cuentaPorAnio(r, cfg);
  const bd = r.bolsaDetalle || {};
  const N = Math.max(1, (r.filas || []).length - 1);
  const g = cuenta.find((y) => y.anio === anioSel);
  const R = reservaDe(cfg);
  const saldoDe = (t) => (t === 1 ? bd.restante || 0 : (cuenta.find((y) => y.anio === t) || {}).saldo || 0);
  // Lo que queda por invertir cada año: el saldo menos lo que dejas para imprevistos.
  const quedaDe = (t) => saldoDe(t) - R;
  const ir = (t) => { setAnioSel(t); setTimeout(() => document.getElementById("f10-anios")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50); };
  const fila = (l, val, { fuerte, signo = "", col } = {}) => <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: fuerte ? 15 : 13.5, fontWeight: fuerte ? 600 : 400, padding: "4px 0" }}><span style={{ color: fuerte ? C.tx : C.tx2, minWidth: 0 }}>{l}</span><span style={{ color: col || C.tx, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signo}{plata(Math.round(Math.abs(val)))}</span></div>;
  const scroll = (id) => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const tabs = Array.from({ length: N }, (_, k) => k + 1);
  return <div style={{ ...card, padding: 0, overflow: "visible" }} id="f10-anios">
    <div style={{ padding: "14px 16px 6px" }}>
      <h3 style={{ margin: 0 }}>{tx("Tu plata año por año", "Your money year by year")}</h3>
      <p style={{ color: C.tx2, fontSize: 12.5, margin: "2px 0 0" }}>{tx("Elige un año: ves cuánto tienes ese año, en qué lo usas y cuánto pasa al siguiente.", "Pick a year: see what you have that year, what you use it for and what carries over.")}</p>
      <ReservaCampo cfg={cfg} set={set} />
    </div>
    <div role="tablist" aria-label={tx("Años del plan", "Plan years")} style={{ position: "sticky", top: 52, zIndex: 6, background: C.bg2, display: "flex", gap: 6, overflowX: "auto", padding: "8px 16px", borderBottom: `1px solid ${C.bd}` }}>
      {tabs.map((t) => { const q = quedaDe(t), on = t === anioSel; return <button key={t} role="tab" aria-selected={on} type="button" onClick={() => ir(t)} style={{ flex: "0 0 auto", textAlign: "left", padding: "6px 12px", borderRadius: 10, cursor: "pointer", background: on ? "rgba(0,200,5,0.12)" : "transparent", border: `1px solid ${on ? C.gn : C.bd}`, color: C.tx }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>{t === 1 ? tx("Hoy", "Today") : anioCal(t)}{t > 1 && ((cuenta.find((y) => y.anio === t) || {}).flujo || 0) < -0.5 && <span title={tx("Este año sale más de lo que entra", "This year more goes out than comes in")} aria-label={tx("Este año sale más de lo que entra", "This year more goes out than comes in")} style={{ width: 7, height: 7, borderRadius: 999, background: C.am, display: "inline-block" }} />}</div>
        <div style={{ fontSize: 11.5, color: q < -0.5 ? C.rd : q > 0.5 ? C.gn : C.tx2, fontVariantNumeric: "tabular-nums" }}>{q < -0.5 ? "−" : ""}{plata(Math.round(Math.abs(q)))}</div>
      </button>; })}
    </div>
    <div style={{ padding: "12px 16px 16px" }}>
      {anioSel === 1 ? <div id="f10-saldo"><Saldo r={r} cfg={cfg} set={set} /></div> : g && <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
        {g.antes > 0.5 && fila(tx(`Viene de ${anioSel === 2 ? "hoy" : anioCal(anioSel - 1)}`, `Carried from ${anioSel === 2 ? "today" : anioCal(anioSel - 1)}`), g.antes)}
        {/* 24-nov-2026 (Santiago: "si me devuelven 3.288 y eso se invierte inmediatamente, no debería
            disponer del capital; además lo hace sin informar"). Arriba solo lo que llega; lo que falta
            para los gastos del año va abajo, explicado, después de las inversiones. */}
        {(g.flujoHoy || 0) > 0.5 && fila(tx(`+ Lo que te sobró del flujo en ${anioCal(1)}`, `+ Cash-flow surplus in ${anioCal(1)}`), g.flujoHoy)}
        {g.flujo > 0.5 && fila(tx(`+ Lo que te sobra del flujo en ${anioCal(anioSel)}`, `+ Cash-flow surplus in ${anioCal(anioSel)}`), g.flujo)}
        {g.llegan.map((l) => <div key={l.id}>{fila(tx(`+ Te llega de ${l.nombre}${l.pagoDeuda > 0.5 ? " (ya pagada su deuda)" : ""}`, `+ From ${l.nombre}${l.pagoDeuda > 0.5 ? " (its debt already paid)" : ""}`), l.monto)}</div>)}
        {/* 23-nov-2026 (Santiago: "¿no es más ordenado mostrar primero lo que ya se dispuso o se pagó (deudas, lo que venía de secciones anteriores) y luego, si queda un saldo, ese se dispone para inversiones nuevas o actuales?"). Mismo orden que hoy: llega → compromisos → disponible para invertir → inversiones → queda. */}
        {(() => {
          const compromisos = g.salen.filter((u) => u.tipo === "A" || u.tipo === "F");
          const inversiones = g.salen.filter((u) => u.tipo !== "A" && u.tipo !== "F");
          const falta = -(Math.min(0, g.flujoHoy || 0) + Math.min(0, g.flujo || 0));
          const llegaBruto = g.disponible + falta;
          const paraInvertir = llegaBruto - compromisos.reduce((sm, u) => sm + u.monto, 0);
          const etq = (t) => <div style={{ fontSize: 12, fontWeight: 600, color: C.tx2, marginTop: 8 }}>{t}</div>;
          return <>
            {fila(tx(`Llega en ${anioCal(anioSel)}`, `Arrives in ${anioCal(anioSel)}`), llegaBruto, { fuerte: compromisos.length > 0 })}
            {compromisos.length > 0 && etq(tx("Ya comprometido", "Already committed"))}
            {compromisos.map((u, k) => <div key={"c" + k}>{fila(`− ${u.nombre}`, u.monto, { col: C.tx2 })}</div>)}
            {R > 0.5 && fila(tx("− Saldo para imprevistos (no lo tocas)", "− Rainy-day balance (you keep it)"), R, { col: C.tx2 })}
            <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 4 }}>{fila(tx(`Disponible para invertir en ${anioCal(anioSel)}`, `Available to invest in ${anioCal(anioSel)}`), paraInvertir - R, { fuerte: true, col: paraInvertir - R < -0.5 ? C.rd : C.tx })}</div>
            {inversiones.length > 0 && etq(tx("Inversiones", "Investments"))}
            {inversiones.map((u, k) => <div key={"i" + k}>{fila(`− ${u.nombre}`, u.monto, { col: C.tx2 })}</div>)}
            {inversiones.length === 0 && <div style={{ fontSize: 12.5, color: C.tx2, padding: "4px 0" }}>{tx(`Todavía no inviertes nada en ${anioCal(anioSel)}.`, `Nothing invested in ${anioCal(anioSel)} yet.`)}</div>}
            {falta > 0.5 && <>
              {etq(tx("Tus gastos del año", "Your living costs this year"))}
              {fila(tx(`− Lo que falta para tus gastos de ${anioCal(anioSel)}`, `− Shortfall for your ${anioCal(anioSel)} living costs`), falta, { col: C.am })}
              <FaltaExplica r={r} cfg={cfg} set={set} anio={anioSel} falta={falta} />
            </>}
          </>;
        })()}
        <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 6, paddingTop: 6 }}>{g.saldo >= -0.5
          ? fila(anioSel < N ? tx(`Queda para ${anioCal(anioSel + 1)}`, `Carries to ${anioCal(anioSel + 1)}`) : tx(`Queda en ${anioCal(anioSel)}`, `Left in ${anioCal(anioSel)}`), g.saldo, { fuerte: true, col: g.saldo > 0.5 ? C.gn : C.tx })
          : fila(tx(`En ${anioCal(anioSel)} faltan`, `Short in ${anioCal(anioSel)}`), g.saldo, { fuerte: true, col: C.rd })}</div>
        {g.saldo < -0.5 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx("Lo que falta sale de tus cuentas e inversiones líquidas. Si prefieres, baja un monto o pásalo a otro año.", "The shortfall comes from your accounts and liquid investments. Or lower an amount or move it to another year.")}</div>}
        {R > 0.5 && g.saldo >= -0.5 && (g.saldo + 0.5 >= R
          ? <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`Incluye tu saldo para imprevistos de ${plata(Math.round(R))}; por invertir te quedan ${plata(Math.round(Math.max(0, g.saldo - R)))}.`, `Includes your ${plata(Math.round(R))} rainy-day balance; ${plata(Math.round(Math.max(0, g.saldo - R)))} left to invest.`)}</div>
          : <div style={{ fontSize: 12, color: C.am, marginTop: 2 }}>{tx(`Estás usando ${plata(Math.round(R - g.saldo))} de tu saldo para imprevistos. Baja un monto si quieres conservarlo completo.`, `You're using ${plata(Math.round(R - g.saldo))} of your rainy-day balance. Lower an amount to keep it whole.`)}</div>)}
        {/* 23-nov-2026 (Santiago: "cada año queda plata; debería ser claro en qué se reinvierte"). */}
        {g.saldo > 0.5 && (() => { const m = cfg.repartoDisponible ? null : (cfg.mezcla || supuestosF10().nortes[cfg.norte || "equilibrio"] || supuestosF10().nortes.equilibrio); return <div style={{ fontSize: 12.5, color: C.tx, marginTop: 8, background: "rgba(0,200,5,0.06)", border: `1px solid ${C.bd}`, borderRadius: 8, padding: "8px 10px" }}>
          {tx(`Los ${plata(Math.round(g.saldo))} que quedan${R > 0.5 ? ` (con tu saldo para imprevistos)` : ""}, mientras no les des un destino, `, `The ${plata(Math.round(g.saldo))} left${R > 0.5 ? " (with your rainy-day balance)" : ""}, until you give it a destination, `)}{m ? tx(`se invierten así: ${fmtPctEs(Number(m.liquidez) || 0, 0)} liquidez, ${fmtPctEs(Number(m.renta) || 0, 0)} renta fija y ${fmtPctEs(Number(m.crecimiento) || 0, 0)} crecimiento (lo cambias en D · Lo que sobra).`, `is invested: ${fmtPctEs(Number(m.liquidez) || 0, 0)} cash, ${fmtPctEs(Number(m.renta) || 0, 0)} fixed income, ${fmtPctEs(Number(m.crecimiento) || 0, 0)} growth (change it in D).`) : tx("quedan disponibles en liquidez (lo cambias en D · Lo que sobra).", "stay available as cash (change it in D).")}
          {" "}{tx("O dales destino ya:", "Or assign it now:")} <button type="button" onClick={() => nuevaEnAnio(anioSel, g.saldo - R)} style={{ background: "transparent", border: "none", padding: 0, color: C.gn, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>{tx("inversión nueva", "new investment")}</button>{" · "}<span>{tx("o elige un activo abajo, en «Invertir en lo que ya tienes».", "or pick an asset below, in \"Invest in what you own\".")}</span>
        </div>; })()}
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" style={{ ...btn(true), padding: "9px 14px" }} onClick={() => nuevaEnAnio(anioSel, quedaDe(anioSel))}>{tx(`+ Inversión nueva ${anioSel === 1 ? "hoy" : "en " + anioCal(anioSel)}`, `+ New investment ${anioSel === 1 ? "today" : "in " + anioCal(anioSel)}`)}</button>
        <button type="button" style={{ ...btn(false), padding: "9px 14px" }} onClick={() => scroll("f10-deudas")}>{tx("Pagar una deuda", "Pay off a debt")}</button>
        {(() => { const libres = activosParaAportar(r, cfg, anioSel); return libres.length > 0 &&
          <select aria-label={tx("Invertir en algo que ya tienes", "Invest in something you own")} style={{ ...inp, width: "auto", maxWidth: "100%", padding: "9px 12px", cursor: "pointer" }} value="" onChange={(e) => { if (e.target.value) reinvEnAnio(e.target.value, anioSel); }}>
            <option value="">{tx(`+ Invertir en algo que ya tienes…`, `+ Invest in something you own…`)}</option>
            <OpcionesAportar libres={libres} />
          </select>; })()}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12 }}>
        {anioSel > 1 ? <button type="button" style={{ ...btn(false), padding: "8px 12px" }} onClick={() => ir(anioSel - 1)}>← {anioSel === 2 ? tx("Hoy", "Today") : anioCal(anioSel - 1)}</button> : <span />}
        {anioSel < N && <button type="button" style={{ ...btn(false), padding: "8px 12px" }} onClick={() => ir(anioSel + 1)}>{anioCal(anioSel + 1)} →</button>}
      </div>
    </div>
  </div>;
}
// 23-nov-2026 (Santiago: "se supone que dejo un saldo disponible para cualquier eventualidad
// en 2029 y en 2030 no hay ninguno"). Saldo que siempre quieres tener disponible: pasa de un
// año al siguiente y el monto que viene lleno en una inversión no lo toma.
const reservaDe = (cfg) => Math.max(0, Number(cfg && cfg.reserva) || 0);
function ReservaCampo({ cfg, set }) {
  const R = reservaDe(cfg);
  return <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10, padding: "10px 12px", background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 8 }}>
    <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13, color: C.tx }}>
      <b style={{ fontWeight: 600 }}>{tx("Saldo para imprevistos", "Rainy-day balance")}</b>
      <NumberInput style={{ ...inp, width: 170 }} placeholder={tx("Ej.: 500.000.000", "e.g. 50,000")} value={cfg.reserva ?? ""} onChange={(v) => set("reserva", v)} />
    </label>
    <span style={{ fontSize: 12, color: C.tx2, flex: "1 1 260px", lineHeight: 1.45 }}>{R > 0.5 ? tx(`Cada año dejas ${plata(Math.round(R))} disponibles: pasan al año siguiente y lo que inviertes no los toma. Mientras tanto se invierten según tu mezcla (D).`, `Each year you keep ${plata(Math.round(R))} available: it carries over and your investments don't take it. Meanwhile it's invested per your mix (D).`) : tx("Lo que quieres tener siempre disponible para cualquier eventualidad. Si lo pones, el monto que viene lleno en cada inversión no lo toma.", "What you always want available for any eventuality. If you set it, the amount pre-filled in each investment won't take it.")}</span>
  </div>;
}
// 24-nov-2026 (Santiago: "¿por qué me faltarían 234 MM de flujo, si las inversiones de los años
// anteriores dan para vivir?"). Cuando un año sale más de lo que entra, se dice cuánto al mes,
// de dónde se paga y por qué: las inversiones que reinvierten todo lo que ganan no entran al mes.
// Si una inversión del plan alcanza a cubrirlo pagándote una parte, se ofrece con un toque.
function FaltaExplica({ r, cfg, set, anio, falta }) {
  const f = (r.filas || [])[anio] || {};
  const reinv = (f.porActivo || []).filter((a) => !["canasta", "inmueble", "vehiculo", "ingreso", "ciclo"].includes(a.clase) && (a.crece || 0) > 0.5 && !((a.renta || 0) > 0.5)).sort((a, b) => b.crece - a.crece);
  const idx = (id) => { const m = /^nueva_(\d+)$/.exec(String(id)); return m ? Number(m[1]) : -1; };
  const cand = reinv.map((a) => ({ a, k: idx(a.id) })).find((x) => x.k >= 0 && (cfg.nuevas || [])[x.k] && !(cfg.nuevas[x.k].preset === "fincaRaiz" && cfg.nuevas[x.k].pr));
  const pct = cand ? [25, 50, 75, 100].find((p) => cand.a.crece * p / 100 >= falta) : null;
  const top = reinv.slice(0, 3);
  return <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.5, margin: "2px 0 6px" }}>
    {tx(`En ${anioCal(anio)} sale más de lo que entra: te faltan unos ${plata(Math.round(falta / 12))} al mes. Se cubren con lo que queda este año, no con lo que inviertes; si inviertes todo, salen de tus cuentas e inversiones líquidas.`, `In ${anioCal(anio)} more goes out than comes in: about ${plata(Math.round(falta / 12))} a month short. It's covered by what's left this year, not by what you invest; if you invest it all, it comes out of your accounts and liquid investments.`)}
    {top.length > 0 && <> {tx(`Tus inversiones sí producen, pero ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} al mes)`).join(", ")} reinvierten todo lo que ganan: eso no entra a tu mes.`, `Your investments do earn, but ${top.map((a) => `${a.nombre} (${plata(Math.round(a.crece / 12))} a month)`).join(", ")} reinvest everything they earn: that doesn't reach your month.`)}</>}
    {cand && pct && <div style={{ marginTop: 8 }}><button type="button" style={{ ...btn(true), padding: "8px 12px" }} onClick={() => set("nuevas", cfg.nuevas.map((x, j) => (j === cand.k ? { ...x, pctRecibe: pct } : x)))}>{tx(`Que ${cand.a.nombre} me pague ${pct === 100 ? "todo lo que rinde" : `el ${pct} % de lo que rinde`} (unos ${plata(Math.round(cand.a.crece * pct / 100 / 12))} al mes)`, `Have ${cand.a.nombre} pay me ${pct === 100 ? "all it earns" : `${pct}% of what it earns`} (about ${plata(Math.round(cand.a.crece * pct / 100 / 12))} a month)`)}</button>
      <div style={{ marginTop: 4 }}>{tx("Te paga desde que la creas, cada mes, y el resto sigue reinvirtiéndose. Lo cambias en esa inversión, en «¿Cuánto te llega?».", "It pays you every month from when you create it; the rest keeps compounding. Change it in that investment under \"How much do you receive?\".")}</div></div>}
  </div>;
}
function veredictoSaldo(r, R = 0) {
  const bd = r.bolsaDetalle || {};
  const exceso = bd.excesoVentas || 0, sobra = bd.restante || 0;
  const cub = bd.excesoCubierto || 0, noAlcanza = Math.max(0, exceso - cub);
  if (exceso > 0.5) return { ok: false, corto: tx(`Te pasaste ${plata(Math.round(exceso))}`, `Over by ${plata(Math.round(exceso))}`), largo: tx(`Te pasaste ${plata(Math.round(exceso))} de lo que vendes.${cub > 0.5 ? ` ${plata(Math.round(cub))} salen de tus cuentas de hoy (ahorros y efectivo).` : ""}${noAlcanza > 0.5 ? ` ${plata(Math.round(noAlcanza))} no alcanzan: esa parte no se invierte. Baja montos o elige «Plata nueva de afuera».` : ""}`, `You went ${plata(Math.round(exceso))} over your sale proceeds.${cub > 0.5 ? ` ${plata(Math.round(cub))} comes from your current accounts (savings and cash).` : ""}${noAlcanza > 0.5 ? ` ${plata(Math.round(noAlcanza))} isn't covered: that part isn't invested. Lower the amounts or choose "New money from outside".` : ""}`) };
  if ((bd.vendido || 0) + (bd.capitalNuevo || 0) <= 0) return { ok: true, corto: tx("Sin ventas", "No sales"), largo: tx("Todavía no vendes nada. Lo que inviertas sale de tus cuentas de hoy o de plata nueva.", "You're not selling anything yet. What you invest comes from your current accounts or new money.") };
  if (R > 0.5) return { ok: sobra + 0.5 >= R, corto: sobra + 0.5 >= R ? tx(`Por invertir hoy ${plata(Math.round(sobra - R))}`, `To invest today ${plata(Math.round(sobra - R))}`) : tx(`Usas ${plata(Math.round(R - Math.max(0, sobra)))} de tu saldo para imprevistos`, `Using ${plata(Math.round(R - Math.max(0, sobra)))} of your rainy-day balance`), largo: tx(`Lo que te queda hoy para invertir, aparte de tu saldo para imprevistos (${plata(Math.round(R))}), que pasa al año siguiente.`, `What's left today to invest, apart from your rainy-day balance (${plata(Math.round(R))}), which carries to next year.`) };
  return { ok: true, corto: tx(`Saldo de hoy ${plata(Math.round(sobra))}`, `Today's balance ${plata(Math.round(sobra))}`), largo: tx("Lo que te queda hoy, después de pagar deudas y de lo que inviertes hoy. Pasa al año siguiente.", "What's left today, after debt and today's investments. It carries to the next year.") };
}
function Saldo({ r, cfg, set }) {
  const bd = r.bolsaDetalle || {};
  const vend = (r.vendidos || []).map((v) => v.nombre).join(", ");
  const R = reservaDe(cfg);
  const v = veredictoSaldo(r, R);
  const elegidoLiquidez = Math.max(0, (bd.desdeLiquidez || 0) - (bd.excesoCubierto || 0));
  const entra = [
    ...(bd.vendido > 0 ? [[`${tx("Lo que vendes", "What you sell")} (${vend})`, bd.vendido]] : []),
    ...(bd.capitalNuevo > 0 ? [[tx("Plata nueva de afuera", "New money from outside"), bd.capitalNuevo]] : []),
    ...(elegidoLiquidez > 0.5 ? [[tx("De tus cuentas de hoy (lo elegiste)", "From your current accounts (your choice)"), elegidoLiquidez]] : []),
  ];
  // 22-nov-2026 (Santiago: "primero el total que sobra, 1.600 M, y a medida que
  // agrego inversiones debería aparecer 1.600 − bodega 600 − inversión X 400 =
  // saldo disponible 600"). Una sola cuenta, renglón por renglón.
  const antes = [
    // 23-nov-2026 (Santiago: "no me quedó claro en qué se gastaron los 800 M… ¿se fue en automático en deudas?"). Deuda por deuda, con el porqué.
    ...(r.deudas || []).filter((d) => d.pagado > 0.5).map((d) => [`− ${tx("Pagas", "Pay off")} ${d.nombre} · ${d.porVenta ? tx(`con la venta de ${((r.vendidos || []).find((v) => v.id === d.activoId) || {}).nombre || "su activo"}`, `with the sale of ${((r.vendidos || []).find((v) => v.id === d.activoId) || {}).nombre || "its asset"}`) : tx("tú la marcaste «Se paga»", "you marked it \"Pay off\"")}${d.pagado < d.saldo - 0.5 ? tx(` (abono; debe ${plata(Math.round(d.saldo))})`, ` (partial; owes ${plata(Math.round(d.saldo))})`) : ""}`, d.pagado]),
    ...(bd.colchon > 0 ? [[tx(`− Colchón de ${supuestosF10().colchonMeses} meses`, `− ${supuestosF10().colchonMeses}-month cushion`), bd.colchon]] : []),
  ];
  const entraTotal = entra.reduce((sm, x) => sm + x[1], 0) + (bd.excesoCubierto || 0);
  const disponible = entraTotal - antes.reduce((sm, x) => sm + x[1], 0);
  const usosHoy = (bd.usos || []).filter((u) => !(u.anio > 1 && !u.apartado)).map((u) => ({ u, m: (u.deVenta || 0) + (u.deCuentas || 0) + (u.deNuevo || 0) })).filter((x) => x.m > 0.5);
  const saldoFinal = bd.restante || 0;
  const otros = disponible - usosHoy.reduce((sm, x) => sm + x.m, 0) - saldoFinal; // lo que no viene renglón por renglón (negocios que se repiten)
  const hayCuenta = entraTotal > 0.5;
  const fila = ([l, val], col) => <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "3px 0" }}><span style={{ color: C.tx2, minWidth: 0 }}>{l}</span><span style={{ color: col, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(val))}</span></div>;
  return <div style={{ background: C.bg, borderRadius: 8, padding: 12 }}>
    <div style={{ padding: "10px 12px", borderRadius: 8, marginBottom: 10, background: v.ok ? "rgba(0,200,5,0.12)" : "rgba(255,80,0,0.14)", border: `1px solid ${v.ok ? C.gn : C.rd}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: v.ok ? C.gn : C.rd }}>{v.corto}</div>
      <div style={{ fontSize: 12, color: C.tx }}>{v.largo}</div>
    </div>
    {entra.length > 0 && <><div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1 }}>{tx("Entra", "In")}</div>{entra.map((x) => fila(x, C.tx))}</>}
    {(bd.excesoCubierto || 0) > 0.5 && fila([tx("Faltó: sale de tus cuentas de hoy", "Shortfall: from your current accounts"), bd.excesoCubierto], C.rd)}
    {hayCuenta && <>
      {antes.map((x) => fila(x, C.tx2))}
      {(r.deudas || []).some((d) => d.pagado > 0.5 && !d.porVenta) && <div style={{ fontSize: 12, color: C.tx2, padding: "2px 0 4px" }}>{tx("Las deudas que marcaste las decides tú: si prefieres invertir esa plata, ponlas en «Sigue».", "The debts you marked are your call: if you'd rather invest that money, set them to \"Keep\".")} <button type="button" onClick={() => document.getElementById("f10-deudas")?.scrollIntoView?.({ behavior: "smooth", block: "start" })} style={{ background: "transparent", border: "none", padding: 0, color: C.tx, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>{tx("Cambiar en A · Pagar deudas", "Change in A · Pay off debt")}</button></div>}
      {R > 0.5 && fila([tx("− Saldo para imprevistos (no lo tocas)", "− Rainy-day balance (you keep it)"), R], C.tx2)}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 700, borderTop: `1px solid ${C.bd}`, marginTop: 6, paddingTop: 8 }}><span>{tx("Disponible para invertir", "Available to invest")}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(disponible - R))}</span></div>
      {usosHoy.map(({ u, m }, k) => fila([`− ${u.nombre}${u.anio > 1 ? tx(` (apartado para ${anioCal(u.anio)})`, ` (set aside for ${anioCal(u.anio)})`) : ""}`, m], C.tx2))}
      {otros > 0.5 && fila([tx("− Negocios que se repiten y otros", "− Repeating deals and other"), otros], C.tx2)}
      {usosHoy.length === 0 && !(otros > 0.5) && <div style={{ fontSize: 12, color: C.tx2, padding: "3px 0" }}>{tx("Cada inversión que agregues abajo (B, C) se va restando aquí.", "Each investment you add below (B, C) is subtracted here.")}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 16, fontWeight: 700, borderTop: `1px solid ${C.bd}`, marginTop: 6, paddingTop: 8 }}><span>{R > 0.5 ? tx("Te queda por invertir hoy", "Left to invest today") : tx("Saldo de hoy", "Today's balance")}</span><span style={{ color: saldoFinal - R > 0.5 ? C.gn : saldoFinal - R < -0.5 ? C.rd : C.tx, fontVariantNumeric: "tabular-nums" }}>{saldoFinal - R < -0.5 ? "−" : ""}{plata(Math.round(Math.abs(saldoFinal - R)))}</span></div>
      {R > 0.5 && <div style={{ fontSize: 12, color: saldoFinal + 0.5 >= R ? C.tx2 : C.am, marginTop: 2 }}>{saldoFinal + 0.5 >= R ? tx(`Tu saldo para imprevistos de ${plata(Math.round(R))} pasa contigo al año siguiente.`, `Your ${plata(Math.round(R))} rainy-day balance carries to next year.`) : tx(`Estás usando ${plata(Math.round(R - Math.max(0, saldoFinal)))} de tu saldo para imprevistos.`, `You're using ${plata(Math.round(R - Math.max(0, saldoFinal)))} of your rainy-day balance.`)}</div>}
      {/* 23-nov-2026 (Santiago: "yo debería poder disponer de esos 126 M inmediatamente en una inversión, ponerlo en IBKR o lo que quiera"). */}
      {saldoFinal - R > 0.5 && set && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <button style={{ ...btn(true), padding: "8px 14px" }} onClick={() => { const k = (cfg.nuevas || []).length; set("nuevas", [...(cfg.nuevas || []), { preset: "rfCorto", monto: Math.round(saldoFinal - R), fuente: "venta" }]); setTimeout(() => document.getElementById("f10-nueva-" + k)?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 150); }}>{tx("Invertir este saldo hoy", "Invest this balance today")}</button>
        <span style={{ fontSize: 12, color: C.tx2, flex: "1 1 240px" }}>{tx("Te crea la inversión con ese monto; eliges en qué. Para ponerlo en algo que ya tienes (por ejemplo IBKR), agrégalo abajo en B. Si no lo usas, pasa al año siguiente.", "Creates the investment with that amount; you choose what. To add it to something you own (e.g. your brokerage), add it below in B. If unused, it carries to the next year.")}</span>
      </div>}
    </>}
    {(bd.usos || []).length > 0 && <details style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, color: C.tx }}>{tx("Ver de dónde sale la plata de cada inversión", "See where each investment's money comes from")}</summary>
      {bd.usos.map((u, k) => {
        const partes = [u.deVenta > 0.5 && `${plata(Math.round(u.deVenta))} ${tx("de lo que vendes", "from sales")}`, u.deCuentas > 0.5 && `${plata(Math.round(u.deCuentas))} ${tx("de tus cuentas", "from your accounts")}`, u.deNuevo > 0.5 && `${plata(Math.round(u.deNuevo))} ${tx("plata nueva", "new money")}`].filter(Boolean);
        const fuenteTxt = u.fuente === "liquidez" ? tx("de tus cuentas", "from your accounts") : u.fuente === "nuevo" ? tx("plata nueva (no resta del saldo)", "new money (doesn't reduce the balance)") : tx("de lo que vendes", "from sales");
        return <div key={k} style={{ fontSize: 12, padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ color: C.tx }}>{u.seccion}. {u.nombre}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{plata(Math.round(u.monto))}</span></div>
          <div style={{ color: C.tx2 }}>{u.anio > 1 ? `${anioCal(u.anio)} · ${partes.join(" + ") || fuenteTxt}` : partes.join(" + ") || fuenteTxt}</div>
        </div>;
      })}
    </details>}
    {(bd.excesoVentas || 0) - (bd.excesoCubierto || 0) > 0.5 && fila([tx("Pediste de más y no alcanza: no se invierte", "You asked for more than is available: not invested"), (bd.excesoVentas || 0) - (bd.excesoCubierto || 0)], C.rd)}
    <div style={{ fontSize: 12, color: C.tx2, marginTop: 6 }}>
      {bd.pendienteAnio1 > 0 && <div style={{ color: C.am, marginTop: 4 }}>{tx(`Lo que inviertes no alcanza con lo vendido y tu liquidez: los ${plata(bd.pendienteAnio1)} que faltan salen de lo que vaya entrando en el año 1.`, `Sale proceeds and cash don't cover what you invest: the missing ${plata(bd.pendienteAnio1)} comes from what flows in during year 1.`)}</div>}
      {bd.obrasPedido > bd.obras + 0.5 && <div style={{ color: C.am, marginTop: 4 }}>{tx(`La obra pide ${plata(bd.obrasPedido)}: ${plata(bd.obras)} salen de aquí y ${plata(bd.obrasPedido - bd.obras)} de lo que entre en el año 1.`, `The build-out needs ${plata(bd.obrasPedido)}: ${plata(bd.obras)} comes from here and ${plata(bd.obrasPedido - bd.obras)} from what flows in during year 1.`)}</div>}

    </div>
  </div>;
}
// 22-nov-2026 (Santiago: "en un escenario futuro el sistema debe decirme que en el
// año X tengo libre 100 M y ahí mismo proyectar qué hacer con él"). Plata que llega
// en años siguientes (inversiones que vencen o se venden después) y cuánta ya tiene destino.
function Liberados({ r, cfg, set, abrir }) {
  const cuenta = cuentaPorAnio(r, cfg);
  if (!cuenta.length) return null;
  const fila = (l, val, col, fuerte, signo = "") => <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: fuerte ? 15 : 13, fontWeight: fuerte ? 700 : 400, padding: "3px 0" }}><span style={{ color: fuerte ? C.tx : C.tx2, minWidth: 0 }}>{l}</span><span style={{ color: col, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signo}{plata(Math.round(Math.abs(val)))}</span></div>;
  // Crea la inversión ya con el año y el monto de esa plata, para que solo falte decir en qué.
  const invertir = (g) => {
    const k = (cfg.nuevas || []).length;
    set("nuevas", [...(cfg.nuevas || []), { preset: "custom", nombre: "", monto: Math.round(g.saldo), anio: g.anio, fuente: "liquidez", deLiberado: g.llegan.map((l) => l.nombre).join(" + ") || tx("lo que te sobró de antes", "what was left from before") }]);
    abrir && abrir(k);
    setTimeout(() => { const el = document.getElementById("f10-nueva-" + k); el?.scrollIntoView?.({ behavior: "smooth", block: "center" }); el?.querySelector?.("input")?.focus?.({ preventScroll: true }); }, 150);
  };
  return <>
    <div style={{ fontSize: 12, color: C.tx2, letterSpacing: 1, margin: "14px 0 0" }}>{tx("AÑOS SIGUIENTES", "LATER YEARS")}</div>
    <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx("La misma cuenta, año por año: lo que viene de antes, más lo que te llega, menos lo que inviertes ese año. Cada inversión resta solo en su año.", "The same account, year by year: what carries over, plus what arrives, minus what you invest that year. Each investment is subtracted only in its year.")}</div>
    {cuenta.map((g) => (
      <div key={g.anio} style={{ background: C.bg, borderRadius: 8, padding: 12, marginTop: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{anioCal(g.anio)}</div>
        {g.antes > 0.5 && fila(tx("Viene del año anterior", "Carried from the previous year"), g.antes, C.tx)}
        {g.llegan.map((l) => <div key={l.id}>{fila(`+ ${tx("Te llega de", "Arrives from")} ${l.nombre}${l.parcial ? tx(" (retiro de una parte)", " (partial withdrawal)") : ""}${l.pagoDeuda > 0.5 ? tx(` · ya pagada su deuda de ${plata(Math.round(l.pagoDeuda))}`, ` · its ${plata(Math.round(l.pagoDeuda))} debt already paid`) : ""}`, l.monto, C.tx)}</div>)}
        {g.salen.map((u, k) => <div key={k}>{fila(`− ${tx("Inviertes en", "You invest in")} ${u.nombre}`, u.monto, C.tx2)}</div>)}
        {g.salen.length === 0 && <div style={{ fontSize: 12, color: C.tx2, padding: "3px 0" }}>{tx(`Todavía no inviertes nada en ${anioCal(g.anio)}.`, `You're not investing anything in ${anioCal(g.anio)} yet.`)}</div>}
        <div style={{ borderTop: `1px solid ${C.bd}`, marginTop: 4, paddingTop: 6 }}>{g.saldo >= -0.5
          ? fila(tx(`Saldo de ${anioCal(g.anio)}`, `${anioCal(g.anio)} balance`), g.saldo, g.saldo > 0.5 ? C.gn : C.tx, true)
          : fila(tx(`En ${anioCal(g.anio)} faltan`, `Short in ${anioCal(g.anio)}`), g.saldo, C.rd, true)}</div>
        {g.saldo < -0.5 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 2 }}>{tx(`Lo que inviertes en ${anioCal(g.anio)} es más que la plata que hay ese año. Lo que falta saldría de tus otras cuentas o de lo que te sobre cada mes; si no, baja el monto o pásalo a otro año.`, `What you invest in ${anioCal(g.anio)} is more than the money available that year. The shortfall would come from your other accounts or monthly surplus; otherwise lower the amount or move it to another year.`)}</div>}
        {g.saldo > 0.5 && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <button style={{ ...btn(true), padding: "8px 14px" }} onClick={() => invertir(g)}>{tx(`+ Invertir en ${anioCal(g.anio)}`, `+ Invest in ${anioCal(g.anio)}`)}</button>
          <span style={{ fontSize: 12, color: C.tx2, flex: "1 1 220px" }}>{tx(`Puedes repartir el saldo en varias inversiones: cada una resta aquí. Lo que no asignes pasa a ${anioCal(g.anio + 1)}.`, `You can split the balance across several investments: each one is subtracted here. Whatever you don't allocate carries to ${anioCal(g.anio + 1)}.`)}</span>
        </div>}
      </div>))}
  </>;
}
// Barra fija abajo en Tu plata: el veredicto siempre a la vista.
function SaldoFijo({ r, cfg, anioSel = 1, onVer }) {
  const R = reservaDe(cfg);
  if (anioSel > 1) {
    const g = cuentaPorAnio(r, cfg).find((y) => y.anio === anioSel);
    const q = (g ? g.saldo : 0) - R, ok = q >= -0.5;
    return <div onClick={onVer} style={{ position: "sticky", bottom: 8, zIndex: 5, margin: "8px 0", padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: ok ? "rgba(15,42,26,0.97)" : "rgba(58,20,20,0.97)", border: `1px solid ${ok ? C.gn : C.rd}`, boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
      <span style={{ fontWeight: 700, color: ok ? C.gn : C.rd }}>{ok ? tx(`${anioCal(anioSel)}: queda ${plata(Math.round(q))}${R > 0.5 ? " por invertir" : ""}`, `${anioCal(anioSel)}: ${plata(Math.round(q))} left${R > 0.5 ? " to invest" : ""}`) : R > 0.5 && q + R >= -0.5 ? tx(`${anioCal(anioSel)}: usas ${plata(Math.round(-q))} de tu saldo para imprevistos`, `${anioCal(anioSel)}: using ${plata(Math.round(-q))} of your rainy-day balance`) : tx(`${anioCal(anioSel)}: faltan ${plata(Math.round(-q - R))}`, `${anioCal(anioSel)}: short ${plata(Math.round(-q - R))}`)}</span>
      <span style={{ fontSize: 12, color: C.tx2 }}>{tx("ver ↑", "see ↑")}</span>
    </div>;
  }
  const v = veredictoSaldo(r, R);
  return <div onClick={onVer} style={{ position: "sticky", bottom: 8, zIndex: 5, margin: "8px 0", padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: v.ok ? "rgba(15,42,26,0.97)" : "rgba(58,20,20,0.97)", border: `1px solid ${v.ok ? C.gn : C.rd}`, boxShadow: "0 6px 20px rgba(0,0,0,0.5)" }}>
    <span style={{ fontWeight: 700, color: v.ok ? C.gn : C.rd }}>{v.corto}</span>
    <span style={{ fontSize: 12, color: C.tx2 }}>{v.ok ? tx("de lo que vendes", "from sales") : tx("sale de tus cuentas", "from your accounts")} · {tx("ver ↑", "see ↑")}</span>
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
function ResumenPaso1({ user, cfg, r, irHoy }) {
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
        de(1).vende.push({ id: x.id, nombre: x.nombre, bruto, deuda });
      } else {
        const l = lib.find((y) => y.id === x.id && y.anio === t);
        const deuda = (l && l.pagoDeuda) || 0;
        de(t).vende.push({ id: x.id, nombre: x.nombre, bruto: (l ? l.monto : devuelve(x)) + deuda, deuda });
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
  const lista = Object.keys(anios).map(Number).sort((a, b) => a - b);
  const conserva = invs.filter((x) => !x.vende && !x.termina && !x.cambio && !reinv.some((y) => y.activoId === x.id));
  const fila = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", alignItems: "baseline" };
  const cifra = { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const grupo = (titulo, filas) => filas.length ? <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.tx2, marginBottom: 2 }}>{titulo}</div>{filas}
  </div> : null;
  const Anio = ({ t }) => {
    const g = anios[t];
    const libera = g.vende.reduce((sm, v) => sm + v.bruto - v.deuda, 0);
    const dRenta = g.rentas.reduce((sm, x) => sm + x.despues - x.antes, 0) - g.ingresos.reduce((sm, i) => sm + i.mensual, 0);
    const hoy = t === 1;
    return <div style={{ background: C.bg, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 999, boxSizing: "border-box", border: `3px solid ${hoy ? C.gn : C.tx2}`, background: hoy ? C.gn : C.bg, flexShrink: 0 }} />
        {hoy ? tx(`Hoy · ${anioCal(1)}`, `Today · ${anioCal(1)}`) : anioCal(t)}
      </div>
      {libera > 0.5 && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Liberas", "You free up")}</div>
        <div style={{ ...cifra, fontSize: 22, fontWeight: 600, color: C.gn, letterSpacing: "-0.01em" }}>{plata(Math.round(libera))}</div>
        <div style={{ fontSize: 12, color: C.tx2 }}>{g.vende.some((v) => v.deuda > 0.5) ? tx("de lo que vendes, ya descontadas sus deudas", "from what you sell, net of its debts") : tx("de lo que vendes o termina", "from what you sell or ends")}</div>
      </div>}
      {Math.abs(dRenta) > 0.5 && <div style={{ marginTop: libera > 0.5 ? 8 : 10, fontSize: 13 }}>
        <b style={{ ...cifra, color: dRenta > 0 ? C.gn : C.rd }}>{dRenta > 0 ? "+" : "−"}{plata(Math.round(Math.abs(dRenta)))}</b>
        <span style={{ color: C.tx2 }}>{tx(" al mes en tus ingresos desde este año", " a month in your income from this year")}</span>
      </div>}
      {grupo(tx("Vendes o termina", "Sell or ends"), g.vende.map((v) => <div key={v.id}>
        <div style={fila}><span style={{ minWidth: 0 }}>{v.nombre}</span><span style={cifra}>{plata(Math.round(v.bruto))}</span></div>
        {v.deuda > 0.5 && <div style={{ ...fila, fontSize: 12, color: C.tx2, paddingTop: 0 }}><span>{tx("− su deuda, que se paga con la venta", "− its debt, paid with the sale")}</span><span style={{ ...cifra, color: C.rd }}>−{plata(Math.round(v.deuda))}</span></div>}
      </div>))}
      {grupo(tx("Rentas que empiezan o cambian", "Rent that starts or changes"), g.rentas.map((x) => { const d = x.despues - x.antes; return <div key={x.id}>
        <div style={fila}><span style={{ minWidth: 0 }}>{x.nombre}</span><span style={{ ...cifra, color: d >= 0 ? C.gn : C.rd }}>{d >= 0 ? "+" : "−"}{plata(Math.round(Math.abs(d)))}{tx("/mes", "/mo")}</span></div>
        {(x.antes > 0.5 || x.despues < 0.5) && <div style={{ fontSize: 12, color: C.tx2, marginTop: -2, paddingBottom: 2 }}>{x.despues < 0.5 ? tx("Deja de rentar: lo usas tú", "Stops earning: you use it") : tx(`Pasa de ${plata(Math.round(x.antes))} a ${plata(Math.round(x.despues))} al mes`, `Goes from ${plata(Math.round(x.antes))} to ${plata(Math.round(x.despues))} a month`)}</div>}
      </div>; }))}
      {grupo(tx("Le inviertes a lo que tienes", "You invest in what you own"), g.aportes.map((a) => <div key={a.id} style={fila}><span style={{ minWidth: 0 }}>{a.nombre}</span><span style={{ ...cifra, color: a.monto > 0 ? C.tx : C.tx2 }}>{a.monto > 0 ? plata(Math.round(a.monto)) : tx("falta el monto", "amount missing")}</span></div>))}
      {grupo(tx("Ingresos que se acaban", "Income that ends"), g.ingresos.map((i) => <div key={i.id} style={fila}><span style={{ minWidth: 0 }}>{i.nombre}</span><span style={{ ...cifra, color: C.rd }}>−{plata(Math.round(i.mensual))}{tx("/mes", "/mo")}</span></div>))}
    </div>;
  };
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{tx("Lo que ya decidiste en el paso 1, año por año", "What you decided in step 1, year by year")}</div>
        <button type="button" onClick={irHoy} style={{ background: "transparent", border: "none", padding: 0, color: C.tx2, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>{tx("Cambiar en el paso 1", "Change in step 1")}</button>
      </div>
      <div style={{ fontSize: 12, color: C.tx2, margin: "2px 0 12px", lineHeight: 1.5 }}>{tx("Lo que vendes, las rentas que cambian y lo que le inviertes a lo que tienes. Así va quedando tu plan; lo que haces con la plata de cada año lo decides en el paso 3.", "What you sell, rent that changes and what you invest in what you own. This is how your plan is shaping up; what you do with each year's money is decided in step 3.")}</div>
      {lista.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 }}>
        {lista.map((t) => <Anio key={t} t={t} />)}
      </div> : <div style={{ fontSize: 13, color: C.tx2 }}>{tx("Todavía no decidiste nada en el paso 1: todo sigue como hoy.", "You haven't decided anything in step 1 yet: everything stays as today.")}</div>}
      {conserva.length > 0 && <div style={{ fontSize: 12, color: C.tx2, marginTop: 12, lineHeight: 1.5 }}>
        <b style={{ color: C.tx, fontWeight: 600 }}>{conserva.length === 1 ? tx("Se conserva tal como está: ", "Kept as it is: ") : tx(`Se conservan tal como están (${conserva.length}): `, `Kept as they are (${conserva.length}): `)}</b>{conserva.map((x) => x.nombre).join(" · ")}
      </div>}
    </div>);
}

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
