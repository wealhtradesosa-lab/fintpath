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
