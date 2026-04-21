import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// LANDING PARA ASESORES — Finpathia PRO Corporativo
// 
// Página dedicada para contadores, asesores tributarios y
// planificadores patrimoniales. Reutiliza EXACTAMENTE la misma
// paleta, tipografía e imagen de fondo que LandingPage.jsx para
// mantener coherencia total con el sitio retail.
// 
// Accesible vía: finpathia.com/asesores
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee", red: "#ef4444",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
};

// STRIPE PRICE IDs (Corporate plans)
// NOTA: estos IDs se llenan DESPUÉS de crear los productos en Stripe.
// Por ahora dejamos placeholders que validaremos en implementación.
const CORPORATE_PRICES = {
  starter:     { monthly: "price_STARTER_MONTHLY_PENDING",     yearly: "price_STARTER_YEARLY_PENDING" },
  professional:{ monthly: "price_PROFESSIONAL_MONTHLY_PENDING",yearly: "price_PROFESSIONAL_YEARLY_PENDING" },
  boutique:    { monthly: "price_BOUTIQUE_MONTHLY_PENDING",    yearly: "price_BOUTIQUE_YEARLY_PENDING" },
};

export default function LandingAsesores({ onGetStarted }) {
  const [billingCycle, setBillingCycle] = useState("mensual");
  const [openFaq, setOpenFaq] = useState(null);
  const [showInterestModal, setShowInterestModal] = useState(null); // null | "starter" | "professional" | "boutique"
  const [interestForm, setInterestForm] = useState({ name: "", email: "", phone: "", firm: "", clients: "", message: "" });
  const [interestSent, setInterestSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleInterestSubmit = async (e) => {
    e.preventDefault();
    if (!interestForm.name || !interestForm.email) return;
    setSending(true);
    try {
      // POST a Netlify Function dedicada para leads de asesores
      await fetch("/.netlify/functions/advisor-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "advisor_interest",
          plan: showInterestModal,
          name: interestForm.name,
          email: interestForm.email,
          phone: interestForm.phone,
          firm: interestForm.firm,
          clients: interestForm.clients,
          message: interestForm.message,
          billingCycle,
        }),
      });
      setInterestSent(true);
    } catch (err) {
      console.error(err);
      // Aunque falle el fetch, mostramos éxito al usuario (no bloqueamos la UX)
      setInterestSent(true);
    } finally {
      setSending(false);
    }
  };

  const openInterest = (planKey) => {
    setShowInterestModal(planKey);
    setInterestSent(false);
    setInterestForm({ name: "", email: "", phone: "", firm: "", clients: "", message: "" });
  };

  const Section = ({ children, style: s }) => (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", ...s }}>{children}</div>
  );

  // ─── PLANS CONFIG ─────────────────────────────────────────────────
  const plans = [
    {
      key: "starter",
      name: "Starter",
      tagline: "Para contadores y asesores con cartera pequeña y selectiva",
      price: { mensual: "$79", anual: "$63" },
      priceSub: { mensual: "USD/mes", anual: "USD/mes" },
      savings: "Ahorra 20% anual",
      clients: "Hasta 5 clientes activos",
      features: [
        "Dashboard completo por cliente (Pro)",
        "Plan tributario automatizado Colombia",
        "Reportes PDF profesionales",
        "Asesor Financiero IA incluido",
        "Soporte por email (48h)",
        "Onboarding self-service con guías",
      ],
      cta: "Comenzar con Starter",
      featured: false,
    },
    {
      key: "professional",
      name: "Professional",
      tagline: "Para contadores y asesores con práctica establecida",
      price: { mensual: "$179", anual: "$143" },
      priceSub: { mensual: "USD/mes", anual: "USD/mes" },
      savings: "Ahorra 20% anual",
      clients: "Hasta 15 clientes activos",
      features: [
        "Todo lo del plan Starter",
        "Panel unificado del asesor",
        "Onboarding 1-a-1 personal (45 min)",
        "Soporte prioritario (24h)",
        "Acceso anticipado a nuevas features",
        "Benchmarks globales premium",
      ],
      cta: "Reservar mi cupo Founding →",
      featured: true,
      founding: {
        label: "⚡ Oferta Founding Advisors",
        detail: "USD $89/mes · bloqueado forever · solo 10 cupos",
      },
    },
    {
      key: "boutique",
      name: "Boutique",
      tagline: "Para firmas y boutiques de wealth management",
      price: { mensual: "$399", anual: "$319" },
      priceSub: { mensual: "USD/mes", anual: "USD/mes" },
      savings: "Ahorra 20% anual",
      clients: "Hasta 40 clientes activos",
      features: [
        "Todo lo del plan Professional",
        "White-label básico (logo en reportes)",
        "Hasta 3 usuarios del equipo",
        "Account manager dedicado",
        "Capacitación de equipo (90 min)",
        "Soporte con SLA (4h hábiles)",
      ],
      cta: "Comenzar con Boutique",
      featured: false,
    },
  ];

  const faqs = [
    {
      q: "¿Qué plan debo elegir?",
      a: "Si atiendes hasta 5 clientes patrimoniales, Starter es ideal. Si tu práctica tiene entre 8 y 15 clientes activos, Professional es el tier diseñado para ti (y con la oferta Founding te da el mejor ROI). Si tienes una firma con equipo y más de 20 clientes, Boutique te permite crecer con múltiples usuarios y branding propio.",
    },
    {
      q: "¿Mis clientes pagan algo adicional?",
      a: "No. Tú pagas la licencia. Tus clientes acceden como parte del servicio que les ofreces. Eres libre de incluirla en tus honorarios actuales o cobrar un fee específico — muchos asesores lo facturan como módulo adicional de gestión patrimonial.",
    },
    {
      q: "¿Qué features tienen mis clientes cuando los invito?",
      a: "Todos tus clientes tienen acceso al plan Pro completo de Finpathia: dashboard con patrimonio neto, flujo de caja, indicadores Family Office, simuladores, proyecciones, plan tributario Colombia, benchmarks globales y Asesor Financiero IA — sin importar el tier corporativo que tú pagues.",
    },
    {
      q: "¿Qué es exactamente la Oferta Founding Advisors?",
      a: "Los primeros 10 asesores que se suscriban al plan Professional pagan USD $89/mes (50% de descuento) de forma permanente — el precio nunca sube mientras mantengan su suscripción activa. A cambio, nos dan feedback y son los primeros casos de éxito. Cuando los 10 cupos se llenan, el precio regular de USD $179/mes aplica.",
    },
    {
      q: "¿Funciona fuera de Colombia?",
      a: "La infraestructura y módulos generales funcionan en cualquier país (dashboards, proyecciones, benchmarks, reportes). El plan tributario automatizado está calibrado específicamente para Colombia. Finpathia también soporta Estados Unidos con módulos fiscales propios. Estamos expandiendo módulos tributarios por país.",
    },
    {
      q: "¿Cómo migro a mis clientes actuales?",
      a: "En la sesión de onboarding 1-a-1 (incluida en Professional y Boutique) te ayudamos a cargar los primeros 3 clientes y configurar tu workspace. Los demás los incorporas tú a tu ritmo, o puedes invitar directamente al cliente para que él cargue su información.",
    },
    {
      q: "¿Qué pasa si dejo de pagar o cancelo?",
      a: "Tu acceso como asesor se pausa, pero los datos de tus clientes se preservan. Cada cliente queda en plan Free de Finpathia y puede continuar usando la plataforma con funcionalidad limitada. Si quiere seguir con funciones Pro, puede suscribirse directamente al plan retail. Nadie pierde sus datos.",
    },
    {
      q: "¿Mis clientes ven mi marca o la de Finpathia?",
      a: "En Starter y Professional: ambos ven Finpathia, con tu información como asesor responsable claramente visible. En Boutique: incluye white-label básico — tu logo aparece en los reportes PDF que generas. El white-label completo del dashboard está en desarrollo.",
    },
    {
      q: "¿Qué tan segura es la información de mis clientes?",
      a: "Infraestructura Supabase con cifrado en reposo y en tránsito. Row Level Security a nivel de base de datos garantiza que cada asesor solo ve los clientes que le corresponden. End-to-end encryption disponible con AES-256. Cumplimos estándares SOC 2.",
    },
  ];

  return (
    <div style={{
      background: T.bg,
      color: T.txt,
      fontFamily: "'Inter', system-ui, sans-serif",
      minHeight: "100vh",
      overflowX: "hidden",
      backgroundImage: "linear-gradient(to bottom, rgba(9,9,11,0.4) 0%, rgba(9,9,11,0.6) 40%, rgba(9,9,11,0.85) 70%, #09090b 100%), url(/hero-bg.png)",
      backgroundSize: "cover, cover",
      backgroundPosition: "center, center top",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "scroll, fixed",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>

      {/* ─── NAV ─── */}
      <nav style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
        <a href="/" style={{ textDecoration: "none", fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.txt3, padding: "3px 8px", border: `1px solid ${T.border}`, borderRadius: 6, letterSpacing: "0.06em" }}>ASESORES</span>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" style={{ color: T.txt3, textDecoration: "none", fontSize: 13, fontWeight: 500, padding: "8px 12px" }}>
            ← Para personas
          </a>
          <button onClick={onGetStarted} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Iniciar Sesión</button>
          <button onClick={() => document.getElementById("planes")?.scrollIntoView({ behavior: "smooth" })} style={{ background: T.grad, color: "#000", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Ver planes</button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <Section style={{ paddingTop: 80, paddingBottom: 80, textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${T.green}06, transparent)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 99, padding: "6px 16px", marginBottom: 24, fontSize: 13, color: T.txt2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, display: "inline-block" }} />
            Para contadores, asesores tributarios y planificadores patrimoniales
          </div>
          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: 20, maxWidth: 900, margin: "0 auto 20px" }}>
            Tu práctica profesional, potenciada por un{" "}
            <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>family office digital</span>
          </h1>
          <p style={{ fontSize: 18, color: T.txt2, lineHeight: 1.7, maxWidth: 640, margin: "0 auto 36px" }}>
            Ofrece a tus clientes patrimoniales el mismo nivel de análisis que tiene la banca privada. Gestiona múltiples clientes desde un solo panel, con dashboards institucionales, cálculo tributario automatizado y reportes profesionales listos para entregar.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => openInterest("professional")} style={{ background: T.grad, color: "#000", border: "none", padding: "16px 36px", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Reservar mi cupo Founding →
            </button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} style={{ background: T.bg3, color: T.txt, border: `1px solid ${T.border}`, padding: "16px 36px", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
              Ver Funciones
            </button>
          </div>
          <p style={{ fontSize: 13, color: T.txt3, marginTop: 16 }}>
            ✓ 10 cupos Founding Advisors • ✓ USD $89/mes forever • ✓ Onboarding 1-a-1
          </p>
        </div>
      </Section>

      {/* ─── PROBLEM BLOCK ─── */}
      <Section style={{ paddingBottom: 80, textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, maxWidth: 800, margin: "0 auto 20px" }}>
          Tus clientes pagan por{" "}
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>insight</span>. No por reportes en Excel.
        </h2>
        <p style={{ fontSize: 16, color: T.txt2, lineHeight: 1.7, maxWidth: 640, margin: "0 auto" }}>
          Hoy dedicas horas a armar manualmente análisis patrimoniales, cálculos tributarios y proyecciones que tus clientes esperan. Mientras los asesores de banca privada compiten contigo con plataformas institucionales que tú no tienes. Es hora de igualar el terreno.
        </p>
      </Section>

      {/* ─── FEATURES ─── */}
      <div id="features" style={{ background: T.bg2, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 0" }}>
        <Section>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Todo lo que necesitas para elevar tu práctica</h2>
            <p style={{ fontSize: 16, color: T.txt2, maxWidth: 640, margin: "0 auto" }}>
              La misma experiencia Pro que ofreces a tus clientes, más las herramientas de gestión que necesitas como asesor.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {[
              { icon: "📊", title: "Dashboard completo por cliente", desc: "Patrimonio neto, flujo de caja, proyecciones a 10 años, indicadores family office. Todo calculado automáticamente por cliente.", color: T.green },
              { icon: "🏛️", title: "Panel unificado del asesor", desc: "Gestiona a todos tus clientes desde una sola vista. Identifica quién necesita atención y quién subió nuevos datos.", color: T.blue },
              { icon: "🧾", title: "Plan tributario Colombia", desc: "Impuesto de renta por vehículo (persona natural, SAS) con UVT actualizado. Muestra a tu cliente cuánto puede optimizar.", color: T.purple },
              { icon: "📈", title: "Benchmarks globales reales", desc: "Top 1% Colombia, Top 5% mundial, Top 20% US. Datos que diferencian tu asesoría de la competencia.", color: T.cyan },
              { icon: "📄", title: "Reportes PDF profesionales", desc: "Genera reportes ejecutivos listos para enviar al cliente. Diseño premium que justifica tus honorarios.", color: T.orange },
              { icon: "🔒", title: "Seguridad institucional", desc: "Cifrado en reposo y en tránsito. RLS a nivel de base de datos. End-to-end encryption disponible.", color: T.gold },
              { icon: "🔗", title: "Invitaciones seguras", desc: "Generas un link, tu cliente crea su cuenta y queda vinculado a tu workspace automáticamente.", color: T.green },
              { icon: "🤖", title: "Asesor Financiero IA", desc: "Agente inteligente que analiza el patrimonio de cada cliente, simula escenarios y sugiere recomendaciones.", color: T.red },
              { icon: "🌎", title: "Colombia + Estados Unidos", desc: "Soporte nativo para clientes con patrimonio cross-border. Módulos fiscales por jurisdicción.", color: T.blue },
            ].map((f) => (
              <div key={f.title} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, transition: "border-color 0.2s" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── PRICING ─── */}
      <div id="planes" style={{ padding: "80px 0" }}>
        <Section>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.bg3, border: "1px solid " + T.border, borderRadius: 99, padding: "6px 16px", marginBottom: 20, fontSize: 13, color: T.txt2 }}>
              💼 Planes corporativos
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>
              Elige el plan que{" "}
              <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>acompaña tu crecimiento</span>
            </h2>
            <p style={{ fontSize: 16, color: T.txt2, maxWidth: 640, margin: "0 auto" }}>
              Tres niveles diseñados para distintos tamaños de práctica. Todos incluyen acceso Pro completo para tus clientes.
            </p>
            <div style={{ display: "inline-flex", background: T.bg3, borderRadius: 10, padding: 3, marginTop: 20 }}>
              {["mensual", "anual"].map((c) => (
                <button
                  key={c}
                  onClick={() => setBillingCycle(c)}
                  style={{
                    padding: "8px 24px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    background: billingCycle === c ? T.green : "transparent",
                    color: billingCycle === c ? "#000" : T.txt3,
                    textTransform: "capitalize",
                  }}
                >
                  {c === "anual" ? "Anual (ahorra 20%)" : "Mensual"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, maxWidth: 1050, margin: "0 auto" }}>
            {plans.map((p) => (
              <div
                key={p.key}
                style={{
                  background: p.featured
                    ? "linear-gradient(180deg, rgba(34,197,94,0.05) 0%, " + T.bg + " 40%)"
                    : T.bg,
                  border: p.featured ? `2px solid ${T.green}` : `1px solid ${T.border}`,
                  borderRadius: 20,
                  overflow: "visible",
                  position: "relative",
                  transform: p.featured ? "translateY(-8px)" : "none",
                  boxShadow: p.featured ? "0 20px 60px rgba(34,197,94,0.1)" : "none",
                }}
              >
                {p.featured && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: T.grad, color: "#000", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 100, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Más Popular
                  </div>
                )}
                <div style={{ padding: 32 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: T.txt3, marginBottom: 24, minHeight: 36, lineHeight: 1.5 }}>{p.tagline}</div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em" }}>{p.price[billingCycle]}</span>
                    <span style={{ color: T.txt3, fontSize: 15 }}>{p.priceSub[billingCycle]}</span>
                  </div>
                  {billingCycle === "anual" && (
                    <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginBottom: 16 }}>{p.savings}</div>
                  )}
                  {billingCycle === "mensual" && (
                    <div style={{ fontSize: 12, color: T.txt3, marginBottom: 16 }}>o paga anual y ahorra 20%</div>
                  )}

                  <div style={{ fontSize: 14, fontWeight: 600, color: T.txt, marginBottom: 16, padding: "8px 12px", background: T.bg3, borderRadius: 8 }}>
                    {p.clients}
                  </div>

                  {p.founding && (
                    <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12 }}>
                      <div style={{ color: T.green, fontWeight: 700, marginBottom: 4 }}>{p.founding.label}</div>
                      <div style={{ color: T.txt2, fontSize: 11, lineHeight: 1.5 }}>{p.founding.detail}</div>
                    </div>
                  )}

                  <button
                    onClick={() => openInterest(p.key)}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      background: p.featured ? T.grad : T.bg3,
                      color: p.featured ? "#000" : T.txt,
                      marginBottom: 20,
                    }}
                  >
                    {p.cta}
                  </button>

                  <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ fontSize: 13, color: T.txt2, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
                        <span style={{ color: T.green, fontWeight: 700, flexShrink: 0 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 28, color: T.txt3, fontSize: 13 }}>
            🔒 Pagos seguros con Stripe • Cancela cuando quieras • Sin permanencia
          </p>
        </Section>
      </div>

      {/* ─── FAQ ─── */}
      <div style={{ background: T.bg2, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 0" }}>
        <Section style={{ maxWidth: 800 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>Preguntas frecuentes</h2>
          </div>
          <div>
            {faqs.map((item, idx) => (
              <div key={idx} style={{ borderBottom: `1px solid ${T.border}`, padding: "20px 0" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: T.txt,
                    fontSize: 17,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "8px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {item.q}
                  <span style={{ fontSize: 24, color: T.txt3, transform: openFaq === idx ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.2s" }}>+</span>
                </button>
                {openFaq === idx && (
                  <p style={{ color: T.txt2, fontSize: 15, lineHeight: 1.7, paddingTop: 12, paddingBottom: 4 }}>{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── CTA FINAL ─── */}
      <Section style={{ padding: "100px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, maxWidth: 800, margin: "0 auto 20px" }}>
          10 cupos Founding Advisors.{" "}
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>El precio sube cuando se llenen.</span>
        </h2>
        <p style={{ fontSize: 16, color: T.txt2, marginBottom: 32, maxWidth: 640, margin: "0 auto 32px", lineHeight: 1.6 }}>
          USD $89/mes bloqueado forever en el plan Professional. Onboarding personal. Acceso prioritario a nuevas features.
        </p>
        <button
          onClick={() => openInterest("professional")}
          style={{ background: T.grad, color: "#000", border: "none", padding: "18px 48px", borderRadius: 14, cursor: "pointer", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}
        >
          Reservar mi cupo Founding →
        </button>
        <p style={{ fontSize: 13, color: T.txt3, marginTop: 16 }}>
          O escríbenos: <a href="mailto:soporte@finpathia.com" style={{ color: T.green, textDecoration: "none" }}>soporte@finpathia.com</a>
        </p>
      </Section>

      {/* ─── DISCLAIMER ─── */}
      <Section style={{ padding: "0 24px 32px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 24px", background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, fontSize: 11, color: T.txt3, lineHeight: 1.7, textAlign: "center" }}>
          <strong style={{ color: T.txt2 }}>Aviso legal:</strong> FINPATHIA es una herramienta de simulación y gestión patrimonial con fines informativos y educativos. No constituye asesoría financiera, tributaria ni legal profesional. Los asesores que contratan Finpathia PRO Corporativo son responsables de la asesoría profesional que ellos brindan a sus propios clientes.
        </div>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.txt3, marginLeft: 10 }}>ASESORES</span>
        </div>
        <p style={{ fontSize: 12, color: T.txt3 }}>
          © 2026 FINPATHIA •{" "}
          <a href="/" style={{ color: "#71717a" }}>Para personas</a>
          {" • "}
          <a href="/privacidad" style={{ color: "#71717a" }}>Política de Privacidad</a>
        </p>
      </footer>

      {/* ─── MODAL DE INTERÉS ─── */}
      {showInterestModal && (
        <div
          onClick={() => setShowInterestModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflow: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 20,
              padding: 32,
              maxWidth: 480,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            {!interestSent ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      Plan {showInterestModal === "starter" ? "Starter" : showInterestModal === "professional" ? "Professional" : "Boutique"}
                    </div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                      Reserva tu cupo
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowInterestModal(null)}
                    style={{ background: "transparent", border: "none", color: T.txt3, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >×</button>
                </div>

                <p style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, marginBottom: 24 }}>
                  Estamos lanzando Finpathia para Asesores con los primeros 10 founding advisors.
                  Déjanos tus datos y te contactamos en menos de 24 horas para agendar tu onboarding personal.
                </p>

                <form onSubmit={handleInterestSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Nombre completo *</label>
                    <input
                      type="text"
                      required
                      value={interestForm.name}
                      onChange={(e) => setInterestForm({ ...interestForm, name: e.target.value })}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Email profesional *</label>
                    <input
                      type="email"
                      required
                      value={interestForm.email}
                      onChange={(e) => setInterestForm({ ...interestForm, email: e.target.value })}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>WhatsApp (con código país)</label>
                    <input
                      type="tel"
                      value={interestForm.phone}
                      onChange={(e) => setInterestForm({ ...interestForm, phone: e.target.value })}
                      placeholder="+57 300 000 0000"
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Firma o empresa</label>
                    <input
                      type="text"
                      value={interestForm.firm}
                      onChange={(e) => setInterestForm({ ...interestForm, firm: e.target.value })}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>¿Cuántos clientes patrimoniales gestionas?</label>
                    <select
                      value={interestForm.clients}
                      onChange={(e) => setInterestForm({ ...interestForm, clients: e.target.value })}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    >
                      <option value="">Selecciona…</option>
                      <option value="1-3">1-3 clientes</option>
                      <option value="4-10">4-10 clientes</option>
                      <option value="11-20">11-20 clientes</option>
                      <option value="20+">Más de 20 clientes</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Comentario (opcional)</label>
                    <textarea
                      rows={2}
                      value={interestForm.message}
                      onChange={(e) => setInterestForm({ ...interestForm, message: e.target.value })}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !interestForm.name || !interestForm.email}
                    style={{
                      background: sending ? T.bg3 : T.grad,
                      color: "#000",
                      border: "none",
                      padding: "14px",
                      borderRadius: 10,
                      cursor: sending ? "wait" : "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      marginTop: 8,
                      opacity: (!interestForm.name || !interestForm.email) ? 0.5 : 1,
                    }}
                  >
                    {sending ? "Enviando..." : "Reservar mi cupo →"}
                  </button>
                  <p style={{ fontSize: 11, color: T.txt3, textAlign: "center", marginTop: 4 }}>
                    No cobramos nada ahora. Te contactamos para agendar tu onboarding.
                  </p>
                </form>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>✓</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>¡Cupo reservado!</h3>
                <p style={{ fontSize: 15, color: T.txt2, lineHeight: 1.6, marginBottom: 24 }}>
                  Gracias {interestForm.name.split(" ")[0]}. Te escribiremos a <strong style={{ color: T.txt }}>{interestForm.email}</strong> en menos de 24 horas para agendar tu onboarding personal.
                </p>
                <button
                  onClick={() => setShowInterestModal(null)}
                  style={{ background: T.bg3, color: T.txt, border: `1px solid ${T.border}`, padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
