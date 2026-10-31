import { useState } from "react";
import { C, Cα, F, R } from "../lib/designTokens";

/**
 * Primer minuto (31-oct-2026). Quien se registra y no tiene nada cargado veía
 * un Dashboard vacío y una lista de 4 pasos largos: el 85 % no cargaba nada.
 * Ahora son tres preguntas en la misma pantalla. Al responder, se crean filas
 * "estimadas" (las mismas de la calculadora de la landing: itemsDesdeNorte) y
 * el Dashboard muestra de una vez patrimonio, nivel y cuánto cubren sus rentas.
 * Después puede detallar cada sección.
 */
function Pesos({ label, hint, value, onChange, placeholder, autoFocus }) {
  const show = value ? Number(value).toLocaleString("es-CO") : "";
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
      <div style={{ ...F.label, color: C.ok }}>Tu primer minuto</div>
      <h2 style={{ ...F.display, fontSize: "clamp(20px, 5vw, 26px)", margin: "6px 0 4px" }}>
        {nombre ? `${nombre}, ` : ""}tres cifras y ves dónde estás
      </h2>
      <div style={{ ...F.body, marginBottom: 18 }}>
        Números redondos sirven. Con esto te mostramos tu patrimonio, tu nivel de libertad y cuánto de tus gastos ya pagan tus rentas. Después lo afinas.
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
        <Pesos autoFocus label="1. ¿Cuánto te entra al mes por tu trabajo?" hint="Sueldo, honorarios o lo que te deja tu negocio." value={f.ingresoTrabajo} onChange={set("ingresoTrabajo")} placeholder="8.000.000" />
        <Pesos label="2. ¿Cuánto gastas al mes?" hint="Todo junto: vida diaria y cuotas de créditos." value={f.gastos} onChange={set("gastos")} placeholder="6.000.000" />
        <Pesos label="3. ¿Cuánto tienes?" hint="Ahorros, inversiones y propiedades, a valor de hoy." value={f.ahorrado} onChange={set("ahorrado")} placeholder="300.000.000" />
      </div>

      {!mas ? (
        <button type="button" onClick={() => setMas(true)} style={{ marginTop: 12, background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, textAlign: "left" }}>
          + Recibo arriendos, intereses o dividendos, o tengo deudas
        </button>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
          <Pesos label="¿Cuánto te entra al mes sin trabajar?" hint="Arriendos, intereses, dividendos, pensión." value={f.ingresoPasivo} onChange={set("ingresoPasivo")} placeholder="0" />
          <Pesos label="¿Cuánto debes en total?" hint="Saldo de hipoteca, créditos y tarjetas." value={f.deudas} onChange={set("deudas")} placeholder="0" />
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 18 }}>
        <button type="button" disabled={!listo} onClick={() => onListo(f)}
          style={{ background: listo ? C.ok : C.raised, color: listo ? "#000" : C.subtle, border: "none", padding: "12px 22px", borderRadius: R.lg, cursor: listo ? "pointer" : "default", fontWeight: 800, fontSize: 15 }}>
          Ver dónde estoy →
        </button>
        <span style={F.caption}>
          ¿Prefieres el detalle? <button type="button" onClick={onDetallar} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", fontSize: 11 }}>Cargar sección por sección</button>
          {onExcel && <> o <button type="button" onClick={onExcel} style={{ background: "none", border: "none", padding: 0, color: C.accent, cursor: "pointer", fontSize: 11 }}>subir mi Excel</button></>}
        </span>
      </div>
    </div>
  );
}
