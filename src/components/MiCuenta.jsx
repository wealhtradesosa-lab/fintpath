// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · MiCuenta — gestión de miembros e invitaciones (Fase 3 commit 2)
//
// Página accesible desde el sidebar "Mi cuenta". Solo visible cuando el
// usuario tiene una cuenta multi-usuario activa (no en modo legacy).
//
// Para admin:
//   - Ver lista de miembros activos (email, nombre, rol, owner badge)
//   - Cambiar rol de otros miembros (admin <-> reader)
//   - Expulsar miembros (excepto a sí mismo)
//   - Ver invitaciones pendientes
//   - Crear nuevas invitaciones (genera link copyable)
//   - Revocar invitaciones pendientes
//
// Para reader:
//   - Solo ver la lista de miembros (sin acciones)
//   - Mensaje claro de "vista de solo lectura"
//
// Llama a las RPCs del Fase 3 commit 1:
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
export default function MiCuenta({ supabase, accountId, role, displayName, plan, maxMembers, currentUserId, onChange }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState(null); // { invitation_url, email, role, expires_at }

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
        // Solo admin tiene permiso de listar invitaciones; readers reciben error.
        // En vez de gastar el round-trip, salteamos para readers.
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

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: T.txt3 }}>Cargando...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header de la cuenta */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Mi cuenta
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: "4px 0 8px", color: T.txt }}>
              {displayName || "Mi cuenta"}
            </h2>
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
            <div style={{ display: "flex", gap: 8 }}>
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
            </div>
          )}
        </div>

        {/* Explicación del modelo */}
        <div style={{ marginTop: 16, padding: "12px 14px", background: T.bg3, borderRadius: 10, fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
          {plan === "pro_familiar" ? (
            <>👨‍👩‍👧 <strong style={{ color: T.txt }}>Plan Pro Familiar:</strong> hasta 10 personas pueden ver y trabajar con los mismos datos. Útil para familia + contador.</>
          ) : plan === "pro" ? (
            <>⭐ <strong style={{ color: T.txt }}>Plan Pro:</strong> hasta 3 personas con la misma información. Para familia chica o pareja + contador.</>
          ) : plan === "managed" ? (
            <>👤 <strong style={{ color: T.txt }}>Cuenta gestionada por asesor:</strong> tu asesor configuró este espacio.</>
          ) : (
            <>👤 <strong style={{ color: T.txt }}>Plan Básico:</strong> 1 usuario por cuenta. Para compartir con familia o contador, sube a Pro Familiar.</>
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

function InviteModal({ supabase, accountId, onClose, onSuccess, inviteResult }) {
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("reader");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);

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
      onSuccess(data);
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
            Mandale este link a <strong style={{ color: T.txt }}>{inviteResult.email}</strong> por WhatsApp, email o como prefieras. Al abrirlo y hacer login con ese email, va a quedar como <strong style={{ color: T.txt }}>{ROLE_LABELS[inviteResult.role]}</strong> en tu cuenta.
          </div>
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
