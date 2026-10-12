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
const M4 = "00000000-0000-4000-8000-000000000004";
const M5 = "00000000-0000-4000-8000-000000000005";
const CUS = "cus_test_1";

async function base({ migrar = true, plan = "free", udPlan = "free" } = {}) {
  const db = new PGlite();
  await db.exec(ESQUEMA);
  await db.exec(`
    INSERT INTO auth.users(id, email) VALUES ('${OWNER}', 'o@x.co'), ('${M2}', 'm2@x.co'), ('${M3}', 'm3@x.co'), ('${M4}', 'm4@x.co'), ('${M5}', 'm5@x.co');
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
const miembros = async (db) => (await db.query(`SELECT count(*)::int n FROM account_members WHERE account_id='${ACC}' AND status='active'`)).rows[0].n;
const actualizar = async (db, plan, status) => (await db.query(`SELECT * FROM handle_subscription_updated('${CUS}', '${plan}', '${status}')`)).rows;
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
    await expect(invitar(db, "z@x.co")).rejects.toThrow(/cancelada/);
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
  it("rollback: las cuentas 'expired' vuelven a 'canceled' sin gracia y el backfill se revierte", async () => {
    const db = await base({ migrar: false, udPlan: "pro" });
    await db.exec(MIGRACION);
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3 });
    // Otra cuenta que expiró después de la migración
    const ACC2 = "10000000-0000-4000-8000-000000000002";
    await db.exec(`INSERT INTO accounts(id, owner_user_id, plan, max_members) VALUES ('${ACC2}', '${M2}', 'pro_familiar', 10);
                   UPDATE accounts SET subscription_status='canceled', grace_until=now() - interval '1 day' WHERE id='${ACC2}'`);
    await db.query("SELECT * FROM expire_canceled_accounts()");
    await db.exec(ROLLBACK);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1, subscription_status: "active" });
    const c2 = (await db.query(`SELECT plan, subscription_status, grace_until FROM accounts WHERE id='${ACC2}'`)).rows[0];
    expect(c2).toEqual({ plan: "free", subscription_status: "canceled", grace_until: null });
    // El cron viejo no la vuelve a tocar (sin gracia) y no choca con el CHECK
    await expect(db.query("SELECT * FROM expire_canceled_accounts()")).resolves.toBeTruthy();
    const t = await db.query(`SELECT to_regclass('public._backfill_plan_sync_20261012') AS t`);
    expect(t.rows[0].t).toBeNull();
  });
});

describe("idempotencia y renovaciones (QA #36)", () => {
  it("checkout, updated y canceled repetidos dejan el mismo estado", async () => {
    const db = await base();
    for (let i = 0; i < 2; i++) await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    for (let i = 0; i < 2; i++) await actualizar(db, "pro", "active");
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active", grace_until: null });
    const r1 = await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now())`);
    const g1 = (await cuenta(db)).grace_until;
    const r2 = await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now() + interval '1 day')`);
    expect(r1.rows).toHaveLength(1);
    expect(r2.rows).toHaveLength(0);
    expect((await cuenta(db)).grace_until).toEqual(g1);
  });
  it("renovación con el mismo plan repara una cuenta desfasada (ya no responde no_change)", async () => {
    const db = await base({ udPlan: "pro" }); // user_data pro, accounts free (el bug de antes)
    await db.exec(`UPDATE accounts SET plan='free', max_members=1`);
    const r = await actualizar(db, "pro", "active");
    expect(r[0].action).toBe("synced");
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active" });
  });
  it("trialing de Stripe cuenta como activo", async () => {
    const db = await base({ udPlan: "pro" });
    await actualizar(db, "pro", "trialing");
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active" });
  });
  it("past_due se refleja y una renovación pagada (invoice.paid) lo vuelve a active", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    await actualizar(db, "pro", "past_due");
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "past_due" });
    await actualizar(db, "pro", "unpaid");
    expect((await cuenta(db)).subscription_status).toBe("past_due");
    await actualizar(db, "pro", "active");
    expect((await cuenta(db)).subscription_status).toBe("active");
  });
  it("estados sin mapear (incomplete) no tocan nada", async () => {
    const db = await base();
    const r = await actualizar(db, "pro", "incomplete");
    expect(r[0].action).toBe("ignored_status_incomplete");
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1, subscription_status: "active" });
    const ud = await db.query(`SELECT plan FROM user_data WHERE id='${OWNER}'`);
    expect(ud.rows[0].plan).toBe("free");
  });
  it("Pro Familiar con el mismo plan sincroniza el estado (past_due → active)", async () => {
    const db = await base({ plan: "pro_familiar", udPlan: "pro_familiar" });
    await db.exec(`UPDATE accounts SET max_members=10`);
    await actualizar(db, "pro_familiar", "past_due");
    expect(await cuenta(db)).toMatchObject({ plan: "pro_familiar", max_members: 10, subscription_status: "past_due" });
    const r = await actualizar(db, "pro_familiar", "active");
    expect(r[0].action).toBe("synced");
    expect((await cuenta(db)).subscription_status).toBe("active");
  });
});

describe("cuentas sin Stripe y prueba de la app", () => {
  it("un customer desconocido no toca nada ni falla", async () => {
    const db = await base();
    const r = await db.query(`SELECT * FROM handle_subscription_updated('cus_otro', 'pro', 'active')`);
    expect(r.rows).toHaveLength(0);
    const c = await db.query(`SELECT * FROM handle_subscription_canceled('cus_otro', now())`);
    expect(c.rows).toHaveLength(0);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1, subscription_status: "active" });
  });
  it("usuario en prueba de 14 días sin Stripe: la cuenta sigue free/1 cupo (cupos de prueba fuera de alcance)", async () => {
    const db = await base();
    await db.exec(`UPDATE user_data SET stripe_customer_id=NULL, data='{"p":{"plan":"free","trialEnd":"2026-10-25"}}'`);
    await db.query(`SELECT * FROM handle_subscription_updated('${CUS}', 'pro', 'active')`);
    expect(await cuenta(db)).toMatchObject({ plan: "free", max_members: 1 });
  });
  it("checkout de un usuario sin cuenta (account_id NULL) no falla", async () => {
    const db = await base();
    await db.exec(`UPDATE user_data SET account_id=NULL`);
    const r = await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}') AS ok`);
    expect(r.rows[0].ok).toBe(true);
    expect(await cuenta(db)).toMatchObject({ plan: "free" });
  });
  it("nunca toca una cuenta managed", async () => {
    const db = await base({ plan: "managed", udPlan: "pro" });
    await actualizar(db, "pro", "active");
    expect((await cuenta(db)).plan).toBe("managed");
  });
});

