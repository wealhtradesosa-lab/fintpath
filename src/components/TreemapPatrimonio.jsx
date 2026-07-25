/**
 * TreemapPatrimonio — La composición del patrimonio, donde el área ES la plata.
 *
 * 25-jul-2026. Reemplaza la dona con leyenda de nueve líneas. El problema de la
 * dona: para saber que el 68% está en Real Estate había que LEER la leyenda y
 * comparar números. La concentración —el dato que más importa de una
 * distribución patrimonial— quedaba escondida en una tabla.
 *
 * Acá el bloque grande es grande porque hay más plata. Es el mismo principio
 * que hace funcionar al Sankey: la geometría carga el significado, no el texto.
 *
 * SVG a mano, sin dependencias. Algoritmo squarified simplificado: se van
 * partiendo franjas alternando orientación, lo que mantiene los rectángulos
 * cerca del cuadrado y por lo tanto comparables entre sí.
 */

const PALETA = ["#22c55e", "#3b82f6", "#a78bfa", "#eab308", "#f97316", "#ec4899", "#14b8a6", "#8b5cf6", "#64748b"];

/**
 * Reparte items en un rectángulo alternando cortes horizontales y verticales.
 * Cada corte separa el item más grande del resto, proporcional a su valor.
 */
function repartir(items, x, y, w, h, salida = []) {
  if (!items.length) return salida;
  if (items.length === 1) {
    salida.push({ ...items[0], x, y, w, h });
    return salida;
  }
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return salida;

  const primero = items[0];
  const resto = items.slice(1);
  const fraccion = primero.value / total;
  const horizontal = w >= h;

  if (horizontal) {
    const ancho = w * fraccion;
    salida.push({ ...primero, x, y, w: ancho, h });
    return repartir(resto, x + ancho, y, w - ancho, h, salida);
  }
  const alto = h * fraccion;
  salida.push({ ...primero, x, y, w, h: alto });
  return repartir(resto, x, y + alto, w, h - alto, salida);
}

export default function TreemapPatrimonio({ datos = [], total = 0, fmt, T, altura = 260 }) {
  const items = (datos || []).filter((d) => d && d.value > 0).sort((a, b) => b.value - a.value);
  if (!items.length) return null;

  const W = 700, H = altura;
  const suma = items.reduce((s, i) => s + i.value, 0);
  const base = total > 0 ? total : suma;

  // Agrupar la cola larga: bloques bajo 1.5% son ilegibles y ensucian.
  const UMBRAL = suma * 0.015;
  const visibles = items.filter((i) => i.value >= UMBRAL);
  const cola = items.filter((i) => i.value < UMBRAL);
  const colaSuma = cola.reduce((s, i) => s + i.value, 0);
  const finales = colaSuma > 0
    ? [...visibles, { name: `Otros (${cola.length})`, value: colaSuma }]
    : visibles;

  const bloques = repartir(finales, 0, 0, W, H);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", borderRadius: 10 }}>
        {bloques.map((b, i) => {
          const pct = (b.value / base) * 100;
          const color = PALETA[i % PALETA.length];
          // Solo se etiqueta lo que entra sin apretarse: un texto cortado
          // ensucia más de lo que informa.
          const cabeNombre = b.w > 76 && b.h > 34;
          const cabeCifra = b.w > 76 && b.h > 52;
          return (
            <g key={b.name + i}>
              <rect
                x={b.x + 1.5} y={b.y + 1.5}
                width={Math.max(b.w - 3, 0)} height={Math.max(b.h - 3, 0)}
                rx={7}
                fill={color} fillOpacity={0.16}
                stroke={color} strokeOpacity={0.55} strokeWidth={1.2}
              />
              {cabeNombre && (
                <text x={b.x + 12} y={b.y + 24} fill={T.tx} fontSize={12} fontWeight={700}>
                  {b.name.length > Math.floor(b.w / 7.5) ? b.name.slice(0, Math.floor(b.w / 7.5) - 1) + "…" : b.name}
                </text>
              )}
              {cabeCifra && (
                <>
                  <text x={b.x + 12} y={b.y + 43} fill={color} fontSize={13} fontWeight={800} fontFamily="monospace">
                    {pct.toFixed(pct >= 10 ? 0 : 1)}%
                  </text>
                  {b.h > 70 && (
                    <text x={b.x + 12} y={b.y + 60} fill={T.tx3} fontSize={10.5} fontFamily="monospace">
                      {fmt ? fmt(b.value) : b.value}
                    </text>
                  )}
                </>
              )}
              <title>{`${b.name} · ${fmt ? fmt(b.value) : b.value} · ${pct.toFixed(1)}%`}</title>
            </g>
          );
        })}
      </svg>

      {/* Leyenda solo para lo que no cupo etiquetado */}
      {bloques.some((b) => !(b.w > 76 && b.h > 34)) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          {bloques.filter((b) => !(b.w > 76 && b.h > 34)).map((b, i) => {
            const idx = bloques.indexOf(b);
            return (
              <div key={b.name + i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.tx3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETA[idx % PALETA.length], display: "inline-block" }} />
                {b.name} · {((b.value / base) * 100).toFixed(1)}%
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
