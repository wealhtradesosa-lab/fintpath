// ═══════════════════════════════════════════════════════════════════════════
// FlujoDinero — «¿De dónde viene y a dónde va tu plata?» (Sankey)
// 1-nov-2026. Entradas por grupo → tu mes → salidas por destino. Los datos
// salen de calcularBase (misma base que el resto del Dashboard) y las bandas
// suman exactamente: Σ entradas − Σ salidas = lo que sobra (o lo que falta).
// Color (paleta del 1-nov): azul = lo que producen tus activos; gris = trabajo
// y gastos normales; naranja = cuotas; verde = te sobra.
// ═══════════════════════════════════════════════════════════════════════════

import { flujoDinero, geometriaSankey } from "../../lib/infografia.js";
import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./estilos.js";
import { tx } from "../../lib/region.js";

const TONO_ENTRADA = { inmuebles: [C.azul, 34], financieros: [C.azul, 22], trabajo: ["rgb(var(--fp-ink))", 16], falta: [C.neg, 30] };
const relleno = (it, lado) => {
  if (lado === "e") { const [c, p] = TONO_ENTRADA[it.key] || [C.azul, 24]; return trama(c, p); }
  if (it.key === "sobra") return trama(C.pos, 36);
  if (it.key === "cuotas") return trama(C.neg, 28);
  return "rgba(var(--fp-ink),0.12)";
};
const solido = (it, lado) => {
  if (lado === "e") return it.key === "trabajo" ? C.txt3 : it.key === "falta" ? C.neg : C.azul;
  if (it.key === "sobra") return C.pos;
  if (it.key === "cuotas") return C.neg;
  return C.txt3;
};

