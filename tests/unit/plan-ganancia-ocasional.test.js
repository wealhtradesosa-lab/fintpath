import { describe, it, expect } from "vitest";
import { planGananciaOcasional } from "../../src/lib/planGananciaOcasional.js";
import { tablaArt70 } from "../../src/lib/normaGananciaOcasional.js";

const empresa = { titular: "juridica", anoCompra: 2011, costo: 3000e6, venta: 9500e6, anoVenta: 2026, avaluoAnterior: 4000e6 };

describe("Reajuste Art. 70", () => {
  it("2011 → ×2,0038 con los decretos de 2012 a 2025", () => {
    const t = tablaArt70(2011, 3000e6);
    expect(t.factor).toBeCloseTo(2.0038, 3);
    expect(t.filas[0]).toMatchObject({ ano: 2012, pct: 3.04 });
    expect(t.filas.at(-1)).toMatchObject({ ano: 2025, pct: 5.81 });
  });
});

describe("Solucionador · empresa (casa construida en 2011)", () => {
  it("hoy 975 MM; con reajuste ≈ 523 MM (gana el camino por compra sobre el avalúo)", () => {
    const r = planGananciaOcasional(empresa);
    expect(r.hoy).toBeCloseTo(975e6, 0);
    expect(r.final / 1e6).toBeCloseTo((9500 - 3000 * 2.00378) * 0.15, 0);
    expect(r.pasos.find((p) => p.id === "avaluo").ahorro).toBe(0);
  });
  it("mejoras se suman al camino por compra", () => {
    const r = planGananciaOcasional({ ...empresa, mejoras: 500e6 });
    expect(r.caminoCompra / 1e6).toBeCloseTo(3000 * 2.00378 + 500, 0);
  });
  it("avalúo y camino por compra NO se suman: gana el mayor", () => {
    const r = planGananciaOcasional({ ...empresa, mejoras: 500e6, avaluoAnterior: 8000e6 });
    expect(r.costoFinal).toBe(8000e6);
    expect(r.final).toBeCloseTo(1500e6 * 0.15, 0);
  });
  it("pérdidas del mismo año se aplican aparte, encima", () => {
    const r = planGananciaOcasional({ ...empresa, avaluoAnterior: 8000e6, perdidas: 200e6 });
    expect(r.costoFinal).toBe(8200e6);
  });
  it("una empresa no muestra pasos de persona", () => {
    const ids = planGananciaOcasional(empresa).pasos.map((p) => p.id);
    expect(ids).not.toContain("factor");
    expect(ids).not.toContain("vivienda");
    expect(ids).toContain("reajuste");
  });
});

describe("Solucionador · persona natural", () => {
  const persona = { titular: "natural", anoCompra: 2008, costo: 200e6, venta: 1200e6, anoVenta: 2026 };
  it("factor 4,16 y exención de vivienda con AFC", () => {
    const r = planGananciaOcasional({ ...persona, vivienda: true, afc: true });
    expect(r.caminoCompra).toBeCloseTo(832e6, 0);
    expect(r.final).toBeCloseTo((368e6 - 5000 * 52374) * 0.15, 0);
    expect(r.pasos.map((p) => p.id)).not.toContain("reajuste");
  });
  it("apagar un paso lo saca del total", () => {
    const r = planGananciaOcasional({ ...persona, usar: { factor: false } });
    expect(r.final).toBeCloseTo(150e6, 0);
  });
});
