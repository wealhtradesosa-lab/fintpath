// @vitest-environment jsdom
// QA PR #56 v7: monto confirmado al salir del campo (faltante determinista), TRM con
// timeout → respaldo (nunca 4.200), sin guardado mientras la tasa carga, sS sin window.
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import MiFuturo10, { AUTOSAVE_MS, MSG_SIN_TASA, MSG_CARGANDO_TRM } from "../../src/components/MiFuturo10.jsx";
import { proyectarFuturo10 } from "../../src/lib/futuro10.js";
import { resolverTasa, traerTrm } from "../../src/lib/tasaDolar.js";
afterEach(() => { cleanup(); vi.useRealTimers(); });

const user = { trm: 3900, inv: [{ id: "c", n: "CDT", tp: "CDT", va: 100e6 }], ingresos: [{ id: "s", nombre: "Salario", mensual: 10e6 }], gas: { Vida: [{ n: "x", m: 4e6 }] }, deu: [] };
const g = { borrador: { paso: 2, cfg: { nuevas: [{ preset: "custom", nombre: "BTG", tipo: "renta", rendimientoNomPct: "14", anio: 1, monto: "" }] } } };
const MONTO = 6500000000;
const esperado = () => proyectarFuturo10(user, { nuevas: [{ preset: "custom", nombre: "BTG", tipo: "renta", rendimientoNomPct: "14", anio: 1, monto: MONTO }] }).nuevasDetalle[0].faltante;
const campoMonto = (c) => c.container.querySelector('input[placeholder="Monto"]');
const alertas = (c) => c.container.querySelectorAll('[role="alert"]').length;
const verResultado = (c) => fireEvent.click([...c.container.querySelectorAll("button")].find((b) => /^4\. Resultado/.test(b.textContent)));
const textoFalta = (c) => [...c.container.querySelectorAll('[role="alert"]')].map((n) => n.textContent).find((t) => /Quedaron invertidos/.test(t)) || null;

describe("Mi futuro: el monto se confirma al salir del campo", () => {
  it("5 corridas tecleando dígito a dígito → mismo faltante, sin alerta a mitad de tecleo y un solo guardado con el monto final", () => {
    vi.useFakeTimers();
    const resultados = [];
    for (let k = 0; k < 5; k++) {
      const onGuardar = vi.fn();
      const c = render(<MiFuturo10 user={user} guardado={g} pasoInicial={2} onGuardar={onGuardar} />);
      const el = campoMonto(c);
      const base = alertas(c);
      fireEvent.focus(el);
      let txt = "";
      for (const ch of String(MONTO)) {
        txt += ch; fireEvent.change(el, { target: { value: txt } });
        act(() => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
        expect(alertas(c)).toBe(base); // ninguna alerta de faltante/exceso a mitad de tecleo
      }
      expect(onGuardar).not.toHaveBeenCalled(); // nada intermedio se persiste
      fireEvent.blur(el);
      act(() => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
      expect(onGuardar).toHaveBeenCalledTimes(1);
      expect(onGuardar.mock.calls[0][0].borrador.cfg.nuevas[0].monto).toBe(MONTO);
      verResultado(c);
      resultados.push(textoFalta(c));
      cleanup();
    }
    expect(new Set(resultados).size).toBe(1);
    expect(resultados[0]).toContain(new Intl.NumberFormat("es-CO").format(Math.round(esperado())).replace(/,/g, "."));
  });
  it("Enter confirma el monto", () => {
    const onGuardar = vi.fn();
    const c = render(<MiFuturo10 user={user} guardado={g} pasoInicial={2} onGuardar={onGuardar} />);
    const el = campoMonto(c);
    el.focus(); fireEvent.focus(el);
    const base = alertas(c);
    fireEvent.change(el, { target: { value: String(MONTO) } });
    expect(alertas(c)).toBe(base);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(alertas(c)).toBeGreaterThan(base);
    verResultado(c);
    expect(textoFalta(c)).toContain("BTG");
  });
});

describe("TRM: la fuente falla o cuelga → respaldo, nunca 4.200 ni «Cargando» eterno", () => {
  it("fetch rechazado → traerTrm rechaza", async () => {
    await expect(traerTrm(() => Promise.reject(new Error("blocked")), 50)).rejects.toThrow();
  });
  it("fetch colgado → rechaza al vencer el límite", async () => {
    vi.useFakeTimers();
    const p = traerTrm(() => new Promise(() => {}), 5000);
    const chk = expect(p).rejects.toThrow(/timeout/);
    await vi.advanceTimersByTimeAsync(5001);
    await chk;
  });
  it("con fallo y sin tasa guardada real: nota de respaldo, sin cifras en dólares", () => {
    const usd = { ...user, trm: 4200, inv: [...user.inv, { id: "u", n: "ETF", tp: "Acciones", moneda: "USD", va: 1000 }] };
    const t = resolverTasa("fallo", usd);
    expect(t.trm).toBeNull();
    const c = render(<MiFuturo10 user={usd} tasa={t} pasoInicial={2} onGuardar={() => {}} />);
    expect(c.getByTestId("f10-sin-tasa").textContent).toBe(MSG_SIN_TASA);
    expect(c.container.textContent).not.toContain(MSG_CARGANDO_TRM);
    expect(c.container.textContent).not.toMatch(/4\.200/);
  });
  it("con fallo y tasa real guardada: respaldo con esa tasa", () => {
    expect(resolverTasa("fallo", { trm: 3888, trmSrc: "Banco de la República", trmFecha: "2026-10-23" })).toEqual({ estado: "respaldo", trm: 3888, fecha: "2026-10-23" });
  });
});
