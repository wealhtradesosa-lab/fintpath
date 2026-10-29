// Piezas compartidas de las pantallas de renta: «Historial de declaraciones» y
// «Lo que viene». Solo tokens de designTokens (sin colores ni tamaños nuevos).
import { C, Cα, F, R } from "../lib/designTokens";
import { mm, ultimaDeclaracion } from "../lib/rentaDesdeDeclaracion.js";

export const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 16 };
// Misma altura para casillas y listas: antes la lista desplegable salía más alta y nada alineaba.
export const inp = { width: "100%", boxSizing: "border-box", height: 42, margin: 0, background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "0 12px", fontSize: 14, lineHeight: "normal", outline: "none" };
const mono = "ui-monospace, 'SF Mono', Menlo, monospace";

export function Panel({ titulo, sub, children, style }) {
  return (
    <section style={{ ...card, ...style }}>
      {titulo && <h2 style={{ ...F.h2, marginBottom: sub ? 4 : 10 }}>{titulo}</h2>}
      {sub && <p style={{ ...F.caption, marginBottom: 10 }}>{sub}</p>}
      {children}
    </section>
  );
}

/**
 * Bienvenida de cada página: qué puede hacer por ti y el paso a paso.
 * `pasos`: [{ t, hecho }]. Si todo está hecho se muestra compacta.
 */
export function Bienvenida({ titulo, potencial = [], pasos = [], accion }) {
  const listo = pasos.length && pasos.every((p) => p.hecho);
  return (
    <section style={{ ...card, background: Cα.accent08, borderColor: Cα.accent25 }}>
      <div style={{ ...F.h3, color: C.accent, marginBottom: 6 }}>{listo ? "✓ Todo listo" : "Cómo funciona"}</div>
      {!listo && titulo && <div style={{ ...F.h2, marginBottom: 8 }}>{titulo}</div>}
      {!listo && potencial.length > 0 && (
        <ul style={{ ...F.body, margin: "0 0 12px", paddingLeft: 18, display: "grid", gap: 4 }}>
          {potencial.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
        {pasos.map((p, i) => (
          <li key={p.t} style={{ flex: "1 1 200px", display: "flex", gap: 8, alignItems: "flex-start", background: C.surface, border: `1px solid ${p.hecho ? Cα.ok25 : C.border}`, borderRadius: R.md, padding: "8px 10px" }}>
            <span style={{ ...F.h3, minWidth: 22, height: 22, borderRadius: R.pill, display: "inline-flex", alignItems: "center", justifyContent: "center", background: p.hecho ? C.ok : C.raised, color: p.hecho ? C.bg : C.muted }}>{p.hecho ? "✓" : i + 1}</span>
            <span style={{ ...F.body, color: p.hecho ? C.muted : C.text }}>{p.t}</span>
          </li>
        ))}
      </ol>
      {accion && !listo && (
        <button type="button" onClick={accion.onClick} style={{ marginTop: 12, padding: "9px 14px", borderRadius: R.md, border: "none", background: C.accent, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{accion.label}</button>
      )}
    </section>
  );
}

/** Botones con cada titular (persona o sociedad) y su última declaración; opción del grupo. */
export function SelectorTitular({ owners, value, onChange, conGrupo = true }) {
  const items = owners.map((o) => {
    const d = ultimaDeclaracion(o);
    return { id: o.id, nombre: o.name || "Sin nombre", sub: `${o.type === "juridica" ? "Sociedad" : "Persona natural"} · ${d ? `${d.tipo === "F110" ? "F-110" : "F-210"} ${d.anoGravable}` : "sin declaración cargada"}` };
  });
  if (conGrupo && owners.length > 1) items.push({ id: "grupo", nombre: "Todo el grupo familiar", sub: `${owners.length} titulares, cada uno por separado` });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onChange(it.id)} aria-pressed={value === it.id}
          style={{ textAlign: "left", cursor: "pointer", minWidth: 180, padding: "10px 14px", borderRadius: R.lg,
            border: `1px solid ${value === it.id ? C.accent : C.border}`, background: value === it.id ? Cα.accent15 : C.raised, color: C.text }}>
          <div style={{ ...F.h3, fontSize: 14 }}>{it.nombre}</div>
          <div style={F.caption}>{it.sub}</div>
        </button>
      ))}
    </div>
  );
}

export function Kpi({ k, v, d, color }) {
  return (
    <div style={{ background: C.raised, borderRadius: R.lg, padding: "12px 14px", display: "grid", gap: 3 }}>
      <span style={{ ...F.caption, fontWeight: 600, color: C.muted }}>{k}</span>
      <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 20, color: color || C.text }}>{v}</span>
      {d && <span style={F.caption}>{d}</span>}
    </div>
  );
}
export const KpiGrid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>{children}</div>;

const corto = (v) => "$" + Math.round((Number(v) || 0) / 1e6).toLocaleString("es-CO");

