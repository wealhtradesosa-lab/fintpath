import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { usuarioDesdeToken } = require("./_auth.cjs");
const { consumirCuota, mensajeCuota } = require("./_cuotaIA.cjs");

export default async function handler(req) {
  const corsHeaders = { 
    "Content-Type": "application/json", 
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }
  
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 200, headers: corsHeaders });
    }

    const { excelText, modulePrompt } = body || {};
    if (!excelText || !modulePrompt) {
      return new Response(JSON.stringify({ error: "Missing excelText or modulePrompt" }), { status: 200, headers: corsHeaders });
    }
    
    // 28-sep-2026: esta función no pedía nada — ni sesión ni cuota — y cada
    // llamada consume la clave de Anthropic. Misma regla que analyze-image y
    // parse-declaration: sesión verificada y descuento de la cuota del plan.
    const quien = await usuarioDesdeToken({ headers: { authorization: req.headers.get("authorization") || "" } });
    if (!quien) {
      return new Response(JSON.stringify({ error: "sesion_requerida", mensaje: "Iniciá sesión para importar con IA." }), { status: 401, headers: corsHeaders });
    }
    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (SUPA_URL && SERVICE_KEY) {
      const cuota = await consumirCuota({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId: quien.id });
      if (!cuota.permitido) {
        return new Response(JSON.stringify(mensajeCuota(cuota)), { status: 429, headers: corsHeaders });
      }
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ fallback: true, error: "API key not configured" }), { status: 200, headers: corsHeaders });
    }
    
    const prompt = `Eres un experto en datos financieros. Analiza estos datos de Excel y extrae la información.

${modulePrompt}

DATOS DEL EXCEL:
${excelText.slice(0, 12000)}

INSTRUCCIONES:
1. Analiza los datos cuidadosamente
2. Extrae CADA fila válida como un objeto JSON
3. Responde SOLO con un JSON array válido, sin markdown, sin backticks, sin explicaciones
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
        model: "claude-sonnet-4-5-20250929", 
        max_tokens: 4000, 
        messages: [{ role: "user", content: prompt }] 
      })
    });
    
    if (!r.ok) {
      let errMsg = "API error: " + r.status;
      try { const t = await r.text(); errMsg += " " + t.slice(0, 200); } catch {}
      return new Response(JSON.stringify({ error: errMsg }), { status: 200, headers: corsHeaders });
    }
    
    const data = await r.json();
    const text = (data.content && data.content[0] && data.content[0].text) || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    
    let items;
    try {
      items = JSON.parse(clean);
      if (!Array.isArray(items)) items = [items];
    } catch {
      return new Response(JSON.stringify({ error: "La IA no devolvió JSON válido. Intenta de nuevo.", raw: clean.slice(0, 200) }), { status: 200, headers: corsHeaders });
    }
    
    return new Response(JSON.stringify({ items }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error: " + (err.message || "unknown") }), { status: 200, headers: corsHeaders });
  }
}

