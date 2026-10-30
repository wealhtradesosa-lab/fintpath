import { useMemo, useState } from "react";
import PageHeader from "./PageHeader";
import { C, Cα, F, R } from "../lib/designTokens";
import { Panel, Bienvenida } from "./RentaUI";
import { datosParaContador } from "../lib/datosParaContador.js";
import {
  declaracionesOrdenadas, impuestoDeclarado, retencionDeclarada, saldoDeclarado, estimarDesdeDeclaracion,
  calculosGODelTitular, lista2026DesdeIngresos, mm,
} from "../lib/rentaDesdeDeclaracion.js";
import { nitDe } from "../lib/impuestoReferente";

/**
 * Impuestos › Informe para el contador (30-oct-2026, Santiago: "en impuestos, una
 * sección de informes para el contador donde sale todo completo: patrimonio, ingresos,
 * gastos, deudas, por persona natural y jurídica, e historial de declaraciones").
 * No pide nada nuevo: arma el informe con lo que ya está en FINPATHIA.
 */
const sum = (l, k) => l.reduce((a, x) => a + (Number(x[k]) || 0), 0);

function armarTitular(u, o) {
  const resp = { ...(u?.estimadoRenta?.[o.id] || {}) };
  if (resp.lista2026 == null) { const l = lista2026DesdeIngresos(u, o.id); if (l.length) resp.lista2026 = l; }
  let e = null;
  try { e = estimarDesdeDeclaracion(o, resp, { calculosGO: calculosGODelTitular(u?.calculosGO, o) }); } catch { e = null; }
  const declaraciones = declaracionesOrdenadas(o).slice().reverse().map((d) => ({
    ano: Number(d.anoGravable), form: d.tipo, ingresos: Number(d.renglones?.ingresosBrutos) || 0,
    impuesto: impuestoDeclarado(d), retenciones: retencionDeclarada(d), saldo: saldoDeclarado(d).valor,
    patrimonio: d.renglones?.patrimonioLiquido != null ? Number(d.renglones.patrimonioLiquido) : null,
  }));
  return {
    id: o.id, nombre: o.name || "Sin nombre", tipo: o.type === "juridica" ? "juridica" : "natural", nit: nitDe(o),
    declaraciones, e, datos: datosParaContador(u, o.id),
    cambios: e ? e.pasos.map((p) => `${p.texto}: ${p.delta >= 0 ? "+" : "−"}${mm(Math.abs(p.delta))}`) : [],
  };
}

