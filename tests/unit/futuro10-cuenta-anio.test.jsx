import { describe, it, expect } from "vitest";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { cuentaPorAnio } from "../../src/components/MiFuturo10.jsx";

// 23-nov-2026 — La cuenta de cada año: viene de antes + flujo libre del año anterior + lo que llega − lo que se usa.
const Y = new Date().getFullYear();
const user = { inflacionPct: 4, inv: [{ id: "c", n: "Cuenta", tp: "Cash", va: 500e6 }, { id: "l", n: "Lote", tp: "Lote", va: 1000e6 }], ingresos: [{ nombre: "Salario", categoria: "Salario", mensual: 50e6 }], gas: { Vida: [{ n: "Mercado", m: 20e6 }] }, deu: [{ id: "d", n: "Saldo local", mt: 300e6, pg: 0, tipoInteres: "sin_interes" }] };

describe("cuenta año por año", () => {
  it("suma el flujo libre del año anterior, lo que llega y resta inversiones y deudas de ese año", () => {
    const cfg = { decisiones: { l: { accion: "vende" } }, terminan: {}, nuevas: [{ preset: "rfCorto", monto: 200e6, fuente: "liquidez", anio: 2 }], pagarDeudas: { d: Y + 1 } };
    const r = proyectarFuturo10(user, cfg);
    const c = cuentaPorAnio(r, cfg);
    const g2 = c.find((g) => g.anio === 2);
    expect(g2.antes).toBeCloseTo(Math.max(0, r.bolsaDetalle.restante), 0);
    expect(g2.flujo).toBeCloseTo(r.filas[1].cf, 0);
    expect(g2.salen.some((u) => u.tipo === "A" && Math.round(u.monto) === 300e6)).toBe(true);
    expect(g2.salen.some((u) => u.tipo === "C" && Math.round(u.monto) === 200e6)).toBe(true);
    expect(g2.saldo).toBeCloseTo(g2.antes + g2.flujo + g2.llega - g2.sale, 0);
    const g3 = c.find((g) => g.anio === 3);
    expect(g3.antes).toBeCloseTo(Math.max(0, g2.saldo), 0);
  });
  it("lo que sobra cada mes con destino fijo en D no se suma al año siguiente", () => {
    const cfg = { sobraDestinos: [{ id: "c", pct: 100 }] };
    const r = proyectarFuturo10(user, cfg);
    expect(cuentaPorAnio(r, cfg).find((g) => g.anio === 2).flujo).toBeCloseTo(0, 0);
  });
});
