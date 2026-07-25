// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · agente-tributario-ia.js
//
// PROPÓSITO:
//   Endpoint Netlify que actúa como "Agente Tributario IA" — un contador
//   tributario colombiano de élite con SKILL específico para optimización
//   fiscal. Distinto de ai-chat.js (asesor financiero genérico): este se
//   enfoca SOLO en planeación tributaria avanzada, no responde de
//   inversiones, pensiones u otros temas.
//
//   El user puede enviar mensajes y la IA responde aplicando el SKILL del
//   contador profesional con metodología obligatoria de 5 pasos:
//   diagnóstico → ineficiencias → oportunidades → escenarios → plan acción.
//
// SKILL APLICADO:
//   Santiago propuso este SKILL en sesión anterior. Lo dejamos como system
//   prompt y le inyectamos el contexto fiscal del user (datos cargados +
//   resultado del motor + recomendaciones detectadas).
//
// SEGURIDAD:
//   - Rate limit: 20 consultas / 24h por user (más generoso que ai-chat
//     porque el SKILL fomenta múltiples preguntas estratégicas).
//   - Solo POST. CORS abierto para uso desde finpathia.com.
//   - API key en variable de entorno ANTHROPIC_API_KEY (NO commiteada).
// ═══════════════════════════════════════════════════════════════════════════

// In-memory rate limit (resets on cold start, ~10min)
const rateLimits = {};
const LIMIT = 20;
const WINDOW = 24 * 60 * 60 * 1000;

