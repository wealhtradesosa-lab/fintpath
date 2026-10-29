import { describe, it, expect } from "vitest";
import { calcularGananciaOcasional, tenenciaAnos } from "../../src/lib/gananciaOcasional.js";
import { factorArt73 } from "../../src/lib/normaGananciaOcasional.js";

const UVT26 = 52374;

describe("Tabla Art. 73 (Decreto 449 de 2026)", () => {
  it("2008 urbano = 4,16 (el ejemplo de Santiago)", () => {
    expect(factorArt73(2008, "urbano")).toBe(4.16);
    expect(factorArt73(1986, "acciones")).toBe(55.27);
    expect(factorArt73(1950, "urbano")).toBe(36085.10);
    expect(factorArt73(2025, "urbano")).toBe(1);
  });
});

describe("Persona natural, casa comprada en 2008", () => {
  const base = { titular: "natural", tipo: "urbano", anoCompra: 2008, anoVenta: 2026, valorEscritura: 200e6, precioVenta: 1200e6, enRenta: "si", esVivienda: true };

  it("sin optimizar: (1.200 − 200) × 15% = 150 MM", () => {
    const r = calcularGananciaOcasional({ ...base, afc: "no" });
    expect(r.antes.total).toBeCloseTo(150e6, 0);
  });

  it("factor 4,16: costo 832 MM → (1.200 − 832) × 15% = 55,2 MM", () => {
    const r = calcularGananciaOcasional({ ...base, afc: "no" });
    expect(r.mejor.id).toBe("art73");
    expect(r.despues.costo).toBeCloseTo(832e6, 0);
    expect(r.despues.total).toBeCloseTo(55.2e6, 0);
    expect(r.ahorro).toBeCloseTo(94.8e6, 0);
  });

  it("con AFC: 368 MM de utilidad − 5.000 UVT exentas", () => {
    const r = calcularGananciaOcasional({ ...base, afc: "si" });
    const exento = 5000 * UVT26;
    expect(r.despues.exento).toBeCloseTo(exento, 0);
    expect(r.despues.total).toBeCloseTo((368e6 - exento) * 0.15, 0);
  });

  it("avalúo catastral mayor gana, y se bloquea si no está en la renta", () => {
    const r = calcularGananciaOcasional({ ...base, avaluoAnterior: 900e6 });
    expect(r.mejor.id).toBe("art72");
    const r2 = calcularGananciaOcasional({ ...base, avaluoAnterior: 900e6, enRenta: "no" });
    expect(r2.mejor.id).toBe("art73");
    expect(r2.alertas.join(" ")).toMatch(/no está en tu declaración/);
  });

  it("menos de 2 años → renta ordinaria y estrategia de esperar", () => {
    const r = calcularGananciaOcasional({ ...base, anoCompra: 2025, mesCompra: 6, mesVenta: 3, valorEscritura: 1000e6 });
    expect(r.esGO).toBe(false);
    expect(r.despues.tipo).toBe("ordinaria");
    expect(r.estrategias.find((s) => s.id === "esperar").ahorro).toBeGreaterThan(0);
  });
});

describe("Sociedad (caso: declarado 3.000 MM, venta 9.500 MM)", () => {
  const caso = { titular: "juridica", tipo: "urbano", anoCompra: 2015, anoVenta: 2026, costoDeclarado: 3000e6, precioVenta: 9500e6, enRenta: "si" };

  it("sin optimizar: 6.500 × 15% = 975 MM", () => {
    const r = calcularGananciaOcasional(caso);
    expect(r.antes.total).toBeCloseTo(975e6, 0);
  });

  it("no aplica Art. 73 ni 311-1, aunque diga que es vivienda", () => {
    const r = calcularGananciaOcasional({ ...caso, esVivienda: true, afc: "si" });
    expect(r.estrategias.find((s) => s.id === "art73").estado).toBe("no_aplica");
    expect(r.estrategias.find((s) => s.id === "311-1").estado).toBe("no_aplica");
    expect(r.despues.exento).toBe(0);
  });

  it("avalúo 4.000 MM: (9.500 − 4.000) × 15% = 825 MM", () => {
    const r = calcularGananciaOcasional({ ...caso, avaluoAnterior: 4000e6 });
    expect(r.despues.total).toBeCloseTo(825e6, 0);
    expect(r.ahorro).toBeCloseTo(150e6, 0);
  });

  it("depreciación recuperada va al 35%", () => {
    const r = calcularGananciaOcasional({ ...caso, costoDeclarado: 0, valorEscritura: 3000e6, depreciacion: 500e6 });
    // costo 2.500, utilidad 7.000: 500 al 35% + 6.500 al 15%
    expect(r.antes.total).toBeCloseTo(500e6 * 0.35 + 6500e6 * 0.15, 0);
  });
});

describe("tenencia", () => {
  it("con meses", () => {
    expect(tenenciaAnos({ anoCompra: 2024, mesCompra: 11, anoVenta: 2026, mesVenta: 10 }).anos).toBeLessThan(2);
  });
});

describe("Sociedad: vender las acciones", () => {
  const caso = { titular: "juridica", anoCompra: 2015, anoVenta: 2026, costoDeclarado: 3000e6, precioVenta: 9500e6, enRenta: "si", costoAcciones: 3000e6, anoAcciones: 2015 };
  it("compara 975 MM (empresa) vs (9.500 − 3.000×1,75) × 15% = 637,5 MM", () => {
    const r = calcularGananciaOcasional(caso);
    expect(r.acciones.impuesto).toBeCloseTo((9500e6 - 5250e6) * 0.15, 0);
    expect(r.acciones.ahorro).toBeCloseTo(975e6 - 637.5e6, 0);
    expect(r.estrategias.find((s) => s.id === "acciones").estado).toBe("posible");
  });
  it("al aplicarla, el resultado de arriba usa la venta de acciones", () => {
    const r = calcularGananciaOcasional({ ...caso, ventaAcciones: true });
    expect(r.despues.total).toBeCloseTo(637.5e6, 0);
    expect(r.ahorro).toBeCloseTo(337.5e6, 0);
  });
  it("sin datos de acciones pide el dato", () => {
    const r = calcularGananciaOcasional({ ...caso, costoAcciones: 0 });
    expect(r.estrategias.find((s) => s.id === "acciones").estado).toBe("falta_dato");
  });
});
