// ═══════════════════════════════════════════════════════════════════════════
// LineaDeudas — «¿Cuándo quedas libre de deudas?»
// 1-nov-2026. Línea de tiempo crédito por crédito (pagando la cuota de hoy):
// cuándo termina cada uno y la cuota que te devuelve. La deuda se desvanece en
// naranja hacia la fecha final; la meta brilla en verde. En celular, lista.
// Debajo, el orden sugerido por avalancha (mayor tasa) y bola de nieve (menor
// saldo), que ya vivían en la tarjeta anterior.
// ═══════════════════════════════════════════════════════════════════════════

import { planDeudas, corto } from "../../lib/infografia.js";
import { C, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { tx, localeTexto, localeCifras, esUS } from "../../lib/region.js";

const W = 1000, X0 = 14, X1 = 980, Y = 92;
// 3-nov-2026: fechas en el idioma de la sesión.
const mesAnio = (d) => d.toLocaleDateString(localeTexto(), { month: "short", year: "numeric" }).replace(".", "");
const mesAnioLargo = (d) => d.toLocaleDateString(localeTexto(), { month: "long", year: "numeric" });

export default function LineaDeudas({ deudas, trm, fm }) {
  const plan = planDeudas(deudas, { trm });
  if (!plan.filas.length) return null;
  const x = (m) => X0 + (m / Math.max(1, plan.meses)) * (X1 - X0);
  // Etiquetas alternadas arriba/abajo; dos alturas si quedan pegadas.
  let ultimoX = [-1e9, -1e9];
  const marcas = plan.filas.map((f, i) => {
    const lado = i % 2;
    const px = x(f.meses);
    const alto = px - ultimoX[lado] < 190 ? 1 : 0;
    ultimoX[lado] = px;
    return { ...f, px, lado, alto, final: i === plan.filas.length - 1 };
  });
  const tasa = [...plan.filas].sort((a, b) => b.tasa - a.tasa);
  const saldo = [...plan.filas].sort((a, b) => a.saldo - b.saldo);
  const fmtTasa = (t) => (t || 0).toLocaleString(localeCifras(), { maximumFractionDigits: 1 }) + (esUS() ? "% APR" : " %");

  return (
    <section aria-label={tx("Camino a cero deudas", "Path to zero debt")} style={{ ...tarjeta, marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
        <div>
          <h3 style={titulo}>{tx("¿Cuándo quedas libre de deudas?", "When will you be debt-free?")}</h3>
          <div style={subtitulo}>{tx("Pagando las cuotas de hoy. Cada crédito que termina te devuelve su cuota.", "Paying today's amounts. Each loan you finish frees up its payment.")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: C.txt2 }}>{tx("Libre de deudas", "Debt-free")}</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: C.txt, ...cifra }}>{mesAnioLargo(plan.fecha)}</div>
        </div>
      </div>

      <div className="fpi-solo-escritorio" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} 190`} role="img" aria-label={tx(`Libre de deudas en ${mesAnioLargo(plan.fecha)}: ${plan.filas.map((f) => `${f.nombre} en ${mesAnioLargo(f.fecha)}`).join(", ")}`, `Debt-free by ${mesAnioLargo(plan.fecha)}: ${plan.filas.map((f) => `${f.nombre} in ${mesAnioLargo(f.fecha)}`).join(", ")}`)}
          style={{ width: "100%", minWidth: 720, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
          <defs>
            <linearGradient id="fpi-grad-deuda" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" style={{ stopColor: C.neg, stopOpacity: 1 }} />
              <stop offset="1" style={{ stopColor: C.neg, stopOpacity: 0.12 }} />
            </linearGradient>
          </defs>
          <line x1={X0} y1={Y} x2={X1} y2={Y} strokeWidth="10" strokeLinecap="round" style={{ stroke: "rgba(var(--fp-ink),0.07)" }} />
          <line className="fpi-arco" x1={X0} y1={Y} x2={X1} y2={Y} strokeWidth="10" strokeLinecap="round" style={{ stroke: "url(#fpi-grad-deuda)", "--fpi-largo": X1 - X0 }} />
          <circle cx={X0} cy={Y} r="7" style={{ fill: C.txt }} />
          <text x={X0} y={Y + 32} fontSize="11" style={{ fill: C.txt2 }}>{tx("hoy", "today")}</text>
          <text x={X0} y={Y + 48} fontSize="12" fontWeight="600" style={{ fill: C.neg, ...cifra }}>{fm(plan.cuotaTotal)}{tx("/mes", "/mo")}</text>
          {marcas.map((m) => {
            const arriba = m.lado === 0;
            const dy = m.alto ? 30 : 0;
            const yN = arriba ? Y - 36 - dy : Y + 32 + dy;
            const anchor = m.final ? "end" : m.px < 80 ? "start" : "middle";
            const tX = m.final ? m.px + 4 : m.px;
            return (
              <g key={m.nombre + m.meses}>
                {(m.alto || !arriba) && <line x1={m.px} y1={arriba ? yN + 18 : Y + 10} x2={m.px} y2={arriba ? Y - 10 : yN - 14} style={{ stroke: "rgba(var(--fp-ink),0.14)" }} />}
                <circle className="fpi-fade" cx={m.px} cy={Y} r={m.final ? 10 : 8} strokeWidth="3"
                  style={{ fill: m.final ? C.pos : "var(--fp-card)", stroke: C.pos, filter: m.final ? "drop-shadow(0 0 10px var(--fp-pos))" : "none" }} />
                <text x={tX} y={arriba ? yN - 14 : yN} textAnchor={anchor} fontSize="12" style={{ fill: C.txt }}>{corto(m.nombre, 34)}</text>
                <text x={tX} y={arriba ? yN + 2 : yN + 16} textAnchor={anchor} fontSize="11" style={{ fill: C.txt2 }}>
                  {mesAnio(m.fecha)} · <tspan fontWeight="600" style={{ fill: C.pos, ...cifra }}>+{fm(m.cuota)}</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ol className="fpi-solo-movil" style={{ listStyle: "none", margin: 0, padding: 0, flexDirection: "column", gap: 12 }}>
        {plan.filas.map((f, i) => (
          <li key={f.nombre + i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 3, borderRadius: 6, flexShrink: 0, border: `3px solid var(--fp-pos)`, background: i === plan.filas.length - 1 ? C.pos : "transparent" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.txt }}>{f.nombre}</div>
              <div style={{ fontSize: 12, color: C.txt2 }}>{mesAnioLargo(f.fecha)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.pos, whiteSpace: "nowrap", ...cifra }}>+{fm(f.cuota)}</span>
          </li>
        ))}
      </ol>

      {plan.filas.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 20, paddingTop: 16, borderTop: `1px solid ${C.linea}` }}>
          {[[tx("Avalancha: primero la de mayor tasa", "Avalanche: highest rate first"), tx("Ahorras más intereses.", "Saves the most interest."), tasa, (f) => fmtTasa(f.tasa)],
            [tx("Bola de nieve: primero la más pequeña", "Snowball: smallest balance first"), tx("Ves resultados más rápido.", "Quicker wins."), saldo, (f) => fm(f.saldo)]].map(([t, s, lista, dato]) => (
            <div key={t}>
              <div style={{ fontSize: 13, color: C.txt, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 12, color: C.txt3, marginBottom: 8 }}>{s}</div>
              {lista.slice(0, 4).map((f, i) => (
                <div key={f.nombre + i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "5px 0", borderBottom: `1px solid ${C.linea}` }}>
                  <span style={{ color: i === 0 ? C.txt : C.txt2, fontWeight: i === 0 ? 600 : 400 }}>{i + 1}. {f.nombre}</span>
                  <span style={{ color: C.txt2, ...cifra }}>{dato(f)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {plan.noAmortizan > 0 && (
        <div style={{ fontSize: 12.5, color: C.neg }}>
          {tx(<>{plan.noAmortizan === 1 ? "Una cuota no alcanza" : `${plan.noAmortizan} cuotas no alcanzan`} a cubrir el interés: a ese ritmo no se termina de pagar. Revisa la cuota o la tasa.</>, <>{plan.noAmortizan === 1 ? "One payment doesn't" : `${plan.noAmortizan} payments don't`} cover the interest: at that pace the debt never gets paid off. Check the payment or the rate.</>)}
        </div>
      )}
    </section>
  );
}
