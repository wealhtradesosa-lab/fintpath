// ═══════════════════════════════════════════════════════════════════════════
// LandingAIAdvisorSection.jsx · Sesión 1-may-2026
//
// Rediseño de la sección "AI Advisor" del landing siguiendo principios de
// agencia de marketing premium (lo que v0.dev habría generado).
//
// Cambios vs versión anterior:
//   - De "lista de bullets + Q&A boxes" → conversación real estilo iMessage
//   - Avatar del asesor con online indicator
//   - Typing animation y mensaje "AI escribiendo..." (sensación viva)
//   - Glow lateral y glassmorphism en lugar de fondo sólido
//   - 3 capabilities clave en vez de 6 bullets (foco > exhaustividad)
//   - CTA más confiado, sin precio (eso ya está abajo en pricing)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa", cyan: "#22d3ee",
  pink: "#ec4899",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

// Conversación de ejemplo — Santi pregunta, IA responde con números reales
const CHAT = [
  { from: "user", text: "¿Cuánto pago de impuestos este año?", time: "14:32" },
  { from: "ai", text: "Tu saldo a cargo proyectado es **$53.8M** en F-210. Pero detecté **4 palancas legales** que pueden bajarlo a **$0** si tu situación las soporta.", time: "14:32" },
  { from: "user", text: "¿Cuáles?", time: "14:33" },
  { from: "ai", text: "1️⃣ Costos de tus arriendos (~$80M deducibles)\n2️⃣ Dividendos no gravados Art. 49 ET (~$20M)\n3️⃣ Descuento Art. 254 — impuestos USA Orlando (~$25M)\n4️⃣ Retenciones reales del año (~$35M)\n\nLas 4 son legales y bien soportadas. ¿Te explico una en detalle?", time: "14:33" },
];

