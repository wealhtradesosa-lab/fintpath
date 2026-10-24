// Prueba de humo: los seis pasos de "Mi futuro a 10 años" renderizan, en tuteo y con el aviso.
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";

const user = { trm: 4200, inflacionPct: 4,
  inv: [{ id: "a", n: "Cuenta", tp: "Cash", va: 20e6 }, { id: "ap", n: "Apto", tp: "Real Estate", va: 400e6 }, { id: "e", n: "ETF", tp: "ETF", va: 1000, moneda: "USD" }, { id: "v", n: "Carro", tp: "Vehículo", va: 60e6 }],
  ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "Mercado", m: 12e6 }] }, deu: [] };
const guardado = { escenarios: [{ id: "x", nombre: "Vender apto", config: { escenario: "pesimista", decisiones: { ap: { accion: "vende" } }, norte: "rentas", nuevas: [], reinversiones: [] } }] };

describe("MiFuturo10 smoke", () => {
  for (let p = 0; p < 6; p++) it(`paso ${p + 1} renderiza`, () => {
    const html = renderToString(<MiFuturo10 user={user} guardado={guardado} pasoInicial={p} />);
    expect(html).toContain("no es una recomendación de inversión");
    expect(html).toContain("Proyección ilustrativa, no asesoría");
    expect(html).not.toMatch(/NaN|undefined|\bvos\b|ahorrás|tenés/);
  });
});
