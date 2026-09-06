// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · glosario.js — Diccionario de términos tributarios en lenguaje humano
//
// PROPÓSITO:
//   Definir todos los términos técnicos que aparecen en la app (UVT, retención,
//   INCRNGO, cédula, AFC, etc.) traducidos a explicaciones SIMPLES que una
//   persona común sin formación tributaria pueda entender en 5 segundos.
//
// FILOSOFÍA:
//   - 1-2 frases máximo por término
//   - Ejemplo concreto cuando ayuda
//   - Sin usar otros términos técnicos en la explicación
//   - Tono conversacional, no DIAN-speak
//
// USO:
//   import { obtenerTermino } from "./glosario.js";
//   const t = obtenerTermino("uvt");
//   console.log(t.explicacion);
//   console.log(t.ejemplo);
// ═══════════════════════════════════════════════════════════════════════════

const GLOSARIO = {
  // ── UNIDADES Y CONSTANTES ───────────────────────────────────────────────
  uvt: {
    termino: "UVT",
    nombreCompleto: "Unidad de Valor Tributario",
    explicacion: "Es como una 'moneda fiscal' que la DIAN actualiza cada año para evitar usar pesos directamente en las leyes. Se usa para definir topes de deducción, sanciones, etc.",
    ejemplo: "1 UVT en AG 2025 = $49.799 (AG 2026 = $52.374). Si una ley dice 'tope 1.200 UVT', son ~$59.8 millones en AG 2025.",
  },
  smmlv: {
    termino: "SMMLV",
    nombreCompleto: "Salario Mínimo Mensual Legal Vigente",
    explicacion: "Es el salario mínimo legal en Colombia. Se actualiza cada año por decreto.",
    ejemplo: "SMMLV 2026 = $1.750.905 al mes.",
  },
  trm: {
    termino: "TRM",
    nombreCompleto: "Tasa Representativa del Mercado",
    explicacion: "Es la tasa oficial de cambio del dólar a pesos colombianos que publica el Banco de la República cada día.",
    ejemplo: "Para declarar ingresos en USD, usás la TRM oficial de cada día (o promedio del año, según el caso).",
  },

  // ── TIPOS DE INGRESO Y CÉDULAS ──────────────────────────────────────────
  cedula: {
    termino: "Cédula",
    nombreCompleto: "Cédula tributaria",
    explicacion: "Es como 'cajones' separados donde la DIAN clasifica tus ingresos. Cada cajón paga impuesto con sus propias reglas.",
    ejemplo: "Para personas naturales hay 5 cédulas: trabajo, pensiones, capital, no laboral, dividendos.",
  },
  cedulaGeneral: {
    termino: "Cédula General",
    nombreCompleto: "Cédula General de la persona natural",
    explicacion: "Es donde van tus ingresos por trabajo: salarios, honorarios, comisiones. Tiene las deducciones más generosas.",
    ejemplo: "Si trabajás como empleado o freelancer, tus ingresos van acá.",
  },
  cedulaCapital: {
    termino: "Cédula de capital",
    explicacion: "Acá van tus ingresos pasivos: intereses de CDT, rendimientos de fondos, etc. Tributa por separado de tu salario.",
    ejemplo: "Los intereses de tus ahorros bancarios van a esta cédula.",
  },
  cedulaNoLaboral: {
    termino: "Cédula no laboral",
    explicacion: "Acá van ingresos como arriendos, regalías, indemnizaciones. No son trabajo ni capital puro.",
    ejemplo: "Si alquilás un apartamento, la plata del arriendo va a esta cédula.",
  },
  cedulaDividendos: {
    termino: "Cédula de dividendos",
    explicacion: "Acá van los dividendos que recibís de sociedades (SAS, Ltda). Tienen tarifa especial (7.5% típicamente).",
  },
  gananciaOcasional: {
    termino: "Ganancia ocasional",
    explicacion: "Es plata que ganás de forma esporádica: vender una propiedad después de 2+ años, herencias, premios, lotería. Tributa al 15% (más bajo que renta normal).",
    ejemplo: "Si vendés tu casa con utilidad después de tenerla más de 2 años, esa utilidad va acá.",
  },

  // ── DEDUCCIONES Y EXENCIONES ────────────────────────────────────────────
  rentaExenta: {
    termino: "Renta exenta",
    explicacion: "Es plata que ganaste pero la ley te permite NO pagar impuesto sobre ella.",
    ejemplo: "Los aportes a Pensión Voluntaria son renta exenta hasta cierto tope.",
  },
  deduccion: {
    termino: "Deducción",
    explicacion: "Es un gasto que la ley te permite restar de tus ingresos antes de calcular el impuesto. A más deducciones, menos impuesto.",
    ejemplo: "Los intereses de tu hipoteca de vivienda son deducibles.",
  },
  incrngo: {
    termino: "INCRNGO",
    nombreCompleto: "Ingreso no constitutivo de renta ni ganancia ocasional",
    explicacion: "Es plata que recibiste pero la ley dice que NO cuenta como ingreso para impuestos.",
    ejemplo: "Los aportes obligatorios a pensión y salud (4% + 4%) son INCRNGO.",
  },
  componenteInflacionario: {
    termino: "Componente inflacionario",
    nombreCompleto: "Componente inflacionario de los rendimientos financieros",
    explicacion: "Es la parte de tus intereses bancarios que NO paga impuesto, porque solo compensa la inflación. La DIAN excluye automáticamente ~50% de tus intereses.",
    ejemplo: "Si te pagaron $10M en intereses CDT, solo ~$4.9M tributan.",
  },
  rentaPresuntiva: {
    termino: "Renta presuntiva",
    explicacion: "Es un mínimo de renta que la DIAN asume que generaste según tu patrimonio, aunque hayas declarado menos. Hoy en Colombia está en 0% (suspendida).",
  },

  // ── PALANCAS DE OPTIMIZACIÓN ────────────────────────────────────────────
  afc: {
    termino: "AFC",
    nombreCompleto: "Ahorro al Fomento de la Construcción",
    explicacion: "Es una cuenta de ahorro especial para comprar vivienda. La plata que ahorrás ahí es renta exenta (no paga impuesto).",
    ejemplo: "Si aportás $1M al mes a tu cuenta AFC, esos $12M al año reducen tu impuesto.",
  },
  pensionVoluntaria: {
    termino: "Pensión Voluntaria",
    nombreCompleto: "Aportes voluntarios al fondo de pensión",
    explicacion: "Aportes EXTRA (más allá del 4% obligatorio) a tu fondo de pensión. Son renta exenta y reducen tu impuesto significativamente.",
    ejemplo: "Es la palanca más poderosa para reducir impuesto: por cada $1 que aportás, ahorrás hasta $0.39 de impuesto.",
  },
  dependientes: {
    termino: "Deducción por dependientes",
    explicacion: "Si tenés hijos menores de 23 años, padres mayores que dependen de vos, o cónyuge sin ingresos, podés deducir el 10% de tu salario (hasta cierto tope).",
    ejemplo: "Con dependientes podés ahorrar entre $1M-$8M de impuesto al año.",
  },

  // ── IMPUESTOS Y TARIFAS ─────────────────────────────────────────────────
  retencion: {
    termino: "Retención en la fuente",
    explicacion: "Es plata que el banco, tu empleador o tu inquilino le entrega directo a la DIAN ANTES de pagarte. Ya pagaste parte de tu impuesto sin darte cuenta.",
    ejemplo: "Si te pagan salario, te retienen una parte cada mes. En la declaración anual, esa retención reduce lo que tenés que pagar al final.",
  },
  autoretencion: {
    termino: "Autorretención",
    explicacion: "Cuando vos mismo retenés una parte de tus ingresos y la pagás directo a la DIAN. Aplica para ciertas sociedades.",
  },
  anticipo: {
    termino: "Anticipo de renta",
    explicacion: "Es un pago adelantado del impuesto del PRÓXIMO año. La DIAN te obliga a pagar el 25% al 75% del impuesto que ya pagaste, anticipado.",
  },
  saldoAFavor: {
    termino: "Saldo a favor",
    explicacion: "Cuando las retenciones que ya pagaste durante el año son MAYORES al impuesto que te tocaba. La DIAN te debe la diferencia.",
    ejemplo: "Podés pedirla de regreso o aplicarla al año siguiente.",
  },
  tasaEfectiva: {
    termino: "Tasa efectiva",
    explicacion: "Es el porcentaje real de tus ingresos que terminás pagando como impuesto. Diferente de la tarifa máxima.",
    ejemplo: "Si ganás $100M y pagás $15M de impuesto, tu tasa efectiva es 15%.",
  },
  gmf: {
    termino: "GMF",
    nombreCompleto: "Gravamen a los Movimientos Financieros (4x1000)",
    explicacion: "Es el 0.4% que el banco te cobra cuando hacés ciertas transacciones (sacar plata, transferir, pagar). El 50% es deducible.",
    ejemplo: "Si gastaste $1M en GMF durante el año, podés deducir $500.000 de tu renta.",
  },
  ica: {
    termino: "ICA",
    nombreCompleto: "Impuesto de Industria y Comercio",
    explicacion: "Impuesto municipal que pagan los comercios. Personas naturales no lo pagan, pero las sociedades sí (y es deducible del impuesto de renta).",
  },

  // ── ESTRUCTURAS Y RÉGIMENES ─────────────────────────────────────────────
  personaNatural: {
    termino: "Persona natural",
    explicacion: "Sos vos como individuo. Tu cédula es tu 'NIT' personal. Declarás según tu salario, ahorros, propiedades, etc.",
  },
  personaJuridica: {
    termino: "Persona jurídica",
    explicacion: "Es una sociedad (SAS, Ltda, etc.) que paga impuestos por separado de sus dueños. Tiene su propio NIT.",
    ejemplo: "Si tenés una SAS, esa empresa declara renta aparte de tu declaración personal.",
  },
  regimenOrdinario: {
    termino: "Régimen ordinario",
    explicacion: "Es el régimen tributario estándar para sociedades. Pagan 35% del impuesto sobre la utilidad neta.",
  },
  regimenSimple: {
    termino: "Régimen Simple",
    explicacion: "Régimen simplificado para sociedades pequeñas/medianas (hasta cierto tope de ingresos). Tarifa más baja (1.2% a 14% según actividad) y unifica varios impuestos.",
    ejemplo: "Si tu SAS factura menos de ~$5.000M al año, podría calificar para Simple y pagar mucho menos.",
  },
  holding: {
    termino: "Holding",
    explicacion: "Una sociedad cuyo único propósito es tener activos (otras empresas, inmuebles) y recibir sus rendimientos. Útil para optimizar impuestos en patrimonios grandes.",
  },

  // ── FORMULARIOS DIAN ────────────────────────────────────────────────────
  f110: {
    termino: "F-110",
    nombreCompleto: "Formulario 110 de la DIAN",
    explicacion: "Es el formulario que las sociedades (SAS, Ltda) usan para declarar renta cada año. Tiene ~30 renglones.",
  },
  f210: {
    termino: "F-210",
    nombreCompleto: "Formulario 210 de la DIAN",
    explicacion: "Es el formulario que las personas naturales usan para declarar renta. Está organizado por cédulas.",
  },
  dian: {
    termino: "DIAN",
    nombreCompleto: "Dirección de Impuestos y Aduanas Nacionales",
    explicacion: "Es la entidad que recauda los impuestos en Colombia. Equivalente al IRS de Estados Unidos.",
  },

  // ── PATRIMONIO ──────────────────────────────────────────────────────────
  patrimonioBruto: {
    termino: "Patrimonio bruto",
    explicacion: "Es la suma de TODO lo que tenés: efectivo, ahorros, inversiones, propiedades, vehículos. Sin restar deudas.",
  },
  patrimonioLiquido: {
    termino: "Patrimonio líquido",
    explicacion: "Es tu patrimonio bruto MENOS tus deudas. Lo que realmente vale tu situación financiera.",
    ejemplo: "Si tenés $500M en activos y debés $200M, tu patrimonio líquido es $300M.",
  },
  pasivos: {
    termino: "Pasivos",
    explicacion: "Son tus deudas: hipotecas, préstamos, tarjetas de crédito.",
  },
};

/**
 * Busca un término en el glosario por clave (insensible a mayúsculas).
 * @returns {object|null} { termino, explicacion, ejemplo? } o null si no existe
 */
export function obtenerTermino(clave) {
  if (!clave) return null;
  const k = String(clave).toLowerCase().replace(/[\s\-_]/g, "");
  // Búsqueda exacta primero
  for (const [key, val] of Object.entries(GLOSARIO)) {
    if (key.toLowerCase() === k) return val;
  }
  // Búsqueda por término visible (UVT, AFC, etc.)
  for (const val of Object.values(GLOSARIO)) {
    if (val.termino && val.termino.toLowerCase().replace(/[\s\-_]/g, "") === k) return val;
  }
  return null;
}

/**
 * Lista todos los términos disponibles (útil para validación o página de ayuda).
 */
export function listarTerminos() {
  return Object.entries(GLOSARIO).map(([clave, val]) => ({
    clave,
    ...val,
  }));
}

export default GLOSARIO;