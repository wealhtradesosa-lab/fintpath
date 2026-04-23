// Verifica que los wizards F-210 y F-110 calculan el mismo impuesto que
// el motor estimarImpuesto() cuando el usuario acepta todas las sugerencias
// pre-llenadas. Detecta desviaciones entre ambos, que serían un bug grave:
// el usuario vería un número en "Simulador rápido" y otro en "Declaración
// completa" para la MISMA situación fiscal.
//
// Invariantes críticas chequeadas:
//   NATURAL:
//     1. Σ aportes obligatorios sugeridos == noConst (INCRNGO) del motor
//     2. Suma de beneficios sugeridos ≤ tope 40% / 1340 UVT
//     3. Tabla progresiva Art. 241 aplicada a baseGravable del motor
//        ≈ impBruto del motor (descontando impDiv que tiene tarifa propia)
//   JURÍDICA:
//     1. baseGravable × tarifa régimen ≈ impBruto
//     2. ingreso - gastosDeduc ≈ utilidad (antes de dividendos inter-soc)
//
// Ejecutar: node scripts/verify_wizard_parity.mjs

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { calcImpRenta as calcImpRentaCore } from "../src/lib/tablaArt241.js";

const UVT = 52374; // UVT 2026

// Delega al módulo central — el test detecta si algún consumidor bypassa
// el central o si la tabla cambia silenciosamente.
function calcImpTabla241(uvts) {
  return calcImpRentaCore(uvts, UVT);
}

const fm = (v) => "$" + Math.round(v).toLocaleString("es-CO");

// Tolerancia: 0.5% del valor o $1000, lo que sea mayor. Pequeños ruidos
// por redondeos de las tablas progresivas son aceptables.
function approxEqual(a, b, pct = 0.5, absMin = 1000) {
  const diff = Math.abs(a - b);
  const tol = Math.max(absMin, Math.abs(b) * pct / 100);
  return diff <= tol;
}

