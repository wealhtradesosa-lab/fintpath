import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { totalAnualItem } from "../lib/flowHelpers.js";
import {
  RESPUESTAS_DEFAULT, ultimaDeclaracion, estimarDesdeDeclaracion, oportunidades, ahorroMarcado, patrimonioInfo,
  impuestoDividendos, calculosGODelTitular, revisarTitular, pct, mm, impuestoDeclarado, retencionDeclarada,
} from "../lib/rentaDesdeDeclaracion.js";
import { TIPOS_INGRESO, tipoDeCategoria } from "../lib/rentaDesdeDeclaracion.js";
import { serieHistorial, origenIngresos, lista2026DesdeIngresos } from "../lib/rentaDesdeDeclaracion.js";
import { Linea, Grafica } from "./RentaUI";
import { mesesDePago } from "../lib/impuestoReferente";
import { textoFechaPago } from "./NotaFuenteImpuesto";
import { Panel, Bienvenida, SelectorTitular, Kpi, KpiGrid, Plata, Campo, Grid, Aviso, inp, card } from "./RentaUI";

/**
 * Impuestos → «Lo que viene»: cuánto me va a tocar pagar de renta este año.
 *
 * 29-oct-2026 (Santiago): "el módulo de impuestos es muy complicado… no somos
 * una plataforma para reemplazar al contador… necesito estimar cuántos
 * impuestos voy a pagar". Se parte de la última declaración del titular (del
 * histórico) y solo se pregunta qué cambió. Cálculo en lib/rentaDesdeDeclaracion.js.
 * Validado como prototipo en el chat antes de subirlo.
 */

