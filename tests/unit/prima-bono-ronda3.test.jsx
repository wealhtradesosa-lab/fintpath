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
