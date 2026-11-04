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

  // Acumulado año a año (pesos de hoy, sin descontar): baja mientras se cotiza,
  // sube desde la pensión. Cruza el cero en el año en que se recupera lo pagado.
  const totalMeses = mesesHastaPension + mesesBeneficio;
  const serie = [{ año: 0, acumulado: 0 }];
  let acum = 0, mesRecupera = null;
  for (let m = 0; m < totalMeses; m++) {
    if (m < mesesCosto) acum -= costoMes;
    if (m >= mesesHastaPension) acum += beneficioMes;
    if (mesRecupera == null && m >= mesesHastaPension && acum >= 0 && costoTotal > 0) mesRecupera = m + 1;
    if ((m + 1) % 12 === 0 || m + 1 === mesesHastaPension || m === totalMeses - 1) serie.push({ año: (m + 1) / 12, acumulado: acum });
  }
  return {
    parar, seguir, pctCosto, costoMes, costoTotal, beneficioMesNeto, beneficioMes, beneficioTotal: beneficioMes * mesesBeneficio, paybackAños, tirAnual, mesesBeneficio,
    serie, añosHastaPension: mesesHastaPension / 12, añosVida: mesesBeneficio / 12,
    // Por cada peso aportado, cuántos pesos de mesada extra recibes en vida.
    retornoPorPeso: costoTotal > 0 ? (beneficioMes * mesesBeneficio) / costoTotal : null,
    añoRecupera: mesRecupera != null ? mesRecupera / 12 : null, ganaTotal: acum,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FONDO PRIVADO (RAIS) — 04-nov-2026.
// Santiago: "los fondos privados como Protección o Porvenir jamás llegan a pagar
// 20 MM al mes de pensión, tiene que haber un error". Lo había, cuatro:
//  1. Se acumulaba al rendimiento NOMINAL (8 %) y la mesada salía en pesos de
//     dentro de 10 años, al lado de una pensión de Colpensiones en pesos de hoy.
//     Ahora todo es real: rendimiento sobre la inflación.
//  2. La mesada se calculaba con 12 pagos al año. Son 13.
//  3. No contaba al cónyuge: el fondo tiene que reservar capital para la
//     sustitución pensional, que dura hasta que muera el último de los dos.
//     Para un hombre de 62 con esposa de 57 eso pasa de ~21 a ~27 años de pago.
//  4. Se mostraba bruta contra la neta de Colpensiones (sin el 12 % de salud).
// ═══════════════════════════════════════════════════════════════════════════

export const RAIS_APORTE_CUENTA = 0.115;   // de 16 %: 11,5 % a la cuenta
export const RAIS_COMISION = 0.03;         // administración + seguro previsional
export const RAIS_TASA_TECNICA_RP = 4;     // % real, retiro programado
export const RAIS_TASA_TECNICA_RV = 3;     // % real, renta vitalicia (aseguradora)

/** Esperanza de vida aproximada (tabla RV08) a una edad dada. */
export function esperanzaVida(sexo, edad) {
  const ref = sexo === "F" ? { e: 57, v: ESPERANZA_VIDA.F } : { e: 62, v: ESPERANZA_VIDA.M };
  return Math.max(5, ref.v - 0.82 * ((Number(edad) || ref.e) - ref.e));
}

/** Años que el fondo debe pagar: hasta que muera el último (afiliado o cónyuge). */
export function añosDePago({ sexo, edadPension, conyuge }) {
  const propio = esperanzaVida(sexo, edadPension);
  if (!conyuge) return propio;
  const sexoC = conyuge.sexo || (sexo === "F" ? "M" : "F");
  const edadC = Number(conyuge.edadAlPensionarse) || edadPension;
  return Math.max(propio, esperanzaVida(sexoC, edadC));
}

/** Pesos de capital que se necesitan por cada peso de mesada mensual (13 mesadas). */
export function capitalPorPesoDeMesada(años, tasaRealPct) {
  const i = tasaRealPct / 100;
  const n = Math.round(años);
  const anualidad = i > 0 ? (1 - Math.pow(1 + i, -n)) / i * (1 + i) : n; // pago anticipado
  return MESADAS_AÑO * anualidad;
}

export function calcularRAIS({ saldoHoy = 0, ibcSM, rendRealPct = 4, años, aportesVolMes = 0, bono = 0, sexo = "M", conyuge = null, sm = SMMLV_2026 }) {
  const ibc = Math.min(TOPE_IBC_SM, Number(ibcSM) || 0) * sm;
  const aporteMes = ibc * RAIS_APORTE_CUENTA;
  const r = Math.pow(1 + rendRealPct / 100, 1 / 12) - 1;
  const n = Math.round(Math.max(0, años) * 12);
  let saldo = (Number(saldoHoy) || 0) + (Number(bono) || 0);
  const proyeccion = [];
  for (let m = 1; m <= n; m++) {
    saldo = saldo * (1 + r) + aporteMes + (Number(aportesVolMes) || 0);
    if (m % 12 === 0 || m === n) proyeccion.push({ anio: Math.round(m / 12 * 10) / 10, saldo: Math.round(saldo) });
  }
  const totalAportado = (aporteMes + (Number(aportesVolMes) || 0)) * n + (Number(saldoHoy) || 0) + (Number(bono) || 0);
  const edadPensionX = edadPension(sexo);
  const pago = añosDePago({ sexo, edadPension: edadPensionX, conyuge });
  const mesada = (tasa) => {
    const bruta = Math.max(saldo / capitalPorPesoDeMesada(pago, tasa), sm); // garantía de pensión mínima
    const pct = pctDescuentoMesada(bruta, sm);
    return { bruta, neta: bruta * (1 - pct), pctDescuento: pct };
  };
  const rp = mesada(RAIS_TASA_TECNICA_RP);
  const rv = mesada(RAIS_TASA_TECNICA_RV);
  return {
    saldoFinal: saldo, aporteMes, comisionMes: ibc * RAIS_COMISION, fondoGarantia: ibc * 0.015,
    totalAportado, totalComisiones: ibc * RAIS_COMISION * n, rendimiento: saldo - totalAportado,
    añosDePago: pago, proyeccion,
    retiroProgramado: rp.neta, retiroProgramadoBruta: rp.bruta,
    rentaVitalicia: rv.neta, rentaVitaliciaBruta: rv.bruta,
    rentaMes: rp.neta, heredable: true,
  };
}

/**
 * Escenarios "como el informe actuarial" (04-nov-2026, Santiago: "ver si paro ya
 * y por cada año adicional, y cuál es el más eficiente de todos").
 * Un escenario por año adicional de cotización hasta la edad de pensión, más el
 * exacto a la edad de pensión. Cada uno contra parar hoy: mesada, costo, payback
 * y rentabilidad real. El más eficiente = la mayor rentabilidad real (cada peso
 * extra que pones rinde más ahí); suele caer justo al completar un bloque de 50
 * semanas.
 */
export function escenariosCotizacion({ sexo = "M", edad, semanasHoy, iblHoy, ibcSM, sm = SMMLV_2026 }) {
  const falta = Math.max(0, edadPension(sexo) - edad);
  const años = [0];
  for (let a = 1; a < falta; a++) años.push(a);
  if (falta > 0) años.push(Math.round(falta * 100) / 100);
  const lista = años.map((a) => {
    const v = valeLaPenaSeguir({ sexo, edad, semanasHoy, iblHoy, ibcSM, años: a, sm });
    return { años: a, hastaPension: a > 0 && a === años[años.length - 1], ...v, mesada: v.seguir.neta, semanas: v.seguir.semanas, tasa: v.seguir.tasa.total };
  });
  const conTir = lista.filter((e) => e.años > 0 && Number.isFinite(e.tirAnual));
  const mejor = conTir.length ? conTir.reduce((a, b) => (b.tirAnual > a.tirAnual + 1e-9 ? b : a)) : null;
  return { lista, mejor: mejor ? mejor.años : null, falta };
}

/**
 * Hallazgos costo/beneficio (04-nov-2026).
 * Santiago: "¿cómo haces una fórmula que diga lo aportado vs el retorno, lo más
 * eficiente?" y "no usemos el término recomendar; eso puede traer
 * consecuencias legales". Por eso aquí no se recomienda nada: se mide.
 *
 *   Retorno por peso = (mesada extra × 13 × años de pensión) ÷ lo aportado
 *
 * Todo en pesos de hoy, frente a parar hoy. El escenario de mayor eficiencia es
 * el que más devuelve por cada peso aportado (a igualdad, el de menos años).
 * Los hallazgos son hechos del cálculo; la decisión es de la persona con su
 * asesor.
 */
export function hallazgosPension({ escenarios, edad, añoHoy = new Date().getFullYear(), sexo = "M", fm = (v) => String(Math.round(v)) }) {
  const L = escenarios?.lista || [];
  if (L.length < 2) return { masEficiente: null, hallazgos: [] };
  const ePension = edadPension(sexo);
  const falta = L[L.length - 1].años;
  const num = (v, d = 1) => v.toFixed(d).replace(".", ",");
  const hasta = (e) => `${añoHoy + Math.round(e.años)}, a los ${Math.floor(edad + e.años)}`;
  const validos = L.filter((e) => e.años > 0 && e.retornoPorPeso != null && e.mesada > 0);
  let mejor = validos.reduce((a, b) => (!a || b.retornoPorPeso > a.retornoPorPeso + 1e-9 ? b : a), null);
  const H = [];
  // Si todos devuelven casi lo mismo por peso, no se señala ninguno.
  const rs = validos.map((e) => e.retornoPorPeso);
  if (mejor && rs.length > 1 && (Math.max(...rs) - Math.min(...rs)) / Math.max(...rs) < 0.03) {
    H.push({ tipo: "eficiencia", texto: `El retorno por peso aportado es parecido en todos los escenarios: cerca de $${num(mejor.retornoPorPeso)} de mesada por cada $1 que aportas. Cotizar más años sube la mesada (de ${fm(L[0].mesada)} hoy a ${fm(L[L.length - 1].mesada)} a los ${ePension}) sin cambiar mucho la eficiencia.` });
    mejor = null;
  }

  if (mejor) {
    H.push({ tipo: "eficiencia", texto: `Mayor retorno por peso aportado: cotizar hasta ${hasta(mejor)}. Por cada $1 que aportas recibirías $${num(mejor.retornoPorPeso)} de mesada extra durante tu pensión (${num(mejor.añosVida, 0)} años de esperanza de vida), y tu mesada pasaría de ${fm(L[0].mesada)} a ${fm(mejor.mesada)}.` });
    if (mejor.retornoPorPeso < 1) H.push({ tipo: "aviso", texto: "Con estos datos ningún escenario devuelve en mesadas lo que se aporta dentro de la esperanza de vida." });
  }

  // Tope: meses que ya no suben la mesada.
  const iTope = L.findIndex((e, i) => i > 0 && e.tasa >= e.seguir.tasa.tope - 1e-9);
  if (iTope > 0 && iTope < L.length - 1) {
    const sobra = L[L.length - 1].años - L[iTope].años;
    const meses = Math.round(sobra * 12);
    H.push({ tipo: "tope", texto: `En ${añoHoy + Math.round(L[iTope].años)} se llega al tope de ${num(L[iTope].seguir.tasa.tope, 0)} % de tasa. ${meses >= 12 ? `Los ${num(sobra)} años` : `Los ${meses} meses`} siguientes hasta la pensión no suben la mesada y suman ${fm(L[L.length - 1].costoTotal - L[iTope].costoTotal)} de aportes.` });
  }

  // Comparación con la edad de pensión.
  const ultimo = L[L.length - 1];
  if (mejor && mejor !== ultimo && ultimo.retornoPorPeso != null && !H.some((x) => x.tipo === "tope")) {
    H.push({ tipo: "comparacion", texto: `Cotizar hasta la pensión (${añoHoy + Math.ceil(falta)}) suma ${fm(ultimo.costoTotal - mejor.costoTotal)} de aportes y ${fm(Math.max(0, ultimo.mesada - mejor.mesada))} de mesada: $${num(ultimo.retornoPorPeso)} por cada $1, frente a $${num(mejor.retornoPorPeso)}.` });
  }

  // Parar hoy: hecho, sin juicio.
  if (L[0].mesada > 0) {
    H.push({ tipo: "parar", texto: `Si se deja de cotizar hoy, la pensión llega igual en ${añoHoy + Math.ceil(falta)}, a los ${ePension}, con una mesada de ${fm(L[0].mesada)}.` });
  } else if (!(L[0].mesada > 0)) {
    const primero = L.find((e) => e.mesada > 0);
    if (primero) H.push({ tipo: "parar", texto: `Hoy no se completan las 1.300 semanas: hay que cotizar hasta ${hasta(primero)} para tener pensión.` });
  }
  return { masEficiente: mejor ? mejor.años : null, hallazgos: H };
}
