// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · wizardSteps.js — Definición de pasos del wizard tributario
//
// PROPÓSITO:
//   Define los pasos del wizard conversacional tipo TurboTax como una
//   estructura de datos. Cada paso tiene una pregunta en lenguaje humano,
//   un tipo de input, opciones (si aplica), y reglas de visibilidad
//   condicional.
//
// FILOSOFÍA:
//   - Una pregunta por paso (no formularios largos)
//   - Lenguaje natural ("¿Cuánto ganaste al mes?" no "Ingresos brutos anuales")
//   - Skipping inteligente: si dijiste "no trabajé", saltamos preguntas de salario
//   - Cada paso explica POR QUÉ se está preguntando (helpText)
//   - El user puede volver atrás en cualquier momento
//
// SCHEMA DE UN PASO:
//   {
//     id: "tipoTrabajo",           // identificador único, key en answers
//     question: "...",              // pregunta en lenguaje humano
//     helpText: "...",              // explicación de por qué se pregunta (opcional)
//     type: "single_select" | "number" | "yes_no" | "multi_number",
//     options: [{value, label, emoji?}],  // para single_select / yes_no
//     placeholder: "...",           // para number
//     suffix: "/mes" | "$" | etc,   // pista visual
//     shouldShow: (answers) => bool // skipping condicional (opcional)
//     section: "trabajo" | "familia" | "patrimonio" | etc  // agrupación visual
//   }
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pasos del wizard para PERSONA NATURAL (caso más común y prioritario).
 *
 * El flujo es lineal pero con skipping condicional. Ej: si user dice
 * "no trabajé", saltamos las preguntas de salario, honorarios, etc.
 */
