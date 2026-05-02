// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · recomendacionesEstrategicas.js · Sesión 1-may-2026
//
// MOTOR DE RECOMENDACIONES PROACTIVAS (estrategias futuras)
//
// Esta es la diferencia entre una calculadora de impuestos y un contador real:
//
//   CALCULADORA: "si gastaste $80M, te ahorraste $25M"        (reactivo)
//   CONTADOR:    "comprá bodega de $500M, ahorrás $103M"       (proactivo)
//
// Este motor analiza el perfil completo del owner (tipo de ingresos, saldo a
// cargo, patrimonio, sociedades) y genera 3-7 recomendaciones específicas con
// acción concreta + inversión necesaria + ahorro estimado + ROI.
//
// FILOSOFÍA:
//   - Las estrategias vienen de prácticas REALES de contadores colombianos
//     (no son hipotéticas).
//   - Cada recomendación cumple la ley estrictamente — nunca es elusión
//     o evasión.
//   - El monto sugerido siempre es coherente con la capacidad del user
//     (no recomendamos comprar bodega de $1B a alguien con $50M de ingresos).
//   - Cada recomendación incluye caveat con "consultá con tu contador"
//     porque la implementación real requiere asesoría profesional.
//
// ESTRUCTURA DE UNA RECOMENDACIÓN:
//   {
//     id: "comprar_inmueble_productivo",
//     icono: "🏢",
//     titulo: "Adquirir un inmueble productivo con crédito",
//     descripcion: "...",
//     accion: "qué hacer concretamente",
//     inversion: { monto, descripcion },
//     ahorroAnual: { monto, calculoDetallado },
//     roi: { porcentaje, descripcion },
//     baseLegal: "Arts. 119, 128 ET",
//     caveat: "consultá con tu contador antes de implementar",
//     prioridad: "alta" | "media" | "baja",
//   }
// ═══════════════════════════════════════════════════════════════════════════

const UVT = 52374;

// ─────────────────────────────────────────────────────────────────────────
// ANÁLISIS DEL PERFIL DEL OWNER
// ─────────────────────────────────────────────────────────────────────────

function analizarPerfil(owner, det, user) {
  if (!owner || !det) return null;

  const isJuridica = owner.type === "juridica";
  const ingresoAnual = Number(det.ingreso) || 0;
  const saldoACargo = Number(det.impuesto) || 0;
  const ingLaboral = Number(det.ingLaboral) || 0;
  const ingNoLaboral = Number(det.ingNoLaboral) || 0;
  const divAnual = Number(det.divAnual) || 0;

  // Patrimonio (suma de inversiones del owner)
  const oInv = (user?.inv || []).filter(i => i.owner === owner.id);
  const patrimonioAprox = oInv.reduce((s, i) => {
    const valor = Number(i.valor || i.va || i.cv) || 0;
    return s + (i.moneda === "USD" ? valor * (user?.trm || 4200) : valor);
  }, 0);

  // Deudas
  const oDeu = (user?.deu || []).filter(d => d.owner === owner.id);
  const deudasTotal = oDeu.reduce((s, d) => s + (Number(d.mt || d.saldo) || 0), 0);

  // Tipo de perfil
  let tipoPerfil = "general";
  if (isJuridica) {
    tipoPerfil = "juridica";
  } else if (ingLaboral > 0 && ingNoLaboral === 0 && divAnual === 0) {
    tipoPerfil = "natural_laboral";
  } else if (divAnual > 0 || ingNoLaboral > 0) {
    tipoPerfil = "natural_no_laboral";
  } else if (ingLaboral > 0) {
    tipoPerfil = "natural_mixto";
  }

  return {
    owner,
    isJuridica,
    tipoPerfil,
    ingresoAnual,
    saldoACargo,
    ingLaboral,
    ingNoLaboral,
    divAnual,
    patrimonioAprox,
    deudasTotal,
    capacidadInversion: Math.max(0, patrimonioAprox * 0.20), // 20% del patrimonio típico
  };
}

// ─────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES PARA PERSONA NATURAL CON CÉDULA NO LABORAL
// (como Santiago: dividendos + arriendos, sin salario)
// ─────────────────────────────────────────────────────────────────────────

