// Motor de pensión Colpensiones contra el análisis actuarial de Destina PFT
// (15-abr-2026): cuatro escenarios de un afiliado hombre, 51 años, 1.310,9
// semanas, IBC al tope de 25 SMMLV. Las cifras salen de la presentación.
import { describe, it, expect } from "vitest";
import {
  SMMLV_2026 as SM, tasaReemplazo, liquidarPension, iblProyectado, escenarioCotizar,
  valeLaPenaSeguir, pctFSP, SEMANAS_POR_AÑO, MESADAS_AÑO,
} from "../../src/lib/pensionColpensiones.js";

// [escenario, semanas, IBL 10 años, tasa %, pensión bruta, pensión neta]
const ACTUARIO = [
  ["Parar de cotizar", 1310.90, 32_126_945, 56.33, 18_095_700, 15_924_216],
  ["Completar edad (62)", 1870.19, 43_772_625, 70.00, 30_640_838, 26_473_684],
  ["5,7 años más", 1604.05, 40_396_363, 64.00, 25_853_673, 22_492_695],
  ["7 años más", 1670.91, 41_615_607, 65.50, 27_258_223, 23_660_137],
];

describe("tasa de reemplazo y pensión bruta = actuario", () => {
  for (const [nombre, semanas, ibl, tasa, bruta, neta] of ACTUARIO) {
    it(nombre, () => {
      const r = liquidarPension({ ibl, semanas });
      expect(r.tasa.total).toBeCloseTo(tasa, 2);
      expect(Math.abs(r.bruta - bruta)).toBeLessThan(2);
      // Neta: la escala exacta de solidaridad del actuario no es pública;
      // diferencia de a lo sumo 1,2 % de la mesada.
      expect(Math.abs(r.neta / neta - 1)).toBeLessThan(0.012);
    });
  }
});

describe("reglas de la Ley 797", () => {
  it("S es el IBL en salarios mínimos, no el IBC", () => {
    expect(tasaReemplazo({ iblSM: 32_126_945 / SM, semanas: 1300 }).base).toBeCloseTo(56.33, 2);
  });
  it("tasa base con piso de 55 %", () => {
    expect(tasaReemplazo({ iblSM: 25, semanas: 1300 }).base).toBe(55);
    expect(tasaReemplazo({ iblSM: 1, semanas: 1300 }).base).toBe(65);
  });
  it("1,5 % por bloque completo de 50 semanas", () => {
    expect(tasaReemplazo({ iblSM: 25, semanas: 1349 }).bonus).toBe(0);
    expect(tasaReemplazo({ iblSM: 25, semanas: 1350 }).bonus).toBe(1.5);
  });
  it("tope decreciente: 80 % a 1 SMMLV, 70 % a 25 SMMLV", () => {
    expect(tasaReemplazo({ iblSM: 1, semanas: 3000 }).total).toBe(80);
    const alta = tasaReemplazo({ iblSM: 25, semanas: 1870.19 });
    expect(alta.base + alta.bonus).toBe(71.5); // el 71,5 % que menciona el actuario
    expect(alta.total).toBe(70);
    expect(alta.recortadaPorTope).toBe(true);
  });
  it("13 mesadas y 51,43 semanas por año", () => {
    expect(MESADAS_AÑO).toBe(13);
    expect(SEMANAS_POR_AÑO * 10.88).toBeCloseTo(559.29, 0); // semanas faltantes del actuario
  });
  it("solidaridad: cotizante a 25 SMMLV paga 2 %; pensionado solo desde 10 SMMLV", () => {
    expect(pctFSP(25)).toBe(0.02);
    expect(pctFSP(5)).toBe(0.01);
    expect(pctFSP(9, { pensionado: true })).toBe(0);
  });
});

