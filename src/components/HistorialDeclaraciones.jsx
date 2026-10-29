import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import DeclaracionUpload from "./DeclaracionUpload";
import { C, F, R } from "../lib/designTokens";
import { analisisHistorial, declaracionesOrdenadas, ultimaDeclaracion, impuestoDeclarado, esF110, MAX_DECLARACIONES, mm, pct } from "../lib/rentaDesdeDeclaracion.js";
import { Panel, Bienvenida, SelectorTitular, Kpi, KpiGrid, Barras, Linea, Grafica, Aviso } from "./RentaUI";

/**
 * Impuestos → «Historial de declaraciones»: cómo le ha ido a cada titular con
 * la renta, año tras año. Las últimas 4 declaraciones: indicadores, alertas,
 * tendencias, hacia dónde va y el detalle renglón por renglón.
 *
 * 29-oct-2026 (Santiago): "uno debería poder ver el resumen e historial de las
 * declaraciones de cada contribuyente, con gráficos que muestren el
 * comportamiento y los principales cambios… donde se compara, se mide, se
 * revisa, se alerta… y hacia dónde va". Prototipo validado en el chat.
 */

const FILAS_210 = [["Ingresos brutos", "ingresosBrutos"], ["Ingresos no constitutivos", "ingresosNoConstitutivos"], ["Renta exenta 25%", "rentaExenta25"], ["Deducción intereses de vivienda", "deducIntereses"], ["Deducción medicina prepagada", "deducMedicina"], ["Deducción dependientes", "deducDependientes"], ["Pensión voluntaria y AFC", "pvAFC"], ["Impuesto", "impuestoCalculado"], ["Retenciones", "retefuente"], ["Anticipo año siguiente", "anticipoAnoSiguiente"], ["Saldo pagado", "saldoPagar"], ["Patrimonio bruto", "patrimonioBruto"], ["Deudas", "deudas"], ["Patrimonio líquido", "patrimonioLiquido"]];
const FILAS_110 = [["Ingresos brutos", "ingresosBrutos"], ["Costos y deducciones", "costosDeducciones"], ["Renta líquida gravable", "rentaLiquidaGravable"], ["Impuesto calculado", "impuestoCalculado"], ["Descuento ICA", "descICA"], ["Impuesto neto", "impuestoNeto"], ["Autorretenciones", "autorretencion"], ["Anticipo año siguiente", "anticipoAnoSiguiente"], ["Saldo pagado", "saldoPagar"], ["Patrimonio bruto", "patrimonioBruto"], ["Deudas", "deudas"], ["Patrimonio líquido", "patrimonioLiquido"]];
const MALOS = ["impuestoCalculado", "impuestoNeto", "saldoPagar", "deudas", "anticipoAnoSiguiente"];
const ICONO = { alerta: "⚠️", bien: "✅", info: "ℹ️" };
const SERIE = [C.accent, C.ok, C.warn, C.purple, C.danger];
const td = { padding: "8px 6px", borderBottom: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "nowrap" };
const th = { ...F.label, padding: "8px 6px", textAlign: "right" };

