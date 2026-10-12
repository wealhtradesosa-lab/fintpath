// Los logs de Netlify no deben llevar correos completos.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { enmascararEmail } = require("../../netlify/lib/enmascararEmail.cjs");

describe("enmascararEmail", () => {
  it("deja 2 letras y el dominio", () => {
    expect(enmascararEmail("ana.maria@gmail.com")).toBe("an***@gmail.com");
    expect(enmascararEmail("a@x.co")).toBe("a***@x.co");
    expect(enmascararEmail("@x.co")).toBe("****@x.co");
  });
  it("sin @ o vacío → ***", () => {
    for (const v of ["", null, undefined, "sin-arroba", 42]) expect(enmascararEmail(v)).toBe("***");
  });
  it("nunca devuelve el correo completo", () => {
    const e = "santiago.perez@empresa.com";
    expect(enmascararEmail(e)).not.toContain("santiago.perez");
  });
});

describe("logs de las funciones", () => {
  const archivos = [
    "netlify/functions/stripe-webhook.cjs",
    "netlify/functions/advisor-invite.cjs",
    "netlify/functions/family-invite-email.cjs",
  ];
  for (const f of archivos) {
    it(`${f}: ningún console.* interpola un email sin enmascarar`, () => {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
      const lineas = src.split("\n").filter((l) => /console\.(log|info|warn|error)\(/.test(l));
      for (const l of lineas) {
        // ${email}, ${customer.email}, ${to}, ${x.email} sin pasar por enmascararEmail(...)
        const crudos = [...l.matchAll(/\$\{\s*([\w.?]*(?:email|Email)|to)\s*\}/g)];
        expect(crudos, `${f}: ${l.trim()}`).toHaveLength(0);
      }
      expect(src).toContain('require("../lib/enmascararEmail.cjs")');
    });
  }
});
