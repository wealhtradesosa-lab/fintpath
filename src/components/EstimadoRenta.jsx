import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { totalAnualItem } from "../lib/flowHelpers.js";
import {
  RESPUESTAS_DEFAULT, ultimaDeclaracion, estimarDesdeDeclaracion, oportunidades, ahorroMarcado, patrimonioInfo,
  impuestoDividendos, calculosGODelTitular, revisarTitular, pct, mm, impuestoDeclarado, retencionDeclarada,
} from "../lib/rentaDesdeDeclaracion.js";
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

const CAMBIOS_ING = [[-0.3, "Bajaron ~30%"], [-0.15, "Bajaron ~15%"], [0, "Iguales"], [0.05, "Subieron ~5% (inflación)"], [0.15, "Subieron ~15%"], [0.3, "Subieron ~30%"]];
const DEPS = [[-1, "Uno menos"], [0, "Iguales"], [1, "Uno más"], [2, "Dos más"]];
const sel_ = { ...inp, cursor: "pointer" };
const fila = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` };

function ingresosAnualesPorOwner(u) {
  const m = {};
  for (const i of u?.ingresos || u?.ing || []) if (i?.owner) m[i.owner] = (m[i.owner] || 0) + (Number(totalAnualItem(i)) || 0);
  return m;
}

export default function EstimadoRenta({ u, onGuardar, onNavigate }) {
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
  const pat = owner ? patrimonioInfo(owner, r?.casa) : null;
  const tit = e ? revisarTitular(ingApp[owner.id], e) : null;

  const cambioHecho = r && (r.g !== RESPUESTAS_DEFAULT.g || r.nuevo || r.perdido || r.aportes || r.dep || r.goSel || estado[owner?.id]);
  const marcoAlgo = r && Object.values(r.estr || {}).some((x) => x?.on);

  const cambiosTexto = () => {
    const c = [];
    if (r.g) c.push(`Ingresos de siempre: ${r.g > 0 ? "suben" : "bajan"} ~${Math.round(Math.abs(r.g) * 100)}%`);
    if (r.nuevo) c.push(`Ingreso nuevo: ${mm(r.nuevo)}${r.nuevoGastos ? `, con costos de ${mm(r.nuevoGastos)}` : ""}`);
    if (r.perdido) c.push(`Ingreso que deja de recibir: ${mm(r.perdido)}`);
    if (r.aportes) c.push(`Aportes voluntarios a pensión o AFC: ${mm(r.aportes)}`);
    if (r.dep) c.push(`Dependientes: ${r.dep > 0 ? "+" : ""}${r.dep}`);
    if (e.go) c.push(e.gc ? `Venta: ${e.gc.nombre} (precio ${mm(e.gc.resumen?.venta)}, ganancia ocasional optimizada ${mm(e.go)})` : `Venta de activo: ganancia ocasional ${mm(e.go)}`);
    return c;
  };
  const descargarPDF = async () => {
    const { exportResumenContadorPDF } = await import("../lib/pdfSectionExport.js");
    const estrategias = ops.filter((op) => !op.info && r.estr?.[op.id]?.on).map((op) => ({ titulo: op.titulo, norma: op.norma, ahorro: op.ahorro(r.estr[op.id].v), valor: op.entero ? String(r.estr[op.id].v) : mm(r.estr[op.id].v) }));
    const preguntas = ["¿Las retenciones estimadas coinciden con los certificados del año?", "¿Aplican las estrategias marcadas y con qué soportes?"];
    if (pat && !pat.sociedad && (pat.aplica || pat.cerca)) preguntas.push("Impuesto al patrimonio: valor patrimonial de los activos y exclusión de la casa de habitación.");
    if (e.anticipoSiguiente > 0) preguntas.push("¿Conviene pedir reducción del anticipo (Art. 809)?");
    await exportResumenContadorPDF({ titular: owner.name, e, cambios: cambiosTexto(), estrategias, patrimonio: pat, preguntas });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader label="Impuestos · lo que viene" title="¿Cuánto me va a tocar pagar de renta?" accent="renta" compact
        subtitle="Partimos de la última declaración que hizo tu contador y solo te preguntamos qué cambió. Así el cálculo conserva todo lo que él ya aplicó." />

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
        accion={owner && !e ? { label: "Subir la declaración", onClick: () => onNavigate?.("prevtax") } : null}
      />

      {!owners.length ? (
        <Aviso tipo="info">Primero crea los titulares (tú, tu pareja, tus empresas) en Configuración. Después sube la última declaración de cada uno.</Aviso>
      ) : (
        <Panel titulo="1. ¿A quién le calculamos?"><SelectorTitular owners={owners} value={sel} onChange={setSel} /></Panel>
      )}

      {sel === "grupo" && <Grupo owners={owners} respDe={respDe} calculosGO={calculosGO} />}

      {owner && !e && sel !== "grupo" && (
        <Aviso><b>{owner.name} no tiene declaración cargada.</b> Súbela en «Historial de declaraciones» (el PDF del formulario {owner.type === "juridica" ? "110" : "210"}) y la leemos sola.</Aviso>
      )}

      {e && sel !== "grupo" && (<>
        <Panel titulo="2. Su ficha: lo que declaró el año pasado" sub={`${e.d.tipo === "F110" ? "Formulario 110" : "Formulario 210"} · año gravable ${e.ano} · traída del historial`}>
          <KpiGrid>
            <Kpi k="Ingresos brutos" v={mm(e.d.renglones.ingresosBrutos)} />
            <Kpi k="Impuesto de renta" v={mm(impuestoDeclarado(e.d))} />
            <Kpi k="Tasa efectiva" v={pct(impuestoDeclarado(e.d) / (Number(e.d.renglones.ingresosBrutos) || 1))} />
            <Kpi k={e.nat ? "Retenciones" : "Autorretenciones"} v={mm(retencionDeclarada(e.d))} />
            {e.d.renglones.saldoPagar != null && <Kpi k="Saldo que pagó" v={mm(e.d.renglones.saldoPagar)} />}
            {e.d.renglones.patrimonioLiquido != null && <Kpi k="Patrimonio líquido" v={mm(e.d.renglones.patrimonioLiquido)} />}
          </KpiGrid>
          <button type="button" onClick={() => onNavigate?.("prevtax")} style={{ ...F.h3, marginTop: 10, background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0 }}>Ver su historial completo →</button>
          {tit && (
            <div style={{ marginTop: 10 }}>
              {tit.alerta
                ? <Aviso><b>Revisa a nombre de quién están los ingresos.</b> En FINPATHIA hay {mm(tit.ingresosApp)} al año a nombre de {owner.name}, bastante más de lo que declaró ({mm(tit.declarado)}). Si alguno es de una sociedad, cámbiale el titular en Ingresos: tributa allá, no aquí.</Aviso>
                : <Aviso tipo="ok"><b>Titular al día:</b> lo registrado a nombre de {owner.name} ({mm(tit.ingresosApp)} al año) es coherente con lo declarado.</Aviso>}
            </div>
          )}
        </Panel>

        <Panel titulo="3. ¿Qué cambió este año?" sub="Si algo no cambió, déjalo como está.">
          <Grid>
            <Campo label="Ingresos de siempre">
              <select style={sel_} value={r.g} onChange={(ev) => set(owner.id, { g: Number(ev.target.value) })}>{CAMBIOS_ING.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Campo>
            <Campo label="Ingreso nuevo este año (anual)" ayuda="Un arriendo, un contrato, un negocio…"><Plata value={r.nuevo} onChange={(v) => set(owner.id, { nuevo: v })} /></Campo>
            <Campo label="Costos de ese ingreso nuevo"><Plata value={r.nuevoGastos} onChange={(v) => set(owner.id, { nuevoGastos: v })} /></Campo>
            <Campo label="Ingreso que deja de recibir (anual)"><Plata value={r.perdido} onChange={(v) => set(owner.id, { perdido: v })} /></Campo>
            {e.nat && <Campo label="Aportes voluntarios a pensión o AFC" ayuda="Lo que va a aportar de más frente al año pasado"><Plata value={r.aportes} onChange={(v) => set(owner.id, { aportes: v })} /></Campo>}
            {e.nat && <Campo label="Dependientes frente al año pasado">
              <select style={sel_} value={r.dep} onChange={(ev) => set(owner.id, { dep: Number(ev.target.value) })}>{DEPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Campo>}
            <Campo label="¿Vende un inmueble o activo este año?" ayuda="Si lo optimizaste en el solucionador, escógelo y traemos el impuesto ya optimizado">
              <select style={sel_} value={r.goSel} onChange={(ev) => set(owner.id, { goSel: ev.target.value })}>
                <option value="">No vende nada este año</option>
                {gos.map((c) => <option key={c.id} value={c.id}>{c.nombre} · impuesto {mm(c.resumen?.final)}</option>)}
                <option value="manual">Otra venta: escribir el impuesto</option>
              </select>
              {r.goSel === "manual" && <Plata value={r.go} onChange={(v) => set(owner.id, { go: v })} placeholder="Impuesto de ganancia ocasional" />}
            </Campo>
            <Campo label={`Anticipo que pagó para ${e.anoEst}`} ayuda={e.antLeido ? "Leído de su declaración" : r.ant == null ? "Lo calculamos con su declaración (Art. 807). Corrígelo con el renglón real si es distinto." : "Valor que escribiste"}>
              <Plata value={e.antPagado} onChange={(v) => set(owner.id, { ant: v })} />
            </Campo>
          </Grid>
        </Panel>

        <Panel titulo={`4. Su estimado ${e.anoEst}`}>
          <KpiGrid>
            <Kpi k="Impuesto estimado" v={mm(e.total)} d={`Rango probable: ${mm(e.rango[0])} – ${mm(e.rango[1])}`} />
            <Kpi k={`Frente a ${e.ano}`} v={(e.total - e.impBase >= 0 ? "+" : "") + mm(e.total - e.impBase)} d={`${e.ano}: ${mm(e.impBase)}`} color={e.total > e.impBase ? C.danger : C.ok} />
            <Kpi k="Saldo del impuesto" v={e.saldo >= 0 ? mm(e.saldo) : "A favor " + mm(-e.saldo)} d={`Impuesto − ${e.nat ? "retenciones" : "autorretenciones"} (~${mm(e.ret)}) − anticipo ya pagado (${mm(e.antPagado)})`} />
            <Kpi k="Total a pagar al declarar" v={mm(e.totalAlDeclarar)} d={`Saldo + anticipo de ${e.anoEst + 1} (~${mm(e.anticipoSiguiente)}, ${Math.round(e.pctA * 100)}% del Art. 807). Es la plata que debes tener lista.`} color={C.warn} />
          </KpiGrid>
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
          <button type="button" onClick={descargarPDF} style={{ marginTop: 14, padding: "9px 14px", borderRadius: R.md, border: `1px solid ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📄 Resumen para el contador (PDF)</button>
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

        <Panel titulo="6. Antes del 31 de diciembre">
          <ul style={{ ...F.body, margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {e.totalAlDeclarar > 0 && <li><Calendario e={e} /></li>}
            <li><b style={{ color: C.text }}>Ejecuta las estrategias que marcaste:</b> cuentan solo si quedan hechas y soportadas dentro de este año.</li>
            <li><b style={{ color: C.text }}>Lleva esto a tu contador:</b> ingresos nuevos, ventas, certificados de retención y el resumen en PDF. Él hace la declaración real.</li>
          </ul>
        </Panel>
      </>)}

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
        <Kpi k={`Al 1-ene-${pat.anoB}, si sigue la tendencia`} v={mm(pat.patB)} d={`crece ${pct(pat.crec)} al año`} />
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
