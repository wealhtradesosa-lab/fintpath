// ═══════════════════════════════════════════════════════════════════════════
// FlujoAnual — Vista de 12 meses del cash flow (Fase 3 flujo anual)
//
// Motivación (Santiago 18-jul-2026):
//   "Uno saber cómo se comporta el año es clave. Qué mes es de mucho gasto,
//   cuál es el mes con más flujo".
//
// Este módulo responde exactamente esa pregunta con:
//   1. Gráfico de barras agrupadas: 12 meses × [ingresos verde, egresos rojo]
//      + línea del cash flow por mes
//   2. Cards de highlights: mejor mes, peor mes, volatilidad, positivos/negativos
//   3. Tabla de detalle por mes con overflow scroll
//   4. Alertas próximas: próximo pico o valle en el año
//
// Modelo mental:
//   Reutiliza el motor `flowHelpers` (montoDelMes por ítem) para calcular
//   exactamente lo que pesa cada mes. Los items mensuales pesan los 12
//   meses; los no-mensuales solo en su mes de pago (y solo si NO están
//   marcados como pagados).
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Line, ComposedChart, ReferenceLine
} from "recharts";
import PageHeader from "./PageHeader";
import { montoDelMes, MESES, getMesActual, montoPromedioMensual } from "../lib/flowHelpers.js";
import { estimarImpuesto } from "../lib/taxCO";
import { ChartTooltip } from "../lib/chartTheme.jsx";

const T = {
  bg: "#09090b", bg2: "#18181b", bg3: "#27272a", bg4: "#2a2a32",
  card: "#111113", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  gn: "#22c55e", gnD: "rgba(34,197,94,0.1)",
  rd: "#ef4444", rdD: "rgba(239,68,68,0.08)",
  bl: "#3b82f6", pr: "#a78bfa", or: "#f97316", gd: "#eab308",
};

const fm = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");
const fmShort = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n || 0).toString();
};

