// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Scheduled Function: Expire Canceled Accounts
//
// PROPÓSITO:
//   Cron job diario que llama a la RPC expire_canceled_accounts() en Supabase.
//   Esa RPC hace el downgrade real a free de cuentas pro_familiar que fueron
//   canceladas via Stripe y cuyo grace_until ya pasó.
//
// FLUJO:
//   1. Stripe envía customer.subscription.deleted al webhook (ya implementado)
//   2. Webhook llama handle_subscription_canceled() que marca account como
//      'canceled' con grace_until = NOW() + 30 días
//   3. El user mantiene acceso completo durante esos 30 días
//   4. ESTE CRON corre diariamente y, para accounts cuyo grace_until < NOW(),
//      llama a expire_canceled_accounts() que las downgrade a free
//
// SCHEDULE:
//   Diario a las 6:00 AM UTC (= 1:00 AM Bogotá COT, hora baja tráfico).
//   La RPC es idempotente y rápida (UPDATE con índice en grace_until), no hay
//   riesgo de race conditions ni de procesar 2 veces la misma cuenta.
//
// IDEMPOTENCIA:
//   La RPC SQL filtra por subscription_status='canceled' AND grace_until<NOW().
//   Si una cuenta ya fue expired (status='expired'), no entra en el filtro.
//   Si el cron corre 2 veces en el mismo minuto, la segunda corrida no hace
//   nada porque las cuentas ya fueron downgradeadas en la primera.
//
// ENV VARS:
//   SUPABASE_URL o VITE_SUPABASE_URL  (project URL)
//   SUPABASE_SERVICE_KEY              (service_role key, NO anon)
//
// LOCAL TESTING:
//   netlify functions:invoke expire-canceled-cron
//   (no corre en deploy previews ni branch deploys, solo en producción)
// ═══════════════════════════════════════════════════════════════════════════

export default async (req) => {
  const startedAt = new Date();
  let nextRun = "unknown";
  try {
    const body = await req.json();
    nextRun = body?.next_run || "unknown";
  } catch {
    // body parsing puede fallar en tests locales con CLI — ignoramos
  }

  console.log(`[expire-canceled-cron] iniciando · next_run=${nextRun} · ts=${startedAt.toISOString()}`);

  // Verificación de env vars críticas
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[expire-canceled-cron] ❌ env vars faltantes (SUPABASE_URL/SUPABASE_SERVICE_KEY)");
    return; // scheduled functions no devuelven body, solo loggean
  }

  try {
    // Llamar a la RPC. Retorna TABLE (account_id, owner_user_id, action) con
    // las cuentas que fueron expiradas en esta corrida.
    const url = `${supabaseUrl}/rest/v1/rpc/expire_canceled_accounts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[expire-canceled-cron] ❌ RPC failed (${res.status}): ${text}`);
      return;
    }

    const result = await res.json();
    const expired = Array.isArray(result) ? result : [];

    if (expired.length === 0) {
      console.log("[expire-canceled-cron] ✓ ninguna cuenta para expirar hoy");
    } else {
      console.log(`[expire-canceled-cron] ✓ ${expired.length} cuenta(s) downgradeadas a free:`);
      for (const row of expired) {
        console.log(`  · account_id=${row.account_id} owner=${row.owner_user_id} action=${row.action}`);
      }
    }

    const elapsed = Date.now() - startedAt.getTime();
    console.log(`[expire-canceled-cron] completado en ${elapsed}ms`);
  } catch (err) {
    console.error("[expire-canceled-cron] ❌ error inesperado:", err.message || err);
    // NO re-throw: scheduled functions no tienen retry automático y queremos
    // que la siguiente ejecución (24h después) intente de nuevo limpiamente.
  }
};

// Schedule: diario a las 6:00 AM UTC = 1:00 AM Bogotá (UTC-5)
// Hora elegida por baja carga del servidor y nadie usando la app a esa hora.
export const config = {
  schedule: "0 6 * * *",
};
