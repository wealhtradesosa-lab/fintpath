// Hotfix TRM: los efectos de TRM quedaron (770fd94 / 2968b02) dentro del
// callback de descartarHallazgo por un `});` faltante, así que nunca corrían y
// la app se quedaba en 4200. Este test fija la estructura y el comportamiento.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "@babel/parser";

const src = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });

const walk = (n, fn) => { if (!n || typeof n.type !== "string") return; fn(n); for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, fn)); else if (v && typeof v.type === "string") walk(v, fn); } };
const finPath = ast.program.body.find((n) => n.type === "ExportDefaultDeclaration").declaration;
const top = finPath.body.body;
const decl = (name) => top.find((s) => s.type === "VariableDeclaration" && s.declarations.some((d) => d.id.name === name));
const usaTrmPendiente = (n) => src.slice(n.start, n.end).includes("trmPendiente.current");

describe("App.jsx: efectos de TRM", () => {
  it("descartarHallazgo ya no llama hooks", () => {
    const d = decl("descartarHallazgo");
    expect(d).toBeTruthy();
    const hooks = [];
    walk(d, (n) => { if (n.type === "CallExpression" && n.callee.type === "Identifier" && /^use[A-Z]/.test(n.callee.name)) hooks.push(n.callee.name); });
    expect(hooks).toEqual([]);
  });

  it("trmPendiente y los efectos de TRM están a nivel superior, después de `u`", () => {
    const iU = top.indexOf(top.find((s) => s.type === "VariableDeclaration" && s.declarations.some((d) => d.id.type === "ArrayPattern" && d.id.elements[0]?.name === "u")));
    const iRef = top.indexOf(decl("trmPendiente"));
    expect(iU).toBeGreaterThanOrEqual(0);
    expect(iRef).toBeGreaterThan(iU);
    const efectos = top.filter((s) => s.type === "ExpressionStatement" && s.expression.callee?.name === "useEffect" && /trm/.test(src.slice(s.start, s.end)));
    expect(efectos.length).toBeGreaterThanOrEqual(2);
    efectos.forEach((e) => expect(top.indexOf(e)).toBeGreaterThan(iU));
  });

  // Ejecuta el cuerpo real del efecto que aplica la TRM pendiente.
  const efectoPendiente = () => {
    const e = top.find((s) => s.type === "ExpressionStatement" && s.expression.callee?.name === "useEffect" && usaTrmPendiente(s));
    const fn = e.expression.arguments[0];
    return new Function("u", "setU", "trmPendiente", `return (${src.slice(fn.start, fn.end)})();`);
  };
  const correr = (u, pendiente) => {
    let estado = u; const ref = { current: pendiente };
    efectoPendiente()(u, (f) => { estado = typeof f === "function" ? f(estado) : f; }, ref);
    return { estado, ref };
  };

  it("TRM que llega antes de la sesión pisa un 4200 guardado", () => {
    const { estado, ref } = correr({ trm: 4200, p: { name: "x" } }, { trm: 3912.5, trmSrc: "BanRep" });
    expect(estado.trm).toBe(3912.5);
    expect(estado.trmSrc).toBe("BanRep");
    expect(ref.current).toBeNull();
  });

  it("si aún no hay sesión, la TRM queda pendiente", () => {
    const { ref } = correr(null, { trm: 3912.5, trmSrc: "BanRep" });
    expect(ref.current).toEqual({ trm: 3912.5, trmSrc: "BanRep" });
  });

  it("se consume una sola vez (no pisa un ajuste manual posterior)", () => {
    const { ref } = correr({ trm: 3912.5, trmSrc: "BanRep" }, { trm: 3912.5, trmSrc: "BanRep" });
    expect(ref.current).toBeNull();
  });
});

describe("TRM provisional 4200 (requisitos Tributario)", async () => {
  const { trmReal, sinTrmProvisional, _sanitize } = await import("../../src/App.jsx");
  it("(1) no se persiste trm=4200: sinTrmProvisional la quita", () => {
    expect(sinTrmProvisional({ trm: 4200, trmSrc: "x", p: {} })).toEqual({ p: {} });
    expect(sinTrmProvisional({ p: {} })).toEqual({ p: {} });
    expect(sinTrmProvisional({ trm: 3912.5, trmSrc: "BanRep" }).trm).toBe(3912.5);
  });
  it("(2) un perfil con TRM real guardada la conserva al cargar (respaldo si /api/trm falla)", () => {
    expect(_sanitize({ trm: 3912.5, trmSrc: "BanRep" }).trm).toBe(3912.5);
  });
  it("(3) un 4200 guardado se trata como inválido al cargar", () => {
    const d = _sanitize({ trm: 4200, trmSrc: "default" });
    expect(d.trm).toBeUndefined();
    expect(trmReal(d)).toBeNull();
    expect(trmReal({ trm: 4200 })).toBeNull();
  });
});

