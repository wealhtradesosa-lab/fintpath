import { useState, useRef, useEffect } from "react";
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
  const fm = n => "$" + Math.round(n || 0).toLocaleString();
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
      const total = items.reduce((s, g) => s + (g.m || 0), 0);
      ctx += `• ${cat}: ${fm(total)}/mes (${items.length} items)\n`;
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
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs, financialContext: ctx, userId: userId || "anon" }),
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
                maxWidth: "80%", padding: "12px 16px", borderRadius: m.role === "user" ? "14px 14px 0 14px" : "0 14px 14px 14px",
                background: m.role === "user" ? T.bl + "20" : T.bg3,
                border: "1px solid " + (m.role === "user" ? T.bl + "30" : T.border),
                fontSize: 13, lineHeight: 1.7, color: T.txt, whiteSpace: "pre-wrap",
              }}>
                {m.content}
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
