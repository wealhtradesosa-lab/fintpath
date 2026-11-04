// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Informe de un escenario (Mi futuro a 10 años · Resultado)
//
// 24-oct-2026 (Santiago: "los gráficos de los escenarios están muy flojos…
// necesito que los escenarios se vean como el HTML… elige cuál quiere ver en
// detalle y lo ve con todo"). Referencia: su "Plan Patrimonial SALEM". Mismos
// capítulos, mismas preguntas, mismo orden:
//   · Qué tienes y cuánto produce (fichas)
//   · Mes a mes: ¿alcanza para vivir? (entra vs. sale, franja de lo que sobra)
//   · 1 La plata nueva: a dónde va cada peso
//   · 2 Todo lo que tienes después del plan  ·  Cuánto produce cada activo
//   · Año a año: todo lo que produce el patrimonio (+ qué cambia ese año)
//   · 3 Patrimonio neto por año  ·  Cada inversión, año por año
//   · Le gana a la inflación, año por año
//   · 4 Año por año
// Solo lee el resultado del motor (proyectarFuturo10); no calcula nada nuevo.
// ═══════════════════════════════════════════════════════════════════════════
import { anioCal } from "../lib/futuro10.js";
import MesCompleto from "./MesCompleto.jsx";
import { useMemo, useState } from "react";
import { ComposedChart, BarChart, Bar, Area, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList, Cell } from "recharts";
import { ChartTooltip } from "../lib/chartTheme.jsx";
import { INF, COLOR_CLASE, ETQ_CLASE, fmM, fmEje, fmPct } from "../lib/informeTheme.js";
import { tx, esUS, inflacionDefaultPct } from "../lib/region.js";

// 3-nov-2026: textos en el idioma de la sesión y moneda del país (region.js).
const moneda = () => (esUS() ? tx("dólar", "dollar") : tx("peso", "peso"));
const monedas = () => (esUS() ? tx("dólares", "dollars") : tx("pesos", "pesos"));

