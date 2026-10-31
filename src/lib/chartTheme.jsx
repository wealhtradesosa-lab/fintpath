import { fmtPctEs, fmtNumEs } from "./formato.js";
// ═══════════════════════════════════════════════════════════════════════════
// chartTheme.js · Sesión 2-may-2026
//
// Sistema centralizado de styling para gráficos Recharts y dashboards.
// Exporta paleta, gradients, axes, tooltips y configs para look premium
// (estilo Stripe, Linear, Mercury).
//
// USO:
//   import { CHART, ChartTooltip, ChartGradients, axisProps, chartCardStyle } from "../lib/chartTheme.js";
//   <ResponsiveContainer>
//     <AreaChart data={data}>
//       <ChartGradients />
//       <XAxis {...axisProps} />
//       <YAxis {...axisProps} />
//       <Tooltip content={<ChartTooltip />} />
//       <Area dataKey="value" stroke={CHART.green} fill="url(#gradGreen)" />
//     </AreaChart>
//   </ResponsiveContainer>
// ═══════════════════════════════════════════════════════════════════════════

// Paleta premium (alineada con HeroVariantC)
// Colores para atributos SVG de Recharts (no aceptan var(--…)): sirven en los dos modos.
export const SVG_TXT = "#71717a";
export const SVG_LINEA = "rgba(113,113,122,0.22)";

export const CHART = {
  // Backgrounds
  bg: "var(--fp-bg)",
  bg2: "var(--fp-card)",
  bg3: "var(--fp-raised)",
  border: "rgba(var(--fp-ink),0.08)",
  borderStrong: "rgba(var(--fp-ink),0.14)",

  // Texto
  txt: "var(--fp-txt)",
  txt2: "var(--fp-txt2)",
  txt3: "var(--fp-txt3)",

  // Colores semánticos (alineados con landing)
  green: "#00c805",
  blue: "#3b82f6",
  purple: "#3b82f6",
  cyan: "#94a3b8",
  pink: "#64748b",
  orange: "#f59e0b",
  gold: "#f59e0b",
  red: "#ff5000",

  // Paleta para charts categóricos (orden importa: primero los más usados)
  // Optimizada para distinguibilidad y armonía cromática
  // 31-oct-2026 (Santiago: "demasiados colores… eso hace que se vea pesado").
  // Verde y azul para lo principal; el resto, grises azulados.
  series: ["#00c805", "#3b82f6", "#64748b", "#94a3b8", "#475569", "#b4bfcc", "#334155", "#7a8699"],

  // Tipografía (mantener consistencia con PageHeader)
  fontDisplay: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  fontBody: "'Inter', system-ui, sans-serif",
  fontMono: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
};

// ─────────────────────────────────────────────────────────────────────────
// ChartGradients · linearGradients reusables para Area/Bar charts
// Drop-in: <ChartGradients /> dentro de cualquier chart, después accedes
// con fill="url(#gradGreen)" etc.
// ─────────────────────────────────────────────────────────────────────────
export function ChartGradients() {
  return (
    <defs>
      {/* Verde: ingresos, ganancias, positivo */}
      <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.green} stopOpacity={0.6} />
        <stop offset="100%" stopColor={CHART.green} stopOpacity={0.02} />
      </linearGradient>
      {/* Azul: principal, neutro */}
      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.55} />
        <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.02} />
      </linearGradient>
      {/* Púrpura: secundario, premium */}
      <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.purple} stopOpacity={0.55} />
        <stop offset="100%" stopColor={CHART.purple} stopOpacity={0.02} />
      </linearGradient>
      {/* Rojo: deudas, negativo */}
      <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.red} stopOpacity={0.5} />
        <stop offset="100%" stopColor={CHART.red} stopOpacity={0.02} />
      </linearGradient>
      {/* Orange: warnings, gastos */}
      <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART.orange} stopOpacity={0.55} />
        <stop offset="100%" stopColor={CHART.orange} stopOpacity={0.02} />
      </linearGradient>
      {/* Gradient lineal verde→azul para bars/lines highlight */}
      <linearGradient id="gradGreenBlue" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={CHART.green} />
        <stop offset="100%" stopColor={CHART.blue} />
      </linearGradient>
      {/* Gradient horizontal premium (verde→cyan→azul→púrpura) */}
      <linearGradient id="gradPremium" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={CHART.green} />
        <stop offset="33%" stopColor={CHART.cyan} />
        <stop offset="66%" stopColor={CHART.blue} />
        <stop offset="100%" stopColor={CHART.purple} />
      </linearGradient>
    </defs>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ChartTooltip · tooltip premium con glassmorphism
