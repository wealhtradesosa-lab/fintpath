import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const _mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
  clear: () => _mem.clear(),
};

import { tipoIngreso } from "../../src/lib/metrics.js";
import { inferIngresoFiscalCode } from "../../src/lib/normalize.js";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { CATS, DEFAULT_FISCAL_CODE } from "../../src/components/IngresosModule.jsx";
import { normalizarPrimaBono, mensualPrimaBono, notaPrimaBono, ayudaPrimaBono, labelCategoria } from "../../src/lib/primaBono.js";
import { montoPromedioMensual } from "../../src/lib/flowHelpers.js";
import { FISCAL_CODE_META } from "../../src/lib/fiscalCodes.js";
import AvisoCambioNivel, { AVISO_NIVEL_KEY, AVISO_NIVEL_TEXTO, marcarAvisoNivelVisto } from "../../src/components/AvisoCambioNivel.jsx";

describe("App.jsx → IngresosModule recibe user una sola vez", () => {
  const src = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  const line = src.split("\n").find((l) => l.includes("<IngresosModule ")); const tag = line.slice(line.indexOf("<IngresosModule "));
  it("user={u} (con .inv para el selector de activo) y authUser aparte", () => {
    expect(tag.match(/\buser=\{/g)).toHaveLength(1);
    expect(tag).toMatch(/\buser=\{u\}/);
    expect(tag).toMatch(/\bauthUser=\{authUser\}/);
  });
});

describe("Categoría Prima/Bono", () => {
  it("está en el formulario y por defecto es laboral (LAB_)", () => {
    expect(CATS.some((c) => c.v === "Prima/Bono")).toBe(true);
    expect(DEFAULT_FISCAL_CODE["Prima/Bono"]).toBe("LAB_PRESTACIONES_PRIMA");
    expect(inferIngresoFiscalCode({ categoria: "Prima/Bono" })).toBe("LAB_PRESTACIONES_PRIMA");
  });
  it("nunca cuenta como pasivo, aunque esté vinculada a un activo", () => {
    const fiscalCode = DEFAULT_FISCAL_CODE["Prima/Bono"];
    expect(tipoIngreso({ categoria: "Prima/Bono", fiscalCode })).toBe("activo");
    expect(tipoIngreso({ categoria: "Prima/Bono", fiscalCode, activoId: "a1" })).toBe("activo");
  });
  const mk = (extra) => ({ trm: 4200, owners: [{ id: "o1", name: "Luis", type: "natural" }], gas: {}, deu: [], inv: [],
    ingresos: [
      { id: "sal", owner: "o1", nombre: "Salario", categoria: "Salario", fiscalCode: "LAB_SALARIO", mensual: 10e6, tipo: "fijo" },
      ...extra,
    ] });
  const det = (u) => estimarImpuesto(u, { ag: 2025 }).detalle.find((d) => d.name === "Luis");
  // Como lo guarda el formulario: total anual de $12M, cobrado en junio.
  const bono = () => normalizarPrimaBono({ id: "pb", owner: "o1", nombre: "Bono", categoria: "Prima/Bono", fiscalCode: DEFAULT_FISCAL_CODE["Prima/Bono"], mensual: 12e6, mesPago: 6, activoId: "a1" });

  it("se guarda como anual: taxCO recibe el anual una sola vez (12M, no 144M)", () => {
    const b = bono();
    expect(b.frecuencia).toBe("anual");
    const base = det(mk([]));
    const con = det(mk([b]));
    expect(con.primaAnual).toBe(12e6);
    expect(con.primaAnual).not.toBe(144e6);
    expect(con.exenta25).toBeGreaterThan(base.exenta25);
  });
  it("es renta de trabajo: no suma a cesantías ni a ingresos no laborales", () => {
    const base = det(mk([]));
    const con = det(mk([bono()]));
    expect(con.cesantiasAnual || 0).toBe(base.cesantiasAnual || 0);
    expect(con.ingNoLaboral).toBe(base.ingNoLaboral);
    expect(con.ingLaboral - base.ingLaboral).toBe(12e6);
  });
  it("flujo mensual ÷ 12, nunca $0, con nota de mes cobrado", () => {
    const b = bono();
    expect(montoPromedioMensual(b)).toBe(1e6);
    expect(mensualPrimaBono({ ...b, pagos: { [new Date().getFullYear()]: true } })).toBe(1e6);
    expect(notaPrimaBono(b)).toBe("anual, ya cobrado en junio");
    expect(ayudaPrimaBono("12000000", (n) => "$" + n.toLocaleString("es-CO"))).toBe("Se mostrará como $1.000.000/mes");
  });
  it("se lee «Prima o bonificación laboral», no «Prima legal»", () => {
    expect(FISCAL_CODE_META.LAB_PRESTACIONES_PRIMA.label).toBe("Prima o bonificación laboral");
    expect(labelCategoria("Prima/Bono")).toBe("Prima o bonificación laboral");
    expect(CATS.find((c) => c.v === "Prima/Bono").l).toContain("Prima o bonificación laboral");
  });
});

describe("Aviso de una sola vez en el nivel", () => {
  beforeEach(() => _mem.clear());
  it("se muestra la primera vez con el texto en tuteo", () => {
    const html = renderToString(createElement(AvisoCambioNivel, {}));
    expect(html).toContain("los bonos y primas ya no cuentan como ingreso pasivo");
    expect(AVISO_NIVEL_TEXTO).toBe("Ajustamos el cálculo: los bonos y primas ya no cuentan como ingreso pasivo. Por eso tu nivel puede cambiar.");
  });
  it("al cerrarlo no vuelve y solo guarda un flag sin montos ni IDs", () => {
    marcarAvisoNivelVisto();
    expect([..._mem.entries()]).toEqual([[AVISO_NIVEL_KEY, "1"]]);
    expect(renderToString(createElement(AvisoCambioNivel, {}))).toBe("");
  });
});
