import { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import Disclaimer from "./Disclaimer";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx";
import {
  DEFAULTS_PROYECCION,
  estimarAmortizacionAnual,
  snapshotPatrimonio,
  proyectarPatrimonio,
} from "../lib/proyeccionPatrimonio.js";

/**
 * Bloque NUEVO debajo del chart de acumulación CF del SimuladorAvanzado.
 * No toca sliders, independencia, Sankey, FlujoAnual ni el motor simT.
 *
 * Props:
 *  - user: { inv, deudas, ingresos, gastos, trm }
 *  - cfMensualSimulado: simT.cf (ya neto de debt service; impuesto = saldo a pagar)
 *  - patrimonioNeto / activos / deudasTotales: opcionales (totals del dashboard)
 *  - fmt, T
 */
export default function ProyeccionPatrimonio({
  user,
  cfMensualSimulado = 0,
  patrimonioNeto,
  activos,
  deudasTotales,
  fmt,
  T = {},
}) {
  const fm = fmt || ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  const cfAnualDefault = Math.round((Number(cfMensualSimulado) || 0) * 12);

  const [cfOverride, setCfOverride] = useState(null); // null = usar default del sim
  const [retornoPct, setRetornoPct] = useState(
    Math.round(DEFAULTS_PROYECCION.retornoExcedente * 1000) / 10 // 6.0
  );
  const [inflacionPct, setInflacionPct] = useState(
    Math.round(DEFAULTS_PROYECCION.inflacionAnual * 1000) / 10 // 4.0
  );

  // Si el CF simulado cambia (sliders del sim), resetea el override solo cuando
  // el usuario no ha tocado el input (cfOverride === null).
  useEffect(() => {
    /* intentional: keep override sticky while user edits */
  }, [cfAnualDefault]);

  const cfAnual =
    cfOverride != null && cfOverride !== ""
      ? Number(String(cfOverride).replace(/[^0-9.-]/g, "")) || 0
      : cfAnualDefault;

  const snap = useMemo(
    () =>
      snapshotPatrimonio(user || {}, {
        patrimonioNeto,
        activos,
        deudasTotales,
      }),
    [user, patrimonioNeto, activos, deudasTotales]
  );

  const amortAnual = useMemo(
    () => estimarAmortizacionAnual(user?.deudas || [], snap.trm),
    [user, snap.trm]
  );

  const proy = useMemo(
    () =>
      proyectarPatrimonio({
        patrimonioNeto0: snap.patrimonioNeto,
        activos0: snap.activos,
        deudas0: snap.deudasTotales,
        cfAnual,
        retornoExcedente: (Number(retornoPct) || 0) / 100,
        inflacionAnual: (Number(inflacionPct) || 0) / 100,
        amortizacionAnual: amortAnual,
        horizontes: DEFAULTS_PROYECCION.horizontes,
      }),
    [snap, cfAnual, retornoPct, inflacionPct, amortAnual]
  );

  const chartData = proy.serie.map((s) => ({
    m: s.label,
    patrimonio: s.patrimonio,
    real: s.patrimonioReal,
  }));

  const inputStyle = {
    width: "100%",
    background: T.bg2 || "#18181b",
    border: `1px solid ${T.border || "rgba(255,255,255,0.06)"}`,
    borderRadius: 10,
    padding: "8px 12px",
    color: T.txt || "#fafafa",
    fontSize: 13,
    outline: "none",
    fontVariantNumeric: "tabular-nums",
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: T.txt3 || "#71717a",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  };

  return (
    <div
      style={{
        background: T.card || "#111113",
        border: "1px solid " + (T.border || "rgba(255,255,255,0.06)"),
        borderRadius: 16,
        padding: 20,
        marginTop: 14,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: T.txt || "#fafafa",
            lineHeight: 1.35,
          }}
        >
          Si sostengo este cash flow, ¿el patrimonio a 3 / 5 / 10 años crece o se come?
        </div>
        <div style={{ fontSize: 11, color: T.txt3 || "#71717a", marginTop: 4, lineHeight: 1.45 }}>
          Proyección sobre el CF anual neto del simulador (ingresos − egresos − debt service).
          El impuesto en ese CF es <strong style={{ color: T.txt2 || "#a1a1aa" }}>saldo a pagar</strong> (post-rete), nunca impuesto a cargo.
        </div>
      </div>

      {/* Controles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={labelStyle}>CF anual (override)</div>
          <input
            type="text"
            inputMode="numeric"
            value={
              cfOverride != null
                ? cfOverride
                : Math.round(cfAnualDefault).toLocaleString("es-CO")
            }
            onChange={(e) => setCfOverride(e.target.value)}
            onBlur={() => {
              if (cfOverride == null || cfOverride === "") return;
              const n = Number(String(cfOverride).replace(/[^0-9.-]/g, ""));
              if (!Number.isFinite(n)) setCfOverride(null);
              else setCfOverride(String(Math.round(n)));
            }}
            style={inputStyle}
            aria-label="Cash flow anual override"
          />
          <div style={{ fontSize: 9, color: T.txt3 || "#71717a", marginTop: 3 }}>
            Default = CF simulado × 12 ({fm(cfAnualDefault)}).{" "}
            {cfOverride != null && (
              <button
                type="button"
                onClick={() => setCfOverride(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: T.bl || "#3b82f6",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                Usar del simulador
              </button>
            )}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Retorno del excedente %</div>
          <input
            type="number"
            step="0.1"
            value={retornoPct}
            onChange={(e) => setRetornoPct(e.target.value)}
            style={inputStyle}
            aria-label="Retorno del excedente anual"
          />
        </div>
        <div>
          <div style={labelStyle}>Inflación %</div>
          <input
            type="number"
            step="0.1"
            value={inflacionPct}
            onChange={(e) => setInflacionPct(e.target.value)}
            style={inputStyle}
            aria-label="Inflación anual"
          />
        </div>
      </div>

      {/* Veredictos 3 / 5 / 10 */}
      {/* 14-sep-2026 (Santiago: "lo que quiero es darle la posibilidad al
          usuario de que proyecte, que mire presente, futuro 3, 5, 10 años, si
          aumenta cash flow, eso es todo").
          La pieza ya estaba -- override de CF y tarjetas a 3/5/10 años -- pero
          para usarla había que ESCRIBIR una cifra anual a mano. Nadie calcula
          mentalmente "mi CF más 25%" y lo teclea; el resultado era que la
          función existía y no se tocaba.
          Estos botones responden la pregunta tal como se la hace uno: ¿y si
          aumento el cash flow? Un clic y las tres tarjetas se recalculan. */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>¿Y si aumento mi cash flow?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { l: "Como hoy", f: 1 },
            { l: "+10%", f: 1.1 },
            { l: "+25%", f: 1.25 },
            { l: "+50%", f: 1.5 },
            { l: "El doble", f: 2 },
          ].map(({ l, f }) => {
            const valor = Math.round(cfAnualDefault * f);
            // "Como hoy" se marca activo cuando no hay override, que es el
            // estado inicial: así el grupo siempre refleja lo que se está viendo.
            const activo = f === 1
              ? cfOverride == null
              : cfOverride != null &&
                Math.abs(Number(String(cfOverride).replace(/[^0-9.-]/g, "")) - valor) < 2;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setCfOverride(f === 1 ? null : String(valor))}
                style={{
                  padding: "7px 13px", borderRadius: 999, cursor: "pointer",
                  fontSize: 11.5, fontWeight: 700,
                  background: activo ? (T.green || "#22c55e") : "transparent",
                  color: activo ? "#0a0a0a" : (T.txt2 || "#a1a1aa"),
                  border: `1px solid ${activo ? (T.green || "#22c55e") : (T.border || "rgba(255,255,255,0.12)")}`,
                }}>
                {l}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 9.5, color: T.txt3 || "#71717a", marginTop: 6 }}>
          Sobre tu CF simulado de {fm(cfAnualDefault)} al año. Podés escribir una
          cifra exacta abajo si preferís.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {proy.porHorizonte.map((h) => {
          const crece = h.veredicto === "crece";
          return (
            <div
              key={h.horizonte}
              style={{
                background: crece
                  ? T.gnD || "rgba(34,197,94,0.1)"
                  : T.rdD || "rgba(239,68,68,0.08)",
                border: `1px solid ${(crece ? T.gn : T.rd) || (crece ? "#22c55e" : "#ef4444")}33`,
                borderRadius: 12,
                padding: "12px 10px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: T.txt3 || "#71717a",
                }}
              >
                {h.horizonte} años
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  marginTop: 4,
                  color: crece ? T.gn || "#22c55e" : T.rd || "#ef4444",
                }}
              >
                {crece ? "Crece" : "Se come"}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: T.txt || "#fafafa",
                  marginTop: 6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fm(h.patrimonio)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: crece ? T.gn || "#22c55e" : T.rd || "#ef4444",
                  marginTop: 2,
                }}
              >
                {h.delta >= 0 ? "+" : ""}
                {fm(h.delta)} nominal
              </div>
              <div style={{ fontSize: 9, color: T.txt3 || "#71717a", marginTop: 2 }}>
                Real: {fm(h.patrimonioReal)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      {/* El título dice ahora la unidad del eje X. Sin eso, dos gráficas de
          área verdes seguidas parecen la misma: la de arriba va mes a mes
          dentro de un año, esta va año a año. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: T.txt2 || "#a1a1aa", marginBottom: 8 }}>
        Patrimonio proyectado <span style={{ fontWeight: 400, color: T.txt3 || "#71717a" }}>· año a año</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <ChartGradients />
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="m" {...axisProps} />
          <YAxis
            {...axisProps}
            tickFormatter={(v) => {
              if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
              if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
              if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
              return "$" + v;
            }}
          />
          <Tooltip content={<ChartTooltip formatter={(v) => fm(v)} />} />
          <ReferenceLine y={snap.patrimonioNeto} stroke={CHART.txt3} strokeDasharray="4 4" />
          {/* 14-sep-2026 (Santiago: "se ven dos graficas como repetidas").
              Esta gráfica y la de cash flow del simulador quedaron con el MISMO
              verde, la misma forma de área y la misma clave de eje, una encima
              de la otra. Muestran cosas distintas -- arriba cash flow mes a mes,
              acá patrimonio año a año -- pero el ojo las leía como la misma
              repetida, y eso hace dudar de si la pantalla está mal.
              Se pasa a azul, que en el resto de la app es el color de
              patrimonio. El verde queda para flujo. */}
          <Area
            type="monotone"
            dataKey="patrimonio"
            stroke={CHART.blue}
            fill="url(#gradBlue)"
            strokeWidth={2.5}
            name="Nominal"
          />
          <Area
            type="monotone"
            dataKey="real"
            stroke={CHART.txt3}
            fill="transparent"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            name="Real (deflactado)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Tabla resumen */}
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
            color: T.txt2 || "#a1a1aa",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: T.txt3 || "#71717a" }}>
              <th style={{ padding: "6px 4px", fontWeight: 600 }}>Año</th>
              <th style={{ padding: "6px 4px", fontWeight: 600 }}>Patrimonio</th>
              <th style={{ padding: "6px 4px", fontWeight: 600 }}>Real</th>
              <th style={{ padding: "6px 4px", fontWeight: 600 }}>Activos</th>
              <th style={{ padding: "6px 4px", fontWeight: 600 }}>Deudas</th>
            </tr>
          </thead>
          <tbody>
            {proy.serie
              .filter((s) => s.año === 0 || DEFAULTS_PROYECCION.horizontes.includes(s.año))
              .map((s) => (
                <tr
                  key={s.año}
                  style={{ borderTop: `1px solid ${T.border || "rgba(255,255,255,0.06)"}` }}
                >
                  <td style={{ padding: "7px 4px", color: T.txt || "#fafafa", fontWeight: 600 }}>
                    {s.label}
                  </td>
                  <td style={{ padding: "7px 4px", fontVariantNumeric: "tabular-nums" }}>
                    {fm(s.patrimonio)}
                  </td>
                  <td style={{ padding: "7px 4px", fontVariantNumeric: "tabular-nums" }}>
                    {fm(s.patrimonioReal)}
                  </td>
                  <td style={{ padding: "7px 4px", fontVariantNumeric: "tabular-nums" }}>
                    {fm(s.activos)}
                  </td>
                  <td style={{ padding: "7px 4px", fontVariantNumeric: "tabular-nums" }}>
                    {fm(s.deudas)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Supuestos visibles */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          background: T.bg2 || "#18181b",
          borderRadius: 10,
          fontSize: 10,
          color: T.txt3 || "#71717a",
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 700, color: T.txt2 || "#a1a1aa", marginBottom: 4 }}>
          Supuestos (editables arriba)
        </div>
        <div>
          Patrimonio hoy: <strong style={{ color: T.txt2 }}>{fm(snap.patrimonioNeto)}</strong>
          {" · "}Activos {fm(snap.activos)} − Deudas {fm(snap.deudasTotales)}
        </div>
        <div>
          CF anual usado: <strong style={{ color: T.txt2 }}>{fm(cfAnual)}</strong>
          {cfOverride == null ? " (del simulador)" : " (override)"}
          {" · "}Retorno excedente {Number(retornoPct) || 0}%
          {" · "}Inflación {Number(inflacionPct) || 0}%
        </div>
        <div>
          Amortización de capital estimada: {fm(amortAnual)}/año (reduce pasivo; no se resta del CF).
        </div>
        <div style={{ marginTop: 4 }}>
          Fórmula: activos crecen a retorno del excedente + CF anual reinvertido; deudas bajan por
          amortización estimada. Veredicto “crece / se come” usa patrimonio <em>real</em> (deflactado).
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Disclaimer variante="proyeccion" idioma="es" T={T} compacto />
      </div>
    </div>
  );
}