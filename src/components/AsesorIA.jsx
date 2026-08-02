import { useState, useRef, useEffect } from "react";
import { montoPromedioMensual } from "../lib/flowHelpers.js";
import { SimToggleInfoCompact } from "./SimToggleInfo";
import PageHeader from "./PageHeader.jsx";

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  bl: "#3b82f6", rd: "#ef4444",
};

const SUGGESTIONS = [
  "¿Cómo puedo alcanzar independencia financiera en 3 años?",
  "¿Dónde tengo más riesgo concentrado?",
  "¿Debería pagar deudas o invertir más?",
  "Genera 3 escenarios para mejorar mi cash flow",
  "¿Qué gastos puedo recortar para ahorrar $5M/mes?",
  "¿Cuánto necesito para retirarme a los 55?",
];

function buildContext(user, totals) {
  const u = user || {};
  const t = totals || {};
  const fm = n => "$" + Math.round(n || 0).toLocaleString("es-CO");
  const pc = n => (n || 0).toFixed(1) + "%";

  let ctx = `RESUMEN PATRIMONIAL:
• Patrimonio neto: ${fm(t.nw)}
• Ingresos netos: ${fm(t.ni)}/mes
• Gastos familiares: ${fm(t.gfm)}/mes
• Cuotas deudas: ${fm(t.tc)}/mes
• Egresos totales: ${fm(t.te)}/mes
• Cash flow: ${fm(t.cf)}/mes
• Índice independencia: ${pc(t.ind)}
• Deuda total: ${fm(t.td)}
• Deuda/Activos: ${pc(t.dta)}
`;

  // Inversiones
  if ((u.inv || []).length > 0) {
    ctx += "\nINVERSIONES:\n";
    (u.inv || []).forEach(i => {
      ctx += `• ${i.n || i.nombre || "?"}: ${fm(i.va)} (tipo: ${i.tp || i.tipo || "?"})${i.vc ? " costo: " + fm(i.vc) : ""}\n`;
    });
  }

  // Ingresos
  if ((u.ingresos || []).length > 0) {
    ctx += "\nINGRESOS MENSUALES:\n";
    (u.ingresos || []).forEach(i => {
      const mon = i.moneda === "USD" ? " (USD)" : "";
      ctx += `• ${i.nombre || "?"}: ${fm(i.mensual)}/mes${mon} (${i.categoria || "?"})${i.capital ? " capital: " + fm(i.capital) + " tasa: " + i.tasa + "%" : ""}\n`;
    });
  }

  // Gastos
  const gas = u.gas || {};
  if (Object.keys(gas).length > 0) {
    ctx += "\nGASTOS POR CATEGORÍA:\n";
    Object.entries(gas).forEach(([cat, items]) => {
      // 25-jul-2026 — DOS BUGS EN UNA LÍNEA:
      //  · sumaba `g.m` crudo y lo rotulaba "/mes". Un gasto ANUAL entraba al
      //    contexto de la IA con su valor de año entero declarado como mensual
      //    (caso real: Seguros anuales de $27,6M informados como $30,8M/mes).
      //    El asesor razonaba y recomendaba sobre cifras infladas hasta 12x.
      //  · no filtraba sim!==false, así que incluía ítems que el usuario había
      //    apagado — contra la regla de que lo apagado no existe para ningún
      //    cálculo, contexto ni análisis.
      const activos = (items || []).filter(g => g.sim !== false);
      if (!activos.length) return;
      const total = activos.reduce((s, g) => s + montoPromedioMensual(g), 0);
      ctx += `• ${cat}: ${fm(total)}/mes (${activos.length} items)\n`;
    });
  }

  // Deudas
  if ((u.deu || []).length > 0) {
    ctx += "\nDEUDAS:\n";
    (u.deu || []).filter(d => (d.mt || 0) > 0).forEach(d => {
      ctx += `• ${d.n || d.nombre || "?"}: saldo ${fm(d.mt)}, cuota ${fm(d.pg || d.pago)}/mes, tasa ${d.ts || 0}%\n`;
    });
  }

  return ctx;
}


/**
 * renderMD — Formato mínimo para las respuestas del asesor.
 *
 * 26-jul-2026. El modelo responde en markdown y se mostraba crudo:
 *   "### 🏠 **VIVIENDA: $18.666.667/mes (29%)**"
 * Se convierten solo encabezados, negritas y viñetas. No se trae una librería
 * de markdown para esto: son tres patrones y el bundle ya pesa bastante.
 */
function renderMD(txt) {
  const negritas = (s) => {
    const partes = String(s).split(/\*\*(.+?)\*\*/g);
    return partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
  };
  return String(txt || "").split("\n").map((linea, i) => {
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

export default function AsesorIA({ user, totals, userId }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const DAILY_LIMIT = 15;
  const getUsage = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("fp3_ai_usage") || "{}");
      const today = new Date().toISOString().split("T")[0];
      if (stored.date !== today) return { date: today, count: 0 };
      return stored;
    } catch { return { date: new Date().toISOString().split("T")[0], count: 0 }; }
  };
  const [remaining, setRemaining] = useState(() => {
    const usage = getUsage();
    return Math.max(0, DAILY_LIMIT - usage.count);
  });
  const trackUsage = () => {
    const usage = getUsage();
    usage.count++;
    localStorage.setItem("fp3_ai_usage", JSON.stringify(usage));
    setRemaining(Math.max(0, DAILY_LIMIT - usage.count));
    return usage.count <= DAILY_LIMIT;
  };
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
    if (remaining <= 0) {
      setError("Has alcanzado el límite de " + DAILY_LIMIT + " consultas diarias. Se renueva mañana.");
      return;
    }
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

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs, financialContext: ctx, userId: userId || "anon", jurisdiction, taxConfig }),
      });

      const data = await res.json();
      trackUsage();
      if (data.error) {
        setError(data.error);
      } else {
        setMsgs([...newMsgs, { role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setError("Error de conexión: " + e.message);
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
          <span style={{fontSize:11,color:remaining<=5?"#ef4444":"#71717a",background:"#1e1e24",padding:"6px 12px",borderRadius:100}}>{remaining} consultas restantes hoy</span>
          {msgs.length > 0 && (
            <button onClick={() => setMsgs([])} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt3, padding: "8px 16px", borderRadius: 100, cursor: "pointer", fontSize: 12 }}>Nueva consulta</button>
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
              <div style={{ fontSize: 13, color: T.txt3 }}>El asesor tiene acceso a todos tus datos financieros</div>
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
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          background: loading ? T.bg3 : T.gn, color: loading ? T.txt3 : "#000",
          border: "none", borderRadius: 12, padding: "14px 24px", cursor: loading ? "default" : "pointer",
          fontWeight: 700, fontSize: 14, transition: "all 0.2s",
        }}>
          {loading ? "..." : "Enviar"}
        </button>
      </div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
// build 1775391859
