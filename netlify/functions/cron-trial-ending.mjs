// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Scheduled Function: aviso de trial por vencer
//
// Busca usuarios cuyo trial termina en exactamente 3 días y les manda el
// correo "trial_ending". Marca trialEndingEmailSent para no repetir.
//
// HISTORIA (27-sep-2026):
//   La versión original (4-may-2026) era un endpoint HTTP que debía llamar
//   Supabase pg_cron a diario. pg_cron nunca se instaló, así que en cinco
//   meses NUNCA corrió: 80 usuarios tuvieron trial y a ninguno le llegó el
//   aviso. Además, protegía el endpoint con CRON_SECRET solo "si existía" —
//   y no existía — con lo que cualquiera podía invocarlo.
//   Ahora es una función programada de Netlify: Netlify la ejecuta sola y no
//   tiene URL pública. Sin secreto que configurar, sin cron externo.
//
// SCHEDULE: diario 14:00 UTC = 9:00 COT (hora en que la gente lee correo).
//
// ENV VARS: SUPABASE_URL o VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY · RESEND_API_KEY
// LOCAL: netlify functions:invoke cron-trial-ending
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { sendTemplate } = require("./send-email.cjs");

export default async (req) => {
  let nextRun = "unknown";
  try { nextRun = (await req.json())?.next_run || "unknown"; } catch {}
  console.log(`[cron-trial-ending] iniciando · next_run=${nextRun}`);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("[cron-trial-ending] ❌ env vars faltantes (SUPABASE_URL/SUPABASE_SERVICE_KEY)");
    return;
  }

  const targetIso = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  // trialEnd existe en dos formatos en la base ("2026-10-10" y
  // "2026-10-10T20:06:36Z"); like con comodín cubre los dos.
  const queryUrl = `${supabaseUrl}/rest/v1/user_data?data->p->>trialEnd=like.${targetIso}*&data->p->>trialEndingEmailSent=is.null&select=id,email,data`;

  let users;
  try {
    const res = await fetch(queryUrl, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    if (!res.ok) {
      console.error("[cron-trial-ending] Supabase query failed:", res.status, await res.text());
      return;
    }
    users = await res.json();
  } catch (e) {
    console.error("[cron-trial-ending] exception en query:", e?.message || e);
    return;
  }
  console.log(`[cron-trial-ending] ${users.length} usuarios con trial terminando el ${targetIso}`);

  const results = { sent: 0, failed: 0, errors: [] };
  for (const user of users) {
    try {
      const r = await sendTemplate({
        to: user.email,
        template: "trial_ending",
        vars: { name: user.data?.p?.name || "", daysLeft: 3, plan: "Pro" },
      });
      if (!r.ok) {
        results.failed++;
        results.errors.push({ user: user.email, error: r.error });
        continue;
      }
      results.sent++;
      const newData = { ...user.data, p: { ...(user.data?.p || {}), trialEndingEmailSent: new Date().toISOString() } };
      await fetch(`${supabaseUrl}/rest/v1/user_data?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ data: newData }),
      });
    } catch (e) {
      results.failed++;
      results.errors.push({ user: user.email, error: String(e?.message || e) });
    }
  }
  console.log("[cron-trial-ending] resultado:", results);
};

export const config = {
  schedule: "0 14 * * *",
};
