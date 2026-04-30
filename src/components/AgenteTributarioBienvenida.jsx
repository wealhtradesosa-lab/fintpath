// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · AgenteTributarioBienvenida.jsx
//
// PROPÓSITO:
//   Pantalla amigable y conversacional que reemplaza la tabla técnica
//   F-110/F-210 como vista por defecto del Agente Tributario IA.
//
//   Esta pantalla está diseñada para PERSONAS COMUNES sin formación
//   tributaria. Usa lenguaje natural, números grandes, alto contraste,
//   y enfoca en QUÉ HACER en lugar de DATOS técnicos.
//
//   Si el usuario quiere ver el detalle DIAN, hay un botón explícito
//   "Ver formulario completo (modo experto)" que lo lleva a la tabla.
//
// PRINCIPIOS DE DISEÑO:
//   1. Lenguaje humano: "Lo que te toca pagar" no "Saldo a pagar renglón 113"
//   2. Alto contraste: blanco sobre negro, colores sólidos, sin transparencias confusas
//   3. Números grandes: el saldo final es el héroe visual de la pantalla
//   4. Pocas decisiones: 2-3 botones de acción claros, no 30 renglones editables
//   5. Acompañamiento: explicación de "qué significa esto" en cada bloque
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { exportarBorradorPDF } from "../lib/pdfExport.js";
import TerminoTributario from "./TerminoTributario.jsx";
import BannerAuditoriaDatos from "./BannerAuditoriaDatos.jsx";
import AsignarTitularMasivo from "./AsignarTitularMasivo.jsx";
import AplicarOportunidadModal from "./AplicarOportunidadModal.jsx";

