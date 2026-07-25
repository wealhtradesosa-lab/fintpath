// ═══════════════════════════════════════════════════════════════════
// ADVISOR LEAD — Netlify Function
// 
// Captura leads del form "Reservar mi cupo" de la landing /asesores
// Los guarda en Supabase (tabla advisor_leads) para follow-up manual.
// 
// Payload esperado (JSON):
// {
//   type: "advisor_interest",
//   plan: "starter" | "professional" | "boutique",
//   name: string,
//   email: string,
//   phone?: string,
//   firm?: string,
//   clients?: string,
//   message?: string,
//   billingCycle?: "mensual" | "anual"
// }
// ═══════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
    const { plan, name, email, phone, firm, clients, message, billingCycle } = body;

    if (!email || !name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name and email are required" }),
      };
    }

    const lead = {
      id: "ALD-" + Date.now(),
      created_at: new Date().toISOString(),
      plan: plan || "professional",
      name,
      email,
      phone: phone || null,
      firm: firm || null,
      clients_count: clients || null,
      message: message || null,
      billing_cycle: billingCycle || "mensual",
      source: "landing_asesores",
      status: "new",
    };

    // Log to Netlify logs (always)
    console.log("🎯 ADVISOR LEAD:", JSON.stringify(lead));

    // Save to Supabase if configured
    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (SUPA_URL && SERVICE_KEY) {
      try {
        const res = await fetch(`${SUPA_URL}/rest/v1/advisor_leads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(lead),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.error("Supabase insert failed:", res.status, txt);
        }
      } catch (e) {
        console.error("Supabase error:", e.message);
      }
    }

    // Send email notification to Santiago (optional, needs RESEND_API_KEY)
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Finpathia <hello@finpathia.com>",
            to: ["santiagososa1@me.com"],
            subject: `🎯 Nuevo lead asesor: ${name} (${plan})`,
            html: `
              <h2>Nuevo lead de Finpathia para Asesores</h2>
              <p><strong>Plan de interés:</strong> ${plan}</p>
              <p><strong>Nombre:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>WhatsApp:</strong> ${phone || "No proporcionado"}</p>
              <p><strong>Firma:</strong> ${firm || "No proporcionada"}</p>
              <p><strong>Clientes que gestiona:</strong> ${clients || "No indicado"}</p>
              <p><strong>Comentario:</strong></p>
              <p>${message || "Sin comentario"}</p>
              <hr>
              <p style="color: #888; font-size: 12px;">Lead ID: ${lead.id}</p>
            `,
          }),
        });
      } catch (e) {
        console.error("Email notification failed:", e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, leadId: lead.id }),
    };
  } catch (err) {
    console.error("Handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
