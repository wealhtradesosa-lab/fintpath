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
// 7-nov-2026: ordenado como una historia en 5 capítulos (índice arriba):
//   1 El veredicto (una frase + fichas) · 2 Qué haces con tu plata (HistoriaPlata
//   + la tabla de la plata nueva, plegada) · 3 Tu mes (mes completo, mes a mes con
//   eventos numerados, entra/sale) · 4 Tu patrimonio (neto por año, cada inversión
//   juntas / cada una, todo lo que tienes) · 5 ¿Es buen plan? (lo que produce,
//   inflación). Al final, plegada, la tabla año por año. El orden de arriba es el viejo.
// Solo lee el resultado del motor (proyectarFuturo10); no calcula nada nuevo.
// ═══════════════════════════════════════════════════════════════════════════
import { tamanoCifra } from "../lib/infografia.js";
import { anioCal, cuentaPorAnio, rendimientoSinAhorro, patrimonioFinalHoy, inflacionDe } from "../lib/futuro10.js";
import MesCompleto from "./MesCompleto.jsx";
import HistoriaPlata from "./infografia/HistoriaPlata.jsx";
import { useMemo, useState } from "react";
import { ComposedChart, BarChart, Bar, Area, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList, Cell, Customized } from "recharts";
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
// 23-nov-2026 (Santiago: "muy difícil de ver y navegar este gráfico, no se deja desplegar bien";
// "no debería mostrar lo que está en ceros"). El detalle de cada barra lista solo lo que vale algo
// ese año, de mayor a menor (las líneas, al final), y el total va en el título.
const tipLimpio = (titulo) => (q) => {
  const p = (q.payload || []).filter((x) => x.dataKey !== "base" && Math.abs(Number(x.value) || 0) > 0.5)
    .sort((a, b) => (a.dataKey === "sale" ? 1 : 0) - (b.dataKey === "sale" ? 1 : 0) || (Number(b.value) || 0) - (Number(a.value) || 0));
  const row = q.payload?.[0]?.payload;
  return <ChartTooltip {...q} payload={p} formatter={tip} labelFormatter={(l) => (titulo && row ? titulo(l, row) : l)} />;
};

/** Etiquetas al final de cada línea, ordenadas y sin montarse (Customized de recharts). */
function EtiquetasFin({ formattedGraphicalItems = [] }) {
  const ets = formattedGraphicalItems.map((it) => {
    const pts = (it.props && it.props.points) || [];
    const ult = pts[pts.length - 1];
    const ip = (it.item && it.item.props) || {};
    return ult && ult.y != null ? { x: ult.x, y: ult.y, color: it.props.stroke || ip.stroke, nombre: ip.name || it.props.name || "", valor: ult.value } : null;
  }).filter(Boolean).sort((a, b) => a.y - b.y);
  const GAP = 14;
  for (let i = 1; i < ets.length; i++) if (ets[i].y - ets[i - 1].y < GAP) ets[i].y = ets[i - 1].y + GAP;
  const corto = (t) => (t.length > 16 ? t.slice(0, 15).trimEnd() + "…" : t);
  return <g>{ets.map((e, i) => <text key={i} x={e.x + 6} y={e.y + 4} fill={e.color} fontSize={11}>{corto(e.nombre)} <tspan fill={INF.tx2}>{fmM(Array.isArray(e.valor) ? e.valor[1] : e.valor)}</tspan></text>)}</g>;
}

