// ═══════════════════════════════════════════════════════════════════════════
// ahorroBTC.js — Motor de la sección "Ahorro en Bitcoin" (Colombia).
//
// 04-nov-2026 (Santiago: "uno arranca como perdido, no sabe por dónde empezar,
// de una vez te muestra valores sin haber iniciado"). La sección se rehízo como
// un paso a paso; el cálculo sale del componente para poder probarlo.
//
// Unidades: el usuario aporta en pesos; el bitcoin se compra en dólares al
// precio proyectado de cada mes. El resultado se muestra en PESOS DE HOY
// (descontando la inflación del dólar) para poder ponerlo al lado de una
// pensión, que también se expresa en pesos de hoy. Antes se comparaban dólares
// nominales de dentro de N años con una mesada de hoy.
// ═══════════════════════════════════════════════════════════════════════════

// Referencias rápidas para elegir el crecimiento (el usuario escribe el suyo).
export const ESCENARIOS_BTC = [
  { id: "conservador", nombre: "Conservador", cagr: 5 },
  { id: "moderado", nombre: "Moderado", cagr: 10 },
  { id: "optimista", nombre: "Optimista", cagr: 20 },
];

// ── Escenarios con crecimiento que baja (9-nov-2026) ─────────────────────────
// Santiago: "¿cómo podemos poner escenarios que sí sean realistas?". Con una
// tasa fija por 30-40 años (35 % y luego 20 %) la herencia daba US$163 millones
// porque 1 BTC terminaba en US$40-920 millones. Ningún activo crece igual por
// décadas: el bitcoin creció ~70 %/año sus primeros 10 años y ~25 % los últimos
// 5. Cada escenario arranca en r0 y la parte por encima de la tasa madura (rt)
// se reduce a la mitad cada 4 años (el ciclo de halving). Es un modelo, no una
// predicción; los tres quedan muy por debajo del techo de RIQUEZA_MUNDIAL_USD.
export const ESCENARIOS_CURVA = [
  { id: "prudente", nombre: "Prudente", r0: 15, rt: 3 },
  { id: "base", nombre: "Base", r0: 25, rt: 5 },
  { id: "optimista", nombre: "Optimista", r0: 40, rt: 6 },
];
export const MEDIA_VIDA_AÑOS = 4;
export const CAIDA_ESTRES = 0.6; // caída del 60 % el año en que empieza el retiro

/** Tasa (%) del año `y` contado desde hoy (y = 1 es el primer año). */
export function tasaCurva(curva, y) {
  if (curva.tasaFn) return curva.tasaFn(Math.max(1, y));
  return curva.rt + (curva.r0 - curva.rt) * Math.pow(0.5, (Math.max(1, y) - 1) / MEDIA_VIDA_AÑOS);
}
/**
 * Trayectoria del precio: f(mes) = cuántas veces el precio de hoy vale en el mes
 * `mes` contado desde hoy. Con `curva` la tasa cambia año a año; sin ella usa `cagr` fijo.
 */
export function trayectoria({ curva = null, cagr = 0 } = {}) {
  if (!curva) { const g = (Number(cagr) || 0) / 100; return { f: (mes) => Math.pow(1 + g, mes / 12), tasa: () => Number(cagr) || 0 }; }
  const cache = [1];
  const f = (mes) => {
    const m = Math.max(0, mes);
    const y = Math.floor(m / 12);
    while (cache.length <= y) { const k = cache.length; cache.push(cache[k - 1] * (1 + tasaCurva(curva, k) / 100)); }
    const resto = m - y * 12;
    return cache[y] * Math.pow(1 + tasaCurva(curva, y + 1) / 100, resto / 12);
  };
  return { f, tasa: (y) => tasaCurva(curva, y) };
}
/** Precio máximo «realista» de 1 BTC: todos los BTC juntos ≤ 25 % de la riqueza mundial. */
export const PRECIO_TECHO_REALISTA = (0.25 * 450e12) / 21e6;

