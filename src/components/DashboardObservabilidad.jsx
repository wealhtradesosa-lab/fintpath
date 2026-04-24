// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD DE OBSERVABILIDAD (interno)
// ─────────────────────────────────────────────────────────────────────────
// Panel de debug que muestra los últimos 50 eventos de analytics emitidos
// por la sesión actual del usuario. Útil para:
//   · Verificar que los eventos se disparan correctamente en producción
//   · Reproducir flujos de usuario real sin depender de GA4
//   · Debuggear patrones de uso en tiempo real
//
// Los eventos se guardan en localStorage (key: finpathia_analytics_recent)
// desde analytics.js como efecto colateral del track(). Se limpian al
// hacer clear o automáticamente cuando el array pasa de 50 elementos.
//
// ACCESO: oculto, accesible solo agregando ?debug=1 a la URL de finpathia.com
// o vía el menú admin (si existe).
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { getRecentEvents, clearRecentEvents } from "../lib/analytics.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4", green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const eventColor = (name) => {
  if (name.includes("guardado") || name.includes("aprobar")) return T.green;
  if (name.includes("abierto") || name.includes("renderizad")) return T.blue;
  if (name.includes("paso")) return T.cyan;
  if (name.includes("copiado")) return T.orange;
  if (name.includes("alerta")) return T.red;
  return T.purple;
};

const fmtTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

export default function DashboardObservabilidad({ onClose }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const load = () => setEvents(getRecentEvents());
    load();
    if (!autoRefresh) return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = filter
    ? events.filter(e => e.event.toLowerCase().includes(filter.toLowerCase()) || JSON.stringify(e.payload).toLowerCase().includes(filter.toLowerCase()))
    : events;

  // Agregaciones por tipo de evento
  const counts = {};
  events.forEach(e => { counts[e.event] = (counts[e.event] || 0) + 1; });
  const topEvents = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26 }}>🔬</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.txt }}>Dashboard de observabilidad</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            {events.length} evento{events.length !== 1 ? "s" : ""} en buffer local · Se guarda últimos 50 · Refresco automático cada 2s
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            ← Volver
          </button>
        )}
      </div>

      {/* Top events summary */}
      {topEvents.length > 0 && (
        <div style={{ marginBottom: 16, padding: 14, background: T.bg2, borderRadius: 10, border: "1px solid " + T.border }}>
          <div style={{ fontSize: 11, color: T.txt3, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Top eventos de la sesión
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topEvents.map(([name, count]) => (
              <div key={name} style={{
                padding: "4px 10px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 6,
                border: "1px solid " + T.border,
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                <span style={{ color: eventColor(name), fontWeight: 700, fontFamily: "monospace" }}>{name}</span>
                <span style={{ color: T.txt2, fontFamily: "monospace", fontSize: 10 }}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Filtrar por nombre o payload..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", background: T.bg3, border: "1px solid " + T.border, color: T.txt, borderRadius: 8, fontSize: 12, outline: "none" }}
        />
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{ padding: "8px 12px", background: autoRefresh ? T.green : T.bg3, color: autoRefresh ? "#000" : T.txt2, border: "1px solid " + (autoRefresh ? T.green : T.border), borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
        >
          {autoRefresh ? "● Auto-refresh ON" : "○ Auto-refresh OFF"}
        </button>
        <button
          onClick={() => { clearRecentEvents(); setEvents([]); }}
          style={{ padding: "8px 12px", background: T.bg3, color: T.red, border: "1px solid " + T.red + "55", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
        >
          🗑 Limpiar buffer
        </button>
      </div>

      {/* Event list */}
      <div style={{ background: T.bg2, borderRadius: 10, border: "1px solid " + T.border, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: T.txt3, fontSize: 13 }}>
            {events.length === 0 ? "Ningún evento en el buffer. Navegá por la app y los eventos aparecerán acá." : "Ningún evento coincide con el filtro."}
          </div>
        ) : (
          filtered.map((e, i) => (
            <div key={i} style={{ padding: "10px 14px", borderBottom: i < filtered.length - 1 ? "1px solid " + T.border : "none", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ color: eventColor(e.event), fontWeight: 700, fontFamily: "monospace" }}>{e.event}</span>
                <span style={{ color: T.txt3, fontSize: 10, fontFamily: "monospace" }}>{fmtTime(e.ts)}</span>
              </div>
              {e.payload && Object.keys(e.payload).length > 0 && (
                <pre style={{ margin: "6px 0 0", padding: "6px 10px", background: T.bg3, borderRadius: 6, fontSize: 10, color: T.txt2, fontFamily: "monospace", overflow: "auto", maxWidth: "100%" }}>
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
        Este panel solo refleja eventos de TU sesión actual (buffer en localStorage). Para datos agregados de todos los usuarios, ver GA4 → Reports → Events. Los mismos eventos se envían a GA4 en paralelo al buffer local.
      </div>
    </div>
  );
}
