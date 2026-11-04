// ═══════════════════════════════════════════════════════════════════════════
// infografia.js — datos y geometría de las infografías del Dashboard.
//
// 1-nov-2026 (Santiago: "darle una categoría super profesional con
// infografías bien profesionales a los tableros"). Funciones puras: reciben
// la salida de calcularBase (metrics.js) — el MISMO motor y la MISMA base que
// el resto del Dashboard — y devuelven números y coordenadas listos para
// dibujar. Ninguna lee `.m` / `.mensual` crudo.
// ═══════════════════════════════════════════════════════════════════════════

import { tipoActivo, calcularMetricas } from "./metrics.js";
import { tasaMensualEq } from "./flowHelpers.js";
import { tx } from "./region.js";

// 3-nov-2026: nombres de categorías de gasto de la app (se guardan en español)
// para mostrarlos en inglés cuando la sesión está en inglés. Lo que el usuario
// escribió a mano queda como lo escribió.
const CAT_EN = { Vivienda: "Housing", Servicios: "Utilities", Mantenimiento: "Maintenance", Transporte: "Transportation", "Alimentación": "Food", "Educación": "Education", Salud: "Health", Seguros: "Insurance", Entretenimiento: "Entertainment", Personal: "Personal", Vestimenta: "Clothing", Mascotas: "Pets", Deporte: "Fitness", Ahorro: "Savings", "Representación": "Business meals", "Nómina": "Payroll", Honorarios: "Professional fees", Impuestos: "Taxes", Otros: "Other", Hogar: "Home", Viajes: "Travel", Suscripciones: "Subscriptions", "Tecnología": "Technology", Donaciones: "Donations", "Créditos": "Loans" };
export const nombreCategoria = (cat) => tx(cat, CAT_EN[cat] || cat);

// Niveles de libertad (metrics.js NIVELES) en el idioma de la sesión.
const NIVEL_EN = {
  deficit: { nombre: "Deficit", desc: "You spend more than you make" },
  estabilidad: { nombre: "Stability", desc: "You cover your costs, but by working" },
  seguridad: { nombre: "Security", desc: "Your assets pay for the essentials" },
  independencia: { nombre: "Independence", desc: "Your assets pay for your whole lifestyle" },
  abundancia: { nombre: "Abundance", desc: "They pay for it twice" },
};
export const nombreNivel = (lv) => (lv ? tx(lv.nombre, NIVEL_EN[lv.clave]?.nombre) : "");
export const descNivel = (lv) => (lv ? tx(lv.desc, NIVEL_EN[lv.clave]?.desc) : "");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// Etiquetas del Sankey: caben ~24 caracteres a cada lado.
export const corto = (s, max = 24) => { const t = String(s || "").trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t; };

