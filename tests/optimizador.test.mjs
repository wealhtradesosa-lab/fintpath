// ═════════════════════════════════════════════════════════════════════════
// Tests unitarios del optimizador V2 (Commit 1: infraestructura)
// ─────────────────────────────────────────────────────────────────────────
// Ejecutar con: node tests/optimizador.test.mjs
// Si todos los tests pasan, exit code 0. Si alguno falla, exit code 1.
//
// Estos tests verifican el contrato del módulo. En Commits 2-6 se agregarán
// tests específicos por palanca y de integración con taxCO.
// ═════════════════════════════════════════════════════════════════════════

import {
  calcularEscenarioOptimo,
  detectarPalancasAutomatizables,
  aplicarPalancaSegura,
  OPTIMIZADOR_V2_ENABLED,
} from "../src/lib/optimizador.js";

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: "✅" });
    passed++;
  } catch (err) {
    results.push({ name, status: "❌", error: err.message });
    failed++;
  }
}

function assertEq(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(
      `${msg ? msg + " - " : ""}esperaba ${JSON.stringify(expected)} pero obtuvo ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEq(actual, expected, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${msg ? msg + " - " : ""}esperaba ${JSON.stringify(expected)} pero obtuvo ${JSON.stringify(actual)}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Tests del flag de feature
// ─────────────────────────────────────────────────────────────────────────

test("Flag OPTIMIZADOR_V2_ENABLED inicia desactivado (riesgo cero)", () => {
  assertEq(OPTIMIZADOR_V2_ENABLED, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Tests de calcularEscenarioOptimo
// ─────────────────────────────────────────────────────────────────────────

test("calcularEscenarioOptimo: con detActual válido devuelve escenario igual al input (placeholder)", () => {
  const detActual = {
    impBruto: 11_100_000,
    impuesto: 11_100_000,
    ingreso: 246_000_000,
    deducciones: 89_000_000,
  };
  const result = calcularEscenarioOptimo({}, {}, detActual);

  assertEq(result.impuestoOptimo, 11_100_000, "impuestoOptimo debe igualar impBruto");
  assertEq(result.ahorroTotal, 0, "ahorroTotal debe ser 0 en placeholder");
  assertDeepEq(result.palancasAplicadas, [], "palancasAplicadas debe estar vacío");
  assertDeepEq(result.detalleEscenario, detActual, "detalleEscenario debe ser copia del input");
});

test("calcularEscenarioOptimo: prefiere impBruto sobre impuesto cuando ambos están", () => {
  const detActual = { impBruto: 5_000_000, impuesto: 99_999_999 };
  const result = calcularEscenarioOptimo({}, {}, detActual);
  assertEq(result.impuestoOptimo, 5_000_000);
});

test("calcularEscenarioOptimo: usa impuesto si impBruto es null", () => {
  const detActual = { impBruto: null, impuesto: 7_000_000 };
  const result = calcularEscenarioOptimo({}, {}, detActual);
  assertEq(result.impuestoOptimo, 7_000_000);
});

test("calcularEscenarioOptimo: defensivo - detActual null devuelve estructura vacía válida", () => {
  const result = calcularEscenarioOptimo({}, {}, null);
  assertEq(result.impuestoOptimo, 0);
  assertEq(result.ahorroTotal, 0);
  assertDeepEq(result.palancasAplicadas, []);
  assertEq(result.detalleEscenario, null);
});

test("calcularEscenarioOptimo: defensivo - detActual undefined devuelve estructura vacía válida", () => {
  const result = calcularEscenarioOptimo({}, {}, undefined);
  assertEq(result.impuestoOptimo, 0);
  assertEq(result.ahorroTotal, 0);
});

test("calcularEscenarioOptimo: ahorroTotal NUNCA es negativo en placeholder", () => {
  const detActual = { impBruto: 1_000_000 };
  const result = calcularEscenarioOptimo({}, {}, detActual);
  if (result.ahorroTotal < 0) {
    throw new Error("ahorroTotal no puede ser negativo");
  }
});

test("calcularEscenarioOptimo: detalleEscenario es nueva referencia (no muta input)", () => {
  const detActual = { impBruto: 1_000_000, ingreso: 10_000_000 };
  const result = calcularEscenarioOptimo({}, {}, detActual);
  if (result.detalleEscenario === detActual) {
    throw new Error("detalleEscenario debe ser copia, no la misma referencia");
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Tests de detectarPalancasAutomatizables
// ─────────────────────────────────────────────────────────────────────────

test("detectarPalancasAutomatizables: en placeholder devuelve array vacío", () => {
  const result = detectarPalancasAutomatizables({}, {}, {});
  assertDeepEq(result, []);
});

test("detectarPalancasAutomatizables: tolera entrada null", () => {
  const result = detectarPalancasAutomatizables(null, null, null);
  assertDeepEq(result, []);
});

// ─────────────────────────────────────────────────────────────────────────
// Tests de aplicarPalancaSegura
// ─────────────────────────────────────────────────────────────────────────

test("aplicarPalancaSegura: en placeholder marca palanca como no aceptable", () => {
  const escenario = { impBruto: 5_000_000 };
  const palanca = { codigo: "TEST", aplicar: () => ({}) };
  const result = aplicarPalancaSegura(escenario, palanca);
  assertEq(result.aceptable, false);
  assertEq(result.ahorro, 0);
});

test("aplicarPalancaSegura: nuevoEscenario es copia (no muta original)", () => {
  const escenario = { impBruto: 5_000_000 };
  const result = aplicarPalancaSegura(escenario, {});
  if (result.nuevoEscenario === escenario) {
    throw new Error("nuevoEscenario debe ser copia, no la misma referencia");
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Reporte final
// ─────────────────────────────────────────────────────────────────────────

console.log("─".repeat(70));
console.log("Tests del optimizador V2 (Commit 1)");
console.log("─".repeat(70));
for (const r of results) {
  console.log(`${r.status} ${r.name}`);
  if (r.error) console.log(`   └─ ${r.error}`);
}
console.log("─".repeat(70));
console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);

if (failed > 0) {
  process.exit(1);
}
