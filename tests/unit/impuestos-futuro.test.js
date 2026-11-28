import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { impuestosPorAnio, ingresosDelAnio, ingresoConValor } from "../../src/lib/impuestosFuturo.js";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { montoPromedioMensual } from "../../src/lib/flowHelpers.js";

// 28-nov-2026 (Santiago: "¿cómo se estima algo de impuestos?… lo más completo posible… no estimar impuestos daría unos valores muy poco precisos").
const user = { inflacionPct: 4, trm: 4200, owners: [{ id: "own_1", name: "Personal", type: "natural" }],
  inv: [{ id: "ap", n: "Apto arrendado", tp: "Real Estate", va: 900e6 }, { id: "ca", n: "Lote", tp: "Lote", va: 2000e6 }],
  ingresos: [{ id: "i1", nombre: "Salario", categoria: "Salario", mensual: 40e6, owner: "own_1" }, { id: "i2", nombre: "Arriendo apto", categoria: "Arriendo", mensual: 8e6, activoId: "ap", owner: "own_1" }],
  gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [] };
const estimar = (u) => estimarImpuesto(u);
const corre = (cfg) => { const c = { sinAutomaticos: true, ...cfg }, r0 = proyectarFuturo10(user, { sinAutomaticos: true }), rA = proyectarFuturo10(user, c);
  const imp = impuestosPorAnio(user, rA, r0, { estimar, estHoy: estimar(user), cfg: c }); return { imp, r: proyectarFuturo10(user, { ...c, impuestosAnio: imp.porAnio }), rA, r0 }; };

describe("impuesto de renta estimado para cada año de la tabla", () => {
  it("un ingreso queda con el valor anual que se le pone, sin importar su frecuencia", () => {
    const x = ingresoConValor({ nombre: "Prima", categoria: "Prima/Bono", mensual: 30e6, frecuencia: "anual", mesPago: 6 }, 24e6);
    expect(montoPromedioMensual(x) * 12).toBeCloseTo(24e6, 0);
  });
  it("sin cambios, los ingresos de cada año (en plata de hoy) son los de hoy y el impuesto del año es el del motor de hoy", () => {
    const { imp, r0 } = corre({}), hoy = estimar(user), impHoy = hoy.detalle.reduce((s, d) => s + (d.impBruto ?? d.impuesto), 0);
    const ing3 = ingresosDelAnio(user, r0, r0, 3, {});
    expect(ing3.reduce((s, x) => s + montoPromedioMensual(x) * 12, 0)).toBeCloseTo((40e6 + 8e6) * 12, -2);
    expect(ing3[0]).toBe(user.ingresos[0]);   // sin cambios, cada ingreso es el de hoy tal cual: el motor lo trata igual que hoy
    expect(impHoy).toBeGreaterThan(0);
    expect(imp.detalle[0].impuesto).toBeCloseTo(impHoy, -2);
    expect(imp.detalle[2].impuesto).toBeCloseTo(impHoy * Math.pow(1 + r0.indexacion, 2), -2); // mismas reglas, llevado a pesos de ese año
  });
  it("cada año paga la retención de ese año más el saldo del año anterior", () => {
    const { imp } = corre({});
    imp.detalle.forEach((d, k) => { expect(d.paga).toBeCloseTo(d.pagaRetencion + d.pagaSaldo, 0); if (k > 0) expect(d.pagaSaldo).toBeCloseTo(imp.detalle[k - 1].saldo, 0); });
  });
  it("el impuesto sale del flujo: sobra menos cada año y el patrimonio final es menor", () => {
    const { imp, r, rA } = corre({});
    expect(r.filas[2].impuesto).toBeCloseTo(imp.porAnio[2], 0);
    expect(r.filas[2].cf).toBeCloseTo(rA.filas[2].cf - imp.porAnio[2], 0);
    expect(r.filas[10].patrimonio).toBeLessThan(rA.filas[10].patrimonio);
  });
  it("si vende la inversión que renta, ese ingreso deja de tributar", () => {
    const a = corre({}).imp, b = corre({ decisiones: { ap: { accion: "vende" } } }).imp;
    expect(b.detalle[3].impuesto).toBeLessThan(a.detalle[3].impuesto);
  });
  it("una inversión nueva que paga renta sube el impuesto desde que empieza a pagar", () => {
    const a = corre({}).imp, b = corre({ decisiones: { ca: { accion: "vende" } }, nuevas: [{ nombre: "BTG", preset: "custom", monto: 1500e6, anio: 1, fuente: "venta", pctRecibe: 100, rendimientoNomPct: 11 }] }).imp;
    expect(b.detalle[3].impuesto).toBeGreaterThan(a.detalle[3].impuesto);
  });
  it("un ingreso en dólares sigue en dólares: el motor lo trata como hoy, no como un ingreso nuevo en pesos", () => {
    const u2 = { ...user, ingresos: [...user.ingresos, { id: "i3", nombre: "Arriendo Orlando", categoria: "Arriendo", mensual: 7000, moneda: "USD", owner: "own_1" }] };
    const r0 = proyectarFuturo10(u2, { sinAutomaticos: true }), it = ingresosDelAnio(u2, r0, r0, 4, {}).find((x) => x.id === "i3");
    expect(it.moneda).toBe("USD"); expect(it.mensual).toBeCloseTo(7000, 6);
  });
  it("la retención se cuenta completa aunque supere el impuesto de ese titular", () => {
    const { imp } = corre({});
    imp.detalle[0].titulares.forEach((q) => expect(q.saldo).toBeCloseTo(Math.max(0, q.impuesto - q.retencion), 0));
  });
  it("sin motor tributario (sesión de EE. UU.) no estima nada y el escenario no cambia", () => {
    expect(impuestosPorAnio(user, proyectarFuturo10(user, {}), null, {}).porAnio).toEqual({});
  });
});
