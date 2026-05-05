// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · OnboardingTour.jsx — Sesión 4-may-2026
//
// Componente de bienvenida que aparece después del primer signup. Su misión:
// guiar al usuario a SU PRIMER MOMENTO DE VALOR en menos de 60 segundos.
//
// Sin esto, ~40% de los nuevos signups se pierden mirando un dashboard vacío
// sin saber qué hacer. Con tour, los llevamos directo a una de 3 acciones
// que ofrecen valor inmediato:
//
//   1. EXPLORAR CON DEMO   — usuarios que quieren "ver cómo se siente"
//   2. IMPORTAR EXCEL      — usuarios que ya manejan plata en spreadsheets
//   3. CARGAR MANUALMENTE  — usuarios que prefieren empezar limpio
//
// Diseño inspirado en Linear, Stripe Onboarding, y Notion First-Run.
//
// Patrón: 1 step de bienvenida + 1 step de selección de path. Súper corto.
// La idea es ser una rampa de despegue, no un curso.
//
// Persistencia: una vez completado, se guarda flag en u.p.onboarded=true
// para no volver a mostrarse. Si el user lo cierra a mitad, lo guardamos
// también — no queremos hostigarlo si decidió saltarse.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { track } from "../lib/analytics";

const FONT_DISPLAY = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

const T = {
  bg: "#09090b",
  bg2: "#141418",
  border: "rgba(255,255,255,0.08)",
  borderL: "rgba(255,255,255,0.14)",
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a78bfa",
};

