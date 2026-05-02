// ═══════════════════════════════════════════════════════════════════════════
// MINI GRÁFICA AÑOS ANTERIORES
// ─────────────────────────────────────────────────────────────────────────
// Sparkline compacto que visualiza la evolución de impuesto, retenciones
// e ingresos a lo largo de los años, con el año en curso marcado y una
// proyección lineal del año siguiente opcional.
//
// Usa Recharts para render, consistente con el resto de componentes
// gráficos de FINPATHIA. Diseñado para ocupar ~200px de alto y caber
// en el Paso 5 del F-210/F-110 sin saturar.
//
// Uso:
//   <MiniGraficaAnosAnteriores
//     serie={[{ anoGravable: "2023", impuesto: 5e6, retenciones: 8e6, ingresos: 200e6 },
//             { anoGravable: "2024", impuesto: 6e6, retenciones: 9e6, ingresos: 220e6 }]}
//     anoActual="2025"
//     valoresActuales={{ impuesto: 7.5e6, retenciones: 10e6, ingresos: 240e6 }}
//   />
// ═══════════════════════════════════════════════════════════════════════════

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid } from "recharts";
import { useEffect } from "react";
import { proyectarSiguienteAno } from "./AlertasAnoAnterior.jsx";
import { track } from "../lib/analytics.js";
import { ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";

const T = {
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  red: "#ef4444", orange: "#f59e0b", green: "#22c55e", blue: "#3b82f6", cyan: "#06b6d4",
  card: "rgba(255,255,255,0.02)",
};

const fmM = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n).toLocaleString("es-CO");
};

export default function MiniGraficaAnosAnteriores({ serie, anoActual, valoresActuales }) {
  useEffect(() => {
    if (!Array.isArray(serie) || serie.length < 1) return;
    track("minigrafica_historico_renderizada", {
      anos_historial: serie.length,
      tiene_proyeccion: serie.length >= 2,
      ano_actual: anoActual || "sin_dato",
    });
  }, [serie?.length, anoActual]);

  if (!Array.isArray(serie) || serie.length < 1) return null;

  // Construir puntos del chart: años anteriores + año actual
  const puntos = [
    ...serie.map(s => ({
      ano: String(s.anoGravable),
      impuesto: s.impuesto || 0,
      retenciones: s.retenciones || 0,
      ingresos: s.ingresos || 0,
      tipo: "histórico",
    })),
  ];
  if (valoresActuales && anoActual) {
    puntos.push({
      ano: String(anoActual),
      impuesto: valoresActuales.impuesto || 0,
      retenciones: valoresActuales.retenciones || 0,
      ingresos: valoresActuales.ingresos || 0,
      tipo: "actual",
    });
  }

  // Proyección del año siguiente (si hay ≥ 2 puntos históricos)
  const proyImp = proyectarSiguienteAno([...serie, { impuesto: valoresActuales?.impuesto }].filter(s => s.impuesto > 0), "impuesto");
  const proyIng = proyectarSiguienteAno([...serie, { ingresos: valoresActuales?.ingresos }].filter(s => s.ingresos > 0), "ingresos");

  const tooltipStyle = {
    background: "#1a1d24",
    border: "1px solid " + T.border,
    borderRadius: 8,
    fontSize: 11,
    padding: "6px 10px",
  };

  return (
    <div style={{
      marginTop: 14, marginBottom: 14,
      background: T.card,
      border: "1px solid " + T.border,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: T.cyan,
        marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
      }}>
        📊 Evolución histórica
        <span style={{ color: T.txt3, fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
          ({puntos.length} año{puntos.length !== 1 ? "s" : ""})
        </span>
      </div>

      <div style={{ width: "100%", height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={puntos} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="ano" {...axisProps} />
            <YAxis tickFormatter={fmM} {...axisProps} width={55} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmM(v)}/>} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle"/>
            <Line type="monotone" dataKey="ingresos" stroke={CHART.blue} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{r:5}} name="Ingresos" />
            <Line type="monotone" dataKey="impuesto" stroke={CHART.red} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{r:5}} name="Impuesto" />
            <Line type="monotone" dataKey="retenciones" stroke={CHART.cyan} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{r:5}} name="Retenciones" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {(proyImp || proyIng) && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, fontSize: 11 }}>
          <div style={{ color: T.green, fontWeight: 700, marginBottom: 4 }}>
            🔮 Proyección año siguiente
          </div>
          <div style={{ color: T.txt2, fontSize: 10, lineHeight: 1.5 }}>
            Basado en la pendiente histórica, el año que viene podría rondar:
            {proyImp && <div style={{ marginTop: 2 }}>· Impuesto: <strong style={{ color: T.txt }}>{fmM(proyImp.valor)}</strong> ({proyImp.pendientePct > 0 ? "+" : ""}{proyImp.pendientePct.toFixed(1)}%/año promedio)</div>}
            {proyIng && <div style={{ marginTop: 2 }}>· Ingresos: <strong style={{ color: T.txt }}>{fmM(proyIng.valor)}</strong> ({proyIng.pendientePct > 0 ? "+" : ""}{proyIng.pendientePct.toFixed(1)}%/año promedio)</div>}
          </div>
          <div style={{ color: T.txt3, fontSize: 9, marginTop: 4, fontStyle: "italic" }}>
            Esto es solo una proyección estadística simple. Tu realidad dependerá de ingresos puntuales, cambios normativos y decisiones personales.
          </div>
        </div>
      )}
    </div>
  );
}
