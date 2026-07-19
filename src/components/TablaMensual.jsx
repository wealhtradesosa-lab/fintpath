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

const fm = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");

export default function TablaMensual({ values = [], onChange, tokens: T }) {
  // Asegurar que siempre tenemos 12 posiciones
  const montos = Array.isArray(values) && values.length === 12
    ? values.map(v => Number(v) || 0)
    : new Array(12).fill(0);

  // Proyección: promedio de meses reales (los que tienen valor > 0)
  const proyeccion = promedioMesesReales(montos);
  const { año: añoActual } = getMesActual();

  // Contar tipos de meses
  const reales = montos.filter(m => m > 0).length;
  const proyectadosCount = montos.reduce((c, valor, idx) => {
    if (valor === 0 && esMesFuturo(añoActual, idx + 1)) return c + 1;
    return c;
  }, 0);

  // Total: incluye reales cargados + proyección en meses futuros vacíos
  const totalConProyeccion = montos.reduce((s, valor, idx) => {
    const mes = idx + 1;
    if (valor > 0) return s + valor;
    if (esMesFuturo(añoActual, mes)) return s + proyeccion;
    return s;
  }, 0);
  const promedioAnual = totalConProyeccion / 12;

  const actualizarMes = (idx, valor) => {
    const nuevoArray = [...montos];
    nuevoArray[idx] = Number(valor) || 0;
    onChange(nuevoArray);
  };

  const aplicarATodos = () => {
    const primerValor = montos[0];
    if (primerValor === 0) return;
    onChange(new Array(12).fill(primerValor));
  };

  const limpiar = () => {
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

      {/* Grid 4 columnas × 3 filas — visualmente organizado por trimestres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
        {MESES.map((mes, idx) => {
          const valor = montos[idx];
          const tieneValor = valor > 0;
          const esFuturo = esMesFuturo(añoActual, mes.v);
          const esProyectado = !tieneValor && esFuturo && proyeccion > 0;
          const valorMostrado = tieneValor ? valor : (esProyectado ? proyeccion : 0);

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
              <input
                type="number"
                value={valor || ""}
                onChange={(e) => actualizarMes(idx, e.target.value)}
                placeholder={esProyectado ? Math.round(proyeccion).toLocaleString("es-CO") : "0"}
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

      {/* Resumen: total año + promedio + reales + proyectados */}
      <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: T.txt3, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>Total del año {proyectadosCount > 0 && <span style={{ color: "#22d3ee" }}>(c/ proyección)</span>}</div>
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
