// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · Qué haces con tu plata (capítulo 2 del informe de un escenario)
//
// 7-nov-2026 (Santiago: "esta sección debería mostrar la historia completa que
// se hizo con el dinero: las inversiones actuales, cuáles se vendieron, hacia
// dónde fue el dinero, en qué se invirtió, cuánto se invirtió ahí, cuánto
// renta y en 10 años cuánto crece… muy didáctica, muy infografía").
//
// 23-nov-2026 (Santiago: "una parte de la sección te muestra por año, lo cual es
// súper bien, pero en Qué haces con tu plata, puntos 1 al 4, solo está
// mostrando 2026… no debería mostrar también cada año, para que todo tenga el
// mismo lenguaje?"). Los cuatro pasos siguen el año elegido (el mismo selector
// de los capítulos 3 y 4) y responden, cada uno, una pregunta de ese año:
//   1 · ¿Qué pasa con tu portafolio? Al empezar el año y al terminarlo.
//   2 · ¿De dónde sale y a dónde va la plata del año? La misma cuenta del paso 3
//       (cuentaPorAnio): viene del año anterior + lo que sobra + lo que llega −
//       lo que usas = queda.
//   3 · ¿Cómo crece cada inversión? El año elegido resaltado; lo que viene, tenue.
//       Lo que empieza después dice desde cuándo (antes salía en $0).
//   4 · ¿Qué cambia en tu bolsillo cada mes ese año? Solo lo que ya empezó; lo
//       que empieza después, apagado y con su año. Y el promedio de los 10 años.
// No calcula nada nuevo: lee el resultado del motor (proyectarFuturo10).
// ═══════════════════════════════════════════════════════════════════════════
import { anioCal, cuentaPorAnio } from "../../lib/futuro10.js";
import { INF, fmM, fmPct } from "../../lib/informeTheme.js";
import { tx, num } from "../../lib/region.js";

// queda (lo que pasa al año siguiente) y «viene de» llevan el mismo color: es la misma plata.
const COL = { deuda: INF.oliva, renta: INF.azul, crece: INF.dorado, mixto: INF.serie[4], caja: INF.gris, motor: INF.serie[6], obra: INF.teja, pago: INF.teja, queda: INF.navy, sobra: INF.oliva, falta: INF.teja };
const card = { background: INF.panel, border: `1px solid ${INF.linea}`, borderRadius: 14, padding: 18 };
const paso = (n, color) => ({ width: 30, height: 30, borderRadius: 15, background: color, color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });
const chip = (color) => ({ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", color, border: `1px solid ${color}` });
const cifra = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function Paso({ n, color, titulo, sub, children }) {
  return <section style={{ marginBottom: 26 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: sub ? 2 : 12 }}>
      <div style={paso(n, color)}>{n}</div>
      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: INF.tx, letterSpacing: "-0.01em" }}>{titulo}</h3>
    </div>
    {sub && <p style={{ margin: "0 0 12px 40px", fontSize: 13, color: INF.tx2, lineHeight: 1.5 }}>{sub}</p>}
    {children}
  </section>;
}

