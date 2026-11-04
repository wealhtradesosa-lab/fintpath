// ═══════════════════════════════════════════════════════════════════════════
// CaminoIndependencia — «¿En qué hito vas?»
// 1-nov-2026. Los 5 hitos de siempre (fondo de emergencia, libre de deudas,
// 50 % independencia, número FIRE, libertad absoluta) como una ruta: cada
// hito un anillo de avance unido por una línea; lo logrado en verde, el
// siguiente en azul, lo que falta en gris.
// hitos: [{ name, target, current }]
// ═══════════════════════════════════════════════════════════════════════════

import { C, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { tx, esUS } from "../../lib/region.js";

const R = 26, L = 2 * Math.PI * R;

export default function CaminoIndependencia({ hitos, fm }) {
  const lista = (hitos || []).filter((h) => h && h.target > 0);
  if (!lista.length) return null;
  const prog = lista.map((h) => Math.max(0, Math.min(100, (h.current / h.target) * 100)));
  const siguiente = prog.findIndex((p) => p < 100);
  const logrados = prog.filter((p) => p >= 100).length;

  return (
    <section aria-label={tx("Camino a la independencia financiera", "Path to financial independence")} style={{ ...tarjeta, marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h3 style={titulo}>{tx("¿En qué hito de tu independencia vas?", "Which independence milestone are you on?")}</h3>
          <div style={subtitulo}>
            {siguiente === -1 ? tx("Lograste los cinco hitos.", "You've hit all five milestones.") : tx(`Llevas ${logrados} de ${lista.length}. El siguiente: ${lista[siguiente].name.toLowerCase()}.`, `${logrados} of ${lista.length} done. Next: ${lista[siguiente].name}.`)}
          </div>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <div aria-hidden="true" className="fpi-solo-escritorio" style={{ position: "absolute", left: "10%", right: "10%", top: 34, height: 2, background: "rgba(var(--fp-ink),0.1)" }} />
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 20, position: "relative" }}>
          {lista.map((h, i) => {
            const p = prog[i], hecho = p >= 100, actual = i === siguiente;
            const color = hecho ? C.pos : actual ? C.azul : C.txt3;
            return (
              <li key={h.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
                <svg viewBox="0 0 68 68" width="68" height="68" role="img" aria-label={`${h.name}: ${hecho ? tx("logrado", "done") : Math.round(p) + (esUS() ? "%" : " %")}`}>
                  <circle cx="34" cy="34" r={R + 6} style={{ fill: "var(--fp-card)" }} />
                  <circle cx="34" cy="34" r={R} fill="none" strokeWidth="6" style={{ stroke: "rgba(var(--fp-ink),0.08)" }} />
                  <circle className="fpi-arco" cx="34" cy="34" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
                    transform="rotate(-90 34 34)"
                    style={{ stroke: color, strokeDasharray: `${(p / 100) * L} ${L}`, "--fpi-largo": ((p / 100) * L).toFixed(1), animationDelay: `${i * 60}ms`,
                      filter: actual ? "drop-shadow(0 0 6px var(--fp-azul))" : "none" }} />
                  {hecho
                    ? <path d="M24 34.5l7 7 13-14" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: C.pos }} />
                    : <text x="34" y="38.5" textAnchor="middle" fontSize="13" fontWeight="600" style={{ fill: actual ? C.txt : C.txt2, ...cifra }}>{Math.round(p)}%</text>}
                </svg>
                <div style={{ fontSize: 13, color: hecho || actual ? C.txt : C.txt2, fontWeight: actual ? 600 : 400, lineHeight: 1.3 }}>{h.name}</div>
                <div style={{ fontSize: 12, color: hecho ? C.pos : C.txt3, ...cifra }}>{hecho ? tx("Logrado", "Done") : tx(`meta ${fm(h.target)}`, `goal ${fm(h.target)}`)}</div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
