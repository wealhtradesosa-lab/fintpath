// Prima/Bono: ingreso laboral NO mensual. Se carga como TOTAL ANUAL
// (frecuencia "anual" + mes en que se cobró). El flujo lo mensualiza ÷ 12,
// taxCO lo recibe una sola vez vía totalAnualItem (fiscalCode LAB_PRESTACIONES_PRIMA
// → primaAnual → renta de trabajo) y nunca cuenta como pasivo.
import { totalAnualItem } from "./flowHelpers.js";

export const CAT_PRIMA_BONO = "Prima/Bono";
export const LABEL_PRIMA_BONO = "Prima o bonificación laboral";
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export const esPrimaBono = (i) => String(i?.categoria || "").trim() === CAT_PRIMA_BONO;

/** Nombre visible de una categoría en resúmenes. */
export const labelCategoria = (cat) => (cat === CAT_PRIMA_BONO ? LABEL_PRIMA_BONO : cat);

/** Deja el ítem como anual: mensual = total del año, sin "pagado" (que lo pondría en $0). */
export function normalizarPrimaBono(item) {
  if (!esPrimaBono(item)) return item;
  const { pagos, montosMensuales, desdeMes, hastaMes, ...resto } = item;
  return { ...resto, frecuencia: "anual", mesPago: Number(item.mesPago) || 1, tipo: item.tipo || "variable", fiscalCode: item.fiscalCode || "LAB_PRESTACIONES_PRIMA" };
}

/** Valor mensual para la lista: total anual ÷ 12. */
export const mensualPrimaBono = (item) => totalAnualItem(normalizarPrimaBono(item)) / 12;

export const notaPrimaBono = (item) => `anual, ya cobrado en ${MESES[(Number(item?.mesPago) || 1) - 1]}`;

/** Ayuda en vivo del campo: «Se mostrará como $X/mes». */
export const ayudaPrimaBono = (totalAnual, fmt) => `Se mostrará como ${fmt(Math.round((Number(totalAnual) || 0) / 12))}/mes`;
