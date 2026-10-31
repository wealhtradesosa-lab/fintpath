// LandingLibertad.jsx · 20-oct-2026
// Landing de anuncios: finpathia.com/libertad.
//
// Definición del producto (claude/definicion-producto.md): FINPATHIA es el
// sistema que te ayuda a alcanzar tu libertad financiera. La puerta entrega el
// norte en un minuto, SIN cuenta: tres cifras → nivel, meses cubiertos, lo
// que falta para subir. La cuenta se crea para guardar el norte y empezar a
// moverlo. Frase de Santiago (20-oct-2026): "La libertad financiera no es
// tener más. Es saber exactamente cuánto te falta — y qué mover hoy."
//
// Antes /libertad caía en la home genérica ("family office con IA"): el
// anuncio prometía libertad y la página entregaba otra cosa; el bloque de
// niveles estaba a cinco pantallas de scroll. Día 1 de campaña: ~100 visitas
// → 2 registros → 0 cargaron datos.
import { useEffect, useMemo, useState } from "react";
import { getConsent, setConsent, loadTrackers, initConsent } from "../lib/consent";
import { track } from "../lib/analytics";
import { calcularNorte, guardarNorte, RETORNO_SUPUESTO } from "../lib/norteUnMinuto.js";
import { NIVELES } from "../lib/metrics.js";
import { fmtPlataCortaEs } from "../lib/formato.js";

const T = {
  bg: "var(--fp-bg)", bg2: "var(--fp-card)", bg3: "var(--fp-raised)", border: "rgba(var(--fp-ink),0.08)",
  txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)", green: "#22c55e", blue: "#3b82f6", red: "#ef4444",
};
const DISPLAY = "'Plus Jakarta Sans','Inter',system-ui,sans-serif";
const BODY = "'Inter',system-ui,sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,monospace";

const fm = (n) => "$" + Math.round(Math.abs(n || 0)).toLocaleString("es-CO");
const fmC = fmtPlataCortaEs;
const años = (y) => y == null ? "más de 60 años" : y < 1 / 12 ? "ya" : y < 1 ? `${Math.max(1, Math.round(y * 12))} meses` : y < 1.5 ? "1 año" : `${Math.round(y)} años`;

// Campo de pesos: solo dígitos, con separador de miles al escribir.
function Pesos({ label, hint, value, onChange, placeholder, id }) {
  const show = value ? Number(value).toLocaleString("es-CO") : "";
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 4 }}>{label}</div>
      {hint && <div style={{ fontSize: 12, color: T.txt3, marginBottom: 8, lineHeight: 1.4 }}>{hint}</div>}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.txt3, fontFamily: MONO, fontSize: 16 }}>$</span>
        <input id={id} inputMode="numeric" autoComplete="off" placeholder={placeholder} value={show}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 13))}
          style={{ width: "100%", boxSizing: "border-box", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 12, color: T.txt, padding: "14px 14px 14px 30px", fontSize: 16, fontFamily: MONO, outline: "none" }} />
      </div>
    </label>
  );
}

