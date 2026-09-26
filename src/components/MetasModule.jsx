import { useMemo, useState } from "react";
import NumberInput from "./NumberInput";
import { useRole, guardEdit } from "../lib/RoleContext.jsx";
import Disclaimer from "./Disclaimer.jsx";
import { OBJETIVOS } from "../lib/norte.js";
import {
  calcularFondeoMeta,
  NOTA_CF_COMPARTIDO,
  EMPTY_STATE_COPY,
  FUENTE_CF_DEFAULT,
} from "../lib/metaFondeo.js";

const T = {
  bg: "#0c0c0f", bg2: "#141418", bg3: "#1e1e24",
  card: "#141418", border: "rgba(255,255,255,0.06)",
  txt: "#fafafa", txt2: "#a1a1aa", txt3: "#71717a",
  green: "#22c55e", greenDim: "rgba(34,197,94,0.1)",
  red: "#ef4444", redDim: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", purple: "#a78bfa", orange: "#f97316",
  gold: "#eab308", cyan: "#22d3ee",
  ch: ["#22c55e","#3b82f6","#f97316","#a78bfa","#22d3ee","#eab308","#ef4444","#ec4899"],
};
const _fm = (n) => {
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  return "$" + Math.round(n).toLocaleString("es-CO");
};
const ICONS = ["🏠","🚗","🎓","✈️","💼","🏖️","💰","🏥","👶","📱","🎯","🏆"];
const CATS = ["Propiedad","Vehículo","Educación","Viaje","Negocio","Retiro","Ahorro","Salud","Familia","Otro"];

const emptyForm = () => ({
  nombre: "",
  categoria: "Ahorro",
  monto: "",
  fechaMeta: "",
  ahorrado: "",
  icono: "🎯",
  prioridad: "media",
  moneda: "COP",
  norteObjetivo: "",
});

/**
 * Metas CO + fondeo desde CF (P0.2).
 * Props:
 *  - metas, onUpdate, cashFlow (t.cf post-cuotas), fmt
 *  - trm, norte (user.norte), cfFuenteLabel, onNavigateNorte
 */
