import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// ADVISOR WORKSPACE
//
// Pantalla principal que ve un asesor al hacer login. Lista sus
// clientes, permite invitar nuevos, y da acceso al dashboard de
// cada cliente. Sprint 2A (invitaciones reales vendrán en Sprint 2B).
//
// Props:
//   advisorProfile: { firm_name, email, advisor_plan, max_clients, ... }
//   clients: [{ id, email, data, plan, jurisdiction, updated_at, ... }]
//   onOpenClient(clientId): callback cuando el asesor selecciona un cliente
//   onViewPersonal(): callback para ver el dashboard personal del asesor
//   onLogout(): callback de logout
//   onRefreshClients(): recargar la lista de clientes
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#09090b", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)", borderL: "rgba(255,255,255,0.1)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", blue: "#3b82f6", purple: "#a78bfa",
  orange: "#f97316", gold: "#eab308", red: "#ef4444",
  grad: "linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)",
  gradAdv: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)",
};

const fmt = (n) => n == null ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const planLabel = {
  starter: "Starter",
  professional: "Professional",
  boutique: "Boutique",
};

function computeClientSummary(clientData) {
  // Calcula patrimonio neto y ratios básicos a partir del jsonb `data` del cliente
  if (!clientData || typeof clientData !== "object") return { nw: 0, hasData: false };
  const inv = Array.isArray(clientData.inv) ? clientData.inv : [];
  const deu = Array.isArray(clientData.deu) ? clientData.deu : [];
  const totalAssets = inv.reduce((s, i) => s + (Number(i.va) || 0), 0);
  const totalDebt = deu.reduce((s, d) => s + (Number(d.mt) || 0), 0);
  const nw = totalAssets - totalDebt;
  return { nw, totalAssets, totalDebt, hasData: inv.length > 0 || deu.length > 0, invCount: inv.length };
}

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "Hace segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months}m`;
}

