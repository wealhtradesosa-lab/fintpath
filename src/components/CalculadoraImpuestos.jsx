// ═══════════════════════════════════════════════════════════════════════════
// CALCULADORA DE IMPUESTOS — Fase 1 (Commit 8.1)
// ─────────────────────────────────────────────────────────────────────────
// Vista de 2 columnas que compara:
//   Izquierda "Actual"     — impuesto con los datos que el usuario ya cargó
//                            en Ingresos/Egresos/Deudas
//   Derecha  "Optimizado"  — impuesto aplicando todas las palancas que el
//                            motor ya sabe (PV/AFC hasta el tope del 40%,
//                            exenta 25%, deducciones disponibles)
//
// Fase 1: solo layout + auto-lectura. NO tiene switches nuevos todavía —
// eso es Fase 2. Objetivo: validar que el usuario ve clara la diferencia
// entre "hoy" y "lo que podrías legalmente optimizar".
//
// Fuente única de cálculo: estimarImpuesto(u) del motor. Este componente
// NO calcula nada por su cuenta, solo presenta lo que el motor devuelve.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import { estimarImpuesto } from "../lib/taxCO.js";
import { getFiscalWarnings } from "../lib/normalize.js";
import AjustesFiscalesPersonalizados from "./AjustesFiscalesPersonalizados";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  border: "rgba(255,255,255,0.06)",
  green: "#22c55e", red: "#ef4444", orange: "#f97316", blue: "#3b82f6", purple: "#a78bfa",
};

const fm = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString("es-CO");
};
const pc = (v) => (Number(v) || 0).toFixed(1) + "%";

