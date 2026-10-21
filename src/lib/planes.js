/**
 * planes.js — Motor de caminos a 10 años (21-oct-2026).
 *
 * De dónde viene: el "Plan Patrimonial SALEM" que Santiago armó como artefacto
 * y que quiere dentro de FINPATHIA sin llenarla de secciones. El método es el
 * valor: HOY → lo que cambia → CAMINOS → lado a lado → reglas. Este archivo es
 * solo el motor: puro, sin React, sin storage. Recibe un punto de partida,
 * movimientos y reglas; devuelve 120 meses y los mismos 8 puntos para cada
 * camino, para que se puedan comparar.
 *
 * VOCABULARIO (todo en COP, montos mensuales salvo capital y saldos):
 *
 *   posición   capital con un papel ("bolsillo"):
 *     sustento     paga la vida: su rendimiento se RECIBE cada mes (pagaPct 100)
 *     crecimiento  multiplica: su rendimiento se REINVIERTE (pagaPct 0)
 *     uso          la casa donde vives, el carro: no produce, valoriza (o pierde)
 *     caja         efectivo disponible
 *     {id, nombre, bolsillo, capital, tasa (% anual sobre capital), pagaPct (0-100),
 *      valorizacion (% anual sobre el valor, no se recibe), desdeMes}
 *
 *   flujo      plata que entra o sale sin ser rendimiento de un capital:
 *     honorarios, salario, pensión, arriendo de un inmueble, gastos de vida,
 *     seguridad social. {id, nombre, tipo:'ingreso'|'gasto', monto, desdeMes, hastaMes, indexa}
 *
 *   deuda      {id, nombre, saldo, tasa (% anual), cuota, hastaMes}
 *
 *   movimiento algo que pasa en un mes: {mes, tipo, ...}
 *     vender        {posicionId, neto (COP) | netoPct}             → caja
 *     comprar       {nombre, costo, bolsillo, valorizacion, tasa, pagaPct, origen:[{posicionId|'caja', monto}]}
 *     revaluar      {posicionId, valor}                             (obra terminada, avalúo)
 *     aportar       {posicionId, monto, origen:[...]}               mover capital entre posiciones
 *     pagar_deuda   {deudaId, origen:[...]}
 *     flujo_inicia  {flujo:{...}}  ·  flujo_termina {flujoId}  ·  flujo_cambia {flujoId, monto}
 *     tasa_cambia   {posicionId, tasa}  ·  valorizacion_cambia {posicionId, valorizacion}
 *
 *   reglas     {excedente:[{posicionId, pct}], deficitDesde:[posicionId...], inflacion (% anual),
 *               indexarGastos (bool), indexarSustento (bool), coberturaMin (%),
 *               colchon:{posicionId, meta}            el excedente llena esto antes de repartirse
 *               rebalanceo:{a:{ids,destinoId}, b:{ids,destinoId}, aMin, aMax}
 *                                                     cada enero, A/(A+B) vuelve al rango}
 *
 * SALIDA por mes: entra (sustento recibido + flujos de ingreso), sale (gastos +
 * cuotas), queda, cobertura = entra/sale, crece (lo reinvertido + valorización),
 * produce = entra + crece, patrimonio neto, y el detalle por posición.
 */

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const mensual = (tasaAnualPct) => num(tasaAnualPct) / 100 / 12;                  // simple, como se pacta en Colombia
const mensualCompuesta = (tasaAnualPct) => Math.pow(1 + num(tasaAnualPct) / 100, 1 / 12) - 1;

export const BOLSILLOS = ["sustento", "crecimiento", "uso", "caja"];

function clonar(x) { return JSON.parse(JSON.stringify(x)); }

/** Saca `monto` de las fuentes listadas (o de caja). Devuelve lo que realmente consiguió. */
function tomarDe(origen, monto, pos, caja) {
  let falta = monto;
  const fuentes = origen && origen.length ? origen : [{ posicionId: "caja", monto }];
  for (const f of fuentes) {
    if (falta <= 0) break;
    const pedir = Math.min(falta, num(f.monto) || falta);
    if (f.posicionId === "caja" || !f.posicionId) { const t = Math.min(pedir, caja.valor); caja.valor -= t; falta -= t; }
    else { const p = pos.find((x) => x.id === f.posicionId); if (p) { const t = Math.min(pedir, p.capital); p.capital -= t; falta -= t; } }
  }
  return monto - falta;
}

