// 21-oct-2026 — Un renglón no puede cargar dos verdades que no coinciden.
//
// Cada ítem guarda su plata de dos formas: el monto fijo (`mensual`/`m`) con su
// vigencia, y el arreglo de 12 meses (`montosMensuales`). El motor lee UNA
// según `frecuencia` (flowHelpers → montoDelMes) e ignora la otra. Mientras la
// que se ignora quede escrita y contradiga a la vigente, cambiar el selector de
// frecuencia mueve cifras enormes sin que nadie lo pida.
//
// Caso real de la cuenta: monto fijo $122,5M con vigencia SOLO diciembre, y el
// arreglo con $122,5M en los doce meses. Hoy vale $122,5M una vez. Un clic en
// "Variable" y pasa a $1.470M al año.
//
// Gastos y Deudas ya borraban el arreglo al guardar algo no-variable; Ingresos
// no. Esta es la red de los tres.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { migrarAlCambiar } from "../../src/components/FrecuenciaSelector.jsx";
import { montoDelMes, totalAnualItem } from "../../src/lib/flowHelpers.js";

const src = (f) => readFileSync(new URL(`../../src/components/${f}`, import.meta.url), "utf8");

describe("al guardar algo que no es variable, el arreglo de 12 meses se borra", () => {
  // Estructural a propósito: el guardado vive dentro de componentes de React
  // con formulario y estado. Lo que importa es que los tres módulos escriban
  // la misma regla, y eso sí se puede leer.
  for (const archivo of ["IngresosModule.jsx", "GastosModule.jsx", "DeudasModule.jsx"]) {
    it(`${archivo} no persiste montosMensuales fuera de "variable"`, () => {
      // Deudas lo escribe como `form.frecuencia`, los otros dos como `frecuencia`.
      const linea = src(archivo).split("\n").find((l) => /montosMensuales:\s*(form\.)?frecuencia/i.test(l));
      expect(linea, `${archivo} ya no escribe montosMensuales condicionado a la frecuencia`).toBeTruthy();
      expect(linea).toMatch(/===\s*"variable"\s*\?/);
      expect(linea, `${archivo} deja el arreglo puesto cuando no es variable`).toMatch(/:\s*undefined/);
    });
  }
});

describe("el renglón real que destapó esto", () => {
  // Monto fijo que solo se paga en diciembre, con un arreglo viejo lleno.
  const huerfano = {
    mensual: 122500000, frecuencia: "mensual", desdeMes: 12, hastaMes: 12,
    montosMensuales: new Array(12).fill(122500000),
  };

  it("como mensual vale una sola vez: el arreglo no se lee", () => {
    expect(montoDelMes(huerfano, 2026, 12)).toBe(122500000);
    expect(montoDelMes(huerfano, 2026, 3)).toBe(0);
    expect(totalAnualItem(huerfano)).toBe(122500000);
  });

  it("el mismo renglón en variable vale 12 veces más: por eso el arreglo no puede quedar escrito", () => {
    const comoVariable = { ...huerfano, frecuencia: "variable", desdeMes: 1, hastaMes: 12 };
    expect(totalAnualItem(comoVariable)).toBe(122500000 * 12);
  });

  it("migrarAlCambiar respeta el arreglo viejo creyendo que es bueno", () => {
    // No es un defecto suyo: su trabajo es no pisar montos cargados a mano.
    // Por eso la limpieza tiene que pasar al guardar, no al cambiar el chip.
    const patch = migrarAlCambiar("variable", {
      frecuencia: "mensual", monto: 122500000,
      montosMensuales: huerfano.montosMensuales, desdeMes: 12, hastaMes: 12,
    });
    expect(patch.montosMensuales).toBeUndefined();
  });

  it("sin arreglo viejo, pasar a variable precarga solo la vigencia", () => {
    const patch = migrarAlCambiar("variable", {
      frecuencia: "mensual", monto: 122500000,
      montosMensuales: undefined, desdeMes: 12, hastaMes: 12,
    });
    expect(patch.montosMensuales.filter((v) => v > 0)).toEqual([122500000]);
    expect(patch.montosMensuales[11]).toBe(122500000);
  });
});
