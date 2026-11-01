// fix/saldo-a-favor (1-nov-2026): saldoAFavor = max(0, retenciones − impuesto a
// cargo) se ve en el borrador con su texto, las sugerencias se acotan al
// impuesto a cargo (no al saldo) y, con saldo a favor, la tarjeta dice que el
// ahorro agranda la devolución. Donaciones/inversiones: nunca más que el flujo
// libre que queda después del fondo de emergencia.
import { describe, it, expect } from "vitest";
import { estimarImpuesto } from "../../src/lib/taxCO.js";
import { generarBorradorF210 } from "../../src/lib/borradorDeclaracionF210.js";
import { generarRecomendaciones } from "../../src/lib/recomendaciones.js";
import { generarRecomendacionesEstrategicas, AG_RECOS } from "../../src/lib/recomendacionesEstrategicas.js";
import { flujoLibreTrasEmergencia, sugerenciaPvAfc } from "../../src/lib/sugerenciaPvAfc.js";
import { AREAS_NATURAL } from "../../src/components/PlanAhorroTributario.jsx";
import { saldoAFavorDe, impuestoACargoDe, textoSaldoAFavor, notaAhorroConSaldoAFavor, montoSugeridoAcotado } from "../../src/lib/saldoAFavor.js";

const cop = (n) => "$" + Math.round(n).toLocaleString("es-CO");
const owner = { id: "o1", name: "Luis", type: "natural" };
const salario = (salMes) => ({ trm: 4200, owners: [owner], gas: {}, deu: [], inv: [],
  ingresos: [{ id: "sal", owner: "o1", nombre: "Salario", fiscalCode: "LAB_SALARIO", mensual: salMes, tipo: "fijo" }] });
const rentista = (arrMes, gastoMes) => ({ trm: 4200, owners: [owner], deu: [], inv: [],
  gas: { Entretenimiento: gastoMes ? [{ id: "g", owner: "o1", nombre: "Viajes", cat: "Entretenimiento", m: gastoMes, tipo: "fijo" }] : [] },
  ingresos: [{ id: "a", owner: "o1", nombre: "Arriendo", fiscalCode: "CAP_ARRIENDO_INMUEBLE", mensual: arrMes, tipo: "fijo" }] });
const detDe = (u) => estimarImpuesto(u, { ag: AG_RECOS }).detalle.find((d) => d.name === "Luis");

describe("saldo a favor en el borrador", () => {
  it("retenciones > impuesto a cargo: el F-210 muestra el renglón 114 con el monto y el texto exacto", () => {
    const u = salario(15e6);
    const est = estimarImpuesto(u, { ag: AG_RECOS });
    const det = est.detalle.find((d) => d.name === "Luis");
    expect(det.saldoAFavor).toBeGreaterThan(0);
    expect(det.saldoAFavor).toBe(Math.max(0, det.pagosPrevios - det.impuestoACargo));
    const r = generarBorradorF210(u, owner, est, AG_RECOS);
    const val = (n) => r.find((x) => x.numero === n)?.valor;
    const r114 = r.find((x) => x.numero === 114);
    expect(r114).toBeTruthy();
    expect(val(110)).toBeLessThan(0);
    expect(r114.valor).toBe(-val(110));
    expect(r114.valor).toBe(Math.max(0, val(102) - val(91)));
    expect(val(113)).toBe(0);
    expect(r114.valor).toBeCloseTo(det.saldoAFavor, 0);
    expect(r114.notaDe(r114.valor)).toBe(
      `Saldo a favor estimado: ${cop(r114.valor)}. Puedes pedir su devolución o usarlo en tu próxima declaración. Confírmalo con tu contador antes de solicitarlo.`
    );
  });
  it("sin saldo a favor el renglón 114 queda en 0 y no lleva nota", () => {
    const u = rentista(40e6, 0);
    const r = generarBorradorF210(u, owner, estimarImpuesto(u, { ag: AG_RECOS }), AG_RECOS);
    const r114 = r.find((x) => x.numero === 114);
    expect(r114.valor).toBe(0);
    expect(r114.notaDe(r114.valor)).toBeNull();
  });
  it("helpers: saldoAFavor = max(0, retenciones − impuesto a cargo)", () => {
    expect(saldoAFavorDe({ impuestoACargo: 3e6, pagosPrevios: 5e6 })).toBe(2e6);
    expect(saldoAFavorDe({ impuestoACargo: 8e6, pagosPrevios: 5e6 })).toBe(0);
    expect(saldoAFavorDe({ impuestoACargo: 3e6, retefuenteCalc: 4e6 })).toBe(1e6);
    expect(impuestoACargoDe({ impuestoACargo: 7e6, impuesto: 0 })).toBe(7e6);
    expect(textoSaldoAFavor(1234567)).toBe("Saldo a favor estimado: $1.234.567. Puedes pedir su devolución o usarlo en tu próxima declaración. Confírmalo con tu contador antes de solicitarlo");
  });
  it("persona jurídica: el motor expone saldoAFavor con la misma regla", () => {
    const u = { trm: 4200, owners: [{ id: "j1", name: "SAS", type: "juridica" }], gas: {}, deu: [], inv: [],
      ingresos: [{ id: "i", owner: "j1", nombre: "Ventas", fiscalCode: "ING_OPERACIONALES", mensual: 10e6, tipo: "fijo" }] };
    const dj = estimarImpuesto(u, { ag: AG_RECOS }).detalle.find((d) => d.name === "SAS");
    expect(dj.saldoAFavor).toBe(Math.max(0, (dj.retefuenteCalc || 0) - dj.impuestoACargo));
  });
});

