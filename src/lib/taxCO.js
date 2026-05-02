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
  // Commit 3 Tarea 3: cesantías y prima como rentas de trabajo (Art. 206 #4 ET)
  LAB_PRESTACIONES_CESANTIAS, LAB_PRESTACIONES_PRIMA,
  CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS,
  NOL_ARRIENDO_INMUEBLE,
  DIV_ART49_GRAVADOS, DIV_INTERSOCIETARIOS,
  PEN_JUBILACION,
  DEU_NAT_VIVIENDA_HABITACIONAL,
  GAS_JUR_NO_DEDUCIBLE,
  // Commit 1.6: aportes tributarios del shape nuevo (Egresos → "Aporte tributario")
  AP_TRIB_PV, AP_TRIB_AFC, AP_TRIB_SALUD_PREPAGADA,
  // Commit honorarios: gastos deducibles de actividad independiente (Art. 107)
  GASTOS_HONORARIOS, GAS_HON_REPRESENTACION, GAS_HON_VEHICULO,
  // Commit B2: seguros (Art. 387 #2 para salud/vida; resto no deducibles natural)
  SEG_SALUD, SEG_VIDA, GAS_INMUEBLE_SEGUROS,
  // Commit 15 Tarea 3: impuesto vehicular (rodamiento) profesional
  // El personal NO necesita import porque cae automaticamente como no-deducible
  IMP_VEHICULAR_PROFESIONAL,
} from "./fiscalCodes.js";
import { TABLA_ART_241, calcImpRenta as calcImpRentaCore } from "./tablaArt241.js";
import { GRUPOS_SIMPLE as SIMPLE_GRUPOS, calcularImpuestoSimple as calcularImpSimple } from "./regimenSimple.js";
import { calcularRetencionOwner } from "./retencionesTax.js";

export const UVT = 52374;

