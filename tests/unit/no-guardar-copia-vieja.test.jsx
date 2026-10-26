import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

globalThis.window = globalThis.window || globalThis;
const llamadas = [];
const _mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
  clear: () => _mem.clear(),
};
let respuesta = async () => ({ data: null, error: null });
vi.mock("../../src/lib/supabase", () => {
  const tabla = (nombre) => {
    const reg = (op) => (...args) => { llamadas.push({ nombre, op, args }); return q; };
    const q = {
      select: (...a) => { llamadas.push({ nombre, op: "select", args: a }); return q; },
      eq: () => q,
      maybeSingle: () => respuesta(),
      update: reg("update"), upsert: reg("upsert"), insert: reg("insert"),
      then: (res) => res({ error: null }),
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from: tabla, auth: { getSession: async () => ({ data: {} }) } } };
});

import { _sS as sS, _sLR as sLR, AvisoNoSincronizado } from "../../src/App.jsx";
import { AVISO_NO_SINCRONIZADO, datosNoSincronizados, marcarNoSincronizados } from "../../src/lib/sincronizacion.js";

const escrituras = () => llamadas.filter((c) => c.op !== "select");
const VIEJA = { p: { name: "Vieja" }, inv: [{ id: "v1", va: 1 }] };
const REAL = { p: { name: "Real" }, inv: [{ id: "r1", va: 99 }] };

describe("no guardar la copia vieja (fp3) encima de la cuenta", () => {
  beforeEach(() => {
    llamadas.length = 0; localStorage.clear(); marcarNoSincronizados(false);
    localStorage.setItem("fp3", JSON.stringify(VIEJA));
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("error de lectura: muestra la copia local, marca el flag y no guarda nada", async () => {
    respuesta = async () => ({ data: null, error: { message: "fetch failed" } });
    const r = await sLR("uid1", "acc1");
    expect(r.estado).toBe("error");
    expect(r.datos.p.name).toBe("Vieja");
    expect(datosNoSincronizados()).toBe(true);
    // autosave, guardado manual y escenario pasan todos por sS
    await sS(r.datos, "uid1", "acc1", false, "admin");
    await sS({ ...r.datos, futuro10: { a: 1 } }, "uid1", null, true, "admin");
    await vi.advanceTimersByTimeAsync(5000);
    expect(escrituras()).toHaveLength(0);
  });

  it("timeout de lectura cuenta como error, no como usuario nuevo", async () => {
    respuesta = () => new Promise(() => {});
    const p = sLR("uid1", "acc1");
    await vi.advanceTimersByTimeAsync(9000);
    const r = await p;
    expect(r.estado).toBe("error");
    expect(datosNoSincronizados()).toBe(true);
  });

  it("un guardado ya programado no sale si la lectura falla después", async () => {
    await sS(VIEJA, "uid1", "acc1", false, "admin");
    marcarNoSincronizados(true);
    await vi.advanceTimersByTimeAsync(2500);
    expect(escrituras()).toHaveLength(0);
  });

  it("reintento exitoso: trae la copia del servidor, limpia el flag y guarda normal", async () => {
    respuesta = async () => ({ data: null, error: { message: "down" } });
    await sLR("uid1", "acc1");
    expect(datosNoSincronizados()).toBe(true);
    respuesta = async () => ({ data: { data: REAL, jurisdiction: "CO" }, error: null });
    const r = await sLR("uid1", "acc1");
    expect(r.estado).toBe("ok");
    expect(r.datos.p.name).toBe("Real");
    expect(datosNoSincronizados()).toBe(false);
    expect(JSON.parse(localStorage.getItem("fp3")).p.name).toBe("Real");
    await sS(r.datos, "uid1", "acc1", false, "admin");
    await vi.advanceTimersByTimeAsync(2500);
    expect(escrituras().map((c) => c.op)).toEqual(["update"]);
  });

  it("usuario nuevo sin fila: estado nuevo, sin flag, y su primer guardado sale", async () => {
    respuesta = async () => ({ data: null, error: null });
    const r = await sLR("uid2", null);
    expect(r.estado).toBe("nuevo");
    expect(r.datos).toBeNull();
    expect(datosNoSincronizados()).toBe(false);
    await sS({ p: { name: "Nuevo" } }, "uid2");
    await vi.advanceTimersByTimeAsync(2500);
    expect(escrituras().map((c) => c.op)).toEqual(["upsert"]);
  });

  it("fila cifrada sin llave es error, no usuario nuevo", async () => {
    respuesta = async () => ({ data: { data: { _encrypted: true, payload: "x" } }, error: null });
    const r = await sLR("uid1", "acc1");
    expect(r.estado).toBe("error");
    expect(datosNoSincronizados()).toBe(true);
  });

  it("banner con el texto exacto y botón Reintentar", () => {
    expect(AVISO_NO_SINCRONIZADO).toBe("No pudimos cargar tus datos más recientes. Lo que ves puede estar desactualizado; no guardamos cambios hasta reconectar.");
    const html = renderToStaticMarkup(<AvisoNoSincronizado onReintentar={() => {}} />);
    expect(html).toContain(AVISO_NO_SINCRONIZADO);
    expect(html).toContain("Reintentar");
  });
});
