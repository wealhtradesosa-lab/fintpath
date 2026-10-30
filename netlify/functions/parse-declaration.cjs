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
    // 28-sep-2026: el userId venía en el body; ahora sale del token verificado.
    const { usuarioDesdeToken } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    const userId = quien?.id || null;
    if (!pdf) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el PDF en el body" }) };
    }

    // ── 26-jul-2026 — Mismo caso que analyze-image: endpoint abierto y sin
    // tope. Leer una declaración es de las llamadas más caras (PDF completo),
    // así que era el agujero con mayor costo por abuso.
    const { consumirCuota, mensajeCuota } = require("./_cuotaIA.cjs");
    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!userId) {
      return { statusCode: 401, headers, body: JSON.stringify({
        error: "sesion_requerida",
        mensaje: "Inicia sesión para leer documentos con IA.",
      }) };
    }
    if (SUPA_URL && SERVICE_KEY) {
      const cuota = await consumirCuota({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });
      if (!cuota.permitido) {
        return { statusCode: 429, headers, body: JSON.stringify(mensajeCuota(cuota)) };
      }
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
  "nit": "solo el número de identificación de la casilla 5 (NIT o cédula), SIN el dígito de verificación de la casilla 6, o null",
  "renglones": {
    "ingresosBrutos": número (TOTAL de ingresos brutos del año: la SUMA de todas las cédulas — rentas de trabajo (renglón 32), rentas de trabajo no laborales (43), rentas de capital (58), rentas no laborales (74), pensiones (99) y dividendos (104 + 107 + 108 + 109). NO tomes solo la primera columna),
    "ingresosTrabajo": número (ingresos brutos por rentas de trabajo: salarios y demás pagos laborales),
    "ingresosHonorarios": número (ingresos brutos por rentas de trabajo que no provienen de una relación laboral: honorarios, compensación por servicios personales),
    "ingresosCapital": número (ingresos brutos por rentas de capital: intereses, rendimientos financieros, arrendamientos, regalías),
    "ingresosNoLaborales": número (ingresos brutos por rentas no laborales),
    "ingresosPensiones": número (ingresos brutos por pensiones),
    "ingresosDividendos": número (total de ingresos por dividendos y participaciones, de todas sus subcédulas),
    "ingresosGananciaOcasional": número (ingresos por ganancias ocasionales),
    "ingresosNoConstitutivos": número (suma de los ingresos no constitutivos de renta de todas las cédulas),
    "costosNoLaborales": número (costos y deducciones procedentes de rentas no laborales y de capital),
    "dependientes": número (número de dependientes económicos, renglón 138),
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
    "anticipoAnoAnterior": número (anticipo de renta liquidado el año anterior, que se resta este año),
    "anticipoAnoSiguiente": número (anticipo de renta para el año gravable siguiente),
    "saldoPagar": número (si positivo: pagar; si saldo a favor, ponlo en negativo),
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
  "nit": "solo el NIT de la casilla 5, SIN el dígito de verificación (casilla 6), o null",
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
    "anticipoAnoAnterior": número (anticipo liquidado el año anterior, que se resta este año),
    "anticipoAnoSiguiente": número (anticipo de renta para el año gravable siguiente),
    "saldoPagar": número (Saldo a pagar. Si la declaración da "Total saldo a favor", ponlo NEGATIVO; nunca positivo)
  },
  "confianza": "alta" | "media" | "baja"
}

Reglas adicionales:
- En el F-210 los valores de "Patrimonio" están arriba: Total patrimonio bruto (29), Deudas (30), Total patrimonio líquido (31). Verifica que bruto − deudas = líquido.
- En el F-210, "impuestoCalculado" es el Impuesto neto de renta (126); "retefuente" son las Retenciones año gravable a declarar (132); "anticipoAnoSiguiente" es el renglón 133; "anticipoAnoAnterior" el 130; "saldoPagar" es el Saldo a pagar por impuesto (134), y si hay Total saldo a favor (137) ponlo como saldoPagar NEGATIVO.
- Si detectas que el documento NO es una declaración DIAN válida, responde:
  { "error": "El documento no parece una declaración DIAN válida" }
- Si el formulario es otro (F-490, F-350, etc.), responde:
  { "error": "Formulario no soportado: <tipo>" }
- El campo "confianza" debe ser "baja" si más de 5 renglones están en 0 (probable mala lectura),
  "media" si hay algunos en 0, "alta" si todo se lee bien.
${tipoHint && tipoHint !== "auto" ? `\n- El usuario indicó que el formulario es: ${tipoHint}. Usa ese formato si es consistente con el documento.` : ""}`;

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
