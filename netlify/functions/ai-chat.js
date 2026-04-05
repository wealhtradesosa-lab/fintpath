exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { messages, financialContext } = JSON.parse(event.body);
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API key not configured" }) };

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
    if (data.error) return { statusCode: 400, headers, body: JSON.stringify({ error: data.error.message }) };
    
    const reply = data.content?.map(b => b.text || "").join("") || "Sin respuesta";
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
