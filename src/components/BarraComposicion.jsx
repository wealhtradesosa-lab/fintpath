import { fmtPctEs } from "../lib/formato.js";
/**
 * BarraComposicion — La proporción en 44px en vez de 260.
 *
 * 25-jul-2026 (Santiago: "esos recuadros ocupan mucho espacio"). El treemap
 * comunicaba bien, pero pedía 200-260px de alto y debajo la lista repetía los
 * mismos datos: dos veces la misma información pagando doble espacio.
 *
 * Una barra apilada da la misma lectura de proporción —qué domina, qué es
 * marginal— en una fracción del alto. El detalle exacto vive en la lista, que
 * ya estaba ahí, y cada fila lleva su propia barra de fondo: el gráfico y los
 * datos dejan de ser dos cosas separadas.
 *
 * Lo que se pierde respecto al treemap: la comparación de áreas entre
 * elementos medianos es menos precisa. Lo que se gana: 200px por tarjeta y
 * cero duplicación. Para una composición donde importa "qué domina", el
 * intercambio conviene.
 */
export default function BarraComposicion({ datos = [], total = 0, paleta = [], T, altura = 44 }) {
  const items = (datos || []).filter((d) => d && d.value > 0).sort((a, b) => b.value - a.value);
  if (!items.length) return null;

  const suma = items.reduce((s, i) => s + i.value, 0);
  const base = total > 0 ? total : suma;
  const COLORES = paleta.length ? paleta : ["#00c805","#3b82f6","#64748b","#94a3b8","#475569","#b4bfcc","#334155","#7a8699"];

  return (
    <div style={{ display: "flex", height: altura, borderRadius: 8, overflow: "hidden", gap: 2 }}>
      {items.map((d, i) => {
        const pct = (d.value / base) * 100;
        const color = COLORES[i % COLORES.length];
        // Solo se etiqueta lo que entra sin apretarse. El resto se identifica
        // por color contra la lista de abajo.
        // 26-jul-2026 (Santiago: "no se lee casi el texto, muy pequeño").
        // Con el % más grande (13px) hace falta más espacio: por debajo de 12%
        // el número queda apretado contra los bordes y se lee peor que si no
        // estuviera. Esas franjas se identifican por color contra la leyenda.
        const cabe = pct >= 12;
        return (
          <div
            key={d.name + i}
            title={`${d.name} · ${fmtPctEs(pct, 1)}`}
            style={{
              width: `${pct}%`,
              background: color,
              opacity: 0.9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 3,
            }}
          >
            {cabe && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-bg)", fontFamily: "monospace" }}>
                {fmtPctEs(pct, 0)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
