// ═══════════════════════════════════════════════════════════════════════════
// VERIFY FLUJO DECLARACIÓN (end-to-end)
// ─────────────────────────────────────────────────────────────────────────
// Test end-to-end del flujo completo de declaración de renta:
//   1. Usuario tiene un owner con declaraciones anteriores (2023 y 2024)
//   2. En 2025 configura sus ingresos/gastos actuales
//   3. Motor estimarImpuesto calcula impuesto 2025
//   4. Detector de alertas compara 2025 vs 2024 y detecta señales
//   5. Detector de patrones cruzados detecta inconsistencias
//   6. Detector de tendencia compara 2025 vs pendiente 2023-2024
//
// Este test garantiza que un refactor a cualquiera de estos módulos no
// rompa silenciosamente el flujo end-to-end. Corre rápido (~2s) y se
// integra al pre-commit hook.
// ═══════════════════════════════════════════════════════════════════════════

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { calcAlertasAnoAnterior, calcPatronesAnomalos, calcPatronesTendencia, proyectarSiguienteAno } from "../src/lib/alertasCore.js";

const fm = (v) => "$" + Math.round(v).toLocaleString("es-CO");

let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail) {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(`  ❌ ${label} — ${detail}`);
  return false;
}

console.log("\n═══ FLUJO DECLARACIÓN END-TO-END ═══\n");

// ─────────────────────────────────────────────────────────────────────────
// Escenario: Santiago persona natural con salario + arriendos
// Historial: 2023 y 2024 con impuesto creciente ~15%/año
// En 2025 subieron ingresos 25% pero olvidó cargar retenciones
// ─────────────────────────────────────────────────────────────────────────

const user = {
  owners: [{ id: "sosa", name: "Santiago", type: "natural", regimen: "ordinario" }],
  ingresos: [
    { id: "i1", categoria: "Salario", mensual: 20_000_000, owner: "sosa", moneda: "COP" },
    { id: "i2", categoria: "Arriendo", mensual: 10_000_000, owner: "sosa", moneda: "COP" },
  ],
  gas: {
    "Predial": [{ c: "Predial", m: 300_000, owner: "sosa", t: "f" }],
  },
  deu: [],
  inv: [{ id: "inv1", n: "Apto", tp: "Real Estate", va: 500_000_000, owner: "sosa" }],
  trm: 4200,
};

// Historial: 2023 y 2024
const declaracion2023 = {
  tipo: "F210",
  anoGravable: "2023",
  renglones: {
    salarios: 180_000_000,
    arrendamientos: 96_000_000,
    aportesObligatorios: 7_200_000,
    exenta25: 30_000_000,
    interesesVivienda: 8_000_000,
    dependientes: 15_000_000,
    retenciones: 9_000_000,
    impuestoRenta: 42_000_000,
  },
};
const declaracion2024 = {
  tipo: "F210",
  anoGravable: "2024",
  renglones: {
    salarios: 200_000_000,
    arrendamientos: 100_000_000,
    aportesObligatorios: 8_000_000,
    exenta25: 35_000_000,
    interesesVivienda: 9_000_000,
    dependientes: 18_000_000,
    retenciones: 10_500_000,
    impuestoRenta: 48_000_000,
  },
};

console.log("─── Setup: Persona natural con 2 años de historial (2023, 2024)");

// PASO 1: Motor calcula impuesto 2025
const resultado = estimarImpuesto(user);
const detalle2025 = resultado.detalle[0];
check(
  "Motor calcula impuesto 2025 > 0",
  detalle2025 && detalle2025.impuesto > 0,
  `impuesto=${fm(detalle2025?.impuesto || 0)}`
);
check(
  "Ingresos anuales 2025 = salarios + arriendos",
  detalle2025?.ingreso === 360_000_000,
  `ing=${fm(detalle2025?.ingreso || 0)} vs esperado $360M`
);

console.log(`  2025 motor: ing=${fm(detalle2025?.ingreso || 0)} impuesto=${fm(detalle2025?.impuesto || 0)} tasa=${detalle2025?.tasa?.toFixed(1)}%`);

