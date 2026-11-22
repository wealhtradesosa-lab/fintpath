/**
 * 31-oct-2026 — Íconos de la app (crítica de diseño: «ningún emoji en la
 * interfaz; un solo juego de íconos de línea»). Lucide, trazo fino, en el
 * color del texto. El interruptor reemplaza los ✅/⬜ de cada fila.
 */
export { Pencil, Trash2 } from "lucide-react";

export function Interruptor({ on, size = 30 }) {
  const h = Math.round(size * 0.58), d = h - 4;
  return (
    <span role="switch" aria-checked={!!on} style={{
      display: "inline-block", position: "relative", width: size, height: h, borderRadius: h,
      background: on ? "#00c805" : "rgba(var(--fp-ink),0.18)", transition: "background .15s", verticalAlign: "middle",
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? size - d - 2 : 2, width: d, height: d, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.25)" }} />
    </span>
  );
}

import {
  LayoutGrid, ChartColumnIncreasing, CircleDollarSign, ArrowUp, ArrowDown, Database, CircleAlert, FileText, Percent,
  Users, History, Calculator, Briefcase, CalendarDays, RefreshCw, DollarSign, ChartSpline, CalendarClock, Sunrise,
  Compass, Target, CandlestickChart, Armchair, Bitcoin, House, Tag, HandCoins, Bot, Gem, Settings, BookOpen,
  BarChart3, Circle, FileBarChart, PencilRuler, Layers,
} from "lucide-react";

// 31-oct-2026 (Santiago, con dos referencias): íconos de línea con degradado
// azul → verde; un ícono por concepto: $ con flecha arriba/abajo para
// ingresos/egresos, pila con alerta para deudas, robot para el asesor,
// amanecer para la libertad financiera. Base + insignia = ícono compuesto.
const MENU = {
  dash: [LayoutGrid], inv: [ChartColumnIncreasing], ing: [CircleDollarSign, ArrowUp], gas: [CircleDollarSign, ArrowDown],
  deu: [Database, CircleAlert], tax: [FileText, Percent], taxopt: [FileText, Percent], famtax: [Users], prevtax: [History],
  taxcalc: [Calculator], taxinf: [FileBarChart], contclientes: [Briefcase],
  anio: [CalendarDays], flujo: [RefreshCw, DollarSign, "centro"], sim: [ChartSpline], simf: [CalendarClock], f10: [Sunrise], f10crear: [PencilRuler], f10esc: [Layers],
  norte: [Compass], met: [Target], trd: [CandlestickChart], calc: [Calculator], pen: [Armchair], btc: [Bitcoin],
  buyvsinvest: [House], gocasional: [Tag], aportes: [HandCoins], asesor: [Bot], coach: [Users],
  price: [Gem], cuenta: [Settings], glosario: [BookOpen], metrics: [BarChart3],
};

/** Degradado de los íconos (una sola vez en la página). */
export function DefsIconos() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="fp-grad-icono" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#1fd15f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Ícono de línea del menú lateral, con el degradado de la marca. */
export function IconoMenu({ id, size = 20 }) {
  const [Base, Insignia, modo] = MENU[id] || [Circle];
  const p = { strokeWidth: 1.75, stroke: "url(#fp-grad-icono)", "aria-hidden": "true" };
  if (!Insignia) return <Base size={size} {...p} style={{ flexShrink: 0 }} />;
  const centro = modo === "centro";
  const n = Math.round(size * (centro ? 0.42 : 0.5));
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-block", flexShrink: 0 }}>
      <Base size={size} {...p} style={centro ? undefined : { clipPath: "polygon(0 0,100% 0,100% 52%,52% 52%,52% 100%,0 100%)" }} />
      <Insignia size={n} {...p} strokeWidth={2.2} style={{ position: "absolute", left: centro ? (size - n) / 2 : size - n + 1, top: centro ? (size - n) / 2 : size - n + 1 }} />
    </span>
  );
}

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil as Lapiz, Trash2 as Caneca, CalendarCheck, CirclePlus } from "lucide-react";

