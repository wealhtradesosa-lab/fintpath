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

export default function InformeContador({ u }) {
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
      <PageHeader label="Impuestos · contador" title="Informe para el contador" accent="contador" compact />
      <Bienvenida
        titulo="Todo lo que tu contador necesita, en un solo documento"
        potencial={[
          "Sale con lo que ya tienes en FINPATHIA: no tienes que llenar nada nuevo.",
          "Un capítulo por titular, persona natural o sociedad: declaraciones anteriores, estimado de este año, patrimonio, deudas, ingresos y gastos.",
          "De las personas solo van los gastos que cuentan para la renta; tu día a día queda privado. De las sociedades van todos sus costos y gastos.",
        ]}
        pasos={[{ t: "Elige los titulares" }, { t: "Envíalo o descárgalo" }]}
      />
      <Panel titulo="1. ¿De quiénes?" sub="Marca los titulares que quieres incluir.">
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
      <Panel titulo="2. Envíalo a tu contador" sub="En el celular se abre el menú para mandarlo por WhatsApp o correo. En el computador se descarga y lo adjuntas.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" disabled={!elegidos.length} onClick={() => generar(true)} style={btn(true)}>📤 Enviar a mi contador</button>
          <button type="button" disabled={!elegidos.length} onClick={() => generar(false)} style={btn(false)}>Descargar PDF</button>
        </div>
        {estado && <div style={{ ...F.caption, marginTop: 8, color: C.ok }}>{estado}</div>}
        <div style={{ ...F.caption, marginTop: 10, padding: "8px 10px", borderRadius: R.md, background: Cα.warn08, border: `1px solid ${Cα.warn25}` }}>
          Las cifras son las que registraste y los estimados son de referencia. Tu contador las valida con los certificados oficiales.
        </div>
      </Panel>
    </div>
  );
}
