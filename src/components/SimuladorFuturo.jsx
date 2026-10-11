// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · SimuladorFuturo — "¿Me alcanza con la vida que viene?"
//
// 4-oct-2026, Santiago: "este año como está simulado está bien, pero voy a
// tener unos cambios muy grandes el año entrante; quisiera poder simular un
// mes futuro según esos cambios para saber si soy capaz de sostenerme o no".
//
// El simulador de año actual solo mueve lo que ya existe (sliders) dentro de
// este año. Este responde otra pregunta y por eso es otra pantalla:
//
//   AÑO FUTURO = vida de hoy − lo que termina + lo que entra, con lo que cambia
//
// 1. BASE: cada ingreso, gasto y deuda con sim !== false, proyectado a los 12
//    meses del año elegido con su frecuencia (un predial anual cae en su mes).
//    Los pagos únicos de este año no se repiten. Los variables entran por su
//    promedio de mes activo. Todo se convierte a COP de una vez.
// 2. CAMBIOS: tres verbos. termina (desde mes X vale 0), cambia (desde mes X
//    vale otro monto), nuevo (entra algo entre mes X y mes Y).
// 3. IMPUESTO: estimarImpuesto sobre el usuario futuro, no copiado del de hoy.
//    Retención proporcional al ingreso de cada mes; impuesto neto parejo.
// 4. VEREDICTO: mes típico = promedio de los meses en que ya aplican todos los
//    cambios. Al lado, el mes típico de hoy. Las 12 barras son clicables para
//    pararse en un mes concreto.
//
// Los datos reales NO se tocan. Los escenarios viven en user.escenarios y se
// guardan con la cuenta.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "./PageHeader";
import { estimarImpuesto } from "../lib/taxCO";
import { C, Cα, F, R } from "../lib/designTokens";
import { montoDelMes, promedioMesActivo, getFrecuencia, MESES, getMesActual, rangoEfectivo } from "../lib/flowHelpers.js";
import { cuotaDeudaDelMes, retencionDelMes } from "./SimuladorAvanzado";

const fm = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
const mesL = (m) => (MESES.find((x) => x.v === m) || {}).l || "";
const uid = () => "c_" + Math.random().toString(36).slice(2, 9);

const CATS_ING = ["Salario", "Honorarios", "Arriendo", "Dividendos", "Intereses bancarios", "Rendimiento", "Pensión", "Negocio", "Otro"];
const FISCAL_ING = {
  "Salario": "LAB_SALARIO", "Honorarios": "LAB_HONORARIOS_SIN_EMPLEADOS", "Arriendo": "NOL_ARRIENDO_INMUEBLE",
  "Dividendos": "DIV_ART49_GRAVADOS", "Intereses bancarios": "CAP_INTERESES_BANCARIOS",
  "Rendimiento": "CAP_RENDIMIENTO_GENERICO", "Pensión": "PEN_JUBILACION", "Negocio": "NOL_NEGOCIO", "Otro": "NOL_OTROS",
};

// ─── Base: la vida de hoy, por ítem ────────────────────────────────────────
// Cada entrada: { key, kind: "ing"|"gas"|"deu", nombre, cat, montoTipico, porMes(año) → [12] COP }
// 9-oct-2026 (Santiago: "carga ítems que ni siquiera tengo activados"). Lo que
// termina antes de diciembre de este año NO continúa el año entrante: "RENTA
// HASTA SEPT" o un crédito que acaba en noviembre son cosas que se acabaron,
// no cosas que se repiten cada año. Quedan listadas aparte con un botón "sí
// continúa" por si el usuario sabe que siguen. Lo que empieza a mitad de año,
// el año entrante va completo.
export function construirBase(user) {
  const trm = user?.trm || 4200;
  const out = [];
  // 10-oct-2026: un variable sin montos en los meses que FALTAN del año no
  // "terminó" (district: montos hasta octubre porque nov y dic no han
  // pasado). Solo cuenta como terminado si su último monto es anterior al
  // mes actual. Los periódicos siguen la vigencia declarada.
  const mesHoy = getMesActual().mes;
  const vig = (item) => {
    const r = rangoEfectivo(item);
    const esVariable = getFrecuencia(item) === "variable";
    const termina = esVariable ? (r.hasta < Math.min(mesHoy, 12)) : (r.hasta < 12);
    return { ...r, termina };
  };
  (user.ingresos || []).forEach((i, idx) => {
    if (i.sim === false) return;
    const fx = i.moneda === "USD" ? trm : 1;
    const v = vig(i);
    out.push({
      key: `ing_${idx}`, kind: "ing", ref: i, vig: v,
      nombre: i.nombre || i.fuente || "Ingreso", cat: i.categoria || "",
      capital: Number(i.capital) || 0, tasa: Number(i.tasa) || 0, tasaModo: i.tasaModo || "anual",
      montoTipico: (getFrecuencia(i) === "variable" ? supuestoVariable(i).monto : promedioMesActivo(i)) * fx,
      supuesto: getFrecuencia(i) === "variable" ? supuestoVariable(i).texto : (getFrecuencia(i) === "mensual" ? "" : `${getFrecuencia(i)} · cae en su mes`),
      porMes: (año) => proyectarPorMes(i, año, fx),
    });
  });
  Object.entries(user.gastos || {}).forEach(([cat, items]) => {
    (items || []).forEach((g, idx) => {
      if (g.sim === false) return;
      const fx = g.moneda === "USD" ? trm : 1;
      const v = vig(g);
      out.push({
        key: `gas_${cat}_${idx}`, kind: "gas", ref: g, vig: v,
        nombre: g.c || "Gasto", cat,
        montoTipico: (getFrecuencia(g) === "variable" ? supuestoVariable(g).monto : promedioMesActivo(g)) * fx,
        supuesto: getFrecuencia(g) === "variable" ? supuestoVariable(g).texto : (getFrecuencia(g) === "mensual" ? "" : `${getFrecuencia(g)} · cae en su mes`),
        porMes: (año) => proyectarPorMes(g, año, fx),
      });
    });
  });
  (user.deudas || []).forEach((d, idx) => {
    if (d.sim === false || (d.mt || 0) <= 0) return;
    const cuota = d.pago || d.pg || 0;
    const hasta = Number(d.hastaMes) || 12;
    const v = { desde: Number(d.desdeMes) || 1, hasta, termina: hasta < 12 };
    const dFull = { ...d, desdeMes: 1, hastaMes: 12 };
    out.push({
      key: `deu_${idx}`, kind: "deu", ref: d, vig: v,
      nombre: d.n || d.nombre || "Deuda", cat: d.tipo || "",
      montoTipico: cuotaDeudaDelMes(dFull, cuota, getMesActual().año, 1, trm) || cuota * (d.moneda === "USD" ? trm : 1),
      porMes: (año) => MESES.map((m) => cuotaDeudaDelMes(dFull, cuota, año, m.v, trm)),
    });
  });
  return out;
}


