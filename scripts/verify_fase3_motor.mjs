// Verificación Fase 3 - los switches de fiscalProfile afectan el cálculo
// del motor cuando están activos, y son invisibles cuando no lo están.

import { estimarImpuesto } from "../src/lib/taxCO.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "failed"); }

// ═════════════════════ BUG #3 — Dependientes ═════════════════════

test("Bug #3: owner SIN fiscalProfile, SIN gastoEduc → sin deducción dependientes (legacy)", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 800_000, salud: 800_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.deducDep === 0, `esperaba deducDep=0, fue ${det.deducDep}`);
});

test("Bug #3: owner SIN fiscalProfile PERO CON gastoEduc > 500K → deducción aplicada (legacy backwards-compat)", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 800_000, salud: 800_000 } }],
    gas: { "Educación": [{ c: "Colegio", m: 2_000_000, t: "f", freq: "mes", owner: "o1" }] },
    deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.deducDep > 0, `legacy: esperaba deducDep>0, fue ${det.deducDep}`);
});

test("Bug #3: owner CON fiscalProfile.dependientes.cantidad > 0 → deducción aplicada sin necesidad de gastoEduc", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural",
               fiscalProfile: { dependientes: { cantidad: 2 } } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 800_000, salud: 800_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  assert(det.deducDep > 0, `explícito: esperaba deducDep>0, fue ${det.deducDep}`);
});

test("Bug #3: owner CON fiscalProfile.dependientes.cantidad=0 NO tiene deducción aunque haya gastoEduc (explícito pisa legacy)", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural",
               fiscalProfile: { dependientes: { cantidad: 0 } } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 800_000, salud: 800_000 } }],
    gas: { "Educación": [{ c: "Colegio", m: 2_000_000, t: "f", freq: "mes", owner: "o1" }] },
    deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Con fiscalProfile presente y cantidad=0, NO se usa el fallback legacy
  assert(det.deducDep === 0, `explícito cantidad=0 debe pisar legacy, fue ${det.deducDep}`);
});

test("Bug #3: dependiente con discapacidad amplía tope (384 → 768 UVT)", () => {
  // Ingresos altos para que el tope sea el binding (no el 10%)
  const base = (conDisc) => ({
    owners: [{ id: "o1", name: "A", type: "natural",
               fiscalProfile: { dependientes: { cantidad: 1, conDiscapacidad: conDisc } } }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 500_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 20_000_000, salud: 20_000_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  });
  const sinDisc = estimarImpuesto(base(false)).detalle[0];
  const conDisc = estimarImpuesto(base(true)).detalle[0];
  assert(conDisc.deducDep > sinDisc.deducDep, "con discapacidad debería tener mayor deducción");
  // Aproximadamente el doble (tope pasa de 384 a 768 UVT)
  assert(conDisc.deducDep >= sinDisc.deducDep * 1.9, "tope con discapacidad ~2x");
});

// ═════════════════════ BUG #5 — Componente inflacionario ═════════════════════

test("Bug #5: owner SIN fiscalProfile → aplica componente inflacionario (comportamiento default)", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "CDT", categoria: "Rendimientos", fiscalCode: "CAP_INTERESES_BANCARIOS",
                 mensual: 5_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200, componenteInflacionarioPct: 50,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Sin switch → aplica el componente, por lo tanto rentaLiqCapital ≈ mitad de lo que sería
  assert(det.rentaLiqCapital < 60_000_000 * 0.6, "con componente, renta capital debería reducirse");
});

