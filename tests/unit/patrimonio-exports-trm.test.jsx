// 24-nov-2026 — patrimonio-exports-usd. La pantalla de Patrimonio y los
// exports usan la TRM de la pantalla de donde salen y lo dicen:
//  - Patrimonio, Deudas, Ingresos, Gastos (planeación) → TRM de hoy, «TRM de hoy: $X».
//  - Impuestos (borrador F-210 e informe del contador) → TRM del 31-dic del AG (Art. 269).
//  - Sin tasa real: «pendiente de tasa», los USD quedan por fuera del total en pesos. Nunca 4200.
// Datos de prueba inventados; ninguna cifra es de un usuario real.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

// ── xlsx: se usa la librería real pero se captura el libro en vez de escribirlo.
const libros = [];
vi.mock("xlsx", async () => {
  const real = await vi.importActual("xlsx");
  const mod = real.default || real;
  return { ...mod, default: { ...mod, writeFile: (wb, name) => libros.push({ wb, name }) }, writeFile: (wb, name) => libros.push({ wb, name }) };
});

// ── jsPDF falso: guarda los textos y las tablas que se dibujan.
const pdfs = [];
vi.mock("jspdf", () => {
  class FakePDF {
    constructor() { this.textos = []; this.tablas = []; this.paginas = 1; this.internal = { pageSize: { getWidth: () => 216, getHeight: () => 279 }, getNumberOfPages: () => this.paginas }; pdfs.push(this); }
    text(t) { this.textos.push(Array.isArray(t) ? t.join(" ") : String(t)); }
    splitTextToSize(t) { return [String(t)]; }
    addPage() { this.paginas++; }
    save() {}
    output() { return new Blob([]); }
  }
  for (const m of ["setFillColor", "rect", "setFont", "setFontSize", "setTextColor", "setDrawColor", "setLineWidth", "line", "setPage", "roundedRect"]) FakePDF.prototype[m] = function () {};
  return { default: FakePDF, jsPDF: FakePDF };
});
vi.mock("jspdf-autotable", () => ({
  default: (doc, opts) => { doc.tablas.push(opts); doc.lastAutoTable = { finalY: (opts.startY || 0) + 10 }; },
}));

import {
  montoCOP, resumenPatrimonioPantalla, etiquetaTrmHoy, selloTrmHoy, selloTrmCierre, selloTrmContador,
  LINEA_TRM_DECLARACION, lineaActivoUSD, hayUSDEn, LINEA_CONTADOR_USD, lineaGenerado,
} from "../../src/lib/patrimonioPantalla.js";
import { TRM_PROVISIONAL, TRM_CIERRE_ANO } from "../../src/lib/trm.js";
import { exportInversionesExcel, exportDeudasExcel, exportIngresosExcel, exportGastosExcel } from "../../src/lib/excelExport.js";
import { exportPatrimonioPDF, exportDeudasPDF, exportInformeContadorPDF } from "../../src/lib/pdfSectionExport.js";
import { datosParaContador } from "../../src/lib/datosParaContador.js";
import { deudasSinActivo } from "../../src/lib/patrimonioUI.js";
import { setRegion } from "../../src/lib/region.js";
import InversionesModule from "../../src/components/InversionesModule.jsx";

const casa = { id: "a1", n: "Apartamento", tp: "Real Estate", va: 500_000_000, vc: 400_000_000 };
const etf = { id: "a2", n: "Portafolio ETF", tp: "Acciones", moneda: "USD", va: 10_000, vc: 8_000 };
const credUSD = { id: "d1", n: "Tarjeta exterior", mt: 1_000, pg: 100, ts: 24, moneda: "USD" };
const credCOP = { id: "d2", n: "Libre inversión", mt: 5_000_000, pg: 500_000, ts: 20 };
const SIN_TASA = [0, null, undefined, TRM_PROVISIONAL];

const hoja = (wb, nombre) => wb.Sheets[nombre];
const filas = async (wb, nombre) => {
  const XLSX = await import("xlsx");
  return (XLSX.default || XLSX).utils.sheet_to_json(hoja(wb, nombre), { header: 1, defval: "" });
};
const ultimo = () => libros[libros.length - 1].wb;
const ultimoPDF = () => pdfs[pdfs.length - 1];

beforeEach(() => { libros.length = 0; pdfs.length = 0; vi.stubGlobal("alert", () => {}); });