// PASO 2: Mapear el "anterior" como lo hace F-210
const anterior2024 = {
  anoGravable: declaracion2024.anoGravable,
  salarios: +declaracion2024.renglones.salarios || 0,
  retenciones: +declaracion2024.renglones.retenciones || 0,
  impuestoRenta: +declaracion2024.renglones.impuestoRenta || 0,
  interesesVivienda: +declaracion2024.renglones.interesesVivienda || 0,
  dependientes: +declaracion2024.renglones.dependientes || 0,
};

// PASO 3: Valores "actual" — simulamos que el usuario OLVIDÓ cargar retenciones
const actualSinRetenciones = {
  ingresos: 360_000_000,
  retenciones: 0, // Olvidó cargar
  impuesto: detalle2025.impuesto,
  interesesVivienda: 0, // También olvidó
  dependientes: 18_000_000,
  salarios: 240_000_000,
};

// PASO 4: Alertas de delta
const alertas = calcAlertasAnoAnterior([
  { label: "Retenciones", actual: actualSinRetenciones.retenciones, anterior: anterior2024.retenciones, sugerencia: "test" },
  { label: "Impuesto", actual: actualSinRetenciones.impuesto, anterior: anterior2024.impuestoRenta, sugerencia: "test" },
]);
check(
  "Alerta de delta detecta retenciones bajando >50%",
  alertas.some(a => a.label === "Retenciones" && a.severity === "critical"),
  `alertas=${JSON.stringify(alertas.map(a => ({ l: a.label, s: a.severity })))}`
);

// PASO 5: Patrones cruzados
const patrones = calcPatronesAnomalos({
  actual: actualSinRetenciones,
  anterior: {
    ingresos: 300_000_000,
    retenciones: anterior2024.retenciones,
    impuesto: anterior2024.impuestoRenta,
    interesesVivienda: anterior2024.interesesVivienda,
    dependientes: anterior2024.dependientes,
  },
});
check(
  "Patrón cruzado: ingresos↑ pero retenciones = 0 (CRITICAL)",
  patrones.some(p => p.severity === "critical" && /retenciones|Sin retenciones/i.test(p.label)),
  `patrones=${JSON.stringify(patrones.map(p => ({ l: p.label, s: p.severity })))}`
);
check(
  "Patrón cruzado: intereses vivienda desaparecieron",
  patrones.some(p => /vivienda/i.test(p.label)),
  "no se detectó patrón de vivienda"
);

// PASO 6: Tendencia multi-año
const serie = [
  { anoGravable: "2023", ingresos: 276_000_000, retenciones: 9_000_000, impuesto: 42_000_000 },
  { anoGravable: "2024", ingresos: 300_000_000, retenciones: 10_500_000, impuesto: 48_000_000 },
];
const tendencias = calcPatronesTendencia({
  serie,
  actual: actualSinRetenciones,
});
check(
  "Tendencia detecta al menos 1 variable rompiendo pendiente histórica",
  tendencias.length >= 1,
  `tendencias=${JSON.stringify(tendencias.map(t => t.label))}`
);

// PASO 7: Proyección del siguiente año
const proyImp = proyectarSiguienteAno(
  [...serie, { impuesto: actualSinRetenciones.impuesto }].filter(s => s.impuesto > 0),
  "impuesto"
);
check(
  "Proyección del siguiente año calcula pendiente",
  proyImp !== null && typeof proyImp.pendientePct === "number",
  `proyImp=${JSON.stringify(proyImp)}`
);

// ─────────────────────────────────────────────────────────────────────────
// Escenario negativo: sin historial → no deben haber patrones
// ─────────────────────────────────────────────────────────────────────────

const sinHistorial = calcPatronesTendencia({ serie: [], actual: { impuesto: 10e6 } });
check(
  "Sin historial: calcPatronesTendencia devuelve array vacío",
  Array.isArray(sinHistorial) && sinHistorial.length === 0,
  `resultado=${JSON.stringify(sinHistorial)}`
);

const proyectarSinDatos = proyectarSiguienteAno([], "impuesto");
check(
  "Sin datos: proyectarSiguienteAno devuelve null",
  proyectarSinDatos === null,
  `resultado=${JSON.stringify(proyectarSinDatos)}`
);

// ─────────────────────────────────────────────────────────────────────────
// RESULTADO
// ─────────────────────────────────────────────────────────────────────────

if (fail > 0) {
  console.log("\nFAILURES:");
  failures.forEach(f => console.log(f));
}

console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${pass} pasan, ${fail} fallan\n`);
process.exit(fail === 0 ? 0 : 1);
