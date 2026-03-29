export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }
  
  try {
    const body = await req.json();
    const { columns, sampleRows, fileName } = body;
    
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    
    const prompt = `Analyze this Excel file "${fileName}" and map columns to FINPATH categories.
Columns: ${JSON.stringify(columns)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 5))}

Return ONLY valid JSON (no markdown, no backticks):
{
  "mappings": [
    {"column": "column_name", "maps_to": "nombre|valor|ingreso|gasto|tipo|ubicacion|skip", "reason": "why"}
  ],
  "detected_items": [
    {"nombre": "name", "tipo": "Real Estate|Investment|...", "valor": number, "ingreso_mensual": number, "gasto_mensual": number}
  ]
}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: prompt }] })
    });
    
    const data = await r.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    
    return new Response(clean, { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export const config = { path: "/api/analyze-excel" };