export const WIZARD_NATURAL = [
  // ═══ INTRO ═══════════════════════════════════════════════════════════
  {
    id: "intro",
    type: "intro",
    question: "Hola 👋 vamos a entender tus impuestos juntos",
    helpText: "Te voy a hacer preguntas simples sobre tu vida del año pasado. " +
              "Tomá un café, esto va a tomar entre 5 y 10 minutos. Podés volver atrás en cualquier momento.",
    section: "intro",
  },

  // ═══ SECCIÓN 1: TRABAJO ═══════════════════════════════════════════════
  {
    id: "tipoTrabajo",
    section: "trabajo",
    type: "single_select",
    question: "¿Cómo te pagaron tu trabajo en 2025?",
    helpText: "Esto define qué deducciones podés usar. Si combinaste varios, elegí el principal.",
    options: [
      { value: "empleado", label: "Trabajé como empleado con contrato", emoji: "💼" },
      { value: "independiente", label: "Soy independiente y facturo por honorarios", emoji: "🧑‍💻" },
      { value: "ambos", label: "Tuve un empleo y también facturé independiente", emoji: "🔀" },
      { value: "pensionado", label: "Estoy pensionado", emoji: "🏖️" },
      { value: "ninguno", label: "No trabajé el año pasado", emoji: "❌" },
    ],
  },
  {
    id: "salarioMensual",
    section: "trabajo",
    type: "number",
    question: "¿Cuánto te pagaban al mes (en bruto, antes de descuentos)?",
    helpText: "Acá va el salario completo, antes de que te descuenten pensión, salud o impuestos. Si variaba, poné un promedio.",
    placeholder: "Ej: 5000000",
    suffix: "/ mes",
    shouldShow: (a) => ["empleado", "ambos"].includes(a.tipoTrabajo),
  },
  {
    id: "honorariosAnual",
    section: "trabajo",
    type: "number",
    question: "¿Cuánto facturaste por honorarios el año pasado?",
    helpText: "El total facturado durante todo 2025. Si no tenés el dato exacto, poné un aproximado.",
    placeholder: "Ej: 80000000",
    suffix: "anual",
    shouldShow: (a) => ["independiente", "ambos"].includes(a.tipoTrabajo),
  },
  {
    id: "aportesAutomaticos",
    section: "trabajo",
    type: "yes_no",
    question: "¿Tu empleador te descontaba pensión y salud automáticamente?",
    helpText: "Si trabajaste como empleado formal, normalmente la empresa descuenta el 4% pensión + 4% salud.",
    options: [
      { value: "si", label: "Sí, me descontaban automáticamente", emoji: "✅" },
      { value: "no", label: "No / no estoy seguro", emoji: "🤔" },
    ],
    shouldShow: (a) => ["empleado", "ambos"].includes(a.tipoTrabajo),
  },

  // ═══ SECCIÓN 2: PENSIÓN (si aplica) ═══════════════════════════════════
  {
    id: "pensionMensual",
    section: "pension",
    type: "number",
    question: "¿Cuánto recibías de pensión al mes?",
    helpText: "El monto bruto antes de retenciones. La pensión está exenta hasta 1000 UVT mensuales (~$52M).",
    placeholder: "Ej: 4000000",
    suffix: "/ mes",
    shouldShow: (a) => a.tipoTrabajo === "pensionado",
  },

  // ═══ SECCIÓN 3: FAMILIA Y DEDUCCIONES ════════════════════════════════
  {
    id: "tieneDependientes",
    section: "familia",
    type: "yes_no",
    question: "¿Tenés personas que dependen económicamente de vos?",
    helpText: "Hijos menores de 23 años, padres jubilados, cónyuge sin ingresos. Esto te da una deducción importante.",
    options: [
      { value: "si", label: "Sí, tengo dependientes", emoji: "👨‍👩‍👧" },
      { value: "no", label: "No tengo dependientes", emoji: "👤" },
    ],
    shouldShow: (a) => a.tipoTrabajo !== "ninguno",
  },
  {
    id: "cantidadDependientes",
    section: "familia",
    type: "number",
    question: "¿Cuántos dependientes tenés a tu cargo?",
    helpText: "Hijos menores de 23, padres jubilados, cónyuge sin ingresos.",
    placeholder: "Ej: 2",
    suffix: "personas",
    shouldShow: (a) => a.tieneDependientes === "si",
  },
  {
    id: "pagaMedicinaPrepagada",
    section: "familia",
    type: "yes_no",
    question: "¿Pagás medicina prepagada o seguros de salud privados?",
    helpText: "Sura, Colsanitas, Coomeva, Compensar prepagada, seguros de salud o vida. Es deducible.",
    options: [
      { value: "si", label: "Sí, pago medicina prepagada o seguros", emoji: "🏥" },
      { value: "no", label: "No tengo / no pago", emoji: "❌" },
    ],
    shouldShow: (a) => a.tipoTrabajo !== "ninguno",
  },
  {
    id: "medicinaMensual",
    section: "familia",
    type: "number",
    question: "¿Cuánto pagás al mes de medicina prepagada o seguros de salud?",
    helpText: "Si tenés varios, sumalos todos. Hay un tope mensual de ~$840K (16 UVT).",
    placeholder: "Ej: 600000",
    suffix: "/ mes",
    shouldShow: (a) => a.pagaMedicinaPrepagada === "si",
  },
  {
    id: "tieneViviendaCredito",
    section: "familia",
    type: "yes_no",
    question: "¿Tenés crédito hipotecario por tu vivienda donde vivís?",
    helpText: "Solo aplica donde vivís (vivienda habitual). Casas de descanso o segunda vivienda NO. Los intereses pagados son deducibles.",
    options: [
      { value: "si", label: "Sí, pago crédito hipotecario", emoji: "🏠" },
      { value: "no", label: "No tengo crédito hipotecario", emoji: "❌" },
    ],
    shouldShow: (a) => a.tipoTrabajo !== "ninguno",
  },
  {
    id: "interesesViviendaAnual",
    section: "familia",
    type: "number",
    question: "¿Cuánto pagaste de intereses de la hipoteca el año pasado?",
    helpText: "Solo los intereses, no el capital. El banco te da un certificado anual con esto. Tope: 1200 UVT/año (~$63M).",
    placeholder: "Ej: 12000000",
    suffix: "anual",
    shouldShow: (a) => a.tieneViviendaCredito === "si",
  },

  // ═══ SECCIÓN 4: AHORROS Y CAPITAL ═════════════════════════════════════
  {
    id: "tieneAportesPV",
    section: "ahorros",
    type: "yes_no",
    question: "¿Aportás a fondo de pensión voluntaria o cuenta AFC?",
    helpText: "Esta es LA palanca más poderosa para reducir impuestos legalmente. Cada $1 aportado puede ahorrarte hasta $0.39 de impuesto.",
    options: [
      { value: "si", label: "Sí, aporto a PV o AFC", emoji: "💎" },
      { value: "no", label: "No / nunca lo he hecho", emoji: "❌" },
    ],
    shouldShow: (a) => a.tipoTrabajo !== "ninguno",
  },
  {
    id: "aportesPVMensual",
    section: "ahorros",
    type: "number",
    question: "¿Cuánto aportás al mes a PV o AFC?",
    helpText: "El total combinado. Tope: 30% del ingreso para AFC + 25% para PV (con cap de 1340 UVT/año).",
    placeholder: "Ej: 1000000",
    suffix: "/ mes",
    shouldShow: (a) => a.tieneAportesPV === "si",
  },
  {
    id: "tieneCDTOAhorros",
    section: "ahorros",
    type: "yes_no",
    question: "¿Tenés CDT, cuentas que generan intereses, o fondos de inversión?",
    helpText: "Los rendimientos generan impuesto, pero el componente inflacionario (~50%) se excluye automáticamente. Sumamos esto al cálculo.",
    options: [
      { value: "si", label: "Sí, tengo CDT, ahorros o fondos", emoji: "📈" },
      { value: "no", label: "No tengo / no genera intereses", emoji: "❌" },
    ],
  },
  {
    id: "rendimientosAnual",
    section: "ahorros",
    type: "number",
    question: "¿Cuántos intereses o rendimientos te generaron en total el año pasado?",
    helpText: "Suma intereses de CDT + rendimientos de fondos + intereses de cuentas. Si no tenés el dato exacto, los bancos lo certifican en marzo.",
    placeholder: "Ej: 10000000",
    suffix: "anual",
    shouldShow: (a) => a.tieneCDTOAhorros === "si",
  },

  // ═══ SECCIÓN 5: ARRIENDOS Y OTROS INGRESOS ════════════════════════════
  {
    id: "recibeArriendos",
    section: "otros",
    type: "yes_no",
    question: "¿Te pagan arriendo por algún inmueble tuyo?",
    helpText: "Apartamentos, locales, bodegas, casas que alquilás. Tributa como cédula 'No Laboral'.",
    options: [
      { value: "si", label: "Sí, recibo arriendos", emoji: "🏘️" },
      { value: "no", label: "No recibo arriendos", emoji: "❌" },
    ],
  },
  {
    id: "arriendosMensual",
    section: "otros",
    type: "number",
    question: "¿Cuánto recibís de arriendos al mes (suma todos)?",
    helpText: "El total mensual antes de retenciones. Si tu inquilino es persona jurídica, te retienen 3.5%.",
    placeholder: "Ej: 3000000",
    suffix: "/ mes",
    shouldShow: (a) => a.recibeArriendos === "si",
  },

  // ═══ SECCIÓN 6: PATRIMONIO ════════════════════════════════════════════
  {
    id: "patrimonioAprox",
    section: "patrimonio",
    type: "single_select",
    question: "¿Más o menos cuánto suman todas tus propiedades, ahorros e inversiones?",
    helpText: "Estimado: casa + carro + ahorros + inversiones. La DIAN te exige declarar si supera ciertos topes.",
    options: [
      { value: "menor200", label: "Menos de $200 millones", emoji: "💵" },
      { value: "200a500", label: "Entre $200M y $500M", emoji: "💰" },
      { value: "500a1000", label: "Entre $500M y $1.000M", emoji: "🏦" },
      { value: "1000a3000", label: "Entre $1.000M y $3.000M", emoji: "💎" },
      { value: "mayor3000", label: "Más de $3.000M", emoji: "🏛️" },
      { value: "noSe", label: "No estoy seguro / no quiero decir", emoji: "🤷" },
    ],
  },

  // ═══ FINAL: REVISIÓN ═════════════════════════════════════════════════
  {
    id: "revision",
    type: "review",
    question: "Listo, revisemos todo lo que me contaste",
    helpText: "Antes de calcular tu impuesto, asegurémonos de que todo está bien.",
    section: "revision",
  },
];