export default function HistoriaPlata({ r, anio = 1 }) {
  const filas = r.filas || [];
  if (filas.length < 2) return null;
  const f0 = filas[0], fin = filas[filas.length - 1];
  const nAnios = fin.anio;
  const t = Math.min(Math.max(1, Math.round(Number(anio)) || 1), nAnios);
  const bd = r.bolsaDetalle || {};
  const hoyT = t === 1;
  // «en 2026 (hoy)» / «en 2027»: así se nombra el año en todo el capítulo.
  const enAnio = (k) => (k <= 1 ? tx(`en ${anioCal(1)} (hoy)`, `in ${anioCal(1)} (today)`) : tx(`en ${anioCal(k)}`, `in ${anioCal(k)}`));
  const EnAnio = (k) => { const s = enAnio(k); return s.charAt(0).toUpperCase() + s.slice(1); };
  const vendIds = new Set((r.vendidos || []).map((v) => v.id));
  const serieDe = (id) => filas.map((f) => (f.porActivo || []).find((a) => a.id === id) || { valor: 0, renta: 0, rentaNueva: 0, crece: 0 });
  const usos = (bd.usos || []).filter((u) => u.monto > 0.5);
  const usoDe = (nombre, k) => usos.filter((u) => u.nombre === nombre && (u.anio || 1) === k && !(k === 1 && u.apartado)).reduce((s, u) => s + u.monto, 0);
  const mz = r.mezcla || {};
  const reservaTxt = (r.reserva || 0) > 0.5 ? tx(` Incluye ${fmM(r.reserva)} que dejas para imprevistos.`, ` Includes ${fmM(r.reserva)} kept for emergencies.`) : "";
  const mezclaTxt = tx(`${Math.round(mz.liquidez || 0)} % liquidez, ${Math.round(mz.renta || 0)} % renta fija y ${Math.round(mz.crecimiento || 0)} % crecimiento`, `${Math.round(mz.liquidez || 0)}% cash, ${Math.round(mz.renta || 0)}% fixed income and ${Math.round(mz.crecimiento || 0)}% growth`);

  // ── Lo vendido hoy y por qué ──────────────────────────────────────────────
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

  // ── 1 · Tu portafolio al empezar y al terminar el año ─────────────────────
  const esCanasta = (a) => a.clase === "canasta";
  const esCiclo = (a) => a.clase === "ciclo";
  const nuevasDe = (k) => (r.nuevasDetalle || []).filter((x) => x.id && (x.anio || 1) === k);
  const aportesDe = (k) => (r.reinversionesDetalle || []).filter((x) => x.aporte > 0 && (x.anio || 1) === k);
  const salenDe = (k) => (r.liberados || []).filter((l) => l.anio === k);
  const futuroDe = (id) => { const m = /^futuro_(\d+)$/.exec(String(id || "")); return m ? ((r.futuros || {}).activos || [])[Number(m[1])] : null; };
  const nuevasIds = new Set((r.nuevasDetalle || []).filter((x) => x.id).map((x) => x.id));
  const orden = (l) => l.filter((a) => a.valor > 0.5).sort((x, y) => y.valor - x.valor);
  const canastasDe = (f, det) => { const v = (f.porActivo || []).filter(esCanasta).reduce((s, a) => s + (a.valor || 0), 0); return v > 0.5 ? [{ id: "canastas", nombre: tx("Liquidez, colchón y lo que sobra", "Cash, cushion and leftover"), valor: v, tag: "canasta", det }] : []; };
  let inicio;
  if (hoyT) {
    // Hoy, antes del plan: lo que vendes (con su porqué) y lo que conservas (con su valor de antes).
    const ap1 = Object.fromEntries(aportesDe(1).map((x) => [x.activoId, x]));
    inicio = orden([
      ...vendidos.map((v) => ({ id: v.id, nombre: v.nombre, valor: v.valor, tag: "vende", det: <><b style={{ color: INF.tx }}>{tx("Por qué: ", "Why: ")}</b>{v.porque}</> })),
      ...(f0.porActivo || []).filter((a) => !esCanasta(a) && !esCiclo(a) && !nuevasIds.has(a.id) && !vendIds.has(a.id) && !futuroDe(a.id)).map((a) => {
        const ap = ap1[a.id];
        const valor = (ap ? (ap.valorHoy || 0) : a.valor) + (a.deLiquidez || 0);
        if (a.deLiquidez > 0.5) return { id: a.id, nombre: a.nombre, valor, tag: "usa", det: tx(`De aquí salen ${fmM(a.deLiquidez)} para el plan`, `${fmM(a.deLiquidez)} comes out of here for the plan`) };
        if (ap) return { id: a.id, nombre: a.nombre, valor, tag: "recibe", det: tx(`Le pones ${fmM(ap.aporte)} hoy`, `You add ${fmM(ap.aporte)} today`) };
        return { id: a.id, nombre: a.nombre, valor, tag: "igual" };
      }),
    ]);
  } else {
    const f = filas[t - 1], sal = salenDe(t), ap = aportesDe(t);
    inicio = orden([
      ...(f.porActivo || []).filter((a) => !esCanasta(a)).map((a) => {
        const v = sal.find((x) => x.id === a.id), ret = sal.find((x) => x.id === a.id + "_retiro"), apo = ap.find((x) => x.activoId === a.id);
        if (v) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "vende", det: v.pagoDeuda > 0.5 ? tx(`Te deja ${fmM(v.monto)}, ya pagada su deuda de ${fmM(v.pagoDeuda)}`, `Leaves you ${fmM(v.monto)}, after paying its ${fmM(v.pagoDeuda)} debt`) : tx(`Te deja ${fmM(v.monto)}`, `Leaves you ${fmM(v.monto)}`) };
        if (ret) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "usa", det: tx(`Sacas ${fmM(ret.monto)} ${enAnio(t)}`, `You take out ${fmM(ret.monto)} ${enAnio(t)}`) };
        if (apo) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "recibe", det: tx(`${EnAnio(t)} le pones ${fmM(usoDe(apo.nombre, t) || apo.aporte)}`, `${EnAnio(t)} you add ${fmM(usoDe(apo.nombre, t) || apo.aporte)}`) };
        return { id: a.id, nombre: a.nombre, valor: a.valor, tag: esCiclo(a) ? "motor" : "igual" };
      }),
      ...canastasDe(f, tx("Lo que no has usado, invertido según tu mezcla", "What you haven't used, invested per your mix")),
    ]);
  }
  const fFin = filas[t];
  const nuT = nuevasDe(t), apT = aportesDe(t);
  const finLista = orden([
    ...(fFin.porActivo || []).filter((a) => !esCanasta(a)).map((a) => {
      const n1 = nuT.find((x) => x.id === a.id), apo = apT.find((x) => x.activoId === a.id), fu = futuroDe(a.id);
      if (esCiclo(a)) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "motor" };
      if (n1) { const m = usoDe(n1.nombre, t) || n1.monto; return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "nuevo", det: m < n1.monto - 0.5 ? tx(`${EnAnio(t)} inviertes ${fmM(m)}, de ${fmM(n1.monto)} en total`, `${EnAnio(t)} you invest ${fmM(m)}, of ${fmM(n1.monto)} in total`) : tx(`Inviertes ${fmM(n1.monto)} ${enAnio(t)}`, `You invest ${fmM(n1.monto)} ${enAnio(t)}`) }; }
      if (apo) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "aporte", det: hoyT && apo.valorHoy > 0.5 ? tx(`Tenías ${fmM(apo.valorHoy)} + le pones ${fmM(apo.aporte)}`, `You had ${fmM(apo.valorHoy)} + you add ${fmM(apo.aporte)}`) : tx(`${EnAnio(t)} le pones ${fmM(usoDe(apo.nombre, t) || apo.aporte)}`, `${EnAnio(t)} you add ${fmM(usoDe(apo.nombre, t) || apo.aporte)}`) };
      if (fu) { const pg = (fu.pagos || []).filter((p) => p.anio === t).reduce((s, p) => s + p.monto, 0); return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "compra", det: fu.entrega === t ? tx(`Te lo entregan ${enAnio(t)}`, `Delivered ${enAnio(t)}`) : pg > 0.5 ? tx(`${EnAnio(t)} pagas ${fmM(pg)}`, `${EnAnio(t)} you pay ${fmM(pg)}`) : null }; }
      if (hoyT && a.deLiquidez > 0.5) return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "menos", det: tx(`Sacaste ${fmM(a.deLiquidez)} para el plan`, `You took ${fmM(a.deLiquidez)} out for the plan`) };
      return { id: a.id, nombre: a.nombre, valor: a.valor, tag: "igual" };
    }),
    ...canastasDe(fFin, hoyT ? tx("Lo que queda de la venta y lo que te sobra en el año, según tu mezcla", "What's left of the sale plus the year's surplus, per your mix") : tx("Lo que te sobra y no usas, según tu mezcla", "Your surplus you don't use, per your mix")),
  ]);
  const totIni = inicio.reduce((s, a) => s + a.valor, 0), totFinL = finLista.reduce((s, a) => s + a.valor, 0);
  const maxPort = Math.max(1, ...inicio.map((a) => a.valor), ...finLista.map((a) => a.valor));
  const TAG = {
    vende: [hoyT ? tx("Se vende", "Sold") : tx("Se vende o termina", "Sold or ends"), INF.txTeja], igual: [tx("Sigue igual", "Stays"), INF.tx2],
    recibe: [tx("Recibe más este año", "Gets more this year"), INF.txDorado], nuevo: [tx("Nueva este año", "New this year"), INF.azul],
    aporte: [tx("Le pones más este año", "You add more this year"), INF.txDorado], canasta: [tx("Lo que no usas", "What you don't use"), INF.txOk],
    motor: [tx("Proyecto que se repite", "Repeating project"), INF.serie[6]], usa: [tx("Sacas una parte", "You take out part"), INF.txTeja],
    menos: [tx("Lo que queda", "What's left"), INF.tx2], compra: [tx("Compra de Lo que viene", "Upcoming purchase"), INF.txDorado],
  };
  const COLB = { vende: INF.teja, igual: INF.gris, recibe: INF.gris, nuevo: INF.azul, aporte: INF.dorado, canasta: INF.oliva, motor: INF.serie[6], usa: INF.gris, menos: INF.gris, compra: INF.dorado };
  const Portafolio = ({ titulo, total, lista }) => <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10 }}><span style={{ fontSize: 13, fontWeight: 600, color: INF.tx2 }}>{titulo}</span><b style={{ ...cifra, fontSize: 18 }}>{fmM(total)}</b></div>
    {lista.map((a) => { const [etq, col] = TAG[a.tag]; return <div key={a.id} style={{ padding: "8px 0", borderTop: `1px solid ${INF.linea}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</span>
        <span style={{ ...chip(col), fontSize: 11 }}>{etq}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, height: 10, background: INF.panel, borderRadius: 3 }}><span style={{ display: "block", height: 10, width: `${Math.max(1, a.valor / maxPort * 100)}%`, background: COLB[a.tag], borderRadius: 3 }} /></span>
        <b style={{ ...cifra, fontSize: 13.5, minWidth: 72, textAlign: "right" }}>{fmM(a.valor)}</b>
      </div>
      {a.det && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 3, lineHeight: 1.4 }}>{a.det}</div>}
    </div>; })}
  </div>;

  // ── 2 · De dónde sale y a dónde va la plata del año ───────────────────────
  // Hoy: lo que vendes (y el capital nuevo, y lo que sale de tu liquidez) → deudas,
  // inversiones, obras, colchón y lo que queda. Años siguientes: la cuenta del paso 3.
  const nombreNueva = Object.fromEntries((r.nuevasDetalle || []).map((x) => [x.nombre, x]));
  const nombreReinv = Object.fromEntries((r.reinversionesDetalle || []).map((x) => [x.nombre, x]));
  const colorUso = (nombre, seccion) => {
    if (seccion === "D") return COL.motor;
    const nu = nombreNueva[nombre], re = nombreReinv[nombre];
    if (re && (re.rentaMensual > 0 || re.teLlegaMes > 0)) return re.clase === "inmueble" ? COL.mixto : COL.renta;
    if (nu && nu.pagaRenta) return COL.renta;
    return COL.crece;
  };
  let fuentes, destinos, queda = 0, cuenta = null;
  if (hoyT) {
    fuentes = [
      ...vendidos.map((v, i) => ({ key: "v" + v.id, nombre: v.nombre, monto: v.valor, color: INF.serie[(i + 5) % INF.serie.length] })),
      ...((bd.capitalNuevoHoy ?? bd.capitalNuevo) > 0.5 ? [{ key: "cn", nombre: tx("Capital nuevo", "New capital"), monto: bd.capitalNuevoHoy ?? bd.capitalNuevo, color: INF.navy }] : []),
      ...(bd.desdeLiquidez > 0.5 ? [{ key: "lq", nombre: tx("De tu liquidez", "From your cash"), monto: bd.desdeLiquidez, color: INF.gris }] : []),
      ...(bd.pendienteAnio1 > 0.5 ? [{ key: "pa", nombre: tx(`De lo que entra en ${anioCal(1)}`, `From what comes in during ${anioCal(1)}`), monto: bd.pendienteAnio1, color: INF.serie[3] }] : []),
    ];
    const grupos = {};
    usos.filter((u) => (u.anio || 1) === 1 || u.apartado).forEach((u) => {
      const apartado = (u.anio || 1) > 1;
      const k = (apartado ? "ap:" : u.seccion + ":") + u.nombre;
      const g = grupos[k] = grupos[k] || { key: k, nombre: apartado ? tx(`Apartas para ${u.nombre} (${anioCal(u.anio)})`, `Set aside for ${u.nombre} (${anioCal(u.anio)})`) : u.nombre, monto: 0, color: apartado ? INF.gris : colorUso(u.nombre, u.seccion) };
      g.monto += apartado ? (u.deVenta || 0) + (u.deCuentas || 0) : u.monto;
    });
    queda = bd.restante || 0;
    destinos = [
      ...(bd.deudas > 0.5 ? [{ key: "deudas", tipo: "deuda", nombre: tx("Pagar deudas", "Pay off debts"), sub: (r.deudas || []).filter((x) => x.pagado > 0).map((x) => x.nombre).join(", "), monto: bd.deudas, color: COL.deuda }] : []),
      ...Object.values(grupos).filter((g) => g.monto > 0.5),
      ...(bd.obras > 0.5 ? [{ key: "obras", nombre: tx("Obras", "Build-outs"), monto: bd.obras, color: COL.obra }] : []),
      ...(bd.colchon > 0.5 ? [{ key: "colchon", tipo: "colchon", nombre: tx("Colchón para imprevistos", "Emergency cushion"), monto: bd.colchon, color: INF.gris }] : []),
      ...(queda > 0.5 ? [{ key: "queda", nombre: tx(`Queda: pasa a ${anioCal(2)}`, `Left: carries to ${anioCal(2)}`), sub: tx(`Mientras tanto se invierte: ${mezclaTxt}.`, `Meanwhile it's invested: ${mezclaTxt}.`) + reservaTxt, monto: queda, color: COL.queda, queda: true }] : []),
    ].sort((a, b) => (a.queda ? 1 : 0) - (b.queda ? 1 : 0) || b.monto - a.monto);
  } else {
    cuenta = (cuentaPorAnio(r) || []).find((g) => g.anio === t) || null;
    const g = cuenta || { antes: 0, flujoHoy: 0, flujo: 0, llegan: [], salen: [], saldo: 0 };
    fuentes = [
      ...(g.antes > 0.5 ? [{ key: "antes", nombre: tx(`Viene de ${anioCal(t - 1)}`, `Carried from ${anioCal(t - 1)}`), monto: g.antes, color: COL.queda }] : []),
      ...(g.flujoHoy > 0.5 ? [{ key: "fh", nombre: tx(`Lo que te sobró en ${anioCal(1)}`, `Your ${anioCal(1)} surplus`), monto: g.flujoHoy, color: COL.sobra }] : []),
      ...(g.flujo > 0.5 ? [{ key: "fl", nombre: tx(`Lo que te sobra en ${anioCal(t)}`, `Your ${anioCal(t)} surplus`), monto: g.flujo, color: COL.sobra }] : []),
      ...g.llegan.map((l, i) => ({ key: "l" + l.id, nombre: String(l.id).endsWith("_retiro") ? tx(`Sacas de ${l.nombre}`, `Taken out of ${l.nombre}`) : tx(`Venta de ${l.nombre}`, `Sale of ${l.nombre}`), monto: l.monto, color: INF.serie[(i + 5) % INF.serie.length] })),
    ].filter((x) => x.monto > 0.5);
    queda = g.saldo;
    destinos = [
      ...g.salen.map((u, i) => ({ key: "s" + i, tipo: u.tipo === "A" ? "deuda" : u.tipo === "F" ? "pago" : "inversion", nombre: u.nombre, monto: u.monto, color: u.tipo === "A" ? COL.deuda : u.tipo === "F" ? COL.pago : colorUso(u.nombre.replace(/^(Invertir en|Invest in) /, ""), u.tipo) })),
      ...(g.flujo < -0.5 ? [{ key: "falta", tipo: "falta", nombre: tx(`Lo que falta para tus gastos de ${anioCal(t)}`, `Shortfall for your ${anioCal(t)} expenses`), monto: -g.flujo, color: COL.falta }] : []),
      ...(g.saldo > 0.5 ? [{ key: "queda", nombre: t < nAnios ? tx(`Queda: pasa a ${anioCal(t + 1)}`, `Left: carries to ${anioCal(t + 1)}`) : tx("Queda invertido", "Stays invested"), sub: tx(`Mientras tanto se invierte: ${mezclaTxt}.`, `Meanwhile it's invested: ${mezclaTxt}.`) + reservaTxt, monto: g.saldo, color: COL.queda, queda: true }] : []),
    ].filter((x) => x.monto > 0.5);
  }
  const totFuentes = fuentes.reduce((s, x) => s + x.monto, 0);
  const totDest = destinos.reduce((s, x) => s + x.monto, 0);
  const usado = destinos.filter((x) => !x.queda).reduce((s, x) => s + x.monto, 0);
  const diferencia = totFuentes - totDest;

  // ── Cada inversión del plan (todas, de todos los años) ────────────────────
  // Deudas: la cuota de cada una deja de salir desde el año en que el plan la paga
  // y hasta el año en que se habría acabado sola (después ya no cambia nada).
  const deudasPlan = (r.deudas || []).filter((d) => (d.cuotaMes || 0) > 0.5 && !d.finPorCuota && d.finAnio != null);
  const libreDeuda = (k) => deudasPlan.filter((d) => d.finAnio <= k && (d.finNatural == null || k < d.finNatural)).reduce((s, d) => s + d.cuotaMes, 0);
  const nombresLibres = (k) => deudasPlan.filter((d) => d.finAnio <= k && (d.finNatural == null || k < d.finNatural)).map((d) => d.nombre);
  const deudaLuego = (r.deudas || []).filter((d) => (d.pagaAnio || 0) > 1).reduce((s, d) => s + (d.pagoEnAnio || 0), 0) + (r.liberados || []).reduce((s, l) => s + (l.pagoDeuda || 0), 0);
  const montoDeudas = (bd.deudas || 0) + deudaLuego;
  const cards = [];
  if (montoDeudas > 0.5 || deudasPlan.length) {
    let ac = 0;
    const serie = filas.map((f, k) => { if (k > 0) ac += libreDeuda(k) * 12; return { v: 0, c: ac }; });
    const desde = deudasPlan.length ? Math.min(...deudasPlan.map((d) => Math.max(1, d.finAnio))) : 1;
    cards.push({ key: "deudas", tipo: "deuda", nombre: tx("Pagar deudas", "Pay off debts"), sub: (r.deudas || []).filter((d) => !d.finPorCuota && d.finAnio != null && (d.pagado > 0.5 || d.pagoEnAnio > 0.5 || d.ventaAnio)).map((d) => `${d.nombre} (${d.finAnio <= 1 ? tx("hoy", "today") : anioCal(d.finAnio)})`).join(", "),
      monto: montoDeudas, rinde: tx("Ahorras los intereses", "You save the interest"), desde, mes: libreDeuda, pagaEtq: tx("Dejas de pagar", "You stop paying"), serie });
  }
  // Lo que ya tenías y le metes más: una tarjeta por activo con todos sus aportes (uno por año).
  const porActivoRe = {};
  (r.reinversionesDetalle || []).filter((x) => x.aporte > 0 && !x.aNueva).forEach((x) => { (porActivoRe[x.activoId] = porActivoRe[x.activoId] || []).push(x); });
  const aportesTxt = (lista) => lista.map((y) => tx(`${fmM(y.aporte)} ${(y.anio || 1) <= 1 ? "hoy" : "en " + anioCal(y.anio)}`, `${fmM(y.aporte)} ${(y.anio || 1) <= 1 ? "today" : "in " + anioCal(y.anio)}`)).join(tx(" y ", " and "));
  Object.values(porActivoRe).forEach((lista) => {
    lista.sort((a, b) => (a.anio || 1) - (b.anio || 1));
    const x = lista[0];
    const s = serieDe(x.activoId);
    let ac = 0;
    const serie = s.map((a, k) => { if (k > 0) ac += a.renta || 0; return { v: a.valor || 0, c: ac }; });
    const paga = lista.some((y) => y.rentaMensual > 0 || y.teLlegaMes > 0) || s.some((a, k) => k > 0 && (a.rentaNueva || 0) > 0.5);
    const tipo = paga ? (x.clase === "inmueble" ? "mixto" : "renta") : "crece";
    const an = x.anio || 1;
    const det = lista.find((y) => y.rendimientoPct != null) || x;
    cards.push({ key: "re" + x.activoId, tipo, nombre: x.nombre,
      sub: x.valorHoy > 0.5 ? tx(`Ya lo tienes · le pones ${aportesTxt(lista)}`, `Already yours · you add ${aportesTxt(lista)}`) : (an > 1 ? tx(`Se invierte en ${anioCal(an)}`, `Invested in ${anioCal(an)}`) : ""),
      monto: lista.reduce((t2, y) => t2 + y.aporte, 0), base: x.valorHoy || 0, desde: an, extra: lista.map((y) => ({ anio: y.anio || 1, monto: y.aporte })),
      rinde: det.rendimientoPct != null ? fmPct(det.rendimientoPct, 1) + tx(" al año", " a year") : x.rentaPctAnual > 0 ? fmPct(x.rentaPctAnual, 1) + tx(" al año", " a year") : x.valorizacionPct != null ? fmPct(x.valorizacionPct, 1) + tx(" al año + renta", " a year + rent") : "—",
      mes: (k) => (s[k]?.rentaNueva || 0) / 12, pagaEtq: tx("Te paga", "Pays you"), serie });
  });
  // Lo creado en el plan, con lo que le metes después (23-nov-2026: «ampliar los fondos de renta»).
  const masANueva = (id) => (r.reinversionesDetalle || []).filter((y) => y.aNueva && y.activoId === id && y.aporte > 0).sort((a, b) => a.anio - b.anio);
  (r.nuevasDetalle || []).filter((x) => x.monto > 0.5).forEach((x, k0) => {
    const s = x.id ? serieDe(x.id) : filas.map(() => ({ valor: 0, renta: 0 }));
    let ac = 0;
    const serie = s.map((a, k) => { if (k > 0) ac += a.renta || 0; return { v: a.valor || 0, c: ac }; });
    const mas = x.id ? masANueva(x.id) : [];
    const subBase = (x.anio || 1) > 1 ? tx(`Se invierte en ${anioCal(x.anio)}`, `Invested in ${anioCal(x.anio)}`) : "";
    cards.push({ key: x.id || "nu" + k0, tipo: x.pagaRenta ? "renta" : "crece", nombre: x.nombre,
      sub: [subBase, mas.length ? tx(`le metes ${aportesTxt(mas)} más`, `you add ${aportesTxt(mas)} more`) : ""].filter(Boolean).join(" · "),
      monto: x.monto + mas.reduce((t2, y) => t2 + y.aporte, 0), desde: x.anio || 1, extra: [{ anio: x.anio || 1, monto: x.monto }, ...mas.map((y) => ({ anio: y.anio, monto: y.aporte }))],
      rinde: fmPct(x.rendPct, 1) + tx(" al año", " a year"),
      mes: (k) => (x.pagaRenta ? (s[k]?.renta || 0) / 12 : 0), pagaEtq: tx("Te paga", "Pays you"), serie });
  });
  const nomActivo = (id) => (id === "c_crecimiento" ? tx("Crecimiento (lo que sobra)", "Growth (leftover)") : id === "c_renta" ? tx("Renta fija (lo que sobra)", "Fixed income (leftover)") : id === "c_liquidez" ? tx("Liquidez y colchón", "Cash and cushion") : id === "c_disponible" ? tx("disponible", "available") : ((f0.porActivo || []).find((a) => a.id === id) || {}).nombre || null);
  (r.ciclosDetalle || []).filter((c) => c.capital > 0).forEach((c) => {
    const s0 = serieDe(c.id);
    let ac = 0;
    const serie = s0.map((a, k) => { if (k > 0) ac += (a.renta || 0) + (a.crece || 0); return { v: a.valor || 0, c: ac }; });
    cards.push({ key: c.id, tipo: "motor", nombre: c.nombre, ciclo: c, destinoNombre: c.destino !== "flujo" ? nomActivo(c.destinoId) : null,
      sub: c.desde > 1 ? tx(`Arranca en ${anioCal(c.desde)}`, `Starts in ${anioCal(c.desde)}`) : (c.meses === 12 ? tx("Un ciclo cada año", "One cycle a year") : tx(`Un ciclo cada ${c.meses} meses`, `One cycle every ${c.meses} months`)),
      monto: c.capital, desde: c.desde || 1, rinde: fmPct(c.rentabilidadPct, 1) + tx(" al año, neto", " a year, net"),
      mes: (k) => (c.destino === "flujo" ? (s0[k]?.renta || 0) / 12 : 0), pagaEtq: c.destino === "flujo" ? tx("Te paga", "Pays you") : tx("Reinvierte", "Reinvests"),
      pagaTxt: c.destino !== "flujo" ? `${fmM(c.gananciaAnual / 12)}${tx("/mes", "/mo")}` : null, serie });
  });
  const colchon = bd.colchon || 0, restante = bd.restante || 0;
  const sumMz = (mz.liquidez || 0) + (mz.renta || 0) + (mz.crecimiento || 0);
  [
    ["c_liquidez", "caja", tx("Liquidez y colchón", "Cash and cushion"), colchon + (sumMz > 0 ? restante * (mz.liquidez || 0) / sumMz : restante)],
    ["c_renta", "crece", tx("Renta fija (lo que sobra)", "Fixed income (leftover)"), sumMz > 0 ? restante * (mz.renta || 0) / sumMz : 0],
    ["c_crecimiento", "crece", tx("Crecimiento (lo que sobra)", "Growth (leftover)"), sumMz > 0 ? restante * (mz.crecimiento || 0) / sumMz : 0],
  ].filter(([, , , m]) => m > 0.5).forEach(([id, tipo, nombre, m]) => {
    const s0 = serieDe(id);
    const tasa = (s0[0]?.valor || 0) > 0 ? (s0[1]?.crece || 0) / s0[0].valor * 100 : null;
    cards.push({ key: id, tipo, canasta: true, nombre, sub: id === "c_liquidez" && colchon > 0.5 ? tx(`Incluye ${fmM(colchon)} de colchón para imprevistos`, `Includes a ${fmM(colchon)} emergency cushion`) : tx("Lo que sobra de las ventas, según tu mezcla", "What's left from the sales, per your mix"),
      monto: m, desde: 1, rinde: tasa != null ? fmPct(tasa, 1) + tx(" al año", " a year") : "—", mes: () => 0, pagaEtq: tx("Te paga", "Pays you"),
      serie: s0.map((a) => ({ v: a.valor || 0, c: 0 })) });
  });
  cards.sort((a, b) => (a.desde || 1) - (b.desde || 1) || b.monto - a.monto);
  const primerPago = (x, desdeK) => { for (let k = desdeK; k <= nAnios; k++) if (Math.abs(x.mes(k)) > 0.5) return k; return null; };

  // ── 4 · El bolsillo del año ───────────────────────────────────────────────
  // Además de las inversiones: la renta que cambias en el paso 1 desde un año (un local
  // que vas a arrendar, la bodega que construyes), aunque no le metas plata.
  const idsCards = new Set([...(r.reinversionesDetalle || []).map((x) => x.activoId), ...(r.nuevasDetalle || []).map((x) => x.id), ...(r.ciclosDetalle || []).map((c) => c.id)].filter(Boolean));
  const otrasRentas = {};
  filas.forEach((f, k) => { if (k > 0) (f.porActivo || []).forEach((a) => { if (!idsCards.has(a.id) && !esCanasta(a) && Math.abs(a.rentaNueva || 0) > 0.5) otrasRentas[a.id] = a.nombre; }); });
  const cambiosRenta = Object.entries(otrasRentas).map(([id, nombre]) => { const s = serieDe(id); return { key: "cr" + id, tipo: "renta", nombre, desde: 1, mes: (k) => (s[k]?.rentaNueva || 0) / 12 }; });
  const conPago = [...cards.filter((x) => primerPago(x, 1) != null), ...cambiosRenta];
  const totMes = (k) => conPago.reduce((s, x) => s + x.mes(k), 0);
  const totT = totMes(t);
  const promedio = conPago.length ? Array.from({ length: nAnios }, (_, i) => totMes(i + 1)).reduce((s, v) => s + v, 0) / nAnios : 0;
  const maxFlujo = Math.max(1, ...conPago.map((x) => Math.abs(x.mes(t))));
  const signo = (v) => `${v < -0.5 ? "−" : "+"}${fmM(Math.abs(v))}`;

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
    if (x.tipo === "deuda") { const k1 = primerPago(x, 1); return k1 ? tx(`Desde ${k1 <= 1 ? "hoy" : anioCal(k1)} dejas de pagar cuotas: ${fmM(x.mes(k1))} al mes. En ${nAnios} años son ${fmM(ult.c)} que se quedan contigo.`, `From ${k1 <= 1 ? "today" : anioCal(k1)} you stop paying installments: ${fmM(x.mes(k1))} a month. Over ${nAnios} years that's ${fmM(ult.c)} that stays with you.`) : tx("Pagas deudas que no tienen cuota mensual: no cambia lo que sale cada mes, pero baja lo que debes.", "You pay off debts with no monthly installment: your monthly outflow doesn't change, but what you owe goes down."); }
    if (x.canasta) return tx(`Arranca con ${fmM(x.monto)} de las ventas. Cada año recibe parte de lo que te sobra y de aquí sale lo que inviertes en los años siguientes; por eso sube y baja.`, `It starts with ${fmM(x.monto)} from the sales. Each year it gets part of your surplus and what you invest in later years comes out of it, so it goes up and down.`);
    const motores = (r.ciclosDetalle || []).filter((c) => c.destino !== "flujo" && c.destinoId === x.key).map((c) => c.nombre);
    const extra = motores.length ? tx(` Además recibe cada año la ganancia de «${motores.join("», «")}».`, ` It also receives the yearly profit from "${motores.join('", "')}".`) : "";
    if (x.tipo === "crece") return tx("No te paga mes a mes: todo lo que gana se queda adentro y vuelve a rendir. Por eso es el que más crece.", "It doesn't pay you monthly: everything it earns stays in and compounds. That's why it grows the most.") + extra;
    const k1 = primerPago(x, 1);
    if (x.tipo === "renta") return k1 ? tx(`Desde ${k1 <= 1 ? "hoy" : anioCal(k1)} te deposita unos ${fmM(x.mes(k1))} al mes. En ${nAnios} años habrás cobrado ${fmM(ult.c)}.`, `From ${k1 <= 1 ? "today" : anioCal(k1)} it deposits about ${fmM(x.mes(k1))} a month. Over ${nAnios} years you'll collect ${fmM(ult.c)}.`) : tx("Te paga renta mientras la tengas.", "It pays you income while you hold it.");
    if (x.tipo === "mixto") return k1 && k1 > (x.desde || 1)
      ? tx(`Empieza a pagarte en ${anioCal(k1)}: unos ${fmM(x.mes(k1))} al mes, y sigue valorizándose.`, `It starts paying you in ${anioCal(k1)}: about ${fmM(x.mes(k1))} a month, and keeps appreciating.`)
      : tx(`Te paga ${fmM(k1 ? x.mes(k1) : 0)} al mes y además se valoriza.`, `It pays you ${fmM(k1 ? x.mes(k1) : 0)} a month and also appreciates.`);
    return tx("Plata a la mano para imprevistos y lo que sobra de las ventas, repartido según la mezcla que elegiste. Cada año suma también lo que te sobra del mes, por eso crece más que su rendimiento.", "Cash on hand for surprises plus what's left from the sales, split per the mix you picked. Each year it also adds your monthly surplus, so it grows faster than its return alone.");
  };

  const Barra = ({ items, total, etq }) => <div style={{ display: "flex", height: 44, borderRadius: 10, overflow: "hidden", gap: 2 }}>
    {items.map((x) => { const p = total > 0 ? x.monto / total * 100 : 0; return <div key={x.key || x.nombre} title={`${x.nombre}: ${fmM(x.monto)}`} style={{ flex: `${x.monto} 1 0`, minWidth: 3, background: x.color, display: "flex", alignItems: "center", padding: "0 10px", overflow: "hidden", color: "#fff", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{p >= 9 ? (etq ? etq(x, p) : `${Math.round(p)} %`) : ""}</div>; })}
  </div>;
  const Leyenda = ({ items, total }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: "10px 16px", marginTop: 12 }}>
    {items.map((x) => <div key={x.key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: x.color, marginTop: 4, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{x.nombre}</div><div style={{ fontSize: 12.5, color: INF.tx2 }}><span style={cifra}>{fmM(x.monto)}</span> · {fmPct(total > 0 ? x.monto / total * 100 : 0, 0)}</div>{x.sub && <div style={{ fontSize: 12, color: INF.tx2, lineHeight: 1.4 }}>{x.sub}</div>}</div>
    </div>)}
  </div>;

  const vendeT = hoyT ? vendidos.reduce((s, v) => s + v.valor, 0) : salenDe(t).reduce((s, l) => s + l.monto, 0);
  const nVendeT = hoyT ? vendidos.length : salenDe(t).length;
  const deudasT = destinos.filter((x) => x.tipo === "deuda").reduce((s, x) => s + x.monto, 0);
  const invierteT = destinos.filter((x) => !x.queda && !["deuda", "colchon", "falta"].includes(x.tipo)).reduce((s, x) => s + x.monto, 0);
  const nombreT = hoyT ? tx(`${anioCal(1)} (hoy)`, `${anioCal(1)} (today)`) : String(anioCal(t));

  return (
    <div style={{ ...card, padding: "20px 20px 6px", marginBottom: 14, color: INF.tx }}>

      {/* Las cuatro cifras del año elegido. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 10, marginBottom: 26 }}>
        {[
          [hoyT ? tx("Hoy tienes", "Today you own") : tx(`Al empezar ${anioCal(t)}`, `At the start of ${anioCal(t)}`), fmM(totIni), tx(`${inicio.length} activos`, `${inicio.length} assets`), INF.tx],
          [tx(`Vendes o termina ${enAnio(t)}`, `Sold or ending ${enAnio(t)}`), nVendeT ? fmM(vendeT) : "—", nVendeT ? tx(`${nVendeT} activo${nVendeT === 1 ? "" : "s"}`, `${nVendeT} asset${nVendeT === 1 ? "" : "s"}`) : tx("Nada este año", "Nothing this year"), nVendeT ? INF.txTeja : INF.tx2],
          [tx(`Inviertes ${enAnio(t)}`, `You invest ${enAnio(t)}`), invierteT > 0.5 ? fmM(invierteT) : "—", deudasT > 0.5 ? tx(`y pagas ${fmM(deudasT)} de deudas`, `and pay ${fmM(deudasT)} of debt`) : (invierteT > 0.5 ? tx("en inversiones nuevas y en lo que tienes", "in new investments and what you own") : tx("Nada nuevo este año", "Nothing new this year")), invierteT > 0.5 ? INF.azul : INF.tx2],
          [tx(`Al terminar ${anioCal(t)}`, `At the end of ${anioCal(t)}`), fmM(totFinL), tx(`todo tu portafolio · ${finLista.length} activos`, `your whole portfolio · ${finLista.length} assets`), INF.txDorado],
        ].map(([l, v, s2, c]) => <div key={l} style={{ background: "var(--fp-raised)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: INF.tx2 }}>{l}</div>
          <div style={{ ...cifra, fontSize: "clamp(18px, 1.6vw, 24px)", overflowWrap: "anywhere", whiteSpace: "normal", fontWeight: 700, color: c, margin: "2px 0" }}>{v}</div>
          <div style={{ fontSize: 12, color: INF.tx2 }}>{s2}</div>
        </div>)}
      </div>

      <Paso n={1} color={INF.teja} titulo={tx(`¿Qué pasa con tu portafolio ${enAnio(t)}?`, `What happens to your portfolio ${enAnio(t)}?`)}
        sub={hoyT ? tx("A la izquierda, lo que tienes hoy y qué pasa con cada activo. A la derecha, cómo termina el año, con lo que rindió cada uno.", "Left: what you own today and what happens to each asset. Right: how the year ends, including what each one earned.")
          : tx(`A la izquierda, cómo empieza ${anioCal(t)}; a la derecha, cómo termina, con lo que rindió cada uno. Cada etiqueta dice qué pasa ese año.`, `Left: how ${anioCal(t)} starts; right: how it ends, including what each one earned. Each tag says what happens that year.`)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: 12 }}>
          <Portafolio titulo={hoyT ? tx("Hoy", "Today") : tx(`Al empezar ${anioCal(t)}`, `At the start of ${anioCal(t)}`)} total={totIni} lista={inicio} />
          <Portafolio titulo={tx(`Al terminar ${anioCal(t)}`, `At the end of ${anioCal(t)}`)} total={totFinL} lista={finLista} />
        </div>
      </Paso>

      <Paso n={2} color={INF.dorado} titulo={tx(`¿De dónde sale y a dónde va la plata ${enAnio(t)}?`, `Where does the money come from and go ${enAnio(t)}?`)}
        sub={hoyT ? tx("Lo que vendes hoy y a dónde va cada peso. Lo que no usas pasa al año siguiente y, mientras tanto, se invierte.", "What you sell today and where every peso goes. What you don't use carries to next year and is invested meanwhile.")
          : tx(`La misma cuenta del paso 3 · Tu plata: lo que viene del año anterior, lo que te sobra y lo que llega en ${anioCal(t)}, y en qué lo usas.`, `The same account as step 3 · Your money: what carries from last year, your surplus and what arrives in ${anioCal(t)}, and what you use it for.`)}>
        {totFuentes > 0.5 || totDest > 0.5 ? <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: INF.tx2, marginBottom: 6 }}>{tx("De dónde sale", "Where it comes from")} · <span style={cifra}>{fmM(totFuentes)}</span></div>
          <Barra items={fuentes} total={totFuentes} etq={(x) => x.nombre} />
          <Leyenda items={fuentes} total={totFuentes} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 10px", fontSize: 13, color: INF.tx2 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v16M6 14l6 6 6-6" /></svg>
            {hoyT && Math.abs(diferencia) > 0.5 ? (diferencia > 0
              ? tx(<>Quedan <b style={{ color: INF.tx }}>{fmM(diferencia)}</b> sin asignar: se suman a tu liquidez.</>, <><b style={{ color: INF.tx }}>{fmM(diferencia)}</b> left unassigned: it adds to your cash.</>)
              : tx(<>Faltan <b style={{ color: INF.txBad }}>{fmM(-diferencia)}</b>: lo que pides supera lo que vendes.</>, <><b style={{ color: INF.txBad }}>{fmM(-diferencia)}</b> short: you ask for more than you sell.</>))
              : tx("Y así se usa:", "And it's used like this:")}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: INF.tx2, marginBottom: 6 }}>{tx("A dónde va", "Where it goes")} · <span style={cifra}>{fmM(totDest)}</span></div>
          {destinos.length ? <><Barra items={destinos} total={totDest} /><Leyenda items={destinos} total={totDest} /></> : <div style={{ fontSize: 13, color: INF.tx2 }}>{tx("Nada este año.", "Nothing this year.")}</div>}
          {/* La cuenta en una línea, como en Tu plata: entra − usas = queda. */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${INF.linea}`, display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline", fontSize: 13.5 }}>
            <span>{tx("Entra", "In")} <b style={cifra}>{fmM(totFuentes)}</b></span><span style={{ color: INF.tx2 }}>−</span>
            <span>{tx("usas", "you use")} <b style={cifra}>{fmM(usado)}</b></span><span style={{ color: INF.tx2 }}>=</span>
            {queda >= -0.5 ? <span>{t < nAnios ? tx(`queda para ${anioCal(t + 1)}`, `left for ${anioCal(t + 1)}`) : tx("queda invertido", "stays invested")} <b style={{ ...cifra, color: INF.txOk }}>{fmM(Math.max(0, queda))}</b></span>
              : <span style={{ color: INF.txBad }}>{tx("faltan", "short")} <b style={cifra}>{fmM(-queda)}</b>{tx(": sale de tu liquidez", ": comes out of your cash")}</span>}
          </div>
        </div> : <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16, fontSize: 13, color: INF.tx2 }}>{tx(`${EnAnio(t)} no entra ni sale plata del plan: todo sigue invertido.`, `${EnAnio(t)} no plan money comes in or goes out: everything stays invested.`)}</div>}
      </Paso>

      {cards.length > 0 && <Paso n={3} color={INF.azul} titulo={tx(`¿Cómo va cada inversión ${enAnio(t)}?`, `How is each investment doing ${enAnio(t)}?`)}
        sub={tx(`La barra resaltada es ${nombreT}; las tenues, lo que viene. Dorado: lo que vale. Azul: la renta que ya cobraste. Verde: las cuotas que dejas de pagar. Morado: la ganancia de un proyecto que se repite.`, `The highlighted bar is ${nombreT}; the faded ones, what's ahead. Gold: what it's worth. Blue: income collected. Green: payments you no longer make. Purple: profit from a repeating project.`)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 12 }}>
          {cards.filter((x) => x.serie && !(x.canasta && x.monto < cards.reduce((s, y) => s + y.monto, 0) * 0.02)).map((x) => {
            const s = x.serie, ult = s[s.length - 1], pt = s[t];
            const top = Math.max(1, ...s.map((p) => p.v + p.c));
            // Lo invertido hasta el año elegido (los aportes de años siguientes todavía no cuentan).
            const inicioV = x.extra ? x.extra.filter((y) => y.anio <= t).reduce((t2, y) => t2 + y.monto, 0) + (x.base || 0) : x.monto + (x.base || 0);
            const inicioFin = x.monto + (x.base || 0);
            const empezo = (x.desde || 1) <= t;
            const valT = x.tipo === "deuda" ? pt.c : pt.v + pt.c;
            const valFin = x.tipo === "deuda" ? ult.c : ult.v + ult.c;
            // Las canastas reciben lo que sobra y de ellas sale lo que inviertes después: un «×» no dice nada.
            const mult = x.tipo !== "deuda" && !x.canasta && empezo && inicioV > 0 ? valT / inicioV : null;
            const colC = x.tipo === "deuda" ? INF.oliva : x.tipo === "motor" ? INF.serie[6] : INF.azul;
            const colFin = x.tipo === "deuda" ? INF.txOk : x.tipo === "motor" ? INF.serie[6] : x.tipo === "crece" || x.tipo === "caja" ? INF.txDorado : INF.azul;
            const etqT = x.tipo === "deuda" ? tx(`Hasta ${anioCal(t)} dejas de pagar`, `Not paid through ${anioCal(t)}`) : x.tipo === "motor" ? tx(`Capital + ganancia en ${anioCal(t)}`, `Capital + profit in ${anioCal(t)}`) : x.tipo === "crece" || x.tipo === "caja" ? tx(`Vale en ${anioCal(t)}`, `Worth in ${anioCal(t)}`) : tx(`Vale + cobraste hasta ${anioCal(t)}`, `Worth + collected by ${anioCal(t)}`);
            const mT = x.mes(t), kPago = primerPago(x, t + 1);
            const paga = mT > 0.5 ? [`${fmM(mT)}${tx("/mes", "/mo")}`, colFin] : kPago ? [tx(`desde ${anioCal(kPago)}`, `from ${anioCal(kPago)}`), INF.tx2] : x.pagaTxt ? [x.pagaTxt, colFin] : [x.tipo === "deuda" ? "—" : tx("$0 · se reinvierte", "$0 · reinvested"), INF.tx2];
            return <div key={x.key} style={{ background: "var(--fp-raised)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, opacity: empezo ? 1 : 0.92 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 700 }}>{x.nombre}</div>{x.sub && <div style={{ fontSize: 12, color: INF.tx2, marginTop: 2 }}>{x.sub}</div>}</div>
                <span style={chip(empezo ? colFin : INF.tx2)}>{empezo ? ETQ[x.tipo] : tx(`Empieza en ${anioCal(x.desde)}`, `Starts in ${anioCal(x.desde)}`)}</span>
              </div>
              {/* 23-nov-2026: las tres cifras en filas, alineadas a la derecha; en cajitas de
                  130 px una cifra como $10.600.781.104 se cortaba con «…». */}
              <div style={{ background: INF.panel, borderRadius: 10, padding: "4px 12px" }}>
                {[[x.tipo === "deuda" ? tx("Pagas", "You pay") : tx("Inviertes", "You invest"), fmM(x.monto), INF.tx], [tx("Rinde", "Returns"), x.rinde, INF.tx], [`${x.pagaEtq} ${tx("en", "in")} ${anioCal(t)}`, paga[0], paga[1]]].map(([l, v, c], i) =>
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "6px 0", borderTop: i ? `1px solid ${INF.linea}` : "none", fontSize: 13 }}><span style={{ color: INF.tx2 }}>{l}</span><b style={{ ...cifra, color: c, textAlign: "right" }}>{v}</b></div>)}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                {empezo ? <div><div style={{ fontSize: 12, color: INF.tx2 }}>{etqT}</div><div style={{ ...cifra, fontSize: 22, fontWeight: 800, color: colFin }}>{fmM(valT)}</div></div>
                  : <div><div style={{ fontSize: 12, color: INF.tx2 }}>{tx(`En ${anioCal(t)} todavía no está`, `Not there yet in ${anioCal(t)}`)}</div><div style={{ fontSize: 15, fontWeight: 700, color: INF.tx2 }}>{tx(`Se invierte en ${anioCal(x.desde)}`, `Invested in ${anioCal(x.desde)}`)}</div></div>}
                {mult != null && <div style={{ marginLeft: "auto", fontSize: 24, fontWeight: 800, color: colFin }}>×{num(mult, 1)}</div>}
              </div>
              <div role="img" aria-label={tx(`${x.nombre}: en ${anioCal(t)} ${fmM(valT)}; en ${anioCal(nAnios)} ${fmM(valFin)}`, `${x.nombre}: ${fmM(valT)} in ${anioCal(t)}; ${fmM(valFin)} in ${anioCal(nAnios)}`)} style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 96, borderBottom: `1px solid ${INF.eje}` }}>
                {s.map((p, k) => <div key={k} title={`${k === 0 ? tx("Hoy", "Today") : anioCal(k)}: ${fmM(p.v + p.c)}`} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 1, opacity: k === t ? 1 : k < t ? 0.7 : 0.28 }}>
                  {p.c > 0 && <div style={{ height: `${p.c / top * 100}%`, background: colC, borderRadius: "3px 3px 0 0" }} />}
                  {p.v > 0 && <div style={{ height: `${p.v / top * 100}%`, background: INF.dorado, borderRadius: p.c > 0 ? "0 0 2px 2px" : 3 }} />}
                </div>)}
              </div>
              <div aria-hidden="true" style={{ display: "flex", gap: 4, fontSize: 11.5, color: INF.tx2, marginTop: -8 }}>
                {s.map((p, k) => <span key={k} style={{ flex: 1, textAlign: "center", whiteSpace: "nowrap", overflow: "visible", fontWeight: k === t ? 700 : 400, color: k === t ? INF.tx : INF.tx2 }}>{k === t ? anioCal(k) : k === 0 && t >= 2 ? tx("Hoy", "Today") : k === nAnios && t <= nAnios - 2 ? anioCal(k) : ""}</span>)}
              </div>
              {t < nAnios && <div style={{ fontSize: 12, color: INF.tx2, marginTop: -4 }}>{x.tipo === "deuda" ? tx(`En ${nAnios} años dejas de pagar `, `Over ${nAnios} years you don't pay `) : tx(`En ${anioCal(nAnios)} vale `, `Worth in ${anioCal(nAnios)}: `)}<b style={{ ...cifra, color: INF.tx }}>{fmM(valFin)}</b>{x.tipo !== "deuda" && !x.canasta && inicioFin > 0 ? <> · ×{num(valFin / inicioFin, 1)}</> : null}</div>}
              <div style={{ fontSize: 13, lineHeight: 1.5, color: INF.tx, background: INF.panel, borderRadius: 10, padding: "10px 12px" }}>{FRASE(x, ult)}</div>
            </div>;
          })}
        </div>
      </Paso>}

      {conPago.length > 0 && <Paso n={4} color={INF.oliva} titulo={tx(`¿Qué cambia en tu bolsillo cada mes ${enAnio(t)}?`, `What changes in your pocket each month ${enAnio(t)}?`)}
        sub={tx("Lo que te entra de más o dejas de pagar por las decisiones del plan. Lo que empieza después aparece apagado, con su año.", "What you gain or stop paying because of the plan's decisions. What starts later is shown faded, with its year.")}>
        <div style={{ background: "var(--fp-raised)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {conPago.map((x) => { const m = x.mes(t), activo = Math.abs(m) > 0.5, k1 = activo ? null : primerPago(x, t + 1), nombre = x.tipo === "deuda" ? tx("Cuotas que ya no pagas", "Payments you no longer make") : x.nombre;
            const sub = x.tipo === "deuda" && activo ? nombresLibres(t).join(", ") : !activo ? (k1 ? tx(`Empieza en ${anioCal(k1)}`, `Starts in ${anioCal(k1)}`) : tx("Ya terminó", "Already ended")) : primerPago(x, 1) === t && t > 1 ? tx("Empieza este año", "Starts this year") : "";
            return <div key={x.key} style={{ display: "grid", gridTemplateColumns: "minmax(120px,34%) 1fr auto", gap: 10, alignItems: "center", opacity: activo ? 1 : 0.5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0 }}>{nombre}{sub && <span style={{ display: "block", fontSize: 12, color: INF.tx2, fontWeight: 400 }}>{sub}</span>}</span>
              <span style={{ height: 18, background: INF.panel, borderRadius: 6, overflow: "hidden" }}>{activo && <span style={{ display: "block", height: 18, width: `${Math.abs(m) / maxFlujo * 100}%`, background: m < 0 ? COL.falta : (x.color || COL[x.tipo]), borderRadius: 6 }} />}</span>
              <b style={{ ...cifra, fontSize: 14, color: activo ? (m < 0 ? INF.txBad : INF.tx) : INF.tx2 }}>{activo ? signo(m) : k1 ? signo(x.mes(k1)) : "—"}</b>
            </div>; })}
          <div style={{ borderTop: `1px solid ${INF.linea}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: INF.tx2 }}>{tx(`${EnAnio(t)}, cada mes te entra o te dejas de gastar`, `${EnAnio(t)}, each month you gain or stop spending`)}</span>
            <b style={{ ...cifra, fontSize: 22, color: totT > 0.5 ? INF.azul : totT < -0.5 ? INF.txBad : INF.tx2 }}>{Math.abs(totT) > 0.5 ? signo(totT) : "$0"}{tx(" / mes", " / mo")}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", fontSize: 13, color: INF.tx2, marginTop: -4 }}>
            <span>{tx(`Promedio de los ${nAnios} años`, `${nAnios}-year average`)}</span>
            <b style={{ ...cifra, color: INF.tx }}>{signo(promedio)}{tx(" / mes", " / mo")}</b>
          </div>
        </div>
      </Paso>}
    </div>
  );
}
