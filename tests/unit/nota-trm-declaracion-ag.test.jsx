// 24-nov-2026 — La nota de TRM de Impuestos (taxcalc/taxdet) usa el año gravable
// fijo de la app (DEFAULT_AG, el del borrador F-210), no el año calendario.
// Con el reloj en marzo de 2027, el AG sigue siendo 2026 hasta que exista la UVT
// de 2027. Datos de prueba inventados.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const conUSD = { trm: 4100, deu: [{ id: "d1", mt: 1000, moneda: "USD" }] };

describe("nota TRM de la declaración con el reloj en 2027", () => {
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); });
  it("2027-03-15 → sigue AG 2026 / 31-dic-2026 y «pendiente de tasa»", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-03-15T12:00:00-05:00"));
    vi.resetModules();
    const A = await import("../../src/App.jsx");
    const { DEFAULT_AG } = await import("../../src/lib/taxCO.js");
    expect(new Date().getFullYear()).toBe(2027);
    expect(DEFAULT_AG).toBe(2026);
    const html = renderToStaticMarkup(React.createElement(A.NotaTrmDeclaracion, { u: conUSD }));
    expect(html).toContain("TRM del 31-dic-2026 (pendiente de tasa)");
    expect(html).not.toContain("31-dic-2027");
    expect(A.notaTrmDeclaracion(conUSD)).toContain("31-dic-2026");
    // Copy de Tributario: mismo AG de la nota, sin «sola» (la TRM del 31-dic no se llena automáticamente).
    expect(html).toContain("Se completa cuando se conozca la TRM vigente el 31-dic-2026.");
    expect(A.notaTrmDeclaracion({ ...conUSD }, 2025)).not.toContain("Se completa");
  });
});