describe("TRM en pantalla: viva → guardada → pendiente (sin 4200)", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const A = await import("../../src/App.jsx");
  const conUSD = { inv: [{ id: "a", va: 1000, moneda: "USD" }, { id: "b", va: 5e6 }] };
  const soloCOP = { inv: [{ id: "b", va: 5e6 }] };

  it("/api/trm con source default (4200) no cuenta como tasa", () => {
    expect(A.trmDeApi({ trm: 4200, source: "default" })).toBeNull();
    expect(A.trmDeApi({ trm: 3900, source: "default" })).toBeNull();
    expect(A.trmDeApi({ trm: 3912.5, source: "Banco de la República", date: "2026-10-23" }))
      .toEqual({ trm: 3912.5, trmSrc: "Banco de la República", trmFecha: "2026-10-23" });
  });
  it("viva / guardada con fecha / pendiente", () => {
    expect(A.estadoTrm({ ...conUSD, trm: 3912.5 }, true)).toMatchObject({ trm: 3912.5, modo: "viva" });
    expect(A.estadoTrm({ ...conUSD, trm: 3912.5, trmFecha: "2026-10-23" }, false)).toMatchObject({ trm: 3912.5, modo: "guardada", fecha: "23-oct" });
    expect(A.estadoTrm({ ...conUSD, trm: 4200 }, false)).toMatchObject({ trm: 0, modo: "pendiente" });
    expect(A.estadoTrm(soloCOP, false).modo).toBe("sin_usd");
  });
  it("aviso: «Tasa usada: TRM del DD-mmm» y «No pudimos obtener la TRM»", () => {
    const g = renderToStaticMarkup(React.createElement(A.AvisoTasa, { est: { modo: "guardada", fecha: "23-oct", trm: 3900 }, t: {} }));
    expect(g).toContain("Tasa usada: TRM del 23-oct");
    const p = renderToStaticMarkup(React.createElement(A.AvisoTasa, { est: { modo: "pendiente", trm: 0 }, t: { nw: 5e6 }, fm: (n) => String(n) }));
    expect(p).toContain("No pudimos obtener la TRM; vuelve a intentar");
    expect(p).toContain("pendientes de tasa");
    expect(p).toContain("sin tus montos en USD");
  });
  it("pendiente: totales marcados y nivel congelado en el último conocido", () => {
    const base = { nw: 5e6, nivel: { nivel: 1, nombre: "Supervivencia" } };
    const ultimo = { nivel: 3, nombre: "Seguridad" };
    const r = A.totalesConTasa(base, { modo: "pendiente" }, ultimo);
    expect(r.pendienteTasa).toBe(true);
    expect(r.nivel).toBe(ultimo); // no baja → no hay cambio de nivel que avisar
    expect(r.nw).toBe(5e6);
    const sinUltimo = A.totalesConTasa(base, { modo: "pendiente" }, null);
    expect(sinUltimo.nivel.pendienteTasa).toBe(true);
    expect(A.totalesConTasa(base, { modo: "viva" }, ultimo)).toBe(base);
  });
  it("sin tasa, los USD no se convierten a 4200 (vaCOP con trm=0)", async () => {
    const { vaCOP } = await import("../../src/lib/flowHelpers.js");
    expect(vaCOP({ va: 1000, moneda: "USD" }, A.estadoTrm({ ...conUSD, trm: 4200 }).trm)).toBe(0);
  });
  it("nota F-210/F-110 solo con ítems USD", () => {
    const con = renderToStaticMarkup(React.createElement(A.NotaTrmDeclaracion, { u: conUSD }));
    expect(con).toContain(A.NOTA_TRM_DECLARACION);
    expect(con).toContain("31-dic-2025");
    expect(A.NOTA_TRM_DECLARACION).toBe("Tus montos en dólares de este borrador todavía no están convertidos correctamente. No lo uses para declarar. En tu declaración usa la TRM del 31-dic-2025 para patrimonio y la del día de cada pago para ingresos.");
    expect(con).not.toContain("Convertido con la TRM actual");
    expect(renderToStaticMarkup(React.createElement(A.NotaTrmDeclaracion, { u: soloCOP }))).toBe("");
  });
});