describe("helpers de la pantalla de Patrimonio", () => {
  it("TRM de hoy: el activo en USD pasa a pesos y entra al total", () => {
    const r = resumenPatrimonioPantalla([casa, etf], 4000);
    expect(r.totalCOP).toBe(500_000_000 + 40_000_000);
    expect(r.hayUSD).toBe(true);
    expect(r.pendienteTasa).toBe(false);
    expect(etiquetaTrmHoy(4000)).toBe("TRM de hoy: $4.000,00");
    expect(lineaActivoUSD(etf, 4000)).toBe("US$10.000 ≈ $40.000.000");
  });
  for (const t of SIN_TASA) {
    it(`trm=${t}: pendiente de tasa, ni crudo ni 4200`, () => {
      const r = resumenPatrimonioPantalla([casa, etf], t);
      expect(r.totalCOP).toBe(500_000_000);
      expect(r.totalCOP).not.toBe(500_000_000 + 10_000 * 4200);
      expect(r.pendienteTasa).toBe(true);
      expect(r.usdPendiente).toBe(10_000);
      expect(montoCOP(10_000, etf, t)).toBeNull();
      expect(etiquetaTrmHoy(t)).toBe("TRM de hoy: pendiente de tasa");
      expect(lineaActivoUSD(etf, t)).toBe("US$10.000 · pendiente de tasa");
    });
  }
  it("apagados (sim:false) no cuentan", () => {
    expect(resumenPatrimonioPantalla([casa, { ...etf, sim: false }], 4000).hayUSD).toBe(false);
  });
  it("hayUSDEn mira listas y gastos por categoría", () => {
    expect(hayUSDEn([casa], { Vivienda: [{ m: 1 }] })).toBe(false);
    expect(hayUSDEn([casa], { Viajes: [{ m: 1, moneda: "USD" }] })).toBe(true);
  });
});

describe("sellos", () => {
  it("planeación: TRM de hoy + recordatorio del 31-dic", () => {
    expect(selloTrmHoy(4000, true)).toEqual([
      "Tasa del dólar: TRM de hoy: $4.000,00. Tus montos en dólares se pasaron a pesos con esta tasa.",
      LINEA_TRM_DECLARACION,
    ]);
    expect(selloTrmHoy(0, true)[0]).toContain("TRM de hoy: pendiente de tasa");
    expect(selloTrmHoy(4000, false)[0]).toContain("no se usó TRM");
  });
  it("borrador: TRM del 31-dic del año gravable (Art. 269), nunca la de hoy", () => {
    expect(selloTrmCierre({ trm: 4000 }, 2025, true)).toBe("Tasa del dólar: TRM del 31-dic-2025: $3.757,08 (Art. 269 ET).");
    expect(TRM_CIERRE_ANO[2025]).toBe(3757.08);
    // Un año que no ha cerrado: pendiente, aunque haya TRM de hoy guardada.
    expect(selloTrmCierre({ trm: 4000 }, 2026, true)).toBe("Tasa del dólar: TRM del 31-dic-2026: pendiente de tasa (Art. 269 ET). Se completa cuando se conozca la TRM vigente el 31-dic-2026.");
    // El año sale del mismo AG del sello, no fijo.
    expect(selloTrmCierre({}, 2031, true)).toContain("Se completa cuando se conozca la TRM vigente el 31-dic-2031.");
    expect(selloTrmCierre({}, 2025, true)).not.toContain("Se completa");
    expect(selloTrmCierre({ trm: 4000 }, 2026, true)).not.toContain("4.000");
  });
});

