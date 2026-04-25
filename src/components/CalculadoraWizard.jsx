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
import { estimarImpuesto } from "../lib/taxCO.js";
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

const UVT = 52_374;
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
    const gastosActividad = ownerGas.filter(g => ["Oficina", "Servicios", "Tecnología", "Transporte"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0);
    // Categorías de gastos del inmueble — ampliadas para evitar falso positivo
    // cuando el usuario registró el predial/mantenimiento bajo otro nombre.
    const categoriasInmueble = [
      "Predial", "Mantenimiento", "Seguros",
      "Administración", "Vivienda", "Servicios", "Servicios públicos",
    ];
    const gastosInmueble = ownerGas.filter(g => {
      const cat = (g.cat || "").toLowerCase();
      // Match por categoría exacta o por palabras clave en el nombre
      if (categoriasInmueble.some(c => c.toLowerCase() === cat)) return true;
      const nombre = (g.nombre || g.c || "").toLowerCase();
      return nombre.includes("predial") || nombre.includes("administra") ||
             nombre.includes("manteni") || nombre.includes("seguro");
    }).reduce((s, g) => s + (g.m || 0), 0);
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

function Paso3Situacion({ selectedOwner, onUpdateProfile, onBack, onNext }) {
  return (
    <div>
      <PasoHeader
        owner={selectedOwner}
        titulo="Tu situación personal"
        descripcion="Estas preguntas aplican deducciones legales que el sistema no puede adivinar. Contestá solo las que apliquen; las demás se quedan sin efecto."
      />
      <AjustesFiscalesPersonalizados owner={selectedOwner} onUpdate={onUpdateProfile} filterGroup="personal" />
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

      {/* Números grandes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div style={{ padding: 16, background: T.bg3, border: "2px solid " + T.border, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Sin optimizar</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>{fm(impActual)}</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>{det.ingreso > 0 ? `${((impActual / det.ingreso) * 100).toFixed(1)}% de tus ingresos` : ""}</div>
        </div>
        <div style={{ padding: 16, background: "rgba(34,197,94,0.08)", border: "2px solid " + T.green, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Con optimización máxima</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(impOpt)}</div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>{det.ingreso > 0 ? `${((impOpt / det.ingreso) * 100).toFixed(1)}% de tus ingresos` : ""}</div>
        </div>
      </div>

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
function VistaResumenMultiOwner({ user, owners, onSelectOwner, onNuevoCalculo, onNavigate, onMarcarCompletoOwner }) {
  const estimacion = useMemo(() => estimarImpuesto(user), [user]);

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

                {/* Cifras compactas en lista vertical (no grid 3 cols) */}
                {det ? (
                  <div style={{ background: T.bg2, borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 10, color: T.txt3 }}>Sin optimizar</span>
                      <span style={{ ...F.mono, fontSize: 12, color: T.red }}>{fm(impActual)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 10, color: T.txt3 }}>Optimizado</span>
                      <span style={{ ...F.mono, fontSize: 12, color: T.green }}>{fm(impOpt)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 4, borderTop: "1px dashed " + T.border }}>
                      <span style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>Ahorro</span>
                      <span style={{ ...F.mono, fontSize: 13, color: ahorro > 0 ? T.green : T.txt3 }}>{ahorro > 0 ? "+" + fm(ahorro) : "—"}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: T.txt3, fontStyle: "italic", padding: "4px 0" }}>
                    {estado === "sin_datos" ? "Sin ingresos registrados" : "Sin cálculo disponible"}
                  </div>
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
                <div>
                  <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>Sin optimizar</div>
                  <div style={{ ...F.mono, fontSize: 18, color: T.red }}>{fm(totales.impActual)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>Optimizado</div>
                  <div style={{ ...F.mono, fontSize: 18, color: T.green }}>{fm(totales.impOpt)}</div>
                </div>
                <div style={{ paddingTop: 10, borderTop: "1px solid rgba(34,197,94,0.2)" }}>
                  <div style={{ fontSize: 9, color: T.green, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3, fontWeight: 700 }}>Ahorro potencial</div>
                  <div style={{ ...F.mono, fontSize: 22, color: totales.ahorro > 0 ? T.green : T.txt3 }}>{totales.ahorro > 0 ? "+" + fm(totales.ahorro) : "—"}</div>
                </div>
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
            selectedOwner={selectedOwner}
            onUpdateProfile={handleUpdateProfile}
            onBack={goBack}
            onNext={goNext}
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
