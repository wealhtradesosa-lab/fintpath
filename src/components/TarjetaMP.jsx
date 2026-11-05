// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Cobro automático con tarjeta (Mercado Pago, sin cuenta de MP)
//
// 5-nov-2026 (Santiago: "¿cómo hacemos lo del cobro automático?"). Ventana con
// el formulario de tarjeta de Mercado Pago (Card Payment Brick). Los datos de
// la tarjeta van directo a Mercado Pago dentro de sus propios campos seguros;
// FINPATHIA solo recibe un token de un uso y con él crea la suscripción
// (netlify/functions/mp-suscribir-tarjeta.cjs). La persona no necesita cuenta
// de Mercado Pago.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { fetchAuth } from "../lib/apiFetch";

// Llave pública de Mercado Pago (es pública por diseño: va en el navegador).
const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || "APP_USR-5ce258c6-efae-486f-90c7-cbe7a7e37a60";
const SDK = "https://sdk.mercadopago.com/js/v2";

function cargarSdk() {
  if (window.MercadoPago) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = SDK; s.async = true;
    s.onload = () => ok(); s.onerror = () => mal(new Error("sdk"));
    document.head.appendChild(s);
  });
}

export default function TarjetaMP({ ciclo = "mensual", monto, email, onCerrar, onListo }) {
  const [estado, setEstado] = useState("cargando"); // cargando | listo | enviando | error | hecho
  const [error, setError] = useState(null);
  const brickRef = useRef(null);
  const idCont = "fp-mp-tarjeta";

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await cargarSdk();
        if (!vivo) return;
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "es-CO" });
        brickRef.current = await mp.bricks().create("cardPayment", idCont, {
          initialization: { amount: monto, payer: email ? { email } : undefined },
          customization: {
            paymentMethods: { maxInstallments: 1, minInstallments: 1 },
            visual: { hideFormTitle: true, texts: { formSubmit: "Activar cobro automático" }, style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => vivo && setEstado("listo"),
            onError: () => { if (vivo) { setEstado("error"); setError("No pudimos cargar el formulario de tarjeta. Revisa tu conexión o paga con PSE."); } },
            onSubmit: async (formData) => {
              setEstado("enviando"); setError(null);
              try {
                const r = await fetchAuth("/api/mp-suscribir-tarjeta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: formData.token, ciclo }) });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) { setEstado("listo"); setError(d.error || "No pudimos activar el cobro automático."); throw new Error("rechazo"); }
                setEstado("hecho");
                onListo && onListo(d);
              } catch (e) { setEstado("listo"); throw e; }
            },
          },
        });
      } catch {
        if (vivo) { setEstado("error"); setError("No pudimos cargar el formulario de tarjeta. Revisa tu conexión o paga con PSE."); }
      }
    })();
    return () => { vivo = false; try { brickRef.current?.unmount(); } catch { /* ya desmontado */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (n) => "$" + Number(n).toLocaleString("es-CO");
  return (
    // 5-nov-2026 (Santiago: "cuando la gente escribe los números de la tarjeta no los ve,
    // salen más abajo"). En el celular, una ventana centrada y fija queda tapada por el
    // teclado. Ahora la ventana arranca arriba y toda la capa se desplaza (el navegador
    // puede subir el campo activo por encima del teclado). El formulario de Mercado Pago
    // va siempre en su tema claro: en el oscuro los números se leían mal.
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "max(12px, env(safe-area-inset-top)) 12px 40vh" }} onClick={(e) => { if (e.target === e.currentTarget && estado !== "enviando") onCerrar(); }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: "var(--fp-card)", border: "1px solid rgba(var(--fp-ink),0.1)", borderRadius: 16, padding: 20, color: "var(--fp-txt)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Cobro automático con tarjeta</div>
            <div style={{ fontSize: 13, color: "var(--fp-txt2)", marginTop: 4, lineHeight: 1.5 }}>
              {fmt(monto)} {ciclo === "anual" ? "cada año" : "cada mes"}, débito o crédito Visa o Mastercard. No necesitas cuenta de Mercado Pago. Cancelas en cualquier momento desde Mi cuenta.
            </div>
          </div>
          {estado !== "enviando" && <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", color: "var(--fp-txt3)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>}
        </div>
        {estado === "hecho" ? (
          <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "color-mix(in srgb, var(--fp-pos) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--fp-pos) 30%, transparent)", fontSize: 14, lineHeight: 1.6 }}>
            <strong>¡Listo! Tu plan Pro está activo.</strong> Mercado Pago cobrará {fmt(monto)} {ciclo === "anual" ? "cada año" : "cada mes"} a tu tarjeta. Puedes cancelar en cualquier momento desde Mi cuenta.
            <div><button type="button" onClick={() => window.location.reload()} style={{ marginTop: 12, background: "var(--fp-txt)", color: "var(--fp-bg)", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}>Empezar a usar Pro</button></div>
          </div>
        ) : (
          <>
            {estado === "cargando" && <div style={{ marginTop: 18, fontSize: 13, color: "var(--fp-txt3)" }}>Cargando formulario seguro de Mercado Pago…</div>}
            {error && <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "color-mix(in srgb, var(--fp-neg) 10%, transparent)", color: "var(--fp-txt)", fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
            <div id={idCont} style={{ marginTop: 14 }} />
            <div style={{ fontSize: 11, color: "var(--fp-txt3)", marginTop: 10, lineHeight: 1.5 }}>Los datos de tu tarjeta van directo a Mercado Pago. FINPATHIA no los ve ni los guarda.</div>
          </>
        )}
      </div>
    </div>
  );
}