describe("IBL como ventana móvil de 10 años", () => {
  it("10,88 años al tope dejan el IBL en 25 SMMLV (escenario 3 del actuario)", () => {
    expect(iblProyectado({ iblHoy: 32_126_945, ibcFuturo: 25 * SM, años: 10.88 })).toBe(25 * SM);
  });
  it("parar hoy conserva el IBL de hoy", () => {
    expect(iblProyectado({ iblHoy: 32_126_945, ibcFuturo: 25 * SM, años: 0 })).toBe(32_126_945);
  });
  it("seguir cotizando no se queda con el promedio de hoy (error del motor anterior)", () => {
    const e = escenarioCotizar({ semanasHoy: 1310.9, iblHoy: 32_126_945, ibcSM: 25, años: 10.88 });
    expect(Math.abs(e.bruta - 30_640_838)).toBeLessThan(2);
  });
});

describe("¿vale la pena seguir cotizando? (incremental, no el payback del informe)", () => {
  const v = valeLaPenaSeguir({ sexo: "M", edad: 51.12, semanasHoy: 1310.9, iblHoy: 32_126_945, ibcSM: 25, años: 10.88 });
  it("costo marginal = pensión 16 % + solidaridad 2 %, sin salud", () => {
    expect(v.pctCosto).toBeCloseTo(0.18, 6);
    expect(Math.round(v.costoMes)).toBe(Math.round(0.18 * 25 * SM));
  });
  it("beneficio = solo la diferencia contra parar hoy", () => {
    expect(v.beneficioMesNeto).toBeCloseTo(v.seguir.neta - v.parar.neta, 6);
  });
  it("payback ≈ 7,5 años y TIR real ≈ 7 %", () => {
    expect(v.paybackAños).toBeGreaterThan(7);
    expect(v.paybackAños).toBeLessThan(8);
    expect(v.tirAnual).toBeGreaterThan(6);
    expect(v.tirAnual).toBeLessThan(8);
  });
});

describe("serie de recuperación", () => {
  const v = valeLaPenaSeguir({ sexo: "M", edad: 51.12, semanasHoy: 1310.9, iblHoy: 32_126_945, ibcSM: 25, años: 10.88 });
  it("baja hasta la pensión, luego sube y cruza el cero en el año de recuperación", () => {
    const fondo = Math.min(...v.serie.map((p) => p.acumulado));
    expect(fondo).toBeCloseTo(-v.costoTotal, -3);
    expect(Math.abs(v.añoRecupera - v.añosHastaPension - v.paybackAños)).toBeLessThan(1 / 12 + 1e-9); // resolución mensual
    expect(v.ganaTotal).toBeCloseTo(v.beneficioTotal - v.costoTotal, -3);
  });
});

import { calcularRAIS, capitalPorPesoDeMesada, añosDePago } from "../../src/lib/pensionColpensiones.js";
describe("fondo privado (RAIS), en pesos de hoy", () => {
  it("13 mesadas: el capital por peso de mesada es 13 × la anualidad", () => {
    expect(capitalPorPesoDeMesada(1, 0)).toBe(13);
  });
  it("el cónyuge alarga los años de pago (sustitución)", () => {
    expect(añosDePago({ sexo: "M", edadPension: 62, conyuge: null })).toBeCloseTo(20.7, 1);
    expect(añosDePago({ sexo: "M", edadPension: 62, conyuge: { edadAlPensionarse: 57 } })).toBeCloseTo(27.3, 1);
  });
  it("25 SMMLV, 200 MM de saldo, 10 años al 4 % real: mesada neta de un dígito de millones, no 20 MM", () => {
    const r = calcularRAIS({ saldoHoy: 200e6, ibcSM: 25, rendRealPct: 4, años: 10, sexo: "M", conyuge: { edadAlPensionarse: 57 } });
    expect(r.saldoFinal).toBeGreaterThan(1.0e9);
    expect(r.saldoFinal).toBeLessThan(1.1e9);
    expect(r.retiroProgramado).toBeGreaterThan(3.5e6);
    expect(r.retiroProgramado).toBeLessThan(5.5e6);
    expect(r.rentaVitalicia).toBeLessThan(r.retiroProgramado);
  });
  it("nunca baja de la pensión mínima", () => {
    expect(calcularRAIS({ saldoHoy: 0, ibcSM: 1, años: 1 }).retiroProgramadoBruta).toBe(1_750_905);
  });
});
