// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BuyVsInvest.jsx — ¿Comprar casa o arrendar e invertir?
//
// La lógica vive entera en src/lib/buyVsInvest.js. Acá solo hay entradas,
// gráfico y lectura del resultado. Esa separación es a propósito: el motor se
// puede verificar con números sin montar la interfaz.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { ChartTooltip } from "../lib/chartTheme.jsx";
import NumberInput from "./NumberInput";
import PageHeader from "./PageHeader.jsx";
import Disclaimer from "./Disclaimer";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { compararCompraVsInversion, valorizacionDeEquilibrio, BUY_VS_INVEST_DEFAULTS, BUY_VS_INVEST_DEFAULTS_US, EXCLUSION_121 } from "../lib/buyVsInvest.js";

const T = { bg:"var(--fp-bg)", bg2:"var(--fp-card)", bg3:"var(--fp-raised)", border:"rgba(var(--fp-ink),0.06)",
  txt:"var(--fp-txt)", txt2:"var(--fp-txt2)", txt3:"var(--fp-txt3)", green:"#00c805", red:"#ff5000",
  blue:"#3b82f6", orange:"#f59e0b", gold:"#f59e0b" };

let LOC = "es-CO";
const fm = (n) => "$" + Math.round(Number(n) || 0).toLocaleString(LOC);
const fmCorto = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(1) + (LOC === "en-US" ? "B" : "MM");
  if (Math.abs(v) >= 1e6) return "$" + (LOC === "en-US" ? (v/1e6).toFixed(1) + "M" : Math.round(v / 1e6) + "M");
  if (Math.abs(v) >= 1e3 && LOC === "en-US") return "$" + Math.round(v / 1e3) + "K";
  return "$" + Math.round(v).toLocaleString(LOC);
};

// Rendimientos de referencia. El de BTC NO es el CAGR histórico de 55.8%: a 20
// años ese número implica un precio por bitcoin superior a la riqueza mundial,
// y convierte cualquier comparación en un chiste. 20% ya es una apuesta fuerte.
const ACTIVOS = [
  { id:"cdt",  l:"CDT",      cagr:9,  nota:"Tasa típica de CDT a un año en Colombia." },
  { id:"sp500",l:"S&P 500",  cagr:10, nota:"Promedio histórico de largo plazo en dólares." },
  { id:"btc",  l:"Bitcoin",  cagr:20, nota:"Supuesto sobrio. El histórico (55.8%) proyectado a 20 años daría un BTC de cientos de millones de dólares: no es una proyección, es una imposibilidad aritmética." },
];

