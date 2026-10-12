// Migración 20261012_plan_sync_accounts.sql probada en PGlite sobre una
// copia mínima del esquema de prod (tests/fixtures/sql/prod_planes_antes.sql).
import { describe, it, expect, vi } from "vitest";

// Cada caso arranca un Postgres en memoria (PGlite): 1-5 s por caso.
vi.setConfig({ testTimeout: 30000 });
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ESQUEMA = readFileSync(new URL("../fixtures/sql/prod_planes_antes.sql", import.meta.url), "utf8");
const MIGRACION = readFileSync(new URL("../../supabase/migrations/20261012_plan_sync_accounts.sql", import.meta.url), "utf8");
const ROLLBACK = MIGRACION.split("-- ROLLBACK")[1].split("\n")
  .filter((l) => l.startsWith("-- ") && !l.includes("═") && !l.startsWith("-- NOTA")).map((l) => l.slice(3)).join("\n");

const OWNER = "00000000-0000-4000-8000-000000000001";
const ACC = "10000000-0000-4000-8000-000000000001";
const M2 = "00000000-0000-4000-8000-000000000002";
const M3 = "00000000-0000-4000-8000-000000000003";
const CUS = "cus_test_1";

async function base({ migrar = true, plan = "free", udPlan = "free" } = {}) {
  const db = new PGlite();
  await db.exec(ESQUEMA);
  await db.exec(`
    INSERT INTO auth.users(id, email) VALUES ('${OWNER}', 'o@x.co'), ('${M2}', 'm2@x.co'), ('${M3}', 'm3@x.co');
    INSERT INTO accounts(id, owner_user_id, plan, max_members, display_name) VALUES ('${ACC}', '${OWNER}', '${plan}', 1, 'Mi cuenta');
    INSERT INTO user_data(id, email, plan, account_id, stripe_customer_id, data) VALUES ('${OWNER}', 'o@x.co', '${udPlan}', '${ACC}', '${CUS}', '{"p":{"plan":"${udPlan}"}}');
    INSERT INTO account_members(account_id, user_id, role, status) VALUES ('${ACC}', '${OWNER}', 'admin', 'active');
  `);
  if (migrar) await db.exec(MIGRACION);
  return db;
}
const cuenta = async (db) => (await db.query(`SELECT plan, max_members, subscription_status, grace_until FROM accounts WHERE id='${ACC}'`)).rows[0];
const comoDueno = (db) => db.exec(`SELECT set_config('test.uid', '${OWNER}', false)`);
const invitar = (db, email) => db.query(`SELECT create_invitation('${ACC}', '${email}', 'reader')`);
const agregarMiembro = (db, uid) => db.exec(`INSERT INTO account_members(account_id, user_id, role, status) VALUES ('${ACC}', '${uid}', 'reader', 'active')`);

describe("antes de la migración (bug)", () => {
  it("pagar Pro deja accounts en free con 1 cupo", async () => {
    const db = await base({ migrar: false });
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1 });
  });
  it("expire_canceled_accounts falla por el CHECK sin 'expired'", async () => {
    const db = await base({ migrar: false, plan: "pro_familiar" });
    await db.exec(`UPDATE accounts SET subscription_status='canceled', grace_until=now() - interval '1 day'`);
    await expect(db.query("SELECT * FROM expire_canceled_accounts()")).rejects.toThrow(/subscription_status_check/);
  });
});

