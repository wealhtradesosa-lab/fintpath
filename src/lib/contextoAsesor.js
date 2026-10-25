// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Contexto completo para el Asesor IA
//
// 24-oct-2026 (Santiago: "necesitamos que el agente de IA tenga acceso a todas
// las secciones de la plataforma, para que pueda opinar de todo lo que uno
// tiene… por ejemplo, qué opina de mis planes futuros"). Antes el asesor solo
// veía totales, inversiones, ingresos, gastos por categoría y deudas. Ahora
// también: cuánto renta cada inversión, el detalle de gastos, metas, plan de
// retiro, portafolio de trading y TODOS los escenarios de «Mi futuro a 10 años»
// con sus decisiones y resultados (incluido el que está armando sin guardar).
//
// Todo en pesos; lo apagado (sim === false) no existe. Texto compacto para no
// gastar contexto: cifras redondeadas a millones cuando pasan de $10 M.
// ═══════════════════════════════════════════════════════════════════════════
import { proyectarFuturo10, inversionesHoy, ingresosSueltosHoy, migrarModifica, resumenEscenario } from "./futuro10.js";
import { montoPromedioMensual } from "./flowHelpers.js";

const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [], gastos: [] } };
const n = (v) => Number(v) || 0;
export const fmC = (v) => {
  const x = n(v), a = Math.abs(x), sg = x < 0 ? "-" : "";
  if (a >= 1e7) return `${sg}$${Math.round(a / 1e6).toLocaleString("es-CO")}M`;
  return `${sg}$${Math.round(a).toLocaleString("es-CO")}`;
};
const pct = (v, d = 1) => `${(Math.round(n(v) * 10 ** d) / 10 ** d).toLocaleString("es-CO")}%`;

/** Cada inversión: valor, renta neta al mes, % al año; y otros ingresos por nombre. */
export function bloqueInversionesYRentas(user) {
  let ctx = "";
  try {
    const invs = inversionesHoy(user, {});
    if (invs.length) {
      ctx += "\nCADA INVERSIÓN (valor · renta neta que llega al mes · % al año):\n";
      invs.forEach((x) => {
        ctx += `• ${x.nombre} [${x.clase}]: vale ${fmC(x.valor)}${x.moneda === "USD" ? " (en USD)" : ""} · ${x.usada > 0 ? `renta ${fmC(x.usada)}/mes (${pct(x.pctAnual)} al año)` : "sin renta: solo crece de valor"}`;
        if (x.gastos.length) ctx += ` · gastos ligados ${fmC(x.gastos.reduce((s, g) => s + g.mensual, 0))}/mes`;
        ctx += "\n";
      });
    }
    const sueltos = ingresosSueltosHoy(user, {});
    if (sueltos.length) {
      ctx += "\nOTROS INGRESOS (no ligados a una inversión; monto mensual completo):\n";
      sueltos.forEach((x) => { ctx = ctx.concat(`• ${x.nombre}: ${fmC(x.mensual)}/mes (${x.renta ? "renta pasiva" : "trabajo/activo"})${x.nota ? ` — ${x.nota}` : ""}\n`); });
    }
  } catch { /* nunca rompe el chat */ }
  return ctx;
}

/** Gastos: los ítems más grandes con su categoría (no solo el total por categoría). */
export function bloqueGastosDetalle(gas = {}, max = 25) {
  const items = [];
  Object.entries(gas || {}).forEach(([cat, xs]) => (xs || []).forEach((g) => {
    if (!g || g.sim === false) return;
    const m = montoPromedioMensual(g) * (String(g.moneda).toUpperCase() === "USD" ? 4200 : 1);
    if (m > 0.5) items.push({ cat, nombre: g.c || g.n || g.nombre || cat, m, frec: g.frecuencia || "mensual" });
  }));
  if (!items.length) return "";
  items.sort((a, b) => b.m - a.m);
  let ctx = `\nGASTOS MÁS GRANDES (promedio mensual; ${items.length} en total):\n`;
  items.slice(0, max).forEach((x) => { ctx = ctx.concat(`• ${x.nombre} (${x.cat}${x.frec !== "mensual" ? ", " + x.frec : ""}): ${fmC(x.m)}/mes\n`); });
  return ctx;
}

