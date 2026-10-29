import { describe, it, expect } from "vitest";
import {
  baseDesdeImpuesto241, impuesto241, estimarDesdeDeclaracion, anticipoArt807, pctAnticipo, anticipoPagado,
  impuestoPatrimonioUVT, patrimonioInfo, impuestoDividendos, analisisHistorial, oportunidades, ahorroMarcado,
  calculosGODelTitular, serieHistorial,
} from "../../src/lib/rentaDesdeDeclaracion.js";

const persona = { id: "own_1", name: "Persona", type: "natural", declaraciones: [
  { tipo: "F210", anoGravable: 2025, renglones: { ingresosBrutos: 612e6, ingresosNoConstitutivos: 16e6, rentaExenta25: 45e6, deducMedicina: 19e6, pvAFC: 48e6, patrimonioBruto: 5400e6, deudas: 810e6, patrimonioLiquido: 4590e6, impuestoCalculado: 96e6, retefuente: 88e6, saldoPagar: 8e6 } },
  { tipo: "F210", anoGravable: 2024, renglones: { ingresosBrutos: 548e6, patrimonioBruto: 4900e6, deudas: 900e6, patrimonioLiquido: 4000e6, impuestoCalculado: 84e6, retefuente: 71e6, saldoPagar: 13e6 } },
] };
const empresa = { id: "own_3", name: "Empresa", type: "juridica", declaraciones: [
  { tipo: "F110", anoGravable: 2025, renglones: { ingresosBrutos: 880e6, costosDeducciones: 310e6, rentaLiquidaGravable: 570e6, patrimonioLiquido: 6150e6, impuestoCalculado: 199.5e6, impuestoNeto: 193.5e6, autorretencion: 52e6, saldoPagar: 141.5e6 } },
] };

describe("renta anclada en la declaración", () => {
  it("la inversa de la tabla 241 devuelve la base que produce el impuesto declarado", () => {
    const base = baseDesdeImpuesto241(96e6, 49799);
    expect(impuesto241(base, 49799)).toBeCloseTo(96e6, -3);
  });

  it("sin cambios, el estimado parte del impuesto declarado y solo lo mueve la UVT", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0 });
    expect(e.anoEst).toBe(2026);
    expect(e.pasos.map((p) => p.clave)).toEqual(["uvt"]);
    expect(e.renta).toBeLessThan(96e6); // UVT más alta → un poco menos de impuesto
    expect(e.renta).toBeGreaterThan(90e6);
  });

  it("los pasos explican exactamente la diferencia entre lo declarado y el estimado", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0.15, nuevo: 100e6, nuevoGastos: 20e6, aportes: 10e6 });
    const suma = e.pasos.reduce((a, p) => a + p.delta, 0);
    expect(e.impBase + suma).toBeCloseTo(e.total, 0);
  });

  it("sociedades: 35% sobre la renta gravable, con los descuentos del año pasado", () => {
    const e = estimarDesdeDeclaracion(empresa, { g: 0 });
    expect(e.nat).toBe(false);
    expect(e.renta).toBeCloseTo(570e6 * 0.35 - 6e6, 0);
  });

  it("la ganancia ocasional del solucionador entra ya optimizada", () => {
    const calc = [{ id: "go1", nombre: "Casa v1", datos: { titular: "juridica" }, resumen: { hoy: 420e6, final: 260e6, ahorro: 160e6 } }];
    expect(calculosGODelTitular(calc, empresa)).toHaveLength(1);
    expect(calculosGODelTitular(calc, persona)).toHaveLength(0);
    const e = estimarDesdeDeclaracion(empresa, { g: 0, goSel: "go1" }, { calculosGO: calc });
    expect(e.go).toBe(260e6);
    expect(e.total).toBeCloseTo(e.renta + 260e6, 0);
  });
});

describe("anticipo (Art. 807)", () => {
  it("porcentajes por años declarando", () => {
    expect(pctAnticipo(0)).toBe(0.25); expect(pctAnticipo(1)).toBe(0.5); expect(pctAnticipo(3)).toBe(0.75);
  });
  it("toma el menor de los dos procedimientos y resta retenciones; nunca negativo", () => {
    expect(anticipoArt807(200, 100, 50, 0.75)).toBeCloseTo(Math.min(150, 112.5) - 50);
    expect(anticipoArt807(100, null, 500, 0.75)).toBe(0);
  });
  it("si el lector trajo el renglón, usa ese valor", () => {
    const o = { ...empresa, declaraciones: [{ ...empresa.declaraciones[0], renglones: { ...empresa.declaraciones[0].renglones, anticipoAnoSiguiente: 77e6 } }] };
    expect(anticipoPagado(o)).toEqual({ valor: 77e6, leido: true });
  });
  it("el total al declarar suma el anticipo del año siguiente", () => {
    const e = estimarDesdeDeclaracion(empresa, { g: 0 });
    expect(e.totalAlDeclarar).toBeCloseTo(Math.max(0, e.saldo + e.anticipoSiguiente), 0);
    expect(e.anticipoSiguiente).toBeGreaterThan(0);
  });
});

