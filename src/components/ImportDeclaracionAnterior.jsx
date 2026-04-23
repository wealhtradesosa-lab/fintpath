// ═══════════════════════════════════════════════════════════════════════════
// IMPORT DECLARACIÓN AÑO ANTERIOR
// ─────────────────────────────────────────────────────────────────────────
// Modal que captura los renglones clave de la declaración del año anterior
// (F-210 para natural, F-110 para jurídica) y los guarda en:
//   owner.declaracionAnterior = { tipo: "F210"|"F110", anoGravable, renglones }
//
// Después el F-210 y F-110 del año en curso pueden mostrar "Año anterior: \$X"
// debajo de cada casilla equivalente, para comparación rápida.
//
// Approach: captura manual guiada de los ~15 renglones más importantes.
// No intenta parsear PDFs o XMLs (eso queda para una fase 2 con OCR/tooling
// específico). Lo que se captura acá es suficiente para:
//   1. Comparar año a año ("mis ingresos subieron vs bajaron")
//   2. Detectar anomalías (ej: retenciones del año actual muy por debajo
//      de las del anterior — posible error de captura)
//   3. Proyectar el impuesto esperado del año en curso
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { track } from "../lib/analytics.js";

const UVT_2024 = 47065;
const UVT_2025 = 49799;

const T = {
  bg: "#0f1117", bg2: "#15181f", bg3: "#1c2029", card: "#16191f",
  border: "rgba(255,255,255,0.08)",
  txt: "#e8eaed", txt2: "#b8bcc4", txt3: "#6b7280",
  blue: "#3b82f6", green: "#22c55e", orange: "#f59e0b", red: "#ef4444",
  purple: "#a78bfa", cyan: "#06b6d4",
};

