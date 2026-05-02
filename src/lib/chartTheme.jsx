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
export const CHART = {
  // Backgrounds
  bg: "#09090b",
  bg2: "#141418",
  bg3: "#1e1e24",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",

  // Texto
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",

  // Colores semánticos (alineados con landing)
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#ec4899",
  orange: "#f97316",
  gold: "#eab308",
  red: "#ef4444",

  // Paleta para charts categóricos (orden importa: primero los más usados)
  // Optimizada para distinguibilidad y armonía cromática
  series: [
    "#22c55e", // verde (positivo, ingresos)
    "#3b82f6", // azul (neutro, principal)
    "#a78bfa", // púrpura (premium)
    "#22d3ee", // cyan (secundario)
    "#f97316", // orange (warning, gastos)
    "#ec4899", // pink (highlight)
    "#eab308", // gold (oro, conservador)
    "#ef4444", // rojo (negativo, deudas)
  ],

  // Tipografía (mantener consistencia con PageHeader)
  fontDisplay: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
  fontBody: "'Inter', system-ui, sans-serif",
  fontMono: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
};

// ─────────────────────────────────────────────────────────────────────────
// ChartGradients · linearGradients reusables para Area/Bar charts
// Drop-in: <ChartGradients /> dentro de cualquier chart, después accedés
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

  const formatValue = (v, name) => {
    if (formatter) return formatter(v, name);
    if (typeof v === "number") {
      // Formato moneda colombiana por defecto
      if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
      if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
      return "$" + v.toLocaleString("es-CO");
    }
    return v;
  };

  return (
    <div style={{
      background: "rgba(20, 20, 24, 0.9)",
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
          fontSize: 11,
          color: CHART.txt3,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
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
            background: p.color || p.fill || CHART.txt2,
            flexShrink: 0,
            boxShadow: `0 0 8px ${p.color || p.fill || "transparent"}40`,
          }} />
          <div style={{ display: "flex", justifyContent: "space-between", flex: 1, gap: 16, alignItems: "baseline" }}>
            <span style={{ color: CHART.txt2, fontSize: 12 }}>{p.name}</span>
            <span style={{
              color: CHART.txt,
              fontWeight: 700,
              fontFamily: CHART.fontMono,
              fontSize: 13,
            }}>
              {formatValue(p.value, p.name)}
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
    fill: CHART.txt3,
    fontSize: 11,
    fontFamily: CHART.fontBody,
    fontWeight: 500,
  },
  axisLine: { stroke: CHART.border },
  tickLine: { stroke: CHART.border },
};

// ─────────────────────────────────────────────────────────────────────────
// gridProps · estilo para CartesianGrid sutil
// USO: <CartesianGrid {...gridProps} />
// ─────────────────────────────────────────────────────────────────────────
export const gridProps = {
  strokeDasharray: "3 3",
  stroke: CHART.border,
  vertical: false,
};

// ─────────────────────────────────────────────────────────────────────────
// chartCardStyle · estilo glassmorphism para cards que envuelven gráficos
// USO: <div style={chartCardStyle()}>...chart...</div>
// ─────────────────────────────────────────────────────────────────────────
export function chartCardStyle({ glow, padding = 24 } = {}) {
  return {
    background: "rgba(255,255,255,0.02)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: `1px solid ${CHART.border}`,
    borderRadius: 16,
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
    background: "rgba(255,255,255,0.02)",
    border: `1px solid ${CHART.border}`,
    borderRadius: 14,
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
