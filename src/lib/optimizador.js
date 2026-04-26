// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · Motor de optimización fiscal V2 (Commit 1: infraestructura)
// ─────────────────────────────────────────────────────────────────────────
// Objetivo de este módulo:
// Reemplazar la lógica actual de "Optimizado" del motor (taxCO.js) que solo
// considera UNA palanca opcional (PV/AFC). En su lugar, calcular el mejor
// escenario aplicando todas las palancas detectables automáticamente, con
// desglose explícito de qué se aplicó y cuánto contribuyó cada una.
//
// ESTADO ACTUAL: Commit 1 - placeholder con API estable. NO hace nada.
// El motor (taxCO.js) sigue operando idéntico hasta el Commit 4 cuando
// se hará la integración bajo flag OPTIMIZADOR_V2_ENABLED.
//
// PALANCAS QUE SE IRÁN AGREGANDO (Commits 2-7):
//   Commit 2 - Régimen Simple naturales (Arts. 903-916 ET)
//   Commit 3 - Régimen Simple jurídicas
//   Commit 5 - Reclasificación deuda → vivienda habitacional (Art. 119)
//   Commit 6 - Reclasificación seguros (Art. 387 #2)
//
// LO QUE NO SE AUTOMATIZA (sigue como sugerencia en panel oportunidades):
//   - Aportar más a PV/AFC (implica aporte real del usuario)
//   - Aportar sobre IBC tope (implica reducir líquido mensual)
//   - Donaciones a ESAL (implica gasto real)
//   - Cargar gastos del inmueble no documentados (requiere facturas reales)
// La distinción es clave: "optimizado" debe significar "lo mejor que se puede
// hacer con los datos actuales" - no "lo mejor si gastás más plata".
// ═════════════════════════════════════════════════════════════════════════

/**
 * Flag de feature. Cuando false, el motor sigue operando con la lógica
 * legacy de taxCO.js (única palanca PV/AFC). Cuando true, el motor llama
 * a calcularEscenarioOptimo() para obtener det.impOptBruto.
 *
 * Permanecerá en false hasta que todos los commits 2-6 estén completos
 * y validados con snapshot tests.
 */
export const OPTIMIZADOR_V2_ENABLED = false;

/**
 * Calcula el mejor escenario fiscal posible para un owner aplicando todas
 * las palancas automatizables detectables, respetando topes globales del ET.
 *
 * @param {object} user - Estado completo del usuario (todos los owners,
 *                        ingresos, gastos, deudas, inversiones, etc.)
 * @param {object} owner - Owner específico para el cual optimizar
 * @param {object} detActual - Detalle del cálculo actual (output de
 *                              estimarImpuesto en taxCO.js para este owner)
 * @returns {object} Resultado de optimización con estructura:
 *   {
 *     impuestoOptimo: number,           // impuesto en el escenario óptimo
 *     ahorroTotal: number,              // detActual.impuesto - impuestoOptimo
 *     palancasAplicadas: [{             // qué palancas se activaron
 *       codigo: string,                 // ej: "REGIMEN_SIMPLE"
 *       nombre: string,                 // ej: "Cambio a Régimen Simple"
 *       articulo: string,               // ej: "Arts. 903-916 ET"
 *       impactoReal: number,            // ahorro estimado por esta palanca
 *       descripcion: string,            // explicación user-friendly
 *     }],
 *     detalleEscenario: object,         // snapshot del escenario óptimo
 *                                       // (mismo shape que detActual)
 *   }
 *
 * COMMIT 1: placeholder. Devuelve el escenario actual sin cambios y sin
 * palancas aplicadas. Esto garantiza que quien importe esta función y la
 * use no rompe nada hasta que se implementen las palancas reales.
 */
export function calcularEscenarioOptimo(user, owner, detActual) {
  // Validación defensiva: si entrada inválida, devolver estructura vacía
  // pero válida en lugar de crashear.
  if (!detActual || typeof detActual !== "object") {
    return {
      impuestoOptimo: 0,
      ahorroTotal: 0,
      palancasAplicadas: [],
      detalleEscenario: null,
    };
  }

  const impuestoActual = Number(
    detActual.impBruto != null ? detActual.impBruto : detActual.impuesto || 0
  );

  // PLACEHOLDER (Commit 1): no aplicar ninguna palanca.
  // Las palancas reales se irán agregando en Commits 2-6.
  return {
    impuestoOptimo: impuestoActual,
    ahorroTotal: 0,
    palancasAplicadas: [],
    detalleEscenario: { ...detActual },
  };
}

/**
 * Detecta qué palancas son automatizables para este owner según sus datos.
 * Cada palanca es un objeto con su lógica de aplicación encapsulada.
 *
 * @param {object} user
 * @param {object} owner
 * @param {object} detActual
 * @returns {Array<Palanca>} Lista de palancas aplicables, ordenadas por
 *                            impacto estimado descendente.
 *
 * COMMIT 1: devuelve array vacío. Las palancas reales se agregarán en
 * Commits 2-6.
 *
 * Estructura esperada de Palanca (definida formalmente en Commit 2):
 *   {
 *     codigo: string,
 *     nombre: string,
 *     articulo: string,
 *     impactoEstimado: number,
 *     elegibilidad: () => boolean,
 *     aplicar: (escenario) => { aceptable, nuevoEscenario, ahorro }
 *   }
 */
export function detectarPalancasAutomatizables(user, owner, detActual) {
  // PLACEHOLDER (Commit 1): sin palancas.
  // Voids para evitar warnings de variables no usadas que se usarán pronto.
  void user; void owner; void detActual;
  return [];
}

/**
 * Helper para Commits 4+: aplica una palanca a un escenario respetando los
 * topes globales acumulados (Art. 336 #3 ET). Devuelve el nuevo escenario
 * o el escenario original si la palanca no fue aceptable.
 *
 * @param {object} escenario - Snapshot actual (mismo shape que detActual)
 * @param {Palanca} palanca - Palanca a aplicar
 * @returns {object} { aceptable, nuevoEscenario, ahorro }
 *
 * COMMIT 1: placeholder. Devuelve el escenario sin cambios.
 */
export function aplicarPalancaSegura(escenario, palanca) {
  void palanca;
  return {
    aceptable: false,
    nuevoEscenario: { ...escenario },
    ahorro: 0,
  };
}
