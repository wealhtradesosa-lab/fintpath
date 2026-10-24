/** 24-oct-2026 (Finanzas/Soporte, PR #56): estado de la TRM para pantallas que usan dólares.
 *  carga: "cargando" | "ok" | "fallo". El 4.200 por defecto nunca cuenta como tasa válida. */
export const esTasaReal = (j) => !!j && Number(j.trm) > 0 && j.source !== "default";
export function resolverTasa(carga, u) {
  if (carga === "ok" && Number(u?.trm) > 0) return { estado: "ok", trm: u.trm, fecha: u.trmFecha || null };
  if (carga === "fallo" && Number(u?.trm) > 0 && u.trmSrc && u.trmSrc !== "default") return { estado: "respaldo", trm: u.trm, fecha: u.trmFecha || null };
  // Falló la fuente y no hay tasa real guardada: respaldo SIN número (nunca el 4.200).
  if (carga === "fallo") return { estado: "respaldo", trm: null, fecha: null };
  return { estado: "cargando", trm: null, fecha: null };
}

/** fetch con límite de tiempo (por defecto 5 s): si la red cuelga, se rechaza y se pasa a respaldo. */
export const TRM_TIMEOUT_MS = 5000;
export async function traerTrm(f = (typeof fetch !== "undefined" ? fetch : null), ms = TRM_TIMEOUT_MS) {
  if (!f) throw new Error("sin fetch");
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  let id;
  const limite = new Promise((_, rej) => { id = setTimeout(() => { try { ctl && ctl.abort(); } catch { /* */ } rej(new Error("timeout /api/trm")); }, ms); });
  try {
    const r = await Promise.race([f("/api/trm", ctl ? { signal: ctl.signal } : undefined), limite]);
    return await Promise.race([r.json(), limite]);
  } finally { clearTimeout(id); }
}
