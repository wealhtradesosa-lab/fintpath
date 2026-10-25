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
import { calcularBase, tipoActivo, esLiquido, tipoIngreso, INFLACION_DEFAULT_PCT } from "./metrics.js";
import { montoPromedioMensual } from "./flowHelpers.js";

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
export function proyectarFuturo10(userIn = {}, cfg = {}) {
  const user = ajustarIngresos(paraPlan(userIn), cfg);
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
    // 25-oct-2026 (Santiago: "unas inversiones rentan más y está cargando
    // valores promedio"). En Hoy se corrige cuánto sube cada una al año.
    const crecHoy = (cfg.crecHoy || {})[a.id];
    if (!vacio(crecHoy) && crec != null) crec = n(crecHoy) / 100;
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
  let excesoVentas = 0, excesoCubierto = 0, ciclosTotal = 0, reservadoTotal = 0;
  // 25-oct-2026 (Santiago: "invertí menos en Ledger y lo que me sobra no se
  // alteró"). Cada uso de plata con su origen, para que la cuenta se vea línea
  // por línea: solo lo que sale «de lo que vendo» mueve lo que sobra.
  const usos = [];
  // Plata apartada hoy de lo vendido para algo que se hace un año siguiente:
  // queda como «Apartado para …», rinde como liquidez y se usa ese año.
  const apartados = [];
  const apartar = (nombre, monto, seccion, anio) => {
    const b0 = bolsa, l0 = desdeLiquidez;
    const m = tomar(monto, null, "venta");
    usos.push({ seccion, nombre, monto, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: 0, anio, fuente: "venta", apartado: true, resto: monto - m });
    reservadoTotal += m;
    const h = { id: "apartado_" + apartados.length, nombre: `Apartado para ${nombre}`, clase: "otro", valor: m, crec: rNom("rfCorto"), usd: false, invertible: true, apartadoDe: nombre };
    apartados.push(h);
    return h;
  };
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
    // 25-oct-2026 (Santiago: "no sé si me pasé de las platas que tenía
    // disponibles por ventas"). Lo que se pidió «de lo que vendo» y no alcanzó.
    const antesLiq = falta;
    if (fuente !== "liquidez" && falta > 0) excesoVentas += falta;
    activos.filter((a) => a.clase === "liquido" && a.id !== excluirId).forEach((a) => {
      const u = Math.min(a.valor, falta); a.valor -= u; falta -= u; desdeLiquidez += u;
    });
    if (fuente !== "liquidez") excesoCubierto += antesLiq - falta;
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
  unaPorActivo(cfg.reinversiones).forEach((r, k) => {
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
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta, deCuentas: deLiquidez, deNuevo, anio: 1, fuente: r.fuente || "venta" });
      if (m > 0) { a.valor += m; reinvertidoTotal += m; }
      // Si lo vendido y la liquidez no alcanzan, el resto se paga con lo que
      // entre en el año 1 (la obra se hace igual): no se recorta.
      const resto = Math.max(0, n(r.monto)) - m;
      if (resto > 0.5) { pedidoTotal -= resto; pendienteAnio1 += resto; (a.aportesFuturos = a.aportesFuturos || []).push({ monto: resto, anio: 1 }); m += resto; deAnio1 = resto; }
    } else if (n(r.monto) > 0 && (r.fuente || "venta") === "venta" && vendidoTotal > 0.5) {
      // 25-oct-2026 (Santiago: "le bajé 100 M a Ledger y sigue saliendo que me
      // pasé"). Una inversión de un año siguiente que sale «de lo que vendo»
      // se APARTA hoy de lo vendido (rinde como liquidez) y entra al activo ese
      // año. Antes se pagaba ese año con lo que hubiera y no tocaba el saldo.
      // Cuenta contra lo vendido como todo lo demás: si ya no alcanza, es lo
      // que te pasaste (sale de tus cuentas de hoy y queda apartado).
      const b0 = bolsa, l0 = desdeLiquidez;
      const m2 = tomar(n(r.monto), a.id, "venta");
      const resto2 = n(r.monto) - m2;
      if (resto2 > 0.5) { pedidoTotal -= resto2; programadasTotal += resto2; }
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: 0, anio: anioAporte, fuente: "venta", apartado: true, resto: resto2 });
      reservadoTotal += m2;
      a.reserva = (a.reserva || 0) + m2;
      (a.aportesFuturos = a.aportesFuturos || []).push({ monto: n(r.monto), anio: anioAporte, apartado: m2 });
    } else if (n(r.monto) > 0) {
      usos.push({ seccion: "B", nombre: a.nombre, monto: n(r.monto), deVenta: 0, deCuentas: 0, deNuevo: 0, anio: anioAporte, fuente: r.fuente || "venta" });
      // Aporte de un año siguiente: se paga ese año con lo que haya (como una obra futura).
      pedidoTotal -= Math.max(0, n(r.monto)); programadasTotal += n(r.monto);
      (a.aportesFuturos = a.aportesFuturos || []).push({ monto: n(r.monto), anio: anioAporte, nuevo: r.fuente === "nuevo" });
    }
    const rentaMensual = Math.max(0, n(r.rentaMensual));
    const rentaDesdeMes = Math.min(119, Math.max(0, Math.round(n(r.rentaDesdeMes))));
    if (rentaMensual > 0) (a.rentasExtra = a.rentasExtra || []).push({ anual: rentaMensual * 12, desdeMes: rentaDesdeMes });
    // «¿Cuánto queda valiendo al terminar la obra?»: el activo salta a ese valor
    // el año en que termina (el de la renta, o el del aporte si no hay renta).
    if (n(r.valorAlTerminar) > 0) (a.saltos = a.saltos || []).push({ t: Math.max(anioAporte, rentaMensual > 0 ? Math.floor(rentaDesdeMes / 12) + 1 : anioAporte), valor: n(r.valorAlTerminar) });
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
        const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
        const m = tomar(c.monto, null, x.fuente);
        usos.push({ seccion: "C", nombre: c.nombre, monto: c.monto, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: x.fuente || "venta" });
        if (m <= 0) return;
        nuevasTotal += m;
        nuevas.push({ id: "nueva_" + k, nombre: c.nombre, clase: "nueva", valor: m, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true, fuente: x.fuente || "venta", preset: "custom", montoInicial: m });
        return;
      }
      if ((x.fuente || "venta") === "venta" && vendidoTotal > 0.5) {
        const h = apartar(c.nombre, c.monto, "C", c.anio);
        personalizadas.push({ ...c, id: "nueva_" + k, holder: h });
        return;
      }
      programadasTotal += c.monto;
      personalizadas.push({ ...c, id: "nueva_" + k });
      return;
    }
    pedidoTotal += Math.max(0, n(x.monto));
    if (n(x.monto) <= 0 || !sup.presets[x.preset]) return;
    const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
    const m = tomar(n(x.monto), null, x.fuente);
    usos.push({ seccion: "C", nombre: x.nombre || sup.presets[x.preset].nombre, monto: n(x.monto), deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: x.fuente || "venta" });
    if (m <= 0) return;
    nuevasTotal += m;
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || sup.presets[x.preset].nombre, clase: "nueva", valor: m, crec: rNom(x.preset), usd: !!sup.presets[x.preset].usd, invertible: true, fuente: x.fuente || "venta", preset: x.preset, montoInicial: m });
  });
  // 25-oct-2026 (Santiago: "asociativos: el primer año invierto 1.350 M en un
  // lote con construcción de vivienda, al terminar vale 1.900 M y se vende; la
  // ganancia la reinvierto y los mismos 1.350 M vuelven a entrar al segundo
  // año, y así cada año… es un negocio cíclico"). El capital sale UNA vez (de
  // donde diga la fuente), queda trabajando en el negocio y cada ciclo deja su
  // ganancia: se reinvierte (en lo que sobra) o llega al flujo. Al terminar,
  // el capital vuelve. Cifras en pesos de hoy; suben con la inflación.
  const ciclos = leerCiclos(cfg.ciclos, N);
  const ciclosDetalle = [];
  ciclos.forEach((c, k) => {
    const a = { id: "ciclo_" + k, nombre: c.nombre, clase: "ciclo", valor: 0, crec: inf, usd: false, invertible: true, ciclo: c, tomado: false };
    if (c.desde === 1) {
      pedidoTotal += c.capital;
      const b0 = bolsa, l0 = desdeLiquidez, c0 = capitalNuevo;
      const m = tomar(c.capital, null, c.fuente);
      usos.push({ seccion: "D", nombre: c.nombre, monto: c.capital, deVenta: b0 - bolsa, deCuentas: desdeLiquidez - l0, deNuevo: capitalNuevo - c0, anio: 1, fuente: c.fuente });
      a.valor = m; a.tomado = true; ciclosTotal += m;
    } else if (c.fuente === "venta" && vendidoTotal > 0.5) {
      a.holder = apartar(c.nombre, c.capital, "D", c.desde);
    }
    nuevas.push(a);
    ciclosDetalle.push({ id: a.id, nombre: c.nombre, capital: c.capital, valorFinal: c.valorFinal, meses: c.meses, desde: c.desde, hasta: c.hasta, fuente: c.fuente, destino: c.destino, destinoId: c.destinoId, costosPct: c.costosPct, regimen: c.regimen, impuestoPct: c.impuestoPct, impuestoAnual: c.impuestoAnual, gananciaCiclo: c.gananciaCiclo, gananciaAnual: c.gananciaAnual, rentabilidadPct: c.capital > 0 ? c.gananciaAnual / c.capital * 100 : 0 });
  });
  apartados.forEach((h) => nuevas.push(h));
  const sobraDestinos = (Array.isArray(cfg.sobraDestinos) ? cfg.sobraDestinos : []).filter((d) => d && d.id).map((d) => ({ id: d.id, pct: Math.min(100, Math.max(0, n(d.pct))) })).filter((d) => d.pct > 0);
  { let acum = 0; sobraDestinos.forEach((d) => { d.pct = Math.min(d.pct, 100 - acum); acum += d.pct; }); }
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  // 25-oct-2026 (Santiago: "quiero dejar esos 28 M disponibles"). Con
  // cfg.repartoDisponible lo que sobra (de las ventas y lo no asignado de cada
  // mes) queda disponible en el colchón, sin invertirse en las canastas.
  const disponible = !!cfg.repartoDisponible;
  if (disponible) { colchon += bolsa; ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = 0; }); }
  else ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = bolsa * mezcla[k] / 100; });
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
  // 24-oct-2026 (Santiago: "¿por qué me aparece la renta de Puerto Madero si se
  // vende? Lo mismo Orlando"). Muchas rentas se cargan en Ingresos sin
  // vincularlas al activo. Al vender, también se van las que el usuario marca
  // en «¿Qué se va con la venta?» (por defecto, las que llevan su nombre).
  const fuera = vinculadosQueSeVan(user, cfg, vendidosIds);
  const sinVendidos = (arr, pre) => (arr || []).filter((x, k) => !(x && x.activoId && vendidosIds.has(x.activoId)) && !fuera.has(`${pre}${k}`));
  const gastosSinVendidos = Object.fromEntries(Object.entries(user.gastos || user.gas || {}).map(([k, v]) => [k, sinVendidos(v, `${k}::`)]));
  const bOp = vendidosIds.size ? calcularBase({ ...sinImp, inv: (user.inv || []).filter((a) => !vendidosIds.has(a?.id)), ingresos: sinVendidos(user.ingresos, "i:"), gastos: gastosSinVendidos, gas: gastosSinVendidos, deu: deudasVivas, deudas: deudasVivas }, {}) : bDeuda;
  let ingresos = (bOp.ia + bOp.ip) * 12 - rentaVendida;
  let gastos = (bOp.ob - bOp.sd) * 12;
  // 24-oct-2026 (Santiago: "¿cómo quita uno items de gastos que ya no van?
  // por ejemplo mantenimientos"). Gastos de hoy que se acaban en el escenario
  // (cfg.gastosTerminan: { "cat::índice": año desde el que ya no se paga }).
  // Solo cambia el escenario: Egresos no se toca.
  const fxG = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? b.trm : 1);
  const conRentaOp = new Set(Object.keys(bOp.rentaNetaPorActivo || {}));
  const gastosHoy = [];
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false || (g.activoId && vendidosIds.has(g.activoId)) || fuera.has(`${cat}::${idx}`)) return;
    const v = montoPromedioMensual(g) * fxG(g); if (!(v > 0.5)) return;
    gastosHoy.push({ key: `${cat}::${idx}`, nombre: g.c || g.n || g.nombre || cat, cat, mensual: v, neteado: !!(g.activoId && conRentaOp.has(g.activoId)) });
  }));
  // 24-oct-2026 (Santiago: "uno debería poder apagar y prender rentas que ya
  // no van, gastos que ya no van"). Igual que los gastos: cada ingreso de hoy
  // sigue o se acaba desde un año (cfg.ingresosTerminan: { "i:índice": año }).
  const fxIng = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? b.trm : 1);
  const ingresosHoy = [];
  (user.ingresos || []).forEach((i, k) => {
    if (!i || i.sim === false || (i.activoId && vendidosIds.has(i.activoId)) || fuera.has(`i:${k}`)) return;
    const v = montoPromedioMensual(i) * fxIng(i); if (!(v > 0.5)) return;
    ingresosHoy.push({ key: `i:${k}`, nombre: i.nombre || i.categoria || "Ingreso", mensual: v, pasivo: tipoIngreso(i) === "pasivo", activoId: i.activoId || null });
  });
  const ingTerminan = cfg.ingresosTerminan || {};
  const ingSeVan = ingresosHoy.filter((x) => ingTerminan[x.key]).map((x) => ({ ...x, desde: Math.min(N, Math.max(1, Math.round(n(ingTerminan[x.key])) || 1)) }));
  const terminan = cfg.gastosTerminan || {};
  const seVan = gastosHoy.filter((g) => !g.neteado && terminan[g.key]).map((g) => ({ ...g, desde: Math.min(N, Math.max(1, Math.round(n(terminan[g.key])) || 1)) }));
  // 24-oct-2026 (Santiago: "los gráficos de los escenarios están muy flojos…
  // que se vea como el HTML", su plan SALEM). Para graficar lo que produce el
  // patrimonio se lleva aparte la renta pasiva (lo que llega a la cuenta sin
  // trabajar) y, por activo, cuánto renta y cuánto crece cada año.
  let pasivo = Math.max(0, bOp.ip * 12 - rentaVendida);
  // 24-oct-2026 (Santiago: "uno debería poder revisar cada inversión, cuánto
  // vale, cuánto renta"). En el paso Hoy puede corregir para el plan la renta
  // neta de un activo (cfg.rentaHoy: { id: pesos al mes }); reemplaza la que
  // sale de Ingresos − Egresos ligados. Sus páginas no se tocan.
  const rentaHoy = cfg.rentaHoy || {};
  activos.forEach((a) => {
    const v = rentaHoy[a.id]; if (v == null || v === "" || a.rentaReemplazada) return;
    const nueva = Math.max(0, n(v)) * 12, antes = n((bOp.rentaNetaPorActivo || {})[a.id]) * 12;
    ingresos += nueva - antes; pasivo += nueva - antes; a.rentaAnual = nueva; a.rentaCorregida = true;
    if (nueva > 0 && a.crec != null && a.clase !== "inmueble" && a.clase !== "vehiculo") a.crec = Math.min(a.crec, inf); // el rendimiento ya llega como renta
  });
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
  fut.activos.forEach((x, k) => todos.push({ id: "futuro_" + k, nombre: x.nombre, clase: x.clase === "inmueble" ? "inmueble" : "otro", fuentesPago: x.fuentesPago, saltos: x.valorAlTerminar > 0 ? [{ t: x.entrega, valor: x.valorAlTerminar }] : [], valor: 0, crec: x.crec, entrega: x.entrega, pagos: x.pagos, usd: false, invertible: true, rentaNuevaAnual: x.rentaMensual * 12, rentaDesdeMes: 12 * (Math.max(1, x.rentaDesde) - 1) }));
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
      if (c.holder) { const usa = Math.min(c.holder.valor, c.monto); c.holder.valor -= usa; if (c.monto - usa > 0.5) retirar(c.monto - usa); colchon += Math.max(0, c.holder.valor); c.holder.valor = 0; }
      else retirar(c.monto);
      // «Paga renta»: el valor sigue la inflación y el resto del rendimiento va al flujo.
      todos.push({ id: c.id, nombre: c.nombre, clase: "nueva", valor: c.monto, crec: c.rendNom * (1 - c.pctRecibe / 100), rentaPct: c.rendNom * c.pctRecibe / 100, usd: c.usd, invertible: true });
    });
    // 0b) negocios que se repiten: arrancan (sale el capital) o terminan (vuelve).
    todos.forEach((a) => {
      const c = a.ciclo; if (!c) return;
      if (!a.tomado && t === c.desde) {
        const K = c.capital * Math.pow(1 + inf, t - 1);
        if (c.fuente === "nuevo") capitalNuevo += K;
        else if (a.holder) { const usa = Math.min(a.holder.valor, K); a.holder.valor -= usa; if (K - usa > 0.5) retirar(K - usa); colchon += Math.max(0, a.holder.valor); a.holder.valor = 0; }
        else retirar(K);
        a.valor = K; a.tomado = true;
        alertas.push({ tipo: "ciclo_inicio", anio: t, texto: `En el año ${t} arrancas «${c.nombre}» con ${Math.round(K / 1e6).toLocaleString("es-CO")} M.` });
      }
      if (a.tomado && c.hasta < N && t === c.hasta + 1 && a.valor > 0) {
        Object.keys(canasta).forEach((k) => { canasta[k] += a.valor * mezcla[k] / 100; });
        alertas.push({ tipo: "ciclo_fin", anio: t, texto: `En el año ${t} termina «${c.nombre}»: el capital vuelve y se reparte.` });
        a.valor = 0;
      }
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
    ingSeVan.filter((x) => x.desde === t).forEach((x) => { const v = x.mensual * 12 * Math.pow(1 + gIng, t - 1); ingresos = Math.max(0, ingresos - v); if (x.pasivo) pasivo = Math.max(0, pasivo - v); });
    // Renta nueva de un activo modificado: pesos de hoy, crece con la inflación.
    const rentaPers = todos.reduce((s, a) => s + (a.rentaPct ? a.valor / (1 + a.crec) * a.rentaPct : 0), 0);
    const ingFuturo = fut.ingresos.reduce((s, x) => s + (t >= x.desde && t <= x.hasta ? x.mensual * 12 * Math.pow(1 + inf, t) : 0), 0);
    // Renta nueva por meses: si arranca en el mes 7, el año 1 recibe 6 de 12 meses.
    const fraccionAnio = (mesInicio) => Math.min(1, Math.max(0, (12 * t - n(mesInicio)) / 12));
    const rentaNueva = rentaPers + ingFuturo + todos.reduce((s, a) => s + (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * Math.pow(1 + inf, t) : 0)
      + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * Math.pow(1 + inf, t), 0), 0);
    const gastoFuturo = (fut.gastos || []).reduce((sm, x) => sm + (t >= x.desde && t <= x.hasta ? x.anual * Math.pow(1 + inf, t) : 0), 0)
      - seVan.reduce((sm, g) => sm + (t >= g.desde ? g.mensual * 12 * Math.pow(1 + gGas, t - 1) : 0), 0);
    const cuota = deuda > 0 ? Math.min(cuotaAnual, cuotaAnual * Math.max(0, aniosDeuda - (t - 1))) : 0;
    deuda = Math.max(0, deuda - cuota);
    // Ganancia de los negocios que se repiten este año.
    let cicloFlujo = 0, cicloReinv = 0;
    todos.forEach((a) => {
      const c = a.ciclo; a.cicloG = 0; if (!c || !(a.valor > 0) || t < c.desde || t > c.hasta) return;
      const G = c.gananciaAnual * Math.pow(1 + inf, t - 1);
      a.cicloG = G;
      if (c.destino === "flujo") cicloFlujo += G; else cicloReinv += G;
    });
    // 25-oct-2026 (Santiago: "cuando uno elige «se reinvierte» no deja decir
    // en qué"). La ganancia va a la inversión elegida; si no hay, al reparto E.
    todos.forEach((a) => {
      if (!a.ciclo || !(a.cicloG > 0) || a.ciclo.destino === "flujo") return;
      const id = a.ciclo.destinoId;
      const dest = id && todos.find((x) => x.id === id && !x.ciclo);
      if (dest) dest.valor += a.cicloG;
      else if (id === "c_crecimiento") canasta.crecimiento += a.cicloG;
      else if (id === "c_renta") canasta.renta += a.cicloG;
      else if (id === "c_liquidez") canasta.liquidez += a.cicloG;
      else if (id === "c_disponible") colchon += a.cicloG;
      else Object.keys(canasta).forEach((k) => { canasta[k] += a.cicloG * mezcla[k] / 100; });
    });
    if (cicloReinv > 0) creceAnio += cicloReinv;
    const cf = ingresos + rentaNueva + cicloFlujo - gastos - gastoFuturo - cuota;
    if (cf >= 0) {
      // 25-oct-2026 (Santiago: "que salga lo que sobra cada mes… me sobran al
      // mes 100 M, en qué los quiero reinvertir, poder elegir"). Lo que sobra
      // del año va a los destinos elegidos (cfg.sobraDestinos: [{id, pct}]);
      // el % que no se asigne, como lo que sobra de las ventas (mezcla).
      let restoPct = 100;
      sobraDestinos.forEach((d) => {
        const v = cf * d.pct / 100; restoPct -= d.pct;
        const dest = todos.find((x) => x.id === d.id && !x.ciclo);
        if (dest) dest.valor += v;
        else if (d.id === "c_crecimiento") canasta.crecimiento += v;
        else if (d.id === "c_renta") canasta.renta += v;
        else if (d.id === "c_liquidez") canasta.liquidez += v;
        else if (d.id === "c_disponible") colchon += v; // 25-oct-2026: «se deja disponible para cualquier eventualidad»
        else restoPct += d.pct;
      });
      if (restoPct > 0) { if (disponible) colchon += cf * restoPct / 100; else Object.keys(canasta).forEach((k) => { canasta[k] += cf * (restoPct / 100) * mezcla[k] / 100; }); }
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
    // 24-oct-2026 (Santiago: "en 5 años quiero hacer una casa propia… esa plata
    // saldrá de algunas inversiones que tengo"). Si el activo futuro dice de qué
    // inversión sale (fuenteId), se saca de ahí; lo que falte, de la liquidez.
    // Varias fuentes con su %: «50 % de BTG y 50 % de IBKR». Lo que una
    // fuente no alcance y el % que no se asigne salen de la liquidez.
    todos.forEach((a) => (a.pagos || []).forEach((pg) => {
      if (pg.anio !== t || pg.monto <= 0) return;
      let falta = pg.monto; const partes = [];
      (a.fuentesPago || []).forEach((fp) => {
        const quiero = pg.monto * fp.pct / 100; let saco = 0, nom = "";
        if (fp.id === "c_crecimiento" || fp.id === "c_renta") { const k = fp.id.slice(2); saco = Math.min(Math.max(0, canasta[k]), quiero); canasta[k] -= saco; nom = "lo que sobra reinvertido"; }
        else { const src = todos.find((y) => y.id === fp.id); if (src) {
          const antes = Math.max(0, src.valor);
          saco = Math.min(antes, quiero); src.valor -= saco; nom = src.nombre;
          // 25-oct-2026: si sacas plata de algo que te paga renta (Rapicredit),
          // su renta baja en la misma proporción; antes seguía completa.
          if (antes > 0 && saco > 0 && src.rentaAnual > 0 && !src.rentaReemplazada) {
            const fr = saco / antes, menos = src.rentaAnual * Math.pow(1 + gIng, t - 1) * fr;
            ingresos = Math.max(0, ingresos - menos); pasivo = Math.max(0, pasivo - menos); src.rentaAnual *= 1 - fr;
            if (menos > 0.5) alertas.push({ tipo: "renta_baja", anio: t, texto: `Desde el año ${t + 1}, ${src.nombre} renta ${Math.round(menos / 12 / 1e6).toLocaleString("es-CO")} M menos al mes porque sacaste plata de ahí.` });
          }
        } }
        if (saco > 0) { falta -= saco; partes.push(`${Math.round(saco / 1e6).toLocaleString("es-CO")} M de ${nom}`); }
      });
      if (falta > 0.5) retirar(falta);
      a.valor += pg.monto;
      alertas.push({ tipo: "pago_futuro", anio: t, texto: partes.length ? `En el año ${t} pagas ${a.nombre}: ${partes.join(" y ")}${falta > 0.5 ? ", y el resto de tu liquidez" : ""}.` : `En el año ${t} pagas parte de ${a.nombre} con tu liquidez.` });
    }));
    // Inversión adicional (pesos de ese año): pasa de tu liquidez al activo. No cambia el patrimonio.
    todos.forEach((a) => {
      (a.aportesFuturos || []).forEach((x) => {
        if (x.anio !== t) return;
        if (x.apartado != null) {
          // Lo apartado de las ventas entra ahora; lo que falte, de tu liquidez.
          const usa = Math.min(a.reserva || 0, x.monto);
          a.reserva = (a.reserva || 0) - usa;
          if (x.monto - usa > 0.5) retirar(x.monto - usa);
        } else if (!x.nuevo) retirar(x.monto);
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
    // Salto de valor al terminar una obra o al recibir lo que se construye
    // (Santiago: "hay activos que se valorizan al momento de la construcción
    // de forma muy alta y después cada año"). Desde ahí sigue su % anual.
    todos.forEach((a) => (a.saltos || []).forEach((sx) => {
      if (sx.t !== t || !(sx.valor > a.valor)) return;
      alertas.push({ tipo: "valorizacion_obra", anio: t, texto: `En el año ${t} ${a.nombre} queda valiendo ${Math.round(sx.valor / 1e6).toLocaleString("es-CO")} M al terminar.` });
      a.valor = sx.valor;
    }));
    if (canasta.crecimiento > 0) expUSD = true;
    const liquidez = colchon + canasta.liquidez + todos.filter((a) => a.clase === "liquido").reduce((s, a) => s + a.valor, 0);
    const deflactor = Math.pow(1 + inf, t);
    const activosT = valorTotal();
    const f = { anio: t, ingresos: ingresos + rentaNueva + cicloFlujo, rentaNueva, cicloFlujo, cicloReinv, gastos: gastos + gastoFuturo + cuota, gastoFuturo, cf, activos: activosT, invertible: invertible(), deuda: deuda + deudaUnica, liquidez, deflactor };
    // Lo que produce el patrimonio este año: renta que llega a la cuenta + lo que crece invertido.
    f.rentas = pasivo + rentaNueva + cicloFlujo; f.laboral = Math.max(0, ingresos - pasivo); f.crece = creceAnio; f.produce = f.rentas + creceAnio;
    const fr = Math.pow(1 + gIng, t - 1);
    f.porActivo = [
      ...todos.map((a) => {
        const rentaBase = a.rentaReemplazada ? 0 : (a.rentaAnual || 0) * fr;
        const rentaExtra = (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * Math.pow(1 + inf, t) : 0) + (a.rentasExtra || []).reduce((s2, x) => s2 + x.anual * fraccionAnio(x.desdeMes) * Math.pow(1 + inf, t), 0) + (a.rentaPct ? a.valor / (1 + (a.crec || 0)) * a.rentaPct : 0);
        const cg = a.ciclo ? a.cicloG || 0 : 0;
        return { id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor + (a.reserva || 0), renta: rentaBase + rentaExtra + (a.ciclo && a.ciclo.destino === "flujo" ? cg : 0), crece: (a.creceT || 0) + (a.ciclo && a.ciclo.destino !== "flujo" ? cg : 0) };
      }),
      { id: "c_liquidez", nombre: "Liquidez y colchón", clase: "canasta", valor: colchon + canasta.liquidez, renta: 0, crece: creceCan.colchon + creceCan.liquidez },
      { id: "c_renta", nombre: "Renta fija (lo que sobra)", clase: "canasta", valor: canasta.renta, renta: 0, crece: creceCan.renta },
      { id: "c_crecimiento", nombre: "Crecimiento (lo que sobra)", clase: "canasta", valor: canasta.crecimiento, renta: 0, crece: creceCan.crecimiento },
    ].filter((x) => Math.abs(x.valor) > 0.5 || x.renta > 0.5);
    // 24-oct-2026 (Santiago: "no me queda claro qué son otras rentas y se ve un
    // valor grande"). Las rentas que no están ligadas a un activo (PACAMANA,
    // dividendos, fees de renta) y los ingresos futuros se nombran una a una.
    f.rentasSueltas = [
      ...ingresosHoy.filter((x) => x.pasivo && !(x.activoId && (bOp.rentaNetaPorActivo || {})[x.activoId] != null) && !ingSeVan.some((y) => y.key === x.key && y.desde <= t))
        .map((x) => ({ id: "ing_" + x.key, nombre: x.nombre, clase: "ingreso", valor: 0, renta: x.mensual * 12 * Math.pow(1 + gIng, t - 1), crece: 0 })),
      ...fut.ingresos.map((x, k) => ({ id: "fut_" + k, nombre: x.nombre, clase: "ingreso", valor: 0, renta: t >= x.desde && t <= x.hasta ? x.mensual * 12 * Math.pow(1 + inf, t) : 0, crece: 0 })),
    ].filter((x) => x.renta > 0.5);
    f.patrimonio = activosT - deuda - deudaUnica;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.ingresosReal = (ingresos + rentaNueva + cicloFlujo) / deflactor; // incluye la renta nueva (bodega, ingresos futuros)
    f.gastosReal = f.gastos / deflactor;
    if (liquidez < 0 || todos.some((a) => a.valor < 0)) alertas.push({ tipo: "activo_negativo", anio: t, texto: `En el año ${t} un activo o tu liquidez queda en negativo.` });
    else if (obAnual > 0 && liquidez < metaColchon) alertas.push({ tipo: "liquidez_baja", anio: t, texto: `En el año ${t} tu liquidez cubre menos de ${sup.colchonMeses} meses de gastos.` });
    filas.push(f);
  }
  const fin = filas[filas.length - 1];
  // 24-oct-2026 (Santiago: "no me dan los números"). Lo que entra y lo que
  // sale en el AÑO 1, partida por partida, al mes (como su plan SALEM: «Lo que
  // entra cada mes» / «Lo que sale cada mes»). Sale de las mismas reglas del
  // motor; si algo no se puede atribuir a una partida, queda como «Ajustes»
  // para que la suma siempre cuadre con la proyección.
  const desglose = (() => {
    const f1 = filas[1]; if (!f1) return { entra: [], sale: [] };
    const fxI = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trm : 1);
    const mesDe = (x, campo = "mensual") => montoPromedioMensual({ ...x, mensual: n(x?.[campo]) * fxI(x) });
    const sigue = (x) => x && x.sim !== false && !(x.activoId && vendidosIds.has(x.activoId));
    const conRenta = new Set(Object.keys(bOp.rentaNetaPorActivo || {}));
    const nombreActivo = (id) => { const a = (user.inv || []).find((y) => y.id === id); return a ? a.n || a.nombre : "un activo"; };
    const entra = [];
    (user.ingresos || []).filter((i, k) => sigue(i) && !fuera.has(`i:${k}`) && !ingSeVan.some((x) => x.key === `i:${k}` && x.desde <= 1)).forEach((i) => {
      if (i.activoId && conRenta.has(i.activoId) && tipoIngreso(i) === "pasivo") return; // va como renta neta del activo
      const v = mesDe(i); if (v > 0.5) entra.push({ nombre: i.nombre || i.categoria || "Ingreso", mensual: v, nota: tipoIngreso(i) === "pasivo" ? "renta · de tu página Ingresos" : "trabajo · de tu página Ingresos" });
    });
    activos.filter((a) => a.rentaCorregida && a.rentaAnual > 0).forEach((a) => entra.push({ nombre: `Renta de ${a.nombre}`, mensual: a.rentaAnual / 12 * Math.pow(1 + gIng, 0), nota: "la corregiste en el paso Hoy" }));
    Object.entries(bOp.rentaNetaPorActivo || {}).forEach(([id, v]) => { const a = activos.find((x) => x.id === id); if (a?.rentaReemplazada || a?.rentaCorregida) return; if (v > 0.5) { const br = (bOp.rentaPorActivo || {})[id] || v, mm = (x) => `$${(Math.round(x / 1e5) / 10).toLocaleString("es-CO")}M`;
      // 24-oct-2026 (Santiago: "Rapicredit me da el 21 % de 3.288 M"): se muestra la cuenta, no solo el neto.
      entra.push({ nombre: `Renta de ${nombreActivo(id)}`, mensual: v, nota: br - v > 0.5 ? `${mm(br)} de renta − ${mm(br - v)} de gastos ligados en Egresos` : "renta de tu página Ingresos" }); } });
    const ff = 1 + inf;
    todos.forEach((a) => {
      const p0 = (filas[0].porActivo || []).find((x) => x.id === a.id);
      if (a.rentaPct) { const v = (p0 ? p0.valor : a.valor) * a.rentaPct / 12; if (v > 0.5) entra.push({ nombre: a.nombre, mensual: v, nota: `${(a.rentaPct * 100).toFixed(1).replace(".", ",")} % al año que te llega` }); }
      const frac = (m) => Math.min(1, Math.max(0, (12 - n(m)) / 12));
      if (a.rentaNuevaAnual > 0 && frac(a.rentaDesdeMes) > 0) entra.push({ nombre: `${a.nombre} (renta nueva)`, mensual: a.rentaNuevaAnual * frac(a.rentaDesdeMes) * ff / 12, nota: n(a.rentaDesdeMes) > 0 ? `desde el mes ${n(a.rentaDesdeMes)}` : "" });
      (a.rentasExtra || []).forEach((x) => { if (frac(x.desdeMes) > 0) entra.push({ nombre: `${a.nombre} (renta nueva)`, mensual: x.anual * frac(x.desdeMes) * ff / 12, nota: n(x.desdeMes) > 0 ? `desde el mes ${n(x.desdeMes)}; promedio del año 1` : "" }); });
    });
    fut.ingresos.filter((x) => x.desde <= 1 && x.hasta >= 1).forEach((x) => entra.push({ nombre: x.nombre, mensual: x.mensual * ff, nota: "ingreso futuro" }));
    ciclos.filter((c) => c.destino === "flujo" && c.desde <= 1).forEach((c) => entra.push({ nombre: c.nombre, mensual: c.gananciaAnual / 12, nota: "ganancia del negocio que se repite" }));
    const sale = [];
    Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).filter(sigue).forEach((g) => {
      if (g.activoId && conRenta.has(g.activoId)) return; // ya restado de la renta de su activo
      const v = montoPromedioMensual(g) * fxI(g); const key = `${cat}::${(items || []).indexOf(g)}`;
      if (fuera.has(key)) return;
      if (seVan.some((x) => x.key === key && x.desde <= 1)) return;
      if (v > 0.5) sale.push({ nombre: g.c || g.n || g.nombre || cat, mensual: v, nota: (g.c || g.n || g.nombre) ? cat : "" }); }));
    deudasVivas.filter((d) => d && d.sim !== false && !esUnica(d)).forEach((d) => { const v = montoPromedioMensual({ ...d, mensual: n(d.pg ?? d.pago) * fxI(d) }); if (v > 0.5) sale.push({ nombre: `Cuota ${d.n || d.nombre || "deuda"}`, mensual: v, nota: "deuda" }); });
    (fut.gastos || []).filter((x) => x.desde <= 1 && x.hasta >= 1).forEach((x) => sale.push({ nombre: x.nombre, mensual: x.anual * ff / 12, nota: "gasto futuro" }));
    const cuadra = (lista, total) => { const s = lista.reduce((t, x) => t + x.mensual, 0); const dif = total - s; if (Math.abs(dif) > Math.max(1, total * 0.005)) lista.push({ nombre: "Ajustes (crecimiento del año, cuotas que terminan, costos)", mensual: dif, nota: "" }); return lista.sort((a, b) => b.mensual - a.mensual); };
    // Lo que rinde y NO te llega al mes (se reinvierte): BTG, IBKR, fondos…
    const reinvierte = (filas[1].porActivo || []).map((x) => { const a = todos.find((y) => y.id === x.id); return a && a.clase !== "inmueble" && a.clase !== "vehiculo" && (x.crece || 0) > 0.5 && !(a.rentaPct > 0) && !(a.rentaAnual > 0) ? { id: a.id, nombre: a.nombre, mensual: x.crece / 12, pct: (a.crec || 0) * 100 } : null; }).filter(Boolean).sort((a, b) => b.mensual - a.mensual);
    return { entra: cuadra(entra, f1.ingresos / 12), sale: cuadra(sale, f1.gastos / 12), reinvierte };
  })();
  // Cómo queda repartida la plata al final, inversión por inversión.
  const defl = fin.deflactor || 1;
  const repartoFinal = [
    ...todos.filter((a) => Math.abs(a.valor) > 0.5).map((a) => ({ id: a.id, nombre: a.nombre, clase: a.clase, valor: a.valor, valorReal: a.valor / defl })),
    ...[["colchon", "Colchón de liquidez", colchon], ["liquidez", "Canasta liquidez", canasta.liquidez], ["renta", "Canasta renta", canasta.renta], ["crecimiento", "Canasta crecimiento", canasta.crecimiento]]
      .filter(([, , v]) => Math.abs(v) > 0.5).map(([id, nombre, v]) => ({ id, nombre, clase: "canasta", valor: v, valorReal: v / defl })),
  ].sort((x, y) => y.valor - x.valor);
  return {
    escenario: esc, mezcla, filas, alertas, liqAgotadaAnio,
    bolsaDetalle: { reservado: reservadoTotal, usos: [...usos, ...personalizadas.filter((c) => !c.holder).map((c) => ({ seccion: "C", nombre: c.nombre, monto: c.monto, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: c.anio, fuente: "liquidez" })), ...ciclos.filter((c) => c.desde > 1 && !(c.fuente === "venta" && vendidoTotal > 0.5)).map((c) => ({ seccion: "D", nombre: c.nombre, monto: c.capital, deVenta: 0, deCuentas: 0, deNuevo: 0, anio: c.desde, fuente: c.fuente }))], excesoVentas, excesoCubierto, ciclos: ciclosTotal, vendido: vendidoTotal, deudas: deudasPagadasTotal, deudaSinCubrir, colchon: colchonInicial, reinvertido: reinvertidoTotal, nuevas: nuevasTotal, restante: bolsa, pedido: pedidoTotal, obras: obrasTotal, obrasPedido, capitalNuevo, programadas: programadasTotal, pendienteAnio1, desdeLiquidez, faltante: Math.max(0, pedidoTotal - reinvertidoTotal - nuevasTotal - ciclosTotal - reservadoTotal) },
    reparto: repartoFinal,
    desglose,
    gastosHoy, seVan, ingresosHoy, ingSeVan,
    vendidos: (b.inv || []).filter((x) => vendidos.has(x.id)).map((x) => ({ id: x.id, nombre: x.n || x.nombre || "Activo", valor: n(x.va) * fxA(x) })),
    reinversionesDetalle,
    ciclosDetalle,
    nuevasDetalle: [...nuevas.filter((x) => x.clase !== "ciclo" && !x.apartadoDe).map((x) => ({ id: x.id, nombre: x.nombre, monto: x.montoInicial ?? 0, anio: 1, rendPct: ((x.crec || 0) + (x.rentaPct || 0)) * 100, pagaRenta: (x.rentaPct || 0) > 0, fuente: x.fuente })), ...personalizadas.map((c) => ({ nombre: c.nombre, monto: c.monto, anio: c.anio, rendPct: c.rendNom * 100, pagaRenta: c.pagaRenta, fuente: "liquidez" }))],
    futuros: fut,
    modificados: activos.filter((a) => modInfo[a.id]).map((a) => ({ id: a.id, ...modInfo[a.id] })),
    deudas: deudas.map(({ id, nombre, saldo, activoId, porVenta, pagar, pagado }) => ({ id, nombre, saldo, activoId, porVenta, pagar, pagado })),
    cuotasQueSalenMes: Math.max(0, b.sd - bDeuda.sd),
    hoy: { patrimonio: b.patrimonioNeto, ingresoMensual: b.ia + b.ip, salidaMensual: b.ob, flujoMensual: b.fl, liquidos: b.liquidos, colchonMeses: b.colchonMeses },
    activos: activos.map(({ id, nombre, clase, usd }) => ({ id, nombre, clase, usd })),
    // Inversiones de las que puede salir plata más adelante (casa propia, obras).
    fuentes: [...activos.filter((a) => a.clase !== "vehiculo" && a.clase !== "inmueble").map((a) => ({ id: a.id, nombre: a.nombre })), ...nuevas.map((x) => ({ id: x.id, nombre: x.nombre })), ...personalizadas.map((c) => ({ id: c.id, nombre: c.nombre })), ...(filas[0].porActivo || []).filter((x) => x.id === "c_crecimiento" || x.id === "c_renta").map((x) => ({ id: x.id, nombre: x.nombre }))],
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
    const def = ["inmueble", "vivienda", "lote"].includes(x.clase) ? (1 + inf) * (1 + n(sup.presets.fincaRaiz.valorizacionSpread) / 100) - 1 : (1 + inf) * (1 + n(sup.otrosRealSpread) / 100) - 1;
    return { nombre: String(x.nombre || "").trim() || "Activo futuro", clase: ["inmueble", "vivienda", "lote"].includes(x.clase) ? "inmueble" : "otro", vivienda: x.clase === "vivienda", tipo: x.clase || "inmueble", fuentesPago: leerFuentesPago(x), valorAlTerminar: Math.max(0, n(x.valorAlTerminar)), entrega, pagos,
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
// 25-oct-2026 (Santiago: "modifico algunas inversiones y no resta"). Un mismo
// activo podía quedar dos veces en reinversiones (una de la migración de «Se
// modifica» o de una versión anterior): la pantalla edita la primera y el
// cálculo sumaba también la escondida. Vale una por activo: la que se ve.
export function unaPorActivo(lista = []) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter((r) => {
    if (!r || !r.activoId) return false;
    if (vistos.has(r.activoId)) return false;
    vistos.add(r.activoId); return true;
  });
}
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
  const ya = new Set((cfg.reinversiones || []).map((r) => r && r.activoId));
  const lista = unaPorActivo([...(cfg.reinversiones || []), ...extra.filter((x) => !ya.has(x.activoId))]);
  if (!cambio) return lista.length === (cfg.reinversiones || []).length ? cfg : { ...cfg, reinversiones: lista };
  return { ...cfg, decisiones: nuevasDec, reinversiones: lista };
}


/**
 * 24-oct-2026 (Santiago: "visualizar así los planes, es una nota… tiene un
 * resumen muy bueno en cada tarjeta"). Resumen corto de un escenario para su
 * tarjeta, armado con lo que decidió: qué vende, en qué pone la plata y qué
 * empieza después. El usuario puede escribir el suyo; este es el de respaldo.
 */
export function resumenEscenario(r) {
  if (!r) return "";
  const corto = (v) => `$${Math.round(Math.abs(Number(v) || 0) / 1e6).toLocaleString("es-CO")}M`;
  const partes = [];
  if ((r.vendidos || []).length) partes.push(`Vende ${r.vendidos.map((v) => v.nombre).join(" y ")}`);
  const inv = [...(r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => ({ n: x.nombre, v: x.aporte })), ...(r.nuevasDetalle || []).map((x) => ({ n: x.nombre, v: x.monto }))].sort((a, b) => b.v - a.v);
  if (inv.length) partes.push(inv.slice(0, 2).map((x) => `${x.n} ${corto(x.v)}`).join(" + "));
  (r.ciclosDetalle || []).forEach((c) => partes.push(`${c.nombre} ${corto(c.capital)} cada ${c.meses === 12 ? "año" : c.meses + " meses"}`));
  const pagadas = (r.deudas || []).filter((d) => d.pagado > 0);
  if (pagadas.length) partes.push(pagadas.length === 1 ? `paga ${pagadas[0].nombre}` : `paga ${pagadas.length} deudas`);
  const fut = r.futuros || { ingresos: [] };
  if ((fut.ingresos || []).length) partes.push(`${fut.ingresos[0].nombre} desde el año ${fut.ingresos[0].desde}`);
  if (!partes.length) return "Todo sigue como está hoy.";
  const t = partes.join(" · ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}


/** Fuentes de pago de una compra futura: [{id, pct}] (compatibilidad: fuenteId = 100 %). */
export function leerFuentesPago(x = {}) {
  // 24-oct-2026 (Santiago: "voy a comprarla con la plata de esto y esto, y el
  // valor que voy a retirar de cada una"). Cada fuente puede decir un monto en
  // pesos; se convierte a % del valor total para repartir cada pago.
  const total = Number(x.valor) || 0;
  const conv = (f) => (f && f.monto != null && f.monto !== "" && total > 0 ? { id: f.id, pct: Math.min(100, (Number(f.monto) || 0) / total * 100) } : f);
  const lista = (Array.isArray(x.fuentes) ? x.fuentes : x.fuenteId ? [{ id: x.fuenteId, pct: 100 }] : []).map(conv);
  let usado = 0;
  return lista.filter((f) => f && f.id).map((f) => { const p = Math.max(0, Math.min(100 - usado, Number(f.pct) || 0)); usado += p; return { id: f.id, pct: p }; }).filter((f) => f.pct > 0);
}

// ── Lo que se va con una venta ─────────────────────────────────────────────
// 24-oct-2026 (Santiago: "aparecen rentas que ya no van" — Puerto Madero y
// Orlando vendidos seguían con su renta porque en Ingresos no estaban
// vinculadas al activo). Ingresos de renta y gastos sin vínculo cuyo nombre
// lleva una palabra propia del activo (Orlando, Madero…) se sugieren; el
// usuario confirma o corrige en Decide. Claves: ingresos "i:<índice>",
// gastos "<categoría>::<índice>" (las mismas de «Gastos que se acaban»).
const GENERICAS = new Set(["renta", "rentas", "local", "locales", "apto", "apartamento", "casa", "lote", "bodega", "oficina", "finca", "cuenta", "fondo", "credito", "inversion", "inversiones", "arriendo", "edificio", "proyecto", "tradicional", "airbnb", "acciones", "unidad"]);
const sinTilde = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function sugerirVinculados(user = {}, activoId) {
  const a = (user.inv || []).find((x) => x && x.id === activoId);
  const out = { auto: { ingresos: [], gastos: [] }, ingresos: [], gastos: [] };
  if (!a) return out;
  const toks = sinTilde(a.n || a.nombre).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERICAS.has(t));
  const pega = (txt) => toks.length > 0 && toks.some((t) => sinTilde(txt).includes(t));
  // Vínculo a un activo que ya no existe = sin vínculo (pasa con activos borrados y recreados).
  const existe = new Set((user.inv || []).filter(Boolean).map((x) => x.id));
  const suelto = (x) => !x.activoId || !existe.has(x.activoId);
  (user.ingresos || []).forEach((i, k) => {
    if (!i || i.sim === false) return;
    const nombre = i.nombre || i.categoria || "Ingreso", item = { key: `i:${k}`, nombre, mensual: montoPromedioMensual(i), moneda: i.moneda };
    if (i.activoId === activoId) out.auto.ingresos.push(item);
    else out.ingresos.push({ ...item, sugerido: suelto(i) && pega(`${nombre} ${i.categoria || ""}`) });
  });
  Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g, idx) => {
    if (!g || g.sim === false) return;
    const nombre = g.c || g.n || g.nombre || cat, item = { key: `${cat}::${idx}`, nombre, cat, mensual: montoPromedioMensual(g), moneda: g.moneda };
    if (g.activoId === activoId) out.auto.gastos.push(item);
    else out.gastos.push({ ...item, sugerido: suelto(g) && pega(nombre) });
  }));
  return out;
}
/** Claves de ingresos/gastos sin vínculo que se van con las ventas del escenario. */
export function vinculadosQueSeVan(user = {}, cfg = {}, vendidosIds) {
  const ids = vendidosIds || new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  const fuera = new Set();
  ids.forEach((id) => {
    const d = (cfg.decisiones || {})[id] || {};
    const sug = sugerirVinculados(user, id);
    const elegidos = Array.isArray(d.seVan) ? d.seVan : [...sug.ingresos, ...sug.gastos].filter((x) => x.sugerido).map((x) => x.key);
    elegidos.forEach((k) => fuera.add(k));
  });
  return fuera;
}

