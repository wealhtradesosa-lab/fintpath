import { describe, it, expect } from "vitest";
import { proyectarFuturo10, inversionesHoy, leerCambios } from "../../src/lib/futuro10.js";

// 22-nov-2026 (Santiago): dejar Puerto Madero para uso propio en el plan.
const user = () => ({
  trm: 4000, inflacionPct: 4,
  inv: [{ id: "pm", n: "Puerto Madero", tipo: "inmueble", va: 3000e6 }, { id: "c", n: "Cash", liquido: true, va: 500e6 }],
  ingresos: [
    { nombre: "Renta domo", tipo: "pasivo", activoId: "pm", mensual: 20e6, frecuencia: "mensual" },
    { nombre: "Renta casa principal", tipo: "pasivo", activoId: "pm", mensual: 25e6, frecuencia: "mensual" },
    { nombre: "Salario", mensual: 60e6, frecuencia: "mensual" },
  ],
  gas: { Vivienda: [{ c: "Administración PM", activoId: "pm", mensual: 5e6, frecuencia: "mensual" }], Vida: [{ c: "Mercado", mensual: 20e6, frecuencia: "mensual" }] },
});

describe("paso 1: Cambia (renta nueva; 0 = deja de rentar)", () => {
  it("leerCambios ignora «renta distinta» sin monto", () => {
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: "" } } })).toEqual({});
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: 0, desde: 3 } } }).pm).toMatchObject({ modo: "propio", desde: 3 });
    expect(leerCambios({ decisiones: { pm: { accion: "cambia", mensual: 30e6 } } }).pm).toMatchObject({ modo: "renta", desde: 1 });
  });

  it("uso propio desde ya: la renta deja de entrar y la administración pasa a gastos", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 1 } } });
    const b1 = base.filas[1], f1 = r.filas[1];
    expect(b1.ingresos - f1.ingresos).toBeCloseTo(40e6 * 12, -3); // neta 45 − 5
    expect(f1.gastos - b1.gastos).toBeCloseTo(5e6 * 12, -3);
    expect((f1.porActivo.find((x) => x.id === "pm") || {}).renta || 0).toBe(0);
    expect(f1.gastosItems.some((g) => g.nombre === "Administración PM")).toBe(true);
    expect(r.desglose.entra.some((x) => /Puerto Madero/.test(x.nombre))).toBe(false);
    expect(r.desglose.sale.some((x) => x.nombre === "Administración PM")).toBe(true);
  });

  it("uso propio desde el año 3: los años 1 y 2 siguen con renta", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 3 } } });
    expect(r.filas[2].ingresos).toBeCloseTo(base.filas[2].ingresos, -3);
    expect(r.filas[3].ingresos).toBeLessThan(base.filas[3].ingresos - 40e6 * 12);
    expect(r.filas[3].gastos).toBeGreaterThan(base.filas[3].gastos + 5e6 * 12);
    expect(r.filas[3].gastosItems.some((g) => g.nombre === "Administración PM")).toBe(true);
    expect(r.filas[2].gastosItems.some((g) => g.nombre === "Administración PM")).toBe(false);
  });

  it("renta distinta: la nueva renta neta reemplaza la de hoy desde el año elegido", () => {
    const base = proyectarFuturo10(user(), {});
    const r = proyectarFuturo10(user(), { decisiones: { pm: { accion: "cambia", desde: 1, mensual: 30e6 } } });
    expect(base.filas[1].ingresos - r.filas[1].ingresos).toBeCloseTo(10e6 * 12, -3);
    expect(r.filas[1].porActivo.find((x) => x.id === "pm").renta).toBeCloseTo(30e6 * 12, -3);
    expect(r.filas[1].gastos).toBeCloseTo(base.filas[1].gastos, -3);
  });

  it("inversionesHoy expone el cambio", () => {
    const x = inversionesHoy(user(), { decisiones: { pm: { accion: "cambia", mensual: 0, desde: 2 } } }).find((y) => y.id === "pm");
    expect(x.cambio).toMatchObject({ modo: "propio", desde: 2 });
    expect(x.costoLigado).toBeCloseTo(5e6, -3);
    expect(x.vende).toBe(false);
  });
});

