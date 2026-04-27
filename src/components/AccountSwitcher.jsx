// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · AccountSwitcher — selector de cuenta multi-usuario (Fase 2)
// ─────────────────────────────────────────────────────────────────────────
// Dropdown en el header que permite al usuario elegir qué cuenta está
// viendo cuando es miembro de varias (ej: cuenta personal admin +
// cuenta familiar reader). Solo se renderiza cuando memberships.length > 1.
//
// La elección persiste en localStorage.fp3_active_account y la lee
// useAccount.js al inicializar. Al cambiar de cuenta:
//   - Se limpia localStorage.fp3 (cache de la cuenta vieja)
//   - Se llama refreshAccount() para que useAccount re-fetch
//   - useEffect del cliente recarga user_data con el nuevo account_id
//
// PROPS:
//   memberships: Array - lista de membresías activas del user (de useAccount)
//   activeAccountId: string - cuenta activa actual
//   onSwitch: (newAccountId) => void - handler invocado al elegir otra cuenta
//
// ═════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from "react";

const C = {
  bg: "rgba(255,255,255,0.04)",
  bgHover: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.1)",
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",
  accent: "#3b82f6",
  panelBg: "#1a1a1d",
};

export default function AccountSwitcher({ memberships, activeAccountId, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click outside cierra el dropdown
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  if (!memberships || memberships.length === 0) return null;

  const active = memberships.find(m => m.account_id === activeAccountId) || memberships[0];
  if (!active) return null;
  const activeName = active.accounts?.display_name || "Cuenta sin nombre";
  const activeRole = active.role;

  const handleSwitch = (newAccountId) => {
    setOpen(false);
    if (newAccountId !== activeAccountId && typeof onSwitch === "function") {
      onSwitch(newAccountId);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "5px 10px",
          color: C.txt,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          maxWidth: 180,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{activeName}</span>
        <span style={{ color: C.txt3, fontSize: 10, fontWeight: 400 }}>· {activeRole}</span>
        <span style={{ color: C.txt3, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            minWidth: 240,
            maxWidth: 320,
            background: C.panelBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: C.txt3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
            Tus cuentas ({memberships.length})
          </div>
          {memberships.map(m => {
            const isActive = m.account_id === activeAccountId;
            const name = m.accounts?.display_name || "Sin nombre";
            return (
              <button
                key={m.account_id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSwitch(m.account_id)}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.bgHover; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: isActive ? C.bgHover : "transparent",
                  border: "none",
                  padding: "10px 14px",
                  color: C.txt,
                  fontSize: 13,
                  cursor: isActive ? "default" : "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                  <div style={{ color: C.txt2, fontSize: 11, marginTop: 2 }}>
                    {m.role === "admin" ? "Administrador" : "Solo lectura"}
                  </div>
                </div>
                {isActive && (
                  <span style={{ color: C.accent, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>● activa</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
