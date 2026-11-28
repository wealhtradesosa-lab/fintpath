// Impuesto de renta estimado para cada año de la tabla de 10 años.
//
// 28-nov-2026 (Santiago: "¿y cómo se estima algo de impuestos?… ¿cómo lo hacemos lo más completo posible, que por lo menos sea más
// adecuado a la realidad? Porque no estimar impuestos daría unos valores muy poco precisos").
//
// No es una fórmula nueva: usa el MISMO motor tributario de la plataforma (estimarImpuesto, por titular) y lo corre una vez por año
// con los ingresos que la tabla proyecta para ese año.
//
//  1. Cada año se arma «el usuario de ese año» en plata de hoy: sus ingresos de hoy, cada uno con lo que la tabla dice que entra ese año
//     (sueldos, rentas de cada inversión, lo que deja de llegar porque vendió, lo nuevo que creó). Las tablas del impuesto se mueven con
//     la inflación (UVT), así que calcular en plata de hoy y luego llevar el resultado a pesos de ese año equivale a indexarlas.
//  2. Se calibra con su declaración real: si hoy la plataforma ajusta el motor a lo que de verdad pagó (impuesto «referente»), ese mismo
//     factor por titular se aplica a todos los años.
//  3. Cuándo se paga: la retención sale el mismo año; el saldo de la declaración de un año se paga al año siguiente.
//
// Entrega 1: renta ordinaria.
// Entrega 2 (28-nov-2026): impuesto por lo que se vende en la tabla (ganancia ocasional). Ganancia = precio de venta de la tabla menos
// «¿Cuánto te costó?» de Patrimonio; tarifa de la norma (TARIFA_GO). Supone dos años o más de tenencia. No aplica el ajuste del costo
// por inflación (Art. 73) ni beneficios como el de vivienda, porque Patrimonio no guarda el año de compra: con ellos puede ser menos.
// Si a un activo le falta el costo, NO se inventa: se marca «falta el costo» y esa venta queda sin calcular. La persona puede escribir
// el valor que le dé su contador (cfg.impuestoVenta: { activoId: pesos del año de la venta }). Se paga al año siguiente, con la declaración.
// Entrega 3 (28-nov-2026): impuestos en otro país. No se calculan: los escribe la persona con su contador, por cada inversión en otra
// moneda. cfg.impExterior = { anual: { activoId: pesos de hoy al año, mientras la tenga }, venta: { activoId: pesos del año de la venta } }.
// Lo de cada año y lo de cada venta se paga ese mismo año. Para no cobrar dos veces, se descuenta del impuesto de Colombia: en una
// venta, hasta lo que Colombia cobra por esa misma venta; en lo de cada año, hasta la parte del impuesto de Colombia que corresponde
// a los ingresos en otra moneda (en proporción). Es una aproximación del descuento por impuestos pagados en el exterior.
import { montoPromedioMensual } from "./flowHelpers.js";
import { claveIngreso } from "./futuro10.js";
import { esLiquido } from "./metrics.js";
import { TARIFA_GO } from "./normaGananciaOcasional.js";

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const bruto = (d) => n(d && (d.impBruto != null ? d.impBruto : d.impuesto));

/** Deja un ingreso con un valor fijo al año (en pesos, plata de hoy), sin vigencias ni frecuencias que lo cambien. */
export function ingresoConValor(item, anual) {
  const limpio = { ...item, mensual: anual / 12, m: undefined, monto: undefined, frecuencia: "mensual", freq: "mes", tipo: "fijo", moneda: "COP",
    montosMensuales: undefined, desdeMes: 1, hastaMes: 12, vigenciaModo: undefined, finAnio: undefined, inicioAnio: undefined, mesPago: undefined, pagado: undefined, pagos: undefined, prepago: undefined, sim: true };
  if (Math.abs(montoPromedioMensual(limpio) * 12 - anual) <= Math.max(1, Math.abs(anual) * 1e-6)) return limpio;
  return { id: item.id, nombre: item.nombre, categoria: item.categoria, owner: item.owner, fiscalCode: item.fiscalCode, activoId: item.activoId, mensual: anual / 12, frecuencia: "mensual", tipo: "fijo", moneda: "COP", sim: true };
}