describe("checkout y cambios de plan", () => {
  it("Pro: accounts.plan=pro, 3 cupos, se pueden invitar 2 y el tercero no", async () => {
    const db = await base();
    const r = await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}') AS ok`);
    expect(r.rows[0].ok).toBe(true);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active" });
    await comoDueno(db);
    await invitar(db, "a@x.co");
    await invitar(db, "b@x.co");
    await expect(invitar(db, "c@x.co")).rejects.toThrow(/Cuenta llena/);
  });
  it("Básico: accounts.plan=basico, 1 cupo", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'basico', '${CUS}')`);
    expect(await cuenta(db)).toMatchObject({ plan: "basico", max_members: 1 });
  });
  it("no toca una cuenta pro_familiar", async () => {
    const db = await base({ plan: "pro_familiar", udPlan: "pro_familiar" });
    await db.exec(`UPDATE accounts SET max_members=10`);
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    expect(await cuenta(db)).toMatchObject({ plan: "pro_familiar", max_members: 10 });
  });
  it("max_members_for_plan: basico y free explícitos", async () => {
    const db = await base();
    const r = await db.query(`SELECT max_members_for_plan('basico') b, max_members_for_plan('free') f, max_members_for_plan('pro') p, max_members_for_plan('pro_familiar') pf`);
    expect(r.rows[0]).toEqual({ b: 1, f: 1, p: 3, pf: 10 });
  });
  it("subscription.updated basico→pro sube a 3; pro→basico baja a 1, los miembros se quedan y no entra nadie más", async () => {
    const db = await base({ plan: "basico", udPlan: "basico" });
    await db.query(`SELECT * FROM handle_subscription_updated('${CUS}', 'pro', 'active')`);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3 });
    await agregarMiembro(db, M2);
    await agregarMiembro(db, M3);
    await db.query(`SELECT * FROM handle_subscription_updated('${CUS}', 'basico', 'active')`);
    expect(await cuenta(db)).toMatchObject({ plan: "basico", max_members: 1 });
    const n = await db.query(`SELECT count(*)::int n FROM account_members WHERE account_id='${ACC}' AND status='active'`);
    expect(n.rows[0].n).toBe(3);
    await comoDueno(db);
    await expect(invitar(db, "d@x.co")).rejects.toThrow(/Cuenta llena/);
  });
});

describe("cancelación de Pro", () => {
  it("canceled + 30 días de gracia; al vencer pasa a free/expired con 1 cupo, miembros intactos, sin invitaciones nuevas", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    await agregarMiembro(db, M2);
    const r = await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now())`);
    expect(r.rows.map((x) => x.action)).toEqual(["pro_marked_canceled"]);
    const c = await cuenta(db);
    expect(c).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "canceled" });
    const dias = (new Date(c.grace_until) - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(29.9); expect(dias).toBeLessThan(30.1);

    // Durante la gracia no se expira
    expect((await db.query("SELECT * FROM expire_canceled_accounts()")).rows).toHaveLength(0);

    await db.exec(`UPDATE accounts SET grace_until = now() - interval '1 minute'`);
    const e = await db.query("SELECT * FROM expire_canceled_accounts()");
    expect(e.rows).toHaveLength(1);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1, subscription_status: "expired" });
    const ud = await db.query(`SELECT plan, data->'p'->>'plan' AS bp FROM user_data WHERE id='${OWNER}'`);
    expect(ud.rows[0]).toEqual({ plan: "free", bp: "free" });
    const n = await db.query(`SELECT count(*)::int n FROM account_members WHERE account_id='${ACC}' AND status='active'`);
    expect(n.rows[0].n).toBe(2);
    await comoDueno(db);
    await expect(invitar(db, "z@x.co")).rejects.toThrow(/Cuenta llena/);
  });
  it("reactivar dentro de la gracia limpia el estado (subscription.updated active)", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now())`);
    await db.query(`SELECT * FROM handle_subscription_updated('${CUS}', 'pro', 'active')`);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", subscription_status: "active", grace_until: null });
  });
  it("volver a pagar Pro después de expirar recupera 3 cupos", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now() - interval '31 days')`);
    await db.query("SELECT * FROM expire_canceled_accounts()");
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active", grace_until: null });
  });
  it("Básico cancelado no cambia (fuera de alcance)", async () => {
    const db = await base({ plan: "basico", udPlan: "basico" });
    const r = await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now())`);
    expect(r.rows).toHaveLength(0);
    expect(await cuenta(db)).toMatchObject({ plan: "basico", subscription_status: "active" });
  });
});

describe("backfill y rollback", () => {
  it("backfill: cuenta free con user_data pro pasa a pro con 3 cupos", async () => {
    const db = await base({ migrar: false, udPlan: "pro" });
    await db.exec(MIGRACION);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3 });
  });
  it("el navegador sigue sin poder cambiar plan ni cupos", async () => {
    const db = await base();
    await db.exec(`GRANT ALL ON accounts TO authenticated; SET ROLE authenticated; UPDATE accounts SET plan='pro', max_members=10; RESET ROLE;`);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1 });
  });
  it("el bloque de rollback corre y vuelve al comportamiento anterior", async () => {
    const db = await base();
    await db.exec(ROLLBACK);
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1 });
    const f = await db.query(`SELECT count(*)::int n FROM pg_proc WHERE proname='_sync_account_plan'`);
    expect(f.rows[0].n).toBe(0);
  });
});
