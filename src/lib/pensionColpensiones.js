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
 * Hallazgos y recomendación costo/beneficio (04-nov-2026, Santiago: "que le diga
 * a uno cuál es el modelo más eficiente; por ejemplo, si a 7 años adicionales no
 * hay mayor diferencia con 10, o si vale la pena, que lo diga").
 *
 * Para cada año adicional se calcula su rentabilidad MARGINAL: lo que cuesta ese
 * año extra contra lo que sube la mesada por él. Un año que rinde menos que la
 * alternativa (`alternativaRealPct`, invertir esa plata) no vale la pena. Es
 * informativo: lo valida un actuario.
 */
export function hallazgosPension({ escenarios, edad, añoHoy = new Date().getFullYear(), alternativaRealPct = 4, sexo = "M", fm = (v) => String(Math.round(v)) }) {
  const L = escenarios?.lista || [];
  if (L.length < 2) return { recomendado: null, marginales: [], hallazgos: [] };
  const ePension = edadPension(sexo);
  const vida = ESPERANZA_VIDA[sexo] || ESPERANZA_VIDA.M;
  const falta = L[L.length - 1].años;

  // TIR marginal de pasar del escenario i-1 al i.
  const tirMarginal = (a, b) => {
    const meses = Math.round((b.años - a.años) * 12);
    const costoMes = b.costoMes;
    const inicio = Math.round(a.años * 12);
    const benef = Math.max(0, b.mesada - a.mesada) * MESADAS_AÑO / 12;
    const desde = Math.round(falta * 12);
    const n = Math.round(vida * 12);
    if (!(benef > 0)) return -Infinity;
    const vpn = (r) => {
      let v = 0;
      for (let m = 0; m < meses; m++) v -= costoMes / Math.pow(1 + r, inicio + m);
      for (let m = 0; m < n; m++) v += benef / Math.pow(1 + r, desde + m);
      return v;
    };
    if (vpn(0) <= 0) return -Infinity;
    let lo = 0, hi = 0.2;
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (vpn(mid) > 0) lo = mid; else hi = mid; }
    return (Math.pow(1 + lo, 12) - 1) * 100;
  };
  const marginales = L.map((e, i) => (i === 0 ? null : { años: e.años, subeMesada: e.mesada - L[i - 1].mesada, cuesta: e.costoMes * (e.años - L[i - 1].años) * 12, tir: tirMarginal(L[i - 1], e) }));

  // Recomendado: el más largo cuyos años extra rinden todos ≥ alternativa.
  let recomendadoIdx = 0;
  for (let i = 1; i < L.length; i++) { if (marginales[i].tir >= alternativaRealPct) recomendadoIdx = i; else break; }
  // Si un año intermedio rinde poco pero los siguientes compensan, mira el total.
  if (recomendadoIdx === 0) {
    const mejor = L.findIndex((e) => e.años === escenarios.mejor);
    if (mejor > 0 && L[mejor].tirAnual >= alternativaRealPct) recomendadoIdx = mejor;
  }
  const rec = L[recomendadoIdx];
  const hasta = (e) => `${añoHoy + Math.round(e.años)}, a los ${Math.floor(edad + e.años)}`;
  const H = [];

  if (recomendadoIdx === 0) {
    H.push({ tipo: "recomendacion", texto: `Con estos datos, seguir cotizando rinde menos del ${alternativaRealPct} % real que te daría invertir esa plata. Parar hoy es lo más eficiente; tu mesada sería ${fm(L[0].mesada)}.` });
  } else {
    H.push({ tipo: "recomendacion", texto: `Lo más eficiente costo/beneficio: cotizar hasta ${hasta(rec)}. Tu mesada pasa de ${fm(L[0].mesada)} a ${fm(rec.mesada)} y lo que pones rinde ${(rec.tirAnual).toFixed(1).replace(".", ",")} % al año sobre la inflación.` });
  }

  // Tope: años que ya no suben la mesada.
  const iTope = L.findIndex((e, i) => i > 0 && e.tasa >= e.seguir.tasa.tope - 1e-9);
  if (iTope > 0 && iTope < L.length - 1) {
    const sobra = L[L.length - 1].años - L[iTope].años;
    const meses = Math.round(sobra * 12);
    H.push({ tipo: "tope", texto: `En ${añoHoy + Math.round(L[iTope].años)} llegas al tope de ${L[iTope].seguir.tasa.tope.toFixed(0)} % de tasa. Los ${meses >= 12 ? (sobra.toFixed(1).replace(".", ",") + " años") : (meses + " meses")} siguientes hasta la pensión ya no suben tu mesada: cuestan ${fm(L[L.length - 1].costoTotal - L[iTope].costoTotal)} sin beneficio en la tasa. Pregúntale a tu asesor si conviene cotizar ahí sobre un ingreso menor o reclamar el 1,5 % adicional.` });
  }

  // Comparación del recomendado con su vecino y con la edad de pensión.
  const ultimo = L[L.length - 1];
  if (recomendadoIdx > 0 && rec !== ultimo && !H.some((x) => x.tipo === "tope")) {
    const sube = ultimo.mesada - rec.mesada;
    const cuesta = ultimo.costoTotal - rec.costoTotal;
    H.push({ tipo: "comparacion", texto: sube > 0
      ? `Seguir de ${añoHoy + Math.round(rec.años)} a ${añoHoy + Math.ceil(ultimo.años)} cuesta ${fm(cuesta)} más y sube la mesada ${fm(sube)}: rinde menos que invertir esa plata.`
      : `Seguir de ${añoHoy + Math.round(rec.años)} a ${añoHoy + Math.ceil(ultimo.años)} cuesta ${fm(cuesta)} más y no sube la mesada.` });
  }

  // Rendimiento de cada año extra (rango).
  const tirs = marginales.filter((m) => m && Number.isFinite(m.tir)).map((m) => m.tir);
  if (tirs.length > 1) {
    H.push({ tipo: "marginal", texto: `Cada año extra rinde entre ${Math.min(...tirs).toFixed(1).replace(".", ",")} % y ${Math.max(...tirs).toFixed(1).replace(".", ",")} % real. Los años que completan un bloque de 50 semanas rinden más; los que lo dejan a medias, menos.` });
  }

  // Parar hoy: lo que se deja de ganar.
  if (recomendadoIdx > 0) {
    H.push({ tipo: "parar", texto: `Si paras hoy te pensionas igual en ${añoHoy + Math.ceil(falta)}, a los ${ePension}, pero con ${fm(rec.mesada - L[0].mesada)} menos al mes de por vida.` });
  }
  return { recomendado: rec.años, recomendadoIdx, marginales, hallazgos: H, alternativaRealPct };
}
