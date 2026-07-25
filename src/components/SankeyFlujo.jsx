import { useState, useMemo } from "react";
import { montoPromedioMensual } from "../lib/flowHelpers.js";

/**
 * SankeyFlujo — "¿Por dónde se va tu plata?"
 *
 * Diagrama de flujo del mes: cada fuente de ingreso a la izquierda, el bruto
 * en el centro, y a la derecha TODO lo que sale (retención, aportes, impuesto,
 * cuotas de deuda, gastos por categoría) más lo que queda como ahorro.
 *
 * Por qué existe (25-jul-2026, Santiago): en una tabla el usuario ve números
 * sueltos; acá ve de un golpe qué proporción de lo que gana nunca llega a ser
 * suyo. El ancho de cada cinta ES la plata — no hay escala que interpretar.
 *
 * IDENTIDAD QUE SE RESPETA (misma que el motor cT, así que el diagrama cuadra
 * al peso con el dashboard):
 *   bruto = retención + aportes + impuesto + cuotas deuda + gastos + cash flow
 *
 * SVG a mano, sin dependencias nuevas: el layout es fijo (fuentes → hub →
 * destinos), así que una librería genérica de Sankey sería más peso y menos
 * control sobre etiquetas en pesos.
 */

const CINTA = (x0, y0, x1, y1, h) => {
  // Cinta con curva bezier horizontal; altura constante h.
  const cx = (x0 + x1) / 2;
  return [
    `M ${x0} ${y0}`,
    `C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`,
    `L ${x1} ${y1 + h}`,
    `C ${cx} ${y1 + h}, ${cx} ${y0 + h}, ${x0} ${y0 + h}`,
    "Z",
  ].join(" ");
};