describe("impuesto al patrimonio", () => {
  it("tabla en UVT: 0 hasta 72.000, 0,5% hasta 122.000, 1% + 250 hasta 239.000", () => {
    expect(impuestoPatrimonioUVT(70000, 2026)).toBe(0);
    expect(impuestoPatrimonioUVT(100000, 2026)).toBeCloseTo(140);
    expect(impuestoPatrimonioUVT(200000, 2026)).toBeCloseTo(1030);
    expect(impuestoPatrimonioUVT(300000, 2026)).toBeCloseTo(61000 * 0.015 + 1420);
    expect(impuestoPatrimonioUVT(300000, 2027)).toBeCloseTo(61000 * 0.01 + 1420);
  });
  it("persona por encima del umbral; la casa de habitación se excluye hasta 12.000 UVT", () => {
    const p = patrimonioInfo(persona);
    expect(p.aplica).toBe(true);
    expect(p.impA).toBeGreaterThan(0);
    const conCasa = patrimonioInfo(persona, 5000e6);
    expect(conCasa.exc).toBeCloseTo(12000 * 52374);
  });
});

describe("dividendos", () => {
  it("se suman a la renta y se descuenta el 19% de lo que pase de 1.090 UVT", () => {
    const r = impuestoDividendos(400e6, 200e6, 52374);
    expect(r.extra).toBeGreaterThan(0);
    expect(r.extra).toBeLessThan(200e6 * 0.25);
    expect(r.cargaTotal).toBeGreaterThan(0.35);
    expect(r.cargaTotal).toBeLessThan(0.5);
    expect(impuestoDividendos(400e6, 0, 52374).extra).toBe(0);
  });
});

describe("historial y oportunidades", () => {
  it("la serie va de la más vieja a la más nueva y guarda máximo 4", () => {
    const muchas = { ...persona, declaraciones: [2020, 2021, 2022, 2023, 2024].map((a) => ({ tipo: "F210", anoGravable: a, renglones: { ingresosBrutos: 1e8, impuestoCalculado: 1e7 } })) };
    expect(serieHistorial(muchas).map((x) => x.ano)).toEqual([2021, 2022, 2023, 2024]);
  });
  it("detecta el tope de beneficios superado y el umbral de patrimonio", () => {
    const a = analisisHistorial(persona);
    const textos = a.hallazgos.map((h) => h.texto).join(" ");
    expect(textos).toMatch(/no te restaron nada/);
    expect(textos).toMatch(/impuesto al patrimonio/);
    expect(a.proy.ano).toBe(2026);
  });
  it("si ya usa el tope, no sugiere aportes voluntarios y suma solo lo marcado", () => {
    const e = estimarDesdeDeclaracion(persona, {});
    const ops = oportunidades(persona, e);
    expect(ops.find((o) => o.id === "afc")).toBeUndefined();
    expect(ops.find((o) => o.id === "afc_info")).toBeDefined();
    const ahorro = ahorroMarcado(ops, { fe: { on: true, v: 300e6 }, dep: { on: false, v: 2 } });
    expect(ahorro).toBeCloseTo(3e6 * e.marginal, 0);
  });
});

describe("prender y apagar cambios", () => {
  it("un cambio apagado queda en la lista sin efecto y el total vuelve a lo que daría sin él", () => {
    const con = estimarDesdeDeclaracion(persona, { g: 0, nuevo: 100e6 });
    const sin = estimarDesdeDeclaracion(persona, { g: 0 });
    const apagado = estimarDesdeDeclaracion(persona, { g: 0, nuevo: 100e6, off: { nuevo: true } });
    expect(con.total).toBeGreaterThan(sin.total);
    expect(apagado.total).toBeCloseTo(sin.total, 0);
    expect(apagado.pasos.find((p) => p.clave === "nuevo")).toMatchObject({ off: true, delta: 0 });
  });
  it("la venta apagada no suma ganancia ocasional", () => {
    const e = estimarDesdeDeclaracion(empresa, { g: 0, goSel: "manual", go: 50e6, off: { go: true } });
    expect(e.go).toBe(0);
  });
});