const fm = (n) => {
  if (!n && n !== 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
};

const Field = ({ label, casilla, value, onChange, hint, optional }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.txt2, flex: 1 }}>
        {casilla && <span style={{ color: T.cyan, fontFamily: "monospace", marginRight: 6 }}>R{casilla}</span>}
        {label}
        {optional && <span style={{ color: T.txt3, fontSize: 10, marginLeft: 4, fontWeight: 400 }}>(opcional)</span>}
      </label>
    </div>
    <input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      style={{
        width: "100%", padding: "10px 12px", background: T.bg3,
        border: "1px solid " + T.border, color: T.txt, borderRadius: 8, fontSize: 13,
        fontFamily: "monospace", outline: "none",
      }}
    />
    {hint && <div style={{ fontSize: 10, color: T.txt3, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

const Section = ({ title, icon, color, children }) => (
  <div style={{ background: T.card, border: "1px solid " + T.border, borderLeft: "3px solid " + (color || T.blue), borderRadius: 10, padding: 14, marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: color || T.blue, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span>{icon}</span>}{title}
    </div>
    {children}
  </div>
);

export default function ImportDeclaracionAnterior({ owner, onSave, onCancel }) {
  const tipo = owner?.type === "juridica" ? "F110" : "F210";
  // Array-based: todas las declaraciones guardadas de este owner.
  // Si solo existe el legacy owner.declaracionAnterior (sin array), se convierte.
  const historial = useMemo(() => {
    if (owner?.declaracionesAnteriores?.length) return owner.declaracionesAnteriores;
    if (owner?.declaracionAnterior) return [owner.declaracionAnterior];
    return [];
  }, [owner?.declaracionesAnteriores, owner?.declaracionAnterior]);

  // La más reciente se pre-carga por defecto
  const prev = historial[0] || {};
  const [anoGravable, setAnoGravable] = useState(prev.anoGravable || String(new Date().getFullYear() - 2));
  const [rg, setRg] = useState(prev.renglones || {});

  const upd = (k, v) => setRg({ ...rg, [k]: v });

  const anoNum = parseInt(anoGravable) || 0;
  const uvtDelAno = anoNum === 2024 ? UVT_2024 : anoNum === 2025 ? UVT_2025 : UVT_2025;

  // Cambiar de año: si hay una declaración guardada de ese año, cargarla
  const cambiarAno = (nuevoAno) => {
    setAnoGravable(nuevoAno);
    const existente = historial.find(d => d.anoGravable === nuevoAno);
    if (existente) setRg(existente.renglones || {});
    else setRg({});
  };

  const handleSave = () => {
    const declaracion = {
      tipo,
      anoGravable,
      uvtDelAno,
      renglones: rg,
      capturadoEn: new Date().toISOString(),
    };
    // Analytics: medir qué campos capturó el usuario (sin montos, solo count)
    const camposCapturados = Object.keys(rg).filter(k => +rg[k] > 0).length;
    track("declaracion_anterior_guardada", {
      tipo,
      ano_gravable: anoGravable,
      campos_capturados: camposCapturados,
      es_edicion: historial.some(d => d.anoGravable === anoGravable),
      total_historial_despues: historial.length + (historial.some(d => d.anoGravable === anoGravable) ? 0 : 1),
    });
    if (onSave) onSave(declaracion);
  };

  const isJuridica = tipo === "F110";

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ marginBottom: 20, padding: "18px 22px", background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(167,139,250,0.08))", borderRadius: 14, border: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26 }}>📥</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.txt }}>Importar declaración año anterior</div>
            <div style={{ fontSize: 12, color: T.txt3, marginTop: 2 }}>
              {owner?.name} · {isJuridica ? "Formulario 110" : "Formulario 210"}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: T.bg3, border: "1px solid " + T.border, color: T.txt2, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            ← Volver
          </button>
        </div>
        <div style={{ fontSize: 11, color: T.txt3, marginTop: 12, lineHeight: 1.5 }}>
          Copiá los valores de la <strong>declaración de renta que ya presentaste</strong> del año anterior. No necesitás todos los renglones — solo los principales alcanzan. Después FINPATHIA muestra estos valores debajo de cada casilla del formulario del año actual para que compares rápidamente y detectes diferencias.
        </div>
      </div>

      <Section title="Año gravable" icon="📅" color={T.cyan}>
        {historial.length > 0 && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 8, fontSize: 11 }}>
            <div style={{ color: T.cyan, fontWeight: 700, marginBottom: 6 }}>
              📚 Histórico guardado ({historial.length} año{historial.length !== 1 ? "s" : ""})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {historial.map(d => (
                <button
                  key={d.anoGravable}
                  onClick={() => cambiarAno(d.anoGravable)}
                  style={{
                    padding: "4px 10px",
                    background: d.anoGravable === anoGravable ? T.cyan : "rgba(255,255,255,0.04)",
                    color: d.anoGravable === anoGravable ? "#000" : T.txt2,
                    border: "1px solid " + (d.anoGravable === anoGravable ? T.cyan : T.border),
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "monospace",
                  }}
                  title={`Editar declaración de ${d.anoGravable}`}
                >
                  {d.anoGravable}
                </button>
              ))}
              {!historial.find(d => d.anoGravable === anoGravable) && (
                <span style={{ padding: "4px 10px", background: T.green, color: "#000", border: "1px solid " + T.green, borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: "monospace" }}>
                  + {anoGravable} (nuevo)
                </span>
              )}
            </div>
            <div style={{ color: T.txt3, marginTop: 6, fontSize: 10, lineHeight: 1.4 }}>
              Click en un año para editarlo. Para agregar otro año nuevo, cambiá el campo abajo y los campos se limpian.
            </div>
          </div>
        )}
        <Field
          label="Año que estás importando"
          value={anoGravable}
          onChange={cambiarAno}
          hint={"Ej: 2024 si ya presentaste esa declaración y querés compararla con la de 2025 que estás preparando. UVT usado: $" + uvtDelAno.toLocaleString("es-CO")}
        />
      </Section>

      {!isJuridica ? (
        <>
          {/* F-210 Persona Natural */}
          <Section title="Ingresos brutos — Cédula General" icon="💰" color={T.blue}>
            <Field label="Total ingresos brutos Cédula General" casilla="32–55" value={rg.totalIngresosBrutos} onChange={(v) => upd("totalIngresosBrutos", v)} hint="Suma de salarios + honorarios + intereses + arrendamientos + otros. Del formulario: sección ingresos." />
            <Field label="Salarios" casilla="32" value={rg.salarios} onChange={(v) => upd("salarios", v)} optional />
            <Field label="Honorarios y servicios" casilla="34" value={rg.honorarios} onChange={(v) => upd("honorarios", v)} optional />
            <Field label="Intereses y rendimientos" casilla="44" value={rg.intereses} onChange={(v) => upd("intereses", v)} optional />
            <Field label="Arrendamientos" casilla="52" value={rg.arrendamientos} onChange={(v) => upd("arrendamientos", v)} optional />
            <Field label="Pensiones recibidas" casilla="91" value={rg.pensiones} onChange={(v) => upd("pensiones", v)} optional hint="Cédula pensional. Pensión de jubilación, invalidez, sobrevivientes." />
            <Field label="Dividendos recibidos" casilla="101-103" value={rg.dividendos} onChange={(v) => upd("dividendos", v)} optional hint="Cédula de dividendos." />
          </Section>

          <Section title="Depuración y exentas" icon="🛡️" color={T.purple}>
            <Field label="Aportes obligatorios pensión + salud" casilla="41-42" value={rg.aportesObligatorios} onChange={(v) => upd("aportesObligatorios", v)} hint="INCRNGO. Suma de los dos aportes obligatorios." />
            <Field label="Exenta 25% laboral (Art. 206 #10)" casilla="72" value={rg.exenta25} onChange={(v) => upd("exenta25", v)} optional />
            <Field label="Pensión voluntaria + AFC aportados" casilla="73-74" value={rg.pvAFC} onChange={(v) => upd("pvAFC", v)} optional />
            <Field label="Intereses vivienda deducidos" casilla="75" value={rg.interesesVivienda} onChange={(v) => upd("interesesVivienda", v)} optional />
            <Field label="Deducción dependientes" casilla="76" value={rg.dependientes} onChange={(v) => upd("dependientes", v)} optional />
            <Field label="Salud prepagada deducida" casilla="77" value={rg.saludPrepagada} onChange={(v) => upd("saludPrepagada", v)} optional hint="Medicina prepagada y pólizas de salud. Tope 192 UVT/año." />
            <Field label="GMF 4×1000 deducido (50%)" casilla="78" value={rg.gmf50} onChange={(v) => upd("gmf50", v)} optional hint="Mitad del gravamen a los movimientos financieros pagado." />
          </Section>

          <Section title="Resultado de la declaración" icon="🧾" color={T.green}>
            <Field label="Renta líquida gravable" casilla="121" value={rg.rentaLiquidaGravable} onChange={(v) => upd("rentaLiquidaGravable", v)} hint="La base sobre la que se calculó el impuesto." />
            <Field label="Impuesto de renta (después de descuentos)" casilla="135" value={rg.impuestoRenta} onChange={(v) => upd("impuestoRenta", v)} hint="El total que declaraste, incluido ganancias ocasionales." />
            <Field label="Retenciones en la fuente del año" casilla="141" value={rg.retenciones} onChange={(v) => upd("retenciones", v)} />
            <Field label="Anticipo declarado (quedó para este año)" casilla="151" value={rg.anticipoGenerado} onChange={(v) => upd("anticipoGenerado", v)} optional />
            <Field label="Saldo pagado / a favor" casilla="161" value={rg.saldoFinal} onChange={(v) => upd("saldoFinal", v)} optional hint="Usá positivo si pagaste, negativo si quedó saldo a favor." />
          </Section>
        </>
      ) : (
        <>
          {/* F-110 Persona Jurídica */}
          <Section title="Ingresos brutos" icon="💼" color={T.blue}>
            <Field label="Ingresos operacionales" casilla="42" value={rg.ingresosOperacionales} onChange={(v) => upd("ingresosOperacionales", v)} hint="Facturación del negocio principal." />
            <Field label="Ingresos no operacionales" casilla="43" value={rg.ingresosNoOperacionales} onChange={(v) => upd("ingresosNoOperacionales", v)} optional hint="Intereses, utilidad venta activos, etc." />
            <Field label="Dividendos recibidos" casilla="47" value={rg.dividendos} onChange={(v) => upd("dividendos", v)} optional hint="Dividendos inter-societarios no suman (Art. 48 ET)." />
          </Section>

          <Section title="Costos y deducciones" icon="📉" color={T.orange}>
            <Field label="Costos totales" casilla="49" value={rg.costos} onChange={(v) => upd("costos", v)} optional hint="Costo de ventas / costo directo." />
            <Field label="Gastos operativos deducibles" casilla="52" value={rg.gastosDeducibles} onChange={(v) => upd("gastosDeducibles", v)} hint="Nómina, honorarios, servicios, mantenimiento, predial, etc." />
            <Field label="Depreciaciones" casilla="53" value={rg.depreciaciones} onChange={(v) => upd("depreciaciones", v)} optional hint="Art. 128-141 ET." />
            <Field label="Intereses financieros" casilla="55" value={rg.interesesFinancieros} onChange={(v) => upd("interesesFinancieros", v)} optional />
          </Section>

          <Section title="Rentas especiales" icon="🛡️" color={T.purple}>
            <Field label="Pérdidas fiscales acumuladas aplicadas" casilla="76" value={rg.perdidasAplicadas} onChange={(v) => upd("perdidasAplicadas", v)} optional hint="Art. 147 ET. Útil para saber qué saldo de pérdidas te queda." />
            <Field label="Saldo de pérdidas fiscales pendientes" casilla="-" value={rg.perdidasRemanentes} onChange={(v) => upd("perdidasRemanentes", v)} optional hint="Lo que quedó SIN compensar al cierre del año anterior." />
          </Section>

          <Section title="Resultado de la declaración" icon="🧾" color={T.green}>
            <Field label="Renta líquida gravable" casilla="80" value={rg.rentaLiquidaGravable} onChange={(v) => upd("rentaLiquidaGravable", v)} hint="Base sobre la que se aplicó la tarifa." />
            <Field label="Impuesto de renta total" casilla="98" value={rg.impuestoRenta} onChange={(v) => upd("impuestoRenta", v)} hint="Después de descuentos." />
            <Field label="Retenciones en la fuente" casilla="99" value={rg.retenciones} onChange={(v) => upd("retenciones", v)} />
            <Field label="Anticipo de renta generado" casilla="103" value={rg.anticipoGenerado} onChange={(v) => upd("anticipoGenerado", v)} optional />
            <Field label="Saldo pagado / a favor" casilla="111" value={rg.saldoFinal} onChange={(v) => upd("saldoFinal", v)} optional />
          </Section>
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: "12px 20px", background: T.bg3, border: "1px solid " + T.border, borderRadius: 8, color: T.txt2, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Cancelar
        </button>
        <button onClick={handleSave} style={{ flex: 1, padding: "12px 20px", background: T.green, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          💾 Guardar declaración del {anoGravable}
        </button>
      </div>

      <div style={{ marginTop: 20, padding: 12, background: T.bg3, borderRadius: 10, fontSize: 10, color: T.txt3, textAlign: "center", lineHeight: 1.6 }}>
        Estos valores se guardan en el perfil de <strong>{owner?.name}</strong> y se muestran como referencia en las casillas equivalentes del formulario del año siguiente. Podés volver a editarlos en cualquier momento.
      </div>
    </div>
  );
}