export default function FlujoDinero({ met, fm, periodo: periodoProp }) {
  const periodo = periodoProp || tx("Este mes", "This month");
  const flujo = flujoDinero(met);
  const g = geometriaSankey(flujo);
  if (!g) return null;
  const { saldo, totalEntra, totalSale } = flujo;
  const resumen = tx(`${periodo}: entran ${fm(totalEntra)} y salen ${fm(totalSale)}; ${saldo >= 0 ? `te sobran ${fm(saldo)}` : `te faltan ${fm(-saldo)}`}.`, `${periodo}: ${fm(totalEntra)} in and ${fm(totalSale)} out; ${saldo >= 0 ? `${fm(saldo)} left over` : `${fm(-saldo)} short`}.`);

  const etiquetaE = (e) => {
    const cy = e.y + e.h / 2, x = g.xE - 10;
    const colorMonto = e.key === "falta" ? C.neg : e.key === "trabajo" ? C.txt2 : C.azul;
    if (e.h < 30) return (
      <text key={e.key} x={x} y={cy + 4} textAnchor="end" fontSize="12" style={{ fill: C.txt }}>
        {e.nombre} <tspan fontWeight="600" style={{ fill: colorMonto, ...cifra }}>{fm(e.valor)}</tspan>
      </text>
    );
    return (
      <g key={e.key}>
        <text x={x} y={cy - 3} textAnchor="end" fontSize="13" style={{ fill: C.txt }}>{e.nombre}</text>
        <text x={x} y={cy + 15} textAnchor="end" fontSize="13" fontWeight="600" style={{ fill: colorMonto, ...cifra }}>{fm(e.valor)}</text>
      </g>
    );
  };
  const etiquetaS = (s) => {
    const cy = s.y + s.h / 2, x = g.xS + g.nodo + 10;
    const colorMonto = s.key === "sobra" ? C.pos : s.key === "cuotas" ? C.neg : C.txt2;
    const fuerte = s.destacado ? 600 : 400;
    if (s.h < 28) return (
      <text key={s.key} x={x} y={cy + 4} fontSize="12" style={{ fill: C.txt }}>
        {s.nombre} <tspan fontWeight="600" style={{ fill: colorMonto, ...cifra }}>{fm(s.valor)}</tspan>
      </text>
    );
    return (
      <g key={s.key}>
        <text x={x} y={cy - 3} fontSize={s.destacado ? 14 : 13} fontWeight={fuerte} style={{ fill: C.txt }}>{s.nombre}</text>
        <text x={x} y={cy + 15} fontSize={s.destacado ? 14 : 13} fontWeight="600" style={{ fill: colorMonto, ...cifra }}>{fm(s.valor)}</text>
      </g>
    );
  };

  return (
    <section aria-label={tx("De dónde viene y a dónde va tu plata", "Where your money comes from and where it goes")} style={{ ...tarjeta, marginBottom: 20 }}>
      <style>{CSS_INFOGRAFIA}</style>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <h3 style={titulo}>{tx("¿De dónde viene y a dónde va tu plata?", "Where does your money come from, and where does it go?")}</h3>
          <div style={subtitulo}>{periodo}. {tx("El grosor de cada banda es su peso; pasa el mouse para aislarla.", "Each band's width is its share; hover to isolate it.")}</div>
        </div>
        <div style={{ fontSize: 13, color: C.txt2, ...cifra }}>{tx("Entra", "In")} {fm(totalEntra)} · {tx("Sale", "Out")} {fm(totalSale)}</div>
      </div>
      <div className="fpi-solo-movil" style={{ flexDirection: "column", gap: 18 }}>
        {[[tx("Entra", "In"), flujo.entradas, "e"], [tx("Sale", "Out"), flujo.salidas, "s"]].map(([rot, lista, lado]) => (
          <div key={rot} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: C.txt2 }}>{rot}</div>
            {lista.map((it) => (
              <div key={it.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                  <span style={{ color: C.txt, fontWeight: it.destacado ? 600 : 400 }}>{it.nombre}</span>
                  <span style={{ color: solido(it, lado), fontWeight: 600, whiteSpace: "nowrap", ...cifra }}>{fm(it.valor)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(var(--fp-ink),0.06)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, (it.valor / flujo.total) * 100)}%`, height: "100%", borderRadius: 4, background: solido(it, lado) }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="fpi-solo-escritorio" style={{ overflowX: "auto" }}>
        <svg className="fpi-sankey" viewBox={`0 0 ${g.ancho} ${g.alto}`} role="img" aria-label={resumen}
          style={{ width: "100%", minWidth: 640, height: "auto", fontFamily: "Inter, system-ui, sans-serif" }}>
          {g.entradas.map((e) => <path key={"b" + e.key} className="fpi-banda fpi-fade" d={e.d} style={{ fill: relleno(e, "e") }}><title>{`${e.nombre}: ${fm(e.valor)}`}</title></path>)}
          {g.salidas.map((s) => <path key={"b" + s.key} className="fpi-banda fpi-fade" d={s.d} style={{ fill: relleno(s, "s") }}><title>{`${s.nombre}: ${fm(s.valor)}`}</title></path>)}
          {g.entradas.map((e) => <rect key={"n" + e.key} x={g.xE} y={e.y} width={g.nodo} height={e.h} rx="3" style={{ fill: solido(e, "e") }} />)}
          <rect x={g.xM0} y={g.arriba} width={g.xM1 - g.xM0} height={g.H} rx="4" style={{ fill: C.txt }} />
          {g.salidas.map((s) => <rect key={"n" + s.key} x={g.xS} y={s.y} width={g.nodo} height={s.h} rx="3"
            style={{ fill: solido(s, "s"), filter: s.key === "sobra" ? "drop-shadow(0 0 6px var(--fp-pos))" : "none" }} />)}
          <text x={(g.xM0 + g.xM1) / 2} y={g.arriba - 9} textAnchor="middle" fontSize="11" style={{ fill: C.txt2 }}>{tx("Tu mes", "Your month")}</text>
          {g.entradas.map(etiquetaE)}
          {g.salidas.map(etiquetaS)}
        </svg>
      </div>
    </section>
  );
}
