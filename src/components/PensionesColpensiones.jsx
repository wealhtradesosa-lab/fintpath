import { useState, useMemo } from "react";
import { fmtNumEs, fmtPctEs } from "../lib/formato.js";
import NumberInput from "./NumberInput";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import PageHeader from "./PageHeader.jsx";
import { ChartGradients, ChartTooltip, axisProps, gridProps, CHART, sinCorte, MARGEN_EJE } from "../lib/chartTheme.jsx";
import Disclaimer from "./Disclaimer.jsx";
import { iblProyectado, liquidarPension, tasaReemplazo, pctDescuentoMesada, valeLaPenaSeguir, SEMANAS_POR_AÑO, SEMANAS_MINIMAS, MESADAS_AÑO, TOPE_IBC_SM, TOPE_MINIMO } from "../lib/pensionColpensiones.js";

/* ═══════════════════════════════════════════════════
   MÓDULO PENSIONES COLOMBIA — Cálculo Actuarial
   Ley 100/1993 + Ley 797/2003 + Acto Legislativo 01/2005
   Régimen de Prima Media (Colpensiones) y RAIS (Fondos Privados)
   ═══════════════════════════════════════════════════ */

const T = {
  bg: "var(--fp-bg)", bg2: "var(--fp-card)", bg3: "var(--fp-raised)", bg4: "var(--fp-raised)",
  card: "var(--fp-card)", border: "rgba(var(--fp-ink),0.06)",
  txt: "var(--fp-txt)", txt2: "var(--fp-txt2)", txt3: "var(--fp-txt3)",
  green: "#00c805", greenDim: "rgba(0,200,5,0.1)",
  red: "#ff5000", blue: "#3b82f6", purple: "#3b82f6",
  orange: "#f59e0b", gold: "#f59e0b", cyan: "#94a3b8",
};
const SM_2026 = 1_750_905;
const fCOP = (v) => {
  if (Math.abs(v) >= 1e9) return "$" + fmtNumEs((v / 1e6), 0)+" MM";
  if (Math.abs(v) >= 1e6) return "$" + fmtNumEs((v / 1e6), 1)+" MM";
  return "$" + Math.round(v).toLocaleString("es-CO");
};
const fUSD = (v, trm) => "$" + Math.round(v / (trm || 4200)).toLocaleString("en-US") + " USD";
const pc = (v) => fmtPctEs((v || 0), 1);
const TT = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, color: T.txt, fontSize: 12 };

