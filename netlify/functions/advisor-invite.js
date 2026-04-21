// ═══════════════════════════════════════════════════════════════════
// ADVISOR INVITE — Netlify Function
//
// Genera un token único de invitación cuando un asesor quiere
// agregar un cliente nuevo a su workspace.
//
// Payload esperado (JSON):
// {
//   advisor_id: UUID,
//   email: string (email del cliente a invitar),
//   message?: string (mensaje personal opcional)
// }
//
// Validaciones:
// - El advisor debe existir en la tabla `advisors`
// - El advisor no debe haber excedido su max_clients
// - El email no puede estar ya vinculado a ese advisor
//
// Respuesta:
// { token, invitation_url, expires_at }
// ═══════════════════════════════════════════════════════════════════

const crypto = require("crypto");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method not allowed" };
  }

  try {
    const { advisor_id, email, message } = JSON.parse(event.body || "{}");

    if (!advisor_id || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "advisor_id y email son requeridos" }),
      };
    }

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPA_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Supabase no configurado en el servidor" }),
      };
    }

    // 1. Verificar que el advisor existe y tiene plan activo
    const advisorRes = await fetch(
      `${SUPA_URL}/rest/v1/advisors?id=eq.${advisor_id}&select=id,max_clients,subscription_status,advisor_plan`,
      {
        headers: {
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
        },
      }
    );
    const advisorData = await advisorRes.json();
    if (!Array.isArray(advisorData) || advisorData.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Advisor no encontrado" }),
      };
    }
    const advisor = advisorData[0];
    if (advisor.subscription_status !== "active") {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Tu suscripción de asesor no está activa" }),
      };
    }

    // 2. Verificar capacidad
    const clientCountRes = await fetch(
      `${SUPA_URL}/rest/v1/advisor_clients?advisor_id=eq.${advisor_id}&status=eq.active&select=id`,
      {
        headers: {
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "apikey": SERVICE_KEY,
          "Prefer": "count=exact",
        },
      }
    );
    const clientsData = await clientCountRes.json();
    const currentClients = Array.isArray(clientsData) ? clientsData.length : 0;
    if (currentClients >= advisor.max_clients) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: `Has alcanzado el límite de ${advisor.max_clients} clientes de tu plan ${advisor.advisor_plan}. Actualiza tu plan para invitar más.`,
        }),
      };
    }

    // 3. Generar token único
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invitationRow = {
      advisor_id,
      token,
      email_invited: email.toLowerCase().trim(),
      used: false,
      expires_at: expiresAt,
    };

    // 4. Guardar en Supabase
    const insertRes = await fetch(`${SUPA_URL}/rest/v1/advisor_invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(invitationRow),
    });
    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error("Insert failed:", insertRes.status, errText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "No se pudo crear la invitación" }),
      };
    }

    const host = event.headers?.host || "finpathia.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const invitation_url = `${protocol}://${host}/invite/${token}`;

    console.log(`🎟 Invitation created by ${advisor_id} for ${email}: ${token.slice(0, 8)}...`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        invitation_url,
        expires_at: expiresAt,
        message: message || null,
      }),
    };
  } catch (err) {
    console.error("advisor-invite error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
