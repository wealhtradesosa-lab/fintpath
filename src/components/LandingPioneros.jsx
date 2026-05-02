// ═══════════════════════════════════════════════════════════════════════════
// LandingPioneros.jsx · Sesión 2-may-2026
//
// Landing dedicada para campaña "Pioneros 2026" — 100 plazas con 3 meses
// gratis del Plan Pro. Distribución vía QR code o link directo.
//
// FLOW DEL USER:
//   1. Recibe el QR/link → finpathia.com/pioneros?code=PIONEROS2026
//   2. Ve la landing con copy específico + el código destacado
//   3. Click "Reclamar mi acceso" → guarda código en sessionStorage
//   4. Va a signup normal (auth)
//   5. Después de signup, va al checkout de Pro
//   6. Stripe pre-aplica el código (nuestra función checkout lo lee de
//      sessionStorage y lo manda a Stripe)
//   7. User ve "$0 los primeros 3 meses" + 14 días trial = 3.5 meses gratis
//
// COPY: confidente, exclusivo, sin urgencia falsa. Comunica privilegio
// (estás siendo invitado a un grupo cerrado), no descuento desesperado.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

const T = {
  bg: "#09090b", bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

const PROMO_CODE = "PIONEROS2026";

export default function LandingPioneros({ onGetStarted = () => {} }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    // Auto-guardar código en sessionStorage cuando carga la landing
    // (también sirve si el user lo recibe via ?code=PIONEROS2026)
    const params = new URLSearchParams(window.location.search);
    const code = (params.get("code") || PROMO_CODE).toUpperCase();
    if (code === PROMO_CODE) {
      sessionStorage.setItem("fp3_promo_code", PROMO_CODE);
    }
    return () => clearTimeout(t);
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(PROMO_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClaim = () => {
    sessionStorage.setItem("fp3_promo_code", PROMO_CODE);
    sessionStorage.setItem("fp3_intent_plan", "pro_individual");
    onGetStarted();
  };

  return (
    <div style={{
      background: T.bg,
      color: T.txt,
      fontFamily: FONT_BODY,
      minHeight: "100vh",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .fade-up { animation: fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }
        .fade-up-4 { animation-delay: 0.55s; }
        .fade-up-5 { animation-delay: 0.7s; }
      `}</style>

      {/* Imagen de fondo (misma que el hero principal) */}
      <picture style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <source media="(max-width: 768px)" srcSet="/hero-sailing-mobile.webp" type="image/webp" />
        <source srcSet="/hero-sailing-desktop.webp" type="image/webp" />
        <img
          src="/hero-sailing-desktop.webp"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",
          }}
        />
      </picture>

      {/* Overlay más oscuro que el hero principal — esto es página de claim, prioridad legibilidad */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `
          linear-gradient(135deg, rgba(9,9,11,0.92) 0%, rgba(9,9,11,0.78) 50%, rgba(9,9,11,0.85) 100%),
          linear-gradient(rgba(9,9,11,0.4), rgba(9,9,11,0.4))
        `,
      }} />

      {/* Glow verde sutil arriba a la derecha */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "10%",
        width: 600,
        height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${T.green}15 0%, transparent 60%)`,
        filter: "blur(80px)",
        animation: "pulse 6s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Nav minimalista */}
      <nav style={{
        position: "relative",
        zIndex: 10,
        padding: "24px 32px",
        maxWidth: 1280,
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          fontFamily: FONT_DISPLAY,
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}>
          <span style={{ color: T.txt }}>FINPATHIA</span>
          <span style={{ color: T.txt3, fontSize: 11, fontWeight: 500 }}>™</span>
        </div>
        <a href="/" style={{
          color: T.txt2,
          fontSize: 13,
          textDecoration: "none",
          fontWeight: 500,
        }}>
          Inicio →
        </a>
      </nav>

      {/* HERO */}
      <div style={{
        position: "relative",
        zIndex: 5,
        maxWidth: 880,
        margin: "0 auto",
        padding: "60px 32px 120px",
      }}>
        {/* Badge "Acceso por invitación" */}
        <div className={mounted ? "fade-up fade-up-1" : ""} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: `linear-gradient(135deg, ${T.green}15, ${T.blue}15)`,
          border: `1px solid ${T.green}30`,
          borderRadius: 100,
          padding: "8px 18px",
          marginBottom: 36,
          fontSize: 12,
          color: T.green,
          fontWeight: 600,
          opacity: mounted ? 1 : 0,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 10px ${T.green}` }} />
          Acceso por invitación · Cohorte Pioneros 2026
        </div>

        {/* Em-dash + label */}
        <div className={mounted ? "fade-up fade-up-2" : ""} style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          opacity: mounted ? 1 : 0,
        }}>
          <span style={{
            width: 32,
            height: 1,
            background: T.txt3,
            display: "inline-block",
          }} />
          <span style={{
            fontSize: 13,
            color: T.txt2,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}>
            Solo 100 plazas · Sin lista de espera
          </span>
        </div>

        {/* Title */}
        <h1 className={mounted ? "fade-up fade-up-2" : ""} style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "clamp(2.5rem, 7vw, 5rem)",
          fontWeight: 800,
          lineHeight: 0.95,
          letterSpacing: "-0.05em",
          margin: 0,
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
        }}>
          Estás invitado<br/>
          al <span style={{
            background: `linear-gradient(135deg, ${T.green} 0%, ${T.blue} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>círculo cerrado</span>
          <br/>de FINPATHIA.
        </h1>

        {/* Subtitle */}
        <p className={mounted ? "fade-up fade-up-3" : ""} style={{
          fontSize: "clamp(1rem, 1.5vw, 1.2rem)",
          color: T.txt2,
          lineHeight: 1.55,
          maxWidth: 600,
          margin: 0,
          marginBottom: 48,
          fontWeight: 400,
          opacity: mounted ? 1 : 0,
        }}>
          Sos parte del primer grupo de 100 personas que recibe acceso temprano al Plan Pro. Tres meses gratis. Tu feedback construye el producto. Cero compromiso a futuro.
        </p>

        {/* Card del código */}
        <div className={mounted ? "fade-up fade-up-4" : ""} style={{
          background: "rgba(20, 20, 24, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 20,
          padding: 32,
          marginBottom: 32,
          opacity: mounted ? 1 : 0,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Glow accent */}
          <div style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 200,
            height: 200,
            background: `radial-gradient(circle, ${T.green}20 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative" }}>
            <div style={{
              fontSize: 11,
              color: T.txt3,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 12,
            }}>
              Tu código de acceso
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}>
              <code style={{
                fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
                fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                fontWeight: 700,
                color: T.green,
                letterSpacing: "0.04em",
                background: "rgba(34, 197, 94, 0.08)",
                border: `1px solid ${T.green}30`,
                padding: "12px 20px",
                borderRadius: 12,
                fontVariantNumeric: "tabular-nums",
              }}>
                {PROMO_CODE}
              </code>
              <button onClick={copyCode} style={{
                background: copied ? T.green : "rgba(255,255,255,0.06)",
                color: copied ? "#000" : T.txt,
                border: `1px solid ${copied ? T.green : T.borderStrong}`,
                padding: "10px 18px",
                borderRadius: 100,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s",
              }}>
                {copied ? "✓ Copiado" : "Copiar código"}
              </button>
            </div>

            {/* Beneficios */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { icon: "🎁", text: <><strong style={{ color: T.txt }}>3 meses gratis</strong> del Plan Pro Individual</> },
                { icon: "🆓", text: <><strong style={{ color: T.txt }}>+14 días de trial</strong> antes que arranque el descuento (3.5 meses gratis totales)</> },
                { icon: "🚫", text: "Sin tarjeta requerida durante el trial" },
                { icon: "✋", text: "Cancelas cuando quieras (incluso antes que termine el descuento)" },
              ].map((b, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  fontSize: 14,
                  color: T.txt2,
                  lineHeight: 1.5,
                }}>
                  <span style={{ flexShrink: 0, fontSize: 16 }}>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA principal */}
        <div className={mounted ? "fade-up fade-up-5" : ""} style={{
          opacity: mounted ? 1 : 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <button onClick={handleClaim} style={{
            background: `linear-gradient(135deg, ${T.green}, ${T.blue})`,
            color: "#fff",
            border: "none",
            padding: "18px 36px",
            borderRadius: 100,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 700,
            boxShadow: `0 12px 40px ${T.green}40`,
            transition: "all 0.2s",
            fontFamily: FONT_DISPLAY,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 16px 48px ${T.green}55`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = `0 12px 40px ${T.green}40`;
          }}
          >
            Reclamar mi acceso →
          </button>

          <p style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>
            El código se aplica automáticamente al ir al checkout · Stripe procesa el pago
          </p>
        </div>

        {/* Why exclusive */}
        <div className={mounted ? "fade-up fade-up-5" : ""} style={{
          marginTop: 80,
          paddingTop: 40,
          borderTop: `1px solid ${T.border}`,
          opacity: mounted ? 1 : 0,
        }}>
          <div style={{
            fontSize: 11,
            color: T.txt3,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 16,
          }}>
            ¿Qué es ser pionero?
          </div>
          <p style={{
            fontSize: 15,
            color: T.txt2,
            lineHeight: 1.65,
            maxWidth: 640,
          }}>
            Sos de los primeros que prueba FINPATHIA en serio. Tu uso real, tus preguntas, lo que te frustra y lo que te encanta — todo eso construye el producto que la siguiente generación de familias va a usar. A cambio te damos acceso temprano sin costo y línea directa con el equipo.
          </p>
        </div>
      </div>
    </div>
  );
}