// 22-nov-2026 (Santiago: "esta inversión dura 2 años: me devuelven el capital y dejo de recibir la renta").
describe("paso 1: se vende o vence en un año siguiente", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "rc", n: "Rapicredit fondeo", tipo: "otro", va: 3288e6 }, { id: "c", n: "Cash", liquido: true, va: 100e6 }],
    ingresos: [{ nombre: "Rapicredit", tipo: "pasivo", activoId: "rc", mensual: 54.8e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }],
    gas: { Vida: [{ c: "Vida", mensual: 40e6, frecuencia: "mensual" }] } });
  it("vence en el año 3: renta hasta el año 2, capital vuelve y el patrimonio no se pierde", () => {
    const base = proyectarFuturo10(u(), {});
    const r = proyectarFuturo10(u(), { decisiones: { rc: { accion: "termina", desde: 3 } } });
    expect(r.filas[2].ingresos).toBeCloseTo(base.filas[2].ingresos, -3);
    expect(base.filas[3].ingresos - r.filas[3].ingresos).toBeGreaterThan(54.8e6 * 12);
    expect(r.filas[2].porActivo.some((x) => x.id === "rc" && x.valor > 0)).toBe(true);
    expect(r.filas[3].porActivo.some((x) => x.id === "rc")).toBe(false);
    // el capital no desaparece: el patrimonio del año 3 queda cerca del año 2 (no cae 3.288 M)
    expect(r.filas[3].patrimonio).toBeGreaterThan(r.filas[2].patrimonio * 0.98);
    expect(r.alertas.some((a) => a.tipo === "activo_termina" && a.anio === 3)).toBe(true);
    expect(r.bolsaDetalle.vendido).toBe(0); // no es una venta de hoy
  });
  it("inversionesHoy lo expone y no lo marca como vendido hoy", () => {
    const x = inversionesHoy(u(), { decisiones: { rc: { accion: "termina", desde: 3 } } }).find((y) => y.id === "rc");
    expect(x.termina).toBe(3); expect(x.vende).toBe(false);
  });
});

// 22-nov-2026 (Santiago): el vencimiento cargado en Patrimonio entra solo al plan.
import { vencimientosPatrimonio } from "../../src/lib/futuro10.js";
describe("vencimiento cargado en Patrimonio", () => {
  const Y = new Date().getFullYear();
  const u = (venceAnio, venceMes = 6) => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "cdt", n: "CDT", tipo: "CDT", va: 100e6, venceAnio, venceMes }, { id: "c", n: "Cash", liquido: true, va: 50e6 }],
    ingresos: [{ nombre: "Int CDT", tipo: "pasivo", activoId: "cdt", mensual: 1e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 20e6, frecuencia: "mensual" }], gas: {} });
  it("año del plan: este año → 2; a mitad del año siguiente → 2; diciembre → año siguiente", () => {
    expect(vencimientosPatrimonio(u(Y)).cdt).toBe(2);
    expect(vencimientosPatrimonio(u(Y + 1)).cdt).toBe(2);
    expect(vencimientosPatrimonio(u(Y + 1, 12)).cdt).toBe(3);
    expect(vencimientosPatrimonio(u(Y - 1)).cdt).toBeUndefined();
    expect(vencimientosPatrimonio(u(Y + 30)).cdt).toBeUndefined();
  });
  it("sin decidir nada, el plan libera el capital ese año; «se conserva» lo renueva", () => {
    const r = proyectarFuturo10(u(Y + 2), {});
    expect(r.liberados).toHaveLength(1); expect(r.liberados[0]).toMatchObject({ id: "cdt", anio: 3 });
    expect(r.liberados[0].monto).toBeGreaterThan(100e6 * 0.99);
    const x = inversionesHoy(u(Y + 2), {}).find((y) => y.id === "cdt");
    expect(x.termina).toBe(3); expect(x.terminaDePatrimonio).toBe(true);
    const r2 = proyectarFuturo10(u(Y + 2), { decisiones: { cdt: { accion: "continua" } } });
    expect(r2.liberados).toHaveLength(0);
  });
});

