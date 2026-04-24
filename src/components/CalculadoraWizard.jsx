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
// - Botón "Ver todo a la vez" para modo experto — muestra la vista clásica.
// - Reutiliza lógica de estimarImpuesto, getFiscalWarnings, data gaps.
//
// Este componente NO toca el motor ni la persistencia. Solo reorganiza la
// presentación. Los switches siguen persistiendo en owner.fiscalProfile
// igual que antes.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from "react";
import { estimarImpuesto } from "../lib/taxCO.js";
import AjustesFiscalesPersonalizados from "./AjustesFiscalesPersonalizados";
import CalculadoraImpuestos from "./CalculadoraImpuestos";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", red: "#ef4444", orange: "#f97316", blue: "#3b82f6", purple: "#a78bfa",
};

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
    <div style={{ display: "flex", gap: 4, marginBottom: 20, padding: "0 4px" }}>
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
              flex: 1,
              padding: "10px 6px",
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
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}>
              {isDone ? "✓" : `${i + 1}`} · {s.titulo}
            </div>
            <div style={{ fontSize: 9, color: isActive ? T.blue : T.txt3, lineHeight: 1.3 }}>
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
  const ownerIng = useMemo(() => (user?.ingresos || []).filter(i => i.owner === ownerId), [user, ownerId]);
  const ownerGas = useMemo(() => Object.values(user?.gas || {}).flat().filter(g => g.owner === ownerId), [user, ownerId]);
  const ownerDeu = useMemo(() => (user?.deu || []).filter(d => d.owner === ownerId), [user, ownerId]);

  const resumen = useMemo(() => {
    const salario = ownerIng.filter(i => i.categoria === "Salario").reduce((s, i) => s + (i.mensual || 0), 0);
    const honorarios = ownerIng.filter(i => i.categoria === "Honorarios").reduce((s, i) => s + (i.mensual || 0), 0);
    const arriendos = ownerIng.filter(i => i.categoria === "Arriendo").reduce((s, i) => s + (i.mensual || 0), 0);
    const rendimientos = ownerIng.filter(i => i.categoria === "Rendimientos").reduce((s, i) => s + (i.mensual || 0), 0);
    const dividendos = ownerIng.filter(i => i.categoria === "Dividendos").reduce((s, i) => s + (i.mensual || 0), 0);
    const gastosActividad = ownerGas.filter(g => ["Oficina", "Servicios", "Tecnología", "Transporte"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0);
    const gastosInmueble = ownerGas.filter(g => ["Predial", "Mantenimiento", "Seguros"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0);
    return { salario, honorarios, arriendos, rendimientos, dividendos, gastosActividad, gastosInmueble };
  }, [ownerIng, ownerGas]);

  const dataGaps = useMemo(() => {
    const gaps = [];
    if (resumen.arriendos > 0 && resumen.gastosInmueble === 0) {
      gaps.push({
        titulo: "Arriendo sin gastos del inmueble",
        desc: "Registraste arriendos como ingreso, pero no predial, administración ni mantenimiento. Si los pagás, son deducibles.",
        page: "gas", icono: "🏠",
      });
    }
    if (resumen.honorarios > 0 && resumen.gastosActividad === 0) {
      gaps.push({
        titulo: "Honorarios sin gastos de actividad",
        desc: "Como independiente, podés deducir oficina, servicios, transporte, tecnología con causalidad. No veo ninguno.",
        page: "gas", icono: "💼",
      });
    }
    const tieneSalario = resumen.salario > 0;
    const tieneAportes = ownerIng.some(i => i.categoria === "Salario" && i.aportes && ((i.aportes.pension || 0) + (i.aportes.salud || 0)) > 0);
    if (tieneSalario && !tieneAportes) {
      gaps.push({
        titulo: "Salario sin aportes obligatorios registrados",
        desc: "Todo empleado aporta 4% pensión + 4% salud. Sin registrarlos el motor sobrestima el impuesto.",
        page: "ing", icono: "💼",
      });
    }
    const tieneDeudaHipotecaria = ownerDeu.some(d => (d.mt || 0) > 10_000_000 && (d.tipo === "Hipoteca" || (d.nombre || "").toLowerCase().includes("hipote") || (d.nombre || "").toLowerCase().includes("vivienda")));
    const marcadaComoVivienda = ownerDeu.some(d => d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL");
    if (tieneDeudaHipotecaria && !marcadaComoVivienda) {
      gaps.push({
        titulo: "Hipoteca sin clasificar como vivienda habitacional",
        desc: "Si es tu casa, los intereses son deducibles hasta 1.200 UVT/año.",
        page: "deu", icono: "🏡",
      });
    }
    return gaps;
  }, [resumen, ownerIng, ownerDeu]);

  const filas = [
    { label: "Salario mensual", value: resumen.salario, icono: "💼" },
    { label: "Honorarios mensual", value: resumen.honorarios, icono: "💰" },
    { label: "Arriendos recibidos", value: resumen.arriendos, icono: "🏠" },
    { label: "Rendimientos financieros", value: resumen.rendimientos, icono: "📈" },
    { label: "Dividendos", value: resumen.dividendos, icono: "🏦" },
  ].filter(f => f.value > 0);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginBottom: 4 }}>
          Revisá los datos de {selectedOwner?.name}
        </div>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5, maxWidth: 500, margin: "0 auto" }}>
          Esto es lo que ya tengo cargado. Si algo falta, podés completarlo antes de seguir.
        </div>
      </div>

      {filas.length === 0 ? (
        <div style={{ padding: 24, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 10, textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: T.txt, fontWeight: 700, marginBottom: 6 }}>⚠️ Sin ingresos registrados para {selectedOwner?.name}</div>
          <div style={{ fontSize: 12, color: T.txt2, marginBottom: 12, lineHeight: 1.5 }}>
            Para calcular el impuesto necesitás tener al menos un ingreso cargado. Podés seguir para activar switches de ganancias ocasionales (herencia/venta inmueble) si aplica.
          </div>
          <button onClick={() => onNavigate?.("ing")} style={{ padding: "8px 16px", background: T.blue, border: "none", color: "white", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Ir a cargar ingresos →
          </button>
        </div>
      ) : (
        <div style={{ background: T.bg3, borderRadius: 10, padding: "8px 0", marginBottom: 14 }}>
          {filas.map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid " + T.border, gap: 10 }}>
              <div style={{ fontSize: 18 }}>{f.icono}</div>
              <div style={{ flex: 1, fontSize: 12, color: T.txt2 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: "monospace" }}>{fm(f.value)}</div>
            </div>
          ))}
        </div>
      )}

      {dataGaps.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.orange, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            ⚠️ Datos que te podrían faltar ({dataGaps.length})
          </div>
          {dataGaps.map((g, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderLeft: "3px solid " + T.orange, borderRadius: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 16 }}>{g.icono}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.txt }}>{g.titulo}</div>
                  <div style={{ fontSize: 11, color: T.txt2, marginTop: 3, lineHeight: 1.5 }}>{g.desc}</div>
                </div>
                <button onClick={() => onNavigate?.(g.page)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid " + T.orange, color: T.orange, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Completar →
                </button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>
            Podés completar estos datos ahora o seguir adelante. El cálculo será más preciso si los cargás primero.
          </div>
        </div>
      )}

      {dataGaps.length === 0 && filas.length > 0 && (
        <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✅ Tus datos se ven completos</div>
          <div style={{ fontSize: 11, color: T.txt2, marginTop: 3 }}>No detecté datos obvios que te falten. Continuemos.</div>
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
function Paso3Situacion({ selectedOwner, onUpdateProfile, onBack, onNext }) {
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👨‍👩‍👧</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginBottom: 4 }}>
          Contanos sobre tu situación personal
        </div>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5, maxWidth: 520, margin: "0 auto" }}>
          Estas preguntas aplican deducciones legales que el sistema no puede adivinar. Contestá solo las que apliquen; las demás se quedan sin efecto.
        </div>
      </div>
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
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginBottom: 4 }}>
          ¿Pasó algo especial este año?
        </div>
        <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.5, maxWidth: 520, margin: "0 auto" }}>
          Eventos como herencia, venta de inmueble o lotería se gravan aparte (ganancias ocasionales). Donaciones e inversiones especiales dan descuentos.
        </div>
      </div>
      <AjustesFiscalesPersonalizados owner={selectedOwner} onUpdate={onUpdateProfile} filterGroup="eventos" />
      <NavButtons currentStep={3} onBack={onBack} onNext={onNext} nextLabel="Ver mi impuesto →" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 5 — Resultado + acciones concretas
