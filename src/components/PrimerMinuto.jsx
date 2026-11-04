import { useState } from "react";
import { C, Cα, F, R } from "../lib/designTokens";
import { tx, esUS, localeCifras } from "../lib/region.js";

/**
 * Primer minuto (31-oct-2026). Quien se registra y no tiene nada cargado veía
 * un Dashboard vacío y una lista de 4 pasos largos: el 85 % no cargaba nada.
 * Ahora son tres preguntas en la misma pantalla. Al responder, se crean filas
 * "estimadas" (las mismas de la calculadora de la landing: itemsDesdeNorte) y
 * el Dashboard muestra de una vez patrimonio, nivel y cuánto cubren sus rentas.
 * Después puede detallar cada sección.
 */
function Pesos({ label, hint, value, onChange, placeholder, autoFocus }) {
  const show = value ? Number(value).toLocaleString(localeCifras()) : "";
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...F.h3, fontSize: 14, marginBottom: 2 }}>{label}</div>
      {hint && <div style={{ ...F.caption, marginBottom: 6 }}>{hint}</div>}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.subtle, ...F.mono, fontWeight: 400 }}>$</span>
        <input inputMode="numeric" autoComplete="off" placeholder={placeholder} value={show} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 13))}
          style={{ width: "100%", boxSizing: "border-box", background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "12px 12px 12px 28px", fontSize: 16, fontFamily: F.mono.fontFamily, outline: "none" }} />
      </div>
    </label>
  );
}

export default function PrimerMinuto({ nombre, onListo, onDetallar, onExcel }) {
  const [f, setF] = useState({ ingresoTrabajo: "", ingresoPasivo: "", gastos: "", ahorrado: "", deudas: "" });
  const [mas, setMas] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const n = (k) => Number(f[k]) || 0;
  const listo = (n("ingresoTrabajo") + n("ingresoPasivo")) > 0 && n("gastos") > 0;

  return (
    <div style={{ marginBottom: 24, border: `1px solid ${Cα.ok25}`, borderRadius: R.xl, padding: "20px 20px 18px", background: `linear-gradient(135deg, ${Cα.ok08}, ${Cα.accent08})` }}>
      <div style={{ ...F.label, color: C.ok }}>{tx("Tu primer minuto", "Your first minute")}</div>
      <h2 style={{ ...F.display, fontSize: "clamp(20px, 5vw, 26px)", margin: "6px 0 4px" }}>
        {nombre ? tx(`${nombre}, tres cifras y ves dónde estás`, `${nombre}, three numbers and you'll see where you stand`) : tx("Tres cifras y ves dónde estás", "Three numbers and you'll see where you stand")}
      </h2>
      <div style={{ ...F.body, marginBottom: 18 }}>
        {tx("Números redondos sirven. Con esto te mostramos tu patrimonio, tu nivel de libertad y cuánto de tus gastos ya pagan tus rentas. Después lo afinas.", "Round numbers are fine. We'll show your net worth, your freedom level and how much of your spending your passive income already covers. You can fine-tune later.")}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
        <Pesos autoFocus label={tx("1. ¿Cuánto te entra al mes por tu trabajo?", "1. How much do you earn a month from work?")} hint={tx("Sueldo, honorarios o lo que te deja tu negocio.", "Salary, freelance income or what your business pays you.")} value={f.ingresoTrabajo} onChange={set("ingresoTrabajo")} placeholder={esUS() ? "8,000" : "8.000.000"} />
        <Pesos label={tx("2. ¿Cuánto gastas al mes?", "2. How much do you spend a month?")} hint={tx("Todo junto: vida diaria y cuotas de créditos.", "Everything: day-to-day costs and loan payments.")} value={f.gastos} onChange={set("gastos")} placeholder={esUS() ? "6,000" : "6.000.000"} />
        <Pesos label={tx("3. ¿Cuánto tienes?", "3. How much do you have?")} hint={tx("Ahorros, inversiones y propiedades, a valor de hoy.", "Savings, investments and property, at today's value.")} value={f.ahorrado} onChange={set("ahorrado")} placeholder={esUS() ? "300,000" : "300.000.000"} />
      </div>

      {!mas ? (
        <button type="button" onClick={() => setMas(true)} style={{ marginTop: 12, background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, textAlign: "left" }}>
          {tx("+ Recibo arriendos, intereses o dividendos, o tengo deudas", "+ I get rent, interest or dividends, or I have debt")}
        </button>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          <Pesos label={tx("¿Cuánto te entra al mes sin trabajar?", "How much comes in a month without working?")} hint={tx("Arriendos, intereses, dividendos, pensión.", "Rent, interest, dividends, pension or Social Security.")} value={f.ingresoPasivo} onChange={set("ingresoPasivo")} placeholder="0" />
          <Pesos label={tx("¿Cuánto debes en total?", "How much do you owe in total?")} hint={tx("Saldo de hipoteca, créditos y tarjetas.", "Mortgage, loans and credit card balances.")} value={f.deudas} onChange={set("deudas")} placeholder="0" />
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 18 }}>
        <button type="button" disabled={!listo} onClick={() => onListo(f)}
          style={{ background: listo ? C.ok : C.raised, color: listo ? "#000" : C.subtle, border: "none", padding: "12px 22px", borderRadius: R.lg, cursor: listo ? "pointer" : "default", fontWeight: 700, fontSize: 15 }}>
          {tx("Ver dónde estoy →", "See where I stand →")}
        </button>
        <span style={F.caption}>
          {tx("¿Prefieres el detalle?", "Prefer the details?")} <button type="button" onClick={onDetallar} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", fontSize: 12 }}>{tx("Cargar sección por sección", "Add it section by section")}</button>
          {/* 3-nov-2026: la plantilla de Excel es de Colombia; en EE. UU. no se ofrece. */}
          {onExcel && !esUS() && <> o <button type="button" onClick={onExcel} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", fontSize: 12 }}>subir mi Excel</button></>}
        </span>
      </div>
    </div>
  );
}
