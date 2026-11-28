import { describe, it, expect } from "vitest";
import { proyectarFuturo10, cuentaPorAnio } from "../../src/lib/futuro10.js";

// 28-nov-2026 (Santiago: "¿dónde le pedí yo aquí crear colchón?"; "un mundo de inversiones creadas que no hice yo, con valores que no sé
// de dónde salen"; "la tabla debe iniciar con lo que se tiene encendido… no que usted haga cosas así de la nada").
const user = { inflacionPct: 4, trm: 4200,
  inv: [{ id: "ca", n: "50% cascadas", tp: "Real Estate", va: 800e6 }, { id: "ib", n: "IBKR", tp: "Stocks", va: 140e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 60e6 }], gas: { Vida: [{ n: "Mercado", m: 40e6 }] }, deu: [] };
const de = (r, t, id) => r.filas[t].porActivo.find((x) => x.id === id) || { valor: 0, crece: 0 };

describe("escenario sin nada automático (cfg.sinAutomaticos)", () => {
  const cfg = { sinAutomaticos: true, decisiones: { ca: { accion: "vende" } } }, r = proyectarFuturo10(user, cfg), viejo = proyectarFuturo10(user, { decisiones: { ca: { accion: "vende" } } });
  it("no aparta colchón de la venta: todo lo vendido queda como capital disponible", () => {
    const c = cuentaPorAnio(r, cfg)[0];
    expect((c.compromisos || []).some((x) => x.tipo === "colchon")).toBe(false);
    expect(cuentaPorAnio(viejo, { decisiones: { ca: { accion: "vende" } } })[0].compromisos.some((x) => x.tipo === "colchon")).toBe(true);
    expect(c.porInvertir).toBeCloseTo(800e6, 0);
  });
  it("no crea canastas de renta fija ni de crecimiento", () => {
    for (let t = 1; t <= 10; t++) { expect(de(r, t, "c_renta").valor).toBeLessThan(1); expect(de(r, t, "c_crecimiento").valor).toBeLessThan(1); }
    expect(de(viejo, 5, "c_renta").valor + de(viejo, 5, "c_crecimiento").valor).toBeGreaterThan(1e6);
  });
  it("lo que no se reparte queda quieto en «Capital disponible sin usar»: suma lo que sobra, sin rendimiento inventado", () => {
    const d1 = de(r, 1, "c_liquidez"), d2 = de(r, 2, "c_liquidez");
    expect(d1.nombre).toBe("Capital disponible sin usar");
    expect(d1.crece).toBe(0); expect(d2.crece).toBe(0);
    expect(d1.valor).toBeCloseTo(800e6 + r.filas[1].cf, 0);              // la venta + lo que sobró ese año
    expect(d2.valor - d1.valor).toBeCloseTo(r.filas[2].cf, 0);           // cada año solo le entra lo que sobra
  });
  it("el patrimonio sale más bajo que con los rendimientos automáticos de antes", () => {
    expect(r.filas[10].patrimonio).toBeLessThan(viejo.filas[10].patrimonio);
  });
  it("un escenario de antes, sin la marca, no cambia", () => {
    expect(proyectarFuturo10(user, {}).filas[10].patrimonio).toBe(proyectarFuturo10(user, { sinAutomaticos: false }).filas[10].patrimonio);
  });
});

// 28-nov-2026 (Santiago, ya publicado el 169: "¿por qué sigue apareciendo en la tabla renta fija lo que sobra? yo no he creado esa inversión
// ni la tengo en mi portafolio"). Un escenario guardado de antes traía reglas que seguían mandando plata a las canastas en los años siguientes.
describe("sin automáticos, ningún escenario de antes deja plata en las canastas viejas", () => {
  const casos = {
    "regla de lo que sobra a renta fija": { sobraDestinos: [{ id: "c_renta", pct: 60 }, { id: "c_crecimiento", pct: 40 }] },
    "venta en un año posterior": { decisiones: { ca: { accion: "vende", desde: 4 } } },
    "negocio que se vende y reinvierte": { nuevas: [{ nombre: "", preset: "fincaRaiz", anio: 1, fuente: "venta", pr: { tipo: "asociativo", valor: 100e6, meses: 12, valEntregaPct: 20, final: "vende", repite: true, destino: "reinvierte", ventaModo: "pct" } }], decisiones: { ca: { accion: "vende" } } },
    "mezcla y norte de antes": { norte: "crecimiento", mezcla: { liquidez: 10, renta: 50, crecimiento: 40 }, decisiones: { ca: { accion: "vende", desde: 3 } } },
  };
  Object.entries(casos).forEach(([nombre, c]) => it(nombre, () => {
    const r = proyectarFuturo10(user, { ...c, sinAutomaticos: true });
    for (let t = 0; t <= 10; t++) { expect(de(r, t, "c_renta").valor).toBeLessThan(1); expect(de(r, t, "c_crecimiento").valor).toBeLessThan(1); }
  }));
});
