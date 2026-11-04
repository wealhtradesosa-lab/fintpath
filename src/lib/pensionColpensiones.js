// ═══════════════════════════════════════════════════════════════════════════
// pensionColpensiones.js — Motor de la pensión de vejez en Colpensiones
// (Régimen de Prima Media, Ley 100/1993 modificada por la Ley 797/2003).
//
// 04-nov-2026. Rehecho contra el análisis actuarial de Destina PFT
// (Juan Carlos Vásquez, 15-abr-2026) sobre el caso de Santiago. Sus cuatro
// escenarios son la referencia de tests/unit/pension-colpensiones.test.js.
//
// Qué estaba mal en el motor anterior (PensionesColpensiones.jsx):
//  1. La tasa base usaba S = IBC − 1. La ley usa S = IBL en salarios mínimos:
//     r = 65,50 − 0,50 × S. Con S = IBL/SMMLV sale el 56,33 % del actuario
//     al decimal; el motor viejo daba 53,50 % (pensión −5 %).
//  2. Faltaba el piso: la tasa base oscila entre 65 % y 55 %. A 25 SMMLV la
//     fórmula da 53 % y la ley la sube a 55 %.
//  3. El tope era 80 % para todos. Es decreciente con el ingreso: 80 % para
//     ingresos bajos y TOPE_MINIMO para los altos (ver abajo).
//  4. El IBL de la jubilación usaba el promedio de hoy aunque se siguiera
//     cotizando: el IBL es una ventana móvil de 10 años.
//  5. 52 semanas por año (Colpensiones cuenta 360 días ÷ 7 = 51,43) y 12
//     mesadas (son 13 desde el Acto Legislativo 01/2005).
//
// Todo es en pesos de hoy (valor presente); antes de pensionarse el IBC al
// tope crece con el salario mínimo, y ya pensionado la mesada se reajusta por
// IPC (Art. 14 Ley 100), salvo la pensión mínima, que sigue al salario mínimo.
// ═══════════════════════════════════════════════════════════════════════════

export const SMMLV_2026 = 1_750_905;
export const SEMANAS_MINIMAS = 1300;
export const SEMANAS_POR_AÑO = 360 / 7; // 51,43 — convención de Colpensiones
export const MESADAS_AÑO = 13;
export const TOPE_IBC_SM = 25;
export const TASA_BASE_MAX = 65.5;
export const TASA_BASE_MIN = 55;
export const TOPE_MAXIMO = 80;
// La Ley 797 dice que el máximo baja "entre el 80 y el 70,5 %" según el nivel
// de ingresos. El actuario aplica 70 % a 25 SMMLV (y reclama el 1,5 % extra por
// demanda). Se usa 70 para cuadrar con él; pendiente confirmar con Destina si
// es 70 o 70,5. Es la única constante a cambiar.
export const TOPE_MINIMO = 70;
// Esperanza de vida a la edad de pensión (tabla RV08 Superfinanciera).
export const ESPERANZA_VIDA = { M: 20.7, F: 27.3 };

export const edadPension = (sexo) => (sexo === "F" ? 57 : 62);

/** Tasa de reemplazo (%) para un IBL expresado en salarios mínimos. */
export function tasaReemplazo({ iblSM, semanas }) {
  const S = Math.max(0, Number(iblSM) || 0);
  const base = Math.min(TASA_BASE_MAX, Math.max(TASA_BASE_MIN, 65.5 - 0.5 * S));
  const extra = Math.max(0, (Number(semanas) || 0) - SEMANAS_MINIMAS);
  const bloques = Math.floor(extra / 50);
  const bonus = bloques * 1.5;
  // Tope decreciente: 80 % a 1 SMMLV, baja 0,5 por salario mínimo, piso TOPE_MINIMO.
  const tope = Math.min(TOPE_MAXIMO, Math.max(TOPE_MINIMO, 80 - 0.5 * Math.max(0, S - 1)));
  const total = Math.min(tope, base + bonus);
  return { base, bonus, bloques, semanasExtra: extra, tope, total, recortadaPorTope: base + bonus > tope };
}

/**
 * Fondo de Solidaridad Pensional por nivel en salarios mínimos.
 * Cotizantes (Art. 27 Ley 100 mod. Ley 797): 1 % desde 4 SMMLV y escala desde 16.
 * Pensionados (Art. 8 Ley 797): solo desde 10 SMMLV, con la misma escala alta.
 */
export function pctFSP(nivelSM, { pensionado = false } = {}) {
  const s = Number(nivelSM) || 0;
  if (s > 20) return 0.02;
  if (s >= 19) return 0.018;
  if (s >= 18) return 0.016;
  if (s >= 17) return 0.014;
  if (s >= 16) return 0.012;
  if (pensionado ? s > 10 : s >= 4) return 0.01;
  return 0;
}

/** Descuento total sobre la mesada: salud 12 % + solidaridad del pensionado. */
export function pctDescuentoMesada(mesada, sm = SMMLV_2026) {
  return 0.12 + pctFSP(mesada / sm, { pensionado: true });
}

