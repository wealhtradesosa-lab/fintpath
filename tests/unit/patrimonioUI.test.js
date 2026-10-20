// Bugs de UI de Patrimonio/Egresos que encontró QA (11-oct-2026).
import { describe, it, expect } from "vitest";
import { valorOpcion, etiquetaOpcion, gastosDelUsuario, columnasPortafolio, estiloEncabezadoGrupo, estiloTablaPortafolio, estiloFilaPortafolio, estiloCeldaCompleta, PLANTILLA_ANGOSTO, ANCHOS_ANGOSTO, deudasSinActivo } from "../../src/lib/patrimonioUI.js";

describe("opciones de <select> (Egresos: '[object Object]')", () => {
  const opciones = [{ v: "", l: "— Sin asignar (no calcula impuesto)" }, { v: "own_1", l: "👤 Personal" }, "Real Estate"];
  it("la opción con valor vacío no devuelve el objeto", () => {
    expect(valorOpcion(opciones[0])).toBe("");
    expect(etiquetaOpcion(opciones[0])).toBe("— Sin asignar (no calcula impuesto)");
    expect(opciones.map(valorOpcion).some((v) => String(v) === "[object Object]")).toBe(false);
    expect(opciones.map(etiquetaOpcion).some((v) => String(v) === "[object Object]")).toBe(false);
  });
  it("las opciones de texto siguen igual", () => {
    expect(valorOpcion("Real Estate")).toBe("Real Estate");
    expect(etiquetaOpcion("Real Estate")).toBe("Real Estate");
    expect(valorOpcion({ v: "own_1", l: "x" })).toBe("own_1");
    expect(etiquetaOpcion({ v: "COP" })).toBe("COP");
  });
});

describe("gastos vinculados a activos (InversionesModule leía user.gastos)", () => {
  it("lee u.gas, que es donde viven los datos", () => {
    const gas = { Vivienda: [{ m: 100, activoId: "a1" }] };
    expect(gastosDelUsuario({ gas })).toBe(gas);
    expect(gastosDelUsuario({ gastos: gas })).toBe(gas);
    expect(gastosDelUsuario({ gas, gastos: { otro: [] } })).toBe(gas);
    expect(gastosDelUsuario(null)).toEqual({});
  });
});

describe("tabla del portafolio en el móvil", () => {
  it("en angosto quedan Inversión, Valor, Deuda y acciones", () => {
    expect(columnasPortafolio(true)).toEqual(["Inversión", "Valor", "Deuda", ""]);
    expect(columnasPortafolio(false)).toEqual(["Inversión", "Tipo", "Valor", "Ganancia", "Deuda", "On/Off", ""]);
  });
});

describe("tabla del portafolio en el móvil (subtotal cortado)", () => {
  it("en angosto la tabla es una grilla que no puede crecer por contenido", () => {
    expect(estiloTablaPortafolio(true).display).toBe("block");
    expect(estiloTablaPortafolio(true).whiteSpace).toBe("normal"); // anula `table { white-space: nowrap }` de App.jsx en móvil
    expect(estiloTablaPortafolio(false).display).toBeUndefined();
    expect(estiloFilaPortafolio(true).display).toBe("grid");
    expect(estiloFilaPortafolio(false)).toBeUndefined();
    expect(estiloFilaPortafolio(true, { background: "x" }).background).toBe("x");
    expect(PLANTILLA_ANGOSTO).toBe("minmax(0, 1fr) 84px 76px 44px");
    expect(ANCHOS_ANGOSTO).toHaveLength(columnasPortafolio(true).length);
  });
  it("la fila de grupo ocupa toda la grilla", () => {
    expect(estiloCeldaCompleta(true).gridColumn).toBe("1 / -1");
    expect(estiloCeldaCompleta(false)).toBeUndefined();
  });
  it("deja lugar al nombre incluso en 320 px", () => {
    const fijos = ANCHOS_ANGOSTO.reduce((s, w) => s + (w || 0), 0);
    expect(320 - 32 - fijos).toBeGreaterThanOrEqual(80);
  });
  it("el encabezado de grupo no fuerza ancho", () => {
    const e = estiloEncabezadoGrupo();
    expect(e.position).toBeUndefined();
    expect(e.width).toBeUndefined();
    expect(e.flexWrap).toBe("wrap");
  });
});

describe("deudas sin activo", () => {
  const activos = [{ id: "a1" }, { id: "a2" }];
  it("suma solo deudas activas con saldo que no apuntan a un activo existente", () => {
    const deudas = [
      { id: 1, la: "a1", mt: 100 },
      { id: 2, mt: 4000000 },
      { id: 3, link: "borrado", monto: 200000 },
      { id: 4, mt: 500, sim: false },
      { id: 5, mt: 0 },
    ];
    expect(deudasSinActivo(deudas, activos)).toEqual({ n: 2, total: 4200000 });
  });
  it("sin deudas sueltas devuelve cero", () => {
    expect(deudasSinActivo([{ la: "a1", mt: 10 }], activos)).toEqual({ n: 0, total: 0 });
    expect(deudasSinActivo(null, null)).toEqual({ n: 0, total: 0 });
  });
});

describe("tuteo en Patrimonio y Egresos", () => {
  it("InversionesModule y GastosModule no tienen voseo en el texto visible", async () => {
    const { readFileSync } = await import("node:fs");
    const re = /(?<![\wáéíóúñ])(usás|usá|escribí|registralo|registrá|tenés|podés|querés|elegís|elegí|cargá|agregá|ingresá|vinculá|pagás|ganás|necesitás|sos|vos)(?![\wáéíóúñ])/i;
    const malas = [];
    for (const f of ["src/components/InversionesModule.jsx", "src/components/GastosModule.jsx"])
      for (const l of readFileSync(f, "utf8").split("\n"))
        if (!/^\s*(\/\/|\*|\/\*)/.test(l) && re.test(l)) malas.push(`${f}: ${l.trim().slice(0, 120)}`);
    expect(malas).toEqual([]);
  });
});