// 11-oct-2026: como se lleva un VARIABLE al ano siguiente. Antes: promedio de
// mes activo, plano los 12 meses. Con RENTA TRADICIONAL (78, 39, 39 en
// sep-nov) daba 52M/mes; con BROOKFORT (4 pagos sueltos, 35M en el ano) daba
// 8,7M/mes. Regla: si viene desde comienzo de ano (primer monto en ene-mar),
// su total anual repartido en 12; si empezo despues, la mediana de los meses
// con monto (resiste un pago doble). El texto se muestra en la fila.
function supuestoVariable(item) {
  const montos = (Array.isArray(item?.montosMensuales) ? item.montosMensuales : []).map((v) => Number(v) || 0);
  const conMonto = montos.map((v, i) => ({ v, mes: i + 1 })).filter((x) => x.v > 0);
  if (!conMonto.length) return { monto: 0, texto: "sin montos este año" };
  const primero = conMonto[0].mes;
  if (primero <= 3) {
    const total = montos.reduce((a, v) => a + v, 0);
    return { monto: total / 12, texto: `${fm(total)} de este año repartidos en 12` };
  }
  const vals = conMonto.map((x) => x.v).sort((a, b) => a - b);
  const med = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
  return { monto: med, texto: `mediana de ${conMonto.length} ${conMonto.length === 1 ? "mes" : "meses"} con monto (desde ${mesL(primero).toLowerCase()})` };
}

// Un ítem de hoy, en cada mes del año futuro. "unico" no se repite; "variable"
// entra plano por su promedio de mes activo (no sabemos cómo se repartirá).
export function proyectarPorMes(item, año, fx) {
  const f = getFrecuencia(item);
  if (f === "unico") return MESES.map(() => 0);
  if (f === "variable") {
    return MESES.map(() => supuestoVariable(item).monto * fx);
  }
  // Frecuencias periódicas: montoDelMes respeta mesPago y vigencia, pero mira
  // el flag "pagado" del año — en el futuro nada está pagado, así que se limpia.
  // Año completo: lo que empezó a mitad de este año, el entrante va entero.
  const limpio = { ...item, pagados: undefined, pagado: undefined, desdeMes: 1, hastaMes: 12 };
  return MESES.map((m) => (montoDelMes(limpio, año, m.v) || 0) * fx);
}

// ─── Aplicar cambios → 12 meses por ítem (base + nuevos) ───────────────────
export function aplicarCambios(base, cambios, año) {
  const continuan = new Set(cambios.filter((c) => c.tipo === "continua").map((c) => c.ref));
  const filas = base
    .filter((b) => !b.vig?.termina || continuan.has(b.key))
    .map((b) => ({ ...b, meses: b.porMes(año), origen: "hoy", continua: b.vig?.termina ? cambios.find((c) => c.tipo === "continua" && c.ref === b.key) : null }));
  cambios.forEach((c) => {
    if (c.tipo === "nuevo") {
      const desde = Number(c.desdeMes) || 1, hasta = Number(c.hastaMes) || 12;
      filas.push({
        key: c.id, kind: c.kind, nombre: c.nombre || "Nuevo", cat: c.cat || "",
        capital: Number(c.capital) || 0, tasa: Number(c.tasa) || 0, tasaModo: c.tasaModo || "anual",
        montoTipico: Number(c.monto) || 0, origen: "nuevo", cambio: c,
        meses: MESES.map((m) => (m.v >= desde && m.v <= hasta ? Number(c.monto) || 0 : 0)),
      });
      return;
    }
    const fila = filas.find((f) => f.key === c.ref);
    if (!fila) return;
    const desde = Number(c.desdeMes) || 1;
    if (c.tipo === "termina") {
      fila.meses = fila.meses.map((v, i) => (i + 1 >= desde ? 0 : v));
      fila.cambio = c; fila.origen = "termina";
    } else if (c.tipo === "cambia") {
      fila.meses = fila.meses.map((v, i) => (i + 1 >= desde ? Number(c.monto) || 0 : v));
      fila.cambio = c; fila.origen = "cambia";
    }
  });
  return filas;
}

