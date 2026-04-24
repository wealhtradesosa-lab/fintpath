// Tests del módulo regimenSimple.js — tarifas reales del Art. 908 ET

import { GRUPOS_SIMPLE, TOPE_SIMPLE_UVT, calcularImpuestoSimple, EXCLUSIONES_SIMPLE } from "../src/lib/regimenSimple.js";

const UVT = 52_374;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "failed"); }
function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg}\n  expected: ${expected} ±${tol}\n  actual: ${actual}`);
  }
}

// ───────── Estructura ─────────

test("GRUPOS_SIMPLE tiene 5 grupos", () => {
  assert(Object.keys(GRUPOS_SIMPLE).length === 5, "5 grupos del Art. 908");
});

test("Cada grupo tiene tramos no vacíos con último tramo = Infinity", () => {
  for (const [key, g] of Object.entries(GRUPOS_SIMPLE)) {
    assert(g.tramos && g.tramos.length > 0, `grupo ${key} sin tramos`);
    assert(g.tramos[g.tramos.length - 1].hastaUVT === Infinity, `último tramo de ${key} debe ser Infinity`);
    assert(g.label, `grupo ${key} sin label`);
  }
});

test("TOPE_SIMPLE_UVT = 100000", () => {
  assert(TOPE_SIMPLE_UVT === 100_000);
});

test("EXCLUSIONES_SIMPLE contiene las actividades críticas", () => {
  const codes = EXCLUSIONES_SIMPLE.map(e => e.code);
  assert(codes.includes("financiera"));
  assert(codes.includes("minera"));
  assert(codes.includes("energia"));
  assert(codes.includes("combustibles"));
});

// ───────── Cálculo por tramos ─────────

test("Grupo tiendas: primer tramo ≤ 6000 UVT = 1.2% plano", () => {
  // 5000 UVT × 1.2% = 60 UVT
  const ingreso = 5000 * UVT;
  const { impuesto, tarifaEfectiva } = calcularImpuestoSimple(ingreso, "tiendas_peluquerias", UVT);
  assertClose(impuesto, 60 * UVT, 1, "primer tramo 1.2%");
  assertClose(tarifaEfectiva, 0.012, 0.0001, "tarifa efectiva 1.2%");
});

test("Grupo tiendas: cruza tramos (8000 UVT) aplica marginal correcto", () => {
  // 6000 UVT × 1.2% + 2000 UVT × 2.8% = 72 + 56 = 128 UVT
  const ingreso = 8000 * UVT;
  const { impuesto, tarifaEfectiva } = calcularImpuestoSimple(ingreso, "tiendas_peluquerias", UVT);
  assertClose(impuesto, 128 * UVT, 1, "tramos marginales 1.2% + 2.8%");
  assertClose(tarifaEfectiva, 128 / 8000, 0.0001, "tarifa efectiva 1.6%");
});

test("Grupo tiendas: tramo máximo (>30K UVT) aplica correctamente", () => {
  // 50000 UVT: 6000×1.2% + 9000×2.8% + 15000×4.2% + 20000×5.4% = 72+252+630+1080 = 2034 UVT
  const ingreso = 50000 * UVT;
  const { impuesto } = calcularImpuestoSimple(ingreso, "tiendas_peluquerias", UVT);
  assertClose(impuesto, 2034 * UVT, 1, "cuatro tramos marginales");
});

test("Grupo servicios_profesionales: tarifa al máximo es 13.7%", () => {
  // 50000 UVT: 6000×7.2% + 9000×12% + 35000×13.7% = 432 + 1080 + 4795 = 6307 UVT
  const ingreso = 50000 * UVT;
  const { impuesto, tarifaEfectiva } = calcularImpuestoSimple(ingreso, "servicios_profesionales", UVT);
  assertClose(impuesto, 6307 * UVT, 1);
  assert(tarifaEfectiva > 0.12, "tarifa efectiva alta");
  assert(tarifaEfectiva < 0.138, "no pasa 13.7%");
});

test("Grupo inexistente: fallback a tarifa máxima 13.7% (conservador)", () => {
  const { impuesto, fallback } = calcularImpuestoSimple(100_000_000, "inexistente_xyz", UVT);
  assert(fallback === true, "debe marcar fallback");
  assertClose(impuesto, 100_000_000 * 0.137, 1);
});

test("Ingreso 0: impuesto 0", () => {
  const { impuesto, tarifaEfectiva } = calcularImpuestoSimple(0, "tiendas_peluquerias", UVT);
  assert(impuesto === 0);
  assert(tarifaEfectiva === 0);
});

test("Ingreso justo en el límite de tramo", () => {
  // 6000 UVT exactos: todo en tramo 1 (1.2%)
  const ingreso = 6000 * UVT;
  const { impuesto } = calcularImpuestoSimple(ingreso, "tiendas_peluquerias", UVT);
  assertClose(impuesto, 72 * UVT, 1);
});

test("Desglose retorna el detalle por tramo", () => {
  const { desglose } = calcularImpuestoSimple(8000 * UVT, "tiendas_peluquerias", UVT);
  assert(Array.isArray(desglose), "debe ser array");
  assert(desglose.length >= 2, "debe incluir al menos 2 tramos");
  assert(desglose[0].aporte > 0, "primer tramo debe aportar");
});

// ───────── Comparaciones relevantes para el producto ─────────

test("Comparación: grupo tiendas a 30K UVT es mucho más barato que servicios profesionales", () => {
  const ing = 30000 * UVT;
  const t = calcularImpuestoSimple(ing, "tiendas_peluquerias", UVT);
  const sp = calcularImpuestoSimple(ing, "servicios_profesionales", UVT);
  assert(t.impuesto < sp.impuesto * 0.5, "tiendas < mitad de profesionales");
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
