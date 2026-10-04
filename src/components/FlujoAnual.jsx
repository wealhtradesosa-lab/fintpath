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
import { montoDelMes, MESES, getMesActual, montoPromedioMensual, getFrecuencia, estaPagadoEnAño, getMesPago, FRECUENCIAS, getMonto, rangoEfectivo } from "../lib/flowHelpers.js";
import { estimarImpuesto } from "../lib/taxCO";
import { ChartTooltip } from "../lib/chartTheme.jsx";
import Disclaimer from "./Disclaimer.jsx";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24", bg4: "#2a2a32",
  card: "#141418", border: "rgba(255,255,255,0.06)",
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
  // 27-sep-2026 (Santiago: "no sé por qué mayo en mi cuenta tuvo un pico
  // positivo tan bueno, qué fue lo diferente"). El gráfico mostraba la FORMA
  // del año pero no explicaba ningún mes: para entender un pico había que
  // salir a Ingresos y a Egresos y reconstruirlo a mano.
  const [mesDetalle, setMesDetalle] = useState(null);

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

    // 27-sep-2026 (Santiago: "ya pagué el crédito de libre inversión y me
    // aparece todavía en diciembre con una cuota de 2.500.000 por pagar").
    //
    // CAUSA: esta suma filtraba por saldo y por sim, pero ignoraba la VIGENCIA
    // de la deuda. Se calculaba UNA cuota mensual y se aplicaba a los 12 meses
    // por igual —"mensuales por diseño", decía el comentario original—, así que
    // una deuda con hastaMes = septiembre seguía descontándose en octubre,
    // noviembre y diciembre.
    //
    // Marcar la deuda como pagada sí la sacaba (pone mt: 0), pero quien en vez
    // de eso ajusta la vigencia —que es lo que el formulario invita a hacer—
    // no veía ningún efecto acá. Dos caminos para el mismo hecho y solo uno
    // funcionaba.
    //
    // Los ingresos y los gastos de este mismo cálculo ya pasaban por
    // montoDelMes, que respeta frecuencia y vigencia. Las cuotas eran la única
    // línea que no. Ahora se calculan por mes, con el mismo criterio.
    const deudasVivas = deudas.filter(d => (d.mt || 0) > 0 && d.sim !== false);
    const cuotaDeudasEnMes = (mes) => deudasVivas.reduce((s, d) => {
      const desde = Number(d.desdeMes) || 1;
      const hasta = Number(d.hastaMes) || 12;
      if (mes < desde || mes > hasta) return s;
      return s + (d.pg || d.pago || 0);
    }, 0);

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

      const cuotasDeudasMes = cuotaDeudasEnMes(mes);
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
  // ─── Qué hizo distinto a un mes ──────────────────────────────────────
  // Compara cada concepto contra su propio promedio mensual y devuelve los que
  // se movieron. No es "cuánto pesó", es "cuánto se salió de lo típico", que es
  // la pregunta que uno se hace al ver un pico.
  //
  // Dos reglas heredadas del simulador, aprendidas a golpes:
  //  1. Un concepto FUERA DE SU VIGENCIA no se reporta. Un arriendo que empieza
  //     en octubre no le "quitó" plata a mayo: simplemente no existía. Listarlo
  //     como faltante hace desconfiar de toda la lista.
  //  2. En gastos el signo se invierte: gastar MÁS que lo típico empuja el mes
  //     hacia abajo, aunque el delta del gasto sea positivo.
  const detalleMes = useMemo(() => {
    if (!mesDetalle) return null;
    const trmR = trm || 4200;
    const mes = mesDetalle;
    // rangoEfectivo y no el declarado: en un item variable la vigencia suele
    // quedar en enero–diciembre aunque los montos cubran solo unos meses, y
    // entonces un ingreso que arranca en septiembre se reportaba como un
    // faltante de mayo.
    const fueraDeVigencia = (it) => {
      const { desde, hasta } = rangoEfectivo(it);
      return mes < desde || mes > hasta;
    };
    const movs = [];

    (user?.ingresos || []).forEach((ing) => {
      if (ing.sim === false || fueraDeVigencia(ing)) return;
      const base = { ...ing, mensual: (Number(ing.mensual) || 0) * (ing.moneda === "USD" ? trmR : 1) };
      const delM = montoDelMes(base, año, mes);
      const tipico = montoPromedioMensual(base);
      if (Math.round(delM - tipico) !== 0) {
        const r = rangoEfectivo(ing);
        movs.push({ nombre: ing.nombre || ing.fuente || L.ingresos, tipo: "ingreso",
                    monto: delM, tipico, efecto: delM - tipico,
                    mesesActivos: Math.max(0, r.hasta - r.desde + 1) });
      }
    });

    Object.entries(user?.gas || user?.gastos || {}).forEach(([cat, items]) => {
      (items || []).forEach((g) => {
        if (g.sim === false || fueraDeVigencia(g)) return;
        const delM = montoDelMes(g, año, mes);
        const tipico = montoPromedioMensual(g);
        if (Math.round(delM - tipico) !== 0) {
          const r = rangoEfectivo(g);
          movs.push({ nombre: g.c || cat, tipo: "gasto", cat,
                      monto: delM, tipico, efecto: -(delM - tipico),
                      mesesActivos: Math.max(0, r.hasta - r.desde + 1) });
        }
      });
    });

    // Cuotas: acá el movimiento es binario — la cuota aplica este mes o no.
    (user?.deu || user?.deudas || []).forEach((d) => {
      if (d.sim === false || (d.mt || 0) <= 0) return;
      const cuota = (Number(d.pg || d.pago) || 0) * (d.moneda === "USD" ? trmR : 1);
      if (cuota <= 0) return;
      const desde = Number(d.desdeMes) || 1;
      const hasta = Number(d.hastaMes) || 12;
      const vigentes = Math.max(0, Math.min(12, hasta) - Math.max(1, desde) + 1);
      const aplica = mes >= desde && mes <= hasta;
      const tipico = (cuota * vigentes) / 12;
      const delM = aplica ? cuota : 0;
      if (Math.round(delM - tipico) !== 0) {
        movs.push({ nombre: d.n || d.nombre || L.cuotas, tipo: "cuota",
                    monto: delM, tipico, efecto: -(delM - tipico),
                    mesesActivos: vigentes });
      }
    });

    // 27-sep-2026 (Santiago: "es confuso, Puerto Madero tuvo renta corta hasta
    // sept y renta tradicional de sept en adelante").
    //
    // Terminar NO es lo mismo que faltar. Un concepto que se acabó el mes
    // pasado sí cambió este mes —ya no entra esa plata— pero puntuarlo como un
    // faltante contra el promedio de 12 meses es aritmética equivocada: ese
    // promedio viene diluido por los meses en que el concepto no existía.
    // El dato útil no es un número, es el HECHO: esto empezó, esto terminó.
    //
    // En el caso de Puerto Madero son dos conceptos distintos sobre el mismo
    // activo relevándose. Nombrarlos juntos explica el mes; dos líneas sueltas,
    // una restando y otra sumando, no.
    const transiciones = [];
    const mirarTransicion = (it, tipo, nombre) => {
      if (it?.sim === false) return;
      const { desde, hasta } = rangoEfectivo(it);
      if (hasta < desde) return;                       // nunca tuvo vida
      if (desde === mes && mes !== 1) transiciones.push({ nombre, tipo, evento: "empieza" });
      else if (hasta === mes - 1) transiciones.push({ nombre, tipo, evento: "termino" });
      else if (hasta === mes && mes !== 12) transiciones.push({ nombre, tipo, evento: "ultimo" });
    };
    (user?.ingresos || []).forEach((i) => mirarTransicion(i, "ingreso", i.nombre || i.fuente || L.ingresos));
    Object.entries(user?.gas || user?.gastos || {}).forEach(([cat, items]) =>
      (items || []).forEach((g) => mirarTransicion(g, "gasto", g.c || cat)));
    (user?.deu || user?.deudas || []).forEach((d) => {
      if ((d.mt || 0) <= 0) return;
      mirarTransicion(d, "cuota", d.n || d.nombre || L.cuotas);
    });

    movs.sort((a, b) => Math.abs(b.efecto) - Math.abs(a.efecto));
    const dato = datosMensuales.find((d) => d.mes === mes);
    const promedioCF = datosMensuales.reduce((s, d) => s + d.cashFlow, 0) / 12;
    return {
      mes, dato, transiciones,
      contraPromedio: (dato?.cashFlow || 0) - promedioCF,
      suben: movs.filter((m) => m.efecto > 0),
      bajan: movs.filter((m) => m.efecto < 0),
    };
  }, [mesDetalle, user, trm, año, datosMensuales, L.ingresos, L.cuotas]);

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

    // Cuotas de deudas (agrupadas en una categoría).
    // 27-sep-2026 — Mismo defecto que arriba, y acá pesaba más: multiplicar la
    // cuota por 12 le cobra el año entero a una deuda que corre medio año. Una
    // cuota de $2,5M vigente hasta septiembre inflaba la categoría en $7,5M.
    const cuotasAnual = deudas
      .filter(d => (d.mt || 0) > 0 && d.sim !== false)
      .reduce((s, d) => {
        const desde = Number(d.desdeMes) || 1;
        const hasta = Number(d.hastaMes) || 12;
        const mesesVigentes = Math.max(0, Math.min(12, hasta) - Math.max(1, desde) + 1);
        return s + (d.pg || d.pago || 0) * mesesVigentes;
      }, 0);
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
              <span style={{ width: 10, height: 10, background: T.gn, borderRadius: 3 }}></span>
              <span style={{ color: T.txt2 }}>Ingresos</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, background: T.rd, borderRadius: 3 }}></span>
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
            <ComposedChart data={datosMensuales} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              onClick={(e) => {
                const i = e?.activeTooltipIndex;
                if (typeof i !== "number" || !datosMensuales[i]) return;
                const m = datosMensuales[i].mes;
                setMesDetalle((prev) => (prev === m ? null : m));
              }}
              style={{ cursor: "pointer" }}>
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

        {!detalleMes && (
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 8, textAlign: "center" }}>
            {isEN ? "Click any month to see what made it different."
                  : "Tocá cualquier mes para ver qué lo hizo distinto."}
          </div>
        )}

        {detalleMes && (() => {
          const d = detalleMes.dato || {};
          const vs = detalleMes.contraPromedio;
          // 27-sep-2026 (Santiago, sobre esta misma tabla: "¿por qué arriendo me
          // aparece en ingreso?"). El cálculo estaba bien: pagó $10M de arriendo
          // contra $13,3M habituales, así que ahorró $3,3M y eso empujó el mes
          // hacia arriba. Lo que fallaba era la lectura.
          //
          // El gasto quedaba sentado entre cinco líneas que decían "Ingresos",
          // con un signo + y en verde, y su naturaleza vivía en una palabra gris
          // y pequeña ("Vivienda"), fácil de pasar por alto. A él, que construyó
          // la plataforma, le tomó una captura y tres mensajes entenderlo; un
          // cliente simplemente desconfía del número.
          //
          // Segunda aparición del mismo problema: ya lo había señalado con
          // BROOKFORT en el simulador. En una lista mezclada el color no alcanza
          // — la fila tiene que decir QUÉ ES y POR QUÉ suma.
          const NATURALEZA = {
            ingreso: { et: isEN ? "Income" : "Ingreso", c: T.gn },
            gasto:   { et: isEN ? "Expense" : "Gasto",  c: T.rd },
            cuota:   { et: isEN ? "Loan" : "Cuota",     c: T.pr || T.rd },
          };
          const sufijo = (m) => {
            if (m.tipo === "ingreso") return m.efecto > 0
              ? (isEN ? "more income" : "más ingreso") : (isEN ? "less income" : "menos ingreso");
            if (m.tipo === "cuota") return m.efecto > 0
              ? (isEN ? "no payment due" : "no cae este mes") : (isEN ? "payment due" : "cuota del mes");
            return m.efecto > 0
              ? (isEN ? "saved" : "ahorro") : (isEN ? "extra spend" : "gasto extra");
          };
          const Fila = ({ m }) => {
            const arriba = m.efecto > 0;
            const nat = NATURALEZA[m.tipo] || NATURALEZA.gasto;
            const verbo = m.tipo === "ingreso" ? (isEN ? "recibió" : "recibió") : (isEN ? "paid" : "pagó");
            return (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    gap: 10, padding: "7px 0", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.txt2, minWidth: 0, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 140px" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
                        color: nat.c, background: nat.c + "1A", borderRadius: 3,
                        padding: "1px 5px", marginRight: 6 }}>{nat.et}</span>
                  {m.nombre}
                  {m.cat && m.tipo === "gasto" && (
                    <span style={{ fontSize: 10, color: T.txt3, marginLeft: 6 }}>{m.cat}</span>
                  )}
                </span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 9, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: T.txt3 }}>
                    {/* 27-sep-2026 — Decía "no cae este mes" para todo.
                        Santiago: "¿qué quiere decir que no cae? eso no se
                        entiende". Es jerga contable, y para un ingreso no
                        significa nada. Cada naturaleza dice lo suyo. */}
                    {m.monto === 0
                      ? (m.tipo === "ingreso"
                          ? (isEN ? "no income this month" : "este mes no entró")
                          : m.tipo === "cuota"
                            ? (isEN ? "no payment this month" : "este mes no hubo cuota")
                            : (isEN ? "nothing paid this month" : "este mes no se pagó"))
                      : <>{isEN ? (m.tipo === "ingreso" ? "received" : "paid") : verbo}{" "}
                          <span style={{ fontFamily: "monospace" }}>{fm(m.monto)}</span>
                          {/* 27-sep-2026 (Santiago: "la renta tradicional Puerto
                              Madero no existía, ¿por qué dice que lo habitual
                              era 16mm?"). Tenía razón: ese concepto nunca
                              recibió $16,25M en ningún mes. Es su total del año
                              repartido entre 12, incluidos los ocho meses en
                              que no existía.

                              La cifra NO se puede cambiar: el titular de arriba
                              compara este mes contra el promedio de los 12
                              meses, y estas líneas descomponen ese titular. Si
                              cada una usara su propio promedio activo, dejarían
                              de sumar a lo que dice el titular.

                              Lo que sí estaba mal era llamarla "habitual", que
                              afirma algo falso. Ahora se nombra por lo que es
                              —el prorrateo del año— y, cuando el concepto vivió
                              menos de 12 meses, se dice cuántos, que es
                              justamente el dato que faltaba para entenderla. */}
                          {" · "}{isEN ? "yearly proration" : "prorrateo del año"}{" "}
                          <span style={{ fontFamily: "monospace" }}>{fm(m.tipico)}</span>
                          {m.mesesActivos > 0 && m.mesesActivos < 12 && (
                            <span style={{ opacity: 0.75 }}>
                              {" "}({isEN ? `active ${m.mesesActivos} mo` : `activo ${m.mesesActivos} ${m.mesesActivos === 1 ? "mes" : "meses"}`})
                            </span>
                          )}</>}
                  </span>
                  <span style={{ textAlign: "right", minWidth: 104 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace",
                          color: arriba ? T.gn : T.rd, display: "block" }}>
                      {(arriba ? "+" : "−") + fm(Math.abs(m.efecto))}
                    </span>
                    <span style={{ fontSize: 10, color: T.txt3, display: "block" }}>{sufijo(m)}</span>
                  </span>
                </span>
              </div>
            );
          };
          return (
            <div style={{ marginTop: 14, background: T.bg3, border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>
                    {d.mesLabelFull} {año}
                  </div>
                  <div style={{ fontSize: 12, color: T.txt2, marginTop: 2 }}>
                    {L.ingresos} {fm(d.ingresos)} · {L.egresos} {fm(d.egresos)} ·{" "}
                    <strong style={{ color: d.cashFlow >= 0 ? T.gn : T.rd }}>
                      {L.cashflow} {fm(d.cashFlow)}
                    </strong>
                  </div>
                </div>
                <button onClick={() => setMesDetalle(null)}
                  style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3,
                        borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                  {isEN ? "Close" : "Cerrar"}
                </button>
              </div>

              <div style={{ fontSize: 12, color: T.txt2, margin: "8px 0 12px", lineHeight: 1.5 }}>
                {Math.round(vs) === 0
                  ? (isEN ? "This month matched the yearly average." : "Este mes rindió igual que el promedio del año.")
                  : (<>
                      {isEN ? "This month ran " : "Este mes rindió "}
                      <strong style={{ color: vs > 0 ? T.gn : T.rd }}>
                        {fm(Math.abs(vs))} {vs > 0 ? (isEN ? "above" : "por encima") : (isEN ? "below" : "por debajo")}
                      </strong>
                      {isEN ? " the yearly average. What moved it:" : " del promedio del año. Qué lo movió:"}
                    </>)}
              </div>

              {detalleMes.transiciones.length > 0 && (
                <div style={{ marginBottom: 12, padding: "9px 12px", background: T.bg2,
                      border: `1px solid ${T.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
                        textTransform: "uppercase", color: T.txt3, marginBottom: 5 }}>
                    {isEN ? "Changes this month" : "Cambios de este mes"}
                  </div>
                  {detalleMes.transiciones.map((t, i) => (
                    <div key={i} style={{ fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
                      <span style={{ color: t.evento === "termino" ? T.rd : t.evento === "empieza" ? T.gn : T.gd,
                            fontWeight: 800, marginRight: 6 }}>
                        {t.evento === "termino" ? "◀" : t.evento === "empieza" ? "▶" : "◆"}
                      </span>
                      <strong style={{ color: T.txt }}>{t.nombre}</strong>{" "}
                      {t.evento === "empieza" && (isEN ? "starts this month." : "empieza este mes.")}
                      {t.evento === "termino" && (isEN ? "ended last month — it no longer comes in." : "terminó el mes pasado — ya no entra.")}
                      {t.evento === "ultimo" && (isEN ? "is in its last month." : "va en su último mes.")}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px,100%), 1fr))", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
                        color: T.gn, marginBottom: 4 }}>
                    {isEN ? "Pushed it up" : "Lo empujó arriba"}
                  </div>
                  {detalleMes.suben.length === 0
                    ? <div style={{ fontSize: 12, color: T.txt3, padding: "6px 0" }}>{isEN ? "Nothing above its usual level." : "Nada por encima de su nivel habitual."}</div>
                    : detalleMes.suben.slice(0, 6).map((m, i) => <Fila key={"s" + i} m={m} />)}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
                        color: T.rd, marginBottom: 4 }}>
                    {isEN ? "Pushed it down" : "Lo empujó abajo"}
                  </div>
                  {detalleMes.bajan.length === 0
                    ? <div style={{ fontSize: 12, color: T.txt3, padding: "6px 0" }}>{isEN ? "Nothing above its usual level." : "Nada por encima de su nivel habitual."}</div>
                    : detalleMes.bajan.slice(0, 6).map((m, i) => <Fila key={"b" + i} m={m} />)}
                </div>
              </div>

              <div style={{ fontSize: 11, color: T.txt3, marginTop: 11, lineHeight: 1.5 }}>
                {isEN
                  ? "The baseline is the yearly average, the same one in the headline above, so each concept is compared against its total spread over 12 months. For one that ran only part of the year, that proration is lower than what it actually brought in each active month — the month count next to the figure says how many."
                  : "La referencia es el promedio del año, el mismo del titular de arriba, así que cada concepto se compara contra su total repartido en 12 meses. En uno que solo corrió parte del año, ese prorrateo es menor que lo que realmente entraba cada mes activo: el número de meses al lado de la cifra dice cuántos fueron."}
              </div>
            </div>
          );
        })()}
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
                    {/* 4-oct-2026: el tooltip por defecto de Recharts pinta el
                        texto en negro sobre nuestro fondo oscuro ("no se lee
                        nada"). Se usa el del sistema como el resto de gráficos. */}
                    <Tooltip content={<ChartTooltip formatter={(v, n, p) =>
                      `$${Math.round(v).toLocaleString("es-CO")}${p?.payload?.pct != null ? ` (${p.payload.pct.toFixed(1)}%)` : ""}`} />} />
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
                    {/* 4-oct-2026: el tooltip por defecto de Recharts pinta el
                        texto en negro sobre nuestro fondo oscuro ("no se lee
                        nada"). Se usa el del sistema como el resto de gráficos. */}
                    <Tooltip content={<ChartTooltip formatter={(v, n, p) =>
                      `$${Math.round(v).toLocaleString("es-CO")}${p?.payload?.pct != null ? ` (${p.payload.pct.toFixed(1)}%)` : ""}`} />} />
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
      <Disclaimer variante="general" T={T} idioma={isEN ? "en" : "es"} />
    </div>
  );
}