// ─── Usuario sintético para el motor tributario ────────────────────────────
// Cada fila se vuelve un ítem "variable" con sus 12 montos en COP, que es la
// forma que el motor ya entiende (totalAnualItem suma los 12).
export function usuarioFuturo(user, filas) {
  // 11-oct-2026: un item sin propietario ("" o "na") NO se le asigna a nadie.
  // BTG PACTUAL (owner "") caia en Sosa como persona natural y tributaba
  // $1.470M/ano al 39%: impuesto 28,6M/mes cuando el simulador normal da 0.
  // Solo los NUEVOS sin eleccion toman el primer propietario.
  const owner0 = (user.owners || [])[0]?.id || "own_1";
  const dueño = (base, f) => (base.owner !== undefined ? base.owner : (f.cambio?.owner || owner0));
  const ing = [], gas = {}, deu = [];
  filas.forEach((f) => {
    const avg = f.meses.reduce((s, v) => s + v, 0) / 12;
    const base = f.ref || {};
    const comun = { frecuencia: "variable", montosMensuales: f.meses, moneda: "COP", sim: true, desdeMes: 1, hastaMes: 12 };
    if (f.kind === "ing") {
      ing.push({ ...base, ...comun, nombre: f.nombre, mensual: avg, capital: f.capital || base.capital, tasa: f.tasa || base.tasa,
        categoria: base.categoria || f.cat || "Otro",
        fiscalCode: base.fiscalCode || FISCAL_ING[f.cat] || "NOL_OTROS",
        owner: dueño(base, f) });
    } else if (f.kind === "gas") {
      const cat = f.cat || "Otros";
      gas[cat] = gas[cat] || [];
      gas[cat].push({ ...base, ...comun, c: f.nombre, m: avg, cat, owner: dueño(base, f) });
    } else {
      deu.push({ ...base, ...comun, n: f.nombre, pago: avg, pg: avg, mt: base.mt || Number(f.cambio?.saldo) || avg * 12,
        owner: dueño(base, f) });
    }
  });
  return { owners: user.owners || [], ingresos: ing, gas, deu, inv: user.inv || [], trm: user.trm || 4200 };
}

export function impuestoAnual(u) {
  const t = estimarImpuesto(u);
  let bruto = 0, rete = 0;
  (t.detalle || []).forEach((d) => {
    bruto += d.impBruto != null ? d.impBruto : (d.impuesto || 0);
    rete += d.reteN || 0;
  });
  return { bruto, rete, neto: Math.max(0, bruto - rete) };
}

