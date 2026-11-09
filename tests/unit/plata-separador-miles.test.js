// 21-oct-2026 — "por favor separar en miles esto es terrible".
// 9-nov-2026 — Santiago: "debemos mostrar los valores con todos los ceros,
// pues en pesos sí que se confunde uno". Nada se abrevia (ni MM, ni K, ni
// billones): la cifra completa, siempre con un punto cada tres dígitos.
import { describe, it, expect } from "vitest";
import { fmtPlataEs, fmtPlataCortaEs, fmtDolaresEs, fmtEjeEs } from "../../src/lib/formato.js";

describe("la plata va completa, con todos los ceros", () => {
  it("las cifras de la captura de BTC", () => {
    expect(fmtPlataEs(5236408054.98)).toBe("$5.236.408.055");
    expect(fmtPlataEs(26182040)).toBe("$26.182.040");
    expect(fmtPlataEs(350e6)).toBe("$350.000.000");
  });

  it("cifras absurdas también completas: los ceros dejan ver el absurdo", () => {
    expect(fmtPlataEs(6018241.6e9)).toBe("$6.018.241.600.000.000");
  });

  it("chicas, cero y negativas", () => {
    expect(fmtPlataEs(850e3)).toBe("$850.000");
    expect(fmtPlataEs(0)).toBe("$0");
    expect(fmtPlataEs(-1234.5e9)).toBe("−$1.234.500.000.000");
  });

  it("el nombre viejo da lo mismo; dólares con US$; ejes sin $", () => {
    expect(fmtPlataCortaEs(28.5e6)).toBe("$28.500.000");
    expect(fmtDolaresEs(41564714)).toBe("US$41.564.714");
    expect(fmtEjeEs(5e9)).toBe("5.000.000.000");
  });
});
