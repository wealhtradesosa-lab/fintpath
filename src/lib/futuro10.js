// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Motor "Mi futuro a 10 años" (puro, sin React ni Supabase).
//
// Reglas:
//  1. Todo se proyecta en NOMINAL año a año y se lleva a pesos de hoy UNA sola
//     vez, dividiendo por (1+inflación)^t. Ningún retorno es "real" por dentro:
//     los presets se expresan como inflación + spread y se convierten a nominal.
//  2. Ingresos y gastos crecen cada uno con su propia tasa (inflación + spread
//     del escenario). Nada queda congelado en nominal.
//  3. Cada activo tiene su retorno (por clase o por decisión del usuario) y cada
//     canasta (liquidez / renta / crecimiento) el suyo.
//  4. Flujo negativo: consume liquidez → renta → crecimiento. Si no alcanza,
//     alerta. Un activo o una canasta en negativo, alerta.
//  5. Datos de hoy: calcularBase() de metrics.js (sin impuestos: este motor no
//     modela impuestos). La renta de cada activo sale de rentaNetaPorActivo,
//     que ya respeta `rentaOrigen` (manual = neta: no se restan otra vez los
//     gastos vinculados).
// Supuestos de referencia definidos con Finpathia · Finanzas (24-oct-2026); centralizados en SUPUESTOS_F10.
// ═══════════════════════════════════════════════════════════════════════════
import { calcularBase, tipoActivo, esLiquido, INFLACION_DEFAULT_PCT } from "./metrics.js";

export const SUPUESTOS_F10 = {
  validadoPor: "Finpathia · Finanzas, 24-oct-2026",
  anios: 10,
  colchonMeses: 6, // colchón de liquidez, aparte de las mezclas
  escenarios: {
    pesimista: { nombre: "Prudentes", inflacionPct: 6, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3.5 },
    base: { nombre: "Normales", inflacionPct: null /* = user.inflacionPct (4%) */, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 6.5 },
    optimista: { nombre: "Favorables", inflacionPct: 3, ingresosSpread: 2, gastosSpread: 0, retornoSpread: 1, spRealPct: 8 },
  },
  // Presets de retorno. realSpread = puntos sobre la inflación del escenario.
  presets: {
    rfCorto: { nombre: "Renta fija corto plazo", realSpread: 2.5 },
    rfLargo: { nombre: "Renta fija largo plazo", realSpread: 3.5, topeSpread: 4.5 },
    fincaRaiz: { nombre: "Finca raíz", rentaNetaPct: 4.5, valorizacionSpread: 0 },
    sp500: { nombre: "S&P 500 (USD)", usd: true, devaluacionRealPct: 0 /* real usa escenario.spRealPct */ },
  },
  vehiculo: { depAnios1a3Pct: -12, depDespuesPct: -8 },
  otrosRealSpread: 0, // crypto, otros: sin supuesto validado → solo inflación
  // Canasta → preset
  canastas: { liquidez: "rfCorto", renta: "rfLargo", crecimiento: "sp500" },
  nortes: {
    rentas: { nombre: "Vivir de rentas", liquidez: 10, renta: 65, crecimiento: 25 },
    equilibrio: { nombre: "Equilibrio", liquidez: 10, renta: 45, crecimiento: 45 },
    crecer: { nombre: "Crecer", liquidez: 10, renta: 20, crecimiento: 70 },
  },
};

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function resolverEscenario(clave = "base", user = {}, sup = SUPUESTOS_F10) {
  const e = sup.escenarios[clave] || sup.escenarios.base;
  const infUser = user.inflacionPct != null && user.inflacionPct !== "" ? n(user.inflacionPct) : INFLACION_DEFAULT_PCT;
  const inflacionPct = e.inflacionPct == null ? infUser : e.inflacionPct;
  return { ...e, clave, inflacionPct };
}

/** Retorno total NOMINAL anual (%) de un preset bajo un escenario. Fisher: (1+i)(1+r)−1. */
export function retornoNominalPreset(clave, esc, sup = SUPUESTOS_F10, override = {}) {
  const p = { ...sup.presets[clave], ...override };
  const i = esc.inflacionPct / 100;
  let real;
  if (clave === "sp500") real = (override.realPct ?? esc.spRealPct) + n(p.devaluacionRealPct);
  else if (clave === "fincaRaiz") {
    // renta neta (sobre el valor) + valorización = inflación + spread
    const val = (1 + i) * (1 + (n(p.valorizacionSpread)) / 100) - 1;
    return ((val + (n(p.rentaNetaPct) + esc.retornoSpread) / 100 * (1 + val)) * 100);
  } else {
    real = n(p.realSpread) + esc.retornoSpread;
    if (p.topeSpread != null) real = Math.min(real, p.topeSpread);
  }
  return ((1 + i) * (1 + real / 100) - 1) * 100;
}

export function claseActivo(a) {
  const tp = tipoActivo(a);
  if (/veh/i.test(tp)) return "vehiculo";
  if (["Real Estate", "Local Comercial", "Bodega"].includes(tp)) return "inmueble";
  if (["Acciones", "ETF"].includes(tp)) return "acciones";
  if (esLiquido(a)) return "liquido";
  return "otro";
}

/**
 * @param {object} user  datos del usuario (inv, ingresos, gas, deu, trm, inflacionPct)
 * @param {object} cfg   { escenario, decisiones:{[id]:{accion,retornoRealPct}}, norte,
 *                         mezcla:{liquidez,renta,crecimiento}, nuevas:[{nombre,preset,monto}],
 *                         reinversiones:[{activoId,monto}], supuestos }
 */
