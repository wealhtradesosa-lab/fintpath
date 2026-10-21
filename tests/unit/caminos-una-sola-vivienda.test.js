// 21-oct-2026 — Dos filas decían "Tu vivienda: protege, no produce".
//
// En la captura de la cuenta real, Puerto madero ($9 mil M) y orlando
// ($1,8 mil M) mostraban los dos el mismo rótulo, y los dos con renta al lado.
// Causa: `conCanasta` marcaba `vivienda: true` a CUALQUIER inmueble puesto en
// la canasta Protección. Protección no es "donde vivo": un segundo inmueble
// puede estar ahí sin que uno viva en él. Y `medirCanastas` suma `c.vivienda`
// por cada uno, así que contaba dos casas donde hay una.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario, conCanasta, medirCanastas } from "../../src/lib/caminos.js";

const user = (inv, ingresos = [], fichas = undefined) => ({ trm: 4200, inv, ingresos, gas: {}, deu: [] });

describe("Protección no convierte un inmueble en tu vivienda", () => {
  it("ponerlo en Protección ya no lo marca como la casa donde vives", () => {
    const f = conCanasta({ canasta: "proteccion", inmueble: true }, undefined, "Real Estate");
    expect(f.vivienda).toBe(false);
  });

  it("pero si YA era la vivienda, ponerlo en Protección no se la quita", () => {
    const f = conCanasta({ canasta: "proteccion", inmueble: true, vivienda: true }, undefined, "Real Estate");
    expect(f.vivienda).toBe(true);
  });

  it("dos inmuebles en Protección: una sola vivienda, no dos", () => {
    const inv = [
      { id: "a", n: "Puerto madero", tp: "Real Estate", va: 9000e6 },
      { id: "b", n: "orlando", tp: "Real Estate", va: 1800e6 },
    ];
    const base = baseDesdeUsuario(user(inv), undefined, { a: { canasta: "proteccion" }, b: { canasta: "proteccion" } });
    expect(base.posiciones.filter((p) => p.vivienda)).toHaveLength(1);
  });
});

describe("la vivienda es una, aunque el nombre le pegue a varios activos", () => {
  it("entre dos «casa», manda la de mayor capital", () => {
    const inv = [
      { id: "a", n: "casa de la playa", tp: "Real Estate", va: 300e6 },
      { id: "b", n: "casa donde vivo", tp: "Real Estate", va: 900e6 },
    ];
    const casas = baseDesdeUsuario(user(inv)).posiciones.filter((p) => p.vivienda);
    expect(casas).toHaveLength(1);
    expect(casas[0].id).toBe("b");
  });

  it("el metro de vivienda deja de contar dos veces", () => {
    const inv = [
      { id: "a", n: "casa de la playa", tp: "Real Estate", va: 300e6 },
      { id: "b", n: "casa donde vivo", tp: "Real Estate", va: 900e6 },
    ];
    const c = medirCanastas(baseDesdeUsuario(user(inv)).posiciones, 0);
    expect(c.vivienda).toBe(900e6); // antes: 1.200e6
  });

  it("si ninguna se llama casa, el respaldo sigue eligiendo una sola", () => {
    const inv = [
      { id: "a", n: "Puerto madero", tp: "Real Estate", va: 9000e6 },
      { id: "b", n: "orlando", tp: "Real Estate", va: 1800e6 },
    ];
    const casas = baseDesdeUsuario(user(inv)).posiciones.filter((p) => p.vivienda);
    expect(casas).toHaveLength(1);
    expect(casas[0].id).toBe("a");
  });

  it("un inmueble que renta no es la vivienda", () => {
    const inv = [{ id: "a", n: "casa donde vivo", tp: "Real Estate", va: 900e6 }];
    const ingresos = [{ id: "r", nombre: "Arriendo", categoria: "Arriendo", mensual: 4e6, activoId: "a" }];
    const p = baseDesdeUsuario(user(inv, ingresos)).posiciones[0];
    expect(p.renta).toBe(4e6);
    expect(p.vivienda).toBeFalsy();
  });
});
