// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · DeclaracionFlow.jsx · Sesión 1-may-2026 (rediseño definitivo)
//
// PROBLEMA REPORTADO POR SANTIAGO (varias iteraciones):
//   "Yo veo botones y botones y no me queda un proceso fácil y fluido por la
//    cantidad de secciones con subprocesos. No es ordenado, no es claro, no
//    es práctico. Esto debería ser paso uno lo que calculo según la data del
//    sistema, paso 2 preguntas o hallazgos de oportunidad para llegar un
//    posible escenario que puede ser usado para los cálculos del simulador
//    y para compartir al contador."
//
// SOLUCIÓN DEFINITIVA:
//   UNA SOLA PANTALLA. Tres etapas linealmente conectadas, sin tabs, sin
//   modos paralelos, sin botones laterales que confundan.
//
//   ETAPA 1 · Tu borrador
//     "Esto entiende la app de tu situación con los datos que cargaste"
//     Saldo a cargo + desglose simple + alertas si faltan datos
//     [Continuar al Paso 2 →]
//
//   ETAPA 2 · Optimización
//     "Vamos a buscar formas legales de pagar menos"
//     Checklist de 4-5 áreas con preguntas humanas + carga inline
//     [Ver mi escenario final →]
//
//   ETAPA 3 · Tu declaración casi lista
//     "Esto es lo que te queda después de optimizar"
//     Saldo original vs optimizado + cambios + vista F-110/F-210
//     [📄 Descargar PDF para mi contador]
//     [✓ Aplicar como mi declaración definitiva]
//     [🔮 Probar en el simulador]
//
// FILOSOFÍA:
//   - Scroll natural de arriba abajo, sin tabs
//   - Cada etapa es una sección con su CTA propio
//   - El user puede volver atrás scroll-up, no necesita botón "Atrás"
//   - El modo experto F-110 está EMBEBIDO en la Etapa 3 (no como vista
//     paralela), porque ahí es donde tiene sentido: ver el detalle de
//     lo que se va a declarar.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useRef, Component } from "react";
import { generarBorradorF110, SECCIONES_F110 } from "../lib/borradorDeclaracion.js";
import { generarBorradorF210, SECCIONES_F210 } from "../lib/borradorDeclaracionF210.js";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { auditarDatos } from "../lib/auditoriaDatos.js";
import { exportarBorradorPDF } from "../lib/pdfExport.js";
import { generarRecomendacionesEstrategicas } from "../lib/recomendacionesEstrategicas.js";
import RecomendacionesEstrategicas from "./RecomendacionesEstrategicas.jsx";
import { estimarImpuesto } from "../lib/taxCO.js";
import PageHeader from "./PageHeader.jsx";

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
// ÁREAS DE OPTIMIZACIÓN POR TIPO DE OWNER (las mismas del Plan, ahora aquí)
// ─────────────────────────────────────────────────────────────────────────

