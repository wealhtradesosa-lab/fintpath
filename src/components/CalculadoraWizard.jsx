// ═══════════════════════════════════════════════════════════════════════════
// CALCULADORA WIZARD — Commit 8.5
// ─────────────────────────────────────────────────────────────────────────
// Flujo guiado de 5 pasos para reemplazar la vista "todo a la vez" de la
// Calculadora. El usuario avanza uno por uno, con progreso visible, y al
// final ve su impuesto estimado + 3 acciones concretas.
//
// Arquitectura:
// - Estado local `currentStep` (0-4). Persiste en localStorage para que si
//   sale y vuelve, siga donde estaba.
// - Cada paso renderiza una sección distinta pero comparten el mismo
//   `selectedOwnerId` y `fiscalProfile` via props.
// - Botón "Ver todo a la vez" eliminado en commit 9.11 (modo clásico ya no se usa).
// - Reutiliza lógica de estimarImpuesto, getFiscalWarnings, data gaps.
//
// Este componente NO toca el motor ni la persistencia. Solo reorganiza la
// presentación. Los switches siguen persistiendo en owner.fiscalProfile
// igual que antes.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from "react";
import { montoPromedioMensual } from "../lib/flowHelpers.js";
import { estimarImpuesto, UVT } from "../lib/taxCO.js";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { GRUPOS_SIMPLE } from "../lib/regimenSimple.js";
// Commit 21 Tarea 3: detector de palancas del Optimizador V2 para mostrar
// recomendación destacada de Régimen Simple cuando aplica
import { detectarPalancasAutomatizables } from "../lib/optimizador.js";
import { C, F as F_CENTRAL, S, R } from "../lib/designTokens.js";
import AjustesFiscalesPersonalizados from "./AjustesFiscalesPersonalizados";

// Alias de compatibilidad: T mapea a los tokens centrales C.
// Los archivos que ya usan T.txt, T.bl, T.green etc siguen funcionando,
// pero ahora todos los colores vienen del mismo sitio (designTokens.js).
const T = {
  bg: C.bg, bg2: C.surface, bg3: C.raised,
  txt: C.text, txt2: C.muted, txt3: C.subtle,
  border: C.border,
  green: C.ok, red: C.danger, orange: C.warn, blue: C.accent, purple: C.purple,
};

// F: re-export del sistema tipográfico central. Igual que antes pero unificado.
const F = F_CENTRAL;

const fm = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString("es-CO");
};

const STEPS = [
  { id: 0, titulo: "¿Para quién?", descripcion: "Elegí el propietario fiscal" },
  { id: 1, titulo: "Tus datos", descripcion: "Revisá lo que ya cargaste" },
  { id: 2, titulo: "Tu situación", descripcion: "Familia, auxilios, régimen" },
  { id: 3, titulo: "Este año", descripcion: "Eventos y beneficios especiales" },
  { id: 4, titulo: "Resultado", descripcion: "Tu impuesto y próximos pasos" },
];