/**
 * El mismo ingreso de hoy, multiplicado por un factor. Conserva su moneda, su frecuencia y su vigencia, para que el motor tributario lo
 * trate igual que hoy (por ejemplo, lo que hoy no entra a la base sigue sin entrar). Con factor 1 es el ingreso de hoy, intacto.
 */
export function ingresoPorFactor(item, k) {
  if (Math.abs(k - 1) < 1e-9) return item;
  const esc = { ...item, mensual: n(item.mensual) * k };
  if (Array.isArray(item.montosMensuales)) esc.montosMensuales = item.montosMensuales.map((v) => n(v) * k);
  const a = montoPromedioMensual(item), b = montoPromedioMensual(esc);
  if (a > 0.5 && Math.abs(b / a - k) <= Math.max(1e-6, Math.abs(k) * 1e-6)) return esc;
  return ingresoConValor(item, a * 12 * k);
}

const CAT_NUEVA = (clase) => (/finca|raiz|raíz|real|inmueble|bodega|local|lote|ciclo/i.test(String(clase || "")) ? "Arriendo" : /accion|etf|stock|crec/i.test(String(clase || "")) ? "Dividendos" : "Intereses bancarios");

/**
 * Ingresos del año t para el motor tributario, en plata de hoy.
 * @param {object} user  datos de hoy
 * @param {object} r     proyección del escenario (proyectarFuturo10)
 * @param {object} r0    proyección de hoy sin cambios (para saber cuánto renta hoy cada inversión)
 * @param {number} t     año del plan (1 = año en curso)
 */
export function ingresosDelAnio(user, r, r0, t, cfg = {}) {
  const f = (r.filas || [])[t] || {}, f0 = ((r0 && r0.filas) || [])[1] || {};
  const ix = Math.pow(1 + n(r.indexacion), Math.max(0, t - 1));
  const hoy = (v) => v / ix;
  const mapa = (ff) => ({ lab: new Map((ff.ingresosLab || []).map((x) => [x.key, n(x.anual)])), sueltas: new Map((ff.rentasSueltas || []).map((x) => [x.id, n(x.renta)])), act: new Map((ff.porActivo || []).map((x) => [x.id, x])) });
  const { lab, sueltas, act } = mapa(f), base = mapa(f0);
  const lista = user.ingresos || [], out = [], usados = new Set();
  lista.forEach((it, k) => {
    if (!it || it.sim === false) return;
    const key = claveIngreso(lista, k);
    // Cuánto es ese ingreso en el año t frente a hoy, según la tabla (las dos cifras en plata de hoy).
    let factor = 0;
    if (lab.has(key)) factor = base.lab.get(key) > 0.5 ? hoy(lab.get(key)) / base.lab.get(key) : 1;
    else if (sueltas.has("ing_" + key)) factor = base.sueltas.get("ing_" + key) > 0.5 ? hoy(sueltas.get("ing_" + key)) / base.sueltas.get("ing_" + key) : 1;
    else if (it.activoId && act.has(it.activoId)) {
      // Ingreso de una inversión: se mueve igual que lo que esa inversión paga en la tabla ese año frente a lo que paga hoy.
      const a = act.get(it.activoId), a0 = base.act.get(it.activoId), rT = hoy(n(a.renta)), r0v = n(a0 && a0.renta);
      factor = r0v > 0.5 ? rT / r0v : rT > 0.5 ? 1 : 0;
      usados.add(it.activoId);
    }
    if (factor > 1e-9) out.push(ingresoPorFactor(it, factor));
  });
  const owner0 = ((user.owners || [])[0] || {}).id;
  // Lo que viene (ingresos futuros cargados en el escenario)
  ((cfg.futuros && cfg.futuros.ingresos) || []).forEach((x, k) => { const v = sueltas.get("fut_" + k); if (v > 0.5) out.push({ id: "fut_" + k, nombre: x.nombre || "Ingreso futuro", categoria: x.categoria || "Otros", owner: x.owner || owner0, mensual: hoy(v) / 12, frecuencia: "mensual", tipo: "fijo", moneda: "COP", sim: true }); });
  // Rentas que no vienen de un ingreso cargado hoy: inversiones creadas en la tabla, o una inversión de hoy a la que se le puso renta en la tabla.
  (f.porActivo || []).forEach((a) => {
    if (!(n(a.renta) > 0.5) || usados.has(a.id) || String(a.id).startsWith("c_")) return;
    if (lista.some((it) => it && it.sim !== false && it.activoId === a.id)) return;
    const base = (user.inv || []).find((q) => q && q.id === a.id);
    out.push({ id: "renta_" + a.id, nombre: a.nombre, categoria: CAT_NUEVA(a.clase || (base && (base.tp || base.tipo))), owner: (base && base.owner) || owner0, activoId: base ? a.id : undefined, mensual: hoy(n(a.renta)) / 12, frecuencia: "mensual", tipo: "fijo", moneda: "COP", sim: true, _nueva: !base });
  });
  return out;
}