const DEPS = [[-1, "Uno menos"], [0, "Iguales"], [1, "Uno más"], [2, "Dos más"]];
const sel_ = { ...inp, cursor: "pointer" };
const fila = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` };

// Ingresos que el titular ya tiene registrados en FINPATHIA, para traerlos como «nuevos» sin digitar.
function ingresosRegistrados(u, ownerId) {
  return (u?.ingresos || u?.ing || []).filter((i) => i && i.owner === ownerId).map((i) => ({
    id: String(i.id || i.nombre), nombre: i.nombre || i.n || i.categoria || "Ingreso",
    monto: Math.round(Number(totalAnualItem(i)) || 0), tipo: tipoDeCategoria(i.categoria || i.nombre),
  })).filter((i) => i.monto > 0);
}

function ingresosAnualesPorOwner(u) {
  const m = {};
  for (const i of u?.ingresos || u?.ing || []) if (i?.owner) m[i.owner] = (m[i.owner] || 0) + (Number(totalAnualItem(i)) || 0);
  return m;
}

export default function EstimadoRenta({ u, onGuardar, onGuardarVersiones, onNavigate, onCambiarMes }) {
  const owners = useMemo(() => (u?.owners || []).filter(Boolean), [u?.owners]);
  const calculosGO = u?.calculosGO || [];
  const conDecl = owners.find((o) => ultimaDeclaracion(o));
  const [sel, setSel] = useState((conDecl || owners[0])?.id || "");
  const [estado, setEstado] = useState(() => u?.estimadoRenta || {});
  const ingApp = useMemo(() => ingresosAnualesPorOwner(u), [u?.ingresos, u?.ing]);

  // Guardar las respuestas sin disparar un guardado por cada tecla
  const t = useRef(null);
  useEffect(() => {
    if (!onGuardar) return;
    clearTimeout(t.current);
    t.current = setTimeout(() => onGuardar(estado), 900);
    return () => clearTimeout(t.current);
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const respDe = (o) => {
    const r = { ...RESPUESTAS_DEFAULT, ...(estado[o.id] || {}) };
    // «¿Qué recibes este año?»: si no lo ha tocado, arranca con sus ingresos registrados en FINPATHIA.
    if (r.lista2026 == null) { const l = lista2026DesdeIngresos(u, o.id); if (l.length) r.lista2026 = l; }
    // La versión anterior guardaba una sola línea «Ingresos declarados (total)»: se descarta para repartirla.
    if (Array.isArray(r.filas) && r.filas.some((f) => f?.id === "total")) r.filas = r.filas.filter((f) => f?.id !== "total" && !f?.declarada);
    if (!estado[o.id]) { // primera vez: si hay una venta optimizada para el año, se trae sola
      const go = calculosGODelTitular(calculosGO, o).find((c) => Number(c?.datos?.anoVenta) === (Number(ultimaDeclaracion(o)?.anoGravable) || 0) + 1);
      if (go) r.goSel = go.id;
    }
    return r;
  };
  const set = (id, patch) => setEstado((s) => ({ ...s, [id]: { ...respDe(owners.find((o) => o.id === id)), ...patch } }));

  const owner = owners.find((o) => o.id === sel);
  const r = owner ? respDe(owner) : null;
  const gos = owner ? calculosGODelTitular(calculosGO, owner) : [];
  const e = owner ? estimarDesdeDeclaracion(owner, r, { calculosGO: gos }) : null;
  const ops = e ? oportunidades(owner, e) : [];
  const ahorro = ahorroMarcado(ops, r?.estr);
  const patDicho = (rr) => { const R0 = owner && ultimaDeclaracion(owner)?.renglones; if (!R0 || R0.patrimonioBruto == null) return null;
    const pm = rr?.patrim || {}; const bienes = pm.bienes?.estado === "cambia" ? Number(pm.bienes.ahora) || 0 : Number(R0.patrimonioBruto) || 0;
    const deudas = pm.deudas?.estado === "cambia" ? Number(pm.deudas.ahora) || 0 : Number(R0.deudas) || 0; return bienes - deudas; };
  const pat = owner ? patrimonioInfo(owner, r?.casa, patDicho(r)) : null;
  const tit = e ? revisarTitular(ingApp[owner.id], e) : null;

  const cambioHecho = r && (r.g !== RESPUESTAS_DEFAULT.g || r.sigue != null || (r.nuevos || []).length || r.nuevo || r.perdido || r.aportes || r.dep || r.goSel || estado[owner?.id]);
  const marcoAlgo = r && Object.values(r.estr || {}).some((x) => x?.on);

  // Calcula todo para un juego de respuestas: el actual o una versión guardada.
  const calcular = (rr) => {
    const ee = estimarDesdeDeclaracion(owner, rr, { calculosGO: gos });
    const oo = ee ? oportunidades(owner, ee) : [];
    return { r: rr, e: ee, ops: oo, ahorro: ahorroMarcado(oo, rr?.estr), pat: patrimonioInfo(owner, rr?.casa, patDicho(rr)) };
  };
  const cambiosTexto = (rr, ee) => {
    const c = [];
    for (const f of rr.filas || []) {
      const antes = Number(f.antes) || 0, ahora = f.estado === "no" ? 0 : f.estado === "cambia" ? Number(f.ahora) || 0 : antes;
      if (ahora !== antes) c.push(antes ? `${f.nombre || "Ingreso"}: ${mm(antes)} → ${mm(ahora)}` : `Ingreso nuevo: ${f.nombre || "sin nombre"} ${mm(ahora)}`);
    }
    for (const p of rr.perdidos || []) if (Number(p.monto)) c.push(`Ya no recibe: ${p.nombre || "un ingreso"} ${mm(p.monto)}`);
    if (rr.sigue != null && rr.sigue !== "") c.push(`Lo de siempre: ${mm(ee.brutos)} el año pasado → ${mm(rr.sigue)} este año`);
    else if (rr.g) c.push(`Ingresos de siempre: ${rr.g > 0 ? "suben" : "bajan"} ~${Math.round(Math.abs(rr.g) * 100)}%`);
    for (const n of rr.nuevos || []) if (Number(n.monto)) c.push(`Ingreso nuevo: ${n.nombre || "sin nombre"} (${(TIPOS_INGRESO.find(([k]) => k === n.tipo) || [, "Otro"])[1]}) ${mm(n.monto)}${Number(n.costos) ? `, costos ${mm(n.costos)}` : ""}`);
    if (rr.nuevo) c.push(`Ingreso nuevo: ${mm(rr.nuevo)}${rr.nuevoGastos ? `, con costos de ${mm(rr.nuevoGastos)}` : ""}`);
    if (rr.perdido) c.push(`Ingreso que deja de recibir: ${mm(rr.perdido)}`);
    if (rr.aportes) c.push(`Aportes voluntarios a pensión o AFC: ${mm(rr.aportes)}`);
    if (rr.dep) c.push(`Dependientes: ${rr.dep > 0 ? "+" : ""}${rr.dep}`);
    if (ee.go) c.push(ee.gc ? `Venta: ${ee.gc.nombre} (precio ${mm(ee.gc.resumen?.venta)}, ganancia ocasional optimizada ${mm(ee.go)})` : `Venta de activo: ganancia ocasional ${mm(ee.go)}`);
    for (const p of ee.pasos) if (p.off) c.push(`Apagado en esta simulación: ${p.texto}`);
    return c;
  };
  const descargarPDF = async (rr = r, nombre) => {
    const k = calcular(rr); if (!k.e) return;
    const { exportResumenContadorPDF } = await import("../lib/pdfSectionExport.js");
    const estrategias = k.ops.filter((op) => !op.info && rr.estr?.[op.id]?.on).map((op) => ({ titulo: op.titulo, norma: op.norma, ahorro: op.ahorro(rr.estr[op.id].v), valor: op.entero ? String(rr.estr[op.id].v) : mm(rr.estr[op.id].v) }));
    const preguntas = ["¿Las retenciones estimadas coinciden con los certificados del año?", "¿Aplican las estrategias marcadas y con qué soportes?"];
    if (k.pat && !k.pat.sociedad && (k.pat.aplica || k.pat.cerca)) preguntas.push("Impuesto al patrimonio: valor patrimonial de los activos y exclusión de la casa de habitación.");
    if (k.e.anticipoSiguiente > 0) preguntas.push("¿Conviene pedir reducción del anticipo (Art. 809)?");
    await exportResumenContadorPDF({ titular: nombre ? `${owner.name} · ${nombre}` : owner.name, e: k.e, cambios: cambiosTexto(rr, k.e), estrategias, patrimonio: k.pat, preguntas });
  };

  // ── Versiones guardadas («Renta 2026 v1: con venta», «v2: sin venta»…) ──
  const versiones = (u?.versionesRenta || []).filter((v) => v.ownerId === owner?.id);
  const [nombreV, setNombreV] = useState("");
  const [abierta, setAbierta] = useState(null);
  const sugerirNombre = () => `Renta ${e?.anoEst || ""} ${owner?.name || ""} v${versiones.length + 1}`;
  const guardarVersion = (nueva) => {
    if (!e || !onGuardarVersiones) return;
    const nombreAbierta = versiones.find((v) => v.id === abierta)?.nombre;
    const escrito = (nombreV || "").trim();
    // «Guardar como versión nueva» con el mismo nombre de la abierta → sugerir el siguiente (v2, v3…)
    const nombre = !escrito || (nueva && escrito === nombreAbierta) ? sugerirNombre() : escrito;
    const resumen = { total: Math.round(e.total), totalAlDeclarar: Math.round(e.totalAlDeclarar), ahorro: Math.round(ahorro), go: Math.round(e.go), anoEst: e.anoEst };
    const todas = u?.versionesRenta || [];
    if (!nueva && abierta && todas.some((v) => v.id === abierta)) {
      onGuardarVersiones(todas.map((v) => (v.id === abierta ? { ...v, nombre, fecha: new Date().toISOString(), resp: r, resumen } : v)));
    } else {
      const id = "vr_" + Date.now().toString(36);
      onGuardarVersiones([{ id, ownerId: owner.id, nombre, fecha: new Date().toISOString(), resp: r, resumen }, ...todas].slice(0, 40));
      setAbierta(id);
    }
    setNombreV(nombre);
  };
  const abrirVersion = (v) => { setEstado((s0) => ({ ...s0, [owner.id]: { ...RESPUESTAS_DEFAULT, ...v.resp } })); setAbierta(v.id); setNombreV(v.nombre); };
  const borrarVersion = (v) => { onGuardarVersiones?.((u?.versionesRenta || []).filter((x) => x.id !== v.id)); if (abierta === v.id) { setAbierta(null); setNombreV(""); } };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader label="Impuestos · calculadora de declaración" title="¿Cuánto me va a tocar pagar de renta?" accent="renta" compact
        subtitle="Partimos de la última declaración que hizo tu contador y solo te preguntamos qué cambió. Así el cálculo conserva todo lo que él ya aplicó." />

      {(() => { const y = new Date().getFullYear(); return (
        <div style={{ ...card, background: Cα.accent08, borderColor: Cα.accent25, display: "grid", gap: 6 }}>
          <div style={F.h3}>📅 Para qué sirve este cálculo</div>
          <div style={{ ...F.body, color: C.text }}>
            Aquí calculas la <b>renta de {y}</b> (lo que estás ganando este año), que <b>se declara y se paga en {y + 1}</b>.
            {" "}Ese resultado es el que usa el <button type="button" onClick={() => onNavigate?.("simf")} style={{ ...F.body, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Simulador {y + 1}</button> para proyectar tu flujo de caja de ese año.
          </div>
          <div style={F.caption}>Los impuestos que pagas en {y} salen de tu declaración {y - 1}, que ya presentaste: esos los usa el simulador del año actual.</div>
        </div>
      ); })()}

      <Bienvenida
        titulo="En tres minutos sabes cuánto vas a pagar y cuánta plata tener lista"
        potencial={[
          "Estima la renta del año para cada persona o empresa del grupo, con un rango y el porqué de cada cambio.",
          "Te dice cuánto pagar al declarar, incluido el anticipo del año siguiente que casi nadie tiene en cuenta.",
          "Detecta beneficios que aplican a tu caso y te deja marcarlos para ver cómo cambia el impuesto.",
          "Arma un resumen en PDF para llevarle a tu contador.",
        ]}
        pasos={[
          { t: "Escoge a quién le calculamos", hecho: !!owner || sel === "grupo" },
          { t: "Ten su última declaración cargada (el PDF se lee solo)", hecho: !!e },
          { t: "Cuéntanos qué cambió este año", hecho: !!(e && cambioHecho) },
          { t: "Marca lo que vas a hacer y descarga el resumen", hecho: !!marcoAlgo },
        ]}
        accion={owner && !e ? { label: "Subir la declaración en «Historial» →", onClick: () => onNavigate?.("prevtax") } : null}
      />

      {!owners.length ? (
        <Aviso tipo="info">Primero crea los titulares (tú, tu pareja, tus empresas) en Configuración. Después sube la última declaración de cada uno.</Aviso>
      ) : (
        <Panel titulo="1. ¿A quién le calculamos?"><SelectorTitular owners={owners} value={sel} onChange={setSel} /></Panel>
      )}

      {sel === "grupo" && <Grupo owners={owners} respDe={respDe} calculosGO={calculosGO} />}

      {owner && !e && sel !== "grupo" && (
        <Aviso><b>{owner.name} no tiene declaración cargada.</b> Súbela en «Historial» (el PDF del formulario {owner.type === "juridica" ? "110" : "210"}) y la leemos sola.</Aviso>
      )}

      {e && sel !== "grupo" && (<>
        {versiones.length > 0 && (
          <div style={{ ...F.body, color: C.text }}>💾 Tienes {versiones.length} cálculo{versiones.length > 1 ? "s" : ""} guardado{versiones.length > 1 ? "s" : ""} para {owner.name}. <button type="button" onClick={() => document.getElementById("guardar-calculo")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ ...F.body, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Verlos o abrir uno ↓</button></div>
        )}
        <Panel titulo="2. Su ficha: lo que declaró el año pasado" sub={`${e.d.tipo === "F110" ? "Formulario 110" : "Formulario 210"} · año gravable ${e.ano} · traída del historial`}>
          <KpiGrid>
            <Kpi k="Ingresos brutos" v={mm(e.d.renglones.ingresosBrutos)} />
            <Kpi k="Impuesto de renta" v={mm(impuestoDeclarado(e.d))} />
            <Kpi k="Tasa efectiva" v={pct(impuestoDeclarado(e.d) / (Number(e.d.renglones.ingresosBrutos) || 1))} />
            <Kpi k={e.nat ? "Retenciones" : "Autorretenciones"} v={mm(retencionDeclarada(e.d))} />
            {e.d.renglones.saldoPagar != null && <Kpi k="Saldo que pagó" v={mm(e.d.renglones.saldoPagar)} />}
            {Number(e.d.renglones.ingresosNoConstitutivos) > 0 && <Kpi k="Ingresos no constitutivos" v={mm(e.d.renglones.ingresosNoConstitutivos)} d="aportes obligatorios y similares" />}
            {e.nat && <Kpi k="Exentas y deducciones" v={mm(["rentaExenta25", "deducIntereses", "deducMedicina", "deducDependientes", "pvAFC"].reduce((a, k) => a + (Number(e.d.renglones[k]) || 0), 0))} d="25% laboral, intereses, medicina, dependientes, AFC" />}
            {!e.nat && Number(e.d.renglones.costosDeducciones) > 0 && <Kpi k="Costos y deducciones" v={mm(e.d.renglones.costosDeducciones)} />}
            {e.d.renglones.patrimonioBruto != null && <Kpi k="Patrimonio bruto" v={mm(e.d.renglones.patrimonioBruto)} />}
            {e.d.renglones.deudas != null && <Kpi k="Deudas" v={mm(e.d.renglones.deudas)} />}
            {e.d.renglones.patrimonioLiquido != null && <Kpi k="Patrimonio líquido" v={mm(e.d.renglones.patrimonioLiquido)} />}
          </KpiGrid>
          <OrigenIngresos e={e} registrados={ingresosRegistrados(u, owner.id)} onNavigate={onNavigate} />
          <ResumenHistoria owner={owner} />
          {tit && (
            <div style={{ marginTop: 10 }}>
              {tit.alerta
                ? <Aviso><b>Revisa a nombre de quién están los ingresos.</b> En FINPATHIA hay {mm(tit.ingresosApp)} al año a nombre de {owner.name}, bastante más de lo que declaró ({mm(tit.declarado)}). Si alguno es de una sociedad, cámbiale el titular en Ingresos: tributa allá, no aquí.</Aviso>
                : <Aviso tipo="ok"><b>Titular al día:</b> lo registrado a nombre de {owner.name} ({mm(tit.ingresosApp)} al año) es coherente con lo declarado.</Aviso>}
            </div>
          )}
        </Panel>

        <Panel titulo="3. ¿Qué cambió este año?" sub="Cuéntanos con tus palabras y números. Si algo no cambió, déjalo como está.">
          <Lista2026 e={e} r={r} registrados={lista2026DesdeIngresos(u, owner.id)} onChange={(patch) => set(owner.id, patch)} />
          <CambioPatrimonio e={e} r={r} onChange={(patrim) => set(owner.id, { patrim })} owner={owner}
            deudasApp={(u?.deu || []).filter((d) => d && d.owner === owner.id && d.sim !== false).reduce((a, d) => a + (Number(d.mt) || 0) * (d.moneda === "USD" ? (Number(u?.trm) || 4200) : 1), 0)}
            bienesApp={(u?.inv || []).filter((i) => i && i.owner === owner.id && i.sim !== false).reduce((a, i) => a + (Number(i.va) || 0) * (i.moneda === "USD" ? (Number(u?.trm) || 4200) : 1), 0)} />
          <div style={{ ...F.h3, margin: "18px 0 8px" }}>Otros cambios</div>
          <Grid>
            {e.nat && <Campo label="Aportes voluntarios a pensión o AFC" ayuda={`Lo que vas a aportar de más que el año pasado. Escoge si es al mes o en todo el año${r.perAportes === "mes" && r.aportes ? ` (= ${mm(r.aportes)} en el año)` : ""}.`}><PlataPeriodo value={r.aportes} per={r.perAportes || "año"} onPer={(p) => set(owner.id, { perAportes: p })} onChange={(v) => set(owner.id, { aportes: v })} /></Campo>}
            {e.nat && <Campo label="Dependientes frente al año pasado">
              <select style={sel_} value={r.dep} onChange={(ev) => set(owner.id, { dep: Number(ev.target.value) })}>{DEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Campo>}
            <Campo label="¿Vendes un inmueble o activo este año?" ayuda="Si lo optimizaste en el solucionador, escógelo y traemos el impuesto ya optimizado">
              <select style={sel_} value={r.goSel} onChange={(ev) => set(owner.id, { goSel: ev.target.value })}>
                <option value="">No vendo nada este año</option>
                {gos.map((c) => <option key={c.id} value={c.id}>{c.nombre} · impuesto {mm(c.resumen?.final)}</option>)}
                <option value="manual">Otra venta: escribir el impuesto</option>
              </select>
              {r.goSel === "manual" && <Plata value={r.go} onChange={(v) => set(owner.id, { go: v })} placeholder="Impuesto de ganancia ocasional" />}
            </Campo>
            <Campo label={`Anticipo que pagaste para ${e.anoEst}`} ayuda={e.antLeido ? "Leído de tu declaración" : r.ant == null ? "Lo calculamos con tu declaración (Art. 807). Corrígelo con el renglón real si es distinto." : "Valor que escribiste"}>
              <Plata value={e.antPagado} onChange={(v) => set(owner.id, { ant: v })} />
            </Campo>
          </Grid>
        </Panel>

        <div id="tu-cuenta" />
        <Panel titulo={`4. Tu cuenta: cuánto te toca pagar en ${e.anoEst + 1}`} sub={`Renta del año ${e.anoEst}, que se declara y paga en ${e.anoEst + 1}. Así se llega al número, renglón por renglón.`}>
          <Cuenta e={e} ahorro={ahorro} />
          <FechaPago owner={owner} ano={e.anoEst + 1} valor={e.totalAlDeclarar} onCambiarMes={onCambiarMes} onNavigate={onNavigate} />
          <div style={{ ...F.h3, marginTop: 14 }}>¿Por qué cambia?</div>
          <div style={{ ...F.caption, marginTop: 2 }}>Prende o apaga cada cambio para ver cómo queda el impuesto con o sin él.</div>
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {(e.pasos.length ? e.pasos : [{ clave: "nada", texto: "Nada cambió: misma base que el año pasado", delta: 0 }]).map((p) => {
              const fijo = p.clave === "uvt" || p.clave === "nada";
              return (
                <li key={p.clave} style={{ ...F.body, display: "flex", alignItems: "center", gap: 10, background: C.raised, borderRadius: R.md, padding: "8px 10px", opacity: p.off ? 0.55 : 1 }}>
                  {fijo ? <span style={{ width: 34, textAlign: "center" }}>·</span> : (
                    <button type="button" role="switch" aria-checked={!p.off} aria-label={(p.off ? "Prender: " : "Apagar: ") + p.texto}
                      onClick={() => set(owner.id, { off: { ...(r.off || {}), [p.clave]: !p.off } })}
                      style={{ width: 34, height: 20, borderRadius: R.pill, border: "none", cursor: "pointer", position: "relative", flex: "none", background: p.off ? C.border : C.ok }}>
                      <span style={{ position: "absolute", top: 3, left: p.off ? 3 : 17, width: 14, height: 14, borderRadius: R.pill, background: C.text }} />
                    </button>
                  )}
                  <span style={{ flex: 1, color: C.text, textDecoration: p.off ? "line-through" : "none" }}>{p.texto}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: p.off ? C.subtle : p.delta > 0 ? C.danger : C.ok, whiteSpace: "nowrap" }}>{p.off ? "apagado" : `${p.delta >= 0 ? "+" : "−"}${mm(Math.abs(p.delta))}`}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => descargarPDF(r, abierta ? nombreV : undefined)} style={{ marginTop: 14, padding: "9px 14px", borderRadius: R.md, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📄 Resumen para el contador (PDF)</button>
        </Panel>

        {pat && (!pat.sociedad || pat.extraordinario) && <Patrimonio pat={pat} casa={r.casa} onCasa={(v) => set(owner.id, { casa: v })} />}

        <Panel titulo="5. Oportunidades para pagar menos" sub="Detectadas con su declaración y lo que tiene en FINPATHIA. Marca las que vas a hacer y mira cómo cambia el impuesto.">
          <div style={{ ...card, background: Cα.ok08, borderColor: Cα.ok25, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <div><div style={F.label}>Hoy va para</div><div style={F.monoXl}>{mm(e.total)}</div></div>
            <div><div style={F.label}>Con lo que marcaste</div><div style={F.monoXl}>{mm(Math.max(0, e.total - ahorro))}</div></div>
            <div><div style={F.label}>Ahorro estimado</div><div style={{ ...F.monoXl, color: C.ok }}>{mm(ahorro)}</div><div style={F.caption}>{ahorro ? "Valídalo con tu contador" : "Marca una estrategia"}</div></div>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {ops.map((op) => <Oportunidad key={op.id} op={op} st={r.estr?.[op.id]} onNavigate={onNavigate}
              onChange={(patch) => set(owner.id, { estr: { ...(r.estr || {}), [op.id]: { on: false, v: op.sugerido || 0, ...(r.estr?.[op.id] || {}), ...patch } } })} />)}
          </div>
        </Panel>

        <div id="guardar-calculo" />
        <Versiones nombre={nombreV} setNombre={setNombreV} sugerido={sugerirNombre()} abierta={abierta} versiones={versiones}
          puedeGuardar={!!onGuardarVersiones} actual={{ total: e.total, totalAlDeclarar: e.totalAlDeclarar, ahorro }}
          onGuardar={guardarVersion} onAbrir={abrirVersion} onBorrar={borrarVersion} onPDF={(v) => descargarPDF({ ...RESPUESTAS_DEFAULT, ...v.resp }, v.nombre)}
          onNueva={() => { setEstado((s0) => { const n = { ...s0 }; delete n[owner.id]; return n; }); setAbierta(null); setNombreV(""); }} />
        <Panel titulo="6. Antes del 31 de diciembre">
          <ul style={{ ...F.body, margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {e.totalAlDeclarar > 0 && <li><Calendario e={e} /></li>}
            <li><b style={{ color: C.text }}>Ejecuta las estrategias que marcaste:</b> cuentan solo si quedan hechas y soportadas dentro de este año.</li>
            <li><b style={{ color: C.text }}>Lleva esto a tu contador:</b> ingresos nuevos, ventas, certificados de retención y el resumen en PDF. Él hace la declaración real.</li>
          </ul>
        </Panel>
      </>)}

      {e && sel !== "grupo" && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 5, ...card, padding: "12px 16px", borderColor: Cα.accent25, background: C.surface, boxShadow: "0 -8px 24px rgba(0,0,0,0.35)", display: "flex", flexWrap: "wrap", gap: "8px 24px", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={F.label}>{owner.name} · te toca pagar {textoFechaPago(owner)} de {e.anoEst + 1}</div>
            <div style={{ ...F.monoXl, color: C.warn }}>{mm(e.totalAlDeclarar)}</div>
          </div>
          <div style={{ ...F.caption, display: "grid", gap: 2, textAlign: "right" }}>
            <span>Impuesto {mm(e.total)} − ya retenido y anticipado {mm(e.ret + e.antPagado)} + anticipo {e.anoEst + 1} {mm(e.anticipoSiguiente)}</span>
            {ahorro > 0 && <span style={{ color: C.ok, fontWeight: 600 }}>Con las estrategias que marcaste: {mm(Math.max(0, e.totalAlDeclarar - ahorro))}</span>}
          </div>
        </div>
      )}

      <p style={F.caption}>Estimación para planear tu flujo de caja, no es una declaración ni asesoría tributaria: tu contador hace la declaración real. Personas: tabla del Art. 241; sociedades: 35% (Art. 240); ganancia ocasional 15%; anticipo Art. 807; impuesto al patrimonio Ley 2277 de 2022.</p>
    </div>
  );
}

function Calendario({ e }) {
  const hoy = new Date(), hoyM = hoy.getFullYear() * 12 + hoy.getMonth();
  const meses = (ano, mes) => Math.max(1, ano * 12 + mes - hoyM);
  const sig = e.anoEst + 1;
  if (e.nat) return (<><b style={{ color: C.text }}>Calendario y plata lista:</b> las personas declaran entre agosto y octubre de {sig}, según los dos últimos dígitos de la cédula (la DIAN fija las fechas en diciembre). Para tener los {mm(e.totalAlDeclarar)} separa unos <b style={{ color: C.text }}>{mm(e.totalAlDeclarar / meses(sig, 7))} al mes</b> desde ahora hasta agosto.</>);
  return (<><b style={{ color: C.text }}>Calendario y plata lista:</b> las sociedades pagan en dos cuotas, cerca de mayo y julio de {sig}, según el último dígito del NIT (la DIAN fija las fechas en diciembre). Primera cuota ~{mm(e.totalAlDeclarar / 2)}: separa <b style={{ color: C.text }}>{mm(e.totalAlDeclarar / 2 / meses(sig, 4))} al mes</b> hasta mayo; la segunda se completa entre mayo y julio.</>);
}

function Oportunidad({ op, st, onChange, onNavigate }) {
  if (op.info) return (
    <div style={{ background: C.raised, border: `1px dashed ${C.border}`, borderRadius: R.lg, padding: 14 }}>
      <div style={F.h3}>{op.titulo}</div>
      <p style={{ ...F.body, marginTop: 6 }}>{op.porque}</p>
      <div style={{ ...F.caption, marginTop: 6 }}>{op.norma}</div>
      {op.link && <button type="button" onClick={() => onNavigate?.(op.irA)} style={{ ...F.h3, marginTop: 8, background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0 }}>{op.link} →</button>}
    </div>
  );
  const v = st?.v ?? op.sugerido ?? 0, on = !!st?.on, a = op.ahorro(v);
  return (
    <div style={{ border: `1px solid ${on ? C.ok : C.border}`, borderRadius: R.lg, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={F.h3}>{op.titulo}</div>
        <span style={{ ...F.mono, color: C.ok }}>{a > 0 ? "ahorro ~" + mm(a) : "pon el valor"}</span>
      </div>
      <p style={{ ...F.body, marginTop: 6 }}>{op.porque}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginTop: 10 }}>
        <div style={{ flex: "1 1 240px" }}>
          <Campo label={op.campo}>
            {op.entero
              ? <input inputMode="numeric" style={inp} value={v || ""} placeholder="0" onChange={(ev) => onChange({ v: Number(ev.target.value.replace(/[^0-9]/g, "")) || 0 })} />
              : <Plata value={v} onChange={(x) => onChange({ v: x })} />}
          </Campo>
        </div>
        <label style={{ ...F.h3, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer", padding: "9px 0" }}>
          <input type="checkbox" checked={on} onChange={(ev) => onChange({ on: ev.target.checked })} style={{ width: 18, height: 18, accentColor: C.ok }} /> Lo voy a hacer
        </label>
      </div>
      <div style={{ ...F.caption, marginTop: 6 }}>{op.norma}</div>
      {op.ojo && <div style={{ ...F.caption, color: C.warn, marginTop: 4 }}>Ojo: {op.ojo}</div>}
    </div>
  );
}

function Patrimonio({ pat, casa, onCasa }) {
  if (pat.sociedad) return (
    <Aviso><b>Impuesto extraordinario de 2026 para empresas.</b> El patrimonio líquido ({mm(pat.patrimonio)}) supera 200.000 UVT: le aplica el impuesto del Decreto 173 de 2026, que la Corte Constitucional aún revisa. Confírmalo con el contador.</Aviso>
  );
  return (
    <Panel titulo="Impuesto al patrimonio" sub={`Lo pagan las personas con patrimonio líquido de 72.000 UVT o más al 1 de enero (${mm(pat.umbral)} en ${pat.anoA}). Se declara aparte, en el formulario 420.`}>
      <KpiGrid>
        <Kpi k={`Patrimonio líquido al 1-ene-${pat.anoA}`} v={mm(pat.patA)} d={pat.exc ? `menos casa ${mm(pat.exc)}` : "según la última declaración"} />
        <Kpi k={`Impuesto ${pat.anoA}`} v={pat.aplica ? mm(pat.impA) : "No aplica"} d={pat.aplica ? "ya se debió declarar este año" : `está ${mm(pat.umbral - (pat.patA - pat.exc))} por debajo del umbral`} color={pat.aplica ? C.danger : undefined} />
        <Kpi k={`Al 1-ene-${pat.anoB}`} v={mm(pat.patB)} d={pat.dicho ? "con lo que dijiste de tu patrimonio" : `si sigue la tendencia (${pct(pat.crec)} al año)`} />
        <Kpi k={`Impuesto ${pat.anoB} estimado`} v={pat.impB > 0 ? mm(pat.impB) : "No aplica"} d={pat.impB > 0 ? `con la UVT ${pat.anoB} estimada` : "sigue por debajo del umbral"} color={pat.impB > 0 ? C.danger : undefined} />
      </KpiGrid>
      <div style={{ maxWidth: 360, marginTop: 12 }}>
        <Campo label="Valor de la casa donde vives (si es tuya)" ayuda={`Hasta 12.000 UVT (${mm(12000 * pat.uvtA)}) salen de la base`}><Plata value={casa} onChange={onCasa} /></Campo>
      </div>
      {(pat.aplica || pat.cerca) && <div style={{ marginTop: 12 }}><Aviso><b>{pat.aplica ? "Te aplica." : "Te estás acercando al umbral."}</b> Opciones que se revisan con el contador: excluir la casa de habitación; que algunos activos estén a nombre de la sociedad (este impuesto es para personas); y revisar el valor patrimonial de acciones e inmuebles, que se declaran por su costo fiscal y no por su valor comercial.</Aviso></div>}
    </Panel>
  );
}

function Grupo({ owners, respDe, calculosGO }) {
  const filas = owners.map((o) => ({ o, e: estimarDesdeDeclaracion(o, respDe(o), { calculosGO: calculosGODelTitular(calculosGO, o) }) }));
  const con = filas.filter((f) => f.e);
  const T = con.reduce((a, { e }) => ({ a: a.a + e.impBase, b: a.b + e.total, c: a.c + e.totalAlDeclarar }), { a: 0, b: 0, c: 0 });
  const socs = con.filter((f) => !f.e.nat), pers = con.filter((f) => f.e.nat);
  const [soc, setSoc] = useState(socs[0]?.o.id || "");
  const [per, setPer] = useState(pers[0]?.o.id || "");
  const s0 = socs.find((f) => f.o.id === soc)?.e;
  const sugerido = s0 ? Math.max(0, (Number(s0.d.renglones.rentaLiquidaGravable) || 0) - s0.impBase) / 2 : 0;
  const [div, setDiv] = useState(Math.round(sugerido / 1e7) * 1e7);
  const p0 = pers.find((f) => f.o.id === per)?.e;
  const dv = p0 && div ? impuestoDividendos(p0.base, div, p0.uvt) : null;
  const td = { padding: "8px 6px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace" };
  return (<>
    <Panel titulo="2. Todo el grupo familiar" sub="Cada titular se calcula por separado, con su propia declaración y lo que respondiste para él. Entra a cada uno para ajustar sus cambios.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...F.body, color: C.text }}>
          <thead><tr>{["Titular", "Impuesto declarado", "Estimado", "Cambio", "Total al declarar"].map((h, i) => <th key={h} style={{ ...F.label, padding: "8px 6px", textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map(({ o, e }) => e ? (
              <tr key={o.id}><td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{o.name}<div style={F.caption}>{e.nat ? "Persona natural" : "Sociedad"}</div></td>
                <td style={td}>{mm(e.impBase)}</td><td style={td}>{mm(e.total)}</td><td style={{ ...td, color: e.total > e.impBase ? C.danger : C.ok }}>{e.total - e.impBase >= 0 ? "+" : "−"}{mm(Math.abs(e.total - e.impBase))}</td><td style={td}>{mm(e.totalAlDeclarar)}</td></tr>
            ) : (
              <tr key={o.id}><td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{o.name}</td><td colSpan={4} style={{ ...td, textAlign: "left", fontFamily: "inherit", color: C.subtle }}>Sin declaración cargada · súbela para incluirlo</td></tr>
            ))}
            <tr><td style={{ ...td, textAlign: "left", fontFamily: "inherit", fontWeight: 700 }}>Grupo</td><td style={{ ...td, fontWeight: 700 }}>{mm(T.a)}</td><td style={{ ...td, fontWeight: 700 }}>{mm(T.b)}</td><td style={{ ...td, fontWeight: 700 }}>{T.b - T.a >= 0 ? "+" : "−"}{mm(Math.abs(T.b - T.a))}</td><td style={{ ...td, fontWeight: 700 }}>{mm(T.c)}</td></tr>
          </tbody>
        </table>
      </div>
    </Panel>
    {socs.length > 0 && pers.length > 0 && (
      <Panel titulo="¿Repartir utilidades de la empresa?" sub="La empresa ya pagó 35% de renta sobre esas utilidades. Si las reparte, la persona paga además impuesto a los dividendos: se suman a su renta y se descuenta el 19% de lo que pase de 1.090 UVT.">
        <Grid>
          <Campo label="Empresa"><select style={sel_} value={soc} onChange={(ev) => setSoc(ev.target.value)}>{socs.map(({ o }) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Campo>
          <Campo label="Socio que las recibe"><select style={sel_} value={per} onChange={(ev) => setPer(ev.target.value)}>{pers.map(({ o }) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Campo>
          <Campo label="Utilidades a repartir"><Plata value={div} onChange={setDiv} /></Campo>
        </Grid>
        {dv && (<>
          <div style={{ marginTop: 12 }}><KpiGrid>
            <Kpi k="Impuesto adicional del socio" v={mm(dv.extra)} d={`${pct(dv.extra / div)} de lo que recibe`} color={C.danger} />
            <Kpi k="Le queda en el bolsillo" v={mm(dv.neto)} d="después de su impuesto" />
            <Kpi k="Retención al pagarlos" v={mm(dv.retencion)} d="15% de lo que pase de 1.090 UVT; se descuenta al declarar" />
            <Kpi k="Carga total del grupo" v={pct(dv.cargaTotal)} d="empresa (35%) + socio, sobre la utilidad antes de impuestos" />
          </KpiGrid></div>
          <ul style={{ ...F.body, margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
            <li><b style={{ color: C.text }}>Si las dejas en la empresa</b>, hoy no pagas nada adicional y la plata sigue trabajando allá; además, el impuesto al patrimonio es solo para personas.</li>
            <li><b style={{ color: C.text }}>Si las repartes</b>, el socio paga {mm(dv.extra)} más en su renta y su patrimonio crece {mm(dv.neto)}.</li>
            <li>Repartir en varios años o entre varios socios puede bajar la tarifa marginal. Valídalo con el contador.</li>
          </ul>
        </>)}
      </Panel>
    )}
  </>);
}

// Barra de versiones: guardar el escenario con un nombre, abrir, comparar y descargar cada uno.
function Versiones({ nombre, setNombre, sugerido, abierta, versiones, puedeGuardar, actual, onGuardar, onAbrir, onBorrar, onPDF, onNueva }) {
  const btn = (primario) => ({ padding: "0 14px", height: 42, borderRadius: R.md, border: primario ? "none" : `1px solid ${C.border}`, background: primario ? C.accent : "transparent", color: primario ? C.text : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" });
  const td = { padding: "8px 6px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap" };
  return (
    <Panel titulo="💾 Guardar este cálculo" sub="Cuando termines, guárdalo con un nombre. Puedes guardar varios escenarios («con venta», «sin venta», «con aportes») para compararlos y mandarle al contador el que decidas.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <Campo label={abierta ? "Nombre de la versión abierta" : "Nombre de la versión"}>
            <input style={inp} value={nombre} placeholder={sugerido} onChange={(ev) => setNombre(ev.target.value)} />
          </Campo>
        </div>
        <button type="button" disabled={!puedeGuardar} onClick={() => onGuardar(false)} style={btn(true)}>💾 {abierta ? "Guardar cambios" : "Guardar versión"}</button>
        {abierta && <button type="button" onClick={() => onGuardar(true)} style={btn(false)}>Guardar como versión nueva</button>}
        <button type="button" onClick={onNueva} style={btn(false)}>+ Empezar de cero</button>
      </div>
      {versiones.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...F.body, color: C.text }}>
            <thead><tr>{["Versión", "Impuesto", "Total al declarar", "Ahorro marcado", ""].map((h, i) => <th key={h || i} style={{ ...F.label, padding: "8px 6px", textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {!abierta && (
                <tr><td style={{ ...td, textAlign: "left", fontFamily: "inherit", color: C.muted }}>En pantalla (sin guardar)</td><td style={td}>{mm(actual.total)}</td><td style={td}>{mm(actual.totalAlDeclarar)}</td><td style={{ ...td, color: C.ok }}>{mm(actual.ahorro)}</td><td style={td} /></tr>
              )}
              {versiones.map((v) => (
                <tr key={v.id} style={{ background: abierta === v.id ? Cα.accent08 : "transparent" }}>
                  <td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>
                    <div style={{ ...F.h3, color: abierta === v.id ? C.accent : C.text }}>{v.nombre}{abierta === v.id ? " · abierta" : ""}</div>
                    <div style={F.caption}>{new Date(v.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </td>
                  <td style={td}>{mm(v.resumen?.total)}</td>
                  <td style={td}>{mm(v.resumen?.totalAlDeclarar)}</td>
                  <td style={{ ...td, color: C.ok }}>{mm(v.resumen?.ahorro)}</td>
                  <td style={{ ...td, fontFamily: "inherit" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button type="button" onClick={() => onAbrir(v)} style={{ ...btn(false), height: 30, padding: "0 10px" }}>Abrir</button>
                      <button type="button" onClick={() => onPDF(v)} style={{ ...btn(false), height: 30, padding: "0 10px" }}>📄 PDF</button>
                      <button type="button" onClick={() => onBorrar(v)} style={{ ...btn(false), height: 30, padding: "0 10px", color: C.danger }}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}



// Resumen de su historia en la ficha: ubica antes de llenar lo nuevo (29-oct-2026, Santiago).
function ResumenHistoria({ owner }) {
  const s = serieHistorial(owner);
  if (s.length < 2) return null;
  const anos = s.map((x) => x.ano), u = s.at(-1), p = s.at(-2);
  const corto = (v) => "$" + Math.round((Number(v) || 0) / 1e6).toLocaleString("es-CO");
  const cambio = (l, a, b, subirEsMalo) => {
    if (a == null || b == null || !a) return null;
    const d = (b - a) / a; if (Math.abs(d) < 0.03) return null;
    return <li key={l}><b style={{ color: C.text }}>{l} {d > 0 ? "subió" : "bajó"} {pct(Math.abs(d), 0)}</b>: de {mm(a)} a {mm(b)} <span style={{ color: (d > 0) === subirEsMalo ? C.danger : C.ok }}>{d > 0 ? "▲" : "▼"}</span></li>;
  };
  const td = { padding: "6px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap" };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={F.h3}>Así le ha ido, año tras año</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 8 }}>
        <Grafica titulo="Ingresos (MM)"><Linea anos={anos} v={s.map((x) => x.ing)} fmt={corto} color={C.accent} txt={15} /></Grafica>
        <Grafica titulo="Impuesto (MM)"><Linea anos={anos} v={s.map((x) => x.imp)} fmt={corto} color={C.danger} txt={15} /></Grafica>
        <Grafica titulo="Tasa efectiva"><Linea anos={anos} v={s.map((x) => x.tasa)} fmt={(v) => pct(v)} color={C.warn} txt={15} /></Grafica>
        {s.every((x) => x.pat != null) && <Grafica titulo="Patrimonio líquido (MM)"><Linea anos={anos} v={s.map((x) => x.pat)} fmt={corto} txt={15} /></Grafica>}
      </div>
      <div style={{ ...F.h3, marginTop: 12 }}>Principales cambios {p.ano} → {u.ano}</div>
      <ul style={{ ...F.body, margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
        {[cambio("El ingreso", p.ing, u.ing, false), cambio("El impuesto", p.imp, u.imp, true), cambio("El patrimonio líquido", p.pat, u.pat, false), cambio("La deuda", p.deudas, u.deudas, true)].filter(Boolean)}
        <li><b style={{ color: C.text }}>Tasa efectiva</b>: {pct(p.tasa)} → {pct(u.tasa)}</li>
      </ul>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...F.body, color: C.text }}>
          <thead><tr>{["Año", "Ingresos", "Impuesto", "Tasa efectiva", "Saldo pagado", "Patrimonio líquido"].map((h, i) => <th key={h} style={{ ...F.label, padding: 6, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>{s.slice().reverse().map((x) => (
            <tr key={x.ano}><td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{x.ano}</td><td style={td}>{mm(x.ing)}</td><td style={td}>{mm(x.imp)}</td><td style={td}>{pct(x.tasa)}</td><td style={td}>{mm(x.saldo)}</td><td style={td}>{x.pat != null ? mm(x.pat) : "—"}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ¿De dónde vinieron los ingresos del año pasado? Ayuda a saber qué se dejó de recibir.
function OrigenIngresos({ e, registrados, onNavigate }) {
  const o = origenIngresos(e.d);
  const lista = o.length ? o : registrados;
  const total = lista.reduce((a, x) => a + x.monto, 0) || 1;
  if (!e.nat && !o.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={F.h3}>{o.length ? `¿De dónde vinieron tus ingresos de ${e.ano}?` : "Tus ingresos registrados en FINPATHIA, por tipo"}</div>
      {!o.length && (
        <p style={{ ...F.caption, margin: "4px 0 8px" }}>Esta declaración se leyó antes de que separáramos los ingresos por tipo (salario, honorarios, dividendos…). Vuelve a subir el PDF en <button type="button" onClick={() => onNavigate?.("prevtax")} style={{ ...F.caption, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600 }}>Historial</button> y aparecerá aquí. Mientras tanto, esto es lo que tienes registrado.</p>
      )}
      {lista.length === 0 ? <p style={F.caption}>No hay ingresos registrados a nombre de este titular.</p> : (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {lista.map((x) => (
            <div key={x.id} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1.3fr) 3fr auto", gap: 10, alignItems: "center" }}>
              <span style={{ ...F.body, color: C.text }}>{x.nombre}</span>
              <div style={{ height: 10, background: C.raised, borderRadius: R.pill, overflow: "hidden" }}><div style={{ width: `${Math.max(2, (x.monto / total) * 100)}%`, height: "100%", background: C.accent }} /></div>
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: C.text, whiteSpace: "nowrap" }}>{mm(x.monto)} · {pct(x.monto / total, 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tabla de ingresos: las líneas del año pasado (de la declaración) y qué pasa con cada una este año,
// más las nuevas. Si la declaración no separa algo (comisiones dentro del salario), se desglosa.
const ESTADOS = [["sigue", "Igual"], ["cambia", "Cambia"], ["no", "Ya no"]];
function filasIniciales(e) {
  const o = origenIngresos(e.d);
  if (o.length) return o.map((x) => ({ id: x.id, nombre: x.nombre, formal: x.formal, tipo: x.tipo, antes: x.monto, estado: "sigue", declarada: true }));
  // La declaración no trae el detalle: primero se reparte el total en una lista típica, después se dice qué cambia.
  const base = e.nat
    ? [["Salario", "laboral"], ["Comisiones y bonos", "laboral"], ["Honorarios por servicios", "laboral"], ["Utilidades y dividendos de tus empresas", "dividendos"], ["Arriendos", "arriendo"], ["Intereses y rendimientos", "capital"], ["Otros ingresos", "otro"]]
    : [["Ventas o servicios", "otro"], ["Arriendos", "arriendo"], ["Intereses y rendimientos", "capital"], ["Otros ingresos", "otro"]];
  return base.map(([nombre, tipo], i) => ({ id: "pl" + i, nombre, tipo, antes: 0, estado: "sigue", plantilla: true, perAntes: tipo === "laboral" ? "mes" : "año" }));
}
function TablaIngresos({ e, r, registrados, onChange }) {
  const filas = r.filas && r.filas.length ? r.filas : filasIniciales(e);
  const modoReparto = filas.some((f) => f.plantilla);
  const repartido = filas.filter((f) => f.plantilla).reduce((a, f) => a + (Number(f.antes) || 0), 0);
  const g = r.sigue == null ? Number(r.g) || 0 : 0;
  const guardar = (nf) => onChange({ filas: nf, sigue: null });
  const upd = (id, patch) => guardar(filas.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const nuevaId = () => "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const desglosar = (f) => {
    const i = filas.findIndex((x) => x.id === f.id);
    const grupo = f.grupo || f.id, total = f.total ?? f.antes;
    const copia = filas.map((x) => (x.id === f.id ? { ...x, grupo, total, editable: true } : x));
    copia.splice(i + 1, 0, { id: nuevaId(), nombre: "", tipo: f.tipo, antes: 0, estado: "sigue", grupo, total, editable: true });
    guardar(copia);
  };
  const ahoraDe = (f) => (f.estado === "no" ? 0 : f.estado === "cambia" ? Number(f.ahora) || 0 : (Number(f.antes) || 0) * (1 + g));
  const yaTraidos = new Set(filas.map((f) => f.desde).filter(Boolean));
  const disponibles = registrados.filter((i) => !yaTraidos.has(i.id));
  const grupos = {};
  for (const f of filas) if (f.grupo) grupos[f.grupo] = { total: f.total, suma: (grupos[f.grupo]?.suma || 0) + (Number(f.antes) || 0), nombre: grupos[f.grupo]?.nombre || f.nombre };
  const btnSeg = (activo, color) => ({ flex: 1, height: 42, border: `1px solid ${activo ? color : C.border}`, background: activo ? Cα.accent15 : "transparent", color: activo ? C.text : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: "0 8px" });
  const piso = e.ingresosAntes || e.brutos;
  const dv = piso ? e.ingresosEst / piso - 1 : 0;
  let baja = 0, sube = 0, nuevo = 0; const bajan = [], suben = [], nuevos = [];
  for (const f of filas) {
    const a = Number(f.antes) || 0, d = ahoraDe(f) - a, n = (f.nombre || "Ingreso").trim();
    if (d < -1) { baja += -d; bajan.push(n); } else if (d > 1) { if (a) { sube += d; suben.push(n); } else { nuevo += d; nuevos.push(n); } }
  }
  return (
    <div style={{ background: C.raised, borderRadius: R.lg, padding: 14 }}>
      <div style={F.h3}>Así estaban tus ingresos en {e.ano} · ¿qué cambia en {e.anoEst}?</div>
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: "10px 0 4px" }}>
        {[[`${e.ano}: ¿de dónde venían tus ingresos?`, repartido > 0 || !modoReparto], [`${e.anoEst}: ¿qué sigue igual, qué cambió, qué es nuevo?`, filas.some((f) => f.estado !== "sigue" || (!f.declarada && !f.plantilla && !f.grupo))], ["Resultado: cuánto ganas y cuánto pagas", false]].map(([t, ok], i) => (
          <li key={t} style={{ flex: "1 1 220px", display: "flex", gap: 8, alignItems: "center", background: C.surface, border: `1px solid ${ok ? Cα.ok25 : C.border}`, borderRadius: R.md, padding: "8px 10px" }}>
            <span style={{ ...F.h3, minWidth: 22, height: 22, borderRadius: R.pill, display: "inline-flex", alignItems: "center", justifyContent: "center", background: ok ? C.ok : C.raised, color: ok ? C.bg : C.muted }}>{ok ? "✓" : i + 1}</span>
            <span style={{ ...F.body, color: C.text }}>{t}</span>
          </li>
        ))}
      </ol>
      {modoReparto && (
        <div style={{ ...card, background: C.surface, marginTop: 8 }}>
          <div style={F.label}>Paso 1 · Así estaba {e.ano}</div>
          <div style={{ ...F.h2, marginTop: 4 }}>En {e.ano} tuviste ingresos por {mm(e.brutos)}. ¿Cómo estaban distribuidos?</div>
          <div style={{ marginTop: 8 }}><Aviso tipo="info"><b>Lo ideal es que esto salga solo de tu declaración.</b> Tu PDF se leyó antes de que separáramos los ingresos por tipo. Vuelve a subirlo una vez y aquí aparecerá «En {e.ano} tenías {mm(e.brutos)}: salario tanto, honorarios tanto, arriendos tanto…»; tú solo dirías qué cambió. Si no lo tienes a mano, repártelo abajo con tus números.</Aviso></div>
          <p style={{ ...F.caption, margin: "4px 0 10px" }}>Pon cuánto recibías de cada cosa, al mes o al año. Lo que no tenías déjalo en cero. Así ves de dónde salieron esos {mm(e.brutos)}.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px 16px" }}>
            {filas.filter((f) => f.plantilla).map((f) => (
              <Campo key={f.id} label={f.nombre}>
                <PlataPeriodo value={f.antes} per={f.perAntes} onPer={(p) => upd(f.id, { perAntes: p })} onChange={(v) => upd(f.id, { antes: v })} />
              </Campo>
            ))}
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", height: 8, background: C.raised, borderRadius: R.pill, overflow: "hidden" }}><div style={{ width: `${Math.min(100, (repartido / (e.brutos || 1)) * 100)}%`, height: "100%", background: Math.abs(repartido - e.brutos) < e.brutos * 0.02 ? C.ok : C.accent }} /></div>
            <span style={{ ...F.mono, fontSize: 13 }}>Repartido {mm(repartido)} de {mm(e.brutos)}{repartido < e.brutos * 0.98 ? ` · faltan ${mm(e.brutos - repartido)}` : repartido > e.brutos * 1.02 ? ` · sobran ${mm(repartido - e.brutos)}` : " ✓"}</span>
          </div>
          {repartido > e.brutos * 1.02 && (
            <div style={{ marginTop: 8 }}><Aviso>
              <b>Repartiste {mm(repartido - e.brutos)} más de lo que dice tu declaración.</b> Puede pasar si algún ingreso estaba a nombre de otra persona o de una empresa, si «otros ingresos» incluye plata que no es renta tuya (préstamos, aportes de una sociedad), o si el monto real fue distinto. Para comparar con {e.anoEst} usamos lo que repartiste; revísalo con tu contador.
            </Aviso></div>
          )}
        </div>
      )}
      {modoReparto && (
        <div style={{ marginTop: 14 }}>
          <div style={F.label}>Paso 2 · {e.anoEst}</div>
          <div style={{ ...F.h2, marginTop: 4 }}>De eso, ¿qué sigue igual, qué cambió o ya no llega? ¿Qué llegó nuevo?</div>
          <p style={{ ...F.body, margin: "6px 0 0" }}>En cada línea toca un botón. <b style={{ color: C.text }}>Igual</b>: lo sigues recibiendo como antes. <b style={{ color: C.text }}>Cambia</b>: escribe cuánto recibes ahora. <b style={{ color: C.text }}>Ya no</b>: dejó de llegar. Ejemplo: si las comisiones se acabaron, «Ya no»; si te subieron el salario, «Cambia» y el nuevo valor. Si entró algo que antes no tenías, usa «+ Agregar ingreso nuevo» al final.</p>
          {repartido === 0 && <p style={{ ...F.caption, marginTop: 6 }}>Primero reparte arriba tus ingresos de {e.ano}; aquí aparecerán para decir qué pasa con cada uno.</p>}
        </div>
      )}
      {filas.filter((f) => !(f.plantilla && !(Number(f.antes) > 0))).map((f) => {
        const nueva = !f.declarada && !f.grupo && !f.plantilla;
        return (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(160px, calc((100% - 51px) / 6)), 1fr))", gap: 10, alignItems: "start", padding: "12px 0", borderTop: `1px solid ${C.border}` }}>
            <Campo label={nueva ? "Ingreso nuevo" : f.grupo ? "Parte de este ingreso" : "Ingreso"} ayuda={f.formal && !f.editable ? `En la declaración: ${f.formal}` : undefined}>
              {nueva || f.editable ? <input style={inp} value={f.nombre} placeholder={nueva ? "Ej. trabajo nuevo" : "Ej. comisiones"} onChange={(ev) => upd(f.id, { nombre: ev.target.value })} />
                : <div style={{ ...inp, height: "auto", minHeight: 42, padding: "8px 12px", display: "flex", alignItems: "center", color: C.text, lineHeight: 1.3 }}>{f.nombre}</div>}
            </Campo>
            {e.nat ? <Campo label="Tipo"><select style={sel_} value={f.tipo} onChange={(ev) => upd(f.id, { tipo: ev.target.value })}>{TIPOS_INGRESO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo> : <div />}
            <Campo label={`En ${e.ano}`}>
              {nueva ? <div style={{ ...inp, display: "flex", alignItems: "center", color: C.subtle }}>—</div>
                : f.editable ? <PlataPeriodo value={f.antes} per={f.perAntes} onPer={(p) => upd(f.id, { perAntes: p })} onChange={(v) => upd(f.id, { antes: v })} />
                : <div style={{ ...inp, display: "flex", alignItems: "center", color: C.text, fontFamily: "ui-monospace, Menlo, monospace" }}>{mm(f.antes)}</div>}
            </Campo>
            {nueva ? <div /> : (
              <Campo label="Este año">
                <div style={{ display: "flex" }}>
                  {ESTADOS.map(([k, l], i) => (
                    <button key={k} type="button" onClick={() => upd(f.id, { estado: k, ahora: k === "cambia" ? (f.ahora ?? f.antes) : f.ahora })}
                      style={{ ...btnSeg(f.estado === k, k === "no" ? C.danger : C.accent), borderRadius: i === 0 ? `${R.md}px 0 0 ${R.md}px` : i === ESTADOS.length - 1 ? `0 ${R.md}px ${R.md}px 0` : 0, marginLeft: i ? -1 : 0 }}>{l}</button>
                  ))}
                </div>
              </Campo>
            )}
            <Campo label={`En ${e.anoEst}`}>
              {nueva || f.estado === "cambia"
                ? <PlataPeriodo value={f.ahora} per={f.per} onPer={(p) => upd(f.id, { per: p })} onChange={(v) => upd(f.id, { ahora: v, estado: "cambia" })} />
                : <div style={{ ...inp, display: "flex", alignItems: "center", fontFamily: "ui-monospace, Menlo, monospace", color: f.estado === "no" ? C.subtle : C.text }}>{mm(ahoraDe(f))}</div>}
              {(() => { const d = ahoraDe(f) - (Number(f.antes) || 0); return (
                <span style={{ ...F.caption, fontWeight: 700, color: Math.abs(d) < 1 ? C.subtle : d > 0 ? C.accent : C.warn }}>
                  {Math.abs(d) < 1 ? "= sin cambio" : `${d > 0 ? "▲ +" : "▼ −"}${mm(Math.abs(d))}${nueva ? " nuevo" : ""}`}</span>); })()}
            </Campo>
            <div style={{ display: "flex", gap: 6, paddingTop: 37 }}>
              {!nueva && !f.grupo && !f.plantilla && Number(f.antes) > 0 && <button type="button" onClick={() => desglosar(f)} style={{ ...btnSeg(false, C.accent), borderRadius: R.md }}>Desglosar</button>}
              {(nueva || (f.grupo && f.grupo !== f.id)) && <button type="button" onClick={() => guardar(filas.filter((x) => x.id !== f.id))} style={{ ...btnSeg(false, C.danger), borderRadius: R.md, color: C.danger }}>Quitar</button>}
            </div>
          </div>
        );
      })}
      {Object.entries(grupos).map(([id, gr]) => Math.abs((gr.total || 0) - gr.suma) > 1000 && (
        <div key={id} style={{ marginTop: 8 }}><Aviso>Al desglosar «{gr.nombre}» repartiste {mm(gr.suma)} de {mm(gr.total)}: {gr.suma < gr.total ? `faltan ${mm(gr.total - gr.suma)}` : `sobran ${mm(gr.suma - gr.total)}`}.</Aviso></div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        <button type="button" onClick={() => guardar([...filas, { id: nuevaId(), nombre: "", tipo: e.nat ? "laboral" : "otro", antes: 0, estado: "cambia", ahora: 0 }])} style={{ height: 42, padding: "0 14px", borderRadius: R.md, border: "none", background: C.accent, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar ingreso nuevo</button>
        {disponibles.length > 0 && (
          <select style={{ ...sel_, width: "auto", minWidth: 260 }} value="" onChange={(ev) => { const it = disponibles.find((x) => x.id === ev.target.value); if (it) guardar([...filas, { id: nuevaId(), nombre: it.nombre, tipo: it.tipo, antes: 0, estado: "cambia", ahora: it.monto, desde: it.id }]); }}>
            <option value="">Traer de mis ingresos en FINPATHIA…</option>
            {disponibles.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {mm(x.monto)} al año</option>)}
          </select>
        )}
        {r.filas && r.filas.length > 0 && <button type="button" onClick={() => onChange({ filas: [] })} style={{ height: 42, padding: "0 14px", borderRadius: R.md, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Empezar de nuevo</button>}
      </div>
      <div style={{ ...card, marginTop: 14, background: Cα.accent08, borderColor: Cα.accent25, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={F.label}>Paso 3 · Resultado: tus ingresos con estos cambios</div>
          <div style={{ ...F.monoLg, marginTop: 4 }}>{mm(piso)} → {mm(e.ingresosEst)}</div>
          <div style={{ ...F.caption, marginTop: 2 }}>{e.ano} {Math.abs(piso - e.brutos) > e.brutos * 0.02 ? `según tu reparto (la declaración dice ${mm(e.brutos)})` : "declarado"} → {e.anoEst} estimado · {Math.abs(dv) < 0.005 ? "iguales" : `${dv > 0 ? "suben" : "bajan"} ${Math.round(Math.abs(dv) * 100)}%`}</div>
          <div style={{ display: "grid", gap: 2, marginTop: 8, ...F.body }}>
            {baja > 0 && <span><b style={{ color: C.warn }}>▼ −{mm(baja)}</b> lo que deja de llegar o baja: {bajan.join(", ")}</span>}
            {sube > 0 && <span><b style={{ color: C.accent }}>▲ +{mm(sube)}</b> lo que sube: {suben.join(", ")}</span>}
            {nuevo > 0 && <span><b style={{ color: C.accent }}>▲ +{mm(nuevo)}</b> ingresos nuevos: {nuevos.join(", ")}</span>}
          </div>
        </div>
        <label style={{ ...F.body, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer", color: C.text }}>
          <input type="checkbox" checked={g > 0} onChange={(ev) => onChange({ g: ev.target.checked ? 0.05 : 0, sigue: null })} style={{ width: 18, height: 18, accentColor: C.accent }} />
          Lo que «sigue igual» sube con la inflación (~5%)
        </label>
      </div>
      <button type="button" onClick={() => document.getElementById("tu-cuenta")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ marginTop: 10, height: 42, padding: "0 16px", borderRadius: R.md, border: "none", background: C.accent, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ver cuánto me toca pagar ↓</button>
    </div>
  );
}

// Monto con «al mes / al año»: se guarda siempre anual; si escribe mensual, se multiplica por 12.
function PlataPeriodo({ value, onChange, per = "año", onPer }) {
  const mes = per === "mes";
  const mostrado = value ? (mes ? Math.round(Number(value) / 12) : Number(value)) : 0;
  const b = (activo) => ({ height: 42, padding: "0 8px", border: `1px solid ${C.border}`, background: activo ? Cα.accent15 : C.raised, color: activo ? C.text : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" });
  return (
    <div style={{ display: "flex", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}><Plata value={mostrado} onChange={(v) => onChange(mes ? Number(v) * 12 : v)} /></div>
      <button type="button" onClick={() => onPer("mes")} style={{ ...b(mes), marginLeft: -1 }}>/mes</button>
      <button type="button" onClick={() => onPer("año")} style={{ ...b(!mes), marginLeft: -1, borderRadius: `0 ${R.md}px ${R.md}px 0` }}>/año</button>
    </div>
  );
}

// La cuenta, como la haría un contador: de los ingresos a lo que hay que pagar al declarar.
function Cuenta({ e, ahorro }) {
  const fila = (texto, v, { signo = "", fuerte = false, sub, color, linea } = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", padding: fuerte ? "10px 0" : "7px 0", borderTop: linea ? `1px solid ${C.borderStrong}` : "none" }}>
      <div>
        <div style={{ ...(fuerte ? F.h2 : F.body), color: fuerte ? C.text : C.muted }}>{texto}</div>
        {sub && <div style={F.caption}>{sub}</div>}
      </div>
      <div style={{ ...(fuerte ? F.monoLg : F.mono), color: color || (fuerte ? C.text : C.muted), whiteSpace: "nowrap" }}>{signo}{mm(Math.abs(v))}</div>
    </div>
  );
  const noPaga = Math.max(0, e.ingresosEst - e.base);
  const aFavor = e.saldo < 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <div style={{ background: C.raised, borderRadius: R.lg, padding: "6px 16px 10px" }}>
        <div style={{ ...F.label, padding: "8px 0 4px" }}>1 · Cuánto paga renta</div>
        {fila(`Tus ingresos de ${e.anoEst}`, e.ingresosEst)}
        {fila(e.nat ? "Lo que no paga renta: aportes, exentas, deducciones y costos" : "Costos y deducciones", noPaga, { signo: "− ", sub: `Proporción de tu declaración ${e.ano}` })}
        {fila("Lo que sí paga renta (base gravable)", e.base, { signo: "= ", fuerte: true, linea: true })}
        {fila(e.nat ? "Impuesto de renta según la tabla (Art. 241)" : "Impuesto de renta (35%)", e.renta, { sub: e.nat ? `Tu tarifa más alta es ${Math.round(e.marginal * 100)}%` : undefined })}
        {e.go > 0 && fila("Ganancia ocasional de la venta (15%)", e.go, { signo: "+ " })}
        {fila(`Impuesto total del año ${e.anoEst}`, e.total, { signo: "= ", fuerte: true, linea: true, sub: `Rango probable ${mm(e.rango[0])} – ${mm(e.rango[1])} · en ${e.ano} fue ${mm(e.impBase)}` })}
      </div>
      <div style={{ background: C.raised, borderRadius: R.lg, padding: "6px 16px 10px" }}>
        <div style={{ ...F.label, padding: "8px 0 4px" }}>2 · Cuánto pagas al declarar</div>
        {fila("Impuesto total", e.total)}
        {fila(e.nat ? "Lo que ya te retuvieron durante el año" : "Autorretenciones del año", e.ret, { signo: "− ", color: C.ok })}
        {fila(`Anticipo que ya pagaste para ${e.anoEst}`, e.antPagado, { signo: "− ", color: C.ok })}
        {fila(aFavor ? "Saldo a tu favor" : "Saldo del impuesto", e.saldo, { signo: "= ", fuerte: true, linea: true, color: aFavor ? C.ok : C.text })}
        {fila(`Anticipo del año ${e.anoEst + 1}`, e.anticipoSiguiente, { signo: "+ ", sub: `${Math.round(e.pctA * 100)}% que exige la DIAN por adelantado (Art. 807)` })}
        <div style={{ background: Cα.warn08, border: `1px solid ${Cα.warn25}`, borderRadius: R.md, padding: "10px 12px", marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ ...F.h2 }}>Te toca pagar al declarar</div>
          <div style={{ ...F.monoXl, color: C.warn }}>{mm(e.totalAlDeclarar)}</div>
        </div>
        {ahorro > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px 0", ...F.body }}>
            <span style={{ color: C.ok, fontWeight: 600 }}>Con las estrategias que marcaste (−{mm(ahorro)})</span>
            <span style={{ ...F.mono, color: C.ok }}>{mm(Math.max(0, e.totalAlDeclarar - ahorro))}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Patrimonio: lo que tenías y lo que debías al cierre del año pasado; ¿sigue igual o cambió?
function CambioPatrimonio({ e, r, onChange, owner, deudasApp = 0, bienesApp = 0 }) {
  const R = e.d.renglones;
  if (R.patrimonioBruto == null && R.deudas == null) return null;
  const pm = r.patrim || {};
  const lineas = [
    ["bienes", "Lo que tienes (bienes, inversiones, cuentas)", Number(R.patrimonioBruto) || 0, "Por ejemplo, compraste o vendiste un inmueble, o crecieron tus inversiones."],
    ["deudas", `Lo que debes tú (${owner?.name || "este titular"}): créditos, hipotecas, tarjetas`, Number(R.deudas) || 0, "Solo deudas a tu nombre; las de tus empresas van en la declaración de cada empresa."],
  ];
  const valor = (k, antes) => (pm[k]?.estado === "cambia" ? Number(pm[k].ahora) || 0 : antes);
  const liqA = (Number(R.patrimonioBruto) || 0) - (Number(R.deudas) || 0);
  const liqB = valor("bienes", Number(R.patrimonioBruto) || 0) - valor("deudas", Number(R.deudas) || 0);
  const d = liqB - liqA;
  const seg = (activo) => ({ flex: 1, height: 42, border: `1px solid ${activo ? C.accent : C.border}`, background: activo ? Cα.accent15 : "transparent", color: activo ? C.text : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" });
  return (
    <div style={{ ...card, background: C.surface, marginTop: 14 }}>
      <div style={F.label}>Tu patrimonio</div>
      <div style={{ ...F.h2, marginTop: 4 }}>Lo tuyo neto al cierre de {e.ano}: {mm(liqA)}. ¿Cambió en {e.anoEst}?</div>
      <p style={{ ...F.body, margin: "4px 0 4px" }}>Según tu declaración: <b style={{ color: C.text }}>tienes {mm(Number(R.patrimonioBruto) || 0)}</b> en bienes a tu nombre y <b style={{ color: C.text }}>debes {mm(Number(R.deudas) || 0)}</b>; lo tuyo neto (patrimonio líquido) es la diferencia: <b style={{ color: C.text }}>{mm(liqA)}</b>.</p>
      <p style={{ ...F.caption, margin: "0 0 10px" }}>Los bienes van a valor fiscal (avalúo o costo), no comercial. Cuenta para el impuesto al patrimonio y tu próxima declaración. Pon cómo crees que quedará al 31 de diciembre de {e.anoEst}.</p>
      {lineas.map(([k, nombre, antes, ej]) => {
        const est = pm[k]?.estado || "igual";
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(200px, calc((100% - 31px) / 4)), 1fr))", gap: 10, alignItems: "start", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <Campo label="Concepto" ayuda={ej}><div style={{ ...inp, height: "auto", minHeight: 42, padding: "8px 12px", display: "flex", alignItems: "center", color: C.text, lineHeight: 1.3 }}>{nombre}</div></Campo>
            <Campo label={`Al cierre de ${e.ano}`} ayuda={`Según tu declaración ${e.ano}. En FINPATHIA tienes a nombre de ${owner?.name || "este titular"}: ${mm(k === "deudas" ? deudasApp : bienesApp)}${k === "bienes" ? " a valor comercial (la declaración usa valor fiscal)" : ""}.`}><div style={{ ...inp, display: "flex", alignItems: "center", fontFamily: "ui-monospace, Menlo, monospace", color: C.text }}>{mm(antes)}</div></Campo>
            <Campo label={`En ${e.anoEst}`}>
              <div style={{ display: "flex" }}>
                <button type="button" onClick={() => onChange({ ...pm, [k]: { estado: "igual" } })} style={{ ...seg(est === "igual"), borderRadius: `${R.md}px 0 0 ${R.md}px` }}>Igual</button>
                <button type="button" onClick={() => onChange({ ...pm, [k]: { estado: "cambia", ahora: pm[k]?.ahora ?? antes } })} style={{ ...seg(est === "cambia"), borderRadius: `0 ${R.md}px ${R.md}px 0`, marginLeft: -1 }}>Cambia</button>
              </div>
            </Campo>
            <Campo label={`Al cierre de ${e.anoEst}`}>
              {est === "cambia" ? <Plata value={pm[k]?.ahora} onChange={(v) => onChange({ ...pm, [k]: { estado: "cambia", ahora: v } })} />
                : <div style={{ ...inp, display: "flex", alignItems: "center", fontFamily: "ui-monospace, Menlo, monospace", color: C.muted }}>{mm(antes)}</div>}
              {est === "cambia" && (() => { const dd = (Number(pm[k]?.ahora) || 0) - antes; return Math.abs(dd) > 1 ? <span style={{ ...F.caption, fontWeight: 700, color: (dd > 0) === (k === "deudas") ? C.warn : C.ok }}>{dd > 0 ? "▲ +" : "▼ −"}{mm(Math.abs(dd))}</span> : null; })()}
            </Campo>
          </div>
        );
      })}
      <div style={{ ...F.body, marginTop: 10, color: C.text }}>
        Lo tuyo neto (patrimonio líquido): <b style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{mm(liqA)} → {mm(liqB)}</b>
        {Math.abs(d) > 1 && <span style={{ color: d > 0 ? C.ok : C.warn, fontWeight: 700 }}> ({d > 0 ? "sube" : "baja"} {mm(Math.abs(d))})</span>}
      </div>
    </div>
  );
}

// «¿Qué ingresos tienes este año?» (29-oct-2026, Santiago: "no tiene sentido inventar los 418 MM
// que ya fueron declarados; que uno calcule cada cosa de este año"). Lo declarado queda fijo como
// referencia; el año en curso se arma ítem por ítem, empezando por lo registrado en FINPATHIA.
function Lista2026({ e, r, registrados, onChange }) {
  const lista = Array.isArray(r.lista2026) ? r.lista2026 : [];
  const guardar = (l) => onChange({ lista2026: l });
  const upd = (id, patch) => guardar(lista.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const nuevaId = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const usados = new Set(lista.map((x) => x.desde).filter(Boolean));
  const disponibles = registrados.filter((x) => !usados.has(x.desde));
  const o = origenIngresos(e.d);
  const total = lista.reduce((a, x) => a + (x.tipo === "noRenta" ? 0 : Number(x.monto) || 0), 0);
  const noRenta = lista.reduce((a, x) => a + (x.tipo === "noRenta" ? Number(x.monto) || 0 : 0), 0);
  const dv = e.brutos ? total / e.brutos - 1 : 0;
  const pesa = (id) => (e.aportesLista || []).find((x) => x.id === id)?.impuesto || 0;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, background: C.surface }}>
        <div style={F.label}>Tu referencia · {e.ano} (ya declarado)</div>
        <div style={{ ...F.h2, marginTop: 4 }}>En {e.ano} declaraste ingresos por {mm(e.brutos)}</div>
        {o.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {o.map((x) => <span key={x.id} style={{ ...F.caption, color: C.text, background: C.raised, borderRadius: R.pill, padding: "4px 10px" }}>{x.nombre.split(":")[0].split("(")[0].trim()}: <b>{mm(x.monto)}</b></span>)}
          </div>
        )}
        {o.length === 0 && <div style={{ ...F.body, marginTop: 6 }}>¿En qué estaban esos {mm(e.brutos)}? Tu PDF se leyó antes de que los separáramos por tipo. Vuelve a subirlo una vez en <b style={{ color: C.text }}>Impuestos → Historial</b> y aquí verás: salario tanto, honorarios tanto, arriendos tanto, dividendos tanto.</div>}
        <div style={{ ...F.caption, marginTop: 6 }}>Este número no se toca: es contra lo que comparamos tu {e.anoEst}.</div>
      </div>

      <div style={{ ...card, background: C.surface }}>
        <div style={F.label}>Tu {e.anoEst} · lo que estás recibiendo</div>
        <div style={{ ...F.h2, marginTop: 4 }}>¿Qué ingresos tienes en {e.anoEst}?</div>
        <p style={{ ...F.body, margin: "4px 0 6px" }}>{registrados.length ? "Los trajimos de tus ingresos en FINPATHIA. Revisa cada uno: ajusta el monto, quita lo que ya no recibes y agrega lo nuevo." : "Agrega cada ingreso que estás recibiendo este año: salario, honorarios, arriendos, utilidades…"} Puedes poner el monto al mes o al año.</p>
        {lista.map((x) => (
          <div key={x.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(170px, calc((100% - 41px) / 5)), 1fr))", gap: 10, alignItems: "start", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
            <Campo label="Ingreso"><input style={inp} value={x.nombre} placeholder="Ej. salario" onChange={(ev) => upd(x.id, { nombre: ev.target.value })} /></Campo>
            {e.nat ? <Campo label="¿Qué es esta plata?" ayuda="El nombre puede ser cualquiera; el tipo define el impuesto."><select style={sel_} value={x.tipo} onChange={(ev) => upd(x.id, { tipo: ev.target.value })}>{TIPOS_INGRESO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Campo> : <div />}
            <Campo label={`Monto en ${e.anoEst}`}>
              <PlataPeriodo value={x.monto} per={x.per} onPer={(p) => upd(x.id, { per: p })} onChange={(v) => upd(x.id, { monto: v })} />
              {x.tipo === "noRenta" ? <span style={{ ...F.caption, color: C.ok }}>no paga renta: no suma a tu impuesto</span>
                : pesa(x.id) > 0 && <span style={{ ...F.caption, color: C.muted }}>pesa ~{mm(pesa(x.id))} en tu impuesto</span>}
            </Campo>
            {(!e.nat || x.tipo === "arriendo") ? (
              <Campo label={x.tipo === "arriendo" ? "Gastos de este arriendo" : "Gastos de este ingreso"}
                ayuda={x.tipo === "arriendo" ? "Administración, predial, mantenimiento, seguro, intereses del crédito. Se restan antes del impuesto." : "Lo que te cuesta generarlo (con factura). Se resta antes del impuesto."}>
                <PlataPeriodo value={x.costos} per={x.perCostos || x.per} onPer={(p) => upd(x.id, { perCostos: p })} onChange={(v) => upd(x.id, { costos: v })} />
              </Campo>) : <div />}
            <div style={{ paddingTop: 37 }}><button type="button" onClick={() => guardar(lista.filter((y) => y.id !== x.id))} style={{ width: "100%", height: 42, borderRadius: R.md, border: `1px solid ${C.border}`, background: "transparent", color: C.danger, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Ya no lo recibo</button></div>
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          <button type="button" onClick={() => guardar([...lista, { id: nuevaId(), nombre: "", tipo: e.nat ? "laboral" : "otro", monto: 0, per: "mes" }])} style={{ height: 42, padding: "0 14px", borderRadius: R.md, border: "none", background: C.accent, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Agregar ingreso</button>
          {disponibles.length > 0 && (
            <select style={{ ...sel_, width: "auto", minWidth: 260 }} value="" onChange={(ev) => { const it = disponibles.find((y) => y.desde === ev.target.value); if (it) guardar([...lista, { ...it, id: nuevaId() }]); }}>
              <option value="">Traer de mis ingresos en FINPATHIA…</option>
              {disponibles.map((y) => <option key={y.desde} value={y.desde}>{y.nombre} · {mm(y.monto)} al año</option>)}
            </select>
          )}
          {registrados.length > 0 && <button type="button" onClick={() => guardar(registrados)} style={{ height: 42, padding: "0 14px", borderRadius: R.md, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Volver a mis ingresos registrados</button>}
        </div>
      </div>

      {lista.length > 0 && (
        <div style={{ ...card, background: Cα.accent08, borderColor: Cα.accent25, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={F.label}>Resultado</div>
            <div style={{ ...F.monoLg, marginTop: 4 }}>{e.ano}: {mm(e.brutos)} → {e.anoEst}: {mm(total)}</div>
            {noRenta > 0 && <div style={{ ...F.caption, marginTop: 2 }}>Además recibes {mm(noRenta)} que no es renta (préstamos, reembolsos): es plata que entra, pero no paga impuesto.</div>}
            <div style={{ ...F.body, marginTop: 4, color: Math.abs(dv) < 0.005 ? C.muted : dv > 0 ? C.accent : C.warn, fontWeight: 700 }}>
              {Math.abs(dv) < 0.005 ? "Tus ingresos están iguales" : `Tus ingresos ${dv > 0 ? "suben" : "bajan"} ${Math.round(Math.abs(dv) * 100)}% (${dv > 0 ? "+" : "−"}${mm(Math.abs(total - e.brutos))})`}
            </div>
          </div>
          <button type="button" onClick={() => document.getElementById("tu-cuenta")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ height: 42, padding: "0 16px", borderRadius: R.md, border: "none", background: C.accent, color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ver cuánto me toca pagar ↓</button>
        </div>
      )}
    </div>
  );
}

// 29-oct-2026 (Santiago: "¿dónde pone uno qué mes se paga?"). Aquí mismo, junto al número.
// Sale sola del NIT de la declaración (calendario DIAN); se cambia solo si no coincide.
const MESES_F = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function FechaPago({ owner, ano, valor, onCambiarMes, onNavigate }) {
  const jur = owner.type === "juridica";
  const auto = mesesDePago({ ...owner, mesDeclaracion: null });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", borderRadius: R.md, border: `1px solid ${C.border}` }}>
      <div style={{ ...F.body, color: C.text, flex: "1 1 260px" }}>
        📅 Pagas <b>{mm(valor)}</b> {jur ? <>en dos cuotas: <b>{auto.length > 1 || owner.mesDeclaracion ? mesesDePago(owner).map((p) => MESES_F[p.mes - 1].toLowerCase()).join(" y ") : "mayo y julio"} de {ano}</b>.</> : <><b>{textoFechaPago(owner)} de {ano}</b>, en un solo pago.</>}
        <div style={F.caption}>
          {auto[0]?.auto ? "La fecha sale de tu cédula, según el calendario de la DIAN. " : jur ? "Las sociedades pagan en dos cuotas: elige el mes de la primera. " : "Si no es ese mes, cámbialo aquí al lado. "}
          Así queda en tu{" "}
          <button type="button" onClick={() => onNavigate?.("simf")} style={{ ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Simulador {ano}</button>.
        </div>
      </div>
      {onCambiarMes && (
        <select value={Number(owner.mesDeclaracion) || 0} onChange={(ev) => onCambiarMes(owner.id, Number(ev.target.value) || null)} style={{ ...inp, width: "auto", minWidth: 190, cursor: "pointer" }}>
          <option value={0}>{auto[0]?.auto ? "Fecha automática" : `Automático (${MESES_F[auto[0].mes - 1].toLowerCase()})`}</option>
          {(jur ? [4, 5, 6] : [8, 9, 10]).map((k) => <option key={k} value={k}>{MESES_F[k - 1]}{jur ? ` y ${MESES_F[k + 1]}` : ""}</option>)}
        </select>
      )}
    </div>
  );
}
