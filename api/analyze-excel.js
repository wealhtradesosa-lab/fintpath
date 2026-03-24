export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ fallback: true, error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { excelText, modulePrompt } = req.body;
    if (!excelText || !modulePrompt) {
      return res.status(400).json({ error: "Missing excelText or modulePrompt" });
    }

    // Truncate if too long (Claude has context limits)
    const truncated = excelText.length > 15000 ? excelText.slice(0, 15000) + "\n...(truncado)" : excelText;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `Eres un experto en análisis de datos financieros. Tu trabajo es extraer datos estructurados de un archivo Excel.

INSTRUCCIONES PARA LOS CAMPOS:
${modulePrompt}

CONTENIDO DEL ARCHIVO EXCEL:
${truncated}

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido: [{ ... }, { ... }]
2. NO incluyas texto, explicaciones, backticks ni markdown
3. NO incluyas filas de TOTAL, SUBTOTAL, SUMA o encabezados
4. Los montos son NÚMEROS positivos (no strings)
5. Si un valor tiene fórmulas, usa el resultado numérico
6. Si una columna no existe, usa el valor por defecto: "" para texto, 0 para números
7. Incluye TODAS las filas de datos, no solo las primeras
8. El primer campo (nombre/activo/concepto) es OBLIGATORIO — no incluyas filas sin nombre`
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(500).json({ error: `API error ${response.status}` });
    }

    const data = await response.json();
    const rawText = (data.content || []).map((block) => block.text || "").join("");

    // Clean the response — remove any markdown formatting
    let cleaned = rawText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Try to find the JSON array if there's extra text
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    }

    let items;
    try {
      items = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message, "Raw:", cleaned.slice(0, 200));
      return res.status(200).json({ items: [], error: "Could not parse AI response" });
    }

    if (!Array.isArray(items)) {
      items = [items]; // Wrap single object in array
    }

    // Filter out empty items
    items = items.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const vals = Object.values(item);
      return vals.some((v) => (typeof v === "string" && v.trim().length > 0) || (typeof v === "number" && v !== 0));
    });

    return res.status(200).json({ items });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