// ─────────────────────────────────────────────────────────────────────────
// Stepper visual
// ─────────────────────────────────────────────────────────────────────────
function Stepper({ currentStep, onGotoStep }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: "0 4px", flexWrap: "wrap" }}>
      {STEPS.map((s, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        const isFuture = i > currentStep;
        return (
          <button
            key={s.id}
            onClick={() => !isFuture && onGotoStep(i)}
            disabled={isFuture}
            style={{
              flex: "1 1 100px",
              minWidth: 0,
              padding: "8px 6px",
              background: isActive ? "rgba(59,130,246,0.12)" : isDone ? "rgba(34,197,94,0.08)" : T.bg3,
              border: "1px solid " + (isActive ? T.blue : isDone ? T.green : T.border),
              borderRadius: 8,
              color: isActive ? T.blue : isDone ? T.green : T.txt3,
              cursor: isFuture ? "not-allowed" : "pointer",
              textAlign: "center",
              opacity: isFuture ? 0.5 : 1,
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {isDone ? "✓" : `${i + 1}`} · {s.titulo}
            </div>
            <div style={{ fontSize: 9, color: isActive ? T.blue : T.txt3, lineHeight: 1.3, display: isActive ? "block" : "none" }}>
              {s.descripcion}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Botón de navegación
// ─────────────────────────────────────────────────────────────────────────
function NavButtons({ currentStep, onBack, onNext, disableNext, nextLabel }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20, paddingTop: 18, borderTop: "1px solid " + T.border }}>
      {currentStep > 0 ? (
        <button
          onClick={onBack}
          style={{ padding: "10px 18px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          ← Atrás
        </button>
      ) : <div />}
      {onNext && (
        <button
          onClick={onNext}
          disabled={disableNext}
          style={{ padding: "10px 22px", background: disableNext ? T.bg3 : T.green, border: "none", color: disableNext ? T.txt3 : "#000", borderRadius: 8, cursor: disableNext ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}
        >
          {nextLabel || "Siguiente →"}
        </button>
      )}
    </div>
  );
}

// Helper: ¿tiene datos de fiscalProfile más allá del default?
function ownerConfigurado(owner) {
  const fp = owner?.fiscalProfile || {};
  // Fix 9.6: si el usuario termino el wizard explicitamente (llego al Paso 5
  // y confirmo), se marca wizardCompletado=true. Ese flag por si solo ya
  // cuenta como "configurado" — cubre el caso valido de owners que no
  // tienen ninguna optimizacion aplicable a su situacion.
  if (fp.wizardCompletado) return true;

  // Fallback: si al menos activo un switch, consideramos que ya interactuo.
  const tieneDep = (fp.dependientes?.cantidad || 0) > 0;
  const tieneAuxilio = !!(fp.auxilios?.alimentacion || fp.auxilios?.transporte);
  const tieneContab = !!fp.obligadoContabilidad;
  const tieneHonorPers = !!fp.honorariosConPersonal;
  const tieneEventos = !!(fp.eventosAno?.recibioHerencia || fp.eventosAno?.vendioInmuebleAntiguo || fp.eventosAno?.ganoLoteria);
  const tieneDon = (fp.donaciones?.monto || 0) > 0;
  const tieneCTI = (fp.inversionesCTI?.monto || 0) > 0;
  const tieneRegimen = !!fp.regimenEspecial;
  return tieneDep || tieneAuxilio || tieneContab || tieneHonorPers || tieneEventos || tieneDon || tieneCTI || tieneRegimen;
}

// Contar optimizaciones activas (para resumen en Paso 5)
function resumenOptimizaciones(owner) {
  const fp = owner?.fiscalProfile || {};
  const items = [];
  if ((fp.dependientes?.cantidad || 0) > 0) {
    items.push({ icono: "👨‍👩‍👧", texto: `${fp.dependientes.cantidad} dependiente${fp.dependientes.cantidad > 1 ? 's' : ''}${fp.dependientes.conDiscapacidad ? ' (con discapacidad)' : ''}` });
  }
  if (fp.auxilios?.alimentacion) items.push({ icono: "🍽️", texto: "Auxilio de alimentación" });
  if (fp.auxilios?.transporte) items.push({ icono: "🚍", texto: "Auxilio de transporte" });
  if (fp.obligadoContabilidad) items.push({ icono: "📚", texto: "Obligado a llevar contabilidad" });
  if (fp.honorariosConPersonal) items.push({ icono: "💼", texto: "Honorarios con personal a cargo" });
  if (fp.eventosAno?.recibioHerencia) items.push({ icono: "🎁", texto: "Herencia/legado recibido" });
  if (fp.eventosAno?.vendioInmuebleAntiguo) items.push({ icono: "🏠", texto: "Venta de inmueble > 2 años" });
  if (fp.eventosAno?.ganoLoteria) items.push({ icono: "🎰", texto: "Lotería/rifa ganada" });
  if ((fp.donaciones?.monto || 0) > 0) items.push({ icono: "💝", texto: `Donaciones ESAL` });
  if ((fp.inversionesCTI?.monto || 0) > 0) items.push({ icono: "🔬", texto: `Inversión CTI/cine/primera infancia` });
  if (fp.regimenEspecial) items.push({ icono: "⚖️", texto: `Régimen especial: ${fp.regimenEspecial}` });
  return items;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE INTEGRACIÓN — Capa 1 (hint inline) y Capa 2 (acordeón desglose)
// ═══════════════════════════════════════════════════════════════════════════

// getHintContextual: una sola línea breve para mostrar inline en la tarjeta,
// debajo del número. Responde la duda del usuario en el momento exacto que
// la tiene. Ej: "Optimizado igual al actual" → ¿por qué?
//
// Devuelve { tono, icono, texto } o null si no hay hint relevante.
function getHintContextual(det, owner) {
  if (!det) return null;
  const impAct = Number(det.impBruto || det.impuesto || 0);
  const impOpt = Number(det.impOptBruto != null ? det.impOptBruto : (det.impOpt || det.impOptimizado || 0));
  const ahorro = Math.max(0, impAct - impOpt);
  const tieneSalario = Number(det.ingLaboral || 0) > 0;
  const isJur = owner?.type === "juridica";

  // Caso 1: ELIMINADO en Camino A — el modo unificado de la ficha ya cubre el
  // caso "Sin optimizar == Optimizado" con texto honesto. Mostrar aquí "Sin
  // ingresos laborales para PV/AFC" era engañoso porque hacía pensar que no
  // había nada que hacer cuando en realidad hay otras palancas (Régimen Simple,
  // donaciones, gastos del inmueble, etc.) que se muestran en el panel de
  // oportunidades.
  void tieneSalario; void isJur; // mantenidos por si caso 2 quiere afinarse

  // Caso 2: hay ahorro real → mostrar magnitud y mecanismo
  if (ahorro > 1_000_000) {
    const pct = impAct > 0 ? Math.round((ahorro / impAct) * 100) : 0;
    return {
      tono: "ok",
      icono: "💰",
      texto: `Podés ahorrar $${(ahorro / 1_000_000).toFixed(1)}M (${pct}%) optimizando aportes a PV/AFC.`,
    };
  }

  // Caso 3: ahorro pequeño pero existe
  if (ahorro > 0) {
    return {
      tono: "info",
      icono: "💡",
      texto: `Ahorro pequeño detectado ($${Math.round(ahorro / 1000).toLocaleString('es-CO')}k). Hay margen limitado para optimizar.`,
    };
  }

  // Caso 4: impuesto cero
  if (impAct === 0) {
    return {
      tono: "ok",
      icono: "✓",
      texto: "Sin impuesto a pagar este año según los datos registrados.",
    };
  }

  return null;
}

// getTopRecomendaciones: devuelve hasta N recomendaciones con base legal
// derivadas del detalle del motor. Para mostrar en la Capa 2 (acordeón).
//
// Devuelve array de { icono, titulo, desc, monto?, tono }.
function getTopRecomendaciones(det, owner, n = 4) {
  if (!det) return [];
  const recs = [];
  const fp = owner?.fiscalProfile || {};

  // Dependientes ya aplicados
  if ((det.deducDep || 0) > 0) {
    recs.push({
      icono: "👨‍👩‍👧",
      titulo: `Dependientes: $${(det.deducDep / 1_000_000).toFixed(1)}M/año`,
      desc: `Ya se está deduciendo 10% del ingreso por ${fp.dependientes?.cantidad || 1} dependiente(s).`,
      tono: "ok",
    });
  }

  // Intereses vivienda
  if ((det.deducVivienda || 0) > 0) {
    recs.push({
      icono: "🏠",
      titulo: `Intereses vivienda: $${(det.deducVivienda / 1_000_000).toFixed(1)}M/año`,
      desc: "Los intereses de tu hipoteca ya se deducen automáticamente.",
      tono: "ok",
    });
  }

  // Donaciones (Art. 257 ET)
  recs.push({
    icono: "🤝",
    titulo: "Donaciones con descuento 25% (Art. 257 ET)",
    desc: "Las donaciones a entidades sin ánimo de lucro calificadas dan un descuento del 25% del valor donado, directo del impuesto a pagar. Tope legal: 25% del impuesto de renta del año.",
    tono: "info",
  });

  // GMF deducible
  recs.push({
    icono: "💳",
    titulo: "GMF 4×1000 deducible (Art. 115 ET)",
    desc: "El 50% del GMF pagado es deducible. Se calcula automáticamente según tus movimientos bancarios.",
    tono: "ok",
  });

  return recs.slice(0, n);
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1 — Selector de owner
// ═══════════════════════════════════════════════════════════════════════════
function Paso1Owner({ owners, selectedOwnerId, onSelect, onNext }) {
  const ownersConfigurados = owners.filter(ownerConfigurado).length;
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 18, padding: "0 20px" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🧑</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.txt, marginBottom: 6 }}>
          ¿Para quién querés calcular el impuesto?
        </div>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5, maxWidth: 480, margin: "0 auto" }}>
          Elegí uno de tus propietarios fiscales. Podés volver y calcular cada uno por separado — tus respuestas se guardan automáticamente.
        </div>
      </div>

      {/* Progreso global */}
      {owners.length > 1 && (
        <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, maxWidth: 520, margin: "0 auto 14px" }}>
          <div style={{ fontSize: 16 }}>📊</div>
          <div style={{ flex: 1, fontSize: 12, color: T.txt2 }}>
            <strong style={{ color: T.green }}>{ownersConfigurados}</strong> de <strong style={{ color: T.txt }}>{owners.length}</strong> propietarios configurados
          </div>
          {ownersConfigurados === owners.length && <div style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>✓ Completo</div>}
        </div>
      )}

      {owners.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", background: T.bg3, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: T.txt2 }}>
            No tenés propietarios fiscales configurados. Creá uno desde Configuración primero.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 520, margin: "0 auto" }}>
          {owners.map((o) => {
            const yaConfigurado = ownerConfigurado(o);
            return (
              <button
                key={o.id}
                onClick={() => onSelect(o.id)}
                style={{
                  padding: "14px 16px",
                  background: selectedOwnerId === o.id ? "rgba(34,197,94,0.1)" : T.bg3,
                  border: "2px solid " + (selectedOwnerId === o.id ? T.green : T.border),
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  color: T.txt,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 22 }}>{o.type === "juridica" ? "🏢" : "🧑"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{o.name}</div>
                      {yaConfigurado && <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(34,197,94,0.15)", color: T.green, borderRadius: 4, fontWeight: 700 }}>✓ configurado</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                      {o.type === "juridica" ? "Persona jurídica" : "Persona natural"}
                      {o.regimen && o.regimen !== "ordinario" && ` · Régimen ${o.regimen}`}
                    </div>
                  </div>
                  {selectedOwnerId === o.id && <div style={{ fontSize: 18, color: T.green }}>✓</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <NavButtons
        currentStep={0}
        onNext={onNext}
        disableNext={!selectedOwnerId || owners.length === 0}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 2 — Revisá tus datos (auto-lectura + data gaps)
// ═══════════════════════════════════════════════════════════════════════════
function Paso2Datos({ user, selectedOwner, onBack, onNext, onNavigate }) {
  const ownerId = selectedOwner?.id;

  // Commit 9.1b: Gaps descartados por owner. Si el usuario dice "no, no tengo
  // aportes obligatorios porque apagué mi salario", descartar y no volver a
  // pedir. Persiste en localStorage por owner.id + gap id.
  const dismissKey = `fp3_dismissed_gaps_${ownerId || "none"}`;
  const [dismissedGaps, setDismissedGaps] = useState(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  // Re-cargar cuando cambia el owner
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      setDismissedGaps(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setDismissedGaps(new Set()); }
  }, [dismissKey]);
  const dismissGap = (gapId) => {
    setDismissedGaps(prev => {
      const next = new Set(prev);
      next.add(gapId);
      try { localStorage.setItem(dismissKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Commit 9.1: Respetar sim. Los items apagados (⬜) NO se incluyen en el cálculo
  // ni en la detección de data gaps — son decisiones explícitas del usuario.
  // También exponemos apagados para poder informar al usuario (sin pedir acción).
  const ownerIngAll = useMemo(() => (user?.ingresos || []).filter(i => i.owner === ownerId), [user, ownerId]);
  const ownerIng = useMemo(() => ownerIngAll.filter(i => i.sim !== false), [ownerIngAll]);
  const ownerIngApagados = useMemo(() => ownerIngAll.filter(i => i.sim === false), [ownerIngAll]);

  const ownerGasAll = useMemo(() => Object.values(user?.gas || {}).flat().filter(g => g.owner === ownerId), [user, ownerId]);
  const ownerGas = useMemo(() => ownerGasAll.filter(g => g.sim !== false), [ownerGasAll]);

  const ownerDeuAll = useMemo(() => (user?.deu || []).filter(d => d.owner === ownerId), [user, ownerId]);
  const ownerDeu = useMemo(() => ownerDeuAll.filter(d => d.sim !== false), [ownerDeuAll]);

  const resumen = useMemo(() => {
    const salario = ownerIng.filter(i => i.categoria === "Salario").reduce((s, i) => s + (i.mensual || 0), 0);
    const honorarios = ownerIng.filter(i => i.categoria === "Honorarios").reduce((s, i) => s + (i.mensual || 0), 0);
    const arriendos = ownerIng.filter(i => i.categoria === "Arriendo").reduce((s, i) => s + (i.mensual || 0), 0);
    const rendimientos = ownerIng.filter(i => i.categoria === "Rendimientos").reduce((s, i) => s + (i.mensual || 0), 0);
    const dividendos = ownerIng.filter(i => i.categoria === "Dividendos").reduce((s, i) => s + (i.mensual || 0), 0);
    const gastosActividad = ownerGas.filter(g => ["Oficina", "Servicios", "Tecnología", "Transporte"].includes(g.cat)).reduce((s, g) => s + montoPromedioMensual(g), 0);
    // Categorías de gastos del inmueble — ampliadas para evitar falso positivo
    // cuando el usuario registró el predial/mantenimiento bajo otro nombre.
    const categoriasInmueble = [
      "Predial", "Impuesto", "Mantenimiento", "Seguros",
      "Administración", "Vivienda", "Servicios", "Servicios públicos",
    ];
    const gastosInmueble = ownerGas.filter(g => {
      const cat = (g.cat || "").toLowerCase();
      // Match por categoría exacta o por palabras clave en el nombre
      if (categoriasInmueble.some(c => c.toLowerCase() === cat)) return true;
      const nombre = (g.nombre || g.c || "").toLowerCase();
      return nombre.includes("predial") || nombre.includes("administra") ||
             nombre.includes("manteni") || nombre.includes("seguro");
    }).reduce((s, g) => s + montoPromedioMensual(g), 0);
    return { salario, honorarios, arriendos, rendimientos, dividendos, gastosActividad, gastosInmueble };
  }, [ownerIng, ownerGas]);

  const dataGaps = useMemo(() => {
    const gaps = [];
    if (resumen.arriendos > 0 && resumen.gastosInmueble === 0) {
      // Mensaje distinto según tipo de owner:
      // - Natural: probablemente pague predial de su propiedad arrendada
      // - Jurídica: depende de estructura (puede no aplicar)
      const esJuridica = selectedOwner?.type === "juridica";
      gaps.push({
        id: "arriendo_sin_gastos",
        titulo: esJuridica
          ? "¿Hay gastos deducibles de los inmuebles arrendados?"
          : "¿Pagás predial o administración de los inmuebles que arrendás?",
        desc: esJuridica
          ? "Como sociedad que recibe arriendos, si pagás predial, administración, mantenimiento o seguros de los inmuebles, son deducibles (Art. 107 ET). Si los paga el arrendatario directamente o no aplica a tu estructura, descartá este aviso."
          : "Si como arrendador pagás predial, administración, mantenimiento o seguros, son deducibles del ingreso de arriendo. Si el arrendatario los paga directamente o no tenés estos gastos, descartá este aviso.",
        page: "gas", icono: "🏠",
      });
    }
    if (resumen.honorarios > 0 && resumen.gastosActividad === 0) {
      gaps.push({
        id: "honorarios_sin_gastos",
        titulo: "¿Tenés gastos relacionados a tu actividad profesional?",
        desc: "Como independiente con honorarios, podés deducir oficina, servicios, transporte o tecnología que uses para ejercer tu actividad (Art. 107 ET, causalidad). Si no tenés estos gastos o ya los cargaste en otra categoría, descartá este aviso.",
        page: "gas", icono: "💼",
      });
    }
    const tieneSalario = resumen.salario > 0;
    const tieneAportes = ownerIng.some(i => {
      if (i.categoria !== "Salario") return false;
      const ap = i.aportes || {};
      const pension = Number(ap.pension) || 0;
      const salud = Number(ap.salud) || 0;
      return (pension + salud) > 0;
    });
    if (tieneSalario && !tieneAportes) {
      gaps.push({
        id: "salario_sin_aportes",
        titulo: "¿Cargaste tus aportes obligatorios de pensión y salud?",
        desc: "Todo empleado aporta ~4% pensión + 4% salud del salario. Si no los registrás en el ingreso, el motor sobrestima tu impuesto. Si ya los registraste en otro campo o no aplican a tu caso, descartá este aviso.",
        page: "ing", icono: "💼",
      });
    }
    const tieneDeudaHipotecaria = ownerDeu.some(d => (d.mt || 0) > 10_000_000 && (d.tipo === "Hipoteca" || (d.nombre || "").toLowerCase().includes("hipote") || (d.nombre || "").toLowerCase().includes("vivienda")));
    const marcadaComoVivienda = ownerDeu.some(d => d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL");
    if (tieneDeudaHipotecaria && !marcadaComoVivienda) {
      gaps.push({
        id: "hipoteca_sin_clasificar",
        titulo: "¿Es tu vivienda de habitación la hipoteca que tenés?",
        desc: "Si la hipoteca es sobre la casa donde vivís, los intereses son deducibles hasta 1.200 UVT/año (Art. 119 ET). Si es de un inmueble de inversión o comercial, descartá este aviso — esa deducción solo aplica a vivienda habitacional.",
        page: "deu", icono: "🏡",
      });
    }
    // Filtrar los que el usuario descartó explícitamente
    return gaps.filter(g => !dismissedGaps.has(g.id));
  }, [resumen, ownerIng, ownerDeu, dismissedGaps]);

  const filas = [
    { label: "Salario mensual", value: resumen.salario, icono: "💼" },
    { label: "Honorarios mensual", value: resumen.honorarios, icono: "💰" },
    { label: "Arriendos recibidos", value: resumen.arriendos, icono: "🏠" },
    { label: "Rendimientos financieros", value: resumen.rendimientos, icono: "📈" },
    { label: "Dividendos", value: resumen.dividendos, icono: "🏦" },
  ].filter(f => f.value > 0);

  return (
    <div>
      <PasoHeader
        owner={selectedOwner}
        titulo="Revisá los datos cargados"
        descripcion="Esto es lo que ya cargaste. Si algo falta, completá antes de seguir para que el cálculo sea más preciso."
      />

      {filas.length === 0 ? (
        <div style={{ padding: 20, background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, marginBottom: 16 }}>
          <h3 style={{ ...F.h2, marginBottom: 6 }}>Sin ingresos registrados</h3>
          <p style={{ ...F.body, marginBottom: 12 }}>
            Para calcular el impuesto necesitás tener al menos un ingreso cargado. Podés seguir igualmente para capturar eventos especiales (herencia, venta de inmueble) si aplican.
          </p>
          <button onClick={() => onNavigate?.("ing")} style={{ padding: "8px 14px", background: T.bg2, border: "1px solid " + T.border, color: T.txt, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Ir a Ingresos →
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...F.caption, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 10 }}>
            Ingresos del año
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, overflow: "hidden" }}>
            {filas.map((f, idx) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: idx < filas.length - 1 ? "1px solid " + T.border : "none", gap: 12 }}>
                <div style={{ fontSize: 16 }}>{f.icono}</div>
                <div style={{ flex: 1, ...F.body }}>{f.label}</div>
                <div style={{ ...F.mono, color: T.green }}>{fm(f.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nota discreta sobre items apagados — informativo, no alerta */}
      {ownerIngApagados.length > 0 && (
        <div style={{ padding: "10px 14px", marginBottom: 18, fontSize: 11, color: T.txt3, lineHeight: 1.5, borderLeft: "2px solid " + T.border, paddingLeft: 12 }}>
          <strong style={{ color: T.txt2 }}>Nota:</strong> {ownerIngApagados.length} ingreso{ownerIngApagados.length > 1 ? "s" : ""} apagado{ownerIngApagados.length > 1 ? "s" : ""} ({ownerIngApagados.map(i => i.nombre).join(", ")}) no aparecen acá porque están excluidos del cálculo. Podés encenderlos en Ingresos si querés incluirlos.
        </div>
      )}

      {dataGaps.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...F.caption, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, color: T.orange, marginBottom: 10 }}>
            Sugerencias para revisar — {dataGaps.length}
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, overflow: "hidden" }}>
            {dataGaps.map((g, i) => (
              <div key={g.id || i} style={{ padding: "14px 16px", borderBottom: i < dataGaps.length - 1 ? "1px solid " + T.border : "none", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, marginTop: 1 }}>{g.icono}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ ...F.h2, fontSize: 13, marginBottom: 4 }}>{g.titulo}</div>
                  <div style={{ ...F.caption, color: T.txt2 }}>{g.desc}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => dismissGap(g.id)} title="No aplica a mi situación" style={{ padding: "6px 10px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    No aplica
                  </button>
                  <button onClick={() => onNavigate?.(g.page)} style={{ padding: "6px 12px", background: T.bg2, border: "1px solid " + T.orange, color: T.orange, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Completar →
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...F.caption, marginTop: 8, fontStyle: "italic" }}>
            Cada sugerencia es una pregunta — si no aplica a tu caso (por ejemplo no pagás ese gasto, o ya lo cargaste en otra categoría), descartala con "No aplica" y no se vuelve a mostrar.
          </p>
        </div>
      )}

      {dataGaps.length === 0 && filas.length > 0 && (
        <div style={{ padding: "10px 14px", marginBottom: 18, fontSize: 12, color: T.green, borderLeft: "2px solid " + T.green, paddingLeft: 12 }}>
          Datos completos. No detecté nada obvio que falte.
        </div>
      )}

      <NavButtons currentStep={1} onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 3 — Tu situación personal (Grupo A + parte de C)
// Reutiliza AjustesFiscalesPersonalizados pero filtrando grupos a mostrar
// ═══════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────
// PasoHeader — Header unificado para todos los pasos.
// Sistema tipográfico consistente: chip owner (pequeño) → título h1 → descripción.
// Reemplaza headers inconsistentes con 5 tamaños de fuente mezclados.
// ─────────────────────────────────────────────────────────────────────────
function PasoHeader({ owner, titulo, descripcion }) {
  return (
    <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: "1px solid " + T.border }}>
      {owner && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {owner.type === "juridica" ? "🏢" : "🧑"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 }}>
              Calculando para
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.txt, lineHeight: 1.2, textTransform: "capitalize" }}>
              {owner.name}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
              {owner.type === "juridica" ? "Persona Jurídica" : "Persona Natural"}
              {owner.regimen && owner.regimen !== "ordinario" ? ` · Régimen ${owner.regimen}` : ""}
            </div>
          </div>
        </div>
      )}
      <h2 style={{ ...F.h2, color: T.txt2 }}>{titulo}</h2>
      {descripcion && <p style={{ ...F.body, marginTop: 6 }}>{descripcion}</p>}
    </div>
  );
}

// OwnerChip legacy (solo usado en Paso 2 viejo) — mantener mínimo.
function OwnerChip({ owner }) {
  if (!owner) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 12 }}>
      <span style={{ fontSize: 12 }}>{owner.type === "juridica" ? "🏢" : "🧑"}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.blue }}>{owner.name}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DESCUENTOS TRIBUTARIOS — Solo jurídicas (Commit 9.13)
// ═══════════════════════════════════════════════════════════════════════════
// Permite al usuario cargar los descuentos tributarios opcionales que su
// empresa puede aplicar legalmente. Si no carga nada → ahorro $0 (honesto).
// Si carga → el motor aplica con tope 25% Art. 259 ET y muestra ahorro real.
// ═══════════════════════════════════════════════════════════════════════════
// REGIMEN TRIBUTARIO — Solo jurídicas (Commit 9.14, Fase 1)
// ═══════════════════════════════════════════════════════════════════════════
// El motor soporta 5 regímenes para jurídicas: ordinario (35%), simple (RST
// con tramos por grupo), zona_franca (20%), chc, exenta. Antes el wizard NO
// preguntaba por esto — asumía "ordinario" siempre, lo cual hacía que una
// SAS de Régimen Simple grupo 1 viera 35% cuando debería ver ~3-5%.
//
// Este componente expone los regímenes como cards seleccionables. Si elige
// Simple, expone los grupos del Art. 908 ET con sus tramos.

const REGIMENES_JURIDICA = [
  {
    id: "ordinario",
    label: "Ordinario",
    tarifa: "35%",
    descripcion: "El régimen más común para empresas. 35% sobre utilidad neta. Permite todos los descuentos (ICA, GMF, CT&I, donaciones, etc).",
    art: "Art. 240 ET",
  },
  {
    id: "simple",
    label: "Régimen Simple (RST)",
    tarifa: "1.2% – 8%",
    descripcion: "Régimen simplificado para empresas con ingresos < 100.000 UVT/año (~100.000 UVT). Sustituye renta + ICA + INC en una sola tarifa.",
    art: "Arts. 903-916 ET",
  },
  {
    id: "zona_franca",
    label: "Zona Franca",
    tarifa: "20%",
    descripcion: "Empresa calificada como Usuario Industrial de Zona Franca. Tarifa preferencial 20% sobre utilidad calificada.",
    art: "Art. 240-1 ET",
  },
  {
    id: "chc",
    label: "Compañía Holding (CHC)",
    tarifa: "35%",
    descripcion: "Compañía Holding Colombiana. Aplica si principal actividad es tenencia de inversiones en sociedades extranjeras.",
    art: "Arts. 894-898 ET",
  },
  {
    id: "exenta",
    label: "Exenta",
    tarifa: "0%",
    descripcion: "Entidades sin ánimo de lucro calificadas, ESAL del Régimen Tributario Especial, fundaciones, ciertas cooperativas.",
    art: "Art. 19 ET",
  },
];

// Commit B3 (F del plan): regímenes elegibles para persona natural (Art. 905 ET).
// Solo Ordinario (Cédula General) y Régimen Simple. Las naturales no califican
// para Zona Franca, CHC ni Exenta.
const REGIMENES_NATURAL = [
  {
    id: "ordinario",
    label: "Ordinario (Cédula General)",
    tarifa: "0% – 39%",
    descripcion: "Régimen ordinario por cédulas. Tabla progresiva Art. 241 ET. Permite todas las deducciones legales (PV, AFC, dependientes, salud, vivienda, etc.).",
    art: "Arts. 241, 336 ET",
  },
  {
    id: "simple",
    label: "Régimen Simple (RST)",
    tarifa: "1.2% – 8.3%",
    descripcion: "Régimen simplificado para profesionales independientes y comerciantes con ingresos < 100.000 UVT/año (~100.000 UVT). Sustituye renta + ICA + INC. NO permite las deducciones del régimen ordinario.",
    art: "Arts. 903-916 ET",
  },
];

function RegimenSelector({ selectedOwner, onUpdateOwner, ownerType = "juridica", ingresoBrutoAnual = 0 }) {
  const regimenActual = selectedOwner?.regimen || "ordinario";
  const grupoActual = selectedOwner?.simpleGrupo || null;
  // Commit B3: elegir lista de regímenes según tipo de owner.
  // Naturales: solo Ordinario y Simple (Art. 905 ET).
  // Jurídicas: Ordinario, Simple, ZF, CHC, Exenta.
  const regimenes = ownerType === "natural" ? REGIMENES_NATURAL : REGIMENES_JURIDICA;

  // Commit B3: validación de elegibilidad para Régimen Simple (Art. 905 ET).
  // Tope: 100.000 UVT/año de ingresos brutos. Aplica tanto a naturales como jurídicas.
  const TOPE_SIMPLE_UVT = 100_000;
  const ingresoBrutoEnUVT = ingresoBrutoAnual / UVT;
  const superaTopeSimple = ingresoBrutoEnUVT > TOPE_SIMPLE_UVT;

  const setRegimen = (regimen) => {
    // Si cambia desde simple a otro régimen, limpia el grupo.
    const update = { regimen };
    if (regimen !== "simple" && selectedOwner?.simpleGrupo) {
      update.simpleGrupo = null;
    }
    onUpdateOwner(update);
  };

  const setGrupo = (grupoKey) => {
    onUpdateOwner({ simpleGrupo: grupoKey });
  };

  return (
    <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>⚖️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
            Régimen tributario
          </div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Las tarifas y los descuentos disponibles dependen del régimen.
            <strong style={{ color: T.txt2 }}> Si no estás seguro, consultá tu RUT o tu contador.</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {regimenes.map((r) => {
          const sel = regimenActual === r.id;
          // Commit B3: deshabilitar Simple si supera tope UVT (informativo, no bloqueante)
          const noElegible = r.id === "simple" && superaTopeSimple;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegimen(r.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: sel ? "rgba(167,139,250,0.08)" : T.bg3,
                border: "2px solid " + (sel ? T.purple : (noElegible ? "rgba(239,68,68,0.3)" : T.border)),
                borderRadius: 8,
                cursor: "pointer",
                color: T.txt,
                transition: "all 0.15s",
                opacity: noElegible && !sel ? 0.7 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: sel ? T.purple : T.txt }}>
                  {sel ? "● " : "○ "}{r.label}
                </span>
                <span style={{ ...F.mono, fontSize: 12, color: sel ? T.purple : T.txt3 }}>{r.tarifa}</span>
              </div>
              <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginBottom: 2 }}>
                {r.descripcion}
              </div>
              <div style={{ fontSize: 9, color: T.txt3, fontStyle: "italic" }}>{r.art}</div>
              {noElegible && (
                <div style={{ fontSize: 10, color: T.red, marginTop: 6, fontWeight: 600 }}>
                  ⚠️ Tus ingresos brutos ({ingresoBrutoEnUVT.toFixed(0)} UVT/año) superan el tope de 100.000 UVT (~${(TOPE_SIMPLE_UVT * UVT / 1_000_000).toFixed(0)}M COP). No sos elegible para Régimen Simple.
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Si elige Simple, mostrar selector de grupo */}
      {regimenActual === "simple" && (
        <div style={{ marginTop: 14, padding: 14, background: T.bg2, border: "1px solid " + T.border, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.txt, marginBottom: 8 }}>
            Grupo de actividad económica (Art. 908 ET)
          </div>
          <div style={{ fontSize: 10, color: T.txt3, marginBottom: 12, lineHeight: 1.4 }}>
            La tarifa del Régimen Simple depende del grupo de actividad principal de tu empresa.
            Elegí el que mejor describa lo que hace tu negocio.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(GRUPOS_SIMPLE).map(([key, grupo]) => {
              const sel = grupoActual === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGrupo(key)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    background: sel ? "rgba(34,197,94,0.08)" : "transparent",
                    border: "1px solid " + (sel ? T.green : T.border),
                    borderRadius: 6,
                    cursor: "pointer",
                    color: T.txt,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: sel ? T.green : T.txt2, marginBottom: 2 }}>
                    {sel ? "✓ " : "○ "}{grupo.label}
                  </div>
                  <div style={{ fontSize: 9, color: T.txt3, lineHeight: 1.3 }}>
                    {grupo.descripcion}
                  </div>
                  <div style={{ fontSize: 9, color: T.txt3, marginTop: 3, fontFamily: "monospace" }}>
                    Tramos: {grupo.tramos.map(t => `${(t.tarifa * 100).toFixed(1)}%`).join(" → ")}
                  </div>
                </button>
              );
            })}
          </div>
          {!grupoActual && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, fontSize: 10, color: T.orange, lineHeight: 1.4 }}>
              ⚠️ Sin grupo seleccionado, el motor estimará 5% como fallback. Elegí el grupo correcto para ver tu tarifa real.
            </div>
          )}
        </div>
      )}

      {/* Nota sobre régimen actual */}
      {regimenActual === "exenta" && (
        <div style={{ marginTop: 12, padding: "8px 10px", background: T.bg2, borderRadius: 6, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
          <strong style={{ color: T.green }}>Régimen Exenta:</strong> el impuesto de renta es 0%, pero
          la entidad debe declarar igual y cumplir requisitos del Art. 356 ET (RTE) o el régimen aplicable.
        </div>
      )}
    </div>
  );
}

function DescuentosTributariosForm({ selectedOwner, onUpdateProfile }) {
  const fp = selectedOwner?.fiscalProfile || {};
  const dt = fp.descuentosTributarios || {};

  // Helper: actualiza un campo dentro de descuentosTributarios
  const setCampo = (campo, valor) => {
    onUpdateProfile({
      ...fp,
      descuentosTributarios: { ...dt, [campo]: valor },
    });
  };

  // Cada descuento es { id, label, base, descuentoPct, articulo, descripcion }
  const descuentos = [
    {
      id: "cti",
      label: "Inversión en CT&I",
      articulo: "Art. 158-1 / 256 ET",
      descuentoPct: "30% del monto invertido",
      descripcion: "Inversión en proyectos calificados de ciencia, tecnología, innovación.",
    },
    {
      id: "donaciones",
      label: "Donaciones a entidades sin ánimo de lucro",
      articulo: "Art. 257 ET",
      descuentoPct: "25% del monto donado",
      descripcion: "Donaciones a fundaciones / ONGs calificadas como Régimen Tributario Especial.",
    },
    {
      id: "exterior",
      label: "Impuestos pagados en el exterior",
      articulo: "Art. 254 ET",
      descuentoPct: "100% del impuesto extranjero pagado",
      descripcion: "Para ingresos de fuente extranjera ya gravados afuera.",
    },
    {
      id: "empleo",
      label: "Empleo de personas <28 años (primera vez)",
      articulo: "Art. 108-5 ET",
      descuentoPct: "120% del salario como deducción",
      descripcion: "Salarios anuales pagados a empleados nuevos primera vez con contrato laboral.",
    },
    {
      id: "otros",
      label: "Otros descuentos",
      articulo: "Varios",
      descuentoPct: "Según norma específica",
      descripcion: "Cualquier otro descuento tributario aplicable que no esté en los anteriores.",
    },
  ];

  const fmt = (n) => {
    const num = Number(n) || 0;
    if (num === 0) return "";
    return num.toLocaleString("es-CO");
  };

  return (
    <div style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🏢</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
            Descuentos tributarios disponibles
          </div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Si tu empresa aplica alguno de estos descuentos legales, cargá el monto. El motor calculará
            el ahorro real (con tope global del 25% del impuesto bruto, Art. 259 ET).
            <strong style={{ color: T.txt2 }}> Si no aplican o no querés cargar, dejá en blanco.</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {descuentos.map((d) => {
          const valorActual = dt[d.id] || 0;
          const tieneValor = valorActual > 0;
          return (
            <div key={d.id} style={{ background: tieneValor ? "rgba(34,197,94,0.05)" : "transparent", border: "1px solid " + (tieneValor ? "rgba(34,197,94,0.2)" : T.border), borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: tieneValor ? T.green : T.txt2, marginBottom: 2 }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: 10, color: T.txt3, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{d.articulo}</span> · {d.descuentoPct}
                  </div>
                  <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4 }}>
                    {d.descripcion}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 10, color: T.txt3, fontWeight: 600, whiteSpace: "nowrap" }}>
                  Monto anual COP:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmt(valorActual)}
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/[^\d]/g, "");
                    setCampo(d.id, limpio === "" ? 0 : Number(limpio));
                  }}
                  placeholder="0"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "7px 10px",
                    background: T.bg2,
                    border: "1px solid " + T.border,
                    borderRadius: 6,
                    color: T.txt,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                  }}
                />
                {tieneValor && (
                  <button
                    onClick={() => setCampo(d.id, 0)}
                    title="Limpiar este campo"
                    style={{ padding: "6px 10px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer" }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: "8px 10px", background: T.bg2, borderRadius: 6, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
        <strong style={{ color: T.txt2 }}>⚖️ Tope global Art. 259 ET:</strong> el total de descuentos
        aplicados no puede exceder el 25% del impuesto bruto. Si excede, el motor lo ajusta automáticamente
        al límite legal.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HONORARIOS - GASTOS DEDUCIBLES — Solo naturales con honorarios (Commit A Fase 3)
// ═══════════════════════════════════════════════════════════════════════════
// Muestra al usuario natural con ingresos por honorarios:
//   - Honorarios brutos anuales
//   - Gastos deducibles cargados (suma efectiva tras topes)
//   - Ratio gastos/honorarios con alerta visual (verde/amarilla/roja)
//   - CTA para cargar gastos en Egresos si no tiene
//
// El motor (Commit A Fase 1) aplica:
//   - Vehículo al 50% conservador (uso mixto)
//   - Representación con tope rígido 10% (Art. 107-1)
//   - Resto 100% si está marcado con causalidad
//   - Alerta amarilla si ratio > 60%, roja si > 80%
function HonorariosGastosPanel({ user, selectedOwner, onNavigate }) {
  const det = useMemo(() => {
    const e = estimarImpuesto(user);
    return (e?.detalle || []).find((d) => d.name === selectedOwner?.name);
  }, [user, selectedOwner]);

  if (!det) return null;
  const honorariosBruto = Number(det.honorariosBruto || 0);
  // Sólo aparece si el owner tiene honorarios cargados
  if (honorariosBruto === 0) return null;

  const gastosHon = Number(det.gastosHonorariosDed || 0);
  const honorariosNeto = Number(det.honorariosNeto || honorariosBruto);
  const ratio = honorariosBruto > 0 ? gastosHon / honorariosBruto : 0;
  const alerta = det.alertaHonorarios; // null | "amarilla" | "roja"
  const desglose = det.gastosHonorariosDesglose || {};

  // Formato monetario
  const fmtM = (n) => "$" + (Math.round((Number(n) || 0) / 100_000) / 10).toFixed(1) + "M";
  const fmtPct = (n) => Math.round(n * 1000) / 10 + "%";

  // Color del banner según alerta
  const tono = alerta === "roja"
    ? { bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.25)", text: T.red, icon: "🚨", label: "Riesgo alto de revisión DIAN" }
    : alerta === "amarilla"
    ? { bg: "rgba(249,115,22,0.06)", border: "rgba(249,115,22,0.25)", text: T.orange, icon: "⚠️", label: "Zona de atención" }
    : gastosHon > 0
    ? { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.20)", text: T.green, icon: "✓", label: "Estructura saludable" }
    : { bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.20)", text: T.blue, icon: "💡", label: "Sin gastos cargados" };

  // Categorías con monto > 0 para mostrar desglose
  const itemsDesglose = [
    { key: "segSocial", label: "Seguridad social independiente", art: "Art. 126-1", monto: desglose.segSocial },
    { key: "nominaTerceros", label: "Nómina/honorarios a terceros", art: "Art. 107", monto: desglose.nominaTerceros },
    { key: "oficina", label: "Arriendo oficina/coworking", art: "Art. 107", monto: desglose.oficina },
    { key: "serviciosOficina", label: "Servicios públicos oficina", art: "Art. 107", monto: desglose.serviciosOficina },
    { key: "internetTel", label: "Internet/telefonía profesional", art: "Art. 107", monto: desglose.internetTel },
    { key: "materiales", label: "Materiales y suministros", art: "Art. 107", monto: desglose.materiales },
    { key: "vehiculoAplicado", label: Number(desglose.vehiculosTotalRegistrados || 0) > 1 ? "Vehículo de mayor monto (al 50%)" : "Vehículo (al 50%)", art: "Art. 107", monto: desglose.vehiculoAplicado, bruto: desglose.vehiculoBruto },
    { key: "viajes", label: "Viajes con propósito", art: "Art. 107", monto: desglose.viajes },
    { key: "representacionAplicado", label: "Representación (tope 10%)", art: "Art. 107-1", monto: desglose.representacionAplicado, bruto: desglose.representacionBruto, tope: desglose.representacionTope },
    { key: "capacitacion", label: "Capacitación profesional", art: "Art. 107", monto: desglose.capacitacion },
    { key: "otros", label: "Otros con causalidad", art: "Art. 107", monto: desglose.otros },
  ].filter((i) => Number(i.monto || 0) > 0);

  return (
    <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
            Honorarios y gastos de actividad (Art. 107 ET)
          </div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Como persona natural con honorarios, los gastos legítimos de tu actividad
            (oficina, internet, viajes, etc.) reducen la base gravable.
            <strong style={{ color: T.txt2 }}> Cargá los gastos en el módulo Egresos y marcalos como "actividad por honorarios".</strong>
          </div>
        </div>
      </div>

      {/* Header con cifras principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ background: T.bg2, padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            Honorarios brutos
          </div>
          <div style={{ ...F.mono, fontSize: 14, fontWeight: 700, color: T.txt }}>{fmtM(honorariosBruto)}</div>
        </div>
        <div style={{ background: T.bg2, padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            Gastos deducibles
          </div>
          <div style={{ ...F.mono, fontSize: 14, fontWeight: 700, color: gastosHon > 0 ? T.green : T.txt3 }}>−{fmtM(gastosHon)}</div>
        </div>
        <div style={{ background: T.bg2, padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            Honorarios netos
          </div>
          <div style={{ ...F.mono, fontSize: 14, fontWeight: 700, color: T.txt }}>{fmtM(honorariosNeto)}</div>
        </div>
        <div style={{ background: T.bg2, padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            Ratio gastos
          </div>
          <div style={{ ...F.mono, fontSize: 14, fontWeight: 700, color: tono.text }}>{fmtPct(ratio)}</div>
        </div>
      </div>

      {/* Banner de estado / alerta */}
      <div style={{ background: tono.bg, border: `1px solid ${tono.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: tono.text, marginBottom: 4 }}>
          {tono.icon} {tono.label}
        </div>
        <div style={{ fontSize: 10, color: T.txt2, lineHeight: 1.5 }}>
          {alerta === "roja" && (
            <>El ratio gastos/honorarios supera el 80%. Esto puede activar revisión DIAN. Asegurate de tener documentación impecable de cada gasto (facturas, comprobantes, notas de causalidad).</>
          )}
          {alerta === "amarilla" && (
            <>El ratio gastos/honorarios está entre 60% y 80%. Es estadísticamente alto pero defendible. Revisá que cada gasto cumpla causalidad, necesidad y proporcionalidad (Art. 107 ET).</>
          )}
          {!alerta && gastosHon > 0 && (
            <>Tus gastos de actividad están dentro de un rango razonable. El motor descontó {fmtM(gastosHon)} del ingreso por honorarios antes de aplicar la cédula laboral.</>
          )}
          {!alerta && gastosHon === 0 && (
            <>Tenés honorarios por {fmtM(honorariosBruto)} pero ningún gasto de actividad cargado. Si tenés arriendo de oficina, internet profesional, viajes con clientes, etc., podés deducirlos legalmente bajo el Art. 107 ET.</>
          )}
        </div>
      </div>

      {/* Desglose si hay gastos */}
      {itemsDesglose.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: T.txt2, fontWeight: 700, padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid " + T.border, borderRadius: 6, listStyle: "none", userSelect: "none" }}>
            ▾ Desglose por categoría ({itemsDesglose.length})
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {itemsDesglose.map((it) => (
              <div key={it.key} style={{ background: T.bg2, padding: "8px 10px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.txt2 }}>{it.label}</div>
                  <div style={{ fontSize: 9, color: T.txt3 }}>{it.art}</div>
                  {it.bruto != null && it.bruto !== it.monto && (
                    <div style={{ fontSize: 9, color: T.txt3, marginTop: 2 }}>
                      Bruto: {fmtM(it.bruto)} · {it.tope ? `tope ${fmtM(it.tope)}` : "aplicado al 50%"}
                    </div>
                  )}
                </div>
                <div style={{ ...F.mono, fontSize: 12, color: T.green, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {fmtM(it.monto)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Commit B1: warning si hay >1 vehículo registrado (solo uno es deducible — Art. 107 ET) */}
      {Number(desglose.vehiculosTotalRegistrados || 0) > 1 && (
        <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, fontSize: 11, color: T.orange, lineHeight: 1.5 }}>
          🚗 <strong>{desglose.vehiculosTotalRegistrados} vehículos registrados</strong> como gasto de actividad. <strong>Art. 107 ET</strong> exige causalidad: solo <strong>uno</strong> puede ser deducible (el de mayor monto). Los otros {desglose.vehiculosIgnorados} ({fmtM(desglose.vehiculoIgnoradoMonto || 0)}/año) <strong>NO</strong> se están deduciendo. Si efectivamente usás más de un vehículo para tu actividad profesional, marcá los otros con otra categoría.
        </div>
      )}

      {/* CTA si no hay gastos cargados */}
      {gastosHon === 0 && onNavigate && (
        <button
          onClick={() => onNavigate("gas")}
          style={{ width: "100%", padding: "10px 14px", background: "transparent", border: `1px solid ${T.blue}`, color: T.blue, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          → Cargar gastos de actividad en Egresos
        </button>
      )}

      <div style={{ marginTop: 12, padding: "8px 10px", background: T.bg2, borderRadius: 6, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
        <strong style={{ color: T.txt2 }}>⚖️ Art. 107 ET:</strong> los gastos deben tener
        causalidad, necesidad y proporcionalidad con tu actividad. Mantené facturas y
        comprobantes para sustentar cada deducción si la DIAN los requiere.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUCCIONES NATURALES — Panel informativo (Commit 9.15, Fase 2)
// ═══════════════════════════════════════════════════════════════════════════
// Las deducciones de personas naturales (medicina prepagada, intereses
// vivienda, AFC, PV) NO se cargan en el wizard sino en los modulos de
// Egresos/Deudas. Este panel le muestra al usuario QUE DEDUCCIONES leyó
// el motor de su data, con los topes legales claros (basados en el script
// del contador). Si el campo está vacío pero debería tenerlo, ofrece CTA
// para cargarlo.
//
// Topes legales aplicados (Art. 387 #2 ET, Art. 119 ET, Art. 126-1 y 126-4):
//   - Medicina prepagada: 16 UVT/mes
//   - Intereses vivienda: 100 UVT/mes (1.200 UVT/año)
//   - PV + AFC combinados: 30% del ingreso laboral, máximo 3.800 UVT/año
//   - Renta exenta 25%: máximo 790 UVT/año
//   - Dependientes: 10% ingreso, máximo 384 UVT/año
function DeduccionesNaturalesPanel({ user, selectedOwner, onNavigate }) {
  const det = useMemo(() => {
    const e = estimarImpuesto(user);
    return (e?.detalle || []).find((d) => d.name === selectedOwner?.name);
  }, [user, selectedOwner]);

  if (!det) return null;

  // Camino 1.5: montos máximos teóricos por deducción (para mostrar el tamaño del beneficio).
  const MAX_DEP = Math.round(384 * UVT);                      // $20.1M (10% lab, máx 384 UVT)
  const MAX_MEDICINA = Math.round(16 * UVT * 12);             // $10.05M (16 UVT/mes)
  const MAX_VIVIENDA = Math.round(1200 * UVT);                // $62.85M (1.200 UVT/año)
  const MAX_PV_AFC = Math.round(3800 * UVT);                  // $199.02M conjunto

  // Helper: ejecutar scroll suave a un id dentro del Paso 3 (mismo wizard step).
  const scrollTo = (id) => {
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Cada item tiene:
  //   valor: monto aplicado en COP
  //   montoMaximoTexto: descripción del beneficio máximo posible (Camino 1.5)
  //   ctaTexto: botón fuerte cuando $0
  //   linkTexto: link discreto cuando aplicada
  //   accion: { tipo: "scroll" | "navigate", target: id }
  const items = [
    {
      key: "dep",
      icono: "👨‍👩‍👧",
      label: "Dependientes",
      art: "Art. 387 #2 ET",
      topeMensual: `Tope: 10% ingreso, máx 384 UVT/año (~$${Math.round(MAX_DEP / 1_000_000)}M)`,
      valor: det.deducDep || 0,
      montoMaximoTexto: `Hasta $${(MAX_DEP / 1_000_000).toFixed(1)}M/año si tenés al menos 1 dependiente (10% del ingreso laboral, máx 384 UVT). Sube a $${(MAX_DEP * 2 / 1_000_000).toFixed(1)}M si hay discapacidad certificada.`,
      ctaTexto: "→ Declarar dependientes",
      linkTexto: "Modificar dependientes →",
      accion: { tipo: "scroll", target: "ajustes-fiscales" },
    },
    {
      key: "medicina",
      icono: "💊",
      label: "Medicina prepagada / salud / vida",
      art: "Art. 387 #2 ET",
      topeMensual: `Tope: 16 UVT/mes (~$${Math.round(16 * UVT / 1000)}k/mes, $${(MAX_MEDICINA / 1_000_000).toFixed(1)}M/año)`,
      valor: det.deducMedicina || 0,
      montoMaximoTexto: `Hasta $${(MAX_MEDICINA / 1_000_000).toFixed(1)}M/año combinando medicina prepagada + seguros de salud + seguros de vida. Tope conjunto 16 UVT/mes.`,
      ctaTexto: "→ Cargar en Egresos",
      linkTexto: "Modificar en Egresos →",
      accion: { tipo: "navigate", target: "egresos" },
    },
    {
      key: "vivienda",
      icono: "🏠",
      label: "Intereses de vivienda",
      art: "Art. 119 ET",
      topeMensual: `Tope: 100 UVT/mes, 1.200 UVT/año (~$${(MAX_VIVIENDA / 1_000_000).toFixed(1)}M)`,
      valor: det.deducVivienda || 0,
      montoMaximoTexto: `Hasta $${(MAX_VIVIENDA / 1_000_000).toFixed(1)}M/año de intereses si tenés crédito hipotecario sobre tu vivienda de habitación. El motor lee los intereses pagados según tasa y saldo.`,
      ctaTexto: "→ Cargar en Deudas",
      linkTexto: "Modificar deuda →",
      accion: { tipo: "navigate", target: "deudas" },
    },
    {
      key: "pv",
      icono: "🏛️",
      label: "Pensión Voluntaria (PV)",
      art: "Art. 126-1 ET",
      topeMensual: `Tope conjunto con AFC: 30% ingreso laboral, máx 3.800 UVT/año (~$${(MAX_PV_AFC / 1_000_000).toFixed(0)}M)`,
      valor: det.pensionVol || 0,
      montoMaximoTexto: `Aportes 100% deducibles, tope conjunto con AFC del 30% del ingreso laboral o $${(MAX_PV_AFC / 1_000_000).toFixed(0)}M/año (lo menor). Si retirás antes de 10 años para algo distinto a vivienda, perdés el beneficio.`,
      ctaTexto: "→ Cargar en Egresos",
      linkTexto: "Modificar PV →",
      accion: { tipo: "navigate", target: "egresos" },
    },
    {
      key: "afc",
      icono: "💰",
      label: "AFC (Ahorro Fomento Construcción)",
      art: "Art. 126-4 ET",
      topeMensual: `Tope conjunto con PV: 30% ingreso laboral, máx 3.800 UVT/año (~$${(MAX_PV_AFC / 1_000_000).toFixed(0)}M)`,
      valor: det.afc || 0,
      montoMaximoTexto: `Aportes 100% deducibles, tope conjunto con PV. Si retirás antes de 10 años para algo distinto a vivienda, perdés el beneficio.`,
      ctaTexto: "→ Cargar en Egresos",
      linkTexto: "Modificar AFC →",
      accion: { tipo: "navigate", target: "egresos" },
    },
  ];

  const fmt = (n) => "$" + Math.round((Number(n) || 0) / 1_000_000 * 10) / 10 + "M";

  // Camino 1.5: handler unificado de acción según tipo (scroll dentro del paso o navigate al módulo).
  const handleAccion = (accion) => {
    if (!accion) return;
    if (accion.tipo === "scroll") scrollTo(accion.target);
    else if (accion.tipo === "navigate" && onNavigate) onNavigate(accion.target);
  };

  return (
    <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 2 }}>
            Deducciones aplicadas — qué detecté de tus datos
          </div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Estas son las deducciones legales que el motor está aplicando o puede aplicar para vos.
            Cada una tiene un tope legal del Estatuto Tributario.
            <strong style={{ color: T.txt2 }}> Si una está en $0 te indico cuánto podrías ahorrar y dónde activarla.</strong>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => {
          const aplicada = it.valor > 0;
          // Camino 1.5: dos modos visuales claros.
          //   APLICADA: borde + fondo verde, valor mostrado, link discreto "Modificar →"
          //   $0:       borde + fondo naranja con header ⚠️, monto máximo, botón fuerte
          if (aplicada) {
            return (
              <div key={it.key} style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{it.icono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.green }}>✓ {it.label}</span>
                        <span style={{ fontSize: 9, color: T.txt3, marginLeft: 8 }}>{it.art}</span>
                      </div>
                      <span style={{ ...F.mono, fontSize: 12, color: T.green, fontWeight: 700 }}>{fmt(it.valor)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4, marginBottom: 6 }}>
                      {it.topeMensual}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAccion(it.accion)}
                      style={{ background: "transparent", border: "none", color: T.blue, fontSize: 10, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                    >
                      {it.linkTexto}
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          // NO aplicada (en $0): tarjeta de oportunidad con CTA fuerte
          return (
            <div key={it.key} style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{it.icono}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.txt2 }}>○ {it.label}</span>
                      <span style={{ fontSize: 9, color: T.txt3, marginLeft: 8 }}>{it.art}</span>
                    </div>
                    <span style={{ ...F.mono, fontSize: 12, color: T.txt3, fontWeight: 700 }}>$0</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.orange, fontWeight: 700, marginBottom: 6, lineHeight: 1.4 }}>
                    ⚠️ Esta deducción está disponible y no la estás aplicando
                  </div>
                  <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, marginBottom: 8 }}>
                    {it.montoMaximoTexto}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAccion(it.accion)}
                    style={{ padding: "8px 14px", background: T.orange, border: "none", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    {it.ctaTexto}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, padding: "8px 10px", background: T.bg2, borderRadius: 6, fontSize: 10, color: T.txt3, lineHeight: 1.5 }}>
        <strong style={{ color: T.txt2 }}>⚖️ Tope global Art. 336 #3 ET:</strong> el total de exenta 25%
        + deducciones del Art. 387 + AFC + PV no puede superar el <strong>40% de la renta neta</strong>.
        El motor lo respeta automáticamente y prioriza llenar primero las deducciones que no caben en la base laboral.
      </div>
    </div>
  );
}

function Paso3Situacion({ user, selectedOwner, onUpdateProfile, onUpdateOwner, onBack, onNext, onNavigate, owners }) {
  const isJur = selectedOwner?.type === "juridica";
  // Commit B3: calcular ingreso bruto anual del owner para validación UVT del Régimen Simple.
  // Suma de ingresos mensuales activos × 12, convirtiendo USD a COP con TRM si aplica.
  const trm = Number(user?.trm) || 4200;
  const ingresoBrutoAnual = (user?.ingresos || [])
    .filter(i => i.owner === selectedOwner?.id && i.sim !== false)
    .reduce((s, i) => s + ((Number(i.mensual) || 0) * (i.moneda === "USD" ? trm : 1)), 0) * 12;
  return (
    <div>
      <PasoHeader
        owner={selectedOwner}
        titulo={isJur ? "Régimen y descuentos" : "Tu situación personal"}
        descripcion={isJur
          ? "El régimen tributario define la tarifa que paga tu empresa. Los descuentos opcionales se restan del impuesto bruto (tope 25% Art. 259 ET)."
          : "Estas preguntas aplican deducciones legales que el sistema no puede adivinar. Contestá solo las que apliquen; las demás se quedan sin efecto."}
      />
      {isJur ? (
        <>
          <RegimenSelector selectedOwner={selectedOwner} onUpdateOwner={onUpdateOwner} ownerType="juridica" ingresoBrutoAnual={ingresoBrutoAnual} />
          <DescuentosTributariosForm selectedOwner={selectedOwner} onUpdateProfile={onUpdateProfile} />
        </>
      ) : (
        <>
          <RegimenSelector selectedOwner={selectedOwner} onUpdateOwner={onUpdateOwner} ownerType="natural" ingresoBrutoAnual={ingresoBrutoAnual} />
          <HonorariosGastosPanel user={user} selectedOwner={selectedOwner} onNavigate={onNavigate} />
          <DeduccionesNaturalesPanel user={user} selectedOwner={selectedOwner} onNavigate={onNavigate} />
          <div id="ajustes-fiscales">
            <AjustesFiscalesPersonalizados owner={selectedOwner} onUpdate={onUpdateProfile} filterGroup="personal" owners={owners} />
          </div>
        </>
      )}
      <NavButtons currentStep={2} onBack={onBack} onNext={onNext} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 4 — Eventos especiales del año (Grupo B + beneficios C)
// ═══════════════════════════════════════════════════════════════════════════
function Paso4Eventos({ selectedOwner, onUpdateProfile, onBack, onNext }) {
  return (
    <div>
      <PasoHeader
        owner={selectedOwner}
        titulo="¿Pasó algo especial este año?"
        descripcion="Eventos como herencia, venta de inmueble o lotería se gravan aparte (ganancias ocasionales). Donaciones e inversiones especiales dan descuentos."
      />
      <AjustesFiscalesPersonalizados owner={selectedOwner} onUpdate={onUpdateProfile} filterGroup="eventos" />
      <NavButtons currentStep={3} onBack={onBack} onNext={onNext} nextLabel="Ver mi impuesto →" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 5 — Resultado + acciones concretas
// ═══════════════════════════════════════════════════════════════════════════
function Paso5Resultado({ user, selectedOwner, owners, onBack, onNavigate, onReiniciar, onSelectOwner, onGotoStep, onVerResumen, onMarcarCompleto }) {
  const estimacion = useMemo(() => estimarImpuesto(user), [user]);
  const det = useMemo(() => (estimacion?.detalle || []).find((d) => d.name === selectedOwner?.name), [estimacion, selectedOwner]);

  // Siguiente owner pendiente (que aún no esté configurado)
  const siguienteOwner = useMemo(() => {
    if (!owners || owners.length <= 1) return null;
    const idxActual = owners.findIndex((o) => o.id === selectedOwner?.id);
    // Primero buscá pendientes desde el actual+1 en adelante
    for (let i = idxActual + 1; i < owners.length; i++) {
      if (!ownerConfigurado(owners[i])) return owners[i];
    }
    // Si no hay, volvé al principio
    for (let i = 0; i < idxActual; i++) {
      if (!ownerConfigurado(owners[i])) return owners[i];
    }
    return null; // todos configurados
  }, [owners, selectedOwner]);

  const ownersConfigurados = owners.filter(ownerConfigurado).length;
  const todosConfigurados = ownersConfigurados === owners.length;

  const optimizacionesActivas = useMemo(() => resumenOptimizaciones(selectedOwner), [selectedOwner]);

  if (!det) {
    return (
      <div>
        <div style={{ padding: 30, textAlign: "center", background: T.bg3, borderRadius: 10 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 13, color: T.txt2, marginBottom: 12 }}>
            No hay suficientes datos para calcular el impuesto de este propietario. Volvé al Paso 2 y completá los ingresos.
          </div>
          <button onClick={() => onGotoStep?.(1)} style={{ padding: "8px 16px", background: T.blue, border: "none", color: "white", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            ← Volver al Paso 2
          </button>
        </div>
        <NavButtons currentStep={4} onBack={onBack} />
      </div>
    );
  }

  const impActual = Number(det.impBruto || det.impuesto || 0);
  // Fix: el motor expone impOptBruto (impuesto bruto optimizado segun tabla),
  // no impOpt. Antes leiamos det.impOpt → undefined → caia al saldo
  // (impOptimizado = impuesto despues de retencion), creando discrepancia
  // con el SimuladorTributario y mostrando "$0 optimizado" en owners
  // sin ingresos laborales (donde impOptBruto = impBruto = no hay optimizacion
  // aplicable, comportamiento correcto fiscalmente).
  const impOpt = Number(det.impOptBruto != null ? det.impOptBruto : (det.impOpt || det.impOptimizado || 0));
  const ahorro = Math.max(0, impActual - impOpt);
  const impGO = Number(det.impGO || 0);

  // Acciones concretas que construyo contextualmente
  const acciones = [];
  const tieneDeclaracion = selectedOwner?.declaraciones && selectedOwner.declaraciones.length > 0;

  // Detectar si el owner YA tiene aportes tributarios (PV/AFC/prepagada) en Egresos
  const aportesOwner = Object.values(user?.gas || {}).flat().filter(
    (g) => g.owner === selectedOwner?.id && g.cat === "Aporte tributario"
  );
  const tieneAporteTributario = aportesOwner.length > 0 && aportesOwner.some((a) => (a.m || 0) > 0);

  if (ahorro > 1_000_000) {
    acciones.push({
      icono: "💸",
      titulo: `Registrá aportes a PV/AFC para capturar tu ahorro`,
      desc: `El motor detectó espacio legal hasta ${fm(ahorro)}/año. Aportando a PV o AFC en Egresos, activás esa optimización real.`,
      cta: "Ir a Egresos",
      page: "gas",
      prioridad: "alta",
    });
  } else if (!tieneAporteTributario && det.ingreso > 30_000_000) {
    // Caso: no tiene aportes tributarios registrados Y tiene ingresos relevantes.
    // Mostrar la oportunidad aunque el ahorro calculado actual sea bajo —
    // a menudo es bajo precisamente porque no tiene aportes que el motor
    // pueda optimizar.
    acciones.push({
      icono: "🎯",
      titulo: "Oportunidad: no tenés aportes tributarios registrados",
      desc: "Pensión Voluntaria (PV) y AFC son las 2 palancas más potentes para bajar tu impuesto legalmente. Podés aportar hasta 30% de tus ingresos con tope 3.800 UVT/año. Registrá tu primer aporte en Egresos.",
      cta: "Ir a Egresos",
      page: "gas",
      prioridad: "alta",
    });
  }

  if (!tieneDeclaracion) {
    acciones.push({
      icono: "📤",
      titulo: "Subí tu declaración del año pasado",
      desc: "Así comparamos lo que pagaste el año anterior vs lo que estás proyectando hoy. Se sube con IA en 30 segundos.",
      cta: "Ir al Dashboard",
      page: "tax-dashboard",
      prioridad: "media",
    });
  }

  acciones.push({
    icono: "👨‍💼",
    titulo: "Compartí este reporte con tu contador",
    desc: "Exportá un PDF con todos los números para revisar con él antes de declarar.",
    cta: "Exportar PDF",
    page: "tax-dashboard",
    prioridad: "baja",
  });

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🎯</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginBottom: 3 }}>
          Tu impuesto estimado para {selectedOwner?.name}
        </div>
        <div style={{ fontSize: 11, color: T.txt3 }}>
          Año gravable {new Date().getFullYear()}
        </div>
      </div>

      {/* Banner de guardado automático */}
      <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 16 }}>💾</div>
        <div style={{ flex: 1, fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
          <strong style={{ color: T.green }}>Tu configuración se guardó automáticamente.</strong>
          {optimizacionesActivas.length > 0 && ` Activaste ${optimizacionesActivas.length} optimización${optimizacionesActivas.length > 1 ? 'es' : ''} para este propietario.`}
        </div>
      </div>

      {/* Números grandes — Camino A: modo honesto */}
      {ahorro > 100_000 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div style={{ padding: 16, background: T.bg3, border: "2px solid " + T.border, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Tu impuesto hoy</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>{fm(impActual)}</div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>{det.ingreso > 0 ? `${((impActual / det.ingreso) * 100).toFixed(1)}% de tus ingresos` : ""}</div>
          </div>
          <div style={{ padding: 16, background: "rgba(34,197,94,0.08)", border: "2px solid " + T.green, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Si aplicás PV/AFC al máximo</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(impOpt)}</div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>{det.ingreso > 0 ? `${((impOpt / det.ingreso) * 100).toFixed(1)}% de tus ingresos` : ""}</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 18, background: T.bg3, border: "2px solid " + T.border, borderRadius: 12, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Tu impuesto estimado</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.txt, fontFamily: "monospace" }}>{fm(impActual)}</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 6 }}>{det.ingreso > 0 ? `${((impActual / det.ingreso) * 100).toFixed(1)}% de tus ingresos` : ""}</div>
          <div style={{ fontSize: 11, color: T.txt2, marginTop: 14, lineHeight: 1.5, maxWidth: 480, margin: "14px auto 0", fontStyle: "italic" }}>
            Ya con todas las deducciones automáticas que el motor pudo aplicar de tus datos. Para reducir más, revisá el plan de acción abajo.
          </div>
        </div>
      )}

      {ahorro > 1_000_000 && (
        <div style={{ padding: "12px 16px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5 }}>Tu ahorro potencial máximo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(ahorro)}/año</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4, maxWidth: 440, margin: "4px auto 0" }}>
            Este es el techo legal. Para capturarlo necesitás aportar a PV/AFC hasta el tope del 40% de tus ingresos.
          </div>
        </div>
      )}

      {impGO > 0 && (
        <div style={{ padding: "10px 14px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.purple, fontWeight: 700, marginBottom: 4 }}>💸 Ganancias ocasionales (cédula separada)</div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Dentro del impuesto de arriba, hay <strong style={{ color: T.purple }}>{fm(impGO)}</strong> de ganancias ocasionales (herencia, venta de inmueble, lotería). Tarifa 15% / 20%.
          </div>
        </div>
      )}

      {/* Resumen de optimizaciones activas */}
      {optimizacionesActivas.length > 0 && (
        <div style={{ marginBottom: 14, padding: "12px 14px", background: T.bg3, borderRadius: 10, border: "1px solid " + T.border }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.txt2, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span>✅</span> Optimizaciones aplicadas ({optimizacionesActivas.length})
            <button onClick={() => onGotoStep?.(2)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 5, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}>
              Modificar
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {optimizacionesActivas.map((it, i) => (
              <div key={i} style={{ padding: "5px 10px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 5 }}>
                <span>{it.icono}</span>
                <span>{it.texto}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {optimizacionesActivas.length === 0 && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10, fontSize: 11, color: T.txt2, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16 }}>💡</div>
          <div style={{ flex: 1, lineHeight: 1.5 }}>
            No activaste ninguna optimización. Probablemente hay deducciones legales que aplican a tu caso — volvé al Paso 3 o 4 y revisá las preguntas.
          </div>
          <button onClick={() => onGotoStep?.(2)} style={{ padding: "5px 12px", background: "transparent", border: "1px solid " + T.orange, color: T.orange, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Revisar
          </button>
        </div>
      )}

      {/* Acciones concretas */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          ▶️ Próximos pasos recomendados
        </div>
        {acciones.map((a, i) => (
          <div key={i} style={{ padding: "11px 14px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ fontSize: 18 }}>{a.icono}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.txt, marginBottom: 3 }}>{a.titulo}</div>
                <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>{a.desc}</div>
              </div>
              <button onClick={() => onNavigate?.(a.page)} style={{ padding: "6px 12px", background: T.blue, border: "none", color: "white", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {a.cta} →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CTA principal: volver a las fichas. Siguiente owner queda como opción secundaria.
          Bug fixado en 9.5: antes el wizard empujaba automaticamente al siguiente owner
          y el usuario quedaba en loop sin poder salir. */}
      {owners.length > 1 && (
        <div style={{ padding: "14px 18px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, marginBottom: 4 }}>
                {todosConfigurados ? "🎉 Configuraste todos tus propietarios" : `Este propietario ya está configurado (${ownersConfigurados} de ${owners.length} listos)`}
              </div>
              <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
                {todosConfigurados
                  ? "Volvé a las fichas para ver el resumen consolidado."
                  : siguienteOwner
                    ? `Podés volver a las fichas o configurar directamente a ${siguienteOwner.name}.`
                    : "Volvé a las fichas para ver el panorama."}
              </div>
            </div>
            <button
              onClick={onVerResumen}
              style={{ padding: "10px 18px", background: T.green, border: "none", color: "#000", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
            >
              ← Volver a mis fichas
            </button>
          </div>
          {siguienteOwner && !todosConfigurados && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + T.border, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, color: T.txt3, flex: 1, minWidth: 200 }}>
                O si preferís configurar ahora: <strong style={{ color: T.txt2 }}>{siguienteOwner.name}</strong> ({siguienteOwner.type === "juridica" ? "Jurídica" : "Natural"})
              </div>
              <button
                onClick={() => {
                  onMarcarCompleto?.();
                  onSelectOwner?.(siguienteOwner.id);
                  onGotoStep?.(1);
                }}
                style={{ padding: "7px 14px", background: "transparent", border: "1px solid " + T.blue, color: T.blue, borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                Configurar {siguienteOwner.name.split(" ")[0]} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navegación inferior */}
      <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid " + T.border, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onBack} style={{ padding: "9px 14px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
          ← Modificar
        </button>
        <div style={{ flex: 1, minWidth: 0 }}/>
        {onVerResumen && (
          <button onClick={onVerResumen} style={{ padding: "9px 14px", background: T.bg2, border: "1px solid " + T.blue, color: T.blue, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            ← Volver a mis fichas
          </button>
        )}
        {owners.length > 1 && (
          <button onClick={() => { onMarcarCompleto?.(); onGotoStep?.(0); }} style={{ padding: "9px 14px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
            Elegir otro
          </button>
        )}
        <button onClick={onReiniciar} style={{ padding: "9px 14px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
          ↻ De cero
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// VISTA RESUMEN MULTI-OWNER — Ficha consolidada
// ─────────────────────────────────────────────────────────────────────────
// Muestra una tarjeta por cada responsable fiscal con su impuesto calculado,
// estado de configuración (completo/parcial/sin configurar) y total
// consolidado al final. Permite entrar a calcular uno específico o empezar
// uno nuevo.
// ═══════════════════════════════════════════════════════════════════════════
function VistaResumenMultiOwner({ user, owners, onSelectOwner, onNuevoCalculo, onNavigate, onMarcarCompletoOwner, onUserUpdate }) {
  const estimacion = useMemo(() => estimarImpuesto(user), [user]);

  // ── Commit 6 Tarea 3: BANNER DE MIGRACIÓN DE CESANTÍAS ─────────────────
  // El Commit 4 introdujo auto-creación de cesantías cuando el usuario carga
  // un salario nuevo. Pero los usuarios existentes (que ya tenían salario
  // cargado antes) no se benefician retroactivamente. Este banner detecta
  // owners en esa situación y les ofrece agregar cesantías con un click.
  //
  // Lógica de detección (universal, no específica):
  //   - Owner es persona NATURAL
  //   - Tiene al menos un item LAB_SALARIO
  //   - Al menos uno de esos salarios tiene tipoVinculacion="ordinario"
  //     (el default — usuarios legacy también caen aquí)
  //   - El owner NO tiene cesantías cargadas (LAB_PRESTACIONES_CESANTIAS)
  //
  // El banner desaparece naturalmente cuando:
  //   - Usuario clickea "Sí, agregar" → crea cesantías → condición de
  //     detección ya no se cumple
  //   - Usuario clickea "Salario integral" → cambia tipoVinculacion="integral"
  //     → condición ya no se cumple
  //   - Usuario clickea "No aplican" → cambia tipoVinculacion="no_aplica"
  //     → condición ya no se cumple
  //   - Usuario clickea "Cerrar" → dismiss en sessionStorage hasta refresh
  const ownersConSalarioSinCesantias = useMemo(() => {
    return (owners || []).filter(o => {
      if (o.type !== "natural") return false;
      const salariosOwner = (user.ingresos || []).filter(i => i.owner === o.id && i.fiscalCode === "LAB_SALARIO" && i.sim !== false);
      if (!salariosOwner.length) return false;
      // Solo si al menos uno está como "ordinario" (default o explícito)
      const algunoOrdinario = salariosOwner.some(s => (s.tipoVinculacion || "ordinario") === "ordinario");
      if (!algunoOrdinario) return false;
      // Y NO tiene ya cesantías cargadas
      const tieneCesantias = (user.ingresos || []).some(i => i.owner === o.id && i.fiscalCode === "LAB_PRESTACIONES_CESANTIAS" && i.sim !== false);
      return !tieneCesantias;
    });
  }, [owners, user.ingresos]);

  const [bannerCesantiasDismissed, setBannerCesantiasDismissed] = useState(() => {
    try { return sessionStorage.getItem("fp3_bannerCesantiasMig") === "true"; } catch { return false; }
  });
  const dismissBannerCesantias = () => {
    setBannerCesantiasDismissed(true);
    try { sessionStorage.setItem("fp3_bannerCesantiasMig", "true"); } catch {}
  };

  // Acción: crear cesantías auto-generadas para todos los owners detectados
  const accionAgregarCesantias = () => {
    if (!onUserUpdate) return;
    const nuevasCesantias = ownersConSalarioSinCesantias.flatMap(o => {
      const salariosOwner = (user.ingresos || []).filter(i => i.owner === o.id && i.fiscalCode === "LAB_SALARIO" && i.sim !== false);
      // Una sola entrada de cesantías por owner (suma los salarios si tiene más de uno)
      const totalSalarioMensual = salariosOwner.reduce((s, x) => s + (Number(x.mensual) || 0), 0);
      if (totalSalarioMensual <= 0) return [];
      return [{
        id: "ing_" + Date.now() + "_" + o.id,
        nombre: `Cesantías + intereses (estimadas, ${o.name})`,
        categoria: "Cesantías",
        fiscalCode: "LAB_PRESTACIONES_CESANTIAS",
        mensual: Math.round(totalSalarioMensual * 1.12 / 12),
        tipo: "fijo",
        moneda: "COP",
        owner: o.id,
        autoGenerado: true,
        salarioOrigenId: salariosOwner[0].id,
        fuente: "Auto-generado por banner de migración Commit 6",
      }];
    });
    onUserUpdate({ ...user, ingresos: [...(user.ingresos || []), ...nuevasCesantias] });
  };

  // Acción: marcar todos los salarios de owners detectados como "integral"
  const accionMarcarIntegral = () => {
    if (!onUserUpdate) return;
    const idsAfectados = new Set(ownersConSalarioSinCesantias.map(o => o.id));
    const nuevosIngresos = (user.ingresos || []).map(i => {
      if (idsAfectados.has(i.owner) && i.fiscalCode === "LAB_SALARIO") {
        return { ...i, tipoVinculacion: "integral" };
      }
      return i;
    });
    onUserUpdate({ ...user, ingresos: nuevosIngresos });
  };

  // Acción: marcar como "no aplica" (honorarios, prestación de servicios, etc)
  const accionMarcarNoAplica = () => {
    if (!onUserUpdate) return;
    const idsAfectados = new Set(ownersConSalarioSinCesantias.map(o => o.id));
    const nuevosIngresos = (user.ingresos || []).map(i => {
      if (idsAfectados.has(i.owner) && i.fiscalCode === "LAB_SALARIO") {
        return { ...i, tipoVinculacion: "no_aplica" };
      }
      return i;
    });
    onUserUpdate({ ...user, ingresos: nuevosIngresos });
  };
  // ── Fin Commit 6 ───────────────────────────────────────────────────────

  // Tarea 2 (Camino 1): cuando "Sin optimizar" == "Optimizado", mostrar recomendaciones
  // del módulo recomendaciones.js. Cubre todas las palancas reales del ET (PV/AFC,
  // intereses vivienda, dependientes, salud prepagada, ICA descuento, etc.) y no solo
  // PV/AFC como hacía el hint contextual.
  const recomendaciones = useMemo(() => generarRecomendaciones(user, estimacion), [user, estimacion]);
  const recsByOwner = useMemo(() => {
    const map = {};
    for (const r of recomendaciones) {
      if (!r.ownerId) continue;
      if (!map[r.ownerId]) map[r.ownerId] = [];
      map[r.ownerId].push(r);
    }
    return map;
  }, [recomendaciones]);

  const resumenPorOwner = useMemo(() => {
    return owners.map((o) => {
      const det = (estimacion?.detalle || []).find((d) => d.name === o.name);
      const configurado = ownerConfigurado(o);
      const tieneIngresos = (user?.ingresos || []).some((i) => i.owner === o.id && i.sim !== false);

      // Estado: completo (configurado + con ingresos) | parcial (ingresos sin switches) | sin datos
      let estado = "sin_datos";
      if (tieneIngresos && configurado) estado = "completo";
      else if (tieneIngresos) estado = "parcial";

      return {
        owner: o,
        det,
        estado,
        configurado,
        tieneIngresos,
        impActual: Number(det?.impBruto || det?.impuesto || 0),
        impOpt: Number(det?.impOptBruto != null ? det.impOptBruto : (det?.impOpt || det?.impOptimizado || 0)),
        ahorro: Math.max(0, Number(det?.impBruto || det?.impuesto || 0) - Number(det?.impOptBruto != null ? det.impOptBruto : (det?.impOpt || det?.impOptimizado || 0))),
      };
    });
  }, [owners, estimacion, user]);

  const totales = useMemo(() => ({
    impActual: resumenPorOwner.reduce((s, r) => s + r.impActual, 0),
    impOpt: resumenPorOwner.reduce((s, r) => s + r.impOpt, 0),
    ahorro: resumenPorOwner.reduce((s, r) => s + r.ahorro, 0),
  }), [resumenPorOwner]);

  const cantCompletos = resumenPorOwner.filter((r) => r.estado === "completo").length;
  const titulo = owners.length === 1 ? "Tu responsable fiscal" : "Tus responsables fiscales";
  const descripcion = owners.length === 1
    ? "Esta es tu ficha fiscal. Revisá los números y editá cuando cambie tu situación."
    : `${owners.length} responsables fiscales. ${cantCompletos} con cálculo completo. Desde acá podés revisar cada uno o agregar uno nuevo.`;

  return (
    <div>
      <PasoHeader
        titulo={titulo}
        descripcion={descripcion}
      />

      {/* Commit 6 Tarea 3: Banner migración cesantías para usuarios existentes.
          Aparece SOLO si:
            - Hay al menos 1 owner natural con salario "ordinario" sin cesantías
            - El usuario no clickeó "Cerrar" en esta sesión
          Desaparece naturalmente al elegir cualquier acción real. */}
      {!bannerCesantiasDismissed && ownersConSalarioSinCesantias.length > 0 && (
        <div style={{ background: "rgba(34,197,94,0.06)", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px 18px", marginBottom: 16, position: "relative" }}>
          <button
            onClick={dismissBannerCesantias}
            aria-label="Cerrar banner"
            style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: T.txt3, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4 }}
          >×</button>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💵</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e", marginBottom: 4 }}>
                Detectamos {ownersConSalarioSinCesantias.length === 1 ? "un salario sin cesantías cargadas" : `${ownersConSalarioSinCesantias.length} salarios sin cesantías cargadas`}
              </div>
              <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
                Las cesantías son <strong>renta exenta del Art. 206 #4 ET</strong> con tope variable según salario. Muchos usuarios las olvidan y pagan más impuesto del que deben. Te ayudamos a cargarlas si aplica a tu caso.
              </div>
            </div>
          </div>

          {/* Lista de owners afectados (cuando son varios) */}
          {ownersConSalarioSinCesantias.length > 1 && (
            <div style={{ background: T.bg3, border: "1px solid " + T.border, borderRadius: 6, padding: "8px 10px", marginBottom: 10, fontSize: 11, color: T.txt2 }}>
              <strong>Afectados:</strong> {ownersConSalarioSinCesantias.map(o => o.name).join(", ")}
            </div>
          )}

          {/* 3 acciones */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={accionAgregarCesantias}
              style={{ background: "#22c55e", color: "#000", border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              ✓ Sí, agregar cesantías estimadas
            </button>
            <button
              onClick={accionMarcarIntegral}
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              Tengo salario integral (ya incluidas)
            </button>
            <button
              onClick={accionMarcarNoAplica}
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)", color: "#6366f1", padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              No aplica (honorarios / otro)
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: T.txt3, fontStyle: "italic", lineHeight: 1.4 }}>
            💡 La estimación se basa en 1 mes de salario al año + 12% de intereses (1.12 sueldos anuales). Podés modificar o eliminar el item después.
          </div>
        </div>
      )}

      {/* Layout: flex con wrap para que en mobile la columna derecha pase debajo,
          en desktop quede a la derecha. minWidth en cada columna evita overflow. */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>

        {/* Tarjetas de owners: ocupan el ancho disponible, mínimo 280px */}
        <div style={{ flex: "2 1 380px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, alignContent: "start" }}>
          {resumenPorOwner.map(({ owner, det, estado, impActual, impOpt, ahorro }) => {
            const estadoColor = estado === "completo" ? T.green : estado === "parcial" ? T.orange : T.txt3;
            const estadoLabel = estado === "completo" ? "Completo" : estado === "parcial" ? "Parcial" : "Sin configurar";
            const estadoIcono = estado === "completo" ? "✓" : estado === "parcial" ? "○" : "—";
            return (
              <div key={owner.id} style={{ background: T.bg3, border: "1px solid " + T.border, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Header compacto */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {owner.type === "juridica" ? "🏢" : "🧑"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.txt, textTransform: "capitalize", lineHeight: 1.2, wordBreak: "break-word" }}>
                      {owner.name}
                    </div>
                    <div style={{ fontSize: 9, color: T.txt3, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {owner.type === "juridica" ? "Jurídica" : "Natural"}
                    </div>
                  </div>
                </div>

                {/* Badge estado */}
                <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 4, padding: "2px 7px", background: `${estadoColor}15`, border: `1px solid ${estadoColor}40`, borderRadius: 8 }}>
                  <span style={{ fontSize: 9, color: estadoColor, fontWeight: 700 }}>{estadoIcono}</span>
                  <span style={{ fontSize: 9, color: estadoColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{estadoLabel}</span>
                </div>

                {/* Camino A + Commit 2 (Tarea 3 revisada): cifras honestas con
                    distinción entre IMPUESTO BRUTO (lo que se debe en total) y
                    SALDO A PAGAR estimado (lo que efectivamente se desembolsa
                    al presentar, después de retención en la fuente).

                    Diagnóstico de declaración real demostró que el malentendido
                    entre estos dos números es la confusión más común: el usuario
                    compara su "saldo a pagar" del año anterior contra el impuesto
                    bruto que muestra la calculadora. Ambos son correctos pero
                    miden cosas distintas (Casillas 126 vs 134 del F-210 DIAN).
                */}
                {det ? (() => {
                  // El motor expone retefuenteNat para naturales y retefuenteCalc para jurídicas.
                  // Ambos representan retención del año estimada según los ingresos cargados.
                  const reteAnual = Number(det.retefuenteNat || det.retefuenteCalc || 0);
                  const saldoPagar = Math.max(0, impActual - reteAnual);
                  const saldoPagarOpt = Math.max(0, impOpt - reteAnual);
                  const muestraDesglose = reteAnual > 100_000; // solo si hay retención significativa

                  if (ahorro > 100_000) {
                    // Modo comparativo: hay ahorro real por palanca opcional
                    return (
                      <div style={{ background: T.bg2, borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: 10, color: T.txt3 }}>Tu impuesto hoy</span>
                          <span style={{ ...F.mono, fontSize: 12, color: T.red }}>{fm(impActual)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: 10, color: T.txt3 }}>Si aplicás PV/AFC</span>
                          <span style={{ ...F.mono, fontSize: 12, color: T.green }}>{fm(impOpt)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4, borderTop: "1px dashed " + T.border }}>
                          <span style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>Ahorro potencial</span>
                          <span style={{ ...F.mono, fontSize: 13, color: T.green }}>+{fm(ahorro)}</span>
                        </div>
                        {muestraDesglose && (
                          <details style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed " + T.border }}>
                            <summary style={{ cursor: "pointer", fontSize: 9, color: T.blue, fontWeight: 600, listStyle: "none", letterSpacing: 0.3 }}>
                              ▾ Saldo a pagar estimado
                            </summary>
                            <div style={{ marginTop: 6, fontSize: 9, color: T.txt3, lineHeight: 1.5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>(−) Retenciones del año</span>
                                <span style={F.mono}>−{fm(reteAnual)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                <span style={{ color: T.txt2, fontWeight: 600 }}>= Saldo a pagar hoy</span>
                                <span style={{ ...F.mono, color: T.txt2, fontWeight: 700 }}>{fm(saldoPagar)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                                <span style={{ color: T.green, fontWeight: 600 }}>= Saldo si aplicás PV/AFC</span>
                                <span style={{ ...F.mono, color: T.green, fontWeight: 700 }}>{fm(saldoPagarOpt)}</span>
                              </div>
                              <div style={{ marginTop: 4, fontStyle: "italic" }}>
                                Las retenciones ya las pagaste durante el año. El saldo es lo que efectivamente desembolsás al presentar.
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  }
                  // Modo unificado
                  return (
                    <div style={{ background: T.bg2, borderRadius: 6, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>Tu impuesto estimado</span>
                        <span style={{ ...F.mono, fontSize: 14, color: T.txt }}>{fm(impActual)}</span>
                      </div>
                      {muestraDesglose && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 9, color: T.txt3 }}>
                            <span>(−) Retenciones del año</span>
                            <span style={F.mono}>−{fm(reteAnual)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4, borderTop: "1px dashed " + T.border }}>
                            <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>= Saldo a pagar estimado</span>
                            <span style={{ ...F.mono, fontSize: 13, color: T.green, fontWeight: 700 }}>{fm(saldoPagar)}</span>
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 9, color: T.txt3, lineHeight: 1.4, fontStyle: "italic" }}>
                        {muestraDesglose
                          ? "Las retenciones del año ya las pagaste sin verlas. El saldo es lo que efectivamente desembolsás al presentar la declaración."
                          : "Ya con todas las deducciones automáticas que el motor pudo aplicar de tus datos."}
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ fontSize: 10, color: T.txt3, fontStyle: "italic", padding: "4px 0" }}>
                    {estado === "sin_datos" ? "Sin ingresos registrados" : "Sin cálculo disponible"}
                  </div>
                )}

                {/* Capa 1 — Hint contextual inline (Commit 9.12) */}
                {(() => {
                  const hint = getHintContextual(det, owner);
                  if (!hint) return null;
                  const tonoBg = hint.tono === "ok" ? "rgba(34,197,94,0.06)" : "rgba(167,139,250,0.06)";
                  const tonoBorder = hint.tono === "ok" ? "rgba(34,197,94,0.18)" : "rgba(167,139,250,0.18)";
                  const tonoText = hint.tono === "ok" ? T.green : T.purple;
                  return (
                    <div style={{ background: tonoBg, border: `1px solid ${tonoBorder}`, borderRadius: 8, padding: "8px 10px", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, lineHeight: 1.4 }}>
                      <span style={{ flexShrink: 0, fontSize: 13, marginTop: 1 }}>{hint.icono}</span>
                      <span style={{ color: T.txt2 }}>
                        <strong style={{ color: tonoText }}>{hint.tono === "ok" ? "Listo:" : "Por qué:"}</strong> {hint.texto}
                      </span>
                    </div>
                  );
                })()}

                {/* Commit 21 Tarea 3: badge destacado de Régimen Simple cuando
                    el optimizador detecta una palanca de alto impacto (cierra el
                    último gap del reporte de análisis comparativo). Aparece
                    SIEMPRE — incluso si ya hay otras optimizaciones — porque el
                    cambio de régimen es decisión estratégica que el usuario
                    debe ver explícitamente con todo su contador. */}
                {(() => {
                  if (!det) return null;
                  const palancas = detectarPalancasAutomatizables(user, owner, det);
                  const palancaSimple = palancas.find(p => p.codigo === "REGIMEN_SIMPLE");
                  if (!palancaSimple) return null;
                  const mejor = palancaSimple.datos?.mejorOpcion;
                  if (!mejor) return null;
                  return (
                    <div style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(168,85,247,0.10))", border: "1.5px solid rgba(34,197,94,0.35)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>⚡</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: T.green, letterSpacing: 0.3 }}>
                            POSIBLE CAMBIO DE RÉGIMEN
                          </span>
                        </div>
                        <span style={{ ...F.mono, fontSize: 12, color: T.green, fontWeight: 800 }}>
                          ~{fm(palancaSimple.impactoEstimado)}/año
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
                        Si <strong>{owner.name}</strong> cumple los criterios de actividad del grupo <strong>"{mejor.label}"</strong>, podría acogerse al <strong>Régimen Simple (Arts. 903-916 ET)</strong> y pagar <strong>{fm(mejor.impuestoSimple)}</strong> en lugar de <strong>{fm(mejor.impuestoOrdinario)}</strong> al año <span style={{ color: T.green, fontWeight: 700 }}>(ahorro ~{mejor.ahorroPct.toFixed(0)}%)</span>.
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.20)", borderRadius: 6, padding: "6px 10px", fontSize: 9, color: T.txt3, lineHeight: 1.5 }}>
                        ⚠️ <strong>Esto es una sugerencia estratégica, no automática.</strong> Cambiar de régimen requiere validar el grupo CIIU exacto con tu contador, presentar formulario ante DIAN antes del 28 de febrero, y NO se puede deshacer hasta el siguiente año fiscal. Hay también exclusiones (Art. 906 ET) — no todas las actividades califican aunque cumplan el tope de ingresos.
                      </div>
                    </div>
                  );
                })()}

                {/* Tarea 2 (Camino 1): panel de oportunidades de ahorro real cuando
                    el "Optimizado" actual no aporta diferencia visible. Cubre palancas
                    que el hint contextual no menciona (vivienda, dependientes, salud
                    prepagada, ICA descuento, Régimen Simple, etc.) — todas vienen del
                    módulo recomendaciones.js que ya analiza el ET completo. */}
                {(() => {
                  if (!det) return null;
                  if (ahorro > 100_000) return null; // ya hay optimización significativa, no mostrar
                  const recsOwner = (recsByOwner[owner.id] || []).filter(r => r.code !== "TODO_OPTIMIZADO" && r.code !== "TODO_OPTIMIZADO_JURIDICA");
                  if (recsOwner.length === 0) return null;
                  const top = recsOwner.slice(0, 3); // mostrar top 3 por impacto
                  const totalAhorroEstimado = top.reduce((s, r) => s + (Number(r.ahorroAnualEstimado) || 0), 0);
                  return (
                    <div style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.blue }}>
                          💡 {recsOwner.length} oportunidad{recsOwner.length > 1 ? "es" : ""} de ahorro detectada{recsOwner.length > 1 ? "s" : ""}
                        </span>
                        {totalAhorroEstimado > 0 && (
                          <span style={{ ...F.mono, fontSize: 11, color: T.green, fontWeight: 700 }}>
                            +{fm(totalAhorroEstimado)}/año
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {top.map((r, idx) => (
                          <div key={r.code || idx} style={{ background: T.bg2, borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.txt2, lineHeight: 1.3 }}>{r.titulo}</span>
                              {Number(r.ahorroAnualEstimado) > 0 && (
                                <span style={{ ...F.mono, fontSize: 10, color: T.green, whiteSpace: "nowrap", flexShrink: 0 }}>
                                  ~{fm(r.ahorroAnualEstimado)}/año
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4 }}>{r.descripcion}</div>
                          </div>
                        ))}
                      </div>
                      {recsOwner.length > 3 && (
                        <div style={{ fontSize: 10, color: T.txt3, fontStyle: "italic" }}>
                          + {recsOwner.length - 3} oportunidad{recsOwner.length - 3 > 1 ? "es" : ""} más al ver el desglose completo.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Capa 2 — Acordeón "Ver desglose y plan de acción" */}
                {det && (
                  <details style={{ paddingTop: 8, marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: T.blue, fontWeight: 700, listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, userSelect: "none" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>📊</span>
                        Ver desglose y plan de acción
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>▼</span>
                    </summary>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                      {/* Desglose breve */}
                      <div style={{ background: T.bg2, borderRadius: 6, padding: 10, fontSize: 11 }}>
                        <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Desglose fiscal</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {Number(det.ingreso || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: T.txt3 }}>Ingresos brutos</span>
                              <span style={{ ...F.mono, fontSize: 11, color: T.txt2 }}>{fm(det.ingreso)}</span>
                            </div>
                          )}
                          {Number(det.totalDeducciones || det.gastosDeduc || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: T.txt3 }}>(-) Deducciones aplicadas</span>
                              <span style={{ ...F.mono, fontSize: 11, color: T.green }}>{fm(det.totalDeducciones || det.gastosDeduc)}</span>
                            </div>
                          )}
                          {Number(det.retencionFuente || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: T.txt3 }}>(-) Retención en la fuente</span>
                              <span style={{ ...F.mono, fontSize: 11, color: T.blue }}>−{fm(det.retencionFuente)}</span>
                            </div>
                          )}
                          {Number(det.rentaGravable || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4, borderTop: "1px dashed " + T.border }}>
                              <span style={{ color: T.txt2, fontWeight: 600 }}>Renta gravable</span>
                              <span style={{ ...F.mono, fontSize: 11, color: T.txt }}>{fm(det.rentaGravable)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Plan de acción */}
                      {(() => {
                        const recs = getTopRecomendaciones(det, owner, 4);
                        if (recs.length === 0) return null;
                        return (
                          <div>
                            <div style={{ fontSize: 9, color: T.txt3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                              Plan de acción ({recs.length})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {recs.map((r, i) => (
                                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: 8, background: T.bg2, borderRadius: 6 }}>
                                  <span style={{ flexShrink: 0, fontSize: 14 }}>{r.icono}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: r.tono === "ok" ? T.green : T.txt2, marginBottom: 2 }}>{r.titulo}</div>
                                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.4 }}>{r.desc}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </details>
                )}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 4, marginTop: "auto", flexWrap: "wrap" }}>
                  {estado === "parcial" && onMarcarCompletoOwner && (
                    <button
                      onClick={() => onMarcarCompletoOwner(owner.id)}
                      title="Si ya revisaste este responsable y no tiene más optimizaciones aplicables, márcalo como revisado."
                      style={{ flex: 1, padding: "6px 8px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer" }}
                    >
                      ✓ Marcar revisado
                    </button>
                  )}
                  <button
                    onClick={() => onSelectOwner(owner.id)}
                    style={{ flex: 1, padding: "6px 10px", background: estado === "completo" ? T.bg2 : T.blue, color: estado === "completo" ? T.txt2 : "#fff", border: estado === "completo" ? "1px solid " + T.border : "none", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {estado === "completo" ? "Revisar →" : estado === "parcial" ? "Completar →" : "Empezar →"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Columna derecha: total + acciones. flex 1 1 280px = ocupa al menos 280px,
            crece hasta 1 parte del espacio. En mobile pasa debajo (flex-wrap). */}
        <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {cantCompletos > 0 && (
            <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 10, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
                Total consolidado
              </div>
              <div style={{ fontSize: 10, color: T.txt3, marginBottom: 14 }}>
                {cantCompletos} de {owners.length} responsables
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Camino A: si el ahorro agregado es significativo, modo comparativo;
                    si no, modo unificado con texto honesto. */}
                {totales.ahorro > 100_000 ? (
                  <>
                    <div>
                      <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>Tu impuesto hoy</div>
                      <div style={{ ...F.mono, fontSize: 18, color: T.red }}>{fm(totales.impActual)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>Si aplicás PV/AFC</div>
                      <div style={{ ...F.mono, fontSize: 18, color: T.green }}>{fm(totales.impOpt)}</div>
                    </div>
                    <div style={{ paddingTop: 10, borderTop: "1px solid rgba(34,197,94,0.2)" }}>
                      <div style={{ fontSize: 9, color: T.green, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3, fontWeight: 700 }}>Ahorro potencial</div>
                      <div style={{ ...F.mono, fontSize: 22, color: T.green }}>+{fm(totales.ahorro)}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>Tu impuesto estimado</div>
                      <div style={{ ...F.mono, fontSize: 22, color: T.txt }}>{fm(totales.impActual)}</div>
                    </div>
                    <div style={{ fontSize: 10, color: T.txt3, lineHeight: 1.5, fontStyle: "italic", paddingTop: 6 }}>
                      Ya con todas las deducciones automáticas que el motor pudo aplicar. Para reducir más, revisá el plan de acción de cada responsable.
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={onNuevoCalculo} style={{ padding: "10px 14px", background: "transparent", border: "1px dashed " + T.border, color: T.txt2, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
              + Calcular otro responsable
            </button>
            <button onClick={() => onNavigate?.("tax-dashboard")} style={{ padding: "10px 14px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
              Ir al Dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalculadoraWizard({ user, trm, onNavigate, onUserUpdate }) {
  const owners = useMemo(() => (user?.owners || []), [user]);

  // Commit 9.5 (Parte B): VistaResumen es el default ABSOLUTO.
  // - Incluso con 1 owner: ve su tarjeta con "Empezar cálculo →".
  // - Wizard solo se activa desde "Editar ficha" o "+ Agregar responsable".
  // - Al terminar el wizard (Paso 5 → "Guardar y volver"), vuelve al resumen.
  const [vistaActiva, setVistaActiva] = useState(() => {
    try {
      const saved = localStorage.getItem("fp3_calc_vista");
      if (saved === "resumen" || saved === "wizard") return saved;
    } catch {}
    // Default: siempre resumen.
    return "resumen";
  });
  useEffect(() => {
    try { localStorage.setItem("fp3_calc_vista", vistaActiva); } catch {}
  }, [vistaActiva]);

  const [currentStep, setCurrentStep] = useState(() => {
    try { return Number(localStorage.getItem("fp3_calc_step") || "0") || 0; }
    catch { return 0; }
  });
  useEffect(() => {
    try { localStorage.setItem("fp3_calc_step", String(currentStep)); } catch {}
  }, [currentStep]);

  const [selectedOwnerId, setSelectedOwnerId] = useState(() => {
    try {
      const saved = localStorage.getItem("fp3_calc_owner");
      if (saved && owners.some((o) => o.id === saved)) return saved;
    } catch {}
    return owners[0]?.id || "";
  });
  useEffect(() => {
    if (selectedOwnerId) {
      try { localStorage.setItem("fp3_calc_owner", selectedOwnerId); } catch {}
    }
  }, [selectedOwnerId]);

  const selectedOwner = useMemo(() => owners.find((o) => o.id === selectedOwnerId) || null, [owners, selectedOwnerId]);

  const handleUpdateProfile = (newProfile) => {
    if (!onUserUpdate || !selectedOwner) return;
    const newOwners = (user.owners || []).map((o) =>
      o.id === selectedOwner.id ? { ...o, fiscalProfile: newProfile } : o
    );
    onUserUpdate({ ...user, owners: newOwners });
  };

  // handleUpdateOwner: actualiza campos directos del owner (regimen, simpleGrupo,
  // type, name) que NO viven dentro de fiscalProfile. Acepta un objeto parcial.
  const handleUpdateOwner = (partialUpdate) => {
    if (!onUserUpdate || !selectedOwner) return;
    const newOwners = (user.owners || []).map((o) =>
      o.id === selectedOwner.id ? { ...o, ...partialUpdate } : o
    );
    onUserUpdate({ ...user, owners: newOwners });
  };

  // Fix 9.6: marcar owner como wizardCompletado cuando el usuario finaliza
  // el flujo, independientemente de si activo o no optimizaciones.
  // Cubre el caso real: "ya revisé todo, este responsable no tiene nada
  // aplicable a su situacion, marcalo como completo igual".
  const handleMarcarCompleto = () => {
    if (!onUserUpdate || !selectedOwner) return;
    const newOwners = (user.owners || []).map((o) =>
      o.id === selectedOwner.id
        ? { ...o, fiscalProfile: { ...(o.fiscalProfile || {}), wizardCompletado: true } }
        : o
    );
    onUserUpdate({ ...user, owners: newOwners });
  };

  const goNext = () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const reiniciar = () => setCurrentStep(0);

  // Si está en vista resumen, mostrar VistaResumenMultiOwner (funciona con 1 o más owners).
  if (vistaActiva === "resumen") {
    return (
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={F.h1}>Calculadora de impuestos</h1>
            <p style={{ ...F.caption, marginTop: 4 }}>
              {owners.length === 1 ? "Tu ficha fiscal" : `${owners.length} responsables fiscales`}
            </p>
          </div>
        </div>

        <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: 24 }}>
          <VistaResumenMultiOwner
            user={user}
            owners={owners}
            onUserUpdate={onUserUpdate}
            onSelectOwner={(ownerId) => {
              setSelectedOwnerId(ownerId);
              setCurrentStep(1); // ir directo a Paso 2 (tus datos) ya que el owner está elegido
              setVistaActiva("wizard");
            }}
            onNuevoCalculo={() => {
              setCurrentStep(0); // ir al Paso 1 (selector)
              setVistaActiva("wizard");
            }}
            onNavigate={onNavigate}
            onMarcarCompletoOwner={(ownerId) => {
              // Marcar explícitamente este owner como wizardCompletado desde la lista.
              // Útil cuando el usuario ya revisó y no tiene optimizaciones aplicables.
              if (!onUserUpdate) return;
              const newOwners = (user.owners || []).map((o) =>
                o.id === ownerId
                  ? { ...o, fiscalProfile: { ...(o.fiscalProfile || {}), wizardCompletado: true } }
                  : o
              );
              onUserUpdate({ ...user, owners: newOwners });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "20px 16px" }}>
      {/* Header con toggle modo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={F.h1}>Calculadora de impuestos</h1>
          <p style={{ ...F.caption, marginTop: 4 }}>
            Paso {currentStep + 1} de {STEPS.length} — {STEPS[currentStep].titulo}
          </p>
        </div>
        <button onClick={() => setVistaActiva("resumen")} style={{ padding: "6px 12px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          ← Volver a mis fichas
        </button>
      </div>

      {/* Stepper */}
      <Stepper currentStep={currentStep} onGotoStep={setCurrentStep} />

      {/* Navegación rápida a módulos para cargar/editar datos sin perder progreso */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap", padding: "10px 14px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8 }}>
        <span style={{ ...F.caption, fontWeight: 600, color: T.txt2 }}>¿Te falta cargar algo?</span>
        <button onClick={() => onNavigate?.("ing")} style={{ padding: "5px 10px", background: T.bg2, border: "1px solid " + T.border, color: T.txt2, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Ingresos</button>
        <button onClick={() => onNavigate?.("gas")} style={{ padding: "5px 10px", background: T.bg2, border: "1px solid " + T.border, color: T.txt2, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Egresos / Aportes</button>
        <button onClick={() => onNavigate?.("deu")} style={{ padding: "5px 10px", background: T.bg2, border: "1px solid " + T.border, color: T.txt2, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Deudas</button>
      </div>

      {/* Contenido del paso activo */}
      <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: 24 }}>
        {currentStep === 0 && (
          <Paso1Owner
            owners={owners}
            selectedOwnerId={selectedOwnerId}
            onSelect={setSelectedOwnerId}
            onNext={goNext}
          />
        )}
        {currentStep === 1 && (
          <Paso2Datos
            user={user}
            selectedOwner={selectedOwner}
            onBack={goBack}
            onNext={goNext}
            onNavigate={onNavigate}
          />
        )}
        {currentStep === 2 && (
          <Paso3Situacion
            user={user}
            selectedOwner={selectedOwner}
            owners={owners}
            onUpdateProfile={handleUpdateProfile}
            onUpdateOwner={handleUpdateOwner}
            onBack={goBack}
            onNext={goNext}
            onNavigate={onNavigate}
          />
        )}
        {currentStep === 3 && (
          <Paso4Eventos
            selectedOwner={selectedOwner}
            onUpdateProfile={handleUpdateProfile}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {currentStep === 4 && (
          <Paso5Resultado
            user={user}
            selectedOwner={selectedOwner}
            owners={owners}
            onBack={goBack}
            onNavigate={onNavigate}
            onReiniciar={reiniciar}
            onSelectOwner={setSelectedOwnerId}
            onGotoStep={setCurrentStep}
            onVerResumen={() => {
              handleMarcarCompleto();
              setVistaActiva("resumen");
            }}
            onMarcarCompleto={handleMarcarCompleto}
          />
        )}
      </div>
    </div>
  );
}
