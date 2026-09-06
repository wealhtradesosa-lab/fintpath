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

// Commit 21 Tarea 3: integración de Régimen Simple como primera palanca real
// del Optimizador V2. Ya tenemos el detector + simulador en regimenSimple.js.
// Aquí los envolvemos en el shape estándar de "Palanca" del optimizador.
import { simularRegimenSimple } from "./regimenSimple.js";

// Commit 24 Tarea 3 (BUG FIX): NO importar UVT desde taxCO.js (ciclo con regimenSimple).
// Mantener constante local alineada al default AG 2025 — ver UVT_BY_AG en taxCO.js.
const UVT = 49799;

/**
 * Construye una palanca de Régimen Simple si el owner es elegible.
 * @returns {Palanca | null} La palanca, o null si no aplica.
 *
 * Características:
 *   - codigo: 'REGIMEN_SIMPLE'
 *   - articulo: 'Arts. 903-916 ET'
 *   - impacto = ahorro de la mejorOpcion devuelta por simularRegimenSimple
 *
 * IMPORTANTE: la decisión de cambiar a SIMPLE es ESTRATÉGICA, no automática:
 *   - Requiere cambio formal del régimen ante DIAN
 *   - Una vez en SIMPLE no se puede salir hasta el siguiente año
 *   - Implica cambios contables (no factura IVA, paga ICA dentro del SIMPLE)
 *
 * Por eso esta palanca es 'sugerida', no 'auto-aplicada'. El optimizador la
 * marca como detectada pero no la suma automáticamente al impuestoOptimo. La
 * UI debe mostrarla como recomendación con call-to-action explícito.
 */
function construirPalancaRegimenSimple(user, owner, detActual) {
  void user;
  // Solo evaluamos para owners en régimen ordinario (los que ya están en SIMPLE
  // no tienen nada que optimizar acá).
  if (owner?.regimen === "simple") return null;
  // Solo natural y juridica que tengan ingresos
  if (!owner || !detActual) return null;
  if ((Number(detActual.ingreso) || 0) <= 0) return null;

  const sim = simularRegimenSimple(owner, detActual, UVT);
  if (!sim.elegibilidad.elegible) return null;
  if (!sim.mejorOpcion) return null; // no hay grupo que ahorre
  if (sim.mejorOpcion.ahorro <= 100_000) return null; // ahorro insignificante

  return {
    codigo: "REGIMEN_SIMPLE",
    nombre: "Cambio a Régimen Simple",
    articulo: "Arts. 903-916 ET",
    impactoEstimado: sim.mejorOpcion.ahorro,
    descripcion: `Bajo el grupo "${sim.mejorOpcion.label}" del Régimen Simple, este owner pagaría aproximadamente ${formatearCOP(sim.mejorOpcion.impuestoSimple)} en lugar de ${formatearCOP(sim.mejorOpcion.impuestoOrdinario)}, ahorrando ~${(sim.mejorOpcion.ahorroPct).toFixed(0)}%.`,
    // Datos crudos para que la UI pueda mostrar más detalle si quiere
    datos: {
      simulacion: sim,
      mejorOpcion: sim.mejorOpcion,
    },
    // Esta palanca NO se auto-aplica al impuestoOptimo. Es decisión del usuario.
    autoAplicable: false,
    elegibilidad: () => true,
    aplicar: (escenario) => ({
      aceptable: false, // sugerencia, no aplicación automática
      nuevoEscenario: { ...escenario },
      ahorro: 0,
    }),
  };
}

function formatearCOP(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

/**
 * Detecta qué palancas son automatizables para este owner según sus datos.
 *
 * @returns {Array<Palanca>} Lista ordenada por impacto descendente.
 *
 * COMMIT 21: integración de la palanca de Régimen Simple. Más palancas
 * vendrán en commits posteriores (reclasificación deuda, seguros, etc).
 */
export function detectarPalancasAutomatizables(user, owner, detActual) {
  const palancas = [];

  // Palanca 1: Régimen Simple (Arts. 903-916 ET)
  const palancaSimple = construirPalancaRegimenSimple(user, owner, detActual);
  if (palancaSimple) palancas.push(palancaSimple);

  // Más palancas se agregan aquí en commits futuros...

  // Ordenar por impacto descendente (la mayor primero)
  palancas.sort((a, b) => (b.impactoEstimado || 0) - (a.impactoEstimado || 0));
  return palancas;
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