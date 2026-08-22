// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · buyVsInvest.js — Comprar casa vs arrendar e invertir
//
// LA REGLA QUE HACE HONESTA LA COMPARACIÓN
//   Los dos escenarios deben desembolsar EXACTAMENTE la misma plata, mes a mes.
//   Casi todos los comparadores de internet fallan acá: enfrentan el precio de
//   la casa contra ese mismo monto en un fondo, y olvidan que quien compra puso
//   solo la cuota inicial (el banco puso el resto), y que quien no compra
//   igual tiene que pagar arriendo todos los meses.
//
//   Acá:
//     · Comprar  = cuota inicial + gastos de compra, y luego cuota del crédito
//                  + predial + administración + seguro + mantenimiento.
//     · Arrendar = invierte de entrada esa misma cuota inicial + gastos, y cada
//                  mes invierte la DIFERENCIA entre lo que le habría costado
//                  comprar y lo que paga de arriendo.
//
//   Si comprar sale más caro por mes, el que arrienda invierte la diferencia.
//   Si el arriendo sale más caro, el que arrienda RETIRA de su portafolio para
//   cubrirlo. Sin esa segunda mitad, arrendar quedaría artificialmente bien.
//
// LO QUE NO SE OMITE (y suele omitirse)
//   · Intereses: en un crédito a 20 años pesan más que la cuota inicial.
//   · Gastos de compra (notariado, registro, beneficencia) y de venta.
//   · Predial, administración, seguro y mantenimiento, todos indexados.
//   · Ganancia ocasional al vender (15% en Colombia, Art. 313 ET) y el impuesto
//     sobre la utilidad del portafolio.
//   · El arriendo sube con el IPC; la cuota de un crédito en pesos, no.
//
// LO QUE EL MODELO NO PUEDE DECIDIR
//   Vivir en lo propio tiene un valor que no es un número: estabilidad, poder
//   clavar un clavo en la pared, no depender de que no te renueven. Este motor
//   compara patrimonio, no vida. Esa parte la pone el usuario.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte una tasa efectiva anual a su equivalente mensual.
 * NO se divide entre 12: una E.A. del 12% no es 1% mensual sino 0.949%.
 * Dividir entre 12 sobreestima el costo del crédito y le da una ventaja
 * falsa al escenario de arrendar.
 */
export const eaAMensual = (ea) => Math.pow(1 + ea / 100, 1 / 12) - 1;

/**
 * Cuota fija de un crédito (sistema francés).
 */
export function cuotaCredito(monto, tasaEA, anios) {
  const i = eaAMensual(tasaEA);
  const n = anios * 12;
  if (n <= 0) return 0;
  if (i === 0) return monto / n;
  return (monto * i) / (1 - Math.pow(1 + i, -n));
}

const DEFAULTS = {
  precioCasa: 400000000,
  modoCompra: "hipoteca",        // "hipoteca" | "contado"
  cuotaInicialPct: 30,
  tasaHipotecaEA: 13.5,
  plazoHipotecaAnios: 20,

  valorizacionCasaAnual: 6,      // nominal, en línea con IPC + algo
  arriendoMensual: 1800000,      // lo que costaría arrendar ESA misma casa
  incrementoArriendoAnual: 5,    // el arriendo se indexa al IPC

  gastosCompraPct: 3,            // notariado, registro, beneficencia
  gastosVentaPct: 3,             // comisión inmobiliaria
  predialAnualPct: 0.8,          // sobre el avalúo
  administracionMensual: 350000,
  seguroAnualPct: 0.35,
  mantenimientoAnualPct: 1,      // regla de oro: ~1% del valor al año

  rendimientoInversionAnual: 10, // CAGR del activo elegido
  impuestoGananciaInversionPct: 15,
  impuestoGananciaOcasionalPct: 15,
  exencionViviendaHabitacion: false, // Art. 311-1 ET

  horizonteAnios: 20,
};

/**
 * Corre los dos escenarios mes a mes y devuelve el patrimonio neto final de
 * cada uno, más la serie anual para graficar.
 */
