// Bloque de contexto del Asesor IA con el nivel de libertad ya calculado por
// metrics.js (calcularMetricas), la escala real y los nombres reales. El modelo
// no debe inventar umbrales ni recalcular la cobertura.
import { NIVELES, fmtPctEs, fmtMeses } from "./metrics.js";

const fm = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

/** Escala oficial en una línea (nombres y umbrales de metrics.js). */
export function escalaNiveles() {
  // 21-oct-2026 — Antes la escala se dictaba en porcentajes (25/50/100) porque
  // los escalones ERAN porcentajes. Ya no: Seguridad se mide contra lo esencial
  // del mes y los dos primeros contra el flujo. Ver metrics.js → NIVELES.
  const rango = (n) => {
    if (!n.umbral) return n.id === 1 ? "flujo libre negativo" : "flujo positivo, sin cubrir lo esencial";
    if (n.umbral === "esencial") return "ingreso pasivo ≥ gastos esenciales + cuotas";
    return n.factor > 1
      ? `ingreso pasivo ≥ ${n.factor}× (gastos + cuotas)`
      : "ingreso pasivo ≥ gastos + cuotas";
  };
  return NIVELES.map((n) => `N${n.id} ${n.nombre} (${rango(n)})`).join(" · ");
}


/**
 * @param {object} t totales de cT (con `met` = calcularMetricas y `salud`).
 * @returns {string} bloque de texto para el contexto del asesor.
 */
export function bloqueNivelLibertad(t = {}) {
  const m = t.met;
  if (!m || !(m.ob > 0)) return "NIVEL DE LIBERTAD: sin datos suficientes (no cargaste gastos o cuotas). No lo estimes.\n";
  const nv = m.nivel || {};
  const l = [];
  l.push("NIVEL DE LIBERTAD (calculado por Finpathia; úsalo tal cual, no inventes umbrales, nombres ni porcentajes):");
  l.push(`• Cobertura pasiva = ingreso pasivo neto ÷ (gastos + cuotas) = ${fm(m.ip)} ÷ ${fm(m.ob)} = ${fmtPctEs(m.coberturaPasiva)}`);
  l.push(`• Nivel actual: ${nv.nivel}/5 ${nv.nombre}${nv.candado === "patrimonio_negativo" ? " (limitado a N2 porque el patrimonio neto es negativo)" : nv.candado === "deficit" ? " (flujo libre negativo)" : ""}`);
  l.push(`• Escala oficial: ${escalaNiveles()}. Esos son los únicos niveles y umbrales; Independencia solo con cobertura ≥ 100%.`);
  l.push("• El salario y los honorarios NO cuentan como ingreso pasivo; sí el arriendo neto de administración y predial, intereses, dividendos y pensión recibida.");
  if (nv.siguiente) {
    l.push(`• Siguiente nivel: ${nv.siguiente.nombre}` + (nv.faltaIPSiguiente > 0 ? ` — faltan ${fm(nv.faltaIPSiguiente)}/mes de ingreso pasivo neto` : ""));
  }
  l.push(`• Flujo libre: ${fm(m.fl)}/mes; ahorro ${fmtPctEs(m.ahorroPct)} y carga de deuda ${fmtPctEs(m.cargaDeudaPct)} del ingreso neto de retención (${fm(m.ingresoNeto)}/mes).`);
  if (m.colchonMeses != null) l.push(`• Colchón de liquidez: ${fmtMeses(m.colchonMeses)} (activos líquidos ${fm(m.liquidos)} ÷ gastos y cuotas).`);
  if (t.salud && t.salud.score != null) l.push(`• Salud financiera: ${t.salud.score}/100 (${t.salud.banda}).`);
  return l.join("\n") + "\n";
}
