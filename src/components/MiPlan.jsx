// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · MiPlan — el plan patrimonial a 10 años, paso a paso
//
// 21-oct-2026, Santiago: "esto debería ser un proceso guiado que lo lleva a
// uno paso a paso, considerando lo que se tiene, lo que se va a transformar o
// vender para reinvertir, lo que viene por ingresos adicionales —la bodega
// empieza en 2 años, la pensión en 4— y todo esto entonces le muestra a uno y
// le modela el escenario; además los puede uno revisar cada uno y compararlos."
//
//   1 · QUÉ TIENES HOY          tu punto de partida: qué vale y qué te paga
//   2 · QUÉ VENDES Y QUÉ COMPRAS tus movimientos: qué sale, qué deudas pagas,
//                                a dónde va la plata y con qué regla
//   3 · QUÉ VIENE NUEVO          lo que llega solo, en todos los escenarios:
//                                pensión, la obra, un contrato
//   4 · TU CAMINO A 10 AÑOS      el escenario modelado y contado, año a año
//   5 · COMPARA                  todos lado a lado, estrés y $100 M en cada uno
//
// Seguridad, Balance y Crecimiento son plantillas: llenan el paso 3 con un
// despliegue concreto que se puede editar. El motor es lib/planes.js; la
// traducción de datos y plantillas es lib/caminos.js. Se guarda en
// user.caminos (escenarios), perfilPlan (supuestos y lo que viene),
// fichasPlan (canasta por activo) y caminoElegido.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState, useEffect } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs.jsx";
import { C, F } from "../lib/designTokens";
import { fmtPlataCortaEs } from "../lib/formato.js";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area, ReferenceLine } from "recharts";
import { ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import { baseDesdeUsuario, CAMINOS_BASE, compararCaminos, medirCanastas, canastaDe, CANASTA_LABEL, CANASTA_CORTO, CANASTA_PRUEBA, CANASTA_EJEMPLOS, porQueCanasta, CONDICION_LABEL, PERFIL_DEFAULT, escenarioDesdeCamino, proponerDesdeCamino, escenarioVacio, liquidezEscenario, narrar, cienEnCada } from "../lib/caminos.js";

// Capital y mensualidades se escriben igual: una sola función, con separador
// de miles en todas las ramas (ver fmtPlataCortaEs). Los dos nombres se
// conservan porque dicen qué se está mostrando en cada punto de la pantalla.
const fmM = fmtPlataCortaEs;
const fmMes = fmtPlataCortaEs;
const pct = (n) => `${Math.round(Number(n) || 0)}%`;
// 21-oct-2026 — Con coma, y sin decimales inventados: la tasa derivada salía
// "14.380434782608695%" y además con punto.
const pctEs = (n) => { const v = Number(n) || 0; const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",")) + "%"; };
const CANASTA_COLOR = { proteccion: C.accent, rentas: C.ok, crecimiento: C.warn, uso: C.subtle };
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// 21-oct-2026 — "hasta cuándo" era la celda que faltaba de la rejilla
// (qué es · cuándo · cuánto vale · cuánto renta). Sin ella, un ingreso que
// solo corre en diciembre se veía igual que uno de todo el año.
const ventanaTexto = (p) => {
  const v = p.ventana;
  if (!v || !(v.hasta >= v.desde)) return null;
  if (v.desde <= 1 && v.hasta >= 12) return null;
  return v.desde === v.hasta ? `solo ${MES_CORTO[v.desde - 1]}` : `${MES_CORTO[v.desde - 1]}–${MES_CORTO[v.hasta - 1]}`;
};
const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, minWidth: 0 };
const sub = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, minWidth: 0 };
const inputS = { background: C.bg, border: `1px solid ${C.borderStrong}`, borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };
const btn = (primary) => ({ background: primary ? C.accent : "transparent", color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.accent : C.borderStrong}`, borderRadius: 999, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
const chip = (color) => ({ display: "inline-block", padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: `${color}20`, border: `1px solid ${color}40`, whiteSpace: "nowrap" });
const th = { ...F.label, textAlign: "left", padding: "8px 6px", whiteSpace: "nowrap" };
const td = { padding: "7px 6px 16px", color: C.text, fontSize: 12, verticalAlign: "middle" };
const tdNum = { ...td, textAlign: "right", fontFamily: F.mono.fontFamily, whiteSpace: "nowrap" };
// 22-oct-2026 (Santiago: "pongo que una inversion crece el 1,5% no me deja
// poner por ejemplo 1,7"). Era <input type="number" step={0.5}>: el navegador
// rechaza cualquier valor que no caiga en el salto, y en un teclado en español
// la COMA ni siquiera entra. Dos formas de no poder escribir tu propio dato.
// InputDecimalEs acepta coma o punto y devuelve siempre un número.
const Num = ({ value, onChange, step = 1, min, max, suffix, w }) => (
  <div style={{ position: "relative", width: w }}>
    <InputDecimalEs value={value ?? ""} onChange={(v) => onChange(v === "" ? "" : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)))} style={{ ...inputS, paddingRight: suffix ? 26 : 10, textAlign: "right" }} />
    {suffix && <span style={{ position: "absolute", right: 8, top: 9, fontSize: 11, color: C.subtle }}>{suffix}</span>}
  </div>
);
// Pesos completos con separador de miles (22.000.000). Guarda el número; muestra el formato.
//
// 22-oct-2026 — En la cuenta real había dos pensiones cargadas en
// $24.000.000.000.000 y $25.000.000.000.000 AL MES (billones), seis ceros de
// más. Nadie lo vio: catorce dígitos seguidos no se leen, y el plan los tomó
// como un hecho y mostró "$6.018.241,6 mil M en el año 10" con toda seriedad.
// Un error de tecleo envenena los diez años de todos los escenarios.
// Por eso, pasados los mil millones, el campo dice en voz alta cuánto es lo
// que acabas de escribir; y pasados los cien mil millones, pregunta. No
// bloquea: hay cifras legítimamente grandes (una finca de $9 mil M).
const NumPesos = ({ value, onChange, w, placeholder }) => {
  const n = Number(value) || 0, a = Math.abs(n);
  const txt = value == null || value === "" ? "" : Math.round(n).toLocaleString("es-CO");
  const duda = a >= 1e11;
  // 22-oct-2026 (Santiago: "diagrame bien, mire unos campos desalineados").
  // El eco colgaba DEBAJO del input y le sumaba alto solo a este campo, asi
  // que en una fila de campos alineados al pie —"cuanto vale" junto a "para
  // que"— este quedaba un renglon mas arriba que los demas. Ahora flota
  // (position: absolute): dice lo mismo y no mueve a nadie.
  return (
    <div style={{ width: w || "100%", position: "relative" }}>
      <input type="text" inputMode="numeric" value={txt} placeholder={placeholder || "0"} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); onChange(d === "" ? "" : Number(d)); }} style={{ ...inputS, width: "100%", textAlign: "right", fontFamily: F.mono.fontFamily, fontWeight: 500, borderColor: duda ? C.danger : undefined }} />
      {a >= 1e9 && <div style={{ position: "absolute", left: 0, right: 0, top: "100%", textAlign: "right", fontSize: 10, lineHeight: "13px", pointerEvents: "none", color: duda ? C.danger : C.subtle }}>{fmtPlataCortaEs(n)}{duda ? " · ¿tantos ceros?" : ""}</div>}
    </div>
  );
};
const Campo = ({ l, children, style }) => (<label style={{ display: "block", ...style }}><div style={{ ...F.label, marginBottom: 4 }}>{l}</div>{children}</label>);
// "Cuándo": en N meses, o año X mes Y. Guarda meses desde hoy (0 = este mes).
function Cuando({ mes, onChange, compacto }) {
  const [modo, setModo] = useState("meses");
  const m = Math.max(0, Number(mes) || 0);
  const inp = { ...inputS, padding: "4px 6px", fontSize: 12, width: 60, textAlign: "right" };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...F.caption, flexWrap: "wrap" }}>
      <select value={modo} onChange={(e) => setModo(e.target.value)} style={{ ...inputS, padding: "4px 6px", fontSize: 11, width: "auto" }}><option value="meses">en</option><option value="anio">año</option></select>
      {modo === "meses" ? <><input type="number" min={0} max={120} value={m} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} style={inp} /><span>meses</span>{!compacto && m > 0 && <span style={{ color: C.subtle }}>(año {anioDe(m)}, mes {(m % 12) + 1})</span>}</>
        : <><input type="number" min={1} max={10} value={anioDe(m)} onChange={(e) => onChange((Math.max(1, Number(e.target.value) || 1) - 1) * 12 + (m % 12))} style={inp} /><span>mes</span><input type="number" min={1} max={12} value={(m % 12) + 1} onChange={(e) => onChange(Math.floor(m / 12) * 12 + Math.min(11, Math.max(0, (Number(e.target.value) || 1) - 1)))} style={inp} />{!compacto && <span style={{ color: C.subtle }}>(en {m} meses)</span>}</>}
    </div>
  );
}
const useAncho = () => { const [w, setW] = useState(typeof window === "undefined" ? 1200 : window.innerWidth); useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []); return w; };
const anioDe = (mes) => Math.floor((Number(mes) || 0) / 12) + 1;

// 22-oct-2026 — Santiago, leyendo "$62.550 mil M" al mes: "en mi caso, si ya
// la plataforma me dice que con Crecimiento me entran 62 MM, ya no me sirve,
// porque con eso no vivo". Leyó 62 millones donde decía 62 billones, y estuvo
// a un paso de descartar un escenario por una cifra que estaba rota (dos
// pensiones tecleadas con seis ceros de más).
//
// El numero imposible se presentaba con la misma seriedad que uno bueno. Diez
// años al 30% anual multiplican por 14; por cien, ya no es un plan, es un
// dato malo. Así que cuando pasa de ahí, la cifra se marca: no se esconde
// -esconderla seria mentir al reves- pero deja de parecer un hecho.
const VECES_IMPOSIBLE = 100;
const vecesDe = (p) => { const i = Number(p?.patrimonioInicial) || 0, f = Number(p?.patrimonioFinal) || 0; return i > 0 && f > 0 ? f / i : 0; };
const Imposible = ({ p, compacto }) => { const x = vecesDe(p); if (x <= VECES_IMPOSIBLE) return null; return <span style={{ ...chip(C.danger), marginLeft: 6, whiteSpace: "normal", display: "inline-block" }}>✋ multiplica tu patrimonio por {Math.round(x).toLocaleString("es-CO")}{compacto ? "" : ": eso no es un plan, es un supuesto mal puesto. Revisa pensiones y tasas."}</span>; };

// Producción mensual de una posición hoy: lo que recibes y lo que crece
const produce = (p) => {
  const recibe = p.capital * (Number(p.tasa) || 0) / 100 / 12 * ((p.pagaPct ?? 0) / 100) + (p.renta || 0);
  const crece = p.capital * (Math.pow(1 + (Number(p.tasa) || 0) / 100, 1 / 12) - 1) * (1 - (p.pagaPct ?? 0) / 100) + p.capital * (Math.pow(1 + (Number(p.valorizacion) || 0) / 100, 1 / 12) - 1);
  return { recibe, crece };
};
const notaDe = (p) => p.tasaDeclarada ? `Declaraste ${pctEs(p.tasaDeclarada)} sobre el capital · con la vigencia que cargaste entra ${pctEs(p.tasa)}` : p.vivienda && !(p.renta > 0) ? "Tu vivienda: protege, no produce" : p.renta > 0 ? `Renta ${fmMes(p.renta)} al mes${p.valorizacion ? ` · valoriza ${pctEs(p.valorizacion)}` : ""}` : p.bolsillo === "crecimiento" && p.tasa > 0 ? `Reinvierte al ${pctEs(p.tasa)}` : p.tasa > 0 ? `Paga el ${pctEs(p.pagaPct)} de ${pctEs(p.tasa)} cada mes` : p.vehiculo ? "Pierde valor con el uso" : p.valorizacion > 0 ? `Solo valoriza ${pctEs(p.valorizacion)}` : "Ni renta ni crece";

// ─── Barra de canastas ───────────────────────────────────────────────────────
function BarraCanastas({ c, alto = 14 }) {
  const total = c.total || 1;
  return <div style={{ display: "flex", height: alto, borderRadius: 999, overflow: "hidden", background: C.raised }}>{["proteccion", "rentas", "crecimiento", "uso"].map((k) => c[k] > 0 && <div key={k} title={`${CANASTA_LABEL[k]} ${fmM(c[k])}`} style={{ width: `${(c[k] / total) * 100}%`, background: CANASTA_COLOR[k] }} />)}</div>;
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
// 21-oct-2026. Santiago: "qué tienes hoy, qué vas a vender, qué vas a comprar,
// qué cosas nuevas o ingresos vienen… y así se arman los escenarios". Son sus
// palabras y son los pasos. Antes el 2 se llamaba "Lo que viene · Lo seguro"
// ("¿cómo que lo seguro? eso no se entiende") y estaba METIDO entre lo que
// tienes y lo que haces, que es donde más estorba: son cosas que llegan solas,
// no decisiones tuyas. Va después de tus movimientos.
const PASOS = [["Qué tienes hoy", "tu punto de partida"], ["Qué quieres proyectar", "hacia dónde mueves tu plata"], ["Qué cambios vas a hacer", "tus inversiones y lo que se viene"], ["Tu camino a 10 años", "el resultado"]];

// ─── La barra que no se va ───────────────────────────────────────────────────
// 21-oct-2026. El número a 10 años vivía dentro del paso 3 ("Resultado en
// vivo") y desaparecía al cambiar de paso, así que marcabas cosas sin ver el
// efecto. Es lo único que la sección existe para responder: va arriba, fijo.
function BarraEscenario({ todos, res, activoId, setActivoId, base, onNuevo }) {
  const r = res.find((x) => x.id === activoId) || res[0];
  if (!r) return null;
  const hoy = base?.base?.patrimonioNeto ?? 0;
  const delta = r.puntos.patrimonioFinal - hoy;
  return (
    <div style={{ ...card, padding: "12px 16px", position: "sticky", top: 0, zIndex: 5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", borderColor: r.color + "66" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={F.label}>Escenario</span>
        <select value={r.id} onChange={(e) => setActivoId(e.target.value)} style={{ ...inputS, width: "auto", minWidth: 180, color: r.color, fontWeight: 700 }}>
          {todos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <button style={{ ...btn(false), padding: "6px 12px" }} onClick={onNuevo}>+ Nuevo</button>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
        <div><span style={F.label}>Año 10 </span><b style={{ ...F.monoLg, color: C.text }}>{fmM(r.puntos.patrimonioFinal)}</b><Imposible p={r.puntos} compacto /> <span style={{ ...F.caption, color: delta >= 0 ? C.ok : C.danger }}>{delta >= 0 ? "+" : "−"}{fmM(Math.abs(delta))}</span></div>
        <div><span style={F.label}>Queda al mes </span><b style={{ ...F.monoLg, color: r.puntos.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(r.puntos.quedaMes)}</b></div>
      </div>
    </div>
  );
}

function Stepper({ paso, setPaso }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
      {PASOS.map(([t, s], i) => { const n = i + 1, on = paso === n, done = paso > n; return (
        <button key={t} onClick={() => setPaso(n)} style={{ background: on ? C.accent : C.surface, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 12, padding: "10px 8px", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
          <div style={{ ...F.label, color: on ? "#fff" : done ? C.ok : C.subtle }}>{done ? "✓" : n} · {s}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#fff" : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
        </button>); })}
    </div>
  );
}
const Siguiente = ({ onClick, children }) => <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={btn(true)} onClick={onClick}>{children} →</button></div>;


// ─── Un activo, una frase, una decisión ──────────────────────────────────────
// 21-oct-2026. Santiago, perdido en el paso 1: "no es claro no es intuitivo
// recibo qué? crece es qué? además después porcentajes?", "no queda claro uno
// en esta parte qué debe hacer", "la idea es uno ver cómo organiza su plan
// para ver el camino a los próximos 10 años".
//
// Era una tabla de 17 filas × 10 columnas, con los parámetros del motor
// puestos como si fueran datos suyos: "Rinde 0% · Recibes 0%" al lado de
// "$28,5 M" (esa renta no sale de un porcentaje, está cargada como ingreso), y
// "Recibes" significando dos cosas distintas en dos columnas. Pero el trabajo
// de este paso es UNA decisión por activo: ¿sigue o no sigue? Lo demás ya está
// calculado y solo hay que corregirlo cuando está mal.
//
// Los porcentajes no se borran: viven detrás de "ajustar", en la fila a la que
// pertenecen y con su nombre completo.
// 21-oct-2026 (Santiago: "uno debería poder borrar algún item si no va en el
// modelo"). El botón tenía dos estados —Continúa / Ya no va— para tres
// situaciones: sigue, se vende hoy, y no va acá. "Ya no va" era además el
// rótulo de la VENTA, así que la tercera no tenía dónde entrar y el único
// camino era irse a Patrimonio a apagar el activo (lo que lo saca de todo el
// producto: impuestos, dashboard, asesores). Ahora la venta se llama por su
// nombre y quitar es su propia accion, reversible.
//
// 22-oct-2026 — Primero quedo "Se vende hoy", y Santiago: "porque usa el
// termino hoy… 'sale hoy' no es como muy claro", "sale es que?", "activo para
// reconvertir, activo para vender pero no necesariamente hoy, eso ('hoy')
// sobra". Tiene razon: el "hoy" es un detalle del motor (la venta entra en el
// mes 0), no la decision de la persona. La decision es que ese activo deja de
// ser lo que es para convertirse en otra cosa. Se llama por eso: "Para
// reconvertir".
function FilaActivo({ p, onFicha, onQuitar }) {
  const [abierto, setAbierto] = useState(false);
  const x = produce(p);
  const k = canastaDe(p);
  const off = p.sale;
  const v = ventanaTexto(p);
  const partes = [`Vale ${fmM(p.capital)}`];
  partes.push(x.recibe > 0 ? `te paga ${fmMes(x.recibe)}/mes${v ? ` (${v})` : ""}` : "no te paga nada");
  if (p.vivienda) partes.push("vives aquí");
  if (p.tasa > 0 && p.pagaPct < 100) partes.push(`reinvierte al ${pctEs(p.tasa)}`);
  if (p.valorizacion > 0) partes.push(`valoriza ${pctEs(p.valorizacion)} al año`);
  else if (p.valorizacion < 0) partes.push(`pierde ${pctEs(-p.valorizacion)} al año`);
  const inp2 = { ...inputS, padding: "4px 6px", fontSize: 12, width: 70, textAlign: "right" };
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 0", opacity: off ? 0.55 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
            {p.nombre}
            {p.soloIngreso && <span style={{ ...chip(C.warn), marginLeft: 8 }}>de un ingreso, no está en Inversiones</span>}
            <span style={{ ...chip(CANASTA_COLOR[k]), marginLeft: 8 }}>{CANASTA_LABEL[k]}</span>
          </div>
          <div style={{ ...F.body, marginTop: 3 }}>{partes.join(" · ")}</div>
          <div style={F.caption}>{p.tipo} · {p.canasta ? "la canasta la decidiste tú" : porQueCanasta(p)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => onFicha({ estado: off ? "continua" : "sale" })} style={{ ...btn(false), color: off ? C.danger : C.ok, borderColor: off ? C.danger : C.ok, whiteSpace: "nowrap" }}>{off ? "Para reconvertir" : "Continúa"}</button>
          <button onClick={() => setAbierto((a) => !a)} style={{ background: "transparent", border: "none", color: C.subtle, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{abierto ? "cerrar" : "ajustar"}</button>
          <button onClick={onQuitar} title="No va en el modelo: no lo tienes o no va acá. Sale del patrimonio y de lo que entra al mes; no libera plata, porque no se vende. Se puede volver a incluir." style={{ background: "transparent", border: "none", color: C.subtle, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>quitar</button>
        </div>
      </div>
      {abierto && (
        <div style={{ ...sub, marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Campo l="En qué canasta va"><select value={k} onChange={(e) => onFicha({ canasta: e.target.value })} style={{ ...inputS, width: 150, color: CANASTA_COLOR[k] }}>{["proteccion", "rentas", "crecimiento", "uso"].map((o) => <option key={o} value={o}>{CANASTA_LABEL[o]}</option>)}</select></Campo>
          {!(p.renta > 0) && <Campo l="Rinde al año"><div><input type="number" step={0.5} value={Math.round(p.tasa * 100) / 100} onChange={(e) => onFicha({ tasa: Number(e.target.value) })} style={inp2} /> %</div></Campo>}
          {!(p.renta > 0) && p.tasa > 0 && <Campo l="De eso, te pagan"><div><input type="number" step={10} min={0} max={100} value={p.pagaPct} onChange={(e) => onFicha({ pagaPct: Number(e.target.value) })} style={inp2} /> % (el resto se reinvierte)</div></Campo>}
          <Campo l="Se valoriza al año"><div><input type="number" step={0.5} value={p.valorizacion} onChange={(e) => onFicha({ valorizacion: Number(e.target.value) })} style={inp2} /> %</div></Campo>
          {p.renta > 0 && <div style={{ ...F.caption, flex: "1 1 220px" }}>Lo que te paga no sale de un porcentaje: está cargado como ingreso en Ingresos. Cámbialo allá.</div>}
        </div>
      )}
    </div>
  );
}

// ─── Paso 1 · Hoy ────────────────────────────────────────────────────────────
function PasoHoy({ base, fichas, onFichas, onNext }) {
  const c = base.canastasHoy, b = base.base, hoy = base.hoy || {};
  const entra = (b?.ia || 0) + (b?.ip || 0), sale = base.gastosMes, queda = entra - sale, cob = sale > 0 ? (entra / sale) * 100 : 0;
  const meses = sale > 0 ? c.colchon / sale : 0;
  const setF = (id, patch) => onFichas({ ...fichas, [id]: { ...(fichas[id] || {}), ...patch } });
  // 21-oct-2026 — Arranca ABIERTA. La probé plegada para llegar rápido al
  // camino y Santiago, con razón: "lo que tienes hoy y uno no ve nada
  // listado". El paso se llama así precisamente para mostrarlo; el resumen va
  // encima y la lista se puede cerrar, pero no se esconde de entrada.
  const [revisar, setRevisar] = useState(true);
  // 21-oct-2026 (Santiago: "porque aparece BTG si no lo tengo", "la primera
  // sección es lo que uno tiene hoy"). La tabla mezclaba sus activos con
  // posiciones que esta pantalla INVENTA a partir de ingresos que declaran un
  // capital y una tasa (caminos.js → `soloIngreso`). BTG Pactual, $7.000 M, no
  // está en sus Inversiones: salió de un ingreso. Si el paso 1 es "lo que
  // tengo", no puede inventar lo que tengo: van en su propio bloque, dicho.
  const activos = base.posiciones.filter((p) => !p.soloIngreso);
  const deIngresos = base.posiciones.filter((p) => p.soloIngreso);
  const capDeIngresos = deIngresos.reduce((s2, p) => s2 + p.capital, 0);
  const tiles = [["Entra al mes", fmMes(entra), "trabajo + rentas"], ["Sale al mes", fmMes(sale), "gastos + cuotas"], ["Queda", fmMes(queda), queda >= 0 ? "excedente" : "déficit"], ["Cobertura", pct(cob), "entra ÷ sale"], ["Patrimonio neto", fmM(b?.patrimonioNeto ?? c.total), capDeIngresos > 0 ? `${fmM(c.total)} bruto · ${fmM(capDeIngresos)} viene de ingresos, no de Inversiones` : `${fmM(c.total)} bruto`], ["Colchón", `${Math.round(meses)} meses`, "líquido ÷ gastos"]];
  const vivos = activos.filter((p) => !p.sale);
  const tot = vivos.reduce((s, p) => { const x = produce(p); return { recibe: s.recibe + x.recibe, crece: s.crece + x.crece }; }, { recibe: 0, crece: 0 });
  const totIng = deIngresos.filter((p) => !p.sale).reduce((s2, p) => s2 + produce(p).recibe, 0);
  const salen = base.posiciones.filter((p) => p.sale);
  const capFuera = (base.fuera || []).reduce((s2, q) => ({ n: s2.n + 1, capital: s2.capital + q.capital }), { n: 0, capital: 0 });
  const inp = { ...inputS, padding: "4px 6px", fontSize: 12, width: 64, textAlign: "right" };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>1 · Hoy: qué tienes, qué produce y qué sigue en el plan</div>
        <div style={{ ...F.body, marginTop: 4 }}>Este es tu punto de partida: <b style={{ color: C.text }}>qué tienes</b>, <b style={{ color: C.text }}>cuánto vale</b>, <b style={{ color: C.text }}>cuánto te renta</b> y <b style={{ color: C.text }}>hasta cuándo</b>. Ya clasificamos cada cosa según lo que produce — revisa que esté bien y corrige lo que no cuadre.</div>
        <div style={{ ...F.body, marginTop: 8 }}>Acá haces una sola cosa: decir <b style={{ color: C.text }}>qué continúa</b> y <b style={{ color: C.text }}>qué sale para reconvertir</b>. Lo que sale se vende, y esa plata te queda <b style={{ color: C.text }}>a favor</b>: con ella pagas deudas o reinviertes, y eliges en qué más adelante. Si algo no va en el modelo —no es tuyo, está repetido, no lo tienes— lo <b style={{ color: C.text }}>quitas</b>: eso no se vende, simplemente deja de contar. Lo que decidas aquí vale para todos los escenarios.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 14 }}>
          {tiles.map(([l, v, d]) => <div key={l} style={sub}><div style={F.label}>{l}</div><div style={{ ...F.monoLg, color: C.text, marginTop: 2 }}>{v}</div><div style={F.caption}>{d}</div></div>)}
        </div>
        <div style={{ marginTop: 14 }}><BarraCanastas c={c} alto={16} /></div>
        {/* 21-oct-2026 — La palabra "canasta" se usaba sin definirse nunca: la
            definición vivía solo en el comentario de cabecera de caminos.js.
            Es la segunda vez que pasa (el 3-ago, con las de Tu Norte) y la
            solución de entonces fue la misma: una línea por canasta, donde ya
            está la palabra. Van en orden de propósito, que es lo que las
            explica: primero no perder, después vivir, después crecer. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 10 }}>{["proteccion", "rentas", "crecimiento", "uso"].map((k) => <div key={k} style={{ borderLeft: `3px solid ${CANASTA_COLOR[k]}`, paddingLeft: 8 }}>
          <div style={{ ...F.caption }}><b style={{ color: C.text }}>{CANASTA_LABEL[k]}</b> · {fmM(c[k])}</div>
          <div style={{ ...F.caption, marginTop: 1 }}>{CANASTA_CORTO[k]}</div>
          {/* 22-oct-2026 (Santiago: "¿cómo sabe uno qué cabe en rentas?",
              "¿rentas es qué, inversiones que van de X a tanto por ciento?").
              No se decide por el porcentaje: se decide por lo que la plata
              HACE, que es la regla real de `canastaDe`. Así que va la pregunta
              que la decide, y un ejemplo, para no tener que adivinar. */}
          <div style={{ ...F.caption, marginTop: 4, color: CANASTA_COLOR[k] }}>{CANASTA_PRUEBA[k]}</div>
          <div style={{ ...F.caption, marginTop: 1 }}>{CANASTA_EJEMPLOS[k]}</div>
        </div>)}</div>
        <div style={{ ...F.caption, marginTop: 8 }}>No se decide por cuánto rinde, sino por lo que hace tu plata: si te la deposita cada mes, <b style={{ color: C.text }}>te paga</b>; si se queda adentro multiplicándose, <b style={{ color: C.text }}>crece</b>. Las tres primeras son papeles que cumple tu plata; <b style={{ color: C.text }}>Uso</b> es el resto: no está mal tenerlo, está mal no saber cuánto pesa.</div>
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={F.h3}>Tus activos</div>
            <div style={{ ...F.body, marginTop: 2 }}>
              Valen <b style={{ color: C.text }}>{fmM(vivos.reduce((s2, q) => s2 + q.capital, 0) + capDeIngresos)}</b> y te pagan <b style={{ color: C.ok }}>{fmMes(tot.recibe + totIng)}</b> al mes.
              {" "}Adentro se queda <b style={{ color: C.warn }}>{fmMes(tot.crece)}</b> al mes, que se reinvierte o se valoriza y no entra a la cuenta.
              {capDeIngresos > 0 && <> {deIngresos.length} {deIngresos.length === 1 ? "viene" : "vienen"} de un ingreso y no {deIngresos.length === 1 ? "está" : "están"} en Inversiones.</>}
            </div>
          </div>
          <button onClick={() => setRevisar((r) => !r)} style={btn(!revisar)}>{revisar ? "Ocultar la lista" : `Revisar mis ${base.posiciones.length} activos`}</button>
        </div>
        {revisar && <div style={{ marginTop: 6 }}>
          <div style={{ ...F.caption, marginBottom: 2 }}>De cada uno decides una cosa: si <b style={{ color: C.text }}>continúa</b> tal como está, o si va <b style={{ color: C.text }}>para reconvertir</b> — lo vendes y esa plata queda a favor para pagar deudas o reinvertir. No dice cuándo lo vendes: el plan cuenta esa plata disponible desde el arranque. Lo demás ya está calculado — si algo no cuadra, "ajustar"; si algo no va en el modelo, "quitar".</div>
          {[...base.posiciones].sort((a, b2) => b2.capital - a.capital).map((q) => <FilaActivo key={q.id} p={q} onFicha={(patch) => setF(q.id, patch)} onQuitar={() => setF(q.id, { estado: "fuera" })} />)}
        </div>}
        {/* Lo quitado no se esconde: se dice, con su plata, y se puede
            devolver. Un ítem que desaparece sin rastro es un patrimonio que
            bajó sin explicación. */}
        {capFuera.n > 0 && <div style={{ ...sub, marginTop: 10, borderColor: C.border }}>
          <div style={F.label}>Fuera del modelo · {capFuera.n} {capFuera.n === 1 ? "cosa" : "cosas"} · {fmM(capFuera.capital)}</div>
          <div style={{ ...F.caption, marginTop: 2 }}>No cuentan en ningún escenario: no suman al patrimonio, no rentan y no liberan plata (no se venden, no los tienes). Tus datos en Patrimonio e Ingresos quedaron intactos.</div>
          <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
            {base.fuera.map((q) => <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${C.border}`, paddingTop: 5 }}>
              <span style={{ ...F.caption, color: C.muted }}>{q.nombre} · {fmM(q.capital)}{q.soloIngreso ? " · venía de un ingreso, no de Inversiones" : ""}</span>
              <button style={{ ...btn(false), padding: "3px 10px" }} onClick={() => setF(q.id, { estado: "continua" })}>volver a incluir</button>
            </div>)}
          </div>
        </div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 14 }}>
        {base.deudas.length > 0 && <div style={card}>
          <div style={F.h3}>Deudas</div>
          <div style={{ ...F.caption, marginBottom: 8 }}>Marca las que pagas con ese saldo a favor. Lo que pagues deja de costarte cuota cada mes.</div>
          <div style={{ display: "grid", gap: 6 }}>{base.deudas.map((d) => <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderTop: `1px solid ${C.border}`, paddingTop: 6, flexWrap: "wrap" }}><input type="checkbox" checked={!!d.pagar} onChange={(e) => setF(`deu_${d.id}`, { pagar: e.target.checked })} /><span style={{ ...F.caption, color: C.text }}>{d.nombre}</span><span style={F.caption}>{fmM(d.saldo)} · {d.tasa}% · cuota {fmMes(d.cuota)}</span>{d.tasa >= 18 && <span style={chip(C.danger)}>cara</span>}{d.pagar && <span style={chip(C.ok)}>se paga hoy</span>}</label>)}</div>
        </div>}
        <div style={{ ...card, borderColor: salen.length ? C.accent : C.border }}>
          <div style={F.h3}>Lo que decides acá vale para todos los escenarios</div>
          {salen.length === 0 && capFuera.n === 0 && !base.deudas.some((d) => d.pagar) ? <div style={{ ...F.body, marginTop: 6 }}>Todo continúa tal como está. Si algo va a salir (un inmueble que vendes, un lote quieto), márcalo arriba como <b style={{ color: C.text }}>Para reconvertir</b>.</div> : (
            <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
              {capFuera.n > 0 && <div style={F.body}>Fuera del modelo: <b style={{ color: C.text }}>{base.fuera.map((q) => q.nombre).join(", ")}</b> → {fmM(capFuera.capital)} que dejan de contar (no se venden).</div>}
              {salen.length > 0 && <div style={F.body}>Para reconvertir: <b style={{ color: C.text }}>{salen.map((p) => p.nombre).join(", ")}</b> → liberas <b style={{ color: C.text }}>{fmM(hoy.liberado)}</b>{hoy.costoVentaPct > 0 ? ` (neto de ${hoy.costoVentaPct}% de costos de venta)` : ""}.</div>}
              {hoy.pagado > 0 && <div style={F.body}>Se paga: <b style={{ color: C.text }}>{base.deudas.filter((d) => d.pagar).map((d) => d.nombre).join(", ")}</b> → <b style={{ color: C.text }}>{fmM(hoy.pagado)}</b>, y dejas de pagar {fmMes(hoy.cuotasQueSalen)} de cuotas al mes.</div>}
              <div style={{ ...F.body, color: hoy.porDesplegar >= 0 ? C.ok : C.danger }}>Te queda <b>{fmM(hoy.porDesplegar)}</b> a favor para reinvertir. En qué lo pones se decide en el paso 3.</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, ...F.caption }}>Costos de venta (comisión, impuestos)<input type="number" step={0.5} min={0} max={30} value={fichas.__costoVentaPct ?? 0} onChange={(e) => onFichas({ ...fichas, __costoVentaPct: Number(e.target.value) })} style={inp} />% de lo vendido</div>
        </div>
      </div>
      <Siguiente onClick={onNext}>Siguiente: lo que ya viene</Siguiente>
    </div>
  );
}