/** Barras agrupadas o apiladas por año. Desde el índice `desde`, barras punteadas (proyección). */
export function Barras({ anos, series, apilar = false, fmt = corto, desde = 99 }) {
  const W = 420, H = 210, L = 8, B = 26, T = 22;
  const tot = anos.map((_, i) => apilar ? series.reduce((a, s) => a + (s.v[i] || 0), 0) : Math.max(...series.map((s) => s.v[i] || 0)));
  const mx = Math.max(...tot, 1), gw = (W - L * 2) / anos.length;
  const bw = apilar ? Math.min(46, gw * 0.5) : Math.min(30, (gw * 0.7) / series.length);
  const y = (v) => ((H - B - T) * v) / mx;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
        <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke={C.border} />
        {anos.map((a, i) => {
          const cx = L + gw * i + gw / 2, proy = i >= desde;
          let acc = 0;
          const barras = series.map((s, j) => {
            const v = s.v[i] || 0, h = Math.max(0, y(v));
            const st = proy ? { opacity: 0.4, stroke: C.text, strokeDasharray: "3 3" } : {};
            if (apilar) { const yy = H - B - y(acc) - h; acc += v; return <rect key={j} x={cx - bw / 2} y={yy} width={bw} height={h} rx={3} fill={s.c} {...st} />; }
            const x = cx - (bw * series.length + 4 * (series.length - 1)) / 2 + j * (bw + 4);
            return (<g key={j}><rect x={x} y={H - B - h} width={bw} height={h} rx={3} fill={s.c} {...st} />
              <text x={x + bw / 2} y={H - B - h - 5} textAnchor="middle" fill={C.text} style={{ font: `600 10px ${mono}` }}>{fmt(v)}</text></g>);
          });
          return (<g key={a}>{barras}
            {apilar && <text x={cx} y={H - B - y(acc) - 6} textAnchor="middle" fill={C.text} style={{ font: `600 10px ${mono}` }}>{fmt(acc)}</text>}
            <text x={cx} y={H - 7} textAnchor="middle" fill={C.subtle} style={{ font: "500 11px system-ui" }}>{a}</text></g>);
        })}
      </svg>
      <Leyenda series={series} />
    </div>
  );
}
export function Linea({ anos, v, fmt, desde = 99, color = C.ok }) {
  const W = 420, H = 210, px = 40, T = 30, B = 28;
  const mx = Math.max(...v), mn = Math.min(Math.min(...v), mx * 0.7), rg = mx - mn || mx || 1;
  const X = (i) => (anos.length === 1 ? W / 2 : px + (i * (W - 2 * px)) / (anos.length - 1)), Y = (x) => T + (H - T - B) * (1 - (x - mn) / rg);
  const real = v.slice(0, Math.min(desde, v.length)).map((x, i) => `${X(i)},${Y(x)}`).join(" ");
  const proy = desde < v.length ? [desde - 1, ...v.slice(desde).map((_, j) => desde + j)].map((i) => `${X(i)},${Y(v[i])}`).join(" ") : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img">
      <polyline fill="none" stroke={color} strokeWidth={2.4} points={real} />
      {proy && <polyline fill="none" stroke={color} strokeWidth={2.2} strokeDasharray="5 4" points={proy} />}
      {v.map((x, i) => (<g key={i}>
        <circle cx={X(i)} cy={Y(x)} r={4} fill={i >= desde ? C.raised : C.surface} stroke={color} strokeWidth={2} />
        <text x={X(i)} y={Y(x) - 10} textAnchor="middle" fill={C.text} style={{ font: `600 10px ${mono}` }}>{fmt(x)}</text>
        <text x={X(i)} y={H - 8} textAnchor="middle" fill={C.subtle} style={{ font: "500 11px system-ui" }}>{anos[i]}</text></g>))}
    </svg>
  );
}
export function Leyenda({ series }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
      {series.map((s) => <span key={s.n} style={{ ...F.caption, color: C.muted }}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: s.c, marginRight: 5 }} />{s.n}</span>)}
    </div>
  );
}
export function Grafica({ titulo, sub, children }) {
  return (
    <figure style={{ margin: 0, background: C.raised, borderRadius: R.lg, padding: 12 }}>
      <figcaption style={F.h3}>{titulo}</figcaption>
      {sub && <div style={{ ...F.caption, marginTop: 2, marginBottom: 6 }}>{sub}</div>}
      {children}
    </figure>
  );
}

export function Plata({ value, onChange, id, placeholder = "$0" }) {
  const txt = value ? Math.round(Number(value)).toLocaleString("es-CO") : "";
  return <input id={id} inputMode="numeric" style={inp} placeholder={placeholder} value={txt ? "$" + txt : ""}
    onChange={(ev) => { const d = ev.target.value.replace(/[^0-9]/g, ""); onChange(d ? Number(d) : 0); }} />;
}
// Etiqueta con alto fijo de dos líneas y pegada abajo: así todas las casillas de una fila
// quedan en la misma línea aunque una etiqueta sea corta y otra larga.
export function Campo({ label, ayuda, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ ...F.caption, fontWeight: 600, color: C.muted, minHeight: 31, display: "flex", alignItems: "flex-end" }}>{label}</span>
      {children}
      {ayuda && <span style={F.caption}>{ayuda}</span>}
    </label>
  );
}
// Máximo 4 columnas: con pantallas anchas salían 7 casillas apretadas en una fila.
export const Grid = ({ children, min = 220 }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(max(${min}px, calc((100% - 43px) / 4)), 1fr))`, gap: "16px 14px", alignItems: "start" }}>{children}</div>;
export const Aviso = ({ tipo = "warn", children }) => (
  <div style={{ ...F.body, color: C.text, background: tipo === "ok" ? Cα.ok08 : tipo === "info" ? Cα.accent08 : Cα.warn08, border: `1px solid ${tipo === "ok" ? Cα.ok25 : tipo === "info" ? Cα.accent25 : Cα.warn25}`, borderRadius: R.md, padding: "10px 12px" }}>{children}</div>
);
export { mm };