export function proyectarFuturo10(user = {}, cfg = {}) {
  const sup = cfg.supuestos || SUPUESTOS_F10;
  const esc = resolverEscenario(cfg.escenario || "base", user, sup);
  const N = n(cfg.anios) || sup.anios;
  const inf = esc.inflacionPct / 100;
  const gIng = (1 + inf) * (1 + esc.ingresosSpread / 100) - 1;
  const gGas = (1 + inf) * (1 + esc.gastosSpread / 100) - 1;
  // Sin impuestos: se omiten impuestoNeto y retencionMensual.
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm;
  const fxA = (a) => (String(a?.moneda || a?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const dec = cfg.decisiones || {};
  const rNom = (k, ov) => retornoNominalPreset(k, esc, sup, ov) / 100;

  // ── Activos que continúan ────────────────────────────────────────────────
  let bolsa = 0, rentaVendida = 0;
  const activos = [];
  const modInfo = {}; // resumen de cada «Se modifica» para la pantalla
  (b.inv || []).forEach((a) => {
    const d = dec[a.id] || {};
    const valor = n(a.va) * fxA(a);
    const rentaAnual = n(b.rentaNetaPorActivo[a.id]) * 12;
    if (d.accion === "vende") { bolsa += valor; return; } // su renta y sus gastos salen con bOp (abajo)
    const clase = claseActivo(a);
    // Crecimiento del VALOR (la renta vinculada ya entra al flujo de ingresos).
    let crec = crecimientoDefault(a, esc, sup, rentaAnual);
    const mod = d.accion === "modifica" ? leerModifica(d, esc) : null;
    if (mod && mod.valorizacionNomPct != null) crec = mod.valorizacionNomPct / 100;
    if (mod) {
      const total = valor + mod.inversionMonto;
      modInfo[a.id] = { valorHoy: valor, inversion: mod.inversionMonto, inversionAnio: mod.inversionAnio, valorConObra: total,
        rentaMensual: mod.rentaNuevaMensual, rentaDesdeMes: mod.rentaNuevaDesdeMes,
        rentaPctAnual: total > 0 ? mod.rentaNuevaMensual * 12 / total * 100 : 0, valorizacionPct: crec == null ? null : crec * 100 };
    }
    activos.push({ id: a.id, nombre: a.n || a.nombre || "Activo", clase, valor, crec, rentaAnual, usd: fxA(a) !== 1, invertible: clase !== "vehiculo",
      invMonto: mod ? mod.inversionMonto : 0, invAnio: mod ? mod.inversionAnio : 0,
      rentaNuevaAnual: mod ? mod.rentaNuevaMensual * 12 : 0, rentaDesdeMes: mod ? mod.rentaNuevaDesdeMes : 0, valorHoy: valor });
  });

  // 24-oct-2026 (Santiago: "en Reinvierte necesito ver qué saldo me quedó de
  // lo que vendí, para ir sabiendo cuánto tengo para reinvertir"). Se lleva la
  // cuenta de la bolsa paso a paso y se devuelve en `bolsaDetalle`.
  const vendidoTotal = bolsa;

  // ── Deudas que se pagan con lo vendido ───────────────────────────────────
  // 24-oct-2026 (Santiago: "si vendo Orlando la idea es pagar la deuda de
  // Orlando… incluso tengo otras deudas que me gustaría pagar con plata de los
  // activos que se venden"). La sección vieja lo tenía y aquí se había perdido.
  // Orden: 1) la deuda que cuelga de un activo vendido (campo `la`) se paga
  // siempre con esa venta; 2) las que el usuario marque en `cfg.pagarDeudas`.
  // Solo se paga con lo vendido, nunca con la liquidez de hoy. Si no alcanza,
  // se abona lo que haya: el saldo baja y la cuota sigue igual (termina antes).
  const vendidos = new Set((b.inv || []).filter((a) => dec[a.id]?.accion === "vende").map((a) => a.id));
  const pagarCfg = cfg.pagarDeudas || {};
  const deudasUser = (user.deudas || user.deu || []).filter((d) => d && d.sim !== false);
  const deudas = deudasUser.map((d) => {
    const activoId = d.la || d.link || null;
    const porVenta = !!activoId && vendidos.has(activoId);
    return { id: d.id, nombre: d.n || d.nombre || "Deuda", saldo: n(d.mt) * fxA(d), activoId, porVenta, pagar: porVenta || !!pagarCfg[d.id], pagado: 0, _d: d };
  }).filter((d) => d.saldo > 0);
  [...deudas.filter((d) => d.porVenta), ...deudas.filter((d) => !d.porVenta && d.pagar)].forEach((d) => {
    const m = Math.min(bolsa, d.saldo);
    d.pagado = m; bolsa -= m;
  });
  const deudasPagadasTotal = deudas.reduce((s, d) => s + d.pagado, 0);
  const deudaSinCubrir = deudas.filter((d) => d.pagar).reduce((s, d) => s + d.saldo - d.pagado, 0);
  // Lo que queda vivo, con la misma regla de cuota del resto de la app.
  const pagadoPorId = Object.fromEntries(deudas.map((d) => [d.id, d]));
  const deudasVivas = deudasUser.flatMap((d) => {
    const x = pagadoPorId[d.id];
    if (!x || x.pagado <= 0) return [d];
    if (x.pagado >= x.saldo - 0.5) return [];
    return [{ ...d, mt: (x.saldo - x.pagado) / fxA(d) }];
  });
  const bDeuda = deudasPagadasTotal > 0 ? calcularBase({ ...sinImp, gastos: user.gastos || user.gas, deu: deudasVivas, deudas: deudasVivas }, {}) : b;

  // ── Bolsa: colchón → reinversiones / nuevas → resto según la mezcla ─────
  // El colchón se mide con las obligaciones que quedan (sin las cuotas que se pagan hoy).
  const obAnual = bDeuda.ob * 12;
  const metaColchon = (bDeuda.ob * n(sup.colchonMeses));
  const liquidosQueQuedan = activos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
  const canasta = { liquidez: 0, renta: 0, crecimiento: 0 };
  let colchon = Math.min(bolsa, Math.max(0, metaColchon - liquidosQueQuedan));
  bolsa -= colchon;
  const colchonInicial = colchon; // `colchon` cambia año a año; la bolsa reporta el de hoy
  const nuevas = [];
  let reinvertidoTotal = 0, nuevasTotal = 0, pedidoTotal = 0, desdeLiquidez = 0, programadasTotal = 0, pendienteAnio1 = 0;
  // 24-oct-2026 (Santiago: "añadí estas inversiones y cuando voy a ver el
  // resultado no se ven ahí reflejadas"). Antes una inversión solo se
  // financiaba con lo vendido: sin ventas, o si no alcanzaba, quedaba en $0 y
  // desaparecía sin aviso, mientras la pantalla decía que saldría de la
  // liquidez. Ahora toma primero de lo vendido y lo que falte sale de tus
  // cuentas líquidas de hoy. Si tampoco alcanza, se asigna hasta donde llega.
  // 24-oct-2026 (Santiago: "si pongo que voy a invertir 600 M, el sistema
  // debería saber de dónde vienen: capital nuevo o producto de venta de un
  // activo"). Cada inversión trae su origen (`fuente`):
  //   "venta" (por defecto) → lo vendido, luego tu liquidez
  //   "liquidez"            → solo tus cuentas líquidas de hoy
  //   "nuevo"               → capital nuevo, de afuera (ahorro, crédito):
  //                           no sale de nada, suma al patrimonio.
  let capitalNuevo = 0;
  const tomar = (monto, excluirId, fuente = "venta") => {
    let falta = Math.max(0, monto);
    if (fuente === "nuevo") { capitalNuevo += falta; return falta; }
    const deBolsa = fuente === "liquidez" ? 0 : Math.min(bolsa, falta); bolsa -= deBolsa; falta -= deBolsa;
    activos.filter((a) => a.clase === "liquido" && a.id !== excluirId).forEach((a) => {
      const u = Math.min(a.valor, falta); a.valor -= u; falta -= u; desdeLiquidez += u;
    });
    return Math.max(0, monto) - falta;
  };
  // 24-oct-2026 (Santiago: "voy a reinvertir 600 M en un lote para construir
  // una bodega"). La obra que se hace en el año 1 sale de una vez de lo vendido
  // (y si no alcanza, de la liquidez), para que el saldo de Reinvierte la
  // descuente. Queda apartada (rinde como liquidez) y entra al activo al hacer
  // la obra en el año 1; la valorización sobre el total corre desde ahí.
  let obrasTotal = 0, obrasPedido = 0;
  activos.forEach((a) => {
    if (!(a.invMonto > 0 && a.invAnio === 1)) return;
    obrasPedido += a.invMonto;
    const m = tomar(a.invMonto, a.id);
    a.reserva = m; a.reservaBase = m; obrasTotal += m; a.invMonto -= m; // lo que no alcance se saca en el año 1
  });
  // 24-oct-2026 (Santiago: "reinvertir en cosas que ya se tienen debería traer
  // el valor anterior más el nuevo… y dónde pongo lo que va a rentar"). Cada
  // reinversión puede traer su renta (rentaMensual, pesos de hoy) y desde qué
  // mes; se devuelve el detalle hoy + aporte = total para la pantalla.
  const reinversionesDetalle = [];
  (cfg.reinversiones || []).forEach((r, k) => {
    pedidoTotal += Math.max(0, n(r.monto));
    const a = activos.find((x) => x.id === r.activoId);
    if (!a) return;
    const antes = a.valor;
    if (!vacio(r.valorizacionNomPct)) a.crec = n(r.valorizacionNomPct) / 100;
    // 24-oct-2026 (Santiago: "según el tipo de inversión la plataforma debe
    // saber si genera renta o se valoriza… en fondos o trade poner lo que
    // estima que rinde al año y si se reinvierte o se saca una parte").
    // Fuera de inmuebles: rendimiento anual (%) y qué parte te llega (%).
    // Lo que te llega entra al flujo; el resto se reinvierte (interés
    // compuesto). Describe el activo entero y reemplaza la renta que tuviera.
    const esInm = a.clase === "inmueble";
    const rendActual = (a.crec ?? 0) + (a.valor > 0 ? (a.rentaAnual || 0) / a.valor : 0);
    let rendimientoPct = null, pctRecibe = null;
    if (!esInm && (!vacio(r.rendimientoNomPct) || !vacio(r.pctRecibe))) {
      const rend = !vacio(r.rendimientoNomPct) ? n(r.rendimientoNomPct) / 100 : rendActual;
      const p = Math.min(1, Math.max(0, n(r.pctRecibe) / 100));
      a.crec = rend * (1 - p); a.rentaPct = rend * p;
      if (!a.rentaReemplazada) { rentaVendida += a.rentaAnual || 0; a.rentaReemplazada = true; }
      rendimientoPct = rend * 100; pctRecibe = p * 100;
    }
    const anioAporte = Math.min(10, Math.max(1, Math.round(n(r.anio) || 1)));
    let m = 0;
    let deVenta = 0, deLiquidez = 0, deAnio1 = 0, deNuevo = 0;
    if (anioAporte === 1) {
      const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
      m = n(r.monto) > 0 ? tomar(n(r.monto), a.id, r.fuente) : 0;
      deVenta = b0 - bolsa; deLiquidez = desdeLiquidez - l0; deNuevo = capitalNuevo - c0;
      if (m > 0) { a.valor += m; reinvertidoTotal += m; }
      // Si lo vendido y la liquidez no alcanzan, el resto se paga con lo que
      // entre en el año 1 (la obra se hace igual): no se recorta.
      const resto = Math.max(0, n(r.monto)) - m;
      if (resto > 0.5) { pedidoTotal -= resto; pendienteAnio1 += resto; (a.aportesFuturos = a.aportesFuturos || []).push({ monto: resto, anio: 1 }); m += resto; deAnio1 = resto; }
    } else if (n(r.monto) > 0) {
      // Aporte de un año siguiente: se paga ese año con lo que haya (como una obra futura).
      pedidoTotal -= Math.max(0, n(r.monto)); programadasTotal += n(r.monto);
      (a.aportesFuturos = a.aportesFuturos || []).push({ monto: n(r.monto), anio: anioAporte, nuevo: r.fuente === "nuevo" });
    }
    const rentaMensual = Math.max(0, n(r.rentaMensual));
    const rentaDesdeMes = Math.min(119, Math.max(0, Math.round(n(r.rentaDesdeMes))));
    if (rentaMensual > 0) (a.rentasExtra = a.rentasExtra || []).push({ anual: rentaMensual * 12, desdeMes: rentaDesdeMes });
    const totalConAporte = antes + (anioAporte === 1 ? m : n(r.monto));
    const rendUsado = rendimientoPct != null ? rendimientoPct : rendActual * 100;
    const pUsado = pctRecibe != null ? pctRecibe : 0;
    reinversionesDetalle.push({ i: k, activoId: a.id, nombre: a.nombre, clase: a.clase, valorHoy: antes, aporte: anioAporte === 1 ? m : n(r.monto), anio: anioAporte, total: totalConAporte, rentaMensual, rentaDesdeMes, rentaPctAnual: totalConAporte > 0 ? rentaMensual * 12 / totalConAporte * 100 : 0,
      valorizacionPct: esInm ? (a.crec == null ? null : a.crec * 100) : null,
      rendimientoPct: esInm ? null : rendUsado, pctRecibe: esInm ? null : pUsado,
      deVenta, deLiquidez, deAnio1, deNuevo, fuente: r.fuente || "venta",
      rindeAnual: esInm ? 0 : totalConAporte * rendUsado / 100, teLlegaMes: esInm ? 0 : totalConAporte * rendUsado / 100 * pUsado / 100 / 12 });
  });
  const personalizadas = [];
  (cfg.nuevas || []).forEach((x, k) => {
    if (x.preset === "custom") {
      const c = leerPersonalizada(x, esc, sup);
      if (c.monto <= 0) return;
      // 24-oct-2026 (Santiago: "me dice que faltan 8.630 M por invertir pero
      // ya invertí 7.500 M"). La personalizada del año 1 no se descontaba de lo
      // vendido: se sacaba durante el año de las canastas y la bolsa la seguía
      // mostrando libre. Ahora sale desde hoy, como las de la lista. Las de
      // años siguientes se pagan ese año con lo que haya (programadas).
      if (c.anio === 1) {
        pedidoTotal += c.monto;
        const m = tomar(c.monto, null, x.fuente);
        if (m <= 0) return;
        nuevasTotal += m;
        nuevas.push({ id: "nueva_" + k, nombre: c.nombre, clase: "nueva", valor: m, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true, fuente: x.fuente || "venta", preset: "custom", montoInicial: m });
        return;
      }
      programadasTotal += c.monto;
      personalizadas.push({ ...c, id: "nueva_" + k });
      return;
    }
    pedidoTotal += Math.max(0, n(x.monto));
    if (n(x.monto) <= 0 || !sup.presets[x.preset]) return;
    const m = tomar(n(x.monto), null, x.fuente);
    if (m <= 0) return;
    nuevasTotal += m;
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || sup.presets[x.preset].nombre, clase: "nueva", valor: m, crec: rNom(x.preset), usd: !!sup.presets[x.preset].usd, invertible: true, fuente: x.fuente || "venta", preset: x.preset, montoInicial: m });
  });
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = bolsa * mezcla[k] / 100; });
  const rCan = { liquidez: rNom(sup.canastas.liquidez), renta: rNom(sup.canastas.renta), crecimiento: rNom(sup.canastas.crecimiento) };

  // ── Deuda: la cuota sigue nominal fija hasta saldar; saldo lineal ───────
  // 24-oct-2026 (Santiago: "debo 437 M de un local… pueden existir deudas sin
  // interés que se pagan de una sola vez"). Una deuda sin intereses
  // (tipoInteres "sin_interes", sin cuota) no entra al pozo que se amortiza con
  // cuotas: su saldo resta del patrimonio hasta que se paga, sea con una venta
  // (Tu plata → Pagar deudas) o de una vez en el año `pagoUnicoAnio`.
  const anioHoy = new Date().getFullYear();
  const esUnica = (d) => d && d.tipoInteres === "sin_interes" && !(n(d.pg ?? d.pago) > 0);
  const unicas = deudasVivas.filter(esUnica).map((d) => ({ nombre: d.n || d.nombre || "Deuda", saldo: n(d.mt) * fxA(d), t: n(d.pagoUnicoAnio) > 0 ? Math.min(N, Math.max(1, n(d.pagoUnicoAnio) - anioHoy + 1)) : null }));
  let deudaUnica = unicas.reduce((sm, d) => sm + d.saldo, 0);
  let deuda = bDeuda.deudaTotal - deudaUnica; const cuotaAnual = bDeuda.sd * 12;
  const aniosDeuda = cuotaAnual > 0 ? deuda / cuotaAnual : 0;

  // 24-oct-2026 (Santiago: "¿y los gastos de dónde salen?"). Al vender un
  // activo se van su renta, TODOS sus gastos vinculados (también lo que cuesta
  // por encima de lo que renta: Orlando renta 22,6 M y cuesta 24,8 M) y sus
  // ingresos vinculados. Antes solo se restaba la renta neta y el exceso de
  // costos se quedaba en los gastos para siempre.
  const vendidosIds = new Set((b.inv || []).filter((a) => dec[a.id]?.accion === "vende").map((a) => a.id));
  const sinVendidos = (arr) => (arr || []).filter((x) => !(x && x.activoId && vendidosIds.has(x.activoId)));
  const gastosSinVendidos = Object.fromEntries(Object.entries(user.gastos || user.gas || {}).map(([k, v]) => [k, sinVendidos(v)]));
  const bOp = vendidosIds.size ? calcularBase({ ...sinImp, inv: (user.inv || []).filter((a) => !vendidosIds.has(a?.id)), ingresos: sinVendidos(user.ingresos), gastos: gastosSinVendidos, gas: gastosSinVendidos, deu: deudasVivas, deudas: deudasVivas }, {}) : bDeuda;
  let ingresos = (bOp.ia + bOp.ip) * 12 - rentaVendida;
  let gastos = (bOp.ob - bOp.sd) * 12;
  // 24-oct-2026 (Santiago: "los gráficos de los escenarios están muy flojos…
  // que se vea como el HTML", su plan SALEM). Para graficar lo que produce el
  // patrimonio se lleva aparte la renta pasiva (lo que llega a la cuenta sin
  // trabajar) y, por activo, cuánto renta y cuánto crece cada año.
  let pasivo = Math.max(0, bOp.ip * 12 - rentaVendida);
  const todos = [...activos, ...nuevas];
  const valorTotal = () => todos.reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const invertible = () => todos.filter((a) => a.invertible).reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const filas = [];
  const alertas = [];
  const fila0 = { anio: 0, ingresos, gastos: gastos + (deuda > 0 ? cuotaAnual : 0), cf: 0, activos: valorTotal(), invertible: invertible(), deuda, liquidez: colchon + canasta.liquidez + liquidosQueQuedan };
  fila0.patrimonio = fila0.activos - deuda - deudaUnica; fila0.deuda = deuda + deudaUnica; fila0.deflactor = 1;
  fila0.patrimonioReal = fila0.patrimonio; fila0.invertibleReal = fila0.invertible;
  fila0.rentas = pasivo; fila0.laboral = Math.max(0, ingresos - pasivo); fila0.crece = 0; fila0.produce = pasivo;
  fila0.ingresosReal = ingresos; fila0.gastosReal = fila0.gastos;
  fila0.porActivo = [
    ...todos.map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor + (a.reserva || 0), renta: a.rentaReemplazada ? 0 : (a.rentaAnual || 0), crece: 0, crec: a.crec, rentaPct: a.rentaPct || 0 })),
    { id: "c_liquidez", nombre: "Liquidez y colchón", clase: "canasta", valor: colchon + canasta.liquidez, renta: 0, crece: 0, crec: rCan.liquidez },
    { id: "c_renta", nombre: "Renta fija (lo que sobra)", clase: "canasta", valor: canasta.renta, renta: 0, crece: 0, crec: rCan.renta },
    { id: "c_crecimiento", nombre: "Crecimiento (lo que sobra)", clase: "canasta", valor: canasta.crecimiento, renta: 0, crece: 0, crec: rCan.crecimiento },
  ].filter((x) => Math.abs(x.valor) > 0.5 || x.renta > 0.5);
  filas.push(fila0);
  let liqAgotadaAnio = null;
  // ── Lo que viene: ingresos y activos que empiezan más adelante ──────────
  const fut = leerFuturos(cfg.futuros, esc, sup);
  // 24-oct-2026 (Santiago: "tengo un activo que en un año empieza a rentar…
  // debería poder elegir en el ingreso nuevo los activos existentes, y poner
  // cuánto se valoriza"). Un ingreso futuro puede salir de un activo tuyo;
  // si trae valorización, se aplica a ese activo.
  fut.ingresos.forEach((x) => { const a = x.activoId && activos.find((y) => y.id === x.activoId); if (a && x.valorizacionNomPct != null) a.crec = x.valorizacionNomPct / 100; });
  fut.activos.forEach((x, k) => todos.push({ id: "futuro_" + k, nombre: x.nombre, clase: x.clase === "inmueble" ? "inmueble" : "otro", valor: 0, crec: x.crec, entrega: x.entrega, pagos: x.pagos, usd: false, invertible: true, rentaNuevaAnual: x.rentaMensual * 12, rentaDesdeMes: 12 * (Math.max(1, x.rentaDesde) - 1) }));
  let expUSD = canasta.crecimiento > 0;
  for (let t = 1; t <= N; t++) {
    // Saca plata en orden: colchón → liquidez → líquidos existentes → renta → crecimiento.
    const retirar = (monto) => {
      let falta = monto;
      const sacar = (v) => { const u = Math.min(Math.max(0, v), falta); falta -= u; return v - u; };
      colchon = sacar(colchon);
      canasta.liquidez = sacar(canasta.liquidez);
      todos.filter((a) => a.clase === "liquido").forEach((a) => { a.valor = sacar(a.valor); });
      canasta.renta = sacar(canasta.renta);
      canasta.crecimiento = sacar(canasta.crecimiento);
      if (falta > 0) { canasta.liquidez -= falta; if (liqAgotadaAnio == null) liqAgotadaAnio = t; }
    };
    // 0) inversiones personalizadas: al inicio del año X pasan de tu liquidez/bolsa al activo nuevo.
    personalizadas.forEach((c) => {
      if (c.anio !== t) return;
      retirar(c.monto);
      // «Paga renta»: el valor sigue la inflación y el resto del rendimiento va al flujo.
      todos.push({ id: c.id, nombre: c.nombre, clase: "nueva", valor: c.monto, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true });
    });
    // 1) rendimientos y depreciación del año
    let creceAnio = 0;
    const creceCan = { colchon: 0, liquidez: 0, renta: 0, crecimiento: 0 };
    todos.forEach((a) => {
      a.creceT = 0;
      if (a.entrega && t <= a.entrega) return; // se valoriza desde la entrega
      const antes = a.valor;
      if (a.crec == null) { const p = t <= 3 ? sup.vehiculo.depAnios1a3Pct : sup.vehiculo.depDespuesPct; a.valor *= 1 + p / 100; }
      else a.valor *= 1 + a.crec;
      a.creceT = a.valor - antes; creceAnio += a.creceT;
    });
    creceCan.colchon = colchon * rCan.liquidez; colchon *= 1 + rCan.liquidez;
    todos.forEach((a) => { if (a.reserva > 0) { creceCan.colchon += a.reserva * rCan.liquidez; a.reserva *= 1 + rCan.liquidez; } });
    Object.keys(canasta).forEach((k) => { creceCan[k] += canasta[k] * rCan[k]; canasta[k] *= 1 + rCan[k]; });
    creceAnio += creceCan.colchon + creceCan.liquidez + creceCan.renta + creceCan.crecimiento;
    // 2) flujo del año (ingresos y gastos ya crecidos)
    if (t > 1) { ingresos *= 1 + gIng; gastos *= 1 + gGas; pasivo *= 1 + gIng; }
    // Renta nueva de un activo modificado: pesos de hoy, crece con la inflación.
    const rentaPers = todos.reduce((s, a) => s + (a.rentaPct ? a.valor / (1 + a.crec) * a.rentaPct : 0), 0);
    const ingFuturo = fut.ingresos.reduce((s, x) => s + (t >= x.desde && t <= x.hasta ? x.mensual * 12 * Math.pow(1 + inf, t) : 0), 0);
    // Renta nueva por meses: si arranca en el mes 7, el año 1 recibe 6 de 12 meses.
    const fraccionAnio = (mesInicio) => Math.min(1, Math.max(0, (12 * t - n(mesInicio)) / 12));
    const rentaNueva = rentaPers + ingFuturo + todos.reduce((s, a) => s + (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * Math.pow(1 + inf, t) : 0)
      + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * Math.pow(1 + inf, t), 0), 0);
    const gastoFuturo = (fut.gastos || []).reduce((sm, x) => sm + (t >= x.desde && t <= x.hasta ? x.anual * Math.pow(1 + inf, t) : 0), 0);
    const cuota = deuda > 0 ? Math.min(cuotaAnual, cuotaAnual * Math.max(0, aniosDeuda - (t - 1))) : 0;
    deuda = Math.max(0, deuda - cuota);
    const cf = ingresos + rentaNueva - gastos - gastoFuturo - cuota;
    if (cf >= 0) {
      Object.keys(canasta).forEach((k) => { canasta[k] += cf * mezcla[k] / 100; });
    } else {
      retirar(-cf);
      alertas.push({ tipo: "cf_negativo", anio: t, texto: `En el año ${t} sale más de lo que entra; se usa tu liquidez.` });
    }
    // Deuda sin intereses que se paga de una vez este año: sale de tu liquidez.
    unicas.forEach((d) => {
      if (d.t !== t || d.saldo <= 0) return;
      retirar(d.saldo); deudaUnica -= d.saldo;
      alertas.push({ tipo: "pago_unico", anio: t, texto: `En el año ${t} pagas ${d.nombre} de una vez con tu liquidez.` });
      d.saldo = 0;
    });
    // Pagos de un activo futuro: pasan de tu liquidez al activo (no cambia el patrimonio).
    todos.forEach((a) => (a.pagos || []).forEach((pg) => {
      if (pg.anio !== t || pg.monto <= 0) return;
      retirar(pg.monto); a.valor += pg.monto;
      alertas.push({ tipo: "pago_futuro", anio: t, texto: `En el año ${t} pagas parte de ${a.nombre} con tu liquidez.` });
    }));
    // Inversión adicional (pesos de ese año): pasa de tu liquidez al activo. No cambia el patrimonio.
    todos.forEach((a) => {
      (a.aportesFuturos || []).forEach((x) => {
        if (x.anio !== t) return;
        if (!x.nuevo) retirar(x.monto);
        a.valor += x.monto;
        alertas.push({ tipo: "inversion_adicional", anio: t, texto: `En el año ${t} pasas plata de tu liquidez a ${a.nombre}.` });
      });
      if (a.invAnio === t && (a.invMonto > 0 || a.reserva > 0)) {
        // lo apartado entra al activo; lo que rindió mientras tanto vuelve al colchón
        if (a.reserva > 0) { a.valor += a.reservaBase; colchon += a.reserva - a.reservaBase; a.reserva = 0; }
        if (a.invMonto > 0) { retirar(a.invMonto); a.valor += a.invMonto; }
        alertas.push({ tipo: "inversion_adicional", anio: t, texto: `En el año ${t} pasas plata de tu liquidez a ${a.nombre}.` });
      }
    });
    if (canasta.crecimiento > 0) expUSD = true;
    const liquidez = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
    const deflactor = Math.pow(1 + inf, t);
    const activosT = valorTotal();
    const f = { anio: t, ingresos: ingresos + rentaNueva, rentaNueva, gastos: gastos + gastoFuturo + cuota, gastoFuturo, cf, activos: activosT, invertible: invertible(), deuda: deuda + deudaUnica, liquidez, deflactor };
    // Lo que produce el patrimonio este año: renta que llega a la cuenta + lo que crece invertido.
    f.rentas = pasivo + rentaNueva; f.laboral = Math.max(0, ingresos - pasivo); f.crece = creceAnio; f.produce = f.rentas + creceAnio;
    const fr = Math.pow(1 + gIng, t - 1);
    f.porActivo = [
      ...todos.map((a) => {
        const rentaBase = a.rentaReemplazada ? 0 : (a.rentaAnual || 0) * fr;
        const rentaExtra = (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * Math.pow(1 + inf, t) : 0) + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * Math.pow(1 + inf, t), 0) + (a.rentaPct ? a.valor / (1 + (a.crec || 0)) * a.rentaPct : 0);
        return { id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor + (a.reserva || 0), renta: rentaBase + rentaExtra, crece: a.creceT || 0 };
      }),
      { id: "c_liquidez", nombre: "Liquidez y colchón", clase: "canasta", valor: colchon + canasta.liquidez, renta: 0, crece: creceCan.colchon + creceCan.liquidez },
      { id: "c_renta", nombre: "Renta fija (lo que sobra)", clase: "canasta", valor: canasta.renta, renta: 0, crece: creceCan.renta },
      { id: "c_crecimiento", nombre: "Crecimiento (lo que sobra)", clase: "canasta", valor: canasta.crecimiento, renta: 0, crece: creceCan.crecimiento },
    ].filter((x) => Math.abs(x.valor) > 0.5 || x.renta > 0.5);
    f.patrimonio = activosT - deuda - deudaUnica;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.ingresosReal = (ingresos + rentaNueva) / deflactor; // incluye la renta nueva (bodega, ingresos futuros)
    f.gastosReal = f.gastos / deflactor;
    if (liquidez < 0 || todos.some((a) => a.valor < 0)) alertas.push({ tipo: "activo_negativo", anio: t, texto: `En el año ${t} un activo o tu liquidez queda en negativo.` });
    else if (obAnual > 0 && liquidez < metaColchon) alertas.push({ tipo: "liquidez_baja", anio: t, texto: `En el año ${t} tu liquidez cubre menos de ${sup.colchonMeses} meses de gastos.` });
    filas.push(f);
  }
  const fin = filas[filas.length - 1];
  // Cómo queda repartida la plata al final, inversión por inversión.
  const defl = fin.deflactor || 1;
  const repartoFinal = [
    ...todos.filter((a) => Math.abs(a.valor) > 0.5).map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor, valorReal: a.valor / defl })),
    ...[["colchon", "Colchón de liquidez", colchon], ["liquidez", "Canasta liquidez", canasta.liquidez], ["renta", "Canasta renta", canasta.renta], ["crecimiento", "Canasta crecimiento", canasta.crecimiento]]
      .filter(([, , v]) => Math.abs(v) > 0.5).map(([id, nombre, v]) => ({ id, nombre, clase: "canasta", valor: v, valorReal: v / defl })),
  ].sort((x, y) => y.valor - x.valor);
  return {
    escenario: esc, mezcla, filas, alertas, liqAgotadaAnio,
    bolsaDetalle: { vendido: vendidoTotal, deudas: deudasPagadasTotal, deudaSinCubrir, colchon: colchonInicial, reinvertido: reinvertidoTotal, nuevas: nuevasTotal, restante: bolsa, pedido: pedidoTotal, obras: obrasTotal, obrasPedido, capitalNuevo, programadas: programadasTotal, pendienteAnio1, desdeLiquidez, faltante: Math.max(0, pedidoTotal - reinvertidoTotal - nuevasTotal) },
    reparto: repartoFinal,
    vendidos: (b.inv || []).filter((x) => vendidos.has(x.id)).map((x) => ({ id: x.id, nombre: x.n || x.nombre || "Activo", valor: n(x.va) * fxA(x) })),
    reinversionesDetalle,
    nuevasDetalle: [...nuevas.map((x) => ({ nombre: x.nombre, monto: x.montoInicial ?? 0, anio: 1, rendPct: ((x.crec || 0) + (x.rentaPct || 0)) * 100, pagaRenta: (x.rentaPct || 0) > 0, fuente: x.fuente })), ...personalizadas.map((c) => ({ nombre: c.nombre, monto: c.monto, anio: c.anio, rendPct: c.rendNom * 100, pagaRenta: c.pagaRenta, fuente: "liquidez" }))],
    futuros: fut,
    modificados: activos.filter((a) => modInfo[a.id]).map((a) => ({ id: a.id, ...modInfo[a.id] })),
    deudas: deudas.map(({ id, nombre, saldo, activoId, porVenta, pagar, pagado }) => ({ id, nombre, saldo, activoId, porVenta, pagar, pagado })),
    cuotasQueSalenMes: Math.max(0, b.sd - bDeuda.sd),
    hoy: { patrimonio: b.patrimonioNeto, ingresoMensual: b.ia + b.ip, salidaMensual: b.ob, flujoMensual: b.fl, liquidos: b.liquidos, colchonMeses: b.colchonMeses },
    activos: activos.map(({ id, nombre, clase, usd }) => ({ id, nombre, clase, usd })),
    hayUSD: todos.some((a) => a.usd && a.valor > 0) || [...activos, ...nuevas, ...personalizadas].some((a) => a.usd && (a.valor || a.monto) > 0) || expUSD,
    final: fin,
    // Comparativo contra la inflación: solo lo invertible (sin vehículos).
    vsInflacionReal: fila0.invertible > 0 ? (fin.invertibleReal / fila0.invertible - 1) * 100 : null,
  };
}

