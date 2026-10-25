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
import { useMemo, useState } from "react";
import { ComposedChart, BarChart, Bar, Area, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList, Cell } from "recharts";
import { ChartTooltip } from "../lib/chartTheme.jsx";
import { INF, COLOR_CLASE, ETQ_CLASE, fmM, fmEje, fmPct } from "../lib/informeTheme.js";

const card = { background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 12, padding: 16, marginBottom: 14 };
const h3 = { margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: INF.tx };
const lead = { margin: "0 0 12px", fontSize: 12, color: INF.tx2, lineHeight: 1.5 };
const eje = { tick: { fill: INF.tx2, fontSize: 11 }, axisLine: { stroke: INF.eje }, tickLine: { stroke: INF.eje } };
const grid = { strokeDasharray: "0", stroke: INF.grid, vertical: false };
const th = { textAlign: "right", fontWeight: 600, color: INF.tx2, padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, whiteSpace: "nowrap" };
const td = { textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${INF.linea}`, color: INF.tx, whiteSpace: "nowrap" };
const tdL = { ...td, textAlign: "left", whiteSpace: "normal" };
const anioTxt = (a) => (a === 0 ? "Hoy" : String(anioCal(a)));
const tip = (v) => fmM(v);

/** Lo que pasa cada año, en palabras (para las marcas y la columna «Qué cambia ese año»). */
export function eventosDelPlan(r) {
  const ev = [];
  if ((r.vendidos || []).length) ev.push({ anio: 0, corto: "Vendes", texto: `Vendes ${r.vendidos.map((v) => v.nombre).join(", ")}: ${fmM(r.vendidos.reduce((s, v) => s + v.valor, 0))}` });
  (r.deudas || []).filter((d) => d.pagado > 0).forEach((d) => ev.push({ anio: 0, corto: "Pagas deudas", texto: `Pagas ${d.nombre}: ${fmM(d.pagado)}` }));
  (r.reinversionesDetalle || []).forEach((x) => {
    if (x.aporte > 0) ev.push({ anio: Math.max(0, (x.anio || 1) - 1), corto: x.nombre, texto: `Le inviertes ${fmM(x.aporte)} a ${x.nombre}` });
    if (x.rentaMensual > 0) { const a = Math.floor((x.rentaDesdeMes || 0) / 12) + 1; ev.push({ anio: a, corto: `${x.nombre} renta`, texto: `${x.nombre} empieza a rentar: +${fmM(x.rentaMensual)}/mes` }); }
  });
  (r.nuevasDetalle || []).forEach((x) => ev.push({ anio: Math.max(0, (x.anio || 1) - 1), corto: x.nombre, texto: `Inviertes ${fmM(x.monto)} en ${x.nombre}` }));
  const fut = r.futuros || { ingresos: [], activos: [] };
  fut.ingresos.forEach((x) => ev.push({ anio: x.desde, corto: x.nombre, texto: `${x.nombre}: +${fmM(x.mensual)}/mes` }));
  fut.activos.forEach((x) => ev.push({ anio: x.entrega, corto: x.nombre, texto: `Recibes ${x.nombre}` }));
  (fut.gastos || []).forEach((x) => { ev.push({ anio: x.desde, corto: x.nombre, texto: `Empieza ${x.nombre}: −${fmM(x.anual)}/año` }); if (x.hasta < 99) ev.push({ anio: x.hasta + 1, corto: `Fin ${x.nombre}`, texto: `Termina ${x.nombre}` }); });
  (r.alertas || []).filter((a) => a.tipo === "pago_unico").forEach((a) => ev.push({ anio: a.anio, corto: "Pago único", texto: a.texto.replace(/^En \d{4} /, "") }));
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

export default function PlanInforme({ r, nombre = "Este escenario", inflacionPct = 4 }) {
  const [modo, setModo] = useState("nominal"); // nominal | real (pesos de hoy)
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
    ...((r.deudas || []).some((x) => x.pagado > 0) ? [{ destino: `Pagar deudas (${r.deudas.filter((x) => x.pagado > 0).map((x) => x.nombre).join(", ")})`, capital: bd.deudas, tasa: "—", bolsillo: "Limpieza", regla: r.cuotasQueSalenMes > 0 ? `Se elimina ${fmM(r.cuotasQueSalenMes)}/mes de cuotas` : "Sale del patrimonio la deuda" }] : []),
    ...(r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => ({ destino: x.nombre, capital: x.aporte, tasa: x.rendimientoPct != null ? fmPct(x.rendimientoPct, 1) : x.rentaPctAnual > 0 ? fmPct(x.rentaPctAnual, 1) : "—", bolsillo: x.clase === "inmueble" || (x.pctRecibe || 0) > 0 ? "Sustento" : "Crecimiento", regla: [x.rentaMensual > 0 ? `Renta ${fmM(x.rentaMensual)}/mes desde ${x.rentaDesdeMes ? `el mes ${x.rentaDesdeMes}` : "ya"}` : null, x.teLlegaMes > 0 ? `Te llega ${fmM(x.teLlegaMes)}/mes` : null, x.anio > 1 ? `Se invierte en ${x.anio - 1} año${x.anio === 2 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "Se valoriza" })),
    ...(r.nuevasDetalle || []).map((x) => ({ destino: x.nombre, capital: x.monto, tasa: fmPct(x.rendPct, 1), bolsillo: x.pagaRenta ? "Sustento" : "Crecimiento", regla: x.pagaRenta ? "Paga renta al flujo" : "Se reinvierte" })),
    ...(bd.colchon > 0 ? [{ destino: "Colchón", capital: bd.colchon, tasa: "—", bolsillo: "Protección", regla: "Meses de gastos a la mano" }] : []),
    ...(bd.restante > 0 ? [{ destino: "Lo que sobra de las ventas", capital: bd.restante, tasa: "—", bolsillo: "Mezcla", regla: r.destinoSobra || "Se reparte según el norte que elegiste" }] : []),
  ];
  const totalNueva = plataNueva.reduce((s, x) => s + (x.capital || 0), 0);

  // ── Todo lo que tienes / cuánto produce ───────────────────────────────────
  const tienes = (f1.porActivo || []).filter((a) => a.valor > 0.5).sort((a, b) => b.valor - a.valor);
  const totTienes = tienes.reduce((s, a) => s + a.valor, 0);
  const produce = (f1.porActivo || []).map((a) => ({ ...a, rM: a.renta / 12, cM: Math.max(0, a.crece) / 12 })).filter((a) => a.rM + a.cM > 0.5).sort((a, b) => b.rM + b.cM - (a.rM + a.cM));
  const maxProd = Math.max(1, ...produce.map((a) => a.rM + a.cM));

  const Toggle = () => <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
    {[["nominal", "Pesos de cada año"], ["real", "En pesos de hoy"]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${modo === k ? INF.tx : INF.linea}`, background: modo === k ? INF.tx : "transparent", color: modo === k ? INF.panel : INF.tx2, fontSize: 12, cursor: "pointer" }}>{l}</button>)}
  </div>;

  const Ficha = ({ l, v, s, col }) => <div style={{ ...card, marginBottom: 0, padding: 14 }}>
    <div style={{ fontSize: 11, color: INF.tx2 }}>{l}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: col || INF.tx, fontFamily: "Georgia, 'Times New Roman', serif", margin: "4px 0" }}>{v}</div>
    <div style={{ fontSize: 11, color: INF.tx2, lineHeight: 1.4 }}>{s}</div>
  </div>;

  const finLabel = (key, txt, color) => (p) => (p.index === mes.length - 1 ? <text x={p.x + 6} y={p.y + 4} fill={color} fontSize={12} fontWeight={600}>{txt}</text> : null);

  return (
    <div style={{ color: INF.tx }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <Ficha l={`Patrimonio en ${anioCal(10)}`} v={fmM(fin.patrimonio / d(fin))} s={`hoy ${fmM(f0.patrimonio)}${cagr != null ? ` · crece ${fmPct(cagr, 1)} al año` : ""}`} />
        <Ficha l="Produce al mes" v={fmM(produceMes)} s={`renta ${fmM(rentaMes)} + multiplica ${fmM(multiplicaMes)}`} />
        <Ficha l="Rendimiento del patrimonio" v={fmPct(rendimiento, 1)} s="anual, sobre lo que tienes" />
        <Ficha l="Sale al mes" v={fmM(saleMes)} s="gastos + cuotas" />
        <Ficha l={entraMes - saleMes >= 0 ? "Sobra al mes y se reinvierte" : "Falta al mes"} v={`${entraMes - saleMes >= 0 ? "+" : ""}${fmM(entraMes - saleMes)}`} s={entraMes - saleMes >= 0 ? (r.destinoSobra || "lo que entra menos lo que sale") : "sale de tu liquidez"} col={entraMes - saleMes >= 0 ? INF.ok : INF.bad} />
        <Ficha l="Le gana a la inflación" v={real == null ? "—" : `${real >= 0 ? "+" : ""}${fmPct(real, 1)}`} s={`real al año · en ${ganaN} de ${gana.length} años`} col={real != null && real >= 0 ? INF.ok : INF.bad} />
      </div>

      {(r.desglose?.reinvierte || []).length > 0 && <div style={{ ...card, borderColor: INF.dorado }}>
        <h3 style={h3}>Lo que rinde y no te llega al mes</h3>
        <p style={lead}>Estas inversiones producen, pero todo se reinvierte: hacen crecer el patrimonio y no suman a lo que entra cada mes. Si alguna te paga (una renta fija como BTG), cámbiala en el paso 3, Tu plata → «De lo que rinde, ¿cuánto te llega?».</p>
        {r.desglose.reinvierte.map((x) => <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${INF.linea}` }}><span>{x.nombre} <span style={{ color: INF.tx2, fontSize: 11 }}>· {fmPct(x.pct, 1)} al año</span></span><b style={{ color: INF.dorado, whiteSpace: "nowrap" }}>{fmM(x.mensual)}/mes se reinvierte</b></div>)}
      </div>}

      <Toggle />

      <div style={card}>
        <h3 style={h3}>Mes a mes: ¿alcanza para vivir? Así se comporta el plan en el tiempo</h3>
        <p style={lead}><b>Línea azul:</b> lo que entra cada mes. <b>Línea roja punteada:</b> lo que sale para vivir. <b>Franja verde:</b> lo que sobra, que no se queda quieto: {r.destinoSobra || "se reinvierte"}. Las líneas verticales marcan los cambios. Mientras la azul esté por encima de la roja, el plan se sostiene solo.</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={mes} margin={{ top: 40, right: 96, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={72} />
            <Tooltip content={(q) => <ChartTooltip {...q} payload={(q.payload || []).filter((x) => x.dataKey !== "base")} formatter={tip} />} />
            <Area type="stepAfter" dataKey="base" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" name=" " tooltipType="none" />
            <Area type="stepAfter" dataKey="sobra" stackId="b" stroke="none" fill={INF.franja} isAnimationActive={false} name="Sobra" />
            {marcas.map((m, i) => <ReferenceLine key={m.anio} x={anioTxt(m.anio)} stroke={INF.ref} strokeDasharray="2 3"
              label={(q) => <text x={q.viewBox.x + 4} y={q.viewBox.y - 6 - (i % 2) * 14} fill={INF.tx2} fontSize={11}>{m.txt.length > 26 ? m.txt.slice(0, 25) + "…" : m.txt}</text>} />)}
            <Line type="stepAfter" dataKey="entra" name="Entra" stroke={INF.azul} strokeWidth={2.5} dot={false} label={finLabel("entra", `Entra ${fmM(mes[mes.length - 1]?.entra)}`, INF.azul)} />
            <Line type="stepAfter" dataKey="sale" name="Sale" stroke={INF.teja} strokeWidth={2} strokeDasharray="5 4" dot={false} label={finLabel("sale", `Sale ${fmM(mes[mes.length - 1]?.sale)}`, INF.teja)} />
          </ComposedChart>
        </ResponsiveContainer></div></div>
        {apretado && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 4 }}>Año más apretado: <b style={{ color: apretado.s >= 0 ? INF.tx : INF.bad }}>{anioTxt(apretado.f.anio)}, {apretado.s >= 0 ? `sobran ${fmM(apretado.s)}` : `faltan ${fmM(-apretado.s)}`} al mes ({fmPct(apretado.f.gastos > 0 ? apretado.f.ingresos / apretado.f.gastos * 100 : 0, 0)} de cobertura)</b>.</div>}
      </div>

      {plataNueva.length > 0 && <div style={card}>
        <h3 style={h3}>1 · La plata nueva: a dónde va cada peso · {fmM(totalNueva)}</h3>
        <p style={lead}>Solo la plata que se mueve: lo que vendes{bd.capitalNuevo > 0 ? ", el capital nuevo" : ""}{bd.desdeLiquidez > 0 ? " y lo que sale de tu liquidez" : ""}. Lo que ya tienes y no se mueve no aparece aquí; eso lo suma el punto 2.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Destino</th><th style={th}>Capital</th><th style={th}>Tasa</th><th style={{ ...th, textAlign: "left" }}>Bolsillo</th><th style={{ ...th, textAlign: "left" }}>Regla</th></tr></thead>
          <tbody>{plataNueva.map((x, i) => <tr key={i}><td style={tdL}>{x.destino}</td><td style={td}>{fmM(x.capital)}</td><td style={td}>{x.tasa}</td><td style={{ ...tdL, color: INF.tx2 }}>{x.bolsillo}</td><td style={{ ...tdL, color: INF.tx2 }}>{x.regla}</td></tr>)}
            <tr><td style={{ ...tdL, fontWeight: 700 }}>Total desplegado</td><td style={{ ...td, fontWeight: 700 }}>{fmM(totalNueva)}</td><td style={td} /><td style={td} /><td style={{ ...tdL, color: INF.tx2 }}>{[(r.vendidos || []).map((v) => `${v.nombre} ${fmM(v.valor)}`).join(" + "), bd.capitalNuevo > 0 ? `capital nuevo ${fmM(bd.capitalNuevo)}` : null, bd.desdeLiquidez > 0 ? `liquidez ${fmM(bd.desdeLiquidez)}` : null].filter(Boolean).join(" + ")}</td></tr>
          </tbody></table></div>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        <div style={card}>
          <h3 style={h3}>2 · Todo lo que tienes después del plan · {fmM(totTienes)}</h3>
          <p style={lead}>Lo que ya tenías y no se mueve, más la plata nueva del punto 1. {fin.deuda > 0 ? `Menos deudas (${fmM(f1.deuda)}) = patrimonio neto ${fmM(f1.patrimonio)}.` : ""}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11, color: INF.tx2, marginBottom: 8 }}>{[...new Set(tienes.map((a) => a.clase))].map((c) => <span key={c}><span style={{ display: "inline-block", width: 8, height: 8, background: COLOR_CLASE[c] || INF.gris, marginRight: 4 }} />{ETQ_CLASE[c] || c}</span>)}</div>
          {tienes.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 14, width: `${Math.max(1, a.valor / (tienes[0]?.valor || 1) * 70)}%`, background: COLOR_CLASE[a.clase] || INF.gris, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.valor)} · {fmPct(totTienes > 0 ? a.valor / totTienes * 100 : 0, 0)}</span></span>
          </div>)}
        </div>
        <div style={card}>
          <h3 style={h3}>Cuánto produce cada activo</h3>
          <p style={lead}>Al mes, en {anioCal(1)}. Azul: renta que se recibe. Dorado: lo que multiplica (se reinvierte).</p>
          {produce.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ display: "flex", width: `${Math.max(1, (a.rM + a.cM) / maxProd * 70)}%`, height: 14 }}>{a.rM > 0 && <span style={{ flex: a.rM, background: INF.azul }} />}{a.cM > 0 && <span style={{ flex: a.cM, background: INF.dorado }} />}</span>
              <span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.rM + a.cM)}</span></span>
          </div>)}
          <div style={{ borderTop: `1px solid ${INF.linea}`, marginTop: 8, paddingTop: 8, fontSize: 13, fontWeight: 600 }}>Total produce {fmM(produceMes)}/mes <span style={{ color: INF.tx2, fontWeight: 400 }}>(renta {fmM(rentaMes)} + multiplica {fmM(multiplicaMes)})</span></div>
        </div>
      </div>

      {r.desglose && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        {[["3 · Lo que entra cada mes", `En ${anioCal(1)}, partida por partida. Las rentas de tus inmuebles van netas de sus costos.`, r.desglose.entra, INF.azul, f1.ingresos / 12], ["Lo que sale cada mes", "En el año 1: tus gastos de Egresos, las cuotas de las deudas que siguen y los gastos futuros que ya empezaron.", r.desglose.sale, INF.teja, f1.gastos / 12]].map(([t, l, lista, col, tot]) => {
          const mx = Math.max(1, ...lista.map((x) => Math.abs(x.mensual)));
          return <div key={t} style={card}>
            <h3 style={h3}>{t} · {fmM(tot)}</h3>
            <p style={lead}>{l}</p>
            {lista.map((x, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(100px,42%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre}</span>{x.nota && <span style={{ fontSize: 11, color: INF.tx2 }}>{x.nota}</span>}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 12, width: `${Math.max(1, Math.abs(x.mensual) / mx * 60)}%`, background: x.mensual < 0 ? INF.gris : col, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(x.mensual)}</span></span>
            </div>)}
          </div>;
        })}
      </div>}

      <div style={card}>
        <h3 style={h3}>Año a año: todo lo que produce el patrimonio</h3>
        <p style={lead}>Abajo, en tonos azules y verdes, lo que llega a la cuenta cada año (rentas y pensiones). Arriba, lo que se queda invertido y crece. El número sobre cada barra es el total que produjo el patrimonio ese año. La línea roja es lo que sale para vivir.</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={prod} margin={{ top: 22, right: 8, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={72} />
            <Tooltip content={<ChartTooltip formatter={tip} />} />
            {sR.top.map((s, i) => <Bar key={"r" + s.id} dataKey={"r_" + s.id} stackId="p" name={`${s.nombre} (renta)`} fill={[INF.azul, INF.serie[4], INF.oliva, INF.navy, INF.serie[6], INF.serie[8]][i % 6]} />)}
            <Bar dataKey="r_otros" stackId="p" name={sR.resto.length ? "Resto de rentas (más pequeñas)" : "Ajuste (costos de inmuebles sin ligar)"} fill={INF.gris} />
            {sC.top.map((s, i) => <Bar key={"c" + s.id} dataKey={"c_" + s.id} stackId="p" name={`${s.nombre} (crece)`} fill={[INF.navy, INF.morado, INF.dorado, INF.serie[6]][i % 4]} />)}
            <Bar dataKey="c_otros" stackId="p" name="Otro crecimiento" fill={INF.serie[9]}>
              <LabelList dataKey="total" position="top" formatter={(v) => fmM(v)} style={{ fill: INF.tx, fontSize: 11, fontWeight: 600 }} />
            </Bar>
            <Line type="monotone" dataKey="sale" name="Lo que sale" stroke={INF.teja} strokeDasharray="4 3" strokeWidth={2} dot={{ r: 3, fill: INF.teja }} />
          </ComposedChart>
        </ResponsiveContainer></div></div>
        <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Año</th><th style={th}>Llega a la cuenta</th><th style={th}>Crece invertido</th><th style={th}>Produce en total</th><th style={th}>Sale para vivir</th><th style={th}>Sobra al mes (se reinvierte)</th><th style={{ ...th, textAlign: "left" }}>Qué cambia ese año</th></tr></thead>
          <tbody>{filas.slice(1).map((f) => { const qe = ev.filter((e) => e.anio === f.anio).map((e) => e.texto); return <tr key={f.anio}>
            <td style={tdL}>{anioTxt(f.anio)}</td><td style={td}>{fmM(f.rentas / d(f))}</td><td style={td}>{fmM(f.crece / d(f))}</td><td style={td}>{fmM(f.produce / d(f))}</td><td style={td}>{fmM(f.gastos / d(f))}</td>
            <td style={{ ...td, color: f.ingresos - f.gastos >= 0 ? INF.tx : INF.bad }}>{fmM((f.ingresos - f.gastos) / 12 / d(f))}</td>
            <td style={{ ...tdL, color: INF.tx2 }}>{qe.length ? qe.join(" · ") : "Sin cambios"}</td></tr>; })}</tbody>
        </table></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        <div style={card}>
          <h3 style={h3}>4 · Patrimonio neto por año</h3>
          <p style={lead}>Cada color es una inversión; el número de arriba es el patrimonio neto (activos menos deudas).</p>
          <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={280}>
            <BarChart data={pat} margin={{ top: 22, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="anio" {...eje} interval={1} />
              <YAxis {...eje} tickFormatter={fmEje} width={68} />
              <Tooltip content={<ChartTooltip formatter={tip} />} />
              <Bar dataKey="otros" stackId="v" name="Otros activos netos" fill={INF.gris} />
              {sV.top.map((s, i) => <Bar key={s.id} dataKey={s.id} stackId="v" name={s.nombre} fill={s.color}>{i === sV.top.length - 1 && <LabelList dataKey="totalEt" position="top" style={{ fill: INF.tx, fontSize: 11 }} />}</Bar>)}
            </BarChart>
          </ResponsiveContainer></div></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11, color: INF.tx2 }}>{[{ nombre: "Otros activos netos", color: INF.gris }, ...sV.top].map((s) => <span key={s.nombre}><span style={{ display: "inline-block", width: 8, height: 8, background: s.color, marginRight: 4 }} />{s.nombre}</span>)}</div>
        </div>
        <div style={card}>
          <h3 style={h3}>Cada inversión, año por año</h3>
          <p style={lead}>El valor de las inversiones más grandes; al final, lo que vale cada una.</p>
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
        <h3 style={h3}>Le gana a la inflación, año por año</h3>
        <p style={lead}>Cada barra es cuánto crece el patrimonio neto ese año. La línea punteada es la inflación ({fmPct(inflacionPct, 1)}): por encima, el plan gana poder de compra; por debajo, lo pierde. La cifra sobre cada barra es lo que gana por encima de la inflación.</p>
        <div style={{ fontSize: 13, marginBottom: 6 }}><span style={{ border: `1px solid ${ganaN >= gana.length / 2 ? INF.ok : INF.bad}`, color: ganaN >= gana.length / 2 ? INF.ok : INF.bad, borderRadius: 999, padding: "1px 8px", marginRight: 6, fontSize: 12 }}>{ganaN >= gana.length / 2 ? "Le gana" : "No le gana"}</span>
          {cagr != null && <>Crece <b>{fmPct(cagr, 1)}</b> al año en 10 años: <b>{real >= 0 ? "+" : ""}{fmPct(real, 1)} real</b> por año. Le gana a la inflación en {ganaN} de {gana.length} años.</>}</div>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={240}>
          <BarChart data={gana} margin={{ top: 22, right: 90, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={(v) => `${Math.round(v)}%`} width={44} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmPct(v, 1)} />} />
            <ReferenceLine y={inflacionPct} stroke={INF.tx2} strokeDasharray="5 4" label={{ value: `Inflación ${fmPct(inflacionPct, 1)}`, position: "right", fill: INF.tx2, fontSize: 11 }} />
            <Bar dataKey="g" name="Crece">
              {gana.map((x, i) => <Cell key={i} fill={x.g >= inflacionPct ? INF.oliva : INF.teja} />)}
              <LabelList dataKey="realTxt" position="top" style={{ fill: INF.tx2, fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer></div></div>
      </div>

      <div style={card}>
        <h3 style={h3}>5 · Año por año</h3>
        <p style={lead}>{nombre}. {modo === "real" ? "En pesos de hoy." : "En pesos de cada año."} Cobertura = lo que entra ÷ lo que sale.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Año</th><th style={th}>Patrimonio</th>{sL.map((s) => <th key={s.id} style={th}>{(s.nombre || "").slice(0, 18)}</th>)}<th style={th}>Deuda</th><th style={th}>Cobertura</th></tr></thead>
          <tbody>{filas.map((f, i) => <tr key={f.anio}><td style={tdL}>{f.anio === 0 ? "Hoy" : anioCal(f.anio)}</td><td style={td}>{fmM(f.patrimonio / d(f))}</td>
            {sL.map((s) => <td key={s.id} style={td}>{pat[i][s.id] ? fmM(pat[i][s.id]) : "—"}</td>)}
            <td style={td}>{f.deuda > 0 ? fmM(f.deuda / d(f)) : "—"}</td><td style={td}>{f.gastos > 0 ? fmPct(f.ingresos / f.gastos * 100, 0) : "—"}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}