export default function HistorialDeclaraciones({ user, u, owners: ownersIn, onSaveDeclaracion, onNavigate, isPro, onUpsell }) {
  const owners = useMemo(() => (ownersIn || []).filter(Boolean), [ownersIn]);
  const conDecl = owners.find((o) => ultimaDeclaracion(o));
  const [sel, setSel] = useState((conDecl || owners[0])?.id || "");
  const [subir, setSubir] = useState(!conDecl);
  const owner = owners.find((o) => o.id === sel);
  const total = owners.reduce((a, o) => a + declaracionesOrdenadas(o).length, 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader label="Impuestos · historial" title="¿Cómo me ha ido con la renta, año tras año?" accent="año tras año" compact
        subtitle={`Las últimas ${MAX_DECLARACIONES} declaraciones de cada persona o empresa: qué pasó, cómo se compara cada año, qué alertas hay y hacia dónde va.`} />

      <Bienvenida
        titulo="Sube los PDF de tus declaraciones y entiende tu renta en un vistazo"
        potencial={[
          "Lee solo el PDF del formulario 210 (personas) o 110 (empresas): no tienes que digitar nada.",
          "Te muestra tasa efectiva, crecimiento, patrimonio y deudas de cada año, con gráficas.",
          "Te alerta cuando el impuesto crece más rápido que tus ingresos, cuando beneficios se pierden por el tope o cuando te acercas al impuesto al patrimonio.",
          "Con esa base, «Lo que viene» estima lo que pagarás este año.",
        ]}
        pasos={[
          { t: "Escoge la persona o empresa", hecho: !!owner || sel === "grupo" },
          { t: `Sube sus declaraciones (hasta ${MAX_DECLARACIONES} años)`, hecho: total > 0 },
          { t: "Revisa alertas y tendencias", hecho: total > 1 },
          { t: "Pasa a «Lo que viene» para estimar este año", hecho: false },
        ]}
        accion={total ? { label: "Ir a «Lo que viene»", onClick: () => onNavigate?.("tax") } : { label: "Subir una declaración", onClick: () => setSubir(true) }}
      />

      {owners.length > 0 && <Panel titulo="¿De quién quieres ver el historial?"><SelectorTitular owners={owners} value={sel} onChange={setSel} /></Panel>}

      <Panel titulo={subir ? "Subir una declaración" : undefined} style={subir ? undefined : { padding: 12 }}>
        {subir ? (<>
          <DeclaracionUpload user={user} owners={owners} isPro={isPro} onUpsell={onUpsell}
            onSaveToOwner={(ownerId, declaracion) => { onSaveDeclaracion(ownerId, declaracion); setSel(ownerId); setSubir(false); }} />
          {conDecl && <button type="button" onClick={() => setSubir(false)} style={{ ...F.h3, marginTop: 8, background: "none", border: "none", color: C.muted, cursor: "pointer" }}>Cerrar</button>}
        </>) : (
          <button type="button" onClick={() => setSubir(true)} style={{ ...F.h3, background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0 }}>+ Subir otra declaración (PDF)</button>
        )}
      </Panel>

      {sel === "grupo" ? <HistGrupo owners={owners} /> : owner && <HistTitular owner={owner} onNavigate={onNavigate} />}
    </div>
  );
}