// ─────────────────────────────────────────────────────────────────────────
// Fila de datos: label + valor + fuente ("desde Ingresos", "desde Egresos")
// ─────────────────────────────────────────────────────────────────────────
function DataRow({ label, value, source, esPositivo }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed " + T.border, gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.txt2 }}>{label}</div>
        {source && <div style={{ fontSize: 10, color: T.txt3, marginTop: 1 }}>📍 {source}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", color: esPositivo ? T.green : (esPositivo === false ? T.red : T.txt), whiteSpace: "nowrap" }}>
        {typeof value === "number" ? fm(value) : value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Alerta de dato faltante (data gap detection)
// ─────────────────────────────────────────────────────────────────────────
function DataGapAlert({ titulo, descripcion, ctaLabel, onClick }) {
  return (
    <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderLeft: "3px solid " + T.orange, borderRadius: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.txt, marginBottom: 3 }}>{titulo}</div>
      <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, marginBottom: 6 }}>{descripcion}</div>
      {onClick && (
        <button onClick={onClick} style={{ padding: "5px 10px", background: "transparent", border: "1px solid " + T.orange, borderRadius: 6, color: T.orange, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {ctaLabel} →
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Columna de resultado (Actual o Optimizado)
// ─────────────────────────────────────────────────────────────────────────
function ResultColumn({ titulo, subtitle, detalle, color, accentColor, tipo }) {
  if (!detalle) {
    return (
      <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: T.txt3 }}>Sin datos</div>
      </div>
    );
  }

  const esNatural = detalle.type === "natural";
  const imp = tipo === "optimizado" ? (detalle.impOpt || 0) : (detalle.impBruto || detalle.impuesto || 0);
  const tasaEfectiva = detalle.ingreso > 0 ? (imp / detalle.ingreso) * 100 : 0;

  return (
    <div style={{ background: T.bg2, border: "2px solid " + color, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 11, color: T.txt3, marginBottom: 14, lineHeight: 1.5 }}>
        {subtitle}
      </div>

      {/* Gran impuesto */}
      <div style={{ textAlign: "center", padding: "14px 0", borderBottom: "1px solid " + T.border, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Impuesto estimado</div>
        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: accentColor || T.txt }}>
          {fm(imp)}
        </div>
        <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
          Tasa efectiva: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{pc(tasaEfectiva)}</span>
        </div>
      </div>

      {/* Desglose */}
      <div style={{ fontSize: 11 }}>
        <DataRow label="Ingresos totales" value={detalle.ingreso || 0} />
        {esNatural && (
          <>
            {detalle.ingLaboral > 0 && <DataRow label="· Renta de trabajo" value={detalle.ingLaboral} />}
            {detalle.ingCapital > 0 && <DataRow label="· Rendimientos" value={detalle.ingCapital} />}
            {detalle.ingNoLaboral > 0 && <DataRow label="· Rentas no laborales" value={detalle.ingNoLaboral} />}
            {detalle.divAnual > 0 && <DataRow label="· Dividendos" value={detalle.divAnual} />}
          </>
        )}
        {detalle.noConst > 0 && <DataRow label="− Aportes obligatorios (INCRNGO)" value={-detalle.noConst} esPositivo />}
        {esNatural && detalle.neto != null && (
          <>
            {tipo === "optimizado" && detalle.benefOptimizado != null ? (
              <DataRow label="− Beneficios + PV/AFC sugeridos" value={-detalle.benefOptimizado} esPositivo />
            ) : detalle.benefActual != null ? (
              <DataRow label="− Beneficios aplicados" value={-detalle.benefActual} esPositivo />
            ) : null}
          </>
        )}
        {esNatural && (
          <DataRow
            label="Base gravable"
            value={tipo === "optimizado" ? (detalle.baseGravableOpt || 0) : (detalle.baseGravable || 0)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
export default function CalculadoraImpuestos({ user, trm, onNavigate, onUserUpdate }) {
  const owners = (user && user.owners) || [];
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.id || "");

  // Cálculo del motor — fuente única de verdad
  const estimacion = useMemo(() => estimarImpuesto(user), [user]);
  const warnings = useMemo(() => getFiscalWarnings(user), [user]);

  const selectedOwner = owners.find((o) => o.id === selectedOwnerId);
  const detalle = useMemo(() => {
    if (!estimacion?.detalle || !selectedOwner) return null;
    return estimacion.detalle.find((d) => d.name === selectedOwner.name) || null;
  }, [estimacion, selectedOwner]);

  // Enriquecer el detalle con números para las columnas
  const detalleEnriquecido = useMemo(() => {
    if (!detalle) return null;
    const d = { ...detalle };
    // Beneficios aplicados hoy (reales) y optimizados (sugeridos por el motor)
    const benefActual = Math.max(0, (d.neto || 0) - (d.rentaLiqTrabajo || 0));
    const rentaLiqOpt = (d.rentaLiqTrabajo || 0) - Math.max(0, (d.impBruto || 0) - (d.impOpt || 0)) / 0.35;
    d.benefActual = benefActual;
    // baseGravable = rentaLiqGeneral (lo que ya expone el motor)
    d.baseGravable = (d.rentaLiqTrabajo || 0) + (d.rentaLiqCapital || 0) + (d.rentaLiqNoLaboral || 0);
    // Para optimizado: si el motor calculó pensionVol/afc sugeridos, usamos esos
    d.benefOptimizado = benefActual + (d.pensionVolSug || 0) + (d.afcSug || 0);
    d.baseGravableOpt = Math.max(0, d.baseGravable - ((d.pensionVolSug || 0) + (d.afcSug || 0)));
    return d;
  }, [detalle]);

  const ahorro = detalleEnriquecido ? Math.max(0, (detalleEnriquecido.impBruto || detalleEnriquecido.impuesto || 0) - (detalleEnriquecido.impOpt || 0)) : 0;

  // Detección de data gaps — qué falta que podría mejorar el cálculo
  const dataGaps = useMemo(() => {
    if (!user || !selectedOwner) return [];
    const gaps = [];
    const ownerIng = (user.ingresos || []).filter((i) => i.owner === selectedOwnerId);
    const ownerGas = Object.values(user.gas || {}).flat().filter((g) => g.owner === selectedOwnerId);
    const ownerDeu = (user.deu || []).filter((d) => d.owner === selectedOwnerId);

    // Gap 1: tiene arriendo pero no hay gastos del inmueble registrados
    const tieneArriendo = ownerIng.some((i) => i.categoria === "Arriendo" && (i.mensual || 0) > 0);
    const gastosInmueble = ownerGas.filter((g) => ["Predial", "Mantenimiento", "Seguros", "Servicios"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0);
    if (tieneArriendo && gastosInmueble === 0) {
      gaps.push({
        titulo: "⚠️ No tenés gastos del inmueble arrendado",
        descripcion: "Registraste arriendos como ingreso, pero no veo predial, administración, mantenimiento ni seguros. Si pagás estos gastos, son deducibles del ingreso por arriendo (Art. 107 ET).",
        ctaLabel: "Ir a Egresos",
        page: "gas",
      });
    }

    // Gap 2: tiene salario pero no tiene aportes registrados (muy sospechoso)
    const tieneSalario = ownerIng.some((i) => i.categoria === "Salario" && (i.mensual || 0) > 0);
    const tieneAportes = ownerIng.some((i) => i.categoria === "Salario" && i.aportes && ((i.aportes.pension || 0) + (i.aportes.salud || 0)) > 0);
    if (tieneSalario && !tieneAportes) {
      gaps.push({
        titulo: "⚠️ Tu salario no tiene aportes obligatorios registrados",
        descripcion: "Todo empleado aporta 4% a pensión y 4% a salud. Sin registrarlos, el motor sobrestima tu impuesto.",
        ctaLabel: "Editar salario",
        page: "ing",
      });
    }

    // Gap 3: tiene deuda pero no está marcada como vivienda habitacional
    const tieneDeudaHipotecaria = ownerDeu.some((d) => (d.mt || 0) > 10_000_000 && (d.tipo === "Hipoteca" || (d.nombre || "").toLowerCase().includes("hipote") || (d.nombre || "").toLowerCase().includes("vivienda")));
    const marcadaComoVivienda = ownerDeu.some((d) => d.fiscalCode === "DEU_NAT_VIVIENDA_HABITACIONAL");
    if (tieneDeudaHipotecaria && !marcadaComoVivienda) {
      gaps.push({
        titulo: "⚠️ Tenés una deuda que parece hipoteca sin clasificar",
        descripcion: "Si es tu vivienda habitacional, los intereses son deducibles hasta 1.200 UVT/año. Marcala en el módulo Deudas.",
        ctaLabel: "Ir a Deudas",
        page: "deu",
      });
    }

    // Gap 4: tiene honorarios sin gastos de actividad
    const tieneHonorarios = ownerIng.some((i) => i.categoria === "Honorarios" && (i.mensual || 0) > 0);
    const gastosActividad = ownerGas.filter((g) => ["Oficina", "Servicios", "Tecnología", "Transporte"].includes(g.cat)).reduce((s, g) => s + (g.m || 0), 0);
    if (tieneHonorarios && gastosActividad === 0) {
      gaps.push({
        titulo: "⚠️ Honorarios sin gastos de actividad registrados",
        descripcion: "Como independiente, podés deducir los gastos de tu actividad (oficina, servicios, transporte, tecnología) con causalidad. Hoy no veo ninguno.",
        ctaLabel: "Ir a Egresos",
        page: "gas",
      });
    }

    return gaps;
  }, [user, selectedOwner, selectedOwnerId]);

  // Caso vacío
  if (owners.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 20, textAlign: "center", color: T.txt2 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
        <div style={{ fontSize: 16, color: T.txt, fontWeight: 700, marginBottom: 6 }}>Calculadora de impuestos</div>
        <div style={{ fontSize: 12 }}>Agregá primero al menos un propietario fiscal para usar la calculadora.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.txt }}>📊 Calculadora de impuestos</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 3, lineHeight: 1.5 }}>
            Compara tu impuesto actual (con los datos que ya cargaste) con el que podrías pagar optimizando legalmente.
          </div>
        </div>
        <select
          value={selectedOwnerId}
          onChange={(e) => setSelectedOwnerId(e.target.value)}
          style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "8px 12px", borderRadius: 8, fontSize: 13, outline: "none", cursor: "pointer", minWidth: 220 }}
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.type === "juridica" ? "Jurídica" : "Natural"})
            </option>
          ))}
        </select>
      </div>

      {/* Dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 18 }}>
        <ResultColumn
          titulo="📊 Situación actual"
          subtitle="Con los datos que ya tenés cargados en Ingresos, Egresos y Deudas."
          detalle={detalleEnriquecido}
          color={T.blue}
          accentColor={T.red}
          tipo="actual"
        />
        <ResultColumn
          titulo="✨ Con optimización"
          subtitle="Aplicando PV/AFC y beneficios disponibles hasta el tope del 40% legal."
          detalle={detalleEnriquecido}
          color={T.green}
          accentColor={T.green}
          tipo="optimizado"
        />
      </div>

      {/* Ahorro destacado */}
      {ahorro > 1_000_000 && (
        <div style={{ padding: "14px 18px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, marginBottom: 18, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Ahorro potencial anual</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.green, fontFamily: "monospace" }}>{fm(ahorro)}</div>
          <div style={{ fontSize: 11, color: T.txt2, marginTop: 6, lineHeight: 1.5 }}>
            Esto es lo que dejarías de pagar al aplicar las palancas fiscales que el motor detectó. En Fase 2 vas a poder activar más optimizaciones específicas de tu situación.
          </div>
        </div>
      )}

      {/* Data gaps — datos faltantes */}
      {dataGaps.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            📋 Datos que te faltan cargar ({dataGaps.length})
          </div>
          <div style={{ fontSize: 12, color: T.txt2, marginBottom: 10, lineHeight: 1.5 }}>
            La calculadora detectó información que podría mejorar tu estimación si la cargás en los módulos correspondientes:
          </div>
          {dataGaps.map((gap, i) => (
            <DataGapAlert
              key={i}
              titulo={gap.titulo}
              descripcion={gap.descripcion}
              ctaLabel={gap.ctaLabel}
              onClick={() => onNavigate?.(gap.page)}
            />
          ))}
        </div>
      )}

      {/* Fase 2: Ajustes fiscales personalizados (12 switches) */}
      <AjustesFiscalesPersonalizados
        owner={selectedOwner}
        onUpdate={(newProfile) => {
          if (!onUserUpdate || !selectedOwner) return;
          const newOwners = (user.owners || []).map((o) =>
            o.id === selectedOwner.id ? { ...o, fiscalProfile: newProfile } : o
          );
          onUserUpdate({ ...user, owners: newOwners });
        }}
      />

      {/* Nota del estado de fases */}
      <div style={{ padding: "12px 14px", background: T.bg3, border: "1px dashed " + T.border, borderRadius: 8, fontSize: 11, color: T.txt3, lineHeight: 1.6, marginTop: 14 }}>
        💡 <strong style={{ color: T.txt2 }}>Próximamente (Fase 3):</strong> el motor de cálculo va a leer los ajustes activos y reflejarlos en la columna "Con optimización" automáticamente. Hoy los datos se guardan pero el impuesto mostrado arriba aún no los aplica.
      </div>
    </div>
  );
}
