// Arriendo de inmuebles como renta de capital (Art. 338 ET). Spec de Tributario
// (19-oct-2026): ingreso bruto completo, menos costos registrados (sin
// presunción), sin exenta del 25 % (Art. 206-10), sin componente
// inflacionario, va a la tabla del Art. 241 con el resto de la cédula general
// y la retención del 3,5 % solo si el usuario marca «me retienen».
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { generarBorradorF210 } from "../../src/lib/borradorDeclaracionF210.js";

const ARRIENDO_MES = 1_900_000; // $22,8 M al año
const ARRIENDO_ANUAL = 22_800_000;

const user = ({ ingresos = [], gas = {}, deu = [], inv = [] } = {}) => ({
  trm: 4200,
  owners: [{ id: "o1", name: "Luis", type: "natural" }],
  ingresos, gas, deu, inv,
});
const arriendo = (extra = {}) => ({ id: "arr1", owner: "o1", nombre: "Arriendo apto", categoria: "Arriendo", fiscalCode: "CAP_ARRENDAMIENTO", mensual: ARRIENDO_MES, tipo: "fijo", ...extra });
const det = (u) => estimarImpuesto(u, { ag: 2025 }).detalle.find(d => d.name === "Luis");

describe("arriendo de inmueble = renta de capital (Art. 338 ET)", () => {
  it("$22,8 M de arriendo y $0 de costos → renta líquida de capital $22,8 M, sin exenta del 25 %", () => {
    const d = det(user({ ingresos: [arriendo()] }));
    expect(d.arrendamientoAnual).toBe(ARRIENDO_ANUAL);
    expect(d.costosArrendamiento).toBe(0);
    expect(d.rentaLiqArrendamiento).toBe(ARRIENDO_ANUAL);
    expect(d.rentaLiqCapital).toBe(ARRIENDO_ANUAL);
    expect(d.exenta25).toBe(0);
    expect(d.componenteInflacExcluido).toBe(0);
    expect(d.ingCapital).toBe(ARRIENDO_ANUAL);
    expect(d.ingNoLaboral).toBe(0);
    expect(d.baseGravable).toBe(ARRIENDO_ANUAL);
  });

  it("con $3 M de costos registrados → $19,8 M", () => {
    const d = det(user({
      ingresos: [arriendo()],
      gas: {
        Predial: [{ owner: "o1", fiscalCode: "GAS_INMUEBLE_PREDIAL", m: 1_200_000, freq: "año", frecuencia: "anual", mesPago: 3 }],
        Administración: [{ owner: "o1", fiscalCode: "GAS_INMUEBLE_ADMINISTRACION", m: 150_000 }], // 1,8 M/año
      },
    }));
    expect(d.costosArrendamiento).toBe(3_000_000);
    expect(d.rentaLiqArrendamiento).toBe(19_800_000);
    expect(d.rentaLiqCapital).toBe(19_800_000);
  });

  it("intereses del crédito y gastos vinculados al inmueble (activoId) restan; gastos personales no", () => {
    const d = det(user({
      ingresos: [arriendo({ activoId: "a1" })],
      inv: [{ id: "a1", owner: "o1", tp: "Real Estate", va: 400_000_000 }],
      gas: {
        Mantenimiento: [{ owner: "o1", activoId: "a1", m: 100_000 }], // 1,2 M/año, vinculado
        Vivienda: [{ owner: "o1", m: 2_000_000 }],                    // gasto personal: no se presume
      },
      deu: [{ owner: "o1", activoId: "a1", mt: 10_000_000, ts: 12, fiscalCode: "DEU_NAT_INVERSION" }], // 1,2 M/año
    }));
    expect(d.costosArrendamiento).toBe(2_400_000);
    expect(d.rentaLiqArrendamiento).toBe(20_400_000);
  });

  it("el código legacy NOL_ARRIENDO_INMUEBLE recibe el mismo tratamiento", () => {
    const d = det(user({ ingresos: [arriendo({ fiscalCode: "NOL_ARRIENDO_INMUEBLE" })] }));
    expect(d.rentaLiqCapital).toBe(ARRIENDO_ANUAL);
    expect(d.ingNoLaboral).toBe(0);
  });

  it("un rendimiento genérico vinculado a un inmueble se trata como arriendo (sin componente inflacionario)", () => {
    const d = det(user({
      ingresos: [{ id: "r1", owner: "o1", categoria: "Rentas de capital", fiscalCode: "CAP_RENDIMIENTO_GENERICO", mensual: ARRIENDO_MES, activoId: "a1" }],
      inv: [{ id: "a1", owner: "o1", tp: "Real Estate", va: 400_000_000 }],
    }));
    expect(d.arrendamientoAnual).toBe(ARRIENDO_ANUAL);
    expect(d.rendimientoGenAnual).toBe(0);
    expect(d.componenteInflacExcluido).toBe(0);
    expect(d.rentaLiqCapital).toBe(ARRIENDO_ANUAL);
  });

  it("se suma al resto de la cédula general y va a la tabla del Art. 241", () => {
    const sal = { id: "s1", owner: "o1", categoria: "Salario", fiscalCode: "LAB_SALARIO", mensual: 20_000_000, tipo: "fijo" };
    const sinArr = det(user({ ingresos: [sal] }));
    const conArr = det(user({ ingresos: [sal, arriendo()] }));
    expect(conArr.rentaLiqCapital - sinArr.rentaLiqCapital).toBe(ARRIENDO_ANUAL);
    // La base sube el arriendo menos el GMF deducible que el motor ya calcula
    // sobre todo el ingreso (0,4 % × 50 %).
    expect(conArr.baseGravable - sinArr.baseGravable).toBeCloseTo(ARRIENDO_ANUAL - ARRIENDO_ANUAL * 0.004 * 0.5, 6);
    expect(conArr.exenta25).toBe(sinArr.exenta25);
    expect(conArr.impBruto).toBeGreaterThan(sinArr.impBruto);
  });

  it("sin «me retienen» no se supone retención; con «me retienen» el saldo a pagar baja $798.000", () => {
    // Otro ingreso sin retención automática, para que haya saldo a pagar.
    const sal = { id: "x1", owner: "o1", categoria: "Otro", fiscalCode: "NOL_OTROS", mensual: 15_000_000, tipo: "fijo" };
    const sinRet = det(user({ ingresos: [sal, arriendo()] }));
    const conRet = det(user({ ingresos: [sal, arriendo({ meRetienen: true })] }));
    expect(sinRet.retencionArrendamiento).toBe(0);
    expect(conRet.retencionArrendamiento).toBeCloseTo(798_000, 6);
    expect(conRet.impBruto).toBe(sinRet.impBruto);
    expect(sinRet.saldoAPagar).toBeGreaterThan(798_000);
    expect(sinRet.saldoAPagar - conRet.saldoAPagar).toBeCloseTo(798_000, 6);
  });

  it("F-210: va en rentas de capital (casillas 58/60/61), no en no laborales ni dividendos", () => {
    const u = user({
      ingresos: [arriendo()],
      gas: { Predial: [{ owner: "o1", fiscalCode: "GAS_INMUEBLE_PREDIAL", m: 250_000 }] }, // 3 M/año
    });
    const est = estimarImpuesto(u, { ag: 2025 });
    const r = generarBorradorF210(u, u.owners[0], est, 2025);
    const val = (n) => r.find(x => x.numero === n);
    expect(val(54).valor).toBe(ARRIENDO_ANUAL);
    expect(val(55).valor).toBe(3_000_000);
    expect(val(60).valor).toBe(0);
    expect(val(70).valor).toBe(0);
    expect(val(71).valor).toBe(0);
    const vals = {}; r.forEach(x => { if (x.valor != null) vals[x.numero] = x.valor; });
    expect(val(53).calc(vals)).toBe(19_800_000);
  });

  it("F-210 AG 2025: casillas oficiales 58 brutos / 59 INCRNGO / 60 costos / 61 renta líquida", () => {
    const u = user({ ingresos: [arriendo()] });
    const r = generarBorradorF210(u, u.owners[0], estimarImpuesto(u, { ag: 2025 }), 2025);
    const val = (n) => r.find(x => x.numero === n);
    expect(val(54).casillaDIAN).toBe(58);
    expect(val(51).casillaDIAN).toBe(59);
    expect(val(55).casillaDIAN).toBe(60);
    expect(val(53).casillaDIAN).toBe(61);
    // 61 = brutos − INCRNGO − costos (todo junto, solo positivo)
    expect(val(53).calc({ 50: 1_000_000, 51: 500_000, 52: 0, 54: 22_800_000, 55: 3_000_000 })).toBe(20_300_000);
    expect(val(53).calc({ 50: 0, 51: 0, 52: 0, 54: 1_000_000, 55: 3_000_000 })).toBe(0);
  });
});
