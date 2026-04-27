// ═══════════════════════════════════════════════════════════════════════════
// RÉGIMEN SIMPLE (RST) — Arts. 903-916 ET
// ─────────────────────────────────────────────────────────────────────────
// Tarifas reales por grupo de actividad y tramo de ingreso anual en UVT,
// tomadas del Art. 908 ET vigente (Reforma Tributaria Ley 2277/2022).
//
// Estructura: para cada grupo, un array de tramos { hastaUVT, tarifa }.
// El último tramo tiene hastaUVT = Infinity.
//
// Cálculo: el impuesto se aplica por tramo MARGINAL (como renta ordinaria),
// no escalón fijo. Eso significa que dentro de un grupo, los primeros N UVT
// pagan la tarifa del primer tramo, los siguientes pagan la del segundo, etc.
//
// También se mantiene una lista de exclusiones del Art. 906 ET — si una
// SAS cae en una de estas actividades, SIMPLE no aplica. La validación es
// manual (el usuario confirma el grupo) porque el CIIU exacto lo conoce
// el contador, no el motor.
// ═══════════════════════════════════════════════════════════════════════════

// Grupos del Art. 908 ET con sus tramos MARGINALES (desde — hasta — tarifa).
// Fuente: DIAN, RST vigente 2025-2026.
export const GRUPOS_SIMPLE = {
  // GRUPO 1: Tiendas pequeñas, mini-mercados, micro-mercados y peluquerías.
  "tiendas_peluquerias": {
    label: "Tiendas pequeñas, mini-mercados, peluquerías",
    descripcion: "Comercio minorista básico, servicios de estética básicos",
    tramos: [
      { hastaUVT: 6000,  tarifa: 0.012 },  // 1.2%
      { hastaUVT: 15000, tarifa: 0.028 },  // 2.8%
      { hastaUVT: 30000, tarifa: 0.042 },  // 4.2%
      { hastaUVT: Infinity, tarifa: 0.054 }, // 5.4%
    ],
  },
  // GRUPO 2: Actividades comerciales al por mayor y detal; industrias;
  // servicios técnicos y mecánicos; electricistas; albañiles; construcción.
  "comercio_industria": {
    label: "Comercio, industria, construcción, servicios técnicos",
    descripcion: "Comercio al por mayor/detal, manufactura, construcción, albañilería, electricidad, servicios técnicos",
    tramos: [
      { hastaUVT: 6000,  tarifa: 0.016 },  // 1.6%
      { hastaUVT: 15000, tarifa: 0.020 },  // 2.0%
      { hastaUVT: 30000, tarifa: 0.035 },  // 3.5%
      { hastaUVT: Infinity, tarifa: 0.045 }, // 4.5%
    ],
  },
  // GRUPO 3: Servicios profesionales, de consultoría y científicos en los
  // que predomine el factor intelectual sobre el material, incluidos los
  // servicios de profesiones liberales.
  "servicios_profesionales": {
    label: "Servicios profesionales, consultoría, profesiones liberales",
    descripcion: "Consultoría, asesoría, servicios científicos, profesiones liberales (contadores, abogados, arquitectos, etc.)",
    tramos: [
      { hastaUVT: 6000,  tarifa: 0.072 },  // 7.2%
      { hastaUVT: 15000, tarifa: 0.120 },  // 12.0%
      { hastaUVT: Infinity, tarifa: 0.137 },  // 13.7% (el más alto en SIMPLE)
    ],
  },
  // GRUPO 4: Actividades de expendio de comidas y bebidas, y actividades
  // de transporte.
  "comidas_transporte": {
    label: "Expendio de comidas/bebidas, transporte",
    descripcion: "Restaurantes, bares, cafeterías, servicios de transporte",
    tramos: [
      { hastaUVT: 6000,  tarifa: 0.032 },  // 3.2%
      { hastaUVT: 15000, tarifa: 0.054 },  // 5.4%
      { hastaUVT: 30000, tarifa: 0.070 },  // 7.0%
      { hastaUVT: Infinity, tarifa: 0.085 }, // 8.5%
    ],
  },
  // GRUPO 5: Educación y actividades de atención de la salud humana.
  "educacion_salud": {
    label: "Educación y salud humana",
    descripcion: "Instituciones educativas, consultorios médicos, servicios de salud (no IPS complejas)",
    tramos: [
      { hastaUVT: 6000,  tarifa: 0.024 },  // 2.4%
      { hastaUVT: 15000, tarifa: 0.034 },  // 3.4%
      { hastaUVT: 30000, tarifa: 0.044 },  // 4.4%
      { hastaUVT: Infinity, tarifa: 0.048 }, // 4.8%
    ],
  },
};

