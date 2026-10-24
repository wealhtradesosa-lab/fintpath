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