export const INFLACION_USD = 3;      // % anual, para traer el resultado a pesos de hoy
export const RETIRO_DEFAULT = 4;     // % anual que se retira del capital
export const OFERTA_BTC = 21e6;
export const RIQUEZA_MUNDIAL_USD = 450e12;

/**
 * @param {object} p
 * @param {"mensual"|"anual"|"unico"} p.frecuencia
 * @param {number} p.monto     aporte en COP por periodo (o el único)
 * @param {number} p.años
 * @param {number} p.cagr      crecimiento anual del precio en USD, %
 * @param {number} p.precioHoy precio del BTC en USD
 * @param {number} p.trm       COP por USD (constante: todo en pesos de hoy)
 */
export function simularAhorroBTC({ frecuencia = "mensual", monto, años, cagr, curva = null, precioHoy, trm, retiroPct = RETIRO_DEFAULT, inflacionUSD = INFLACION_USD }) {
  const m = Math.max(0, Number(monto) || 0);
  const n = Math.max(0, Math.round(Number(años) || 0));
  const g = (Number(cagr) || 0) / 100;
  const p0 = Number(precioHoy) || 0;
  const tc = Number(trm) || 0;
  if (!m || !n || !p0 || !tc) return null;

  const tr = trayectoria({ curva, cagr: g * 100 });
  const precioEn = (mes) => p0 * tr.f(mes);
  const deflactor = (año) => Math.pow(1 + inflacionUSD / 100, año);
  let btc = 0;
  let invertido = 0;
  const serie = [];

  if (frecuencia === "unico") { btc += m / tc / p0; invertido += m; }
  for (let y = 1; y <= n; y++) {
    if (frecuencia === "mensual") {
      for (let k = 1; k <= 12; k++) { btc += m / tc / precioEn((y - 1) * 12 + k); invertido += m; }
    } else if (frecuencia === "anual") {
      btc += m / tc / precioEn((y - 1) * 12 + 1); invertido += m;
    }
    const precio = precioEn(y * 12);
    serie.push({ año: y, btc, invertido, valorCOPHoy: (btc * precio / deflactor(y)) * tc });
  }

  const precioFinal = precioEn(n * 12);
  const valorUSD = btc * precioFinal;
  const valorCOPHoy = (valorUSD / deflactor(n)) * tc;
  const retiroMes = valorCOPHoy * (retiroPct / 100) / 12;
  const capMercadoUSD = precioFinal * OFERTA_BTC;
  return {
    btc, invertido, precioFinal, valorUSD, valorCOPHoy, retiroMes, retiroPct,
    multiplo: invertido > 0 ? valorCOPHoy / invertido : 0,
    estres50: retiroMes * 0.5, estres70: retiroMes * 0.3,
    capMercadoUSD,
    // Señal de escenario irreal: el bitcoin valdría más que una fracción grande
    // de toda la riqueza del planeta.
    irreal: capMercadoUSD > RIQUEZA_MUNDIAL_USD * 0.25,
    serie,
  };
}

/** Los tres escenarios con los mismos aportes. */
export function escenariosAhorroBTC(base) {
  return ESCENARIOS_BTC.map((e) => ({ ...e, r: simularAhorroBTC({ ...base, cagr: e.cagr }) }));
}

/**
 * Pensión con la que se compara, en promedio mensual con 13 mesadas.
 * fuente: "calculada" (guardada desde Pensiones), "manual" (ya pensionado o la
 * conoce) o "ninguna".
 */
