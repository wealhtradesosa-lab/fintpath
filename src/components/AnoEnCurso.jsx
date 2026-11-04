import { montoDelMes } from "../lib/flowHelpers.js";
import { tx, esUS, nombreMes } from "../lib/region.js";

const num = (v) => Number(v) || 0;

/**
 * AñoEnCurso — La trayectoria del año, no la foto del mes.
 *
 * 25-jul-2026. El dashboard respondía "¿dónde estoy?" como una foto fija: un
 * patrimonio de $21.700M no dice nada por sí solo. Lo que dice algo es si
 * venías de menos o de más. Esta franja agrega esa dimensión.
 *
 * POR QUÉ SE CALCULA Y NO SE LEE DE UN HISTÓRICO: el historial de patrimonio
 * vive en localStorage y requiere al menos dos capturas mensuales, así que
 * está vacío para cualquier usuario nuevo y se pierde al cambiar de equipo.
 * El flujo, en cambio, se deriva de los datos cargados: funciona desde el
 * primer día y para todos.
 *
 * Los meses ya transcurridos son reales; los que faltan son proyección con lo
 * que el usuario tiene cargado, y se marcan visualmente distinto para que no
 * se confundan con hechos.
 */
export default function AñoEnCurso({ user, trm = 4200, fmt, T, mesActual, año, totales }) {
  if (!user) return null;

  const ing = (user.ingresos || []).filter((i) => i.sim !== false);
  const deu = (user.deu || []).filter((d) => d.sim !== false && (d.mt || 0) > 0);
  const gasCats = Object.values(user.gas || {}).flatMap((its) => (its || []).filter((g) => g.sim !== false));

  if (!ing.length && !gasCats.length) return null;

  const enCOP = (v, moneda) => (moneda === "USD" ? v * trm : v);

  // 26-jul-2026 (Santiago: "el dashboard me muestra verde los últimos meses y
  // en el simulador esos mismos meses salen rojos"). Era un error mío: esta
  // franja restaba solo gastos y cuotas, mientras que el motor —y por lo tanto
  // el simulador— también resta RETENCIÓN EN LA FUENTE e IMPUESTO DE RENTA:
  //   cashFlow = (bruto − retención) − (aportes + gastos + cuotas + impuesto)
  // Faltando esos dos, la franja pintaba de verde meses que en realidad son
  // rojos. Dos partes de la app diciendo cosas distintas del mismo mes es lo
  // peor que puede pasar en una herramienta patrimonial.
  const brutoRef = num(totales?.brutoTotal);
  const retencionMes = num(totales?.retencionMensual);
  const impuestoMes = num(totales?.impuestoNeto);

  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const entra = ing.reduce((s, i) => s + enCOP(montoDelMes(i, año, m), i.moneda), 0);
    const gasta = gasCats.reduce((s, g) => s + montoDelMes(g, año, m), 0);
    const cuotas = deu.reduce((s, d) => s + enCOP(montoDelMes({ ...d, mensual: d.pg || 0 }, año, m), d.moneda), 0);
    // La retención sigue al ingreso del mes: si un mes entra menos, retienen
    // menos. El impuesto de renta es una obligación anual, así que se reparte
    // parejo — es el mismo criterio que usa el motor.
    const retencion = brutoRef > 0 ? (entra / brutoRef) * retencionMes : 0;
    const sale = gasta + cuotas + retencion + impuestoMes;
    meses.push({ m, entra, sale, neto: entra - sale });
  }

  const transcurridos = meses.slice(0, mesActual);
  const acum = (campo, arr) => arr.reduce((s, x) => s + x[campo], 0);
  const entraYTD = acum("entra", transcurridos);
  const saleYTD = acum("sale", transcurridos);
  const netoYTD = entraYTD - saleYTD;
  // 27-sep-2026 (Santiago: "debería mostrar cómo va a la fecha y cómo está lo
  // proyectado a dic de 2026"). El cierre del año existía, pero enterrado como
  // una frase al pie —"si el año cierra así, terminas con X"— y solo el neto.
  // Las dos preguntas que el bloque debe responder son simétricas: qué pasó y
  // qué va a pasar. Ahora van una al lado de la otra, con las tres cifras cada
  // una, y la proyección marcada como tal.
  const entraAño = acum("entra", meses);
  const saleAño = acum("sale", meses);
  const netoAño = acum("neto", meses);
  const mesesRestantes = 12 - mesActual;

  const maxAbs = Math.max(1, ...meses.map((x) => Math.abs(x.neto)));
  // 3-nov-2026: iniciales y nombres de mes en el idioma de la sesión.
  const M = tx(["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"], ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]);
  const MESES_L = tx(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"], Array.from({ length: 12 }, (_, i) => nombreMes(i + 1)));

  // `tenue` baja el peso visual de la columna proyectada, con el mismo criterio
  // que las barras de los meses futuros: el dato es legible, pero se lee como
  // supuesto y no como hecho.
  const Dato = ({ l, v, color, tenue }) => (
    <div>
      <div style={{ fontSize: 11, color: T.tx3, letterSpacing: 1, fontWeight: 700 }}>{l}</div>
      <div style={{ fontSize: tenue ? 15 : 17, fontWeight: tenue ? 700 : 800,
            color: color || T.tx, fontFamily: "monospace", marginTop: 2,
            opacity: tenue ? 0.82 : 1 }}>{fmt(v)}</div>
    </div>
  );

  // El grupo proyectado no se marca con contorno punteado (Santiago:
  // "estaba mejor en el verde como tramado"): se marca bajando la opacidad de
  // sus cifras y tiñendo el fondo, el mismo recurso que usan las barras de los
  // meses futuros. Un solo lenguaje para "esto todavía no pasó".
  const Grupo = ({ titulo, sub, children, proyectado }) => (
    <div style={{
      flex: "1 1 280px", minWidth: 0, padding: "10px 13px",
      background: proyectado ? "rgba(0,200,5,0.05)" : "rgba(var(--fp-ink),0.03)",
      border: `1px solid ${proyectado ? "rgba(0,200,5,0.18)" : T.border}`,
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.9, color: T.tx3 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: T.tx3, opacity: 0.8, marginTop: 1 }}>{sub}</div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 9 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.tx }}>{tx(`Cómo va ${año}`, `How ${año} is going`)}</div>
        <div style={{ fontSize: 12, color: T.tx3, marginTop: 1, marginBottom: 11 }}>
          {mesActual} {mesActual === 1 ? tx("mes cumplido", "month done") : tx("meses cumplidos", "months done")}
          {mesesRestantes > 0 && tx(`, ${mesesRestantes} por delante`, `, ${mesesRestantes} to go`)}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Grupo titulo={tx("A la fecha", "Year to date")}
                 sub={tx(`Enero–${MESES_L[mesActual - 1].toLowerCase()} · ejecutado`, `January–${MESES_L[mesActual - 1]} · actual`)}>
            <Dato l={tx("HA ENTRADO", "IN")} v={entraYTD} color="#00c805" />
            <Dato l={tx("HA SALIDO", "OUT")} v={saleYTD} color="#ff5000" />
            <Dato l={tx("TE HA QUEDADO", "KEPT")} v={netoYTD} color={netoYTD >= 0 ? "#00c805" : "#ff5000"} />
          </Grupo>

          {mesesRestantes > 0 && (
            <Grupo proyectado titulo={tx(`Cierre de ${año}`, `${año} year-end`)}
                   sub={tx("Año completo · proyectado con lo cargado", "Full year · projected from your data")}>
              <Dato tenue l={tx("ENTRARÁ", "WILL COME IN")} v={entraAño} color="#00c805" />
              <Dato tenue l={tx("SALDRÁ", "WILL GO OUT")} v={saleAño} color="#ff5000" />
              <Dato tenue l={tx("QUEDARÁ", "WILL BE LEFT")} v={netoAño} color={netoAño >= 0 ? "#00c805" : "#ff5000"} />
            </Grupo>
          )}
        </div>
      </div>

      {/* Barras: arriba lo que sobra, abajo lo que falta. Los meses que aún no
          llegaron van translúcidos — son proyección, no historia. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 3, height: 78 }}>
        {meses.map((x) => {
          const alto = (Math.abs(x.neto) / maxAbs) * 100;
          const futuro = x.m > mesActual;
          const c = x.neto >= 0 ? "#00c805" : "#ff5000";
          return (
            <div key={x.m} title={`${MESES_L[x.m - 1]}: ${fmt(x.neto)}${futuro ? tx(" (proyectado)", " (projected)") : ""}`}
                 style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                {x.neto >= 0 && <div style={{ width: "100%", height: `${alto}%`, background: c, opacity: futuro ? 0.28 : 0.85, borderRadius: "3px 3px 0 0" }} />}
              </div>
              <div style={{ height: 1, background: T.border }} />
              <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>
                {x.neto < 0 && <div style={{ width: "100%", height: `${alto}%`, background: c, opacity: futuro ? 0.28 : 0.85, borderRadius: "0 0 3px 3px" }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
        {meses.map((x) => (
          <div key={x.m} style={{ flex: 1, textAlign: "center", fontSize: 11, color: x.m === mesActual ? T.tx : T.tx3, fontWeight: x.m === mesActual ? 800 : 500 }}>
            {M[x.m - 1]}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: T.tx3, marginTop: 10, lineHeight: 1.5 }}>
        {mesesRestantes > 0
          ? tx(<>Las barras sólidas son meses cumplidos; las tenues, los {mesesRestantes} que faltan. El cierre proyectado supone que {mesesRestantes === 1 ? "ese mes se comporta" : "esos meses se comportan"} según los ingresos, gastos y cuotas que tienes cargados hoy.</>, <>Solid bars are months done; faded ones are the {mesesRestantes} still to come. The year-end projection assumes {mesesRestantes === 1 ? "that month behaves" : "those months behave"} like the income, expenses and payments you have loaded today.</>)
          : tx(<>El año está completo: las doce barras son meses cumplidos.</>, <>The year is complete: all twelve bars are actual months.</>)}
        {" "}{esUS() ? tx("Incluye retenciones de nómina e impuestos estimados.", "Includes payroll withholding and estimated taxes.") : tx("Incluye retención e impuesto de renta.", "Includes withholding and income tax.")}
      </div>
    </div>
  );
}
