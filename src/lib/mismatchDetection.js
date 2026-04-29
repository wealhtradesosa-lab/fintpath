// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Detector de mismatch declaración ↔ datos cargados
//
// PROPÓSITO:
//   Cuando el usuario importa una declaración (F-110 jurídica o F-210 natural)
//   tenemos la oportunidad de comparar lo que su contador reportó formalmente
//   con lo que el motor calcula desde los datos que cargó en FINPATHIA.
//
//   Si hay mismatch grande (>20% en campos críticos), eso es señal de alerta
//   que el usuario debe llevar a su contador. NO somos jueces — somos un
//   "check engine" que enciende la luz cuando algo no cuadra.
//
// USO:
//   const mismatches = detectarMismatch(user, owner, estimacion);
//   // → array de { campo, declarado, calculado, diferenciaPct, severidad, mensaje }
//
//   Si mismatches.length === 0 → todo coincide o no hay declaración para comparar
//   Si mismatches.length > 0 → mostrar banner en Plan Tributario Dashboard
//
// FILOSOFÍA:
//   - Threshold conservador: <5% silencio, 5-20% info, >20% warning
//   - Solo campos críticos (ingresos, patrimonio, gastos, impuesto)
//   - Mensaje claro sin acusar a nadie ("verificá con tu contador")
//   - Posibilidad de "marcar como revisado" (persistencia en user.fiscalReviewed)
//
// EJEMPLO REAL (Inversiones Lagoon 2024):
//   F-110 declarado: ingresos brutos $0
//   Motor calcula:   ingresos brutos $1,044M (de los datos cargados)
//   Mismatch:        100% (extremo)
//   Severidad:       warning
//   Mensaje:         "Tu declaración 2024 reportó $0 ingresos pero el motor
//                     calcula $1,044M. Hablá con tu contador: ¿esos ingresos
//                     pertenecen fiscalmente a esta sociedad?"
// ═══════════════════════════════════════════════════════════════════════════

// Threshold de severidad por % de diferencia
const THRESHOLD_INFO = 0.05;     // 5% — diferencia esperable por timing/redondeo
const THRESHOLD_WARNING = 0.20;  // 20% — diferencia que requiere revisión

// Threshold mínimo absoluto: ignorar diferencias <$5M (ruido)
const MIN_ABS_DIFF = 5_000_000;

/**
 * Calcula el % de diferencia entre dos valores.
 * Si declarado es 0, asume que cualquier valor calculado es 100% de diferencia.
 */
function calcularDiferencia(declarado, calculado) {
  const dec = Number(declarado) || 0;
  const calc = Number(calculado) || 0;
  if (dec === 0 && calc === 0) return 0;
  if (dec === 0) return 1.0; // 100% — declaración decía cero pero hay datos
  return Math.abs(calc - dec) / dec;
}

/**
 * Determina severidad según el % de diferencia.
 */
function severidadDe(diferenciaPct, diferenciaAbs) {
  if (diferenciaAbs < MIN_ABS_DIFF) return null; // ignorar
  if (diferenciaPct < THRESHOLD_INFO) return null; // <5% = ok
  if (diferenciaPct < THRESHOLD_WARNING) return "info";
  return "warning";
}

/**
 * Formatea un valor en millones para mensajes
 */
function fmM(v) {
  const m = (Number(v) || 0) / 1e6;
  if (Math.abs(m) >= 1000) return "$" + (m / 1000).toFixed(1) + "B";
  if (Math.abs(m) >= 1) return "$" + m.toFixed(0) + "M";
  if (Math.abs(m) >= 0.1) return "$" + m.toFixed(1) + "M";
  return "$" + Math.round(Number(v) || 0).toLocaleString();
}

/**
 * Compara una declaración F-110 (persona jurídica) con el cálculo del motor.
 * Retorna array de mismatches por campo crítico.
 */
