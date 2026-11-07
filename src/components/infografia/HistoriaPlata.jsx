// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · La historia de tu plata (informe de un escenario)
//
// 7-nov-2026 (Santiago: "esta sección debería mostrar la historia completa que
// se hizo con el dinero: las inversiones actuales, cuáles se vendieron, hacia
// dónde fue el dinero, en qué se invirtió, cuánto se invirtió ahí, cuánto
// renta y en 10 años cuánto crece… muy didáctica, muy infografía").
// Va de primera en el informe, como resumen visual; NO reemplaza ninguna
// gráfica de abajo ("no me quite lo que sea potente y aporte valor").
//
// Cuatro pasos, todos leídos del resultado del motor (proyectarFuturo10):
//   1 · Lo que tienes hoy: qué se vende (y por qué) y qué se conserva.
//   2 · A dónde va cada peso: de dónde sale → a dónde va.
//   3 · Cada destino: cuánto pones, cuánto rinde, cuánto te paga y cómo crece.
//   4 · Lo que cambia en tu bolsillo cada mes.
// No calcula nada nuevo: solo agrupa filas[].porActivo por destino.
// ═══════════════════════════════════════════════════════════════════════════
import { anioCal } from "../../lib/futuro10.js";
import { INF, fmM, fmPct } from "../../lib/informeTheme.js";
import { tx, esUS, num } from "../../lib/region.js";

