// ═══════════════════════════════════════════════════════════════════════════
// BarraFuturo10 — «Mi futuro a 10 años», pasos 1 a 3.
// 23-nov-2026 (Luis: «conservar lo bueno y hacerla fácil»). Barra pegada abajo
// con el resultado en vivo mientras llenas los pasos: tu patrimonio neto al
// final del plan frente a «Si me quedo como estoy», los dos en pesos de hoy
// (inflación del 5 % al año), y la diferencia en verde o rojo. Al tocarla vas
// al paso 4 (Resultado). El punto rojo usa la misma regla que las «Alertas de
// liquidez» del paso 4. Si vendes algo, el resultado va «antes de impuestos
// de la venta». Criterios: Finanzas, Tributario y QA.
// ═══════════════════════════════════════════════════════════════════════════
import { resumenBarra, rotuloVenta, INFLACION_PESOS_HOY_PCT } from "../lib/futuro10.js";
import { tx, esUS, plataCorta, num } from "../lib/region.js";
import { fmtPlataEs } from "../lib/formato.js";

const fm = (v) => (esUS() ? plataCorta(v) : fmtPlataEs(v));
const pctTxt = (v) => (esUS() ? num(v, 0) + " %" : String(v).replace(".", ",") + " %");
const VERDE = "#00c805", ROJO = "#ff5000";

export const CSS_BARRA_F10 = `.fp10-barra { position: sticky; bottom: 0; z-index: 30; display: block; width: 100%; box-sizing: border-box; margin: 12px 0 0; padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); text-align: left; font: inherit; color: var(--fp-txt); background: var(--fp-card); border: 1px solid rgba(var(--fp-ink),0.14); border-radius: 12px 12px 0 0; box-shadow: 0 -8px 24px rgba(0,0,0,0.25); cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.fp10-barra:focus-visible { outline: 2px solid var(--fp-azul, #4c7dff); outline-offset: 2px; }
.fp10-barra-fila { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px; }
.fp10-barra-cifra { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fp10-barra-l { font-size: 11.5px; color: var(--fp-txt2); }
.fp10-barra-ir { margin-left: auto; font-size: 13px; font-weight: 600; white-space: nowrap; }
@media (max-width: 599px) {
  .fp10-barra { padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)); border-radius: 10px 10px 0 0; }
  .fp10-barra-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
  .fp10-barra-cifra { font-size: 15px; }
  .fp10-barra-ir { margin-left: 0; align-self: end; justify-self: start; font-size: 12px; padding: 4px 0; }
}`;

/**
 * @param rPlan  proyectarFuturo10 del escenario que se arma
 * @param rHoy   proyectarFuturo10 de «Si me quedo como estoy»
 * @param onIr   se llama al tocar la barra (lleva al paso 4)
 */
export default function BarraFuturo10({ rPlan, rHoy, onIr, inflacionPct = INFLACION_PESOS_HOY_PCT }) {
  const b = resumenBarra(rPlan, rHoy, inflacionPct);
  if (!b) return null;
  const unidad = esUS()
    ? tx(`Patrimonio neto en dólares de hoy (inflación ${pctTxt(b.inflacionPct)} al año)`, `Net worth in today's dollars (${pctTxt(b.inflacionPct)} yearly inflation)`)
    : tx(`Patrimonio neto en pesos de hoy (inflación ${pctTxt(b.inflacionPct)} al año)`, `Net worth in today's pesos (${pctTxt(b.inflacionPct)} yearly inflation)`);
  const dif = b.diferencia;
  const colorDif = dif == null ? "inherit" : dif >= 0 ? VERDE : ROJO;
  const liq = b.alertaLiquidez;
  return (
    <>
      <style>{CSS_BARRA_F10}</style>
      <button type="button" className="fp10-barra" data-testid="f10-barra" onClick={onIr}
        aria-label={tx(`Resultado en ${b.anioCalFin}: ver el paso 4`, `Result in ${b.anioCalFin}: go to step 4`)}>
        <div className="fp10-barra-l" style={{ marginBottom: 4, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span aria-hidden="true" data-testid="f10-barra-liquidez" data-alerta={liq ? "si" : "no"} style={{ width: 9, height: 9, marginTop: 3, borderRadius: "50%", background: liq ? ROJO : VERDE, flexShrink: 0 }} />
          <span>{liq ? tx("Hay alertas de liquidez · ", "There are cash alerts · ") : ""}{unidad}{b.conVenta ? <> · <b data-testid="f10-barra-venta">{rotuloVenta()}</b></> : null}</span>
        </div>
        <div className="fp10-barra-fila">
          <div>
            <div className="fp10-barra-l">{tx(`Este escenario en ${b.anioCalFin}`, `This scenario in ${b.anioCalFin}`)}</div>
            <div className="fp10-barra-cifra" data-testid="f10-barra-plan">{fm(b.plan)}</div>
          </div>
          {b.quedarme != null && <div>
            <div className="fp10-barra-l">{tx("Si me quedo como estoy", "If I stay as I am")}</div>
            <div className="fp10-barra-cifra" style={{ fontWeight: 500 }} data-testid="f10-barra-hoy">{fm(b.quedarme)}</div>
          </div>}
          {dif != null && <div className="fp10-barra-dif">
            <div className="fp10-barra-l">{tx("Diferencia", "Difference")}</div>
            <div className="fp10-barra-cifra" style={{ color: colorDif }} data-testid="f10-barra-dif" data-signo={dif >= 0 ? "pos" : "neg"}>{dif >= 0 ? "+" : "−"}{fm(Math.abs(dif))}</div>
          </div>}
          <span className="fp10-barra-ir">{tx("Ver resultado →", "See result →")}</span>
        </div>
      </button>
    </>
  );
}