// ─────────────────────────────────────────────────────────────────────────
export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload || !payload.length) return null;

  const formatValue = (v, name, entry) => {
    if (formatter) return formatter(v, name, entry);
    if (typeof v === "number") {
      // Formato moneda colombiana por defecto
      if (Math.abs(v) >= 1e6) return "$" + fmtNumEs((v / 1e6), 1)+" MM";
      if (Math.abs(v) >= 1e3) return "$" + fmtNumEs((v / 1e3), 1)+"K";
      return "$" + v.toLocaleString("es-CO");
    }
    return v;
  };

  return (
    <div style={{
      background: "var(--fp-card)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: `1px solid ${CHART.borderStrong}`,
      borderRadius: 12,
      padding: "12px 14px",
      boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
      fontFamily: CHART.fontBody,
      minWidth: 140,
    }}>
      {label !== undefined && (
        <div style={{
          fontSize: 12,
          color: CHART.txt3,
          fontWeight: 600,
          letterSpacing: "0.04em",
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${CHART.border}`,
        }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingTop: i === 0 ? 0 : 6,
          paddingBottom: i === payload.length - 1 ? 0 : 6,
          fontSize: 13,
        }}>
          {/* Color indicator */}
          <div style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: p.color || p.fill || p.payload?.fill || p.payload?.color || CHART.txt2,
            flexShrink: 0,
            boxShadow: `0 0 8px ${p.color || p.fill || p.payload?.fill || p.payload?.color || "transparent"}40`,
          }} />
          <div style={{ display: "flex", justifyContent: "space-between", flex: 1, gap: 16, alignItems: "baseline" }}>
            <span style={{ color: CHART.txt2, fontSize: 12 }}>{p.name}</span>
            <span style={{
              color: CHART.txt,
              fontWeight: 700,
              fontFamily: CHART.fontMono,
              fontSize: 13,
            }}>
              {formatValue(p.value, p.name, p)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// axisProps · estilo unificado para ejes X/Y de Recharts
// USO: <XAxis dataKey="name" {...axisProps} />
// ─────────────────────────────────────────────────────────────────────────
export const axisProps = {
  tick: {
    fill: SVG_TXT, // atributo SVG: no acepta var(); gris que se lee en claro y en oscuro
    fontSize: 12,
    fontFamily: CHART.fontBody,
    fontWeight: 500,
  },
  axisLine: { stroke: SVG_LINEA },
  tickLine: { stroke: SVG_LINEA },
};

// ─────────────────────────────────────────────────────────────────────────
// gridProps · estilo para CartesianGrid sutil
// USO: <CartesianGrid {...gridProps} />
// ─────────────────────────────────────────────────────────────────────────
export const gridProps = {
  strokeDasharray: "3 3",
  stroke: SVG_LINEA,
  vertical: false,
};

// ─────────────────────────────────────────────────────────────────────────
// chartCardStyle · estilo glassmorphism para cards que envuelven gráficos
// USO: <div style={chartCardStyle()}>...chart...</div>
// ─────────────────────────────────────────────────────────────────────────
export function chartCardStyle({ glow, padding = 24 } = {}) {
  return {
    background: "rgba(var(--fp-ink),0.02)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${CHART.border}`,
    borderRadius: 12,
    padding,
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.2s, transform 0.2s",
    ...(glow && {
      boxShadow: `0 0 0 1px ${glow}10, 0 8px 24px ${glow}10`,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// statCardStyle · estilo para cards de KPI tipo Stripe
// USO: <div style={statCardStyle({ accent: CHART.green })}>...</div>
// ─────────────────────────────────────────────────────────────────────────
export function statCardStyle({ accent } = {}) {
  return {
    background: "rgba(var(--fp-ink),0.02)",
    border: `1px solid ${CHART.border}`,
    borderRadius: 12,
    padding: "16px 18px",
    position: "relative",
    overflow: "hidden",
    transition: "all 0.2s",
    cursor: "default",
    ...(accent && {
      // Glow sutil del color del accent en la esquina sup-izq
      backgroundImage: `radial-gradient(circle at 0% 0%, ${accent}10 0%, transparent 50%)`,
    }),
  };
}
