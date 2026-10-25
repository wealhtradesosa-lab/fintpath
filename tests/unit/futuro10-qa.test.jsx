import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import MiFuturo10, { MSG_DEMO_F10 } from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10, validarMezcla } from "../../src/lib/futuro10.js";

const vacio = { inflacionPct: 4, inv: [], ingresos: [], gas: {}, deu: [] };
describe("Mi futuro a 10: hallazgos QA", () => {
  it("modo demo: no guarda y muestra el aviso", () => {
    const html = renderToString(createElement(MiFuturo10, { user: vacio, guardado: { borrador: { norte: "crecer" } }, pasoInicial: 4, demo: true, onGuardar: () => { throw new Error("no debe guardar"); } }));
    expect(html).toContain(MSG_DEMO_F10);
    expect(html).toMatch(/disabled=""[^>]*>Guardar este escenario/);
    const real = renderToString(createElement(MiFuturo10, { user: vacio, pasoInicial: 4 }));
    expect(real).not.toContain(MSG_DEMO_F10);
  });
  it("riesgo cambiario: solo con exposición a USD y con el escenario elegido", () => {
    expect(proyectarFuturo10(vacio, {}).hayUSD).toBe(false);
    expect(proyectarFuturo10({ ...vacio, inv: [{ id: "a", tp: "Cash", va: 10e6, moneda: "USD" }] }, {}).hayUSD).toBe(true);
    const conIngreso = { ...vacio, ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 10e6 }] };
    expect(proyectarFuturo10(conIngreso, { norte: "crecer" }).hayUSD).toBe(true); // el flujo va a crecimiento (S&P)
    const html = renderToString(createElement(MiFuturo10, { user: { ...vacio, inv: [{ id: "a", tp: "Cash", va: 10e6, moneda: "USD" }] }, pasoInicial: 3 }));
    expect(html.replace(/<!-- -->/g, "")).toContain("supuestos normales suponen");
    expect(renderToString(createElement(MiFuturo10, { user: vacio, pasoInicial: 3 }))).not.toContain("riesgo cambiario");
  });
  it("mezcla personalizada debe sumar 100%", () => {
    expect(validarMezcla({ liquidez: 10, renta: 45, crecimiento: 45 })).toBeNull();
    expect(validarMezcla({ liquidez: 10, renta: 50, crecimiento: 50 })).toMatch(/suma 110%/);
    expect(validarMezcla(null)).toBeNull();
  });
});