// Paleta de colores con alto contraste sobre fondo oscuro
const C = {
  bg: "#0a0a0c",
  bg2: "#16161a",
  bg3: "#222228",
  txt: "#ffffff",
  txt2: "#d4d4d8",
  txt3: "#a1a1aa",
  border: "rgba(255,255,255,0.10)",
  green: "#4ade80",      // verde claro, alto contraste
  greenBg: "rgba(74,222,128,0.10)",
  blue: "#60a5fa",       // azul claro
  blueBg: "rgba(96,165,250,0.10)",
  orange: "#fb923c",     // naranja claro
  orangeBg: "rgba(251,146,60,0.10)",
  red: "#f87171",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
  gold: "#fbbf24",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

/**
 * Convierte un número grande en formato legible: $1,044,000,000 → "$1.044 millones"
 */
function fmHumano(v) {
  const n = Math.round(Number(v) || 0);
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000_000) {
    return "$" + (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + " mil millones";
  }
  if (Math.abs(n) >= 1_000_000) {
    return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " millones";
  }
  if (Math.abs(n) >= 1_000) {
    return "$" + (n / 1_000).toFixed(0) + " mil";
  }
  return "$" + n.toLocaleString("es-CO");
}

export default function AgenteTributarioBienvenida({
  user,
  selectedOwner,
  estimacion,
  onVerFormulario,
  onCambiarOwner,
  onAbrirWizard,
  onAbrirChat,
  onUpdateUser,
  ano = 2025,
}) {
  const allOwners = useMemo(() => user?.owners || [], [user]);
  const isJuridica = selectedOwner?.type === "juridica";
  const ownerName = selectedOwner?.name || "vos";

  // State del modal de asignación masiva (abierto cuando hay un hallazgo activo)
  const [hallazgoAsignar, setHallazgoAsignar] = useState(null);

  // State del modal de aplicar oportunidad (PV/AFC, dependientes, salud, etc)
  const [oportunidadAplicar, setOportunidadAplicar] = useState(null);

  // Datos del motor para este owner
  const det = useMemo(() => {
    return estimacion?.detalle?.find(d => d.name === selectedOwner?.name);
  }, [estimacion, selectedOwner]);

  // Recomendaciones top 3 para este owner
  const recomendacionesOwner = useMemo(() => {
    if (!user || !estimacion) return [];
    const todas = generarRecomendaciones(user, estimacion);
    return todas
      .filter(r => r.ownerName === selectedOwner?.name || r.owner === selectedOwner?.id)
      .slice(0, 3);
  }, [user, estimacion, selectedOwner]);

  if (!selectedOwner || !det) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: C.txt2 }}>
        Seleccioná un owner fiscal para ver tu resumen.
      </div>
    );
  }

  // ── Cálculos clave en lenguaje humano ────────────────────────────────────
  const ingresoTotal = isJuridica
    ? (det.ingreso || 0)  // jurídica: utilidad/ingreso
    : (det.ingreso || 0); // natural: ingreso total

  const retencionTotal = isJuridica
    ? (det.retefuenteCalc || det.retencionDesglose?.total || 0)
    : (det.retefuenteNat || 0);

  const impuestoBruto = det.impBruto || 0;
  const saldoFinal = det.impuesto || 0;
  const tasaEfectiva = ingresoTotal > 0 ? (saldoFinal / ingresoTotal * 100) : 0;

  const ahorroPotencial = recomendacionesOwner.reduce(
    (s, r) => s + (r.ahorroAnualEstimado || 0), 0
  );

  // ── Saludo dinámico según hora del día ───────────────────────────────────
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ padding: "20px 0" }}>
      {/* ─────── Saludo conversacional con badge de paso 2 ─────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(196,181,253,0.4)", borderRadius: 999 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: 0.5 }}>2️⃣ PASO 2 · AUDITORÍA IA</span>
          </div>
          <span style={{ fontSize: 13, color: C.txt2 }}>{saludo} 👋</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
          {isJuridica ? `Auditoría de ${ownerName}` : `Auditoría de tu declaración`}
        </h1>
        <p style={{ fontSize: 15, color: C.txt2, marginTop: 8, lineHeight: 1.5 }}>
          El auditor IA <strong style={{ color: C.txt }}>revisó tu borrador</strong> y detectó
          oportunidades de optimización. Acá ves un resumen claro y concreto. Si querés ver
          el detalle técnico del formulario, hay un botón abajo.
        </p>
      </div>

      {/* ─────── Header destacado: PERSONA QUE SE ESTÁ AUDITANDO ───────
          Siempre visible (incluso si solo hay 1 owner). Resuelve el problema
          de UX: el user nunca duda sobre QUÉ persona está bajo auditoría.
          Si hay más de un owner, muestra todos como tabs clickeables. */}
      <div style={{
        marginBottom: 20,
        padding: "16px 18px",
        background: isJuridica ? "rgba(196,181,253,0.10)" : "rgba(96,165,250,0.10)",
        border: `1.5px solid ${isJuridica ? "rgba(196,181,253,0.35)" : "rgba(96,165,250,0.35)"}`,
        borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 32,
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 10,
              background: C.bg3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {isJuridica ? "🏢" : "👤"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: isJuridica ? "#c4b5fd" : "#60a5fa", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
                Auditando ahora · {isJuridica ? "Persona jurídica" : "Persona natural"}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.txt, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis" }}>
                {ownerName}
              </div>
              <div style={{ fontSize: 11, color: C.txt3, marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedOwner?.nit && <span>NIT/CC {selectedOwner.nit}</span>}
                {selectedOwner?.regimen && <span>· Régimen {selectedOwner.regimen}</span>}
                {isJuridica && !selectedOwner?.regimen && <span style={{ color: "#fb923c" }}>· Régimen sin definir</span>}
                <span>· {isJuridica ? "F-110" : "F-210"} · Año gravable {ano}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selector tabs si hay más de un owner */}
        {allOwners.length > 1 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Cambiar a otra persona fiscal:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allOwners.map(o => {
                const isActive = o.id === selectedOwner.id;
                const isJur = o.type === "juridica";
                return (
                  <button
                    key={o.id}
                    onClick={() => onCambiarOwner?.(o.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px solid " + (isActive ? C.txt : C.border),
                      background: isActive ? C.txt : "transparent",
                      color: isActive ? C.bg : C.txt2,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{isJur ? "🏢" : "👤"}</span>
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─────── Tarjeta principal: lo que toca pagar ─────── */}
      <div style={{
        marginBottom: 20,
        padding: "32px 28px",
        background: C.bg2,
        border: `1.5px solid ${saldoFinal > 0 ? C.orangeBg.replace("0.10", "0.40") : C.greenBg.replace("0.10", "0.40")}`,
        borderRadius: 16,
      }}>
        <div style={{ fontSize: 13, color: C.txt2, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {saldoFinal > 0 ? "💰 Lo que te toca pagar este año" : "✨ Estás al día"}
        </div>
        <div style={{
          fontSize: 56,
          fontWeight: 800,
          color: saldoFinal > 0 ? C.orange : C.green,
          lineHeight: 1.0,
          marginBottom: 12,
          letterSpacing: -1,
        }}>
          {fm(saldoFinal)}
        </div>
        <div style={{ fontSize: 14, color: C.txt2, lineHeight: 1.6 }}>
          {saldoFinal > 0 ? (
            <>
              Esto es <strong style={{ color: C.txt }}>{tasaEfectiva.toFixed(1)}%</strong>{" "}
              de tus ingresos (<TerminoTributario clave="tasaEfectiva">tasa efectiva</TerminoTributario>). {tasaEfectiva < 5
                ? "Está dentro del rango bajo — pagás poco impuesto efectivo."
                : tasaEfectiva < 15
                  ? "Es un nivel típico para alguien con tu perfil."
                  : tasaEfectiva < 25
                    ? "Es alto — puede haber palancas legales para reducirlo (mirá abajo)."
                    : "Es muy alto — vale la pena hablar con un contador para optimizar."}
            </>
          ) : (
            <>No tenés saldo a pagar este año. ¡Buen trabajo!</>
          )}
        </div>
      </div>

      {/* ─────── 3 números clave en formato simple ─────── */}
      <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <NumeroSimple
          label="Lo que ganaste"
          subLabel="Ingresos del año"
          value={ingresoTotal}
          color={C.blue}
          icon="💼"
        />
        <NumeroSimple
          label="Ya pagaste durante el año"
          subLabel={<>Retenciones automáticas <TerminoTributario clave="retencion">(¿qué es?)</TerminoTributario> del banco, empleador, etc.</>}
          value={retencionTotal}
          color={C.green}
          icon="✅"
          prefix="-"
        />
        <NumeroSimple
          label="Impuesto antes de descuentos"
          subLabel="Lo que daría sin retenciones"
          value={impuestoBruto}
          color={C.txt2}
          icon="📊"
        />
      </div>

      {/* ─────── Auditoría de datos del Contador IA ─────── */}
      <BannerAuditoriaDatos
        user={user}
        onAccion={(hallazgo) => {
          // Las acciones de asignación masiva abren el modal correspondiente.
          // Otras acciones (editar_owner, editar_deuda, agregar_gasto) por
          // ahora redirigen al wizard como fallback hasta tener handlers
          // específicos para cada caso.
          const tipo = hallazgo?.accion?.tipo || "";
          if (tipo.startsWith("asignar_owner_")) {
            setHallazgoAsignar(hallazgo);
            return;
          }
          if (tipo === "abrir_wizard") {
            onAbrirWizard?.();
            return;
          }
          // Fallback: ir al wizard para que el user resuelva manualmente
          onAbrirWizard?.();
        }}
        onAbrirWizard={onAbrirWizard}
        onIgnorar={(hallazgoId) => {
          if (!onUpdateUser) return;
          const dismissed = new Set(user?.auditDismissed || []);
          dismissed.add(hallazgoId);
          onUpdateUser({ ...user, auditDismissed: Array.from(dismissed) });
        }}
        onReactivar={(hallazgoId) => {
          if (!onUpdateUser) return;
          const dismissed = new Set(user?.auditDismissed || []);
          dismissed.delete(hallazgoId);
          onUpdateUser({ ...user, auditDismissed: Array.from(dismissed) });
        }}
      />

      {/* Modal de asignación masiva: se renderiza cuando hay un hallazgo
          activo del tipo asignar_owner_* */}
      {hallazgoAsignar && (
        <AsignarTitularMasivo
          hallazgo={hallazgoAsignar}
          user={user}
          onUpdateUser={onUpdateUser}
          onClose={() => setHallazgoAsignar(null)}
        />
      )}

      {/* Modal de aplicar oportunidad: se renderiza cuando el user clickea
          "⚡ Aplicar oportunidad" en una OportunidadCard */}
      {oportunidadAplicar && (
        <AplicarOportunidadModal
          oportunidad={oportunidadAplicar}
          user={user}
          onUpdateUser={onUpdateUser}
          onClose={() => setOportunidadAplicar(null)}
        />
      )}

      {/* ─────── Oportunidades de ahorro ─────── */}
      {recomendacionesOwner.length > 0 && (
        <div style={{
          marginBottom: 24,
          padding: "24px 24px",
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderLeft: `4px solid ${C.green}`,
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            💡 Detectamos formas de pagar menos
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: C.txt, margin: "4px 0 6px 0" }}>
            Podrías ahorrar hasta {fm(ahorroPotencial)}
          </h3>
          <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, marginBottom: 18 }}>
            Estas son palancas <strong style={{ color: C.txt }}>100% legales</strong>{" "}
            que la ley colombiana te permite usar. Tu contador puede confirmarlas:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recomendacionesOwner.map((rec, i) => (
              <OportunidadCard
                key={i}
                rec={rec}
                numero={i + 1}
                onAplicar={(r) => setOportunidadAplicar(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─────── Acciones siguientes ─────── */}
      <div style={{
        padding: "24px 24px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
      }}>
        <div style={{ fontSize: 13, color: C.txt2, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
          ¿Qué querés hacer ahora?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <button
            onClick={onVerFormulario}
            style={{
              padding: "16px 20px",
              background: C.bg3,
              border: `1.5px solid ${C.border}`,
              borderRadius: 12,
              color: C.txt,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = C.blue; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
              Ver el detalle completo
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              Modo experto: el formulario <TerminoTributario clave={isJuridica ? "f110" : "f210"}>{isJuridica ? "F-110" : "F-210"}</TerminoTributario> con todos los renglones editables
            </div>
          </button>

          <button
            onClick={onAbrirWizard}
            style={{
              padding: "16px 20px",
              background: C.bg3,
              border: `1.5px solid ${C.border}`,
              borderRadius: 12,
              color: C.txt,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = C.green; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>🪄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
              Modo paso a paso
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              Wizard guiado tipo TurboTax. Te hacemos preguntas simples y armamos tu declaración juntos.
            </div>
          </button>

          <button
            onClick={onAbrirChat}
            style={{
              padding: "16px 20px",
              background: C.bg3,
              border: `1.5px solid ${C.border}`,
              borderRadius: 12,
              color: C.txt,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = C.purple; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
              Hablar con la IA
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              Chat con un contador IA que ya conoce tus datos y responde dudas estratégicas.
            </div>
          </button>

          {/* Acción 4: Descargar PDF para el contador */}
          <button
            onClick={() => exportarBorradorPDF(user, selectedOwner, estimacion, ano)}
            style={{
              padding: "16px 20px",
              background: C.greenBg,
              border: `1.5px solid ${C.green}`,
              borderRadius: 12,
              color: C.txt,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.18)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = C.greenBg; }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
              Descargar PDF para mi contador
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              PDF profesional con tu borrador {isJuridica ? "F-110" : "F-210"} listo para enviar a tu contador.
            </div>
          </button>
        </div>
      </div>

      {/* ─────── Disclaimer al pie ─────── */}
      <div style={{
        marginTop: 20,
        padding: "14px 18px",
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.orange}`,
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.6 }}>
          <strong style={{ color: C.orange }}>Importante:</strong> este es un cálculo
          estimado con IA. Antes de presentar cualquier declaración a la DIAN,{" "}
          <strong style={{ color: C.txt }}>siempre validalo con tu contador</strong>.
          FINPATHIA es una herramienta de apoyo, no reemplaza asesoría profesional.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────

function NumeroSimple({ label, subLabel, value, color, icon, prefix = "" }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.txt, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.1, marginBottom: 4, fontFamily: "monospace" }}>
        {prefix}{fm(value)}
      </div>
      <div style={{ fontSize: 11, color: C.txt3, lineHeight: 1.4 }}>
        {subLabel}
      </div>
    </div>
  );
}

function OportunidadCard({ rec, numero, onAplicar }) {
  const ahorro = rec.ahorroAnualEstimado || 0;
  // Códigos que tienen handler de "Aplicar" en el modal
  const APLICABLES = ["APORTAR_PV_AFC", "DEPENDIENTES_NO_DECLARADOS", "SALUD_PREPAGADA_NO_REGISTRADA"];
  const esAplicable = APLICABLES.includes(rec.code);
  return (
    <div style={{
      padding: "14px 16px",
      background: C.bg3,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
    }}>
      <div style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 8,
        background: C.greenBg,
        color: C.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 14,
      }}>
        {numero}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 4, lineHeight: 1.3 }}>
          {rec.titulo || rec.title || "Optimización"}
        </div>
        {rec.descripcion && (
          <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5, marginBottom: 6 }}>
            {rec.descripcion}
          </div>
        )}
        {ahorro > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: esAplicable ? 10 : 0 }}>
            Ahorro estimado: {fm(ahorro)} / año
          </div>
        )}
        {esAplicable && onAplicar && (
          <button
            onClick={() => onAplicar(rec)}
            style={{
              padding: "8px 14px",
              background: C.green,
              border: "none",
              borderRadius: 6,
              color: "#000",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ⚡ Aplicar oportunidad →
          </button>
        )}
      </div>
    </div>
  );
}
