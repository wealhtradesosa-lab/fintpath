import { Check, ArrowRight, X, Lock } from "lucide-react";
import { pasosAfinar, futuroEstimado, extraRedondo } from "../lib/afinaNumero.js";
import { tx, localeCifras, esUS } from "../lib/region.js";

/**
 * 2-nov-2026 — Después del primer minuto (Santiago: «que quieran seguir porque
 * descubren más; así se conectan con la plataforma»).
 * 1) Recompensa ya: su patrimonio en 10 años y el «¿y si ahorras un poco más?».
 * 2) Tres preguntas que todavía no sabe responder, cada una con una pista
 *    calculada con sus cifras y lo que se descubre al cargar sus datos reales.
 * Un descubrimiento solo se marca hecho con datos reales.
 */
export default function AfinaTuNumero({ u, T, mb, fm, c, irA, onCerrar }) {
  const pasos = pasosAfinar(u);
  const hechos = pasos.filter((p) => p.hecho).length;
  const todo = hechos === pasos.length;
  const verde = "#00c805";
  const nw = c.nw || 0, cf = c.cf || 0, ing = c.ing || 0, gas = c.gas || 0, pas = c.pasivo || 0, deuda = c.deuda || 0;
  const activos = nw + deuda;
  const f10 = futuroEstimado({ nw, cfMes: cf });
  const extra = extraRedondo(ing);
  const f10Mas = futuroEstimado({ nw, cfMes: cf, extraMes: extra });
  const rinde = activos > 0 ? (pas * 12) / activos * 100 : 0;
  const pct = (v) => v.toLocaleString(localeCifras(), { maximumFractionDigits: 1 }) + (esUS() ? "%" : "\u00a0%");
  const siguiente = pasos.find((p) => !p.hecho && !p.opcional)?.id;

  const pistas = {
    inv: {
      pregunta: tx("¿Tu plata trabaja o duerme?", "Is your money working or asleep?"),
      pista: activos > 0
        ? pas > 0
          ? tx(<>Tus {fm(activos)} te dejan {fm(pas)} al mes: un <b style={{ color: T.tx }}>{pct(rinde)}</b> al año en promedio. Detrás de ese promedio hay activos que jalan y otros que frenan.</>, <>Your {fm(activos)} brings in {fm(pas)} a month: <b style={{ color: T.tx }}>{pct(rinde)}</b> a year on average. Behind that average, some assets pull ahead and others drag.</>)
          : tx(<>Tus {fm(activos)} hoy no te pagan nada al mes. ¿Todo está quieto o hay algo que sí rinde y no lo ves?</>, <>Your {fm(activos)} pays you nothing a month today. Is it all idle, or is something earning that you can't see?</>)
        : tx(<>Todavía no sabemos qué tienes ni cuánto te rinde.</>, <>We don't know yet what you own or what it earns.</>),
      descubres: tx("Cuánto te rinde cada activo y cuál te está haciendo perder plata.", "What each asset earns, and which one is losing you money."),
    },
    ing: {
      pregunta: tx(`¿Por dónde se te van los ${fm(gas)} al mes?`, `Where does your ${fm(gas)} a month go?`),
      pista: tx(<>Hoy es una sola cifra. Partida en sus pedazos aparecen los gastos que más pesan y cuánto te queda de verdad cada mes.</>, <>Today it's one number. Broken down, you'll see your biggest expenses and what you really keep each month.</>),
      descubres: tx("Tu flujo mes a mes y las categorías que se llevan tu plata.", "Your month-by-month cash flow and where your money goes."),
    },
    deu: {
      pregunta: deuda > 0 ? tx("¿Qué mes quedas libre de deudas?", "Which month will you be debt-free?") : tx("Sin deudas", "No debt"),
      pista: deuda > 0
        ? tx(<>Debes {fm(deuda)}. Con el saldo, la cuota y la tasa de cada una te decimos la fecha exacta y cuánto te ahorras en intereses si abonas un poco más.</>, <>You owe {fm(deuda)}. With each balance, payment and rate we'll give you the exact date and how much interest you save by paying a bit more.</>)
        : tx(<>No registraste deudas. Si tienes alguna, cárgala y la sumamos a tu plan.</>, <>You didn't add any debt. If you have some, add it and we'll include it in your plan.</>),
      descubres: tx("La fecha en que quedas libre y cuánto pagas en intereses.", "The date you're debt-free and how much interest you pay."),
    },
  };

  const sec = { background: "transparent", border: "1px solid " + T.border, color: T.tx, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 };
  const pri = { ...sec, background: T.tx, color: "var(--fp-bg)", border: "none" };

  return (
    <div style={{ marginBottom: 24, border: "1px solid " + T.border, borderRadius: 12, padding: mb ? "18px 16px" : "22px 24px", background: T.bg2, position: "relative" }}>
      {onCerrar && todo && (
        <button type="button" aria-label={tx("Cerrar", "Close")} onClick={onCerrar} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: T.tx3, cursor: "pointer" }}><X size={18} /></button>
      )}

      {/* 1 · La recompensa que ya tiene */}
      {nw > 0 || cf > 0 ? (
        <div>
          <div style={{ fontSize: 13, color: T.tx3 }}>{tx("Si sigues como vas, en 10 años tendrías", "If you keep going like this, in 10 years you'd have")}</div>
          <div style={{ fontSize: mb ? 30 : 36, fontWeight: 700, color: T.tx, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", margin: "2px 0 4px" }}>{fm(f10)}</div>
          <div style={{ fontSize: 14, color: T.tx2, lineHeight: 1.5 }}>
            {tx(<>Y si guardaras <b style={{ color: T.tx }}>{fm(extra)}</b> más al mes: <b style={{ color: verde }}>{fm(f10Mas)}</b>, es decir <b style={{ color: verde }}>{fm(f10Mas - f10)}</b> más.</>, <>And if you saved <b style={{ color: T.tx }}>{fm(extra)}</b> more a month: <b style={{ color: verde }}>{fm(f10Mas)}</b>, that's <b style={{ color: verde }}>{fm(f10Mas - f10)}</b> more.</>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" style={sec} onClick={() => irA("sim")}>{tx("Prueba tus propios «¿y si…?»", "Try your own “what ifs”")} <ArrowRight size={15} /></button>
            <button type="button" style={sec} onClick={() => irA("f10")}>{tx("Ve el camino año por año", "See the path year by year")} <ArrowRight size={15} /></button>
          </div>
          <div style={{ fontSize: 12, color: T.tx3, marginTop: 8 }}>{tx("Estimado con tus tres cifras y un 7 % anual.", "Estimated from your three numbers and a 7% annual return.")}</div>
        </div>
      ) : null}

      {/* 2 · Lo que todavía no sabe */}
      <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid " + T.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: mb ? 18 : 20, fontWeight: 700, color: T.tx }}>{todo ? tx("Ya conoces tu plata de verdad", "Now you really know your money") : tx("Lo que todavía no sabes de tu plata", "What you don't know yet about your money")}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: verde }}>{tx(`${hechos} de ${pasos.length} descubiertos`, `${hechos} of ${pasos.length} unlocked`)}</div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(var(--fp-ink),0.08)", margin: "10px 0 4px", overflow: "hidden" }}>
          <div style={{ width: (hechos / pasos.length) * 100 + "%", height: "100%", background: verde, transition: "width .3s" }} />
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12, gridTemplateColumns: mb ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
          {pasos.map((p) => {
            const x = pistas[p.id];
            return (
              <div key={p.id} style={{ border: "1px solid " + (p.hecho ? "rgba(0,200,5,0.35)" : T.border), borderRadius: 12, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 8, background: "var(--fp-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: p.hecho ? verde : T.tx3 }}>
                  {p.hecho ? <Check size={14} strokeWidth={3} /> : <Lock size={13} />} {p.hecho ? tx("Descubierto", "Unlocked") : tx("Por descubrir", "Locked")}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.tx, lineHeight: 1.3 }}>{x.pregunta}</div>
                <div style={{ fontSize: 13, color: T.tx2, lineHeight: 1.5 }}>{x.pista}</div>
                {!p.opcional && (
                  <div style={{ fontSize: 12.5, color: T.tx3, lineHeight: 1.45 }}>
                    <span style={{ color: T.tx2, fontWeight: 600 }}>{p.hecho ? tx("Ya puedes ver: ", "You can now see: ") : tx("Al cargarlo descubres: ", "Add it to unlock: ")}</span>{x.descubres}
                  </div>
                )}
                <div style={{ marginTop: "auto", paddingTop: 4 }}>
                  {p.hecho
                    ? <button type="button" style={sec} onClick={() => irA(p.ir || p.id)}>{tx("Verlo", "View")} <ArrowRight size={15} /></button>
                    : !p.opcional && <button type="button" style={p.id === siguiente ? pri : sec} onClick={() => irA(p.ir || p.id)}>{tx("Descubrirlo", "Unlock it")} <ArrowRight size={15} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