// ─── Editor de un movimiento (evento) ────────────────────────────────────────
// 21-oct-2026 (Santiago, armando la lógica de la sección: "qué viene nuevo y
// cuándo… y qué valor y cuánto renta"). Eran ocho opciones planas, con
// vocabulario del motor ("flujo inicia ingreso"), y la que venía
// preseleccionada no era la que uno piensa primero. Se agrupan en los tres
// tiempos de la sección —viene / ya no va / cambia— y arranca en "compro
// algo", que es el caso que la gente trae en la cabeza.
const GRUPOS_MOV = [
  { g: "Viene algo nuevo", items: [
    { v: "comprar", l: "Compro algo (casa, bodega, lote)" },
    { v: "flujo_inicia_ingreso", l: "Empieza a entrar plata (pensión, renta, contrato)" },
    { v: "flujo_inicia_gasto", l: "Empieza un gasto (colegio, arriendo)" },
  ] },
  { g: "Ya no va", items: [
    { v: "vender", l: "Vendo un activo" },
    { v: "flujo_termina", l: "Se acaba un ingreso o un gasto" },
  ] },
  { g: "Cambia algo que ya tengo", items: [
    { v: "flujo_cambia", l: "Un ingreso o gasto pasa a otro monto" },
    { v: "aportar", l: "Muevo capital a una inversión" },
    { v: "revaluar", l: "Un activo pasa a valer otra cosa (obra, avalúo)" },
  ] },
];
function describirMov(m, posiciones, flujos) {
  const p = posiciones.find((x) => x.id === m.posicionId)?.nombre || m.posicionId;
  const a = `Año ${anioDe(m.mes)}${m.mes % 12 ? `, mes ${(m.mes % 12) + 1}` : ""}`;
  switch (m.tipo) {
    case "vender": return `${a}: vendes ${p}`;
    case "comprar": return `${a}: compras ${m.nombre} por ${fmM(m.costo)}${m.renta ? `, renta ${fmMes(m.renta)}/mes${m.rentaDesde ? ` desde ${m.rentaDesde} meses después` : ""}` : ""}`;
    case "aportar": return `${a}: mueves ${fmM(m.monto)} a ${p}`;
    case "revaluar": return `${a}: ${p} pasa a valer ${fmM(m.valor)}`;
    case "flujo_inicia": return `${a}: ${m.flujo?.tipo === "gasto" ? "entra el gasto" : "entra"} ${m.flujo?.nombre}, ${fmMes(m.flujo?.monto)}/mes`;
    case "flujo_termina": return `${a}: termina ${flujos.find((f) => f.id === m.flujoId)?.nombre || m.flujoId}`;
    case "flujo_cambia": return `${a}: ${flujos.find((f) => f.id === m.flujoId)?.nombre || m.flujoId} pasa a ${fmMes(m.monto)}/mes`;
    case "valorizacion_cambia": return `${a}: ${m.nombre || p} pasa a valorizar ${pctEs(m.valorizacion)} al año`;
    default: return `${a}: ${m.tipo}`;
  }
}
function EditorMovimiento({ posiciones, flujos, onAgregar, onCerrar, ejemplo }) {
  // 22-oct-2026 (Santiago: "agregue en lo de que pasa despues y puse construir
  // una casa pero no me deja poner cuanto se valoriza por primer ano y cuanto
  // cada ano en adelante… si uno construye o compra casa en planos hay una
  // valorizacion superior y luego cada ano. Esto es importante si estamos
  // proyectando cuanto crece el patrimonio"). La compra traia la valorizacion
  // clavada en 5% para siempre. Ahora son dos tramos, que es como se comporta
  // de verdad: el salto de la obra o de los planos, y el ritmo normal despues.
  const [f, setF] = useState({ tipo: "comprar", cuando: 12, posicionId: posiciones[0]?.id || "", nombre: "", monto: "", canasta: "rentas", renta: "", rentaDesde: 0, flujoId: flujos[0]?.id || "", origenId: posiciones[0]?.id || "", val1: 5, valN: 5, tramo: 12 });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const mes = Math.max(0, Number(f.cuando) || 0);
  const guardar = () => {
    const base = { id: "mv_" + Math.random().toString(36).slice(2, 8), mes };
    const monto = Number(f.monto) || 0; let m = null;
    if (f.tipo === "vender") m = { ...base, tipo: "vender", posicionId: f.posicionId };
    if (f.tipo === "comprar" && f.nombre && monto > 0) m = { ...base, tipo: "comprar", nombre: f.nombre, costo: monto, bolsillo: f.canasta === "crecimiento" ? "crecimiento" : f.canasta === "rentas" ? "sustento" : "uso", pagaPct: f.canasta === "rentas" ? 100 : 0, valorizacion: Number(f.val1) || 0, origen: [{ posicionId: f.origenId }], renta: Number(f.renta) > 0 ? Number(f.renta) : undefined, rentaDesde: Number(f.rentaDesde) || 0 };
    if (f.tipo === "aportar" && monto > 0) m = { ...base, tipo: "aportar", posicionId: f.posicionId, monto, origen: [{ posicionId: f.origenId }] };
    if (f.tipo === "revaluar" && monto > 0) m = { ...base, tipo: "revaluar", posicionId: f.posicionId, valor: monto };
    if ((f.tipo === "flujo_inicia_ingreso" || f.tipo === "flujo_inicia_gasto") && f.nombre && monto > 0) m = { ...base, tipo: "flujo_inicia", flujo: { id: base.id + "_f", nombre: f.nombre, tipo: f.tipo.endsWith("gasto") ? "gasto" : "ingreso", monto, indexa: true } };
    if (f.tipo === "flujo_termina") m = { ...base, tipo: "flujo_termina", flujoId: f.flujoId };
    if (f.tipo === "flujo_cambia" && monto >= 0) m = { ...base, tipo: "flujo_cambia", flujoId: f.flujoId, monto };
    if (!m) return;
    const extras = [];
    // El segundo tramo de la valorización es un movimiento aparte: el motor ya
    // sabe cambiarle la valorización a una posición (`valorizacion_cambia`), y
    // la posición que crea la compra lleva el id del movimiento.
    if (f.tipo === "comprar" && Number(f.valN) !== Number(f.val1)) extras.push({ id: base.id + "_v", mes: mes + Math.max(1, Number(f.tramo) || 12), tipo: "valorizacion_cambia", posicionId: base.id, nombre: f.nombre, valorizacion: Number(f.valN) || 0 });
    onAgregar([m, ...extras]);
    onCerrar();
  };
  const selPos = (k) => <select value={f[k]} onChange={(e) => set(k, e.target.value)} style={inputS}>{posiciones.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {fmM(p.capital)}</option>)}</select>;
  const esFlujo = f.tipo.startsWith("flujo_inicia") || f.tipo === "flujo_cambia";
  return (
    <div style={{ ...sub, display: "grid", gap: 10 }}>
      {ejemplo && <div style={F.caption}>{ejemplo}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", columnGap: 10, rowGap: 22, alignItems: "end" }}>
        <Campo l="Qué pasa" style={{ gridColumn: "1 / -1" }}><select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} style={inputS}>{GRUPOS_MOV.map((g) => <optgroup key={g.g} label={g.g}>{g.items.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</optgroup>)}</select></Campo>
        <Campo l="Cuándo" style={{ gridColumn: "span 2" }}><div style={{ paddingTop: 4 }}><Cuando mes={f.cuando} onChange={(v) => set("cuando", v)} /></div></Campo>
        {(f.tipo === "vender" || f.tipo === "aportar" || f.tipo === "revaluar") && <Campo l={f.tipo === "aportar" ? "Destino" : "Activo"}>{selPos("posicionId")}</Campo>}
        {(f.tipo === "comprar" || f.tipo.startsWith("flujo_inicia")) && <Campo l="Nombre"><input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} style={inputS} placeholder={f.tipo === "comprar" ? "Bodega, finca, apartamento…" : "Pensión, arriendo bodega, colegio…"} /></Campo>}
        {(f.tipo === "flujo_termina" || f.tipo === "flujo_cambia") && <Campo l="Cuál"><select value={f.flujoId} onChange={(e) => set("flujoId", e.target.value)} style={inputS}>{flujos.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {fmMes(x.monto)}</option>)}</select></Campo>}
        {f.tipo !== "vender" && f.tipo !== "flujo_termina" && <Campo l={esFlujo ? "Cuánto al mes (pesos)" : f.tipo === "revaluar" ? "Nuevo valor (pesos)" : f.tipo === "comprar" ? "Cuánto vale (pesos)" : "Monto (pesos)"}><NumPesos value={f.monto} onChange={(v) => set("monto", v)} /></Campo>}
        {f.tipo === "comprar" && <Campo l="Para qué"><select value={f.canasta} onChange={(e) => set("canasta", e.target.value)} style={inputS}><option value="rentas">Rentar (paga cada mes)</option><option value="proteccion">Vivir ahí</option><option value="crecimiento">Crecimiento</option><option value="uso">Uso</option></select></Campo>}
        {f.tipo === "comprar" && <><Campo l="Se valoriza el primer tramo (% al año)"><Num value={f.val1} step={0.5} onChange={(v) => set("val1", v)} suffix="%" /></Campo>
        <Campo l="Ese tramo dura (meses)"><Num value={f.tramo} min={1} max={120} onChange={(v) => set("tramo", v)} /></Campo>
        <Campo l="Y de ahí en adelante (% al año)"><Num value={f.valN} step={0.5} onChange={(v) => set("valN", v)} suffix="%" /></Campo>
        <div style={{ ...F.caption, gridColumn: "1 / -1" }}>En planos o en obra la valorización del principio suele ser mayor: pon ahí el salto (por ejemplo 20% mientras se construye, 12 meses) y después el ritmo normal (5% al año).</div></>}
        {f.tipo === "comprar" && f.canasta === "rentas" && <><Campo l="Cuánto renta al mes (pesos)"><NumPesos value={f.renta} onChange={(v) => set("renta", v)} /></Campo><Campo l="Empieza a rentar (meses después)"><Num value={f.rentaDesde} min={0} onChange={(v) => set("rentaDesde", v)} /></Campo></>}
        {(f.tipo === "comprar" || f.tipo === "aportar") && <Campo l="Con plata de">{selPos("origenId")}</Campo>}
      </div>
      <div style={{ display: "flex", gap: 8 }}><button style={btn(true)} onClick={guardar}>Agregar</button><button style={btn(false)} onClick={onCerrar}>Cancelar</button></div>
    </div>
  );
}
function ListaEventos({ eventos, posiciones, flujos, onChange, ejemplo, vacio }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      {eventos.length === 0 && !abierto && <div style={{ ...F.body, fontStyle: "italic" }}>{vacio}</div>}
      {eventos.length > 0 && <div style={{ display: "grid", gap: 6 }}>{[...eventos].sort((a, b) => a.mes - b.mes).map((m) => <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, ...F.body, color: C.text }}><span>· {describirMov(m, posiciones, flujos)}{m.plantilla && <span style={{ ...chip(C.subtle), marginLeft: 6 }}>plantilla</span>}</span><button style={{ ...btn(false), padding: "3px 10px", color: C.subtle }} onClick={() => onChange(eventos.filter((x) => x.id !== m.id))}>quitar</button></div>)}</div>}
      {abierto ? <div style={{ marginTop: 10 }}><EditorMovimiento posiciones={posiciones} flujos={flujos} ejemplo={ejemplo} onAgregar={(m) => onChange([...eventos, ...(Array.isArray(m) ? m : [m])])} onCerrar={() => setAbierto(false)} /></div> : <div style={{ marginTop: 10 }}><button style={btn(false)} onClick={() => setAbierto(true)}>+ Agregar</button></div>}
    </div>
  );
}

