import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const llamadas = [];
const _mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
  clear: () => _mem.clear(),
};
// El guardado de App.jsx escribe en window (entorno node): stub mínimo para que no haya errores no manejados.
globalThis.window = globalThis.window || { dispatchEvent: () => true };
vi.mock("../../src/lib/supabase", () => {
  const tabla = (nombre) => {
    const reg = (op) => (...args) => { llamadas.push({ nombre, op, args }); return q; };
    const q = {
      select: (...a) => { llamadas.push({ nombre, op: "select", args: a }); return q; },
      eq: () => q,
      maybeSingle: async () => ({ data: { data: realEnBD(), jurisdiction: "CO" }, error: null }),
      update: reg("update"), upsert: reg("upsert"), insert: reg("insert"),
      then: (res) => res({ error: null }),
    };
    return q;
  };
  return { isSupabaseConfigured: true, supabase: { from: tabla, auth: { getSession: async () => ({ data: {} }) } } };
});
let realEnBD = () => ({ p: { name: "Real" }, inv: [{ id: "r1", va: 1 }] });

import { _sS as sS, _sL as sL } from "../../src/App.jsx";
import { esDemo, leerCache, guardarReal, datosAlSalir } from "../../src/lib/modoDemo.js";

const escrituras = () => llamadas.filter((c) => c.op !== "select");

describe("modo demo no persiste", () => {
  beforeEach(() => { llamadas.length = 0; localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("(a) en demo, modificar no escribe en Supabase ni en la caché local", async () => {
    const demo = { p: { name: "Pedro Pérez", demo: true }, inv: [{ id: "d_i5", va: 9 }] };
    await sS(demo, "uid1", "acc1", false, "admin");
    await sS({ ...demo, inv: [] }, "uid1", null, true, "admin");
    await vi.advanceTimersByTimeAsync(5000);
    expect(escrituras()).toHaveLength(0);
    expect(localStorage.getItem("fp3")).toBeNull();
    expect(localStorage.getItem("fp3_snapshots")).toBeNull();
  });

  it("(c) en modo normal sí guarda", async () => {
    await sS({ p: { name: "Real" }, inv: [] }, "uid1", "acc1", false, "admin");
    await vi.advanceTimersByTimeAsync(2500);
    expect(escrituras().map((c) => c.op)).toEqual(["update"]);
    expect(JSON.parse(localStorage.getItem("fp3")).p.name).toBe("Real");
  });

  it("(b) al salir vuelve la cuenta real (Supabase, o copia en memoria)", async () => {
    const ref = { current: null };
    const real = { p: { name: "Real" }, inv: [{ id: "r1" }] };
    guardarReal(ref, real);
    guardarReal(ref, { p: { demo: true } }); // no pisa la copia con demo
    expect(ref.current).toBe(real);
    const d = await datosAlSalir({ recargar: () => sL("uid1", "acc1"), ref, enBlanco: () => ({ p: {} }) });
    expect(d.inv[0].id).toBe("r1");
    expect(esDemo(d)).toBe(false);
    // Si Supabase tiene demo (cuenta ya contaminada) o falla → copia en memoria
    guardarReal(ref, real);
    const d2 = await datosAlSalir({ recargar: async () => ({ p: { demo: true } }), ref, enBlanco: () => ({}) });
    expect(d2).toBe(real);
    const d3 = await datosAlSalir({ recargar: async () => { throw new Error("x"); }, ref, enBlanco: () => ({ p: { name: "blanco" } }) });
    expect(d3.p.name).toBe("blanco");
  });

  it("la caché local nunca devuelve datos demo", () => {
    expect(leerCache(JSON.stringify({ p: { demo: true } }))).toBeNull();
    expect(leerCache(JSON.stringify({ p: { name: "x" } })).p.name).toBe("x");
  });
});
