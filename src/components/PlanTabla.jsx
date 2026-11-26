// FINPATHIA · Mi futuro a 10 años · Tu plan en una pantalla.
// 26-nov-2026 (Santiago: "muevo como un ecualizador y todo se adapta"; "lo bueno de este modelo es que todo es muy
// visible y no tiene uno que pasar diligenciando datos"; "que ya sea la sección donde se arman los escenarios futuros").
// Una tabla con todo lo cargado, año por año. Se toca un año para vender, cambiar lo que paga o invertirle más dinero;
// la plata de una venta llega al capital disponible de ese año y ahí se reparte. No tiene cuentas propias: lee
// proyectarFuturo10 y cuentaPorAnio, y escribe el mismo `cfg` del escenario (decisiones, nuevas, reinversiones,
// pagarDeudas, gastosTerminan, ingresosTerminan, rentasAnio). Los pasos de antes siguen como «detalle».
import { useEffect, useMemo, useState } from "react";
import { mapaConexiones, cuentaDeActivo } from "../lib/conexiones.js";
import { tx, miles } from "../lib/region.js";
import { supuestosF10, nombreSup, retornoNominalPreset, leerPropiedadRaiz, indexacionDe, anioCal } from "../lib/futuro10.js";

const C = { bg: "var(--fp-card)", bg2: "var(--fp-raised)", bd: "rgba(var(--fp-ink),0.1)", bd2: "rgba(var(--fp-ink),0.2)", tx: "var(--fp-txt)", tx2: "var(--fp-txt2)", gn: "#00c805", rd: "#ff5000", am: "#f59e0b" };
const plata = (v) => (v < -0.5 ? "−" : "") + "$" + miles(Math.abs(Math.round(v)));
const BIENES = new Set(["inmueble", "vivienda", "vehiculo"]);
const leer = (s) => Number(String(s == null ? "" : s).replace(/\D/g, "")) || 0;
const conPuntos = (s) => { const d = String(s == null ? "" : s).replace(/\D/g, ""); return d ? miles(Number(d)) : ""; };
const pct = (v) => (v === "" || v == null ? undefined : parseFloat(String(v).replace(",", ".")));
const GRID = { display: "grid", gridTemplateColumns: "var(--f10-cols, 250px repeat(10, minmax(0, 1fr)))", gap: 6, alignItems: "center" };
const inp = { boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd2}`, borderRadius: 8, padding: "0 10px", height: 40, fontSize: 13, fontVariantNumeric: "tabular-nums" };
const btn1 = { background: C.gn, color: "#000", border: `1px solid ${C.gn}`, borderRadius: 8, padding: "0 18px", minHeight: 44, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btn2 = { background: "transparent", color: C.tx, border: `1px solid ${C.bd2}`, borderRadius: 8, padding: "0 14px", minHeight: 44, fontSize: 13, cursor: "pointer" };
const lnk = { background: "transparent", border: "none", color: C.tx2, textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: "8px 4px" };
const tarjeta = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: "18px 20px" };
const FORM0 = { tipo: "nueva", nombre: "", preset: "rfLargo", rend: "", recibe: "100", monto: "", activo: "", deuda: "", rentaNueva: "", retiro: "", ligaA: "", ligaI: "", prTipo: "simple", prValor: "", prCuota: "30", prLote: "", prM2: "", prCostoM2: "", prPlazo: "2", prMeses: "12", prValE: "20", prValA: "", prFinal: "queda", prVendeEn: "0", prRenta: "", prRepite: "no", prDestino: "reinvierte" };
const presetsLista = () => { const P = supuestosF10().presets; return ["rfCorto", "rfLargo", "fincaRaiz", "sp500"].filter((k) => P[k]).map((k) => [k, nombreSup(P[k])]).concat([["custom", tx("Otra: yo escribo cuánto rinde", "Other: I enter the return")]]); };
const prTipos = () => [["simple", tx("Comprar una propiedad ya hecha", "Buy a finished property")], ["planos", tx("Compra en planos", "Off-plan purchase")], ["lote", tx("Lote y construcción", "Lot and build")], ["asociativo", tx("Proyecto asociativo", "Joint development")], ["rentar", tx("Construir para rentar (locales, bodegas)", "Build to rent (shops, warehouses)")]];

/** Junta, fila por fila, lo que el motor da cada año: una fila por cosa, con su valor al mes en cada año. */
export function filasDelPlan(r) {
  const F = (r.filas || []).slice(1), N = F.length;
  // Cada fila se reconoce por su llave (no por su nombre: dos ingresos pueden llamarse igual).
  const junta = (lista) => { const m = new Map(); F.forEach((f, j) => (lista(f) || []).forEach((x) => { if (!m.has(x.id)) m.set(x.id, { id: x.id, key: x.key || null, nombre: x.nombre, v: Array(N).fill(0), val: Array(N).fill(0), cr: Array(N).fill(0) }); const o = m.get(x.id); o.v[j] += (x.m || 0) / 12; if (x.clase) o.clase = x.clase; if (x.valor != null) { o.val[j] = x.valor; o.cr[j] = x.crece || 0; } })); return [...m.values()]; };
  // 26-nov-2026 (Santiago: "solo agarró cesantías; ¿dónde quedó salario Sosa, salario Ana, honorarios?"). Los ingresos que marcaste como
  // «siguen llegando aunque dejes de trabajar» el motor los lleva con las rentas (rentasSueltas). Aquí van todos juntos en «Ingresos»:
  // los de trabajo y los que no vienen de una inversión. En «Tus inversiones» queda solo lo que paga cada inversión.
  const ing = junta((f) => (f.ingresosLab || []).map((x) => ({ id: "ing_" + (x.key || x.nombre), key: x.key, nombre: x.nombre, m: x.anual }))
    .concat((f.rentasSueltas || []).map((x) => ({ id: x.id, key: String(x.id).startsWith("ing_") ? String(x.id).slice(4) : null, nombre: x.nombre, m: x.renta }))));
  const act = junta((f) => (f.porActivo || []).map((x) => ({ id: x.id, nombre: x.nombre, clase: x.clase, m: x.renta, valor: x.valor, crece: x.crece })));
  const gas = junta((f) => (f.gastosItems || []).filter((g) => !g.seFue).map((x) => ({ id: "gas_" + (x.key || x.nombre), key: x.key, nombre: x.nombre, m: x.anual }))
    .concat((f.gastosFut || []).map((x) => ({ id: "gfut_" + (x.idx != null ? x.idx : x.nombre) + "_" + x.nombre, nombre: x.nombre, m: x.anual }))));
  const deu = junta((f) => (f.cuotasItems || []).map((x) => ({ id: "deu_" + x.nombre, nombre: x.nombre, m: x.anual })));
  (r.activos || []).forEach((a) => { if (!act.some((x) => x.id === a.id)) act.push({ id: a.id, nombre: a.nombre, v: Array(N).fill(0), val: Array(N).fill(0), cr: Array(N).fill(0) }); });
  const hoy = (r.activos || []).map((a) => a.id);
  const orden = (x) => { const i = hoy.indexOf(x.id); return i >= 0 ? i : String(x.id).startsWith("nueva_") ? 100 + Number(String(x.id).slice(6)) : String(x.id).startsWith("c_") ? 900 : 500; };
  act.sort((a, b) => orden(a) - orden(b));
  return { N, ing, act, gas, deu, entra: F.map((f) => f.ingresos / 12), sale: F.map((f) => f.gastos / 12), queda: F.map((f) => f.cf / 12), pat: F.map((f) => f.patrimonio), deuda: F.map((f) => f.deuda || 0), activos: F.map((f) => f.activos || 0), deflFin: F.map((f) => f.deflactor || 1) };
}

/** La propiedad raíz del formulario, en lo que entiende el motor (plata en pesos de hoy). */
export function armarPropiedadRaiz(f, anio, fac = 1) {
  const pr = { tipo: f.prTipo, plazo: Number(f.prPlazo) || 0, valEntregaPct: pct(f.prValE) || 0, rentaMensual: leer(f.prRenta) / fac, final: f.prTipo === "asociativo" ? "vende" : f.prFinal, vendeEn: Number(f.prVendeEn) || 0, repite: f.prRepite === "si", destino: f.prDestino, ventaModo: "pct" };
  if (pct(f.prValA) !== undefined) pr.valAnualPct = pct(f.prValA);
  if (f.prTipo === "planos") { pr.valor = leer(f.prValor) / fac; pr.cuotaPct = pct(f.prCuota) || 0; }
  else if (f.prTipo === "asociativo") { pr.valor = leer(f.prValor) / fac; pr.meses = Number(f.prMeses) || 12; }
  else { pr.lote = leer(f.prLote) / fac; pr.m2 = leer(f.prM2); pr.costoM2 = leer(f.prCostoM2) / fac; }
  return { nombre: String(f.nombre || "").trim(), preset: "fincaRaiz", anio, fuente: "venta", pr };
}

function Celda({ v, sel, caja, fuerte, res, alto = 40, tag, tagColor = C.gn, onClick, aria, vale = 0 }) {
  const hay = Math.abs(v) > 0.5, soloVale = !hay && vale > 0.5 && !tag, st = { height: alto, boxSizing: "border-box", borderRadius: 6, fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.25, width: "100%", padding: 0, fontFamily: "inherit", fontVariantNumeric: "tabular-nums", fontWeight: fuerte || res ? 600 : 400,
    color: res ? (v >= 0 ? C.gn : C.rd) : hay ? C.tx : C.tx2, background: res ? (v >= 0 ? "rgba(0,200,5,0.12)" : "rgba(255,80,0,0.14)") : sel ? "rgba(var(--fp-ink),0.07)" : caja ? "rgba(var(--fp-ink),0.03)" : "transparent",
    border: `1px solid ${res ? (v >= 0 ? "rgba(0,200,5,0.45)" : "rgba(255,80,0,0.6)") : tag ? tagColor : caja ? C.bd : "transparent"}`, cursor: onClick ? "pointer" : "default" };
  const dentro = soloVale ? <><span style={{ fontSize: 10, color: C.tx2 }}>{tx("Vale", "Worth")}</span><span style={{ color: C.tx2 }}>{plata(vale)}</span></>
    : <>{tag ? <span style={{ fontSize: 10, fontWeight: 700, color: tagColor }}>{tag}</span> : null}<span>{hay ? plata(v) : "—"}</span></>;
  return onClick ? <button type="button" onClick={onClick} aria-label={aria} style={st}>{dentro}</button> : <div style={st}>{dentro}</div>;
}
function Fila({ nombre, sub, celdas, hijo, fuerte, grande, linea, pill }) {
  return <div style={{ ...GRID, ...(linea ? { borderTop: `1px solid ${C.bd2}`, paddingTop: 8, marginTop: 4 } : {}) }}>
    <div style={{ paddingLeft: hijo ? 14 : 0, paddingRight: 8, fontSize: grande ? 16 : 14, fontWeight: fuerte ? 600 : 400, color: C.tx, ...(pill ? { borderLeft: `3px solid ${C.am}`, background: "rgba(245,158,11,0.08)", borderRadius: 6, paddingTop: 6, paddingBottom: 6 } : {}) }}>
      <div>{nombre}{pill ? <span style={{ fontSize: 11, fontWeight: 700, color: "#000", background: C.am, borderRadius: 999, padding: "2px 8px", marginLeft: 6 }}>{pill}</span> : null}</div>
      {sub ? <div style={{ fontSize: 12, color: C.tx2, fontWeight: 400, lineHeight: 1.4 }}>{sub}</div> : null}
    </div>{celdas}</div>;
}
function Bloque({ abierto, alternar, nombre, sub, totales, children }) {
  return <>
    <div style={{ ...GRID, borderTop: `1px solid ${C.bd}`, paddingTop: 4 }}>
      <button type="button" onClick={alternar} aria-expanded={!!abierto} style={{ background: "none", border: "none", color: C.tx, textAlign: "left", padding: 0, minHeight: 44, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{abierto ? "▾ " : "▸ "}{nombre}</span><span style={{ fontSize: 12, color: C.tx2 }}>{sub}</span></button>
      {totales}</div>
    {abierto ? children : null}</>;
}
const Op = ({ letra, titulo, txt, children }) => <div style={{ flex: "1 1 250px", minWidth: 0, border: `1px solid ${C.bd2}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8, background: C.bg }}>
  <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{letra} · {titulo}</div><div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.5, flex: 1 }}>{txt}</div>{children}</div>;
