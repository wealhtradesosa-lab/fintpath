// caminos.js + planes.js: de los datos de cualquier usuario a tres caminos que
// se cumplen. Usuario inventado; nada de datos reales.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario, CAMINOS_BASE, compararCaminos, medirCanastas, nuevoCamino, vigilarCamino, configurarCamino, PERFIL_DEFAULT, escenarioDesdeCamino, proponerDesdeCamino, escenarioVacio, configurarEscenario, pagaAlMes } from "../../src/lib/caminos.js";
import { simularCamino } from "../../src/lib/planes.js";

const user = {
  trm: 4200,
  inv: [
    { id: "i1", n: "CDT", tp: "CDT", va: 200e6, tasa: 10 },
    { id: "i2", n: "ETF mundo", tp: "ETF", va: 80e6 },
    { id: "i3", n: "Apartamento arrendado", tp: "Real Estate", va: 450e6 },
    { id: "i4", n: "Casa donde vivo", tp: "Real Estate", va: 600e6 },
    { id: "i5", n: "Bitcoin", tp: "Crypto", va: 30e6 },
    { id: "i6", n: "Carro", tp: "Vehículo", va: 70e6 },
    { id: "i7", n: "Lote", tp: "Real Estate", va: 150e6 },
  ],
  ingresos: [
    { id: "g1", nombre: "Salario", categoria: "Salario", mensual: 12e6 },
    { id: "g2", nombre: "Arriendo apartamento", categoria: "Arriendo", mensual: 2.5e6, activoId: "i3" },
    { id: "g3", nombre: "Intereses CDT", categoria: "Intereses", mensual: 1.666e6, capital: 200e6, tasa: 10 },
    { id: "g4", nombre: "Fondo privado", categoria: "Rendimiento", mensual: 2e6, capital: 120e6, tasa: 20 },
  ],
  gas: { Personal: [{ c: "Mercado", m: 2e6, t: "f" }, { c: "Colegio", m: 3e6, t: "f" }], Vivienda: [{ c: "Servicios", m: 0.8e6, t: "f" }] },
  deu: [{ id: "d1", n: "Hipoteca", tp: "mortgage", mt: 250e6, pg: 2.8e6, ts: 11 }, { id: "d2", n: "Tarjeta", tp: "loan", mt: 15e6, pg: 0.9e6, ts: 28 }],
};

describe("baseDesdeUsuario", () => {
  const base = baseDesdeUsuario(user);
  it("reconoce la vivienda, los inmuebles que rentan y el capital que solo está como ingreso", () => {
    const by = Object.fromEntries(base.posiciones.map((p) => [p.id, p]));
    expect(by.i4.vivienda).toBe(true);
    expect(by.i3.bolsillo).toBe("sustento");
    expect(by.i3.renta).toBe(2.5e6);
    expect(by.i1.tasa).toBe(10);
    expect(by.cap_g4).toMatchObject({ capital: 120e6, tasa: 20, bolsillo: "sustento" });
    expect(by.i2.bolsillo).toBe("crecimiento");
  });
  it("mide canastas sobre lo invertible", () => {
    const c = medirCanastas(base.posiciones, 0);
    expect(c.vivienda).toBe(600e6);
    expect(Math.round(c.rentas / 1e6)).toBe(770);
    expect(Math.round(c.crecimiento / 1e6)).toBe(110);
    expect(Math.round(c.uso / 1e6)).toBe(220);
    expect(c.rentasPct + c.crecimientoPct).toBeCloseTo(100, 6);
  });
  it("los gastos del mes incluyen cuotas", () => {
    expect(Math.round(base.gastosMes / 1e5)).toBe(95);
  });
});

describe("los tres caminos", () => {
  const base = baseDesdeUsuario(user);
  const res = compararCaminos(CAMINOS_BASE, base, PERFIL_DEFAULT);
  const by = Object.fromEntries(res.map((r) => [r.id, r]));

  it("todos se cumplen en los 10 años y se sostienen", () => {
    res.forEach((r) => { expect(r.vigilancia.cumple, `${r.nombre}: ${JSON.stringify(r.vigilancia.roturas)}`).toBe(true); expect(r.puntos.seSostiene).toBe(true); });
  });
  // 22-oct-2026 — La plantilla ya NO arma el escenario sola: trae la mezcla a
  // la que apunta y nada más. Santiago: "de una vez poner los valores es
  // incorrecto, pues uno está precisamente construyendo".
  it("ninguna plantilla llega repartiendo la plata", () => {
    CAMINOS_BASE.forEach((c) => {
      const e = escenarioDesdeCamino(base, c, PERFIL_DEFAULT);
      expect(e.despliegue, c.nombre).toEqual([]);
      expect(e.ventas, c.nombre).toEqual([]);
      expect(e.pagos, c.nombre).toEqual([]);
      expect(e.eventos, c.nombre).toEqual([]);
      expect(e.objetivo, c.nombre).toBeTruthy();
    });
  });
  it("cada mezcla tiene de todo un poco: ninguna canasta en 0 ni en 100", () => {
    CAMINOS_BASE.forEach((c) => {
      const o = c.objetivo;
      expect(o.proteccion + o.rentas + o.crecimiento, c.nombre).toBe(100);
      [o.proteccion, o.rentas, o.crecimiento].forEach((x) => { expect(x, c.nombre).toBeGreaterThan(0); expect(x, c.nombre).toBeLessThan(100); });
      // Y lo que sobra cada mes tampoco se va entero para un solo lado.
      c.excedente.forEach((e) => expect(e.pct, `${c.nombre} excedente`).toBeLessThan(100));
    });
  });
  it("pero si la persona la pide, la propuesta sigue sabiendo armarla", () => {
    const c = CAMINOS_BASE.find((x) => x.id === "seguridad");
    const prop = proponerDesdeCamino(base, c, escenarioDesdeCamino(base, c, PERFIL_DEFAULT), PERFIL_DEFAULT);
    expect(prop.despliegue.length + prop.ventas.length + prop.pagos.length).toBeGreaterThan(0);
  });
  it("Balance mantiene el crecimiento en rango gracias al rebalanceo anual", () => {
    const b = by.balance;
    expect(b.canastasFin.crecimientoPct).toBeLessThanOrEqual(52);
    expect(b.canastasFin.crecimientoPct).toBeGreaterThanOrEqual(23);
    expect(b.resultado.log.some((l) => /Rebalanceo/.test(l.texto))).toBe(true);
  });
  it("Más crecimiento inclina hacia lo que crece, pero no se lo lleva todo", () => {
    const c = by.crecimiento;
    expect(c.canastasFin.crecimientoPct).toBeLessThan(100);
    expect(c.canastasFin.rentasPct).toBeGreaterThan(0);
  });
  it("cada camino da los mismos puntos para comparar", () => {
    res.forEach((r) => ["patrimonioFinal", "patrimonioFinalReal", "entraMes", "saleMes", "cobertura", "produceMes", "estres", "sinMayorFuente"].forEach((k) => expect(r.puntos[k], `${r.nombre}.${k}`).toBeDefined()));
  });
});

