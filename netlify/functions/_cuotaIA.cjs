/**
 * cuotaIA — Tope de operaciones con IA por plan y por mes.
 *
 * 26-jul-2026 (Santiago: "que sí tenga cierto límite, no sea que usen esto
 * para otra cosa").
 *
 * POR QUÉ EXISTE: cada lectura de factura, extracto o declaración con IA
 * consume la clave de Anthropic de FINPATHIA — es un costo directo por
 * llamada. Hasta hoy no había ningún tope real: el control que existía en
 * ai-chat vivía EN MEMORIA de la función y se reiniciaba en cada arranque en
 * frío, así que cualquier usuario registrado podía hacer llamadas ilimitadas.
 *
 * El contador vive en Supabase (tabla ai_usage) y se incrementa de forma
 * atómica desde el servidor. En localStorage o en los datos del usuario sería
 * trivial de manipular, y un límite que el limitado puede editar no es un
 * límite.
 */

// Operaciones con IA por mes calendario.
// Ajustables: son un punto de partida conservador, no una verdad.
// Calibrados sobre el costo real: una lectura con Haiku ronda USD 0,01-0,03
// según el tamaño del documento. Los topes dejan margen en cada plan:
//   free          10 → ~$0,30 de costo · es adquisición, se pierde a propósito
//   basico  $8 →  30 → ~$0,90 · margen ~$7
//   pro    $16 → 150 → ~$4,50 · margen ~$11
//   familiar $27→ 400 → ~$12   · margen ~$15
// Son un punto de partida conservador. Si el consumo real se queda corto,
// subirlos es una línea; bajarlos después de prometerlos, no.
const TOPES = {
  free: 10,
  basico: 30,
  pro: 150,
  pro_familiar: 400,
  advisor_pro: 400,
};

const topeDe = (plan) => TOPES[plan] ?? TOPES.free;

/**
 * Verifica y consume una unidad de cuota.
 * Devuelve { permitido, usos, tope, plan }.
 *
 * Si algo falla al consultar Supabase se PERMITE la operación: es preferible
 * que una caída de la base no bloquee a un usuario legítimo que ya pagó. El
 * riesgo de abuso durante una caída es menor que el de romper el producto.
 */
async function consumirCuota({ url, serviceKey, userId, plan: planDado }) {
  if (!userId) return { permitido: true, usos: 0, tope: 0, plan: "desconocido", motivo: "sin_usuario" };

  const h = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

  // 11-oct-2026: quien llama puede pasar el plan ya resuelto (ai-chat lo
  // resuelve con la prueba de 14 días incluida, ver leerPlanIA).
  let plan = planDado || "free";
  if (!planDado) try {
    const r = await fetch(`${url}/rest/v1/accounts?select=plan&owner_user_id=eq.${userId}`, { headers: h });
    if (r.ok) {
      const filas = await r.json();
      if (filas?.[0]?.plan) plan = filas[0].plan;
    }
  } catch { /* queda en free, el tope más restrictivo */ }

  const tope = topeDe(plan);

  try {
    const r = await fetch(`${url}/rest/v1/rpc/incrementar_uso_ia`, {
      method: "POST", headers: h, body: JSON.stringify({ p_user_id: userId }),
    });
    if (!r.ok) return { permitido: true, usos: 0, tope, plan, motivo: "rpc_fallo" };
    const usos = await r.json();
    return { permitido: usos <= tope, usos, tope, plan };
  } catch {
    return { permitido: true, usos: 0, tope, plan, motivo: "excepcion" };
  }
}

/**
 * 11-oct-2026 — Plan que cuenta para la cuota, con la prueba incluida.
 * Durante la prueba de 14 días accounts.plan sigue en "free" y la app da
 * acceso Pro con user_data.p.trialEnd. Sin esto, quien está probando el
 * Asesor IA tendría el tope de free (10 al mes) justo en la prueba.
 * Función pura: `hoy` es la fecha 'YYYY-MM-DD' en Colombia.
 */
function planEfectivo({ planCuenta, trialEnd, hoy }) {
  const plan = planCuenta || "free";
  const enPrueba = typeof trialEnd === "string" && /^\d{4}-\d{2}-\d{2}/.test(trialEnd) && trialEnd.slice(0, 10) >= hoy;
  if (enPrueba && (plan === "free" || plan === "basico")) return "pro";
  return plan;
}

const hoyColombia = (ahora = Date.now()) => new Date(ahora - 5 * 3600000).toISOString().slice(0, 10);

/** Lee accounts.plan y user_data.p.trialEnd y devuelve el plan efectivo. */
async function leerPlanIA({ url, serviceKey, userId }) {
  const h = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  let planCuenta = "free", trialEnd = null;
  try {
    const [ra, ru] = await Promise.all([
      fetch(`${url}/rest/v1/accounts?select=plan&owner_user_id=eq.${userId}`, { headers: h }),
      fetch(`${url}/rest/v1/user_data?select=trial_end:data->p->>trialEnd&id=eq.${userId}`, { headers: h }),
    ]);
    if (ra.ok) { const f = await ra.json(); if (f?.[0]?.plan) planCuenta = f[0].plan; }
    if (ru.ok) { const f = await ru.json(); trialEnd = f?.[0]?.trial_end || null; }
  } catch { /* queda en free, el tope más restrictivo */ }
  return planEfectivo({ planCuenta, trialEnd, hoy: hoyColombia() });
}

/** Usos del mes sin consumir (para mostrar el contador al abrir el asesor). */
async function consultarUsos({ url, serviceKey, userId }) {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/consultar_uso_ia`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!r.ok) return null;
    const usos = await r.json();
    return Number(usos) || 0;
  } catch {
    return null;
  }
}

/** Mensaje para el usuario cuando se agotó la cuota. */
function mensajeCuota({ usos, tope, plan }) {
  const enPago = plan !== "free";
  return {
    error: "cuota_ia_agotada",
    mensaje: `Llegaste al tope de ${tope} lecturas con IA de este mes (llevás ${usos}).` +
      (enPago
        ? " Se renueva el primer día del mes. Si necesitás más, escribinos a soporte@finpathia.com."
        : " Se renueva el primer día del mes, o podés mejorar tu plan para tener más."),
    usos, tope, plan,
  };
}

module.exports = { consumirCuota, mensajeCuota, TOPES, topeDe, planEfectivo, hoyColombia, leerPlanIA, consultarUsos };
