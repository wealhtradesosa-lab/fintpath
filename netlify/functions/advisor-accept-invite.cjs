// ═══════════════════════════════════════════════════════════════════
// ADVISOR ACCEPT INVITE — Netlify Function
//
// Maneja dos operaciones según `action` en el payload:
//
// 1. action = "validate" — valida que el token existe y no expiró
//    Payload: { token }
//    Respuesta: {
//      valid: true,
//      email_invited,
//      advisor_firm,
//      advisor_name,
//      advisor_email,
//      expires_at
//    }
//
// 2. action = "accept" — vincula client_id al advisor del token
//    Payload: { token, client_id }
//    Validaciones:
//      - Token existe y no expiró
//      - Token no usado
//      - Advisor existe y está activo
//      - Advisor no excede capacidad
//      - Cliente no está ya vinculado a ese advisor
//    Respuesta: { success: true, advisor_id, advisor_firm }
//
// Notas:
// - Usa SERVICE_KEY para escribir en advisor_clients bypass RLS
// - El cliente ya debe existir en auth.users antes de llamar "accept"
// - Actualiza plan del cliente a 'pro' automáticamente (gratis, cubierto por advisor)
// ═══════════════════════════════════════════════════════════════════

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
    const body = JSON.parse(event.body || "{}");
    const { action, token, client_id } = body;

    if (!token || typeof token !== "string") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "token es requerido" }),
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

    const supaHeaders = {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    // ─── 1. Buscar la invitación por token ───
    const invRes = await fetch(
      `${SUPA_URL}/rest/v1/advisor_invitations?token=eq.${encodeURIComponent(token)}&select=id,advisor_id,token,email_invited,used,used_by,expires_at,created_at`,
      { headers: supaHeaders }
    );
    const invList = await invRes.json();
    if (!Array.isArray(invList) || invList.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Invitación no encontrada o token inválido" }),
      };
    }
    const invitation = invList[0];

    // ─── 2. Validar expiración ───
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < now) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: "Esta invitación expiró. Pide a tu asesor que te envíe una nueva." }),
      };
    }

    // ─── 3. Validar que no fue usada ───
    if (invitation.used) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ error: "Esta invitación ya fue usada previamente" }),
      };
    }

    // ─── 4. Obtener datos del advisor ───
    const advRes = await fetch(
      `${SUPA_URL}/rest/v1/advisors?id=eq.${invitation.advisor_id}&select=id,email,firm_name,advisor_plan,max_clients,subscription_status`,
      { headers: supaHeaders }
    );
    const advList = await advRes.json();
    if (!Array.isArray(advList) || advList.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "El asesor de esta invitación ya no existe" }),
      };
    }
    const advisor = advList[0];

    if (advisor.subscription_status !== "active") {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "La suscripción del asesor no está activa. Contáctalo directamente." }),
      };
    }

    // ═══ ACTION: validate ═══
    if (action === "validate") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          email_invited: invitation.email_invited,
          advisor_firm: advisor.firm_name || "su asesor",
          advisor_email: advisor.email,
          expires_at: invitation.expires_at,
        }),
      };
    }

    // ═══ ACTION: accept ═══
    if (action === "accept") {
      if (!client_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "client_id es requerido para aceptar la invitación" }),
        };
      }

      // Validar capacidad del advisor
      const capRes = await fetch(
        `${SUPA_URL}/rest/v1/advisor_clients?advisor_id=eq.${invitation.advisor_id}&status=eq.active&select=id`,
        { headers: supaHeaders }
      );
      const capList = await capRes.json();
      const currentClients = Array.isArray(capList) ? capList.length : 0;
      if (currentClients >= advisor.max_clients) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: `El asesor alcanzó su capacidad máxima (${advisor.max_clients}). Contáctalo.` }),
        };
      }

      // Validar que el cliente no esté ya vinculado a ESTE advisor
      const existsRes = await fetch(
        `${SUPA_URL}/rest/v1/advisor_clients?advisor_id=eq.${invitation.advisor_id}&client_id=eq.${client_id}&select=id,status`,
        { headers: supaHeaders }
      );
      const existsList = await existsRes.json();
      if (Array.isArray(existsList) && existsList.length > 0) {
        const existing = existsList[0];
        if (existing.status === "active") {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: "Ya estás vinculado a este asesor" }),
          };
        }
      }

      // Insertar la relación advisor_client
      const acceptTime = new Date().toISOString();
      const clientRow = {
        advisor_id: invitation.advisor_id,
        client_id: client_id,
        status: "active",
        invited_at: invitation.created_at,
        accepted_at: acceptTime,
      };

      const insertRes = await fetch(`${SUPA_URL}/rest/v1/advisor_clients`, {
        method: "POST",
        headers: { ...supaHeaders, "Prefer": "return=representation" },
        body: JSON.stringify(clientRow),
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error("Insert advisor_clients failed:", insertRes.status, errText);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "No se pudo vincular la cuenta al asesor" }),
        };
      }

      // Marcar invitación como usada
      await fetch(
        `${SUPA_URL}/rest/v1/advisor_invitations?id=eq.${invitation.id}`,
        {
          method: "PATCH",
          headers: supaHeaders,
          body: JSON.stringify({ used: true, used_by: client_id }),
        }
      );

      // Activar plan pro en user_data (cliente tiene acceso Pro gratis via asesor)
      await fetch(
        `${SUPA_URL}/rest/v1/user_data?id=eq.${client_id}`,
        {
          method: "PATCH",
          headers: supaHeaders,
          body: JSON.stringify({ plan: "pro", updated_at: acceptTime }),
        }
      );

      console.log(`✅ Invitation ${invitation.id} accepted by client ${client_id} for advisor ${invitation.advisor_id}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          advisor_id: invitation.advisor_id,
          advisor_firm: advisor.firm_name,
          advisor_email: advisor.email,
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "action debe ser 'validate' o 'accept'" }),
    };
  } catch (err) {
    console.error("advisor-accept-invite error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
