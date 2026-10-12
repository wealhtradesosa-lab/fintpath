// FINPATHIA · Enmascarar correos en los logs de Netlify.
// Nunca loguear el email completo: "an***@dominio.com". Misma regla que el
// helper de send-email.cjs (PR #34); cuando ambos estén en main, send-email
// puede usar este módulo.
function enmascararEmail(email) {
  const s = String(email || "");
  const [u, d] = s.split("@");
  if (!d) return "***";
  return (u.slice(0, 2) || "*") + "***@" + d;
}

module.exports = { enmascararEmail };