export function compararCompraVsInversion(input = {}) {
  const p = { ...DEFAULTS, ...input };
  const meses = Math.max(1, Math.round(p.horizonteAnios * 12));

  // ── Desembolso inicial ───────────────────────────────────────────────────
  const gastosCompra = p.precioCasa * (p.gastosCompraPct / 100);
  const cuotaInicial = p.modoCompra === "contado"
    ? p.precioCasa
    : p.precioCasa * (p.cuotaInicialPct / 100);
  const montoCredito = p.precioCasa - cuotaInicial;
  const desembolsoInicial = cuotaInicial + gastosCompra;

  const cuotaMes = p.modoCompra === "contado"
    ? 0
    : cuotaCredito(montoCredito, p.tasaHipotecaEA, p.plazoHipotecaAnios);

  const iCredito = eaAMensual(p.tasaHipotecaEA);
  const iInversion = eaAMensual(p.rendimientoInversionAnual);
  const gValorizacion = Math.pow(1 + p.valorizacionCasaAnual / 100, 1 / 12) - 1;
  const gArriendo = Math.pow(1 + p.incrementoArriendoAnual / 100, 1 / 12) - 1;

  // ── Estado ───────────────────────────────────────────────────────────────
  let saldoCredito = montoCredito;
  let valorCasa = p.precioCasa;
  let arriendo = p.arriendoMensual;
  let interesesPagados = 0;
  let costosTenencia = 0;
  let arriendoPagado = 0;

  // El que arrienda arranca invirtiendo lo que el otro usó de cuota inicial.
  let portafolio = desembolsoInicial;
  let aportadoAlPortafolio = desembolsoInicial;

  const serie = [];

  for (let m = 1; m <= meses; m++) {
    // ── Escenario COMPRAR ──────────────────────────────────────────────────
    let cuotaEsteMes = 0;
    if (saldoCredito > 0.01 && p.modoCompra === "hipoteca" && m <= p.plazoHipotecaAnios * 12) {
      const interes = saldoCredito * iCredito;
      const abono = Math.min(cuotaMes - interes, saldoCredito);
      interesesPagados += interes;
      saldoCredito -= abono;
      cuotaEsteMes = interes + abono;
    }

    // Costos de tener la casa. Se calculan sobre el valor ACTUAL, no el de
    // compra: el predial y el seguro suben cuando sube el avalúo.
    const tenencia =
      (valorCasa * (p.predialAnualPct / 100)) / 12 +
      (valorCasa * (p.seguroAnualPct / 100)) / 12 +
      (valorCasa * (p.mantenimientoAnualPct / 100)) / 12 +
      p.administracionMensual * Math.pow(1 + gArriendo, m); // la admin sigue al IPC
    costosTenencia += tenencia;

    const salidaComprando = cuotaEsteMes + tenencia;

    // ── Escenario ARRENDAR ─────────────────────────────────────────────────
    arriendoPagado += arriendo;
    const diferencia = salidaComprando - arriendo;

    portafolio *= 1 + iInversion;
    if (diferencia >= 0) {
      // Comprar cuesta más: el que arrienda invierte la diferencia.
      portafolio += diferencia;
      aportadoAlPortafolio += diferencia;
    } else {
      // El arriendo cuesta más: hay que sacar del portafolio para cubrirlo.
      // Omitir esto es el error que hace ver a "arrendar" mejor de lo que es.
      portafolio += diferencia;
      aportadoAlPortafolio += diferencia;
      if (portafolio < 0) portafolio = 0;
    }

    valorCasa *= 1 + gValorizacion;
    arriendo *= 1 + gArriendo;

    if (m % 12 === 0) {
      serie.push({
        anio: m / 12,
        valorCasa: Math.round(valorCasa),
        saldoCredito: Math.round(Math.max(0, saldoCredito)),
        equityCasa: Math.round(valorCasa - Math.max(0, saldoCredito)),
        portafolio: Math.round(portafolio),
      });
    }
  }

  // ── Liquidación final ────────────────────────────────────────────────────
  const gastosVenta = valorCasa * (p.gastosVentaPct / 100);
  const utilidadCasa = Math.max(0, valorCasa - gastosVenta - p.precioCasa);
  const gananciaOcasional = p.exencionViviendaHabitacion
    ? 0
    : utilidadCasa * (p.impuestoGananciaOcasionalPct / 100);

  const patrimonioComprar =
    valorCasa - Math.max(0, saldoCredito) - gastosVenta - gananciaOcasional;

  const utilidadPortafolio = Math.max(0, portafolio - Math.max(0, aportadoAlPortafolio));
  const impuestoPortafolio = utilidadPortafolio * (p.impuestoGananciaInversionPct / 100);
  const patrimonioArrendar = portafolio - impuestoPortafolio;

  return {
    patrimonioComprar: Math.round(patrimonioComprar),
    patrimonioArrendar: Math.round(patrimonioArrendar),
    diferencia: Math.round(patrimonioComprar - patrimonioArrendar),
    ganador: patrimonioComprar >= patrimonioArrendar ? "comprar" : "arrendar",

    detalle: {
      desembolsoInicial: Math.round(desembolsoInicial),
      cuotaMensualInicial: Math.round(cuotaMes),
      montoCredito: Math.round(montoCredito),
      valorCasaFinal: Math.round(valorCasa),
      saldoCreditoFinal: Math.round(Math.max(0, saldoCredito)),
      interesesPagados: Math.round(interesesPagados),
      costosTenencia: Math.round(costosTenencia),
      gastosCompra: Math.round(gastosCompra),
      gastosVenta: Math.round(gastosVenta),
      gananciaOcasional: Math.round(gananciaOcasional),
      arriendoPagado: Math.round(arriendoPagado),
      portafolioBruto: Math.round(portafolio),
      aportadoAlPortafolio: Math.round(Math.max(0, aportadoAlPortafolio)),
      impuestoPortafolio: Math.round(impuestoPortafolio),
    },
    serie,
  };
}

/**
 * Busca la valorización anual que empata los dos escenarios. Es el número más
 * útil de todo el módulo: en vez de discutir supuestos, responde "¿cuánto tiene
 * que valorizarse la casa para que comprar valga la pena?". Si el resultado es
 * mayor que la valorización histórica de la zona, la respuesta ya está dada.
 * Bisección: la diferencia crece de forma monótona con la valorización.
 */
export function valorizacionDeEquilibrio(input = {}) {
  let lo = -5, hi = 40;
  const f = (v) => {
    const r = compararCompraVsInversion({ ...input, valorizacionCasaAnual: v });
    return r.patrimonioComprar - r.patrimonioArrendar;
  };
  if (f(lo) > 0) return lo;
  if (f(hi) < 0) return null;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

export const BUY_VS_INVEST_DEFAULTS = DEFAULTS;