export default function AdvisorWorkspace({ advisorProfile, clients, onOpenClient, onViewPersonal, onLogout, onRefreshClients }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const profile = advisorProfile || {};
  const maxClients = profile.max_clients || 5;
  const activeClients = (clients || []).length;
  const atCapacity = activeClients >= maxClients;
  const capacityPct = Math.min(100, (activeClients / maxClients) * 100);

  async function handleInvite() {
    if (!inviteEmail || sending) return;
    setSending(true);
    try {
      const r = await fetch("/.netlify/functions/advisor-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisor_id: profile.id,
          email: inviteEmail,
          message: inviteMessage,
        }),
      });
      const j = await r.json();
      if (j.invitation_url) {
        setGeneratedLink(j.invitation_url);
      } else {
        alert(j.error || "No se pudo generar la invitación. Intenta de nuevo.");
      }
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteMessage("");
    setGeneratedLink("");
    setCopied(false);
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.txt, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box;margin:0}body{margin:0;background:#09090b}`}</style>

      {/* ─── NAV ─── */}
      <nav style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", background: "rgba(9,9,11,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em" }}>
              <span style={{ background: T.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FINPATHIA</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, padding: "3px 8px", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 6, letterSpacing: "0.08em", background: "rgba(59,130,246,0.08)" }}>
              ASESOR
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onViewPersonal} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              Mi dashboard personal →
            </button>
            <button onClick={onLogout} style={{ background: "transparent", border: "none", color: T.txt3, cursor: "pointer", fontSize: 13, padding: "8px 12px" }}>
              Salir
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ─── HEADER ─── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: T.txt3, marginBottom: 4 }}>
            {profile.firm_name || profile.email || "Workspace de Asesor"}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
            Mis Clientes
          </h1>

          {/* Capacity bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: T.txt3 }}>Plan:</span>
              <span style={{ color: T.txt, fontWeight: 700 }}>{planLabel[profile.advisor_plan] || profile.advisor_plan}</span>
            </div>
            <div style={{ flex: "1 1 240px", minWidth: 240 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.txt3, marginBottom: 6 }}>
                <span>{activeClients} de {maxClients} clientes activos</span>
                <span>{Math.round(capacityPct)}%</span>
              </div>
              <div style={{ height: 6, background: T.bg2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${capacityPct}%`, background: capacityPct >= 90 ? T.orange : T.gradAdv, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── TOOLBAR ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 14, color: T.txt2 }}>
            {activeClients === 0 ? "Invita a tu primer cliente para comenzar" : `${activeClients} ${activeClients === 1 ? "cliente" : "clientes"}`}
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            disabled={atCapacity}
            style={{
              background: atCapacity ? T.bg3 : T.gradAdv,
              color: atCapacity ? T.txt3 : "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: 10,
              cursor: atCapacity ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 700,
              opacity: atCapacity ? 0.6 : 1,
            }}
          >
            {atCapacity ? "Límite alcanzado" : "+ Invitar cliente"}
          </button>
        </div>

        {/* ─── CLIENT LIST ─── */}
        {activeClients === 0 ? (
          <div style={{ background: T.bg2, border: `1px dashed ${T.borderL}`, borderRadius: 16, padding: "64px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Aún no tienes clientes</h3>
            <p style={{ fontSize: 14, color: T.txt2, maxWidth: 400, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Invita a tu primer cliente para empezar a gestionar su patrimonio desde este panel. Cada cliente tendrá su propio dashboard completo con Pro activado.
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              style={{ background: T.gradAdv, color: "#fff", border: "none", padding: "12px 28px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700 }}
            >
              + Invitar mi primer cliente
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {clients.map((c) => {
              const summary = computeClientSummary(c.data);
              const name = c.data?.p?.name || c.email?.split("@")[0] || "Cliente";
              return (
                <div
                  key={c.id}
                  style={{
                    background: T.bg2,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onClick={() => onOpenClient(c.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.gradAdv, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {name[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <div style={{ fontSize: 12, color: T.txt3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email}</div>
                    </div>
                  </div>
                  {summary.hasData ? (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Patrimonio neto</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: T.txt, letterSpacing: "-0.02em" }}>{fmt(summary.nw)}</div>
                      <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>
                        {summary.invCount} {summary.invCount === 1 ? "inversión" : "inversiones"} · {c.jurisdiction || "CO"}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "12px 14px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>⚠ Sin datos cargados todavía</div>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.txt3 }}>
                    <span>Última actividad: {timeAgo(c.updated_at)}</span>
                    <span style={{ color: T.blue, fontWeight: 600 }}>Abrir dashboard →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FOOTER NOTE ─── */}
        <div style={{ marginTop: 48, padding: 20, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 12, color: T.txt3, lineHeight: 1.7 }}>
          <strong style={{ color: T.txt2 }}>💡 Cómo funciona:</strong> Invita a tus clientes por email. Reciben un link único para crear su cuenta en Finpathia. Una vez dentro, puedes acceder a su dashboard completo con plan Pro activado (dashboard patrimonial, plan tributario Colombia, simuladores, proyecciones, Asesor IA). Los datos de tus clientes están protegidos — sólo tú como asesor asignado los puedes ver.
        </div>
      </div>

      {/* ─── INVITE MODAL ─── */}
      {showInviteModal && (
        <div onClick={closeInviteModal} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.borderL}`, borderRadius: 20, padding: 32, maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            {!generatedLink ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>Invitar cliente</h3>
                    <p style={{ fontSize: 13, color: T.txt3 }}>Genera un link para que tu cliente cree su cuenta.</p>
                  </div>
                  <button onClick={closeInviteModal} style={{ background: "transparent", border: "none", color: T.txt3, fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Email del cliente *</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="cliente@email.com"
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: T.txt3, marginBottom: 6, display: "block" }}>Mensaje personal (opcional)</label>
                    <textarea
                      rows={3}
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                      placeholder="Hola María, te invito a Finpathia donde gestionaremos tu patrimonio..."
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>

                  <button
                    onClick={handleInvite}
                    disabled={sending || !inviteEmail}
                    style={{
                      background: sending || !inviteEmail ? T.bg3 : T.gradAdv,
                      color: "#fff",
                      border: "none",
                      padding: "14px",
                      borderRadius: 10,
                      cursor: sending || !inviteEmail ? "not-allowed" : "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      opacity: !inviteEmail ? 0.5 : 1,
                    }}
                  >
                    {sending ? "Generando..." : "Generar link de invitación →"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: `2px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Invitación creada</h3>
                  <p style={{ fontSize: 14, color: T.txt2, marginBottom: 20 }}>Comparte este link con {inviteEmail}. Expira en 7 días.</p>
                </div>
                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: T.txt2, wordBreak: "break-all", fontFamily: "monospace" }}>
                  {generatedLink}
                </div>
                <button
                  onClick={copyLink}
                  style={{ width: "100%", background: copied ? T.green : T.bg3, color: copied ? "#000" : T.txt, border: `1px solid ${T.border}`, padding: "12px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, marginBottom: 8 }}
                >
                  {copied ? "✓ Copiado" : "📋 Copiar link"}
                </button>
                <button
                  onClick={closeInviteModal}
                  style={{ width: "100%", background: "transparent", color: T.txt2, border: `1px solid ${T.border}`, padding: "10px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
