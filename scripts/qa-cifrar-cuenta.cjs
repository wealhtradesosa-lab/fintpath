#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// QA · Cifra el user_data de UNA cuenta de prueba igual que el E2E de la app
// (AES-256-GCM, clave PBKDF2-SHA256 100000 iteraciones, salt = user id) para
// reproducir "datos cifrados sin desbloquear" en otro navegador.
// Solo cuentas de PRUEBA. Dry-run por defecto; guarda respaldo JSON antes.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//   node scripts/qa-cifrar-cuenta.cjs --email qa+cifrado@x.com --clave 'Clave123!' [--apply]
//   node scripts/qa-cifrar-cuenta.cjs --email qa+cifrado@x.com --restaurar qa-respaldo-....json [--apply]
// ═══════════════════════════════════════════════════════════════════════════
const fs = require("fs");
const { webcrypto } = require("crypto");
const subtle = webcrypto.subtle;
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes("--apply");
const email = (arg("--email") || "").trim().toLowerCase();
const pin = arg("--clave") || arg("--pin");
const restaurar = arg("--restaurar");
const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function cifrar(data, password, salt) {
  const enc = new TextEncoder();
  const km = await subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  const key = await subtle.deriveKey({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))));
  const all = new Uint8Array(iv.length + ct.length); all.set(iv); all.set(ct, iv.length);
  return Buffer.from(all).toString("base64");
}
async function rest(path, opts = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...opts, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
(async () => {
  if (!URL_ || !KEY) throw new Error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY");
  if (!email || (!pin && !restaurar)) throw new Error("Uso: --email <cuenta de prueba> (--clave <contraseña> | --restaurar <respaldo.json>) [--apply]");
  const filas = await rest(`user_data?email=eq.${encodeURIComponent(email)}&select=id,email,plan,data`);
  if (!filas || !filas.length) throw new Error("No hay user_data para " + email);
  const f = filas[0];
  let nuevo;
  if (restaurar) nuevo = JSON.parse(fs.readFileSync(restaurar, "utf8")).data;
  else {
    if (f.data && f.data._encrypted) throw new Error("Ya está cifrado");
    const respaldo = `qa-respaldo-${f.id}-${Date.now()}.json`;
    fs.writeFileSync(respaldo, JSON.stringify({ id: f.id, email: f.email, data: f.data }, null, 2));
    console.log("Respaldo:", respaldo);
    nuevo = { _encrypted: true, payload: await cifrar(f.data, pin, f.id) };
  }
  console.log(`${APPLY ? "ESCRIBIENDO" : "DRY-RUN"} · ${f.email} (${f.id}) · plan columna=${f.plan} · ${restaurar ? "restaurar" : "cifrar"}`);
  if (APPLY) await rest(`user_data?id=eq.${f.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: nuevo, updated_at: new Date().toISOString() }) });
  console.log(APPLY ? "Listo." : "Nada escrito (usa --apply).");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
