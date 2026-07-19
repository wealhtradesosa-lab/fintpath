// ═══════════════════════════════════════════════════════════════════════════
// TablaMensual — Grid de 12 inputs para ingresos/gastos con monto variable
// mes a mes (Fase Variable 18-jul-2026 noche).
//
// Motivación (Santiago):
//   "Tengo algunos ingresos que unos meses son 15mm otros 8mm y unas pocas
//   veces al año 40mm — cómo hacer aquí para registrar esos ingresos".
//
// Este componente permite ingresar el valor de cada mes por separado en una
// grilla de 12 celdas. Incluye acciones rápidas:
//   • Botón "Aplicar a todos" para replicar el primer valor
//   • Botón "Limpiar" para resetear
//   • Resumen automático: Total año + Promedio mensual + Meses activos
//
// Uso:
//   <TablaMensual
//     values={form.montosMensuales}  // array de 12 números
//     onChange={(newArr) => setForm(p => ({ ...p, montosMensuales: newArr }))}
//     tokens={T}
//   />
//
// El array siempre tiene 12 posiciones (índice 0 = enero, 11 = diciembre).
// Los valores son números; 0 significa "no hay ingreso/gasto ese mes".
// ═══════════════════════════════════════════════════════════════════════════

import { MESES, getMesActual, promedioMesesReales, esMesFuturo } from "../lib/flowHelpers.js";
import NumberInput from "./NumberInput";

const fm = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");

