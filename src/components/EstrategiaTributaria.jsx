// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · EstrategiaTributaria.jsx
//
// REDISEÑO STRATEGY-FIRST · Sesión 30-abr-2026
//
// PROBLEMA QUE RESUELVE:
//   La sección "Impuestos" tenía un cognitive overload: 4 tabs (Borrador,
//   Auditor IA, Vista Familiar, Declaraciones), un stepper visual, banner
//   explicativo de "2 pasos", y debajo recién aparecía el contenido. El user
//   no-contador entraba y tenía que decidir entre 4 caminos antes de
//   responder a su única pregunta real: "¿cuánto tengo que pagar?".
//
// PRINCIPIO DE DISEÑO:
//   "El user viene con UNA pregunta. Respondela primero. El resto es opcional."
//
//   Por eso esta pantalla ELIMINA las tabs y presenta una vista unificada que:
//
//   1. RESPONDE primero la pregunta del impuesto (lo más grande visualmente)
//   2. MUESTRA oportunidades concretas en lenguaje humano
//   3. ALERTA si hay datos por confirmar
//   4. OFRECE accesos secundarios (detalle técnico, PDF, chat) como CTAs
//      pequeños abajo, no como navegación principal
//
// LO QUE NO ESTÁ ACÁ (intencional):
//   - Modo experto F-110/F-210 (un click de distancia, botón "Ver detalle")
//   - Wizard de carga de datos (un click de distancia)
//   - Auditoría de datos detallada (se accede desde "Resolver" en alertas)
//   - Vista familiar (se accede desde un toggle si hay >1 owner)
//
// FILOSOFÍA DE LENGUAJE:
//   - "Tu situación tributaria" en vez de "Auditor IA"
//   - "Te toca pagar" en vez de "Saldo a cargo"
//   - "Te ahorrás" en vez de "Beneficio fiscal"
//   - "Resolver" en vez de "Auditoría de datos"
//   - "Ver el detalle técnico" en vez de "Modo experto F-110"
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { auditarDatos } from "../lib/auditoriaDatos.js";
import AsignarTitularMasivo from "./AsignarTitularMasivo.jsx";
import AplicarOportunidadModal from "./AplicarOportunidadModal.jsx";

const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",
  blueBg: "rgba(96,165,250,0.10)",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.10)",
};

function fm(n) {
  if (!n && n !== 0) return "$0";
  return "$" + Math.round(n).toLocaleString("es-CO");
}
function fmShort(v) {
  const n = Math.abs(Number(v) || 0);
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n);
}

/**
 * Pantalla "Strategy-First" para Impuestos.
 *
 * Es la ÚNICA pantalla que ve el user al entrar a Impuestos. Responde
 * directamente "¿cuánto pago?" sin navegación por tabs.
 *
 * @param {object} user - User completo
 * @param {object} estimacion - Output de estimarImpuesto(user)
 * @param {function} onUpdateUser - Callback para actualizar user
 * @param {function} onAbrirDetalle - Callback al click "Ver detalle técnico" (abre F-110/F-210)
 * @param {function} onAbrirWizard - Callback al click "Empezar paso a paso"
 * @param {function} onAbrirChat - Callback al click "Hablar con contador IA"
 * @param {function} onAbrirVistaFamiliar - Callback al click "Ver vista familiar" (si hay >1 owner)
 * @param {function} onAbrirDeclaracionesPrev - Callback al click "Mis declaraciones anteriores"
 * @param {number} ano - Año gravable (default 2025)
 */
