// FINPATHIA · Mi futuro a 10 años. Sección independiente del Simulador.
// Motor: src/lib/futuro10.js. Escenarios guardados en user_data.data.futuro10.
import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import InputDecimalEs from "./InputDecimalEs";
import NumberInput from "./NumberInput";
import { fmtPctEs, fmtMilesEs, fmtPlataCortaEs } from "../lib/formato.js";
import { proyectarFuturo10, SUPUESTOS_F10, retornoNominalPreset, cienMillones, rendimientoHintPct, validarMezcla, leerFuturos, migrarModifica } from "../lib/futuro10.js";
import { track } from "../lib/analytics";

const C = { bg: "#111827", bg2: "#1f2937", bd: "rgba(255,255,255,0.1)", tx: "#e5e7eb", tx2: "#9ca3af", gn: "#22c55e", rd: "#ef4444", am: "#f59e0b" };
const card = { background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 12, padding: 14, marginBottom: 12 };
const btn = (on) => ({ padding: "8px 12px", borderRadius: 8, border: `1px solid ${on ? C.gn : C.bd}`, background: on ? "rgba(34,197,94,0.15)" : "transparent", color: on ? C.gn : C.tx, cursor: "pointer", fontSize: 13 });
const inp = { width: "100%", boxSizing: "border-box", background: C.bg, color: C.tx, border: `1px solid ${C.bd}`, borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const PASOS = ["Hoy", "Decide", "Reinvierte", "Resultado", "Escenarios", "Cada inversión"];
const plata = (v) => "$" + fmtMilesEs(v);
export const AVISO_F10 = "Proyección ilustrativa, no asesoría. Proyección estimada con supuestos generales que puedes ajustar en algunos pasos; no es una recomendación de inversión. No incluye impuestos.";

const CONFIG_INICIAL = { escenario: "base", decisiones: {}, norte: "equilibrio", mezcla: null, nuevas: [], reinversiones: [], futuros: { ingresos: [], activos: [] } };

export const MSG_DEMO_F10 = "En modo demo no se guardan escenarios.";

export default function MiFuturo10({ user = {}, guardado = {}, onGuardar, pasoInicial = 0, demo = false }) {
  const [paso, setPaso] = useState(pasoInicial);
  // 24-oct-2026 (Santiago: "los avances que uno hace en la sección como que
  // no quedan guardados"). Lo que uno va decidiendo se guarda solo como
  // borrador (`futuro10.borrador`) y vuelve al entrar; "Guardar en tu cuenta"
  // sigue siendo para dejar un escenario con nombre y compararlo.
  const [cfg, setCfg] = useState(() => migrarModifica(guardado.borrador ? { ...CONFIG_INICIAL, ...guardado.borrador } : CONFIG_INICIAL));
  const ultimoGuardado = useRef(JSON.stringify(guardado.borrador || null));
  useEffect(() => {
    if (demo || !onGuardar) return;
    const json = JSON.stringify(cfg);
    if (json === ultimoGuardado.current || json === JSON.stringify(CONFIG_INICIAL)) return;
    const t = setTimeout(() => { ultimoGuardado.current = json; onGuardar({ ...guardado, borrador: cfg }); }, 600);
    return () => clearTimeout(t);
  }, [cfg, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  const [nombreEsc, setNombreEsc] = useState("");
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const r = useMemo(() => proyectarFuturo10(user, cfg), [user, cfg]);
  const esc = r.escenario;
  const escenarios = guardado.escenarios || [];
  const mezcla = cfg.mezcla || SUPUESTOS_F10.nortes[cfg.norte] || SUPUESTOS_F10.nortes.equilibrio;
  const ir = (i) => { setPaso(i); track("futuro10_paso", { paso: i + 1 }); };
  const bolsa = (user.inv || []).filter((a) => cfg.decisiones[a.id]?.accion === "vende").length;

  const guardar = () => {
    if (demo) return; // la demo nunca escribe en la cuenta real
    const nuevo = { id: "f10_" + Date.now(), nombre: nombreEsc.trim() || `Escenario ${escenarios.length + 1}`, creado: new Date().toISOString(), config: cfg };
    onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: [...escenarios, nuevo].slice(-10) });
    setNombreEsc("");
    track("futuro10_guardar", { escenario: cfg.escenario, norte: cfg.mezcla ? "personalizado" : cfg.norte, cantidad_escenarios: escenarios.length + 1 });
  };
  const borrar = (id) => !demo && onGuardar && onGuardar({ ...guardado, borrador: cfg, escenarios: escenarios.filter((e) => e.id !== id) });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: C.tx, fontSize: 14 }}>
      <PageHeader label="Mi futuro a 10 años" title="¿Cómo se ve tu patrimonio en 10 años?" compact
        subtitle="Decide qué hacer con cada activo, reinvierte y mira el resultado en pesos de hoy. Tus datos reales no se tocan." />
      <div style={{ ...card, borderColor: C.am, fontSize: 12, color: C.tx2 }}>{AVISO_F10}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PASOS.map((p, i) => <button key={p} style={btn(paso === i)} onClick={() => ir(i)}>{i + 1}. {p}</button>)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
        <span style={{ color: C.tx2, fontSize: 12 }}>Escenario:</span>
        {Object.entries(SUPUESTOS_F10.escenarios).map(([k, e]) => <button key={k} style={btn(cfg.escenario === k)} onClick={() => set("escenario", k)}>{e.nombre}</button>)}
        <span style={{ color: C.tx2, fontSize: 12 }}>inflación {fmtPctEs(esc.inflacionPct)}</span>
      </div>

      {paso === 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Hoy</h3>
          <Grid items={[
            ["Patrimonio neto", plata(r.hoy.patrimonio)],
            ["Entra al mes", plata(r.hoy.ingresoMensual)],
            ["Sale al mes", plata(r.hoy.salidaMensual)],
            ["Flujo del mes", plata(r.hoy.flujoMensual)],
            ["Liquidez", plata(r.hoy.liquidos)],
          ]} />
          <p style={{ color: C.tx2, fontSize: 12 }}>Tus activos, por canasta:</p>
          {["liquido", "inmueble", "acciones", "otro", "vehiculo"].map((cl) => {
            const xs = (user.inv || []).filter((a) => r.activos.find((x) => x.id === a.id && x.clase === cl));
            if (!xs.length) return null;
            return <div key={cl} style={{ fontSize: 13, marginBottom: 4 }}><b>{ETQ[cl]}:</b> {xs.map((a) => a.n || a.nombre).join(", ")}</div>;
          })}
          <p style={{ color: C.tx2, fontSize: 12 }}>Las cifras de hoy no incluyen impuestos.</p>
        </div>
      )}

      {paso === 1 && (<>
        {/* 24-oct-2026 (Santiago: "es muy poco visible lo de ingresos futuros…
            1 qué pasa con las inversiones actuales, 2 deudas, 3 ingresos
            futuros"). Tres secciones numeradas, cada una en su tarjeta. */}
        <div style={card}>
          <Seccion n={1} titulo="Tus inversiones de hoy" sub="De cada una: sigue igual o se vende. ¿Le vas a meter plata, como una obra en tu lote? Eso va en el paso 3, Reinvierte." />
          {(user.inv || []).filter((a) => a && a.sim !== false).map((a) => {
            const d = cfg.decisiones[a.id] || { accion: "continua" };
            const setD = (v) => set("decisiones", { ...cfg.decisiones, [a.id]: { ...d, ...v } });
            return (
              <div key={a.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{a.n || a.nombre}</b><span style={{ color: C.tx2 }}>{plata(a.va)}{String(a.moneda).toUpperCase() === "USD" ? " USD" : ""}</span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {[["continua", "Sigue igual"], ["vende", "Se vende"]].map(([k, l]) => <button key={k} style={btn(d.accion === k)} onClick={() => setD({ accion: k })}>{l}</button>)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={card}>
          <Seccion n={2} titulo="Tus deudas" sub="La deuda de un activo que vendes se paga sola con esa venta. Las demás, márcalas si quieres pagarlas con lo vendido." />
          {(r.deudas || []).length > 0 ? <Deudas r={r} cfg={cfg} set={set} inv={user.inv || []} bolsa={bolsa} /> : <p style={{ color: C.tx2, fontSize: 13 }}>No tienes deudas con saldo.</p>}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que vendes ({bolsa} activo{bolsa === 1 ? "" : "s"}) paga primero esas deudas; con el resto se completa un colchón de {SUPUESTOS_F10.colchonMeses} meses de gastos y lo demás pasa a Reinvierte.</p>
        </div>
        <div style={card}>
          <Seccion n={3} titulo="Lo que viene" sub="Lo que todavía no tienes y empieza más adelante: una pensión, una venta futura, un local que te entregan." />
          <LoQueViene cfg={cfg} set={set} esc={esc} owners={user.owners || []} />
        </div>
      </>)}

      {paso === 2 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Reinvierte</h3>
          {/* 24-oct-2026 (Santiago: "necesito ver qué saldo me quedó de las
              inversiones que vendí para ir sabiendo cuánto tengo para
              reinvertir"). La cuenta de la bolsa, siempre a la vista. */}
          {(() => { const bd = r.bolsaDetalle || {}; const hay = bd.vendido > 0;
            return <div style={{ ...card, background: C.bg, marginBottom: 12 }}>
              {!hay ? <div style={{ fontSize: 12, color: C.tx2 }}>
                {bd.desdeLiquidez > 0 ? <>No vendes nada, así que estas inversiones salen de tu liquidez: <b style={{ color: C.tx }}>{plata(bd.desdeLiquidez)}</b>.</> : <>Todavía no vendes nada en el paso 2. Lo que pongas aquí sale de tu liquidez.</>}
                {bd.faltante > 0 && <div style={{ color: C.am, marginTop: 4 }}>Pediste {plata(bd.pedido)} pero tu liquidez solo alcanza para {plata(bd.pedido - bd.faltante)}: se asigna hasta donde llega.</div>}
              </div>
              : <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
                  {[["Vendiste", bd.vendido, C.tx], ...(bd.desdeLiquidez > 0 ? [["+ De tu liquidez", bd.desdeLiquidez, C.am]] : []), ...(bd.deudas > 0 ? [["− Deudas", bd.deudas, C.tx2]] : []), ["− Colchón", bd.colchon, C.tx2], ...(bd.obras > 0 ? [["− Obras", bd.obras, C.tx2]] : []), ["− A lo que ya tienes", bd.reinvertido, C.tx2], ["− Inversiones nuevas", bd.nuevas, C.tx2], ["Te quedan", bd.restante, bd.restante > 0 ? C.gn : C.tx]].map(([l, v, col]) => <div key={l}><div style={{ fontSize: 11, color: C.tx2 }}>{l}</div><div style={{ fontSize: 15, fontWeight: 700, color: col, fontFamily: "monospace" }}>{plata(v || 0)}</div></div>)}
                </div>
                <div style={{ fontSize: 12, color: C.tx2, marginTop: 8 }}>
                  {bd.pendienteAnio1 > 0 && <div style={{ color: C.am, marginBottom: 4 }}>Lo que le metes a lo que ya tienes no alcanza con lo vendido y tu liquidez: los {plata(bd.pendienteAnio1)} que faltan salen de lo que vaya entrando en el año 1.</div>}
                  {bd.programadas > 0 && <div style={{ marginBottom: 4 }}>Además programaste {plata(bd.programadas)} en inversiones de años siguientes: se pagan ese año con lo que tengas.</div>}
                  {bd.obrasPedido > bd.obras + 0.5 && <div style={{ color: C.am, marginBottom: 4 }}>La obra pide {plata(bd.obrasPedido)}: {plata(bd.obras)} salen de aquí y los {plata(bd.obrasPedido - bd.obras)} que faltan, de lo que vaya entrando en el año 1.</div>}
                  {bd.faltante > 0 ? <span style={{ color: C.am }}>Pediste {plata(bd.pedido)} y entre lo vendido y tu liquidez solo alcanza para {plata(bd.pedido - bd.faltante)}: se asigna hasta donde llega.</span>
                  : bd.desdeLiquidez > 0 ? <>Lo vendido no alcanzó: <b style={{ color: C.tx }}>{plata(bd.desdeLiquidez)}</b> salen de tu liquidez de hoy.</>
                  : bd.restante > 0 ? <>Los <b style={{ color: C.tx }}>{plata(bd.restante)}</b> que quedan se reparten según el norte de abajo{bd.colchon > 0 ? `; el colchón de ${SUPUESTOS_F10.colchonMeses} meses se completa primero` : ""}.</>
                  : <>Todo lo vendido quedó asignado{bd.colchon > 0 ? ` (incluido el colchón de ${SUPUESTOS_F10.colchonMeses} meses)` : ""}.</>}
                </div>
              </>}
            </div>; })()}
          <p style={{ color: C.tx2, fontSize: 12 }}>Elige un norte para lo que quede sin asignar. Son ejemplos de mezcla, no recomendaciones.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(SUPUESTOS_F10.nortes).map(([k, nt]) => <button key={k} style={btn(!cfg.mezcla && cfg.norte === k)} onClick={() => setCfg((p) => ({ ...p, norte: k, mezcla: null }))}>{nt.nombre}</button>)}
            <button style={btn(!!cfg.mezcla)} onClick={() => set("mezcla", { liquidez: mezcla.liquidez, renta: mezcla.renta, crecimiento: mezcla.crecimiento })}>Personalizado</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, marginTop: 10 }}>
            {["liquidez", "renta", "crecimiento"].map((k) => <label key={k} style={{ fontSize: 12, color: C.tx2 }}>{k[0].toUpperCase() + k.slice(1)} (%)
              {cfg.mezcla ? <InputDecimalEs style={inp} value={cfg.mezcla[k]} onChange={(v) => set("mezcla", { ...cfg.mezcla, [k]: v })} /> : <div style={{ color: C.tx, fontSize: 15 }}>{fmtPctEs(mezcla[k], 0)}</div>}</label>)}
          </div>
          {validarMezcla(cfg.mezcla) && <p role="alert" style={{ color: C.rd, fontSize: 12 }}>{validarMezcla(cfg.mezcla)}</p>}
          <h4>Inversiones nuevas</h4>
          {cfg.nuevas.map((x, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 6, marginBottom: 6 }}>
              <select style={inp} value={x.preset} onChange={(e) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, preset: e.target.value } : y))}>
                {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
                <option value="custom">Otra (personalizada)</option>
              </select>
              <NumberInput style={inp} placeholder="Monto" value={x.monto} onChange={(v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, monto: v } : y))} />
              {x.preset === "custom" && (() => {
                const up = (v) => set("nuevas", cfg.nuevas.map((y, j) => j === i ? { ...y, ...v } : y));
                const hint = rendimientoHintPct(esc);
                const lbl = { fontSize: 12, color: C.tx2 };
                return (<>
                  <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} onChange={(e) => up({ nombre: e.target.value })} placeholder="Ej.: negocio, CDT, finca" /></label>
                  <label style={lbl}>¿En qué año?<select style={inp} value={x.anio || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => <option key={y} value={y}>Año {y}</option>)}</select></label>
                  <label style={lbl}>Rendimiento anual esperado (%)<InputDecimalEs style={inp} placeholder={fmtPctEs(hint, 1)} value={x.rendimientoNomPct ?? ""} onChange={(v) => up({ rendimientoNomPct: v })} />
                    <span style={{ fontSize: 11 }}>Si no sabes, usa {fmtPctEs(hint, 1)}.</span></label>
                  <label style={lbl}>Moneda<select style={inp} value={x.moneda || "COP"} onChange={(e) => up({ moneda: e.target.value })}><option value="COP">COP</option><option value="USD">USD</option></select>
                    {x.moneda === "USD" && <span style={{ fontSize: 11, color: C.am }}>En dólares, el resultado en pesos también depende de cómo se mueva la tasa de cambio.</span>}</label>
                  <label style={lbl}>¿Cómo te da plata?<select style={inp} value={x.tipo || "valoriza"} onChange={(e) => up({ tipo: e.target.value })}><option value="renta">Paga renta (te entra al flujo)</option><option value="valoriza">Solo se valoriza (crece el valor)</option></select></label>
                </>);
              })()}
              <button style={btn(false)} onClick={() => set("nuevas", cfg.nuevas.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          ))}
          <button style={btn(false)} onClick={() => set("nuevas", [...cfg.nuevas, { preset: "rfCorto", monto: "" }])}>+ Crear inversión</button>
          {/* 24-oct-2026 (Santiago: "estoy perdido… si a mí me pasa, a otros les
              pasará"). Un solo camino para meterle plata a lo que ya tienes:
              aporte, cuándo, renta y desde cuándo, con hoy + aporte = total. */}
          <h4 style={{ marginBottom: 2 }}>Aumentar lo que ya tienes</h4>
          <p style={{ color: C.tx2, fontSize: 12, marginTop: 0 }}>Plata que le metes a algo tuyo: más capital a una inversión o una obra, como la bodega en tu lote. Si va a dar renta, ponla aquí mismo.</p>
          {cfg.reinversiones.map((x, i) => {
            const up = (v) => set("reinversiones", cfg.reinversiones.map((y, j) => (j === i ? { ...y, ...v } : y)));
            const det = (r.reinversionesDetalle || []).find((y) => y.i === i);
            const lbl = { fontSize: 12, color: C.tx2 };
            const desdeMes = Number(x.rentaDesdeMes) || 0;
            return (
              <div key={i} style={{ borderTop: `1px solid ${C.bd}`, padding: "10px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                  <label style={lbl}>¿A cuál?<select style={inp} value={x.activoId} onChange={(e) => up({ activoId: e.target.value })}>{r.activos.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
                  <label style={lbl}>¿Cuánto le metes? ($)<NumberInput style={inp} placeholder="Ej.: 600.000.000" value={x.monto} onChange={(v) => up({ monto: v })} /></label>
                  <label style={lbl}>¿Cuándo?<select style={inp} value={Number(x.anio) || 1} onChange={(e) => up({ anio: Number(e.target.value) })}>{ANIOS.map((y) => <option key={y} value={y}>{y === 1 ? "Ya (año 1)" : `Año ${y}`}</option>)}</select></label>
                  <label style={lbl}>¿Va a dar renta? ($ al mes, opcional)<NumberInput style={inp} placeholder="Ej.: 8.500.000" value={x.rentaMensual ?? ""} onChange={(v) => up({ rentaMensual: v })} /></label>
                  {(Number(x.rentaMensual) || 0) > 0 && <label style={lbl}>¿Desde cuándo?<select style={inp} value={desdeMes} onChange={(e) => up({ rentaDesdeMes: Number(e.target.value) })}>{opcionesMes(desdeMes).map((mm) => <option key={mm} value={mm}>{textoMes(mm)}</option>)}</select></label>}
                </div>
                {det && (det.aporte > 0 || det.rentaMensual > 0) && <div style={{ marginTop: 8, background: C.bg, borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
                  <div><div style={{ fontSize: 11, color: C.tx2 }}>Queda valiendo</div><div style={{ fontSize: 16, fontWeight: 700 }}>{plata(det.total)}</div><div style={{ fontSize: 11, color: C.tx2 }}>hoy {plata(det.valorHoy)} + {plata(det.aporte)}{det.anio > 1 ? ` en el año ${det.anio}` : ""}</div></div>
                  {det.rentaMensual > 0 && <div><div style={{ fontSize: 11, color: C.tx2 }}>Renta al mes</div><div style={{ fontSize: 16, fontWeight: 700, color: C.gn }}>{plata(det.rentaMensual)}</div><div style={{ fontSize: 11, color: C.tx2 }}>{textoMes(det.rentaDesdeMes).toLowerCase()} · {fmtPctEs(det.rentaPctAnual, 1)} al año sobre el total</div></div>}
                </div>}
                <button style={{ ...btn(false), marginTop: 8 }} onClick={() => set("reinversiones", cfg.reinversiones.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            );
          })}
          {r.activos.length > 0 && <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => set("reinversiones", [...cfg.reinversiones, { activoId: r.activos[0].id, monto: "", anio: 1, rentaMensual: "", rentaDesdeMes: 0 }])}>+ Aumentar algo que ya tienes</button>}
          <p style={{ color: C.tx2, fontSize: 12 }}>Lo que no asignes a mano se reparte según el norte.</p>
        </div>
      )}

      {paso === 3 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Resultado a 10 años</h3>
          <Grid items={[
            ["Patrimonio en pesos de hoy", plata(r.final.patrimonioReal)],
            ["Patrimonio nominal", plata(r.final.patrimonio)],
            ["Invertible vs. inflación", r.vsInflacionReal == null ? "—" : (r.vsInflacionReal >= 0 ? "+" : "") + fmtPctEs(r.vsInflacionReal)],
          ]} />
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 280 }}>
              <thead><tr style={{ color: C.tx2, textAlign: "right" }}><th style={{ textAlign: "left" }}>Año</th><th>Ingreso/mes*</th><th>Gasto/mes*</th><th>Patrimonio*</th></tr></thead>
              <tbody>{r.filas.slice(1).map((f) => (
                <tr key={f.anio} style={{ textAlign: "right", borderTop: `1px solid ${C.bd}`, color: f.cf < 0 ? C.rd : C.tx }}>
                  <td style={{ textAlign: "left" }}>{f.anio}</td><td>{fmtPlataCortaEs(f.ingresosReal / 12)}</td><td>{fmtPlataCortaEs(f.gastosReal / 12)}</td><td>{fmtPlataCortaEs(f.patrimonioReal)}</td>
                </tr>))}</tbody>
            </table>
            <div style={{ color: C.tx2, fontSize: 11 }}>* En pesos de hoy (se descuenta la inflación una sola vez).</div>
          </div>
          {(r.reparto || []).length > 0 && <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: "0 0 6px" }}>Cómo queda repartida tu plata en el año 10</h4>
            {r.reparto.map((x) => <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.bd}`, fontSize: 13 }}>
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{x.nombre}{x.clase === "nueva" && <span style={{ color: C.gn, fontSize: 11 }}> · nueva</span>}</span>
              <span style={{ whiteSpace: "nowrap", textAlign: "right" }}><b>{fmtPlataCortaEs(x.valorReal)}</b> <span style={{ color: C.tx2, fontSize: 11 }}>({fmtPlataCortaEs(x.valor)})</span></span>
            </div>)}
            <div style={{ color: C.tx2, fontSize: 11 }}>En pesos de hoy; entre paréntesis, nominal. Sin restar deudas.</div>
          </div>}
          {r.alertas.length > 0 && <div style={{ ...card, borderColor: C.rd, marginTop: 10 }}>
            <b style={{ color: C.rd }}>Alertas de liquidez</b>
            {dedupe(r.alertas).map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.texto}</div>)}
          </div>}
          {r.hayUSD && <p style={{ color: C.am, fontSize: 12 }}>Lo que está en dólares tiene riesgo cambiario: si el peso se revalúa, vale menos en pesos. El escenario {esc.nombre.toLowerCase()} supone devaluación real de {fmtPctEs(SUPUESTOS_F10.presets.sp500.devaluacionRealPct)}.</p>}
        </div>
      )}

      {paso === 4 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Guardar y comparar</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px", width: "auto" }} placeholder="Nombre del escenario" value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} />
            <button style={btn(!demo)} disabled={demo} onClick={guardar}>Guardar en tu cuenta</button>
          </div>
          {demo && <p style={{ color: C.am, fontSize: 12 }}>{MSG_DEMO_F10}</p>}
          {escenarios.length === 0 ? <p style={{ color: C.tx2 }}>Aún no tienes escenarios guardados.</p> : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 320 }}>
                <thead><tr style={{ color: C.tx2, textAlign: "right" }}><th style={{ textAlign: "left" }}>Escenario</th><th>Pesos de hoy</th><th>Nominal</th><th></th></tr></thead>
                <tbody>{escenarios.map((e) => { const x = proyectarFuturo10(user, e.config); return (
                  <tr key={e.id} style={{ textAlign: "right", borderTop: `1px solid ${C.bd}` }}>
                    <td style={{ textAlign: "left" }}>{e.nombre}{x.alertas.length ? " ⚠️" : ""}</td><td>{fmtPlataCortaEs(x.final.patrimonioReal)}</td><td>{fmtPlataCortaEs(x.final.patrimonio)}</td>
                    <td><button style={btn(false)} onClick={() => { setCfg(migrarModifica({ ...CONFIG_INICIAL, ...e.config })); ir(3); }}>Ver</button> <button style={btn(false)} onClick={() => borrar(e.id)}>Borrar</button></td>
                  </tr>); })}</tbody>
              </table>
            </div>)}
        </div>
      )}

      {paso === 5 && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Cada inversión: $100.000.000 a 3, 5 y 10 años</h3>
          <p style={{ color: C.tx2, fontSize: 12 }}>Ejemplos por tipo de inversión, escenario {esc.nombre.toLowerCase()}. En pesos de hoy; entre paréntesis, nominal.</p>
          {Object.entries(SUPUESTOS_F10.presets).map(([k, p]) => (
            <div key={k} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
              <b>{p.nombre}</b> <span style={{ color: C.tx2, fontSize: 12 }}>· {fmtPctEs(retornoNominalPreset(k, esc))} nominal al año</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, fontSize: 12, marginTop: 4 }}>
                {cienMillones(k, esc).map((c) => <div key={c.anios}>{c.anios} años<br /><b>{fmtPlataCortaEs(c.hoy)}</b><br /><span style={{ color: C.tx2 }}>({fmtPlataCortaEs(c.nominal)})</span></div>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <details style={card}>
        <summary style={{ cursor: "pointer" }}>Supuestos de referencia (estimaciones de largo plazo)</summary>
        <p style={{ color: C.tx2, fontSize: 12 }}>Puedes cambiar el escenario arriba y, en el paso 3, la mezcla o el rendimiento de una inversión personalizada.</p>
        <TablaSupuestos esc={esc} />
      </details>
    </div>
  );
}

const ANIOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function LoQueViene({ cfg, set, esc, owners }) {
  const f = { ingresos: [], activos: [], ...(cfg.futuros || {}) };
  const put = (k, arr) => set("futuros", { ...f, [k]: arr });
  const upI = (i, v) => put("ingresos", f.ingresos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const upA = (i, v) => put("activos", f.activos.map((x, j) => (j === i ? { ...x, ...v } : x)));
  const lbl = { fontSize: 12, color: C.tx2 };
  const g = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6, padding: "8px 0", borderTop: `1px solid ${C.bd}` };
  const selAnio = (v, on, vacioTxt) => <select style={inp} value={v ?? ""} onChange={(e) => on(e.target.value === "" ? "" : Number(e.target.value))}>{vacioTxt && <option value="">{vacioTxt}</option>}{ANIOS.map((y) => <option key={y} value={y}>Año {y}</option>)}</select>;
  const hintVal = (cl) => fmtPctEs(((1 + esc.inflacionPct / 100) * (1 + (cl === "inmueble" ? SUPUESTOS_F10.presets.fincaRaiz.valorizacionSpread : SUPUESTOS_F10.otrosRealSpread) / 100) - 1) * 100, 1);
  const fut = leerFuturos(f, esc); // mismo motor que la proyección
  const totalIng = fut.ingresos.reduce((sm, x) => sm + x.mensual, 0);
  const primerAnio = fut.ingresos.length ? Math.min(...fut.ingresos.map((x) => x.desde)) : null;
  const totalAct = f.activos.reduce((sm, x) => sm + (Number(x.valor) || 0), 0);
  return (
    <div>
      {/* 24-oct-2026 (Santiago: "es muy poco visible lo de ingresos futuros;
          debería verse muy bien"). Pasa a paso propio, con resumen arriba. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, margin: "10px 0 14px" }}>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.tx2 }}>Ingresos futuros</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: totalIng > 0 ? C.gn : C.tx }}>{totalIng > 0 ? `${plata(totalIng)} al mes` : "Ninguno"}</div>
          {fut.ingresos.length > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>{fut.ingresos.length} {fut.ingresos.length === 1 ? "ingreso" : "ingresos"} · el primero en el año {primerAnio}</div>}
        </div>
        <div style={{ background: C.bg, borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 11, color: C.tx2 }}>Activos futuros</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{totalAct > 0 ? plata(totalAct) : "Ninguno"}</div>
          {f.activos.length > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>{f.activos.length} {f.activos.length === 1 ? "activo" : "activos"}</div>}
        </div>
      </div>
      <h4 style={{ margin: "8px 0" }}>Ingresos futuros</h4>
      {f.ingresos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder="Ej.: pensión" onChange={(e) => upI(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Al mes ($, pesos de hoy)<NumberInput style={inp} value={x.mensual ?? ""} onChange={(v) => upI(i, { mensual: v })} />
            <span style={{ fontSize: 11 }}>Si es una pensión, usa la mesada estimada que te da tu fondo o Colpensiones. Sube con la inflación.</span></label>
          <label style={lbl}>Empieza{selAnio(x.desde || 1, (v) => upI(i, { desde: v || 1 }))}</label>
          {/* 24-oct-2026 (Santiago, con la pensión puesta "termina año 7" sin querer:
              "no veo esa opción"). En el iPhone «Sigue» quedaba escondida arriba de la
              rueda. Ahora son dos botones y el año solo aparece si termina. */}
          <div style={lbl}>¿Hasta cuándo?
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" style={btn(vacio(x.hasta))} onClick={() => upI(i, { hasta: "" })}>Sigue siempre</button>
              <button type="button" style={btn(!vacio(x.hasta))} onClick={() => upI(i, { hasta: vacio(x.hasta) ? Math.max(Number(x.desde) || 1, 10) : x.hasta })}>Termina</button>
            </div>
            {!vacio(x.hasta) && <div style={{ marginTop: 6 }}>{selAnio(x.hasta, (v) => upI(i, { hasta: v === "" ? Number(x.desde) || 1 : v }))}</div>}
          </div>
          {(Number(x.mensual) || 0) > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.gn }}>{textoIngresoFuturo(x)}</div>}
          {owners.length > 1 && <label style={lbl}>Titular (opcional)<select style={inp} value={x.titular || ""} onChange={(e) => upI(i, { titular: e.target.value || null })}><option value="">—</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.nombre || o.n}</option>)}</select></label>}
          <button style={btn(false)} onClick={() => put("ingresos", f.ingresos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("ingresos", [...f.ingresos, { nombre: "", mensual: "", desde: 1, hasta: "" }])}>+ Agregar ingreso futuro</button>
      <h4 style={{ margin: "16px 0 8px" }}>Activos futuros</h4>
      {f.activos.map((x, i) => (
        <div key={i} style={g}>
          <label style={lbl}>Nombre<input style={inp} value={x.nombre || ""} placeholder="Ej.: local comercial" onChange={(e) => upA(i, { nombre: e.target.value })} /></label>
          <label style={lbl}>Tipo<select style={inp} value={x.clase || "inmueble"} onChange={(e) => upA(i, { clase: e.target.value })}><option value="inmueble">Finca raíz</option><option value="otro">Otro</option></select></label>
          <label style={lbl}>Valor total ($)<NumberInput style={inp} value={x.valor ?? ""} onChange={(v) => upA(i, { valor: v })} /></label>
          <label style={lbl}>Cuota inicial ($)<NumberInput style={inp} value={x.cuotaInicial ?? ""} onChange={(v) => upA(i, { cuotaInicial: v })} /></label>
          <label style={lbl}>Año de la cuota inicial{selAnio(x.anioCuota || 1, (v) => upA(i, { anioCuota: v || 1 }))}</label>
          <label style={lbl}>Año de entrega{selAnio(x.entrega || 1, (v) => upA(i, { entrega: v || 1 }))}
            <span style={{ fontSize: 11 }}>El resto se paga en la entrega. Los pagos salen de tu liquidez; desde la entrega se valoriza.</span></label>
          <label style={lbl}>Renta neta al mes ($, pesos de hoy, opcional)<NumberInput style={inp} value={x.rentaMensual ?? ""} onChange={(v) => upA(i, { rentaMensual: v })} /></label>
          <label style={lbl}>Renta desde{selAnio(x.rentaDesde || x.entrega || 1, (v) => upA(i, { rentaDesde: v || 1 }))}</label>
          <label style={lbl}>¿Cuánto crees que se valoriza al año? (%)<InputDecimalEs style={inp} placeholder={hintVal(x.clase || "inmueble")} value={x.valorizacionNomPct ?? ""} onChange={(v) => upA(i, { valorizacionNomPct: v })} />
            <span style={{ fontSize: 11 }}>Si no sabes, déjalo en {hintVal(x.clase || "inmueble")}.</span></label>
          <button style={btn(false)} onClick={() => put("activos", f.activos.filter((_, j) => j !== i))}>Quitar</button>
        </div>))}
      <button style={{ ...btn(true), width: "100%", padding: "12px" }} onClick={() => put("activos", [...f.activos, { nombre: "", clase: "inmueble", valor: "", cuotaInicial: "", anioCuota: 1, entrega: 2, rentaMensual: "", rentaDesde: "" }])}>+ Agregar activo futuro</button>
    </div>
  );
}

// 24-oct-2026 (Santiago: "si vendo Orlando la idea es pagar la deuda de
// Orlando… tengo otras deudas que me gustaría pagar con plata de los activos
// que se venden"). La deuda que cuelga de un activo vendido se paga sola con
// esa venta; las demás se marcan aquí. Solo se pagan con lo vendido.
function Deudas({ r, cfg, set, inv, bolsa }) {
  const sel = cfg.pagarDeudas || {};
  const nombreActivo = (id) => { const a = inv.find((x) => x.id === id); return a ? a.n || a.nombre : "el activo"; };
  const bd = r.bolsaDetalle || {};
  return (
    <div>
      {r.deudas.map((d) => {
        const corto = d.pagar && d.pagado < d.saldo - 0.5;
        return (
          <div key={d.id} style={{ borderTop: `1px solid ${C.bd}`, padding: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}><b>{d.nombre}</b><span style={{ color: C.tx2 }}>{plata(d.saldo)}</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
              {d.porVenta
                ? <span style={{ fontSize: 12, color: C.gn }}>Se paga con la venta de {nombreActivo(d.activoId)}</span>
                : [[false, "Sigue"], [true, "Se paga"]].map(([v, l]) => <button key={l} style={btn(!!sel[d.id] === v)} onClick={() => set("pagarDeudas", { ...sel, [d.id]: v })}>{l}</button>)}
              {corto && <span style={{ fontSize: 12, color: C.am }}>alcanza {plata(d.pagado)}</span>}
            </div>
          </div>
        );
      })}
      {bolsa === 0 && <p style={{ color: C.tx2, fontSize: 12 }}>Para pagar una deuda, vende algo arriba: se paga con esa plata.</p>}
      {bd.deudas > 0 && r.cuotasQueSalenMes > 0 && <p style={{ fontSize: 12, color: C.tx2 }}>Pagas {plata(bd.deudas)} y dejas de pagar <b style={{ color: C.gn }}>{plata(r.cuotasQueSalenMes)}</b> de cuotas al mes.</p>}
    </div>
  );
}

function Seccion({ n, titulo, sub }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
    <div style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: 999, background: "rgba(34,197,94,0.15)", color: C.gn, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{n}</div>
    <div style={{ minWidth: 0 }}><h3 style={{ margin: "2px 0 2px" }}>{titulo}</h3><div style={{ color: C.tx2, fontSize: 12 }}>{sub}</div></div>
  </div>;
}

const vacio = (v) => v === "" || v == null;
// Una línea en palabras para cada ingreso futuro: evita que «termina año 7» pase inadvertido.
const textoIngresoFuturo = (x) => {
  const d = Math.max(1, Number(x.desde) || 1), h = vacio(x.hasta) ? null : Math.max(d, Number(x.hasta) || d);
  const monto = "$" + fmtMilesEs(Number(x.mensual) || 0);
  if (h == null) return `Te llegan ${monto} al mes desde el año ${d}, siempre.`;
  if (h === d) return `Te llegan ${monto} al mes solo durante el año ${d}.`;
  return `Te llegan ${monto} al mes del año ${d} al año ${h} (${h - d + 1} años).`;
};

const MESES_RENTA = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108];
const opcionesMes = (actual) => (MESES_RENTA.includes(actual) ? MESES_RENTA : [...MESES_RENTA, actual].sort((a, b) => a - b));
const textoMes = (mm) => (mm === 0 ? "Ya" : mm % 12 === 0 ? `En ${mm / 12} año${mm === 12 ? "" : "s"}` : `En ${mm} meses`);

const ETQ = { liquido: "Liquidez", inmueble: "Finca raíz", acciones: "Crecimiento", otro: "Otros", vehiculo: "Vehículos (no invertibles)" };
const dedupe = (as) => { const vistos = new Set(); return as.filter((a) => (vistos.has(a.tipo) ? false : vistos.add(a.tipo))); };

function Grid({ items }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
    {items.map(([l, v]) => <div key={l} style={{ background: C.bg, borderRadius: 8, padding: 10 }}><div style={{ color: C.tx2, fontSize: 11 }}>{l}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{v}</div></div>)}
  </div>;
}

function TablaSupuestos({ esc }) {
  const s = SUPUESTOS_F10, p = s.presets;
  const filas = [
    ["Inflación", `${fmtPctEs(esc.inflacionPct)} al año`],
    ["Renta fija corto", `inflación + ${fmtPctEs(p.rfCorto.realSpread + esc.retornoSpread)} ≈ ${fmtPctEs(retornoNominalPreset("rfCorto", esc))} al año`],
    ["Renta fija largo", `inflación + ${fmtPctEs(p.rfLargo.realSpread)} (tope + ${fmtPctEs(p.rfLargo.topeSpread)})`],
    ["Finca raíz", `renta neta ${fmtPctEs(p.fincaRaiz.rentaNetaPct)} + valorización = inflación`],
    ["S&P 500 (USD)", `${fmtPctEs(esc.spRealPct)} real; devaluación real ${fmtPctEs(p.sp500.devaluacionRealPct)}`],
    ["Vehículos", `${fmtPctEs(s.vehiculo.depAnios1a3Pct)} años 1–3, ${fmtPctEs(s.vehiculo.depDespuesPct)} después`],
    ["Ingresos / gastos", `inflación + ${fmtPctEs(esc.ingresosSpread)} / + ${fmtPctEs(esc.gastosSpread)}`],
    ["Ajuste de retornos del escenario", fmtPctEs(esc.retornoSpread)],
    ["Colchón de liquidez", `${s.colchonMeses} meses de gastos`],
  ];
  return <div style={{ fontSize: 12, marginTop: 8 }}>{filas.map(([a, b]) => (
    <div key={a} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 8px", padding: "4px 0", borderTop: `1px solid ${C.bd}` }}>
      <span style={{ color: C.tx2 }}>{a}</span><span style={{ textAlign: "right", overflowWrap: "anywhere", minWidth: 0 }}>{b}</span>
    </div>))}</div>;
}