// 22-nov-2026 (Santiago): fecha de fin opcional en ingresos y gastos, leída por el plan.
import { finalesDeDatos, ingresosSueltosHoy, gastosLista } from "../../src/lib/futuro10.js";
describe("fecha de fin en Ingresos y Egresos", () => {
  const Y = new Date().getFullYear();
  const u = () => ({ trm: 4000, inflacionPct: 4, inv: [{ id: "c", n: "Cash", liquido: true, va: 50e6 }],
    ingresos: [{ id: "con", nombre: "Contrato asesoría", mensual: 10e6, frecuencia: "mensual", finAnio: Y + 2, finMes: 3 }, { id: "s", nombre: "Salario", mensual: 20e6, frecuencia: "mensual" }],
    gas: { Educación: [{ id: "col", c: "Colegio", mensual: 3e6, frecuencia: "mensual", finAnio: Y + 3, finMes: 11 }], Vida: [{ id: "v", c: "Vida", mensual: 8e6, frecuencia: "mensual" }] } });
  it("calcula el año del plan desde el que ya no cuenta", () => {
    const f = finalesDeDatos(u());
    expect(f.ingresos["i:id:con"]).toBe(3);       // termina en marzo de Y+2 → no cuenta desde el año 3
    expect(f.gastos["Educación::id:col"]).toBe(5); // termina en noviembre de Y+3 (año 4) → no cuenta desde el 5
  });
  it("el plan lo aplica solo y «sigue» lo anula", () => {
    const base = proyectarFuturo10({ ...u(), ingresos: u().ingresos.map((i) => ({ ...i, finAnio: undefined })), gas: { ...u().gas, Educación: [{ id: "col", c: "Colegio", mensual: 3e6, frecuencia: "mensual" }] } }, {});
    const r = proyectarFuturo10(u(), {});
    expect(r.filas[2].ingresos).toBeCloseTo(base.filas[2].ingresos, -3);
    expect(base.filas[3].ingresos - r.filas[3].ingresos).toBeGreaterThan(10e6 * 12);
    expect(r.filas[4].gastos).toBeCloseTo(base.filas[4].gastos, -3);
    expect(base.filas[5].gastos - r.filas[5].gastos).toBeGreaterThan(3e6 * 12);
    const r2 = proyectarFuturo10(u(), { ingresosTerminan: { "i:id:con": "sigue" }, gastosTerminan: { "Educación::id:col": "sigue" } });
    expect(r2.filas[5].ingresos).toBeCloseTo(base.filas[5].ingresos, -3);
    expect(r2.filas[5].gastos).toBeCloseTo(base.filas[5].gastos, -3);
  });
  it("las listas del paso 1 lo muestran como dato de la página", () => {
    const i = ingresosSueltosHoy(u(), {}).find((x) => x.key === "i:id:con");
    expect(i).toMatchObject({ acabaAnio: 3, finDeDatos: true, finAnio: Y + 2 });
    const g = gastosLista(u(), {}).find((x) => x.key === "Educación::id:col");
    expect(g).toMatchObject({ acabaAnio: 5, finDeDatos: true });
    expect(ingresosSueltosHoy(u(), { ingresosTerminan: { "i:id:con": "sigue" } }).find((x) => x.key === "i:id:con").acabaAnio).toBeNull();
  });
});

// 23-nov-2026 (Santiago): inversión nueva con plazo; al vencer, toda o una parte queda libre.
describe("inversión nueva con plazo", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4, inv: [{ id: "o", n: "Casa", tipo: "inmueble", va: 10000e6 }], ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} });
  const base = { decisiones: { o: { accion: "vende" } }, mezcla: { liquidez: 100, renta: 0, crecimiento: 0 } };
  it("retira todo en el año 3: llega como plata libre y la inversión desaparece", () => {
    const r = proyectarFuturo10(u(), { ...base, nuevas: [{ preset: "rfCorto", monto: 10000e6, fuente: "venta", hasta: 3 }] });
    expect(r.liberados).toHaveLength(1);
    expect(r.liberados[0]).toMatchObject({ id: "nueva_0_retiro", anio: 3 });
    expect(r.liberados[0].monto).toBeGreaterThan(10000e6);
    expect(r.filas[2].porActivo.some((x) => x.id === "nueva_0")).toBe(true);
    expect(r.filas[3].porActivo.some((x) => x.id === "nueva_0")).toBe(false);
    expect(r.filas[3].patrimonio).toBeGreaterThan(r.filas[2].patrimonio * 0.99);
  });
  it("retira una parte: el resto sigue invertido", () => {
    const r = proyectarFuturo10(u(), { ...base, nuevas: [{ preset: "rfCorto", monto: 10000e6, fuente: "venta", hasta: 3, retiraParte: true, retira: 4000e6 }] });
    expect(r.liberados[0].monto).toBeCloseTo(4000e6, -3);
    expect(r.liberados[0].parcial).toBe(true);
    expect(r.filas[3].porActivo.find((x) => x.id === "nueva_0").valor).toBeGreaterThan(6000e6);
  });
  it("lo retirado puede ir a otra inversión de ese año", () => {
    const r = proyectarFuturo10(u(), { ...base, nuevas: [{ preset: "rfCorto", monto: 10000e6, fuente: "venta", hasta: 3, retiraParte: true, retira: 4000e6 }, { preset: "custom", nombre: "Bodega", monto: 4000e6, anio: 3, fuente: "liquidez", rendimientoNomPct: 12 }] });
    expect(r.filas[3].porActivo.find((x) => x.id === "nueva_1").valor).toBeGreaterThan(4000e6 * 0.99);
    expect(r.liqAgotadaAnio).toBeNull();
  });
});

