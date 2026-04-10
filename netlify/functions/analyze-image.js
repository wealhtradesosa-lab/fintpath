exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada" }) };

    const { image, type, mediaType } = JSON.parse(event.body);
    if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: "No image provided" }) };

    const prompt = type === "ingreso"
      ? `Analiza esta imagen de un documento financiero colombiano (extracto, certificado, recibo de pago, etc.).

Extrae la siguiente información y responde SOLO con JSON válido, sin markdown ni backticks:
{
  "nombre": "nombre o concepto del ingreso",
  "mensual": número (monto mensual en COP, sin puntos ni comas),
  "categoria": "una de: Salario, Honorarios, Arriendo, Rendimiento, Dividendos, Inversión, Pensión, Negocio, Otro",
  "fuente": "empresa o entidad que paga",
  "capital": número o null (capital invertido si aplica),
  "tasa": número o null (% rentabilidad si aplica),
  "confianza": "alta" o "media" o "baja"
}

Si no puedes leer algo, pon null. Si el monto es anual divídelo entre 12. Montos en COP.`
      : `Analiza esta imagen de una factura, recibo o documento de gasto colombiano (servicios públicos, predial, seguro, cuenta de cobro, nómina, factura, etc.).

Extrae la siguiente información y responde SOLO con JSON válido, sin markdown ni backticks:
{
  "concepto": "descripción corta del gasto",
  "monto": número (monto mensual en COP, sin puntos ni comas),
  "categoria": "una de: Nómina, Honorarios, Vivienda, Servicios, Mantenimiento, Seguros, Transporte, Predial, Representación, Tecnología, Alimentación, Educación, Salud, Seguridad Social, Entretenimiento, Personal, Otro",
  "tipo": "fijo" o "variable",
  "frecuencia": "mes" o "bimestral" o "trimestral" o "semestral" o "año",
  "confianza": "alta" o "media" o "baja"
}

Si el monto es bimestral divídelo entre 2, trimestral entre 3, semestral entre 6, anual entre 12.
Si no puedes leer algo, pon null. Montos en COP.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const data = await r.json();
    const text = (data.content || []).map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: parsed }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, raw: text, error: "No se pudo interpretar la imagen" }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
