// Verificación Commit A — Honorarios con gastos deducibles (Art. 107 ET)
// El motor descuenta del ingreso por honorarios los gastos marcados con
// fiscalCode GAS_HON_* antes de aplicar la cédula laboral. Reglas:
//  - Vehículo (GAS_HON_VEHICULO): aplicado al 50% conservador
//  - Representación (GAS_HON_REPRESENTACION): tope 10% del bruto (Art. 107-1)
//  - Resto: 100% deducible si está marcado con causalidad
//  - Salvaguarda: alerta amarilla si gastos > 60%, roja si > 80%
//
// IMPORTANTE: estos tests NO deben afectar el snapshot (snapshot_tax 9/9).
// Los escenarios snapshoteados no tienen gastos GAS_HON_*, por lo que el
// cálculo permanece idéntico.

import { estimarImpuesto } from "../src/lib/taxCO.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "failed"); }

// Helper: builder de owner con honorarios y gastos opcionales
function buildOwnerHonorarios(honorariosMensual, gastosHon = []) {
  const ingreso = {
    id: "i1",
    nombre: "Honorarios",
    categoria: "Honorarios",
    fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS",
    mensual: honorariosMensual,
    tipo: "fijo",
    moneda: "COP",
    owner: "o1",
    aportes: { pension: 800_000, salud: 800_000 },
  };
  const gas = {
    "Honorarios": gastosHon.map((g, i) => ({
      id: `g_hon_${i}`,
      nombre: g.nombre || `Gasto ${i}`,
      cat: "Honorarios",
      m: g.monto,
      fiscalCode: g.fiscalCode,
      owner: "o1",
    })),
  };
  return {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [ingreso],
    gas,
    deu: [],
    inv: [],
    trm: 4200,
  };
}

// ══════════════════════ Test 1 ══════════════════════
test("Honorarios sin gastos cargados → no afecta cálculo (gastosHonorariosDed = 0)", () => {
  const u = buildOwnerHonorarios(40_000_000, []);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.gastosHonorariosDed === 0, `esperaba 0, fue ${det.gastosHonorariosDed}`);
  assert(det.honorariosBruto === 480_000_000, `esperaba honorariosBruto=480M, fue ${det.honorariosBruto}`);
  assert(det.honorariosNeto === 480_000_000, `esperaba honorariosNeto=480M, fue ${det.honorariosNeto}`);
  assert(det.alertaHonorarios === null, `no debería haber alerta, fue ${det.alertaHonorarios}`);
});

// ══════════════════════ Test 2 ══════════════════════
test("Honorarios con gastos deducibles 100% (oficina, materiales) → impuesto baja", () => {
  // 480M honorarios al año, 120M en gastos de oficina+materiales (25% del bruto)
  const u = buildOwnerHonorarios(40_000_000, [
    { fiscalCode: "GAS_HON_OFICINA", monto: 8_000_000 },        // 96M anual
    { fiscalCode: "GAS_HON_MATERIALES", monto: 2_000_000 },     // 24M anual
  ]);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.gastosHonorariosDed === 120_000_000, `esperaba 120M, fue ${det.gastosHonorariosDed}`);
  assert(det.honorariosNeto === 360_000_000, `esperaba 360M, fue ${det.honorariosNeto}`);
  // 25% < 60% → sin alerta
  assert(det.alertaHonorarios === null, `25% no debería disparar alerta, fue ${det.alertaHonorarios}`);
});

// ══════════════════════ Test 3 ══════════════════════
test("Vehículo aplicado al 50% (uso mixto profesional)", () => {
  // 480M honorarios, 60M de vehículo bruto → solo 30M deducible (50%)
  const u = buildOwnerHonorarios(40_000_000, [
    { fiscalCode: "GAS_HON_VEHICULO", monto: 5_000_000 },  // 60M anual
  ]);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.gastosHonorariosDed === 30_000_000, `esperaba 30M (50% de 60M), fue ${det.gastosHonorariosDed}`);
  assert(det.gastosHonorariosDesglose.vehiculoBruto === 60_000_000);
  assert(det.gastosHonorariosDesglose.vehiculoAplicado === 30_000_000);
});

