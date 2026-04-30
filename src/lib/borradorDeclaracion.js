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
  const oInv = (user.inv || []).filter(i => i.owner === owner.id && i.sim !== false && !i.excluirDeclaracion);
  const oDeu = (user.deu || []).filter(d => d.owner === owner.id && d.sim !== false && !d.excluirDeclaracion);

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
  const oIng = (user.ingresos || []).filter(i => i.owner === owner.id && i.sim !== false && !i.excluirDeclaracion);

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
    .filter(g => g.owner === owner.id && g.sim !== false && !g.excluirDeclaracion);

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
    { seccion: "patrimonio", numero: 36, concepto: "Efectivo y equivalentes al efectivo", valor: v(36, efectivo), auto: efectivo, tipo: "editable", fuente: "Inversiones tipo cuenta bancaria", articulo: "Art. 261 ET",
      tip: "🏦 Saldo de las cuentas bancarias de la sociedad (corrientes y de ahorros) al 31 de diciembre. Aquí NO van CDT ni inversiones (esos van al renglón 37). Si tenés cuentas en USD, convertí a TRM del 31-dic." },
    { seccion: "patrimonio", numero: 37, concepto: "Inversiones e instrumentos financieros", valor: v(37, inversionesFinancieras), auto: inversionesFinancieras, tipo: "editable", fuente: "Inversiones CDT/equity/fondos", articulo: "Art. 261 ET",
      tip: "📈 CDT, fondos de inversión colectiva (FIC), acciones, bonos, criptomonedas. Para acciones de sociedades NO listadas en bolsa, va el costo fiscal (lo que se pagó). Para listadas, valor de mercado al 31-dic." },
    { seccion: "patrimonio", numero: 38, concepto: "Cuentas, documentos y arrendamientos por cobrar", valor: v(38, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET",
      tip: "📋 Cuentas por cobrar a clientes, préstamos a terceros, anticipos a proveedores, arriendos pendientes de cobro al 31-dic. ⚠️ Si tenés provisión de cartera, va el saldo NETO (cuentas - provisión) y la provisión va como deducción." },
    { seccion: "patrimonio", numero: 39, concepto: "Inventarios", valor: v(39, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET",
      tip: "📦 Mercancías, materias primas, productos en proceso o terminados al 31-dic. Para sociedades de servicios (rentas pasivas, consultoría) este renglón típicamente va en $0." },
    { seccion: "patrimonio", numero: 40, concepto: "Activos intangibles", valor: v(40, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)", articulo: "Art. 261 ET",
      tip: "💡 Marcas, patentes, software propio, licencias, derechos de autor, plusvalía mercantil. Va el costo fiscal (lo que se pagó por desarrollarlo o adquirirlo) menos amortizaciones acumuladas." },
    { seccion: "patrimonio", numero: 42, concepto: "Propiedades, planta y equipo, propiedades de inversión", valor: v(42, propiedades), auto: propiedades, tipo: "editable", fuente: "Inversiones tipo Real Estate (valor de compra)", articulo: "Art. 261 ET",
      tip: "🏢 Inmuebles, vehículos, maquinaria, equipos. Va el costo fiscal: lo que se pagó por el activo + mejoras menos depreciación acumulada. Para inmuebles, la DIAN acepta el mayor entre avalúo catastral o costo fiscal." },
    { seccion: "patrimonio", numero: 43, concepto: "Otros activos", valor: v(43, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "📦 Activos que no encajan en las categorías anteriores: gastos pagados por anticipado, depósitos, otros." },
    { seccion: "patrimonio", numero: 44, concepto: "TOTAL PATRIMONIO BRUTO", tipo: "formula", destacado: true,
      formula: "36 + 37 + 38 + 39 + 40 + 42 + 43", articulo: "Art. 261 ET",
      tip: "🧮 Suma de todos los activos. Es la base para calcular el patrimonio líquido (renglón 46) y para verificar la consistencia con la declaración del año anterior.",
      calc: (vals) => (vals[36] || 0) + (vals[37] || 0) + (vals[38] || 0) + (vals[39] || 0) + (vals[40] || 0) + (vals[42] || 0) + (vals[43] || 0) },
    { seccion: "patrimonio", numero: 45, concepto: "Pasivos", valor: v(45, pasivos), auto: pasivos, tipo: "editable", fuente: "Deudas cargadas (saldo)",
      tip: "💳 Saldo total de las deudas de la sociedad al 31-dic: créditos bancarios, proveedores por pagar, impuestos pendientes, obligaciones laborales, retenciones. ⚠️ Solo deudas reales y soportadas — la DIAN audita pasivos sin documentar." },
    { seccion: "patrimonio", numero: 46, concepto: "TOTAL PATRIMONIO LÍQUIDO", tipo: "formula", destacado: true,
      formula: "44 - 45", articulo: "Art. 282 ET",
      tip: "💎 Patrimonio bruto menos pasivos. Es el patrimonio neto fiscal de la sociedad. Si hay diferencia con el patrimonio del año anterior, debe explicarse en el renglón de comparación patrimonial (no incluido aquí).",
      calc: (vals) => Math.max(0, (vals[44] || 0) - (vals[45] || 0)) },

    // ── INGRESOS ─────────────────────────────────────────────────────────
    { seccion: "ingresos", numero: 47, concepto: "Ingresos brutos de actividades ordinarias", valor: v(47, ingActividades), auto: ingActividades, tipo: "editable", fuente: "Ingresos arriendos + operacional",
      tip: "💼 Lo facturado por la actividad principal de la sociedad: ventas de bienes/servicios, arriendos de inmuebles si es la actividad operativa, contratos de prestación de servicios. Va el INGRESO BRUTO antes de descuentos." },
    { seccion: "ingresos", numero: 48, concepto: "Ingresos financieros", valor: v(48, ingFinancieros), auto: ingFinancieros, tipo: "editable", fuente: "Ingresos CDT/intereses/rendimientos",
      tip: "📈 Intereses de CDT, rendimientos de fondos de inversión, intereses por préstamos a terceros, ganancias por valoración de inversiones. ⚠️ El componente inflacionario (50.88% en 2025 para personas naturales) NO aplica a sociedades — las jurídicas declaran 100% del rendimiento." },
    { seccion: "ingresos", numero: 51, concepto: "Dividendos y participaciones gravadas tarifa general", valor: v(51, ingDividendos), auto: ingDividendos, tipo: "editable", fuente: "Dividendos cargados",
      tip: "💵 Dividendos recibidos por la sociedad de OTRAS sociedades. Si la sociedad emisora es residente fiscal en Colombia y los pagó con utilidades ya gravadas, hay descuento por dividendos (Art. 254-1 ET). Para dividendos de sociedades del exterior, se gravan al 35% con descuento por impuestos pagados afuera." },
    { seccion: "ingresos", numero: 57, concepto: "Otros ingresos", valor: v(57, 0), auto: 0, tipo: "editable", fuente: "Manual (no cargado)",
      tip: "📦 Ingresos que no encajan en las categorías anteriores: recuperación de deducciones, indemnizaciones, donaciones recibidas (gravables), reintegros." },
    { seccion: "ingresos", numero: 58, concepto: "TOTAL INGRESOS BRUTOS", tipo: "formula", destacado: true,
      formula: "47 + 48 + 51 + 57",
      tip: "🧮 Suma de todos los ingresos del año. Este es el indicador que la DIAN usa para clasificar a la sociedad como 'gran contribuyente' (>$X UVT) y para determinar topes de auditoría.",
      calc: (vals) => (vals[47] || 0) + (vals[48] || 0) + (vals[51] || 0) + (vals[57] || 0) },
    { seccion: "ingresos", numero: 59, concepto: "Devoluciones, rebajas y descuentos en ventas", valor: v(59, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "↩️ Devoluciones de mercancía, descuentos comerciales otorgados, rebajas por pronto pago. Reduce los ingresos brutos. Para sociedades de servicios típicamente va en $0." },
    { seccion: "ingresos", numero: 60, concepto: "Ingresos no constitutivos de renta ni GO (INCRNGO)", valor: v(60, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 36-3 ET",
      tip: "🛡️ Ingresos que la ley expresamente excluye de la base gravable: utilidades por ajustes inflacionarios, ciertos dividendos exentos, reintegros de aportes, indemnizaciones por seguros de daños. NO confundir con renta exenta (renglón 77)." },
    { seccion: "ingresos", numero: 61, concepto: "TOTAL INGRESOS NETOS", tipo: "formula", destacado: true,
      formula: "58 - 59 - 60",
      tip: "🧮 Ingresos brutos menos devoluciones e INCRNGO. Es la base sobre la que se aplican los costos y gastos deducibles para calcular la renta líquida.",
      calc: (vals) => Math.max(0, (vals[58] || 0) - (vals[59] || 0) - (vals[60] || 0)) },

    // ── COSTOS Y GASTOS ──────────────────────────────────────────────────
    { seccion: "costos", numero: 62, concepto: "Costos", valor: v(62, 0), auto: 0, tipo: "editable", fuente: "Manual (gastos directos venta)",
      tip: "🏭 Costo directo de los bienes vendidos o servicios prestados: materia prima, mano de obra directa, costos indirectos de fabricación, costo de mercancías vendidas. Para sociedades de servicios suele ir en $0 o muy bajo." },
    { seccion: "costos", numero: 63, concepto: "Gastos de administración", valor: v(63, gastosAdmin), auto: gastosAdmin, tipo: "editable", fuente: "Gastos: nómina, servicios, mantenimiento, seguros...", articulo: "Art. 107 ET",
      tip: "🏢 Gastos generales del negocio: nómina administrativa, servicios públicos, arriendo de oficina, contador, abogados, mantenimiento, seguros, papelería. ⚠️ Solo son deducibles si tienen RELACIÓN DE CAUSALIDAD con la actividad productora de renta (Art. 107 ET)." },
    { seccion: "costos", numero: 64, concepto: "Gastos de distribución y ventas", valor: v(64, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "📢 Comisiones por ventas, publicidad, fletes de despacho, gastos del equipo comercial, viáticos. Para sociedades de rentas pasivas (inmobiliarias, holdings) suele ir en $0." },
    { seccion: "costos", numero: 65, concepto: "Gastos financieros", valor: v(65, gastosFinancieros), auto: gastosFinancieros, tipo: "editable", fuente: "Intereses sobre deudas cargadas", articulo: "Art. 117-118 ET",
      tip: "💰 Intereses pagados por créditos, gastos bancarios, GMF (50% es deducible). ⚠️ Hay limitación de subcapitalización (Art. 118-1 ET): los intereses con vinculados económicos solo son deducibles hasta 2x el patrimonio líquido." },
    { seccion: "costos", numero: 66, concepto: "Otros gastos y deducciones", valor: v(66, gastosOtros), auto: gastosOtros, tipo: "editable", fuente: "Gastos: otros + deducciones avanzadas (depreciación, CT&I...)",
      tip: "🔧 Depreciación de activos, amortización de intangibles, deducción especial por inversión en CT&I (Art. 158-1 ET, 175% adicional), provisión de cartera (Art. 145 ET), pérdidas operativas reconocidas. Lo que el motor calculó automáticamente desde tus datos." },
    { seccion: "costos", numero: 67, concepto: "TOTAL COSTOS Y GASTOS DEDUCIBLES", tipo: "formula", destacado: true,
      formula: "62 + 63 + 64 + 65 + 66",
      tip: "🧮 Suma de todos los costos y gastos deducibles. La diferencia entre ingresos netos (61) y este renglón da la renta líquida ordinaria.",
      calc: (vals) => (vals[62] || 0) + (vals[63] || 0) + (vals[64] || 0) + (vals[65] || 0) + (vals[66] || 0) },

    // ── RENTA ────────────────────────────────────────────────────────────
    { seccion: "renta", numero: 72, concepto: "Renta líquida ordinaria del ejercicio", tipo: "formula", destacado: true,
      formula: "61 - 67 (si positivo, sino 0)",
      tip: "📊 Si es positivo: utilidad fiscal antes de compensaciones. Si es 0: hay PÉRDIDA OPERATIVA del ejercicio que se puede usar contra utilidades futuras (12 años de plazo, Art. 147 ET).",
      calc: (vals) => Math.max(0, (vals[61] || 0) - (vals[67] || 0)) },
    { seccion: "renta", numero: 74, concepto: "Compensaciones (pérdidas años anteriores)", valor: v(74, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 147 ET",
      tip: "🔄 Pérdidas fiscales declaradas en años anteriores (últimos 12) que se aplican contra la renta de este año. ⚠️ Lleva el control en una cédula auxiliar: cada año reduce el saldo disponible. Pérdidas de antes de 2017 NO se pueden compensar." },
    { seccion: "renta", numero: 75, concepto: "Renta líquida", tipo: "formula", destacado: false,
      formula: "72 - 74",
      tip: "Renta líquida ordinaria menos compensaciones. Si todavía hay utilidad, sigue al cálculo del impuesto.",
      calc: (vals) => Math.max(0, (vals[72] || 0) - (vals[74] || 0)) },
    { seccion: "renta", numero: 76, concepto: "Renta presuntiva", valor: v(76, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 188 ET",
      tip: "📐 Mecanismo histórico que presumía una renta mínima del 0.5% del patrimonio líquido. ✅ DESDE 2021 ESTÁ EN 0% — la Ley 2010/2019 la eliminó (tarifa 0%). Solo aplica si la sociedad tiene saldos pendientes de períodos anteriores." },
    { seccion: "renta", numero: 77, concepto: "Renta exenta", valor: v(77, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 235-2 ET",
      tip: "✨ Rentas que la ley exime de impuesto: rentas hoteleras de zonas remotas (5%/9%), economía naranja (Art. 235-2 #1), agroindustria, ZESE, ZOMAC. ⚠️ Cada exención tiene requisitos específicos y caducidad — revisar con contador." },
    { seccion: "renta", numero: 78, concepto: "Rentas gravables", valor: v(78, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "📌 Rentas que se suman como gravables independientemente del ejercicio: indemnizaciones extraordinarias, recuperación de provisiones, otros conceptos especiales. Caso poco común para sociedades operativas." },
    { seccion: "renta", numero: 79, concepto: "RENTA LÍQUIDA GRAVABLE", tipo: "formula", destacado: true,
      formula: "max(75, 76) - 77 + 78",
      tip: "🎯 BASE GRAVABLE FINAL del impuesto. Se toma el MAYOR entre renta líquida (75) y renta presuntiva (76, casi siempre $0 desde 2021), se restan las rentas exentas (77) y se suman las rentas gravables especiales (78). Sobre esto se aplica la tarifa del 35%.",
      calc: (vals) => Math.max(0, Math.max(vals[75] || 0, vals[76] || 0) - (vals[77] || 0) + (vals[78] || 0)) },

    // ── IMPUESTO ─────────────────────────────────────────────────────────
    { seccion: "impuesto", numero: 84, concepto: "Impuesto sobre las rentas líquidas gravables (35%)", tipo: "formula", destacado: true,
      formula: "79 × 35%", articulo: "Art. 240 ET",
      tip: "🏛️ Tarifa general del impuesto a la renta para sociedades: 35%. ⚠️ Si tu sociedad está en Régimen SIMPLE de Tributación, NO aplica el 35% sino una tarifa entre 1.2% y 14.5% según actividad económica. Para zonas francas: 20%, ZESE: 0% primeros 5 años. Si cambiaste de régimen, ajustá manualmente.",
      calc: (vals) => (vals[79] || 0) * 0.35 },
    { seccion: "impuesto", numero: 91, concepto: "Total impuesto sobre las rentas líquidas gravables", tipo: "formula",
      formula: "84",
      tip: "🧮 Total del impuesto antes de aplicar descuentos tributarios. Es la base sobre la que se calculan los topes de descuentos (Art. 259 ET: máximo 25% del impuesto puede aplicarse como descuento).",
      calc: (vals) => (vals[84] || 0) },
    { seccion: "impuesto", numero: 93, concepto: "Descuentos tributarios", valor: v(93, descuentosTributarios), auto: descuentosTributarios, tipo: "editable", fuente: "Descuentos cargados (CT&I, donaciones, IVA activos...) con tope 25%", articulo: "Art. 256-259 ET",
      tip: "💎 Descuentos directos al impuesto (no a la base): IVA pagado en bienes de capital (Art. 258-1 ET, hasta 25%), donaciones a ESAL (Art. 257 ET, 25%), impuestos pagados en el exterior (Art. 254 ET), inversión en CT&I (Art. 256 ET). ⚠️ TOPE GLOBAL: máximo 25% del impuesto del renglón 91 (Art. 259 ET)." },
    { seccion: "impuesto", numero: 94, concepto: "Impuesto neto de renta", tipo: "formula", destacado: true,
      formula: "91 - 93",
      tip: "🎯 Es el impuesto que la sociedad debe pagar este año, antes de aplicar retenciones y anticipos. Es el dato más importante para evaluar la carga tributaria efectiva.",
      calc: (vals) => Math.max(0, (vals[91] || 0) - (vals[93] || 0)) },
    { seccion: "impuesto", numero: 99, concepto: "TOTAL IMPUESTO A CARGO", tipo: "formula", destacado: true,
      formula: "94",
      tip: "💰 Total del impuesto que la sociedad debe pagar antes de aplicar pagos previos (retenciones + anticipos del año anterior). Es el indicador clave para auditoría DIAN.",
      calc: (vals) => (vals[94] || 0) },

    // ── LIQUIDACIÓN ──────────────────────────────────────────────────────
    { seccion: "liquidacion", numero: 103, concepto: "Anticipo renta liquidado año gravable anterior", valor: v(103, 0), auto: 0, tipo: "editable", fuente: "Manual (consultar declaración anterior)",
      tip: "💵 Anticipo del impuesto que se pagó al presentar la declaración del AÑO ANTERIOR. Aparece en el formulario F-110 del año previo en el renglón 108. Este anticipo se aplica como pago anticipado de la renta de este año." },
    { seccion: "liquidacion", numero: 104, concepto: "Saldo a favor año anterior sin solicitud devolución", valor: v(104, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "🔄 Si en el año anterior la declaración resultó en saldo a favor (renglón 114) y NO se solicitó devolución, ese saldo se imputa contra el impuesto de este año. Verificar en el F-110 anterior el renglón 114." },
    { seccion: "liquidacion", numero: 105, concepto: "Autorretenciones", valor: v(105, 0), auto: 0, tipo: "editable", fuente: "Manual (certificados autorretención)", articulo: "Art. 365 ET",
      tip: "📋 Si la sociedad es AUTORRETENEDORA (resolución DIAN), debe practicarse retención a sí misma sobre sus ingresos. Sumar todas las autorretenciones declaradas y pagadas durante el año vía formulario 350. ⚠️ Solo si sos autorretenedor, sino va $0." },
    { seccion: "liquidacion", numero: 106, concepto: "Otras retenciones (banco/inquilinos)", valor: v(106, retencionAuto), auto: retencionAuto, tipo: "editable", fuente: "Calculado automáticamente desde retenciones por ingreso", articulo: "Art. 365-366 ET",
      tip: "🏦 Retenciones que terceros le practicaron a la sociedad: bancos sobre rendimientos financieros (7%), inquilinos sobre arriendos (3.5%), clientes sobre prestación de servicios (4-11%). Verificar con los certificados de retención que cada agente debe entregar antes del 31-mar." },
    { seccion: "liquidacion", numero: 107, concepto: "Total retenciones año gravable", tipo: "formula",
      formula: "105 + 106",
      tip: "🧮 Suma de autorretenciones + retenciones de terceros. Este monto se DESCUENTA del impuesto a cargo (renglón 99) para calcular el saldo final.",
      calc: (vals) => (vals[105] || 0) + (vals[106] || 0) },
    { seccion: "liquidacion", numero: 108, concepto: "Anticipo renta para el año gravable siguiente", valor: v(108, 0), auto: 0, tipo: "editable", fuente: "Manual (75% del impuesto neto típicamente)", articulo: "Art. 807 ET",
      tip: "🔮 Anticipo OBLIGATORIO del impuesto del año siguiente. Cálculo: 75% del impuesto neto del año (renglón 94) si es la primera o segunda declaración, o 75% del PROMEDIO del impuesto neto de los 2 años anteriores. Se PAGA con esta declaración pero queda como crédito para el año siguiente. ⚠️ Para sociedades en su primer año: 25%." },
    { seccion: "liquidacion", numero: 111, concepto: "Saldo a pagar por impuesto", tipo: "formula", destacado: true,
      formula: "99 - 103 - 104 - 107 + 108",
      tip: "💸 Saldo final a pagar. Si es positivo: pagás esa cantidad. Si es 0 o negativo: aplica saldo a favor (renglón 114). El anticipo del año siguiente (108) SE SUMA porque también hay que pagarlo con esta declaración.",
      calc: (vals) => Math.max(0, (vals[99] || 0) - (vals[103] || 0) - (vals[104] || 0) - (vals[107] || 0) + (vals[108] || 0)) },
    { seccion: "liquidacion", numero: 112, concepto: "Sanciones", valor: v(112, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 641 ET",
      tip: "⚠️ Sanciones por extemporaneidad (5% del impuesto por cada mes de retraso, máximo 100%), corrección, no presentación. Solo aplica si hay incumplimiento. Si la declaración se presenta dentro de los plazos DIAN, va $0." },
    { seccion: "liquidacion", numero: 113, concepto: "TOTAL SALDO A PAGAR", tipo: "formula", destacado: true,
      formula: "111 + 112",
      tip: "💰 Total a pagar a la DIAN: saldo del impuesto + sanciones (si aplica). Este es el monto que debes pagar antes del vencimiento. Recordá que el pago se puede fraccionar en cuotas si corresponde.",
      calc: (vals) => (vals[111] || 0) + (vals[112] || 0) },
    { seccion: "liquidacion", numero: 114, concepto: "TOTAL SALDO A FAVOR", tipo: "formula",
      formula: "max(0, 103 + 104 + 107 - 99 - 108)",
      tip: "💚 Si el cálculo resulta negativo en el renglón 111 (pagaste más en retenciones/anticipos que el impuesto), aparece aquí el saldo a favor. Podés solicitar devolución a la DIAN o imputarlo al año siguiente (renglón 104 del próximo año).",
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