// ─── Flujo del dinero (Sankey) ─────────────────────────────────────────────
// Entradas brutas por grupo → tu mes → salidas por destino. Por construcción:
//   Σ entradas − Σ salidas = met.fl  (lo que sobra, o lo que falta)
// Salidas: retención + impuesto neto (+ la categoría "Impuestos" si existe),
// cada categoría de gasto, cuotas de deudas.
export function flujoDinero(met, { maxDestinos = 5 } = {}) {
  if (!met) return null;
  const g = met.ingresosPorGrupo || {};
  const entradas = [
    { key: "inmuebles", nombre: tx("Rentas de inmuebles", "Rental income"), valor: num(g.inmuebles), tono: "pos" },
    { key: "financieros", nombre: tx("Fondos y dividendos", "Funds & dividends"), valor: num(g.financieros), tono: "pos" },
    { key: "trabajo", nombre: tx("Trabajo", "Work"), valor: num(g.trabajo), tono: "neutro" },
  ].filter((e) => e.valor > 0.5);

  const cats = { ...(met.gastosPorCategoria || {}) };
  const impuestos = num(met.retencionMensual) + num(met.impuestoNeto) + num(cats.Impuestos);
  delete cats.Impuestos;
  const gastos = Object.entries(cats)
    .map(([cat, v]) => ({ key: "cat:" + cat, nombre: corto(nombreCategoria(cat)), valor: num(v), tono: "neutro" }))
    .filter((d) => d.valor > 0.5)
    .sort((a, b) => b.valor - a.valor);
  const principales = gastos.slice(0, maxDestinos);
  const resto = gastos.slice(maxDestinos);
  const salidas = [...principales];
  if (resto.length) {
    salidas.push({
      key: "otros", nombre: resto.length === 1 ? resto[0].nombre : tx(`Otros ${resto.length} gastos`, `${resto.length} other expenses`),
      valor: resto.reduce((s, d) => s + d.valor, 0), tono: "neutro",
    });
  }
  if (num(met.sd) > 0.5) salidas.push({ key: "cuotas", nombre: tx("Cuotas de deudas", "Debt payments"), valor: num(met.sd), tono: "neg" });
  if (impuestos > 0.5) salidas.push({ key: "impuestos", nombre: tx("Impuestos", "Taxes"), valor: impuestos, tono: "neutro" });

  const totalEntra = entradas.reduce((s, e) => s + e.valor, 0);
  const totalSale = salidas.reduce((s, d) => s + d.valor, 0);
  const saldo = totalEntra - totalSale; // = met.fl
  if (saldo > 0.5) salidas.push({ key: "sobra", nombre: tx("Te sobra", "Left over"), valor: saldo, tono: "pos", destacado: true });
  else if (saldo < -0.5) entradas.push({ key: "falta", nombre: tx("Te falta", "Shortfall"), valor: -saldo, tono: "neg", destacado: true });

  return { entradas, salidas, totalEntra, totalSale, saldo, total: Math.max(totalEntra, totalSale) };
}

// Geometría del Sankey en un viewBox fijo. Bandas como áreas cerradas con
// curvas Bézier: más legibles que un trazo grueso cuando los extremos tienen
// alturas distintas.
export function geometriaSankey(flujo, { ancho = 760, alto = 380, arriba = 24, abajo = 16, gapE = 22, gapS = 12, xE = 168, xM0 = 340, xM1 = 366, xS = 560, nodo = 8 } = {}) {
  if (!flujo || !(flujo.total > 0)) return null;
  const H = alto - arriba - abajo;
  const pila = (lista, gap) => {
    const k = (H - gap * Math.max(0, lista.length - 1)) / flujo.total;
    let y = arriba;
    return lista.map((it) => { const h = Math.max(1.5, it.valor * k); const r = { ...it, y, h }; y += h + gap; return r; });
  };
  // El nodo central mide el total; cada lado entra/sale sin huecos.
  const km = H / flujo.total;
  const curva = (x0, y0a, y0b, x1, y1a, y1b) => {
    const xm = (x0 + x1) / 2;
    return `M${x0},${y0a.toFixed(1)} C${xm},${y0a.toFixed(1)} ${xm},${y1a.toFixed(1)} ${x1},${y1a.toFixed(1)} L${x1},${y1b.toFixed(1)} C${xm},${y1b.toFixed(1)} ${xm},${y0b.toFixed(1)} ${x0},${y0b.toFixed(1)} Z`;
  };
  let ym = arriba;
  const entradas = pila(flujo.entradas, gapE).map((e) => {
    const hm = e.valor * km; const d = curva(xE + nodo, e.y, e.y + e.h, xM0, ym, ym + hm); ym += hm; return { ...e, d };
  });
  ym = arriba;
  const salidas = pila(flujo.salidas, gapS).map((s) => {
    const hm = s.valor * km; const d = curva(xM1, ym, ym + hm, xS, s.y, s.y + s.h); ym += hm; return { ...s, d };
  });
  return { ancho, alto, arriba, H, xE, xM0, xM1, xS, nodo, entradas, salidas };
}