// ─── Cuadro de un mes (o de un promedio de meses) ──────────────────────────
export function cuadro(filas, mesesIdx, imp) {
  const n = mesesIdx.length || 1;
  const suma = (kind) => filas.filter((f) => f.kind === kind).reduce((s, f) => s + mesesIdx.reduce((a, i) => a + (f.meses[i] || 0), 0), 0) / n;
  const ingresos = suma("ing"), gastos = suma("gas"), cuotas = suma("deu");
  const brutoAnual = filas.filter((f) => f.kind === "ing").reduce((s, f) => s + f.meses.reduce((a, v) => a + v, 0), 0);
  const retencion = retencionDelMes(ingresos, brutoAnual / 12, imp.rete / 12);
  const impuesto = imp.neto / 12;
  const egresos = gastos + cuotas + impuesto;
  const queda = ingresos - retencion - egresos;
  return { ingresos, retencion, gastos, cuotas, impuesto, egresos, queda };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function SimuladorFuturo({ user, escenarios = [], onUpdate, onNavigate }) {
  const añoHoy = getMesActual().año;
  const [selId, setSelId] = useState(escenarios[0]?.id || null);
  const [mesFoco, setMesFoco] = useState(null); // null = mes típico
  const [form, setForm] = useState(null);       // formulario de cambio abierto


  const esc = escenarios.find((e) => e.id === selId) || null;
  const año = esc?.año || añoHoy + 1;
  const cambios = esc?.cambios || [];

  // La tira fija solo aparece cuando el veredicto salió de la vista (al editar abajo).
  const veredictoRef = useRef(null);
  const [veredictoVisible, setVeredictoVisible] = useState(true);
  useEffect(() => {
    const el = veredictoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVeredictoVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [esc?.id]);

  const guardar = (lista) => onUpdate && onUpdate(lista);
  const actualizar = (patch) => guardar(escenarios.map((e) => (e.id === selId ? { ...e, ...patch } : e)));
  const nuevoEscenario = () => {
    const e = { id: uid(), nombre: `Mi ${añoHoy + 1}`, año: añoHoy + 1, cambios: [], creado: new Date().toISOString() };
    guardar([...escenarios, e]); setSelId(e.id); setMesFoco(null);
  };
  const borrarEscenario = () => {
    if (!esc || !window.confirm(`¿Borrar el escenario "${esc.nombre}"?`)) return;
    const resto = escenarios.filter((e) => e.id !== selId);
    guardar(resto); setSelId(resto[0]?.id || null);
  };

  const base = useMemo(() => construirBase(user), [user]);
  const filas = useMemo(() => aplicarCambios(base, cambios, año), [base, cambios, año]);
  const impFut = useMemo(() => impuestoAnual(usuarioFuturo(user, filas)), [user, filas]);

  // Hoy: la misma base, en el año en curso, con el impuesto de hoy.
  const filasHoy = useMemo(() => aplicarCambios(base, [], añoHoy), [base, añoHoy]);
  const impHoy = useMemo(() => impuestoAnual(usuarioFuturo(user, filasHoy)), [user, filasHoy]);
  const hoy = useMemo(() => cuadro(filasHoy, MESES.map((_, i) => i), impHoy), [filasHoy, impHoy]);

  // Mes típico futuro: desde el último cambio hasta diciembre.
  const mesRegimen = cambios.reduce((m, c) => Math.max(m, Number(c.desdeMes) || 1), 1);
  const idxRegimen = MESES.map((_, i) => i).filter((i) => i + 1 >= mesRegimen);
  const tipico = useMemo(() => cuadro(filas, idxRegimen, impFut), [filas, idxRegimen.join(","), impFut]);
  const porMes = useMemo(() => MESES.map((m, i) => ({ mes: m.v, ...cuadro(filas, [i], impFut) })), [filas, impFut]);
  const foco = mesFoco ? porMes[mesFoco - 1] : null;
  const vista = foco || tipico;
  const maxAbs = Math.max(1, ...porMes.map((m) => Math.abs(m.queda)));

  // ─── Cambios: alta / baja ─────────────────────────────────────────────
  const agregarCambio = (c) => { actualizar({ cambios: [...cambios, { id: uid(), ...c }] }); setForm(null); };
  const quitarCambio = (id) => actualizar({ cambios: cambios.filter((c) => c.id !== id) });

  const owners = user.owners || [];
  const kindL = { ing: "ingreso", gas: "gasto", deu: "deuda" };
  const colorK = { ing: C.ok, gas: C.danger, deu: C.warn };

  // ─── UI ───────────────────────────────────────────────────────────────
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.lg, padding: 18, marginBottom: 16 };
  const input = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.md, color: C.text, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };
  const btn = (primary) => ({ background: primary ? C.accent : C.raised, color: primary ? "#fff" : C.text, border: `1px solid ${primary ? C.accent : C.border}`, borderRadius: R.md, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });
  const Celda = ({ etiqueta, valor, color, tenue }) => (
    <div style={{ minWidth: 110 }}>
      <div style={F.label}>{etiqueta}</div>
      <div style={{ ...F.mono, color, opacity: tenue ? 0.85 : 1 }}>{fm(valor)}</div>
    </div>
  );

  return (
    <div>
      <PageHeader label="Simulador · futuro" title="¿Me alcanza con la vida que viene?"
        subtitle={`Tu vida de hoy proyectada a ${año}, con los cambios que sabes que vienen. Tus datos reales no se tocan.`} />

      {/* ── Escenario ── */}
      <div style={card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={F.label}>Escenario</div>
          <select value={selId || ""} onChange={(e) => { setSelId(e.target.value); setMesFoco(null); }} style={{ ...input, width: "auto", minWidth: 180 }}>
            {escenarios.length === 0 && <option value="">— ninguno —</option>}
            {escenarios.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {e.año}</option>)}
          </select>
          <button style={btn(true)} onClick={nuevoEscenario}>+ Nuevo escenario</button>
          {esc && <button style={btn(false)} onClick={borrarEscenario}>Borrar</button>}
        </div>
        {esc && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 220px" }}>
              <div style={F.label}>Nombre</div>
              <input style={input} value={esc.nombre} onChange={(e) => actualizar({ nombre: e.target.value })} />
            </div>
            <div style={{ flex: "0 0 120px" }}>
              <div style={F.label}>Año</div>
              <select style={input} value={esc.año} onChange={(e) => actualizar({ año: Number(e.target.value) })}>
                {[1, 2, 3].map((k) => <option key={k} value={añoHoy + k}>{añoHoy + k}</option>)}
              </select>
            </div>
            <div style={{ flex: "2 1 300px" }}>
              <div style={F.label}>Qué va a pasar (para ti)</div>
              <input style={input} placeholder="Ej: me paso a independiente en marzo, vendo el carro en junio…" value={esc.descripcion || ""} onChange={(e) => actualizar({ descripcion: e.target.value })} />
            </div>
          </div>
        )}
        {!esc && <div style={{ ...F.body, marginTop: 10 }}>Crea un escenario para empezar. Arranca con tu vida de hoy; después le agregas los cambios.</div>}
      </div>

      {esc && (<>
        {/* Tira fija: el resultado a la vista mientras se edita abajo (10-oct-2026,
            Santiago: "uno le da Terminar y como que no pasa nada"). */}
        {!veredictoVisible && <div style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", width: "min(720px, calc(100vw - 32px))", zIndex: 500, padding: "8px 12px", background: C.surface, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(239,68,68,0.25)"}`, borderRadius: R.md, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
          <div style={{ ...F.caption, minWidth: 0 }}>
            <b style={{ color: C.text }}>{foco ? `${mesL(foco.mes)} ${año}` : `Mes típico ${año}`}</b> · {cambios.length} {cambios.length === 1 ? "cambio" : "cambios"}
          </div>
          <div style={{ ...F.mono, color: vista.queda >= 0 ? C.ok : C.danger, whiteSpace: "nowrap" }}>
            {vista.queda >= 0 ? "quedan " : "faltan "}{fm(Math.abs(vista.queda))}/mes
            <span style={{ ...F.caption, marginLeft: 8 }}>{Math.abs(vista.queda - hoy.queda) < 1 ? "igual que hoy" : `${vista.queda > hoy.queda ? "+" : "−"}${fm(Math.abs(vista.queda - hoy.queda))} vs hoy`}</span>
          </div>
        </div>}

        {/* ── Veredicto ── */}
        <div style={card} ref={veredictoRef}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", padding: "10px 13px", background: C.raised, border: `1px solid ${C.border}`, borderRadius: R.lg }}>
              <div style={F.label}>Mes típico hoy</div>
              <div style={F.caption}>Promedio de {añoHoy} con lo que tienes encendido</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
                <Celda etiqueta="Ingresos" valor={hoy.ingresos} color={C.ok} />
                <Celda etiqueta="Gastos + cuotas" valor={hoy.gastos + hoy.cuotas} color={C.danger} />
                <Celda etiqueta="Impuestos" valor={hoy.impuesto + hoy.retencion} color={C.purple} />
                <Celda etiqueta="Queda" valor={hoy.queda} color={hoy.queda >= 0 ? C.ok : C.danger} />
              </div>
            </div>
            <div style={{ flex: "1 1 260px", padding: "10px 13px", background: Cα.ok08, border: `1px solid ${Cα.ok25}`, borderRadius: R.lg }}>
              <div style={F.label}>{foco ? `${mesL(foco.mes)} ${año}` : `Mes típico ${año}`}</div>
              <div style={F.caption}>
                {foco ? "Ese mes en concreto · clic en otra barra o en “mes típico” para volver"
                  : cambios.length ? `Promedio ${mesL(mesRegimen).toLowerCase()}–dic, cuando ya aplican todos los cambios` : "Sin cambios todavía: tu vida de hoy repetida"}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
                <Celda etiqueta="Ingresos" valor={vista.ingresos} color={C.ok} />
                <Celda etiqueta="Gastos + cuotas" valor={vista.gastos + vista.cuotas} color={C.danger} />
                <Celda etiqueta="Impuestos" valor={vista.impuesto + vista.retencion} color={C.purple} />
                <Celda etiqueta="Queda" valor={vista.queda} color={vista.queda >= 0 ? C.ok : C.danger} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 13px", borderRadius: R.md, background: vista.queda >= 0 ? Cα.ok08 : Cα.danger08, border: `1px solid ${vista.queda >= 0 ? Cα.ok25 : "rgba(239,68,68,0.25)"}` }}>
            <div style={{ ...F.h3, color: vista.queda >= 0 ? C.ok : C.danger }}>
              {vista.queda >= 0
                ? `Te sostienes: quedan ${fm(vista.queda)} al mes (${vista.ingresos > 0 ? Math.round((vista.queda / vista.ingresos) * 100) : 0}% de lo que entra).`
                : `No alcanza: faltan ${fm(-vista.queda)} al mes.`}
              {" "}
              <span style={{ color: C.muted, fontWeight: 400 }}>
                {Math.abs(vista.queda - hoy.queda) < 1 ? "Igual que hoy." : `${vista.queda > hoy.queda ? "Mejor" : "Peor"} que hoy por ${fm(Math.abs(vista.queda - hoy.queda))}.`}
              </span>
            </div>
            <div style={{ ...F.caption, marginTop: 4 }}>
              Gastos {fm(vista.gastos)} + cuotas {fm(vista.cuotas)} = lo que gastas. Aparte, retención {fm(vista.retencion)} + impuesto de renta {fm(vista.impuesto)}/mes = {fm(vista.retencion + vista.impuesto)} de impuestos (recalculados para {año} sobre los ingresos de todo el año: {fm(impFut.neto)} a pagar en la declaración).
            </div>
          </div>

          {/* 10-oct-2026 (Santiago: "solo se ve el total, no se sabe qué valor es
              de cada uno"). Desglose ítem por ítem del mes que se está viendo. */}
          {(() => {
            const idx = foco ? [foco.mes - 1] : idxRegimen;
            const n = idx.length || 1;
            const valor = (f) => idx.reduce((a, i) => a + (f.meses[i] || 0), 0) / n;
            const grupos = [["ing", "Ingresos", C.ok], ["gas", "Gastos", C.danger], ["deu", "Cuotas", C.warn]];
            return (
              <details style={{ marginTop: 12 }}>
                <summary style={{ ...F.h3, cursor: "pointer", color: C.accent }}>Ver de dónde sale cada número ({foco ? `${mesL(foco.mes).toLowerCase()} ${año}` : "mes típico"})</summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
                  {grupos.map(([k, titulo, color]) => {
                    const lista = filas.filter((f) => f.kind === k).map((f) => ({ ...f, v: valor(f) })).filter((f) => f.v !== 0).sort((a, b) => b.v - a.v);
                    const total = lista.reduce((a, f) => a + f.v, 0);
                    return (
                      <div key={k} style={{ background: C.raised, borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ ...F.label, color }}>{titulo} · {lista.length}</span>
                          <span style={{ ...F.mono, fontSize: 12, color }}>{fm(total)}</span>
                        </div>
                        {lista.length === 0 && <div style={{ ...F.caption, marginTop: 6 }}>Nada este mes.</div>}
                        {lista.map((f) => (
                          <div key={f.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...F.body, color: C.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {f.nombre}{f.origen === "nuevo" ? " · nuevo" : f.cambio ? " · con cambio" : ""}
                              </div>
                              <div style={{ ...F.caption, fontSize: 10 }}>
                                {f.capital > 0 && f.tasa > 0 ? `${fm(f.capital)} × ${f.tasa}% ${f.tasaModo === "mensual" ? "mensual" : "anual"}` : f.cat}
                              </div>
                            </div>
                            <span style={{ ...F.mono, fontSize: 12, color: C.text, flexShrink: 0 }}>{fm(f.v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div style={{ ...F.caption, marginTop: 8 }}>
                  Más retención {fm(vista.retencion)} e impuesto de renta {fm(vista.impuesto)}/mes, que salen del motor tributario sobre todo el año.
                </div>
              </details>
            );
          })()}

          {/* 12 barras clicables */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <div style={F.label}>Los 12 meses de {año}</div>
            {mesFoco && <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => setMesFoco(null)}>← mes típico</button>}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", height: 64, gap: 4, marginTop: 6 }}>
            {porMes.map((m) => {
              const h = (Math.abs(m.queda) / maxAbs) * 100;
              const pos = m.queda >= 0, sel = mesFoco === m.mes;
              return (
                <div key={m.mes} onClick={() => setMesFoco(sel ? null : m.mes)} title={`${mesL(m.mes)}: ${fm(m.queda)}`}
                  style={{ flex: 1, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ height: `${Math.max(4, h)}%`, background: pos ? C.ok : C.danger, opacity: sel ? 1 : 0.45, borderRadius: 3, border: sel ? `1px solid ${C.text}` : "none" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {MESES.map((m) => <div key={m.v} style={{ flex: 1, textAlign: "center", ...F.caption, fontSize: 9 }}>{m.l.slice(0, 3)}</div>)}
          </div>
        </div>

        {/* ── Cambios ── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={F.h2}>Lo que cambia en {año}</div>
              <div style={F.caption}>Tres verbos: algo termina, algo cambia de monto, algo nuevo entra.</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["ing", "gas", "deu"].map((k) => (
                <button key={k} style={btn(false)} onClick={() => setForm({ tipo: "nuevo", kind: k, desdeMes: 1, hastaMes: 12, cat: k === "ing" ? "Salario" : "" })}>
                  + Nuevo {kindL[k]}
                </button>
              ))}
            </div>
          </div>

          {cambios.length === 0 && <div style={{ ...F.body, marginTop: 10 }}>Todavía no hay cambios. Agrega algo nuevo con los botones de arriba, o baja a tu vida de hoy y marca en cada fila qué termina o qué cambia.</div>}
          {cambios.some((c) => c.tipo === "termina" || c.tipo === "cambia") && <div style={{ ...F.caption, marginTop: 8 }}>{cambios.filter((c) => c.tipo === "termina" || c.tipo === "cambia").length} ajustes sobre tu vida de hoy: se ven marcados en cada fila, abajo.</div>}
          {cambios.filter((c) => c.tipo === "nuevo" || c.tipo === "continua").map((c) => {
            const fila = filas.find((f) => f.key === c.ref) || filas.find((f) => f.key === c.id);
            const nombre = c.tipo === "nuevo" ? c.nombre : (fila?.nombre || "—");
            const texto = c.tipo === "continua" ? `sigue en ${año} aunque en ${añoHoy} terminó en ${mesL(base.find((b) => b.key === c.ref)?.vig?.hasta || 12).toLowerCase()}`
              : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? "no cuenta en todo el año" : `cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`)
              : c.tipo === "cambia" ? `pasa a ${fm(c.monto)} desde ${mesL(c.desdeMes).toLowerCase()}`
              : `entra ${fm(c.monto)}/mes de ${mesL(c.desdeMes).toLowerCase()} a ${mesL(c.hastaMes || 12).toLowerCase()}${Number(c.capital) > 0 && Number(c.tasa) > 0 ? ` (${fm(Number(c.capital))} × ${c.tasa}% ${c.tasaModo === "mensual" ? "mensual" : "anual"})` : ""}`;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}`, marginTop: 8 }}>
                <span style={{ ...F.label, color: colorK[c.kind], minWidth: 56 }}>{kindL[c.kind]}</span>
                <span style={{ ...F.body, color: C.text, flex: 1 }}><b>{nombre}</b> {texto}</span>
                <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => quitarCambio(c.id)}>Quitar</button>
              </div>
            );
          })}

          {form && form.tipo === "nuevo" && (
            <div style={{ marginTop: 12, padding: 12, background: C.raised, borderRadius: R.md, border: `1px solid ${C.border}` }}>
              <div style={{ ...F.h3, marginBottom: 8 }}>
                {form.tipo === "nuevo" ? `Nuevo ${kindL[form.kind]}` : form.tipo === "termina" ? `“${form.nombre}” termina` : `“${form.nombre}” cambia de monto`}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {form.tipo === "nuevo" && (<>
                  <div><div style={F.label}>Nombre</div><input style={input} value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={form.kind === "ing" ? "Ej: Nuevo contrato" : form.kind === "gas" ? "Ej: Arriendo nuevo" : "Ej: Crédito carro"} /></div>
                  {form.kind === "ing" && <div><div style={F.label}>Tipo</div><select style={input} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{CATS_ING.map((c) => <option key={c}>{c}</option>)}</select></div>}
                  {form.kind === "ing" && (<>
                    {/* 11-oct-2026 (Santiago: "una inversión nueva no me deja poner
                        capital ni porcentaje y no calcula el monto"). Con capital y
                        tasa el monto mensual se deriva solo, como en Ingresos. */}
                    <div><div style={F.label}>Capital invertido (opcional)</div>
                      <input style={input} type="number" placeholder="Ej: 500000000" value={form.capital || ""} onChange={(e) => {
                        const cap = Number(e.target.value) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, capital: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>% rentabilidad {form.tasaModo === "mensual" ? "mensual" : "anual"}</div>
                      <input style={input} type="number" placeholder={form.tasaModo === "mensual" ? "Ej: 1" : "Ej: 14"} value={form.tasa || ""} onChange={(e) => {
                        const tas = Number(e.target.value) || 0, cap = Number(form.capital) || 0;
                        const nf = { ...form, tasa: e.target.value };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(form.tasaModo === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }} /></div>
                    <div><div style={F.label}>Periodicidad de la tasa</div>
                      <select style={input} value={form.tasaModo || "anual"} onChange={(e) => {
                        const tm = e.target.value, cap = Number(form.capital) || 0, tas = Number(form.tasa) || 0;
                        const nf = { ...form, tasaModo: tm };
                        if (cap > 0 && tas > 0) nf.monto = String(Math.round(tm === "mensual" ? cap * tas / 100 : cap * tas / 100 / 12));
                        setForm(nf);
                      }}>
                        <option value="anual">Anual (ej: 14% al año)</option>
                        <option value="mensual">Mensual (ej: 1% al mes)</option>
                      </select></div>
                  </>)}
                  {form.kind === "gas" && <div><div style={F.label}>Categoría</div><input style={input} list="cats-gas" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="Ej: Vivienda" /><datalist id="cats-gas">{Object.keys(user.gastos || {}).map((c) => <option key={c} value={c} />)}</datalist></div>}
                  {form.kind === "deu" && <div><div style={F.label}>Saldo (opcional)</div><input style={input} type="number" value={form.saldo || ""} onChange={(e) => setForm({ ...form, saldo: e.target.value })} /></div>}
                  {owners.length > 1 && <div><div style={F.label}>De quién</div><select style={input} value={form.owner || owners[0].id} onChange={(e) => setForm({ ...form, owner: e.target.value })}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}
                </>)}
                {form.tipo !== "termina" && (
                  <div><div style={F.label}>{form.kind === "deu" ? "Cuota mensual" : "Monto mensual (COP)"}</div><input style={input} type="number" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                    {form.kind === "ing" && Number(form.capital) > 0 && Number(form.tasa) > 0 && (
                      <div style={{ ...F.caption, color: C.ok, marginTop: 4 }}>
                        {fm(Number(form.capital))} × {form.tasa}% {form.tasaModo === "mensual" ? "mensual" : "anual"} = {fm(Number(form.monto) || 0)}/mes · {fm((Number(form.monto) || 0) * 12)} al año
                      </div>
                    )}
                  </div>
                )}
                <div><div style={F.label}>{form.tipo === "termina" ? "Último mes que cuenta" : "Desde"}</div>
                  <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                    {MESES.map((m) => <option key={m.v} value={form.tipo === "termina" ? m.v + 1 : m.v}>{m.l}</option>)}
                  </select></div>
                {form.tipo === "nuevo" && (
                  <div><div style={F.label}>Hasta</div>
                    <select style={input} value={form.hastaMes} onChange={(e) => setForm({ ...form, hastaMes: Number(e.target.value) })}>
                      {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select></div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={btn(true)} disabled={form.tipo === "nuevo" && !form.nombre} onClick={() => agregarCambio(form)}>Agregar</button>
                <button style={btn(false)} onClick={() => setForm(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Base: la vida de hoy ── */}
        <div style={card}>
          <div style={F.h2}>Tu vida de hoy, llevada a {año}</div>
          <div style={{ ...F.caption, marginBottom: 8 }}>Lo que tienes encendido para simular, proyectado a todo el año. Los pagos únicos de este año no se repiten. Toca Termina o Cambia en una fila: el ajuste se hace ahí mismo y el resultado se actualiza en la tira de arriba.</div>
          {["ing", "gas", "deu"].map((k) => {
            const grupo = filas.filter((f) => f.kind === k && f.origen === "hoy" || (f.kind === k && f.cambio && f.origen !== "nuevo"));
            if (!grupo.length) return null;
            return (
              <div key={k} style={{ marginTop: 10 }}>
                <div style={{ ...F.label, color: colorK[k] }}>{kindL[k]}s · {grupo.length}</div>
                {grupo.map((f) => {
                  const anual = f.meses.reduce((s, v) => s + v, 0);
                  const c = f.cambio;
                  const editando = form && form.tipo !== "nuevo" && form.ref === f.key;
                  const estado = !c ? null
                    : c.tipo === "termina" ? (Number(c.desdeMes) <= 1 ? "no cuenta en todo el año" : `cuenta hasta ${mesL(Number(c.desdeMes) - 1).toLowerCase()}, después termina`)
                    : c.tipo === "cambia" ? `pasa a ${fm(c.monto)}/mes desde ${mesL(c.desdeMes).toLowerCase()}`
                    : c.tipo === "continua" ? `sigue en ${año}` : "";
                  return (
                    <div key={f.key} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, background: editando ? Cα.accent08 : "transparent", borderRadius: editando ? R.md : 0, paddingLeft: editando ? 8 : 0, paddingRight: editando ? 8 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre} <span style={F.caption}>· {f.cat}</span></div>
                          {/* 11-oct-2026 (Santiago: "¿cuánto es entonces mi arriendo?").
                              Con un cambio aplicado, primero el valor que rige en el año
                              futuro; el supuesto anterior, tachado y en pequeño. */}
                          {c && c.tipo !== "continua" ? (
                            <div style={F.caption}>
                              <b style={{ color: C.text }}>{fm(anual / 12)}/mes en {año}</b> · {fm(anual)} en el año
                              <span style={{ marginLeft: 8, textDecoration: "line-through", opacity: 0.7 }}>antes {fm(f.montoTipico)}/mes</span>
                            </div>
                          ) : (
                            <div style={F.caption}>
                              {f.capital > 0 && f.tasa > 0 ? `Capital ${fm(f.capital)} × ${f.tasa}% ${f.tasaModo === "mensual" ? "mensual" : "anual"} → ` : ""}
                              {fm(f.montoTipico)}/mes · {fm(anual)} en {año}{f.supuesto ? ` · ${f.supuesto}` : ""}
                            </div>
                          )}
                          {estado && (
                            <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8, padding: "2px 10px", borderRadius: R.pill, background: Cα.warn15, color: C.warn, fontSize: 11, fontWeight: 700 }}>
                              {estado}
                              <button onClick={() => quitarCambio(c.id)} style={{ background: "none", border: "none", color: C.warn, cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0 }}>deshacer</button>
                            </div>
                          )}
                        </div>
                        {!c && !editando && (<>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 11 }} onClick={() => setForm({ tipo: "termina", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 7 })}>Termina</button>
                          <button style={{ ...btn(false), padding: "4px 10px", fontSize: 11 }} onClick={() => setForm({ tipo: "cambia", kind: k, ref: f.key, nombre: f.nombre, desdeMes: 1, monto: Math.round(f.montoTipico) })}>Cambia</button>
                        </>)}
                      </div>
                      {editando && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                          {form.tipo === "termina" ? (
                            <div style={{ flex: "1 1 160px" }}>
                              <div style={F.label}>Último mes que cuenta en {año}</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                <option value={1}>Ninguno — no cuenta en {año}</option>
                                {MESES.filter((m) => m.v < 12).map((m) => <option key={m.v} value={m.v + 1}>{m.l}</option>)}
                              </select>
                            </div>
                          ) : (<>
                            <div style={{ flex: "1 1 160px" }}>
                              <div style={F.label}>{k === "deu" ? "Nueva cuota mensual" : "Nuevo monto mensual (COP)"}</div>
                              <input style={input} type="number" autoFocus value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
                            </div>
                            <div style={{ flex: "0 1 140px" }}>
                              <div style={F.label}>Desde</div>
                              <select style={input} value={form.desdeMes} onChange={(e) => setForm({ ...form, desdeMes: Number(e.target.value) })}>
                                {MESES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                              </select>
                            </div>
                          </>)}
                          <button style={btn(true)} onClick={() => agregarCambio(form)}>Aplicar</button>
                          <button style={btn(false)} onClick={() => setForm(null)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {(() => {
            const terminan = base.filter((b) => b.vig?.termina && !cambios.some((c) => c.tipo === "continua" && c.ref === b.key));
            if (!terminan.length) return null;
            return (
              <div style={{ marginTop: 16, paddingTop: 10, borderTop: `1px dashed ${C.borderStrong}` }}>
                <div style={F.h3}>Terminan en {añoHoy} · no se llevan a {año}</div>
                <div style={{ ...F.caption, marginBottom: 6 }}>Su vigencia acaba antes de diciembre. Si en realidad siguen, márcalo.</div>
                {terminan.map((f) => (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.border}`, opacity: 0.75 }}>
                    <span style={{ ...F.label, color: colorK[f.kind], minWidth: 56 }}>{kindL[f.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...F.body, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre} <span style={F.caption}>· {f.cat}</span></div>
                      <div style={F.caption}>{fm(f.montoTipico)}/mes · hasta {mesL(f.vig.hasta).toLowerCase()} de {añoHoy}</div>
                    </div>
                    <button style={{ ...btn(false), padding: "3px 10px", fontSize: 11 }} onClick={() => agregarCambio({ tipo: "continua", kind: f.kind, ref: f.key, desdeMes: 1 })}>Sí continúa en {año}</button>
                  </div>
                ))}
              </div>
            );
          })()}
          {filas.filter((f) => f.origen === "hoy").length === 0 && (
            <div style={F.body}>No hay nada encendido para simular. Revisa los interruptores "simular" en Ingresos, Egresos y Deudas{onNavigate ? "" : "."}</div>
          )}
        </div>
      </>)}
    </div>
  );
}