export default function SankeyFlujo({ totals, ingresos = [], gastos = {}, trm = 4200, fmt, T, moneda = "COP" }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const t = totals || {};
    const bruto = Number(t.brutoTotal ?? t.ti) || 0;
    if (bruto <= 0) return null;

    // ── FUENTES (izquierda). Mismo cálculo que cT: promedio mensualizado y
    //    conversión USD→TRM, excluyendo apagados (sim:false).
    let fuentes = (ingresos || [])
      .filter((i) => i.sim !== false)
      .map((i) => {
        const base = (Number(i.mensual) || 0) * (i.moneda === "USD" ? trm : 1);
        return {
          nombre: i.nombre || i.fuente || "Ingreso",
          valor: montoPromedioMensual({ ...i, mensual: base }),
        };
      })
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor);

    // Agrupar la cola para no saturar
    if (fuentes.length > 6) {
      const resto = fuentes.slice(5).reduce((s, f) => s + f.valor, 0);
      fuentes = [...fuentes.slice(0, 5), { nombre: `Otros (${fuentes.length - 5})`, valor: resto }];
    }

    // ── DESTINOS (derecha)
    const destinos = [];
    const push = (nombre, valor, color, nota) => {
      if (valor > 0.5) destinos.push({ nombre, valor, color, nota });
    };

    push("Retención en la fuente", Number(t.retencionMensual) || 0, "#f97316", "no llega a tu cuenta");
    push("Impuesto de renta", Number(t.impuestoNeto) || 0, "#ef4444", "saldo a pagar");
    push("Aportes obligatorios", Number(t.aportesObligatorios) || 0, "#eab308", "salud y pensión");
    push("Cuotas de deuda", Number(t.cuotasDeudas) || 0, "#ec4899", "capital + interés");

    // Gastos abiertos por categoría — responde "¿en qué se me va?"
    const gastoTotal = Number(t.gastosFamiliares) || 0;
    let cats = Object.entries(gastos || {})
      .map(([cat, its]) => [cat, (its || []).filter((g) => g.sim !== false).reduce((s, g) => s + (Number(g.m) || 0), 0)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const sumaCats = cats.reduce((s, [, v]) => s + v, 0);
    if (sumaCats > 0 && gastoTotal > 0) {
      // Escalar para que la suma cuadre exactamente con el motor
      const k = gastoTotal / sumaCats;
      if (cats.length > 5) {
        const resto = cats.slice(4).reduce((s, [, v]) => s + v, 0);
        cats = [...cats.slice(0, 4), [`Otros gastos (${cats.length - 4})`, resto]];
      }
      cats.forEach(([cat, v], idx) => push(cat, v * k, ["#a78bfa", "#06b6d4", "#8b5cf6", "#0ea5e9", "#6366f1"][idx % 5], "gasto"));
    } else {
      push("Gastos", gastoTotal, "#a78bfa", "");
    }

    const cf = Number(t.cashFlow ?? t.cf) || 0;
    if (cf > 0) push("Te queda (ahorro)", cf, "#22c55e", "esto sí es tuyo");

    const totalDest = destinos.reduce((s, d) => s + d.valor, 0);
    return { bruto, fuentes, destinos, totalDest, deficit: cf < 0 ? Math.abs(cf) : 0 };
  }, [totals, ingresos, gastos, trm]);

  if (!data) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, textAlign: "center", color: T.tx3, fontSize: 13 }}>
        Cargá tus ingresos para ver el flujo de tu plata.
      </div>
    );
  }

  const { bruto, fuentes, destinos, totalDest, deficit } = data;

  // ── Geometría
  const W = 900, H = Math.max(340, Math.max(fuentes.length, destinos.length) * 52 + 60);
  const PAD = 14;                 // separación vertical entre nodos
  const NODO_W = 11;
  const xF = 210, xHub = 430, xD = 640;   // columnas
  const alto = (v) => (v / bruto) * (H - PAD * Math.max(fuentes.length, destinos.length) - 40);

  // Posiciones izquierda
  let yF = 20;
  const nodosF = fuentes.map((f) => {
    const h = Math.max(3, alto(f.valor));
    const n = { ...f, y: yF, h };
    yF += h + PAD;
    return n;
  });

  // Hub
  const hubH = nodosF.reduce((s, n) => s + n.h, 0);
  const hubY = 20;

  // Posiciones derecha
  let yD = 20;
  const nodosD = destinos.map((d) => {
    const h = Math.max(3, alto(d.valor));
    const n = { ...d, y: yD, h };
    yD += h + PAD;
    return n;
  });

  // Puntos de anclaje en el hub (se van apilando)
  let anclaIn = hubY, anclaOut = hubY;

  const pct = (v) => ((v / bruto) * 100).toFixed(0);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: T.tx }}>💧 ¿Por dónde se va tu plata?</span>
      </div>
      <div style={{ fontSize: 11.5, color: T.tx3, marginBottom: 14 }}>
        Flujo de un mes típico. El ancho de cada cinta es la plata: {fmt(bruto)} entrando, {fmt(totalDest)} repartidos.
      </div>

      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 620, height: "auto" }}>
          {/* Cintas: fuentes → hub */}
          {nodosF.map((n, i) => {
            const d = CINTA(xF + NODO_W, n.y, xHub, anclaIn, n.h);
            anclaIn += n.h;
            const act = hover === null || hover === `f${i}`;
            return (
              <path key={`lf${i}`} d={d} fill="#22c55e" opacity={act ? 0.28 : 0.07}
                onMouseEnter={() => setHover(`f${i}`)} onMouseLeave={() => setHover(null)} />
            );
          })}

          {/* Cintas: hub → destinos */}
          {nodosD.map((n, i) => {
            const d = CINTA(xHub + NODO_W, anclaOut, xD, n.y, n.h);
            anclaOut += n.h;
            const act = hover === null || hover === `d${i}`;
            return (
              <path key={`ld${i}`} d={d} fill={n.color} opacity={act ? 0.3 : 0.07}
                onMouseEnter={() => setHover(`d${i}`)} onMouseLeave={() => setHover(null)} />
            );
          })}

          {/* Nodos izquierda */}
          {nodosF.map((n, i) => (
            <g key={`nf${i}`} onMouseEnter={() => setHover(`f${i}`)} onMouseLeave={() => setHover(null)}>
              <rect x={xF} y={n.y} width={NODO_W} height={n.h} rx={2} fill="#22c55e" />
              <text x={xF - 10} y={n.y + n.h / 2 - 2} textAnchor="end" fontSize="12" fontWeight="600" fill={T.tx}>
                {n.nombre.length > 26 ? n.nombre.slice(0, 25) + "…" : n.nombre}
              </text>
              <text x={xF - 10} y={n.y + n.h / 2 + 12} textAnchor="end" fontSize="11" fontFamily="monospace" fill={T.tx3}>
                {fmt(Math.round(n.valor))}
              </text>
            </g>
          ))}

          {/* Hub */}
          <rect x={xHub} y={hubY} width={NODO_W} height={hubH} rx={2} fill={T.tx} opacity={0.85} />
          <text x={xHub + NODO_W / 2} y={hubY - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={T.tx2}>
            INGRESO BRUTO
          </text>
          <text x={xHub + NODO_W / 2} y={hubY + hubH + 18} textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="monospace" fill={T.tx}>
            {fmt(Math.round(bruto))}
          </text>

          {/* Nodos derecha */}
          {nodosD.map((n, i) => (
            <g key={`nd${i}`} onMouseEnter={() => setHover(`d${i}`)} onMouseLeave={() => setHover(null)}>
              <rect x={xD} y={n.y} width={NODO_W} height={n.h} rx={2} fill={n.color} />
              <text x={xD + NODO_W + 10} y={n.y + n.h / 2 - 2} fontSize="12" fontWeight="600" fill={T.tx}>
                {n.nombre.length > 24 ? n.nombre.slice(0, 23) + "…" : n.nombre}
                <tspan fill={T.tx3} fontWeight="400"> · {pct(n.valor)}%</tspan>
              </text>
              <text x={xD + NODO_W + 10} y={n.y + n.h / 2 + 12} fontSize="11" fontFamily="monospace" fill={T.tx3}>
                {fmt(Math.round(n.valor))}{n.nota ? ` · ${n.nota}` : ""}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {deficit > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "9px 12px" }}>
          ⚠️ Este mes sale más de lo que entra: te faltan <strong>{fmt(Math.round(deficit))}</strong>. La diferencia se cubre con ahorros o con más deuda.
        </div>
      )}
    </div>
  );
}
