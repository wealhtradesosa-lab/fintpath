// 22-oct-2026 — Del Plan Patrimonial SALEM: "la casa VIP es para vivirla: no
// se vende y no paga el 35%", y el motor de semiurbanas vive "en la SAS,
// porque construir y vender es su negocio".
//
// Lo que gana una sociedad paga renta ANTES de llegarte. Lo tuyo personal ya
// está contado en tus gastos (el impuesto neto del año), así que por defecto
// no se vuelve a cobrar: cobrarlo acá sería contarlo dos veces.
import { describe, it, expect } from "vitest";
import { baseDesdeUsuario, titularDe, configurarEscenario, escenarioVacio, PERFIL_DEFAULT } from "../../src/lib/caminos.js";

// El impuesto de sociedad arranca APAGADO (ver PERFIL_DEFAULT): se cobra solo
// si la persona lo enciende. Estas pruebas lo encienden a proposito.
const CON_IMPUESTO = { ...PERFIL_DEFAULT, impuestoSociedad: 35 };
import { simularCamino } from "../../src/lib/planes.js";

const owners = [{ id: "own_p", name: "Personal", type: "natural" }, { id: "own_sas", name: "SALEM SAS", type: "juridica" }];
const user = {
  trm: 4200, owners,
  inv: [
    { id: "cdt_p", n: "CDT mío", tp: "CDT", va: 1000e6, vc: 1000e6, tasa: 12, owner: "own_p" },
    { id: "cdt_s", n: "CDT de la SAS", tp: "CDT", va: 1000e6, vc: 1000e6, tasa: 12, owner: "own_sas" },
    { id: "casa", n: "casa donde vivo", tp: "Real Estate", va: 900e6, vc: 300e6, owner: "own_p" },
    { id: "lote", n: "lote de la SAS", tp: "Real Estate", va: 800e6, vc: 300e6, owner: "own_sas" },
  ],
  ingresos: [{ id: "s", nombre: "Sueldo", categoria: "Salario", mensual: 10e6 }],
  gas: { Hogar: [{ c: "Vida", m: 5e6, freq: "mes" }] }, deu: [],
};

describe("de quién es cada cosa", () => {
  it("sale del dueño del activo, y la ficha manda sobre eso", () => {
    expect(titularDe({ owner: "own_sas" }, owners)).toBe("sociedad");
    expect(titularDe({ owner: "own_p" }, owners)).toBe("persona");
    expect(titularDe({ owner: "own_sas" }, owners, { titular: "persona" })).toBe("persona");
    expect(titularDe({ owner: "nadie" }, owners)).toBe("persona"); // sin dueño conocido, tuyo
  });
  it("por defecto no se cobra nada: el 35% hay que encenderlo", () => {
    const b = baseDesdeUsuario(user, PERFIL_DEFAULT, {});
    expect(b.posiciones.find((x) => x.id === "cdt_s").impRendPct).toBe(0);
  });
  it("la posición lleva el impuesto que le toca y lo que costó", () => {
    const b = baseDesdeUsuario(user, CON_IMPUESTO, {});
    const p = Object.fromEntries(b.posiciones.map((x) => [x.id, x]));
    expect(p.cdt_s.impRendPct).toBe(35);
    expect(p.cdt_p.impRendPct).toBe(0);
    expect(p.lote.costoBase).toBe(300e6);
  });
  it("la casa donde vives no paga ganancia, aunque sea tuya o de la sociedad", () => {
    const b = baseDesdeUsuario(user, CON_IMPUESTO, {});
    expect(b.posiciones.find((x) => x.id === "casa").impGananciaPct).toBe(0);
  });
});

describe("el impuesto de la sociedad se cobra de verdad", () => {
  const b = baseDesdeUsuario(user, CON_IMPUESTO, {});
  const cfg = (ids) => ({ meses: 12, caja: 0, posiciones: b.posiciones.map((p) => ({ ...p })), flujos: [], deudas: [],
    movimientos: ids.map((id) => ({ mes: 0, tipo: "vender", posicionId: id })), reglas: {} });

  it("dos CDT iguales rinden distinto: el de la SAS paga 35% de lo que rinde", () => {
    const r = simularCamino({ ...cfg([]), meses: 1 });
    const m = r.meses[0];
    const dP = m.detalle.cdt_p.recibe, dS = m.detalle.cdt_s.recibe;
    expect(Math.round(dS / dP * 100) / 100).toBe(0.65);
  });

  it("al vender, el impuesto va sobre la ganancia, no sobre el precio", () => {
    const r = simularCamino(cfg(["lote"]));
    // lote: vale 800, costó 300 → ganancia 500 → 35% = 175 → entran 625
    expect(Math.round(r.meses[0].caja ?? 0)).toBeGreaterThan(0);
    expect(r.log.some((l) => /Se vende lote de la SAS/.test(l.texto) && /impuesto/.test(l.texto))).toBe(true);
  });

  it("y la casa donde vives se vende sin impuesto", () => {
    const r = simularCamino(cfg(["casa"]));
    const linea = r.log.find((l) => /Se vende casa donde vivo/.test(l.texto));
    expect(linea.texto).not.toMatch(/impuesto/);
  });
});

describe("un escenario con una sociedad adentro", () => {
  it("rinde menos que el mismo escenario sin ella", () => {
    const sinSas = { ...user, inv: user.inv.map((a) => ({ ...a, owner: "own_p" })) };
    const r = (u) => {
      const b = baseDesdeUsuario(u, CON_IMPUESTO, {});
      const c = configurarEscenario(b, escenarioVacio({ id: "e", nombre: "e" }), CON_IMPUESTO);
      return simularCamino(c.cfg).anual.slice(-1)[0].patrimonioFin;
    };
    expect(r(user)).toBeLessThan(r(sinSas));
  });
});
