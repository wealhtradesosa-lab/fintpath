import { describe, it, expect } from "vitest";
import { calcularMetricas } from "../../src/lib/metrics.js";
import { metricasReales, etiquetaEscenario } from "../../src/lib/nivelVista.js";
import { FACTORES_ESCENARIO } from "../../src/lib/escenarios.js";

// QA #58: el nivel real sale solo de los datos guardados; sliders y escenarios no lo mueven.
const G = 10_000_000;
const mkUser = (pasivo, salario = 15_000_000) => ({
  trm: 4200,
  ingresos: [
    { nombre: "Salario", categoria: "Salario", mensual: salario, frecuencia: "mensual" },
    { nombre: "Arriendo apto", categoria: "Arriendo", mensual: pasivo, frecuencia: "mensual" },
  ],
  gastos: { Vivienda: [{ c: "Mercado", m: G, frecuencia: "mensual" }] },
  deudas: [], inv: [],
});
// Lo que hace el simulador con sliders/escenarios: escala ingresos y gastos.
const simular = (u, fi, fg) => calcularMetricas({
  ingresos: u.ingresos.map((i) => ({ ...i, mensual: i.mensual * fi })),
  gastos: { Vivienda: u.gastos.Vivienda.map((g) => ({ ...g, m: g.m * fg })) },
  deudas: [], inv: [], trm: 4200,
}, { base: "mes" });
const nombre = (m) => m.nivel?.nivel;

describe("nivel real vs escenario", () => {
  it.each([[0.99, 4], [1.0, 4], [1.29, 4], [1.3, 5]])("borde %s → nivel %s con datos reales", (f, n) => {
    const m = metricasReales(mkUser(Math.round(G * f)));
    // 99% no llega a Independencia (Seguridad si no hay esenciales aparte); 100–129 Independencia; 130 Abundancia
    if (f < 1) expect(nombre(m)).toBeLessThan(4); else expect(nombre(m)).toBe(n);
  });

  it("sliders de ingreso y gasto no cambian el nivel real; el escenario sale aparte", () => {
    const u = mkUser(G); // 100% → Independencia
    const real = metricasReales(u);
    expect(nombre(real)).toBe(4);
    const subeIng = simular(u, 3, 1);
    const subeGas = simular(u, 1, 3);
    expect(nombre(subeIng)).toBe(5);
    expect(nombre(subeGas)).toBeLessThan(4);
    // el real se recalcula igual: no depende del escenario
    expect(nombre(metricasReales(u))).toBe(4);
    expect(etiquetaEscenario(real, subeIng, true)).toMatch(/^Nivel en este escenario: Abundancia .*tu nivel real no cambia\.$/);
    expect(etiquetaEscenario(real, subeIng, false)).toBeNull();
    expect(etiquetaEscenario(real, simular(u, 1, 1), true)).toBeNull();
  });

  it.each(["crisis", "optimista"])("escenario %s no mueve el nivel real", (id) => {
    const u = mkUser(G);
    const f = FACTORES_ESCENARIO[id];
    const esc = simular(u, f.i, f.g);
    expect(nombre(esc)).not.toBe(4);
    expect(nombre(metricasReales(u))).toBe(4);
  });

  it("subir el salario en el escenario no sube la cobertura pasiva (Finanzas, igual que #59)", () => {
    const u = mkUser(5_000_000);
    const base = simular(u, 1, 1);
    const conMasSalario = calcularMetricas({
      ...u, ingresos: u.ingresos.map((i) => i.categoria === "Salario" ? { ...i, mensual: i.mensual * 5 } : i),
    }, { base: "mes" });
    expect(conMasSalario.ip).toBe(base.ip);
    for (const cat of ["Prima", "Bono", "Bonificación"]) {
      const m = calcularMetricas({ ...u, ingresos: [...u.ingresos, { nombre: cat, categoria: cat, mensual: 50_000_000, frecuencia: "mensual" }] }, { base: "mes" });
      expect(m.ip).toBe(base.ip);
    }
  });
});
