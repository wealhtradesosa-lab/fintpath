export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: try to parse without AI
    return res.status(200).json({ fallback: true, items: [] });
  }

  try {
    const { excelText, modulePrompt } = req.body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Eres un experto en análisis de datos financieros. Analiza este contenido de un archivo Excel y extrae los datos según las instrucciones.

INSTRUCCIONES:
${modulePrompt}

DATOS DEL EXCEL:
${excelText}

IMPORTANTE:
- Responde SOLO con un array JSON válido, sin texto adicional, sin backticks, sin markdown
- Cada elemento del array es un objeto con los campos indicados
- Si un campo no existe en el Excel, pon un valor por defecto ("" para strings, 0 para números)
- Los montos deben ser NÚMEROS, no strings
- NO incluyas filas de TOTAL, SUBTOTAL o resumen
- Incluye TODAS las filas de datos individuales`
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(i => i.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(clean);

    return res.status(200).json({ items });
  } catch (err) {
    console.error("AI analysis error:", err);
    return res.status(500).json({ error: err.message });
  }
}
