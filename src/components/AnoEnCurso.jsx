import { montoDelMes } from "../lib/flowHelpers.js";

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
export default function AñoEnCurso({ user, trm = 4200, fmt, T, mesActual, año }) {
  if (!user) return null;

  const ing = (user.ingresos || []).filter((i) => i.sim !== false);
  const deu = (user.deu || []).filter((d) => d.sim !== false && (d.mt || 0) > 0);
  const gasCats = Object.values(user.gas || {}).flatMap((its) => (its || []).filter((g) => g.sim !== false));

  if (!ing.length && !gasCats.length) return null;

  const enCOP = (v, moneda) => (moneda === "USD" ? v * trm : v);

  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const entra = ing.reduce((s, i) => s + enCOP(montoDelMes(i, año, m), i.moneda), 0);
    const gasta = gasCats.reduce((s, g) => s + montoDelMes(g, año, m), 0);
    const cuotas = deu.reduce((s, d) => s + enCOP(montoDelMes({ ...d, mensual: d.pg || 0 }, año, m), d.moneda), 0);
    meses.push({ m, entra, sale: gasta + cuotas, neto: entra - gasta - cuotas });
  }

  const transcurridos = meses.slice(0, mesActual);
  const acum = (campo, arr) => arr.reduce((s, x) => s + x[campo], 0);
  const entraYTD = acum("entra", transcurridos);
  const saleYTD = acum("sale", transcurridos);
  const netoYTD = entraYTD - saleYTD;
  const netoAño = acum("neto", meses);

  const maxAbs = Math.max(1, ...meses.map((x) => Math.abs(x.neto)));
  const M = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const MESES_L = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const Dato = ({ l, v, color }) => (
    <div>
      <div style={{ fontSize: 9.5, color: T.tx3, letterSpacing: 1, fontWeight: 700 }}>{l}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color || T.tx, fontFamily: "monospace", marginTop: 2 }}>{fmt(v)}</div>
    </div>
  );

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: T.tx }}>Cómo va {año}</div>
          <div style={{ fontSize: 11, color: T.tx3, marginTop: 1 }}>
            Llevás {mesActual} {mesActual === 1 ? "mes" : "meses"} del año
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <Dato l="HA ENTRADO" v={entraYTD} color="#22c55e" />
          <Dato l="HA SALIDO" v={saleYTD} color="#ef4444" />
          <Dato l="TE HA QUEDADO" v={netoYTD} color={netoYTD >= 0 ? "#22c55e" : "#ef4444"} />
        </div>
      </div>

      {/* Barras: arriba lo que sobra, abajo lo que falta. Los meses que aún no
          llegaron van translúcidos — son proyección, no historia. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 3, height: 78 }}>
        {meses.map((x) => {
          const alto = (Math.abs(x.neto) / maxAbs) * 100;
          const futuro = x.m > mesActual;
          const c = x.neto >= 0 ? "#22c55e" : "#ef4444";
          return (
            <div key={x.m} title={`${MESES_L[x.m - 1]}: ${fmt(x.neto)}${futuro ? " (proyectado)" : ""}`}
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
          <div key={x.m} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: x.m === mesActual ? T.tx : T.tx3, fontWeight: x.m === mesActual ? 800 : 500 }}>
            {M[x.m - 1]}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: T.tx3, marginTop: 10, lineHeight: 1.5 }}>
        Los meses que faltan son proyección con lo que tenés cargado hoy — se ven más tenues.
        Si el año cierra así, terminás con <strong style={{ color: netoAño >= 0 ? "#22c55e" : "#ef4444" }}>{fmt(netoAño)}</strong>.
      </div>
    </div>
  );
}
