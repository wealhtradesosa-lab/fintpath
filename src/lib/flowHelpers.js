// ═══════════════════════════════════════════════════════════════════════════
// flowHelpers.js — Motor de flujo de caja con frecuencia y estado por año
//
// PROBLEMA que resuelve:
//   Santiago (family office) señaló que asumir todos los ingresos/gastos
//   como flujo mensual constante desalinea el cash flow real. Ejemplos:
//     • Impuesto carro anual pagado en junio → 11 meses no pesa nada
//     • Seguro salud mamá pagado por año en abril → resto del año sin costo
//     • Dividendos trimestrales de empresa → 4 picos por año
//     • Matrícula colegio en enero → un pico anual
//
// NUEVO MODELO MENTAL:
//   Cada item (ingreso/gasto/deuda) tiene:
//     - frecuencia: "mensual" | "trimestral" | "semestral" | "anual" | "unico"
//     - mesPago: 1-12 (mes de pago, si no es mensual)
//     - pagos: {2026: true, 2027: false} (por año fiscal)
//
//   Motor calcula 2 versiones del cash flow:
//     - montoPromedioMensual(item): pago anual dividido en 12 meses
//     - montoDelMes(item, año, mes): lo que realmente pesa este mes,
//                                    excluyendo lo ya marcado como pagado
//
// RETROCOMPAT:
//   Items existentes sin `frecuencia` → asume "mensual" (comportamiento
//   idéntico al actual). Nada se rompe hasta que el usuario edite el item.
//
// El campo `mensual` (ingresos) / `m` (gastos) mantiene su nombre por
// retrocompat, pero su SEMÁNTICA cambia según la frecuencia:
//   - Si frecuencia === "mensual" → es el monto mensual (como siempre)
//   - Si frecuencia === "anual"   → es el pago anual completo
//   - Si frecuencia === "trimestral" → es el pago trimestral (uno de 4)
//   - Si frecuencia === "semestral" → es el pago semestral (uno de 2)
//   - Si frecuencia === "unico"   → es el pago único
// El motor hace la conversión al promedio mensual internamente.
// ═══════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────
export const FRECUENCIAS = [
  { v: "mensual",    l: "Mensual",    emoji: "📅", n: 12 },
  { v: "trimestral", l: "Trimestral", emoji: "🗓️", n: 4 },
  { v: "semestral",  l: "Semestral",  emoji: "📆", n: 2 },
  { v: "anual",      l: "Anual",      emoji: "🎯", n: 1 },
  { v: "unico",      l: "Pago único", emoji: "💥", n: 1 },
];

export const MESES = [
  { v: 1,  l: "Enero" },     { v: 2,  l: "Febrero" },  { v: 3,  l: "Marzo" },
  { v: 4,  l: "Abril" },     { v: 5,  l: "Mayo" },     { v: 6,  l: "Junio" },
  { v: 7,  l: "Julio" },     { v: 8,  l: "Agosto" },   { v: 9,  l: "Septiembre" },
  { v: 10, l: "Octubre" },   { v: 11, l: "Noviembre" },{ v: 12, l: "Diciembre" },
];

// ── Helpers básicos ──────────────────────────────────────────────────────

// Extrae el monto base del item, sin importar si es ingreso (mensual) o
// gasto (m) — soporta ambas keys.
const getMonto = (item) => Number(item.mensual ?? item.m ?? 0) || 0;

// Obtiene la frecuencia con default "mensual" (retrocompat con items viejos)
export const getFrecuencia = (item) => item?.frecuencia || "mensual";

// Obtiene el mes de pago con default enero
export const getMesPago = (item) => Number(item?.mesPago) || 1;

// Factor de conversión: cuántos pagos hay por año según la frecuencia.
// Uso: si el user ingresa el TOTAL ANUAL, dividimos por este factor para
// obtener el "monto por período" que espera el modelo interno.
// Ej: frecuencia="semestral" → factor=2 → total anual / 2 = monto por semestre
export const factorDeFrecuencia = (frecuencia) => {
  const f = FRECUENCIAS.find(x => x.v === frecuencia);
  return f?.n || 12;
};

// Rango de vigencia del item (Fase 4 flujo anual 18-jul-2026).
// Solo aplica a frecuencia MENSUAL. Un ingreso o gasto puede estar activo
// solo entre `desdeMes` y `hastaMes` (ej: Rapicredit paga de julio a
// diciembre → desdeMes=7, hastaMes=12). Default: enero-diciembre (todo el año).
export const getRangoMeses = (item) => ({
  desde: Number(item?.desdeMes) || 1,
  hasta: Number(item?.hastaMes) || 12,
});

// Cuenta cuántos meses del año este item está activo (util para promedio).
export const mesesActivosDelAño = (item) => {
  const freq = getFrecuencia(item);
  if (freq !== "mensual") return null; // solo aplica a mensuales
  const { desde, hasta } = getRangoMeses(item);
  return Math.max(0, hasta - desde + 1);
};

