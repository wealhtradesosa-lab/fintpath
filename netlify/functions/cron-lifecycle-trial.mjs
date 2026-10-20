// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Scheduled Function: secuencia de correos de la prueba Pro
//
// Corre a diario 14:00 UTC = 9:00 COT. Para cada cuenta en plan free con
// trial_end, decide (netlify/lib/lifecycle/pasos.mjs) si HOY le toca d2, d5,
// d10, d13 o d16 y lo manda por Resend con enlace de baja y cabeceras
// List-Unsubscribe.
//
// SEGURIDAD — MODO PRUEBA POR DEFECTO:
//   Si LIFECYCLE_EMAILS_ENABLED !== "true" es un DRY RUN: no envía nada y no
//   marca nada en accounts. Solo deja en el log y en lifecycle_email_sends
//   (dry_run=true, máximo una fila por persona y correo) lo que habría
//   mandado. Esas filas NO cuentan como enviadas: al prender la bandera nadie
//   queda saltado.
//   Si la bandera está prendida pero falta EMAIL_UNSUB_SECRET, no envía
//   (falla cerrado) y corre en modo prueba.
//
// ESCRITURAS: solo columnas de ciclo de vida de accounts (seq_sent,
// last_seq_email, seq_variant) y la tabla lifecycle_email_sends. Nunca el
// blob user_data.data.
//
// ENV: SUPABASE_URL / VITE_SUPABASE_URL · SUPABASE_SERVICE_KEY ·
//      LIFECYCLE_EMAILS_ENABLED · EMAIL_UNSUB_SECRET · RESEND_API_KEY
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from "module";
import { correrSecuencia } from "../lib/lifecycle/secuencia.mjs";
const require = createRequire(import.meta.url);
const { sendRendered } = require("./send-email.cjs");

export default async () => {
  try { await correrSecuencia({ enviar: sendRendered }); }
  catch (e) { console.error("[lifecycle] ❌ error inesperado:", e?.message || e); }
};

export const config = { schedule: "0 14 * * *" };
