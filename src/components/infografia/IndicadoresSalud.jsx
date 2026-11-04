// ═══════════════════════════════════════════════════════════════════════════
// IndicadoresSalud — «Indicadores de family office» como bullet graphs.
// 1-nov-2026 (Santiago: «toda esa sección de indicadores family office también
// la podrías mejorar»). Antes: 8 fichas iguales con semáforo de 3 colores.
// Ahora cada indicador es una barra con su rango ideal en trama gris y un
// marcador en el valor (bullet graph de Stephen Few). El color aparece solo
// cuando algo está fuera de rango (naranja); dentro de rango el marcador es
// negro/blanco y una nota verde corta lo dice.
//
// item: { l, valor (número o null), texto, max, ideal: [desde, hasta],
//         cerca: [desde, hasta] (zona de alerta, opcional), tip }
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { tx } from "../../lib/region.js";

const dentro = (v, [a, b]) => v >= a && v <= b;

function estado(it) {
  if (it.valor == null || !Number.isFinite(it.valor)) return "sin_dato";
  if (dentro(it.valor, it.ideal)) return "ok";
  if (it.cerca && dentro(it.valor, it.cerca)) return "cerca";
  return "fuera";
}
// 3-nov-2026: se lee al pintar, en el idioma de la sesión.
const rotulo = (e) => ({ ok: tx("En rango", "In range"), cerca: tx("Cerca del ideal", "Near ideal"), fuera: tx("Fuera del ideal", "Off target"), sin_dato: tx("Sin dato", "No data") })[e];

function Fila({ it, i }) {
  const e = estado(it);
  const pos = (v) => `${Math.max(0, Math.min(100, (v / it.max) * 100))}%`;
  const [a, b] = it.ideal;
  const colorEstado = e === "ok" ? C.pos : e === "fuera" ? C.neg : C.txt2;
  const marcador = e === "fuera" ? C.neg : C.txt;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13, color: C.txt }}>{it.l}</span>
        <span style={{ fontSize: 20, fontWeight: 600, color: e === "fuera" ? C.neg : C.txt, whiteSpace: "nowrap", ...cifra }}>{it.texto}</span>
      </div>
      <div role="img" aria-label={`${it.l}: ${it.texto}. ${rotulo(e)}. ${it.tip}`} style={{ position: "relative", height: 14 }}>
        <div style={{ position: "absolute", inset: "3px 0", borderRadius: 4, background: "rgba(var(--fp-ink),0.06)" }} />
        {it.cerca && <div style={{ position: "absolute", top: 3, bottom: 3, left: pos(it.cerca[0]), width: `calc(${pos(it.cerca[1])} - ${pos(it.cerca[0])})`, background: "rgba(var(--fp-ink),0.1)" }} />}
        <div style={{ position: "absolute", top: 3, bottom: 3, left: pos(a), width: `calc(${pos(b)} - ${pos(a)})`, borderRadius: 4, background: trama(C.azul, 30) }} />
        {e !== "sin_dato" && (
          <div className="fpi-fade" style={{
            position: "absolute", top: 0, bottom: 0, width: 4, borderRadius: 2, left: `calc(${pos(it.valor)} - 2px)`,
            background: marcador, animationDelay: `${i * 40}ms`,
            boxShadow: e === "fuera" ? "0 0 8px var(--fp-neg)" : "none",
          }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, lineHeight: 1.35 }}>
        <span style={{ color: C.txt3 }}>{it.tip}</span>
        <span style={{ color: colorEstado, whiteSpace: "nowrap", fontWeight: e === "fuera" ? 600 : 400 }}>{rotulo(e)}</span>
      </div>
    </div>
  );
}

export default function IndicadoresSalud({ items, nota }) {
  const lista = (items || []).filter(Boolean);
  if (!lista.length) return null;
  const fuera = lista.filter((it) => estado(it) === "fuera");
  return (
    <section aria-label={tx("Indicadores de family office", "Family office indicators")} style={{ ...tarjeta, marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h3 style={titulo}>{tx("¿Cómo están tus indicadores de family office?", "How are your family office indicators?")}</h3>
          <div style={subtitulo}>{tx("La franja azul es el rango ideal; la línea, tu valor.", "The blue band is the ideal range; the line is your value.")} {nota}</div>
        </div>
        <div style={{ fontSize: 13, color: fuera.length ? C.neg : C.pos, ...cifra }}>
          {fuera.length ? tx(`${fuera.length} fuera del ideal`, `${fuera.length} off target`) : tx("Todos en rango o cerca", "All in or near range")}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "22px 40px" }}>
        {lista.map((it, i) => <Fila key={it.l} it={it} i={i} />)}
      </div>
    </section>
  );
}
