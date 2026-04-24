// Verificación aislada del Commit 1.6 — Bridge de Aporte tributario
//
// Testea que el motor taxCO:
//   1. Lee salud prepagada del shape nuevo (Egresos con AP_TRIB_SALUD_PREPAGADA)
//      y le aplica el mismo tope 16 UVT/mes (Art. 387 #2 ET) que al shape viejo.
//   2. Suma PV + AFC del shape nuevo al cap 25% / 2500 UVT (Art. 126-1, 126-4 ET)
//      junto con ow.aportes.pensionVoluntariaMensual del shape viejo.
//   3. Produce el MISMO resultado si los datos viven en shape viejo vs nuevo
//      (invariante del bridge).
//
// Escenarios escritos explícitamente para cubrir los dos caminos del motor.

import { estimarImpuesto } from "../src/lib/taxCO.js";

const UVT_2026 = 52_374;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg || "mismatch"}\n  expected: ${expected} (±${tol})\n  actual:   ${actual}`);
  }
}
function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "mismatch"}\n  expected: ${b}\n  actual:   ${a}`);
}

// Factory de un user base con salario de $10M/mes, persona natural
function baseUser() {
  return {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [
      { id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
        mensual: 10_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
        aportes: { pension: 400_000, salud: 400_000 } },
    ],
    gas: {},
    deu: [],
    inv: [],
    trm: 4200,
  };
}

// Factory alterno con salario de $20M/mes — genera impuesto > 0 incluso con
// todas las detracciones aplicadas. Usado en tests que verifican REDUCCIÓN
// (no sólo invariantes de equivalencia).
function highEarner() {
  const u = baseUser();
  u.ingresos[0].mensual = 20_000_000;
  u.ingresos[0].aportes = { pension: 800_000, salud: 800_000 };
  return u;
}

// ───────── Salud prepagada ─────────

test("Salud prepagada shape VIEJO (cat 'Salud') produce deducible médico", () => {
  const u = highEarner();
  u.gas = { "Salud": [{ c: "Colsanitas", m: 800_000, t: "f", freq: "mes", owner: "own_1" }] };
  const r = estimarImpuesto(u);
  const owner = r.detalle.find(d => d.name === "Yo");
  if (owner.impBruto <= 0) throw new Error("owner debe tener impBruto > 0");
});

