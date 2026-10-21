// 21-oct-2026 — Red para tres defectos que la suite dejó pasar enteros.
//
// Los tres salieron de la cuenta real de Santiago y ninguno rompía un test:
//   1. El flujo negativo tiraba el nivel a 1/5 pisando lo que los activos ya
//      habían ganado. La tarjeta se contradecía sola: barra dibujada en 83%
//      con el badge en "⚠️ Déficit 1/5".
//   2. El PDF del Dashboard leía `sig.min`, campo que la escala nueva ya no
//      tiene: NaN → se imprimía "necesitas $0/mes de ingreso pasivo".
//   3. Los formateadores de plata ponían el signo DENTRO: "$-35.114.710".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { nivelLibertad, umbralNivel, NIVELES } from "../../src/lib/metrics.js";
import { bloqueNivelLibertad } from "../../src/lib/asesorNivel.js";

// ip ≥ lo esencial (80) pero los gastos totales (120) dejan el mes en rojo.
const CON_DEFICIT = { ip: 100, ob: 120, obEsencial: 80, fl: -20, patrimonioNeto: 1000 };

describe("el flujo negativo no borra el escalón que ganaron los activos", () => {
  it("activos que pagan lo esencial quedan en Seguridad, no en Déficit", () => {
    const n = nivelLibertad(CON_DEFICIT);
    expect(n.nivel).toBe(3);
    expect(n.nombre).toBe("Seguridad");
    expect(n.candado).toBeNull();
  });

  it("pero el déficit se reporta aparte, para que la UI lo diga encima", () => {
    expect(nivelLibertad(CON_DEFICIT).deficitFlujo).toBe(true);
  });

  it("sin déficit no se levanta la bandera", () => {
    expect(nivelLibertad({ ...CON_DEFICIT, fl: 10 }).deficitFlujo).toBe(false);
  });

  it("Déficit 1/5 sigue existiendo: flujo en rojo Y activos que no pagan ni lo esencial", () => {
    const n = nivelLibertad({ ...CON_DEFICIT, ip: 40 });
    expect(n.nivel).toBe(1);
    expect(n.nombre).toBe("Déficit");
    expect(n.candado).toBe("deficit");
  });

  it("flujo en rojo sin cubrir lo esencial no es Estabilidad: Estabilidad implica que te alcanza", () => {
    expect(nivelLibertad({ ...CON_DEFICIT, ip: 40 }).nivel).not.toBe(2);
    expect(nivelLibertad({ ...CON_DEFICIT, ip: 40, fl: 5 }).nivel).toBe(2);
  });

  it("el candado de patrimonio negativo sigue mandando", () => {
    const n = nivelLibertad({ ...CON_DEFICIT, patrimonioNeto: -1 });
    expect(n.nivel).toBe(2);
    expect(n.candado).toBe("patrimonio_negativo");
  });
});

describe("el umbral del siguiente escalón nunca es NaN", () => {
  const ctx = { ob: 118375073, obEsencial: 105125073 };

  it("ningún nivel devuelve NaN (el bug del «necesitas $0/mes»)", () => {
    for (const n of NIVELES) {
      const u = umbralNivel(n, ctx);
      expect(u === null || Number.isFinite(u), `N${n.id} ${n.nombre} → ${u}`).toBe(true);
    }
  });

  it("los que se ganan con ingreso pasivo traen su monto, en orden", () => {
    const porPasivo = NIVELES.filter((n) => umbralNivel(n, ctx) != null);
    expect(porPasivo.map((n) => n.nombre)).toEqual(["Seguridad", "Independencia", "Abundancia"]);
    const montos = porPasivo.map((n) => umbralNivel(n, ctx));
    expect(montos).toEqual([...montos].sort((a, b) => a - b));
    expect(montos[0]).toBe(ctx.obEsencial);
    expect(montos[1]).toBe(ctx.ob);
  });

  it("Déficit y Estabilidad no tienen umbral de ingreso pasivo: se ganan con el flujo", () => {
    expect(umbralNivel(NIVELES[0], ctx)).toBeNull();
    expect(umbralNivel(NIVELES[1], ctx)).toBeNull();
  });
});

describe("nadie vuelve a leer el campo que la escala renombró", () => {
  // El "$0" no vivía en el motor sino en quien lo consumía: App.jsx hacía
  // `(sig.min/100)*t.ob`. `min` desapareció de NIVELES el 21-oct y nada avisó,
  // porque `undefined/100*x` es NaN y `fm(NaN)` imprime "$0". Barrido de texto:
  // la única forma de que esto no vuelva en silencio.
  const FUENTES = ["src/App.jsx", "src/components/SimuladorAvanzado.jsx", "src/lib/asesorNivel.js", "src/components/LandingLibertad.jsx"];

  it("los niveles ya no exponen `min`: el umbral sale de umbralNivel()", () => {
    for (const n of NIVELES) expect(n.min, `N${n.id} ${n.nombre}`).toBeUndefined();
  });

  it("ningún consumidor lee `.min` de un nivel", () => {
    const sospechoso = /\b(sig|nv|nivel|n|l|lvl|x)\.min\b|\.def\.min\b/;
    for (const f of FUENTES) {
      const src = readFileSync(new URL("../../" + f, import.meta.url), "utf8");
      const culpables = src.split("\n")
        .map((linea, i) => ({ linea: linea.trim(), n: i + 1 }))
        .filter(({ linea }) => sospechoso.test(linea) && !linea.startsWith("//"));
      expect(culpables, `${f} → ${JSON.stringify(culpables)}`).toEqual([]);
    }
  });
});

describe("la plata negativa lleva el signo antes del peso", () => {
  const bloque = (fl) => bloqueNivelLibertad({
    metMes: {
      ip: 100, ob: 120, fl, ahorroPct: -5, cargaDeudaPct: 10, ingresoNeto: 90,
      coberturaPasiva: 83.3, nivel: nivelLibertad({ ip: 100, ob: 120, obEsencial: 80, fl, patrimonioNeto: 1000 }),
    },
  });

  it("nunca imprime «$-»", () => {
    expect(bloque(-35114710)).not.toContain("$-");
  });

  it("el bloque del asesor avisa del déficit que no bajó el escalón", () => {
    expect(bloque(-20)).toContain("OJO");
    expect(bloque(10)).not.toContain("OJO");
  });
});

describe("la cuenta real que destapó todo esto", () => {
  // Santiago, octubre 2026: el nivel salía de un promedio de 12 meses que le
  // acreditaba renta ya extinta. Medido contra el mes, la cuenta cierra.
  const santi = { ip: 137479592, ob: 118375073, obEsencial: 105125073, fl: 26939034, patrimonioNeto: 17043257757 };

  it("sus activos pagan todo: Independencia, y el siguiente escalón tiene cifra", () => {
    const n = nivelLibertad(santi);
    expect(n.nivel).toBe(4);
    expect(n.nombre).toBe("Independencia");
    expect(n.siguiente.nombre).toBe("Abundancia");
    expect(umbralNivel(n.siguiente, { ob: santi.ob, obEsencial: n.obEsencial })).toBeCloseTo(santi.ob * 1.3, 0);
    expect(n.faltaIPSiguiente).toBeGreaterThan(0);
  });

  it("sin el renglón mal cargado de $20,25M queda debajo del 100%", () => {
    const n = nivelLibertad({ ...santi, ip: santi.ip - 20250000 });
    expect(n.nivel).toBeLessThan(4);
  });
});