// ── Montos para el plan ────────────────────────────────────────────────────
// 24-oct-2026 (Santiago: "Rapicredit me da el 21 % de 3.288 M… veo que carga
// promedios de otro lado"). Ingresos y Egresos guardan la vigencia del AÑO EN
// CURSO (Rapicredit paga de julio a diciembre → desdeMes 7) y el promedio de
// este año la reparte en 12 meses: 57,5 M quedaban como 28,7 M y así seguían
// los 10 años. Para proyectar, un concepto mensual cuenta su monto completo y
// un pago anual ya hecho este año vuelve a contar; si algo se acaba, se apaga
// en «Ingresos / Gastos que se acaban».
const sinVigencia = (x) => {
  if (!x || typeof x !== "object") return x;
  const f = x.frecuencia || "mensual";
  const out = { ...x };
  if (f === "mensual" && (x.desdeMes || x.hastaMes)) { out._vigencia = { desde: Number(x.desdeMes) || 1, hasta: Number(x.hastaMes) || 12 }; out.desdeMes = 1; out.hastaMes = 12; }
  // Variable (un monto por mes): para proyectar se usa el promedio de los meses
  // que SÍ tienen monto, no el total del año entre 12 (si arrancó en julio,
  // repartirlo en 12 meses lo partía a la mitad).
  if (f === "variable" && Array.isArray(x.montosMensuales)) {
    const reales = x.montosMensuales.map((v) => Number(v) || 0).filter((v) => v > 0);
    if (reales.length && reales.length < 12) { out._vigencia = { variable: true, meses: reales.length }; out.frecuencia = "mensual"; out.mensual = reales.reduce((s2, v) => s2 + v, 0) / reales.length; out.desdeMes = 1; out.hastaMes = 12; delete out.montosMensuales; }
  }
  if (x.pagos) delete out.pagos;
  return out;
};
export function paraPlan(user = {}) {
  if (user._paraPlan) return user;
  const g = user.gastos || user.gas;
  const gN = g ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, (v || []).map(sinVigencia)])) : g;
  return { ...user, _paraPlan: true, ingresos: (user.ingresos || []).map(sinVigencia), ...(user.gastos ? { gastos: gN } : {}), ...(user.gas ? { gas: gN } : {}) };
}

