// ════════════════════════════════════════════════════════════════════════════
// admin-metrics — El embudo de FINPATHIA, para el dueño del producto.
//
// POR QUÉ EXISTE (25-jul-2026): Santiago no tenía forma de ver su propio
// negocio. Cada "¿tengo usuarios nuevos?" obligaba a consultar Supabase a
// mano. Estaba ciego justo mientras pagaba pauta — y así fue como una caída
// del registro pasó 3 semanas sin detectarse.
//
// Responde 4 preguntas, en orden de importancia:
//   1. ¿Llega gente?        → registros por día
//   2. ¿Se queda?           → activación (cuántos cargan datos)
//   3. ¿Paga?               → suscripciones
//   4. ¿Dónde se cae?       → embudo paso a paso
//
// SEGURIDAD: usa la service key (solo servidor, nunca llega al navegador) y
// exige que el email pedido esté en la lista de admins. Devuelve únicamente
// AGREGADOS y correos de los últimos registros — nunca datos financieros de
// ningún usuario.
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
    const { email } = JSON.parse(event.body || "{}");
    if (!email || !ADMINS.includes(String(email).toLowerCase().trim())) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "No autorizado" }) };
    }

    const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!URL || !KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase no configurado" }) };

    const h = { "Authorization": `Bearer ${KEY}`, "apikey": KEY, "Content-Type": "application/json" };

    // ── Usuarios (auth admin API, paginado)
    let usuarios = [];
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: h });
      if (!r.ok) break;
      const d = await r.json();
      const lote = d.users || [];
      usuarios = usuarios.concat(lote);
      if (lote.length < 200) break;
    }

    // ── Datos cargados (para medir activación)
    const rd = await fetch(`${URL}/rest/v1/user_data?select=id,data,updated_at`, { headers: h });
    const filas = rd.ok ? await rd.json() : [];

    // Una cuenta está ACTIVADA si cargó al menos un dato real (no demo).
    const tieneDatos = (row) => {
      const d = row?.data;
      if (!d || d?.p?.demo) return false;
      const n =
        (d.inv || []).length +
        (d.ingresos || []).length +
        (d.deu || []).length +
        Object.values(d.gas || {}).reduce((s, its) => s + (its || []).length, 0);
      return n > 0;
    };
    const idsActivados = new Set(filas.filter(tieneDatos).map((r) => r.id));
    const planDe = {};
    filas.forEach((r) => { planDe[r.id] = r?.data?.p?.plan || "free"; });

    // ── Registros por día (últimos 30)
    const hoy = new Date();
    const dias = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(hoy.getTime() - i * 86400000);
      dias.push({ dia: dt.toISOString().split("T")[0], registros: 0 });
    }
    const idx = Object.fromEntries(dias.map((d, i) => [d.dia, i]));
    usuarios.forEach((u) => {
      const k = (u.created_at || "").split("T")[0];
      if (idx[k] !== undefined) dias[idx[k]].registros++;
    });

    const desde = (h) => new Date(Date.now() - h * 3600000);
    const nuevos = (h) => usuarios.filter((u) => new Date(u.created_at) > desde(h)).length;

    // ── Pagos REALES (25-jul-2026 — corrección: Santiago vio "73 pagos" sin
    // haber recibido un peso). Causa: al registrarse la app asigna
    // nd.p.plan="pro" a TODO el mundo — es el trial de 14 días, no una venta.
    // Contar ese campo inflaba "pagos" hasta casi el total de usuarios.
    // La única marca de pago real es la que deja el webhook de Stripe en la
    // tabla accounts: stripe_customer_id.
    let pagos = 0, trials = 0, cuentasLeidas = false, diag = null;
    try {
      const ra = await fetch(`${URL}/rest/v1/accounts?select=*`, { headers: h });
      if (ra.ok) {
        const cuentas = await ra.json();
        cuentasLeidas = true;
        // 25-jul-2026 — 3ª y última iteración. Historial de errores, para que
        // nadie repita el camino:
        //   1ª: contó data.p.plan → daba 73 "pagos" (era el trial de todos).
        //   2ª: contó stripe_customer_id → columna que NO existe: siempre 0.
        //   3ª: contó subscription_status "active" → daba 85, pero 82 de esas
        //       son plan "free": el campo arranca en "active" al crear la
        //       cuenta, no lo escribe Stripe.
        // CONCLUSIÓN: desde Supabase NO se puede saber quién paga. La verdad
        // vive en Stripe y esta app no tiene acceso. Mostramos lo que SÍ es
        // verificable (planes asignados) y mandamos a Stripe para los ingresos.
        // Mejor un dato ausente y señalado que un número inventado.
        const cuentaPor = (campo) => cuentas.reduce((o, a) => { const k = a?.[campo] || "(sin dato)"; o[k] = (o[k] || 0) + 1; return o; }, {});
        pagos = null; // desconocido a propósito
        diag = {
          filas: cuentas.length,
          porPlan: cuentaPor("plan"),
          conPlanPago: cuentas.filter((a) => a && ["pro", "pro_familiar", "basico"].includes(a.plan)).length,
        };
      }
    } catch { /* si la tabla no existe o cambia, pagos queda en 0 y se avisa */ }
    // Trials: tienen plan local "pro" pero ninguna marca de pago en Stripe.
    trials = Object.values(planDe).filter((p) => p === "pro" || p === "pro_familiar" || p === "basico").length;

    const ultimos = [...usuarios]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map((u) => ({
        email: u.email,
        creado: u.created_at,
        activado: idsActivados.has(u.id),
        plan: planDe[u.id] || "free",
      }));

    const total = usuarios.length;
    const activados = idsActivados.size;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total,
        activados,
        pagos,
        trials,
        cuentasLeidas,
        diag,
        tasaActivacion: total > 0 ? (activados / total) * 100 : 0,
        tasaPago: total > 0 ? (pagos / total) * 100 : 0,
        nuevos24h: nuevos(24),
        nuevos7d: nuevos(24 * 7),
        nuevos30d: nuevos(24 * 30),
        ultimoRegistro: usuarios.length
          ? [...usuarios].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
          : null,
        porDia: dias,
        ultimos,
        generado: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
