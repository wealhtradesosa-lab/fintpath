// Renglón 90 del borrador F-210 = tabla Art. 241 ET sobre la renta líquida
// gravable que el mismo borrador muestra (renglón 81, cédula general sin
// dividendos ni pensiones en estos casos).
import { describe, it, expect } from "vitest";
import { calcImpRenta } from "../../src/lib/tablaArt241.js";
import { estimarImpuesto, uvtForYear } from "../../src/lib/taxCO.js";
import { generarBorradorF210 } from "../../src/lib/borradorDeclaracionF210.js";

const UVT_2025 = uvtForYear(2025);
const TOL = 1000; // ± $1.000

// Tabla Art. 241 ET escrita a mano (fuente: el artículo), en UVT.
const tablaLey = (x) => {
  if (x <= 1090) return 0;
  if (x <= 1700) return (x - 1090) * 0.19;
  if (x <= 4100) return (x - 1700) * 0.28 + 116;
  if (x <= 8670) return (x - 4100) * 0.33 + 788;
  if (x <= 18970) return (x - 8670) * 0.35 + 2296;
  if (x <= 31000) return (x - 18970) * 0.37 + 5901;
  return (x - 31000) * 0.39 + 10352;
};

const impPesos = (pesos) => calcImpRenta(pesos / UVT_2025, UVT_2025);

describe("tabla Art. 241 ET (AG 2025, UVT $49.799)", () => {
  it("UVT AG 2025 = 49.799", () => {
    expect(UVT_2025).toBe(49799);
  });

  it("caso QA: RLG $1.392.469.340 → $459.543.000 ± $1.000", () => {
    expect(Math.abs(impPesos(1_392_469_340) - 459_543_000)).toBeLessThanOrEqual(TOL);
  });

  it("borde exacto 18.970 UVT → 5.901 UVT", () => {
    const esperado = 5901 * UVT_2025; // (18.970 − 8.670) × 35% + 2.296
    expect(Math.abs(calcImpRenta(18970, UVT_2025) - esperado)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(calcImpRenta(18970, UVT_2025) - 293_863_899)).toBeLessThanOrEqual(TOL);
  });

  it("borde exacto 31.000 UVT → 10.352,1 UVT (rango 37%, límite superior inclusivo)", () => {
    const esperado = ((31000 - 18970) * 0.37 + 5901) * UVT_2025;
    expect(Math.abs(calcImpRenta(31000, UVT_2025) - esperado)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(calcImpRenta(31000, UVT_2025) - 515_524_228)).toBeLessThanOrEqual(TOL);
  });

  it("justo por encima de 31.000 UVT aplica 39% + 10.352", () => {
    expect(Math.abs(calcImpRenta(32000, UVT_2025) - 10742 * UVT_2025)).toBeLessThanOrEqual(TOL);
  });

  it("≤ 1.090 UVT no paga impuesto", () => {
    expect(calcImpRenta(1090, UVT_2025)).toBe(0);
    expect(calcImpRenta(500, UVT_2025)).toBe(0);
  });

  it.each([
    [1500, 77.9],     // (1.500 − 1.090) × 19%
    [3000, 480],      // (3.000 − 1.700) × 28% + 116
    [6000, 1415],     // (6.000 − 4.100) × 33% + 788
    [10000, 2761.5],  // (10.000 − 8.670) × 35% + 2.296
    [25000, 8132.1],  // (25.000 − 18.970) × 37% + 5.901
    [27961.8, 9227.966], // caso QA en UVT
  ])("valor intermedio %d UVT → %d UVT de impuesto", (base, impUVT) => {
    expect(Math.abs(calcImpRenta(base, UVT_2025) - impUVT * UVT_2025)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(calcImpRenta(base, UVT_2025) - tablaLey(base) * UVT_2025)).toBeLessThanOrEqual(TOL);
  });
});