/** Lo que pasa cada año, en palabras (para las marcas y la columna «Qué cambia ese año»). */
export function eventosDelPlan(r) {
  const ev = [];
  if ((r.vendidos || []).length) ev.push({ anio: 0, corto: tx("Vendes", "You sell"), texto: `${tx("Vendes", "You sell")} ${r.vendidos.map((v) => v.nombre).join(", ")}: ${fmM(r.vendidos.reduce((s, v) => s + v.valor, 0))}` });
  (r.deudas || []).filter((d) => d.pagado > 0).forEach((d) => ev.push({ anio: 0, corto: tx("Pagas deudas", "Pay off debts"), texto: `${tx("Pagas", "You pay off")} ${d.nombre}: ${fmM(d.pagado)}` }));
  (r.reinversionesDetalle || []).forEach((x) => {
    // 19-nov-2026: el año 1 es hoy (marca 0); el año t se muestra como anioCal(t),
    // igual que en Tu plata («En 2027» = año 2). Antes restaba uno y salía 2026.
    if (x.aporte > 0) ev.push({ anio: (x.anio || 1) <= 1 ? 0 : x.anio, corto: x.nombre, texto: tx(`Le inviertes ${fmM(x.aporte)} a ${x.nombre}`, `You invest ${fmM(x.aporte)} in ${x.nombre}`) });
    if (x.rentaMensual > 0) { const a = Math.floor((x.rentaDesdeMes || 0) / 12) + 1; ev.push({ anio: a, corto: `${x.nombre} ${tx("renta", "income")}`, texto: tx(`${x.nombre} empieza a rentar: +${fmM(x.rentaMensual)}/mes`, `${x.nombre} starts paying: +${fmM(x.rentaMensual)}/mo`) }); }
  });
  (r.nuevasDetalle || []).forEach((x) => ev.push({ anio: (x.anio || 1) <= 1 ? 0 : x.anio, corto: x.nombre, texto: tx(`Inviertes ${fmM(x.monto)} en ${x.nombre}`, `You invest ${fmM(x.monto)} in ${x.nombre}`) }));
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

/** 23-nov-2026 (Santiago: "debería desglosar aquí esos 18 mil MM, pero los mete todos en
 * «Otros»; al menos los más grandes"). Para «Patrimonio neto por año»: los activos más
 * grandes de CADA año (hasta 4 por año, hasta cubrir el 80 % de lo que hay ese año), no los
 * de mayor suma en 10 años, que dejaban por fuera lo grande de los primeros años (la plata de
 * las ventas, lo que se vende después). Los colores de los que ya salen en «Cada inversión»
 * se respetan. */
function seriesPatrimonio(filas, base, max = 9) {
  const mx = {}, nombre = {}, elegidos = new Set();
  filas.forEach((f) => {
    const l = (f.porActivo || []).filter((a) => (a.valor || 0) > 0.5).sort((a, b) => b.valor - a.valor);
    const tot = l.reduce((sm, a) => sm + a.valor, 0);
    let acum = 0;
    l.forEach((a, i) => { mx[a.id] = Math.max(mx[a.id] || 0, a.valor); nombre[a.id] = a.nombre; if (i < 2 || (i < 4 && acum < tot * 0.8)) elegidos.add(a.id); acum += a.valor; });
  });
  const ids = [...elegidos].sort((a, b) => mx[b] - mx[a]).slice(0, max);
  const color = Object.fromEntries(base.map((s) => [s.id, s.color]));
  const libres = INF.serie.filter((c) => !Object.values(color).includes(c));
  return ids.map((id) => ({ id, nombre: nombre[id], color: color[id] || libres.shift() || INF.gris }));
}

export default function PlanInforme({ r, nombre = tx("Este escenario", "This scenario"), inflacionPct = inflacionDefaultPct(), modoInicial = "nominal" }) {
  const [modo, setModo] = useState(modoInicial); // nominal | real (plata de hoy)
  const [verTodo, setVerTodo] = useState({}); // listas «Lo que entra / Lo que sale»: 10 más grandes o todas
  const [vistaInv, setVistaInv] = useState("juntas"); // «Cada inversión»: juntas | cada una con su escala
  // 19-nov-2026 (Santiago: "uno debería poder elegir año y ver cómo se comporta
  // todo; si me paro en 2028, mis ingresos y gastos de ese año"). Año elegido
  // para los capítulos 3 y 4 (1 = el primer año del plan).
  const [anioSel, setAnioSel] = useState(1);
  const filas = r.filas || [];
  const d = (f) => (modo === "real" ? f.deflactor || 1 : 1);
  const ev = useMemo(() => eventosDelPlan(r), [r]);
  const f0 = filas[0] || {}, f1 = filas[1] || f0, fin = filas[filas.length - 1] || f0;
  const nAniosSel = Math.max(1, filas.length - 1);
  const aSel = Math.min(Math.max(1, anioSel), nAniosSel);
  const fy = filas[aSel] || f1;
  // Lo que entra y sale en el año elegido. El año 1 trae el detalle partida por
  // partida (desglose); los demás se arman con lo que el motor calcula ese año
  // y cuadran con sus totales (fila «Ajustes» si hace falta, nunca escondida).
  const listaAnio = useMemo(() => {
    if (aSel === 1 && r.desglose) return r.desglose;
    const cuadra = (lista, total) => { const sm = lista.reduce((t, x) => t + x.mensual, 0); const dif = total - sm; if (Math.abs(dif) > Math.max(1, Math.abs(total) * 0.005)) lista.push({ nombre: tx("Ajustes (crecimiento del año, cambios a mitad de año)", "Adjustments (growth during the year, mid-year changes)"), mensual: dif }); return lista; };
    const lab = (fy.ingresosLab || []).map((x) => ({ nombre: x.nombre, mensual: x.anual / 12, nota: tx("trabajo · crece cada año", "work · grows each year") }));
    const restoLab = (fy.laboral || 0) / 12 - lab.reduce((t, x) => t + x.mensual, 0);
    const entra = [
      ...lab,
      ...(restoLab > 0.5 ? [{ nombre: tx("Otros ingresos de trabajo", "Other work income"), mensual: restoLab, nota: tx("salario, honorarios", "salary, fees") }] : []),
      ...(fy.porActivo || []).filter((a) => a.renta > 0.5).map((a) => ({ nombre: a.nombre, mensual: a.renta / 12, nota: tx("renta del activo", "asset income") })),
      ...(fy.rentasSueltas || []).map((x) => ({ nombre: x.nombre, mensual: x.renta / 12, nota: x.id && String(x.id).startsWith("fut_") ? tx("ingreso futuro", "future income") : tx("renta", "income") })),
    ].sort((a, b) => b.mensual - a.mensual);
    // Cada gasto de Egresos con su inflación; los que ya se acabaron no salen
    // (y tampoco su «ya no pagas»). Lo que no es una partida (aportes, impuestos
    // que calcula la app) va en «Otros de Egresos».
    const items = (fy.gastosItems || []).filter((x) => !x.seFue);
    const todosItems = (fy.gastosItems || []).reduce((t, x) => t + x.anual, 0);
    const restoBase = ((fy.gastosBase || 0) - todosItems) / 12;
    const cuotas = (fy.cuotasItems || []).map((x) => ({ nombre: tx(`Cuota ${x.nombre}`, `${x.nombre} payment`), mensual: x.anual / 12, nota: tx("deuda", "debt") }));
    const sale = [
      ...items.map((x) => ({ nombre: x.nombre, mensual: x.anual / 12, nota: x.nota || tx("Egresos · con inflación", "Expenses · with inflation") })),
      ...(Math.abs(restoBase) > 0.5 ? [{ nombre: tx("Otros de Egresos (aportes, impuestos)", "Other expenses (contributions, taxes)"), mensual: restoBase, nota: tx("con inflación", "with inflation") }] : []),
      ...(fy.gastosFut || []).map((x) => ({ nombre: x.nombre, mensual: x.anual / 12, nota: tx("gasto futuro", "future expense") })),
      ...(fy.gastosQueSeVan || []).filter((x) => !(fy.gastosItems || []).some((g) => g.seFue && g.nombre === x.nombre)).map((x) => ({ nombre: tx(`Ya no pagas ${x.nombre}`, `No longer paying ${x.nombre}`), mensual: -x.anual / 12, nota: tx("gasto que se acabó", "expense that ended") })),
      ...(cuotas.length ? cuotas : (fy.cuota || 0) > 0.5 ? [{ nombre: tx("Cuotas de deudas", "Loan payments"), mensual: fy.cuota / 12, nota: tx("deudas que siguen", "remaining debts") }] : []),
    ].sort((a, b) => b.mensual - a.mensual);
    return { entra: cuadra(entra, (fy.ingresos || 0) / 12), sale: cuadra(sale, (fy.gastos || 0) / 12) };
  }, [r, aSel, fy]);
  // «Lo que rinde y no te llega» del año elegido (el 1 viene del motor).
  const reinvierteAnio = aSel === 1 ? (r.desglose?.reinvierte || []) : (fy.porActivo || [])
    .filter((a) => !["canasta", "inmueble", "vehiculo", "ingreso"].includes(a.clase) && (a.crece || 0) > 0.5 && !((a.renta || 0) > 0.5))
    .map((a) => ({ id: a.id, nombre: a.nombre, mensual: a.crece / 12, pct: a.valor - a.crece > 0 ? a.crece / (a.valor - a.crece) * 100 : 0 }))
    .sort((a, b) => b.mensual - a.mensual);

  // ── Fichas ────────────────────────────────────────────────────────────────
  const produceMes = ((f1.rentas || 0) + (f1.crece || 0)) / 12;
  const rentaMes = (f1.rentas || 0) / 12, multiplicaMes = (f1.crece || 0) / 12;
  const saleMes = (f1.gastos || 0) / 12, entraMes = (f1.ingresos || 0) / 12;
  const rendimiento = f1.activos > 0 ? ((f1.rentas || 0) + (f1.crece || 0)) / f1.activos * 100 : 0;
  // 23-nov-2026 (Finanzas): el rendimiento es solo de los activos; el ahorro del
  // año es aporte, no rentabilidad. Antes se comparaba el patrimonio final con el
  // de hoy y el ahorro de 10 años salía como si fuera rendimiento.
  const rendSA = rendimientoSinAhorro(r, inflacionPct);
  const cagr = rendSA ? rendSA.nominalPct : null;
  const real = rendSA ? rendSA.realPct : null;

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
  const sP = seriesPatrimonio(filas, sV.top);
  // Arriba lo que tienes (cada activo grande y «Otros activos»), abajo lo que debes.
  const patP = filas.map((f) => {
    const row = { anio: anioTxt(f.anio), total: f.patrimonio / d(f), totalEt: f.anio % 2 === 0 || f.anio === filas.length - 1 ? fmM(f.patrimonio / d(f)) : "" };
    const pa = Object.fromEntries((f.porActivo || []).map((a) => [a.id, a]));
    let otros = f.activos != null ? f.activos : f.patrimonio + (f.deuda || 0);
    sP.forEach((s) => { const v = Math.max(0, pa[s.id]?.valor || 0); row[s.id] = v / d(f); otros -= v; });
    row.otros = Math.max(0, otros) / d(f);
    row.deudas = -(f.deuda || 0) / d(f);
    return row;
  });
  const hayDeuda = patP.some((x) => x.deudas < -0.5);
  // Eje: pasos redondos hacia arriba; abajo, solo el espacio que ocupa la deuda (sin otra
  // marca de miles de millones que deje media gráfica vacía).
  const topPat = Math.max(1, ...patP.map((x) => (x.otros || 0) + sP.reduce((sm, s) => sm + (x[s.id] || 0), 0)));
  const pasoPat = (() => { const crudo = topPat / 4, e = Math.pow(10, Math.floor(Math.log10(crudo))); return [1, 2, 2.5, 5, 10].map((m) => m * e).find((v) => v >= crudo) || 10 * e; })();
  const ticksPat = Array.from({ length: Math.ceil(topPat / pasoPat) + 1 }, (_, i) => i * pasoPat);
  const pisoPat = Math.min(0, ...patP.map((x) => x.deudas || 0)) * 1.15;

  // ── Le gana a la inflación ────────────────────────────────────────────────
  const gana = filas.slice(1).map((f, i) => { const prev = filas[i]; const g = prev.patrimonio > 0 ? (f.patrimonio / prev.patrimonio - 1) * 100 : 0; return { anio: anioTxt(f.anio), g, realTxt: `${g - inflacionPct >= 0 ? "+" : ""}${fmPct(g - inflacionPct, 1)}` }; });
  const ganaN = gana.filter((x) => x.g > inflacionPct).length;

  // ── Plata nueva ───────────────────────────────────────────────────────────
  const bd = r.bolsaDetalle || {};
  // 23-nov-2026 (Santiago: "diagramar mejor"). La plata que mueves, agrupada por año: cada año
  // dice de dónde sale y en qué la pones (la misma cuenta del paso 3 y del capítulo 2). Antes era
  // una sola lista sin años y el total decía que todo salía de lo que vendes hoy.
  const plataAnios = useMemo(() => {
    const reinv = r.reinversionesDetalle || [], nuevas = r.nuevasDetalle || [];
    const deNombre = (nombre) => reinv.find((x) => x.nombre === nombre) || nuevas.find((x) => x.nombre === nombre) || null;
    const anioDe = (m) => anioCal(Math.floor((m || 0) / 12) + 1);
    const info = (nombre) => {
      const x = deNombre(nombre);
      if (!x) return { tasa: "—", hace: tx("Se invierte", "Invested") };
      if (x.aporte != null) {
        const tasa = x.rendimientoPct != null ? fmPct(x.rendimientoPct, 1) : x.rentaPctAnual > 0 ? fmPct(x.rentaPctAnual, 1) : x.valorizacionPct != null ? fmPct(x.valorizacionPct, 1) : "—";
        // La renta que le pusiste en el paso 1 (un local, la bodega) también cuenta.
        const kR = (r.filas || []).findIndex((f, k) => k > 0 && ((f.porActivo || []).find((a) => a.id === x.activoId)?.rentaNueva || 0) > 0.5);
        const rN = kR > 0 ? ((r.filas[kR].porActivo || []).find((a) => a.id === x.activoId).rentaNueva || 0) / 12 : 0;
        const hace = !(x.rentaMensual > 0) && !(x.teLlegaMes > 0) && rN > 0.5 ? tx(`Te paga ${fmM(rN)}/mes desde ${anioCal(kR)}`, `Pays you ${fmM(rN)}/mo from ${anioCal(kR)}`) : x.rentaMensual > 0 ? tx(`Te paga ${fmM(x.rentaMensual)}/mes desde ${anioDe(x.rentaDesdeMes)}`, `Pays you ${fmM(x.rentaMensual)}/mo from ${anioDe(x.rentaDesdeMes)}`) : x.teLlegaMes > 0 ? tx(`Te paga ${fmM(x.teLlegaMes)}/mes`, `Pays you ${fmM(x.teLlegaMes)}/mo`) : x.clase === "inmueble" ? tx("Se valoriza", "Appreciates") : tx("Se reinvierte", "Reinvested");
        return { tasa, hace };
      }
      return { tasa: fmPct(x.rendPct, 1), hace: x.pagaRenta ? tx("Te paga renta cada mes", "Pays you income monthly") : tx("Se reinvierte", "Reinvested") };
    };
    const deudaHace = (nombre) => { const d = (r.deudas || []).find((y) => nombre.includes(y.nombre)); return d && d.cuotaMes > 0.5 ? tx(`Dejas de pagar ${fmM(d.cuotaMes)}/mes`, `You stop paying ${fmM(d.cuotaMes)}/mo`) : tx("Baja lo que debes", "Lowers what you owe"); };
    const grupos = [];
    // Hoy: lo que vendes (y el capital nuevo, y tu liquidez) → deudas, inversiones, obras, colchón.
    const f1 = [];
    if (bd.deudas > 0.5) f1.push({ destino: `${tx("Pagar deudas", "Pay off debts")} (${(r.deudas || []).filter((x) => x.pagado > 0).map((x) => x.nombre).join(", ")})`, monto: bd.deudas, tasa: "—", hace: r.cuotasQueSalenMes > 0 ? tx(`Dejas de pagar ${fmM(r.cuotasQueSalenMes)}/mes`, `You stop paying ${fmM(r.cuotasQueSalenMes)}/mo`) : tx("Baja lo que debes", "Lowers what you owe") });
    const g1 = {};
    (bd.usos || []).filter((u) => (u.anio || 1) === 1 && u.monto > 0.5).forEach((u) => { g1[u.nombre] = (g1[u.nombre] || 0) + u.monto; });
    Object.entries(g1).forEach(([nombre, monto]) => f1.push({ destino: nombre, monto, ...info(nombre) }));
    if (bd.obras > 0.5) f1.push({ destino: tx("Obras", "Build-outs"), monto: bd.obras, tasa: "—", hace: tx("Mejoran lo que tienes", "Improve what you own") });
    if (bd.colchon > 0.5) f1.push({ destino: tx("Colchón para imprevistos", "Emergency cushion"), monto: bd.colchon, tasa: "—", hace: tx("Plata a la mano", "Cash on hand") });
    // 24-nov-2026: la misma cuenta en cascada del paso 3 (hoy también cuenta lo que te sobra en el
    // año); lo que mandas a tu fondo de reserva va como un renglón y «queda» es lo que pasa al siguiente.
    const cuentas = cuentaPorAnio(r);
    const reservaFila = (g) => (g.aReserva > 0.5 ? [{ destino: tx("Tu fondo de reserva", "Your reserve fund"), monto: g.aReserva, tasa: fmPct((g.tasaReserva || 0) * 100, 1), hace: tx("Guardado para años futuros", "Saved for future years") }] : []);
    const quedaDe = (g) => (g.queda < -0.5 ? g.queda : g.pasa);
    const c1 = cuentas.find((g) => g.anio === 1) || { flujo: 0, aReserva: 0, pasa: bd.restante || 0, queda: bd.restante || 0 };
    f1.push(...reservaFila(c1));
    const de1 = [...(r.vendidos || []).map((v) => v.nombre), ...((bd.capitalNuevoHoy ?? bd.capitalNuevo) > 0.5 ? [tx("capital nuevo", "new capital")] : []), ...(bd.desdeLiquidez - (bd.excesoCubierto || 0) > 0.5 ? [tx("tu liquidez", "your cash")] : []), ...(c1.flujo > 0.5 ? [tx("lo que te sobra", "your surplus")] : [])];
    if (f1.length) grupos.push({ anio: 1, filas: f1, de: de1, queda: quedaDe(c1) });
    // Años siguientes: la cuenta del año (lo que traes + lo que sobra + lo que llega − lo que usas).
    cuentas.filter((g) => g.anio > 1).forEach((g) => {
      if (!g.salen.length && !(g.aReserva > 0.5)) return;
      const filasA = g.salen.map((u) => u.tipo === "A" ? { destino: u.nombre, monto: u.monto, tasa: "—", hace: deudaHace(u.nombre) }
        : u.tipo === "F" ? { destino: u.nombre, monto: u.monto, tasa: "—", hace: tx("Pago de una compra de Lo que viene", "Payment for an upcoming purchase") }
        : { destino: u.nombre.replace(/^(Invertir en|Invest in) /, ""), monto: u.monto, ...info(u.nombre.replace(/^(Invertir en|Invest in) /, "")) });
      const de = [...(g.antes > 0.5 ? [tx(`lo que venía de ${anioCal(g.anio - 1)}`, `carried from ${anioCal(g.anio - 1)}`)] : []), ...(g.flujoHoy + Math.max(0, g.flujo) > 0.5 ? [tx("lo que te sobra", "your surplus")] : []), ...g.llegan.map((l) => String(l.id).endsWith("_retiro") ? tx(`lo que sacas de ${l.nombre}`, `what you take out of ${l.nombre}`) : tx(`la venta de ${l.nombre}`, `the sale of ${l.nombre}`))];
      filasA.push(...reservaFila(g));
      grupos.push({ anio: g.anio, filas: filasA, de, queda: quedaDe(g) });
    });
    return grupos.map((g) => ({ ...g, total: g.filas.reduce((t2, x) => t2 + x.monto, 0) }));
  }, [r]);
  const totalNueva = plataAnios.reduce((t2, g) => t2 + g.total, 0);

  // ── Todo lo que tienes / cuánto produce ───────────────────────────────────
  const tienes = (fy.porActivo || []).filter((a) => a.valor > 0.5).sort((a, b) => b.valor - a.valor);
  const totTienes = tienes.reduce((s, a) => s + a.valor, 0);
  const produce = (fy.porActivo || []).map((a) => ({ ...a, rM: a.renta / 12, cM: Math.max(0, a.crece) / 12 })).filter((a) => a.rM + a.cM > 0.5).sort((a, b) => b.rM + b.cM - (a.rM + a.cM));
  const maxProd = Math.max(1, ...produce.map((a) => a.rM + a.cM));

  // ── 7-nov-2026: el informe como una historia en 5 capítulos ─────────────────
  // (Santiago: "revisemos cómo diagramar mejor, para que integremos todo de una
  // forma clara, completa y que explique muy bien el escenario"). Ninguna gráfica
  // sale; se ordenan por la pregunta que responden.
  const faltan = filas.slice(1).filter((f) => f.ingresos < f.gastos).length;
  // 23-nov-2026 (Finanzas): el patrimonio del año 10 en pesos de hoy con la inflación del escenario, igual que la barra, la tarjeta, el comparador y la tabla.
  const finHoy = patrimonioFinalHoy(r);
  const infR = fmPct(inflacionDe(r), 1);
  const veredicto = tx(<>Este plan lleva tu patrimonio de <b>{fmM(f0.patrimonio)}</b> hoy a <b data-testid="f10-veredicto-fin">{fmM(finHoy)}</b> {esUS() ? `en dólares de hoy (inflación ${infR} al año)` : `en pesos de hoy (inflación ${infR} al año)`} en {anioCal(fin.anio)}{cagr != null ? <> (tus activos rinden {fmPct(cagr, 1)} al año, sin contar tu ahorro)</> : null}. {faltan === 0 ? <>Lo que entra cubre lo que sale <b>todos los años</b></> : <>En <b style={{ color: INF.txBad }}>{faltan} de {filas.length - 1} años</b> lo que entra no cubre lo que sale</>}{real != null ? <> y {real >= 0 ? <>tus activos le ganan a la inflación por <b style={{ color: INF.txOk }}>{fmPct(real, 1)} real</b> al año</> : <>tus activos pierden contra la inflación (<b style={{ color: INF.txBad }}>{fmPct(real, 1)} real</b> al año)</>}</> : null}.</>,
    <>This plan takes your net worth from <b>{fmM(f0.patrimonio)}</b> today to <b data-testid="f10-veredicto-fin">{fmM(finHoy)}</b> {esUS() ? `in today's dollars (${infR} yearly inflation)` : `in today's pesos (${infR} yearly inflation)`} in {anioCal(fin.anio)}{cagr != null ? <> (your assets earn {fmPct(cagr, 1)} a year, excluding savings)</> : null}. {faltan === 0 ? <>What comes in covers what goes out <b>every year</b></> : <>In <b style={{ color: INF.txBad }}>{faltan} of {filas.length - 1} years</b> income doesn't cover spending</>}{real != null ? <> and {real >= 0 ? <>your assets beat inflation by <b style={{ color: INF.txOk }}>{fmPct(real, 1)} real</b> a year</> : <>your assets lose to inflation (<b style={{ color: INF.txBad }}>{fmPct(real, 1)} real</b> a year)</>}</> : null}.</>);
  const CAPS = [["cap-veredicto", tx("Veredicto", "Verdict")], ["cap-plata", tx("Tu plata", "Your money")], ["cap-mes", tx("Tu mes", "Your month")], ["cap-patrimonio", tx("Patrimonio", "Net worth")], ["cap-bueno", tx("¿Es buen plan?", "Good plan?")]];
  const irA = (id) => { const el = typeof document !== "undefined" && document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const Indice = () => <nav aria-label={tx("Capítulos del informe", "Report chapters")} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
    {CAPS.map(([id, l], i) => <button key={id} onClick={() => irA(id)} style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${INF.linea}`, background: "transparent", color: INF.tx, fontSize: 12.5, cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ color: INF.txDorado, fontWeight: 700 }}>{i + 1}</span>{l}</button>)}
  </nav>;
  const Capitulo = ({ id, n, titulo, pregunta }) => <div id={id} style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: n === 1 ? "4px 0 12px" : "30px 0 12px", scrollMarginTop: 80 }}>
    <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: INF.txDorado, fontVariantNumeric: "tabular-nums", minWidth: 28 }}>{n}</div>
    <div style={{ borderLeft: `1px solid ${INF.linea}`, paddingLeft: 12 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: INF.tx }}>{titulo}</h2>
      <div style={{ fontSize: 13.5, color: INF.tx2, marginTop: 3, lineHeight: 1.45 }}>{pregunta}</div>
    </div>
  </div>;

  // Selector de año (capítulos 3 y 4). Mismo estado en los dos lugares.
  const SelAnio = ({ compacto }) => <div role="group" aria-label={tx("Elegir año", "Pick a year")} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: compacto ? "4px 0 10px" : "0 0 12px" }}>
    <span style={{ fontSize: 12.5, color: INF.tx2, marginRight: 4 }}>{compacto ? tx("Año:", "Year:") : tx("Ver el año:", "Show year:")}</span>
    {filas.slice(1).map((f) => { const on = f.anio === aSel; return <button key={f.anio} type="button" onClick={() => setAnioSel(f.anio)} aria-pressed={on}
      style={{ padding: "6px 11px", borderRadius: 999, border: `1px solid ${on ? INF.tx : INF.linea}`, background: on ? INF.tx : "transparent", color: on ? INF.panel : INF.tx, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>{anioCal(f.anio)}</button>; })}
  </div>;
  const IndicadoresAnio = () => { const e = (fy.ingresos || 0) / 12, sa = (fy.gastos || 0) / 12, so = (fy.cf || 0) / 12; return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 10, marginBottom: 14 }}>
    <Ficha l={tx(`Entra al mes en ${anioCal(aSel)}`, `Monthly income in ${anioCal(aSel)}`)} v={fmM(e)} s={tx(`rentas ${fmM((fy.rentas || 0) / 12)} · trabajo ${fmM((fy.laboral || 0) / 12)}`, `income ${fmM((fy.rentas || 0) / 12)} · work ${fmM((fy.laboral || 0) / 12)}`)} col={INF.azul} />
    <Ficha l={tx(`Sale al mes en ${anioCal(aSel)}`, `Monthly spending in ${anioCal(aSel)}`)} v={fmM(sa)} s={tx(`gastos ${fmM(((fy.gastos || 0) - (fy.cuota || 0)) / 12)} · cuotas ${fmM((fy.cuota || 0) / 12)}`, `expenses ${fmM(((fy.gastos || 0) - (fy.cuota || 0)) / 12)} · payments ${fmM((fy.cuota || 0) / 12)}`)} col={INF.txTeja} />
    <Ficha l={so >= 0 ? tx(`Sobra al mes en ${anioCal(aSel)}`, `Monthly surplus in ${anioCal(aSel)}`) : tx(`Falta al mes en ${anioCal(aSel)}`, `Monthly shortfall in ${anioCal(aSel)}`)} v={`${so >= 0 ? "+" : ""}${fmM(so)}`} s={sa > 0 ? tx(`cobertura ${fmPct(e / sa * 100, 0)}`, `coverage ${fmPct(e / sa * 100, 0)}`) : ""} col={so >= 0 ? INF.txOk : INF.txBad} />
  </div>; };

  const Toggle = () => <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
    {[["nominal", esUS() ? tx("Dólares de cada año", "Each year's dollars") : tx("Pesos de cada año", "Each year's pesos")], ["real", esUS() ? tx(`En dólares de hoy (inflación ${fmPct(inflacionDe(r), 1)} al año)`, `In today's dollars (${fmPct(inflacionDe(r), 1)} yearly inflation)`) : tx(`En pesos de hoy (inflación ${fmPct(inflacionDe(r), 1)} al año)`, `In today's pesos (${fmPct(inflacionDe(r), 1)} yearly inflation)`)]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${modo === k ? INF.tx : INF.linea}`, background: modo === k ? INF.tx : "transparent", color: modo === k ? INF.panel : INF.tx2, fontSize: 12, cursor: "pointer" }}>{l}</button>)}
  </div>;

  // 19-nov-2026 (Santiago: "muchos problemas de diagramación"): con cifras
  // completas ($71.238.343.780) el número se salía de la ficha. Fichas más
  // anchas, tamaño que se ajusta al ancho y corte de línea como último recurso.
  const Ficha = ({ l, v, s, col, heroe, ancha }) => <div className={ancha ? "fp-ancha" : undefined} style={{ ...card, marginBottom: 0, padding: heroe ? 24 : 14, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: heroe ? "center" : "flex-start" }}>
    <div style={{ fontSize: heroe ? 13 : 12, color: INF.tx2 }}>{l}</div>
    {/* 21-nov-2026: la cifra siempre en un renglón y con tamaño moderado; se
        achica sola según el ancho de la ficha (tamanoCifra + container query). */}
    <div style={{ containerType: "inline-size", margin: "4px 0" }}>
      <div style={{ fontSize: tamanoCifra(v, heroe ? 30 : 20), whiteSpace: "nowrap", fontWeight: 600, color: col || INF.tx, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{v}</div>
    </div>
    <div style={{ fontSize: 12, color: INF.tx2, lineHeight: 1.4 }}>{s}</div>
  </div>;

  const finLabel = (key, txt, color) => (p) => (p.index === mes.length - 1 ? <text x={p.x + 6} y={p.y + 4} fill={color} fontSize={12} fontWeight={600}>{txt}</text> : null);

  return (
    <div style={{ color: INF.tx }}>
      <Indice />
      <Capitulo id="cap-veredicto" n={1} titulo={tx("El veredicto", "The verdict")} pregunta={tx("¿Qué tan bueno es este plan, en una línea?", "How good is this plan, in one line?")} />
      <div style={{ ...card, fontSize: 16, lineHeight: 1.55, color: INF.tx }}>{veredicto}</div>
      {/* 19-nov-2026: un número protagonista (el patrimonio al final) grande a la
          izquierda y el resto como contexto, en vez de seis fichas iguales en fila. */}
      <style>{`.fp-veredicto { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 14px; } @media (min-width: 760px) { .fp-veredicto { grid-template-columns: minmax(260px, 1fr) 2fr; } .fp-veredicto-resto { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } .fp-ancha { grid-column: span 2; } }`}</style>
      <div className="fp-veredicto">
        <Ficha heroe l={esUS() ? tx(`Patrimonio en ${anioCal(fin.anio)}, en dólares de hoy (inflación ${infR})`, `Net worth in ${anioCal(fin.anio)}, in today's dollars (${infR} inflation)`) : tx(`Patrimonio en ${anioCal(fin.anio)}, en pesos de hoy (inflación ${infR})`, `Net worth in ${anioCal(fin.anio)}, in today's pesos (${infR} inflation)`)} v={fmM(finHoy)} s={`${esUS() ? tx(`en dólares de ${anioCal(fin.anio)}: `, `in ${anioCal(fin.anio)} dollars: `) : tx(`en pesos de ${anioCal(fin.anio)}: `, `in ${anioCal(fin.anio)} pesos: `)}${fmM(fin.patrimonio)} · ${tx("hoy", "today")} ${fmM(f0.patrimonio)}${cagr != null ? tx(` · tus activos rinden ${fmPct(cagr, 1)} al año`, ` · your assets earn ${fmPct(cagr, 1)} a year`) : ""}`} />
        <div className="fp-veredicto-resto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 10 }}>
        <Ficha l={tx("Produce al mes", "Earns per month")} v={fmM(produceMes)} s={tx(`renta ${fmM(rentaMes)} + multiplica ${fmM(multiplicaMes)}`, `income ${fmM(rentaMes)} + compounding ${fmM(multiplicaMes)}`)} />
        <Ficha l={tx("Rendimiento del patrimonio", "Return on net worth")} v={fmPct(rendimiento, 1)} s={tx("anual, sobre lo que tienes", "per year, on what you own")} />
        <Ficha l={tx("Sale al mes", "Goes out per month")} v={fmM(saleMes)} s={tx("gastos + cuotas", "expenses + loan payments")} />
        <Ficha ancha l={entraMes - saleMes >= 0 ? tx("Sobra al mes y se reinvierte", "Monthly surplus, reinvested") : tx("Falta al mes", "Monthly shortfall")} v={`${entraMes - saleMes >= 0 ? "+" : ""}${fmM(entraMes - saleMes)}`} s={entraMes - saleMes >= 0 ? (r.destinoSobra || tx("lo que entra menos lo que sale", "what comes in minus what goes out")) : tx("sale de tu liquidez", "comes out of your cash")} col={entraMes - saleMes >= 0 ? INF.txOk : INF.txBad} />
        <Ficha l={tx("Le gana a la inflación", "Beats inflation")} v={real == null ? "—" : `${real >= 0 ? "+" : ""}${fmPct(real, 1)}`} s={tx(`real al año · en ${ganaN} de ${gana.length} años`, `real per year · in ${ganaN} of ${gana.length} years`)} col={real != null && real >= 0 ? INF.txOk : INF.txBad} />
        </div>
      </div>

      {/* 23-nov-2026 (Santiago: "en Qué haces con tu plata, puntos 1 al 4, solo está mostrando
          2026… debería mostrar también cada año, para que todo tenga el mismo lenguaje"). El
          capítulo 2 sigue el mismo año que los capítulos 3 y 4 (un solo selector, en tres lugares). */}
      <Capitulo id="cap-plata" n={2} titulo={tx("Qué haces con tu plata", "What you do with your money")} pregunta={tx("Elige un año: qué vendes, de dónde sale y a dónde va cada peso, cómo va cada inversión y qué cambia en tu bolsillo ese año.", "Pick a year: what you sell, where every dollar comes from and goes, how each investment is doing and what changes in your pocket that year.")} />
      <SelAnio />
      <HistoriaPlata r={r} anio={aSel} />
      {plataAnios.length > 0 && <div style={card}>
        <h3 style={h3}>{tx("La plata que mueves, año por año", "The money you move, year by year")} · {fmM(totalNueva)}</h3>
        <p style={lead}>{tx("Cada año, de dónde sale la plata y en qué la pones. Lo que ya tienes y no se mueve no aparece aquí; lo que no usas un año pasa al siguiente.", "Each year, where the money comes from and what you put it into. What you own and don't move isn't here; what you don't use carries to the next year.")}</p>
        <details><summary style={{ cursor: "pointer", fontSize: 13, color: INF.tx2, padding: "4px 0" }}>{tx("Ver la tabla de todos los años", "See the table for all years")}</summary>
        <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("En qué la pones", "What you put it into")}</th><th style={th}>{tx("Monto", "Amount")}</th><th style={th}>{tx("Rinde", "Returns")}</th><th style={{ ...th, textAlign: "left" }}>{tx("Qué hace", "What it does")}</th></tr></thead>
          {plataAnios.map((g) => <tbody key={g.anio}>
            <tr><td colSpan={4} style={{ ...tdL, background: "var(--fp-raised)", padding: "10px 8px 8px", borderBottom: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontSize: 14 }}>{g.anio <= 1 ? tx(`Hoy · ${anioCal(1)}`, `Today · ${anioCal(1)}`) : anioCal(g.anio)}</b>
                <b style={{ fontVariantNumeric: "tabular-nums" }}>{fmM(g.total)}</b>
              </div>
              {g.de.length > 0 && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 2 }}>{tx("Sale de ", "Comes from ")}{g.de.join(", ")}.</div>}
            </td></tr>
            {g.filas.map((x, i) => <tr key={i}><td style={tdL}>{x.destino}</td><td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{fmM(x.monto)}</td><td style={td}>{x.tasa}</td><td style={{ ...tdL, color: INF.tx2 }}>{x.hace}</td></tr>)}
            {g.queda > 0.5 && <tr><td style={{ ...tdL, color: INF.tx2 }}>{g.anio < nAniosSel ? tx(`Queda para ${anioCal(g.anio + 1)}`, `Left for ${anioCal(g.anio + 1)}`) : tx("Queda invertido", "Stays invested")}</td><td style={{ ...td, color: INF.tx2, fontVariantNumeric: "tabular-nums" }}>{fmM(g.queda)}</td><td style={td} /><td style={{ ...tdL, color: INF.tx2 }}>{tx("Mientras tanto se invierte según tu mezcla", "Invested per your mix meanwhile")}</td></tr>}
          </tbody>)}
          <tbody><tr><td style={{ ...tdL, fontWeight: 700, borderBottom: "none", paddingTop: 12 }}>{tx(`Lo que pones a trabajar en ${nAniosSel} años`, `What you put to work over ${nAniosSel} years`)}</td><td style={{ ...td, fontWeight: 700, borderBottom: "none", paddingTop: 12, fontVariantNumeric: "tabular-nums" }}>{fmM(totalNueva)}</td><td style={{ ...td, borderBottom: "none" }} /><td style={{ ...td, borderBottom: "none" }} /></tr></tbody>
        </table></div></details>
      </div>}

      <Capitulo id="cap-mes" n={3} titulo={tx("Tu mes, año por año: ¿alcanza para vivir?", "Your month, year by year: is it enough to live on?")} pregunta={tx("Lo que entra, lo que sale y lo que sobra cada mes del año elegido. El año es el mismo en los capítulos 2, 3 y 4.", "What comes in, goes out and is left each month of the chosen year. The year is the same in chapters 2, 3 and 4.")} />
      <SelAnio />
      <IndicadoresAnio />
      <MesCompleto r={r} card={card} h3={h3} lead={lead} anio={aSel} lista={listaAnio} />
      {/* 20-nov-2026 (Santiago: "esto sobra si ya los gráficos muestran ingresos y
          gastos"). Las listas repetían el Sankey; quedan plegadas justo debajo,
          para quien quiera ver cada partida (el Sankey agrupa las pequeñas). */}
      {listaAnio && <details style={{ margin: "-4px 0 14px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: INF.tx2, padding: "6px 2px" }}>{tx(`Ver la lista completa de ${anioCal(aSel)}, partida por partida`, `See the full ${anioCal(aSel)} list, line by line`)}</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14, marginTop: 10 }}>
        {[[tx("Lo que entra cada mes", "What comes in each month"), aSel === 1 ? tx(`En ${anioCal(1)}, partida por partida. Las rentas de tus inmuebles van netas de sus costos.`, `In ${anioCal(1)}, line by line. Rental income is net of property costs.`) : tx(`En ${anioCal(aSel)}, al mes, partida por partida: tu trabajo, la renta de cada activo y los ingresos que ya empezaron.`, `In ${anioCal(aSel)}, per month: your work, each asset's income and incomes that have started.`), listaAnio.entra, INF.azul, fy.ingresos / 12], [tx("Lo que sale cada mes", "What goes out each month"), aSel === 1 ? tx("En el año 1: tus gastos de Egresos, las cuotas de las deudas que siguen y los gastos futuros que ya empezaron.", "In year 1: your expenses, payments on remaining debts and future expenses that have already started.") : tx(`En ${anioCal(aSel)}, al mes, partida por partida: tus gastos de Egresos con la inflación de cada año, los gastos futuros que corren ese año y la cuota de cada deuda que sigue.`, `In ${anioCal(aSel)}, per month: your expenses (with inflation), future expenses running that year, those that ended and loan payments.`), listaAnio.sale, INF.teja, fy.gastos / 12]].map(([t, l, lista, col, tot]) => {
          const mx = Math.max(1, ...lista.map((x) => Math.abs(x.mensual)));
          return <div key={t} style={card}>
            <h3 style={h3}>{t} · {fmM(tot)}</h3>
            <p style={lead}>{l}</p>
            {(verTodo[t] ? lista : lista.slice(0, 10)).map((x, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(100px,42%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
              <span style={{ minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nombre}</span>{x.nota && <span style={{ fontSize: 12, color: INF.tx2 }}>{x.nota}</span>}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 12, width: `${Math.max(1, Math.abs(x.mensual) / mx * 60)}%`, background: x.mensual < 0 ? INF.gris : col, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(x.mensual)}</span></span>
            </div>)}
            {lista.length > 10 && <button onClick={() => setVerTodo((v) => ({ ...v, [t]: !v[t] }))} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 999, border: `1px solid ${INF.linea}`, background: "transparent", color: INF.tx2, fontSize: 12, cursor: "pointer" }}>{verTodo[t] ? tx("Ver solo las 10 más grandes", "Show only the 10 largest") : tx(`Ver las ${lista.length - 10} restantes`, `Show the other ${lista.length - 10}`)}</button>}
          </div>;
        })}
        </div>
      </details>}
      <Toggle />
      <div style={card}>
        <h3 style={h3}>{tx("Mes a mes: ¿alcanza para vivir? Así se comporta el plan en el tiempo", "Month by month: is it enough to live on? How the plan holds up over time")}</h3>
        <p style={lead}>{tx(<><b>Línea azul:</b> lo que entra cada mes. <b>Línea roja punteada:</b> lo que sale para vivir. <b>Franja verde:</b> lo que sobra, que no se queda quieto: {r.destinoSobra || "se reinvierte"}. Las líneas verticales marcan los cambios. Mientras la azul esté por encima de la roja, el plan se sostiene solo.</>, <><b>Blue line:</b> what comes in each month. <b>Dashed red line:</b> what goes out to live. <b>Green band:</b> the surplus, which doesn't sit idle: {r.destinoSobra || "it's reinvested"}. Vertical lines mark changes. As long as blue stays above red, the plan pays for itself.</>)}</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={mes} margin={{ top: 30, right: 150, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={104} />
            <Tooltip content={(q) => <ChartTooltip {...q} payload={(q.payload || []).filter((x) => x.dataKey !== "base")} formatter={tip} />} />
            <Area type="stepAfter" dataKey="base" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" name=" " tooltipType="none" />
            <Area type="stepAfter" dataKey="sobra" stackId="b" stroke="none" fill={INF.franja} isAnimationActive={false} name={tx("Sobra", "Surplus")} />
            {marcas.map((m, i) => <ReferenceLine key={m.anio} x={anioTxt(m.anio)} stroke={INF.ref} strokeDasharray="2 3"
              label={(q) => <g><circle cx={q.viewBox.x} cy={q.viewBox.y - 14} r={9} fill={INF.navy} /><text x={q.viewBox.x} y={q.viewBox.y - 10} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{i + 1}</text></g>} />)}
            <Line type="stepAfter" dataKey="entra" name={tx("Entra", "In")} stroke={INF.azul} strokeWidth={2.5} dot={false} label={finLabel("entra", `${tx("Entra", "In")} ${fmM(mes[mes.length - 1]?.entra)}`, INF.azul)} />
            <Line type="stepAfter" dataKey="sale" name={tx("Sale", "Out")} stroke={INF.teja} strokeWidth={2} strokeDasharray="5 4" dot={false} label={finLabel("sale", `${tx("Sale", "Out")} ${fmM(mes[mes.length - 1]?.sale)}`, INF.teja)} />
          </ComposedChart>
        </ResponsiveContainer></div></div>
        {/* 19-nov-2026 (Santiago: "muchos problemas de diagramación"): los hitos
            iban en tres columnas con textos largos cortados a mitad de frase. Ahora
            es una línea de tiempo: número, año en su columna y cada cambio en su
            renglón. */}
        {marcas.length > 0 && <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 4px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,400px),1fr))", gap: "10px 24px" }}>
          {marcas.map((m, i) => <li key={m.anio} style={{ display: "grid", gridTemplateColumns: "20px 44px 1fr", gap: "0 8px", alignItems: "start", fontSize: 13, lineHeight: 1.45, color: INF.tx, paddingTop: 8, borderTop: `1px solid ${INF.linea}` }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: INF.navy, color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
            <b style={{ fontVariantNumeric: "tabular-nums" }}>{anioTxt(m.anio)}</b>
            <span style={{ display: "grid", gap: 2, color: INF.tx2, minWidth: 0 }}>{ev.filter((x) => x.anio === m.anio).map((x, k) => <span key={k}>{x.texto}</span>)}</span>
          </li>)}
        </ol>}
        {apretado && <div style={{ fontSize: 12.5, color: INF.tx2, marginTop: 12, paddingTop: 8, borderTop: `1px solid ${INF.linea}` }}>{tx("Año más apretado:", "Tightest year:")} <b style={{ color: apretado.s >= 0 ? INF.tx : INF.txBad }}>{anioTxt(apretado.f.anio)}, {apretado.s >= 0 ? tx(`sobran ${fmM(apretado.s)}`, `${fmM(apretado.s)} surplus`) : tx(`faltan ${fmM(-apretado.s)}`, `${fmM(-apretado.s)} short`)} {tx("al mes", "a month")} ({fmPct(apretado.f.gastos > 0 ? apretado.f.ingresos / apretado.f.gastos * 100 : 0, 0)} {tx("de cobertura", "coverage")})</b>.</div>}
      </div>
      {reinvierteAnio.length > 0 && <div style={{ ...card, borderColor: INF.dorado }}>
        <h3 style={h3}>{tx(`Lo que rinde y no te llega al mes · ${anioCal(aSel)}`, `Returns that don't reach you monthly · ${anioCal(aSel)}`)}</h3>
        <p style={lead}>{esUS()
          ? tx("Estas inversiones producen, pero todo se reinvierte: hacen crecer el patrimonio y no suman a lo que entra cada mes. Si alguna te paga (un bono o una cuenta que paga intereses), cámbiala en el paso 3, Tu plata → «De lo que rinde, ¿cuánto te llega?».", "These investments earn, but everything is reinvested: they grow your net worth and don't add to your monthly income. If one pays you (a bond or an interest-paying account), change it in step 3, Your money → \"Of what it earns, how much reaches you?\".")
          : tx("Estas inversiones producen, pero todo se reinvierte: hacen crecer el patrimonio y no suman a lo que entra cada mes. Si alguna te paga (una renta fija como BTG), cámbiala en el paso 3, Tu plata → «De lo que rinde, ¿cuánto te llega?».", "These investments earn, but everything is reinvested: they grow your net worth and don't add to your monthly income. If one pays you (fixed income such as BTG), change it in step 3, Your money → \"Of what it earns, how much reaches you?\".")}</p>
        {reinvierteAnio.map((x) => <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${INF.linea}` }}><span>{x.nombre} <span style={{ color: INF.tx2, fontSize: 12 }}>· {fmPct(x.pct, 1)} {tx("al año", "a year")}</span></span><b style={{ color: INF.txDorado, whiteSpace: "nowrap" }}>{fmM(x.mensual)}{tx("/mes se reinvierte", "/mo reinvested")}</b></div>)}
      </div>}

      <Capitulo id="cap-patrimonio" n={4} titulo={tx("Tu patrimonio: cómo crece", "Your net worth: how it grows")} pregunta={tx("Cuánto vale todo lo que tienes cada año y qué inversión lo empuja.", "What everything you own is worth each year and which investment drives it.")} />
      <div style={card}>
        <h3 style={h3}>{tx("Patrimonio neto por año", "Net worth by year")}</h3>
        <p style={lead}>{hayDeuda ? tx("Cada color es un activo: arriba lo que tienes y abajo, en naranja, lo que debes. El número de arriba es tu patrimonio neto: lo que tienes menos lo que debes.", "Each color is an asset: above, what you own; below, in orange, what you owe. The number on top is your net worth: what you own minus what you owe.") : tx("Cada color es un activo; el número de arriba es tu patrimonio neto.", "Each color is an asset; the number on top is your net worth.")}</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
          <BarChart data={patP} stackOffset="sign" margin={{ top: 22, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} interval={1} />
            <YAxis {...eje} tickFormatter={fmEje} width={104} domain={[pisoPat, ticksPat[ticksPat.length - 1]]} ticks={ticksPat} allowDataOverflow />
            {hayDeuda && <ReferenceLine y={0} stroke={INF.eje} />}
            {/* Solo lo que vale algo ese año, de mayor a menor, con el neto arriba. */}
            <Tooltip cursor={{ fill: "rgba(127,127,127,0.12)" }} content={(q) => { const neto = q.payload?.[0]?.payload?.total; return <ChartTooltip {...q} payload={(q.payload || []).filter((x) => Math.abs(Number(x.value) || 0) > 0.5).sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))} formatter={tip} labelFormatter={(l) => (neto != null ? `${l} · ${tx("patrimonio neto", "net worth")} ${fmM(neto)}` : l)} />; }} />
            <Bar dataKey="otros" stackId="v" name={tx("Otros activos", "Other assets")} fill={INF.gris} />
            {sP.map((s, i) => <Bar key={s.id} dataKey={s.id} stackId="v" name={s.nombre} fill={s.color}>{i === sP.length - 1 && <LabelList dataKey="totalEt" position="top" style={{ fill: INF.tx, fontSize: 12 }} />}</Bar>)}
            {hayDeuda && <Bar dataKey="deudas" stackId="v" name={tx("Lo que debes", "What you owe")} fill={INF.teja} fillOpacity={0.75} />}
          </BarChart>
        </ResponsiveContainer></div></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: INF.tx2 }}>{[...sP, { nombre: tx("Otros activos", "Other assets"), color: INF.gris }, ...(hayDeuda ? [{ nombre: tx("Lo que debes", "What you owe"), color: INF.teja }] : [])].map((s) => <span key={s.nombre}><span style={{ display: "inline-block", width: 8, height: 8, background: s.color, marginRight: 4 }} />{s.nombre}</span>)}</div>
      </div>
      <div style={card}>
        <h3 style={h3}>{tx("Cada inversión, año por año", "Each investment, year by year")}</h3>
        <p style={lead}>{tx("El valor de las inversiones más grandes. «Juntas» las compara en la misma escala; «Cada una» le da a cada inversión su propia escala, para ver cómo crece aunque sea pequeña.", "Value of your largest investments. \"Together\" compares them on one scale; \"One by one\" gives each its own scale, so you can see it grow even if it's small.")}</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{[["juntas", tx("Juntas", "Together")], ["cada", tx("Cada una", "One by one")]].map(([k, l]) => <button key={k} onClick={() => setVistaInv(k)} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${vistaInv === k ? INF.tx : INF.linea}`, background: vistaInv === k ? INF.tx : "transparent", color: vistaInv === k ? INF.panel : INF.tx2, fontSize: 12, cursor: "pointer" }}>{l}</button>)}</div>
        {vistaInv === "cada" ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 }}>
          {sV.top.map((s) => { const v0 = pat[0]?.[s.id] || 0, vf = pat[pat.length - 1]?.[s.id] || 0; return <div key={s.id} style={{ border: `1px solid ${INF.linea}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nombre}</b>{v0 > 0.5 && <b style={{ color: s.color, whiteSpace: "nowrap" }}>×{(vf / v0).toLocaleString(esUS() ? "en-US" : "es-CO", { maximumFractionDigits: 1 })}</b>}</div>
            <div style={{ fontSize: 12, color: INF.tx2, margin: "2px 0 6px" }}>{fmM(v0)} → <b style={{ color: INF.tx }}>{fmM(vf)}</b></div>
            <ResponsiveContainer width="100%" height={110}><ComposedChart data={pat} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="anio" hide /><YAxis hide domain={[0, "auto"]} />
              <Tooltip content={tipLimpio()} />
              <Area type="monotone" dataKey={s.id} name={s.nombre} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.18} isAnimationActive={false} />
            </ComposedChart></ResponsiveContainer>
          </div>; })}
        </div> : <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={300}>
          <LineChart data={pat} margin={{ top: 10, right: 180, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} interval={1} />
            <YAxis {...eje} tickFormatter={fmEje} width={104} />
            <Tooltip content={tipLimpio()} />
            {sL.map((s) => <Line key={s.id} type="monotone" dataKey={s.id} name={s.nombre} stroke={s.color} strokeWidth={2} dot={false} />)}
            {/* 19-nov-2026 (Santiago: "mal alineado"): las etiquetas del final se
                montaban unas sobre otras (BTG y rapcicredit terminan casi igual) y
                se cortaban a la derecha. Se ordenan y se separan al menos 14 px. */}
            <Customized component={EtiquetasFin} />
          </LineChart>
        </ResponsiveContainer></div></div>}
      </div>
      <SelAnio compacto />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 14 }}>
        <div style={card}>
          <h3 style={h3}>{aSel === 1 ? tx("Todo lo que tienes después del plan", "Everything you own after the plan") : tx(`Todo lo que tienes en ${anioCal(aSel)}`, `Everything you own in ${anioCal(aSel)}`)} · {fmM(totTienes)}</h3>
          <p style={lead}>{aSel === 1 ? tx("Lo que ya tenías y no se mueve, más la plata nueva. Foto del primer año.", "What you already had and don't move, plus the new money. Snapshot of year one.") : tx(`Foto de ${anioCal(aSel)}: lo que vale cada cosa ese año.`, `Snapshot of ${anioCal(aSel)}: what each thing is worth that year.`)} {(fy.deuda || 0) > 0.5 ? tx(`Menos deudas (${fmM(fy.deuda)}) = patrimonio neto ${fmM(fy.patrimonio)}.`, `Minus debts (${fmM(fy.deuda)}) = net worth ${fmM(fy.patrimonio)}.`) : ""}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: INF.tx2, marginBottom: 8 }}>{[...new Set(tienes.map((a) => a.clase))].map((c) => <span key={c}><span style={{ display: "inline-block", width: 8, height: 8, background: COLOR_CLASE[c] || INF.gris, marginRight: 4 }} />{ETQ_CLASE[c] || c}</span>)}</div>
          {tienes.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ height: 14, width: `${Math.max(1, a.valor / (tienes[0]?.valor || 1) * 70)}%`, background: COLOR_CLASE[a.clase] || INF.gris, borderRadius: 3 }} /><span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.valor)} · {fmPct(totTienes > 0 ? a.valor / totTienes * 100 : 0, 0)}</span></span>
          </div>)}
        </div>
        <div style={card}>
          <h3 style={h3}>{tx("Cuánto produce cada activo", "What each asset earns")}</h3>
          <p style={lead}>{tx(`Al mes, en ${anioCal(aSel)}. Azul: renta que se recibe. Dorado: lo que multiplica (se reinvierte).`, `Per month, in ${anioCal(aSel)}. Blue: income you receive. Gold: compounding (reinvested).`)}</p>
          {produce.map((a) => <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(90px,38%) 1fr", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ display: "flex", width: `${Math.max(1, (a.rM + a.cM) / maxProd * 70)}%`, height: 14 }}>{a.rM > 0 && <span style={{ flex: a.rM, background: INF.azul }} />}{a.cM > 0 && <span style={{ flex: a.cM, background: INF.dorado }} />}</span>
              <span style={{ whiteSpace: "nowrap", color: INF.tx2 }}>{fmM(a.rM + a.cM)}</span></span>
          </div>)}
          <div style={{ borderTop: `1px solid ${INF.linea}`, marginTop: 8, paddingTop: 8, fontSize: 13, fontWeight: 600 }}>{tx(`Total produce ${fmM(((fy.rentas || 0) + (fy.crece || 0)) / 12)}/mes`, `Total earns ${fmM(((fy.rentas || 0) + (fy.crece || 0)) / 12)}/mo`)} <span style={{ color: INF.tx2, fontWeight: 400 }}>({tx(`renta ${fmM((fy.rentas || 0) / 12)} + multiplica ${fmM((fy.crece || 0) / 12)}`, `income ${fmM((fy.rentas || 0) / 12)} + compounding ${fmM((fy.crece || 0) / 12)}`)})</span></div>
        </div>
      </div>

      <Capitulo id="cap-bueno" n={5} titulo={tx("¿Es buen plan?", "Is it a good plan?")} pregunta={tx("Cuánto produce el patrimonio y si le gana a la inflación.", "What your net worth earns and whether it beats inflation.")} />
      <div style={card}>
        <h3 style={h3}>{tx("Año a año: todo lo que produce el patrimonio", "Year by year: everything your net worth earns")}</h3>
        <p style={lead}>{tx("Abajo, en tonos azules y verdes, lo que llega a la cuenta cada año (rentas y pensiones). Arriba, lo que se queda invertido y crece. El número sobre cada barra es el total que produjo el patrimonio ese año. La línea roja es lo que sale para vivir.", "Bottom, in blues and greens: what reaches your account each year (income and pensions). Top: what stays invested and grows. The number above each bar is the total your net worth earned that year. The red line is what goes out to live.")}</p>
        <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}><ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={prod} margin={{ top: 22, right: 8, left: 6, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="anio" {...eje} />
            <YAxis {...eje} tickFormatter={fmEje} width={104} />
            <Tooltip cursor={{ fill: "rgba(127,127,127,0.12)" }} content={tipLimpio((l, row) => `${l} · ${tx("produce", "earns")} ${fmM(row.total)}`)} />
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

      <details style={card}><summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, color: INF.tx }}>{tx("Ver la tabla año por año", "See the year-by-year table")}</summary>
        <div style={{ height: 10 }} />
        <p style={lead}>{nombre}. {modo === "real" ? tx(`En ${monedas()} de hoy.`, `In today's ${monedas()}.`) : tx(`En ${monedas()} de cada año.`, `In each year's ${monedas()}.`)} {tx("Cobertura = lo que entra ÷ lo que sale.", "Coverage = money in ÷ money out.")}</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>{tx("Año", "Year")}</th><th style={th}>{tx("Patrimonio", "Net worth")}</th>{sL.map((s) => <th key={s.id} style={th}>{(s.nombre || "").slice(0, 18)}</th>)}<th style={th}>{tx("Deuda", "Debt")}</th><th style={th}>{tx("Cobertura", "Coverage")}</th></tr></thead>
          <tbody>{filas.map((f, i) => <tr key={f.anio}><td style={tdL}>{f.anio === 0 ? tx("Hoy", "Today") : anioCal(f.anio)}</td><td style={td} data-testid={`f10-tabla-pat-${f.anio}`}>{fmM(f.patrimonio / d(f))}</td>
            {sL.map((s) => <td key={s.id} style={td}>{pat[i][s.id] ? fmM(pat[i][s.id]) : "—"}</td>)}
            <td style={td}>{f.deuda > 0 ? fmM(f.deuda / d(f)) : "—"}</td><td style={td}>{f.gastos > 0 ? fmPct(f.ingresos / f.gastos * 100, 0) : "—"}</td></tr>)}</tbody>
        </table></div>
      </details>
    </div>
  );
}