describe("Excel de Patrimonio (TRM de hoy)", () => {
  it("con TRM: el activo en USD en pesos y el sello en el aviso y bajo el TOTAL", async () => {
    await exportInversionesExcel([casa, etf], [], 4000);
    const wb = ultimo();
    const det = await filas(wb, "Activos");
    const fila = det.find((f) => f[0] === "Portafolio ETF");
    expect(fila[4]).toBe(32_000_000);
    expect(fila[5]).toBe(40_000_000);
    const total = det.find((f) => f[0] === "TOTAL");
    expect(total[5]).toBe(540_000_000);
    const textoDet = det.flat().join(" | ");
    expect(textoDet).toContain("TRM de hoy: $4.000,00");
    const aviso = (await filas(wb, "Aviso legal")).flat().join(" | ");
    expect(aviso).toContain("TRM de hoy: $4.000,00");
    expect(aviso).toContain(LINEA_TRM_DECLARACION);
    expect(aviso).toContain(lineaGenerado());
    expect(textoDet).toMatch(/Generado el \d{1,2} de [a-z]+ de 20\d\d/);
  });
  it("«Generado el» usa la fecha de Bogotá (03:00 UTC del 25-nov = 24-nov en Bogotá)", () => {
    expect(lineaGenerado(new Date("2026-11-25T03:00:00Z"))).toBe("Generado el 24 de noviembre de 2026");
  });
  for (const t of SIN_TASA) {
    it(`trm=${t}: celda «pendiente de tasa», el total solo en pesos, nunca 4200`, async () => {
      await exportInversionesExcel([casa, etf], [], t);
      const det = await filas(ultimo(), "Activos");
      const fila = det.find((f) => f[0] === "Portafolio ETF");
      expect(fila[5]).toBe("US$10.000 · pendiente de tasa");
      const total = det.find((f) => f[0] === "TOTAL");
      expect(total[5]).toBe(500_000_000);
      expect(det.flat()).not.toContain(42_000_000);
      expect(det.flat().join(" | ")).toContain("TRM de hoy: pendiente de tasa");
    });
  }
  it("en inglés (módulos US) no lleva sello", async () => {
    await exportInversionesExcel([{ ...casa, moneda: "USD" }], [], 1, true);
    const txt = (await filas(ultimo(), "Assets")).flat().join(" | ");
    expect(txt).not.toContain("TRM");
  });
});

describe("Excel de Deudas, Ingresos y Gastos (TRM de hoy)", () => {
  it("deudas: USD convertido con sello; sin tasa queda por fuera", async () => {
    await exportDeudasExcel([credCOP, credUSD], [], [], 4000);
    let det = await filas(ultimo(), "Deudas");
    expect(det.find((f) => f[0] === "TOTAL")[1]).toBe(9_000_000);
    expect(det.flat().join(" | ")).toContain("TRM de hoy: $4.000,00");
    await exportDeudasExcel([credCOP, credUSD], [], [], 0);
    det = await filas(ultimo(), "Deudas");
    expect(det.find((f) => f[0] === "TOTAL")[1]).toBe(5_000_000);
    expect(det.find((f) => f[0] === "Tarjeta exterior")[1]).toBe("US$1.000 · pendiente de tasa");
  });
  it("ingresos y gastos llevan sello aunque no haya USD", async () => {
    await exportIngresosExcel([{ nombre: "Salario", mensual: 1_000_000 }], [], 4000);
    expect((await filas(ultimo(), "Ingresos")).flat().join(" | ")).toContain("no se usó TRM");
    await exportGastosExcel({ Viajes: [{ c: "Hotel", m: 100, moneda: "USD" }] }, 0);
    const g = await filas(ultimo(), "Gastos");
    expect(g.find((f) => f[1] === "Hotel")[2]).toBe("US$100 · pendiente de tasa");
    expect(g.flat().join(" | ")).toContain("TRM de hoy: pendiente de tasa");
  });
});

describe("PDF de Patrimonio y Deudas (TRM de hoy)", () => {
  it("patrimonio: sello bajo el encabezado y fila en pesos", async () => {
    await exportPatrimonioPDF([casa, etf], [], 4000);
    const doc = ultimoPDF();
    expect(doc.textos.join(" | ")).toContain("TRM de hoy: $4.000,00");
    const body = doc.tablas[0].body;
    expect(body.find((r) => r[0] === "Portafolio ETF")[4]).toBe("$40.000.000");
    expect(doc.tablas[0].foot[0][4]).toBe("$540.000.000");
  });
  it("patrimonio sin tasa: «pendiente de tasa» y total solo en pesos", async () => {
    await exportPatrimonioPDF([casa, etf], [], TRM_PROVISIONAL);
    const doc = ultimoPDF();
    expect(doc.textos.join(" | ")).toContain("TRM de hoy: pendiente de tasa");
    expect(doc.tablas[0].body.find((r) => r[0] === "Portafolio ETF")[4]).toBe("US$10.000 · pendiente de tasa");
    expect(doc.tablas[0].foot[0][4]).toBe("$500.000.000");
  });
  it("deudas: el orden de pago no inventa intereses sin tasa", async () => {
    await exportDeudasPDF([credCOP, credUSD], [], [], 0);
    const orden = ultimoPDF().tablas[1].body.find((r) => r[0] === "Tarjeta exterior");
    expect(orden[3]).toBe("pendiente de tasa");
  });
});

