// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · cron-trial-ending.js — Sesión 4-may-2026
//
// Endpoint que busca usuarios con trial terminando en exactamente 3 días
// y les envía email de aviso. Se invoca diariamente desde Supabase pg_cron
// (configurado por separado vía Supabase Dashboard).
//
// LÓGICA:
//   1. Query a Supabase: SELECT users con trial_end = today + 3 días
//   2. Por cada user, llamar a /send-email con template "trial_ending"
//   3. Marcar el user con flag `trial_ending_email_sent` para no duplicar
//
// SEGURIDAD:
//   Este endpoint solo debe llamarse desde el cron interno. Validamos un
//   shared secret (CRON_SECRET) para que no lo invoquen externamente.
//
// CRON SETUP (Supabase pg_cron):
//   SELECT cron.schedule(
//     'send-trial-ending-emails',
//     '0 14 * * *',  -- todos los días a las 14:00 UTC = 9:00 COT
//     $$ SELECT net.http_post(
//       url := 'https://finpathia.com/.netlify/functions/cron-trial-ending',
//       headers := jsonb_build_object('x-cron-secret', 'SECRET_AQUI')
//     ) $$
//   );
//
// MANUAL TEST (sin cron):
//   curl -X POST https://finpathia.com/.netlify/functions/cron-trial-ending \
//     -H "x-cron-secret: SECRET"
// ═══════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "Method not allowed" }) };

  // Validar shared secret para evitar abuso
  const secret = event.headers["x-cron-secret"] || event.headers["X-Cron-Secret"];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Supabase config missing" }) };
    }

    // Calcular fecha exacta: hoy + 3 días en formato YYYY-MM-DD
    const targetDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const targetIso = targetDate.toISOString().split("T")[0];

    // user_data.data es JSONB con shape { p: { trialEnd: "YYYY-MM-DD", trialEndingEmailSent: "ISO" } }
    // PostgREST permite filtrar por path JSONB usando data->p->>trialEnd=eq.X
    // Buscamos users con trialEnd == target Y que NO tengan trialEndingEmailSent
    const queryUrl = `${supabaseUrl}/rest/v1/user_data?data->p->>trialEnd=eq.${targetIso}&data->p->>trialEndingEmailSent=is.null&select=id,email,data`;
    const supaRes = await fetch(queryUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });

    if (!supaRes.ok) {
      const errBody = await supaRes.text();
      console.error("[cron-trial-ending] Supabase query failed:", supaRes.status, errBody);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Supabase query failed" }) };
    }

    const users = await supaRes.json();
    console.log(`[cron-trial-ending] ${users.length} users con trial terminando en 3 días`);

    const emailHost = process.env.URL || process.env.DEPLOY_URL || "https://finpathia.com";
    const results = { sent: 0, failed: 0, errors: [] };

    for (const user of users) {
      try {
        const userName = user.data?.p?.name || "";
        // Enviar email
        const emailRes = await fetch(`${emailHost}/.netlify/functions/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.email,
            template: "trial_ending",
            vars: {
              name: userName,
              daysLeft: 3,
              plan: "Pro",
            },
          }),
        });

        if (emailRes.ok) {
          results.sent++;

          // Marcar user.data.p.trialEndingEmailSent (idempotencia)
          // PATCH con jsonb_set: data = jsonb_set(data, '{p,trialEndingEmailSent}', '"ISO"')
          // Como PostgREST no soporta jsonb_set directo, hacemos merge manual:
          const newData = { ...user.data, p: { ...(user.data?.p || {}), trialEndingEmailSent: new Date().toISOString() } };
          await fetch(`${supabaseUrl}/rest/v1/user_data?id=eq.${user.id}`, {
            method: "PATCH",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({ data: newData }),
          });
        } else {
          results.failed++;
          const err = await emailRes.text();
          results.errors.push({ user: user.email, error: err });
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ user: user.email, error: String(e?.message || e) });
      }
    }

    console.log("[cron-trial-ending] resultado:", results);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, ...results }) };
  } catch (e) {
    console.error("[cron-trial-ending] exception:", e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};