export default function MetasModule({
  metas,
  onUpdate,
  cashFlow,
  fmt,
  trm = 4200,
  norte = null,
  cfFuenteLabel = FUENTE_CF_DEFAULT,
  onNavigateNorte,
  extraADeudas = 0,
}) {
  const fm = fmt || _fm;
  const { role } = useRole();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState(null);
  const [showSupuestos, setShowSupuestos] = useState(false);
  // CF override sticky (null = usar del simulador/flujo)
  const [cfOverride, setCfOverride] = useState(null);
  const [tradePick, setTradePick] = useState({}); // metaId → trade id

  const items = metas || [];
  const cfDefault = Number(cashFlow) || 0;
  const cfMensual =
    cfOverride == null || cfOverride === ""
      ? cfDefault
      : Number(cfOverride);
  const cfIsOverride = cfOverride != null && cfOverride !== "";

  // P0.3 hook: extra a deudas llega desde Plan a cero (App state)

  const norteLabel = useMemo(() => {
    const id = norte?.objetivo;
    if (!id || !OBJETIVOS[id]) return null;
    const o = OBJETIVOS[id];
    return `${o.emoji} ${o.es.nombre}`;
  }, [norte]);

  const handleSave = () => {
    if (!guardEdit(role)) return;
    if (!(Number(form.monto) > 0)) {
      alert("Indica un monto objetivo.");
      return;
    }
    const item = {
      ...form,
      monto: Number(form.monto) || 0,
      ahorrado: Number(form.ahorrado) || 0,
      moneda: form.moneda || "COP",
      norteObjetivo: form.norteObjetivo || "",
    };
    let updated;
    if (editId) {
      updated = items.map((i) => (i.id === editId ? { ...item, id: editId } : i));
    } else {
      item.id = "meta_" + Date.now();
      updated = [...items, item];
    }
    onUpdate(updated);
    setEditId(null);
    setShowForm(false);
    setForm(emptyForm());
  };

  const handleEdit = (item) => {
    setForm({
      nombre: item.nombre || "",
      categoria: item.categoria || "Ahorro",
      monto: item.monto ?? "",
      fechaMeta: item.fechaMeta || "",
      ahorrado: item.ahorrado ?? "",
      icono: item.icono || "🎯",
      prioridad: item.prioridad || "media",
      moneda: item.moneda || "COP",
      norteObjetivo: item.norteObjetivo || "",
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const totalNeeded = items.reduce((s, m) => {
    const f = calcularFondeoMeta(m, { cfMensual, trm, extraADeudas });
    return s + f.restante;
  }, 0);
  const totalAhorrado = items.reduce((s, m) => {
    const f = calcularFondeoMeta(m, { cfMensual, trm, extraADeudas });
    return s + f.acumuladoCOP;
  }, 0);
  const totalMeta = items.reduce((s, m) => {
    const f = calcularFondeoMeta(m, { cfMensual, trm, extraADeudas });
    return s + f.objetivoCOP;
  }, 0);

  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.fechaMeta || "2099-01-01") - new Date(b.fechaMeta || "2099-01-01")
  );

  const chipStyle = (veredicto) => {
    if (veredicto === "alcanza") {
      return {
        background: T.greenDim,
        color: T.green,
        border: "1px solid " + T.green + "55",
      };
    }
    if (veredicto === "no_alcanza") {
      return {
        background: T.redDim,
        color: T.red,
        border: "1px solid " + T.red + "55",
      };
    }
    return {
      background: T.bg3,
      color: T.txt3,
      border: "1px solid " + T.border,
    };
  };

  const chipText = (fondeo) => {
    if (fondeo.done) return "Completada";
    if (fondeo.vencida) return "Vencida";
    if (fondeo.veredicto === "alcanza") return "Alcanza";
    if (fondeo.veredicto === "no_alcanza") return "No alcanza";
    return "Sin datos";
  };

  return (
    <div data-testid="metas-fondeables">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            🎯 Metas fondeables
          </h2>
          <p style={{ fontSize: 13, color: T.txt3, margin: 0 }}>
            {items.length} metas · Falta: {fm(totalNeeded)}
            {norteLabel && (
              <span style={{ marginLeft: 8, color: T.cyan }}>
                · Tu Norte: {norteLabel}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setEditId(null);
            setForm(emptyForm());
            setShowForm(true);
          }}
          style={{
            background: T.green,
            color: "#000",
            border: "none",
            padding: "10px 20px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          + Nueva Meta
        </button>
      </div>

      {/* CF disponible + override */}
      <div
        style={{
          background: T.card,
          border: "1px solid " + T.border,
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
            justifyContent: "space-between",
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
              CF disponible (post-cuotas)
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: cfMensual >= 0 ? T.green : T.red,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fm(cfMensual)}
              <span style={{ fontSize: 12, color: T.txt3, fontWeight: 600 }}>
                /mes
              </span>
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 2 }}>
              {cfIsOverride ? "Override local" : "Del simulador / flujo"} · extra a
              deudas restadas del CF (P0.3)
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                Override CF /mes
              </label>
              <NumberInput
                value={cfOverride == null ? "" : cfOverride}
                onChange={(v) =>
                  setCfOverride(v === "" || v == null ? null : String(v))
                }
                placeholder={String(Math.round(cfDefault))}
                style={{
                  width: 140,
                  background: T.bg3,
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
              onClick={() => setCfOverride(null)}
              style={{
                background: T.bg3,
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
              Usar del simulador/flujo
            </button>
          </div>
        </div>
        {items.length > 1 && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: T.orange,
              background: "rgba(249,115,22,0.08)",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          >
            {NOTA_CF_COMPARTIDO}
          </div>
        )}
      </div>

      {/* Resumen */}
      {items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: T.card,
              border: "1px solid " + T.border,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>
              TOTAL METAS
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: T.blue,
                marginTop: 4,
              }}
            >
              {fm(totalMeta)}
            </div>
          </div>
          <div
            style={{
              background: T.card,
              border: "1px solid " + T.border,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>
              AHORRADO
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: T.green,
                marginTop: 4,
              }}
            >
              {fm(totalAhorrado)}
            </div>
          </div>
          <div
            style={{
              background: T.card,
              border: "1px solid " + T.border,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 10, color: T.txt3, fontWeight: 600 }}>
              FALTA
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: T.orange,
                marginTop: 4,
              }}
            >
              {fm(totalNeeded)}
            </div>
          </div>
        </div>
      )}

      {/* Lista / empty */}
      {items.length === 0 ? (
        <div
          style={{
            background: T.card,
            border: "1px solid " + T.border,
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <p style={{ color: T.txt2, fontSize: 14, margin: "0 0 8px" }}>
            {EMPTY_STATE_COPY}
          </p>
          <p style={{ color: T.txt3, fontSize: 12, margin: 0 }}>
            Ej.: casa, carro, universidad, viaje — con monto COP/USD y fecha.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {sorted.map((meta) => {
            const fondeo = calcularFondeoMeta(meta, {
              cfMensual,
              trm,
              extraADeudas,
            });
            const open = detailId === meta.id;
            const priColor =
              meta.prioridad === "alta"
                ? T.red
                : meta.prioridad === "media"
                  ? T.orange
                  : T.green;
            const norteMeta =
              meta.norteObjetivo && OBJETIVOS[meta.norteObjetivo]
                ? OBJETIVOS[meta.norteObjetivo]
                : null;
            const picked = tradePick[meta.id];

            return (
              <div
                key={meta.id}
                data-testid={"meta-card-" + meta.id}
                style={{
                  background: T.card,
                  border:
                    "1px solid " +
                    (fondeo.done ? T.green + "30" : T.border),
                  borderRadius: 16,
                  padding: "18px 20px",
                }}
              >
                {/* Header lista: nombre · barra % · chip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 10,
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    <span style={{ fontSize: 26 }}>{meta.icono || "🎯"}</span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: fondeo.done ? T.green : T.txt,
                        }}
                      >
                        {meta.nombre || "Meta"}
                      </div>
                      <div style={{ fontSize: 11, color: T.txt3 }}>
                        {meta.categoria}
                        <span
                          style={{
                            marginLeft: 8,
                            color: priColor,
                            fontWeight: 600,
                          }}
                        >
                          ● {meta.prioridad || "media"}
                        </span>
                        {fondeo.fechaObj && (
                          <span style={{ marginLeft: 8 }}>
                            📅{" "}
                            {fondeo.fechaObj.toLocaleDateString("es-CO", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {norteMeta && (
                          <span style={{ marginLeft: 8, color: T.cyan }}>
                            🧭 {norteMeta.emoji} {norteMeta.es.nombre}
                          </span>
                        )}
                        {fondeo.monedaOrigen === "USD" && (
                          <span style={{ marginLeft: 8, color: T.txt3 }}>
                            (USD→COP TRM {trm})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span
                      data-testid={"meta-chip-" + meta.id}
                      style={{
                        ...chipStyle(
                          fondeo.vencida && !fondeo.done
                            ? "no_alcanza"
                            : fondeo.veredicto
                        ),
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "4px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {chipText(fondeo)}
                    </span>
                    <button
                      onClick={() => handleEdit(meta)}
                      style={{
                        background: T.bg3,
                        border: "none",
                        padding: "5px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: T.txt2,
                        fontSize: 11,
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (!guardEdit(role)) return;
                        if (confirm("¿Eliminar?"))
                          onUpdate(items.filter((i) => i.id !== meta.id));
                      }}
                      style={{
                        background: T.redDim,
                        border: "none",
                        padding: "5px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: T.red,
                        fontSize: 11,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Barra % */}
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: T.txt3 }}>Avance</span>
                    <span
                      style={{
                        color: fondeo.done ? T.green : T.txt2,
                        fontWeight: 700,
                      }}
                    >
                      {fondeo.pctAvance.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      background: T.bg3,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: fondeo.pctAvance + "%",
                        background: fondeo.done
                          ? T.green
                          : fondeo.pctAvance > 50
                            ? T.blue
                            : T.orange,
                        borderRadius: 5,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>

                {/* Frase veredicto (legible sin abrir supuestos) */}
                {fondeo.frase && (
                  <div
                    data-testid={"meta-frase-" + meta.id}
                    style={{
                      background:
                        fondeo.veredicto === "alcanza"
                          ? T.greenDim
                          : fondeo.veredicto === "no_alcanza"
                            ? T.redDim
                            : T.bg3,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      color:
                        fondeo.veredicto === "alcanza"
                          ? T.green
                          : fondeo.veredicto === "no_alcanza"
                            ? T.red
                            : T.txt2,
                      lineHeight: 1.45,
                      marginBottom: 8,
                    }}
                  >
                    {fondeo.frase}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setDetailId(open ? null : meta.id)
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.cyan,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: 0,
                    marginBottom: open ? 10 : 0,
                  }}
                >
                  {open ? "Ocultar detalle ▲" : "Ver detalle · aporte / CF / gap ▼"}
                </button>

                {/* Detalle */}
                {open && (
                  <div
                    style={{
                      background: T.bg3,
                      borderRadius: 12,
                      padding: 14,
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Objetivo</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{fm(fondeo.objetivoCOP)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Acumulado</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>
                          {fm(fondeo.acumuladoCOP)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Restante</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.orange }}>
                          {fm(fondeo.restante)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Meses</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                          {fondeo.mesesRestantes ?? "—"}
                          {fondeo.vencida ? " · vencida" : ""}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Aporte /mes</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.cyan }}>
                          {fondeo.aporteSugerido != null
                            ? fm(fondeo.aporteSugerido)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>CF disp.</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: fondeo.cfDisponible >= 0 ? T.green : T.red,
                          }}
                        >
                          {fm(fondeo.cfDisponible)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: T.txt3 }}>Gap</div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color:
                              fondeo.gap != null && fondeo.gap > 0
                                ? T.red
                                : T.green,
                          }}
                        >
                          {fondeo.gap != null ? fm(fondeo.gap) : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Trade-offs */}
                    {!fondeo.done && fondeo.tradeOffs.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.txt3,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            marginBottom: 8,
                          }}
                        >
                          Trade-offs (solo recalculan)
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {fondeo.tradeOffs.map((t) => {
                            const active = picked === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() =>
                                  setTradePick((p) => ({
                                    ...p,
                                    [meta.id]: active ? null : t.id,
                                  }))
                                }
                                style={{
                                  textAlign: "left",
                                  background: active
                                    ? "rgba(34,211,238,0.12)"
                                    : "rgba(255,255,255,0.03)",
                                  border:
                                    "1px solid " +
                                    (active ? T.cyan + "66" : T.border),
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  color: T.txt2,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  lineHeight: 1.4,
                                }}
                              >
                                {t.label}
                                {active && t.recalculo?.tipo === "posponer" && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      color: T.gold,
                                      fontSize: 11,
                                    }}
                                  >
                                    Meta marcada para posponer — sin cambio de
                                    números. Prioriza otra con el mismo CF.
                                  </div>
                                )}
                                {active &&
                                  t.recalculo?.tipo === "alargar_fecha" &&
                                  t.recalculo.meses && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: T.cyan,
                                        fontSize: 11,
                                      }}
                                    >
                                      Recálculo: {t.recalculo.meses} meses @{" "}
                                      {fm(t.recalculo.aporte)}/mes.
                                    </div>
                                  )}
                                {active &&
                                  t.recalculo?.tipo === "bajar_monto" && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: T.cyan,
                                        fontSize: 11,
                                      }}
                                    >
                                      Recálculo: objetivo fondeable{" "}
                                      {fm(t.recalculo.montoFondeable)}.
                                    </div>
                                  )}
                                {active &&
                                  t.recalculo?.tipo === "recortar_gasto" && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        color: T.cyan,
                                        fontSize: 11,
                                      }}
                                    >
                                      Recálculo: con +{fm(t.recalculo.recorteMensual)}
                                      /mes de CF llegas en {t.recalculo.meses}{" "}
                                      meses.
                                    </div>
                                  )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {norteMeta && onNavigateNorte && (
                      <button
                        type="button"
                        onClick={() => onNavigateNorte()}
                        style={{
                          marginTop: 12,
                          background: "transparent",
                          border: "1px solid " + T.cyan + "44",
                          color: T.cyan,
                          borderRadius: 8,
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Ver Tu Norte ({norteMeta.es.nombre})
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Supuestos colapsados */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setShowSupuestos((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            color: T.txt3,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            padding: 0,
          }}
        >
          {showSupuestos ? "Ocultar supuestos ▲" : "Ver supuestos ▼"}
        </button>
        {showSupuestos && (
          <div
            style={{
              marginTop: 8,
              background: T.card,
              border: "1px solid " + T.border,
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              color: T.txt2,
              lineHeight: 1.6,
            }}
          >
            <div>
              <strong style={{ color: T.txt }}>Fuente CF:</strong> {cfFuenteLabel}
            </div>
            <div>
              <strong style={{ color: T.txt }}>TRM:</strong>{" "}
              {Number(trm).toLocaleString("es-CO")} (USD→COP en metas con moneda
              USD)
            </div>
            <div>
              <strong style={{ color: T.txt }}>Extra a deudas:</strong> $0 (hook
              P0.3; resta del CF si Plan a cero está activo)
            </div>
            <div style={{ marginTop: 6, color: T.txt3 }}>
              No es consejo de inversión ni de crédito. Los trade-offs solo
              recalculan números; no ejecutan pagos ni mueven el simulador.
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg2,
              border: "1px solid " + T.border,
              borderRadius: 20,
              width: "100%",
              maxWidth: 520,
              maxHeight: "85vh",
              overflow: "auto",
              padding: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editId ? "Editar Meta" : "Nueva Meta"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: T.txt3,
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ gridColumn: "1/-1" }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Nombre de la meta
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Ej: Casa, carro, fondo universidad"
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Categoría
                </label>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, categoria: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Prioridad
                </label>
                <select
                  value={form.prioridad}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, prioridad: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Moneda
                </label>
                <select
                  value={form.moneda || "COP"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, moneda: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD (→ COP con TRM)</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Vínculo Tu Norte (opcional)
                </label>
                <select
                  value={form.norteObjetivo || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, norteObjetivo: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option value="">— Sin vínculo —</option>
                  {Object.values(OBJETIVOS).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.emoji} {o.es.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Monto necesario
                </label>
                <NumberInput
                  value={form.monto}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      monto: v === "" ? "" : String(v),
                    }))
                  }
                  placeholder="500000000"
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Ya ahorrado
                </label>
                <NumberInput
                  value={form.ahorrado}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      ahorrado: v === "" ? "" : String(v),
                    }))
                  }
                  placeholder="100000000"
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Fecha meta
                </label>
                <input
                  type="date"
                  value={form.fechaMeta}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fechaMeta: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    background: T.bg3,
                    border: "1px solid " + T.border,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: T.txt,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.txt3,
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Ícono
                </label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icono: ic }))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border:
                          form.icono === ic
                            ? "2px solid " + T.blue
                            : "1px solid " + T.border,
                        background:
                          form.icono === ic ? T.blue + "15" : T.bg3,
                        cursor: "pointer",
                        fontSize: 18,
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {form.monto &&
              form.fechaMeta &&
              Number(form.monto) > 0 &&
              (() => {
                const preview = calcularFondeoMeta(
                  {
                    monto: form.monto,
                    ahorrado: form.ahorrado,
                    fechaMeta: form.fechaMeta,
                    moneda: form.moneda,
                  },
                  { cfMensual, trm, extraADeudas }
                );
                return (
                  <div
                    style={{
                      marginTop: 16,
                      background:
                        preview.veredicto === "alcanza"
                          ? T.greenDim
                          : T.redDim,
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color:
                          preview.veredicto === "alcanza" ? T.green : T.red,
                        fontWeight: 700,
                      }}
                    >
                      {chipText(preview)} · preview fondeo
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: T.txt,
                        marginTop: 6,
                        lineHeight: 1.4,
                      }}
                    >
                      {preview.frase}
                    </div>
                    {preview.aporteSugerido != null && (
                      <div
                        style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}
                      >
                        Aporte {fm(preview.aporteSugerido)}/mes · CF{" "}
                        {fm(preview.cfDisponible)} · Gap{" "}
                        {preview.gap != null ? fm(preview.gap) : "—"}
                      </div>
                    )}
                  </div>
                );
              })()}
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "transparent",
                  border: "1px solid " + T.border,
                  color: T.txt2,
                  padding: "10px 24px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                style={{
                  background: T.green,
                  color: "#000",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {editId ? "Guardar" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Disclaimer variante="proyeccion" T={T} />
    </div>
  );
}