const Cd = ({ children, style: s, glow }) => (
  <div style={{ background: T.card, border: `1px solid ${glow ? glow + "30" : T.border}`, borderRadius: 12, overflow: "hidden", ...(glow ? { boxShadow: `0 0 20px ${glow}08` } : {}), ...s }}>{children}</div>
);
const Row = ({ l, v, color, bold, sub }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
    <div><span style={{ fontSize: 14, color: T.txt2 }}>{l}</span>{sub && <div style={{ fontSize: 12, color: T.txt3 }}>{sub}</div>}</div>
    <span style={{ fontSize: 14, fontWeight: bold ? 700 : 600, color: color || T.txt, fontFamily: "monospace" }}>{v}</span>
  </div>
);
// 04-nov-2026 (Santiago: "todo está desalineado"): el rótulo ocupa siempre el
// mismo alto (dos líneas) y el texto de ayuda va debajo con el mismo margen, así
// las cajas quedan en una sola línea aunque un rótulo sea más largo que otro.
const LABEL = { fontSize: 12, fontWeight: 600, color: T.txt2, display: "flex", alignItems: "flex-end", minHeight: 34, marginBottom: 6, lineHeight: 1.4 };
const AYUDA = { fontSize: 12, color: T.txt3, marginTop: 6, lineHeight: 1.5 };
const In = ({ label, value, onChange, unit, min, max, step }) => {
  const isMonetary = unit === "COP" || unit === "$/mes" || unit === "$/año";
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {isMonetary
          ? <NumberInput value={value} onChange={(v) => onChange(v === "" ? 0 : Number(v) || 0)}
              style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none" }} />
          : <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
              min={min} max={max} step={step || 1}
              style={{ flex: 1, background: T.bg3, border: `1px solid ${T.border}`, color: T.txt, padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none" }} />}
        {unit && <span style={{ fontSize: 12, color: T.txt3, width: 56, flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   CÁLCULOS ACTUARIALES
   ═══════════════════════════════════════════════════ */

// Régimen de Prima Media — Colpensiones
// 04-nov-2026: el cálculo vive en lib/pensionColpensiones.js (validado contra el
// análisis actuarial de Destina PFT). Aquí solo se adapta a la pantalla.
// `aniosMas` = años que se sigue cotizando desde hoy (0 = parar hoy): suma
// semanas a 51,43 por año y corre la ventana de 10 años del IBL.
function calcColpensiones({ sexo, edad, semanasActuales, ibcSM, ibcFuturo, iblProm, edadJub, aniosMas = 0 }) {
  const IBC = ibcSM * SM_2026;
  const aniosFaltantes = Math.max(0, edadJub - edad);
  const iblHoy = iblProm > 0 ? iblProm : IBC;
  const ibcSiguiente = ibcFuturo > 0 ? ibcFuturo : IBC;
  const IBL = iblProyectado({ iblHoy, ibcFuturo: Math.min(ibcSiguiente, TOPE_IBC_SM * SM_2026), años: aniosMas });
  const semanasTotales = Math.round(semanasActuales + Math.max(0, aniosMas) * SEMANAS_POR_AÑO);
  const r = liquidarPension({ ibl: IBL, semanas: semanasTotales, sm: SM_2026 });
  const pensionFinal = r.neta;
  return {
    IBC, IBL,
    tasaBase: r.tasa.base, bonusSemanas: r.tasa.bonus, tasaTotal: r.tasa.total, tasaTope: r.tasa.tope, recortadaPorTope: r.tasa.recortadaPorTope,
    pensionBruta: IBL * r.tasa.total / 100, pensionTope: TOPE_IBC_SM * SM_2026, pensionAplicada: r.bruta,
    descuentoSalud: r.descuento, pensionNeta: r.neta, pensionFinal,
    semanasTotales, semanasExtra: Math.round(r.tasa.semanasExtra), semanasQueFaltan: Math.max(0, Math.ceil(SEMANAS_MINIMAS - semanasTotales)),
    bloques50: r.tasa.bloques, pctDescuento: r.pctDescuento,
    cumpleSemanas: r.cumple, cumpleRequisitos: r.cumple,
    aniosFaltantes, mesesFaltantes: aniosFaltantes * 12,
    total20Anios: pensionFinal * MESADAS_AÑO * 20, // 13 mesadas al año
    edadJub, pensionMinima: SM_2026,
  };
}

function calcRAIS({ saldoActual, ibcSM, rendAnual, aniosCotizar, aportesVolMes, bonoPensional, sexo, ibcFuturo }) {
  const IBC = ibcSM * SM_2026;

  // ═══ APORTE REAL AL AHORRO INDIVIDUAL ═══
  // Total cotización: 16% del IBC
  // Pero NO todo va a la cuenta individual:
  //   - 11.5% → cuenta de ahorro individual (lo que crece)
  //   - 1.5%  → Fondo Garantía Pensión Mínima
  //   - 3.0%  → Administración + seguros
  const aporteTotal = IBC * 0.16;
  const ibcEfectivo = ibcFuturo > 0 ? ibcFuturo : IBC;
  const aporteMes = ibcEfectivo * 0.115; // Solo lo que va a la cuenta
  const comisionMes = IBC * 0.03; // Lo que cobra la AFP
  const fondoGarantia = IBC * 0.015;

  const rendMes = Math.pow(1 + rendAnual / 100, 1 / 12) - 1;

  let saldo = saldoActual + (bonoPensional || 0);
  const proyeccion = [];
  for (let y = 1; y <= aniosCotizar; y++) {
    for (let m = 0; m < 12; m++) {
      saldo = saldo * (1 + rendMes) + aporteMes + (aportesVolMes || 0);
    }
    proyeccion.push({ anio: y, saldo: Math.round(saldo) });
  }

  // ═══ MODALIDADES DE PENSIÓN ═══

  // 1. RETIRO PROGRAMADO
  // Saldo queda en la AFP, se recalcula cada año
  // Esperanza de vida hombre 62 años: ~20.7 años (tabla RV08)
  // Rendimiento real durante retiro: ~4% anual
  // Tabla RV08 Superfinanciera — esperanza de vida según sexo
  // Hombre 62 años: 20.7 años | Mujer 57 años: 27.3 años
  const esperanzaVida = sexo === "F" ? 27.3 : 20.7; // Tabla RV08 por sexo
  const mesesVida = Math.round(esperanzaVida * 12);
  const rRetiro = Math.pow(1.04, 1/12) - 1;
  const factorRP = rRetiro > 0 ? (1 - Math.pow(1 + rRetiro, -mesesVida)) / rRetiro : mesesVida;
  const retiroProgramado = saldo / factorRP;

  // 2. RENTA VITALICIA
  // Se transfiere saldo a aseguradora, pago fijo de por vida
  // Aseguradora usa tasa más conservadora (~3%) y esperanza 22 años
  // Resultado: ~15-20% menos que retiro programado
  // Renta vitalicia: aseguradora usa esperanza más conservadora
  const esperanzaVitalicia = esperanzaVida + 2; // +2 años margen aseguradora
  const mesesVitalicia = Math.round(esperanzaVitalicia * 12);
  const rVitalicia = Math.pow(1.03, 1/12) - 1;
  const factorRV = rVitalicia > 0 ? (1 - Math.pow(1 + rVitalicia, -mesesVitalicia)) / rVitalicia : mesesVitalicia;
  const rentaVitalicia = saldo / factorRV;

  // Pensión mínima garantizada: si cualquier modalidad < 1 SMMLV,
  // el Fondo de Garantía complementa hasta el mínimo
  const pensionMinima = SM_2026;
  const retiroFinal = Math.max(retiroProgramado, pensionMinima);
  const rentaFinal = Math.max(rentaVitalicia, pensionMinima);

  return {
    saldoFinal: saldo,
    aporteTotal,
    aporteMes,
    comisionMes,
    fondoGarantia,
    totalAportado: aporteMes * 12 * aniosCotizar + saldoActual,
    totalComisiones: comisionMes * 12 * aniosCotizar,
    rendimiento: saldo - (aporteMes * 12 * aniosCotizar + saldoActual),
    retiroProgramado: retiroFinal,
    rentaVitalicia: rentaFinal,
    rentaMes: retiroFinal, // Default to retiro programado
    proyeccion,
    heredable: true,
    factorRP: factorRP.toFixed(1),
    factorRV: factorRV.toFixed(1),
  };
}

export default function PensionesColpensiones({ trm, pensionGuardada, onGuardarPension }) {
  const [sexo, setSexo] = useState("M");
  const [edad, setEdad] = useState(40);
  const [semanas, setSemanas] = useState(800);
  const [ibcSM, setIbcSM] = useState(10);
  const [iblPromSM, setIblPromSM] = useState(0); // Promedio últimos 10 años (0 = usar IBC actual)
  const [ibcFuturoSM, setIbcFuturoSM] = useState(0); // 0 = igual al actual
  const [ipc, setIpc] = useState(5.5);
  const [privSaldo, setPrivSaldo] = useState(200_000_000);
  const [privRend, setPrivRend] = useState(8);
  const [aportesVol, setAportesVol] = useState(0); // Aportes voluntarios mensuales
  const [bonoPensional, setBonoPensional] = useState(0); // Bono si se trasladó
  const [tab, setTab] = useState("colp");
  const [showAvanzado, setShowAvanzado] = useState(false); // colp | rais | comparar

  const edadJub = sexo === "F" ? 57 : 62;
  const aniosFaltantes = Math.max(0, edadJub - edad);

  const colp = useMemo(() => calcColpensiones({
    sexo, edad, semanasActuales: semanas, ibcSM, ibcFuturo: ibcFuturoSM > 0 ? ibcFuturoSM * SM_2026 : 0, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, ipc, edadJub,
  }), [sexo, edad, semanas, ibcSM, ibcFuturoSM, iblPromSM, ipc, edadJub]);

  const colpJub = useMemo(() => calcColpensiones({
    sexo, edad, semanasActuales: semanas, aniosMas: aniosFaltantes, ibcSM, ibcFuturo: ibcFuturoSM > 0 ? ibcFuturoSM * SM_2026 : 0, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, ipc, edadJub,
  }), [sexo, edad, semanas, ibcSM, ibcFuturoSM, iblPromSM, ipc, edadJub, aniosFaltantes]);

  // ¿Vale la pena seguir cotizando hasta la edad de pensión? (incremental vs parar hoy)
  const valeLaPena = useMemo(() => aniosFaltantes > 0 ? valeLaPenaSeguir({
    sexo, edad, semanasHoy: semanas, iblHoy: iblPromSM > 0 ? iblPromSM * SM_2026 : ibcSM * SM_2026,
    ibcSM: ibcFuturoSM > 0 ? ibcFuturoSM : ibcSM, años: aniosFaltantes, sm: SM_2026,
  }) : null, [sexo, edad, semanas, iblPromSM, ibcSM, ibcFuturoSM, aniosFaltantes]);

  const rais = useMemo(() => calcRAIS({
    saldoActual: privSaldo, ibcSM: ibcFuturoSM > 0 ? ibcFuturoSM : ibcSM, rendAnual: privRend, aniosCotizar: aniosFaltantes, aportesVolMes: aportesVol, bonoPensional, sexo, ibcFuturo: ibcFuturoSM > 0 ? ibcFuturoSM * SM_2026 : 0,
  }), [privSaldo, ibcSM, ibcFuturoSM, privRend, aniosFaltantes, aportesVol, bonoPensional, sexo]);

  const tabs = [
    { id: "colp", icon: "", label: "Colpensiones" },
    { id: "rais", icon: "", label: "Fondo Privado" },
    { id: "comparar", icon: "", label: "Comparar" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        label="Pensiones"
        title="Cálculo actuarial"
        subtitle={`Ley 100/1993 · Ley 797/2003 · SMMLV 2026: ${fCOP(SM_2026)}`}
        rightSlot={<button onClick={() => { document.body.setAttribute("data-date", new Date().toLocaleDateString("es-CO")); window.print(); }} style={{ background: T.blue, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>Exportar PDF</button>}
      />

            <div style={{ padding: "10px 14px", marginBottom: 16, borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", color: T.txt2, fontSize: 13, lineHeight: 1.5 }}>
        <strong style={{ color: T.gold }}>Simulación Ley 100 (legado).</strong>{" "}
        Esta pantalla modela Colpensiones/RAIS bajo Ley 100/1993 y normas relacionadas.
        La reforma de pilares (Ley 2381) aún no está modelada aquí.
      </div>

{/* ═══ PERFIL ═══ */}
      <Cd style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Tu información</h3>
        <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>Datos básicos para calcular tu pensión estimada</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, alignItems: "start" }}>
          <div>
            <label style={LABEL}>Sexo</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ v: "M", l: "Hombre", c: T.blue }, { v: "F", l: "Mujer", c: "#64748b" }].map((g) => (
                <button key={g.v} onClick={() => setSexo(g.v)} style={{
                  flex: 1, padding: "10px 12px", borderRadius: 8,
                  border: `2px solid ${sexo === g.v ? g.c : T.border}`,
                  background: sexo === g.v ? g.c + "15" : T.bg3,
                  color: sexo === g.v ? g.c : T.txt2, cursor: "pointer", fontWeight: 600, fontSize: 14,
                }}>{g.l}</button>
              ))}
            </div>
            <div style={AYUDA}>Te pensionas a los {edadJub} años</div>
          </div>

          <div>
            <In label="Edad" value={edad} onChange={setEdad} unit="años" min={18} max={70} />
            <div style={AYUDA}>Te faltan <strong style={{color: T.blue}}>{aniosFaltantes} años</strong> para pensionarte</div>
          </div>

          <div>
            <In label="Semanas cotizadas" value={semanas} onChange={setSemanas} unit="semanas" min={0} max={3000} />
            <div style={AYUDA}>Salen de tu historia laboral. {semanas >= 1300 ? <span style={{color:T.green}}>Cumples el mínimo</span> : <span style={{color:T.orange}}>Necesitas {fmtNumEs(1300-semanas, 0)} más</span>}</div>
            {/* Régimen de transición de la reforma (Ley 2381/2024): con menos de 900
                semanas (hombres) o 750 (mujeres) aplican las reglas nuevas, en las que
                Colpensiones solo cubre hasta 2,3 SMMLV. Este cálculo usa la Ley 100. */}
            {semanas < (sexo === "F" ? 750 : 900) && <div style={{ fontSize: 11, color: T.orange, marginTop: 4, lineHeight: 1.5 }}>Con menos de {sexo === "F" ? 750 : 900} semanas te pueden aplicar las reglas de la reforma pensional, donde Colpensiones cubre hasta 2,3 salarios mínimos y el resto va a ahorro individual. Este cálculo usa las reglas de la Ley 100.</div>}
          </div>

          <div>
            <In label="Salarios mínimos sobre los que cotizas (IBC)" value={ibcSM} onChange={(v) => setIbcSM(Math.min(25, Math.max(1, v)))} unit="SMMLV" min={1} max={25} step={0.5} />
            <div style={AYUDA}><strong style={{ color: T.txt2 }}>Máximo 25</strong> (tope legal). {fmtNumEs(ibcSM, ibcSM % 1 ? 1 : 0)} = {fCOP(ibcSM * SM_2026)}/mes; a pensión van {fCOP(ibcSM * SM_2026 * 0.16)}/mes. Lo ves en tu planilla PILA.</div>
          </div>
        </div>
      </Cd>

      {/* ═══ FONDO PRIVADO ═══ */}
      <Cd style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Tu fondo privado</h3>
        <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>Si estás en un fondo como Porvenir, Protección, Colfondos o Skandia</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, alignItems: "start" }}>
          <div>
            <In label="¿Cuánto tienes ahorrado?" value={privSaldo} onChange={setPrivSaldo} unit="COP" min={0} step={1000000} />
            <div style={AYUDA}>Consulta tu extracto del fondo</div>
          </div>
          <div>
            <In label="Rendimiento esperado anual" value={privRend} onChange={setPrivRend} unit="%" min={0} max={20} step={0.5} />
            <div style={AYUDA}>Promedio histórico fondos Colombia: 7-10%</div>
          </div>
        </div>
      </Cd>

      {/* ═══ RESUMEN RÁPIDO ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <Cd glow={colpJub.pensionFinal >= rais.retiroProgramado ? T.green : null} style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.txt3 }}>Colpensiones</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.green, margin: "8px 0" }}>{fCOP(colpJub.pensionFinal)}<span style={{fontSize:12,fontWeight:400,color:T.txt3}}>/mes</span></div>
          <div style={{ fontSize: 12, color: T.txt3 }}>Pensión de por vida</div>
          {colpJub.pensionFinal >= rais.retiroProgramado && <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginTop: 4 }}>Te conviene más</div>}
        </Cd>
        <Cd glow={rais.retiroProgramado > colpJub.pensionFinal ? T.green : null} style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.txt3 }}>Fondo privado</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.blue, margin: "8px 0" }}>{fCOP(rais.retiroProgramado)}<span style={{fontSize:12,fontWeight:400,color:T.txt3}}>/mes</span></div>
          <div style={{ fontSize: 12, color: T.txt3 }}>Retiro programado • Saldo: {fCOP(rais.saldoFinal)}</div>
          {rais.retiroProgramado > colpJub.pensionFinal && <div style={{ fontSize: 12, color: T.green, fontWeight: 600, marginTop: 4 }}>Te conviene más</div>}
        </Cd>
      </div>

      {/* ═══ AFINAR PROYECCIÓN (colapsable) ═══ */}
      <Cd style={{ marginBottom: 20 }}>
        <button onClick={() => setShowAvanzado(!showAvanzado)} style={{ width: "100%", padding: "14px 24px", background: "transparent", border: "none", color: T.txt2, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Afinar proyección</span>
          <span style={{ fontSize: 18 }}>{showAvanzado ? "▲" : "▼"}</span>
        </button>
        {showAvanzado && (
          <div style={{ padding: "0 24px 24px" }}>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>Ajustes opcionales para mayor precisión. Si no estás seguro, déjalos como están.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <In label="¿Piensas subir tu cotización antes de pensionarte? (IBC futuro)" value={ibcFuturoSM} onChange={setIbcFuturoSM} unit="SMMLV" min={0} max={25} step={0.5} />
                <div style={AYUDA}>
                  {ibcFuturoSM > 0 && ibcFuturoSM !== ibcSM
                    ? <>Proyección: cotizarás sobre {ibcFuturoSM} SMMLV ({fCOP(ibcFuturoSM * SM_2026)}/mes) los próximos {aniosFaltantes} años</>
                    : <>Déjalo en 0 si planeas seguir cotizando igual</>}
                </div>
                {ibcFuturoSM > 0 && ibcFuturoSM > ibcSM * 2 && <div style={{ fontSize: 12, color: T.orange, marginTop: 4 }}>Un salto de más del doble puede ser revisado por la UGPP. Mejor aumentar gradualmente.</div>}
              </div>
              <div>
                <In label="¿Sobre cuántos SMMLV cotizabas en promedio los últimos 10 años? (IBL)" value={iblPromSM} onChange={setIblPromSM} unit="SMMLV" min={0} max={25} step={0.5} />
                <div style={AYUDA}>{iblPromSM > 0 ? "Promedio: " + fCOP(iblPromSM * SM_2026) + "/mes" : "Déjalo en 0 si siempre has cotizado parecido"}</div>
              </div>
              <div>
                <In label="¿Aportas voluntario a pensión?" value={aportesVol} onChange={setAportesVol} unit="$/mes" min={0} step={100000} />
                <div style={AYUDA}>Solo aplica para fondo privado. Aumenta tu ahorro y tu pensión.</div>
              </div>
              <div>
                <In label="¿Te cambiaste de fondo alguna vez? (bono pensional)" value={bonoPensional} onChange={setBonoPensional} unit="COP" min={0} step={1000000} />
                <div style={AYUDA}>Si te trasladaste de Colpensiones a fondo privado, tienes un bono. Si nunca te cambiaste, déjalo en $0.</div>
              </div>
            </div>
          </div>
        )}
      </Cd>



      {/* ═══ RESUMEN CALCULADO ═══ */}
      <div style={{ padding: 14, background: T.bg3, borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: T.txt2, marginBottom: 20 }}>
        <span><strong>Jubilación:</strong> {edadJub} años</span>
        <span><strong>Faltan:</strong> {aniosFaltantes} años</span>
        <span><strong>Salario:</strong> {fCOP(ibcSM * SM_2026)}/mes</span>
        <span><strong>Aporte:</strong> {fCOP(ibcSM * SM_2026 * 0.16)}/mes</span>
        <span><strong>Semanas al jubilarse:</strong> {colpJub.semanasTotales.toLocaleString("es-CO")}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map((t) => {
          const a = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 24px", borderRadius: 10,
              border: `1px solid ${a ? T.blue : T.border}`,
              background: a ? T.blue + "15" : "transparent",
              color: a ? T.blue : T.txt3, cursor: "pointer", fontSize: 14, fontWeight: a ? 700 : 500,
            }}>{t.icon} {t.label}</button>
          );
        })}
      </div>

      {/* ═══ COLPENSIONES ═══ */}
      {tab === "colp" && (
        <div>
          {/* Requisitos */}
          <Cd style={{ padding: 20, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Requisitos de Pensión — Colpensiones</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { l: "Edad mínima", v: edadJub + " años", ok: edad >= edadJub, actual: edad + " años" },
                { l: "Semanas mínimas", v: "1,300 sem", ok: colp.semanasTotales >= 1300, actual: colp.semanasTotales + " sem" },
                { l: "Estado", v: colp.cumpleRequisitos ? "Cumple" : "En proceso", ok: colp.cumpleRequisitos, actual: colp.cumpleRequisitos ? "Listo" : `Faltan ${colp.semanasQueFaltan} sem` },
              ].map((r) => (
                <div key={r.l} style={{ background: r.ok ? T.greenDim : T.bg3, border: `1px solid ${r.ok ? T.green + "20" : T.border}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: T.txt3, marginBottom: 4 }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: r.ok ? T.green : T.txt }}>{r.v}</div>
                  <div style={{ fontSize: 12, color: r.ok ? T.green : T.txt3, marginTop: 4 }}>Tú: {r.actual}</div>
                </div>
              ))}
            </div>
          </Cd>

          {/* Cálculo detallado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Cd style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.blue, marginBottom: 14 }}>Cálculo de la Pensión</h3>
              <Row l="IBC (Ingreso Base de Cotización)" v={fCOP(colp.IBC)} color={T.txt} />
              <Row l="IBL (Ingreso Base de Liquidación)" v={fCOP(colp.IBL)} color={T.blue} sub="Promedio últimos 10 años ajustado IPC" />
              <Row l="IBL en SMMLV" v={(colp.IBL / SM_2026).toFixed(1) + " SMMLV"} />
              <Row l="Tasa base de reemplazo" v={pc(colp.tasaBase)} sub="Ley 797/2003: 65.5% - 0.5% por SMMLV" />
              <Row l="Bonus semanas extra" v={"+" + pc(colp.bonusSemanas)} color={T.green} sub={colp.semanasExtra + " semanas extras × 1.5% / 50 sem"} />
              <Row l="Tasa total de reemplazo" v={pc(colp.tasaTotal)} color={T.blue} bold />
              <Row l="Pensión bruta" v={fCOP(colp.pensionBruta)} color={T.txt} />
              <Row l="Tope máximo (25 SMMLV)" v={fCOP(colp.pensionTope)} />
              <Row l="Pensión aplicada" v={fCOP(colp.pensionAplicada)} bold />
              <Row l={"Descuento salud 12 %" + (colp.pctDescuento > 0.12 ? " + solidaridad " + fmtPctEs((colp.pctDescuento - 0.12) * 100, 1) : "")} v={"-" + fCOP(colp.descuentoSalud)} color={T.red} />
            </Cd>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* RESULTADO PRINCIPAL */}
              <Cd glow={T.blue} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.txt3, letterSpacing: "0.1em" }}>Tu Pensión Mensual Neta</div>
                <div style={{ fontSize: 48, fontWeight: 700, color: T.blue, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(colp.pensionFinal)}</div>
                <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>Si paras de cotizar hoy</div>
                {aniosFaltantes > 0 && <div style={{ borderTop: "1px solid " + T.border, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 12, color: T.txt3 }}>Al jubilarte ({edad + aniosFaltantes} años)</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: T.green, letterSpacing: "-0.04em", marginTop: 4 }}>{fCOP(colpJub.pensionFinal)}</div>
                  <div style={{ fontSize: 12, color: T.txt2, marginTop: 2 }}>Tasa: {pc(colpJub.tasaTotal)} • {colpJub.semanasTotales.toLocaleString("es-CO")} semanas</div>
                </div>}
                {/* 04-nov-2026: se guarda para usarla en Ahorro en Bitcoin y en los
                    planes sin volver a calcularla. */}
                {onGuardarPension && colpJub.pensionFinal > 0 && (() => {
                  const yaGuardada = pensionGuardada && Math.round(pensionGuardada.neta) === Math.round(colpJub.pensionFinal);
                  return (
                    <button type="button" disabled={yaGuardada} onClick={() => onGuardarPension({
                      neta: Math.round(colpJub.pensionFinal), bruta: Math.round(colpJub.pensionAplicada), tasa: colpJub.tasaTotal,
                      semanas: colpJub.semanasTotales, edadPension: edadJub, edadHoy: edad, ibcSM, fecha: new Date().toISOString().slice(0, 10), fuente: "calculadora",
                    })} style={{ marginTop: 14, padding: "8px 16px", borderRadius: 999, border: `1px solid ${yaGuardada ? T.border : T.blue}`, background: yaGuardada ? "transparent" : T.blue, color: yaGuardada ? T.txt3 : "#fff", fontSize: 13, fontWeight: 600, cursor: yaGuardada ? "default" : "pointer" }}>
                      {yaGuardada ? "Guardada como tu pensión" : "Guardar como mi pensión"}
                    </button>
                  );
                })()}
                <div style={{ fontSize: 14, color: T.txt3, marginTop: 8 }}>≈ {fUSD(colp.pensionFinal, trm)}</div>
                <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Tasa de reemplazo: <strong style={{ color: T.blue }}>{pc(colp.tasaTotal)}</strong></div>
              </Cd>

              {/* Métricas adicionales */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Cd style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.txt3 }}>EN 20 AÑOS</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>{fCOP(colp.total20Anios)}</div>
                </Cd>
                <Cd style={{ padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: T.txt3 }}>PENSIÓN MÍNIMA</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.green }}>{fCOP(SM_2026)}</div>
                </Cd>
              </div>

              {/* Alertas */}
              <Cd style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Consideraciones</div>
                {[
                  { t: "No heredable — al fallecer se pierde (excepto sustitución pensional)", c: T.red },
                  { t: "Sujeta a reformas pensionales futuras", c: T.orange },
                  { t: "13 mesadas al año; ya pensionado se reajusta por IPC (la pensión mínima, por salario mínimo)", c: T.green },
                  { t: "Garantía estatal — respaldada por el gobierno", c: T.blue },
                  colp.cumpleRequisitos ? { t: "Cumples requisitos de edad y semanas", c: T.green } : { t: `Faltan ${aniosFaltantes} años y ${Math.max(0, 1300 - semanas)} semanas`, c: T.orange },
                ].map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: a.c, padding: "4px 0", borderBottom: i < 4 ? `1px solid ${T.border}` : "none" }}>
                    {a.t}
                  </div>
                ))}
              </Cd>
            </div>
          </div>

          {/* ═══ HITOS DE SEMANAS — Como un actuario ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 6 }}>Hitos de Semanas — ¿Cuánto ganas por seguir cotizando?</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 8px" }}>
              Por cada <strong>50 semanas</strong> completas después de 1.300 → tu tasa sube <strong>1,5 %</strong>. Tope para tu nivel de ingreso: <strong>{pc(colp.tasaTope)}</strong> (80 % en ingresos bajos, {TOPE_MINIMO} % en los altos).
            </p>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>
              Con IBL topado en 25 SMMLV, cada bloque de 50 semanas agrega ~<strong>{fCOP(colp.IBL * 0.015)}</strong>/mes a tu pensión.
            </p>

            {/* Milestone table like an actuary would show */}
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Semanas","Extras","Bloques×50","Bonus","Tasa total","Pensión bruta","Neta","Estado"].map(h => (
                      <th key={h} style={{ padding: "8px 6px", textAlign: h === "Estado" ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 11, borderBottom: "2px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1300,1350,1400,1450,1500,1550,1600,1650,1700,1750,1800,1850,1900,1950,2000,2100,2150].map(sem => {
                    const lq = liquidarPension({ ibl: colp.IBL, semanas: sem, sm: SM_2026 });
                    const extras = Math.max(0, sem - 1300);
                    const bloques = lq.tasa.bloques;
                    const bonus = lq.tasa.bonus;
                    const tasaT = lq.tasa.total;
                    const bruta = lq.bruta;
                    const neta = lq.neta;
                    const esActual = Math.abs(sem - colp.semanasTotales) < 25;
                    const esAlcanzable = sem <= colpJub.semanasTotales;
                    const yaAlcanzo = sem <= colp.semanasTotales;
                    const esTope = lq.tasa.recortadaPorTope || tasaT >= lq.tasa.tope;
                    return (
                      <tr key={sem} style={{ background: esActual ? T.blue + "15" : esTope ? T.green + "08" : "transparent", borderBottom: "1px solid " + T.border }}>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: esActual ? 800 : 600, color: esActual ? T.blue : T.txt }}>{sem.toLocaleString("es-CO")}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.txt3 }}>{extras > 0 ? "+" + extras : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.green }}>{bloques}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", color: T.green, fontWeight: 600 }}>+{fmtPctEs(bonus, 1)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, color: esTope ? T.green : T.blue, fontSize: 13 }}>{fmtPctEs(tasaT, 1)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: "monospace" }}>{fCOP(bruta)}</td>
                        <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: T.blue }}>{fCOP(neta)}</td>
                        <td style={{ padding: "8px 6px", fontSize: 12, color: yaAlcanzo ? T.green : esAlcanzable ? T.orange : T.txt3 }}>
                          {esActual ? "← Tú estás aquí" : yaAlcanzo ? "Ya alcanzado" : esAlcanzable ? "Alcanzable" : esTope ? "Tope " + pc(lq.tasa.tope) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Cd>

          {/* ═══ ANÁLISIS ACTUARIAL ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>Análisis Actuarial — ¿Vale la pena seguir cotizando?</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 8 }}>Tu situación actual</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                    Semanas cotizadas: <strong>{semanas.toLocaleString("es-CO")}</strong><br/>
                    Semanas al jubilarte: <strong>{colp.semanasTotales.toLocaleString("es-CO")}</strong><br/>
                    Semanas extras (sobre 1,300): <strong>{colp.semanasExtra}</strong><br/>
                    Bloques de 50: <strong>{Math.floor(colp.semanasExtra / 50)}</strong><br/>
                    Tasa actual: <strong style={{ color: T.blue }}>{pc(colp.tasaTotal)}</strong><br/>
                    Pensión proyectada: <strong style={{ color: T.blue }}>{fCOP(colp.pensionFinal)}/mes</strong>
                  </div>
                </div>
                {/* 04-nov-2026: análisis incremental contra parar hoy. Antes: costo de un año
                    contra 1,5 % × 12 × 20 sin descontar, que inflaba el retorno. Cuenta solo
                    lo que la decisión cambia: pensión 16 % + solidaridad (la salud se paga
                    igual) contra la DIFERENCIA de mesada neta, 13 mesadas, en pesos de hoy. */}
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 8 }}>Cotizar hasta los {edadJub} vs parar hoy</div>
                  {valeLaPena ? (
                    <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                      Pagas: <strong>{fCOP(valeLaPena.costoMes)}/mes</strong> ({fmtPctEs(valeLaPena.pctCosto * 100, 1)} del IBC: pensión + solidaridad; la salud la pagas igual)<br/>
                      Durante {fmtNumEs(aniosFaltantes, 1)} años: <strong>{fCOP(valeLaPena.costoTotal)}</strong><br/><br/>
                      Tu mesada neta pasa de {fCOP(valeLaPena.parar.neta)} a <strong style={{ color: T.green }}>{fCOP(valeLaPena.seguir.neta)}</strong><br/>
                      Ganas <strong style={{ color: T.green }}>+{fCOP(valeLaPena.beneficioMesNeto)}/mes</strong> × 13 mesadas, de por vida<br/><br/>
                      Recuperas lo pagado en <strong>{Number.isFinite(valeLaPena.paybackAños) ? fmtNumEs(valeLaPena.paybackAños, 1) + " años" : "—"}</strong> de pensión<br/>
                      Rentabilidad real: <strong style={{ color: valeLaPena.tirAnual > 4 ? T.green : T.orange }}>{valeLaPena.tirAnual != null && Number.isFinite(valeLaPena.tirAnual) ? fmtPctEs(valeLaPena.tirAnual, 1) + " al año" : "—"}</strong>
                      <div style={{ fontSize: 11, color: T.txt3, marginTop: 6 }}>Sobre inflación, con esperanza de vida de {fmtNumEs(valeLaPena.mesesBeneficio / 12, 1)} años al pensionarte. Compárala con lo que te rendiría esa plata invertida.</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.txt2 }}>Ya tienes la edad de pensión.</div>
                  )}
                </div>
              </div>
              <div>
                <div style={{ background: T.bg3, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>Para llegar a tu tope ({pc(colp.tasaTope)})</div>
                  {(() => {
                    const tasaActual = colp.tasaTotal;
                    const falta = Math.max(0, colp.tasaTope - tasaActual);
                    const bloquesNecesarios = Math.ceil(falta / 1.5);
                    const semanasNecesarias = bloquesNecesarios * 50;
                    const aniosNecesarios = fmtNumEs(semanasNecesarias / SEMANAS_POR_AÑO, 1);
                    const pensionAl80 = liquidarPension({ ibl: colp.IBL, semanas: colp.semanasTotales + semanasNecesarias, sm: SM_2026 }).neta;
                    return (
                      <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.8 }}>
                        Te falta: <strong style={{ color: T.orange }}>{pc(falta)}</strong> para llegar a tu tope<br/>
                        Necesitas: <strong>{bloquesNecesarios} bloques</strong> × 50 = <strong>{semanasNecesarias.toLocaleString("es-CO")} semanas</strong><br/>
                        Equivale a: <strong>~{aniosNecesarios} años</strong> más cotizando<br/><br/>
                        Pensión en el tope: <strong style={{ color: T.green }}>{fCOP(pensionAl80)}/mes</strong><br/>
                        vs tu actual: {fCOP(colp.pensionFinal)}/mes<br/>
                        Diferencia: <strong style={{ color: T.green }}>+{fCOP(pensionAl80 - colp.pensionFinal)}/mes</strong>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ background: "linear-gradient(135deg, rgba(0,200,5,0.08), rgba(59,130,246,0.05))", border: "1px solid " + T.green + "20", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 8 }}>Recomendación actuarial</div>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
                    {colp.tasaTotal >= colp.tasaTope - 3 ? (
                      <span>Estás muy cerca del tope. <strong style={{ color: T.green }}>Sigue cotizando al tope de 25 SMMLV</strong> hasta alcanzar tu tope. La diferencia es significativa.</span>
                    ) : colp.tasaTotal >= 65 ? (
                      <span>Tu tasa es buena. Cada año adicional agrega ~{fCOP(colp.IBL * 0.015 * (1 - colp.pctDescuento))}/mes a tu pensión. <strong style={{ color: T.blue }}>Vale la pena seguir al tope si puedes.</strong></span>
                    ) : colp.tasaTotal >= 55 ? (
                      <span>Tu tasa está en el rango base. <strong style={{ color: T.orange }}>Cada 50 semanas extras son valiosas</strong> — no dejes de cotizar si puedes mantener el IBC alto.</span>
                    ) : (
                      <span style={{ color: T.orange }}>Aún no cumples los requisitos mínimos. Enfócate en llegar a 1,300 semanas.</span>
                    )}
                    <br/><br/>
                    <strong>Regla clave:</strong> No sobrecotizar por encima de 25 SMMLV agregados. No baja beneficio. Mantener el IBC al tope es lo que importa.
                  </div>
                </div>
              </div>
            </div>
          </Cd>

          {/* ═══ ESCENARIOS: SI SIGO PAGANDO X AÑOS MÁS ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 6 }}>¿Qué pasa si sigo cotizando X años más?</h3>
            <p style={{ fontSize: 12, color: T.txt3, margin: "0 0 16px" }}>
              Hoy tienes <strong style={{ color: T.blue }}>{semanas.toLocaleString("es-CO")} semanas</strong>. Cada año sumas ~51,4 semanas (Colpensiones cuenta 360 días ÷ 7). Mira cómo cambia tu pensión:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Si pago...","Tendrás","Semanas","Extras","Bloques","Tasa","Pensión neta","Ganas vs hoy","En 20 años"].map(h => (
                      <th key={h} style={{ padding: "10px 8px", textAlign: h === "Si pago..." ? "left" : "right", color: T.txt3, fontWeight: 600, fontSize: 11, borderBottom: "2px solid " + T.border, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const base = { sexo, edad, semanasActuales: semanas, ibcSM, ibcFuturo: ibcFuturoSM > 0 ? ibcFuturoSM * SM_2026 : 0, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, edadJub };
                    const hoy = calcColpensiones(base);
                    const aniosArr = [0, 1, 2, 3, 5, 7, 10, 15, Math.max(0, edadJub - edad)].filter((v, i, a) => v >= 0 && a.indexOf(v) === i).sort((a, b) => a - b);
                    return aniosArr.map(a => {
                      const sc = calcColpensiones({ ...base, aniosMas: a });
                      const semFuturas = sc.semanasTotales;
                      const diff = sc.pensionFinal - hoy.pensionFinal;
                      const esHoy = a === 0;
                      const esJub = a === Math.max(0, edadJub - edad);
                      const total20 = sc.pensionFinal * MESADAS_AÑO * 20;
                      return (
                        <tr key={a} style={{ background: esJub ? T.blue + "10" : esHoy ? T.bg3 : "transparent", borderBottom: "1px solid " + T.border }}>
                          <td style={{ padding: "10px 8px", fontWeight: 700, color: esJub ? T.blue : esHoy ? T.orange : T.txt }}>
                            {esHoy ? "Paro hoy" : esJub ? "Hasta jubilación (" + a + "a)" : a + " año" + (a > 1 ? "s" : "") + " más"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>{edad + a} años</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{semFuturas.toLocaleString("es-CO")}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: sc.semanasExtra > 0 ? T.green : T.txt3 }}>{sc.semanasExtra > 0 ? "+" + sc.semanasExtra : "—"}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: T.green }}>{Math.floor(sc.semanasExtra / 50)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 13, color: sc.tasaTotal >= 70 ? T.green : sc.tasaTotal >= 60 ? T.blue : T.orange }}>{pc(sc.tasaTotal)}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontFamily: "monospace", color: T.blue, fontSize: 14 }}>{fCOP(sc.pensionFinal)}/mes</td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: diff > 0 ? T.green : T.txt3, fontWeight: 600 }}>
                            {esHoy ? "—" : diff > 0 ? "+" + fCOP(diff) + "/mes" : "igual"}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", color: T.txt2 }}>{fCOP(total20)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, padding: 14, background: T.bg3, borderRadius: 10, fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
              <strong style={{ color: T.green }}>Cómo leer esta tabla:</strong> Si hoy tienes {semanas.toLocaleString("es-CO")} semanas y pagas <strong>5 años más</strong>, acumulas {Math.round(semanas + 5 * SEMANAS_POR_AÑO).toLocaleString("es-CO")} semanas.
              {(() => {
                const b5 = { sexo, edad, semanasActuales: semanas, ibcSM, ibcFuturo: ibcFuturoSM > 0 ? ibcFuturoSM * SM_2026 : 0, iblProm: iblPromSM > 0 ? iblPromSM * SM_2026 : 0, edadJub };
                const sc5 = calcColpensiones({ ...b5, aniosMas: 5 });
                const hoy2 = calcColpensiones(b5);
                return ` Tu tasa sube de ${pc(hoy2.tasaTotal)} a ${pc(sc5.tasaTotal)} y tu pensión pasa de ${fCOP(hoy2.pensionFinal)} a ${fCOP(sc5.pensionFinal)}/mes — una diferencia de ${fCOP(sc5.pensionFinal - hoy2.pensionFinal)}/mes de por vida.`;
              })()}
            </div>
          </Cd>

          {/* ═══ FÓRMULA DEL 1.5% EXPLICADA ═══ */}
          <Cd style={{ padding: 24, marginTop: 16 }}>
            <div style={{ background: T.orange + "10", border: "1px solid " + T.orange + "30", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, color: T.txt2, lineHeight: 1.7 }}>
              <strong style={{ color: T.orange }}>Nota importante:</strong> El IBL (Ingreso Base de Liquidación) se calcula como el promedio de los últimos 10 años de cotización. Si no has cotizado al nivel actual durante 10+ años, tu pensión real para "Paro hoy" será <strong>menor</strong> que la proyectada aquí. La proyección "Hasta jubilación" es más precisa porque asume que seguirás cotizando al nivel actual. Para un cálculo exacto con tu historial real, consulta un actuario profesional.
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>¿Cómo sube tu pensión? — Fórmula del 1.5%</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.8 }}>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <strong style={{ color: T.blue }}>Tasa base:</strong> 65.5% − 0.5% por cada SMMLV de tu IBL<br/>
                    <span style={{ color: T.txt3 }}>Tu IBL: {(colp.IBL / SM_2026).toFixed(1)} SMMLV → Tasa base: {pc(colp.tasaBase)}</span>
                  </div>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <strong style={{ color: T.green }}>Bonus por semanas extras:</strong><br/>
                    Por cada <strong>50 semanas</strong> después de 1,300 → <strong>+1.5%</strong><br/>
                    <span style={{ color: T.txt3 }}>Tus semanas extras: {colp.semanasExtra} → +{pc(colp.bonusSemanas)}</span>
                  </div>
                  <div style={{ background: T.bg3, borderRadius: 10, padding: 14 }}>
                    <strong style={{ color: T.orange }}>Tope máximo:</strong> baja con el ingreso — 80 % en ingresos bajos, {TOPE_MINIMO} % en los altos. El tuyo: {pc(colp.tasaTope)}<br/>
                    <span style={{ color: T.txt3 }}>Tu tasa final: <strong style={{ color: T.blue, fontSize: 16 }}>{pc(colp.tasaTotal)}</strong></span>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ejemplo con tus datos:</div>
                <div style={{ background: T.bg3, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, color: T.txt2, lineHeight: 2 }}>
                    Tasa base: <strong>{pc(colp.tasaBase)}</strong><br/>
                    + Bonus ({colp.semanasExtra} semanas ÷ 50 × 1.5%): <strong style={{ color: T.green }}>+{pc(colp.bonusSemanas)}</strong><br/>
                    <div style={{ borderTop: "1px solid " + T.border, marginTop: 8, paddingTop: 8 }}>
                      = Tasa total: <strong style={{ color: T.blue, fontSize: 18 }}>{pc(colp.tasaTotal)}</strong><br/>
                      Tu IBL: {fCOP(colp.IBL)}<br/>
                      Pensión: {fCOP(colp.IBL)} × {pc(colp.tasaTotal)} = <strong style={{ color: T.blue, fontSize: 16 }}>{fCOP(colp.pensionBruta)}</strong>
                    </div>
                  </div>
                </div>
                {colp.tasaTotal < colp.tasaTope && <div style={{ marginTop: 8, fontSize: 12, color: T.green }}>
                  Si cotizas {Math.ceil((colp.tasaTope - colp.tasaTotal) / 1.5) * 50} semanas más llegas a tu tope de {pc(colp.tasaTope)}
                </div>}
              </div>
            </div>
          </Cd>

          {/* ═══ BARRA VISUAL DE TASA ═══ */}
          <Cd style={{ padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tu tasa de reemplazo vs máximos</div>
            <div style={{ position: "relative", height: 32, background: T.bg3, borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: Math.min(colp.tasaTotal / colp.tasaTope * 100, 100) + "%", background: "linear-gradient(90deg, #ff5000 0%, #f59e0b 30%, #00c805 60%, #3b82f6 100%)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12, minWidth: 60 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>{pc(colp.tasaTotal)}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.txt3 }}>
              <span>55% mínimo</span>
              <span>55–65,5 % base</span>
              <span>{pc(colp.tasaTope)} máximo</span>
            </div>
          </Cd>
        </div>
      )}

      {/* ═══ FONDO PRIVADO (RAIS) ═══ */}
      {tab === "rais" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Cd style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.green, marginBottom: 14 }}>Fondo Privado — Proyección</h3>
              <Row l="Saldo actual" v={fCOP(privSaldo)} />
              <Row l="Aporte a tu cuenta (11.5%)" v={fCOP(rais.aporteMes)} sub="De 16% total: 11.5% ahorro + 3% admin + 1.5% garantía" color={T.green} />
              <Row l="Rendimiento anual" v={privRend + "%"} />
              <Row l={"Años cotizando más"} v={aniosFaltantes + " años"} />
              <Row l="Total a tu cuenta" v={fCOP(rais.totalAportado)} />
              <Row l="Total comisiones AFP" v={fCOP(rais.totalComisiones)} color={T.red} sub="3% del IBC por administración y seguros" />
              <Row l="Rendimientos ganados" v={fCOP(rais.rendimiento)} color={T.green} />
              <Row l="Saldo final proyectado" v={fCOP(rais.saldoFinal)} color={T.green} bold />
            </Cd>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Cd glow={T.green} style={{ padding: 28, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.txt3, letterSpacing: "0.1em" }}>Retiro Programado</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: T.green, letterSpacing: "-0.04em", marginTop: 8 }}>{fCOP(rais.retiroProgramado)}</div>
                <div style={{ fontSize: 13, color: T.txt3, marginTop: 4 }}>≈ {fUSD(rais.retiroProgramado, trm)}</div>
                <div style={{ fontSize: 12, color: T.txt2, marginTop: 8, lineHeight: 1.6 }}>Heredable • Saldo en AFP • Tasa 4% real</div>
                <div style={{ borderTop: "1px solid " + T.border, marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 12, color: T.txt3 }}>Renta Vitalicia (aseguradora)</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.blue, marginTop: 4 }}>{fCOP(rais.rentaVitalicia)}</div>
                  <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>No heredable • Pago fijo de por vida • Tasa 3% real</div>
                </div>
              </Cd>

              <Cd style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ventajas Fondo Privado</div>
                {[
                  { t: "100% heredable — tu familia recibe el saldo", c: T.green },
                  { t: "Retiro anticipado posible (cumpliendo requisitos)", c: T.green },
                  { t: "Rendimientos de mercado (pueden ser mayores)", c: T.blue },
                  { t: "Riesgo de mercado — rendimientos no garantizados", c: T.orange },
                  { t: "Pensión mínima garantizada (1 SMMLV) si cumple requisitos", c: T.blue },
                ].map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: a.c, padding: "4px 0", borderBottom: i < 4 ? `1px solid ${T.border}` : "none" }}>{a.t}</div>
                ))}
              </Cd>
            </div>
          </div>

          {/* Proyección chart */}
          <Cd style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Crecimiento del Fondo</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={rais.proyeccion} margin={MARGEN_EJE}>
                <ChartGradients/>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="anio" {...axisProps} />
                <YAxis {...axisProps} width={80} tickFormatter={(v) => sinCorte(fCOP(v).replace("$",""))} />
                <Tooltip content={<ChartTooltip formatter={(v) => fCOP(v)}/>} />
                <Area type="monotone" dataKey="saldo" stroke={CHART.green} fill="url(#gradGreen)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </Cd>
        </div>
      )}

      {/* ═══ COMPARAR ═══ */}
      {tab === "comparar" && (
        <div>
          {/* Big comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <Cd glow={T.blue} style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.blue, marginBottom: 12 }}>Colpensiones</div>
              <div style={{ fontSize: 12, color: T.txt3 }}>PENSIÓN MENSUAL</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.blue }}>{fCOP(colp.pensionFinal)}</div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{fUSD(colp.pensionFinal, trm)}</div>
              <div style={{ marginTop: 16, fontSize: 12, color: T.txt2, textAlign: "left" }}>
                <Row l="Tasa reemplazo" v={pc(colp.tasaTotal)} color={T.blue} bold />
                <Row l="En 20 años" v={fCOP(colp.total20Anios)} />
                <Row l="Heredable" v="No" color={T.red} />
                <Row l="Garantía" v="Estado" color={T.green} />
                <Row l="Riesgo" v="Reformas" color={T.orange} />
              </div>
            </Cd>

            <Cd glow={T.green} style={{ padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 12 }}>Fondo Privado</div>
              <div style={{ fontSize: 12, color: T.txt3 }}>RENTA MENSUAL</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: T.green }}>{fCOP(rais.rentaMes)}</div>
              <div style={{ fontSize: 12, color: T.txt3, marginTop: 4 }}>{fUSD(rais.rentaMes, trm)}</div>
              <div style={{ marginTop: 16, fontSize: 12, color: T.txt2, textAlign: "left" }}>
                <Row l="Saldo final" v={fCOP(rais.saldoFinal)} color={T.green} bold />
                <Row l="Rendimientos" v={fCOP(rais.rendimiento)} color={T.green} />
                <Row l="Heredable" v="Sí" color={T.green} />
                <Row l="Garantía" v="Mercado" color={T.orange} />
                <Row l="Riesgo" v="Rentabilidad" color={T.orange} />
              </div>
            </Cd>
          </div>

          {/* Visual comparison bars */}
          <Cd style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Comparación Visual</div>
            {[
              { l: "Pensión mensual", colp: colp.pensionFinal, rais: rais.rentaMes },
              { l: "Total 20 años", colp: colp.total20Anios, rais: rais.rentaMes * 240 },
              { l: "Capital heredable", colp: 0, rais: rais.saldoFinal },
            ].map((c) => {
              const max = Math.max(c.colp, c.rais, 1);
              return (
                <div key={c.l} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: T.txt2, marginBottom: 6 }}>{c.l}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: T.blue }}>Colpensiones</span>
                    <div style={{ height: 24, background: T.bg3, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${(c.colp / max) * 100}%`, height: "100%", background: T.blue, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{fCOP(c.colp)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: T.green }}>Fondo Priv.</span>
                    <div style={{ height: 24, background: T.bg3, borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${(c.rais / max) * 100}%`, height: "100%", background: T.green, borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{fCOP(c.rais)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Cd>

          {/* Winner */}
          <Cd glow={rais.rentaMes > colp.pensionFinal ? T.green : T.blue} style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 16, color: T.txt2 }}>
              {rais.rentaMes > colp.pensionFinal ? "El Fondo Privado paga más" : "Colpensiones paga más"}
            </div>
            <div style={{ fontSize: 56, fontWeight: 700, background: "linear-gradient(135deg, " + (rais.rentaMes > colp.pensionFinal ? T.green : T.blue) + ", " + T.cyan + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {rais.rentaMes > colp.pensionFinal ? (rais.rentaMes / Math.max(colp.pensionFinal, 1)).toFixed(1) + "x" : (colp.pensionFinal / Math.max(rais.rentaMes, 1)).toFixed(1) + "x"}
            </div>
            <div style={{ fontSize: 14, color: T.txt2 }}>
              {fCOP(Math.max(rais.rentaMes, colp.pensionFinal))}/mes vs {fCOP(Math.min(rais.rentaMes, colp.pensionFinal))}/mes
            </div>
            {rais.rentaMes > colp.pensionFinal && (
              <div style={{ fontSize: 13, color: T.green, marginTop: 8 }}>+ Capital heredable de {fCOP(rais.saldoFinal)}</div>
            )}
          </Cd>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
        <p style={{ fontSize: 12, color: T.txt3 }}>Simulador educativo • Los cálculos son aproximados • Consulta un asesor pensional certificado • Ley 100/1993 • Ley 797/2003</p>
      </div>
      <Disclaimer variante="proyeccion" T={T} />
    </div>
  );
}