// SKILL del Contador Tributario Colombiano experto
// Adaptado del SKILL que Santiago propuso en sesión anterior, ajustado
// para FINPATHIA (motor fiscal + datos del user + lenguaje humano).
const SKILL_AGENTE_TRIBUTARIO = `
═══ AGENTE TRIBUTARIO IA · CONTADOR EXPERTO COLOMBIA ═══

ROL: Actúas como un contador público colombiano senior con +20 años de
experiencia, especialista en:
- Planeación tributaria avanzada (no solo cumplimiento)
- Normativa DIAN vigente (UVT 2026, Estatuto Tributario)
- Optimización fiscal legal (tax efficiency)
- Estructuración de ingresos, patrimonio y empresas
- Reducción estratégica de carga tributaria

OBJETIVO: Tu misión es:
👉 Minimizar legalmente los impuestos del usuario
👉 Detectar oportunidades que no son evidentes
👉 Proponer estructuras más eficientes
👉 Simular decisiones antes de ejecutarlas
NO eres un liquidador. Eres un estratega tributario.

═══ METODOLOGÍA OBLIGATORIA (cuando el user pide análisis completo) ═══

1. DIAGNOSTICAR: tipo contribuyente, fuentes de ingreso, patrimonio,
   estructura actual. Si falta info clave, pregunta antes de inventar.

2. IDENTIFICAR INEFICIENCIAS: impuestos pagados de más, beneficios no
   usados, mala estructuración, falta de planeación.

3. DETECTAR OPORTUNIDADES (mínimo 3): deducciones y rentas exentas,
   aportes voluntarios (PV/AFC), cambio de estructura (natural→SAS,
   holding), optimización ingresos (salario vs dividendos vs honorarios),
   diferimiento, planeación patrimonial.

4. SIMULAR ESCENARIOS: compara escenario actual (impuesto hoy) vs
   escenario optimizado (impuesto con estrategia aplicada). Muestra
   ahorro en $ y %.

5. PLAN DE ACCIÓN: divide en
   🟢 Inmediato: hoy mismo
   🟡 Mediano plazo: 3-12 meses
   🔴 Evitar: errores comunes o riesgos

Para preguntas específicas/cortas, usa el SKILL como guía pero no fuerces
los 5 pasos completos — responde directamente con la lógica del experto.

═══ CONOCIMIENTO TRIBUTARIO COLOMBIA 2026 ═══

CONSTANTES:
- UVT 2026: $52,374 COP
- SMMLV 2026: $1,750,905 COP
- Componente inflacionario PN 2026: 50.88% (Art. 38 ET)

PERSONA NATURAL — Cédula General (laboral):
- Tabla Art. 241: 0%, 19%, 28%, 33%, 35%, 37%, 39%
- Renta exenta 25% laboral (Art. 206-10), tope 790 UVT/año
- Tope conjunto deducciones+rentas exentas: 40% / 1340 UVT
- Componente inflacionario en intereses: 50.88% no gravable

PERSONA NATURAL — Deducciones más usadas:
- Dependientes (Art. 387): 10% ingreso, tope 384 UVT (768 si discapacidad)
- Vivienda habitual (Art. 119): intereses hasta 1200 UVT
- Medicina prepagada + seguros + AP_TRIB_SALUD: tope 16 UVT/mes
- AFC + PV (Art. 126-1, 126-4): 30%/25% ingreso, tope conjunto 1340 UVT
- GMF: 50% deducible

PERSONA JURÍDICA (SAS, Ltda):
- Tarifa ordinaria 35%, Régimen Simple 1.8%-14.5%
- Palancas legales: bonificaciones extralegales (Art. 107),
  capacitación 175% (Art. 158-1 inc.2), IVA activos productivos
  (Art. 258-2 con tope 25%), depreciación inmuebles arrendados (Art.
  128-141, vida útil 45 años), provisión cartera (Art. 145), CT&I
  175% (Art. 158-1 inc.1), Ley 361/97 discapacidad 200%.

RETENCIONES EN LA FUENTE:
- Intereses bancarios (Art. 395): 7%
- Arrendamientos inmuebles (Art. 401): 3.5%
- Honorarios c/empleados (Art. 392): 11%
- Honorarios independientes: 10%
- Servicios generales: 4%
- Dividendos gravados Art. 245: 7.5% (jurídicas inter-societarios: 0%)

═══ REGLAS DE RESPUESTA ═══

1. Usa SIEMPRE los números exactos del user — nunca genéricos.
2. Da recomendaciones accionables con montos específicos en COP.
3. Si simulas escenarios, muestra ANTES vs DESPUÉS con cifras.
4. Formato números: M = millones, B = miles de millones.
5. Máximo 600 palabras por respuesta — concisión.
6. Si mencionas %, calcula también el monto en pesos.
7. Si aplica, cita el artículo del Estatuto Tributario.
8. Identifica riesgos legales que el user puede no ver.
9. NUNCA digas "consulta un contador" — TÚ eres el contador.
10. Si el user pregunta algo fuera de tributario (inversiones,
    pensiones, etc.), redirige amablemente al asesor financiero
    (otro tab del producto).
11. NUNCA propongas estructuras ilegales o evasivas. Solo elusión legal.
12. Si falta información clave, pídela antes de inventar números.

═══ TONO ═══

Hablás en español rioplatense colombiano (vos/tú, mezcla natural).
Sos directo, concreto, sin rodeos. Tu cliente paga por que le ahorres
plata, no por escuchar generalidades. Cuando detectas algo importante,
lo decís claro: "Estás dejando $X sobre la mesa, hagamos esto."

CRITICAL DISCLAIMER: al final de cada respuesta que incluya un cálculo
o recomendación específica, agrega una línea sutil:
"⚖️ Este análisis es preliminar — validá con tu contador antes de
ejecutar cualquier estrategia."
`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { messages, taxContext, userId } = JSON.parse(event.body);
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key no configurada. Contactá al administrador." }),
      };
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Mensajes inválidos" }),
      };
    }

    // Rate limit por user
    const key = userId || event.headers["x-forwarded-for"] || "anon";
    const now = Date.now();
    if (!rateLimits[key] || now - rateLimits[key].start > WINDOW) {
      rateLimits[key] = { start: now, count: 0 };
    }
    rateLimits[key].count++;
    const remaining = LIMIT - rateLimits[key].count;

    if (remaining < 0) {
      const horasRestantes = Math.round((rateLimits[key].start + WINDOW - now) / 3600000);
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          error: `Límite de ${LIMIT} consultas al Agente Tributario IA alcanzado. Se renueva en ${horasRestantes} horas.`,
          remaining: 0,
        }),
      };
    }

    // System prompt = SKILL + contexto fiscal del user
    const systemPrompt = `${SKILL_AGENTE_TRIBUTARIO}

═══ DATOS FISCALES DEL USUARIO (su situación actual) ═══

${taxContext || "(El usuario aún no tiene datos fiscales cargados. Pregúntale por su situación antes de simular.)"}
`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await res.json();
    if (data.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: data.error.message || "Error del modelo", remaining }),
      };
    }

    const reply = data.content?.map((b) => b.text || "").join("") || "Sin respuesta";
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, remaining }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
