// Factores de los escenarios del simulador (ingresos / gastos).
export const FACTORES_ESCENARIO = {
  conservador: { i: 0.8, g: 1.1 },
  optimista: { i: 1.3, g: 0.85 },
  crisis: { i: 0.6, g: 1.05 },
};

/**
 * Overrides de gastos para un escenario: { "gf_<cat>_<idx>": monto }.
 * Seguridad Social queda fija (aporte por ley sobre el ingreso; solo cambia si
 * el escenario cambia el ingreso, y eso lo recalcula el simulador). Los gastos
 * con sim === false se omiten. El factor aplica solo a gastos discrecionales y
 * de vida.
 */
export function gastosEscenario(gastos, factorG) {
  const nv = {};
  Object.entries(gastos || {}).forEach(([cat, items]) => {
    if (cat === "Seguridad Social") return;
    (items || []).forEach((g, gi) => {
      if (!g || g.sim === false) return;
      nv[`gf_${cat}_${gi}`] = Math.round((Number(g.m) || 0) * factorG);
    });
  });
  return nv;
}
