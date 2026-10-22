// 22-oct-2026 — "Una inversión como un lote puede continuar, pero en el año 2
// o 3 uno quiere construir en ese lote, por tanto esa inversión cambió, se
// modificó. Si al tercer año uno construye bodega, pues esa inversión cambió
// porque vale más y empieza a rentar más."
//
// No es una compra -el lote ya es suyo- ni una revaluación a secas: la obra
// cuesta, se demora, y al terminar el activo vale otra cosa y empieza a pagar.
import { describe, it, expect } from "vitest";
import { expandirTransformacion, baseDesdeUsuario, configurarEscenario, escenarioVacio, PERFIL_DEFAULT } from "../../src/lib/caminos.js";
import { simularCamino } from "../../src/lib/planes.js";

const obra = { id: "tr1", tipo: "transformar", nombre: "lote macarena", posicionId: "lote", mes: 24, obra: 700e6, mesesObra: 12, valor: 2200e6, renta: 18e6, origen: [{ posicionId: "caja" }] };

describe("construir sobre lo que ya tienes", () => {
  const mov = expandirTransformacion(obra);
  it("son tres pasos: sale la plata, el activo revalúa, empieza la renta", () => {
    expect(mov.map((m) => m.tipo)).toEqual(["aportar", "revaluar", "flujo_inicia"]);
  });
  it("la obra sale cuando arranca; lo demás, cuando termina", () => {
    expect(mov[0].mes).toBe(24);
    expect(mov[1].mes).toBe(36);
    expect(mov[2].mes).toBe(36);
  });
  it("la renta queda atada al activo: si se vende, se acaba sola", () => {
    expect(mov[2].flujo.posicionId).toBe("lote");
  });
  it("sin obra ni valor no inventa nada", () => {
    expect(expandirTransformacion({ id: "x", posicionId: "lote", mes: 0 })).toEqual([]);
    expect(expandirTransformacion({ id: "x", mes: 0, obra: 100e6 })).toEqual([]); // sin activo, nada
  });
});

describe("dentro del plan, el lote cambia de verdad", () => {
  const user = { trm: 4200,
    inv: [{ id: "lote", n: "lote macarena", tp: "Real Estate", va: 400e6, vc: 400e6 }, { id: "caja", n: "Efectivo", tp: "Cash", va: 1500e6 }],
    ingresos: [{ id: "s", nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }],
    gas: { Hogar: [{ c: "Vida", m: 5e6, freq: "mes" }] }, deu: [] };
  const base = baseDesdeUsuario(user, PERFIL_DEFAULT, {});
  const c = configurarEscenario(base, escenarioVacio({ id: "e", nombre: "Con obra", eventos: [obra] }), PERFIL_DEFAULT);
  const r = simularCamino(c.cfg);

  it("antes de la obra el lote no paga nada; después, sí", () => {
    expect(r.meses[23].ingFlujos).toBeLessThan(r.meses[37].ingFlujos);
    expect(Math.round((r.meses[37].ingFlujos - r.meses[23].ingFlujos) / 1e6)).toBeGreaterThanOrEqual(17);
  });
  it("y pasa a valer lo que vale terminado", () => {
    const fin = r.meses[37].detalle.lote.capital;
    expect(Math.round(fin / 1e6)).toBeGreaterThanOrEqual(2200);
  });
  it("la obra se paga de donde se dijo, no aparece de la nada", () => {
    expect(r.log.some((l) => l.mes === 24 && /lote macarena/.test(l.texto))).toBe(true);
  });
});
