export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }
  
  try {
    const body = await req.json();
    const { excelText, modulePrompt } = body;
    
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ fallback: true, error: "API key not configured" }), { 
        status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    const prompt = `Eres un experto en datos financieros. Analiza estos datos de Excel y extrae la información.

${modulePrompt}

DATOS DEL EXCEL:
${excelText}

INSTRUCCIONES:
1. Analiza los datos cuidadosamente
2. Extrae CADA fila válida como un objeto JSON
3. Responde SOLO con un JSON array válido, sin markdown, sin backticks
4. Si un campo no existe, usa valores por defecto (0 para números, "" para strings)
5. Los valores numéricos deben ser NÚMEROS, no strings

Responde SOLO con el array JSON:`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-api-key": ANTHROPIC_API_KEY, 
        "anthropic-version": "2023-06-01" 
      },
      body: JSON.stringify({ 
        model: "claude-sonnet-4-20250514", 
        max_tokens: 4000, 
        messages: [{ role: "user", content: prompt }] 
      })
    });
    
    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ error: "API error: " + r.status + " " + errText.slice(0, 200) }), { 
        status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    const data = await r.json();
    const text = data.content?.[0]?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    
    let items;
    try {
      items = JSON.parse(clean);
      if (!Array.isArray(items)) items = [items];
    } catch {
      return new Response(JSON.stringify({ error: "La IA no devolvió JSON válido. Intenta de nuevo." }), { 
        status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    return new Response(JSON.stringify({ items }), { 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }
}

export const config = { path: "/api/analyze-excel" };
