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

// Templates disponibles — mismos para ingreso y gasto (solo cambia el copy)
export const TEMPLATES = [
  {
    id: "mensual-todo-año",
    emoji: "💵",
    titulo: (tipo) => tipo === "ingreso" ? "Salario / renta mensual" : "Gasto mensual",
    descripcion: (tipo) => tipo === "ingreso" ? "Cada mes, todo el año (12 pagos)" : "Cada mes, todo el año",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: sueldo, arriendo, dividendo mensual" : "Ej: arriendo, servicios, gimnasio",
    preset: { frecuencia: "mensual", desdeMes: 1, hastaMes: 12, mesPago: 1 },
    camposVisibles: ["monto"], // solo pide el monto
    modoIngresoDefault: "porPago",
    color: "#22c55e",
  },
  {
    id: "mensual-limitado",
    emoji: "📅",
    titulo: (tipo) => tipo === "ingreso" ? "Contrato / renta temporal" : "Gasto temporal",
    descripcion: (tipo) => tipo === "ingreso" ? "Cada mes, solo durante algunos meses (ej: jul–dic)" : "Cada mes, solo durante algunos meses",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: Rapicredit jul–dic, contrato por proyecto" : "Ej: alquiler temporal, curso trimestral",
    preset: { frecuencia: "mensual", desdeMes: 7, hastaMes: 12, mesPago: 1 },
    camposVisibles: ["monto", "vigencia"], // pide monto + desde/hasta
    modoIngresoDefault: "porPago",
    color: "#3b82f6",
  },
  {
    id: "anual",
    emoji: "🎯",
    titulo: (tipo) => tipo === "ingreso" ? "Prima / bono anual" : "Gasto anual",
    descripcion: (tipo) => tipo === "ingreso" ? "1 pago al año" : "1 pago al año (impuestos, seguros)",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: prima diciembre, bono anual, cesantías" : "Ej: impuesto vehículo, predial, seguro anual",
    preset: { frecuencia: "anual", desdeMes: 1, hastaMes: 12, mesPago: 6 },
    camposVisibles: ["monto", "mesPago"], // pide monto + mes del pago
    modoIngresoDefault: "porPago",
    color: "#a78bfa",
  },
  {
    id: "unico",
    emoji: "💥",
    titulo: (tipo) => tipo === "ingreso" ? "Pago único" : "Compra única",
    descripcion: () => "Una sola vez este año, no se repite",
    ejemplo: (tipo) => tipo === "ingreso" ? "Ej: venta puntual, herencia, indemnización" : "Ej: viaje, compra grande, mudanza",
    preset: { frecuencia: "unico", desdeMes: 1, hastaMes: 12, mesPago: 6 },
    camposVisibles: ["monto", "mesPago"],
    modoIngresoDefault: "porPago",
    color: "#f97316",
  },
  {
    id: "avanzado",
    emoji: "⚙️",
    titulo: () => "Configuración avanzada",
    descripcion: () => "Trimestral, semestral, o algo diferente",
    ejemplo: () => "Todas las opciones disponibles",
    preset: { frecuencia: "mensual", desdeMes: 1, hastaMes: 12, mesPago: 1 },
    camposVisibles: ["monto", "frecuencia", "vigencia", "mesPago", "modoIngreso"], // TODO
    modoIngresoDefault: "porPago",
    color: "#71717a",
  },
];

export default function TemplateSelector({ tipo = "ingreso", onSelect, tokens: T, onCancel }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, letterSpacing: "-0.02em", marginBottom: 4 }}>
          ¿Qué tipo de {tipo} es?
        </div>
        <div style={{ fontSize: 13, color: T.txt3, lineHeight: 1.5 }}>
          Elegí uno y solo llenás lo esencial. Podés cambiarlo después.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {TEMPLATES.map(tpl => (
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

      {onCancel && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
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