export default function InformeContador({ u, modoContador = false, cliente = "", onNavigate }) {
  const owners = useMemo(() => (u?.owners || []).filter(Boolean), [u?.owners]);
  const titulares = useMemo(() => owners.map((o) => armarTitular(u, o)), [u, owners]);
  const [sel, setSel] = useState(() => Object.fromEntries(owners.map((o) => [o.id, true])));
  const [estado, setEstado] = useState("");
  const elegidos = titulares.filter((t) => sel[t.id] !== false);

  const generar = async (compartir) => {
    if (!elegidos.length) return;
    setEstado("Armando el informe…");
    const { exportInformeContadorPDF } = await import("../lib/pdfSectionExport.js");
    const res = await exportInformeContadorPDF({ titulares: elegidos, compartir });
    setEstado(res === "compartido" ? "Listo, enviado." : res === "descargado" ? (compartir ? "Se descargó el PDF: adjúntalo en tu correo o WhatsApp para tu contador." : "Se descargó el PDF.") : "");
  };

  const grupos = [["Personas naturales", titulares.filter((t) => t.tipo === "natural")], ["Sociedades", titulares.filter((t) => t.tipo === "juridica")]].filter(([, g]) => g.length);
  const btn = (fuerte) => ({ padding: "10px 16px", borderRadius: R.md, border: fuerte ? "none" : `1px solid ${C.border}`, background: fuerte ? C.accent : "transparent", color: fuerte ? C.text : C.muted, fontWeight: 700, fontSize: 13, cursor: elegidos.length ? "pointer" : "default", opacity: elegidos.length ? 1 : 0.5 });

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {modoContador
        ? <PageHeader label="Cliente que te compartió" title={`Información de ${cliente || "tu cliente"}`} compact />
        : <PageHeader label="Impuestos · contador" title="Informe para el contador" accent="contador" compact />}
      {!modoContador && <Bienvenida
        titulo="Todo lo que tu contador necesita, en un solo documento"
        potencial={[
          "Sale con lo que ya tienes en FINPATHIA: no tienes que llenar nada nuevo.",
          "Un capítulo por titular, persona natural o sociedad: declaraciones anteriores, estimado de este año, patrimonio, deudas, ingresos y gastos.",
          "De las personas solo van los gastos que cuentan para la renta; tu día a día queda privado. De las sociedades van todos sus costos y gastos.",
        ]}
        pasos={[{ t: "Elige los titulares" }, { t: "Envíalo o descárgalo" }]}
      />}
      {modoContador && <div style={{ ...F.caption, padding: "10px 12px", borderRadius: R.md, background: Cα.accent08, border: `1px solid ${Cα.accent25}` }}>
        Ves lo que tu cliente registró en FINPATHIA, en solo lectura: declaraciones, ingresos, patrimonio, deudas y los gastos que cuentan para la renta. Las cifras las cargó el cliente y los estimados son de referencia.
      </div>}
      <Panel titulo={modoContador ? "Titulares" : "1. ¿De quiénes?"} sub={modoContador ? "Marca los que quieres ver y descargar." : "Marca los titulares que quieres incluir."}>
        {grupos.map(([l, g]) => (
          <div key={l} style={{ marginTop: 8 }}>
            <div style={{ ...F.label, marginBottom: 4 }}>{l}</div>
            {g.map((t) => (
              <label key={t.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "10px 4px", borderTop: `1px solid ${C.border}`, cursor: "pointer" }}>
                <input type="checkbox" checked={sel[t.id] !== false} onChange={(ev) => setSel({ ...sel, [t.id]: ev.target.checked })} style={{ width: 18, height: 18 }} />
                <span style={{ ...F.h3, flex: "1 1 160px" }}>{t.nombre}</span>
                <span style={{ ...F.caption, flex: "2 1 320px" }}>
                  {t.declaraciones.length ? `Declaraciones ${t.declaraciones.map((d) => d.ano).join(", ")}` : "Sin declaraciones"}
                  {" · "}bienes {mm(sum(t.datos.bienes, "valor"))} · deudas {mm(sum(t.datos.deudas, "saldo"))} · ingresos {mm(sum(t.datos.ingresos, "anual"))}/año
                  {t.e ? ` · estimado al declarar ${mm(t.e.totalAlDeclarar)}` : ""}
                </span>
              </label>
            ))}
          </div>
        ))}
      </Panel>
      <Detalle titulares={elegidos} />
      {modoContador ? (
        <Panel titulo="Descargar el informe" sub="Un PDF con un capítulo por titular.">
          <button type="button" disabled={!elegidos.length} onClick={() => generar(false)} style={btn(true)}>Descargar PDF</button>
          {estado && <div style={{ ...F.caption, marginTop: 8, color: C.ok }}>{estado}</div>}
        </Panel>
      ) : (
      <Panel titulo="2. Envíalo a tu contador" sub="En el celular se abre el menú para mandarlo por WhatsApp o correo. En el computador se descarga y lo adjuntas.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" disabled={!elegidos.length} onClick={() => generar(true)} style={btn(true)}>📤 Enviar a mi contador</button>
          <button type="button" disabled={!elegidos.length} onClick={() => generar(false)} style={btn(false)}>Descargar PDF</button>
        </div>
        {estado && <div style={{ ...F.caption, marginTop: 8, color: C.ok }}>{estado}</div>}
        <div style={{ ...F.caption, marginTop: 10 }}>
          ¿Prefieres que tu contador lo vea en vivo, siempre actualizado?{" "}
          <button type="button" onClick={() => onNavigate?.("cuenta")} style={{ ...F.caption, fontWeight: 700, color: C.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>Invítalo en Mi cuenta › Personas con acceso</button>: solo verá esto, sin poder cambiar nada.
        </div>
        <div style={{ ...F.caption, marginTop: 10, padding: "8px 10px", borderRadius: R.md, background: Cα.warn08, border: `1px solid ${Cα.warn25}` }}>
          Las cifras son las que registraste y los estimados son de referencia. Tu contador las valida con los certificados oficiales.
        </div>
      </Panel>
      )}
    </div>
  );
}

