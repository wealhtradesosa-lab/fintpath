import { describe, it, expect } from "vitest";
import { rentabilidadActivos } from "../../src/lib/rentabilidadActivo.js";
const valor = (i) => i.va;
describe("rentabilidadActivos", () => {
  const act = [
    { id: "a", va: 1000, valorizacionPct: 4 },        // renta 100, gastos 20 → 8 % + 4 % = 12 %
    { id: "b", va: 1000 },                             // sin dato
    { id: "c", va: 1000, tasa: 3 },                    // 3 % < inflación
    { id: "d", va: 1000 },                             // gastos 50, sin renta → pierde
  ];
  const r = rentabilidadActivos(act, { valor, rentaAnual: { a: 100 }, gastoAnual: { a: 20, d: 50 }, inflacion: 5 });
  it("ordena y clasifica", () => {
    expect(r.conDato.map((f) => [f.id, f.estado, Math.round(f.pct)])).toEqual([["a", "gana", 12], ["c", "bajo_inflacion", 3], ["d", "pierde", -5]]);
    expect(r.sinDato.map((f) => f.id)).toEqual(["b"]);
    expect(r.nPierden).toBe(1);
    expect(r.nBajoInflacion).toBe(1);
  });
  it("la renta vinculada manda sobre la tasa escrita", () => {
    const x = rentabilidadActivos([{ id: "z", va: 1000, tasa: 50 }], { valor, rentaAnual: { z: 60 }, inflacion: 5 });
    expect(Math.round(x.conDato[0].pct)).toBe(6);
  });
});
