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

// ═══════════════════════════════════════════════════════════════════════════
// WIZARD PARA PERSONA JURÍDICA (SAS, Ltda, sociedades en general)
// ═══════════════════════════════════════════════════════════════════════════
//
// El flujo de una jurídica es DISTINTO al de natural:
// - No hay "salario" sino INGRESOS OPERACIONALES y NO OPERACIONALES
// - Lo crítico es el RÉGIMEN TRIBUTARIO (Ordinario 35% vs SIMPLE 1.2-14%)
// - La ACTIVIDAD ECONÓMICA / CIIU define la tarifa de ICA y elegibilidad
//   para Régimen Simple
// - Los costos directos y gastos operacionales son deducibles (estructura
//   contable distinta al esquema cedular de personas naturales)
// - El patrimonio bruto se compone de inversiones, propiedad planta y
//   equipo, intangibles, etc.
// ═══════════════════════════════════════════════════════════════════════════

export const WIZARD_JURIDICA = [
  // ─── INTRO ─────────────────────────────────────────────────────────────
  {
    id: "intro",
    type: "intro",
    question: "Vamos a preparar la declaración de renta de tu sociedad",
    helpText:
      "Te voy a pedir información clave de la empresa: régimen tributario, ingresos, costos, " +
      "patrimonio. Esto toma 8-12 minutos. Lo que no sepas con exactitud, dame un estimado y " +
      "lo afinamos después con tu contador.",
    section: "intro",
  },

  // ─── SECCIÓN 1: ESTRUCTURA TRIBUTARIA ─────────────────────────────────
  {
    id: "regimenTributario",
    section: "regimen",
    question: "¿En qué régimen tributario está la sociedad?",
    helpText:
      "Es CRÍTICO acertar esto: define la tarifa del impuesto. Régimen Ordinario paga 35% sobre " +
      "la renta líquida; Régimen Simple paga entre 1.2% y 14% sobre ingresos brutos según " +
      "actividad económica. Si no estás seguro, mirá la última declaración o preguntá al contador.",
    type: "single_select",
    options: [
      { value: "ordinario", label: "Régimen Ordinario (35% sobre utilidad)", emoji: "🏢" },
      { value: "simple", label: "Régimen Simple (1.2-14% sobre ingresos brutos)", emoji: "📊" },
      { value: "zese_zomac", label: "Régimen especial (ZESE / ZOMAC / mega-inversiones)", emoji: "🌎" },
      { value: "esal", label: "Entidad Sin Ánimo de Lucro (ESAL)", emoji: "🤝" },
      { value: "no_se", label: "No estoy seguro — hablar con contador", emoji: "❓" },
    ],
  },
  {
    id: "actividadEconomica",
    section: "regimen",
    question: "¿A qué se dedica principalmente la sociedad?",
    helpText:
      "Esto define la tarifa de ICA municipal y, si está en Régimen Simple, la tarifa de ese impuesto. " +
      "Elegí la opción más cercana a la actividad PRINCIPAL (la que genera más ingresos).",
    type: "single_select",
    options: [
      { value: "comercio_minorista", label: "Comercio al por menor / tiendas", emoji: "🛍️" },
      { value: "comercio_mayorista", label: "Comercio al por mayor / distribución", emoji: "📦" },
      { value: "servicios_profesionales", label: "Servicios profesionales (consultoría, asesoría)", emoji: "💼" },
      { value: "tecnologia", label: "Tecnología / software / SaaS", emoji: "💻" },
      { value: "manufactura", label: "Manufactura / producción industrial", emoji: "🏭" },
      { value: "construccion_inmobiliario", label: "Construcción / inmobiliario", emoji: "🏗️" },
      { value: "alimentos_restaurantes", label: "Restaurantes / alimentos", emoji: "🍽️" },
      { value: "salud", label: "Salud / clínicas / consultorios", emoji: "🏥" },
      { value: "educacion", label: "Educación", emoji: "📚" },
      { value: "transporte_logistica", label: "Transporte / logística", emoji: "🚛" },
      { value: "agropecuario", label: "Agropecuario / ganadería", emoji: "🌾" },
      { value: "rentas_pasivas", label: "Inversiones / rentas pasivas / holding", emoji: "💰" },
      { value: "otra", label: "Otra actividad", emoji: "📋" },
    ],
  },

  // ─── SECCIÓN 2: INGRESOS ──────────────────────────────────────────────
  {
    id: "ingresosOperacionalesAnual",
    section: "ingresos",
    question: "¿Cuánto facturó la sociedad el año pasado en su actividad principal?",
    helpText:
      "Son los ingresos por VENTAS o SERVICIOS prestados (la operación normal del negocio). " +
      "Antes de IVA y antes de descontar costos. Ejemplo: si tu SAS factura servicios, son los " +
      "ingresos por esos servicios facturados durante el año.",
    type: "number",
    placeholder: "Ej: 800.000.000",
    suffix: "$ al año",
  },
  {
    id: "tieneIngresosNoOp",
    section: "ingresos",
    question: "¿La sociedad tuvo ingresos NO operacionales? (intereses, dividendos, alquileres)",
    helpText:
      "Son ingresos que NO son la actividad principal: rendimientos financieros de cuentas bancarias, " +
      "dividendos recibidos de otras sociedades, arriendos de propiedades, ganancias por venta de " +
      "activos, etc.",
    type: "yes_no",
    options: [
      { value: "si", label: "Sí, tuvo ingresos no operacionales", emoji: "✅" },
      { value: "no", label: "No, solo facturó por su actividad", emoji: "❌" },
    ],
  },
  {
    id: "ingresosNoOpAnual",
    section: "ingresos",
    question: "¿Cuánto sumaron esos ingresos no operacionales en el año?",
    helpText: "Sumá intereses + dividendos + alquileres + otras ganancias del año.",
    type: "number",
    placeholder: "Ej: 50.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.tieneIngresosNoOp === "si",
  },

  // ─── SECCIÓN 3: COSTOS Y GASTOS DEDUCIBLES ────────────────────────────
  {
    id: "costoVentasAnual",
    section: "costos",
    question: "¿Cuánto fue el COSTO de los productos o servicios vendidos?",
    helpText:
      "Son los costos DIRECTOS de generar los ingresos: compra de mercancía vendida, materias primas, " +
      "mano de obra directa, fletes, etc. Si es una empresa de servicios profesionales, suele ser bajo o cero. " +
      "Si vendés productos, suele ser entre 40% y 70% de las ventas.",
    type: "number",
    placeholder: "Ej: 350.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.regimenTributario !== "simple", // En Simple los costos NO se deducen
  },
  {
    id: "gastosOperacionalesAnual",
    section: "costos",
    question: "¿Cuánto gastó en administración y operación durante el año?",
    helpText:
      "Son gastos que mantienen la operación: arriendos de oficina, salarios administrativos, servicios " +
      "públicos, papelería, contabilidad, software, internet, mantenimiento, marketing, etc. NO incluyas " +
      "los costos directos del paso anterior.",
    type: "number",
    placeholder: "Ej: 180.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.regimenTributario !== "simple",
  },
  {
    id: "tieneInteresesPagados",
    section: "costos",
    question: "¿La sociedad pagó intereses por créditos u obligaciones financieras?",
    helpText:
      "Si la empresa tiene un crédito bancario, leasing, o cualquier obligación financiera, los " +
      "intereses pagados son DEDUCIBLES (con limites por subcapitalización si la deuda viene de socios).",
    type: "yes_no",
    options: [
      { value: "si", label: "Sí, pagó intereses", emoji: "✅" },
      { value: "no", label: "No, sin créditos / sin intereses", emoji: "❌" },
    ],
    shouldShow: (a) => a.regimenTributario !== "simple",
  },
  {
    id: "interesesPagadosAnual",
    section: "costos",
    question: "¿Cuánto pagó la sociedad de INTERESES durante el año?",
    helpText: "Solo intereses (no el capital). Pedí el certificado al banco si no estás seguro.",
    type: "number",
    placeholder: "Ej: 25.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.regimenTributario !== "simple" && a.tieneInteresesPagados === "si",
  },

  // ─── SECCIÓN 4: ICA / OTROS IMPUESTOS LOCALES ─────────────────────────
  {
    id: "icaPagadoAnual",
    section: "impuestosLocales",
    question: "¿Cuánto pagó de ICA (Impuesto de Industria y Comercio) en el año?",
    helpText:
      "El ICA es un impuesto municipal sobre los ingresos. Se paga bimestral o anualmente según el municipio. " +
      "Es 100% deducible del impuesto de renta (Régimen Ordinario). Si no lo sabés con exactitud, dame un " +
      "estimado: típicamente entre 0.4% y 1.4% de los ingresos.",
    type: "number",
    placeholder: "Ej: 5.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.regimenTributario !== "simple", // En Simple ya está incluido
  },

  // ─── SECCIÓN 5: PATRIMONIO ────────────────────────────────────────────
  {
    id: "patrimonioBrutoCierre",
    section: "patrimonio",
    question: "¿Cuál era el PATRIMONIO BRUTO de la sociedad al 31 de diciembre?",
    helpText:
      "Patrimonio bruto = TODO lo que tiene la empresa al cierre del año: efectivo en bancos, cuentas " +
      "por cobrar, inventarios, propiedades, vehículos, equipos, inversiones, intangibles. ANTES de restar " +
      "deudas. Si tenés balance contable, está en la línea 'Total Activos'.",
    type: "number",
    placeholder: "Ej: 1.200.000.000",
    suffix: "$ al cierre",
  },
  {
    id: "tieneDeudas",
    section: "patrimonio",
    question: "¿La sociedad tiene deudas o pasivos al cierre del año?",
    helpText:
      "Pasivos = deudas con bancos, proveedores, socios, impuestos por pagar, salarios por pagar, etc.",
    type: "yes_no",
    options: [
      { value: "si", label: "Sí, tiene pasivos", emoji: "✅" },
      { value: "no", label: "No tiene deudas / patrimonio limpio", emoji: "❌" },
    ],
  },
  {
    id: "pasivosTotales",
    section: "patrimonio",
    question: "¿Cuánto suman los pasivos totales al 31 de diciembre?",
    helpText: "Sumá todas las deudas: bancos, proveedores, socios, impuestos por pagar, etc.",
    type: "number",
    placeholder: "Ej: 300.000.000",
    suffix: "$ al cierre",
    shouldShow: (a) => a.tieneDeudas === "si",
  },

  // ─── SECCIÓN 6: RETENCIONES Y ANTICIPOS ───────────────────────────────
  {
    id: "tieneRetenciones",
    section: "retenciones",
    question: "¿Le practicaron retención en la fuente durante el año?",
    helpText:
      "Tus clientes (cuando son agentes retenedores) le retienen un porcentaje a cada factura. Esa retención " +
      "ya pagaste, se cruza contra el impuesto al final. Si no estás seguro, revisá los certificados de " +
      "retención que envían los clientes.",
    type: "yes_no",
    options: [
      { value: "si", label: "Sí, mis clientes me retienen", emoji: "✅" },
      { value: "no", label: "No me retienen / no estoy seguro", emoji: "❌" },
    ],
  },
  {
    id: "retencionesAnual",
    section: "retenciones",
    question: "¿Cuánto suman las retenciones que le practicaron en el año?",
    helpText: "Sumá los valores de los certificados de retención que recibiste de clientes.",
    type: "number",
    placeholder: "Ej: 28.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.tieneRetenciones === "si",
  },
  {
    id: "anticipoAnoAnterior",
    section: "retenciones",
    question: "¿Pagó anticipo de renta del año pasado al hacer la declaración?",
    helpText:
      "El anticipo es un pago adelantado que la DIAN obliga a hacer junto con la declaración anterior. " +
      "Está en el F-110 de hace dos años, en la sección de liquidación. Si no aplica, poné 0.",
    type: "number",
    placeholder: "Ej: 12.000.000  (o 0 si no aplica)",
    suffix: "$",
  },

  // ─── SECCIÓN 7: DONACIONES Y BENEFICIOS ───────────────────────────────
  {
    id: "tieneDonaciones",
    section: "beneficios",
    question: "¿La sociedad hizo donaciones a entidades sin ánimo de lucro?",
    helpText:
      "Las donaciones a ESAL del Régimen Especial dan derecho a un descuento tributario del 25% del " +
      "valor donado (con tope). Es una palanca poderosa de optimización.",
    type: "yes_no",
    options: [
      { value: "si", label: "Sí, hicimos donaciones", emoji: "✅" },
      { value: "no", label: "No / no aplica", emoji: "❌" },
    ],
    shouldShow: (a) => a.regimenTributario !== "simple",
  },
  {
    id: "donacionesAnual",
    section: "beneficios",
    question: "¿Cuánto se donó en total durante el año?",
    helpText: "Solo donaciones a ESAL del Régimen Tributario Especial (no donaciones políticas o privadas).",
    type: "number",
    placeholder: "Ej: 10.000.000",
    suffix: "$ al año",
    shouldShow: (a) => a.regimenTributario !== "simple" && a.tieneDonaciones === "si",
  },

  // ─── FINAL: REVISIÓN ──────────────────────────────────────────────────
  {
    id: "revision",
    type: "review",
    question: "Revisemos todos los datos de la sociedad",
    helpText: "Antes de calcular el impuesto, confirmemos que todo está bien.",
    section: "revision",
  },
];

