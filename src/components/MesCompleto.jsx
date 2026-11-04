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
// 3-nov-2026: textos según el idioma de la sesión. Se importa como «tr» porque
// «tx» ya es la coordenada x de la etiqueta en Nodo.
import { tx as tr } from "../lib/region.js";

const MAX = 6;
// Ingresos en tonos de azul y verde (lo que entra): nunca el rojo de los gastos.
const TONOS_ENTRA = ["#2E6F9E", "#5B8C5A", "#3C7FB0", "#4E9A7A", "#5A86B8", "#3C9C9C", "#7A9CC6"];
const corto = (t, n = 30) => { const x = String(t || ""); return x.length > n ? x.slice(0, n - 1).trimEnd() + "…" : x; };
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
      <rect x={x} y={y} width={width} height={Math.max(2, height)} fill={color} rx={2} style={centro ? { fill: "var(--fp-txt)" } : undefined} />
      {height > 6 && <text x={centro ? x + width / 2 : tx} y={centro ? y - 6 : y + height / 2} textAnchor={centro ? "middle" : izq ? "end" : "start"} dominantBaseline="middle" style={{ fill: INF.tx }} fontSize={11}>
        <title>{`${payload.name}: ${fmM(payload.valor)}`}</title>{corto(payload.name)} <tspan style={{ fill: INF.tx2 }}>{fmM(payload.valor)}</tspan>
      </text>}
    </g>
  );
}

// 2-nov-2026 (Santiago: «el flujo en ese gris tan claro casi no se ve»). Las
// bandas usaban el color de la línea del eje (#ececee en claro) al 35 %: blanco
// sobre blanco. Ahora cada banda toma el color de lo que representa —a la
// izquierda el de su ingreso, a la derecha el del gasto o lo que sobra— y se
// resalta al pasar el mouse. Hex en el atributo (Safari no lee var() en SVG).
function Banda({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) {
  const s = payload && payload.source, t = payload && payload.target;
  const color = (s && s.lado === "izq" ? s.color : t && t.color) || INF.azul;
  const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
  return <path className="fpm-banda" d={d} fill="none" stroke={color} strokeWidth={Math.max(1, linkWidth)} />;
}

export default function MesCompleto({ r, card, h3, lead }) {
  const d = r.desglose || {};
  const f1 = (r.filas || [])[1] || {};
  const sobra = (f1.cf || 0) / 12;
  const entra = agrupar(d.entra, tr("Otros ingresos", "Other income"));
  const sale = agrupar(d.sale, tr("Otros gastos", "Other expenses"));
  if (!entra.length && !sale.length) return null;
  const nodes = [], links = [];
  const add = (name, valor, lado, color) => { nodes.push({ name, valor, lado, color }); return nodes.length - 1; };
  const centro = add(sobra < -0.5 ? tr("Total del mes", "Monthly total") : tr("Lo que entra al mes", "Monthly income"), entra.reduce((s, x) => s + x.mensual, 0) + Math.max(0, -sobra), "centro", INF.navy);
  entra.forEach((x, i) => links.push({ source: add(x.nombre, x.mensual, "izq", TONOS_ENTRA[i % TONOS_ENTRA.length]), target: centro, value: x.mensual }));
  if (sobra < -0.5) links.push({ source: add(tr("Sale de tu liquidez", "From your cash"), -sobra, "izq", INF.bad), target: centro, value: -sobra });
  sale.forEach((x) => links.push({ source: centro, target: add(x.nombre, x.mensual, "der", INF.teja), value: x.mensual }));
  if (sobra > 0.5) {
    const lista = (r.destinoSobraLista && r.destinoSobraLista.length ? r.destinoSobraLista : [{ nombre: tr("Se reinvierte", "Reinvested"), pct: 100 }]);
    lista.forEach((dd) => { const v = sobra * dd.pct / 100; if (v > 0.5) links.push({ source: centro, target: add(`${tr("Sobra", "Surplus")} → ${dd.nombre}`, v, "der", INF.oliva), value: v }); });
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
      <h3 style={h3}>{tr("El mes completo: de dónde viene la plata y a dónde se va", "The full month: where money comes from and where it goes")}</h3>
      <p style={lead}>{tr(`En ${anioCal(1)}, al mes. A la izquierda, cada renta e ingreso; a la derecha, en qué se va: gastos y cuotas en rojo, y lo que sobra en verde con la inversión a la que va.`, `In ${anioCal(1)}, per month. Left: each source of income. Right: where it goes — expenses and loan payments in red, and the surplus in green with the investment it goes to.`)}</p>
      <style>{`.fpm-banda { stroke-opacity: .42; transition: stroke-opacity .2s ease; } html[data-tema="claro"] .fpm-banda { stroke-opacity: .5; } .fpm-flujo:hover .fpm-banda { stroke-opacity: .18; } .fpm-flujo .fpm-banda:hover { stroke-opacity: .75; }`}</style>
      <div className="fpm-flujo" style={{ overflowX: "auto" }}><div style={{ minWidth: 820 }}>
        <ResponsiveContainer width="100%" height={alto}>
          <Sankey data={{ nodes, links }} node={<Nodo />} nodePadding={18} nodeWidth={10} margin={{ top: 28, right: 250, bottom: 10, left: 250 }} link={<Banda />} iterations={32}>
            <Tooltip content={tip} />
          </Sankey>
        </ResponsiveContainer>
      </div></div>
    </div>
  );
}