export function bloqueMetas(metas = []) {
  const xs = (metas || []).filter((m) => m && m.sim !== false);
  if (!xs.length) return "";
  let ctx = "\nMETAS:\n";
  xs.forEach((m) => {
    ctx += `• ${m.nombre || m.n || "Meta"}: ${fmC(m.monto ?? m.obj ?? m.objetivo)}`;
    if (m.actual != null || m.ac != null) ctx += `, llevas ${fmC(m.actual ?? m.ac)}`;
    if (m.fecha || m.fl) ctx += `, para ${m.fecha || m.fl}`;
    ctx += "\n";
  });
  return ctx;
}

export function bloqueRetiro(pen) {
  if (!pen || !Object.keys(pen).length) return "";
  return `\nPLAN DE RETIRO: edad ${pen.age ?? "?"}, retiro a los ${pen.rAge ?? "?"}, ahorrado ${fmC(pen.cur)}, aporte mensual ${fmC(pen.sv)}, rentabilidad supuesta ${pen.ret ?? "?"}%, ingreso deseado ${fmC(pen.des)}/mes\n`;
}

export function bloqueTrading(ibk = []) {
  const xs = (ibk || []).filter((p) => p && p.tk);
  if (!xs.length) return "";
  let tv = 0, tc = 0;
  const lineas = xs.map((p) => { const v = n(p.sh) * n(p.pr), c = n(p.sh) * n(p.cb); tv += v; tc += c; return { tk: p.tk, v, pl: v - c }; }).sort((a, b) => b.v - a.v);
  let ctx = `\nPORTAFOLIO DE TRADING (USD): valor ${Math.round(tv).toLocaleString("es-CO")}, P/L ${Math.round(tv - tc).toLocaleString("es-CO")} (${tc > 0 ? pct((tv / tc - 1) * 100) : "—"})\n`;
  lineas.slice(0, 15).forEach((x) => { ctx += `• ${x.tk}: ${Math.round(x.v).toLocaleString("es-CO")} (P/L ${Math.round(x.pl).toLocaleString("es-CO")})\n`; });
  return ctx;
}

