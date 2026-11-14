// ═════════════════════════════════════════════════════════════════════════
// ingresosExtra.js — Ingresos de una sola vez sobre un ingreso que ya existe
// (o un concepto nuevo). Mismo modelo que gastosExtra.js.
//
// 14-nov-2026 (Santiago: "y lo mismo un ingreso, uno puede reportar un ingreso
// extraordinario"; "al momento de agregar está la opción de crear algo que se
// repite o de informar un extra asociado a algún ítem, o completamente nuevo").
//
// El extra vive dentro del ingreso (ing.extras) y entra en el mes en que llega
// la plata y en el total del año. NO es recurrente: no entra en promedios ni en
// el nivel de libertad. Su impuesto (p. ej. ganancia ocasional de una venta) se
// calcula en Impuestos; aquí solo cuenta en el flujo de caja.
//
// Estructura: ing.extras = [{ id, año, mes, monto, moneda, nota, registradoEl }]
// ═════════════════════════════════════════════════════════════════════════
import { TRM_PROVISIONAL, trmUsable } from "./trm.js";

const fx = (moneda, trm) => (moneda === "USD" ? (trmUsable(trm) ?? TRM_PROVISIONAL) : 1);

/** Lo que entra en un mes por los ingresos únicos de `ing`, en pesos. */
export function extrasIngresoDelMes(ing, año, mes, trm) {
  let t = 0;
  (ing?.extras || []).forEach((x) => {
    if (Number(x.año) === Number(año) && Number(x.mes) === Number(mes)) t += (Number(x.monto) || 0) * fx(x.moneda || ing.moneda, trm);
  });
  return t;
}

/** Total de ingresos únicos de `ing` en el año, en pesos. */
export function extrasIngresoDelAño(ing, año, trm) {
  let t = 0;
  for (let m = 1; m <= 12; m++) t += extrasIngresoDelMes(ing, año, m, trm);
  return t;
}

/** Valor de un extra en pesos. */
export const extraIngresoEnPesos = (x, ing, trm) => (Number(x?.monto) || 0) * fx(x?.moneda || ing?.moneda, trm);

const nuevoExtra = (d, hoy = new Date()) => ({
  id: "ix_" + hoy.getTime().toString(36) + Math.random().toString(36).slice(2, 5),
  año: Number(d.año), mes: Number(d.mes), monto: Number(d.monto) || 0, moneda: d.moneda || "COP",
  nota: (d.nota || "").trim(), registradoEl: hoy.toISOString().slice(0, 10),
});

/** Agrega el extra al ingreso con ese id. */
export function registrarExtraIngreso(ingresos, id, datos, hoy) {
  return (ingresos || []).map((i) => (i.id === id ? { ...i, extras: [...(i.extras || []), nuevoExtra(datos, hoy)] } : i));
}

/** Crea un ingreso nuevo sin monto recurrente que nace con este extra. */
export function crearIngresoConExtra(ingresos, { nombre, categoria, owner, fiscalCode }, datos, hoy = new Date()) {
  const item = {
    id: "ing_" + hoy.getTime().toString(36),
    nombre: (nombre || "").trim() || categoria || "Ingreso",
    categoria: categoria || "Otro",
    mensual: 0, frecuencia: "mensual", soloExtras: true,
    owner: owner || "", ...(fiscalCode ? { fiscalCode } : {}),
    extras: [nuevoExtra(datos, hoy)],
  };
  return [...(ingresos || []), item];
}

export function eliminarExtraIngreso(ingresos, id, extraId) {
  return (ingresos || [])
    .map((i) => (i.id === id ? { ...i, extras: (i.extras || []).filter((x) => x.id !== extraId) } : i))
    // Un ingreso que solo existía por sus ingresos únicos se va con el último.
    .filter((i) => !(i.id === id && i.soloExtras && !(i.extras || []).length));
}

/**
 * Corrige un ingreso único ya registrado (valor, moneda, mes, nota). Si el
 * ingreso solo existe por sus ingresos únicos, `campos` cambia también su
 * nombre, tipo y dueño.
 */
export function editarExtraIngreso(ingresos, id, extraId, datos, campos) {
  return (ingresos || []).map((i) => {
    if (i.id !== id) return i;
    const extras = (i.extras || []).map((x) => (x.id === extraId
      ? { ...x, año: Number(datos.año), mes: Number(datos.mes), monto: Number(datos.monto) || 0, moneda: datos.moneda || "COP", nota: (datos.nota || "").trim() }
      : x));
    const base = i.soloExtras && campos ? {
      nombre: (campos.nombre || "").trim() || campos.categoria || i.nombre,
      categoria: campos.categoria || i.categoria,
      owner: campos.owner ?? i.owner,
    } : {};
    return { ...i, ...base, extras };
  });
}

/**
 * Convierte un ingreso que estaba como recurrente (p. ej. «una vez al año, todos
 * los años») en un ingreso único: deja de repetirse y queda una sola vez, en el
 * mes que se elija. Conserva id, nombre, dueño y moneda; descarta lo recurrente
 * (frecuencia, mes de pago, vigencia, montos por mes, aportes, retención).
 * 14-nov-2026 (Santiago registró una herencia como "una vez al año" y el
 * sistema la repetía cada enero).
 */
export function convertirEnUnicoIngreso(ingresos, id, { nombre, categoria, owner }, datos, hoy = new Date()) {
  return (ingresos || []).map((i) => {
    if (i.id !== id) return i;
    const fc = categoria === "Herencia o donación" ? { fiscalCode: "GO_HERENCIA" } : {};
    return {
      id: i.id,
      nombre: (nombre || "").trim() || i.nombre || categoria || "Ingreso",
      categoria: categoria || "Otro",
      owner: owner ?? i.owner ?? "",
      ...(i.sim === false ? { sim: false } : {}),
      ...fc,
      mensual: 0, frecuencia: "mensual", soloExtras: true,
      extras: [nuevoExtra(datos, hoy)],
    };
  });
}

/** Monto de UN pago del ingreso recurrente, para precargar la conversión. */
export function montoDeUnPago(i) {
  // `mensual` es el monto de un pago del período: el mensual en "mensual", el
  // pago completo en "anual" (ver flowHelpers).
  return Number(i?.mensual) || 0;
}

