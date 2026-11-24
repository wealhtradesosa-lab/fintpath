import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import MiFuturo10 from "../../src/components/MiFuturo10.jsx";

// 24-nov-2026 (Santiago: "esto ya no se necesita, uno puede decir qué hacer con la mensualidad"; "cada año uno revisa cómo quiere
// repartir sobrantes, pero no así"). En «2 · Tu mes» ya no se reparte por porcentaje: se usan los botones (abonar, invertir, gastar,
// ahorrar en tu reserva). Una regla de antes se ve, con «Quitar».
const user = { inflacionPct: 4, inv: [{ id: "ibkr", n: "IBKR", tp: "ETF", va: 300e6 }, { id: "c", n: "Cuenta", tp: "Cash", va: 50e6 }], ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] } };
const pintar = (cfg) => renderToString(createElement(MiFuturo10, { user, guardado: { borrador: { escenario: "base", ...cfg } }, pasoInicial: 2 }));

describe("«Tu mes» sin la regla de porcentajes", () => {
  it("sin regla: no ofrece reinvertir un % ni cambiarlo para todos los años", () => {
    const html = pintar({});
    expect(html).toMatch(/Ahorrar en tu reserva/);
    expect(html).not.toMatch(/Reinvertir un %/);
    expect(html).not.toMatch(/para todos los años/);
    expect(html).not.toMatch(/Reinviertes/);
  });
  it("con una regla de antes: se ve con «Quitar» y su explicación", () => {
    const html = pintar({ sobraDestinos: [{ id: "ibkr", pct: 25 }] });
    expect(html).toMatch(/Se reinvierte solo \(25 %\)/);
    expect(html).toMatch(/Es una regla de antes/);
    expect(html).not.toMatch(/para todos los años/);
  });
});
