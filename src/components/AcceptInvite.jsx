import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════════════
// ACCEPT INVITE — Pantalla de aceptación de invitación del asesor
//
// Flujo:
// 1. Al cargar, extrae `token` de la URL y valida vía API
// 2. Si token inválido/expirado → muestra error
// 3. Si token válido → muestra "Te invitó [Asesor/Firma]"
// 4. Usuario crea cuenta o se loguea (si ya tiene cuenta)
// 5. Al autenticarse, llama API "accept" para vincular
// 6. Al completar → redirige a `/` (dashboard retail del cliente con plan Pro activo)
//
// Props:
//   token: string (del URL param :token)
//   onComplete(): callback cuando la aceptación termina (para que App.jsx recargue)
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  border: "rgba(255,255,255,0.06)", borderL: "rgba(255,255,255,0.1)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa", red: "#ef4444",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
  gradAdv: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)",
};

export default function AcceptInvite({ token, onComplete }) {
  const [stage, setStage] = useState("validating"); // validating | ready | signup | login | accepting | done | error
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [mode, setMode] = useState("signup"); // signup | login
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  // ─── Step 1: Validar el token al montar ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // PASO 1A: intentar como invitación de cuenta familiar (Fase 3)
        // La RPC validate_invitation_token devuelve null si no encuentra,
        // así caemos limpiamente al flujo legacy de advisor sin error.
        if (isSupabaseConfigured && supabase) {
          const { data: familyData, error: familyErr } = await supabase.rpc(
            "validate_invitation_token",
            { p_token: token }
          );
          if (cancelled) return;
          if (!familyErr && familyData) {
            setInvitation({ ...familyData, type: "family" });
            setForm((f) => ({ ...f, email: familyData.email_invited || "" }));
            setStage("ready");
            return;
          }
        }

        // PASO 1B: fallback a invitación de advisor (flujo legacy intacto)
        const r = await fetch("/.netlify/functions/advisor-accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate", token }),
        });
        const j = await r.json();
        if (cancelled) return;
        if (r.ok && j.valid) {
          setInvitation({ ...j, type: "advisor" });
          setForm((f) => ({ ...f, email: j.email_invited || "" }));
          setStage("ready");
        } else {
          setError(j.error || "Invitación inválida");
          setStage("error");
        }
      } catch (e) {
        if (cancelled) return;
        setError("No se pudo validar la invitación. Intenta más tarde.");
        setStage("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ─── Step 2: Signup o Login ───
  async function handleAuth(e) {
    if (e) e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Sistema no configurado");
      }
      let userId = null;
      if (mode === "signup") {
        if (!form.name.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
          throw new Error("Llena todos los campos (contraseña mínimo 6 caracteres)");
        }
        // Crear cuenta via Supabase Auth
        const { data, error: signErr } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: { data: { name: form.name.trim() } },
        });
        if (signErr) throw signErr;
        userId = data?.user?.id;
        if (!userId) throw new Error("No se pudo crear la cuenta");
      } else {
        // Login con cuenta existente
        if (!form.email.trim() || !form.password) {
          throw new Error("Email y contraseña son requeridos");
        }
        const { data, error: signErr } = await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (signErr) throw signErr;
        userId = data?.user?.id;
        if (!userId) throw new Error("Credenciales incorrectas");
      }

      // Step 3: Llamar API accept para vincular
      setStage("accepting");

      if (invitation?.type === "family") {
        // Flujo family (Fase 3): la RPC accept_invitation matchea email
        // del caller con el de la invitación, crea/reactiva membership
        // y marca consumed_at.
        const { error: acceptErr } = await supabase.rpc("accept_invitation", { p_token: token });
        if (acceptErr) throw new Error(acceptErr.message || "No se pudo aceptar la invitación");
      } else {
        // Flujo advisor (legacy): netlify function intacta
        const acceptRes = await fetch("/.netlify/functions/advisor-accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", token, client_id: userId }),
        });
        const acceptJson = await acceptRes.json();
        if (!acceptRes.ok) {
          throw new Error(acceptJson.error || "No se pudo aceptar la invitación");
        }
      }

      setStage("done");
      // Redirigir a la raíz después de 2.5s (App.jsx detectará la sesión y cargará dashboard)
      setTimeout(() => {
        window.history.replaceState({}, "", "/");
        if (onComplete) onComplete();
        else window.location.href = "/";
      }, 2500);
    } catch (err) {
      setError(err.message || "Error al procesar");
      setStage("ready");
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  const wrap = {
    background: T.bg,
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "'Inter', system-ui, sans-serif",
    color: T.txt,
  };

  const card = {
    background: T.bg2,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: 36,
    maxWidth: 460,
    width: "100%",
  };

  // ─── Loading ───
  if (stage === "validating") {
    return (
      <div style={wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 20 }}>FINPATHIA</div>
          <div style={{ fontSize: 14, color: T.txt2 }}>Validando invitación...</div>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (stage === "error") {
    return (
      <div style={wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>
        <div style={card}>
          <div style={{ fontSize: 28, fontWeight: 900, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 28, textAlign: "center" }}>FINPATHIA</div>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: `2px solid ${T.red}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>!</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 10 }}>Invitación no válida</h1>
          <p style={{ fontSize: 14, color: T.txt2, textAlign: "center", marginBottom: 24, lineHeight: 1.6 }}>{error}</p>
          <a href="/" style={{ display: "block", textAlign: "center", width: "100%", padding: "12px", borderRadius: 10, background: T.bg3, border: `1px solid ${T.border}`, color: T.txt, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
            Ir a Finpathia
          </a>
        </div>
      </div>
    );
  }

  // ─── Accepting ───
  if (stage === "accepting") {
    return (
      <div style={wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 20 }}>FINPATHIA</div>
          <div style={{ fontSize: 14, color: T.txt2 }}>Vinculando tu cuenta...</div>
        </div>
      </div>
    );
  }

  // ─── Done ───
  if (stage === "done") {
    const isFamily = invitation?.type === "family";
    return (
      <div style={wrap}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 28 }}>FINPATHIA</div>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>✓</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>¡Bienvenido!</h1>
          <p style={{ fontSize: 14, color: T.txt2, marginBottom: 20, lineHeight: 1.6 }}>
            {isFamily ? (
              <>
                Ya tenés acceso a <strong style={{ color: T.txt }}>{invitation?.account_name}</strong>
                {invitation?.role === "reader" ? " como solo lectura" : " como administrador"}.
                Redirigiendo...
              </>
            ) : (
              <>
                Tu cuenta está vinculada con <strong style={{ color: T.txt }}>{invitation?.advisor_firm}</strong>. Tienes acceso Pro completo. Redirigiendo...
              </>
            )}
          </p>
          <div style={{ fontSize: 13, color: T.txt3 }}>Cargando tu dashboard...</div>
        </div>
      </div>
    );
  }

  // ─── Ready (signup/login form) ───
  return (
    <div style={wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}input:focus{outline:none;border-color:#3b82f6 !important}`}</style>
      <div style={card}>
        <div style={{ fontSize: 28, fontWeight: 900, background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 24, textAlign: "center" }}>FINPATHIA</div>

        {/* Invitation banner */}
        {invitation?.type === "family" ? (
          <div style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(167,139,250,0.08))", border: `1px solid rgba(34,197,94,0.25)`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: T.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Invitación familiar</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4 }}>
              {invitation?.invited_by_name || "Te invitaron"} te invitó a {invitation?.account_name || "su cuenta"}
            </div>
            <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
              Vas a tener acceso como <strong style={{ color: T.txt }}>{invitation?.role === "admin" ? "administrador" : "solo lectura"}</strong>
              {invitation?.role === "admin"
                ? " — podés ver y editar toda la información financiera."
                : " — podés ver toda la información financiera, pero no editarla."}
            </div>
          </div>
        ) : (
          <div style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(167,139,250,0.08))", border: `1px solid rgba(59,130,246,0.25)`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: T.blue, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Invitación de tu asesor</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4 }}>
              {invitation?.advisor_firm || "Tu asesor"}
            </div>
            <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
              Te invitó a gestionar tu patrimonio con acceso <strong style={{ color: T.txt }}>Pro completo</strong> — cortesía de tu asesor.
            </div>
          </div>
        )}

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.02em" }}>
          {mode === "signup" ? "Crea tu cuenta" : "Inicia sesión"}
        </h1>
        <p style={{ fontSize: 13, color: T.txt3, marginBottom: 20 }}>
          {mode === "signup" ? "Solo toma 30 segundos" : "Si ya tenías cuenta en Finpathia"}
        </p>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div>
              <label style={{ fontSize: 11, color: T.txt3, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre completo</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="María Pérez"
                style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", color: T.txt, fontSize: 14 }}
                required
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: T.txt3, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="tu@email.com"
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", color: T.txt, fontSize: 14 }}
              required
            />
            {invitation?.email_invited && form.email.trim().toLowerCase() !== invitation.email_invited.toLowerCase() && (
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>
                💡 La invitación se envió a <strong>{invitation.email_invited}</strong>
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: T.txt3, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={mode === "signup" ? "Mínimo 6 caracteres" : ""}
              style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", color: T.txt, fontSize: 14 }}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? T.bg3 : T.gradAdv,
              color: "#fff",
              border: "none",
              padding: "14px",
              borderRadius: 10,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            {submitting ? "Procesando..." : mode === "signup" ? "Crear cuenta y vincular →" : "Iniciar sesión y vincular →"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: T.txt3 }}>
          {mode === "signup" ? (
            <>
              ¿Ya tienes cuenta?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿Eres nuevo?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontWeight: 600, fontSize: 13, padding: 0 }}>
                Crea tu cuenta
              </button>
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 24, paddingTop: 16, fontSize: 11, color: T.txt3, lineHeight: 1.6, textAlign: "center" }}>
          🔒 Tus datos se encriptan end-to-end. Ni tu asesor ni Finpathia pueden leerlos sin tu contraseña.
        </div>
      </div>
    </div>
  );
}
