// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · AplicarOportunidadModal.jsx
//
// PROPÓSITO:
//   Modal que permite aplicar una oportunidad/palanca fiscal detectada por
//   generarRecomendaciones() con un solo click. Cierra el ciclo: motor
//   detecta → user aplica → recálculo automático.
//
//   Casos cubiertos por code:
//   - APORTAR_PV_AFC → carga aporte mensual a Pensión Voluntaria
//   - DEPENDIENTES_NO_DECLARADOS → setea cantidad de dependientes
//   - SALUD_PREPAGADA_NO_REGISTRADA → carga gasto mensual de medicina
//   - INTERESES_VIVIENDA_NO_DEDUCIDOS → no aplica directamente (info)
//
//   Para códigos no soportados, redirige al wizard como fallback.
//
// PROPS:
//   - oportunidad: la recomendación con code, ownerId, aporteSugerido, etc.
//   - user: user actual
//   - onUpdateUser: callback para persistir
//   - onClose: callback al cancelar/finalizar
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

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
  red: "#f87171",
  orange: "#fb923c",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");

// ─────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE CÓDIGOS APLICABLES
// ─────────────────────────────────────────────────────────────────────────
// Cada code soportado tiene: (a) un form con valor inicial sugerido,
// (b) un mapper que aplica el cambio al user object.
// ─────────────────────────────────────────────────────────────────────────

const CODIGOS_APLICABLES = {
  APORTAR_PV_AFC: {
    title: "Cargar aporte a Pensión Voluntaria / AFC",
    descripcion: "Aportar a una cuenta de Pensión Voluntaria (PV) o de Ahorro al Fomento de la Construcción (AFC) reduce tu base gravable. Los aportes son 100% deducibles bajo el cap legal del 25% del ingreso (con tope 2500 UVT/año).",
    inputs: [
      {
        key: "aporteMensual",
        label: "Aporte mensual",
        type: "number",
        prefix: "$",
        suffix: "/mes",
        sugeridoFrom: (rec) => rec.aporteSugeridoMensual,
        helpText: "Lo que vas a aportar cada mes. Podés ajustar el monto.",
      },
      {
        key: "tipoCuenta",
        label: "Tipo de cuenta",
        type: "select",
        options: [
          { value: "AP_TRIB_PV", label: "Pensión Voluntaria (PV)" },
          { value: "AP_TRIB_AFC", label: "Ahorro al Fomento de la Construcción (AFC)" },
        ],
        defaultValue: "AP_TRIB_PV",
        helpText: "PV es para retirar a los 57+ años. AFC sirve para comprar vivienda en cualquier momento.",
      },
    ],
    apply: (user, ownerId, vals) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      newUser.gas["Aporte tributario"] = [...(newUser.gas["Aporte tributario"] || [])];
      newUser.gas["Aporte tributario"].push({
        id: "gas_op_pv_" + Date.now(),
        owner: ownerId,
        cat: "Aporte tributario",
        m: Number(vals.aporteMensual) || 0,
        fiscalCode: vals.tipoCuenta || "AP_TRIB_PV",
        fuente: "Oportunidad aplicada (Auditor IA)",
        _opportunity: true,
      });
      return newUser;
    },
    successMessage: (vals) => `Aporte mensual de ${fm(vals.aporteMensual)} a ${vals.tipoCuenta === "AP_TRIB_AFC" ? "AFC" : "Pensión Voluntaria"} cargado correctamente.`,
  },

  DEPENDIENTES_NO_DECLARADOS: {
    title: "Declarar dependientes económicos",
    descripcion: "Si tenés cónyuge sin ingresos, hijos menores de 23 años, padres mayores que dependen económicamente de vos, o hijos mayores con discapacidad, podés deducir el 10% de tu salario (con tope 32 UVT/mes ≈ $20M/año).",
    inputs: [
      {
        key: "cantidad",
        label: "Cantidad de dependientes",
        type: "number",
        prefix: "",
        suffix: " personas",
        defaultValue: 1,
        helpText: "El número de personas que dependen económicamente de vos.",
      },
      {
        key: "conDiscapacidad",
        label: "¿Alguno tiene discapacidad?",
        type: "select",
        options: [
          { value: "no", label: "No" },
          { value: "si", label: "Sí (deducción ampliada)" },
        ],
        defaultValue: "no",
        helpText: "Si hay dependientes con discapacidad certificada, la deducción se amplía.",
      },
    ],
    apply: (user, ownerId, vals) => {
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return {
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            dependientes: {
              cantidad: Number(vals.cantidad) || 1,
              conDiscapacidad: vals.conDiscapacidad === "si",
            },
          },
        };
      });
      return newUser;
    },
    successMessage: (vals) => `${vals.cantidad} ${Number(vals.cantidad) === 1 ? "dependiente declarado" : "dependientes declarados"}${vals.conDiscapacidad === "si" ? " (con discapacidad)" : ""}.`,
  },

  SALUD_PREPAGADA_NO_REGISTRADA: {
    title: "Cargar gasto mensual de medicina prepagada / seguro de salud",
    descripcion: "El gasto en medicina prepagada o seguro de salud es deducible hasta 16 UVT/mes (~$838K/mes en 2026). Cargá el monto que pagás cada mes.",
    inputs: [
      {
        key: "gastoMensual",
        label: "Gasto mensual",
        type: "number",
        prefix: "$",
        suffix: "/mes",
        helpText: "Lo que pagás cada mes a la prepagada o seguro de salud.",
      },
    ],
    apply: (user, ownerId, vals) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      newUser.gas["Salud"] = [...(newUser.gas["Salud"] || [])];
      newUser.gas["Salud"].push({
        id: "gas_op_salud_" + Date.now(),
        owner: ownerId,
        cat: "Salud",
        m: Number(vals.gastoMensual) || 0,
        fuente: "Oportunidad aplicada (Auditor IA)",
        _opportunity: true,
      });
      return newUser;
    },
    successMessage: (vals) => `Gasto mensual de ${fm(vals.gastoMensual)} en medicina prepagada cargado correctamente.`,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────