/** Cada inversión hoy: cuánto vale y cuánto renta, con de dónde sale. */
export function inversionesHoy(userIn = {}, cfg = {}) {
  const user = ajustarIngresos(paraPlan(userIn), cfg);
  const { impuestoNeto, retencionMensual, ...sinImp } = user;
  const b = calcularBase({ ...sinImp, gastos: user.gastos || user.gas }, {});
  const trm = b.trm, fx = (x) => (String(x?.moneda || x?.currency || "").toUpperCase() === "USD" ? trm : 1);
  const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const nota = (x) => x._vigencia?.variable ? `variable: promedio de los ${x._vigencia.meses} meses cargados` : x._vigencia ? `en Ingresos/Egresos va de ${MES[x._vigencia.desde]} a ${MES[x._vigencia.hasta]}; aquí cuenta el mes completo` : (x.frecuencia && x.frecuencia !== "mensual" ? `pago ${x.frecuencia}, repartido por mes` : "");
  return (user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
    const ingresos = (user.ingresos || []).filter((i) => i && i.sim !== false && i.activoId === a.id).map((i) => ({ nombre: i.nombre || i.categoria || "Ingreso", mensual: montoPromedioMensual(i) * fx(i), nota: nota(i) }));
    const gastos = []; Object.entries(user.gastos || user.gas || {}).forEach(([cat, items]) => (items || []).forEach((g) => { if (g && g.sim !== false && g.activoId === a.id) gastos.push({ nombre: g.c || g.n || g.nombre || cat, mensual: montoPromedioMensual(g) * fx(g), nota: nota(g) }); }));
    const valor = n(a.va) * fx(a), bruta = n(b.rentaPorActivo?.[a.id]), neta = n(b.rentaNetaPorActivo?.[a.id]);
    const corr = (cfg.rentaHoy || {})[a.id];
    const usada = corr != null && corr !== "" ? Math.max(0, n(corr)) : neta;
    const esc = resolverEscenario(cfg.escenario || "base", user);
    const def = crecimientoDefault(a, esc, SUPUESTOS_F10, usada * 12);
    const ch = (cfg.crecHoy || {})[a.id];
    return { crecDefaultPct: def == null ? null : def * 100, crecPct: def == null ? null : (!vacio(ch) ? n(ch) : def * 100), crecCorregido: !vacio(ch), id: a.id, nombre: a.n || a.nombre || "Activo", clase: claseActivo(a), valor, moneda: a.moneda, bruta, neta, manual: a.rentaOrigen === "manual", ingresos, gastos, corregida: corr != null && corr !== "", usada, pctAnual: valor > 0 ? usada * 12 / valor * 100 : 0, vende: (cfg.decisiones || {})[a.id]?.accion === "vende" };
  });
}