// Tope legal para acceder al régimen SIMPLE (Art. 905 ET).
export const TOPE_SIMPLE_UVT = 100_000;

// ─────────────────────────────────────────────────────────────────────────
// Exclusiones del Art. 906 ET
// ─────────────────────────────────────────────────────────────────────────
// Lista de categorías de actividad que NO pueden acogerse al SIMPLE.
// La validación se hace por flag explícito del owner (ow.simpleExcluido)
// porque requiere conocer el CIIU y detalles del negocio.
export const EXCLUSIONES_SIMPLE = [
  { code: "financiera", label: "Entidades financieras, aseguradoras, fiduciarias" },
  { code: "combustibles", label: "Distribución de combustibles líquidos" },
  { code: "energia", label: "Generación, transmisión o distribución de energía eléctrica" },
  { code: "activos_fijos", label: "Empresa cuya actividad principal es venta de activos fijos" },
  { code: "minera", label: "Actividades mineras y extracción de hidrocarburos" },
  { code: "extranjera", label: "Personas naturales sin residencia fiscal en Colombia" },
  { code: "sociedad_socios_excluidos", label: "Sociedad cuyos socios/accionistas estén en SIMPLE por ingresos personales" },
];

// ─────────────────────────────────────────────────────────────────────────
// Cálculo del impuesto SIMPLE sobre ingresos anuales, según grupo y UVT.
// Usa aplicación MARGINAL por tramo (no tarifa plana).
// ─────────────────────────────────────────────────────────────────────────
/**
 * @param {number} ingresoAnual - ingresos brutos anuales en COP.
 * @param {string} grupoKey - clave en GRUPOS_SIMPLE.
 * @param {number} uvt - valor UVT del año (ej: 52374 para 2026).
 * @returns {{ impuesto: number, tarifaEfectiva: number, desglose: Array<{hasta:number, tarifa:number, aporte:number}> }}
 */
export function calcularImpuestoSimple(ingresoAnual, grupoKey, uvt) {
  const grupo = GRUPOS_SIMPLE[grupoKey];
  if (!grupo) {
    // Fallback conservador: usar tarifa más alta de grupo profesional (13.7%)
    // para que la recomendación NUNCA sobrestime el ahorro por falta de dato.
    return {
      impuesto: ingresoAnual * 0.137,
      tarifaEfectiva: 0.137,
      desglose: [{ hasta: Infinity, tarifa: 0.137, aporte: ingresoAnual * 0.137 }],
      fallback: true,
    };
  }
  const ingresoUVT = ingresoAnual / uvt;
  let impuesto = 0;
  let restante = ingresoUVT;
  let previoLimite = 0;
  const desglose = [];
  for (const tramo of grupo.tramos) {
    if (restante <= 0) break;
    const anchoTramoUVT = Math.min(tramo.hastaUVT, ingresoUVT) - previoLimite;
    const aplica = Math.min(restante, anchoTramoUVT);
    const aporteUVT = aplica * tramo.tarifa;
    const aporteCOP = aporteUVT * uvt;
    impuesto += aporteCOP;
    desglose.push({
      hasta: tramo.hastaUVT === Infinity ? Infinity : tramo.hastaUVT * uvt,
      tarifa: tramo.tarifa,
      aporte: aporteCOP,
    });
    restante -= aplica;
    previoLimite = tramo.hastaUVT;
    if (tramo.hastaUVT === Infinity) break;
  }
  const tarifaEfectiva = ingresoAnual > 0 ? impuesto / ingresoAnual : 0;
  return { impuesto, tarifaEfectiva, desglose };
}

