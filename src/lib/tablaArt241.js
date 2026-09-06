// ═══════════════════════════════════════════════════════════════════════════
// TABLA PROGRESIVA ART. 241 ET (impuesto de renta persona natural)
// ─────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para la tabla progresiva del Estatuto Tributario.
// Si cambia la ley (nuevos rangos o tarifas), MODIFICAR SOLO ACÁ.
// Todos los consumidores deben importar TABLA_ART_241 o calcImpRenta.
//
// CONSUMIDORES:
//   - src/lib/taxCO.js            (motor, estimarImpuesto)
//   - src/components/Formulario210.jsx (wizard F-210)
//   - src/components/SimuladorTributario.jsx (recomendaciones PV/AFC)
//   - scripts/verify_wizard_parity.mjs (test de paridad)
//
// HISTORIA: Antes de este módulo, la tabla estaba duplicada en 4 lugares.
// El test verify_wizard_parity.mjs detectaba la desincronización si ocurría,
// pero no prevenía el trabajo duplicado. Centralizar previene el problema
// de raíz.
//
// ESTRUCTURA DE LA TABLA:
// Cada fila representa un rango de UVT:
//   d: límite inferior del rango (exclusive; UVT > d)
//   h: límite superior (inclusive; UVT ≤ h)
//   t: tarifa marginal del rango (en %)
//   b: constante acumulada en UVT del impuesto hasta el comienzo del rango
//
// El impuesto se calcula como:
//   impuesto = (b + (uvtBase - d) * t / 100) * UVT_año
// ═══════════════════════════════════════════════════════════════════════════

export const TABLA_ART_241 = [
  { d: 0,     h: 1090,     t: 0,  b: 0 },
  { d: 1090,  h: 1700,     t: 19, b: 0 },
  { d: 1700,  h: 4100,     t: 28, b: 115.86 },
  { d: 4100,  h: 8670,     t: 33, b: 787.86 },
  { d: 8670,  h: 18970,    t: 35, b: 2295.96 },
  { d: 18970, h: 31000,    t: 37, b: 5900.96 },
  { d: 31000, h: Infinity, t: 39, b: 10352.96 },
];

// Calcula el impuesto de renta persona natural aplicando la tabla progresiva.
// @param {number} uvtBase - Base gravable dividida por el UVT del año
// @param {number} UVT - Valor del UVT del año (ej: 49799 para AG 2025)
// @returns {number} Impuesto en pesos
export const calcImpRenta = (uvtBase, UVT) => {
  for (let i = TABLA_ART_241.length - 1; i >= 0; i--) {
    if (uvtBase > TABLA_ART_241[i].d) {
      return (TABLA_ART_241[i].b + (uvtBase - TABLA_ART_241[i].d) * TABLA_ART_241[i].t / 100) * UVT;
    }
  }
  return 0;
};