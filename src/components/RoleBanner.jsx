// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · RoleBanner — banner de "solo lectura" cuando role=reader
// ─────────────────────────────────────────────────────────────────────────
// Banner sutil en la parte superior del dashboard que avisa al usuario
// que está viendo una cuenta compartida en modo solo lectura. Se renderiza
// condicionalmente desde App.jsx solo cuando:
//   - !isLegacy (la cuenta multi-usuario está activa)
//   - role === 'reader'
//   - viewMode !== 'client' (no estamos en el modo asesor-viendo-cliente)
//
// Diseño minimalista para no romper el layout. Se ubica entre el topbar
// y el contenido principal de la página.
//
// PROPS:
//   accountName: string opcional - "Familia Sosa" / display_name de la cuenta
//   onLearnMore: function opcional - handler para "?" que abre modal explicativo (Fase 3)
//
// ═════════════════════════════════════════════════════════════════════════

// Tema alineado con T de App.jsx (no con el de AcceptInvite)
const C = {
  bg: "rgba(59,130,246,0.08)",      // azul muy tenue
  border: "rgba(59,130,246,0.2)",
  txt: "#fafafa",
  accent: "#3b82f6",
  txt2: "#a1a1aa",
};

export default function RoleBanner({ accountName, onLearnMore }) {
  return (
    <div
      role="status"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 16px",
        margin: "8px 16px 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
        color: C.txt,
      }}
    >
      {/* Ícono de ojo (solo lectura) */}
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">👁️</span>

      <div style={{ flex: 1, lineHeight: 1.4 }}>
        <span style={{ color: C.accent, fontWeight: 600 }}>Solo lectura · </span>
        <span style={{ color: C.txt2 }}>
          {accountName ? (
            <>Estás viendo la cuenta <strong style={{color:C.txt}}>{accountName}</strong>. Solo el admin puede modificar datos.</>
          ) : (
            <>Estás viendo una cuenta compartida. Solo el admin puede modificar datos.</>
          )}
        </span>
      </div>

      {typeof onLearnMore === "function" && (
        <button
          onClick={onLearnMore}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.accent,
            padding: "4px 10px",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label="Más información sobre cuenta compartida"
        >
          Saber más
        </button>
      )}
    </div>
  );
}