// 23-nov-2026 (Santiago): un fondo con plazo no se gasta como «plata de mis cuentas».
describe("un fondo con plazo llega completo al año en que termina", () => {
  it("invertir «de mis cuentas» no lo vacía", () => {
    const u = { trm: 4000, inflacionPct: 4,
      inv: [{ id: "rc", n: "Fondeo", tipo: "Fondo de Inversión", va: 3288e6 }, { id: "lt", n: "Lote", tipo: "Real Estate", va: 400e6 }, { id: "c", n: "Cash", tipo: "Cash", va: 100e6 }],
      ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} };
    const r = proyectarFuturo10(u, { decisiones: { rc: { accion: "termina", desde: 3 } }, reinversiones: [{ activoId: "lt", monto: 600e6, anio: 1, fuente: "liquidez" }] });
    expect(r.liberados).toHaveLength(1);
    expect(r.liberados[0].monto).toBeGreaterThan(3288e6);
  });
});

// 23-nov-2026 (Santiago): "dejo de recibir 57 M y me regresan 3.288 M".
describe("inversión a plazo que paga renta: devuelve el capital que se puso", () => {
  it("regresa exactamente el capital y la renta se acaba", () => {
    const u = { trm: 4000, inflacionPct: 4, inv: [{ id: "rc", n: "Fondeo", tipo: "Fondo de Inversión", va: 3288e6 }],
      ingresos: [{ nombre: "Renta fondeo", tipo: "pasivo", activoId: "rc", mensual: 57e6, frecuencia: "mensual" }, { nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} };
    const r = proyectarFuturo10(u, { decisiones: { rc: { accion: "termina", desde: 3 } } });
    expect(r.liberados[0].monto).toBeCloseTo(3288e6, -3);
    expect(r.filas[3].porActivo.some((x) => x.id === "rc")).toBe(false);
    const x = inversionesHoy(u, { decisiones: { rc: { accion: "termina", desde: 3 } } }).find((y) => y.id === "rc");
    expect(x.crecPct).toBe(0);
  });
});

// 23-nov-2026: un inmueble con hipoteca que se vende en un año siguiente paga su deuda con esa venta.
describe("venta en un año siguiente de un activo con deuda", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4, inv: [{ id: "o", n: "Casa", tipo: "Real Estate", va: 2000e6 }, { id: "c", n: "Cash", tipo: "Cash", va: 100e6 }],
    ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {},
    deudas: [{ id: "h", n: "Hipoteca", mt: 1100e6, pg: 9e6, la: "o" }] });
  it("llega el valor menos lo que se debe, la deuda baja y la cuota se acaba", () => {
    const base = proyectarFuturo10(u(), {});
    const r = proyectarFuturo10(u(), { decisiones: { o: { accion: "termina", desde: 2 } } });
    const l = r.liberados[0];
    expect(l.pagoDeuda).toBeGreaterThan(900e6);
    expect(l.monto + l.pagoDeuda).toBeCloseTo(2000e6 * 1.04, -6);
    expect(r.filas[2].deuda).toBeLessThan(1e6);
    expect(r.filas[2].cuota).toBeLessThan(1e6);
    expect(base.filas[2].cuota).toBeGreaterThan(100e6);
    // el patrimonio no cambia por vender y pagar (solo cambia de forma)
    expect(Math.abs(r.filas[2].patrimonio - base.filas[2].patrimonio) / base.filas[2].patrimonio).toBeLessThan(0.03);
  });
});

