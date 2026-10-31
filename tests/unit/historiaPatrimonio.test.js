import { describe, it, expect } from "vitest";
import { registrarMes, resumenHistoria, fotoPatrimonio } from "../../src/lib/historiaPatrimonio.js";

describe("historiaPatrimonio", () => {
  const d = { trm: 4000, inv: [{ va: 100 }, { va: 10, moneda: "USD" }, { va: 999, sim: false }], deu: [{ mt: 40 }] };
  it("convierte dólares a la TRM y excluye lo no simulado", () => {
    expect(fotoPatrimonio(d)).toEqual({ a: 40100, de: 40, nw: 40060 });
  });
  it("sin TRM y con dólares no inventa un punto", () => {
    expect(fotoPatrimonio({ ...d, trm: null })).toBeNull();
  });
  it("un punto por mes; el del mes en curso se reescribe", () => {
    const a = registrarMes(d, { ahora: new Date(2026, 9, 5) });
    const b = registrarMes({ ...a, deu: [{ mt: 60 }] }, { ahora: new Date(2026, 9, 30) });
    expect(b.historiaPatrimonio).toHaveLength(1);
    expect(b.historiaPatrimonio[0].nw).toBe(40040);
    const c = registrarMes(b, { ahora: new Date(2026, 10, 2) });
    expect(c.historiaPatrimonio.map((p) => p.k)).toEqual(["2026-10", "2026-11"]);
    expect(registrarMes(c, { ahora: new Date(2026, 10, 2) })).toBe(c);
  });
  it("resumen: cambio del mes y del año", () => {
    const h = [{ k: "2025-10", nw: 100 }, { k: "2026-09", nw: 150 }, { k: "2026-10", nw: 160 }];
    const r = resumenHistoria(h);
    expect(r.mes.cambio).toBe(10);
    expect(r.ano.cambio).toBe(60);
    expect(resumenHistoria([h[0]]).mes).toBeNull();
  });
});
