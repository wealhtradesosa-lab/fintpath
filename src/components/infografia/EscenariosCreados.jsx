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

import { tamanoCifra } from "../../lib/infografia.js";
import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { resumenEscenario, anioCal, desglosePatrimonio, rendimientoSinAhorro, hayVenta, rotuloVenta, loQueVieneDelPlan, inflacionDe } from "../../lib/futuro10.js";
import { tx, esUS, plataCorta, num } from "../../lib/region.js";

import { fmtPlataEs } from "../../lib/formato.js";
// 3-nov-2026: en EE. UU. las cifras van con el formato del país ($2.5M); en
// Colombia se queda exactamente como estaba ($2,5 MM).
const fm = (n) => (esUS() ? plataCorta(n) : fmtPlataEs(n));
const pct = (n, d = 1) => (n == null ? "—" : esUS() ? num(n, d) + "%" : n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %");

// 23-nov-2026 (Finanzas): el patrimonio final va en pesos de hoy con la inflación
// del escenario, igual que la barra en vivo y el informe, y el «crece al año» ya no mete tu ahorro como si
// fuera rentabilidad: es lo que rinden tus activos, sin el ahorro. Debajo, de
// dónde sale el patrimonio final: hoy + ahorro + lo que rinden tus activos.
function medir(r) {
  const f = (r && r.filas) || [];
  if (!f.length) return null;
  const fin = f[f.length - 1];
  const infl = inflacionDe(r);
  const dp = desglosePatrimonio(r, infl);
  const rend = rendimientoSinAhorro(r, infl);
  const cobertura = fin.gastos > 0 ? (fin.ingresos / fin.gastos) * 100 : null;
  const peor = f.slice(1).reduce((m, x) => Math.min(m, (x.ingresos - x.gastos) / 12), Infinity);
  return { serie: f.map((x) => (x.patrimonio || 0) / (x.deflactor || Math.pow(1 + infl / 100, x.anio || 0))), inflacionPct: infl, fin: dp.fin, anioFin: anioCal(fin.anio), real: rend ? rend.realPct : null, desglose: dp, conVenta: hayVenta(r), viene: loQueVieneDelPlan(r), cobertura, peorMes: Number.isFinite(peor) ? peor : 0 };
}

// 23-nov-2026 (Soporte): aviso del cambio de cálculo junto a las tarjetas. Se
// quita solo después de AVISO_CALCULO_HASTA (o poniendo la fecha en null).
export const AVISO_CALCULO_HASTA = "2026-12-31";
// Fecha del día en Colombia (no UTC): el aviso se ve todo el 31-dic hora Colombia.
export const fechaBogota = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const mostrarAvisoCalculo = (hoy = new Date(), hasta = AVISO_CALCULO_HASTA) => !!hasta && fechaBogota(hoy) <= hasta;
export const avisoCalculo = () => tx("Ajustamos el cálculo: tu ahorro ya no cuenta como rendimiento y la cifra ahora sale en pesos de hoy, por eso puede verse más baja.", "We adjusted the math: your savings no longer count as returns and the figure is now in today's pesos, so it may look lower.");
// 23-nov-2026: el aviso sale también arriba de la barra del creador (Soporte),
// no solo en Escenarios creados. Un solo componente para los dos lugares.
export const AvisoCalculo = ({ testId = "f10-aviso-calculo", style }) => (mostrarAvisoCalculo()
  ? <div role="note" data-testid={testId} style={{ fontSize: 12.5, color: C.txt2, lineHeight: 1.45, padding: "8px 12px", border: `1px solid rgba(var(--fp-ink),0.14)`, borderRadius: 10, ...(style || {}) }}>{avisoCalculo()}</div>
  : null);

// Supuesto de las compras de «Lo que viene» (Finanzas). Sin valorización propia,
// la compra sube con la inflación del escenario: propiedad raíz con
// valorizacionSpread 0 (o otrosRealSpread 0), es decir 0 % real.
export const supuestoCompras = (compras = []) => {
  const quien = compras.length && compras.every((x) => x.vivienda) ? tx("la vivienda", "the home") : tx("lo que compras", "what you buy");
  const todasDefault = compras.every((x) => x.valorizacionDefault !== false);
  const algunaDefault = compras.some((x) => x.valorizacionDefault !== false);
  const val = todasDefault
    ? tx(`, y ${quien} se valoriza al ritmo de la inflación (0 % real)`, `, and ${quien} appreciates with inflation (0% real)`)
    : algunaDefault
      ? tx(", y se valoriza al ritmo de la inflación (0 % real), salvo donde pusiste cuánto sube su valor al año", ", and it appreciates with inflation (0% real), except where you set its yearly appreciation")
      : tx(", y se valoriza a la tasa que pusiste en «¿Cuánto sube su valor al año?»", ", and it appreciates at the rate you set");
  return tx(`Supuesto: las compras se pagan de contado, sin gastos de escritura, registro ni impuestos${val}.`, `Assumption: purchases are paid in cash, with no closing costs, recording fees or taxes${val}.`);
};

const textoViene = (x) => {
  const anios = x.anioFin && x.anioFin > x.anio ? `${anioCal(x.anio)}–${anioCal(x.anioFin)}` : `${anioCal(x.anio)}`;
  if (x.tipo === "ingreso") return { anios, monto: `+${fm(x.monto)} ${tx("al mes", "a month")}`, pos: true };
  if (x.tipo === "gasto") return { anios, monto: `−${fm(x.monto)} ${tx("al año", "a year")}`, pos: false };
  return { anios, monto: `−${fm(x.monto)}`, pos: false };
};

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

// 22-nov-2026 (Santiago: "me va llenando de botones… el nombre se cambia en el
// título al editar; eliminar puede ser un ícono de caneca"). Borrar = caneca
// discreta junto al título; el nombre se cambia en el título del escenario.
const Caneca = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
  </svg>);
