// Snapshot regression test del motor tributario.
//
// Ejecuta los mismos 9 escenarios que verify_tax.mjs, extrae los campos
// numéricos clave, y los compara contra tests/snapshots/tax.json.
//
// Si los números cambian, FALLA y muestra el diff campo a campo.
// Para actualizar el snapshot intencionalmente:
//     node scripts/snapshot_tax.mjs --update
//
// Uso recomendado: correrlo en CI / pre-commit antes de pushear cambios al
// motor. Si fallás, o arreglás el bug que hizo cambiar los números, o
// actualizás el snapshot explícitamente con --update (y justificás por qué
// en el commit message).

import { estimarImpuesto } from "../src/lib/taxCO.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "..", "tests", "snapshots", "tax.json");
const UPDATE = process.argv.includes("--update");

// Escenarios duplicados de verify_tax.mjs para aislamiento.
// Si agregás un escenario acá, también agregalo allá (o mejor: extrae a un
// archivo compartido en el próximo sprint).
const scenarios = [
  {
    id: "s1_lagoon_vacio",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [], gas: {}, deu: [],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    id: "s2_lagoon_arriendos",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gas: {}, deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 668_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    id: "s3_lagoon_depreciacion",
    u: {
      owners: [{ id: "lagoon", name: "Lagoon", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Arriendo", mensual: 453_000_000 / 12, owner: "lagoon", moneda: "COP" }],
      gas: { "Depreciación": [{ c: "Depreciación inmueble", m: 30_000_000 / 12, owner: "lagoon", t: "f" }] },
      deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 668_000_000, ts: 15, owner: "lagoon" }],
      inv: [{ id: "i1", n: "Apto", tp: "Real Estate", va: 1_350_000_000, owner: "lagoon" }],
      trm: 4200,
    },
  },
  {
    id: "s4_sas_dividendos_intersocietarios",
    u: {
      owners: [{ id: "sas", name: "SAS Holding", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Dividendos", mensual: 100_000_000 / 12, owner: "sas", moneda: "COP" }],
      gas: {}, deu: [], inv: [], trm: 4200,
    },
  },
  {
    id: "s5_natural_salario",
    u: {
      owners: [{ id: "per", name: "Persona", type: "natural", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "per", moneda: "COP" }],
      gas: {}, deu: [], inv: [], trm: 4200,
    },
  },
  {
    id: "s6_natural_salario_aportes",
    u: {
      owners: [{ id: "per", name: "Persona", type: "natural", regimen: "ordinario",
        aportes: { pensionObligatoriaMensual: 720_000, saludObligatoriaMensual: 720_000 } }],
      ingresos: [{ id: "i1", categoria: "Salario", mensual: 18_000_000, owner: "per", moneda: "COP" }],
      gas: {}, deu: [], inv: [], trm: 4200,
    },
  },
  {
    id: "s7_natural_mix",
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
    id: "s8_sas_gastos_no_deducibles",
    u: {
      owners: [{ id: "sas", name: "SAS Test", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Otro", mensual: 100_000_000 / 12, owner: "sas", moneda: "COP" }],
      gas: { "Alimentación": [{ c: "Almuerzos socio", m: 5_000_000 / 12, owner: "sas", t: "v" }] },
      deu: [], inv: [], trm: 4200,
    },
  },
  {
    id: "s9_sas_gastos_capacitacion_deducible",
    u: {
      owners: [{ id: "sas", name: "SAS Test", type: "juridica", regimen: "ordinario" }],
      ingresos: [{ id: "i1", categoria: "Otro", mensual: 100_000_000 / 12, owner: "sas", moneda: "COP" }],
      gas: { "Educación": [{ c: "Curso empleados", m: 5_000_000 / 12, owner: "sas", t: "f", fiscalCode: "GAS_JUR_CAPACITACION" }] },
      deu: [], inv: [], trm: 4200,
    },
  },
];

// Extrae los campos numéricos estables que queremos bloquear contra regresión.
// Sólo campos que deberían ser deterministas dado el input. Si un campo nuevo
// aparece en el detalle, agregalo acá conscientemente. Redondeamos a peso
// para evitar falsos positivos por ruido de punto flotante ($107.307.899.9999
// vs $107.307.900 son el mismo valor).
const r$ = (v) => Math.round(Number(v) || 0);

function extractSnapshot(u) {
  const r = estimarImpuesto(u);
  const d = r.detalle[0] || {};
  return {
    totalImpuesto: r$(r.total),
    sinClasificar: r$(r.sinClasificar),
    owner: {
      type: d.type || null,
      ingreso: r$(d.ingreso),
      baseGravable: r$(d.baseGravable),
      impBruto: r$(d.impBruto),
      reteN: r$(d.reteN),
      impuesto: r$(d.impuesto),
      tasa: Math.round((d.tasa || 0) * 10) / 10, // una decimal de tolerancia
      // juridica-specific
      gastosDeduc: r$(d.gastosDeduc),
      intereses: r$(d.intereses),
      deprec: r$(d.deprec),
      // natural-specific
      neto: r$(d.neto),
      noConst: r$(d.noConst),
    },
  };
}

const current = {};
for (const s of scenarios) current[s.id] = extractSnapshot(s.u);

if (UPDATE || !existsSync(SNAPSHOT_PATH)) {
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + "\n");
  console.log(`\n✅ Snapshot ${UPDATE ? "actualizado" : "creado"} en ${SNAPSHOT_PATH}`);
  console.log(`   ${scenarios.length} escenarios, ${Object.keys(current).length} entries.\n`);
  process.exit(0);
}

const saved = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
const diffs = [];

for (const id of Object.keys(current)) {
  const a = saved[id];
  const b = current[id];
  if (!a) { diffs.push({ id, kind: "added", cur: b }); continue; }
  const fieldDiffs = [];
  const flat = (obj, prefix = "") => {
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v !== null && typeof v === "object") Object.assign(out, flat(v, prefix + k + "."));
      else out[prefix + k] = v;
    }
    return out;
  };
  const fa = flat(a), fb = flat(b);
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  for (const k of keys) {
    if (fa[k] !== fb[k]) fieldDiffs.push({ field: k, saved: fa[k], current: fb[k] });
  }
  if (fieldDiffs.length > 0) diffs.push({ id, kind: "changed", fieldDiffs });
}
for (const id of Object.keys(saved)) if (!current[id]) diffs.push({ id, kind: "removed" });

if (diffs.length === 0) {
  console.log(`\n✅ SNAPSHOT OK — ${scenarios.length} escenarios idénticos al snapshot guardado.\n`);
  process.exit(0);
}

console.log("\n❌ SNAPSHOT DIFF DETECTADO\n");
console.log("   Los números del motor cambiaron vs el snapshot guardado.");
console.log("   Si el cambio es intencional, actualizá con: node scripts/snapshot_tax.mjs --update");
console.log("   Si es un bug, arreglalo antes de commitear.\n");

for (const d of diffs) {
  console.log(`  · ${d.id}: ${d.kind}`);
  if (d.kind === "changed") {
    for (const fd of d.fieldDiffs) {
      console.log(`      ${fd.field}:  snapshot=${fd.saved}  →  actual=${fd.current}`);
    }
  }
}
console.log();
process.exit(1);