describe("sugerencias con saldo a favor", () => {
  it("se acotan al impuesto a cargo y la tarjeta dice que el ahorro agranda la devolución (X → Y)", () => {
    const u = salario(15e6);
    const est = estimarImpuesto(u, { ag: AG_RECOS });
    const det = est.detalle.find((d) => d.name === "Luis");
    const recs = generarRecomendaciones(u, est).filter((r) => (r.ahorroAnualEstimado || 0) > 0);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.ahorroAnualEstimado).toBeLessThanOrEqual(det.impuestoACargo);
      const x = det.saldoAFavor, y = x + r.ahorroAnualEstimado;
      expect(r.notaSaldoAFavor).toBe(
        `Como ya tienes saldo a favor, este ahorro no baja lo que pagas: se suma a tu devolución, que pasaría de ${cop(x)} a ${cop(y)}. Confírmalo con tu contador`
      );
    }
    const estrategicas = generarRecomendacionesEstrategicas(u, owner, det).filter((r) => (r.ahorroAnual?.monto || 0) > 0);
    for (const r of estrategicas) expect(r.notaSaldoAFavor).toBe(notaAhorroConSaldoAFavor(det, r.ahorroAnual.monto));
  });
  it("Plan de ahorro: con saldo a favor (saldo a pagar 0) el ahorro de cada área sigue, acotado al impuesto a cargo", () => {
    const det = { impuestoACargo: 2_000_000, saldoACargo: 0, impuesto: 0, saldoAFavor: 3_000_000, tasaMarginal: 28,
      espacioParaPVyAFC: 50e6, aportesDesglose: { salarioGravableAnual: 180e6 } };
    const datos = { dependientes: { cantidad: 2 }, salud: { gastoMensual: 2e6 }, pension: { aporteMensual: 5e6, montoMensual: 5e6 }, vivienda: { interesesAnuales: 60e6 } };
    let alguno = false;
    for (const a of AREAS_NATURAL.filter((x) => x.estimarAhorro)) {
      const data = Object.values(datos).reduce((acc, d) => ({ ...acc, ...d }), {});
      const ahorro = a.estimarAhorro(data, det);
      expect(ahorro).toBeLessThanOrEqual(det.impuestoACargo);
      if (ahorro > 0) alguno = true;
    }
    expect(alguno).toBe(true);
  });
  it("sin saldo a favor no hay nota", () => {
    const u = rentista(40e6, 0);
    const det = detDe(u);
    expect(det.saldoAFavor).toBe(0);
    for (const r of generarRecomendacionesEstrategicas(u, owner, det)) expect(r.notaSaldoAFavor).toBeUndefined();
  });
});

describe("donación acotada por el flujo libre tras el fondo de emergencia", () => {
  it("con flujo libre de sobra, la donación es 50 % del impuesto a cargo (máx. $50M)", () => {
    const u = rentista(40e6, 0);
    const det = detDe(u);
    const don = generarRecomendacionesEstrategicas(u, owner, det).find((r) => r.id === "donacion_esal");
    expect(don.inversion.monto).toBe(Math.round(Math.min(det.impuestoACargo * 0.5, 50e6)));
  });
  it("con poco flujo libre, la donación no pasa del flujo libre y el descuento se recalcula", () => {
    const u = rentista(40e6, 30e6);
    const det = detDe(u);
    const fl = flujoLibreTrasEmergencia(u, owner, { ag: AG_RECOS });
    expect(fl.flujoLibreAnual).toBeGreaterThan(0);
    expect(fl.flujoLibreAnual).toBeLessThan(Math.min(det.impuestoACargo * 0.5, 50e6));
    const don = generarRecomendacionesEstrategicas(u, owner, det).find((r) => r.id === "donacion_esal");
    expect(don.inversion.monto).toBe(fl.flujoLibreAnual);
    expect(don.ahorroAnual.monto).toBe(fl.flujoLibreAnual * 0.25);
  });
  it("sin flujo libre no se sugiere donar", () => {
    const u = rentista(40e6, 33e6);
    const det = detDe(u);
    expect(flujoLibreTrasEmergencia(u, owner, { ag: AG_RECOS }).flujoLibreAnual).toBe(0);
    expect(generarRecomendacionesEstrategicas(u, owner, det).find((r) => r.id === "donacion_esal")).toBeUndefined();
  });
  it("flujoLibreTrasEmergencia es el mismo número que usa la sugerencia de PV/AFC", () => {
    for (const u of [salario(15e6), rentista(40e6, 30e6)]) {
      expect(flujoLibreTrasEmergencia(u, owner, { ag: AG_RECOS }).flujoLibreAnual).toBe(sugerenciaPvAfc(u, owner, { ag: AG_RECOS }).flujoLibreAnual);
    }
    expect(montoSugeridoAcotado(50e6, null)).toBe(50e6);
    expect(montoSugeridoAcotado(50e6, 12e6)).toBe(12e6);
  });
});
