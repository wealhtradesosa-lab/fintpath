// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · VistaFamiliarConsolidada.jsx
//
// PROPÓSITO:
//   Pantalla "Vista Familiar Consolidada" que suma TODOS los owners de la
//   cuenta (personas naturales + jurídicas) y presenta:
//
//   1. KPIs CONSOLIDADOS de la familia/grupo:
//      - Ingreso total anual (suma de todos los owners)
//      - Patrimonio bruto consolidado
//      - Impuestos totales del grupo
//      - Tasa efectiva consolidada
//      - Ahorro potencial total detectado por el motor
//
//   2. TARJETA POR OWNER con su contribución al consolidado:
//      - Ingreso, impuesto, % del total
//      - Estado de auditoría (errores, oportunidades)
//      - CTA para entrar al detalle de ese owner
//
//   3. DISTRIBUCIÓN VISUAL del peso de cada owner en el grupo
//
// FILOSOFÍA:
//   Es la vista que justifica el plan "Pro Familiar". Cualquier app puede
//   calcular impuestos para 1 persona. Solo FINPATHIA presenta la
//   estructura familiar completa con auditoría individual + visión de grupo.
//
//   El user puede ENTRAR a cualquier owner desde acá → onSelectOwner(id)
//   lo lleva al Auditor IA con ese owner seleccionado.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { generarRecomendaciones } from "../lib/recomendaciones.js";
import { auditarDatos } from "../lib/auditoriaDatos.js";

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
  orange: "#fb923c",
  orangeBg: "rgba(251,146,60,0.10)",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.10)",
  purple: "#c4b5fd",
  purpleBg: "rgba(196,181,253,0.10)",
};

const fm = (v) => "$" + Math.round(Number(v) || 0).toLocaleString("es-CO");
const fmShort = (v) => {
  const n = Math.abs(Number(v) || 0);
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + Math.round(n);
};

/**
 * Vista Familiar Consolidada.
 *
 * @param {object} user - User completo con todos los owners
 * @param {object} estimacion - Output de estimarImpuesto(user)
 * @param {function} onSelectOwner - Callback (ownerId) => void cuando user
 *   clickea una tarjeta de owner para ir a su Auditor IA
 * @param {number} ano - Año gravable (default 2025)
 */