/**
 * Devuelve los pasos del wizard apropiados según el tipo del owner.
 * Para "natural": WIZARD_NATURAL (preguntas sobre salario, dependientes, etc.)
 * Para "juridica": WIZARD_JURIDICA (preguntas sobre régimen, ingresos op., etc.)
 *
 * @param {string} ownerType - "natural" | "juridica"
 * @returns {Array} Array de pasos del wizard apropiado
 */
export function getWizardSteps(ownerType) {
  return ownerType === "juridica" ? WIZARD_JURIDICA : WIZARD_NATURAL;
}

/**
 * Wrapper que elige el mapper correcto según el tipo del owner.
 * Útil para componentes que necesitan aplicar respuestas sin saber el tipo.
 *
 * @param {string} ownerType - "natural" | "juridica"
 * @param {object} answers - Respuestas del wizard
 * @param {object} user - User actual
 * @param {string} ownerId - ID del owner a actualizar
 * @returns {object} user actualizado
 */
export function aplicarRespuestasWizard(ownerType, answers, user, ownerId) {
  if (ownerType === "juridica") {
    return mapearRespuestasJuridicaAUser(answers, user, ownerId);
  }
  return mapearRespuestasAUser(answers, user, ownerId);
}

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

// ═══════════════════════════════════════════════════════════════════════════
// MAPEO DE RESPUESTAS DEL WIZARD JURÍDICA → USER
// ═══════════════════════════════════════════════════════════════════════════
//
// Toma las respuestas del wizard de jurídica y las traduce a la estructura de
// user que entiende el motor: ingresos con fiscalCode jurídico, gastos en
// categorías jurídicas, owner con régimen tributario, etc.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapea las respuestas del wizard JURÍDICA a la estructura de user.
 *
 * @param {object} answers - {regimenTributario, ingresosOperacionalesAnual, ...}
 * @param {object} user - User actual
 * @param {string} ownerId - ID del owner JURÍDICO a actualizar
 * @returns {object} user actualizado
 */