// ─── Mapa del patrimonio (treemap) ─────────────────────────────────────────
const CLASES = [
  { key: "inmuebles", nombre: "Inmuebles", en: "Real estate", tipos: ["Real Estate", "Local Comercial", "Bodega", "Lote"] },
  { key: "fondos", nombre: "Fondos y renta fija", en: "Funds & fixed income", tipos: ["Fondo de Inversión", "CDT", "Renta Fija"] },
  { key: "acciones", nombre: "Acciones y cripto", en: "Stocks & crypto", tipos: ["Acciones", "ETF", "Crypto"] },
  { key: "efectivo", nombre: "Efectivo", en: "Cash", tipos: ["Cash"] },
  { key: "vehiculos", nombre: "Vehículos", en: "Vehicles", tipos: ["Vehículo"] },
];

/**
 * Patrimonio por clase. Renta anual de cada activo: sus ingresos vinculados
 * (met.rentaPorActivo, bruto) o, si no hay, la tasa escrita en el activo.
 * `estado`: "renta" (con renta conocida), "sin_renta", "pierde" (vale menos de
 * lo que costó y no renta).
 */
export function mapaPatrimonio(met) {
  if (!met || !Array.isArray(met.inv)) return null;
  const trm = num(met.trm) || 4200;
  const valor = (i) => num(i.va) * (i.moneda === "USD" ? trm : 1);
  const costo = (i) => num(i.vc) * (i.moneda === "USD" ? trm : 1);
  const renta = met.rentaPorActivo || {};
  // Ingresos pasivos sin activoId pero con `fuente` igual al nombre del activo
  // (así viene buena parte de los datos: la renta se carga en Ingresos sin ligar).
  const clave = (s) => String(s || "").trim().toLowerCase();
  const rentaPorNombre = {};
  (met.detallePasivo || []).forEach((d) => {
    if (d.activoId || !d.fuente) return;
    rentaPorNombre[clave(d.fuente)] = (rentaPorNombre[clave(d.fuente)] || 0) + num(d.mensual);
  });
  const rentaMensual = (i) => (num(renta[i.id]) > 0 ? num(renta[i.id]) : num(rentaPorNombre[clave(i.n || i.nombre)]));
  const grupos = {};
  met.inv.forEach((i) => {
    const va = valor(i);
    if (!(va > 0)) return;
    const tp = tipoActivo(i);
    const clase = CLASES.find((c) => c.tipos.includes(tp)) || { key: "otros", nombre: "Otros", en: "Other" };
    const g = grupos[clase.key] || (grupos[clase.key] = { key: clase.key, nombre: tx(clase.nombre, clase.en), valor: 0, costo: 0, rentaAnual: 0, n: 0 });
    g.valor += va; g.costo += costo(i); g.n += 1;
    g.rentaAnual += rentaMensual(i) > 0 ? rentaMensual(i) * 12 : va * (num(i.tasa) / 100);
  });
  const total = Object.values(grupos).reduce((s, g) => s + g.valor, 0);
  if (!(total > 0)) return null;
  const clases = Object.values(grupos)
    .map((g) => ({
      ...g,
      pct: (g.valor / total) * 100,
      rentaPct: g.valor > 0 ? (g.rentaAnual / g.valor) * 100 : 0,
      estado: g.rentaAnual > 0 ? "renta" : g.costo > g.valor * 1.02 && g.key === "vehiculos" ? "pierde" : "sin_renta",
    }))
    .sort((a, b) => b.valor - a.valor);
  return { total, clases };
}

