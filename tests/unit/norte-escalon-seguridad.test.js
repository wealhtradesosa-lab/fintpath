// 21-oct-2026 — El escalón 3 no existía en la landing.
//
// `calcularNorte` llamaba a `nivelLibertad` sin `obEsencial`. El motor cae
// entonces en obEsencial = ob, y la condición de Seguridad (ip >= esencial)
// queda IDÉNTICA a la de Independencia (ip >= total): N4 dispara primero y N3
// no se alcanza nunca. La página titula "Los 5 niveles de libertad financiera"
// y pinta los cinco, pero el visitante saltaba de Estabilidad a Independencia.
//
// El barrido de abajo es la red: si alguien vuelve a soltar `obEsencial` en el
// camino, el primer test se cae.
import { describe, it, expect } from "vitest";
import { calcularNorte, itemsDesdeNorte } from "../../src/lib/norteUnMinuto.js";
import { calcularMetricas } from "../../src/lib/metrics.js";

// Barre el ingreso pasivo de 0 a 1,6× el gasto y devuelve los escalones que
// la calculadora llega a mostrar.
const escalonesAlcanzables = (extra = {}) => {
  const gastos = 10000000;
  const vistos = new Set();
  for (let i = 0; i <= 320; i++) {
    const ingresoPasivo = (gastos * 1.6 * i) / 320;
    const r = calcularNorte({ ingresoTrabajo: gastos, gastos, ahorrado: 0, ingresoPasivo, ...extra });
    vistos.add(r.nivel);
  }
  return [...vistos].sort((a, b) => a - b);
};

describe("los 5 niveles de la landing son 5 de verdad", () => {
  it("con lo esencial separado, Seguridad se puede alcanzar", () => {
    expect(escalonesAlcanzables({ gastosEsenciales: 7000000 })).toEqual([2, 3, 4, 5]);
  });

  it("sin el dato, Seguridad queda fuera — y por eso la UI lo pide", () => {
    expect(escalonesAlcanzables()).not.toContain(3);
  });

  it("un caso concreto: los activos pagan lo esencial pero no todo", () => {
    const r = calcularNorte({ ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 7500000, gastosEsenciales: 7000000 });
    expect(r.nivel).toBe(3);
    expect(r.nombre).toBe("Seguridad");
    expect(r.esencialDeclarado).toBe(true);
    expect(r.obEsencial).toBe(7000000);
  });

  it("el siguiente escalón se mide contra el total, no contra lo esencial", () => {
    const r = calcularNorte({ ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 7500000, gastosEsenciales: 7000000 });
    expect(r.siguiente.nombre).toBe("Independencia");
    expect(r.rentaFalta).toBe(2500000); // 10M − 7,5M
  });
});

describe("lo esencial que declara el visitante no se estira ni se inventa", () => {
  it("si dice que TODO es esencial, Seguridad queda tan exigente como Independencia", () => {
    const r = calcularNorte({ ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 9900000, gastosEsenciales: 10000000 });
    expect(r.obEsencial).toBe(10000000);
    expect(r.nivel).toBe(2);
  });

  it("un esencial mayor que el gasto se topa en el gasto (no sube el listón)", () => {
    const r = calcularNorte({ ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 5000000, gastosEsenciales: 99000000 });
    expect(r.obEsencial).toBe(10000000);
  });

  it("vacío o cero es «no me lo dijo», no «cero es esencial»", () => {
    for (const v of ["", 0, null, undefined]) {
      const r = calcularNorte({ ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 8000000, gastosEsenciales: v });
      expect(r.esencialDeclarado).toBe(false);
      expect(r.obEsencial).toBe(10000000); // el motor cae en ob, como siempre
    }
  });

  it("el déficit sigue mandando sobre todo lo demás", () => {
    const r = calcularNorte({ ingresoTrabajo: 1000000, gastos: 10000000, ahorrado: 0, ingresoPasivo: 500000, gastosEsenciales: 7000000 });
    expect(r.nivel).toBe(1);
  });
});

describe("la landing y el dashboard tienen que decir el MISMO nivel", () => {
  // El 21-oct el Dashboard medía con una base y la tarjeta del Simulador con
  // otra: dos pantallas, dos cuentas. Acá se cierra el mismo hueco en la
  // puerta de entrada — lo que la landing calculó tiene que sobrevivir al
  // registro, y eso depende de que el gasto entre PARTIDO y marcado.
  const entradas = { ingresoTrabajo: 4000000, gastos: 10000000, ahorrado: 50000000, ingresoPasivo: 7500000, deudas: 0, gastosEsenciales: 7000000 };

  it("el gasto entra partido y marcado, y suma exactamente lo declarado", () => {
    const { gas } = itemsDesdeNorte(entradas);
    const filas = gas["Personal"];
    expect(filas).toHaveLength(2);
    expect(filas.filter((x) => x.esencial === true).reduce((s, x) => s + x.m, 0)).toBe(7000000);
    expect(filas.reduce((s, x) => s + x.m, 0)).toBe(10000000);
  });

  it("el nivel del motor sobre esos ítems es el mismo que mostró la landing", () => {
    const r = calcularNorte(entradas);
    const { ingresos, gas, inv, deu } = itemsDesdeNorte(entradas);
    const met = calcularMetricas({ ingresos, gastos: gas, deudas: deu, inv });
    expect(r.nivel).toBe(3);
    expect(met.nivel.nivel).toBe(r.nivel);
    expect(met.obEsencial).toBe(r.obEsencial);
  });

  it("sin separar lo esencial, el gasto sigue entrando en una sola fila", () => {
    const { gas } = itemsDesdeNorte({ ...entradas, gastosEsenciales: "" });
    expect(gas["Personal"]).toHaveLength(1);
    expect(gas["Personal"][0].m).toBe(10000000);
  });
});
