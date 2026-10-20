// Secuencia de la prueba Pro: qué correo le toca a cada cuenta en una fecha.
import { describe, it, expect } from "vitest";
import { elegirPaso, diasRestantes, hoyCOT, conteosDesdeBlob, estaPagando, sortearVarianteD13 } from "../../netlify/lib/lifecycle/pasos.mjs";

// trial_end para que HOY sea el día `dia` de la prueba (inicio = trial_end − 14).
const HOY = "2026-10-20";
const finParaDia = (dia) => {
  const d = new Date(Date.parse(HOY + "T00:00:00Z") + (14 - dia) * 86400000);
  return d.toISOString().slice(0, 10);
};
const base = (extra = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "ana@example.com", plan: "free", planUsuario: "free",
  activated_at: null, advisor_first_used_at: null, simulator_first_used_at: null, seq_sent: {}, seq_variant: null,
  email_unsubscribed_at: null, ...extra,
});

describe("calendario: solo el paso cuyo día es hoy", () => {
  const casos = [[2, "d2"], [5, "d5"], [10, "d10"], [13, "d13"], [16, "d16"]];
  for (const [dia, paso] of casos) {
    it(`día ${dia} → ${paso}`, () => {
      const r = elegirPaso(base({ trial_end: finParaDia(dia) }), HOY, { rnd: () => 0.1 });
      expect(r.enviar).toBe(true);
      expect(r.paso).toBe(paso);
    });
  }
  it("días sin paso no mandan nada (1, 3, 4, 6, 9, 11, 12, 14, 15, 17)", () => {
    for (const dia of [0, 1, 3, 4, 6, 9, 11, 12, 14, 15, 17, 30]) {
      const r = elegirPaso(base({ trial_end: finParaDia(dia) }), HOY);
      expect(r).toEqual({ enviar: false, motivo: "ningun_paso_hoy" });
    }
  });
  it("sin catch-up: prueba empezada antes del lanzamiento no recibe pasos atrasados", () => {
    // Día 7: ya pasaron d2 y d5 sin envío; hoy no le toca nada.
    expect(elegirPaso(base({ trial_end: finParaDia(7) }), HOY).enviar).toBe(false);
    // Día 11: pasó d10; nada hasta el d13.
    expect(elegirPaso(base({ trial_end: finParaDia(11) }), HOY).enviar).toBe(false);
    // y su d13 sí sale en su día, aunque no tenga ningún paso previo
    expect(elegirPaso(base({ trial_end: finParaDia(13) }), HOY, { rnd: () => 0.9 }).paso).toBe("d13");
  });
  it("d10 = faltan exactamente 4 días; d13 = falta 1", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(10) }), HOY).diasRestantes).toBe(4);
    expect(elegirPaso(base({ trial_end: finParaDia(13) }), HOY).diasRestantes).toBe(1);
    expect(elegirPaso(base({ trial_end: finParaDia(16) }), HOY).diasRestantes).toBe(-2);
  });
  it("acepta trial_end ISO completo", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(5) + "T20:06:36Z" }), HOY).paso).toBe("d5");
  });
});

