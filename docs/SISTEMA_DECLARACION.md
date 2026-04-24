# Sistema de declaración de renta — FINPATHIA

Documentación consolidada del flujo completo de declaración de renta
(persona natural F-210 / persona jurídica F-110) con histórico multi-año,
detección de alertas y observabilidad.

## Arquitectura

### Data shape por owner

Cada owner (persona natural o jurídica) persiste en `user.owners[]`:

```
{
  id: string,
  name: string,
  type: "natural" | "juridica",
  regimen: "ordinario" | "simple" | "zonaFranca" | "chc" | "exenta",

  // Declaración del año en curso (en progreso)
  formulario210: { identificacion, ingresos, depuracion, otrasCedulas, liquidacion },
  formulario110: { identificacion, ingresos, depuracion, compensaciones, liquidacion },

  // Histórico multi-año (Fase 1+)
  declaracionesAnteriores: [
    { tipo: "F210"|"F110", anoGravable: "2024", renglones: {...}, capturadoEn },
    { tipo: "F210"|"F110", anoGravable: "2023", renglones: {...}, capturadoEn },
    ...
  ],

  // Atajo al más reciente (sinónimo de declaracionesAnteriores[0])
  declaracionAnterior: { tipo, anoGravable, renglones, capturadoEn },

  // Otros
  aportes: {...},          // overrides INCRNGO manuales
  perdidasFiscalesAcumuladas,
  descuentosTributarios,
  regimenHonorarios,       // natural: "con_empleados" | "sin_empleados" | "no_aplica"
  llevaContabilidad,       // natural: boolean
}
```

## Flujo del usuario

```
[1] Tab "Declaración completa"
      ↓
[2] Click "📥 Importar año anterior" (por cada owner)
      ↓
[3] Modal: chips de años guardados + captura manual de renglones
      ↓ Guardar
[4] Click "Completar F-210" o "Completar F-110"
      ↓
[5] Wizard 5 pasos:
      Paso 1: Identificación
      Paso 2: Ingresos (prevYear en campos clave)
      Paso 3: Depuración (prevYear, sugeridos del motor)
      Paso 4: Otras cédulas / Compensaciones
      Paso 5: Liquidación →
              · Mini-gráfica evolución histórica (Fase 3)
              · Proyección año siguiente (Fase 3)
              · Panel alertas (delta + patrones cruzados + tendencia)
              · Banner comparativo impuesto vs año anterior
```

## Features entregadas (en orden cronológico)

### 1. Importador de declaración anterior
Modal manual que captura ~15-19 renglones clave. Soporta F-210 (natural)
y F-110 (jurídica). Escribe en `owner.declaracionAnterior` + array.

### 2. Botones "prev_year" en casillas del wizard
Cada casilla relevante muestra bajo el input:
- `💡 Pre-llenar con $X` — sugerido del motor (verde)
- `📥 Año 2024: $Y` — valor declarado el año pasado (cyan, click copia)

### 3. Banner comparativo y alertas de delta
Al final del Paso 5, card con:
- Impuesto año anterior vs actual
- Delta en % con ícono ▲/▼
- Monto absoluto de la diferencia

### 4. Patrones cruzados (13 detectores)
Alertas que solo emergen al cruzar variables — no visibles mirando un
campo aislado:
1. Retenciones inconsistentes con ingresos (CRITICAL)
2. Impuesto sube más de lo esperado
3. Intereses vivienda desaparecieron
4. Dependientes desaparecieron
5. Sin retenciones con ingresos altos (CRITICAL)
6. Dividendos ausentes
7. Exenta 25% desapareció
8. PV+AFC desaparecieron
9. Medicina prepagada desapareció
10. GMF desapareció
11. Descuento donaciones desapareció (Art. 257 ET)
12. Ganancias ocasionales sin impuesto (CRITICAL)
13. Descuento ICA desapareció (solo jurídicas)

### 5. Fase 1 — Histórico multi-año
- Array `declaracionesAnteriores[]` con editor por año (chips cyan)
- Reemplaza en lugar de duplicar si se recaptura un año
- Compat 100% con código que lee `declaracionAnterior` (singular)

### 6. Fase 2 — Detección de tendencia
- `calcPatronesTendencia({ serie, actual })` con umbral ≥20 pp de
  desvío vs pendiente histórica
- `proyectarSiguienteAno(serie, key)` para estimación lineal del
  próximo año
- Requiere ≥2 años de historial

### 7. Fase 3 — Mini-gráfica + proyección visible
- Sparkline Recharts de 160px con 3 líneas (ingresos, impuesto,
  retenciones)
- Banner verde "🔮 Proyección año siguiente" con valores calculados
- Tooltip con montos formateados

### 8. Centralización tabla Art. 241
- `src/lib/tablaArt241.js` como fuente única
- Elimina 4 copias duplicadas (taxCO, F-210, SimuladorTributario,
  test de paridad)

### 9. Test end-to-end del flujo
- `scripts/verify_flujo_declaracion.mjs` con 9 invariantes
- Simula escenario real (natural con historial + olvidos)
- Corre en pre-commit hook

### 10. Analytics y observabilidad
Eventos instrumentados (GA4 via gtag `G-51CV6PWRLT`):

