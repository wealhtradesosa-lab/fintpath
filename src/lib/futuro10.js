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
    pesimista: { nombre: "Pesimista", inflacionPct: 6, ingresosSpread: 0, gastosSpread: 1, retornoSpread: -1.5, spRealPct: 3.5 },
    base: { nombre: "Base", inflacionPct: null /* = user.inflacionPct (4%) */, ingresosSpread: 1, gastosSpread: 0, retornoSpread: 0, spRealPct: 6.5 },
    optimista: { nombre: "Optimista", inflacionPct: 3, ingresosSpread: 2, gastosSpread: 0, retornoSpread: 1, spRealPct: 8 },
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
    if (d.accion === "vende") { bolsa += valor; rentaVendida += rentaAnual; return; }
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
    activos.push({ id: a.id, nombre: a.n || a.nombre || "Activo", clase, valor, crec, usd: fxA(a) !== 1, invertible: clase !== "vehiculo",
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
  let reinvertidoTotal = 0, nuevasTotal = 0, pedidoTotal = 0, desdeLiquidez = 0, programadasTotal = 0;
  // 24-oct-2026 (Santiago: "añadí estas inversiones y cuando voy a ver el
  // resultado no se ven ahí reflejadas"). Antes una inversión solo se
  // financiaba con lo vendido: sin ventas, o si no alcanzaba, quedaba en $0 y
  // desaparecía sin aviso, mientras la pantalla decía que saldría de la
  // liquidez. Ahora toma primero de lo vendido y lo que falte sale de tus
  // cuentas líquidas de hoy. Si tampoco alcanza, se asigna hasta donde llega.
  const tomar = (monto, excluirId) => {
    let falta = Math.max(0, monto);
    const deBolsa = Math.min(bolsa, falta); bolsa -= deBolsa; falta -= deBolsa;
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
  (cfg.reinversiones || []).forEach((r) => {
    pedidoTotal += Math.max(0, n(r.monto));
    const a = activos.find((x) => x.id === r.activoId);
    if (!a || n(r.monto) <= 0) return;
    const m = tomar(n(r.monto), a.id);
    if (m > 0) { a.valor += m; reinvertidoTotal += m; }
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
        const m = tomar(c.monto);
        if (m <= 0) return;
        nuevasTotal += m;
        nuevas.push({ id: "nueva_" + k, nombre: c.nombre, clase: "nueva", valor: m, crec: c.pagaRenta ? inf : c.rendNom, rentaPct: c.pagaRenta ? c.rendNom - inf : 0, usd: c.usd, invertible: true });
        return;
      }
      programadasTotal += c.monto;
      personalizadas.push({ ...c, id: "nueva_" + k });
      return;
    }
    pedidoTotal += Math.max(0, n(x.monto));
    if (n(x.monto) <= 0 || !sup.presets[x.preset]) return;
    const m = tomar(n(x.monto));
    if (m <= 0) return;
    nuevasTotal += m;
    nuevas.push({ id: "nueva_" + k, nombre: x.nombre || sup.presets[x.preset].nombre, clase: "nueva", valor: m, crec: rNom(x.preset), usd: !!sup.presets[x.preset].usd, invertible: true });
  });
  const mezcla = normalizarMezcla(cfg.mezcla || sup.nortes[cfg.norte || "equilibrio"] || sup.nortes.equilibrio);
  ["liquidez", "renta", "crecimiento"].forEach((k) => { canasta[k] = bolsa * mezcla[k] / 100; });
  const rCan = { liquidez: rNom(sup.canastas.liquidez), renta: rNom(sup.canastas.renta), crecimiento: rNom(sup.canastas.crecimiento) };

  // ── Deuda: la cuota sigue nominal fija hasta saldar; saldo lineal ───────
  let deuda = bDeuda.deudaTotal; const cuotaAnual = bDeuda.sd * 12;
  const aniosDeuda = cuotaAnual > 0 ? deuda / cuotaAnual : 0;

  let ingresos = (b.ia + b.ip) * 12 - rentaVendida;
  let gastos = (b.ob - b.sd) * 12;
  const todos = [...activos, ...nuevas];
  const valorTotal = () => todos.reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const invertible = () => todos.filter((a) => a.invertible).reduce((s, a) => s + a.valor + (a.reserva || 0), 0) + colchon + canasta.liquidez + canasta.renta + canasta.crecimiento;
  const filas = [];
  const alertas = [];
  const fila0 = { anio: 0, ingresos, gastos: gastos + (deuda > 0 ? cuotaAnual : 0), cf: 0, activos: valorTotal(), invertible: invertible(), deuda, liquidez: colchon + canasta.liquidez + liquidosQueQuedan };
  fila0.patrimonio = fila0.activos - deuda; fila0.deflactor = 1;
  fila0.patrimonioReal = fila0.patrimonio; fila0.invertibleReal = fila0.invertible;
  filas.push(fila0);
  let liqAgotadaAnio = null;
  // ── Lo que viene: ingresos y activos que empiezan más adelante ──────────
  const fut = leerFuturos(cfg.futuros, esc, sup);
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
      todos.push({ id: c.id, nombre: c.nombre, clase: "nueva", valor: c.monto, crec: c.pagaRenta ? inf : c.rendNom, rentaPct: c.pagaRenta ? c.rendNom - inf : 0, usd: c.usd, invertible: true });
    });
    // 1) rendimientos y depreciación del año
    todos.forEach((a) => {
      if (a.entrega && t <= a.entrega) return; // se valoriza desde la entrega
      if (a.crec == null) { const p = t <= 3 ? sup.vehiculo.depAnios1a3Pct : sup.vehiculo.depDespuesPct; a.valor *= 1 + p / 100; }
      else a.valor *= 1 + a.crec;
    });
    colchon *= 1 + rCan.liquidez;
    todos.forEach((a) => { if (a.reserva > 0) a.reserva *= 1 + rCan.liquidez; });
    Object.keys(canasta).forEach((k) => { canasta[k] *= 1 + rCan[k]; });
    // 2) flujo del año (ingresos y gastos ya crecidos)
    if (t > 1) { ingresos *= 1 + gIng; gastos *= 1 + gGas; }
    // Renta nueva de un activo modificado: pesos de hoy, crece con la inflación.
    const rentaPers = todos.reduce((s, a) => s + (a.rentaPct ? a.valor / (1 + a.crec) * a.rentaPct : 0), 0);
    const ingFuturo = fut.ingresos.reduce((s, x) => s + (t >= x.desde && t <= x.hasta ? x.mensual * 12 * Math.pow(1 + inf, t) : 0), 0);
    // Renta nueva por meses: si arranca en el mes 7, el año 1 recibe 6 de 12 meses.
    const fraccionAnio = (mesInicio) => Math.min(1, Math.max(0, (12 * t - n(mesInicio)) / 12));
    const rentaNueva = rentaPers + ingFuturo + todos.reduce((s, a) => s + (a.rentaNuevaAnual > 0 ? a.rentaNuevaAnual * fraccionAnio(a.rentaDesdeMes) * Math.pow(1 + inf, t) : 0), 0);
    const cuota = deuda > 0 ? Math.min(cuotaAnual, cuotaAnual * Math.max(0, aniosDeuda - (t - 1))) : 0;
    deuda = Math.max(0, deuda - cuota);
    const cf = ingresos + rentaNueva - gastos - cuota;
    if (cf >= 0) {
      Object.keys(canasta).forEach((k) => { canasta[k] += cf * mezcla[k] / 100; });
    } else {
      retirar(-cf);
      alertas.push({ tipo: "cf_negativo", anio: t, texto: `En el año ${t} sale más de lo que entra; se usa tu liquidez.` });
    }
    // Pagos de un activo futuro: pasan de tu liquidez al activo (no cambia el patrimonio).
    todos.forEach((a) => (a.pagos || []).forEach((pg) => {
      if (pg.anio !== t || pg.monto <= 0) return;
      retirar(pg.monto); a.valor += pg.monto;
      alertas.push({ tipo: "pago_futuro", anio: t, texto: `En el año ${t} pagas parte de ${a.nombre} con tu liquidez.` });
    }));
    // Inversión adicional (pesos de ese año): pasa de tu liquidez al activo. No cambia el patrimonio.
    todos.forEach((a) => {
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
    const f = { anio: t, ingresos: ingresos + rentaNueva, rentaNueva, gastos: gastos + cuota, cf, activos: activosT, invertible: invertible(), deuda, liquidez, deflactor };
    f.patrimonio = activosT - deuda;
    f.patrimonioReal = f.patrimonio / deflactor;
    f.invertibleReal = f.invertible / deflactor;
    f.ingresosReal = (ingresos + rentaNueva) / deflactor; // incluye la renta nueva (bodega, ingresos futuros) f.gastosReal = f.gastos / deflactor;
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
    bolsaDetalle: { vendido: vendidoTotal, deudas: deudasPagadasTotal, deudaSinCubrir, colchon: colchonInicial, reinvertido: reinvertidoTotal, nuevas: nuevasTotal, restante: bolsa, pedido: pedidoTotal, obras: obrasTotal, obrasPedido, programadas: programadasTotal, desdeLiquidez, faltante: Math.max(0, pedidoTotal - reinvertidoTotal - nuevasTotal) },
    reparto: repartoFinal,
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
    rendNom: rend / 100, usd: String(x.moneda || "COP").toUpperCase() === "USD", pagaRenta: x.tipo === "renta",
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
    return { nombre: String(x.nombre || "").trim() || "Ingreso futuro", mensual: Math.max(0, n(x.mensual)), desde, hasta: vacio(x.hasta) ? 99 : Math.max(desde, anio(x.hasta)), titular: x.titular || null };
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
  return { ingresos, activos };
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