function detectarMismatchJuridica(owner, decRenglones, detalleMotor) {
  const mismatches = [];
  const ano = owner._anoGravable || "año anterior";

  // Campo 1: Ingresos brutos
  const ingDeclarado = +decRenglones.ingresosBrutos || 0;
  const ingCalculado = detalleMotor.ingreso || 0;
  const ingDiff = calcularDiferencia(ingDeclarado, ingCalculado);
  const ingDiffAbs = Math.abs(ingCalculado - ingDeclarado);
  const ingSeveridad = severidadDe(ingDiff, ingDiffAbs);
  if (ingSeveridad) {
    mismatches.push({
      campo: "Ingresos brutos",
      declarado: ingDeclarado,
      calculado: ingCalculado,
      diferenciaAbs: ingDiffAbs,
      diferenciaPct: ingDiff,
      severidad: ingSeveridad,
      mensaje: `Tu declaración ${ano} reportó ${fmM(ingDeclarado)} en ingresos brutos. El motor calcula ${fmM(ingCalculado)} desde los datos cargados. Diferencia: ${fmM(ingDiffAbs)} (${(ingDiff * 100).toFixed(0)}%).`,
      explicaciones: [
        ingDeclarado === 0
          ? "Tu declaración reportó CERO ingresos para esta sociedad pero hay ingresos cargados. Esto puede indicar que: (a) los ingresos pertenecen a otra entidad (vos personal, otra sociedad); (b) el contador no los reportó pero debió hacerlo; (c) los ingresos son posteriores al año declarado."
          : "Verificá con tu contador si: (a) algún ingreso está duplicado o asignado al owner equivocado; (b) hay ingresos diferidos o anticipados que no entran en este año fiscal.",
      ],
    });
  }

  // Campo 2: Patrimonio bruto
  const patDeclarado = +decRenglones.patrimonioBruto || 0;
  // El motor no calcula patrimonio jurídica directamente; lo dejamos para info futura
  // (cuando agreguemos modelo completo de balance)

  // Campo 3: Gastos / costos deducibles totales
  const gastosDeclarado = (+decRenglones.costosDeducciones || 0) + (+decRenglones.totalCostosGastos || 0);
  const gastosCalculado = detalleMotor.gastosDeduc || 0;
  if (gastosDeclarado > 0 || gastosCalculado > 0) {
    const gastosDiff = calcularDiferencia(gastosDeclarado, gastosCalculado);
    const gastosDiffAbs = Math.abs(gastosCalculado - gastosDeclarado);
    const gastosSeveridad = severidadDe(gastosDiff, gastosDiffAbs);
    if (gastosSeveridad) {
      mismatches.push({
        campo: "Gastos deducibles",
        declarado: gastosDeclarado,
        calculado: gastosCalculado,
        diferenciaAbs: gastosDiffAbs,
        diferenciaPct: gastosDiff,
        severidad: gastosSeveridad,
        mensaje: `Tu declaración ${ano} reportó ${fmM(gastosDeclarado)} en costos/gastos deducibles. El motor calcula ${fmM(gastosCalculado)}. Diferencia: ${fmM(gastosDiffAbs)} (${(gastosDiff * 100).toFixed(0)}%).`,
        explicaciones: [
          "Verificá con tu contador: (a) si hay gastos legítimos no cargados en FINPATHIA (asesorías, gastos bancarios, depreciación, provisiones); (b) si hay gastos cargados que el contador no aceptó como deducibles (causalidad Art. 107).",
        ],
      });
    }
  }

  // Campo 4: Impuesto neto
  const impDeclarado = +decRenglones.impuestoCalculado || 0;
  const impCalculado = detalleMotor.impuesto || 0;
  if (impDeclarado > 0 || impCalculado > 0) {
    const impDiff = calcularDiferencia(impDeclarado, impCalculado);
    const impDiffAbs = Math.abs(impCalculado - impDeclarado);
    const impSeveridad = severidadDe(impDiff, impDiffAbs);
    if (impSeveridad) {
      mismatches.push({
        campo: "Impuesto neto",
        declarado: impDeclarado,
        calculado: impCalculado,
        diferenciaAbs: impDiffAbs,
        diferenciaPct: impDiff,
        severidad: impSeveridad,
        mensaje: `Tu declaración ${ano} reportó ${fmM(impDeclarado)} de impuesto neto. El motor calcula ${fmM(impCalculado)} con los datos actuales. Diferencia: ${fmM(impDiffAbs)} (${(impDiff * 100).toFixed(0)}%).`,
        explicaciones: [
          "Esto es consecuencia de los mismatches anteriores en ingresos/gastos. Si esos se aclaran, el impuesto debería cuadrar. También puede ser que tu contador aplicó descuentos/deducciones que no están cargadas en FINPATHIA (CTI, donaciones, depreciación).",
        ],
      });
    }
  }

  return mismatches;
}

/**
 * Compara una declaración F-210 (persona natural) con el cálculo del motor.
 */