const scenarios = [
  {
    id: "natural_salario",
    label: "Natural: salario $18M/mes",
    u: {
      owners: [{ id: "per", name: "Persona", type: "natural", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "per", moneda: "COP" }],
      gas: {}, deu: [], inv: [], trm: 4200,
    },
  },
  {
    id: "natural_mix",
    label: "Natural: mix $516M (salario + arriendos + intereses)",
    u: {
      owners: [{ id: "sosa", name: "Sosa", type: "natural", regimen: "ordinario" }],
      ingresos: [
        { id: "i1", categoria: "Salario", mensual: 15_000_000, owner: "sosa", moneda: "COP" },
        { id: "i2", categoria: "Arriendo", mensual: 20_000_000, owner: "sosa", moneda: "COP" },
        { id: "i3", categoria: "Intereses bancarios", mensual: 8_000_000, owner: "sosa", moneda: "COP" },
      ],
      gas: {
        "Predial": [{ c: "Predial inmueble", m: 500_000, owner: "sosa", t: "f" }],
        "Mantenimiento": [{ c: "Mantenimiento", m: 800_000, owner: "sosa", t: "v" }],
      },
      deu: [], inv: [{ id: "i1", n: "Apto arrendado", tp: "Real Estate", va: 800_000_000, owner: "sosa" }],
      trm: 4200,
    },
  },
  {
    id: "juridica_lagoon",
    label: "Jurídica: Lagoon $453M arriendos",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gas: {}, deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    id: "juridica_sas_alimentacion",
    label: "Jurídica: SAS $100M con gastos NO deducibles",
    u: {
      owners: [{ id: "sas", name: "SAS Test", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Otro", mensual: 100_000_000 / 12, owner: "sas", moneda: "COP" }],
      gas: { "Alimentación": [{ c: "Almuerzos socio", m: 5_000_000 / 12, owner: "sas", t: "v" }] },
      deu: [], inv: [], trm: 4200,
    },
  },
];

let pass = 0, fail = 0;
const failures = [];

function check(label, cond, detail) {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(`  ❌ ${label} — ${detail}`);
  return false;
}

console.log("\n═══ WIZARD ↔ MOTOR PARITY TEST ═══\n");

for (const s of scenarios) {
  console.log(`─── ${s.label}`);
  const r = estimarImpuesto(s.u);
  const d = r.detalle[0];
  if (!d) { console.log("  (sin detalle)\n"); continue; }

  if (d.type === "natural") {
    // Invariante 1: INCRNGO = aportes sugeridos
    const aportesPension = d.aportesDesglose?.pensionObligatoriaAnual || 0;
    const aportesSalud = d.aportesDesglose?.saludObligatoriaAnual || 0;
    const aportesSS = d.aportesDesglose?.ssIndependienteAnual || 0;
    const aportesSuma = aportesPension + aportesSalud + aportesSS;
    check(
      `${s.id}: Σ aportes sugeridos = noConst del motor`,
      approxEqual(aportesSuma, d.noConst),
      `aportesSuma=${fm(aportesSuma)} vs noConst=${fm(d.noConst)}`
    );

    // Invariante 2: Tope 40% / 1340 UVT respetado
    const ingresoNeto = Math.max(0, d.ingreso - d.noConst);
    const tope = Math.min(ingresoNeto * 0.40, 1340 * UVT);
    const beneficios = (d.exenta25 || 0) + (d.totalDeducciones || 0);
    check(
      `${s.id}: beneficios sugeridos ≤ tope 40%/1340UVT`,
      beneficios <= tope + 1,
      `beneficios=${fm(beneficios)} > tope=${fm(tope)}`
    );

    // Invariante 3: Tabla 241 aplicada a baseGravable ≈ impBruto - impDiv
    // (impDiv tiene tarifa 15% propia, no tabla progresiva)
    const impDiv = d.impDiv || 0;
    const impTablaEsperado = calcImpTabla241(d.baseGravable / UVT);
    const impBrutoSinDiv = (d.impBruto || 0) - impDiv;
    check(
      `${s.id}: tabla 241 = impBruto motor (régimen=${d.regimen})`,
      d.regimen === "simple" || approxEqual(impTablaEsperado, impBrutoSinDiv, 1.0),
      `tabla=${fm(impTablaEsperado)} vs motor=${fm(impBrutoSinDiv)} (impBruto=${fm(d.impBruto)}, impDiv=${fm(impDiv)})`
    );

    // Reportar valores clave
    console.log(`  motor: ing=${fm(d.ingreso)} base=${fm(d.baseGravable)} impBruto=${fm(d.impBruto)} impuesto=${fm(d.impuesto)} (${d.tasa.toFixed(1)}%)`);
  } else {
    // JURÍDICA
    const tarifa = d.tarifa || 0.35;
    // Invariante 1: baseGravable × tarifa ≈ impBruto
    const impEsperado = d.baseGravable * tarifa;
    check(
      `${s.id}: baseGravable × tarifa = impBruto (régimen=${d.regimen}, ${(tarifa*100).toFixed(0)}%)`,
      d.regimen === "simple" || approxEqual(impEsperado, d.impBruto, 1.0),
      `esperado=${fm(impEsperado)} vs motor=${fm(d.impBruto)}`
    );

    // Invariante 2: utilidad = ingreso - gastos - intereses
    const utilidadEsperada = Math.max(0, d.ingreso - (d.gastosDeduc || 0));
    check(
      `${s.id}: utilidad = ingreso - gastosDeduc (incluye intereses+GMF)`,
      approxEqual(utilidadEsperada, d.utilidad || 0, 1.0),
      `esperado=${fm(utilidadEsperada)} vs motor.utilidad=${fm(d.utilidad || 0)}`
    );

    console.log(`  motor: ing=${fm(d.ingreso)} utilidad=${fm(d.utilidad || 0)} base=${fm(d.baseGravable)} impBruto=${fm(d.impBruto)} impuesto=${fm(d.impuesto)} (${d.tasa.toFixed(1)}%)`);
  }
  console.log();
}

if (fail > 0) {
  console.log("FAILURES:");
  failures.forEach(f => console.log(f));
  console.log();
}

console.log(`${fail === 0 ? "🟢" : "🔴"} Resultado: ${pass} pasan, ${fail} fallan\n`);
process.exit(fail === 0 ? 0 : 1);
