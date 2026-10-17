import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calcularMetricas, saludFinanciera, rentaYYield, gananciaVsInflacion, clasificarMargen, INFLACION_DEFAULT_PCT, inflacionGlobal } from "../../src/lib/metrics.js";

const qa = JSON.parse(readFileSync(new URL("../fixtures/qa_pro_patrimonio_completo.json", import.meta.url), "utf8"));
const m = calcularMetricas({ ingresos: qa.ingresos, gastos: qa.gas, deudas: qa.deu, inv: qa.inv, trm: qa.trm });

describe("salud financiera (spec §2)", () => {
  const s = saludFinanciera(m);
  it("caso QA sin retención: 38 Crítica (ahorro 5,8%, deuda 38,2% sobre ingreso neto = bruto)", () => {
    expect(s.score).toBe(38);
    expect(s.banda).toBe("Crítica");
    expect(s.componentes.ahorro.puntos).toBeCloseTo(29.1, 1);
    expect(s.componentes.cargaDeuda.puntos).toBeCloseTo(22.8, 1);
    expect(s.componentes.colchon.puntos).toBeCloseTo(51.2, 1);
    expect(s.componentes.apalancamiento.puntos).toBeCloseTo(60.7, 1);
    expect(s.componentes.cobertura.puntos).toBeCloseTo(34.7, 1);
  });
  it("candado: patrimonio negativo o FL<0 → máx 39", () => {
    const x = saludFinanciera({ ahorroPct: 50, cargaDeudaPct: 0, fl: 5e6, sd: 0, colchonMeses: 12, activosTotal: 100, deudaTotal: 120, patrimonioNeto: -20, coberturaPasiva: 100 });
    expect(x.score).toBe(39);
    expect(x.candado).toBe("patrimonio_negativo");
  });
  it("extremos: todo al máximo = 100 Excelente; bandas", () => {
    const x = saludFinanciera({ ahorroPct: 30, cargaDeudaPct: 10, fl: 3e6, sd: 1e6, colchonMeses: 6, activosTotal: 100, deudaTotal: 10, patrimonioNeto: 90, coberturaPasiva: 60 });
    expect(x.score).toBe(100);
    expect(x.banda).toBe("Excelente");
  });
});

describe("renta anual y yield (spec §4)", () => {
  const r = rentaYYield(m);
  it("renta anual = IP×12 neto (no 117M)", () => {
    expect(r.rentaAnual).toBe(17970000);
  });
  it("yield sobre costo de los activos que rentan, nunca 0,0% con arriendo", () => {
    expect(r.yield).toBeCloseTo(4.46, 2);
    expect(r.etiqueta).toBe("Yield on cost");
  });
  it("sin costo cargado usa valor actual y lo rotula", () => {
    const x = rentaYYield(calcularMetricas({
      ingresos: [{ categoria: "Rentas de capital", mensual: 1000000, activoId: "a" }],
      inv: [{ id: "a", tp: "Real Estate", va: 200e6 }],
    }));
    expect(x.sobreValorActual).toBe(true);
    expect(x.etiqueta).toBe("Rendimiento por renta (sobre valor actual)");
    expect(x.yield).toBeCloseTo(6, 5);
  });
});

describe("inflación (spec §5) — un solo supuesto global, default 4%", () => {
  it("default 4% y valores inválidos caen al default", () => {
    expect(INFLACION_DEFAULT_PCT).toBe(4);
    expect([inflacionGlobal(undefined), inflacionGlobal(""), inflacionGlobal(-1), inflacionGlobal(6)]).toEqual([4, 4, 4, 6]);
  });
  it("QA Pro con 4%: nominal 4,4% → +0,4% real, le gana POR POCO", () => {
    const g = gananciaVsInflacion(m, 4);
    expect(g.nominal).toBeCloseTo(4.42, 2);
    expect(g.real).toBeCloseTo(0.42, 2);
    expect(g.inflacion).toBe(4);
    expect(g.leGana).toBe(true);
    expect(g.porPoco).toBe(true);
    expect(g.mensaje).toBe("Tu portafolio le gana a la inflación por poco (+0,4% real al año)");
    expect(g.mensaje).not.toMatch(/no supera|No le gana/i);
  });
  it("sin valor explícito usa el default 4%", () => {
    expect(gananciaVsInflacion(m).inflacion).toBe(4);
  });
  it("cambiar el supuesto cambia el mensaje (5,2% → le falta poco para ganarle)", () => {
    const g = gananciaVsInflacion(m, 5.2);
    expect(g.mensaje).toBe("A tu portafolio le falta poco para ganarle a la inflación (−0,8% real)");
  });
  it("con valorización declarada suma al nominal y le gana con holgura", () => {
    const x = calcularMetricas({
      ingresos: [{ categoria: "Rentas de capital", mensual: 1000000, activoId: "a" }],
      inv: [{ id: "a", tp: "Real Estate", va: 200e6, vc: 150e6, valorizacionPct: 3 }],
    });
    const g = gananciaVsInflacion(x, 4);
    expect(g.nominal).toBeCloseTo(9, 5);
    expect(g.mensaje).toBe("Tu portafolio le gana a la inflación (+5,0% real al año)");
  });
});

