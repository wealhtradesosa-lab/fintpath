// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA — Design Tokens (Commit 9.9)
// ─────────────────────────────────────────────────────────────────────────
// Fuente única de verdad para colores, tipografía, spacing y bordes.
//
// Antes había 3 nombres distintos para el mismo color (T.bl / T.blue / blue),
// 5 tamaños de fuente mezclados (9, 10, 11, 12, 13, 14, 18, 22) y paddings
// arbitrarios (8, 10, 12, 14, 16, 18, 20, 22, 24). Eso es lo que hace que
// el sitio se vea "amateur" — falta de consistencia, no falta de diseño.
//
// Este archivo unifica todo bajo 4 categorías mínimas:
//   C — Colors (10 tokens)
//   F — Fonts/Typography (6 niveles)
//   S — Spacing (5 niveles, escala 4-8-16-24-32)
//   R — Radius/Border (3 niveles)
//
// USO:
//   import { C, F, S, R } from '@/lib/designTokens';
//   <div style={{ background: C.surface, padding: S.md, borderRadius: R.lg }}>
//     <h2 style={F.h1}>Título</h2>
//   </div>
// ═══════════════════════════════════════════════════════════════════════════

// ─── COLORES ────────────────────────────────────────────────────────────
export const C = {
  // Backgrounds (3 niveles de profundidad)
  bg:      "#0c0c0f",  // page background
  surface: "#141418",  // cards y contenedores principales
  raised:  "#1e1e24",  // hover, inputs, sub-cards

  // Text (3 niveles de jerarquía)
  text:    "#fafafa",  // primary content
  muted:   "#a1a1aa",  // secondary, subtitles
  subtle:  "#71717a",  // tertiary, captions, hints

  // Borders & dividers
  border:        "rgba(255,255,255,0.08)",
  borderStrong:  "rgba(255,255,255,0.15)",  // hover state

  // Acentos semánticos (4 colores con propósito claro)
  accent: "#3b82f6",  // azul — primary actions, info, selected state
  ok:     "#22c55e",  // verde — success, savings, completed
  warn:   "#f97316",  // naranja — warnings, gaps, partial
  danger: "#ef4444",  // rojo — errors, taxes owed
  purple: "#a78bfa",  // morado — solo para ganancias ocasionales (cédula especial)
};

// Variantes con opacidad — para fondos sutiles de cada acento
export const Cα = {
  accent08: "rgba(59,130,246,0.08)",
  accent15: "rgba(59,130,246,0.15)",
  accent25: "rgba(59,130,246,0.25)",
  ok08:     "rgba(34,197,94,0.08)",
  ok15:     "rgba(34,197,94,0.15)",
  ok25:     "rgba(34,197,94,0.25)",
  warn08:   "rgba(249,115,22,0.08)",
  warn15:   "rgba(249,115,22,0.15)",
  warn25:   "rgba(249,115,22,0.25)",
  danger08: "rgba(239,68,68,0.08)",
};

// ─── TIPOGRAFÍA ─────────────────────────────────────────────────────────
// Solo 6 niveles. Antes había 8+. Cada nivel con propósito específico.
export const F = {
  display: { fontSize: 28, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 },
  h1:      { fontSize: 22, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 },
  h2:      { fontSize: 16, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.35 },
  h3:      { fontSize: 13, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.4 },
  body:    { fontSize: 13, fontWeight: 400, color: C.muted, margin: 0, lineHeight: 1.5 },
  caption: { fontSize: 11, fontWeight: 400, color: C.subtle, margin: 0, lineHeight: 1.4 },
  label:   { fontSize: 10, fontWeight: 600, color: C.subtle, margin: 0, lineHeight: 1.4, textTransform: "uppercase", letterSpacing: 0.5 },
  mono:    { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 14, fontWeight: 700 },
  monoLg:  { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 18, fontWeight: 700 },
  monoXl:  { fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 22, fontWeight: 700 },
};

// ─── SPACING ────────────────────────────────────────────────────────────
// Escala 4/8/12/16/24/32 — múltiplos de 4 para alineación pixel-perfect.
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// ─── RADIUS ─────────────────────────────────────────────────────────────
export const R = {
  sm: 6,   // botones chicos, badges
  md: 8,   // botones default, inputs, secciones internas
  lg: 12,  // cards principales
  xl: 16,  // modals, hero cards
  pill: 999, // badges redondos completos
};

// ─── BREAKPOINTS (referencia) ────────────────────────────────────────────
// No usamos media queries por ahora (todo es CSS-in-JS estático),
// pero usamos `auto-fit + minmax` para responsive natural.
export const BP = {
  mobile:  480,
  tablet:  768,
  desktop: 1024,
  wide:    1280,
};

// ─── HELPERS de composición ──────────────────────────────────────────────
// Cards consistentes con un solo helper.
export const card = (variant = "default") => {
  const base = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: S.lg };
  if (variant === "raised") return { ...base, background: C.raised };
  if (variant === "ok")     return { ...base, background: Cα.ok08, borderColor: Cα.ok25 };
  if (variant === "warn")   return { ...base, background: Cα.warn08, borderColor: Cα.warn25 };
  if (variant === "accent") return { ...base, background: Cα.accent08, borderColor: Cα.accent25 };
  return base;
};

// Botones consistentes.
export const button = (variant = "primary", size = "md") => {
  const sizes = {
    sm: { padding: `${S.xs}px ${S.md}px`, fontSize: 11, borderRadius: R.sm },
    md: { padding: `${S.sm}px ${S.lg}px`, fontSize: 12, borderRadius: R.md },
    lg: { padding: `${S.md}px ${S.xl}px`, fontSize: 13, borderRadius: R.md },
  };
  const variants = {
    primary:   { background: C.accent, color: "#fff", border: "none" },
    success:   { background: C.ok, color: "#000", border: "none" },
    secondary: { background: C.raised, color: C.text, border: `1px solid ${C.border}` },
    ghost:     { background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    danger:    { background: C.danger, color: "#fff", border: "none" },
  };
  return { ...sizes[size], ...variants[variant], fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
};
