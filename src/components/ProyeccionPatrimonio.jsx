import { useMemo, useState, useEffect } from "react";
import InputDecimalEs from "./InputDecimalEs.jsx";
import { fmtNumEs, fmtPlataCortaEs } from "../lib/formato.js";
import { fmtPctEs } from "../lib/metrics.js";
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
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART } from "../lib/chartTheme.jsx"
import { claseDeActivo, CLASES } from "../lib/taxonomiaActivos.js";;
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
  inflacionPct: inflacionGlobalProp, // supuesto global (user.inflacionPct)
  onInflacionChange,
}) {
  const fm = fmt || ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  const cfAnualDefault = Math.round((Number(cfMensualSimulado) || 0) * 12);

  const [cfOverride, setCfOverride] = useState(null); // null = usar default del sim
  const [retornoPct, setRetornoPct] = useState(
    Math.round(DEFAULTS_PROYECCION.retornoExcedente * 1000) / 10 // 6.0
  );
  // Un solo supuesto de inflación: si viene del usuario (global) manda; si no,
  // el default (4%). Editarlo acá actualiza el global (misma cifra que el mensaje del portafolio).
  const [inflacionLocal, setInflacionLocal] = useState(
    Math.round(DEFAULTS_PROYECCION.inflacionAnual * 1000) / 10 // 4.0
  );
  const inflacionPct = inflacionGlobalProp != null && inflacionGlobalProp !== "" ? inflacionGlobalProp : inflacionLocal;
  const setInflacionPct = (v) => { setInflacionLocal(v); if (onInflacionChange) onInflacionChange(v === "" ? "" : Number(v)); };

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

  // ── 14-sep-2026 · Valorización derivada de la composición real ───────────
  // Hasta hoy el campo traía 6% fijo para todo el mundo, y ese 6% se aplicaba
  // por igual a un apartamento, a un CDT y a un carro. El VOLVO de Santiago,
  // $190 millones, crecía 6% anual en la proyección cuando un vehículo se
  // deprecia. Con un patrimonio suficientemente cargado de activos que pierden
  // valor, el modelo entero se vuelve optimista sin que nadie lo note.
  //
  // Ahora el default sale de la mezcla real del usuario: cada activo aporta la
  // valorización de SU clase, ponderada por cuánto pesa en el patrimonio.
  //
  // LIMITACIÓN CONOCIDA, y conviene decirla: es un promedio ponderado con los
  // pesos de HOY. En la realidad los pesos se mueven — el carro que se deprecia
  // pesa cada año menos, así que su arrastre disminuye. Proyectar activo por
  // activo a lo largo del tiempo sería más exacto y requiere reescribir el
  // motor. Este promedio ya corrige el error grande (tratar todo igual) sin
  // pretender una precisión que no tiene.
  const mezcla = useMemo(() => {
    const TRM = user?.trm || 4200;
    const inv = (user?.inv || []).filter((a) => a && a.sim !== false);
    let total = 0;
    const porClase = {};
    inv.forEach((a) => {
      const bruto = Number(a.va ?? a.valor_actual ?? a.valor ?? 0) || 0;
      const v = a.moneda === "USD" ? bruto * TRM : bruto;
      if (v <= 0) return;
      const cl = claseDeActivo(a.tp || a.tipo);
      porClase[cl.clase] = (porClase[cl.clase] || 0) + v;
      total += v;
    });
    if (!total) return null;
    let tasa = 0;
    const detalle = Object.entries(porClase)
      .map(([clase, valor]) => {
        const peso = valor / total;
        const r = (CLASES[clase]?.valorizacionRealAnual ?? 0);
        tasa += peso * r;
        return { clase, label: CLASES[clase]?.label || clase, peso, valor, r };
      })
      .sort((x, y) => y.valor - x.valor);
    return { total, detalle, tasaReal: tasa };
  }, [user]);

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
    background: T.bg2 || "var(--fp-card)",
    border: `1px solid ${T.border || "rgba(var(--fp-ink),0.06)"}`,
    borderRadius: 10,
    padding: "8px 12px",
    color: T.txt || "var(--fp-txt)",
    fontSize: 13,
    outline: "none",
    fontVariantNumeric: "tabular-nums",
  };

  const labelStyle = {
    fontSize: 10,
    fontWeight: 600,
    color: T.txt3 || "var(--fp-txt3)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  };

  // 31-oct-2026 (Santiago: «pésima diagramación aquí»). Primero la respuesta
  // (tres tarjetas, cifra en plata de hoy), luego «¿y si te quedara más?», luego
  // los supuestos en una fila; la explicación, la tabla y la fórmula se pliegan.
  const sub = T.txt3 || "var(--fp-txt3)", sub2 = T.txt2 || "var(--fp-txt2)", txt = T.txt || "var(--fp-txt)";
  const borde = T.border || "rgba(var(--fp-ink),0.08)";
  const nominalMezcla = mezcla ? ((1 + mezcla.tasaReal) * (1 + (Number(inflacionPct) || 0) / 100) - 1) * 100 : null;
  const mezclaIgual = nominalMezcla != null && Math.abs(nominalMezcla - (Number(retornoPct) || 0)) < 0.15;
  return (
    <div style={{ background: T.card || "var(--fp-card)", border: "1px solid " + borde, borderRadius: 16, padding: "24px 24px 20px", marginTop: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: txt, lineHeight: 1.3 }}>
        ¿Tu patrimonio crece o se come en 3, 5 y 10 años?
      </div>
      <div style={{ fontSize: 13, color: sub, marginTop: 4, lineHeight: 1.5 }}>
        Si cada año te queda lo mismo que hoy. La cifra grande está en plata de hoy (ya sin inflación).
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: 10, margin: "20px 0" }}>
        {proy.porHorizonte.map((h) => {
          const crece = h.veredicto === "crece";
          const col = crece ? (T.gn || "#22c55e") : (T.rd || "#ef4444");
          return (
            <div key={h.horizonte} style={{ background: "rgba(var(--fp-ink),0.03)", border: "1px solid " + borde, borderRadius: 14, padding: "12px 12px 10px", minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: sub2 }}>En {h.horizonte} años</div>
              <div title={fm(h.patrimonioReal)} style={{ fontSize: 18, fontWeight: 800, color: txt, marginTop: 8, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtPlataCortaEs(h.patrimonioReal)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: col, marginTop: 2 }}>{crece ? "▲ Crece" : "▼ Se come"}</div>
              <div title={fm(h.patrimonio)} style={{ fontSize: 11, color: sub, marginTop: 6, lineHeight: 1.35 }}>{fmtPlataCortaEs(h.patrimonio)} con inflación</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 8 }}>¿Y si cada año te quedara más?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
        {[{ l: "Como hoy", f: 1 }, { l: "+10 %", f: 1.1 }, { l: "+25 %", f: 1.25 }, { l: "+50 %", f: 1.5 }, { l: "El doble", f: 2 }].map(({ l, f }) => {
          const valor = Math.round(cfAnualDefault * f);
          const activo = f === 1 ? cfOverride == null
            : cfOverride != null && Math.abs(Number(String(cfOverride).replace(/[^0-9.-]/g, "")) - valor) < 2;
          return (
            <button key={l} type="button" onClick={() => setCfOverride(f === 1 ? null : String(valor))}
              style={{ padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: activo ? "rgba(34,197,94,0.12)" : "transparent", color: activo ? (T.gn || "#22c55e") : sub2,
                border: "1px solid " + (activo ? (T.gn || "#22c55e") : borde) }}>
              {l}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Supuestos</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12, alignItems: "start" }}>
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: sub2, marginBottom: 4 }}>Lo que te queda al año</div>
          <input type="text" inputMode="numeric"
            value={cfOverride != null ? cfOverride : Math.round(cfAnualDefault).toLocaleString("es-CO")}
            onChange={(e) => setCfOverride(e.target.value)}
            onBlur={() => {
              if (cfOverride == null || cfOverride === "") return;
              const n = Number(String(cfOverride).replace(/[^0-9.-]/g, ""));
              if (!Number.isFinite(n)) setCfOverride(null); else setCfOverride(String(Math.round(n)));
            }}
            style={inputStyle} aria-label="Lo que te queda al año" />
          <div style={{ fontSize: 11, color: sub, marginTop: 4 }}>
            Del simulador: {fm(cfAnualDefault)}{" "}
            {cfOverride != null && <button type="button" onClick={() => setCfOverride(null)} style={{ background: "none", border: "none", color: T.bl || "#3b82f6", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 600 }}>· volver a ese</button>}
          </div>
        </label>
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: sub2, marginBottom: 4 }}>Cuánto sube tu patrimonio al año (%)</div>
          <input type="number" step="0.1" value={retornoPct} onChange={(e) => setRetornoPct(e.target.value)} style={inputStyle} aria-label="Valorización anual del patrimonio" />
          <div style={{ fontSize: 11, color: sub, marginTop: 4 }}>
            {nominalMezcla != null && !mezclaIgual
              ? <>Por lo que tienes, lo esperable es {fmtPctEs(nominalMezcla)}. <button type="button" onClick={() => setRetornoPct(String(nominalMezcla.toFixed(1)))} style={{ background: "none", border: "none", color: T.bl || "#3b82f6", cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 600 }}>Usar {fmtPctEs(nominalMezcla)}</button></>
              : "Sobre todo lo que tienes: inmuebles, inversiones, vehículos."}
          </div>
        </label>
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, color: sub2, marginBottom: 4 }}>Inflación al año (%)</div>
          <InputDecimalEs value={inflacionPct} onChange={(v) => setInflacionPct(v)} style={inputStyle} aria-label="Inflación anual" />
        </label>
      </div>
      <div style={{ height: 24 }} />

      {/* Chart */}
      {/* El título dice ahora la unidad del eje X. Sin eso, dos gráficas de
          área verdes seguidas parecen la misma: la de arriba va mes a mes
          dentro de un año, esta va año a año. */}
      <div style={{ fontSize: 11, fontWeight: 600, color: T.txt2 || "var(--fp-txt2)", marginBottom: 8 }}>
        Cómo crecería, año a año <span style={{ fontWeight: 400, color: T.txt3 || "var(--fp-txt3)" }}>· línea punteada: en plata de hoy</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData}>
          <ChartGradients />
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="m" {...axisProps} />
          <YAxis
            {...axisProps}
            tickFormatter={(v) => {
              if (Math.abs(v) >= 1e9) return "$" + fmtNumEs((v / 1e9), 1)+"B";
              if (Math.abs(v) >= 1e6) return "$" + fmtNumEs((v / 1e6), 0)+"M";
              if (Math.abs(v) >= 1e3) return "$" + fmtNumEs((v / 1e3), 0)+"K";
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
            name="Con inflación"
          />
          <Area
            type="monotone"
            dataKey="real"
            stroke={CHART.txt3}
            fill="transparent"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            name="En plata de hoy"
          />
        </AreaChart>
      </ResponsiveContainer>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: sub2, fontWeight: 600 }}>¿Cómo se calcula? Ver tabla y supuestos</summary>
        <div style={{ fontSize: 12, color: sub, lineHeight: 1.6, margin: "10px 0 12px" }}>
          Cada año: <strong style={{ color: sub2 }}>1)</strong> lo que tienes sube al porcentaje de arriba;{" "}
          <strong style={{ color: sub2 }}>2)</strong> se suma lo que te queda (ingresos menos gastos, cuotas e impuestos);{" "}
          <strong style={{ color: sub2 }}>3)</strong> se descuenta la inflación para verlo en plata de hoy.
          «Crece» quiere decir que en plata de hoy tendrás más que ahora; «se come», que lo que te queda no alcanza a cubrir la inflación.
          {mezcla && <div style={{ marginTop: 6 }}>Lo esperable por lo que tienes: {mezcla.detalle.map((d) => `${d.label} ${fmtPctEs(d.peso * 100, 0)} (${d.r > 0 ? "+" : ""}${fmtPctEs(d.r * 100, 0)})`).join(" · ")}.</div>}
        </div>
      {/* Tabla resumen */}
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
            color: T.txt2 || "var(--fp-txt2)",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: T.txt3 || "var(--fp-txt3)" }}>
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
                  style={{ borderTop: `1px solid ${T.border || "rgba(var(--fp-ink),0.06)"}` }}
                >
                  <td style={{ padding: "7px 4px", color: T.txt || "var(--fp-txt)", fontWeight: 600 }}>
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
          background: T.bg2 || "var(--fp-card)",
          borderRadius: 10,
          fontSize: 10,
          color: T.txt3 || "var(--fp-txt3)",
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 700, color: T.txt2 || "var(--fp-txt2)", marginBottom: 4 }}>
          Con qué números se calculó
        </div>
        <div>
          Patrimonio hoy: <strong style={{ color: T.txt2 }}>{fm(snap.patrimonioNeto)}</strong>
          {" · "}Activos {fm(snap.activos)} − Deudas {fm(snap.deudasTotales)}
        </div>
        <div>
          Lo que te queda al año: <strong style={{ color: T.txt2 }}>{fm(cfAnual)}</strong>
          {cfOverride == null ? " (del simulador)" : " (escrito por ti)"}
          {" · "}Valorización patrimonio {Number(retornoPct) || 0}%
          {" · "}Inflación {(Number(inflacionPct) || 0).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </div>
        <div>
          Amortización de capital estimada: {fm(amortAnual)}/año (reduce pasivo; no se resta del CF).
        </div>
        <div style={{ marginTop: 4 }}>
          Fórmula: activos × (1 + valorización) + lo que te queda cada año; deudas bajan por
          amortización estimada. Veredicto “crece / se come” usa patrimonio <em>real</em> (deflactado).
        </div>
      </div>

      </details>

      <div style={{ marginTop: 10 }}>
        <Disclaimer variante="proyeccion" idioma="es" T={T} compacto />
      </div>
    </div>
  );
}