describe("variantes", () => {
  it("d2 y d5 por activated_at (= primer activo cargado)", () => {
    for (const [dia, paso] of [[2, "d2"], [5, "d5"]]) {
      const sin = elegirPaso(base({ trial_end: finParaDia(dia) }), HOY);
      expect([sin.clave, sin.utmContent]).toEqual([`${paso}_sin_activo`, `${paso}_sin_activo`]);
      const con = elegirPaso(base({ trial_end: finParaDia(dia), activated_at: "2026-10-19T10:00:00Z" }), HOY);
      expect([con.clave, con.utmContent]).toEqual([`${paso}_con_activo`, `${paso}_con_activo`]);
    }
  });
  it("simulator_first_used_at y el asesor ya no deciden ninguna variante", () => {
    for (const sim of [null, "2026-10-18T10:00:00Z"]) for (const adv of [null, "2026-10-18T10:00:00Z"]) {
      const c = (dia, act) => elegirPaso(base({ trial_end: finParaDia(dia), activated_at: act, simulator_first_used_at: sim, advisor_first_used_at: adv }), HOY).clave;
      expect(c(5, null)).toBe("d5_sin_activo");
      expect(c(5, "x")).toBe("d5_con_activo");
      expect(c(10, null)).toBe("d10");
      expect(c(10, "x")).toBe("d10");
    }
  });
  it("d10 sin variante: clave y utm_content d10", () => {
    const r = elegirPaso(base({ trial_end: finParaDia(10) }), HOY);
    expect([r.clave, r.utmContent]).toEqual(["d10", "d10"]);
  });
  it("d13: sorteo 50/50 independiente del asesor; utm_content = urgencia|valor", () => {
    const u = elegirPaso(base({ trial_end: finParaDia(13), advisor_first_used_at: "x" }), HOY, { rnd: () => 0.2 });
    expect([u.clave, u.utmContent, u.varianteD13]).toEqual(["d13_urgencia", "urgencia", "urgencia"]);
    const v = elegirPaso(base({ trial_end: finParaDia(13) }), HOY, { rnd: () => 0.7 });
    expect([v.clave, v.utmContent, v.varianteD13]).toEqual(["d13_valor", "valor", "valor"]);
  });
  it("d13: si ya hay variante guardada, se reutiliza (no se vuelve a sortear)", () => {
    const r = elegirPaso(base({ trial_end: finParaDia(13), seq_variant: "valor" }), HOY, { rnd: () => 0 });
    expect(r.varianteD13).toBe("valor");
  });
  it("sortearVarianteD13 reparte ~50/50", () => {
    let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let urg = 0; for (let i = 0; i < 2000; i++) if (sortearVarianteD13(rnd) === "urgencia") urg++;
    expect(urg).toBeGreaterThan(900); expect(urg).toBeLessThan(1100);
  });
  it("d16: clave y utm_content d16", () => {
    const r = elegirPaso(base({ trial_end: finParaDia(16) }), HOY);
    expect([r.clave, r.utmContent]).toEqual(["d16", "d16"]);
  });
});

describe("saltos", () => {
  it("dado de baja", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(5), email_unsubscribed_at: "2026-10-18T00:00:00Z" }), HOY).motivo).toBe("dado_de_baja");
  });
  it("pagando (accounts.plan o user_data.plan distinto de free)", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(10), plan: "pro" }), HOY).motivo).toBe("pagando");
    expect(elegirPaso(base({ trial_end: finParaDia(10), plan: "pro_familiar" }), HOY).motivo).toBe("pagando");
    expect(elegirPaso(base({ trial_end: finParaDia(10), planUsuario: "basico" }), HOY).motivo).toBe("pagando");
    expect(estaPagando({ plan: "free", planUsuario: "free" })).toBe(false);
  });
  it("paso ya enviado (seq_sent)", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(10), seq_sent: { d10: "2026-10-20T14:00:00Z" } }), HOY).motivo).toBe("paso_ya_enviado");
  });
  it("otro paso enviado no bloquea el de hoy", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(10), seq_sent: { d2: "x", d5: "y" } }), HOY).paso).toBe("d10");
  });
  it("sin correo o sin trial_end", () => {
    expect(elegirPaso(base({ trial_end: finParaDia(5), email: "" }), HOY).motivo).toBe("sin_email");
    expect(elegirPaso(base({ trial_end: null }), HOY).motivo).toBe("sin_trial_end");
  });
});

describe("fechas y conteos", () => {
  it("hoyCOT usa UTC−5", () => {
    expect(hoyCOT(new Date("2026-10-21T03:00:00Z"))).toBe("2026-10-20");
    expect(hoyCOT(new Date("2026-10-20T14:00:00Z"))).toBe("2026-10-20");
  });
  it("diasRestantes", () => {
    expect(diasRestantes("2026-10-24", "2026-10-20")).toBe(4);
    expect(diasRestantes("nada", "2026-10-20")).toBe(null);
  });
  it("conteos: nunca montos; null si el blob está cifrado", () => {
    const blob = { ingresos: [{ mensual: 9 }], gas: { Vivienda: [{ m: 1 }, { m: 2 }], Otros: [] }, deu: [{}], inv: [{}, {}, {}] };
    expect(conteosDesdeBlob(blob)).toEqual({ n: 4, m: 3 });
    expect(conteosDesdeBlob({ _encrypted: true, payload: "x" })).toBe(null);
    expect(conteosDesdeBlob(null)).toBe(null);
  });
});
