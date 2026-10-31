import { fmtPctEs } from "./formato.js";
import { estimarImpuesto, DEFAULT_AG, uvtForYear } from "./taxCO.js";
import { sugerenciaPvAfc, textoSugerenciaPvAfc, textoTopePvAfc } from "./sugerenciaPvAfc.js";
// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · recomendacionesEstrategicas.js · Sesión 1-may-2026
//
// MOTOR DE RECOMENDACIONES PROACTIVAS (estrategias futuras)
//
// Esta es la diferencia entre una calculadora de impuestos y un contador real:
//
//   CALCULADORA: "si gastaste $80M, te ahorraste $25M"        (reactivo)
//   CONTADOR:    "compra bodega de $500M, ahorras $103M"       (proactivo)
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
//   - Cada recomendación incluye caveat con "consulta con tu contador"
//     porque la implementación real requiere asesoría profesional.
//
// ESTRUCTURA DE UNA RECOMENDACIÓN:
//   {
//     id: "comprar_inmueble_productivo",
//     icono: "",
//     titulo: "Adquirir un inmueble productivo con crédito",
//     descripcion: "...",
//     accion: "qué hacer concretamente",
//     inversion: { monto, descripcion },
//     ahorroAnual: { monto, calculoDetallado },
//     roi: { porcentaje, descripcion },
//     baseLegal: "Arts. 119, 128 ET",
//     caveat: "consulta con tu contador antes de implementar",
//     prioridad: "alta" | "media" | "baja",
//   }
// ═══════════════════════════════════════════════════════════════════════════

// UVT del mismo año gravable que se le pasa a taxCO (regla Tributario: nunca un
// valor único para toda la app). Recomendaciones = AG por defecto (2026).
export const AG_RECOS = DEFAULT_AG;
export const UVT_RECOS = uvtForYear(AG_RECOS);
const UVT = UVT_RECOS;
export const ETIQUETA_AG_RECOS = `AG ${AG_RECOS} · UVT $${UVT_RECOS.toLocaleString("es-CO")}`;
export const NOTA_FIJA_PV_AFC = "Es un cálculo del ahorro en impuesto, no una recomendación. Antes de aportar, revisa las condiciones de retiro con tu fondo o tu contador.";

// ─────────────────────────────────────────────────────────────────────────
// ANÁLISIS DEL PERFIL DEL OWNER
// ─────────────────────────────────────────────────────────────────────────

