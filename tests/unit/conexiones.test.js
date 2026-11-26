import { describe, it, expect } from "vitest";
import { mapaConexiones, cuentaDeActivo } from "../../src/lib/conexiones.js";

// 26-nov-2026 (Santiago: "District, conectado a deuda District, ingreso District y gasto property management District";
// "¿cómo puede existir un ingreso o inversión sin conexiones?").
const user = { trm: 4000,
  inv: [{ id: "di", n: "District 225", tp: "Real Estate", va: 300000, moneda: "USD" }, { id: "or", n: "Casa Orlando", tp: "Real Estate", va: 1500e6 }, { id: "lo", n: "Lote Macarena", tp: "Real Estate", va: 400e6 }],
  ingresos: [{ nombre: "Salario Sosa", categoria: "Salario", mensual: 30e6 }, { nombre: "DISTRICT", categoria: "Otro", mensual: 6.2e6 }, { nombre: "Arriendo Orlando", categoria: "Arriendo", mensual: 7e6, activoId: "or" },
    { nombre: "Arriendo bodega", categoria: "Arriendo", mensual: 3e6 }, { nombre: "Honorarios", categoria: "Honorarios", mensual: 8e6 }],
  gas: { Vida: [{ n: "Mercado", m: 5e6 }], Propiedades: [{ n: "Property management District", m: 900e3 }, { n: "Predial finca", m: 400e3 }, { n: "Administración Orlando", m: 1e6, activoId: "or" }] },
  deu: [{ id: "d1", n: "Hipoteca District", mt: 100000, pg: 800, moneda: "USD" }, { id: "d2", n: "Crédito Orlando", mt: 600e6, pg: 7e6, la: "or" }, { id: "d3", n: "Tarjeta Visa", mt: 5e6, pg: 1e6 }] };
const m = mapaConexiones(user);
const ing = (n) => m.ingresos.find((x) => x.nombre === n), gas = (n) => m.gastos.find((x) => x.nombre === n), deu = (n) => m.deudas.find((x) => x.nombre === n);

describe("mapaConexiones: qué está conectado, qué no lo necesita y qué está suelto por error", () => {
  it("un salario y unos honorarios no necesitan conexión", () => {
    expect(ing("Salario Sosa").estado).toBe("libre"); expect(ing("Honorarios").estado).toBe("libre");
    expect(gas("Mercado").estado).toBe("libre"); expect(deu("Tarjeta Visa").estado).toBe("libre");
  });
  it("lo conectado dice a qué inversión", () => {
    expect(ing("Arriendo Orlando")).toMatchObject({ estado: "conectado", activoId: "or" });
    expect(gas("Administración Orlando")).toMatchObject({ estado: "conectado", activoId: "or" });
    expect(deu("Crédito Orlando")).toMatchObject({ estado: "conectado", activoId: "or" });
  });
  it("un ingreso, gasto o deuda con el nombre de una inversión, o un arriendo o predial sin inversión, queda por revisar", () => {
    expect(ing("DISTRICT")).toMatchObject({ estado: "revisar", sugiere: "di" });
    expect(gas("Property management District")).toMatchObject({ estado: "revisar", sugiere: "di" });
    expect(deu("Hipoteca District")).toMatchObject({ estado: "revisar", sugiere: "di" });
    expect(ing("Arriendo bodega")).toMatchObject({ estado: "revisar", sugiere: null });
    expect(gas("Predial finca").estado).toBe("revisar");
  });
  it("la ficha de la inversión propone sus sueltos y, ya conectados, hace la cuenta", () => {
    expect(m.activos.di.sugeridos.map((x) => x.tipo).sort()).toEqual(["deuda", "gasto", "ingreso"]);
    expect(cuentaDeActivo(m, "di", 1200e6).conexiones).toBe(0);
    const u2 = { ...user, ingresos: user.ingresos.map((i) => (i.nombre === "DISTRICT" ? { ...i, activoId: "di" } : i)),
      gas: { ...user.gas, Propiedades: user.gas.Propiedades.map((g) => (/District/.test(g.n) ? { ...g, activoId: "di" } : g)) }, deu: user.deu.map((d) => (d.id === "d1" ? { ...d, la: "di" } : d)) };
    const c = cuentaDeActivo(mapaConexiones(u2), "di", 1200e6);
    expect(c.conexiones).toBe(3); expect(c.sugeridos.length).toBe(0);
    expect(c.entra).toBe(6.2e6); expect(c.sale).toBe(900e3); expect(c.cuotas).toBe(800 * 4000);
    expect(c.deja).toBe(6.2e6 - 900e3 - 3.2e6);               // entra − sale − cuota =
    expect(c.debes).toBe(400e6); expect(c.tuyo).toBe(1200e6 - 400e6);
  });
  it("una inversión sin nada conectado ni nada parecido no tiene pendientes (un lote)", () => {
    const c = cuentaDeActivo(m, "lo", 400e6);
    expect(c.conexiones).toBe(0); expect(c.sugeridos.length).toBe(0);
  });
});
