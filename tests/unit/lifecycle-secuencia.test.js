// Motor del cron con fetch simulado: modo prueba, falla cerrado y marcado.
import { describe, it, expect } from "vitest";
import { correrSecuencia } from "../../netlify/lib/lifecycle/secuencia.mjs";

const AHORA = new Date("2026-10-20T14:00:00Z"); // hoy COT = 2026-10-20
const U1 = "aaaaaaaa-0000-4000-8000-000000000001";
const A1 = "bbbbbbbb-0000-4000-8000-000000000001";

function simular({ cuenta, previos = [] }) {
  const llamadas = [];
  const fetchFn = async (url, opts = {}) => {
    llamadas.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    const json = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => "" });
    if (url.includes("/rest/v1/accounts?select=")) return json([cuenta]);
    if (url.includes("/rest/v1/user_data")) return json([{ id: U1, email: "ana@example.com", plan: "free", data: { p: { name: "Ana" } } }]);
    if (url.includes("/rest/v1/lifecycle_email_sends?select=")) return json(previos);
    return json([]);
  };
  return { fetchFn, llamadas };
}
const cuentaD10 = { id: A1, owner_user_id: U1, plan: "free", trial_end: "2026-10-24", activated_at: null, advisor_first_used_at: null, seq_sent: {}, seq_variant: null, email_unsubscribed_at: null };
const envBase = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "k" };

describe("cron de la secuencia", () => {
  it("bandera apagada: DRY RUN, no envía, registra dry_run=true y no toca accounts", async () => {
    const { fetchFn, llamadas } = simular({ cuenta: cuentaD10 });
    let enviados = 0;
    const r = await correrSecuencia({ ahora: AHORA, env: envBase, fetchFn, enviar: async () => { enviados++; return { ok: true, sent: true }; } });
    expect(enviados).toBe(0);
    expect(r.real).toBe(false);
    const inserts = llamadas.filter((l) => l.method === "POST");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].body).toMatchObject({ user_id: U1, email_key: "d10_sin_asesor", utm_content: "d10_sin_asesor", dry_run: true });
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
  });
  it("dry run no duplica filas si ya existe una para esa persona y correo", async () => {
    const { fetchFn, llamadas } = simular({ cuenta: cuentaD10, previos: [{ user_id: U1, email_key: "d10_sin_asesor", dry_run: true, error: null }] });
    await correrSecuencia({ ahora: AHORA, env: envBase, fetchFn, enviar: async () => ({}) });
    expect(llamadas.filter((l) => l.method === "POST")).toHaveLength(0);
  });
  it("bandera prendida sin EMAIL_UNSUB_SECRET: falla cerrado (no envía)", async () => {
    const { fetchFn } = simular({ cuenta: cuentaD10 });
    let enviados = 0;
    const r = await correrSecuencia({ ahora: AHORA, env: { ...envBase, LIFECYCLE_EMAILS_ENABLED: "true" }, fetchFn, enviar: async () => { enviados++; return { ok: true, sent: true }; } });
    expect(enviados).toBe(0);
    expect(r.real).toBe(false);
  });
  it("un dry run previo NO cuenta como enviado al prender la bandera", async () => {
    const { fetchFn, llamadas } = simular({ cuenta: cuentaD10, previos: [{ user_id: U1, email_key: "d10_sin_asesor", dry_run: true, error: null }] });
    const enviados = [];
    await correrSecuencia({
      ahora: AHORA, env: { ...envBase, LIFECYCLE_EMAILS_ENABLED: "true", EMAIL_UNSUB_SECRET: "s" }, fetchFn,
      enviar: async (m) => { enviados.push(m); return { ok: true, sent: true, message_id: "re_1" }; },
    });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toBe("Te quedan 4 días de Pro, Ana");
    expect(enviados[0].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(enviados[0].headers["List-Unsubscribe"]).toMatch(/^<https:\/\/finpathia\.com\/api\/email-unsubscribe\?t=/);
    const patch = llamadas.find((l) => l.method === "PATCH");
    expect(patch.url).toContain(`accounts?id=eq.${A1}`);
    expect(Object.keys(patch.body).sort()).toEqual(["last_seq_email", "seq_sent"]);
    expect(patch.body.last_seq_email).toBe("d10_sin_asesor");
    const ins = llamadas.find((l) => l.method === "POST");
    expect(ins.body).toMatchObject({ dry_run: false, resend_id: "re_1" });
  });
  it("un envío real previo del mismo paso bloquea (red de seguridad)", async () => {
    const { fetchFn } = simular({ cuenta: cuentaD10, previos: [{ user_id: U1, email_key: "d10_sin_asesor", dry_run: false, error: null }] });
    let enviados = 0;
    await correrSecuencia({ ahora: AHORA, env: { ...envBase, LIFECYCLE_EMAILS_ENABLED: "true", EMAIL_UNSUB_SECRET: "s" }, fetchFn, enviar: async () => { enviados++; return { ok: true, sent: true }; } });
    expect(enviados).toBe(0);
  });
  it("si Resend falla, registra el error y NO marca seq_sent", async () => {
    const { fetchFn, llamadas } = simular({ cuenta: cuentaD10 });
    await correrSecuencia({ ahora: AHORA, env: { ...envBase, LIFECYCLE_EMAILS_ENABLED: "true", EMAIL_UNSUB_SECRET: "s" }, fetchFn, enviar: async () => ({ ok: true, sent: false, reason: "resend_not_configured" }) });
    expect(llamadas.some((l) => l.method === "PATCH")).toBe(false);
    expect(llamadas.find((l) => l.method === "POST").body).toMatchObject({ dry_run: false, error: "resend_not_configured" });
  });
});
