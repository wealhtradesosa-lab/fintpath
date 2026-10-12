// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Secuencia de prueba Pro (14 días) — lógica PURA
//
// Este módulo no toca red ni base: recibe una cuenta y una fecha y decide
// qué correo le toca HOY. Así se puede probar con vitest sin mocks
// (tests/unit/lifecycle-pasos.test.js).
//
// CALENDARIO (contado desde el inicio de la prueba = trial_end − 14 días):
//   día 2  → d2   (variante por activated_at)          · faltan 12 días
//   día 5  → d5   (una sola versión)                     · faltan 9
//   día 10 → d10  (una sola versión)                     · faltan 4
//   día 13 → d13  (urgencia | valor, 50/50 al azar)    · falta 1
//   día 16 → d16  (2 días después de vencer)           · −2
//
// REGLAS:
//   · Solo se manda el paso cuyo día es EXACTAMENTE hoy. Nunca se ponen al
//     día pasos atrasados: quien empezó la prueba antes del lanzamiento solo
//     recibe los pasos que le quedan por delante.
//   · Un paso por persona y por corrida (como mucho uno por día).
//   · Se salta a quien se dio de baja, a quien paga y a quien ya recibió
//     ese paso (seq_sent). Los envíos en modo prueba (dry run) NO cuentan
//     como enviados: no se guardan en seq_sent.
// ═══════════════════════════════════════════════════════════════════════════

export const DURACION_PRUEBA = 14;

// Día del paso (desde el inicio de la prueba). Orden = orden de la secuencia.
export const PASOS = [
  { paso: "d2", dia: 2 },
  { paso: "d5", dia: 5 },
  { paso: "d10", dia: 10 },
  { paso: "d13", dia: 13 },
  { paso: "d16", dia: 16 },
];

const MS_DIA = 86400000;

/** "YYYY-MM-DD" (o ISO completo) → número de día UTC. null si no es fecha. */
export function diaUTC(fecha) {
  if (!fecha) return null;
  const s = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isNaN(t) ? null : Math.round(t / MS_DIA);
}

/** Fecha de hoy "YYYY-MM-DD" en Colombia (UTC−5, sin horario de verano). */
export function hoyCOT(ahora = new Date()) {
  return new Date(ahora.getTime() - 5 * 3600000).toISOString().slice(0, 10);
}

/** Días que le quedan a la prueba (0 = vence hoy, negativo = ya venció). */
export function diasRestantes(trialEnd, hoy) {
  const a = diaUTC(trialEnd), b = diaUTC(hoy);
  if (a == null || b == null) return null;
  return a - b;
}

// Planes que NO son pago. accounts.subscription_status vale 'active' por
// defecto aun en free, así que el estado solo no sirve para saber si paga:
// lo que manda es el plan.
const PLANES_GRATIS = new Set(["free", "", null, undefined]);

/**
 * ¿Esta persona ya paga (o tiene una suscripción de Stripe viva)?
 * - accounts.plan distinto de free (pro, basico, pro_familiar…), o
 * - user_data.plan distinto de free (planes legacy), o
 * - subscription_status 'trialing' / 'past_due' en una cuenta con plan.
 */
export function estaPagando({ plan, planUsuario }) {
  if (!PLANES_GRATIS.has(plan)) return true;
  if (!PLANES_GRATIS.has(planUsuario)) return true;
  return false;
}

/** Variante d13 al azar 50/50. `rnd` inyectable para tests. */
export function sortearVarianteD13(rnd = Math.random) {
  return rnd() < 0.5 ? "urgencia" : "valor";
}

/**
 * Decide el correo de hoy para una cuenta.
 *
 * cuenta = {
 *   trial_end, activated_at, advisor_first_used_at, seq_sent, seq_variant,
 *   email_unsubscribed_at, plan, planUsuario, email
 * }
 * Devuelve { enviar:true, paso, clave, utmContent, varianteD13, diasRestantes }
 *       o  { enviar:false, motivo }.
 */
export function elegirPaso(cuenta, hoy, { rnd = Math.random } = {}) {
  if (!cuenta) return { enviar: false, motivo: "sin_cuenta" };
  if (cuenta.email_unsubscribed_at) return { enviar: false, motivo: "dado_de_baja" };
  if (estaPagando(cuenta)) return { enviar: false, motivo: "pagando" };
  if (!cuenta.email) return { enviar: false, motivo: "sin_email" };

  const restantes = diasRestantes(cuenta.trial_end, hoy);
  if (restantes == null) return { enviar: false, motivo: "sin_trial_end" };
  const diaPrueba = DURACION_PRUEBA - restantes;

  const def = PASOS.find((p) => p.dia === diaPrueba);
  if (!def) return { enviar: false, motivo: "ningun_paso_hoy" };

  const enviados = (cuenta.seq_sent && typeof cuenta.seq_sent === "object") ? cuenta.seq_sent : {};
  if (enviados[def.paso]) return { enviar: false, motivo: "paso_ya_enviado" };

  let clave, utmContent, varianteD13 = null;
  switch (def.paso) {
    case "d2":
      clave = cuenta.activated_at ? "d2_activado" : "d2_sin_activar";
      utmContent = clave;
      break;
    case "d5":
      // Una sola versión desde la v2 del copy (ya no se divide por advisor_used).
      clave = "d5";
      utmContent = "d5";
      break;
    case "d10":
      clave = "d10";
      utmContent = "d10";
      break;
    case "d13":
      varianteD13 = cuenta.seq_variant === "urgencia" || cuenta.seq_variant === "valor"
        ? cuenta.seq_variant
        : sortearVarianteD13(rnd);
      clave = `d13_${varianteD13}`;
      utmContent = varianteD13;
      break;
    case "d16":
      clave = "d16";
      utmContent = "d16";
      break;
  }
  return { enviar: true, paso: def.paso, clave, utmContent, varianteD13, diasRestantes: restantes };
}

/**
 * Conteos para la variante "valor" del d13. NUNCA montos.
 * n = registros de ingresos + egresos + deudas; m = activos (Patrimonio).
 * Devuelve null si el blob no se puede leer (cifrado o sin datos).
 */
export function conteosDesdeBlob(data) {
  if (!data || typeof data !== "object" || data._encrypted) return null;
  const arr = (v) => (Array.isArray(v) ? v : []);
  let egresos = 0;
  if (data.gas && typeof data.gas === "object" && !Array.isArray(data.gas)) {
    for (const k of Object.keys(data.gas)) egresos += arr(data.gas[k]).length;
  } else {
    egresos = arr(data.gas).length;
  }
  const n = arr(data.ingresos).length + egresos + arr(data.deu).length;
  const m = arr(data.inv).length;
  return { n, m };
}

/** Enmascara un correo para logs: "lu***@gmail.com". */
export function enmascararEmail(email) {
  const [u, d] = String(email || "").split("@");
  if (!d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}
