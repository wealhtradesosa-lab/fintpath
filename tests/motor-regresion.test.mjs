// ═════════════════════════════════════════════════════════════════════════
// Tests de regresión del motor (taxCO.js)
// ─────────────────────────────────────────────────────────────────────────
// Capturan los IMPUESTOS calculados para casos típicos; cualquier cambio de cifra hace fallar el snapshot.
// Sirven para verificar que casos sin LAB_PRESTACIONES_CESANTIAS se mantienen
// idénticos post-cambio.
// Ejecutar: npm test (vitest). Snapshot en tests/__snapshots__/; si cambia, falla.
// ═════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../src/lib/taxCO.js";

describe("motor-regresion (taxCO)", () => {
it("snapshots de impuestos por caso no cambian", () => {
const snapshots = {};

function capturar(nombre, det) {
  snapshots[nombre] = {
    ingreso: det.ingreso,
    ingLaboral: det.ingLaboral,
    ingNoLaboral: det.ingNoLaboral,
    deducDep: det.deducDep,
    impBruto: det.impBruto,
    impuesto: det.impuesto,
    // a cargo (renglón 'impuesto neto de renta') vs retenciones vs saldo:
    // 'impuesto' es el saldo tras retenciones, no el impuesto a cargo.
    impuestoACargo: det.impuestoACargo,
    retenciones: det.reteN ?? det.retefuenteNat ?? 0,
    saldoACargo: det.saldoACargo,
  };
}

// CASO 1
const user1 = {
  owners: [{ id: "o1", name: "Emp1", type: "natural" }],
  ingresos: [{ id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual: 5_000_000, moneda: "COP", aportes: { pension: 200_000, salud: 200_000 } }],
  gastos: [], deudas: [], inversiones: [],
};
const det1 = estimarImpuesto(user1).detalle.find(d => d.name === "Emp1");
capturar("caso1_empleado_5M_simple", det1);

// CASO 2
const user2 = {
  owners: [{ id: "o1", name: "Emp2", type: "natural", fiscalProfile: { dependientes: { cantidad: 3 }, viviendaResponsablesPct: 100 } }],
  ingresos: [{ id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual: 15_000_000, moneda: "COP", aportes: { pension: 600_000, salud: 600_000 } }],
  gastos: [], deudas: [], inversiones: [],
};
const det2 = estimarImpuesto(user2).detalle.find(d => d.name === "Emp2");
capturar("caso2_empleado_15M_dep", det2);

// CASO 3 (jurídica)
const user3 = {
  owners: [{ id: "j1", name: "SAS1", type: "juridica", regimen: "ordinario" }],
  ingresos: [{ id: "i1", owner: "j1", fiscalCode: "NOL_OTROS", mensual: 50_000_000, moneda: "COP" }],
  gastos: [], deudas: [], inversiones: [],
};
const det3 = estimarImpuesto(user3).detalle.find(d => d.name === "SAS1");
capturar("caso3_juridica_50M", det3);

// DIAGNÓSTICO: con cesantías cargadas
const user4 = {
  owners: [{ id: "o1", name: "EmpCes", type: "natural" }],
  ingresos: [
    { id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual: 5_000_000, moneda: "COP" },
    { id: "i2", owner: "o1", fiscalCode: "LAB_PRESTACIONES_CESANTIAS", mensual: 416_667, moneda: "COP" },
  ],
  gastos: [], deudas: [], inversiones: [],
};
const det4 = estimarImpuesto(user4).detalle.find(d => d.name === "EmpCes");
capturar("caso4_con_cesantias", det4);

console.log("═".repeat(70));
console.log("Snapshots del motor (taxCO)");
console.log("═".repeat(70));
console.log(JSON.stringify(snapshots, null, 2));
console.log("═".repeat(70));
expect(snapshots).toMatchSnapshot();
});
});
