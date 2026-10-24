// 24-oct-2026 — No guardar encima de la cuenta real con la copia vieja (fp3).
// Antes, si la lectura de user_data fallaba (error, timeout o cifrado sin
// llave) la app cargaba la copia de localStorage y el autoguardado la subía,
// pisando los datos reales. Ahora se distingue:
//   · "ok"    → hay fila en el servidor: se usa.
//   · "nuevo" → el servidor respondió bien y no hay fila: onboarding normal.
//   · "error" → no sabemos qué hay en el servidor: se muestra la copia local
//               solo para leer y se bloquea todo guardado hasta reconectar.

export const AVISO_NO_SINCRONIZADO =
  "No pudimos cargar tus datos más recientes. Lo que ves puede estar desactualizado; no guardamos cambios hasta reconectar.";

let _noSincronizado = false;
const _oyentes = new Set();
export const datosNoSincronizados = () => _noSincronizado;
export const marcarNoSincronizados = (v) => {
  const n = !!v;
  if (n === _noSincronizado) return;
  _noSincronizado = n;
  _oyentes.forEach((f) => { try { f(n); } catch {} });
};
export const alCambiarSincronizacion = (f) => { _oyentes.add(f); return () => _oyentes.delete(f); };

// Ejecuta la lectura con timeout. `leer` debe devolver {data,error} de supabase.
// `procesar(row)` convierte la fila en datos de la app; si lanza (p. ej. no se
// pudo descifrar) cuenta como error, nunca como usuario nuevo.
export const leerUserData = async ({ leer, procesar, timeoutMs = 8000 }) => {
  let timer;
  try {
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout leyendo user_data")), timeoutMs); });
    const res = await Promise.race([Promise.resolve().then(leer), timeout]);
    if (!res || res.error) return { estado: "error", error: res?.error || new Error("sin respuesta") };
    if (!res.data || !res.data.data) return { estado: "nuevo", datos: null };
    const datos = await procesar(res.data);
    if (!datos) return { estado: "error", error: new Error("no se pudo leer la fila") };
    return { estado: "ok", datos };
  } catch (error) {
    return { estado: "error", error };
  } finally {
    clearTimeout(timer);
  }
};