export default function LandingLibertad({ onGetStarted = () => {}, onLogin = () => {} }) {
  const [consent, setC] = useState(null);
  useEffect(() => { setC(initConsent()); }, []);
  const decidir = (v) => { setConsent(v); setC(v); if (v === "granted") loadTrackers(); };

  const [f, setF] = useState({ ingresoTrabajo: "", gastos: "", ahorrado: "", ingresoPasivo: "", deudas: "", gastosEsenciales: "" });
  const [mas, setMas] = useState(false);
  const [visto, setVisto] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const listo = Number(f.ingresoTrabajo) > 0 && Number(f.gastos) > 0;
  const r = useMemo(() => (listo ? calcularNorte(f) : null), [f, listo]);

  useEffect(() => {
    if (r && !visto) { setVisto(true); track("norte_calculado", { nivel: r.nivel }); }
  }, [r, visto]);

  // Abrir el desplegable no basta: el campo queda fuera de pantalla desde la
  // escalera, y un botón que no se ve hacer nada es peor que no tenerlo.
  const abrirEsencial = () => {
    setMas(true);
    setTimeout(() => {
      const el = document.getElementById("campo-esencial");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }, 60);
  };

  const guardar = (ctaId) => {
    if (r) guardarNorte(f);
    onGetStarted(ctaId);
  };

  const wrap = { maxWidth: 1040, margin: "0 auto", padding: "0 20px" };
  const btn = { background: T.green, color: "#000", border: "none", borderRadius: 12, padding: "16px 28px", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: BODY };
  const h2 = { fontFamily: DISPLAY, fontSize: "clamp(24px,4vw,34px)", fontWeight: 800, margin: "0 0 14px", lineHeight: 1.2 };
  const card = { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 };

  return (
    <div style={{ background: T.bg, color: T.txt, minHeight: "100vh", fontFamily: BODY }}>
      <header style={{ ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 900, background: "linear-gradient(135deg,#22c55e,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</div>
        <button type="button" onClick={onLogin} style={{ background: "transparent", color: T.txt2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontFamily: BODY }}>Iniciar sesión</button>
      </header>

      <main>
        {/* ── La promesa ── */}
        <section style={{ ...wrap, textAlign: "center", padding: "36px 20px 24px" }}>
          <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(30px,5.6vw,52px)", fontWeight: 900, lineHeight: 1.12, margin: "0 auto 16px", maxWidth: 820 }}>
            La libertad financiera no es tener más.<br />
            <span style={{ background: "linear-gradient(135deg,#22c55e,#3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Es saber exactamente cuánto te falta</span> — y qué mover hoy.
          </h1>
          <p style={{ fontSize: 18, color: T.txt2, maxWidth: 600, margin: "0 auto", lineHeight: 1.5 }}>
            Tres cifras y te decimos en qué nivel estás, cuántos meses de vida tienes cubiertos y cuánto falta para subir. Sin cuenta, sin tarjeta.
          </p>
        </section>

        {/* ── El número: calculadora + resultado ── */}
        <section style={{ ...wrap, padding: "8px 20px 40px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14 }}>Tu situación hoy · al mes</div>
              <div style={{ display: "grid", gap: 14 }}>
                <Pesos label="¿Cuánto ganas?" hint="Lo que te queda en la cuenta cada mes por tu trabajo o negocio." value={f.ingresoTrabajo} onChange={set("ingresoTrabajo")} placeholder="6.000.000" />
                <Pesos label="¿Cuánto gastas?" hint="Gastos de vida más cuotas de créditos, todo junto." value={f.gastos} onChange={set("gastos")} placeholder="4.500.000" />
                <Pesos label="¿Cuánto tienes ahorrado o invertido?" hint="Cuentas, CDT, fondos, acciones, cripto. Sin contar la casa donde vives." value={f.ahorrado} onChange={set("ahorrado")} placeholder="20.000.000" />
                {!mas ? (
                  <button type="button" onClick={() => setMas(true)} style={{ background: "transparent", border: "none", color: T.blue, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, fontFamily: BODY }}>
                    + Tengo arriendos, intereses o dividendos, deudas, o quiero separar lo esencial
                  </button>
                ) : (
                  <>
                    <Pesos label="¿Cuánto te pagan tus activos al mes?" hint="Arriendos netos, intereses, dividendos. Lo que entra sin trabajar." value={f.ingresoPasivo} onChange={set("ingresoPasivo")} placeholder="0" />
                    <Pesos label="¿Cuánto debes en total?" hint="Saldo de créditos, hipoteca, tarjetas." value={f.deudas} onChange={set("deudas")} placeholder="0" />
                    {/* 21-oct-2026 — Sin este dato el escalón 3 (Seguridad) no se
                        puede medir y la escalera salta de 2 a 4. No se estima
                        con una fracción del gasto: eso es lo que se eliminó hoy
                        del motor. Se pregunta, y si no lo dan se dice. */}
                    <Pesos label="¿Cuánto de esos gastos no puedes apagar?" hint="Techo, comida, servicios, salud, transporte, educación, seguros y las cuotas de tus créditos. Lo que seguirías pagando si dejaras de trabajar." value={f.gastosEsenciales} onChange={set("gastosEsenciales")} placeholder="0" id="campo-esencial" />
                  </>
                )}
              </div>
            </div>

            <div style={{ ...card, minHeight: 300, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {!r ? (
                <div style={{ textAlign: "center", color: T.txt3 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🧭</div>
                  <div style={{ fontSize: 15, lineHeight: 1.5 }}>Escribe cuánto ganas y cuánto gastas.<br />Tu norte aparece aquí al instante.</div>
                </div>
              ) : (
                <Resultado r={r} onGuardar={() => guardar("resultado")} btn={btn} onAfinar={abrirEsencial} />
              )}
            </div>
          </div>
        </section>

        {/* ── Los 5 niveles ── */}
        <section style={{ ...wrap, padding: "24px 20px 40px" }}>
          <h2 style={h2}>Los 5 niveles de libertad financiera</h2>
          <p style={{ color: T.txt2, fontSize: 16, lineHeight: 1.5, maxWidth: 680, margin: "0 0 18px" }}>
            Tu nivel no lo define cuánto ganas: lo define qué parte de tus gastos pagan tus activos sin que trabajes. Subir de nivel es mover plata de donde no rinde a donde sí.
          </p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            {NIVELES.map((n) => (
              <li key={n.id} style={{ ...card, padding: 16, borderTop: `3px solid ${n.color}`, opacity: r && r.nivel === n.id ? 1 : 0.85, outline: r && r.nivel === n.id ? `2px solid ${n.color}` : "none" }}>
                <div style={{ fontSize: 22 }}>{n.icon}</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{n.id}. {n.nombre}</div>
                <div style={{ fontSize: 12, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{n.desc}</div>
                {r && r.nivel === n.id && <div style={{ fontSize: 11, fontWeight: 700, color: n.color, marginTop: 8 }}>AQUÍ ESTÁS</div>}
                {/* Sin el dato de lo esencial este escalón no se puede medir y
                    la escalera salta de 2 a 4. Se dice, no se disimula. */}
                {r && n.clave === "seguridad" && !r.esencialDeclarado && (
                  <button type="button" onClick={abrirEsencial} style={{ background: "transparent", border: "none", padding: 0, marginTop: 8, textAlign: "left", cursor: "pointer", fontFamily: BODY, color: n.color, fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>
                    Para medir este escalón falta un dato: cuánto de tus gastos no puedes apagar. →
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Qué mover ── */}
        <section style={{ ...wrap, padding: "24px 20px 40px" }}>
          <h2 style={h2}>Qué mueve la aguja</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {[
              ["🧾", "Pagar lo justo de impuestos", "El motor tributario de FINPATHIA revisa tu renta con base legal y te muestra qué deducciones no estás usando. Cada peso que no pagas de más es un peso que trabaja para ti."],
              ["📉", "Quitarte la deuda cara", "Ver cuánto de tu mes se va en cuotas y cuál crédito conviene matar primero."],
              ["📈", "Poner el sobrante a rendir", "Simular qué pasa con tu nivel si rediriges lo que te queda cada mes, y en cuántos años subes."],
              ["🔮", "Ver tu año que viene", "Probar un cambio de trabajo, una inversión nueva o un gasto que termina, y ver el efecto antes de decidir."],
            ].map(([i, t, d]) => (
              <div key={t} style={card}>
                <div style={{ fontSize: 24 }}>{i}</div>
                <div style={{ fontWeight: 800, marginTop: 8, fontSize: 16 }}>{t}</div>
                <div style={{ fontSize: 14, color: T.txt2, marginTop: 6, lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Cómo funciona ── */}
        <section style={{ ...wrap, padding: "24px 20px 40px" }}>
          <h2 style={h2}>Cómo funciona</h2>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {["Escribe tres cifras y ves tu nivel. Sin cuenta.", "Guarda tu norte: creas tu cuenta gratis y tu nivel queda registrado.", "Cada semana ves qué moviste y cuánto te acercaste."].map((p, i) => (
              <li key={i} style={card}>
                <div style={{ color: T.green, fontWeight: 800, fontSize: 22, marginBottom: 6 }}>{i + 1}</div>
                <div style={{ fontSize: 15, lineHeight: 1.5 }}>{p}</div>
              </li>
            ))}
          </ol>
          <p style={{ fontSize: 13, color: T.txt3, margin: "14px 0 0" }}>14 días Pro sin tarjeta. Después sigues gratis o eliges un plan. Hay plan gratis. Pro cuesta 16 USD al mes, o 12 USD al mes en plan anual.</p>
        </section>

        {/* ── Cierre ── */}
        <section style={{ ...wrap, textAlign: "center", padding: "40px 20px 72px" }}>
          <p style={{ fontFamily: DISPLAY, fontSize: "clamp(20px,3.4vw,28px)", fontWeight: 700, maxWidth: 680, margin: "0 auto 10px", lineHeight: 1.35 }}>El bienestar financiero es un derecho, no un privilegio.</p>
          <p style={{ color: T.txt2, fontSize: 15, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.5 }}>Claridad, conocimiento y la mejor tecnología al servicio de mejores decisiones sobre tu patrimonio.</p>
          <button type="button" style={btn} onClick={() => (r ? guardar("final") : window.scrollTo({ top: 0, behavior: "smooth" }))}>{r ? "Guardar mi norte" : "Descubrir mi nivel"}</button>
        </section>
      </main>

      <footer style={{ ...wrap, padding: "24px 20px 40px", fontSize: 13, color: T.txt3, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span>© Finpathia</span>
        <a href="/terminos" style={{ color: T.txt3 }}>Términos</a>
        <a href="/privacidad" style={{ color: T.txt3 }}>Privacidad</a>
        <span>Finpathia te da claridad; las decisiones son tuyas. No es asesoría de inversión.</span>
      </footer>

      {consent === null && (
        <div role="dialog" aria-label="Cookies" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 50, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 18px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
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

function Resultado({ r, onGuardar, btn, onAfinar = () => {} }) {
  const n = r.data;
  const sig = r.siguiente;
  const deficit = r.fl < 0;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.6 }}>Tu norte, hoy</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
        <div style={{ fontSize: 40 }}>{n.icon}</div>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 900, color: n.color, lineHeight: 1.1 }}>Nivel {r.nivel} de 5 · {r.nombre}</div>
          <div style={{ fontSize: 13, color: T.txt2, marginTop: 4 }}>{n.desc}</div>
        </div>
      </div>

      {/* Barra de los 5 niveles */}
      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {NIVELES.map((x) => <div key={x.id} style={{ flex: 1, height: 8, borderRadius: 3, background: x.id <= r.nivel ? n.color : T.bg3 }} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <div style={{ background: T.bg3, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.txt3 }}>Meses de vida cubiertos</div>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{r.mesesCubiertos == null ? "—" : r.mesesCubiertos >= 120 ? "+10 años" : r.mesesCubiertos.toFixed(1).replace(".", ",")}</div>
          <div style={{ fontSize: 11, color: T.txt3 }}>si hoy dejaras de ganar</div>
        </div>
        <div style={{ background: T.bg3, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.txt3 }}>Tus activos pagan</div>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700 }}>{Math.min(999, Math.round(r.cobertura))}%</div>
          <div style={{ fontSize: 11, color: T.txt3 }}>de tus gastos{r.ipFuente === "estimado" ? ` (estimado al ${Math.round(r.retorno * 100)}%)` : ""}</div>
        </div>
      </div>

      {/* 21-oct-2026 — Estabilidad es el ÚNICO escalón desde donde el dato que
          falta puede estar escondiendo uno mejor: si sus activos ya pagan lo
          esencial, está en Seguridad y no lo sabe. Se ofrece justo acá, que es
          donde importa, en vez de cargar el formulario de entrada. */}
      {r.nivel === 2 && !r.esencialDeclarado && (
        <button type="button" onClick={onAfinar} style={{ width: "100%", textAlign: "left", marginTop: 14, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.28)", borderRadius: 12, padding: "11px 13px", cursor: "pointer", fontFamily: BODY, color: T.txt2, fontSize: 12.5, lineHeight: 1.5 }}>
          ⚡ <b style={{ color: "#22d3ee" }}>¿Ya estás en Seguridad y no lo sabes?</b> Ese nivel se gana cuando tus activos pagan lo que no puedes apagar. Dinos cuánto de tus gastos es eso y lo medimos. →
        </button>
      )}

      <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.55, color: T.txt }}>
        {deficit ? (
          <>Cada mes se te van <b style={{ color: T.red }}>{fm(-r.fl)}</b> más de lo que entra. Antes de cualquier inversión, el primer paso es cerrar ese hueco: ahí es donde FINPATHIA empieza contigo.</>
        ) : sig ? (
          <>
            Te quedan <b style={{ color: T.green }}>{fm(r.sobrante)}</b> al mes. Para llegar a <b>{sig.nombre}</b> tus activos tienen que pagarte <b>{fmC(r.rentaFalta)}</b> más cada mes.
            {" "}Invirtiendo lo que te queda: <b>{años(r.añosConSobrante)}</b>.
            {r.añosConExtra != null && r.añosConSobrante != null && r.añosConExtra < r.añosConSobrante - 0.4 && <> Con <b>{fmC(r.extra)}</b> más al mes: <b>{años(r.añosConExtra)}</b>.</>}
            {r.añosConSobrante == null && r.sobrante <= 0 && <> Hoy no queda nada para invertir: lo primero es liberar sobrante.</>}
          </>
        ) : (
          <>Tus activos ya pagan tu vida. Lo que sigue es cuidarlo: diversificar, pagar lo justo de impuestos y proteger a tu familia.</>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.txt3, marginTop: 8, lineHeight: 1.4 }}>
        Supuesto: lo que inviertes rinde {Math.round(RETORNO_SUPUESTO * 100)}% anual. Es una estimación para orientarte, no una promesa.
      </div>

      <button type="button" style={{ ...btn, width: "100%", marginTop: 16 }} onClick={onGuardar}>Guardar mi norte y ver qué mover</button>
      <div style={{ fontSize: 12, color: T.txt3, textAlign: "center", marginTop: 8 }}>Cuenta gratis. Tus tres cifras quedan cargadas; nada que repetir.</div>
    </div>
  );
}
