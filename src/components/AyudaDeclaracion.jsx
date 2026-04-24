// ═══════════════════════════════════════════════════════════════════════════
// AYUDA: SISTEMA DE DECLARACIÓN
// ─────────────────────────────────────────────────────────────────────────
// Componente con FAQ explicando las 3 herramientas y cómo se relacionan.
// Se accede desde un botón "❓ ¿Cómo uso esto?" en el tab Declaración Completa.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from "react";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  cyan: "#06b6d4", green: "#22c55e", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
};

const FAQ = [
  {
    q: "¿Qué diferencia hay entre Simulador rápido, Wizard F-210/F-110 e Importador año anterior?",
    a: (
      <>
        <p>Son <strong>3 herramientas distintas</strong> que cumplen objetivos diferentes:</p>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: "10px 12px", background: "rgba(59,130,246,0.08)", borderLeft: "3px solid " + T.blue, borderRadius: 6 }}>
            <div style={{ color: T.blue, fontWeight: 700, fontSize: 12 }}>🎯 Simulador rápido (Plan Tributario)</div>
            <div style={{ color: T.txt2, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
              <strong>Para qué:</strong> saber cuánto vas a pagar de impuesto si seguís así. Sirve para planear: decidir si hacer aportes a pensión voluntaria, reinvertir utilidades, comprar vivienda, etc.<br/>
              <strong>Dato de entrada:</strong> tus ingresos, gastos, deudas e inversiones registrados en los módulos del día a día.<br/>
              <strong>Resultado:</strong> estimado automático.
            </div>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(34,197,94,0.08)", borderLeft: "3px solid " + T.green, borderRadius: 6 }}>
            <div style={{ color: T.green, fontWeight: 700, fontSize: 12 }}>📄 Wizard F-210 / F-110</div>
            <div style={{ color: T.txt2, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
              <strong>Para qué:</strong> preparar la declaración oficial que vas a presentar a la DIAN. Te guía casilla por casilla, muestra los artículos del ET, y calcula el impuesto según la tabla Art. 241 / tarifa jurídica real.<br/>
              <strong>Dato de entrada:</strong> lo que realmente vas a declarar. Puede usar los valores del simulador como punto de partida.<br/>
              <strong>Resultado:</strong> borrador de declaración listo para transcribir al portal DIAN.
            </div>
          </div>
          <div style={{ padding: "10px 12px", background: "rgba(6,182,212,0.08)", borderLeft: "3px solid " + T.cyan, borderRadius: 6 }}>
            <div style={{ color: T.cyan, fontWeight: 700, fontSize: 12 }}>📥 Importador año anterior</div>
            <div style={{ color: T.txt2, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
              <strong>Para qué:</strong> cargar lo que <em>ya declaraste</em> el año pasado, para usarlo como referencia comparativa al preparar el año en curso.<br/>
              <strong>Dato de entrada:</strong> tu declaración 2023/2024 (del portal DIAN). Capturás ~20 renglones principales, no todos.<br/>
              <strong>Resultado:</strong> al abrir el Wizard, cada casilla muestra "📥 Año 2024: $X" para comparar. También habilita las alertas cruzadas año a año (retenciones que bajaron, deducciones que desaparecieron, etc).
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    q: "¿Por qué el Simulador me da un impuesto muy alto si nunca he pagado eso?",
    a: (
      <>
        <p>El motor calcula <strong>con la data que tiene registrada</strong>. Si la data está incompleta, el impuesto sale alto. Los casos más frecuentes:</p>
        <ol style={{ marginTop: 8, marginLeft: 18, color: T.txt2, fontSize: 11, lineHeight: 1.7 }}>
          <li><strong>No hay gastos registrados</strong> — si una empresa tiene $500M/año de ingresos y $0 en gastos, el motor asume que el 100% es utilidad.</li>
          <li><strong>Sin depreciación de inmuebles</strong> — verifica que los inmuebles del módulo Inversiones tengan asignado el dueño (campo owner).</li>
          <li><strong>Deudas sin tasa de interés</strong> — sin tasa, el motor no puede restar intereses como gasto deducible.</li>
          <li><strong>Descuentos tributarios no capturados</strong> — ICA, donaciones, CTI se restan del impuesto (no de la base). Capturalos en el botón "⭐ Descuentos" de la tarjeta de cada jurídica.</li>
        </ol>
        <p style={{ marginTop: 8 }}>Cuando detecta alguna de estas condiciones, aparece un banner naranja arriba del Plan Tributario con las acciones a tomar.</p>
      </>
    ),
  },
  {
    q: "Si ya cargué el Wizard F-210, ¿por qué el Plan Tributario sigue mostrando otro número?",
    a: (
      <>
        <p>Hoy el Wizard y el Plan Tributario son <strong>herramientas independientes</strong>:</p>
        <ul style={{ marginTop: 8, marginLeft: 18, color: T.txt2, fontSize: 11, lineHeight: 1.7 }}>
          <li>El Plan Tributario calcula desde ingresos/gastos/deudas/inversiones</li>
          <li>El Wizard captura renglones que pueden diferir (ej: podés capturar un ingreso en el Wizard que no está en el módulo Ingresos)</li>
        </ul>
        <p style={{ marginTop: 8 }}>Lo ideal: que ambos converjan al mismo número. Si ves una diferencia grande, es probable que falten gastos o deducciones en los módulos del día a día (que sí están en el Wizard). Una futura versión permitirá que el Wizard "oficial" sobreescriba el Plan Tributario.</p>
      </>
    ),
  },
  {
    q: "¿Qué debería hacer primero?",
    a: (
      <>
        <p>Orden recomendado:</p>
        <ol style={{ marginTop: 8, marginLeft: 18, color: T.txt2, fontSize: 11, lineHeight: 1.7 }}>
          <li><strong>Registrá tus ingresos, gastos, deudas e inversiones</strong> en los módulos principales (día a día).</li>
          <li><strong>Asigná dueño</strong> (owner) a cada item si tenés varias personas/empresas.</li>
          <li><strong>Importá tu declaración del año anterior</strong> en la tarjeta del owner — esto habilita comparaciones automáticas.</li>
          <li><strong>Abrí el Plan Tributario</strong> y revisá los warnings de la "Revisión Fiscal" — arreglá cada uno.</li>
          <li><strong>Capturá descuentos tributarios y aportes manuales</strong> (botones ⭐ y 🏥) para refinar el cálculo.</li>
          <li><strong>Completá el Wizard F-210 / F-110</strong> cuando estés listo para preparar la declaración oficial.</li>
        </ol>
      </>
    ),
  },
  {
    q: "¿El sistema reemplaza a mi contador?",
    a: (
      <>
        <p><strong>No.</strong> FINPATHIA te ayuda a entender tu situación fiscal, detectar errores y planear. Pero no reemplaza:</p>
        <ul style={{ marginTop: 8, marginLeft: 18, color: T.txt2, fontSize: 11, lineHeight: 1.7 }}>
          <li>La revisión profesional de un contador antes de presentar a la DIAN</li>
          <li>El conocimiento específico de tu caso (contratos, régimen tributario especial, holding)</li>
          <li>La firma de tu contador cuando es obligatoria (grandes contribuyentes, ciertos regímenes)</li>
        </ul>
        <p style={{ marginTop: 8 }}>Los cálculos son aproximaciones con base en el Estatuto Tributario vigente. El monto final de tu declaración oficial puede diferir según interpretaciones puntuales.</p>
      </>
    ),
  },
  {
    q: "¿Cómo funcionan las alertas del Panel de Revisión Fiscal?",
    a: (
      <>
        <p>El sistema detecta <strong>17 tipos de situaciones</strong> que requieren tu atención:</p>
        <ul style={{ marginTop: 8, marginLeft: 18, color: T.txt2, fontSize: 11, lineHeight: 1.7 }}>
          <li><strong>⛔ Errores</strong> — algo que rompe el cálculo (ej: ingreso sin dueño asignado).</li>
          <li><strong>⚠️ Warnings</strong> — posibles pérdidas de dinero (ej: descuentos no capturados vs año pasado).</li>
          <li><strong>ℹ️ Info</strong> — el sistema infirió una clasificación, confirmá o editá (ej: "asumí que este arriendo es de inmueble").</li>
        </ul>
        <p style={{ marginTop: 8 }}>Cada alerta tiene botones "✓ Aprobar" (confirma la clasificación sugerida) y "✏️ [Módulo]" (llevarte al lugar donde editar). Los warnings que se repiten (ej: 3 arriendos iguales) se agrupan en una sola fila con detalle expandible.</p>
      </>
    ),
  },
];

export default function AyudaDeclaracion({ onClose }) {
  const [open, setOpen] = useState(new Set([0])); // primer FAQ abierto por default

  const toggle = (i) => {
    const next = new Set(open);
    if (next.has(i)) next.delete(i); else next.add(i);
    setOpen(next);
  };

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 28 }}>❓</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.txt }}>Ayuda: Sistema de declaración</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            Guía práctica para usar el Simulador, el Wizard y el Importador
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            ← Volver
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FAQ.map((item, i) => (
          <div key={i} style={{ background: T.bg2, borderRadius: 10, border: "1px solid " + T.border, overflow: "hidden" }}>
            <button
              onClick={() => toggle(i)}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "transparent",
                border: "none",
                color: T.txt,
                textAlign: "left",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ flex: 1 }}>{item.q}</span>
              <span style={{ color: T.txt3, fontSize: 18, transform: open.has(i) ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▸</span>
            </button>
            {open.has(i) && (
              <div style={{ padding: "0 16px 16px", color: T.txt2, fontSize: 12, lineHeight: 1.6 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 14, background: T.bg3, borderRadius: 10, fontSize: 11, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        ¿Tenés una pregunta que no está acá? Escribí a <strong style={{ color: T.cyan }}>soporte@finpathia.com</strong> y te respondemos.
      </div>
    </div>
  );
}
