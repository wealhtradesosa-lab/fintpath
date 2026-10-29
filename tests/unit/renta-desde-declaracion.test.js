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

describe("ingresos que se van y que llegan", () => {
  it("si deja de recibir parte, baja el impuesto y el resultado de ingresos lo refleja", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0, perdidos: [{ id: "a", nombre: "Comisiones", monto: 300e6 }] });
    const sin = estimarDesdeDeclaracion(persona, { g: 0 });
    expect(e.renta).toBeLessThan(sin.renta);
    expect(e.ingresosEst).toBeCloseTo(612e6 - 300e6, -3);
    expect(e.ret).toBeLessThan(sin.ret);
  });
  it("cada ingreso nuevo tributa según su tipo: un dividendo paga menos que un arriendo del mismo monto", () => {
    const arr = estimarDesdeDeclaracion(persona, { g: 0, nuevos: [{ id: "x", tipo: "arriendo", monto: 200e6 }] });
    const div = estimarDesdeDeclaracion(persona, { g: 0, nuevos: [{ id: "x", tipo: "dividendos", monto: 200e6 }] });
    expect(div.renta).toBeLessThan(arr.renta);
    expect(arr.ingresosEst).toBeCloseTo(812e6, -3);
  });
  it("cada ingreso nuevo se puede apagar", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0, nuevos: [{ id: "x", tipo: "arriendo", monto: 200e6 }], off: { n_x: true } });
    const sin = estimarDesdeDeclaracion(persona, { g: 0 });
    expect(e.renta).toBeCloseTo(sin.renta, 0);
  });
});

describe("caso real: cambia la mezcla de ingresos", () => {
  it("si lo que deja de recibir supera lo declarado, la base no queda negativa y lo nuevo sí paga", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0, perdidos: [{ id: "a", monto: 900e6 }], nuevos: [{ id: "b", tipo: "arriendo", monto: 200e6 }] });
    expect(e.renta).toBeGreaterThan(0);
    expect(e.ingresosEst).toBeCloseTo(200e6, -3);
  });
});

describe("tabla de ingresos (sigue / cambia / ya no / nuevo)", () => {
  it("el caso de Santiago: queda solo el salario y entran dos ingresos nuevos", () => {
    const filas = [
      { id: "s", nombre: "Salario", tipo: "laboral", antes: 132e6, estado: "sigue" },
      { id: "c", nombre: "Comisiones", tipo: "laboral", antes: 360e6, estado: "no" },
      { id: "u", nombre: "Utilidades", tipo: "dividendos", antes: 120e6, estado: "no" },
      { id: "t", nombre: "Trabajo nuevo", tipo: "laboral", antes: 0, estado: "cambia", ahora: 150e6 },
    ];
    const e = estimarDesdeDeclaracion(persona, { g: 0, filas });
    expect(e.ingresosEst).toBeCloseTo(132e6 + 150e6, -3);
    expect(e.renta).toBeLessThan(estimarDesdeDeclaracion(persona, { g: 0 }).renta);
    expect(e.pasos.some((p) => /Ya no recibes: Comisiones/.test(p.texto))).toBe(true);
    expect(e.pasos.some((p) => /Nuevo: Trabajo nuevo/.test(p.texto))).toBe(true);
  });
  it("con inflación, lo que sigue sube 5% y el resultado lo muestra", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0.05, filas: [{ id: "s", nombre: "Todo", tipo: "laboral", antes: 612e6, estado: "sigue" }] });
    expect(e.ingresosEst).toBeCloseTo(612e6 * 1.05, -3);
  });
});

describe("el piso de comparación es lo que el usuario repartió", () => {
  it("si reparte más de lo declarado y todo sigue igual, no aparece una subida falsa", () => {
    const filas = [{ id: "a", nombre: "Salario", tipo: "laboral", antes: 400e6, estado: "sigue" }, { id: "b", nombre: "Otros", tipo: "otro", antes: 300e6, estado: "sigue" }];
    const e = estimarDesdeDeclaracion(persona, { g: 0, filas });
    expect(e.ingresosAntes).toBeCloseTo(700e6, -3);
    expect(e.ingresosEst).toBeCloseTo(700e6, -3);
  });
});

import { lista2026DesdeIngresos } from "../../src/lib/rentaDesdeDeclaracion.js";
describe("¿qué recibes este año? (2025 fijo, 2026 ítem por ítem)", () => {
  it("sin cambios de ingresos, el impuesto queda cerca del declarado", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0, lista2026: [{ id: "a", tipo: "laboral", monto: 612e6 }] });
    expect(e.ingresosEst).toBe(612e6);
    expect(e.ingresosAntes).toBe(612e6);
    expect(Math.abs(e.renta - 96e6)).toBeLessThan(6e6);
  });
  it("si este año recibe la mitad, el impuesto baja y cada ítem dice cuánto pesa", () => {
    const e = estimarDesdeDeclaracion(persona, { g: 0, lista2026: [{ id: "a", nombre: "Salario", tipo: "laboral", monto: 200e6 }, { id: "b", nombre: "Arriendo", tipo: "arriendo", monto: 100e6 }] });
    expect(e.renta).toBeLessThan(96e6);
    expect(e.aportesLista.find((x) => x.id === "b").impuesto).toBeGreaterThan(0);
  });
  it("trae los ingresos registrados del titular como punto de partida", () => {
    const u = { ingresos: [{ id: "x", owner: "own_1", nombre: "Honorarios", categoria: "Honorarios", mensual: 10e6, tipo: "fijo" }, { id: "y", owner: "otro", nombre: "Z", mensual: 1e6 }] };
    const l = lista2026DesdeIngresos(u, "own_1");
    expect(l).toHaveLength(1);
    expect(l[0].tipo).toBe("laboral");
    expect(l[0].monto).toBeGreaterThan(0);
  });
});

describe("lo que no es renta", () => {
  it("un préstamo no suma al impuesto ni a los ingresos de renta", () => {
    const sin = estimarDesdeDeclaracion(persona, { g: 0, lista2026: [{ id: "a", tipo: "laboral", monto: 300e6 }] });
    const con = estimarDesdeDeclaracion(persona, { g: 0, lista2026: [{ id: "a", tipo: "laboral", monto: 300e6 }, { id: "p", nombre: "préstamos Lagoon", tipo: "noRenta", monto: 240e6 }] });
    expect(con.renta).toBeCloseTo(sin.renta, 0);
    expect(con.ingresosEst).toBe(300e6);
    expect(con.noRentaLista).toBe(240e6);
  });
});
