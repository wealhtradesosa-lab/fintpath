// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · plans.js — Source of truth ÚNICO del pricing
//
// Antes de este archivo, las definiciones de planes vivían duplicadas en
// src/App.jsx (pricing del app autenticado) y src/components/LandingPage.jsx
// (pricing de la home pública). Esa duplicación causó al menos 2
// desincronizaciones documentadas:
//
//   1. Pro Familiar quedó como "PRONTO DISPONIBLE" en la landing pública
//      cuando ya estaba comprable en el app autenticado (commit 51e870c).
//
//   2. Inconsistencia de monedas: el app mostraba COP/mes mientras la
//      landing mostraba USD/mes — causando confusión a usuarios CO.
//
// Este módulo expone:
//
//   - PLAN_BASE: definición canónica de cada plan (precio USD, slots,
//     features universales, priceIds Stripe). Los componentes consumen
//     esta única fuente.
//
//   - getPlansForApp({plan, isUS, trm, billingCycle}):
//     Retorna lista de planes en formato esperado por App.jsx (con flags
//     `cur`, `ac`, `pr`, `pRef`, `f`, `no`, etc.).
//
//   - getPlansForLanding({trm}):
//     Retorna lista de planes en formato esperado por LandingPage.jsx
//     (con `sub`, `copEquiv`, `accent`, `users`, etc.).
//
//   - STRIPE_PRICE_IDS: mapeo nombre → priceId mensual/anual. Único lugar
//     donde estos IDs se hardcodean.
//
//   - usdToCop(usd, trm): helper compartido para convertir USD → string
//     COP usando la TRM del día. Redondeo a centena.
//
// FILOSOFÍA:
//   - USD es la moneda en la que Stripe cobra. Es la fuente de verdad
//     numérica.
//   - COP es referencia visual para el user CO. Si la TRM cambia, el
//     equivalente se actualiza solo (sin redeploy) porque sale del API.
//   - Un solo cambio aquí se refleja AUTOMÁTICAMENTE en ambas pantallas.
// ═══════════════════════════════════════════════════════════════════════════

// ── PriceIds Stripe (Live mode workspace pix2print) ───────────────────────
export const STRIPE_PRICE_IDS = {
  "Básico": {
    mensual: "price_1TIGRWKEnhNr9wQd2oEgNin9",
    anual: "price_1TIGRWKEnhNr9wQdJTMTGfYa",
  },
  "Pro": {
    mensual: "price_1TIGRXKEnhNr9wQdC8eKj2xS",
    anual: "price_1TIGRYKEnhNr9wQd7QTFxT6z",
  },
  "Pro Familiar": {
    mensual: "price_1TRC9mKEnhNr9wQdQr9gsRot",
    anual: "price_1TRCCaKEnhNr9wQdpWlaXP0r",
  },
};

// ── Helper compartido USD → COP ────────────────────────────────────────────
// Redondeo a centena para presentación limpia. Fallback TRM=4200 si no se cargó.
export function usdToCop(usd, trm) {
  const cop = Math.round(usd * (trm || 4200) / 100) * 100;
  return "≈ $" + cop.toLocaleString("es-CO") + " COP";
}

