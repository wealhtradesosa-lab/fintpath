import { useState } from "react";

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

  const sal = Number(String(ingreso).replace(/,/g, "")) || 0;
  const empPen = sal * 0.04, empSal2 = sal * 0.04, empTotal = empPen + empSal2;
  const dorPen = sal * 0.12, dorSal = sal * 0.085, dorArl = sal * 0.00522, dorCaja = sal * 0.04;
  const dorTotal = dorPen + dorSal + dorArl + dorCaja;
  const ibc40 = sal * 0.40;
  const indPen = ibc40 * 0.16, indSal = ibc40 * 0.125, indArl = ibc40 * 0.00522;
  const indTotal = indPen + indSal + indArl;

  const Row = ({ l, v, bold, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + T.border }}>
      <span style={{ color: color || T.txt2, fontWeight: bold ? 700 : 400, fontSize: 13 }}>{l}</span>
      <span style={{ fontWeight: bold ? 700 : 600, color: color || T.txt, fontFamily: "monospace", fontSize: 13 }}>{v}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>💰 Calcula tus aportes de seguridad social</h2>
      <p style={{ color: T.txt3, fontSize: 13, margin: "0 0 20px" }}>Conoce cuánto pagas de pensión, salud y ARL según tu tipo de vinculación</p>

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
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
            {tipo === "empleado" ? "¿Cuál es tu salario mensual?" : "¿Cuánto facturas al mes?"}
          </label>
          <input type="text" inputMode="numeric"
            value={sal > 0 ? sal.toLocaleString("en-US") : ""}
            onChange={e => setIngreso(e.target.value.replace(/,/g, ""))}
            placeholder="Ej: 5,000,000"
            style={{ width: "100%", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, padding: "10px 12px", color: T.txt, fontSize: 14, outline: "none" }}
          />
          {sal > 0 && <div style={{ fontSize: 11, color: T.txt3, marginTop: 4 }}>Equivale a {(sal / 1750905).toFixed(1)} salarios mínimos</div>}
        </div>
      </Cd>

      {sal > 0 && tipo === "empleado" && (
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
        </Cd>
      )}

      {sal > 0 && tipo === "independiente" && (
        <Cd s={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.orange, marginBottom: 16 }}>🧑‍💻 Aportes como independiente</div>
          <div style={{ background: T.bg3, padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, color: T.txt2 }}>
            Tu IBC (Ingreso Base de Cotización) = 40% de tu ingreso = <strong>{f(ibc40)}/mes</strong>
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
            Tu aporte de pensión obligatoria ({f(ibc40 * 0.04)}/mes, parte trabajador) es ingreso no constitutivo de renta (Art. 55 ET).<br />
            Retención en la fuente por honorarios: 11% = {f(sal * 0.11)}/mes si eres declarante.
          </div>
        </Cd>
      )}
    </div>
  );
}
