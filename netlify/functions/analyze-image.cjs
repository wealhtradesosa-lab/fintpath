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

    const mt = mediaType || "image/jpeg";
    const esPDF = mt === "application/pdf" || mt.includes("pdf");

    const promptDeuda = `Analiza este documento colombiano de una deuda o crédito (extracto de tarjeta de crédito, estado de cuenta de préstamo, plan de pagos de hipoteca, leasing, libranza, etc.).

Extrae la siguiente información y responde SOLO con JSON válido, sin markdown ni backticks:
{
  "nombre": "nombre del crédito o entidad (ej. Tarjeta Visa Bancolombia, Hipoteca Davivienda)",
  "saldo": número (saldo/capital pendiente TOTAL en COP, sin puntos ni comas),
  "cuota": número (cuota o pago mensual en COP),
  "tasa": número o null (tasa de interés EFECTIVA ANUAL en %. Si el documento da una tasa mensual, multiplícala por 12 aproximando o conviértela a efectiva anual; si solo hay mensual indícala como anual equivalente),
  "tipo": "una de: loan, mortgage, credit_card, leasing, other",
  "confianza": "alta" o "media" o "baja"
}

IMPORTANTE sobre la tasa: en Colombia las tarjetas suelen mostrar tasa mensual (~2%) y efectiva anual (~26-30%). Devuelve SIEMPRE la EFECTIVA ANUAL. Si no estás seguro, pon confianza "media" o "baja".
Si no puedes leer algo, pon null. El saldo es el total pendiente, no el pago mínimo. Montos en COP.`;

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
      : type === "deuda"
      ? promptDeuda
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

    // PDFs usan bloque "document"; imágenes usan bloque "image".
    const fileBlock = esPDF
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image } }
      : { type: "image", source: { type: "base64", media_type: mt, data: image } };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            fileBlock,
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const data = await r.json();

    // Si la API respondió con error (PDF no soportado, tamaño, etc.), propagarlo
    // en vez de tragárselo — antes el frontend siempre decía "no se pudo leer".
    if (!r.ok || data.type === "error") {
      const apiMsg = data?.error?.message || `API status ${r.status}`;
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: apiMsg }) };
    }

    const text = (data.content || []).map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: parsed }) };
    } catch {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, raw: text, error: "No se pudo interpretar el documento" }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