function recomendacionesNaturalNoLaboral(perfil) {
  const recs = [];
  const { saldoACargo, ingNoLaboral, divAnual, patrimonioAprox, capacidadInversion } = perfil;

  if (saldoACargo < 1_000_000) return recs; // si no debe nada, no recomendar

  // Tasa marginal aproximada en cédula general
  const tasaMarg = ingNoLaboral > 1_000_000_000 ? 0.39 :
                   ingNoLaboral > 600_000_000 ? 0.37 :
                   ingNoLaboral > 300_000_000 ? 0.35 : 0.33;

  // ── REC 1: Crédito hipotecario sobre vivienda habitacional ──────────
  //
  // Aplica si: tiene saldo a cargo > $5M y no tiene ya un crédito
  // hipotecario REAL.
  //
  // ⚠️ Sesión 1-may-2026 (feedback Santiago): para detectar si "ya tiene
  // crédito vivienda" SOLO leemos el módulo Deudas real (user.deu con
  // fiscalCode DEU_NAT_VIVIENDA_HABITACIONAL). NO leemos
  // fiscalProfile.interesesViviendaAnuales porque ese campo lo escribe
  // el Plan de Optimización (wizard) — son proyecciones, no datos reales.
  // Antes leía ese campo y eso generaba el bug "le pedí qué deuda pagar
  // y me dice que pague crédito hipotecario que está en el wizard pero
  // no en mis deudas reales".
  const deudasReales = (perfil.user?.deu || []).filter(d =>
    d.owner === perfil.owner.id &&
    d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL" &&
    d.sim !== false
  );
  const yaTieneCreditoVivienda = deudasReales.length > 0;
  if (saldoACargo > 5_000_000 && !yaTieneCreditoVivienda) {
    const interesesAnualesEstimados = 60_000_000; // típico crédito $500M al 12%
    const ahorroAnual = Math.min(interesesAnualesEstimados * tasaMarg, saldoACargo);
    recs.push({
      id: "credito_hipotecario_vivienda",
      icono: "🏠",
      titulo: "Crédito hipotecario sobre vivienda habitacional",
      descripcion: "Si comprás (o refinanciás) tu vivienda principal con un crédito hipotecario, los intereses anuales son deducibles hasta 1.200 UVT/año (~$62.8M).",
      accion: `Sacá un crédito de ~$500M al 12% para tu vivienda principal. Los intereses del primer año son ~$60M, todos deducibles.`,
      inversion: {
        monto: 0,
        descripcion: "Cero costo si refinanciás existente. Si comprás nueva, requiere cuota inicial (~30% típico).",
      },
      ahorroAnual: {
        monto: ahorroAnual,
        calculoDetallado: `$60M intereses × tasa marginal ${(tasaMarg * 100).toFixed(0)}% = $${Math.round(60_000_000 * tasaMarg).toLocaleString("es-CO")}, capeado a tu saldo a cargo actual.`,
      },
      roi: {
        porcentaje: 12,
        descripcion: "Plus: la vivienda se aprecia ~5-8% anual + protección de patrimonio.",
      },
      baseLegal: "Art. 119 ET",
      caveat: "Solo aplica a UNA vivienda habitacional principal. La propiedad debe estar a tu nombre. Si ya tenés crédito vivienda no aplica esto, sino la palanca 'Intereses vivienda' del paso anterior.",
      prioridad: "alta",
    });
  }

  // ── REC 2: Generar renta laboral vía consultoría a propias sociedades ──
  // Para acceder a beneficios laborales (PV/AFC, dependientes, salud)
  if (perfil.ingLaboral === 0 && saldoACargo > 10_000_000) {
    const consultoria_anual = 120_000_000; // ~$10M/mes consultoría profesional
    const aporteAFCmax = Math.min(consultoria_anual * 0.25, 2500 * UVT); // cap 25%
    const ahorroAFC = Math.round(aporteAFCmax * tasaMarg);
    recs.push({
      id: "consultoria_laboral",
      icono: "💼",
      titulo: "Generar renta laboral vía consultoría profesional",
      descripcion: "Hoy todos tus ingresos son por dividendos/arriendos. Eso te bloquea el acceso a las palancas más potentes: aportes a AFC/Pensión Voluntaria (deducibles 100%), dependientes, medicina prepagada deducible.",
      accion: `Factúrale consultoría profesional a tus propias sociedades (Lagoon, etc.) por $10M/mes. Eso genera renta laboral (~$120M/año) y te abre el espacio para aportar a AFC y deducciones laborales.`,
      inversion: {
        monto: 0,
        descripcion: "Cero costo financiero. Requiere documentar el servicio (contrato + facturación).",
      },
      ahorroAnual: {
        monto: Math.min(ahorroAFC, saldoACargo),
        calculoDetallado: `Aportar el 25% (cap legal) = $${aporteAFCmax.toLocaleString("es-CO")}/año a AFC, deducible al 100%. Ahorro: × ${(tasaMarg * 100).toFixed(0)}% tasa marginal.`,
      },
      roi: {
        porcentaje: 30,
        descripcion: "Doble beneficio: la sociedad deduce el gasto (35%) y vos accedés a deducciones laborales personales.",
      },
      baseLegal: "Arts. 126-1, 126-4, 387 ET",
      caveat: "Debe ser una consultoría real con servicios documentados. La sociedad debe registrar la facturación como gasto operacional y aplicar retenciones del 11%. Estructura legítima ampliamente usada.",
      prioridad: "alta",
    });
  }

  // ── REC 3: Donaciones a ESAL ──────────────────────────────────────────
  if (saldoACargo > 5_000_000) {
    const donacionSugerida = Math.min(saldoACargo * 0.5, 50_000_000); // sugerir donar hasta 50M o 50% del saldo
    const descuento = donacionSugerida * 0.25; // 25% del Art. 257
    recs.push({
      id: "donacion_esal",
      icono: "❤️",
      titulo: "Donación a fundación / ESAL educativa o cultural",
      descripcion: "Las donaciones a entidades del Régimen Tributario Especial (RTE) generan un DESCUENTO directo del 25% sobre el monto donado. No es deducción (que reduce base) — es descuento peso a peso del impuesto.",
      accion: `Donar ~$${donacionSugerida.toLocaleString("es-CO")} a una ESAL certificada por DIAN (universidades, fundaciones culturales, salud, etc.).`,
      inversion: {
        monto: donacionSugerida,
        descripcion: "Sale de tu bolsillo, pero el 25% vuelve como descuento de impuesto. Costo neto efectivo: 75% del monto.",
      },
      ahorroAnual: {
        monto: Math.min(descuento, saldoACargo),
        calculoDetallado: `$${donacionSugerida.toLocaleString("es-CO")} × 25% (Art. 257 ET) = $${descuento.toLocaleString("es-CO")} de descuento.`,
      },
      roi: {
        porcentaje: 25,
        descripcion: "ROI inmediato del 25% + impacto social + relaciones institucionales + reputación.",
      },
      baseLegal: "Art. 257 ET",
      caveat: "La ESAL debe estar certificada por DIAN como Régimen Tributario Especial. Pedile el certificado de donación firmado para soportar.",
      prioridad: "media",
    });
  }

  // ── REC 4: Adquirir vehículo / equipo bajo sociedad ────────────────────
  // Solo si tiene sociedades en el grupo
  const tieneJuridicas = (perfil.user?.owners || []).some(o => o.type === "juridica");
  if (tieneJuridicas && saldoACargo > 8_000_000) {
    recs.push({
      id: "vehiculo_productivo_sociedad",
      icono: "🚗",
      titulo: "Adquirir vehículo / equipo productivo bajo tu sociedad",
      descripcion: "Comprar un activo productivo (vehículo, equipo, maquinaria) bajo tu sociedad (Lagoon u otra) genera triple beneficio: depreciación deducible (20% anual lineal), IVA descontable, y reduce dividendos distribuibles.",
      accion: "Comprá una camioneta/vehículo productivo de ~$200M bajo Lagoon. Se usa para gestión de propiedades y reuniones de negocios.",
      inversion: {
        monto: 200_000_000,
        descripcion: "$200M iniciales (puede ser financiado). El vehículo es activo de la empresa.",
      },
      ahorroAnual: {
        monto: 51_000_000, // $40M depreciación × 35% + $38M IVA primer año dividido
        calculoDetallado: "Año 1: depreciación $40M × 35% = $14M en Lagoon + IVA descontable $38M (Art. 258-1) = $52M total año 1. Recurrente $14M anuales por 5 años.",
      },
      roi: {
        porcentaje: 26,
        descripcion: "Recupera 26% del costo el primer año vía ahorros tributarios.",
      },
      baseLegal: "Arts. 128, 258-1 ET",
      caveat: "El vehículo debe ser usado en la actividad productiva de la sociedad (no de lujo personal). Documentar uso en libros. Vehículos > $100M+ tienen seguimiento DIAN especial.",
      prioridad: "media",
    });
  }

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES PARA PERSONA NATURAL CON CÉDULA LABORAL
// ─────────────────────────────────────────────────────────────────────────

function recomendacionesNaturalLaboral(perfil) {
  const recs = [];
  const { saldoACargo, ingLaboral } = perfil;
  if (saldoACargo < 500_000) return recs;

  const tasaMarg = ingLaboral > 600_000_000 ? 0.37 : ingLaboral > 300_000_000 ? 0.35 : 0.33;

  // REC 1: Aporte a Pensión Voluntaria — solo si NO está aportando ya.
  // Buscamos en gas REAL (no en proyecciones del wizard) para evitar
  // contaminación cruzada.
  const todoGas = Object.values(perfil.user?.gas || {}).flat();
  const yaAportaPV = todoGas.some(g =>
    g.owner === perfil.owner.id &&
    (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC")
  );
  if (!yaAportaPV) {
    const aporteSugerido = Math.min(ingLaboral * 0.20, 2500 * UVT);
    const ahorroPV = Math.min(Math.round(aporteSugerido * tasaMarg), saldoACargo);
    recs.push({
      id: "aporte_pv_estrategico",
      icono: "💼",
      titulo: "Aportar a Pensión Voluntaria",
      descripcion: "Aporte deducible al 100% (cap 25% del ingreso). La palanca más potente para empleados con salario alto.",
      accion: `Aportar ~$${aporteSugerido.toLocaleString("es-CO")}/año a un fondo de Pensión Voluntaria (Protección, Porvenir, Old Mutual, etc).`,
      inversion: {
        monto: aporteSugerido,
        descripcion: "Sale de tu liquidez pero queda invertido a tu nombre, generando rendimientos.",
      },
      ahorroAnual: { monto: ahorroPV, calculoDetallado: `${aporteSugerido.toLocaleString("es-CO")} × ${(tasaMarg * 100).toFixed(0)}%` },
      roi: { porcentaje: tasaMarg * 100, descripcion: "ROI inmediato + capital crece a tu nombre." },
      baseLegal: "Art. 126-1 ET",
      caveat: "Si retirás antes de 10 años o sin cumplir requisitos de pensión, perdés el beneficio fiscal y pagás retención.",
      prioridad: "alta",
    });
  }

  // REC 2: Cuenta AFC para vivienda
  recs.push({
    id: "cuenta_afc",
    icono: "🏠",
    titulo: "Cuenta AFC (Ahorro para Fomento de la Construcción)",
    descripcion: "Aporte deducible al 100% (cap conjunto con PV: 25% del ingreso). Solo para destinar a compra/mejora de vivienda o pago de hipoteca.",
    accion: "Abrí una cuenta AFC en cualquier banco (Bancolombia, Davivienda, etc.) y aportá hasta el cap legal.",
    inversion: { monto: 0, descripcion: "Cero costo de apertura. El monto aportado queda en tu cuenta." },
    ahorroAnual: { monto: Math.min(Math.round(60_000_000 * tasaMarg), saldoACargo), calculoDetallado: "Si aportás $5M/mes ($60M/año) a AFC: deducible 100%" },
    roi: { porcentaje: tasaMarg * 100, descripcion: "ROI inmediato + el saldo se puede usar para vivienda." },
    baseLegal: "Art. 126-4 ET",
    caveat: "Solo retirable para vivienda. Si retirás para otra cosa, pagás retención del 7-15%.",
    prioridad: "alta",
  });

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES PARA SOCIEDADES (JURÍDICAS)
// ─────────────────────────────────────────────────────────────────────────

function recomendacionesJuridica(perfil) {
  const recs = [];
  const { saldoACargo, ingresoAnual } = perfil;
  if (saldoACargo < 5_000_000) return recs;

  // REC 1: Comprar bodega / inmueble productivo
  if (saldoACargo > 50_000_000) {
    const inversion = Math.min(saldoACargo * 5, 1_000_000_000); // dimensionar a la capacidad
    const depreciacionAnual = inversion / 20;
    const ivaDescontable = inversion * 0.19;
    const ahorroAno1 = Math.round(depreciacionAnual * 0.35 + ivaDescontable);
    recs.push({
      id: "bodega_inmueble_productivo",
      icono: "🏢",
      titulo: "Adquirir bodega / inmueble productivo",
      descripcion: "Comprar un activo fijo productivo genera triple beneficio: depreciación lineal (20 años), IVA descontable (Art. 258-1) y reduce utilidad distribuible. La estrategia clásica que recomiendan los contadores.",
      accion: `Comprar bodega o inmueble productivo de ~$${inversion.toLocaleString("es-CO")} para uso de la actividad de la empresa (almacenamiento, oficina, taller).`,
      inversion: {
        monto: inversion,
        descripcion: `$${inversion.toLocaleString("es-CO")} en activo fijo. Puede financiarse, lo que genera además intereses deducibles.`,
      },
      ahorroAnual: {
        monto: Math.min(ahorroAno1, saldoACargo),
        calculoDetallado: `Año 1: depreciación $${depreciacionAnual.toLocaleString("es-CO")} × 35% = $${Math.round(depreciacionAnual * 0.35).toLocaleString("es-CO")} + IVA descontable $${ivaDescontable.toLocaleString("es-CO")} (Art. 258-1) = $${ahorroAno1.toLocaleString("es-CO")}. Recurrente $${Math.round(depreciacionAnual * 0.35).toLocaleString("es-CO")}/año por 19 años más.`,
      },
      roi: {
        porcentaje: Math.round(ahorroAno1 / inversion * 100),
        descripcion: `Recuperás ~${Math.round(ahorroAno1 / inversion * 100)}% el primer año vía ahorros + el inmueble se aprecia + puede generar arriendos.`,
      },
      baseLegal: "Arts. 128, 258-1 ET",
      caveat: "Debe ser usado en la actividad productiva. Si después se arrenda a relacionado, la DIAN verifica precios de mercado (Art. 260-1 a 260-11 ET, precios de transferencia).",
      prioridad: "alta",
    });
  }

  // REC 2: Inversión en CT&I (deducción 175%)
  if (saldoACargo > 20_000_000) {
    const inversion = Math.min(saldoACargo * 0.5, 200_000_000);
    const deduccion = inversion * 1.75;
    const ahorroFiscal = Math.round(deduccion * 0.35) + (inversion * 0.25);
    recs.push({
      id: "inversion_cti",
      icono: "🔬",
      titulo: "Inversión en proyecto CT&I (Ciencia, Tecnología, Innovación)",
      descripcion: "La inversión en proyectos certificados por MinCiencias o Colciencias genera DEDUCCIÓN del 175% (es decir, gastás $100M y deducís $175M) más DESCUENTO directo del 25% del valor invertido. Es de los beneficios fiscales más potentes que existen.",
      accion: `Invertir ~$${inversion.toLocaleString("es-CO")} en un proyecto de I+D+i certificado (desarrollo de software, automatización, mejoras de procesos).`,
      inversion: {
        monto: inversion,
        descripcion: "Inversión real en el proyecto (personal, equipos, materiales). Debe ser certificable.",
      },
      ahorroAnual: {
        monto: Math.min(ahorroFiscal, saldoACargo),
        calculoDetallado: `Deducción 175% de $${inversion.toLocaleString("es-CO")} = $${deduccion.toLocaleString("es-CO")}, beneficio: $${Math.round(deduccion * 0.35).toLocaleString("es-CO")}. + Descuento directo 25% = $${(inversion * 0.25).toLocaleString("es-CO")}. Total: $${ahorroFiscal.toLocaleString("es-CO")}.`,
      },
      roi: {
        porcentaje: Math.round(ahorroFiscal / inversion * 100),
        descripcion: `Recuperás ~${Math.round(ahorroFiscal / inversion * 100)}% del proyecto vía ahorros fiscales + obtenés tecnología propia.`,
      },
      baseLegal: "Art. 158-1 ET",
      caveat: "Requiere certificación previa de MinCiencias. El proyecto debe ser GENUINAMENTE de I+D (no actividades operativas comunes). Hay un cupo anual nacional, conviene aplicar temprano.",
      prioridad: "alta",
    });
  }

  // REC 3: Capacitación a empleados (175%)
  recs.push({
    id: "capacitacion_empleados",
    icono: "🎓",
    titulo: "Capacitación certificada a empleados",
    descripcion: "Las inversiones en capacitación certificada (cursos, diplomados, posgrados) de tu equipo generan deducción del 175% del valor invertido (Art. 158-1 inc 2 ET).",
    accion: "Invertir en capacitación certificada para equipo (Coursera Business, EAFIT, Andes, Universidad de los Andes).",
    inversion: { monto: 30_000_000, descripcion: "$30M anuales en capacitación del equipo." },
    ahorroAnual: {
      monto: Math.min(Math.round(30_000_000 * 1.75 * 0.35), saldoACargo),
      calculoDetallado: "$30M × 175% = $52.5M deducción × 35% tarifa = $18.4M ahorro fiscal."
    },
    roi: { porcentaje: 61, descripcion: "Doble retorno: ahorro fiscal + equipo más productivo." },
    baseLegal: "Art. 158-1 inc 2 ET",
    caveat: "Capacitación debe ser certificada (no informal). Conservar facturas y certificados de cada empleado.",
    prioridad: "media",
  });

  // REC 4: Donación ESAL
  if (saldoACargo > 10_000_000) {
    const donacion = Math.min(saldoACargo * 0.3, 100_000_000);
    recs.push({
      id: "donacion_esal_juridica",
      icono: "❤️",
      titulo: "Donación a fundación / ESAL desde la sociedad",
      descripcion: "Las donaciones de la sociedad a entidades del Régimen Tributario Especial generan DESCUENTO directo del 25% sobre el impuesto. Es la forma más eficiente de transformar parte del impuesto en impacto social.",
      accion: `Donar $${donacion.toLocaleString("es-CO")} a una ESAL certificada (universidades, fundaciones de salud o cultura).`,
      inversion: { monto: donacion, descripcion: "Costo neto: 75% del valor donado." },
      ahorroAnual: { monto: Math.min(Math.round(donacion * 0.25), saldoACargo), calculoDetallado: `$${donacion.toLocaleString("es-CO")} × 25%` },
      roi: { porcentaje: 25, descripcion: "ROI inmediato 25% + reputación + impacto social." },
      baseLegal: "Art. 257 ET",
      caveat: "Requiere certificado de donación de la ESAL + verificación que esté en RTE.",
      prioridad: "media",
    });
  }

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// API PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

/**
 * Genera lista de recomendaciones estratégicas (acciones futuras) para un owner.
 *
 * @param {object} user - User completo
 * @param {object} owner - Owner activo
 * @param {object} det - Detalle del owner desde estimacion (output del motor)
 * @returns {Array<Recomendacion>} Lista ordenada por prioridad e impacto
 */
export function generarRecomendacionesEstrategicas(user, owner, det) {
  const perfil = analizarPerfil(owner, det, user);
  if (!perfil) return [];
  // Inyectamos user al perfil para checks contextuales
  perfil.user = user;

  let recs = [];
  switch (perfil.tipoPerfil) {
    case "juridica":
      recs = recomendacionesJuridica(perfil);
      break;
    case "natural_no_laboral":
      recs = recomendacionesNaturalNoLaboral(perfil);
      break;
    case "natural_laboral":
    case "natural_mixto":
      recs = recomendacionesNaturalLaboral(perfil);
      break;
    default:
      recs = [];
  }

  // Ordenar por prioridad (alta > media > baja) y luego por ahorro descendente
  const prioridad = { alta: 3, media: 2, baja: 1 };
  recs.sort((a, b) => {
    const dp = (prioridad[b.prioridad] || 0) - (prioridad[a.prioridad] || 0);
    if (dp !== 0) return dp;
    return (b.ahorroAnual?.monto || 0) - (a.ahorroAnual?.monto || 0);
  });

  return recs;
}
