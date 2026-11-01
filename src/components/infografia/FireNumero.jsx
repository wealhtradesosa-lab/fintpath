// ═══════════════════════════════════════════════════════════════════════════
// FireNumero — «¿Cuánto necesitas para no trabajar más?»
// 1-nov-2026. Antes vivía plegado en «Ver el análisis detallado». Ahora a la
// vista: cifra grande, barra de avance (azul → verde) con «Hoy» marcado y el
// año en que llegarías al ritmo de ahorro actual (añosParaMeta, 5 % real).
// Regla: gastos mensuales × 12 × 25 (regla del 4 %), la misma de siempre.
// ═══════════════════════════════════════════════════════════════════════════

import { C, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtAniosEs } from "../../lib/formato.js";

export default function FireNumero({ fireNumber, nw, anios, ahorroMes, fm }) {
  if (!(fireNumber > 0)) return null;
  const pct = Math.max(0, (nw / fireNumber) * 100);
  const listo = pct >= 100;
  const ancho = Math.min(100, pct);
  const anioLlegada = anios != null ? new Date().getFullYear() + Math.ceil(anios) : null;

  return (
    <section aria-label="Número FIRE" style={{ ...tarjeta, marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "flex-end" }}>
        <div>
          <h3 style={titulo}>¿Cuánto necesitas para no trabajar más?</h3>
          <div style={subtitulo}>Tu número FIRE: tus gastos de un año × 25 (la regla del 4 %).</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", color: C.txt, ...cifra }}>{fm(fireNumber)}</div>
          <div style={{ fontSize: 12, color: C.txt2 }}>tu número FIRE</div>
        </div>
      </div>

      <div role="img" aria-label={`Llevas el ${Math.round(pct)} % de tu número FIRE`} style={{ position: "relative", paddingTop: 26 }}>
        <div style={{ height: 14, borderRadius: 7, background: "rgba(var(--fp-ink),0.07)", overflow: "hidden" }}>
          <div className="fpi-barra-h" style={{ height: "100%", width: `${ancho}%`, borderRadius: 7, background: "linear-gradient(90deg, var(--fp-azul), var(--fp-pos))" }} />
        </div>
        <div style={{ position: "absolute", top: 0, left: `clamp(0px, calc(${ancho}% - 30px), calc(100% - 60px))`, width: 60, textAlign: "center", fontSize: 13, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>
          {Math.round(pct)} %
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 16 }}>
        <div><div style={{ fontSize: 12, color: C.txt2 }}>Tienes hoy</div><div style={{ fontSize: 18, fontWeight: 600, color: C.txt, ...cifra }}>{fm(nw)}</div></div>
        <div><div style={{ fontSize: 12, color: C.txt2 }}>{listo ? "Te sobra" : "Te falta"}</div><div style={{ fontSize: 18, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>{fm(Math.abs(fireNumber - nw))}</div></div>
        <div>
          <div style={{ fontSize: 12, color: C.txt2 }}>{listo ? "Estado" : "Llegarías"}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>
            {listo ? "Ya lo alcanzaste" : anioLlegada ? `hacia ${anioLlegada}` : "sin fecha"}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: C.txt3, lineHeight: 1.5 }}>
        {listo
          ? "Tu patrimonio ya cubre 25 años de tus gastos: vivir de él es una opción."
          : anios != null
            ? `En ${anios < 1 ? "menos de 1" : fmtAniosEs(anios)} años, ${ahorroMes > 0 ? `ahorrando ${fm(ahorroMes)} al mes` : "solo con tu patrimonio de hoy"} y un rendimiento real del 5 % anual.`
            : "Con tu ahorro de hoy no se proyecta una fecha: el primer paso es que cada mes sobre algo."}
      </div>
    </section>
  );
}