export function pensionParaComparar({ fuente, calculada, manual }) {
  if (fuente === "calculada" && calculada?.neta > 0) return { mesada: calculada.neta, promedioMes: calculada.neta * 13 / 12, origen: "calculada" };
  if (fuente === "manual" && Number(manual) > 0) return { mesada: Number(manual), promedioMes: Number(manual) * 13 / 12, origen: "manual" };
  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// 04-nov-2026 (Santiago: "se perdió mucho en las proyecciones: antes teníamos lo
// que pasó con el BTC en los últimos 10 años y lo que se proyectaba; cuántos BTC
// faltan por minar y cuántos hay; los escenarios fijos no me gustan, que uno
// pueda decir 25 % o 30 %; poder retirar 10 % o 20 % y ver cuánto queda
// heredable; comparar pensión vs BTC dejando claro qué se hereda").
// ═══════════════════════════════════════════════════════════════════════════

// Cierre anual en USD (CoinMarketCap vía StatMuse; coincide ±1 % con Yahoo).
export const HISTORICO_BTC = [
  { año: 2015, cierre: 430.57 }, { año: 2016, cierre: 963.74 }, { año: 2017, cierre: 14156.40 },
  { año: 2018, cierre: 3742.70 }, { año: 2019, cierre: 7193.60 }, { año: 2020, cierre: 29001.72 },
  { año: 2021, cierre: 46306.45 }, { año: 2022, cierre: 16547.50 }, { año: 2023, cierre: 42265.19 },
  { año: 2024, cierre: 93429.20 }, { año: 2025, cierre: 87508.83 },
];
export const FUENTE_HISTORICO = "Cierres anuales de CoinMarketCap (StatMuse), en dólares";

/** Lista con la variación de cada año. */
export function historicoConVariacion() {
  return HISTORICO_BTC.map((h, i) => ({ ...h, variacion: i ? (h.cierre / HISTORICO_BTC[i - 1].cierre - 1) * 100 : null }));
}

/** Crecimiento anual compuesto de los últimos `n` años cerrados. */
export function cagrHistorico(n) {
  const fin = HISTORICO_BTC[HISTORICO_BTC.length - 1];
  const ini = HISTORICO_BTC[HISTORICO_BTC.length - 1 - n];
  if (!ini) return null;
  return (Math.pow(fin.cierre / ini.cierre, 1 / n) - 1) * 100;
}

// ── Oferta: cuántos BTC hay y cuántos faltan (se deriva de la altura de bloque) ──
export const BLOQUES_POR_HALVING = 210_000;
const ALTURA_REF = { altura: 840_000, fecha: Date.UTC(2024, 3, 20) }; // 4.º halving
/** Altura estimada a una fecha (≈144 bloques al día) si no se pudo consultar. */
export function alturaEstimada(fecha = Date.now()) {
  return Math.round(ALTURA_REF.altura + ((fecha - ALTURA_REF.fecha) / 86_400_000) * 144);
}
/** BTC emitidos hasta una altura de bloque (recompensa 50 que se parte cada 210.000). */
export function circulanteDesdeAltura(altura) {
  let total = 0, recompensa = 50, restante = Math.max(0, altura);
  while (restante > 0 && recompensa >= 1e-8) {
    const b = Math.min(restante, BLOQUES_POR_HALVING);
    total += b * recompensa; restante -= b; recompensa /= 2;
  }
  return total;
}
export function ofertaBTC(altura) {
  const circulante = circulanteDesdeAltura(altura);
  const epoca = Math.floor(altura / BLOQUES_POR_HALVING);
  const proximo = (epoca + 1) * BLOQUES_POR_HALVING;
  const diasHalving = (proximo - altura) / 144;
  return {
    altura, circulante, faltan: OFERTA_BTC - circulante, pctMinado: (circulante / OFERTA_BTC) * 100,
    recompensa: 50 / Math.pow(2, epoca), proximoHalving: proximo,
    fechaHalving: new Date(Date.now() + diasHalving * 86_400_000),
  };
}

/** Proyección año a año del precio con el crecimiento elegido. */
export function proyeccionPrecio({ precioHoy, cagr, curva = null, años, añoHoy = new Date().getFullYear() }) {
  const tr = trayectoria({ curva, cagr });
  return Array.from({ length: Math.max(0, Math.round(años)) }, (_, i) => ({ año: añoHoy + i + 1, precio: precioHoy * tr.f((i + 1) * 12), tasa: tr.tasa(i + 1) }));
}

/**
 * Fase de retiro: retiras cada mes `retiroPct` % del capital inicial ÷ 12 (en
 * pesos de hoy, fijo) y el resto sigue invertido creciendo a la tasa real.
 * Devuelve cuánto queda heredable al final y en qué año se acabaría.
 */
// 4-nov-2026 (Santiago: "aquí hay un error, no quedan 432 MM de dólares").
// La cuenta estaba bien hecha, el supuesto no: 30 % al año durante los 10 años
// de ahorro y los 28 de retiro pone un bitcoin en cientos de millones de dólares.
// Por eso el retiro tiene su propio crecimiento (por defecto prudente, 10 %) y
// la simulación devuelve el precio que implica, para avisar si es irreal.
export function simularRetiro({ capital, retiroPct = RETIRO_DEFAULT, años = 25, cagr, curva = null, desdeAño = 0, caidaInicial = 0, inflacionUSD = INFLACION_USD, precioInicial = null }) {
  // Con curva, el retiro sigue la misma trayectoria donde la dejó el ahorro
  // (año desdeAño + 1 en adelante). caidaInicial: prueba de estrés, el bitcoin
  // cae ese % justo al empezar a retirar y sigue creciendo desde ahí, sin rebote;
  // el retiro mensual ya estaba planeado con el capital de antes de la caída.
  const tr = trayectoria({ curva, cagr });
  const real = (1 + (cagr || 0) / 100) / (1 + inflacionUSD / 100) - 1;
  const rmDe = (m) => {
    if (!curva) return Math.pow(1 + real, 1 / 12) - 1;
    const y = desdeAño + Math.ceil(m / 12);
    return Math.pow((1 + tasaCurva(curva, y) / 100) / (1 + inflacionUSD / 100), 1 / 12) - 1;
  };
  const retiroMes = capital * (retiroPct / 100) / 12;
  let c = capital * (1 - Math.min(Math.max(caidaInicial, 0), 1)), retirado = 0, agotaEn = null;
  const serie = [{ año: 0, capital: c }];
  for (let m = 1; m <= Math.round(años * 12); m++) {
    c = c * (1 + rmDe(m));
    const r = Math.min(retiroMes, c);
    c -= r; retirado += r;
    if (c <= 0 && agotaEn == null) agotaEn = m / 12;
    if (m % 12 === 0) serie.push({ año: m / 12, capital: Math.max(0, c) });
  }
  const factorRetiro = curva ? tr.f((desdeAño + años) * 12) / tr.f(desdeAño * 12) : Math.pow(1 + (cagr || 0) / 100, años);
  const precioFinal = precioInicial ? precioInicial * factorRetiro * (1 - Math.min(Math.max(caidaInicial, 0), 1)) : null;
  // Crecimiento real promedio del tramo de retiro, para el texto de la gráfica.
  const realProm = años > 0 ? (Math.pow(factorRetiro / Math.pow(1 + inflacionUSD / 100, años), 1 / años) - 1) * 100 : 0;
  const capMercado = precioFinal ? precioFinal * OFERTA_BTC : null;
  return {
    retiroMes, capitalFinal: Math.max(0, c), totalRetirado: retirado, agotaEn, serie, real: curva ? realProm : real * 100, conCurva: !!curva,
    precioFinal, irreal: capMercado != null && capMercado > RIQUEZA_MUNDIAL_USD * 0.25,
    vecesRiqueza: capMercado != null ? capMercado / RIQUEZA_MUNDIAL_USD : null,
  };
}

/** Comparativo pensión vs BTC: lo que recibes en vida y lo que heredan. */
export function comparativoHerencia({ pensionMes, añosVida, retiro }) {
  const pensionEnVida = (pensionMes || 0) * MESADAS_POR_AÑO_PENSION * añosVida;
  return {
    // 4-nov-2026 (Santiago: "en BTC me muestra 28 MM y en Pensiones 26,5 MM; deberían
    // ser iguales"): se muestra la misma mesada de Pensiones; las 13 mesadas van
    // en el total y en la nota, no promediadas en el valor mensual.
    pension: { mes: pensionMes || 0, mesadasAño: MESADAS_POR_AÑO_PENSION, enVida: pensionEnVida, heredable: 0 },
    btc: { mes: retiro.retiroMes, enVida: retiro.totalRetirado, heredable: retiro.capitalFinal },
  };
}
export const MESADAS_POR_AÑO_PENSION = 13;

// ── Escenarios de expertos (9-nov-2026) ─────────────────────────────────────
// Santiago: "tenemos los escenarios que usted dice pero además los de los
// expertos". Metas públicas de terceros, verificadas el 9-nov-2026. Cada una se
// vuelve una trayectoria: el crecimiento que lleva del precio de hoy a la meta
// en su fecha y, después de esa fecha (que ellos no proyectan), sigue como el
// escenario Base de FINPATHIA. VanEck, ARK y Bitwise emiten ETF de bitcoin, y las
// metas pasadas se han quedado largas (Standard Chartered proyectó US$200.000
// para 2025 y el año cerró en US$87.509): se muestran como lo que son.
export const FUENTES_EXPERTOS = [
  { id: "vaneck-bajista", fuente: "VanEck · bajista", detalle: "Capital Market Assumptions, 8-ene-2026", año: 2050, precio: 130_000, url: "https://www.vaneck.com/us/en/insights/blogs/digital-assets/matthew-sigel-vaneck-bitcoin-long-term-capital-market-assumptions/" },
  { id: "ark-bajista", fuente: "ARK Invest · bajista", detalle: "Big Ideas 2025, abr-2025", año: 2030, precio: 300_000, url: "https://www.ark-invest.com/articles/valuation-models/arks-bitcoin-price-target-2030" },
  { id: "sc", fuente: "Standard Chartered", detalle: "Geoff Kendrick, dic-2025 (reiterado en 2026)", año: 2030, precio: 500_000, url: "https://sherwood.news/crypto/standard-chartered-still-sees-bitcoin-hitting-usd150-000-in-2026" },
  { id: "ark-base", fuente: "ARK Invest · base", detalle: "Big Ideas 2026, ene-2026 (US$16 billones de capitalización)", año: 2030, precio: 760_000, url: "https://www.theblock.co/post/386560/cathie-wood-ark-invest-bitcoin-crypto-2030" },
  { id: "bernstein", fuente: "Bernstein", detalle: "ago-2026", año: 2033, precio: 1_000_000, url: "https://www.swanbitcoin.com/economics/bitcoin-price-prediction/" },
  { id: "ark-alcista", fuente: "ARK Invest · alcista", detalle: "Cathie Wood, may-2026", año: 2030, precio: 1_250_000, url: "https://www.webpronews.com/cathie-woods-1-25-million-bitcoin-call-why-ark-invest-still-bets-big-amid-market-slump/" },
  { id: "vaneck-base", fuente: "VanEck · base", detalle: "Capital Market Assumptions, 8-ene-2026", año: 2050, precio: 2_900_000, url: "https://www.vaneck.com/us/en/insights/blogs/digital-assets/matthew-sigel-vaneck-bitcoin-long-term-capital-market-assumptions/" },
];
// Compatibilidad con código anterior.
export const PROYECCIONES_ANALISTAS = FUENTES_EXPERTOS;

/** Trayectoria de una meta de experto: g fijo hasta su año y después el Base. */
export function curvaExperto(f, precioHoy, hoy = Date.now()) {
  const n = Math.max(1, Math.round((Date.UTC(f.año, 11, 31) - hoy) / (365.25 * 86_400_000)));
  const g = (Math.pow(f.precio / precioHoy, 1 / n) - 1) * 100;
  const base = ESCENARIOS_CURVA[1];
  return { id: "exp:" + f.id, nombre: f.fuente, experto: f, añosMeta: n, r0: g, rt: base.rt, tasaFn: (y) => (y <= n ? g : tasaCurva(base, y)) };
}
/** Curva por id guardado: "prudente" | "base" | "optimista" | "exp:<id>". null = personalizado. */
export function curvaPorId(id, precioHoy) {
  if (!id || id === "personal") return null;
  if (id.startsWith("exp:")) { const f = FUENTES_EXPERTOS.find((x) => "exp:" + x.id === id); return f && precioHoy > 0 ? curvaExperto(f, precioHoy) : null; }
  return ESCENARIOS_CURVA.find((e) => e.id === id) || null;
}

/** Crecimiento anual que lleva del precio de hoy a `precio` al cierre de `año`. */
export function cagrHacia({ precioHoy, precio, año, hoy = Date.now() }) {
  const años = (Date.UTC(año, 11, 31) - hoy) / (365.25 * 86_400_000);
  if (!(años > 0) || !(precioHoy > 0)) return null;
  return (Math.pow(precio / precioHoy, 1 / años) - 1) * 100;
}


/**
 * Para el escenario personalizado: precio de 1 BTC al terminar y el crecimiento
 * del retiro más alto que no pasa del techo realista (9-nov-2026).
 */
export function techoPersonalizado({ precioHoy, cagr, años, crecRetiro, añosRetiro }) {
  const alRetiro = precioHoy * Math.pow(1 + (Number(cagr) || 0) / 100, años);
  const alFinal = alRetiro * Math.pow(1 + (Number(crecRetiro) || 0) / 100, añosRetiro);
  const maxCrecRetiro = alRetiro >= PRECIO_TECHO_REALISTA ? 0 : Math.floor((Math.pow(PRECIO_TECHO_REALISTA / alRetiro, 1 / Math.max(1, añosRetiro)) - 1) * 100);
  const maxCagr = Math.floor((Math.pow(PRECIO_TECHO_REALISTA / precioHoy, 1 / Math.max(1, años)) - 1) * 100);
  return { alRetiro, alFinal, irrealAhorro: alRetiro > PRECIO_TECHO_REALISTA, irreal: alFinal > PRECIO_TECHO_REALISTA, maxCrecRetiro, maxCagr };
}


// ── Personalizado como curva (9-nov-2026) ───────────────────────────────────
// Santiago: "para uno personalizar el que quiera… no sabría qué valor poner a
// no ser que vea qué estiman las fuentes más serias y la historia". El
// personalizado es una curva (empieza en r0, termina en rt) que se llena desde
// cualquier escenario o meta de experto; con r0 = rt es una tasa fija.
export function curvaPersonal(r0, rt) {
  const a = Math.max(0, Number(r0) || 0), b = Math.max(0, Number(rt) || 0);
  return { id: "personal", nombre: "Personalizado", r0: a, rt: Math.min(a, b) };
}
/** r0 (con rt dado) que lleva del precio de hoy a `precio` en `años` años. */
export function r0QueLlegaA({ precioHoy, precio, años, rt = 5 }) {
  let lo = rt, hi = 400;
  const f = (r0) => precioHoy * trayectoria({ curva: { r0, rt } }).f(años * 12);
  if (f(lo) >= precio) return lo;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < precio) lo = m; else hi = m; }
  return lo;
}
/** El r0 más alto que, con ese rt, no pasa el techo realista en `años` años. */
export function maxR0Realista({ precioHoy, rt = 5, años }) {
  return Math.floor(r0QueLlegaA({ precioHoy, precio: PRECIO_TECHO_REALISTA, años, rt }));
}
/** Valores para personalizar a partir de cualquier curva (nuestra o de experto). */
export function personalizarDesde(curva, precioHoy) {
  if (!curva) return { r0: 25, rt: 5 };
  if (curva.experto) {
    const n = curva.añosMeta;
    return { r0: Math.round(r0QueLlegaA({ precioHoy, precio: curva.experto.precio, años: n, rt: curva.rt })), rt: curva.rt };
  }
  return { r0: Math.round(curva.r0), rt: Math.round(curva.rt) };
}
