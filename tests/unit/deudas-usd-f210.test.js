// 23-nov-2026 — fix/deudas-usd-f210. Renglón 30 (pasivos) del F-210: las deudas
// en USD se pasan a pesos con la TRM del 31-dic del año gravable (Art. 269 ET),
// no con la última TRM guardada. Sin esa tasa, la deuda en USD no se suma sin
// convertir: el renglón queda «pendiente de tasa». Y nada de 4200 de respaldo.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { generarBorradorF210, pasivosRenglon30, textoValorRenglon, NOTA_PASIVOS_PENDIENTE_TASA } from "../../src/lib/borradorDeclaracionF210.js";
import { trmCierreAno, TRM_CIERRE_ANO } from "../../src/lib/trm.js";
import { calcularRetencionIngreso, calcularRetencionOwner } from "../../src/lib/retencionesTax.js";
import { buildTaxContext } from "../../src/components/ChatAgenteTributario.jsx";

const owner = { id: "o1", name: "QA", type: "natural" };
const borrador = (deu, extra = {}, ano = 2026) => {
  const user = {
    owners: [owner],
    ingresos: [{ id: "i1", owner: "o1", fiscalCode: "LAB_SALARIO", mensual: 4_000_000, moneda: "COP" }],
    inv: [{ id: "a1", owner: "o1", tp: "Cash", va: 100_000_000 }],
    deu, ...extra,
  };
  const est = estimarImpuesto(user, { añoGravable: ano });
  const r = generarBorradorF210(user, owner, est, ano);
  return { r, row: (n) => r.find((x) => x.numero === n) };
};

describe("F-210 renglón 30 · deudas en USD", () => {
  it("10.000 USD con TRM del 31-dic de 4.000 → renglón 30 = 40.000.000", () => {
    // 2026 aún no cierra: no está en la serie oficial; se usa la TRM del 31-dic cargada para ese año.
    const { row } = borrador([{ id: "d1", owner: "o1", saldo: 10_000, moneda: "USD" }], { trm: 4100, trmCierre: { 2026: 4000 } });
    expect(row(30).valor).toBe(40_000_000);
    expect(row(30).pendienteTasa).toBeUndefined();
    expect(row(31).valor).toBe(100_000_000 - 40_000_000);
  });

  it("usa la TRM del 31-dic del año gravable, no la última TRM guardada", () => {
    const { row } = borrador([{ id: "d1", owner: "o1", saldo: 10_000, moneda: "usd" }], { trm: 4100 }, 2025);
    expect(TRM_CIERRE_ANO[2025]).toBe(3757.08);
    expect(row(30).valor).toBeCloseTo(10_000 * 3757.08, 2);
    expect(row(30).valor).not.toBe(10_000 * 4100);
  });

  it("deuda en USD sin TRM del 31-dic → «pendiente de tasa», no se suma sin convertir", () => {
    const { row } = borrador([
      { id: "d1", owner: "o1", saldo: 10_000, moneda: "USD" },
      { id: "d2", owner: "o1", saldo: 5_000_000, moneda: "COP" },
    ], { trm: 4100 }); // hay TRM del día, pero no la del 31-dic de 2026
    const r30 = row(30);
    expect(r30.pendienteTasa).toBe(true);
    expect(r30.nota).toBe(NOTA_PASIVOS_PENDIENTE_TASA);
    expect(r30.valor).toBe(5_000_000); // solo pesos: los 10.000 USD no entran como $10.000
    expect(textoValorRenglon(r30, (n) => "$" + n)).toBe("pendiente de tasa");
    expect(row(31).pendienteTasa).toBe(true);
  });

  it("deudas en pesos: igual que antes", () => {
    const deu = [
      { id: "d1", owner: "o1", saldo: 12_000_000 },
      { id: "d2", owner: "o1", s: 3_000_000, moneda: "COP" },
      { id: "d3", owner: "o1", mt: 1_500_000 },
    ];
    const { row } = borrador(deu);
    expect(row(30).valor).toBe(16_500_000);
    expect(row(30).pendienteTasa).toBeUndefined();
    expect(pasivosRenglon30(deu, null)).toEqual({ total: 16_500_000, pendienteTasa: false });
  });

  it("si el usuario escribió el renglón 30 a mano, manda su cifra", () => {
    const { row } = borrador([{ id: "d1", owner: "o1", saldo: 10_000, moneda: "USD" }],
      { borradorDeclaracion: { o1: { 2026: { 30: 7_000_000 } } } });
    expect(row(30).valor).toBe(7_000_000);
    expect(row(30).pendienteTasa).toBeUndefined();
  });

  it("trmCierreAno: nunca la TRM del día ni el 4200", () => {
    expect(trmCierreAno({ trm: 4100 }, 2026)).toBeNull();
    expect(trmCierreAno({ trmCierre: { 2026: 4200 } }, 2026)).toBeNull();
    expect(trmCierreAno({}, 2024)).toBe(4409.15);
  });
});

describe("sin TRM no se usa 4200", () => {
  const ingUSD = { id: "u1", owner: "o1", fiscalCode: "LAB_HONORARIOS_SIN_EMPLEADOS", mensual: 1_000, moneda: "USD", tipo: "fijo" };
  it("retenciones: un ingreso en USD sin TRM queda pendiente de tasa", () => {
    for (const trm of [undefined, null, 0, 4200]) {
      const r = calcularRetencionIngreso(ingUSD, "juridica", trm);
      expect(r.anual).toBe(0);
      expect(r.pendienteTasa).toBe(true);
    }
    expect(calcularRetencionOwner([ingUSD], { type: "juridica" }).pendienteTasa).toBe(true);
    expect(calcularRetencionIngreso(ingUSD, "juridica", 4000).anual).toBeGreaterThan(0);
  });

  it("chat tributario: sin TRM, los activos en USD quedan «pendiente de tasa»", () => {
    const u = { inv: [{ owner: "o1", va: 10_000, moneda: "USD" }, { owner: "o1", va: 50_000_000 }], ingresos: [], gas: {}, deu: [] };
    const ctx = buildTaxContext(u, null, owner);
    expect(ctx).toContain("$50.000.000");
    expect(ctx).toContain("pendiente de tasa");
    expect(ctx).not.toContain("42.000.000");
    expect(buildTaxContext({ ...u, trm: 4000 }, null, owner)).toContain("$90.000.000");
  });

  it("no queda un 4200 escrito a mano en ChatAgenteTributario, recomendacionesEstrategicas ni retencionesTax", () => {
    for (const f of ["src/components/ChatAgenteTributario.jsx", "src/lib/recomendacionesEstrategicas.js", "src/lib/retencionesTax.js"]) {
      const src = readFileSync(resolve(__dirname, "../..", f), "utf8");
      expect(src, f).not.toMatch(/\b4_?200\b(?![._\d])/);
    }
  });
});