describe("Pro Familiar ↔ Pro", () => {
  it("Pro Familiar → Pro: la cuenta pasa a pro con 3 cupos, los 5 miembros se quedan y no entra nadie más", async () => {
    const db = await base({ plan: "pro_familiar", udPlan: "pro_familiar" });
    await db.exec(`UPDATE accounts SET max_members=10`);
    for (const m of [M2, M3, M4, M5]) await agregarMiembro(db, m);
    await comoDueno(db);
    const inv = await db.query(`SELECT create_invitation('${ACC}', 'tarde@x.co', 'reader') AS r`);
    const r = await actualizar(db, "pro", "active");
    expect(r[0].action).toBe("downgraded_pro_familiar_to_pro");
    expect(await cuenta(db)).toMatchObject({ plan: "pro", max_members: 3, subscription_status: "active" });
    expect(await miembros(db)).toBe(5);
    await expect(invitar(db, "otra@x.co")).rejects.toThrow(/Cuenta llena/);
    // La invitación vieja tampoco puede entrar: la cuenta está llena
    await db.exec(`INSERT INTO auth.users(id, email) VALUES ('00000000-0000-4000-8000-000000000009', 'tarde@x.co');
                   SELECT set_config('test.uid', '00000000-0000-4000-8000-000000000009', false)`);
    await expect(db.query(`SELECT accept_invitation('${inv.rows[0].r.token}')`)).rejects.toThrow(/Cuenta llena/);
    const ud = await db.query(`SELECT plan, data->'p'->>'plan' bp FROM user_data WHERE id='${OWNER}'`);
    expect(ud.rows[0]).toEqual({ plan: "pro", bp: "pro" });
  });
  it("Pro → Pro Familiar mejora la misma cuenta (no crea otra) y conserva los miembros", async () => {
    const db = await base();
    await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
    await agregarMiembro(db, M2);
    const r = await actualizar(db, "pro_familiar", "active");
    expect(r[0].action).toBe("upgraded_to_pro_familiar");
    expect(r[0].account_id).toBe(ACC);
    expect(await cuenta(db)).toMatchObject({ plan: "pro_familiar", max_members: 10 });
    const n = await db.query(`SELECT count(*)::int n FROM accounts WHERE owner_user_id='${OWNER}'`);
    expect(n.rows[0].n).toBe(1);
    expect(await miembros(db)).toBe(2);
  });
});

describe("invitaciones durante la gracia", () => {
  for (const plan of ["pro", "pro_familiar"]) {
    it(`${plan} cancelado: no se invita ni se acepta una invitación vieja; los miembros se quedan`, async () => {
      const db = await base(plan === "pro" ? {} : { plan: "pro_familiar", udPlan: "pro_familiar" });
      if (plan === "pro") await db.query(`SELECT update_user_plan_after_stripe('${OWNER}', 'pro', '${CUS}')`);
      else await db.exec(`UPDATE accounts SET max_members=10`);
      await agregarMiembro(db, M2);
      await comoDueno(db);
      const inv = await db.query(`SELECT create_invitation('${ACC}', 'm3@x.co', 'reader') AS r`);
      await db.query(`SELECT * FROM handle_subscription_canceled('${CUS}', now())`);
      expect((await cuenta(db)).subscription_status).toBe("canceled");
      await expect(invitar(db, "m4@x.co")).rejects.toThrow(/cancelada/);
      await db.exec(`SELECT set_config('test.uid', '${M3}', false)`);
      await expect(db.query(`SELECT accept_invitation('${inv.rows[0].r.token}')`)).rejects.toThrow(/cancelada/);
      expect(await miembros(db)).toBe(2);
      // Reactivar dentro de la gracia vuelve a permitir invitar
      await actualizar(db, plan, "active");
      await db.exec(`DELETE FROM account_invitations`); // libera el cupo de la invitación vieja
      await comoDueno(db);
      await expect(invitar(db, "m4@x.co")).resolves.toBeTruthy();
    });
  }
});