export default function AplicarOportunidadModal({ oportunidad, user, onUpdateUser, onClose }) {
  // Configuración del code
  const config = CODIGOS_APLICABLES[oportunidad?.code];

  // Inicializar valores con sugeridos del motor
  const [valores, setValores] = useState(() => {
    if (!config) return {};
    const initial = {};
    config.inputs.forEach(inp => {
      if (inp.sugeridoFrom) {
        initial[inp.key] = inp.sugeridoFrom(oportunidad) || inp.defaultValue || "";
      } else {
        initial[inp.key] = inp.defaultValue !== undefined ? inp.defaultValue : "";
      }
    });
    return initial;
  });

  const [aplicando, setAplicando] = useState(false);
  const [exito, setExito] = useState(false);

  // Si el code no está soportado, mostrar mensaje informativo
  if (!config) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>💡</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: C.txt, margin: 0, textAlign: "center" }}>
            {oportunidad?.titulo || "Esta oportunidad no es aplicable directamente"}
          </h3>
          <p style={{ fontSize: 13, color: C.txt2, marginTop: 12, lineHeight: 1.5, textAlign: "center" }}>
            {oportunidad?.descripcion || "Esta sugerencia requiere análisis manual o de tu contador. Te explicamos los detalles arriba."}
          </p>
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button onClick={onClose} style={btnSec}>Entendido</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  const ownerName = useMemo(() => {
    return (user?.owners || []).find(o => o.id === oportunidad.ownerId)?.name || "el contribuyente";
  }, [user, oportunidad]);

  const handleAplicar = () => {
    setAplicando(true);
    try {
      const newUser = config.apply(user, oportunidad.ownerId, valores);
      onUpdateUser(newUser);
      setExito(true);
    } catch (err) {
      console.error("Error aplicando oportunidad:", err);
      alert("Hubo un error aplicando la oportunidad. Probá manualmente desde Configuración.");
    } finally {
      setAplicando(false);
    }
  };

  // Pantalla de éxito
  if (exito) {
    return (
      <Backdrop onClose={onClose}>
        <div style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: C.txt, margin: 0, marginBottom: 12 }}>
            Oportunidad aplicada
          </h3>
          <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, maxWidth: 420, margin: "0 auto 16px" }}>
            {config.successMessage(valores)}
          </p>
          {oportunidad.ahorroAnualEstimado > 0 && (
            <div style={{
              background: C.greenBg,
              border: `1px solid ${C.green}40`,
              borderRadius: 10,
              padding: "12px 16px",
              maxWidth: 400,
              margin: "0 auto 20px",
            }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                💰 Ahorro estimado
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.txt, marginTop: 4 }}>
                {fm(oportunidad.ahorroAnualEstimado)} / año
              </div>
              <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
                Tu impuesto va a recalcularse automáticamente.
              </div>
            </div>
          )}
          <button onClick={onClose} style={btnPrimary}>
            Listo
          </button>
        </div>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}>
        <span style={{ fontSize: 28 }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
            Aplicar oportunidad fiscal
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.3 }}>
            {config.title}
          </h2>
          <div style={{ fontSize: 12, color: C.txt3, marginTop: 4 }}>
            Para {ownerName}
          </div>
        </div>
        <button onClick={onClose} style={closeBtn} aria-label="Cerrar">✕</button>
      </div>

      {/* Descripción + ahorro estimado */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 13, color: C.txt2, lineHeight: 1.55, margin: 0 }}>
          {config.descripcion}
        </p>
        {oportunidad.ahorroAnualEstimado > 0 && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: C.greenBg,
            border: `1px solid ${C.green}40`,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>💰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Ahorro estimado
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, marginTop: 1 }}>
                {fm(oportunidad.ahorroAnualEstimado)} / año
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inputs configurables */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
        {config.inputs.map((inp) => (
          <div key={inp.key} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.txt2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {inp.label}
            </label>
            {inp.type === "select" ? (
              <select
                value={valores[inp.key] || ""}
                onChange={(e) => setValores(v => ({ ...v, [inp.key]: e.target.value }))}
                style={selectStyle}
              >
                {inp.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <div style={{ position: "relative" }}>
                {inp.prefix && (
                  <span style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: C.txt3,
                    fontSize: 16,
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}>
                    {inp.prefix}
                  </span>
                )}
                <input
                  type="number"
                  value={valores[inp.key] || ""}
                  onChange={(e) => setValores(v => ({ ...v, [inp.key]: e.target.value }))}
                  placeholder="0"
                  style={{
                    ...inputStyle,
                    paddingLeft: inp.prefix ? 32 : 14,
                    paddingRight: inp.suffix ? 60 : 14,
                  }}
                />
                {inp.suffix && (
                  <span style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: C.txt3,
                    fontSize: 13,
                    pointerEvents: "none",
                  }}>
                    {inp.suffix}
                  </span>
                )}
              </div>
            )}
            {inp.helpText && (
              <div style={{ fontSize: 11, color: C.txt3, marginTop: 6, lineHeight: 1.4 }}>
                {inp.helpText}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer con botones */}
      <div style={{
        padding: "16px 24px",
        display: "flex",
        gap: 10,
        justifyContent: "flex-end",
      }}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={handleAplicar} disabled={aplicando} style={btnPrimary}>
          {aplicando ? "Aplicando..." : "✓ Aplicar oportunidad"}
        </button>
      </div>
    </Backdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────

function Backdrop({ children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const btnPrimary = {
  padding: "10px 20px",
  background: C.green,
  border: "none",
  borderRadius: 8,
  color: "#000",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
};

const btnSec = {
  padding: "10px 18px",
  background: "transparent",
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  color: C.txt2,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: C.txt3,
  fontSize: 22,
  cursor: "pointer",
  padding: 0,
  lineHeight: 1,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  fontWeight: 600,
  background: C.bg3,
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  color: C.txt,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 600,
  background: C.bg3,
  border: `1.5px solid ${C.border}`,
  borderRadius: 8,
  color: C.txt,
  outline: "none",
  cursor: "pointer",
  boxSizing: "border-box",
};
