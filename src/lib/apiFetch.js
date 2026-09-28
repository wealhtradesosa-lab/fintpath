// 28-sep-2026 — fetch con la sesión de Supabase adjunta.
// Las funciones de Netlify que cuestan dinero (IA) o tocan datos ajenos
// (admin) ahora exigen el access token y verifican de quién es en el
// servidor. Sin token responden 401 sesion_requerida.
import { supabase } from "./supabase";

export async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function fetchAuth(url, opts = {}) {
  const auth = await authHeaders();
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...auth } });
}
