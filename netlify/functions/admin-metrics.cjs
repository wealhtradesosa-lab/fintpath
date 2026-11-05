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
// ningún usuario. Los correos de quienes pagan sí se muestran (2-nov-2026):
// es el dueño viendo a sus clientes, como en el panel de Stripe o Mercado Pago.
// ════════════════════════════════════════════════════════════════════════════

const { ADMINS } = require("./_auth.cjs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    // 28-sep-2026: antes bastaba con mandar el correo de un admin en el body.
    // Ahora la identidad sale del token de sesión, verificado con Supabase.
    const { usuarioDesdeToken, esAdmin } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    if (!esAdmin(quien)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "No autorizado" }) };
    }
    const email = quien.email;

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
    const rd = await fetch(`${URL}/rest/v1/user_data?select=id,data,updated_at,plan,stripe_customer_id,account_id`, { headers: h });
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

    // ── 2-nov-2026 (Santiago: "cómo veo los registros por mes, no solo los
    // últimos, y quiénes han pagado por Mercado Pago, no solo Stripe").
    //
    // QUIÉN PAGÓ: los dos webhooks dejan la marca en user_data.stripe_customer_id
    // (nombre histórico de la columna): "cus_…" lo escribe Stripe y "mp_…" lo
    // escribe Mercado Pago (mp-webhook.cjs). Esa es la única marca que pone un
    // cobro real; el plan "pro" sin marca es la prueba de 14 días o un plan
    // asignado a mano. El estado (activa / cancelada) sale de accounts.
    const estadoCuenta = {};
    try {
      const rc = await fetch(`${URL}/rest/v1/accounts?select=id,subscription_status,grace_until,pago_unico`, { headers: h });
      if (rc.ok) (await rc.json()).forEach((a) => { estadoCuenta[a.id] = a; });
    } catch { /* sin estado: se muestra la marca sola */ }
    const correoDe = Object.fromEntries(usuarios.map((u) => [u.id, u.email]));
    const creadoDe = Object.fromEntries(usuarios.map((u) => [u.id, u.created_at]));
    const viaDe = (cid) => (String(cid || "").startsWith("mp_") ? "Mercado Pago" : String(cid || "").startsWith("cus_") ? "Stripe" : null);
    const pagadores = filas
      .filter((r) => viaDe(r.stripe_customer_id))
      .map((r) => {
        const cta = estadoCuenta[r.account_id] || {};
        // 5-nov-2026: pago único (PSE/Efecty) = "canceled" con fecha futura y pago_unico.
        const prepago = !!cta.pago_unico && cta.subscription_status === "canceled" && cta.grace_until && new Date(cta.grace_until) > new Date();
        const estado = prepago ? `pagado hasta ${String(cta.grace_until).slice(0, 10)}` : (cta.subscription_status || "—");
        return {
          email: correoDe[r.id] || "(sin correo)",
          via: viaDe(r.stripe_customer_id),
          plan: r.plan || r?.data?.p?.plan || "free",
          estado,
          vigente: (estado === "active" || prepago) && ["basico", "pro", "pro_familiar"].includes(r.plan || r?.data?.p?.plan),
          registro: creadoDe[r.id] || null,
          ultimoCambio: r.updated_at,
        };
      })
      .sort((a, b) => Number(b.vigente) - Number(a.vigente) || new Date(b.ultimoCambio) - new Date(a.ultimoCambio));
    pagos = pagadores.filter((x) => x.vigente).length;
    const pagosPorVia = {
      stripe: pagadores.filter((x) => x.vigente && x.via === "Stripe").length,
      mercadoPago: pagadores.filter((x) => x.vigente && x.via === "Mercado Pago").length,
    };
    // Planes pagos sin marca de cobro: asignados a mano o cuentas de prueba.
    const cortesia = filas
      .filter((r) => !viaDe(r.stripe_customer_id) && ["basico", "pro", "pro_familiar"].includes(r.plan) && !(r?.data?.p?.trialEnd && new Date(r.data.p.trialEnd) > new Date()))
      .map((r) => ({ email: correoDe[r.id] || "(sin correo)", plan: r.plan }));

    // Mercado Pago en vivo: las suscripciones (preapprovals) y su estado. Así se
    // ven también las que quedaron "pending" (la persona abrió el pago y no lo
    // terminó), que nunca llegan a la base. Si MP no responde, se sigue sin esto.
    //
    // 4-nov-2026 (Santiago: "¿será que no pueden pagar?"). El panel listaba una
    // fila por suscripción creada, y una sola persona que tocó el botón 8 veces
    // en 5 segundos aparecía como 7 intentos fallidos. Ahora es una fila por
    // persona: su mejor estado, cuántas veces abrió el pago y la última vez. Las
    // cuentas propias y de prueba (incluidos alias "+test") van aparte.
    const correoBase = (e) => String(e || "").toLowerCase().replace(/\+[^@]*@/, "@");
    const PROPIAS_MP = [...ADMINS, "santisosa@feelingcompany.com", "wealhtradesosa@gmail.com"].map(correoBase);
    const esInterno = (e) => PROPIAS_MP.includes(correoBase(e)) || /^qa\./i.test(e || "") || /@example\.com$/i.test(e || "");
    const RANGO_MP = { authorized: 4, paused: 3, cancelled: 2, pending: 1 };
    let mercadoPago = null;
    if (process.env.MP_ACCESS_TOKEN) {
      try {
        const r = await fetch("https://api.mercadopago.com/preapproval/search?limit=100&sort=date_created:desc", { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
        if (r.ok) {
          const j = await r.json();
          const lista = (j.results || []).filter((x) => String(x.reason || "").includes("FINPATHIA"));
          const porPersona = {};
          lista.forEach((x) => {
            const uid = String(x.external_reference || "").split("|")[0];
            const email = correoDe[uid] || x.payer_email || "(sin correo)";
            const k = uid || correoBase(email);
            const p = porPersona[k] || (porPersona[k] = { email, estado: x.status, plan: x.reason, monto: x?.auto_recurring?.transaction_amount || null, moneda: x?.auto_recurring?.currency_id || "COP", intentos: 0, primera: x.date_created, ultima: x.date_created, interno: esInterno(email) });
            p.intentos += 1;
            if ((RANGO_MP[x.status] || 0) > (RANGO_MP[p.estado] || 0)) { p.estado = x.status; p.plan = x.reason; p.monto = x?.auto_recurring?.transaction_amount || p.monto; }
            if (x.date_created > p.ultima) p.ultima = x.date_created;
            if (x.date_created < p.primera) p.primera = x.date_created;
          });
          const personas = Object.values(porPersona).sort((a, b) => Number(a.interno) - Number(b.interno) || (RANGO_MP[b.estado] || 0) - (RANGO_MP[a.estado] || 0) || String(b.ultima).localeCompare(String(a.ultima)));
          const externas = personas.filter((p) => !p.interno);
          const porEstado = {};
          externas.forEach((p) => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1; });
          mercadoPago = {
            total: externas.length,
            totalSuscripciones: lista.length,
            internas: personas.length - externas.length,
            porEstado,
            lista: personas.slice(0, 50).map((p) => ({ ...p, creada: p.ultima })),
          };
        } else mercadoPago = { error: `Mercado Pago respondió ${r.status}` };
      } catch (e) { mercadoPago = { error: "No se pudo consultar Mercado Pago" }; }
    }

    // ── ¿Vuelven? (2-nov-2026). Días distintos con la app abierta, por persona,
    // desde la renovación de sesión de Supabase Auth (RPC solo para service_role,
    // migración 20261102_admin_actividad_usuarios). Aproximado: una pestaña que
    // se queda abierta en segundo plano también cuenta.
    const actividad = {};
    try {
      const rr = await fetch(`${URL}/rest/v1/rpc/admin_actividad_usuarios`, { method: "POST", headers: h, body: "{}" });
      if (rr.ok) (await rr.json()).forEach((x) => { actividad[x.user_id] = x; });
    } catch { /* sin actividad: el panel lo dice */ }
    const volvio = (id) => (actividad[id]?.dias_que_volvio || 0) > 0;
    // Cuentas propias y de prueba no cuentan como "clientes que vuelven".
    const PROPIAS = [...ADMINS, "santisosa@feelingcompany.com", "wealhtradesosa@gmail.com"];
    const internos = new Set(usuarios.filter((u) => PROPIAS.includes(String(u.email || "").toLowerCase()) || /^qa\./i.test(u.email || "") || /@example\.com$/i.test(u.email || "")).map((u) => u.id));
    const losQueMasVuelven = usuarios
      .filter((u) => !internos.has(u.id) && volvio(u.id))
      .map((u) => ({ email: u.email, registro: u.created_at, diasQueVolvio: actividad[u.id].dias_que_volvio, ultimaVez: actividad[u.id].ultima_vez, activado: idsActivados.has(u.id), paga: false }))
      .sort((a, b) => b.diasQueVolvio - a.diasQueVolvio || String(b.ultimaVez).localeCompare(String(a.ultimaVez)))
      .slice(0, 15);

    // ── Registros por mes, desde el primer usuario: cuántos se registran, cuántos
    // cargan datos y cuántos tienen hoy un pago vigente. Cada mes trae la lista
    // de quienes se registraron (para abrirla en el panel).
    const vigentesIds = new Set(filas.filter((r) => viaDe(r.stripe_customer_id) && (estadoCuenta[r.account_id]?.subscription_status === "active" || (estadoCuenta[r.account_id]?.pago_unico && new Date(estadoCuenta[r.account_id]?.grace_until) > new Date())) && ["basico", "pro", "pro_familiar"].includes(r.plan)).map((r) => r.id));
    const porMesMap = {};
    usuarios.forEach((u) => {
      const k = (u.created_at || "").slice(0, 7);
      if (!k) return;
      const m = (porMesMap[k] = porMesMap[k] || { mes: k, registros: 0, activados: 0, volvieron: 0, pagan: 0, personas: [] });
      m.registros++;
      if (idsActivados.has(u.id)) m.activados++;
      if (volvio(u.id)) m.volvieron++;
      if (vigentesIds.has(u.id)) m.pagan++;
      m.personas.push({ email: u.email, creado: u.created_at, activado: idsActivados.has(u.id), diasQueVolvio: actividad[u.id]?.dias_que_volvio || 0, ultimaVez: actividad[u.id]?.ultima_vez || null, paga: vigentesIds.has(u.id), plan: planDe[u.id] || "free" });
    });
    // Meses sin registros también aparecen, para que un hueco se vea.
    const claves = Object.keys(porMesMap).sort();
    const porMes = [];
    if (claves.length) {
      let [y, m] = claves[0].split("-").map(Number);
      const fin = new Date().toISOString().slice(0, 7);
      for (let guard = 0; guard < 120; guard++) {
        const k = `${y}-${String(m).padStart(2, "0")}`;
        const v = porMesMap[k] || { mes: k, registros: 0, activados: 0, volvieron: 0, pagan: 0, personas: [] };
        v.personas.sort((a, b) => new Date(b.creado) - new Date(a.creado));
        porMes.push(v);
        if (k >= fin) break;
        m++; if (m > 12) { m = 1; y++; }
      }
    }

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
        pagosPorVia,
        pagadores,
        cortesia,
        mercadoPago,
        porMes,
        losQueMasVuelven,
        hayActividad: Object.keys(actividad).length > 0,
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