describe("caminos propios y condiciones", () => {
  const base = baseDesdeUsuario(user);
  it("un camino propio con rangos libres corre con la misma forma", () => {
    const mio = nuevoCamino({ nombre: "Mi camino", canastas: { rentas: { min: 30 }, crecimiento: { min: 40, max: 70 }, colchonMeses: 9, vivienda: "indiferente" }, excedente: [{ canasta: "crecimiento", pct: 100 }] });
    const [r] = compararCaminos([mio], base);
    expect(r.nombre).toBe("Mi camino");
    expect(r.vigilancia.cumple).toBe(true);
  });
  it("vender la vivienda dentro de Seguridad rompe la condición", () => {
    const seg = { ...CAMINOS_BASE[0], movimientos: [{ mes: 24, tipo: "vender", posicionId: "i4" }] };
    const c = configurarCamino(base, seg);
    const r = simularCamino(c.cfg);
    const v = vigilarCamino(c, c.cfg, r);
    expect(v.cumple).toBe(false);
    expect(v.roturas.some((x) => /vivienda/i.test(x.detalle))).toBe(true);
  });
});

describe("motor: colchón primero", () => {
  it("el excedente llena el colchón hasta la meta antes de repartirse", () => {
    const r = simularCamino({
      meses: 12, caja: 0,
      posiciones: [{ id: "liq", nombre: "CDT", bolsillo: "sustento", capital: 0, tasa: 0 }, { id: "etf", nombre: "ETF", bolsillo: "crecimiento", capital: 0, tasa: 0 }],
      flujos: [{ id: "s", nombre: "Salario", tipo: "ingreso", monto: 10 }, { id: "g", nombre: "Vida", tipo: "gasto", monto: 5 }],
      reglas: { excedente: [{ posicionId: "etf", pct: 100 }], colchon: { posicionId: "liq", meta: 30 } },
    });
    const fin = r.meses[11];
    expect(fin.detalle.liq.capital).toBe(30);
    expect(fin.detalle.etf.capital).toBe(30);
  });
});

describe("una venta dice a dónde va la plata", () => {
  // 22-oct-2026 (Santiago: "si vendí Puerto Madero, ¿por qué no muestra que
  // ese mismo año ingresa BTG?"). La plata de una venta futura no se queda en
  // caja: entra el mismo mes a la inversión elegida, nueva o existente.
  const base = baseDesdeUsuario(user);
  it("a una inversión nueva que paga desde ese mes", () => {
    const esc = escenarioVacio({ nombre: "Apto → fondo", eventos: [{ id: "mv_1", mes: 24, tipo: "vender", posicionId: "i3", nuevo: { nombre: "Fondo", canasta: "rentas", tasa: 14, pagaPct: 100 } }] });
    const [r] = compararCaminos([esc], base, PERFIL_DEFAULT);
    const m = r.resultado.meses;
    expect(m[23].detalle.mv_1_dest.capital).toBe(0);
    expect(m[24].detalle.mv_1_dest.capital).toBeGreaterThan(400e6);
    expect(m[25].detalle.mv_1_dest.recibe).toBeGreaterThan(4e6);
    expect(r.resultado.log.some((l) => l.mes === 24 && /a Fondo/.test(l.texto))).toBe(true);
  });
  it("a una que ya tienes", () => {
    const esc = escenarioVacio({ nombre: "Apto → CDT", eventos: [{ id: "mv_2", mes: 24, tipo: "vender", posicionId: "i3", destinoId: "i1" }] });
    const [r] = compararCaminos([esc], base, PERFIL_DEFAULT);
    expect(r.resultado.meses[24].detalle.i1.capital).toBeGreaterThan(r.resultado.meses[23].detalle.i1.capital + 400e6);
  });
  it("y la cuota aproximada es capital × tasa ÷ 12 × lo que recibes", () => {
    expect(pagaAlMes(7500e6, 14, 100)).toBeCloseTo(87.5e6, -3);
    expect(pagaAlMes(7500e6, 14, 0)).toBe(0);
  });
});
