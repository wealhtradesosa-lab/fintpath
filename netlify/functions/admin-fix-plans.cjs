// ════════════════════════════════════════════════════════════════════════════
// admin-fix-plans — Bajar a "free" a quien tiene Pro sin pagarlo.
//
// CONTEXTO (25-jul-2026): el signup guardaba data.p.plan="pro" de forma
// permanente. Al vencer el trial, la resolución caía en ese campo y el acceso
// Pro no expiraba NUNCA. Ya se corrigió para usuarios nuevos (a4943d1), pero
// los que se registraron antes conservan "pro" guardado.
// Santiago: "no me sirve que los clientes estén en pro indefinido sin pagar".
//
// SEGURIDAD Y CUIDADO — esto REVOCA accesos, así que:
//   · dryRun=true por defecto: no escribe nada, solo reporta a quién tocaría.
//   · Nunca toca a quien tenga plan de pago real en la tabla accounts
//     (pro / pro_familiar / basico): esos son suscriptores o asignaciones
//     manuales legítimas.
//   · Nunca toca a quien tenga el trial VIGENTE.
//   · Nunca toca cuentas demo.
//   · Solo modifica data.p.plan. No borra ni altera ningún dato financiero.
// ════════════════════════════════════════════════════════════════════════════

const ADMINS = ["santiagososa1@me.com", "ajimenez001@gmail.com"];

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const { email } = body;
    const dryRun = body.dryRun !== false; // por defecto NO escribe

    if (!email || !ADMINS.includes(String(email).toLowerCase().trim())) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "No autorizado" }) };
    }

    const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!URL || !KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase no configurado" }) };
    const h = { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" };

    // Cuentas con plan de pago REAL → intocables
    const ra = await fetch(`${URL}/rest/v1/accounts?select=id,owner_user_id,plan`, { headers: h });
    const cuentas = ra.ok ? await ra.json() : [];
    const protegidos = new Set(
      cuentas
        .filter((a) => ["pro", "pro_familiar", "basico"].includes(a?.plan))
        .map((a) => a?.owner_user_id)
        .filter(Boolean)
    );

    const rd = await fetch(`${URL}/rest/v1/user_data?select=id,data`, { headers: h });
    if (!rd.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: "No se pudo leer user_data" }) };
    const filas = await rd.json();

    const hoy = new Date();
    const aBajar = [];
    const conservan = [];

    for (const row of filas) {
      const d = row?.data;
      if (!d || !d.p) continue;
      const plan = d.p.plan || "free";
      const email_ = d.p.email || "(sin email)";

      if (plan === "free") continue;                        // ya está bien
      if (d.p.demo) { conservan.push({ email: email_, motivo: "demo" }); continue; }
      if (protegidos.has(row.id)) { conservan.push({ email: email_, motivo: "plan pago real" }); continue; }
      if (ADMINS.includes(String(email_).toLowerCase())) { conservan.push({ email: email_, motivo: "admin" }); continue; }

      const trialEnd = d.p.trialEnd ? new Date(d.p.trialEnd) : null;
      if (trialEnd && trialEnd >= hoy) {
        conservan.push({ email: email_, motivo: `trial vigente hasta ${d.p.trialEnd}` });
        continue;
      }

      aBajar.push({ id: row.id, email: email_, planActual: plan, trialVencido: d.p.trialEnd || "(sin fecha)" });
    }

    let aplicados = 0;
    const errores = [];
    if (!dryRun) {
      for (const u of aBajar) {
        const fila = filas.find((f) => f.id === u.id);
        const nuevo = { ...fila.data, p: { ...fila.data.p, plan: "free" } };
        const r = await fetch(`${URL}/rest/v1/user_data?id=eq.${u.id}`, {
          method: "PATCH",
          headers: { ...h, Prefer: "return=minimal" },
          body: JSON.stringify({ data: nuevo, updated_at: new Date().toISOString() }),
        });
        if (r.ok) aplicados++;
        else errores.push({ email: u.email, status: r.status });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        dryRun,
        totalRevisados: filas.length,
        aBajar: aBajar.length,
        conservanAcceso: conservan.length,
        aplicados,
        errores,
        detalleABajar: aBajar.slice(0, 100),
        detalleConservan: conservan.slice(0, 20),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
