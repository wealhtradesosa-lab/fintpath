// ═══════════════════════════════════════════════════════════════════════════
// EscenariosPension — «¿Cuántos años más te conviene cotizar?»
// 4-nov-2026 (Santiago: "ver si paro ya y por cada año adicional, y cuál es el
// más eficiente de todos, como lo muestra el informe actuarial").
// Barras: mesada neta de cada escenario (parar hoy en gris, el resto en azul).
// El más eficiente —mayor rentabilidad real de lo que pones— en verde con halo.
// Debajo, la tabla del actuario: semanas, tasa, mesada, costo, recuperación.
// lista: escenariosCotizacion().lista · mejor: años del más eficiente.
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtNumEs, fmtPctEs } from "../../lib/formato.js";

const W = 760, H = 250, BASE = 186, TOPE = 34;
const etiquetaAños = (a, hasta) => (a === 0 ? "Parar hoy" : hasta ? "Hasta pensión" : `+${fmtNumEs(a, a % 1 ? 1 : 0)} ${a === 1 ? "año" : "años"}`);

// 4-nov-2026 (Santiago: "poner los años también, 2026, 2027, para saber en qué
// año llega a la jubilación, y también la edad"): cada escenario dice hasta qué
// año y a qué edad cotizas; el título dice el año y la edad de pensión.
export default function EscenariosPension({ lista, mejor, seleccion, onSeleccionar, fm, edadPension, edad, marginales = [], recomendado = null, añoHoy = new Date().getFullYear() }) {
  if (recomendado != null) mejor = recomendado; // la recomendación costo/beneficio manda
  if (!Array.isArray(lista) || lista.length < 2) return null;
  const max = Math.max(...lista.map((e) => e.mesada)) || 1;
  const k = (BASE - TOPE) / max;
  const paso = W / lista.length;
  const bw = Math.min(44, paso * 0.62);
  const cx = (i) => paso * i + paso / 2;
  const hoy = lista[0];
  const falta = lista[lista.length - 1].años;
  const añoPension = añoHoy + Math.ceil(falta);
  const hasta = (e) => ({ año: añoHoy + Math.round(e.años), edad: Math.floor((edad || 0) + e.años) });
  const best = lista.find((e) => e.años === mejor);
  const ultimo = lista[lista.length - 1];
  const tope = lista.find((e, i) => i > 0 && e.tasa >= e.seguir.tasa.tope - 1e-9 && e.años < ultimo.años);
  const conclusionVieja = best
    ? `Lo más eficiente: ${etiquetaAños(best.años, best.hastaPension).replace("+", "").toLowerCase()} más. Cada peso que pones rinde ${fmtPctEs(best.tirAnual, 1)} al año sobre la inflación.`
      + (tope ? ` Con ${fmtNumEs(tope.años, 0)} años llegas al tope de ${fmtPctEs(tope.seguir.tasa.tope, 0)}: después la mesada ya no sube.` : "")
    : "Con estos datos seguir cotizando no sube tu mesada.";
  const conclusion = recomendado === 0 ? "Con estos datos, parar hoy es lo más eficiente." : conclusionVieja;

  return (
    <section aria-label="Escenarios de cotización" style={{ ...tarjeta, marginBottom: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>¿Cuántos años más te conviene cotizar?</h3>
        <div style={subtitulo}>Te pensionas en <strong style={{ color: C.txt }}>{añoPension}</strong>, a los {edadPension}. Mesada neta de cada escenario según hasta cuándo cotices, en pesos de hoy. La línea punteada es lo que recibirías si paras hoy; en verde, el más eficiente costo/beneficio.</div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={conclusion} style={{ width: "100%", minWidth: 560, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
          <line x1="0" y1={BASE} x2={W} y2={BASE} style={{ stroke: "rgba(var(--fp-ink),0.12)" }} />
          <line x1="0" y1={BASE - hoy.mesada * k} x2={W} y2={BASE - hoy.mesada * k} strokeDasharray="3 4" style={{ stroke: "rgba(var(--fp-ink),0.25)" }} />
          {lista.map((e, i) => {
            const h = Math.max(2, e.mesada * k);
            const esMejor = e.años === mejor;
            const esSel = e.años === seleccion;
            const fill = i === 0 ? C.neutro : esMejor ? C.pos : trama(C.azul, esSel ? 90 : 42);
            const mostrarCifra = i === 0 || esMejor || esSel || (e.hastaPension && Math.round(e.mesada / 1e5) !== Math.round((lista.find((x) => x.años === mejor)?.mesada || 0) / 1e5));
            return (
              <g key={e.años} onClick={() => i > 0 && onSeleccionar && onSeleccionar(e.años)} style={{ cursor: i > 0 ? "pointer" : "default" }}>
                <rect x={cx(i) - paso / 2} y={TOPE - 20} width={paso} height={BASE - TOPE + 40} style={{ fill: "transparent" }} />
                <rect className="fpi-barra" x={cx(i) - bw / 2} y={BASE - h} width={bw} height={h} rx="6"
                  style={{ fill, animationDelay: `${i * 35}ms`, filter: esMejor ? "drop-shadow(0 0 10px color-mix(in srgb, var(--fp-pos) 40%, transparent))" : "none",
                    stroke: esSel && !esMejor ? C.azul : "none", strokeWidth: 2 }}>
                  <title>{`${etiquetaAños(e.años, e.hastaPension)}: ${fm(e.mesada)} al mes`}</title>
                </rect>
                {mostrarCifra && (
                  <text x={cx(i)} y={BASE - h - 8} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: esMejor ? C.pos : C.txt, ...cifra }}>{fm(e.mesada)}</text>
                )}
                {esMejor && <text x={cx(i)} y={BASE - h - 24} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: C.pos }}>Recomendado</text>}
                <text x={cx(i)} y={BASE + 18} textAnchor="middle" fontSize="12" fontWeight={esSel || esMejor ? 600 : 400} style={{ fill: esSel || esMejor ? C.txt : C.txt2, ...cifra }}>{i === 0 ? "Hoy" : hasta(e).año}</text>
                <text x={cx(i)} y={BASE + 34} textAnchor="middle" fontSize="11" style={{ fill: C.txt3, ...cifra }}>{hasta(e).edad} años</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Celular: una fila por escenario con lo esencial */}
      <div className="fpi-solo-movil" style={{ flexDirection: "column" }}>
        {lista.map((e, i) => {
          const esMejor = e.años === mejor;
          return (
            <div key={e.años} onClick={() => i > 0 && onSeleccionar && onSeleccionar(e.años)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 8px", borderBottom: `1px solid ${C.linea}`, background: esMejor ? trama(C.pos, 10) : "transparent", borderRadius: esMejor ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: esMejor ? 600 : 500, color: C.txt }}>{i === 0 ? "Parar hoy" : `Hasta ${hasta(e).año}`}{esMejor && <span style={{ color: C.pos, fontSize: 12, marginLeft: 6 }}>recomendado</span>}</div>
                <div style={{ fontSize: 12, color: C.txt3, ...cifra }}>{i === 0 ? `${Math.floor(edad || 0)} años` : `${hasta(e).edad} años · pagas ${fm(e.costoTotal)}`}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.txt, ...cifra }}>{fm(e.mesada)}</div>
                <div style={{ fontSize: 12, color: esMejor ? C.pos : C.txt3, ...cifra }}>{i && Number.isFinite(e.tirAnual) ? `rinde ${fmtPctEs(e.tirAnual, 1)}` : "al mes"}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fpi-solo-escritorio" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 800, borderCollapse: "collapse", fontSize: 13, ...cifra }}>
          <thead>
            <tr>{["Escenario", "Cotizas hasta", "Semanas", "Tasa", "Mesada neta", "Ganas al mes", "Pagas en total", "Recuperas en", "Rentabilidad real", "Ese año rinde"].map((h, i) => (
              <th key={h} style={{ textAlign: i ? "right" : "left", padding: "6px 8px", color: C.txt3, fontWeight: 500, fontSize: 12, borderBottom: `1px solid ${C.linea}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>{lista.map((e, i) => {
            const esMejor = e.años === mejor, esSel = e.años === seleccion;
            return (
              <tr key={e.años} onClick={() => i > 0 && onSeleccionar && onSeleccionar(e.años)}
                style={{ cursor: i > 0 ? "pointer" : "default", background: esMejor ? trama(C.pos, 10) : esSel ? trama(C.azul, 8) : "transparent", borderBottom: `1px solid ${C.linea}` }}>
                <td style={{ padding: "9px 8px", fontWeight: esMejor || esSel ? 600 : 400, color: C.txt, whiteSpace: "nowrap" }}>{etiquetaAños(e.años, e.hastaPension)}{esMejor && <span style={{ color: C.pos, fontSize: 12, marginLeft: 6 }}>recomendado</span>}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: C.txt2, whiteSpace: "nowrap" }}>{i === 0 ? "Hoy" : `${hasta(e).año} · ${hasta(e).edad} años`}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: C.txt2 }}>{fmtNumEs(Math.round(e.semanas), 0)}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: C.txt2 }}>{fmtPctEs(e.tasa, 1)}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 600, color: C.txt }}>{fm(e.mesada)}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: i ? C.pos : C.txt3 }}>{i ? "+" + fm(e.beneficioMesNeto) : "—"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: i ? C.txt2 : C.txt3 }}>{i ? fm(e.costoTotal) : "—"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: C.txt2 }}>{i && Number.isFinite(e.paybackAños) ? fmtNumEs(e.paybackAños, 1) + " años" : "—"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: esMejor ? 600 : 400, color: esMejor ? C.pos : C.txt2 }}>{i && Number.isFinite(e.tirAnual) ? fmtPctEs(e.tirAnual, 1) : "—"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: !marginales[i] ? C.txt3 : marginales[i].tir === -Infinity ? C.neg : C.txt2 }}>{!marginales[i] ? "—" : marginales[i].tir === -Infinity ? "no sube" : fmtPctEs(marginales[i].tir, 1)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: C.txt3, lineHeight: 1.6 }}>
        Pagas: solo lo de pensión (16 %) y solidaridad; la salud la pagas igual. Ganas: lo que sube tu mesada frente a parar hoy, 13 mesadas al año. Recuperas: años de pensión para devolverte lo pagado. Rentabilidad real: de todo lo que pones frente a parar hoy. Ese año rinde: solo el año extra frente al anterior. Toca una fila para ver su curva.
      </div>
    </section>
  );
}
