import { useState } from "react";
import NumberInput from "./NumberInput";
import PageHeader from "./PageHeader.jsx";

const T = {
  bg2: "#18181b", bg3: "#1e1e24", card: "#111113",
  border: "rgba(255,255,255,0.06)", txt: "#fafafa",
  txt2: "#a1a1aa", txt3: "#71717a", green: "#22c55e",
  blue: "#3b82f6", orange: "#f97316",
};
const fm = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");
const Cd = ({ children, s }) => <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 16, overflow: "hidden", ...s }}>{children}</div>;

export default function AportesCalculadora({ fmt }) {
  const f = fmt || fm;
  const [tipo, setTipo] = useState("empleado");
  const [ingreso, setIngreso] = useState(5000000);
  const [ibcSM, setIbcSM] = useState(5);

  const sal = Number(String(ingreso).replace(/,/g, "")) || 0;
  // Empleado: aporta sobre su salario
  const empPen = sal * 0.04, empSal2 = sal * 0.04, empTotal = empPen + empSal2;
  const dorPen = sal * 0.12, dorSal = sal * 0.085, dorArl = sal * 0.00522, dorCaja = sal * 0.04;
  const dorTotal = dorPen + dorSal + dorArl + dorCaja;
  // Independiente: aporta sobre el IBC que escoja (en SMMLV)
  const SM = 1750905;
  const ibcCOP = ibcSM * SM;
  const indPen = ibcCOP * 0.16, indSal = ibcCOP * 0.125, indArl = ibcCOP * 0.00522;
  const indTotal = indPen + indSal + indArl;
  const ibcMinimo = sal > 0 ? Math.max(1, Math.ceil(sal * 0.40 / SM)) : 1;

  const Row = ({ l, v, bold, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + T.border }}>
      <span style={{ color: color || T.txt2, fontWeight: bold ? 700 : 400, fontSize: 13 }}>{l}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: color || T.txt, fontFamily: "monospace", fontSize: 13 }}>{v}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <PageHeader
        label="Aportes"
        title="Seguridad social"
        subtitle="Calcula cuánto pagas de pensión, salud y ARL según tu tipo de vinculación."
      />

      <Cd s={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ v: "empleado", l: "👔 Empleado", c: T.blue }, { v: "independiente", l: "🧑‍💻 Independiente", c: T.orange }].map(t => (
            <button key={t.v} onClick={() => setTipo(t.v)} style={{
              flex: 1, padding: "14px", borderRadius: 10,
              border: "2px solid " + (tipo === t.v ? t.c : T.border),
              background: tipo === t.v ? t.c + "15" : "transparent",
              color: tipo === t.v ? t.c : T.txt2,
              cursor: "pointer", fontWeight: 600, fontSize: 14,
            }}>{t.l}</button>
          ))}
        </div>
        {tipo === "empleado" && <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>¿Cuál es tu salario mensual?</label>
          <input type="text" inputMode="numeric"
            value={sal > 0 ? sal.toLocaleString("en-US") : ""}
            onChange={e => setIngreso(e.target.value.replace(/,/g, ""))}
            placeholder="Ej: 5,000,000"
            style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}
          />
          {sal > 0 && <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Equivale a {(sal / 1750905).toFixed(1)} salarios mínimos</div>}
        </div>}
      </Cd>

      {tipo === "empleado" && sal > 0 && (
        <Cd s={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.blue, marginBottom: 16 }}>👔 Aportes como empleado</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 8 }}>Te descuentan de tu nómina:</div>
          <Row l="Pensión (4%)" v={f(empPen)} />
          <Row l="Salud (4%)" v={f(empSal2)} />
          <Row l="Total que te descuentan" v={f(empTotal) + " (8%)"} bold color={T.blue} />
          <Row l="Tu neto estimado" v={f(sal - empTotal) + "/mes"} bold color={T.green} />

          <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: T.txt2, marginBottom: 8 }}>Tu empleador paga adicionalmente:</div>
          <Row l="Pensión (12%)" v={f(dorPen)} />
          <Row l="Salud (8.5%)" v={f(dorSal)} />
          <Row l="ARL (0.52%)" v={f(dorArl)} />
          <Row l="Caja compensación (4%)" v={f(dorCaja)} />
          <Row l="Total empleador" v={f(dorTotal)} bold color={T.txt2} />

          <div style={{ marginTop: 12, background: T.bg3, padding: "12px 14px", borderRadius: 10, fontSize: 12, color: T.txt3, lineHeight: 1.6 }}>
            <strong style={{ color: T.blue }}>📌 Para tu declaración de renta:</strong><br />
            Tu aporte de pensión ({f(empPen)}/mes = {f(empPen * 12)}/año) es ingreso no constitutivo de renta (Art. 55 ET). Se resta automáticamente en tu planeación tributaria.
          </div>
          <div style={{ marginTop: 12, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", padding: "14px 16px", borderRadius: 10, fontSize: 13, color: T.blue, lineHeight: 1.6 }}>
            <strong>📌 En Ingresos registre su salario BRUTO ({f(sal)})</strong>, no el neto que le consignan ({f(sal - empTotal)}). El 8% que le descuentan ya está considerado en el cálculo tributario como ingreso no constitutivo de renta (Art. 55 ET). No necesita registrar egreso adicional.
          </div>
        </Cd>
      )}

      {tipo === "independiente" && (
        <Cd s={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.orange, marginBottom: 16 }}>🧑‍💻 Aportes como independiente</div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>¿Cuánto facturas al mes?</label>
            <input type="text" inputMode="numeric"
              value={sal > 0 ? sal.toLocaleString("en-US") : ""}
              onChange={e => { const v = Number(e.target.value.replace(/,/g, "")) || 0; setIngreso(v); setIbcSM(Math.max(1, Math.ceil(v * 0.40 / SM))); }}
              placeholder="Ej: 25,000,000"
              style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}
            />
            {sal > 0 && <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>IBC mínimo por ley: {ibcMinimo} SMMLV (40% de tu ingreso)</div>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.txt2, display: "block", marginBottom: 4 }}>¿Sobre cuántos salarios mínimos cotizas? (IBC)</label>
            <input type="number" value={ibcSM} onChange={e => setIbcSM(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
              min={1} max={25} step={1}
              style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}
            />
            <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Equivale a {f(ibcCOP)}/mes. Tope máximo: 25 SMMLV</div>
            {ibcSM < ibcMinimo && sal > 0 && <div style={{ fontSize: 11, color: T.orange, marginTop: 4 }}>⚠️ El mínimo legal para tu ingreso es {ibcMinimo} SMMLV</div>}
          </div>

          <div style={{ background: T.bg3, padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13, color: T.txt2 }}>
            Tu IBC = <strong>{ibcSM} SMMLV = {f(ibcCOP)}/mes</strong>
          </div>
          
          <Row l="Pensión (16% del IBC)" v={f(indPen)} />
          <Row l="Salud (12.5% del IBC)" v={f(indSal)} />
          <Row l="ARL (0.52% del IBC)" v={f(indArl)} />
          <Row l="Total seguridad social" v={f(indTotal) + "/mes"} bold color={T.orange} />
          <Row l="Tu neto estimado" v={f(sal - indTotal) + "/mes"} bold color={T.green} />

          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: T.bg3, borderRadius: 8, marginTop: 12 }}>
            <span style={{ fontSize: 12, color: T.txt3 }}>Total anual seguridad social</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.orange }}>{f(indTotal * 12)}/año</span>
          </div>

          <div style={{ marginTop: 12, background: T.bg3, padding: "12px 14px", borderRadius: 10, fontSize: 12, color: T.txt3, lineHeight: 1.6 }}>
            <strong style={{ color: T.orange }}>📌 Para tu declaración de renta:</strong><br />
            Pensión obligatoria (parte trabajador): {f(ibcCOP * 0.04)}/mes = INCRNGO (Art. 55 ET)<br />
            Retención en la fuente honorarios: 11% = {f(sal * 0.11)}/mes si eres declarante
          </div>
          <div style={{ marginTop: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "14px 16px", borderRadius: 10, fontSize: 13, color: T.green, lineHeight: 1.6 }}>
            <strong>👉 Registre {f(indTotal)}/mes como egreso en Pensión y Salud</strong> para que el Simulador y el Plan Tributario lo consideren en el análisis y la respectiva deducción.
          </div>
        </Cd>
      )}
    </div>
  );
}
