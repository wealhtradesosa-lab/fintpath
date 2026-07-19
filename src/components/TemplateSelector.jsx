// ═══════════════════════════════════════════════════════════════════════════
// TemplateSelector — Selector de plantillas de ingreso/gasto (18-jul-2026)
//
// Motivación (Santiago 18-jul-2026):
//   "El sistema es confuso" — feature creep al agregar frecuencia + mesPago +
//   modo (porPago/anual) + vigencia (desde/hasta) + toggle pagado.
//
// Solución: en vez de mostrar todo al principio, el user elige UN template
// visual y solo se le piden los campos esenciales. Reduce 5 decisiones
// técnicas a 1 elección visual.
//
// El motor sigue siendo poderoso: los templates auto-configuran los campos
// avanzados (frecuencia, desdeMes, hastaMes, mesPago) para que el user solo
// tenga que llenar monto + nombre + fechas relevantes.
//
// Uso:
//   <TemplateSelector
//     tipo="ingreso"  // o "gasto"
//     onSelect={(template) => { ... }}
//     tokens={T}
//   />
//
// El callback onSelect recibe un objeto con la config preseleccionada:
//   {
//     id: "mensual-todo-año",
//     label: "Mensual todo el año",
//     preset: { frecuencia: "mensual", desdeMes: 1, hastaMes: 12, ... },
//     camposVisibles: ["monto"]  // qué campos mostrar en el form
//   }
// ═══════════════════════════════════════════════════════════════════════════

// Templates disponibles — SUPER SIMPLES (Santiago 18-jul-2026 iter 2):
// "si simplemente uno pone el valor total o mensual y uno dice si el pago
// es cada mes o solo unos meses". 3 opciones nada más + avanzado oculto.
export const TEMPLATES = [
  {
    id: "mensual-todo-año",
    emoji: "💵",
    titulo: (tipo) => tipo === "ingreso" ? "Cada mes durante todo el año" : "Cada mes durante todo el año",
    descripcion: () => "Se recibe/paga los 12 meses",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: sueldo, arriendo, dividendo mensual" : "Ej: arriendo, servicios, gimnasio, mercado",
    preset: { frecuencia: "mensual", desdeMes: 1, hastaMes: 12, mesPago: 1 },
    // El toggle "Mensual/Total del año" también aplica acá
    camposVisibles: ["monto", "modoIngresoSimple"],
    modoIngresoDefault: "porPago",
    color: "#22c55e",
  },
  {
    id: "mensual-limitado",
    emoji: "📅",
    titulo: () => "Cada mes solo durante algunos meses",
    descripcion: () => "Se recibe/paga solo un rango de meses (ej: jul–dic)",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: Rapicredit jul–dic, contrato por proyecto" : "Ej: alquiler temporal, curso trimestral",
    preset: { frecuencia: "mensual", desdeMes: 7, hastaMes: 12, mesPago: 1 },
    camposVisibles: ["monto", "modoIngresoSimple", "vigencia"],
    modoIngresoDefault: "porPago",
    color: "#3b82f6",
  },
  {
    id: "anual",
    emoji: "🎯",
    titulo: () => "Solo una vez al año",
    descripcion: () => "1 pago único en un mes específico",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: prima diciembre, bono anual, cesantías" : "Ej: impuesto vehículo, predial, seguro anual",
    preset: { frecuencia: "anual", desdeMes: 1, hastaMes: 12, mesPago: 6 },
    camposVisibles: ["monto", "mesPago"],
    modoIngresoDefault: "porPago",
    color: "#a78bfa",
  },
  {
    id: "variable-mensual",
    emoji: "📊",
    titulo: () => "Cambia mes a mes",
    descripcion: (tipo) => tipo === "ingreso"
      ? "Diferente monto cada mes (ej: comisiones, honorarios variables)"
      : "Diferente monto cada mes (ej: gastos irregulares)",
    ejemplo: (tipo) => tipo === "ingreso"
      ? "Ej: $15M en ene-feb, $8M en mar-abr, $40M pico en may..."
      : "Ej: gastos de viaje, servicios variables",
    // Preset: 12 meses en 0 — el user los llena en la tabla
    preset: {
      frecuencia: "variable",
      desdeMes: 1,
      hastaMes: 12,
      mesPago: 1,
      montosMensuales: new Array(12).fill(0),
    },
    // UX ampliación (18-jul-2026 noche): también soporta vigencia limitada.
    // Ej: contrato temporal variable jul-dic con montos diferentes cada mes.
    camposVisibles: ["tablaMensual", "vigencia"],
    modoIngresoDefault: "porPago",
    color: "#22d3ee",
  },
  {
    id: "avanzado",
    emoji: "⚙️",
    titulo: () => "Otras opciones",
    descripcion: () => "Trimestral, semestral, u otro caso especial",
    ejemplo: () => "Ej: dividendos trimestrales, seguro semestral",
    preset: { frecuencia: "mensual", desdeMes: 1, hastaMes: 12, mesPago: 1 },
    camposVisibles: ["monto", "frecuencia", "vigencia", "mesPago", "modoIngreso"],
    modoIngresoDefault: "porPago",
    color: "#71717a",
  },
];

