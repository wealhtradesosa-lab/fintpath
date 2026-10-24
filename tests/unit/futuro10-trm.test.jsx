// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import MiFuturo10, { AUTOSAVE_MS, MSG_CARGANDO_TRM, usaDolar, textoTasaUsada } from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { resolverTasa, esTasaReal } from "../../src/lib/tasaDolar.js";
afterEach(() => { cleanup(); vi.useRealTimers(); });

// Finanzas/Soporte PR #56: ninguna cifra en dólares con la TRM provisional (4.200).
const conUSD = (trm) => ({ trm, inv: [{ id: "u", n: "ETF", tp: "Acciones", moneda: "USD", va: 50000 }, { id: "c", n: "CDT", tp: "CDT", va: 100e6 }], ingresos: [{ id: "s", nombre: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "x", m: 4e6 }] }, deu: [] });
const sinUSD = (trm) => ({ ...conUSD(trm), inv: [{ id: "c", n: "CDT", tp: "CDT", va: 100e6 }] });
const g = { borrador: { paso: 2, cfg: { nuevas: [{ preset: "rfCorto", monto: 1e6 }] } } };

describe("TRM provisional en Mi futuro", () => {
  it("resolverTasa: el 4.200 por defecto nunca es tasa válida; si falla, última guardada con fecha", () => {
    expect(esTasaReal({ trm: 4200, source: "default" })).toBe(false);
    expect(esTasaReal({ trm: 3900, source: "Banco de la República" })).toBe(true);
    expect(resolverTasa("cargando", { trm: 3900, trmSrc: "Banco de la República" }).estado).toBe("cargando");
    expect(resolverTasa("fallo", { trm: 3900, trmSrc: "Banco de la República", trmFecha: "2026-10-23T00:00:00.000" })).toEqual({ estado: "respaldo", trm: 3900, fecha: "2026-10-23T00:00:00.000" });
    // sin tasa guardada real: respaldo SIN número (nunca 4.200)
    expect(resolverTasa("fallo", { trm: 4200 })).toEqual({ estado: "respaldo", trm: null, fecha: null });
    expect(resolverTasa("fallo", { trm: 4200, trmSrc: "default" })).toEqual({ estado: "respaldo", trm: null, fecha: null });
  });
  it("tasa provisional + datos en dólares → «Cargando tasa del dólar…», ninguna cifra y nada se guarda", () => {
    vi.useFakeTimers();
    const on = vi.fn();
    const { container, unmount } = render(<MiFuturo10 user={conUSD(4200)} tasa={{ estado: "cargando" }} guardado={g} onGuardar={on} />);
    expect(container.textContent).toContain(MSG_CARGANDO_TRM);
    expect(container.textContent).not.toMatch(/\$\s?\d/);
    act(() => { vi.advanceTimersByTime(AUTOSAVE_MS * 3); });
    unmount();
    expect(on).not.toHaveBeenCalled();
  });
  it("sin dólares se ve todo, pero el borrador no se guarda hasta que llega la tasa", () => {
    vi.useFakeTimers();
    const on = vi.fn();
    const { getAllByText, rerender } = render(<MiFuturo10 user={sinUSD(4200)} tasa={{ estado: "cargando" }} guardado={g} onGuardar={on} />);
    act(() => { fireEvent.click(getAllByText("+ Crear inversión")[0]); });
    act(() => { vi.advanceTimersByTime(AUTOSAVE_MS * 3); });
    expect(on).not.toHaveBeenCalled();
    rerender(<MiFuturo10 user={sinUSD(3900)} tasa={{ estado: "ok", trm: 3900 }} guardado={g} onGuardar={on} />);
    act(() => { vi.advanceTimersByTime(AUTOSAVE_MS * 3); });
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0].borrador.cfg.nuevas).toHaveLength(2);
  });
  it("si la fuente falla: «Tasa usada: $X (fecha)» y cifras con esa tasa", () => {
    const tasa = resolverTasa("fallo", { trm: 3900, trmSrc: "Banco de la República", trmFecha: "2026-10-23T00:00:00.000" });
    const { container } = render(<MiFuturo10 user={conUSD(3900)} tasa={tasa} guardado={g} onGuardar={() => {}} />);
    expect(container.textContent).toContain("Tasa usada: $3.900 (2026-10-23)");
    expect(container.textContent).not.toContain(MSG_CARGANDO_TRM);
    expect(textoTasaUsada(tasa)).toBe("Tasa usada: $3.900 (2026-10-23)");
  });
  it("mismo resultado antes y después de cargar: lo que se muestra al llegar la tasa = cálculo directo con la tasa final", () => {
    const cfg = g.borrador.cfg;
    const html = (u, tasa) => render(<MiFuturo10 user={u} tasa={tasa} guardado={g} onGuardar={() => {}} />).container.textContent;
    const a = html(conUSD(3900), { estado: "ok", trm: 3900 }); cleanup();
    const { rerender, container } = render(<MiFuturo10 user={conUSD(4200)} tasa={{ estado: "cargando" }} guardado={g} onGuardar={() => {}} />);
    rerender(<MiFuturo10 user={conUSD(3900)} tasa={{ estado: "ok", trm: 3900 }} guardado={g} onGuardar={() => {}} />);
    const b = container.textContent;
    expect(b).toBe(a);
    expect(JSON.stringify(proyectarFuturo10(conUSD(3900), cfg).filas)).toBe(JSON.stringify(proyectarFuturo10(conUSD(3900), cfg).filas));
    // sin dólares la tasa no mueve nada
    expect(JSON.stringify(proyectarFuturo10(sinUSD(4200), cfg).filas)).toBe(JSON.stringify(proyectarFuturo10(sinUSD(3900), cfg).filas));
    expect(usaDolar(conUSD(1))).toBe(true); expect(usaDolar(sinUSD(1))).toBe(false);
  });
});