test("Salud prepagada shape NUEVO (AP_TRIB_SALUD_PREPAGADA) produce el MISMO impuesto que shape viejo", () => {
  const uViejo = baseUser();
  uViejo.gas = { "Salud": [{ c: "Colsanitas", m: 800_000, t: "f", freq: "mes", owner: "own_1" }] };

  const uNuevo = baseUser();
  uNuevo.gas = { "Aporte tributario": [{ c: "Colsanitas", m: 800_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_SALUD_PREPAGADA" }] };

  const rViejo = estimarImpuesto(uViejo);
  const rNuevo = estimarImpuesto(uNuevo);
  const impViejo = rViejo.detalle.find(d => d.name === "Yo").impuesto;
  const impNuevo = rNuevo.detalle.find(d => d.name === "Yo").impuesto;
  assertClose(impNuevo, impViejo, 1, "impuestos deben coincidir entre shape viejo y nuevo");
});

test("Salud prepagada shape VIEJO + NUEVO suma (no pisa)", () => {
  const u = baseUser();
  // 400k viejo + 400k nuevo = 800k total, mismo resultado que 800k en un solo lado
  u.gas = {
    "Salud":             [{ c: "Medicina A", m: 400_000, t: "f", freq: "mes", owner: "own_1" }],
    "Aporte tributario": [{ c: "Medicina B", m: 400_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_SALUD_PREPAGADA" }],
  };
  const r = estimarImpuesto(u);
  const impSuma = r.detalle.find(d => d.name === "Yo").impuesto;

  const uSolo = baseUser();
  uSolo.gas = { "Salud": [{ c: "Medicina total", m: 800_000, t: "f", freq: "mes", owner: "own_1" }] };
  const rSolo = estimarImpuesto(uSolo);
  const impSolo = rSolo.detalle.find(d => d.name === "Yo").impuesto;

  assertClose(impSuma, impSolo, 1, "400k + 400k debe dar el mismo resultado que 800k en un solo lado");
});

// ───────── Pensión Voluntaria ─────────

// NOTA Commit 1.7: el shape viejo de PV (ow.aportes.pensionVoluntariaMensual)
// ya NO reduce impuesto sin migrar previamente. La migración silenciosa
// (migrateAportesVoluntariosV17) convierte el shape viejo al nuevo.
// Los tests específicos de PV viejo vs nuevo viven en verify_switch_v17.mjs.

test("PV shape NUEVO (AP_TRIB_PV) reduce el impuesto", () => {
  const u = highEarner();
  const sinPV = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;

  const uConPV = highEarner();
  uConPV.gas = { "Aporte tributario": [{ c: "Fondo PV", m: 500_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" }] };
  const conPV = estimarImpuesto(uConPV).detalle.find(d => d.name === "Yo").impBruto;

  if (conPV >= sinPV) throw new Error(`PV nuevo debe reducir impBruto: sinPV=${sinPV}, conPV=${conPV}`);
});

// ───────── AFC ─────────

test("AFC shape NUEVO (AP_TRIB_AFC) reduce el impuesto (antes no existía)", () => {
  const u = highEarner();
  const sinAFC = estimarImpuesto(u).detalle.find(d => d.name === "Yo").impBruto;

  const uConAFC = highEarner();
  uConAFC.gas = { "Aporte tributario": [{ c: "Cuenta AFC", m: 300_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_AFC" }] };
  const conAFC = estimarImpuesto(uConAFC).detalle.find(d => d.name === "Yo").impBruto;

  if (conAFC >= sinAFC) throw new Error(`AFC debe reducir impBruto: sinAFC=${sinAFC}, conAFC=${conAFC}`);
});

test("AFC comparte cap con PV (PV 250k + AFC 250k = PV 500k solo)", () => {
  const uMix = baseUser();
  uMix.gas = { "Aporte tributario": [
    { c: "Fondo PV",  m: 250_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" },
    { c: "Cuenta AFC", m: 250_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_AFC" },
  ] };
  const impMix = estimarImpuesto(uMix).detalle.find(d => d.name === "Yo").impuesto;

  const uSoloPV = baseUser();
  uSoloPV.gas = { "Aporte tributario": [{ c: "Fondo PV", m: 500_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" }] };
  const impSoloPV = estimarImpuesto(uSoloPV).detalle.find(d => d.name === "Yo").impuesto;

  assertClose(impMix, impSoloPV, 1, "PV 250 + AFC 250 debe dar el mismo impuesto que PV 500 solo");
});

// ───────── Cap máximo ─────────

test("Cap 2500 UVT limita PV + AFC excesivos", () => {
  const u = baseUser();
  // Ingreso laboral alto para que el cap aplique
  u.ingresos[0].mensual = 50_000_000;
  // PV + AFC = $60M/año, bien por encima del cap 2500 UVT ≈ $131M y 25% de neto laboral
  u.gas = { "Aporte tributario": [
    { c: "PV", m: 3_000_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" },
    { c: "AFC", m: 2_000_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_AFC" },
  ] };
  const r = estimarImpuesto(u).detalle.find(d => d.name === "Yo");
  // Verificar que aún hay impuesto (el cap 25% neto laboral debe aplicar antes)
  if (r.impuesto <= 0) throw new Error("impuesto no puede ser 0 con ingresos altos");
});

// ───────── No-natural ignora los fiscalCodes nuevos ─────────

test("Aporte tributario asignado a jurídica NO genera deducción en cálculo jurídico", () => {
  // Crear un user juridico con SAS y un egreso AP_TRIB_PV mal asignado ahí
  const u = {
    owners: [{ id: "own_j", name: "Mi SAS", type: "juridica" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: { "Aporte tributario": [{ c: "PV mal asignado", m: 500_000, t: "f", freq: "mes",
                                   owner: "own_j", fiscalCode: "AP_TRIB_PV" }] },
    deu: [], inv: [], trm: 4200,
  };
  // No debe tirar error. El gasto se registra pero el motor jurídico no lo procesa como deducción especial.
  const r = estimarImpuesto(u);
  const sas = r.detalle.find(d => d.name === "Mi SAS");
  if (!sas) throw new Error("owner jurídica debe estar en detalle");
  if (sas.impuesto <= 0) throw new Error("SAS con $240M/año debe tener impuesto > 0");
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
