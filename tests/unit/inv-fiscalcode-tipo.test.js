import { describe, it, expect } from "vitest";
import { fiscalCodeParaTipo, migrateInvFiscalCodeTipo } from "../../src/lib/invFiscalCode.js";

describe("fiscalCode sigue al tipo (form)", () => {
  it("Acciones con default de inmueble → INV_ACCIONES", () => {
    expect(fiscalCodeParaTipo("Acciones", "INV_INMUEBLE_HABITACIONAL")).toBe("INV_ACCIONES");
  });
  it("inmueble conserva el uso elegido", () => {
    expect(fiscalCodeParaTipo("Bodega", "INV_INMUEBLE_ARRENDADO")).toBe("INV_INMUEBLE_ARRENDADO");
    expect(fiscalCodeParaTipo("Real Estate", "INV_CDT")).toBe("INV_INMUEBLE_HABITACIONAL");
  });
  it("Cash → INV_EFECTIVO", () => {
    expect(fiscalCodeParaTipo("Cash", "INV_INMUEBLE_HABITACIONAL")).toBe("INV_EFECTIVO");
  });
  it("tipo ambiguo → sin código", () => {
    expect(fiscalCodeParaTipo("Negocio", "INV_INMUEBLE_HABITACIONAL")).toBeUndefined();
  });
  it("vehículo depende del owner", () => {
    expect(fiscalCodeParaTipo("Vehículo", undefined, { type: "juridica" })).toBe("INV_VEHICULO_PRODUCTIVO");
    expect(fiscalCodeParaTipo("Vehículo")).toBe("INV_VEHICULO_PERSONAL");
  });
});

describe("migración al cargar", () => {
  const d = { owners: [], inv: [
    { id: 1, tipo: "Acciones", fiscalCode: "INV_INMUEBLE_HABITACIONAL" },
    { id: 2, tipo: "Fondo de Inversión", fiscalCode: "INV_INMUEBLE_VACANTE" },
    { id: 3, tipo: "Negocio", fiscalCode: "INV_INMUEBLE_HABITACIONAL" },
    { id: 4, tipo: "Real Estate", fiscalCode: "INV_INMUEBLE_HABITACIONAL" },
    { id: 5, tipo: "Crypto", fiscalCode: "INV_CRYPTO" },
  ] };
  it("corrige inequívocos y marca ambiguos", () => {
    const r = migrateInvFiscalCodeTipo(d);
    expect(r.inv[0].fiscalCode).toBe("INV_ACCIONES");
    expect(r.inv[1].fiscalCode).toBe("INV_FIC");
    expect(r.inv[2].fiscalCode).toBeUndefined();
    expect(r.inv[2].revisarFiscal).toBe(true);
    expect(r.inv[3]).toBe(d.inv[3]);
    expect(r.inv[4]).toBe(d.inv[4]);
  });
  it("idempotente", () => {
    const r = migrateInvFiscalCodeTipo(d);
    expect(migrateInvFiscalCodeTipo(r)).toBe(r);
  });
});

import { inferInversionFiscalCode } from "../../src/lib/normalize.js";
describe("normalize: fallback neutro", () => {
  it("sin código ni tipo conocido → INV_OTROS_ACTIVOS, nunca habitacional", () => {
    expect(inferInversionFiscalCode({ tipo: "Negocio" }, {}, [])).toBe("INV_OTROS_ACTIVOS");
    expect(inferInversionFiscalCode({}, {}, [])).toBe("INV_OTROS_ACTIVOS");
  });
  it("Cash → INV_EFECTIVO; Real Estate sigue habitacional", () => {
    expect(inferInversionFiscalCode({ tipo: "Cash" }, {}, [])).toBe("INV_EFECTIVO");
    expect(inferInversionFiscalCode({ tipo: "Real Estate" }, {}, [])).toBe("INV_INMUEBLE_HABITACIONAL");
  });
});
