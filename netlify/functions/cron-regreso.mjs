// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Scheduled Function: correos de regreso tras un plan vencido
//
// 5-nov-2026 (Santiago: proceso para cuando dejan de pagar). Cuando un plan
// pagado vence (accounts.subscription_status = 'expired'), la cuenta queda en
// modo consulta con sus datos. Este cron escribe a los 3, 15 y 45 días del
// vencimiento (grace_until) para invitar a renovar. Uno por día y por paso
// (el día se calcula con piso, así cada paso cae en una sola corrida).
// Respeta la baja de correos (accounts.email_unsubscribed_at) y lleva enlace
// de baja de un toque.
//
// Corre a diario 15:00 UTC = 10:00 COT.
// ENV: SUPABASE_URL / VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY · RESEND_API_KEY ·
//      EMAIL_UNSUB_SECRET (sin él no envía: falla cerrado)
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "module";
import logSeguro from "../lib/logSeguro.cjs";
import { firmarTokenBaja } from "../lib/lifecycle/tokenBaja.mjs";
import { conteosDesdeBlob } from "../lib/lifecycle/pasos.mjs";
const { errorParaLog, uidCorto } = logSeguro;
const require = createRequire(import.meta.url);
const { sendRendered, emailShell } = require("./send-email.cjs");

const PASOS = [3, 15, 45];
const P = (t) => `<p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">${t}</p>`;
const H = (t) => `<h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 16px;color:#fafafa;letter-spacing:-0.5px;">${t}</h1>`;
const B = (t) => `<strong style="color:#fafafa;">${t}</strong>`;

export function correoRegreso(dia, { nombre = "", conteos = null, urlBaja }) {
  const hola = nombre ? `${nombre.split(" ")[0]}, ` : "";
  const url = `https://finpathia.com/?ir=price&utm_source=email&utm_medium=lifecycle&utm_campaign=fp_regreso_d${dia}`;
  const pie = `<p style="font-size:12px;color:#71717a;line-height:1.6;margin:24px 0 0;">¿No quieres más correos como este? <a href="${urlBaja}" style="color:#a1a1aa;">Darme de baja</a>.</p>`;
  let subject, cuerpo, pre;
  if (dia === 3) {
    subject = "Tus datos siguen en FINPATHIA";
    pre = "Todo lo que cargaste está guardado. Renueva y sigue donde ibas.";
    cuerpo = H(`${hola}tus datos siguen aquí`) +
      P(`Tu plan Pro venció hace unos días, pero no perdiste nada: todo lo que cargaste sigue guardado y puedes verlo cuando quieras.`) +
      P(`Para volver a editar, simular tu futuro y usar el Asesor IA, renueva con ${B("PSE, tarjeta o Efecty")}. Un mes por $24.900 o el año por $249.000 (te ahorras $49.800).`);
  } else if (dia === 15) {
    const n = conteos ? conteos.n + conteos.m : 0;
    subject = n > 0 ? `Tus ${n} registros te esperan en FINPATHIA` : "Tu plan financiero te espera";
    pre = "Retoma tu plan donde lo dejaste, sin volver a cargar nada.";
    cuerpo = H("Retoma tu plan donde lo dejaste") +
      P(n > 0 ? `Tienes ${B(`${n} registros`)} entre patrimonio, ingresos, gastos y deudas. Armar eso de nuevo toma horas; en FINPATHIA ya está listo.` : `Lo que cargaste sigue listo para que retomes tu plan.`) +
      P(`Renueva y vuelve a ver cómo avanza tu patrimonio, tu nivel de libertad y lo que puedes optimizar en impuestos.`);
  } else {
    subject = "Último recordatorio de FINPATHIA";
    pre = "Tu cuenta sigue guardada. El plan anual te ahorra dos meses.";
    cuerpo = H("Tu cuenta sigue guardada") +
      P(`Este es nuestro último recordatorio. Tus datos siguen en tu cuenta, en modo consulta, y puedes descargarlos cuando quieras desde Mi cuenta.`) +
      P(`Si quieres volver a usarlo todo, el ${B("plan anual por $249.000")} es la forma más conveniente: un solo pago con PSE, tarjeta o Efecty, y te olvidas por 12 meses.`);
  }
  return { subject, html: emailShell(cuerpo + pie, { ctaText: "Renovar mi plan", ctaUrl: url, preheader: pre }) };
}

export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const secreto = process.env.EMAIL_UNSUB_SECRET;
  if (!url || !key || !secreto) { console.error("[cron-regreso] faltan SUPABASE_URL/SUPABASE_SERVICE_KEY/EMAIL_UNSUB_SECRET: no envía"); return; }
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const ahora = Date.now();
  const desde = new Date(ahora - 46 * 864e5).toISOString();
  const hasta = new Date(ahora - 2 * 864e5).toISOString();
  try {
    const q = `${url}/rest/v1/accounts?select=id,owner_user_id,grace_until&subscription_status=eq.expired&email_unsubscribed_at=is.null&grace_until=gte.${encodeURIComponent(desde)}&grace_until=lt.${encodeURIComponent(hasta)}`;
    const r = await fetch(q, { headers: h });
    if (!r.ok) { console.error(`[cron-regreso] consulta ${r.status}: ${await r.text()}`); return; }
    const cuentas = await r.json();
    let enviados = 0;
    for (const c of cuentas) {
      const dia = Math.floor((ahora - new Date(c.grace_until).getTime()) / 864e5);
      if (!PASOS.includes(dia)) continue;
      try {
        const ru = await fetch(`${url}/auth/v1/admin/users/${c.owner_user_id}`, { headers: h });
        const usr = ru.ok ? await ru.json() : null;
        if (!usr?.email) continue;
        let conteos = null, nombre = usr.user_metadata?.name || "";
        if (dia === 15) {
          const rd = await fetch(`${url}/rest/v1/user_data?id=eq.${c.owner_user_id}&select=data`, { headers: h });
          const blob = rd.ok ? (await rd.json())[0]?.data : null;
          conteos = conteosDesdeBlob(blob);
          if (!nombre && blob && !blob._encrypted) nombre = blob.p?.name || "";
        }
        const urlBaja = `https://finpathia.com/api/email-unsubscribe?t=${encodeURIComponent(firmarTokenBaja(c.id, secreto))}`;
        const m = correoRegreso(dia, { nombre, conteos, urlBaja });
        await sendRendered({
          to: usr.email, ...m, etiqueta: `regreso_d${dia}`,
          idempotencyKey: `regreso_${c.id}_d${dia}_${String(c.grace_until).slice(0, 10)}`,
          headers: { "List-Unsubscribe": `<${urlBaja}>, <mailto:soporte@finpathia.com?subject=baja>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        enviados += 1;
      } catch (e) { console.error(`[cron-regreso] cuenta ${uidCorto(c.owner_user_id)}`, errorParaLog(e)); }
    }
    console.log(`[cron-regreso] ${cuentas.length} vencidas en ventana · ${enviados} correo(s)`);
  } catch (e) { console.error("[cron-regreso] error", errorParaLog(e)); }
};

export const config = { schedule: "0 15 * * *" };