export default function EscenariosCreados({ planes, inflacionPct, onVer, onEditar, onBorrar, onCrear, demo = false }) {
  const hoy = (planes || []).find((p) => p.esHoy);
  const creados = (planes || []).filter((p) => p.id);
  const mHoy = hoy ? medir(hoy.r) : null;
  const infTxt = (v) => String(Math.round(Number(v) * 10) / 10).replace(".", esUS() ? "." : ",");
  const infHdr = infTxt(inflacionPct != null ? inflacionPct : (mHoy ? mHoy.inflacionPct : (creados[0] ? inflacionDe(creados[0].r) : inflacionDe(null))));

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

  // 22-nov-2026 (Santiago: "uno de los escenarios a comparar es el de hoy: si me
  // quedo como estoy, ¿qué pasa?"). «Quedarme como estoy» entra como un escenario
  // más: su barra, su tarjeta y su informe completo. No se edita ni se borra.
  const planHoy = hoy ? { ...hoy, nombre: tx("Si me quedo como estoy", "If I stay as I am"), descripcion: tx("Sin vender ni invertir en nada nuevo: tus activos, rentas, gastos y deudas siguen como hoy.", "No selling and no new investments: your assets, income, expenses and debt continue as they are today.") } : null;
  const medidos = [...(planHoy ? [planHoy] : []), ...creados].map((p) => ({ p, m: medir(p.r) })).filter((x) => x.m);
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
              {esUS() ? tx(`Patrimonio neto en dólares de hoy (inflación ${infHdr} % al año). `, `Net worth in today's dollars (${infHdr}% yearly inflation). `) : tx(`Patrimonio neto en pesos de hoy (inflación ${infHdr} % al año). `, `Net worth in today's pesos (${infHdr}% yearly inflation). `)}
              {mHoy ? tx(<>La línea punteada es quedarte como estás ({fm(mHoy.fin)}). </>, <>The dashed line is staying as you are ({fm(mHoy.fin)}). </>) : null}
              {mejor.p.esHoy ? tx("Por ahora, quedarte como estás deja más patrimonio que los escenarios que creaste.", "For now, staying as you are leaves more net worth than the scenarios you created.") : tx(<>«{mejor.p.nombre}» lleva la delantera{mHoy ? <> con <b style={{ color: C.txt, ...cifra }}>{mejor.m.fin >= mHoy.fin ? "+" : "−"}{fm(Math.abs(mejor.m.fin - mHoy.fin))}</b> frente a hoy</> : null}.</>,
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
              <div key={p.id || "hoy"} className="fpi-rank">
                <div className="fpi-rank-nombre" style={{ fontSize: 13, color: C.txt, fontWeight: i === 0 ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={p.nombre}>{p.nombre}</div>
                <div className="fpi-rank-barra" style={{ position: "relative", height: 22 }}>
                  <div className="fpi-barra-h" style={{ height: "100%", width: `${Math.max(1, ancho)}%`, borderRadius: 6, background: p.esHoy ? "rgba(var(--fp-ink),0.28)" : i === 0 ? C.azul : trama(C.azul, 40), animationDelay: `${i * 50}ms`, boxShadow: i === 0 && !p.esHoy ? "0 0 14px color-mix(in srgb, var(--fp-azul) 35%, transparent)" : "none" }} />
                  {posHoy != null && <div aria-hidden="true" style={{ position: "absolute", top: -4, bottom: -4, left: `${posHoy}%`, borderLeft: `2px dashed ${C.txt3}` }} />}
                </div>
                <div className="fpi-rank-valor" style={{ textAlign: "right", minWidth: 120 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.txt, ...cifra }}>{fm(m.fin)}</div>
                  {p.esHoy && <div style={{ fontSize: 11.5, color: C.txt2 }}>{tx("sin mover nada", "changing nothing")}</div>}
                  {dif != null && !p.esHoy && <div style={{ fontSize: 11.5, color: dif >= 0 ? C.pos : C.neg, ...cifra }}>{dif >= 0 ? "+" : "−"}{fm(Math.abs(dif))} {tx("vs hoy", "vs. today")}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AvisoCalculo />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
        {medidos.map(({ p, m }, i) => {
          const esMejor = p === mejor.p;
          const alcanza = m.peorMes >= 0;
          return (
            <article key={p.id || "hoy"} style={{ ...tarjeta, padding: 20, display: "flex", flexDirection: "column", gap: 12,
              // 23-nov-2026 (Santiago: "antes cada escenario tenía como un recuadrito, ya no tienen líneas"). Una clave de estilo en
              // undefined borra esa parte del borde (React la pone en ''): el borde va completo, siempre.
              border: `1px ${p.esHoy ? "dashed" : "solid"} ${esMejor && !p.esHoy ? "color-mix(in srgb, var(--fp-azul) 70%, transparent)" : "rgba(var(--fp-ink),0.32)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.txt, lineHeight: 1.3 }}>{p.nombre}</h4>
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  {p.esHoy && <span style={{ fontSize: 11, fontWeight: 600, color: C.txt2, border: `1px solid rgba(var(--fp-ink),0.2)`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{tx("Punto de partida", "Baseline")}</span>}
                  {p.recomendado && <span style={{ fontSize: 11, fontWeight: 600, color: C.pos, border: `1px solid ${C.pos}`, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{tx("Recomendado", "Recommended")}</span>}
                  {onBorrar && !p.esHoy && <button type="button" className="fpi-caneca" title={tx("Borrar escenario", "Delete scenario")} aria-label={tx(`Borrar «${p.nombre}»`, `Delete "${p.nombre}"`)} onClick={() => { if (typeof window === "undefined" || window.confirm(tx(`¿Borrar «${p.nombre}»? No se puede deshacer.`, `Delete "${p.nombre}"? This can't be undone.`))) onBorrar(p.id); }}><Caneca /></button>}
                </span>
              </div>
              <div title={p.descripcion || ""} style={{ fontSize: 12.5, color: C.txt2, lineHeight: 1.45, minHeight: 54, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.descripcion || resumenEscenario(p.r)}</div>
              <Curva serie={m.serie} min={minSerie} max={maxSerie} color={esMejor ? "var(--fp-azul)" : "color-mix(in srgb, var(--fp-azul) 60%, var(--fp-txt3))"} id={"fpi-esc-" + i} />
              <div>
                <div style={{ fontSize: 12, color: C.txt2 }}>{tx(`Patrimonio neto en ${m.anioFin}`, `Net worth in ${m.anioFin}`)}</div>
                <div style={{ containerType: "inline-size" }}><div style={{ fontSize: tamanoCifra(fm(m.fin), 22), whiteSpace: "nowrap", fontWeight: 600, color: C.txt, ...cifra }}>{fm(m.fin)}</div></div>
                <div style={{ fontSize: 11.5, color: C.txt2 }}>{esUS() ? tx(`en dólares de hoy (inflación ${infTxt(m.inflacionPct)} % al año)`, `in today's dollars (${infTxt(m.inflacionPct)}% yearly inflation)`) : tx(`en pesos de hoy (inflación ${infTxt(m.inflacionPct)} % al año)`, `in today's pesos (${infTxt(m.inflacionPct)}% yearly inflation)`)}{m.conVenta ? <> · <b data-testid="f10-card-venta" style={{ color: C.txt }}>{rotuloVenta()}</b></> : null}</div>
                {m.desglose && <div data-testid="f10-card-desglose" style={{ fontSize: 11.5, color: C.txt2, marginTop: 4, lineHeight: 1.45 }}>{tx(<>Hoy {fm(m.desglose.hoy)} · tu ahorro {m.desglose.ahorro >= 0 ? "+" : "−"}{fm(Math.abs(m.desglose.ahorro))} · lo que rinden tus activos {m.desglose.rendimientoReal >= 0 ? "+" : "−"}{fm(Math.abs(m.desglose.rendimientoReal))}</>, <>Today {fm(m.desglose.hoy)} · your savings {m.desglose.ahorro >= 0 ? "+" : "−"}{fm(Math.abs(m.desglose.ahorro))} · what your assets earn {m.desglose.rendimientoReal >= 0 ? "+" : "−"}{fm(Math.abs(m.desglose.rendimientoReal))}</>)}</div>}
              </div>
              {m.viene.length > 0 && <div data-testid="f10-card-viene" style={{ paddingTop: 10, borderTop: `1px solid ${C.linea}` }}>
                <div style={{ fontSize: 11.5, color: C.txt2, marginBottom: 4 }}>{tx("Lo que viene (ya restado o sumado en su año)", "What's coming (already counted in its year)")}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  {m.viene.map((x, k) => { const t = textoViene(x); return (
                    <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: C.txt }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre} · {t.anios}</span>
                      <span style={{ whiteSpace: "nowrap", color: t.pos ? C.pos : C.txt, ...cifra }}>{t.monto}</span>
                    </li>); })}
                </ul>
                {m.viene.some((x) => x.tipo === "compra") && <div data-testid="f10-card-supuesto-compra" style={{ fontSize: 11.5, color: C.txt2, marginTop: 4, lineHeight: 1.4 }}>{supuestoCompras(m.viene.filter((x) => x.tipo === "compra"))}</div>}
              </div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 10, borderTop: `1px solid ${C.linea}` }}>
                <div><div style={{ fontSize: 11.5, color: C.txt2 }}>{tx("Rinden tus activos al año (real, sin tu ahorro)", "Your assets earn per year (real, excluding savings)")}</div><div style={{ fontSize: 15, fontWeight: 600, color: m.real != null && m.real < 0 ? C.neg : C.txt, ...cifra }}>{pct(m.real)}</div></div>
                <div><div style={{ fontSize: 11.5, color: C.txt2 }}>{alcanza ? tx("Te alcanza", "It's enough") : tx("Hay años justos", "Some years are tight")}</div><div style={{ fontSize: 15, fontWeight: 600, color: alcanza ? C.pos : C.neg }}>{alcanza ? tx("Todos los años", "Every year") : tx("Revisa el flujo", "Check cash flow")}</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button type="button" onClick={() => onVer && onVer(p)} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "none", background: C.txt, color: "var(--fp-card)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{tx("Ver completo", "View full report")}</button>
                {onEditar && !p.esHoy && <button type="button" onClick={() => onEditar(p.id)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 10, border: `1px solid rgba(var(--fp-ink),0.14)`, background: "transparent", color: C.txt, fontSize: 13, cursor: "pointer" }}>{tx("Editar", "Edit")}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
