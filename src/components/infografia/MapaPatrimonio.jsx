// ═══════════════════════════════════════════════════════════════════════════
// MapaPatrimonio — «¿En qué está tu patrimonio?» (treemap)
// 1-nov-2026. Área = lo que vale cada clase; color = cuánto renta al año sobre
// lo que vale (tramas de azul: lo que tienes y lo que produce). Sin renta en
// gris; vehículos que valen menos de lo que costaron en naranja suave.
// La renta sale de los ingresos ligados al activo (por activoId o por el
// nombre en `fuente`) o, si no hay, de la tasa escrita en el activo.
// ═══════════════════════════════════════════════════════════════════════════

import { mapaPatrimonio, squarify, corto } from "../../lib/infografia.js";
import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";

const W = 760, H = 300;
const fmtPct = (n, d = 0) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }) + " %";

// Tramo de color por rentabilidad anual.
const tono = (c) => {
  if (c.estado === "pierde") return { fill: trama(C.neg, 30), txt: C.txt, sub: C.txt2 };
  if (c.estado !== "renta") return { fill: "rgba(var(--fp-ink),0.09)", txt: C.txt, sub: C.txt2 };
  if (c.rentaPct >= 12) return { fill: C.azul, txt: "#ffffff", sub: "rgba(255,255,255,0.82)" };
  if (c.rentaPct >= 5) return { fill: trama(C.azul, 55), txt: C.txt, sub: C.txt2 };
  return { fill: trama(C.azul, 30), txt: C.txt, sub: C.txt2 };
};
const lectura = (c) => (c.estado === "renta" ? `renta ${fmtPct(c.rentaPct, 1)} al año` : c.estado === "pierde" ? "pierde valor" : "sin renta");

export default function MapaPatrimonio({ met, fm }) {
  const mapa = mapaPatrimonio(met);
  if (!mapa || mapa.clases.length === 0) return null;
  const bloques = squarify(mapa.clases, { w: W, h: H, gap: 4 });
  const mayor = mapa.clases[0];
  const resumen = `Tu patrimonio de ${fm(mapa.total)}: ${mapa.clases.map((c) => `${c.nombre} ${fmtPct(c.pct)} (${lectura(c)})`).join("; ")}.`;

  return (
    <section aria-label="En qué está tu patrimonio" style={{ ...tarjeta, marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>¿En qué está tu patrimonio?</h3>
        <div style={subtitulo}>El área es lo que vale; el color, cuánto renta al año sobre lo que vale. {mayor.nombre} es el {fmtPct(mayor.pct)} de tus activos.</div>
      </div>
      <svg className="fpi-mapa" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumen} style={{ width: "100%", height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
        {bloques.map((b, i) => {
          const t = tono(b);
          const grande = b.w > 150 && b.h > 96;
          const medio = !grande && b.w > 78 && b.h > 64;
          const px = b.x + 14, py = b.y + 22;
          return (
            <g key={b.key} className="fpi-bloque fpi-fade" style={{ animationDelay: `${i * 50}ms` }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(12, b.w / 4, b.h / 4)} style={{ fill: t.fill }}>
                <title>{`${b.nombre}: ${fm(b.valor)} · ${fmtPct(b.pct)} · ${lectura(b)}`}</title>
              </rect>
              {grande && <>
                <text x={px} y={py + 2} fontSize="14" style={{ fill: t.txt }}>{corto(b.nombre, Math.floor(b.w / 8))}</text>
                <text x={px} y={py + 36} fontSize={b.w > 360 ? 32 : 24} fontWeight="600" style={{ fill: t.txt, ...cifra }}>{fm(b.valor)}</text>
                <text x={px} y={py + 58} fontSize="12" style={{ fill: t.sub }}>{fmtPct(b.pct)} · {lectura(b)}</text>
              </>}
              {medio && <>
                <text x={b.x + 10} y={b.y + 20} fontSize="11" style={{ fill: t.txt }}>{corto(b.nombre, Math.floor(b.w / 6.5))}</text>
                <text x={b.x + 10} y={b.y + 40} fontSize="13" fontWeight="600" style={{ fill: t.txt, ...cifra }}>{fmtPct(b.pct)}</text>
              </>}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "12px 20px" }}>
        {mapa.clases.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 2, borderRadius: 3, flexShrink: 0, background: tono(c).fill, border: "1px solid rgba(var(--fp-ink),0.12)" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.txt }}>{c.nombre}</div>
              <div style={{ fontSize: 12, color: C.txt2, ...cifra }}>{fm(c.valor)} · {lectura(c)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
