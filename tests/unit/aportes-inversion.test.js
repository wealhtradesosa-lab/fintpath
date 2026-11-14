import { describe, it, expect } from "vitest";
import { registrarAporte, eliminarAporte, aportesInversionDelMes } from "../../src/lib/aportesInversion.js";
import { composicionMes } from "../../src/lib/composicionMes.js";

// 14-nov-2026: aporte extraordinario a una inversión (caso IBKR).
const ibkr = { id: "i1", n: "IBKR", va: 20_000, vc: 15_000, moneda: "USD" };
describe("aportes a inversiones", () => {
  it("sube valor y costo, y queda en el mes", () => {
    const i = registrarAporte(ibkr, { año: 2026, mes: 11, monto: 1_200 });
    expect(i.va).toBe(21_200);
    expect(i.vc).toBe(16_200);
    const r = aportesInversionDelMes({ inv: [i] }, 2026, 11, 4_000);
    expect(r.total).toBe(4_800_000);
    expect(aportesInversionDelMes({ inv: [i] }, 2026, 10, 4_000).total).toBe(0);
  });
  it("si el valor ya lo incluía, no lo suma dos veces; quitarlo deja todo igual", () => {
    const i = registrarAporte(ibkr, { año: 2026, mes: 11, monto: 1_200, yaIncluido: true });
    expect(i.va).toBe(20_000);
    const j = registrarAporte(ibkr, { año: 2026, mes: 11, monto: 1_200 });
    const k = eliminarAporte(j, j.aportes[0].id);
    expect(k.va).toBe(20_000); expect(k.vc).toBe(15_000); expect(k.aportes).toHaveLength(0);
  });
  it("aparece en la composición del mes", () => {
    const u = { ingresos: [], gastos: {}, deudas: [], inv: [registrarAporte({ n: "CDT", va: 0, vc: 0 }, { año: 2026, mes: 11, monto: 5_000_000 })] };
    const c = composicionMes({ user: u, año: 2026, mes: 11, trm: 4000 });
    expect(c.totalInversiones).toBe(5_000_000);
    expect(c.inversiones[0].nombre).toBe("CDT");
  });
});
