// ═══════════════════════════════════════════════════════════════════════════
// RECOMENDACIONES FISCALES — Dashboard Fiscal (Commit 6)
// ─────────────────────────────────────────────────────────────────────────
// Muestra las recomendaciones generadas por src/lib/recomendaciones.js:
//   · Titulo + descripción
//   · Ahorro estimado anual (destacado)
//   · Aporte sugerido mensual (si aplica)
//   · CTA que navega al módulo correspondiente
//   · Supuestos expandibles (transparencia)
//   · Referencia legal
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

function severityColors(sev) {
  if (sev === "high")   return { color: T.green, bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.3)" };
  if (sev === "medium") return { color: T.orange, bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.3)" };
  if (sev === "low")    return { color: T.blue, bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.25)" };
  return { color: T.txt2, bg: T.bg2, border: T.border }; // info
}

function RecomendacionCard({ rec, onNavigate }) {
  const [showSupuestos, setShowSupuestos] = useState(false);
  const colors = severityColors(rec.severity);
  const isInfo = rec.severity === "info";

  return (
    <div style={{ padding: "14px 16px", background: colors.bg, border: "1px solid " + colors.border, borderLeft: "3px solid " + colors.color, borderRadius: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 6, lineHeight: 1.4 }}>
            {rec.titulo}
          </div>
          <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
            {rec.descripcion}
          </div>
          {rec.base && (
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, fontFamily: "monospace" }}>
              📖 {rec.base}
            </div>
          )}
        </div>
        {!isInfo && rec.ahorroAnualEstimado > 0 && (
          <div style={{ textAlign: "right", minWidth: 140 }}>
            <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
              Ahorro anual estimado
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: colors.color, fontFamily: "monospace" }}>
              {fm(rec.ahorroAnualEstimado)}
            </div>
            {rec.aporteSugeridoMensual > 0 && (
              <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
                aportando ~{fm(rec.aporteSugeridoMensual)}/mes
              </div>
            )}
          </div>
        )}
      </div>

      {rec.cta && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onNavigate?.(rec.cta.page)} style={{ padding: "7px 12px", background: "transparent", border: "1px solid " + colors.color, borderRadius: 6, color: colors.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {rec.cta.label} →
          </button>
          {rec.supuestos && (
            <button onClick={() => setShowSupuestos(s => !s)} style={{ padding: "7px 12px", background: "transparent", border: "1px solid " + T.border, borderRadius: 6, color: T.txt3, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
              {showSupuestos ? "Ocultar" : "Ver"} supuestos
            </button>
          )}
        </div>
      )}

      {showSupuestos && rec.supuestos && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: T.bg3, borderRadius: 6, fontSize: 10, color: T.txt3, lineHeight: 1.6 }}>
          <div style={{ fontSize: 10, color: T.txt2, fontWeight: 600, marginBottom: 4 }}>Cómo se calcula:</div>
          {rec.supuestos.map((s, i) => (<div key={i}>• {s}</div>))}
        </div>
      )}
    </div>
  );
}

export default function RecomendacionesFiscales({ recomendaciones, ownerId, onNavigate }) {
  // Filtrar por owner activo
  const filtradas = ownerId
    ? recomendaciones.filter(r => r.ownerId === ownerId)
    : recomendaciones;

  const accionables = filtradas.filter(r => r.severity !== "info");
  const totalAhorro = accionables.reduce((s, r) => s + (Number(r.ahorroAnualEstimado) || 0), 0);

  if (filtradas.length === 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5 }}>
          💡 Recomendaciones {accionables.length > 0 && <span style={{ color: T.green }}>({accionables.length})</span>}
        </div>
        {totalAhorro > 0 && (
          <div style={{ fontSize: 11, color: T.txt2 }}>
            Ahorro potencial total: <strong style={{ color: T.green, fontFamily: "monospace" }}>{fm(totalAhorro)}/año</strong>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtradas.map((rec, i) => (
          <RecomendacionCard key={rec.code + "_" + i} rec={rec} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
