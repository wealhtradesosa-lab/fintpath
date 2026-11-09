// ═══════════════════════════════════════════════════════════════════════════
// EscenariosCreados — «Mi futuro a 10 años › Escenarios creados»
// 1-nov-2026 (Santiago: «los escenarios deberían tener una sección donde se
// ven los escenarios futuros creados… como están dentro del proceso de
// creación solo se ven cuando uno escarba»; «es una subsección de Mi futuro
// en 10 años»; «si no hay nada, dice: debes crear un escenario»).
//
// Arriba, la pregunta que decide: ¿cuál deja más patrimonio en 10 años?
// (barras contra «Hoy», la línea punteada). Debajo, una tarjeta por
// escenario con su curva de 10 años, el patrimonio al final, el crecimiento
// real y si las rentas alcanzan. Ver completo abre el informe; Editar lleva
// al proceso de creación.
// planes = planesComparar de MiFuturo10: [{ nombre, esHoy?, id?, descripcion,
// recomendado, r: proyectarFuturo10(...) }]
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { resumenEscenario, anioCal } from "../../lib/futuro10.js";
import { tx, esUS, plataCorta, num } from "../../lib/region.js";

import { fmtPlataEs } from "../../lib/formato.js";
// 3-nov-2026: en EE. UU. las cifras van con el formato del país ($2.5M); en
// Colombia se queda exactamente como estaba ($2,5 MM).
const fm = (n) => (esUS() ? plataCorta(n) : fmtPlataEs(n));
const pct = (n, d = 1) => (n == null ? "—" : esUS() ? num(n, d) + "%" : n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %");

function medir(r, inflacionPct) {
  const f = (r && r.filas) || [];
  if (!f.length) return null;
  const f0 = f[0], fin = f[f.length - 1];
  const cagr = f0.patrimonio > 0 && fin.patrimonio > 0 ? (Math.pow(fin.patrimonio / f0.patrimonio, 1 / Math.max(1, fin.anio)) - 1) * 100 : null;
  const real = cagr == null ? null : ((1 + cagr / 100) / (1 + (inflacionPct || 0) / 100) - 1) * 100;
  const cobertura = fin.gastos > 0 ? (fin.ingresos / fin.gastos) * 100 : null;
  const peor = f.slice(1).reduce((m, x) => Math.min(m, (x.ingresos - x.gastos) / 12), Infinity);
  return { serie: f.map((x) => x.patrimonio || 0), fin: fin.patrimonio || 0, anioFin: anioCal(fin.anio), real, cobertura, peorMes: Number.isFinite(peor) ? peor : 0 };
}

function Curva({ serie, min = 0, max, color, id }) {
  const W = 240, H = 64;
  if (!serie.length || !(max > min)) return null;
  const pts = serie.map((v, i) => [(i / Math.max(1, serie.length - 1)) * W, H - 4 - ((v - min) / (max - min)) * (H - 10)]);
  const linea = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ width: "100%", height: 64, display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${linea} L${W},${H} L0,${H} Z`} style={{ fill: `url(#${id})` }} />
      <path className="fpi-arco" d={linea} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color, "--fpi-largo": 400 }} />
      <circle cx={pts[pts.length - 1][0] - 3} cy={pts[pts.length - 1][1]} r="4" style={{ fill: color }} />
    </svg>
  );
}