// 14-nov-2026 (Santiago: "así como Editar y Eliminar tienen ícono, lo mismo
// debería pasar con «Ya lo pagué todo el año»"). Toda acción del menú lleva
// ícono, del mismo tamaño y trazo, para que se lea como una sola lista.
const ICONOS_MENU = { pagado: CalendarCheck, aporte: CirclePlus };

/**
 * Menú «⋯» de una fila (crítica de diseño: lápiz y caneca a la vista en cada
 * fila = ruido). Un botón discreto; al tocarlo, «Editar» y «Eliminar».
 */
export function MenuFila({ onEditar, onEliminar, editarTitulo = "Editar", extra = [] }) {
  const [abierto, setAbierto] = useState(false);
  // 14-nov-2026 (Santiago: "al último ítem de la lista no le salen los botones
  // borrar y editar"). El menú era absolute debajo del botón y el contenedor de
  // la tabla (overflow auto) lo cortaba en la última fila. Ahora es fixed,
  // anclado al botón, y se abre hacia arriba si abajo no cabe.
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const nItems = (onEditar ? 1 : 0) + (onEliminar ? 1 : 0) + extra.length;
  const ubicar = (r) => {
    const alto = 44 * nItems + 10;
    const arriba = window.innerHeight - r.bottom < alto + 8 && r.top > alto + 8;
    return { right: Math.max(8, window.innerWidth - r.right), ...(arriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) };
  };
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    // 22-nov-2026 (Santiago: "no funcionan los 3 botones de varios ítems"). Cualquier
    // scroll cerraba el menú: si la página aún se estaba moviendo al tocar el «⋯»
    // (inercia del trackpad o del celular, o el salto al enfocar la fila), el menú
    // se abría y se cerraba en el acto y parecía que el botón no servía. Ahora el
    // menú sigue al botón mientras se mueve y solo se cierra si el botón sale de la pantalla.
    const mover = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { setAbierto(false); return; }
      setPos(ubicar(r));
    };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", mover, true);
    window.addEventListener("resize", mover);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", mover, true);
      window.removeEventListener("resize", mover);
    };
  }, [abierto, nItems]);
  const abrir = () => {
    if (abierto) { setAbierto(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos(ubicar(r));
    setAbierto(true);
  };
  const item = { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", color: "var(--fp-txt)", borderRadius: 6 };
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
      <button ref={btnRef} type="button" aria-label="Más opciones" title="Editar o eliminar" aria-haspopup="menu" onClick={abrir}
        style={{ background: abierto ? "rgba(var(--fp-ink),0.08)" : "rgba(var(--fp-ink),0.04)", border: "1px solid rgba(var(--fp-ink),0.16)", borderRadius: 8, padding: "4px 8px", cursor: "pointer", color: "var(--fp-txt)", display: "inline-flex" }}>
        <MoreHorizontal size={18} strokeWidth={2.25} />
      </button>
      {abierto && (
        <div role="menu" style={{ position: "fixed", ...(pos || { right: 8, top: 8 }), zIndex: 1000, minWidth: 150, background: "var(--fp-card)", border: "1px solid rgba(var(--fp-ink),0.12)", borderRadius: 10, padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          {/* 14-nov-2026: acciones extra de la fila (p. ej. "Registrar aporte"). */}
          {extra.map((x) => { const Ic = ICONOS_MENU[x.icono]; return <button key={x.label} role="menuitem" type="button" style={item} onClick={() => { setAbierto(false); x.onClick(); }}>{Ic ? <Ic size={15} strokeWidth={1.75} /> : <span style={{ width: 15, flexShrink: 0 }} />} {x.label}</button>; })}
          {onEditar && <button role="menuitem" type="button" style={item} onClick={() => { setAbierto(false); onEditar(); }}><Lapiz size={15} strokeWidth={1.75} /> {editarTitulo}</button>}
          {onEliminar && <button role="menuitem" type="button" style={{ ...item, color: "#ff5000" }} onClick={() => { setAbierto(false); onEliminar(); }}><Caneca size={15} strokeWidth={1.75} /> Eliminar</button>}
        </div>
      )}
    </span>
  );
}
