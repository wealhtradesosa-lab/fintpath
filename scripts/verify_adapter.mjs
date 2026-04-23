// Verifica que el adapter devuelve valores consistentes con lo que
// OwnerPlan calcula localmente. Test de cobertura de los aliases.
import { adapterOwnerPlan } from "../src/lib/ownerPlanAdapter.js";

const fm = (v) => "$" + Math.round(v).toLocaleString("es-CO");

const scenarios = [
  {
    label: "Jurídica con arriendos (Lagoon-style)",
    props: {
      owner: { id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" },
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gastos: [],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    label: "Natural con salario y aportes",
    props: {
      owner: {
        id: "per", name: "Persona", type: "natural", regimen: "ordinario",
        aportes: { pensionObligatoriaMensual: 720_000, saludObligatoriaMensual: 720_000 },
      },
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "per", moneda: "COP" }],
      gastos: [],
      inv: [],
      deu: [],
      trm: 4200,
    },
  },
  {
    label: "Natural mix (salario + arriendos + rendimientos)",
    props: {
      owner: { id: "sosa", name: "Sosa", type: "natural", regimen: "ordinario" },
      ingresos: [
        { id: "i1", categoria: "Salario", mensual: 15_000_000, owner: "sosa", moneda: "COP" },
        { id: "i2", categoria: "Arriendo", mensual: 20_000_000, owner: "sosa", moneda: "COP" },
        { id: "i3", categoria: "Intereses bancarios", mensual: 8_000_000, owner: "sosa", moneda: "COP" },
      ],
      gastos: [
        { cat: "Predial", c: "Predial", m: 500_000, owner: "sosa", t: "f" },
        { cat: "Mantenimiento", c: "Mant", m: 800_000, owner: "sosa", t: "v" },
      ],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 800_000_000, owner: "sosa" }],
      deu: [],
      trm: 4200,
    },
  },
];

let pass = 0, fail = 0;

function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.log(`  ❌ ${label} — ${detail}`); }
}

console.log("\n═══ TEST DEL ADAPTER OwnerPlan ═══\n");

for (const s of scenarios) {
  console.log(`─── ${s.label}`);
  const c = adapterOwnerPlan(s.props);
  if (!c) { console.log(`  (adapter devolvió null)`); continue; }

  // Aliases comunes que el JSX espera:
  check("ingAnual alias", c.ingAnual === c.ingreso, `${c.ingAnual} vs ${c.ingreso}`);
  check("ahorro alias", c.ahorro === c.ahorroOptimo, `${c.ahorro} vs ${c.ahorroOptimo}`);

  if (c.type === "juridica") {
    check("impActual alias", c.impActual === c.impuesto, `${c.impActual} vs ${c.impuesto}`);
    check("impOptimo alias", c.impOptimo === c.impOptimizado, `${c.impOptimo} vs ${c.impOptimizado}`);
    check("tasaActual alias", c.tasaActual === c.tasa, `${c.tasaActual} vs ${c.tasa}`);
    check("totalDeduc alias", c.totalDeduc === c.gastosDeduc, `${c.totalDeduc} vs ${c.gastosDeduc}`);
    // Cosméticos
    check("patTotal presente", typeof c.patTotal === "number", `got ${typeof c.patTotal}`);
    check("deuTotal presente", typeof c.deuTotal === "number", `got ${typeof c.deuTotal}`);
    check("gastosByCat es objeto", c.gastosByCat && typeof c.gastosByCat === "object", `got ${typeof c.gastosByCat}`);
    console.log(`  ✓ impActual=${fm(c.impActual)} tasa=${c.tasaActual.toFixed(1)}%`);
  } else {
    check("impSin alias", c.impSin === c.impuesto, `${c.impSin} vs ${c.impuesto}`);
    check("impCon alias", c.impCon === c.impOptimizado, `${c.impCon} vs ${c.impOptimizado}`);
    check("tasaSin alias", c.tasaSin === c.tasa, `${c.tasaSin} vs ${c.tasa}`);
    check("deducViv alias", c.deducViv === c.deducVivienda, `${c.deducViv} vs ${c.deducVivienda}`);
    check("benefSin = benAplic motor", c.benefSin === c.benAplic, `${c.benefSin} vs ${c.benAplic}`);
    check("benAplicCon <= lim40", c.benAplicCon <= (c.lim40 || 0), `${c.benAplicCon} > ${c.lim40}`);
    check("benefCon composición", Math.abs(c.benefCon - ((c.exenta25 || 0) + (c.totalDeducciones || 0) + (c.pvMax || 0) + (c.afcMax || 0))) < 1, `benefCon no cuadra`);
    check("gastosDeducNat alias", c.gastosDeducNat === c.totalDeducciones, `${c.gastosDeducNat} vs ${c.totalDeducciones}`);
    console.log(`  ✓ impSin=${fm(c.impSin)} impCon=${fm(c.impCon)} ahorro=${fm(c.ahorro)}`);
  }
}

console.log(`\n${fail === 0 ? "🟢" : "🔴"} Resultado: ${pass} pasan, ${fail} fallan\n`);
process.exit(fail === 0 ? 0 : 1);
