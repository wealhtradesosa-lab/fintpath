import { useState } from "react";
import { fmtPctEs } from "../lib/metrics.js";
import { C, trama, tarjeta, titulo, subtitulo, cifra, CSS_INFOGRAFIA } from "./infografia/estilos.js";

/**
 * Ranking «¿Cuánto te rinde cada activo?» (31-oct-2026). Lee el resultado de
 * rentabilidadActivos(). Clic en un activo abre su edición para completar
 * renta o valorización.
 *
 * 1-nov-2026 — Rediseño con la paleta de infografías: barra azul (lo que
 * produce el activo) contra la línea rotulada de la inflación; por debajo de
 * la inflación, la barra se apaga; si pierde plata, naranja. Antes eran tres
 * colores de semáforo por fila.
 */
const TXT = { gana: "le gana a la inflación", bajo_inflacion: "por debajo de la inflación", pierde: "pierde plata" };
const barra = { gana: C.azul, bajo_inflacion: trama(C.azul, 38), pierde: C.neg };
const texto = { gana: C.txt, bajo_inflacion: C.txt2, pierde: C.neg };

export default function RentabilidadActivos({ r, fm, nombre, onAbrir }) {
  const [verTodos, setVerTodos] = useState(false);
  const [verSin, setVerSin] = useState(false);
  if (!r || r.conDato.length === 0) return null;
  const max = Math.max(r.inflacion * 1.6, ...r.conDato.map((f) => Math.abs(f.pct)), 1);
  const lista = verTodos ? r.conDato : r.conDato.slice(0, 8);
  const pos = (v) => Math.max(0, Math.min(100, (Math.abs(v) / max) * 100));

  const resumen = r.nPierden > 0
    ? `${r.nPierden} ${r.nPierden === 1 ? "activo pierde" : "activos pierden"} plata y ${r.nBajoInflacion} ${r.nBajoInflacion === 1 ? "rinde" : "rinden"} menos que la inflación.`
    : r.nBajoInflacion > 0
      ? `${r.nBajoInflacion} ${r.nBajoInflacion === 1 ? "activo rinde" : "activos rinden"} menos que la inflación.`
      : "Todos los activos con datos le ganan a la inflación.";
  const colorResumen = r.nPierden > 0 ? C.neg : r.nBajoInflacion > 0 ? C.txt2 : C.pos;

  return (
    <section aria-label="Cuánto te rinde cada activo" style={{ ...tarjeta, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{CSS_INFOGRAFIA + `
        .fpr-fila { display: grid; grid-template-columns: minmax(0, 36%) minmax(0, 1fr) 64px; gap: 14px; align-items: center; }
        @media (max-width: 640px) { .fpr-fila { grid-template-columns: minmax(0, 1fr) 60px; row-gap: 6px; } .fpr-fila > .fpr-nom { grid-column: 1 / -1; } }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={titulo}>¿Cuánto te rinde cada activo?</h3>
          <div style={subtitulo}>Al año: renta neta (lo que entra menos sus gastos) más valorización, sobre lo que vale hoy.</div>
        </div>
        {r.promedio != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.txt2 }}>Promedio ponderado</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: r.promedio >= r.inflacion ? C.txt : C.txt2, ...cifra }}>{fmtPctEs(r.promedio, 1)}</div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: colorResumen, fontWeight: 600 }}>{resumen}</div>

      <div style={{ position: "relative", display: "grid", gap: 4 }}>
        <div className="fpr-fila" aria-hidden="true" style={{ paddingBottom: 2 }}>
          <span className="fpr-nom" />
          <span style={{ position: "relative", height: 16 }}>
            <span style={{ position: "absolute", left: `calc(${pos(r.inflacion)}% - 60px)`, width: 120, textAlign: "center", fontSize: 11, color: C.txt2, whiteSpace: "nowrap" }}>Inflación {fmtPctEs(r.inflacion, 1)}</span>
          </span>
          <span />
        </div>
        {lista.map((f, i) => (
          <button key={f.id} type="button" className="fpr-fila" onClick={() => onAbrir && onAbrir(f.item)} title={`${TXT[f.estado]} · clic para editar`}
            style={{ background: "transparent", border: "none", padding: "8px 2px", cursor: "pointer", textAlign: "left", color: C.txt, borderTop: `1px solid ${C.linea}`, minHeight: 44 }}>
            <span className="fpr-nom" style={{ fontSize: 13, minWidth: 0, overflow: "hidden" }}>
              <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre(f.item)}</span>
              <span style={{ display: "block", fontSize: 12, color: C.txt3, ...cifra }}>{fm(f.va)}{f.rentaNeta !== 0 ? ` · renta neta ${fm(f.rentaNeta / 12)}/mes` : ""}</span>
            </span>
            <span style={{ position: "relative", height: 12, background: "rgba(var(--fp-ink),0.06)", borderRadius: 6 }}>
              <span className="fpi-barra-h" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pos(f.pct) + "%", background: barra[f.estado], borderRadius: 6, animationDelay: `${i * 35}ms` }} />
              <span style={{ position: "absolute", top: -6, bottom: -6, left: pos(r.inflacion) + "%", borderLeft: `2px dashed ${C.txt2}` }} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, textAlign: "right", color: texto[f.estado], ...cifra }}>{fmtPctEs(f.pct, 1)}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12.5 }}>
        {r.conDato.length > 8 && (
          <button type="button" onClick={() => setVerTodos(!verTodos)} style={{ background: "none", border: "none", padding: 0, minHeight: 32, color: C.txt, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontSize: 12.5 }}>
            {verTodos ? "Ver menos" : `Ver los ${r.conDato.length}`}
          </button>
        )}
        {r.sinDato.length > 0 && (
          <button type="button" onClick={() => setVerSin(!verSin)} style={{ background: "none", border: "none", padding: 0, minHeight: 32, color: C.txt2, cursor: "pointer", fontSize: 12.5, textAlign: "left" }}>
            {verSin ? "Ocultar" : "Ver"} {r.sinDato.length} {r.sinDato.length === 1 ? "activo" : "activos"} ({fm(r.valorSinDato)}) sin renta ni valorización cargadas: no sabemos cuánto rinden
          </button>
        )}
      </div>
      {verSin && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {r.sinDato.map((f) => (
            <button key={f.id} type="button" onClick={() => onAbrir && onAbrir(f.item)}
              style={{ background: "transparent", border: `1px solid rgba(var(--fp-ink),0.14)`, borderRadius: 999, padding: "6px 12px", minHeight: 32, color: C.txt2, fontSize: 12, cursor: "pointer" }}>
              {nombre(f.item)} · {fm(f.va)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
