exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { name, email, category, message, plan, page } = JSON.parse(event.body);
    if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: "Mensaje requerido" }) };

    // Store ticket (log for now, could save to Supabase later)
    const ticket = {
      id: "TK-" + Date.now(),
      date: new Date().toISOString(),
      name: name || "Anónimo",
      email: email || "N/A",
      category: category || "General",
      message,
      plan: plan || "free",
      page: page || "N/A",
    };

    console.log("🎫 TICKET:", JSON.stringify(ticket));

    // Try to save to Supabase if configured
    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (SUPA_URL && SERVICE_KEY) {
      try {
        await fetch(`${SUPA_URL}/rest/v1/support_tickets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey": SERVICE_KEY,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(ticket),
        });
      } catch (e) {
        console.log("Could not save to Supabase:", e.message);
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ticket: ticket.id }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
