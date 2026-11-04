// ═══════════════════════════════════════════════════════════════════════════
// RecuperacionCotizar — «¿Cuándo recuperas lo que pagas por seguir cotizando?»
// 4-nov-2026. Acumulado en pesos de hoy: baja mientras cotizas (naranja, es lo
// que sale de tu bolsillo) y sube desde que te pensionas (verde, la mesada
// extra frente a parar hoy). El punto donde cruza el cero es el protagonista.
// v: valeLaPenaSeguir() con su serie · edad: edad de hoy.
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtNumEs } from "../../lib/formato.js";

const W = 760, H = 250, IZQ = 8, DER = 752, ARR = 30, ABA = 210;

export default function RecuperacionCotizar({ v, edad, fm, etiqueta, añoHoy = new Date().getFullYear() }) {
  if (!v || !Array.isArray(v.serie) || v.serie.length < 3 || !(v.costoTotal > 0)) return null;
  const s = v.serie;
  const xMax = s[s.length - 1].año;
  const vals = s.map((p) => p.acumulado);
  const yMin = Math.min(0, ...vals), yMax = Math.max(0, ...vals);
  const x = (a) => IZQ + (a / xMax) * (DER - IZQ);
  const y = (val) => ARR + ((yMax - val) / (yMax - yMin || 1)) * (ABA - ARR);
  const y0 = y(0);
  const d = s.map((p, i) => `${i ? "L" : "M"}${x(p.año).toFixed(1)},${y(p.acumulado).toFixed(1)}`).join(" ");
  const area = `${d} L${x(xMax).toFixed(1)},${y0.toFixed(1)} L${x(0)},${y0.toFixed(1)} Z`;
  const rec = v.añoRecupera;
  const edadRec = rec != null ? edad + rec : null;
  const edadPens = edad + v.añosHastaPension;
  const añoPens = añoHoy + Math.ceil(v.añosHastaPension);
  const añoRec = rec != null ? añoHoy + Math.ceil(rec) : null;
  const conclusion = rec != null
    ? `Pagas ${fm(v.costoTotal)}; te pensionas en ${añoPens} a los ${fmtNumEs(Math.round(edadPens), 0)}. En ${añoRec}, a los ${fmtNumEs(Math.floor(edadRec), 0)}, ya lo recuperaste y, con la esperanza de vida, terminas ganando ${fm(v.ganaTotal)}.`
    : `Con la esperanza de vida no alcanzas a recuperar los ${fm(v.costoTotal)} que pagas.`;

  return (
    <section aria-label="Recuperación de lo que pagas por cotizar" style={{ ...tarjeta, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>¿Cuándo recuperas lo que pagas?</h3>
        <div style={subtitulo}>{etiqueta ? etiqueta + ". " : ""}{conclusion}</div>
      </div>
      <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={conclusion} style={{ width: "100%", minWidth: 600, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
        <defs>
          <clipPath id="fpi-rec-arriba"><rect x="0" y="0" width={W} height={y0} /></clipPath>
          <clipPath id="fpi-rec-abajo"><rect x="0" y={y0} width={W} height={H - y0} /></clipPath>
        </defs>
        <line x1={IZQ} y1={y0} x2={DER} y2={y0} style={{ stroke: "rgba(var(--fp-ink),0.18)" }} />
        <path d={area} clipPath="url(#fpi-rec-abajo)" style={{ fill: trama(C.neg, 14) }} />
        <path d={area} clipPath="url(#fpi-rec-arriba)" style={{ fill: trama(C.pos, 16) }} />
        <path className="fpi-arco" d={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" clipPath="url(#fpi-rec-abajo)" style={{ stroke: C.neg, "--fpi-largo": 2000 }} />
        <path className="fpi-arco" d={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" clipPath="url(#fpi-rec-arriba)" style={{ stroke: C.pos, "--fpi-largo": 2000 }} />
        {/* pensión */}
        <line x1={x(v.añosHastaPension)} y1={ARR - 6} x2={x(v.añosHastaPension)} y2={ABA} strokeDasharray="3 4" style={{ stroke: "rgba(var(--fp-ink),0.25)" }} />
        <text x={x(v.añosHastaPension) + 6} y={ARR + 4} fontSize="11" style={{ fill: C.txt3 }}>Te pensionas: {añoPens} · {fmtNumEs(Math.round(edadPens), 0)} años</text>
        <text x={x(v.añosHastaPension)} y={y(-v.costoTotal) + 18} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: C.neg, ...cifra }}>−{fm(v.costoTotal)}</text>
        {rec != null && <>
          <circle cx={x(rec)} cy={y0} r="6" strokeWidth="3" style={{ fill: "var(--fp-card)", stroke: C.pos, filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--fp-pos) 45%, transparent))" }} />
          <text x={x(rec) + 12} y={y0 + 22} textAnchor="start" fontSize="12" fontWeight="600" style={{ fill: C.txt }}>Recuperas en {añoRec} · {fmtNumEs(Math.floor(edadRec), 0)} años</text>
        </>}
        <text x={DER} y={y(s[s.length - 1].acumulado) - 10} textAnchor="end" fontSize="12" fontWeight="600" style={{ fill: v.ganaTotal >= 0 ? C.pos : C.neg, ...cifra }}>{v.ganaTotal >= 0 ? "+" : "−"}{fm(Math.abs(v.ganaTotal))}</text>
        <text x={IZQ} y={H - 8} fontSize="11" style={{ fill: C.txt3 }}>Hoy · {añoHoy} · {fmtNumEs(Math.floor(edad), 0)} años</text>
        <text x={DER} y={H - 8} textAnchor="end" fontSize="11" style={{ fill: C.txt3 }}>{añoHoy + Math.round(xMax)} · {fmtNumEs(Math.floor(edad + xMax), 0)} años</text>
      </svg>
      </div>
    </section>
  );
}
