// ═══════════════════════════════════════════════════════════════════════════
// ConfirmarIngresos — «¿Este ingreso sigue llegando si dejas de trabajar?»
// (5-nov-2026). Santiago: "¿cómo lo hacemos universal y entendible?". Los
// ingresos dudosos (honorarios, comisiones, negocio, otro) no se adivinan: se le
// preguntan a la persona una vez, aquí, y la respuesta queda en el ingreso
// (rentaPasiva). Mientras no responda, ese ingreso no suma a su nivel.
// ═══════════════════════════════════════════════════════════════════════════
import { ingresosPorConfirmar, PREGUNTA_RENTA } from "../lib/metrics.js";

export default function ConfirmarIngresos({ ingresos, onMarcar, fmt, en = false, compacto = false }) {
  const pendientes = ingresosPorConfirmar(ingresos);
  if (!pendientes.length || !onMarcar) return null;
  const t = (es, enT) => (en ? enT : es);
  const f = fmt || ((v) => "$" + Math.round(v || 0).toLocaleString(en ? "en-US" : "es-CO"));
  const boton = (activo) => ({ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(var(--fp-ink),0.18)", background: activo ? "var(--fp-txt)" : "transparent", color: activo ? "var(--fp-bg)" : "var(--fp-txt)" });
  return (
    <section data-no-print aria-label={t("Ingresos por confirmar", "Income to confirm")} style={{ border: "1px solid rgba(245,158,11,0.45)", background: "rgba(245,158,11,0.06)", borderRadius: 12, padding: compacto ? "12px 14px" : "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fp-txt)" }}>
        {pendientes.length === 1 ? t("Confírmanos 1 ingreso", "Confirm 1 income") : t(`Confírmanos ${pendientes.length} ingresos`, `Confirm ${pendientes.length} incomes`)}
      </div>
      <div style={{ fontSize: 13, color: "var(--fp-txt2)", marginTop: 4, lineHeight: 1.5 }}>
        {en ? PREGUNTA_RENTA.en : PREGUNTA_RENTA.es} {t("Si la respuesta es sí, suma a tu nivel de libertad financiera; si es no, solo suma a tu flujo de caja del mes. Hasta que respondas, no suma a tu nivel.", "If yes, it counts toward your financial freedom level; if no, it only adds to your monthly cash flow. Until you answer, it doesn't count toward your level.")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {pendientes.map(({ i, idx }) => (
          <div key={i.id || idx} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(var(--fp-ink),0.08)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fp-txt)" }}>{i.nombre || i.categoria || t("Ingreso", "Income")}</div>
              <div style={{ fontSize: 12, color: "var(--fp-txt3)" }}>{i.categoria || ""}{Number(i.mensual) > 0 ? ` · ${f(Number(i.mensual))} ${i.moneda === "USD" ? "USD " : ""}${t("al mes", "per month")}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => onMarcar(idx, true)} style={boton(false)}>{t("Sí, sigue llegando", "Yes, it keeps coming")}</button>
              <button type="button" onClick={() => onMarcar(idx, false)} style={boton(false)}>{t("No, depende de mi trabajo", "No, it depends on my work")}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
