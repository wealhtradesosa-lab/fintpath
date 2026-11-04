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
