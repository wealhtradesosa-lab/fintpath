// ═══════════════════════════════════════════════════════════════════════════
// MedidorLibertad — «¿Tus rentas ya pagan tu vida?»
// 1-nov-2026. Reemplaza la frase + barra plana del Dashboard por un medidor en
// arco (cobertura pasiva = ingreso pasivo neto ÷ gastos y cuotas) y la
// escalera de los 5 niveles con «Tú» marcado. Cifras de cT → metMes, las
// mismas que usan el nivel, el Simulador y el Asesor.
// ═══════════════════════════════════════════════════════════════════════════

import { NIVELES } from "../../lib/metrics.js";
import { escalaMedidor, puntoArco, nombreNivel, descNivel } from "../../lib/infografia.js";
import { tx, localeCifras } from "../../lib/region.js";
import { C, trama, tarjeta, cifra, CSS_INFOGRAFIA } from "./estilos.js";

const R = 128, CX = 160, CY = 160;
const fmtPct = (n) => Math.round(n || 0).toLocaleString(localeCifras()) + (localeCifras() === "en-US" ? "%" : " %");

// 13-nov-2026 — `partes`, `caja` y `fin` salen de lib/desgloseLibertad.js: la cifra
// contra la que se mide el nivel se abre en sus partes, el abono a capital se
// dice como ahorro y la caja del mes queda al lado (un nivel alto no puede
// esconder un mes en que la plata no alcanza).
export default function MedidorLibertad({ cobertura = 0, ip = 0, ob = 0, nivel, fm, extra = null, partes = null, caja = null, fin: finD = null }) {
  if (!(ob > 0)) return null;
  const max = escalaMedidor(cobertura);
  const p = puntoArco(cobertura, max, { cx: CX, cy: CY, r: R });
  const ini = puntoArco(0, max, { cx: CX, cy: CY, r: R });
  const fin = puntoArco(max, max, { cx: CX, cy: CY, r: R });
  const largo = Math.PI * R * Math.min(1, Math.max(0, cobertura) / max);
  const n = nivel && nivel.nivel ? nivel.nivel : null;
  const ok = cobertura >= 100;
  const dif = ip - ob;

  // Marcas de los umbrales reales del motor (nivelLibertad): Seguridad (lo
  // esencial), Independencia (100 %) y Abundancia (200 %).
  const pctEsencial = nivel && nivel.obEsencial > 0 && nivel.obEsencial < ob ? (nivel.obEsencial / ob) * 100 : null;
  const marcas = [
    pctEsencial != null && { pct: pctEsencial, et: nombreNivel(NIVELES[2]) },
    { pct: 100, et: nombreNivel(NIVELES[3]) },
    { pct: (NIVELES[4].factor || 2) * 100, et: nombreNivel(NIVELES[4]) },
  ].filter(Boolean);

  return (
    <section aria-label={tx("Nivel de libertad financiera", "Financial freedom level")} style={{ ...tarjeta, display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", marginBottom: 20 }}>
      <style>{CSS_INFOGRAFIA}</style>

      <svg viewBox="-28 -44 376 252" role="img"
        aria-label={tx(`Tus rentas cubren el ${fmtPct(cobertura)} de tus gastos y cuotas${n ? `; nivel ${NIVELES[n - 1].nombre}` : ""}`, `Your passive income covers ${fmtPct(cobertura)} of your expenses and debt payments${n ? `; level ${nombreNivel(NIVELES[n - 1])}` : ""}`)}
        style={{ flex: "1 1 260px", maxWidth: 340, width: "100%", height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
        <defs>
          <linearGradient id="fpi-grad-arco" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: C.azul, stopOpacity: 1 }} />
            <stop offset="1" style={{ stopColor: C.pos, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path d={`M${ini.x},${ini.y} A${R},${R} 0 0 1 ${fin.x},${fin.y}`} fill="none" strokeWidth="20" strokeLinecap="round" style={{ stroke: C.pista }} />
        {cobertura > 0 && (
          <path className="fpi-arco" d={`M${ini.x},${ini.y} A${R},${R} 0 0 1 ${p.x.toFixed(1)},${p.y.toFixed(1)}`} fill="none" strokeWidth="20" strokeLinecap="round"
            style={{ stroke: ok ? "url(#fpi-grad-arco)" : C.neg, "--fpi-largo": largo.toFixed(1) }} />
        )}
        {marcas.map((m, i) => {
          const a = puntoArco(m.pct, max, { cx: CX, cy: CY, r: R - 16 });
          const b = puntoArco(m.pct, max, { cx: CX, cy: CY, r: R + 16 });
          // Etiqueta afuera del arco; si queda pegada a la anterior, más afuera.
          const pegada = i > 0 && Math.abs(m.pct - marcas[i - 1].pct) / max < 0.12;
          const t = puntoArco(m.pct, max, { cx: CX, cy: CY, r: R + (pegada ? 44 : 28) });
          const ancla = t.x < CX - 20 ? "end" : t.x > CX + 20 ? "start" : "middle";
          const alcanzada = cobertura >= m.pct;
          const enElExtremo = m.pct >= max * 0.97; // su nombre va bajo el extremo del arco
          return (
            <g key={m.et}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="1.5" strokeDasharray="2 3" style={{ stroke: C.txt3 }} aria-hidden="true" />
              {!enElExtremo && <text x={t.x} y={t.y + 4} textAnchor={ancla} fontSize="12" fontWeight={alcanzada ? 600 : 400} style={{ fill: alcanzada ? C.txt2 : C.txt3 }}>{m.et}</text>}
            </g>
          );
        })}
        <circle className="fpi-fade" cx={p.x} cy={p.y} r="8" strokeWidth="3"
          style={{ fill: "var(--fp-card)", stroke: ok ? C.pos : C.neg, filter: `drop-shadow(0 0 8px ${ok ? "var(--fp-pos)" : "var(--fp-neg)"})` }} />
        <text x={CX} y={CY - 26} textAnchor="middle" fontSize="46" fontWeight="600" style={{ fill: C.txt, ...cifra }}>{fmtPct(cobertura)}</text>
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="12" style={{ fill: C.txt2 }}>{tx("de tus gastos e intereses", "of your expenses and interest")}</text>
        <text x={ini.x} y={CY + 26} textAnchor="middle" fontSize="11" style={{ fill: C.txt3 }}>{fmtPct(0)}</text>
        <text x={fin.x} y={CY + 26} textAnchor="middle" fontSize="11" style={{ fill: C.txt3 }}>{fmtPct(max)}</text>
        {marcas.some((m) => m.pct >= max * 0.97) && <text x={fin.x} y={CY + 41} textAnchor="middle" fontSize="12" style={{ fill: C.txt3 }}>{nombreNivel(NIVELES[4])}</text>}
      </svg>

      <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: C.txt2 }}>{tx("Tu nivel de libertad", "Your freedom level")}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: C.txt, letterSpacing: "-0.02em" }}>{n ? nombreNivel(NIVELES[n - 1]) : nivel?.nombre || "—"}</div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: C.txt }}>
          {n ? descNivel(NIVELES[n - 1]) + ". " : ""}
          {ok ? tx(<>Te sobran <b style={{ color: C.pos, ...cifra }}>{fm(dif)}</b> de rentas al mes.</>, <>You have <b style={{ color: C.pos, ...cifra }}>{fm(dif)}</b> of passive income to spare each month.</>)
            : tx(<>A tus rentas les faltan <b style={{ ...cifra }}>{fm(-dif)}</b> este mes para pagar todo tu nivel de vida.</>, <>This month your passive income is <b style={{ ...cifra }}>{fm(-dif)}</b> short of covering your whole lifestyle.</>)}
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${C.linea}` }}>
          <div><div style={{ fontSize: 12, color: C.txt2 }}>{tx("Rentas al mes", "Passive income / mo")}</div><div style={{ fontSize: 20, fontWeight: 600, color: C.txt, ...cifra }}>{fm(ip)}</div></div>
          <div><div style={{ fontSize: 12, color: C.txt2 }}>{tx("Gastos e intereses al mes", "Expenses & interest / mo")}</div><div style={{ fontSize: 20, fontWeight: 600, color: C.txt, ...cifra }}>{fm(ob)}</div></div>
        </div>
        {Array.isArray(partes) && partes.length > 0 && (
          <div style={{ fontSize: 12, lineHeight: 1.6, color: C.txt2 }}>
            {tx("Se compone de: ", "Made up of: ")}
            {partes.map((pt, i) => <span key={pt.clave}>{i > 0 ? " · " : ""}{tx(pt.es, pt.en)} <b style={{ color: C.txt, ...cifra }}>{fm(pt.monto)}</b></span>)}
          </div>
        )}
        {caja && caja.capital > 0 && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.txt2 }}>
            {tx(<>Este mes además abonas <b style={{ color: C.pos, ...cifra }}>{fm(caja.capital)}</b> a capital de tus deudas. Eso es ahorro, no gasto: tu deuda baja y tu patrimonio sube.</>,
                <>This month you also pay <b style={{ color: C.pos, ...cifra }}>{fm(caja.capital)}</b> of debt principal. That is saving, not spending: your debt goes down and your net worth goes up.</>)}
          </div>
        )}
        {caja && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: caja.deficit ? C.neg : C.txt2 }}>
            {caja.deficit
              ? tx(<>Caja del mes: salen <b style={{ ...cifra }}>{fm(-caja.fl)}</b> más de lo que entra, contando salario y cuotas completas.</>, <>Cash this month: <b style={{ ...cifra }}>{fm(-caja.fl)}</b> more goes out than comes in, counting salary and full payments.</>)
              : tx(<>Caja del mes, con salario y cuotas completas: te sobran <b style={{ color: C.txt, ...cifra }}>{fm(caja.fl)}</b>.</>, <>Cash this month, with salary and full payments: <b style={{ color: C.txt, ...cifra }}>{fm(caja.fl)}</b> left over.</>)}
            {caja.rentasNoCubrenCuotas && tx(<> Tus rentas pagan tu vida, pero no las cuotas completas: el abono a capital lo está pagando otro ingreso.</>, <> Your passive income covers your life, but not the full payments: another income is paying the principal.</>)}
          </div>
        )}
        {finD && finD.coberturaSinDeudas != null && finD.coberturaSinDeudas > cobertura + 0.5 && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: C.txt2 }}>
            {tx(<>Cuando termines de pagar tus deudas (≈ {finD.anio}), tus rentas cubrirían el <b style={{ color: C.txt, ...cifra }}>{fmtPct(finD.coberturaSinDeudas)}</b> de tu vida.</>,
                <>Once your debts are paid off (≈ {finD.anio}), your passive income would cover <b style={{ color: C.txt, ...cifra }}>{fmtPct(finD.coberturaSinDeudas)}</b> of your life.</>)}
          </div>
        )}
        {nivel?.siguiente && nivel.faltaIPSiguiente > 0 && (
          <div style={{ fontSize: 13, color: C.txt2 }}>
            {tx(<>Siguiente nivel, {nivel.siguiente.nombre}: <b style={{ color: C.txt, ...cifra }}>{fm(nivel.faltaIPSiguiente)}</b> más de renta al mes.</>, <>Next level, {nombreNivel(nivel.siguiente)}: <b style={{ color: C.txt, ...cifra }}>{fm(nivel.faltaIPSiguiente)}</b> more passive income a month.</>)}
          </div>
        )}
        {extra}
      </div>

      <div aria-hidden="true" style={{ flex: "1 1 380px", minWidth: "min(100%, 340px)", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", columnGap: 8, rowGap: 10 }}>
        {NIVELES.map((lv, i) => {
          const h = [26, 44, 66, 92, 120][i];
          const actual = n === lv.id;
          const pasado = n && lv.id < n;
          return (
            <div key={lv.id} style={{ height: 120, display: "flex", alignItems: "flex-end", gridRow: 1 }}>
              <div className="fpi-barra" style={{
                width: "100%", height: h, borderRadius: 6, animationDelay: `${i * 40}ms`, boxSizing: "border-box",
                background: actual ? C.pos : pasado ? trama(C.azul, 28 + i * 12) : "transparent",
                border: actual || pasado ? "none" : "1px dashed rgba(var(--fp-ink),0.22)",
                boxShadow: actual ? "0 0 16px color-mix(in srgb, var(--fp-pos) 35%, transparent)" : "none",
                display: "flex", justifyContent: "center", paddingTop: 6,
              }}>
                {actual && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fp-card)" }}>{tx("Tú", "You")}</span>}
              </div>
            </div>
          );
        })}
        {NIVELES.map((lv) => {
          const actual = n === lv.id;
          return (
            <div key={"e" + lv.id} style={{ gridRow: 2, fontSize: 11, lineHeight: 1.2, whiteSpace: "nowrap", color: actual ? C.txt : C.txt3, fontWeight: actual ? 600 : 400 }}>{nombreNivel(lv)}</div>
          );
        })}
      </div>
    </section>
  );
}
