// ═══════════════════════════════════════════════════════════════════════════
// FireNumero — «¿Cuánto necesitas para no trabajar más?»
// 1-nov-2026. Antes vivía plegado en «Ver el análisis detallado». Ahora a la
// vista: cifra grande, barra de avance (azul → verde) con «Hoy» marcado y el
// año en que llegarías al ritmo de ahorro actual (añosParaMeta, 5 % real).
// Regla: gastos mensuales × 12 × 25 (regla del 4 %), la misma de siempre.
// ═══════════════════════════════════════════════════════════════════════════

import { C, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtAniosEs } from "../../lib/formato.js";
import { tx, esUS } from "../../lib/region.js";

const aniosEn = (a) => String(Math.round(a * 10) / 10);
const pctTxt = (n) => Math.round(n) + (esUS() ? "%" : " %");

export default function FireNumero({ fireNumber, nw, anios, ahorroMes, fm }) {
  if (!(fireNumber > 0)) return null;
  const pct = Math.max(0, (nw / fireNumber) * 100);
  const listo = pct >= 100;
  const ancho = Math.min(100, pct);
  const anioLlegada = anios != null ? new Date().getFullYear() + Math.ceil(anios) : null;

  return (
    <section aria-label={tx("Número FIRE", "FIRE number")} style={{ ...tarjeta, marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "flex-end" }}>
        <div>
          <h3 style={titulo}>{tx("¿Cuánto necesitas para no trabajar más?", "How much do you need to stop working?")}</h3>
          <div style={subtitulo}>{tx("Tu número FIRE: tus gastos de un año × 25 (la regla del 4 %).", "Your FIRE number: one year of expenses × 25 (the 4% rule).")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", color: C.txt, ...cifra }}>{fm(fireNumber)}</div>
          <div style={{ fontSize: 12, color: C.txt2 }}>{tx("tu número FIRE", "your FIRE number")}</div>
        </div>
      </div>

      <div role="img" aria-label={tx(`Llevas el ${Math.round(pct)} % de tu número FIRE`, `You're ${pctTxt(pct)} of the way to your FIRE number`)} style={{ position: "relative", paddingTop: 26 }}>
        <div style={{ height: 14, borderRadius: 7, background: "rgba(var(--fp-ink),0.07)", overflow: "hidden" }}>
          <div className="fpi-barra-h" style={{ height: "100%", width: `${ancho}%`, borderRadius: 7, background: "linear-gradient(90deg, var(--fp-azul), var(--fp-pos))" }} />
        </div>
        <div style={{ position: "absolute", top: 0, left: `clamp(0px, calc(${ancho}% - 30px), calc(100% - 60px))`, width: 60, textAlign: "center", fontSize: 13, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>
          {pctTxt(pct)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 16 }}>
        <div><div style={{ fontSize: 12, color: C.txt2 }}>{tx("Tienes hoy", "You have today")}</div><div style={{ fontSize: 18, fontWeight: 600, color: C.txt, ...cifra }}>{fm(nw)}</div></div>
        <div><div style={{ fontSize: 12, color: C.txt2 }}>{listo ? tx("Te sobra", "Surplus") : tx("Te falta", "To go")}</div><div style={{ fontSize: 18, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>{fm(Math.abs(fireNumber - nw))}</div></div>
        <div>
          <div style={{ fontSize: 12, color: C.txt2 }}>{listo ? tx("Estado", "Status") : tx("Llegarías", "You'd get there")}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: listo ? C.pos : C.txt, ...cifra }}>
            {listo ? tx("Ya lo alcanzaste", "You've reached it") : anioLlegada ? tx(`hacia ${anioLlegada}`, `around ${anioLlegada}`) : tx("sin fecha", "no date yet")}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: C.txt3, lineHeight: 1.5 }}>
        {listo
          ? tx("Tu patrimonio ya cubre 25 años de tus gastos: vivir de él es una opción.", "Your net worth already covers 25 years of expenses: living off it is an option.")
          : anios != null
            ? tx(`En ${anios < 1 ? "menos de 1" : fmtAniosEs(anios)} años, ${ahorroMes > 0 ? `ahorrando ${fm(ahorroMes)} al mes` : "solo con tu patrimonio de hoy"} y un rendimiento real del 5 % anual.`, `In ${anios < 1 ? "less than 1" : aniosEn(anios)} years, ${ahorroMes > 0 ? `saving ${fm(ahorroMes)} a month` : "with only today's net worth"} and a 5% real annual return.`)
            : tx("Con tu ahorro de hoy no se proyecta una fecha: el primer paso es que cada mes sobre algo.", "At today's savings there's no projected date: the first step is having something left over each month.")}
      </div>
    </section>
  );
}
