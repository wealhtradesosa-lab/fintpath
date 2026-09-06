// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · borradorDeclaracionF210.js — Generador de borrador F-210
//
// PROPÓSITO:
//   Equivalente al borradorDeclaracion.js (F-110) pero para personas naturales.
//   Genera un borrador F-210 con sus 5 cédulas (laboral, pensión, capital,
//   no laboral, dividendos) y aplica las reglas específicas de personas
//   naturales colombianas.
//
//   El F-210 es MUY distinto al F-110:
//   - Trabaja con CÉDULAS separadas (no utilidad única)
//   - Cada cédula tiene su propia renta líquida gravable
//   - Tope 40% / 1340 UVT en deducciones (CRÍTICO)
//   - Renta exenta 25% laboral (Art. 206-10)
//   - Tabla progresiva del Art. 241 ET (no tarifa fija 35%)
//
// FUENTE LEGAL:
//   Decreto 0359/2020 + Resolución DIAN 0066/2024 (formulario F-210 vigente)
// ═══════════════════════════════════════════════════════════════════════════

import { uvtForYear } from "./taxCO.js";

/**
 * Genera el borrador F-210 para un owner persona natural.
 *
 * @param {object} user - User completo
 * @param {object} owner - El owner persona natural
 * @param {object} estimacion - Output de estimarImpuesto(user)
 * @param {number} ano - Año gravable (default 2025)
 * @returns {Array} renglones [{numero, concepto, valor, tipo, ...}]
 */