const Campo = ({ etiqueta, children }) => <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.tx2 }}>{etiqueta}{children}</label>;
const Sel = ({ value, on, ops, id }) => <select id={id} value={value} onChange={(e) => on(e.target.value)} style={inp}>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
const Txt = ({ value, on, ph, w = 150, plataIn, id }) => <input id={id} type="text" inputMode={plataIn ? "numeric" : "decimal"} value={value} placeholder={ph} onChange={(e) => on(plataIn ? conPuntos(e.target.value) : e.target.value)} style={{ ...inp, width: w, textAlign: plataIn ? "right" : "left" }} />;

export default function PlanTabla({ user = {}, cfg = {}, setCfg, r, cuenta = [], demo = false, onVerPasos, onDatos, onIrPatrimonio }) {
  const M = useMemo(() => filasDelPlan(r), [r]);
  const N = M.N, AN = useMemo(() => Array.from({ length: N }, (_, j) => anioCal(j + 1)), [N]);
  const [sel, setSel] = useState(0);
  const [abre, setAbre] = useState({ ing: false, inv: true, rei: true, bie: true, gas: false, deu: false, val: false });
  const [act, setAct] = useState(null); // { id, j }: la inversión y el año que se están cambiando
  const [f, setF] = useState(FORM0);
  const [aviso, setAviso] = useState(null); // { ok, txt }
  const up = (cambio) => setF((p) => ({ ...p, ...cambio }));
  // 26-nov-2026 (Santiago: "estoy en el cel"; en su captura la tabla mostraba un solo año con las cifras cortadas). En pantallas
  // angostas la tabla muestra un año a la vez: el nombre y la cifra del año elegido. Los años se cambian con los botones de arriba.
  const [movil, setMovil] = useState(false);
  useEffect(() => { const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 760px)") : null; if (!mq) return undefined;
    const ver = () => setMovil(mq.matches); ver(); mq.addEventListener?.("change", ver); return () => mq.removeEventListener?.("change", ver); }, []);
  const soloSel = (lista) => (movil ? lista.filter((_, j) => j === sel) : lista);
  const cajaTabla = movil ? { "--f10-cols": "minmax(0, 1fr) 132px", display: "flex", flexDirection: "column", gap: 6 } : { minWidth: 1320, display: "flex", flexDirection: "column", gap: 6 };
  // 26-nov-2026 (Santiago: "uno debería poder en cualquier momento o sección actualizar la ficha de cada inversión"; District salía
  // en dos renglones porque su ingreso estaba suelto). Desde la tabla se liga un ingreso a su inversión. Esto sí cambia los datos.
  const [fic, setFic] = useState(null); // { tipo: "ing" | "inv", id }
  const [hecho, setHecho] = useState("");
  const ingL = user.ingresos || [], invL = (user.inv || []).filter((a) => a && a.id), puedeDatos = !!onDatos && !demo && invL.length > 0;
  // Qué está conectado a qué (ingresos, gastos y deudas de cada inversión) y qué está suelto por error.
  const mapa = useMemo(() => mapaConexiones(user, cfg), [user, cfg]);
  const nomInv = (id) => mapa.nombreActivo(id) || tx("tu inversión", "your investment");
  const TIPO = { ingreso: tx("Ingreso", "Income"), gasto: tx("Gasto", "Expense"), deuda: tx("Deuda", "Debt") };
  // Conecta o desconecta (activoId "") un ingreso, un gasto o una deuda. Cambia los datos de todas las páginas.
  const conectar = (tipo, it, activoId) => { if (!onDatos || !it) return;
    if (tipo === "ingreso") onDatos("ingresos", ingL.map((q, j) => (j === it.k ? { ...q, activoId: activoId || "" } : q)));
    else if (tipo === "gasto") { const todo = user.gastos || user.gas || {}; onDatos(user.gastos ? "gastos" : "gas", { ...todo, [it.cat]: (todo[it.cat] || []).map((g, j) => (j === it.idx ? { ...g, activoId: activoId || "" } : g)) }); }
    else onDatos("deu", (user.deu || []).map((d, j) => (j === it.k ? { ...d, la: activoId || "", link: undefined } : d)));
    up({ ligaA: "", ligaI: "" });
    setHecho(activoId ? tx(`Listo: «${it.nombre}» quedó conectado a ${nomInv(activoId)}, en tus datos de todas las páginas.`, `Done: "${it.nombre}" is now connected to ${nomInv(activoId)}, in your data on every page.`) : tx(`Listo: «${it.nombre}» ya no está conectado a una inversión.`, `Done: "${it.nombre}" is no longer connected to an investment.`)); };
  const avisoDatos = <div style={{ fontSize: 12, color: C.am }}>{tx("Esto cambia tus datos en todas las páginas, no solo este escenario.", "This changes your data on every page, not just this scenario.")}</div>;
  const cajaFic = { margin: "0 0 8px 14px", maxWidth: 760, border: `1px solid ${C.am}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, background: "rgba(245,158,11,0.05)" };
  const cabFic = (titulo) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 600, color: C.tx }}>{titulo}</div><button type="button" style={lnk} onClick={() => setFic(null)}>{tx("Cerrar", "Close")}</button></div>;
  const lin = (a, b, o = {}) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: 13, color: o.fuerte ? C.tx : C.tx2, fontWeight: o.fuerte ? 600 : 400, fontVariantNumeric: "tabular-nums", ...(o.linea ? { borderTop: `1px solid ${C.bd2}`, paddingTop: 8 } : {}) }}><span>{a}</span><span style={{ color: o.color || C.tx, whiteSpace: "nowrap" }}>{b}</span></div>;
  const abreFic = (tipo, id) => setFic(fic && fic.tipo === tipo && fic.id === id ? null : { tipo, id });
  // El nombre de un renglón abre su ficha; debajo, una sola línea dice a qué está conectado (o que está suelto por revisar).
  const nombreFic = (nombre, tipo, id) => (puedeDatos ? <button type="button" aria-label={`${tx("Abrir la ficha de", "Open the record of")} ${nombre}`} onClick={() => abreFic(tipo, id)} style={{ background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}>{nombre}</button> : nombre);
  const marca = (it, tipo, id) => (!it || !puedeDatos ? null : it.estado === "revisar" ? <> · <button type="button" style={{ ...lnk, padding: "4px 2px", fontSize: 12, color: C.am }} onClick={() => abreFic(tipo, id)}>{tipo === "deuda" ? tx("Suelta: ¿de qué inversión es?", "Loose: which investment is it for?") : tipo === "gasto" ? tx("Suelto: ¿de qué inversión es?", "Loose: which investment is it for?") : tx("Suelto: ¿de qué inversión sale?", "Loose: which investment is it from?")}</button></> : it.estado === "conectado" ? ` · ${tipo === "deuda" ? tx("Conectada a", "Connected to") : tx("Conectado a", "Connected to")} ${nomInv(it.activoId)}` : null);
  // Ficha de un ingreso, un gasto o una deuda: a qué inversión pertenece.
  function fichaItem(tipo, it) {
    const a = invL.some((q) => q.id === f.ligaA) ? f.ligaA : "";
    return <div style={cajaFic}>
      {cabFic(`${TIPO[tipo]}: ${it.nombre}`)}
      {it.activoId ? <>{lin(tipo === "deuda" ? tx("Conectada a", "Connected to") : tx("Conectado a", "Connected to"), nomInv(it.activoId), { fuerte: true })}
          {tipo === "ingreso" && it.desdePatrimonio ? <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Nació en la ficha de esa inversión: se cambia en Patrimonio.", "Created on that investment's record: edit it in Net worth.")}</div> : <div><button type="button" style={lnk} onClick={() => { conectar(tipo, it, ""); setFic(null); }}>{tx("Desconectar", "Disconnect")}</button></div>}</>
        : <>
          <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.5 }}>{it.estado === "revisar" ? (tipo === "ingreso" ? tx("Parece el arriendo o la renta de una inversión tuya y hoy está suelto. Conéctalo: queda en el renglón de esa inversión y, si la vendes, se va con ella.", "It looks like the rent or income of an investment of yours and it is loose today. Connect it: it moves to that investment's row and, if you sell it, it goes with it.") : tipo === "gasto" ? tx("Parece un gasto de una inversión tuya y hoy está suelto. Conéctalo: se descuenta de lo que esa inversión te deja y, si la vendes, se va con ella.", "It looks like a cost of an investment of yours and it is loose today. Connect it: it is deducted from what that investment leaves you and, if you sell it, it goes with it.") : tx("Parece la deuda de una inversión tuya y hoy está suelta. Conéctala: si vendes esa inversión, la deuda se paga con la venta.", "It looks like the debt of an investment of yours and it is loose today. Connect it: if you sell that investment, the debt is paid with the sale."))
            : tx("No está conectado a ninguna inversión, y puede estar bien así: un salario, el mercado o una tarjeta no salen de una inversión.", "It is not connected to any investment, and that may be fine: a salary, groceries or a credit card do not come from an investment.")}</div>
          {it.sugiere ? <div><button type="button" style={btn1} onClick={() => { conectar(tipo, it, it.sugiere); setFic(null); }}>{tx(`Conectar a ${nomInv(it.sugiere)}`, `Connect to ${nomInv(it.sugiere)}`)}</button></div> : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <Campo etiqueta={it.sugiere ? tx("O conéctalo a otra inversión", "Or connect it to another investment") : tx("Conéctalo a esta inversión", "Connect it to this investment")}><Sel id="f10-liga-activo" value={a} on={(v) => up({ ligaA: v })} ops={[["", tx("Escoge la inversión…", "Pick the investment…")], ...invL.map((q) => [q.id, q.n || q.nombre || q.id])]} /></Campo>
            <button type="button" style={{ ...(it.sugiere ? btn2 : btn1), opacity: a ? 1 : 0.5 }} disabled={!a} onClick={() => { if (a) { conectar(tipo, it, a); setFic(null); } }}>{tx("Conectar", "Connect")}</button></div></>}
      {avisoDatos}</div>;
  }
  // Ficha de una inversión: lo que tiene conectado y la cuenta de lo que te deja al mes.
  function fichaInversion(x) {
    const c = cuentaDeActivo(mapa, x.id, valorHoy(x.id));
    const sueltos = [...mapa.ingresos.map((q) => ["ingreso", q]), ...mapa.gastos.map((q) => ["gasto", q]), ...mapa.deudas.map((q) => ["deuda", q])].filter(([t, q]) => !q.activoId && q.estado === "revisar" && q.sugiere !== x.id);
    const el = sueltos.some(([t, q]) => `${t}:${q.key || q.k}` === f.ligaI) ? f.ligaI : "", fila = (tipo, q, signo, monto) => <div key={tipo + (q.key || q.k)} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color: C.tx2 }}>{signo} {tipo === "deuda" ? tx("Cuota", "Payment") : TIPO[tipo]}: {q.nombre} {tipo === "ingreso" && q.desdePatrimonio ? null : <button type="button" style={{ ...lnk, fontSize: 12, padding: "4px 2px" }} aria-label={`${tx("Desconectar", "Disconnect")} ${q.nombre}`} onClick={() => conectar(tipo, q, "")}>{tx("Desconectar", "Disconnect")}</button>}</span><span style={{ color: C.tx, whiteSpace: "nowrap" }}>{plata(monto)}</span></div>;
    return <div style={cajaFic} id="f10-ficha">
      {cabFic(tx(`Ficha de ${x.nombre}: lo que tiene conectado`, `${x.nombre}: what is connected to it`))}
      {lin(tx("Vale hoy", "Worth today"), plata(c.valor), { fuerte: true })}
      {c.conexiones ? <>
        <div style={{ fontSize: 12, color: C.tx2 }}>{tx("Al mes, con las cifras de hoy:", "Per month, at today's figures:")}</div>
        {c.ingresos.map((q) => fila("ingreso", q, "+", q.mensual))}{c.gastos.map((q) => fila("gasto", q, "−", q.mensual))}{c.deudas.map((q) => fila("deuda", q, "−", q.cuota))}
        {lin(tx("= Te deja al mes", "= Leaves you per month"), plata(c.deja), { fuerte: true, linea: true, color: c.deja >= 0 ? C.gn : C.rd })}
        {c.deudas.length ? <>{lin(tx("Debes de ella hoy", "You owe on it today"), plata(c.debes))}{lin(tx("= Es tuyo hoy", "= Yours today"), plata(c.tuyo), { fuerte: true })}</> : null}</>
        : <div style={{ fontSize: 13, color: C.tx2 }}>{tx("Hoy no tiene ningún ingreso, gasto ni deuda conectados. Si no te paga nada ni te cuesta nada, está bien así.", "It has no income, expense or debt connected today. If it pays and costs you nothing, that is fine.")}</div>}
      {c.sugeridos.length ? <div style={{ border: `1px solid ${C.am}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: C.am }}>{c.sugeridos.length === 1 ? tx("Hay 1 suelto que parece de aquí", "1 loose item looks like it belongs here") : tx(`Hay ${c.sugeridos.length} sueltos que parecen de aquí`, `${c.sugeridos.length} loose items look like they belong here`)}</div>
        {c.sugeridos.map((q) => <div key={q.tipo + (q.key || q.k)} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: 13, color: C.tx }}><span>{TIPO[q.tipo]}: {q.nombre} · {plata(q.tipo === "deuda" ? q.cuota : q.mensual)} {tx("al mes", "a month")}</span>
          <button type="button" style={{ ...btn1, minHeight: 44 }} aria-label={`${tx("Conectar", "Connect")} ${q.nombre}`} onClick={() => conectar(q.tipo, q, x.id)}>{tx("Conectar", "Connect")}</button></div>)}</div> : null}
      {sueltos.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <Campo etiqueta={tx("Conectarle otro que hoy está suelto", "Connect another loose item")}><Sel id="f10-liga-ingreso" value={el} on={(v) => up({ ligaI: v })} ops={[["", tx("Escoge…", "Pick…")], ...sueltos.map(([t, q]) => [`${t}:${q.key || q.k}`, `${TIPO[t]}: ${q.nombre}`])]} /></Campo>
        <button type="button" style={{ ...btn2, opacity: el ? 1 : 0.5 }} disabled={!el} onClick={() => { const s0 = sueltos.find(([t, q]) => `${t}:${q.key || q.k}` === el); if (s0) conectar(s0[0], s0[1], x.id); }}>{tx("Conectar", "Connect")}</button></div> : null}
      {onIrPatrimonio ? <div style={{ fontSize: 13, color: C.tx2 }}>{tx("Para cambiar cuánto vale o qué tipo de inversión es:", "To change its value or its type:")} <button type="button" style={lnk} onClick={onIrPatrimonio}>{tx("Abrir su ficha completa en Patrimonio", "Open its full record in Net worth")}</button></div> : null}
      {avisoDatos}</div>;
  }
  const pon = (cambio) => { setCfg((p) => ({ ...p, ...(typeof cambio === "function" ? cambio(p) : cambio) })); };
  const irA = (id) => setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 60);
  const elegirAnio = (j) => { setSel(j); up({ monto: "" }); setAviso(null); };

  const t = sel + 1, g = cuenta[sel] || {}, fac = g.factorHoy || 1, y = AN[sel];
  const dec = cfg.decisiones || {}, nuevas = cfg.nuevas || [], reinv = cfg.reinversiones || [], pagar = cfg.pagarDeudas || {}, tramos = cfg.rentasAnio || {}, retiros = cfg.retirosActivos || {};
  const sonReinv = useMemo(() => new Set(r.reinvierten || []), [r]);
  const idx = indexacionDe(cfg) / 100, ixA = (j) => Math.pow(1 + idx, j);
  const ventaDe = (id) => { const d = dec[id]; return d ? (d.accion === "vende" ? 1 : d.accion === "termina" ? Math.round(Number(d.desde)) || 0 : 0) : 0; };
  const deHoy = useMemo(() => new Set((r.activos || []).map((a) => a.id)), [r]);
  const valorHoy = (id) => { const a = (user.inv || []).find((x) => x && x.id === id); return a ? Number(a.va) * (String(a.moneda || "").toUpperCase() === "USD" ? Number(user.trm) || 4200 : 1) : 0; };

  const quitarNueva = (k) => pon((p) => ({ nuevas: (p.nuevas || []).filter((q, i) => i !== k), reinversiones: (p.reinversiones || []).filter((q) => q.activoId !== "nueva_" + k).map((q) => { const mm = /^nueva_(\d+)$/.exec(q.activoId || ""); return mm && Number(mm[1]) > k ? { ...q, activoId: "nueva_" + (Number(mm[1]) - 1) } : q; }) }));
  // ── Paso 2: el capital disponible del año elegido ──
  const usable = (g.tienes || 0) - (g.comprometido || 0) - (g.faltaMes || 0), porUsar = g.porInvertir || 0;
  const movidas = [];
  nuevas.forEach((x, k) => { if (!x || x.preset === "_fuera" || (Math.round(Number(x.anio)) || 1) !== t) return;
    const m = (g.movidas || []).find((q) => q.ref === "n" + k) || (g.compromisos || []).find((q) => q.ref === "n" + k);
    movidas.push({ k: "n" + k, txt: `${tx("Inversión nueva", "New investment")}: ${x.nombre || nombreSup(supuestosF10().presets[x.preset] || {}) || tx("Inversión", "Investment")}`, monto: m ? m.monto : (Number(x.monto) || 0) * fac,
      quitar: () => quitarNueva(k) }); });
  reinv.forEach((x, k) => { if (!x || (Math.round(Number(x.anio)) || 1) !== t) return; const a = M.act.find((q) => q.id === x.activoId);
    movidas.push({ k: "r" + k, txt: `${tx("Le inviertes más dinero a", "You invest more in")} ${a ? a.nombre : tx("una inversión", "an investment")}`, monto: (Number(x.monto) || 0) * fac, quitar: () => pon((p) => ({ reinversiones: (p.reinversiones || []).filter((q, i) => i !== k) })) }); });
  const hayCapital = usable > 1 || movidas.length > 0 || (g.compromisos || []).length > 0;
  const montoTxt = f.tipo !== "deuda" && f.monto === "" && porUsar > 1 ? miles(Math.floor(porUsar)) : f.monto;
  const esPR = f.tipo === "nueva" && f.preset === "fincaRaiz" && f.prTipo !== "simple";
  const vivos = M.act.filter((x) => !String(x.id).startsWith("c_") && (x.val[sel] > 0.5) && !(ventaDe(x.id) && ventaDe(x.id) <= t));
  const deudasVivas = (r.deudas || []).filter((d) => !pagar[d.id] && !d.porVenta && !d.ventaAnio && !(d.finAnio && d.finAnio <= t) && d.saldo > 0.5);
  const rendDef = f.preset === "custom" ? "" : (Math.round(retornoNominalPreset(f.preset, r.escenario) * 10) / 10).toLocaleString("es-CO");
  const quitaDeuda = (nombre) => { const d = (r.deudas || []).find((q) => pagar[q.id] === y && String(nombre).indexOf(q.nombre) >= 0); return d ? () => pon((p) => { const o = { ...(p.pagarDeudas || {}) }; delete o[d.id]; return { pagarDeudas: o }; }) : null; };

  const previa = () => {
    if (f.tipo !== "nueva") return "";
    if (esPR) { const p = leerPropiedadRaiz(armarPropiedadRaiz(f, t, fac), N);
      if (p.vacio) return tx("Escribe los valores de arriba para ver la cuenta.", "Fill in the values above to see the math.");
      if (p.final === "vende") return tx(`Pones ${plata(p.capital * fac)} en ${y}. Lo vendes en unos ${p.durAnios} ${p.durAnios === 1 ? "año" : "años"} por ${plata(p.ventaBruta * fac)}. Ganas ${plata(p.gananciaAntes * fac)} antes de impuestos y te queda de ganancia ${plata(p.gananciaCiclo * fac)} (impuesto estimado ${plata(p.impuestoCiclo * fac)}). ${p.repite ? `Se repite ${p.veces} ${p.veces === 1 ? "vez" : "veces"} hasta el final del plan. ` : ""}${f.prDestino === "flujo" ? "La ganancia te llega a tu mes." : "La ganancia se reinvierte."}`,
        `You put in ${plata(p.capital * fac)} in ${y}. You sell in about ${p.durAnios} ${p.durAnios === 1 ? "year" : "years"} for ${plata(p.ventaBruta * fac)}. You make ${plata(p.gananciaAntes * fac)} before taxes and keep ${plata(p.gananciaCiclo * fac)} (estimated tax ${plata(p.impuestoCiclo * fac)}). ${p.repite ? `It repeats ${p.veces} ${p.veces === 1 ? "time" : "times"} until the end of the plan. ` : ""}${f.prDestino === "flujo" ? "The profit goes to your monthly income." : "The profit is reinvested."}`);
      const pagos = (p.pagos || []).map((q) => `${plata(q.monto * fac)} ${tx("en", "in")} ${y + q.anio - p.anio}`).join(tx(" y ", " and "));
      return tx(`Pagas ${pagos}. Te la entregan en ${y + p.entrega - p.anio} y ahí vale ${plata(p.valorEntrega * fac)}. ${p.renta > 0.5 ? `Desde la entrega te paga ${plata(p.renta * fac)} al mes.` : "No le pusiste renta."}`, `You pay ${pagos}. It's delivered in ${y + p.entrega - p.anio}, worth ${plata(p.valorEntrega * fac)} then. ${p.renta > 0.5 ? `From delivery it pays you ${plata(p.renta * fac)} a month.` : "No rent entered."}`); }
    const m = leer(montoTxt), rd = pct(f.rend !== "" ? f.rend : rendDef), pr = Number(f.recibe) / 100;
    if (!(m > 0)) return tx("Escribe cuánto vas a poner.", "Enter how much you'll put in.");
    if (!Number.isFinite(rd)) return tx("Escribe cuánto rinde al año.", "Enter the yearly return.");
    const anual = m * rd / 100, rdTxt = String(rd).replace(".", ",");
    return pr > 0 ? tx(`${plata(m)} al ${rdTxt} % al año rinden ${plata(anual)} al año. De eso te llegan ${plata(anual * pr)} al año, que son ${plata(anual * pr / 12)} al mes. La tabla muestra la cifra al mes.`, `${plata(m)} at ${rd}% a year earn ${plata(anual)} a year. You receive ${plata(anual * pr)} a year, which is ${plata(anual * pr / 12)} a month. The table shows the monthly figure.`)
      : tx(`${plata(m)} al ${rdTxt} % al año rinden ${plata(anual)} al año. No te llega nada al mes: todo se reinvierte.`, `${plata(m)} at ${rd}% a year earn ${plata(anual)} a year. Nothing reaches you monthly: it's all reinvested.`);
  };
  const error = (txt) => setAviso({ ok: false, txt });
  const agregar = () => {
    if (f.tipo === "deuda") { const id = f.deuda || (deudasVivas[0] || {}).id; if (!id) return error(tx(`No hay deudas por pagar en ${y}.`, `No debts to pay in ${y}.`)); pon((p) => ({ pagarDeudas: { ...(p.pagarDeudas || {}), [id]: y } })); up({ deuda: "" }); return setAviso({ ok: true, txt: tx(`Listo: pagas esa deuda en ${y} y su cuota deja de salir.`, `Done: you pay off that debt in ${y} and its installment stops.`) }); }
    if (esPR) { const xp = armarPropiedadRaiz(f, t, fac), pp = leerPropiedadRaiz(xp, N); if (pp.vacio) return error(tx("Escribe lo que cuesta para poder crearla.", "Enter what it costs to create it."));
      if (!xp.nombre) xp.nombre = pp.nombre; pon((p) => ({ nuevas: [...(p.nuevas || []), xp] })); setAbre((a) => ({ ...a, inv: true })); up({ nombre: "", prValor: "", prLote: "", prM2: "", prCostoM2: "", prRenta: "" });
      return setAviso({ ok: true, txt: tx(`Listo: creaste «${xp.nombre}» en ${y}. Ya está en la tabla, marcada en amarillo.`, `Done: you created "${xp.nombre}" in ${y}. It's in the table, highlighted in yellow.`) }); }
    const m = leer(montoTxt);
    if (!(m > 0)) return error(tx("Escribe cuánto vas a poner, o toca «Usar todo lo que queda».", "Enter how much, or tap \"Use all that's left\"."));
    if (f.tipo === "suma") { const id = f.activo || (vivos[0] || {}).id; if (!id) return error(tx(`No hay inversiones para invertirles más en ${y}.`, `No investments to add to in ${y}.`));
      pon((p) => ({ reinversiones: [...(p.reinversiones || []), { activoId: id, monto: m / fac, anio: t, fuente: "venta" }] })); up({ monto: "" });
      return setAviso({ ok: true, txt: tx(`Listo: le invertiste ${plata(m)} más a esa inversión en ${y}.`, `Done: you invested ${plata(m)} more in that investment in ${y}.`) }); }
    const nombre = f.nombre.trim() || (f.preset === "custom" ? tx("Inversión nueva", "New investment") : (presetsLista().find((q) => q[0] === f.preset) || [])[1]);
    const x = { nombre, preset: f.preset, monto: m / fac, anio: t, fuente: "venta", pctRecibe: Number(f.recibe) };
    const rd = pct(f.rend); if (Number.isFinite(rd)) x.rendimientoNomPct = rd; else if (f.preset === "custom") return error(tx("Escribe cuánto esperas que rinda al año.", "Enter the yearly return you expect."));
    pon((p) => ({ nuevas: [...(p.nuevas || []), x] })); setAbre((a) => ({ ...a, inv: true })); up({ nombre: "", monto: "", rend: "" });
    setAviso({ ok: true, txt: tx(`Listo: creaste «${nombre}» en ${y} con ${plata(m)}. Ya tiene su fila en «Tus inversiones», marcada en amarillo como «Nueva»${x.pctRecibe > 0 ? ", y lo que te paga ya suma en «Te entra al mes»." : ". Como elegiste que no te llegue nada al mes, crece pero no cambia lo que te entra."}`, `Done: you created "${nombre}" in ${y} with ${plata(m)}. It has its own row under "Your investments", highlighted as "New"${x.pctRecibe > 0 ? ", and what it pays already adds to your monthly income." : ". Since nothing reaches you monthly, it grows but doesn't change your income."}`) });
  };

  // ── Paso 1: las filas ──
  const cels = (vals, o = {}) => soloSel(vals.map((v, j) => <Celda key={j} v={v} sel={j === sel} {...o} {...(o.cada ? o.cada(v, j) : {})} />));
  const suma = (rows) => AN.map((_, j) => rows.reduce((s, x) => s + x.v[j], 0));
  const filaTermina = (x, campo, etq) => { const key = x.key, fin = key ? (cfg[campo] || {})[key] : null;
    const tipoF = campo === "ingresosTerminan" ? "ingreso" : "gasto", itF = key ? (tipoF === "ingreso" ? mapa.ingresos : mapa.gastos).find((q) => q.key === key) : null, abiertaI = !!itF && puedeDatos && fic && fic.tipo === tipoF && fic.id === x.id;
    const txtSub = !key ? tx("Empieza más adelante", "Starts later") : fin ? `${etq} ${AN[fin - 1]}` : tx("Toca un año para terminarlo", "Tap a year to end it");
    return <div key={x.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}><Fila hijo nombre={itF ? nombreFic(x.nombre, tipoF, x.id) : x.nombre} sub={<>{txtSub}{marca(itF, tipoF, x.id)}</>}
      celdas={cels(x.v, { caja: true, cada: (v, j) => ({ tag: fin === j + 1 ? tx("Termina", "Ends") : !key && j > 0 && v > 0.5 && x.v[j - 1] < 0.5 ? tx("Empieza", "Starts") : "", tagColor: C.rd, aria: `${tx("Terminar", "End")} ${x.nombre} ${tx("en", "in")} ${AN[j]}`,
        onClick: !key || j === 0 || demo ? undefined : () => pon((p) => { const o = { ...(p[campo] || {}) }; if (fin === j + 1) delete o[key]; else o[key] = j + 1; return { [campo]: o }; }) }) })} />{abiertaI ? fichaItem(tipoF, itF) : null}</div>; };

  const estadoInv = (id) => { const a = mapa.activos[id], p = [a.ingresos.length ? tx("ingreso", "income") : "", a.gastos.length ? tx("gasto", "expense") : "", a.deudas.length ? tx("deuda", "debt") : ""].filter(Boolean), n0 = a.ingresos.length + a.gastos.length + a.deudas.length;
    const con = n0 ? `${n0} ${n0 === 1 ? tx("conexión", "connection") : tx("conexiones", "connections")}: ${p.join(", ")}` : "";
    return a.sugeridos.length ? `${con ? con + " · " : ""}${a.sugeridos.length === 1 ? tx("hay 1 suelto que parece de aquí", "1 loose item looks like it belongs here") : tx(`hay ${a.sugeridos.length} sueltos que parecen de aquí`, `${a.sugeridos.length} loose items look like they belong here`)}` : con || tx("Sin conexiones · ver su ficha", "No connections · open its record"); };
  const filaInv = (x) => { const esHoy = deHoy.has(x.id), vt = ventaDe(x.id), kn = String(x.id).startsWith("nueva_") ? Number(String(x.id).slice(6)) : esHoy ? -1 : nuevas.findIndex((q) => q && q.pr && q.nombre === x.nombre);
    const nv = kn >= 0 ? nuevas[kn] : null, an = nv ? (Math.round(Number(nv.anio)) || 1) : 0, jp = x.v.findIndex((v) => v > 0.5), tr = tramos[x.id] || {}, trA = Object.keys(tr).map(Number).sort((a, b) => a - b), rt = retiros[x.id] || {}, rtA = Object.keys(rt).map(Number).filter((q) => Number(rt[q]) > 0.5).sort((a, b) => a - b), esRei = sonReinv.has(x.id);
    const seVende = nv && nv.pr && nv.pr.final === "vende", fin = plata(x.val[N - 1]);
    // 26-nov-2026 (Santiago: "Ledger, IBKR, Meteora rentan pero el dinero se reinvierte… aparecen las casillas vacías"). La que no paga
    // al mes muestra lo que vale cada año (así se ve crecer) y dice cuánto crece.
    const noPaga = jp < 0 && x.val.some((v) => v > 0.5), jc = x.val.findIndex((v, j) => j > 0 && v > 0.5 && x.val[j - 1] > 0.5), crecePct = jc > 0 && x.val[jc] - x.cr[jc] > 0.5 ? x.cr[jc] / (x.val[jc] - x.cr[jc]) * 100 : null;
    const esBien = BIENES.has(x.clase);
    const reinvierte = noPaga ? ` · ${esBien ? tx("no tiene un ingreso ligado", "no income linked to it") : tx("no te paga al mes: lo que rinde se reinvierte", "no monthly income: its return is reinvested")}${crecePct != null && Math.abs(crecePct) > 0.05 ? ` (${crecePct > 0 ? tx("crece", "grows") : tx("baja", "falls")} ${(Math.round(Math.abs(crecePct) * 10) / 10).toLocaleString("es-CO")} % ${tx("al año", "a year")})` : ""}` : "";
    const nota = esHoy ? `${tx("Vale hoy", "Worth today")} ${plata(valorHoy(x.id))}${vt ? ` · ${tx("la vendes al empezar", "you sell it at the start of")} ${AN[vt - 1]}` : ""}${trA.length ? ` · ${esRei ? tx("te paga al mes desde", "pays you monthly from") : tx("lo que paga cambia en", "its income changes in")} ${trA.map((q) => AN[q - 1]).join(", ")}` : ""}${rtA.length ? ` · ${tx("retiras una parte en", "you withdraw part in")} ${rtA.map((q) => AN[q - 1]).join(", ")}` : ""}${esRei && !noPaga ? ` · ${tx("lo que te paga sale de la inversión", "what it pays comes out of the investment")}` : ""}${reinvierte}${!vt && !trA.length && !noPaga && !esRei ? ` · ${tx("toca un año para venderla o cambiar lo que paga", "tap a year to sell it or change what it pays")}` : ""}`
      : an ? `${tx("Inversión nueva de", "New investment from")} ${AN[an - 1]}${seVende ? ` · ${tx("negocio que se vende", "a deal you sell")}` : jp >= 0 ? ` · ${tx("te paga", "pays you")} ${plata(x.v[jp] * 12)} ${tx("al año desde", "a year from")} ${AN[jp]}` : ` · ${tx("no paga al mes", "no monthly income")}`} · ${tx("vale", "worth")} ${fin} ${tx("al terminar", "at the end of")} ${AN[N - 1]}`
        : `${tx("Vale", "Worth")} ${fin} ${tx("al terminar", "at the end of")} ${AN[N - 1]}${reinvierte}`;
    const abierta = esHoy && act && act.id === x.id;
    return <div key={x.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Fila hijo nombre={esHoy && mapa.activos[x.id] ? nombreFic(x.nombre, "inv", x.id) : x.nombre} sub={esHoy && puedeDatos && mapa.activos[x.id] ? <>{nota} · <button type="button" style={{ ...lnk, padding: "4px 2px", fontSize: 12, color: mapa.activos[x.id].sugeridos.length ? C.am : C.tx2 }} onClick={() => abreFic("inv", x.id)}>{estadoInv(x.id)}</button></> : an && !demo ? <>{nota} <button type="button" style={{ ...lnk, padding: "4px 2px", fontSize: 12 }} aria-label={`${tx("Quitar", "Remove")} ${x.nombre}`} onClick={() => { quitarNueva(kn); setAviso({ ok: true, txt: tx(`Quitaste «${x.nombre}». Su plata vuelve a tu capital disponible de ${AN[an - 1]}.`, `You removed "${x.nombre}". Its money returns to your ${AN[an - 1]} available capital.`) }); }}>{tx("Quitar esta inversión", "Remove this investment")}</button></> : nota} pill={an ? `${tx("Nueva", "New")} · ${AN[an - 1]}` : ""}
        celdas={cels(x.v, { caja: true, cada: (v, j) => ({ vale: noPaga || esRei ? x.val[j] : 0, tag: esHoy && vt === j + 1 ? tx("Vendes", "Sold") : Number(rt[j + 1]) > 0.5 ? tx("Retiras", "Withdraw") : tr[j + 1] != null ? (esRei ? tx("Recibes", "Receive") : tx("Cambia", "Changes")) : an === j + 1 ? tx("Nueva", "New") : "", tagColor: (tr[j + 1] != null || Number(rt[j + 1]) > 0.5 || an === j + 1) && !(esHoy && vt === j + 1) ? C.am : C.gn, aria: esHoy ? `${tx("Abrir opciones de", "Open options for")} ${x.nombre} ${tx("en", "in")} ${AN[j]}` : undefined,
          onClick: !esHoy || demo ? undefined : () => { setAct(act && act.id === x.id && act.j === j ? null : { id: x.id, j }); up({ rentaNueva: tr[j + 1] != null ? miles(Math.round(tr[j + 1] * ixA(j))) : "", retiro: Number(rt[j + 1]) > 0.5 ? miles(Math.round(rt[j + 1] * ((cuenta[j] || {}).factorHoy || 1))) : "" }); } }) })} />
      {fic && fic.tipo === "inv" && fic.id === x.id && puedeDatos ? fichaInversion(x) : null}
      {abierta ? opciones({ x, j: act.j, vt, tr, rt, esRei }) : null}</div>; };

  function opciones({ x, j, vt, tr, rt = {}, esRei }) {
    const yy = AN[j], vendida = vt === j + 1, ya = vt && vt <= j + 1, cap = (cuenta[j] || {}).porInvertir || 0;
    const vender = () => { pon((p) => { const o = { ...(p.decisiones || {}) }; if (vendida) delete o[x.id]; else o[x.id] = j === 0 ? { accion: "vende" } : { accion: "termina", desde: j + 1 }; return { decisiones: o }; }); setAct(null);
      if (!vendida) { setSel(j); up({ monto: "", tipo: "nueva" }); setAviso({ ok: true, txt: tx(`Vendes ${x.nombre} en ${yy}. Aquí decides qué haces con esa plata.`, `You sell ${x.nombre} in ${yy}. Decide here what to do with that money.`) }); irA("f10-capital"); } };
    const tramo = (val) => { pon((p) => { const o = { ...(p.rentasAnio || {}) }, q = { ...(o[x.id] || {}) }; if (val == null) delete q[j + 1]; else q[j + 1] = val / ixA(j); o[x.id] = q; return { rentasAnio: o }; }); setAct(null); };
    // 26-nov-2026 (Santiago: "¿y si uno quiere disponer de esa renta en algún año o hacer un retiro?"). En una inversión que se
    // reinvierte: recibir plata de ella cada mes desde un año, o retirar una parte en un año. Las dos salen de la inversión.
    const facJ = (cuenta[j] || {}).factorHoy || 1, hayRet = Number(rt[j + 1]) > 0.5, rindeMes = (x.cr[j] || 0) / 12 + (x.v[j] || 0), valeJ = x.val[j] || 0;
    const retirar = (val) => { pon((p) => { const o = { ...(p.retirosActivos || {}) }, q = { ...(o[x.id] || {}) }; if (val == null) delete q[j + 1]; else q[j + 1] = val / facJ; o[x.id] = q; return { retirosActivos: o }; }); setAct(null);
      if (val != null) { setSel(j); up({ monto: "", tipo: "nueva" }); setAviso({ ok: true, txt: tx(`Retiras ${plata(val)} de ${x.nombre} en ${yy}. Aquí decides qué haces con esa plata.`, `You withdraw ${plata(val)} from ${x.nombre} in ${yy}. Decide here what to do with that money.`) }); irA("f10-capital"); } };
    const opB = esRei
      ? <Op letra="B" titulo={tx(`Recibir plata de ella cada mes`, `Get money from it every month`)} txt={ya ? tx("No aplica: ya está vendida ese año.", "N/A: it's already sold that year.") : tx(`Hoy lo que rinde se queda invertido. Escribe cuánto quieres recibir al mes desde ${yy}: entra a «Te queda al mes» y sale de la inversión, que crecerá más despacio. En ${yy} rinde cerca de ${plata(rindeMes)} al mes; si recibes más que eso, la inversión se va gastando.`, `Today its return stays invested. Enter how much you want monthly from ${yy}: it goes to "Left each month" and comes out of the investment, which will grow more slowly. In ${yy} it earns about ${plata(rindeMes)} a month; if you take more, the investment shrinks.`)}>
          {ya ? null : <><Campo etiqueta={tx(`Desde ${yy} recibes al mes`, `From ${yy} you receive monthly`)}><Txt id="f10-renta-nueva" value={f.rentaNueva} on={(v) => up({ rentaNueva: v })} ph={tx("Ej.: 5.000.000", "E.g. 5,000,000")} w="100%" plataIn /></Campo>
            <button type="button" style={{ ...btn1, width: "100%" }} onClick={() => { if (f.rentaNueva !== "") tramo(leer(f.rentaNueva)); }}>{tx(`Recibir desde ${yy}`, `Receive from ${yy}`)}</button>
            {tr[j + 1] != null ? <button type="button" style={lnk} onClick={() => tramo(null)}>{tx("Quitar este cambio", "Remove this change")}</button> : null}</>}</Op>
      : null;
    const opRet = esRei
      ? <Op letra="C" titulo={tx(`Retirar una parte en ${yy}`, `Withdraw part in ${yy}`)} txt={ya ? tx("No aplica: ya está vendida ese año.", "N/A: it's already sold that year.") : j === 0 ? tx(`Los retiros se planean desde ${AN[1]}. Toca ${AN[1]} o un año siguiente en esta misma fila.`, `Withdrawals are planned from ${AN[1]}. Tap ${AN[1]} or a later year on this row.`) : tx(`Sacas una sola vez, al empezar ${yy}. Esa plata queda como capital disponible de ${yy} y el resto sigue invertido. Al terminar ${yy} la inversión vale ${plata(valeJ)}.`, `A one-time withdrawal at the start of ${yy}. That money becomes ${yy}'s available capital and the rest stays invested. At the end of ${yy} the investment is worth ${plata(valeJ)}.`)}>
          {ya || j === 0 ? null : <><Campo etiqueta={tx(`Cuánto retiras en ${yy}`, `How much you withdraw in ${yy}`)}><Txt id="f10-retiro" value={f.retiro} on={(v) => up({ retiro: v })} ph={tx("Ej.: 200.000.000", "E.g. 200,000,000")} w="100%" plataIn /></Campo>
            <button type="button" style={{ ...btn1, width: "100%" }} onClick={() => { const m = leer(f.retiro); if (m > 0) retirar(m); }}>{tx(`Retirar en ${yy}`, `Withdraw in ${yy}`)}</button>
            {hayRet ? <button type="button" style={lnk} onClick={() => retirar(null)}>{tx("Quitar este retiro", "Remove this withdrawal")}</button> : null}</>}</Op>
      : null;
    return <div style={{ margin: "0 0 8px 14px", maxWidth: esRei ? 1400 : 1060, border: `1px solid ${C.am}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, background: "rgba(245,158,11,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 600, color: C.tx }}>{tx(`${x.nombre} en ${yy}: elige una de estas ${esRei ? "cuatro" : "tres"} opciones`, `${x.nombre} in ${yy}: pick one of these ${esRei ? "four" : "three"} options`)}</div><button type="button" style={lnk} onClick={() => setAct(null)}>{tx("Cerrar", "Close")}</button></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
        <Op letra="A" titulo={vendida ? tx(`Ya la vendes en ${yy}`, `Already sold in ${yy}`) : esRei ? tx("Venderla o liquidarla completa", "Sell or liquidate all of it") : tx("Venderla o liquidarla", "Sell or liquidate it")} txt={ya && !vendida ? tx(`Ya la vendiste antes de ${yy}.`, `You already sold it before ${yy}.`) : tx(`Deja de pagarte desde ${yy}. Lo que recibes por ella queda como capital disponible de ${yy}, para invertirla o pagar deudas.`, `It stops paying you from ${yy}. What you get for it becomes ${yy}'s available capital, to invest or pay debts.`)}>
          {ya && !vendida ? null : <button type="button" style={{ ...btn2, width: "100%" }} onClick={vender}>{vendida ? tx("Quitar la venta", "Undo the sale") : tx(`Venderla al empezar ${yy}`, `Sell at the start of ${yy}`)}</button>}</Op>
        {esRei ? <>{opB}{opRet}</> : <Op letra="B" titulo={tx("Cambiar lo que te paga", "Change what it pays you")} txt={ya ? tx("No aplica: ya está vendida ese año.", "N/A: it's already sold that year.") : tx(`Úsala si sube o baja el arriendo, o si la remodelas. En ${yy} te paga ${plata(x.v[j])} al mes. Escribe lo que te pagará desde ${yy}; después sube cada año como tus ingresos.`, `Use it if the rent goes up or down, or if you remodel. In ${yy} it pays ${plata(x.v[j])} a month. Enter what it will pay from ${yy}; then it rises yearly like your income.`)}>
          {ya ? null : <><Campo etiqueta={tx(`Desde ${yy} te pagará al mes`, `From ${yy} it will pay monthly`)}><Txt id="f10-renta-nueva" value={f.rentaNueva} on={(v) => up({ rentaNueva: v })} ph={tx("Ej.: 20.000.000", "E.g. 20,000,000")} w="100%" plataIn /></Campo>
            <button type="button" style={{ ...btn1, width: "100%" }} onClick={() => { if (f.rentaNueva !== "") tramo(leer(f.rentaNueva)); }}>{tx("Aplicar", "Apply")}</button>
            {tr[j + 1] != null ? <button type="button" style={lnk} onClick={() => tramo(null)}>{tx("Quitar este cambio", "Remove this change")}</button> : null}</>}</Op>}
        <Op letra={esRei ? "D" : "C"} titulo={tx("Invertirle más dinero", "Invest more money in it")} txt={ya ? tx("No aplica: ya está vendida ese año.", "N/A: it's already sold that year.") : cap > 1 ? tx(`Le inviertes más dinero con tu capital disponible de ${yy}. Tienes ${plata(cap)} por usar ese año.`, `You invest more using ${yy}'s available capital. You have ${plata(cap)} left to use that year.`) : tx(`Le inviertes más dinero con tu capital disponible de ${yy}. Ese año todavía no tienes capital por usar: aparece cuando vendes algo o te sobra plata.`, `You invest more using ${yy}'s available capital. You have none to use that year yet: it appears when you sell something or have money left over.`)}>
          {ya ? null : <button type="button" style={{ ...btn2, width: "100%" }} onClick={() => { setAct(null); setSel(j); up({ tipo: "suma", activo: x.id, monto: "" }); setAviso(null); irA("f10-capital"); }}>{tx(`Invertirle más dinero en ${yy}`, `Invest more in ${yy}`)}</button>}</Op>
      </div></div>;
  }

  const Anios = ({ id }) => (movil
    ? <div><div style={{ fontSize: 12, color: C.tx2, marginBottom: 6 }}>{tx(`Estás viendo ${AN[sel]}. Toca otro año para verlo.`, `You are viewing ${AN[sel]}. Tap another year to see it.`)}</div><div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>{AN.map((a, j) => <button key={a} type="button" aria-pressed={j === sel} onClick={() => elegirAnio(j)} id={j === 0 ? id : undefined} style={{ minHeight: 44, flex: "0 0 64px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${j === sel ? C.gn : C.bd}`, background: j === sel ? "rgba(0,200,5,0.16)" : "transparent", color: j === sel ? C.gn : C.tx }}>{a}</button>)}</div></div>
    : <div style={GRID}><div style={{ fontSize: 12, color: C.tx2 }}>{tx("Plata de cada año, con sus precios", "Each year's money, at that year's prices")}</div>{AN.map((a, j) => <button key={a} type="button" aria-pressed={j === sel} onClick={() => elegirAnio(j)} id={j === 0 ? id : undefined} style={{ minHeight: 44, width: "100%", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${j === sel ? C.gn : C.bd}`, background: j === sel ? "rgba(0,200,5,0.16)" : "transparent", color: j === sel ? C.gn : C.tx }}>{a}</button>)}</div>);
  const pagan = M.act.filter((x) => x.v.some((v) => v > 0.5)), sinPago = M.act.filter((x) => !x.v.some((v) => v > 0.5) && x.val.some((v) => v > 0.5)), reinvierten = sinPago.filter((x) => !BIENES.has(x.clase)), bienes = sinPago.filter((x) => BIENES.has(x.clase));
  const malos = AN.filter((_, j) => M.queda[j] < 0), ok = malos.length === 0; let jm = 0; M.queda.forEach((q, j) => { if (q < M.queda[jm]) jm = j; });
  const pasados = cuenta.filter((x) => x.porInvertir < -1).map((x) => AN[x.anio - 1]);
  const T2 = ({ children, sub }) => <div><h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: C.tx }}>{children}</h2>{sub ? <div style={{ fontSize: 13, color: C.tx2, marginTop: 2 }}>{sub}</div> : null}</div>;
  const Linea = ({ a, b, fuerte, color, quitar }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14, fontWeight: fuerte ? 600 : 400, color: color || C.tx, alignItems: "center" }}><span>{a}{quitar ? " " : null}{quitar ? <button type="button" style={lnk} onClick={quitar}>{tx("Quitar", "Remove")}</button> : null}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{b}</span></div>;
  const corte = <div style={{ flex: "1 1 100%", height: 0 }} />;
  const T = f.prTipo, prVende = T === "asociativo" || f.prFinal === "vende";

  return <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 520px", minWidth: 0 }}><h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.tx }}>{tx("Tu plan en una pantalla", "Your plan on one screen")}</h2>
        <div style={{ fontSize: 14, color: C.tx2, lineHeight: 1.5, marginTop: 6, maxWidth: 760 }}>{tx("Aquí está todo lo que tienes cargado, año por año. Sigue estos tres pasos. Nada de esto cambia tus páginas: solo arma este escenario.", "Everything you've entered, year by year. Follow these three steps. None of this changes your pages: it only builds this scenario.")}</div></div>
      {onVerPasos ? <button type="button" style={lnk} onClick={onVerPasos}>{tx("Ver el detalle paso a paso", "See the step-by-step detail")}</button> : null}
    </div>

    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <div style={{ ...tarjeta, flex: "1 1 280px", minWidth: 0, borderColor: ok ? "rgba(0,200,5,0.45)" : "rgba(255,80,0,0.55)" }}><div style={{ fontSize: 13, color: C.tx2 }}>{tx(`¿Te alcanza cada mes, de ${AN[0]} a ${AN[N - 1]}?`, `Is each month covered, ${AN[0]} to ${AN[N - 1]}?`)}</div>
        <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: ok ? C.gn : C.rd }}>{ok ? tx("Sí, los 10 años", "Yes, all 10 years") : `${tx("No alcanza en", "Short in")} ${malos.join(", ")}`}</div>
        <div style={{ fontSize: 13, color: C.tx2, marginTop: 4, lineHeight: 1.45 }}>{ok ? tx(`Tu año más justo es ${AN[jm]}: te quedan ${plata(M.queda[jm])} al mes.`, `Your tightest year is ${AN[jm]}: ${plata(M.queda[jm])} left a month.`) : tx(`En ${malos[0]} te faltan ${plata(-M.queda[AN.indexOf(malos[0])])} al mes.`, `In ${malos[0]} you're short ${plata(-M.queda[AN.indexOf(malos[0])])} a month.`)}</div></div>
      <div style={{ ...tarjeta, flex: "1 1 280px", minWidth: 0, borderColor: pasados.length ? "rgba(255,80,0,0.55)" : C.bd }}><div style={{ fontSize: 13, color: C.tx2 }}>{tx(`Capital disponible sin usar al terminar ${AN[N - 1]}`, `Unused available capital at the end of ${AN[N - 1]}`)}</div>
        <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: C.tx }}>{plata((cuenta[N - 1] || {}).pasa || 0)}</div>
        <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45, color: pasados.length ? C.rd : C.tx2 }}>{pasados.length ? tx(`Te pasaste de tu capital en ${pasados.join(", ")}.`, `You overspent your capital in ${pasados.join(", ")}.`) : tx("Es plata que todavía puedes invertir, año por año.", "Money you can still invest, year by year.")}</div></div>
      <div style={{ ...tarjeta, flex: "1 1 280px", minWidth: 0 }}><div style={{ fontSize: 13, color: C.tx2 }}>{tx(`Patrimonio neto al terminar ${AN[N - 1]}`, `Net worth at the end of ${AN[N - 1]}`)}</div>
        <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6, color: C.tx }}>{plata(M.pat[N - 1])}</div>
        <div style={{ fontSize: 13, color: C.tx2, marginTop: 4, lineHeight: 1.45 }}>{tx(`Con los precios de ${AN[N - 1]}. Equivale a ${plata(M.pat[N - 1] / M.deflFin[N - 1])} de hoy, ya sin la inflación.`, `At ${AN[N - 1]} prices. Equal to ${plata(M.pat[N - 1] / M.deflFin[N - 1])} today, net of inflation.`)}</div></div>
    </div>

    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 12 }}>
      {[[tx("Revisa tu tabla", "Review your table"), tx("Mira tus ingresos, inversiones, gastos y deudas. Toca un año en una inversión para venderla o liquidarla, cambiar lo que te paga o invertirle más dinero.", "Look at your income, investments, expenses and debts. Tap a year on an investment to sell it, change what it pays or invest more in it.")], [tx("Reparte tu capital disponible", "Allocate your available capital"), tx("Si vendes o liquidas algo, esa plata queda disponible ese año. Decide: inversión nueva, invertirle más a otra o pagar una deuda.", "When you sell something, that money is available that year. Decide: new investment, add to another, or pay a debt.")], [tx("Mira cómo queda cada año", "See how each year ends up"), tx("Abajo ves el capital que pasa de un año a otro y tu patrimonio. Arriba, si te alcanza cada mes.", "Below: the capital carried from year to year and your net worth. Above: whether each month is covered.")]].map(([a, b], i) =>
        <li key={i} style={{ ...tarjeta, flex: "1 1 260px", minWidth: 0, display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px" }}><span aria-hidden="true" style={{ flex: "none", width: 28, height: 28, borderRadius: 999, background: C.gn, color: "#000", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          <span><span style={{ fontSize: 14, fontWeight: 600, display: "block", color: C.tx }}>{a}</span><span style={{ fontSize: 13, color: C.tx2, lineHeight: 1.45, display: "block", marginTop: 2 }}>{b}</span></span></li>)}
    </ol>

    <section style={tarjeta} id="f10-tabla"><div style={{ overflowX: "auto" }}><div style={cajaTabla}>
      <Anios />
      <T2 sub={tx("Promedio al mes de cada año. Abre cada categoría con la flecha.", "Monthly average for each year. Open each category with the arrow.")}>{tx("1 · Revisa tu tabla: ¿lo que te entra cada mes cubre lo que te sale?", "1 · Review your table: does your monthly income cover your spending?")}</T2>
      {hecho ? <div role="status" id="f10-hecho" style={{ fontSize: 13, lineHeight: 1.5, color: C.gn }}>{hecho}</div> : null}
      <Bloque abierto={!!abre.ing} alternar={() => setAbre((a) => ({ ...a, ing: !a.ing }))} nombre={tx("Ingresos", "Income")} sub={`${M.ing.length} ${M.ing.length === 1 ? tx("ingreso", "income") : tx("ingresos", "incomes")} · ${tx("salarios, honorarios y lo que no viene de una inversión", "salaries, fees and anything not from an investment")}`} totales={cels(suma(M.ing), { fuerte: true })}>{M.ing.map((x) => filaTermina(x, "ingresosTerminan", tx("Termina al empezar", "Ends at the start of")))}</Bloque>
      <Bloque abierto={!!abre.inv} alternar={() => setAbre((a) => ({ ...a, inv: !a.inv }))} nombre={tx("Inversiones que te pagan al mes", "Investments that pay you monthly")} sub={`${pagan.length} ${tx("inversiones · es plata que te llega y puedes usar · toca un año para vender o cambiar lo que paga", "investments · money that reaches you · tap a year to sell or change its income")}`} totales={cels(suma(pagan), { fuerte: true })}>{pagan.map(filaInv)}</Bloque>
      {/* 26-nov-2026 (Santiago: "que separe rentas disponibles de lo que queda invertido"; "Ledger, IBKR, Meteora salen vacíos"). */}
      {reinvierten.length ? <Bloque abierto={!!abre.rei} alternar={() => setAbre((a) => ({ ...a, rei: !a.rei }))} nombre={tx("Inversiones que se reinvierten", "Investments that are reinvested")} sub={`${reinvierten.length} ${tx("inversiones · no te pagan al mes: lo que rinden se queda invertido y crece · aquí ves lo que valen cada año", "investments · no monthly income: their return stays invested and grows · here's what they're worth each year")}`} totales={soloSel(AN.map((_, j) => <Celda key={j} v={0} sel={j === sel} vale={reinvierten.reduce((t0, x) => t0 + x.val[j], 0)} />))}>{reinvierten.map(filaInv)}</Bloque> : null}
      {/* 26-nov-2026 (Santiago: "District es una propiedad y es lo mismo que 50% District… ¿me faltó marcar cada inversión qué es?"). Una propiedad
          sin ingreso ligado no «se reinvierte»: va aparte y dice cómo ligarle su ingreso para que no salga en dos renglones. */}
      {bienes.length ? <Bloque abierto={!!abre.bie} alternar={() => setAbre((a) => ({ ...a, bie: !a.bie }))} nombre={tx("Propiedades y bienes sin ingreso ligado", "Properties and assets with no linked income")} sub={`${bienes.length} ${(puedeDatos ? tx("· aquí ves lo que valen cada año · si alguna sí te paga (un arriendo), ese ingreso está suelto en «Ingresos»: toca su nombre para abrir su ficha y conectarlo: quedará en un solo renglón", "· here's what they're worth each year · if one does pay you (rent), that income is loose under \"Income\": tap its name to open its record and connect it: it becomes one row") : tx("· aquí ves lo que valen cada año · si alguna sí te paga (un arriendo), ese ingreso está suelto en «Ingresos»: lígalo en la página Ingresos, en «Activo que genera este ingreso»", "· here's what they're worth each year · if one does pay you (rent), that income is loose under \"Income\": link it on the Income page, under \"Asset that generates this income\""))}`} totales={soloSel(AN.map((_, j) => <Celda key={j} v={0} sel={j === sel} vale={bienes.reduce((t0, x) => t0 + x.val[j], 0)} />))}>{bienes.map(filaInv)}</Bloque> : null}
      <Fila fuerte linea nombre={tx("= Te entra al mes", "= Monthly income")} celdas={cels(M.entra, { fuerte: true })} />
      <Bloque abierto={!!abre.gas} alternar={() => setAbre((a) => ({ ...a, gas: !a.gas }))} nombre={tx("Gastos", "Expenses")} sub={`${M.gas.length} ${tx("gastos", "expenses")}`} totales={cels(suma(M.gas), { fuerte: true })}>{M.gas.map((x) => filaTermina(x, "gastosTerminan", tx("Ya no lo pagas desde", "No longer paid from")))}</Bloque>
      <Bloque abierto={!!abre.deu} alternar={() => setAbre((a) => ({ ...a, deu: !a.deu }))} nombre={tx("Cuotas de deudas", "Debt installments")} sub={`${M.deu.length} ${M.deu.length === 1 ? tx("deuda", "debt") : tx("deudas", "debts")}`} totales={cels(suma(M.deu), { fuerte: true })}>
        {M.deu.map((x) => { const d = (r.deudas || []).find((q) => q.nombre === x.nombre) || {}; const itD = mapa.deudas.find((q) => q.nombre === x.nombre); return <div key={x.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}><Fila hijo nombre={itD ? nombreFic(x.nombre, "deuda", x.id) : x.nombre} sub={<>{`${tx("Debes hoy", "You owe today")} ${plata(d.saldo || 0)}${d.pagaAnio ? ` · ${tx("la pagas en", "you pay it off in")} ${AN[d.pagaAnio - 1]}` : d.ventaAnio || d.porVenta ? ` · ${tx("se paga con la venta de su inversión", "paid with the sale of its asset")}` : d.finAnio && d.finAnio <= N ? ` · ${tx("se acaba con sus cuotas en", "ends with its installments in")} ${AN[d.finAnio - 1]}` : ""}`}{marca(itD, "deuda", x.id)}</>}
          celdas={cels(x.v, { caja: true, cada: (v, j) => ({ tag: j > 0 && v < 0.5 && x.v[j - 1] > 0.5 ? tx("Pagada", "Paid") : "" }) })} />{itD && puedeDatos && fic && fic.tipo === "deuda" && fic.id === x.id ? fichaItem("deuda", itD) : null}</div>; })}</Bloque>
      <Fila fuerte linea nombre={tx("− Te sale al mes", "− Monthly spending")} celdas={cels(M.sale, { fuerte: true })} />
      <Fila fuerte grande nombre={tx("= Te queda al mes", "= Left each month")} sub={tx("Lo que te entra menos lo que te sale", "Income minus spending")} celdas={cels(M.queda, { res: true, alto: 52 })} />
    </div></div></section>

    <section id="f10-capital" style={{ ...tarjeta, scrollMarginTop: 12, borderColor: hayCapital ? C.gn : C.bd, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <T2 sub={tx("Es la plata de lo que vendes o liquidas y de lo que te sobró de años anteriores.", "The money from what you sell and what was left over from earlier years.")}>{tx(`2 · Reparte tu capital disponible de ${y}`, `2 · Allocate your ${y} available capital`)}</T2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{AN.map((a, j) => <button key={a} type="button" aria-pressed={j === sel} onClick={() => elegirAnio(j)} style={{ minHeight: 44, padding: "0 10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${j === sel ? C.gn : C.bd}`, background: j === sel ? "rgba(0,200,5,0.16)" : "transparent", color: j === sel ? C.gn : C.tx }}>{a}</button>)}</div>
      </div>
      {!hayCapital ? <div style={{ fontSize: 14, lineHeight: 1.55, color: C.tx }}>{tx(`En ${y} no tienes capital disponible para repartir. Aparece cuando vendes o liquidas algo en la tabla de arriba, o cuando te sobra plata de un año anterior. Elige otro año con los botones.`, `In ${y} you have no available capital to allocate. It appears when you sell something in the table above, or when money is left from an earlier year. Pick another year with the buttons.`)}</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <Linea a={sel === 0 ? tx("Traes de antes", "Carried over") : tx(`Traes de ${y - 1}`, `Carried from ${y - 1}`)} b={plata(g.antes || 0)} />
            {(g.llegan || []).map((l, i) => <Linea key={i} a={`+ ${/^(Vendes|Lo que vendes|You sell|What you sell|De tu reserva|Sacas|From|Taken)/.test(l.nombre) ? l.nombre : l.tipo === "retiro" ? `${l.parcial ? tx("Retiras una parte de", "You withdraw part of") : tx("Retiras todo de", "You withdraw all of")} ${l.nombre}` : `${tx("Vendes", "You sell")} ${l.nombre}`}`} b={plata(l.monto)} />)}
            {(g.compromisos || []).map((l, i) => <Linea key={i} a={`− ${l.nombre}`} b={plata(l.monto)} quitar={demo ? null : quitaDeuda(l.nombre)} />)}
            {g.faltaMes > 0.5 ? <Linea a={tx(`− Apartas para lo que te falta para vivir en ${y}`, `− Set aside for your ${y} living shortfall`)} b={plata(g.faltaMes)} /> : null}
            <div style={{ borderTop: `1px solid ${C.bd2}`, margin: "2px 0" }} />
            <Linea fuerte a={tx(`= Puedes usar en ${y}`, `= You can use in ${y}`)} b={plata(usable)} />
            {movidas.length ? <div style={{ fontSize: 12, color: C.am, fontWeight: 600, marginTop: 4 }}>{tx(`Ya repartiste en ${y}:`, `Already allocated in ${y}:`)}</div> : null}
            {movidas.map((m, k) => <div key={m.k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, alignItems: "center", border: `1px solid ${C.am}`, background: "rgba(245,158,11,0.10)", borderRadius: 8, padding: "6px 10px", color: C.tx }}>
              <span><b style={{ color: C.am }}>{k + 1} ·</b> {m.txt} {demo ? null : <button type="button" style={lnk} onClick={m.quitar}>{tx("Quitar", "Remove")}</button>}</span><span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>− {plata(m.monto)}</span></div>)}
            <div style={{ borderTop: `1px solid ${C.bd2}`, margin: "2px 0" }} />
            {porUsar >= -1 ? <Linea fuerte color={C.gn} a={tx("= Te queda por usar", "= Left to use")} b={plata(porUsar < 2 ? 0 : porUsar)} /> : <Linea fuerte color={C.rd} a={tx("= Te pasaste por", "= Overspent by")} b={plata(-porUsar)} />}
            <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.5 }}>{tx(`Además, durante ${y} ${(g.flujo || 0) >= 0 ? "te sobran" : "te faltan"} ${plata(Math.abs(g.flujo || 0))} mes a mes. Al terminar el año pasan ${plata(g.pasa || 0)} a ${y + 1}.`, `Also, during ${y} you ${(g.flujo || 0) >= 0 ? "have a surplus of" : "are short"} ${plata(Math.abs(g.flujo || 0))} month by month. At year end ${plata(g.pasa || 0)} carries to ${y + 1}.`)}</div>
          </div>
          <div style={{ flex: "1.3 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{demo ? tx("En modo demo no se pueden hacer cambios.", "Changes are disabled in demo mode.") : !movidas.length ? tx("¿Qué haces con esa plata? Puedes repartirla en varias partes.", "What do you do with that money? You can split it into parts.") : porUsar > 1 ? tx(`Parte ${movidas.length + 1}: te quedan ${plata(porUsar)} por usar. ¿Qué haces con eso?`, `Part ${movidas.length + 1}: ${plata(porUsar)} left to use. What do you do with it?`) : tx(`Ya repartiste todo tu capital disponible de ${y}.`, `You've allocated all your ${y} available capital.`)}</div>
            {demo ? null : movidas.length && porUsar <= 1 ? <div style={{ fontSize: 13, color: C.tx2, lineHeight: 1.5 }}>{tx("Si quieres cambiar algo, toca «Quitar» en la parte que quieras rehacer. Lo que creaste ya está en la tabla, marcado en amarillo.", "To change something, tap \"Remove\" on the part you want to redo. What you created is in the table, highlighted in yellow.")}</div>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <Campo etiqueta={tx("¿Qué haces?", "What do you do?")}><Sel id="f10-tipo" value={f.tipo} on={(v) => up({ tipo: v })} ops={[["nueva", tx("Crear una inversión nueva", "Create a new investment")], ["suma", tx("Invertirle más dinero a una que ya tienes", "Invest more in one you already have")], ["deuda", tx("Pagar una deuda", "Pay off a debt")]]} /></Campo>
                {f.tipo === "nueva" ? <><Campo etiqueta={tx("Tipo de inversión", "Investment type")}><Sel id="f10-preset" value={f.preset} on={(v) => up({ preset: v, rend: "" })} ops={presetsLista()} /></Campo>
                  {f.preset === "fincaRaiz" ? <Campo etiqueta={tx("¿Cómo es el negocio?", "What kind of deal?")}><Sel id="f10-pr-tipo" value={f.prTipo} on={(v) => up({ prTipo: v })} ops={prTipos()} /></Campo> : null}
                  <Campo etiqueta={tx("Nombre (opcional)", "Name (optional)")}><Txt id="f10-nombre" value={f.nombre} on={(v) => up({ nombre: v })} ph={tx("Ej.: Bodega, CDT", "E.g. Warehouse, CD")} /></Campo></> : null}
                {f.tipo === "nueva" && !esPR ? <><Campo etiqueta={tx("Rinde al año (%)", "Yearly return (%)")}><Txt id="f10-rend" value={f.rend} on={(v) => up({ rend: v })} ph={rendDef || tx("Ej.: 12", "E.g. 12")} w={86} /></Campo>
                  <Campo etiqueta={tx("De lo que rinde, te llega al mes", "Of its return, paid to you monthly")}><Sel value={f.recibe} on={(v) => up({ recibe: v })} ops={[["100", tx("Todo (te paga renta)", "All (pays income)")], ["50", tx("La mitad", "Half")], ["0", tx("Nada (se reinvierte)", "None (reinvested)")]]} /></Campo></> : null}
                {esPR ? <>{corte}<div style={{ flex: "1 1 100%", fontSize: 13, fontWeight: 600, color: C.tx }}>{tx(`1 · Lo que cuesta (con los precios de ${y})`, `1 · What it costs (at ${y} prices)`)}</div>
                  {T === "planos" ? <><Campo etiqueta={tx("Precio de la propiedad", "Property price")}><Txt id="f10-pr-valor" value={f.prValor} on={(v) => up({ prValor: v })} ph="800.000.000" w={170} plataIn /></Campo><Campo etiqueta={tx("Cuota inicial (%)", "Down payment (%)")}><Txt value={f.prCuota} on={(v) => up({ prCuota: v })} ph="30" w={80} /></Campo><Campo etiqueta={tx("Años hasta la entrega", "Years to delivery")}><Sel value={f.prPlazo} on={(v) => up({ prPlazo: v })} ops={[["0", tx("Este mismo año", "This year")], ["1", tx("1 año", "1 year")], ["2", tx("2 años", "2 years")], ["3", tx("3 años", "3 years")], ["4", tx("4 años", "4 years")]]} /></Campo></>
                    : T === "asociativo" ? <><Campo etiqueta={tx("Lo que pones", "What you put in")}><Txt id="f10-pr-valor" value={f.prValor} on={(v) => up({ prValor: v })} ph="1.350.000.000" w={170} plataIn /></Campo><Campo etiqueta={tx("Dura", "Lasts")}><Sel value={f.prMeses} on={(v) => up({ prMeses: v })} ops={["6", "12", "18", "24", "36"].map((m) => [m, `${m} ${tx("meses", "months")}`])} /></Campo></>
                      : <><Campo etiqueta={tx("Valor del lote", "Lot value")}><Txt id="f10-pr-lote" value={f.prLote} on={(v) => up({ prLote: v })} ph="430.000.000" w={160} plataIn /></Campo><Campo etiqueta={tx("Metros a construir", "Square meters to build")}><Txt id="f10-pr-m2" value={f.prM2} on={(v) => up({ prM2: v })} ph="300" w={90} plataIn /></Campo><Campo etiqueta={tx("Costo por metro", "Cost per meter")}><Txt id="f10-pr-costo" value={f.prCostoM2} on={(v) => up({ prCostoM2: v })} ph="2.000.000" w={130} plataIn /></Campo><Campo etiqueta={tx("Años de obra", "Years to build")}><Sel id="f10-pr-plazo" value={f.prPlazo} on={(v) => up({ prPlazo: v })} ops={[["0", tx("Menos de 1 año", "Under 1 year")], ["1", tx("1 año", "1 year")], ["2", tx("2 años", "2 years")], ["3", tx("3 años", "3 years")]]} /></Campo></>}
                  {corte}<div style={{ flex: "1 1 100%", fontSize: 13, fontWeight: 600, color: C.tx }}>{tx("2 · Lo que vale al terminar y qué haces con ella", "2 · What it's worth at the end and what you do with it")}</div>
                  <Campo etiqueta={T === "asociativo" ? tx("Ganancia sobre lo que pones (%)", "Profit on what you put in (%)") : tx("Al terminar vale más que lo que cuesta (%)", "Worth more than cost at the end (%)")}><Txt value={f.prValE} on={(v) => up({ prValE: v })} ph="20" w={80} /></Campo>
                  {T !== "asociativo" ? <><Campo etiqueta={tx("Después sube cada año (%)", "Then rises yearly (%)")}><Txt value={f.prValA} on={(v) => up({ prValA: v })} ph={tx("Como la inflación", "Like inflation")} w={130} /></Campo><Campo etiqueta={tx("Al terminar", "At the end")}><Sel id="f10-pr-final" value={f.prFinal} on={(v) => up({ prFinal: v })} ops={[["queda", tx("Me quedo con ella", "I keep it")], ["vende", tx("La vendo", "I sell it")]]} /></Campo></> : null}
                  {!prVende ? <Campo etiqueta={tx("Renta al mes desde la entrega", "Monthly rent from delivery")}><Txt id="f10-pr-renta" value={f.prRenta} on={(v) => up({ prRenta: v })} ph="8.500.000" plataIn /></Campo> : null}
                  {prVende && T !== "asociativo" ? <Campo etiqueta={tx("La vendo", "I sell it")}><Sel value={f.prVendeEn} on={(v) => up({ prVendeEn: v })} ops={[["0", tx("Apenas la entregan", "At delivery")], ["1", tx("1 año después", "1 year later")], ["2", tx("2 años después", "2 years later")], ["3", tx("3 años después", "3 years later")]]} /></Campo> : null}
                  {prVende ? <><Campo etiqueta={tx("¿Se repite?", "Does it repeat?")}><Sel value={f.prRepite} on={(v) => up({ prRepite: v })} ops={[["no", tx("Una sola vez", "Just once")], ["si", tx("Se repite hasta el final del plan", "Repeats until the end of the plan")]]} /></Campo><Campo etiqueta={tx("La ganancia", "The profit")}><Sel value={f.prDestino} on={(v) => up({ prDestino: v })} ops={[["reinvierte", tx("Se reinvierte", "Is reinvested")], ["flujo", tx("Me llega a mi mes", "Goes to my monthly income")]]} /></Campo></> : null}{corte}</> : null}
                {f.tipo === "suma" ? <Campo etiqueta={tx("¿A cuál?", "Which one?")}><Sel id="f10-activo" value={f.activo || (vivos[0] || {}).id || ""} on={(v) => up({ activo: v })} ops={vivos.map((x) => [x.id, x.nombre])} /></Campo> : null}
                {f.tipo === "deuda" ? <Campo etiqueta={tx("¿Cuál?", "Which one?")}><Sel id="f10-deuda" value={f.deuda || (deudasVivas[0] || {}).id || ""} on={(v) => up({ deuda: v })} ops={deudasVivas.map((d) => [d.id, `${d.nombre} · ${tx("debes hoy", "you owe today")} ${plata(d.saldo)}`])} /></Campo> : null}
                {f.tipo !== "deuda" && !esPR ? <><Campo etiqueta={tx(`¿Cuánto? (pesos de ${y})`, `How much? (${y} money)`)}><Txt id="f10-monto" value={montoTxt} on={(v) => up({ monto: v })} ph="0" plataIn /></Campo>
                  <button type="button" style={{ ...btn2, borderColor: C.gn, color: C.gn }} onClick={() => up({ monto: miles(Math.max(0, Math.floor(porUsar))) })}>{tx(`Usar todo lo que queda de ${y}: ${plata(Math.max(0, Math.floor(porUsar)))}`, `Use all that's left of ${y}: ${plata(Math.max(0, Math.floor(porUsar)))}`)}</button></> : null}
                <button type="button" style={btn1} onClick={agregar}>{tx("Agregar", "Add")}</button>
                {f.tipo === "nueva" ? <div id="f10-previa" style={{ flex: "1 1 100%", fontSize: 13, lineHeight: 1.5, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 8, padding: "10px 12px" }}>{previa()}</div> : null}
              </div>}
            {aviso ? <div role="status" style={{ fontSize: 13, lineHeight: 1.5, color: aviso.ok ? C.gn : C.am }}>{aviso.txt}</div> : null}
          </div>
        </div>}
    </section>

    <section style={tarjeta}><div style={{ overflowX: "auto" }}><div style={cajaTabla}>
      <Anios />
      <T2 sub={tx("Plata para invertir, pagar deudas o guardar. Aquí las cifras son del año completo, no del mes.", "Money to invest, pay debts or keep. These are full-year figures, not monthly.")}>{tx("3 · Mira cómo queda cada año: tu capital disponible", "3 · See how each year ends up: your available capital")}</T2>
      <Fila nombre={tx("Traes del año anterior", "Carried from the previous year")} celdas={cels(cuenta.map((x) => x.antes), { caja: true })} />
      <Fila nombre={tx("+ Te llega por ventas y retiros", "+ From sales and withdrawals")} celdas={cels(cuenta.map((x) => x.llega), { caja: true })} />
      <Fila nombre={tx("+ Te sobra en el año", "+ Surplus during the year")} sub={tx("Lo que te queda al mes, por 12", "Your monthly surplus, times 12")} celdas={cels(cuenta.map((x) => x.flujo), { caja: true })} />
      <Fila nombre={tx("− Pagos y deudas que pagas", "− Payments and debts you pay")} celdas={cels(cuenta.map((x) => x.comprometido), { caja: true })} />
      <Fila nombre={tx("− Inviertes ese año", "− Invested that year")} celdas={cels(cuenta.map((x) => x.movido), { caja: true })} />
      <Fila fuerte grande linea nombre={tx("= Pasa al año siguiente", "= Carries to next year")} sub={tx("Como capital disponible", "As available capital")} celdas={cels(cuenta.map((x) => x.pasa), { res: true, alto: 52 })} />
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `2px solid ${C.bd2}` }}><T2 sub={tx("Lo que valen tus inversiones menos lo que debes.", "What your investments are worth minus what you owe.")}>{tx("Lo que tienes al terminar cada año", "What you have at the end of each year")}</T2></div>
      <Bloque abierto={!!abre.val} alternar={() => setAbre((a) => ({ ...a, val: !a.val }))} nombre={tx("Tus inversiones", "Your investments")} sub={`${M.act.length} ${tx("renglones", "items")}`} totales={cels(AN.map((_, j) => M.act.reduce((s, x) => s + x.val[j], 0)), { fuerte: true })}>{M.act.map((x) => <Fila key={x.id} hijo nombre={x.nombre} celdas={cels(x.val, { caja: true })} />)}</Bloque>
      <Fila fuerte nombre={tx("− Tus deudas", "− Your debts")} celdas={cels(AN.map((_, j) => M.act.reduce((s, x) => s + x.val[j], 0) - M.pat[j]).map((v) => (Math.abs(v) < 2 ? 0 : v)), { fuerte: true })} />
      <Fila fuerte grande linea nombre={tx("= Patrimonio neto", "= Net worth")} celdas={cels(M.pat, { fuerte: true, caja: true, alto: 52 })} />
    </div></div></section>
  </div>;
}
