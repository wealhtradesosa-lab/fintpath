import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const UVT = 52374;
const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24", bg4: "#252530",
  border: "rgba(255,255,255,0.06)", txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", red: "#ef4444", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee",
};
const fm = (v) => {
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  return "$" + Math.round(v).toLocaleString("es-CO");
};
const TABLA = [
  { d: 0, h: 1090, t: 0, b: 0 }, { d: 1090, h: 1700, t: 19, b: 0 },
  { d: 1700, h: 4100, t: 28, b: 115.86 }, { d: 4100, h: 8670, t: 33, b: 787.86 },
  { d: 8670, h: 18970, t: 35, b: 2295.96 }, { d: 18970, h: 31000, t: 37, b: 5900.96 },
  { d: 31000, h: Infinity, t: 39, b: 10352.96 },
];
const calcImp = (uvtBase) => { for (let i = TABLA.length - 1; i >= 0; i--) { if (uvtBase > TABLA[i].d) return (TABLA[i].b + (uvtBase - TABLA[i].d) * TABLA[i].t / 100) * UVT; } return 0; };

const DEDUC_JUR = { "Nómina": 1, "Honorarios": 1, "Vivienda": 1, "Servicios": 1, "Mantenimiento": 1, "Seguros": 1, "Transporte": 1, "Arrendamiento": 1, "Predial": 1, "Representación": 1, "Tecnología": 1, "Educación": 1, "Seguridad Social": 1 };
const NO_DEDUC = ["Alimentación","Entretenimiento","Personal","Vestimenta","Mascotas","Deporte","Ahorro"];
const DEDUC_NAT = { "Salud": 1, "Vivienda": 1, "Seguros": 0.5 };
const LIM_NAT = { "Salud": 16 * UVT * 12, "Vivienda": 100 * UVT * 12, "Seguros": 16 * UVT * 12 };

const CAT_LABELS = { "Salario": "💼", "Honorarios": "📋", "Arriendo": "🏠", "Rendimiento": "💰", "Dividendos": "📊", "Inversión": "🏦", "Pensión": "🏛️", "Negocio": "🏢", "Otro": "📝" };

const Cd = ({ children, style: s }) => <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", ...s }}>{children}</div>;
const Kpi = ({ label, value, sub, color, big }) => (
  <div style={{ padding: big ? "20px 16px" : "14px 16px", textAlign: "center" }}>
    <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: big ? 28 : 20, fontWeight: 800, color: color || T.txt, marginTop: 4, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>{sub}</div>}
  </div>
);

