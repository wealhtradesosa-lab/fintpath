// 21-oct-2026 — Un solo origen para las inversiones: el ingreso con capital se
// vincula a su activo (por nombre o capital) o lo crea en Patrimonio.
import { describe, it, expect } from "vitest";
import { migrateInversionUnica } from "../../src/lib/migrations.js";

describe("migrateInversionUnica", () => {
  it("une VENTA CASCADAS con 50% cascadas por nombre y le pasa la tasa", () => {
    const d = { inv: [{ id: "c", n: "50% cascadas", tp: "Real Estate", va: 800e6, tasa: 0 }], ingresos: [{ id: "v", nombre: "VENTA CASCADAS", categoria: "Intereses bancarios", mensual: 14e6, capital: 800e6, tasa: 21 }] };
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(1);
    expect(d.ingresos[0].activoId).toBe("c");
    expect(d.ingresos[0].desdePatrimonio).toBe(true);
    expect(d.inv[0].tasa).toBe(21);
  });
  it("crea el activo en Patrimonio cuando no existe (préstamo con capital)", () => {
    const d = { inv: [], ingresos: [{ id: "s", nombre: "saldo local 730 a rapicredit", categoria: "Intereses bancarios", mensual: 12.775e6, capital: 730e6, tasa: 21, sim: false }] };
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(1);
    expect(d.inv[0].tp).toBe("Renta Fija");
    expect(d.inv[0].va).toBe(730e6);
    expect(d.inv[0].sim).toBe(false);          // oculto como el ingreso: era un plan, no plata de hoy
    expect(d.ingresos[0].activoId).toBe(d.inv[0].id);
  });
  it("no toca salarios ni ingresos ya vinculados, y corre una sola vez", () => {
    const d = { inv: [{ id: "a", n: "CDT", va: 100e6 }], ingresos: [{ id: "x", nombre: "Salario", categoria: "Salario", mensual: 5e6 }, { id: "y", nombre: "Intereses CDT", categoria: "Intereses bancarios", mensual: 1e6, capital: 100e6, tasa: 12, activoId: "a" }] };
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(1);
    expect(d.ingresos[0].activoId).toBeUndefined();
    const marca = d.migracionInversionUnica; expect(marca).toBeTruthy();
    d.ingresos.push({ id: "z", nombre: "BTG", categoria: "Intereses bancarios", mensual: 1e6, capital: 50e6, tasa: 10 });
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(1); // ya corrió: no vuelve a migrar
  });
});

describe("migrateInversionUnica · planes ocultos", () => {
  it("un ingreso oculto que nombra un inmueble no se le pega: es plata futura", () => {
    const d = { inv: [{ id: "l", n: "local macarena", tp: "Local Comercial", va: 1100e6 }], ingresos: [{ id: "s", nombre: "saldo local 730 a rapicredit", categoria: "Intereses bancarios", mensual: 12.775e6, capital: 730e6, tasa: 21, sim: false }] };
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(2);
    expect(d.ingresos[0].activoId).not.toBe("l");
    expect(d.inv[1].sim).toBe(false);
  });
  it("capital igual une aunque el nombre tenga un typo (RAPICREDTI FONDEO)", () => {
    const d = { inv: [{ id: "r", n: "RAPICREDTI FONDEO", tp: "Fondo de Inversión", va: 3288e6, tasa: 21 }], ingresos: [{ id: "f", nombre: "FONDO HOY RAPICREDIT", fuente: "rapicredit", categoria: "Intereses bancarios", mensual: 39.4e6, capital: 3288e6, tasa: 22 }] };
    migrateInversionUnica(d);
    expect(d.inv.length).toBe(1);
    expect(d.ingresos[0].activoId).toBe("r");
  });
});
