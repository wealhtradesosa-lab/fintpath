/**
 * BloqueadosPorPlan — Lo que hay del otro lado del candado.
 *
 * 26-jul-2026. Muestra cuántos ítems quedaron bloqueados por el límite del
 * plan gratuito y cuánto suman, sin revelar el detalle.
 *
 * Que el MONTO sea visible es deliberado: un candado que no deja ver qué
 * protege no motiva. Saber que hay $6.400M bloqueados es mucho más persuasivo
 * que un "mejorá tu plan" genérico, y además es honesto — el usuario merece
 * saber que sus totales incluyen algo que no está viendo en detalle.
 */
export default function BloqueadosPorPlan({ cantidad, monto, fmt, T, onUpgrade, que = "ítems" }) {
  if (!cantidad) return null;

  return (
    <div style={{
      background: "rgba(168,85,247,0.06)",
      border: "1px dashed rgba(168,85,247,0.35)",
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginTop: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.txt || T.tx }}>
            {cantidad} {cantidad === 1 ? que.replace(/s$/, "") : que} sin acceso en el plan gratuito
          </div>
          <div style={{ fontSize: 11.5, color: T.txt3 || T.tx3, marginTop: 2, lineHeight: 1.5 }}>
            {monto > 0 && <>Suman <strong style={{ color: T.txt2 || T.tx2 }}>{fmt(monto)}</strong> y <strong>sí están incluidos</strong> en tus totales. </>}
            Para verlos y editarlos, mejorá tu plan.
          </div>
        </div>
      </div>
      {onUpgrade && (
        <button onClick={onUpgrade} style={{
          background: "#a855f7", color: "#fff", border: "none",
          padding: "9px 18px", borderRadius: 8, cursor: "pointer",
          fontWeight: 700, fontSize: 12, flexShrink: 0,
        }}>
          Ver planes →
        </button>
      )}
    </div>
  );
}