// 24-oct-2026 (Santiago: "el paso uno no solo debe editar patrimonio, también
// los ingresos como fees, rentas de otras inversiones"). En Hoy se corrige
// para el plan cuánto entra de cada ingreso (cfg.ingresoHoy: { "i:índice":
// pesos al mes }). Se reemplaza el monto y todo el motor lo usa.
function ajustarIngresos(user, cfg = {}) {
  const aj = cfg.ingresoHoy || {};
  if (!Object.keys(aj).length) return user;
  return { ...user, ingresos: (user.ingresos || []).map((i, k) => {
    const v = aj[`i:${k}`]; if (v == null || v === "" || !i) return i;
    const { montosMensuales, capital, tasa, montoModo, ...resto } = i;
    return { ...resto, mensual: Math.max(0, n(v)), moneda: "COP", frecuencia: "mensual", _corregido: true };
  }) };
}
/** Ingresos de hoy que no están ligados a una inversión (fees, salarios, rentas sueltas). */
export function ingresosSueltosHoy(userIn = {}, cfg = {}) {
  const base = paraPlan(userIn), user = ajustarIngresos(base, cfg);
  const ids = new Set((user.inv || []).filter(Boolean).map((a) => a.id));
  const trm = n(user.trm) || 4200, fx = (x) => (String(x?.moneda || "").toUpperCase() === "USD" ? trm : 1);
  const MES = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  // 25-oct-2026: lo que se va con una venta o se acaba en este plan se marca
  // (y no suma) para que el total de Hoy cuadre con lo que de verdad sigue.
  const fuera = vinculadosQueSeVan(user, cfg);
  const term = cfg.ingresosTerminan || {};
  const vendidos = new Set(Object.entries(cfg.decisiones || {}).filter(([, d]) => d?.accion === "vende").map(([id]) => id));
  return (user.ingresos || []).map((i, k) => {
    if (!i || i.sim === false || (i.activoId && ids.has(i.activoId))) return null;
    const o = base.ingresos[k];
    const enIngresos = montoPromedioMensual(o) * fx(o);
    const nota = o._vigencia?.variable ? `variable: promedio de los ${o._vigencia.meses} meses cargados` : o._vigencia ? `en Ingresos va de ${MES[o._vigencia.desde]} a ${MES[o._vigencia.hasta]}; aquí cuenta el mes completo` : (o.frecuencia && !["mensual", "variable"].includes(o.frecuencia) ? `pago ${o.frecuencia}, repartido por mes` : o.frecuencia === "variable" ? "variable: promedio de lo cargado en el año" : "");
    const key = `i:${k}`;
    const seVa = fuera.has(key) || (i.activoId && vendidos.has(i.activoId)) ? "venta" : term[key] ? "acaba" : null;
    return { key, seVa, acabaAnio: term[key] || null, nombre: i.nombre || i.categoria || "Ingreso", renta: tipoIngreso(i) === "pasivo", enIngresos, mensual: montoPromedioMensual(i) * fx(i), corregido: !!i._corregido, nota };
  }).filter(Boolean);
}

