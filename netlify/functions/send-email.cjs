// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · send-email.js — Sesión 4-may-2026
//
// Endpoint genérico para enviar emails transaccionales vía Resend.
// Soporta 3 templates iniciales (welcome, trial_ending, cancellation) y se
// puede extender fácilmente agregando entries a TEMPLATES.
//
// PAYLOAD POST JSON:
//   {
//     to: string                   -- email del destinatario
//     template: string             -- "welcome" | "trial_ending" | "cancellation"
//     vars: { ... }                -- variables del template (depende del tipo)
//   }
//
// RESPUESTA:
//   { ok: true, sent: true, message_id: string }
//   { ok: true, sent: false, reason: "resend_not_configured" }
//   { ok: false, error: string }
//
// ENV VARS:
//   RESEND_API_KEY  (requerida — sin esto los emails no se envían)
//   RESEND_FROM     (opcional — default 'FINPATHIA <soporte@finpathia.com>')
//
// DISEÑO DEFENSIVO:
//   - Si RESEND no está configurado, responde 200 con sent:false (no rompe el flow)
//   - Si el template no existe, responde 400 con error claro
//   - Nunca bloquea al user — los emails son enhancement, no critical path
// ═══════════════════════════════════════════════════════════════════════════

// ─── Componentes HTML reusables ──────────────────────────────────────────
const FONT_STACK = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function emailShell(content, { ctaText, ctaUrl, preheader = "" }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FINPATHIA</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:${FONT_STACK};color:#fafafa;-webkit-font-smoothing:antialiased;">
<!-- Preheader (texto invisible que aparece como preview en bandeja) -->
<div style="display:none;font-size:1px;color:#0a0a0a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0a;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#141418;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header con logo -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:22px;font-weight:800;color:#22c55e;letter-spacing:-0.5px;">FINPATHIA</div>
            <div style="font-size:11px;color:#71717a;margin-top:2px;letter-spacing:1px;text-transform:uppercase;">Inteligencia patrimonial</div>
          </td>
        </tr>

        <!-- Contenido principal -->
        <tr>
          <td style="padding:32px 40px;">
            ${content}
            ${ctaText && ctaUrl ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:99px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;color:#000;text-decoration:none;font-weight:700;font-size:15px;font-family:${FONT_STACK};">${ctaText}</a>
                </td>
              </tr>
            </table>
            ` : ""}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;color:#71717a;line-height:1.6;">
            <div style="margin-bottom:8px;">¿Dudas o feedback? Respondé a este email — leo todo personalmente.</div>
            <div style="font-size:11px;color:#52525b;">
              FINPATHIA · <a href="https://finpathia.com" style="color:#71717a;text-decoration:none;">finpathia.com</a> ·
              <a href="https://finpathia.com/seguridad" style="color:#71717a;text-decoration:none;">Seguridad</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Templates ──────────────────────────────────────────────────────────
const TEMPLATES = {
  // ── 1. WELCOME ── Enviado al completar el signup
  welcome: ({ name, isPioneros }) => {
    const firstName = (name || "").split(" ")[0] || "";
    const greeting = firstName ? `¡Hola ${firstName}!` : "¡Bienvenido!";

    return {
      subject: isPioneros
        ? "🎁 Bienvenido a FINPATHIA Pioneros — 3.5 meses gratis activados"
        : "¡Bienvenido a FINPATHIA! Empezá tus 14 días gratis",
      preheader: isPioneros
        ? "Tu acceso Pioneros está activo. Te cuento qué hacer ahora."
        : "Centralizá tu patrimonio con IA en los próximos 60 segundos.",
      html: emailShell(
        `
        ${isPioneros ? `
        <div style="display:inline-block;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:6px 14px;border-radius:99px;font-size:11px;font-weight:700;color:#22c55e;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:20px;">
          Acceso Pioneros 2026
        </div>
        ` : ""}

        <h1 style="font-size:28px;font-weight:800;line-height:1.2;margin:0 0 16px;color:#fafafa;letter-spacing:-1px;">
          ${greeting}
        </h1>

        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">
          Acabás de unirte a <strong style="color:#fafafa;">FINPATHIA</strong> — el lugar donde
          centralizás tu patrimonio, planeás tus impuestos y consultás con un asesor IA
          que ve tus números reales.
        </p>

        ${isPioneros ? `
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px 20px;margin:24px 0;">
          <div style="font-size:13px;color:#22c55e;font-weight:700;margin-bottom:6px;">✓ Tu acceso Pioneros está activo</div>
          <div style="font-size:13px;color:#a1a1aa;line-height:1.6;">
            Tenés <strong style="color:#fafafa;">14 días de prueba + 3 meses gratis del Plan Pro</strong>.
            Sin tarjeta para el trial, cancelás cuando quieras.
          </div>
        </div>
        ` : `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 20px;margin:24px 0;">
          <div style="font-size:13px;color:#fafafa;font-weight:700;margin-bottom:6px;">⏱ 14 días de prueba activos</div>
          <div style="font-size:13px;color:#a1a1aa;line-height:1.6;">
            Tenés acceso completo al Plan Pro durante tu trial. Sin tarjeta requerida.
          </div>
        </div>
        `}

        <h2 style="font-size:17px;font-weight:700;color:#fafafa;margin:32px 0 12px;">¿Por dónde empezar?</h2>

        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0 0 8px;">
          <strong style="color:#fafafa;">1. Importá tu Excel</strong> · si ya manejás tu plata en spreadsheets, importalo en 1 click. Nuestra IA detecta inversiones, ingresos y gastos automáticamente.
        </p>
        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0 0 8px;">
          <strong style="color:#fafafa;">2. Cargá datos de ejemplo</strong> · si querés ver cómo se siente antes de meter tus datos reales.
        </p>
        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">
          <strong style="color:#fafafa;">3. Conversá con el Asesor IA</strong> · una vez tengas datos, preguntale "¿en qué deberías enfocarte este mes?" y te da un plan concreto.
        </p>
        `,
        {
          ctaText: "Entrar a FINPATHIA →",
          ctaUrl: "https://finpathia.com",
          preheader: isPioneros
            ? "Tu acceso Pioneros está activo. Te cuento qué hacer ahora."
            : "Centralizá tu patrimonio con IA en los próximos 60 segundos.",
        }
      ),
    };
  },

  // ── 2. TRIAL ENDING ── Enviado 3 días antes de que termine el trial
  trial_ending: ({ name, daysLeft, plan = "Pro" }) => {
    const firstName = (name || "").split(" ")[0] || "";
    const greeting = firstName ? `Hola ${firstName}` : "Hola";

    return {
      subject: daysLeft <= 1
        ? "⏰ Tu trial de FINPATHIA termina mañana"
        : `⏰ Tu trial de FINPATHIA termina en ${daysLeft} días`,
      preheader: "Mantené tu acceso Pro completo sin interrupción.",
      html: emailShell(
        `
        <h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 16px;color:#fafafa;letter-spacing:-0.8px;">
          ${greeting}, tu trial termina ${daysLeft <= 1 ? "mañana" : `en ${daysLeft} días`}.
        </h1>

        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">
          Esperamos que estos días te hayan servido para ver el valor que FINPATHIA puede aportarle a tu patrimonio.
          Antes de que termine el trial, querés decidir si seguís con nosotros.
        </p>

        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:24px 0;">
          <div style="font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">¿Qué pasa cuando termina el trial?</div>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0 0 8px;">
            <strong style="color:#fafafa;">Si activás tu plan:</strong> seguís con acceso completo al Plan ${plan}. Cobramos el primer mes (o el primer año si elegís anual con descuento).
          </p>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0;">
            <strong style="color:#fafafa;">Si no hacés nada:</strong> tu cuenta vuelve al plan Free (1 usuario, 3 inversiones, sin Asesor IA). Tus datos quedan guardados.
          </p>
        </div>

        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:24px 0 0;">
          ¿Tenés dudas sobre qué plan te conviene? Respondé este email y te ayudo a decidir.
        </p>
        `,
        {
          ctaText: "Activar Plan Pro →",
          ctaUrl: "https://finpathia.com",
          preheader: "Mantené tu acceso Pro completo sin interrupción.",
        }
      ),
    };
  },

  // ── 3. CANCELLATION ── Enviado cuando el user cancela su suscripción
  cancellation: ({ name, plan = "Pro", periodEnd, reason }) => {
    const firstName = (name || "").split(" ")[0] || "";
    const greeting = firstName ? `Hola ${firstName}` : "Hola";

    // Mensaje específico según razón de cancelación (de Stripe Portal)
    const reasonResponses = {
      too_expensive: "Entiendo que el precio sea un factor. Si querés, puedo ayudarte a evaluar el Plan Básico que tiene lo esencial a $8/mes.",
      missing_features: "¿Qué te faltó? Tu feedback nos ayuda a priorizar — respondé este email contándome.",
      switched_service: "Gracias por probarnos. Si volvés a evaluar herramientas en el futuro, acá estamos.",
      unused: "Si querés volver a probarlo en el futuro, tu información queda guardada.",
      customer_service: "Lamento que la experiencia no haya sido buena. Me encantaría saber qué pasó — respondé este email.",
      too_complex: "Tomamos nota. Estamos trabajando en simplificar la experiencia.",
      low_quality: "Tu feedback me importa mucho — respondé contándome qué encontraste deficiente y cómo podemos mejorar.",
    };
    const customResponse = reason && reasonResponses[reason] ? reasonResponses[reason] : "Si querés contarme qué pasó, respondé este email — todo feedback me ayuda.";

    return {
      subject: "Tu suscripción FINPATHIA — confirmación de cancelación",
      preheader: "Tu acceso sigue activo hasta el final del período pagado.",
      html: emailShell(
        `
        <h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 16px;color:#fafafa;letter-spacing:-0.8px;">
          ${greeting}, recibimos tu cancelación.
        </h1>

        <p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">
          Tu suscripción al Plan ${plan} fue cancelada. ${periodEnd ? `Mantenés acceso completo hasta el <strong style="color:#fafafa;">${periodEnd}</strong>.` : ""}
        </p>

        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:24px 0;">
          <div style="font-size:13px;color:#fafafa;font-weight:700;margin-bottom:8px;">Qué pasa ahora</div>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0 0 8px;">
            <strong style="color:#fafafa;">No te cobramos más</strong> · ningún cargo recurrente.
          </p>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0 0 8px;">
            <strong style="color:#fafafa;">Tus datos quedan guardados</strong> · si volvés en el futuro, encontrás todo donde lo dejaste.
          </p>
          <p style="font-size:14px;color:#a1a1aa;line-height:1.6;margin:0;">
            <strong style="color:#fafafa;">Podés exportar todo</strong> · entrá a tu cuenta y descargá un Excel con tu información.
          </p>
        </div>

        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:24px 0 0;">
          ${customResponse}
        </p>

        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:16px 0 0;">
          Gracias por haber sido parte de FINPATHIA. Te deseo lo mejor en lo que sigue.
        </p>

        <p style="font-size:14px;color:#fafafa;line-height:1.7;margin:16px 0 0;font-weight:600;">
          — Santiago
        </p>
        `,
        {
          ctaText: null,
          ctaUrl: null,
          preheader: "Tu acceso sigue activo hasta el final del período pagado.",
        }
      ),
    };
  },
};

// ─── Handler ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };

  try {
    const { to, template, vars = {} } = JSON.parse(event.body || "{}");

    // ── 02-ago-2026 — ENDPOINT ABIERTO ────────────────────────────────────
    // Esta función NO validaba quién la llama: cualquiera con la URL podía
    // enviar correos DESDE finpathia.com a cualquier destinatario. Riesgo
    // doble: consumo de la cuota de Resend y, peor, que el dominio termine
    // marcado como spam por envíos que no salieron de la app.
    // Es el mismo agujero que se cerró hoy en analyze-image y
    // parse-declaration.
    // Se valida el ORIGEN en vez de exigir sesión, porque el welcome email se
    // dispara justo al registrarse, cuando todavía no hay token estable.
    const origen = event.headers.origin || event.headers.referer || "";
    const permitidos = ["https://finpathia.com", "https://www.finpathia.com", "http://localhost"];
    if (origen && !permitidos.some(o => origen.startsWith(o))) {
      return { statusCode: 403, headers: cors,
        body: JSON.stringify({ ok: false, error: "origen_no_permitido" }) };
    }

    if (!to || !template) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: "Faltan params: to, template" }) };
    }

    const tmpl = TEMPLATES[template];
    if (!tmpl) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: `Template "${template}" no existe. Disponibles: ${Object.keys(TEMPLATES).join(", ")}` }) };
    }

    // Defensive fallback: si Resend no está configurado, no bloqueamos
    if (!process.env.RESEND_API_KEY) {
      console.warn(`[send-email] RESEND_API_KEY ausente — skip envío de "${template}" a ${to}`);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, sent: false, reason: "resend_not_configured" }) };
    }

    const { subject, html, preheader } = tmpl(vars);
    const from = process.env.RESEND_FROM || "FINPATHIA <soporte@finpathia.com>";

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error(`[send-email] Resend error (${resp.status}):`, data);
      return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: data.message || "Resend error", status: resp.status }) };
    }

    console.log(`[send-email] ✅ template=${template} to=${to} message_id=${data.id}`);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, sent: true, message_id: data.id }) };
  } catch (e) {
    console.error("[send-email] exception:", e);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: String(e?.message || e) }) };
  }
};
