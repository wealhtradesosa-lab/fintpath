// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · ChatAgenteTributario.jsx
//
// PROPÓSITO:
//   UI de chat con el Agente Tributario IA (contador profesional con SKILL).
//   Distinto del AsesorIA genérico: este se enfoca SOLO en preguntas
//   tributarias, con contexto fiscal del user inyectado al system prompt.
//
//   Se invoca desde la pantalla amigable (paso 2 "Auditor IA") cuando el
//   user clickea "Hablar con la IA".
//
// FUNCIONAMIENTO:
//   - Usuario escribe pregunta o elige una sugerencia preconstruida
//   - Frontend POST a /api/agente-tributario-ia con messages + taxContext
//   - Backend invoca Claude API con SKILL como system prompt
//   - Renderiza respuesta con formato (negritas, listas, etc.)
//   - Mantiene historial de conversación en state
//   - Rate limit de 20 consultas/24h por user (lo aplica el backend)
//
// PROPS:
//   - user: user object completo (para construir taxContext)
//   - estimacion: output de estimarImpuesto(user) (para enriquecer contexto)
//   - selectedOwner: el owner activo (para enfocar el contexto)
//   - userId: id del user autenticado (para rate limit)
//   - onCerrar: callback cuando el user cierra el chat
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";

// Paleta consistente con AgenteTributarioBienvenida (alto contraste)
const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  orange: "#fb923c",
  red: "#f87171",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
};

const fmt = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

// Sugerencias pre-construidas (foco tributario)
const SUGGESTIONS_GENERAL = [
  "¿Por qué pago tanto impuesto este año?",
  "¿Qué deducciones legales me faltan?",
  "Compárame estructura natural vs SAS",
  "Dame un plan de acción para optimizar este año",
];
const SUGGESTIONS_NATURAL = [
  "¿Cuánto ahorraría aportando $1M/mes a Pensión Voluntaria?",
  "¿Me conviene pagar medicina prepagada para deducir?",
  "¿Cómo funciona la deducción por dependientes?",
  "Si recibo arriendos, ¿qué retención me hacen?",
];
const SUGGESTIONS_JURIDICA = [
  "¿Mi SAS califica para Régimen Simple?",
  "¿Cómo deduzco la depreciación de los inmuebles arrendados?",
  "¿Qué palancas legales me faltan aplicar?",
  "Dame un escenario de optimización con cifras",
];

/**
 * Construye el contexto fiscal del user para inyectar al system prompt.
 * Este string lo lee la IA para personalizar todas sus respuestas.
 */