export function mapearRespuestasJuridicaAUser(answers, user, ownerId) {
  const newUser = JSON.parse(JSON.stringify(user || {}));

  newUser.ingresos = newUser.ingresos || [];
  newUser.gas = newUser.gas || {};
  newUser.deu = newUser.deu || [];
  newUser.owners = newUser.owners || [];

  // ── Owner: actualizar régimen y actividad económica ─────────────────────
  newUser.owners = newUser.owners.map(o => {
    if (o.id !== ownerId) return o;
    const updated = { ...o };
    if (answers.regimenTributario && answers.regimenTributario !== "no_se") {
      // Mapear el valor del wizard al campo regimen del owner
      // Ordinario y SIMPLE son los más comunes, especiales = zona_franca/chc/exenta
      if (answers.regimenTributario === "simple") updated.regimen = "simple";
      else if (answers.regimenTributario === "zese_zomac") updated.regimen = "zona_franca";
      else if (answers.regimenTributario === "esal") updated.regimen = "exenta";
      else updated.regimen = "ordinario";
    }
    if (answers.actividadEconomica) {
      updated.actividadEconomica = answers.actividadEconomica;
    }
    // Marcar anticipo del año anterior (afecta liquidación)
    if (answers.anticipoAnoAnterior != null) {
      updated.fiscalProfile = { ...(updated.fiscalProfile || {}), anticipoAnoAnterior: Number(answers.anticipoAnoAnterior) || 0 };
    }
    return updated;
  });

  // ── Limpiar items previos del wizard para este owner ────────────────────
  newUser.ingresos = newUser.ingresos.filter(i => !(i.owner === ownerId && i._wizard === true));
  newUser.deu = newUser.deu.filter(d => !(d.owner === ownerId && d._wizard === true));
  Object.keys(newUser.gas).forEach(cat => {
    newUser.gas[cat] = (newUser.gas[cat] || []).filter(g => !(g.owner === ownerId && g._wizard === true));
  });

  // ── Ingresos operacionales ──────────────────────────────────────────────
  if (Number(answers.ingresosOperacionalesAnual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_jur_op_" + Date.now(),
      owner: ownerId,
      mensual: Math.round(Number(answers.ingresosOperacionalesAnual) / 12),
      fiscalCode: "ING_JUR_OPERACIONAL",
      categoria: "Ingresos operacionales",
      tipo: "fijo",
      fuente: "Actividad principal (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  // ── Ingresos no operacionales (intereses bancarios como genérico) ──────
  if (answers.tieneIngresosNoOp === "si" && Number(answers.ingresosNoOpAnual) > 0) {
    newUser.ingresos.push({
      id: "ing_wzd_jur_noop_" + Date.now(),
      owner: ownerId,
      mensual: Math.round(Number(answers.ingresosNoOpAnual) / 12),
      fiscalCode: "CAP_INTERESES_BANCARIOS",
      categoria: "Intereses bancarios",
      tipo: "variable",
      fuente: "Ingresos no operacionales (wizard)",
      moneda: "COP",
      _wizard: true,
    });
  }

  // ── Costo de ventas (si Régimen Ordinario) ──────────────────────────────
  if (answers.regimenTributario !== "simple" && Number(answers.costoVentasAnual) > 0) {
    if (!newUser.gas["Costo de ventas"]) newUser.gas["Costo de ventas"] = [];
    newUser.gas["Costo de ventas"].push({
      id: "gas_wzd_jur_cv_" + Date.now(),
      owner: ownerId,
      cat: "Costo de ventas",
      m: Math.round(Number(answers.costoVentasAnual) / 12),
      fiscalCode: "GAS_JUR_OPERATIVO",
      _wizard: true,
    });
  }

  // ── Gastos operacionales (administración + ventas) ─────────────────────
  if (answers.regimenTributario !== "simple" && Number(answers.gastosOperacionalesAnual) > 0) {
    if (!newUser.gas["Operativos"]) newUser.gas["Operativos"] = [];
    newUser.gas["Operativos"].push({
      id: "gas_wzd_jur_op_" + Date.now(),
      owner: ownerId,
      cat: "Operativos",
      m: Math.round(Number(answers.gastosOperacionalesAnual) / 12),
      fiscalCode: "GAS_JUR_OPERATIVO",
      _wizard: true,
    });
  }

  // ── Intereses pagados sobre deudas financieras ─────────────────────────
  if (answers.regimenTributario !== "simple" && answers.tieneInteresesPagados === "si" && Number(answers.interesesPagadosAnual) > 0) {
    if (!newUser.gas["Operativos"]) newUser.gas["Operativos"] = [];
    newUser.gas["Operativos"].push({
      id: "gas_wzd_jur_int_" + Date.now(),
      owner: ownerId,
      cat: "Operativos",
      m: Math.round(Number(answers.interesesPagadosAnual) / 12),
      fiscalCode: "GAS_JUR_OPERATIVO",
      subtipo: "Intereses financieros",
      _wizard: true,
    });
  }

  // ── ICA pagado (deducible 100% del impuesto de renta en Ordinario) ─────
  if (answers.regimenTributario !== "simple" && Number(answers.icaPagadoAnual) > 0) {
    if (!newUser.gas["Impuesto"]) newUser.gas["Impuesto"] = [];
    newUser.gas["Impuesto"].push({
      id: "gas_wzd_jur_ica_" + Date.now(),
      owner: ownerId,
      cat: "Impuesto",
      m: Math.round(Number(answers.icaPagadoAnual) / 12),
      fiscalCode: "GAS_JUR_PREDIAL", // ICA y otros impuestos van bajo este código
      subtipo: "ICA",
      _wizard: true,
    });
  }

  // ── Donaciones (descuento tributario, no deducción) ────────────────────
  if (answers.regimenTributario !== "simple" && answers.tieneDonaciones === "si" && Number(answers.donacionesAnual) > 0) {
    // Las donaciones van como gasto deducible en categoría especial
    if (!newUser.gas["Donaciones"]) newUser.gas["Donaciones"] = [];
    newUser.gas["Donaciones"].push({
      id: "gas_wzd_jur_don_" + Date.now(),
      owner: ownerId,
      cat: "Donaciones",
      m: Math.round(Number(answers.donacionesAnual) / 12),
      fiscalCode: "GAS_JUR_OPERATIVO",
      subtipo: "Donaciones a ESAL",
      _wizard: true,
    });
  }

  // ── Pasivos / deudas totales ────────────────────────────────────────────
  if (answers.tieneDeudas === "si" && Number(answers.pasivosTotales) > 0) {
    newUser.deu.push({
      id: "deu_wzd_jur_" + Date.now(),
      owner: ownerId,
      mt: Number(answers.pasivosTotales),
      saldo: Number(answers.pasivosTotales),
      ts: 0, // no sabemos la tasa, queda en 0
      tasa: 0,
      fiscalCode: "DEU_JUR_PRODUCTIVA",
      tipo: "Pasivos sociedad",
      nombre: "Pasivos totales (wizard)",
      _wizard: true,
    });
  }

  // ── Patrimonio bruto: lo guardamos en owner.fiscalProfile como referencia ─
  // El motor lee el patrimonio desde inv (inversiones), pero como aquí solo
  // tenemos un agregado, lo guardamos como hint para el F-110.
  if (Number(answers.patrimonioBrutoCierre) > 0) {
    newUser.owners = newUser.owners.map(o => {
      if (o.id !== ownerId) return o;
      return {
        ...o,
        fiscalProfile: {
          ...(o.fiscalProfile || {}),
          patrimonioBrutoDeclarado: Number(answers.patrimonioBrutoCierre),
        },
      };
    });
  }

  // ── Retenciones recibidas ──────────────────────────────────────────────
  if (answers.tieneRetenciones === "si" && Number(answers.retencionesAnual) > 0) {
    newUser.owners = newUser.owners.map(o => {
      if (o.id !== ownerId) return o;
      return {
        ...o,
        fiscalProfile: {
          ...(o.fiscalProfile || {}),
          retencionesRecibidas: Number(answers.retencionesAnual),
        },
      };
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

  // ─── BIFURCACIÓN POR TIPO DE OWNER ──────────────────────────────────────
  // La estructura de datos relevante es muy distinta para natural vs jurídica.
  // Delegamos a funciones especializadas para cada caso.
  if (owner.type === "juridica") {
    return precargarRespuestasJuridica(user, owner);
  }
  return precargarRespuestasNatural(user, owner);
}

/**
 * Precarga respuestas del wizard JURÍDICA inspeccionando datos del owner.
 * Detecta: régimen, actividad económica, ingresos op., costos, ICA, etc.
 */
function precargarRespuestasJuridica(user, owner) {
  const answers = {};
  const precargados = new Set();
  const ownerId = owner.id;

  const ingresosOwner = (user.ingresos || []).filter(i => i.owner === ownerId && i.sim !== false);
  const deudasOwner = (user.deu || []).filter(d => d.owner === ownerId && d.sim !== false);

  // Helper: suma anual por fiscalCode
  const sumaAnual = (fc) => ingresosOwner
    .filter(i => i.fiscalCode === fc)
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? (user.trm || 4200) : 1), 0);

  // ── Régimen tributario ──────────────────────────────────────────────────
  if (owner.regimen) {
    const map = {
      ordinario: "ordinario",
      simple: "simple",
      zona_franca: "zese_zomac",
      chc: "ordinario", // CHC es subtipo de ordinario
      exenta: "esal",
    };
    answers.regimenTributario = map[owner.regimen] || owner.regimen;
    precargados.add("regimenTributario");
  }

  // ── Actividad económica ─────────────────────────────────────────────────
  if (owner.actividadEconomica) {
    answers.actividadEconomica = owner.actividadEconomica;
    precargados.add("actividadEconomica");
  }

  // ── Ingresos operacionales ──────────────────────────────────────────────
  const opAnual = sumaAnual("ING_JUR_OPERACIONAL");
  if (opAnual > 0) {
    answers.ingresosOperacionalesAnual = Math.round(opAnual);
    precargados.add("ingresosOperacionalesAnual");
  }

  // ── Ingresos no operacionales ───────────────────────────────────────────
  const noOpAnual =
    sumaAnual("CAP_INTERESES_BANCARIOS") +
    sumaAnual("CAP_RENDIMIENTO_GENERICO") +
    sumaAnual("CAP_FIC") +
    sumaAnual("NOL_ARRIENDO_INMUEBLE");
  if (noOpAnual > 0) {
    answers.tieneIngresosNoOp = "si";
    answers.ingresosNoOpAnual = Math.round(noOpAnual);
    precargados.add("tieneIngresosNoOp");
    precargados.add("ingresosNoOpAnual");
  } else if (opAnual > 0) {
    // Si tiene operacionales pero no no-op, asumir "no"
    answers.tieneIngresosNoOp = "no";
    precargados.add("tieneIngresosNoOp");
  }

  // ── Gastos: costo de ventas y operacionales ─────────────────────────────
  const sumGastosCat = (cat) => (user.gas?.[cat] || [])
    .filter(g => g.owner === ownerId && g.sim !== false)
    .reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);

  const costoVentas = sumGastosCat("Costo de ventas");
  if (costoVentas > 0) {
    answers.costoVentasAnual = Math.round(costoVentas);
    precargados.add("costoVentasAnual");
  }

  const gastosOp = sumGastosCat("Operativos") + sumGastosCat("Nómina") + sumGastosCat("Honorarios");
  if (gastosOp > 0) {
    answers.gastosOperacionalesAnual = Math.round(gastosOp);
    precargados.add("gastosOperacionalesAnual");
  }

  // ── Intereses pagados (sub-categoría dentro de operativos) ──────────────
  const interesesPagados = (user.gas?.["Operativos"] || [])
    .filter(g => g.owner === ownerId && g.sim !== false && /interes|financiero/i.test(g.subtipo || ""))
    .reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);
  if (interesesPagados > 0) {
    answers.tieneInteresesPagados = "si";
    answers.interesesPagadosAnual = Math.round(interesesPagados);
    precargados.add("tieneInteresesPagados");
    precargados.add("interesesPagadosAnual");
  }

  // ── ICA pagado ──────────────────────────────────────────────────────────
  const ica = (user.gas?.["Impuesto"] || [])
    .filter(g => g.owner === ownerId && g.sim !== false && /ica/i.test(g.subtipo || g.cat || ""))
    .reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);
  if (ica > 0) {
    answers.icaPagadoAnual = Math.round(ica);
    precargados.add("icaPagadoAnual");
  }

  // ── Patrimonio bruto: suma de inversiones del owner ─────────────────────
  const patrimonioInv = (user.inv || [])
    .filter(i => i.owner === ownerId && i.sim !== false)
    .reduce((s, i) => {
      const v = Number(i.valor || i.va || i.ubi || i.vc || 0);
      return s + v * (i.moneda === "USD" ? (user.trm || 4200) : 1);
    }, 0);
  // O si está declarado explícitamente en fiscalProfile
  const patrimonioDeclarado = Number(owner.fiscalProfile?.patrimonioBrutoDeclarado || 0);
  const patrimonioFinal = patrimonioDeclarado || patrimonioInv;
  if (patrimonioFinal > 0) {
    answers.patrimonioBrutoCierre = Math.round(patrimonioFinal);
    precargados.add("patrimonioBrutoCierre");
  }

  // ── Pasivos / deudas totales ────────────────────────────────────────────
  const pasivos = deudasOwner.reduce((s, d) => s + Number(d.mt || d.saldo || 0), 0);
  if (pasivos > 0) {
    answers.tieneDeudas = "si";
    answers.pasivosTotales = Math.round(pasivos);
    precargados.add("tieneDeudas");
    precargados.add("pasivosTotales");
  }

  // ── Retenciones recibidas (desde fiscalProfile) ─────────────────────────
  const retenciones = Number(owner.fiscalProfile?.retencionesRecibidas || 0);
  if (retenciones > 0) {
    answers.tieneRetenciones = "si";
    answers.retencionesAnual = retenciones;
    precargados.add("tieneRetenciones");
    precargados.add("retencionesAnual");
  }

  // ── Anticipo año anterior ───────────────────────────────────────────────
  const anticipo = Number(owner.fiscalProfile?.anticipoAnoAnterior || 0);
  if (anticipo > 0) {
    answers.anticipoAnoAnterior = anticipo;
    precargados.add("anticipoAnoAnterior");
  }

  // ── Donaciones ──────────────────────────────────────────────────────────
  const donaciones = sumGastosCat("Donaciones");
  if (donaciones > 0) {
    answers.tieneDonaciones = "si";
    answers.donacionesAnual = Math.round(donaciones);
    precargados.add("tieneDonaciones");
    precargados.add("donacionesAnual");
  }

  return { answers, precargados };
}

