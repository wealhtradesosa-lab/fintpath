// ═══════════════════════════════════════════════════════════════════════════
// StatCard.jsx · Sesión 2-may-2026
//
// Tarjeta de KPI premium estilo Stripe / Linear / Mercury.
// Drop-in reemplazo de los <Cd><St l v cl/></Cd> dispersos en App.jsx.
//
// Features:
//   - Glow radial sutil del color de accent
//   - Typography masiva en valor (Plus Jakarta Sans, fontMono opcional)
//   - Subtítulo con color semántico (verde/rojo)
//   - Trend indicator opcional (▲ +12% / ▼ -5%)
//   - Hover lift (translateY + border highlight)
//   - Optional accent line (left-border de color)
//
// USO:
//   <StatCard
//     label="PATRIMONIO NETO"
//     value="$21.8B"
//     sub="+8.3% YoY"
//     subColor="positive"  // "positive" | "negative" | undefined
//     accent="#22c55e"     // color del glow y accent line
//     trend="up"           // "up" | "down" | undefined
//   />
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  green: "#22c55e",
  red: "#ef4444",
  fontDisplay: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  fontMono: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
};

export default function StatCard({
  label,
  value,
  sub,
  subColor,         // "positive" | "negative" | string (color)
  accent,           // hex color para glow y accent line
  trend,            // "up" | "down"
  icon,             // emoji o componente (opcional)
  onClick,          // si se quiere clickeable
  highlight,        // versión destacada (más grande)
  size = "md",      // "sm" | "md" | "lg"
}) {
  // Color del subtítulo según semántica
  const resolvedSubColor = subColor === "positive" ? C.green
    : subColor === "negative" ? C.red
    : subColor || C.txt3;

  // Tamaños tipográficos según `size`
  const valueSize = size === "lg" ? "clamp(1.75rem, 3vw, 2.5rem)"
    : size === "sm" ? "1.25rem"
    : "clamp(1.4rem, 2.2vw, 1.75rem)";

  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.02)",
        // Glow radial sutil del accent en esquina sup-izq
        backgroundImage: accent
          ? `radial-gradient(circle at 0% 0%, ${accent}12 0%, transparent 60%)`
          : undefined,
        border: `1px solid ${highlight ? (accent || C.borderStrong) + (highlight ? "30" : "") : C.border}`,
        borderRadius: 14,
        padding: size === "sm" ? "12px 14px" : "16px 18px",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        cursor: onClick ? "pointer" : "default",
        // Si highlight, leve glow externo
        ...(highlight && accent && {
          boxShadow: `0 0 0 1px ${accent}15, 0 4px 16px ${accent}10`,
        }),
      }}
      onMouseEnter={(e) => {
        if (onClick || accent) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = (accent || C.borderStrong) + "30";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.borderColor = highlight && accent ? accent + "30" : C.border;
      }}
    >
      {/* Accent line vertical a la izquierda */}
      {accent && (
        <div style={{
          position: "absolute",
          left: 0,
          top: 16,
          bottom: 16,
          width: 2,
          background: accent,
          borderRadius: "0 2px 2px 0",
          opacity: highlight ? 1 : 0.5,
        }} />
      )}

      {/* Header: label + icon */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: size === "sm" ? 6 : 8,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.txt3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {label}
        </div>
        {icon && (
          <div style={{ fontSize: 14, color: accent || C.txt3, opacity: 0.7 }}>
            {icon}
          </div>
        )}
      </div>

      {/* Value masivo */}
      <div style={{
        fontFamily: C.fontDisplay,
        fontSize: valueSize,
        fontWeight: 700,
        letterSpacing: "-0.025em",
        color: highlight && accent ? accent : C.txt,
        lineHeight: 1.05,
        // Tabular nums: alinea dígitos verticalmente para tablas/KPIs
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>

      {/* Subtitle con trend opcional */}
      {sub && (
        <div style={{
          marginTop: size === "sm" ? 4 : 6,
          fontSize: size === "sm" ? 11 : 12,
          color: resolvedSubColor,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          {trend === "up" && <span style={{ fontSize: 9 }}>▲</span>}
          {trend === "down" && <span style={{ fontSize: 9 }}>▼</span>}
          {sub}
        </div>
      )}
    </div>
  );
}