// ─── ART. 206 #4 ET: CESANTÍAS Y INTERESES SOBRE CESANTÍAS EXENTOS ────────
// Las cesantías y sus intereses son RENTA EXENTA con tope variable según el
// salario mensual promedio del último semestre del trabajador:
//   ≤ 350 UVT/mes:    100% exento
//   350-410 UVT/mes:  90% exento
//   410-470 UVT/mes:  80% exento
//   470-530 UVT/mes:  60% exento
//   530-590 UVT/mes:  40% exento
//   590-650 UVT/mes:  20% exento
//   > 650 UVT/mes:    0% exento (no exonerado)
//
// La porción exenta sí entra al cap 40% del Art. 336 #3 (no es excluyente).
//
// @param {number} cesantiasAnual - Total de cesantías + intereses recibidos en el año
// @param {number} salarioMensualPromedio - Salario base mensual promedio del último semestre
// @param {number} uvtValue - Valor del UVT del año aplicable
// @returns {number} Monto exento en COP
export function cesantiasExentasArt206_4(cesantiasAnual, salarioMensualPromedio, uvtValue = UVT) {
  if (!cesantiasAnual || cesantiasAnual <= 0) return 0;
  if (!salarioMensualPromedio || salarioMensualPromedio < 0) return cesantiasAnual; // sin salario base, asumir 100% exento (caso liquidación pura)
  const salarioUVT = salarioMensualPromedio / uvtValue;
  let pctExento;
  if (salarioUVT <= 350) pctExento = 1.00;
  else if (salarioUVT < 410) pctExento = 0.90;
  else if (salarioUVT < 470) pctExento = 0.80;
  else if (salarioUVT < 530) pctExento = 0.60;
  else if (salarioUVT < 590) pctExento = 0.40;
  else if (salarioUVT < 650) pctExento = 0.20;
  else pctExento = 0;
  return Math.round(cesantiasAnual * pctExento);
}

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
  // Filtros: solo items "encendidos" (sim !== false) y NO marcados como
  // excluirDeclaracion=true (estos son items que tributan en otra
  // jurisdicción y el user marcó conscientemente para no procesarlos
  // en el cálculo de renta colombiana).
  const ing = (u.ingresos || []).filter(i => i.sim !== false && !i.excluirDeclaracion);
  const gasRaw = u.gas || {};
  const gas = {};
  Object.entries(gasRaw).forEach(([cat, items]) => {
    const filtered = (items || []).filter(g => g.sim !== false && !g.excluirDeclaracion);
    if (filtered.length > 0) gas[cat] = filtered;
  });
  const deu = (u.deu || []).filter(d => d.sim !== false && !d.excluirDeclaracion);
  let totalImp = 0;
  const detalle = [];
  const sinClasificar = ing.filter(i => !i.owner || i.owner === "").length;

  // ── COMMIT 13 TAREA 3: PRE-CÁLCULO UTILIDAD DISTRIBUIBLE DE JURÍDICAS ──
  // Para automatizar el flujo dividendos jurídica → natural (gap 4 del reporte
  // de análisis comparativo), pre-calculamos cuánta utilidad después de impuesto
  // tiene cada jurídica disponible para distribuir como dividendos a sus socios.
  // Si una persona natural tiene `fiscalProfile.socios = [{ ownerJuridicaId, pct }]`,
  // el motor le inyecta automáticamente dividendos virtuales = utilidadDistribuible × pct/100.
  //
  // Esto es UNIVERSAL (aplica a cualquier socio de SAS/SAS unipersonal/Ltda) y
  // OPCIONAL (si el usuario no define `socios`, el comportamiento es idéntico al
  // legacy: cada owner se calcula aislado).
  const utilidadDistribuiblePorJuridica = {};
  owners.forEach(ow => {
    if (ow.type !== "juridica") return;
    const oIng = ing.filter(i => i.owner === ow.id);
    const oGas = Object.values(gas).flat().filter(g => g.owner === ow.id);
    const oDeu = deu.filter(d => d.owner === ow.id);
    const trm = u.trm || 4200;
    const ingAnualJ = oIng.reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
    const gastosDeducJ = oGas.filter(g => g.fiscalCode !== GAS_JUR_NO_DEDUCIBLE).reduce((s, g) => s + (g.m || 0), 0) * 12;
    const interesesJ = oDeu.reduce((s, d) => { const saldo = d.mt || 0; const tasa = (d.ts || d.tasa || 0) / 100; return s + saldo * tasa; }, 0);
    const gmf50J = ingAnualJ * 0.004 * 0.50;
    const utilidadJ = Math.max(0, ingAnualJ - gastosDeducJ - interesesJ - gmf50J);
    // Tarifa aproximada: 35% ordinario, 20% ZF, 0% exenta — para pre-cálculo basta
    const regimenJ = ow.regimen || "ordinario";
    const tarifaAprox = regimenJ === "exenta" ? 0 : (regimenJ === "zona_franca" ? 0.20 : 0.35);
    const impuestoAprox = utilidadJ * tarifaAprox;
    const utilidadDistribuible = Math.max(0, utilidadJ - impuestoAprox);
    utilidadDistribuiblePorJuridica[ow.id] = utilidadDistribuible;
  });

  owners.forEach(ow => {
    const oIng = ing.filter(i => {
      if (!i.owner || i.owner === "" || i.owner === "na") return false;
      return i.owner === ow.id;
    });
    // Bug #7: también procesar owner si tiene eventos de ganancia ocasional
    // (herencia, venta inmueble, lotería). Alguien que solo recibe herencia y
    // no tiene ingresos recurrentes todavía debe ver su impuesto GO calculado.
    const eventosAno = ow.fiscalProfile?.eventosAno || {};
    const tieneEventosGO = !!(
      (eventosAno.recibioHerencia && Number(eventosAno.herenciaMonto) > 0) ||
      (eventosAno.vendioInmuebleAntiguo && Number(eventosAno.inmuebleValorVenta) > 0) ||
      (eventosAno.ganoLoteria && Number(eventosAno.loteriaMonto) > 0)
    );
    if (oIng.length === 0 && !tieneEventosGO) return;

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

      // ── DEDUCCIONES AVANZADAS jurídica (palancas que un contador aplica) ──
      // Se leen de owner.descuentosTributarios pero son DEDUCCIONES (reducen
      // base gravable), no descuentos (que reducen el impuesto). El usuario las
      // carga en EditarDescuentosTributarios; el motor las aplica acá.
      const _descuentosJ = ow.descuentosTributarios || {};
      // Art. 145 ET: provisión por deterioro de cartera. Deducible al 33% sobre
      // cartera vencida +90d (cap. global 5% del total cartera). El usuario
      // ingresa el monto ya calculado/aprobado por su contador.
      const provisionCartera = Math.max(0, Number(_descuentosJ.provisionCarteraAnual) || 0);
      // Art. 158-1 ET inciso 1: deducción del 175% del valor invertido en CT&I
      // calificada por Minciencias. Como el gasto base ya está en gastosDeducJ
      // (categoría Tecnología/Educación con causalidad), el beneficio adicional
      // es el 75% extra. El descuento del 25% (descuentos.cti) es independiente.
      const inversionCTI = Math.max(0, Number(_descuentosJ.inversionCTIanual) || 0);
      const cti175Adicional = inversionCTI * 0.75;
      // Ley 361/97 Art. 31: deducción del 200% del salario pagado a personas
      // con discapacidad ≥25%. Como el salario base ya está en nómina (gastosDeducJ
      // al 100%), el beneficio adicional es 100% más. Sin tope.
      const salariosDiscapacidad = Math.max(0, Number(_descuentosJ.salariosDiscapacidadAnual) || 0);
      const discapacidadAdicional = salariosDiscapacidad * 1.0;
      // Art. 107 ET: bonificaciones extralegales (no constitutivas de salario)
      // entregadas a empleados. Son deducibles 100% si cumplen causalidad +
      // necesidad + proporcionalidad. NO son salario (no afectan parafiscales),
      // pero sí son gasto deducible. El usuario carga el monto anual NETO de
      // bonificaciones que su empresa paga.
      // Diferencia con sueldos: los sueldos ya están en gastosDeducJ. Esto es
      // ADICIONAL, las bonificaciones que el contribuyente quiere registrar
      // como gasto deducible y NO tiene en su nómina mensual cargada.
      const bonificaciones = Math.max(0, Number(_descuentosJ.bonificacionesExtralegalesAnual) || 0);
      // Art. 158-1 ET inciso 2: deducción adicional del 175% del valor pagado
      // por capacitación laboral certificada por SENA, CFF, o instituciones
      // calificadas. El gasto base (el 100%) ya debería estar en
      // gastosDeducJ (categoría Educación/Capacitación). El beneficio
      // adicional es el 75% extra. NO tope global, sí requiere certificación.
      const capacitacion = Math.max(0, Number(_descuentosJ.capacitacionLaboralAnual) || 0);
      const cap75Adicional = capacitacion * 0.75;
      // Art. 128-141 ET: depreciación de inmuebles propios usados para producir
      // renta (típicamente arrendados por la sociedad). Vida útil fiscal 45 años
      // (Decreto 2235/2017 Art. 137). Solo se deprecia la construcción (no el
      // terreno). Reglas que NO podemos validar desde el motor:
      //   - Si Lagoon es la dueña jurídica del inmueble (no el socio personal)
      //   - Si ya se ha depreciado parcialmente en años anteriores
      //   - Si la base depreciable real es 70% / 75% / 80% del costo
      // Por eso este campo es MANUAL: el usuario carga el monto que su contador
      // calculó. El motor lo aplica como deducción común (35% de impacto).
      const depreciacionInmuebles = Math.max(0, Number(_descuentosJ.depreciacionInmueblesAnual) || 0);

      const deduccionesAvanzadas = provisionCartera + cti175Adicional + discapacidadAdicional + bonificaciones + cap75Adicional + depreciacionInmuebles;
      const totalDeduc = gastosDeducJ + interesesJ + gmf50 + deduccionesAvanzadas;
      const utilidad = Math.max(0, ingAnual - totalDeduc);

      // Sub-tipos de ingresos con tratamiento especial por Art. 48 ET
      const dividIntersocietarios = oIng.filter(i => i.fiscalCode === DIV_INTERSOCIETARIOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? (u.trm || 4200) : 1)), 0) * 12;

      // Retención automática según tipo de ingreso (solo aplica a régimen ordinario/ZF/CHC; SIMPLE sustituye retención)
      // Retención fuente jurídica: ahora vía módulo central src/lib/retencionesTax.js
      // (refactor sesión 28-abr-2026 noche). Antes: tasas hardcoded inline. Ahora:
      // - Tabla central con override por ingreso (ing.retencionConfig)
      // - Override global por owner (descuentosTributarios.retencionesEsperadasAnual)
      // - Soporte para "no aplica" cuando inquilino no es agente retenedor
      // - Transparencia: el motor expone detalle por ingreso para UI
      let reteJ = 0;
      let retencionDesgloseJ = null;
      if (regimen !== "simple" && regimen !== "exenta") {
        retencionDesgloseJ = calcularRetencionOwner(oIng, ow, u.trm || 4200);
        reteJ = retencionDesgloseJ.total;
      }
      // Descuento 50% ICA (solo ordinario y zona franca)
      // Categoría "Impuesto" cubre predial, ICA, rodamiento, etc. "Predial" es
      // legacy — items viejos que aún no se migraron a "Impuesto". El motor
      // procesa ambos hasta que toda la base esté migrada.
      const icaGas = oGas.filter(g => g.cat === "Impuesto" || g.cat === "Predial").reduce((s, g) => s + (g.m || 0), 0) * 12 * 0.30;
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
        // FIX abr 2026: jurídicas Simple ahora usan tramos reales por grupo
        // (Art. 908 ET via regimenSimple.js), igual que naturales (línea 502).
        // Antes usaba 5% fijo ignorando ow.simpleGrupo.
        const simpleGrupo = ow.simpleGrupo;
        if (simpleGrupo && SIMPLE_GRUPOS[simpleGrupo]) {
          const { impuesto: impSimple, tarifaEfectiva } = calcularImpSimple(ingAnual, simpleGrupo, UVT);
          tarifa = tarifaEfectiva;
          baseGravable = ingAnual;
          impBruto = impSimple;
          regimenNota = `Régimen Simple (RST) — grupo "${SIMPLE_GRUPOS[simpleGrupo].label}", tarifa efectiva ${(tarifaEfectiva * 100).toFixed(2)}% (tramos marginales Art. 908 ET).`;
        } else {
          // Fallback conservador si no hay grupo configurado
          tarifa = 0.05;
          baseGravable = ingAnual;
          impBruto = ingAnual * 0.05;
          regimenNota = "Régimen Simple (RST) — estimación 5% conservadora. Configurá el grupo de actividad en el wizard para ver tarifa real.";
        }
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
      // (Art. 254), donaciones (Art. 257), IVA activos productivos (Art. 258-2),
      // otros. Los descuentos NO pueden reducir el impuesto a menos del 75% de su
      // valor bruto (tope del 25%, Art. 259 ET).
      const descuentos = ow.descuentosTributarios || {};
      const descCTI = Math.max(0, Number(descuentos.cti) || 0);
      const descEmpleo = Math.max(0, Number(descuentos.empleo) || 0);
      const descExterior = Math.max(0, Number(descuentos.exterior) || 0);
      const descDonaciones = Math.max(0, Number(descuentos.donaciones) || 0);
      // Art. 258-2 ET: el IVA pagado en la adquisición o importación de
      // bienes de capital (maquinaria, equipo) usados en la actividad
      // productiva se puede tomar 100% como DESCUENTO del impuesto sobre
      // la renta del año en que se realiza la inversión. Aplica también a
      // construcciones e instalaciones para la producción primaria.
      // NO es deducción de la base; ES descuento del impuesto bruto.
      // Sujeto al tope global del 25% del Art. 259 ET (junto con los otros).
      const descIVAActivos = Math.max(0, Number(descuentos.ivaActivosProductivosAnual) || 0);
      const descOtros = Math.max(0, Number(descuentos.otros) || 0);
      const descuentosSolicitados = descCTI + descEmpleo + descExterior + descDonaciones + descIVAActivos + descOtros;
      // Tope 25% Art. 259 ET: impuesto tras descuentos ≥ 75% del impuesto bruto (solo ordinario y ZF)
      const topeDescuentos = (regimen === "ordinario" || regimen === "zona_franca" || regimen === "chc")
        ? impBruto * 0.25
        : Infinity;
      const descuentosAplicados = Math.min(descuentosSolicitados, topeDescuentos);

      const impActual = Math.max(0, impBruto - descICA - descuentosAplicados - reteJ);
      totalImp += impActual;

      // FIX abr 2026: lógica honesta de optimización para jurídicas.
      //
      // El motor NO inventa descuentos. Solo aplica los que el usuario declaró
      // en owner.fiscalProfile.descuentosTributarios (CT&I, donaciones, empleo,
      // exterior). Si el usuario no cargó ninguno → ahorro = 0 (honesto).
      // Si cargó X → ahorro = X (sujeto a tope 25% Art. 259 ET).
      //
      // Definición de campos:
      // - impBruto:    impuesto bruto antes de cualquier descuento ni retención
      // - impBrutoSinOpt: impBruto - descICA (incluye solo descuento ICA permanente)
      // - impBrutoOpt: impBruto - descICA - descuentosOpcionales (con descuentos del usuario)
      // - impuesto/impActual: impBrutoOpt - reteJ (saldo después de retención)
      //
      // Esto hace que:
      //   "Sin optimizar" = impBrutoSinOpt
      //   "Con optimizar" = impBrutoOpt
      //   Diferencia = descuentosAplicados (cargados por el usuario)
      const impBrutoSinOpt = Math.max(0, impBruto - descICA);
      const impBrutoOpt = Math.max(0, impBruto - descICA - descuentosAplicados);
      const impOptimoJ = impActual;
      detalle.push({
        name: ow.name, type: "juridica", ingreso: ingAnual,
        regimen, regimenNota, tarifa,
        perdidasAcumuladas, perdidasAplicadas,
        descuentosSolicitados, descuentosAplicados, descuentosDesglose: { cti: descCTI, empleo: descEmpleo, exterior: descExterior, donaciones: descDonaciones, ivaActivos: descIVAActivos, otros: descOtros },
        gastosRegistrados: gastosDeducJ, intereses: interesesJ, deprec, gastosDeduc: totalDeduc,
        // Deducciones avanzadas (Art. 145 + Art. 158-1 inciso 1 + Ley 361/97 +
        // Art. 107 + Art. 158-1 inciso 2) — exposición explícita para el
        // desglose en SimuladorTributario y la documentación del cálculo.
        // Permite mostrar al usuario cuánto está deduciendo por cada palanca.
        deduccionesAvanzadas, provisionCartera, inversionCTI, cti175Adicional,
        salariosDiscapacidad, discapacidadAdicional,
        bonificaciones, capacitacion, cap75Adicional,
        depreciacionInmuebles,
        // Campos intermedios del cálculo (Sprint 4B1 — para consumo por OwnerPlan):
        utilidad, descuentoICA: descICA, retefuenteCalc: reteJ,
        // Sesión 28-abr-2026: detalle de retención por ingreso para mostrar
        // en UI con transparencia. Permite que el user vea exactamente cómo
        // se calculó cada retención y override si es necesario.
        retencionDesglose: retencionDesgloseJ,
        gmf50, gastosTotal: gastosTotalJ,
        pctGastos: ingAnual > 0 ? (totalDeduc / ingAnual * 100) : 0,
        baseGravable, impuesto: impActual, impSinOpt: impActual, impOptimizado: impOptimoJ,
        // FIX abr 2026: impBruto ahora descuenta ICA (descuento permanente legal).
        // impOptBruto adicionalmente descuenta los descuentos opcionales cargados.
        // Diferencia = descuentos opcionales = ahorro real declarado por el usuario.
        impBruto: impBrutoSinOpt, impOptBruto: impBrutoOpt, reteN: descICA + reteJ,
        ahorroOptimo: impActual - impOptimoJ,
        tasa: ingAnual > 0 ? (impActual / ingAnual * 100) : 0,
        tasaBruta: ingAnual > 0 ? (impBruto / ingAnual * 100) : 0,
        gastosNoRegistrados: totalDeduc < ingAnual * 0.4,
      });
    } else {
      // ═══ PERSONA NATURAL — Cédula General (Ley 2277/2022, ET Arts. 55,206,336,383,387) ═══
      const trm = u.trm || 4200;

      // ── APORTES A SEGURIDAD SOCIAL ──
      // Commit 1.7: aportes obligatorios se leen en shape nuevo desde `ing.aportes`
      // (prefilled al crear/editar salario, 4%+4% auto). Fallback al shape viejo
      // `ow.aportes.pensionObligatoriaMensual/saludObligatoriaMensual` para
      // retro-compat con datos anteriores a 1.5 y para escenarios del snapshot.
      const apt = ow.aportes || {};
      const aSSIndep = Number(apt.segSocialIndependienteMensual) || 0; // honorarios mensual total (sin refactor — fuera de scope sprint)
      const salarioEsBruto = apt.salarioEsBruto !== false;             // default true

      // Sumar aportes obligatorios de los salarios del owner (shape nuevo — 1.5)
      const salariosDelOwner = oIng.filter(i => i.fiscalCode === LAB_SALARIO);
      const aPensOblNuevoMes = salariosDelOwner.reduce((s, i) => s + (Number(i.aportes?.pension) || 0), 0);
      const aSaludOblNuevoMes = salariosDelOwner.reduce((s, i) => s + (Number(i.aportes?.salud) || 0), 0);
      // Fallback al shape viejo si el nuevo está vacío (0). Si cualquiera >0 en shape nuevo, gana el shape nuevo.
      const aPensObl  = aPensOblNuevoMes  > 0 ? aPensOblNuevoMes  : (Number(apt.pensionObligatoriaMensual) || 0);
      const aSaludObl = aSaludOblNuevoMes > 0 ? aSaludOblNuevoMes : (Number(apt.saludObligatoriaMensual)   || 0);
      // Commit 1.7: pensión voluntaria ya NO se lee de ow.aportes; vive exclusivamente
      // como egreso con fiscalCode AP_TRIB_PV (shape nuevo). La migración silenciosa
      // (sanitize en App.jsx) convierte datos viejos antes de llegar acá.

      // Clasificar ingresos por subcédula
      const salAnualInput = oIng.filter(i => i.fiscalCode === LAB_SALARIO).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      // Gross-up: si el salario registrado es neto (después de aportes), sumarlos para obtener el bruto gravable
      const salAnual = salarioEsBruto ? salAnualInput : salAnualInput + (aPensObl + aSaludObl) * 12;
      // Commit 3 Tarea 3 (Art. 206 #4 ET): cesantías y prima son rentas de TRABAJO,
      // no rentas no laborales. Antes el motor las dejaba caer en otrosAnual (bug).
      // Las cesantías además tienen exenta proporcional al salario mensual promedio.
      const cesantiasAnual = oIng.filter(i => i.fiscalCode === LAB_PRESTACIONES_CESANTIAS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      const primaAnual = oIng.filter(i => i.fiscalCode === LAB_PRESTACIONES_PRIMA).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
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
      const divAnualManual = oIng.filter(i => i.fiscalCode === DIV_ART49_GRAVADOS).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
      // Commit 13 Tarea 3: dividendos automáticos derivados de jurídicas en las que
      // el natural es socio (Gap 4 del reporte). Si fiscalProfile.socios está definido,
      // sumamos % de la utilidad distribuible de cada jurídica vinculada como
      // dividendos virtuales gravados Art. 242 ET. Esto cierra el gap donde un
      // fundador SAS no veía reflejados sus dividendos automáticamente.
      const sociosDeclarados = ow.fiscalProfile?.socios || [];
      let divAnualAutomatico = 0;
      const dividendosAutoDesglose = [];
      sociosDeclarados.forEach(s => {
        const juridicaId = s.ownerJuridicaId;
        const pct = Number(s.porcentaje) || 0;
        if (!juridicaId || pct <= 0) return;
        const utilDistr = utilidadDistribuiblePorJuridica[juridicaId] || 0;
        const dividendoEstimado = utilDistr * (pct / 100);
        if (dividendoEstimado > 0) {
          divAnualAutomatico += dividendoEstimado;
          // Buscar nombre de la jurídica para trazabilidad en det
          const juridicaOwner = owners.find(o => o.id === juridicaId);
          dividendosAutoDesglose.push({
            juridicaId,
            juridicaName: juridicaOwner?.name || juridicaId,
            porcentaje: pct,
            utilidadDistribuible: utilDistr,
            dividendoEstimado,
          });
        }
      });
      const divAnual = divAnualManual + divAnualAutomatico;
      const pensAnual = oIng.filter(i => i.fiscalCode === PEN_JUBILACION).reduce((s, i) => s + (i.mensual || 0), 0) * 12;
      // "Otros" = ingresos que no caen en ninguna cédula específica arriba (NOL_OTROS, NOL_NEGOCIO, NOL_HONORARIOS_INDEP, ganancia ocasional, etc).
      // Van a ingNoLaboral como fallback conservador.
      const categorizadas = new Set([
        LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS,
        // Commit 3 Tarea 3: prestaciones laborales son cédula laboral, no NOL_OTROS
        LAB_PRESTACIONES_CESANTIAS, LAB_PRESTACIONES_PRIMA,
        NOL_ARRIENDO_INMUEBLE, CAP_INTERESES_BANCARIOS, CAP_FIC,
        CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS, DIV_ART49_GRAVADOS, PEN_JUBILACION,
      ]);
      const otrosAnual = oIng.filter(i => !categorizadas.has(i.fiscalCode)).reduce((s, i) => s + ((i.mensual || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;

      const ingLaboral = salAnual + honAnual + cesantiasAnual + primaAnual;
      const ingCapital = rendAnual;
      const ingNoLaboral = rentasAnual + otrosAnual;
      const ingAnual = ingLaboral + ingCapital + ingNoLaboral + divAnual + pensAnual;
      // Bug #7: si el owner tiene solo eventos de ganancia ocasional (sin ingresos
      // ordinarios), procesarlo en rama especial — calcular solo impGO y empujar
      // un detalle minimalista. No queremos saltar al return porque entonces este
      // owner no aparece en el listado y su GO nunca se calcula.
      if (ingAnual <= 0 && tieneEventosGO) {
        const fpSoloGO = ow.fiscalProfile || {};
        const evSoloGO = fpSoloGO.eventosAno || {};
        let impGOSolo = 0;
        const desgloseGOSolo = [];
        if (evSoloGO.recibioHerencia && Number(evSoloGO.herenciaMonto) > 0) {
          const monto = Number(evSoloGO.herenciaMonto) || 0;
          const exento = 3490 * UVT;
          const gravable = Math.max(0, monto - exento);
          const imp = gravable * 0.15;
          impGOSolo += imp;
          desgloseGOSolo.push({ tipo: "herencia", monto, exento: Math.min(monto, exento), gravable, tarifa: 0.15, impuesto: imp, baseLegal: "Arts. 302, 307, 313 ET" });
        }
        if (evSoloGO.vendioInmuebleAntiguo) {
          const valorVenta = Number(evSoloGO.inmuebleValorVenta) || 0;
          const costoFiscal = Number(evSoloGO.inmuebleCostoFiscal) || 0;
          const utilidad = Math.max(0, valorVenta - costoFiscal);
          const imp = utilidad * 0.15;
          impGOSolo += imp;
          desgloseGOSolo.push({ tipo: "venta_inmueble", valorVenta, costoFiscal, utilidad, tarifa: 0.15, impuesto: imp, baseLegal: "Arts. 300, 313 ET" });
        }
        if (evSoloGO.ganoLoteria && Number(evSoloGO.loteriaMonto) > 0) {
          const monto = Number(evSoloGO.loteriaMonto) || 0;
          const imp = monto * 0.20;
          impGOSolo += imp;
          desgloseGOSolo.push({ tipo: "loteria", monto, tarifa: 0.20, impuesto: imp, baseLegal: "Art. 317 ET" });
        }
        totalImp += impGOSolo;
        detalle.push({
          name: ow.name, type: "natural",
          ingreso: 0, regimen: ow.regimen || "ordinario",
          regimenNota: "Solo ganancias ocasionales — sin ingresos ordinarios en el año.",
          ingLaboral: 0, ingCapital: 0, ingNoLaboral: 0, divAnual: 0, pensAnual: 0,
          noConst: 0, neto: 0,
          impuesto: impGOSolo, impSinOpt: impGOSolo, impOptimizado: impGOSolo,
          impBruto: impGOSolo, impOptBruto: impGOSolo, ahorroOptimo: 0,
          tasa: 0, tasaBruta: 0,
          impGO: impGOSolo, desgloseGO: desgloseGOSolo,
          baseGravable: 0, rentaSin: 0, rentaCon: 0,
        });
        return;
      }
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

      // ── 1.5 GASTOS DEDUCIBLES DE HONORARIOS (Art. 107 ET) ──
      // Para personas naturales con honorarios. Aplica reglas profesionales:
      //   - Causalidad, necesidad y proporcionalidad (Art. 107 ET)
      //   - Vehículo (GAS_HON_VEHICULO): aplicado al 50% conservador (uso mixto)
      //   - Representación (GAS_HON_REPRESENTACION): tope 10% del honorario bruto (Art. 107-1)
      //   - Resto: 100% si está marcado con causalidad
      //
      // Si el owner no tiene honorarios o no marcó gastos de actividad, este
      // bloque no afecta el cálculo (gastosHonorariosDed = 0).
      let gastosHonorariosDed = 0;
      const gastosHonorariosDesglose = {
        segSocial: 0, nominaTerceros: 0, oficina: 0, serviciosOficina: 0,
        internetTel: 0, materiales: 0, vehiculoBruto: 0, vehiculoAplicado: 0,
        viajes: 0, representacionBruto: 0, representacionAplicado: 0, representacionTope: 0,
        capacitacion: 0, otros: 0,
        // Commit B1: trazabilidad de vehículos (Art. 107 ET — solo uno cumple causalidad)
        vehiculosTotalRegistrados: 0, vehiculosIgnorados: 0, vehiculoIgnoradoMonto: 0,
      };
      let alertaHonorarios = null; // null | "amarilla" | "roja"
      if (honAnual > 0) {
        const tope10Repr = honAnual * 0.10;
        // Commit B1: pre-pass para vehículos. Art. 107 ET exige causalidad: si el
        // contribuyente tiene varios vehículos pero solo usa UNO para su actividad
        // independiente, solo ese cumple causalidad. Aplicamos criterio de máximo
        // aprovechamiento legal: deducir el de mayor monto.
        // Commit 15 Tarea 3: el impuesto vehicular profesional sigue la misma
        // logica que el GAS_HON_VEHICULO (Art. 107, 50% conservador, max 1).
        // Lo unimos en el mismo flujo para coherencia.
        const vehiculosTodos = oGas.filter(g => g.fiscalCode === GAS_HON_VEHICULO || g.fiscalCode === IMP_VEHICULAR_PROFESIONAL);
        const vehiculoUnico = vehiculosTodos.length > 0
          ? vehiculosTodos.reduce((max, g) => ((g.m || 0) > (max.m || 0) ? g : max))
          : null;
        gastosHonorariosDesglose.vehiculosTotalRegistrados = vehiculosTodos.length;
        gastosHonorariosDesglose.vehiculosIgnorados = Math.max(0, vehiculosTodos.length - 1);
        gastosHonorariosDesglose.vehiculoIgnoradoMonto = vehiculosTodos
          .filter(g => g !== vehiculoUnico)
          .reduce((s, g) => s + (g.m || 0), 0) * 12;
        for (const g of oGas) {
          // Commit 15: incluir IMP_VEHICULAR_PROFESIONAL en el filter de honorarios
          const esGastoHonorarios = GASTOS_HONORARIOS.includes(g.fiscalCode) || g.fiscalCode === IMP_VEHICULAR_PROFESIONAL;
          if (!esGastoHonorarios) continue;
          const monto = (g.m || 0) * 12;
          if (g.fiscalCode === GAS_HON_VEHICULO || g.fiscalCode === IMP_VEHICULAR_PROFESIONAL) {
            // Commit B1: solo el vehículo de mayor monto deduce (Art. 107 ET).
            // Los demás se cuentan en vehiculosIgnorados para informar al usuario.
            if (g === vehiculoUnico) {
              gastosHonorariosDesglose.vehiculoBruto += monto;
              gastosHonorariosDesglose.vehiculoAplicado += monto * 0.50;
            }
            // Si no es el único: NO suma al desglose deducible
          } else if (g.fiscalCode === GAS_HON_REPRESENTACION) {
            gastosHonorariosDesglose.representacionBruto += monto;
          } else {
            // 100% deducible si está marcado con causalidad
            const key = ({
              GAS_HON_SEG_SOCIAL: "segSocial",
              GAS_HON_NOMINA_TERCEROS: "nominaTerceros",
              GAS_HON_OFICINA: "oficina",
              GAS_HON_SERVICIOS_OFICINA: "serviciosOficina",
              GAS_HON_INTERNET_TELEFONIA: "internetTel",
              GAS_HON_MATERIALES: "materiales",
              GAS_HON_VIAJES: "viajes",
              GAS_HON_CAPACITACION: "capacitacion",
              GAS_HON_OTROS: "otros",
            })[g.fiscalCode] || "otros";
            gastosHonorariosDesglose[key] += monto;
          }
        }
        // Aplicar tope 10% a representación (Art. 107-1)
        gastosHonorariosDesglose.representacionTope = tope10Repr;
        gastosHonorariosDesglose.representacionAplicado = Math.min(
          gastosHonorariosDesglose.representacionBruto,
          tope10Repr
        );
        // Total deducible
        gastosHonorariosDed =
          gastosHonorariosDesglose.segSocial +
          gastosHonorariosDesglose.nominaTerceros +
          gastosHonorariosDesglose.oficina +
          gastosHonorariosDesglose.serviciosOficina +
          gastosHonorariosDesglose.internetTel +
          gastosHonorariosDesglose.materiales +
          gastosHonorariosDesglose.vehiculoAplicado +
          gastosHonorariosDesglose.viajes +
          gastosHonorariosDesglose.representacionAplicado +
          gastosHonorariosDesglose.capacitacion +
          gastosHonorariosDesglose.otros;
        // Salvaguarda fiscal: alertas si la proporción es estadísticamente sospechosa
        const ratioGastos = gastosHonorariosDed / honAnual;
        if (ratioGastos > 0.80) alertaHonorarios = "roja";
        else if (ratioGastos > 0.60) alertaHonorarios = "amarilla";
      }

      // ── 2. RENTAS DE TRABAJO (salario + honorarios netos de gastos de actividad) ──
      const netoLaboral = ingLaboral - totalNoConst - gastosHonorariosDed;

      // Deducciones solo para rentas de trabajo (Art. 387 ET):
      // Fase 3 (Commit 8.4): si el owner configuró fiscalProfile.dependientes.cantidad,
      // ese es la fuente de verdad. Fallback legacy: inferir desde gastoEduc > 500K
      // para NO romper usuarios que nunca configuraron el switch.
      const gastoEduc = oGas.filter(g => g.cat === "Educación").reduce((s, g) => s + (g.m || 0), 0);
      const fp = ow.fiscalProfile || {};
      const dependientesDeclarados = Number(fp.dependientes?.cantidad) || 0;
      const tieneDepExplicito = dependientesDeclarados > 0;
      const tieneDepLegacy = !fp.dependientes && gastoEduc > 500000; // solo si no configuró fiscalProfile
      const tieneDep = tieneDepExplicito || tieneDepLegacy;
      const conDiscapacidad = !!fp.dependientes?.conDiscapacidad;
      // Tope base: 10% del ingreso laboral, 384 UVT/año. Con discapacidad se amplía
      // (Art. 387 parr 2: dependientes con discapacidad tienen tratamiento expandido).
      const topeDepUVT = conDiscapacidad ? 768 : 384;
      const deducDep = tieneDep ? Math.min(ingLaboral * 0.10, topeDepUVT * UVT) : 0;

      const gastoSaludTradicional = oGas.filter(g => g.cat === "Salud").reduce((s, g) => s + (g.m || 0), 0) * 12;
      // Bridge Commit 1.6: leer salud prepagada del shape nuevo (Egresos con categoría
      // "Aporte tributario" y fiscalCode AP_TRIB_SALUD_PREPAGADA). Entra al mismo tope
      // 16 UVT/mes (Art. 387 #2 ET). En 1.7 la categoría "Salud" se usará sólo para
      // gastos médicos genéricos (consultas, medicinas) y la salud prepagada vivirá
      // exclusivamente en "Aporte tributario".
      const gastoSaludPrepagadaNueva = oGas.filter(g => g.fiscalCode === AP_TRIB_SALUD_PREPAGADA).reduce((s, g) => s + (g.m || 0), 0) * 12;
      // Commit B2: seguros de salud y vida también entran al mismo tope (Art. 387 #2 ET).
      // Sumamos SEG_SALUD y SEG_VIDA al gastoSalud antes de aplicar el tope conjunto.
      const gastoSegSaludVida = oGas.filter(g => g.fiscalCode === SEG_SALUD || g.fiscalCode === SEG_VIDA).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const gastoSalud = gastoSaludTradicional + gastoSaludPrepagadaNueva + gastoSegSaludVida;
      const deducMedicina = Math.min(gastoSalud, 16 * UVT * 12);

      const interesesHipBruto = oDeu.reduce((s, d) => {
        const saldo = d.mt || 0; const tasa = (d.ts || d.tasa || 0) / 100;
        if (d.fiscalCode === DEU_NAT_VIVIENDA_HABITACIONAL) return s + saldo * tasa;
        return s;
      }, 0);
      // Commit B abr 2026: vivienda proporcional a responsables fiscales.
      // Si la deuda es compartida (ej. pareja al 50%), solo deduce el % proporcional.
      // Default 100% si no se especificó. Rango válido 1-100.
      const viviendaPct = Math.max(0, Math.min(100, Number(fp.viviendaResponsablesPct ?? 100))) / 100;
      const interesesHip = interesesHipBruto * viviendaPct;
      const deducVivienda = Math.min(interesesHip, 1200 * UVT);

      const gmfDeducible = ingAnual * 0.004 * 0.50;

      const totalDeducciones = deducDep + deducMedicina + deducVivienda + gmfDeducible;

      const baseExenta = Math.max(0, netoLaboral - totalDeducciones);
      const exenta25 = Math.min(baseExenta * 0.25, 790 * UVT);

      const lim40 = netoLaboral * 0.40;
      // Pensión voluntaria + AFC (Art. 126-1 y 126-4 ET): renta exenta bajo el cap
      // compartido de 2500 UVT / 25% neto laboral.
      //
      // Commit 1.7: después de la migración silenciosa, PV y AFC viven sólo en
      // Egresos (fiscalCode AP_TRIB_PV y AP_TRIB_AFC). El lector viejo
      // ow.aportes.pensionVoluntariaMensual ya no se usa acá.
      const pvEgresoAnual  = oGas.filter(g => g.fiscalCode === AP_TRIB_PV).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const afcEgresoAnual = oGas.filter(g => g.fiscalCode === AP_TRIB_AFC).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const pvManualBruto  = pvEgresoAnual + afcEgresoAnual;
      const pvManualAnual  = pvManualBruto > 0 ? Math.min(pvManualBruto, netoLaboral * 0.25, 2500 * UVT) : 0;
      // Commit 3 Tarea 3: cesantías exentas Art. 206 #4. Calcular la porción exenta
      // en función del salario mensual promedio (proxy: salAnual/12 si hay salario,
      // si solo hay cesantías sueltas, asumir 100% exento como caso de liquidación).
      const salarioMensualProxy = salAnual > 0 ? salAnual / 12 : 0;
      const cesantiasExentas = cesantiasExentasArt206_4(cesantiasAnual, salarioMensualProxy, UVT);
      // El cap 40% del Art. 336 #3 incluye TODAS las rentas exentas y deducciones
      // imputables, incluso las del Art. 206 #4. Por eso sumamos cesantiasExentas
      // dentro del Math.min(..., lim40).
      const benefLaboral = Math.min(exenta25 + totalDeducciones + pvManualAnual + cesantiasExentas, lim40);

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
      // Fase 3: el componente inflacionario (Arts. 38-39 ET) NO aplica si el contribuyente
      // está obligado a llevar contabilidad. Por default no lo está → se aplica. Se skip
      // sólo cuando el switch explícito está activo.
      const obligadoContabilidad = !!(ow.fiscalProfile?.obligadoContabilidad);
      const componenteInflacExcluido = obligadoContabilidad ? 0 : (rendCompInflacAplicable * pctComponenteInflac);
      const rendGravable = rendCompInflacAplicable - componenteInflacExcluido + inversionAnual;
      const rentaLiqCapital = Math.max(0, rendGravable);

      // ── 4. RENTAS NO LABORALES ──
      // Gastos del inmueble arrendado: deducibles al 100% cuando cumplen
      // causalidad, necesidad y proporcionalidad con el ingreso (Art. 107 ET).
      // Predial, administración, mantenimiento y servicios son gastos típicos
      // que sí cumplen.
      // Commit B2: los seguros se manejan por fiscalCode específico para no
      // contaminar este bloque. Solo GAS_INMUEBLE_SEGUROS cuenta acá. Items
      // legacy con cat="Seguros" sin fiscalCode son tratados como SEG_GENERICO
      // (no deducibles, criterio conservador) y NO entran al gastosInmueble.
      const gastosInmuebleBase = oGas.filter(g => ["Predial", "Impuesto", "Mantenimiento", "Vivienda", "Servicios"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0) * 12;
      const gastosInmuebleSeguros = oGas.filter(g => g.fiscalCode === GAS_INMUEBLE_SEGUROS).reduce((s, g) => s + (g.m || 0), 0) * 12;
      // Sesión 1-may-2026: feedback Santiago. Permitir cargar gastos
      // de arriendo de forma agregada (sin desglosar en Egresos) desde
      // el Plan de Optimización. Cubre depreciación, intereses bancarios,
      // comisiones inmobiliarias, mantenimiento, predial, etc.
      const gastosArriendoManual = Number(ow.fiscalProfile?.gastosArriendoAnuales) || 0;
      const gastosInmueble = gastosInmuebleBase + gastosInmuebleSeguros + gastosArriendoManual;
      const rentaLiqNoLaboral = Math.max(0, ingNoLaboral - gastosInmueble);

      // ── 5. DIVIDENDOS (tarifa especial Art. 242 ET) ──
      // Sesión 1-may-2026: feedback Santiago. Permitir cargar el monto de
      // dividendos NO GRAVADOS (Art. 49 ET): los que vienen de utilidades
      // que ya pagaron impuesto en cabeza de la sociedad. Esos NO se
      // gravan otra vez en el accionista. Si el user marca que parte de
      // sus dividendos son no gravados, los restamos del divAnual antes
      // de calcular la base.
      const divNoGravadosArt49 = Number(ow.fiscalProfile?.dividendosNoGravados) || 0;
      const divAnualGravable = Math.max(0, divAnual - divNoGravadosArt49);
      const divExentos = Math.min(divAnualGravable, 300 * UVT);
      const divGravados = Math.max(0, divAnualGravable - divExentos);
      const impDiv = divGravados * 0.15;

      // ── 5.5. PENSIONES (Bug #8, Art. 337 ET) ──
      // La mesada pensional tiene exencion de 1.000 UVT/mes = 12.000 UVT/año.
      // Lo que excede tributa segun la tabla progresiva del Art. 241 (igual
      // que la cedula laboral). Antes este monto no se gravaba (rentaLiqGeneral
      // no incluia pensiones), entonces alguien con $20M/mes de mesada pensional
      // y $0 de otros ingresos pagaba impuesto $0 — sub-estimacion grave.
      const pensExenta = Math.min(pensAnual, 12000 * UVT);
      const pensGravable = Math.max(0, pensAnual - pensExenta);
      const impPension = calcImpRenta(pensGravable / UVT);

      // ── 6. RENTA LÍQUIDA CÉDULA GENERAL ──
      const rentaLiqGeneral = rentaLiqTrabajo + rentaLiqCapital + rentaLiqNoLaboral;
      const imp = calcImpRenta(rentaLiqGeneral / UVT) + impDiv + impPension;

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
      const impOpt = calcImpRenta(rentaOptGeneral / UVT) + impDiv + impPension;

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
      // Sesión 1-may-2026: feedback Santiago. Si el user cargó la retención
      // REAL del año (lo que sus pagadores efectivamente le retuvieron, según
      // certificados), ese valor reemplaza el cálculo automático. Útil cuando
      // los retenedores aplican porcentajes distintos al estándar (autoreten-
      // ciones, retenciones especiales por arrendamientos comerciales, etc.).
      const reteManual = Number(ow.fiscalProfile?.retencionesManualesAnio);
      if (reteManual > 0 && !Number.isNaN(reteManual)) {
        reteN = reteManual;
      }

      // ── RÉGIMEN PARA PERSONA NATURAL ──
      const regimenN = ow.regimen || "ordinario";
      let impActualNat, impOptNat, impBrutoNat, regimenNotaN = "";
      if (regimenN === "simple") {
        // Fase 3 (Bug #10): usar tarifas reales por grupo (Arts. 908 ET) via
        // regimenSimple.js. Si el owner tiene simpleGrupo configurado, calcula
        // con tramos marginales. Si no, fallback conservador 13.7% (el más alto)
        // para no recomendar en falso un cambio a SIMPLE que podría salir peor.
        const simpleGrupo = ow.simpleGrupo;
        if (simpleGrupo && SIMPLE_GRUPOS[simpleGrupo]) {
          const { impuesto: impSimple, tarifaEfectiva } = calcularImpSimple(ingAnual, simpleGrupo, UVT);
          impBrutoNat = impSimple;
          regimenNotaN = `Régimen Simple (RST) — grupo "${SIMPLE_GRUPOS[simpleGrupo].label}", tarifa efectiva ${(tarifaEfectiva * 100).toFixed(2)}% (tramos marginales Art. 908 ET).`;
        } else {
          impBrutoNat = ingAnual * 0.137; // fallback conservador
          regimenNotaN = "Régimen Simple (RST) — estimación conservadora 13,7% (configurá el grupo de actividad en el perfil para tarifa real).";
        }
        impActualNat = impBrutoNat;
        impOptNat = impBrutoNat;
      } else {
        // Ordinario (Cédula General)
        impBrutoNat = imp;
        impActualNat = Math.max(0, imp - reteN);
        impOptNat = Math.max(0, impOpt - reteN);
        regimenNotaN = "Régimen Ordinario — Cédula General (tabla Art. 241 ET con deducciones).";
      }
      // Sesión 1-may-2026: descuento Art. 254 ET — impuestos pagados en
      // el exterior (típico: arriendos en USA con propiedad bajo Salem
      // Property Investments LLC, dividendos de fondos extranjeros, etc.).
      // Es un DESCUENTO directo (peso a peso) sobre el impuesto colombiano,
      // no una deducción. Se aplica después de calcular impActualNat.
      // Cap legal: el descuento no puede superar el impuesto que se pagaría
      // en Colombia sobre ese mismo ingreso (Art. 254 par. 1).
      const impuestosExteriorPagados = Number(ow.fiscalProfile?.impuestosExteriorPagados) || 0;
      if (impuestosExteriorPagados > 0) {
        const descuentoArt254 = Math.min(impuestosExteriorPagados, impActualNat);
        impActualNat = Math.max(0, impActualNat - descuentoArt254);
        impOptNat = Math.max(0, impOptNat - descuentoArt254);
      }

      const ahorroNat = impActualNat - impOptNat;

      // ── 6. GANANCIAS OCASIONALES (Bug #7, Arts. 299-317 ET) ──
      // Cédula separada del régimen ordinario. Tarifa 15% general (herencias,
      // venta inmueble > 2 años), 20% para loterías/rifas (Art. 317).
      //
      // Lee de ow.fiscalProfile.eventosAno. Si no existe o los montos son 0,
      // impGO = 0 (invariante con motor pre-Fase 3).
      //
      // Decisiones conservadoras:
      // - Herencia: exención 3.490 UVT (Art. 307 — caso cónyuge/hijos, el más
      //   común). Lo que excede tributa al 15%.
      // - Venta inmueble: utilidad = valorVenta - costoFiscal, × 15% sin exención
      //   adicional (el 15% ya es beneficio vs 39% ordinario; Art. 311-1 tiene
      //   exención adicional de 7.500 UVT pero requiere condiciones específicas
      //   que no se capturan en el switch — el contador los aplicará en la
      //   declaración real).
      // - Lotería: 20% sin exención (Art. 317).
      let impGO = 0;
      const eventos = fp.eventosAno || {};
      const desgloseGO = [];
      if (eventos.recibioHerencia && Number(eventos.herenciaMonto) > 0) {
        const monto = Number(eventos.herenciaMonto) || 0;
        const exentoHerencia = 3490 * UVT; // Art. 307 — cónyuge/hijos
        const gravableHerencia = Math.max(0, monto - exentoHerencia);
        const impHerencia = gravableHerencia * 0.15;
        impGO += impHerencia;
        desgloseGO.push({
          tipo: "herencia",
          monto,
          exento: Math.min(monto, exentoHerencia),
          gravable: gravableHerencia,
          tarifa: 0.15,
          impuesto: impHerencia,
          baseLegal: "Arts. 302, 307, 313 ET"
        });
      }
      if (eventos.vendioInmuebleAntiguo) {
        const valorVenta = Number(eventos.inmuebleValorVenta) || 0;
        const costoFiscal = Number(eventos.inmuebleCostoFiscal) || 0;
        const utilidad = Math.max(0, valorVenta - costoFiscal);
        const impInmueble = utilidad * 0.15;
        impGO += impInmueble;
        desgloseGO.push({
          tipo: "venta_inmueble",
          valorVenta,
          costoFiscal,
          utilidad,
          tarifa: 0.15,
          impuesto: impInmueble,
          baseLegal: "Arts. 300, 313 ET"
        });
      }
      if (eventos.ganoLoteria && Number(eventos.loteriaMonto) > 0) {
        const monto = Number(eventos.loteriaMonto) || 0;
        const impLoteria = monto * 0.20;
        impGO += impLoteria;
        desgloseGO.push({
          tipo: "loteria",
          monto,
          tarifa: 0.20,
          impuesto: impLoteria,
          baseLegal: "Art. 317 ET"
        });
      }

      // Sumar GO al impuesto total y actualizar impActualNat para que el detalle
      // muestre el total correcto (incluyendo GO).
      impActualNat += impGO;
      impOptNat += impGO; // GO no admite optimización (tarifa fija por cédula)
      impBrutoNat += impGO;

      totalImp += impActualNat;
      detalle.push({
        name: ow.name, type: "natural", ingreso: ingAnual,
        regimen: regimenN, regimenNota: regimenNotaN,
        ingLaboral, ingCapital, ingNoLaboral, divAnual, pensAnual,
        noConst: totalNoConst, neto: netoLaboral,
        // Desglose de aportes (para UI y debugging)
        aportesManuales: (aPensObl + aSaludObl + aSSIndep) > 0,
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
        // Commit 3 Tarea 3: cesantías y prima Art. 206 #4
        cesantiasAnual, primaAnual, cesantiasExentas,
        // Commit 13 Tarea 3: dividendos automáticos derivados de jurídicas
        divAnualManual, divAnualAutomatico, dividendosAutoDesglose,
        // Commit B: campos para que la UI pueda mostrar transparencia
        interesesHipBruto,
        viviendaResponsablesPct: viviendaPct * 100,
        dependientesDeclarados,
        dependientesConDiscapacidad: conDiscapacidad,
        // Gastos de actividad de honorarios (Art. 107 ET) — para que la UI los muestre
        honorariosBruto: honAnual,
        gastosHonorariosDed,
        gastosHonorariosDesglose,
        alertaHonorarios,
        honorariosNeto: Math.max(0, honAnual - gastosHonorariosDed),
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
        // Bug #7 Fase 3: ganancias ocasionales
        impGO, desgloseGO,
        // Bug #8 Fase 3: pension cedula separada
        impPension, pensExenta, pensGravable,
      });
    }
  });
  return { total: totalImp, mes: totalImp / 12, detalle, sinClasificar };
};