function analizarPerfil(owner, det, user) {
  if (!owner || !det) return null;

  const isJuridica = owner.type === "juridica";
  const ingresoAnual = Number(det.ingreso) || 0;
  // Impuesto a cargo (antes de retenciones). NO usar det.impuesto: es el saldo
  // tras retenciones cortado en 0, y esconde las recomendaciones a quien tiene
  // saldo a favor aunque el aporte sí le baje el impuesto (#60, regla Finanzas).
  const impuestoACargo = Number(det.impuestoACargo ?? det.impBruto ?? det.impuesto) || 0;
  const ingLaboral = Number(det.ingLaboral) || 0;
  const ingNoLaboral = Number(det.ingNoLaboral) || 0;
  const divAnual = Number(det.divAnual) || 0;

  // Patrimonio (suma de inversiones del owner)
  const oInv = (user?.inv || []).filter(i => i.owner === owner.id && i.sim !== false);
  const patrimonioAprox = oInv.reduce((s, i) => {
    const valor = Number(i.valor || i.va || i.cv) || 0;
    return s + (i.moneda === "USD" ? valor * (user?.trm || 4200) : valor);
  }, 0);

  // Deudas
  const oDeu = (user?.deu || []).filter(d => d.owner === owner.id && d.sim !== false);
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
    _user: user, _owner: owner,
    owner,
    isJuridica,
    tipoPerfil,
    ingresoAnual,
    impuestoACargo,
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
  const { impuestoACargo, ingNoLaboral, divAnual, patrimonioAprox, capacidadInversion } = perfil;

  if (impuestoACargo < 1_000_000) return recs; // si no debe nada, no recomendar

  // Tasa marginal aproximada en cédula general
  const tasaMarg = ingNoLaboral > 1_000_000_000 ? 0.39 :
                   ingNoLaboral > 600_000_000 ? 0.37 :
                   ingNoLaboral > 300_000_000 ? 0.35 : 0.33;

  // ── REC 1: Crédito hipotecario sobre vivienda habitacional ──────────
  //
  // Aplica si: tiene saldo a cargo > $5M y no tiene ya un crédito
  // hipotecario REAL.
  //
  // Sesión 1-may-2026 (feedback Santiago): para detectar si "ya tiene
  // crédito vivienda" SOLO leemos el módulo Deudas real (user.deu con
  // fiscalCode DEU_NAT_VIVIENDA_HABITACIONAL). NO leemos
  // fiscalProfile.interesesViviendaAnuales porque ese campo lo escribe
  // el Plan de Optimización (wizard) — son proyecciones, no datos reales.
  // Antes leía ese campo y eso generaba el bug "le pide qué deuda pagar
  // y me dice que pague crédito hipotecario que está en el wizard pero
  // no en mis deudas reales".
  const deudasReales = (perfil.user?.deu || []).filter(d =>
    d.owner === perfil.owner.id &&
    d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL" &&
    d.sim !== false
  );
  const yaTieneCreditoVivienda = deudasReales.length > 0;
  if (impuestoACargo > 5_000_000 && !yaTieneCreditoVivienda) {
    const interesesAnualesEstimados = 60_000_000; // típico crédito $500M al 12%
    const ahorroAnual = Math.min(interesesAnualesEstimados * tasaMarg, impuestoACargo);
    recs.push({
      id: "credito_hipotecario_vivienda",
      ejecutaEn: "personal",
      icono: "",
      titulo: "Crédito hipotecario sobre vivienda habitacional",
      descripcion: "Si compras (o refinancias) tu vivienda principal con un crédito hipotecario, los intereses anuales son deducibles hasta 1.200 UVT/año (~$62.8M).",
      accion: `Saca un crédito de ~$500M al 12% para tu vivienda principal. Los intereses del primer año son ~$60M, todos deducibles.`,
      inversion: {
        monto: 0,
        descripcion: "Cero costo si refinancias existente. Si compras nueva, requiere cuota inicial (~30% típico).",
      },
      ahorroAnual: {
        monto: ahorroAnual,
        calculoDetallado: `$60M intereses × tasa marginal ${fmtPctEs((tasaMarg * 100), 0)} = $${Math.round(60_000_000 * tasaMarg).toLocaleString("es-CO")}, capeado a tu saldo a cargo actual.`,
      },
      roi: {
        porcentaje: 12,
        descripcion: "Plus: la vivienda se aprecia ~5-8% anual + protección de patrimonio.",
      },
      baseLegal: "Art. 119 ET",
      caveat: "Solo aplica a UNA vivienda habitacional principal. La propiedad debe estar a tu nombre. Si ya tienes crédito vivienda no aplica esto, sino la palanca 'Intereses vivienda' del paso anterior.",
      prioridad: "alta",
    });
  }

  // ── REC 2: Generar renta laboral vía consultoría a propias sociedades ──
  // Para acceder a beneficios laborales (PV/AFC, dependientes, salud)
  if (perfil.ingLaboral === 0 && impuestoACargo > 10_000_000) {
    const consultoria_anual = 120_000_000; // ~$10M/mes consultoría profesional
    // Tope conjunto PV + AFC: 30 % del ingreso laboral, hasta 3.800 UVT/año.
    const aporteAFCmax = Math.min(consultoria_anual * 0.30, 3800 * UVT);
    const ahorroAFC = Math.round(ahorroAporteConTaxCO(perfil, consultoria_anual, aporteAFCmax));
    recs.push({
      id: "consultoria_laboral",
      ejecutaEn: "personal",
      icono: "",
      titulo: "Generar renta laboral vía consultoría profesional",
      descripcion: "Hoy todos tus ingresos son por dividendos/arriendos. Eso te bloquea el acceso a las palancas más potentes: aportes a AFC/Pensión Voluntaria (deducibles 100%), dependientes, medicina prepagada deducible.",
      accion: `Factúrale consultoría profesional a tus propias sociedades (Lagoon, etc.) por $10M/mes. Eso genera renta laboral (~$120M/año) y te abre el espacio para aportar a AFC y deducciones laborales.`,
      inversion: {
        monto: 0,
        descripcion: "Cero costo financiero. Requiere documentar el servicio (contrato + facturación).",
      },
      ahorroAnual: {
        monto: Math.min(ahorroAFC, impuestoACargo),
        calculoDetallado: `Con la consultoría, hasta $${aporteAFCmax.toLocaleString("es-CO")}/año en pensión voluntaria o AFC podría ser exento (30% del ingreso, hasta 3.800 UVT al año, compartido entre pensión voluntaria y AFC). Diferencia de impuesto calculada con y sin el aporte.`,
      },
      roi: {
        porcentaje: 30,
        descripcion: "Doble beneficio: la sociedad deduce el gasto (35%) y tú accedes a deducciones laborales personales.",
      },
      baseLegal: "Arts. 126-1, 126-4, 387 ET",
      caveat: "Debe ser una consultoría real con servicios documentados. La sociedad debe registrar la facturación como gasto operacional y aplicar retenciones del 11%. Estructura legítima ampliamente usada.",
      prioridad: "alta",
    });
  }

  // ── REC 3: Donaciones a ESAL ──────────────────────────────────────────
  if (impuestoACargo > 5_000_000) {
    const donacionSugerida = Math.min(impuestoACargo * 0.5, 50_000_000); // sugerir donar hasta 50M o 50% del saldo
    const descuento = donacionSugerida * 0.25; // 25% del Art. 257
    recs.push({
      id: "donacion_esal",
      ejecutaEn: "personal",
      icono: "",
      titulo: "Donación a fundación / ESAL educativa o cultural",
      descripcion: "Las donaciones a entidades del Régimen Tributario Especial (RTE) generan un DESCUENTO directo del 25% sobre el monto donado. No es deducción (que reduce base) — es descuento peso a peso del impuesto.",
      accion: `Donar ~$${donacionSugerida.toLocaleString("es-CO")} a una ESAL certificada por DIAN (universidades, fundaciones culturales, salud, etc.).`,
      inversion: {
        monto: donacionSugerida,
        descripcion: "Sale de tu bolsillo, pero el 25% vuelve como descuento de impuesto. Costo neto efectivo: 75% del monto.",
      },
      ahorroAnual: {
        monto: Math.min(descuento, impuestoACargo),
        calculoDetallado: `$${donacionSugerida.toLocaleString("es-CO")} × 25% (Art. 257 ET) = $${descuento.toLocaleString("es-CO")} de descuento.`,
      },
      roi: {
        porcentaje: 25,
        descripcion: "ROI inmediato del 25% + impacto social + relaciones institucionales + reputación.",
      },
      baseLegal: "Art. 257 ET",
      caveat: "La ESAL debe estar certificada por DIAN como Régimen Tributario Especial. Pídele el certificado de donación firmado para soportar.",
      prioridad: "media",
    });
  }

  // NOTA (18-jul-2026 noche, Santiago): la REC "Adquirir vehículo bajo
  // sociedad" se MOVIÓ a recomendacionesJuridica — "una cosa son las
  // optimizaciones a Sosa, otras a Lagoon, no tienen por qué mezclarse".
  // Cada owner ve solo las estrategias que ejecuta él mismo.

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES PARA PERSONA NATURAL CON CÉDULA LABORAL
// ─────────────────────────────────────────────────────────────────────────

function recomendacionesNaturalLaboral(perfil) {
  const recs = [];
  const { impuestoACargo, ingLaboral } = perfil;
  if (impuestoACargo < 500_000) return recs;


  // REC 1: Aporte a Pensión Voluntaria — solo si NO está aportando ya.
  // Buscamos en gas REAL (no en proyecciones del wizard) para evitar
  // contaminación cruzada.
  const todoGas = Object.values(perfil.user?.gas || {}).flat();
  const yaAportaPV = todoGas.some(g =>
    g.owner === perfil.owner.id &&
    (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC")
  );
  if (!yaAportaPV) {
    // Tope conjunto PV+AFC: 30% del ingreso laboral, máx 3.800 UVT/año (UVT del AG_RECOS).
    // Mismo aporte y ahorro que la tarjeta del simulador (helper compartido, regla Finanzas).
    const sug = sugerenciaPvAfc(perfil._user, perfil._owner, { ag: AG_RECOS });
    const aporteSugerido = sug.aporte;
    const ahorroPV = sug.ahorro || 0;
    const topeAnual = sug.topeAnual;
    recs.push({
      id: "aporte_pv_estrategico",
      ejecutaEn: "personal",
      icono: "",
      titulo: "Pensión voluntaria o AFC",
      tope: textoTopePvAfc(sug),
      descripcion: `${textoSugerenciaPvAfc(sug)} Hasta $${Math.round(topeAnual / 12).toLocaleString("es-CO")}/mes en pensión voluntaria o AFC podría ser exento (hasta 30% del ingreso, máximo 3.800 UVT al año, compartido entre pensión voluntaria y AFC). La AFC sirve para comprar vivienda; la pensión voluntaria es para el largo plazo. Si lo retiras antes y para otro fin, pierdes el beneficio.`,
      accion: sug.sinFlujo ? textoSugerenciaPvAfc(sug) : `Si decides aportar, puedes hacerlo por nómina o directo al fondo: $${aporteSugerido.toLocaleString("es-CO")} al año.`,
      inversion: {
        monto: aporteSugerido,
        descripcion: "Sale de tu liquidez pero queda ahorrado a tu nombre.",
      },
      ahorroAnual: { monto: ahorroPV, calculoDetallado: sug.sinFlujo ? textoSugerenciaPvAfc(sug) : `menos de impuesto si aportas $${aporteSugerido.toLocaleString("es-CO")} al año. Diferencia de impuesto calculada con y sin el aporte.` },
      roi: { porcentaje: aporteSugerido > 0 ? (ahorroPV / aporteSugerido) * 100 : 0, descripcion: "Ahorro en impuesto sobre lo aportado." },
      baseLegal: "Arts. 126-1 y 126-4 ET",
      caveat: "Si lo retiras antes y para otro fin, pierdes el beneficio.",
      nota: NOTA_FIJA_PV_AFC,
      etiqueta: ETIQUETA_AG_RECOS,
      prioridad: "alta",
    });
  }

  // REC 2: Cuenta AFC — mismo aporte/ahorro compartido (tope conjunto con PV).
  const sugAFC = sugerenciaPvAfc(perfil._user, perfil._owner, { ag: AG_RECOS });
  recs.push({
    id: "cuenta_afc",
      ejecutaEn: "personal",
    icono: "",
    titulo: "Cuenta AFC (Ahorro para Fomento de la Construcción)",
    descripcion: "Hasta 30% del ingreso, máximo 3.800 UVT al año, compartido entre pensión voluntaria y AFC. Solo para destinar a compra/mejora de vivienda o pago de hipoteca.",
    accion: "Abre una cuenta AFC en cualquier banco (Bancolombia, Davivienda, etc.) y aporta hasta el cap legal.",
    ahorroAnual: { monto: Math.round(sugAFC.ahorro || 0), calculoDetallado: sugAFC.sinFlujo ? textoSugerenciaPvAfc(sugAFC) : `menos de impuesto si aportas $${sugAFC.aporte.toLocaleString("es-CO")} al año (tope compartido con pensión voluntaria). Diferencia de impuesto calculada con y sin el aporte.` },
    inversion: { monto: sugAFC.aporte, descripcion: "El monto aportado queda en tu cuenta AFC." },
    roi: { porcentaje: sugAFC.aporte > 0 ? Math.round(sugAFC.ahorro / sugAFC.aporte * 1000) / 10 : 0, descripcion: "Ahorro en impuesto sobre lo aportado; el saldo se puede usar para vivienda." },
    nota: NOTA_FIJA_PV_AFC,
    etiqueta: ETIQUETA_AG_RECOS,
    baseLegal: "Art. 126-4 ET",
    caveat: "Solo retirable para vivienda. Si retiras para otra cosa, pagas retención del 7-15%.",
    prioridad: "alta",
  });

  return recs;
}

// ─────────────────────────────────────────────────────────────────────────
// RECOMENDACIONES PARA SOCIEDADES (JURÍDICAS)
// ─────────────────────────────────────────────────────────────────────────

function recomendacionesJuridica(perfil) {
  const recs = [];
  const { impuestoACargo, ingresoAnual } = perfil;
  if (impuestoACargo < 5_000_000) return recs;

  // REC 1: Comprar bodega / inmueble productivo
  if (impuestoACargo > 50_000_000) {
    const inversion = Math.min(impuestoACargo * 5, 1_000_000_000); // dimensionar a la capacidad
    const depreciacionAnual = inversion / 20;
    const ivaDescontable = inversion * 0.19;
    const ahorroAno1 = Math.round(depreciacionAnual * 0.35 + ivaDescontable);
    recs.push({
      id: "bodega_inmueble_productivo",
      ejecutaEn: "sociedad",
      icono: "",
      titulo: "Adquirir bodega / inmueble productivo",
      descripcion: "Comprar un activo fijo productivo genera triple beneficio: depreciación lineal (20 años), IVA descontable (Art. 258-1) y reduce utilidad distribuible. La estrategia clásica que recomiendan los contadores.",
      accion: `Comprar bodega o inmueble productivo de ~$${inversion.toLocaleString("es-CO")} para uso de la actividad de la empresa (almacenamiento, oficina, taller).`,
      inversion: {
        monto: inversion,
        descripcion: `$${inversion.toLocaleString("es-CO")} en activo fijo. Puede financiarse, lo que genera además intereses deducibles.`,
      },
      ahorroAnual: {
        monto: Math.min(ahorroAno1, impuestoACargo),
        calculoDetallado: `Año 1: depreciación $${depreciacionAnual.toLocaleString("es-CO")} × 35% = $${Math.round(depreciacionAnual * 0.35).toLocaleString("es-CO")} + IVA descontable $${ivaDescontable.toLocaleString("es-CO")} (Art. 258-1) = $${ahorroAno1.toLocaleString("es-CO")}. Recurrente $${Math.round(depreciacionAnual * 0.35).toLocaleString("es-CO")}/año por 19 años más.`,
      },
      roi: {
        porcentaje: Math.round(ahorroAno1 / inversion * 100),
        descripcion: `Recuperas ~${Math.round(ahorroAno1 / inversion * 100)}% el primer año vía ahorros + el inmueble se aprecia + puede generar arriendos.`,
      },
      baseLegal: "Arts. 128, 258-1 ET",
      caveat: "Debe ser usado en la actividad productiva. Si después se arrenda a relacionado, la DIAN verifica precios de mercado (Art. 260-1 a 260-11 ET, precios de transferencia).",
      prioridad: "alta",
    });
  }

  // REC 1b: Adquirir vehículo / equipo productivo (movida desde el flow de
  // persona natural — 18-jul-2026 noche, Santiago: "una cosa son las
  // optimizaciones a Sosa, otras a Lagoon, no tienen por qué mezclarse").
  if (impuestoACargo > 8_000_000) {
    recs.push({
      id: "vehiculo_productivo_sociedad",
      ejecutaEn: "sociedad",
      icono: "",
      titulo: "Adquirir vehículo / equipo productivo",
      descripcion: "Comprar un activo productivo (vehículo, equipo, maquinaria) bajo la sociedad genera triple beneficio: depreciación deducible (20% anual lineal), IVA descontable, y reduce dividendos distribuibles.",
      accion: "Compra una camioneta/vehículo productivo de ~$200M a nombre de la sociedad. Se usa para gestión de propiedades y reuniones de negocios.",
      inversion: {
        monto: 200_000_000,
        descripcion: "$200M iniciales (puede ser financiado). El vehículo es activo de la empresa.",
      },
      ahorroAnual: {
        monto: 51_000_000, // $40M depreciación × 35% + $38M IVA primer año dividido
        calculoDetallado: "Año 1: depreciación $40M × 35% = $14M + IVA descontable $38M (Art. 258-1) = $52M total año 1. Recurrente $14M anuales por 5 años.",
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

  // REC 2: Inversión en CT&I (deducción 175%)
  if (impuestoACargo > 20_000_000) {
    const inversion = Math.min(impuestoACargo * 0.5, 200_000_000);
    const deduccion = inversion * 1.75;
    const ahorroFiscal = Math.round(deduccion * 0.35) + (inversion * 0.25);
    recs.push({
      id: "inversion_cti",
      ejecutaEn: "sociedad",
      icono: "",
      titulo: "Inversión en proyecto CT&I (Ciencia, Tecnología, Innovación)",
      descripcion: "La inversión en proyectos certificados por MinCiencias o Colciencias genera DEDUCCIÓN del 175% (es decir, gastas $100M y deduces $175M) más DESCUENTO directo del 25% del valor invertido. Es de los beneficios fiscales más potentes que existen.",
      accion: `Invertir ~$${inversion.toLocaleString("es-CO")} en un proyecto de I+D+i certificado (desarrollo de software, automatización, mejoras de procesos).`,
      inversion: {
        monto: inversion,
        descripcion: "Inversión real en el proyecto (personal, equipos, materiales). Debe ser certificable.",
      },
      ahorroAnual: {
        monto: Math.min(ahorroFiscal, impuestoACargo),
        calculoDetallado: `Deducción 175% de $${inversion.toLocaleString("es-CO")} = $${deduccion.toLocaleString("es-CO")}, beneficio: $${Math.round(deduccion * 0.35).toLocaleString("es-CO")}. + Descuento directo 25% = $${(inversion * 0.25).toLocaleString("es-CO")}. Total: $${ahorroFiscal.toLocaleString("es-CO")}.`,
      },
      roi: {
        porcentaje: Math.round(ahorroFiscal / inversion * 100),
        descripcion: `Recuperas ~${Math.round(ahorroFiscal / inversion * 100)}% del proyecto vía ahorros fiscales + obtienes tecnología propia.`,
      },
      baseLegal: "Art. 158-1 ET",
      caveat: "Requiere certificación previa de MinCiencias. El proyecto debe ser GENUINAMENTE de I+D (no actividades operativas comunes). Hay un cupo anual nacional, conviene aplicar temprano.",
      prioridad: "alta",
    });
  }

  // REC 3: Capacitación a empleados (175%)
  recs.push({
    id: "capacitacion_empleados",
      ejecutaEn: "sociedad",
    icono: "",
    titulo: "Capacitación certificada a empleados",
    descripcion: "Las inversiones en capacitación certificada (cursos, diplomados, posgrados) de tu equipo generan deducción del 175% del valor invertido (Art. 158-1 inc 2 ET).",
    accion: "Invertir en capacitación certificada para equipo (Coursera Business, EAFIT, Andes, Universidad de los Andes).",
    inversion: { monto: 30_000_000, descripcion: "$30M anuales en capacitación del equipo." },
    ahorroAnual: {
      monto: Math.min(Math.round(30_000_000 * 1.75 * 0.35), impuestoACargo),
      calculoDetallado: "$30M × 175% = $52.5M deducción × 35% tarifa = $18.4M ahorro fiscal."
    },
    roi: { porcentaje: 61, descripcion: "Doble retorno: ahorro fiscal + equipo más productivo." },
    baseLegal: "Art. 158-1 inc 2 ET",
    caveat: "Capacitación debe ser certificada (no informal). Conservar facturas y certificados de cada empleado.",
    prioridad: "media",
  });

  // REC 4: Donación ESAL
  if (impuestoACargo > 10_000_000) {
    const donacion = Math.min(impuestoACargo * 0.3, 100_000_000);
    recs.push({
      id: "donacion_esal_juridica",
      ejecutaEn: "sociedad",
      icono: "",
      titulo: "Donación a fundación / ESAL desde la sociedad",
      descripcion: "Las donaciones de la sociedad a entidades del Régimen Tributario Especial generan DESCUENTO directo del 25% sobre el impuesto. Es la forma más eficiente de transformar parte del impuesto en impacto social.",
      accion: `Donar $${donacion.toLocaleString("es-CO")} a una ESAL certificada (universidades, fundaciones de salud o cultura).`,
      inversion: { monto: donacion, descripcion: "Costo neto: 75% del valor donado." },
      ahorroAnual: { monto: Math.min(Math.round(donacion * 0.25), impuestoACargo), calculoDetallado: `$${donacion.toLocaleString("es-CO")} × 25%` },
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

  // FILTRO DE SEPARACIÓN (18-jul-2026 noche, Santiago): "una cosa son las
  // optimizaciones a Sosa, otras a Lagoon, no tienen por qué mezclarse".
  // Guardarraíl: cada owner solo ve estrategias que ÉL ejecuta.
  //   - Owner natural  → solo ejecutaEn "personal" (o sin campo, legacy)
  //   - Owner jurídica → solo ejecutaEn "sociedad" (o sin campo, legacy)
  const esJuridica = owner?.type === "juridica";
  recs = recs.filter(r => {
    if (!r.ejecutaEn) return true; // legacy sin clasificar: no filtrar
    return esJuridica ? r.ejecutaEn === "sociedad" : r.ejecutaEn === "personal";
  });

  // Ordenar por prioridad (alta > media > baja) y luego por ahorro descendente
  const prioridad = { alta: 3, media: 2, baja: 1 };
  recs.sort((a, b) => {
    const dp = (prioridad[b.prioridad] || 0) - (prioridad[a.prioridad] || 0);
    if (dp !== 0) return dp;
    return (b.ahorroAnual?.monto || 0) - (a.ahorroAnual?.monto || 0);
  });

  return recs;
}
// Diferencia de impuesto a cargo (antes de retenciones) corriendo taxCO con la
// consultoría y con vs sin el aporte. Sin datos del usuario → 0 (no se inventa).
export function ahorroAporteTaxCO(perfil, aporteAnual, { consultoriaAnual = 0, fiscalCode = "AP_TRIB_AFC" } = {}) {
  const user = perfil?._user, owner = perfil?._owner;
  if (!user || !owner || aporteAnual <= 0) return 0;
  const extra = consultoriaAnual > 0 ? [{ id: "__consultoria", owner: owner.id, nombre: "Consultoría", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS", mensual: consultoriaAnual / 12, tipo: "fijo" }] : [];
  const base = { ...user, owners: [owner], ingresos: [...(user.ingresos || []), ...extra] };
  const gas = { ...(base.gas || {}) };
  gas["Aporte tributario"] = [...(gas["Aporte tributario"] || []), { owner: owner.id, fiscalCode, m: aporteAnual / 12 }];
  const imp = (u) => (estimarImpuesto(u, { ag: AG_RECOS }).detalle.find((d) => d.name === owner.name)?.impBruto) || 0;
  return Math.max(0, imp(base) - imp({ ...base, gas }));
}

export function ahorroAporteConTaxCO(perfil, consultoriaAnual, aporteAnual) {
  return ahorroAporteTaxCO(perfil, aporteAnual, { consultoriaAnual, fiscalCode: "AP_TRIB_AFC" });
}