export default function LandingAIAdvisorSection({ onGetStarted = () => {} }) {
  // Animación de aparición progresiva del chat (como si la conversación
  // se estuviera tipeando en vivo)
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    if (visibleMessages >= CHAT.length) return;
    const t = setTimeout(() => setVisibleMessages(prev => prev + 1), visibleMessages === 0 ? 300 : 800);
    return () => clearTimeout(t);
  }, [visibleMessages]);

  return (
    <section style={{
      position: "relative",
      padding: "100px 0",
      overflow: "hidden",
      background: T.bg,
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`,
    }}>
      <style>{`
        @keyframes msgIn { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes pulseDot { 0%, 100% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes typingBlink { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .msg-in { animation: msgIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .typing-dot:nth-child(1) { animation: typingBlink 1.4s ease-in-out infinite; }
        .typing-dot:nth-child(2) { animation: typingBlink 1.4s ease-in-out 0.2s infinite; }
        .typing-dot:nth-child(3) { animation: typingBlink 1.4s ease-in-out 0.4s infinite; }
      `}</style>

      {/* Glow lateral verde-azul */}
      <div style={{
        position: "absolute",
        top: "10%", right: "-10%",
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.green}15 0%, ${T.blue}08 40%, transparent 70%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: "0%", left: "-10%",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.purple}12 0%, transparent 70%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        zIndex: 2,
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 32px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 60,
        alignItems: "center",
      }}>
        {/* ─── COLUMNA IZQUIERDA: copy ─── */}
        <div>
          {/* Pill de feature */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: `linear-gradient(135deg, ${T.green}10, ${T.blue}10)`,
            border: `1px solid ${T.green}30`,
            borderRadius: 100,
            padding: "6px 14px",
            marginBottom: 24,
            fontSize: 12,
            color: T.green,
            fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 10px ${T.green}` }} />
            Asesor IA · Plan Pro
          </div>

          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            marginBottom: 20,
            color: T.txt,
          }}>
            Conversa con un{" "}
            <span style={{
              background: `linear-gradient(135deg, ${T.green}, ${T.cyan}, ${T.blue})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>family office privado</span>
            , 24/7.
          </h2>

          <p style={{
            fontSize: 17,
            color: T.txt2,
            lineHeight: 1.6,
            marginBottom: 32,
            maxWidth: 480,
          }}>
            Un asesor IA que conoce cada número de tu patrimonio. Le preguntas en lenguaje natural y te responde con datos reales y montos exactos.
          </p>

          {/* 3 capabilities clave (no 6) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
            {[
              {
                title: "Analiza tu patrimonio real",
                desc: "Lee tus ingresos, gastos, deudas, propiedades. No genérico — específico a vos.",
                icon: "📊",
                color: T.green,
              },
              {
                title: "Recomienda con números exactos",
                desc: "No dice 'considera invertir más'. Dice: 'aporta $4.2M a AFC y ahorra $1.6M de impuesto'.",
                icon: "🎯",
                color: T.blue,
              },
              {
                title: "Estrategias del contador, sin contador",
                desc: "Detecta palancas tributarias legales que un contador experto encontraría — pero a la mitad de costo.",
                icon: "🧾",
                color: T.purple,
              },
            ].map(cap => (
              <div key={cap.title} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: cap.color + "15",
                  border: `1px solid ${cap.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {cap.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2, fontFamily: FONT_DISPLAY }}>
                    {cap.title}
                  </div>
                  <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
                    {cap.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onGetStarted} style={{
            background: `linear-gradient(135deg, ${T.green}, ${T.blue})`,
            color: "#fff",
            border: "none",
            padding: "14px 28px",
            borderRadius: 100,
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: `0 8px 28px ${T.green}40`,
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 12px 36px ${T.green}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = `0 8px 28px ${T.green}40`;
            }}
          >
            Conversa con tu asesor IA →
          </button>
        </div>

        {/* ─── COLUMNA DERECHA: mockup chat ─── */}
        <div style={{ position: "relative" }}>
          {/* Glow detrás del chat */}
          <div style={{
            position: "absolute",
            inset: -30,
            background: `radial-gradient(ellipse, ${T.green}20, ${T.blue}15, transparent 70%)`,
            filter: "blur(50px)",
            pointerEvents: "none",
          }} />

          {/* Card del chat */}
          <div style={{
            position: "relative",
            background: "rgba(20,20,24,0.7)",
            backdropFilter: "blur(20px)",
            border: `1px solid ${T.borderStrong}`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            {/* Header del chat */}
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(0,0,0,0.2)",
            }}>
              {/* Avatar con gradient */}
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.green}, ${T.blue}, ${T.purple})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
                position: "relative",
              }}>
                🤖
                {/* Online indicator */}
                <div style={{
                  position: "absolute",
                  bottom: -2, right: -2,
                  width: 12, height: 12, borderRadius: "50%",
                  background: T.green,
                  border: `2px solid ${T.bg2}`,
                  boxShadow: `0 0 8px ${T.green}`,
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: FONT_DISPLAY }}>
                  Asesor FINPATHIA
                </div>
                <div style={{ fontSize: 11, color: T.green, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, animation: "pulseDot 2s ease-in-out infinite" }} />
                  En línea · Conoce tu patrimonio
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.txt3 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.txt3 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.txt3 }} />
              </div>
            </div>

            {/* Mensajes */}
            <div style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 380,
              maxHeight: 480,
              overflowY: "auto",
            }}>
              {CHAT.slice(0, visibleMessages).map((msg, i) => (
                <div
                  key={i}
                  className="msg-in"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.from === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    alignSelf: msg.from === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{
                    background: msg.from === "user"
                      ? `linear-gradient(135deg, ${T.blue}, ${T.purple})`
                      : "rgba(255,255,255,0.05)",
                    color: msg.from === "user" ? "#fff" : T.txt,
                    border: msg.from === "user" ? "none" : `1px solid ${T.border}`,
                    padding: "10px 14px",
                    borderRadius: 16,
                    borderBottomRightRadius: msg.from === "user" ? 4 : 16,
                    borderBottomLeftRadius: msg.from === "user" ? 16 : 4,
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-line",
                  }}>
                    {/* Soporta **negrita** simple */}
                    {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j} style={{ color: msg.from === "user" ? "#fff" : T.green, fontWeight: 700 }}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, padding: "0 4px" }}>
                    {msg.time}
                  </div>
                </div>
              ))}

              {/* Typing indicator después del último mensaje */}
              {visibleMessages > 0 && visibleMessages < CHAT.length && CHAT[visibleMessages].from === "ai" && (
                <div style={{
                  alignSelf: "flex-start",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  padding: "10px 14px",
                  borderRadius: 16,
                  borderBottomLeftRadius: 4,
                  display: "flex", gap: 4, alignItems: "center",
                }}>
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.txt3, display: "inline-block" }} />
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.txt3, display: "inline-block" }} />
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.txt3, display: "inline-block" }} />
                </div>
              )}
            </div>

            {/* Input simulado al fondo */}
            <div style={{
              padding: "12px 16px",
              borderTop: `1px solid ${T.border}`,
              background: "rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <div style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${T.border}`,
                borderRadius: 100,
                padding: "8px 16px",
                fontSize: 13,
                color: T.txt3,
              }}>
                Pregunta lo que sea sobre tu plata...
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `linear-gradient(135deg, ${T.green}, ${T.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 14,
              }}>
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack en mobile */}
      <style>{`
        @media (max-width: 880px) {
          section > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
      `}</style>
    </section>
  );
}