// Detecta cuál template corresponde a un item existente al editarlo.
// Devuelve el template que mejor calza con la frecuencia/vigencia del item.
// Fallback: template "avanzado" que muestra todos los campos.
export function detectarTemplate(item) {
  const freq = item?.frecuencia || "mensual";
  if (freq === "variable") {
    return TEMPLATES.find(t => t.id === "variable-mensual") || TEMPLATES[TEMPLATES.length - 1];
  }
  if (freq === "mensual") {
    const desde = Number(item?.desdeMes) || 1;
    const hasta = Number(item?.hastaMes) || 12;
    if (desde === 1 && hasta === 12) {
      return TEMPLATES.find(t => t.id === "mensual-todo-año") || TEMPLATES[0];
    }
    return TEMPLATES.find(t => t.id === "mensual-limitado") || TEMPLATES[0];
  }
  if (freq === "anual" || freq === "unico") {
    return TEMPLATES.find(t => t.id === "anual") || TEMPLATES[0];
  }
  // Trimestral, semestral, o cualquier otro caso → avanzado
  return TEMPLATES.find(t => t.id === "avanzado") || TEMPLATES[TEMPLATES.length - 1];
}

export default function TemplateSelector({ tipo = "ingreso", onSelect, tokens: T, onCancel }) {
  const templatesPrincipales = TEMPLATES.filter(t => t.id !== "avanzado");
  const templateAvanzado = TEMPLATES.find(t => t.id === "avanzado");

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, letterSpacing: "-0.02em", marginBottom: 4 }}>
          ¿Cuándo se {tipo === "ingreso" ? "recibe" : "paga"}?
        </div>
        <div style={{ fontSize: 13, color: T.txt3, lineHeight: 1.5 }}>
          Elegí una opción. Solo llenás lo esencial.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {templatesPrincipales.map(tpl => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 14,
              transition: "all 0.15s ease",
              color: T.txt,
              fontFamily: "inherit",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tpl.color;
              e.currentTarget.style.background = tpl.color + "08";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.card;
            }}
          >
            <div style={{ fontSize: 28, flexShrink: 0, width: 40, textAlign: "center" }}>
              {tpl.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
                {tpl.titulo(tipo)}
              </div>
              <div style={{ fontSize: 12, color: T.txt2, marginBottom: 3 }}>
                {tpl.descripcion(tipo)}
              </div>
              <div style={{ fontSize: 11, color: T.txt3, fontStyle: "italic" }}>
                {tpl.ejemplo(tipo)}
              </div>
            </div>
            <div style={{ fontSize: 16, color: T.txt3, flexShrink: 0 }}>→</div>
          </button>
        ))}
      </div>

      {/* Link chiquito para casos avanzados */}
      {templateAvanzado && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => onSelect(templateAvanzado)}
            style={{ background: "transparent", border: "none", color: T.txt3, fontSize: 12, cursor: "pointer", padding: "6px 12px", textDecoration: "underline" }}
          >
            ⚙️ ¿Trimestral, semestral, u otro caso? Ver opciones avanzadas
          </button>
        </div>
      )}

      {onCancel && (
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "transparent", border: "none", color: T.txt3, fontSize: 12, cursor: "pointer", padding: "8px 16px" }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
