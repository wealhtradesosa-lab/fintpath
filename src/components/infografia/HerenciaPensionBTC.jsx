// ═══════════════════════════════════════════════════════════════════════════
// HerenciaPensionBTC — «¿Qué recibes tú y qué heredan los tuyos?» (4-nov-2026)
// Santiago: "un comparativo bien claro de la pensión tradicional vs la pensión
// con BTC, donde quede en evidencia lo que quedaría heredable y lo que no".
// Dos barras con la misma escala: lo que recibes en vida (azul) y lo que queda
// para tus herederos (verde). La pensión no deja capital: solo sigue pagando a
// tu cónyuge mientras viva. Debajo, la curva del capital en bitcoin mientras
// retiras. comp: comparativoHerencia() · retiro: simularRetiro().
// ═══════════════════════════════════════════════════════════════════════════

import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { fmtNumEs, fmtPctEs } from "../../lib/formato.js";

const W = 640, H = 170, IZQ = 8, DER = 632, ARR = 24, ABA = 140;

export default function HerenciaPensionBTC({ comp, retiro, retiroPct, añosRetiro, edadRetiro, hastaEdad, fm, nombrePension = "Pensión" }) {
  if (!comp || !retiro) return null;
  const filas = [
    comp.pension.enVida > 0 ? { k: "p", nombre: nombrePension, mes: comp.pension.mes, vida: comp.pension.enVida, hereda: 0 } : null,
    { k: "b", nombre: "Ahorro en bitcoin", mes: comp.btc.mes, vida: comp.btc.enVida, hereda: comp.btc.heredable },
  ].filter(Boolean);
  const max = Math.max(...filas.map((f) => f.vida + f.hereda)) || 1;
  const s = retiro.serie;
  const yMax = Math.max(...s.map((p) => p.capital)) || 1;
  const x = (a) => IZQ + (a / (s[s.length - 1].año || 1)) * (DER - IZQ);
  const y = (v) => ABA - (v / yMax) * (ABA - ARR);
  const d = s.map((p, i) => `${i ? "L" : "M"}${x(p.año).toFixed(1)},${y(p.capital).toFixed(1)}`).join(" ");
  const conclusion = retiro.agotaEn != null
    ? `Retirando ${fmtPctEs(retiroPct, 0)} al año el bitcoin se acaba en ${fmtNumEs(retiro.agotaEn, 0)} años${edadRetiro ? `, a los ${Math.round(edadRetiro + retiro.agotaEn)}` : ""}: no queda herencia.`
    : `Retirando ${fmtPctEs(retiroPct, 0)} al año, después de ${añosRetiro} años quedan ${fm(retiro.capitalFinal)} para tus herederos.${comp.pension.enVida > 0 ? " La pensión no deja capital: solo sigue a tu cónyuge mientras viva." : ""}`;

  return (
    <section aria-label="Pensión frente a bitcoin: lo que recibes y lo que se hereda" style={{ ...tarjeta, marginBottom: 12, display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div>
        <h3 style={titulo}>¿Qué recibes tú y qué heredan los tuyos?</h3>
        <div style={subtitulo}>Comparado en {añosRetiro} años de retiro{edadRetiro ? `, de los ${edadRetiro} a los ${hastaEdad}` : ""} (lo cambias en el paso 4), en pesos de hoy. {conclusion}</div>
      </div>

      {/* 4-nov-2026. Santiago pidió claridad en los números ("recibo 8.624 ¿qué?
          ¿cada mes, total?") y después que volvieran las dos barras ("la gráfica
          donde uno veía las dos líneas de cada opción"). Quedan las dos cosas:
          por opción, lo que recibes al mes en grande, la barra con la misma
          escala para las dos, y debajo cada color con su significado y su
          periodo escrito. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {filas.map((f, i) => {
          const esBtc = f.k === "b";
          const dura = esBtc && retiro.agotaEn != null ? retiro.agotaEn : añosRetiro;
          const tramo = edadRetiro ? `de los ${edadRetiro} a los ${Math.round(edadRetiro + dura)}` : `en ${fmtNumEs(dura, 0)} años`;
          const nota = esBtc
            ? (retiro.agotaEn != null ? `Solo ${tramo}: ahí se acaba el bitcoin y no recibes más.` : `Durante todo el retiro, ${tramo}; el capital sigue invertido.`)
            : "Es tu mesada de Pensiones. Llegan 13 al año (una extra), de por vida. Si faltas, solo tu cónyuge sigue recibiéndola.";
          return (
            <div key={f.k}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.txt }}>{f.nombre}</span>
                <span style={{ ...cifra }}><span style={{ fontSize: 26, fontWeight: 600, color: C.txt }}>{fm(f.mes)}</span><span style={{ fontSize: 14, color: C.txt2 }}> al mes</span></span>
              </div>
              <div style={{ fontSize: 12, color: C.txt3, margin: "2px 0 8px" }}>{nota}</div>
              <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", background: C.pista }}>
                <div className="fpi-barra-h" style={{ width: (f.vida / max) * 100 + "%", background: trama(C.azul, 80), animationDelay: `${i * 80}ms` }} />
                <div className="fpi-barra-h" style={{ width: (f.hereda / max) * 100 + "%", background: C.pos, animationDelay: `${i * 80 + 120}ms` }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 8, marginTop: 8, ...cifra }}>
                <div style={{ fontSize: 13, color: C.txt2 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: trama(C.azul, 80), marginRight: 6 }} />
                  Suma de lo que recibes {tramo}: <strong style={{ color: C.txt }}>{fm(f.vida)}</strong>
                </div>
                <div style={{ fontSize: 13, color: C.txt2 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: C.pos, marginRight: 6 }} />
                  Les queda a tus herederos{hastaEdad ? ` a los ${hastaEdad}` : ""}: <strong style={{ color: f.hereda > 0 ? C.pos : C.txt }}>{f.hereda > 0 ? fm(f.hereda) : "$0"}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ fontSize: 13, color: C.txt2, marginBottom: 6 }}>Tu capital en bitcoin mientras retiras {fm(retiro.retiroMes)} al mes</div>
        <div style={{ overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={conclusion} style={{ width: "100%", minWidth: 480, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
            <defs><linearGradient id="fpi-her-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--fp-pos)", stopOpacity: 0.3 }} /><stop offset="1" style={{ stopColor: "var(--fp-pos)", stopOpacity: 0 }} /></linearGradient></defs>
            <line x1={IZQ} y1={ABA} x2={DER} y2={ABA} style={{ stroke: "rgba(var(--fp-ink),0.15)" }} />
            <path d={`${d} L${x(s[s.length - 1].año)},${ABA} L${x(0)},${ABA} Z`} style={{ fill: retiro.agotaEn != null ? trama(C.neg, 14) : "url(#fpi-her-g)" }} />
            <path className="fpi-arco" d={d} fill="none" strokeWidth="2.5" style={{ stroke: retiro.agotaEn != null ? C.neg : C.pos, "--fpi-largo": 1600 }} />
            <circle cx={x(s[s.length - 1].año)} cy={y(s[s.length - 1].capital)} r="5" strokeWidth="3" style={{ fill: "var(--fp-card)", stroke: retiro.agotaEn != null ? C.neg : C.pos }} />
            <text x={IZQ} y={ARR - 8} fontSize="12" style={{ fill: C.txt2, ...cifra }}>Al retirarte: {fm(s[0].capital)}</text>
            <text x={DER - 14} y={Math.max(ARR + 4, y(s[s.length - 1].capital) - 12)} textAnchor="end" fontSize="12" fontWeight="600" style={{ fill: retiro.agotaEn != null ? C.neg : C.pos, ...cifra }}>{retiro.agotaEn != null ? "Se acaba" : "Heredable: " + fm(s[s.length - 1].capital)}</text>
            <text x={IZQ} y={H - 8} fontSize="11" style={{ fill: C.txt3 }}>Año 0</text>
            <text x={DER} y={H - 8} textAnchor="end" fontSize="11" style={{ fill: C.txt3 }}>Año {s[s.length - 1].año}</text>
          </svg>
        </div>
        <div style={{ fontSize: 12, color: C.txt3, marginTop: 6 }}>El capital crece {fmtPctEs(retiro.real, 1)} al año sobre la inflación (el crecimiento que elegiste menos la del dólar) y cada mes sale el retiro.</div>
      </div>
    </section>
  );
}