function detectarMismatchNatural(owner, decRenglones, detalleMotor) {
  const mismatches = [];
  const ano = owner._anoGravable || "año anterior";

  // Campo 1: Ingresos brutos
  const ingDeclarado = +decRenglones.ingresosBrutos || 0;
  const ingCalculado = detalleMotor.ingreso || 0;
  const ingDiff = calcularDiferencia(ingDeclarado, ingCalculado);
  const ingDiffAbs = Math.abs(ingCalculado - ingDeclarado);
  const ingSeveridad = severidadDe(ingDiff, ingDiffAbs);
  if (ingSeveridad) {
    mismatches.push({
      campo: "Ingresos brutos",
      declarado: ingDeclarado,
      calculado: ingCalculado,
      diferenciaAbs: ingDiffAbs,
      diferenciaPct: ingDiff,
      severidad: ingSeveridad,
      mensaje: `Tu declaración ${ano} reportó ${fmM(ingDeclarado)} en ingresos brutos. El motor calcula ${fmM(ingCalculado)} desde los datos cargados. Diferencia: ${fmM(ingDiffAbs)} (${(ingDiff * 100).toFixed(0)}%).`,
      explicaciones: [
        "Las diferencias en personas naturales suelen explicarse por: (a) ingresos esporádicos del año anterior que no se repetirán; (b) ingresos nuevos del año actual no declarados aún; (c) timing entre devengado y recibido.",
      ],
    });
  }

  // Campo 2: Patrimonio bruto
  const patDeclarado = +decRenglones.patrimonioBruto || 0;
  // El motor calcula patrimonio total via t.nw, pero no por owner. Skip por ahora.

  // Campo 3: Impuesto calculado
  const impDeclarado = +decRenglones.impuestoCalculado || 0;
  const impCalculado = detalleMotor.impuesto || 0;
  if (impDeclarado > 0 || impCalculado > 0) {
    const impDiff = calcularDiferencia(impDeclarado, impCalculado);
    const impDiffAbs = Math.abs(impCalculado - impDeclarado);
    const impSeveridad = severidadDe(impDiff, impDiffAbs);
    if (impSeveridad) {
      mismatches.push({
        campo: "Impuesto neto",
        declarado: impDeclarado,
        calculado: impCalculado,
        diferenciaAbs: impDiffAbs,
        diferenciaPct: impDiff,
        severidad: impSeveridad,
        mensaje: `Tu declaración ${ano} reportó ${fmM(impDeclarado)} de impuesto. El motor calcula ${fmM(impCalculado)}. Diferencia: ${fmM(impDiffAbs)} (${(impDiff * 100).toFixed(0)}%).`,
        explicaciones: [
          "Verificá con tu contador: (a) deducciones aplicadas (medicina, dependientes, intereses vivienda, AFC); (b) rentas exentas declaradas; (c) ingresos no constitutivos de renta.",
        ],
      });
    }
  }

  return mismatches;
}

/**
 * Detecta todos los mismatches por owner del usuario.
 *
 * @param {object} user - El user object con owners + declaraciones
 * @param {object} estimacion - Output de estimarImpuesto(user) con detalle por owner
 * @returns {Array} Lista de objetos { ownerId, ownerName, tipo, anoGravable, mismatches[], revisado }
 */
export function detectarMismatchTodos(user, estimacion) {
  if (!user?.owners || !estimacion?.detalle) return [];
  const reviewed = user.fiscalReviewed || {};

  const resultados = [];
  user.owners.forEach(ow => {
    // Buscar la declaración más reciente
    const decs = ow.declaraciones || [];
    const dec = decs[0] || ow.declaracionAnterior;
    if (!dec || !dec.renglones) return;

    // Buscar el detalle del motor para este owner
    const det = estimacion.detalle.find(d => d.name === ow.name);
    if (!det) return;

    // Inyectar año en owner para mensaje
    const ownerConAno = { ...ow, _anoGravable: dec.anoGravable };

    let mismatches = [];
    if (dec.tipo === "F110" && ow.type === "juridica") {
      mismatches = detectarMismatchJuridica(ownerConAno, dec.renglones, det);
    } else if (dec.tipo === "F210" && ow.type === "natural") {
      mismatches = detectarMismatchNatural(ownerConAno, dec.renglones, det);
    }

    if (mismatches.length === 0) return;

    // Verificar si el user marcó este mismatch como revisado
    const reviewKey = `${ow.id}_${dec.anoGravable}`;
    const revisado = !!reviewed[reviewKey];

    resultados.push({
      ownerId: ow.id,
      ownerName: ow.name,
      tipo: ow.type,
      tipoDeclaracion: dec.tipo,
      anoGravable: dec.anoGravable,
      mismatches,
      severidadMaxima: mismatches.some(m => m.severidad === "warning") ? "warning" : "info",
      revisado,
      reviewKey,
    });
  });

  return resultados;
}

/**
 * Helper: marca un mismatch como revisado en el user object.
 * El componente debe persistir esto via setU/upd.
 */
export function marcarRevisado(user, reviewKey) {
  return {
    ...user,
    fiscalReviewed: {
      ...(user.fiscalReviewed || {}),
      [reviewKey]: {
        revisadoEn: new Date().toISOString(),
      },
    },
  };
}

/**
 * Helper: desmarca un mismatch (volver a mostrarlo)
 */
export function desmarcarRevisado(user, reviewKey) {
  const fr = { ...(user.fiscalReviewed || {}) };
  delete fr[reviewKey];
  return { ...user, fiscalReviewed: fr };
}
