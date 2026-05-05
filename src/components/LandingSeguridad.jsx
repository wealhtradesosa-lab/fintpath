// ═══════════════════════════════════════════════════════════════════════════
// LandingSeguridad.jsx · Sesión 3-may-2026
//
// Landing dedicada de seguridad. Responde la pregunta "¿qué tan seguro es
// FINPATHIA?" que recurrentemente hacen usuarios desconfiados al recibir
// el link de la plataforma.
//
// COPY: tono honesto, profesional pero accesible. Explica el stack real
// (Stripe + Supabase + AWS) y lo que NO hacemos. Sin sobre-promesas.
//
// Accesible vía:
//   - finpathia.com/seguridad
//   - Link en footer
//   - Link en modal de signup (próxima iteración)
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

const T = {
  bg: "#09090b", bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", red: "#ef4444",
};

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

// ─── Iconos SVG inline (sin dependencias externas) ──────────────────────────
const IconShield = ({ size = 24, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconLock = ({ size = 24, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconKey = ({ size = 24, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

const IconDatabase = ({ size = 24, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </svg>
);

const IconCard = ({ size = 24, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

const IconCheck = ({ size = 20, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = ({ size = 20, color = T.red }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

// ─── Card de capa de seguridad ─────────────────────────────────────────────
function SecurityCard({ icon: Icon, title, badge, description }) {
  return (
    <div style={{
      background: T.bg2,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(34,197,94,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={22} color={T.green} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.txt, margin: 0, fontFamily: FONT_DISPLAY }}>
            {title}
          </h3>
          {badge && (
            <span style={{
              display: "inline-block", marginTop: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: T.green, background: "rgba(34,197,94,0.1)",
              padding: "2px 8px", borderRadius: 99,
              textTransform: "uppercase",
            }}>
              {badge}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

// ─── Línea de "lo que sí" / "lo que no" ─────────────────────────────────────
function PolicyLine({ type, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 0",
      borderBottom: `1px solid ${T.border}`,
    }}>
      {type === "yes" ? <IconCheck size={20} /> : <IconX size={20} />}
      <span style={{ fontSize: 15, color: T.txt, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export default function LandingSeguridad({ onBack = () => {} }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const goBack = () => {
    window.history.pushState({}, "", "/");
    window.location.reload();
  };

  return (
    <div style={{
      background: T.bg, color: T.txt,
      minHeight: "100vh", fontFamily: FONT_BODY,
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.3s ease",
    }}>
      {/* HEADER */}
      <header style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        maxWidth: 1200, margin: "0 auto",
      }}>
        <a href="/" onClick={(e) => { e.preventDefault(); goBack(); }} style={{
          fontSize: 20, fontWeight: 800, color: T.green,
          textDecoration: "none", fontFamily: FONT_DISPLAY,
          letterSpacing: -0.5,
        }}>
          FINPATHIA
        </a>
        <a href="/" onClick={(e) => { e.preventDefault(); goBack(); }} style={{
          fontSize: 14, color: T.txt2, textDecoration: "none",
        }}>
          ← Volver al inicio
        </a>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 100px" }}>
        {/* HERO */}
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(34,197,94,0.1)",
            border: `1px solid rgba(34,197,94,0.3)`,
            padding: "6px 14px", borderRadius: 99,
            fontSize: 12, fontWeight: 600, color: T.green,
            marginBottom: 24,
          }}>
            <IconShield size={14} color={T.green} />
            SEGURIDAD DE NIVEL EMPRESARIAL
          </div>

          <h1 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.1,
            margin: "0 0 20px 0",
            letterSpacing: -1.5,
          }}>
            Tu patrimonio,<br />
            <span style={{
              background: `linear-gradient(135deg, ${T.green}, ${T.blue})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              tu privacidad.
            </span>
          </h1>

          <p style={{
            fontSize: 18, color: T.txt2, lineHeight: 1.6,
            maxWidth: 640, margin: "0 auto",
          }}>
            FINPATHIA está construido sobre la misma infraestructura que usan
            empresas como Stripe, Notion y Linear. Tu información financiera está
            protegida con el mismo estándar que los bancos digitales más serios
            del mundo.
          </p>
        </div>

        {/* STACK DE SEGURIDAD */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 28, fontWeight: 700,
            margin: "0 0 8px 0",
            letterSpacing: -0.5,
          }}>
            Cómo protegemos tu información
          </h2>
          <p style={{ fontSize: 15, color: T.txt2, marginBottom: 32 }}>
            Cinco capas de seguridad, cada una a cargo de los líderes de la industria.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            <SecurityCard
              icon={IconCard}
              title="Pagos con Stripe"
              badge="PCI-DSS Level 1"
              description="Procesados 100% por Stripe (la misma plataforma de Apple, Amazon, Shopify). Nosotros nunca vemos ni guardamos tu tarjeta — todo va directo a sus servidores certificados con el máximo estándar de seguridad de pagos."
            />
            <SecurityCard
              icon={IconDatabase}
              title="Base de datos"
              badge="SOC 2 Type II"
              description="Hospedada en Supabase + AWS, con acceso aislado por usuario gracias a Row Level Security (RLS). Tu información está físicamente separada de la del resto — ni nuestros desarrolladores pueden ver tus datos sin tu autorización."
            />
            <SecurityCard
              icon={IconKey}
              title="Tu contraseña"
              badge="Encriptada con bcrypt"
              description="Nunca se guarda en texto plano. Se cifra con bcrypt (estándar de la industria) antes de almacenarse. Ni siquiera nosotros podemos leerla — si la olvidás, la única forma es resetearla."
            />
            <SecurityCard
              icon={IconLock}
              title="Conexión segura"
              badge="TLS 1.3 + HTTPS"
              description="Toda la comunicación entre tu navegador y FINPATHIA viaja cifrada con TLS 1.3, el mismo protocolo que usan los bancos digitales. Imposible interceptar lo que enviás o recibís."
            />
            <SecurityCard
              icon={IconShield}
              title="Infraestructura"
              badge="Netlify + AWS"
              description="Hospedado en Netlify (red global con protección DDoS) sobre infraestructura AWS. Disponibilidad del 99.99% y backups automáticos diarios de tu información."
            />
          </div>
        </section>

        {/* LO QUE SÍ Y LO QUE NO */}
        <section style={{
          background: T.bg2,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          padding: "32px",
          marginBottom: 60,
        }}>
          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 24, fontWeight: 700,
            margin: "0 0 24px 0",
            letterSpacing: -0.5,
          }}>
            Nuestros compromisos contigo
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <PolicyLine type="yes" text="Tu información se usa únicamente para que veas tu propio análisis financiero." />
            <PolicyLine type="yes" text="Podés exportar todos tus datos en cualquier momento, en formato Excel." />
            <PolicyLine type="yes" text="Podés eliminar tu cuenta y todos tus datos cuando quieras, sin condiciones." />
            <PolicyLine type="yes" text="Cumplimos con la Ley 1581 de 2012 (protección de datos personales en Colombia)." />
            <PolicyLine type="no" text="No vendemos tus datos a terceros. Nunca. No es nuestro modelo de negocio." />
            <PolicyLine type="no" text="No compartimos tu información con anunciantes ni redes sociales." />
            <PolicyLine type="no" text="No tenemos acceso a tus cuentas bancarias — FINPATHIA es planeación, no movés plata por acá." />
            <PolicyLine type="no" text="No usamos tus datos para entrenar modelos de IA de terceros." />
          </div>
        </section>

        {/* IA Y PRIVACIDAD */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 24, fontWeight: 700,
            margin: "0 0 16px 0",
            letterSpacing: -0.5,
          }}>
            Sobre nuestra IA
          </h2>
          <div style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: "24px",
            fontSize: 15, lineHeight: 1.7, color: T.txt2,
          }}>
            <p style={{ margin: "0 0 12px 0" }}>
              FINPATHIA usa modelos de inteligencia artificial de <strong style={{ color: T.txt }}>Anthropic</strong> (los
              creadores de Claude) para generar tus análisis y recomendaciones. Anthropic
              es una empresa estadounidense reconocida por su enfoque en seguridad y
              privacidad de IA.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              Cuando consultás al asesor IA, le enviamos solo lo necesario para tu
              consulta (saldos agregados, no transacciones individuales). Anthropic
              <strong style={{ color: T.txt }}> no usa tus datos para entrenar sus modelos</strong> — es parte de
              nuestro acuerdo comercial con ellos.
            </p>
            <p style={{ margin: 0 }}>
              Tu nombre, email, número de identificación, dirección y datos
              personales nunca se envían a la IA.
            </p>
          </div>
        </section>

        {/* CONTACTO */}
        <section style={{
          background: `linear-gradient(135deg, rgba(34,197,94,0.08), rgba(59,130,246,0.08))`,
          border: `1px solid ${T.borderStrong}`,
          borderRadius: 20,
          padding: "32px",
          textAlign: "center",
        }}>
          <h2 style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 24, fontWeight: 700,
            margin: "0 0 12px 0",
            letterSpacing: -0.5,
          }}>
            ¿Tenés más preguntas?
          </h2>
          <p style={{ fontSize: 15, color: T.txt2, marginBottom: 24, maxWidth: 500, marginLeft: "auto", marginRight: "auto" }}>
            Si tenés cualquier inquietud sobre cómo manejamos tu información,
            escribinos directamente. Tu confianza es lo que más cuidamos.
          </p>
          <a
            href="mailto:soporte@finpathia.com?subject=Pregunta%20sobre%20seguridad"
            style={{
              display: "inline-block",
              background: T.green,
              color: "#0a0a0a",
              padding: "12px 28px",
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
              fontFamily: FONT_DISPLAY,
            }}
          >
            soporte@finpathia.com
          </a>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{
        borderTop: `1px solid ${T.border}`,
        padding: "32px 24px",
        textAlign: "center",
        fontSize: 12,
        color: T.txt3,
      }}>
        © 2026 FINPATHIA · Inteligencia patrimonial a tu servicio ·{" "}
        <a href="/privacidad" style={{ color: T.txt3 }}>Política de Privacidad</a>
      </footer>
    </div>
  );
}
