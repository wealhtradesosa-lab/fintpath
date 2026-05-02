// ═══════════════════════════════════════════════════════════════════════════
// HeroVariantA.jsx · Sesión 1-may-2026
//
// VARIANTE A — "Linear / Mercury": minimalismo + glow + dashboard mockup
//
// Estilo: oscuro, vacío estratégico, gradient sutil arriba, mockup del
// producto a la derecha como "anchor visual". Lo que hace Linear.app y
// Mercury.com. Comunica: producto serio, premium, B2B-grade.
//
// CERO assets externos — todo es CSS + SVG inline. 0 KB descarga adicional.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
};

// Tipografía: Inter para todo, Plus Jakarta Sans para titulares premium
const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

export default function HeroVariantA({ onGetStarted = () => {} }) {
  // Animación sutil de aparición progresiva
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.55; } }
        .fade-up { animation: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.25s; }
        .fade-up-3 { animation-delay: 0.4s; }
        .fade-up-4 { animation-delay: 0.55s; }
        .fade-up-5 { animation-delay: 0.7s; }
      `}</style>

      {/* Glow superior */}
      <div style={{
        position: "absolute",
        top: -200,
        left: "50%",
        transform: "translateX(-50%)",
        width: 1000,
        height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${T.green}1A 0%, ${T.blue}0D 30%, transparent 70%)`,
        filter: "blur(60px)",
        animation: "glow 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Grid sutil de fondo */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        opacity: 0.5,
        pointerEvents: "none",
      }} />

      {/* NAV */}
      <nav style={{
        padding: "20px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: 1200,
        margin: "0 auto",
        position: "relative",
        zIndex: 10,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", fontFamily: FONT_DISPLAY }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            FINPATHIA
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onGetStarted} style={{
            background: "transparent", border: `1px solid ${T.borderStrong}`, color: T.txt2,
            padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
          }}>Iniciar sesión</button>
          <button onClick={onGetStarted} style={{
            background: T.txt, color: "#000", border: "none",
            padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
          }}>Empezar gratis →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "100px 32px 120px",
        position: "relative",
        zIndex: 5,
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 60,
        alignItems: "center",
      }}>
        <div style={{ textAlign: "center", maxWidth: 780, margin: "0 auto" }}>
          {/* Badge */}
          <div className={mounted ? "fade-up fade-up-1" : ""} style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${T.borderStrong}`,
            borderRadius: 99,
            padding: "6px 14px",
            marginBottom: 32,
            fontSize: 13,
            color: T.txt2,
            fontWeight: 500,
            opacity: mounted ? 1 : 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, boxShadow: `0 0 12px ${T.green}` }} />
            Gestión patrimonial inteligente · Colombia
          </div>

          {/* H1 */}
          <h1 className={mounted ? "fade-up fade-up-2" : ""} style={{
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(2.5rem, 6.5vw, 5rem)",
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.045em",
            marginBottom: 24,
            opacity: mounted ? 1 : 0,
          }}>
            Tu family office,
            <br />
            <span style={{
              background: T.grad,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              en una sola pantalla.
            </span>
          </h1>

          {/* Subtítulo */}
          <p className={mounted ? "fade-up fade-up-3" : ""} style={{
            fontSize: 19,
            color: T.txt2,
            lineHeight: 1.55,
            maxWidth: 560,
            margin: "0 auto 40px",
            fontWeight: 400,
            opacity: mounted ? 1 : 0,
          }}>
            Patrimonio, impuestos, pensiones y proyecciones — analizados por un equipo de IA experto en finanzas colombianas. Sin contadores intermedios.
          </p>

          {/* CTAs */}
          <div className={mounted ? "fade-up fade-up-4" : ""} style={{
            display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap",
            opacity: mounted ? 1 : 0,
          }}>
            <button onClick={onGetStarted} style={{
              background: T.txt, color: "#000", border: "none",
              padding: "14px 28px", borderRadius: 10, cursor: "pointer",
              fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
              transition: "transform 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
            >
              Comenzar 14 días gratis
            </button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} style={{
              background: "transparent", color: T.txt, border: `1px solid ${T.borderStrong}`,
              padding: "14px 28px", borderRadius: 10, cursor: "pointer",
              fontSize: 15, fontWeight: 500,
            }}>
              Ver demo →
            </button>
          </div>

          <p className={mounted ? "fade-up fade-up-5" : ""} style={{
            fontSize: 13, color: T.txt3, marginTop: 20,
            opacity: mounted ? 1 : 0,
          }}>
            Sin tarjeta de crédito · Configuración en 5 minutos
          </p>
        </div>

        {/* MOCKUP DEL PRODUCTO */}
        <div className={mounted ? "fade-up fade-up-5" : ""} style={{
          position: "relative",
          maxWidth: 1100,
          margin: "0 auto",
          opacity: mounted ? 1 : 0,
        }}>
          {/* Glow detrás */}
          <div style={{
            position: "absolute",
            inset: -40,
            background: `radial-gradient(ellipse, ${T.green}15, ${T.blue}10, transparent 70%)`,
            filter: "blur(40px)",
            pointerEvents: "none",
          }} />

          {/* Card del mockup */}
          <div style={{
            position: "relative",
            background: T.bg2,
            border: `1px solid ${T.borderStrong}`,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}>
            {/* Top bar tipo macOS */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: T.bg,
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#eab308" }} />
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#22c55e" }} />
              </div>
              <div style={{ marginLeft: 12, fontSize: 12, color: T.txt3, fontFamily: "monospace" }}>
                finpathia.com / dashboard
              </div>
            </div>

            {/* Contenido del dashboard */}
            <div style={{ padding: 28, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <KPICard label="PATRIMONIO" value="$21.8B" sub="+8.3% YoY" color={T.green} />
              <KPICard label="INGRESO ANUAL" value="$1.6B" sub="3 fuentes" color={T.blue} />
              <KPICard label="IMPUESTO ESTIMADO" value="$127M" sub="Tasa 7.9%" color={T.purple} />
              <KPICard label="AHORRO DETECTADO" value="$113M" sub="Ver palancas" color={T.green} highlight />
            </div>

            {/* Chart sintético */}
            <div style={{ padding: "0 28px 28px" }}>
              <div style={{
                height: 140,
                background: `linear-gradient(180deg, ${T.green}10 0%, transparent 100%)`,
                borderRadius: 8,
                position: "relative",
                overflow: "hidden",
              }}>
                <svg viewBox="0 0 600 140" style={{ width: "100%", height: "100%" }}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={T.green} />
                      <stop offset="100%" stopColor={T.blue} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 110 L 50 95 L 100 100 L 150 80 L 200 85 L 250 60 L 300 65 L 350 45 L 400 50 L 450 30 L 500 35 L 550 20 L 600 25"
                    stroke="url(#lineGrad)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <path
                    d="M 0 110 L 50 95 L 100 100 L 150 80 L 200 85 L 250 60 L 300 65 L 350 45 L 400 50 L 450 30 L 500 35 L 550 20 L 600 25 L 600 140 L 0 140 Z"
                    fill="url(#lineGrad)"
                    opacity="0.15"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color, highlight }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: highlight ? `${color}10` : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? color + "30" : T.border}`,
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 10, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? color : T.txt, fontFamily: FONT_DISPLAY, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: highlight ? color : T.txt3, marginTop: 4, fontWeight: 500 }}>
        {sub}
      </div>
    </div>
  );
}
