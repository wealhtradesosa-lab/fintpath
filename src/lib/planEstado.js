// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Estado de plan — fuente ÚNICA para mostrar el plan al usuario.
//
// 26-sep-2026. El menú lateral decía "Pro ⭐ Trial" mientras Mi cuenta decía
// "Plan gratuito": cada pantalla derivaba el plan por su lado (una del trial
// de la app, otra de la tabla accounts). Ahora todas las pantallas leen el
// mismo objeto que sale de aquí.
//
// No cambia el gating: App.jsx sigue calculando `plan`/`hasProAccess` igual.
// Este módulo solo decide QUÉ SE MUESTRA, con las mismas reglas.
//
// Reglas de la prueba (idénticas a App.jsx):
//   · p.trialEnd = "YYYY-MM-DD"; la prueba vale mientras new Date(trialEnd)
//     >= ahora, o sea hasta las 00:00 UTC de ese día.
//   · días restantes = ceil((fin - ahora) / 1 día).
// ═══════════════════════════════════════════════════════════════════════════

const DIA_MS = 86400000;

// Stripe Checkout exige trial_end ≥ 48 h en el futuro. MISMA constante que
// netlify/functions/stripe-checkout.cjs (calcularTrialStripe). Si cambias
// una, cambia la otra.
export const MIN_TRIAL_MS = 48 * 3600 * 1000 + 10 * 60 * 1000;

export function finPruebaMs(trialEnd) {
  if (!trialEnd || typeof trialEnd !== "string") return null;
  const ms = new Date(trialEnd).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Fecha del primer cobro si el usuario agrega tarjeta HOY, con la misma regla
// que usa el servidor para trial_end. null si no hay prueba vigente.
export function fechaPrimerCobro(trialEnd, ahora = Date.now()) {
  const fin = finPruebaMs(trialEnd);
  if (fin == null || fin < ahora) return null;
  return new Date(Math.max(fin, ahora + MIN_TRIAL_MS));
}

export function formatearFecha(d) {
  if (!d) return "";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

const ETIQUETAS = { free: "Gratis", basico: "Básico", pro: "Pro", pro_familiar: "Pro Familiar" };
const PAGOS = new Set(["basico", "pro", "pro_familiar", "advisor_pro"]);

/**
 * @returns {{
 *   clave: "free"|"basico"|"pro"|"pro_familiar"|string,
 *   etiqueta: string,      // "Pro · prueba — quedan 9 días" | "Pro" | "Gratis"…
 *   enPrueba: boolean,     // true si el acceso actual viene de la prueba
 *   diasPrueba: number,
 *   finPrueba: Date|null,  // fecha real del fin de la prueba de la app
 *   pago: boolean,         // tiene un plan de pago registrado (no prueba)
 * }}
 */
export function estadoPlan({ isAdmin = false, planGuardado, planAccount, trialEnd, ahora = Date.now() }) {
  const fin = finPruebaMs(trialEnd);
  const pruebaVigente = fin != null && fin >= ahora;
  const diasPrueba = pruebaVigente ? Math.max(1, Math.ceil((fin - ahora) / DIA_MS)) : 0;
  const quedan = diasPrueba === 1 ? "queda 1 día" : `quedan ${diasPrueba} días`;
  const base = { diasPrueba, finPrueba: fin != null ? new Date(fin) : null };

  if (isAdmin) return { ...base, clave: "pro", etiqueta: "Pro", enPrueba: false, pago: true };

  if (planAccount === "pro_familiar") {
    return {
      ...base, clave: "pro_familiar", pago: true, enPrueba: pruebaVigente,
      etiqueta: pruebaVigente ? `Pro Familiar · prueba — ${quedan}` : "Pro Familiar",
    };
  }

  const guardado = planGuardado || "free";
  if (PAGOS.has(guardado)) {
    return { ...base, clave: guardado, etiqueta: ETIQUETAS[guardado] || guardado, enPrueba: false, pago: true };
  }

  if (pruebaVigente) {
    return { ...base, clave: "pro", etiqueta: `Pro · prueba — ${quedan}`, enPrueba: true, pago: false };
  }

  return { ...base, clave: "free", etiqueta: "Gratis", enPrueba: false, pago: false };
}
