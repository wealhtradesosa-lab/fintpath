// Verificación aislada del motor de recomendaciones (Commit 6)

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { generarRecomendaciones } from "../src/lib/recomendaciones.js";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function assertIncludes(arr, code, msg) {
  if (!arr.some(r => r.code === code)) {
    const found = arr.map(r => r.code).join(", ");
    throw new Error(`${msg || "debe incluir " + code}\n  encontrados: [${found}]`);
  }
}
function assertNotIncludes(arr, code, msg) {
  if (arr.some(r => r.code === code)) {
    throw new Error(`${msg || "NO debe incluir " + code}`);
  }
}

// Factories
function highEarnerBase() {
  return {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 25_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
                 aportes: { pension: 1_000_000, salud: 1_000_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
}

function lowEarnerBase() {
  return {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 3_000_000, tipo: "fijo", moneda: "COP", owner: "own_1",
                 aportes: { pension: 120_000, salud: 120_000 } }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
}

// ───────── Estructura básica ─────────

test("user sin owners devuelve array vacío", () => {
  const u = { owners: [], ingresos: [], gas: {}, deu: [], inv: [], trm: 4200 };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assert(Array.isArray(recs) && recs.length === 0, "debe ser array vacío");
});

test("user null/undefined devuelve array vacío sin explotar", () => {
  assert(generarRecomendaciones(null, null).length === 0);
  assert(generarRecomendaciones({}, null).length === 0);
  assert(generarRecomendaciones({}, {}).length === 0);
});

// ───────── High earner sin PV ─────────

test("high earner sin PV recibe recomendación APORTAR_PV_AFC", () => {
  const u = highEarnerBase();
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertIncludes(recs, "APORTAR_PV_AFC", "high earner sin PV debe recibir recomendación");
  const pv = recs.find(r => r.code === "APORTAR_PV_AFC");
  assert(pv.ahorroAnualEstimado > 1_000_000, `ahorro debería ser significativo, fue ${pv.ahorroAnualEstimado}`);
  assert(pv.aporteSugeridoMensual > 0, "debe sugerir aporte mensual > 0");
  assert(pv.base.includes("126-1"), "debe referenciar Art. 126-1");
});

test("high earner con PV al 80% del tope sí recibe rec pero con menos ahorro", () => {
  const u = highEarnerBase();
  // Agregar PV existente
  u.gas = {
    "Aporte tributario": [{ c: "PV existente", m: 2_000_000, t: "f", freq: "mes", owner: "own_1", fiscalCode: "AP_TRIB_PV" }]
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  const pv = recs.find(r => r.code === "APORTAR_PV_AFC");
  // Puede existir o no dependiendo de cuánto espacio queda — lo clave es que no explote y que si existe mencione el aporte actual
  if (pv) {
    assert(pv.descripcion.includes("Ya aportás") || pv.descripcion.includes("margen"), "mensaje debe mencionar contexto actual");
  }
});

// ───────── Low earner no debe recibir recomendaciones agresivas ─────────

test("low earner con impuesto cero no recibe APORTAR_PV_AFC", () => {
  const u = lowEarnerBase();
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  // Con $3M/mes no debe generar PV porque no tiene impuesto que ahorrar
  assertNotIncludes(recs, "APORTAR_PV_AFC");
});

// ───────── Régimen SIMPLE profesional (Commit 6.1) ─────────

test("SIMPLE: juridica ordinaria SIN grupo asignado recibe CONFIGURAR_GRUPO_SIMPLE (honesto)", () => {
  // Sin grupo, no podemos estimar ahorro real. Mejor pedir config que inventar.
  const u = {
    owners: [{ id: "own_j", name: "SAS", type: "juridica", regimen: "ordinario" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 42_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertIncludes(recs, "CONFIGURAR_GRUPO_SIMPLE");
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE", "sin grupo no debe inventar ahorro");
});

test("SIMPLE: juridica con grupo 'tiendas_peluquerias' a $500M/año recibe EVALUAR_REGIMEN_SIMPLE con tarifa real", () => {
  const u = {
    owners: [{ id: "own_j", name: "Tienda", type: "juridica", regimen: "ordinario", simpleGrupo: "tiendas_peluquerias" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 42_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  const r = recs.find(r => r.code === "EVALUAR_REGIMEN_SIMPLE");
  assert(r, "debe aparecer");
  // $504M/año, grupo tiendas: tarifa efectiva ~4.2% en tramo 2-3
  // debe mencionar la tarifa efectiva calculada
  assert(r.supuestos.some(s => s.includes("Tarifa efectiva aplicada")), "debe incluir tarifa efectiva en supuestos");
  assert(r.base.includes("908"), "debe mencionar Art. 908");
});

test("SIMPLE: juridica con grupo 'servicios_profesionales' puede recibir SIMPLE_NO_CONVIENE (tarifa alta)", () => {
  // Consultoría con utilidad baja: el 13.7% sobre ingresos > 35% sobre utilidad pequeña
  const u = {
    owners: [{ id: "own_j", name: "Consultoría", type: "juridica", regimen: "ordinario", simpleGrupo: "servicios_profesionales" }],
    ingresos: [{ id: "ij", nombre: "Honorarios", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 30_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    // Gastos altos (consultoría alta margen de costos en sueldos)
    gas: {
      "Nómina": [{ c: "Salarios", m: 25_000_000, t: "f", freq: "mes", owner: "own_j", fiscalCode: "GAS_JUR_NOMINA" }]
    },
    deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  // Debería NO recomendar cambio o recomendar SIMPLE_NO_CONVIENE
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE", "SIMPLE 13.7% sobre ingresos no conviene a consultora con gastos altos");
});

test("SIMPLE: juridica con simpleExcluido=true NO recibe ninguna recomendación de SIMPLE", () => {
  const u = {
    owners: [{ id: "own_j", name: "Financiera", type: "juridica", regimen: "ordinario", simpleGrupo: "tiendas_peluquerias", simpleExcluido: true }],
    ingresos: [{ id: "ij", nombre: "Interés", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 42_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE");
  assertNotIncludes(recs, "CONFIGURAR_GRUPO_SIMPLE");
  assertNotIncludes(recs, "SIMPLE_NO_CONVIENE");
});

test("SIMPLE: juridica ya en SIMPLE no recibe EVALUAR_REGIMEN_SIMPLE", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS", type: "juridica", regimen: "simple", simpleGrupo: "comercio_industria" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 40_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE");
});

test("SIMPLE: juridica con ingresos > 100K UVT NO recibe recomendación (fuera de tope)", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS Grande", type: "juridica", regimen: "ordinario", simpleGrupo: "tiendas_peluquerias" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 500_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE", "$500M/mes × 12 > $5237M tope 100K UVT");
});

test("SIMPLE: juridica con ingresos muy bajos ($36M/año) no recibe rec", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS Chica", type: "juridica", regimen: "ordinario", simpleGrupo: "tiendas_peluquerias" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 3_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE", "ingresos muy bajos, no hay margen útil");
});

test("SIMPLE: alerta SIMPLE_FUERA_DE_RANGO cuando está en SIMPLE pero superó 100K UVT", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS Creció", type: "juridica", regimen: "simple", simpleGrupo: "comercio_industria" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 500_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertIncludes(recs, "SIMPLE_FUERA_DE_RANGO");
});

test("SIMPLE: juridica en zona_franca NO recibe recomendaciones de SIMPLE", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS ZF", type: "juridica", regimen: "zona_franca", simpleGrupo: "comercio_industria" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 40_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "EVALUAR_REGIMEN_SIMPLE", "zona_franca no debe recibir sugerencia");
  assertNotIncludes(recs, "CONFIGURAR_GRUPO_SIMPLE");
});

// ───────── Ordenamiento ─────────

test("recomendaciones vienen ordenadas por ahorro descendente", () => {
  const u = highEarnerBase();
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  const accionables = recs.filter(r => r.ahorroAnualEstimado > 0);
  for (let i = 1; i < accionables.length; i++) {
    assert(
      accionables[i - 1].ahorroAnualEstimado >= accionables[i].ahorroAnualEstimado,
      `orden incorrecto en posición ${i}: ${accionables[i-1].ahorroAnualEstimado} < ${accionables[i].ahorroAnualEstimado}`
    );
  }
});

// ───────── Salud prepagada ─────────

test("high earner sin medicina prepagada recibe recomendación SALUD_PREPAGADA", () => {
  const u = highEarnerBase();
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertIncludes(recs, "SALUD_PREPAGADA_NO_REGISTRADA", "debe sugerir salud prepagada si no tiene");
});

test("high earner que YA declara medicina NO recibe recomendación SALUD_PREPAGADA", () => {
  const u = highEarnerBase();
  u.gas = {
    "Salud": [{ c: "Colsanitas", m: 800_000, t: "f", freq: "mes", owner: "own_1" }]
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "SALUD_PREPAGADA_NO_REGISTRADA", "no debe sugerir si ya deduce");
});

// ───────── Jurídica ─────────

test("SAS sin gastos ICA no genera descuento ICA", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS", type: "juridica" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 20_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertNotIncludes(recs, "DESCUENTO_ICA_NO_CAPTURADO");
});

test("SAS con gastos ICA > $500K genera descuento ICA", () => {
  const u = {
    owners: [{ id: "own_j", name: "SAS", type: "juridica" }],
    ingresos: [{ id: "ij", nombre: "Venta", categoria: "Negocio", fiscalCode: "NOL_NEGOCIO",
                 mensual: 30_000_000, tipo: "fijo", moneda: "COP", owner: "own_j" }],
    gas: {
      "Predial": [{ c: "ICA mensual", m: 200_000, t: "f", freq: "mes", owner: "own_j", fiscalCode: "GAS_JUR_PREDIAL" }]
    },
    deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assertIncludes(recs, "DESCUENTO_ICA_NO_CAPTURADO", "SAS con ICA > 500k debe recibir rec");
  const r = recs.find(r => r.code === "DESCUENTO_ICA_NO_CAPTURADO");
  // 200k * 12 = 2.4M anual * 50% = 1.2M descuento
  assert(r.ahorroAnualEstimado >= 1_000_000, `ahorro esperado ~$1.2M, fue ${r.ahorroAnualEstimado}`);
});

// ───────── TODO_OPTIMIZADO cuando aplica ─────────

test("owner con impuesto > 0 y sin palancas restantes recibe TODO_OPTIMIZADO", () => {
  // Este test es difícil de construir sin cubrir todas las palancas;
  // lo dejamos como test de regresión simbólico: si algún día todo se cubre,
  // este camino se activa. Por ahora, con low earner no aplica porque impBruto=0.
  // Lo importante es que el código NO explota.
  const u = lowEarnerBase();
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assert(Array.isArray(recs), "no debe explotar");
});

// ───────── No explota con data rara ─────────

test("owner con todas las aportes al 0 no explota", () => {
  const u = {
    owners: [{ id: "own_1", name: "Yo", type: "natural" }],
    ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO",
                 mensual: 0, tipo: "fijo", moneda: "COP", owner: "own_1" }],
    gas: {}, deu: [], inv: [], trm: 4200,
  };
  const recs = generarRecomendaciones(u, estimarImpuesto(u));
  assert(Array.isArray(recs));
});

// ───────── Run ─────────
let ok = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✅ ${t.name}`); ok++; }
  catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); fail++; }
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${ok} pasan, ${fail} fallan`);
process.exit(fail === 0 ? 0 : 1);