/**
 * Mapea las respuestas del wizard a la estructura de user esperada por el motor.
 *
 * @param {object} answers - {tipoTrabajo, salarioMensual, ...}
 * @param {object} user - User actual (para preservar datos no tocados por el wizard)
 * @param {string} ownerId - ID del owner natural a actualizar
 * @returns {object} user actualizado con ingresos, gastos, deudas mappeados
 */
export function mapearRespuestasAUser(answers, user, ownerId) {
  const newUser = JSON.parse(JSON.stringify(user || {}));

  // Asegurar arrays
  newUser.ingresos = newUser.ingresos || [];
  newUser.gas = newUser.gas || {};
  newUser.deu = newUser.deu || [];
  newUser.owners = newUser.owners || [];

  // Owner: actualizar fiscalProfile con dependientes
  newUser.owners = newUser.owners.map(o => {
    if (o.id !== ownerId) return o;
    const fp = { ...(o.fiscalProfile || {}) };
    if (answers.tieneDependientes === "si") {
      fp.dependientes = {
        cantidad: Number(answers.cantidadDependientes) || 1,
        conDiscapacidad: false,
      };
    } else if (answers.tieneDependientes === "no") {
      fp.dependientes = { cantidad: 0 };
    }
    return { ...o, fiscalProfile: fp };
  });

  // ── Ingresos ──────────────────────────────────────────────────────────
  // Eliminar ingresos previos del owner que provienen del wizard (etiqueta wzd:true)
  newUser.ingresos = newUser.ingresos.filter(i => !(i.owner === ownerId && i._wizard === true));

  if (answers.salarioMensual && Number(answers.salarioMensual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_salario_" + Date.now(),
      owner: ownerId,
      categoria: "Salario",
      fiscalCode: "LAB_SALARIO",
      mensual: Number(answers.salarioMensual),
      tipo: "fijo",
      fuente: "Salario (wizard)",
      moneda: "COP",
      tipoVinculacion: "ordinario",
      _wizard: true,
    });
  }

  if (answers.honorariosAnual && Number(answers.honorariosAnual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_honor_" + Date.now(),
      owner: ownerId,
      categoria: "Honorarios",
      fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS",
      mensual: Math.round(Number(answers.honorariosAnual) / 12),
      tipo: "fijo",
      fuente: "Honorarios (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  if (answers.pensionMensual && Number(answers.pensionMensual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_pen_" + Date.now(),
      owner: ownerId,
      categoria: "Pensión",
      fiscalCode: "LAB_PENSIONES",
      mensual: Number(answers.pensionMensual),
      tipo: "fijo",
      fuente: "Pensión (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  if (answers.rendimientosAnual && Number(answers.rendimientosAnual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_rend_" + Date.now(),
      owner: ownerId,
      mensual: Math.round(Number(answers.rendimientosAnual) / 12),
      fiscalCode: "CAP_INTERESES_BANCARIOS",
      fuente: "Intereses y rendimientos (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  if (answers.arriendosMensual && Number(answers.arriendosMensual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_arr_" + Date.now(),
      owner: ownerId,
      mensual: Number(answers.arriendosMensual),
      fiscalCode: "NOL_ARRIENDO_INMUEBLE",
      fuente: "Arriendos (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  // ── Gastos deducibles ────────────────────────────────────────────────
  // Limpiar gastos previos del wizard
  Object.keys(newUser.gas).forEach(cat => {
    newUser.gas[cat] = (newUser.gas[cat] || []).filter(g => !(g.owner === ownerId && g._wizard === true));
  });

  // Medicina prepagada
  if (answers.medicinaMensual && Number(answers.medicinaMensual) > 0) {
    if (!newUser.gas["Aporte tributario"]) newUser.gas["Aporte tributario"] = [];
    newUser.gas["Aporte tributario"].push({
      owner: ownerId,
      m: Number(answers.medicinaMensual),
      fiscalCode: "AP_TRIB_SALUD_PREPAGADA",
      nombre: "Medicina prepagada (wizard)",
      _wizard: true,
    });
  }

  // Aportes pensión voluntaria
  if (answers.aportesPVMensual && Number(answers.aportesPVMensual) > 0) {
    if (!newUser.gas["Aporte tributario"]) newUser.gas["Aporte tributario"] = [];
    newUser.gas["Aporte tributario"].push({
      owner: ownerId,
      m: Number(answers.aportesPVMensual),
      fiscalCode: "AP_TRIB_PV",
      nombre: "Aporte Pensión Voluntaria (wizard)",
      _wizard: true,
    });
  }

  // ── Deudas (vivienda hipotecaria) ────────────────────────────────────
  newUser.deu = newUser.deu.filter(d => !(d.owner === ownerId && d._wizard === true));

  if (answers.tieneViviendaCredito === "si" && Number(answers.interesesViviendaAnual) > 0) {
    // Estimación: si pagó X anual de intereses al ~12% (tasa típica), capital ≈ X / 0.12
    const tasa = 12;
    const intereses = Number(answers.interesesViviendaAnual);
    const capitalEstimado = Math.round(intereses / (tasa / 100));
    newUser.deu.push({
      id: "deu_wzd_viv_" + Date.now(),
      owner: ownerId,
      mt: capitalEstimado,
      saldo: capitalEstimado,
      ts: tasa,
      tasa,
      fiscalCode: "DEU_NAT_VIVIENDA_HABITACIONAL",
      tipo: "Hipoteca",
      nombre: "Crédito vivienda (wizard)",
      _wizard: true,
    });
  }

  return newUser;
}

/**
 * Devuelve el siguiente índice de paso visible según las respuestas actuales.
 * Salta pasos cuyo shouldShow() retorne false.
 */
export function siguientePasoVisible(currentIndex, answers, steps = WIZARD_NATURAL) {
  for (let i = currentIndex + 1; i < steps.length; i++) {
    const step = steps[i];
    if (!step.shouldShow || step.shouldShow(answers)) return i;
  }
  return steps.length; // fin
}

/**
 * Devuelve el índice anterior visible.
 */
export function pasoAnteriorVisible(currentIndex, answers, steps = WIZARD_NATURAL) {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step.shouldShow || step.shouldShow(answers)) return i;
  }
  return 0;
}

