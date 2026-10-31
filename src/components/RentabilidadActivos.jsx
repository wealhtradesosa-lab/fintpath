import { useState } from "react";
import { fmtPctEs } from "../lib/metrics.js";

/**
 * Ranking «¿Cuánto te rinde cada activo?» (31-oct-2026). Lee el resultado de
 * rentabilidadActivos(). Barra por activo contra la línea de la inflación;
 * clic en un activo abre su edición para completar renta o valorización.
 */
const COL = { gana: "#00c805", bajo_inflacion: "#f59e0b", pierde: "#ff5000" };
const TXT = { gana: "le gana a la inflación", bajo_inflacion: "por debajo de la inflación", pierde: "pierde plata" };

export default function RentabilidadActivos({ r, T, fm, nombre, onAbrir }) {
  const [verTodos, setVerTodos] = useState(false);
  const [verSin, setVerSin] = useState(false);
  if (!r || r.conDato.length === 0) return null;
  const max = Math.max(r.inflacion * 1.5, ...r.conDato.map((f) => Math.abs(f.pct)), 1);
  const lista = verTodos ? r.conDato : r.conDato.slice(0, 8);
  const movil = typeof window !== "undefined" && window.innerWidth < 640;
  const pos = (v) => Math.max(0, Math.min(100, (Math.abs(v) / max) * 100));

  const resumen = r.nPierden > 0
    ? `${r.nPierden} ${r.nPierden === 1 ? "activo pierde" : "activos pierden"} plata y ${r.nBajoInflacion} ${r.nBajoInflacion === 1 ? "rinde" : "rinden"} menos que la inflación.`
    : r.nBajoInflacion > 0
      ? `${r.nBajoInflacion} ${r.nBajoInflacion === 1 ? "activo rinde" : "activos rinden"} menos que la inflación.`
      : "Todos los activos con datos le ganan a la inflación.";

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 16px 12px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.txt }}>¿Cuánto te rinde cada activo?</div>
          <div style={{ fontSize: 12, color: T.txt3, marginTop: 2, lineHeight: 1.4 }}>
            Al año: renta neta (lo que entra menos sus gastos) más valorización, sobre lo que vale hoy. La línea es la inflación ({fmtPctEs(r.inflacion, 1)}).
          </div>
        </div>
        {r.promedio != null && (
          <div style={{ fontSize: 13, color: T.txt2 }}>Promedio: <b style={{ color: r.promedio >= r.inflacion ? COL.gana : COL.bajo_inflacion }}>{fmtPctEs(r.promedio, 1)}</b></div>
        )}
      </div>
      <div style={{ fontSize: 13, color: r.nPierden > 0 ? COL.pierde : r.nBajoInflacion > 0 ? COL.bajo_inflacion : COL.gana, fontWeight: 600, margin: "10px 0 8px" }}>{resumen}</div>

      <div style={{ display: "grid", gap: 2 }}>
        {lista.map((f) => (
          <button key={f.id} type="button" onClick={() => onAbrir && onAbrir(f.item)} title={`${TXT[f.estado]} · clic para editar`}
            style={{ display: "grid", gridTemplateColumns: movil ? "minmax(0, 1fr) 56px" : "minmax(0, 38%) minmax(0, 1fr) 62px", gap: movil ? "4px 10px" : 10, alignItems: "center", background: "transparent", border: "none", padding: "6px 2px", cursor: "pointer", textAlign: "left", color: T.txt }}>
            <span style={{ fontSize: 13, gridColumn: movil ? "1 / -1" : undefined, whiteSpace: movil ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nombre(f.item)}
              <span style={{ display: "block", fontSize: 12, color: T.txt3 }}>{fm(f.va)}{f.rentaNeta !== 0 ? ` · renta neta ${fm(f.rentaNeta / 12)}/mes` : ""}</span>
            </span>
            <span style={{ position: "relative", height: 10, background: T.bg3, borderRadius: 6 }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pos(f.pct) + "%", background: COL[f.estado], borderRadius: 6, opacity: f.pct < 0 ? 0.55 : 1 }} />
              <span style={{ position: "absolute", top: -3, bottom: -3, left: pos(r.inflacion) + "%", width: 2, background: T.txt2 }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", fontFamily: "monospace", color: COL[f.estado] }}>{fmtPctEs(f.pct, 1)}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 12 }}>
        {r.conDato.length > 8 && (
          <button type="button" onClick={() => setVerTodos(!verTodos)} style={{ background: "none", border: "none", padding: 0, color: T.blue || "#3b82f6", cursor: "pointer", fontSize: 12 }}>
            {verTodos ? "Ver menos" : `Ver los ${r.conDato.length}`}
          </button>
        )}
        {r.sinDato.length > 0 && (
          <button type="button" onClick={() => setVerSin(!verSin)} style={{ background: "none", border: "none", padding: 0, color: T.txt3, cursor: "pointer", fontSize: 12, textAlign: "left" }}>
            {verSin ? "▾" : "▸"} {r.sinDato.length} {r.sinDato.length === 1 ? "activo" : "activos"} ({fm(r.valorSinDato)}) sin renta ni valorización cargadas: no sabemos cuánto rinden
          </button>
        )}
      </div>
      {verSin && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {r.sinDato.map((f) => (
            <button key={f.id} type="button" onClick={() => onAbrir && onAbrir(f.item)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 999, padding: "5px 10px", color: T.txt2, fontSize: 12, cursor: "pointer" }}>
              {nombre(f.item)} · {fm(f.va)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
