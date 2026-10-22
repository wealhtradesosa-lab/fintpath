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
 *               rebalanceo:{a:{ids,destinoId}, b:{ids,destinoId}, aMin, aMax, aMeta, cada}
 *                                                     A/(A+B) vuelve a la meta cuando sale del rango}
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
  const pos = clonar(cfg.posiciones || []).map((p) => ({ ...p, capital: num(p.capital), tasa: num(p.tasa), pagaPct: p.pagaPct == null ? (p.bolsillo === "sustento" ? 100 : 0) : num(p.pagaPct), valorizacion: num(p.valorizacion), desdeMes: num(p.desdeMes) || 0, impRendPct: num(p.impRendPct), impGananciaPct: num(p.impGananciaPct) }));
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
        const antesDeImpuesto = m.neto != null ? num(m.neto) : p.capital * (m.netoPct != null ? num(m.netoPct) / 100 : 1);
        // El impuesto de la venta se cobra sobre la GANANCIA (lo que vale hoy
        // menos lo que costó), no sobre el precio. Si no se sabe qué costó, no
        // se inventa: no se cobra.
        const gan = p.costoBase != null ? Math.max(0, p.capital - num(p.costoBase)) : 0;
        const impVenta = gan * num(p.impGananciaPct) / 100;
        const neto = Math.max(0, antesDeImpuesto - impVenta);
        caja.valor += neto; p.capital = 0; p.vendida = true;
        log.push({ mes, texto: `Se vende ${p.nombre}: entran ${Math.round(neto)}${impVenta > 0 ? ` (neto de ${Math.round(impVenta)} de impuesto)` : ""}` });
        // 22-oct-2026 (Santiago: "si vendí Puerto Madero, ¿por qué no muestra
        // que ese mismo año ingresa BTG?"). Una venta decía a dónde NO iba la
        // plata (a caja) pero no a dónde SÍ. Con destinoId, lo que entra por
        // la venta pasa directo a esa posición el mismo mes y empieza a rendir.
        if (m.destinoId && m.destinoId !== "caja") {
          const d = pos.find((x) => x.id === m.destinoId);
          if (d && d.id !== p.id && neto > 0) { d.capital += neto; caja.valor -= neto; if (d.desdeMes > mes) d.desdeMes = mes; log.push({ mes, texto: `→ ${Math.round(neto)} a ${d.nombre}` }); }
        }
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
      // 22-oct-2026 (Santiago: "¿no debería uno poder elegir si reinvierte
      // una parte de esa inversión, o en qué etapa se hace?"). Lo que una
      // posición te paga (y lo que reinvierte) puede cambiar con fecha:
      // tres años reinvirtiendo todo y desde el cuarto recibir el 100 %.
      case "paga_cambia": { const p = pos.find((x) => x.id === m.posicionId); if (p) { p.pagaPct = Math.min(100, Math.max(0, num(m.pagaPct))); log.push({ mes, texto: `${p.nombre} pasa a pagar el ${p.pagaPct}% (reinvierte el resto)` }); } break; }
      case "tasa_cambia": { const p = pos.find((x) => x.id === m.posicionId); if (p) { p.tasa = num(m.tasa); log.push({ mes, texto: `${p.nombre} rinde ${p.tasa}%` }); } break; }
      default: break;
    }
  };

  let mi = 0, rbAcum = 0;
  for (let mes = 0; mes < H; mes++) {
    // 1) Movimientos de este mes
    while (mi < movs.length && num(movs[mi].mes) <= mes) { aplicar(movs[mi], mes); mi++; }
    // 2) Cada enero (mes 12, 24, …): indexación
    if (mes > 0 && mes % 12 === 0) {
      if (infl > 0) {
        flujos.forEach((f) => { if ((f.tipo === "gasto" && R.indexarGastos) || (f.tipo === "ingreso" && (f.indexa || R.indexarSustento))) f.monto *= 1 + infl; });
        if (R.colchon && R.indexarGastos) R.colchon = { ...R.colchon, meta: num(R.colchon.meta) * (1 + infl) };
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
      // 22-oct-2026 — Lo que una SOCIEDAD gana paga renta antes de llegarte;
      // lo tuyo personal ya está contado en tus gastos (el impuesto neto), así
      // que por defecto no se vuelve a cobrar. `impRendPct` lo pone quien arma
      // la base, según de quién sea la posición (ver titularDe en caminos.js).
      const bruto = p.capital * mensual(p.tasa) * (p.pagaPct / 100);
      const paga = bruto * (1 - num(p.impRendPct) / 100);
      const re = p.capital * mensualCompuesta(p.tasa) * (1 - p.pagaPct / 100) * (1 - num(p.impRendPct) / 100);
      const val = p.capital * mensualCompuesta(p.valorizacion);
      // 22-oct-2026 (Santiago: "uno no puede decir que se reinvierte un
      // pedazo"). La parte que no recibes se reinvierte: en esta misma
      // posición, o en otra si `reinvierteEn` lo dice (de BTG, el 40 % va al
      // portafolio).
      const otra = p.reinvierteEn && p.reinvierteEn !== p.id ? pos.find((x) => x.id === p.reinvierteEn) : null;
      if (otra && re > 0) { otra.capital += re; otra.recibioRe = (otra.recibioRe || 0) + re; p.capital += val; } else p.capital += re + val;
      recibido += paga; reinvertido += re; valorizado += val;
      detalle[p.id] = { capital: p.capital, recibe: paga, reinvierte: re, reinvierteEn: otra ? otra.id : p.id };
    });
    pos.forEach((p) => { if (detalle[p.id]) detalle[p.id].capital = p.capital; });
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
    const cob = sale > 0 ? (entra / sale) * 100 : null;
    // 4.5) La banda de cobertura (22-oct-2026, del Plan Patrimonial SALEM:
    //      "el sustento se mide por cobertura: mínimo 120%. Si baja de 110%,
    //      se mueve capital de crecimiento a sustento. Si pasa de 140%, lo que
    //      sobra sube a crecimiento").
    //
    //      Es una banda de DOS lados, y los dos importan: el de abajo protege
    //      la vida -si lo que entra deja de cubrir lo que sale, se trae
    //      capital de lo que crece hasta volver a cubrirla- y el de arriba
    //      evita que el plan acumule renta de más mientras lo que multiplica
    //      se queda quieto.
    const BC = R.coberturaBanda;
    let movioPorCobertura = 0;
    if (BC && cob != null && BC.min != null && cob < num(BC.min) && BC.haciaId) {
      const dest = pos.find((x) => x.id === BC.haciaId);
      const faltaMes = sale * num(BC.min) / 100 - entra;
      // Cuánto capital hay que traer para que ESE destino produzca lo que falta.
      const rinde = dest ? mensual(dest.tasa) * (dest.pagaPct / 100) : 0;
      if (dest && rinde > 0 && faltaMes > 0) {
        const necesario = faltaMes / rinde;
        const fuentes = pos.filter((x) => (BC.desdeIds || []).includes(x.id) && x.id !== dest.id && x.capital > 0).sort((a, b) => b.capital - a.capital).map((x) => ({ posicionId: x.id }));
        const t = tomarDe(fuentes, necesario, pos, caja);
        if (t > 0) { dest.capital += t; movioPorCobertura = t; log.push({ mes, texto: `Cobertura en ${Math.round(cob)}%: se mueven ${Math.round(t)} de lo que crece a ${dest.nombre}` }); }
      }
    }
    // 5) Excedente o déficit
    let disfrute = 0;
    if (queda > 0) {
      let libre = queda;
      disfrute = 0;
      // Primero el colchón: {posicionId, meta} se llena antes de repartir
      if (R.colchon && R.colchon.posicionId) {
        const c = R.colchon.posicionId === "caja" ? caja : pos.find((x) => x.id === R.colchon.posicionId);
        const actual = c === caja ? caja.valor : c?.capital;
        if (c && actual < num(R.colchon.meta)) { const t = Math.min(libre, num(R.colchon.meta) - actual); if (c === caja) caja.valor += t; else c.capital += t; libre -= t; }
      }
      // 22-oct-2026 (Santiago: "¿cómo hago para disponer de lo que sobra
      // reinvirtiendo una parte?"). `disfrutePct` es la parte del sobrante
      // que la persona se gasta (viajes, familia, lo que sea): sale del
      // sistema ese mes y solo el resto se reinvierte.
      if (R.disfrutePct > 0) { disfrute = libre * Math.min(100, num(R.disfrutePct)) / 100; libre -= disfrute; }
      // Con la cobertura por encima del techo, lo que sobra sube entero a lo
      // que crece: ya hay de sobra con qué vivir.
      const holgado = BC && BC.max != null && cob != null && cob > num(BC.max) && BC.haciaCrecimientoId;
      const reparto = holgado ? [{ posicionId: BC.haciaCrecimientoId, pct: 100 }] : (R.excedente.length ? R.excedente : [{ posicionId: "caja", pct: 100 }]);
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
    // 6) Rebalanceo: {a:{ids,destinoId}, b:{ids,destinoId}, aMin, aMax, aMeta, cada}
    //    pct de A sobre A+B. Se revisa cada `cada` meses (1 = continuo); al salirse
    //    del rango vuelve a la META (centro), no al borde. Se registra una vez al año.
    const RB = R.rebalanceo;
    if (RB && RB.a && RB.b && (mes + 1) % (num(RB.cada) || 1) === 0) {
      const suma = (ids) => pos.filter((p) => ids.includes(p.id)).reduce((s, p) => s + Math.max(0, p.capital), 0);
      const A = suma(RB.a.ids || []), B = suma(RB.b.ids || []), T = A + B;
      const metaA = (hacia) => num(RB.aMeta != null ? RB.aMeta : hacia);
      const mover = (deIds, monto, destinoId, signo) => {
        const dest = pos.find((p) => p.id === destinoId); if (!dest || monto <= 0) return;
        const t = tomarDe(pos.filter((p) => deIds.includes(p.id) && p.id !== destinoId).sort((x, y) => y.capital - x.capital).map((p) => ({ posicionId: p.id })), monto, pos, caja);
        dest.capital += t; rbAcum += signo * t;
      };
      if (T > 0 && RB.aMax != null && A / T * 100 > num(RB.aMax) + 0.5) mover(RB.a.ids, A - T * metaA(RB.aMax) / 100, RB.b.destinoId, -1);
      else if (T > 0 && RB.aMin != null && A / T * 100 < num(RB.aMin) - 0.5) mover(RB.b.ids, T * metaA(RB.aMin) / 100 - A, RB.a.destinoId, +1);
      if (mes % 12 === 11 && Math.abs(rbAcum) > 0) { log.push({ mes, texto: `Rebalanceo ${rbAcum < 0 ? "a rentas" : "a crecimiento"}: ${Math.round(Math.abs(rbAcum))}` }); rbAcum = 0; }
    }
    // El detalle refleja el capital al CIERRE del mes (ya con excedente o déficit aplicado)
    pos.forEach((p) => { if (detalle[p.id]) detalle[p.id].capital = p.capital; });
    const activos = pos.reduce((s, p) => s + Math.max(0, p.capital), 0) + caja.valor;
    const deudaTotal = deudas.reduce((s, d) => s + d.saldo, 0);
    meses.push({
      mes, entra, sale, queda, gastos, cuotas, recibido, ingFlujos, disfrute,
      cobertura: cob, movioPorCobertura,
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
  // 22-oct-2026 (Santiago: "¿si crecimiento rinde menos me da MÁS plata?").
  // La prueba ponía a TODO lo que crece en la tasa de estrés, también a lo
  // que rendía menos (un portafolio al 1,5 % pasaba al 7,8 %). Estresar es
  // solo bajar: lo que ya rinde menos se queda como está.
  if (tasaCrecimiento != null) c.posiciones = (c.posiciones || []).map((p) => (p.bolsillo === "crecimiento" ? { ...p, tasa: Math.min(num(p.tasa), num(tasaCrecimiento)) } : p));
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
