// 2-nov-2026 — Un renglón no puede llevar DOS verdades sobre cuánta plata entra.
//
// Un ingreso/gasto/deuda puede guardar un valor fijo ("$20.250.000 al mes") y
// una tabla de 12 meses ("enero $0, febrero $0…"). El motor lee UNA sola, y
// cuál depende de la frecuencia: "variable" lee la tabla, cualquier otra lee el
// fijo. Mientras las dos convivan, el renglón queda armado: un clic en
// "Variable" cambia la cifra sin que nadie toque un peso.
//
// En producción había 15 renglones así. En la cuenta de Santiago, tres:
//   renta bodega        $27.000.000/año  →  $108.000.000 con un clic  (×4)
//   FEE DSITRIBUIDORES  $78.000.000/año  →  $0           con un clic
//   local macarena      $27.000.000/año  →  $0           con un clic
// Los tres saneados el 2-nov; el guardado ya limpiaba desde el 21-oct, pero
// nada lo vigilaba y nada impedía que volviera.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { montoPromedioMensual, montoDelMes } from "../../src/lib/flowHelpers.js";

const TABLA = (v) => new Array(12).fill(v);
const sinTabla = (it) => { const c = { ...it }; delete c.montosMensuales; return c; };

describe("con frecuencia distinta de «variable», la tabla de 12 meses no pinta nada", () => {
  const casos = [
    ["mensual con la tabla en ceros", { mensual: 13000000, frecuencia: "mensual", desdeMes: 7, hastaMes: 12, montosMensuales: TABLA(0) }],
    ["mensual con la tabla llena", { mensual: 9000000, frecuencia: "mensual", desdeMes: 10, hastaMes: 12, vigenciaModo: "limitada", montosMensuales: TABLA(9000000) }],
    ["mensual con la tabla en desacuerdo", { mensual: 5000000, frecuencia: "mensual", montosMensuales: TABLA(99) }],
    ["anual", { m: 1200000, frecuencia: "anual", mesPago: 7, montosMensuales: TABLA(99) }],
    ["sin frecuencia declarada (legacy = mensual)", { mensual: 4000000, montosMensuales: TABLA(99) }],
  ];

  it.each(casos)("%s: el promedio no cambia si se le quita la tabla", (_, item) => {
    expect(montoPromedioMensual(item)).toBe(montoPromedioMensual(sinTabla(item)));
  });

  it.each(casos)("%s: ningún mes cambia si se le quita la tabla", (_, item) => {
    for (let mes = 1; mes <= 12; mes++) {
      expect(montoDelMes(item, 2026, mes), `mes ${mes}`).toBe(montoDelMes(sinTabla(item), 2026, mes));
    }
  });

  it("y con «variable» sí manda la tabla: por eso los dos datos juntos son una bomba", () => {
    const fijo = { mensual: 20250000, frecuencia: "mensual", montosMensuales: TABLA(0) };
    const mismoPeroVariable = { ...fijo, frecuencia: "variable" };
    expect(montoPromedioMensual(fijo)).toBe(20250000);
    expect(montoPromedioMensual(mismoPeroVariable)).toBe(0);
  });
});

describe("al guardar, la tabla solo sobrevive si el renglón es variable", () => {
  // Los tres módulos ya lo hacen (Ingresos desde el 21-oct, Gastos y Deudas de
  // antes). Esto es lo que faltaba: que alguien lo vigile. Es barrido de texto
  // porque la guarda vive en el armado del item, no en una función aislada.
  const MODULOS = {
    "src/components/IngresosModule.jsx": /montosMensuales:\s*\w+\s*===\s*"variable"\s*\?[^:]+:\s*undefined/,
    "src/components/GastosModule.jsx": /montosMensuales:\s*\w+\s*===\s*"variable"\s*\?[\s\S]{0,80}?:\s*undefined/,
    "src/components/DeudasModule.jsx": /montosMensuales:\s*[\w.]+\s*===\s*"variable"\s*\?[^:]+:\s*undefined/,
  };

  it.each(Object.entries(MODULOS))("%s borra la tabla cuando no es variable", (archivo, patron) => {
    const src = readFileSync(new URL("../../" + archivo, import.meta.url), "utf8");
    expect(patron.test(src), `${archivo}: no encontré la guarda que pone montosMensuales en undefined`).toBe(true);
  });
});
