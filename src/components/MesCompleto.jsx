// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · El mes completo: de dónde viene la plata y a dónde se va
//
// 25-oct-2026 (Santiago: "deberíamos tener la gráfica que muestra de dónde
// viene la plata y para dónde se va… en el HTML está muy bien"). Sankey del
// primer año, al mes: a la izquierda cada renta e ingreso, en el centro lo que
// entra, a la derecha los gastos y lo que sobra repartido en sus destinos.
// ═══════════════════════════════════════════════════════════════════════════
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import { INF, fmM } from "../lib/informeTheme.js";
import { anioCal } from "../lib/futuro10.js";

const MAX = 6;
function agrupar(lista, otros) {
  const xs = (lista || []).filter((x) => x.mensual > 0.5).sort((a, b) => b.mensual - a.mensual);
  const top = xs.slice(0, MAX), resto = xs.slice(MAX).reduce((s, x) => s + x.mensual, 0);
  return resto > 0.5 ? [...top, { nombre: otros, mensual: resto }] : top;
}

function Nodo({ x, y, width, height, payload }) {
  const izq = payload.lado === "izq", centro = payload.lado === "centro";
  const color = payload.color || INF.gris;
  const tx = izq ? x - 6 : x + width + 6;
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(2, height)} fill={color} rx={2} />
      {height > 6 && <text x={centro ? x + width / 2 : tx} y={centro ? y - 6 : y + height / 2} textAnchor={centro ? "middle" : izq ? "end" : "start"} dominantBaseline="middle" fill={INF.tx} fontSize={11}>
        {String(payload.name).slice(0, 30)} <tspan fill={INF.tx2}>{fmM(payload.valor)}</tspan>
      </text>}
    </g>
  );
}

export default function MesCompleto({ r, card, h3, lead }) {
  const d = r.desglose || {};
  const f1 = (r.filas || [])[1] || {};
  const sobra = (f1.cf || 0) / 12;
  const entra = agrupar(d.entra, "Otros ingresos");
  const sale = agrupar(d.sale, "Otros gastos");
  if (!entra.length && !sale.length) return null;
  const nodes = [], links = [];
  const add = (name, valor, lado, color) => { nodes.push({ name, valor, lado, color }); return nodes.length - 1; };
  const centro = add(sobra < -0.5 ? "Total del mes" : "Lo que entra al mes", entra.reduce((s, x) => s + x.mensual, 0) + Math.max(0, -sobra), "centro", INF.navy);
  entra.forEach((x, i) => links.push({ source: add(x.nombre, x.mensual, "izq", INF.serie[i % INF.serie.length]), target: centro, value: x.mensual }));
  if (sobra < -0.5) links.push({ source: add("Sale de tu liquidez", -sobra, "izq", INF.bad), target: centro, value: -sobra });
  sale.forEach((x) => links.push({ source: centro, target: add(x.nombre, x.mensual, "der", INF.teja), value: x.mensual }));
  if (sobra > 0.5) {
    const lista = (r.destinoSobraLista && r.destinoSobraLista.length ? r.destinoSobraLista : [{ nombre: "Se reinvierte", pct: 100 }]);
    lista.forEach((dd) => { const v = sobra * dd.pct / 100; if (v > 0.5) links.push({ source: centro, target: add(`Sobra → ${dd.nombre}`, v, "der", INF.oliva), value: v }); });
  }
  const alto = Math.max(280, Math.max(entra.length + 1, sale.length + 4) * 44);
  const tip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload || {};
    if (!((p.value ?? p.valor) > 0.5)) return null;
    const txt = p.source && p.target ? `${p.source.name} → ${p.target.name}` : p.name;
    return <div style={{ background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 8, padding: "6px 10px", color: INF.tx, fontSize: 12 }}>{txt}: <b>{fmM(p.value ?? p.valor)}</b></div>;
  };
  return (
    <div style={card}>
      <h3 style={h3}>El mes completo: de dónde viene la plata y a dónde se va</h3>
      <p style={lead}>En {anioCal(1)}, al mes. A la izquierda, cada renta e ingreso; a la derecha, en qué se va: gastos y cuotas en rojo, y lo que sobra en verde con la inversión a la que va.</p>
      <div style={{ overflowX: "auto" }}><div style={{ minWidth: 640 }}>
        <ResponsiveContainer width="100%" height={alto}>
          <Sankey data={{ nodes, links }} node={<Nodo />} nodePadding={18} nodeWidth={10} margin={{ top: 24, right: 210, bottom: 10, left: 210 }} link={{ stroke: INF.eje, strokeOpacity: 0.35 }} iterations={32}>
            <Tooltip content={tip} />
          </Sankey>
        </ResponsiveContainer>
      </div></div>
    </div>
  );
}
