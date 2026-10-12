// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · ai-chat — Asesor IA (CO en español, US en inglés)
//
// 11-oct-2026 — Arreglo del asesor tras la revisión de QA en producción:
//  · El prompt ya no lleva base de conocimiento con tasas de mercado ni
//    topes tributarios, y tiene reglas explícitas: no inventar datos, no
//    nombrar productos ni dar cifras de impuestos, no prometer, no dar
//    órdenes, tutear siempre. Ver _asesorIA.cjs.
//  · Cuota real en el servidor: el límite de "15 diarias" vivía en memoria
//    de la función (se reiniciaba en cada arranque en frío) y en el
//    localStorage del navegador (se reiniciaba al recargar). Ahora descuenta
//    de la cuota mensual por plan de _cuotaIA (tabla ai_usage, atómica), la
//    misma que ya usan las lecturas de documentos con IA.
//  · max_tokens con margen y, si aun así se corta, la respuesta termina en
//    la última frase completa con una nota (antes: "RESPUESTA DIRECTA: El g").
// ════════════════════════════════════════════════════════════════════════════

const {
  MAX_TOKENS, construirPromptSistema, limpiarMensajes, recortarRespuesta, resumenCuota, mensajeCuotaAsesor,
} = require("./_asesorIA.cjs");

const MODELO = "claude-sonnet-4-5-20250929";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "peticion_invalida", mensaje: "No pude leer la consulta." }) }; }
  const { messages, financialContext, jurisdiction, taxConfig, accion } = body || {};
  const idioma = jurisdiction === "US" ? "en" : "es";

  try {
    // 28-sep-2026: sin sesión no hay IA. El userId del body ya no decide nada.
    const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    if (!quien) return sinSesion(headers, idioma === "en" ? "Sign in to use the AI Advisor." : "Inicia sesión para usar el Asesor IA.");
    const userId = quien.id;

    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const { consumirCuota, leerPlanIA, consultarUsos, topeDe } = require("./_cuotaIA.cjs");
    const plan = await leerPlanIA({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });

    // Contador al abrir el asesor: lee sin consumir. Reemplaza al contador de
    // localStorage, que volvía a 15 en cada recarga.
    if (accion === "cuota") {
      const tope = topeDe(plan);
      const usos = await consultarUsos({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });
      const restantes = usos === null ? null : Math.max(0, tope - usos);
      return { statusCode: 200, headers, body: JSON.stringify({ restantes, tope }) };
    }

    const mensajes = limpiarMensajes(messages);
    if (!mensajes.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "mensajes_invalidos", mensaje: idioma === "en" ? "Write a question." : "Escribe una pregunta." }) };
    }

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "config", mensaje: "El asesor no está disponible en este momento." }) };
    }

    // Cuota mensual por plan (atómica en Supabase). Sin límite diario aparte:
    // el tope mensual ya acota el costo por persona y un límite diario solo
    // frenaría a quien hace varias preguntas seguidas en una misma sesión.
    const cuota = resumenCuota(await consumirCuota({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId, plan }));
    if (!cuota.permitido) {
      return {
        statusCode: 429, headers,
        body: JSON.stringify({ error: "cuota_ia_agotada", mensaje: mensajeCuotaAsesor({ tope: cuota.tope, plan, idioma }), restantes: 0, tope: cuota.tope }),
      };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        system: construirPromptSistema({ jurisdiction, financialContext, taxConfig }),
        messages: mensajes,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      console.error("[ai-chat] Anthropic", res.status, data?.error?.type || "", data?.error?.message || "");
      return {
        statusCode: 502, headers,
        body: JSON.stringify({ error: "ia_no_disponible", mensaje: idioma === "en" ? "I couldn't answer right now. Please try again in a moment." : "Ahora no pude responder. Intenta de nuevo en un momento.", restantes: cuota.restantes, tope: cuota.tope }),
      };
    }

    const crudo = (data.content || []).map((b) => b.text || "").join("");
    const { texto, recortada } = recortarRespuesta(crudo, data.stop_reason, idioma);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ reply: texto || (idioma === "en" ? "No answer." : "Sin respuesta."), recortada, restantes: cuota.restantes, tope: cuota.tope }),
    };
  } catch (e) {
    console.error("[ai-chat] error", e?.message || e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "error_interno", mensaje: idioma === "en" ? "Something went wrong. Please try again." : "Algo salió mal. Intenta de nuevo." }) };
  }
};