export default function TablaMensual({
  values = [],
  onChange,
  tokens: T,
  // UX ampliación (18-jul-2026 noche): soporte de vigencia limitada.
  // Ej: variable-mensual con desdeMes=7, hastaMes=12 → solo Jul-Dic editables.
  // Meses fuera del rango se muestran deshabilitados y se fuerzan a 0.
  desdeMes = 1,
  hastaMes = 12,
}) {
  // Asegurar que siempre tenemos 12 posiciones
  const montos = Array.isArray(values) && values.length === 12
    ? values.map(v => Number(v) || 0)
    : new Array(12).fill(0);

  // Helper: ¿el mes M (1-12) está dentro del rango de vigencia?
  const enVigencia = (m) => m >= desdeMes && m <= hastaMes;
  const vigenciaLimitada = desdeMes !== 1 || hastaMes !== 12;
  const nMesesEnRango = hastaMes - desdeMes + 1;

  // Proyección: promedio de meses reales EN VIGENCIA (los que tienen valor > 0)
  const montosEnVigencia = montos.filter((_, idx) => enVigencia(idx + 1));
  const proyeccion = promedioMesesReales(montosEnVigencia);
  const { año: añoActual } = getMesActual();

  // Contar tipos de meses (solo en vigencia)
  const reales = montos.filter((m, idx) => enVigencia(idx + 1) && m > 0).length;
  const proyectadosCount = montos.reduce((c, valor, idx) => {
    const mes = idx + 1;
    if (!enVigencia(mes)) return c;
    if (valor === 0 && esMesFuturo(añoActual, mes)) return c + 1;
    return c;
  }, 0);

  // Total: incluye reales cargados + proyección en meses futuros vacíos (dentro de vigencia)
  const totalConProyeccion = montos.reduce((s, valor, idx) => {
    const mes = idx + 1;
    if (!enVigencia(mes)) return s;
    if (valor > 0) return s + valor;
    if (esMesFuturo(añoActual, mes)) return s + proyeccion;
    return s;
  }, 0);
  const promedioAnual = totalConProyeccion / (vigenciaLimitada ? nMesesEnRango : 12);

  const actualizarMes = (idx, valor) => {
    // Solo permite editar meses en vigencia
    if (!enVigencia(idx + 1)) return;
    const nuevoArray = [...montos];
    nuevoArray[idx] = Number(valor) || 0;
    onChange(nuevoArray);
  };

  const aplicarATodos = () => {
    // Copia el primer valor EN VIGENCIA a los otros meses en vigencia
    const primerValor = montos[desdeMes - 1];
    if (primerValor === 0) return;
    const nuevoArray = montos.map((_, idx) =>
      enVigencia(idx + 1) ? primerValor : 0
    );
    onChange(nuevoArray);
  };

  const limpiar = () => {
    // Deja todo en 0 (respetando estructura de 12 meses)
    onChange(new Array(12).fill(0));
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Header con acciones rápidas */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: T.txt3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          📊 Monto de cada mes
        </label>
        <div style={{ display: "flex", gap: 5 }}>
          <button
            type="button"
            onClick={aplicarATodos}
            title="Copia el valor de enero a todos los meses"
            style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", color: T.txt3, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
            📋 Aplicar a todos
          </button>
          <button
            type="button"
            onClick={limpiar}
            title="Poner todos en 0"
            style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", color: T.txt3, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
            🗑️ Limpiar
          </button>
        </div>
      </div>

      {/* UX FIX (18-jul-2026 noche): si el user acaba de cambiar a este
          template y todos los meses tienen el mismo valor > 0, es porque
          precargamos con el monto mensual actual. Se lo hacemos saber. */}
      {(() => {
        const cargados = montos.filter(m => m > 0);
        const todosIguales = cargados.length === 12 && cargados.every(m => m === cargados[0]);
        if (!todosIguales) return null;
        return (
          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11, color: "#22c55e", lineHeight: 1.5 }}>
            ✅ <strong>Se importó tu monto</strong> ({fm(cargados[0])}/mes) en los 12 meses. Ajustá los que sean diferentes (ej: mayo con $40M, marzo con $8M).
          </div>
        );
      })()}

      {/* Explicación de proyección — solo aparece si hay meses futuros a proyectar */}
      {proyectadosCount > 0 && proyeccion > 0 && (
        <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11, color: "#22d3ee", lineHeight: 1.5 }}>
          💡 Los meses <strong>futuros vacíos</strong> se proyectan con el promedio de los cargados: <strong>{fm(proyeccion)}</strong>/mes
        </div>
      )}

      {/* Nota de vigencia limitada — si el rango no es 1-12 */}
      {vigenciaLimitada && (
        <div style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 11, color: "#3b82f6", lineHeight: 1.5 }}>
          📅 <strong>Vigencia limitada:</strong> solo {nMesesEnRango} {nMesesEnRango === 1 ? "mes" : "meses"} activos ({MESES[desdeMes - 1].l}–{MESES[hastaMes - 1].l}). Los meses fuera del rango se muestran deshabilitados.
        </div>
      )}

      {/* Grid 4 columnas × 3 filas — visualmente organizado por trimestres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
        {MESES.map((mes, idx) => {
          const enR = enVigencia(mes.v);
          const valor = montos[idx];
          const tieneValor = valor > 0 && enR;
          const esFuturo = esMesFuturo(añoActual, mes.v);
          const esProyectado = enR && !tieneValor && esFuturo && proyeccion > 0;

          // Fuera de vigencia: celda gris opaca, no editable, muestra 🚫
          if (!enR) {
            return (
              <div key={mes.v} style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px dashed ${T.border}`,
                borderRadius: 8,
                padding: "6px 8px",
                opacity: 0.4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <label style={{ fontSize: 9, fontWeight: 700, color: T.txt3, letterSpacing: 0.3, textTransform: "uppercase" }}>
                    {mes.l.slice(0, 3)}
                  </label>
                  <span style={{ fontSize: 9, color: T.txt3 }} title="Fuera del rango de vigencia">🚫</span>
                </div>
                <div style={{ fontSize: 11, color: T.txt3, fontFamily: "monospace", fontWeight: 500, padding: "2px 0" }}>—</div>
              </div>
            );
          }

          return (
            <div key={mes.v} style={{
              background: tieneValor
                ? "rgba(34,197,94,0.05)"
                : (esProyectado ? "rgba(34,211,238,0.06)" : T.bg3),
              border: `1px solid ${
                tieneValor
                  ? "rgba(34,197,94,0.25)"
                  : (esProyectado ? "rgba(34,211,238,0.25)" : T.border)
              }`,
              borderRadius: 8,
              padding: "6px 8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: tieneValor ? "#22c55e" : (esProyectado ? "#22d3ee" : T.txt3), letterSpacing: 0.3, textTransform: "uppercase" }}>
                  {mes.l.slice(0, 3)}
                </label>
                {tieneValor && <span style={{ fontSize: 9, color: "#22c55e" }}>✓</span>}
                {esProyectado && <span style={{ fontSize: 9, color: "#22d3ee" }} title="Proyectado con promedio">~</span>}
              </div>
              <NumberInput
                value={valor || ""}
                onChange={(nuevoValor) => actualizarMes(idx, nuevoValor)}
                placeholder={esProyectado ? Math.round(proyeccion).toLocaleString("es-CO") : "0"}
                allowDecimals={false}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: tieneValor ? T.txt : (esProyectado ? "#22d3ee" : T.txt3),
                  fontSize: 12,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  padding: "2px 0",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Resumen: total + promedio + reales + proyectados */}
      <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
            {vigenciaLimitada ? `Total (${nMesesEnRango} ${nMesesEnRango === 1 ? "mes" : "meses"})` : "Total del año"}
            {proyectadosCount > 0 && <span style={{ color: "#22d3ee" }}> (c/ proyección)</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: totalConProyeccion > 0 ? "#22c55e" : T.txt3, fontFamily: "monospace", marginTop: 1 }}>{fm(totalConProyeccion)}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Promedio</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.txt, fontFamily: "monospace", marginTop: 1 }}>{fm(promedioAnual)}<span style={{ fontSize: 10, color: T.txt3, marginLeft: 3 }}>/mes</span></div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Cargados</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1 }}>
            <span style={{ color: "#22c55e" }}>{reales}</span>
            {proyectadosCount > 0 && <span style={{ color: "#22d3ee", marginLeft: 6, fontSize: 12 }}>+ {proyectadosCount} proy.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