// ─── Paso 3 · Qué viene nuevo ───────────────────────────────────────────────────
// Una fila por ingreso o gasto de hoy: sigue igual · termina en… · cambia a… desde…
function FilaFlujo({ f, eventos, onChange }) {
  const ev = eventos.find((e) => e.flujoId === f.id && (e.tipo === "flujo_termina" || e.tipo === "flujo_cambia"));
  const estado = ev ? ev.tipo : "sigue";
  const setEv = (patch) => {
    const otros = eventos.filter((e) => e !== ev);
    if (patch.estado === "sigue") return onChange(otros);
    const tipo = patch.estado || estado;
    const mes = patch.mes ?? ev?.mes ?? 12;
    const nuevo = { id: ev?.id || "fx_" + Math.random().toString(36).slice(2, 8), mes, tipo: tipo === "sigue" ? "flujo_termina" : tipo, flujoId: f.id, monto: tipo === "flujo_cambia" ? (patch.monto ?? ev?.monto ?? f.monto) : undefined };
    onChange([...otros, nuevo]);
  };
  const esIng = f.tipo === "ingreso";
  const selS = { ...inputS, padding: "4px 6px", fontSize: 11, width: 130, color: estado === "sigue" ? C.ok : estado === "flujo_termina" ? C.danger : C.warn };
  return (
    <tr style={{ borderTop: `1px solid ${C.border}`, opacity: estado === "flujo_termina" ? 0.75 : 1 }}>
      <td style={td}>{f.nombre}<div style={F.caption}>{esIng ? (f.trabajo ? "ingreso de trabajo" : f.posicionId ? "renta de un activo" : "ingreso") : "gasto"}</div></td>
      <td style={{ ...tdNum, color: esIng ? C.ok : C.danger }}>{fmMes(f.monto)}</td>
      <td style={td}><select value={estado} onChange={(e) => setEv({ estado: e.target.value })} style={selS}><option value="sigue">Sigue igual</option><option value="flujo_termina">Termina en…</option><option value="flujo_cambia">Cambia a…</option></select></td>
      <td style={td}>{estado !== "sigue" && <div style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption, flexWrap: "wrap" }}>
        {estado === "flujo_cambia" && <><NumPesos value={ev?.monto ?? f.monto} onChange={(v) => setEv({ monto: v || 0 })} w={140} /><span>al mes, desde</span></>}
        <Cuando mes={ev?.mes ?? 12} onChange={(mes) => setEv({ mes })} compacto />
      </div>}</td>
    </tr>
  );
}

