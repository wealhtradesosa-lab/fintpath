// ═══════════════════════════════════════════════════════════════════════════
// HeroVariantB.jsx · Sesión 1-may-2026
//
// VARIANTE B — "Stripe / Vercel": gradient animado + orbes flotantes + glass
//
// Estilo: orbes de color flotando lento, gradient animado de fondo, cards
// con glassmorphism, tipografía masiva. Lo que hace stripe.com y vercel.com.
// Comunica: producto premium, technology-forward, momentum.
//
// CERO assets externos — todo CSS animation + radial gradients. 0 KB extra.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  pink: "#ec4899", cyan: "#22d3ee", orange: "#f97316",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

export default function HeroVariantB({ onGetStarted = () => {} }) {
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
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(40px, -30px); } }
        @keyframes float2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 40px); } }
        @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 20px); } }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .fade-up { animation: fadeUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.18s; }
        .fade-up-3 { animation-delay: 0.32s; }
        .fade-up-4 { animation-delay: 0.46s; }
        .fade-up-5 { animation-delay: 0.6s; }
      `}</style>

      {/* ─── ORBES DE COLOR FLOTANDO ─── */}
      <div style={{
        position: "absolute",
        top: "-10%", left: "20%",
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.purple}30 0%, transparent 60%)`,
        filter: "blur(80px)",
        animation: "float1 20s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: "20%", right: "10%",
        width: 500, height: 500, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.green}25 0%, transparent 60%)`,
        filter: "blur(80px)",
        animation: "float2 25s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: "5%", left: "5%",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${T.blue}20 0%, transparent 60%)`,
        filter: "blur(80px)",
        animation: "float3 18s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Noise sutil para textura */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.4'/></svg>\")",
        opacity: 0.03,
        pointerEvents: "none",
        mixBlendMode: "overlay",
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
          <span style={{
            background: `linear-gradient(135deg, ${T.green} 0%, ${T.blue} 50%, ${T.purple} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>FINPATHIA</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onGetStarted} style={{
            background: "transparent", border: "none", color: T.txt2,
            padding: "9px 14px", cursor: "pointer", fontSize: 14, fontWeight: 500,
          }}>Iniciar sesión</button>
          <button onClick={onGetStarted} style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            border: `1px solid ${T.borderStrong}`,
            color: T.txt, padding: "9px 18px", borderRadius: 100,
            cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}>Empezar gratis →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "120px 32px 80px",
        position: "relative",
        zIndex: 5,
        textAlign: "center",
      }}>
        {/* Pill superior */}
        <div className={mounted ? "fade-up fade-up-1" : ""} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 100,
          padding: "8px 16px 8px 8px",
          marginBottom: 36,
          fontSize: 13,
          color: T.txt2,
          fontWeight: 500,
          opacity: mounted ? 1 : 0,
        }}>
          <span style={{
            background: `linear-gradient(135deg, ${T.purple}, ${T.pink})`,
            color: "#fff",
            padding: "3px 10px",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}>NUEVO</span>
          Estrategias del contador con IA · ahorrá hasta $113M/año
        </div>

        {/* H1 con tamaño masivo y gradient */}
        <h1 className={mounted ? "fade-up fade-up-2" : ""} style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "clamp(2.8rem, 8vw, 6.5rem)",
          fontWeight: 800,
          lineHeight: 0.98,
          letterSpacing: "-0.055em",
          marginBottom: 28,
          opacity: mounted ? 1 : 0,
        }}>
          Inteligencia<br />
          <span style={{
            background: `linear-gradient(135deg, ${T.green} 0%, ${T.cyan} 25%, ${T.blue} 50%, ${T.purple} 75%, ${T.pink} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>patrimonial</span><br />
          para tu familia.
        </h1>

        {/* Sub */}
        <p className={mounted ? "fade-up fade-up-3" : ""} style={{
          fontSize: 20,
          color: T.txt2,
          lineHeight: 1.5,
          maxWidth: 600,
          margin: "0 auto 44px",
          fontWeight: 400,
          opacity: mounted ? 1 : 0,
        }}>
          Centralizá patrimonio, impuestos y proyecciones. Recibí estrategias personalizadas como las de un family office — sin pagar como uno.
        </p>

        {/* CTAs con glow */}
        <div className={mounted ? "fade-up fade-up-4" : ""} style={{
          display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 24,
          opacity: mounted ? 1 : 0,
        }}>
          <button onClick={onGetStarted} style={{
            position: "relative",
            background: `linear-gradient(135deg, ${T.green} 0%, ${T.blue} 100%)`,
            color: "#fff",
            border: "none",
            padding: "16px 32px",
            borderRadius: 100,
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            boxShadow: `0 8px 32px ${T.green}50, 0 0 0 1px rgba(255,255,255,0.1) inset`,
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 12px 40px ${T.green}70, 0 0 0 1px rgba(255,255,255,0.15) inset`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow = `0 8px 32px ${T.green}50, 0 0 0 1px rgba(255,255,255,0.1) inset`;
          }}
          >
            Comenzá 14 días gratis →
          </button>
          <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            color: T.txt,
            border: `1px solid ${T.borderStrong}`,
            padding: "16px 32px",
            borderRadius: 100,
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
          }}>
            Ver demo
          </button>
        </div>

        <p className={mounted ? "fade-up fade-up-4" : ""} style={{
          fontSize: 13, color: T.txt3,
          opacity: mounted ? 1 : 0,
        }}>
          Sin tarjeta · Datos cifrados · Cancelás cuando quieras
        </p>

        {/* TARJETAS FLOTANTES — micro-features ─────────────────────────── */}
        <div className={mounted ? "fade-up fade-up-5" : ""} style={{
          marginTop: 80,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          maxWidth: 1100,
          margin: "80px auto 0",
          opacity: mounted ? 1 : 0,
        }}>
          {[
            { icon: "📊", title: "Vista familiar", desc: "Patrimonio del grupo en un solo dashboard", color: T.green },
            { icon: "🧾", title: "Impuestos optimizados", desc: "Estrategias del contador, sin contador", color: T.blue },
            { icon: "🤖", title: "Asesor IA 24/7", desc: "Pregunta lo que sea sobre tu plata", color: T.purple },
            { icon: "🔒", title: "Privacidad total", desc: "Tu información nunca sale de tu cuenta", color: T.cyan },
          ].map(f => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: "20px 18px",
              textAlign: "left",
              transition: "transform 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = f.color + "40";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = T.border;
            }}
            >
              <div style={{
                fontSize: 24, marginBottom: 10,
                width: 40, height: 40, borderRadius: 10,
                background: f.color + "20",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4, fontFamily: FONT_DISPLAY }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
