// #60 (regla Finanzas/Tributario): las recomendaciones estratégicas se gatean y
// acotan con el IMPUESTO A CARGO (antes de retenciones), no con el saldo, que
// taxCO corta en 0. Una cuenta con saldo a favor igual ve la pensión voluntaria.
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { generarRecomendacionesEstrategicas, AG_RECOS } from "../../src/lib/recomendacionesEstrategicas.js";

const owner = { id: "o1", name: "Luis", type: "natural" };
const user = (salMes, ownerExtra = {}) => ({ trm: 4200, owners: [{ ...owner, ...ownerExtra }], gas: {}, deu: [], inv: [],
  ingresos: [{ id: "sal", owner: "o1", nombre: "Salario", fiscalCode: "LAB_SALARIO", mensual: salMes, tipo: "fijo" }] });

describe("recomendaciones con saldo a favor", () => {
  it("retenciones > impuesto a cargo: sigue la recomendación de pensión voluntaria con ahorro > 0", () => {
    const u = user(15e6); // retención en la fuente automática > impuesto a cargo → saldo a favor
    const det = estimarImpuesto(u, { ag: AG_RECOS }).detalle.find((d) => d.name === "Luis");
    expect(det.impuestoACargo).toBeGreaterThan(500_000);
    expect(det.saldoAPagar ?? det.impuesto).toBe(0);
    expect(det.saldoAFavor).toBeGreaterThan(0);
    const recs = generarRecomendacionesEstrategicas(u, u.owners[0], det);
    const pv = recs.find((r) => r.id === "aporte_pv_estrategico");
    expect(pv).toBeTruthy();
    expect(pv.ahorroAnual.monto).toBeGreaterThan(0);
    expect(pv.ahorroAnual.monto).toBeLessThanOrEqual(det.impuestoACargo);
  });
});
