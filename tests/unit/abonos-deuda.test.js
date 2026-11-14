import { describe, it, expect } from "vitest";
import { simularAbono, registrarAbono, eliminarAbono, abonosDelMes, tablaYaTraeAbono } from "../../src/lib/abonosDeuda.js";
import { cuotaDeudaDelMes, deudaViva } from "../../src/lib/flujoMes.js";
import { costoCredito } from "../../src/lib/flowHelpers.js";

// 14-nov-2026: abono extraordinario a una deuda (caso Deepal).
const deepal = { id: "d1", n: "Deepal", mt: 100_000_000, pg: 3_000_000, ts: 18 };
const año = 2026;

describe("abonos a deudas", () => {
  it("bajar el plazo: misma cuota, menos meses y menos intereses", () => {
    const s = simularAbono(deepal, 45_000_000, "plazo");
    expect(s.saldoDespues).toBe(55_000_000);
    expect(s.cuotaDespues).toBe(3_000_000);
    expect(s.mesesDespues).toBeLessThan(s.mesesAntes);
    expect(s.ahorroInteres).toBeGreaterThan(0);
  });
  it("bajar la cuota: mismo plazo, cuota menor", () => {
    const s = simularAbono(deepal, 45_000_000, "cuota");
    expect(s.cuotaDespues).toBeLessThan(3_000_000);
    expect(costoCredito({ ...deepal, mt: s.saldoDespues, pg: s.cuotaDespues }).meses).toBeLessThanOrEqual(s.mesesAntes);
  });
  it("registrar: baja el saldo, guarda el historial y suma en el flujo de ese mes", () => {
    const d = registrarAbono(deepal, { año, mes: 11, monto: 45_000_000, hoy: new Date("2026-11-14") });
    expect(d.mt).toBe(55_000_000);
    expect(d.abonos).toHaveLength(1);
    expect(abonosDelMes(d, año, 11)).toBe(45_000_000);
    expect(cuotaDeudaDelMes(d, 3_000_000, año, 11, 4000)).toBe(48_000_000);
    expect(cuotaDeudaDelMes(d, 3_000_000, año, 10, 4000)).toBe(3_000_000);
  });
  it("si el saldo ya descontaba el abono, no lo resta dos veces", () => {
    const d = registrarAbono({ ...deepal, mt: 55_000_000 }, { año, mes: 11, monto: 45_000_000, saldoYaDescontado: true });
    expect(d.mt).toBe(55_000_000);
  });
  it("abono que liquida la deuda: queda pagada y el mes del abono sigue contando", () => {
    const d = registrarAbono(deepal, { año, mes: 11, monto: 100_000_000 });
    expect(d.pagada).toBe(true);
    expect(deudaViva(d)).toBe(true);
    expect(cuotaDeudaDelMes(d, 3_000_000, año, 11, 4000)).toBe(103_000_000);
    expect(cuotaDeudaDelMes(d, 3_000_000, año, 12, 4000)).toBe(0);
  });
  it("quitar el abono devuelve saldo y cuota", () => {
    const d = registrarAbono(deepal, { año, mes: 11, monto: 45_000_000, efecto: "cuota" });
    const r = eliminarAbono(d, d.abonos[0].id);
    expect(r.mt).toBe(100_000_000);
    expect(r.pg).toBe(3_000_000);
    expect(r.abonos).toHaveLength(0);
  });
  it("detecta una tabla mensual que ya traía el abono y la corrige", () => {
    const tabla = Array(12).fill(3_000_000); tabla[10] = 48_000_000;
    const v = { ...deepal, frecuencia: "variable", montosMensuales: tabla };
    expect(tablaYaTraeAbono(v, 11, 45_000_000)).toBe(true);
    const d = registrarAbono(v, { año, mes: 11, monto: 45_000_000, ajustarTabla: true });
    expect(d.montosMensuales[10]).toBe(3_000_000);
    expect(cuotaDeudaDelMes(d, 3_000_000, año, 11, 4000)).toBe(48_000_000);
  });
});