// ═════════════════════════════════════════════════════════════════════════
// COMMIT 20a TAREA 3: DETECTOR DE ELEGIBILIDAD PARA RÉGIMEN SIMPLE
// ─────────────────────────────────────────────────────────────────────────
// Determina si un owner (natural o jurídica) calificaría para Régimen Simple
// según los criterios del Art. 905 ET y exclusiones del Art. 906 ET.
//
// La validación es CONSERVADORA: solo dice "elegible" cuando hay alta
// confianza. Cuando hay duda, devuelve "necesita_validar" con la razón.
// El usuario final con su contador valida si el grupo CIIU es correcto.
//
// @param {Object} owner - el owner del usuario
// @param {Object} det - detalle ya calculado del owner por estimarImpuesto()
// @param {number} uvt - valor del UVT del año
// @returns {{
//   elegible: boolean,
//   razon: string,
//   gruposCandidatos: string[],
//   ingresoAnual: number,
//   ingresoUVT: number
// }}
// ═════════════════════════════════════════════════════════════════════════
export function esElegibleRegimenSimple(owner, det, uvt) {
  const ingresoAnual = Number(det?.ingreso) || 0;
  const ingresoUVT = ingresoAnual / uvt;

  // Defensive: caso vacío
  if (!owner || !det) {
    return { elegible: false, razon: "Sin datos del owner", gruposCandidatos: [], ingresoAnual: 0, ingresoUVT: 0 };
  }

  // Exclusión 1: tope de ingresos (Art. 905 ET = 100.000 UVT)
  if (ingresoUVT > TOPE_SIMPLE_UVT) {
    return {
      elegible: false,
      razon: `Ingresos anuales (${ingresoUVT.toFixed(0)} UVT) superan el tope legal de ${TOPE_SIMPLE_UVT} UVT (Art. 905 ET)`,
      gruposCandidatos: [],
      ingresoAnual,
      ingresoUVT,
    };
  }

  // Exclusión 2: flag explícito del usuario (Art. 906 ET)
  if (owner.simpleExcluido) {
    return {
      elegible: false,
      razon: "Marcado como excluido (Art. 906 ET) — actividad financiera, profesional grande, importadora, etc.",
      gruposCandidatos: [],
      ingresoAnual,
      ingresoUVT,
    };
  }

  // Exclusión 3: sin ingresos no se puede simular
  if (ingresoAnual <= 0) {
    return {
      elegible: false,
      razon: "Sin ingresos registrados — no hay base para simular Régimen Simple",
      gruposCandidatos: [],
      ingresoAnual,
      ingresoUVT,
    };
  }

  // Exclusión 4: asalariado puro (todo el ingreso es LAB_SALARIO).
  // El Régimen Simple es para emprendedores/profesionales independientes/empresas.
  // Un asalariado puro no puede acogerse — la relación laboral implica retención
  // ordinaria del Art. 383 ET, no SIMPLE.
  // Detectamos: si > 90% del ingreso es laboral salario (no honorarios), excluir.
  const ingLaboralSalario = Number(det.ingLaboral) || 0;
  // ingLaboral incluye honorarios + cesantías + prima. Para detectar asalariado puro
  // miramos si el owner NO tiene honorarios significativos.
  // Aproximación: si tiene perfil "honorariosConPersonal" o tiene honorarios cargados
  // se considera independiente; si es solo salario puro, asalariado.
  const tieneHonorarios = !!(owner.fiscalProfile?.honorariosConPersonal) || (det.honAnual || 0) > 0;
  const esAsalariadoPuro = owner.type === "natural"
    && ingLaboralSalario / Math.max(ingresoAnual, 1) > 0.90
    && !tieneHonorarios;
  if (esAsalariadoPuro) {
    return {
      elegible: false,
      razon: "Asalariado puro — Régimen Simple no aplica (la retención laboral del Art. 383 ET es el mecanismo correcto)",
      gruposCandidatos: [],
      ingresoAnual,
      ingresoUVT,
    };
  }

  // Si pasamos todas las exclusiones, el owner ES elegible.
  // Sugerimos grupos candidatos basándose en el tipo de owner y heurísticas:
  const gruposCandidatos = [];
  if (owner.type === "juridica") {
    // Una jurídica pudo cargar actividad. Si no hay claridad, sugerimos los
    // 3 grupos más comunes para que el usuario elija con su contador.
    gruposCandidatos.push("comercio_industria", "servicios_profesionales", "comidas_transporte");
  } else {
    // Natural con honorarios: típicamente servicios profesionales.
    if (tieneHonorarios) {
      gruposCandidatos.push("servicios_profesionales");
    }
    // Cualquier natural con ingresos no laborales podría tener actividad comercial
    if ((det.ingNoLaboral || 0) > 0) {
      gruposCandidatos.push("comercio_industria", "tiendas_peluquerias");
    }
    if (gruposCandidatos.length === 0) {
      gruposCandidatos.push("servicios_profesionales");
    }
  }

  return {
    elegible: true,
    razon: `Cumple criterios Art. 905 ET (ingresos ${ingresoUVT.toFixed(0)} UVT < ${TOPE_SIMPLE_UVT} UVT) — necesita confirmación de grupo de actividad`,
    gruposCandidatos,
    ingresoAnual,
    ingresoUVT,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// COMMIT 20b TAREA 3: SIMULADOR COMPARATIVO ORDINARIO vs SIMPLE
// ─────────────────────────────────────────────────────────────────────────
// Compara el impuesto del owner bajo régimen ordinario (lo que el motor ya
// calculó en det.impBruto) vs lo que pagaría bajo Régimen Simple, para cada
// grupo candidato. Devuelve el ahorro potencial y la recomendación.
//
// IMPORTANTE: El cálculo SIMPLE no acepta deducciones (es sobre ingreso bruto).
// Por eso el impuesto Ordinario debe leerse como "lo que paga HOY" después de
// todas las deducciones legales. El comparativo es honesto.
//
// @param {Object} owner
// @param {Object} det - detalle del motor (incluye impBruto del régimen ordinario)
// @param {number} uvt
// @returns {{
//   elegibilidad: <result de esElegibleRegimenSimple>,
//   simulaciones: Array<{
//     grupo: string,
//     label: string,
//     impuestoSimple: number,
//     impuestoOrdinario: number,
//     ahorro: number,           // positivo = SIMPLE conviene
//     ahorroPct: number,         // % de ahorro vs ordinario
//     recomendacion: 'simple_conviene' | 'ordinario_conviene' | 'similar'
//   }>,
//   mejorOpcion: <una de simulaciones> | null
// }}
// ═════════════════════════════════════════════════════════════════════════
export function simularRegimenSimple(owner, det, uvt) {
  const elegibilidad = esElegibleRegimenSimple(owner, det, uvt);

  if (!elegibilidad.elegible) {
    return {
      elegibilidad,
      simulaciones: [],
      mejorOpcion: null,
    };
  }

  const impuestoOrdinario = Number(det?.impBruto) || 0;
  const ingresoAnual = elegibilidad.ingresoAnual;

  const simulaciones = elegibilidad.gruposCandidatos.map(grupoKey => {
    const grupo = GRUPOS_SIMPLE[grupoKey];
    const calc = calcularImpuestoSimple(ingresoAnual, grupoKey, uvt);
    const ahorro = impuestoOrdinario - calc.impuesto;
    const ahorroPct = impuestoOrdinario > 0 ? (ahorro / impuestoOrdinario) * 100 : 0;
    let recomendacion;
    if (Math.abs(ahorro) < 100_000) {
      recomendacion = "similar";
    } else if (ahorro > 0) {
      recomendacion = "simple_conviene";
    } else {
      recomendacion = "ordinario_conviene";
    }
    return {
      grupo: grupoKey,
      label: grupo?.label || grupoKey,
      descripcion: grupo?.descripcion || "",
      impuestoSimple: calc.impuesto,
      tarifaEfectivaSimple: calc.tarifaEfectiva,
      impuestoOrdinario,
      ahorro,
      ahorroPct,
      recomendacion,
      desgloseSimple: calc.desglose,
    };
  });

  // Mejor opción = la que más ahorra (si hay alguna que conviene)
  const mejorOpcion = simulaciones
    .filter(s => s.recomendacion === "simple_conviene")
    .sort((a, b) => b.ahorro - a.ahorro)[0] || null;

  return {
    elegibilidad,
    simulaciones,
    mejorOpcion,
  };
}
