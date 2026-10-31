import { useMemo, useState } from "react";
import { fmtPctEs } from "../lib/formato.js";
import { elegirUnaAccion, MESES_COLCHON_OBJETIVO } from "../lib/ctaUnaAccion.js";

/**
 * Card P0.1 — una acción fondeada, debajo de ProyeccionPatrimonio (#19).
 * No toca sliders, Sankey, FlujoAnual ni math de proyección.
 *
 * Props:
 *  - cfMensualSimulado: simT.cf
 *  - egresosMensuales: simT.egresosTotales / te (opcional; si falta, heuristic gastos)
 *  - user: { deudas, metas, inv, gastos|gas, bank? }
 *  - impuestoData: estimarImpuesto(u) — solo lectura fiscal (UVT / saldo a pagar)
 *  - fmt, T
 */
export default function CtaUnaAccion({
  cfMensualSimulado = 0,
  egresosMensuales,
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
        egresosMensuales,
        deudas: user?.deudas || [],
        metas: user?.metas || [],
        user,
        impuestoData,
      }),
    [
      cfMensualSimulado,
      egresosMensuales,
      user,
      user?.deudas,
      user?.metas,
      user?.inv,
      user?.gastos,
      user?.gas,
      impuestoData,
    ]
  );

  const isRojo = accion.path === "cf_rojo";
  const accent = isRojo ? T.rd || "#ff5000" : T.gn || "#00c805";
  const accentDim = isRojo
    ? T.rdD || "rgba(255,80,0,0.08)"
    : T.gnD || "rgba(0,200,5,0.1)";

  return (
    <div
      data-testid="cta-una-accion"
      style={{
        background: T.card || "var(--fp-bg)",
        border: "1px solid " + (T.border || "rgba(var(--fp-ink),0.06)"),
        borderRadius: 12,
        padding: 20,
        marginTop: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.8,
          color: T.txt3 || "var(--fp-txt3)",
          marginBottom: 8,
        }}
      >
        Tu siguiente paso
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
            fontWeight: 700,
            color: T.txt || "var(--fp-txt)",
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
              fontWeight: 700,
              color: accent,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {fm(accion.monto)}
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.txt3 || "var(--fp-txt3)",
                marginLeft: 6,
              }}
            >
              {isRojo ? "al año" : "este mes"}
            </span>
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: T.txt2 || "var(--fp-txt2)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: T.txt2 || "var(--fp-txt2)" }}>Por qué · </strong>
          {accion.porQue}
        </div>

        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
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
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {showSupuestos ? "Ocultar" : "¿Por qué esta sugerencia?"}
        </button>
        <div style={{ fontSize: 11, color: T.txt3 || "var(--fp-txt3)", lineHeight: 1.4 }}>
          Estimación · no es asesoría financiera ni tributaria.
        </div>
      </div>

      {showSupuestos && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            background: T.bg2 || "var(--fp-card)",
            border: "1px solid " + (T.border || "rgba(var(--fp-ink),0.06)"),
            fontSize: 12,
            color: T.txt3 || "var(--fp-txt3)",
            lineHeight: 1.55,
          }}
        >
          {/* 31-oct-2026 (Santiago: «qué es esto, no se entiende»). Era la
              regla interna del motor; ahora se cuenta como se le explicaría a
              una persona. */}
          <div>
            Te queda al mes, con lo que estás simulando:{" "}
            <strong style={{ color: T.txt2 || "var(--fp-txt2)" }}>{fm(cfMensualSimulado)}</strong>.
          </div>
          <div style={{ marginTop: 6 }}>
            Te sugerimos una sola cosa a la vez, en este orden: 1) que no te salga más de lo que entra;
            2) pagar la deuda más cara; 3) completar una meta que tengas;
            4) tener {MESES_COLCHON_OBJETIVO} meses de gastos guardados para imprevistos;
            5) bajar impuestos con aportes a AFC o pensión voluntaria; 6) invertir lo que sobre.
          </div>
          {accion.path === "deuda" && accion.detalle && (
            <div style={{ marginTop: 6 }}>
              El abono sugerido es lo menor entre la mitad de lo que te sobra, una cuota y lo que debes.
              Esa deuda cobra {fmtPctEs(Number(accion.detalle.tasa || 0), 1)} de interés al año.
            </div>
          )}
          {accion.path === "meta" && accion.detalle && (
            <div style={{ marginTop: 6 }}>
              Te faltan {fm(accion.detalle.gap)} para la meta. Sugerimos poner cerca del 40 % de lo que te sobra, sin pasarte de lo que falta.
            </div>
          )}
          {accion.path === "reserva" && accion.detalle?.colchon && (
            <div style={{ marginTop: 6 }}>
              Plata a la mano: {fm(accion.detalle.colchon.liquidos)}
              {accion.detalle.colchon.sinDatos ? "" : `, unos ${accion.detalle.colchon.meses} meses de gastos`}.
              Sugerimos guardar el 30 % de lo que te sobra hasta llegar a {MESES_COLCHON_OBJETIVO} meses.
            </div>
          )}
          {accion.path === "fiscal" && accion.detalle && (
            <div style={{ marginTop: 6 }}>
              Estimado con tus datos: no reemplaza la declaración. Pregúntale a tu contador antes de hacer el aporte.
            </div>
          )}
          {accion.path === "norte" && (
            <div style={{ marginTop: 6 }}>
              Sugerimos invertir el 30 % de lo que te sobra; el resto queda libre.
            </div>
          )}
        </div>
      )}
    </div>
  );
}