// 24-oct-2026 — Modo demo NUNCA escribe en la cuenta real.
// Antes, abrir los datos de ejemplo pasaba por sS() (localStorage + upsert a
// user_data) y pisaba la cuenta real. Ahora la demo vive solo en memoria:
// no se guarda en Supabase, ni en la caché local (SK), ni en snapshots.
// Al salir se recarga la cuenta real desde Supabase (o desde la copia en
// memoria tomada al entrar).

export const esDemo = (d) => !!(d && d.p && d.p.demo);

// Caché local: nunca devolver datos demo como si fueran de la cuenta
// (una versión vieja pudo dejarlos ahí y el próximo guardado los subiría).
export const leerCache = (raw) => {
  if (!raw) return null;
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    return esDemo(d) ? null : d;
  } catch {
    return null;
  }
};

// Copia de la cuenta real al entrar a la demo (solo si lo actual no es demo).
export const guardarReal = (ref, actual) => {
  if (actual && !esDemo(actual)) ref.current = actual;
};

// Datos reales al salir: primero Supabase, luego la copia en memoria,
// luego cuenta en blanco. Nunca devuelve datos demo.
export const datosAlSalir = async ({ recargar, ref, enBlanco }) => {
  let d = null;
  try { d = recargar ? await recargar() : null; } catch { d = null; }
  if (!d || esDemo(d)) d = ref && ref.current && !esDemo(ref.current) ? ref.current : null;
  if (ref) ref.current = null;
  return d || enBlanco();
};
