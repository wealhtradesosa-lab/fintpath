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
  tx: "#ECEAE4",
  tx2: "var(--fp-txt2)",
  ok: "#6CC58F",
  bad: "#E07A5F",
  franja: "rgba(108,197,143,0.16)",
  sobra: "#4F6B5A", // lo que sobra, reinvertido
  sobreColor: "#FFFFFF",
};

// Color estable por clase de activo (Patrimonio neto por año, Todo lo que tienes).
export const COLOR_CLASE = { inmueble: INF.teja, liquido: INF.azul, acciones: INF.morado, nueva: INF.dorado, otro: INF.gris, vehiculo: INF.gris, canasta: INF.oliva };
export const ETQ_CLASE = { inmueble: "Inmuebles", liquido: "Liquidez", acciones: "Bolsa", nueva: "Inversiones nuevas", otro: "Otros", vehiculo: "Vehículos", canasta: "Lo que sobra reinvertido" };

/** $1.234 M · $12,3 mil M · $850.000 */
export function fmM(v) {
  const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? "−" : "";
  if (a >= 1e9) return `${sg}$${fmtMilesEs(Math.round(a / 1e6))}M`;
  if (a >= 1e6) return `${sg}$${(Math.round(a / 1e5) / 10).toLocaleString("es-CO")}M`;
  return `${sg}$${fmtMilesEs(Math.round(a))}`;
}
/** Para ejes: $10.000M, $500M */
export function fmEje(v) {
  const n = Number(v) || 0, a = Math.abs(n), sg = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sg}$${fmtMilesEs(Math.round(a / 1e6))}M`;
  return `${sg}$${fmtMilesEs(Math.round(a))}`;
}
export const fmPct = (v, d = 1) => fmtPctEs(v, d);
