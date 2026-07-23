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
  { v: "variable",   l: "Variable",   emoji: "📊", n: 12 },
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
export const getMonto = (item) => Number(item.mensual ?? item.m ?? 0) || 0;

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

// Obtiene el array de 12 montos mensuales para frecuencia "variable".
// Cada posición es el monto del mes correspondiente (índice 0 = enero, 11 = diciembre).
// Ej: [15M, 15M, 8M, 8M, 40M, 15M, 15M, 40M, 8M, 8M, 15M, 15M] → variable
// Retrocompat: si no existe, retorna array de 12 ceros.
export const getMontosMensuales = (item) => {
  if (Array.isArray(item?.montosMensuales) && item.montosMensuales.length === 12) {
    return item.montosMensuales.map(v => Number(v) || 0);
  }
  return new Array(12).fill(0);
};

// Devuelve el promedio de los meses con valor > 0 (los "reales" cargados).
// Uso: proyectar el valor esperado para meses futuros sin cargar.
// Ej: [15M, 15M, 8M, 0, 0, 0, ...] → promedio de reales = (15+15+8)/3 = 12.67M
export const promedioMesesReales = (montosMensuales) => {
  const reales = montosMensuales.filter(m => m > 0);
  if (reales.length === 0) return 0;
  return reales.reduce((s, m) => s + m, 0) / reales.length;
};

// Determina si un mes es FUTURO respecto al mes actual del sistema.
// Solo aplica cuando estamos analizando el año corriente. Para años pasados
// (ej: 2025) todos los meses son pasados. Para años futuros (ej: 2027) todos
// los meses son futuros.
export const esMesFuturo = (año, mes) => {
  const { año: añoActual, mes: mesActual } = getMesActual();
  if (año > añoActual) return true;
  if (año < añoActual) return false;
  return mes > mesActual;
};

// Genera un label visual + color para mostrar la vigencia/frecuencia en la
// tabla de items. Devuelve null si es el caso default (mensual todo el año).
// Uso: en Ingresos/Gastos tabla, mostrar chip junto al nombre del item.
export function labelVigenciaBadge(item) {
  const freq = getFrecuencia(item);
  const MESES_CORTOS = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  if (freq === "variable") {
    const { desde, hasta } = getRangoMeses(item);
    const vigenciaLimitada = desde !== 1 || hasta !== 12;
    const montos = getMontosMensuales(item);
    // Meses reales EN vigencia
    const reales = montos.filter((m, idx) => {
      const mes = idx + 1;
      return mes >= desde && mes <= hasta && m > 0;
    }).length;
    const { año: añoActual } = getMesActual();
    const proyectados = montos.reduce((c, valor, idx) => {
      const mes = idx + 1;
      if (mes < desde || mes > hasta) return c;
      if (valor === 0 && esMesFuturo(añoActual, mes)) return c + 1;
      return c;
    }, 0);
    // Si tiene vigencia limitada, mostrar rango en el label
    if (vigenciaLimitada) {
      return {
        emoji: "📊",
        label: `Var. ${MESES_CORTOS[desde]}–${MESES_CORTOS[hasta]}`,
        sub: proyectados > 0
          ? `${reales} real · ${proyectados} proy.`
          : `${reales} ${reales === 1 ? "mes" : "meses"}`,
        color: "#22d3ee",
      };
    }
    return {
      emoji: "📊",
      label: "Variable",
      sub: proyectados > 0
        ? `${reales} real · ${proyectados} proy.`
        : `${reales} ${reales === 1 ? "mes" : "meses"}`,
      color: "#22d3ee",
    };
  }

  if (freq === "mensual") {
    const { desde, hasta } = getRangoMeses(item);
    // Mensual todo el año: no mostrar chip (es el caso default)
    if (desde === 1 && hasta === 12) return null;
    // Mensual con vigencia limitada
    const nMeses = hasta - desde + 1;
    return {
      emoji: "📅",
      label: `${MESES_CORTOS[desde]}–${MESES_CORTOS[hasta]}`,
      sub: `${nMeses} ${nMeses === 1 ? "mes" : "meses"}`,
      color: "#3b82f6",
    };
  }

  const mesPago = getMesPago(item);
  const mesNombre = MESES_CORTOS[mesPago] || "Ene";

  if (freq === "anual") {
    return { emoji: "🎯", label: "Anual", sub: mesNombre, color: "#a78bfa" };
  }
  if (freq === "unico") {
    return { emoji: "💥", label: "Único", sub: mesNombre, color: "#f97316" };
  }
  if (freq === "semestral") {
    return { emoji: "📆", label: "Semestral", sub: `desde ${mesNombre}`, color: "#22d3ee" };
  }
  if (freq === "trimestral") {
    return { emoji: "🗓️", label: "Trimestral", sub: `desde ${mesNombre}`, color: "#22d3ee" };
  }
  return null;
}

