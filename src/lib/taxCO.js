// ═══════════════════════════════════════════════════════════════════════════
// ESTIMACIÓN TRIBUTARIA COLOMBIA (DIAN, Ley 2277/2022, ET)
// ─────────────────────────────────────────────────────────────────────────
// Extraído de App.jsx. No modificar la lógica aquí sin actualizar también
// los consumidores (App.jsx y SimuladorAvanzado.jsx).
//
// CONTRATO:
//   input:  user object {owners, ingresos, gas, deu, inv, trm}
//   output: {total, mes, detalle: [{name, type, impuesto, impOptimizado, ...}], sinClasificar}
//
// La función respeta la semántica `sim:false` SI el caller filtra los
// ingresos/gastos/deudas antes de pasarlos. Dentro de esta función NO se
// filtra por sim — es responsabilidad del caller decidir qué items incluir.
// ═══════════════════════════════════════════════════════════════════════════

export const UVT = 52374;

export const TABLA_IMP = [
  { d: 0,     h: 1090,     t: 0,  b: 0 },
  { d: 1090,  h: 1700,     t: 19, b: 0 },
  { d: 1700,  h: 4100,     t: 28, b: 115.86 },
  { d: 4100,  h: 8670,     t: 33, b: 787.86 },
  { d: 8670,  h: 18970,    t: 35, b: 2295.96 },
  { d: 18970, h: 31000,    t: 37, b: 5900.96 },
  { d: 31000, h: Infinity, t: 39, b: 10352.96 },
];

export const calcImpRenta = (uvtBase) => {
  for (let i = TABLA_IMP.length - 1; i >= 0; i--) {
    if (uvtBase > TABLA_IMP[i].d) {
      return (TABLA_IMP[i].b + (uvtBase - TABLA_IMP[i].d) * TABLA_IMP[i].t / 100) * UVT;
    }
  }
  return 0;
};

