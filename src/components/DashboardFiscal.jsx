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
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import RecomendacionesFiscales from "./RecomendacionesFiscales";
import ReporteFiscalPrint from "./ReporteFiscalPrint";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  green: "#22c55e", red: "#ef4444", orange: "#f59e0b", blue: "#3b82f6", purple: "#a78bfa",
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

export default function DashboardFiscal({ u, owners, estimacion, warnings, onNavigate, onGoToUpload }) {
  const [selectedOwnerId, setSelectedOwnerId] = useState(owners[0]?.id || "");
  // Commit 5.5: año seleccionado dentro del owner (null = la más reciente)
  const [selectedAno, setSelectedAno] = useState(null);
  // Commit 7: modo imprimible
  const [printMode, setPrintMode] = useState(false);

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

      {/* Header + selector de owner */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.txt }}>🏛️ Dashboard Fiscal</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
            Comparación año actual (simulado) vs año declarado, y alertas accionables.
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
        {/* Commit 7: export PDF */}
        <button
          onClick={() => setPrintMode(true)}
          title="Exportar reporte como PDF"
          style={{ background: T.blue, border: "none", color: "white", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          📄 Exportar PDF
        </button>
      </div>

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
          <button onClick={onGoToUpload} style={{ padding: "8px 14px", background: T.blue, border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
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
        const maxPat = Math.max(...puntos.map((p) => p.patrimonio), 1);
        const maxImp = Math.max(...puntos.map((p) => p.impuesto), 1);
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Timeline — {puntos.length} puntos
            </div>
            <div style={{ background: T.bg2, border: "1px solid " + T.border, borderRadius: 10, padding: "16px 18px" }}>
              {/* Patrimonio */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: T.txt3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Patrimonio líquido
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${puntos.length}, 1fr)`, gap: 8, alignItems: "flex-end", minHeight: 80 }}>
                  {puntos.map((p, i) => {
                    const h = (p.patrimonio / maxPat) * 60;
                    const esSim = p.tipo === "sim";
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, color: esSim ? T.blue : T.txt2, fontFamily: "monospace", fontWeight: 600 }}>
                          {fm(p.patrimonio).replace("$", "$").replace(/(\d{3})(?=\d{3}(?:\d{3})?$)/g, "$1")}
                        </div>
                        <div style={{ width: "100%", maxWidth: 40, height: Math.max(h, 4), background: esSim ? T.blue : T.purple, borderRadius: 4, opacity: esSim ? 0.7 : 1 }} />
                        <div style={{ fontSize: 10, color: esSim ? T.blue : T.txt3, fontWeight: 600, fontFamily: "monospace" }}>
                          {p.ano}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Impuesto */}
              <div>
                <div style={{ fontSize: 10, color: T.txt3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Impuesto
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${puntos.length}, 1fr)`, gap: 8, alignItems: "flex-end", minHeight: 80 }}>
                  {puntos.map((p, i) => {
                    const h = (p.impuesto / maxImp) * 60;
                    const esSim = p.tipo === "sim";
                    return (
                      <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, color: esSim ? T.blue : T.txt2, fontFamily: "monospace", fontWeight: 600 }}>
                          {fm(p.impuesto)}
                        </div>
                        <div style={{ width: "100%", maxWidth: 40, height: Math.max(h, 4), background: esSim ? T.blue : T.red, borderRadius: 4, opacity: esSim ? 0.7 : 1 }} />
                        <div style={{ fontSize: 10, color: esSim ? T.blue : T.txt3, fontWeight: 600, fontFamily: "monospace" }}>
                          {p.ano}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ fontSize: 9, color: T.txt3, marginTop: 12, fontStyle: "italic", textAlign: "center" }}>
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
    </div>
  );
}
