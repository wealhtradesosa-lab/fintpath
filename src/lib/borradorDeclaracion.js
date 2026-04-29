// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · borradorDeclaracion.js — Generador de borrador F-110
//
// PROPÓSITO:
//   Tomar el output del motor fiscal (estimarImpuesto) y los datos cargados
//   por el user, y generar una réplica editable de los 30 renglones más
//   importantes del formulario F-110 de DIAN (persona jurídica).
//
//   El user (o su contador) puede sobrescribir cualquier renglón editable.
//   Los renglones de fórmula se recalculan automáticamente. El borrador
//   final puede exportarse a PDF (futuro) y queda persistido en
//   user.borradorDeclaracion[ownerId][año].
//
// FILOSOFÍA:
//   - Los datos cargados (ingresos, gastos, etc.) son la BASE
//   - El motor calcula los renglones automáticos
//   - El user/contador override puntual cuando es necesario (raro)
//   - Las fórmulas son auditables: cada total muestra de dónde sale
//
// FUENTE LEGAL:
//   Decreto 0359/2020 + Resolución DIAN 0066/2024 (formulario F-110 vigente)
// ═══════════════════════════════════════════════════════════════════════════

// Renglones del F-110 con su descripción oficial DIAN
// Solo incluimos los más relevantes para el 95% de los casos.
// Los renglones de dividendos múltiples (50-56) y obras por impuestos (100-102)
// se omiten salvo que el user explícitamente los necesite (futuro).

/**
 * Genera el borrador F-110 para un owner jurídica.
 *
 * @param {object} user - User completo
 * @param {object} owner - El owner persona jurídica
 * @param {object} estimacion - Output de estimarImpuesto(user)
 * @param {number} ano - Año gravable (default 2025)
 * @returns {Array} renglones [{numero, concepto, valor, tipo, fuente, articulo, calc?, destacado?, seccion?}]
 *                  donde tipo es 'editable' (user puede tocar) o 'formula' (recalcula)
 */
