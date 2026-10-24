import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { migratePrimaBonoAnual, mensualPrimaBono, MARCA_REVISAR_PRIMA } from "../../src/lib/primaBono.js";
import { calcularMetricas } from "../../src/lib/metrics.js";
import { montoPromedioMensual } from "../../src/lib/flowHelpers.js";

const legacy = () => ({ ingresos: [{ id: "p", nombre: "Prima", categoria: "Prima/Bono", mensual: 1e6, frecuencia: "mensual", fiscalCode: "LAB_PRESTACIONES_PRIMA" }] });

describe("ronda 3 Prima/Bono", () => {
  it("(a) migra legacy 1M/mes a 12M anual, marcado, idempotente", () => {
    const d = migratePrimaBonoAnual(legacy());
    const p = d.ingresos[0];
    expect(p.mensual).toBe(12e6); expect(p.frecuencia).toBe("anual");
    expect(p.revisarFrecuencia).toBe(true); expect(p.migPrimaBonoAnual).toBe(true);
    expect(mensualPrimaBono(p)).toBe(1e6);
    expect(montoPromedioMensual(p)).toBe(1e6);
    const d2 = migratePrimaBonoAnual(JSON.parse(JSON.stringify(d)));
    expect(d2.ingresos[0].mensual).toBe(12e6);
    expect(MARCA_REVISAR_PRIMA).toBe("Revisa: ¿este valor es mensual o anual?");
  });
  it("(a) no toca otros ingresos ni primas ya anuales", () => {
    const d = migratePrimaBonoAnual({ ingresos: [{ id: "s", categoria: "Salario", mensual: 5e6 }, { id: "q", categoria: "Prima/Bono", mensual: 12e6, frecuencia: "anual", mesPago: 6 }] });
    expect(d.ingresos[0]).toEqual({ id: "s", categoria: "Salario", mensual: 5e6 });
    expect(d.ingresos[1].mensual).toBe(12e6); expect(d.ingresos[1].revisarFrecuencia).toBeUndefined();
  });
  it("(a) App.jsx corre la migración al cargar y la lista muestra la marca", () => {
    expect(fs.readFileSync("src/App.jsx", "utf8")).toMatch(/migratePrimaBonoAnual\(migrateInversionUnica\(/);
    expect(fs.readFileSync("src/components/IngresosModule.jsx", "utf8")).toMatch(/revisar-prima-bono/);
  });
  it("(b) tasa de ahorro mensual usa prima ÷ 12 en cualquier mes", () => {
    const mesCobro = new Date().getMonth() + 1;
    const otro = mesCobro === 12 ? 1 : mesCobro + 1;
    const pct = (mesPago) => {
      const args = { ingresos: [{ id: "s", categoria: "Salario", mensual: 5e6 }, { id: "p", categoria: "Prima/Bono", mensual: 12e6, frecuencia: "anual", mesPago }], gastos: { Hogar: [{ id: "g", n: "Arriendo", mensual: 3e6 }] }, deudas: [], inv: [], trm: 4000 };
      return [calcularMetricas(args, { base: "mes" }), calcularMetricas(args)];
    };
    for (const m of [mesCobro, otro]) {
      const [mes, prom] = pct(m);
      expect(mes.ingresoNeto).toBe(6e6);
      expect(mes.ahorroPct).toBeCloseTo(prom.ahorroPct, 6);
      expect(mes.ahorroPct).toBeCloseTo(50, 6);
    }
  });
  it("(c) oculta los selectores de modo para Prima/Bono y ayuda en línea propia", () => {
    const s = fs.readFileSync("src/components/IngresosModule.jsx", "utf8");
    expect(s).toMatch(/mostrarCampo\("modoIngreso"\)[^\n]*"Prima\/Bono"\]\.includes/);
    expect(s).toMatch(/mostrarCampo\("modoIngresoSimple"\)[^\n]*"Prima\/Bono"\]\.includes/);
    expect(s).toMatch(/data-testid="ayuda-prima-bono" style=\{\{ gridColumn: "1\/-1", width: "100%", display: "block"/);
  });
});

import { debeSugerirPrimaBono, descartarSugerenciaPrimaBono, MARCA_SUGERIR_PRIMA } from "../../src/lib/primaBono.js";
describe("sugerencia por nombre (prod: Salario/Otro/Comisiones con prima/bono en el nombre)", () => {
  const base = () => ({ ingresos: [
    { id: "a", nombre: "Prima de servicios", categoria: "Salario", mensual: 2e6 },
    { id: "b", nombre: "BONIFICACIÓN anual", categoria: "Otro", mensual: 1e6 },
    { id: "c", nombre: "Bonos ventas", categoria: "Comisiones", frecuencia: "variable", mensual: 500000, montosMensuales: [0,0,3e6,0,0,3e6,0,0,0,0,0,0] },
    { id: "d", nombre: "Arriendo apto", categoria: "Otro", mensual: 1e6 },
  ] });
  it("la migración no convierte ni recategoriza (incl. variable con montosMensuales)", () => {
    const antes = base(); const d = migratePrimaBonoAnual(JSON.parse(JSON.stringify(antes)));
    expect(d.ingresos).toEqual(antes.ingresos);
  });
  it("marca por nombre sin tildes/mayúsculas, solo fuera de Prima/Bono", () => {
    const d = base();
    expect(d.ingresos.map(debeSugerirPrimaBono)).toEqual([true, true, true, false]);
    expect(debeSugerirPrimaBono({ nombre: "Prima", categoria: "Prima/Bono" })).toBe(false);
    expect(MARCA_SUGERIR_PRIMA).toBe("Revisa: ¿es una prima o bono? Muévelo a Prima o bonificación laboral con el total del año");
  });
  it("«Es mensual, dejarlo así» descarta para siempre, idempotente, sin tocar valores", () => {
    const d = base();
    const u1 = descartarSugerenciaPrimaBono(d.ingresos, "c");
    const u2 = descartarSugerenciaPrimaBono(u1, "c");
    expect(u2).toEqual(u1);
    expect(debeSugerirPrimaBono(u1[2])).toBe(false);
    const { sugerenciaPrimaBonoDescartada, ...resto } = u1[2];
    expect(resto).toEqual(d.ingresos[2]);
    expect(debeSugerirPrimaBono(migratePrimaBonoAnual({ ingresos: u1 }).ingresos[2])).toBe(false);
    expect(u1[0]).toBe(d.ingresos[0]);
  });
  it("la lista muestra la marca con Revisar (abre edición) y Es mensual", () => {
    const s = fs.readFileSync("src/components/IngresosModule.jsx", "utf8");
    expect(s).toMatch(/sugerir-prima-editar[^\n]*handleEdit\(item\)/);
    expect(s).toMatch(/sugerir-prima-descartar[^\n]*descartarSugerenciaPrima\(item\)[^\n]*Es mensual, dejarlo así/);
  });
});