export function generarBorradorF210(user, owner, estimacion, ano = 2025) {
  if (!owner || owner.type !== "natural") return null;

  const det = estimacion?.detalle?.find(d => d.name === owner.name);
  if (!det) return null;

  const trm = user.trm || 4200;
  const uvt = uvtForYear(ano);

  // Lectura de overrides persistidos
  const overrides = user?.borradorDeclaracion?.[owner.id]?.[ano] || {};
  const v = (renglon, autoValue) => {
    return overrides[renglon] != null ? Number(overrides[renglon]) : autoValue;
  };

  // ── Datos del motor (ya calculados) ─────────────────────────────────────
  // Motor expone los campos directamente en det, no en det.ingresos
  const ingLaboral = det.ingLaboral || 0;  // sueldos + honorarios brutos
  const ingCapitalTotal = det.ingCapital || 0;
  const ingNoLaboralTotal = det.ingNoLaboral || 0;
  const noConstSalPenSalud = det.noConst || 0;  // pension oblig + salud oblig + SS independ
  const honAnual = det.honorariosBruto || 0;
  const salAnual = ingLaboral - honAnual;  // resto es salario (aproximado)

  // Capital (rendimientos + intereses + dividendos)
  const interesesBanc = det.interesesBancAnual || 0;
  const utilidadFIC = det.utilidadFICAnual || 0;
  const rendGenerico = det.rendimientoGenAnual || 0;
  const dividendosAuto = det.divAnualAutomatico || 0;
  const dividendosManual = det.divAnualManual || 0;
  const componenteInflacExcluido = det.componenteInflacExcluido || 0;

  // Capital total bruto
  const capitalBruto = interesesBanc + utilidadFIC + rendGenerico + dividendosAuto + dividendosManual;

  // No laboral (arrendamientos típicamente)
  const oIng = (user.ingresos || []).filter(i => i.owner === owner.id && i.sim !== false && !i.excluirDeclaracion);
  const ingArriendos = oIng
    .filter(i => i.fiscalCode === "NOL_ARRIENDO_INMUEBLE" || i.fiscalCode === "NOL_ARRIENDO_BIENES_MUEBLES")
    .reduce((s, i) => s + (Number(i.mensual) || 0) * 12 * (i.moneda === "USD" ? trm : 1), 0);

  // Gastos generales (informativos para la persona natural)
  const totalNoConst = noConstSalPenSalud;

  // Deducciones (motor ya calculó con topes)
  const deducDep = det.deducDep || 0;
  const deducMedicina = det.deducMedicina || 0;
  const deducVivienda = det.deducVivienda || 0;
  const gmfDeducible = det.gmfDeducible || 0;
  const totalDeducciones = det.totalDeducciones || 0;
  const exenta25 = det.exenta25 || 0;
  const pensionVol = det.pensionVol || 0;
  const afc = det.afc || 0;

  // Patrimonio (mismo cálculo que F-110)
  const oInv = (user.inv || []).filter(i => i.owner === owner.id && i.sim !== false && !i.excluirDeclaracion);
  const efectivo = oInv
    .filter(i => i.fiscalCode === "INV_CUENTA_BANCARIA" || i.tipo === "cash")
    .reduce((s, i) => s + (Number(i.valor || i.va) || 0) * (i.moneda === "USD" ? trm : 1), 0);
  const inversionesFinancieras = oInv
    .filter(i => i.fiscalCode === "INV_CDT" || i.tipo === "cdt" || i.tipo === "equity")
    .reduce((s, i) => s + (Number(i.valor || i.va) || 0) * (i.moneda === "USD" ? trm : 1), 0);
  const propiedades = oInv
    .filter(i => /Real Estate|Bodega|Local Comercial|Inmueble/i.test(i.tipo || i.tp || ""))
    .reduce((s, i) => s + (Number(i.ubi || i.va || i.vc) || 0) * (i.moneda === "USD" ? trm : 1), 0);
  const oDeu = (user.deu || []).filter(d => d.owner === owner.id && d.sim !== false && !d.excluirDeclaracion);
  const pasivos = oDeu.reduce((s, d) => s + (Number(d.saldo || d.s || d.mt) || 0), 0);

  // Retenciones e impuesto
  const retefuente = det.retefuenteNat || 0;
  const impBruto = det.impBruto || 0;
  const impuestoNeto = det.impuesto || 0;

  // ═══════════════════════════════════════════════════════════════════════
  // RENGLONES F-210 (ordenados por sección DIAN)
  // ═══════════════════════════════════════════════════════════════════════
  const renglones = [
    // ── PATRIMONIO ────────────────────────────────────────────────────────
    { seccion: "patrimonio", numero: 29, concepto: "Total patrimonio bruto", tipo: "formula", destacado: true,
      calc: (vals) => (vals[291] || 0) + (vals[292] || 0) + (vals[293] || 0) + (vals[294] || 0) },
    { seccion: "patrimonio", numero: 291, concepto: "Efectivo y equivalentes", valor: v(291, efectivo), auto: efectivo, tipo: "editable", fuente: "Inversiones tipo cuenta bancaria",
      tip: "Acá va el saldo de tus cuentas de ahorro, corriente y similares al 31 de diciembre. Si tenés CDT abierto, no va acá (va abajo en inversiones)." },
    { seccion: "patrimonio", numero: 292, concepto: "Inversiones financieras (CDT, fondos, acciones)", valor: v(292, inversionesFinancieras), auto: inversionesFinancieras, tipo: "editable", fuente: "Inversiones CDT/equity/fondos",
      tip: "CDT, fondos de inversión colectiva, acciones bursátiles. Para activos en USD usar TRM del 31-dic." },
    { seccion: "patrimonio", numero: 293, concepto: "Bienes inmuebles y vehículos", valor: v(293, propiedades), auto: propiedades, tipo: "editable", fuente: "Inversiones tipo Real Estate (valor de compra)",
      tip: "Casa, apartamentos, lotes, vehículos. La DIAN acepta el mayor entre: avalúo catastral o costo fiscal (lo que pagaste + mejoras)." },
    { seccion: "patrimonio", numero: 294, concepto: "Otros activos", valor: v(294, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "Cuentas por cobrar, joyas, obras de arte valiosas, criptomonedas." },
    { seccion: "patrimonio", numero: 30, concepto: "Total deudas (pasivos)", valor: v(30, pasivos), auto: pasivos, tipo: "editable", fuente: "Deudas cargadas",
      tip: "Saldos de hipotecas, préstamos personales, tarjetas de crédito al 31-dic. Las deudas reducen tu patrimonio líquido." },
    { seccion: "patrimonio", numero: 31, concepto: "Total patrimonio líquido", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[29] || 0) - (vals[30] || 0)) },

    // ── CÉDULA GENERAL: RENTAS DE TRABAJO ────────────────────────────────
    { seccion: "trabajo", numero: 32, concepto: "Salarios y demás rentas laborales", valor: v(32, salAnual), auto: salAnual, tipo: "editable", fuente: "Ingresos tipo Salario (anual)",
      tip: "💼 Tu salario bruto anual + bonificaciones + cesantías + prima. Si te pagan en USD, convertí a TRM promedio del año." },
    { seccion: "trabajo", numero: 33, concepto: "Honorarios y servicios", valor: v(33, honAnual), auto: honAnual, tipo: "editable", fuente: "Ingresos tipo Honorarios",
      tip: "💼 Lo facturado por servicios profesionales independientes. Acá NO van los gastos descontados (eso va en otra línea)." },
    { seccion: "trabajo", numero: 34, concepto: "Total ingresos brutos rentas de trabajo", tipo: "formula",
      calc: (vals) => (vals[32] || 0) + (vals[33] || 0) },
    { seccion: "trabajo", numero: 35, concepto: "Aportes obligatorios pensión + salud (INCRNGO)", valor: v(35, totalNoConst), auto: totalNoConst, tipo: "editable", fuente: "Aportes 4%+4% + SS independiente", articulo: "Art. 56 ET",
      tip: "🏦 Los aportes obligatorios de pensión (4%) y salud (4%) NO son ingreso gravable. Si sos independiente, los aportes a SS también." },
    { seccion: "trabajo", numero: 36, concepto: "Costos y gastos procedentes (honorarios)", valor: v(36, det.gastosHonorariosDed || 0), auto: det.gastosHonorariosDed || 0, tipo: "editable", fuente: "Gastos de actividad de honorarios", articulo: "Art. 107 ET",
      tip: "💵 Si sos independiente con costos reales (oficina, servicios, transporte), podés deducirlos hasta cierto tope. ⚠️ Cuidado: la DIAN audita esto si el % es muy alto." },
    { seccion: "trabajo", numero: 37, concepto: "Renta líquida rentas de trabajo", tipo: "formula",
      calc: (vals) => Math.max(0, (vals[34] || 0) - (vals[35] || 0) - (vals[36] || 0)) },

    // ── DEDUCCIONES Y RENTAS EXENTAS ─────────────────────────────────────
    { seccion: "deducciones", numero: 38, concepto: "Deducción por dependientes", valor: v(38, deducDep), auto: deducDep, tipo: "editable", fuente: "Configurado en perfil del owner", articulo: "Art. 387 ET",
      tip: "👨‍👩‍👧 Si tenés hijos menores de 23 años, padres dependientes o cónyuge sin ingresos: 10% del salario hasta tope 384 UVT/año (768 UVT si hay discapacidad). Cargá esto en el perfil del owner." },
    { seccion: "deducciones", numero: 39, concepto: "Deducción intereses vivienda", valor: v(39, deducVivienda), auto: deducVivienda, tipo: "editable", fuente: "Intereses sobre deuda hipotecaria habitual", articulo: "Art. 119 ET",
      tip: "🏠 Intereses pagados en préstamo de vivienda HABITUAL (donde vivís). Tope: 1200 UVT/año. ⚠️ Tu casa de descanso o segunda vivienda NO aplica." },
    { seccion: "deducciones", numero: 40, concepto: "Medicina prepagada + seguros salud + médicos", valor: v(40, deducMedicina), auto: deducMedicina, tipo: "editable", fuente: "Gastos categoría Salud + AP_TRIB_SALUD_PREPAGADA", articulo: "Art. 387 ET",
      tip: "🏥 Tope conjunto 16 UVT/mes (~$10M/año). Incluye: medicina prepagada, seguros de salud, seguros de vida, gastos médicos no cubiertos por POS." },
    { seccion: "deducciones", numero: 41, concepto: "Aportes voluntarios pensión + AFC", valor: v(41, pensionVol + afc), auto: pensionVol + afc, tipo: "editable", fuente: "Aportes a fondos de pensión voluntaria + AFC", articulo: "Art. 126-1 y 126-4 ET",
      tip: "💎 LA PALANCA MÁS PODEROSA. Hasta 30% del ingreso laboral (3800 UVT) para AFC + 25% (2500 UVT) para PV. Combinado caben hasta 1340 UVT. Cada $1 aportado ahorra hasta $0.39 de impuesto." },
    { seccion: "deducciones", numero: 42, concepto: "GMF deducible (50%)", valor: v(42, gmfDeducible), auto: gmfDeducible, tipo: "editable", fuente: "Cálculo automático 50% del 4x1000",
      tip: "🏦 El 4x1000 que te cobra el banco es deducible al 50%. Cálculo automático sobre tus ingresos." },
    { seccion: "deducciones", numero: 43, concepto: "Total deducciones limitadas (40% / 1340 UVT)", tipo: "formula", destacado: true,
      calc: (vals) => Math.min((vals[38] || 0) + (vals[39] || 0) + (vals[40] || 0) + (vals[41] || 0) + (vals[42] || 0), Math.min((vals[37] || 0) * 0.40, 1340 * uvt)) },
    { seccion: "deducciones", numero: 44, concepto: "Renta exenta 25% laboral", valor: v(44, exenta25), auto: exenta25, tipo: "editable", fuente: "Cálculo automático Art. 206-10", articulo: "Art. 206-10 ET",
      tip: "✨ Sólo aplica si tenés salarios. 25% de tus ingresos laborales netos quedan exentos, hasta 790 UVT/año." },

    // ── CÉDULA DE CAPITAL ─────────────────────────────────────────────────
    { seccion: "capital", numero: 50, concepto: "Intereses y rendimientos financieros", valor: v(50, interesesBanc + rendGenerico), auto: interesesBanc + rendGenerico, tipo: "editable", fuente: "Ingresos CDT, cuentas de ahorro, papeles",
      tip: "🏦 CDT, cuentas remuneradas, bonos. Incluye los rendimientos brutos antes de retención." },
    { seccion: "capital", numero: 51, concepto: "Componente inflacionario excluido", valor: v(51, componenteInflacExcluido), auto: componenteInflacExcluido, tipo: "editable", fuente: "Cálculo automático componente inflacionario 2026 (50.88%)", articulo: "Art. 38-39 ET",
      tip: "💎 GANANCIA OCULTA: el 50.88% de tus intereses bancarios NO son gravables (Art. 38 ET). El motor lo calcula automáticamente. Esto te ahorra fácil $5-15M en impuesto." },
    { seccion: "capital", numero: 52, concepto: "Utilidad FIC", valor: v(52, utilidadFIC), auto: utilidadFIC, tipo: "editable", fuente: "Ingresos tipo FIC",
      tip: "📈 Fondos de Inversión Colectiva — la retención se hace a nivel del fondo, no del partícipe." },
    { seccion: "capital", numero: 53, concepto: "Renta líquida cédula de capital", tipo: "formula",
      calc: (vals) => Math.max(0, (vals[50] || 0) + (vals[52] || 0) - (vals[51] || 0)) },

    // ── CÉDULA NO LABORAL ────────────────────────────────────────────────
    { seccion: "noLaboral", numero: 60, concepto: "Arrendamientos de inmuebles", valor: v(60, ingArriendos), auto: ingArriendos, tipo: "editable", fuente: "Ingresos tipo NOL_ARRIENDO_INMUEBLE",
      tip: "🏠 Arriendos brutos cobrados durante el año. Si el inquilino retiene 3.5%, esa retención va a la sección Liquidación abajo." },
    { seccion: "noLaboral", numero: 61, concepto: "Otros ingresos no laborales", valor: v(61, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "Indemnizaciones, premios, herencias. La mayoría va a Ganancias Ocasionales (sección aparte)." },
    { seccion: "noLaboral", numero: 62, concepto: "Renta líquida cédula no laboral", tipo: "formula",
      calc: (vals) => Math.max(0, (vals[60] || 0) + (vals[61] || 0)) },

    // ── CÉDULA DE DIVIDENDOS ─────────────────────────────────────────────
    { seccion: "dividendos", numero: 70, concepto: "Dividendos automáticos (sociedades cargadas)", valor: v(70, dividendosAuto), auto: dividendosAuto, tipo: "editable", fuente: "Cálculo automático desde sociedades cargadas",
      tip: "📊 Si tenés sociedades (SAS) cargadas en FINPATHIA, el motor calcula los dividendos que te corresponden automáticamente." },
    { seccion: "dividendos", numero: 71, concepto: "Dividendos manuales", valor: v(71, dividendosManual), auto: dividendosManual, tipo: "editable", fuente: "Ingresos tipo dividendos manuales",
      tip: "Dividendos recibidos de sociedades NO cargadas en FINPATHIA. Tarifa progresiva o 19% según sea no constitutivo o gravado." },
    { seccion: "dividendos", numero: 72, concepto: "Renta líquida cédula dividendos", tipo: "formula",
      calc: (vals) => (vals[70] || 0) + (vals[71] || 0) },

    // ── RENTA LÍQUIDA TOTAL ──────────────────────────────────────────────
    { seccion: "rentaTotal", numero: 80, concepto: "Renta líquida cédula general", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[37] || 0) - (vals[43] || 0) - (vals[44] || 0)) },
    { seccion: "rentaTotal", numero: 81, concepto: "RENTA LÍQUIDA GRAVABLE TOTAL", tipo: "formula", destacado: true,
      calc: (vals) => (vals[80] || 0) + (vals[53] || 0) + (vals[62] || 0) + (vals[72] || 0) },

    // ── IMPUESTO ─────────────────────────────────────────────────────────
    { seccion: "impuesto", numero: 90, concepto: "Impuesto según tabla Art. 241 ET", valor: v(90, impBruto), auto: impBruto, tipo: "editable", fuente: "Tabla progresiva del motor", articulo: "Art. 241 ET",
      tip: "🧾 La tabla del Art. 241 es progresiva: 0%, 19%, 28%, 33%, 35%, 37%, 39% según rangos UVT. El motor calcula automáticamente sobre la renta líquida gravable." },
    { seccion: "impuesto", numero: 91, concepto: "TOTAL IMPUESTO A CARGO", tipo: "formula", destacado: true,
      calc: (vals) => (vals[90] || 0) },

    // ── LIQUIDACIÓN ──────────────────────────────────────────────────────
    { seccion: "liquidacion", numero: 100, concepto: "Anticipo año anterior", valor: v(100, 0), auto: 0, tipo: "editable", fuente: "Manual (ver F-210 año anterior)",
      tip: "Si pagaste anticipo en la declaración del año pasado, descontalo acá." },
    { seccion: "liquidacion", numero: 101, concepto: "Saldo a favor año anterior", valor: v(101, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "Si en la declaración anterior tenías saldo a favor sin solicitar devolución." },
    { seccion: "liquidacion", numero: 102, concepto: "Retenciones en la fuente practicadas", valor: v(102, retefuente), auto: retefuente, tipo: "editable", fuente: "Cálculo automático del motor",
      tip: "💰 Lo que te retuvieron durante el año (banco sobre intereses, empleador sobre salario, inquilino sobre arriendo). Esto reduce el saldo final a pagar." },
    { seccion: "liquidacion", numero: 103, concepto: "Anticipo año siguiente", valor: v(103, 0), auto: 0, tipo: "editable", fuente: "Manual", articulo: "Art. 807 ET",
      tip: "Solo aplica si DIAN te lo exige (típicamente cuando saldo a pagar > 41 UVT). El motor lo calculará automáticamente en próxima versión." },
    { seccion: "liquidacion", numero: 110, concepto: "Saldo a pagar / saldo a favor", tipo: "formula", destacado: true,
      calc: (vals) => (vals[91] || 0) - (vals[100] || 0) - (vals[101] || 0) - (vals[102] || 0) + (vals[103] || 0) },
    { seccion: "liquidacion", numero: 112, concepto: "Sanciones", valor: v(112, 0), auto: 0, tipo: "editable", fuente: "Manual",
      tip: "Si presentás extemporáneo o hay corrección, acá van las sanciones calculadas." },
    { seccion: "liquidacion", numero: 113, concepto: "TOTAL SALDO A PAGAR", tipo: "formula", destacado: true,
      calc: (vals) => Math.max(0, (vals[110] || 0)) + (vals[112] || 0) },
  ];

  return resolverRenglones(renglones);
}

/**
 * Recalcula los renglones de fórmula en orden topológico.
 */
export function resolverRenglones(renglones) {
  const valores = {};

  // Pass 1: capturar valores editables
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
 * Etiquetas de las secciones F-210 con sus iconos y colores.
 */
export const SECCIONES_F210 = {
  patrimonio: { label: "Patrimonio", icon: "🏛️", color: "#a78bfa" },
  trabajo: { label: "Cédula General — Rentas de Trabajo", icon: "💼", color: "#22c55e" },
  deducciones: { label: "Deducciones y Rentas Exentas", icon: "💎", color: "#3b82f6" },
  capital: { label: "Cédula de Capital", icon: "📈", color: "#f59e0b" },
  noLaboral: { label: "Cédula No Laboral", icon: "🏠", color: "#06b6d4" },
  dividendos: { label: "Cédula de Dividendos", icon: "📊", color: "#eab308" },
  rentaTotal: { label: "Renta Líquida Total", icon: "📋", color: "#ef4444" },
  impuesto: { label: "Impuesto", icon: "🧾", color: "#ef4444" },
  liquidacion: { label: "Liquidación Privada", icon: "💳", color: "#06b6d4" },
};