/**
 * Simula un camino. Devuelve { meses, anual, puntos, posiciones }.
 */
export function simularCamino(cfg = {}) {
  const H = Math.max(12, num(cfg.meses) || 120);
  const pos = clonar(cfg.posiciones || []).map((p) => ({ ...p, capital: num(p.capital), tasa: num(p.tasa), pagaPct: p.pagaPct == null ? (p.bolsillo === "sustento" ? 100 : 0) : num(p.pagaPct), valorizacion: num(p.valorizacion), desdeMes: num(p.desdeMes) || 0 }));
  const caja = { valor: num(cfg.caja) };
  let flujos = clonar(cfg.flujos || []).map((f) => ({ ...f, monto: num(f.monto), desdeMes: num(f.desdeMes) || 0, hastaMes: f.hastaMes == null ? Infinity : num(f.hastaMes) }));
  const deudas = clonar(cfg.deudas || []).map((d) => ({ ...d, saldo: num(d.saldo), tasa: num(d.tasa), cuota: num(d.cuota), hastaMes: d.hastaMes == null ? Infinity : num(d.hastaMes), pagada: false }));
  const movs = clonar(cfg.movimientos || []).sort((a, b) => num(a.mes) - num(b.mes));
  const R = { excedente: [], deficitDesde: [], inflacion: 0, indexarGastos: false, indexarSustento: false, coberturaMin: 120, ...(cfg.reglas || {}) };
  const infl = num(R.inflacion) / 100;

  const meses = [];
  const log = []; // movimientos aplicados, para "lo que cambia"

  const aplicar = (m, mes) => {
    switch (m.tipo) {
      case "vender": {
        const p = pos.find((x) => x.id === m.posicionId); if (!p) return;
        const neto = m.neto != null ? num(m.neto) : p.capital * (m.netoPct != null ? num(m.netoPct) / 100 : 1);
        caja.valor += neto; p.capital = 0; p.vendida = true;
        log.push({ mes, texto: `Se vende ${p.nombre}: entran ${Math.round(neto)}` });
        // Los flujos atados al activo terminan
        flujos = flujos.map((f) => (f.posicionId === p.id ? { ...f, hastaMes: Math.min(f.hastaMes, mes - 1) } : f));
        break;
      }
      case "comprar": {
        const costo = num(m.costo);
        const conseguido = tomarDe(m.origen, costo, pos, caja);
        const id = m.id || `mov_${mes}_${pos.length}`;
        pos.push({ id, nombre: m.nombre || "Compra", bolsillo: m.bolsillo || "uso", capital: conseguido, tasa: num(m.tasa), pagaPct: m.pagaPct == null ? (m.bolsillo === "sustento" ? 100 : 0) : num(m.pagaPct), valorizacion: num(m.valorizacion), desdeMes: mes });
        log.push({ mes, texto: `${m.nombre || "Compra"}: ${Math.round(conseguido)}` });
        if (m.renta) flujos.push({ id: `${id}_renta`, nombre: `Renta ${m.nombre}`, tipo: "ingreso", monto: num(m.renta), desdeMes: mes + (num(m.rentaDesde) || 0), hastaMes: Infinity, posicionId: id });
        break;
      }
      case "revaluar": { const p = pos.find((x) => x.id === m.posicionId); if (p) { p.capital = num(m.valor); log.push({ mes, texto: `${p.nombre} vale ${Math.round(p.capital)}` }); } break; }
      case "aportar": { const p = pos.find((x) => x.id === m.posicionId); if (p) { const t = tomarDe(m.origen, num(m.monto), pos, caja); p.capital += t; log.push({ mes, texto: `A ${p.nombre}: ${Math.round(t)}` }); } break; }
      case "retirar": { const p = pos.find((x) => x.id === m.posicionId); if (p) { const t = Math.min(p.capital, num(m.monto)); p.capital -= t; caja.valor += t; log.push({ mes, texto: `De ${p.nombre} a caja: ${Math.round(t)}` }); } break; }
      case "pagar_deuda": { const d = deudas.find((x) => x.id === m.deudaId); if (d && !d.pagada) { const t = tomarDe(m.origen, d.saldo, pos, caja); d.saldo -= t; if (d.saldo <= 1) { d.saldo = 0; d.pagada = true; } log.push({ mes, texto: `Se paga ${d.nombre}: ${Math.round(t)}` }); } break; }
      case "flujo_inicia": { const f = m.flujo || {}; flujos.push({ id: f.id || `f_${mes}_${flujos.length}`, nombre: f.nombre || "", tipo: f.tipo || "ingreso", monto: num(f.monto), desdeMes: mes, hastaMes: f.hastaMes == null ? Infinity : num(f.hastaMes), indexa: !!f.indexa, posicionId: f.posicionId }); log.push({ mes, texto: `${f.tipo === "gasto" ? "Nuevo gasto" : "Entra"} ${f.nombre}: ${Math.round(num(f.monto))}/mes` }); break; }
      case "flujo_termina": { const f = flujos.find((x) => x.id === m.flujoId); if (f) { f.hastaMes = Math.min(f.hastaMes, mes - 1); log.push({ mes, texto: `Termina ${f.nombre}` }); } break; }
      case "flujo_cambia": { const f = flujos.find((x) => x.id === m.flujoId); if (f) { log.push({ mes, texto: `${f.nombre}: de ${Math.round(f.monto)} a ${Math.round(num(m.monto))}/mes` }); f.monto = num(m.monto); } break; }
      case "valorizacion_cambia": { const p = pos.find((x) => x.id === m.posicionId); if (p) { p.valorizacion = num(m.valorizacion); log.push({ mes, texto: `${p.nombre} valoriza ${p.valorizacion}% al año` }); } break; }
      case "tasa_cambia": { const p = pos.find((x) => x.id === m.posicionId); if (p) { p.tasa = num(m.tasa); log.push({ mes, texto: `${p.nombre} rinde ${p.tasa}%` }); } break; }
      default: break;
    }
  };

  let mi = 0;
  for (let mes = 0; mes < H; mes++) {
    // 1) Movimientos de este mes
    while (mi < movs.length && num(movs[mi].mes) <= mes) { aplicar(movs[mi], mes); mi++; }
    // 2) Cada enero (mes 12, 24, …): indexación y rebalanceo entre canastas
    if (mes > 0 && mes % 12 === 0) {
      if (infl > 0) {
        flujos.forEach((f) => { if ((f.tipo === "gasto" && R.indexarGastos) || (f.tipo === "ingreso" && (f.indexa || R.indexarSustento))) f.monto *= 1 + infl; });
        if (R.colchon && R.indexarGastos) R.colchon = { ...R.colchon, meta: num(R.colchon.meta) * (1 + infl) };
      }
      // rebalanceo: {a:{ids,destinoId}, b:{ids,destinoId}, aMin, aMax} → pct de A sobre A+B
      const RB = R.rebalanceo;
      if (RB && RB.a && RB.b) {
        const suma = (ids) => pos.filter((p) => ids.includes(p.id)).reduce((s, p) => s + Math.max(0, p.capital), 0);
        const A = suma(RB.a.ids || []), B = suma(RB.b.ids || []), T = A + B;
        const mover = (deIds, monto, destinoId, texto) => {
          const dest = pos.find((p) => p.id === destinoId); if (!dest || monto <= 0) return;
          const t = tomarDe(pos.filter((p) => deIds.includes(p.id) && p.id !== destinoId).sort((x, y) => y.capital - x.capital).map((p) => ({ posicionId: p.id })), monto, pos, caja);
          dest.capital += t; if (t > 0) log.push({ mes, texto: `${texto}: ${Math.round(t)}` });
        };
        if (T > 0 && RB.aMax != null && A / T * 100 > num(RB.aMax) + 0.5) mover(RB.a.ids, A - T * num(RB.aMax) / 100, RB.b.destinoId, "Rebalanceo a rentas");
        else if (T > 0 && RB.aMin != null && A / T * 100 < num(RB.aMin) - 0.5) mover(RB.b.ids, T * num(RB.aMin) / 100 - A, RB.a.destinoId, "Rebalanceo a crecimiento");
      }
    }
    // 3) Rendimiento de cada posición
    let recibido = 0, reinvertido = 0, valorizado = 0;
    const detalle = {};
    pos.forEach((p) => {
      if (p.capital <= 0 || mes < p.desdeMes) { detalle[p.id] = { capital: p.capital, recibe: 0 }; return; }
      // Lo que se recibe se pacta simple (tasa/12, como un CDT o un fondo de
      // crédito); lo que se reinvierte compone al efectivo anual (22% al año
      // es 22%, no 24,4%). Así el motor reproduce el plan SALEM al peso en
      // flujos y queda dentro del 1% en patrimonio.
      const paga = p.capital * mensual(p.tasa) * (p.pagaPct / 100);
      const re = p.capital * mensualCompuesta(p.tasa) * (1 - p.pagaPct / 100);
      const val = p.capital * mensualCompuesta(p.valorizacion);
      p.capital += re + val;
      recibido += paga; reinvertido += re; valorizado += val;
      detalle[p.id] = { capital: p.capital, recibe: paga };
    });
    // 4) Flujos y deudas
    const activo = (f) => mes >= f.desdeMes && mes <= f.hastaMes;
    const ingFlujos = flujos.filter((f) => f.tipo === "ingreso" && activo(f)).reduce((s, f) => s + f.monto, 0);
    const gastos = flujos.filter((f) => f.tipo === "gasto" && activo(f)).reduce((s, f) => s + f.monto, 0);
    let cuotas = 0;
    deudas.forEach((d) => {
      if (d.pagada || mes > d.hastaMes) return;
      const interes = d.saldo * mensual(d.tasa);
      const pago = Math.min(d.cuota, d.saldo + interes);
      cuotas += pago; d.saldo = d.saldo + interes - pago;
      if (d.saldo <= 1) { d.saldo = 0; d.pagada = true; }
    });
    const entra = recibido + ingFlujos;
    const sale = gastos + cuotas;
    const queda = entra - sale;
    // 5) Excedente o déficit
    if (queda > 0) {
      let libre = queda;
      // Primero el colchón: {posicionId, meta} se llena antes de repartir
      if (R.colchon && R.colchon.posicionId) {
        const c = R.colchon.posicionId === "caja" ? caja : pos.find((x) => x.id === R.colchon.posicionId);
        const actual = c === caja ? caja.valor : c?.capital;
        if (c && actual < num(R.colchon.meta)) { const t = Math.min(libre, num(R.colchon.meta) - actual); if (c === caja) caja.valor += t; else c.capital += t; libre -= t; }
      }
      const reparto = R.excedente.length ? R.excedente : [{ posicionId: "caja", pct: 100 }];
      reparto.forEach((r) => {
        const t = libre * num(r.pct) / 100;
        if (r.posicionId === "caja") caja.valor += t; else { const p = pos.find((x) => x.id === r.posicionId); if (p) p.capital += t; else caja.valor += t; }
      });
    } else if (queda < 0) {
      let falta = -queda;
      const t = Math.min(falta, caja.valor); caja.valor -= t; falta -= t;
      for (const id of (R.deficitDesde || [])) { if (falta <= 0) break; const p = pos.find((x) => x.id === id); if (p) { const u = Math.min(falta, p.capital); p.capital -= u; falta -= u; } }
      if (falta > 0) caja.valor -= falta; // queda negativa: señal de que el camino no se sostiene
    }
    // El detalle refleja el capital al CIERRE del mes (ya con excedente o déficit aplicado)
    pos.forEach((p) => { if (detalle[p.id]) detalle[p.id].capital = p.capital; });
    const activos = pos.reduce((s, p) => s + Math.max(0, p.capital), 0) + caja.valor;
    const deudaTotal = deudas.reduce((s, d) => s + d.saldo, 0);
    meses.push({
      mes, entra, sale, queda, gastos, cuotas, recibido, ingFlujos,
      cobertura: sale > 0 ? (entra / sale) * 100 : null,
      crece: reinvertido + valorizado, produce: entra + reinvertido + valorizado,
      patrimonio: activos - deudaTotal, activos, deudaTotal, caja: caja.valor,
      porBolsillo: BOLSILLOS.reduce((o, b) => { o[b] = pos.filter((p) => p.bolsillo === b).reduce((s, p) => s + Math.max(0, p.capital), 0) + (b === "caja" ? caja.valor : 0); return o; }, {}),
      detalle,
    });
  }

  // Resumen anual
  const anual = [];
  for (let a = 0; a * 12 < H; a++) {
    const bloque = meses.slice(a * 12, a * 12 + 12);
    const sum = (k) => bloque.reduce((s, m) => s + m[k], 0);
    const ult = bloque[bloque.length - 1];
    anual.push({ anio: a + 1, entra: sum("entra"), sale: sum("sale"), queda: sum("queda"), crece: sum("crece"), produce: sum("produce"), patrimonioFin: ult.patrimonio, entraMes: ult.entra, saleMes: ult.sale, quedaMes: ult.queda, cobertura: ult.cobertura, cambios: log.filter((l) => l.mes >= a * 12 && l.mes < a * 12 + 12).map((l) => l.texto) });
  }

  const p0 = cfg.patrimonioInicial != null ? num(cfg.patrimonioInicial) : (pos.length ? (cfg.posiciones || []).reduce((s, p) => s + num(p.capital), 0) + num(cfg.caja) - (cfg.deudas || []).reduce((s, d) => s + num(d.saldo), 0) : 0);
  const fin = meses[meses.length - 1];
  const años = H / 12;
  const deflactor = Math.pow(1 + infl, años);
  const apretado = meses.reduce((w, m) => (m.cobertura != null && (w == null || m.cobertura < w.cobertura) ? m : w), null);
  const puntos = {
    patrimonioInicial: p0,
    patrimonioFinal: fin.patrimonio,
    patrimonioFinalReal: infl > 0 ? fin.patrimonio / deflactor : fin.patrimonio,
    crecimientoRealAnual: p0 > 0 ? (Math.pow((fin.patrimonio / deflactor) / p0, 1 / años) - 1) * 100 : null,
    crecimientoNominalAnual: p0 > 0 ? (Math.pow(fin.patrimonio / p0, 1 / años) - 1) * 100 : null,
    entraMes: fin.entra, saleMes: fin.sale, quedaMes: fin.queda, cobertura: fin.cobertura,
    multiplicadorMes: fin.crece, produceMes: fin.produce,
    mesApretado: apretado ? { mes: apretado.mes, cobertura: apretado.cobertura, queda: apretado.queda } : null,
    seSostiene: meses.every((m) => m.cobertura == null || m.cobertura >= num(R.coberturaMin)),
    mesesNegativos: meses.filter((m) => m.queda < 0).length,
    cajaFinal: fin.caja,
  };
  return { meses, anual, puntos, posiciones: pos, deudas, flujos, log };
}

