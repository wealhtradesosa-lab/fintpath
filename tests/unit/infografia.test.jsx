// Infografías del Dashboard (1-nov-2026): las bandas cuadran con el motor y
// los componentes renderizan en los dos signos del flujo. Datos sintéticos.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calcularMetricas } from "../../src/lib/metrics.js";
import { flujoDinero, geometriaSankey, mapaPatrimonio, squarify, rentasPorMes, escalaMedidor } from "../../src/lib/infografia.js";
import MedidorLibertad from "../../src/components/infografia/MedidorLibertad.jsx";
import FlujoDinero from "../../src/components/infografia/FlujoDinero.jsx";
import MapaPatrimonio from "../../src/components/infografia/MapaPatrimonio.jsx";
import RentasMesAMes from "../../src/components/infografia/RentasMesAMes.jsx";

const fm = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");
const args = (extraGasto = 0) => ({
  trm: 4000,
  ingresos: [
    { nombre: "Arriendo apto", categoria: "Arriendo", mensual: 8_000_000, fuente: "Apto centro" },
    { nombre: "Intereses fondo", categoria: "Intereses bancarios", mensual: 3_000_000 },
    { nombre: "Salario", categoria: "Salario", mensual: 12_000_000 },
    { nombre: "Renta USD", categoria: "Arriendo", mensual: 1_000, moneda: "USD", fuente: "Apto Miami" },
  ],
  gastos: {
    Vivienda: [{ c: "Administración", m: 1_500_000 }, { c: "Servicios", m: 800_000 }],
    Familia: [{ c: "Colegio", m: 4_000_000 + extraGasto }],
    Impuestos: [{ c: "Predial", m: 6_000_000, frecuencia: "anual", mesPago: 3 }],
  },
  deudas: [{ n: "Hipoteca", mt: 200_000_000, pg: 3_000_000 }],
  inv: [
    { id: "a1", n: "Apto centro", tp: "Real Estate", va: 900_000_000, vc: 600_000_000 },
    { id: "a2", n: "Apto Miami", tp: "Real Estate", va: 300_000, moneda: "USD" },
    { id: "a3", n: "Fondo", tp: "Fondo de Inversión", va: 300_000_000, tasa: "12" },
    { id: "a4", n: "Carro", tp: "Vehículo", va: 80_000_000, vc: 120_000_000 },
  ],
  retencionMensual: 400_000,
  impuestoNeto: 250_000,
});

describe("infografías", () => {
  it("el flujo cuadra: Σ entradas − Σ salidas = fl del motor (meses y signos)", () => {
    for (const extra of [0, 40_000_000]) {
      for (let mes = 1; mes <= 12; mes++) {
        const m = calcularMetricas(args(extra), { base: "mes", anio: 2026, mes });
        const f = flujoDinero(m);
        const e = f.entradas.reduce((s, x) => s + x.valor, 0);
        const sa = f.salidas.reduce((s, x) => s + x.valor, 0);
        expect(Math.abs(e - sa)).toBeLessThan(1); // con «Te sobra» o «Te falta» ambos lados igualan
        expect(Math.abs(f.saldo - m.fl)).toBeLessThan(1);
        expect(geometriaSankey(f).salidas.length).toBe(f.salidas.length);
      }
    }
  });

  it("el mapa reconoce la renta por el nombre del activo y squarify conserva el área", () => {
    const m = calcularMetricas(args(), { base: "mes", anio: 2026, mes: 11 });
    const mp = mapaPatrimonio(m);
    const inm = mp.clases.find((c) => c.key === "inmuebles");
    expect(inm.estado).toBe("renta");
    expect(inm.rentaAnual).toBeCloseTo((8_000_000 + 4_000_000) * 12, -3);
    expect(mp.clases.find((c) => c.key === "vehiculos").estado).toBe("pierde");
    const b = squarify(mp.clases, { w: 760, h: 300, gap: 0 });
    expect(b.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(760 * 300, 0);
  });

  it("la escala del medidor llega al menos a Abundancia (200 %)", () => {
    expect(escalaMedidor(50)).toBe(200);
    expect(escalaMedidor(260)).toBe(300);
  });

  it("los cuatro componentes renderizan (con sobra y con falta)", () => {
    for (const extra of [0, 40_000_000]) {
      const m = calcularMetricas(args(extra), { base: "mes", anio: 2026, mes: 11 });
      const html = [
        renderToStaticMarkup(<MedidorLibertad cobertura={m.coberturaPasiva} ip={m.ip} ob={m.ob} nivel={m.nivel} fm={fm} />),
        renderToStaticMarkup(<FlujoDinero met={m} fm={fm} />),
        renderToStaticMarkup(<MapaPatrimonio met={m} fm={fm} />),
        renderToStaticMarkup(<RentasMesAMes meses={rentasPorMes(args(extra), 2026)} mesActual={11} />),
      ].join("");
      expect(html).toContain("¿De dónde viene y a dónde va tu plata?");
      expect(html).toContain(extra ? "Te falta" : "Te sobra");
      expect(html).not.toContain("NaN");
    }
  });
});