/** Un escenario de Mi futuro a 10 años: decisiones y resultados. */
function lineasPlan(nombre, cfg, user, extra = {}) {
  const r = proyectarFuturo10(user, cfg);
  const f = r.filas || [], f0 = f[0] || {}, f1 = f[1] || {}, f5 = f[5] || f[f.length - 1] || {}, fin = r.final || f[f.length - 1] || {};
  const anios = Math.max(1, fin.anio || 10);
  const cagrReal = f0.patrimonio > 0 && fin.patrimonioReal > 0 ? (Math.pow(fin.patrimonioReal / f0.patrimonio, 1 / anios) - 1) * 100 : null;
  const flujoMes = (x) => fmC((x.cf || 0) / 12 / (x.deflactor || 1));
  let t = `\n▸ ${nombre}${extra.recomendado ? " (MARCADO COMO RECOMENDADO)" : ""}${extra.sinGuardar ? " (sin guardar)" : ""}\n`;
  if (extra.descripcion) t += `  Resumen del usuario: ${extra.descripcion}\n`;
  t += `  Qué hace: ${resumenEscenario(r)}\n`;
  if ((r.vendidos || []).length) t += `  Vende: ${r.vendidos.map((v) => `${v.nombre} (${fmC(v.valor)})`).join(", ")}\n`;
  const pagadas = (r.deudas || []).filter((d) => d.pagado > 0);
  if (pagadas.length) t += `  Paga deudas: ${pagadas.map((d) => `${d.nombre} ${fmC(d.pagado)}`).join(", ")}\n`;
  (r.reinversionesDetalle || []).filter((x) => x.aporte > 0 || x.rentaMensual > 0).forEach((x) => { t += `  Invierte en lo que ya tiene: ${x.nombre} +${fmC(x.aporte)} en el año ${x.anio}${x.rentaMensual > 0 ? `, renta nueva ${fmC(x.rentaMensual)}/mes` : ""}${x.rendimientoPct != null ? `, rinde ${pct(x.rendimientoPct)}` : ""}\n`; });
  (r.nuevasDetalle || []).forEach((x) => { t += `  Inversión nueva: ${x.nombre} ${fmC(x.monto)} (año ${x.anio}), rinde ${pct(x.rendPct)}${x.pagaRenta ? ", paga renta al mes" : ", se reinvierte"}${x.fuente ? `, la plata sale de ${({ venta: "lo que vende", liquidez: "sus cuentas de hoy", nuevo: "capital nuevo de afuera" })[x.fuente] || x.fuente}` : ""}\n`; });
  (r.ciclosDetalle || []).forEach((c) => { t = t.concat(`  Negocio que se repite: ${c.nombre}, pone ${fmC(c.capital)} y recibe ${fmC(c.valorFinal)} cada ${c.meses} meses (ganancia ${fmC(c.gananciaCiclo)} por ciclo${c.costosPct ? ` tras ${c.costosPct}% de costos` : ""}, después de impuesto estimado de ${c.impuestoPct}% (${fmC(c.impuestoAnual)} al año), ${fmC(c.gananciaAnual)} al año, ${pct(c.rentabilidadPct)} sobre el capital) del año ${c.desde} al ${c.hasta}; la ganancia ${c.destino === "flujo" ? "le llega al mes" : "se reinvierte"}\n`); });
  const fut = r.futuros || {};
  (fut.activos || []).forEach((x) => { const total = x.pagos.reduce((s, p) => s + p.monto, 0); t += `  Compra/construye: ${x.nombre} (${x.tipo}) por ${fmC(total)}, lista en el año ${x.entrega}${x.valorAlTerminar > 0 ? `, vale ${fmC(x.valorAlTerminar)} al terminar` : ""}, se valoriza ${pct(x.crec * 100)} al año${x.rentaMensual > 0 ? `, renta ${fmC(x.rentaMensual)}/mes` : x.vivienda ? ", es vivienda propia (no renta)" : ""}\n`; });
  (fut.ingresos || []).forEach((x) => { t = t.concat(`  Ingreso futuro: ${x.nombre} ${fmC(x.mensual)}/mes desde el año ${x.desde}${x.hasta < 99 ? ` hasta el ${x.hasta}` : ""}\n`); });
  (fut.gastos || []).forEach((x) => { t += `  Gasto futuro: ${x.nombre} ${fmC(x.anual)}/año desde el año ${x.desde}${x.hasta < 99 ? ` hasta el ${x.hasta}` : ""}\n`; });
  (r.ingSeVan || []).forEach((x) => { t = t.concat(`  Deja de recibir: ${x.nombre} ${fmC(x.mensual)}/mes desde el año ${x.desde}\n`); });
  (r.seVan || []).forEach((x) => { t = t.concat(`  Deja de pagar: ${x.nombre} ${fmC(x.mensual)}/mes desde el año ${x.desde}\n`); });
  if (r.escenario?.nombre) t += `  Supuestos de mercado: ${r.escenario.nombre} (inflación ${pct(r.escenario.inflacionPct)})\n`;
  t += `  Resultado (pesos de hoy): patrimonio neto hoy ${fmC(f0.patrimonio)} → año 5 ${fmC(f5.patrimonioReal)} → año ${anios} ${fmC(fin.patrimonioReal)} (nominal ${fmC(fin.patrimonio)})${cagrReal != null ? `, crece ${pct(cagrReal)} real al año` : ""}\n`;
  t += `  Flujo mensual que sobra (pesos de hoy): año 1 ${flujoMes(f1)}, año 5 ${flujoMes(f5)}, año ${anios} ${flujoMes(fin)}\n`;
  t += `  Año 1: entra ${fmC((f1.ingresos || 0) / 12)}/mes, sale ${fmC((f1.gastos || 0) / 12)}/mes, el patrimonio produce ${fmC(((f1.rentas || 0) + (f1.crece || 0)) / 12)}/mes (renta que llega ${fmC((f1.rentas || 0) / 12)} + lo que crece invertido ${fmC((f1.crece || 0) / 12)})\n`;
  const negativos = f.slice(1).filter((x) => (x.cf || 0) < 0).map((x) => x.anio);
  if (negativos.length) t += `  Años con flujo negativo: ${negativos.join(", ")}\n`;
  if (r.liqAgotadaAnio) t += `  La liquidez se agota en el año ${r.liqAgotadaAnio}\n`;
  if (r.bolsaDetalle?.faltante > 0) t += `  Faltan ${fmC(r.bolsaDetalle.faltante)} para lo que quiere invertir\n`;
  (r.alertas || []).slice(0, 6).forEach((a) => { if (a.texto) t += `  Aviso: ${a.texto}\n`; });
  return t;
}