/** Valorización NOMINAL anual por defecto (fracción) de un activo según su clase. */
export function crecimientoDefault(a, esc, sup = SUPUESTOS_F10, rentaAnual = 0) {
  const inf = esc.inflacionPct / 100;
  const clase = claseActivo(a);
  if (clase === "vehiculo") return null; // depreciación por año
  if (clase === "inmueble") return a.valorizacionPct != null && a.valorizacionPct !== "" ? n(a.valorizacionPct) / 100 : (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1;
  if (rentaAnual > 0) return inf; // el rendimiento ya lo paga como ingreso
  if (clase === "liquido") return retornoNominalPreset("rfCorto", esc, sup) / 100;
  if (clase === "acciones") return retornoNominalPreset("sp500", esc, sup) / 100;
  return (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
}

/** Hint en % nominal para «¿Cuánto crees que se valoriza al año?». Vehículo: depreciación años 1–3. */
export function valorizacionHintPct(a, esc, sup = SUPUESTOS_F10) {
  const c = crecimientoDefault(a, esc, sup);
  return c == null ? sup.vehiculo.depAnios1a3Pct : c * 100;
}

const vacio = (v) => v === "" || v == null;
/**
 * Normaliza una decisión «Se modifica». Compatibilidad: escenarios guardados con
 * `retornoRealPct` (real, sobre la inflación) se convierten a nominal con Fisher.
 */
export function leerModifica(d = {}, esc) {
  const inf = esc.inflacionPct / 100;
  let valorizacionNomPct = null;
  if (!vacio(d.valorizacionNomPct)) valorizacionNomPct = n(d.valorizacionNomPct);
  else if (!vacio(d.retornoRealPct)) valorizacionNomPct = ((1 + inf) * (1 + n(d.retornoRealPct) / 100) - 1) * 100;
  const anio = (v) => Math.min(10, Math.max(1, Math.round(n(v) || 1)));
  return {
    valorizacionNomPct,
    inversionMonto: Math.max(0, n(d.inversionMonto)), inversionAnio: anio(d.inversionAnio),
    rentaNuevaMensual: Math.max(0, n(d.rentaNuevaMensual)), rentaNuevaDesde: anio(d.rentaNuevaDesde),
    // Meses desde hoy hasta la primera renta (0 = ya). Compatibilidad: si solo hay
    // año, empieza al inicio de ese año.
    rentaNuevaDesdeMes: !vacio(d.rentaNuevaDesdeMes) ? Math.min(119, Math.max(0, Math.round(n(d.rentaNuevaDesdeMes)))) : 12 * (anio(d.rentaNuevaDesde) - 1),
  };
}

/** Hint (% nominal) para una inversión personalizada: renta fija corto plazo del escenario. */
export function rendimientoHintPct(esc, sup = SUPUESTOS_F10) { return retornoNominalPreset("rfCorto", esc, sup); }

/** Normaliza una inversión «Otra (personalizada)». Rendimiento en % NOMINAL. */
export function leerPersonalizada(x = {}, esc, sup = SUPUESTOS_F10) {
  const rend = vacio(x.rendimientoNomPct) ? rendimientoHintPct(esc, sup) : n(x.rendimientoNomPct);
  return {
    nombre: String(x.nombre || "").trim() || "Inversión personalizada",
    monto: Math.max(0, n(x.monto)), anio: Math.min(10, Math.max(1, Math.round(n(x.anio) || 1))),
    rendNom: rend / 100, usd: String(x.moneda || "COP").toUpperCase() === "USD",
    // 24-oct-2026 (Santiago: "¿cómo así que los ingresos el primer año son 95 M?
    // ¿y lo de BTG?"). Antes «Paga renta» solo pagaba lo que rinde por encima de
    // la inflación; una renta fija paga la tasa completa y el capital queda
    // igual. Ahora se dice qué parte del rendimiento te llega (0–100 %): eso
    // entra al flujo y el resto se reinvierte. Escenarios viejos: «renta» = todo,
    // «valoriza» = nada.
    pctRecibe: !vacio(x.pctRecibe) ? Math.min(100, Math.max(0, n(x.pctRecibe))) : x.tipo === "renta" ? 100 : 0,
    get pagaRenta() { return this.pctRecibe > 0; },
  };
}

/**
 * «Lo que viene». ingresos: [{nombre, mensual (pesos de hoy), desde, hasta?, titular?}]
 * activos: [{nombre, clase: "inmueble"|"otro", valor, cuotaInicial, anioCuota, entrega,
 *            pagos?:[{monto, anio}], rentaMensual (pesos de hoy), rentaDesde, valorizacionNomPct}]
 * Pagos en pesos de cada año. Si no hay `pagos`, se arma: cuota inicial en su año y el resto en la entrega.
 */
export function leerFuturos(f = {}, esc, sup = SUPUESTOS_F10) {
  const inf = esc.inflacionPct / 100;
  const anio = (v, d = 1) => Math.min(10, Math.max(1, Math.round(n(v) || d)));
  const ingresos = (f?.ingresos || []).map((x) => {
    const desde = anio(x.desde);
    return { nombre: String(x.nombre || "").trim() || "Ingreso futuro", mensual: Math.max(0, n(x.mensual)), desde, hasta: vacio(x.hasta) ? 99 : Math.max(desde, anio(x.hasta)), titular: x.titular || null, activoId: x.activoId || null, valorizacionNomPct: vacio(x.valorizacionNomPct) ? null : n(x.valorizacionNomPct) };
  }).filter((x) => x.mensual > 0);
  const activos = (f?.activos || []).map((x) => {
    const entrega = anio(x.entrega);
    let pagos;
    if (Array.isArray(x.pagos) && x.pagos.length) pagos = x.pagos.map((p) => ({ monto: Math.max(0, n(p.monto)), anio: anio(p.anio) }));
    else {
      const valor = Math.max(0, n(x.valor)), cuota = Math.min(valor, Math.max(0, n(x.cuotaInicial)));
      pagos = [{ monto: cuota, anio: Math.min(anio(x.anioCuota), entrega) }, { monto: valor - cuota, anio: entrega }];
    }
    const def = x.clase === "inmueble" ? (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1 : (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
    return { nombre: String(x.nombre || "").trim() || "Activo futuro", clase: x.clase === "inmueble" ? "inmueble" : "otro", entrega, pagos,
      crec: vacio(x.valorizacionNomPct) ? def : n(x.valorizacionNomPct) / 100,
      rentaMensual: Math.max(0, n(x.rentaMensual)), rentaDesde: anio(x.rentaDesde, entrega) };
  }).filter((x) => x.pagos.some((p) => p.monto > 0));
  // 24-oct-2026 (Santiago: "como vienen nuevas rentas también vienen nuevos
  // gastos: mis hijos en la universidad afuera, unos 180 M por año").
  // gastos: [{nombre, anual (pesos de hoy), desde, anios?}] — sube con la inflación.
  const gastos = (f?.gastos || []).map((x) => {
    const desde = anio(x.desde);
    const anios = vacio(x.anios) ? null : Math.max(1, Math.round(n(x.anios)));
    return { nombre: String(x.nombre || "").trim() || "Gasto futuro", anual: Math.max(0, n(x.anual)), desde, hasta: anios == null ? 99 : desde + anios - 1 };
  }).filter((x) => x.anual > 0);
  return { ingresos, activos, gastos };
}

/** Mezcla personalizada: debe sumar 100%. Devuelve null o el mensaje para mostrar. */
export function validarMezcla(m) {
  if (!m) return null;
  const s = ["liquidez", "renta", "crecimiento"].reduce((t, k) => t + (Number(m[k]) || 0), 0);
  if (Math.abs(s - 100) < 0.01) return null;
  return `La mezcla suma ${String(Math.round(s * 10) / 10).replace(".", ",")}%. Ajústala para que sume 100%.`;
}

export function normalizarMezcla(m = {}) {
  const l = Math.max(0, n(m.liquidez)), r = Math.max(0, n(m.renta)), c = Math.max(0, n(m.crecimiento));
  const s = l + r + c;
  if (s <= 0) return { liquidez: 100, renta: 0, crecimiento: 0 };
  return { liquidez: (l / s) * 100, renta: (r / s) * 100, crecimiento: (c / s) * 100 };
}

/** Paso 6: cuánto dan $100M (u otro monto) a 3, 5 y 10 años, nominal y en pesos de hoy. */
export function cienMillones(presetClave, esc, monto = 100e6, sup = SUPUESTOS_F10) {
  const r = retornoNominalPreset(presetClave, esc, sup) / 100;
  const inf = esc.inflacionPct / 100;
  return [3, 5, 10].map((a) => { const nom = monto * Math.pow(1 + r, a); return { anios: a, nominal: nom, hoy: nom / Math.pow(1 + inf, a) }; });
}

/**
 * 24-oct-2026 (Santiago: "estoy perdido… si a mí me pasa, a otros les pasará").
 * La obra y la renta nueva vivían en dos lados (Decide → «Se modifica» y
 * Reinvierte). Queda un solo camino: Reinvierte → «Aumentar lo que ya tienes».
 * Esta función pasa un «Se modifica» guardado a una reinversión equivalente
 * (aporte, año, renta, desde qué mes, valorización) y deja el activo en
 * «continúa». No toca lo que ya estaba como reinversión.
 */
export function migrarModifica(cfg = {}, esc) {
  const dec = cfg.decisiones || {};
  const extra = [];
  const nuevasDec = {};
  let cambio = false;
  Object.entries(dec).forEach(([id, d]) => {
    if (d?.accion !== "modifica") { nuevasDec[id] = d; return; }
    cambio = true;
    const m = leerModifica(d, esc || { inflacionPct: INFLACION_DEFAULT_PCT });
    if (m.inversionMonto > 0 || m.rentaNuevaMensual > 0 || m.valorizacionNomPct != null) {
      extra.push({ activoId: id, monto: m.inversionMonto || "", anio: m.inversionAnio, rentaMensual: m.rentaNuevaMensual || "", rentaDesdeMes: m.rentaNuevaDesdeMes, ...(m.valorizacionNomPct != null ? { valorizacionNomPct: m.valorizacionNomPct } : {}) });
    }
    nuevasDec[id] = { accion: "continua" };
  });
  if (!cambio) return cfg;
  return { ...cfg, decisiones: nuevasDec, reinversiones: [...(cfg.reinversiones || []), ...extra] };
}
