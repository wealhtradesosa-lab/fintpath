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
//
// Desde Sprint 1B (commit 25ee25d+), el motor consume `fiscalCode` en vez
// de regex sobre strings libres. normalizeFiscalData() se llama al inicio
// para asegurar que todos los items tengan fiscalCode (legacy items se
// infieren con reglas conservadoras documentadas en normalize.js).
// ═══════════════════════════════════════════════════════════════════════════

import { normalizeFiscalData } from "./normalize.js";
import {
  LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS,
  CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS,
  NOL_ARRIENDO_INMUEBLE,
  DIV_ART49_GRAVADOS, DIV_INTERSOCIETARIOS,
  PEN_JUBILACION,
  DEU_NAT_VIVIENDA_HABITACIONAL,
  GAS_JUR_NO_DEDUCIBLE,
} from "./fiscalCodes.js";
import { TABLA_ART_241, calcImpRenta as calcImpRentaCore } from "./tablaArt241.js";

export const UVT = 52374;

// Re-exports para compatibilidad con consumidores existentes.
// La fuente única de verdad está ahora en src/lib/tablaArt241.js.
export const TABLA_IMP = TABLA_ART_241;
export const calcImpRenta = (uvtBase) => calcImpRentaCore(uvtBase, UVT);

export const estimarImpuesto = (u) => {
  if (!u) return { total: 0, mes: 0, detalle: [], sinClasificar: 0 };
  // Normalizar: asegurar que todos los items tengan fiscalCode (inferir si es
  // legacy). Los warnings no se consumen aquí; la UI los obtiene con
  // getFiscalWarnings() por separado.
  const { data: norm } = normalizeFiscalData(u);
  u = norm;
  const owners = (u.owners || [{ id: "own_1", name: "Personal", type: "natural" }]);
  // Respeta el flag sim: si el usuario desactivó un item, el simulador lo ignora.
  const ing = (u.ingresos || []).filter(i => i.sim !== false);
  const gasRaw = u.gas || {};
  const gas = {};
  Object.entries(gasRaw).forEach(([cat, items]) => {
    const filtered = (items || []).filter(g => g.sim !== false);
    if (filtered.length > 0) gas[cat] = filtered;
  });
  const deu = (u.deu || []).filter(d => d.sim !== false);
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
      // ═══ PERSONA JURÍDICA — Régimen dependiente ═══
      const regimen = ow.regimen || "ordinario";
      const ingAnual = oIng.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1)), 0) * 12;
      // Gastos deducibles jurídica. Se excluyen los marcados explícitamente como
      // no deducibles por el usuario (GAS_JUR_NO_DEDUCIBLE — usado cuando el
      // contribuyente confirma que el gasto no cumple causalidad Art. 107 ET).
      // Items legacy sin fiscalCode suman al 100% como antes (backwards compat).
      const gastosDeducJ = oGas.filter(g => g.fiscalCode !== GAS_JUR_NO_DEDUCIBLE).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const gastosTotalJ = oGas.reduce((s, g) => s + (g.m || 0), 0) * 12;
      const interesesJ = oDeu.reduce((s, d) => { const saldo = d.mt || 0; const tasa = (d.ts || d.tasa || 0) / 100; return s + saldo * tasa; }, 0);
      // DEPRECIACIÓN (Art. 128-141 ET): decisión deliberada del contribuyente, no automática.
      // Solo aplica a bienes usados en la actividad productora de renta, con vida útil fiscal
      // definida (2-3% construcción, 20% vehículos, etc.) y solo sobre el valor depreciable
      // (no terreno). El usuario la registra como gasto con categoría "Depreciación" en Egresos;
      // ya queda incluida en gastosDeducJ. Esta variable `deprec` es solo para display/desglose.
      const deprec = oGas.filter(g => /Depreciación|Depreciacion|Depreciation/i.test(g.cat || "")).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const gmf50 = ingAnual * 0.004 * 0.50;
      const totalDeduc = gastosDeducJ + interesesJ + gmf50;
      const utilidad = Math.max(0, ingAnual - totalDeduc);

      // Sub-tipos de ingresos con tratamiento especial por Art. 48 ET
      const dividIntersocietarios = oIng.filter(i => i.fiscalCode === DIV_INTERSOCIETARIOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1)), 0) * 12;

      // Retención automática según tipo de ingreso (solo aplica a régimen ordinario/ZF/CHC; SIMPLE sustituye retención)
      let reteJ = 0;
      if (regimen !== "simple" && regimen !== "exenta") {
        oIng.forEach(i => {
          const m = (i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1) * 12;
          const fc = i.fiscalCode;
          if (fc === NOL_ARRIENDO_INMUEBLE) reteJ += m * 0.035;
          else if (fc === CAP_INTERESES_BANCARIOS) reteJ += m * 0.07;
          else if (fc === CAP_FIC) reteJ += 0; // FIC: retención a nivel del fondo, no del partícipe
          else if (fc === DIV_INTERSOCIETARIOS) reteJ += 0; // Inter-societarios: no retención (Art. 48 ET)
          else if (fc === CAP_RENDIMIENTO_GENERICO) reteJ += m * 0.07;
          else if (fc === LAB_HONORARIOS_CON_EMPLEADOS || fc === LAB_HONORARIOS_SIN_EMPLEADOS) reteJ += m * 0.11;
          else reteJ += m * 0.025;
        });
      }
      // Descuento 50% ICA (solo ordinario y zona franca)
      const icaGas = oGas.filter(g => g.cat === "Predial").reduce((s, g) => s + (g.m || 0), 0) * 12 * 0.30;
      const descICA = (regimen === "ordinario" || regimen === "zona_franca") ? icaGas * 0.50 : 0;

      // ── CÁLCULO POR RÉGIMEN ──
      let impBruto = 0, baseGravable = utilidad, tarifa = 0, regimenNota = "";
      if (regimen === "ordinario") {
        tarifa = 0.35;
        // Art. 48 ET: dividendos inter-societarios no constitutivos de renta (no se gravan)
        const baseOrd = Math.max(0, utilidad - dividIntersocietarios);
        baseGravable = baseOrd;
        impBruto = baseOrd * 0.35;
        regimenNota = "Régimen Ordinario 35% sobre utilidad. Dividendos inter-societarios no gravados (Art. 48 ET).";
      } else if (regimen === "simple") {
        // SIMPLE: tarifa sobre ingresos brutos. Usamos 5% conservador (promedio grupos 1-4).
        // Grupos reales: 1.4% (comercio), 3.4% (servicios), 5.0% (consultoría), 11.5% (hidrocarburos).
        tarifa = 0.05;
        baseGravable = ingAnual;
        impBruto = ingAnual * 0.05;
        regimenNota = "Régimen Simple (RST) — estimación 5% sobre ingresos brutos (aproximación; tarifa real depende de grupo de actividad: 1,4%–11,5%).";
      } else if (regimen === "zona_franca") {
        tarifa = 0.20;
        const baseZF = Math.max(0, utilidad - dividIntersocietarios);
        baseGravable = baseZF;
        impBruto = baseZF * 0.20;
        regimenNota = "Zona Franca — 20% sobre utilidad calificada (Art. 240-1 ET).";
      } else if (regimen === "chc") {
        // CHC: dividendos y rentas pasivas de subsidiarias extranjeras pueden ser exentas.
        // Aproximación conservadora: aplicamos ordinario 35% sobre utilidad después de excluir dividendos.
        tarifa = 0.35;
        const baseCHC = Math.max(0, utilidad - dividIntersocietarios);
        baseGravable = baseCHC;
        impBruto = baseCHC * 0.35;
        regimenNota = "CHC (Compañía Holding Colombiana) — 35% sobre utilidad. Exenciones específicas sobre dividendos/ganancias de subsidiarias extranjeras no modeladas automáticamente (Art. 894 ET).";
      } else if (regimen === "exenta") {
        tarifa = 0;
        baseGravable = 0;
        impBruto = 0;
        regimenNota = "Régimen de Economía Naranja / Exenta — 0% mientras dure el beneficio (Art. 235-2 ET, numerales 1 y 2).";
      }

      // ── PÉRDIDAS FISCALES ACUMULADAS (Art. 147 ET) ──
      // Compensables contra la utilidad del ejercicio. Sin límite temporal ni de monto
      // (Ley 1819/2016 + Ley 2010/2019 eliminaron el límite de 12 años).
      const perdidasAcumuladas = Math.max(0, Number(ow.perdidasFiscalesAcumuladas) || 0);
      const perdidasAplicadas = Math.min(perdidasAcumuladas, baseGravable);
      baseGravable = Math.max(0, baseGravable - perdidasAplicadas);
      // Recalcular impBruto con base compensada (solo regímenes que usan utilidad)
      if (regimen === "ordinario") impBruto = baseGravable * 0.35;
      else if (regimen === "zona_franca") impBruto = baseGravable * 0.20;
      else if (regimen === "chc") impBruto = baseGravable * 0.35;
      // SIMPLE y exenta no se tocan (SIMPLE es sobre ingresos brutos, exenta es 0)

      // ── DESCUENTOS TRIBUTARIOS (Art. 256-259 ET) ──
      // Inversión CT&I (Art. 158-1), empleo primera vez (Art. 108-5), impuestos exterior
      // (Art. 254), donaciones (Art. 257), otros. Los descuentos NO pueden reducir el
      // impuesto a menos del 75% de su valor bruto (tope del 25%, Art. 259 ET).
      const descuentos = ow.descuentosTributarios || {};
      const descCTI = Math.max(0, Number(descuentos.cti) || 0);
      const descEmpleo = Math.max(0, Number(descuentos.empleo) || 0);
      const descExterior = Math.max(0, Number(descuentos.exterior) || 0);
      const descDonaciones = Math.max(0, Number(descuentos.donaciones) || 0);
      const descOtros = Math.max(0, Number(descuentos.otros) || 0);
      const descuentosSolicitados = descCTI + descEmpleo + descExterior + descDonaciones + descOtros;
      // Tope 25% Art. 259 ET: impuesto tras descuentos ≥ 75% del impuesto bruto (solo ordinario y ZF)
      const topeDescuentos = (regimen === "ordinario" || regimen === "zona_franca" || regimen === "chc")
        ? impBruto * 0.25
        : Infinity;
      const descuentosAplicados = Math.min(descuentosSolicitados, topeDescuentos);

      const impActual = Math.max(0, impBruto - descICA - descuentosAplicados - reteJ);
      totalImp += impActual;

      // impOptimizado = impActual para jurídica (sin ahorro fabricado — estrategias requieren contador)
      const impBrutoOpt = impBruto;
      const impOptimoJ = impActual;
      detalle.push({
        name: ow.name, type: "juridica", ingreso: ingAnual,
        regimen, regimenNota, tarifa,
        perdidasAcumuladas, perdidasAplicadas,
        descuentosSolicitados, descuentosAplicados, descuentosDesglose: { cti: descCTI, empleo: descEmpleo, exterior: descExterior, donaciones: descDonaciones, otros: descOtros },
        gastosRegistrados: gastosDeducJ, intereses: interesesJ, deprec, gastosDeduc: totalDeduc,
        // Campos intermedios del cálculo (Sprint 4B1 — para consumo por OwnerPlan):
        utilidad, descuentoICA: descICA, retefuenteCalc: reteJ,
        gmf50, gastosTotal: gastosTotalJ,
        pctGastos: ingAnual > 0 ? (totalDeduc / ingAnual * 100) : 0,
        baseGravable, impuesto: impActual, impSinOpt: impActual, impOptimizado: impOptimoJ,
        impBruto: impBruto, impOptBruto: impBrutoOpt, reteN: descICA + reteJ,
        ahorroOptimo: impActual - impOptimoJ,
        tasa: ingAnual > 0 ? (impActual / ingAnual * 100) : 0,
        tasaBruta: ingAnual > 0 ? (impBruto / ingAnual * 100) : 0,
        gastosNoRegistrados: totalDeduc < ingAnual * 0.4,
      });
    } else {
      // ═══ PERSONA NATURAL — Cédula General (Ley 2277/2022, ET Arts. 55,206,336,383,387) ═══
      const trm = u.trm || 4200;

      // ── APORTES A SEGURIDAD SOCIAL (valores manuales del owner) ──
      // Cada campo es opcional: si está > 0, sobreescribe el heurístico por default.
      const apt = ow.aportes || {};
      const aPensObl = Number(apt.pensionObligatoriaMensual) || 0;     // salario mensual
      const aPensVol = Number(apt.pensionVoluntariaMensual) || 0;      // Art. 126-1
      const aSaludObl = Number(apt.saludObligatoriaMensual) || 0;      // salario mensual
      const aSSIndep = Number(apt.segSocialIndependienteMensual) || 0; // honorarios mensual total
      const salarioEsBruto = apt.salarioEsBruto !== false;             // default true

      // Clasificar ingresos por subcédula
      const salAnualInput = oIng.filter(i => i.fiscalCode === LAB_SALARIO).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      // Gross-up: si el salario registrado es neto (después de aportes), sumarlos para obtener el bruto gravable
      const salAnual = salarioEsBruto ? salAnualInput : salAnualInput + (aPensObl + aSaludObl) * 12;
      const honAnual = oIng.filter(i => i.fiscalCode === LAB_HONORARIOS_CON_EMPLEADOS || i.fiscalCode === LAB_HONORARIOS_SIN_EMPLEADOS).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      const rentasAnual = oIng.filter(i => i.fiscalCode === NOL_ARRIENDO_INMUEBLE).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      // Sub-tipos de rendimientos con tratamiento diferenciado:
      // - Intereses bancarios/CDT: aplica componente inflacionario Art. 38 ET
      // - Utilidad FIC: aplica componente inflacionario Art. 39 ET
      // - Rendimiento genérico (legacy): aplica componente inflacionario Art. 38 ET
      // - Inversión: NO aplica componente inflacionario (típicamente venta de activos)
      const interesesBancAnual = oIng.filter(i => i.fiscalCode === CAP_INTERESES_BANCARIOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const utilidadFICAnual = oIng.filter(i => i.fiscalCode === CAP_FIC).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const rendimientoGenAnual = oIng.filter(i => i.fiscalCode === CAP_RENDIMIENTO_GENERICO).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const inversionAnual = oIng.filter(i => i.fiscalCode === CAP_VENTA_ACTIVOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const rendAnual = interesesBancAnual + utilidadFICAnual + rendimientoGenAnual + inversionAnual;
      const divAnual = oIng.filter(i => i.fiscalCode === DIV_ART49_GRAVADOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const pensAnual = oIng.filter(i => i.fiscalCode === PEN_JUBILACION).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      // "Otros" = ingresos que no caen en ninguna cédula específica arriba (NOL_OTROS, NOL_NEGOCIO, NOL_HONORARIOS_INDEP, ganancia ocasional, etc).
      // Van a ingNoLaboral como fallback conservador.
      const categorizadas = new Set([
        LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS,
        NOL_ARRIENDO_INMUEBLE, CAP_INTERESES_BANCARIOS, CAP_FIC,
        CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS, DIV_ART49_GRAVADOS, PEN_JUBILACION,
      ]);
      const otrosAnual = oIng.filter(i => !categorizadas.has(i.fiscalCode)).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;

      const ingLaboral = salAnual + honAnual;
      const ingCapital = rendAnual;
      const ingNoLaboral = rentasAnual + otrosAnual;
      const ingAnual = ingLaboral + ingCapital + ingNoLaboral + divAnual + pensAnual;
      if (ingAnual <= 0) return;

      // ── 1. INGRESOS NO CONSTITUTIVOS DE RENTA (Art. 55-56 ET) ──
      // Pensión obligatoria: 4% sobre salario gravable, o manual si el usuario la especificó.
      const noConstSalPens = aPensObl > 0 ? aPensObl * 12 : salAnual * 0.04;
      // Salud obligatoria: 0 por default (backwards-compat con lógica previa); si usuario la especifica, se suma como INCRNGO Art. 56 ET.
      const noConstSalSalud = aSaludObl > 0 ? aSaludObl * 12 : 0;
      const noConstSal = noConstSalPens + noConstSalSalud;
      // Honorarios: si usuario especifica total SS independiente, se usa; si no, 4% sobre IBC (40% de honorarios).
      const ibcIndep = honAnual * 0.40;
      const noConstHon = aSSIndep > 0 ? aSSIndep * 12 : ibcIndep * 0.04;
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
        if (d.fiscalCode === DEU_NAT_VIVIENDA_HABITACIONAL) return s + saldo * tasa;
        return s;
      }, 0);
      const deducVivienda = Math.min(interesesHip, 1200 * UVT);

      const gmfDeducible = ingAnual * 0.004 * 0.50;

      const totalDeducciones = deducDep + deducMedicina + deducVivienda + gmfDeducible;

      const baseExenta = Math.max(0, netoLaboral - totalDeducciones);
      const exenta25 = Math.min(baseExenta * 0.25, 790 * UVT);

      const lim40 = netoLaboral * 0.40;
      // Pensión voluntaria manual (Art. 126-1 ET): si el usuario ya aporta hoy, entra como renta exenta en el escenario ACTUAL.
      // Cap legal: 25% del neto laboral y 2500 UVT.
      const pvManualAnual = aPensVol > 0 ? Math.min(aPensVol * 12, netoLaboral * 0.25, 2500 * UVT) : 0;
      const benefLaboral = Math.min(exenta25 + totalDeducciones + pvManualAnual, lim40);

      const rentaLiqTrabajo = Math.max(0, netoLaboral - benefLaboral);

      // ── 3. RENTAS DE CAPITAL ──
      // COMPONENTE INFLACIONARIO (Art. 38 y 39 ET, Decreto 0771/2025):
      // Una parte de los rendimientos financieros (intereses bancarios/CDT) y
      // distribuciones de FIC NO constituye renta ni ganancia ocasional para
      // personas naturales no obligadas a llevar contabilidad. El porcentaje
      // se actualiza cada año por decreto. Default 50.88% (año gravable 2024).
      //
      // Aplica a: intereses bancarios, CDT, FIC, rendimientos genéricos.
      // NO aplica a: venta de activos (Inversión), dividendos (ya tienen
      // tratamiento especial Art. 242), ni a personas jurídicas.
      //
      // Sin porcentaje automático de costos Art. 335-1 — el usuario registra
      // sus costos reales (custodia, asesorías) como gastos.
      const pctComponenteInflac = ((u.componenteInflacionarioPct != null ? u.componenteInflacionarioPct : 50.88) / 100);
      const rendCompInflacAplicable = interesesBancAnual + utilidadFICAnual + rendimientoGenAnual;
      const componenteInflacExcluido = rendCompInflacAplicable * pctComponenteInflac;
      const rendGravable = rendCompInflacAplicable - componenteInflacExcluido + inversionAnual;
      const rentaLiqCapital = Math.max(0, rendGravable);

      // ── 4. RENTAS NO LABORALES ──
      // Gastos del inmueble arrendado: deducibles al 100% cuando cumplen
      // causalidad, necesidad y proporcionalidad con el ingreso (Art. 107 ET).
      // Predial, administración, mantenimiento, seguros y servicios son gastos
      // típicos que sí cumplen.
      const gastosInmueble = oGas.filter(g => ["Predial", "Mantenimiento", "Vivienda", "Seguros", "Servicios"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const rentaLiqNoLaboral = Math.max(0, ingNoLaboral - gastosInmueble);

      // ── 5. DIVIDENDOS (tarifa especial Art. 242 ET) ──
      const divExentos = Math.min(divAnual, 300 * UVT);
      const divGravados = Math.max(0, divAnual - divExentos);
      const impDiv = divGravados * 0.15;

      // ── 6. RENTA LÍQUIDA CÉDULA GENERAL ──
      const rentaLiqGeneral = rentaLiqTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const imp = calcImpRenta(rentaLiqGeneral / UVT) + impDiv;

      // ── CON OPTIMIZACIÓN: PV + AFC llenan tope 40% ──
      // El espacio disponible se mide sin contar la PV manual (la sugerencia podría reemplazarla o subirla).
      const baseBenefSinPV = Math.min(exenta25 + totalDeducciones, lim40);
      const espacioPV = Math.max(0, lim40 - baseBenefSinPV);
      const pensionVolSugerido = Math.min(espacioPV, netoLaboral * 0.25, 2500 * UVT);
      // Tomar el máximo entre lo que el usuario ya aporta y lo que sugiere la optimización (nunca bajar su aporte actual).
      const pensionVol = Math.min(Math.max(pvManualAnual, pensionVolSugerido), netoLaboral * 0.25, 2500 * UVT);
      const espacioAFC = Math.max(0, lim40 - baseBenefSinPV - pensionVol);
      const afc = Math.min(espacioAFC, netoLaboral * 0.30, 3800 * UVT);
      const rentaOptTrabajo = Math.max(0, netoLaboral - Math.min(exenta25 + totalDeducciones + pensionVol + afc, lim40));
      const rentaOptGeneral = rentaOptTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const impOpt = calcImpRenta(rentaOptGeneral / UVT) + impDiv;

      // ── RETENCIÓN EN LA FUENTE ──
      let reteN = 0;
      oIng.forEach(i => {
        const m = (i.mensual || 0) * (i.moneda === "USD" ? trm : 1) * 12;
        const fc = i.fiscalCode;
        if (fc === LAB_SALARIO) { const mUVT = m / 12 / UVT; reteN += m * (mUVT > 360 ? 0.19 : mUVT > 150 ? 0.10 : mUVT > 95 ? 0.04 : 0); }
        else if (fc === LAB_HONORARIOS_CON_EMPLEADOS || fc === LAB_HONORARIOS_SIN_EMPLEADOS) reteN += m * 0.11;
        else if (fc === NOL_ARRIENDO_INMUEBLE) reteN += m * 0.035;
        else if (fc === CAP_RENDIMIENTO_GENERICO || fc === DIV_ART49_GRAVADOS || fc === CAP_INTERESES_BANCARIOS || fc === CAP_VENTA_ACTIVOS) reteN += m * 0.07;
      });

      // ── RÉGIMEN PARA PERSONA NATURAL ──
      const regimenN = ow.regimen || "ordinario";
      let impActualNat, impOptNat, impBrutoNat, regimenNotaN = "";
      if (regimenN === "simple") {
        // SIMPLE para natural empresario: ~3% sobre ingresos brutos (promedio grupos 1-3)
        // Tarifa real depende de actividad: 1.4% comercio, 3.4% servicios, 8.3% hidrocarburos.
        impBrutoNat = ingAnual * 0.03;
        impActualNat = impBrutoNat; // SIMPLE sustituye retención
        impOptNat = impBrutoNat;    // SIMPLE no admite las deducciones de cédula general
        regimenNotaN = "Régimen Simple (RST) — estimación 3% sobre ingresos brutos (aproximación; tarifa real depende de grupo de actividad: 1,4%–8,3%).";
      } else {
        // Ordinario (Cédula General)
        impBrutoNat = imp;
        impActualNat = Math.max(0, imp - reteN);
        impOptNat = Math.max(0, impOpt - reteN);
        regimenNotaN = "Régimen Ordinario — Cédula General (tabla Art. 241 ET con deducciones).";
      }

      const ahorroNat = impActualNat - impOptNat;
      totalImp += impActualNat;
      detalle.push({
        name: ow.name, type: "natural", ingreso: ingAnual,
        regimen: regimenN, regimenNota: regimenNotaN,
        ingLaboral, ingCapital, ingNoLaboral, divAnual, pensAnual,
        noConst: totalNoConst, neto: netoLaboral,
        // Desglose de aportes (para UI y debugging)
        aportesManuales: (aPensObl + aPensVol + aSaludObl + aSSIndep) > 0,
        aportesDesglose: {
          pensionObligatoriaAnual: noConstSalPens,
          saludObligatoriaAnual: noConstSalSalud,
          ssIndependienteAnual: noConstHon,
          pensionVoluntariaManualAnual: pvManualAnual,
          salarioEsBruto,
          salarioInputAnual: salAnualInput,
          salarioGravableAnual: salAnual,
        },
        exenta25, deducDep, deducMedicina, deducVivienda, gmfDeducible,
        pensionVol, afc, totalDeducciones,
        // Topes legales y espacio disponible (Sprint 4B1 — para consumo por OwnerPlan):
        afcMax: Math.min(netoLaboral * 0.30, 3800 * UVT),
        pvMax: Math.min(netoLaboral * 0.25, 2500 * UVT),
        pctUsado: lim40 > 0 ? (benefLaboral / lim40 * 100) : 0,
        rentaSin: rentaLiqGeneral, rentaCon: rentaOptGeneral,
        retefuenteNat: reteN,
        lim40, benAplic: benefLaboral,
        baseGravable: rentaLiqGeneral,
        // Desglose de rendimientos + componente inflacionario (Art. 38-39 ET)
        interesesBancAnual, utilidadFICAnual, rendimientoGenAnual, inversionAnual,
        componenteInflacExcluido, pctComponenteInflac: pctComponenteInflac * 100,
        rentaLiqCapital,
        // impuesto/impOptimizado = SALDO (después de restar retención). Legacy, usado por el cash flow.
        impuesto: impActualNat,
        impSinOpt: impActualNat, impOptimizado: impOptNat,
        // impBruto/impOptBruto = TOTAL por tabla progresiva o régimen (antes de retención).
        impBruto: impBrutoNat,
        impOptBruto: regimenN === "simple" ? impBrutoNat : impOpt,
        ahorroOptimo: ahorroNat,
        tasa: ingAnual > 0 ? (impActualNat / ingAnual * 100) : 0,
        tasaBruta: ingAnual > 0 ? (impBrutoNat / ingAnual * 100) : 0,
        espacioParaPVyAFC: espacioPV, reteN, impDiv,
      });
    }
  });
  return { total: totalImp, mes: totalImp / 12, detalle, sinClasificar };
};
