// 22-oct-2026 — "Uno debería poder mover las franjas y, de acuerdo a lo que
// prime, el sistema dice: este escenario es balanceado, o es base protección
// con x% renta y crecimiento, o es crecimiento con 25% renta y 25%
// protección. Uno lo mueve y de acuerdo a eso, al momento de poner las
// inversiones nuevas, uno sigue esos parámetros."
//
// El nombre no se elige de una lista: sale de la mezcla.
import { describe, it, expect } from "vitest";
import { nombrarMezcla, moverMezcla, CAMINOS_BASE } from "../../src/lib/caminos.js";

describe("la mezcla se nombra sola", () => {
  it("si las tres pesan parecido, es balanceado", () => {
    expect(nombrarMezcla({ proteccion: 33, rentas: 34, crecimiento: 33 }).titulo).toBe("Balanceado");
    expect(nombrarMezcla({ proteccion: 30, rentas: 38, crecimiento: 32 }).titulo).toBe("Balanceado");
  });
  it("si una se lleva la mitad o más, manda: «Base ...»", () => {
    expect(nombrarMezcla({ proteccion: 25, rentas: 25, crecimiento: 50 }).titulo).toBe("Base crecimiento");
    expect(nombrarMezcla({ proteccion: 60, rentas: 30, crecimiento: 10 }).titulo).toBe("Base protección");
  });
  it("si solo inclina, lo dice distinto", () => {
    expect(nombrarMezcla({ proteccion: 20, rentas: 45, crecimiento: 35 }).titulo).toBe("Inclinado a renta");
  });
  it("y el detalle nombra a las otras dos, en sus palabras", () => {
    expect(nombrarMezcla({ proteccion: 25, rentas: 25, crecimiento: 50 }).detalle).toBe("50% ahí, 25% en protección y 25% en renta");
  });
  it("las tres plantillas se nombran coherentes con lo que son", () => {
    const t = Object.fromEntries(CAMINOS_BASE.map((c) => [c.id, nombrarMezcla(c.objetivo).titulo]));
    expect(t.crecimiento).toBe("Base crecimiento");
    expect(t.balance).toBe("Base renta");
    expect(t.seguridad).toBe("Base protección");
  });
});

describe("mover una franja acomoda las otras dos", () => {
  const o = { proteccion: 35, rentas: 50, crecimiento: 15 };
  it("siempre suman 100, muevas lo que muevas", () => {
    for (const k of ["proteccion", "rentas", "crecimiento"]) {
      for (const v of [0, 5, 33, 50, 80, 100]) {
        const r = moverMezcla(o, k, v);
        expect(r.proteccion + r.rentas + r.crecimiento, `${k}=${v}`).toBe(100);
        expect(r[k], `${k}=${v}`).toBe(v);
      }
    }
  });
  it("reparte la diferencia en proporción a lo que ya había", () => {
    const r = moverMezcla(o, "crecimiento", 60);
    expect(r.crecimiento).toBe(60);
    expect(r.rentas).toBeGreaterThan(r.proteccion); // renta pesaba más y sigue pesando más
  });
  it("llevar una a 100 deja las otras en cero", () => {
    const r = moverMezcla(o, "crecimiento", 100);
    expect(r).toEqual({ proteccion: 0, rentas: 0, crecimiento: 100 });
  });
  it("y ninguna queda negativa", () => {
    const r = moverMezcla({ proteccion: 0, rentas: 0, crecimiento: 100 }, "proteccion", 10);
    expect(Math.min(r.proteccion, r.rentas, r.crecimiento)).toBeGreaterThanOrEqual(0);
  });
});
