// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · retencionesTax.js — Tabla maestra de retenciones en la fuente
//
// PROPÓSITO:
//   Centralizar las tasas de retención en la fuente colombianas según el
//   fiscalCode del ingreso. Antes estas tasas estaban hardcoded en taxCO.js
//   sin posibilidad de override por el usuario. Con este módulo:
//   - Las tasas son configurables (DIAN cambia tarifas con frecuencia)
//   - El user puede override por ingreso (ing.retencionConfig)
//   - El user puede override global por owner (descuentosTributarios.retencionesEsperadasAnual)
//
// PRIORIDAD DE CÁLCULO (de mayor a menor):
//   1. Override global del owner (retencionesEsperadasAnual) — pisa todo
//   2. Override por ingreso (retencionConfig.tasaCustom o aplica:false)
//   3. Tasa default de la tabla
//   4. Si no hay tasa default → 2.5% (default conservador para "otros")
//
// FUENTE LEGAL:
//   - Art. 401 ET: arrendamientos
//   - Art. 395 ET: rendimientos financieros (intereses)
//   - Art. 392 ET: honorarios
//   - Art. 383 ET: rentas de trabajo (tabla progresiva, no aquí)
//   - Decreto 1457 / Art. 245 ET: dividendos
//   - Art. 48 ET: dividendos inter-societarios (NO retención)
//
// IMPORTANTE:
//   Las retenciones aplican solo si quien paga es "agente retenedor" (típicamente
//   personas jurídicas, grandes contribuyentes, declarantes). Si un inquilino
//   persona natural paga arriendo, NO retiene. Para esos casos el user debe
//   usar el toggle "no aplica retención" en el ingreso.
// ═══════════════════════════════════════════════════════════════════════════

// Tabla central de tasas default. Cada entrada incluye:
//   - tasa: % decimal (0.07 = 7%)
//   - articulo: para mostrar al user de dónde sale
//   - retenedor: pista de quién típicamente retiene
//   - aplicaJur: si aplica para owner jurídica
//   - aplicaNat: si aplica para owner persona natural (algunas son distintas)
export const RETENCIONES_DEFAULT = {
  // ── Rendimientos financieros (Art. 395 ET) ──────────────────────────────
  CAP_INTERESES_BANCARIOS: {
    tasa: 0.07,
    articulo: "Art. 395 ET",
    retenedor: "Banco / emisor",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Intereses CDT, cuentas remuneradas, bonos, papeles comerciales",
  },
  CAP_RENDIMIENTO_GENERICO: {
    tasa: 0.07,
    articulo: "Art. 395 ET",
    retenedor: "Banco / emisor",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Rendimientos financieros sin clasificar",
  },
  CAP_FIC: {
    tasa: 0,
    articulo: "Art. 23-1 ET",
    retenedor: "N/A",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Fondos de Inversión Colectiva — retención a nivel del fondo, no del partícipe",
  },

  // ── Arrendamientos (Art. 401 ET) ────────────────────────────────────────
  NOL_ARRIENDO_INMUEBLE: {
    tasa: 0.035,
    articulo: "Art. 401 ET",
    retenedor: "Inquilino (si es agente retenedor)",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Arrendamiento de inmuebles. Solo retiene si el inquilino es persona jurídica o agente retenedor declarante.",
    advertencia: "Si tu inquilino es persona natural NO declarante, NO retiene. Usá el toggle 'No aplica' para este ingreso.",
  },
  NOL_ARRIENDO_BIENES_MUEBLES: {
    tasa: 0.04,
    articulo: "Art. 401 ET",
    retenedor: "Arrendatario jurídico",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Arriendo de bienes muebles (vehículos, maquinaria)",
  },

  // ── Dividendos (Art. 245 / Decreto 1457 / Art. 48 ET) ───────────────────
  DIV_DIVIDENDOS_GRAVADOS: {
    tasa: 0.075,
    articulo: "Art. 245 ET",
    retenedor: "Sociedad pagadora",
    aplicaJur: false,  // jurídicas residentes: 0% (Art. 48 ET en mayoría de casos)
    aplicaNat: true,
    descripcion: "Dividendos gravados a personas naturales residentes (7.5%)",
  },
  DIV_INTERSOCIETARIOS: {
    tasa: 0,
    articulo: "Art. 48 ET",
    retenedor: "N/A",
    aplicaJur: true,
    aplicaNat: false,
    descripcion: "Dividendos inter-societarios — NO retención",
  },

  // ── Honorarios y servicios (Art. 392 ET) ────────────────────────────────
  LAB_HONORARIOS_CON_EMPLEADOS: {
    tasa: 0.11,
    articulo: "Art. 392 ET",
    retenedor: "Cliente jurídico",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Honorarios profesionales (firma con vinculados o estructura)",
  },
  LAB_HONORARIOS_SIN_EMPLEADOS: {
    tasa: 0.10,
    articulo: "Art. 392 ET",
    retenedor: "Cliente jurídico",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Honorarios profesionales independientes (sin empleados)",
  },
  LAB_SERVICIOS: {
    tasa: 0.04,
    articulo: "Art. 392 ET",
    retenedor: "Cliente jurídico",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Prestación de servicios generales",
  },
  LAB_COMISIONES: {
    tasa: 0.10,
    articulo: "Art. 392 ET",
    retenedor: "Pagador",
    aplicaJur: true,
    aplicaNat: true,
    descripcion: "Comisiones",
  },

  // ── Salarios (NO se calcula aquí, va por tabla progresiva Art. 383) ─────
  LAB_SALARIO: {
    tasa: null, // Tabla progresiva — el motor lo calcula aparte
    articulo: "Art. 383 ET",
    retenedor: "Empleador",
    aplicaJur: false,
    aplicaNat: true,
    descripcion: "Salarios — tabla de retención progresiva",
  },
  LAB_PENSIONES: {
    tasa: null, // Tabla progresiva similar a salarios
    articulo: "Art. 206-5 ET",
    retenedor: "Fondo de pensiones",
    aplicaJur: false,
    aplicaNat: true,
    descripcion: "Pensiones — tabla progresiva, exenta hasta 1000 UVT mensuales",
  },

  // ── Operacional / ventas (default conservador 2.5%) ─────────────────────
  ING_JUR_OPERACIONAL: {
    tasa: 0.025,
    articulo: "Art. 401 ET",
    retenedor: "Cliente jurídico",
    aplicaJur: true,
    aplicaNat: false,
    descripcion: "Ingresos operacionales (compras / ventas generales)",
  },
};

