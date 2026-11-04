import { useEffect, useMemo, useState } from "react";
import NumberInput from "./NumberInput";
import Disclaimer from "./Disclaimer";
import CaminoACero from "./CaminoACero";
import {
  calcularPlanDeudas,
  simularPlanACero,
  fuenteCfPlan,
  chipNoAmortiza,
} from "../lib/planDeudas.js";
import { tx, esUS, plata } from "../lib/region.js";

const T = {
  bg3: "var(--fp-raised)",
  card: "var(--fp-card)",
  border: "rgba(var(--fp-ink),0.06)",
  txt: "var(--fp-txt)",
  txt2: "var(--fp-txt2)",
  txt3: "var(--fp-txt3)",
  green: "#00c805",
  red: "#ff5000",
  blue: "#3b82f6",
  orange: "#f59e0b",
};

const _fm = (n) => (esUS() ? plata(n) : "$" + Math.round(n || 0).toLocaleString("es-CO"));

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

  // 31-oct-2026 — El mismo plan sin abono extra, para comparar en la gráfica.
  const base = useMemo(
    () => (plan.vacio ? null : simularPlanACero(plan.ordenadas, 0)),
    [plan]
  );

  return (
    <div
      style={{
        marginBottom: 20,
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
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
              fontSize: 11,
              color: T.txt3,
              fontWeight: 700,
              letterSpacing: 0.6,
            }}
          >
            {tx("Plan para quedar en cero", "Plan to reach zero")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.txt, marginTop: 2 }}>
            {tx("¿Cuándo quedas libre de deudas?", "When will you be debt-free?")}
          </div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 4, maxWidth: 560, lineHeight: 1.45 }}>
            {tx("Con las cuotas que pagas hoy, y qué cambia si abonas algo extra cada mes. Cuando terminas una deuda, su cuota pasa a la siguiente.", "With the payments you make today, and what changes if you pay a little extra each month. When you finish one debt, its payment rolls into the next.")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMetodo("avalanche")}
            style={chipStyle(metodo === "avalanche")}
            title={tx("Primero la deuda con la tasa más alta: pagas menos intereses", "Highest rate first: you pay the least interest")}
          >
            {tx("Avalancha", "Avalanche")}
          </button>
          <button
            type="button"
            onClick={() => setMetodo("snowball")}
            style={chipStyle(metodo === "snowball")}
            title={tx("Primero la deuda más pequeña: terminas deudas más rápido", "Smallest balance first: you finish debts faster")}
          >
            {tx("Bola de nieve", "Snowball")}
          </button>
        </div>
      </div>

      {plan.vacio ? (
        <div
          style={{
            padding: "14px 12px",
            background: "rgba(0,200,5,0.06)",
            border: "1px solid rgba(0,200,5,0.25)",
            borderRadius: 10,
            fontSize: 13,
            color: T.txt2,
            lineHeight: 1.5,
          }}
        >
          {plan.emptyCopy ||
            tx("No hay deudas activas — el CF puede ir a metas/norte.", "No active debts — your free cash flow can go to your goals.")}
        </div>
      ) : (
        <>
          <CaminoACero plan={plan} base={base} fm={fm} cf={cfDefault}
            extraOverride={extraOverride} setExtraOverride={setExtraOverride} />

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
                  fontWeight: 700,
                  color: plan.sim?.converge ? T.green : T.orange,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {tx("Cero en ", "Zero in ")}{plan.sim?.labelMeses || "—"}
              </span>
              {plan.sim?.algunaNoAmortiza && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.orange,
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    borderRadius: 999,
                    padding: "4px 10px",
                  }}
                >
                  {chipNoAmortiza()}
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
                      background: idx === 0 ? "rgba(255,80,0,0.15)" : T.card,
                      color: idx === 0 ? T.red : T.txt2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
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
                    <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
                      {fm(d.saldoCOP)}
                      {d.tasaEA > 0
                        ? ` @ ${Number(d.tasaEA).toLocaleString(esUS() ? "en-US" : "es-CO", {
                            maximumFractionDigits: 2,
                          })}%`
                        : tx(" · sin tasa (orden por saldo)", " · no rate (ordered by balance)")}
                      {tx(" · cuota ", " · payment ")}
                      {fm(d.cuotaCOP)}
                      {row?.mesCero != null ? tx(` · cero en mes ${row.mesCero}`, ` · zero in month ${row.mesCero}`) : ""}
                    </div>
                  </div>
                  {d.noAmortiza && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: T.orange,
                        background: "rgba(245,158,11,0.12)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {chipNoAmortiza()}
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
                fontSize: 11,
                color: T.blue,
                fontWeight: 700,
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              {tx("¿Pagar deudas o invertir? Comparación a 3 años", "Pay off debt or invest? 3-year comparison")}
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
                  label={tx("Si pagas deudas", "If you pay off debt")}
                  value={fm(plan.trade.escenarioA.patrimonio3a)}
                  sub={
                    plan.trade.escenarioA.veredicto === "crece" ? tx("Crece", "Grows") : tx("Se come", "Shrinks")
                  }
                  tone={
                    plan.trade.escenarioA.veredicto === "crece" ? T.green : T.red
                  }
                />
                <MiniCard
                  label={tx("Si lo dejas invertido", "If you keep it invested")}
                  value={fm(plan.trade.escenarioB.patrimonio3a)}
                  sub={
                    (plan.trade.escenarioB.veredicto === "crece"
                      ? tx("Crece", "Grows")
                      : tx("Se come", "Shrinks")) +
                    tx(` · deudas ${fm(plan.trade.escenarioB.deudasRestantes3a)}`, ` · debt ${fm(plan.trade.escenarioB.deudasRestantes3a)}`)
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
            {showSupuestos ? tx("Ocultar supuestos", "Hide assumptions") : tx("Ver supuestos", "Show assumptions")}
          </button>
          {showSupuestos && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: T.txt3,
                lineHeight: 1.55,
                background: T.bg3,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div>
                <strong style={{ color: T.txt2 }}>{tx("Fuente CF:", "Cash flow source:")}</strong> {fuenteCfPlan()}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>{tx("Orden:", "Order:")}</strong>{" "}
                {metodo === "snowball"
                  ? tx("bola de nieve (menor saldo primero)", "snowball (smallest balance first)")
                  : tx("avalancha (mayor tasa primero; tasa 0 → por saldo)", "avalanche (highest rate first; 0% rate → by balance)")}
                .
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>{tx("Simulación:", "Simulation:")}</strong>{tx(` cuota mínima en
                todas; 100% del extra a la #1 hasta cero. Interés mensual ≈ tasa/12
                Si con el aporte actual la deuda no llega a cero, se muestra “>50 años”.`, " minimum payment on all; 100% of the extra goes to #1 until it's zero. Monthly interest ≈ rate/12. If the debt never reaches zero at the current pace, it shows “>50 years”.")}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong style={{ color: T.txt2 }}>{tx("Escenario invertir:", "Invest scenario:")}</strong>{tx(` usa la
                misma valorización que la proyección de patrimonio (`, " uses the same growth as the net-worth projection (")}
                {Math.round((plan.trade?.retornoExcedente || 0.06) * 1000) / 10}{tx(`% anual,
                pre-impuestos). No incluye supuestos fiscales.`, "% a year, before taxes). No tax assumptions included.")}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 10 }}>
        <Disclaimer variante="proyeccion" idioma={tx("es", "en")} T={T} compacto />
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    background: active ? "rgba(0,200,5,0.15)" : T.bg3,
    border: active ? "1px solid rgba(0,200,5,0.45)" : "1px solid " + T.border,
    color: active ? T.green : T.txt2,
    padding: "6px 12px",
    borderRadius: 999,
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
          fontSize: 11,
          color: T.txt3,
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: tone || T.txt,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: tone || T.txt3, marginTop: 2, fontWeight: 600 }}>
        {sub}
      </div>
    </div>
  );
}
