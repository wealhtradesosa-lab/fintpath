// 21-oct-2026 — "por favor separar en miles esto es terrible", "lo hemos
// pedido mucho", "siempre lo hace".
//
// La tarjeta de Escenarios mostraba "$6018241,6 mil M" y "$164981833,2 M".
// Causa: seis copias de la misma función abreviaban con toFixed(), que NO
// pone separador de miles. Mientras la cifra cupo en tres dígitos no se notó.
import { describe, it, expect } from "vitest";
import { fmtPlataCortaEs } from "../../src/lib/formato.js";

describe("la plata abreviada SIEMPRE lleva separador de miles", () => {
  it("las cifras de la captura", () => {
    expect(fmtPlataCortaEs(6018241.6e9)).toBe("$6.018.241,6 mil M");
    expect(fmtPlataCortaEs(164981833.2e6)).toBe("$164.981,8 mil M");
  });

  it("la única rama que pasa de tres dígitos es «mil M», y lleva puntos", () => {
    expect(fmtPlataCortaEs(1234.5e9)).toBe("$1.234,5 mil M");
    expect(fmtPlataCortaEs(456.78e6)).toBe("$457 M");   // M y K nunca pasan de 999
    expect(fmtPlataCortaEs(123456)).toBe("$123 K");
  });

  it("no hay cifra, por grande que sea, sin un punto cada tres dígitos", () => {
    for (const n of [1e9, 1e10, 1e12, 1e15, 7.7e13, 3.21e16]) {
      const s = fmtPlataCortaEs(n);
      const entero = s.replace(/^[−$]+/, "").split(" ")[0].split(",")[0];
      expect(entero.replace(/\./g, "").length <= 3 || entero.includes("."), `${n} → ${s}`).toBe(true);
    }
  });

  it("las escalas chicas no cambiaron", () => {
    expect(fmtPlataCortaEs(28.5e6)).toBe("$29 M");   // de 10 M para arriba, entero
    expect(fmtPlataCortaEs(2.5e6)).toBe("$2,5 M");
    expect(fmtPlataCortaEs(850e3)).toBe("$850 K");
    expect(fmtPlataCortaEs(0)).toBe("$0");
  });

  it("los negativos llevan su signo y su separador", () => {
    expect(fmtPlataCortaEs(-1234.5e9)).toBe("−$1.234,5 mil M");
    expect(fmtPlataCortaEs(-456.78e6)).toBe("−$457 M");
  });
});
