import { useState, useEffect } from "react";
import { fmtPctEs } from "../lib/formato.js";
import { fetchAuth } from "../lib/apiFetch";
import { normasPendientes, RESUMEN_VIGENCIA } from "../lib/vigenciaNormas.js";

/**
 * AdminMetrics — El embudo de FINPATHIA de un vistazo.
 *
 * Cuatro preguntas en orden: ¿llega gente? ¿se queda? ¿paga? ¿dónde se cae?
 * Solo agregados; no muestra datos financieros de ningún usuario.
 */
export default function AdminMetrics({ email, fmt, T }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [cargando, setCargando] = useState(true);
  const [mesSel, setMesSel] = useState(null);

  const cargar = () => {
    setCargando(true); setErr("");
    fetchAuth("/.netlify/functions/admin-metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => r.json())
      .then((j) => { if (j.error) setErr(j.error); else setD(j); })
      .catch((e) => setErr(e.message))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [email]);

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" };
  const num = (v) => (v || 0).toLocaleString("es-CO");
  const pct = (v) => fmtPctEs((v || 0), 1);
  const fecha = (s) => (s ? new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const diasSin = d?.ultimoRegistro ? Math.floor((Date.now() - new Date(d.ultimoRegistro)) / 86400000) : null;

  if (cargando) return <div style={{ ...card, textAlign: "center", color: T.tx3 }}>Cargando métricas…</div>;
  if (err) return <div style={{ ...card, color: "#fca5a5" }}>No se pudieron cargar las métricas: {err}</div>;
  if (!d) return null;

  const maxDia = Math.max(1, ...d.porDia.map((x) => x.registros));
  // 2-nov-2026: registros por mes (todos los meses desde el primer usuario) y
  // quién ha pagado, por Stripe o por Mercado Pago.
  const porMes = d.porMes || [];
  const maxMes = Math.max(1, ...porMes.map((x) => x.registros));
  const mesActivo = porMes.find((x) => x.mes === mesSel) || porMes[porMes.length - 1] || null;
  const nombreMes = (k, corto) => { if (!k) return ""; const [y, m] = k.split("-").map(Number); const t = new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: corto ? "short" : "long", year: corto ? "2-digit" : "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const ESTADO_MP = { authorized: ["Activa, cobrando", "#00c805"], pending: ["Abrió el pago y no lo terminó", T.tx3], paused: ["Pausada", "#f59e0b"], cancelled: ["Cancelada", "#ff5000"] };
  const ESTADO_CTA = { active: "activa", canceled: "cancelada", expired: "vencida", past_due: "pago atrasado" };
  const chipVia = (via) => <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: `1px solid ${T.border}`, color: T.tx2, whiteSpace: "nowrap" }}>{via}</span>;
  const pv = d.pagosPorVia || { stripe: 0, mercadoPago: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.tx }}>Cómo va el negocio</div>
          <div style={{ fontSize: 12, color: T.tx3 }}>Solo tú ves esto · actualizado {fecha(d.generado)}</div>
        </div>
        <button onClick={cargar} style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.tx2, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>↻ Actualizar</button>
      </div>

      {/* 28-oct-2026 — Normas DIAN al día: lo que vence y la última revisión del revisor semanal. */}
      {(() => {
        const pend = normasPendientes();
        const v = RESUMEN_VIGENCIA();
        const ok = pend.length === 0;
        return (
          <div style={{ background: ok ? T.gnB : T.rdB, border: `1px solid ${ok ? T.gn : T.rd}55`, borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ok ? T.gn : T.rd }}>{ok ? "Normas DIAN al día" : `${pend.length} norma${pend.length > 1 ? "s" : ""} por actualizar`}</div>
            {pend.map((p) => <div key={p.id} style={{ fontSize: 12, color: T.tx2, marginTop: 4 }}><b style={{ color: T.tx }}>{p.titulo}.</b> {p.detalle}</div>)}
            <div style={{ fontSize: 12, color: T.tx3, marginTop: 4 }}>Última revisión: {v.ultimaRevision} · UVT hasta {v.uvtHasta} · reajuste Art. 70 y tabla Art. 73 hasta {v.art70Hasta}</div>
          </div>
        );
      })()}

      {/* Alerta si el registro se detuvo — el síntoma que costó 3 semanas detectar */}
      {diasSin !== null && diasSin >= 3 && (
        <div style={{ background: "rgba(255,80,0,0.08)", border: "1px solid rgba(255,80,0,0.28)", borderRadius: 12, padding: "12px 14px", fontSize: 13, color: "#fca5a5" }}>
          <strong>Hace {diasSin} días que no se registra nadie.</strong> Si estás pautando, revisa que el registro funcione antes de seguir gastando.
        </div>
      )}

      {/* Titulares */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {[
          { l: "USUARIOS", v: num(d.total), c: T.tx, s: "total histórico" },
          { l: "HOY (24H)", v: num(d.nuevos24h), c: d.nuevos24h > 0 ? "#00c805" : T.tx3, s: "registros nuevos" },
          { l: "ÚLTIMOS 7 DÍAS", v: num(d.nuevos7d), c: d.nuevos7d > 0 ? "#00c805" : T.tx3, s: "registros" },
          { l: "PAGAN HOY", v: num(d.pagos), c: (d.pagos || 0) > 0 ? "#00c805" : T.tx3, s: `Stripe ${num(pv.stripe)} · Mercado Pago ${num(pv.mercadoPago)}` },
        ].map((k) => (
          <div key={k.l} style={card}>
            <div style={{ fontSize: 11, color: T.tx3, letterSpacing: 1, fontWeight: 700 }}>{k.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.c, marginTop: 2 }}>{k.v}</div>
            <div style={{ fontSize: 12, color: T.tx3 }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Embudo */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 12 }}>Dónde se cae la gente</div>
        {[
          { l: "Se registran", v: d.total, base: d.total, c: "#3b82f6" },
          { l: "Cargan sus datos", v: d.activados, base: d.total, c: "#f59e0b", nota: "activación" },
          { l: "En trial (gratis 14 días)", v: d.trials ?? 0, base: d.total, c: "#3b82f6", nota: "no es plata" },
          { l: "Pagan (Stripe o Mercado Pago)", v: d.pagos || 0, base: d.total, c: "#00c805", nota: "cobro confirmado" },
        ].map((p, i) => {
          const w = p.base > 0 ? (p.v / p.base) * 100 : 0;
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: T.tx2 }}>{p.l}{p.nota && <span style={{ color: T.tx3 }}> · {p.nota}</span>}</span>
                <span style={{ color: T.tx, fontWeight: 700, fontFamily: "monospace" }}>{num(p.v)} <span style={{ color: T.tx3, fontWeight: 400 }}>({pct(w)})</span></span>
              </div>
              <div style={{ height: 8, background: T.bg3, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: Math.max(w, 0.5) + "%", background: p.c, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 12, color: T.tx3, marginTop: 8, lineHeight: 1.5 }}>
          <strong>"Pagan" cuenta solo cobros confirmados</strong>: la marca que dejan los webhooks de Stripe y de Mercado Pago, con la suscripción activa. Un plan Pro sin esa marca es la prueba o un plan asignado a mano.
          <br />Y ojo con el <strong>trial</strong>: al registrarse, la app le da a todos 14 días de Pro. Eso no es una venta.
          <br />La <strong>activación</strong> es el número que más manda hoy: quien se registra y no carga nada, no vuelve. Si es baja, el problema está en el arranque, no en el precio ni en la pauta.
        </div>
      </div>

      {/* Registros por día */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 12 }}>Registros por día — últimos 30</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
          {d.porDia.map((x, i) => (
            <div key={i} title={`${x.dia}: ${x.registros}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: Math.max((x.registros / maxDia) * 100, x.registros > 0 ? 8 : 2) + "%", background: x.registros > 0 ? "#00c805" : T.bg3, borderRadius: 3 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.tx3, marginTop: 6 }}>
          <span>{d.porDia[0]?.dia}</span><span>hoy</span>
        </div>
      </div>

      {/* Registros por mes */}
      {porMes.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.tx }}>Registros por mes</div>
          <div style={{ fontSize: 12, color: T.tx3, marginBottom: 12 }}>Toca un mes para ver quién se registró. La parte de color fuerte es quien cargó datos.</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 110, overflowX: "auto", paddingBottom: 2 }}>
            {porMes.map((x) => {
              const on = mesActivo?.mes === x.mes;
              return (
                <button key={x.mes} type="button" onClick={() => setMesSel(x.mes)} title={`${nombreMes(x.mes)}: ${x.registros} registros, ${x.activados} cargaron datos`}
                  style={{ flex: "1 0 34px", minWidth: 34, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "stretch", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                  <span style={{ fontSize: 11, color: on ? T.tx : T.tx3, fontWeight: on ? 700 : 400, textAlign: "center", marginBottom: 3 }}>{x.registros}</span>
                  <span style={{ height: Math.max((x.registros / maxMes) * 78, x.registros > 0 ? 6 : 2) + "%", background: x.registros > 0 ? (on ? "rgba(0,200,5,0.35)" : "rgba(var(--fp-ink),0.12)") : T.bg3, borderRadius: 3, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", outline: on ? "2px solid #00c805" : "none" }}>
                    <span style={{ height: x.registros > 0 ? (x.activados / x.registros) * 100 + "%" : 0, background: on ? "#00c805" : "rgba(var(--fp-ink),0.35)" }} />
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 4 }}>
            {porMes.map((x) => <span key={x.mes} style={{ flex: "1 0 34px", minWidth: 34, fontSize: 11, color: mesActivo?.mes === x.mes ? T.tx : T.tx3, textAlign: "center" }}>{nombreMes(x.mes, true)}</span>)}
          </div>

          {mesActivo && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.tx }}>{nombreMes(mesActivo.mes)}</span>
                <span style={{ fontSize: 12, color: T.tx2 }}>
                  {num(mesActivo.registros)} registros · {num(mesActivo.activados)} cargaron datos ({pct(mesActivo.registros ? (mesActivo.activados / mesActivo.registros) * 100 : 0)}){d.hayActividad ? ` · ${num(mesActivo.volvieron)} volvieron otro día` : ""} · {num(mesActivo.pagan)} pagan
                </span>
              </div>
              {mesActivo.personas.length === 0 ? (
                <div style={{ fontSize: 12, color: T.tx3 }}>Nadie se registró este mes.</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {mesActivo.personas.map((u, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: T.tx2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
                      <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                        {u.paga && <span style={{ color: "#00c805", fontSize: 12, fontWeight: 700 }}>paga</span>}
                        <span style={{ color: u.activado ? "#00c805" : T.tx3, fontSize: 12 }}>{u.activado ? "cargó datos" : "sin datos"}</span>
                        {d.hayActividad && <span style={{ color: u.diasQueVolvio > 0 ? T.tx2 : T.tx3, fontSize: 12 }}>{u.diasQueVolvio > 0 ? `volvió ${u.diasQueVolvio} ${u.diasQueVolvio === 1 ? "día" : "días"}` : "no volvió"}</span>}
                        <span style={{ color: T.tx3, fontSize: 12 }}>{fecha(u.creado)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Los que más vuelven */}
      {d.hayActividad && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.tx }}>Los que más vuelven</div>
          <div style={{ fontSize: 12, color: T.tx3, marginBottom: 10 }}>Días distintos que abrieron la app después del día en que se registraron. Sin tus cuentas ni las de prueba. Aproximado: una pestaña que se queda abierta también cuenta.</div>
          {(d.losQueMasVuelven || []).length === 0 ? (
            <div style={{ fontSize: 13, color: T.tx2 }}>Nadie ha vuelto todavía después de registrarse.</div>
          ) : (
            d.losQueMasVuelven.map((u, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: T.tx, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
                <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                  <span style={{ color: T.tx, fontWeight: 700, fontFamily: "monospace" }}>{u.diasQueVolvio} {u.diasQueVolvio === 1 ? "día" : "días"}</span>
                  <span style={{ color: u.activado ? "#00c805" : T.tx3 }}>{u.activado ? "cargó datos" : "sin datos"}</span>
                  <span style={{ color: T.tx3 }}>última vez {u.ultimaVez ? new Date(u.ultimaVez + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—"}</span>
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quién ha pagado: Stripe y Mercado Pago */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx }}>Quién ha pagado</div>
        <div style={{ fontSize: 12, color: T.tx3, marginBottom: 10 }}>Clientes con un cobro confirmado por Stripe (dólares) o Mercado Pago (pesos).</div>
        {(d.pagadores || []).length === 0 ? (
          <div style={{ fontSize: 13, color: T.tx2 }}>Todavía nadie tiene un cobro confirmado por Stripe ni por Mercado Pago.</div>
        ) : (
          d.pagadores.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: T.tx, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                {chipVia(p.via)}
                <span style={{ color: T.tx2 }}>{p.plan}</span>
                <span style={{ color: p.vigente ? "#00c805" : "#ff5000", fontWeight: 700 }}>{p.vigente ? "activa" : (ESTADO_CTA[p.estado] || p.estado)}</span>
              </span>
            </div>
          ))
        )}

        {d.mercadoPago && (
          <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 4 }}>Mercado Pago en vivo</div>
            {d.mercadoPago.error ? (
              <div style={{ fontSize: 12, color: T.tx3 }}>{d.mercadoPago.error}. Lo de arriba sigue siendo correcto: sale de la base.</div>
            ) : (d.mercadoPago.lista || []).length === 0 ? (
              <div style={{ fontSize: 12, color: T.tx2 }}>Nadie ha abierto todavía una suscripción de FINPATHIA en Mercado Pago.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: T.tx2, marginBottom: 8, lineHeight: 1.5 }}>
                  {d.mercadoPago.total === 0
                    ? "Ningún cliente externo ha abierto el pago todavía."
                    : `${num(d.mercadoPago.total)} ${d.mercadoPago.total === 1 ? "persona" : "personas"}: ` + Object.entries(d.mercadoPago.porEstado || {}).map(([k, v]) => `${ESTADO_MP[k]?.[0] || k} ${v}`).join(" · ")}
                  {d.mercadoPago.internas > 0 ? ` · ${num(d.mercadoPago.internas)} ${d.mercadoPago.internas === 1 ? "cuenta tuya o de prueba" : "cuentas tuyas o de prueba"}, aparte` : ""}
                </div>
                {d.mercadoPago.lista.map((x, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: x.interno ? T.tx3 : T.tx2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{x.email}{x.interno ? " · tuya o de prueba" : ""}{x.intentos > 1 ? ` · abrió el pago ${x.intentos} veces` : ""}</span>
                    <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                      {x.monto != null && <span style={{ color: T.tx2, fontFamily: "monospace" }}>${Math.round(x.monto).toLocaleString("es-CO")} {x.moneda}</span>}
                      <span style={{ color: ESTADO_MP[x.estado]?.[1] || T.tx3, fontWeight: 700 }}>{ESTADO_MP[x.estado]?.[0] || x.estado}</span>
                      <span style={{ color: T.tx3 }}>{fecha(x.creada)}</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {(d.cortesia || []).length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: T.tx3, lineHeight: 1.5 }}>
            Con plan pago pero sin cobro (asignado a mano o cuenta interna): {d.cortesia.map((c) => `${c.email} (${c.plan})`).join(", ")}.
          </div>
        )}
      </div>
    </div>
  );
}