describe("copy de inflación por margen real (bordes 0, 1, −1)", () => {
  // invertibles 100, IP 0: nominal = valorización; con inflación 4 → real = val − 4
  const g = (val) => gananciaVsInflacion({ ip: 0, valorizacionAnual: val, invertibles: 100 }, 4);
  it("real = +1 exacto → le gana", () => { expect(g(5).clase).toBe("gana"); expect(g(5).mensaje).toMatch(/^Tu portafolio le gana a la inflación \(\+1,0%/); });
  it("real justo bajo 1 → le gana por poco", () => { expect(g(4.99).clase).toBe("gana_poco"); expect(g(4.99).mensaje).toMatch(/por poco/); });
  it("real justo sobre 0 → le gana por poco", () => { expect(g(4.01).clase).toBe("gana_poco"); });
  it("real = 0 exacto → le falta poco para ganarle (0 incluido)", () => {
    expect(g(4).clase).toBe("no_gana_poco");
    expect(g(4).mensaje).toBe("A tu portafolio le falta poco para ganarle a la inflación (0,0% real)");
    expect(g(4).leGana).toBe(false);
  });
  it("real = −1 exacto → le falta poco para ganarle", () => { expect(g(3).clase).toBe("no_gana_poco"); });
  it("real justo bajo −1 → no le gana", () => {
    expect(g(2.99).clase).toBe("no_gana");
    expect(g(2).mensaje).toBe("No le gana a la inflación (−2,0% real)");
  });
  it("clasificarMargen directo", () => {
    expect([1, 0.5, 0, -1, -1.0001].map(clasificarMargen)).toEqual(["gana", "gana_poco", "no_gana_poco", "no_gana_poco", "no_gana"]);
  });
});

describe("origen de la renta del activo (manual vs derivada)", () => {
  const base = (origen) => calcularMetricas({
    ingresos: [{ categoria: "Rentas de capital", mensual: (380e6 * 0.043) / 12, activoId: "apt" }],
    gastos: { "Inmueble arrendado": [
      { m: 350000, frecuencia: "mensual", activoId: "apt" },
      { m: 2400000, frecuencia: "anual", activoId: "apt" },
    ] },
    inv: [{ id: "apt", tp: "Real Estate", va: 380e6, vc: 380e6, ...(origen ? { rentaOrigen: origen } : {}) }],
  });
  it("manual 4,3% con gastos vinculados: 4,3% tal cual, sin descuento extra ni gasto duplicado", () => {
    const m = base("manual");
    expect(m.costosNeteados).toBe(0);
    expect(m.g).toBe(0);
    expect(m.ip * 12).toBeCloseTo(380e6 * 0.043, 0);
    expect(rentaYYield(m).yield).toBeCloseTo(4.3, 6);
  });
  it("derivada: bruta, se descuentan administración y predial", () => {
    const m = base("derivada");
    expect(m.costosNeteados).toBeCloseTo(550000, 0);
    expect(rentaYYield(m).yield).toBeLessThan(4.3);
  });
  it("sin indicador (activo viejo, p. ej. 6%): se trata como bruta", () => {
    const m = base(undefined);
    expect(m.costosNeteados).toBeCloseTo(550000, 0);
  });
});

describe("ahorro y carga de deuda: misma base neta de retención (numerador y denominador)", () => {
  const conRet = (r) => calcularMetricas({ ingresos: qa.ingresos, gastos: qa.gas, deudas: qa.deu, inv: qa.inv, trm: qa.trm, retencionMensual: r });
  it("sin retención: FL 567.500 ÷ ingreso 9.747.500 = 5,8%", () => {
    const x = conRet(0);
    expect(x.ingresoNeto).toBe(9747500);
    expect(x.ahorroPct).toBeCloseTo((567500 / 9747500) * 100, 6);
    expect(x.cargaDeudaPct).toBeCloseTo((3720000 / 9747500) * 100, 6);
  });
  it("con retención 520.000: FL 47.500 ÷ ingreso neto 9.227.500 = 0,5% (no 0,49% sobre bruto)", () => {
    const x = conRet(520000);
    expect(x.fl).toBe(47500);
    expect(x.ingresoNeto).toBe(9227500);
    expect(x.ahorroPct).toBeCloseTo(0.5148, 3);
    expect(x.ahorroPct).not.toBeCloseTo((47500 / 9747500) * 100, 2);
    expect(x.cargaDeudaPct).toBeCloseTo((3720000 / 9227500) * 100, 6); // 40,3%
  });
  it("salud con retención: 30 Crítica (cuotas ÷ neto); la misma cifra de ahorro alimenta puntaje", () => {
    const x = conRet(520000);
    const s = saludFinanciera(x);
    expect(s.componentes.ahorro.valor).toBe(x.ahorroPct);
    expect(s.componentes.cargaDeuda.valor).toBe(x.cargaDeudaPct);
    expect(s.score).toBe(30);
    expect(s.banda).toBe("Crítica");
  });
  it("la retención no cambia IP ni OB (no se resta dos veces)", () => {
    expect(conRet(520000).ob).toBe(conRet(0).ob);
    expect(conRet(520000).ip).toBe(conRet(0).ip);
  });
});

describe("nivel desde la fuente única, sin salario como pasivo", () => {
  it("salario que cubre gastos y cuotas (101%) NO es Independencia: cobertura pasiva 0 → N2", () => {
    const x = calcularMetricas({
      ingresos: [{ categoria: "Salario", mensual: 10100000 }],
      gastos: { Vida: [{ m: 10000000, frecuencia: "mensual" }] },
    });
    expect(x.coberturaPasiva).toBe(0);
    expect(x.nivel.nivel).toBe(2);
  });
});
