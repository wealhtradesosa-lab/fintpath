/**
 * BuscadorLista — Un solo campo que filtra por nombre y categoría.
 *
 * 26-jul-2026 (Santiago: "los listados de ingresos o gastos deberían tener
 * buscador porque a veces son muchos ítems, poder buscar por categoría y por
 * nombre").
 *
 * DECISIÓN: un campo, no dos. Obligar a elegir "buscar por nombre" o "buscar
 * por categoría" traslada al usuario una decisión que la máquina puede tomar
 * sola — quien escribe "vivienda" no sabe ni le importa si eso es el nombre
 * de un gasto o su categoría. El filtro mira ambos campos y ya.
 *
 * Sin acentos ni mayúsculas: escribir "educacion" encuentra "Educación".
 * Es el tipo de fricción que hace que un buscador se sienta roto.
 */

/** Normaliza para comparar: minúsculas y sin tildes. */
export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Filtra una lista por un texto, mirando los campos indicados.
 * Con la búsqueda vacía devuelve todo — el buscador no debe esconder nada
 * hasta que el usuario pida algo.
 */
export function filtrarPorTexto(items = [], texto, campos = []) {
  const q = norm(texto).trim();
  if (!q) return items;
  return items.filter((it) =>
    campos.some((c) => norm(it?.[c]).includes(q))
  );
}

export default function BuscadorLista({ valor, onChange, T, total, filtrados, placeholder = "Buscar por nombre o categoría…" }) {
  const buscando = String(valor || "").trim().length > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 12, fontSize: 14, opacity: 0.5, pointerEvents: "none" }}>🔍</span>
        <input
          value={valor || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: T.bg3 || T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "10px 36px",
            color: T.txt || T.tx,
            fontSize: 13,
            outline: "none",
          }}
        />
        {buscando && (
          <button
            onClick={() => onChange("")}
            title="Limpiar"
            style={{
              position: "absolute", right: 8, background: "transparent",
              border: "none", color: T.txt3 || T.tx3, cursor: "pointer",
              fontSize: 16, lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {/* Al filtrar, los totales de arriba siguen siendo los de TODO. Decirlo
          evita que alguien lea el total como si fuera el de lo que está
          viendo — el mismo criterio que con los ítems bloqueados por plan. */}
      {buscando && (
        <div style={{ fontSize: 11, color: T.txt3 || T.tx3, marginTop: 6 }}>
          {filtrados} de {total} · los totales de arriba siguen siendo del listado completo
        </div>
      )}
    </div>
  );
}