const COL = { deuda: INF.oliva, renta: INF.azul, crece: INF.dorado, mixto: INF.serie[4], caja: INF.gris, motor: INF.serie[6] };
const card = { background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 14, padding: 18 };
const paso = (n, color) => ({ width: 30, height: 30, borderRadius: 15, background: color, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
const chip = (color) => ({ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", color, border: `1px solid ${color}` });

function Paso({ n, color, titulo, sub, children }) {
  return <section style={{ marginBottom: 22 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: sub ? 2 : 12 }}>
      <div style={paso(n, color)}>{n}</div>
      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: INF.tx, letterSpacing: "-0.01em" }}>{titulo}</h3>
    </div>
    {sub && <p style={{ margin: "0 0 12px 40px", fontSize: 13, color: INF.tx2, lineHeight: 1.5 }}>{sub}</p>}
    {children}
  </section>;
}


export default function HistoriaPlata({ r }) {
  const filas = r.filas || [];
  if (filas.length < 2) return null;
  const f0 = filas[0], fin = filas[filas.length - 1];
  const nAnios = fin.anio;
  const bd = r.bolsaDetalle || {};
  const vendIds = new Set((r.vendidos || []).map((v) => v.id));
  const serieDe = (id) => filas.map((f) => (f.porActivo || []).find((a) => a.id === id) || { valor: 0, renta: 0 });

  // ── 1 · Lo que se vende y lo que se conserva ───────────────────────────────
  // Rendimiento promedio (ponderado) de donde va la plata, para comparar.
  const rendDest = [
    ...(r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => [x.aporte, x.rendimientoPct != null ? x.rendimientoPct : x.rentaPctAnual]),
    ...(r.nuevasDetalle || []).filter((x) => x.monto > 0).map((x) => [x.monto, x.rendPct]),
  ].filter(([m, p]) => m > 0 && Number.isFinite(p));
  const capRend = rendDest.reduce((s, [m]) => s + m, 0);
  const rendProm = capRend > 0 ? rendDest.reduce((s, [m, p]) => s + m * p, 0) / capRend : null;
  const vendidos = (r.vendidos || []).map((v) => {
    const renta = v.rentaAnual || 0, crec = v.crec || 0;
    const rinde = v.valor > 0 ? (renta + v.valor * crec) / v.valor * 100 : null;
    let porque;
    if (renta < -0.5) porque = tx(`cuesta más de lo que renta: te saca ${fmM(-renta / 12)} al mes.`, `it costs more than it earns: ${fmM(-renta / 12)} a month out of your pocket.`);
    else if (crec < 0 && renta <= 0.5) porque = tx(`pierde ${fmPct(-crec * 100, 0)} de su valor cada año y no produce nada.`, `it loses ${fmPct(-crec * 100, 0)} of its value every year and earns nothing.`);
    else if (rinde != null && rendProm != null && rendProm > rinde) porque = tx(`hoy rinde ${fmPct(rinde, 1)} al año (renta + valorización); donde va la plata rinde ${fmPct(rendProm, 1)} en promedio.`, `today it returns ${fmPct(rinde, 1)} a year (income + appreciation); where the money goes averages ${fmPct(rendProm, 1)}.`);
    else if (rinde != null) porque = tx(`hoy rinde ${fmPct(rinde, 1)} al año (renta + valorización). Venderlo libera ese capital para el plan.`, `today it returns ${fmPct(rinde, 1)} a year (income + appreciation). Selling frees that capital for the plan.`);
    else porque = tx("liberas ese capital para ponerlo a trabajar.", "you free up that capital to put it to work.");
    return { ...v, porque, rinde };
  });
  const totVend = vendidos.reduce((s, v) => s + v.valor, 0);
  // ── Tu portafolio: hoy → después del plan ──────────────────────────────────
  // 7-nov-2026 (Santiago: "la historia debe ser más clara: usted parte de
  // 17.000, vendió estos activos que suman 11.000 y su portafolio quedó así…
  // ¿de dónde salieron los 5.000 de BTG?"). Tres fotos: lo que tienes HOY (con
  // su valor de antes del plan), lo que vendes/conservas, y cómo queda DESPUÉS
  // (fila 0 del motor, que ya trae las inversiones nuevas y los aportes del
  // año 1). Cada activo dice de dónde viene su valor.
  const nuevasIds = new Set((r.nuevasDetalle || []).filter((x) => x.id).map((x) => x.id));
  const aporteDe = Object.fromEntries((r.reinversionesDetalle || []).filter((x) => x.aporte > 0).map((x) => [x.activoId, x]));
  const esCanasta = (a) => a.clase === "canasta";
  const esCiclo = (a) => a.clase === "ciclo";
  const hoyLista = [
    ...vendidos.map((v) => ({ id: v.id, nombre: v.nombre, valor: v.valor, tag: "vende", porque: v.porque })),
    ...(f0.porActivo || []).filter((a) => !esCanasta(a) && !esCiclo(a) && !nuevasIds.has(a.id) && !vendIds.has(a.id)).map((a) => {
      const ap = aporteDe[a.id];
      const valor = ap && ap.anio === 1 ? (ap.valorHoy || 0) : a.valor;
      return { id: a.id, nombre: a.nombre, valor, tag: ap ? "recibe" : "igual", ap };
    }),
  ].filter((a) => a.valor > 0.5).sort((x, y) => y.valor - x.valor);
  const totHoy = hoyLista.reduce((s2, a) => s2 + a.valor, 0);
  const conserva = hoyLista.filter((a) => a.tag !== "vende");
  const totConserva = conserva.reduce((s2, a) => s2 + a.valor, 0);
  const canastaHoy = (f0.porActivo || []).filter(esCanasta).reduce((s2, a) => s2 + (a.valor || 0), 0);
  const despuesLista = [
    ...(f0.porActivo || []).filter((a) => !esCanasta(a)).map((a) => {
      const ap = aporteDe[a.id];
      if (esCiclo(a)) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "motor" };
      if (nuevasIds.has(a.id)) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "nuevo" };
      if (ap && ap.anio === 1) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "aporte", antes: ap.valorHoy || 0, aporte: ap.aporte };
      if (ap) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "aporteLuego", aporte: ap.aporte, anio: ap.anio };
      return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "igual" };
    }),
    ...(canastaHoy > 0.5 ? [{ id: "canastas", nombre: tx("Liquidez, colchón y lo que sobra", "Cash, cushion and leftover"), valor: canastaHoy, tag: "canasta" }] : []),
  ].filter((a) => a.valor > 0.5).sort((x, y) => y.valor - x.valor);
  const totDespues = despuesLista.reduce((s2, a) => s2 + a.valor, 0);
  const maxPort = Math.max(1, ...hoyLista.map((a) => a.valor), ...despuesLista.map((a) => a.valor));

  // ── 2 · Fuentes → destinos ─────────────────────────────────────────────────
  const fuentes = [
    ...vendidos.map((v, i) => ({ nombre: v.nombre, monto: v.valor, color: INF.serie[(i + 5) % INF.serie.length] })),
    ...(bd.capitalNuevo > 0 ? [{ nombre: tx("Capital nuevo", "New capital"), monto: bd.capitalNuevo, color: INF.navy }] : []),
    ...(bd.desdeLiquidez > 0 ? [{ nombre: tx("De tu liquidez", "From your cash"), monto: bd.desdeLiquidez, color: INF.gris }] : []),
  ].filter((x) => x.monto > 0.5);
  const totFuentes = fuentes.reduce((s, x) => s + x.monto, 0);

  const cuotasMes = r.cuotasQueSalenMes || 0;
  const destinos = [];
  if (bd.deudas > 0.5) destinos.push({
    key: "deudas", tipo: "deuda", nombre: tx("Pagar deudas", "Pay off debts"),
    sub: (r.deudas || []).filter((x) => x.pagado > 0).map((x) => x.nombre).join(", "),
    monto: bd.deudas, rinde: tx("Ahorras los intereses", "You save the interest"),
    pagaMes: cuotasMes, pagaEtq: tx("Dejas de pagar", "You stop paying"),
    serie: filas.map((f) => ({ v: 0, c: cuotasMes * 12 * f.anio })),
  });
  (r.reinversionesDetalle || []).filter((x) => x.aporte > 0).forEach((x) => {
    const s = serieDe(x.activoId);
    let ac = 0;
    const serie = s.map((a, t) => { if (t > 0) ac += a.renta || 0; return { v: a.valor || 0, c: ac }; });
    const tipo = x.rentaMensual > 0 || x.teLlegaMes > 0 ? (x.clase === "inmueble" ? "mixto" : "renta") : "crece";
    destinos.push({
      key: "re" + x.i, tipo, nombre: x.nombre,
      sub: x.valorHoy > 0.5 ? tx(`Ya vale ${fmM(x.valorHoy)} y le inviertes más`, `Already worth ${fmM(x.valorHoy)}, you add more`) : (x.anio > 1 ? tx(`Se invierte en ${anioCal(x.anio - 1)}`, `Invested in ${anioCal(x.anio - 1)}`) : ""),
      monto: x.aporte, base: x.valorHoy || 0,
      rinde: x.rendimientoPct != null ? fmPct(x.rendimientoPct, 1) + tx(" al año", " a year") : x.rentaPctAnual > 0 ? fmPct(x.rentaPctAnual, 1) + tx(" al año", " a year") : "—",
      pagaMes: x.rentaMensual || x.teLlegaMes || 0, desdeMes: x.rentaDesdeMes || 0, pagaEtq: tx("Te paga", "Pays you"),
      serie,
    });
  });
  (r.nuevasDetalle || []).filter((x) => x.monto > 0.5).forEach((x, k) => {
    const s = x.id ? serieDe(x.id) : filas.map(() => ({ valor: 0, renta: 0 }));
    let ac = 0;
    const serie = s.map((a, t) => { if (t > 0) ac += a.renta || 0; return { v: a.valor || 0, c: ac }; });
    const rentaMes = x.pagaRenta ? ((s[1]?.renta || 0) / 12) : 0;
    destinos.push({
      key: x.id || "nu" + k, tipo: x.pagaRenta ? "renta" : "crece", nombre: x.nombre, sub: x.anio > 1 ? tx(`Se invierte en ${anioCal(x.anio - 1)}`, `Invested in ${anioCal(x.anio - 1)}`) : "",
      monto: x.monto, rinde: fmPct(x.rendPct, 1) + tx(" al año", " a year"),
      pagaMes: rentaMes, pagaEtq: tx("Te paga", "Pays you"), serie,
    });
  });
  // Negocios que se repiten (asociativos): el capital sale una vez y trabaja en
  // ciclos; cada ciclo deja su ganancia. Santiago (7-nov): "actúa como motor…
  // cada año se vende lo construido y se reinvierte, y no sale en ninguna parte".
  const nomActivo = (id) => (id === "c_crecimiento" ? tx("Crecimiento (lo que sobra)", "Growth (leftover)") : id === "c_renta" ? tx("Renta fija (lo que sobra)", "Fixed income (leftover)") : id === "c_liquidez" ? tx("Liquidez y colchón", "Cash and cushion") : id === "c_disponible" ? tx("disponible", "available") : ((f0.porActivo || []).find((a) => a.id === id) || {}).nombre || null);
  (r.ciclosDetalle || []).filter((c) => c.capital > 0).forEach((c) => {
    const s0 = serieDe(c.id);
    let ac = 0;
    const serie = s0.map((a, t) => { if (t > 0) ac += (a.renta || 0) + (a.crece || 0); return { v: a.valor || 0, c: ac }; });
    destinos.push({
      key: c.id, tipo: "motor", nombre: c.nombre, ciclo: c, destinoNombre: c.destino !== "flujo" ? nomActivo(c.destinoId) : null,
      sub: c.desde > 1 ? tx(`Arranca en ${anioCal(c.desde)} · ${c.fuente === "nuevo" ? "con capital nuevo" : c.fuente === "liquidez" ? "de tu liquidez" : "apartado de la venta"}`, `Starts in ${anioCal(c.desde)} · ${c.fuente === "nuevo" ? "with new capital" : c.fuente === "liquidez" ? "from your cash" : "set aside from the sale"}`) : (c.meses === 12 ? tx("Un ciclo cada año", "One cycle a year") : tx(`Un ciclo cada ${c.meses} meses`, `One cycle every ${c.meses} months`)),
      monto: c.capital, rinde: fmPct(c.rentabilidadPct, 1) + tx(" al año, neto", " a year, net"),
      pagaMes: c.destino === "flujo" ? c.gananciaAnual / 12 : 0, pagaEtq: c.destino === "flujo" ? tx("Te paga", "Pays you") : tx("Reinvierte", "Reinvests"),
      pagaTxt: c.destino !== "flujo" ? `${fmM(c.gananciaAnual / 12)}${tx("/mes", "/mo")}` : null,
      desdeMes: c.desde > 1 ? (c.desde - 1) * 12 : 0, serie,
    });
  });
  const colchon = bd.colchon || 0, restante = bd.restante || 0;
  // Colchón + lo que sobra de las ventas: se abre en las tres canastas de la mezcla
  // (liquidez, renta fija, crecimiento), cada una con su curva. Las canastas también
  // reciben lo que sobra cada mes; la frase lo dice.
  const mz = r.mezcla || {};
  const sumMz = (mz.liquidez || 0) + (mz.renta || 0) + (mz.crecimiento || 0);
  const CAN = [
    ["c_liquidez", "caja", tx("Liquidez y colchón", "Cash and cushion"), colchon + (sumMz > 0 ? restante * (mz.liquidez || 0) / sumMz : restante)],
    ["c_renta", "crece", tx("Renta fija (lo que sobra)", "Fixed income (leftover)"), sumMz > 0 ? restante * (mz.renta || 0) / sumMz : 0],
    ["c_crecimiento", "crece", tx("Crecimiento (lo que sobra)", "Growth (leftover)"), sumMz > 0 ? restante * (mz.crecimiento || 0) / sumMz : 0],
  ];
  CAN.filter(([, , , m]) => m > 0.5).forEach(([id, tipo, nombre, m]) => {
    const s0 = serieDe(id);
    const tasa = (s0[0]?.valor || 0) > 0 ? (s0[1]?.crece || 0) / s0[0].valor * 100 : null;
    destinos.push({
      key: id, tipo, canasta: true, color: id === "c_renta" ? INF.morado : id === "c_crecimiento" ? INF.dorado : INF.gris, nombre, sub: id === "c_liquidez" && colchon > 0.5 ? tx(`Incluye ${fmM(colchon)} de colchón para imprevistos`, `Includes a ${fmM(colchon)} emergency cushion`) : tx("Lo que sobra de las ventas, según tu mezcla", "What's left from the sales, per your mix"),
      monto: m, rinde: tasa != null ? fmPct(tasa, 1) + tx(" al año", " a year") : "—", pagaMes: 0, pagaEtq: tx("Te paga", "Pays you"),
      serie: s0.map((a) => ({ v: a.valor || 0, c: 0 })),
    });
  });
  destinos.sort((a, b) => b.monto - a.monto);
  const totDest = destinos.reduce((s, x) => s + x.monto, 0);
  const diferencia = totFuentes - totDest;

  // ── 4 · Bolsillo mensual ───────────────────────────────────────────────────
  const flujo = destinos.filter((x) => x.pagaMes > 0.5).map((x) => ({ nombre: x.tipo === "deuda" ? tx("Cuotas que ya no pagas", "Payments you no longer make") : x.nombre, v: x.pagaMes, color: x.color || COL[x.tipo], desde: x.desdeMes }));
  const totFlujo = flujo.reduce((s, x) => s + x.v, 0);
  const maxFlujo = Math.max(1, ...flujo.map((x) => x.v));
  const ultimaRenta = Math.max(0, ...flujo.map((x) => x.desde || 0));

  // Valor final de lo invertido (sin la renta ya cobrada).
  const valorFin = destinos.reduce((s, x) => s + (x.serie ? x.serie[x.serie.length - 1].v : x.monto), 0);

  const ETQ = {
    deuda: tx("Te libera flujo", "Frees up cash flow"), renta: tx("Te paga cada mes", "Pays you monthly"),
    mixto: tx("Sube y te paga", "Grows and pays you"), crece: tx("Se multiplica", "Compounds"), caja: tx("Protección", "Safety"), motor: tx("Motor: se repite", "Engine: repeats"),
  };
  const FRASE = (x, ult) => {
    if (x.tipo === "motor") {
      const c = x.ciclo, cadaTxt = c.meses === 12 ? tx("Cada año", "Every year") : tx(`Cada ${c.meses} meses`, `Every ${c.meses} months`);
      const destTxt = c.destino === "flujo" ? tx("llega a tu flujo de caja", "reaches your cash flow") : (x.destinoNombre ? tx(`se reinvierte en ${x.destinoNombre}`, `is reinvested in ${x.destinoNombre}`) : tx("se reinvierte según tu mezcla", "is reinvested per your mix"));
      const fin2 = c.hasta < nAnios ? tx(` En ${anioCal(c.hasta + 1)} termina y el capital vuelve a tu bolsa.`, ` In ${anioCal(c.hasta + 1)} it ends and the capital comes back.`) : "";
      return tx(`${cadaTxt}: inviertes ${fmM(c.capital)}, al terminar vale ${fmM(c.valorFinal)} y, después de costos e impuesto, deja ${fmM(c.gananciaCiclo)}. Esa ganancia ${destTxt}; el capital vuelve a entrar al siguiente ciclo. En ${nAnios} años deja ${fmM(ult.c)}.${fin2}`,
        `${cadaTxt}: you put in ${fmM(c.capital)}, it ends worth ${fmM(c.valorFinal)} and, after costs and tax, leaves ${fmM(c.gananciaCiclo)}. That profit ${destTxt}; the capital goes into the next cycle. Over ${nAnios} years it leaves ${fmM(ult.c)}.${fin2}`);
    }
    if (x.tipo === "deuda") return tx(`La deuda desaparece y cada mes dejas de pagar ${fmM(x.pagaMes)}. En ${nAnios} años son ${fmM(ult.c)} que se quedan contigo.`, `The debt is gone and you stop paying ${fmM(x.pagaMes)} a month. Over ${nAnios} years that's ${fmM(ult.c)} that stays with you.`);
    if (x.canasta) return tx(`Arranca con ${fmM(x.monto)} de las ventas y cada año recibe parte de lo que te sobra del mes; por eso crece más que su rendimiento.`, `It starts with ${fmM(x.monto)} from the sales and each year gets part of your monthly surplus, so it grows faster than its return alone.`);
    const motores = (r.ciclosDetalle || []).filter((c) => c.destino !== "flujo" && c.destinoId === x.key).map((c) => c.nombre);
    const extra = motores.length ? tx(` Además recibe cada año la ganancia de «${motores.join("», «")}».`, ` It also receives the yearly profit from "${motores.join('", "')}".`) : "";
    if (x.tipo === "crece") return tx("No te paga mes a mes: todo lo que gana se queda adentro y vuelve a rendir. Por eso es el que más crece.", "It doesn't pay you monthly: everything it earns stays in and compounds. That's why it grows the most.") + extra;
    if (x.tipo === "renta") return tx(`Te deposita unos ${fmM(x.pagaMes)} al mes. En ${nAnios} años habrás cobrado ${fmM(ult.c)}.`, `It deposits about ${fmM(x.pagaMes)} a month. Over ${nAnios} years you'll collect ${fmM(ult.c)}.`);
    if (x.tipo === "mixto") return x.desdeMes > 0
      ? tx(`Los primeros ${x.desdeMes} meses no produce; después te paga ${fmM(x.pagaMes)} al mes y sigue valorizándose.`, `It earns nothing for the first ${x.desdeMes} months; then it pays you ${fmM(x.pagaMes)} a month and keeps appreciating.`)
      : tx(`Te paga ${fmM(x.pagaMes)} al mes y además se valoriza.`, `It pays you ${fmM(x.pagaMes)} a month and also appreciates.`);
    return tx("Plata a la mano para imprevistos y lo que sobra de las ventas, repartido según la mezcla que elegiste. Cada año suma también lo que te sobra del mes, por eso crece más que su rendimiento.", "Cash on hand for surprises plus what's left from the sales, split per the mix you picked. Each year it also adds your monthly surplus, so it grows faster than its return alone.");
  };

  const TAG = {
    vende: [tx("Se vende", "Sold"), INF.txTeja], igual: [tx("Igual que hoy", "Same as today"), INF.tx2], recibe: [tx("Se conserva y recibe más", "Kept, gets more"), INF.txDorado],
    nuevo: [tx("Nuevo · de la venta", "New · from the sale"), INF.azul], aporte: [tx("Tenías + de la venta", "You had + from the sale"), INF.txDorado],
    aporteLuego: [tx("Igual · recibe más luego", "Same · gets more later"), INF.txDorado], canasta: [tx("De la venta: colchón y sobrante", "From the sale: cushion and leftover"), INF.txOk],
    motor: [tx("Negocio que se repite · de la venta", "Repeating deal · from the sale"), INF.serie[6]],
  };
  const COLB = { vende: INF.teja, igual: INF.gris, recibe: INF.gris, nuevo: INF.azul, aporte: INF.dorado, aporteLuego: INF.gris, canasta: INF.oliva, motor: INF.serie[6] };
  const detalle = (a) => {
    if (a.tag === "vende") return <><b style={{ color: INF.tx }}>{tx("Por qué: ", "Why: ")}</b>{a.porque}</>;
    if (a.tag === "recibe") return a.ap.anio === 1 ? tx(`Le pones ${fmM(a.ap.aporte)} de la venta`, `You add ${fmM(a.ap.aporte)} from the sale`) : tx(`En ${anioCal(a.ap.anio - 1)} le pones ${fmM(a.ap.aporte)}`, `In ${anioCal(a.ap.anio - 1)} you add ${fmM(a.ap.aporte)}`);
    if (a.tag === "aporte") return tx(`Tenías ${fmM(a.antes)} + ${fmM(a.aporte)} de la venta`, `You had ${fmM(a.antes)} + ${fmM(a.aporte)} from the sale`);
    if (a.tag === "aporteLuego") return tx(`En ${anioCal(a.anio - 1)} recibe ${fmM(a.aporte)}`, `In ${anioCal(a.anio - 1)} it gets ${fmM(a.aporte)}`);
    if (a.tag === "nuevo") return tx("Se compra con la plata de la venta", "Bought with the sale proceeds");
    if (a.tag === "motor") return tx("Capital que trabaja: se construye, se vende y vuelve a entrar", "Working capital: build, sell, and go again");
    if (a.tag === "canasta") return tx("Lo que queda de la venta, repartido según tu mezcla", "What's left of the sale, split per your mix");
    return null;
  };
  const Portafolio = ({ titulo, total, lista, max }) => <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 14, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 12, fontWeight: 600, color: INF.tx2, letterSpacing: "0.06em" }}>{titulo}</span><b style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{fmM(total)}</b></div>
    {lista.map((a) => { const [etq, col] = TAG[a.tag]; const d = detalle(a); return <div key={a.id} style={{ padding: "7px 0", borderTop: `1px solid ${INF.linea}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
        <span style={{ ...chip(col), fontSize: 11 }}>{etq}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, height: 10, background: INF.panel, borderRadius: 3 }}><span style={{ display: "block", height: 10, width: `${Math.max(1, a.valor / max * 100)}%`, background: COLB[a.tag], borderRadius: 3 }} /></span>
        <b style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", minWidth: 72, textAlign: "right" }}>{fmM(a.valor)}</b>
      </div>
      {d && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 3, lineHeight: 1.4 }}>{d}</div>}
    </div>; })}
  </div>;

  const Barra = ({ items, total, etq }) => <div style={{ display: "flex", height: 44, borderRadius: 10, overflow: "hidden", gap: 2 }}>
    {items.map((x) => { const p = total > 0 ? x.monto / total * 100 : 0; return <div key={x.key || x.nombre} title={`${x.nombre}: ${fmM(x.monto)}`} style={{ flex: `${x.monto} 1 0`, minWidth: 3, background: x.color, display: "flex", alignItems: "center", padding: "0 10px", overflow: "hidden", color: "#fff", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{p >= 9 ? (etq ? etq(x, p) : `${Math.round(p)} %`) : ""}</div>; })}
  </div>;

  return (
    <div style={{ ...card, padding: "18px 20px 6px", marginBottom: 14, color: INF.tx }}>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 24 }}>
        {[
          [tx("Partes de", "You start with"), fmM(totHoy), tx(`${hoyLista.length} activos hoy`, `${hoyLista.length} assets today`), INF.tx],
          [tx("Vendes", "You sell"), fmM(totVend), tx(`${vendidos.length} activo${vendidos.length === 1 ? "" : "s"} · conservas ${fmM(totConserva)}`, `${vendidos.length} asset${vendidos.length === 1 ? "" : "s"} · you keep ${fmM(totConserva)}`), INF.txTeja],
          [tx("Después del plan tienes", "After the plan you own"), fmM(totDespues), bd.deudas > 0.5 ? tx(`${despuesLista.length} activos · y ${fmM(bd.deudas)} pagaron deudas`, `${despuesLista.length} assets · and ${fmM(bd.deudas)} paid off debts`) : tx(`${despuesLista.length} activos`, `${despuesLista.length} assets`), INF.txDorado],
          [tx(`En ${anioCal(nAnios)} vale`, `Worth in ${anioCal(nAnios)}`), fmM(fin.activos), tx(`todo tu portafolio · hoy ${fmM(totDespues)}`, `your whole portfolio · today ${fmM(totDespues)}`), INF.azul],
        ].map(([l, v, s2, c]) => <div key={l} style={{ background: "var(--fp-raised)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: INF.tx2 }}>{l}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: c, fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{v}</div>
          <div style={{ fontSize: 12, color: INF.tx2 }}>{s2}</div>
        </div>)}
      </div>

      <Paso n={1} color={INF.teja} titulo={tx("Tu portafolio: hoy y después del plan", "Your portfolio: today and after the plan")}
        sub={tx(`A la izquierda, lo que tienes hoy y qué pasa con cada activo. A la derecha, cómo queda tu portafolio el primer año del plan y de dónde sale el valor de cada uno.`, `Left: what you own today and what happens to each asset. Right: how your portfolio looks in year one of the plan and where each value comes from.`)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: 12 }}>
          <Portafolio titulo={tx("HOY", "TODAY")} total={totHoy} lista={hoyLista} max={maxPort} />
          <Portafolio titulo={tx("DESPUÉS DEL PLAN", "AFTER THE PLAN")} total={totDespues} lista={despuesLista} max={maxPort} />
        </div>
      </Paso>

      {destinos.length > 0 && <Paso n={2} color={INF.dorado} titulo={tx(`Los ${fmM(totFuentes)} de la venta: a dónde va cada ${esUS() ? "dólar" : "peso"}`, `The ${fmM(totFuentes)} from the sale: where every dollar goes`)}>
        <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: INF.tx2, marginBottom: 6 }}>{tx("DE DÓNDE SALE", "WHERE IT COMES FROM")} · {fmM(totFuentes)}</div>
          <Barra items={fuentes} total={totFuentes} etq={(x) => x.nombre} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", fontSize: 13, color: INF.tx2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v16M6 14l6 6 6-6" /></svg>
            {Math.abs(diferencia) > 0.5 ? (diferencia > 0
              ? tx(<>Quedan <b style={{ color: INF.tx }}>{fmM(diferencia)}</b> sin asignar: se suman a tu liquidez.</>, <><b style={{ color: INF.tx }}>{fmM(diferencia)}</b> left unassigned: it adds to your cash.</>)
              : tx(<>Faltan <b style={{ color: INF.txBad }}>{fmM(-diferencia)}</b>: lo que pides supera lo que vendes.</>, <><b style={{ color: INF.txBad }}>{fmM(-diferencia)}</b> short: you ask for more than you sell.</>))
              : tx("Todo se reparte así:", "It's all deployed like this:")}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: INF.tx2, marginBottom: 6 }}>{tx("A DÓNDE VA", "WHERE IT GOES")} · {fmM(totDest)}</div>
          <Barra items={destinos.map((x) => ({ ...x, color: x.color || COL[x.tipo] }))} total={totDest} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: "10px 16px", marginTop: 12 }}>
            {destinos.map((x) => <div key={x.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: x.color || COL[x.tipo], marginTop: 4, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{x.nombre}</div><div style={{ fontSize: 12.5, color: INF.tx2 }}>{fmM(x.monto)} · {fmPct(totDest > 0 ? x.monto / totDest * 100 : 0, 0)}</div></div>
            </div>)}
          </div>
        </div>
      </Paso>}

      {destinos.length > 0 && <Paso n={3} color={INF.azul} titulo={tx(`Cómo crece cada inversión en ${nAnios} años`, `How each investment grows over ${nAnios} years`)}
        sub={tx("Dorado: lo que vale la inversión. Azul: la renta que ya cobraste, acumulada. Verde: las cuotas que dejas de pagar, acumuladas. Morado: la ganancia que dejó un negocio que se repite, acumulada.", "Gold: what the investment is worth. Blue: income collected, cumulative. Green: payments you no longer make, cumulative. Purple: profit left by a repeating deal, cumulative.")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 12 }}>
          {destinos.filter((x) => x.serie && !(x.canasta && x.monto < totDest * 0.02)).map((x) => {
            const s = x.serie, ult = s[s.length - 1];
            const top = Math.max(1, ...s.map((p) => p.v + p.c));
            const inicio = x.monto + (x.base || 0);
            const final = x.tipo === "deuda" ? ult.c : ult.v + ult.c;
            const mult = x.tipo !== "deuda" && inicio > 0 ? final / inicio : null;
            const colC = x.tipo === "deuda" ? INF.oliva : x.tipo === "motor" ? INF.serie[6] : INF.azul;
            const colFin = x.tipo === "deuda" ? INF.txOk : x.tipo === "motor" ? INF.serie[6] : x.tipo === "crece" || x.tipo === "caja" ? INF.txDorado : INF.azul;
            const finEtq = x.tipo === "deuda" ? tx(`Dejas de pagar en ${nAnios} años`, `Not paid over ${nAnios} years`) : x.tipo === "motor" ? tx(`Capital + ganancia en ${nAnios} años`, `Capital + profit over ${nAnios} years`) : x.tipo === "crece" || x.tipo === "caja" ? tx(`Vale en ${anioCal(nAnios)}`, `Worth in ${anioCal(nAnios)}`) : tx(`Vale + cobraste en ${anioCal(nAnios)}`, `Worth + collected by ${anioCal(nAnios)}`);
            return <div key={x.key} style={{ background: "var(--fp-raised)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{x.nombre}</div>{x.sub && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 2 }}>{x.sub}</div>}</div>
                <span style={chip(colFin)}>{ETQ[x.tipo]}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                {[[tx("Inviertes", "You invest"), fmM(x.monto), INF.tx], [tx("Rinde", "Returns"), x.rinde, INF.tx], [x.pagaEtq, x.pagaMes > 0.5 ? `${fmM(x.pagaMes)}${tx("/mes", "/mo")}` : (x.pagaTxt || tx("$0 · se reinvierte", "$0 · reinvested")), x.pagaMes > 0.5 || x.pagaTxt ? colFin : INF.tx2]].map(([l, v, c]) =>
                  <div key={l} style={{ background: INF.panel, borderRadius: 10, padding: "8px 10px", minWidth: 0 }}><div style={{ fontSize: 11.5, color: INF.tx2 }}>{l}</div><div style={{ fontSize: 13.5, fontWeight: 700, color: c, overflowWrap: "anywhere" }}>{v}</div></div>)}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                <div><div style={{ fontSize: 12, color: INF.tx2 }}>{finEtq}</div><div style={{ fontSize: 22, fontWeight: 800, color: colFin, fontVariantNumeric: "tabular-nums" }}>{fmM(final)}</div></div>
                {mult != null && <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 800, color: colFin }}>×{num(mult, 1)}</div>}
              </div>
              <div role="img" aria-label={`${x.nombre}: ${fmM(inicio)} → ${fmM(final)}`} style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 96, borderBottom: `1px solid ${INF.eje}` }}>
                {s.map((p, t) => <div key={t} title={`${anioCal(t) || t}: ${fmM(p.v + p.c)}`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 1 }}>
                  {p.c > 0 && <div style={{ height: `${p.c / top * 100}%`, background: colC, borderRadius: "3px 3px 0 0" }} />}
                  {p.v > 0 && <div style={{ height: `${p.v / top * 100}%`, background: INF.dorado, borderRadius: p.c > 0 ? "0 0 2px 2px" : 3 }} />}
                </div>)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: INF.tx2, marginTop: -8 }}><span>{tx("Hoy", "Today")}</span><span>{anioCal(Math.round(nAnios / 2))}</span><span>{anioCal(nAnios)}</span></div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: INF.tx, background: INF.panel, borderRadius: 10, padding: "10px 12px" }}>{FRASE(x, ult)}</div>
            </div>;
          })}
        </div>
      </Paso>}

      {flujo.length > 0 && <Paso n={4} color={INF.oliva} titulo={tx("Lo que cambia en tu bolsillo cada mes", "What changes in your pocket each month")}>
        <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {flujo.map((x) => <div key={x.nombre} style={{ display: "grid", gridTemplateColumns: "minmax(110px,32%) 1fr auto", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }}>{x.nombre}{x.desde > 0 && <span style={{ display: "block", fontSize: 11.5, color: INF.tx2, fontWeight: 400 }}>{tx(`desde el mes ${x.desde}`, `from month ${x.desde}`)}</span>}</span>
            <span style={{ height: 18, background: INF.panel, borderRadius: 6, overflow: "hidden" }}><span style={{ display: "block", height: 18, width: `${x.v / maxFlujo * 100}%`, background: x.color, borderRadius: 6 }} /></span>
            <b style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>+{fmM(x.v)}</b>
          </div>)}
          <div style={{ borderTop: `1px solid ${INF.linea}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: INF.tx2 }}>{tx("Te entra o te dejas de gastar, cada mes", "Comes in or stops going out, each month")}</span>
            <b style={{ fontSize: 22, color: INF.azul }}>+{fmM(totFlujo)}{tx(" / mes", " / mo")}</b>
          </div>
        </div>
      </Paso>}
    </div>
  );
}