export function generarBorradorF110(user, owner, estimacion, ano = 2025) {
  if (!owner || owner.type !== "juridica") return null;

  const det = estimacion?.detalle?.find(d => d.name === owner.name);
  if (!det) return null;

  const trm = user.trm || 4200;

  // ── Lectura de overrides persistidos ─────────────────────────────────────
  const overrides = user?.borradorDeclaracion?.[owner.id]?.[ano] || {};
  const v = (renglon, autoValue) => {
    return overrides[renglon] != null ? Number(overrides[renglon]) : autoValue;
  };

  // ── Cálculo de patrimonio desde inv + deu ───────────────────────────────
  const oInv = (user.inv || []).filter(i => i.owner === owner.id && i.sim !== false);
  const oDeu = (user.deu || []).filter(d => d.owner === owner.id && d.sim !== false);

  // Efectivo: cuentas bancarias y similares
  const efectivo = oInv
    .filter(i => i.fiscalCode === "INV_CUENTA_BANCARIA" || i.tipo === "cash" || i.tp === "cash")
    .reduce((s, i) => s + (Number(i.valor || i.va || i.cv) || 0) * (i.moneda === "USD" ? trm : 1), 0);

  // Inversiones financieras: CDT, equity, fondos
  const inversionesFinancieras = oInv
    .filter(i => i.fiscalCode === "INV_CDT" || i.tipo === "cdt" || i.tipo === "equity" || i.tipo === "Equity" || i.fiscalCode === "INV_FONDOS_INVERSION")
    .reduce((s, i) => s + (Number(i.valor || i.va || i.cv) || 0) * (i.moneda === "USD" ? trm : 1), 0);

  // Propiedades (inmuebles): usar valor de compra como costo fiscal
  const propiedades = oInv
    .filter(i => i.fiscalCode === "INV_INMUEBLE_ARRENDADO" || /Real Estate|Bodega|Local Comercial|Inmueble/i.test(i.tipo || i.tp || ""))
    .reduce((s, i) => s + (Number(i.ubi || i.va || i.vc) || 0) * (i.moneda === "USD" ? trm : 1), 0);

  // Pasivos: suma deudas
  const pasivos = oDeu.reduce((s, d) => s + (Number(d.saldo || d.s) || 0), 0);

  // ── Cálculo de ingresos por categoría F-110 ─────────────────────────────
  const oIng = (user.ingresos || []).filter(i => i.owner === owner.id && i.sim !== false);

  // Renglón 47: ingresos brutos actividades ordinarias (arriendos + operacional)
  const ingActividades = oIng
    .filter(i =>
      i.fiscalCode === "NOL_ARRIENDO_INMUEBLE" ||
      i.fiscalCode === "NOL_ARRIENDO_BIENES_MUEBLES" ||
      i.fiscalCode === "ING_JUR_OPERACIONAL"
    )
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? trm : 1), 0);

  // Renglón 48: ingresos financieros
  const ingFinancieros = oIng
    .filter(i =>
      i.fiscalCode === "CAP_INTERESES_BANCARIOS" ||
      i.fiscalCode === "CAP_RENDIMIENTO_GENERICO" ||
      i.fiscalCode === "CAP_FIC"
    )
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? trm : 1), 0);

  // Renglón 51: dividendos gravados
  const ingDividendos = oIng
    .filter(i =>
      i.fiscalCode === "DIV_DIVIDENDOS_GRAVADOS" ||
      i.fiscalCode === "DIV_INTERSOCIETARIOS"
    )
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? trm : 1), 0);

  // ── Cálculo de gastos por categoría F-110 ───────────────────────────────
  const allGastos = Object.values(user.gas || {}).flat()
    .filter(g => g.owner === owner.id && g.sim !== false);

  // Renglón 63: gastos administración (servicios + nómina + admin)
  const gastosAdmin = allGastos
    .filter(g => ["Servicios", "Nómina", "Mantenimiento", "Seguros", "Educación",
                   "Transporte", "Representación", "Comunicaciones", "Suscripciones",
                   "Impuesto", "Predial"].includes(g.cat))
    .reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);

  // Renglón 65: gastos financieros (intereses deudas)
  const gastosFinancieros = oDeu.reduce((s, d) => {
    const tasa = Number(d.tasaAnual || d.t || 0) / 100;
    const saldo = Number(d.saldo || d.s || 0);
    return s + (saldo * tasa);
  }, 0);

  // Renglón 66: otros gastos (cubre lo que no encaje en admin ni financiero)
  const gastosOtros = allGastos
    .filter(g => !["Servicios", "Nómina", "Mantenimiento", "Seguros", "Educación",
                    "Transporte", "Representación", "Comunicaciones", "Suscripciones",
                    "Impuesto", "Predial"].includes(g.cat))
    .reduce((s, g) => s + (Number(g.m) || 0) * 12, 0);

  // ── Retenciones desde el módulo central ─────────────────────────────────
  const retencionAuto = det?.retencionDesglose?.total || det?.retefuenteCalc || 0;

  // Descuentos tributarios aplicados (con tope 25%)
  const descuentosTributarios = det?.descuentosAplicados || 0;

  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCCIÓN DE RENGLONES
  // ═══════════════════════════════════════════════════════════════════════
  const renglones = [
    // ── PATRIMONIO ────────────────────────────────────────────────────────
    { seccion: "patrimonio", numero: 36, concepto: "Efectivo y equivalentes al efectivo", valor: v(36, efectivo), auto: efectivo, tipo: "editable", fuente: "Inversiones tipo cuenta bancaria", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 37, concepto: "Inversiones e instrumentos financieros", valor: v(37, inversionesFinancieras), auto: inversionesFinancieras, tipo: "editable", fuente: "Inversiones CDT/equity/fondos", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 38, concepto: "Cuentas, documentos y arrendamientos por cobrar", valor: v(38, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 39, concepto: "Inventarios", valor: v(39, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 40, concepto: "Activos intangibles", valor: v(40, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 42, concepto: "Propiedades, planta y equipo, propiedades de inversión", valor: v(42, propiedades), auto: propiedades, tipo: "editable", fuente: "Inversiones tipo Real Estate (valor de compra)", articulo: "Art. 261 ET" },
    { seccion: "patrimonio", numero: 43, concepto: "Otros activos", valor: v(43, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "patrimonio", numero: 44, concepto: "TOTAL PATRIMONIO BRUTO", tipo: "formula", destacado: true,
      calc: (vals) => (vals[36] || 0) + (vals[37] || 0) + (vals[38] || 0) + (vals[39] || 0) + (vals[40] || 0) + (vals[42] || 0) + (vals[43] || 0) },
    { seccion: "patrimonio", numero: 45, concepto: "Pasivos", valor: v(45, pasivos), auto: pasivos, tipo: "editable", fuente: "Deudas cargadas (saldo)" },
    { seccion: "patrimonio", numero: 46, concepto: "TOTAL PATRIMONIO LÍQUIDO", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[44] || 0) - (vals[45] || 0)) },

    // ── INGRESOS ─────────────────────────────────────────────────────────
    { seccion: "ingresos", numero: 47, concepto: "Ingresos brutos de actividades ordinarias", valor: v(47, ingActividades), auto: ingActividades, tipo: "editable", fuente: "Ingresos arriendos + operacional" },
    { seccion: "ingresos", numero: 48, concepto: "Ingresos financieros", valor: v(48, ingFinancieros), auto: ingFinancieros, tipo: "editable", fuente: "Ingresos CDT/intereses/rendimientos" },
    { seccion: "ingresos", numero: 51, concepto: "Dividendos y participaciones gravadas tarifa general", valor: v(51, ingDividendos), auto: ingDividendos, tipo: "editable", fuente: "Dividendos cargados" },
    { seccion: "ingresos", numero: 57, concepto: "Otros ingresos", valor: v(57, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)" },
    { seccion: "ingresos", numero: 58, concepto: "TOTAL INGRESOS BRUTOS", tipo: "formula", destacado: true,
      calc: (vals) => (vals[47] || 0) + (vals[48] || 0) + (vals[51] || 0) + (vals[57] || 0) },
    { seccion: "ingresos", numero: 59, concepto: "Devoluciones, rebajas y descuentos en ventas", valor: v(59, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "ingresos", numero: 60, concepto: "Ingresos no constitutivos de renta ni GO (INCRNGO)", valor: v(60, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 36-3 ET" },
    { seccion: "ingresos", numero: 61, concepto: "TOTAL INGRESOS NETOS", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[58] || 0) - (vals[59] || 0) - (vals[60] || 0)) },

    // ── COSTOS Y GASTOS ──────────────────────────────────────────────────
    { seccion: "costos", numero: 62, concepto: "Costos", valor: v(62, 0), auto: 0, tipo: "editable", fuente: "Manual (gastos directos venta)" },
    { seccion: "costos", numero: 63, concepto: "Gastos de administración", valor: v(63, gastosAdmin), auto: gastosAdmin, tipo: "editable", fuente: "Gastos: nómina, servicios, mantenimiento, seguros..." },
    { seccion: "costos", numero: 64, concepto: "Gastos de distribución y ventas", valor: v(64, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "costos", numero: 65, concepto: "Gastos financieros", valor: v(65, gastosFinancieros), auto: gastosFinancieros, tipo: "editable", fuente: "Intereses sobre deudas cargadas" },
    { seccion: "costos", numero: 66, concepto: "Otros gastos y deducciones", valor: v(66, gastosOtros), auto: gastosOtros, tipo: "editable", fuente: "Gastos: otros + deducciones avanzadas (depreciación, CT&I...)" },
    { seccion: "costos", numero: 67, concepto: "TOTAL COSTOS Y GASTOS DEDUCIBLES", tipo: "formula", destacado: true,
      calc: (vals) => (vals[62] || 0) + (vals[63] || 0) + (vals[64] || 0) + (vals[65] || 0) + (vals[66] || 0) },

    // ── RENTA ────────────────────────────────────────────────────────────
    { seccion: "renta", numero: 72, concepto: "Renta líquida ordinaria del ejercicio", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[61] || 0) - (vals[67] || 0)) },
    { seccion: "renta", numero: 74, concepto: "Compensaciones (pérdidas años anteriores)", valor: v(74, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 147 ET" },
    { seccion: "renta", numero: 75, concepto: "Renta líquida", tipo: "formula", destacado: false,
      calc: (vals) => Math.max(0, (vals[72] || 0) - (vals[74] || 0)) },
    { seccion: "renta", numero: 76, concepto: "Renta presuntiva", valor: v(76, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 188 ET" },
    { seccion: "renta", numero: 77, concepto: "Renta exenta", valor: v(77, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "renta", numero: 78, concepto: "Rentas gravables", valor: v(78, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "renta", numero: 79, concepto: "RENTA LÍQUIDA GRAVABLE", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, Math.max(vals[75] || 0, vals[76] || 0) - (vals[77] || 0) + (vals[78] || 0)) },

    // ── IMPUESTO ─────────────────────────────────────────────────────────
    { seccion: "impuesto", numero: 84, concepto: "Impuesto sobre las rentas líquidas gravables (35%)", tipo: "formula", destacado: true,
      calc: (vals) => (vals[79] || 0) * 0.35 },
    { seccion: "impuesto", numero: 91, concepto: "Total impuesto sobre las rentas líquidas gravables", tipo: "formula",
      calc: (vals) => (vals[84] || 0) },
    { seccion: "impuesto", numero: 93, concepto: "Descuentos tributarios", valor: v(93, descuentosTributarios), auto: descuentosTributarios, tipo: "editable", fuente: "Descuentos cargados (CT&I, donaciones, IVA activos...) con tope 25%", articulo: "Art. 256-259 ET" },
    { seccion: "impuesto", numero: 94, concepto: "Impuesto neto de renta", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[91] || 0) - (vals[93] || 0)) },
    { seccion: "impuesto", numero: 99, concepto: "TOTAL IMPUESTO A CARGO", tipo: "formula", destacado: true,
      calc: (vals) => (vals[94] || 0) },

    // ── LIQUIDACIÓN ──────────────────────────────────────────────────────
    { seccion: "liquidacion", numero: 103, concepto: "Anticipo renta liquidado año gravable anterior", valor: v(103, 0), auto: 0, tipo: "editable", fuente: "Manual (consultar declaración anterior)" },
    { seccion: "liquidacion", numero: 104, concepto: "Saldo a favor año anterior sin solicitud devolución", valor: v(104, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "liquidacion", numero: 105, concepto: "Autorretenciones", valor: v(105, 0), auto: 0, tipo: "editable", fuente: "Manual (certificados autorretención)" },
    { seccion: "liquidacion", numero: 106, concepto: "Otras retenciones (banco/inquilinos)", valor: v(106, retencionAuto), auto: retencionAuto, tipo: "editable", fuente: "Calculado automáticamente desde retenciones por ingreso" },
    { seccion: "liquidacion", numero: 107, concepto: "Total retenciones año gravable", tipo: "formula",
      calc: (vals) => (vals[105] || 0) + (vals[106] || 0) },
    { seccion: "liquidacion", numero: 108, concepto: "Anticipo renta para el año gravable siguiente", valor: v(108, 0), auto: 0, tipo: "editable", fuente: "Manual (75% del impuesto neto típicamente)", articulo: "Art. 807 ET" },
    { seccion: "liquidacion", numero: 111, concepto: "Saldo a pagar por impuesto", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[99] || 0) - (vals[103] || 0) - (vals[104] || 0) - (vals[107] || 0) + (vals[108] || 0)) },
    { seccion: "liquidacion", numero: 112, concepto: "Sanciones", valor: v(112, 0), auto: 0, tipo: "editable", fuente: "Manual" },
    { seccion: "liquidacion", numero: 113, concepto: "TOTAL SALDO A PAGAR", tipo: "formula", destacado: true,
      calc: (vals) => (vals[111] || 0) + (vals[112] || 0) },
    { seccion: "liquidacion", numero: 114, concepto: "TOTAL SALDO A FAVOR", tipo: "formula",
      calc: (vals) => Math.max(0, (vals[103] || 0) + (vals[104] || 0) + (vals[107] || 0) - (vals[99] || 0) - (vals[108] || 0)) },
  ];

  // ── Resolver fórmulas en orden ──────────────────────────────────────────
  return resolverRenglones(renglones);
}

/**
 * Recalcula los renglones de fórmula en orden, propagando valores.
 * Asume que los renglones están en orden topológico (cada formula solo
 * depende de renglones que aparecen antes en la lista).
 */
export function resolverRenglones(renglones) {
  const valores = {};

  // Pass 1: capturar valores editables/auto
  renglones.forEach(r => {
    if (r.tipo === "editable") {
      valores[r.numero] = Number(r.valor) || 0;
    }
  });

  // Pass 2: calcular fórmulas en orden
  renglones.forEach(r => {
    if (r.tipo === "formula" && typeof r.calc === "function") {
      r.valor = r.calc(valores);
      valores[r.numero] = r.valor;
    }
  });

  return renglones;
}

/**
 * Aplica un override del user al borrador y retorna renglones recalculados.
 *
 * @param {Array} renglones - Renglones actuales
 * @param {number} numero - Número del renglón a sobrescribir
 * @param {number|null} valor - Nuevo valor, o null para resetear a auto
 * @returns {Array} Renglones recalculados
 */
export function aplicarOverride(renglones, numero, valor) {
  const updated = renglones.map(r => {
    if (r.numero !== numero) return r;
    if (valor === null || valor === "") {
      // Reset a auto
      return { ...r, valor: r.auto, _override: false };
    }
    return { ...r, valor: Number(valor) || 0, _override: true };
  });
  return resolverRenglones(updated);
}

/**
 * Etiquetas legibles de las secciones para agrupar la UI.
 */
export const SECCIONES_F110 = {
  patrimonio: { label: "Patrimonio", icon: "🏛️", color: "#a78bfa" },
  ingresos: { label: "Ingresos", icon: "💰", color: "#22c55e" },
  costos: { label: "Costos y gastos deducibles", icon: "📋", color: "#f59e0b" },
  renta: { label: "Renta", icon: "📊", color: "#3b82f6" },
  impuesto: { label: "Impuesto", icon: "🧾", color: "#ef4444" },
  liquidacion: { label: "Liquidación privada", icon: "💳", color: "#06b6d4" },
};
