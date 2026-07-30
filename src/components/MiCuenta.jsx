// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · MiCuenta — perfil, configuración y miembros (Fase 3)
//
// Página unificada que reemplaza la antigua "Configuración" + "Mi cuenta".
// Tiene tabs:
//   - Miembros y permisos: gestión de invitaciones (Pro Familiar)
//   - Configuración: perfil, preferencias, datos, plan
//
// La tab "Configuración" recibe su contenido como prop `configContent`
// (JSX rendereado por App.jsx), porque ese contenido tiene muchas
// dependencias internas (componentes Cd/Bt/In/T, callbacks setU, demo,
// showToast, etc.) que viven en el closure de App.jsx. Mover todo eso
// a este componente requeriría un refactor enorme; render-prop es la
// manera más limpia de mantener la separación de responsabilidades.
//
// Para readers: la tab "Miembros" muestra el listado read-only.
// Para isLegacy (mono-cuenta sin multi-usuario): la tab "Miembros"
// se oculta y la tab activa es "Configuración" por default.
//
// Llama a las RPCs del Fase 3 commit 1 para gestión de miembros:
//   list_account_members, list_pending_invitations,
//   create_invitation, revoke_invitation, remove_member, update_member_role
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from "react";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418",
  border: "rgba(255,255,255,0.06)", borderL: "rgba(255,255,255,0.1)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenB: "rgba(34,197,94,0.1)",
  blue: "#3b82f6", blueB: "rgba(59,130,246,0.1)",
  red: "#ef4444", redB: "rgba(239,68,68,0.1)",
  amber: "#f59e0b", amberB: "rgba(245,158,11,0.1)",
  purple: "#a78bfa",
};

const PLAN_LABELS = {
  basic: "Básico",
  pro: "Pro",
  pro_familiar: "Pro Familiar",
  managed: "Gestionado por asesor",
};

const ROLE_LABELS = {
  admin: "Administrador",
  reader: "Solo lectura",
};

// ── Utilidades ─────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
};

const daysUntil = (d) => {
  if (!d) return 0;
  const dt = typeof d === "string" ? new Date(d) : d;
  return Math.max(0, Math.ceil((dt - new Date()) / 86400000));
};