const card = { background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const h3 = { margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: INF.tx };
const lead = { margin: "0 0 12px", fontSize: 12, color: INF.tx2, lineHeight: 1.5 };
const eje = { tick: { fill: INF.tx2, fontSize: 12 }, axisLine: { stroke: INF.eje }, tickLine: { stroke: INF.eje } };
const grid = { strokeDasharray: "0", stroke: INF.grid, vertical: false };
const th = { textAlign: "right", fontWeight: 600, color: INF.tx2, padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, whiteSpace: "nowrap" };
const td = { textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, color: INF.tx, whiteSpace: "nowrap" };
const tdL = { ...td, textAlign: "left", whiteSpace: "normal" };
const anioTxt = (a) => (a === 0 ? tx("Hoy", "Today") : String(anioCal(a)));
const tip = (v) => fmM(v);

/** Lo que pasa cada año, en palabras (para las marcas y la columna «Qué cambia ese año»). */
export function eventosDelPlan(r) {
  const ev = [];
  if ((r.vendidos || []).length) ev.push({ anio: 0, corto: tx("Vendes", "You sell"), texto: `${tx("Vendes", "You sell")} ${r.vendidos.map((v) => v.nombre).join(", ")}: ${fmM(r.vendidos.reduce((s, v) => s + v.valor, 0))}` });
  (r.deudas || []).filter((d) => d.pagado > 0).forEach((d) => ev.push({ anio: 0, corto: tx("Pagas deudas", "Pay off debts"), texto: `${tx("Pagas", "You pay off")} ${d.nombre}: ${fmM(d.pagado)}` }));
  (r.reinversionesDetalle || []).forEach((x) => {
    if (x.aporte > 0) ev.push({ anio: Math.max(0, (x.anio || 1) - 1), corto: x.nombre, texto: tx(`Le inviertes ${fmM(x.aporte)} a ${x.nombre}`, `You invest ${fmM(x.aporte)} in ${x.nombre}`) });
    if (x.rentaMensual > 0) { const a = Math.floor((x.rentaDesdeMes || 0) / 12) + 1; ev.push({ anio: a, corto: `${x.nombre} ${tx("renta", "income")}`, texto: tx(`${x.nombre} empieza a rentar: +${fmM(x.rentaMensual)}/mes`, `${x.nombre} starts paying: +${fmM(x.rentaMensual)}/mo`) }); }
  });
  (r.nuevasDetalle || []).forEach((x) => ev.push({ anio: Math.max(0, (x.anio || 1) - 1), corto: x.nombre, texto: tx(`Inviertes ${fmM(x.monto)} en ${x.nombre}`, `You invest ${fmM(x.monto)} in ${x.nombre}`) }));
  const fut = r.futuros || { ingresos: [], activos: [] };
  fut.ingresos.forEach((x) => ev.push({ anio: x.desde, corto: x.nombre, texto: `${x.nombre}: +${fmM(x.mensual)}${tx("/mes", "/mo")}` }));
  fut.activos.forEach((x) => ev.push({ anio: x.entrega, corto: x.nombre, texto: `${tx("Recibes", "You receive")} ${x.nombre}` }));
  (fut.gastos || []).forEach((x) => { ev.push({ anio: x.desde, corto: x.nombre, texto: tx(`Empieza ${x.nombre}: −${fmM(x.anual)}/año`, `${x.nombre} starts: −${fmM(x.anual)}/yr`) }); if (x.hasta < 99) ev.push({ anio: x.hasta + 1, corto: `${tx("Fin", "End")} ${x.nombre}`, texto: tx(`Termina ${x.nombre}`, `${x.nombre} ends`) }); });
  (r.alertas || []).filter((a) => a.tipo === "pago_unico").forEach((a) => ev.push({ anio: a.anio, corto: tx("Pago único", "One-time payment"), texto: a.texto.replace(/^(En|In) \d{4},? /, "") }));
  return ev.sort((a, b) => a.anio - b.anio);
}

/** Agrupa activos en las N series más grandes + «Otros», estable en todos los años. */
function series(filas, campo, n = 5) {
  const tot = {};
  filas.forEach((f) => (f.porActivo || []).forEach((a) => { tot[a.id] = (tot[a.id] || 0) + Math.abs(a[campo] || 0); }));
  const ids = Object.keys(tot).filter((k) => tot[k] > 0.5).sort((a, b) => tot[b] - tot[a]);
  const top = ids.slice(0, n), resto = ids.slice(n);
  const nombre = {}, clase = {};
  filas.forEach((f) => (f.porActivo || []).forEach((a) => { nombre[a.id] = a.nombre; clase[a.id] = a.clase; }));
  return { top: top.map((id, i) => ({ id, nombre: nombre[id], clase: clase[id], color: INF.serie[i % INF.serie.length] })), resto };
}

export default function PlanInforme({ r, nombre = tx("Este escenario", "This scenario"), inflacionPct = inflacionDefaultPct() }) {
  const [modo, setModo] = useState("nominal"); // nominal | real (plata de hoy)
  const filas = r.filas || [];
  const d = (f) => (modo === "real" ? f.deflactor || 1 : 1);
  const ev = useMemo(() => eventosDelPlan(r), [r]);
  const f0 = filas[0] || {}, f1 = filas[1] || f0, fin = filas[filas.length - 1] || f0;

  // ── Fichas ────────────────────────────────────────────────────────────────
  const produceMes = ((f1.rentas || 0) + (f1.crece || 0)) / 12;
  const rentaMes = (f1.rentas || 0) / 12, multiplicaMes = (f1.crece || 0) / 12;
  const saleMes = (f1.gastos || 0) / 12, entraMes = (f1.ingresos || 0) / 12;
  const rendimiento = f1.activos > 0 ? ((f1.rentas || 0) + (f1.crece || 0)) / f1.activos * 100 : 0;
  const cagr = f0.patrimonio > 0 && fin.patrimonio > 0 ? (Math.pow(fin.patrimonio / f0.patrimonio, 1 / Math.max(1, fin.anio)) - 1) * 100 : null;
  const real = cagr == null ? null : ((1 + cagr / 100) / (1 + inflacionPct / 100) - 1) * 100;

  // ── Mes a mes ─────────────────────────────────────────────────────────────
  // 25-oct-2026 (Santiago: "en el año cero me sale que no ingresa BTG… no sé
  // por qué no se ve de una"). El flujo mes a mes arranca en el año 1: el plan
  // empieza ya y lo que produce se cuenta desde el primer mes. «Hoy» (antes del
  // plan) solo confundía.
  const mes = filas.slice(1).map((f) => { const e = (f.ingresos || 0) / 12 / d(f), s = (f.gastos || 0) / 12 / d(f); return { anio: anioTxt(f.anio), entra: e, sale: s, base: Math.min(e, s), sobra: Math.max(0, e - s) }; });
  const apretado = filas.slice(1).reduce((m, f) => { const s = (f.ingresos - f.gastos) / 12 / d(f); return m == null || s < m.s ? { s, f } : m; }, null);
  const marcas = []; ev.forEach((e) => { if (e.anio > 0 && !marcas.some((m) => m.anio === e.anio)) marcas.push({ anio: e.anio, txt: ev.filter((x) => x.anio === e.anio).map((x) => x.corto).slice(0, 2).join(" + ") }); });

  // ── Año a año: lo que produce ─────────────────────────────────────────────
  const conSueltas = (f) => ({ ...f, porActivo: [...(f.porActivo || []), ...(f.rentasSueltas || [])] });
  const sR = series(filas.slice(1).map(conSueltas), "renta", 6), sC = series(filas.slice(1), "crece", 4);
  const prod = filas.slice(1).map((f) => {
    const row = { anio: anioTxt(f.anio), total: f.produce / d(f), sale: f.gastos / d(f) };
    const pa = Object.fromEntries((f.porActivo || []).map((a) => [a.id, a]));
    const paR = Object.fromEntries(conSueltas(f).porActivo.map((a) => [a.id, a]));
    let rOtros = (f.rentas || 0); sR.top.forEach((s) => { const v = (paR[s.id]?.renta || 0); row["r_" + s.id] = v / d(f); rOtros -= v; });
    row.r_otros = Math.max(0, rOtros) / d(f);
    let cOtros = (f.crece || 0); sC.top.forEach((s) => { const v = Math.max(0, pa[s.id]?.crece || 0); row["c_" + s.id] = v / d(f); cOtros -= v; });
    row.c_otros = Math.max(0, cOtros) / d(f);
    return row;
  });

  // ── Patrimonio por año / cada inversión ───────────────────────────────────
  const sV = series(filas, "valor", 5);
  const pat = filas.map((f) => {
    const row = { anio: anioTxt(f.anio), total: f.patrimonio / d(f), totalEt: f.anio % 2 === 0 || f.anio === filas.length - 1 ? fmM(f.patrimonio / d(f)) : "" };
    const pa = Object.fromEntries((f.porActivo || []).map((a) => [a.id, a]));
    let otros = f.patrimonio; sV.top.forEach((s) => { const v = pa[s.id]?.valor || 0; row[s.id] = v / d(f); otros -= v; });
    row.otros = otros / d(f);
    return row;
  });
  const sL = sV.top.slice(0, 4);

  // ── Le gana a la inflación ────────────────────────────────────────────────
  const gana = filas.slice(1).map((f, i) => { const prev = filas[i]; const g = prev.patrimonio > 0 ? (f.patrimonio / prev.patrimonio - 1) * 100 : 0; return { anio: anioTxt(f.anio), g, realTxt: `${g - inflacionPct >= 0 ? "+" : ""}${fmPct(g - inflacionPct, 1)}` }; });
  const ganaN = gana.filter((x) => x.g > inflacionPct).length;

  // ── Plata nueva ───────────────────────────────────────────────────────────
  const bd = r.bolsaDetalle || {};
  const plataNueva = [
    ...((r.deudas || []).some((x) => x.pagado > 0) ? [{ destino: `${tx("Pagar deudas", "Pay off debts")} (${r.deudas.filter((x) => x.pagado > 0).map((x) => x.nombre).join(", ")})`, capital: bd.deudas, tasa: "—", bolsillo: tx("Limpieza", "Cleanup"), regla: r.cuotasQueSalenMes > 0 ? tx(`Se elimina ${fmM(r.cuotasQueSalenMes)}/mes de cuotas`, `Removes ${fmM(r.cuotasQueSalenMes)}/mo in payments`) : tx("Sale del patrimonio la deuda", "The debt leaves your net worth") }] : []),
    ...(r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => ({ destino: x.nombre, capital: x.aporte, tasa: x.rendimientoPct != null ? fmPct(x.rendimientoPct, 1) : x.rentaPctAnual > 0 ? fmPct(x.rentaPctAnual, 1) : "—", bolsillo: x.clase === "inmueble" || (x.pctRecibe || 0) > 0 ? tx("Sustento", "Income") : tx("Crecimiento", "Growth"), regla: [x.rentaMensual > 0 ? tx(`Renta ${fmM(x.rentaMensual)}/mes desde ${x.rentaDesdeMes ? `el mes ${x.rentaDesdeMes}` : "ya"}`, `Pays ${fmM(x.rentaMensual)}/mo ${x.rentaDesdeMes ? `from month ${x.rentaDesdeMes}` : "starting now"}`) : null, x.teLlegaMes > 0 ? tx(`Te llega ${fmM(x.teLlegaMes)}/mes`, `You receive ${fmM(x.teLlegaMes)}/mo`) : null, x.anio > 1 ? tx(`Se invierte en ${x.anio - 1} año${x.anio === 2 ? "" : "s"}`, `Invested in ${x.anio - 1} year${x.anio === 2 ? "" : "s"}`) : null].filter(Boolean).join(" · ") || tx("Se valoriza", "Appreciates") })),
    ...(r.nuevasDetalle || []).map((x) => ({ destino: x.nombre, capital: x.monto, tasa: fmPct(x.rendPct, 1), bolsillo: x.pagaRenta ? tx("Sustento", "Income") : tx("Crecimiento", "Growth"), regla: x.pagaRenta ? tx("Paga renta al flujo", "Pays income to your cash flow") : tx("Se reinvierte", "Reinvested") })),
    ...(bd.colchon > 0 ? [{ destino: tx("Colchón", "Emergency fund"), capital: bd.colchon, tasa: "—", bolsillo: tx("Protección", "Safety"), regla: tx("Meses de gastos a la mano", "Months of expenses on hand") }] : []),
    ...(bd.restante > 0 ? [{ destino: tx("Lo que sobra de las ventas", "What's left from the sales"), capital: bd.restante, tasa: "—", bolsillo: tx("Mezcla", "Mix"), regla: r.destinoSobra || tx("Se reparte según el norte que elegiste", "Split by the strategy you picked") }] : []),
  ];
  const totalNueva = plataNueva.reduce((s, x) => s + (x.capital || 0), 0);

  // ── Todo lo que tienes / cuánto produce ───────────────────────────────────
  const tienes = (f1.porActivo || []).filter((a) => a.valor > 0.5).sort((a, b) => b.valor - a.valor);
  const totTienes = tienes.reduce((s, a) => s + a.valor, 0);
  const produce = (f1.porActivo || []).map((a) => ({ ...a, rM: a.renta / 12, cM: Math.max(0, a.crece) / 12 })).filter((a) => a.rM + a.cM > 0.5).sort((a, b) => b.rM + b.cM - (a.rM + a.cM));
  const maxProd = Math.max(1, ...produce.map((a) => a.rM + a.cM));

  const Toggle = () => <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
    {[["nominal", esUS() ? tx("Dólares de cada año", "Each year's dollars") : tx("Pesos de cada año", "Each year's pesos")], ["real", esUS() ? tx("En dólares de hoy", "In today's dollars") : tx("En pesos de hoy", "In today's pesos")]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${modo === k ? INF.tx : INF.linea}`, background: modo === k ? INF.tx : "transparent", color: modo === k ? INF.panel : INF.tx2, fontSize: 12, cursor: "pointer" }}>{l}</button>)}
  </div>;

  const Ficha = ({ l, v, s, col }) => <div style={{ ...card, marginBottom: 0, padding: 14 }}>
    <div style={{ fontSize: 12, color: INF.tx2 }}>{l}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: col || INF.tx, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", margin: "4px 0" }}>{v}</div>
    <div style={{ fontSize: 12, color: INF.tx2, lineHeight: 1.4 }}>{s}</div>
  </div>;

  const finLabel = (key, txt, color) => (p) => (p.index === mes.length - 1 ? <text x={p.x + 6} y={p.y + 4} fill={color} fontSize={12} fontWeight={600}>{txt}</text> : null);

  return (
    <div style={{ color: INF.tx }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <Ficha l={tx(`Patrimonio en ${anioCal(10)}`, `Net worth in ${anioCal(10)}`)} v={fmM(fin.patrimonio / d(fin))} s={`${tx("hoy", "today")} ${fmM(f0.patrimonio)}${cagr != null ? tx(` · crece ${fmPct(cagr, 1)} al año`, ` · grows ${fmPct(cagr, 1)} a year`) : ""}`} />
        <Ficha l={tx("Produce al mes", "Earns per month")} v={fmM(produceMes)} s={tx(`renta ${fmM(rentaMes)} + multiplica ${fmM(multiplicaMes)}`, `income ${fmM(rentaMes)} + compounding ${fmM(multiplicaMes)}`)} />
        <Ficha l={tx("Rendimiento del patrimonio", "Return on net worth")} v={fmPct(rendimiento, 1)} s={tx("anual, sobre lo que tienes", "per year, on what you own")} />
        <Ficha l={tx("Sale al mes", "Goes out per month")} v={fmM(saleMes)} s={tx("gastos + cuotas", "expenses + loan payments")} />
        <Ficha l={entraMes - saleMes >= 0 ? tx("Sobra al mes y se reinvierte", "Monthly surplus, reinvested") : tx("Falta al mes", "Monthly shortfall")} v={`${entraMes - saleMes >= 0 ? "+" : ""}${fmM(entraMes - saleMes)}`} s={entraMes - saleMes >= 0 ? (r.destinoSobra || tx("lo que entra menos lo que sale", "what comes in minus what goes out")) : tx("sale de tu liquidez", "comes out of your cash")} col={entraMes - saleMes >= 0 ? INF.txOk : INF.txBad} />
        <Ficha l={tx("Le gana a la inflación", "Beats inflation")} v={real == null ? "—" : `${real >= 0 ? "+" : ""}${fmPct(real, 1)}`} s={tx(`real al año · en ${ganaN} de ${gana.length} años`, `real per year · in ${ganaN} of ${gana.length} years`)} col={real != null && real >= 0 ? INF.txOk : INF.txBad} />
      </div>

      {(r.desglose?.reinvierte || []).length > 0 && <div style={{ ...card, borderColor: INF.dorado }}>
        <h3 style={h3}>{tx("Lo que rinde y no te llega al mes", "Returns that don't reach you monthly")}</h3>
        <p style={lead}>{esUS()
          ? tx("Estas inversiones producen, pero todo se reinvierte: hacen crecer el patrimonio y no suman a lo que entra cada mes. Si alguna te paga (un bono o una cuenta que paga intereses), cámbiala en el paso 3, Tu plata → «De lo que rinde, ¿cuánto te llega?».", "These investments earn, but everything is reinvested: they grow your net worth and don't add to your monthly income. If one pays you (a bond or an interest-paying account), change it in step 3, Your money → \"Of what it earns, how much reaches you?\".")
          : tx("Estas inversiones producen, pero todo se reinvierte: hacen crecer el patrimonio y no suman a lo que entra cada mes. Si alguna te paga (una renta fija como BTG), cámbiala en el paso 3, Tu plata → «De lo que rinde, ¿cuánto te llega?».", "These investments earn, but everything is reinvested: they grow your net worth and don't add to your monthly income. If one pays you (fixed income such as BTG), change it in step 3, Your money → \"Of what it earns, how much reaches you?\".")}</p>
        {r.desglose.reinvierte.map((x) => <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${INF.linea}` }}><span>{x.nombre} <span style={{ color: INF.tx2, fontSize: 12 }}>· {fmPct(x.pct, 1)} {tx("al año", "a year")}</span></span><b style={{ color: INF.txDorado, whiteSpace: "nowrap" }}>{fmM(x.mensual)}{tx("/mes se reinvierte", "/mo reinvested")}</b></div>)}
      </div>}

      <MesCompleto r={r} card={card} h3={h3} lead={lead} />

      <Toggle />

      <div style={card}>
        <h3 style={h3}>{tx("Mes a mes: ¿alcanza para vivir? Así se comporta el plan en el tiempo", "Month by month: is it enough to live on? How the plan holds up over time")}</h3>
        <p style={lead}>{tx(<><b>Línea azul:</b> lo que entra cada mes. <b>Línea roja punteada:</b> lo que sale para vivir. <b>Franja verde:</b> lo que sobra, que no se queda quieto: {r.destinoSobra || "se reinvierte"}. Las líneas verticales marcan los cambios. Mientras la azul esté por encima de la roja, el plan se sostiene solo.</>, <><b>Blue line:</b> what comes in each month. <b>Dashed red line:</b> what goes out to live. <b>Green band:</b> the surplus, which doesn't sit idle: {r.destinoSobra || "it's reinvested"}. Vertical lines mark changes. As long as blue stays above red, the plan pays for itself.</>)}</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={mes} margin={{ top: 40, right: 96, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={72} />
            <Tooltip content={(q) => <ChartTooltip {...q} payload={(q.payload || []).filter((x) => x.dataKey !== "base")} formatter={tip} />} />
            <Area type="stepAfter" dataKey="base" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" name=" " tooltipType="none" />
            <Area type="stepAfter" dataKey="sobra" stackId="b" stroke="none" fill={INF.franja} isAnimationActive={false} name={tx("Sobra", "Surplus")} />
            {marcas.map((m, i) => <ReferenceLine key={m.anio} x={anioTxt(m.anio)} stroke={INF.ref} strokeDasharray="2 3"
              label={(q) => <text x={q.viewBox.x + 4} y={q.viewBox.y - 6 - (i % 2) * 14} style={{ fill: INF.tx2 }} fontSize={11}>{m.txt.length > 26 ? m.txt.slice(0, 25) + "…" : m.txt}</text>} />)}
            <Line type="stepAfter" dataKey="entra" name={tx("Entra", "In")} stroke={INF.azul} strokeWidth={2.5} dot={false} label={finLabel("entra", `${tx("Entra", "In")} ${fmM(mes[mes.length - 1]?.entra)}`, INF.azul)} />
            <Line type="stepAfter" dataKey="sale" name={tx("Sale", "Out")} stroke={INF.teja} strokeWidth={2} strokeDasharray="5 4" dot={false} label={finLabel("sale", `${tx("Sale", "Out")} ${fmM(mes[mes.length - 1]?.sale)}`, INF.teja)} />
          </ComposedChart>
        </ResponsiveContainer></div></div>
        {apretado && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 4 }}>{tx("Año más apretado:", "Tightest year:")} <b style={{ color: apretado.s >= 0 ? INF.tx : INF.txBad }}>{anioTxt(apretado.f.anio)}, {apretado.s >= 0 ? tx(`sobran ${fmM(apretado.s)}`, `${fmM(apretado.s)} surplus`) : tx(`faltan ${fmM(-apretado.s)}`, `${fmM(-apretado.s)} short`)} {tx("al mes", "a month")} ({fmPct(apretado.f.gastos > 0 ? apretado.f.ingresos / apretado.f.gastos * 100 : 0, 0)} {tx("de cobertura", "coverage")})</b>.</div>}
      </div>

      {plataNueva.length > 0 && <div style={card}>
        <h3 style={h3}>{tx(`1 · La plata nueva: a dónde va cada ${moneda()}`, `1 · New money: where every ${moneda()} goes`)} · {fmM(totalNueva)}</h3>
        <p style={lead}>{tx(<>Solo la plata que se mueve: lo que vendes{bd.capitalNuevo > 0 ? ", el capital nuevo" : ""}{bd.desdeLiquidez > 0 ? " y lo que sale de tu liquidez" : ""}. Lo que ya tienes y no se mueve no aparece aquí; eso lo suma el punto 2.</>, <>Only the money that moves: what you sell{bd.capitalNuevo > 0 ? ", new capital" : ""}{bd.desdeLiquidez > 0 ? " and what comes out of your cash" : ""}. What you already own and don't move isn't here; section 2 adds it.</>)}</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("Destino", "Destination")}</th><th style={th}>{tx("Capital", "Capital")}</th><th style={th}>{tx("Tasa", "Rate")}</th><th style={{ ...th, textAlign: "left" }}>{tx("Bolsillo", "Bucket")}</th><th style={{ ...th, textAlign: "left" }}>{tx("Regla", "Rule")}</th></tr></thead>
          <tbody>{plataNueva.map((x, i) => <tr key={i}><td style={tdL}>{x.destino}</td><td style={td}>{fmM(x.capital)}</td><td style={td}>{x.tasa}</td><td style={{ ...tdL, color: INF.tx2 }}>{x.bolsillo}</td><td style={{ ...tdL, color: INF.tx2 }}>{x.regla}</td></tr>)}
            <tr><td style={{ ...tdL, fontWeight: 700 }}>{tx("Total desplegado", "Total deployed")}</td><td style={{ ...td, fontWeight: 700 }}>{fmM(totalNueva)}</td><td style={td} /><td style={td} /><td style={{ ...tdL, color: INF.tx2 }}>{[(r.vendidos || []).map((v) => `${v.nombre} ${fmM(v.valor)}`).join(" + "), bd.capitalNuevo > 0 ? `${tx("capital nuevo", "new capital")} ${fmM(bd.capitalNuevo)}` : null, bd.desdeLiquidez > 0 ? `${tx("liquidez", "cash")} ${fmM(bd.desdeLiquidez)}` : null].filter(Boolean).join(" + ")}</td></tr>
          </tbody></table></div>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        <div style={card}>
          <h3 style={h3}>{tx("2 · Todo lo que tienes después del plan", "2 · Everything you own after the plan")} · {fmM(totTienes)}</h3>
          <p style={lead}>{tx("Lo que ya tenías y no se mueve, más la plata nueva del punto 1.", "What you already had and don't move, plus the new money from section 1.")} {fin.deuda > 0 ? tx(`Menos deudas (${fmM(f1.deuda)}) = patrimonio neto ${fmM(f1.patrimonio)}.`, `Minus debts (${fmM(f1.deuda)}) = net worth ${fmM(f1.patrimonio)}.`) : ""}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: INF.tx2, marginBottom: 8 }}>{[...new Set(tienes.map((a) => a.clase))].map((c) => <span key={c}><span style={{ display: "inline-block", width: 8, height: 8, background: COLOR_CLASE[c] || INF.gris, marginRight: 4 }} />{ETQ_CLASE[c] || c}</span>)}</div>
          {tienes.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 14, width: `${Math.max(1, a.valor / (tienes[0]?.valor || 1) * 70)}%`, background: COLOR_CLASE[a.clase] || INF.gris, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.valor)} · {fmPct(totTienes > 0 ? a.valor / totTienes * 100 : 0, 0)}</span></span>
          </div>)}
        </div>
        <div style={card}>
          <h3 style={h3}>{tx("Cuánto produce cada activo", "What each asset earns")}</h3>
          <p style={lead}>{tx(`Al mes, en ${anioCal(1)}. Azul: renta que se recibe. Dorado: lo que multiplica (se reinvierte).`, `Per month, in ${anioCal(1)}. Blue: income you receive. Gold: compounding (reinvested).`)}</p>
          {produce.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ display: "flex", width: `${Math.max(1, (a.rM + a.cM) / maxProd * 70)}%`, height: 14 }}>{a.rM > 0 && <span style={{ flex: a.rM, background: INF.azul }} />}{a.cM > 0 && <span style={{ flex: a.cM, background: INF.dorado }} />}</span>
              <span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.rM + a.cM)}</span></span>
          </div>)}
          <div style={{ borderTop: `1px solid ${INF.linea}`, marginTop: 8, paddingTop: 8, fontSize: 13, fontWeight: 600 }}>{tx(`Total produce ${fmM(produceMes)}/mes`, `Total earns ${fmM(produceMes)}/mo`)} <span style={{ color: INF.tx2, fontWeight: 400 }}>({tx(`renta ${fmM(rentaMes)} + multiplica ${fmM(multiplicaMes)}`, `income ${fmM(rentaMes)} + compounding ${fmM(multiplicaMes)}`)})</span></div>
        </div>
      </div>

      {r.desglose && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        {[[tx("3 · Lo que entra cada mes", "3 · What comes in each month"), tx(`En ${anioCal(1)}, partida por partida. Las rentas de tus inmuebles van netas de sus costos.`, `In ${anioCal(1)}, line by line. Rental income is net of property costs.`), r.desglose.entra, INF.azul, f1.ingresos / 12], [tx("Lo que sale cada mes", "What goes out each month"), tx("En el año 1: tus gastos de Egresos, las cuotas de las deudas que siguen y los gastos futuros que ya empezaron.", "In year 1: your expenses, payments on remaining debts and future expenses that have already started."), r.desglose.sale, INF.teja, f1.gastos / 12]].map(([t, l, lista, col, tot]) => {
          const mx = Math.max(1, ...lista.map((x) => Math.abs(x.mensual)));
          return <div key={t} style={card}>
            <h3 style={h3}>{t} · {fmM(tot)}</h3>
            <p style={lead}>{l}</p>
            {lista.map((x, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(100px,42%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre}</span>{x.nota && <span style={{ fontSize: 12, color: INF.tx2 }}>{x.nota}</span>}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 12, width: `${Math.max(1, Math.abs(x.mensual) / mx * 60)}%`, background: x.mensual < 0 ? INF.gris : col, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(x.mensual)}</span></span>
            </div>)}
          </div>;
        })}
      </div>}

      <div style={card}>
        <h3 style={h3}>{tx("Año a año: todo lo que produce el patrimonio", "Year by year: everything your net worth earns")}</h3>
        <p style={lead}>{tx("Abajo, en tonos azules y verdes, lo que llega a la cuenta cada año (rentas y pensiones). Arriba, lo que se queda invertido y crece. El número sobre cada barra es el total que produjo el patrimonio ese año. La línea roja es lo que sale para vivir.", "Bottom, in blues and greens: what reaches your account each year (income and pensions). Top: what stays invested and grows. The number above each bar is the total your net worth earned that year. The red line is what goes out to live.")}</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={prod} margin={{ top: 22, right: 8, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={72} />
            <Tooltip content={<ChartTooltip formatter={tip} />} />
            {sR.top.map((s, i) => <Bar key={"r" + s.id} dataKey={"r_" + s.id} stackId="p" name={`${s.nombre} (${tx("renta", "income")})`} fill={[INF.azul, INF.serie[4], INF.oliva, INF.navy, INF.serie[6], INF.serie[8]][i % 6]} />)}
            <Bar dataKey="r_otros" stackId="p" name={sR.resto.length ? tx("Resto de rentas (más pequeñas)", "Other income (smaller)") : tx("Ajuste (costos de inmuebles sin ligar)", "Adjustment (unlinked property costs)")} fill={INF.gris} />
            {sC.top.map((s, i) => <Bar key={"c" + s.id} dataKey={"c_" + s.id} stackId="p" name={`${s.nombre} (${tx("crece", "grows")})`} fill={[INF.navy, INF.morado, INF.dorado, INF.serie[6]][i % 4]} />)}
            <Bar dataKey="c_otros" stackId="p" name={tx("Otro crecimiento", "Other growth")} fill={INF.serie[9]}>
              <LabelList dataKey="total" position="top" formatter={(v) => fmM(v)} style={{ fill: INF.tx, fontSize: 12, fontWeight: 600 }} />
            </Bar>
            <Line type="monotone" dataKey="sale" name={tx("Lo que sale", "Goes out")} stroke={INF.teja} strokeDasharray="4 3" strokeWidth={2} dot={{ r: 3, fill: INF.teja }} />
          </ComposedChart>
        </ResponsiveContainer></div></div>
        <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("Año", "Year")}</th><th style={th}>{tx("Llega a la cuenta", "Reaches your account")}</th><th style={th}>{tx("Crece invertido", "Grows invested")}</th><th style={th}>{tx("Produce en total", "Total earned")}</th><th style={th}>{tx("Sale para vivir", "Living costs")}</th><th style={th}>{tx("Sobra al mes (se reinvierte)", "Monthly surplus (reinvested)")}</th><th style={{ ...th, textAlign: "left" }}>{tx("Qué cambia ese año", "What changes that year")}</th></tr></thead>
          <tbody>{filas.slice(1).map((f) => { const qe = ev.filter((e) => e.anio === f.anio).map((e) => e.texto); return <tr key={f.anio}>
            <td style={tdL}>{anioTxt(f.anio)}</td><td style={td}>{fmM(f.rentas / d(f))}</td><td style={td}>{fmM(f.crece / d(f))}</td><td style={td}>{fmM(f.produce / d(f))}</td><td style={td}>{fmM(f.gastos / d(f))}</td>
            <td style={{ ...td, color: f.ingresos - f.gastos >= 0 ? INF.tx : INF.txBad }}>{fmM((f.ingresos - f.gastos) / 12 / d(f))}</td>
            <td style={{ ...tdL, color: INF.tx2 }}>{qe.length ? qe.join(" · ") : tx("Sin cambios", "No changes")}</td></tr>; })}</tbody>
        </table></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        <div style={card}>
          <h3 style={h3}>{tx("4 · Patrimonio neto por año", "4 · Net worth by year")}</h3>
          <p style={lead}>{tx("Cada color es una inversión; el número de arriba es el patrimonio neto (activos menos deudas).", "Each color is an investment; the number on top is net worth (assets minus debts).")}</p>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={280}>
            <BarChart data={pat} margin={{ top: 22, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="anio" {...eje} interval={1} />
              <YAxis {...eje} tickFormatter={fmEje} width={68} />
              <Tooltip content={<ChartTooltip formatter={tip} />} />
              <Bar dataKey="otros" stackId="v" name={tx("Otros activos netos", "Other net assets")} fill={INF.gris} />
              {sV.top.map((s, i) => <Bar key={s.id} dataKey={s.id} stackId="v" name={s.nombre} fill={s.color}>{i === sV.top.length - 1 && <LabelList dataKey="totalEt" position="top" style={{ fill: INF.tx, fontSize: 12 }} />}</Bar>)}
            </BarChart>
          </ResponsiveContainer></div></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: INF.tx2 }}>{[{ nombre: tx("Otros activos netos", "Other net assets"), color: INF.gris }, ...sV.top].map((s) => <span key={s.nombre}><span style={{ display: "inline-block", width: 8, height: 8, background: s.color, marginRight: 4 }} />{s.nombre}</span>)}</div>
        </div>
        <div style={card}>
          <h3 style={h3}>{tx("Cada inversión, año por año", "Each investment, year by year")}</h3>
          <p style={lead}>{tx("El valor de las inversiones más grandes; al final, lo que vale cada una.", "Value of your largest investments; at the end, what each is worth.")}</p>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
            <LineChart data={pat} margin={{ top: 10, right: 128, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="anio" {...eje} interval={1} />
              <YAxis {...eje} tickFormatter={fmEje} width={68} />
              <Tooltip content={<ChartTooltip formatter={tip} />} />
              {sL.map((s) => <Line key={s.id} type="monotone" dataKey={s.id} name={s.nombre} stroke={s.color} strokeWidth={2} dot={false}
                label={(p) => (p.index === pat.length - 1 ? <text x={p.x + 6} y={p.y + 4} fill={s.color} fontSize={11}>{`${(s.nombre || "").slice(0, 12)} ${fmM(p.value)}`}</text> : null)} />)}
            </LineChart>
          </ResponsiveContainer></div></div>
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>{tx("Le gana a la inflación, año por año", "Beating inflation, year by year")}</h3>
        <p style={lead}>{tx(`Cada barra es cuánto crece el patrimonio neto ese año. La línea punteada es la inflación (${fmPct(inflacionPct, 1)}): por encima, el plan gana poder de compra; por debajo, lo pierde. La cifra sobre cada barra es lo que gana por encima de la inflación.`, `Each bar is how much net worth grows that year. The dashed line is inflation (${fmPct(inflacionPct, 1)}): above it, the plan gains purchasing power; below it, it loses it. The figure above each bar is the gain over inflation.`)}</p>
        <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ border: `1px solid ${ganaN >= gana.length / 2 ? INF.ok : INF.bad}`, color: ganaN >= gana.length / 2 ? INF.txOk : INF.txBad, borderRadius: 999, padding: "1px 8px", marginRight: 6, fontSize: 12 }}>{ganaN >= gana.length / 2 ? tx("Le gana", "Beats it") : tx("No le gana", "Falls short")}</span>
          {cagr != null && tx(<>Crece <b>{fmPct(cagr, 1)}</b> al año en 10 años: <b>{real >= 0 ? "+" : ""}{fmPct(real, 1)} real</b> por año. Le gana a la inflación en {ganaN} de {gana.length} años.</>, <>Grows <b>{fmPct(cagr, 1)}</b> a year over 10 years: <b>{real >= 0 ? "+" : ""}{fmPct(real, 1)} real</b> per year. Beats inflation in {ganaN} of {gana.length} years.</>)}</div>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={240}>
          <BarChart data={gana} margin={{ top: 22, right: 90, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={(v) => `${Math.round(v)}%`} width={44} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmPct(v, 1)} />} />
            <ReferenceLine y={inflacionPct} stroke={INF.tx2} strokeDasharray="5 4" label={{ value: `${tx("Inflación", "Inflation")} ${fmPct(inflacionPct, 1)}`, position: "right", fill: INF.tx2, fontSize: 12 }} />
            <Bar dataKey="g" name={tx("Crece", "Growth")}>
              {gana.map((x, i) => <Cell key={i} fill={x.g >= inflacionPct ? INF.oliva : INF.teja} />)}
              <LabelList dataKey="realTxt" position="top" style={{ fill: INF.tx2, fontSize: 12 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer></div></div>
      </div>

      <div style={card}>
        <h3 style={h3}>{tx("5 · Año por año", "5 · Year by year")}</h3>
        <p style={lead}>{nombre}. {modo === "real" ? tx(`En ${monedas()} de hoy.`, `In today's ${monedas()}.`) : tx(`En ${monedas()} de cada año.`, `In each year's ${monedas()}.`)} {tx("Cobertura = lo que entra ÷ lo que sale.", "Coverage = money in ÷ money out.")}</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("Año", "Year")}</th><th style={th}>{tx("Patrimonio", "Net worth")}</th>{sL.map((s) => <th key={s.id} style={th}>{(s.nombre || "").slice(0, 18)}</th>)}<th style={th}>{tx("Deuda", "Debt")}</th><th style={th}>{tx("Cobertura", "Coverage")}</th></tr></thead>
          <tbody>{filas.map((f, i) => <tr key={f.anio}><td style={tdL}>{f.anio === 0 ? tx("Hoy", "Today") : anioCal(f.anio)}</td><td style={td}>{fmM(f.patrimonio / d(f))}</td>
            {sL.map((s) => <td key={s.id} style={td}>{pat[i][s.id] ? fmM(pat[i][s.id]) : "—"}</td>)}
            <td style={td}>{f.deuda > 0 ? fmM(f.deuda / d(f)) : "—"}</td><td style={td}>{f.gastos > 0 ? fmPct(f.ingresos / f.gastos * 100, 0) : "—"}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}
