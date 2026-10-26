// Los logs de Netlify no deben llevar correos completos, uids completos,
// datos de contacto ni objetos de error enteros.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { enmascararEmail, uidCorto, errorParaLog } = require("../../netlify/lib/logSeguro.cjs");

describe("enmascararEmail", () => {
  it("deja 2 letras y el dominio", () => {
    expect(enmascararEmail("ana.maria@gmail.com")).toBe("an***@gmail.com");
    expect(enmascararEmail("abc@x.co")).toBe("ab***@x.co");
  });
  it("un usuario de 1-2 letras se oculta entero", () => {
    expect(enmascararEmail("a@x.co")).toBe("***@x.co");
    expect(enmascararEmail("ab@x.co")).toBe("***@x.co");
    expect(enmascararEmail("@x.co")).toBe("***@x.co");
  });
  it("sin @, sin dominio o vacío → ***", () => {
    for (const v of ["", null, undefined, "sin-arroba", 42, "ana@"]) expect(enmascararEmail(v)).toBe("***");
  });
  it("nunca devuelve el usuario completo", () => {
    expect(enmascararEmail("santiago.perez@empresa.com")).not.toContain("santiago.perez");
  });
});

describe("uidCorto", () => {
  it("primeros 8 caracteres", () => {
    expect(uidCorto("0f1e2d3c-4b5a-4968-8776-655443322110")).toBe("0f1e2d3c");
    expect(uidCorto(null)).toBe("-");
    expect(uidCorto("")).toBe("-");
  });
});

describe("errorParaLog", () => {
  it("Error → solo message y code", () => {
    const e = Object.assign(new Error("fallo"), { code: "ECONNRESET", config: { headers: { Authorization: "Bearer x" } } });
    expect(errorParaLog(e)).toEqual({ message: "fallo", code: "ECONNRESET" });
  });
  it("respuesta de Resend → message y name; enmascara correos dentro del mensaje", () => {
    const r = errorParaLog({ name: "validation_error", statusCode: 422, message: "Invalid `to` field: maria.lopez@gmail.com" });
    expect(r.message).toBe("Invalid `to` field: ma***@gmail.com");
    expect(r.code).toBe("422");
    expect(JSON.stringify(r)).not.toContain("maria.lopez");
  });
  it("error de Stripe usa type como code; valores raros no rompen", () => {
    expect(errorParaLog({ type: "StripeInvalidRequestError", message: "No such customer" })).toEqual({ message: "No such customer", code: "StripeInvalidRequestError" });
    expect(errorParaLog(null)).toEqual({ message: "error desconocido" });
    expect(errorParaLog("texto con a@b.co")).toEqual({ message: "texto con ***@b.co" });
  });
});

// Chequeo estático de los console.* de las funciones tocadas.
const leer = (f) => readFileSync(new URL(`../../netlify/functions/${f}`, import.meta.url), "utf8");
const logs = (src) => src.split("\n").filter((l) => /console\.(log|info|warn|error)\(/.test(l));

describe("logs de las funciones", () => {
  for (const f of ["stripe-webhook.cjs", "advisor-invite.cjs", "family-invite-email.cjs", "advisor-lead.cjs", "support-ticket.cjs"]) {
    it(`${f}: ningún console.* interpola un email sin enmascarar`, () => {
      for (const l of logs(leer(f))) {
        const crudos = [...l.matchAll(/\$\{\s*([\w.?]*(?:email|Email)|to)\s*\}/g)];
        expect(crudos, l.trim()).toHaveLength(0);
      }
    });
  }

  it("advisor-lead y support-ticket solo loguean campos no personales", () => {
    for (const f of ["advisor-lead.cjs", "support-ticket.cjs"]) {
      const ls = logs(leer(f)).filter((l) => /LEAD|TICKET/.test(l));
      expect(ls.length, f).toBe(1);
      for (const campo of ["name", "email", "phone", "firm", "message"]) expect(ls[0], `${f}: ${campo}`).not.toMatch(new RegExp(`\\b${campo}\\b`));
      expect(ls[0]).not.toMatch(/JSON\.stringify\((lead|ticket)\)/);
    }
  });

  it("los errores se loguean con errorParaLog", () => {
    const casos = {
      "family-invite-email.cjs": ["Resend error", "Exception"],
      "stripe-customer-portal.cjs": ["portal] error:"],
      "send-email.cjs": ["exception:", "Resend error"],
      // 26-oct-2026 — Los tres que el #37 no alcanzó. Son rutas de envío de
      // correo: el `message` de Resend puede traer el destinatario.
      "email-unsubscribe.mjs": ["unsubscribe] error:"],
      "advisor-lead.cjs": ["Email notification failed"],
      "stripe-webhook.cjs": ["cancellation email failed"],
    };
    for (const [f, marcas] of Object.entries(casos)) {
      const ls = logs(leer(f));
      for (const m of marcas) {
        const l = ls.find((x) => x.includes(m));
        expect(l, `${f} ${m}`).toBeTruthy();
        expect(l, `${f} ${m}`).toContain("errorParaLog(");
      }
    }
  });

  it("los uids se recortan a 8 caracteres en los sitios señalados", () => {
    const casos = {
      "stripe-checkout.cjs": [/session creada/, ["userId"]],
      "stripe-webhook.cjs": [/activando plan/, ["userId"]],
      "stripe-customer-portal.cjs": [/portal session creada/, ["userId"]],
      "expire-canceled-cron.mjs": [/account_id=/, ["row.account_id", "row.owner_user_id"]],
      "advisor-invite.cjs": [/Invitation created/, ["advisor_id"]],
      "advisor-accept-invite.cjs": [/accepted by client/, ["invitation.id", "client_id", "invitation.advisor_id"]],
    };
    for (const [f, [re, vars]] of Object.entries(casos)) {
      const l = logs(leer(f)).find((x) => re.test(x));
      expect(l, f).toBeTruthy();
      for (const v of vars) {
        expect(l, `${f} ${v}`).toContain(`uidCorto(${v})`);
        expect(l, `${f} ${v}`).not.toContain("${" + v + "}");
      }
    }
  });

  it("advisor-invite ya no loguea el prefijo del token", () => {
    expect(logs(leer("advisor-invite.cjs")).join("\n")).not.toMatch(/token\.slice/);
  });
});
