import { useState, useEffect } from "react";
import { getPlansForLanding } from "../lib/plans.js";
import HeroVariantC from "./HeroVariantC.jsx";
import LandingAIAdvisorSection from "./LandingAIAdvisorSection.jsx";

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", cyan: "#22d3ee", red: "#ef4444",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
};

export default function LandingPage({ onGetStarted }) {
  const [email, setEmail] = useState("");
  // TRM dinámica: fetch al montar el componente. Fallback a 4200 si falla.
  // Coherente con la lógica del app autenticado (App.jsx línea ~462).
  const [trm, setTrm] = useState(4200);
  useEffect(() => {
    fetch("/api/trm")
      .then(r => r.json())
      .then(j => { if (j?.trm) setTrm(j.trm); })
      .catch(() => {/* silent fallback a 4200 */});
  }, []);
  // Lista de planes consumida del source-of-truth en src/lib/plans.js
  // (refactor item #9). Cualquier cambio de pricing/features se hace allá
  // y se refleja automáticamente acá Y en App.jsx.
  const plansData = getPlansForLanding({ trm });

  const Section = ({ children, style: s }) => (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", ...s }}>{children}</div>
  );

  return (
    <div style={{ background: T.bg, color: T.txt, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>

      {/* ─── HERO ─── (Sesión 2-may-2026: Santiago eligió HeroVariantC
           inspirado en Optimus de v0.dev. Estilo editorial minimalista
           con typography masiva y candlestick chart de fondo. Las rutas
           /hero-a, /hero-b y /hero-c siguen disponibles para preview.) */}
      <HeroVariantC onGetStarted={onGetStarted} />

      {/* ─── FEATURES ─── */}
      <div id="features" style={{ background: T.bg2, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 0" }}>
        <Section>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Todo lo que necesitas en un solo lugar</h2>
            <p style={{ fontSize: 16, color: T.txt2, maxWidth: 500, margin: "0 auto" }}>Diseñado por inversionistas, para inversionistas. Premium pero accesible.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {[
              { icon: "📊", title: "Dashboard Inteligente", desc: "Patrimonio neto, cash flow, salud financiera, top performers y proyección patrimonial. Todo de un vistazo.", color: T.green },
              { icon: "📈", title: "Radiografía de tu Patrimonio", desc: "Visualiza el rendimiento real de cada activo: cuánto genera, cuánto cuesta y cuánto te queda. Todo en un vistazo.", color: T.blue },
              { icon: "🖥️", title: "Simulador con Sliders", desc: "Ajusta cada ingreso y gasto individualmente. La barra de libertad financiera reacciona en tiempo real.", color: T.purple },
              { icon: "🏛️", title: "Pensiones Colombia", desc: "Cálculo actuarial real: Colpensiones (Ley 797/2003), Fondo Privado, comparador lado a lado.", color: T.cyan },
              { icon: "₿", title: "Ahorro con Bitcoin", desc: "Simulador DCA con CAGR, regla 4% de retiro, proyección año por año. Inspirado en @AndresFelArias.", color: T.orange },
              { icon: "🤖", title: "Asesor Financiero IA", desc: "Agente inteligente que analiza tu patrimonio real: simula escenarios, optimiza impuestos, identifica riesgos y te da recomendaciones con montos exactos.", color: T.gold },
              { icon: "💹", title: "Portfolio de Trading", desc: "Posiciones, P/L, upside, targets por acción. Conecta tu broker favorito.", color: T.green },
              { icon: "💳", title: "Gastos & Deudas", desc: "Categorización inteligente, gastos fijos vs variables, deudas vinculadas a activos.", color: T.red },
              { icon: "🧾", title: "Planeación Tributaria", desc: "Estima impuestos por propietario fiscal. Clasificación DIAN automática y recomendaciones de optimización.", color: T.purple },
            ].map((f) => (
              <div key={f.title} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, transition: "border-color 0.2s" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ─── AI ADVISOR ─── (Sesión 1-may-2026: rediseñada en su propio
           componente. Antes era bloque fondo verde con bullets + Q&A boxes
           genéricos. Ahora: chat tipo iMessage con typing animation y
           datos reales del caso Sosa.) */}
      <LandingAIAdvisorSection onGetStarted={onGetStarted} />

      {/* ─── FREEDOM LEVELS ─── */}
      <Section style={{ padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Los 5 Niveles de Libertad Financiera</h2>
          <p style={{ fontSize: 16, color: T.txt2 }}>FINPATHIA te muestra exactamente en qué nivel estás y cómo avanzar</p>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: "🛡️", name: "Seguridad", desc: "Necesidades básicas cubiertas", color: T.blue },
            { icon: "⚡", name: "Vitalidad", desc: "Básicas + mitad estilo de vida", color: T.cyan },
            { icon: "🏆", name: "Independencia", desc: "100% gastos cubiertos", color: T.green },
            { icon: "🚀", name: "Libertad", desc: "Independencia + lujos", color: T.orange },
            { icon: "👑", name: "Absoluta", desc: "Sin límites", color: T.gold },
          ].map((l, i) => (
            <div key={l.name} style={{ background: T.bg2, border: `1px solid ${l.color}20`, borderRadius: 16, padding: "24px 20px", textAlign: "center", width: 180, position: "relative" }}>
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: T.bg, border: `1px solid ${l.color}30`, borderRadius: 99, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: l.color }}>{i + 1}</div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{l.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: l.color, marginBottom: 4 }}>{l.name}</div>
              <div style={{ fontSize: 12, color: T.txt3 }}>{l.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── TRUST ─── */}
      <Section style={{ padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>Tu privacidad es nuestra prioridad</h2>
          <p style={{ fontSize: 15, color: T.txt2, maxWidth: 480, margin: "0 auto" }}>Construido con los más altos estándares de seguridad financiera</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, maxWidth: 900, margin: "0 auto" }}>
          {[
            { i: "🔐", t: "Encriptación End-to-End", d: "Tus datos se encriptan con tu contraseña. Ni nosotros podemos leerlos. Nivel Signal." },
            { i: "👤", t: "Sin registro obligatorio", d: "Usa la plataforma completa sin crear cuenta. Tus datos nunca salen de tu navegador." },
            { i: "🚫", t: "No vendemos datos", d: "Cero publicidad, cero tracking financiero, cero venta de información." },
            { i: "✊", t: "Tú mandas", d: "Exporta, borra o lleva tus datos cuando quieras. Sin contratos." },
          ].map((item) => (
            <div key={item.t} style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 16, padding: "28px 16px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(34,197,94,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>{item.i}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{item.t}</div>
              <div style={{ fontSize: 13, color: T.txt3, lineHeight: 1.5 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── PRICING ─── */}
      <div style={{ background: T.bg2, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 0" }}>
        <Section>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.bg3, border: "1px solid " + T.border, borderRadius: 99, padding: "6px 16px", marginBottom: 20, fontSize: 13, color: T.txt2 }}>💰 Planes flexibles</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Proyecta tu futuro financiero hoy</h2>
            <p style={{ fontSize: 16, color: T.txt2, maxWidth: 500, margin: "0 auto" }}>Regístrate gratis y toma control de tu patrimonio</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, maxWidth: 1280, margin: "0 auto" }}>
            {plansData.map((p) => (
              <div key={p.name} style={{ background: T.bg, border: p.accent ? `2px solid ${T.green}` : p.advisor ? "1px solid rgba(59,130,246,0.35)" : p.comingSoon ? "1px dashed " + T.border : `1px solid ${T.border}`, borderRadius: 20, overflow: "hidden", position: "relative", opacity: p.comingSoon ? 0.95 : 1 }}>
                {p.accent && <div style={{ background: T.grad, color: "#000", textAlign: "center", padding: "8px 0", fontSize: 13, fontWeight: 700 }}>MÁS POPULAR</div>}
                {p.advisor && <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)", color: "#fff", textAlign: "center", padding: "8px 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>PARA PROFESIONALES</div>}
                {p.comingSoon && <div style={{ background: "linear-gradient(135deg, #a78bfa 0%, #3b82f6 100%)", color: "#fff", textAlign: "center", padding: "8px 0", fontSize: 13, fontWeight: 700 }}>PRONTO DISPONIBLE</div>}
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.txt3, marginBottom: 14, lineHeight: 1.4, minHeight: 32 }}>{p.tag}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                    {p.advisor && <span style={{ fontSize: 14, color: T.txt3, fontWeight: 500, marginRight: 2 }}>Desde</span>}
                    <span style={{ fontSize: p.comingSoon ? 26 : 40, fontWeight: 900, letterSpacing: "-0.04em", color: p.comingSoon ? T.txt3 : T.txt }}>{p.price}</span>
                    {p.per && <span style={{ color: T.txt3, fontSize: 14 }}>{p.per}</span>}
                  </div>
                  {p.sub && <div style={{ fontSize: 12, color: p.advisor ? T.blue : T.green, fontWeight: 600, marginBottom: 4 }}>{p.sub}</div>}
                  {p.copEquiv && <div style={{ fontSize: 11, color: T.txt3, fontWeight: 500, marginBottom: 14 }}>🇨🇴 {p.copEquiv}</div>}
                  {!p.sub && !p.copEquiv && <div style={{ marginBottom: 14 }} />}
                  {!p.copEquiv && p.sub && <div style={{ marginBottom: 10 }} />}
                  <div style={{ background: T.bg3, padding: "8px 12px", borderRadius: 8, fontSize: 11, color: T.txt2, marginBottom: 16, fontWeight: 600 }}>👤 {p.users}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ fontSize: 12, color: T.txt2, display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.5 }}>
                        <span style={{ color: p.advisor ? T.blue : p.comingSoon ? T.purple : T.green, fontSize: 12, flexShrink: 0, marginTop: 2 }}>✓</span> {f}
                      </div>
                    ))}
                    {(p.no || []).map((f) => (
                      <div key={f} style={{ fontSize: 12, color: T.txt3, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: T.txt3, fontSize: 12 }}>✗</span> {f}
                      </div>
                    ))}
                  </div>
                  {p.advisor ? (
                    <a href="/asesores" style={{ display: "block", textAlign: "center", width: "100%", padding: "14px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)", color: "#fff", boxSizing: "border-box" }}>
                      {p.cta}
                    </a>
                  ) : p.comingSoon ? (
                    <a href="mailto:soporte@finpathia.com?subject=Plan Pro Familiar — interesado&body=Hola, quiero entrar a la lista de espera del plan Pro Familiar." style={{ display: "block", textAlign: "center", width: "100%", padding: "14px", borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 700, background: T.bg3, border: "1px solid " + T.borderL, color: T.txt, boxSizing: "border-box" }}>
                      {p.cta}
                    </a>
                  ) : (
                    <button onClick={onGetStarted} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: p.accent ? T.grad : T.bg3, color: p.accent ? "#000" : T.txt }}>
                      {p.cta}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 20, color: T.txt3, fontSize: 13 }}>🔒 Pagos seguros con Stripe • Cancela cuando quieras • Sin compromisos</p>
          <p style={{ textAlign: "center", marginTop: 8, color: T.txt3, fontSize: 11 }}>🇨🇴 Conversión a TRM ≈ ${Math.round(trm).toLocaleString()} COP/USD · tu banco aplica su propia tasa al cargo en USD</p>

        </Section>
      </div>

      {/* ─── CTA FINAL ─── */}
      <Section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Tu patrimonio merece atención profesional. Es <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>gratis</span>.
        </h2>
        <p style={{ fontSize: 16, color: T.txt2, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
          Gestión patrimonial con inteligencia artificial. 14 días de prueba gratuita, sin tarjeta de crédito.
        </p>
        <button onClick={onGetStarted} style={{ background: T.grad, color: "#000", border: "none", padding: "18px 48px", borderRadius: 14, cursor: "pointer", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
          Comenzar 14 días Pro gratis →
        </button>
      </Section>

      {/* ─── DISCLAIMER ─── */}
      <Section style={{ padding: "0 24px 32px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 24px", background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, fontSize: 11, color: T.txt3, lineHeight: 1.7, textAlign: "center" }}>
          <strong style={{ color: T.txt2 }}>Aviso legal:</strong> FINPATHIA es una herramienta de simulación y gestión patrimonial con fines informativos y educativos. No constituye asesoría financiera, tributaria ni legal profesional. Las proyecciones, análisis y recomendaciones generadas por la plataforma y su agente de inteligencia artificial son estimaciones basadas en los datos proporcionados por el usuario y no garantizan resultados futuros. Cada persona es responsable de sus propias decisiones financieras. Consulte a un profesional certificado antes de tomar decisiones de inversión, tributarias o patrimoniales.
        </div>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</span>
        </div>
        <p style={{ fontSize: 12, color: T.txt3 }}>© 2026 FINPATHIA • <a href="/privacidad" style={{color:"#71717a"}}>Política de Privacidad</a></p>
      </footer>
    </div>
  );
}
