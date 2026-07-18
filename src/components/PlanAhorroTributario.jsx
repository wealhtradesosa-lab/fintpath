// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · PlanAhorroTributario.jsx · Sesión 1-may-2026
//
// PROBLEMA QUE RESUELVE (feedback Santiago):
//   "Veo botones y botones y no me queda un proceso fácil y fluido por la
//    cantidad de secciones con subprocesos. El problema para mí es que no
//    es ordenado, no es claro, no es práctico. Oriente de sugerencias,
//    hágalo fácil. Por ejemplo si dice: 'en cartera por cobrar podrías
//    ahorrar hasta X%, revisá si tu cartera está vencida'."
//
// SOLUCIÓN:
//   Checklist progresivo de 5-7 áreas tributarias relevantes para el owner.
//   Cada área:
//   - Pregunta SIMPLE en lenguaje humano ("¿Tu sociedad tiene clientes que
//     te deben dinero?") sin jerga técnica
//   - Hint de ahorro potencial ("Podrías ahorrar hasta $X")
//   - Si user dice SÍ: input simple inline para cargar el dato relevante
//   - Si user dice NO/Saltar: el área queda marcada y pasa a siguiente
//   - El motor recalcula EN VIVO al confirmar carga
//   - Header arriba muestra "Saldo a cargo" actualizándose
//
// FILOSOFÍA:
//   - 5-7 áreas, no 20. Foco en las palancas más impactantes.
//   - El user ve el progreso completo desde el inicio (no encerrado)
//   - Carga 100% inline — nunca lo mandamos a otro módulo
//   - Lenguaje cero técnico hasta que el user pregunte "¿por qué?"
//   - Diferenciado por owner: jurídica ve áreas de sociedad, natural ve
//     áreas de persona
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import NumberInput from "./NumberInput";

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

const UVT = 52374;

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

// ─────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE ÁREAS · JURÍDICA
// Cada área es: pregunta simple + ahorro potencial + carga inline
// ─────────────────────────────────────────────────────────────────────────