| Evento | Disparador |
|---|---|
| `declaracion_anterior_guardada` | Click guardar en importador |
| `wizard_f210_abierto` / `wizard_f110_abierto` | Montar componente |
| `wizard_f210_paso` / `wizard_f110_paso` | Cada cambio de step |
| `prev_year_copiado` | Click en botón cyan de año anterior |
| `alertas_ano_anterior_renderizado` | Panel muestra ≥1 señal |
| `minigrafica_historico_renderizada` | Sparkline renderiza |
| `wizard_f210_guardado` / `wizard_f110_guardado` | Click guardar final |
| `revision_fiscal_aprobar` | Click "✓ Aprobar" individual |
| `revision_fiscal_aprobar_grupo` | Click "✓ Aprobar todos" |

Payload: solo metadatos, sin montos ni PII. Ver `src/lib/analytics.js`.

### 11. Dashboard de observabilidad interno
`https://finpathia.com/?debug=1` → panel que muestra los últimos 50
eventos de la sesión actual desde localStorage. Útil para QA y debug
sin depender de GA4.

### 12. UIs dedicadas para overrides del owner

Cuatro inputs críticos del motor que NO se capturan en el wizard F-210/F-110
ahora tienen componentes dedicados en el tab Declaración Completa:

| Componente | Aplica a | Qué captura |
|---|---|---|
| `ImportDeclaracionAnterior` | natural + jurídica | Renglones de la declaración del año pasado (17-25 campos) |
| `EditarDescuentosTributarios` | solo jurídica | CTI, empleo, exterior, donaciones, otros (Art. 256-259 ET) |
| `EditarAportesManuales` | solo natural | Pensión obl/salud obl/indep + PV mensual + flag bruto |

Todos los componentes:
- Muestran `prevYear` cyan clickeable si hay `owner.declaracionAnterior`
  con valores equivalentes
- Emiten eventos analytics con counts (sin montos ni PII)
- Tienen total en tiempo real y banner explicativo
- Se acceden desde botones con checkmark `✓` si hay valores guardados

### 13. Warnings de no-captura (año a año)

Dos warnings en el Panel Revisión Fiscal que detectan cuando el owner
declaró algo el año anterior pero no lo capturó en los overrides del
año actual — caso típico de olvidar renovar un beneficio:

| Warning code | Trigger | Costo típico |
|---|---|---|
| `DESCUENTOS_AÑO_ANTERIOR_NO_CAPTURADOS` | jurídica con Σdescuentos > $1M anteriores y < 30% capturado | 100% del descuento (va directo del impuesto) |
| `APORTES_VOLUNTARIOS_NO_CAPTURADOS` | natural con pvAFC > $1M anterior y `ow.aportes.pensionVoluntariaMensual = 0` | ~tasa marginal × monto anual |

Ambos aparecen como warnings item-level con botones "✓ Aprobar" y
"Ir al perfil" para capturar los valores correctamente.

## Infraestructura de tests

Corren automáticamente en pre-commit:

| Script | Qué verifica |
|---|---|
| `audit.py` | 19 checks estructurales del proyecto |
| `verify_normalize.mjs` | 36 tests de fiscalCodes |
| `verify_tax.mjs` | Motor estimarImpuesto |
| `verify_adapter.mjs` | 29 tests adapter OwnerPlan |
| `verify_wizard_parity.mjs` | 10 invariantes wizard ↔ motor |
| `verify_flujo_declaracion.mjs` | 9 invariantes flujo end-to-end |
| `snapshot_tax.mjs` | 9 escenarios del motor, valores fijados |

## Archivos principales

```
src/
  lib/
    taxCO.js                      Motor estimarImpuesto
    tablaArt241.js                Tabla progresiva (fuente única)
    fiscalCodes.js                Enum + FISCAL_CODE_META
    normalize.js                  Normalizer + warnings
    ownerPlanAdapter.js           Adapter con aliases legacy
    alertasCore.js                Detectores puros (tests node)
    analytics.js                  track() + buffer local

  components/
    Formulario210.jsx             Wizard persona natural
    Formulario110.jsx             Wizard persona jurídica
    ImportDeclaracionAnterior.jsx Modal de captura año anterior
    AlertasAnoAnterior.jsx        Componente React de alertas
    MiniGraficaAnosAnteriores.jsx Sparkline Recharts
    DashboardObservabilidad.jsx   Dashboard interno /?debug=1
    SimuladorTributario.jsx       Plan Tributario con panel Revisión
```

## UVT constantes

```
UVT 2026: $52.374
UVT 2025: $49.799
UVT 2024: $47.065
SMMLV 2026: $1.750.905
```

## Notas

- **Universal, no personalizado**: FINPATHIA debe funcionar para cualquier
  usuario. Rechazar features que hardcodeen datos de test.
- **Value consistency**: si un número en SimuladorAvanzado no matchea con
  Plan Tributario, es un bug — alineación tiene prioridad sobre
  sofisticación dinámica.
- **Incremental y verificable**: cada commit debe ser independientemente
  verificable. Una cosa a la vez. Nunca deploy sin build local limpio.
