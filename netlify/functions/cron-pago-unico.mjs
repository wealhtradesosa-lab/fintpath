// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Scheduled Function: aviso de vencimiento del pago único
//
// 5-nov-2026. Quien pagó con PSE/Efecty (pago único por Mercado Pago) no tiene
// cobro automático. Este cron corre a diario a las 9:30 COT y escribe a las
// cuentas cuyo plan pagado vence dentro de 4 a 5 días (ventana de 24 h, así
// cada cuenta recibe un solo correo por vencimiento). Al vencer, el cron
// expire-canceled-cron la baja a free como cualquier plan cancelado.
//
// ENV: SUPABASE_URL / VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY · RESEND_API_KEY
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "module";
import logSeguro from "../lib/logSeguro.cjs";
const { errorParaLog, uidCorto } = logSeguro;
const require = createRequire(import.meta.url);
const { sendRendered } = require("./send-email.cjs");
const { correoPagoUnico } = require("../lib/correoPagoUnico.cjs");

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.error("[cron-pago-unico] faltan SUPABASE_URL/SUPABASE_SERVICE_KEY"); return; }
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const desde = new Date(Date.now() + 4 * 864e5).toISOString();
  const hasta = new Date(Date.now() + 5 * 864e5).toISOString();
  try {
    const q = `${url}/rest/v1/accounts?select=id,owner_user_id,plan,grace_until&pago_unico=eq.true&subscription_status=eq.canceled&grace_until=gte.${encodeURIComponent(desde)}&grace_until=lt.${encodeURIComponent(hasta)}`;
    const r = await fetch(q, { headers: h });
    if (!r.ok) { console.error(`[cron-pago-unico] consulta ${r.status}: ${await r.text()}`); return; }
    const cuentas = await r.json();
    console.log(`[cron-pago-unico] ${cuentas.length} cuenta(s) vencen en 4-5 días`);
    for (const c of cuentas) {
      try {
        const ru = await fetch(`${url}/auth/v1/admin/users/${c.owner_user_id}`, { headers: h });
        const email = ru.ok ? (await ru.json()).email : null;
        if (!email) continue;
        const m = correoPagoUnico({ tipo: "por_vencer", plan: c.plan, hasta: c.grace_until });
        await sendRendered({ to: email, ...m, etiqueta: "pago_unico_por_vencer", idempotencyKey: `por_vencer_${c.id}_${String(c.grace_until).slice(0, 10)}` });
      } catch (e) { console.error(`[cron-pago-unico] cuenta ${uidCorto ? uidCorto(c.owner_user_id) : ""}`, errorParaLog(e)); }
    }
  } catch (e) { console.error("[cron-pago-unico] error", errorParaLog(e)); }
};

export const config = { schedule: "30 14 * * *" };
