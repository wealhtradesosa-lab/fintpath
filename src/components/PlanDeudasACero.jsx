import { useEffect, useMemo, useState } from "react";
import NumberInput from "./NumberInput";
import Disclaimer from "./Disclaimer";
import {
  calcularPlanDeudas,
  FUENTE_CF_PLAN,
  COPY_CF_NO_POSITIVO,
  CHIP_NO_AMORTIZA,
} from "../lib/planDeudas.js";

const T = {
  bg3: "#1e1e24",
  card: "#141418",
  border: "rgba(255,255,255,0.06)",
  txt: "#fafafa",
  txt2: "#a1a1aa",
  txt3: "#71717a",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  orange: "#f97316",
};

const _fm = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");

/**
 * Bloque P0.3 — Plan a cero ligado al CF.
 * Montar en Deudas. No toca taxCO / sim / math #19 (solo llama proyectarPatrimonio).
 *
 * Props:
 *  - deudas, user, trm, cashFlow (t.cf post-cuotas), fmt
 *  - onExtraADeudasChange(extra) — hook P0.2 Metas
 */
export default function PlanDeudasACero({
  deudas = [],
  user = {},
  trm = 4200,
  cashFlow = 0,
  fmt,
  onExtraADeudasChange,
}) {
  const fm = fmt || _fm;
  const cfDefault = Number(cashFlow) || 0;

  const [metodo, setMetodo] = useState("avalanche"); // avalanche | snowball
  const [extraOverride, setExtraOverride] = useState(null); // null = usar CF
  const [showSupuestos, setShowSupuestos] = useState(false);

  const plan = useMemo(
    () =>
      calcularPlanDeudas({
        deudas,
        cfMensual: cfDefault,
        extraOverride,
        metodo,
        trm,
        user: { ...user, deudas, trm },
        fmt: fm,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deudas, cfDefault, extraOverride, metodo, trm]
  );

  useEffect(() => {
    if (typeof onExtraADeudasChange === "function") {
      onExtraADeudasChange(plan.vacio ? 0 : plan.extraADeudas || 0);
    }
  }, [plan.vacio, plan.extraADeudas, onExtraADeudasChange]);

  const extraIsOverride = extraOverride != null && extraOverride !== "";

  return (
    <div
      style={{
        marginBottom: 20,
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: "18px 18px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: T.txt3,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Plan a cero
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.txt, marginTop: 2 }}>
            Orden + meses + trade-off vs patrimonio
          </div>
          <div style={{ fontSize: 11, color: T.txt3, marginTop: 4, maxWidth: 520 }}>
            El monto extra sale de tu flujo de caja disponible, ya descontadas las
            cuotas que pagas hoy. La comparación a 3 años asume una valorización
            antes de impuestos; es una comparación, no una recomendación de inversión.
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMetodo("avalanche")}
            style={chipStyle(metodo === "avalanche")}
            title="Mayor tasa primero"
          >
            Avalancha
          </button>
          <button
            type="button"
            onClick={() => setMetodo("snowball")}
            style={chipStyle(metodo === "snowball")}
            title="Menor saldo primero"
          >
            Bola de nieve
          </button>
        </div>
      </div>

      {plan.vacio ? (
        <div
          style={{
            padding: "14px 12px",
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 10,
            fontSize: 13,
            color: T.txt2,
            lineHeight: 1.5,
          }}
        >
          {plan.emptyCopy ||
            "No hay deudas activas — el CF puede ir a metas/norte."}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: 12,
              background: T.bg3,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: T.txt3,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                Extra mensual al plan
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: plan.extra > 0 ? T.green : T.orange,
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fm(plan.extra)}
                <span style={{ fontSize: 12, color: T.txt3, fontWeight: 600 }}>
                  /mes
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                {extraIsOverride
                  ? "Override local"
                  : "Default = max(0, CF post-cuotas)"}
                {" · "}CF {fm(cfDefault)}/mes
              </div>
              {plan.cfSinPositivo && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: T.orange,
                    background: "rgba(249,115,22,0.08)",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  {COPY_CF_NO_POSITIVO}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: 10,
                    color: T.txt3,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Override extra /mes
                </label>
                <NumberInput
                  value={extraOverride == null ? "" : extraOverride}
                  onChange={(v) =>
                    setExtraOverride(v === "" || v == null ? null : String(v))
                  }
                  placeholder={String(Math.round(plan.extraDefault || 0))}
                  style={{
                    width: 140,
                    background: T.card,
                    border: "1px solid " + T.border,
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: T.txt,
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => setExtraOverride(null)}
                style={{
                  background: T.card,
                  border: "1px solid " + T.border,
                  color: T.txt2,
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 12,
                  marginTop: 14,
                }}
              >
                Usar del CF
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, color: T.txt, lineHeight: 1.55, fontWeight: 600 }}>
              {plan.frase}
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: plan.sim?.converge ? T.green : T.orange,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                Cero en {plan.sim?.labelMeses || "—"}
              </span>
              {plan.sim?.algunaNoAmortiza && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.orange,
                    background: "rgba(249,115,22,0.12)",
                    border: "1px solid rgba(249,115,22,0.35)",
                    borderRadius: 100,
                    padding: "4px 10px",
                  }}
                >
                  {CHIP_NO_AMORTIZA}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {(plan.ordenadas || []).map((d, idx) => {
              const row = (plan.sim?.porDeuda || []).find((x) => x.id === d.id);
              return (
                <div
                  key={d.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: T.bg3,
                    borderRadius: 10,
                    border: "1px solid " + T.border,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: idx === 0 ? "rgba(239,68,68,0.15)" : T.card,
                      color: idx === 0 ? T.red : T.txt2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.txt,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {d.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
                      {fm(d.saldoCOP)}
                      {d.tasaEA > 0
                        ? ` @ ${Number(d.tasaEA).toLocaleString("es-CO", {
                            maximumFractionDigits: 2,
                          })}%`
                        : " · sin tasa (orden por saldo)"}
                      {" · cuota "}
                      {fm(d.cuotaCOP)}
                      {row?.mesCero != null ? ` · cero en mes ${row.mesCero}` : ""}
                    </div>
                  </div>
                  {d.noAmortiza && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.orange,
                        background: "rgba(249,115,22,0.12)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {CHIP_NO_AMORTIZA}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: 12,
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.25)",
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: T.blue,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              ¿Pagar deudas o invertir? Comparación a 3 años
            </div>
            {/* whiteSpace: "pre-line" respeta los saltos de línea del texto.
                Sin esto las tres frases se pegan en un bloque corrido, que es
                justo lo que hacía ilegible la versión anterior. */}
            <div style={{ fontSize: 13, color: T.txt, lineHeight: 1.65, whiteSpace: "pre-line" }}>
              {plan.fraseTrade}
            </div>
            {plan.trade && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <MiniCard
                  label="Si pagas deudas"
                  value={fm(plan.trade.escenarioA.patrimonio3a)}
                  sub={
                    plan.trade.escenarioA.veredicto === "crece" ? "Crece" : "Se come"
                  }
                  tone={
                    plan.trade.escenarioA.veredicto === "crece" ? T.green : T.red
                  }
                />
                <MiniCard
                  label="Si lo dejas invertido"
                  value={fm(plan.trade.escenarioB.patrimonio3a)}
                  sub={
                    (plan.trade.escenarioB.veredicto === "crece"
                      ? "Crece"
                      : "Se come") +
                    ` · deudas ${fm(plan.trade.escenarioB.deudasRestantes3a)}`
                  }
                  tone={
                    plan.trade.escenarioB.veredicto === "crece" ? T.green : T.red
                  }
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSupuestos((s) => !s)}
            style={{
              background: "transparent",
              border: "none",
              color: T.txt3,
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 0",
              fontWeight: 600,
            }}
          >
            {showSupuestos ? "Ocultar supuestos" : "Ver supuestos"}
          </button>
          {showSupuestos && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: T.txt3,
                lineHeight: 1.55,
                background: T.bg3,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div>
                <strong style={{ color: T.txt2 }}>Fuente CF:</strong> {FUENTE_CF_PLAN}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>Orden:</strong>{" "}
                {metodo === "snowball"
                  ? "bola de nieve (menor saldo primero)"
                  : "avalancha (mayor tasa primero; tasa 0 → por saldo)"}
                .
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>Simulación:</strong> cuota mínima en
                todas; 100% del extra a la #1 hasta cero. Interés mensual ≈ tasa/12
                Si con el aporte actual la deuda no llega a cero, se muestra “&gt;50 años”.
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>Escenario invertir:</strong> usa la
                misma valorización que la proyección de patrimonio (
                {Math.round((plan.trade?.retornoExcedente || 0.06) * 1000) / 10}% anual,
                pre-impuestos). No incluye supuestos fiscales.
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 10 }}>
        <Disclaimer variante="proyeccion" idioma="es" T={T} compacto />
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    background: active ? "rgba(34,197,94,0.15)" : T.bg3,
    border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid " + T.border,
    color: active ? T.green : T.txt2,
    padding: "6px 12px",
    borderRadius: 100,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  };
}

function MiniCard({ label, value, sub, tone }) {
  return (
    <div
      style={{
        background: T.card,
        border: "1px solid " + T.border,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: T.txt3,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: tone || T.txt,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: tone || T.txt3, marginTop: 2, fontWeight: 600 }}>
        {sub}
      </div>
    </div>
  );
}