const AREAS_JURIDICA = [
  {
    id: "cartera",
    icono: "📋",
    titulo: "Cartera por cobrar vencida",
    pregunta: "¿Tu sociedad tiene clientes que le deben dinero hace más de 90 días?",
    explicacion: "Si tenés cuentas por cobrar a clientes que llevan más de 90 días sin pagar, podés deducir hasta el 33% como provisión. Es plata que entra al cálculo como gasto y baja tu impuesto.",
    baseLegal: "Art. 145 ET",
    estimarAhorro: (data) => Math.round((Number(data.monto) || 0) * 0.33 * 0.35),
    inputs: [{
      key: "monto",
      label: "¿Cuánta cartera tenés vencida (más de 90 días)?",
      type: "currency",
      placeholder: "Ej: 50.000.000",
      helpText: "Solo cartera con más de 90 días sin pagar.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: { ...(o.fiscalProfile || {}), carteraVencida: monto, provisionCartera: Math.round(monto * 0.33) },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.carteraVencida) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Cartera vencida cargada: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        delete fp.carteraVencida;
        delete fp.provisionCartera;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },
  {
    id: "donaciones",
    icono: "❤️",
    titulo: "Donaciones a fundaciones",
    pregunta: "¿Tu sociedad donó a alguna fundación, ONG o ESAL en 2025?",
    explicacion: "Las donaciones a ESAL registradas ante DIAN dan DESCUENTO directo del 25% sobre el impuesto (no sobre la base, sobre el impuesto final).",
    baseLegal: "Art. 257 ET",
    estimarAhorro: (data) => Math.round((Number(data.monto) || 0) * 0.25),
    inputs: [{
      key: "monto",
      label: "¿Cuánto donaste durante el año?",
      type: "currency",
      placeholder: "Ej: 10.000.000",
      helpText: "Solo donaciones a entidades del Régimen Tributario Especial (RTE) con certificación DIAN.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          descuentosTributarios: { ...(o.descuentosTributarios || {}), donaciones: monto },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.descuentosTributarios?.donaciones) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Donaciones cargadas: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const dt = { ...(o.descuentosTributarios || {}) };
        delete dt.donaciones;
        return { ...o, descuentosTributarios: dt };
      }),
    }),
  },
  {
    id: "ica",
    icono: "🏛️",
    titulo: "ICA pagado durante el año",
    pregunta: "¿Tu sociedad pagó ICA (Industria y Comercio) en 2025?",
    explicacion: "El ICA pagado a las alcaldías es 100% deducible. Si lo pagaste pero no lo cargaste, estás pagando impuesto sobre algo que ya pagaste.",
    baseLegal: "Art. 115 ET",
    estimarAhorro: (data) => Math.round((Number(data.monto) || 0) * 0.35),
    inputs: [{
      key: "monto",
      label: "¿Cuánto pagaste de ICA en total?",
      type: "currency",
      placeholder: "Ej: 8.000.000",
      helpText: "Sumá pagos bimestrales o anuales de ICA + Reteica + Avisos y Tableros.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: { ...(o.fiscalProfile || {}), icaAnual: monto },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.icaAnual) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `ICA cargado: $${monto.toLocaleString("es-CO")}/año` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        delete fp.icaAnual;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },
  {
    id: "perdidas",
    icono: "📉",
    titulo: "Pérdidas fiscales acumuladas",
    pregunta: "¿Tu sociedad tuvo pérdidas en algún año entre 2017 y 2024?",
    explicacion: "Las pérdidas fiscales declaradas se compensan contra utilidades futuras hasta 12 años. Si las tenés, bajan tu base gravable este año.",
    baseLegal: "Art. 147 ET",
    estimarAhorro: (data) => Math.round((Number(data.monto) || 0) * 0.35),
    inputs: [{
      key: "monto",
      label: "¿Cuánto acumulado en pérdidas pendientes?",
      type: "currency",
      placeholder: "Ej: 30.000.000",
      helpText: "Si no estás seguro, pedile el dato a tu contador o revisá tu declaración del año pasado renglón 73.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({ ...o, perdidasFiscalesAcumuladas: monto })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.perdidasFiscalesAcumuladas) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Pérdidas acumuladas: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const out = { ...o };
        delete out.perdidasFiscalesAcumuladas;
        return out;
      }),
    }),
  },
  {
    id: "iva_capital",
    icono: "🏗️",
    titulo: "IVA en activos productivos",
    pregunta: "¿Compraste maquinaria, equipo, vehículos o inmuebles productivos en 2025?",
    explicacion: "El IVA pagado al comprar bienes de capital se descuenta directamente del impuesto. No es gasto: es un crédito tributario peso a peso.",
    baseLegal: "Art. 258-1 ET",
    estimarAhorro: (data) => Math.round((Number(data.monto) || 0) * 0.19),
    inputs: [{
      key: "monto",
      label: "¿Cuánto invertiste en bienes de capital (sin IVA)?",
      type: "currency",
      placeholder: "Ej: 100.000.000",
      helpText: "Costo neto sin IVA. Aplica a maquinaria, equipo productivo, vehículos comerciales. NO aplica a vehículos de lujo o muebles de oficina.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.monto) || 0;
      const ivaPagado = Math.round(monto * 0.19);
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          descuentosTributarios: { ...(o.descuentosTributarios || {}), ivaActivosProductivos: ivaPagado },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const ivaPagado = Number(owner?.descuentosTributarios?.ivaActivosProductivos) || 0;
      if (ivaPagado > 0) {
        return { tiene: true, descripcion: `IVA en activos cargado: $${ivaPagado.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const dt = { ...(o.descuentosTributarios || {}) };
        delete dt.ivaActivosProductivos;
        return { ...o, descuentosTributarios: dt };
      }),
    }),
  },
];

const AREAS_NATURAL = [
  {
    id: "dependientes",
    icono: "👨‍👩‍👧",
    titulo: "Personas que dependen de vos",
    pregunta: "¿Tenés cónyuge sin ingresos, hijos menores de 23 o padres dependientes?",
    explicacion: "Si mantenés económicamente a alguien, podés deducir el 10% de tu salario (tope ~$20M/año).",
    baseLegal: "Art. 387 parr 2 ET",
    estimarAhorro: (data, det) => {
      const cantidad = Number(data.cantidad) || 0;
      if (cantidad === 0) return 0;
      const ingLaboral = Number(det?.aportesDesglose?.salarioGravableAnual) || 0;
      const deducMax = Math.min(ingLaboral * 0.10, 32 * UVT * 12);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      return Math.min(Math.round(deducMax * tasaMarg), saldoActual);
    },
    // Si la cantidad > 0 el dato es válido aunque el motor no detecte
    // ahorro hoy (ej: salario no cargado todavía o retenciones cubren todo).
    // Permitimos aplicar igual: el dato queda guardado para cuando cargue
    // el salario o cambien las retenciones.
    permiteAplicarSinAhorro: (data) => Number(data.cantidad) > 0,
    // Detecta si el dato ya existe en el sistema. Si retorna {tiene: true},
    // el área se muestra como "ya cargado" en vez de pedir la pregunta de cero.
    yaTieneDatos: (owner) => {
      const cant = Number(owner?.fiscalProfile?.dependientes?.cantidad) || 0;
      if (cant > 0) return { tiene: true, descripcion: `${cant} dependiente${cant > 1 ? "s" : ""} ya registrado${cant > 1 ? "s" : ""}` };
      return { tiene: false };
    },
    // Permite borrar datos legacy para que el user pueda re-editar
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
        ...o,
        fiscalProfile: { ...(o.fiscalProfile || {}), dependientes: { cantidad: 0, conDiscapacidad: false } },
      })),
    }),
    inputs: [{
      key: "cantidad",
      label: "¿Cuántas personas dependen de vos?",
      type: "number",
      placeholder: "Ej: 2",
      helpText: "Cónyuge sin ingresos, hijos menores, hijos con discapacidad, padres dependientes.",
    }],
    aplicar: (user, ownerId, data) => {
      const cantidad = Number(data.cantidad) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: { ...(o.fiscalProfile || {}), dependientes: { cantidad, conDiscapacidad: false } },
        })),
      };
    },
    // Limpia el dato persistido para permitir reedición
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        delete fp.dependientes;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },
  {
    id: "salud",
    icono: "🏥",
    titulo: "Medicina prepagada o seguro de salud",
    pregunta: "¿Pagás Colsanitas, Sura, Medplus u otra medicina prepagada?",
    explicacion: "El gasto en medicina prepagada es deducible hasta 16 UVT/mes (~$838K/mes en 2026).",
    baseLegal: "Art. 387 #2 ET",
    estimarAhorro: (data, det) => {
      const mensual = Number(data.gastoMensual) || 0;
      const tope = 16 * UVT * 12;
      const deducible = Math.min(mensual * 12, tope);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      return Math.min(Math.round(deducible * tasaMarg), saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.gastoMensual) > 0,
    // Detecta si ya hay gasto de salud cargado. El motor calcula deducMedicina
    // sumando: cat="Salud" + fiscalCode AP_TRIB_SALUD_PREPAGADA + SEG_SALUD/VIDA.
    yaTieneDatos: (owner, user, det) => {
      const deducMed = Number(det?.deducMedicina) || 0;
      if (deducMed > 0) {
        // Buscar cualquier gasto de salud del owner para mostrar info amigable
        const todoGas = Object.values(user?.gas || {}).flat();
        const gasSalud = todoGas.filter(g => g.owner === owner.id && (
          g.cat === "Salud" ||
          g.fiscalCode === "AP_TRIB_SALUD_PREPAGADA" ||
          g.fiscalCode === "SEG_SALUD" ||
          g.fiscalCode === "SEG_VIDA"
        ));
        const totalMensual = gasSalud.reduce((s, g) => s + (Number(g.m) || 0), 0);
        if (totalMensual > 0) {
          return { tiene: true, descripcion: `Ya cargaste $${totalMensual.toLocaleString("es-CO")}/mes de salud en Egresos` };
        }
        return { tiene: true, descripcion: `Ya hay gastos de salud aplicándose (deducción anual: $${deducMed.toLocaleString("es-CO")})` };
      }
      return { tiene: false };
    },
    // Borra solo los registros de salud creados por este Plan (con flag _planAhorro)
    // para que el user pueda reescribir. Los gastos manuales del user se preservan.
    limpiar: (user, ownerId) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      for (const cat of Object.keys(newUser.gas)) {
        if (Array.isArray(newUser.gas[cat])) {
          newUser.gas[cat] = newUser.gas[cat].filter(g =>
            !(g._planAhorro && g.owner === ownerId && g.fiscalCode === "AP_TRIB_SALUD_PREPAGADA")
          );
        }
      }
      return newUser;
    },
    inputs: [{
      key: "gastoMensual",
      label: "¿Cuánto pagás cada mes?",
      type: "currency",
      placeholder: "Ej: 600.000",
      helpText: "Si tenés varios seguros, sumalos. El motor topa al máximo legal.",
    }],
    aplicar: (user, ownerId, data) => {
      const mensual = Number(data.gastoMensual) || 0;
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      // Usamos misma categoría y patrón que el wizard tributario original
      // (gas["Aporte tributario"] con fiscalCode AP_TRIB_SALUD_PREPAGADA)
      // para que el gasto aparezca correctamente categorizado en Egresos
      // y el motor lo procese como medicina prepagada (Art. 387 #2 ET).
      const cat = "Aporte tributario";
      newUser.gas[cat] = (newUser.gas[cat] || []).filter(g =>
        !(g._planAhorro && g.owner === ownerId && g.fiscalCode === "AP_TRIB_SALUD_PREPAGADA")
      );
      newUser.gas[cat].push({
        id: "gas_pa_salud_" + Date.now(),
        owner: ownerId,
        cat,
        nombre: "Medicina prepagada / seguro de salud",
        fiscalCode: "AP_TRIB_SALUD_PREPAGADA",
        m: mensual,
        fuente: "Plan de Optimización",
        _planAhorro: true,
      });
      return newUser;
    },
    // Limpia el dato persistido. Solo borra registros del Plan (`_planAhorro`),
    // dejando intactos los gastos que el user cargó manualmente en Egresos.
    // Si todo el dato detectado vino de Egresos manuales, el user va a tener
    // que ir al módulo Egresos para modificarlo.
    limpiar: (user, ownerId) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      for (const cat of Object.keys(newUser.gas)) {
        if (!Array.isArray(newUser.gas[cat])) continue;
        newUser.gas[cat] = newUser.gas[cat].filter(g => !(
          g._planAhorro &&
          g.owner === ownerId &&
          (g.fiscalCode === "AP_TRIB_SALUD_PREPAGADA" || g.cat === "Salud")
        ));
      }
      return newUser;
    },
  },
  {
    id: "pv_afc",
    icono: "💼",
    titulo: "Aportes a Pensión Voluntaria o AFC",
    pregunta: "¿Aportás (o querés empezar a aportar) a PV o AFC?",
    explicacion: "Estos aportes son 100% deducibles (cap 25% del ingreso, máx 2.500 UVT/año). La palanca más potente para salarios altos.",
    baseLegal: "Arts. 126-1 y 126-4 ET",
    estimarAhorro: (data, det) => {
      const mensual = Number(data.aporteMensual) || 0;
      const espacio = Number(det?.espacioParaPVyAFC) || 0;
      const aplicable = Math.min(mensual * 12, espacio);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      return Math.min(Math.round(aplicable * tasaMarg), saldoActual);
    },
    // Permitimos aplicar si hay un monto > 0, aunque el motor no detecte
    // espacio disponible HOY. El aviso azul (avisoEspecial) explica por qué
    // no impacta. El dato queda guardado para cuando el user agregue renta
    // laboral o cambien las retenciones — consistente con dependientes,
    // salud y vivienda donde "el dato queda guardado para próximos cálculos".
    permiteAplicarSinAhorro: (data) => Number(data.aporteMensual) > 0,
    // Mensaje específico cuando el motor reporta sin espacio disponible
    avisoEspecial: (det) => {
      const espacio = Number(det?.espacioParaPVyAFC) || 0;
      if (espacio === 0) {
        return {
          tipo: "info",
          mensaje: "Para personas naturales, los aportes a PV/AFC son deducibles solo sobre rentas de TRABAJO (salario u honorarios). Si tu ingreso principal es por dividendos, arriendos o ganancias de capital, este beneficio no aplica. También puede ser que ya estés al máximo del beneficio (cap 40% de renta laboral).",
        };
      }
      return null;
    },
    // Detecta aportes a PV/AFC ya cargados. Buscamos en BOTH categorías
    // posibles ("Aporte tributario" del wizard tributario nuevo y
    // "Aportes tributarios" legacy) para retrocompatibilidad.
    yaTieneDatos: (owner, user) => {
      const todoGas = Object.values(user?.gas || {}).flat();
      const aportes = todoGas.filter(g =>
        g.owner === owner.id &&
        (g.fiscalCode === "AP_TRIB_PENSION_VOL" || g.fiscalCode === "AP_TRIB_AFC" || g.fiscalCode === "AP_TRIB_PV")
      );
      const totalMensual = aportes.reduce((s, g) => s + (Number(g.m) || 0), 0);
      if (totalMensual > 0) {
        return { tiene: true, descripcion: `Ya aportás $${totalMensual.toLocaleString("es-CO")}/mes a PV/AFC` };
      }
      return { tiene: false };
    },
    // Borra solo registros del Plan, deja aportes manuales del user
    limpiar: (user, ownerId) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      for (const cat of Object.keys(newUser.gas)) {
        if (Array.isArray(newUser.gas[cat])) {
          newUser.gas[cat] = newUser.gas[cat].filter(g =>
            !(g._planAhorro && g.owner === ownerId &&
              (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC" || g.fiscalCode === "AP_TRIB_PENSION_VOL"))
          );
        }
      }
      return newUser;
    },
    inputs: [
      {
        key: "aporteMensual",
        label: "¿Cuánto vas a aportar al mes?",
        type: "currency",
        placeholder: "Ej: 1.500.000",
        helpText: "El motor verifica que no te pases del cap legal automáticamente.",
      },
      {
        key: "tipoCuenta",
        label: "Tipo de cuenta",
        type: "select",
        options: [
          { value: "AP_TRIB_PV", label: "Pensión Voluntaria" },
          { value: "AP_TRIB_AFC", label: "AFC (Ahorro Fomento Construcción)" },
        ],
        defaultValue: "AP_TRIB_AFC",
      },
    ],
    aplicar: (user, ownerId, data) => {
      const mensual = Number(data.aporteMensual) || 0;
      const tipo = data.tipoCuenta || "AP_TRIB_AFC";
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      const cat = "Aporte tributario";
      // Limpiamos solo entries de PV/AFC creadas por este Plan, dejamos
      // las de medicina y otras intactas. Aceptamos los 3 fiscalCodes
      // posibles (legacy AP_TRIB_PV oficial + AP_TRIB_PENSION_VOL legacy
      // creado en versiones previas del Plan que ten\u00edan el c\u00f3digo equivocado).
      newUser.gas[cat] = (newUser.gas[cat] || []).filter(g =>
        !(g._planAhorro && g.owner === ownerId &&
          (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC" || g.fiscalCode === "AP_TRIB_PENSION_VOL"))
      );
      const nombreTipo = tipo === "AP_TRIB_PV" ? "Aporte Pensión Voluntaria" : "Aporte AFC (vivienda)";
      newUser.gas[cat].push({
        id: "gas_pa_pv_" + Date.now(),
        owner: ownerId,
        cat,
        nombre: nombreTipo,
        fiscalCode: tipo,
        m: mensual,
        fuente: "Plan de Optimización",
        _planAhorro: true,
      });
      return newUser;
    },
    // Limpia aportes PV/AFC del Plan (no toca aportes manuales en Egresos)
    limpiar: (user, ownerId) => {
      const newUser = { ...user, gas: { ...(user.gas || {}) } };
      for (const cat of Object.keys(newUser.gas)) {
        if (!Array.isArray(newUser.gas[cat])) continue;
        newUser.gas[cat] = newUser.gas[cat].filter(g => !(
          g._planAhorro &&
          g.owner === ownerId &&
          (g.fiscalCode === "AP_TRIB_PV" || g.fiscalCode === "AP_TRIB_AFC" || g.fiscalCode === "AP_TRIB_PENSION_VOL")
        ));
      }
      return newUser;
    },
  },
  {
    id: "vivienda",
    icono: "🏠",
    titulo: "Intereses de vivienda habitacional",
    pregunta: "¿Pagás cuotas de un crédito hipotecario sobre tu vivienda principal?",
    explicacion: "Los intereses de hipoteca de tu vivienda son deducibles hasta 1.200 UVT/año (~$62.8M en 2026).",
    baseLegal: "Art. 119 ET",
    estimarAhorro: (data, det) => {
      const intereses = Number(data.interesesAnuales) || 0;
      const tope = 1200 * UVT;
      const deducible = Math.min(intereses, tope);
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
      return Math.min(Math.round(deducible * tasaMarg), saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.interesesAnuales) > 0,
    // Detecta si ya hay datos de vivienda. Dos vías:
    // 1) intereses ya guardados en fiscalProfile (cargados via Plan)
    // 2) deudas con fiscalCode DEU_NAT_VIVIENDA_HABITACIONAL (motor calcula intereses)
    yaTieneDatos: (owner, user, det) => {
      const intManual = Number(owner?.fiscalProfile?.interesesViviendaAnuales) || 0;
      if (intManual > 0) return { tiene: true, descripcion: `Ya cargaste $${intManual.toLocaleString("es-CO")}/año en intereses` };
      const deducVivienda = Number(det?.deducVivienda) || 0;
      if (deducVivienda > 0) {
        return { tiene: true, descripcion: `Ya hay deuda hipotecaria aplicándose (deducción: $${deducVivienda.toLocaleString("es-CO")})` };
      }
      return { tiene: false };
    },
    // Borra el dato manual (deja deudas hipotecarias intactas)
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
        ...o,
        fiscalProfile: { ...(o.fiscalProfile || {}), interesesViviendaAnuales: 0 },
      })),
    }),
    inputs: [{
      key: "interesesAnuales",
      label: "¿Cuánto pagaste de intereses (no capital) en el año?",
      type: "currency",
      placeholder: "Ej: 25.000.000",
      helpText: "El banco te entrega un certificado anual con el desglose de intereses pagados.",
    }],
    aplicar: (user, ownerId, data) => {
      const intereses = Number(data.interesesAnuales) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: { ...(o.fiscalProfile || {}), interesesViviendaAnuales: intereses },
        })),
      };
    },
    // Limpia el dato manual. Si la deducción venía de una deuda hipotecaria
    // cargada en el módulo Deudas (DEU_NAT_VIVIENDA_HABITACIONAL), eso queda
    // intacto — el user tiene que ir a Deudas para modificarla.
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        delete fp.interesesViviendaAnuales;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },

  // ═════════════════════════════════════════════════════════════════════════
  // ÁREAS PARA CÉDULA NO LABORAL (sesión 1-may-2026, feedback Santiago)
  //
  // Las 4 áreas anteriores aplican solo a personas con renta de TRABAJO
  // (salario u honorarios). Pero hay personas naturales con ingresos por
  // arriendos, dividendos, intereses — sin cédula laboral. Para esos
  // casos las palancas son distintas:
  //
  //   - Costos asociados a arriendos (depreciación, mantenimiento, etc.)
  //   - Dividendos no gravados Art. 49 ET (los que ya pagaron impuesto en
  //     la sociedad)
  //   - Descuento Art. 254 ET (impuestos pagados en el exterior — típico
  //     en arriendos USA bajo LLC personal o dividendos extranjeros)
  //   - Retenciones reales del año (cuando los pagadores aplicaron tasas
  //     distintas al estándar 3.5% / 7%)
  // ═════════════════════════════════════════════════════════════════════════

  {
    id: "costos_arriendo",
    icono: "🔧",
    titulo: "Costos asociados a tus arriendos",
    pregunta: "¿Tenés gastos asociados a tus inmuebles arrendados (mantenimiento, predial, comisiones, intereses bancarios)?",
    explicacion: "Los gastos directamente asociados al arriendo se RESTAN del ingreso bruto. Esto incluye: depreciación (~10% del valor del inmueble), intereses del crédito hipotecario, comisiones a inmobiliarias, mantenimiento, predial, seguros, y cualquier gasto relacionado. Es la palanca más impactante para personas con rentas de arriendo.",
    baseLegal: "Art. 26 ET (renta líquida = ingreso − gastos)",
    estimarAhorro: (data, det) => {
      const monto = Number(data.gastosAnuales) || 0;
      // Tasa marginal aproximada en cédula general (28-33% típico)
      const tasaMarg = (det?.tasaMarginal || 28) / 100;
      const saldoActual = Number(det?.impuesto) || 0;
      // Limitar al monto del ingreso no laboral (no puede ser más que eso)
      const ingNoLaboral = Number(det?.ingNoLaboral) || 0;
      const aplicable = Math.min(monto, ingNoLaboral);
      return Math.min(Math.round(aplicable * tasaMarg), saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.gastosAnuales) > 0,
    inputs: [{
      key: "gastosAnuales",
      label: "¿Cuánto suman tus gastos anuales asociados a los arriendos?",
      type: "currency",
      placeholder: "Ej: 80.000.000",
      helpText: "Sumá depreciación + intereses + mantenimiento + predial + comisiones + seguros. Típicamente 25-40% del arriendo bruto. Si no estás seguro, pedile el monto a tu contador o revisá tu declaración del año pasado.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.gastosAnuales) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            planOptimizacion: { ...((o.fiscalProfile || {}).planOptimizacion || {}), gastosArriendoAnuales: monto },
          },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.planOptimizacion?.gastosArriendoAnuales) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Gastos arriendo cargados: $${monto.toLocaleString("es-CO")}/año` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        const planOpt = { ...(fp.planOptimizacion || {}) };
        delete planOpt.gastosArriendoAnuales;
        fp.planOptimizacion = planOpt;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },

  {
    id: "dividendos_no_gravados",
    icono: "💎",
    titulo: "Dividendos NO gravados (Art. 49 ET)",
    pregunta: "¿Parte de tus dividendos vienen de utilidades que YA pagaron impuesto en la sociedad?",
    explicacion: "Cuando una sociedad ya pagó impuesto sobre sus utilidades, los dividendos que distribuye al accionista NO se gravan otra vez (Art. 49 ET). Pedile a tu contador o al revisor fiscal de la sociedad que te diga cuánto del dividendo recibido es gravado y cuánto NO. Solo la parte gravada paga impuesto al 15%.",
    baseLegal: "Art. 49 ET",
    estimarAhorro: (data, det) => {
      const monto = Number(data.montoNoGravado) || 0;
      // El ahorro es la tarifa de dividendos (15%) sobre el monto no gravado
      // que de otra forma se gravaría
      const divAnual = Number(det?.divAnual) || 0;
      const aplicable = Math.min(monto, divAnual);
      // Conservador: solo asumimos ahorro si excede los 300 UVT exentos
      const UVT_LOCAL = 52374;
      const yaExentos = Math.min(divAnual, 300 * UVT_LOCAL);
      const partGravable = Math.max(0, divAnual - yaExentos);
      const reduccionGravable = Math.min(aplicable, partGravable);
      const saldoActual = Number(det?.impuesto) || 0;
      return Math.min(Math.round(reduccionGravable * 0.15), saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.montoNoGravado) > 0,
    inputs: [{
      key: "montoNoGravado",
      label: "¿Cuánto de tus dividendos viene de utilidades ya gravadas en la sociedad?",
      type: "currency",
      placeholder: "Ej: 20.000.000",
      helpText: "Tu certificado de dividendos lo separa: 'distribuible no gravado' vs 'distribuible gravado'. Si no lo tenés, pedíselo al revisor fiscal de la sociedad. Si toda la utilidad distribuida ya pagó renta como sociedad, todo es no gravado.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.montoNoGravado) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            planOptimizacion: { ...((o.fiscalProfile || {}).planOptimizacion || {}), dividendosNoGravados: monto },
          },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.planOptimizacion?.dividendosNoGravados) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Dividendos no gravados: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        const planOpt = { ...(fp.planOptimizacion || {}) };
        delete planOpt.dividendosNoGravados;
        fp.planOptimizacion = planOpt;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },

  {
    id: "impuestos_exterior",
    icono: "🌍",
    titulo: "Impuestos pagados en el exterior",
    pregunta: "¿Pagaste impuestos en otro país sobre ingresos que también declarás en Colombia (ej: arriendos en USA, dividendos extranjeros)?",
    explicacion: "Si una propiedad o inversión está en otro país y allá ya pagás impuesto, podés DESCONTAR ese impuesto del impuesto colombiano peso a peso (Art. 254 ET). El descuento está topado al impuesto que pagarías en Colombia sobre ese mismo ingreso. Es típico para personas con propiedades en USA bajo LLC personal.",
    baseLegal: "Art. 254 ET",
    estimarAhorro: (data, det) => {
      const monto = Number(data.montoPagado) || 0;
      const saldoActual = Number(det?.impuesto) || 0;
      // El descuento es peso a peso, capeado al saldo a cargo
      return Math.min(monto, saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.montoPagado) > 0,
    inputs: [{
      key: "montoPagado",
      label: "¿Cuánto pagaste en impuestos en el exterior durante el año?",
      type: "currency",
      placeholder: "Ej: 25.000.000",
      helpText: "Convertí a pesos colombianos a la TRM del cierre del año. Para USA: federal income tax + state income tax. Necesitás certificación o la declaración del país extranjero como respaldo. Pedíselo a tu contador internacional.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.montoPagado) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            planOptimizacion: { ...((o.fiscalProfile || {}).planOptimizacion || {}), impuestosExteriorPagados: monto },
          },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.planOptimizacion?.impuestosExteriorPagados) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Impuestos exterior cargados: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        const planOpt = { ...(fp.planOptimizacion || {}) };
        delete planOpt.impuestosExteriorPagados;
        fp.planOptimizacion = planOpt;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },

  {
    id: "retenciones_reales",
    icono: "🧾",
    titulo: "Retenciones reales del año (avanzado, opcional)",
    pregunta: "¿Querés cargar las retenciones REALES que te aplicaron en lugar de la estimación automática?",
    explicacion: "Por defecto la app estima las retenciones según el tipo de ingreso (3.5% arriendos, 7% dividendos, etc.). Si tus pagadores te aplicaron un porcentaje distinto (autoretenciones, retención especial por arrendamientos comerciales, retenciones del exterior), cargá acá el monto real consolidado del año y reemplaza la estimación.",
    baseLegal: "Art. 365 ET",
    estimarAhorro: (data, det) => {
      const monto = Number(data.retencionAnual) || 0;
      const reteAuto = Number(det?.retefuenteNat) || 0;
      const saldoActual = Number(det?.impuesto) || 0;
      // Si la retención manual es mayor a la automática, hay ahorro
      // por la diferencia (capeado al saldo)
      const diferencia = Math.max(0, monto - reteAuto);
      return Math.min(diferencia, saldoActual);
    },
    permiteAplicarSinAhorro: (data) => Number(data.retencionAnual) > 0,
    inputs: [{
      key: "retencionAnual",
      label: "¿Cuánto te retuvieron en total durante el año?",
      type: "currency",
      placeholder: "Ej: 35.000.000",
      helpText: "Sumá los montos de TODOS tus certificados de retención del año (renta y/o IVA si aplica). Cada pagador (arrendatario, banco, agente retenedor) debe haberte enviado un certificado anual.",
    }],
    aplicar: (user, ownerId, data) => {
      const monto = Number(data.retencionAnual) || 0;
      return {
        ...user,
        owners: (user.owners || []).map(o => o.id !== ownerId ? o : ({
          ...o,
          fiscalProfile: {
            ...(o.fiscalProfile || {}),
            planOptimizacion: { ...((o.fiscalProfile || {}).planOptimizacion || {}), retencionesManualesAnio: monto },
          },
        })),
      };
    },
    yaTieneDatos: (owner) => {
      const monto = Number(owner?.fiscalProfile?.planOptimizacion?.retencionesManualesAnio) || 0;
      if (monto > 0) {
        return { tiene: true, descripcion: `Retenciones reales cargadas: $${monto.toLocaleString("es-CO")}` };
      }
      return { tiene: false };
    },
    limpiar: (user, ownerId) => ({
      ...user,
      owners: (user.owners || []).map(o => {
        if (o.id !== ownerId) return o;
        const fp = { ...(o.fiscalProfile || {}) };
        const planOpt = { ...(fp.planOptimizacion || {}) };
        delete planOpt.retencionesManualesAnio;
        fp.planOptimizacion = planOpt;
        return { ...o, fiscalProfile: fp };
      }),
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function DeclaracionFlow({
  user,
  estimacion,
  onUpdateUser,
  ano = 2025,
}) {
  const allOwners = useMemo(() => user?.owners || [], [user]);

  // Owner seleccionado (default: primero disponible)
  const [selectedOwnerId, setSelectedOwnerId] = useState(allOwners[0]?.id || "");
  const selectedOwner = useMemo(
    () => allOwners.find(o => o.id === selectedOwnerId) || allOwners[0],
    [allOwners, selectedOwnerId]
  );
  const isJuridica = selectedOwner?.type === "juridica";
  const ownerName = selectedOwner?.name || "vos";

  // Areas según owner
  const areas = isJuridica ? AREAS_JURIDICA : AREAS_NATURAL;

  // Datos del motor.
  // Sesión 1-may-2026 (feedback Santiago): el Plan de Optimización es un
  // OVERLAY. La `estimacion` que recibimos como prop fue calculada SIN
  // flag (vista "real"). Acá la recalculamos CON flag para que las áreas
  // del Plan (gastos arriendo, dividendos no gravados, etc.) impacten el
  // saldo y se vean los ahorros. Pero esto solo afecta lo que renderizamos
  // dentro de DeclaracionFlow — el resto del producto (simulador, vista
  // familiar, dashboard, recomendaciones) sigue viendo la `estimacion` real.
  const estimacionConPlan = useMemo(() => {
    return estimarImpuesto(user, { incluirPlanOptimizacion: true });
  }, [user]);

  const det = useMemo(() => {
    return estimacionConPlan?.detalle?.find(d => d.name === selectedOwner?.name);
  }, [estimacionConPlan, selectedOwner]);

  // Recomendaciones estratégicas (acciones futuras tipo contador estratega).
  // Sesión 1-may-2026: feedback Santiago. Pasamos `det` que SÍ incluye el
  // Plan, pero internamente las recomendaciones leen solo de fuentes reales
  // (user.deu, user.gas) para "qué tiene cargado el user", no contaminadas
  // por el wizard.
  const recomendacionesEstrategicas = useMemo(() => {
    if (!user || !selectedOwner || !det) return [];
    return generarRecomendacionesEstrategicas(user, selectedOwner, det);
  }, [user, selectedOwner, det]);

  // Saldo a cargo ANTES de optimizaciones (capturado al montar)
  const saldoOriginalRef = useRef(null);
  useEffect(() => {
    if (selectedOwner && saldoOriginalRef.current === null) {
      saldoOriginalRef.current = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
    }
  }, [det, selectedOwner]);

  // Reset cuando cambia owner
  useEffect(() => {
    saldoOriginalRef.current = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
    setRespuestasArea({});
    setEtapaActiva(1);
    // scroll arriba
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedOwnerId]);

  const saldoOriginal = saldoOriginalRef.current ?? Number(det?.saldoACargo ?? det?.impuesto ?? 0);
  const saldoActual = Number(det?.saldoACargo ?? det?.impuesto ?? 0);
  const ingresoAnual = Number(det?.ingreso) || 0;
  const impuestoBruto = Number(det?.impuesto) || 0;
  const retenciones = Number(det?.retefuenteNat ?? det?.retefuenteCalc ?? 0);

  // Etapa actual (1, 2, o 3) — controla qué se muestra
  const [etapaActiva, setEtapaActiva] = useState(1);

  // Respuestas de cada área en el checklist
  const [respuestasArea, setRespuestasArea] = useState({});
  const [areaExpandida, setAreaExpandida] = useState(null);

  // Refs para scroll a cada etapa
  const refEtapa2 = useRef(null);
  const refEtapa3 = useRef(null);

  function avanzarA(etapa) {
    setEtapaActiva(etapa);
    setTimeout(() => {
      const ref = etapa === 2 ? refEtapa2 : etapa === 3 ? refEtapa3 : null;
      if (ref?.current) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function aplicarArea(area, data) {
    const ahorro = area.estimarAhorro ? area.estimarAhorro(data, det) : 0;
    const newUser = area.aplicar(user, selectedOwner.id, data);
    onUpdateUser(newUser);
    setRespuestasArea(prev => ({ ...prev, [area.id]: { tipo: "aplicado", ahorro, data } }));
    setAreaExpandida(null);
  }

  function noAplicaArea(area) {
    setRespuestasArea(prev => ({ ...prev, [area.id]: { tipo: "noaplica", ahorro: 0 } }));
    setAreaExpandida(null);
  }

  // Permite re-abrir un área para editar el dato. Funciona en 2 escenarios:
  // (a) área aplicada en esta sesión: borramos la respuesta del state local
  //     (los datos en user persistidos quedan, el user los reescribe arriba)
  // (b) área "yaConfigurado" (datos detectados de Egresos/fiscalProfile):
  //     limpiamos los datos legacy del user para que vuelva a estar en blanco
  //     y el user pueda reescribir desde cero.
  function editarArea(area) {
    // Borra la respuesta del state local (si la había)
    setRespuestasArea(prev => {
      const next = { ...prev };
      delete next[area.id];
      return next;
    });
    // Si el área tiene un método "limpiar" para borrar datos preexistentes,
    // lo invocamos (útil para áreas "yaConfigurado" que tienen datos de Egresos).
    if (area.limpiar) {
      const newUser = area.limpiar(user, selectedOwner.id);
      onUpdateUser(newUser);
    }
    // Abrir el panel para que el user reedite
    setAreaExpandida(area.id);
  }

  const cambiosAplicados = Object.entries(respuestasArea).filter(([_, r]) => r.tipo === "aplicado");
  const ahorroTotal = cambiosAplicados.reduce((s, [_, r]) => s + (r.ahorro || 0), 0);
  // Un área está "revisada" si: (a) el user respondió manualmente OR (b) el sistema
  // detecta que ya tiene datos cargados (ej: salud cargada en Egresos previamente).
  const todasRevisadas = areas.every(a => {
    if (respuestasArea[a.id]?.tipo) return true;
    if (a.yaTieneDatos && selectedOwner) {
      const datos = a.yaTieneDatos(selectedOwner, user, det);
      if (datos?.tiene) return true;
    }
    return false;
  });

  // Sin owners: estado vacío
  if (!selectedOwner) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.txt, marginBottom: 8 }}>
          Empezá tu declaración
        </h1>
        <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.5, maxWidth: 440, margin: "0 auto" }}>
          Aún no cargaste personas fiscales. Andá a "Mi cuenta" y agregá una persona natural o
          jurídica para empezar.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {/* Sesión 2-may-2026: PageHeader unificado estilo Optimus */}
      <PageHeader
        label="Impuestos"
        title="Declaración de renta"
        subtitle="Borrador, optimización y formulario final · F-110 / F-210"
      />

      {/* ───────────────────── SELECTOR DE OWNER (compacto, top) ───────────────────── */}
      {allOwners.length > 1 && (
        <div style={{
          marginBottom: 16,
          padding: "12px 14px",
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, color: C.txt3, fontWeight: 600 }}>
            Estás trabajando con:
          </div>
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            style={{
              flex: 1,
              minWidth: 180,
              padding: "8px 12px",
              background: C.bg3,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.txt,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {allOwners.map(o => (
              <option key={o.id} value={o.id}>
                {o.type === "juridica" ? "🏢" : "👤"}  {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ETAPA 1 · TU BORRADOR (lo que la app entiende de tus datos)
          ═══════════════════════════════════════════════════════════════════════ */}
      <SeccionEtapa
        numero={1}
        titulo="Tu borrador"
        subtitulo="Esto entiende la app con los datos que cargaste"
        activa={true}
        completa={etapaActiva > 1}
      >
        {/* Saldo a cargo destacado */}
        <div style={{
          padding: "24px 24px",
          background: `linear-gradient(135deg, ${C.bg3} 0%, rgba(124,58,237,0.10) 100%)`,
          borderRadius: 12,
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, color: C.txt2, marginBottom: 6 }}>
            {saldoActual > 0 ? (
              <>{isJuridica ? `Lo que tendría que pagar ${ownerName}` : "Lo que te tocaría pagar"}:</>
            ) : (
              <span style={{ color: C.green }}>✅ {isJuridica ? `${ownerName} no debería pagar nada` : "No te tocaría pagar nada"} · las retenciones cubren todo</span>
            )}
          </div>
          <div style={{
            fontSize: 44, fontWeight: 900, color: saldoActual > 0 ? C.txt : C.green,
            lineHeight: 1, letterSpacing: -1, fontFamily: "monospace",
          }}>
            {fm(Math.max(0, saldoActual))}
          </div>
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 8 }}>
            Estimación según los datos cargados a hoy. Tu contador es quien firma.
          </div>
        </div>

        {/* Desglose en 4 cards pequeños */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
          <MiniCard
            icono="💰"
            label={isJuridica ? "Ingresó la empresa" : "Ganaste"}
            valor={fmShort(ingresoAnual)}
            color={C.green}
          />
          <MiniCard
            icono="🧾"
            label="Impuesto que toca"
            valor={fmShort(impuestoBruto)}
            color={C.orange}
            sub={ingresoAnual > 0 ? `${(impuestoBruto / ingresoAnual * 100).toFixed(1)}% efectiva` : ""}
          />
          <MiniCard
            icono="✅"
            label="Ya pagaste"
            valor={"-" + fmShort(retenciones)}
            color={C.blue}
            sub="retenciones del año"
          />
          <MiniCard
            icono="📅"
            label="Falta pagar"
            valor={fmShort(Math.max(0, saldoActual))}
            color={C.purple}
            sub="se paga en mayo"
          />
        </div>

        {/* CTA continuar */}
        {etapaActiva === 1 && (
          <button
            onClick={() => avanzarA(2)}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: C.purple,
              border: "none",
              borderRadius: 10,
              color: "#000",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Continuar al Paso 2: Optimización →
          </button>
        )}
      </SeccionEtapa>

      {/* ═══════════════════════════════════════════════════════════════════════
          ETAPA 2 · OPTIMIZACIÓN (preguntas de ahorro legal)
          ═══════════════════════════════════════════════════════════════════════ */}
      {etapaActiva >= 2 && (
        <div ref={refEtapa2}>
          <SeccionEtapa
            numero={2}
            titulo="Optimización"
            subtitulo="Te hago algunas preguntas para encontrar formas legales de pagar menos"
            activa={etapaActiva === 2}
            completa={etapaActiva > 2}
          >
            {/* Header con ahorro vivo */}
            {ahorroTotal > 0 && (
              <div style={{
                padding: "12px 16px",
                background: C.greenBg,
                border: `1px solid ${C.green}40`,
                borderRadius: 10,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 24 }}>💚</span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: C.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Ahorro detectado hasta ahora
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>
                    {fm(ahorroTotal)}
                  </div>
                </div>
              </div>
            )}

            {/* Lista de áreas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {areas.map((area, i) => (
                <AreaCheck
                  key={area.id}
                  area={area}
                  index={i + 1}
                  expandida={areaExpandida === area.id}
                  respuesta={respuestasArea[area.id]}
                  onExpandir={() => setAreaExpandida(areaExpandida === area.id ? null : area.id)}
                  onAplicar={(data) => aplicarArea(area, data)}
                  onNoAplica={() => noAplicaArea(area)}
                  onEditar={() => editarArea(area)}
                  det={det}
                  owner={selectedOwner}
                  user={user}
                />
              ))}
            </div>

            {/* Estrategias del contador (acciones futuras proactivas).
                Solo se muestran cuando hay saldo a cargo > 0 — el motor
                ya devuelve [] en otros casos. Aparece debajo del checklist
                porque después de revisar lo existente, el siguiente paso
                lógico es ver "qué acciones nuevas podría tomar". */}
            {recomendacionesEstrategicas.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <RecomendacionesEstrategicas recomendaciones={recomendacionesEstrategicas} />
              </div>
            )}

            {/* CTA continuar a etapa 3 */}
            {etapaActiva === 2 && (
              <button
                onClick={() => avanzarA(3)}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  background: todasRevisadas ? C.green : C.bg3,
                  border: todasRevisadas ? "none" : `1px solid ${C.border}`,
                  borderRadius: 10,
                  color: todasRevisadas ? "#000" : C.txt2,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                {todasRevisadas
                  ? "Ver mi declaración optimizada →"
                  : `Ver mi declaración optimizada → (${cambiosAplicados.length}/${areas.length} respondidas)`}
              </button>
            )}
          </SeccionEtapa>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ETAPA 3 · TU DECLARACIÓN CASI LISTA
          ═══════════════════════════════════════════════════════════════════════ */}
      {etapaActiva >= 3 && (
        <div ref={refEtapa3}>
          <SeccionEtapa
            numero={3}
            titulo="Tu declaración casi lista"
            subtitulo="Este es el escenario optimizado, listo para que tu contador valide"
            activa={true}
            completa={false}
          >
            {/* Comparación antes/después */}
            <div style={{
              padding: "20px 22px",
              background: `linear-gradient(135deg, ${C.bg3} 0%, rgba(74,222,128,0.08) 100%)`,
              borderRadius: 12,
              marginBottom: 16,
              border: `1.5px solid ${C.green}30`,
            }}>
              <div style={{ fontSize: 11, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                Comparación
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.txt3, marginBottom: 4 }}>Antes (sin optimizar)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.txt2, textDecoration: ahorroTotal > 0 ? "line-through" : "none", fontFamily: "monospace" }}>
                    {fm(saldoOriginal)}
                  </div>
                </div>
                <div style={{ fontSize: 24, color: C.txt3 }}>→</div>
                <div>
                  <div style={{ fontSize: 11, color: C.green, marginBottom: 4, fontWeight: 700 }}>Después (optimizado)</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.green, fontFamily: "monospace" }}>
                    {fm(saldoActual)}
                  </div>
                </div>
              </div>
              {ahorroTotal > 0 && (
                <div style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: C.greenBg,
                  borderRadius: 8,
                  fontSize: 13,
                  color: C.txt,
                  fontWeight: 700,
                  textAlign: "center",
                }}>
                  💚 Ahorraste {fm(ahorroTotal)} de manera legal
                </div>
              )}
            </div>

            {/* Lista de cambios aplicados */}
            {cambiosAplicados.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.txt2, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Cambios aplicados ({cambiosAplicados.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {cambiosAplicados.map(([areaId, resp]) => {
                    const area = areas.find(a => a.id === areaId);
                    if (!area) return null;
                    return (
                      <div key={areaId} style={{
                        padding: "10px 14px",
                        background: C.bg2,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}>
                        <span style={{ fontSize: 16 }}>{area.icono}</span>
                        <div style={{ flex: 1, fontSize: 13, color: C.txt }}>{area.titulo}</div>
                        <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
                          -{fm(resp.ahorro)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Acción final: descargar PDF para el contador. El simulador
                vive como entrada propia en el menú lateral, así que no lo
                duplicamos aquí (feedback Santiago 1-may-2026). */}
            <div style={{ marginBottom: 16 }}>
              <BotonAccion
                icono="📄"
                titulo="Descargar PDF"
                subtitulo="Para enviar a tu contador"
                color={C.purple}
                onClick={() => exportarBorradorPDF(user, selectedOwner, estimacionConPlan, ano)}
              />
            </div>

            {/* Detalle del formulario embebido (modo experto inline)
                Envuelto en ErrorBoundary para que cualquier error en
                generarBorradorF110/F210 o en el render de los renglones
                no rompa toda la pantalla. */}
            <DetalleFormularioErrorBoundary
              user={user}
              owner={selectedOwner}
              estimacion={estimacionConPlan}
              ano={ano}
              isJuridica={isJuridica}
            />
          </SeccionEtapa>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────

function SeccionEtapa({ numero, titulo, subtitulo, activa, completa, children }) {
  return (
    <div style={{
      marginBottom: 18,
      padding: "20px 22px",
      background: C.bg2,
      border: `1.5px solid ${activa ? C.purple : C.border}`,
      borderRadius: 14,
      opacity: completa ? 0.85 : 1,
      transition: "all 0.3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: completa ? C.green : (activa ? C.purple : C.bg3),
          color: completa || activa ? "#000" : C.txt3,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, flexShrink: 0,
        }}>
          {completa ? "✓" : numero}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.txt3, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Paso {numero}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
            {titulo}
          </h2>
          {subtitulo && (
            <div style={{ fontSize: 13, color: C.txt2, marginTop: 2 }}>{subtitulo}</div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function MiniCard({ icono, label, valor, color, sub }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: C.bg3,
      border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 10, color: C.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {icono} {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>
        {valor}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.txt3, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function AreaCheck({ area, index, expandida, respuesta, onExpandir, onAplicar, onNoAplica, onEditar, det, owner, user }) {
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

  // Determina si el botón "Aplicar" debe estar habilitado.
  // Por default: solo si hay ahorro detectado.
  // Pero si el área define `permiteAplicarSinAhorro`, permitimos aplicar
  // aunque el motor no detecte ahorro hoy (caso típico: dato válido pero
  // motor no tiene salario cargado todavía, o saldo a cargo ya en cero).
  const permiteAplicar = useMemo(() => {
    if (ahorroPreview > 0) return true;
    if (area.permiteAplicarSinAhorro && area.permiteAplicarSinAhorro(valores, det)) return true;
    return false;
  }, [ahorroPreview, area, valores, det]);

  // Aviso especial del área (ej: PV cuando no hay espacio disponible)
  const avisoEspecial = useMemo(() => {
    if (!area.avisoEspecial) return null;
    return area.avisoEspecial(det);
  }, [area, det]);

  // Detector de datos preexistentes en el sistema.
  // Si el motor ya tiene info cargada (ej: gastos de salud en Egresos,
  // dependientes en fiscalProfile, etc.), evitamos preguntar de cero.
  const datosExistentes = useMemo(() => {
    if (!area.yaTieneDatos || !owner) return { tiene: false };
    return area.yaTieneDatos(owner, user, det);
  }, [area, owner, user, det]);

  const yaRespondida = !!respuesta;
  const aplicada = respuesta?.tipo === "aplicado";
  const noAplica = respuesta?.tipo === "noaplica";
  // Marcamos como "ya configurado" si los datos existen en el sistema y el user
  // no respondió manualmente esta área en esta sesión.
  const yaConfigurado = !yaRespondida && datosExistentes.tiene;

  const borderColor = aplicada || yaConfigurado ? C.green : noAplica ? C.txt3 : (expandida ? C.blue : C.border);

  return (
    <div style={{
      background: aplicada ? "rgba(74,222,128,0.05)" : C.bg2,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "all 0.2s",
    }}>
      <div style={{ position: "relative" }}>
      <button
        onClick={!yaRespondida && !yaConfigurado ? onExpandir : undefined}
        disabled={yaRespondida || yaConfigurado}
        style={{
          width: "100%",
          padding: "12px 14px",
          paddingRight: (yaRespondida || yaConfigurado) ? 90 : 14,
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: (yaRespondida || yaConfigurado) ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: aplicada || yaConfigurado ? C.green : noAplica ? C.bg3 : C.bg3,
          color: aplicada || yaConfigurado ? "#000" : noAplica ? C.txt3 : C.txt2,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, flexShrink: 0,
        }}>
          {aplicada || yaConfigurado ? "✓" : noAplica ? "—" : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>{area.icono}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>
              {area.titulo}
            </span>
            {aplicada && respuesta.ahorro > 0 && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: C.greenBg, color: C.green, fontWeight: 700,
              }}>
                💚 {fmShort(respuesta.ahorro)}
              </span>
            )}
            {yaConfigurado && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: C.greenBg, color: C.green, fontWeight: 700,
              }}>
                ✓ Ya cargado
              </span>
            )}
            {noAplica && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                background: C.bg3, color: C.txt3, fontWeight: 600,
              }}>
                No aplica
              </span>
            )}
          </div>
          {!expandida && !yaRespondida && !yaConfigurado && (
            <div style={{ fontSize: 12, color: C.txt3, marginTop: 4, lineHeight: 1.3 }}>
              {area.pregunta}
            </div>
          )}
          {yaConfigurado && datosExistentes.descripcion && (
            <div style={{ fontSize: 12, color: C.txt2, marginTop: 4, lineHeight: 1.3 }}>
              {datosExistentes.descripcion}
            </div>
          )}
        </div>
        {!yaRespondida && !yaConfigurado && (
          <div style={{ fontSize: 14, color: C.txt3, transform: expandida ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
            ▸
          </div>
        )}
      </button>

      {/* Botón "Editar" para áreas ya aplicadas o ya configuradas.
          Posicionado absolute para no entrar en conflicto con el button
          principal. Permite re-abrir el panel y modificar el dato. */}
      {(yaRespondida || yaConfigurado) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onEditar) onEditar();
          }}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            padding: "6px 10px",
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.txt2,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Modificar este dato"
        >
          ✏️ Editar
        </button>
      )}
      </div>

      {expandida && (
        <div style={{ padding: "0 14px 14px 54px" }}>
          <div style={{ padding: "10px 12px", background: C.bg3, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 4 }}>
              {area.pregunta}
            </div>
            <div style={{ fontSize: 12, color: C.txt2, lineHeight: 1.5 }}>
              {area.explicacion}
            </div>
            <div style={{ fontSize: 10, color: C.txt3, marginTop: 4, fontStyle: "italic" }}>
              Base legal: {area.baseLegal}
            </div>
          </div>

          {/* Aviso especial del área (ej: PV/AFC sin espacio disponible) */}
          {avisoEspecial && (
            <div style={{
              padding: "10px 12px",
              background: avisoEspecial.tipo === "warning" ? C.orangeBg : C.blueBg,
              border: `1px solid ${avisoEspecial.tipo === "warning" ? C.orange : C.blue}40`,
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 12,
              color: C.txt2,
              lineHeight: 1.5,
            }}>
              <strong style={{ color: avisoEspecial.tipo === "warning" ? C.orange : C.blue }}>
                {avisoEspecial.tipo === "warning" ? "⚠️ Atención: " : "ℹ️ Importante: "}
              </strong>
              {avisoEspecial.mensaje}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {(area.inputs || []).map(input => (
              <InputInline
                key={input.key}
                input={input}
                value={valores[input.key]}
                onChange={(v) => setValores(prev => ({ ...prev, [input.key]: v }))}
              />
            ))}
          </div>

          {ahorroPreview > 0 && (
            <div style={{
              padding: "8px 12px",
              background: C.greenBg,
              border: `1px solid ${C.green}40`,
              borderRadius: 8,
              marginBottom: 10,
              fontSize: 13,
              color: C.green,
              fontWeight: 700,
            }}>
              💚 Ahorro estimado al confirmar: <strong>{fm(ahorroPreview)}</strong>
            </div>
          )}

          {/* Caso: dato válido pero ahorro estimado es 0 (ej: salario no
              cargado todavía o saldo a cargo ya en cero por retenciones).
              Igual permitimos aplicar para guardar el dato. */}
          {ahorroPreview === 0 && permiteAplicar && (
            <div style={{
              padding: "8px 12px",
              background: C.blueBg,
              border: `1px solid ${C.blue}40`,
              borderRadius: 8,
              marginBottom: 10,
              fontSize: 12,
              color: C.txt2,
              lineHeight: 1.4,
            }}>
              ℹ️ El motor no detecta ahorro inmediato (puede que falte cargar tu salario
              o las retenciones ya cubran todo). Igual <strong style={{ color: C.txt }}>el dato queda guardado</strong> en
              tu perfil para próximos cálculos.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onAplicar(valores)}
              disabled={!permiteAplicar}
              style={{
                flex: 1, minWidth: 140,
                padding: "10px 14px",
                background: permiteAplicar ? C.green : C.bg3,
                border: "none",
                borderRadius: 8,
                color: permiteAplicar ? "#000" : C.txt3,
                fontSize: 13,
                fontWeight: 700,
                cursor: permiteAplicar ? "pointer" : "not-allowed",
              }}
            >
              ✓ Sí, aplicar
            </button>
            <button
              onClick={onNoAplica}
              style={{
                padding: "10px 14px",
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

function InputInline({ input, value, onChange }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.txt2, marginBottom: 4 }}>
        {input.label}
      </label>
      {input.type === "select" ? (
        <select
          value={value || input.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
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
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px" }}>
          <span style={{ color: C.txt3, fontSize: 13 }}>$</span>
          <input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={input.placeholder}
            style={{ flex: 1, padding: "9px 0", background: "transparent", border: "none", color: C.txt, fontSize: 13, outline: "none" }}
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
            padding: "9px 12px",
            background: C.bg3,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            color: C.txt,
            fontSize: 13,
            outline: "none",
          }}
        />
      )}
      {input.helpText && (
        <div style={{ fontSize: 10, color: C.txt3, marginTop: 4, lineHeight: 1.3 }}>
          {input.helpText}
        </div>
      )}
    </div>
  );
}

function BotonAccion({ icono, titulo, subtitulo, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 16px",
        background: C.bg2,
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icono}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.txt }}>{titulo}</div>
        {subtitulo && (
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 2 }}>{subtitulo}</div>
        )}
      </div>
      <span style={{ fontSize: 14, color: C.txt3 }}>→</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DETALLE DEL FORMULARIO (embebido en Etapa 3, expandible)
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY para DetalleFormulario
// Captura cualquier error en el render y muestra un mensaje útil en lugar
// de romper toda la pantalla. Sesión 1-may-2026: agregado tras feedback
// "no se puede ver el detalle del formulario, sale error". Sin esto, un
// error en generarBorradorF110 o en el render de un renglón rompía el
// componente entero sin pista de qué falló.
// ─────────────────────────────────────────────────────────────────────────
class DetalleFormularioErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Log útil para debug en console del browser
    console.error("[DetalleFormulario] Error capturado:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: C.bg3,
          border: `1px solid ${C.red}`,
          borderRadius: 10,
          padding: "16px 18px",
          color: C.txt2,
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <strong style={{ color: C.red, fontSize: 14 }}>
              No pudimos generar el detalle del formulario
            </strong>
          </div>
          <p style={{ margin: "0 0 10px", color: C.txt2 }}>
            Hubo un problema técnico al armar el detalle línea por línea.
            Tu cálculo y tu PDF siguen funcionando — solo es el detalle expandible
            de esta sección el que falló.
          </p>
          {this.state.error && (
            <details style={{ marginTop: 8, fontSize: 11, color: C.txt3 }}>
              <summary style={{ cursor: "pointer" }}>Detalles técnicos (para soporte)</summary>
              <pre style={{
                marginTop: 6, padding: "8px 10px", background: C.bg2,
                borderRadius: 6, fontSize: 10, overflow: "auto", maxHeight: 200,
              }}>
                {String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 10, padding: "6px 12px", background: "transparent",
              border: `1px solid ${C.border}`, borderRadius: 6,
              color: C.txt2, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return <DetalleFormulario {...this.props} />;
  }
}

function DetalleFormulario({ user, owner, estimacion, ano, isJuridica }) {
  const [expandido, setExpandido] = useState(false);

  // Computar renglones con sus valores resueltos. Hay 2 tipos:
  // - tipo "editable": tienen `valor` directo
  // - tipo "formula": tienen función `calc(vals)` que depende de otros renglones
  // Necesitamos resolver las formulas iterativamente sobre el mapa de valores.
  const renglones = useMemo(() => {
    if (!owner) return null;
    try {
      const raw = isJuridica
        ? generarBorradorF110(user, owner, estimacion, ano)
        : generarBorradorF210(user, owner, estimacion, ano);
      if (!Array.isArray(raw)) return [];

      // Construir mapa de valores: número de renglón -> valor numérico
      const vals = {};
      // Pasada 1: cargar valores directos
      for (const r of raw) {
        if (r && typeof r.valor === "number" && !Number.isNaN(r.valor)) {
          vals[r.numero] = r.valor;
        }
      }
      // Pasada 2-N: computar formulas hasta que estabilicen (max 5 iteraciones
      // por si hay dependencias en cadena)
      for (let iter = 0; iter < 5; iter++) {
        let cambios = false;
        for (const r of raw) {
          if (r && r.tipo === "formula" && typeof r.calc === "function") {
            try {
              const nuevoValor = r.calc(vals);
              const valorNum = Number(nuevoValor) || 0;
              if (vals[r.numero] !== valorNum) {
                vals[r.numero] = valorNum;
                cambios = true;
              }
            } catch (e) {
              // Formula con error: dejar 0 y seguir
              vals[r.numero] = 0;
            }
          }
        }
        if (!cambios) break;
      }

      // Devolver renglones con valor resuelto inyectado
      return raw.map(r => ({
        ...r,
        valorResuelto: typeof vals[r.numero] === "number" ? vals[r.numero] : 0,
      }));
    } catch (e) {
      console.error("Error generando borrador:", e);
      return [];
    }
  }, [user, owner, estimacion, ano, isJuridica]);

  if (!Array.isArray(renglones) || renglones.length === 0) return null;
  const SECCIONES = isJuridica ? SECCIONES_F110 : SECCIONES_F210;
  const ordenSecciones = isJuridica
    ? ["patrimonio", "ingresos", "costos", "renta", "impuesto", "liquidacion"]
    : ["patrimonio", "trabajo", "deducciones", "capital", "noLaboral", "dividendos", "rentaTotal", "impuesto", "liquidacion"];

  // Filtrar solo renglones con valor resuelto > 0
  const renglonesConValor = renglones.filter(r => r && r.valorResuelto > 0);

  return (
    <div style={{
      background: C.bg3,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpandido(!expandido)}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>
            Ver el detalle del formulario {isJuridica ? "F-110" : "F-210"}
          </div>
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 2 }}>
            Cada renglón con valor según los datos cargados — para que tu contador valide
          </div>
        </div>
        <span style={{ fontSize: 14, color: C.txt3, transform: expandido ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          ▸
        </span>
      </button>

      {expandido && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
          {ordenSecciones.map(seccionId => {
            const renglonesSeccion = renglonesConValor.filter(r => r.seccion === seccionId);
            if (renglonesSeccion.length === 0) return null;
            // SECCIONES_F110/F210 son objetos { label, icon, color }
            // (no strings). Hay que extraer .label para mostrar.
            const seccionInfo = SECCIONES[seccionId] || {};
            const seccionLabel = seccionInfo.label || seccionId;
            const seccionIcon = seccionInfo.icon || "";
            const seccionColor = seccionInfo.color || C.txt3;
            return (
              <div key={seccionId} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: seccionColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  {seccionIcon && <span style={{ fontSize: 13 }}>{seccionIcon}</span>}
                  {seccionLabel}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {renglonesSeccion.map(r => (
                    <div key={r.numero} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 10px",
                      background: r.destacado ? C.bg2 : "transparent",
                      borderRadius: 6,
                      fontSize: 12,
                    }}>
                      <span style={{ color: C.txt3, fontFamily: "monospace", flexShrink: 0, width: 28 }}>
                        {r.numero}
                      </span>
                      <span style={{ flex: 1, color: r.destacado ? C.txt : C.txt2, fontWeight: r.destacado ? 700 : 400 }}>
                        {r.concepto}
                      </span>
                      <span style={{ fontFamily: "monospace", color: r.destacado ? C.txt : C.txt2, fontWeight: r.destacado ? 700 : 400 }}>
                        {fm(r.valorResuelto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
