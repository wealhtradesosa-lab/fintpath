// caminos.js + planes.js: de los datos de cualquier usuario a tres caminos que
// se cumplen. Usuario inventado; nada de datos reales.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario, CAMINOS_BASE, compararCaminos, medirCanastas, nuevoCamino, vigilarCamino, configurarCamino, PERFIL_DEFAULT, escenarioDesdeCamino, proponerDesdeCamino, escenarioVacio, pagaAlMes } from "../../src/lib/caminos.js";
import { simularCamino, estresar } from "../../src/lib/planes.js";

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

describe("lo que sobra cada mes", () => {
  // 22-oct-2026 (Santiago: "¿cómo hago para disponer de lo que sobra
  // reinvirtiendo una parte? ¿y en qué?").
  it("una parte se gasta y el resto va al destino elegido", () => {
    const r = simularCamino({
      meses: 12, caja: 0,
      posiciones: [{ id: "a", nombre: "CDT", bolsillo: "sustento", capital: 0, tasa: 0 }],
      flujos: [{ id: "s", nombre: "S", tipo: "ingreso", monto: 10 }, { id: "g", nombre: "G", tipo: "gasto", monto: 4 }],
      reglas: { excedente: [{ posicionId: "a", pct: 100 }], disfrutePct: 50 },
    });
    expect(r.meses[11].detalle.a.capital).toBe(36);
    expect(r.meses[0].disfrute).toBe(3);
  });
  it("el escenario manda el sobrante a la posición que la persona eligió", () => {
    const base = baseDesdeUsuario(user);
    const esc = escenarioVacio({ nombre: "A mi CDT", excedente: [{ canasta: "rentas", pct: 100 }], excedenteDestinos: { rentas: "i1" } });
    const [r] = compararCaminos([esc], base, PERFIL_DEFAULT);
    expect(r.cfg.reglas.excedente[0].posicionId).toBe("i1");
  });
});

describe("lo que una inversión te paga cambia con fecha", () => {
  it("reinvierte todo tres años y desde el cuarto paga el 100%", () => {
    const r = simularCamino({
      meses: 60, caja: 0,
      posiciones: [{ id: "f", nombre: "Fondo", bolsillo: "sustento", capital: 1200, tasa: 10, pagaPct: 0 }],
      flujos: [{ id: "g", nombre: "G", tipo: "gasto", monto: 1 }],
      movimientos: [{ mes: 36, tipo: "paga_cambia", posicionId: "f", pagaPct: 100 }],
      reglas: { excedente: [] },
    });
    expect(r.meses[12].detalle.f.recibe).toBe(0);
    expect(r.meses[12].detalle.f.capital).toBeGreaterThan(1200);
    expect(r.meses[40].detalle.f.recibe).toBeGreaterThan(10);
  });
});

describe("prueba de estrés", () => {
  it("bajar la tasa de crecimiento nunca sube el patrimonio", () => {
    const cfg = { meses: 24, caja: 0, posiciones: [{ id: "a", nombre: "Lento", bolsillo: "crecimiento", capital: 100, tasa: 1.5 }, { id: "b", nombre: "Rápido", bolsillo: "crecimiento", capital: 100, tasa: 20 }], flujos: [], reglas: {} };
    const base = simularCamino(cfg), peor = estresar(cfg, { tasaCrecimiento: 7.8 });
    expect(peor.puntos.patrimonioFinal).toBeLessThan(base.puntos.patrimonioFinal);
    expect(peor.meses[23].detalle.a.capital).toBeCloseTo(base.meses[23].detalle.a.capital, 6);
  });
});

describe("la parte que no recibes se reinvierte donde digas", () => {
  // 22-oct-2026 (Santiago: "uno no puede decir que se reinvierte un pedazo").
  it("de un fondo al 12% recibes el 50% y el otro 50% va al portafolio", () => {
    const r = simularCamino({
      meses: 12, caja: 0,
      posiciones: [{ id: "f", nombre: "Fondo", bolsillo: "sustento", capital: 1200, tasa: 12, pagaPct: 50, reinvierteEn: "p" }, { id: "p", nombre: "Portafolio", bolsillo: "crecimiento", capital: 0, tasa: 0 }],
      flujos: [], reglas: { excedente: [] },
    });
    expect(r.meses[0].detalle.f.recibe).toBeCloseTo(6, 6);
    expect(r.meses[0].detalle.p.capital).toBeGreaterThan(5);
    expect(r.meses[11].detalle.f.capital).toBeCloseTo(1200, 6);
    expect(r.meses[11].detalle.p.capital).toBeGreaterThan(60);
  });
  it("el escenario pasa recibes y destino de lo reinvertido a una posición que ya existe", () => {
    const base = baseDesdeUsuario(user);
    const esc = escenarioVacio({ nombre: "CDT a medias", despliegue: [{ id: "x", destinoId: "i1", nombre: "CDT", canasta: "rentas", capital: 0, tasa: 10, pagaPct: 40, reinvierteEn: "i2" }] });
    const [r] = compararCaminos([esc], base, PERFIL_DEFAULT);
    const cdt = r.cfg.posiciones.find((p) => p.id === "i1");
    expect(cdt.pagaPct).toBe(40);
    expect(cdt.reinvierteEn).toBe("i2");
  });
});

describe("la tabla de lo que sobra cada mes", () => {
  // 23-oct-2026 (Santiago: "20 % para gastos, 40 % a renta en cuáles, el resto
  // a crecimiento en cuáles: BTC, IBKR").
  it("reparte por filas: gasto, varios destinos, y reescala sobre lo reinvertido", () => {
    const base = baseDesdeUsuario(user);
    const esc = escenarioVacio({ nombre: "Tabla", repartoSobrante: [{ id: "a", posicionId: "gasto", pct: 20 }, { id: "b", posicionId: "i1", pct: 40 }, { id: "c", posicionId: "i2", pct: 30 }, { id: "d", posicionId: "i5", pct: 10 }] });
    const [r] = compararCaminos([esc], base, PERFIL_DEFAULT);
    expect(r.cfg.reglas.disfrutePct).toBe(20);
    const ex = Object.fromEntries(r.cfg.reglas.excedente.map((e) => [e.posicionId, Math.round(e.pct)]));
    expect(ex.i1).toBe(50); expect(ex.i2).toBe(38); expect(ex.i5).toBe(13);
    expect(r.ajuste.notas.join(" ")).toMatch(/20% te lo gastas · 40% a CDT/);
  });
});
