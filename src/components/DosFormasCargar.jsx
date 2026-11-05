// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Las dos formas de cargar datos (estado vacío de cada sección)
//
// 5-nov-2026 (Santiago: "aquí seamos claros: puedes subir manualmente cada
// ingreso o subir una tabla en Excel que ya tengas en tu computador; eso mismo
// para cada sección, que esté bien claro"). Dos opciones lado a lado, cada una
// con lo que significa, en Patrimonio, Ingresos, Gastos y Deudas.
// ═══════════════════════════════════════════════════════════════════════════
export default function DosFormasCargar({ singular, plural, onManual, onExcel, en = false }) {
  const t = (es, us) => (en ? us : es);
  const caja = { flex: "1 1 220px", textAlign: "left", padding: "18px 18px 16px", borderRadius: 14, border: "1px solid rgba(var(--fp-ink),0.12)", background: "var(--fp-card)", display: "flex", flexDirection: "column" };
  const num = { width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: "rgba(var(--fp-ink),0.08)", color: "var(--fp-txt)", marginRight: 8, flexShrink: 0 };
  const btn = (primario) => ({ marginTop: 14, width: "100%", padding: "12px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14, border: primario ? "1.5px solid var(--fp-txt)" : "1.5px solid var(--fp-txt)", background: primario ? "var(--fp-txt)" : "transparent", color: primario ? "var(--fp-bg)" : "var(--fp-txt)" });
  return (
    <div style={{ maxWidth: 560, margin: "0 auto 24px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fp-txt2)", marginBottom: 12 }}>{t("Tienes dos formas de cargarlos:", "There are two ways to add them:")}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={caja}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: "var(--fp-txt)" }}><span style={num}>1</span>{t("Uno por uno", "One at a time")}</div>
          <div style={{ fontSize: 13, color: "var(--fp-txt3)", lineHeight: 1.5, marginTop: 6, flex: 1 }}>{t(`Escribes cada ${singular} a mano en un formulario corto. Ideal si son pocos.`, `Type each ${singular} in a short form. Best if you have just a few.`)}</div>
          <button type="button" onClick={onManual} style={btn(true)}>+ {t(`Agregar ${singular}`, `Add ${singular}`)}</button>
        </div>
        {onExcel && (
          <div style={caja}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: "var(--fp-txt)" }}><span style={num}>2</span>{t("Desde tu Excel", "From your Excel")}</div>
            <div style={{ fontSize: 13, color: "var(--fp-txt3)", lineHeight: 1.5, marginTop: 6, flex: 1 }}>{t(`¿Ya tienes tus ${plural} en una tabla de Excel en tu computador? Súbela y los cargamos todos de una vez. No tiene que tener un formato especial.`, `Already have your ${plural} in an Excel sheet on your computer? Upload it and we load them all at once. No special format needed.`)}</div>
            <button type="button" onClick={onExcel} style={btn(false)}>{t("Subir mi Excel", "Upload my Excel")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
