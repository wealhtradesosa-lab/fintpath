import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { calcularBase } from "../../src/lib/metrics.js";

// QA PR #56: «faltante de BTG distinto en 3 corridas». Mismos datos → mismo número, siempre.
const usuario = () => ({ inflacionPct: 5, trm: 4000, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 200e6 }, { id: "a", n: "Apto", tp: "Inmueble", va: 500e6 }],
  ingresos: [{ id: "s", nombre: "Salario", mensual: 20e6 }], gas: { Vida: [{ n: "x", m: 8e6 }] }, deu: [{ id: "d", n: "Hipo", mt: 100e6, pg: 2e6, ts: 12 }], metas: [] });
const cfg = () => ({ nuevas: [{ preset: "custom", nombre: "BTG", monto: 6.5e9, rendimientoNomPct: 14, anio: 1, tipo: "renta", moneda: "COP" },
  { preset: "custom", nombre: "Año 3", monto: 300e6, rendimientoNomPct: 12, anio: 3, tipo: "renta" }] });
const huella = (r) => JSON.stringify([r.nuevasDetalle.map((d) => [d.faltante, d.invertido, d.rentaMensualFondeada]), r.filas.map((f) => [f.rentaNueva, f.patrimonioReal, f.rentaPasivaReal]), r.alertas.filter((a) => a.tipo === "faltante").map((a) => a.monto)]);

describe("Futuro10: determinismo del faltante (BTG)", () => {
  it("50 corridas con los mismos datos (objetos reusados y copias nuevas, con otras pantallas usando calcularBase en medio) dan exactamente lo mismo", () => {
    const u = usuario(), c = cfg(), ref = huella(proyectarFuturo10(u, c));
    for (let i = 0; i < 50; i++) {
      calcularBase(usuario(), { base: "mes", anio: 2026, mes: 1 + (i % 12) }); // estado global de otra pantalla
      expect(huella(proyectarFuturo10(i % 2 ? u : usuario(), i % 2 ? c : cfg()))).toBe(ref);
    }
    expect(JSON.stringify(u)).toBe(JSON.stringify(usuario())); // no muta la entrada
    expect(JSON.stringify(c)).toBe(JSON.stringify(cfg()));
  });
  it("año 3 con faltante: al flujo y a los totales solo entra la renta de la parte con plata", () => {
    const r = proyectarFuturo10(usuario(), cfg()), sinY3 = proyectarFuturo10(usuario(), { nuevas: [cfg().nuevas[0]] });
    const d = r.nuevasDetalle.find((x) => x.nombre === "Año 3");
    expect(d.faltante).toBeGreaterThan(0);
    const extra = r.filas[3].rentaNueva - sinY3.filas[3].rentaNueva;
    expect(extra / 12).toBeCloseTo(d.rentaMensualFondeada, -2);
    expect(extra).toBeLessThan(300e6 * 0.12 * 0.99);
    expect(r.filas[3].rentaPasivaReal - sinY3.filas[3].rentaPasivaReal).toBeCloseTo(extra / 1.05 ** 2, -3);
  });
});
