// Smoke test de DashboardFiscal — chequea que los cálculos internos no exploten
// en edge cases (owner sin declaración, sin ingresos, sin detalle en estimación).

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { getFiscalWarnings } from "../src/lib/normalize.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }

// ───────── User mínimo ─────────
test("user vacío: estimarImpuesto no explota", () => {
  const u = { owners: [{ id: "own_1", name: "Yo", type: "natural" }], ingresos: [], gas: {}, deu: [], inv: [], trm: 4200 };
  const r = estimarImpuesto(u);
  assert(r !== null && typeof r === "object", "debe retornar un objeto");
  assert(Array.isArray(r.detalle), "detalle debe ser array");
});

test("getFiscalWarnings: user vacío devuelve array", () => {
  const u = { owners: [{ id: "own_1", name: "Yo", type: "natural" }], ingresos: [], gas: {}, deu: [], inv: [], trm: 4200 };
  const warnings = getFiscalWarnings(u);
  assert(Array.isArray(warnings), "warnings debe ser array");
});

// ───────── User con declaración F-210 ─────────
test("owner natural con declaracionAnterior F-210 se procesa", () => {
  const u = {
    owners: [{
      id: "own_1", name: "Yo", type: "natural",
      declaracionAnterior: {
        tipo: "F210",
        anoGravable: 2024,
        renglones: {
          ingresosBrutos: 240_000_000,
          patrimonioLiquido: 320_000_000,
          impuestoCalculado: 35_000_000,
          retefuente: 30_000_000,
          saldoPagar: 5_000_000,
          pvAFC: 6_000_000,
          deducMedicina: 9_600_000,
        },
      },
    }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
                 aportes: { pension: 800_000, salud: 800_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const detalle = r.detalle.find(d => d.name === "Yo");
  assert(detalle !== undefined, "owner debe estar en detalle");
  assert(typeof detalle.ingreso === "number", "ingreso debe ser número");
  assert(typeof detalle.impBruto === "number", "impBruto debe ser número");
});

// ───────── User con declaración F-110 ─────────
test("owner juridica con declaracionAnterior F-110 se procesa", () => {
  const u = {
    owners: [{
      id: "own_j", name: "Mi SAS", type: "juridica",
      declaracionAnterior: {
        tipo: "F110",
        anoGravable: 2024,
        renglones: {
          ingresosBrutos: 500_000_000,
          patrimonioLiquido: 200_000_000,
          impuestoNeto: 75_000_000,
          descICA: 3_000_000,
          descDonaciones: 1_000_000,
        },
      },
    }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 40_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const detalle = r.detalle.find(d => d.name === "Mi SAS");
  assert(detalle !== undefined, "owner juridica debe estar en detalle");
  assert(detalle.impBruto > 0 || detalle.impuesto > 0, "SAS con $500M debe tener impuesto > 0");
});

// ───────── Sin declaración ─────────
test("owner sin declaracionAnterior no genera alerta de descuentos perdidos", () => {
  const u = {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [], gas: {}, deu: [], inv: [], trm: 4200,
  };
  const warnings = getFiscalWarnings(u);
  const codes = warnings.map(w => w.code);
  assert(!codes.includes("APORTES_VOLUNTARIOS_NO_CAPTURADOS"), "sin declaración no debe haber alerta de PV");
  assert(!codes.includes("DESCUENTOS_AÑO_ANTERIOR_NO_CAPTURADOS"), "sin declaración no debe haber alerta de descuentos");
});

// ───────── Declaración dispara alertas correctas ─────────
test("owner natural con PV declarado pero sin capturar genera alerta", () => {
  const u = {
    owners: [{
      id: "own_1", name: "Yo", type: "natural",
      declaracionAnterior: {
        tipo: "F210",
        anoGravable: 2024,
        renglones: { ingresosBrutos: 240_000_000, pvAFC: 6_000_000 },
      },
    }],
    ingresos: [], gas: {}, deu: [], inv: [], trm: 4200,
  };
  const warnings = getFiscalWarnings(u);
  const alert = warnings.find(w => w.code === "APORTES_VOLUNTARIOS_NO_CAPTURADOS");
  assert(alert, "debe generarse alerta APORTES_VOLUNTARIOS_NO_CAPTURADOS");
  assert(alert.itemId === "own_1", "alerta debe apuntar al owner");
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
