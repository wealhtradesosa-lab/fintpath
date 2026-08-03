// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD FISCAL — Plan Tributario → tab "Dashboard"
// ─────────────────────────────────────────────────────────────────────────
// Vista consolidada del estado fiscal por owner:
//   Bloque 0 — Selector de año (Commit 5.5): hasta 3 años guardados + actual
//   Bloque 1 — KPIs año declarado vs año simulado
//   Bloque 2 — Diff año-a-año
//   Bloque 3 — Alertas visibles con CTAs accionables
//   Bloque 4 — Recomendaciones con números concretos (Commit 6)
//   Bloque 5 — Timeline mini de patrimonio/impuesto (Commit 5.5)
//
// Commit 5.5: soporta array owner.declaraciones[] (hasta 3 años, FIFO).
// La declaración comparada por defecto es la más reciente; el selector
// permite cambiar a años anteriores guardados.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import Disclaimer from "./Disclaimer";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { detectarMismatchTodos } from "../lib/mismatchDetection.js";
import RecomendacionesFiscales from "./RecomendacionesFiscales";
import BannerMismatchDeclaracion from "./BannerMismatchDeclaracion";
import ReporteFiscalPrint from "./ReporteFiscalPrint";
import DeclaracionUpload from "./DeclaracionUpload";
import { SimToggleInfoCompact } from "./SimToggleInfo";
import PageHeader from "./PageHeader.jsx";

import { C } from "../lib/designTokens.js";

// Tokens unificados (Commit 9.9). Antes este archivo tenía colores
// LIGERAMENTE distintos al resto (txt: #e8eaed vs #fafafa, orange amber vs naranja).
// Esa diferencia sutil es lo que hacía sentir el sitio "amateur" — incoherente.
const T = {
  bg: C.bg, bg2: C.surface, bg3: C.raised,
  txt: C.text, txt2: C.muted, txt3: C.subtle,
  border: C.border,
  green: C.ok, red: C.danger, orange: C.warn, blue: C.accent, purple: C.purple,
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
const pc = (v) => (Number(v) || 0).toFixed(1) + "%";
const deltaPct = (nuevo, viejo) => {
  const n = Number(nuevo) || 0, v = Number(viejo) || 0;
  if (v === 0) return n > 0 ? "+∞" : "0%";
  return ((n - v) / Math.abs(v) * 100).toFixed(1) + "%";
};

// Mapea el code de la alerta a un CTA con label + página destino
const ALERT_CTA = {
  DESCUENTOS_AÑO_ANTERIOR_NO_CAPTURADOS: { label: "Ir al perfil del owner", page: "set" },
  APORTES_VOLUNTARIOS_NO_CAPTURADOS:      { label: "Registrar aporte en Egresos", page: "gas" },
  INGRESO_SIN_PROPIETARIO:                 { label: "Asignar propietario", page: "ing" },
  GASTO_JURIDICA_CAUSALIDAD_AMBIGUA:        { label: "Revisar gasto", page: "gas" },
  HONORARIOS_SIN_REGIMEN_DECLARADO:         { label: "Definir régimen del owner", page: "set" },
  ARRIENDO_INFERIDO_INMUEBLE:               { label: "Confirmar tipo en Ingresos", page: "ing" },
  DIVIDENDOS_INFERIDOS_GRAVADOS:            { label: "Confirmar tipo en Ingresos", page: "ing" },
};

function KPICard({ label, actual, declarado, fmt = fm, accent = T.blue }) {
  const hasDecl = declarado != null && declarado !== "";
  const dPct = hasDecl ? deltaPct(actual, declarado) : null;
  const delta = hasDecl ? (Number(actual) || 0) - (Number(declarado) || 0) : 0;
  const color = !hasDecl ? T.txt2 : delta > 0 ? T.green : delta < 0 ? T.red : T.txt2;
  return (
    <div style={{ background: T.bg2, border: "1px solid " + T.border, borderLeft: "3px solid " + accent, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, fontFamily: "monospace" }}>{fmt(actual)}</div>
      {hasDecl ? (
        <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, lineHeight: 1.5 }}>
          Año anterior declarado: <span style={{ color: T.txt2, fontFamily: "monospace" }}>{fmt(declarado)}</span>
          <div style={{ color, fontWeight: 700, marginTop: 2 }}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {dPct}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, fontStyle: "italic" }}>
          Sin declaración previa para comparar
        </div>
      )}
    </div>
  );
}

