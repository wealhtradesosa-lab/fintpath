import { describe, it, expect } from "vitest";
import { sanitizePayload } from "../../src/lib/analytics.js";

describe("sanitizePayload: nada de montos ni identificadores a los trackers", () => {
  it("quita user_id, owner_id y montos numéricos", () => {
    const out = sanitizePayload({
      user_id: "uuid", owner_id: "o1", total_pesos_m: 12, monto: 5000,
      email: "a@b.co", campos_capturados: 3, method: "email",
    });
    expect(out).toEqual({ campos_capturados: 3, method: "email" });
  });
  it("deja pasar banderas booleanas y conteos de uso", () => {
    const out = sanitizePayload({ salario_es_bruto: true, tiene_ss_indep: false, total_senales: 4, dias_restantes: 9, plan: "pro" });
    expect(out).toEqual({ salario_es_bruto: true, tiene_ss_indep: false, total_senales: 4, dias_restantes: 9, plan: "pro" });
  });
  it("tolera payload vacío o inválido", () => {
    expect(sanitizePayload(undefined)).toEqual({});
    expect(sanitizePayload(null)).toEqual({});
  });
});