// ─── Iconos SVG inline ──────────────────────────────────────────────────────
const IconChart = ({ size = 28, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const IconUpload = ({ size = 28, color = T.blue }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconEdit = ({ size = 28, color = T.purple }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconArrow = ({ size = 16, color = T.txt2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconSparkles = ({ size = 22, color = T.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.88 5.76a2 2 0 0 0 1.36 1.36L21 12l-5.76 1.88a2 2 0 0 0-1.36 1.36L12 21l-1.88-5.76a2 2 0 0 0-1.36-1.36L3 12l5.76-1.88a2 2 0 0 0 1.36-1.36L12 3z" />
  </svg>
);

// ─── Card de path (las 3 opciones del paso 2) ──────────────────────────────
function PathCard({ icon: Icon, iconColor, title, description, onClick, recommended }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: T.bg2,
        border: `1px solid ${recommended ? T.green : T.border}`,
        borderRadius: 14,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s ease",
        position: "relative",
        fontFamily: FONT_BODY,
        outline: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = recommended ? T.green : T.borderL;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = recommended ? T.green : T.border;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {recommended && (
        <span
          style={{
            position: "absolute",
            top: -10,
            right: 14,
            background: T.green,
            color: "#000",
            fontSize: 10,
            fontWeight: 800,
            padding: "3px 10px",
            borderRadius: 99,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Recomendado
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${iconColor}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={22} color={iconColor} />
        </div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.txt,
            margin: 0,
            fontFamily: FONT_DISPLAY,
          }}
        >
          {title}
        </h3>
      </div>
      <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: iconColor,
          marginTop: 4,
        }}
      >
        Empezar acá
        <IconArrow size={14} color={iconColor} />
      </div>
    </button>
  );
}

/**
 * @param {Object} props
 * @param {boolean} props.open - Si el modal está abierto
 * @param {string} props.userName - Nombre del usuario para personalizar saludo
 * @param {boolean} props.isPioneros - Si llegó vía /pioneros (mensaje especial)
 * @param {() => void} props.onSelectDemo - "Cargar datos de ejemplo"
 * @param {() => void} props.onSelectImport - "Importar mi Excel"
 * @param {() => void} props.onSelectManual - "Empezar de cero"
 * @param {() => void} props.onClose - Cerrar/saltar tour
 */
export default function OnboardingTour({
  open,
  userName = "",
  isPioneros = false,
  onSelectDemo,
  onSelectImport,
  onSelectManual,
  onClose,
}) {
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      track("onboarding_started", { is_pioneros: isPioneros });
    }
  }, [open, isPioneros]);

  if (!open) return null;

  // Saludo: usar primer nombre si tiene, fallback genérico
  const firstName = (userName || "").split(" ")[0] || "";
  const greeting = firstName ? `¡Hola ${firstName}!` : "¡Bienvenido!";

  const handleSelect = (action) => {
    track("onboarding_path_selected", { path: action, is_pioneros: isPioneros });
    if (action === "demo") onSelectDemo?.();
    else if (action === "import") onSelectImport?.();
    else if (action === "manual") onSelectManual?.();
  };

  const handleSkip = () => {
    track("onboarding_skipped", { step, is_pioneros: isPioneros });
    onClose?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.3s ease",
        fontFamily: FONT_BODY,
      }}
    >
      <div
        style={{
          background: T.bg,
          border: `1px solid ${T.borderL}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflow: "auto",
          padding: "clamp(24px, 6vw, 40px) clamp(20px, 5vw, 36px) clamp(20px, 5vw, 32px)",
          position: "relative",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Botón skip arriba derecha */}
        <button
          onClick={handleSkip}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            color: T.txt3,
            fontSize: 13,
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: 6,
          }}
        >
          Saltar →
        </button>

        {/* STEP 0: Bienvenida */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            {/* Pioneros badge si aplica */}
            {isPioneros && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(34,197,94,0.1)",
                  border: `1px solid rgba(34,197,94,0.3)`,
                  padding: "6px 14px",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.green,
                  marginBottom: 24,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                <IconSparkles size={14} color={T.green} />
                Acceso Pioneros 2026
              </div>
            )}

            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: "clamp(24px, 6vw, 36px)",
                fontWeight: 800,
                lineHeight: 1.1,
                margin: "0 0 16px 0",
                letterSpacing: -1,
                color: T.txt,
              }}
            >
              {greeting}
            </h1>

            <p
              style={{
                fontSize: 16,
                color: T.txt2,
                lineHeight: 1.6,
                maxWidth: 500,
                margin: "0 auto 32px",
              }}
            >
              FINPATHIA es tu <strong style={{ color: T.txt }}>family office personal</strong> — el lugar donde
              centralizás tu patrimonio, planeás tus impuestos y consultás con un asesor IA que ve
              tus números reales.
            </p>

            <p
              style={{
                fontSize: 14,
                color: T.txt3,
                marginBottom: 28,
                lineHeight: 1.5,
              }}
            >
              En los próximos 60 segundos vas a estar viendo tu primera proyección.<br />
              Solo necesitamos saber por dónde querés empezar.
            </p>

            <button
              onClick={() => {
                setStep(1);
                track("onboarding_step_completed", { step: 0 });
              }}
              style={{
                background: `linear-gradient(135deg, ${T.green}, #16a34a)`,
                color: "#000",
                border: "none",
                padding: "14px 32px",
                borderRadius: 99,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: FONT_DISPLAY,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Vamos →
            </button>
          </div>
        )}

        {/* STEP 1: Selección de path */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 26,
                  fontWeight: 800,
                  margin: "0 0 12px 0",
                  letterSpacing: -0.5,
                  color: T.txt,
                }}
              >
                ¿Por dónde empezamos?
              </h2>
              <p style={{ fontSize: 14, color: T.txt2, margin: 0, lineHeight: 1.5 }}>
                Elegí lo que mejor se ajuste a vos. Podés cambiar en cualquier momento.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <PathCard
                icon={IconUpload}
                iconColor={T.blue}
                title="Importar mi Excel"
                description="Si ya manejás tu plata en una hoja de cálculo, importala en 1 click. Nuestra IA detecta inversiones, ingresos y gastos automáticamente."
                onClick={() => handleSelect("import")}
                recommended
              />
              <PathCard
                icon={IconChart}
                iconColor={T.green}
                title="Explorar con datos de ejemplo"
                description="Cargá un patrimonio ficticio para entender qué hace FINPATHIA antes de meter tus datos reales. Lo borrás cuando quieras."
                onClick={() => handleSelect("demo")}
              />
              <PathCard
                icon={IconEdit}
                iconColor={T.purple}
                title="Empezar de cero"
                description="Cargá tus inversiones, ingresos y gastos manualmente, paso a paso. Ideal si querés total control desde el primer dato."
                onClick={() => handleSelect("manual")}
              />
            </div>

            <div
              style={{
                textAlign: "center",
                fontSize: 12,
                color: T.txt3,
                lineHeight: 1.5,
              }}
            >
              💡 <strong style={{ color: T.txt2 }}>Tip:</strong> sea cual sea tu opción, después vas a poder
              hablar con el <strong style={{ color: T.green }}>Asesor IA</strong> sobre tus números.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