/** Todos los planes de Mi futuro a 10 años: hoy, el borrador y los guardados. */
export function bloquePlanes(user, futuro10 = {}) {
  const escenarios = (futuro10 && futuro10.escenarios) || [];
  const borrador = futuro10 && futuro10.borrador;
  if (!escenarios.length && !borrador) return "";
  let ctx = "\nMI FUTURO A 10 AÑOS (planes que armó el usuario en la plataforma; proyección sin impuestos):\n";
  try {
    ctx += lineasPlan("Punto de partida: si nada cambia", { ...CONFIG_INICIAL }, user);
    escenarios.forEach((e) => { ctx += lineasPlan(`Plan «${e.nombre}»`, migrarModifica({ ...CONFIG_INICIAL, ...(e.config || {}) }), user, { recomendado: e.recomendado, descripcion: e.descripcion }); });
    if (borrador) {
      const cfgB = migrarModifica({ ...CONFIG_INICIAL, ...borrador });
      const igual = escenarios.some((e) => JSON.stringify(migrarModifica({ ...CONFIG_INICIAL, ...(e.config || {}) })) === JSON.stringify(cfgB));
      const vacio = JSON.stringify({ ...cfgB, escenario: "base" }) === JSON.stringify(CONFIG_INICIAL);
      if (!igual && !vacio) ctx += lineasPlan("Plan que está armando", cfgB, user, { sinGuardar: true });
    }
  } catch (e) { ctx += `(no se pudieron calcular los planes: ${e?.message || e})\n`; }
  return ctx;
}

/** Todo lo adicional al resumen base del asesor. */
export function contextoCompleto(user = {}) {
  return bloqueInversionesYRentas(user) + bloqueGastosDetalle(user.gas) + bloqueMetas(user.metas) + bloqueRetiro(user.pen) + bloqueTrading(user.ibk) + bloquePlanes(user, user.futuro10) + bloqueOtros(user);
}

// 24-oct-2026 (Santiago: "la IA debe poder opinar de todo lo que hay armado o
// ejecutado en la plataforma por el respectivo usuario"). Titulares/entidades,
// Tu Norte, simulaciones guardadas e impuesto estimado.
export function bloqueOtros(user = {}) {
  let ctx = "";
  try {
    const owners = (user.owners || []).filter(Boolean);
    if (owners.length > 1 || (owners[0] && owners[0].name !== "Personal")) {
      ctx += "\nTITULARES / ENTIDADES:\n";
      owners.forEach((o) => {
        const suyos = (user.inv || []).filter((a) => a && a.sim !== false && (a.owner === o.id || a.ownerId === o.id || a.titular === o.id));
        ctx += `• ${o.name} (${o.type === "juridica" ? "persona jurídica" : "persona natural"})${suyos.length ? `: ${suyos.map((a) => a.n || a.nombre).join(", ")}` : ""}\n`;
      });
    }
    if (user.norte && typeof user.norte === "object") {
      const s = JSON.stringify(user.norte);
      ctx += `\nTU NORTE (objetivo y mezcla de canastas que eligió): ${s.length > 600 ? s.slice(0, 600) + "…" : s}\n`;
    }
    const sims = (user.escenariosSim || []).filter(Boolean);
    if (sims.length) {
      ctx += "\nSIMULACIONES GUARDADAS (Simulador):\n";
      sims.slice(0, 8).forEach((e) => { const s = JSON.stringify(e.config || e.cambios || e.params || e); ctx += `• ${e.nombre || e.name || "Simulación"}: ${s.length > 400 ? s.slice(0, 400) + "…" : s}\n`; });
    }
    const imp = user.impuesto;
    if (imp && n(imp.total) > 0) {
      ctx += `\nIMPUESTO DE RENTA ESTIMADO (Colombia): ${fmC(imp.total)} al año (${fmC(imp.mes)}/mes)\n`;
      (imp.detalle || []).slice(0, 6).forEach((d) => { if (n(d.impuesto) > 0 || n(d.ingreso) > 0) ctx += `• ${d.name || d.nombre || "Titular"}: ingreso ${fmC(d.ingreso)}, impuesto ${fmC(d.impuesto)}${d.regimen ? `, régimen ${d.regimen}` : ""}\n`; });
    }
  } catch { /* nunca rompe el chat */ }
  return ctx;
}
