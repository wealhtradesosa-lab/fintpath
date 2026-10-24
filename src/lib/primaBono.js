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

export const MARCA_REVISAR_PRIMA = "Revisa: ¿este valor es mensual o anual?";

/**
 * Migración al cargar: un Prima/Bono guardado como mensual pasa a total anual
 * (mensual × meses activos, ×12 si es todo el año) y queda marcado para revisar.
 * Idempotente por ítem (flag migPrimaBonoAnual).
 */
export function migratePrimaBonoAnual(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.ingresos)) return d;
  d.ingresos = d.ingresos.map((i) => {
    if (!esPrimaBono(i) || i.migPrimaBonoAnual) return i;
    const freq = i.frecuencia || "mensual";
    if (freq === "mensual" || freq === "variable") {
      const total = Math.round(totalAnualItem(i));
      const { pagos, montosMensuales, desdeMes, hastaMes, ...resto } = i;
      return { ...resto, mensual: total, frecuencia: "anual", mesPago: Number(i.mesPago) > 1 ? Number(i.mesPago) : 12,
        fiscalCode: i.fiscalCode || "LAB_PRESTACIONES_PRIMA", migPrimaBonoAnual: true, revisarFrecuencia: true };
    }
    return { ...normalizarPrimaBono(i), migPrimaBonoAnual: true };
  });
  return d;
}

export const MARCA_SUGERIR_PRIMA = "Revisa: ¿es una prima o bono? Muévelo a Prima o bonificación laboral con el total del año";
const _sinTildes = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Nombre parece prima/bono pero la categoría no es Prima/Bono. */
export const nombreParecePrimaBono = (i) => !!i && !esPrimaBono(i) && /\b(prima|primas|bono|bonos|bonificacion|bonificaciones)\b/.test(_sinTildes(i.nombre));
/** Debe mostrarse la sugerencia (no descartada). No modifica nada. */
export const debeSugerirPrimaBono = (i) => nombreParecePrimaBono(i) && !i.sugerenciaPrimaBonoDescartada;
/** «Es mensual, dejarlo así»: descarta para siempre la sugerencia de ese ítem. Idempotente. */
export const descartarSugerenciaPrimaBono = (items, id) =>
  (items || []).map((i) => (i && i.id === id && !i.sugerenciaPrimaBonoDescartada ? { ...i, sugerenciaPrimaBonoDescartada: true } : i));
