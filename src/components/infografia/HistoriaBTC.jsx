// ═══════════════════════════════════════════════════════════════════════════
// HistoriaBTC — «¿Qué ha pasado con el bitcoin?» (4-nov-2026)
// Barras: variación de cada año (verde sube, naranja cae), con el cierre debajo.
// A la derecha, la oferta: cuántos hay, cuántos faltan por minar y el próximo
// halving. Datos: HISTORICO_BTC y ofertaBTC (lib/ahorroBTC.js).
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtNumEs, fmtPctEs } from "../../lib/formato.js";
import { historicoConVariacion, cagrHistorico, FUENTE_HISTORICO } from "../../lib/ahorroBTC.js";

const W = 640, H = 262, CERO = 118, ESC = 80; // ±100 % ≈ 95 px; más se recorta con marca
const usd = (v) => "US$" + (v >= 1000 ? fmtNumEs(v / 1000, v >= 10000 ? 0 : 1) + " mil" : fmtNumEs(v, 0));

export default function HistoriaBTC({ precioHoy, oferta, fuentePrecio }) {
  const h = historicoConVariacion().slice(1);
  const paso = W / h.length, bw = Math.min(30, paso * 0.6);
  const alto = (v) => Math.min(ESC * 1.05, (Math.abs(v) / 100) * ESC);
  const c10 = cagrHistorico(10), c5 = cagrHistorico(5);
  const ultimo = h[h.length - 1];
  const varHoy = precioHoy && ultimo ? (precioHoy / ultimo.cierre - 1) * 100 : null;
  const resumen = `De ${usd(h[0].cierre)} en ${h[0].año} a ${usd(ultimo.cierre)} en ${ultimo.año}: ${fmtPctEs(c10, 0)} al año en 10 años, ${fmtPctEs(c5, 0)} en los últimos 5. Con caídas de más de 60 % en 2018 y 2022.`;

  return (
    <section aria-label="Historia y oferta del bitcoin" style={{ ...tarjeta, marginBottom: 12, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>¿Qué ha pasado con el bitcoin?</h3>
        <div style={subtitulo}>{resumen}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ overflowX: "auto", gridColumn: "span 2", minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={resumen} style={{ width: "100%", minWidth: 520, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
            <line x1="0" y1={CERO} x2={W} y2={CERO} style={{ stroke: "rgba(var(--fp-ink),0.15)" }} />
            {h.map((x, i) => {
              const sube = x.variacion >= 0;
              const a = alto(x.variacion);
              const cx = paso * i + paso / 2;
              const recorte = Math.abs(x.variacion) > 105;
              return (
                <g key={x.año}>
                  <rect className="fpi-barra" x={cx - bw / 2} y={sube ? CERO - a : CERO} width={bw} height={Math.max(2, a)} rx="5"
                    style={{ fill: sube ? trama(C.pos, 70) : trama(C.neg, 75), animationDelay: `${i * 35}ms`, transformOrigin: sube ? "bottom" : "top" }}>
                    <title>{`${x.año}: ${sube ? "+" : ""}${fmtNumEs(x.variacion, 0)} % · cierre ${usd(x.cierre)}`}</title>
                  </rect>
                  {recorte && <path d={`M${cx - bw / 2} ${CERO - a + 6} l${bw} -6`} strokeWidth="2" style={{ stroke: "var(--fp-card)" }} />}
                  <text x={cx} y={sube ? CERO - a - 6 : CERO + a + 14} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: sube ? C.pos : C.neg, ...cifra }}>{sube ? "+" : ""}{fmtNumEs(x.variacion, 0)} %</text>
                  <text x={cx} y={H - 22} textAnchor="middle" fontSize="11" style={{ fill: C.txt2, ...cifra }}>{x.año}</text>
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" style={{ fill: C.txt3, ...cifra }}>{usd(x.cierre)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {oferta && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: C.txt2 }}>Bitcoin que existen</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: C.txt, ...cifra }}>{fmtNumEs(oferta.circulante / 1e6, 2)} millones</div>
              <div style={{ height: 10, borderRadius: 999, background: C.pista, overflow: "hidden", marginTop: 8 }}>
                <div className="fpi-barra-h" style={{ width: oferta.pctMinado + "%", height: "100%", background: C.azul, borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.txt3, marginTop: 6, ...cifra }}>
                <span>{fmtPctEs(oferta.pctMinado, 1)} minado</span><span>tope: 21 millones</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.txt2, lineHeight: 1.6 }}>
              Faltan <strong style={{ color: C.txt }}>{fmtNumEs(oferta.faltan, 0)} BTC</strong> por minar. Hoy salen {fmtNumEs(oferta.recompensa, 3)} BTC por bloque; en el próximo halving (≈ {oferta.fechaHalving.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}) baja a la mitad.
            </div>
            {precioHoy > 0 && (
              <div style={{ fontSize: 13, color: C.txt2 }}>
                Hoy: <strong style={{ color: C.txt, ...cifra }}>{usd(precioHoy)}</strong>{varHoy != null && <span style={{ color: varHoy >= 0 ? C.pos : C.neg }}> ({varHoy >= 0 ? "+" : ""}{fmtNumEs(varHoy, 0)} % en el año)</span>}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.txt3 }}>Fuente: {FUENTE_HISTORICO}. Oferta calculada desde la altura de bloque{fuentePrecio ? `; ${fuentePrecio}` : ""}. Rentabilidades pasadas no garantizan las futuras.</div>
    </section>
  );
}
