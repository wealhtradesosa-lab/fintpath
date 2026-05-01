// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BorradorDeclaracionF110.jsx
//
// UI del borrador editable F-110 para personas jurídicas. Renderiza una
// tabla con los renglones DIAN, separados por sección (patrimonio, ingresos,
// costos, renta, impuesto, liquidación). Cada renglón editable tiene una
// celda con valor + botón [editar] que abre un mini-form inline. Los
// renglones de fórmula se recalculan automáticamente al cambiar dependencias.
//
// PROPS:
//   - user: user object completo
//   - estimacion: output de estimarImpuesto(user)
//   - onUpdateUser: callback (newUser) → persiste en supabase
//
// FILOSOFÍA:
//   - Cero ambigüedad: cada renglón muestra su número DIAN oficial
//   - Trazabilidad: hover muestra de dónde viene el valor automático
//   - Override visible: cuando el user/contador edita, se ve un badge "✏️"
//   - Reset disponible: siempre podés volver al valor automático
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect } from "react";
import { generarBorradorF110, SECCIONES_F110 } from "../lib/borradorDeclaracion.js";
import { generarBorradorF210, SECCIONES_F210 } from "../lib/borradorDeclaracionF210.js";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import AgenteTributarioBienvenida from "./AgenteTributarioBienvenida.jsx";
import WizardTributario from "./WizardTributario.jsx";
import ChatAgenteTributario from "./ChatAgenteTributario.jsx";
import AplicarOportunidadModal from "./AplicarOportunidadModal.jsx";
import { exportarBorradorPDF } from "../lib/pdfExport.js";
import TerminoTributario from "./TerminoTributario.jsx";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", blue: "#3b82f6", purple: "#c4b5fd",
  orange: "#f59e0b", red: "#ef4444", gold: "#eab308",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

