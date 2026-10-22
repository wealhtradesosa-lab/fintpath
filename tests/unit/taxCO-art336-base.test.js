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

describe("PV + AFC: un solo tope de 30 % / 3.800 UVT (Art. 126-1 / 126-4) antes del 336", () => {
  const gas = (pvM, afcM = 0) => ({ "Aporte tributario": [
    ...(pvM ? [{ owner: "o1", fiscalCode: "AP_TRIB_PV", m: pvM }] : []),
    ...(afcM ? [{ owner: "o1", fiscalCode: "AP_TRIB_AFC", m: afcM }] : []),
  ] });
  // Salario 10 M/mes → neto laboral 115,2 M/año → 30 % = 34,56 M/año
  const NETO = 115_200_000, TOPE = NETO * 0.30;

  it("salario 10 M: un aporte del 35 % se recorta al 30 %", () => {
    const d = det(user([sal(10e6)], gas((NETO * 0.35) / 12)));
    expect(d.pvAfcMax).toBeCloseTo(TOPE, 0);
    expect(d.pvAfcAplicado).toBeCloseTo(TOPE, 0);
  });

  it("PV 20 % + AFC 15 % = 35 % → el combinado se recorta al 30 %", () => {
    const d = det(user([sal(10e6)], gas((NETO * 0.20) / 12, (NETO * 0.15) / 12)));
    expect(d.pvAfcAplicado).toBeCloseTo(TOPE, 0);
    const soloPv = det(user([sal(10e6)], gas((NETO * 0.35) / 12)));
    expect(d.impBruto).toBe(soloPv.impBruto);
  });

  it("ingreso alto: el tope combinado llega a 3.800 UVT", () => {
    const d = det(user([sal(80e6)], gas(80e6 * 0.35, 0)));
    expect(d.pvAfcMax).toBeLessThan(d.neto * 0.30);
    expect(d.pvAfcAplicado).toBe(d.pvAfcMax);
    expect(d.pvAfcMax / 3800).toBeGreaterThan(40_000); // 3.800 UVT en pesos
  });

  it("salario 10 M: el impuesto baja con el aporte hasta que se llena el tope (aquí manda el 40 % del 336)", () => {
    const imp = (m) => Math.round(det(user([sal(10e6)], gas(m))).impBruto);
    const [a0, a05, a1] = [imp(0), imp(0.5e6), imp(1e6)];
    expect(a0).toBeGreaterThan(a05);
    expect(a05).toBeGreaterThan(a1);
    // A 2,5 / 3 / 3,5 M el bag ya llegó a lim40 (46,08 M): el 336 recorta antes que el 30 %.
    const d = det(user([sal(10e6)], gas(2.5e6)));
    expect(d.pctUsado).toBeCloseTo(100, 6);
    expect(imp(2.5e6)).toBe(imp(3e6));
    expect(imp(3e6)).toBe(imp(3.5e6));
    // aporte de 2,5 M queda dentro del 30 %; 3 y 3,5 M se recortan a 34,56 M
    expect(d.pvAfcAplicado).toBe(30_000_000);
    expect(det(user([sal(10e6)], gas(3.5e6))).pvAfcAplicado).toBeCloseTo(TOPE, 0);
  });
});
