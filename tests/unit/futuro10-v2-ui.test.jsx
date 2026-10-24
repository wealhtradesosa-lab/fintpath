import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import MiFuturo10, { LoQueViene, Obra, agruparAlertas, ESTADO_GUARDADO, TablaSupuestos } from "../../src/components/MiFuturo10.jsx";
import { resolverEscenario } from "../../src/lib/futuro10.js";

const txt = (h) => h.replace(/<!-- -->/g, "");
const esc = resolverEscenario("base", { inflacionPct: 5 });
const user = { inflacionPct: 5, inv: [{ id: "l", n: "Lote", tp: "Real Estate", va: 300e6 }], ingresos: [], gas: {}, deu: [] };

describe("Mi futuro a 10 v2 · pantalla", () => {
  it("«Lo que viene»: ingresos primero, tipos nuevos y aviso de pensión con «Mover a Ingresos futuros»", () => {
    const cfg = { futuros: { ingresos: [], activos: [{ nombre: "Pensión Colpensiones", clase: "otro", valor: 1e8, entrega: 3 }] } };
    const h = txt(renderToString(<LoQueViene cfg={cfg} set={() => {}} esc={esc} owners={[]} />));
    expect(h.indexOf("Ingresos futuros")).toBeLessThan(h.indexOf("Activos futuros"));
    expect(h).toContain("arriendo con contrato");
    ["Finca raíz", "Local / comercial", "Lote", "Negocio", "Inversión financiera", "Vehículo", "Otro"].forEach((t) => expect(h).toContain(t));
    expect(h).toContain("Mover a Ingresos futuros");
    const sin = txt(renderToString(<LoQueViene cfg={{ futuros: { activos: [{ nombre: "Apto", clase: "inmueble", valor: 1e8 }] } }} set={() => {}} esc={esc} owners={[]} />));
    expect(sin).not.toContain("Mover a Ingresos futuros");
  });

  it("«Construir o mejorar» muestra inversión por año, año lista, renta, valor estimado y tipo", () => {
    const h = txt(renderToString(<Obra a={user.inv[0]} d={{ accion: "construye", obra: { inversiones: [{ monto: 100e6, anio: 2 }] } }} setD={() => {}} />));
    ["¿En qué año queda lista?", "Renta neta al mes desde ese año", "Valor estimado cuando quede lista", "¿Cambia el tipo de activo?", "$400.000.000"].forEach((t) => expect(h).toContain(t));
    const dec = txt(renderToString(<MiFuturo10 user={user} pasoInicial={1} />));
    expect(dec).toContain("Construir o mejorar");
    expect(dec).not.toContain("Se modifica");
  });

  it("Resultado: columna Renta pasiva/mes, nota del Simulador y sin «Reinvertir en lo que ya tienes»", () => {
    const h = txt(renderToString(<MiFuturo10 user={user} pasoInicial={3} />));
    expect(h).toContain("Renta pasiva/mes*");
    expect(h).toContain("Patrimonio (hoy)*");
    expect(h).toContain("no coincide con el Simulador");
    expect(txt(renderToString(<MiFuturo10 user={user} pasoInicial={2} />))).not.toContain("Reinvertir en lo que ya tienes");
  });

  it("borrador: retoma el mismo paso con los mismos datos; en demo no", () => {
    const guardado = { borrador: { paso: 3, cfg: { escenario: "pesimista", decisiones: { l: { accion: "vende", anioVenta: 2 } } } } };
    const h = txt(renderToString(<MiFuturo10 user={user} guardado={guardado} />));
    expect(h).toContain("Resultado a 10 años");
    expect(h).toMatch(/inflación 7(,0)?%/);
    const d = txt(renderToString(<MiFuturo10 user={user} guardado={guardado} demo />));
    expect(d).not.toContain("Resultado a 10 años");
    expect(Object.values(ESTADO_GUARDADO)).toEqual(["Guardando…", "Guardado hace un momento", "Sin conexión, se guarda al volver"]);
  });

  it("alertas agrupadas y supuestos con fuente y fecha, sin «validados por Finanzas»", () => {
    const g = agruparAlertas([{ tipo: "faltante", texto: "a" }, { tipo: "tasa_estimada", texto: "b" }, { tipo: "faltante", texto: "c" }]);
    expect(g.map((x) => x[0])).toEqual(["Plata que falta", "Revisa tus datos"]);
    const h = txt(renderToString(<TablaSupuestos esc={esc} />));
    expect(h).toContain("Fuente:");
    expect(h).toContain("valor manual");
    expect(h).toContain("ajustado a valuaciones actuales");
    expect(h.toLowerCase()).not.toContain("validado");
    expect(txt(renderToString(<TablaSupuestos esc={esc} mercado={{ ipc: { pct: 5.1, fuente: "BanRep", fecha: "sep-2026" } }} />))).toContain("BanRep, sep-2026");
  });
});
