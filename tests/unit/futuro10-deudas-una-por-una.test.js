import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";

// 26-nov-2026 — Al pagar una deuda, las otras no pueden quedar pagadas a medias. Antes, lo que quedaba de cada deuda se
// calculaba sobre el total del día uno: después de pagar una, a la siguiente le tocaba menos, se pagaba una parte y el
// resto quedaba en el patrimonio todos los años, sin cuota.
const Y = new Date().getFullYear();
const user = { inflacionPct: 4,
  inv: [{ id: "lo", n: "Local", tp: "Real Estate", va: 1400e6 }, { id: "or", n: "Casa Orlando", tp: "Real Estate", va: 1950e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 900e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 60e6 }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] },
  deu: [{ id: "dl", n: "Deuda del local", mt: 450e6, pg: 9e6, ts: 12, la: "lo" }, { id: "do", n: "Crédito Casa Orlando", mt: 600e6, pg: 7e6, ts: 9, la: "or" }] };

describe("deudas: cada una se paga completa", () => {
  it("vender un activo paga su deuda y pagar la otra el mismo año deja la deuda en cero", () => {
    const r = proyectarFuturo10(user, { decisiones: { or: { accion: "termina", desde: 2 } }, pagarDeudas: { dl: Y + 1 } });
    expect(r.filas[2].deuda).toBeLessThan(1);
    expect(r.filas[10].deuda).toBeLessThan(1);
    expect(r.filas[2].cuota).toBeLessThan(1);
    // El patrimonio ya no carga una deuda fantasma.
    expect(r.filas[10].activos - r.filas[10].patrimonio).toBeLessThan(1);
  });
  it("pagar una sola deja exactamente la parte de la otra, que se sigue pagando con su cuota", () => {
    const base = proyectarFuturo10(user, {});
    const r = proyectarFuturo10(user, { pagarDeudas: { dl: Y + 1 } });
    const d = r.deudas.find((x) => x.id === "dl");
    // Lo que se paga es la parte del local de lo que se debía al empezar ese año: 450 de 1.050.
    expect(d.pagoEnAnio).toBeCloseTo(base.filas[1].deuda * 450 / 1050, -3);
    expect(r.filas[2].cuota).toBeCloseTo(7e6 * 12, -3);
    expect(r.filas[2].deuda).toBeGreaterThan(1);
  });
  it("pagar las dos en años distintos también termina en cero", () => {
    const r = proyectarFuturo10(user, { pagarDeudas: { dl: Y + 1, do: Y + 2 } });
    expect(r.filas[3].deuda).toBeLessThan(1);
    expect(r.filas[3].cuota).toBeLessThan(1);
  });
  it("sin pagar nada antes, el plan no cambia", () => {
    const r = proyectarFuturo10(user, {});
    expect(r.filas[1].deuda).toBeGreaterThan(0);
    expect(r.filas[1].cuota).toBeCloseTo(16e6 * 12, -3);
  });
});