// Verifica si un item está marcado como pagado para un año dado
export const estaPagadoEnAño = (item, año) => {
  if (!item?.pagos) return false;
  return !!item.pagos[año];
};

// ── Motor principal ─────────────────────────────────────────────────────

/**
 * Devuelve el monto promedio mensualizado del item.
 * Ej: impuesto anual $12M → devuelve $1M (12M/12 meses)
 * Ej: dividendo trimestral $3M → devuelve $1M (3M × 4 trimestres / 12 meses)
 * Ej: mensual $47M activo solo 6 meses → devuelve $23.5M (47M × 6 / 12)
 */
export function montoPromedioMensual(item) {
  const monto = getMonto(item);
  if (monto === 0) return 0;
  const freq = getFrecuencia(item);
  // Para mensuales con rango limitado, el promedio se ajusta por meses activos
  if (freq === "mensual") {
    const activos = mesesActivosDelAño(item);
    return (monto * activos) / 12;
  }
  const factor = FRECUENCIAS.find(f => f.v === freq)?.n || 12;
  return (monto * factor) / 12;
}

/**
 * Devuelve el monto que pesa en un mes específico, considerando frecuencia,
 * mes de pago, rango de vigencia y estado (pagado/pendiente).
 * @param {Object} item - El ingreso/gasto/deuda
 * @param {number} año - Año calendario (ej: 2026)
 * @param {number} mes - Mes calendario (1-12)
 * @returns {number} Monto en ese mes específico
 */
export function montoDelMes(item, año, mes) {
  const monto = getMonto(item);
  if (monto === 0) return 0;
  const freq = getFrecuencia(item);

  // Si ya está pagado en este año, no pesa en meses restantes
  // (excepto los mensuales, que siempre pesan cada mes)
  if (freq !== "mensual" && estaPagadoEnAño(item, año)) return 0;

  const mesPago = getMesPago(item);
  switch (freq) {
    case "mensual": {
      // Fase 4 flujo anual: respetar rango de vigencia [desdeMes, hastaMes]
      // Default: enero-diciembre (todo el año). Si el mes está fuera del rango,
      // el item no pesa (ej: Rapicredit inactivo antes de julio).
      const { desde, hasta } = getRangoMeses(item);
      if (mes < desde || mes > hasta) return 0;
      return monto;
    }
    case "anual":
    case "unico":
      // Solo pesa en el mes de pago
      return mes === mesPago ? monto : 0;
    case "semestral": {
      // Pesa en el mesPago y 6 meses después (con wrap)
      const otro = ((mesPago - 1 + 6) % 12) + 1;
      return (mes === mesPago || mes === otro) ? monto : 0;
    }
    case "trimestral": {
      // Pesa en el mesPago y cada 3 meses (4 veces al año, con wrap)
      const m2 = ((mesPago - 1 + 3) % 12) + 1;
      const m3 = ((mesPago - 1 + 6) % 12) + 1;
      const m4 = ((mesPago - 1 + 9) % 12) + 1;
      return [mesPago, m2, m3, m4].includes(mes) ? monto : 0;
    }
    default:
      return monto;
  }
}

/**
 * Obtiene el mes actual (1-12) y el año actual.
 * Wrapper util para consistencia.
 */
export function getMesActual() {
  const now = new Date();
  return { año: now.getFullYear(), mes: now.getMonth() + 1 };
}

/**
 * Suma promediada mensual de una colección de items.
 * (equivale a lo que hacía el motor viejo asumiendo todo mensual)
 */
export function sumaPromedioMensual(items) {
  return (items || []).reduce((sum, item) => {
    if (item.sim === false) return sum;
    return sum + montoPromedioMensual(item);
  }, 0);
}

/**
 * Suma del mes actual de una colección de items, respetando frecuencia
 * y estado pagado/pendiente.
 */
export function sumaDelMes(items, año, mes) {
  return (items || []).reduce((sum, item) => {
    if (item.sim === false) return sum;
    return sum + montoDelMes(item, año, mes);
  }, 0);
}

/**
 * Devuelve un array de 12 elementos con la suma de cada mes del año.
 * Útil para gráfico de barras de flujo anual.
 */
export function sumasPorMesDelAño(items, año) {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    return sumaDelMes(items, año, mes);
  });
}

/**
 * Marca un item como pagado (o desmarca) para un año dado.
 * Devuelve un nuevo objeto item (immutable).
 */
export function togglePagado(item, año) {
  const pagos = { ...(item.pagos || {}) };
  pagos[año] = !pagos[año];
  if (!pagos[año]) delete pagos[año]; // limpia falsy para no acumular basura
  return { ...item, pagos };
}
