/** 24-oct-2026 (Finanzas/Soporte, PR #56): estado de la TRM para pantallas que usan dólares.
 *  carga: "cargando" | "ok" | "fallo". El 4.200 por defecto nunca cuenta como tasa válida. */
export const esTasaReal = (j) => !!j && Number(j.trm) > 0 && j.source !== "default";
export function resolverTasa(carga, u) {
  if (carga === "ok" && Number(u?.trm) > 0) return { estado: "ok", trm: u.trm, fecha: u.trmFecha || null };
  if (carga === "fallo" && Number(u?.trm) > 0 && u.trmSrc && u.trmSrc !== "default") return { estado: "respaldo", trm: u.trm, fecha: u.trmFecha || null };
  return { estado: "cargando", trm: null, fecha: null };
}
