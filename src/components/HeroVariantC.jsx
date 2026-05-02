// ═══════════════════════════════════════════════════════════════════════════
// HeroVariantC.jsx · Sesión 2-may-2026
//
// VARIANTE C — Inspirado en Optimus template de v0.dev (Santiago vio captura)
//
// Estilo: minimalismo editorial. Tipografía MASIVA con letter-spacing apretado.
// Em-dash + label pequeño arriba del título. Fondo con patrón candlestick
// (super on-brand para fintech). Nav ultra minimalista. CTA pill confidente.
//
// Adaptado de light theme original a DARK para mantener identidad FINPATHIA.
// 0 KB descarga adicional — todo SVG inline + CSS animation.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

const T = {
  bg: "#09090b", bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

// ─────────────────────────────────────────────────────────────────────────
// 2-may-2026: imagen sailing del crew FINPATHIA reemplaza el background de
// candlesticks. Solo se mantiene imagen + overlay multi-capa para
// preservar legibilidad del texto blanco sobre la imagen.
// ─────────────────────────────────────────────────────────────────────────

export default function HeroVariantC({ onGetStarted = () => {} }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

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
        @keyframes drawCandle { from { opacity: 0; transform: scaleY(0); } to { opacity: 1; transform: scaleY(1); } }
        .fade-up { animation: fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.5s; }
        .fade-up-4 { animation-delay: 0.7s; }
      `}</style>

      {/* ─── BACKGROUND: imagen FINPATHIA sailing crew ─── */}
      {/* Sesión 2-may-2026: Santiago eligió imagen del crew sailing como
          fondo del hero. Se mantienen los candlesticks como "data layer"
          sutil encima para preservar identidad fintech. Overlay oscuro
          en multi-capa para legibilidad del texto blanco. */}
      <picture style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <source media="(max-width: 768px)" srcSet="/hero-sailing-mobile.webp" type="image/webp" />
        <source srcSet="/hero-sailing-desktop.webp" type="image/webp" />
        <img
          src="/hero-sailing-desktop.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchpriority="high"
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

      {/* Overlay multi-capa para legibilidad del texto blanco encima */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        // Stack:
        //   1. Gradient lateral negro→transparente (oscurece izquierda donde va el texto)
        //   2. Gradient inferior negro→transparente (transición suave al resto del landing)
        //   3. Capa global oscura sutil para asegurar contraste universal
        background: `
          linear-gradient(90deg, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.65) 35%, rgba(9,9,11,0.4) 65%, rgba(9,9,11,0.55) 100%),
          linear-gradient(180deg, rgba(9,9,11,0.3) 0%, rgba(9,9,11,0.5) 60%, #09090b 100%),
          linear-gradient(rgba(9,9,11,0.25), rgba(9,9,11,0.25))
        `,
      }} />

      {/* Candlesticks removidos por solicitud Santiago (2-may-2026):
          ahora solo imagen + overlay limpio sin elementos de trading. */}

      {/* Glow muy sutil arriba para profundidad */}
      <div style={{
        position: "absolute",
        top: -200,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1000,
        height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${T.green}10 0%, transparent 60%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      {/* ─── NAV ULTRA MINIMALISTA ─── */}
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

        {/* Links ocultos en mobile */}
        <div className="nav-links" style={{
          display: "flex",
          gap: 32,
          alignItems: "center",
        }}>
          {["Funciones", "Cómo funciona", "Precios", "Asesores"].map(link => (
            <button
              key={link}
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              style={{
                background: "transparent",
                border: "none",
                color: T.txt2,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = T.txt}
              onMouseLeave={(e) => e.currentTarget.style.color = T.txt2}
            >
              {link}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={onGetStarted} style={{
            background: "transparent",
            border: "none",
            color: T.txt2,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            padding: 0,
          }}>
            Iniciar sesión
          </button>
          <button onClick={onGetStarted} style={{
            background: T.txt,
            color: "#000",
            border: "none",
            padding: "10px 22px",
            borderRadius: 100,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
          >
            Empezar gratis
          </button>
        </div>
      </nav>

      {/* ─── HERO MASIVO ─── */}
      <div style={{
        position: "relative",
        zIndex: 5,
        maxWidth: 1280,
        margin: "0 auto",
        padding: "120px 32px 160px",
      }}>
        {/* Em-dash + label pequeño (firma del estilo Optimus) */}
        <div className={mounted ? "fade-up fade-up-1" : ""} style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 48,
          opacity: mounted ? 1 : 0,
        }}>
          <span style={{
            width: 48,
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
            Dale seguridad y control a tu patrimonio
          </span>
        </div>

        {/* Headline MASIVO */}
        <h1 className={mounted ? "fade-up fade-up-2" : ""} style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "clamp(3.5rem, 11vw, 9rem)",
          fontWeight: 800,
          lineHeight: 0.9,
          letterSpacing: "-0.06em",
          margin: 0,
          marginBottom: 56,
          opacity: mounted ? 1 : 0,
          color: T.txt,
        }}>
          Inteligencia<br />
          patrimonial<br />
          <span style={{
            background: `linear-gradient(135deg, ${T.green} 0%, ${T.blue} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            para tu familia.
          </span>
        </h1>

        {/* Subhead + CTA en grid de dos columnas */}
        <div className={mounted ? "fade-up fade-up-3" : ""} style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 48,
          alignItems: "end",
          maxWidth: 1100,
          opacity: mounted ? 1 : 0,
        }}>
          <p style={{
            fontSize: "clamp(1rem, 1.6vw, 1.25rem)",
            color: T.txt2,
            lineHeight: 1.55,
            maxWidth: 540,
            margin: 0,
            fontWeight: 400,
          }}>
            Centraliza patrimonio, impuestos y proyecciones en un solo sistema. Recibe estrategias personalizadas como las de un family office — analizadas por IA experta en finanzas personales.
          </p>

          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <button onClick={onGetStarted} style={{
              background: T.txt,
              color: "#000",
              border: "none",
              padding: "16px 32px",
              borderRadius: 100,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 700,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
            >
              Empezar gratis →
            </button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} style={{
              background: "transparent",
              color: T.txt,
              border: `1px solid ${T.borderStrong}`,
              padding: "16px 28px",
              borderRadius: 100,
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}>
              Ver demo
            </button>
          </div>
        </div>

        {/* Microtext */}
        <div className={mounted ? "fade-up fade-up-4" : ""} style={{
          marginTop: 28,
          fontSize: 13,
          color: T.txt3,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          opacity: mounted ? 1 : 0,
        }}>
          <span>✓ 14 días gratis</span>
          <span>✓ Sin tarjeta de crédito</span>
          <span>✓ Cancelas cuando quieras</span>
        </div>
      </div>

      {/* Responsive: ocultar links del nav en mobile */}
      <style>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
        }
        @media (max-width: 640px) {
          h1 { font-size: clamp(2.5rem, 14vw, 5rem) !important; }
          [style*="grid-template-columns: 1fr auto"] {
            grid-template-columns: 1fr !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
}
