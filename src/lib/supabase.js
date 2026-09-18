import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey && supabaseUrl.includes("supabase.co"));

/**
 * 18-sep-2026 — flowType PKCE.
 *
 * EL PROBLEMA QUE RESUELVE, con datos reales de la base:
 * De cinco usuarios que pidieron recuperar contraseña, dos "iniciaron sesión"
 * exactamente 10,6 y 10,8 segundos después de que saliera el correo, y uno
 * nunca logró entrar. Diez segundos no es una persona abriendo el correo: es
 * el escáner de seguridad del servidor de correo abriendo el enlace para
 * verificar que sea seguro.
 *
 * Con el flujo implícito (el default) esos enlaces son de un solo uso y se
 * verifican con un simple GET, así que el escáner los CONSUME. Cuando la
 * persona hace clic, el enlace ya está gastado y no pasa nada. Es un problema
 * conocido con dominios corporativos, y también lo hacen algunos filtros de
 * Gmail.
 *
 * PKCE lo resuelve de raíz: el correo lleva un código que solo sirve
 * acompañado de un secreto (code_verifier) que se genera y queda guardado en
 * el navegador de quien pidió la recuperación. Un escáner que abra el enlace
 * no tiene ese secreto, así que no puede canjearlo y el enlace sigue válido
 * para el usuario.
 *
 * detectSessionInUrl procesa el código al volver del correo.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