// Impuesto sobre la ganancia de un negocio que se repite (Colombia, 2026).
// Sugerencias editables, no asesoría tributaria:
//  · Persona natural, bien poseído menos de 2 años → renta ordinaria, cédula
//    general, tarifa marginal hasta 39 % (Art. 241 ET; con ingresos altos se
//    llega a la última franja).
//  · Sociedad (SAS) → tarifa general de renta 35 % (Art. 240 ET).
//  · Bien poseído 2 años o más → ganancia ocasional 15 % (Arts. 313-316 ET).
export const TARIFA_CICLO = {
  natural: { pct: 39, nombre: "Persona natural · menos de 2 años (renta)", nota: "Tarifa marginal de renta: hasta 39 %. Si tus ingresos son menores puede ser 33–37 %." },
  sociedad: { pct: 35, nombre: "Sociedad (SAS) · renta", nota: "Tarifa general de renta de sociedades: 35 %." },
  ocasional: { pct: 15, nombre: "Ganancia ocasional · 2 años o más", nota: "Si el bien se tuvo 2 años o más: ganancia ocasional al 15 %." },
  otro: { pct: 0, nombre: "Otro / ya lo incluí", nota: "Pon el % que te indique tu contador." },
};
export const regimenSugerido = (meses) => (Number(meses) >= 24 ? "ocasional" : "natural");
/** Negocios que se repiten: [{nombre, capital, valorFinal, meses, desde, hasta?, costosPct?, fuente, destino}] */
export function leerCiclos(lista = [], N = 10) {
  return (Array.isArray(lista) ? lista : []).map((x) => {
    const capital = Math.max(0, n(x.capital)), valorFinal = Math.max(0, n(x.valorFinal));
    const meses = Math.min(120, Math.max(1, Math.round(n(x.meses) || 12)));
    const desde = Math.min(N, Math.max(1, Math.round(n(x.desde) || 1)));
    const hasta = vacio(x.hasta) ? N : Math.min(N, Math.max(desde, Math.round(n(x.hasta))));
    const costosPct = Math.min(100, Math.max(0, n(x.costosPct)));
    // 25-oct-2026 (Santiago: "debe existir una franja para calcular el impuesto
    // de este tipo de negocios… que se sugiera pero se pueda editar").
    const regimen = TARIFA_CICLO[x.regimen] ? x.regimen : regimenSugerido(meses);
    const impuestoPct = vacio(x.impuestoPct) ? TARIFA_CICLO[regimen].pct : Math.min(100, Math.max(0, n(x.impuestoPct)));
    const bruta = Math.max(0, valorFinal - capital) * (1 - costosPct / 100);
    const impuestoCiclo = bruta * impuestoPct / 100;
    const gananciaCiclo = bruta - impuestoCiclo;
    return { nombre: String(x.nombre || "").trim() || "Negocio que se repite", capital, valorFinal, meses, desde, hasta, costosPct, regimen, impuestoPct, impuestoCiclo, impuestoAnual: impuestoCiclo * 12 / meses, fuente: x.fuente || "venta", destino: x.destino === "flujo" ? "flujo" : "reinvierte", destinoId: x.destinoId || null, gananciaCiclo, gananciaAnual: gananciaCiclo * 12 / meses };
  }).filter((x) => x.capital > 0 && x.valorFinal > 0);
}
