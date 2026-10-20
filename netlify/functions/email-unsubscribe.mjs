// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · email-unsubscribe — baja de los correos de la prueba
//
// URL: https://finpathia.com/api/email-unsubscribe?t=<token firmado>
//   GET  → página en español con un botón "Confirmar baja". No da de baja
//          solo con abrir el enlace: los filtros de correo (p. ej. Outlook
//          Safe Links) abren los enlaces de forma automática y darían de
//          baja a gente que no lo pidió.
//   POST → verifica el token (HMAC con EMAIL_UNSUB_SECRET), marca
//          accounts.email_unsubscribed_at y muestra la confirmación. Es
//          también el destino del botón "Cancelar suscripción" de Gmail/
//          Apple Mail (List-Unsubscribe-Post: List-Unsubscribe=One-Click).
// Sin EMAIL_UNSUB_SECRET no verifica nada (falla cerrado).
// ═══════════════════════════════════════════════════════════════════════════
import { verificarTokenBaja } from "../lib/lifecycle/tokenBaja.mjs";

const pagina = (titulo, mensaje, extra = "") => `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex"><title>${titulo} · Finpathia</title></head>
<body style="margin:0;background:#0a0a0a;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<main style="max-width:480px;margin:80px auto;padding:32px;background:#141418;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
<div style="font-size:20px;font-weight:800;color:#22c55e;margin-bottom:24px;">FINPATHIA</div>
<h1 style="font-size:22px;margin:0 0 12px;">${titulo}</h1>
<p style="color:#a1a1aa;line-height:1.6;margin:0 0 20px;">${mensaje}</p>${extra}
</main></body></html>`;

const html = (status, cuerpo) => new Response(cuerpo, {
  status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
});

export default async (req) => {
  const secreto = process.env.EMAIL_UNSUB_SECRET;
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!secreto) {
    return html(503, pagina("No pudimos procesar tu baja", "Escríbenos a soporte@finpathia.com y te damos de baja a mano."));
  }
  const accountId = verificarTokenBaja(token, secreto);
  if (!accountId) {
    return html(400, pagina("Enlace no válido", "Este enlace de baja no es válido o está incompleto. Si quieres dejar de recibir correos, escríbenos a soporte@finpathia.com."));
  }

  if (req.method === "GET") {
    const accion = `/api/email-unsubscribe?t=${encodeURIComponent(token)}`;
    return html(200, pagina(
      "¿Dejar de recibir estos correos?",
      "Vas a dejar de recibir los correos sobre tu prueba de Finpathia. Tu cuenta y tus datos no cambian.",
      `<form method="POST" action="${accion}"><button type="submit" style="background:#22c55e;color:#000;border:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:15px;cursor:pointer;">Confirmar baja</button></form>`
    ));
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  try {
    const r = await fetch(`${url}/rest/v1/accounts?id=eq.${accountId}&email_unsubscribed_at=is.null`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ email_unsubscribed_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    console.error("[email-unsubscribe] error:", e?.message || e);
    return html(500, pagina("No pudimos procesar tu baja", "Intenta de nuevo en un rato o escríbenos a soporte@finpathia.com."));
  }
  console.log(`[email-unsubscribe] baja cuenta=${accountId}`);
  return html(200, pagina("Listo, ya no te escribiremos", "Te diste de baja de los correos de la prueba. Tu cuenta y tus datos siguen igual."));
};