// ── Definición canónica: cada plan UNA sola vez ────────────────────────────
// Los precios USD son hardcoded (Stripe cobra USD). Las features pueden
// variar según jurisdicción (CO ve Colpensiones/RAIS, US ve 401k). Eso se
// resuelve en los getters de abajo según el flag isUS.
export const PLAN_BASE = [
  {
    name: "Free",
    tag: "Empezá a ordenar tu vida financiera",
    priceUSD: { mensual: 0, anual: 0 },
    users: "1 usuario",
    usersDetail: "1 usuario",
    maxMembers: 1,
    isFree: true,
    // Features universales (válidas para CO y US)
    // Sesión 4-may-2026: copy aprobado por Santiago — listas COMPLETAS,
    // no "lo del anterior + ...". Cada plan se cuenta solo, así el lector
    // ve TODO lo que incluye sin tener que comparar mentalmente.
    features: [
      "👤 1 usuario",
      "📊 Dashboard con resumen de tu patrimonio",
      "💰 Registrá ingresos, gastos y deudas",
      "📈 Hasta 3 inversiones y 1 meta financiera",
      "🔒 Encriptación E2E de tus datos",
    ],
    notFeatures: [
      "Simulador financiero",
      "Pensiones",
      "Ahorro BTC",
      "Trading",
      "Plan Tributario",
      "Asesor IA",
      "Coaches IA",
      "Lectura de facturas IA",
    ],
  },
  {
    name: "Básico",
    tag: "Tu vida financiera completa, ordenada",
    priceUSD: { mensual: 8, anual: 6 },
    users: "1 usuario",
    usersDetail: "1 usuario",
    maxMembers: 1,
    save: "Ahorra 25%",
    // Features con dependencia de jurisdicción (resuelta en getters)
    features: ({ isCO, isUS }) => [
      "👤 1 usuario · sin límites en inversiones ni metas",
      "📊 Dashboard con resumen patrimonial",
      "💰 Ingresos, gastos y deudas ilimitados",
      "🖥️ Simulador financiero con palancas (cambiá ingresos/gastos y simulá)",
      isUS
        ? "🏛️ Pensión US: 401(k) + IRA + Social Security"
        : "🏛️ Pensión Colombia: Colpensiones (RPM) + RAIS",
      isCO ? "💰 Aportes obligatorios (4%+4%) y voluntarios calculados" : null,
      "₿ Ahorro en BTC con proyecciones por ciclo halving",
      "💹 Trading portfolio: acciones US + crypto",
      "📥 Importá Excel/CSV con IA",
      "📸 Lectura de facturas con IA",
    ].filter(Boolean),
    notFeatures: ["Asesor IA", "5 Coaches IA", "Plan Tributario completo", "Multi-usuario"],
  },
  {
    name: "Pro",
    tag: "Como tener un asesor financiero personal",
    priceUSD: { mensual: 16, anual: 12 },
    users: "Hasta 3 usuarios",
    usersDetail: "Hasta 3 usuarios (vos + pareja + contador)",
    maxMembers: 3,
    accent: true, // MÁS POPULAR badge
    save: "Ahorra 25%",
    features: ({ isCO, isUS }) => [
      "👥 Hasta 3 usuarios (vos + pareja + contador)",
      "📊 Dashboard con resumen patrimonial",
      "💰 Ingresos, gastos y deudas ilimitados",
      "🖥️ Simulador financiero con palancas",
      isUS
        ? "🏛️ Pensión US: 401(k) + IRA + Social Security"
        : "🏛️ Pensión Colombia: Colpensiones + RAIS",
      "₿ Ahorro en BTC con proyecciones por ciclo halving",
      "💹 Trading portfolio: acciones US + crypto",
      "🤖 Asesor IA que analiza tus números reales",
      "🧠 5 Coaches IA: Cashflowista, Estratega, Auditor, Fundamentalista, Contrarian",
      isCO
        ? "🧾 Plan Tributario Colombia completo (renta, retención, ICA, GMF)"
        : "🧾 Tax Planning US (federal + state, deductions, optimization)",
      "📥 Importá Excel/CSV y leé facturas con IA",
      "📈 Resumen ejecutivo del patrimonio en PDF",
      "🚀 Soporte prioritario por email",
    ],
    notFeatures: [],
  },
  {
    name: "Pro Familiar",
    tag: "Administra tu patrimonio en familia",
    priceUSD: { mensual: 27, anual: 20 },
    users: "Hasta 10 usuarios",
    usersDetail: "Hasta 10 usuarios compartiendo el mismo patrimonio",
    maxMembers: 10,
    save: "Ahorra 25%",
    features: ({ isCO, isUS }) => [
      "👨‍👩‍👧 10 usuarios con acceso al patrimonio compartido",
      "🔐 Roles: administrador edita, contador y familia consultan",
      "🧾 Tu contador revisa tus números sin pedirte nada",
      "📊 Dashboard con resumen patrimonial",
      "💰 Ingresos, gastos y deudas ilimitados",
      "🖥️ Simulador financiero con palancas",
      isUS
        ? "🏛️ Pensión US: 401(k) + IRA + Social Security"
        : "🏛️ Pensión Colombia: Colpensiones + RAIS",
      "₿ Ahorro en BTC con proyecciones por ciclo halving",
      "💹 Trading portfolio: acciones US + crypto",
      "🎯 Simulá escenarios para alcanzar tu libertad financiera",
      "🤖 Asesor IA que analiza el patrimonio consolidado",
      "🧠 5 Coaches IA: Cashflowista, Estratega, Auditor, Fundamentalista, Contrarian",
      isCO
        ? "🧾 Plan Tributario Colombia completo (renta, retención, ICA, GMF)"
        : "🧾 Tax Planning US (federal + state, deductions, optimization)",
      "📥 Importá Excel/CSV y leé facturas con IA",
      "📈 Reporte ejecutivo del patrimonio en PDF",
      "🚀 Soporte prioritario con respuesta en 24h",
    ],
    notFeatures: [],
  },
];

// ── Plan extra solo para landing pública: "Para Asesores" ─────────────────
// No es comprable directo desde el app (es enterprise sales con $79+/mes).
// Solo se renderiza en LandingPage como info.
const ADVISOR_PLAN_LANDING = {
  name: "Para Asesores",
  tag: "Para asesores y contadores",
  priceUSD: { mensual: 79, anual: 79 },
  subOverride: "Desde — hasta $399 según tamaño de cartera",
  users: "Hasta 40+ clientes",
  usersDetail: "Hasta 40+ clientes",
  features: () => [
    "Hasta 40 clientes gestionados",
    "Dashboard Pro completo por cliente",
    "Panel unificado del asesor",
    "Plan tributario automático",
    "Reportes PDF profesionales",
  ],
  notFeatures: [],
  isAdvisor: true,
};