// 23-nov-2026 (Santiago): "me dice que me pasé en 13.000 M cuando está bien".
describe("invertir en un año siguiente con la plata que llega ese año", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "pm", n: "PM", tipo: "Real Estate", va: 9000e6 }, { id: "ca", n: "Cascadas", tipo: "Real Estate", va: 800e6 }, { id: "ib", n: "IBKR", tipo: "Acciones", va: 138e6 }, { id: "c", n: "Cash", tipo: "Cash", va: 50e6 }],
    ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {} });
  it("«de lo que vendo» en 2027 no se cobra a las ventas de hoy ni marca «te pasaste»", () => {
    const r = proyectarFuturo10(u(), { decisiones: { pm: { accion: "termina", desde: 2 }, ca: { accion: "vende" } },
      reinversiones: [{ activoId: "ib", monto: 1000e6, anio: 2, fuente: "venta" }],
      nuevas: [{ preset: "custom", nombre: "BTG", monto: 6000e6, anio: 2, fuente: "venta", rendimientoNomPct: 10 }] });
    expect(r.bolsaDetalle.excesoVentas).toBeLessThan(1);
    expect(r.bolsaDetalle.restante).toBeGreaterThan(700e6); // lo de hoy queda libre
    expect(r.liqAgotadaAnio).toBeNull();
    expect(r.filas[2].porActivo.find((x) => x.id === "nueva_0").valor).toBeGreaterThan(5900e6);
    expect(r.filas[2].porActivo.find((x) => x.id === "ib").valor).toBeGreaterThan(1100e6);
  });
});

// 23-nov-2026 (Santiago): "vender la Volvo y esa deuda se paga con la misma venta, no con Cascadas".
import { sugerirActivoDeDeuda } from "../../src/lib/futuro10.js";
describe("deuda ligada a un activo en el plan", () => {
  const u = () => ({ trm: 4000, inflacionPct: 4,
    inv: [{ id: "vo", n: "VOLVO E60", tipo: "Vehículo", va: 250e6 }, { id: "ca", n: "50% cascadas", tipo: "Real Estate", va: 800e6 }, { id: "lm", n: "local macarena", tipo: "Local Comercial", va: 1350e6 }, { id: "lt", n: "lote bodega macarena", tipo: "Bodega", va: 410e6 }],
    ingresos: [{ nombre: "Salario", mensual: 60e6, frecuencia: "mensual" }], gas: {},
    deudas: [{ id: "d3", n: "SUFI VOLVO", mt: 152e6, pg: 4e6 }, { id: "d4", n: "SALDO LOCAL MACARENA", mt: 437e6, pg: 4e6 }] });
  it("sugiere el activo solo cuando el nombre apunta a uno solo", () => {
    const act = u().inv.map((a) => ({ id: a.id, nombre: a.n }));
    expect(sugerirActivoDeDeuda("SUFI VOLVO", act)).toBe("vo");
    expect(sugerirActivoDeDeuda("SALDO LOCAL MACARENA", act)).toBeNull(); // «macarena» está en dos activos
    expect(sugerirActivoDeDeuda("Crédito libre inversión", act)).toBeNull();
  });
  it("ligada y vendiendo la Volvo hoy: se paga con la Volvo y Cascadas queda completa", () => {
    const r = proyectarFuturo10(u(), { decisiones: { vo: { accion: "vende" }, ca: { accion: "vende" } }, deudaDe: { d3: "vo" } });
    const d = r.deudas.find((x) => x.id === "d3");
    expect(d).toMatchObject({ porVenta: true }); expect(d.pagado).toBeCloseTo(152e6, -3);
    expect(r.bolsaDetalle.restante + r.bolsaDetalle.colchon).toBeCloseTo(800e6 + 250e6 - 152e6, -3);
  });
  it("si la Volvo se vende en 2027, la deuda no se paga hoy aunque esté marcada", () => {
    const r = proyectarFuturo10(u(), { decisiones: { vo: { accion: "termina", desde: 2 }, ca: { accion: "vende" } }, deudaDe: { d3: "vo" }, pagarDeudas: { d3: true } });
    expect(r.deudas.find((x) => x.id === "d3")).toMatchObject({ pagado: 0, ventaAnio: 2 });
    expect(r.bolsaDetalle.restante + r.bolsaDetalle.colchon).toBeCloseTo(800e6, -3);
    expect(r.liberados[0].pagoDeuda).toBeGreaterThan(50e6);
  });
});