// ── Componente principal ───────────────────────────────────────────────────
export default function MiCuenta({
  supabase, accountId, role, displayName, plan, maxMembers,
  currentUserId, currentUserName, onChange, isLegacy, configContent, defaultTab,
  subscriptionStatus, graceUntil, onUpgrade,
}) {
  // Tabs disponibles según contexto
  const showMembersTab = !isLegacy && accountId;
  const tabs = [
    showMembersTab && { id: "miembros", label: "👨‍👩‍👧 Miembros y permisos" },
    configContent && { id: "config", label: "⚙️ Configuración" },
  ].filter(Boolean);

  // Tab activa: si vienen explícitamente, respetar. Sino, default según contexto.
  const initialTab = defaultTab || (showMembersTab ? "miembros" : "config");
  const [activeTab, setActiveTab] = useState(initialTab);

  // Si no hay tabs (caso edge), no renderizar nada
  if (tabs.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header con tabs */}
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>Mi cuenta</h2>
        {tabs.length > 1 && (
          <div style={{
            display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`,
            marginBottom: 4, overflowX: "auto", flexWrap: "wrap",
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === tab.id ? T.green : "transparent"}`,
                  color: activeTab === tab.id ? T.txt : T.txt3,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  transition: "all 0.15s",
                  marginBottom: -1,
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido según tab activa */}
      {activeTab === "miembros" && showMembersTab && (
        <MiembrosTab
          supabase={supabase} accountId={accountId} role={role}
          displayName={displayName} plan={plan} maxMembers={maxMembers}
          currentUserId={currentUserId} currentUserName={currentUserName} onChange={onChange}
          subscriptionStatus={subscriptionStatus} graceUntil={graceUntil} onUpgrade={onUpgrade}
        />
      )}
      {activeTab === "config" && configContent && (
        <div>{configContent}</div>
      )}
    </div>
  );
}

// ═══ Tab Miembros ═══════════════════════════════════════════════════════
function MiembrosTab({ supabase, accountId, role, displayName, plan, maxMembers, currentUserId, currentUserName, onChange, subscriptionStatus, graceUntil, onUpgrade }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const isAdmin = role === "admin";
  const totalUsed = members.length + invitations.length;
  const slotsLeft = Math.max(0, (maxMembers || 1) - totalUsed);

  // ── Cargar miembros + invitaciones ─────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!accountId || !supabase) return;
    setLoading(true);
    setError("");
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        supabase.rpc("list_account_members", { p_account_id: accountId }),
        isAdmin
          ? supabase.rpc("list_pending_invitations", { p_account_id: accountId })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (invitationsRes.error) throw invitationsRes.error;
      setMembers(membersRes.data || []);
      setInvitations(invitationsRes.data || []);
    } catch (e) {
      console.error("[MiCuenta] error cargando datos:", e);
      setError(e.message || "No se pudieron cargar los datos de la cuenta");
    } finally {
      setLoading(false);
    }
  }, [accountId, supabase, isAdmin]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Acciones de admin ──────────────────────────────────────────────────
  const handleRemove = async (userId, email) => {
    if (!confirm(`¿Expulsar a ${email} de la cuenta? Va a perder acceso a todos los datos.`)) return;
    try {
      const { error } = await supabase.rpc("remove_member", { p_account_id: accountId, p_user_id: userId });
      if (error) throw error;
      await loadAll();
      onChange?.();
    } catch (e) {
      alert("No se pudo expulsar al miembro: " + (e.message || "error desconocido"));
    }
  };

  const handleRoleChange = async (userId, currentRole, email) => {
    const newRole = currentRole === "admin" ? "reader" : "admin";
    const verb = newRole === "admin" ? "promover a administrador" : "degradar a solo lectura";
    if (!confirm(`¿${verb.charAt(0).toUpperCase() + verb.slice(1)} a ${email}?`)) return;
    try {
      const { error } = await supabase.rpc("update_member_role", {
        p_account_id: accountId,
        p_user_id: userId,
        p_new_role: newRole,
      });
      if (error) throw error;
      await loadAll();
      onChange?.();
    } catch (e) {
      alert("No se pudo cambiar el rol: " + (e.message || "error desconocido"));
    }
  };

  const handleRevoke = async (invitationId, email) => {
    if (!confirm(`¿Revocar invitación a ${email}?`)) return;
    try {
      const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert("No se pudo revocar la invitación: " + (e.message || "error desconocido"));
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.txt3 }}>Cargando...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header de la cuenta */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: T.txt }}>
              {displayName || "Mi cuenta"}
            </h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ background: T.blueB, color: T.blue, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                Plan {PLAN_LABELS[plan] || plan}
              </span>
              <span style={{ color: T.txt2, fontSize: 13 }}>
                {totalUsed} de {maxMembers || 1} miembros
              </span>
              {role === "reader" && (
                <span style={{ background: T.amberB, color: T.amber, padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                  Vista de solo lectura
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {slotsLeft > 0 ? (
                <button
                  onClick={() => setShowInvite(true)}
                  style={{
                    background: T.green, color: "#000", border: "none",
                    padding: "10px 18px", borderRadius: 10, cursor: "pointer",
                    fontWeight: 700, fontSize: 13,
                  }}
                >
                  + Invitar miembro
                </button>
              ) : (
                <div style={{ background: T.amberB, color: T.amber, padding: "10px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                  Cuenta llena · sube de plan para invitar más
                </div>
              )}
              {/* Botón Gestionar suscripción — para todos los planes pagos (incluido Básico).
                  El portal de Stripe muestra qué se puede hacer según el estado de la cuenta:
                  si está en trial muestra "Cancel anyway", si pagó muestra cambio de plan, etc.
                  Sesión 4-may-2026: ampliamos de solo pro/pro_familiar a también basico para
                  que no haya users pagos sin acceso a su portal. */}
              {(plan === "pro_familiar" || plan === "pro" || plan === "basico") && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/.netlify/functions/stripe-customer-portal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId: currentUserId,
                          returnUrl: window.location.href,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        if (data.error === "no_stripe_customer") {
                          alert("No tenés una suscripción de Stripe asociada todavía. Si pagaste recién, esperá unos minutos. Si tu plan es legacy (sin Stripe), contactá soporte.");
                        } else if (data.error === "portal_not_configured") {
                          alert("El portal de Stripe no está configurado todavía. Soporte ya fue notificado.");
                        } else {
                          alert("Error abriendo portal: " + (data.message || data.error || "desconocido"));
                        }
                        return;
                      }
                      window.location.href = data.url;
                    } catch (e) {
                      alert("Error de red abriendo portal: " + e.message);
                    }
                  }}
                  style={{
                    background: T.bg3, color: T.txt, border: `1px solid ${T.border}`,
                    padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                    fontWeight: 600, fontSize: 12,
                  }}
                  title="Cancelar, cambiar plan, ver facturas"
                >
                  ⚙️ Gestionar suscripción
                </button>
              )}
            </div>
          )}
        </div>

        {/* Banner: subscription cancelada · grace period activo */}
        {subscriptionStatus === "canceled" && graceUntil && (
          <div style={{
            marginTop: 16,
            padding: "12px 14px",
            background: T.amberB,
            border: `1px solid ${T.amber}`,
            borderRadius: 10,
            fontSize: 12,
            color: T.amber,
            lineHeight: 1.6,
          }}>
            <strong>⚠️ Tu plan {PLAN_LABELS[plan] || plan} fue cancelado.</strong>{" "}
            Seguís teniendo acceso completo hasta el {new Date(graceUntil).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}.
            Después, tu cuenta vuelve al plan Free.{" "}
            {isAdmin && (
              <span>Si fue un error, click en "⚙️ Gestionar suscripción" arriba para reactivar.</span>
            )}
          </div>
        )}

        {/* Explicación del modelo */}
        <div style={{ marginTop: 16, padding: "12px 14px", background: T.bg3, borderRadius: 10, fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
          {plan === "pro_familiar" ? (
            <>👨‍👩‍👧 <strong style={{ color: T.txt }}>Plan Pro Familiar:</strong> hasta 10 personas pueden ver y trabajar con los mismos datos. Útil para familia + contador.</>
          ) : plan === "pro" ? (
            <>⭐ <strong style={{ color: T.txt }}>Plan Pro:</strong> hasta 3 personas con la misma información. Para familia chica o pareja + contador.</>
          ) : plan === "managed" ? (
            <>👤 <strong style={{ color: T.txt }}>Cuenta gestionada por asesor:</strong> tu asesor configuró este espacio.</>
          ) : plan === "basico" ? (
            <>👤 <strong style={{ color: T.txt }}>Plan Básico:</strong> 1 usuario por cuenta. Para compartir con familia o contador, subí a Pro Familiar.</>
          ) : (
            // 25-jul-2026 (Santiago): esta rama decía "Plan Básico" para
            // CUALQUIER plan que no fuera pro/pro_familiar/managed. Un usuario
            // gratuito veía el badge "Plan free" y debajo "Plan Básico" —
            // dos planes distintos en la misma tarjeta.
            <>👤 <strong style={{ color: T.txt }}>Plan gratuito:</strong> 1 usuario por cuenta. Con Pro tenés el motor fiscal, el Asesor IA y los Coaches; con Pro Familiar, hasta 10 personas sobre los mismos datos.</>
          )}
          {onUpgrade && plan !== "pro_familiar" && (
            <div style={{ marginTop: 10 }}>
              <button onClick={onUpgrade} style={{ background: T.gn, color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                Ver planes y mejorar →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div style={{ background: T.redB, border: `1px solid ${T.red}`, color: T.red, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Lista de miembros activos */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>Miembros activos ({members.length})</div>
        </div>
        <div>
          {members.map((m, idx) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isLast={idx === members.length - 1}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>

      {/* Invitaciones pendientes (solo admin) */}
      {isAdmin && invitations.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>
              Invitaciones pendientes ({invitations.length})
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>
              Estas personas todavía no aceptaron. Podés copiarles el link o revocar la invitación.
            </div>
          </div>
          <div>
            {invitations.map((inv, idx) => (
              <InvitationRow
                key={inv.invitation_id}
                invitation={inv}
                isLast={idx === invitations.length - 1}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal de invitación */}
      {showInvite && (
        <InviteModal
          supabase={supabase}
          accountId={accountId}
          accountName={displayName}
          inviterName={currentUserName}
          onClose={() => { setShowInvite(false); setInviteResult(null); loadAll(); }}
          onSuccess={(result) => setInviteResult(result)}
          inviteResult={inviteResult}
        />
      )}
    </div>
  );
}

// ═══ Subcomponentes ═══════════════════════════════════════════════════════

function MemberRow({ member, isLast, isAdmin, currentUserId, onRoleChange, onRemove }) {
  const isMe = member.user_id === currentUserId;
  const isOwner = member.is_owner;
  const canModify = isAdmin && !isMe && !isOwner;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
      borderBottom: isLast ? "none" : `1px solid ${T.border}`,
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 99, background: T.blueB,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: T.blue, flexShrink: 0,
      }}>
        {(member.display_name || member.email || "U").charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span>{member.display_name || member.email.split("@")[0]}</span>
          {isMe && <span style={{ fontSize: 10, color: T.txt3, fontWeight: 400 }}>(vos)</span>}
          {isOwner && <span style={{ background: T.greenB, color: T.green, padding: "1px 6px", borderRadius: 99, fontSize: 9, fontWeight: 700 }}>OWNER</span>}
        </div>
        <div style={{ fontSize: 11, color: T.txt3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {member.email}
        </div>
      </div>
      <div style={{
        background: member.role === "admin" ? T.greenB : T.bg3,
        color: member.role === "admin" ? T.green : T.txt2,
        padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      }}>
        {ROLE_LABELS[member.role] || member.role}
      </div>
      {canModify && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onRoleChange(member.user_id, member.role, member.email)}
            style={{
              background: T.bg3, border: `1px solid ${T.borderL}`,
              color: T.txt2, padding: "5px 10px", borderRadius: 8,
              cursor: "pointer", fontSize: 11, fontWeight: 600,
            }}
            title={member.role === "admin" ? "Bajar a solo lectura" : "Promover a administrador"}
          >
            {member.role === "admin" ? "↓ A reader" : "↑ A admin"}
          </button>
          <button
            onClick={() => onRemove(member.user_id, member.email)}
            style={{
              background: T.redB, border: `1px solid ${T.red}`,
              color: T.red, padding: "5px 10px", borderRadius: 8,
              cursor: "pointer", fontSize: 11, fontWeight: 600,
            }}
            title="Expulsar miembro"
          >
            Expulsar
          </button>
        </div>
      )}
    </div>
  );
}

function InvitationRow({ invitation, isLast, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const days = daysUntil(invitation.expires_at);

  const copyLink = () => {
    navigator.clipboard?.writeText(invitation.invitation_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
      borderBottom: isLast ? "none" : `1px solid ${T.border}`,
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 99, background: T.amberB,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: T.amber, flexShrink: 0,
      }}>
        ⏳
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {invitation.email}
        </div>
        <div style={{ fontSize: 11, color: T.txt3 }}>
          Rol: {ROLE_LABELS[invitation.role]} · expira en {days} {days === 1 ? "día" : "días"}
        </div>
      </div>
      <button
        onClick={copyLink}
        style={{
          background: copied ? T.greenB : T.bg3,
          border: `1px solid ${copied ? T.green : T.borderL}`,
          color: copied ? T.green : T.txt2,
          padding: "5px 12px", borderRadius: 8,
          cursor: "pointer", fontSize: 11, fontWeight: 600,
        }}
      >
        {copied ? "✓ Copiado" : "📋 Copiar link"}
      </button>
      <button
        onClick={() => onRevoke(invitation.invitation_id, invitation.email)}
        style={{
          background: T.redB, border: `1px solid ${T.red}`,
          color: T.red, padding: "5px 10px", borderRadius: 8,
          cursor: "pointer", fontSize: 11, fontWeight: 600,
        }}
      >
        ✕ Revocar
      </button>
    </div>
  );
}

function InviteModal({ supabase, accountId, accountName, inviterName, onClose, onSuccess, inviteResult }) {
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("reader");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);
  // Fase 3 commit 4: estado del envío automático del email vía Resend.
  // 'idle' antes del submit, 'sending' mientras se llama a la function,
  // 'sent' si el email salió OK, 'fallback' si Resend no está configurado
  // o falló (el link copyable sigue siendo el camino de respaldo).
  const [emailStatus, setEmailStatus] = useState("idle");

  const submit = async (e) => {
    e?.preventDefault?.();
    if (submitting) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("create_invitation", {
        p_account_id: accountId,
        p_email: email,
        p_role: memberRole,
      });
      if (error) throw error;
      // Mostrar pantalla de éxito inmediatamente con el link copyable.
      // El envío del email es non-blocking — si falla, el admin igual tiene
      // el link visible y puede mandarlo manualmente.
      onSuccess(data);
      // Disparar envío del email en background.
      setEmailStatus("sending");
      try {
        const res = await fetch("/.netlify/functions/family-invite-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            invitation_url: data.invitation_url,
            role: data.role,
            account_name: accountName,
            invited_by_name: inviterName,
            expires_at: data.expires_at,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (body?.sent) {
          setEmailStatus("sent");
        } else {
          // Fallback graceful: Resend no configurado, o error de envío.
          // Loguear pero no preocupar al usuario — el link copyable está visible.
          console.log("[invite-email] no enviado:", body?.reason || body?.error || "unknown");
          setEmailStatus("fallback");
        }
      } catch (e) {
        console.warn("[invite-email] fetch falló:", e);
        setEmailStatus("fallback");
      }
    } catch (e) {
      setSubmitError(e.message || "No se pudo crear la invitación");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (!inviteResult?.invitation_url) return;
    navigator.clipboard?.writeText(inviteResult.invitation_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Si ya hay un resultado de invitación, mostrar pantalla de éxito con link
  if (inviteResult) {
    return (
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 20,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20,
          width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 32,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: T.green }}>✓ Invitación creada</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: T.txt2, marginBottom: 16, lineHeight: 1.6 }}>
            {emailStatus === "sent"
              ? <>Le mandamos un email a <strong style={{ color: T.txt }}>{inviteResult.email}</strong> con el link de invitación. Al abrirlo y hacer login, va a quedar como <strong style={{ color: T.txt }}>{ROLE_LABELS[inviteResult.role]}</strong> en tu cuenta.</>
              : <>Mandale este link a <strong style={{ color: T.txt }}>{inviteResult.email}</strong> por WhatsApp, email o como prefieras. Al abrirlo y hacer login con ese email, va a quedar como <strong style={{ color: T.txt }}>{ROLE_LABELS[inviteResult.role]}</strong> en tu cuenta.</>}
          </div>
          {emailStatus === "sending" && (
            <div style={{
              background: "rgba(59,130,246,0.08)", border: `1px solid rgba(59,130,246,0.25)`,
              borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.blue, marginBottom: 12,
            }}>
              ✉️ Enviando email…
            </div>
          )}
          {emailStatus === "sent" && (
            <div style={{
              background: "rgba(16,185,129,0.08)", border: `1px solid rgba(16,185,129,0.25)`,
              borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.green, marginBottom: 12,
            }}>
              ✓ Email enviado · igualmente podés copiar el link como respaldo
            </div>
          )}
          {emailStatus === "fallback" && (
            <div style={{
              background: "rgba(234,179,8,0.08)", border: `1px solid rgba(234,179,8,0.25)`,
              borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#eab308", marginBottom: 12,
            }}>
              ℹ️ Email automático no disponible · copiá el link y mandalo manualmente
            </div>
          )}
          <div style={{
            background: T.bg3, border: `1px solid ${T.borderL}`, borderRadius: 10,
            padding: 14, fontSize: 12, color: T.txt, wordBreak: "break-all",
            fontFamily: "ui-monospace, monospace", marginBottom: 12,
          }}>
            {inviteResult.invitation_url}
          </div>
          <button
            onClick={copyLink}
            style={{
              width: "100%", background: copied ? T.green : T.blue, color: "#fff",
              border: "none", padding: "12px 16px", borderRadius: 10,
              cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 8,
            }}
          >
            {copied ? "✓ Link copiado al portapapeles" : "📋 Copiar link"}
          </button>
          <div style={{ fontSize: 11, color: T.txt3, textAlign: "center" }}>
            Expira en 7 días.
          </div>
        </div>
      </div>
    );
  }

  // Pantalla del formulario
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 20,
        width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 32,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Invitar nuevo miembro</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.txt3, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Email del invitado
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="familiar@email.com"
            autoFocus
            style={{
              width: "100%", marginTop: 6, padding: "10px 12px",
              background: T.bg3, border: `1px solid ${T.borderL}`,
              borderRadius: 10, color: T.txt, fontSize: 13,
            }}
          />
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 6 }}>
            Tiene que ser el email exacto con el que la persona va a hacer login.
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Rol
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <RoleOption
              value="reader"
              currentValue={memberRole}
              onChange={setMemberRole}
              title="Solo lectura"
              description="Puede ver toda la información pero no editarla. Ideal para tu contador o un familiar que solo necesita revisar."
            />
            <RoleOption
              value="admin"
              currentValue={memberRole}
              onChange={setMemberRole}
              title="Administrador"
              description="Puede agregar y editar ingresos, gastos, deudas e inversiones, igual que vos."
            />
          </div>
        </div>

        {submitError && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: T.redB, border: `1px solid ${T.red}`, color: T.red, borderRadius: 10, fontSize: 12 }}>
            ⚠️ {submitError}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: T.bg3, border: `1px solid ${T.borderL}`,
              color: T.txt2, padding: "12px 16px", borderRadius: 10,
              cursor: "pointer", fontWeight: 600, fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting || !email}
            style={{
              flex: 2, background: T.green, color: "#000", border: "none",
              padding: "12px 16px", borderRadius: 10,
              cursor: submitting || !email ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 13, opacity: submitting || !email ? 0.5 : 1,
            }}
          >
            {submitting ? "Generando..." : "Generar invitación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleOption({ value, currentValue, onChange, title, description }) {
  const selected = value === currentValue;
  return (
    <div
      onClick={() => onChange(value)}
      style={{
        background: selected ? T.greenB : T.bg3,
        border: `1px solid ${selected ? T.green : T.borderL}`,
        borderRadius: 10, padding: 12, cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 16, height: 16, borderRadius: 99,
          border: `2px solid ${selected ? T.green : T.txt3}`,
          background: selected ? T.green : "transparent",
          flexShrink: 0,
        }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: T.txt }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: T.txt2, marginTop: 6, marginLeft: 24, lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
}
