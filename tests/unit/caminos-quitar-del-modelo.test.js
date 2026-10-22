// 21-oct-2026 — "uno debería poder borrar algún item si no va en el modelo".
//
// El paso 1 tenía dos estados para tres situaciones: «continúa» y «ya no va»
// (que era la VENTA de hoy). La tercera —esto no va acá: no es mío, está
// repetido, lo inventó la pantalla a partir de un ingreso— no tenía dónde
// entrar, y vender no es lo mismo que no tener: lo vendido libera plata, lo
// quitado simplemente deja de contar.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario, medirCanastas } from "../../src/lib/caminos.js";

const user = (extra = {}) => ({
  trm: 4200,
  inv: [
    { id: "casa", n: "casa donde vivo", tp: "Real Estate", va: 900e6 },
    { id: "lote", n: "lote del abuelo", tp: "Real Estate", va: 300e6 },
  ],
  ingresos: [{ id: "sueldo", nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }],
  gas: { Hogar: [{ id: "g1", nombre: "Mercado", mensual: 3e6 }] },
  deu: [],
  ...extra,
});

describe("quitar del modelo lo que no va", () => {
  it("el activo quitado sale de la lista y se puede nombrar", () => {
    const b = baseDesdeUsuario(user(), undefined, { lote: { estado: "fuera" } });
    expect(b.posiciones.map((p) => p.id)).toEqual(["casa"]);
    expect(b.fuera).toHaveLength(1);
    expect(b.fuera[0]).toMatchObject({ id: "lote", nombre: "lote del abuelo", capital: 300e6 });
  });

  it("deja de sumar al patrimonio y a las canastas", () => {
    const con = baseDesdeUsuario(user());
    const sin = baseDesdeUsuario(user(), undefined, { lote: { estado: "fuera" } });
    expect(con.base.patrimonioNeto - sin.base.patrimonioNeto).toBe(300e6);
    expect(medirCanastas(con.posiciones, 0).total - medirCanastas(sin.posiciones, 0).total).toBe(300e6);
  });

  it("quitar NO es vender: no libera un peso", () => {
    const quitado = baseDesdeUsuario(user(), undefined, { lote: { estado: "fuera" } });
    const vendido = baseDesdeUsuario(user(), undefined, { lote: { estado: "sale" } });
    expect(quitado.hoy.liberado).toBe(0);
    expect(vendido.hoy.liberado).toBe(300e6);
    expect(vendido.posiciones.map((p) => p.id)).toContain("lote"); // vendido sigue en la lista
  });

  it("se devuelve tal como estaba", () => {
    const b = baseDesdeUsuario(user(), undefined, { lote: { estado: "continua" } });
    expect(b.posiciones.map((p) => p.id)).toContain("lote");
    expect(b.fuera).toHaveLength(0);
  });
});

describe("lo que colgaba de lo quitado se va con ello", () => {
  const conArriendo = () => user({
    inv: [{ id: "bodega", n: "bodega", tp: "Bodega", va: 500e6 }],
    ingresos: [
      { id: "sueldo", nombre: "Sueldo", categoria: "Salario", mensual: 10e6 },
      { id: "arr", nombre: "Arriendo bodega", categoria: "Arriendo", mensual: 4e6, activoId: "bodega" },
    ],
    gas: { "Inmueble arrendado": [{ id: "g2", nombre: "Predial bodega", mensual: 1e6, activoId: "bodega" }] },
  });

  it("la renta de un activo quitado no entra, y su gasto no pesa", () => {
    const con = baseDesdeUsuario(conArriendo());
    const sin = baseDesdeUsuario(conArriendo(), undefined, { bodega: { estado: "fuera" } });
    expect(con.base.ip).toBeGreaterThan(0);
    expect(sin.base.ip).toBe(0);
    expect(sin.flujos.some((f) => f.id === "ing_arr")).toBe(false);
    // El predial se neteaba contra la renta; sin el activo no reaparece como gasto de vida.
    expect(sin.base.g).toBe(con.base.g);
  });

  it("la posición que la pantalla inventa desde un ingreso también se quita", () => {
    const u = user({
      inv: [],
      ingresos: [{ id: "btg", nombre: "BTG Pactual", categoria: "Rendimientos financieros", mensual: 5e6, capital: 600e6, tasa: 10 }],
    });
    const con = baseDesdeUsuario(u);
    expect(con.posiciones.map((p) => p.id)).toEqual(["cap_btg"]);
    expect(con.posiciones[0].soloIngreso).toBe(true);

    const sin = baseDesdeUsuario(u, undefined, { cap_btg: { estado: "fuera" } });
    expect(sin.posiciones).toHaveLength(0);
    expect(sin.fuera).toMatchObject([{ id: "cap_btg", nombre: "BTG Pactual", capital: 600e6, soloIngreso: true }]);
    expect(sin.base.ip).toBe(0);
  });
});
