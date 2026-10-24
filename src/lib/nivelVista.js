// 24-oct-2026 — Textos de la tarjeta «Tu Nivel de Libertad Financiera».
// Luis veía la barra llena con «136%», el texto «la barra topa en 100% — vas en
// 136%», el badge en Abundancia y abajo un cuadro que decía «¡Independencia!».
// Todo sale ahora de UN solo nivel (metrics.js → nivelLibertad) y de los mismos
// umbrales en plata (umbralNivel). Este módulo solo arma las frases.
import { NIVELES, umbralNivel, fmtPctEs } from "./metrics.js";

/**
 * @param {{ip:number, ob:number, nivel:object|null}} p  nivel = salida de nivelLibertad
 * @returns {null | { nombre, n, pct, sobraPct, titular, desborde, siguiente, faltaSiguiente }}
 */
export function vistaNivel({ ip = 0, ob = 0, nivel = null } = {}) {
  if (!(ob > 0) || !nivel?.nivel) return null;
  const n = nivel.nivel;
  const nombre = NIVELES[n - 1].nombre;
  const pct = Math.round((ip / ob) * 100);
  const sobraPct = pct > 100 ? pct - 100 : 0;
  const titular = `Estás en ${nombre} (nivel ${n}/5). Tu ingreso pasivo cubre el ${fmtPctEs(pct, 0)} de tus gastos y cuotas`
    + (sobraPct > 0 ? `: te sobra un ${fmtPctEs(sobraPct, 0)} cada mes.` : ".");
  const desborde = sobraPct > 0 ? `+${fmtPctEs(sobraPct, 0)} por encima` : null;
  const sig = n < 5 ? NIVELES[n] : null;
  const ctx = { ob, obEsencial: nivel.obEsencial || ob };
  const meta = sig ? umbralNivel(sig, ctx) : null;
  return {
    nombre, n, pct, sobraPct, titular, desborde,
    siguiente: sig ? sig.nombre : null,
    faltaSiguiente: meta != null ? Math.max(0, meta - ip) : null,
  };
}

/** Estado de cada tarjeta: "pasado" (✓, apagado), "actual" (resaltado) o "pendiente". */
export function estadoNivel(id, actual) {
  if (!actual) return "pendiente";
  return id < actual ? "pasado" : id === actual ? "actual" : "pendiente";
}

// Escala de la barra: 0–150%. Así Abundancia (130%) queda adentro con margen y
// un 136% se ve pasado de esa marca, en vez de llenar la barra entera.
export const TOPE_BARRA = 1.5;
export function posEnBarra(cobertura) {
  return Math.max(0, Math.min((cobertura / TOPE_BARRA) * 100, 100));
}

/**
 * Meta de cada tarjeta. Déficit no tiene meta (es el punto de partida).
 * Estabilidad usa la regla que ya existe en nivelLibertad: se llega con el
 * flujo del mes ≥ $0 (lo que entra cubre lo que sale), no con ingreso pasivo.
 * Seguridad / Independencia / Abundancia: ingreso pasivo de umbralNivel.
 */
export function metaNivel(def, ctx) {
  if (!def || def.clave === "deficit") return null;
  if (def.clave === "estabilidad") return { tipo: "flujo", monto: 0 };
  return { tipo: "pasivo", monto: umbralNivel(def, ctx) };
}

/** Nombres de los ingresos ocultos (sim === false), sin montos. */
export function nombresOcultos(ingresos = []) {
  return (ingresos || []).filter((i) => i && i.sim === false)
    .map((i) => String(i.nombre || i.categoria || "Ingreso sin nombre"));
}