// Detalle en pantalla, un desplegable por titular (lo mismo que trae el PDF).
function Detalle({ titulares }) {
  if (!titulares.length) return null;
  const th = { ...F.label, textAlign: "left", padding: "6px 8px" };
  const td = { ...F.body, padding: "6px 8px", borderTop: `1px solid ${C.border}` };
  const tdN = { ...td, ...F.mono, textAlign: "right", whiteSpace: "nowrap" };
  const tabla = (titulo, cols, filas, total) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...F.h3, marginBottom: 4 }}>{titulo}</div>
      {filas.length === 0 ? <div style={F.caption}>Nada registrado.</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{cols.map((c, i) => <th key={c} style={{ ...th, textAlign: i === cols.length - 1 ? "right" : "left" }}>{c}</th>)}</tr></thead>
            <tbody>
              {filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} style={j === f.length - 1 ? tdN : td}>{v}</td>)}</tr>)}
              {total != null && <tr><td style={{ ...td, fontWeight: 700 }} colSpan={cols.length - 1}>Total</td><td style={{ ...tdN, fontWeight: 700 }}>{mm(total)}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  return (
    <Panel titulo="Detalle" sub="Ábrelo por titular. Es lo mismo que trae el PDF.">
      {titulares.map((t) => (
        <details key={t.id} style={{ borderTop: `1px solid ${C.border}`, padding: "8px 0" }}>
          <summary style={{ ...F.h3, cursor: "pointer" }}>{t.nombre} <span style={F.caption}>· {t.tipo === "juridica" ? "Sociedad" : "Persona natural"}{t.nit ? ` · ${t.nit}` : ""}</span></summary>
          {tabla("Declaraciones", ["Año", "Ingresos", "Impuesto", "Retenciones", "Saldo"],
            t.declaraciones.map((d) => [d.ano, mm(d.ingresos), mm(d.impuesto), mm(d.retenciones), d.saldo < 0 ? `${mm(-d.saldo)} a favor` : mm(d.saldo)]))}
          {t.e && tabla(`Estimado renta ${t.e.anoEst}`, ["Concepto", "Valor"], [
            ["Impuesto estimado", mm(t.e.total)], ["Retenciones estimadas", mm(t.e.ret)], [`Anticipo ${t.e.anoEst + 1}`, mm(t.e.anticipoSiguiente)], ["Total a pagar al declarar", mm(t.e.totalAlDeclarar)]])}
          {tabla("Patrimonio (bienes)", ["Bien", "Tipo", "Valor"], t.datos.bienes.map((x) => [x.nombre, x.tipo, mm(x.valor)]), sum(t.datos.bienes, "valor"))}
          {tabla("Deudas", ["Deuda", "Tipo", "Saldo"], t.datos.deudas.map((x) => [x.nombre, x.tipo, mm(x.saldo)]), sum(t.datos.deudas, "saldo"))}
          {tabla("Ingresos", ["Ingreso", "Tipo", "Al año"], t.datos.ingresos.map((x) => [x.nombre, x.tipo, mm(x.anual)]), sum(t.datos.ingresos, "anual"))}
          {tabla(t.tipo === "juridica" ? "Costos y gastos" : "Gastos que cuentan para la renta", ["Gasto", "Categoría", "Al año"], t.datos.gastos.map((x) => [x.nombre, x.cat, mm(x.anual)]), sum(t.datos.gastos, "anual"))}
        </details>
      ))}
    </Panel>
  );
}
