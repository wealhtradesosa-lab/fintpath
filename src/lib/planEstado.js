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
// Reglas de la prueba (App.jsx, Planes, Mi cuenta y el servidor usan ESTAS):
//   · Cuentas nuevas: p.trialEnd = instante exacto (ISO) = registro + 14 días
//     (30 para invitados). Mismo instante que usa stripe-checkout como tope,
//     así la app y Stripe cuentan los mismos días.
//   · Cuentas viejas: p.trialEnd = "YYYY-MM-DD" (vale hasta las 00:00 UTC).
//   · Sin p.trialEnd (fila creada por el trigger handle_new_user con plan
//     "free", o datos recargados antes del primer guardado): se deriva de la
//     fecha de registro. Una cuenta vieja da una fecha pasada → sin prueba
//     retroactiva.
//   · días restantes = ceil((fin - ahora) / 1 día), igual que Stripe.
// ═══════════════════════════════════════════════════════════════════════════

const DIA_MS = 86400000;

// Stripe Checkout exige trial_end ≥ 48 h en el futuro. MISMA constante que
// netlify/functions/stripe-checkout.cjs (calcularTrialStripe). Si cambias
// una, cambia la otra.
export const MIN_TRIAL_MS = 48 * 3600 * 1000 + 10 * 60 * 1000;

// Invitados con prueba de 30 días. MISMA lista que INVITADOS_30D en
// netlify/functions/stripe-checkout.cjs.
export const INVITADOS_30D = ["andres.isaza@grupogiesas.com", "renatomaestri76@hotmail.com"];
export function diasDePrueba(email) {
  return INVITADOS_30D.includes(String(email || "").trim().toLowerCase()) ? 30 : 14;
}

// Fin de prueba para una cuenta que se crea AHORA: instante exacto, ISO.
export function nuevoFinPrueba(email, ahora = Date.now()) {
  return new Date(ahora + diasDePrueba(email) * DIA_MS).toISOString();
}

// Fin de prueba derivado de la fecha de registro (auth.users.created_at).
export function finPruebaDesdeRegistro(creadoEn, email) {
  const c = typeof creadoEn === "string" ? Date.parse(creadoEn) : NaN;
  return Number.isFinite(c) ? c + diasDePrueba(email) * DIA_MS : null;
}

// Fin de prueba que vale: el guardado; si no hay, el derivado del registro.
export function finPruebaEfectiva({ trialEnd, creadoEn, email } = {}) {
  const guardado = finPruebaMs(trialEnd);
  return guardado != null ? guardado : finPruebaDesdeRegistro(creadoEn, email);
}

export function diasRestantes(finMs, ahora = Date.now()) {
  if (finMs == null || finMs < ahora) return 0;
  return Math.max(1, Math.ceil((finMs - ahora) / DIA_MS));
}

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
// bloqueado: los datos del usuario están cifrados y este dispositivo no los
// abrió. planGuardado/trialEnd vienen entonces de lo legible SIN la clave
// (columna user_data.plan, data.p fuera del blob). Sin evidencia de plan pago
// ni de prueba, se devuelve clave "bloqueado": NUNCA "free"/"Gratis", porque
// eso sería el valor por defecto de datos que no se pudieron leer.
export function estadoPlan({ isAdmin = false, bloqueado = false, planGuardado, planAccount, trialEnd, creadoEn, email, ahora = Date.now() }) {
  const fin = finPruebaEfectiva({ trialEnd, creadoEn, email });
  const pruebaVigente = fin != null && fin >= ahora;
  const diasPrueba = diasRestantes(fin, ahora);
  const quedan = diasPrueba === 1 ? "queda 1 día" : `quedan ${diasPrueba} días`;
  const base = { diasPrueba, finPrueba: fin != null ? new Date(fin) : null };

  if (isAdmin) return { ...base, clave: "pro", etiqueta: "Pro", enPrueba: false, pago: true };

  if (planAccount === "pro_familiar") {
    return {
      ...base, clave: "pro_familiar", pago: true, enPrueba: pruebaVigente,
      etiqueta: pruebaVigente ? `Pro Familiar · prueba — ${quedan}` : "Pro Familiar",
    };
  }

  // La prueba vigente gana sobre "free" y "basico" (igual que el gating de
  // App.jsx: trialActive → "pro"). Solo un Pro/Pro Familiar/Asesor ya pagado
  // se muestra como tal durante la prueba.
  const guardado = planGuardado || "free";
  if (PAGOS.has(guardado) && guardado !== "basico") {
    return { ...base, clave: guardado, etiqueta: ETIQUETAS[guardado] || guardado, enPrueba: false, pago: true };
  }

  if (pruebaVigente) {
    return { ...base, clave: "pro", etiqueta: `Pro · prueba — ${quedan}`, enPrueba: true, pago: false };
  }

  if (guardado === "basico") {
    return { ...base, clave: "basico", etiqueta: ETIQUETAS.basico, enPrueba: false, pago: true };
  }

  if (bloqueado) {
    return { ...base, clave: "bloqueado", etiqueta: "Tu plan se muestra al ingresar tu PIN", enPrueba: false, pago: false, bloqueado: true };
  }

  return { ...base, clave: "free", etiqueta: "Gratis", enPrueba: false, pago: false };
}