/**
 * Cuenta total de pasos visibles según las respuestas actuales (para barra de progreso).
 */
export function totalPasosVisibles(answers, steps = WIZARD_NATURAL) {
  return steps.filter(s => !s.shouldShow || s.shouldShow(answers)).length;
}

/**
 * Posición del paso actual en la secuencia visible (1-indexed).
 */
export function posicionPasoVisible(currentIndex, answers, steps = WIZARD_NATURAL) {
  let count = 0;
  for (let i = 0; i <= currentIndex && i < steps.length; i++) {
    const step = steps[i];
    if (!step.shouldShow || step.shouldShow(answers)) count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRECARGA DE RESPUESTAS DESDE DATOS EXISTENTES DEL USER
// ═══════════════════════════════════════════════════════════════════════════
//
// Si el user ya cargó datos antes (manualmente o en otro wizard), el wizard
// debería detectarlos y NO preguntar de nuevo. Esta función inspecciona el
// user actual y devuelve un objeto answers con los valores que ya tiene.
//
// Cada respuesta precargada se marca con _precargado: true para que el UI
// pueda mostrar "Ya tengo cargado X — ¿confirmás?" en lugar de "?".
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detecta datos existentes del user para el owner dado y devuelve un objeto
 * answers con los valores precargados. Si una respuesta no se puede inferir,
 * queda undefined (el wizard la pregunta normal).
 *
 * @param {object} user - User completo
 * @param {string} ownerId - ID del owner natural a inspeccionar
 * @returns {object} answers con valores precargados + flag _precargado
 */
export function precargarRespuestasDesdeUser(user, ownerId) {
  const answers = {};
  const precargados = new Set(); // ids de pasos con datos precargados

  if (!user || !ownerId) return { answers, precargados };

  const owner = (user.owners || []).find(o => o.id === ownerId);
  if (!owner) return { answers, precargados };

  // Solo considerar items "encendidos" (sim !== false)
  const ingresosOwner = (user.ingresos || []).filter(i => i.owner === ownerId && i.sim !== false);
  const deudasOwner = (user.deu || []).filter(d => d.owner === ownerId && d.sim !== false);
  const invOwner = (user.inv || []).filter(i => i.owner === ownerId && i.sim !== false);

  // Helper: suma anual de ingresos por fiscalCode
  const sumaAnual = (fc) => {
    return ingresosOwner
      .filter(i => i.fiscalCode === fc)
      .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? (user.trm || 4200) : 1), 0);
  };
  const sumaMensual = (fc) => sumaAnual(fc) / 12;

  // ── Tipo de trabajo ─────────────────────────────────────────────────────
  const tieneSalario = ingresosOwner.some(i => i.fiscalCode === "LAB_SALARIO");
  const tieneHonorarios = ingresosOwner.some(i =>
    i.fiscalCode === "LAB_HONORARIOS_CON_EMPLEADOS" || i.fiscalCode === "LAB_HONORARIOS_SIN_EMPLEADOS"
  );
  const tienePension = ingresosOwner.some(i => i.fiscalCode === "LAB_PENSIONES");

  if (tienePension && !tieneSalario && !tieneHonorarios) {
    answers.tipoTrabajo = "pensionado";
    precargados.add("tipoTrabajo");
  } else if (tieneSalario && tieneHonorarios) {
    answers.tipoTrabajo = "mixto";
    precargados.add("tipoTrabajo");
  } else if (tieneSalario) {
    answers.tipoTrabajo = "empleado";
    precargados.add("tipoTrabajo");
  } else if (tieneHonorarios) {
    answers.tipoTrabajo = "independiente";
    precargados.add("tipoTrabajo");
  } else if (ingresosOwner.length === 0 && invOwner.length === 0 && deudasOwner.length === 0) {
    // Sin ningún dato cargado — no precargamos tipoTrabajo (el wizard pregunta normal)
  }

  // ── Salario mensual ─────────────────────────────────────────────────────
  if (tieneSalario) {
    answers.salarioMensual = Math.round(sumaMensual("LAB_SALARIO"));
    precargados.add("salarioMensual");
  }

  // ── Honorarios anuales ──────────────────────────────────────────────────
  if (tieneHonorarios) {
    const anualHonor = sumaAnual("LAB_HONORARIOS_CON_EMPLEADOS") + sumaAnual("LAB_HONORARIOS_SIN_EMPLEADOS");
    answers.honorariosAnual = Math.round(anualHonor);
    precargados.add("honorariosAnual");
  }

  // ── Pensión mensual ─────────────────────────────────────────────────────
  if (tienePension) {
    answers.pensionMensual = Math.round(sumaMensual("LAB_PENSIONES"));
    precargados.add("pensionMensual");
  }

  // ── Aportes automáticos (asumimos sí si tiene salario) ──────────────────
  if (tieneSalario) {
    answers.aportesAutomaticos = "si";
    precargados.add("aportesAutomaticos");
  }

  // ── Dependientes ────────────────────────────────────────────────────────
  const dependientes = owner?.fiscalProfile?.dependientes;
  if (dependientes != null) {
    if (dependientes.cantidad > 0) {
      answers.tieneDependientes = "si";
      answers.cantidadDependientes = dependientes.cantidad;
    } else {
      answers.tieneDependientes = "no";
    }
    precargados.add("tieneDependientes");
    if (dependientes.cantidad > 0) precargados.add("cantidadDependientes");
  }

  // ── Medicina prepagada ──────────────────────────────────────────────────
  const gastosSalud = (user.gas?.["Salud"] || []).filter(g => g.owner === ownerId && g.sim !== false);
  if (gastosSalud.length > 0) {
    const totalMensualSalud = gastosSalud.reduce((s, g) => s + (Number(g.m) || 0), 0);
    if (totalMensualSalud > 0) {
      answers.pagaMedicinaPrepagada = "si";
      answers.medicinaMensual = Math.round(totalMensualSalud);
      precargados.add("pagaMedicinaPrepagada");
      precargados.add("medicinaMensual");
    }
  }

  // ── Vivienda con crédito ────────────────────────────────────────────────
  const deudaVivienda = deudasOwner.find(d => d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL");
  if (deudaVivienda) {
    answers.tieneViviendaCredito = "si";
    // Estimar interés anual desde saldo × tasa
    const saldo = Number(deudaVivienda.mt || deudaVivienda.saldo || 0);
    const tasaAnual = (Number(deudaVivienda.ts || deudaVivienda.tasa || 12)) / 100;
    answers.interesesViviendaAnual = Math.round(saldo * tasaAnual);
    precargados.add("tieneViviendaCredito");
    precargados.add("interesesViviendaAnual");
  } else if (deudasOwner.length > 0 || invOwner.length > 0) {
    // Si tiene otros datos pero no vivienda, asumir "no"
    answers.tieneViviendaCredito = "no";
    precargados.add("tieneViviendaCredito");
  }

  // ── Aportes Pensión Voluntaria / AFC ────────────────────────────────────
  const gastosPV = (user.gas?.["Aporte tributario"] || []).filter(g =>
    g.owner === ownerId && g.sim !== false &&
    (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC")
  );
  if (gastosPV.length > 0) {
    const totalMensualPV = gastosPV.reduce((s, g) => s + (Number(g.m) || 0), 0);
    if (totalMensualPV > 0) {
      answers.tieneAportesPV = "si";
      answers.aportesPVMensual = Math.round(totalMensualPV);
      precargados.add("tieneAportesPV");
      precargados.add("aportesPVMensual");
    }
  }

  // ── CDT / Ahorros con rendimientos ──────────────────────────────────────
  const tieneRendimientos = ingresosOwner.some(i =>
    i.fiscalCode === "CAP_INTERESES_BANCARIOS" ||
    i.fiscalCode === "CAP_RENDIMIENTO_GENERICO" ||
    i.fiscalCode === "CAP_FIC"
  );
  if (tieneRendimientos) {
    const anualRend = sumaAnual("CAP_INTERESES_BANCARIOS") +
                       sumaAnual("CAP_RENDIMIENTO_GENERICO") +
                       sumaAnual("CAP_FIC");
    answers.tieneCDTOAhorros = "si";
    answers.rendimientosAnual = Math.round(anualRend);
    precargados.add("tieneCDTOAhorros");
    precargados.add("rendimientosAnual");
  } else if (invOwner.length > 0) {
    answers.tieneCDTOAhorros = "no";
    precargados.add("tieneCDTOAhorros");
  }

  // ── Arriendos recibidos ─────────────────────────────────────────────────
  const tieneArriendos = ingresosOwner.some(i =>
    i.fiscalCode === "NOL_ARRIENDO_INMUEBLE" || i.fiscalCode === "NOL_ARRIENDO_BIENES_MUEBLES"
  );
  if (tieneArriendos) {
    const mensualArr = sumaMensual("NOL_ARRIENDO_INMUEBLE") + sumaMensual("NOL_ARRIENDO_BIENES_MUEBLES");
    answers.recibeArriendos = "si";
    answers.arriendosMensual = Math.round(mensualArr);
    precargados.add("recibeArriendos");
    precargados.add("arriendosMensual");
  } else if (ingresosOwner.length > 0) {
    answers.recibeArriendos = "no";
    precargados.add("recibeArriendos");
  }

  // ── Patrimonio aproximado ───────────────────────────────────────────────
  if (invOwner.length > 0) {
    const totalActivos = invOwner.reduce((s, i) => {
      const v = Number(i.valor || i.va || i.ubi || i.vc || 0);
      return s + v * (i.moneda === "USD" ? (user.trm || 4200) : 1);
    }, 0);
    const totalDeudas = deudasOwner.reduce((s, d) => s + Number(d.mt || d.saldo || 0), 0);
    answers.patrimonioAprox = Math.round(totalActivos - totalDeudas);
    precargados.add("patrimonioAprox");
  }

  return { answers, precargados };
}

