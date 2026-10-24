import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { proyectarFuturo10, SUPUESTOS_F10 } from "../../src/lib/futuro10.js";
import { PlataDisponible, AlertaExceso } from "../../src/components/MiFuturo10.jsx";

const txt = (h) => h.replace(/<!-- -->/g, "");
const u = {
  inflacionPct: 4,
  inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 80e6 }, { id: "l", n: "Lote", tp: "Inmueble", va: 600e6 }, { id: "e", n: "ETF", tp: "ETF", va: 50e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 12e6 }],
  gas: { Vivienda: [{ n: "Arriendo", m: 5e6 }] }, deu: [],
};
const cfgBase = {
  decisiones: { l: { accion: "vende" }, e: { accion: "modifica", inversionMonto: 20e6, inversionAnio: 3 } },
  nuevas: [{ preset: "rfCorto", monto: 100e6 }],
  reinversiones: [{ activoId: "e", monto: 50e6 }],
};

describe("Plata disponible para invertir", () => {
  it("cada año: queda = suma de componentes, y los componentes salen del motor", () => {
    const r = proyectarFuturo10(u, cfgBase);
    expect(r.disponible).toHaveLength(10);
    r.disponible.forEach((d) => {
      const suma = d.liquidezHoy + d.ventas - d.colchon + d.flujo - d.adicionales - d.pagosFuturos - d.asignado;
      expect(d.queda).toBeCloseTo(suma, 6);
      // flujo libre = cf del motor en pesos de hoy
      const f = r.filas[d.anio];
      expect(d.flujo).toBeCloseTo(f.cf / f.deflactor, 4);
    });
    const d1 = r.disponible[0];
    expect(d1.ventas).toBe(600e6);
    expect(d1.asignado).toBe(150e6);
    const metaColchon = r.hoy.salidaMensual * SUPUESTOS_F10.colchonMeses;
    expect(d1.liquidezHoy).toBeCloseTo(Math.max(0, 80e6 - metaColchon), 0);
    expect(r.disponible[2].adicionales).toBeCloseTo(20e6 / 1.04 ** 3, 0);
    expect(r.disponible.every((d) => d.exceso === 0)).toBe(true);
  });

  it("asignar más de lo disponible dispara la alerta en el recuadro y junto a la inversión", () => {
    const r = proyectarFuturo10(u, { ...cfgBase, nuevas: [{ preset: "rfCorto", monto: 900e6 }] });
    const d1 = r.disponible[0];
    expect(d1.exceso).toBeGreaterThan(0);
    expect(d1.exceso).toBeCloseTo(-d1.queda, 6);
    const caja = txt(renderToString(<PlataDisponible disponible={r.disponible} />));
    expect(caja).toContain("Plata disponible para invertir");
    expect(caja).toContain("Queda para repartir según el norte");
    expect(caja).toMatch(/En el año 1 asignas −?\$[\d.]+ más de lo que tienes\./);
    expect(txt(renderToString(<AlertaExceso disponible={r.disponible} tipo="nueva" idx={0} />))).toContain("En el año 1 asignas");
    expect(renderToString(<AlertaExceso disponible={r.disponible} tipo="reinversion" idx={5} />)).toBe("");
  });

  it("una inversión personalizada de un año futuro cuenta en ese año", () => {
    const r = proyectarFuturo10(u, { nuevas: [{ preset: "custom", nombre: "Negocio", monto: 5e9, anio: 4 }] });
    expect(r.disponible[3].asignado).toBeCloseTo(5e9 / 1.04 ** 4, 0);
    expect(r.disponible[3].exceso).toBeGreaterThan(0);
    expect(r.disponible[3].asignaciones[0]).toMatchObject({ tipo: "nueva", idx: 0 });
  });
});