const AREAS_JURIDICA = [
  {
    id: "cartera",
    icono: "📋",
    titulo: "Cartera por cobrar",
    pregunta: "¿Tu sociedad tiene clientes que le deben dinero?",
    explicacion: "Si tenés cuentas por cobrar a clientes que llevan más de 90 días sin pagar, podés deducir hasta el 33% como provisión de cartera. Es plata que entra al cálculo como gasto y baja tu impuesto.",
    baseLegal: "Art. 145 ET",
    estimarAhorro: (data) => {
      const monto = Number(data.monto) || 0;
      // Provisión 33% sobre cartera vencida × tarifa 35%
      return Math.round(monto * 0.33 * 0.35);
    },
    inputs: [
      {
        key: "monto",
        label: "¿Cuánta cartera tenés vencida (más de 90 días)?",
        type: "currency",
        placeholder: "Ej: 50.000.000",
        helpText: "Solo cartera con más de 90 días sin pagar. Si tenés mezclada vencida y al día, sumá solo la vencida.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return {
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            carteraVencida: monto,
            provisionCartera: Math.round(monto * 0.33),
          },
        };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.fiscalProfile?.carteraVencida) > 0,
  },

  {
    id: "donaciones",
    icono: "❤️",
    titulo: "Donaciones a fundaciones",
    pregunta: "¿Tu sociedad donó a alguna fundación, ONG o entidad sin ánimo de lucro en 2025?",
    explicacion: "Si donaste a una ESAL (Entidad Sin Ánimo de Lucro) registrada ante la DIAN, podés DESCONTAR el 25% del monto donado directamente del impuesto. No es deducción (que reduce base), es DESCUENTO (resta peso a peso del impuesto final).",
    baseLegal: "Art. 257 ET",
    estimarAhorro: (data) => {
      const monto = Number(data.monto) || 0;
      return Math.round(monto * 0.25);
    },
    inputs: [
      {
        key: "monto",
        label: "¿Cuánto donaste en total durante el año?",
        type: "currency",
        placeholder: "Ej: 10.000.000",
        helpText: "Solo donaciones a entidades del Régimen Tributario Especial (RTE) con certificación DIAN.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const desc = { ...(o.descuentosTributarios || {}) };
        desc.donaciones = monto;
        return { ...o, descuentosTributarios: desc };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.descuentosTributarios?.donaciones) > 0,
  },

  {
    id: "ica",
    icono: "🏛️",
    titulo: "ICA pagado en el año",
    pregunta: "¿Tu sociedad pagó ICA (Industria y Comercio) durante 2025?",
    explicacion: "El ICA pagado a las alcaldías es 100% deducible. Si lo pagaste pero no lo cargaste, estás pagando impuesto sobre algo que ya pagaste como impuesto. Cargalo y se deduce automáticamente.",
    baseLegal: "Art. 115 ET",
    estimarAhorro: (data) => {
      const monto = Number(data.monto) || 0;
      // ICA es 100% deducible, ahorro = monto × 35% tarifa
      return Math.round(monto * 0.35);
    },
    inputs: [
      {
        key: "monto",
        label: "¿Cuánto pagaste de ICA en total durante 2025?",
        type: "currency",
        placeholder: "Ej: 8.000.000",
        helpText: "Sumá los pagos bimestrales o anuales de ICA + Reteica + Avisos y Tableros.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return {
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            icaAnual: monto,
          },
        };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.fiscalProfile?.icaAnual) > 0,
  },

  {
    id: "perdidas",
    icono: "📉",
    titulo: "Pérdidas de años anteriores",
    pregunta: "¿Tu sociedad tuvo pérdidas fiscales en algún año entre 2017 y 2024?",
    explicacion: "Si en años anteriores Lagoon registró pérdida fiscal, esa pérdida se puede COMPENSAR contra la utilidad de este año. Tenés 12 años para usarla. Pérdidas anteriores a 2017 ya no son compensables.",
    baseLegal: "Art. 147 ET",
    estimarAhorro: (data) => {
      const monto = Number(data.monto) || 0;
      // Compensación 100% directa sobre la base × 35%
      return Math.round(monto * 0.35);
    },
    inputs: [
      {
        key: "monto",
        label: "¿Cuánto tenés acumulado de pérdidas pendientes de compensar?",
        type: "currency",
        placeholder: "Ej: 30.000.000",
        helpText: "Sumá las pérdidas declaradas en años anteriores que aún no usaste. Si no estás seguro, pedile el dato a tu contador o revisá tu declaración del año pasado renglón 73.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return { ...o, perdidasFiscalesAcumuladas: monto };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.perdidasFiscalesAcumuladas) > 0,
  },

  {
    id: "iva_capital",
    icono: "🏗️",
    titulo: "IVA en activos productivos",
    pregunta: "¿Tu sociedad compró maquinaria, equipo, vehículos o inmuebles productivos en 2025?",
    explicacion: "El IVA pagado al comprar bienes de capital (que se usan en la actividad productiva) se descuenta directamente del impuesto. No es un gasto: es un crédito tributario peso a peso.",
    baseLegal: "Art. 258-1 ET",
    estimarAhorro: (data) => {
      const monto = Number(data.monto) || 0;
      // IVA generalmente 19% del costo del activo
      return Math.round(monto * 0.19);
    },
    inputs: [
      {
        key: "monto",
        label: "¿Cuánto invertiste en bienes de capital (sin IVA)?",
        type: "currency",
        placeholder: "Ej: 100.000.000",
        helpText: "Costo neto sin IVA. Aplica a maquinaria, equipo de producción, vehículos comerciales, inmuebles productivos. NO aplica a vehículos de lujo o muebles de oficina.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const ivaPagado = Math.round(monto * 0.19);
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const desc = { ...(o.descuentosTributarios || {}) };
        desc.ivaActivosProductivos = ivaPagado;
        return { ...o, descuentosTributarios: desc };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.descuentosTributarios?.ivaActivosProductivos) > 0,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE ÁREAS · NATURAL
// ─────────────────────────────────────────────────────────────────────────

const AREAS_NATURAL = [
  {
    id: "dependientes",
    icono: "👨‍👩‍👧",
    titulo: "Personas que dependen de vos",
    pregunta: "¿Tenés cónyuge, hijos o padres que dependen económicamente de vos?",
    explicacion: "Si mantenés económicamente a tu cónyuge sin ingresos, hijos menores de 23 años, hijos con discapacidad o padres que no se pueden mantener solos, podés deducir el 10% de tu salario (con tope ~$20M/año).",
    baseLegal: "Art. 387 parr 2 ET",
    estimarAhorro: (data, det) => {
      const cantidad = Number(data.cantidad) || 0;
      if (cantidad === 0) return 0;
      const ingLaboral = Number(det?.aportesDesglose?.salarioGravableAnual) || 0;
      const deducMax = Math.min(ingLaboral * 0.10, 32 * UVT * 12);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      const ahorroBruto = Math.round(deducMax * tasaMarg);
      return Math.min(ahorroBruto, saldoActual);
    },
    inputs: [
      {
        key: "cantidad",
        label: "¿Cuántas personas dependen de vos?",
        type: "number",
        placeholder: "Ej: 2",
        helpText: "Cónyuge sin ingresos, hijos menores, hijos con discapacidad, padres dependientes.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const cantidad = Number(data.cantidad) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return {
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            dependientes: { cantidad, conDiscapacidad: false },
          },
        };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.fiscalProfile?.dependientes?.cantidad) > 0,
  },

  {
    id: "salud_prepagada",
    icono: "🏥",
    titulo: "Medicina prepagada o seguro de salud",
    pregunta: "¿Pagás Colsanitas, Sura, Medplus u otra medicina prepagada / seguro de salud?",
    explicacion: "El gasto en medicina prepagada es deducible hasta 16 UVT/mes (~$838K/mes en 2026). Solo necesitás cargar cuánto pagás cada mes.",
    baseLegal: "Art. 387 #2 ET",
    estimarAhorro: (data, det) => {
      const mensual = Number(data.gastoMensual) || 0;
      const anual = mensual * 12;
      const tope = 16 * UVT * 12;
      const deducible = Math.min(anual, tope);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      const ahorroBruto = Math.round(deducible * tasaMarg);
      return Math.min(ahorroBruto, saldoActual);
    },
    inputs: [
      {
        key: "gastoMensual",
        label: "¿Cuánto pagás cada mes de medicina prepagada o seguro?",
        type: "currency",
        placeholder: "Ej: 600.000",
        helpText: "Si tenés varios seguros/planes, sumalos. El motor topa automáticamente al máximo legal.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const mensual = Number(data.gastoMensual) || 0;
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      newUser.gas["Salud"] = (newUser.gas["Salud"] || []).filter(g => !g._planAhorro);
      newUser.gas["Salud"].push({
        id: "gas_pa_salud_" + Date.now(),
        owner: ownerId,
        cat: "Salud",
        m: mensual,
        fuente: "Plan de Ahorro Tributario",
        _planAhorro: true,
      });
      return newUser;
    },
    yaAplicado: (owner, user) => {
      return ((user?.gas?.Salud || []).some(g => g.owner === owner.id && g._planAhorro));
    },
  },

  {
    id: "pv_afc",
    icono: "💼",
    titulo: "Aportes a Pensión Voluntaria o AFC",
    pregunta: "¿Aportás (o querés empezar a aportar) a Pensión Voluntaria o cuenta AFC?",
    explicacion: "Estos aportes son 100% deducibles dentro del cap del 25% del ingreso (máx 2.500 UVT/año). Es la palanca fiscal más potente para personas con salario alto.",
    baseLegal: "Arts. 126-1 y 126-4 ET",
    estimarAhorro: (data, det) => {
      const mensual = Number(data.aporteMensual) || 0;
      const anual = mensual * 12;
      const espacio = Number(det?.espacioParaPVyAFC) || 0;
      const aplicable = Math.min(anual, espacio);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      const ahorroBruto = Math.round(aplicable * tasaMarg);
      return Math.min(ahorroBruto, saldoActual);
    },
    inputs: [
      {
        key: "aporteMensual",
        label: "¿Cuánto vas a aportar al mes?",
        type: "currency",
        placeholder: "Ej: 1.500.000",
        helpText: "El motor verifica que no te pases del cap legal. Si elegís un monto demasiado alto, se ajusta automáticamente.",
      },
      {
        key: "tipoCuenta",
        label: "Tipo de cuenta",
        type: "select",
        options: [
          { value: "AP_TRIB_PENSION_VOL", label: "Pensión Voluntaria" },
          { value: "AP_TRIB_AFC", label: "AFC (Ahorro para Fomento de la Construcción)" },
        ],
        defaultValue: "AP_TRIB_AFC",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const mensual = Number(data.aporteMensual) || 0;
      const tipo = data.tipoCuenta || "AP_TRIB_AFC";
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      newUser.gas["Aportes tributarios"] = (newUser.gas["Aportes tributarios"] || []).filter(g => !g._planAhorro);
      newUser.gas["Aportes tributarios"].push({
        id: "gas_pa_pv_" + Date.now(),
        owner: ownerId,
        cat: "Aportes tributarios",
        fiscalCode: tipo,
        m: mensual,
        fuente: "Plan de Ahorro Tributario",
        _planAhorro: true,
      });
      return newUser;
    },
    yaAplicado: (owner, user) => {
      return ((user?.gas?.["Aportes tributarios"] || []).some(g => g.owner === owner.id && g._planAhorro));
    },
  },

  {
    id: "vivienda",
    icono: "🏠",
    titulo: "Intereses de vivienda habitacional",
    pregunta: "¿Pagás cuotas de un crédito hipotecario sobre tu vivienda principal?",
    explicacion: "Los intereses de tu hipoteca de VIVIENDA HABITACIONAL son deducibles hasta 1.200 UVT/año (~$62.8M en 2026). Es deducción directa sobre tu base gravable.",
    baseLegal: "Art. 119 ET",
    estimarAhorro: (data, det) => {
      const interesesAnuales = Number(data.interesesAnuales) || 0;
      const tope = 1200 * UVT;
      const deducible = Math.min(interesesAnuales, tope);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      const ahorroBruto = Math.round(deducible * tasaMarg);
      return Math.min(ahorroBruto, saldoActual);
    },
    inputs: [
      {
        key: "interesesAnuales",
        label: "¿Cuánto pagaste de intereses (no capital) en el año?",
        type: "currency",
        placeholder: "Ej: 25.000.000",
        helpText: "El banco te entrega un certificado anual con el desglose de intereses pagados. Pediselo o consultalo en la app del banco.",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const intereses = Number(data.interesesAnuales) || 0;
      const newUser = { ...user };
      newUser.owners = (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        return {
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            interesesViviendaAnuales: intereses,
          },
        };
      });
      return newUser;
    },
    yaAplicado: (owner) => Number(owner?.fiscalProfile?.interesesViviendaAnuales) > 0,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function PlanAhorroTributario({ user, selectedOwner, estimacion, onUpdateUser, onClose }) {
  const isJuridica = selectedOwner?.type === "juridica";
  const areas = isJuridica ? AREAS_JURIDICA : AREAS_NATURAL;
  const ownerName = selectedOwner?.name || "vos";

  // Datos del owner para mostrar contexto
  const det = useMemo(() => {
    return estimacion?.detalle?.find(d => d.name === selectedOwner?.name);
  }, [estimacion, selectedOwner]);

  const saldoACargoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);

  // State del checklist
  const [areaActiva, setAreaActiva] = useState(null); // id del área que está expandida
  const [respuestas, setRespuestas] = useState({}); // { areaId: { yes/no/skip, data: {...} } }

  // Calcular cuáles ya están aplicadas (datos ya cargados previamente)
  const estadoAreas = useMemo(() => {
    return areas.map(a => {
      const yaAplicado = a.yaAplicado ? a.yaAplicado(selectedOwner, user) : false;
      const respuesta = respuestas[a.id];
      let estado = "pendiente";
      if (yaAplicado || respuesta?.tipo === "aplicado") estado = "aplicado";
      else if (respuesta?.tipo === "noaplica") estado = "noaplica";
      return { ...a, estado, ahorroEstimado: respuesta?.ahorro || 0 };
    });
  }, [areas, selectedOwner, user, respuestas]);

  const ahorroTotalEstimado = estadoAreas.reduce((s, a) => s + (a.ahorroEstimado || 0), 0);
  const completadas = estadoAreas.filter(a => a.estado !== "pendiente").length;
  const pctCompletado = Math.round((completadas / areas.length) * 100);

  function manejarAplicar(area, data) {
    // Calcular ahorro estimado
    const ahorro = area.estimarAhorro ? area.estimarAhorro(data, det) : 0;
    // Aplicar al user
    const newUser = area.aplicar(user, selectedOwner.id, data);
    onUpdateUser(newUser);
    // Marcar área como aplicada
    setRespuestas(prev => ({
      ...prev,
      [area.id]: { tipo: "aplicado", ahorro, data },
    }));
    setAreaActiva(null);
  }

  function manejarNoAplica(area) {
    setRespuestas(prev => ({
      ...prev,
      [area.id]: { tipo: "noaplica", ahorro: 0 },
    }));
    setAreaActiva(null);
  }

  return (
    <div style={{ padding: "8px 0", maxWidth: 820, margin: "0 auto" }}>
      {/* Header con contexto */}
      <div style={{ marginBottom: 18 }}>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: C.txt2,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: 6,
            marginBottom: 10,
            marginLeft: -10,
          }}
        >
          ← Volver
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: C.greenBg, border: `1px solid ${C.green}40`, borderRadius: 999 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green, letterSpacing: 0.5 }}>🎯 PLAN DE AHORRO TRIBUTARIO</span>
          </div>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
          {isJuridica ? "🏢" : "👤"} {ownerName}
        </h1>
        <p style={{ fontSize: 13, color: C.txt2, marginTop: 6, lineHeight: 1.5 }}>
          Te voy a hacer <strong style={{ color: C.txt }}>{areas.length} preguntas simples</strong>. Por cada SÍ
          que respondas, calculamos tu ahorro automáticamente. Los datos que cargues quedan guardados.
        </p>
      </div>

      {/* Saldo a cargo + ahorro detectado (header sticky-ish) */}
      <div style={{
        marginBottom: 18,
        padding: "16px 20px",
        background: `linear-gradient(135deg, ${C.bg2} 0%, rgba(74,222,128,0.06) 100%)`,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        display: "flex",
        gap: 20,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 11, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Saldo a cargo actual
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.txt }}>
            {fm(saldoACargoActual)}
          </div>
        </div>
        {ahorroTotalEstimado > 0 && (
          <>
            <div style={{ fontSize: 24, color: C.txt3 }}>−</div>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                💚 Ahorro detectado
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.green }}>
                {fm(ahorroTotalEstimado)}
              </div>
            </div>
          </>
        )}
        <div style={{ flex: "1 1 100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: C.bg3, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: pctCompletado + "%", height: "100%", background: C.green, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, color: C.txt3, fontWeight: 600, whiteSpace: "nowrap" }}>
              {completadas} de {areas.length} áreas revisadas
            </span>
          </div>
        </div>
      </div>

      {/* Lista de áreas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {estadoAreas.map((area, i) => (
          <AreaCard
            key={area.id}
            area={area}
            index={i + 1}
            activa={areaActiva === area.id}
            onActivar={() => setAreaActiva(areaActiva === area.id ? null : area.id)}
            onAplicar={(data) => manejarAplicar(area, data)}
            onNoAplica={() => manejarNoAplica(area)}
            det={det}
          />
        ))}
      </div>

      {/* Footer cuando todas completadas */}
      {completadas === areas.length && (
        <div style={{
          marginTop: 24,
          padding: "20px 24px",
          background: C.greenBg,
          border: `1.5px solid ${C.green}`,
          borderRadius: 12,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.txt, marginBottom: 6 }}>
            Plan completado
          </div>
          <p style={{ fontSize: 13, color: C.txt2, lineHeight: 1.5, margin: "0 0 14px" }}>
            Revisaste las {areas.length} áreas relevantes. Tu nuevo saldo a cargo
            estimado es <strong style={{ color: C.green }}>{fm(saldoACargoActual)}</strong>
            {ahorroTotalEstimado > 0 && (
              <> con un ahorro detectado de <strong style={{ color: C.green }}>{fm(ahorroTotalEstimado)}</strong></>
            )}.
          </p>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              background: C.green,
              border: "none",
              borderRadius: 8,
              color: "#000",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Volver al resumen
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTE: tarjeta de un área del checklist
// ─────────────────────────────────────────────────────────────────────────

function AreaCard({ area, index, activa, onActivar, onAplicar, onNoAplica, det }) {
  const [valores, setValores] = useState(() => {
    const init = {};
    (area.inputs || []).forEach(i => {
      if (i.defaultValue !== undefined) init[i.key] = i.defaultValue;
    });
    return init;
  });

  const ahorroPreview = useMemo(() => {
    if (!area.estimarAhorro) return 0;
    return area.estimarAhorro(valores, det);
  }, [area, valores, det]);

  // Estado: pendiente / aplicado / noaplica
  const esAplicado = area.estado === "aplicado";
  const esNoAplica = area.estado === "noaplica";

  // Color según estado
  const borderColor = esAplicado ? C.green : esNoAplica ? C.txt3 : (activa ? C.blue : C.border);
  const bgColor = esAplicado ? "rgba(74,222,128,0.05)" : C.bg2;

  return (
    <div style={{
      background: bgColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 12,
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      {/* Header del área (siempre visible) */}
      <button
        onClick={!esAplicado && !esNoAplica ? onActivar : undefined}
        disabled={esAplicado || esNoAplica}
        style={{
          width: "100%",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: (esAplicado || esNoAplica) ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        {/* Indicador de estado */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: esAplicado ? C.green : esNoAplica ? C.bg3 : C.bg3,
          color: esAplicado ? "#000" : esNoAplica ? C.txt3 : C.txt2,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 800,
          flexShrink: 0,
        }}>
          {esAplicado ? "✓" : esNoAplica ? "—" : index}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
            <span style={{ fontSize: 18 }}>{area.icono}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>
              {area.titulo}
            </span>
            {esAplicado && area.ahorroEstimado > 0 && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: C.greenBg, color: C.green, fontWeight: 700,
              }}>
                💚 {fmShort(area.ahorroEstimado)} ahorrados
              </span>
            )}
            {esNoAplica && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: C.bg3, color: C.txt3, fontWeight: 600,
              }}>
                No aplica
              </span>
            )}
          </div>
          {!activa && !esAplicado && !esNoAplica && (
            <div style={{ fontSize: 12, color: C.txt3, lineHeight: 1.4 }}>
              {area.pregunta}
            </div>
          )}
        </div>

        {/* Flecha indicadora */}
        {!esAplicado && !esNoAplica && (
          <div style={{ fontSize: 16, color: C.txt3, flexShrink: 0, transform: activa ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
            ▸
          </div>
        )}
      </button>

      {/* Detalle expandido (cuando activa) */}
      {activa && !esAplicado && !esNoAplica && (
        <div style={{ padding: "0 16px 16px 62px" }}>
          {/* Pregunta destacada */}
          <div style={{
            padding: "12px 14px",
            background: C.bg3,
            borderRadius: 8,
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 6, lineHeight: 1.4 }}>
              {area.pregunta}
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              {area.explicacion}
            </div>
            {area.baseLegal && (
              <div style={{ fontSize: 10, color: C.txt3, marginTop: 6, fontStyle: "italic" }}>
                Base legal: {area.baseLegal}
              </div>
            )}
          </div>

          {/* Inputs inline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            {(area.inputs || []).map(input => (
              <InputInline
                key={input.key}
                input={input}
                value={valores[input.key]}
                onChange={(v) => setValores(prev => ({ ...prev, [input.key]: v }))}
              />
            ))}
          </div>

          {/* Preview del ahorro */}
          {ahorroPreview > 0 && (
            <div style={{
              padding: "10px 14px",
              background: C.greenBg,
              border: `1px solid ${C.green}40`,
              borderRadius: 8,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>💚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Ahorro estimado al confirmar
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.green, lineHeight: 1 }}>
                  {fm(ahorroPreview)}
                </div>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onAplicar(valores)}
              disabled={ahorroPreview === 0}
              style={{
                flex: 1,
                minWidth: 140,
                padding: "10px 16px",
                background: ahorroPreview > 0 ? C.green : C.bg3,
                border: "none",
                borderRadius: 8,
                color: ahorroPreview > 0 ? "#000" : C.txt3,
                fontSize: 13,
                fontWeight: 700,
                cursor: ahorroPreview > 0 ? "pointer" : "not-allowed",
                opacity: ahorroPreview > 0 ? 1 : 0.5,
              }}
            >
              ✓ Sí, aplicar al borrador
            </button>
            <button
              onClick={onNoAplica}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.txt2,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              No aplica / saltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// INPUT INLINE (currency, number, select)
// ─────────────────────────────────────────────────────────────────────────

function InputInline({ input, value, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.txt2, marginBottom: 6 }}>
        {input.label}
      </label>
      {input.type === "select" ? (
        <select
          value={value || input.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: C.bg3,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.txt,
            fontSize: 13,
            outline: "none",
          }}
        >
          {input.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : input.type === "currency" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 12px" }}>
          <span style={{ color: C.txt3, fontSize: 13 }}>$</span>
          <NumberInput
            value={value || ""}
            onChange={(v) => onChange(v === "" ? "" : String(v))}
            placeholder={input.placeholder}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              border: "none",
              color: C.txt,
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
      ) : (
        <input
          type={input.type || "number"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={input.placeholder}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: C.bg3,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.txt,
            fontSize: 14,
            outline: "none",
          }}
        />
      )}
      {input.helpText && (
        <div style={{ fontSize: 11, color: C.txt3, marginTop: 4, lineHeight: 1.4 }}>
          {input.helpText}
        </div>
      )}
    </div>
  );
}