// ═══════════════════════════════════════════════════════════════════════════
// getPlansForApp — formato esperado por src/App.jsx pricing
//
// Recibe estado del app: plan actual del user, jurisdicción, TRM,
// billingCycle. Retorna lista con flags `cur` (plan actual), `ac` (más
// popular), y precios listos para renderizar.
// ═══════════════════════════════════════════════════════════════════════════
export function getPlansForApp({ plan, isUS, trm, billingCycle }) {
  const isCO = !isUS;
  return PLAN_BASE.map(b => {
    const isFree = b.isFree;
    const features = typeof b.features === "function" ? b.features({ isCO, isUS }) : b.features;
    return {
      n: b.name,
      tag: b.tag,
      // Precio mostrado: "$0", "$8", "$27"
      p: {
        mensual: "$" + b.priceUSD.mensual,
        anual: "$" + b.priceUSD.anual,
      },
      // Sufijo del precio: "USD /mes" o "gratis"
      pr: {
        mensual: isFree ? "gratis" : "USD /mes",
        anual: isFree ? "gratis" : "USD /mes",
      },
      // Equivalente COP (solo para CO, solo para planes pagos)
      pRef: isFree
        ? null
        : {
            mensual: isUS ? null : usdToCop(b.priceUSD.mensual, trm),
            anual: isUS ? null : usdToCop(b.priceUSD.anual, trm),
          },
      save: isFree ? null : b.save,
      users: b.usersDetail,
      f: features,
      no: b.notFeatures,
      cur: plan === planNameToCanonical(b.name),
      ac: !!b.accent,
    };
  });
}

// Convierte el nombre del plan al string canónico usado en user_data.plan
// Ej: "Básico" → "basico", "Pro Familiar" → "pro_familiar"
function planNameToCanonical(name) {
  if (name === "Free") return "free";
  if (name === "Básico") return "basico";
  if (name === "Pro") return "pro";
  if (name === "Pro Familiar") return "pro_familiar";
  return name.toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
// getPlansForLanding — formato esperado por src/components/LandingPage.jsx
//
// La landing es pública (no hay user logueado) entonces no hay flags de
// plan actual. Asumimos isCO por default (jurisdicción se resuelve en el
// app después del login). Renderiza los 4 planes principales + advisor.
// ═══════════════════════════════════════════════════════════════════════════
export function getPlansForLanding({ trm }) {
  // Para landing usamos jurisdicción CO por default (audiencia primaria)
  const isCO = true, isUS = false;
  const mainPlans = PLAN_BASE.map(b => {
    const isFree = b.isFree;
    const features = typeof b.features === "function" ? b.features({ isCO, isUS }) : b.features;
    const sub = isFree
      ? null
      : "$" + b.priceUSD.anual + " USD/mes anual — Ahorra 25%";
    return {
      name: b.name,
      price: "$" + b.priceUSD.mensual,
      per: isFree ? "gratis" : "USD/mes",
      sub,
      copEquiv: isFree ? null : usdToCop(b.priceUSD.mensual, trm),
      tag: b.tag,
      users: b.users,
      features,
      no: b.notFeatures,
      accent: !!b.accent,
      cta: ctaForPlan(b.name),
    };
  });

  // Plan advisor solo en landing, comingSoon
  const advisorFeatures = typeof ADVISOR_PLAN_LANDING.features === "function"
    ? ADVISOR_PLAN_LANDING.features()
    : ADVISOR_PLAN_LANDING.features;
  mainPlans.push({
    name: ADVISOR_PLAN_LANDING.name,
    price: "$" + ADVISOR_PLAN_LANDING.priceUSD.mensual,
    per: "USD/mes",
    sub: ADVISOR_PLAN_LANDING.subOverride,
    copEquiv: usdToCop(ADVISOR_PLAN_LANDING.priceUSD.mensual, trm),
    tag: ADVISOR_PLAN_LANDING.tag,
    users: ADVISOR_PLAN_LANDING.usersDetail,
    features: advisorFeatures,
    no: ADVISOR_PLAN_LANDING.notFeatures,
    advisor: true,
    cta: "Hablemos",
  });

  return mainPlans;
}

function ctaForPlan(name) {
  if (name === "Free") return "Comenzar gratis";
  if (name === "Básico") return "Probar 14 días";
  if (name === "Pro") return "Probar 14 días Pro";
  if (name === "Pro Familiar") return "Probar 14 días Pro Familiar";
  return "Contactar";
}
