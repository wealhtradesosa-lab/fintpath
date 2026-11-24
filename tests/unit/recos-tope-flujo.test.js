// 23-nov-2026 (regla Finanzas) — Ninguna sugerencia de aporte, vehículo o
// formación supera el flujo libre del año tras el fondo de emergencia. Sin dato
// de flujo, no se sugiere monto. Y sin TRM, las recomendaciones no usan 4200.
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ flujo: null }));
vi.mock("../../src/lib/sugerenciaPvAfc.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, flujoLibreTrasEmergencia: () => (h.flujo === undefined ? null : { flujoLibreAnual: h.flujo }) };
});

const { estimarImpuesto } = await import("../../src/lib/taxCO.js");
const { generarRecomendacionesEstrategicas, AG_RECOS } = await import("../../src/lib/recomendacionesEstrategicas.js");

const IDS = ["aporte_pv_estrategico", "cuenta_afc", "vehiculo_productivo_sociedad", "capacitacion_empleados"];
const natural = { id: "o1", name: "Luis", type: "natural" };
const sociedad = { id: "s1", name: "Lagoon SAS", type: "juridica" };
const userNat = { trm: 4000, owners: [natural], gas: {}, deu: [], inv: [],
  ingresos: [{ id: "sal", owner: "o1", nombre: "Salario", fiscalCode: "LAB_SALARIO", mensual: 40e6, tipo: "fijo" }] };
const detJur = { name: "Lagoon SAS", ingreso: 2e9, impuestoACargo: 300e6, impBruto: 300e6, ingLaboral: 0, ingNoLaboral: 0, divAnual: 0 };

const recos = () => {
  const detNat = estimarImpuesto(userNat, { ag: AG_RECOS }).detalle.find((d) => d.name === "Luis");
  return [
    ...generarRecomendacionesEstrategicas(userNat, natural, detNat),
    ...generarRecomendacionesEstrategicas({ trm: 4000, owners: [sociedad], gas: {}, deu: [], inv: [], ingresos: [] }, sociedad, detJur),
  ].filter((r) => IDS.includes(r.id));
};

describe("tope de flujo libre en aportes, vehículo y formación", () => {
  beforeEach(() => { h.flujo = null; });

  it("flujo libre tras emergencia = 10.000.000: ninguna sugerencia lo supera", () => {
    h.flujo = 10_000_000;
    const rs = recos();
    expect(rs.map((r) => r.id)).toEqual(expect.arrayContaining(["vehiculo_productivo_sociedad", "capacitacion_empleados", "aporte_pv_estrategico"]));
    for (const r of rs) expect(r.inversion.monto, r.id).toBeLessThanOrEqual(10_000_000);
    expect(rs.find((r) => r.id === "vehiculo_productivo_sociedad").inversion.monto).toBe(10_000_000);
    expect(rs.find((r) => r.id === "capacitacion_empleados").inversion.monto).toBe(10_000_000);
  });

  it("sin dato de flujo (null): no hay sugerencia de aporte, vehículo ni formación", () => {
    h.flujo = null;
    const rs = recos();
    expect(rs.find((r) => r.id === "vehiculo_productivo_sociedad")).toBeUndefined();
    expect(rs.find((r) => r.id === "capacitacion_empleados")).toBeUndefined();
    for (const r of rs) expect(r.inversion.monto, r.id).toBe(0); // PV/AFC: la tarjeta explica, sin monto
    const pv = rs.find((r) => r.id === "aporte_pv_estrategico");
    expect(pv.accion).toMatch(/no te sugerimos un monto/);
  });

  it("flujo 0: tampoco se sugiere vehículo ni formación", () => {
    h.flujo = 0;
    const rs = recos();
    expect(rs.find((r) => r.id === "vehiculo_productivo_sociedad")).toBeUndefined();
    expect(rs.find((r) => r.id === "capacitacion_empleados")).toBeUndefined();
  });
});

describe("recomendaciones sin TRM", () => {
  it("no convierten los USD con 4200: quedan por fuera y el perfil dice pendiente de tasa", async () => {
    h.flujo = 10_000_000;
    const { analizarPerfil } = await import("../../src/lib/recomendacionesEstrategicas.js");
    const base = { owners: [sociedad], gas: {}, ingresos: [],
      inv: [{ owner: "s1", va: 100_000, moneda: "USD" }, { owner: "s1", va: 10_000_000 }],
      deu: [{ owner: "s1", mt: 1_000, moneda: "USD" }, { owner: "s1", mt: 2_000_000 }] };
    for (const trm of [undefined, 0, 4200]) {
      const p = analizarPerfil(sociedad, detJur, { ...base, trm });
      expect(p.patrimonioAprox).toBe(10_000_000);
      expect(p.deudasTotal).toBe(2_000_000);
      expect(p.pendienteTasa).toBe(true);
    }
    const con = analizarPerfil(sociedad, detJur, { ...base, trm: 4000 });
    expect(con.patrimonioAprox).toBe(410_000_000);
    expect(con.deudasTotal).toBe(6_000_000);
    expect(con.pendienteTasa).toBe(false);
    expect(generarRecomendacionesEstrategicas({ ...base }, sociedad, detJur).length).toBeGreaterThan(0);
  });
});