describe("informe del contador (Impuestos → TRM del 31-dic del AG)", () => {
  const u = { trm: 4000, owners: [{ id: "o1", name: "Titular", type: "natural" }], inv: [casa, etf], deu: [credUSD], ingresos: [], gas: {} };
  it("AG 2025: los USD con la TRM del 31-dic-2025, no con la de hoy", () => {
    const d = datosParaContador(u, "o1", 2025);
    const b = d.bienes.find((x) => x.nombre === "Portafolio ETF");
    expect(b.valor).toBeCloseTo(10_000 * 3757.08, 2);
    expect(b.valor).not.toBe(40_000_000);
    expect(d.deudas[0].saldo).toBeCloseTo(1_000 * 3757.08, 2);
    expect(d.tasa).toBe(3757.08);
    expect(d.hayUSD).toBe(true);
  });
  it("AG sin TRM del 31-dic: pendiente de tasa, fuera del total", () => {
    const d = datosParaContador(u, "o1", 2026);
    const b = d.bienes.find((x) => x.nombre === "Portafolio ETF");
    expect(b).toMatchObject({ valor: 0, usd: 10_000, pendienteTasa: true });
    expect(d.deudas[0]).toMatchObject({ saldo: 0, usd: 1_000, pendienteTasa: true });
  });
  it("el PDF lleva el sello del 31-dic y la celda pendiente", async () => {
    const d = datosParaContador(u, "o1", 2026);
    await exportInformeContadorPDF({ titulares: [{ nombre: "Titular", tipo: "natural", declaraciones: [], e: null, datos: d }] });
    const doc = ultimoPDF();
    const txt = doc.textos.join(" | ");
    expect(txt).toContain("TRM del 31-dic-2026: pendiente de tasa");
    expect(txt).toContain("Se completa cuando se conozca la TRM vigente el 31-dic-2026.");
    expect(txt).not.toContain("Se completa sola");
    expect(txt).not.toContain("TRM de hoy");
    const celdas = doc.tablas.flatMap((t) => t.body || []).flat();
    expect(celdas).toContain("US$10.000 · pendiente de tasa");
    expect(selloTrmContador(datosParaContador(u, "o1", 2025))[0]).toBe("Tasa del dólar: TRM del 31-dic-2025: $3.757,08 (Art. 269 ET).");
    expect(selloTrmContador(datosParaContador(u, "o1", 2025))[1]).toBe("Ingresos en dólares: van con la TRM del día de cada pago. Patrimonio y deudas en dólares: con la TRM del 31-dic.");
    expect(txt).toContain(LINEA_CONTADOR_USD);
  });
});

describe("deudas sin activo (aviso de Patrimonio)", () => {
  it("la deuda en USD se suma en pesos con la TRM de hoy", () => {
    expect(deudasSinActivo([credCOP, credUSD], [], 4000)).toEqual({ n: 2, total: 9_000_000 });
  });
  it("sin tasa: fuera del total y contada como pendiente", () => {
    expect(deudasSinActivo([credCOP, credUSD], [], 0)).toEqual({ n: 2, total: 5_000_000, pendientes: 1 });
  });
});

describe("pantalla de Patrimonio (render)", () => {
  beforeEach(() => setRegion({ idioma: "es", pais: "CO" }));
  const render = (trm) => renderToStaticMarkup(createElement(InversionesModule, {
    inversiones: [casa, etf], owners: [], deudas: [], onUpdate: () => {}, user: { inv: [casa, etf], ingresos: [], gas: {} }, plan: "pro", trm,
  }));
  it("con TRM: «TRM de hoy», total convertido y US$ bajo el valor", () => {
    const html = render(4000);
    expect(html).toContain("TRM de hoy: $4.000,00");
    expect(html).toContain(LINEA_TRM_DECLARACION);
    expect(html).toContain("$540.000.000");
    expect(html).toContain("US$10.000");
    expect(html).toContain("$40.000.000");
  });
  it("sin TRM: pendiente de tasa y el total es solo pesos (nunca 4200)", () => {
    const html = render(0);
    expect(html).toContain("TRM de hoy: pendiente de tasa");
    expect(html).toContain("pendiente de tasa");
    expect(html).toContain("$500.000.000");
    expect(html).not.toContain("$542.000.000");
    expect(html).not.toContain("$42.000.000");
  });
  it("sin USD no muestra la línea de TRM", () => {
    const html = renderToStaticMarkup(createElement(InversionesModule, { inversiones: [casa], owners: [], deudas: [], onUpdate: () => {}, user: { inv: [casa] }, plan: "pro", trm: 4000 }));
    expect(html).not.toContain("TRM de hoy");
  });
});
