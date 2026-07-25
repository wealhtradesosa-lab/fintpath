import { useState, useEffect } from "react";

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

  const cargar = () => {
    setCargando(true); setErr("");
    fetch("/.netlify/functions/admin-metrics", {
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

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" };
  const num = (v) => (v || 0).toLocaleString("es-CO");
  const pct = (v) => (v || 0).toFixed(1) + "%";
  const fecha = (s) => (s ? new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const diasSin = d?.ultimoRegistro ? Math.floor((Date.now() - new Date(d.ultimoRegistro)) / 86400000) : null;

  if (cargando) return <div style={{ ...card, textAlign: "center", color: T.tx3 }}>Cargando métricas…</div>;
  if (err) return <div style={{ ...card, color: "#fca5a5" }}>No se pudieron cargar las métricas: {err}</div>;
  if (!d) return null;

  const maxDia = Math.max(1, ...d.porDia.map((x) => x.registros));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.tx }}>📈 Cómo va el negocio</div>
          <div style={{ fontSize: 11, color: T.tx3 }}>Solo vos ves esto · actualizado {fecha(d.generado)}</div>
        </div>
        <button onClick={cargar} style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.tx2, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>↻ Actualizar</button>
      </div>

      {/* Alerta si el registro se detuvo — el síntoma que costó 3 semanas detectar */}
      {diasSin !== null && diasSin >= 3 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: 12, padding: "12px 14px", fontSize: 12.5, color: "#fca5a5" }}>
          ⚠️ <strong>Hace {diasSin} días que no se registra nadie.</strong> Si estás pautando, revisá que el registro funcione antes de seguir gastando.
        </div>
      )}

      {/* Titulares */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {[
          { l: "USUARIOS", v: num(d.total), c: T.tx, s: "total histórico" },
          { l: "HOY (24H)", v: num(d.nuevos24h), c: d.nuevos24h > 0 ? "#22c55e" : T.tx3, s: "registros nuevos" },
          { l: "ÚLTIMOS 7 DÍAS", v: num(d.nuevos7d), c: d.nuevos7d > 0 ? "#22c55e" : T.tx3, s: "registros" },
          { l: "PAGOS", v: num(d.pagos), c: d.pagos > 0 ? "#22c55e" : T.tx3, s: "con plan activo" },
        ].map((k) => (
          <div key={k.l} style={card}>
            <div style={{ fontSize: 9.5, color: T.tx3, letterSpacing: 1, fontWeight: 700 }}>{k.l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.c, marginTop: 2 }}>{k.v}</div>
            <div style={{ fontSize: 10.5, color: T.tx3 }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* Embudo */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 12 }}>Dónde se cae la gente</div>
        {[
          { l: "Se registran", v: d.total, base: d.total, c: "#3b82f6" },
          { l: "Cargan sus datos", v: d.activados, base: d.total, c: "#eab308", nota: "activación" },
          { l: "Pagan", v: d.pagos, base: d.total, c: "#22c55e" },
        ].map((p, i) => {
          const w = p.base > 0 ? (p.v / p.base) * 100 : 0;
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: T.tx2 }}>{p.l}{p.nota && <span style={{ color: T.tx3 }}> · {p.nota}</span>}</span>
                <span style={{ color: T.tx, fontWeight: 700, fontFamily: "monospace" }}>{num(p.v)} <span style={{ color: T.tx3, fontWeight: 400 }}>({pct(w)})</span></span>
              </div>
              <div style={{ height: 8, background: T.bg3, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: Math.max(w, 0.5) + "%", background: p.c, borderRadius: 99 }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: T.tx3, marginTop: 8, lineHeight: 1.5 }}>
          La <strong>activación</strong> es el número que más manda hoy: quien se registra y no carga nada, no vuelve. Si es baja, el problema está en el arranque, no en el precio ni en la pauta.
        </div>
      </div>

      {/* Registros por día */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 12 }}>Registros por día — últimos 30</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
          {d.porDia.map((x, i) => (
            <div key={i} title={`${x.dia}: ${x.registros}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: Math.max((x.registros / maxDia) * 100, x.registros > 0 ? 8 : 2) + "%", background: x.registros > 0 ? "#22c55e" : T.bg3, borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.tx3, marginTop: 6 }}>
          <span>{d.porDia[0]?.dia}</span><span>hoy</span>
        </div>
      </div>

      {/* Últimos registros */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 10 }}>Últimos registros</div>
        {d.ultimos.length === 0 ? (
          <div style={{ fontSize: 12, color: T.tx3 }}>Todavía no hay usuarios.</div>
        ) : (
          d.ultimos.map((u, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none", fontSize: 12, gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: T.tx2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                <span style={{ color: u.activado ? "#22c55e" : T.tx3, fontSize: 11 }}>{u.activado ? "✓ cargó datos" : "sin datos"}</span>
                <span style={{ color: T.tx3, fontSize: 11 }}>{fecha(u.creado)}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
