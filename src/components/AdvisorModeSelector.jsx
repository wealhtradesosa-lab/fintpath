// ═══════════════════════════════════════════════════════════════════
// ADVISOR MODE SELECTOR
//
// Pantalla que se muestra al advisor inmediatamente después de login.
// Le pregunta si quiere entrar como asesor (workspace) o como cliente
// retail (dashboard personal).
//
// Props:
//   advisorProfile: { firm_name, advisor_plan, max_clients, ... }
//   clientCount: número actual de clientes del advisor (para mostrar X/Y)
//   userName: nombre del usuario (de u.p.name o session.user.email)
//   onSelectWorkspace(): callback al elegir modo asesor
//   onSelectPersonal(): callback al elegir modo retail
//   onLogout(): callback de logout
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  border: "rgba(255,255,255,0.06)", borderL: "rgba(255,255,255,0.1)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
  gradAdv: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)",
};

const planLabel = {
  starter: "Starter",
  professional: "Professional",
  boutique: "Boutique",
};

export default function AdvisorModeSelector({ advisorProfile, clientCount, userName, onSelectWorkspace, onSelectPersonal, onLogout }) {
  const profile = advisorProfile || {};
  const maxClients = profile.max_clients || 0;
  const activeClients = clientCount || 0;
  const displayName = userName || profile.firm_name || profile.email || "Asesor";

  return (
    <div style={{
      background: T.bg,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Inter', system-ui, sans-serif",
      color: T.txt,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>

      {/* Logo */}
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 48 }}>
        <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</span>
      </div>

      {/* Título */}
      <div style={{ textAlign: "center", marginBottom: 40, maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Hola {displayName.split(" ")[0] || displayName}
        </h1>
        <p style={{ fontSize: 15, color: T.txt2 }}>
          ¿Cómo quieres entrar hoy?
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, width: "100%", maxWidth: 680, marginBottom: 24 }}>

        {/* Card Advisor Workspace */}
        <button
          onClick={onSelectWorkspace}
          style={{
            background: T.bg2,
            border: `1px solid rgba(59,130,246,0.25)`,
            borderRadius: 16,
            padding: "32px 28px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s ease",
            color: T.txt,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(59,130,246,0.55)";
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(59,130,246,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(59,130,246,0.25)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: T.gradAdv, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>
            👥
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#93c5fd", marginBottom: 6, textTransform: "uppercase" }}>
            Modo Asesor
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
            Workspace de Asesor
          </h3>
          <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6, marginBottom: 20 }}>
            Gestiona el patrimonio de tus clientes. Invita nuevos, accede a sus dashboards.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontSize: 11, color: T.txt3 }}>Plan</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{planLabel[profile.advisor_plan] || profile.advisor_plan || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T.txt3 }}>Clientes</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{activeClients} de {maxClients}</div>
            </div>
          </div>
        </button>

        {/* Card Personal Dashboard */}
        <button
          onClick={onSelectPersonal}
          style={{
            background: T.bg2,
            border: `1px solid rgba(34,197,94,0.25)`,
            borderRadius: 16,
            padding: "32px 28px",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.2s ease",
            color: T.txt,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(34,197,94,0.55)";
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(34,197,94,0.18)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(34,197,94,0.25)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: T.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>
            📊
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#86efac", marginBottom: 6, textTransform: "uppercase" }}>
            Modo Personal
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>
            Mi Dashboard Personal
          </h3>
          <p style={{ fontSize: 13, color: T.txt2, lineHeight: 1.6, marginBottom: 20 }}>
            Gestiona tu propio patrimonio. Inversiones, gastos, metas, Asesor IA, todo.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.txt3 }}>
              Tu Finpathia personal
            </div>
            <div style={{ fontSize: 16, color: T.green }}>→</div>
          </div>
        </button>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 12, color: T.txt3, marginBottom: 24, textAlign: "center" }}>
        Puedes cambiar entre modos en cualquier momento ↻
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        style={{
          background: "transparent",
          border: `1px solid ${T.border}`,
          color: T.txt3,
          padding: "8px 18px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "inherit",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
