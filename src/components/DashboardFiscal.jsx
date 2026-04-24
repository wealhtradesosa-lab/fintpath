// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD FISCAL — Plan Tributario → tab "Dashboard"
// ─────────────────────────────────────────────────────────────────────────
// Vista consolidada del estado fiscal por owner:
//   Bloque 1 — KPIs año declarado vs año simulado (patrimonio, impuesto,
//              tasa efectiva, saldo)
//   Bloque 2 — Diff año-a-año con Δ absoluto y porcentual
//   Bloque 3 — Alertas visibles con CTAs accionables
//
// Scope Commit 5 (5b): soporta UNA declaración por owner (shape actual
// `owner.declaracionAnterior`). Timeline multi-año queda para 5.5 cuando
// refactoreemos a `owner.declaraciones: []`.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";

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

  const selectedOwner = useMemo(() => owners.find((o) => o.id === selectedOwnerId), [owners, selectedOwnerId]);
  const declarada = selectedOwner?.declaracionAnterior;
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
      </div>

      {/* Banner de estado de declaración */}
      {tieneDeclaracion ? (
        <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, marginBottom: 14, fontSize: 12, color: T.txt2 }}>
          ✅ Declaración {declarada.tipo} del año <strong style={{ color: T.green }}>{declarada.anoGravable}</strong> cargada.
          {declarada.capturadoEl && <span style={{ color: T.txt3 }}> · Capturada el {new Date(declarada.capturadoEl).toLocaleDateString("es-CO")}</span>}
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
    </div>
  );
}
