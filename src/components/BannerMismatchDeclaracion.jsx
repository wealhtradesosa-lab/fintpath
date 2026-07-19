// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BannerMismatchDeclaracion
//
// Banner amarillo/naranja que aparece en Plan Tributario → Dashboard si el
// detector de mismatch (src/lib/mismatchDetection.js) encontró diferencias
// significativas entre la declaración importada y los datos cargados.
//
// PROPS:
//   - results: salida de detectarMismatchTodos(user, estimacion)
//   - onMarkReviewed: callback (reviewKey) → marca como revisado en user.fiscalReviewed
//   - onUnmark: callback (reviewKey) → desmarca para volver a mostrar
//
// COMPORTAMIENTO:
//   - Si results vacío → no renderiza nada (return null)
//   - Si todos los results están revisados → muestra link sutil "Ver mismatches revisados"
//   - Si hay mismatches sin revisar → muestra banner amarillo expandible
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";

// Paleta consistente con el resto del app
const colors = {
  warningBg: "rgba(234, 179, 8, 0.08)",
  warningBorder: "rgba(234, 179, 8, 0.25)",
  warningText: "#eab308",
  infoBg: "rgba(59, 130, 246, 0.06)",
  infoBorder: "rgba(59, 130, 246, 0.20)",
  infoText: "#3b82f6",
  txt: "#fafafa",
  tx2: "#a1a1aa",
  tx3: "#71717a",
  bg2: "#141418",
  bg3: "#1e1e24",
  border: "rgba(255,255,255,0.08)",
};

function fmM(v) {
  const m = (Number(v) || 0) / 1e6;
  if (Math.abs(m) >= 1000) return "$" + (m / 1000).toFixed(1) + "B";
  if (Math.abs(m) >= 1) return "$" + m.toFixed(0) + "M";
  return "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
}

export default function BannerMismatchDeclaracion({ results, onMarkReviewed, onUnmark }) {
  const [expanded, setExpanded] = useState({});
  const [showRevisados, setShowRevisados] = useState(false);

  if (!results || results.length === 0) return null;

  const sinRevisar = results.filter(r => !r.revisado);
  const revisados = results.filter(r => r.revisado);

  // Si todos están revisados, mostrar solo link sutil
  if (sinRevisar.length === 0 && !showRevisados) {
    return (
      <div style={{ marginBottom: 16, fontSize: 12, color: colors.tx3, textAlign: "center" }}>
        ✓ Mismatches revisados con tu contador.{" "}
        <span
          onClick={() => setShowRevisados(true)}
          style={{ color: colors.infoText, cursor: "pointer", textDecoration: "underline" }}
        >
          Ver detalles ({revisados.length})
        </span>
      </div>
    );
  }

  const toExpanded = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Mostrar mismatches sin revisar (banner principal) y revisados (si toggle)
  const aRender = showRevisados ? results : sinRevisar;
  const tieneWarnings = aRender.some(r => r.severidadMaxima === "warning" && !r.revisado);
  const bgColor = tieneWarnings ? colors.warningBg : colors.infoBg;
  const borderColor = tieneWarnings ? colors.warningBorder : colors.infoBorder;
  const headerColor = tieneWarnings ? colors.warningText : colors.infoText;
  const headerEmoji = tieneWarnings ? "⚠️" : "ℹ️";
  const headerTitle = tieneWarnings
    ? "Hay diferencias entre tu declaración y los datos cargados"
    : "Diferencias menores entre tu declaración y los datos";

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{headerEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: headerColor, marginBottom: 4 }}>
            {headerTitle}
          </div>
          <div style={{ fontSize: 12, color: colors.tx2, lineHeight: 1.5 }}>
            Comparamos tus declaraciones importadas con los datos que tenés cargados en FINPATHIA.
            Diferencias grandes pueden indicar: ingresos asignados al owner equivocado, gastos no
            registrados, o ajustes de tu contador. <strong style={{ color: colors.txt }}>Verificá con tu contador antes de declarar.</strong>
          </div>
        </div>
      </div>

      {aRender.map(r => {
        const isExpanded = !!expanded[r.reviewKey];
        return (
          <div
            key={r.reviewKey}
            style={{
              background: colors.bg2,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              opacity: r.revisado ? 0.6 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{r.tipo === "juridica" ? "🏢" : "👤"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.txt }}>
                  {r.ownerName} · {r.tipoDeclaracion} {r.anoGravable}
                  {r.revisado && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: colors.tx3, fontWeight: 500 }}>
                      ✓ revisado
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: colors.tx3 }}>
                  {r.mismatches.length} diferencia{r.mismatches.length > 1 ? "s" : ""} detectada{r.mismatches.length > 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => toExpanded(r.reviewKey)}
                style={{
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.tx2,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {isExpanded ? "Ocultar" : "Ver detalle"}
              </button>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
                {r.mismatches.map((mm, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 10px",
                      background: mm.severidad === "warning" ? colors.warningBg : colors.infoBg,
                      borderRadius: 6,
                      marginBottom: 8,
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: colors.txt, marginBottom: 4 }}>
                      {mm.campo}
                    </div>
                    <div style={{ color: colors.tx2, marginBottom: 6 }}>{mm.mensaje}</div>
                    <div style={{ display: "flex", gap: 16, fontSize: 11, color: colors.tx3, marginBottom: 6 }}>
                      <span>📋 Declarado: <strong style={{ color: colors.txt }}>{fmM(mm.declarado)}</strong></span>
                      <span>🔢 Calculado: <strong style={{ color: colors.txt }}>{fmM(mm.calculado)}</strong></span>
                      <span>📊 Diferencia: <strong style={{ color: mm.severidad === "warning" ? colors.warningText : colors.infoText }}>{(mm.diferenciaPct * 100).toFixed(0)}%</strong></span>
                    </div>
                    {mm.explicaciones.map((ex, j) => (
                      <div key={j} style={{ fontSize: 11, color: colors.tx3, marginTop: 4, fontStyle: "italic" }}>
                        💡 {ex}
                      </div>
                    ))}
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                  {r.revisado ? (
                    <button
                      onClick={() => onUnmark && onUnmark(r.reviewKey)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${colors.border}`,
                        color: colors.tx2,
                        padding: "8px 14px",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Volver a mostrar
                    </button>
                  ) : (
                    <button
                      onClick={() => onMarkReviewed && onMarkReviewed(r.reviewKey)}
                      style={{
                        background: headerColor,
                        border: "none",
                        color: "#000",
                        padding: "8px 14px",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      ✓ Lo revisé con mi contador
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!showRevisados && revisados.length > 0 && (
        <div
          onClick={() => setShowRevisados(true)}
          style={{
            fontSize: 11,
            color: colors.tx3,
            textAlign: "center",
            cursor: "pointer",
            marginTop: 8,
            textDecoration: "underline",
          }}
        >
          + Ver {revisados.length} mismatch{revisados.length > 1 ? "es" : ""} ya revisado{revisados.length > 1 ? "s" : ""}
        </div>
      )}
      {showRevisados && (
        <div
          onClick={() => setShowRevisados(false)}
          style={{
            fontSize: 11,
            color: colors.tx3,
            textAlign: "center",
            cursor: "pointer",
            marginTop: 8,
            textDecoration: "underline",
          }}
        >
          Ocultar revisados
        </div>
      )}
    </div>
  );
}