export default function BorradorDeclaracionF110({ user, estimacion, onUpdateUser, initialOwnerId }) {
  // Owners disponibles: jurídicas + naturales
  const ownersJur = useMemo(() => (user?.owners || []).filter(o => o.type === "juridica"), [user]);
  const ownersNat = useMemo(() => (user?.owners || []).filter(o => o.type === "natural"), [user]);
  const allOwners = useMemo(() => [...ownersJur, ...ownersNat], [ownersJur, ownersNat]);

  // Default: si viene initialOwnerId desde el padre (ej: salto desde Vista Familiar),
  // lo usa. Si no, prioriza jurídica, fallback a natural.
  const [selectedOwnerId, setSelectedOwnerId] = useState(
    (initialOwnerId && allOwners.find(o => o.id === initialOwnerId)?.id) || allOwners[0]?.id || ""
  );

  // Si el padre cambia initialOwnerId (ej: user clickea otro owner desde Vista
  // Familiar mientras este componente ya está montado), actualizar la selección.
  useEffect(() => {
    if (initialOwnerId && allOwners.find(o => o.id === initialOwnerId)) {
      setSelectedOwnerId(initialOwnerId);
    }
  }, [initialOwnerId]);
  const [ano, setAno] = useState(2025);
  const [editingRenglon, setEditingRenglon] = useState(null);
  const [editValue, setEditValue] = useState("");
  // Sesión 28-abr-2026 noche: state para tips contextuales expandibles.
  // Cuando el user hace click en 💡 de un renglón, se expande su tip educativo.
  const [showTipFor, setShowTipFor] = useState(null);
  // Sesión 29-abr-2026: state para alternar entre vista amigable (default)
  // y vista técnica (modo experto / tabla DIAN). Por defecto FALSE: el user
  // ve primero la pantalla conversacional. Solo si clickea "Ver detalle
  // completo" entra al modo experto.
  const [modoExperto, setModoExperto] = useState(false);
  // Sesión 29-abr-2026: state para mostrar el wizard tipo TurboTax. Cuando
  // está abierto, oculta todo el resto del componente y muestra solo el
  // wizard (UX inmersiva, 1 pregunta por pantalla).
  const [wizardAbierto, setWizardAbierto] = useState(false);
  // Sesión 29-abr-2026 (Fase 4): state para mostrar el chat con el Agente
  // Tributario IA. Cuando está abierto, oculta todo el resto y muestra solo
  // el chat (UX inmersiva igual que el wizard).
  const [chatAbierto, setChatAbierto] = useState(false);
  // Sesión 29-abr-2026: feedback Santiago sobre experiencia para usuarios
  // no-técnicos. Default ahora es 'simple' — tabla DIAN técnica queda
  // detrás de un botón "Ver el cálculo paso a paso (modo experto)".
  const [viewMode, setViewMode] = useState("simple"); // 'simple' | 'detalle'

  // State para modal "Aplicar oportunidad" (sesión 1-may-2026: conexión de los
  // botones que estaban como PRÓXIMAMENTE en VistaSimple a las funcionalidades
  // reales que ya existen en el motor).
  const [oportunidadActiva, setOportunidadActiva] = useState(null);
  // Toggle de la sección expandida de oportunidades
  const [mostrarOportunidades, setMostrarOportunidades] = useState(false);

  const selectedOwner = allOwners.find(o => o.id === selectedOwnerId);
  const isJuridica = selectedOwner?.type === "juridica";
  const formulario = isJuridica ? "F-110" : "F-210";

  // Generar renglones según tipo de owner
  const renglones = useMemo(() => {
    if (!selectedOwner) return null;
    return isJuridica
      ? generarBorradorF110(user, selectedOwner, estimacion, ano)
      : generarBorradorF210(user, selectedOwner, estimacion, ano);
  }, [user, selectedOwner, estimacion, ano, isJuridica]);

  // Oportunidades del owner seleccionado (sesión 1-may-2026: para conectar
  // el botón "¿Cómo pago menos?" de VistaSimple). El motor ya genera todas
  // las palancas relevantes — solo filtramos por owner activo y ahorro > 0.
  const oportunidadesOwner = useMemo(() => {
    if (!user || !estimacion || !selectedOwner) return [];
    return generarRecomendaciones(user, estimacion)
      .filter(r => r.ownerId === selectedOwner.id || r.ownerName === selectedOwner.name)
      .filter(r => (r.ahorroAnualEstimado || 0) > 0)
      .sort((a, b) => (b.ahorroAnualEstimado || 0) - (a.ahorroAnualEstimado || 0));
  }, [user, estimacion, selectedOwner]);
  const ahorroTotalOwner = oportunidadesOwner.reduce((s, o) => s + (o.ahorroAnualEstimado || 0), 0);

  // Secciones según tipo
  const SECCIONES = isJuridica ? SECCIONES_F110 : SECCIONES_F210;
  const seccionesOrden = isJuridica
    ? ["patrimonio", "ingresos", "costos", "renta", "impuesto", "liquidacion"]
    : ["patrimonio", "trabajo", "deducciones", "capital", "noLaboral", "dividendos", "rentaTotal", "impuesto", "liquidacion"];

  // ─────────────────────────────────────────────────────────────────────
  // WIZARD TURBOTAX: si está abierto, ocultar todo el resto y mostrar
  // solo el wizard (UX inmersiva con 1 pregunta por pantalla). Importante:
  // este check va PRIMERO, antes del check de owners, porque el wizard
  // ─────────────────────────────────────────────────────────────────────
  // VISTA WIZARD: Cuando user clickea "Modo paso a paso" desde la pantalla
  // amigable, se abre el wizard inmersivo (1 pregunta por pantalla).
  // ─────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────
  // CHAT AGENTE TRIBUTARIO: si está abierto, ocultar todo y mostrar solo
  // el chat (UX inmersiva 1-a-1 con la IA, igual lógica que el wizard).
  // ─────────────────────────────────────────────────────────────────────
  if (chatAbierto) {
    return (
      <ChatAgenteTributario
        user={user}
        estimacion={estimacion}
        selectedOwner={selectedOwner}
        userId={user?.id || user?.userId || null}
        onCerrar={() => setChatAbierto(false)}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // WIZARD TRIBUTARIO: si está abierto, ocultar todo el resto y mostrar
  // solo el wizard (UX inmersiva con 1 pregunta por pantalla).
  //
  // Garantía importante: el wizard necesita un owner natural existente.
  // Si el user no tiene ninguno, creamos uno temporalmente antes de abrir.
  // ─────────────────────────────────────────────────────────────────────
  if (wizardAbierto) {
    // El wizard usa el owner SELECCIONADO en el Auditor IA (natural o jurídica).
    // Antes (BUG): siempre forzaba al primer owner natural, ignorando la
    // selección del user. Resultado: si el user seleccionaba Lagoon (jurídica)
    // y abría el wizard, le hacía preguntas de persona natural ('¿cómo te
    // pagaron?', '¿tenés dependientes?') aplicadas a una SAS — absurdo.

    let ownerIdParaWizard = selectedOwnerId;

    // Si por algún motivo no hay owner seleccionado válido, fallback:
    // primero buscar owner natural, luego cualquiera, luego crear uno.
    if (!ownerIdParaWizard || !allOwners.find(o => o.id === ownerIdParaWizard)) {
      ownerIdParaWizard = (allOwners.find(o => o.type === "natural") || allOwners[0])?.id;
    }

    if (!ownerIdParaWizard) {
      // No hay NINGÚN owner: crear uno natural temporal y persistir
      const nuevoOwner = {
        id: "own_wizard_" + Date.now(),
        name: "Yo (persona natural)",
        type: "natural",
        fiscalProfile: {},
      };
      const newUser = { ...user, owners: [...(user?.owners || []), nuevoOwner] };
      setTimeout(() => onUpdateUser(newUser), 0);
      return (
        <div style={{ padding: 40, textAlign: "center", color: T.txt2 }}>
          Preparando el wizard...
        </div>
      );
    }

    return (
      <WizardTributario
        user={user}
        selectedOwnerId={ownerIdParaWizard}
        onUpdateUser={(newUser) => {
          onUpdateUser(newUser);
        }}
        onCambiarOwner={(nuevoId) => setSelectedOwnerId(nuevoId)}
        onClose={() => {
          setWizardAbierto(false);
          // Tras completar, dejar al user en la vista amigable
          setModoExperto(false);
        }}
      />
    );
  }

  if (allOwners.length === 0) {
    return (
      <div style={{ padding: "24px 0" }}>
        {/* Header del Agente Tributario IA — alto contraste */}
        <div style={{ marginBottom: 20, padding: "24px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 36 }}>🤖</span>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
                Agente Tributario IA
              </h2>
              <div style={{ fontSize: 13, color: T.txt2, fontWeight: 500, marginTop: 4 }}>
                Tu copiloto fiscal — te explica y acompaña paso a paso
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "32px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: T.txt, marginBottom: 12 }}>
            ¿Es tu primera vez? Empecemos juntos
          </h3>
          <p style={{ fontSize: 15, color: T.txt2, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 24px" }}>
            Te voy a hacer unas <strong style={{ color: T.txt }}>preguntas simples</strong> sobre
            tu año (5-10 minutos). No necesitás saber nada de impuestos: te explico cada cosa
            en el camino. Al final tenés un borrador para validar con tu contador.
          </p>
          <button
            onClick={() => setWizardAbierto(true)}
            style={{
              padding: "14px 28px",
              background: T.green,
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            🪄 Empezar paso a paso
          </button>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 16 }}>
            Si preferís cargar datos manualmente, andá a Configuración → Owners fiscales.
          </div>
        </div>
      </div>
    );
  }

  if (!renglones) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.txt3 }}>
        Cargando borrador...
      </div>
    );
  }

  // Persistir override
  const persistirOverride = (numero, valor) => {
    const overrides = { ...(user?.borradorDeclaracion || {}) };
    if (!overrides[selectedOwnerId]) overrides[selectedOwnerId] = {};
    if (!overrides[selectedOwnerId][ano]) overrides[selectedOwnerId][ano] = {};

    if (valor === null || valor === "" || valor === undefined) {
      delete overrides[selectedOwnerId][ano][numero];
      // Limpiar año/owner si quedó vacío
      if (Object.keys(overrides[selectedOwnerId][ano]).length === 0) {
        delete overrides[selectedOwnerId][ano];
      }
      if (Object.keys(overrides[selectedOwnerId]).length === 0) {
        delete overrides[selectedOwnerId];
      }
    } else {
      overrides[selectedOwnerId][ano][numero] = Number(valor);
    }

    onUpdateUser({ ...user, borradorDeclaracion: overrides });
  };

  const handleEditar = (renglon) => {
    setEditingRenglon(renglon.numero);
    setEditValue(String(Math.round(renglon.valor || 0)));
  };

  const handleGuardarEdit = () => {
    persistirOverride(editingRenglon, editValue);
    setEditingRenglon(null);
    setEditValue("");
  };

  const handleResetear = (numero) => {
    persistirOverride(numero, null);
    setEditingRenglon(null);
  };

  const handleResetTodos = () => {
    if (!confirm("¿Resetear TODOS los overrides de este borrador? Los renglones volverán a calcularse desde tus datos cargados.")) return;
    const overrides = { ...(user?.borradorDeclaracion || {}) };
    if (overrides[selectedOwnerId]) {
      delete overrides[selectedOwnerId][ano];
      if (Object.keys(overrides[selectedOwnerId]).length === 0) {
        delete overrides[selectedOwnerId];
      }
    }
    onUpdateUser({ ...user, borradorDeclaracion: overrides });
  };

  // Conteo de overrides activos
  const overridesCount = Object.keys(user?.borradorDeclaracion?.[selectedOwnerId]?.[ano] || {}).length;

  // Saldo final destacado
  const saldoFinal = renglones.find(r => r.numero === 113)?.valor || 0;
  const totalRetenciones = renglones.find(r => r.numero === 107)?.valor || 0;
  const impuestoCargo = renglones.find(r => r.numero === 99)?.valor || 0;

  // Agrupar renglones por sección (usa seccionesOrden dinámico según tipo de owner)
  const renglonesPorSeccion = seccionesOrden.map(sec => ({
    seccion: sec,
    info: SECCIONES[sec],
    items: renglones.filter(r => r.seccion === sec),
  }));

  // ─────────────────────────────────────────────────────────────────────
  // VISTA POR DEFECTO: pantalla amigable conversacional.
  // Solo si el user clickea "Ver formulario completo" entra al modo experto
  // (la tabla DIAN técnica con todos los renglones editables).
  // ─────────────────────────────────────────────────────────────────────
  if (!modoExperto) {
    return (
      <AgenteTributarioBienvenida
        user={user}
        selectedOwner={selectedOwner}
        estimacion={estimacion}
        onVerFormulario={() => setModoExperto(true)}
        onCambiarOwner={(id) => setSelectedOwnerId(id)}
        onAbrirWizard={() => setWizardAbierto(true)}
        onAbrirChat={() => setChatAbierto(true)}
        onUpdateUser={onUpdateUser}
        ano={ano}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODO EXPERTO: tabla F-110/F-210 con renglones editables (vista técnica).
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 0" }}>
      {/* Botón "Volver" prominente — siempre visible al top para no dejar al user encerrado */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <button
          onClick={() => setModoExperto(false)}
          style={{
            background: "#22c55e",
            border: "1.5px solid #22c55e",
            color: "#000",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← Volver al Auditor IA
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => exportarBorradorPDF(user, selectedOwner, estimacion, ano)}
            style={{
              background: "#7c3aed",
              border: "1.5px solid #7c3aed",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Descargar PDF profesional para enviar a tu contador"
          >
            📄 Descargar PDF
          </button>
          <div style={{ fontSize: 11, color: T.txt3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            📋 Modo Experto
          </div>
        </div>
      </div>
      {/* Header con branding "Agente Tributario IA" — alto contraste para legibilidad */}
      <div style={{ marginBottom: 20, padding: "24px 28px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 36 }}>🤖</span>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: T.txt, margin: 0, lineHeight: 1.2 }}>
              Modo experto · Formulario <TerminoTributario clave={isJuridica ? "f110" : "f210"}>{formulario}</TerminoTributario>
            </h2>
            <div style={{ fontSize: 13, color: T.txt2, fontWeight: 500, marginTop: 4 }}>
              Tu copiloto fiscal — te explica y acompaña paso a paso
            </div>
          </div>
        </div>
        <p style={{ fontSize: 15, color: T.txt, lineHeight: 1.6, marginTop: 0, marginBottom: 0 }}>
          Acá te ayudamos a <strong>entender y preparar tu declaración de renta</strong>. Tomamos los datos que
          ya cargaste, te explicamos en lenguaje simple cada parte, y al final tenés un borrador que{" "}
          <strong>tu contador puede revisar y ajustar</strong>. No tenés que ser experto: el agente te
          orienta en cada paso.
        </p>
      </div>

      {/* Disclaimer — claro pero no intimidatorio */}
      <div style={{ marginBottom: 20, padding: "16px 20px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.orange}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.6 }}>
            <strong style={{ color: T.orange, fontSize: 15, display: "block", marginBottom: 4 }}>
              Esto es un borrador, no la declaración final
            </strong>
            Te ayudamos a entender y proyectar tu declaración, pero <strong>tu contador siempre debe
            revisarla y firmarla antes de enviarla a la DIAN</strong>. FINPATHIA es una herramienta de
            apoyo, no reemplaza al asesor profesional.
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          VISTA SIMPLE (default) — Para usuarios no técnicos
          Lenguaje conversacional, números grandes, cero tecnicismos.
          ════════════════════════════════════════════════════════════════ */}
      {viewMode === "simple" && (
        <VistaSimple
          owner={selectedOwner}
          renglones={renglones}
          isJuridica={isJuridica}
          allOwners={allOwners}
          selectedOwnerId={selectedOwnerId}
          setSelectedOwnerId={setSelectedOwnerId}
          ano={ano}
          setAno={setAno}
          onVerDetalle={() => setViewMode("detalle")}
          oportunidadesOwner={oportunidadesOwner}
          ahorroTotalOwner={ahorroTotalOwner}
          mostrarOportunidades={mostrarOportunidades}
          setMostrarOportunidades={setMostrarOportunidades}
          onAplicarOportunidad={(opo) => setOportunidadActiva(opo)}
          onCompartirPDF={() => exportarBorradorPDF(user, selectedOwner, estimacion, ano)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════
          VISTA DETALLE (modo experto) — Tabla DIAN técnica con renglones
          Solo visible cuando el user explícitamente la pide.
          ════════════════════════════════════════════════════════════════ */}
      {viewMode === "detalle" && (
        <>
          {/* Botón de volver al modo simple */}
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={() => setViewMode("simple")}
              style={{
                background: T.bg3,
                border: `1px solid ${T.border}`,
                color: T.txt,
                padding: "10px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ← Volver a la vista simple
            </button>
            <div style={{ fontSize: 12, color: T.txt3, fontWeight: 600 }}>
              📊 Modo experto · Formulario {formulario} oficial DIAN
            </div>
          </div>
      {!isJuridica ? (
        <div style={{ marginBottom: 20, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.green}`, borderRadius: 12 }}>
          <div style={{ fontSize: 16, color: T.txt, fontWeight: 700, marginBottom: 10 }}>
            👤 ¿Cómo funciona tu declaración?
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            En Colombia, las personas naturales pagamos impuesto según el tipo de plata que recibimos.
            La ley separa tus ingresos en <strong>"cédulas"</strong> (categorías) y cada una se calcula
            por separado:
          </div>
          <ul style={{ margin: "12px 0 0 0", paddingLeft: 22, color: T.txt, fontSize: 14, lineHeight: 1.8 }}>
            <li><strong>💼 Lo que ganaste con tu trabajo:</strong> sueldo, honorarios. Acá podés descontar cosas como medicina, vivienda, dependientes.</li>
            <li><strong>📈 Lo que ganaste con tu plata:</strong> intereses de CDT o cuentas. La ley te exime ~50% por inflación (es bastante).</li>
            <li><strong>🏠 Arriendos que cobraste:</strong> si tenés inmuebles arrendados.</li>
            <li><strong>📊 Dividendos:</strong> si te pagó plata una empresa donde sos socio.</li>
          </ul>
          <div style={{ marginTop: 14, padding: "10px 14px", background: T.bg3, borderRadius: 8, fontSize: 13, color: T.txt, lineHeight: 1.5 }}>
            💡 <strong>Tip:</strong> tocá el botón <span style={{ background: T.purple, padding: "2px 7px", borderRadius: 4, color: "#fff", fontWeight: 700, fontSize: 11 }}>💡</span> de cualquier fila para que te explique
            qué significa cada cosa, cuánto te conviene y por qué.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20, padding: "20px 24px", background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `4px solid ${T.purple}`, borderRadius: 12 }}>
          <div style={{ fontSize: 16, color: T.txt, fontWeight: 700, marginBottom: 10 }}>
            🏢 ¿Cómo funciona la declaración de tu empresa?
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            Las empresas pagan impuesto sobre la <strong>utilidad</strong> (lo que les sobra después de
            gastos). La fórmula simple es:
          </div>
          <div style={{ margin: "14px 0", padding: "12px 18px", background: T.bg3, borderRadius: 8, fontSize: 14, color: T.txt, fontWeight: 600, textAlign: "center" }}>
            Ingresos − Gastos = Utilidad &nbsp;→&nbsp; Impuesto = Utilidad × 35%
          </div>
          <div style={{ fontSize: 14, color: T.txt, lineHeight: 1.7 }}>
            Hay <strong>palancas legales</strong> que la ley permite para reducir el impuesto. Las más
            comunes: provisión de cartera, capacitación certificada (descuenta 175%), IVA de activos
            productivos, depreciación de inmuebles arrendados. El agente las detecta automáticamente
            cuando aplican.
          </div>
        </div>
      )}

      {/* Selector owner + año */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Owner fiscal · Formulario {formulario}</label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13, minWidth: 240 }}
            >
              {allOwners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.type === "juridica" ? "🏢" : "👤"} {o.name} · {o.type === "juridica" ? "F-110" : "F-210"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Año gravable</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", color: T.txt, fontSize: 13 }}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {overridesCount > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: T.purple, fontWeight: 600 }}>
                ✏️ {overridesCount} override{overridesCount > 1 ? "s" : ""} activo{overridesCount > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleResetTodos}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
              >
                ↺ Resetear todos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resumen final destacado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <ResumenCard label="Impuesto a cargo" value={impuestoCargo} color={T.red} />
        <ResumenCard label="Total retenciones" value={totalRetenciones} color={T.green} prefix="-" />
        <ResumenCard label="Saldo a pagar (mayo)" value={saldoFinal} color={T.blue} bold />
      </div>

      {/* Tabla de renglones por sección */}
      {renglonesPorSeccion.map(({ seccion, info, items }) => (
        <div key={seccion} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: info.color, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>{info.icon}</span>
            <span>{info.label}</span>
          </div>
          <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {items.map((r, i) => {
              const isEditing = editingRenglon === r.numero;
              const isFormula = r.tipo === "formula";
              const hasOverride = !isFormula && Math.abs((r.valor || 0) - (r.auto || 0)) > 0.01;

              return (
                <div
                  key={r.numero}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto auto",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none",
                    background: r.destacado ? "rgba(59,130,246,0.04)" : "transparent",
                    gap: 12,
                  }}
                >
                  {/* Número renglón */}
                  <div style={{ fontSize: 11, color: T.txt3, fontWeight: 600, fontFamily: "monospace" }}>
                    {r.numero}
                  </div>

                  {/* Concepto */}
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: r.destacado ? T.txt : T.txt2,
                        fontWeight: r.destacado ? 700 : 500,
                        lineHeight: 1.4,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                      title={r.fuente ? "Viene de: " + r.fuente : ""}
                    >
                      <span>{r.concepto}</span>
                      {r.articulo && (
                        <span style={{ fontSize: 10, color: T.txt3, fontWeight: 500 }}>
                          ({r.articulo})
                        </span>
                      )}
                      {r.tip && (
                        <button
                          onClick={() => setShowTipFor(showTipFor === r.numero ? null : r.numero)}
                          style={{
                            background: showTipFor === r.numero ? "rgba(168,85,247,0.2)" : "transparent",
                            border: `1px solid ${showTipFor === r.numero ? T.purple : T.border}`,
                            color: T.purple,
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                          title="Ver tip educativo"
                        >
                          💡
                        </button>
                      )}
                    </div>
                    {r.fuente && !isFormula && (
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 2, fontStyle: "italic" }}>
                        ↳ {r.fuente}
                      </div>
                    )}
                    {/* Tip expandido */}
                    {r.tip && showTipFor === r.numero && (
                      <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
                        <span style={{ color: T.purple, fontWeight: 700, fontSize: 11, marginRight: 6 }}>💡 TIP:</span>
                        {r.tip}
                      </div>
                    )}
                  </div>

                  {/* Valor */}
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleGuardarEdit();
                          if (e.key === "Escape") setEditingRenglon(null);
                        }}
                        style={{ width: 160, background: T.bg3, border: `1px solid ${T.purple}`, borderRadius: 6, padding: "6px 10px", color: T.txt, fontSize: 13, textAlign: "right" }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      fontSize: r.destacado ? 15 : 13,
                      color: isFormula ? T.txt : (hasOverride ? T.purple : T.txt2),
                      fontWeight: r.destacado ? 800 : (hasOverride ? 700 : 500),
                      textAlign: "right",
                      fontFamily: "monospace",
                      minWidth: 160,
                    }}>
                      {hasOverride && <span style={{ fontSize: 11, marginRight: 4 }}>✏️</span>}
                      {fm(r.valor)}
                    </div>
                  )}

                  {/* Acción */}
                  <div style={{ minWidth: 90, textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={handleGuardarEdit}
                          style={{ background: T.green, color: "#000", border: "none", padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingRenglon(null)}
                          style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt2, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer" }}
                        >
                          ✕
                        </button>
                        {hasOverride && (
                          <button
                            onClick={() => handleResetear(r.numero)}
                            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.txt3, padding: "5px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer" }}
                            title="Volver a valor automático"
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    ) : isFormula ? (
                      <span style={{ fontSize: 11, color: T.txt3, fontWeight: 600 }}>Σ</span>
                    ) : (
                      <button
                        onClick={() => handleEditar(r)}
                        style={{ background: "transparent", border: `1px solid ${T.border}`, color: hasOverride ? T.purple : T.txt2, padding: "5px 10px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                      >
                        ✏️ {hasOverride ? "Editado" : "Editar"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer info */}
      <div style={{ marginTop: 24, padding: 16, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.6 }}>
          <strong style={{ color: T.txt }}>💡 ¿Cómo usar este borrador?</strong>
          <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, color: T.txt3 }}>
            <li>Los <strong style={{ color: T.txt2 }}>valores en gris</strong> vienen automáticamente de tus datos cargados (ingresos, gastos, inversiones, deudas)</li>
            <li>Los renglones <strong style={{ color: T.purple }}>en púrpura con ✏️</strong> son ediciones manuales tuyas o de tu contador</li>
            <li>Los <strong style={{ color: T.txt2 }}>totales (Σ)</strong> se recalculan automáticamente cuando cambia algún valor</li>
            <li>Tu contador puede ajustar cualquier renglón antes de presentar a DIAN (ej: gastos no cargados, sanciones, anticipos)</li>
            <li>El export PDF para enviar a tu contador llegará en próxima actualización</li>
          </ul>
        </div>
      </div>
        </>
      )}

      {/* Modal de aplicación de oportunidad — se abre desde VistaSimple
          cuando el user clickea "⚡ Aplicar →" en una oportunidad detectada
          (sesión 1-may-2026: conexión del botón "¿Cómo pago menos?" placeholder
          a la funcionalidad real). */}
      {oportunidadActiva && (
        <AplicarOportunidadModal
          oportunidad={oportunidadActiva}
          user={user}
          onClose={() => setOportunidadActiva(null)}
          onUpdateUser={(newUser) => {
            onUpdateUser(newUser);
            setOportunidadActiva(null);
          }}
        />
      )}
    </div>
  );
}

function ResumenCard({ label, value, color, prefix = "", bold = false }) {
  return (
    <div style={{
      background: T.bg2,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      padding: "12px 16px",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: bold ? 22 : 18, fontWeight: bold ? 800 : 700, color, fontFamily: "monospace" }}>
        {prefix}{fm(value)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VistaSimple — Pantalla amigable para usuarios no técnicos
//
// FILOSOFÍA:
//   - Cero tecnicismos. Todo en lenguaje cotidiano.
//   - Foco en LO QUE TE PASA (no en cómo se calcula).
//   - 1-3 números grandes, no tablas.
//   - Acciones claras: "Ver cómo se calcula" / "Ideas para pagar menos"
//
// Inspiración: TurboTax muestra "Tax Refund: $2,847" como hero antes
// de cualquier formulario. Acá hacemos lo mismo con saldo a pagar.
// ═══════════════════════════════════════════════════════════════════════════
function VistaSimple({ owner, renglones, isJuridica, allOwners, selectedOwnerId, setSelectedOwnerId, ano, setAno, onVerDetalle, oportunidadesOwner = [], ahorroTotalOwner = 0, mostrarOportunidades = false, setMostrarOportunidades = () => {}, onAplicarOportunidad = () => {}, onCompartirPDF = () => {} }) {
  // Extraer los números clave para mostrar conversacionalmente
  const findVal = (num) => renglones.find(r => r.numero === num)?.valor || 0;

  const ingresoTotal = isJuridica ? findVal(58) : (findVal(34) + findVal(50) + findVal(60) + findVal(70) + findVal(71));
  const impuestoTotal = isJuridica ? findVal(99) : findVal(91);
  const retenciones = isJuridica ? findVal(107) : findVal(102);
  const saldoFinal = isJuridica ? findVal(113) : findVal(113);

  // Tasa efectiva
  const tasaEfectiva = ingresoTotal > 0 ? (impuestoTotal / ingresoTotal * 100) : 0;

  const nombreOwner = owner?.name || (isJuridica ? "tu sociedad" : "vos");

  return (
    <div>
      {/* Selector de owner — pero más amigable */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 13, color: T.txt2, fontWeight: 600, marginBottom: 8 }}>
          ¿De quién querés ver la declaración?
        </label>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", color: T.txt, fontSize: 15, fontWeight: 600, minWidth: 280 }}
          >
            {allOwners.map(o => (
              <option key={o.id} value={o.id}>
                {o.type === "juridica" ? "🏢" : "👤"} {o.name}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", color: T.txt, fontSize: 15, fontWeight: 600 }}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>Año {y}</option>)}
          </select>
        </div>
      </div>

      {/* HERO: Card grande con saldo final + explicación humana */}
      <div style={{
        marginBottom: 20,
        padding: "32px 28px",
        background: "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(168,85,247,0.06) 100%)",
        border: `2px solid ${T.blue}`,
        borderRadius: 16,
      }}>
        <div style={{ fontSize: 14, color: T.txt2, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {isJuridica ? "🏢" : "👤"} Resumen para {nombreOwner} · Año {ano}
        </div>
        <div style={{ fontSize: 16, color: T.txt, marginBottom: 6, fontWeight: 500 }}>
          Lo que tendrías que pagar {isJuridica ? "tu empresa" : "vos"} en mayo:
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: T.txt, lineHeight: 1.1, marginBottom: 12, fontFamily: "monospace" }}>
          {fm(saldoFinal)}
        </div>
        <div style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6 }}>
          {saldoFinal > 0 ? (
            <>Esto es <strong style={{ color: T.txt }}>una estimación</strong> según los datos que cargaste.
            Si todo lo que ingresaste es correcto, este es el valor que tu contador validaría antes de presentar
            la declaración.</>
          ) : (
            <>Según los datos que cargaste, no te tocaría pagar nada en mayo. Aún así, validá esto con tu
            contador antes de presentar la declaración.</>
          )}
        </div>
      </div>

      {/* 3 cards de explicación: cuánto ganaste, impuesto bruto, retenciones, saldo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
        <CardSimple
          icon="💰"
          label={isJuridica ? "Lo que ingresó la empresa" : "Lo que ganaste"}
          value={ingresoTotal}
          color={T.green}
          explica={isJuridica
            ? "Total de ventas + intereses + arriendos + dividendos durante el año."
            : "Sueldo, honorarios, intereses, arriendos y dividendos sumados."}
        />
        <CardSimple
          icon="🧾"
          label="Impuesto que te toca"
          value={impuestoTotal}
          color={T.red}
          explica={isJuridica
            ? `35% sobre la utilidad gravable (${tasaEfectiva.toFixed(1)}% real sobre ingresos).`
            : `Calculado con la tabla progresiva DIAN. Tasa efectiva ${tasaEfectiva.toFixed(1)}% sobre ingresos.`}
        />
        <CardSimple
          icon="✅"
          label="Lo que ya pagaste"
          value={retenciones}
          color={T.blue}
          explica="Retenciones que el banco, empleador o inquilinos descontaron durante el año. Esto se resta del impuesto."
          esResta
        />
        <CardSimple
          icon="📅"
          label="Lo que falta pagar"
          value={saldoFinal}
          color={T.purple}
          explica="= Impuesto que te toca − lo que ya pagaste durante el año. Se paga en mayo."
          destacado
        />
      </div>

      {/* Acciones siguientes */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 14 }}>
          ¿Qué querés hacer ahora?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <button
            onClick={onVerDetalle}
            style={{
              background: T.bg3,
              border: `2px solid ${T.blue}`,
              borderRadius: 12,
              padding: "16px 18px",
              cursor: "pointer",
              textAlign: "left",
              color: T.txt,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59,130,246,0.10)"}
            onMouseLeave={(e) => e.currentTarget.style.background = T.bg3}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              Ver el cálculo paso a paso
            </div>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
              El detalle técnico del formulario {isJuridica ? "F-110" : "F-210"} con cada renglón editable. Para cuando tu contador quiere revisar.
            </div>
          </button>

          <button
            onClick={() => setMostrarOportunidades(!mostrarOportunidades)}
            disabled={oportunidadesOwner.length === 0}
            title={oportunidadesOwner.length === 0
              ? "No detectamos oportunidades adicionales — ya estás optimizado"
              : `${oportunidadesOwner.length} formas legales de pagar menos detectadas`}
            style={{
              background: oportunidadesOwner.length > 0 ? T.bg3 : T.bg3,
              border: `2px solid ${oportunidadesOwner.length > 0 ? "#22c55e" : T.border}`,
              borderRadius: 12,
              padding: "16px 18px",
              cursor: oportunidadesOwner.length > 0 ? "pointer" : "not-allowed",
              textAlign: "left",
              color: T.txt,
              opacity: oportunidadesOwner.length > 0 ? 1 : 0.5,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (oportunidadesOwner.length > 0) e.currentTarget.style.background = "rgba(34,197,94,0.08)";
            }}
            onMouseLeave={(e) => {
              if (oportunidadesOwner.length > 0) e.currentTarget.style.background = T.bg3;
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }}>💡</span>
              ¿Cómo pago menos?
              {oportunidadesOwner.length > 0 && (
                <span style={{ fontSize: 11, background: "#22c55e", color: "#000", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                  {oportunidadesOwner.length} {oportunidadesOwner.length === 1 ? "oportunidad" : "oportunidades"}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
              {oportunidadesOwner.length === 0
                ? "Por ahora no hay palancas adicionales. Estás bien optimizado o no tenés saldo a cargo."
                : `Detectamos ${oportunidadesOwner.length} ${oportunidadesOwner.length === 1 ? "forma legal" : "formas legales"} de bajar tu impuesto. Ahorro estimado: ${"$" + Math.round(ahorroTotalOwner).toLocaleString("es-CO")}/año.`}
            </div>
          </button>

          <button
            onClick={onCompartirPDF}
            style={{
              background: T.bg3,
              border: `2px solid ${T.purple}`,
              borderRadius: 12,
              padding: "16px 18px",
              cursor: "pointer",
              textAlign: "left",
              color: T.txt,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(196,181,253,0.10)"}
            onMouseLeave={(e) => e.currentTarget.style.background = T.bg3}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              Compartir con mi contador
            </div>
            <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5 }}>
              Descargá un PDF con el resumen + detalle del formulario {isJuridica ? "F-110" : "F-210"} para enviar a tu contador.
            </div>
          </button>
        </div>

        {/* ─── SECCIÓN OPORTUNIDADES (expandible) ───
            Aparece cuando user clickea "¿Cómo pago menos?" y hay
            oportunidades reales. Cada card tiene CTA "Aplicar" que
            dispara el modal de aplicación.  */}
        {mostrarOportunidades && oportunidadesOwner.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.txt2, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
              💡 Formas legales de pagar menos · {oportunidadesOwner.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {oportunidadesOwner.slice(0, 5).map((opo, i) => {
                const codigo = opo.code || opo.codigo;
                const aplicable = codigo && [
                  "APORTAR_PV_AFC",
                  "DEPENDIENTES_NO_DECLARADOS",
                  "SALUD_PREPAGADA_NO_REGISTRADA",
                ].includes(codigo);
                const ahorro = opo.ahorroAnualEstimado || 0;
                return (
                  <div key={opo.code || i} style={{
                    padding: "14px 16px",
                    background: T.bg3,
                    border: `1px solid ${T.border}`,
                    borderLeft: `4px solid #22c55e`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "rgba(34,197,94,0.15)", color: "#22c55e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, lineHeight: 1.3 }}>
                        {opo.titulo || opo.recomendacion || "Oportunidad"}
                      </div>
                      <div style={{ fontSize: 12, color: T.txt2, marginTop: 4, lineHeight: 1.4 }}>
                        {opo.descripcion || ""}
                      </div>
                      {opo.base && (
                        <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, fontStyle: "italic" }}>
                          Base legal: {opo.base}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: T.txt3 }}>Te ahorrás</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>
                        {"$" + Math.round(ahorro).toLocaleString("es-CO")}
                      </div>
                      <div style={{ fontSize: 10, color: T.txt3, marginTop: 2 }}>al año</div>
                    </div>
                    {aplicable ? (
                      <button
                        onClick={() => onAplicarOportunidad(opo)}
                        style={{
                          padding: "9px 14px",
                          background: "#22c55e",
                          border: "none",
                          borderRadius: 8,
                          color: "#000",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        ⚡ Aplicar →
                      </button>
                    ) : (
                      <div style={{
                        padding: "9px 14px",
                        background: "transparent",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        color: T.txt3,
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}>
                        Configurar manualmente
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Mensaje final tranquilizador */}
      <div style={{ marginTop: 20, padding: "16px 20px", background: "rgba(34,197,94,0.06)", border: `1px solid rgba(34,197,94,0.20)`, borderRadius: 10, fontSize: 14, color: T.txt, lineHeight: 1.6 }}>
        💬 <strong>¿Tenés dudas?</strong> El número de arriba es solo una estimación. Tu contador es quien
        firma y presenta la declaración a DIAN. Si nunca declaraste, no te preocupes: con este resumen y la
        ayuda de un contador, lo manejás tranquilo.
      </div>
    </div>
  );
}

// Card simple para mostrar una métrica con su explicación
function CardSimple({ icon, label, value, color, explica, esResta = false, destacado = false }) {
  return (
    <div style={{
      background: T.bg2,
      border: `1px solid ${destacado ? color : T.border}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 13, color: T.txt2, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace", marginBottom: 8 }}>
        {esResta && value > 0 ? "−" : ""}{fm(value)}
      </div>
      <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5 }}>
        {explica}
      </div>
    </div>
  );
}
