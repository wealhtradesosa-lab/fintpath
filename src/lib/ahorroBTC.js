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
export function simularAhorroBTC({ frecuencia = "mensual", monto, años, cagr, precioHoy, trm, retiroPct = RETIRO_DEFAULT, inflacionUSD = INFLACION_USD }) {
  const m = Math.max(0, Number(monto) || 0);
  const n = Math.max(0, Math.round(Number(años) || 0));
  const g = (Number(cagr) || 0) / 100;
  const p0 = Number(precioHoy) || 0;
  const tc = Number(trm) || 0;
  if (!m || !n || !p0 || !tc) return null;

  const precioEn = (mes) => p0 * Math.pow(1 + g, mes / 12);
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
    const precio = p0 * Math.pow(1 + g, y);
    serie.push({ año: y, btc, invertido, valorCOPHoy: (btc * precio / deflactor(y)) * tc });
  }

  const precioFinal = p0 * Math.pow(1 + g, n);
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
export function proyeccionPrecio({ precioHoy, cagr, años, añoHoy = new Date().getFullYear() }) {
  return Array.from({ length: Math.max(0, Math.round(años)) }, (_, i) => ({ año: añoHoy + i + 1, precio: precioHoy * Math.pow(1 + cagr / 100, i + 1) }));
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
export function simularRetiro({ capital, retiroPct = RETIRO_DEFAULT, años = 25, cagr, inflacionUSD = INFLACION_USD, precioInicial = null }) {
  const real = (1 + (cagr || 0) / 100) / (1 + inflacionUSD / 100) - 1;
  const rm = Math.pow(1 + real, 1 / 12) - 1;
  const retiroMes = capital * (retiroPct / 100) / 12;
  let c = capital, retirado = 0, agotaEn = null;
  const serie = [{ año: 0, capital: c }];
  for (let m = 1; m <= Math.round(años * 12); m++) {
    c = c * (1 + rm);
    const r = Math.min(retiroMes, c);
    c -= r; retirado += r;
    if (c <= 0 && agotaEn == null) agotaEn = m / 12;
    if (m % 12 === 0) serie.push({ año: m / 12, capital: Math.max(0, c) });
  }
  const precioFinal = precioInicial ? precioInicial * Math.pow(1 + (cagr || 0) / 100, años) : null;
  const capMercado = precioFinal ? precioFinal * OFERTA_BTC : null;
  return {
    retiroMes, capitalFinal: Math.max(0, c), totalRetirado: retirado, agotaEn, serie, real: real * 100,
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

// ── Proyecciones de analistas (4-nov-2026) ──────────────────────────────────
// Santiago: "¿cuál es el futuro proyectado del BTC? Uno puede elegir el promedio
// pasado o el futuro; ese también debería estar, y basado en qué fuente".
// Son metas de terceros, no de FINPATHIA. Todas apuntan a 2030: el crecimiento
// anual implícito se calcula desde el precio de hoy hasta esa fecha.
export const PROYECCIONES_ANALISTAS = [
  { id: "sc", fuente: "Standard Chartered", detalle: "Geoff Kendrick, nota del 12-ene-2026", fecha: "2026-01-12", año: 2030, precio: 500_000, url: "https://sherwood.news/crypto/standard-chartered-still-sees-bitcoin-hitting-usd150-000-in-2026" },
  { id: "ark-bajista", fuente: "ARK Invest · escenario bajista", detalle: "Big Ideas, actualizado el 25-abr-2025", fecha: "2025-04-25", año: 2030, precio: 500_000, url: "https://cointelegraph.com/news/ark-invest-predicts-bitcoin-could-rise-to-over-2-million-by-2030" },
  { id: "ark-base", fuente: "ARK Invest · escenario base", detalle: "Big Ideas, actualizado el 25-abr-2025", fecha: "2025-04-25", año: 2030, precio: 1_200_000, url: "https://cointelegraph.com/news/ark-invest-predicts-bitcoin-could-rise-to-over-2-million-by-2030" },
  { id: "ark-alcista", fuente: "ARK Invest · escenario alcista", detalle: "Big Ideas, actualizado el 25-abr-2025", fecha: "2025-04-25", año: 2030, precio: 2_400_000, url: "https://cointelegraph.com/news/ark-invest-predicts-bitcoin-could-rise-to-over-2-million-by-2030" },
];

/** Crecimiento anual que lleva del precio de hoy a `precio` al cierre de `año`. */
export function cagrHacia({ precioHoy, precio, año, hoy = Date.now() }) {
  const años = (Date.UTC(año, 11, 31) - hoy) / (365.25 * 86_400_000);
  if (!(años > 0) || !(precioHoy > 0)) return null;
  return (Math.pow(precio / precioHoy, 1 / años) - 1) * 100;
}
