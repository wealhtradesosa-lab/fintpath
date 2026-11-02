// El fetch de la TRM no puede quedarse colgado. Hasta oct-2026 era un
// `fetch("/api/trm")` pelado: si la red no responde, la promesa no se resuelve
// nunca, el `catch {}` tampoco corre y la tasa no llega sin que nadie se entere.
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

// 2-nov-2026 — Estos tests fallaban de a ratos ("5005ms") y el rojo no era de
// la TRM: cada `it` hacía `await import("src/App.jsx")`, el archivo más pesado
// del proyecto, y bajo la carga de la suite completa el PRIMERO se comía los
// 5 s que vitest da por defecto. Fallaba el reloj del test, no el código. Un
// test que se cae de a ratos es peor que no tenerlo: enseña a ignorar el rojo.
// Ahora App.jsx se carga UNA vez, con holgura, y los tests miden lo suyo.
let traerTrm;
beforeAll(async () => {
  ({ traerTrm } = await import("../../src/App.jsx"));
}, 60000);
const cargar = async () => ({ traerTrm });

describe("traerTrm", () => {
  it("devuelve el json cuando /api/trm responde", async () => {
    const { traerTrm } = await cargar();
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ trm: 3950, source: "banrep" }) })));
    await expect(traerTrm()).resolves.toEqual({ trm: 3950, source: "banrep" });
  });

  it("si la red cuelga, rechaza por timeout en vez de quedarse esperando", async () => {
    const { traerTrm } = await cargar();
    // fetch que nunca resuelve: el caso que antes dejaba la promesa colgada.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    await expect(traerTrm(30)).rejects.toThrow(/timeout/);
  });

  it("aborta la petición al vencer el tiempo (no deja la conexión abierta)", async () => {
    const { traerTrm } = await cargar();
    let señal = null;
    vi.stubGlobal("fetch", vi.fn((_u, opts) => { señal = opts?.signal; return new Promise(() => {}); }));
    await expect(traerTrm(20)).rejects.toThrow(/timeout/);
    expect(señal).toBeTruthy();
    expect(señal.aborted).toBe(true);
  });

  it("también corta si responde pero el .json() se cuelga", async () => {
    const { traerTrm } = await cargar();
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: () => new Promise(() => {}) })));
    await expect(traerTrm(20)).rejects.toThrow(/timeout/);
  });

  it("ningún fetch a /api/trm queda sin pasar por traerTrm", () => {
    const src = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
    const pelados = src.split("\n").filter((l) => /fetch\(['"]\/api\/trm['"]\)/.test(l) && !l.trim().startsWith("//"));
    expect(pelados).toEqual([]);
    expect(src).toMatch(/const j\s*=\s*await traerTrm\(\)/);
  });
});
