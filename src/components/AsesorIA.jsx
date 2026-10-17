import { useState, useRef, useEffect } from "react";
import { fetchAuth } from "../lib/apiFetch";
import Disclaimer from "./Disclaimer";
import { buildContext, normalizarMarkdown } from "../lib/asesorIA.js";
import { SimToggleInfoCompact } from "./SimToggleInfo";
import PageHeader from "./PageHeader.jsx";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  bl: "#3b82f6", rd: "#ef4444",
};

// 11-oct-2026: sugerencias que se responden con los datos cargados, sin
// prometer plazos ("independencia en 3 años") ni suponer edad o metas.
const SUGGESTIONS = [
  "¿Qué gasto me está frenando para subir de nivel?",
  "¿Qué deuda me conviene pagar primero?",
  "¿Cuántos meses de gastos debería tener ahorrados?",
  "¿Debería pagar deudas o invertir más?",
  "Dame 3 opciones para mejorar mi flujo de caja",
  "¿Dónde tengo más riesgo concentrado?",
];

/**
 * renderMD — Formato mínimo para las respuestas del asesor.
 *
 * 26-jul-2026. El modelo responde en markdown y se mostraba crudo:
 *   "### 🏠 **VIVIENDA: $18.666.667/mes (29%)**"
 * Se convierten solo encabezados, negritas y viñetas. No se trae una librería
 * de markdown para esto: son tres patrones y el bundle ya pesa bastante.
 * 11-oct-2026: las tablas y los bloques de código se normalizan antes
 * (normalizarMarkdown); antes se veían los "| --- |" crudos.
 */