function buildTaxContext(user, estimacion, selectedOwner) {
  if (!user || !selectedOwner) return "(sin datos cargados todavía)";

  const fm = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");
  const det = estimacion?.detalle?.find((d) => d.name === selectedOwner.name);
  const isJur = selectedOwner.type === "juridica";

  let ctx = `OWNER ACTIVO: ${selectedOwner.name} (${isJur ? "persona jurídica" : "persona natural"})\n`;
  if (selectedOwner.regimen) ctx += `Régimen: ${selectedOwner.regimen}\n`;

  // Patrimonio aproximado
  const oInv = (user.inv || []).filter((i) => i.owner === selectedOwner.id && i.sim !== false);
  const patrimonioAprox = oInv.reduce((s, i) => s + (Number(i.va || i.valor || i.ubi || 0) * (i.moneda === "USD" ? (user.trm || 4200) : 1)), 0);
  if (patrimonioAprox > 0) ctx += `Patrimonio bruto aproximado: ${fm(patrimonioAprox)}\n`;

  // Ingresos
  const oIng = (user.ingresos || []).filter((i) => i.owner === selectedOwner.id && i.sim !== false);
  if (oIng.length > 0) {
    ctx += `\nINGRESOS (mensuales):\n`;
    oIng.forEach((i) => {
      const mon = i.moneda === "USD" ? " USD" : "";
      ctx += `• ${i.categoria || i.fiscalCode || "?"}: ${fm(i.mensual)}${mon}/mes\n`;
    });
  }

  // Gastos por categoría
  const gas = user.gas || {};
  const cats = Object.keys(gas).filter((cat) => (gas[cat] || []).some((g) => g.owner === selectedOwner.id && g.sim !== false));
  if (cats.length > 0) {
    ctx += `\nGASTOS (mensuales):\n`;
    cats.forEach((cat) => {
      const items = gas[cat].filter((g) => g.owner === selectedOwner.id && g.sim !== false);
      const total = items.reduce((s, g) => s + (Number(g.m) || 0), 0);
      ctx += `• ${cat}: ${fm(total)}/mes\n`;
    });
  }

  // Deudas
  const oDeu = (user.deu || []).filter((d) => d.owner === selectedOwner.id && d.sim !== false);
  if (oDeu.length > 0) {
    ctx += `\nDEUDAS:\n`;
    oDeu.forEach((d) => {
      ctx += `• ${d.nombre || d.fiscalCode}: saldo ${fm(d.saldo || d.s || d.mt)} a ${d.tasaAnual || d.t || d.ts || "?"}% anual\n`;
    });
  }

  // Resumen del cálculo fiscal
  if (det) {
    ctx += `\nCÁLCULO FISCAL ACTUAL (motor FINPATHIA):\n`;
    ctx += `• Ingreso anual: ${fm(det.ingreso)}\n`;
    ctx += `• Impuesto bruto: ${fm(det.impBruto || 0)}\n`;
    ctx += `• Retención automática: ${fm(det.retefuenteCalc || det.retefuenteNat || 0)}\n`;
    ctx += `• Saldo final a pagar: ${fm(det.impuesto || 0)}\n`;
    if (det.ingreso > 0) {
      const tasa = ((det.impuesto || 0) / det.ingreso * 100).toFixed(1);
      ctx += `• Tasa efectiva: ${tasa}%\n`;
    }
  }

  // Profile fiscal (dependientes, etc.)
  const profile = selectedOwner.fiscalProfile || {};
  if (profile.dependientes?.cantidad > 0) {
    ctx += `\nDEPENDIENTES: ${profile.dependientes.cantidad} ${profile.dependientes.conDiscapacidad ? "(con discapacidad)" : ""}\n`;
  }

  return ctx;
}

