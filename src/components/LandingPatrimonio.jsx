// LandingPatrimonio.jsx · 17-oct-2026
// Landing de anuncios: finpathia.com/patrimonio. Copy según
// funnel/brief_landing_patrimonio.md: solo afirmaciones verificadas por QA.
// Sin demo, sin "Explorar sin cuenta", sin bloque de temporada.
import { useEffect, useState } from "react";
import { getConsent, setConsent, loadTrackers, initConsent } from "../lib/consent";
import { track } from "../lib/analytics";

const T = {
  bg: "#0c0c0f", bg2: "#141418", border: "rgba(255,255,255,0.08)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a", green: "#22c55e", blue: "#3b82f6",
};
const DISPLAY = "'Plus Jakarta Sans','Inter',system-ui,sans-serif";
const BODY = "'Inter',system-ui,sans-serif";

export const PLANES_TEXTO =
  "Hay plan gratis. Pro cuesta 16 USD al mes, o 12 USD al mes en plan anual. Pro Familiar: 27 USD al mes, o 20 en anual, hasta 10 personas.";

export const FAQ = [
  ["¿Cuánto cuesta?", PLANES_TEXTO],
  ["¿Qué pasa al terminar los 14 días?", "Sigues en el plan gratis y conservas tus datos."],
  ["¿Mis datos están seguros?",
    "Tu contraseña se guarda cifrada y la conexión entre tu navegador y Finpathia viaja cifrada. Tus datos se alojan en Supabase y AWS, con acceso separado por usuario. Los pagos los procesa Stripe: Finpathia no ve ni guarda los datos de tu tarjeta."],
  ["¿Es asesoría de inversión?", "No. Finpathia te da claridad sobre tu patrimonio; las decisiones son tuyas."],
];

const PASOS = ["Crea tu cuenta gratis.", "Carga tus cuentas, activos y deudas.", "Mira tu patrimonio neto y cada activo en claro."];

export default function LandingPatrimonio({ onGetStarted = () => {}, onLogin = () => {} }) {
  const [consent, setC] = useState(null);
  useEffect(() => { setC(initConsent()); }, []);

  const decidir = (v) => {
    setConsent(v);
    setC(v);
    if (v === "granted") loadTrackers();
  };
  const cta = (id) => onGetStarted(id);

  const wrap = { maxWidth: 1040, margin: "0 auto", padding: "0 20px" };
  const btn = { background: T.green, color: "#000", border: "none", borderRadius: 12, padding: "16px 28px", fontWeight: 800, fontSize: 17, cursor: "pointer", fontFamily: BODY };
  const h2 = { fontFamily: DISPLAY, fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, margin: "0 0 14px" };

  return (
    <div style={{ background: T.bg, color: T.txt, minHeight: "100vh", fontFamily: BODY }}>
      <header style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 900, background: "linear-gradient(135deg,#22c55e,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</div>
        <button type="button" onClick={onLogin} style={{ background: "transparent", color: T.txt2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontFamily: BODY }}>Iniciar sesión</button>
      </header>

      <main>
        <section style={{ ...wrap, textAlign: "center", padding: "48px 20px 32px" }}>
          <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(34px,6vw,56px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 18px" }}>¿Cuánto vale todo lo que tienes?</h1>
          <p style={{ fontSize: 19, color: T.txt2, maxWidth: 640, margin: "0 auto 28px", lineHeight: 1.5 }}>Cuentas, inversiones, propiedades y deudas en un solo lugar, con tu patrimonio neto a la vista.</p>
          <button type="button" style={btn} onClick={() => cta("hero")}>Ver mi patrimonio</button>
          <p style={{ fontSize: 13, color: T.txt3, margin: "12px 0 32px" }}>14 días Pro sin tarjeta. Después sigues gratis o eliges un plan.</p>
          <figure style={{ margin: 0 }}>
            <picture>
              <source media="(max-width: 640px)" srcSet="/patrimonio/hero-patrimonio-movil.webp" />
              <img src="/patrimonio/hero-patrimonio.webp" alt="Vista de patrimonio neto en Finpathia, con activos, deuda y composición del patrimonio" width="1480" height="582" style={{ width: "100%", height: "auto", borderRadius: 16, border: `1px solid ${T.border}` }} />
            </picture>
            <figcaption style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>Datos ilustrativos</figcaption>
          </figure>
        </section>

        <section style={{ ...wrap, padding: "40px 20px" }}>
          <h2 style={h2}>Activo por activo</h2>
          <p style={{ color: T.txt2, fontSize: 17, lineHeight: 1.5, maxWidth: 680, margin: "0 0 22px" }}>Ve cuánto vale cada activo, cuánto ha ganado y cuánta deuda tiene encima, todo en un vistazo.</p>
          <figure style={{ margin: 0 }}>
            <img src="/patrimonio/tabla-activos.webp" alt="Tabla de activos con columnas Valor, Ganancia y Deuda" width="1600" height="629" loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 16, border: `1px solid ${T.border}` }} />
            <figcaption style={{ fontSize: 12, color: T.txt3, marginTop: 8 }}>Datos ilustrativos</figcaption>
          </figure>
        </section>

        <section style={{ ...wrap, padding: "40px 20px" }}>
          <h2 style={h2}>Cómo funciona</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {PASOS.map((p, i) => (
              <li key={i} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ color: T.green, fontWeight: 800, fontSize: 22, marginBottom: 6 }}>{i + 1}</div>
                <div style={{ fontSize: 16, lineHeight: 1.45 }}>{p}</div>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ ...wrap, padding: "40px 20px" }}>
          <h2 style={h2}>Planes</h2>
          <p style={{ color: T.txt2, fontSize: 17, lineHeight: 1.55, maxWidth: 680, margin: 0 }}>{PLANES_TEXTO}</p>
        </section>

        <section style={{ ...wrap, padding: "40px 20px", maxWidth: 760 }}>
          <h2 style={h2}>Preguntas frecuentes</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 16 }}>{q}</summary>
              <p style={{ color: T.txt2, margin: "10px 0 0", lineHeight: 1.55 }}>{a}</p>
            </details>
          ))}
        </section>

        <section style={{ ...wrap, textAlign: "center", padding: "56px 20px 72px" }}>
          <p style={{ fontFamily: DISPLAY, fontSize: "clamp(20px,3.4vw,28px)", fontWeight: 700, maxWidth: 680, margin: "0 auto 24px", lineHeight: 1.35 }}>Transformamos la complejidad financiera en claridad para construir tranquilidad.</p>
          <button type="button" style={btn} onClick={() => cta("final")}>Ver mi patrimonio</button>
        </section>
      </main>

      <footer style={{ ...wrap, padding: "24px 20px 40px", fontSize: 13, color: T.txt3, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span>© Finpathia</span>
        <a href="/terminos" style={{ color: T.txt3 }}>Términos</a>
        <a href="/privacidad" style={{ color: T.txt3 }}>Privacidad</a>
      </footer>

      {consent === null && (
        <div role="dialog" aria-label="Cookies" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 50, background: "#1e1e24", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: T.txt2, flex: "1 1 280px" }}>Usamos cookies de medición y publicidad solo si las aceptas. Más en la <a href="/privacidad" style={{ color: T.green }}>Política de Privacidad</a>.</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => decidir("denied")} style={{ background: "transparent", color: T.txt2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Rechazar</button>
            <button type="button" onClick={() => decidir("granted")} style={{ background: T.green, color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>Aceptar</button>
          </span>
        </div>
      )}
    </div>
  );
}