/** Una inversión en otra moneda: para la tabla, está en otro país. */
export const esDeAfuera = (a) => !!a && !!a.moneda && a.moneda !== "COP";

/** Lo que se vende completo en el año t, con el impuesto estimado de cada venta (pesos de ese año). */
export function ventasDelAnio(user, r, t, cfg = {}) {
  const lista = t === 1 ? (r.vendidos || []).map((v) => ({ id: v.id, nombre: v.nombre, venta: n(v.valor) })) : (r.liberados || []).filter((l) => l && l.anio === t && !String(l.id).endsWith("_retiro")).map((l) => ({ id: l.id, nombre: l.nombre, venta: n(l.monto) + n(l.pagoDeuda) }));
  const manual = cfg.impuestoVenta || {};
  return lista.filter((v) => v.venta > 0.5).map((v) => {
    const a = (user.inv || []).find((q) => q && q.id === v.id);
    if (!a) return null; // lo creado en la tabla no entra en esta entrega
    const m = manual[v.id];
    if (m != null && m !== "" && Number.isFinite(Number(m))) return { ...v, manual: true, impuesto: Math.max(0, Number(m)) };
    if (esLiquido(a)) return { ...v, sinGanancia: true, impuesto: 0 };
    const costo = n(a.vc ?? a.valor_compra ?? a.costo) * (a.moneda === "USD" ? n(user.trm) || 1 : 1);
    if (!(costo > 0.5)) return { ...v, falta: true, impuesto: 0 };
    const ganancia = Math.max(0, v.venta - costo);
    return { ...v, costo, ganancia, impuesto: ganancia * TARIFA_GO, tarifaPct: TARIFA_GO * 100 };
  }).filter(Boolean).map((v) => {
    // Impuesto en el otro país por esta venta (lo escribe la persona): se paga ese año y se descuenta del de Colombia por la misma venta.
    const a = (user.inv || []).find((q) => q && q.id === v.id), fuera = esDeAfuera(a);
    const ext = fuera ? Math.max(0, n(((cfg.impExterior || {}).venta || {})[v.id])) : 0, credito = v.manual ? 0 : Math.min(ext, v.impuesto);
    return { ...v, fuera, exterior: ext, credito, impuestoAntes: v.impuesto, impuesto: v.impuesto - credito };
  });
}

/**
 * @param {object} user
 * @param {object} r   proyección del escenario SIN impuestos
 * @param {object} r0  proyección de hoy sin cambios
 * @param {object} o   { estimar: (u) => estimarImpuesto(u), estHoy: estimación de hoy ya calibrada (la que usa el Dashboard), cfg }
 * @returns {{ porAnio: {t: pesos de ese año}, detalle: [{ t, anio, impuesto, retencion, saldo, pagaRetencion, pagaSaldo, paga, titulares }], calibrado: boolean }}
 */