function HistTitular({ owner, onNavigate }) {
  const a = analisisHistorial(owner);
  if (!a) return <Aviso><b>{owner.name} no tiene declaraciones cargadas.</b> Sube los PDF de los últimos años (formulario {owner.type === "juridica" ? "110" : "210"}) y aquí verás su historial.</Aviso>;
  const { serie: s, kpis: k, proy, hallazgos, nat } = a;
  const n = s.length, u = s.at(-1), anos = s.map((x) => x.ano), anosP = [...anos, proy.ano + "e"];
  const ds = declaracionesOrdenadas(owner).slice(-MAX_DECLARACIONES), dsRev = ds.slice().reverse();
  const filas = (esF110(ds.at(-1)) ? FILAS_110 : FILAS_210).filter(([, key]) => ds.some((d) => d.renglones[key] != null && Number(d.renglones[key]) !== 0));
  const prev = ds.at(-2);
  const flecha = (v) => (v == null ? "" : `${v >= 0 ? "▲" : "▼"} ${pct(Math.abs(v), 0)} vs año anterior`);

  return (<>
    <Panel titulo={`Historial de ${owner.name}`} sub={`${n} de ${MAX_DECLARACIONES} declaraciones · ${anos.join(", ")} · formulario ${nat ? "210" : "110"}`}>
      <KpiGrid>
        <Kpi k={`Impuesto ${u.ano}`} v={mm(k.impuesto)} d={flecha(k.impuestoVar)} color={k.impuestoVar > 0 ? C.danger : undefined} />
        <Kpi k="Tasa efectiva" v={pct(k.tasa)} d={`${k.tasaVarPts != null ? `${k.tasaVarPts >= 0 ? "▲" : "▼"} ${Math.abs(k.tasaVarPts).toLocaleString("es-CO", { maximumFractionDigits: 1 })} pts · ` : ""}de cada $100 que entran, $${Math.round(k.tasa * 100)} van a renta`} />
        <Kpi k="Crecimiento de ingresos" v={k.cagr != null ? pct(k.cagr) : "—"} d={k.cagr != null ? `promedio anual ${anos[0]}–${u.ano}` : "necesita 2 años o más"} />
        {k.patrimonio != null && <Kpi k="Patrimonio líquido" v={mm(k.patrimonio)} d={flecha(k.patrimonioVar)} />}
        {k.endeudamiento != null && <Kpi k="Endeudamiento" v={pct(k.endeudamiento, 0)} d="deudas sobre patrimonio bruto" />}
        {k.cubierto != null && <Kpi k="Impuesto cubierto con retenciones" v={pct(k.cubierto, 0)} d="el resto se pagó al declarar" />}
        {nat && k.tope > 0 && <Kpi k="Beneficios usados vs tope" v={pct(k.usado / k.tope, 0)} d={`${mm(k.usado)} de exentas y deducciones · tope ${mm(k.tope)}${k.usado > k.tope ? " · lo de más no restó" : ""}`} color={k.usado > k.tope ? C.danger : undefined} />}
        {!nat && k.margenFiscal != null && <Kpi k="Margen fiscal" v={pct(k.margenFiscal, 0)} d="renta gravable sobre ingresos" />}
      </KpiGrid>
    </Panel>

    {hallazgos.length > 0 && (
      <Panel titulo="Alertas y hallazgos">
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {hallazgos.map((h) => <li key={h.texto} style={{ ...F.body, color: C.text, background: C.raised, borderRadius: R.md, padding: "9px 12px" }}>{ICONO[h.nivel]} {h.texto}</li>)}
        </ul>
      </Panel>
    )}

    <Panel titulo="Tendencias">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Grafica titulo="Ingresos e impuesto" sub={`Cuánto entró y cuánto se fue en renta · ${proy.ano}e = si sigue la tendencia`}>
          <Barras anos={anosP} desde={n} series={[{ n: "Ingresos brutos", c: C.accent, v: [...s.map((x) => x.ing), proy.ing] }, { n: "Impuesto", c: C.danger, v: [...s.map((x) => x.imp), proy.imp] }]} />
        </Grafica>
        <Grafica titulo="Tasa efectiva" sub="De cada $100 que entran, cuántos van a renta">
          <Linea anos={anosP} desde={n} v={[...s.map((x) => x.tasa), proy.tasa]} fmt={(v) => pct(v)} />
        </Grafica>
        {s.some((x) => x.pat != null) && (
          <Grafica titulo="Patrimonio" sub="Patrimonio bruto = lo que es tuyo (líquido) + lo que debes">
            <Barras anos={anos} apilar series={[{ n: "Patrimonio líquido", c: C.ok, v: s.map((x) => x.pat || 0) }, { n: "Deudas", c: C.warn, v: s.map((x) => x.deudas || 0) }]} />
          </Grafica>
        )}
        <Grafica titulo="Cómo se pagó el impuesto" sub="Retenido durante el año frente a lo pagado al declarar">
          <Barras anos={anos} apilar series={[{ n: nat ? "Retenciones" : "Autorretenciones", c: C.accent, v: s.map((x) => x.ret) }, { n: "Saldo al declarar", c: C.danger, v: s.map((x) => Math.max(0, x.saldo)) }]} />
        </Grafica>
      </div>
    </Panel>

    <Panel titulo="Hacia dónde va" sub={`Si los ingresos siguen creciendo como en los últimos años (${pct(proy.g)} al año) y nada más cambia, en ${proy.ano}:`}>
      <KpiGrid>
        <Kpi k="Ingresos" v={mm(proy.ing)} d={`▲ ${pct((proy.ing - u.ing) / (u.ing || 1), 0)} vs ${u.ano}`} />
        <Kpi k="Impuesto de renta" v={mm(proy.imp)} d={`${proy.imp >= u.imp ? "▲" : "▼"} ${pct(Math.abs(proy.imp - u.imp) / (u.imp || 1), 0)} vs ${u.ano}`} color={proy.imp > u.imp ? C.danger : undefined} />
        <Kpi k="Tasa efectiva" v={pct(proy.tasa)} d={`de cada $100, $${Math.round(proy.tasa * 100)} a renta`} />
        {proy.pat != null && <Kpi k="Patrimonio líquido" v={mm(proy.pat)} d={`al ritmo de ${pct(proy.gPat)} anual`} />}
      </KpiGrid>
      <button type="button" onClick={() => onNavigate?.("tax")} style={{ ...F.h3, marginTop: 12, background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0 }}>Ajustar con lo que de verdad cambió este año en «Lo que viene» →</button>
    </Panel>

    <Panel titulo="Detalle renglón por renglón">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...F.body, color: C.text }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Renglón</th>{dsRev.map((d) => <th key={d.anoGravable} style={th}>{d.anoGravable}</th>)}{prev && <th style={th}>Cambio</th>}</tr></thead>
          <tbody>
            {filas.map(([l, key]) => {
              const a0 = Number(prev?.renglones[key]) || 0, b0 = Number(ds.at(-1).renglones[key]);
              const dv = prev && a0 && !Number.isNaN(b0) ? (b0 - a0) / a0 : null;
              const malo = dv != null && (dv > 0) === MALOS.includes(key);
              return (<tr key={key}><td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{l}</td>
                {dsRev.map((d) => <td key={d.anoGravable} style={td}>{d.renglones[key] != null && Number(d.renglones[key]) !== 0 ? mm(d.renglones[key]) : "—"}</td>)}
                {prev && <td style={{ ...td, color: dv == null ? C.subtle : malo ? C.danger : C.ok }}>{dv == null ? "—" : `${dv >= 0 ? "+" : "−"}${pct(Math.abs(dv), 0)}`}</td>}</tr>);
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  </>);
}

function HistGrupo({ owners }) {
  const con = owners.filter((o) => ultimaDeclaracion(o));
  if (!con.length) return <Aviso>Ningún titular tiene declaraciones cargadas todavía.</Aviso>;
  const anos = [...new Set(con.flatMap((o) => declaracionesOrdenadas(o).map((d) => Number(d.anoGravable))))].sort().slice(-MAX_DECLARACIONES);
  const val = (o, a, f) => { const d = declaracionesOrdenadas(o).find((x) => Number(x.anoGravable) === a); return d ? f(d) : 0; };
  const fI = impuestoDeclarado, fP = (d) => Number(d.renglones.patrimonioLiquido) || 0, fG = (d) => Number(d.renglones.ingresosBrutos) || 0;
  const tot = (f, a) => con.reduce((x, o) => x + val(o, a, f), 0);
  const ser = (f) => con.map((o, i) => ({ n: o.name, c: SERIE[i % SERIE.length], v: anos.map((a) => val(o, a, f)) }));
  const u = anos.at(-1), p = anos.at(-2);
  const sin = owners.filter((o) => !ultimaDeclaracion(o));
  const mayor = con.slice().sort((a, b) => val(b, u, fI) - val(a, u, fI))[0];
  const varTxt = (f) => (p && tot(f, p) ? `${tot(f, u) >= tot(f, p) ? "▲" : "▼"} ${pct(Math.abs(tot(f, u) - tot(f, p)) / tot(f, p), 0)} vs ${p}` : "");
  const tdl = { ...td, textAlign: "left", fontFamily: "inherit" };
  return (<>
    <Panel titulo="Historial del grupo familiar" sub={`Suma de ${con.length} titulares con declaración${sin.length ? ` · falta: ${sin.map((o) => o.name).join(", ")}` : ""}`}>
      <KpiGrid>
        <Kpi k={`Impuesto del grupo ${u}`} v={mm(tot(fI, u))} d={varTxt(fI)} />
        <Kpi k="Tasa efectiva del grupo" v={pct(tot(fI, u) / (tot(fG, u) || 1))} d="impuesto sobre ingresos de todos" />
        <Kpi k="Patrimonio líquido del grupo" v={mm(tot(fP, u))} d={varTxt(fP)} />
        <Kpi k="Quién paga más" v={mayor.name} d={`${pct(val(mayor, u, fI) / (tot(fI, u) || 1), 0)} del impuesto del grupo`} />
      </KpiGrid>
    </Panel>
    <Panel titulo="Tendencias">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Grafica titulo="Impuesto por titular" sub="Cuánto aporta cada uno al total del grupo"><Barras anos={anos} apilar series={ser(fI)} /></Grafica>
        <Grafica titulo="Patrimonio líquido por titular" sub="Lo que es de cada uno, sin deudas"><Barras anos={anos} apilar series={ser(fP)} /></Grafica>
      </div>
    </Panel>
    <Panel titulo={`Por titular, ${u}`}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...F.body, color: C.text }}>
          <thead><tr>{["Titular", "Ingresos", "Impuesto", "Tasa efectiva", "Patrimonio líquido"].map((h, i) => <th key={h} style={{ ...th, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
          <tbody>
            {con.map((o) => <tr key={o.id}><td style={tdl}>{o.name}<div style={F.caption}>{o.type === "juridica" ? "Sociedad" : "Persona natural"}</div></td><td style={td}>{mm(val(o, u, fG))}</td><td style={td}>{mm(val(o, u, fI))}</td><td style={td}>{val(o, u, fG) ? pct(val(o, u, fI) / val(o, u, fG)) : "—"}</td><td style={td}>{mm(val(o, u, fP))}</td></tr>)}
            <tr><td style={{ ...tdl, fontWeight: 700 }}>Grupo</td><td style={{ ...td, fontWeight: 700 }}>{mm(tot(fG, u))}</td><td style={{ ...td, fontWeight: 700 }}>{mm(tot(fI, u))}</td><td style={{ ...td, fontWeight: 700 }}>{pct(tot(fI, u) / (tot(fG, u) || 1))}</td><td style={{ ...td, fontWeight: 700 }}>{mm(tot(fP, u))}</td></tr>
          </tbody>
        </table>
      </div>
    </Panel>
  </>);
}
