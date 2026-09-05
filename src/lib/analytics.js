export function trackSignup({ method = "email", userId } = {}) {
  const promoCode = (typeof window !== "undefined" && window.sessionStorage)
    ? window.sessionStorage.getItem("fp3_promo_code") || ""
    : "";

  // 05-sep-2026 — Intención de signup (ej. temporada de renta). Sin PII:
  // nunca dígitos de cédula. Se limpia al disparar para no contaminar
  // registros posteriores en la misma pestaña.
  let signupIntent = null;
  try {
    const raw = (typeof window !== "undefined" && window.sessionStorage)
      ? window.sessionStorage.getItem("fp3_signup_intent") : null;
    signupIntent = raw ? JSON.parse(raw) : null;
  } catch { signupIntent = null; }

  track("signup_completed", {
    method,
    with_promo: !!promoCode,
    promo_code: promoCode || undefined,
    campaign: promoCode === "PIONEROS2026" ? "pioneros_2026" : undefined,
    source: signupIntent?.source || undefined,
    intent: signupIntent?.intent || undefined,
    dias_restantes: signupIntent?.dias_restantes ?? undefined,
  });

  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("fp3_signup_intent");
    }
  } catch { /* noop */ }