export function impuestosPorAnio(user, r, r0, { estimar, estHoy = null, cfg = {} } = {}) {
  const N = Math.max(1, ((r && r.filas) || []).length - 1), vacio = { porAnio: {}, detalle: [], calibrado: false };
  if (typeof estimar !== "function" || !user) return vacio;
  let motorHoy; try { motorHoy = estimar(user); } catch { return vacio; }
  // Calibración por titular: lo que la plataforma dice que paga hoy (con su declaración real) ÷ lo que da el motor solo.
  const fImp = {}, fRet = {}; let calibrado = false;
  ((estHoy && estHoy.detalle) || []).forEach((d) => { const m = ((motorHoy && motorHoy.detalle) || []).find((q) => q.name === d.name); if (!m) return;
    if (bruto(m) > 0.5) { fImp[d.name] = bruto(d) / bruto(m); if (Math.abs(fImp[d.name] - 1) > 1e-6) calibrado = true; }
    if (n(m.reteN) > 0.5) fRet[d.name] = n(d.reteN) / n(m.reteN); });
  const anioDe = (t) => new Date().getFullYear() + t - 1;
  const ref = estHoy || motorHoy;
  let saldoAnterior = ((ref && ref.detalle) || []).reduce((s, d) => s + Math.max(0, bruto(d) - n(d.reteN)), 0); // el saldo que se paga este año (plata de hoy)
  const detalle = [], porAnio = {};
  for (let t = 1; t <= N; t++) {
    const ix = Math.pow(1 + n(r.indexacion), Math.max(0, t - 1));
    let est; try { est = estimar({ ...user, ingresos: ingresosDelAnio(user, r, r0, t, cfg) }); } catch { est = null; }
    const titulares = ((est && est.detalle) || []).map((d) => { const imp = bruto(d) * (fImp[d.name] != null ? fImp[d.name] : 1), ret = n(d.reteN) * (fRet[d.name] != null ? fRet[d.name] : 1);
      return { nombre: d.name, tipo: d.type, ingreso: n(d.ingreso) * ix, impuesto: imp * ix, retencion: ret * ix, saldo: Math.max(0, imp - ret) * ix }; });
    const impuesto = titulares.reduce((s, q) => s + q.impuesto, 0), retencion = titulares.reduce((s, q) => s + q.retencion, 0), saldo = titulares.reduce((s, q) => s + q.saldo, 0);
    // El saldo del año anterior se paga este año, con el valor que tuvo (pesos de ese año anterior).
    // Lo que se vende ese año: su impuesto va en la declaración de ese año, que se paga al siguiente.
    const ventas = ventasDelAnio(user, r, t, cfg), impuestoVentas = ventas.reduce((s, v) => s + v.impuesto, 0), exteriorVentas = ventas.reduce((s, v) => s + n(v.exterior), 0);
    // Impuestos en otro país, cada año, por las inversiones en otra moneda que todavía tiene ese año.
    const vivos = new Map((((r.filas || [])[t] || {}).porActivo || []).map((x) => [x.id, x])), anualCfg = (cfg.impExterior || {}).anual || {};
    const exterior = (user.inv || []).filter((a) => esDeAfuera(a) && a.sim !== false && vivos.has(a.id) && n(vivos.get(a.id).valor) > 0.5).map((a) => ({ id: a.id, nombre: a.n || a.nombre || "", monto: Math.max(0, n(anualCfg[a.id])) * ix }));
    const exteriorAnual = exterior.reduce((s, x) => s + x.monto, 0);
    // Descuento en Colombia: hasta la parte del impuesto de Colombia que corresponde a los ingresos en otra moneda.
    const its = ingresosDelAnio(user, r, r0, t, cfg), tot = its.reduce((s, x) => s + montoPromedioMensual(x) * (x.moneda && x.moneda !== "COP" ? n(user.trm) || 1 : 1), 0), deAfuera = its.filter((x) => x.moneda && x.moneda !== "COP").reduce((s, x) => s + montoPromedioMensual(x) * (n(user.trm) || 1), 0);
    const credito = Math.min(exteriorAnual, saldo, tot > 0.5 ? impuesto * (deAfuera / tot) : 0), saldoNeto = saldo - credito;
    const pagaSaldo = saldoAnterior, paga = retencion + pagaSaldo + exteriorAnual + exteriorVentas;
    detalle.push({ t, anio: anioDe(t), impuesto, retencion, saldo: saldoNeto, saldoAntes: saldo, pagaRetencion: retencion, pagaSaldo, paga, titulares, ventas, impuestoVentas, exterior, exteriorAnual, exteriorVentas, credito, paraElSiguiente: saldoNeto + impuestoVentas });
    porAnio[t] = paga;
    saldoAnterior = saldoNeto + impuestoVentas;
  }
  return { porAnio, detalle, calibrado };
}
