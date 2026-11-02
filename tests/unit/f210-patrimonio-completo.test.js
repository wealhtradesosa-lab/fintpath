// 1-nov-2026 — El patrimonio bruto del borrador F-210 incluye todos los
// activos (no solo inmuebles), a su valor fiscal, sin depender de mayúsculas,
// y la obligación de declarar por patrimonio (4.500 UVT) se mide contra el total.
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import {
  generarBorradorF210, obligacionPorPatrimonio, renglonPatrimonioDe, valorFiscalActivo, valorFiscalInmueble,
} from "../../src/lib/borradorDeclaracionF210.js";

const owner = { id: "o1", name: "QA", type: "natural" };
const borrador = (inv) => {
  const user = {
    owners: [owner],
    ingresos: [{ id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual: 4_000_000, moneda: "COP" }],
    inv, deu: [],
  };
  const est = estimarImpuesto(user, { añoGravable: 2025 });
  const r = generarBorradorF210(user, owner, est, 2025);
  return { r, g: (n) => r.find((x) => x.numero === n)?.valor ?? 0, r29: r.find((x) => x.numero === 29) };
};

describe("F-210 · patrimonio bruto con todos los activos", () => {
  it("casa + efectivo + acciones + cripto: el patrimonio bruto es la suma", () => {
    const { g } = borrador([
      { id: "a1", owner: "o1", tp: "Real Estate", vc: 300_000_000, va: 350_000_000 },
      { id: "a2", owner: "o1", tp: "Cash", va: 20_000_000 },
      { id: "a3", owner: "o1", tp: "Acciones", vc: 30_000_000, va: 40_000_000 },
      { id: "a4", owner: "o1", tp: "Crypto", vc: 10_000_000, va: 15_000_000 },
    ]);
    expect(g(291)).toBe(20_000_000);   // efectivo: saldo
    expect(g(292)).toBe(30_000_000);   // acciones: costo fiscal (Art. 272 ET)
    expect(g(293)).toBe(300_000_000);  // casa: costo fiscal, no el comercial (Art. 277)
    expect(g(294)).toBe(10_000_000);   // cripto: costo de adquisición
    expect(g(29)).toBe(20_000_000 + 30_000_000 + 300_000_000 + 10_000_000);
  });

  it("el efectivo entra sin importar mayúsculas ni tildes", () => {
    for (const tp of ["cash", "Cash", "CASH", "Efectivo", "EFECTIVO"]) {
      expect(renglonPatrimonioDe({ tp })).toBe(291);
    }
    expect(renglonPatrimonioDe({ fiscalCode: "INV_EFECTIVO" })).toBe(291);
    expect(renglonPatrimonioDe({ tipo: "CDT" })).toBe(292);
    expect(renglonPatrimonioDe({ tp: "Fondo de Inversión" })).toBe(292);
    expect(renglonPatrimonioDe({ tp: "Vehículo" })).toBe(293);
    expect(renglonPatrimonioDe({ tp: "Cripto" })).toBe(294);
    expect(valorFiscalActivo({ tp: "Fondo de Inversión", vc: 5, va: 7 })).toBe(7);
    expect(valorFiscalActivo({ tp: "Acciones", vc: 5, va: 7, valorFiscal: 6 })).toBe(6);
  });

  it("umbral AG 2025: 4.500 UVT × $49.799", () => {
    expect(obligacionPorPatrimonio(0, 2025).umbral).toBe(4500 * 49_799);
    expect(obligacionPorPatrimonio(4500 * 49_799, 2025).obligado).toBe(false);
    expect(obligacionPorPatrimonio(4500 * 49_799 + 1, 2025).obligado).toBe(true);
  });

  it("cruza el umbral solo por los activos que no son inmueble", () => {
    const umbral = 4500 * 49_799; // $224.095.500
    const casa = { id: "a1", owner: "o1", tp: "Real Estate", va: 200_000_000 };
    const soloCasa = borrador([casa]);
    expect(soloCasa.g(29)).toBe(200_000_000);
    expect(soloCasa.r29.obligacionDeclarar.obligado).toBe(false);

    const completo = borrador([
      casa,
      { id: "a2", owner: "o1", tp: "Efectivo", va: 15_000_000 },
      { id: "a3", owner: "o1", tp: "CDT", va: 10_000_000 },
    ]);
    expect(completo.g(293)).toBeLessThan(umbral);
    expect(completo.g(29)).toBe(225_000_000);
    expect(completo.r29.obligacionDeclarar).toMatchObject({ obligado: true, umbral, uvt: 49_799 });
    expect(completo.r29.nota).toMatch(/obligado a declarar/);
  });
});

// 2-nov-2026 — Art. 277 ET: el inmueble se declara al mayor entre el costo
// fiscal y el avalúo catastral, nunca al valor comercial.
describe("F-210 · inmuebles a su valor patrimonial (Art. 277)", () => {
  it("toma el mayor entre costo y avalúo catastral", () => {
    expect(valorFiscalInmueble({ vc: 300_000_000, avaluoCatastral: 180_000_000, va: 500_000_000 })).toBe(300_000_000);
    expect(valorFiscalInmueble({ vc: 120_000_000, avaluoCatastral: 210_000_000, va: 500_000_000 })).toBe(210_000_000);
  });
  it("sin costo ni avalúo usa el valor cargado como respaldo", () => {
    expect(valorFiscalInmueble({ va: 200_000_000 })).toBe(200_000_000);
    expect(valorFiscalInmueble({})).toBe(0);
  });
  it("el valorFiscal explícito sigue mandando", () => {
    expect(valorFiscalActivo({ tp: "Real Estate", vc: 1, va: 2, valorFiscal: 3 })).toBe(3);
  });
});
