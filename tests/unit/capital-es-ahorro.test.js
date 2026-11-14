// 13-nov-2026 (Santiago: "si uno paga a capital pues eso es ahorro, ¿no?").
// El nivel se mide contra gastos + INTERESES; el abono a capital es ahorro.
// La caja del mes (flujo) y el colchón siguen con la cuota completa.
import { describe, it, expect } from "vitest";
import { calcularMetricas, saludFinanciera } from "../../src/lib/metrics.js";
import { partesObligacion, lecturaCaja, finDeudas } from "../../src/lib/desgloseLibertad.js";

const r = (ea) => Math.pow(1 + ea / 100, 1 / 12) - 1;
const renta = (m) => ({ categoria: "Arriendo", nombre: "Local", mensual: m });
const base = (deudas, extra = {}) => calcularMetricas({
  ingresos: [renta(10e6), { categoria: "Salario", nombre: "Sueldo", mensual: 8e6 }],
  gastos: { Hogar: [{ nombre: "Vida", mensual: 6e6 }] },
  deudas, inv: [{ id: "c", tp: "Cash", va: 30e6 }], trm: 4000, ...extra,
});

describe("cuota = intereses + capital", () => {
  const hip = { n: "Hipoteca", mt: 200e6, pg: 3e6, ts: 12 };
  const m = base([hip]);
  const int = 200e6 * r(12);
  it("intereses con la tasa mensual equivalente; capital = cuota − intereses", () => {
    expect(m.interesesDeuda).toBeCloseTo(int, 0);
    expect(m.capitalDeuda).toBeCloseTo(3e6 - int, 0);
    expect(m.sd).toBe(3e6);
  });
  it("nivel contra gastos + intereses; caja contra la cuota completa", () => {
    expect(m.ob).toBeCloseTo(6e6 + int, 0);
    expect(m.obCaja).toBe(9e6);
    expect(m.fl).toBe(10e6 + 8e6 - 9e6);
    expect(m.coberturaPasiva).toBeCloseTo((10e6 / (6e6 + int)) * 100, 6);
    expect(m.colchonMeses).toBeCloseTo(30e6 / 9e6, 6);
  });
  it("pagar más capital no baja el nivel (antes sí)", () => {
    const masCapital = base([{ ...hip, pg: 6e6 }]);
    expect(masCapital.nivel.nivel).toBe(m.nivel.nivel);
    expect(masCapital.coberturaPasiva).toBeCloseTo(m.coberturaPasiva, 6);
    expect(masCapital.fl).toBe(m.fl - 3e6);       // la caja sí lo siente
  });
  it("el abono a capital cuenta como ahorro", () => {
    expect(m.ahorroPct).toBeCloseTo(((m.fl + m.capitalDeuda) / m.ingresoNeto) * 100, 6);
  });
});

describe("casos borde", () => {
  it("sin tasa: la cuota cuenta completa y se marca", () => {
    const m = base([{ n: "Préstamo", mt: 50e6, pg: 2e6 }]);
    expect(m.interesesDeuda).toBe(2e6);
    expect(m.capitalDeuda).toBe(0);
    expect(m.deudasSinTasa).toEqual({ n: 1, cuota: 2e6 });
  });
  it("sin saldo: la cuota cuenta completa y se marca", () => {
    const m = base([{ n: "Crédito", mt: 0, pg: 2.5e6, ts: 15 }]);
    expect(m.interesesDeuda).toBe(2.5e6);
    expect(m.deudasSinTasa.n).toBe(1);
  });
  it("sin intereses declarado: toda la cuota es capital", () => {
    const m = base([{ n: "Familiar", mt: 20e6, pg: 1e6, ts: 0, tipoInteres: "sin_interes" }]);
    expect(m.interesesDeuda).toBe(0);
    expect(m.deudasSinTasa.n).toBe(0);
  });
  it("interés simple: tasa ÷ 12 sobre el saldo", () => {
    const m = base([{ n: "Personal", mt: 12e6, pg: 1e6, ts: 24, tipoInteres: "simple" }]);
    expect(m.interesesDeuda).toBeCloseTo(12e6 * 0.02, 6);
  });
  it("cuota que no alcanza los intereses: todo es interés, nada de capital", () => {
    const m = base([{ n: "Tarjeta", mt: 100e6, pg: 1e6, ts: 30 }]);
    expect(m.interesesDeuda).toBe(1e6);
    expect(m.capitalDeuda).toBe(0);
  });
  it("deuda en dólares: intereses en pesos con la TRM", () => {
    const m = base([{ n: "Mortgage", mt: 100000, pg: 1000, ts: 6, moneda: "USD" }]);
    expect(m.sd).toBe(1000 * 4000);
    expect(m.interesesDeuda).toBeCloseTo(1000 * 4000 * Math.min(1, (100000 * r(6)) / 1000), 0);
  });
  it("fuera de vigencia: no hay cuota ni intereses ese mes", () => {
    const m = calcularMetricas({ ingresos: [renta(1e6)], gastos: { H: [{ mensual: 1e6 }] }, deudas: [{ mt: 10e6, pg: 1e6, ts: 12, desdeMes: 1, hastaMes: 3 }] }, { base: "mes", anio: 2026, mes: 11 });
    expect(m.sd).toBe(0);
    expect(m.interesesDeuda).toBe(0);
  });
});

describe("desglose en pantalla", () => {
  const m = base([{ n: "Hipoteca", mt: 200e6, pg: 3e6, ts: 12 }, { n: "Sin tasa", mt: 10e6, pg: 1e6 }], { impuestoNeto: 2e6 });
  it("las partes suman exactamente la cifra del nivel", () => {
    const partes = partesObligacion(m);
    expect(partes.reduce((s, p) => s + p.monto, 0)).toBeCloseTo(m.ob, 6);
    expect(partes.map((p) => p.clave)).toEqual(["vida", "intereses", "sinTasa", "impuesto"]);
  });
  it("caja: dice el capital y si las rentas no alcanzan las cuotas completas", () => {
    const c = lecturaCaja({ ip: 10, ob: 8, obCaja: 12, fl: 5, capitalDeuda: 4 });
    expect(c.rentasNoCubrenCuotas).toBe(true);
    expect(c.capital).toBe(4);
    expect(lecturaCaja({ ip: 13, ob: 8, obCaja: 12, fl: 5 }).rentasNoCubrenCuotas).toBe(false);
  });
  it("fin de deudas: año y cobertura sin intereses", () => {
    const deudas = [{ n: "Hipoteca", mt: 200e6, pg: 3e6, ts: 12 }];
    const mm = base(deudas);
    const f = finDeudas(mm, deudas, new Date(2026, 10, 13));
    expect(f.meses).toBeGreaterThan(80);
    expect(f.anio).toBeGreaterThan(2032);
    expect(f.coberturaSinDeudas).toBeCloseTo((10e6 / 6e6) * 100, 6);
  });
  it("salud: pagar más capital no baja la tasa de ahorro (es ahorro)", () => {
    const sin = saludFinanciera(base([{ n: "H", mt: 200e6, pg: 2.1e6, ts: 12 }]));
    const con = saludFinanciera(base([{ n: "H", mt: 200e6, pg: 4e6, ts: 12 }]));
    expect(con.componentes.ahorro.valor).toBeCloseTo(sin.componentes.ahorro.valor, 6); // capital extra = ahorro
  });
});