/**
 * Estrés: vuelve a correr el camino con las posiciones de crecimiento a una
 * tasa menor (p. ej. 15% en vez de 22%) y sin la mayor fuente de sustento.
 */
export function estresar(cfg, { tasaCrecimiento = null, sinPosicionId = null } = {}) {
  const c = clonar(cfg);
  if (tasaCrecimiento != null) c.posiciones = (c.posiciones || []).map((p) => (p.bolsillo === "crecimiento" ? { ...p, tasa: tasaCrecimiento } : p));
  if (sinPosicionId) c.posiciones = (c.posiciones || []).map((p) => (p.id === sinPosicionId ? { ...p, tasa: 0 } : p));
  return simularCamino(c);
}

/**
 * $100 M en cada tipo de inversión, a 3, 5 y 10 años, neto de impuestos y
 * con todo reinvertido. Para "cada inversión en igualdad de condiciones".
 */
export function cienMillones({ tasa, valorizacion = 0, impuestoRendimientoPct = 0, impuestoVentaPct = 0 }, años = [3, 5, 10]) {
  const out = {};
  años.forEach((n) => {
    let v = 100;
    for (let m = 0; m < n * 12; m++) {
      const y = v * mensual(tasa) * (1 - num(impuestoRendimientoPct) / 100);
      v += y + v * mensualCompuesta(valorizacion);
    }
    const ganancia = v - 100;
    out[`a${n}`] = 100 + ganancia * (1 - num(impuestoVentaPct) / 100);
  });
  return out;
}
