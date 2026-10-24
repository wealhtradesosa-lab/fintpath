// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
import { render, fireEvent, act } from "@testing-library/react";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import MiFuturo10, { CampoRendimiento, AUTOSAVE_MS } from "../../src/components/MiFuturo10.jsx";
import { useState } from "react";

describe("QA v3 Mi futuro", () => {
  it("la renta de una inversión sin plata no entra al flujo; la parte fondeada sí", () => {
    const user = { inv: [{ id: "c", n: "Caja", t: "efectivo", va: 1e9 }], ingresos: [], gas: {}, deu: [] };
    const nueva = (monto) => ({ preset: "custom", nombre: "BTG", monto, anio: 1, tipo: "renta", rendimientoNomPct: 14 });
    const sin = proyectarFuturo10(user, { nuevas: [] });
    const total = proyectarFuturo10(user, { nuevas: [nueva(6.5e9)] });
    const d = total.nuevasDetalle[0];
    expect(d.rentaMensual).toBeCloseTo(6.5e9 * 0.14 / 12, 0);
    expect(d.rentaMensualFondeada).toBeLessThan(d.rentaMensual * 0.5);
    expect(total.filas[1].rentaNueva).toBeCloseTo(d.rentaMensualFondeada * 12, -2);
    expect(sin.filas[1].rentaNueva).toBe(0);
  });
  it("la leyenda sigue la tasa tecleada (14)", () => {
    function W() { const [v, setV] = useState(""); return <CampoRendimiento estimado={7.5} value={v} onChange={setV} />; }
    const { container } = render(<W />);
    const el = container.querySelector("input");
    fireEvent.change(el, { target: { value: "14" } });
    expect(container.textContent).toContain("14,0% anual");
  });
  it("la personalizada no muestra «Fuente: DTF»", () => {
    const user = { inv: [], ingresos: [], gas: {}, deu: [] };
    const g = { borrador: { paso: 2, cfg: { nuevas: [{ preset: "custom", monto: 1e6, anio: 1 }] } } };
    const { container } = render(<MiFuturo10 user={user} guardado={g} onGuardar={() => {}} />);
    expect(container.textContent).not.toMatch(/Fuente: DTF/);
  });
  it("«Quitar» guarda de inmediato (sin esperar el autosave)", () => {
    vi.useFakeTimers();
    const on = vi.fn();
    const user = { inv: [], ingresos: [], gas: {}, deu: [] };
    const g = { borrador: { paso: 2, cfg: { nuevas: [{ preset: "rfCorto", monto: 1e6 }] } } };
    const { getAllByRole } = render(<MiFuturo10 user={user} guardado={g} onGuardar={on} />);
    const q = getAllByRole("button", { name: "Quitar" });
    act(() => { fireEvent.click(q[q.length - 1]); });
    expect(on).toHaveBeenCalled();
    expect(on.mock.calls.at(-1)[0].borrador.cfg.nuevas).toHaveLength(0);
    vi.useRealTimers();
  });
  it("cerrar con guardado pendiente lo escribe al desmontar", () => {
    vi.useFakeTimers();
    const on = vi.fn();
    const user = { inv: [], ingresos: [], gas: {}, deu: [] };
    const g = { borrador: { paso: 2, cfg: { nuevas: [{ preset: "rfCorto", monto: 1e6 }] } } };
    const { getAllByText, unmount } = render(<MiFuturo10 user={user} guardado={g} onGuardar={on} />);
    act(() => { fireEvent.click(getAllByText("+ Crear inversión")[0]); });
    expect(on).not.toHaveBeenCalled();
    unmount();
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0].borrador.cfg.nuevas).toHaveLength(2);
    act(() => { vi.advanceTimersByTime(AUTOSAVE_MS * 2); });
    vi.useRealTimers();
  });
});
