import { useState } from "react";

/**
 * SankeyFlujo — "¿Por dónde se va tu plata?"
 *
 * Diagrama de flujo: fuentes de ingreso → ingreso bruto → todo lo que sale
 * (retención, impuesto, aportes, cuotas de deuda, gastos por categoría) y lo
 * que queda como ahorro. El ancho de cada cinta ES la plata.
 *
 * Vive en el SIMULADOR y no en el dashboard por una razón (25-jul-2026,
 * Santiago): ahí el diagrama deja de ser un póster y se vuelve herramienta —
 * reacciona al MES seleccionado y a los toggles de encendido/apagado. Ver las
 * cintas encogerse al cambiar de mes, o el ahorro engordar al apagar un gasto,
 * es lo que convierte el gráfico en una decisión.
 *
 * El componente NO conoce el motor: recibe datos ya normalizados, así que la
 * vista que lo monta decide si son del mes o del promedio del año.
 */

const CINTA = (x0, y0, x1, y1, h) => {
  const cx = (x0 + x1) / 2;
  return `M ${x0} ${y0} C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h} C ${cx} ${y1 + h}, ${cx} ${y0 + h}, ${x0} ${y0 + h} Z`;
};

const COLOR_GASTO = ["#a78bfa", "#06b6d4", "#8b5cf6", "#0ea5e9", "#6366f1"];

