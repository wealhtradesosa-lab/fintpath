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
// 22-oct-2026 — Los cuatro puntos de partida son MOLDES: los escenarios son
// solo los que la persona crea a partir de ellos. Sin ninguno creado, el paso
// 3 ya no muestra una pantalla en blanco sino por dónde empezar.
const unEscenario = { id: "e1", nombre: "Rentar y multiplicar", color: "#f97316", plantilla: "crecimiento", propio: true,
  objetivo: { proteccion: 15, rentas: 35, crecimiento: 50 }, ventas: [], pagos: [], despliegue: [], eventos: [],
  excedente: [{ canasta: "rentas", pct: 35 }, { canasta: "crecimiento", pct: 65 }], colchonMeses: 6, canastas: null, condiciones: [] };
const props = { user, fichas: { cdt: { estado: "sale" } }, caminos: [unEscenario], onPerfil: () => {}, onFichas: () => {}, onCaminos: () => {}, onElegir: () => {} };
// `vistaInicial="armar"` entra al taller: por defecto, con escenarios ya
// creados, la pantalla abre en la LISTA.
const pinta = (paso) => renderToString(<MiPlan {...props} pasoInicial={paso} vistaInicial="armar" />);

describe("Escenarios: los cuatro pasos se pintan", () => {
  it("con escenarios creados, la pantalla abre en la lista", () => {
    const html = renderToString(<MiPlan {...props} />);
    expect(html).toContain("Mis escenarios");
    expect(html).toContain("Rentar y multiplicar");
  });
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
  it("sin ningún escenario creado, el paso 3 dice por dónde empezar", () => {
    const html = renderToString(<MiPlan {...props} caminos={[]} pasoInicial={3} vistaInicial="armar" />);
    expect(html).toContain("Todavía no has creado ningún escenario");
  });
  // 22-oct-2026 — El paso 2 dejó de ser cuatro tarjetas que compiten y pasó a
  // ser UNA decisión: la mezcla, con los tres moldes como atajos del mismo
  // control. Santiago: "uno no sabe si elegir uno predeterminado o hacerlo de
  // cero… si finalmente uno arma como quiere".
  it("el paso 2 es una sola decisión: la mezcla, con atajos", () => {
    const html = renderToString(<MiPlan {...props} caminos={[]} pasoInicial={2} vistaInicial="armar" />);
    expect(html).toContain("La mezcla a la que quieres llegar");
    for (const t of ["Seguridad y rentar", "Vivir de la renta", "Rentar y multiplicar", "A mi manera"]) expect(html, t).toContain(t);
    expect(html).toContain("Crear un escenario con esta mezcla");
  });
});
