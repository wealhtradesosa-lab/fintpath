// FINPATHIA · Utilidades para que los logs de Netlify no lleven datos
// personales: correos, uids completos ni objetos de error con el detalle de
// la petición. Misma regla de correo que send-email.cjs (PR #34), salvo que
// aquí un usuario de 1-2 letras se oculta entero.

// "ana.maria@gmail.com" → "an***@gmail.com"; "ab@x.co" → "***@x.co".
function enmascararEmail(email) {
  const s = String(email ?? "");
  const at = s.lastIndexOf("@");
  if (at < 0) return "***";
  const u = s.slice(0, at);
  const d = s.slice(at + 1);
  if (!d) return "***";
  return (u.length <= 2 ? "" : u.slice(0, 2)) + "***@" + d;
}

// Primeros 8 caracteres de un uid (alcanza para cruzar con la base).
function uidCorto(uid) {
  if (uid === null || uid === undefined || uid === "") return "-";
  return String(uid).slice(0, 8);
}

const RE_EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g;

// Error o respuesta de error (Resend, Stripe, fetch) → solo message y code.
// Los correos que aparezcan en el mensaje se enmascaran.
function errorParaLog(err) {
  if (err === null || err === undefined) return { message: "error desconocido" };
  if (typeof err !== "object") return { message: String(err).replace(RE_EMAIL, enmascararEmail).slice(0, 300) };
  const message = String(err.message ?? err.error?.message ?? err.name ?? "error").replace(RE_EMAIL, enmascararEmail).slice(0, 300);
  const code = err.code ?? err.type ?? err.statusCode ?? err.status ?? (err.name && err.name !== "Error" ? err.name : undefined);
  return code === undefined ? { message } : { message, code: String(code) };
}

module.exports = { enmascararEmail, uidCorto, errorParaLog };
