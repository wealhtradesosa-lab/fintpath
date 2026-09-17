import { useMemo, useState } from "react";
import { elegirUnaAccion } from "../lib/ctaUnaAccion.js";

/**
 * Card P0.1 — una acción fondeada, debajo de ProyeccionPatrimonio (#19).
 * No toca sliders, Sankey, FlujoAnual ni math de proyección.
 *
 * Props:
 *  - cfMensualSimulado: simT.cf
 *  - user: { deudas, metas }
 *  - impuestoData: estimarImpuesto(u) — solo lectura fiscal (UVT / saldo a pagar)
 *  - fmt, T
 */
export default function CtaUnaAccion({
  cfMensualSimulado = 0,
  user,
  impuestoData,
  fmt,
  T = {},
}) {
  const fm =
    fmt ||
    ((n) => "$" + Math.round(n || 0).toLocaleString("es-CO"));
  const [showSupuestos, setShowSupuestos] = useState(false);

  const accion = useMemo(
    () =>
      elegirUnaAccion({
        cfMensual: cfMensualSimulado,
        deudas: user?.deudas || [],
        metas: user?.metas || [],
        impuestoData,
      }),
    [cfMensualSimulado, user?.deudas, user?.metas, impuestoData]
  );

  const isRojo = accion.path === "cf_rojo";
  const accent = isRojo ? T.rd || "#ef4444" : T.gn || "#22c55e";
  const accentDim = isRojo
    ? T.rdD || "rgba(239,68,68,0.08)"
    : T.gnD || "rgba(34,197,94,0.1)";

  return (
    <div
      data-testid="cta-una-accion"
      style={{
        background: T.card || "#111113",
        border: "1px solid " + (T.border || "rgba(255,255,255,0.06)"),
        borderRadius: 16,
        padding: 20,
        marginTop: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: T.txt3 || "#71717a",
          marginBottom: 8,
        }}
      >
        Siguiente paso · una acción
      </div>

      <div
        style={{
          background: accentDim,
          border: "1px solid " + accent + "33",
          borderRadius: 12,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: T.txt || "#fafafa",
            lineHeight: 1.35,
          }}
        >
          {accion.frase}
        </div>

        {accion.monto != null && (
          <div
            style={{
              marginTop: 8,
              fontSize: 22,
              fontWeight: 800,
              color: accent,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {fm(accion.monto)}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.txt3 || "#71717a",
                marginLeft: 6,
              }}
            >
              {isRojo ? "/año (CF)" : "este período"}
            </span>
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: T.txt2 || "#a1a1aa",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: T.txt2 || "#a1a1aa" }}>Por qué · </strong>
          {accion.porQue}
        </div>

        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            background: accent + "18",
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          {accion.chip}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setShowSupuestos((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: T.bl || "#3b82f6",
            cursor: "pointer",
            padding: 0,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {showSupuestos ? "Ocultar supuestos" : "Ver supuestos"}
        </button>
        <div style={{ fontSize: 10, color: T.txt3 || "#71717a", lineHeight: 1.4 }}>
          Estimación · no es asesoría financiera ni tributaria.
        </div>
      </div>

      {showSupuestos && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            background: T.bg2 || "#18181b",
            border: "1px solid " + (T.border || "rgba(255,255,255,0.06)"),
            fontSize: 11,
            color: T.txt3 || "#71717a",
            lineHeight: 1.55,
          }}
        >
          <div>
            CF simulado del período:{" "}
            <strong style={{ color: T.txt2 || "#a1a1aa" }}>
              {fm(cfMensualSimulado)}
            </strong>
            /mes.
          </div>
          <div style={{ marginTop: 4 }}>
            Prioridad: CF≤0 → deuda cara → meta con gap → espacio UVT Art.336
            (si aplica) → reserva / Tu Norte. Una sola acción; sin rachas ni
            hábitos.
          </div>
          {accion.path === "fiscal" && accion.detalle && (
            <div style={{ marginTop: 4 }}>
              UVT restantes (espacio PV/AFC): ~{accion.detalle.uvtRestantes}.
              Saldo a pagar estimado: {fm(accion.detalle.saldoAPagar)}. Cifras
              del motor existente (borrador); no tip.
            </div>
          )}
          {accion.path === "deuda" && accion.detalle && (
            <div style={{ marginTop: 4 }}>
              Monto = min(50% CF, 1 cuota o sugerido, saldo). Tasa{" "}
              {Number(accion.detalle.tasa || 0).toFixed(1)}% E.A.
            </div>
          )}
          {accion.path === "meta" && accion.detalle && (
            <div style={{ marginTop: 4 }}>
              Gap de la meta: {fm(accion.detalle.gap)}. Aporte ≈ 40% del CF del
              período, topeado al gap.
            </div>
          )}
          {accion.path === "reserva" && (
            <div style={{ marginTop: 4 }}>
              Aporte = 30% del CF mensual (rango guía 20–50%).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
