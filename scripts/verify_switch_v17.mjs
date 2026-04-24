// Verificación aislada del Commit 1.7 — Switch del motor al shape nuevo + migración
//
// Cubre:
//   1. Migración silenciosa: ow.aportes.pensionVoluntariaMensual → egreso AP_TRIB_PV.
//   2. Idempotencia: correr migrate dos veces no duplica.
//   3. Aportes obligatorios vía ing.aportes (shape nuevo) reducen el impuesto igual
//      que cuando vivían en ow.aportes.pensionObligatoriaMensual/saludObligatoriaMensual.
//   4. Fallback legacy: si un salario no tiene ing.aportes pero el owner sí tiene
//      ow.aportes.pensionObligatoriaMensual, el motor sigue leyéndolo (retrocompat).
//   5. Shape viejo de PV (ow.aportes.pensionVoluntariaMensual) ya NO se lee sin migrar
//      (confirma que el switch se cerró).

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { migrateAportesVoluntariosV17 } from "../src/lib/migrations.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg || "mismatch"}\n  expected: ${expected} (±${tol})\n  actual:   ${actual}`);
  }
}
function assertEq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${msg || "mismatch"}\n  expected: ${JSON.stringify(b)}\n  actual:   ${JSON.stringify(a)}`);
  }
}

function highEarner() {
  return {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [
      { id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
        mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
        aportes: { pension: 800_000, salud: 800_000 } },
    ],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
}

// ───────── Migración silenciosa PV ─────────

test("migrate: PV del owner pasa a egreso AP_TRIB_PV", () => {
  const u = {
    owners: [{ id: "own_1", name: "Yo", type: "natural", aportes: { pensionVoluntariaMensual: 500_000 } }],
    gas: {},
  };
  migrateAportesVoluntariosV17(u);
  const ap = u.gas["Aporte tributario"] || [];
  if (ap.length !== 1) throw new Error(`debe crear 1 egreso, hay ${ap.length}`);
  assertEq(ap[0].fiscalCode, "AP_TRIB_PV");
  assertEq(ap[0].m, 500_000);
  assertEq(ap[0].owner, "own_1");
  if (u.owners[0].aportes.pensionVoluntariaMensual !== undefined) {
    throw new Error("pensionVoluntariaMensual debe borrarse del owner");
  }
  assertEq(u.migratedAportesVoluntariosV17, true);
});

test("migrate: idempotente (correr 2 veces no duplica)", () => {
  const u = {
    owners: [{ id: "own_1", name: "Yo", type: "natural", aportes: { pensionVoluntariaMensual: 500_000 } }],
    gas: {},
  };
  migrateAportesVoluntariosV17(u);
  migrateAportesVoluntariosV17(u);
  const ap = u.gas["Aporte tributario"] || [];
  if (ap.length !== 1) throw new Error(`idempotencia rota: hay ${ap.length} egresos`);
});

test("migrate: si ya existe AP_TRIB_PV para el owner, no duplica", () => {
  const u = {
    owners: [{ id: "own_1", aportes: { pensionVoluntariaMensual: 500_000 } }],
    gas: { "Aporte tributario": [{ c: "Mi PV manual", m: 300_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" }] },
  };
  migrateAportesVoluntariosV17(u);
  const ap = u.gas["Aporte tributario"];
  if (ap.length !== 1) throw new Error(`no debe duplicar: hay ${ap.length}`);
  assertEq(ap[0].m, 300_000, "respeta el egreso existente");
  if (u.owners[0].aportes.pensionVoluntariaMensual !== undefined) {
    throw new Error("debe borrar del owner igual, para evitar lecturas futuras");
  }
});

test("migrate: user sin PV voluntaria no se modifica", () => {
  const u = { owners: [{ id: "own_1", aportes: {} }], gas: {} };
  migrateAportesVoluntariosV17(u);
  if (u.gas["Aporte tributario"]) throw new Error("no debe crear categoría vacía");
  assertEq(u.migratedAportesVoluntariosV17, true);
});

test("migrate: múltiples owners con PV cada uno", () => {
  const u = {
    owners: [
      { id: "own_1", aportes: { pensionVoluntariaMensual: 300_000 } },
      { id: "own_2", aportes: { pensionVoluntariaMensual: 500_000 } },
    ],
    gas: {},
  };
  migrateAportesVoluntariosV17(u);
  const ap = u.gas["Aporte tributario"];
  if (ap.length !== 2) throw new Error(`debe crear 2 egresos, hay ${ap.length}`);
});

// ───────── Motor lee aportes obligatorios de ing.aportes (1.7) ─────────

test("motor: aportes obligatorios viven en ing.aportes (shape nuevo)", () => {
  const u = highEarner();
  const r = estimarImpuesto(u).detalle.find(d => d.name === "Yo");
  // Debe registrar que leyó los aportes (aPensObl > 0 → aportesManuales: true)
  assertEq(r.aportesManuales, true, "motor debe detectar aportes manuales desde ing.aportes");
  // pensionObligatoriaAnual = 800k * 12 = 9.6M
  assertClose(r.aportesDesglose.pensionObligatoriaAnual, 9_600_000, 1);
  assertClose(r.aportesDesglose.saludObligatoriaAnual, 9_600_000, 1);
});

test("motor: fallback legacy cuando no hay ing.aportes", () => {
  const u = {
    owners: [{ id: "own_1", name: "Yo", type: "natural",
               aportes: { pensionObligatoriaMensual: 800_000, saludObligatoriaMensual: 800_000 } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u).detalle.find(d => d.name === "Yo");
  assertClose(r.aportesDesglose.pensionObligatoriaAnual, 9_600_000, 1, "legacy pensión");
  assertClose(r.aportesDesglose.saludObligatoriaAnual, 9_600_000, 1, "legacy salud");
});

test("motor: invariante — ing.aportes (nuevo) y ow.aportes (viejo) dan el mismo impuesto", () => {
  const uNuevo = highEarner();
  const uViejo = {
    owners: [{ id: "own_1", name: "Yo", type: "natural",
               aportes: { pensionObligatoriaMensual: 800_000, saludObligatoriaMensual: 800_000 } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const impNuevo = estimarImpuesto(uNuevo).detalle.find(d => d.name === "Yo").impBruto;
  const impViejo = estimarImpuesto(uViejo).detalle.find(d => d.name === "Yo").impBruto;
  assertClose(impNuevo, impViejo, 1, "impuestos deben coincidir entre shapes");
});

test("motor: ing.aportes gana sobre ow.aportes cuando ambos existen", () => {
  // Usuario con ing.aportes = 800k + ow.aportes = 500k → debe usar 800k
  const u = highEarner();
  u.owners[0].aportes = { pensionObligatoriaMensual: 500_000, saludObligatoriaMensual: 500_000 };
  const r = estimarImpuesto(u).detalle.find(d => d.name === "Yo");
  assertClose(r.aportesDesglose.pensionObligatoriaAnual, 9_600_000, 1, "debe usar ing.aportes (800k) no ow.aportes (500k)");
});

// ───────── PV del shape viejo ya NO se lee sin migrar ─────────

test("motor: PV vieja sin migrar NO reduce el impuesto (obliga migración)", () => {
  const u = highEarner();
  const sinPV = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;

  u.owners[0].aportes = { ...u.owners[0].aportes, pensionVoluntariaMensual: 500_000 };
  const conPVSinMigrar = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;
  assertClose(conPVSinMigrar, sinPV, 1, "PV vieja sin migrar no debe reducir (motor ya no la lee)");
});

test("motor: PV vieja DESPUÉS de migrar SÍ reduce el impuesto", () => {
  const u = highEarner();
  const sinPV = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;

  u.owners[0].aportes = { ...u.owners[0].aportes, pensionVoluntariaMensual: 500_000 };
  migrateAportesVoluntariosV17(u);
  const conPVMigrada = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;
  if (conPVMigrada >= sinPV) {
    throw new Error(`PV migrada debe reducir impuesto: sin=${sinPV}, con=${conPVMigrada}`);
  }
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
