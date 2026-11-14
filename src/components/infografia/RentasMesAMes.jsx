// ═══════════════════════════════════════════════════════════════════════════
// RentasMesAMes — «¿Tus rentas alcanzan todos los meses?»
// 1-nov-2026. Barras: rentas de cada mes (azul, lo que producen tus activos).
// Línea: gastos e intereses. El mes actual es el protagonista; los demás se
// atenúan. Un mes donde las rentas no alcanzan se marca en naranja.
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { tx, nombreMes, esUS } from "../../lib/region.js";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const W = 760, H = 260, BASE = 220, TOPE = 30, BW = 34;
const pct = (n) => Math.round(n || 0) + (esUS() ? "%" : " %");
// 3-nov-2026: nombres de mes en el idioma de la sesión.
const mesLargo = (m) => tx(MES_LARGO[m - 1], nombreMes(m));
const mesCorto = (i) => tx(MES[i], nombreMes(i + 1, true));

export default function RentasMesAMes({ meses, mesActual }) {
  if (!Array.isArray(meses) || meses.length !== 12 || !meses.some((m) => m.ob > 0)) return null;
  const max = Math.max(...meses.map((m) => Math.max(m.ip, m.ob))) || 1;
  const k = (BASE - TOPE) / max;
  const paso = W / 12;
  const cx = (i) => paso * i + paso / 2;
  const conOb = meses.filter((m) => m.ob > 0);
  const peor = conOb.reduce((a, b) => (b.cobertura < a.cobertura ? b : a), conOb[0]);
  const mejor = conOb.reduce((a, b) => (b.cobertura > a.cobertura ? b : a), conOb[0]);
  const faltan = conOb.filter((m) => m.cobertura < 100);
  const marcados = new Set([mesActual, peor.mes, mejor.mes]);
  const puntos = meses.map((m, i) => `${cx(i).toFixed(1)},${(BASE - m.ob * k).toFixed(1)}`).join(" ");

  const conclusion = faltan.length === 0
    ? tx(`Tus rentas alcanzan los 12 meses. El más justo es ${MES_LARGO[peor.mes - 1]} (${pct(peor.cobertura)}).`, `Your passive income covers all 12 months. The tightest is ${mesLargo(peor.mes)} (${pct(peor.cobertura)}).`)
    : tx(`En ${faltan.length === 1 ? MES_LARGO[faltan[0].mes - 1] : `${faltan.length} meses`} tus rentas no alcanzan; el más justo es ${MES_LARGO[peor.mes - 1]} (${pct(peor.cobertura)}).`, `In ${faltan.length === 1 ? mesLargo(faltan[0].mes) : `${faltan.length} months`} your passive income falls short; the tightest is ${mesLargo(peor.mes)} (${pct(peor.cobertura)}).`);

  return (
    <section aria-label={tx("Rentas mes a mes", "Passive income by month")} style={{ ...tarjeta, marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>{tx("¿Tus rentas alcanzan todos los meses?", "Does your passive income cover every month?")}</h3>
        <div style={subtitulo}>{tx("Barras: tus rentas de cada mes. Línea: tus gastos e intereses de deudas.", "Bars: passive income each month. Line: expenses and debt interest.")} {conclusion}</div>
      </div>
      <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={conclusion} style={{ width: "100%", minWidth: 560, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
        <line x1="0" y1={BASE} x2={W} y2={BASE} style={{ stroke: "rgba(var(--fp-ink),0.12)" }} />
        <line x1="0" y1={(BASE + TOPE) / 2} x2={W} y2={(BASE + TOPE) / 2} style={{ stroke: "rgba(var(--fp-ink),0.05)" }} />
        {meses.map((m, i) => {
          const h = Math.max(0, m.ip * k);
          const actual = m.mes === mesActual;
          const corto = m.ob > 0 && m.cobertura < 100;
          return (
            <rect key={m.mes} className="fpi-barra" x={cx(i) - BW / 2} y={BASE - h} width={BW} height={h} rx="6"
              style={{
                animationDelay: `${i * 35}ms`,
                fill: corto ? trama(C.neg, actual ? 90 : 45) : actual ? C.azul : trama(C.azul, 38),
                filter: actual ? "drop-shadow(0 0 10px color-mix(in srgb, var(--fp-azul) 45%, transparent))" : "none",
              }}>
              <title>{tx(`${MES_LARGO[m.mes - 1]}: rentas ${pct(m.cobertura)} de tus gastos e intereses`, `${mesLargo(m.mes)}: passive income ${pct(m.cobertura)} of expenses and interest`)}</title>
            </rect>
          );
        })}
        <polyline className="fpi-fade" points={puntos} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: C.txt }} />
        {meses.map((m, i) => {
          if (!marcados.has(m.mes) || !(m.ob > 0)) return null;
          const actual = m.mes === mesActual;
          const y = Math.min(BASE - m.ip * k, BASE - m.ob * k) - 10;
          return (
            <text key={"p" + m.mes} x={cx(i)} y={Math.max(14, y)} textAnchor="middle" fontSize={actual ? 13 : 11} fontWeight={actual ? 600 : 400}
              style={{ fill: m.cobertura < 100 ? C.neg : actual ? C.pos : C.txt2, ...cifra }}>{pct(m.cobertura)}</text>
          );
        })}
        {meses.map((m, i) => (
          <text key={"m" + m.mes} x={cx(i)} y={BASE + 22} textAnchor="middle" fontSize="11" fontWeight={m.mes === mesActual ? 600 : 400}
            style={{ fill: m.mes === mesActual ? C.txt : C.txt3 }}>{mesCorto(i)}</text>
        ))}
      </svg>
      </div>
    </section>
  );
}
