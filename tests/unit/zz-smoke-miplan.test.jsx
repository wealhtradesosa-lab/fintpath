// 22-oct-2026 — Prueba de humo de Escenarios: que los cuatro pasos RENDERICEN.
//
// Al partir el paso 3 en una pregunta por pantalla quedaron variables nuevas
// (`sub`, `verNombre`) usadas dentro de un paso que no se estaba mostrando.
// `vite build` compila eso sin chistar: una variable sin definir solo revienta
// cuando el paso se pinta. Esto lo pinta.
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import MiPlan from "../../src/components/MiPlan.jsx";

const user = {
  trm: 4200,
  inv: [{ id: "casa", n: "casa donde vivo", tp: "Real Estate", va: 900e6 },
        { id: "cdt", n: "CDT banco", tp: "CDT", va: 500e6, tasa: 10 },
        { id: "etf", n: "ETF mundo", tp: "ETF", va: 300e6 }],
  ingresos: [{ id: "s", nombre: "Sueldo", categoria: "Salario", mensual: 12e6 },
             { id: "a", nombre: "Arriendo local", categoria: "Arriendo", mensual: 3e6 }],
  gas: { Hogar: [{ c: "Mercado", m: 6e6, freq: "mes" }] },
  deu: [{ id: "d1", n: "Tarjeta", mt: 30e6, ts: 24, pg: 2e6 }],
};
const props = { user, fichas: { cdt: { estado: "sale" } }, caminos: [], onPerfil: () => {}, onFichas: () => {}, onCaminos: () => {}, onElegir: () => {} };
const pinta = (paso) => renderToString(<MiPlan {...props} pasoInicial={paso} />);

describe("Escenarios: los cuatro pasos se pintan", () => {
  it("1 · qué tienes hoy", () => expect(pinta(1)).toContain("Para reconvertir"));
  it("2 · qué quieres proyectar", () => expect(pinta(2)).toBeTruthy());
  it("3 · una pregunta por pantalla, con el hilo de la plata arriba", () => {
    const html = pinta(3);
    expect(html).toContain("Tu plata en este escenario");
    // Los cuatro títulos están en el paso a paso de arriba…
    for (const t of ["¿Qué vendes o transformas?", "¿Qué deudas pagas con eso?", "¿En qué reinviertes lo que queda?", "¿Qué más va a pasar?"]) expect(html, t).toContain(t);
    // …pero solo la primera pregunta está abierta.
    expect(html).toContain("Marca lo que sale");            // cuerpo de la 1
    expect(html).not.toContain("Cuánto le metes");          // cuerpo de la 3
    expect(html).not.toContain("¿Y lo que te sobre cada mes?"); // cuerpo de la 4
  });
  it("4 · tu camino a 10 años", () => expect(pinta(4)).toBeTruthy());
});
