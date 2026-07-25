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
  "nombre": "nombre del crédito o entidad (ej. Tarjeta Visa Bancolombia, Crédito Consumo Sufi)",
  "saldo": número (SALDO DE CAPITAL PENDIENTE en COP, sin puntos ni comas),
  "cuota": número (cuota o pago mensual en COP),
  "tasa": número o null (ver reglas abajo),
  "tipo": "una de: loan, mortgage, credit_card, leasing, other",
  "confianza": "alta" o "media" o "baja"
}

REGLAS ESTRICTAS PARA LA TASA — NO CALCULES NADA:
- Copiá TEXTUALMENTE el número de la tasa EFECTIVA ANUAL (E.A.) que aparece impreso en el documento. Es un valor a transcribir, NO a deducir.
- PROHIBIDO calcular, multiplicar, anualizar o convertir tasas. Si el documento no imprime una tasa E.A., devolvé "tasa": null y "confianza": "baja". Es preferible null a un número deducido.
- Si hay VARIAS tasas, usá SIEMPRE la tasa de interés corriente/remuneratoria. NUNCA uses la tasa de MORA (interés moratorio), aunque también diga E.A.
- Ejemplo: si dice "Tasa de interés E.A. 22.99%" y "Tasa interés de mora E.A. 28.34%", la respuesta correcta es 22.99.
- El separador decimal colombiano es la coma: "20,41%" significa 20.41.

REGLAS PARA EL SALDO:
- Usá el SALDO DE CAPITAL PENDIENTE (lo que aún se debe), NO el monto desembolsado/original del crédito ni el pago mínimo.
- Ejemplo: si dice "Monto desembolsado $260.000.000" y "Saldo de capital pendiente $130.308.044", la respuesta correcta es 130308044.18.

REGLAS PARA LA CUOTA — buscá la cuota HABITUAL, no un pago atípico:
- La cuota que sirve es la RECURRENTE (capital + intereses), porque con ella se calcula en cuánto tiempo se paga la deuda.
- CUIDADO: si el cliente hizo un abono extraordinario a capital, el "valor próximo pago" queda anormalmente bajo (a veces solo intereses). Señal de alerta: que ese próximo pago traiga "abono a capital" en $0, o que sea igual al renglón de intereses corrientes. En ese caso NO lo uses.
- Cuando el próximo pago esté distorsionado así, usá la cuota del PERIODO ANTERIOR sumando abono a capital + intereses corrientes.
- Excluí del valor los SEGUROS y otros cobros: no reducen la deuda. Si el pago total los incluye, restalos.
- Ejemplo: si el mes anterior muestra abono a capital $2.113.941,87 + intereses corrientes $2.296.185,93 + seguros $522.973 = pago total $4.933.100,80, y el próximo pago es $1.058.101,38 con abono a capital $0, la cuota correcta es 4410127.80 (capital + intereses, sin seguros).
- Si usaste el periodo anterior por esta razón, poné "confianza": "media".

Si no podés leer un dato con certeza, poné null y bajá la confianza. Nunca inventes ni estimes. Montos en COP.`;

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