export default function FlujoAnual({ user, trm = 4200 }) {
  const { año: añoDefault, mes: mesActualHoy } = getMesActual();
  const [año, setAño] = useState(añoDefault);

  // ─── Motor: calcular ingresos/egresos/cash flow por cada mes ──────────
  const datosMensuales = useMemo(() => {
    const trmR = trm || 4200;
    const ingresos = user?.ingresos || [];
    const gastos = user?.gas || user?.gastos || {};
    const deudas = user?.deu || user?.deudas || [];

    // Impuestos y retención (constantes al mes, anualizados ÷ 12)
    const taxData = estimarImpuesto(user);
    let impuestoBrutoAnual = 0;
    let retencionAnual = 0;
    (taxData?.detalle || []).forEach(td => {
      impuestoBrutoAnual += (td.impBruto != null ? td.impBruto : (td.impuesto || 0));
      retencionAnual += (td.reteN || 0);
    });
    const retencionMes = Math.round(retencionAnual / 12);
    const impuestoNetoMes = Math.max(0, Math.round((impuestoBrutoAnual - retencionAnual) / 12));

    // Cuotas de deudas: mensuales por diseño
    const cuotasDeudasMes = deudas
      .filter(d => (d.mt || 0) > 0 && d.sim !== false)
      .reduce((s, d) => s + (d.pg || d.pago || 0), 0);

    // Para cada mes del año, calcular ingresos y gastos
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;

      // Ingresos del mes (respeta frecuencia + mes de pago + estado pagado)
      let ingresosMes = 0;
      ingresos.forEach(ing => {
        if (ing.sim === false) return;
        const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trmR : 1);
        ingresosMes += montoDelMes({ ...ing, mensual: montoBase }, año, mes);
      });

      // Gastos del mes: aportes obligatorios + gastos familiares
      let aportesObligatorios = 0;
      let gastosFamiliares = 0;
      Object.entries(gastos).forEach(([cat, items]) => {
        (items || []).forEach(g => {
          if (g.sim === false) return;
          const monto = montoDelMes(g, año, mes);
          if (cat === "Seguridad Social") aportesObligatorios += monto;
          else gastosFamiliares += monto;
        });
      });

      const disponible = ingresosMes - retencionMes;
      const egresosMes = aportesObligatorios + gastosFamiliares + cuotasDeudasMes + impuestoNetoMes;
      const cashFlow = disponible - egresosMes;

      return {
        mes,
        mesLabel: MESES.find(m => m.v === mes)?.l.slice(0, 3) || "",
        mesLabelFull: MESES.find(m => m.v === mes)?.l || "",
        ingresos: ingresosMes,
        egresos: egresosMes,
        cashFlow,
        // Desglose de egresos para tooltip
        aportesObligatorios,
        gastosFamiliares,
        cuotasDeudas: cuotasDeudasMes,
        impuestoNeto: impuestoNetoMes,
        retencion: retencionMes,
        disponible,
        // Meta info
        esMesActual: (año === añoDefault && mes === mesActualHoy),
      };
    });
  }, [user, trm, año, añoDefault, mesActualHoy]);

  // ─── Highlights del año ────────────────────────────────────────────
  const highlights = useMemo(() => {
    const cashFlows = datosMensuales.map(d => d.cashFlow);
    const promedio = cashFlows.reduce((s, c) => s + c, 0) / 12;

    // Mejor y peor mes
    const mejorMes = datosMensuales.reduce((best, d) => d.cashFlow > best.cashFlow ? d : best, datosMensuales[0]);
    const peorMes = datosMensuales.reduce((worst, d) => d.cashFlow < worst.cashFlow ? d : worst, datosMensuales[0]);

    // Volatilidad (desviación estándar)
    const variance = cashFlows.reduce((s, c) => s + Math.pow(c - promedio, 2), 0) / 12;
    const stdev = Math.sqrt(variance);
    const volatilidadPct = promedio !== 0 ? Math.abs(stdev / promedio) : 0;

    // Meses positivos/negativos
    const positivos = datosMensuales.filter(d => d.cashFlow >= 0).length;
    const negativos = 12 - positivos;

    // Próximo pico/valle (a partir del mes actual, si el año es el actual)
    let proximoValle = null;
    let proximoPico = null;
    if (año === añoDefault) {
      const restantes = datosMensuales.filter(d => d.mes >= mesActualHoy);
      if (restantes.length > 0) {
        proximoValle = restantes.reduce((worst, d) => d.cashFlow < worst.cashFlow ? d : worst, restantes[0]);
        proximoPico = restantes.reduce((best, d) => d.cashFlow > best.cashFlow ? d : best, restantes[0]);
      }
    }

    // Saldo acumulado a lo largo del año
    let saldoCorrido = 0;
    const saldoAcumulado = datosMensuales.map(d => {
      saldoCorrido += d.cashFlow;
      return { mes: d.mes, mesLabel: d.mesLabel, saldo: saldoCorrido };
    });

    return {
      promedio,
      mejorMes,
      peorMes,
      volatilidadPct,
      volatilidadLabel: volatilidadPct < 0.15 ? "Baja" : volatilidadPct < 0.4 ? "Media" : "Alta",
      volatilidadColor: volatilidadPct < 0.15 ? T.gn : volatilidadPct < 0.4 ? T.gd : T.or,
      positivos,
      negativos,
      proximoValle,
      proximoPico,
      saldoFinAño: saldoAcumulado[11]?.saldo || 0,
      saldoAcumulado,
    };
  }, [datosMensuales, año, añoDefault, mesActualHoy]);

  // ─── Custom tooltip del gráfico ────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = datosMensuales.find(x => x.mesLabel === label);
    if (!d) return null;
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 220 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.txt, marginBottom: 8 }}>
          {d.mesLabelFull} {año}{d.esMesActual ? " (actual)" : ""}
        </div>
        <div style={{ fontSize: 11, color: T.txt2, display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: T.gn }}>▲ Ingresos</span>
          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fm(d.ingresos)}</span>
        </div>
        <div style={{ fontSize: 11, color: T.txt2, display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: T.rd }}>▼ Egresos</span>
          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fm(d.egresos)}</span>
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
          <span style={{ color: d.cashFlow >= 0 ? T.gn : T.rd }}>Cash Flow</span>
          <span style={{ fontFamily: "monospace", color: d.cashFlow >= 0 ? T.gn : T.rd }}>{fm(d.cashFlow)}</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        label="Flujo Anual"
        title={`Cómo se comporta tu año ${año}`}
        subtitle="Visualizá picos y valles de ingresos y egresos mes a mes. Planificá con datos reales."
        rightSlot={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setAño(año - 1)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.txt2, fontSize: 12, cursor: "pointer" }}>◀</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.txt, minWidth: 50, textAlign: "center" }}>{año}</span>
            <button onClick={() => setAño(año + 1)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", color: T.txt2, fontSize: 12, cursor: "pointer" }}>▶</button>
          </div>
        }
      />

      {/* ═══ HIGHLIGHTS DEL AÑO — 4 cards ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        {/* Mejor mes */}
        <div style={{ background: T.card, border: `1px solid ${T.gn}30`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>🏆 Mejor mes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.gn, marginTop: 6 }}>{highlights.mejorMes?.mesLabelFull}</div>
          <div style={{ fontSize: 13, color: T.txt2, fontFamily: "monospace", marginTop: 2 }}>{fm(highlights.mejorMes?.cashFlow)}</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
            +{fm((highlights.mejorMes?.cashFlow || 0) - highlights.promedio)} vs promedio
          </div>
        </div>

        {/* Peor mes */}
        <div style={{ background: T.card, border: `1px solid ${T.rd}30`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>⚠️ Peor mes</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.rd, marginTop: 6 }}>{highlights.peorMes?.mesLabelFull}</div>
          <div style={{ fontSize: 13, color: T.txt2, fontFamily: "monospace", marginTop: 2 }}>{fm(highlights.peorMes?.cashFlow)}</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
            {fm((highlights.peorMes?.cashFlow || 0) - highlights.promedio)} vs promedio
          </div>
        </div>

        {/* Volatilidad */}
        <div style={{ background: T.card, border: `1px solid ${highlights.volatilidadColor}30`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>📊 Volatilidad</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: highlights.volatilidadColor, marginTop: 6 }}>{highlights.volatilidadLabel}</div>
          <div style={{ fontSize: 13, color: T.txt2, marginTop: 2 }}>
            ±{(highlights.volatilidadPct * 100).toFixed(0)}% del promedio
          </div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
            Meses varían {fm(Math.abs((highlights.mejorMes?.cashFlow || 0) - (highlights.peorMes?.cashFlow || 0)) / 2)} arriba/abajo
          </div>
        </div>

        {/* Meses positivos/negativos */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>💰 Balance de meses</div>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: T.gn }}>{highlights.positivos}</span>
            <span style={{ fontSize: 11, color: T.txt3 }}>positivos</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.rd }}>{highlights.negativos}</span>
            <span style={{ fontSize: 11, color: T.txt3 }}>negativos</span>
          </div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
            Saldo fin año: <span style={{ color: highlights.saldoFinAño >= 0 ? T.gn : T.rd, fontWeight: 700 }}>{fm(highlights.saldoFinAño)}</span>
          </div>
        </div>
      </div>

      {/* ═══ ALERTAS PRÓXIMAS (solo si es el año actual) ═══ */}
      {año === añoDefault && (highlights.proximoValle || highlights.proximoPico) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
          {highlights.proximoValle && highlights.proximoValle.cashFlow < highlights.promedio && (
            <div style={{ background: "rgba(249,115,22,0.08)", border: `1px solid ${T.or}40`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>⏰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.or, fontWeight: 700, letterSpacing: 0.5 }}>PRÓXIMO VALLE</div>
                  <div style={{ fontSize: 13, color: T.txt, fontWeight: 600, marginTop: 2 }}>
                    {highlights.proximoValle.mesLabelFull}: cash flow de {fm(highlights.proximoValle.cashFlow)}
                  </div>
                  <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>
                    {fm(highlights.proximoValle.cashFlow - highlights.promedio)} vs promedio — prevé buffer
                  </div>
                </div>
              </div>
            </div>
          )}
          {highlights.proximoPico && highlights.proximoPico.cashFlow > highlights.promedio && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: `1px solid ${T.gn}40`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎯</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.gn, fontWeight: 700, letterSpacing: 0.5 }}>PRÓXIMO PICO</div>
                  <div style={{ fontSize: 13, color: T.txt, fontWeight: 600, marginTop: 2 }}>
                    {highlights.proximoPico.mesLabelFull}: cash flow de {fm(highlights.proximoPico.cashFlow)}
                  </div>
                  <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>
                    +{fm(highlights.proximoPico.cashFlow - highlights.promedio)} vs promedio — buen mes para invertir
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ GRÁFICO PRINCIPAL: 12 meses con barras agrupadas + cash flow ═══ */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Ingresos vs Egresos por mes</div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Cada mes muestra ingresos brutos (verde) y egresos totales (rojo). La línea amarilla es el cash flow.</div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, background: T.gn, borderRadius: 2 }}></span>
              <span style={{ color: T.txt2 }}>Ingresos</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, background: T.rd, borderRadius: 2 }}></span>
              <span style={{ color: T.txt2 }}>Egresos</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 2, background: T.gd, marginTop: 4 }}></span>
              <span style={{ color: T.txt2 }}>Cash Flow</span>
            </span>
          </div>
        </div>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <ComposedChart data={datosMensuales} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="mesLabel" stroke={T.txt3} fontSize={11} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis stroke={T.txt3} fontSize={10} axisLine={false} tickLine={false} tickFormatter={fmShort} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <ReferenceLine y={0} stroke={T.border} strokeDasharray="3 3" />
              <ReferenceLine y={highlights.promedio} stroke={T.txt3} strokeDasharray="2 6" label={{ value: `Cash Flow promedio ${fmShort(highlights.promedio)}`, position: "insideTopRight", fill: T.txt3, fontSize: 10 }} />
              <Bar dataKey="ingresos" fill={T.gn} radius={[4, 4, 0, 0]} name="Ingresos" />
              <Bar dataKey="egresos" fill={T.rd} radius={[4, 4, 0, 0]} name="Egresos" />
              <Line type="monotone" dataKey="cashFlow" stroke={T.gd} strokeWidth={2.5} dot={{ r: 4, fill: T.gd }} activeDot={{ r: 6 }} name="Cash Flow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ TABLA DE DETALLE POR MES ═══ */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Detalle mes a mes</div>
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Desglose completo: ingresos, egresos por categoría, cash flow y saldo acumulado.</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg3 }}>
                {["Mes", "Ingresos", "Aportes", "Gastos fam.", "Cuotas", "Impuesto", "Egresos", "Cash Flow", "Saldo acum."].map((h, i) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: i === 0 ? "left" : "right", color: T.txt3, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datosMensuales.map((d, i) => {
                const saldo = highlights.saldoAcumulado[i]?.saldo || 0;
                return (
                  <tr key={d.mes} style={{ borderBottom: `1px solid ${T.border}`, background: d.esMesActual ? "rgba(59,130,246,0.05)" : "transparent" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: T.txt, whiteSpace: "nowrap" }}>
                      {d.mesLabelFull}
                      {d.esMesActual && <span style={{ fontSize: 9, color: T.bl, marginLeft: 6, fontWeight: 700 }}>(actual)</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.gn }}>{fm(d.ingresos)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.or }}>{fm(d.aportesObligatorios)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.txt2 }}>{fm(d.gastosFamiliares)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.txt2 }}>{fm(d.cuotasDeudas)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.pr }}>{fm(d.impuestoNeto)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: T.rd, fontWeight: 600 }}>{fm(d.egresos)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: d.cashFlow >= 0 ? T.gn : T.rd, fontWeight: 700 }}>{fm(d.cashFlow)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: saldo >= 0 ? T.txt : T.rd, fontWeight: 600 }}>{fm(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