export default function SankeyFlujo({
  bruto = 0,
  fuentes = [],          // [{nombre, valor}]
  retencion = 0,
  impuesto = 0,
  aportes = 0,
  cuotas = 0,
  gastosCats = [],       // [[categoria, valor]]
  cashFlow = 0,
  subtitulo = "",
  fmt,
  T,
}) {
  const [hover, setHover] = useState(null);

  if (!(bruto > 0)) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, textAlign: "center", color: T.tx3, fontSize: 12.5 }}>
        💧 Sin ingresos en este mes — no hay flujo que mostrar.
      </div>
    );
  }

  // ── Fuentes: agrupar la cola para no saturar
  let F = fuentes.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  if (F.length > 6) {
    const resto = F.slice(5).reduce((s, f) => s + f.valor, 0);
    F = [...F.slice(0, 5), { nombre: `Otros (${F.length - 5})`, valor: resto }];
  }

  // ── Destinos
  const D = [];
  const push = (nombre, valor, color, nota) => { if (valor > 0.5) D.push({ nombre, valor, color, nota }); };
  push("Retención en la fuente", retencion, "#f97316", "no llega a tu cuenta");
  push("Impuesto de renta", impuesto, "#ef4444", "saldo a pagar");
  push("Aportes obligatorios", aportes, "#eab308", "salud y pensión");
  push("Cuotas de deuda", cuotas, "#ec4899", "capital + interés");

  let cats = (gastosCats || []).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (cats.length > 5) {
    const resto = cats.slice(4).reduce((s, [, v]) => s + v, 0);
    cats = [...cats.slice(0, 4), [`Otros gastos (${cats.length - 4})`, resto]];
  }
  cats.forEach(([cat, v], i) => push(cat, v, COLOR_GASTO[i % COLOR_GASTO.length], "gasto"));

  if (cashFlow > 0) push("Te queda (ahorro)", cashFlow, "#22c55e", "esto sí es tuyo");
  const deficit = cashFlow < 0 ? Math.abs(cashFlow) : 0;

  // ── Geometría
  const filas = Math.max(F.length, D.length);
  const W = 700, H = Math.max(300, filas * 50 + 56);
  const PAD = 12, NODO_W = 10;
  const xF = 178, xHub = 348, xD = 504;
  const disponible = H - PAD * (filas - 1) - 44;
  const alto = (v) => Math.max(3, (v / bruto) * disponible);

  let yF = 24;
  const nF = F.map((f) => { const h = alto(f.valor); const n = { ...f, y: yF, h }; yF += h + PAD; return n; });
  let yD = 24;
  const nD = D.map((d) => { const h = alto(d.valor); const n = { ...d, y: yD, h }; yD += h + PAD; return n; });

  const hubY = 24;
  const hubH = nF.reduce((s, n) => s + n.h, 0);
  let anclaIn = hubY, anclaOut = hubY;
  const pct = (v) => ((v / bruto) * 100).toFixed(0);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.tx }}>💧 ¿Por dónde se va tu plata?</div>
      <div style={{ fontSize: 11.5, color: T.tx3, marginTop: 2, marginBottom: 12 }}>
        {subtitulo} El ancho de cada cinta es la plata: entran {fmt(Math.round(bruto))}.
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 380, height: "auto" }}>
          {nF.map((n, i) => {
            const d = CINTA(xF + NODO_W, n.y, xHub, anclaIn, n.h); anclaIn += n.h;
            return <path key={`lf${i}`} d={d} fill="#22c55e" opacity={hover === null || hover === `f${i}` ? 0.26 : 0.06}
              onMouseEnter={() => setHover(`f${i}`)} onMouseLeave={() => setHover(null)} />;
          })}
          {nD.map((n, i) => {
            const d = CINTA(xHub + NODO_W, anclaOut, xD, n.y, n.h); anclaOut += n.h;
            return <path key={`ld${i}`} d={d} fill={n.color} opacity={hover === null || hover === `d${i}` ? 0.3 : 0.06}
              onMouseEnter={() => setHover(`d${i}`)} onMouseLeave={() => setHover(null)} />;
          })}

          {nF.map((n, i) => (
            <g key={`nf${i}`} onMouseEnter={() => setHover(`f${i}`)} onMouseLeave={() => setHover(null)}>
              <rect x={xF} y={n.y} width={NODO_W} height={n.h} rx={2} fill="#22c55e" />
              <text x={xF - 9} y={n.y + n.h / 2 - 1} textAnchor="end" fontSize="14.5" fontWeight="600" fill={T.tx}>
                {n.nombre.length > 18 ? n.nombre.slice(0, 17) + "…" : n.nombre}
              </text>
              <text x={xF - 9} y={n.y + n.h / 2 + 13} textAnchor="end" fontSize="12.5" fontFamily="monospace" fill={T.tx3}>
                {fmt(Math.round(n.valor))}
              </text>
            </g>
          ))}

          <rect x={xHub} y={hubY} width={NODO_W} height={hubH} rx={2} fill={T.tx} opacity={0.85} />
          <text x={xHub + NODO_W / 2} y={hubY - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill={T.tx2}>INGRESO BRUTO</text>
          <text x={xHub + NODO_W / 2} y={hubY + hubH + 19} textAnchor="middle" fontSize="14" fontWeight="800" fontFamily="monospace" fill={T.tx}>
            {fmt(Math.round(bruto))}
          </text>

          {nD.map((n, i) => (
            <g key={`nd${i}`} onMouseEnter={() => setHover(`d${i}`)} onMouseLeave={() => setHover(null)}>
              <rect x={xD} y={n.y} width={NODO_W} height={n.h} rx={2} fill={n.color} />
              <text x={xD + NODO_W + 9} y={n.y + n.h / 2 - 1} fontSize="14.5" fontWeight="600" fill={T.tx}>
                {n.nombre.length > 19 ? n.nombre.slice(0, 18) + "…" : n.nombre}
              </text>
              <text x={xD + NODO_W + 9} y={n.y + n.h / 2 + 13} fontSize="12.5" fontFamily="monospace" fill={T.tx3}>
                {fmt(Math.round(n.valor))} <tspan fill={T.tx2}>· {pct(n.valor)}%</tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>

      {deficit > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "9px 12px" }}>
          ⚠️ Este mes sale más de lo que entra: faltan <strong>{fmt(Math.round(deficit))}</strong>. Esa diferencia se cubre con ahorros o con más deuda.
        </div>
      )}
    </div>
  );
}