export default function EstrategiaTributaria({
  user,
  estimacion,
  onUpdateUser,
  onAbrirDetalle,
  onAbrirWizard,
  onAbrirChat,
  onAbrirVistaFamiliar,
  onAbrirDeclaracionesPrev,
  ano = 2025,
}) {
  const allOwners = user?.owners || [];

  // ── Estado: owner seleccionado ──────────────────────────────────────
  const [selectedOwnerId, setSelectedOwnerId] = useState(allOwners[0]?.id || "");
  const selectedOwner = useMemo(
    () => allOwners.find(o => o.id === selectedOwnerId) || allOwners[0],
    [allOwners, selectedOwnerId]
  );
  const isJuridica = selectedOwner?.type === "juridica";
  const ownerName = selectedOwner?.name || "vos";

  // ── Datos del motor ─────────────────────────────────────────────────
  const det = useMemo(() => {
    return estimacion?.detalle?.find(d => d.name === selectedOwner?.name);
  }, [estimacion, selectedOwner]);

  // Lo que toca pagar (saldo a cargo después de retenciones)
  const saldoACargo = det?.saldoACargo ?? det?.impuesto ?? 0;
  const impuestoBruto = det?.impuesto ?? 0;
  const retenciones = det?.retefuenteNat ?? det?.retefuenteCalc ?? 0;
  const ingresoAnual = det?.ingreso ?? 0;
  const tasaEfectiva = ingresoAnual > 0 ? (impuestoBruto / ingresoAnual * 100) : 0;

  // ── Oportunidades del owner ─────────────────────────────────────────
  const oportunidades = useMemo(() => {
    if (!user || !estimacion) return [];
    return generarRecomendaciones(user, estimacion)
      .filter(r => r.ownerId === selectedOwner?.id || r.ownerName === selectedOwner?.name)
      .filter(r => (r.ahorroAnualEstimado || 0) > 0)
      .sort((a, b) => (b.ahorroAnualEstimado || 0) - (a.ahorroAnualEstimado || 0))
      .slice(0, 3); // Top 3 para no saturar
  }, [user, estimacion, selectedOwner]);

  const ahorroPotencial = oportunidades.reduce((s, o) => s + (o.ahorroAnualEstimado || 0), 0);

  // ── Hallazgos de auditoría (errores/advertencias) ──────────────────
  const hallazgos = useMemo(() => {
    if (!user) return { errores: [], advertencias: [], total: 0 };
    const audit = auditarDatos(user, { dismissed: user?.auditDismissed || [] });
    const errores = (audit.errores || []).slice(0, 3);
    const advertencias = (audit.advertencias || []).slice(0, 3);
    return { errores, advertencias, total: errores.length + advertencias.length };
  }, [user]);

  // ── Modales activos ─────────────────────────────────────────────────
  const [hallazgoActivo, setHallazgoActivo] = useState(null);
  const [oportunidadActiva, setOportunidadActiva] = useState(null);

  // ── Sin owners: estado vacío amigable ──────────────────────────────
  if (!selectedOwner) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🧾</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.txt, marginBottom: 8 }}>
          Empecemos tu estrategia tributaria
        </h1>
        <p style={{ fontSize: 15, color: C.txt2, lineHeight: 1.5, maxWidth: 480, margin: "0 auto 24px" }}>
          No tenemos datos cargados todavía. Te llevamos paso a paso a través de un wizard
          amigable que entiende tu situación y arma tu estrategia automáticamente.
        </p>
        <button
          onClick={onAbrirWizard}
          style={{
            padding: "14px 28px",
            background: "#7c3aed",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          🪄 Empezar el wizard guiado →
        </button>
      </div>
    );
  }

  // ── Render principal ────────────────────────────────────────────────
  return (
    <div style={{ padding: "8px 0" }}>
      {/* ─────────────────────────────────────────────────────────────
          BLOQUE 1: HEADER · Año + persona auditada (mínimo)
          ───────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.txt3, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
            🧾 Tu situación tributaria · Año {ano}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}>{isJuridica ? "🏢" : "👤"}</span>
            {ownerName}
            <span style={{ fontSize: 11, fontWeight: 600, color: C.txt3, padding: "3px 8px", background: C.bg3, borderRadius: 6 }}>
              {isJuridica ? "Persona jurídica" : "Persona natural"}
            </span>
          </h1>
        </div>

        {/* Selector compacto de owner si hay >1 */}
        {allOwners.length > 1 && (
          <select
            value={selectedOwnerId}
            onChange={e => setSelectedOwnerId(e.target.value)}
            style={{
              padding: "8px 12px",
              background: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.txt,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {allOwners.map(o => (
              <option key={o.id} value={o.id}>
                {o.type === "juridica" ? "🏢" : "👤"} {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BLOQUE 2: LA RESPUESTA — "¿Cuánto pago?"
          Lo más grande visualmente. Es lo que el user vino a saber.
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "32px 28px",
        background: `linear-gradient(135deg, ${C.bg2} 0%, rgba(124,58,237,0.08) 100%)`,
        border: `1.5px solid ${C.border}`,
        borderRadius: 16,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: C.txt2, marginBottom: 10, lineHeight: 1.5 }}>
          {saldoACargo > 0 ? (
            <>Por ahora, según tus datos, <strong style={{ color: C.txt }}>te toca pagar</strong> de impuesto de renta:</>
          ) : (
            <>Por ahora, <strong style={{ color: C.green }}>no te toca pagar nada</strong> de impuesto de renta. Tus retenciones cubren todo.</>
          )}
        </div>

        <div style={{
          fontSize: 56,
          fontWeight: 900,
          color: saldoACargo > 0 ? C.txt : C.green,
          lineHeight: 1,
          letterSpacing: -2,
          marginBottom: 12,
        }}>
          {fm(Math.max(0, saldoACargo))}
        </div>

        {/* Mini desglose: impuesto bruto + retenciones */}
        {ingresoAnual > 0 && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.txt3, marginTop: 8 }}>
            <span>💰 Ingresaste {fmShort(ingresoAnual)} en el año</span>
            <span>·</span>
            <span>🏛️ Impuesto calculado {fmShort(impuestoBruto)} ({tasaEfectiva.toFixed(1)}%)</span>
            {retenciones > 0 && (
              <>
                <span>·</span>
                <span>📋 Ya te retuvieron {fmShort(retenciones)}</span>
              </>
            )}
          </div>
        )}

        {/* CTA al ahorro si hay oportunidades */}
        {ahorroPotencial > 0 && saldoACargo > 0 && (
          <div style={{
            marginTop: 18,
            padding: "12px 16px",
            background: C.greenBg,
            border: `1px solid ${C.green}40`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 22 }}>💡</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>
                Detectamos cómo bajarte ese número en {fm(ahorroPotencial)}/año
              </div>
              <div style={{ fontSize: 11, color: C.txt3 }}>
                Sin trampa: son {oportunidades.length} {oportunidades.length === 1 ? "forma legal" : "formas legales"} que la ley te permite y no estás usando.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BLOQUE 3: OPORTUNIDADES (top 3 con CTAs concretos)
          ───────────────────────────────────────────────────────────── */}
      {oportunidades.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt2, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            💡 Formas legales de pagar menos
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {oportunidades.map((op, i) => (
              <OportunidadCard
                key={op.id || i}
                opo={op}
                index={i + 1}
                onAplicar={() => setOportunidadActiva(op)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BLOQUE 4: ALERTAS (datos por confirmar)
          ───────────────────────────────────────────────────────────── */}
      {hallazgos.total > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt2, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ⚠️ Cosas por revisar ({hallazgos.total})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hallazgos.errores.map((h, i) => (
              <AlertaCard key={`err-${i}`} hallazgo={h} severidad="error" onResolver={() => setHallazgoActivo(h)} />
            ))}
            {hallazgos.advertencias.map((h, i) => (
              <AlertaCard key={`warn-${i}`} hallazgo={h} severidad="advertencia" onResolver={() => setHallazgoActivo(h)} />
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BLOQUE 5: ACCIONES SECUNDARIAS (chrome bajo, no principal)
          ───────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.txt3, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Más acciones
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
          <AccionSecundaria
            icono="🪄"
            titulo="Cargar datos paso a paso"
            descripcion="Wizard guiado con preguntas simples"
            onClick={onAbrirWizard}
          />
          <AccionSecundaria
            icono="💬"
            titulo="Preguntale al contador IA"
            descripcion="Chat sobre tu situación"
            onClick={onAbrirChat}
          />
          <AccionSecundaria
            icono="📋"
            titulo="Ver el detalle técnico"
            descripcion={`Formulario ${isJuridica ? "F-110" : "F-210"} línea por línea`}
            onClick={onAbrirDetalle}
          />
          {allOwners.length > 1 && (
            <AccionSecundaria
              icono="👨‍👩‍👧‍👦"
              titulo="Vista familiar consolidada"
              descripcion={`Todos tus titulares en una vista (${allOwners.length})`}
              onClick={onAbrirVistaFamiliar}
            />
          )}
          <AccionSecundaria
            icono="📚"
            titulo="Mis declaraciones anteriores"
            descripcion="Historial de años pasados"
            onClick={onAbrirDeclaracionesPrev}
          />
        </div>
      </div>

      {/* ─── Modales ───────────────────────────────────────────────── */}
      {hallazgoActivo && (
        <AsignarTitularMasivo
          hallazgo={hallazgoActivo}
          user={user}
          onClose={() => setHallazgoActivo(null)}
          onUpdateUser={(newUser) => {
            onUpdateUser(newUser);
            setHallazgoActivo(null);
          }}
        />
      )}
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

// ─────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────

function OportunidadCard({ opo, index, onAplicar }) {
  const ahorro = opo.ahorroAnualEstimado || 0;
  const aplicable = opo.codigo && [
    "APORTAR_PV_AFC",
    "DEPENDIENTES_NO_DECLARADOS",
    "SALUD_PREPAGADA_NO_REGISTRADA",
  ].includes(opo.codigo);

  return (
    <div style={{
      padding: "14px 16px",
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${C.green}`,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexWrap: "wrap",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: C.greenBg, color: C.green,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800,
        flexShrink: 0,
      }}>
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, lineHeight: 1.3 }}>
          {opo.titulo || opo.recomendacion || "Oportunidad"}
        </div>
        <div style={{ fontSize: 12, color: C.txt3, marginTop: 4, lineHeight: 1.4 }}>
          {opo.descripcionCorta || opo.descripcion || ""}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: C.txt3 }}>Te ahorrás</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.green, lineHeight: 1 }}>
          {fmShort(ahorro)}
        </div>
        <div style={{ fontSize: 10, color: C.txt3, marginTop: 2 }}>al año</div>
      </div>
      {aplicable && (
        <button
          onClick={onAplicar}
          style={{
            padding: "8px 14px",
            background: C.green,
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
      )}
    </div>
  );
}

function AlertaCard({ hallazgo, severidad, onResolver }) {
  const esError = severidad === "error";
  const color = esError ? C.red : C.orange;
  const colorBg = esError ? C.redBg : C.orangeBg;

  return (
    <div style={{
      padding: "12px 14px",
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }}>
      <div style={{
        fontSize: 16,
        flexShrink: 0,
        width: 26, height: 26, borderRadius: 6,
        background: colorBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {esError ? "🚫" : "⚠️"}
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.txt, lineHeight: 1.3 }}>
          {hallazgo.titulo}
        </div>
        {hallazgo.descripcion && (
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 2, lineHeight: 1.4 }}>
            {hallazgo.descripcion}
          </div>
        )}
      </div>
      <button
        onClick={onResolver}
        style={{
          padding: "6px 12px",
          background: "transparent",
          border: `1px solid ${color}`,
          borderRadius: 6,
          color,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Resolver →
      </button>
    </div>
  );
}

function AccionSecundaria({ icono, titulo, descripcion, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "all 0.15s",
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = C.txt2; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, lineHeight: 1.2 }}>
          {titulo}
        </div>
        <div style={{ fontSize: 11, color: C.txt3, marginTop: 2, lineHeight: 1.3 }}>
          {descripcion}
        </div>
      </div>
      <span style={{ fontSize: 14, color: C.txt3, flexShrink: 0 }}>→</span>
    </button>
  );
}