// ═══════════════════════════════════════════════════════════════════════════
function Paso5Resultado({ user, selectedOwner, owners, onBack, onNavigate, onReiniciar, onSelectOwner, onGotoStep }) {
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
  const impOpt = Number(det.impOpt || det.impOptimizado || 0);
  const ahorro = Math.max(0, impActual - impOpt);
  const impGO = Number(det.impGO || 0);

  // Acciones concretas que construyo contextualmente
  const acciones = [];
  const tieneDeclaracion = selectedOwner?.declaraciones && selectedOwner.declaraciones.length > 0;
  if (ahorro > 1_000_000) {
    acciones.push({
      icono: "💸",
      titulo: `Registrá aportes a PV/AFC para capturar tu ahorro`,
      desc: `El motor detectó espacio legal hasta ${fm(ahorro)}/año. Aportando a PV o AFC en Egresos, activás esa optimización real.`,
      cta: "Ir a Egresos",
      page: "gas",
    });
  }
  if (!tieneDeclaracion) {
    acciones.push({
      icono: "📤",
      titulo: "Subí tu declaración del año pasado",
      desc: "Así comparamos lo que pagaste el año anterior vs lo que estás proyectando hoy. Se sube con IA en 30 segundos.",
      cta: "Ir al Dashboard",
      page: "tax-dashboard",
    });
  }
  acciones.push({
    icono: "👨‍💼",
    titulo: "Compartí este reporte con tu contador",
    desc: "Exportá un PDF con todos los números para revisar con él antes de declarar.",
    cta: "Exportar PDF",
    page: "tax-dashboard",
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

      {/* CTA principal: siguiente owner o finalizado */}
      {siguienteOwner ? (
        <div style={{ padding: "14px 18px", background: "rgba(59,130,246,0.08)", border: "2px solid " + T.blue, borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>{siguienteOwner.type === "juridica" ? "🏢" : "🧑"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Siguiente propietario</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.txt }}>{siguienteOwner.name}</div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
              {ownersConfigurados} de {owners.length} configurados
            </div>
          </div>
          <button
            onClick={() => { onSelectOwner?.(siguienteOwner.id); onGotoStep?.(1); }}
            style={{ padding: "10px 18px", background: T.blue, border: "none", color: "white", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            Calcular para {siguienteOwner.name.split(" ")[0]} →
          </button>
        </div>
      ) : owners.length > 1 && todosConfigurados ? (
        <div style={{ padding: "14px 18px", background: "rgba(34,197,94,0.08)", border: "2px solid " + T.green, borderRadius: 12, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 3 }}>¡Listo! Configuraste todos tus propietarios</div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5 }}>
            Todos tus {owners.length} propietarios tienen su optimización configurada. Revisá el Dashboard para ver el panorama completo.
          </div>
          <button onClick={() => onNavigate?.("tax-dashboard")} style={{ marginTop: 10, padding: "8px 16px", background: T.green, border: "none", color: "#000", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            Ver Dashboard →
          </button>
        </div>
      ) : null}

      {/* Navegación inferior */}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20, paddingTop: 18, borderTop: "1px solid " + T.border, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ padding: "9px 16px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          ← Modificar respuestas
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {owners.length > 1 && (
            <button onClick={() => onGotoStep?.(0)} style={{ padding: "9px 14px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              Elegir otro propietario
            </button>
          )}
          <button onClick={onReiniciar} style={{ padding: "9px 14px", background: "transparent", border: "1px solid " + T.border, color: T.txt3, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
            Empezar de cero ↻
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function CalculadoraWizard({ user, trm, onNavigate, onUserUpdate }) {
  const owners = useMemo(() => (user?.owners || []), [user]);

  // Modo: wizard (default) o classic (vista todo a la vez)
  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem("fp3_calc_modo") || "wizard"; }
    catch { return "wizard"; }
  });
  useEffect(() => {
    try { localStorage.setItem("fp3_calc_modo", modo); } catch {}
  }, [modo]);

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

  const goNext = () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const reiniciar = () => setCurrentStep(0);

  // Modo clásico = vista anterior sin wizard
  if (modo === "classic") {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button onClick={() => setModo("wizard")} style={{ padding: "6px 12px", background: T.bg3, border: "1px solid " + T.border, color: T.txt2, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            🧭 Volver al modo guiado
          </button>
        </div>
        <CalculadoraImpuestos user={user} trm={trm} onNavigate={onNavigate} onUserUpdate={onUserUpdate} />
      </div>
    );
  }

  // Modo wizard (default)
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px" }}>
      {/* Header con toggle modo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.txt }}>📊 Calculadora de impuestos</div>
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
            Paso {currentStep + 1} de {STEPS.length}: {STEPS[currentStep].titulo}
          </div>
        </div>
        <button onClick={() => setModo("classic")} style={{ padding: "6px 12px", background: T.bg3, border: "1px solid " + T.border, color: T.txt3, borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
          Ver todo a la vez ↗
        </button>
      </div>

      {/* Stepper */}
      <Stepper currentStep={currentStep} onGotoStep={setCurrentStep} />

      {/* Contenido del paso activo */}
      <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: 20 }}>
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
          />
        )}
      </div>
    </div>
  );
}
