#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · backfill-stripe-userid.cjs — script de UNA sola vez.
//
// Completa metadata.userId en los customers de Stripe que tienen
// suscripciones y no lo tienen (creados antes del 26-sep-2026). El portal
// (stripe-customer-portal) solo asocia customers a usuarios por IDs puestos
// por el servidor, nunca por email.
//
// De dónde sale el userId, en este orden (debe dar UN solo usuario):
//   1. metadata.userId de las suscripciones del customer
//   2. user_data.stripe_customer_id (lo escribe el webhook)
//   3. Checkout Sessions del customer: client_reference_id / metadata.userId
// Si las fuentes no coinciden, el customer se reporta como CONFLICTO y no se
// toca.
//
// USO (por defecto NO escribe nada):
//   STRIPE_SECRET_KEY=sk_live_... SUPABASE_URL=https://xxx.supabase.co \
//   SUPABASE_SERVICE_KEY=... node scripts/backfill-stripe-userid.cjs
//   ... node scripts/backfill-stripe-userid.cjs --apply   ← escribe en Stripe
// ═══════════════════════════════════════════════════════════════════════════

const Stripe = require("stripe");

const APPLY = process.argv.includes("--apply");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mapaGuardados() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mapa = new Map(); // customerId → Set(userId)
  if (!url || !key) {
    console.warn("⚠️  Sin SUPABASE_URL/SUPABASE_SERVICE_KEY: no se usa user_data.stripe_customer_id");
    return mapa;
  }
  const r = await fetch(`${url}/rest/v1/user_data?select=id,stripe_customer_id&stripe_customer_id=not.is.null`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`user_data: HTTP ${r.status} ${await r.text()}`);
  for (const row of await r.json()) {
    if (!mapa.has(row.stripe_customer_id)) mapa.set(row.stripe_customer_id, new Set());
    mapa.get(row.stripe_customer_id).add(row.id);
  }
  return mapa;
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Falta STRIPE_SECRET_KEY");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log(`Modo: ${APPLY ? "APLICAR (escribe en Stripe)" : "DRY-RUN (no escribe nada)"} · clave ${process.env.STRIPE_SECRET_KEY.slice(0, 8)}…`);
  const guardados = await mapaGuardados();

  const res = { yaTenia: 0, sinSuscripcion: 0, completado: 0, conflicto: [], sinDato: [] };

  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (c.metadata && c.metadata.userId) { res.yaTenia++; continue; }
    const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 100 });
    if (!subs.data.length) { res.sinSuscripcion++; continue; }

    const candidatos = new Set();
    const fuentes = [];
    for (const s of subs.data) {
      const u = s.metadata && s.metadata.userId;
      if (u && UUID_RE.test(u)) { candidatos.add(u); fuentes.push(`sub:${s.id}`); }
    }
    for (const u of guardados.get(c.id) || []) { candidatos.add(u); fuentes.push("user_data"); }
    const ses = await stripe.checkout.sessions.list({ customer: c.id, limit: 100 });
    for (const x of ses.data) {
      if (x.status !== "complete") continue;
      for (const u of [x.client_reference_id, x.metadata && x.metadata.userId]) {
        if (u && UUID_RE.test(u)) { candidatos.add(u); fuentes.push(`session:${x.id}`); }
      }
    }

    if (candidatos.size === 0) { res.sinDato.push(`${c.id} (${c.email || "sin email"})`); continue; }
    if (candidatos.size > 1) { res.conflicto.push(`${c.id}: ${[...candidatos].join(", ")} ← ${fuentes.join(", ")}`); continue; }

    const userId = [...candidatos][0];
    console.log(`${APPLY ? "✏️ " : "🔎"} ${c.id} → userId=${userId} (${[...new Set(fuentes.map((f) => f.split(":")[0]))].join("+")})`);
    if (APPLY) await stripe.customers.update(c.id, { metadata: { userId } });
    res.completado++;
  }

  console.log("\n── Resumen ──");
  console.log(`Ya tenían metadata.userId: ${res.yaTenia}`);
  console.log(`Sin suscripciones (se ignoran): ${res.sinSuscripcion}`);
  console.log(`${APPLY ? "Completados" : "Se completarían"}: ${res.completado}`);
  console.log(`Conflictos (revisar a mano, no se tocan): ${res.conflicto.length}`);
  res.conflicto.forEach((l) => console.log("  · " + l));
  console.log(`Sin dato para asociar (revisar a mano): ${res.sinDato.length}`);
  res.sinDato.forEach((l) => console.log("  · " + l));
  if (!APPLY) console.log("\nNada se escribió. Para aplicar: agrega --apply");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