// Treemap "squarified" (Bruls et al.): rectángulos lo más cuadrados posible.
export function squarify(items, { x = 0, y = 0, w = 760, h = 300, gap = 4 } = {}) {
  const total = items.reduce((s, it) => s + it.valor, 0);
  if (!(total > 0)) return [];
  const area = w * h;
  const nodos = items.map((it) => ({ it, a: (it.valor / total) * area }));
  const out = [];
  let rx = x, ry = y, rw = w, rh = h;
  const peor = (fila, lado) => {
    const s = fila.reduce((t, n) => t + n.a, 0);
    const max = Math.max(...fila.map((n) => n.a)), min = Math.min(...fila.map((n) => n.a));
    return Math.max((lado * lado * max) / (s * s), (s * s) / (lado * lado * min));
  };
  const colocar = (fila) => {
    const s = fila.reduce((t, n) => t + n.a, 0);
    if (rw >= rh) {
      const cw = s / rh; let cy = ry;
      fila.forEach((n) => { const ch = n.a / cw; out.push({ ...n.it, x: rx, y: cy, w: cw, h: ch }); cy += ch; });
      rx += cw; rw -= cw;
    } else {
      const ch = s / rw; let cx = rx;
      fila.forEach((n) => { const cw = n.a / ch; out.push({ ...n.it, x: cx, y: ry, w: cw, h: ch }); cx += cw; });
      ry += ch; rh -= ch;
    }
  };
  let fila = [];
  nodos.forEach((n) => {
    const lado = Math.min(rw, rh);
    if (!fila.length || peor([...fila, n], lado) <= peor(fila, lado)) fila.push(n);
    else { colocar(fila); fila = [n]; }
  });
  if (fila.length) colocar(fila);
  const g2 = gap / 2;
  return out.map((r) => ({ ...r, x: r.x + g2, y: r.y + g2, w: Math.max(0, r.w - gap), h: Math.max(0, r.h - gap) }));
}

// ─── Medidor de libertad ───────────────────────────────────────────────────
// Escala del arco: hasta 200 % (la meta de Abundancia, NIVELES[4].factor = 2
// desde el 24-oct-2026), y se estira si la cobertura la pasa.
export function escalaMedidor(cobertura) {
  const c = num(cobertura);
  return Math.min(400, Math.max(200, Math.ceil((c + 15) / 50) * 50));
}

export function puntoArco(pct, max, { cx = 160, cy = 160, r = 128 } = {}) {
  const p = Math.max(0, Math.min(max, num(pct)));
  const a = Math.PI * (1 - p / max);
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

// ─── Rentas mes a mes ──────────────────────────────────────────────────────
// Para cada mes del año: rentas (ingreso pasivo neto) y gastos y cuotas, con
// la misma base «mes» que usa el nivel. `args` = los mismos de cT/calcularMetricas.
export function rentasPorMes(args, anio) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = calcularMetricas(args, { base: "mes", anio, mes: i + 1 });
    return { mes: i + 1, ip: num(m.ip), ob: num(m.ob), cobertura: num(m.coberturaPasiva) };
  });
}

// ─── Camino a cero deudas ──────────────────────────────────────────────────
// Por deuda viva (sim !== false, saldo y cuota > 0): meses hasta saldarla
// pagando la cuota de hoy (misma fórmula que mesesLibreDeuda) y la cuota que
// devuelve al terminar, en pesos. Ordenado por fecha de salida.
export function planDeudas(deudas, { trm = 4200, hoy = new Date() } = {}) {
  const filas = [];
  let noAmortizan = 0;
  (deudas || []).forEach((d) => {
    if (!d || d.sim === false) return;
    const B = num(d.mt), P = num(d.pg ?? d.pago);
    if (B <= 0 || P <= 0) return;
    const r = tasaMensualEq(d.ts);
    let n;
    if (r <= 0) n = B / P;
    else if (P <= B * r) { noAmortizan++; return; }
    else n = -Math.log(1 - (r * B) / P) / Math.log(1 + r);
    const meses = Math.ceil(n);
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + meses, 1);
    const fx = d.moneda === "USD" ? trm : 1;
    filas.push({ nombre: d.n || d.nombre || tx("Deuda", "Debt"), meses, fecha, cuota: P * fx, saldo: B * fx, tasa: num(d.ts) });
  });
  filas.sort((a, b) => a.meses - b.meses);
  const meses = filas.length ? filas[filas.length - 1].meses : 0;
  return { filas, meses, fecha: filas.length ? filas[filas.length - 1].fecha : null, cuotaTotal: filas.reduce((s, f) => s + f.cuota, 0), noAmortizan };
}
