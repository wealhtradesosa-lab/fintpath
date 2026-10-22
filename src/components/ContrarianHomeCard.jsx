/**
 * ContrarianHomeCard — 1 error prioritario + 1 CTA en el Dashboard.
 * Copy corto en español. Sin “consulta un asesor”.
 */
export default function ContrarianHomeCard({
  title = "Contrarian",
  subtitle = "Lo que NO hacer",
  alert,
  muted = false,
  mutedText = "Sin alertas graves",
  onCta,
  T,
}) {
  const accent = "#a78bfa";
  const bg = "rgba(167,139,250,0.06)";

  if (muted || !alert) {
    return (
      <div
        style={{
          background: bg,
          border: `1px solid ${accent}22`,
          borderRadius: 14,
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>🧠</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent }}>{title}</div>
          <div style={{ fontSize: 12, color: T?.tx3 || "#71717a", marginTop: 2 }}>{mutedText}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: `linear-gradient(135deg,${bg},rgba(239,68,68,0.04))`,
        border: `1px solid ${accent}33`,
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0, flex: "1 1 220px" }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🧠</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {title} · {subtitle}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T?.tx || "#fafafa", marginTop: 6, lineHeight: 1.35 }}>
              {alert.message}
            </div>
          </div>
        </div>
        {onCta && (
          <button
            type="button"
            onClick={onCta}
            style={{
              background: accent,
              color: "#0a0a0b",
              border: "none",
              padding: "10px 14px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {alert.ctaLabel || "Ver detalle"} →
          </button>
        )}
      </div>
    </div>
  );
}
