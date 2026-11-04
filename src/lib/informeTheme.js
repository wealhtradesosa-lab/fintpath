// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Paleta y formatos del informe de escenarios (Mi futuro a 10 años)
//
// 24-oct-2026 (Santiago: "los gráficos de los escenarios están muy flojos…
// necesito que los escenarios se vean como el HTML"). Referencia: su "Plan
// Patrimonial SALEM". De ahí sale esta paleta sobria (azul acero, dorado,
// oliva, morado, teja, gris) en lugar de los colores de semáforo de la app.
// Vive en lib/ para que los componentes la importen como tokens.
// ═══════════════════════════════════════════════════════════════════════════
import { fmtMilesEs, fmtPctEs } from "./formato.js";
import { esUS, pct as pctRegion, miles, tx } from "./region.js";

export const INF = {
  // Series (orden de uso)
  serie: ["#2E6F9E", "#C9A962", "#5B8C5A", "#7A6FA8", "#3C9C9C", "#B5553E", "#8C5B8C", "#3B4A6B", "#A88A2E", "#D08A2E"],
  azul: "#2E6F9E",   // renta que se recibe
  dorado: "#C9A962", // multiplica (se reinvierte)
  oliva: "#5B8C5A",  // sobra / ok
  morado: "#7A6FA8",
  teja: "#B5553E",   // lo que sale / alerta
  gris: "#B9B6AD",   // hoy, otros
  navy: "#3B4A6B",
  // Superficie (oscuro, coherente con la app)
  panel: "var(--fp-card)",
  linea: "var(--fp-raised)",
  grid: "var(--fp-raised)",
  eje: "var(--fp-line)",
  ref: "var(--fp-txt3)",
  // 2-nov-2026 (Santiago: «algunos textos no se ven, sobre todo los grises
  // claros sobre blanco»). tx era #ECEAE4 fijo: casi blanco, invisible en modo
  // claro. El texto va con variables del tema; los colores de series y
  // rellenos de las gráficas siguen en hex (Safari no lee var() en atributos SVG).
  tx: "var(--fp-txt)",
  tx2: "var(--fp-txt2)",
  ok: "#6CC58F",
  bad: "#E07A5F",
  franja: "rgba(108,197,143,0.16)",
  sobra: "#4F6B5A", // lo que sobra, reinvertido
  sobreColor: "#FFFFFF",
  // Variantes para TEXTO (contraste ≥ 4,5:1 en claro y en oscuro).
  txOk: "var(--fp-pos)",
  txBad: "var(--fp-neg)",
  txDorado: "var(--inf-dorado-tx)",
  txTeja: "var(--inf-teja-tx)",
};

// Color estable por clase de activo (Patrimonio neto por año, Todo lo que tienes).
export const COLOR_CLASE = { inmueble: INF.teja, liquido: INF.azul, acciones: INF.morado, nueva: INF.dorado, otro: INF.gris, vehiculo: INF.gris, canasta: INF.oliva };
// 3-nov-2026: etiqueta en el idioma de la sesión (getter: se lee al pintar, no al importar).
const ETQ_CLASE_ES = { inmueble: "Inmuebles", liquido: "Liquidez", acciones: "Bolsa", nueva: "Inversiones nuevas", otro: "Otros", vehiculo: "Vehículos", canasta: "Lo que sobra reinvertido" };
const ETQ_CLASE_EN = { inmueble: "Real estate", liquido: "Cash", acciones: "Stocks", nueva: "New investments", otro: "Other", vehiculo: "Vehicles", canasta: "Surplus reinvested" };
export const ETQ_CLASE = new Proxy({}, { get: (_, k) => tx(ETQ_CLASE_ES[k], ETQ_CLASE_EN[k]), ownKeys: () => Object.keys(ETQ_CLASE_ES), getOwnPropertyDescriptor: (_, k) => (k in ETQ_CLASE_ES ? { enumerable: true, configurable: true, value: tx(ETQ_CLASE_ES[k], ETQ_CLASE_EN[k]) } : undefined) });

/** $1.234 M · $12,3 mil M · $850.000 */
export function fmM(v) {
  const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? "−" : "";
  // 3-nov-2026 — EE. UU.: $1.2B · $3.4M · $850,000.
  if (esUS()) {
    const q = (x) => x.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (a >= 1e9) return `${sg}$${q(a / 1e9)}B`;
    if (a >= 1e6) return `${sg}$${q(a / 1e6)}M`;
    return `${sg}$${miles(a)}`;
  }
  if (a >= 1e9) return `${sg}$${fmtMilesEs(Math.round(a / 1e6))}M`;
  if (a >= 1e6) return `${sg}$${(Math.round(a / 1e5) / 10).toLocaleString("es-CO")}M`;
  return `${sg}$${fmtMilesEs(Math.round(a))}`;
}
/** Para ejes: $10.000M, $500M */
export function fmEje(v) {
  const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? "−" : "";
  if (esUS()) {
    const q = (x) => x.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (a >= 1e9) return `${sg}$${q(a / 1e9)}B`;
    if (a >= 1e6) return `${sg}$${q(a / 1e6)}M`;
    if (a >= 1e3) return `${sg}$${q(a / 1e3)}K`;
    return `${sg}$${miles(a)}`;
  }
  if (a >= 1e6) return `${sg}$${fmtMilesEs(Math.round(a / 1e6))}M`;
  return `${sg}$${fmtMilesEs(Math.round(a))}`;
}
export const fmPct = (v, d = 1) => pctRegion(v, d);
