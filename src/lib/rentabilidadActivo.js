// 31-oct-2026 — ¿Cuánto te rinde cada activo?
// Rendimiento anual = renta neta (lo que entra menos los gastos propios del
// activo) + valorización anual declarada, sobre el valor de hoy. Se compara
// con la inflación: por debajo, el activo pierde poder de compra aunque suba.
// Un activo sin renta ni valorización cargadas NO rinde 0 %: no se sabe, y se
// dice así (estado "sin_dato") en vez de inventarlo.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {Array} activos  items de patrimonio (ya filtrados: sim !== false)
 * @param {Object} o
 *   valor(i)            valor de hoy en pesos
 *   rentaAnual[id]      ingresos vinculados al activo, en pesos al año
 *   gastoAnual[id]      gastos vinculados al activo, en pesos al año
 *   inflacion           % anual
 */
export function rentabilidadActivos(activos, { valor, rentaAnual = {}, gastoAnual = {}, inflacion = 5 }) {
  const filas = (activos || []).map((i) => {
    const va = num(valor(i));
    const vinculada = num(rentaAnual[i.id]);
    // Sin ingresos vinculados, la tasa de renta escrita en el activo (si la hay).
    const renta = vinculada > 0 ? vinculada : va * (num(i.tasa) / 100);
    const gastos = num(gastoAnual[i.id]);
    const rentaNeta = renta - gastos;
    const valPct = num(i.valorizacionPct);
    const valorizacion = va * (valPct / 100);
    const sinDato = renta === 0 && gastos === 0 && valPct === 0;
    const pct = va > 0 ? ((rentaNeta + valorizacion) / va) * 100 : 0;
    const real = pct - inflacion;
    const estado = sinDato ? "sin_dato"
      : rentaNeta < 0 && rentaNeta + valorizacion < 0 ? "pierde"
      : real < 0 ? "bajo_inflacion"
      : "gana";
    return { id: i.id, item: i, va, renta, gastos, rentaNeta, valorizacion, pct, real, estado };
  });
  const conDato = filas.filter((f) => f.estado !== "sin_dato").sort((a, b) => b.pct - a.pct);
  const sinDato = filas.filter((f) => f.estado === "sin_dato").sort((a, b) => b.va - a.va);
  const vConDato = conDato.reduce((s, f) => s + f.va, 0);
  const promedio = vConDato > 0 ? conDato.reduce((s, f) => s + f.pct * f.va, 0) / vConDato : null;
  return {
    conDato, sinDato, promedio, inflacion,
    valorSinDato: sinDato.reduce((s, f) => s + f.va, 0),
    nPierden: conDato.filter((f) => f.estado === "pierde").length,
    nBajoInflacion: conDato.filter((f) => f.estado === "bajo_inflacion").length,
  };
}
