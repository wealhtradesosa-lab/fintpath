// FINPATHIA · Motor de la secuencia de prueba (lo usa cron-lifecycle-trial.mjs).
// Separado del cron para poder probarlo y para que la función programada solo
// exporte lo que Netlify espera (default + config). Ver cabecera del cron.
import { elegirPaso, hoyCOT, diaUTC, conteosDesdeBlob, enmascararEmail } from "./pasos.mjs";
import { armarCorreo } from "./render.mjs";
import { firmarTokenBaja } from "./tokenBaja.mjs";
import { BASE_APP } from "./enlaces.mjs";

const fechaMas = (iso, dias) => new Date((diaUTC(iso) + dias) * 86400000).toISOString().slice(0, 10);

export async function correrSecuencia({ ahora = new Date(), env = process.env, fetchFn = fetch, enviar } = {}) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("[lifecycle] ❌ faltan SUPABASE_URL/SUPABASE_SERVICE_KEY");
    return { error: "config" };
  }
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const pedido = env.LIFECYCLE_EMAILS_ENABLED === "true";
  const secreto = env.EMAIL_UNSUB_SECRET || "";
  const real = pedido && !!secreto;
  if (pedido && !secreto) console.error("[lifecycle] ❌ LIFECYCLE_EMAILS_ENABLED=true pero falta EMAIL_UNSUB_SECRET: NO se envía nada (modo prueba)");
  const hoy = hoyCOT(ahora);
  console.log(`[lifecycle] hoy=${hoy} modo=${real ? "REAL" : "DRY RUN"}`);

  // 1) Cuentas free con trial_end en la ventana de la secuencia (d2 … d16).
  const desde = fechaMas(hoy, -2), hasta = fechaMas(hoy, 12);
  const cols = "id,owner_user_id,plan,subscription_status,created_at,trial_end,activated_at,advisor_first_used_at,seq_sent,last_seq_email,seq_variant,email_unsubscribed_at";
  const ra = await fetchFn(
    `${url}/rest/v1/accounts?select=${cols}&plan=eq.free&email_unsubscribed_at=is.null&trial_end=gte.${desde}&trial_end=lte.${hasta}&order=created_at.asc`,
    { headers: h });
  if (!ra.ok) { console.error("[lifecycle] query accounts falló:", ra.status, await ra.text()); return { error: "accounts" }; }
  const cuentas = await ra.json();
  if (!cuentas.length) { console.log("[lifecycle] ninguna cuenta en ventana"); return { candidatos: 0, resultados: [] }; }

  // 2) Correo, plan legacy y blob (solo para nombre y conteos) del dueño.
  const owners = [...new Set(cuentas.map((c) => c.owner_user_id))];
  const ru = await fetchFn(`${url}/rest/v1/user_data?select=id,email,plan,data&id=in.(${owners.join(",")})`, { headers: h });
  if (!ru.ok) { console.error("[lifecycle] query user_data falló:", ru.status); return { error: "user_data" }; }
  const porUsuario = new Map((await ru.json()).map((u) => [u.id, u]));

  // 3) Envíos previos registrados (reales y de prueba) de estas personas.
  const rs = await fetchFn(`${url}/rest/v1/lifecycle_email_sends?select=user_id,email_key,dry_run,error&user_id=in.(${owners.join(",")})`, { headers: h });
  const previos = rs.ok ? await rs.json() : [];
  if (!rs.ok) console.warn("[lifecycle] no pude leer lifecycle_email_sends:", rs.status);
  const yaPrueba = new Set(previos.filter((p) => p.dry_run).map((p) => `${p.user_id}|${p.email_key}`));
  const yaReal = new Set(previos.filter((p) => !p.dry_run && !p.error).map((p) => `${p.user_id}|${p.email_key.split("_")[0]}`));

  const registrar = async (fila) => {
    const r = await fetchFn(`${url}/rest/v1/lifecycle_email_sends`, {
      method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(fila),
    });
    if (!r.ok && r.status !== 409) console.warn("[lifecycle] insert lifecycle_email_sends falló:", r.status);
  };

  const vistos = new Set(); // una sola cuenta (y un solo correo) por persona por corrida
  const resultados = [];
  for (const c of cuentas) {
    if (vistos.has(c.owner_user_id)) continue;
    vistos.add(c.owner_user_id);
    const u = porUsuario.get(c.owner_user_id) || {};
    const decision = elegirPaso({ ...c, planUsuario: u.plan, email: u.email }, hoy);
    if (!decision.enviar) continue;
    if (yaReal.has(`${c.owner_user_id}|${decision.paso}`)) continue; // red de seguridad además de seq_sent

    const blob = u.data && typeof u.data === "object" ? u.data : null;
    let nombre = blob && !blob._encrypted ? (blob.p?.name || "") : "";
    if (!nombre && decision.clave === "d10_sin_asesor") nombre = await nombreDesdeAuth({ url, h, id: c.owner_user_id, fetchFn });
    const conteos = decision.clave === "d13_valor" ? conteosDesdeBlob(blob) : null;

    const token = real ? firmarTokenBaja(c.id, secreto) : "DRY-RUN";
    const urlBaja = `${BASE_APP}/api/email-unsubscribe?t=${encodeURIComponent(token)}`;
    const correo = armarCorreo({ clave: decision.clave, paso: decision.paso, utmContent: decision.utmContent, vars: { nombre, conteos }, urlBaja });

    const fila = {
      user_id: c.owner_user_id, email_key: decision.clave, utm_content: decision.utmContent,
      d13_variant: decision.varianteD13, dry_run: !real, resend_id: null, error: null,
    };

    if (!real) {
      console.log(`[lifecycle] (dry run) cuenta=${c.id} ${enmascararEmail(u.email)} → ${decision.clave} · "${correo.asunto}"`);
      if (!yaPrueba.has(`${c.owner_user_id}|${decision.clave}`)) await registrar(fila);
      resultados.push({ cuenta: c.id, clave: decision.clave, dryRun: true });
      continue;
    }

    let r;
    try {
      r = await enviar({
        to: u.email, subject: correo.asunto, html: correo.html, text: correo.texto, etiqueta: `lifecycle_${decision.clave}`, idempotencyKey: `lifecycle-${c.id}-${decision.paso}`,
        headers: {
          "List-Unsubscribe": `<${urlBaja}>, <mailto:soporte@finpathia.com?subject=baja>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    } catch (e) { r = { ok: false, error: String(e?.message || e) }; }

    if (!r?.ok || !r.sent) {
      fila.error = r?.error || r?.reason || "no_enviado";
      await registrar(fila);
      console.warn(`[lifecycle] ❌ cuenta=${c.id} ${decision.clave}: ${fila.error}`);
      resultados.push({ cuenta: c.id, clave: decision.clave, error: fila.error });
      continue;
    }
    fila.resend_id = r.message_id || null;
    await registrar(fila);

    const seqSent = { ...(c.seq_sent || {}), [decision.paso]: new Date().toISOString() };
    const cambios = { seq_sent: seqSent, last_seq_email: decision.clave };
    if (decision.varianteD13) cambios.seq_variant = decision.varianteD13;
    const rp = await fetchFn(`${url}/rest/v1/accounts?id=eq.${c.id}`, {
      method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(cambios),
    });
    if (!rp.ok) console.error(`[lifecycle] ⚠️ enviado pero no marcado cuenta=${c.id}:`, rp.status);
    console.log(`[lifecycle] ✅ cuenta=${c.id} ${enmascararEmail(u.email)} → ${decision.clave}`);
    resultados.push({ cuenta: c.id, clave: decision.clave, enviado: true });
  }
  console.log(`[lifecycle] fin · ${resultados.length} correo(s) ${real ? "enviados/intentados" : "simulados"}`);
  return { candidatos: cuentas.length, resultados, real };
}

async function nombreDesdeAuth({ url, h, id, fetchFn }) {
  try {
    const r = await fetchFn(`${url}/auth/v1/admin/users/${id}`, { headers: h });
    if (!r.ok) return "";
    const u = await r.json();
    return String(u?.user_metadata?.name || "");
  } catch { return ""; }
}

