// ═══════════════════════════════════════════════════════════════════
// FAMILY INVITE EMAIL — Netlify Function (Fase 3 commit 4)
//
// Envía el email de invitación a un miembro de Pro Familiar después de
// que el admin creó la invitación vía RPC `create_invitation`. La RPC
// devuelve el `invitation_url`; esta función envuelve ese link en un
// email HTML decente y lo manda al invitado vía Resend.
//
// DISEÑO DEFENSIVO — FALLBACK GRACEFUL:
//   Si RESEND_API_KEY NO está configurada en Netlify, la función
//   responde 200 con `{ ok: true, sent: false, reason: "resend_not_configured" }`.
//   La UI ya muestra el link copyable (flujo manual actual: el admin lo
//   manda por WhatsApp/email). El email automático es una mejora UX, no
//   un bloqueador. Esto permite mergear sin tener que configurar Resend
//   primero — el admin puede activar el envío automático cuando tenga
//   la API key lista.
//
// PAYLOAD ESPERADO (POST JSON):
//   {
//     email: string                  -- destinatario (de invitation result)
//     invitation_url: string         -- link completo a /invite/:token
//     role: "admin" | "reader"
//     account_name: string           -- nombre de la cuenta familiar
//     invited_by_name: string        -- quién invita (para personalizar el email)
//     expires_at?: string            -- ISO timestamp opcional
//   }
//
// RESPUESTA:
//   { ok: true, sent: true,  message_id: string }  ← email enviado
//   { ok: true, sent: false, reason: "resend_not_configured" }  ← fallback
//   { ok: false, error: string, status: number }   ← error real
//
// ENV VARS:
//   RESEND_API_KEY  (requerida para envío real)
//   RESEND_FROM     (opcional; default 'Finpathia <noreply@finpathia.com>')
// ═══════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  // Parse + validación mínima
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: "Body inválido" }) };
  }

  const { email, invitation_url, role, account_name, invited_by_name, expires_at } = payload;
  if (!email || !invitation_url || !role) {
    return {
      statusCode: 400,
      headers: cors,
      body: JSON.stringify({ ok: false, error: "Campos requeridos: email, invitation_url, role" }),
    };
  }

  // ── FALLBACK GRACEFUL: si Resend no está configurado, salir limpio ──
  // El admin ya tiene el link copyable en la UI, este envío automático es
  // un "nice to have". No queremos romper el flujo de invitación si el
  // dominio aún no está verificado o la API key no se cargó en Netlify.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log("[family-invite-email] RESEND_API_KEY ausente → fallback graceful (no email enviado)");
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        sent: false,
        reason: "resend_not_configured",
        message: "Email automático deshabilitado · usá el link copyable",
      }),
    };
  }

  const from = process.env.RESEND_FROM || "Finpathia <noreply@finpathia.com>";
  const safeRole = role === "admin" ? "Administrador" : "Solo lectura";
  const safeAccountName = account_name || "una cuenta familiar";
  const safeInviter = invited_by_name || "El administrador";
  const expiresLine = expires_at
    ? `<p style="font-size:13px;color:#71717a;margin:8px 0 0">Este link expira el ${new Date(expires_at).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}.</p>`
    : "";

  // HTML email — diseño minimalista alineado con el branding de Finpathia
  // (oscuro, verde acento). Inline styles porque Gmail/Apple Mail strippean
  // <style> blocks en muchos casos. Email-safe HTML: tablas, no flexbox.
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Te invitaron a Finpathia</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0a;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 32px 16px">
          <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#10b981;margin-bottom:4px">finpathia</div>
          <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1.5px">Tu finanza personal, en serio</div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px">
          <h1 style="font-size:22px;font-weight:700;color:#fafafa;margin:16px 0 12px;line-height:1.3">Te invitaron a una cuenta familiar</h1>
          <p style="font-size:15px;line-height:1.6;color:#d4d4d8;margin:0 0 20px">
            <strong style="color:#fafafa">${escapeHtml(safeInviter)}</strong> te invitó a unirte a
            <strong style="color:#fafafa">${escapeHtml(safeAccountName)}</strong> en Finpathia con rol de
            <strong style="color:#10b981">${safeRole}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 24px">
            ${role === "reader"
              ? "Vas a poder ver todos los datos de la cuenta — ingresos, gastos, inversiones, plan tributario — en modo solo lectura. Las modificaciones las hace el administrador."
              : "Vas a poder ver y editar todos los datos de la cuenta — ingresos, gastos, inversiones, plan tributario — junto con los demás administradores."}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px">
            <tr><td style="background:#10b981;border-radius:10px">
              <a href="${escapeHtml(invitation_url)}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#000;text-decoration:none">Aceptar invitación</a>
            </td></tr>
          </table>
          <p style="font-size:12px;color:#71717a;line-height:1.6;margin:20px 0 0;word-break:break-all">
            Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
            <a href="${escapeHtml(invitation_url)}" style="color:#10b981;text-decoration:none">${escapeHtml(invitation_url)}</a>
          </p>
          ${expiresLine}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #27272a;background:#0a0a0a">
          <p style="font-size:11px;color:#52525b;line-height:1.6;margin:0">
            Si no esperabas esta invitación, podés ignorar este mensaje — el link expira solo. Tu información financiera sigue privada y solo se comparte si aceptás explícitamente.
          </p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#52525b;margin:24px 0 0">© Finpathia · finpathia.com</p>
    </td></tr>
  </table>
</body></html>`;

  const subject = `${safeInviter} te invitó a ${safeAccountName} en Finpathia`;

  // ── ENVÍO VÍA RESEND REST API ──
  // No usamos el SDK 'resend' para evitar agregar dependencia. La API es
  // estable y mínima (1 endpoint, 1 método). Mismo patrón que advisor-invite.js
  // usa con Supabase REST.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Resend devuelve { name, message, statusCode } en errores
      console.error("[family-invite-email] Resend error", res.status, data);
      return {
        statusCode: 200, // 200 al cliente — no romper el flujo de invitación
        headers: cors,
        body: JSON.stringify({
          ok: false,
          sent: false,
          error: data?.message || data?.name || `Resend respondió ${res.status}`,
          status: res.status,
        }),
      };
    }

    console.log(`[family-invite-email] Enviado a ${email} · message_id=${data?.id}`);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        ok: true,
        sent: true,
        message_id: data?.id || null,
      }),
    };
  } catch (err) {
    console.error("[family-invite-email] Exception", err);
    return {
      statusCode: 200, // 200 al cliente — el link sigue siendo copyable
      headers: cors,
      body: JSON.stringify({
        ok: false,
        sent: false,
        error: String(err?.message || err),
      }),
    };
  }
};

// HTML escape básico para evitar XSS en el email body. Los nombres y
// account_name vienen del cliente y se inyectan en el HTML; sin escape,
// un nombre malicioso podría inyectar tags. Cubrimos los 5 chars críticos.
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