/**
 * Calcula retención estimada para UN ingreso.
 *
 * @param {object} ing - El objeto ingreso con fiscalCode, mensual, retencionConfig opcional
 * @param {string} ownerType - 'juridica' o 'natural'
 * @param {number} trm - Tasa USD→COP para ingresos en USD
 * @returns {object} { anual: number, tasa: number, fuente: string }
 *   fuente: 'override_item' | 'override_disabled' | 'default_table' | 'default_25' | 'no_aplica'
 */
export function calcularRetencionIngreso(ing, ownerType = "natural", trm = 4200) {
  const m = (ing.mensual || 0) * (ing.moneda === "USD" ? trm : 1) * 12;
  const cfg = ing.retencionConfig || {};

  // Override 1: user marcó explícitamente "no aplica"
  if (cfg.aplica === false) {
    return { anual: 0, tasa: 0, fuente: "override_disabled" };
  }

  // Override 2: user puso una tasa custom
  if (cfg.tasaCustom != null && Number(cfg.tasaCustom) >= 0) {
    const tasa = Number(cfg.tasaCustom);
    return { anual: m * tasa, tasa, fuente: "override_item" };
  }

  // Default 1: tabla central
  const def = RETENCIONES_DEFAULT[ing.fiscalCode];
  if (def) {
    // Verificar si aplica para este tipo de owner
    const aplicaParaOwner = ownerType === "juridica" ? def.aplicaJur : def.aplicaNat;
    if (!aplicaParaOwner || def.tasa == null) {
      return { anual: 0, tasa: 0, fuente: "no_aplica" };
    }
    return { anual: m * def.tasa, tasa: def.tasa, fuente: "default_table" };
  }

  // Default 2: 2.5% conservador para fiscalCodes desconocidos (solo jurídica)
  if (ownerType === "juridica") {
    return { anual: m * 0.025, tasa: 0.025, fuente: "default_25" };
  }

  return { anual: 0, tasa: 0, fuente: "no_aplica" };
}

/**
 * Calcula retención total para un owner (suma de todos sus ingresos).
 * Aplica override global si existe.
 *
 * @param {Array} ingresos - Lista de ingresos del owner (ya filtrados)
 * @param {object} owner - El owner object con descuentosTributarios opcional
 * @param {number} trm - Tasa USD→COP
 * @returns {object} {
 *   total: number,
 *   fuente: 'override_global' | 'estimacion_automatica',
 *   detallePorIngreso: [{ nombre, anual, tasa, fuente }],
 *   estimacionAutomatica: number  // siempre incluido para mostrar comparación
 * }
 */
export function calcularRetencionOwner(ingresos, owner, trm = 4200) {
  const ownerType = owner?.type || "natural";

  // Calcular estimación automática (siempre, aunque haya override)
  const detallePorIngreso = (ingresos || []).map(ing => {
    const r = calcularRetencionIngreso(ing, ownerType, trm);
    return {
      nombre: ing.nombre || ing.fuente || "Sin nombre",
      fiscalCode: ing.fiscalCode,
      anual: r.anual,
      tasa: r.tasa,
      fuente: r.fuente,
    };
  });
  const estimacionAutomatica = detallePorIngreso.reduce((s, d) => s + d.anual, 0);

  // Override global del owner: pisa la estimación
  const override = Number(owner?.descuentosTributarios?.retencionesEsperadasAnual);
  if (override > 0) {
    return {
      total: override,
      fuente: "override_global",
      detallePorIngreso,
      estimacionAutomatica,
    };
  }

  return {
    total: estimacionAutomatica,
    fuente: "estimacion_automatica",
    detallePorIngreso,
    estimacionAutomatica,
  };
}

/**
 * Helper para obtener info de la tabla para mostrar en UI
 * (qué tasa default tiene un fiscalCode, su artículo, etc.)
 */
export function obtenerInfoRetencion(fiscalCode, ownerType = "natural") {
  const def = RETENCIONES_DEFAULT[fiscalCode];
  if (!def) {
    return ownerType === "juridica"
      ? { tasa: 0.025, articulo: "default", descripcion: "Tasa conservadora 2.5% (fiscalCode no clasificado)", retenedor: "Cliente" }
      : null;
  }
  const aplicaParaOwner = ownerType === "juridica" ? def.aplicaJur : def.aplicaNat;
  if (!aplicaParaOwner) return null;
  return def;
}
