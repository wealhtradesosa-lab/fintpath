import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { impuestosPorAnio, ingresosDelAnio, ingresoConValor, ventasDelAnio } from "../../src/lib/impuestosFuturo.js";
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

// Entrega 2 (28-nov-2026): impuesto por lo que se vende en la tabla.
describe("impuesto por lo que se vende (ganancia ocasional)", () => {
  const u = { ...user, inv: [{ id: "ap", n: "Apto arrendado", tp: "Real Estate", va: 900e6, vc: 400e6 }, { id: "ca", n: "Lote", tp: "Lote", va: 2000e6 }, { id: "cu", n: "Cuenta", tp: "Cash", va: 300e6 }] };
  const con = (cfg) => { const c = { sinAutomaticos: true, ...cfg }, r0 = proyectarFuturo10(u, { sinAutomaticos: true }), rA = proyectarFuturo10(u, c); return { rA, imp: impuestosPorAnio(u, rA, r0, { estimar, estHoy: estimar(u), cfg: c }) }; };
  it("ganancia = venta − lo que costó, al 15 %; se paga al año siguiente junto con el saldo de la declaración", () => {
    const { imp, rA } = con({ decisiones: { ap: { accion: "vende" } } }), v = imp.detalle[0].ventas.find((q) => q.id === "ap");
    expect(v.costo).toBe(400e6); expect(v.ganancia).toBeCloseTo(v.venta - 400e6, 0); expect(v.impuesto).toBeCloseTo(v.ganancia * 0.15, 0);
    expect(v.venta).toBeCloseTo(rA.vendidos.find((q) => q.id === "ap").valor, 0);
    expect(imp.detalle[1].pagaSaldo).toBeCloseTo(imp.detalle[0].saldo + v.impuesto, 0);   // en 2027 paga el saldo de 2026 más ese impuesto
    expect(imp.porAnio[1]).toBeCloseTo(imp.detalle[0].pagaRetencion + imp.detalle[0].pagaSaldo, 0); // en el año de la venta todavía no
  });
  it("si falta lo que costó, no inventa: queda sin calcular y marcado", () => {
    const v = con({ decisiones: { ca: { accion: "vende" } } }).imp.detalle[0].ventas.find((q) => q.id === "ca");
    expect(v.falta).toBe(true); expect(v.impuesto).toBe(0);
  });
  it("vender plata disponible no causa impuesto", () => {
    const v = con({ decisiones: { cu: { accion: "vende" } } }).imp.detalle[0].ventas.find((q) => q.id === "cu");
    expect(v.sinGanancia).toBe(true); expect(v.impuesto).toBe(0);
  });
  it("una venta en un año posterior se calcula con el precio de ese año", () => {
    const { imp } = con({ decisiones: { ap: { accion: "termina", desde: 4 } } }), v = imp.detalle[3].ventas.find((q) => q.id === "ap");
    expect(v.venta).toBeGreaterThan(900e6); expect(v.impuesto).toBeCloseTo((v.venta - 400e6) * 0.15, 0);
    expect(imp.detalle[4].pagaSaldo).toBeCloseTo(imp.detalle[3].saldo + v.impuesto, 0);
  });
  it("el valor que escribe la persona manda sobre el calculado", () => {
    const v = con({ decisiones: { ap: { accion: "vende" } }, impuestoVenta: { ap: 12345678 } }).imp.detalle[0].ventas.find((q) => q.id === "ap");
    expect(v.manual).toBe(true); expect(v.impuesto).toBe(12345678);
  });
});

// Entrega 3 (28-nov-2026): impuestos en otro país, escritos por la persona.
describe("impuestos en otro país", () => {
  const u = { ...user, inv: [...user.inv, { id: "or", n: "Casa Orlando", tp: "Real Estate", va: 300000, vc: 200000, moneda: "USD" }], ingresos: [...user.ingresos, { id: "i3", nombre: "Arriendo Orlando", categoria: "Arriendo", mensual: 3000, moneda: "USD", activoId: "or", owner: "own_1" }] };
  const con = (cfg) => { const c = { sinAutomaticos: true, ...cfg }, r0 = proyectarFuturo10(u, { sinAutomaticos: true }), rA = proyectarFuturo10(u, c); return impuestosPorAnio(u, rA, r0, { estimar, estHoy: estimar(u), cfg: c }); };
  it("sin escribir nada, no cambia el cálculo y lista la inversión para llenarla", () => {
    const a = con({});
    expect(a.detalle[0].exterior.map((x) => x.id)).toEqual(["or"]); expect(a.detalle[0].exteriorAnual).toBe(0);
    expect(a.detalle[0].paga).toBeCloseTo(a.detalle[0].pagaRetencion + a.detalle[0].pagaSaldo, 0);
  });
  it("lo de cada año se paga ese año, indexado, y deja de salir cuando la vende", () => {
    const a = con({ impExterior: { anual: { or: 20e6 } } }), b = con({ impExterior: { anual: { or: 20e6 } }, decisiones: { or: { accion: "termina", desde: 3 } } });
    expect(a.detalle[0].exteriorAnual).toBeCloseTo(20e6, 0); expect(a.detalle[2].exteriorAnual).toBeGreaterThan(20e6);
    expect(a.detalle[0].paga).toBeCloseTo(a.detalle[0].pagaRetencion + a.detalle[0].pagaSaldo + 20e6, 0);
    expect(b.detalle[4].exteriorAnual).toBe(0);
  });
  it("el descuento en Colombia nunca supera lo pagado afuera ni la parte de Colombia sobre esos ingresos", () => {
    const sin = con({}), a = con({ impExterior: { anual: { or: 20e6 } } }), d = a.detalle[0];
    expect(d.credito).toBeGreaterThanOrEqual(0); expect(d.credito).toBeLessThanOrEqual(20e6 + 1);
    expect(d.saldo).toBeCloseTo(sin.detalle[0].saldo - d.credito, 0);
  });
  it("en una venta: lo de afuera se paga ese año y se descuenta del de Colombia por esa misma venta", () => {
    const sin = con({ decisiones: { or: { accion: "vende" } } }).detalle[0].ventas[0], a = con({ decisiones: { or: { accion: "vende" } }, impExterior: { venta: { or: 30e6 } } }), v = a.detalle[0].ventas[0];
    expect(sin.fuera).toBe(true); expect(sin.impuesto).toBeCloseTo((300000 - 200000) * 4200 * 0.15, 0);
    expect(v.exterior).toBe(30e6); expect(v.credito).toBeCloseTo(Math.min(30e6, sin.impuesto), 0); expect(v.impuesto).toBeCloseTo(sin.impuesto - v.credito, 0);
    expect(a.detalle[0].exteriorVentas).toBe(30e6);
  });
});
