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
  LayoutGrid, PieChart, ArrowDownLeft, ArrowUpRight, CreditCard, ReceiptText, Users, History, Calculator, Send,
  Briefcase, CalendarDays, TrendingUp, Activity, CalendarClock, Mountain, Compass, Target, CandlestickChart,
  Armchair, Bitcoin, Home, Tag, HandCoins, MessageSquare, Gem, Settings, BookOpen, BarChart3, Circle, FileBarChart,
} from "lucide-react";

// 31-oct-2026 (Santiago, con una referencia: íconos de línea con degradado
// azul → verde). El degradado vive en <DefsIconos/>, montado una vez en la app.
const MENU = {
  dash: LayoutGrid, inv: PieChart, ing: ArrowDownLeft, gas: ArrowUpRight, deu: CreditCard,
  tax: ReceiptText, taxopt: ReceiptText, famtax: Users, prevtax: History, taxcalc: Calculator, taxinf: FileBarChart, contclientes: Briefcase,
  anio: CalendarDays, flujo: TrendingUp, sim: Activity, simf: CalendarClock, f10: Mountain,
  norte: Compass, met: Target, trd: CandlestickChart, calc: Calculator, pen: Armchair, btc: Bitcoin,
  buyvsinvest: Home, gocasional: Tag, aportes: HandCoins, asesor: MessageSquare, coach: Users,
  price: Gem, cuenta: Settings, glosario: BookOpen, metrics: BarChart3,
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
export function IconoMenu({ id, size = 18 }) {
  const I = MENU[id] || Circle;
  return <I size={size} strokeWidth={1.75} stroke="url(#fp-grad-icono)" aria-hidden="true" style={{ flexShrink: 0 }} />;
}