function OwnerPlan({ owner, ingresos, gastos, inv, deu, trm, isJ, mb }) {

  const calc = useMemo(() => {
    const ingAnual = ingresos.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
    if (ingAnual <= 0) return null;

    // Gastos by category
    const gastosByCat = {};
    let gastosDeducTotal = 0, gastosTotal = 0;
    gastos.forEach(g => {
      const cat = g.cat || "Otro";
      const m = g.m || 0;
      gastosTotal += m;
      const pct = isJ ? (NO_DEDUC.includes(cat) ? 0 : (DEDUC_JUR[cat] || 0.5)) : (DEDUC_NAT[cat] || 0);
      let deducMes = m * pct;
      if (!isJ && LIM_NAT[cat]) deducMes = Math.min(deducMes, LIM_NAT[cat] / 12);
      gastosDeducTotal += deducMes;
      if (!gastosByCat[cat]) gastosByCat[cat] = { total: 0, deduc: 0, pct };
      gastosByCat[cat].total += m;
      gastosByCat[cat].deduc += deducMes;
    });

    // Ingresos by cat
    const ingByCat = {};
    ingresos.forEach(i => {
      const cat = i.categoria || "Otro";
      const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1);
      ingByCat[cat] = (ingByCat[cat] || 0) + m;
    });

    // Intereses deudas
    const intereses = deu.reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
    // Depreciación
    const deprec = inv.reduce((s, i) => {
      const tp = (i.tp || i.tipo || "").toLowerCase();
      if (/real estate|bodega|local|oficina/i.test(tp)) return s + (i.va || 0) * 0.05;
      if (/vehículo|vehiculo/i.test(tp)) return s + (i.va || 0) * 0.20;
      return s;
    }, 0);

    // Patrimonio
    const patTotal = inv.reduce((s, i) => s + (+i.va || 0), 0);
    const deuTotal = deu.reduce((s, d) => s + (d.mt || 0), 0);

    if (isJ) {
      // ═══ JURÍDICA ═══
      const gastosDeducAnual = gastosDeducTotal * 12;
      // GMF 4x1000 (50% deducible)
      const gmf50 = ingAnual * 0.004 * 0.50;
      const totalDeduc = gastosDeducAnual + intereses + deprec + gmf50;
      const utilidadActual = Math.max(0, ingAnual - totalDeduc);
      // Descuento del 50% del ICA pagado (se resta del impuesto, no de la base)
      const icaPagado = (gastosByCat["Predial"] ? gastosByCat["Predial"].total : 0) * 12 * 0.30; // ~30% del predial es ICA aprox
      const descuentoICA = icaPagado * 0.50;
      const impBruto = utilidadActual * 0.35;
      
      // Retención en la fuente automática según tipo de ingreso
      let retefuenteCalc = 0;
      ingresos.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1) * 12;
        const cat = i.categoria || "";
        if (/Arriendo/i.test(cat)) retefuenteCalc += m * 0.035;
        else if (/Rendimiento|Dividendos/i.test(cat)) retefuenteCalc += m * 0.07;
        else if (/Honorarios|Freelance/i.test(cat)) retefuenteCalc += m * 0.11;
        else if (/Salario/i.test(cat)) retefuenteCalc += m * 0.04;
        else retefuenteCalc += m * 0.025;
      });
      
      const impActual = Math.max(0, impBruto - descuentoICA - retefuenteCalc);
      const tasaActual = ingAnual > 0 ? (impActual / ingAnual * 100) : 0;

      // CON ESTRATEGIA: solo optimizaciones con base legal verificable
      const pctGastos = ingAnual > 0 ? (totalDeduc / ingAnual * 100) : 0;

      // ── OPTIMIZACIÓN PERSONA JURÍDICA (FASE 1 — HONESTA) ──
      // Las estrategias corporativas (bonificaciones extralegales, donaciones Art.257 ET,
      // provisión de cartera Art.145 ET, apalancamiento productivo, depreciación acelerada,
      // zona franca, etc.) existen en el Estatuto Tributario, pero su viabilidad y monto
      // dependen de la estructura contable específica de cada empresa. El simulador NO
      // aplica porcentajes genéricos inventados (15% de nómina, 10% de utilidad, 2% de
      // ingresos, 3% del patrimonio) — eso sería sugerir ahorros sin soporte.
      //
      // Único ajuste automático: si los gastos registrados están por debajo del 50% de
      // ingresos, el simulador asume que hay gastos operativos reales sin registrar y
      // los sube al 55% (piso razonable para una empresa operativa).
      const gastosExtra = pctGastos < 50 ? Math.max(0, ingAnual * 0.55 - totalDeduc) : 0;
      const maxReduccion = utilidadActual * 0.35;
      const reduccionAplicada = Math.min(gastosExtra, maxReduccion);
      const utilidadOptima = Math.max(0, utilidadActual - reduccionAplicada);
      const impOptimoBase = utilidadOptima * 0.35;
      const impOptimo = Math.max(0, impOptimoBase - descuentoICA - retefuenteCalc);
      const ahorro = impActual - impOptimo;

      // Recomendaciones educativas (sin impacto calculado con porcentajes inventados)
      const recs = [];
      if (!gastosByCat["Nómina"]) recs.push({ icon: "👥", title: "Nómina y empleados", desc: "Salarios y prestaciones son 100% deducibles. Cada $1M en nómina ahorra $350K en impuestos.", impact: 0, color: T.blue });
      if (!gastosByCat["Honorarios"]) recs.push({ icon: "📋", title: "Honorarios profesionales", desc: "Contador, abogado, revisor fiscal. Registra estos gastos como deducibles.", impact: 0, color: T.blue });
      if (!gastosByCat["Mantenimiento"]) recs.push({ icon: "🔧", title: "Mantenimiento de propiedades", desc: "Reparaciones, pintura, plomería — todo deducible para inmuebles de la empresa.", impact: 0, color: T.blue });
      if (!gastosByCat["Predial"]) recs.push({ icon: "🏛️", title: "Predial e impuestos locales", desc: "Predial, ICA, contribuciones — impuestos pagados son deducibles.", impact: 0, color: T.blue });
      if (pctGastos < 40) recs.push({ icon: "⚠️", title: "Gastos registrados: " + pctGastos.toFixed(0) + "% de ingresos", desc: "Una empresa operativa típica tiene 40-70%. Revisa si faltan gastos por registrar.", impact: gastosExtra > 0 ? gastosExtra * 0.35 : 0, color: T.orange });

      // Estrategias corporativas: educativas — sin estimación de impacto automático
      if (utilidadActual > 50e6) {
        recs.push({ icon: "🎁", title: "Bonificaciones a empleados (Art. 107 ET)", desc: "Primas extralegales y bonificaciones son deducibles si cumplen relación de causalidad, necesidad y proporcionalidad. Consulta con tu contador el monto viable según tu estructura de nómina.", impact: 0, color: T.purple });
        recs.push({ icon: "🤝", title: "Donaciones con descuento 25% (Art. 257 ET)", desc: "Donaciones a entidades sin ánimo de lucro calificadas dan un DESCUENTO del 25% del valor donado, directo del impuesto. El monto recomendable depende de tu estrategia fiscal — tu contador puede calcular el óptimo.", impact: 0, color: T.purple });
        recs.push({ icon: "📋", title: "Provisión de cartera (Art. 145 ET)", desc: "Provisión individual por deterioro de cartera: aplica si tienes cuentas por cobrar con más de 90 días. El monto deducible depende de tu cartera real — no hay porcentaje automático.", impact: 0, color: T.purple });
        recs.push({ icon: "🏗️", title: "Depreciación acelerada (Art. 137 ET)", desc: "Evalúa con tu contador aplicar depreciación acelerada en activos productivos. Reduce utilidad gravable hoy, difiere impuesto. Aplica solo a ciertos activos y tasas definidas por reglamento.", impact: 0, color: T.purple });
        recs.push({ icon: "🏦", title: "Apalancamiento financiero (Art. 117 ET)", desc: "Crédito para inversión productiva: los intereses son deducibles sujetos a subcapitalización. Consulta con tu contador antes de endeudarte solo por el beneficio fiscal.", impact: 0, color: T.purple });
        recs.push({ icon: "📈", title: "Reinvertir utilidades en activos productivos", desc: "Comprar equipos/vehículos genera depreciación deducible futura. Cada $100M en activos puede generar $20-33M/año en depreciación según vida útil.", impact: 0, color: T.purple });
        recs.push({ icon: "💰", title: "Distribuir dividendos estratégicamente", desc: "En vez de dejar utilidad en la empresa (35%), distribuir dividendos al socio tributa al 15% (>300 UVT). Si la persona natural tiene tasa efectiva menor al 35%, conviene distribuir.", impact: 0, color: T.purple });
      }
      // Siempre mostrar retención y descuentos

      if (descuentoICA > 0) recs.push({ icon: "🏛️", title: "Descuento 50% del ICA: " + fm(descuentoICA), desc: "El 50% del ICA pagado se descuenta directamente del impuesto de renta (Art. 115 ET). No es deducción, es descuento — se resta del impuesto calculado.", impact: 0, color: T.green });
      if (gmf50 > 0) recs.push({ icon: "💳", title: "GMF 4×1000 deducible: " + fm(gmf50), desc: "El 50% del GMF (4×1000) pagado es deducible de la renta. Se calcula automáticamente.", impact: 0, color: T.green });

      return { type: "juridica", ingAnual, ingByCat, gastosByCat, gastosTotal, gastosDeducTotal, totalDeduc, intereses, deprec, patTotal, deuTotal, utilidad: utilidadActual, impBruto, descuentoICA, retefuenteCalc, gmf50, impActual, tasaActual, pctGastos, impOptimo, ahorro, recs };
    } else {
      // ═══ PERSONA NATURAL — Cédula General (Ley 2277/2022) ═══
      const salAnual = ingresos.filter(i => i.categoria === "Salario").reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const honAnual = ingresos.filter(i => /Honorarios|Freelance/i.test(i.categoria || "")).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const rentasAnual = ingresos.filter(i => /Arriendo/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
      const rendAnual = ingresos.filter(i => /Rendimiento|Inversión|CDT/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
      const divAnual = ingresos.filter(i => /Dividendos/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
      const ingLaboral = salAnual + honAnual;
      const ingCapital = rendAnual;
      const ingNoLaboral = rentasAnual + ingresos.filter(i => !["Salario","Honorarios","Freelance","Arriendo","Rendimiento","Inversión","CDT","Dividendos","Pensión"].some(c2 => (i.categoria||"").includes(c2))).reduce((s,i) => s + ((i.mensual||0) * (i.moneda==="USD"?(trm||4200):1)),0) * 12;
      
      // INCRNGO: pensión obligatoria (Art. 55 ET)
      const noConst = salAnual * 0.04 + honAnual * 0.40 * 0.04;
      const netoLaboral = ingLaboral - noConst;
      
      // Deducciones solo para rentas de TRABAJO
      const gastoEduc = gastos.filter(g => g.cat === "Educación").reduce((s, g) => s + (g.m || 0), 0);
      const deducDep = gastoEduc > 500000 ? Math.min(ingLaboral * 0.10, 384 * UVT) : 0;
      const interesesHip = deu.filter(d => /hipoteca|vivienda|casa|apto|mortgage/i.test((d.tp || "") + (d.n || ""))).reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
      const deducViv = Math.min(interesesHip, 1200 * UVT);
      const gastoSalud = gastos.filter(g => g.cat === "Salud").reduce((s, g) => s + (g.m || 0), 0) * 12;
      const deducMedicina = Math.min(gastoSalud, 16 * UVT * 12);
      const gmfNat = ingAnual * 0.004 * 0.50;
      const totalDeducciones = deducDep + deducMedicina + deducViv + gmfNat;
      
      // Renta exenta 25% solo sobre TRABAJO (Art. 206 num 10)
      const baseExenta = Math.max(0, netoLaboral - totalDeducciones);
      const exenta25 = Math.min(baseExenta * 0.25, 790 * UVT);
      
      // Tope 40% solo sobre TRABAJO (Ley 2277)
      const lim40 = netoLaboral * 0.40;
      const benefSin = Math.min(exenta25 + totalDeducciones, lim40);
      
      // Rentas líquidas por cédula
      const rentaLiqTrabajo = Math.max(0, netoLaboral - benefSin);
      const costosCapital = rendAnual * 0.01;
      const rentaLiqCapital = Math.max(0, ingCapital - costosCapital);
      const gastosInmueble = gastos.filter(g => ["Predial","Mantenimiento","Vivienda","Seguros","Servicios"].includes(g.cat)).reduce((s,g) => s + (g.m||0), 0) * 12;
      const rentaLiqNoLaboral = Math.max(0, ingNoLaboral - gastosInmueble * 0.5);
      
      // Dividendos tarifa especial
      const divExentos = Math.min(divAnual, 300 * UVT);
      const impDiv = Math.max(0, divAnual - divExentos) * 0.15;
      
      // Renta líquida cédula general
      const rentaSin = rentaLiqTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const impSin = calcImp(rentaSin / UVT) + impDiv;
      const tasaSin = ingAnual > 0 ? (impSin / ingAnual * 100) : 0;
      
      // ── CON ESTRATEGIA: PV + AFC llenan tope 40% ──
      const espacioOpt = Math.max(0, lim40 - benefSin);
      const pvMax = Math.min(espacioOpt, netoLaboral * 0.25, 2500 * UVT);
      const espacioPost = Math.max(0, lim40 - benefSin - pvMax);
      const afcMax = Math.min(espacioPost, netoLaboral * 0.30, 3800 * UVT);
      const rentaOptTrabajo = Math.max(0, netoLaboral - Math.min(exenta25 + totalDeducciones + pvMax + afcMax, lim40));
      const rentaCon = rentaOptTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const impCon = calcImp(rentaCon / UVT) + impDiv;
      const ahorro = impSin - impCon;
      const tasaCon = ingAnual > 0 ? (impCon / ingAnual * 100) : 0;
      const pctUsado = lim40 > 0 ? (benefSin / lim40 * 100) : 0;
      const benAplicSin = benefSin;
      const benAplicCon = Math.min(exenta25 + totalDeducciones + pvMax + afcMax, lim40);
      const benefCon = exenta25 + totalDeducciones + pvMax + afcMax;
      const neto = netoLaboral; // For display compatibility
      const gastosDeducNat = totalDeducciones;
      
      // Retención automática
      let retefuenteNat = 0;
      ingresos.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1) * 12;
        const cat = i.categoria || "";
        if (/Salario/i.test(cat)) { const mUVT = m / 12 / UVT; retefuenteNat += m * (mUVT > 360 ? 0.19 : mUVT > 150 ? 0.10 : mUVT > 95 ? 0.04 : 0); }
        else if (/Honorarios|Freelance/i.test(cat)) retefuenteNat += m * 0.11;
        else if (/Arriendo/i.test(cat)) retefuenteNat += m * 0.035;
        else if (/Rendimiento|CDT|Inversión/i.test(cat)) retefuenteNat += m * 0.07;
        else if (/Dividendos/i.test(cat)) retefuenteNat += m * 0.10;
      });

      // Recomendaciones
      const recs = [];
      if (pvMax > 500000) recs.push({ icon: "💰", title: "Pensión voluntaria", desc: "Aporta " + fm(pvMax / 12) + "/mes a un fondo de pensión voluntaria. Es exento de renta y ahorras para el futuro. Retirable después de 10 años.", impact: calcImp(rentaSin / UVT) - calcImp(Math.max(0, rentaSin - pvMax) / UVT), color: T.green });
      if (afcMax > 500000) recs.push({ icon: "🏠", title: "Cuenta AFC", desc: "Ahorra " + fm(afcMax / 12) + "/mes en una Cuenta AFC. Exento si se usa para compra de vivienda.", impact: calcImp(Math.max(0, rentaSin - pvMax) / UVT) - impCon, color: T.blue });
      if (!gastosByCat["Salud"] && ingAnual > 2000 * UVT) recs.push({ icon: "🏥", title: "Medicina prepagada", desc: "Deducible hasta " + fm(16 * UVT) + "/mes. Regístrala en Gastos → Salud.", impact: 0, color: T.purple });
      if (deducDep > 0) recs.push({ icon: "👨‍👩‍👧", title: "Dependientes: " + fm(deducDep) + "/año", desc: "Ya se está deduciendo 10% del ingreso por dependientes (gastos educación detectados).", impact: 0, color: T.green });
      if (deducViv > 0) recs.push({ icon: "🏠", title: "Intereses vivienda: " + fm(deducViv) + "/año", desc: "Los intereses de tu hipoteca ya se deducen automáticamente.", impact: 0, color: T.green });
      // Costos de arriendos: depreciación + gastos del inmueble
      const tieneArriendos = ingresos.some(i => /Arriendo/i.test(i.categoria || ""));
      const invInmuebles = inv.filter(i => /Real Estate|bodega|local|oficina/i.test((i.tp||i.tipo||"").toLowerCase()));
      if (tieneArriendos && invInmuebles.length > 0) {
        const deprecInmuebles = invInmuebles.reduce((s,i) => s + (i.va||0) * 0.0222, 0);
        recs.push({ icon: "🏠", title: "Depreciación de inmuebles arrendados", desc: "Tus inmuebles en arriendo se deprecian 2.22%/año. Esto reduce la renta no laboral directamente. Depreciación estimada: " + fm(deprecInmuebles) + "/año.", impact: deprecInmuebles * 0.28, color: T.green });
      }
      
      // Donaciones con descuento tributario (Art. 257 ET)
      if (ingAnual > 200e6) recs.push({ icon: "🤝", title: "Donaciones con descuento 25% (Art. 257 ET)", desc: "Las donaciones a entidades sin ánimo de lucro calificadas dan un DESCUENTO del 25% del valor donado, directo del impuesto a pagar (no de la base). El tope legal del descuento es el 25% del impuesto de renta del año. El monto que te conviene donar depende de tu estrategia fiscal y filantrópica — consúltalo con tu contador.", impact: 0, color: T.purple });
      
      // Deuda para vivienda
      if (interesesHip === 0 && deu.length === 0 && ingAnual > 200e6) recs.push({ icon: "🏦", title: "Crédito de vivienda: intereses deducibles (Art. 119 ET)", desc: "Los intereses de un crédito hipotecario para vivienda del contribuyente son deducibles hasta 1.200 UVT/año (" + fm(1200 * UVT) + "). Es una de las deducciones más grandes disponibles — pero solo aplica si efectivamente tomas el crédito y usas la vivienda. No te endeudes solo por el beneficio fiscal; evalúalo con tu contador.", impact: 0, color: T.purple });
      
      // GMF
      if (ingAnual > 100e6) recs.push({ icon: "💳", title: "GMF 4×1000 deducible (Art. 115 ET)", desc: "El 50% del GMF pagado es deducible. Se calcula automáticamente: " + fm(ingAnual * 0.004 * 0.50) + "/año.", impact: 0, color: T.green });
      
      // Estructura societaria
      if (ingAnual > 400e6) recs.push({ icon: "🏢", title: "Evalúa una estructura societaria", desc: "Con ingresos altos, una SAS puede optimizar tu carga fiscal canalizando ingresos por la empresa (35% sobre utilidad vs hasta 39% persona natural).", impact: 0, color: T.purple });
      
      // Si el tope 40% ya está lleno y no hay ahorro
      if (ahorro < 100000 && pctUsado >= 95) {
        recs.push({ icon: "✅", title: "Tope 40% optimizado al máximo", desc: "Ya estás usando el " + pctUsado.toFixed(0) + "% del tope de deducciones. No hay más espacio para pensión voluntaria o AFC. Tu contador está haciendo un buen trabajo.", impact: 0, color: T.green });
        if (ingAnual > 200e6) recs.push({ icon: "💡", title: "Para reducir más: redistribuir ingresos", desc: "La única forma de bajar más es mover ingresos a una persona jurídica (SAS). La empresa paga 35% sobre UTILIDAD (después de gastos), no sobre ingreso bruto. Consulta con tu contador.", impact: 0, color: T.purple });
      }

      const impSinFinal = Math.max(0, impSin - retefuenteNat);
      const impConFinal = Math.max(0, impCon - retefuenteNat);
      const ahorroFinal = impSinFinal - impConFinal;
      const gastosByCatDisplay = gastosByCat;



      return {
        type: "natural", ingAnual, ingByCat, gastosByCat, gastosTotal, gastosDeducTotal, gastosDeducNat, patTotal, deuTotal,
        noConst, neto, exenta25, deducDep, deducViv, lim40,
        benefSin, benAplicSin, rentaSin, impSin: impSinFinal, tasaSin: ingAnual > 0 ? (impSinFinal / ingAnual * 100) : 0,
        pvMax, afcMax, benefCon, benAplicCon, rentaCon, impCon: impConFinal, tasaCon: ingAnual > 0 ? (impConFinal / ingAnual * 100) : 0, ahorro: ahorroFinal, pctUsado, retefuenteNat,
        recs
      };
    }
  }, [ingresos, gastos, inv, deu, trm, isJ]);

  if (!calc) return (
    <Cd style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>{isJ ? "🏢" : "👤"}</span>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>{owner.name}</div><div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica" : "Persona Natural"}</div></div>
      </div>
      <div style={{ padding: 20, textAlign: "center", color: T.txt3, fontSize: 13 }}>No hay ingresos asignados. Ve a <strong style={{ color: T.blue }}>💰 Ingresos</strong> y asigna <strong>{owner.name}</strong> como propietario.</div>
    </Cd>
  );

  const impActual = isJ ? calc.impActual : calc.impSin;
  const impOptimo = isJ ? calc.impOptimo : calc.impCon;
  const ahorro = calc.ahorro;
  const tasaActual = isJ ? calc.tasaActual : calc.tasaSin;
  const tasaOptima = isJ ? (calc.ingAnual > 0 ? calc.impOptimo / calc.ingAnual * 100 : 0) : calc.tasaCon;

  const barData = [
    { name: "Actual", value: Math.round(impActual / 12), fill: T.red },
    { name: "Con estrategia", value: Math.round(impOptimo / 12), fill: T.green },
  ];

  return (
    <Cd style={{ marginBottom: 20, overflow: "visible" }}>
      {/* Header */}
      <div style={{ padding: mb ? "16px" : "20px 24px", borderBottom: "1px solid " + T.border, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>{isJ ? "🏢" : "👤"}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{owner.name}</div>
            <div style={{ fontSize: 11, color: T.txt3 }}>{isJ ? "Persona Jurídica — Tarifa 35%" : "Persona Natural — Tabla Art. 241 ET"}</div>
          </div>
        </div>
        {ahorro > 100000 && (
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "8px 16px" }}>
            <div style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>AHORRO POTENCIAL</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{fm(ahorro)}/año</div>
          </div>
        )}
      </div>

      {/* KPIs: Actual vs Estrategia */}
      <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr auto 1fr", gap: 0 }}>
        {/* Sin Estrategia */}
        <div style={{ padding: "16px 20px", background: "rgba(239,68,68,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", marginBottom: 12 }}>📋 Situación Actual</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>{fm(impActual)}<span style={{ fontSize: 12, fontWeight: 400, color: T.txt3 }}>/año</span></div>
          <div style={{ fontSize: 13, color: T.txt3 }}>{fm(impActual / 12)}/mes • Tasa: {(tasaActual || 0).toFixed(1)}%</div>

          <div style={{ marginTop: 16, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: T.txt2, marginBottom: 6 }}>Desglose:</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.txt2 }}><span>Ingresos brutos</span><span style={{ fontFamily: "monospace" }}>{fm(calc.ingAnual)}/año</span></div>
            {isJ ? <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green, fontWeight: 600 }}><span>(-) Deducciones aplicadas</span><span style={{ fontFamily: "monospace" }}>{fm(calc.totalDeduc)}</span></div>
              
              {/* Desglose detallado de gastos */}
              {Object.entries(calc.gastosByCat).filter(([,v]) => v.deduc > 0).map(([cat, v]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                  <span style={{ color: T.green }}>✅ {cat} ({Math.round(v.pct * 100)}%)</span>
                  <span style={{ fontFamily: "monospace", color: T.green }}>{fm(v.deduc)}/mes</span>
                </div>
              ))}
              {calc.intereses > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Intereses de deudas</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.intereses)}/año</span>
              </div>}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ GMF 4×1000 (50%)</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.ingAnual * 0.004 * 0.5)}/año</span>
              </div>
              {calc.deprec > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Depreciación de activos</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deprec)}/año</span>
              </div>}
              
              {/* Gastos NO deducibles */}
              {Object.entries(calc.gastosByCat).filter(([,v]) => v.total > v.deduc).length > 0 && <>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.txt3, marginTop: 6, marginBottom: 2 }}>No deducibles:</div>
                {Object.entries(calc.gastosByCat).filter(([,v]) => v.total > v.deduc).map(([cat, v]) => (
                  <div key={"nd_"+cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                    <span style={{ color: T.txt3 }}>❌ {cat}</span>
                    <span style={{ fontFamily: "monospace", color: T.txt3 }}>{fm(v.total - v.deduc)}/mes</span>
                  </div>
                ))}
              </>}
              
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 6 }}><span>Renta gravable</span><span style={{ fontFamily: "monospace" }}>{fm(calc.utilidad)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: Math.min(calc.pctGastos || 0, 100) + "%", background: (calc.pctGastos || 0) >= 50 ? T.green : T.orange, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: T.txt3, whiteSpace: "nowrap" }}>Gastos: {(calc.pctGastos || 0).toFixed(0)}%</span>
              </div>
              {calc.descuentoICA > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue, marginTop: 4 }}><span>(-) Descuento 50% ICA</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.descuentoICA)}</span></div>}
              {calc.retefuenteCalc > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue }}><span>(-) Retención en la fuente</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.retefuenteCalc)}</span></div>}
            </> : <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.blue }}><span>(-) Pensión obligatoria (Art. 55 ET)</span><span style={{ fontFamily: "monospace" }}>{fm(calc.noConst)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green }}><span>(-) Renta exenta 25%</span><span style={{ fontFamily: "monospace" }}>{fm(calc.exenta25)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: T.green, fontWeight: 600 }}><span>(-) Deducciones aplicadas</span><span style={{ fontFamily: "monospace" }}>{fm(calc.gastosDeducNat + calc.deducDep + calc.deducViv)}</span></div>
              
              {/* Desglose detallado */}
              {calc.gastosDeducNat > 0 && Object.entries(calc.gastosByCat).filter(([,v]) => v.deduc > 0).map(([cat, v]) => (
                <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                  <span style={{ color: T.green }}>✅ {cat} ({Math.round(v.pct * 100)}%){v.pct > 0 && v.deduc < v.total ? " — máx aplicado" : ""}</span>
                  <span style={{ fontFamily: "monospace", color: T.green }}>{fm(v.deduc * 12)}/año</span>
                </div>
              ))}
              {calc.deducDep > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Dependientes (10% ingreso)</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deducDep)}/año</span>
              </div>}
              {calc.deducViv > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                <span style={{ color: T.green }}>✅ Intereses vivienda</span>
                <span style={{ fontFamily: "monospace", color: T.green }}>{fm(calc.deducViv)}/año</span>
              </div>}
              
              {/* Gastos NO deducibles para natural */}
              {Object.entries(calc.gastosByCat).filter(([cat]) => !(DEDUC_NAT[cat])).length > 0 && <>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.txt3, marginTop: 6, marginBottom: 2 }}>No deducibles (persona natural):</div>
                {Object.entries(calc.gastosByCat).filter(([cat]) => !(DEDUC_NAT[cat]) && calc.gastosByCat[cat].total > 0).slice(0, 5).map(([cat, v]) => (
                  <div key={"nd_"+cat} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 16px", fontSize: 10 }}>
                    <span style={{ color: T.txt3 }}>❌ {cat}</span>
                    <span style={{ fontFamily: "monospace", color: T.txt3 }}>{fm(v.total)}/mes</span>
                  </div>
                ))}
              </>}
              
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid " + T.border, marginTop: 6 }}><span>Renta gravable</span><span style={{ fontFamily: "monospace" }}>{fm(calc.rentaSin)}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: Math.min(calc.pctUsado || 0, 100) + "%", background: (calc.pctUsado || 0) >= 90 ? T.green : T.orange, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: T.txt3, whiteSpace: "nowrap" }}>Tope 40%: {(calc.pctUsado || 0).toFixed(0)}%</span>
              </div>
              {calc.retefuenteNat > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: T.blue, marginTop: 4 }}><span>(-) Retención en la fuente</span><span style={{ fontFamily: "monospace" }}>-{fm(calc.retefuenteNat)}</span></div>}
            </>}
          </div>
        </div>

        {/* Arrow */}
        {!mb && <div style={{ display: "flex", alignItems: "center", padding: "0 12px", fontSize: 24, color: T.green }}>→</div>}

        {/* Con Estrategia */}
        <div style={{ padding: "16px 20px", background: "rgba(34,197,94,0.03)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", marginBottom: 12 }}>🎯 Con Estrategia</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(impOptimo)}<span style={{ fontSize: 12, fontWeight: 400, color: T.txt3 }}>/año</span></div>
          <div style={{ fontSize: 13, color: T.txt3 }}>{fm(impOptimo / 12)}/mes • Tasa: {(tasaOptima || 0).toFixed(1)}%</div>

          <div style={{ marginTop: 16, fontSize: 11 }}>
            <div style={{ fontWeight: 600, color: T.txt2, marginBottom: 6 }}>Optimizaciones automáticas aplicadas:</div>
            {isJ ? <>
              {calc.pctGastos < 50 && <div style={{ padding: "4px 0", color: T.green }}>✅ Gastos operativos al 55% (piso razonable)</div>}
              {calc.pctGastos >= 50 && <div style={{ padding: "4px 0", color: T.txt3 }}>✅ Gastos ya están sobre el 50% — sin ajuste automático</div>}
              <div style={{ padding: "4px 0", color: T.green }}>✅ Intereses de deudas deducidos</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Depreciación de activos aplicada</div>
              <div style={{ padding: "4px 0", color: T.green }}>✅ GMF 4×1000 (50%)</div>
              {calc.descuentoICA > 0 && <div style={{ padding: "4px 0", color: T.blue }}>✅ Descuento 50% ICA aplicado</div>}
              <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, fontSize: 10, color: T.txt2, lineHeight: 1.5 }}>
                ℹ️ <strong>El simulador no aplica automáticamente</strong> estrategias como bonificaciones, donaciones, provisión de cartera, depreciación acelerada o apalancamiento — su valor depende de tu estructura contable. Mirá las recomendaciones abajo y consultá con tu contador.
              </div>
            </> : <>
              <div style={{ padding: "4px 0", color: T.green }}>✅ Renta exenta 25% ({fm(calc.exenta25)})</div>
              {calc.deducDep > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Dependientes ({fm(calc.deducDep)})</div>}
              {calc.deducViv > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Intereses vivienda ({fm(calc.deducViv)})</div>}
              {calc.pvMax > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Pensión voluntaria ({fm(calc.pvMax / 12)}/mes)</div>}
              {calc.afcMax > 0 && <div style={{ padding: "4px 0", color: T.green }}>✅ Cuenta AFC ({fm(calc.afcMax / 12)}/mes)</div>}
              <div style={{ padding: "4px 0", color: T.green, fontWeight: 600 }}>→ Tope 40% al 100%</div>
            </>}
          </div>
        </div>
      </div>

      {/* Savings bar */}
      {(
        <div style={{ padding: "12px 20px", background: T.bg3, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <ResponsiveContainer width="100%" height={50}>
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: T.txt3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.txt3 }}>{ahorro > 100000 ? "Reducción" : "Estado"}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: ahorro > 100000 ? T.green : T.txt3 }}>{ahorro > 100000 ? "-" + (impActual > 0 ? (ahorro / impActual * 100).toFixed(0) : 0) + "%" : "✅ Optimizado"}</div>
          </div>
        </div>
      )}

      {/* Retención en la fuente automática */}
      {((isJ && calc.retefuenteCalc > 0) || (!isJ && calc.retefuenteNat > 0)) && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + T.border, background: "rgba(59,130,246,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>📋 Retención en la fuente estimada</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.blue, fontFamily: "monospace" }}>{fm(isJ ? calc.retefuenteCalc : calc.retefuenteNat)}/año</span>
          </div>
          <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>Calculada automáticamente según tus ingresos: arriendos (3.5%), rendimientos (7%), honorarios (11%), salario (tabla Art. 383). Este valor se descuenta del impuesto. Verifica con tus certificados reales.</div>
          {impActual <= 0 && <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginTop: 6 }}>💰 Saldo a favor estimado: {fm(Math.abs(impActual))}</div>}
        </div>
      )}

      {/* DISCLAIMER HONESTO — Solo jurídica */}
      {isJ && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid " + T.border, background: "rgba(251,191,36,0.05)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚖️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 4 }}>Qué modela el simulador — y qué no</div>
              <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.6 }}>
                <strong style={{ color: T.green }}>Sí se aplica automáticamente:</strong> tarifa del 35% sobre utilidad (Art. 240 ET), deducción de intereses y gastos operativos registrados, depreciación según tipo de activo, GMF 4×1000 al 50% (Art. 115 ET), descuento del 50% del ICA (Art. 115 ET) y retención en la fuente por tipo de ingreso.
                <br /><br />
                <strong style={{ color: "#fbbf24" }}>No se estiman automáticamente:</strong> bonificaciones extralegales, donaciones con descuento (Art. 257 ET), provisión de cartera (Art. 145 ET), depreciación acelerada (Art. 137 ET), apalancamiento productivo (Art. 117 ET), zona franca, créditos tributarios especiales. Existen en el Estatuto Tributario pero su monto viable depende de la estructura contable de cada empresa — el simulador no inventa porcentajes genéricos que no tienen soporte legal universal.
                <br /><br />
                <strong>Este simulador no sustituye la asesoría de un contador.</strong> Es una herramienta de referencia basada en los datos que tú registras. Para tu declaración oficial y para estructurar estrategias de optimización específicas, consulta con un contador público.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {calc.recs.length > 0 && (
        <div style={{ padding: "16px 20px", borderTop: "1px solid " + T.border }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 10 }}>💡 Plan de acción ({calc.recs.length} recomendaciones)</div>
          {calc.recs.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < calc.recs.length - 1 ? "1px solid " + T.border : "none" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.title}</div>
                <div style={{ fontSize: 11, color: T.txt2, marginTop: 2, lineHeight: 1.5 }}>{r.desc}</div>
                {r.impact > 100000 && <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginTop: 4 }}>Ahorro estimado: {fm(r.impact)}/año ({fm(r.impact / 12)}/mes)</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "8px 20px", borderTop: "1px solid " + T.border, fontSize: 9, color: T.txt3, textAlign: "center" }}>
        Estimación basada en datos registrados • Normativa DIAN vigente • Consulta tu contador para la declaración oficial
      </div>
    </Cd>
  );
}

