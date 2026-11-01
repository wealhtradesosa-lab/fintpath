// Estilos compartidos de las infografías (1-nov-2026).
// Colores por variables del tema (claro/oscuro): --fp-pos, --fp-neg, --fp-txt*.
// En SVG van por `style`, no como atributo: Safari no resuelve var() en
// atributos de presentación.

// Tramas (de oscuro a claro) de un color del tema.
export const trama = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export const C = {
  azul: "var(--fp-azul)",
  pos: "var(--fp-pos)",
  neg: "var(--fp-neg)",
  txt: "var(--fp-txt)",
  txt2: "var(--fp-txt2)",
  txt3: "var(--fp-txt3)",
  card: "var(--fp-card)",
  linea: "rgba(var(--fp-ink),0.08)",
  pista: "rgba(var(--fp-ink),0.08)",
  neutro: "rgba(var(--fp-ink),0.38)",
};

export const tarjeta = {
  background: "var(--fp-card)",
  border: "1px solid rgba(var(--fp-ink),0.08)",
  borderRadius: 16,
  padding: "clamp(20px, 3vw, 28px)",
  minWidth: 0,
};

export const titulo = { margin: 0, fontSize: 19, fontWeight: 600, color: "var(--fp-txt)", letterSpacing: "-0.01em" };
export const subtitulo = { fontSize: 13, color: "var(--fp-txt2)", marginTop: 4, lineHeight: 1.45 };
export const cifra = { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" };

// Movimiento sobrio: ≤ 600 ms, sin rebotes, respetando reduced-motion.
export const CSS_INFOGRAFIA = `
@keyframes fpi-dibujar { from { stroke-dashoffset: var(--fpi-largo, 400); } to { stroke-dashoffset: 0; } }
@keyframes fpi-aparecer { from { opacity: 0; } to { opacity: 1; } }
@keyframes fpi-crecer { from { transform: scaleY(0); } to { transform: scaleY(1); } }
.fpi-arco { stroke-dasharray: var(--fpi-largo, 400); animation: fpi-dibujar .6s cubic-bezier(.2,.8,.2,1) both; }
.fpi-fade { animation: fpi-aparecer .5s cubic-bezier(.2,.8,.2,1) both; }
.fpi-barra { transform-box: fill-box; transform-origin: bottom; animation: fpi-crecer .5s cubic-bezier(.2,.8,.2,1) both; }
.fpi-banda { transition: opacity .2s ease; }
.fpi-sankey:hover .fpi-banda { opacity: .35; }
.fpi-sankey .fpi-banda:hover { opacity: 1; }
.fpi-bloque { transition: opacity .2s ease; }
.fpi-mapa:hover .fpi-bloque { opacity: .55; }
.fpi-mapa .fpi-bloque:hover { opacity: 1; }
.fpi-solo-movil { display: none; }
@media (max-width: 640px) {
  .fpi-solo-escritorio { display: none !important; }
  .fpi-solo-movil { display: flex; }
}
@media (prefers-reduced-motion: reduce) {
  .fpi-arco, .fpi-fade, .fpi-barra { animation: none; }
}
`;