// Calcula el total anual del item (monto por período × frecuencia N).
// Para mensual con vigencia: monto × meses activos.
// Para variable: suma directa de los 12 meses.
// Ej: Rapicredit $6.5M mensual jul-dic → devuelve $39M
// Ej: seguro semestral $2.2M → devuelve $4.4M
// Ej: variable [15M×2, 8M×2, 40M×2, ...] → suma total
//
// UX FIX (18-jul-2026 noche, Santiago): si un item NO mensual está pagado
// en el año actual, retorna 0 — enfoque prospectivo, no aparece más en el año.
export function totalAnualItem(item) {
  const freq = getFrecuencia(item);
  const { año: añoActual } = getMesActual();
  // SEMÁNTICA PAGADO v2 (20-jul-2026): el total ANUAL incluye lo pagado —
  // es plata que salió/entró este año (contable). Solo el promedio
  // PROSPECTIVO (montoPromedioMensual) excluye pagados.
  if (freq === "variable") {
    // Suma reales + proyección en meses futuros vacíos, dentro de vigencia
    const montos = getMontosMensuales(item);
    const { desde, hasta } = getRangoMeses(item);
    const montosEnVigencia = montos.filter((_, idx) => {
      const m = idx + 1;
      return m >= desde && m <= hasta;
    });
    const promProyeccion = promedioMesesReales(montosEnVigencia);
    return montos.reduce((s, valor, idx) => {
      const mes = idx + 1;
      if (mes < desde || mes > hasta) return s; // fuera de vigencia
      if (valor > 0) return s + valor;
      if (esMesFuturo(añoActual, mes)) return s + promProyeccion;
      return s;
    }, 0);
  }
  const monto = Number(item.mensual ?? item.m ?? 0) || 0;
  if (monto === 0) return 0;
  if (freq === "mensual") {
    const activos = mesesActivosDelAño(item);
    return monto * activos;
  }
  return monto * (FRECUENCIAS.find(f => f.v === freq)?.n || 1);
}

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
 * Ej: variable [15,15,8,8,40,15,15,40,8,8,15,15] → suma/12 = ~$15.67M
 *
 * UX FIX (18-jul-2026 noche, Santiago): si un item NO mensual ya está marcado
 * como pagado/recibido en el año actual, retorna 0 — no debería seguir
 * apareciendo como "gasto/ingreso recurrente" en el simulador prospectivo.
 * Los mensuales siempre pesan (son recurrentes cada mes por naturaleza).
 */
