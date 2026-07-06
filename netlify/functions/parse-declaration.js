// ═══════════════════════════════════════════════════════════════════════════
// POST /api/parse-declaration
// ─────────────────────────────────────────────────────────────────────────
// Recibe un PDF de declaración de renta DIAN (F-210 persona natural o
// F-110 persona jurídica) y devuelve los renglones extraídos como JSON
// estructurado listo para guardarse en owner.declaracionAnterior.
//
// El motor de taxCO / normalize consume este shape para:
//   · Alertas de descuentos tributarios no capturados (jurídica).
//   · Alertas de aportes voluntarios no capturados (natural).
//   · Futuras comparaciones año-sobre-año.
// ═══════════════════════════════════════════════════════════════════════════

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
    if (!ANTHROPIC_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada" }) };
    }

    const { pdf, tipoHint } = JSON.parse(event.body || "{}");
    if (!pdf) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el PDF en el body" }) };
    }

    // Hard limit: Netlify functions permiten hasta 6MB de body. Un PDF base64 típico
    // de declaración DIAN está entre 100KB-2MB, así que dejamos margen.
    const sizeBytes = (pdf.length * 3) / 4;
    if (sizeBytes > 5 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({ error: "El PDF es demasiado grande. Máximo 5MB." }),
      };
    }

    const prompt = `Analiza este PDF de una declaración de renta oficial de la DIAN (Colombia).

Puede ser uno de dos formularios:
- Formulario 210: persona natural (empleados, independientes, rentistas).
- Formulario 110: persona jurídica (SAS, LTDA, etc).

Extrae los campos relevantes y responde SOLO con JSON válido, sin markdown ni backticks.
Todos los montos en COP (pesos colombianos) como números enteros sin puntos ni comas.
Si un renglón no aparece en el documento o no aplica, pon 0 (no null).

Formato de respuesta para F-210 (natural):
{
  "tipo": "F210",
  "anoGravable": número (ej: 2024),
  "nombreContribuyente": "nombre completo o null",
  "nit": "NIT/cédula o null",
  "renglones": {
    "ingresosBrutos": número (total de ingresos del año),
    "ingresosNoConstitutivos": número (aportes obligatorios a salud/pensión del empleado, etc.),
    "ingresosNetos": número,
    "rentaExenta25": número (el 25% exento laboral, Art. 206 #10 ET),
    "deducIntereses": número (intereses vivienda, Art. 119 ET),
    "deducMedicina": número (medicina prepagada, Art. 387 #2),
    "deducDependientes": número (Art. 387 parr 2),
    "pvAFC": número (pensión voluntaria + AFC, Arts. 126-1 y 126-4),
    "patrimonioBruto": número,
    "deudas": número,
    "patrimonioLiquido": número,
    "impuestoCalculado": número (renglón impuesto sobre renta líquida gravable),
    "retefuente": número (retenciones practicadas al contribuyente),
    "saldoPagar": número (si positivo: pagar; si saldo a favor, ponelo en negativo),
    "descDonaciones": número (descuentos por donaciones art 257 ET),
    "descCTI": número (ciencia/tecnología/innovación art 256 ET)
  },
  "confianza": "alta" | "media" | "baja"
}

Formato de respuesta para F-110 (jurídica):
{
  "tipo": "F110",
  "anoGravable": número,
  "nombreContribuyente": "razón social o null",
  "nit": "NIT o null",
  "renglones": {
    "ingresosBrutos": número,
    "ingresosNoConstitutivos": número,
    "costosDeducciones": número,
    "rentaLiquida": número,
    "rentaExenta": número,
    "rentaLiquidaGravable": número,
    "patrimonioBruto": número,
    "deudas": número,
    "patrimonioLiquido": número,
    "impuestoCalculado": número,
    "descICA": número (descuento 50% ICA pagado, Art. 115 ET),
    "descCree": número,
    "descDonaciones": número (Art. 257),
    "descCTI": número (Art. 256),
    "impuestoNeto": número (después de descuentos),
    "autorretencion": número,
    "saldoPagar": número
  },
  "confianza": "alta" | "media" | "baja"
}

Reglas adicionales:
- Si detectas que el documento NO es una declaración DIAN válida, responde:
  { "error": "El documento no parece una declaración DIAN válida" }
- Si el formulario es otro (F-490, F-350, etc.), responde:
  { "error": "Formulario no soportado: <tipo>" }
- El campo "confianza" debe ser "baja" si más de 5 renglones están en 0 (probable mala lectura),
  "media" si hay algunos en 0, "alta" si todo se lee bien.
${tipoHint && tipoHint !== "auto" ? `\n- El usuario indicó que el formulario es: ${tipoHint}. Usá ese formato si es consistente con el documento.` : ""}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Upstream error", detail: errBody.slice(0, 500) }),
      };
    }

    const data = await r.json();
    const text = (data.content || []).map((c) => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, raw: text.slice(0, 1000), error: "Respuesta del modelo no es JSON válido" }),
      };
    }

    // Si la IA detectó un error explícito en el documento, reenviar como error de app
    if (parsed.error) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: parsed.error }) };
    }

    // Validación estructural mínima
    if (!parsed.tipo || !["F110", "F210"].includes(parsed.tipo) || !parsed.renglones) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, error: "Respuesta del modelo incompleta", raw: parsed }),
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: parsed }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