/**
 * Precarga respuestas del wizard NATURAL (lógica original).
 */
function precargarRespuestasNatural(user, owner) {
  const answers = {};
  const precargados = new Set();
  const ownerId = owner.id;

  // BIFURCACIÓN: si el owner es jurídica, usar precarga específica para sociedades.
  // Antes (BUG): la precarga asumía siempre persona natural y rellenaba campos
  // como salarioMensual desde fiscalCode LAB_SALARIO. En jurídica esto era
  // siempre 0 porque las sociedades no tienen LAB_SALARIO. Resultado: en el
  // wizard jurídica nunca se precargaba nada y el user tenía que repetir todo.
  if (owner.type === "juridica") {
    return precargarRespuestasJuridicaDesdeUser(user, ownerId);
  }

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


// ═══════════════════════════════════════════════════════════════════════════
// PRECARGA DE RESPUESTAS JURÍDICA DESDE DATOS EXISTENTES DEL USER
// ═══════════════════════════════════════════════════════════════════════════
//
// Equivalente a precargarRespuestasDesdeUser pero para sociedades. Detecta
// régimen tributario, actividad económica, ingresos operacionales, costos,
// gastos, ICA, etc. desde los datos ya cargados del user.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Precarga respuestas del wizard JURÍDICA desde datos existentes del user.
 *
 * @param {object} user - User completo
 * @param {string} ownerId - ID del owner JURÍDICO
 * @returns {object} { answers, precargados }
 */
export function precargarRespuestasJuridicaDesdeUser(user, ownerId) {
  const answers = {};
  const precargados = new Set();

  if (!user || !ownerId) return { answers, precargados };

  const owner = (user.owners || []).find(o => o.id === ownerId);
  if (!owner || owner.type !== "juridica") return { answers, precargados };

  // Solo items encendidos del owner
  const ingresosOwner = (user.ingresos || []).filter(i => i.owner === ownerId && i.sim !== false);
  const deudasOwner = (user.deu || []).filter(d => d.owner === ownerId && d.sim !== false);
  const invOwner = (user.inv || []).filter(i => i.owner === ownerId && i.sim !== false);
  const gastosOwner = (cat) => (user.gas?.[cat] || []).filter(g => g.owner === ownerId && g.sim !== false);

  // Helper: suma anual por fiscalCode con conversión USD→COP
  const sumaAnualIng = (fc) => ingresosOwner
    .filter(i => i.fiscalCode === fc)
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? (user.trm || 4200) : 1), 0);
  const sumaAnualGas = (cat, subtipoFiltro) => {
    const items = gastosOwner(cat);
    const filtered = subtipoFiltro ? items.filter(g => subtipoFiltro(g)) : items;
    return filtered.reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);
  };

  // ── Régimen tributario (desde owner.regimen) ───────────────────────────
  if (owner.regimen) {
    const map = {
      ordinario: "ordinario",
      simple: "simple",
      zona_franca: "zese_zomac",
      exenta: "esal",
    };
    answers.regimenTributario = map[owner.regimen] || owner.regimen;
    precargados.add("regimenTributario");
  }

  // ── Actividad económica (desde owner.actividadEconomica) ──────────────
  if (owner.actividadEconomica) {
    answers.actividadEconomica = owner.actividadEconomica;
    precargados.add("actividadEconomica");
  }

  // ── Ingresos operacionales ──────────────────────────────────────────────
  const ingOp = sumaAnualIng("ING_JUR_OPERACIONAL");
  if (ingOp > 0) {
    answers.ingresosOperacionalesAnual = Math.round(ingOp);
    precargados.add("ingresosOperacionalesAnual");
  }

  // ── Ingresos no operacionales (intereses, arriendos, ganancias) ────────
  const ingNoOp = sumaAnualIng("CAP_INTERESES_BANCARIOS")
    + sumaAnualIng("CAP_RENDIMIENTO_GENERICO")
    + sumaAnualIng("NOL_ARRIENDO_INMUEBLE")
    + sumaAnualIng("CAP_DIVIDENDOS_RECIBIDOS");
  if (ingNoOp > 0) {
    answers.tieneIngresosNoOp = "si";
    answers.ingresosNoOpAnual = Math.round(ingNoOp);
    precargados.add("tieneIngresosNoOp");
    precargados.add("ingresosNoOpAnual");
  } else if (ingOp > 0) {
    answers.tieneIngresosNoOp = "no";
    precargados.add("tieneIngresosNoOp");
  }

  // ── Costo de ventas ─────────────────────────────────────────────────────
  const costoVentas = sumaAnualGas("Costo de ventas");
  if (costoVentas > 0) {
    answers.costoVentasAnual = Math.round(costoVentas);
    precargados.add("costoVentasAnual");
  }

  // ── Gastos operacionales (Operativos sin intereses) ────────────────────
  // Excluimos los items de "Intereses financieros" para no double-count
  const gastosOp = sumaAnualGas("Operativos", g => g.subtipo !== "Intereses financieros");
  if (gastosOp > 0) {
    answers.gastosOperacionalesAnual = Math.round(gastosOp);
    precargados.add("gastosOperacionalesAnual");
  }

  // ── Intereses pagados ──────────────────────────────────────────────────
  const interesesPag = sumaAnualGas("Operativos", g => g.subtipo === "Intereses financieros");
  if (interesesPag > 0) {
    answers.tieneInteresesPagados = "si";
    answers.interesesPagadosAnual = Math.round(interesesPag);
    precargados.add("tieneInteresesPagados");
    precargados.add("interesesPagadosAnual");
  } else if (deudasOwner.length > 0) {
    // Si tiene deudas pero no cargó intereses, lo dejamos para que confirme
    answers.tieneInteresesPagados = "si";
    precargados.add("tieneInteresesPagados");
  }

  // ── ICA pagado ─────────────────────────────────────────────────────────
  const icaPagado = sumaAnualGas("Impuesto", g => g.subtipo === "ICA")
    + sumaAnualGas("Impuesto", g => /ica/i.test(g.subtipo || ""));
  if (icaPagado > 0) {
    answers.icaPagadoAnual = Math.round(icaPagado);
    precargados.add("icaPagadoAnual");
  }

  // ── Patrimonio bruto (suma de inversiones del owner) ───────────────────
  if (invOwner.length > 0) {
    const totalInv = invOwner.reduce((s, i) => {
      const v = Number(i.valor || i.va || i.ubi || i.vc || 0);
      return s + v * (i.moneda === "USD" ? (user.trm || 4200) : 1);
    }, 0);
    if (totalInv > 0) {
      answers.patrimonioBrutoCierre = Math.round(totalInv);
      precargados.add("patrimonioBrutoCierre");
    }
  }

  // ── Pasivos / deudas ───────────────────────────────────────────────────
  if (deudasOwner.length > 0) {
    const totalDeudas = deudasOwner.reduce((s, d) => s + Number(d.mt || d.saldo || 0), 0);
    if (totalDeudas > 0) {
      answers.tieneDeudas = "si";
      answers.pasivosTotales = Math.round(totalDeudas);
      precargados.add("tieneDeudas");
      precargados.add("pasivosTotales");
    } else {
      answers.tieneDeudas = "no";
      precargados.add("tieneDeudas");
    }
  } else if (invOwner.length > 0 || ingresosOwner.length > 0) {
    answers.tieneDeudas = "no";
    precargados.add("tieneDeudas");
  }

  // ── Anticipo del año anterior (desde owner.fiscalProfile) ──────────────
  if (owner.fiscalProfile?.anticipoAnoAnterior != null) {
    answers.anticipoAnoAnterior = Number(owner.fiscalProfile.anticipoAnoAnterior) || 0;
    precargados.add("anticipoAnoAnterior");
  }

  // ── Donaciones (desde gas['Donaciones']) ───────────────────────────────
  const donaciones = sumaAnualGas("Donaciones");
  if (donaciones > 0) {
    answers.tieneDonaciones = "si";
    answers.donacionesAnual = Math.round(donaciones);
    precargados.add("tieneDonaciones");
    precargados.add("donacionesAnual");
  }

  return { answers, precargados };
}
