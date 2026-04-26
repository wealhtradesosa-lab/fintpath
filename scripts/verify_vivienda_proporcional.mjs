// Verificación Commit B — Vivienda proporcional a responsables fiscales
// Art. 119 ET: solo se deduce la proporción de intereses correspondiente
// a la responsabilidad legal del declarante.

import { estimarImpuesto } from "../src/lib/taxCO.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "failed"); }

// Helper: builder con salario + deuda de vivienda
function buildOwner(salarioMensual, saldoVivienda, tasaPct, viviendaPct) {
  const fp = {};
  if (viviendaPct != null) fp.viviendaResponsablesPct = viviendaPct;
  return {
    owners: [{ id: "o1", name: "A", type: "natural", fiscalProfile: fp }],
    ingresos: [{
      id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
      mensual: salarioMensual, tipo: "fijo", moneda: "COP", owner: "o1",
      aportes: { pension: 800_000, salud: 800_000 },
    }],
    gas: {},
    deu: [{
      id: "d1", nombre: "Hipoteca", mt: saldoVivienda, ts: tasaPct,
      fiscalCode: "DEU_NAT_VIVIENDA_HABITACIONAL", owner: "o1",
    }],
    inv: [],
    trm: 4200,
  };
}

// Test 1: 100% por defecto (sin campo)
test("Sin viviendaResponsablesPct → 100% (backwards-compat)", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, undefined);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Intereses brutos = 400M × 12% = 48M
  assert(det.interesesHipBruto === 48_000_000, `bruto esperado 48M, fue ${det.interesesHipBruto}`);
  // Sin pct configurado → 100%
  assert(det.viviendaResponsablesPct === 100, `pct esperado 100, fue ${det.viviendaResponsablesPct}`);
  // deducVivienda = 100% de los intereses (con tope 1200 UVT)
  assert(det.deducVivienda === 48_000_000, `deduc esperado 48M, fue ${det.deducVivienda}`);
});

// Test 2: 100% explícito
test("viviendaResponsablesPct=100 → deduce 100%", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, 100);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.deducVivienda === 48_000_000, `100% esperado 48M, fue ${det.deducVivienda}`);
  assert(det.viviendaResponsablesPct === 100);
});

// Test 3: 50% (compartido con pareja)
test("viviendaResponsablesPct=50 → deduce solo la mitad", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, 50);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Intereses brutos = 48M, aplicado 50% = 24M
  assert(det.interesesHipBruto === 48_000_000, `bruto esperado 48M, fue ${det.interesesHipBruto}`);
  assert(det.deducVivienda === 24_000_000, `50% esperado 24M, fue ${det.deducVivienda}`);
  assert(det.viviendaResponsablesPct === 50);
});

// Test 4: 33% (compartido entre 3)
test("viviendaResponsablesPct=33 → deduce ~1/3", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, 33);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // 48M × 33% = 15.84M
  const esperado = 48_000_000 * 0.33;
  assert(Math.abs(det.deducVivienda - esperado) < 1, `33% esperado ~15.84M, fue ${det.deducVivienda}`);
});

// Test 5: 0% inválido → clamp a 0
test("viviendaResponsablesPct=0 → deduc 0", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, 0);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.deducVivienda === 0, `0% esperado 0, fue ${det.deducVivienda}`);
});

// Test 6: pct > 100 → clamp a 100
test("viviendaResponsablesPct=150 → clamp a 100", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, 150);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.viviendaResponsablesPct === 100, `clamp esperado 100, fue ${det.viviendaResponsablesPct}`);
  assert(det.deducVivienda === 48_000_000);
});

// Test 7: pct negativo → clamp a 0
test("viviendaResponsablesPct=-50 → clamp a 0", () => {
  const u = buildOwner(20_000_000, 400_000_000, 12, -50);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.viviendaResponsablesPct === 0, `clamp esperado 0, fue ${det.viviendaResponsablesPct}`);
  assert(det.deducVivienda === 0);
});

// Test 8: tope 1200 UVT respetado aún con 100%
test("Tope 1200 UVT respetado (~63M, UVT 2026 = 52374)", () => {
  // Si los intereses brutos × pct exceden 1200 UVT, se aplica el tope
  // 1200 × 52374 = 62,848,800
  const u = buildOwner(50_000_000, 1_500_000_000, 12, 100);
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // 1500M × 12% = 180M brutos > tope
  assert(det.interesesHipBruto === 180_000_000);
  assert(det.deducVivienda === 1200 * 52374, `tope esperado ${1200 * 52374}, fue ${det.deducVivienda}`);
});

// Test 9: dependientesDeclarados expuesto
test("dependientesDeclarados se expone en det para UI", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural",
      fiscalProfile: { dependientes: { cantidad: 3, conDiscapacidad: false } } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
      mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
      aportes: { pension: 800_000, salud: 800_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.dependientesDeclarados === 3, `esperado 3, fue ${det.dependientesDeclarados}`);
  assert(det.dependientesConDiscapacidad === false);
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