// ─── Borrador F-210: renglón 90 coherente con la RLG mostrada ───────────────
const renglones = (user, owner) => {
  const est = estimarImpuesto(user, { incluirPlanOptimizacion: true });
  const r = generarBorradorF210(user, owner, est, 2025);
  const g = (n) => r.find((x) => x.numero === n)?.valor ?? 0;
  return { g, det: est.detalle.find((d) => d.name === owner.name) };
};

const usuarioSalario = (mensual, { gas = {}, deu = [], fiscalProfile } = {}) => {
  const owner = { id: "o1", name: "QA", type: "natural", ...(fiscalProfile ? { fiscalProfile } : {}) };
  return {
    owner,
    user: {
      owners: [owner],
      ingresos: [{ id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual, moneda: "COP" }],
      gas, deu, inv: [],
    },
  };
};

const expectR90CoherenteConR81 = (g) => {
  expect(Math.abs(g(90) - impPesos(g(81)))).toBeLessThanOrEqual(TOL);
};

describe("borrador F-210 AG 2025: renglón 90 = tabla Art. 241 (renglón 81)", () => {
  it("escenario QA (salario alto, sin PV/AFC reales): renglón 41 = 0 y r90 = tabla(r81)", () => {
    // Mismo perfil que reportó QA: antes r81 = $1.392.469.340 (restaba una PV
    // SUGERIDA de $24.349.450) y r90 = $468.550.658 (calculado sin esa PV).
    const { user, owner } = usuarioSalario(126_666_666.67);
    const { g, det } = renglones(user, owner);
    expect(det.pensionVol).toBeGreaterThan(0); // la sugerencia sigue existiendo en el motor
    expect(g(41)).toBe(0);                    // pero no entra al borrador
    expect(Math.abs(g(81) - det.baseGravable)).toBeLessThanOrEqual(1);
    expectR90CoherenteConR81(g);
  });

  it("RLG del borrador = $1.392.469.340 → renglón 90 = $459.543.000 ± $1.000", () => {
    // Salario que produce exactamente la RLG del reporte con la lógica corregida.
    let lo = 1e8, hi = 2e8;
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      const { user, owner } = usuarioSalario(m);
      if (renglones(user, owner).g(81) < 1_392_469_340) lo = m; else hi = m;
    }
    const { user, owner } = usuarioSalario(lo);
    const { g } = renglones(user, owner);
    expect(Math.abs(g(81) - 1_392_469_340)).toBeLessThanOrEqual(1);
    expect(Math.abs(g(90) - 459_543_000)).toBeLessThanOrEqual(TOL);
  });

  it("con PV real cargada en Egresos, el renglón 41 muestra el aporte real y r90 = tabla(r81)", () => {
    const { user, owner } = usuarioSalario(40_000_000, {
      gas: { "Aporte tributario": [{ c: "Fondo PV", m: 1_000_000, t: "f", freq: "mes", owner: "o1", fiscalCode: "AP_TRIB_PV" }] },
    });
    const { g } = renglones(user, owner);
    expect(g(41)).toBe(12_000_000);
    expectR90CoherenteConR81(g);
  });

  it("deducciones + renta exenta 25% por encima del tope Art. 336 (1.340 UVT): r90 = tabla(r81)", () => {
    // Intereses de vivienda 1.200 UVT + exenta 25% (790 UVT) > 1.340 UVT.
    const { user, owner } = usuarioSalario(60_000_000, {
      deu: [{ id: "d1", owner: "o1", fiscalCode: "DEU_NAT_VIVIENDA_HABITACIONAL", mt: 800_000_000, ts: 12 }],
    });
    const { g, det } = renglones(user, owner);
    expect(g(43) + g(44)).toBeLessThanOrEqual(1340 * UVT_2025 + 1);
    expect(Math.abs(g(81) - det.baseGravable)).toBeLessThanOrEqual(1);
    expectR90CoherenteConR81(g);
  });
});
