// Art. 336 ET: el 40 % se calcula sobre toda la cédula general (trabajo +
// capital + no laborales − INCRNGO); el tope de 1.340 UVT es uno solo. La
// exenta del 25 % (Art. 206-10) sigue siendo solo laboral. Spec Tributario 19-oct-2026.
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";

const user = (ingresos, gas = {}) => ({ trm: 4200, owners: [{ id: "o1", name: "Luis", type: "natural" }], ingresos, gas, deu: [], inv: [] });
const ing = (fc, mensual, id = fc) => ({ id, owner: "o1", nombre: fc, fiscalCode: fc, mensual, tipo: "fijo" });
const sal = (m) => ing("LAB_SALARIO", m, "sal");
const pv = (m) => ({ "Aporte tributario": [{ owner: "o1", fiscalCode: "AP_TRIB_PV", m }] });
const det = (u) => estimarImpuesto(u, { ag: 2025 }).detalle.find(d => d.name === "Luis");

describe("Art. 336: base del 40 % = toda la cédula general", () => {
  it("1) solo laboral: la base es el neto laboral (sin cambio frente a hoy)", () => {
    for (const m of [8e6, 15e6, 30e6]) {
      const d = det(user([sal(m)], pv(2e6)));
      expect(d.baseArt336).toBeCloseTo(d.neto, 0);
      expect(d.lim40Pct).toBeCloseTo(d.neto * 0.4, 0);
    }
    // Valores de main (a9e00bc) para estos casos
    expect(Math.round(det(user([sal(8e6)])).impBruto)).toBe(2792067);
    expect(Math.round(det(user([sal(8e6)], pv(2e6))).impBruto)).toBe(192867);
    expect(Math.round(det(user([sal(15e6)], pv(4e6))).impBruto)).toBe(11771775);
  });

  it("2) laboral + $22,8 M de arriendo: el 40 % va sobre la suma, máx. 1.340 UVT", () => {
    const solo = det(user([sal(8e6)], pv(2e6)));
    const d = det(user([sal(8e6), ing("CAP_ARRENDAMIENTO", 1_900_000, "arr")], pv(2e6)));
    expect(d.baseArt336).toBeCloseTo(solo.neto + 22_800_000, 0);
    expect(d.lim40Pct).toBeCloseTo((solo.neto + 22_800_000) * 0.4, 0);
    expect(d.lim40).toBeCloseTo(Math.min(d.lim40Pct, d.lim1340), 0);
    expect(d.lim40).toBeLessThanOrEqual(d.lim1340);
    // 25 % sigue solo laboral: el arriendo no lo sube (solo baja por el GMF deducible sobre ingAnual, preexistente)
    expect(d.exenta25).toBeLessThanOrEqual(solo.exenta25);
    expect(solo.exenta25 - d.exenta25).toBeCloseTo(22_800_000 * 0.004 * 0.5 * 0.25, 0);
    const alto = det(user([sal(30e6), ing("CAP_ARRENDAMIENTO", 1_900_000, "arr")], pv(8e6)));
    expect(alto.lim40).toBe(alto.lim1340);
  });

  it("3) laboral + rendimiento: el tope sube o se queda, nunca baja", () => {
    for (const [m, r] of [[8e6, 1e6], [6e6, 2e6], [40e6, 3e6]]) {
      const a = det(user([sal(m)], pv(2e6)));
      const b = det(user([sal(m), ing("CAP_INTERESES_BANCARIOS", r)], pv(2e6)));
      expect(b.lim40).toBeGreaterThanOrEqual(a.lim40);
      // el componente inflacionario (INCRNGO) no entra a la base
      expect(b.baseArt336).toBeCloseTo(a.neto + r * 12 * (1 - 0.5088), 0);
    }
  });
});
