import { useState } from "react";

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

  const Section = ({ children, style: s }) => (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", ...s }}>{children}</div>
  );

  return (
    <div style={{ background: T.bg, color: T.txt, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>

      {/* ─── NAV ─── */}
      <nav style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em" }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATH</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onGetStarted} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Ingresar</button>
          <button onClick={onGetStarted} style={{ background: T.grad, color: "#000", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Empezar Gratis</button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <Section style={{ paddingTop: 80, paddingBottom: 80, textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${T.green}06, transparent)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 99, padding: "6px 16px", marginBottom: 24, fontSize: 13, color: T.txt2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, display: "inline-block" }} />
            Plataforma financiera premium para familias
          </div>
          <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: 20, maxWidth: 800, margin: "0 auto 20px" }}>
            Tu camino a la{" "}
            <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>libertad financiera</span>
          </h1>
          <p style={{ fontSize: 18, color: T.txt2, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 36px" }}>
            Controla inversiones, gastos, deudas y patrimonio. Simula escenarios. Planifica tu pensión. 5 coaches IA legendarios te guían.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onGetStarted} style={{ background: T.grad, color: "#000", border: "none", padding: "16px 36px", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Comenzar Gratis →
            </button>
            <button onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} style={{ background: T.bg3, color: T.txt, border: `1px solid ${T.border}`, padding: "16px 36px", borderRadius: 12, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
              Ver Funciones
            </button>
          </div>
          <p style={{ fontSize: 13, color: T.txt3, marginTop: 16 }}>✓ Gratis para siempre • ✓ Sin tarjeta de crédito • ✓ 30 segundos para empezar</p>
        </div>
      </Section>

      {/* ─── SOCIAL PROOF ─── */}
      <Section style={{ paddingBottom: 60 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", opacity: 0.5 }}>
          {["📊 12 Módulos", "🧠 5 Coaches IA", "₿ Pensión BTC", "🏛️ Colpensiones", "📈 Trading IBKR"].map((t) => (
            <span key={t} style={{ fontSize: 14, color: T.txt3, fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </Section>

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
              { icon: "📈", title: "Inversiones con Sub-Unidades", desc: "Cada propiedad con sus propias unidades, ingresos y gastos. NOI, ROI, Cap Rate, Cash-on-Cash.", color: T.blue },
              { icon: "🖥️", title: "Simulador con Sliders", desc: "Ajusta cada ingreso y gasto individualmente. La barra de libertad financiera reacciona en tiempo real.", color: T.purple },
              { icon: "🏛️", title: "Pensiones Colombia", desc: "Cálculo actuarial real: Colpensiones (Ley 797/2003), Fondo Privado, comparador lado a lado.", color: T.cyan },
              { icon: "₿", title: "Ahorro con Bitcoin", desc: "Simulador DCA con CAGR, regla 4% de retiro, proyección año por año. Inspirado en @AndresFelArias.", color: T.orange },
              { icon: "🧠", title: "5 Coaches IA Legendarios", desc: "5 estilos de asesoría financiera analizan tus datos reales y te dan recomendaciones personalizadas.", color: T.gold },
              { icon: "💹", title: "Portfolio de Trading", desc: "Posiciones, P/L, upside, targets por acción. Conecta tu broker favorito.", color: T.green },
              { icon: "💳", title: "Gastos & Deudas", desc: "Categorización inteligente, gastos fijos vs variables, deudas vinculadas a activos.", color: T.red },
              { icon: "📤", title: "Importar CSV", desc: "Sube tus datos desde Excel en segundos. Plantillas descargables para cada módulo.", color: T.purple },
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

      {/* ─── FREEDOM LEVELS ─── */}
      <Section style={{ padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>Los 5 Niveles de Libertad Financiera</h2>
          <p style={{ fontSize: 16, color: T.txt2 }}>FINPATH te muestra exactamente en qué nivel estás y cómo avanzar</p>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {[
            { i: "🔒", t: "Encriptación", d: "Datos protegidos con Row Level Security" },
            { i: "👤", t: "Acceso privado", d: "Solo tú ves tu información financiera" },
            { i: "🚫", t: "Cero publicidad", d: "Tu información no es el producto" },
            { i: "✊", t: "Tú mandas", d: "Exporta o borra tus datos cuando quieras" },
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, maxWidth: 950, margin: "0 auto" }}>
            {[
              { name: "Free", price: "$0", per: "gratis", features: ["Dashboard básico", "3 inversiones", "Gastos y deudas", "Simulador limitado", "1 meta financiera"], no: ["Coaches IA", "Pensiones", "Trading", "Alertas", "PDF"], cta: "Empezar Gratis" },
              { name: "Básico", price: "$8", per: "/mes", sub: "$6/mes anual — Ahorra 25%", features: ["Todo en Free", "10 inversiones y 10 metas", "Simulador avanzado", "Pensiones Colpensiones + BTC", "Trading portfolio", "CSV import + PDF export"], no: ["Coaches IA", "Family Office KPIs", "Alertas inteligentes"], cta: "Comenzar" },
              { name: "Pro", price: "$16", per: "/mes", sub: "$12/mes anual — Ahorra 25%", features: ["Todo en Básico", "Inversiones ilimitadas", "5 Coaches IA", "Family Office KPIs", "Alertas inteligentes", "Percentil de riqueza", "Benchmark vs mercado", "Resumen ejecutivo", "Soporte prioritario"], no: [], accent: true, cta: "Comenzar Pro" },
            ].map((p) => (
              <div key={p.name} style={{ background: T.bg, border: p.accent ? `2px solid ${T.green}` : `1px solid ${T.border}`, borderRadius: 20, overflow: "hidden", position: "relative" }}>
                {p.accent && <div style={{ background: T.grad, color: "#000", textAlign: "center", padding: "8px 0", fontSize: 13, fontWeight: 700 }}>MÁS POPULAR</div>}
                <div style={{ padding: 32 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.04em" }}>{p.price}</span>
                    <span style={{ color: T.txt3, fontSize: 15 }}>{p.per}</span>
                  </div>
                  {p.sub && <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginBottom: 16 }}>{p.sub}</div>}
                  {!p.sub && <div style={{ marginBottom: 16 }} />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ fontSize: 14, color: T.txt2, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: T.green, fontSize: 14 }}>✓</span> {f}
                      </div>
                    ))}
                    {(p.no || []).map((f) => (
                      <div key={f} style={{ fontSize: 14, color: T.txt3, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: T.txt3, fontSize: 14 }}>✗</span> {f}
                      </div>
                    ))}
                  </div>
                  <button onClick={onGetStarted} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, background: p.accent ? T.grad : T.bg3, color: p.accent ? "#000" : T.txt }}>
                    {p.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 20, color: T.txt3, fontSize: 13 }}>🔒 Pagos seguros con Stripe • Cancela cuando quieras • Sin compromisos</p>
        </Section>
      </div>

      {/* ─── CTA FINAL ─── */}
      <Section style={{ padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 12 }}>
          Empieza hoy. Es <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>gratis</span>.
        </h2>
        <p style={{ fontSize: 16, color: T.txt2, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
          Más de 12 módulos financieros. 5 coaches IA. Simulador de pensiones. Ahorro en BTC. Todo en un solo lugar.
        </p>
        <button onClick={onGetStarted} style={{ background: T.grad, color: "#000", border: "none", padding: "18px 48px", borderRadius: 14, cursor: "pointer", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
          Crear Mi Cuenta Gratis →
        </button>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATH</span>
        </div>
        <p style={{ fontSize: 12, color: T.txt3 }}>Tu camino a la libertad financiera • © 2026 FINPATH</p>
      </footer>
    </div>
  );
}
