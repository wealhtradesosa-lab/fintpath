import { describe, it, expect } from "vitest";
import { contextoCompleto } from "../../src/lib/contextoAsesor.js";

describe("contexto completo del asesor", () => {
  const user = {
    trm: 4000, inflacionPct: 4,
    inv: [{ id: "rc", n: "Rapicredit fondeo", tipo: "otro", va: 3288e6 }, { id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 8700e6 }],
    ingresos: [{ nombre: "Rapicredit", tipo: "pasivo", activoId: "rc", mensual: 57.5e6, frecuencia: "mensual", desdeMes: 7 }, { nombre: "Fee distribuidores", mensual: 13e6, frecuencia: "mensual" }],
    gas: { Vivienda: [{ c: "Arriendo", mensual: 19e6, frecuencia: "mensual" }] },
    metas: [{ nombre: "Casa finca", monto: 3900e6 }],
    futuro10: { escenarios: [{ id: "e1", nombre: "BALANCE+CASA", recomendado: true, config: { decisiones: { pm: { accion: "vende" } }, futuros: { ingresos: [], gastos: [{ nombre: "Universidad hijos", anual: 180e6, desde: 3, anios: 4 }], activos: [{ nombre: "Casa finca", clase: "vivienda", valor: 3900e6, entrega: 5, valorAlTerminar: 5400e6 }] } } }] },
  };
  it("incluye inversiones con renta, metas y los planes con sus decisiones y resultados", () => {
    const c = contextoCompleto(user);
    expect(c).toMatch(/Rapicredit fondeo.*renta \$58M\/mes \(21/);
    expect(c).toMatch(/Fee distribuidores/);
    expect(c).toMatch(/METAS/);
    expect(c).toMatch(/Plan «BALANCE\+CASA» \(MARCADO COMO RECOMENDADO\)/);
    expect(c).toMatch(/Vende: Puerto Madero/);
    expect(c).toMatch(/Compra\/construye: Casa finca .*vale \$5\.400M al terminar/);
    expect(c).toMatch(/Gasto futuro: Universidad hijos/);
    expect(c).toMatch(/Punto de partida/);
    expect(c.length).toBeLessThan(60000);
  });
});