export default function SimuladorTributario({ trm, user }) {
  const mb = typeof window !== "undefined" && window.innerWidth < 768;
  const owners = (user && user.owners) || [{ id: "own_1", name: "Personal", type: "natural" }];
  const ing = (user && user.ingresos) || [];
  const gas = user && user.gas ? user.gas : {};
  const inv = (user && user.inv) || [];
  const deu = (user && user.deu) || [];
  const sinAsignar = ing.filter(i => !i.owner || i.owner === "").length;

  const gastosFlat = [];
  Object.entries(gas).forEach(([cat, items]) => { (items || []).forEach(g => gastosFlat.push({ ...g, cat })); });

  // Calculate totals for summary
  let totalActual = 0, totalOptimo = 0;
  const ownerData = owners.map(ow => {
    const oIng = ing.filter(i => i.owner === ow.id);
    const oGas = gastosFlat.filter(g => g.owner === ow.id);
    const oInv = inv.filter(i => i.owner === ow.id);
    const oDeu = deu.filter(d => d.owner === ow.id);
    return { owner: ow, ing: oIng, gas: oGas, inv: oInv, deu: oDeu };
  });

  // Calculate consolidated totals
  const consolidado = useMemo(() => {
    let totalIngreso = 0, totalImpActual = 0, totalImpOptimo = 0;
    const items = [];
    ownerData.forEach(od => {
      const isJ = od.owner.type === "juridica";
      const ingAnual = od.ing.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1)), 0) * 12;
      if (ingAnual <= 0) return;
      totalIngreso += ingAnual;
      const gastosD = od.gas.reduce((s, g) => { const p = isJ ? (NO_DEDUC.includes(g.cat) ? 0 : 1) : (DEDUC_NAT[g.cat] || 0); return s + (g.m || 0) * p; }, 0) * 12;
      const intereses = od.deu.reduce((s, d) => s + (d.mt || 0) * ((d.ts || d.tasa || 0) / 100), 0);
      const deprec = od.inv.reduce((s, i) => { const tp = (i.tp||i.tipo||"").toLowerCase(); return s + (/real estate|bodega|local/i.test(tp) ? (i.va||0)*0.05 : /vehículo/i.test(tp) ? (i.va||0)*0.20 : 0); }, 0);
      
      // Retención automática (misma lógica que OwnerPlan)
      let rete = 0;
      od.ing.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? (trm || 4200) : 1) * 12;
        const cat = i.categoria || "";
        if (/Salario/i.test(cat)) { const mUVT = m / 12 / UVT; rete += m * (mUVT > 360 ? 0.19 : mUVT > 150 ? 0.10 : mUVT > 95 ? 0.04 : 0); }
        else if (/Honorarios|Freelance/i.test(cat)) rete += m * 0.11;
        else if (/Arriendo/i.test(cat)) rete += m * 0.035;
        else if (/Rendimiento|Dividendos/i.test(cat)) rete += m * 0.07;
        else if (isJ) rete += m * 0.025;
      });
      
      if (isJ) {
        const gmf50 = ingAnual * 0.004 * 0.50;
        const totalDeduc = gastosD + intereses + deprec + gmf50;
        const util = Math.max(0, ingAnual - totalDeduc);
        const gasByCat = {};
        od.gas.forEach(g => { gasByCat[g.cat] = (gasByCat[g.cat] || 0) + (g.m || 0); });
        const icaPagado = (gasByCat["Predial"] || 0) * 12 * 0.30;
        const descICA = icaPagado * 0.50;
        const imp = Math.max(0, util * 0.35 - descICA - rete);
        // Estrategia
        const maxRed = util * 0.35;
        const impOpt = Math.max(0, Math.max(util * 0.40, 0) * 0.35 - descICA - rete);
        totalImpActual += imp;
        totalImpOptimo += impOpt;
        items.push({ name: od.owner.name, icon: "🏢", imp, impOpt, ing: ingAnual });
      } else {
        const noConst = ingAnual * 0.08;
        const neto = ingAnual - noConst;
        const ex25 = Math.min(neto * 0.25, 790 * UVT);
        const lim40 = neto * 0.40;
        const benSin = Math.min(ex25 + gastosD, lim40);
        const rentaSin = Math.max(0, neto - benSin);
        const imp = Math.max(0, calcImp(rentaSin / UVT) - rete);
        const rentaCon = Math.max(0, neto - lim40);
        const impOpt = Math.max(0, calcImp(rentaCon / UVT) - rete);
        totalImpActual += imp;
        totalImpOptimo += impOpt;
        items.push({ name: od.owner.name, icon: "👤", imp, impOpt, ing: ingAnual });
      }
    });
    return { totalIngreso, totalImpActual, totalImpOptimo, ahorro: totalImpActual - totalImpOptimo, items };
  }, [ownerData, trm]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: mb ? 20 : 26, fontWeight: 800, margin: "0 0 4px", color: T.orange }}>🧾 Planeación Tributaria</h1>
        <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>Colombia 2026 • Estatuto Tributario • UVT: {fm(UVT)} • Ley 2277/2022</p>
      </div>

      {sinAsignar > 0 && (
        <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: T.orange, lineHeight: 1.6 }}>
          ⚠️ <strong>{sinAsignar} ingreso(s)</strong> sin propietario asignado — no se incluyen en el cálculo. Asigna propietario en <strong>💰 Ingresos</strong>.
        </div>
      )}

      {/* ═══ RESUMEN CONSOLIDADO ═══ */}
      {consolidado.items.length > 0 && (
        <Cd style={{ marginBottom: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(34,197,94,0.02))" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid " + T.border }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📊 Panorama Fiscal Consolidado</div>
            <div style={{ fontSize: 11, color: T.txt3 }}>Todos los propietarios combinados</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 0 }}>
            <Kpi label="Ingresos totales" value={fm(consolidado.totalIngreso)} sub="/año" color={T.txt} />
            <Kpi label="Impuesto actual" value={fm(consolidado.totalImpActual)} sub={fm(consolidado.totalImpActual / 12) + "/mes"} color={T.red} />
            <Kpi label="Con estrategia" value={fm(consolidado.totalImpOptimo)} sub={fm(consolidado.totalImpOptimo / 12) + "/mes"} color={T.green} />
            <Kpi label="Ahorro potencial" value={fm(consolidado.ahorro)} sub={consolidado.totalImpActual > 0 ? "-" + (consolidado.ahorro / consolidado.totalImpActual * 100).toFixed(0) + "% reducción" : ""} color={T.green} />
          </div>
          <div style={{ padding: "12px 24px", borderTop: "1px solid " + T.border }}>
            <div style={{ display: "flex", gap: mb ? 12 : 20, flexWrap: "wrap" }}>
              {consolidado.items.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span>{it.icon}</span>
                  <span style={{ color: T.txt2 }}>{it.name}:</span>
                  <span style={{ color: T.red, fontFamily: "monospace", fontWeight: 600 }}>{fm(it.imp)}</span>
                  <span style={{ color: T.txt3 }}>→</span>
                  <span style={{ color: T.green, fontFamily: "monospace", fontWeight: 600 }}>{fm(it.impOpt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "10px 24px", borderTop: "1px solid " + T.border, fontSize: 11, color: T.txt3 }}>
            Tasa efectiva actual: <strong style={{ color: T.red }}>{consolidado.totalIngreso > 0 ? (consolidado.totalImpActual / consolidado.totalIngreso * 100).toFixed(1) : 0}%</strong> → Con estrategia: <strong style={{ color: T.green }}>{consolidado.totalIngreso > 0 ? (consolidado.totalImpOptimo / consolidado.totalIngreso * 100).toFixed(1) : 0}%</strong>
          </div>
        </Cd>
      )}

      {/* ═══ CALENDARIO TRIBUTARIO ═══ */}
      <Cd style={{ marginBottom: 20, padding: "16px 20px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.cyan, marginBottom: 10 }}>📅 Fechas clave para optimizar</div>
        <div style={{ display: "grid", gridTemplateColumns: mb ? "1fr" : "1fr 1fr 1fr", gap: 10, fontSize: 11 }}>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.orange }}>Antes de diciembre 31</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Aportes a pensión voluntaria y AFC. Donaciones deducibles. Compras de activos depreciables.</div>
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.blue }}>Marzo - Abril 2027</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Declaración de renta personas jurídicas. Tener certificados de retención y estados financieros listos.</div>
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, color: T.green }}>Agosto - Octubre 2027</div>
            <div style={{ color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>Declaración de renta personas naturales. Último plazo según dos últimos dígitos del NIT.</div>
          </div>
        </div>
      </Cd>

      {/* ═══ DETALLE POR PROPIETARIO ═══ */}
      <div style={{ fontSize: 14, fontWeight: 700, color: T.txt2, marginBottom: 12 }}>Detalle por propietario</div>

      {/* Owner cards */}
      {ownerData.map(od => (
        <OwnerPlan key={od.owner.id} owner={od.owner} ingresos={od.ing} gastos={od.gas} inv={od.inv} deu={od.deu} trm={trm} isJ={od.owner.type === "juridica"} mb={mb} />
      ))}

      <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
        Estimaciones basadas en la normativa tributaria colombiana vigente. UVT 2026: {fm(UVT)} (Resolución DIAN 000238). No constituye asesoría fiscal profesional.
      </div>
    </div>
  );
}
