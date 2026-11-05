// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · correos del pago único (PSE / Efecty / tarjeta por Mercado Pago)
// 5-nov-2026. "confirmacion" al aprobarse el pago; "por_vencer" 5 días antes;
// "renovacion_anual" 7 días antes de que Mercado Pago renueve una suscripción anual.
// ═══════════════════════════════════════════════════════════════════════════
const { emailShell } = require("../functions/send-email.cjs");

const NOMBRE = { basico: "Básico", pro: "Pro", pro_familiar: "Pro Familiar" };
const fechaLarga = (iso) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
const P = (t) => `<p style="font-size:15px;color:#a1a1aa;line-height:1.7;margin:0 0 16px;">${t}</p>`;
const H = (t) => `<h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 16px;color:#fafafa;letter-spacing:-0.5px;">${t}</h1>`;
const B = (t) => `<strong style="color:#fafafa;">${t}</strong>`;

function correoPagoUnico({ tipo, plan, meses, hasta }) {
  const n = NOMBRE[plan] || "Pro";
  const f = fechaLarga(hasta);
  if (tipo === "renovacion_anual") {
    const subject = `Tu plan anual de FINPATHIA se renueva el ${f}`;
    const html = emailShell(
      H("Tu plan anual se renueva en 7 días") +
      P(`El ${B(f)} renovamos tu plan ${B(n)} por un año más: Mercado Pago cobrará ${B("$249.000")} a tu tarjeta.`) +
      P(`No tienes que hacer nada para seguir. Si prefieres no renovar, cancélalo en un toque desde Mi cuenta antes de esa fecha y no se cobra nada.`),
      { ctaText: "Ir a Mi cuenta", ctaUrl: "https://finpathia.com/?ir=set", preheader: `Renovación automática el ${f}. Cancelas en un toque si no quieres seguir.` });
    return { subject, html, text: `Tu plan anual de FINPATHIA se renueva el ${f} por $249.000. Para cancelar: Mi cuenta en finpathia.com.` };
  }
  if (tipo === "por_vencer") {
    const subject = `Tu plan ${n} de FINPATHIA vence el ${f}`;
    const html = emailShell(
      H("Tu plan vence en 5 días") +
      P(`Pagaste tu plan ${B(n)} con pago único y tienes acceso completo hasta el ${B(f)}.`) +
      P(`Para seguir sin interrupciones, renuévalo en un toque con PSE, Efecty o tarjeta. Lo que pagues se suma desde esa fecha: no pierdes ni un día.`) +
      P(`El plan anual te ahorra dos meses frente a pagar mes a mes. Si no renuevas, tu cuenta queda en modo consulta: ves todos tus datos y para editar renuevas cuando quieras.`),
      { ctaText: "Renovar mi plan", ctaUrl: "https://finpathia.com/?ir=price", preheader: `Acceso completo hasta el ${f}. Renueva con PSE en un toque.` });
    return { subject, html, text: `Tu plan ${n} de FINPATHIA vence el ${f}. Renueva en https://finpathia.com/?ir=price` };
  }
  const subject = `Pago recibido: FINPATHIA ${n} activo hasta el ${f}`;
  const html = emailShell(
    H("¡Pago recibido!") +
    P(`Tu plan ${B(n)} está activo por ${meses === 12 ? "un año" : "un mes"}, hasta el ${B(f)}.`) +
    P(`Como fue un pago único, no te vamos a cobrar nada automático. Cinco días antes de que venza te escribimos con el link para renovar.`),
    { ctaText: "Entrar a FINPATHIA", ctaUrl: "https://finpathia.com", preheader: `Acceso completo hasta el ${f}. Sin cobros automáticos.` });
  return { subject, html, text: `Pago recibido. Tu plan ${n} de FINPATHIA está activo hasta el ${f}.` };
}

module.exports = { correoPagoUnico, fechaLarga };