export default function VistaFamiliarConsolidada({ user, estimacion, onSelectOwner, ano = 2025 }) {
  const owners = user?.owners || [];

  // ── Calcular métricas por owner ─────────────────────────────────────────
  const ownersData = useMemo(() => {
    if (!user || owners.length === 0) return [];

    return owners.map(o => {
      // Detalle del motor
      const det = estimacion?.detalle?.find(d => d.name === o.name);

      // Patrimonio del owner (suma de inversiones - deudas, sin items excluidos)
      const inversiones = (user.inv || []).filter(i =>
        i.owner === o.id && i.sim !== false && !i.excluirDeclaracion
      );
      const totalActivos = inversiones.reduce((s, i) => {
        const v = Number(i.valor || i.va || i.ubi || i.vc || 0);
        return s + v * (i.moneda === "USD" ? (user.trm || 4200) : 1);
      }, 0);

      const deudas = (user.deu || []).filter(d =>
        d.owner === o.id && d.sim !== false && !d.excluirDeclaracion
      );
      const totalPasivos = deudas.reduce((s, d) =>
        s + Number(d.mt || d.saldo || 0) * (d.moneda === "USD" ? (user.trm || 4200) : 1)
      , 0);

      // Recomendaciones (oportunidades) del owner
      const recsOwner = generarRecomendaciones(user, estimacion).filter(r =>
        r.ownerId === o.id || r.ownerName === o.name
      );
      const ahorroPotencial = recsOwner.reduce((s, r) => s + (r.ahorroAnualEstimado || 0), 0);

      // Auditoría: cuántos hallazgos tiene este owner
      const audit = auditarDatos(user);
      const erroresOwner = (audit.errores || []).filter(h => detectaOwnerEnHallazgo(h, o.id, o.name)).length;
      const advertenciasOwner = (audit.advertencias || []).filter(h => detectaOwnerEnHallazgo(h, o.id, o.name)).length;

      return {
        owner: o,
        ingreso: det?.ingreso || 0,
        impuesto: det?.impuesto || 0,
        impBruto: det?.impBruto || 0,
        retencion: o.type === "juridica"
          ? (det?.retefuenteCalc || det?.retencionDesglose?.total || 0)
          : (det?.retefuenteNat || 0),
        patrimonioBruto: totalActivos,
        patrimonioLiquido: totalActivos - totalPasivos,
        pasivos: totalPasivos,
        ahorroPotencial,
        cantidadOportunidades: recsOwner.filter(r => (r.ahorroAnualEstimado || 0) > 0).length,
        erroresAuditoria: erroresOwner,
        advertenciasAuditoria: advertenciasOwner,
        tasaEfectiva: det?.ingreso > 0 ? ((det?.impuesto || 0) / det.ingreso * 100) : 0,
      };
    });
  }, [user, estimacion, owners]);

  // ── KPIs consolidados ──────────────────────────────────────────────────
  const consolidado = useMemo(() => {
    const acc = ownersData.reduce((acc, d) => ({
      ingresoTotal: acc.ingresoTotal + d.ingreso,
      impuestoTotal: acc.impuestoTotal + d.impuesto,
      impBrutoTotal: acc.impBrutoTotal + d.impBruto,
      retencionTotal: acc.retencionTotal + d.retencion,
      patrimonioBrutoTotal: acc.patrimonioBrutoTotal + d.patrimonioBruto,
      patrimonioLiquidoTotal: acc.patrimonioLiquidoTotal + d.patrimonioLiquido,
      pasivosTotal: acc.pasivosTotal + d.pasivos,
      ahorroPotencialTotal: acc.ahorroPotencialTotal + d.ahorroPotencial,
      erroresTotal: acc.erroresTotal + d.erroresAuditoria,
      advertenciasTotal: acc.advertenciasTotal + d.advertenciasAuditoria,
    }), {
      ingresoTotal: 0, impuestoTotal: 0, impBrutoTotal: 0, retencionTotal: 0,
      patrimonioBrutoTotal: 0, patrimonioLiquidoTotal: 0, pasivosTotal: 0,
      ahorroPotencialTotal: 0, erroresTotal: 0, advertenciasTotal: 0,
    });
    acc.tasaEfectivaConsolidada = acc.ingresoTotal > 0
      ? (acc.impuestoTotal / acc.ingresoTotal * 100)
      : 0;
    acc.naturales = ownersData.filter(d => d.owner.type === "natural").length;
    acc.juridicas = ownersData.filter(d => d.owner.type === "juridica").length;
    return acc;
  }, [ownersData]);

  // ── Sin owners: mensaje de vacío ────────────────────────────────────────
  if (owners.length === 0) {
    return (
      <div style={{ padding: "32px 28px", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👧‍👦</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: C.txt, marginBottom: 12 }}>
          Vista Familiar Consolidada
        </h3>
        <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
          No tenés personas fiscales cargadas todavía. Empezá agregando una persona natural
          o jurídica desde el wizard del Auditor IA.
        </p>
      </div>
    );
  }

  // ── Sin un solo owner: sugerir agregar más para usar la vista ───────────
  if (owners.length === 1) {
    const único = ownersData[0];
    return (
      <div style={{ padding: "20px 0" }}>
        <HeaderConsolidado totalOwners={1} naturales={consolidado.naturales} juridicas={consolidado.juridicas} ano={ano} />
        <div style={{
          marginTop: 16,
          padding: "20px 24px",
          background: C.purpleBg,
          border: `1px solid ${C.purple}40`,
          borderLeft: `4px solid ${C.purple}`,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
            💡 Pro Familiar te permite mucho más
          </div>
          <p style={{ fontSize: 14, color: C.txt2, lineHeight: 1.6, margin: 0 }}>
            Solo tenés <strong style={{ color: C.txt }}>{único.owner.name}</strong> cargado. La Vista Familiar Consolidada brilla
            cuando tenés varios titulares fiscales: tu cónyuge, sociedades familiares (SAS, holdings),
            hijos mayores. Vas a poder ver el patrimonio total del grupo, optimizar impuestos a nivel
            familiar y detectar dobles cargas u oportunidades cruzadas.
          </p>
        </div>
        <OwnerCard data={único} consolidado={consolidado} onSelectOwner={onSelectOwner} />
      </div>
    );
  }

  // ── Vista completa con múltiples owners ────────────────────────────────
  return (
    <div style={{ padding: "20px 0" }}>
      <HeaderConsolidado
        totalOwners={owners.length}
        naturales={consolidado.naturales}
        juridicas={consolidado.juridicas}
        ano={ano}
      />

      {/* KPIs consolidados destacados */}
      <div style={{
        marginTop: 16,
        padding: "24px 24px",
        background: C.bg2,
        border: `1.5px solid ${C.border}`,
        borderLeft: `4px solid ${C.purple}`,
        borderRadius: 14,
      }}>
        <div style={{ fontSize: 12, color: C.purple, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
          📊 Resumen consolidado del grupo
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <KPI
            label="Patrimonio bruto"
            value={fmShort(consolidado.patrimonioBrutoTotal)}
            subValue={fm(consolidado.patrimonioBrutoTotal)}
            color={C.txt}
            icon="🏦"
          />
          <KPI
            label="Patrimonio líquido"
            value={fmShort(consolidado.patrimonioLiquidoTotal)}
            subValue={`Pasivos: ${fmShort(consolidado.pasivosTotal)}`}
            color={C.green}
            icon="💎"
          />
          <KPI
            label="Ingreso anual total"
            value={fmShort(consolidado.ingresoTotal)}
            subValue={fm(consolidado.ingresoTotal)}
            color={C.blue}
            icon="💰"
          />
          <KPI
            label="Impuesto total"
            value={fmShort(consolidado.impuestoTotal)}
            subValue={`Tasa efectiva ${consolidado.tasaEfectivaConsolidada.toFixed(1)}%`}
            color={C.orange}
            icon="🏛️"
          />
        </div>

        {/* Ahorro potencial destacado si hay */}
        {consolidado.ahorroPotencialTotal > 0 && (
          <div style={{
            marginTop: 16,
            padding: "14px 16px",
            background: C.greenBg,
            border: `1px solid ${C.green}40`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Ahorro fiscal potencial detectado
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.txt, marginTop: 2 }}>
                {fm(consolidado.ahorroPotencialTotal)} / año
              </div>
              <div style={{ fontSize: 11, color: C.txt3, marginTop: 2 }}>
                Sumando palancas legales de todos los miembros del grupo. Mirá las tarjetas debajo para detalles por persona.
              </div>
            </div>
          </div>
        )}

        {/* Estado de auditoría agregado */}
        {(consolidado.erroresTotal > 0 || consolidado.advertenciasTotal > 0) && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            background: consolidado.erroresTotal > 0 ? C.redBg : C.orangeBg,
            border: `1px solid ${consolidado.erroresTotal > 0 ? C.red : C.orange}40`,
            borderRadius: 8,
            fontSize: 12,
            color: C.txt2,
          }}>
            {consolidado.erroresTotal > 0 && (
              <span><strong style={{ color: C.red }}>{consolidado.erroresTotal} {consolidado.erroresTotal === 1 ? "error" : "errores"}</strong> en datos del grupo · </span>
            )}
            {consolidado.advertenciasTotal > 0 && (
              <span><strong style={{ color: C.orange }}>{consolidado.advertenciasTotal} {consolidado.advertenciasTotal === 1 ? "advertencia" : "advertencias"}</strong> · </span>
            )}
            <span>Entrá a cada miembro debajo para resolverlos.</span>
          </div>
        )}
      </div>

      {/* Distribución visual del peso de cada owner */}
      {consolidado.patrimonioBrutoTotal > 0 && (
        <DistribucionPatrimonio ownersData={ownersData} total={consolidado.patrimonioBrutoTotal} />
      )}

      {/* Tarjetas por owner */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: C.txt2, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
          👥 Miembros del grupo ({owners.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ownersData.map(d => (
            <OwnerCard key={d.owner.id} data={d} consolidado={consolidado} onSelectOwner={onSelectOwner} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────

function HeaderConsolidado({ totalOwners, naturales, juridicas, ano }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(196,181,253,0.4)", borderRadius: 999 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#c4b5fd", letterSpacing: 0.5 }}>👨‍👩‍👧‍👦 VISTA FAMILIAR</span>
        </div>
        <span style={{ fontSize: 12, color: C.txt3 }}>Año gravable {ano}</span>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.txt, margin: 0, lineHeight: 1.2 }}>
        Patrimonio del grupo familiar
      </h1>
      <p style={{ fontSize: 13, color: C.txt2, marginTop: 6, lineHeight: 1.5 }}>
        Vista consolidada de los <strong style={{ color: C.txt }}>{totalOwners} titulares fiscales</strong>
        {naturales > 0 && ` · ${naturales} ${naturales === 1 ? "persona natural" : "personas naturales"}`}
        {juridicas > 0 && ` · ${juridicas} ${juridicas === 1 ? "sociedad" : "sociedades"}`}.
        Mirá patrimonio, impuestos y oportunidades a nivel agregado y por miembro.
      </p>
    </div>
  );
}

function KPI({ label, value, subValue, color, icon }) {
  return (
    <div style={{
      padding: "14px 14px",
      background: C.bg3,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 10, color: C.txt3, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color, lineHeight: 1.1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 11, color: C.txt3, marginTop: 4 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function DistribucionPatrimonio({ ownersData, total }) {
  // Ordenar por patrimonio descendente
  const sorted = [...ownersData].sort((a, b) => b.patrimonioBruto - a.patrimonioBruto);

  // Colores por tipo
  const getColor = (tipo, idx) => {
    const palettes = {
      natural: ["#60a5fa", "#a78bfa", "#22d3ee", "#34d399"],
      juridica: ["#c4b5fd", "#f472b6", "#fbbf24", "#fb7185"],
    };
    return palettes[tipo]?.[idx % 4] || "#6b7280";
  };

  return (
    <div style={{
      marginTop: 16,
      padding: "20px 20px",
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 12, color: C.txt2, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        🥧 Distribución del patrimonio
      </div>
      {/* Barra de stack */}
      <div style={{
        display: "flex",
        height: 32,
        borderRadius: 6,
        overflow: "hidden",
        background: C.bg3,
        marginBottom: 12,
      }}>
        {sorted.map((d, i) => {
          if (d.patrimonioBruto <= 0) return null;
          const pct = (d.patrimonioBruto / total) * 100;
          if (pct < 0.5) return null; // Saltarse muy chiquititos
          return (
            <div
              key={d.owner.id}
              title={`${d.owner.name}: ${pct.toFixed(1)}%`}
              style={{
                width: pct + "%",
                background: getColor(d.owner.type, i),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000",
                fontSize: 10,
                fontWeight: 800,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {pct >= 8 && pct.toFixed(0) + "%"}
            </div>
          );
        })}
      </div>
      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sorted.map((d, i) => {
          if (d.patrimonioBruto <= 0) return null;
          const pct = (d.patrimonioBruto / total) * 100;
          return (
            <div key={d.owner.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.txt2 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: getColor(d.owner.type, i) }}></span>
              <span style={{ fontWeight: 700 }}>{d.owner.type === "juridica" ? "🏢" : "👤"} {d.owner.name}</span>
              <span style={{ color: C.txt3 }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OwnerCard({ data, consolidado, onSelectOwner }) {
  const o = data.owner;
  const isJur = o.type === "juridica";
  const pctIngreso = consolidado.ingresoTotal > 0
    ? (data.ingreso / consolidado.ingresoTotal * 100)
    : 0;
  const pctPatrimonio = consolidado.patrimonioBrutoTotal > 0
    ? (data.patrimonioBruto / consolidado.patrimonioBrutoTotal * 100)
    : 0;

  return (
    <button
      onClick={() => onSelectOwner?.(o.id)}
      style={{
        width: "100%",
        padding: "18px 20px",
        background: C.bg2,
        border: `1.5px solid ${C.border}`,
        borderLeft: `4px solid ${isJur ? C.purple : C.blue}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = isJur ? C.purple : C.blue; e.currentTarget.style.borderLeftColor = isJur ? C.purple : C.blue; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.borderLeftColor = isJur ? C.purple : C.blue; }}
    >
      {/* Header del owner */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          fontSize: 24, flexShrink: 0,
          width: 42, height: 42, borderRadius: 10,
          background: isJur ? C.purpleBg : C.blueBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{isJur ? "🏢" : "👤"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.txt, lineHeight: 1.2 }}>
            {o.name}
          </div>
          <div style={{ fontSize: 11, color: C.txt3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span>{isJur ? "Persona jurídica · F-110" : "Persona natural · F-210"}</span>
            {o.nit && <span>· NIT/CC {o.nit}</span>}
            {o.regimen && <span>· {o.regimen}</span>}
          </div>
        </div>
        {/* Estado de auditoría */}
        {(data.erroresAuditoria > 0 || data.advertenciasAuditoria > 0) && (
          <div style={{
            padding: "4px 10px",
            background: data.erroresAuditoria > 0 ? C.redBg : C.orangeBg,
            border: `1px solid ${data.erroresAuditoria > 0 ? C.red : C.orange}40`,
            borderRadius: 999,
            fontSize: 11,
            color: data.erroresAuditoria > 0 ? C.red : C.orange,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {data.erroresAuditoria > 0
              ? `${data.erroresAuditoria} ${data.erroresAuditoria === 1 ? "error" : "errores"}`
              : `${data.advertenciasAuditoria} ${data.advertenciasAuditoria === 1 ? "alerta" : "alertas"}`}
          </div>
        )}
        <div style={{ fontSize: 18, color: C.txt3, flexShrink: 0 }}>→</div>
      </div>

      {/* Métricas del owner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <CardMetric label="Patrimonio" value={fmShort(data.patrimonioBruto)} subValue={`${pctPatrimonio.toFixed(0)}% del grupo`} />
        <CardMetric label="Ingreso anual" value={fmShort(data.ingreso)} subValue={`${pctIngreso.toFixed(0)}% del grupo`} />
        <CardMetric label="Impuesto" value={fmShort(data.impuesto)} subValue={`Tasa ${data.tasaEfectiva.toFixed(1)}%`} color={C.orange} />
        {data.ahorroPotencial > 0 && (
          <CardMetric
            label="Ahorro detectado"
            value={fmShort(data.ahorroPotencial)}
            subValue={`${data.cantidadOportunidades} ${data.cantidadOportunidades === 1 ? "palanca" : "palancas"}`}
            color={C.green}
          />
        )}
      </div>
    </button>
  );
}

function CardMetric({ label, value, subValue, color = "#ffffff" }) {
  return (
    <div style={{
      padding: "10px 12px",
      background: C.bg3,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 9, color: C.txt3, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color, lineHeight: 1.1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: C.txt3, marginTop: 2 }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: detectar si un hallazgo de auditoría aplica a un owner específico
// ─────────────────────────────────────────────────────────────────────────

function detectaOwnerEnHallazgo(hallazgo, ownerId, ownerName) {
  // Algunos hallazgos tienen el ownerId/name en el id o título
  if (hallazgo.id?.includes(ownerId)) return true;
  if (hallazgo.titulo?.includes(ownerName)) return true;
  // Items huérfanos: no son específicos de un owner, los excluimos
  if (hallazgo.id?.startsWith("huerfano_")) return false;
  return false;
}