export default function ChatAgenteTributario({ user, estimacion, selectedOwner, userId, onCerrar }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll al final cuando llega un mensaje nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Sugerencias según tipo de owner
  const suggestions = !selectedOwner
    ? SUGGESTIONS_GENERAL
    : selectedOwner.type === "juridica"
    ? SUGGESTIONS_JURIDICA
    : SUGGESTIONS_NATURAL;

  const enviarMensaje = async (texto) => {
    const mensaje = (texto || input).trim();
    if (!mensaje || loading) return;

    setError(null);
    setInput("");
    const userMsg = { role: "user", content: mensaje };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const taxContext = buildTaxContext(user, estimacion, selectedOwner);
      const res = await fetch("/api/agente-tributario-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          taxContext,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Error desconocido");
        // Quitar el mensaje del user del historial si la API falló
        // (así el user puede reintentar sin duplicar)
        return;
      }
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch (e) {
      setError(e.message || "Error de red");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return (
    <div style={{ padding: "20px 0", maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 18,
          padding: "20px 24px",
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${C.purple}`,
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 36 }}>💬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              background: C.purpleBg,
              border: `1px solid ${C.purple}40`,
              borderRadius: 999,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: C.purple, letterSpacing: 0.5 }}>
              💬 CHAT · AGENTE TRIBUTARIO IA
            </span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
            Hablá con tu contador IA
          </h2>
          <p style={{ fontSize: 13, color: C.txt2, marginTop: 6, lineHeight: 1.5 }}>
            Conoce todos tus datos fiscales. Hacé preguntas en lenguaje natural y te
            responde con análisis específico para tu caso.
          </p>
        </div>
        {onCerrar && (
          <button
            onClick={onCerrar}
            style={{
              background: C.green,
              border: `1.5px solid ${C.green}`,
              color: "#000",
              padding: "10px 18px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            ← Volver al Auditor IA
          </button>
        )}
      </div>

      {/* Limit indicator */}
      {remaining !== null && (
        <div
          style={{
            marginBottom: 12,
            fontSize: 11,
            color: remaining < 5 ? C.orange : C.txt3,
            textAlign: "right",
          }}
        >
          Te quedan {remaining} consultas hoy
        </div>
      )}

      {/* Conversación */}
      <div
        ref={scrollRef}
        style={{
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "20px 20px",
          minHeight: 360,
          maxHeight: 560,
          overflowY: "auto",
          marginBottom: 14,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.txt, marginBottom: 8 }}>
              ¿Sobre qué querés que te asesore?
            </h3>
            <p style={{ fontSize: 13, color: C.txt2, marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
              Soy tu contador tributario IA. Conozco todos los datos que cargaste
              y tengo +20 años de experiencia en optimización fiscal Colombia. Hacéme
              cualquier pregunta sobre tu caso.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 580, margin: "0 auto" }}>
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => enviarMensaje(sug)}
                  disabled={loading}
                  style={{
                    padding: "12px 18px",
                    background: C.bg3,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    color: C.txt,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 13,
                    textAlign: "left",
                    fontWeight: 500,
                    lineHeight: 1.4,
                    transition: "all 0.15s",
                  }}
                  onMouseOver={(e) => {
                    if (!loading) e.currentTarget.style.borderColor = C.purple;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                  }}
                >
                  💡 {sug}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: C.purpleBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              🤖
            </div>
            <div
              style={{
                background: C.bg3,
                padding: "12px 16px",
                borderRadius: "0 12px 12px 12px",
                color: C.txt2,
                fontSize: 13,
                fontStyle: "italic",
              }}
            >
              <span className="dot-pulse">Analizando tus datos…</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(248,113,113,0.10)",
            border: `1px solid ${C.red}40`,
            borderRadius: 10,
            color: C.red,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu pregunta… (Enter para enviar, Shift+Enter para nueva línea)"
          rows={2}
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: 14,
            background: C.bg3,
            border: `1.5px solid ${C.border}`,
            borderRadius: 10,
            color: C.txt,
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.target.style.borderColor = C.purple)}
          onBlur={(e) => (e.target.style.borderColor = C.border)}
        />
        <button
          onClick={() => enviarMensaje()}
          disabled={loading || !input.trim()}
          style={{
            padding: "12px 22px",
            background: loading || !input.trim() ? C.bg3 : C.purple,
            border: "none",
            borderRadius: 10,
            color: loading || !input.trim() ? C.txt3 : "#000",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "..." : "Enviar →"}
        </button>
      </div>

      {/* Disclaimer al pie */}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          fontSize: 11,
          color: C.txt3,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        ⚖️ Este chat usa IA para análisis preliminar. Las recomendaciones deben ser
        validadas por tu contador antes de ejecutar cualquier estrategia. FINPATHIA
        no se responsabiliza por decisiones tomadas exclusivamente con base en estos
        análisis.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponente: render del mensaje (con formato básico)
// ─────────────────────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginBottom: 14,
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isUser ? C.blueBg : C.purpleBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {isUser ? "👤" : "🤖"}
      </div>
      <div
        style={{
          maxWidth: "78%",
          background: isUser ? C.blueBg : C.bg3,
          padding: "12px 16px",
          borderRadius: isUser ? "12px 12px 0 12px" : "12px 12px 12px 0",
          border: `1px solid ${isUser ? C.blue + "30" : C.border}`,
          color: C.txt,
          fontSize: 13.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {/* Render simple con bold y listas básicas */}
        <FormatoBasico texto={message.content} />
      </div>
    </div>
  );
}

/**
 * Formatea texto plano con soporte mínimo:
 * - **negrita** → <strong>
 * - listas con • o -  → mantener como están
 * - separar párrafos por doble newline
 */
function FormatoBasico({ texto }) {
  if (!texto) return null;
  // Split por **bold** y resto
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {partes.map((parte, i) => {
        const m = parte.match(/^\*\*([^*]+)\*\*$/);
        if (m) {
          return (
            <strong key={i} style={{ color: C.txt }}>
              {m[1]}
            </strong>
          );
        }
        return <span key={i}>{parte}</span>;
      })}
    </>
  );
}