/**
 * IBL proyectado con ventana móvil de 10 años: cada año que se cotiza al IBC
 * nuevo reemplaza un año del promedio actual. Sin la historia laboral mes a
 * mes se supone que la ventana de hoy pesa parejo; con años recientes más altos
 * que el promedio, el IBL real sale algo mayor (el actuario usa la historia).
 */
export function iblProyectado({ iblHoy, ibcFuturo, años }) {
  const a = Math.min(10, Math.max(0, Number(años) || 0));
  if (a === 0) return iblHoy;
  return ((10 - a) * iblHoy + a * ibcFuturo) / 10;
}

/** Liquida la pensión para un IBL (en pesos) y unas semanas. */
export function liquidarPension({ ibl, semanas, sm = SMMLV_2026 }) {
  const tasa = tasaReemplazo({ iblSM: ibl / sm, semanas });
  const cumple = semanas >= SEMANAS_MINIMAS;
  const bruta = Math.min(ibl * tasa.total / 100, TOPE_IBC_SM * sm);
  const brutaFinal = cumple ? Math.max(bruta, sm) : 0;
  const pctDescuento = pctDescuentoMesada(brutaFinal, sm);
  const neta = brutaFinal * (1 - pctDescuento);
  return { ibl, semanas, cumple, tasa, bruta: brutaFinal, pctDescuento, descuento: brutaFinal - neta, neta, netaAnual: neta * MESADAS_AÑO };
}

/**
 * Escenario: seguir cotizando `años` más sobre `ibcSM` desde hoy.
 * `iblHoy` es el promedio real de los últimos 10 años (si no se conoce, el IBC).
 */
export function escenarioCotizar({ semanasHoy, iblHoy, ibcSM, años, sm = SMMLV_2026 }) {
  const ibc = Math.min(TOPE_IBC_SM, ibcSM) * sm;
  const semanas = semanasHoy + Math.max(0, años) * SEMANAS_POR_AÑO;
  const ibl = iblProyectado({ iblHoy, ibcFuturo: ibc, años });
  return { años, ibc, ...liquidarPension({ ibl, semanas, sm }) };
}

/**
 * ¿Vale la pena seguir cotizando? Compara cotizar `años` más contra parar hoy.
 *
 * Costo marginal = solo pensión (16 %) + solidaridad del cotizante: la salud se
 * paga igual mientras haya ingresos, así que no es costo de esta decisión.
 * Beneficio = la DIFERENCIA de mesada neta (la pensión de parar hoy ya está
 * asegurada), × 13 mesadas, desde la edad de pensión durante la esperanza de
 * vida. Todo en pesos de hoy, por eso la TIR es real.
 *
 * (El "payback" del informe divide el costo total de seguridad social entre la
 * mesada bruta completa: da 4,4 años donde lo incremental da 7,5.)
 */
export function valeLaPenaSeguir({ sexo = "M", edad, semanasHoy, iblHoy, ibcSM, años, sm = SMMLV_2026 }) {
  const parar = escenarioCotizar({ semanasHoy, iblHoy, ibcSM, años: 0, sm });
  const seguir = escenarioCotizar({ semanasHoy, iblHoy, ibcSM, años, sm });
  const ibcSMtope = Math.min(TOPE_IBC_SM, ibcSM);
  const pctCosto = 0.16 + pctFSP(ibcSMtope);
  const costoMes = seguir.ibc * pctCosto;
  const mesesCosto = Math.round(años * 12);
  const costoTotal = costoMes * mesesCosto;
  const beneficioMesNeto = Math.max(0, seguir.neta - parar.neta);
  const beneficioMes = beneficioMesNeto * MESADAS_AÑO / 12; // promedio mensual con la mesada 13
  const mesesHastaPension = Math.max(mesesCosto, Math.round(Math.max(0, edadPension(sexo) - edad) * 12));
  const mesesBeneficio = Math.round((ESPERANZA_VIDA[sexo] || ESPERANZA_VIDA.M) * 12);
  const paybackAños = beneficioMes > 0 ? costoTotal / (beneficioMes * 12) : Infinity;

  const vpn = (r) => {
    let v = 0;
    for (let m = 0; m < mesesCosto; m++) v -= costoMes / Math.pow(1 + r, m);
    for (let m = 0; m < mesesBeneficio; m++) v += beneficioMes / Math.pow(1 + r, mesesHastaPension + m);
    return v;
  };
  let tirAnual = null;
  if (costoTotal > 0 && beneficioMes > 0 && vpn(0) > 0) {
    let lo = 0, hi = 0.1;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (vpn(mid) > 0) lo = mid; else hi = mid; }
    tirAnual = (Math.pow(1 + lo, 12) - 1) * 100;
  } else if (costoTotal > 0) {
    tirAnual = vpn(0) > 0 ? null : -Infinity;
  }

  return { parar, seguir, pctCosto, costoMes, costoTotal, beneficioMesNeto, beneficioMes, beneficioTotal: beneficioMes * mesesBeneficio, paybackAños, tirAnual, mesesBeneficio };
}
