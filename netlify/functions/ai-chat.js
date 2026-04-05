// In-memory rate limit (resets on cold start, ~10min)
const rateLimits = {};
const LIMIT = 30; // per day
const WINDOW = 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { messages, financialContext, userId } = JSON.parse(event.body);
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada. Contacta al administrador." }) };

    // Rate limit by userId or IP
    const key = userId || event.headers["x-forwarded-for"] || "anon";
    const now = Date.now();
    if (!rateLimits[key] || now - rateLimits[key].start > WINDOW) {
      rateLimits[key] = { start: now, count: 0 };
    }
    rateLimits[key].count++;
    const remaining = LIMIT - rateLimits[key].count;
    
    if (remaining < 0) {
      return { statusCode: 429, headers, body: JSON.stringify({ 
        error: "Has alcanzado el límite de 30 consultas diarias. Se renueva en " + Math.round((rateLimits[key].start + WINDOW - now) / 3600000) + " horas.",
        remaining: 0
      })};
    }

    const systemPrompt = `Eres el Asesor Financiero IA de FINPATH, una plataforma premium de gestión patrimonial. 
Respondes SIEMPRE en español. Eres directo, concreto y usas los datos reales del usuario.

DATOS FINANCIEROS DEL USUARIO:
${financialContext}

REGLAS:
- Usa los números exactos del usuario, no genéricos
- Da recomendaciones accionables con montos específicos
- Si te piden simular escenarios, muestra antes/después con números
- Formatea montos grandes con M (millones) o B (billones)
- Sé conciso: máximo 400 palabras por respuesta
- Si mencionas porcentajes, calcula el monto real
- No repitas los datos del usuario a menos que sea para analizar
- Puedes usar emojis con moderación para KPIs
- Si no tienes datos suficientes para responder, di qué falta`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await res.json();
    if (data.error) return { statusCode: 400, headers, body: JSON.stringify({ error: data.error.message, remaining }) };
    
    const reply = data.content?.map(b => b.text || "").join("") || "Sin respuesta";
    return { statusCode: 200, headers, body: JSON.stringify({ reply, remaining }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