function PasoViene({ base, perfil, onPerfil, onNext }) {
  const set = (k, v) => onPerfil({ ...perfil, [k]: v });
  const pens = perfil.pensiones || [];
  const setPens = (lista) => set("pensiones", lista);
  const eventos = perfil.eventos || [];
  const [supuestos, setSupuestos] = useState(false);
  const ingresos = base.flujos.filter((f) => f.tipo === "ingreso").sort((a, b) => b.monto - a.monto);
  const gastos = base.flujos.filter((f) => f.tipo === "gasto").sort((a, b) => b.monto - a.monto);
  const nuevos = eventos.filter((e) => e.tipo !== "flujo_termina" && e.tipo !== "flujo_cambia");
  const setNuevos = (lista) => set("eventos", [...eventos.filter((e) => e.tipo === "flujo_termina" || e.tipo === "flujo_cambia"), ...lista]);
  const setCambios = (lista) => set("eventos", [...nuevos, ...lista]);
  const cambios = eventos.filter((e) => e.tipo === "flujo_termina" || e.tipo === "flujo_cambia");
  const deudasVivas = base.deudas.filter((d) => !d.pagar);
  const mesesDeuda = (d) => { const i = d.tasa / 100 / 12; if (d.cuota <= d.saldo * i) return null; return Math.ceil(Math.log(d.cuota / (d.cuota - d.saldo * i)) / Math.log(1 + i)); };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>Y qué se viene: lo que llega solo, pase lo que pase</div>
        <div style={{ ...F.body, marginTop: 4 }}>Aquí está listado lo que tienes hoy. Sobre cada cosa decide si <b style={{ color: C.text }}>sigue igual</b>, <b style={{ color: C.text }}>termina</b> (el contrato, el colegio) o <b style={{ color: C.text }}>cambia</b> de monto desde un año. Abajo agregas lo nuevo que llega seguro: la pensión en el año 4, la bodega que renta desde el año 2. Todo esto entra en todos los escenarios; lo opcional lo decides en cada uno.</div>
      </div>
      <div style={card}>
        <div style={F.h3}>Tus ingresos de hoy</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Ingreso</th><th style={{ ...th, textAlign: "right" }}>Hoy al mes</th><th style={th}>En el futuro</th><th style={th}>Cuándo / cuánto</th></tr></thead>
            <tbody>{ingresos.map((f) => <FilaFlujo key={f.id} f={f} eventos={cambios} onChange={setCambios} />)}
            {ingresos.length === 0 && <tr><td colSpan={4} style={{ ...td, color: C.subtle, fontStyle: "italic" }}>Sin ingresos cargados.</td></tr>}</tbody>
          </table>
        </div>
        <div style={{ ...F.caption, marginTop: 6 }}>Las rentas de los activos que salen del plan (paso 1) terminan solas al venderse.</div>
      </div>
      <div style={card}>
        <div style={F.h3}>Tus gastos de hoy</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Gasto</th><th style={{ ...th, textAlign: "right" }}>Hoy al mes</th><th style={th}>En el futuro</th><th style={th}>Cuándo / cuánto</th></tr></thead>
            <tbody>{gastos.map((f) => <FilaFlujo key={f.id} f={f} eventos={cambios} onChange={setCambios} />)}</tbody>
          </table>
        </div>
        {deudasVivas.length > 0 && <div style={{ marginTop: 12 }}>
          <div style={F.label}>Cuotas de deuda (terminan solas cuando se paga el saldo)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>{deudasVivas.map((d) => { const n = mesesDeuda(d); return <div key={d.id} style={{ ...sub, padding: "6px 10px", ...F.caption }}><b style={{ color: C.text }}>{d.nombre}</b> · {fmMes(d.cuota)}/mes · {n == null ? "la cuota no cubre el interés" : n > 120 ? "más de 10 años" : `termina en el año ${Math.ceil(n / 12)}`}</div>; })}</div>
        </div>}
      </div>
      <div style={card}>
        <div style={F.h3}>Lo nuevo que llega seguro</div>
        <div style={{ ...sub, marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div><div style={F.h3}>Pensiones</div><div style={F.caption}>Cuándo llega cada una y de cuánto.</div></div><button style={btn(false)} onClick={() => setPens([...pens, { nombre: `Pensión ${pens.length + 1}`, mes: 48, monto: 3e6 }])}>+ Pensión</button></div>
          {pens.map((p, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", columnGap: 8, rowGap: 22, marginTop: 10, alignItems: "end" }}>
            <Campo l="De quién / cuál"><input value={p.nombre} onChange={(e) => setPens(pens.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} style={inputS} /></Campo>
            <Campo l="Desde cuándo"><div style={{ paddingTop: 4 }}><Cuando mes={p.mes} onChange={(mes) => setPens(pens.map((x, k) => (k === i ? { ...x, mes } : x)))} compacto /></div></Campo>
            <Campo l="Al mes (pesos)"><NumPesos value={p.monto} onChange={(v) => setPens(pens.map((x, k) => (k === i ? { ...x, monto: v || 0 } : x)))} /></Campo>
            <button style={{ ...btn(false), color: C.subtle }} onClick={() => setPens(pens.filter((_, k) => k !== i))}>quitar</button>
          </div>)}
          {pens.length === 0 && <div style={{ ...F.body, marginTop: 8, fontStyle: "italic" }}>Sin pensiones todavía.</div>}
        </div>
        <div style={{ ...sub, marginTop: 10 }}>
          <div style={F.h3}>Otros ingresos, gastos o compras ya decididas</div>
          <div style={{ ...F.caption, marginBottom: 8 }}>La bodega que empieza a rentar en el año 2, el gasto nuevo, la obra que se termina, la compra que ya está cerrada.</div>
          <ListaEventos eventos={nuevos} posiciones={base.posiciones} flujos={base.flujos} onChange={setNuevos} vacio="Nada nuevo todavía. Ejemplo: «Año 2: entra Arriendo bodega, $8.000.000/mes»." ejemplo="Ejemplo: la bodega empieza a rentar en el año 2 → «Entra un ingreso nuevo», año 2, Arriendo bodega, 8.000.000." />
        </div>
      </div>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><div><div style={F.h3}>Supuestos</div><div style={F.caption}>Inflación {perfil.inflacion}% · crecimiento {perfil.tasaCrecimiento}% · renta estable {perfil.tasaRentaEstable}% · BTC {perfil.tasaBtc}% · inmuebles {perfil.valorizacionInmueble}% · cobertura mínima {perfil.coberturaMin}%</div></div><button style={btn(false)} onClick={() => setSupuestos((v) => !v)}>{supuestos ? "Cerrar" : "Cambiar"}</button></div>
        {supuestos && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
          <Campo l="Inflación anual"><Num value={perfil.inflacion} step={0.5} onChange={(v) => set("inflacion", v)} suffix="%" /></Campo>
          <Campo l="Crecimiento (bolsa, ETF)"><Num value={perfil.tasaCrecimiento} step={0.5} onChange={(v) => set("tasaCrecimiento", v)} suffix="%" /></Campo>
          <Campo l="Renta estable (CDT)"><Num value={perfil.tasaRentaEstable} step={0.5} onChange={(v) => set("tasaRentaEstable", v)} suffix="%" /></Campo>
          <Campo l="Bitcoin"><Num value={perfil.tasaBtc} step={1} onChange={(v) => set("tasaBtc", v)} suffix="%" /></Campo>
          <Campo l="Valorización inmuebles"><Num value={perfil.valorizacionInmueble} step={0.5} onChange={(v) => set("valorizacionInmueble", v)} suffix="%" /></Campo>
          <Campo l="Valorización lotes"><Num value={perfil.valorizacionLote} step={0.5} onChange={(v) => set("valorizacionLote", v)} suffix="%" /></Campo>
          <Campo l="Arriendo si vives arrendado (% del valor al mes)"><Num value={perfil.arriendoPctMensual} step={0.1} onChange={(v) => set("arriendoPctMensual", v)} suffix="%" /></Campo>
          <Campo l="Cobertura mínima"><Num value={perfil.coberturaMin} step={5} onChange={(v) => set("coberturaMin", v)} suffix="%" /></Campo>
        </div>}
      </div>
      <Siguiente onClick={onNext}>Siguiente: construye tu escenario</Siguiente>
    </div>
  );
}


// ─── Paso 2 · Qué quieres que pase ───────────────────────────────────────────
// 21-oct-2026. Santiago: "en ese proceso debería existir ¿qué quieres que
// pase? quieres seguridad, quieres renta, quieres crecer patrimonio", "algo
// que ayude a construir el escenario".
//
// Las tres plantillas ya armaban el escenario entero con los datos de la
// persona (caminos.js → escenarioDesdeCamino), pero vivían como tres botones
// que decían "Seguridad / Balance / Crecimiento" sin explicar nada, perdidos
// entre los controles del paso siguiente. Son la PRIMERA pregunta, y la
// respuesta construye el escenario en vez de solo ponerle nombre.
//
// Y cierra el vocabulario: seguridad, renta y crecimiento son las mismas tres
// palabras con las que la app clasifica dónde está tu plata (las canastas).
const INTENCIONES = {
  seguridad: { titulo: "Más protección", frase: "Que pase lo que pase, la vida esté pagada: colchón grande, vivienda propia y la mayor parte pagándote cada mes." },
  balance: { titulo: "Más renta", frase: "Que la plata te pague cada mes, con una quinta parte creciendo para no quedarte atrás." },
  crecimiento: { titulo: "Más crecimiento", frase: "Que la mitad esté multiplicándose, sin quedarte sin con qué vivir: un tercio te sigue pagando." },
};
/** La mezcla a la que apunta: las tres canastas, siempre las tres. */
function haciaDonde(esc) {
  const o = esc.objetivo;
  const l = [];
  if (o) l.push(`${o.proteccion}% protegido · ${o.rentas}% pagándote · ${o.crecimiento}% creciendo`);
  if (esc.canastas?.colchonMeses) l.push(`colchón de ${esc.canastas.colchonMeses} meses`);
  return l.join(" · ");
}
/** Qué hace esa intención con las cosas de ESTA persona, en una línea. */
function queHace(esc, base) {
  const partes = [];
  const ventas = esc.ventas || [];
  if (ventas.length) {
    const monto = ventas.reduce((t, v) => { const p = base.posiciones.find((x) => x.id === v.posicionId); return t + (v.monto != null ? v.monto : p?.capital || 0); }, 0);
    partes.push(`vendes ${ventas.length} ${ventas.length === 1 ? "cosa" : "cosas"} (${fmM(monto)})`);
  }
  if ((esc.pagos || []).length) partes.push(`pagas ${esc.pagos.length} ${esc.pagos.length === 1 ? "deuda" : "deudas"}`);
  if ((esc.despliegue || []).length) partes.push(`${esc.despliegue.length} ${esc.despliegue.length === 1 ? "destino" : "destinos"} para la plata`);
  const exc = esc.excedente || [];
  const cre = exc.find((e) => e.canasta === "crecimiento")?.pct ?? 0;
  partes.push(`lo que sobra cada mes: ${100 - cre}% a lo que te paga · ${cre}% a lo que crece`);
  // 22-oct-2026 — Antes acá decía "vende 6 cosas ($1,6 mil M)" aunque la
  // persona no hubiera decidido nada: lo había decidido la plantilla.
  return ventas.length || (esc.pagos || []).length || (esc.despliegue || []).length ? partes.join(" · ") : `nada decidido todavía · ${partes[partes.length - 1]}`;
}
function PasoIntencion({ todos, res, base, activoId, setActivoId, onNuevo, onNext }) {
  const hoy = base?.base?.patrimonioNeto ?? 0;
  const c = base.canastasHoy;
  const tot = c.total || 1;
  const plantillas = todos.filter((e) => INTENCIONES[e.id]);
  const propios = todos.filter((e) => !INTENCIONES[e.id]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>2 · Hoy estás aquí. ¿Qué quieres proyectar?</div>
        <div style={{ ...F.body, marginTop: 4 }}>Proyectar es mover tus activos de un papel a otro: más protección, más renta o más crecimiento. Elige hacia dónde y te armo el escenario con <b style={{ color: C.text }}>tus</b> cosas — qué vender, qué deuda pagar y a dónde mandar lo que sobre. Después lo cambias todo lo que quieras.</div>
        <div style={{ marginTop: 14 }}><div style={F.label}>Dónde está tu plata hoy</div><div style={{ marginTop: 6 }}><BarraCanastas c={c} alto={16} /></div></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>{["proteccion", "rentas", "crecimiento", "uso"].map((k) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption }}><span style={{ width: 8, height: 8, borderRadius: 999, background: CANASTA_COLOR[k] }} /><b style={{ color: C.text }}>{CANASTA_LABEL[k]}</b> {pct((c[k] / tot) * 100)} · {fmM(c[k])}</div>)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 14 }}>
        {plantillas.map((e) => {
          const r = res.find((x) => x.id === e.id);
          const sel = e.id === activoId;
          const d = r ? r.puntos.patrimonioFinal - hoy : 0;
          return (
            <div key={e.id} style={{ ...card, borderColor: sel ? e.color : C.border, borderWidth: sel ? 2 : 1 }}>
              <div style={{ ...F.h3, color: e.color }}>{INTENCIONES[e.id].titulo}</div>
              <div style={{ ...F.body, marginTop: 6, minHeight: 58 }}>{INTENCIONES[e.id].frase}</div>
              <div style={{ ...sub, marginTop: 10 }}>
                <div style={F.label}>Hacia dónde mueve tu plata</div>
                <div style={{ ...F.caption, color: C.text, marginTop: 2 }}>{haciaDonde(e)}</div>
                <div style={{ ...F.label, marginTop: 8 }}>Con lo tuyo</div>
                <div style={{ ...F.caption, color: C.text, marginTop: 2 }}>{queHace(e, base)}</div>
              </div>
              {r && <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <div><div style={F.label}>Año 10 <Imposible p={r.puntos} compacto /></div><div style={{ ...F.monoLg, color: C.text }}>{fmM(r.puntos.patrimonioFinal)}</div><div style={{ ...F.caption, color: d >= 0 ? C.ok : C.danger }}>{d >= 0 ? "+" : "−"}{fmM(Math.abs(d))}</div></div>
                <div><div style={F.label}>Queda al mes</div><div style={{ ...F.monoLg, color: r.puntos.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(r.puntos.quedaMes)}</div><div style={F.caption}>en el año 10</div></div>
              </div>}
              <button style={{ ...btn(sel), width: "100%", marginTop: 12 }} onClick={() => { setActivoId(e.id); onNext(); }}>{sel ? "Seguir con este →" : "Proyectar esto →"}</button>
            </div>
          );
        })}
      </div>
      <div style={{ ...card, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={F.caption}>¿Ninguna es lo tuyo?</span>
        <button style={btn(false)} onClick={() => { onNuevo(); onNext(); }}>Armarlo yo desde cero</button>
        {propios.map((e) => <button key={e.id} style={btn(e.id === activoId)} onClick={() => { setActivoId(e.id); onNext(); }}>Seguir con «{e.nombre}»</button>)}
      </div>
    </div>
  );
}

// ─── Paso 3 · Qué vendes y qué compras ───────────────────────────────────────────────────
function ResultadoVivo({ r, base, onElegir, elegido, onVer, onComparar }) {
  const p = r.puntos, ok = r.vigilancia.cumple;
  const data = [{ a: 0, v: p.patrimonioInicial }, ...r.resultado.anual.map((x) => ({ a: x.anio, v: x.patrimonioFin }))];
  return (
    <div style={{ ...card, borderColor: r.color }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={F.h3}>Resultado en vivo</div><span style={chip(ok ? C.ok : C.danger)}>{ok ? "se cumple" : `se rompe · año ${r.vigilancia.roturas[0].anio}`}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div><div style={F.label}>Patrimonio año 10</div><div style={{ ...F.monoLg, color: C.text }}>{fmM(p.patrimonioFinal)}</div><Imposible p={p} /><div style={F.caption}>{fmM(p.patrimonioFinalReal)} de hoy</div></div>
        <div><div style={F.label}>Queda al mes · año 10</div><div style={{ ...F.monoLg, color: p.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(p.quedaMes)}</div><div style={F.caption}>cobertura {pct(p.cobertura)}</div></div>
        <div><div style={F.label}>Entra / sale · año 10</div><div style={{ ...F.caption, color: C.text }}>{fmMes(p.entraMes)} / {fmMes(p.saleMes)}</div></div>
        <div><div style={F.label}>Mes más apretado</div><div style={{ ...F.caption, color: p.seSostiene ? C.text : C.danger }}>{p.mesApretado ? `año ${anioDe(p.mesApretado.mes)} · ${pct(p.mesApretado.cobertura)}` : "—"}</div></div>
      </div>
      <div style={{ height: 110, marginTop: 10 }}>
        <ResponsiveContainer><LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}><XAxis dataKey="a" {...axisProps} tickFormatter={(a) => (a === 0 ? "hoy" : a)} /><YAxis hide domain={["auto", "auto"]} /><Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} labelFormatter={(a) => (a === 0 ? "Hoy" : `Año ${a}`)} />} /><Line type="monotone" dataKey="v" name="Patrimonio" stroke={r.color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 4 }}>{narrar(r, base).slice(1, 4).map((t, i) => <div key={i} style={{ ...F.caption, color: C.muted }}>{t}</div>)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button style={{ ...btn(false), flex: 1 }} onClick={onVer}>Ver completo →</button><button style={{ ...btn(false), flex: 1 }} onClick={onComparar}>Comparar →</button></div>
      {!elegido && <div style={{ marginTop: 8 }}><button style={{ ...btn(true), width: "100%" }} onClick={onElegir}>Elegir este camino</button></div>}
      {elegido && <div style={{ marginTop: 8, textAlign: "center" }}><span style={chip(C.accent)}>Tu camino</span></div>}
    </div>
  );
}
// 22-oct-2026 (Santiago: "paso a paso bien claro", "si yo soy el desarrollador
// de la plataforma y lo veo dificil, no me imagino alguien nuevo", "esto tiene
// que ser muy intuitivo"). El paso 3 mostraba DIEZ bloques de una sola vez
// —nombre, que vendes, deudas, donde va la plata, que pasa despues, excedente,
// y encima los ingresos, gastos, pensiones y supuestos—. Nadie lee eso: se
// lee lo primero y se abandona.
//
// Ahora es UNA pregunta por pantalla, en el orden en que el lo conto: "revise
// que sale y que continua, con los saldos puede pagar deudas o reinvertir,
// elija en que desea reinvertir". Y arriba, siempre visible, el hilo de la
// plata: cuanto liberas, cuanto pagas, cuanto te queda. Nadie se pierde
// porque en cada pantalla solo hay una cosa que contestar.
function PasoEscenario({ base, perfil, todos, res, activoId, setActivoId, onGuardar, onNuevo, onDuplicar, onRestablecer, onBorrar, caminoElegido, onElegir, onNext, onComparar, sub, setSub }) {
  const ancho = useAncho();
  const esc = todos.find((e) => e.id === activoId) || todos[0];
  const r = res.find((x) => x.id === esc?.id);
  if (!esc || !r) return null;
  const upd = (patch) => onGuardar({ ...esc, ...patch });
  const liq = liquidezEscenario(base, esc);
  const ventaDe = (id) => (esc.ventas || []).find((v) => v.posicionId === id);
  const toggleVenta = (p) => { const v = ventaDe(p.id); upd({ ventas: v ? esc.ventas.filter((x) => x.posicionId !== p.id) : [...(esc.ventas || []), { posicionId: p.id, monto: null }] }); };
  const parcial = (p, monto) => upd({ ventas: esc.ventas.map((x) => (x.posicionId === p.id ? { ...x, monto: monto === "" || monto == null ? null : Math.min(monto, p.capital) } : x)) });
  const togglePago = (id) => upd({ pagos: (esc.pagos || []).includes(id) ? esc.pagos.filter((x) => x !== id) : [...(esc.pagos || []), id] });
  const setD = (id, patch) => upd({ despliegue: esc.despliegue.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const addD = (destinoId) => { const p = destinoId ? base.posiciones.find((x) => x.id === destinoId) : null; upd({ despliegue: [...(esc.despliegue || []), p ? { id: "d_" + Math.random().toString(36).slice(2, 8), destinoId: p.id, nombre: p.nombre, canasta: canastaDe(p), capital: Math.max(0, liq.porAsignar), tasa: p.tasa, pagaPct: p.pagaPct, valorizacion: p.valorizacion, regla: p.pagaPct === 100 ? "Paga el 100% del rendimiento cada mes" : "Todo se reinvierte" } : { id: "d_" + Math.random().toString(36).slice(2, 8), destinoId: null, nombre: "Nueva inversión", canasta: "rentas", capital: Math.max(0, liq.porAsignar), tasa: perfil.tasaRentaEstable, pagaPct: 100, valorizacion: 0, regla: "Paga el 100% del rendimiento cada mes" }] }); };
  const crecPct = (esc.excedente || []).find((e) => e.canasta === "crecimiento")?.pct ?? 50;
  const destinosPosibles = base.posiciones.filter((p) => !p.vivienda && !p.vehiculo && !(ventaDe(p.id) && ventaDe(p.id).monto == null));
  const dos = ancho >= 980;
  const H = ({ n, t, d }) => <div style={{ marginBottom: 8 }}><div style={F.h3}><span style={{ color: esc.color }}>{n}</span> {t}</div>{d && <div style={F.caption}>{d}</div>}</div>;
  // 22-oct-2026 (Santiago, perdido en el paso D: "esa sección a dónde va la
  // plata y con qué regla?… aparece rapciredit socio con una inversión de 11
  // mil que no sé ni de dónde salió… no entiendo"). Su propia frase es el
  // arreglo: "de los ítems que quitó en la sección anterior tiene un saldo a
  // favor de XXXX, ¿en qué va a invertir ese saldo?". El saldo era un pie de
  // tabla en letra chica; ahora es la pregunta, con la cuenta en palabras.
  const Saldo = () => <div style={{ display: "flex", flexWrap: "wrap", gap: 12, ...F.caption, alignItems: "center" }}><span>Liberas <b style={{ color: C.text }}>{fmM(liq.liberado)}</b></span><span>− pagas <b style={{ color: C.text }}>{fmM(liq.pagado)}</b></span><span>− asignas <b style={{ color: C.text }}>{fmM(liq.asignado)}</b></span><span style={chip(Math.abs(liq.porAsignar) < 1e6 ? C.ok : liq.porAsignar > 0 ? C.warn : C.danger)}>{Math.abs(liq.porAsignar) < 1e6 ? "todo asignado" : liq.porAsignar > 0 ? `queda sin poner ${fmM(liq.porAsignar)}` : `te pasaste por ${fmM(-liq.porAsignar)}`}</span></div>;
  const posDe = (id) => base.posiciones.find((x) => x.id === id);
  const queda = liq.liberado - liq.pagado;
  const vendidos = [...base.posiciones.filter((p) => p.sale), ...(esc.ventas || []).map((v) => posDe(v.posicionId)).filter((p) => p && !p.sale)];
  const pagadas = [...base.deudas.filter((d) => d.pagar), ...(esc.pagos || []).map((id) => base.deudas.find((d) => d.id === id)).filter((d) => d && !d.pagar)];
  const deLaPlantilla = !!esc.plantilla && !esc.editado;
  const camino = CAMINOS_BASE.find((c) => c.id === esc.plantilla);
  const proponer = () => { if (camino) onGuardar(proponerDesdeCamino(base, camino, esc, perfil)); };
  const [verNombre, setVerNombre] = useState(false);
  const SUBS = [
    { n: 1, t: "¿Qué vendes o transformas?", c: "Lo que sale se vende y te deja plata a favor." },
    ...(base.deudas.length > 0 ? [{ n: 2, t: "¿Qué deudas pagas con eso?", c: "Lo que pagues deja de costarte cuota." }] : []),
    { n: 3, t: "¿En qué reinviertes lo que queda?", c: "A dónde va cada peso y con qué regla." },
    { n: 4, t: "¿Qué más va a pasar?", c: "Lo que viene después y qué haces con lo que sobra cada mes." },
  ];
  const iSub = Math.max(0, SUBS.findIndex((x) => x.n === sub));
  const irSub = (n) => { setSub(n); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } };
  const Hilo = () => (
    <div style={{ ...card, borderColor: esc.color, padding: "14px 16px" }}>
      <div style={F.label}>Tu plata en este escenario</div>
      <div style={{ ...F.body, marginTop: 4 }}>
        {liq.liberado > 0 ? <>Vendes <b style={{ color: C.text }}>{fmM(liq.liberado)}</b></> : <>Todavía no vendes nada</>}
        {liq.pagado > 0 && <> · pagas deudas por <b style={{ color: C.text }}>{fmM(liq.pagado)}</b></>}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginTop: 4 }}>
        <div style={{ ...F.monoLg, color: queda > 0 ? C.ok : C.muted }}>Te queda {fmM(queda)}</div>
        {liq.asignado > 0 && <div style={F.caption}>ya pusiste {fmM(liq.asignado)}</div>}
        <span style={chip(Math.abs(liq.porAsignar) < 1e6 ? C.ok : liq.porAsignar > 0 ? C.warn : C.danger)}>{Math.abs(liq.porAsignar) < 1e6 ? "todo puesto" : liq.porAsignar > 0 ? `sin poner ${fmM(liq.porAsignar)}` : `te pasaste por ${fmM(-liq.porAsignar)}`}</span>
      </div>
    </div>
  );
  const SubPasos = () => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${SUBS.length}, minmax(0, 1fr))`, gap: 6 }}>
      {SUBS.map((x, k) => { const on = x.n === sub, hecho = k < iSub; return (
        <button key={x.n} onClick={() => irSub(x.n)} style={{ background: on ? `${esc.color}20` : C.surface, border: `1px solid ${on ? esc.color : C.border}`, borderRadius: 12, padding: "8px 10px", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
          <div style={{ ...F.label, color: on ? esc.color : hecho ? C.ok : C.subtle }}>{hecho ? "✓" : k + 1} de {SUBS.length}</div>
          <div style={{ ...F.caption, color: on ? C.text : C.muted, marginTop: 2 }}>{x.t}</div>
        </button>); })}
    </div>
  );
  const Pies = () => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {iSub > 0 ? <button style={btn(false)} onClick={() => irSub(SUBS[iSub - 1].n)}>← {SUBS[iSub - 1].t}</button> : <span />}
      {iSub < SUBS.length - 1 ? <button style={btn(true)} onClick={() => irSub(SUBS[iSub + 1].n)}>{SUBS[iSub + 1].t} →</button> : <button style={btn(true)} onClick={onNext}>Ver mi camino a 10 años →</button>}
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>3 · Qué cambios vas a hacer</div>
        <div style={{ ...F.body, marginTop: 4 }}>Un escenario es una decisión concreta: qué vendes, qué pagas, a dónde va cada peso y con qué regla, y qué haces después.</div>
        {/* 22-oct-2026 (Santiago: "no sé por qué se hicieron también los
            escenarios de seguridad, balance y otro que ni siquiera he
            trabajado", "¿y cómo puedo editar mis escenarios?"). Aparecían
            tres escenarios con nombre propio sin decir nunca que los arma
            FINPATHIA con sus datos, ni que el resaltado es el que se edita. */}
        <div style={{ ...F.caption, marginTop: 6 }}><b style={{ color: C.text }}>Seguridad</b>, <b style={{ color: C.text }}>Balance</b> y <b style={{ color: C.text }}>Crecimiento</b> no los creaste tú: los arma FINPATHIA con tus datos, como tres puntos de partida. Toca el que quieras para <b style={{ color: C.text }}>verlo y editarlo</b> — lo que cambies se guarda solo y ese escenario pasa a ser tuyo (puedes devolverlo a la plantilla cuando quieras). «+ Nuevo desde cero» arranca uno en blanco.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
          {todos.map((e) => { const rr = res.find((x) => x.id === e.id); return <button key={e.id} onClick={() => setActivoId(e.id)} style={{ ...btn(false), borderColor: e.id === esc.id ? e.color : C.borderStrong, background: e.id === esc.id ? `${e.color}20` : "transparent", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: e.color }} />{e.nombre}{caminoElegido === e.id && " ★"}{rr && !rr.vigilancia.cumple && <span style={{ color: C.danger }}>!</span>}</button>; })}
          <button style={btn(false)} onClick={onNuevo}>+ Nuevo desde cero</button>
          <button style={btn(false)} onClick={() => onDuplicar(esc)}>Duplicar este</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <span style={F.caption}>Estás editando <b style={{ color: esc.color }}>{esc.nombre}</b>. Cuando quieras:</span>
          <button style={btn(false)} onClick={() => setVerNombre((v) => !v)}>{verNombre ? "Cerrar nombre" : "✎ Nombre y tesis"}</button>
          <button style={btn(true)} onClick={onNext}>Ver mi camino a 10 años →</button>
          <button style={btn(false)} onClick={onComparar}>Comparar todos los caminos →</button>
        </div>
      </div>
      <Hilo />
      <SubPasos />
      <div style={{ display: "grid", gridTemplateColumns: dos ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          {verNombre && (
          <div style={card}>
            <H n="A" t="Nombre y tesis" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <Campo l="Nombre"><input value={esc.nombre} onChange={(e) => upd({ nombre: e.target.value })} style={inputS} /></Campo>
              <Campo l="Tesis (una frase)"><input value={esc.tesis || ""} onChange={(e) => upd({ tesis: e.target.value })} style={inputS} placeholder="Qué persigue este escenario" /></Campo>
            </div>
            {esc.plantilla && <div style={{ ...F.caption, marginTop: 8 }}>Plantilla {CAMINOS_BASE.find((c) => c.id === esc.plantilla)?.nombre}: {CAMINOS_BASE.find((c) => c.id === esc.plantilla)?.tesis} {esc.editado && <button style={{ ...btn(false), padding: "2px 8px", marginLeft: 6 }} onClick={() => onRestablecer(esc)}>Restablecer plantilla</button>}</div>}
          </div>
          )}
          {sub === 1 && (
          <div style={card}>
            <H n="B" t="¿Qué vendes o transformas hoy?" d="Marca lo que sale. Puedes vender todo o solo una parte." />
            <div style={{ display: "grid", gap: 6 }}>
              {base.posiciones.filter((p) => p.sale).map((p) => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 6, opacity: 0.7 }}><input type="checkbox" checked disabled /><span style={{ ...F.caption, color: C.text }}>{p.nombre}</span><span style={F.caption}>{fmM(p.capital)}</span><span style={chip(C.accent)}>para reconvertir · paso 1</span></div>)}
              {base.posiciones.filter((p) => !p.sale).sort((a, b) => b.capital - a.capital).map((p) => { const v = ventaDe(p.id); return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 6, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, cursor: "pointer" }}><input type="checkbox" checked={!!v} onChange={() => toggleVenta(p)} /><span style={{ ...F.caption, color: C.text }}>{p.nombre}</span><span style={F.caption}>{fmM(p.capital)}{p.vivienda ? " · vivienda" : ""}{p.renta > 0 ? ` · renta ${fmMes(p.renta)}` : ""}</span></label>
                  {v && <div style={{ display: "flex", alignItems: "center", gap: 6, ...F.caption }}><span>{v.monto == null ? "todo · o solo" : "solo"}</span><NumPesos value={v.monto == null ? "" : v.monto} onChange={(x) => parcial(p, x)} w={150} placeholder="una parte" /></div>}
                </div>); })}
            </div>
            <div style={{ marginTop: 10 }}><Saldo /></div>
          </div>
          )}
          {sub === 2 && base.deudas.length > 0 && <div style={card}>
            <H n="C" t="¿Qué deudas pagas con eso?" d="Lo que pagues deja de costar cuota cada mes." />
            <div style={{ display: "grid", gap: 6 }}>{base.deudas.map((d) => <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: d.pagar ? "default" : "pointer", borderTop: `1px solid ${C.border}`, paddingTop: 6, opacity: d.pagar ? 0.7 : 1, flexWrap: "wrap" }}><input type="checkbox" checked={d.pagar || (esc.pagos || []).includes(d.id)} disabled={d.pagar} onChange={() => togglePago(d.id)} /><span style={{ ...F.caption, color: C.text }}>{d.nombre}</span><span style={F.caption}>{fmM(d.saldo)} · {d.tasa}% · cuota {fmMes(d.cuota)}</span>{d.tasa >= 18 && <span style={chip(C.danger)}>cara</span>}{d.pagar && <span style={chip(C.accent)}>se paga · paso 1</span>}</label>)}</div>
          </div>}
          {sub === 3 && (
          <div style={card}>
            <H n="D" t="¿En qué inviertes lo que te queda?" d="Cada fila es un destino y cuánta plata le metes. Lo que escribes es plata que ENTRA ahí, no lo que ese activo vale." />
            <div style={{ ...sub, marginBottom: 10 }}>
              <div style={F.body}>
                {vendidos.length > 0 ? <>Vendes <b style={{ color: C.text }}>{vendidos.map((p) => p.nombre).join(", ")}</b> y liberas <b style={{ color: C.text }}>{fmM(liq.liberado)}</b>. </> : <>Hoy no sale nada del plan, así que no hay plata liberada. </>}
                {liq.pagado > 0 && <>Pagando <b style={{ color: C.text }}>{pagadas.map((d) => d.nombre).join(", ")}</b> se van <b style={{ color: C.text }}>{fmM(liq.pagado)}</b>. </>}
                {queda > 0 && <>Te queda <b style={{ color: C.ok }}>{fmM(queda)}</b> a favor: <b style={{ color: C.text }}>¿en qué lo pones?</b></>}
              </div>
              {esc.objetivo && <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <div style={F.label}>La mezcla a la que apuntas</div>
                <div style={{ ...F.body, marginTop: 2 }}>
                  <b style={{ color: CANASTA_COLOR.proteccion }}>{esc.objetivo.proteccion}% protegido</b> · <b style={{ color: CANASTA_COLOR.rentas }}>{esc.objetivo.rentas}% pagándote cada mes</b> · <b style={{ color: CANASTA_COLOR.crecimiento }}>{esc.objetivo.crecimiento}% creciendo</b>
                </div>
                <div style={{ ...F.caption, marginTop: 2 }}>Es una meta, no una orden: tú decides con qué llegar. {camino && "Si quieres, te propongo un reparto y lo ajustas."}</div>
                {camino && <div style={{ marginTop: 8 }}><button style={btn(false)} onClick={proponer}>Proponme un reparto para esta mezcla →</button></div>}
              </div>}
              {deLaPlantilla && (esc.despliegue || []).length > 0 && <div style={{ ...F.caption, marginTop: 6 }}>Los destinos de abajo no los pusiste tú: los propuso la plantilla <b style={{ color: esc.color }}>{esc.nombre}</b> para cumplir su regla, y son activos que ya tienes. Cámbialos, quítalos o agrega otros — en cuanto toques algo, el escenario pasa a ser tuyo.</div>}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead><tr><th style={th}>Destino</th><th style={th}>Canasta</th><th style={{ ...th, textAlign: "right" }}>Cuánto le metes</th><th style={{ ...th, textAlign: "right" }}>Tasa</th><th style={{ ...th, textAlign: "right" }}>Recibes</th><th style={{ ...th, textAlign: "right" }}>Valoriza</th><th style={th}>Regla</th><th style={th} /></tr></thead>
                <tbody>
                  {(esc.despliegue || []).map((d) => <tr key={d.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ ...td, minWidth: 150 }}>{d.destinoId ? <span>{d.nombre}<div style={F.caption}>ya lo tienes · vale {fmM(posDe(d.destinoId)?.capital || 0)} hoy</div></span> : <input value={d.nombre} onChange={(e) => setD(d.id, { nombre: e.target.value })} style={{ ...inputS, padding: "4px 6px", fontSize: 12 }} />}</td>
                    <td style={td}>{d.destinoId ? <span style={chip(CANASTA_COLOR[d.canasta])}>{CANASTA_LABEL[d.canasta]}</span> : <select value={d.canasta} onChange={(e) => setD(d.id, { canasta: e.target.value, pagaPct: e.target.value === "rentas" ? 100 : 0, tasa: e.target.value === "crecimiento" ? perfil.tasaCrecimiento : e.target.value === "rentas" ? perfil.tasaRentaEstable : 0, regla: e.target.value === "rentas" ? "Paga el 100% del rendimiento cada mes" : e.target.value === "crecimiento" ? "Todo se reinvierte" : "" })} style={{ ...inputS, padding: "4px 6px", fontSize: 11, width: 130, color: CANASTA_COLOR[d.canasta], borderColor: CANASTA_COLOR[d.canasta], fontWeight: 600 }}>{["rentas", "crecimiento", "proteccion", "uso"].map((o) => <option key={o} value={o}>{CANASTA_LABEL[o]}</option>)}</select>}</td>
                    <td style={tdNum}><NumPesos value={d.capital} onChange={(v) => setD(d.id, { capital: v || 0 })} w={150} /></td>
                    <td style={tdNum}><Num value={d.tasa} step={0.5} onChange={(v) => setD(d.id, { tasa: v || 0 })} suffix="%" w={80} /></td>
                    <td style={tdNum}><Num value={d.pagaPct} step={10} min={0} max={100} onChange={(v) => setD(d.id, { pagaPct: v || 0, regla: v >= 100 ? "Paga el 100% del rendimiento cada mes" : v <= 0 ? "Todo se reinvierte" : `Recibe el ${v}%, reinvierte el resto` })} suffix="%" w={80} /></td>
                    <td style={tdNum}><Num value={d.valorizacion} step={0.5} onChange={(v) => setD(d.id, { valorizacion: v || 0 })} suffix="%" w={80} /></td>
                    <td style={{ ...td, minWidth: 180 }}><input value={d.regla || ""} onChange={(e) => setD(d.id, { regla: e.target.value })} style={{ ...inputS, padding: "4px 6px", fontSize: 11 }} placeholder="Regla" /></td>
                    <td style={td}><button style={{ ...btn(false), padding: "3px 8px", color: C.subtle }} onClick={() => upd({ despliegue: esc.despliegue.filter((x) => x.id !== d.id) })}>quitar</button></td>
                  </tr>)}
                  {(esc.despliegue || []).length === 0 && <tr><td colSpan={8} style={{ ...td, color: C.subtle, fontStyle: "italic" }}>Nada desplegado: lo liberado se quedaría en caja sin rendir.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
              <select value="" onChange={(e) => { if (e.target.value) addD(e.target.value === "__nueva" ? null : e.target.value); }} style={{ ...inputS, width: "auto", minWidth: 220 }}>
                <option value="">+ Agregar destino…</option>
                <option value="__nueva">Nueva inversión (la defines tú)</option>
                {destinosPosibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {CANASTA_LABEL[canastaDe(p)]} · {p.tasa > 0 ? `${p.tasa}%` : "sin tasa"}</option>)}
              </select>
              <Saldo />
            </div>
          </div>
          )}
          {sub === 4 && (
          <div style={card}>
            <H n="E" t="¿Qué pasa después, en este escenario?" d="Lo que decides para los próximos años: compras, ventas, obras, gastos que entran. (Lo seguro ya está en el paso 2.)" />
            <ListaEventos eventos={esc.eventos || []} posiciones={[...base.posiciones, ...(esc.despliegue || []).filter((d) => !d.destinoId).map((d) => ({ id: d.id, nombre: d.nombre, capital: d.capital }))]} flujos={base.flujos} onChange={(l) => upd({ eventos: l })} vacio="Nada después todavía. Ejemplo: «Año 5: compras Casa finca por 900 M con plata del Fondo»." ejemplo="Ejemplo: en el año 5 compras una casa de 900 M con la plata del fondo." />
          </div>
          )}
          {sub === 4 && (
          <div style={card}>
            <H n="F" t="¿Y lo que te sobre cada mes?" d="Mes a mes te queda un excedente. Decide a dónde va y cuántos meses de gastos guardas en líquido." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, alignItems: "end" }}>
              <div><div style={F.label}>{100 - crecPct}% a lo que te paga · {crecPct}% a lo que crece</div><input type="range" min={0} max={100} step={5} value={crecPct} onChange={(e) => { const v = Number(e.target.value); upd({ excedente: [{ canasta: "rentas", pct: 100 - v }, { canasta: "crecimiento", pct: v }] }); }} style={{ width: "100%" }} /></div>
              <Campo l="Colchón líquido (meses de gastos)"><Num value={esc.colchonMeses} min={0} max={60} onChange={(v) => upd({ colchonMeses: v })} /></Campo>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ ...F.caption, cursor: "pointer" }}>Reglas que este escenario se obliga a cumplir (opcional)</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 10 }}>
                <Campo l="Rentas mín."><Num value={esc.canastas?.rentas?.min ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), rentas: { ...(esc.canastas?.rentas || {}), min: v === "" ? undefined : v } } })} suffix="%" /></Campo>
                <Campo l="Crecimiento mín."><Num value={esc.canastas?.crecimiento?.min ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), crecimiento: { ...(esc.canastas?.crecimiento || {}), min: v === "" ? undefined : v } } })} suffix="%" /></Campo>
                <Campo l="Crecimiento máx."><Num value={esc.canastas?.crecimiento?.max ?? ""} onChange={(v) => upd({ canastas: { ...(esc.canastas || {}), crecimiento: { ...(esc.canastas?.crecimiento || {}), max: v === "" ? undefined : v } } })} suffix="%" /></Campo>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{Object.entries(CONDICION_LABEL).map(([id, l]) => <label key={id} style={{ ...F.caption, color: C.muted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={(esc.condiciones || []).includes(id)} onChange={() => { const s = new Set(esc.condiciones || []); s.has(id) ? s.delete(id) : s.add(id); upd({ condiciones: [...s] }); }} />{l}</label>)}</div>
            </details>
          </div>
          )}
          <Pies />
          {esc.propio && <div><button style={{ ...btn(false), color: C.danger, borderColor: C.danger }} onClick={() => onBorrar(esc)}>Borrar escenario</button></div>}
        </div>
        <div style={{ position: dos ? "sticky" : "static", top: 12 }}><ResultadoVivo r={r} base={base} elegido={caminoElegido === esc.id} onElegir={() => onElegir(esc.id)} onVer={onNext} onComparar={onComparar} /></div>
      </div>
    </div>
  );
}

// ─── Mes a mes: ¿alcanza para vivir? ─────────────────────────────────────────
// 22-oct-2026 (Santiago: "no veo tampoco la grafica que muestra que va pasando
// en los 10 anos"… y, mostrando una: "esto es super potente"). Las graficas que
// habia dibujaban PATRIMONIO, que es un saldo y no responde la pregunta con la
// que uno vive: ¿lo que entra cada mes alcanza para lo que sale? Esta la
// responde de un vistazo: mientras la linea de color va por encima de la
// punteada, el plan se sostiene solo, y la franja es lo que sobra.
function GraficaMesAMes({ r }) {
  const meses = r.resultado?.meses || [];
  if (meses.length === 0) return null;
  const datos = meses.map((m) => ({ mes: m.mes, entra: Math.round(m.entra), sale: Math.round(m.sale) }));
  // Los hitos que de verdad mueven la linea; si son muchos, los mas separados.
  const hitos = (r.resultado.log || []).filter((l) => l.mes > 0).reduce((acc, l) => { const ya = acc.find((x) => Math.abs(x.mes - l.mes) < 4); if (ya) { if (!ya.texto.includes(l.texto)) ya.texto += ` + ${l.texto}`; return acc; } acc.push({ mes: l.mes, texto: l.texto }); return acc; }, []).slice(0, 7);
  const ap = r.puntos?.mesApretado;
  const ticks = []; for (let a = 0; a <= meses.length; a += 12) ticks.push(a);
  return (
    <div style={card}>
      <div style={F.h3}>Mes a mes: ¿alcanza para vivir?</div>
      <div style={{ ...F.caption, marginTop: 2 }}>
        <b style={{ color: r.color }}>Línea de color</b>: lo que entra cada mes (rentas, arriendos, pensiones). <b style={{ color: C.danger }}>Línea punteada</b>: lo que sale para vivir (gastos y cuotas). <b style={{ color: C.ok }}>Franja</b>: lo que sobra ese mes. Mientras la línea de color vaya por encima de la punteada, el plan se sostiene solo.
      </div>
      <div style={{ height: 300, marginTop: 14 }}>
        <ResponsiveContainer>
          <ComposedChart data={datos} margin={{ top: 26, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} ticks={ticks} tickFormatter={(m) => (m === 0 ? "hoy" : `año ${m / 12}`)} />
            <YAxis {...axisProps} width={64} tickFormatter={(v) => fmMes(v).replace("$", "")} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmMes(v)} labelFormatter={(m) => (m === 0 ? "Hoy" : `Año ${anioDe(m)}, mes ${(m % 12) + 1}`)} />} />
            <Area type="stepAfter" dataKey={(x) => [Math.min(x.entra, x.sale), x.entra]} name="Sobra" stroke="none" fill={C.ok} fillOpacity={0.16} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="entra" name="Entra" stroke={r.color} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="stepAfter" dataKey="sale" name="Sale" stroke={C.danger} strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            {hitos.map((h) => <ReferenceLine key={h.mes} x={h.mes} stroke={C.borderStrong} strokeDasharray="3 3" label={{ value: h.texto.length > 34 ? h.texto.slice(0, 32) + "…" : h.texto, position: "top", fontSize: 10, fill: C.subtle }} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {ap && <div style={{ ...F.caption, marginTop: 6 }}>Mes más apretado: <b style={{ color: C.text }}>año {anioDe(ap.mes)}</b>, cobertura {pct(ap.cobertura)} — {ap.cobertura >= 100 ? "aun así alcanza" : "ahí no alcanza y toca sacar de capital"}.</div>}
    </div>
  );
}

// ─── Paso 4 · Tu camino a 10 años ───────────────────────────────────────────────────
function PasoResultado({ base, r, elegido, onElegir, onNext, onVolver }) {
  if (!r) return null;
  const p = r.puntos;
  const eventos = [...r.cfg.movimientos].filter((m) => m.mes > 0 || m.tipo === "flujo_inicia" || m.tipo === "comprar").sort((a, b) => a.mes - b.mes);
  const fmtCambio = (t) => t.replace(/(\d{6,})\/mes/g, (_, n) => fmMes(Number(n)) + "/mes").replace(/\b(\d{6,})\b/g, (_, n) => fmM(Number(n)));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...card, borderColor: r.color }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }} /><span style={F.h1}>{r.nombre}</span>{elegido && <span style={chip(C.accent)}>Tu camino</span>}<span style={chip(r.vigilancia.cumple ? C.ok : C.danger)}>{r.vigilancia.cumple ? "se cumple" : `se rompe · año ${r.vigilancia.roturas[0].anio}`}</span></div>
          <div style={{ display: "flex", gap: 8 }}><button style={btn(false)} onClick={onVolver}>← Editar</button>{!elegido && <button style={btn(true)} onClick={onElegir}>Elegir este camino</button>}</div>
        </div>
        {r.tesis && <div style={{ ...F.body, marginTop: 6, fontStyle: "italic" }}>{r.tesis}</div>}
        <div style={{ ...sub, marginTop: 12 }}><div style={F.h3}>Así se cuenta este escenario</div>{narrar(r, base).map((t, i) => <div key={i} style={{ ...F.body, color: C.text, marginTop: 6 }}>{t}</div>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 12 }}>
          {[["Patrimonio año 10", fmM(p.patrimonioFinal), `${fmM(p.patrimonioFinalReal)} de hoy`], ["Crece al año (real)", p.crecimientoRealAnual == null ? "—" : p.crecimientoRealAnual.toFixed(1).replace(".", ",") + "%", "descontando inflación"], ["Entra · año 10", fmMes(p.entraMes), "al mes"], ["Sale · año 10", fmMes(p.saleMes), "gastos + cuotas"], ["Cobertura · año 10", pct(p.cobertura), "entra ÷ sale"], ["Produce al mes", fmMes(p.produceMes), "recibido + reinvertido"], ["Mes más apretado", p.mesApretado ? `año ${anioDe(p.mesApretado.mes)}` : "—", p.mesApretado ? `cobertura ${pct(p.mesApretado.cobertura)}` : ""], ["Si crecimiento rinde menos", fmM(p.estres.patrimonioFinal), `al ${String(Math.round(p.estres.tasa * 10) / 10).replace(".", ",")}%`]].map(([l, v, d]) => <div key={l} style={sub}><div style={F.label}>{l}</div><div style={{ ...F.monoLg, color: C.text, marginTop: 2 }}>{v}</div><div style={F.caption}>{d}</div></div>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 14 }}>
        <div style={card}>
          {/* 22-oct-2026 (Santiago: "si se supone que tengo una inversión de
              rapicredit que me paga 58 MM al mes, que continúa, ¿por qué no la
              veo en el escenario creado? Solo veo los ingresos por ítems
              nuevos"). El resumen contaba solo lo que se MUEVE —vendes, pagas,
              despliegas— y dejaba fuera lo que se queda, que es de donde sale
              la mayor parte de lo que entra cada mes. Un escenario no es solo
              el cambio: es el cambio SOBRE lo que ya tienes. */}
          <div style={F.h3}>Lo que sigue igual y te sigue pagando</div>
          {(() => {
            const siguen = base.posiciones.filter((q) => !q.sale).map((q) => ({ nombre: q.nombre, mes: produce(q).recibe })).filter((q) => q.mes > 0).sort((a, b) => b.mes - a.mes);
            const total = siguen.reduce((t, q) => t + q.mes, 0);
            if (siguen.length === 0) return <div style={{ ...F.body, marginTop: 6 }}>Nada de lo que tienes hoy te paga cada mes.</div>;
            return (<>
              <div style={{ ...F.body, marginTop: 6 }}>No lo tocas y te deja <b style={{ color: C.ok }}>{fmMes(total)}</b> al mes:</div>
              <div style={{ display: "grid", gap: 3, marginTop: 4 }}>{siguen.slice(0, 8).map((q) => <div key={q.nombre} style={F.caption}>· {q.nombre} — <b style={{ color: C.text }}>{fmMes(q.mes)}</b>/mes</div>)}
              {siguen.length > 8 && <div style={F.caption}>· y {siguen.length - 8} más</div>}</div>
            </>);
          })()}
          <div style={{ ...F.h3, marginTop: 14 }}>Y esto es lo que cambia</div>
          {r.ajuste.notas.length ? r.ajuste.notas.map((n, i) => <div key={i} style={{ ...F.body, marginTop: 6 }}>· {n}</div>) : <div style={{ ...F.body, marginTop: 6 }}>Nada cambia hoy: el escenario parte tal como estás.</div>}
          <div style={{ marginTop: 12 }}><div style={F.caption}>Canastas hoy</div><BarraCanastas c={r.canastasHoy} /><div style={{ ...F.caption, marginTop: 8 }}>Canastas año 10</div><BarraCanastas c={r.canastasFin} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>{["proteccion", "rentas", "crecimiento"].map((k) => <div key={k}><div style={{ ...F.label, color: CANASTA_COLOR[k] }}>{CANASTA_LABEL[k]}</div><div style={{ ...F.caption, color: C.text }}>{fmM(r.canastasHoy[k])} → {fmM(r.canastasFin[k])}</div></div>)}</div>
        </div>
        <div style={card}>
          <div style={F.h3}>Lo que pasa en el tiempo</div>
          {eventos.length === 0 && <div style={{ ...F.body, marginTop: 6 }}>Nada programado después de hoy.</div>}
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>{eventos.map((m, i) => <div key={i} style={{ display: "flex", gap: 10, ...F.body, color: C.text }}><span style={{ ...chip(r.color), minWidth: 56, textAlign: "center" }}>año {anioDe(m.mes)}</span><span>{describirMov(m, r.cfg.posiciones, r.cfg.flujos).replace(/^Año \d+(, mes \d+)?: /, "")}</span></div>)}</div>
          {!r.vigilancia.cumple && <div style={{ marginTop: 12 }}><div style={{ ...F.h3, color: C.danger }}>Dónde se rompe</div>{r.vigilancia.roturas.slice(0, 5).map((x, i) => <div key={i} style={{ ...F.body, color: C.danger, marginTop: 4 }}>· Año {x.anio}: {x.detalle}</div>)}</div>}
        </div>
      </div>
      <GraficaMesAMes r={r} />
      <div style={card}>
        <div style={F.h3}>Año a año</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr>{["Año", "Entra/mes", "Sale/mes", "Queda/mes", "Cobertura", "Patrimonio", "Qué pasa"].map((h, i) => <th key={h} style={{ ...th, textAlign: i === 0 || i === 6 ? "left" : "right" }}>{h}</th>)}</tr></thead>
            <tbody>{r.resultado.anual.map((a) => <tr key={a.anio} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>{a.anio}</td><td style={tdNum}>{fmMes(a.entraMes)}</td><td style={tdNum}>{fmMes(a.saleMes)}</td><td style={{ ...tdNum, color: a.quedaMes >= 0 ? C.ok : C.danger }}>{fmMes(a.quedaMes)}</td><td style={tdNum}>{a.cobertura == null ? "—" : pct(a.cobertura)}</td><td style={tdNum}>{fmM(a.patrimonioFin)}</td><td style={{ ...td, color: C.muted, maxWidth: 360 }}>{a.cambios.slice(0, 3).map(fmtCambio).join(" · ")}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <Siguiente onClick={onNext}>Siguiente: compara todos los escenarios</Siguiente>
    </div>
  );
}

// ─── Paso 5 · Compara ────────────────────────────────────────────────────────
function PasoCompara({ res, base, perfil, activoId, onVer, caminoElegido, onElegir }) {
  const data = useMemo(() => { const H = Math.max(...res.map((r) => r.resultado.anual.length)); return Array.from({ length: H + 1 }, (_, a) => { const row = { anio: a }; res.forEach((r) => { row[r.id] = a === 0 ? r.puntos.patrimonioInicial : r.resultado.anual[a - 1]?.patrimonioFin; }); return row; }); }, [res]);
  const hoy = useMemo(() => { const entra = (base.base?.ia || 0) + (base.base?.ip || 0), sale = base.gastosMes; const crece = base.posiciones.reduce((s, p) => s + produce(p).crece, 0); return { entra, sale, queda: entra - sale, cobertura: sale > 0 ? (entra / sale) * 100 : 0, produce: entra + crece }; }, [base]);
  const fila = (l, f, hoyV) => [l, f, hoyV];
  const filas = [
    fila("Ingreso mensual (lo que recibes)", (r) => fmMes(r.puntos.entraMes), hoy && fmMes(hoy.entra)),
    fila("Egresos mensuales (gastos + cuotas)", (r) => fmMes(r.puntos.saleMes), hoy && fmMes(hoy.sale)),
    fila("Excedente mensual", (r) => fmMes(r.puntos.quedaMes), hoy && fmMes(hoy.queda)),
    fila("Cobertura", (r) => pct(r.puntos.cobertura), hoy && pct(hoy.cobertura)),
    fila("Produce al mes (recibido + reinvertido)", (r) => fmMes(r.puntos.produceMes), hoy && fmMes(hoy.produce)),
    fila("Patrimonio año 10", (r) => fmM(r.puntos.patrimonioFinal), fmM(res[0]?.puntos.patrimonioInicial)),
    fila("En plata de hoy", (r) => fmM(r.puntos.patrimonioFinalReal), "—"),
    fila("Crece al año (real)", (r) => (r.puntos.crecimientoRealAnual == null ? "—" : r.puntos.crecimientoRealAnual.toFixed(1).replace(".", ",") + "%"), "—"),
    fila("En rentas (año 10)", (r) => fmM(r.canastasFin.rentas), fmM(base.canastasHoy.rentas)),
    fila("En crecimiento (año 10)", (r) => fmM(r.canastasFin.crecimiento), fmM(base.canastasHoy.crecimiento)),
    fila("Vivienda y colchón (año 10)", (r) => fmM(r.canastasFin.proteccion), fmM(base.canastasHoy.proteccion)),
    fila("Colchón líquido (año 10)", (r) => fmM(r.canastasFin.colchon), fmM(base.canastasHoy.colchon)),
    fila("Mes más apretado", (r) => (r.puntos.mesApretado ? `año ${anioDe(r.puntos.mesApretado.mes)} · ${pct(r.puntos.mesApretado.cobertura)}` : "—"), "—"),
    fila("Meses en rojo", (r) => String(r.puntos.mesesNegativos), "—"),
    fila("Si crecimiento rinde menos", (r) => fmM(r.puntos.estres.patrimonioFinal), "—"),
    fila("Sin la mayor renta", (r) => (r.puntos.sinMayorFuente ? `${pct(r.puntos.sinMayorFuente.cobertura)} · ${r.puntos.sinMayorFuente.seSostiene ? "aguanta" : "no aguanta"}` : "—"), "—"),
    fila("Vendes hoy", (r) => (r.liquidez ? fmM(r.liquidez.liberado) : "—"), "—"),
    fila("Pagas deuda hoy", (r) => (r.liquidez ? fmM(r.liquidez.pagado) : "—"), "—"),
  ];
  const cien = useMemo(() => cienEnCada(base, perfil), [base, perfil]);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={F.h2}>5 · Todos tus caminos, lado a lado</div>
        <div style={{ ...F.caption, marginTop: 2 }}>Los mismos indicadores para cada uno, con hoy como referencia. Toca un nombre para abrirlo.</div>
        <div style={{ height: 260, marginTop: 14 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} /><XAxis dataKey="anio" {...axisProps} tickFormatter={(a) => (a === 0 ? "hoy" : `año ${a}`)} /><YAxis {...axisProps} width={60} tickFormatter={(v) => fmM(v).replace("$", "")} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)} labelFormatter={(a) => (a === 0 ? "Hoy" : `Año ${a}`)} />} /><Legend wrapperStyle={{ fontSize: 11, color: CHART.txt2 }} />
              {res.map((r) => <Line key={r.id} type="monotone" dataKey={r.id} name={r.nombre} stroke={r.color} strokeWidth={r.id === activoId ? 3 : 1.5} dot={false} strokeOpacity={activoId && r.id !== activoId ? 0.55 : 1} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Indicador</th><th style={{ ...th, textAlign: "right" }}>Hoy</th>{res.map((r) => <th key={r.id} onClick={() => onVer(r.id)} style={{ ...th, textAlign: "right", cursor: "pointer", color: r.color, fontSize: 12, textTransform: "none", letterSpacing: 0, borderBottom: r.id === activoId ? `2px solid ${r.color}` : "none" }}>{r.nombre}{caminoElegido === r.id ? " ★" : ""}</th>)}</tr></thead>
            <tbody>
              {filas.map(([l, f, h]) => <tr key={l} style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>{l}</td><td style={{ ...tdNum, color: C.subtle }}>{h || "—"}</td>{res.map((r) => <td key={r.id} style={tdNum}>{f(r)}</td>)}</tr>)}
              <tr style={{ borderTop: `1px solid ${C.border}` }}><td style={{ ...td, color: C.muted }}>Se cumple</td><td style={td} />{res.map((r) => <td key={r.id} style={{ ...td, textAlign: "right" }}><span style={chip(r.vigilancia.cumple ? C.ok : C.danger)}>{r.vigilancia.cumple ? "sí" : `no · año ${r.vigilancia.roturas[0].anio}`}</span></td>)}</tr>
              <tr style={{ borderTop: `1px solid ${C.border}` }}><td style={td} /><td style={td} />{res.map((r) => <td key={r.id} style={{ ...td, textAlign: "right" }}>{caminoElegido === r.id ? <span style={chip(C.accent)}>Tu camino</span> : <button style={{ ...btn(false), padding: "4px 10px" }} onClick={() => onElegir(r.id)}>Elegir</button>}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={card}>
        <div style={F.h3}>$100 M en cada inversión, en igualdad de condiciones</div>
        <div style={F.caption}>Qué serían $100 M a 3, 5 y 10 años en cada tipo de inversión que tienes o podrías tener, con todo reinvertido y neto de impuestos (35% sobre rendimiento pagado, 15% al vender).</div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead><tr><th style={th}>Inversión</th><th style={th}>Supuesto</th><th style={{ ...th, textAlign: "right" }}>3 años</th><th style={{ ...th, textAlign: "right" }}>5 años</th><th style={{ ...th, textAlign: "right" }}>10 años</th><th style={th}>Nota</th></tr></thead>
            <tbody>{cien.map((f) => <tr key={f.inversion} style={{ borderTop: `1px solid ${C.border}` }}><td style={td}>{f.inversion}<div style={F.caption}>{f.grupo}</div></td><td style={{ ...td, color: C.muted }}>{f.supuesto}</td><td style={tdNum}>${Math.round(f.a3)} M</td><td style={tdNum}>${Math.round(f.a5)} M</td><td style={{ ...tdNum, fontWeight: 700 }}>${Math.round(f.a10)} M</td><td style={{ ...td, color: C.muted }}>{f.nota}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────
// `pasoInicial` existe para poder abrir la pantalla en un paso concreto (y para
// que una prueba de humo pueda renderizar los cuatro: el build no atrapa una
// variable sin definir dentro de un paso que no se esta mostrando).
export default function MiPlan({ user, perfil: perfilGuardado, fichas = {}, caminos: guardados = [], caminoElegido, onPerfil, onFichas, onCaminos, onElegir, onNavigate, pasoInicial = 1 }) {
  const perfil = { ...PERFIL_DEFAULT, ...(perfilGuardado || {}) };
  const [paso, setPaso] = useState(pasoInicial);
  const [activoId, setActivoId] = useState(caminoElegido || "balance");
  const base = useMemo(() => { const b = baseDesdeUsuario(user, perfil, fichas); return { ...b, canastasHoy: medirCanastas(b.posiciones, b.caja) }; }, [user, perfilGuardado, fichas]);
  // Plantillas (recalculadas con tus datos de hoy) + las que editaste + las tuyas
  const todos = useMemo(() => {
    const plantillas = CAMINOS_BASE.map((c) => escenarioDesdeCamino(base, c, perfil));
    const porId = Object.fromEntries(guardados.map((g) => [g.id, g]));
    return [...plantillas.map((p) => (porId[p.id] ? { ...p, ...porId[p.id], editado: true } : p)), ...guardados.filter((g) => !plantillas.some((p) => p.id === g.id))];
  }, [base, guardados, perfilGuardado]);
  const res = useMemo(() => compararCaminos(todos, base, perfil), [todos, base, perfilGuardado]);
  const sinDatos = base.posiciones.length === 0 && base.flujos.filter((f) => f.tipo === "ingreso").length === 0;
  const guardar = (esc) => { const limpio = { id: esc.id, nombre: esc.nombre, tesis: esc.tesis, color: esc.color, plantilla: esc.plantilla || null, propio: !!esc.propio, ventas: esc.ventas || [], pagos: esc.pagos || [], despliegue: esc.despliegue || [], eventos: esc.eventos || [], excedente: esc.excedente, colchonMeses: esc.colchonMeses, canastas: esc.canastas || null, condiciones: esc.condiciones || [] }; onCaminos(guardados.some((g) => g.id === esc.id) ? guardados.map((g) => (g.id === esc.id ? limpio : g)) : [...guardados, limpio]); };
  const colorNuevo = () => [CHART.purple, CHART.cyan, CHART.pink, CHART.gold][guardados.filter((g) => g.propio).length % 4];
  const nuevo = () => { const e = escenarioVacio({ nombre: `Mi escenario ${guardados.filter((g) => g.propio).length + 1}`, colchonMeses: 6, color: colorNuevo() }); guardar(e); setActivoId(e.id); };
  const duplicar = (esc) => { const e = { ...esc, id: "esc_" + Math.random().toString(36).slice(2, 8), nombre: `${esc.nombre} (copia)`, plantilla: null, propio: true, color: colorNuevo(), editado: false }; guardar(e); setActivoId(e.id); };
  const restablecer = (esc) => onCaminos(guardados.filter((g) => g.id !== esc.id));
  const borrar = (esc) => { onCaminos(guardados.filter((g) => g.id !== esc.id)); if (caminoElegido === esc.id) onElegir(null); setActivoId("balance"); };
  const rActivo = res.find((r) => r.id === activoId) || res[0];
  // Comparar dejó de ser un paso: es la otra cara del paso 4. Eran cinco
  // casillas en el camino y una no era una pregunta, era una vista.
  const [verCompara, setVerCompara] = useState(false);
  const [sub, setSub] = useState(1);
  const ir = (n) => { setPaso(n); setVerCompara(false); setSub(1); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* noop */ } };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)" }}>
      <PageHeader label="—— Escenarios a 10 años" title="Modela escenarios y mira cómo cambian tu patrimonio y tus ingresos en los próximos años" accent="próximos años" subtitle="Paso a paso: qué tienes hoy, qué viene seguro, qué vendes o transformas y a dónde va la plata. Cada escenario se modela a 10 años y se compara con los demás para decidir." compact />
      {sinDatos ? (
        <div style={card}><div style={F.h2}>Para proyectar escenarios hace falta tu punto de partida</div><div style={{ ...F.body, marginTop: 6 }}>Carga tus activos, ingresos, gastos y deudas: con eso FINPATHIA arma el paso 1 solo.</div><div style={{ marginTop: 12, display: "flex", gap: 8 }}><button style={btn(true)} onClick={() => onNavigate?.("inv")}>Ir a Patrimonio</button><button style={btn(false)} onClick={() => onNavigate?.("ing")}>Ir a Ingresos</button></div></div>
      ) : (<>
        <BarraEscenario todos={todos} res={res} activoId={rActivo?.id} setActivoId={setActivoId} base={base} onNuevo={nuevo} />
        <Stepper paso={paso} setPaso={ir} />
        {paso === 1 && <PasoHoy base={base} fichas={fichas} onFichas={onFichas} onNext={() => ir(2)} />}
        {paso === 2 && <PasoIntencion todos={todos} res={res} base={base} activoId={rActivo?.id} setActivoId={setActivoId} onNuevo={nuevo} onNext={() => ir(3)} />}
        {paso === 3 && <PasoEscenario base={base} perfil={perfil} todos={todos} res={res} activoId={rActivo?.id} setActivoId={setActivoId} onGuardar={guardar} onNuevo={nuevo} onDuplicar={duplicar} onRestablecer={restablecer} onBorrar={borrar} caminoElegido={caminoElegido} onElegir={onElegir} onNext={() => ir(4)} onComparar={() => { ir(4); setVerCompara(true); }} sub={sub} setSub={setSub} />}
        {paso === 3 && sub === 4 && <PasoViene base={base} perfil={perfil} onPerfil={onPerfil} onNext={() => ir(4)} />}
        {paso === 4 && !verCompara && <PasoResultado base={base} r={rActivo} elegido={caminoElegido === rActivo?.id} onElegir={() => onElegir(rActivo.id)} onNext={() => setVerCompara(true)} onVolver={() => ir(2)} />}
        {paso === 4 && verCompara && <PasoCompara res={res} base={base} perfil={perfil} activoId={rActivo?.id} onVer={(id) => { setActivoId(id); setVerCompara(false); }} caminoElegido={caminoElegido} onElegir={onElegir} />}
        <div style={{ ...F.caption, textAlign: "center" }}>Lo que simulas aquí no toca tus datos reales. Los ejercicios (Pensiones, Ahorro BTC, Comprar o arrendar) alimentan los supuestos, no las decisiones.</div>
      </>)}
    </div>
  );
}