function DiffRow({ label, actual, declarado, fmt = fm }) {
  if (declarado == null) return null;
  const a = Number(actual) || 0, d = Number(declarado) || 0;
  const diff = a - d;
  const color = diff > 0 ? T.green : diff < 0 ? T.red : T.txt2;
  return (
    <tr style={{ borderBottom: "1px solid " + T.border }}>
      <td style={{ padding: "8px 10px", fontSize: 12, color: T.txt2 }}>{label}</td>
      <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace", color: T.txt2, textAlign: "right" }}>{fmt(d)}</td>
      <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace", color: T.txt, textAlign: "right", fontWeight: 600 }}>{fmt(a)}</td>
      <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace", color, textAlign: "right", fontWeight: 700 }}>
        {diff >= 0 ? "+" : ""}{fmt(diff)}
      </td>
      <td style={{ padding: "8px 10px", fontSize: 11, color, textAlign: "right", fontWeight: 700 }}>{deltaPct(a, d)}</td>
    </tr>
  );
}

export default function DashboardFiscal({ u, owners, estimacion, warnings, onNavigate, onSaveDeclaracion, isPro, onUpsell, onGoToUpload, onMarkReviewed, onUnmarkReviewed, user}) {
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.id || "");
  // Commit 5.5: año seleccionado dentro del owner (null = la más reciente)
  const [selectedAno, setSelectedAno] = useState(null);
  // Commit 7: modo imprimible
  const [printMode, setPrintMode] = useState(false);
  // Commit 8.3: upload colapsable dentro del dashboard
  const [showUpload, setShowUpload] = useState(false);

  const selectedOwner = useMemo(() => owners.find((o) => o.id === selectedOwnerId), [owners, selectedOwnerId]);

  // Commit 5.5: declaraciones[] ordenadas descendente por año (fallback legacy)
  const declaraciones = useMemo(() => {
    if (!selectedOwner) return [];
    if (Array.isArray(selectedOwner.declaraciones) && selectedOwner.declaraciones.length > 0) {
      return [...selectedOwner.declaraciones].sort((a, b) => (Number(b?.anoGravable) || 0) - (Number(a?.anoGravable) || 0));
    }
    if (selectedOwner.declaracionAnterior) return [selectedOwner.declaracionAnterior];
    return [];
  }, [selectedOwner]);

  // Declaración "activa" para comparar: la del año seleccionado, o la más reciente por default
  const declarada = useMemo(() => {
    if (declaraciones.length === 0) return null;
    if (selectedAno != null) {
      const match = declaraciones.find((d) => Number(d?.anoGravable) === Number(selectedAno));
      if (match) return match;
    }
    return declaraciones[0];
  }, [declaraciones, selectedAno]);
  const tieneDeclaracion = !!declarada?.renglones;

  // Encontrar el detalle de este owner en la estimación actual (motor)
  const detalleActual = useMemo(() => {
    if (!estimacion?.detalle || !selectedOwner) return null;
    return estimacion.detalle.find((d) => d.name === selectedOwner.name) || null;
  }, [estimacion, selectedOwner]);

  // Mejora B: detector de mismatch declaración vs cálculo motor
  // Aplica a TODOS los owners del user, no solo el seleccionado, porque
  // queremos que el banner alerte si HAY discrepancias en cualquier owner.
  const mismatchResults = useMemo(() => {
    if (!u || !estimacion) return [];
    return detectarMismatchTodos(u, estimacion);
  }, [u, estimacion]);

  // Filtrar alertas relacionadas con este owner (o sin owner específico)
  const alertasDelOwner = useMemo(() => {
    if (!warnings) return [];
    return warnings.filter((w) => !w.itemId || w.itemId === selectedOwnerId);
  }, [warnings, selectedOwnerId]);

  // Commit 6: recomendaciones con números concretos
  const todasLasRecomendaciones = useMemo(() => {
    if (!u || !estimacion) return [];
    return generarRecomendaciones(u, estimacion);
  }, [u, estimacion]);

  // Derivar KPIs actuales desde el motor
  const patrimonioLiquidoActual = useMemo(() => {
    if (!u) return 0;
    const invOwner = (u.inv || []).filter((i) => i.owner === selectedOwnerId);
    const deuOwner = (u.deu || []).filter((d) => d.owner === selectedOwnerId);
    const activos = invOwner.reduce((s, i) => s + (Number(i.va) || 0), 0);
    const pasivos = deuOwner.reduce((s, d) => s + (Number(d.rem) || 0), 0);
    return activos - pasivos;
  }, [u, selectedOwnerId]);

  const impuestoActual = detalleActual?.impBruto || detalleActual?.impuesto || 0;
  const ingresoAnualActual = detalleActual?.ingreso || 0;
  const tasaEfectivaActual = ingresoAnualActual > 0 ? (impuestoActual / ingresoAnualActual) * 100 : 0;
  const saldoActual = detalleActual?.impuesto || 0; // post-retención

  // Valores del año declarado
  const r = declarada?.renglones || {};
  const esF110 = declarada?.tipo === "F110";
  const patrimonioLiquidoDeclarado = tieneDeclaracion ? (Number(r.patrimonioLiquido) || 0) : null;
  const impuestoDeclarado = tieneDeclaracion
    ? (esF110 ? (Number(r.impuestoNeto) || Number(r.impuestoCalculado) || 0) : (Number(r.impuestoCalculado) || 0))
    : null;
  const ingresoDeclarado = tieneDeclaracion ? (Number(r.ingresosBrutos) || 0) : null;
  const tasaEfectivaDeclarada = tieneDeclaracion && ingresoDeclarado > 0 ? (impuestoDeclarado / ingresoDeclarado) * 100 : null;
  const saldoDeclarado = tieneDeclaracion ? (Number(r.saldoPagar) || 0) : null;

  if (owners.length === 0) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🏛️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.txt, marginBottom: 6 }}>Sin propietarios fiscales</div>
        <div style={{ fontSize: 13, color: T.txt2, marginBottom: 16, lineHeight: 1.6 }}>
          Agregá al menos un propietario fiscal (persona natural o jurídica) para ver el dashboard.
        </div>
        <button onClick={() => onNavigate?.("set")} style={{ padding: "10px 20px", background: T.blue, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Ir a Configuración →
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 940, margin: "0 auto", padding: "16px" }}>
      {/* Commit 7: modo imprimible en overlay fullscreen */}
      {printMode && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "white", zIndex: 9999, overflow: "auto" }}>
          <ReporteFiscalPrint
            owner={selectedOwner}
            declaraciones={declaraciones}
            estimacionDetalle={detalleActual}
            patrimonioLiquidoActual={patrimonioLiquidoActual}
            alertas={alertasDelOwner}
            recomendaciones={todasLasRecomendaciones.filter(r => r.ownerId === selectedOwnerId)}
            onClose={() => setPrintMode(false)}
          />
        </div>
      )}

      {/* Header con PageHeader (Sesión 2-may-2026: estilo Optimus unificado) */}
      <PageHeader
        label="Declaraciones"
        title="Histórico fiscal"
        subtitle="Lo declarado vs tu situación actual, con alertas accionables."
      />
      {/* Selector de owner: al lado del header pero como toolbar separada */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
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
        {/* Commit 8.3: toggle de upload */}
        <button
          onClick={() => setShowUpload((s) => !s)}
          title="Subir o cargar una declaración"
          style={{ background: showUpload ? T.orange : T.green, border: "none", color: showUpload ? "#000" : "#000", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {showUpload ? "✕ Cerrar upload" : "📤 Subir declaración"}
        </button>
        {/* Commit 7: export PDF */}
        <button
          onClick={() => setPrintMode(true)}
          title="Exportar reporte como PDF"
          style={{ background: T.blue, border: "none", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          📄 Exportar PDF
        </button>
      </div>

      {/* Mejora B (28-abr-2026): banner de mismatch declaración vs datos cargados.
          Aparece si el detector encontró diferencias significativas. NO acusa,
          solo alerta y empuja al usuario a verificar con su contador. */}
      <BannerMismatchDeclaracion
        results={mismatchResults}
        onMarkReviewed={onMarkReviewed}
        onUnmark={onUnmarkReviewed}
      />

      {/* Commit 8.3: upload inline cuando toggle está abierto */}
      {showUpload && onSaveDeclaracion && (
        <div style={{ background: T.bg2, border: "2px solid " + T.green, borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.txt }}>📤 Subir declaración (PDF)</div>
            <button onClick={() => setShowUpload(false)} style={{ background: "transparent", border: "1px solid " + T.border, color: T.txt3, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Cerrar</button>
          </div>
          <DeclaracionUpload
            user={user}
            owners={owners}
            isPro={isPro}
            onUpsell={onUpsell}
            onSaveToOwner={(ownerId, declaracion) => {
              onSaveDeclaracion(ownerId, declaracion);
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* Aviso: items apagados en Ingresos/Egresos/Deudas/Inversiones no entran en este cálculo */}
      <SimToggleInfoCompact />

      {/* Banner de estado de declaración */}
      {tieneDeclaracion ? (
        <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, marginBottom: 14, fontSize: 12, color: T.txt2, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            ✅ Declaración {declarada.tipo} del año <strong style={{ color: T.green }}>{declarada.anoGravable}</strong> cargada.
            {declarada.capturadoEl && <span style={{ color: T.txt3 }}> · Capturada el {new Date(declarada.capturadoEl).toLocaleDateString("es-CO")}</span>}
          </div>
          {/* Commit 5.5: selector de año si hay más de uno */}
          {declaraciones.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5 }}>Comparar vs</span>
              <select
                value={selectedAno ?? declaraciones[0]?.anoGravable ?? ""}
                onChange={(e) => setSelectedAno(Number(e.target.value))}
                style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt, padding: "4px 8px", borderRadius: 6, fontSize: 12, outline: "none", cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}
              >
                {declaraciones.map((d) => (
                  <option key={d.anoGravable} value={d.anoGravable}>{d.anoGravable}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "14px 16px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 6 }}>📋 Sin declaración cargada</div>
          <div style={{ fontSize: 11, color: T.txt2, lineHeight: 1.5, marginBottom: 10 }}>
            Subí la declaración {selectedOwner?.type === "juridica" ? "F-110" : "F-210"} de {selectedOwner?.name} para ver comparaciones año-a-año y detectar deducciones perdidas automáticamente.
          </div>
          <button onClick={() => { if (onGoToUpload) { onGoToUpload(); } else { setShowUpload(true); } }} style={{ padding: "8px 14px", background: T.blue, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Subir declaración →
          </button>
        </div>
      )}

      {/* Bloque 1: KPIs */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Indicadores clave
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <KPICard label="Patrimonio líquido" actual={patrimonioLiquidoActual} declarado={patrimonioLiquidoDeclarado} accent={T.purple} />
          <KPICard label="Impuesto calculado" actual={impuestoActual} declarado={impuestoDeclarado} accent={T.red} />
          <KPICard label="Tasa efectiva" actual={tasaEfectivaActual} declarado={tasaEfectivaDeclarada} fmt={pc} accent={T.orange} />
          <KPICard label="Saldo a pagar" actual={saldoActual} declarado={saldoDeclarado} accent={T.blue} />
        </div>
      </div>

      {/* Sesión 28-abr-2026: Desglose de retenciones aplicadas (solo si hay).
          Muestra al user CÓMO se está llegando al saldo a pagar = impuesto - retención.
          Reduce confusión cuando el user ve "$190M impuesto" pero el saldo final es menor. */}
      {detalleActual?.retencionDesglose && detalleActual.retencionDesglose.total > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            🏦 Retención en la fuente estimada
            {detalleActual.retencionDesglose.fuente === "override_global" && (
              <span style={{ marginLeft: 8, padding: "2px 8px", background: "rgba(168,85,247,0.15)", borderRadius: 4, fontSize: 9, color: "#a78bfa" }}>
                OVERRIDE MANUAL
              </span>
            )}
          </div>
          <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid " + T.border }}>
              <div>
                <div style={{ fontSize: 13, color: T.txt2, marginBottom: 2 }}>Impuesto bruto</div>
                <div style={{ fontSize: 11, color: T.txt3 }}>(antes de retenciones aplicadas)</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.red }}>
                ${Math.round((detalleActual?.impBruto || 0) - (detalleActual?.descuentoICA || 0) - (detalleActual?.descuentosAplicados || 0)).toLocaleString("es-CO")}
              </div>
            </div>
            {detalleActual.retencionDesglose.detallePorIngreso.filter(d => d.anual > 0).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: T.txt2 }}>{d.nombre}</span>
                  <span style={{ marginLeft: 8, color: T.txt3, fontSize: 11 }}>· {(d.tasa * 100).toFixed(1)}%</span>
                </div>
                <div style={{ color: T.green, fontWeight: 600 }}>-${Math.round(d.anual).toLocaleString("es-CO")}</div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 8, borderTop: "1px solid " + T.border, fontSize: 13 }}>
              <div style={{ color: T.txt, fontWeight: 700 }}>Total retención estimada</div>
              <div style={{ color: T.green, fontWeight: 700 }}>-${Math.round(detalleActual.retencionDesglose.total).toLocaleString("es-CO")}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, paddingTop: 10, borderTop: "2px solid " + T.border }}>
              <div>
                <div style={{ fontSize: 13, color: T.txt, fontWeight: 700, marginBottom: 2 }}>Saldo a pagar (mayo)</div>
                <div style={{ fontSize: 11, color: T.txt3 }}>= Impuesto bruto − retenciones</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>
                ${Math.round(saldoActual).toLocaleString("es-CO")}
              </div>
            </div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 12, fontStyle: "italic", lineHeight: 1.4 }}>
              ℹ️ Las retenciones son lo que el banco/inquilino te descuentan automáticamente durante el año.
              Cuando declarás en mayo, ese monto ya fue pagado. El "saldo a pagar" es lo que efectivamente
              transferís en mayo después del cálculo final. Podés ajustar tasas o desactivar retención por
              ingreso desde el módulo Ingresos.
            </div>
          </div>
        </div>
      )}

      {/* Bloque 2: Diff año-a-año */}
      {tieneDeclaracion && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Diferencias año {declarada.anoGravable} vs actual
          </div>
          <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg3 }}>
                  <th style={{ padding: "10px", fontSize: 10, fontWeight: 700, color: T.txt3, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5 }}>Concepto</th>
                  <th style={{ padding: "10px", fontSize: 10, fontWeight: 700, color: T.txt3, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>{declarada.anoGravable}</th>
                  <th style={{ padding: "10px", fontSize: 10, fontWeight: 700, color: T.txt3, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Actual</th>
                  <th style={{ padding: "10px", fontSize: 10, fontWeight: 700, color: T.txt3, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Δ</th>
                  <th style={{ padding: "10px", fontSize: 10, fontWeight: 700, color: T.txt3, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>%</th>
                </tr>
              </thead>
              <tbody>
                <DiffRow label="Ingresos brutos" actual={ingresoAnualActual} declarado={ingresoDeclarado} />
                <DiffRow label="Patrimonio bruto" actual={patrimonioLiquidoActual + (u?.deu || []).filter((d) => d.owner === selectedOwnerId).reduce((s, d) => s + (Number(d.rem) || 0), 0)} declarado={Number(r.patrimonioBruto) || 0} />
                <DiffRow label="Patrimonio líquido" actual={patrimonioLiquidoActual} declarado={patrimonioLiquidoDeclarado} />
                <DiffRow label="Impuesto" actual={impuestoActual} declarado={impuestoDeclarado} />
                {esF110 && (<>
                  <DiffRow label="Descuento ICA (50%)" actual={0} declarado={Number(r.descICA) || 0} />
                  <DiffRow label="Descuento donaciones" actual={0} declarado={Number(r.descDonaciones) || 0} />
                  <DiffRow label="Descuento CTI" actual={0} declarado={Number(r.descCTI) || 0} />
                </>)}
                {!esF110 && (<>
                  <DiffRow label="Deducción medicina" actual={0} declarado={Number(r.deducMedicina) || 0} />
                  <DiffRow label="PV + AFC" actual={0} declarado={Number(r.pvAFC) || 0} />
                  <DiffRow label="Retención en la fuente" actual={detalleActual?.retefuenteNat || 0} declarado={Number(r.retefuente) || 0} />
                </>)}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, fontStyle: "italic" }}>
            Nota: los valores "Actual" vienen del motor de FINPATHIA aplicado a tu situación de este año. No siempre son comparables directamente con los renglones oficiales (el motor aproxima; la declaración oficial puede tener ajustes contables puntuales).
          </div>
        </div>
      )}

      {/* Bloque 3: Alertas visibles */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Alertas fiscales {alertasDelOwner.length > 0 && <span style={{ color: T.orange }}>({alertasDelOwner.length})</span>}
        </div>
        {alertasDelOwner.length === 0 ? (
          <div style={{ padding: "20px", background: "rgba(34,197,94,0.04)", border: "1px dashed rgba(34,197,94,0.2)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 12, color: T.txt2 }}>Sin alertas para {selectedOwner?.name}.</div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 4 }}>
              El motor no detectó desajustes entre tu situación actual y la declaración anterior.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alertasDelOwner.map((w, i) => {
              const cta = ALERT_CTA[w.code];
              const severity = w.severity || "warning";
              const color = severity === "error" ? T.red : severity === "info" ? T.blue : T.orange;
              const bg = severity === "error" ? "rgba(239,68,68,0.06)" : severity === "info" ? "rgba(59,130,246,0.06)" : "rgba(245,158,11,0.06)";
              const icon = severity === "error" ? "❌" : severity === "info" ? "ℹ️" : "⚠️";
              return (
                <div key={i} style={{ padding: "12px 14px", background: bg, border: "1px solid " + color + "33", borderLeft: "3px solid " + color, borderRadius: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 14, lineHeight: 1.4 }}>{icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.txt, fontWeight: 600, lineHeight: 1.4 }}>{w.message}</div>
                      {w.accionSugerida && (
                        <div style={{ fontSize: 11, color: T.txt2, marginTop: 4, lineHeight: 1.5 }}>{w.accionSugerida}</div>
                      )}
                      {cta && (
                        <button onClick={() => onNavigate?.(cta.page)} style={{ marginTop: 8, padding: "5px 10px", background: "transparent", border: "1px solid " + color, borderRadius: 6, color, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          {cta.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bloque 5 (Commit 5.5): Timeline mini de patrimonio/impuesto */}
      {declaraciones.length >= 2 && (() => {
        const puntos = declaraciones
          .slice()
          .sort((a, b) => (Number(a?.anoGravable) || 0) - (Number(b?.anoGravable) || 0))
          .map((d) => {
            const rr = d?.renglones || {};
            const esF110 = d?.tipo === "F110";
            return {
              ano: d.anoGravable,
              patrimonio: Number(rr.patrimonioLiquido) || 0,
              impuesto: esF110 ? (Number(rr.impuestoNeto) || Number(rr.impuestoCalculado) || 0) : (Number(rr.impuestoCalculado) || 0),
              tipo: d.tipo,
            };
          });
        // Agregar punto "Actual" (simulación del motor) al final
        puntos.push({
          ano: "Actual",
          patrimonio: patrimonioLiquidoActual,
          impuesto: impuestoActual,
          tipo: "sim",
        });
        // maxPat/maxImp ya no se usan: el diseño de pasos no escala por máximo.

        return (
          <div style={{ marginBottom: 18 }}>
            {/* 26-jul-2026 (Santiago: "esto se ve muy mal"). Antes eran barras
                con altura = valor/máximo × 60px. Con un patrimonio actual de
                $21.138M contra $100.000 y $0 de los años declarados, las dos
                primeras barras caían al mínimo de 4px: dos rayitas y un bloque.
                Ninguna barra puede representar cinco órdenes de magnitud.
                Ahora se muestran como pasos con la cifra grande y la variación
                entre años, que es lo que de verdad se quiere leer. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Tu evolución
            </div>
            <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 12, padding: "16px 18px" }}>
              {[
                { titulo: "Patrimonio líquido", campo: "patrimonio", color: T.purple },
                { titulo: "Impuesto", campo: "impuesto", color: T.red },
              ].map((fila, fi) => (
                <div key={fila.campo} style={{ marginBottom: fi === 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 10, color: T.txt3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {fila.titulo}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${puntos.length}, 1fr)`, gap: 10 }}>
                    {puntos.map((p, i) => {
                      const esSim = p.tipo === "sim";
                      const valor = p[fila.campo];
                      const previo = i > 0 ? puntos[i - 1][fila.campo] : null;
                      // Variación solo si hay base contra la cual comparar. Un
                      // salto desde cero no es "infinito por ciento": es
                      // simplemente algo que antes no existía.
                      const delta = previo !== null && previo > 0 ? ((valor - previo) / previo) * 100 : null;
                      return (
                        <div key={i} style={{
                          background: esSim ? T.blue + "14" : "transparent",
                          border: "1px solid " + (esSim ? T.blue + "44" : T.border),
                          borderRadius: 10, padding: "10px 12px",
                        }}>
                          <div style={{ fontSize: 10, color: esSim ? T.blue : T.txt3, fontWeight: 700, fontFamily: "monospace", marginBottom: 4 }}>
                            {p.ano}{esSim ? " · simulado" : ""}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: esSim ? T.blue : fila.color, fontFamily: "monospace", lineHeight: 1.2, wordBreak: "break-all" }}>
                            {fm(valor)}
                          </div>
                          {delta !== null && (
                            <div style={{ fontSize: 10, color: T.txt3, marginTop: 3 }}>
                              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta) >= 1000 ? "×" + Math.round(valor / previo) : Math.abs(delta).toFixed(0) + "%"} vs {puntos[i - 1].ano}
                            </div>
                          )}
                          {previo === 0 && valor > 0 && (
                            <div style={{ fontSize: 10, color: T.txt3, marginTop: 3 }}>sin base previa</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9.5, color: T.txt3, marginTop: 12, fontStyle: "italic", textAlign: "center" }}>
                Últimas {declaraciones.length} declaraciones + simulación del año en curso (en azul).
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bloque 4 (Commit 6): Recomendaciones con números concretos */}
      <RecomendacionesFiscales
        recomendaciones={todasLasRecomendaciones}
        ownerId={selectedOwnerId}
        onNavigate={onNavigate}
      />
    
    <Disclaimer variante="fiscal" idioma="es" T={T} />
  </div>
  );
}