export default function EscenariosCreados({ planes, inflacionPct, onVer, onEditar, onCrear, demo = false }) {
  const hoy = (planes || []).find((p) => p.esHoy);
  const creados = (planes || []).filter((p) => p.id);
  const mHoy = hoy ? medir(hoy.r, inflacionPct) : null;

  if (!creados.length) {
    return (
      <section aria-label={tx("Escenarios creados", "Saved scenarios")} style={{ ...tarjeta, textAlign: "center", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <h3 style={titulo}>{tx("Todavía no tienes escenarios creados", "You don't have any scenarios yet")}</h3>
        <div style={{ ...subtitulo, maxWidth: 520 }}>
          {tx("Un escenario es una forma de mover tu plata: vender algo, invertir en otra cosa, pagar una deuda. Arma el primero en cuatro pasos y aquí lo vas a ver junto a «seguir como vas».", "A scenario is a way to move your money: sell something, invest in something else, pay off a debt. Build your first one in four steps and you'll see it here next to \"staying the course.\"")}
        </div>
        {!demo && <button type="button" onClick={onCrear} style={{ marginTop: 8, minHeight: 44, padding: "0 22px", borderRadius: 10, border: "none", background: C.txt, color: "var(--fp-card)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{tx("Crear mi primer escenario", "Create my first scenario")}</button>}
      </section>
    );
  }

  const medidos = creados.map((p) => ({ p, m: medir(p.r, inflacionPct) })).filter((x) => x.m);
  const ranking = [...medidos].sort((a, b) => b.m.fin - a.m.fin);
  const maxFin = Math.max(mHoy ? mHoy.fin : 0, ...medidos.map((x) => x.m.fin), 1);
  // Curvas de tendencia: escala al rango real de todos los escenarios (no desde
  // cero), para que se vea la forma; las barras de arriba sí arrancan en cero.
  const todos = medidos.flatMap((x) => x.m.serie).concat(mHoy ? mHoy.serie : []);
  const maxSerie = Math.max(...todos, 1);
  const minSerie = Math.min(...todos) * 0.96;
  const mejor = ranking[0];
  const anioFin = mejor.m.anioFin;
  const posHoy = mHoy ? (mHoy.fin / maxFin) * 100 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>

      <section aria-label={tx("Cuál escenario deja más patrimonio", "Which scenario leaves the most net worth")} style={{ ...tarjeta, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
          <div>
            <h3 style={titulo}>{tx(`¿Cuál deja más patrimonio en ${anioFin}?`, `Which leaves the most net worth in ${anioFin}?`)}</h3>
            <div style={subtitulo}>
              {mHoy ? tx(<>La línea punteada es seguir como vas ({fm(mHoy.fin)}). </>, <>The dashed line is staying the course ({fm(mHoy.fin)}). </>) : null}
              {tx(<>«{mejor.p.nombre}» lleva la delantera{mHoy ? <> con <b style={{ color: C.txt, ...cifra }}>{mejor.m.fin >= mHoy.fin ? "+" : "−"}{fm(Math.abs(mejor.m.fin - mHoy.fin))}</b> frente a hoy</> : null}.</>,
                <>"{mejor.p.nombre}" is ahead{mHoy ? <> by <b style={{ color: C.txt, ...cifra }}>{mejor.m.fin >= mHoy.fin ? "+" : "−"}{fm(Math.abs(mejor.m.fin - mHoy.fin))}</b> vs. today</> : null}.</>)}
            </div>
          </div>
          {!demo && <button type="button" onClick={onCrear} style={{ minHeight: 44, padding: "0 18px", borderRadius: 10, border: `1px solid rgba(var(--fp-ink),0.14)`, background: "transparent", color: C.txt, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{tx("Crear un escenario nuevo", "Create a new scenario")}</button>}
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
          {ranking.map(({ p, m }, i) => {
            const ancho = (m.fin / maxFin) * 100;
            const dif = mHoy ? m.fin - mHoy.fin : null;
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 26%) 1fr auto", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: C.txt, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.nombre}>{p.nombre}</div>
                <div style={{ position: "relative", height: 22 }}>
                  <div className="fpi-barra-h" style={{ height: "100%", width: `${Math.max(1, ancho)}%`, borderRadius: 6, background: i === 0 ? C.azul : trama(C.azul, 40), animationDelay: `${i * 50}ms`, boxShadow: i === 0 ? "0 0 14px color-mix(in srgb, var(--fp-azul) 35%, transparent)" : "none" }} />
                  {posHoy != null && <div aria-hidden="true" style={{ position: "absolute", top: -4, bottom: -4, left: `${posHoy}%`, borderLeft: `2px dashed ${C.txt3}` }} />}
                </div>
                <div style={{ textAlign: "right", minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.txt, ...cifra }}>{fm(m.fin)}</div>
                  {dif != null && <div style={{ fontSize: 11.5, color: dif >= 0 ? C.pos : C.neg, ...cifra }}>{dif >= 0 ? "+" : "−"}{fm(Math.abs(dif))} {tx("vs hoy", "vs. today")}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        {medidos.map(({ p, m }, i) => {
          const esMejor = p.id === mejor.p.id;
          const alcanza = m.peorMes >= 0;
          return (
            <article key={p.id} style={{ ...tarjeta, padding: 20, display: "flex", flexDirection: "column", gap: 12, borderColor: esMejor ? "color-mix(in srgb, var(--fp-azul) 45%, transparent)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.txt, lineHeight: 1.3 }}>{p.nombre}</h4>
                {p.recomendado && <span style={{ fontSize: 11, fontWeight: 600, color: C.pos, border: `1px solid ${C.pos}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{tx("Recomendado", "Recommended")}</span>}
              </div>
              <div title={p.descripcion || ""} style={{ fontSize: 12.5, color: C.txt2, lineHeight: 1.45, minHeight: 54, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.descripcion || resumenEscenario(p.r)}</div>
              <Curva serie={m.serie} min={minSerie} max={maxSerie} color={esMejor ? "var(--fp-azul)" : "color-mix(in srgb, var(--fp-azul) 60%, var(--fp-txt3))"} id={"fpi-esc-" + i} />
              <div>
                <div style={{ fontSize: 12, color: C.txt2 }}>{tx(`Patrimonio en ${m.anioFin}`, `Net worth in ${m.anioFin}`)}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: C.txt, ...cifra }}>{fm(m.fin)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.linea}` }}>
                <div><div style={{ fontSize: 11.5, color: C.txt2 }}>{tx("Crece al año (real)", "Annual growth (real)")}</div><div style={{ fontSize: 15, fontWeight: 600, color: m.real != null && m.real < 0 ? C.neg : C.txt, ...cifra }}>{pct(m.real)}</div></div>
                <div><div style={{ fontSize: 11.5, color: C.txt2 }}>{alcanza ? tx("Te alcanza", "It's enough") : tx("Hay años justos", "Some years are tight")}</div><div style={{ fontSize: 15, fontWeight: 600, color: alcanza ? C.pos : C.neg }}>{alcanza ? tx("Todos los años", "Every year") : tx("Revisa el flujo", "Check cash flow")}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button type="button" onClick={() => onVer && onVer(p)} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "none", background: C.txt, color: "var(--fp-card)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{tx("Ver completo", "View full report")}</button>
                {onEditar && <button type="button" onClick={() => onEditar(p.id)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid rgba(var(--fp-ink),0.14)`, background: "transparent", color: C.txt, fontSize: 13, cursor: "pointer" }}>{tx("Editar", "Edit")}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