function renderMD(txt) {
  const negritas = (s) => {
    const partes = String(s).split(/\*\*(.+?)\*\*/g);
    return partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
  };
  return normalizarMarkdown(txt).split("\n").map((linea, i) => {
    const l = linea.trimEnd();
    if (!l.trim()) return <div key={i} style={{ height: 8 }} />;
    if (/^#{1,6}\s/.test(l)) {
      return <div key={i} style={{ fontSize: 14, fontWeight: 800, margin: "14px 0 6px", color: "inherit" }}>
        {negritas(l.replace(/^#{1,6}\s*/, ""))}
      </div>;
    }
    if (/^[-*]\s/.test(l.trim())) {
      return <div key={i} style={{ display: "flex", gap: 8, marginLeft: 4, marginBottom: 3 }}>
        <span style={{ opacity: 0.45, flexShrink: 0 }}>·</span>
        <span>{negritas(l.trim().replace(/^[-*]\s*/, ""))}</span>
      </div>;
    }
    return <div key={i} style={{ marginBottom: 3 }}>{negritas(l)}</div>;
  });
}

export default function AsesorIA({ user, totals }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 11-oct-2026: el contador sale del servidor (cuota mensual por plan en
  // Supabase, compartida con las lecturas de documentos con IA). El de
  // localStorage ("15 consultas restantes hoy") volvía a 15 al recargar y no
  // limitaba nada. null = todavía no se sabe: no se muestra.
  const [restantes, setRestantes] = useState(null);
  useEffect(() => {
    try { localStorage.removeItem("fp3_ai_usage"); } catch { /* sin storage */ }
    let vivo = true;
    fetchAuth("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "cuota" }),
    })
      .then((r) => r.json())
      .then((d) => { if (vivo && typeof d?.restantes === "number") setRestantes(d.restantes); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, loading]);

  const send = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setError("");

    const newMsgs = [...msgs, { role: "user", content: q }];
    setMsgs(newMsgs);
    setLoading(true);

    try {
      const ctx = buildContext(user, totals);
      // Sesión 4-may-2026: enviar jurisdiction al endpoint para que el system
      // prompt y la knowledge base sean correctas (CO vs US). Los users US
      // tienen 401k/IRA/Roth/HSA, los CO tienen Colpensiones/RAIS/UVT.
      const jurisdiction = user?.jurisdiction === "US" ? "US" : "CO";
      const taxConfig = user?.taxConfig || null;
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));

      const res = await fetchAuth("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs, financialContext: ctx, jurisdiction, taxConfig }),
      });

      const data = await res.json();
      if (typeof data?.restantes === "number") setRestantes(data.restantes);
      if (data.error || !res.ok) {
        setError(data.mensaje || "Ahora no pude responder. Intenta de nuevo en un momento.");
      } else {
        setMsgs([...newMsgs, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setError("No hay conexión. Revisa tu internet e intenta de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        label="Asesor IA"
        title="Conversa con tu family office"
        subtitle="Análisis de tus datos encendidos y recomendaciones personalizadas con datos reales."
        rightSlot={<>
          {restantes !== null && (
            <span title="Incluye las preguntas al asesor y las lecturas de documentos con IA. Se renuevan el 1 de cada mes." style={{fontSize:11,color:restantes<=5?"#ef4444":"#71717a",background:"#1e1e24",padding:"6px 12px",borderRadius:999}}>{restantes === 1 ? "1 consulta con IA este mes" : restantes + " consultas con IA este mes"}</span>
          )}
          {msgs.length > 0 && (
            <button onClick={() => setMsgs([])} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt3, padding: "8px 16px", borderRadius: 999, cursor: "pointer", fontSize: 12 }}>Nueva consulta</button>
          )}
        </>}
      />

      {/* Aviso: items apagados no se incluyen en el análisis IA */}
      <SimToggleInfoCompact />

      {/* Chat area */}
      <div ref={chatRef} style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, height: msgs.length > 0 ? 440 : "auto", overflowY: "auto", marginBottom: 16, padding: msgs.length > 0 ? 16 : 0 }}>
        {msgs.length === 0 ? (
          <div style={{ padding: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🧠</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>¿Qué quieres analizar?</div>
              <div style={{ fontSize: 13, color: T.txt3 }}>El asesor usa solo los datos que tienes encendidos</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: T.bg3, border: "1px solid " + T.border, borderRadius: 10,
                  padding: "12px 14px", cursor: "pointer", textAlign: "left",
                  color: T.txt2, fontSize: 12, lineHeight: 1.4, transition: "border-color 0.2s",
                }} onMouseOver={e => e.currentTarget.style.borderColor = T.gn}
                   onMouseOut={e => e.currentTarget.style.borderColor = T.border}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.gnD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>}
              <div style={{
                // 26-jul-2026 (Santiago: "la ventana del chat es muy angosta, le toca a uno mover el
                // cursor para ver las respuestas"). El 80% sirve para la burbuja del USUARIO
                // —marca que es suya—, pero castiga la del ASESOR, que devuelve análisis
                // largos con listas y cifras: en pantalla ancha quedaba media pantalla vacía.
                maxWidth: m.role === "user" ? "80%" : "100%", flex: m.role === "user" ? "0 1 auto" : "1 1 auto", padding: "12px 16px", borderRadius: m.role === "user" ? "14px 14px 0 14px" : "0 14px 14px 14px",
                background: m.role === "user" ? T.bl + "20" : T.bg3,
                border: "1px solid " + (m.role === "user" ? T.bl + "30" : T.border),
                fontSize: 13, lineHeight: 1.7, color: T.txt, whiteSpace: m.role === "user" ? "pre-wrap" : "normal", wordBreak: "break-word",
              }}>
                {m.role === "assistant" ? renderMD(m.content) : m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.gnD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ padding: "12px 16px", borderRadius: "0 14px 14px 14px", background: T.bg3, border: "1px solid " + T.border, fontSize: 13, color: T.txt3 }}>
              Analizando tus datos<span style={{ animation: "blink 1.2s infinite" }}>...</span>
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 12, color: T.rd, marginBottom: 10 }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Pregunta sobre tus finanzas..."
          style={{
            flex: 1, background: T.bg3, border: "1px solid " + T.border, borderRadius: 12,
            padding: "14px 16px", color: T.txt, fontSize: 14, outline: "none",
          }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim() || restantes === 0} style={{
          background: loading ? T.bg3 : T.gn, color: loading ? T.txt3 : "#000",
          border: "none", borderRadius: 12, padding: "14px 24px", cursor: loading ? "default" : "pointer",
          fontWeight: 700, fontSize: 14, transition: "all 0.2s",
        }}>
          {loading ? "..." : "Enviar"}
        </button>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    
      <Disclaimer variante="ia" idioma="es" T={T} />
      </div>
  );
}
// build 1775391859