// ══════════════════════ Test 4 ══════════════════════
test("Representación con tope 10% (Art. 107-1)", () => {
  // 480M honorarios, 80M en representación → tope 10% = 48M, solo deduce 48M
  const u = buildOwnerHonorarios(40_000_000, [
    { fiscalCode: "GAS_HON_REPRESENTACION", monto: 6_666_667 },  // ~80M anual
  ]);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Tope 10% de 480M = 48M
  const tope = 48_000_000;
  assert(det.gastosHonorariosDed === tope, `esperaba 48M (tope 10%), fue ${det.gastosHonorariosDed}`);
  assert(det.gastosHonorariosDesglose.representacionTope === tope);
  assert(det.gastosHonorariosDesglose.representacionAplicado === tope);
});

// ══════════════════════ Test 5 ══════════════════════
test("Salvaguarda fiscal: ratio > 60% → alerta amarilla", () => {
  // 480M honorarios, 312M en gastos (65%)
  const u = buildOwnerHonorarios(40_000_000, [
    { fiscalCode: "GAS_HON_OFICINA", monto: 26_000_000 },  // 312M anual
  ]);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.alertaHonorarios === "amarilla", `esperaba amarilla, fue ${det.alertaHonorarios}`);
});

// ══════════════════════ Test 6 ══════════════════════
test("Salvaguarda fiscal: ratio > 80% → alerta roja", () => {
  // 480M honorarios, 408M en gastos (85%)
  const u = buildOwnerHonorarios(40_000_000, [
    { fiscalCode: "GAS_HON_OFICINA", monto: 34_000_000 },  // 408M anual
  ]);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.alertaHonorarios === "roja", `esperaba roja, fue ${det.alertaHonorarios}`);
});

// ══════════════════════ Test 7 ══════════════════════
test("Salario puro sin honorarios → sin afectación (compatibilidad backwards)", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [{
      id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
      mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
      aportes: { pension: 800_000, salud: 800_000 },
    }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.gastosHonorariosDed === 0, `salario puro: esperaba 0`);
  assert(det.honorariosBruto === 0, `salario puro: honorariosBruto debe ser 0`);
  assert(det.alertaHonorarios === null, `salario puro: sin alerta`);
});

// ══════════════════════ Test 8 ══════════════════════
test("Mix salario + honorarios + gastos → solo honorarios reciben deducción", () => {
  // 240M salario + 240M honorarios + 60M gastos oficina
  // gastos solo restan al honorario, no al salario
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [
      { id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
        mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
        aportes: { pension: 800_000, salud: 800_000 } },
      { id: "i2", nombre: "Honorarios", categoria: "Honorarios", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS",
        mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1" },
    ],
    gas: {
      "Honorarios": [
        { id: "g1", nombre: "Oficina", cat: "Honorarios", m: 5_000_000,
          fiscalCode: "GAS_HON_OFICINA", owner: "o1" },
      ],
    },
    deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.honorariosBruto === 240_000_000, `honorariosBruto=240M, fue ${det.honorariosBruto}`);
  assert(det.gastosHonorariosDed === 60_000_000, `esperaba 60M, fue ${det.gastosHonorariosDed}`);
  assert(det.honorariosNeto === 180_000_000, `honorariosNeto=180M, fue ${det.honorariosNeto}`);
  // Ratio gastos/honorarios = 60/240 = 25% → sin alerta
  assert(det.alertaHonorarios === null);
});

// ════════════════════════ Run ════════════════════════
let passed = 0, failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`✓ ${t.name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${t.name}\n  ${e.message}`);
    failed++;
  }
}
console.log(`\n${failed === 0 ? "🟢" : "🔴"} Resultado: ${passed} pasan, ${failed} fallan`);
process.exit(failed === 0 ? 0 : 1);