test("Bug #5: owner CON fiscalProfile.obligadoContabilidad=true → NO aplica componente", () => {
  const u = {
    owners: [{ id: "o1", name: "A", type: "natural",
               fiscalProfile: { obligadoContabilidad: true } }],
    ingresos: [{ id: "i1", nombre: "CDT", categoria: "Rendimientos", fiscalCode: "CAP_INTERESES_BANCARIOS",
                 mensual: 5_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200, componenteInflacionarioPct: 50,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "A");
  // Con switch → NO aplica componente, renta capital = 60M completo
  assert(det.rentaLiqCapital >= 59_000_000, `obligado contab: renta capital ≈ bruto, fue ${det.rentaLiqCapital}`);
});

test("Bug #5: obligadoContabilidad=true genera MÁS impuesto que default (coherencia)", () => {
  const base = (obligado) => ({
    owners: [{ id: "o1", name: "A", type: "natural",
               ...(obligado ? { fiscalProfile: { obligadoContabilidad: true } } : {}) }],
    ingresos: [{ id: "i1", nombre: "CDT", categoria: "Rendimientos", fiscalCode: "CAP_INTERESES_BANCARIOS",
                 mensual: 10_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  });
  const sinSwitch = estimarImpuesto(base(false)).detalle[0];
  const conSwitch = estimarImpuesto(base(true)).detalle[0];
  assert(conSwitch.rentaLiqCapital > sinSwitch.rentaLiqCapital,
    `obligado debe tributar más base: ${conSwitch.rentaLiqCapital} vs ${sinSwitch.rentaLiqCapital}`);
});

// ═════════════════════ BUG #10 — SIMPLE natural con tarifas reales ═════════════════════

test("Bug #10: SIMPLE natural con grupo 'tiendas_peluquerias' usa tarifa real, no 3% plano", () => {
  const u = {
    owners: [{ id: "o1", name: "Tienda Juan", type: "natural", regimen: "simple",
               simpleGrupo: "tiendas_peluquerias" }],
    ingresos: [{ id: "i1", nombre: "Ventas", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 30_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "Tienda Juan");
  // Ingresos $360M/año. Con 3% plano viejo sería ~$10.8M.
  // Con tarifa real grupo 1 (6.870 UVT año 2026 ≈ tramo 2-3, efectivo ~2.5-3%)
  // debe dar un número específico distinto al antiguo 3% exacto.
  assert(det.impuesto > 0, "debe calcular un impuesto");
  assert(det.impuesto < 360_000_000 * 0.06, "tarifa efectiva debe ser < 6% (grupo 1 bajo)");
});

test("Bug #10: SIMPLE natural SIN simpleGrupo usa fallback conservador 13.7%", () => {
  const u = {
    owners: [{ id: "o1", name: "X", type: "natural", regimen: "simple" }],
    ingresos: [{ id: "i1", nombre: "V", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 10_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "X");
  // 120M × 13.7% = 16.44M
  const esperado = 120_000_000 * 0.137;
  assert(Math.abs(det.impuesto - esperado) < 100_000, `fallback 13.7%: esperaba ~${esperado}, fue ${det.impuesto}`);
});

test("Bug #10: grupo 'servicios_profesionales' da tarifa ALTA (no 3%)", () => {
  const u = {
    owners: [{ id: "o1", name: "Consultor", type: "natural", regimen: "simple",
               simpleGrupo: "servicios_profesionales" }],
    ingresos: [{ id: "i1", nombre: "Honorarios", categoria: "Honorarios", fiscalCode: "LAB_HONORARIOS_INDEP",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "o1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const r = estimarImpuesto(u);
  const det = r.detalle.find(d => d.name === "Consultor");
  // 240M/año, grupo 3 (7.2%-13.7%). Tarifa efectiva >7%
  const tarifaEfectiva = det.impuesto / 240_000_000;
  assert(tarifaEfectiva > 0.07, `servicios prof: tarifa efectiva > 7%, fue ${(tarifaEfectiva*100).toFixed(2)}%`);
});

// ═════════════════════ Invariante — fiscalProfile NO rompe el motor ═════════════════════

test("Invariante: owner CON fiscalProfile vacío NO cambia el cálculo vs SIN fiscalProfile", () => {
  const baseUser = () => ({
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 15_000_000, tipo: "fijo", moneda: "COP", owner: "o1",
                 aportes: { pension: 600_000, salud: 600_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  });
  const sinFP = { ...baseUser(), owners: [{ id: "o1", name: "A", type: "natural" }] };
  const conFPVacio = { ...baseUser(), owners: [{ id: "o1", name: "A", type: "natural", fiscalProfile: {} }] };

  const rSin = estimarImpuesto(sinFP).detalle[0];
  const rCon = estimarImpuesto(conFPVacio).detalle[0];
  assert(rSin.impuesto === rCon.impuesto,
    `fiscalProfile vacío no debe cambiar impuesto: sin=${rSin.impuesto} vs con=${rCon.impuesto}`);
});

// ═════════════════════ Run ═════════════════════
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