function Campo({ label, children, ayuda }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: T.txt3,
        letterSpacing: "0.5px", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
      {ayuda && <div style={{ fontSize: 12, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{ayuda}</div>}
    </div>
  );
}

// 4-nov-2026 (Santiago: "en comprar o arrendar que guarde el escenario").
// u.buyVsInvest = { escenarios: [{ id, nombre, fecha, datos, resultado }] }.
export default function BuyVsInvest({ isUS = false, guardado = null, onGuardar = null }) {
  // 01-sep-2026: hasta hoy un usuario de US veia esta seccion con predial
  // colombiano, ganancia ocasional del 15% y la exencion del Art. 311-1. No es
  // que faltara: mostraba cifras equivocadas para su pais.
  const D = isUS ? BUY_VS_INVEST_DEFAULTS_US : BUY_VS_INVEST_DEFAULTS;
  const [estadoCivil, setEstadoCivil] = useState("single");
  const [precioCasa, setPrecioCasa] = useState(D.precioCasa);
  const [modoCompra, setModoCompra] = useState("hipoteca");
  const [cuotaInicialPct, setCuotaInicialPct] = useState(D.cuotaInicialPct);
  const [tasaHipotecaEA, setTasaHipotecaEA] = useState(D.tasaHipotecaEA);
  const [plazoHipotecaAnios, setPlazoHipotecaAnios] = useState(D.plazoHipotecaAnios);
  const [valorizacionCasaAnual, setValorizacion] = useState(D.valorizacionCasaAnual);
  // 4-nov-2026 (Santiago: "normalmente el arriendo es el 0,3 % al 0,6 % del valor
  // de la propiedad; que uno pueda poner el porcentaje y salga el valor, o el
  // valor y salga el porcentaje; prediligenciar con 0,4 %"). El arriendo sigue al
  // precio con el % hasta que el usuario escribe un valor propio.
  const [arriendoPct, setArriendoPct] = useState(isUS ? 0.6 : 0.4);
  const [arriendoManual, setArriendoManual] = useState(null);
  const arriendoMensual = arriendoManual != null ? arriendoManual : Math.round(((Number(precioCasa) || 0) * arriendoPct) / 100);
  const pctEfectivo = (Number(precioCasa) || 0) > 0 ? ((Number(arriendoMensual) || 0) / Number(precioCasa)) * 100 : 0;
  const [administracionMensual, setAdmin] = useState(D.administracionMensual);
  // 15-ago-2026 (Santiago: "es importante poder considerar el predial, seguros").
  // Ya estaban en el motor, pero fijos en el codigo y sin verse en pantalla: si
  // el predial real del usuario es otro, el resultado mentia sin avisar.
  const [predialAnualPct, setPredial] = useState(D.predialAnualPct);
  const [seguroAnualPct, setSeguro] = useState(D.seguroAnualPct);
  const [mantenimientoAnualPct, setMantenimiento] = useState(D.mantenimientoAnualPct);
  const [gastosCompraPct, setGastosCompra] = useState(D.gastosCompraPct);
  const [gastosVentaPct, setGastosVenta] = useState(D.gastosVentaPct);
  const [horizonteAnios, setHorizonte] = useState(D.horizonteAnios);
  const [activo, setActivo] = useState("sp500");
  const [cagrCustom, setCagrCustom] = useState(null);
  const [exencion, setExencion] = useState(false);
  const [verSupuestos, setVerSupuestos] = useState(false);

  LOC = isUS ? "en-US" : "es-CO";
  const activoSel = ACTIVOS.find((a) => a.id === activo) || ACTIVOS[1];
  const rendimiento = cagrCustom == null ? activoSel.cagr : cagrCustom;

  // NumberInput emite "" cuando el usuario borra el campo. Sin esta coerción,
  // ese "" viaja al motor y contamina las cuentas con NaN silenciosos.
  const num = (v, alt = 0) => (v === "" || v == null || isNaN(Number(v)) ? alt : Number(v));

  const params = {
    precioCasa: num(precioCasa),
    modoCompra,
    cuotaInicialPct,
    tasaHipotecaEA,
    plazoHipotecaAnios,
    valorizacionCasaAnual,
    arriendoMensual: num(arriendoMensual),
    administracionMensual: num(administracionMensual),
    predialAnualPct, seguroAnualPct, mantenimientoAnualPct,
    gastosCompraPct, gastosVentaPct,
    horizonteAnios,
    rendimientoInversionAnual: rendimiento,
    exencionViviendaHabitacion: isUS ? false : exencion,
    // En US la exclusion es un TOPE por estado civil (§121), no un todo o nada.
    exclusionGananciaVivienda: isUS && exencion ? EXCLUSION_121[estadoCivil] : 0,
    gastosCompraPct, gastosVentaPct, predialAnualPct, seguroAnualPct,
    mantenimientoAnualPct,
  };

  const r = useMemo(() => compararCompraVsInversion(params), [
    precioCasa, modoCompra, cuotaInicialPct, tasaHipotecaEA, plazoHipotecaAnios,
    valorizacionCasaAnual, arriendoMensual, administracionMensual, horizonteAnios,
    rendimiento, exencion, predialAnualPct, seguroAnualPct, mantenimientoAnualPct, gastosCompraPct, gastosVentaPct]);

  const equilibrio = useMemo(() => valorizacionDeEquilibrio(params), [
    precioCasa, modoCompra, cuotaInicialPct, tasaHipotecaEA, plazoHipotecaAnios,
    arriendoMensual, administracionMensual, horizonteAnios, rendimiento, exencion, predialAnualPct, seguroAnualPct, mantenimientoAnualPct, gastosCompraPct, gastosVentaPct]);

  const escenariosGuardados = Array.isArray(guardado?.escenarios) ? guardado.escenarios : [];
  const [nombreEsc, setNombreEsc] = useState("");
  const datosEsc = { precioCasa, modoCompra, cuotaInicialPct, tasaHipotecaEA, plazoHipotecaAnios, valorizacionCasaAnual,
    arriendoPct, arriendoManual, administracionMensual, predialAnualPct, seguroAnualPct, mantenimientoAnualPct,
    gastosCompraPct, gastosVentaPct, horizonteAnios, activo, cagrCustom, exencion, estadoCivil };
  const guardarEscenario = () => {
    if (!onGuardar) return;
    const nombre = nombreEsc.trim() || `Casa de ${fm(num(precioCasa))} · ${horizonteAnios} años · ${activoSel.l}`;
    const nuevo = { id: "c" + Date.now(), nombre, fecha: new Date().toISOString().slice(0, 10), datos: datosEsc,
      resultado: { patrimonioComprar: r.patrimonioComprar, patrimonioArrendar: r.patrimonioArrendar, ganador: r.ganador, equilibrio, activo: activoSel.l, rendimiento, arriendo: num(arriendoMensual) } };
    onGuardar({ escenarios: [nuevo, ...escenariosGuardados].slice(0, 20) });
    setNombreEsc("");
  };
  const abrirEscenario = (e) => {
    const x = e.datos || {};
    setPrecioCasa(x.precioCasa); setModoCompra(x.modoCompra); setCuotaInicialPct(x.cuotaInicialPct); setTasaHipotecaEA(x.tasaHipotecaEA);
    setPlazoHipotecaAnios(x.plazoHipotecaAnios); setValorizacion(x.valorizacionCasaAnual); setArriendoPct(x.arriendoPct ?? 0.4);
    setArriendoManual(x.arriendoManual ?? null); setAdmin(x.administracionMensual); setPredial(x.predialAnualPct); setSeguro(x.seguroAnualPct);
    setMantenimiento(x.mantenimientoAnualPct); setGastosCompra(x.gastosCompraPct); setGastosVenta(x.gastosVentaPct); setHorizonte(x.horizonteAnios);
    setActivo(x.activo || "sp500"); setCagrCustom(x.cagrCustom ?? null); setExencion(!!x.exencion); if (x.estadoCivil) setEstadoCivil(x.estadoCivil);
  };
  const borrarEscenario = (id) => onGuardar && onGuardar({ escenarios: escenariosGuardados.filter((e) => e.id !== id) });

  const ganaComprar = r.ganador === "comprar";
  const d = r.detalle;

  const datos = r.serie.map((s) => ({
    anio: s.anio,
    Comprar: s.equityCasa,
    [activoSel.l]: s.portafolio,
  }));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        label={isUS ? "Decision" : "Decisión"}
        title={isUS ? "Buy or rent and invest" : "Comprar o arrendar e invertir"}
        subtitle={isUS ? "Same money, two paths. Both scenarios spend exactly the same each month." : "La misma plata, dos caminos. Los dos escenarios desembolsan exactamente lo mismo cada mes."}
      />

      {escenariosGuardados.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.txt3, marginBottom: 8 }}>Tus escenarios guardados</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {escenariosGuardados.map((e) => {
              const x = e.datos || {}, z = e.resultado || {};
              const Fila = ({ l, v, c }) => (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.txt3, flex: "1 1 auto", minWidth: 0 }}>{l}</span><strong style={{ color: c || T.txt, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</strong>
                </div>
              );
              return (
                <div key={e.id} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", minWidth: 280, flex: "1 1 320px" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.txt, marginBottom: 6 }}>{e.nombre}</div>
                  <Fila l="Precio de la casa" v={fm(num(x.precioCasa))} />
                  <Fila l="Arriendo de esa casa, al mes" v={fm(z.arriendo || 0)} />
                  <Fila l={`Patrimonio si compras, a ${x.horizonteAnios} años`} v={fm(z.patrimonioComprar)} c={z.ganador === "comprar" ? T.green : T.txt} />
                  <Fila l={`Patrimonio si arriendas e inviertes en ${z.activo} (${z.rendimiento} % al año), a ${x.horizonteAnios} años`} v={fm(z.patrimonioArrendar)} c={z.ganador === "arrendar" ? T.green : T.txt} />
                  <Fila l="La casa se valoriza (supuesto)" v={`${x.valorizacionCasaAnual} % al año`} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => abrirEscenario(e)} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 999, padding: "6px 16px", color: T.txt, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Abrir</button>
                    <button type="button" onClick={() => { if (confirm(`¿Borrar el escenario "${e.nombre}"?`)) borrarEscenario(e.id); }} style={{ background: "transparent", border: "1px solid rgba(255,80,0,0.45)", borderRadius: 999, padding: "6px 16px", color: "var(--fp-neg)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Borrar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── RESULTADO ──────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 24, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: T.txt3, letterSpacing: "0.6px" }}>{isUS ? "Buy" : "Comprar"}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: ganaComprar ? T.green : T.txt, marginTop: 6 }}>
              {fm(r.patrimonioComprar)}
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>patrimonio neto a {horizonteAnios} años</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.txt3, letterSpacing: "0.6px" }}>Arrendar + {activoSel.l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: !ganaComprar ? T.green : T.txt, marginTop: 6 }}>
              {fm(r.patrimonioArrendar)}
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>patrimonio neto a {horizonteAnios} años</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.txt3, letterSpacing: "0.6px" }}>Diferencia</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.gold, marginTop: 6 }}>
              {fm(Math.abs(r.diferencia))}
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>
              a favor de {ganaComprar ? "comprar" : "arrendar e invertir"}
            </div>
          </div>
        </div>

        {/* El número que de verdad decide. Evita discutir supuestos: dice qué
            tendría que pasar para que comprar convenga. */}
        {equilibrio != null && (
          <div style={{ marginTop: 20, padding: 16, background: T.bg3, borderRadius: 12,
            borderLeft: `3px solid ${T.gold}` }}>
            <div style={{ fontSize: 13, color: T.txt, lineHeight: 1.6 }}>
              La casa tendría que valorizarse <strong style={{ color: T.gold }}>{equilibrio}% al año</strong> para
              empatar con {activoSel.l} al {rendimiento}%. Hoy tienes puesto {valorizacionCasaAnual}%.
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 6 }}>
              Comparalo con lo que se ha valorizado la zona en los últimos 10 años. Si es menos, la respuesta ya está dada.
            </div>
          </div>
        )}
      </div>

      {onGuardar && (
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={nombreEsc} onChange={(e) => setNombreEsc(e.target.value)} placeholder="Nombre del escenario (opcional)"
            style={{ flex: "1 1 240px", maxWidth: 360, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.txt, fontSize: 14 }} />
          <button type="button" onClick={guardarEscenario} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: T.txt, color: "var(--fp-bg)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Guardar escenario</button>
        </div>
      )}

      {/* ── ENTRADAS ───────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16 }}>{isUS ? "The home" : "La casa"}</div>

          <Campo label={isUS ? "Home price" : "Precio de la casa"}>
            <NumberInput value={precioCasa} onChange={setPrecioCasa} />
          </Campo>

          <Campo label={isUS ? "How do you buy it?" : "¿Cómo la compras?"}>
            <div style={{ display: "flex", gap: 8 }}>
              {[["hipoteca",isUS?"Mortgage":"Con crédito"],["contado",isUS?"All cash":"De contado"]].map(([v,l]) => (
                <button key={v} onClick={() => setModoCompra(v)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    background: modoCompra === v ? T.blue : T.bg3,
                    color: modoCompra === v ? "#fff" : T.txt2,
                    border: `1px solid ${modoCompra === v ? T.blue : T.border}` }}>{l}</button>
              ))}
            </div>
          </Campo>

          {modoCompra === "hipoteca" && (
            <>
              <Campo label={`Cuota inicial: ${cuotaInicialPct}% · ${fmCorto(num(precioCasa) * cuotaInicialPct / 100)}`}>
                <input type="range" min={0} max={80} step={5} value={cuotaInicialPct}
                  onChange={(e) => setCuotaInicialPct(+e.target.value)} style={{ width: "100%" }} />
              </Campo>
              <Campo label={`Tasa del crédito: ${tasaHipotecaEA}% E.A.`}
                ayuda={`Cuota inicial del crédito: ${fm(d.cuotaMensualInicial)}/mes`}>
                <input type="range" min={5} max={20} step={0.5} value={tasaHipotecaEA}
                  onChange={(e) => setTasaHipotecaEA(+e.target.value)} style={{ width: "100%" }} />
              </Campo>
              <Campo label={`Plazo: ${plazoHipotecaAnios} años`}>
                <input type="range" min={5} max={30} step={1} value={plazoHipotecaAnios}
                  onChange={(e) => setPlazoHipotecaAnios(+e.target.value)} style={{ width: "100%" }} />
              </Campo>
            </>
          )}

          <Campo label={`Valorización de la casa: ${valorizacionCasaAnual}% al año`}
            ayuda="Nominal, no descontada de inflación.">
            <input type="range" min={0} max={15} step={0.5} value={valorizacionCasaAnual}
              onChange={(e) => setValorizacion(+e.target.value)} style={{ width: "100%" }} />
          </Campo>

          <Campo label={isUS ? "HOA / month" : "Administración mensual"}>
            <NumberInput value={administracionMensual} onChange={setAdmin} />
          </Campo>

          {/* {isUS ? "Cost of owning" : "Costos de tener la casa"}. Van en % del avaluo y no en pesos fijos
              porque suben con el avaluo: el predial de una casa que se
              valorizo 6% al ano no es el mismo a 20 anos vista. Al lado se
              muestra lo que representan HOY en pesos, que es como el usuario
              los conoce y la unica forma de que pueda validarlos contra su
              recibo. */}
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 18, paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.txt2, marginBottom: 12 }}>
              Costos de tener la casa
            </div>

            <Campo label={`${isUS ? "Property tax" : "Predial"}: ${predialAnualPct}% al año · ${fmCorto(num(precioCasa) * predialAnualPct / 100)} hoy`}
              ayuda="Se recalcula cada año sobre el avalúo, no sobre el precio de compra.">
              <input type="range" min={0} max={3} step={0.05} value={predialAnualPct}
                onChange={(e) => setPredial(+e.target.value)} style={{ width: "100%" }} />
            </Campo>

            <Campo label={`${isUS ? "Insurance" : "Seguro"}: ${seguroAnualPct}% al año · ${fmCorto(num(precioCasa) * seguroAnualPct / 100)} hoy`}
              ayuda="Todo riesgo o el exigido por el banco mientras haya crédito.">
              <input type="range" min={0} max={2} step={0.05} value={seguroAnualPct}
                onChange={(e) => setSeguro(+e.target.value)} style={{ width: "100%" }} />
            </Campo>

            <Campo label={`${isUS ? "Maintenance" : "Mantenimiento"}: ${mantenimientoAnualPct}% al año · ${fmCorto(num(precioCasa) * mantenimientoAnualPct / 100)} hoy`}
              ayuda="Regla de oro: ~1% del valor al año. Techo, tuberías, pintura, lo que se rompe.">
              <input type="range" min={0} max={3} step={0.1} value={mantenimientoAnualPct}
                onChange={(e) => setMantenimiento(+e.target.value)} style={{ width: "100%" }} />
            </Campo>

            <Campo label={`${isUS ? "Closing costs" : "Gastos de compra"}: ${gastosCompraPct}% · ${fmCorto(num(precioCasa) * gastosCompraPct / 100)}`}
              ayuda="Notariado, registro, beneficencia. Se pagan una vez, al inicio.">
              <input type="range" min={0} max={8} step={0.25} value={gastosCompraPct}
                onChange={(e) => setGastosCompra(+e.target.value)} style={{ width: "100%" }} />
            </Campo>

            <Campo label={`${isUS ? "Selling costs (realtor)" : "Gastos de venta"}: ${gastosVentaPct}%`}
              ayuda="Comisión inmobiliaria al vender, sobre el valor futuro.">
              <input type="range" min={0} max={8} step={0.25} value={gastosVentaPct}
                onChange={(e) => setGastosVenta(+e.target.value)} style={{ width: "100%" }} />
            </Campo>
          </div>
        </div>

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16 }}>{isUS ? "Rent and invest" : "Arrendar e invertir"}</div>

          <Campo label={isUS ? "Monthly rent for that same home" : "Arriendo mensual de esa misma casa"}
            ayuda="Lo que pagarías por vivir ahí sin comprarla. Sube con el IPC cada año.">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <NumberInput value={arriendoMensual} onChange={(v) => setArriendoManual(v === "" ? 0 : num(v))} />
              <span style={{ fontSize: 13, color: T.txt3 }}>=</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" step="0.05" min="0" max="3" value={Number(pctEfectivo.toFixed(2))}
                  onChange={(e) => { setArriendoPct(Math.max(0, Number(e.target.value) || 0)); setArriendoManual(null); }}
                  style={{ width: 76, background: T.bg3 || "var(--fp-raised)", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", color: T.txt, fontSize: 14, textAlign: "right" }} />
                <span style={{ fontSize: 13, color: T.txt2 }}>{isUS ? "% of the price per month" : "% del precio al mes"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(isUS ? [0.5, 0.6, 0.7, 0.8] : [0.3, 0.4, 0.5, 0.6]).map((p) => {
                const act = arriendoManual == null && Math.abs(arriendoPct - p) < 1e-9;
                return (
                  <button key={p} type="button" onClick={() => { setArriendoPct(p); setArriendoManual(null); }}
                    style={{ padding: "4px 12px", borderRadius: 999, border: `1px solid ${act ? T.txt : T.border}`, background: act ? "rgba(var(--fp-ink),0.08)" : "transparent", color: act ? T.txt : T.txt2, fontSize: 12, cursor: "pointer" }}>
                    {String(p).replace(".", ",")} %
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 6 }}>{isUS ? "Typical rents run 0.5–0.8 % of the price per month." : "En Colombia el arriendo suele estar entre 0,3 % y 0,6 % del valor de la propiedad al mes. Escribe el valor o el porcentaje: el otro se calcula solo."}</div>
          </Campo>

          <Campo label={isUS ? "Where do you invest the difference?" : "¿Dónde inviertes la diferencia?"}>
            <div style={{ display: "flex", gap: 8 }}>
              {ACTIVOS.map((a) => (
                <button key={a.id} onClick={() => { setActivo(a.id); setCagrCustom(null); }}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    background: activo === a.id ? T.blue : T.bg3,
                    color: activo === a.id ? "#fff" : T.txt2,
                    border: `1px solid ${activo === a.id ? T.blue : T.border}` }}>{a.l}</button>
              ))}
            </div>
          </Campo>

          <Campo label={`Rendimiento esperado: ${rendimiento}% al año`} ayuda={activoSel.nota}>
            <input type="range" min={0} max={40} step={0.5} value={rendimiento}
              onChange={(e) => setCagrCustom(+e.target.value)} style={{ width: "100%" }} />
          </Campo>

          <Campo label={`Horizonte: ${horizonteAnios} años`}>
            <input type="range" min={3} max={30} step={1} value={horizonteAnios}
              onChange={(e) => setHorizonte(+e.target.value)} style={{ width: "100%" }} />
          </Campo>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontSize: 12, color: T.txt2, marginTop: 12 }}>
            <input type="checkbox" checked={exencion} onChange={(e) => setExencion(e.target.checked)} />
            {isUS
              ? "Primary residence (IRC §121 exclusion)"
              : "Es mi vivienda de habitación (exención Art. 311-1 ET)"}
          </label>

          {/* La §121 excluye 250k si declaras soltero y 500k si casado en
              conjunto. La diferencia entre las dos es de cientos de miles de
              dolares en el resultado, asi que no se puede asumir una. */}
          {isUS && exencion && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: T.txt3, marginBottom: 6 }}>Filing status</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["single", "Single — $250K"], ["married", "Married joint — $500K"]].map(([v, l]) => (
                  <button key={v} onClick={() => setEstadoCivil(v)}
                    style={{ flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      background: estadoCivil === v ? T.blue : T.bg3,
                      color: estadoCivil === v ? "#fff" : T.txt2,
                      border: `1px solid ${estadoCivil === v ? T.blue : T.border}` }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 6, lineHeight: 1.45 }}>
                §121 excludes the first {estadoCivil === "married" ? "$500,000" : "$250,000"} of
                gain if it was your primary home 2 of the last 5 years. Anything above that is taxed.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── GRÁFICO ────────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 4 }}>Cómo evoluciona tu patrimonio</div>
        <div style={{ fontSize: 12, color: T.txt3, marginBottom: 16 }}>
          Comprar = valor de la casa menos lo que debes al banco. Sin descontar aún impuestos ni gastos de venta.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={datos}>
            <CartesianGrid stroke="rgba(var(--fp-ink),0.05)" />
            <XAxis dataKey="anio" stroke="var(--fp-txt3)" fontSize={11}
              label={{ value: "años", position: "insideBottomRight", fill: "var(--fp-txt3)", fontSize: 12 }} />
            <YAxis stroke="var(--fp-txt3)" fontSize={11} tickFormatter={fmCorto} width={70} />
            <Tooltip content={<ChartTooltip formatter={(v) => fm(v)} labelFormatter={(l) => `Año ${l}`} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Comprar" stroke={T.orange} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={activoSel.l} stroke={T.blue} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── DESGLOSE ───────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <button onClick={() => setVerSupuestos((v) => !v)}
          style={{ background: "none", border: "none", color: T.txt, fontSize: 14, fontWeight: 700,
            cursor: "pointer", padding: 0, marginBottom: verSupuestos ? 16 : 0 }}>
          {verSupuestos ? "▾" : "▸"} A dónde se fue la plata
        </button>
        {verSupuestos && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.orange, marginBottom: 10 }}>Comprando</div>
              {[["Desembolso inicial", d.desembolsoInicial],
                ["Gastos de compra", d.gastosCompra],
                ["Intereses al banco", d.interesesPagados],
                ["Predial, seguro, admin, mantenimiento", d.costosTenencia],
                ["Valor de la casa al final", d.valorCasaFinal],
                ["Saldo del crédito", -d.saldoCreditoFinal],
                ["Gastos de venta", -d.gastosVenta],
                ["Ganancia ocasional", -d.gananciaOcasional]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: T.txt2, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span>{l}</span><span style={{ fontWeight: 600, color: T.txt }}>{fm(v)}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 10 }}>Arrendando e invirtiendo</div>
              {[["Arriendo pagado en total", d.arriendoPagado],
                ["Total aportado al portafolio", d.aportadoAlPortafolio],
                ["Portafolio antes de impuestos", d.portafolioBruto],
                ["Impuesto sobre la utilidad", -d.impuestoPortafolio]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 12, color: T.txt2, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span>{l}</span><span style={{ fontWeight: 600, color: T.txt }}>{fm(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 20, marginBottom: 20, borderLeft: `3px solid ${T.txt3}` }}>
        <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.7 }}>
          <strong style={{ color: T.txt }}>Lo que este cálculo no puede decidir.</strong> Vivir en lo propio
          tiene un valor que no cabe en una hoja de cálculo: no depender de que te renueven el contrato,
          poder remodelar, criar hijos sin trastear. Y arrendar e invertir exige una disciplina que casi
          nadie sostiene veinte años: la casa te obliga a ahorrar, el portafolio no. Este módulo compara
          patrimonio. La decisión es tuya.
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
