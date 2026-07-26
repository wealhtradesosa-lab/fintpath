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
async function consumirCuota({ url, serviceKey, userId }) {
  if (!userId) return { permitido: true, usos: 0, tope: 0, plan: "desconocido", motivo: "sin_usuario" };

  const h = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

  let plan = "free";
  try {
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

module.exports = { consumirCuota, mensajeCuota, TOPES, topeDe };
