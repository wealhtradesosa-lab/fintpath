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
//   pro    $14 → 150 → ~$4,50 · margen ~$9,50 (era $16 hasta 25-oct-2026)
//   familiar $27→ 400 → ~$12   · margen ~$15
// Son un punto de partida conservador. Si el consumo real se queda corto,
// subirlos es una línea; bajarlos después de prometerlos, no.
// 5-nov-2026 (Santiago: "me da miedo lo de los agentes de IA porque pueden
// usarlo sin haber pagado"). Ya no hay plan gratis a la venta:
//   free   → 0: sin pago y sin prueba (prueba vencida, plan vencido) no hay IA.
//   prueba → 20: la prueba de 14 días deja probar el Asesor IA y leer un Excel,
//            con un tope chico (~USD 0,60 de costo máximo por persona). Al pagar
//            sube a 150 al mes.
const TOPES = {
  free: 0,
  prueba: 20,
  basico: 30,
  pro: 150,
  pro_familiar: 400,
  advisor_pro: 400,
};

const topeDe = (plan) => TOPES[plan] ?? TOPES.free;

// 11-oct-2026 (#35, rehecho 2-nov) — El mes de la cuota se corta en hora de
// Colombia. incrementar_uso_ia y consultar_uso_ia calculan el periodo con
// to_char(now(), 'YYYY-MM') en la zona de la sesión (UTC en Supabase): el mes
// nuevo empezaba el último día del mes a las 7:00 p. m. hora Colombia.
// PostgREST (v12+) acepta "Prefer: timezone=…" solo para esa petición, sin
// migración. Si una versión vieja no la reconoce, la ignora y sigue en UTC.
const PREFER_MES_COLOMBIA = { Prefer: "timezone=America/Bogota" };

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

  // Quien llama puede pasar el plan ya resuelto (ai-chat lo resuelve con la
  // prueba de 14 días incluida, ver leerPlanIA).
  // 5-nov-2026: sin plan dado se resuelve con la prueba incluida (leerPlanIA). Antes leía
  // solo accounts.plan: con free en 0, quien está en la prueba no podría leer su Excel.
  let plan = planDado || "free";
  if (!planDado) plan = await leerPlanIA({ url, serviceKey, userId });

  const tope = topeDe(plan);

  try {
    const r = await fetch(`${url}/rest/v1/rpc/incrementar_uso_ia`, {
      method: "POST", headers: { ...h, ...PREFER_MES_COLOMBIA }, body: JSON.stringify({ p_user_id: userId }),
    });
    if (!r.ok) return { permitido: true, usos: 0, tope, plan, motivo: "rpc_fallo" };
    const usos = await r.json();
    return { permitido: usos <= tope, usos, tope, plan };
  } catch {
    return { permitido: true, usos: 0, tope, plan, motivo: "excepcion" };
  }
}

/**
 * Plan que cuenta para la cuota del asesor, con la prueba incluida. Durante la
 * prueba de 14 días accounts.plan sigue en "free" y la app da acceso Pro: sin
 * esto, quien prueba el Asesor IA tendría el tope de free (10 al mes) justo en
 * la prueba. Función pura: `hoy` es 'YYYY-MM-DD' en Colombia.
 */
function planEfectivo({ planCuenta, trialEnd, hoy }) {
  const plan = planCuenta || "free";
  const enPrueba = typeof trialEnd === "string" && /^\d{4}-\d{2}-\d{2}/.test(trialEnd) && trialEnd.slice(0, 10) >= hoy;
  if (enPrueba && (plan === "free" || plan === "basico")) return "prueba";
  return plan;
}

const hoyColombia = (ahora = Date.now()) => new Date(ahora - 5 * 3600000).toISOString().slice(0, 10);

/**
 * Lee accounts.plan y la fecha de fin de prueba y devuelve el plan efectivo.
 * La prueba sale de accounts.trial_end (la fija auth-signup en el servidor
 * desde el 11-oct); si está vacía, de user_data.p.trialEnd (cuentas viejas).
 */
async function leerPlanIA({ url, serviceKey, userId }) {
  const h = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  let planCuenta = "free", trialEnd = null;
  try {
    const [ra, ru] = await Promise.all([
      fetch(`${url}/rest/v1/accounts?select=plan,trial_end&owner_user_id=eq.${userId}`, { headers: h }),
      fetch(`${url}/rest/v1/user_data?select=trial_end:data->p->>trialEnd&id=eq.${userId}`, { headers: h }),
    ]);
    if (ra.ok) { const f = await ra.json(); if (f?.[0]?.plan) planCuenta = f[0].plan; if (f?.[0]?.trial_end) trialEnd = String(f[0].trial_end); }
    else {
      // Sin la columna trial_end (base sin migrar) PostgREST responde 400:
      // se vuelve a leer solo el plan para no bajar a free a quien ya paga.
      const r2 = await fetch(`${url}/rest/v1/accounts?select=plan&owner_user_id=eq.${userId}`, { headers: h });
      if (r2.ok) { const f = await r2.json(); if (f?.[0]?.plan) planCuenta = f[0].plan; }
    }
    if (!trialEnd && ru.ok) { const f = await ru.json(); trialEnd = f?.[0]?.trial_end || null; }
  } catch { /* queda en free, el tope más restrictivo */ }
  return planEfectivo({ planCuenta, trialEnd, hoy: hoyColombia() });
}

/** Usos del mes sin consumir (para mostrar el contador al abrir el asesor). */
async function consultarUsos({ url, serviceKey, userId }) {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/consultar_uso_ia`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", ...PREFER_MES_COLOMBIA },
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!r.ok) return null;
    return Number(await r.json()) || 0;
  } catch {
    return null;
  }
}

/** Mensaje para el usuario cuando se agotó la cuota.
 *  `concepto` nombra lo que se consumió: por defecto "lecturas con IA" (lectura
 *  de documentos e imágenes), y el chat del asesor pasa el suyo. 26-oct-2026. */
function mensajeCuota({ usos, tope, plan }, concepto = "lecturas con IA") {
  const enPago = plan !== "free" && plan !== "prueba";
  if (plan === "free") return { error: "cuota_ia_agotada", mensaje: "La IA está incluida en el plan Pro. Suscríbete para usarla.", usos, tope, plan };
  if (plan === "prueba") return { error: "cuota_ia_agotada", mensaje: `Usaste las ${tope} consultas con IA de tu prueba gratis. Suscríbete al Pro y tienes 150 al mes.`, usos, tope, plan };
  return {
    error: "cuota_ia_agotada",
    mensaje: `Llegaste al tope de ${tope} ${concepto} de este mes (llevas ${usos}).` +
      (enPago
        ? " Se renueva el primer día del mes. Si necesitas más, escríbenos a soporte@finpathia.com."
        : " Se renueva el primer día del mes, o puedes mejorar tu plan para tener más."),
    usos, tope, plan,
  };
}

module.exports = { consumirCuota, mensajeCuota, TOPES, topeDe, PREFER_MES_COLOMBIA, planEfectivo, hoyColombia, leerPlanIA, consultarUsos };