export const estimarImpuesto = (u) => {
  if (!u) return { total: 0, mes: 0, detalle: [], sinClasificar: 0 };
  const owners = (u.owners || [{ id: "own_1", name: "Personal", type: "natural" }]);
  const ing = (u.ingresos || []);
  const gas = u.gas || {};
  const deu = (u.deu || []);
  let totalImp = 0;
  const detalle = [];
  const sinClasificar = ing.filter(i => !i.owner || i.owner === "").length;

  owners.forEach(ow => {
    const oIng = ing.filter(i => {
      if (!i.owner || i.owner === "" || i.owner === "na") return false;
      return i.owner === ow.id;
    });
    if (oIng.length === 0) return;

    const isJ = ow.type === "juridica";

    // Gastos de este owner
    const oGas = [];
    Object.entries(gas).forEach(([cat, items]) => {
      (items || []).forEach(g => {
        const esDeEste = g.owner === ow.id;
        if (!esDeEste || g.owner === "na") return;
        oGas.push({ ...g, cat });
      });
    });

    // Deudas de este owner
    const oDeu = deu.filter(d => d.owner === ow.id);

    if (isJ) {
      // ═══ PERSONA JURÍDICA: 35% sobre utilidad ═══
      const ingAnual = oIng.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1)), 0) * 12;
      const gastosDeducJ = oGas.reduce((s, g) => s + (g.m || 0), 0) * 12;
      const interesesJ = oDeu.reduce((s, d) => { const saldo = d.mt || 0; const tasa = (d.ts || d.tasa || 0) / 100; return s + saldo * tasa; }, 0);
      const oInv = (u.inv || []).filter(i => i.owner === ow.id);
      const deprec = oInv.reduce((s, i) => {
        const tp = (i.tp || i.tipo || "").toLowerCase();
        if (/real estate|bodega|local|oficina/i.test(tp)) return s + (i.va || 0) * 0.05;
        if (/vehículo|vehiculo/i.test(tp)) return s + (i.va || 0) * 0.20;
        return s;
      }, 0);
      const gmf50 = ingAnual * 0.004 * 0.50;
      const totalDeduc = gastosDeducJ + interesesJ + deprec + gmf50;
      const utilidad = Math.max(0, ingAnual - totalDeduc);
      // Retención automática según tipo de ingreso
      let reteJ = 0;
      oIng.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1) * 12;
        const cat = i.categoria || "";
        if (/Arriendo/i.test(cat)) reteJ += m * 0.035;
        else if (/Rendimiento|Dividendos/i.test(cat)) reteJ += m * 0.07;
        else if (/Honorarios|Freelance/i.test(cat)) reteJ += m * 0.11;
        else reteJ += m * 0.025;
      });
      // Descuento 50% ICA
      const icaGas = oGas.filter(g => g.cat === "Predial").reduce((s, g) => s + (g.m || 0), 0) * 12 * 0.30;
      const descICA = icaGas * 0.50;
      const impBruto = utilidad * 0.35;
      const impActual = Math.max(0, impBruto - descICA - reteJ);
      totalImp += impActual;
      // ── OPTIMIZACIÓN PERSONA JURÍDICA ──
      // Las estrategias corporativas (bonificaciones extralegales, donaciones Art.257 ET,
      // provisión cartera Art.145 ET, apalancamiento productivo, depreciación acelerada,
      // zona franca, etc.) requieren asesoría contable específica — el valor y viabilidad
      // de cada una depende del caso particular. El simulador NO estima automáticamente
      // su impacto con porcentajes genéricos porque sería inventar ahorros sin soporte.
      // → impOptimizado = impActual para jurídica. El usuario puede ajustar manualmente
      //   con el slider del simulador si aplica estrategias reales con su contador.
      const impBrutoOpt = impBruto;
      const impOptimoJ = impActual;
      detalle.push({
        name: ow.name, type: "juridica", ingreso: ingAnual,
        gastosRegistrados: gastosDeducJ, intereses: interesesJ, deprec, gastosDeduc: totalDeduc,
        // impuesto/impOptimizado = SALDO en declaración (después de descuentos). Legacy.
        baseGravable: utilidad, impuesto: impActual, impSinOpt: impActual, impOptimizado: impOptimoJ,
        // impBruto/impOptBruto = TOTAL (35% utilidad, antes de descuentos ICA/reteJ).
        // reteN = ICA + retenciones recibidas (equivalente a retención en la fuente de natural).
        impBruto: impBruto, impOptBruto: impBrutoOpt, reteN: descICA + reteJ,
        ahorroOptimo: impActual - impOptimoJ,
        tasa: ingAnual > 0 ? (impActual / ingAnual * 100) : 0,
        tasaBruta: ingAnual > 0 ? (impBruto / ingAnual * 100) : 0,
        gastosNoRegistrados: totalDeduc < ingAnual * 0.4,
      });
    } else {
      // ═══ PERSONA NATURAL — Cédula General (Ley 2277/2022, ET Arts. 55,206,336,383,387) ═══
      const trm = u.trm || 4200;
      // Clasificar ingresos por subcédula
      const salAnual = oIng.filter(i => i.categoria === "Salario").reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const honAnual = oIng.filter(i => /Honorarios|Freelance/i.test(i.categoria || "")).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const rentasAnual = oIng.filter(i => /Arriendo/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const rendAnual = oIng.filter(i => /Rendimiento|Inversión|CDT/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const divAnual = oIng.filter(i => /Dividendos/i.test(i.categoria || "")).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const pensAnual = oIng.filter(i => /Pensión/i.test(i.categoria || "")).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const otrosAnual = oIng.filter(i => !["Salario", "Honorarios", "Freelance", "Arriendo", "Rendimiento", "Inversión", "CDT", "Dividendos", "Pensión"].some(c => (i.categoria || "").includes(c))).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;

      const ingLaboral = salAnual + honAnual;
      const ingCapital = rendAnual;
      const ingNoLaboral = rentasAnual + otrosAnual;
      const ingAnual = ingLaboral + ingCapital + ingNoLaboral + divAnual + pensAnual;
      if (ingAnual <= 0) return;

      // ── 1. INGRESOS NO CONSTITUTIVOS DE RENTA (Art. 55-56 ET) ──
      const noConstSal = salAnual * 0.04;
      const ibcIndep = honAnual * 0.40;
      const noConstHon = ibcIndep * 0.04;
      const totalNoConst = noConstSal + noConstHon;

      // ── 2. RENTAS DE TRABAJO (salario + honorarios) ──
      const netoLaboral = ingLaboral - totalNoConst;

      // Deducciones solo para rentas de trabajo (Art. 387 ET):
      const gastoEduc = oGas.filter(g => g.cat === "Educación").reduce((s, g) => s + (g.m || 0), 0);
      const tieneDep = gastoEduc > 500000;
      const deducDep = tieneDep ? Math.min(ingLaboral * 0.10, 384 * UVT) : 0;

      const gastoSalud = oGas.filter(g => g.cat === "Salud").reduce((s, g) => s + (g.m || 0), 0) * 12;
      const deducMedicina = Math.min(gastoSalud, 16 * UVT * 12);

      const interesesHip = oDeu.reduce((s, d) => {
        const saldo = d.mt || 0; const tasa = (d.ts || d.tasa || 0) / 100;
        if (/mortgage|hipoteca|vivienda|casa|apto/i.test((d.tp || "") + (d.n || ""))) return s + saldo * tasa;
        return s;
      }, 0);
      const deducVivienda = Math.min(interesesHip, 1200 * UVT);

      const gmfDeducible = ingAnual * 0.004 * 0.50;

      const totalDeducciones = deducDep + deducMedicina + deducVivienda + gmfDeducible;

      const baseExenta = Math.max(0, netoLaboral - totalDeducciones);
      const exenta25 = Math.min(baseExenta * 0.25, 790 * UVT);

      const lim40 = netoLaboral * 0.40;
      const benefLaboral = Math.min(exenta25 + totalDeducciones, lim40);

      const rentaLiqTrabajo = Math.max(0, netoLaboral - benefLaboral);

      // ── 3. RENTAS DE CAPITAL ──
      const costosCapital = rendAnual * 0.01;
      const rentaLiqCapital = Math.max(0, ingCapital - costosCapital);

      // ── 4. RENTAS NO LABORALES ──
      const gastosInmueble = oGas.filter(g => ["Predial", "Mantenimiento", "Vivienda", "Seguros", "Servicios"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const rentaLiqNoLaboral = Math.max(0, ingNoLaboral - gastosInmueble * 0.5);

      // ── 5. DIVIDENDOS (tarifa especial Art. 242 ET) ──
      const divExentos = Math.min(divAnual, 300 * UVT);
      const divGravados = Math.max(0, divAnual - divExentos);
      const impDiv = divGravados * 0.15;

      // ── 6. RENTA LÍQUIDA CÉDULA GENERAL ──
      const rentaLiqGeneral = rentaLiqTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const imp = calcImpRenta(rentaLiqGeneral / UVT) + impDiv;

      // ── CON OPTIMIZACIÓN: PV + AFC llenan tope 40% ──
      const espacioPV = Math.max(0, lim40 - benefLaboral);
      const pensionVol = Math.min(espacioPV, netoLaboral * 0.25, 2500 * UVT);
      const espacioAFC = Math.max(0, lim40 - benefLaboral - pensionVol);
      const afc = Math.min(espacioAFC, netoLaboral * 0.30, 3800 * UVT);
      const rentaOptTrabajo = Math.max(0, netoLaboral - Math.min(exenta25 + totalDeducciones + pensionVol + afc, lim40));
      const rentaOptGeneral = rentaOptTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const impOpt = calcImpRenta(rentaOptGeneral / UVT) + impDiv;

      // ── RETENCIÓN EN LA FUENTE ──
      let reteN = 0;
      oIng.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? trm : 1) * 12;
        const cat = i.categoria || "";
        if (/Salario/i.test(cat)) { const mUVT = m / 12 / UVT; reteN += m * (mUVT > 360 ? 0.19 : mUVT > 150 ? 0.10 : mUVT > 95 ? 0.04 : 0); }
        else if (/Honorarios|Freelance/i.test(cat)) reteN += m * 0.11;
        else if (/Arriendo/i.test(cat)) reteN += m * 0.035;
        else if (/Rendimiento|Dividendos|CDT|Inversión/i.test(cat)) reteN += m * 0.07;
      });
      // Restar retención
      const impActualNat = Math.max(0, imp - reteN);
      const impOptNat = Math.max(0, impOpt - reteN);
      const ahorroNat = impActualNat - impOptNat;
      totalImp += impActualNat;
      detalle.push({
        name: ow.name, type: "natural", ingreso: ingAnual,
        ingLaboral, ingCapital, ingNoLaboral, divAnual, pensAnual,
        noConst: totalNoConst, neto: netoLaboral,
        exenta25, deducDep, deducMedicina, deducVivienda, gmfDeducible,
        pensionVol, afc, totalDeducciones,
        lim40, benAplic: benefLaboral,
        baseGravable: rentaLiqGeneral,
        // impuesto/impOptimizado = SALDO (después de restar retención). Legacy, usado por el cash flow.
        impuesto: impActualNat,
        impSinOpt: impActualNat, impOptimizado: impOptNat,
        // impBruto/impOptBruto = TOTAL por tabla progresiva (antes de retención). Usado por el display transparente
        // y por el cash flow correcto (porque la retención ya salió del salario bruto reportado por el usuario).
        impBruto: imp,
        impOptBruto: impOpt,
        ahorroOptimo: ahorroNat,
        tasa: ingAnual > 0 ? (impActualNat / ingAnual * 100) : 0,
        tasaBruta: ingAnual > 0 ? (imp / ingAnual * 100) : 0,
        espacioParaPVyAFC: espacioPV, reteN, impDiv,
      });
    }
  });
  return { total: totalImp, mes: totalImp / 12, detalle, sinClasificar };
};