export function montoPromedioMensual(item) {
  const freq = getFrecuencia(item);
  // FIX pagado: si es no-mensual y ya está pagado este año, no cuenta
  const { año: añoActual } = getMesActual();
  if (freq !== "mensual" && freq !== "variable" && estaPagadoEnAño(item, añoActual)) {
    return 0;
  }
  // Variable: suma del total anual / 12 (o meses activos si vigencia limitada)
  if (freq === "variable") {
    // Reutilizamos totalAnualItem que ya considera vigencia
    return totalAnualItem(item) / 12;
  }
  const monto = getMonto(item);
  if (monto === 0) return 0;
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
 */
export function montoDelMes(item, año, mes) {
  const freq = getFrecuencia(item);

  // Variable: retornar valor del mes correspondiente.
  // Respeta vigencia limitada (18-jul-2026 noche): si el mes está fuera
  // del rango [desdeMes, hastaMes], no aporta nada.
  // Si el mes es FUTURO y está EN vigencia, proyectar con promedio.
  if (freq === "variable") {
    const { desde, hasta } = getRangoMeses(item);
    // Fuera del rango de vigencia: nada
    if (mes < desde || mes > hasta) return 0;
    const montos = getMontosMensuales(item);
    const valor = montos[mes - 1] || 0;
    if (valor > 0) return valor;
    if (esMesFuturo(año, mes)) {
      // Proyección solo con meses en vigencia
      const montosEnVigencia = montos.filter((_, idx) => {
        const m = idx + 1;
        return m >= desde && m <= hasta;
      });
      return promedioMesesReales(montosEnVigencia);
    }
    return 0;
  }

  const monto = getMonto(item);
  if (monto === 0) return 0;

  // SEMÁNTICA PAGADO v2 (20-jul-2026, Santiago): "pagué el plan en junio →
  // en junio debe VERSE el gasto con su valor; es bueno ver el valor".
  // El flag pagado ya NO borra el item de su mes natural — la realidad
  // mensual (montoDelMes) muestra el pago donde ocurrió. Lo prospectivo
  // (montoPromedioMensual, el hero del simulador) sí lo excluye.

  const mesPago = getMesPago(item);
  switch (freq) {
    case "mensual": {
      // Fase 4 flujo anual: respetar rango de vigencia [desdeMes, hastaMes]
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

// ── FIRE / proyección de patrimonio ──────────────────────────────────────
// Años para alcanzar una meta de patrimonio con rendimiento real COMPUESTO
// sobre el capital actual + aportes mensuales.
//
// CAUSA RAÍZ (20-jul-2026, Santiago): la proyección era lineal
// (falta ÷ ahorro), ignoraba que el patrimonio ya invertido crece solo →
// daba ~80 años cuando con compounding son ~10. Ahora usa valor futuro:
//   FV(n) = P·(1+r)^n + A·((1+r)^n − 1)/r   →   se despeja n (meses).
// retornoRealAnual: default 0.05 (5% real, coherente con la regla del 4%).
// Devuelve AÑOS (number) o null si no se proyecta alcanzar de forma realista.
export function añosParaMeta(actual, meta, aporteMensual, retornoRealAnual = 0.05) {
  if (!(meta > 0)) return null;
  if (actual >= meta) return 0;
  const rm = retornoRealAnual / 12;
  if (rm <= 0) {
    if (aporteMensual <= 0) return null;
    return (meta - actual) / (aporteMensual * 12);
  }
  const base = actual + aporteMensual / rm;
  const num  = meta   + aporteMensual / rm;
  if (base <= 0 || num <= 0) return null; // se está descapitalizando
  const x = num / base;
  if (x <= 1) return 0;
  const n = Math.log(x) / Math.log(1 + rm);
  if (!isFinite(n) || n <= 0) return null;
  return n / 12;
}

// Ingreso ANUAL proveniente solo de INVERSIÓN (arriendo, rendimiento,
// dividendos, inversión) — NO salario/freelance. Convierte USD→COP y
// anualiza según frecuencia. Uso: yield on cost real de los activos.
// CAUSA (20-jul-2026, Santiago): yieldOnCost usaba el ingreso total (con
// salario), inflando el "qué tan bien rentan tus activos".
export function ingresoInversionAnual(ingresos, trm = 1) {
  const cats = ["Arriendo", "Rendimiento", "Dividendos", "Inversión"];
  return (ingresos || []).reduce((s, i) => {
    if (i.sim === false || !cats.includes(i.categoria)) return s;
    const base = (Number(i.mensual) || 0) * (i.moneda === "USD" ? trm : 1);
    return s + montoPromedioMensual({ ...i, mensual: base }) * 12;
  }, 0);
}

// Meses hasta quedar libre de deuda con AMORTIZACIÓN real (considera interés).
// CAUSA (20-jul-2026, Santiago): la fecha usaba saldo/cuota (0% interés) →
// daba una fecha demasiado optimista. Ahora resuelve n por deuda:
//   n = -ln(1 − r·B/P) / ln(1+r)   (r = tasa mensual, B = saldo, P = cuota)
// Se queda libre cuando termina la deuda más larga → max(n_i).
// Si una cuota no cubre el interés (P ≤ B·r), esa deuda no amortiza → aviso.
export function mesesLibreDeuda(deudas) {
  let maxMeses = 0, algunaNoAmortiza = false;
  for (const d of (deudas || [])) {
    const B = Number(d.mt) || 0, P = Number(d.pg) || 0;
    if (B <= 0 || P <= 0) continue;
    const r = (Number(d.ts) || 0) / 100 / 12;
    let n;
    if (r <= 0) { n = B / P; }
    else if (P <= B * r) { algunaNoAmortiza = true; continue; }
    else { n = -Math.log(1 - (r * B) / P) / Math.log(1 + r); }
    if (n > maxMeses) maxMeses = n;
  }
  return { meses: Math.ceil(maxMeses), algunaNoAmortiza };
}

// Valor de un activo en COP (convierte si moneda==="USD"). Los activos con
// moneda ausente se asumen COP (retrocompat). Fixes 20-jul-2026 (Santiago):
// los activos no tenían campo de moneda → USD se contaba como COP.
export const vaCOP = (i, trm = 1) => (Number(i?.va) || 0) * (i?.moneda === "USD" ? trm : 1);
export const vcCOP = (i, trm = 1) => (Number(i?.vc) || 0) * (i?.moneda === "USD" ? trm : 1);

