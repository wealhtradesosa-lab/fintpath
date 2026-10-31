// Fila de controles para los listados (31-oct-2026): titular y «ver solo totales».
export default function FiltroListado({ owners = [], titular, onTitular, hayCerrados, onAlternar, T }) {
  const chip = (on) => ({ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? T.green : T.border}`, background: on ? "rgba(0,200,5,0.12)" : "transparent", color: on ? T.green : T.txt2, fontSize: 12, fontWeight: 600, cursor: "pointer" });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
      {owners.length > 1 && [{ id: "", name: "Todos" }, ...owners].map((o) => (
        <button key={o.id || "todos"} type="button" onClick={() => onTitular(o.id)} style={chip(titular === o.id)}>
          {o.type === "juridica" ? "" : o.id ? "" : ""}{o.name}
        </button>
      ))}
      {onAlternar && <button type="button" onClick={onAlternar} style={{ ...chip(false), fontWeight: 500 }}>{hayCerrados ? "Abrir todo" : "Ver solo totales"}</button>}
    </div>
  );
}
