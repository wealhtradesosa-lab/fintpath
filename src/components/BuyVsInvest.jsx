// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · BuyVsInvest.jsx — ¿Comprar casa o arrendar e invertir?
//
// La lógica vive entera en src/lib/buyVsInvest.js. Acá solo hay entradas,
// gráfico y lectura del resultado. Esa separación es a propósito: el motor se
// puede verificar con números sin montar la interfaz.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import NumberInput from "./NumberInput";
import PageHeader from "./PageHeader.jsx";
import Disclaimer from "./Disclaimer";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { compararCompraVsInversion, valorizacionDeEquilibrio, BUY_VS_INVEST_DEFAULTS } from "../lib/buyVsInvest.js";

const T = { bg:"#0c0c0f", bg2:"#141418", bg3:"#1e1e24", border:"rgba(255,255,255,0.06)",
  txt:"#fafafa", txt2:"#a1a1aa", txt3:"#71717a", green:"#22c55e", red:"#ef4444",
  blue:"#3b82f6", orange:"#f97316", gold:"#eab308" };

const fm = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
const fmCorto = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(1) + "MM";
  if (Math.abs(v) >= 1e6) return "$" + Math.round(v / 1e6) + "M";
  return "$" + Math.round(v).toLocaleString("es-CO");
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
      <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase",
        letterSpacing: "0.5px", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
      {ayuda && <div style={{ fontSize: 11, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{ayuda}</div>}
    </div>
  );
}

export default function BuyVsInvest() {
  const D = BUY_VS_INVEST_DEFAULTS;
  const [precioCasa, setPrecioCasa] = useState(D.precioCasa);
  const [modoCompra, setModoCompra] = useState("hipoteca");
  const [cuotaInicialPct, setCuotaInicialPct] = useState(D.cuotaInicialPct);
  const [tasaHipotecaEA, setTasaHipotecaEA] = useState(D.tasaHipotecaEA);
  const [plazoHipotecaAnios, setPlazoHipotecaAnios] = useState(D.plazoHipotecaAnios);
  const [valorizacionCasaAnual, setValorizacion] = useState(D.valorizacionCasaAnual);
  const [arriendoMensual, setArriendo] = useState(D.arriendoMensual);
  const [administracionMensual, setAdmin] = useState(D.administracionMensual);
  const [horizonteAnios, setHorizonte] = useState(D.horizonteAnios);
  const [activo, setActivo] = useState("sp500");
  const [cagrCustom, setCagrCustom] = useState(null);
  const [exencion, setExencion] = useState(false);
  const [verSupuestos, setVerSupuestos] = useState(false);

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
    horizonteAnios,
    rendimientoInversionAnual: rendimiento,
    exencionViviendaHabitacion: exencion,
  };

  const r = useMemo(() => compararCompraVsInversion(params), [
    precioCasa, modoCompra, cuotaInicialPct, tasaHipotecaEA, plazoHipotecaAnios,
    valorizacionCasaAnual, arriendoMensual, administracionMensual, horizonteAnios,
    rendimiento, exencion]);

  const equilibrio = useMemo(() => valorizacionDeEquilibrio(params), [
    precioCasa, modoCompra, cuotaInicialPct, tasaHipotecaEA, plazoHipotecaAnios,
    arriendoMensual, administracionMensual, horizonteAnios, rendimiento, exencion]);

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
        label="Decisión"
        title="Comprar o arrendar e invertir"
        subtitle="La misma plata, dos caminos. Los dos escenarios desembolsan exactamente lo mismo cada mes."
      />

      {/* ── RESULTADO ──────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 24, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.6px" }}>🏠 Comprar</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: ganaComprar ? T.green : T.txt, marginTop: 6 }}>
              {fm(r.patrimonioComprar)}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>patrimonio neto a {horizonteAnios} años</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.6px" }}>📈 Arrendar + {activoSel.l}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: !ganaComprar ? T.green : T.txt, marginTop: 6 }}>
              {fm(r.patrimonioArrendar)}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>patrimonio neto a {horizonteAnios} años</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.6px" }}>Diferencia</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.gold, marginTop: 6 }}>
              {fm(Math.abs(r.diferencia))}
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>
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
              empatar con {activoSel.l} al {rendimiento}%. Hoy tenés puesto {valorizacionCasaAnual}%.
            </div>
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 6 }}>
              Comparalo con lo que se ha valorizado la zona en los últimos 10 años. Si es menos, la respuesta ya está dada.
            </div>
          </div>
        )}
      </div>

      {/* ── ENTRADAS ───────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16 }}>🏠 La casa</div>

          <Campo label="Precio de la casa">
            <NumberInput value={precioCasa} onChange={setPrecioCasa} />
          </Campo>

          <Campo label="¿Cómo la comprás?">
            <div style={{ display: "flex", gap: 8 }}>
              {[["hipoteca","Con crédito"],["contado","De contado"]].map(([v,l]) => (
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

          <Campo label="Administración mensual">
            <NumberInput value={administracionMensual} onChange={setAdmin} />
          </Campo>
        </div>

        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 16 }}>📈 Arrendar e invertir</div>

          <Campo label="Arriendo mensual de esa misma casa"
            ayuda="Lo que pagarías por vivir ahí sin comprarla. Sube con el IPC cada año.">
            <NumberInput value={arriendoMensual} onChange={setArriendo} />
          </Campo>

          <Campo label="¿Dónde invertís la diferencia?">
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
            Es mi vivienda de habitación (exención Art. 311-1 ET)
          </label>
        </div>
      </div>

      {/* ── GRÁFICO ────────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, marginBottom: 4 }}>Cómo evoluciona tu patrimonio</div>
        <div style={{ fontSize: 11, color: T.txt3, marginBottom: 16 }}>
          Comprar = valor de la casa menos lo que debés al banco. Sin descontar aún impuestos ni gastos de venta.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={datos}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="anio" stroke="#71717a" fontSize={11}
              label={{ value: "años", position: "insideBottomRight", fill: "#71717a", fontSize: 11 }} />
            <YAxis stroke="#71717a" fontSize={11} tickFormatter={fmCorto} width={70} />
            <Tooltip formatter={(v) => fm(v)} labelFormatter={(l) => `Año ${l}`}
              contentStyle={{ background: "#1e1e24", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Comprar" stroke={T.orange} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={activoSel.l} stroke={T.blue} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── DESGLOSE ───────────────────────────────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
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

      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16,
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
