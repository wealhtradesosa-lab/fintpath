// ═══════════════════════════════════════════════════════════════════════════
// ConcentracionActivos — «¿Qué tan concentrado estás?» (Patrimonio)
// 1-nov-2026. Tus activos más grandes como una barra al 100 %: el mayor en
// azul pleno, los siguientes en tramas, el resto agrupado en gris. Si un solo
// activo pasa del 30 % del patrimonio se dice en naranja (mismo umbral del
// indicador de concentración del Dashboard).
// activos: [{ id, nombre, valor }] en pesos.
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";

const UMBRAL = 30;
const pct = (n) => Math.round(n).toLocaleString("es-CO") + " %";

export default function ConcentracionActivos({ activos, fm, max = 5 }) {
  const lista = (activos || []).filter((a) => a.valor > 0).sort((a, b) => b.valor - a.valor);
  if (lista.length < 2) return null;
  const total = lista.reduce((s, a) => s + a.valor, 0);
  const top = lista.slice(0, max).map((a) => ({ ...a, pct: (a.valor / total) * 100 }));
  const resto = lista.slice(max);
  const restoValor = resto.reduce((s, a) => s + a.valor, 0);
  const segmentos = [...top, ...(resto.length ? [{ id: "_resto", nombre: `Otros ${resto.length}`, valor: restoValor, pct: (restoValor / total) * 100, resto: true }] : [])];
  const mayor = top[0];
  const alta = mayor.pct > UMBRAL;
  const tono = (s, i) => (s.resto ? "rgba(var(--fp-ink),0.14)" : i === 0 ? (alta ? C.neg : C.azul) : trama(C.azul, Math.max(22, 70 - i * 12)));
  const top3 = top.slice(0, 3).reduce((s, a) => s + a.pct, 0);

  return (
    <section aria-label="Concentración del patrimonio" style={{ ...tarjeta, marginBottom: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h3 style={titulo}>¿Qué tan concentrado estás?</h3>
          <div style={subtitulo}>
            Tus {top.length} activos más grandes sobre el total. Tus 3 mayores suman el {pct(top3)}.
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: alta ? C.neg : C.pos }}>
          {alta ? `${mayor.nombre} es el ${pct(mayor.pct)}` : "Ningún activo pasa del 30 %"}
        </div>
      </div>

      <div role="img" aria-label={segmentos.map((s) => `${s.nombre} ${pct(s.pct)}`).join(", ")}
        style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden", gap: 2 }}>
        {segmentos.map((s, i) => (
          <div key={s.id} className="fpi-barra-h" title={`${s.nombre}: ${fm(s.valor)} · ${pct(s.pct)}`}
            style={{ flex: `${s.pct} 0 0`, minWidth: 3, background: tono(s, i), animationDelay: `${i * 40}ms`, display: "flex", alignItems: "center", paddingLeft: 10, boxSizing: "border-box", overflow: "hidden" }}>
            {s.pct >= 12 && <span style={{ fontSize: 12, fontWeight: 600, color: i === 0 && !s.resto ? "#ffffff" : C.txt, whiteSpace: "nowrap", ...cifra }}>{pct(s.pct)}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: "10px 20px" }}>
        {segmentos.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 3, borderRadius: 3, flexShrink: 0, background: tono(s, i) }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.nombre}>{s.nombre}</div>
              <div style={{ fontSize: 12, color: C.txt2, ...cifra }}>{fm(s.valor)} · {pct(s.pct)}</div>
            </div>
          </div>
        ))}
      </div>
      {alta && (
        <div style={{ fontSize: 12.5, color: C.txt3, lineHeight: 1.5 }}>
          Cuando un solo activo pesa más del 30 %, un problema en él (vacancia, una mala venta, un cambio de norma) mueve todo tu patrimonio.
        </div>
      )}
    </section>
  );
}
