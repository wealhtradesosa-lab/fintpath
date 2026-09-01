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
  CartesianGrid, Legend, Line, ComposedChart, ReferenceLine,
  PieChart, Pie, Cell
} from "recharts";
import PageHeader from "./PageHeader";
import { montoDelMes, MESES, getMesActual, montoPromedioMensual, getFrecuencia, estaPagadoEnAño, getMesPago, FRECUENCIAS, getMonto } from "../lib/flowHelpers.js";
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

export default function FlujoAnual({ user, trm = 4200, isEN = false }) {
  // 01-sep-2026: esta sección se le mostraba entera en español a los usuarios
  // de Estados Unidos. Son 18 cadenas; se traducen con un diccionario local en
  // vez de un sistema de i18n, que sería sobreingeniería para este tamaño.
  const L = isEN ? {
    titulo: "Annual Flow", ingresos: "Income", aportes: "Contributions",
    gastosFam: "Household", cuotas: "Loan payments", impuesto: "Tax",
    egresos: "Outflows", cashflow: "Cash Flow", saldo: "Cum. balance",
    mes: "Month", alta: "High", baja: "Low", media: "Avg", otros: "Other",
    pagado: "Paid", proximoMes: "Next month", seguridadSocial: "Payroll taxes",
    sePagaEsteMes: "DUE THIS MONTH", vencido: "OVERDUE",
  } : {
    titulo: "Flujo Anual", ingresos: "Ingresos", aportes: "Aportes",
    gastosFam: "Gastos fam.", cuotas: "Cuotas cr\u00e9ditos", impuesto: "Impuesto",
    egresos: "Egresos", cashflow: "Cash Flow", saldo: "Saldo acum.",
    mes: "Mes", alta: "Alta", baja: "Baja", media: "Media", otros: "Otros",
    pagado: "Pagado", proximoMes: "Pr\u00f3ximo mes", seguridadSocial: "Seguridad Social",
    sePagaEsteMes: "SE PAGA ESTE MES", vencido: "VENCIDO",
  };
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
          if (cat === L.seguridadSocial) aportesObligatorios += monto;
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
      volatilidadLabel: volatilidadPct < 0.15 ? L.baja : volatilidadPct < 0.4 ? L.media : L.alta,
      volatilidadColor: volatilidadPct < 0.15 ? T.gn : volatilidadPct < 0.4 ? T.gd : T.or,
      positivos,
      negativos,
      proximoValle,
      proximoPico,
      saldoFinAño: saldoAcumulado[11]?.saldo || 0,
      saldoAcumulado,
    };
  }, [datosMensuales, año, añoDefault, mesActualHoy]);

  // ─── Composición del año por categoría (18-jul-2026 noche) ──────────
  // Santiago: "sería bueno ver una gráfica de cómo están compuestos los
  // ingresos y los gastos en % y valor".
  // Calcula el TOTAL anual por categoría para pintar 2 donut charts.
  const composicion = useMemo(() => {
    const trmR = trm || 4200;
    const ingresos = user?.ingresos || [];
    const gastos = user?.gas || user?.gastos || {};
    const deudas = user?.deu || user?.deudas || [];

    // Impuestos anualizados (mismo cálculo que en datosMensuales)
    const taxData = estimarImpuesto(user);
    let impuestoBrutoAnual = 0;
    let retencionAnual = 0;
    (taxData?.detalle || []).forEach(td => {
      impuestoBrutoAnual += (td.impBruto != null ? td.impBruto : (td.impuesto || 0));
      retencionAnual += (td.reteN || 0);
    });
    const impuestoNetoAnual = Math.max(0, impuestoBrutoAnual - retencionAnual);

    // ─── INGRESOS por categoría ─────────────────────────────────
    const ingresosPorCat = {};
    ingresos.forEach(ing => {
      if (ing.sim === false) return;
      const cat = ing.categoria || L.otros;
      // Sumar los 12 meses del año usando el motor (respeta variable, vigencia, etc)
      const montoBase = (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trmR : 1);
      let totalAño = 0;
      for (let m = 1; m <= 12; m++) {
        totalAño += montoDelMes({ ...ing, mensual: montoBase }, año, m);
      }
      if (totalAño > 0) ingresosPorCat[cat] = (ingresosPorCat[cat] || 0) + totalAño;
    });

    // ─── EGRESOS por categoría ────────────────────────────────
    const egresosPorCat = {};
    Object.entries(gastos).forEach(([cat, items]) => {
      (items || []).forEach(g => {
        if (g.sim === false) return;
        let totalAño = 0;
        for (let m = 1; m <= 12; m++) {
          totalAño += montoDelMes(g, año, m);
        }
        if (totalAño > 0) egresosPorCat[cat] = (egresosPorCat[cat] || 0) + totalAño;
      });
    });

    // Cuotas de deudas (agrupadas en una categoría)
    const cuotasAnual = deudas
      .filter(d => (d.mt || 0) > 0 && d.sim !== false)
      .reduce((s, d) => s + (d.pg || d.pago || 0), 0) * 12;
    if (cuotasAnual > 0) egresosPorCat["💳 Cuotas de deudas"] = cuotasAnual;

    // Impuesto neto (después de retención) como categoría separada
    if (impuestoNetoAnual > 0) egresosPorCat["📋 Impuesto de renta"] = impuestoNetoAnual;

    // ─── Formato para PieChart ───────────────────────────────────
    // Paleta de colores diferenciada por categoría (rotan si hay muchas)
    const paletaIng = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#bbf7d0", "#059669", "#10b981", "#34d399"];
    const paletaEgr = ["#ef4444", "#dc2626", "#f87171", "#fca5a5", "#fecaca", "#b91c1c", "#f97316", "#fb923c", "#fdba74"];

    const totalIng = Object.values(ingresosPorCat).reduce((s, v) => s + v, 0);
    const totalEgr = Object.values(egresosPorCat).reduce((s, v) => s + v, 0);

    const dataIngresos = Object.entries(ingresosPorCat)
      .sort((a, b) => b[1] - a[1]) // orden descendente por valor
      .map(([name, value], i) => ({
        name,
        value,
        pct: totalIng > 0 ? (value / totalIng) * 100 : 0,
        color: paletaIng[i % paletaIng.length],
      }));

    const dataEgresos = Object.entries(egresosPorCat)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        pct: totalEgr > 0 ? (value / totalEgr) * 100 : 0,
        color: paletaEgr[i % paletaEgr.length],
      }));

    return { dataIngresos, dataEgresos, totalIng, totalEgr };
  }, [user, trm, año]);

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
        label={L.titulo}
        title={isEN ? `How your ${año} behaves` : `Cómo se comporta tu año ${año}`}
        subtitle={isEN ? "See the peaks and valleys of your income and outflows month by month." : "Visualizá picos y valles de ingresos y egresos mes a mes. Planificá con datos reales."}
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
              <Bar dataKey="ingresos" fill={T.gn} radius={[4, 4, 0, 0]} name={L.ingresos} />
              <Bar dataKey="egresos" fill={T.rd} radius={[4, 4, 0, 0]} name={L.egresos} />
              <Line type="monotone" dataKey="cashFlow" stroke={T.gd} strokeWidth={2.5} dot={{ r: 4, fill: T.gd }} activeDot={{ r: 6 }} name="Cash Flow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ PRÓXIMOS PAGOS DEL AÑO (20-jul-2026, Santiago) ═══
          "Esos pagos que son solo una vez al año como seguros o impuestos
          sería genial que tuviesen una alerta de pago que uno sepa que se
          vencen y se pagan tal día". Lista de items NO mensuales ordenada
          por urgencia: vencidos → este mes → próximos → pagados al final. */}
      {(() => {
        const { mes: mesHoy, año: añoHoy } = getMesActual();
        const pagosAnuales = [];
        Object.entries(user.gastos || {}).forEach(([cat, items]) => {
          (items || []).forEach(g => {
            if (g.sim === false) return;
            const freq = getFrecuencia(g);
            if (freq === "mensual" || freq === "variable") return;
            const pagado = estaPagadoEnAño(g, añoHoy);
            const mp = getMesPago(g);
            const monto = getMonto(g);
            if (monto <= 0) return;
            // Urgencia: 0=vencido, 1=este mes, 2=próximo mes, 3=futuro, 4=pagado
            let urgencia = 3;
            if (pagado) urgencia = 4;
            else if (mp < mesHoy) urgencia = 0;
            else if (mp === mesHoy) urgencia = 1;
            else if (mp === mesHoy + 1) urgencia = 2;
            pagosAnuales.push({ nombre: g.c || cat, cat, monto, mp, freq, pagado, urgencia });
          });
        });
        if (pagosAnuales.length === 0) return null;
        pagosAnuales.sort((a, b) => a.urgencia - b.urgencia || a.mp - b.mp || b.monto - a.monto);
        const conf = {
          0: { emoji: "🔴", label: L.vencido, color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
          1: { emoji: "🔔", label: L.sePagaEsteMes, color: "#f97316", bg: "rgba(249,115,22,0.08)" },
          2: { emoji: "📅", label: L.proximoMes, color: "#eab308", bg: "rgba(234,179,8,0.06)" },
          3: { emoji: "📅", label: "", color: T.txt3, bg: "transparent" },
          4: { emoji: "✅", label: L.pagado, color: T.gn, bg: "transparent" },
        };
        const pendientes = pagosAnuales.filter(p => !p.pagado);
        const totalPendiente = pendientes.reduce((s, p) => s + p.monto, 0);
        return (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>🔔 Próximos pagos del año</div>
                <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>Seguros, impuestos y pagos puntuales — marcá el chip Pagado en Egresos al cubrirlos.</div>
              </div>
              <div style={{ fontSize: 11, color: T.txt3, fontFamily: "monospace" }}>
                Pendiente: <span style={{ color: "#f97316", fontWeight: 700 }}>${Math.round(totalPendiente).toLocaleString("es-CO")}</span> · {pendientes.length} {pendientes.length === 1 ? "pago" : "pagos"}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
              {pagosAnuales.map((p, i) => {
                const c = conf[p.urgencia];
                const fLabel = FRECUENCIAS.find(f => f.v === p.freq)?.l || p.freq;
                const mesL = MESES.find(m => m.v === p.mp)?.l || p.mp;
                return (
                  <div key={i} style={{ background: c.bg || T.bg3, border: `1px solid ${p.urgencia <= 1 ? c.color + "50" : T.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: p.pagado ? 0.5 : 1, minWidth: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: p.pagado ? "line-through" : "none" }} title={p.nombre}>{p.nombre}</div>
                      <div style={{ fontSize: 10, color: c.color, fontWeight: p.urgencia <= 1 ? 700 : 500, marginTop: 2 }}>
                        {c.emoji} {p.urgencia === 0 ? `${c.label} — era en ${mesL}` : p.urgencia === 4 ? `${c.label} ${añoHoy}` : (c.label ? `${c.label} (${mesL})` : `${fLabel} · ${mesL}`)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: p.pagado ? T.txt3 : T.txt, fontFamily: "monospace", flexShrink: 0 }}>${Math.round(p.monto).toLocaleString("es-CO")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ═══ COMPOSICIÓN DEL AÑO — 2 DONUT CHARTS (18-jul-2026 noche) ═══
          Santiago: "sería bueno ver cómo están compuestos los ingresos y
          los gastos en % y valor". */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Composición del año {año}</div>
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>De dónde vienen tus ingresos y a dónde van tus egresos, en % y valor absoluto.</div>
        </div>

        {/* Layout responsive: 2 columnas cuando hay espacio (min 320px cada una),
            1 columna cuando el ancho es angosto — evita corte de textos. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* ─── INGRESOS ─── */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.gn }}>💰 Ingresos</div>
              <div style={{ fontSize: 11, color: T.txt3, fontFamily: "monospace" }}>
                Total: <span style={{ color: T.gn, fontWeight: 700 }}>${Math.round(composicion.totalIng).toLocaleString("es-CO")}</span>
              </div>
            </div>

            {composicion.dataIngresos.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: T.txt3, fontSize: 12 }}>
                Aún no hay ingresos registrados
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={composicion.dataIngresos}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      labelLine={false}
                      // UX FIX (18-jul-2026 noche): labels DENTRO del arco —
                      // los labels externos se cortaban con el borde del
                      // contenedor (Santiago screenshot: "41%" y "26%" cortados).
                      // Dentro del arco nunca se cortan. Solo slices >= 7%.
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
                        if (pct < 7) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) / 2;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                            {pct.toFixed(0)}%
                          </text>
                        );
                      }}
                    >
                      {composicion.dataIngresos.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke={T.card} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `$${Math.round(value).toLocaleString("es-CO")} (${props.payload.pct.toFixed(1)}%)`,
                        name
                      ]}
                      contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda mejorada (18-jul-2026 noche): nombre en línea propia
                    con truncate, % y valor en línea inferior con espacio flexible.
                    Evita el problema de textos cortados cuando el ancho es limitado. */}
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                  {composicion.dataIngresos.map((d, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, paddingBottom: 5, borderBottom: i === composicion.dataIngresos.length - 1 ? "none" : `1px solid ${T.border}` }}>
                      {/* Fila 1: cuadrado color + nombre (con truncate si es largo) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }}></div>
                        <span title={d.name} style={{ color: T.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{d.name}</span>
                      </div>
                      {/* Fila 2: % + valor absoluto — siempre visibles */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingLeft: 16 }}>
                        <span style={{ color: T.txt2, fontWeight: 700, fontFamily: "monospace" }}>{d.pct.toFixed(1)}%</span>
                        <span style={{ color: T.txt3, fontFamily: "monospace", fontSize: 10 }}>${Math.round(d.value).toLocaleString("es-CO")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ─── EGRESOS ─── */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.rd }}>💸 Egresos</div>
              <div style={{ fontSize: 11, color: T.txt3, fontFamily: "monospace" }}>
                Total: <span style={{ color: T.rd, fontWeight: 700 }}>${Math.round(composicion.totalEgr).toLocaleString("es-CO")}</span>
              </div>
            </div>

            {composicion.dataEgresos.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: T.txt3, fontSize: 12 }}>
                Aún no hay egresos registrados
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={composicion.dataEgresos}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
                        if (pct < 7) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) / 2;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                            {pct.toFixed(0)}%
                          </text>
                        );
                      }}
                    >
                      {composicion.dataEgresos.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke={T.card} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [
                        `$${Math.round(value).toLocaleString("es-CO")} (${props.payload.pct.toFixed(1)}%)`,
                        name
                      ]}
                      contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                  {composicion.dataEgresos.map((d, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, paddingBottom: 5, borderBottom: i === composicion.dataEgresos.length - 1 ? "none" : `1px solid ${T.border}` }}>
                      {/* Fila 1: cuadrado color + nombre (con truncate si es largo) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }}></div>
                        <span title={d.name} style={{ color: T.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{d.name}</span>
                      </div>
                      {/* Fila 2: % + valor absoluto */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingLeft: 16 }}>
                        <span style={{ color: T.txt2, fontWeight: 700, fontFamily: "monospace" }}>{d.pct.toFixed(1)}%</span>
                        <span style={{ color: T.txt3, fontFamily: "monospace", fontSize: 10 }}>${Math.round(d.value).toLocaleString("es-CO")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Nota final: ratio ahorro */}
        {composicion.totalIng > 0 && (
          <div style={{ marginTop: 16, padding: "12px 14px", background: T.bg3, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: T.txt3 }}>
              <span style={{ fontWeight: 700, color: T.txt2 }}>Excedente/Déficit del año:</span>
              {" "}el {composicion.totalIng > 0 ? ((composicion.totalIng - composicion.totalEgr) / composicion.totalIng * 100).toFixed(1) : 0}% de tus ingresos queda libre después de todos los egresos.
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: (composicion.totalIng - composicion.totalEgr) >= 0 ? T.gn : T.rd }}>
              ${Math.round(composicion.totalIng - composicion.totalEgr).toLocaleString("es-CO")}
            </div>
          </div>
        )}
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
                {[L.mes, L.ingresos, L.aportes, L.gastosFam, L.cuotas, L.impuesto, L.egresos, L.cashflow, L.saldo].map((h, i) => (
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
