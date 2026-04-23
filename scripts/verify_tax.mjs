// Verificador del motor tributario CO — corré con: node scripts/verify_tax.mjs
// Objetivo: mostrar números exactos para varios escenarios y probar que Fix A funcionó.
import { estimarImpuesto, UVT } from "../src/lib/taxCO.js";

const fm = (v) => "$" + Math.round(v).toLocaleString("es-CO");

const scenarios = [
  {
    label: "1. Lagoon VACÍO (0 ingresos, 0 gastos) — esperado: impuesto $0",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [],
      gas: {},
      deu: [],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    label: "2. Lagoon CON $453M arriendos, deuda $668M @ 15% — esperado: impuesto ~$107M (Fix A) vs $0 pre-Fix",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gas: {},
      deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    label: "3. Lagoon CON $453M arriendos + depreciación EXPLÍCITA $30M/año (2.22% de $1.35B) — esperado: impuesto menor que escenario 2",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gas: { "Depreciación": [{ c: "Depreciación inmuebles", m: 30_000_000 / 12, owner: "lagoon", t: "f" }] },
      deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    label: "4. SAS con dividendos inter-societarios $100M (Art. 48 ET) — esperado: impuesto $0",
    u: {
      owners: [{ id: "hold", name: "HoldCo", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Dividendos", mensual: 100_000_000 / 12, owner: "hold", moneda: "COP" }],
      gas: {},
      deu: [],
      inv: [],
      trm: 4200,
    },
  },
  {
    label: "5. Persona natural CON salario $18M/mes sin aportes manuales — esperado: impuesto positivo",
    u: {
      owners: [{ id: "sosa", name: "Sosa", type: "natural", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "sosa", moneda: "COP" }],
      gas: {},
      deu: [],
      inv: [],
      trm: 4200,
    },
  },
  {
    label: "6. Persona natural CON salario $18M + aportes MANUALES (pensión $720k + salud $720k) — esperado: impuesto menor que escenario 5 por mayor INCRNGO",
    u: {
      owners: [{
        id: "sosa", name: "Sosa", type: "natural", regimen: "ordinario",
        aportes: { pensionObligatoriaMensual: 720_000, saludObligatoriaMensual: 720_000, salarioEsBruto: true },
      }],
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "sosa", moneda: "COP" }],
      gas: {},
      deu: [],
      inv: [],
      trm: 4200,
    },
  },
];

console.log(`\n═══ VERIFICADOR MOTOR TRIBUTARIO · UVT ${UVT} ═══\n`);
for (const s of scenarios) {
  console.log(`─── ${s.label}`);
  const r = estimarImpuesto(s.u);
  const d = r.detalle[0];
  if (!d) { console.log("  (sin detalle — owner sin ingresos)\n"); continue; }
  console.log(`  ingreso anual: ${fm(d.ingreso)}`);
  if (d.type === "juridica") {
    console.log(`  gastos deduc:  ${fm(d.gastosDeduc || 0)} (incluye depreciación explícita: ${fm(d.deprec || 0)})`);
    console.log(`  intereses:     ${fm(d.intereses || 0)}`);
    console.log(`  base gravable: ${fm(d.baseGravable || 0)}`);
    console.log(`  imp bruto:     ${fm(d.impBruto || 0)}`);
    console.log(`  retención:     ${fm(d.reteN || 0)}`);
    console.log(`  IMP ACTUAL:    ${fm(d.impuesto || 0)}  (tasa efectiva ${(d.tasa || 0).toFixed(1)}%)`);
  } else {
    console.log(`  neto laboral:  ${fm(d.neto || 0)}`);
    console.log(`  INCRNGO total: ${fm(d.noConst || 0)}`);
    console.log(`  base gravable: ${fm(d.baseGravable || 0)}`);
    console.log(`  imp bruto:     ${fm(d.impBruto || 0)}`);
    console.log(`  retefuente:    ${fm(d.reteN || 0)}`);
    console.log(`  IMP ACTUAL:    ${fm(d.impuesto || 0)}  (tasa efectiva ${(d.tasa || 0).toFixed(1)}%)`);
    if (d.aportesManuales) console.log(`  ✓ usó aportes manuales: ${JSON.stringify(d.aportesDesglose)}`);
  }
  console.log();
}
console.log(`TOTAL impuesto escenario combinado (solo el último): ${fm(estimarImpuesto(scenarios[scenarios.length - 1].u).total)}\n`);
