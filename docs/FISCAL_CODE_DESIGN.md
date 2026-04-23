# FINPATHIA · Diseño del `fiscalCode` — Contrato de datos tributarios

**Autor:** sesión colaborativa · **Fecha:** Abril 2026 · **Estado:** draft para revisión

## Por qué esto existe

Hoy el motor tributario (`taxCO.js`) infiere el tratamiento fiscal de cada item usando regex sobre strings libres (`/Arriendo/i`, `/Intereses bancarios|CDT/`, etc.). Eso genera ambigüedad estructural:

- "Arriendo" puede ser de inmueble (cédula no laboral) o de mueble (cédula capital) — tope 40% distinto.
- "Honorarios" puede aplicar o no renta exenta 25% según si el owner tiene 2+ empleados (Art. 206 #10 ET).
- "Hipoteca" puede ser vivienda habitacional (intereses deducibles hasta 1.200 UVT Art. 119) o inversión (otro tratamiento).
- "Educación" en jurídica puede ser capacitación de empleados (deducible) o colegio de hijos del socio (no deducible).

El motor adivina. Gana el 60% del tiempo, falla silenciosamente el 40%.

## Principio rector

> **Plan Tributario NO pide datos. Toda la metadata fiscal se captura en el módulo fuente del item (Ingresos, Egresos, Deudas, Inversiones, Owners). Plan Tributario es un visualizador + ayudante de debugging. Nunca un formulario.**

## Contrato del `fiscalCode`

Cada item (ingreso, gasto, deuda, inversión) lleva un campo `fiscalCode: string` que determina unívocamente su tratamiento fiscal. Es una enum corta, legible para humanos, estable en el tiempo. Ejemplo: `NOL_ARRIENDO_INMUEBLE`, `LAB_SALARIO`, `DEU_NAT_VIVIENDA_HABITACIONAL`.

**Garantías:**
- El motor NUNCA usa regex sobre categorías o nombres. Solo `fiscalCode`.
- Items sin `fiscalCode` se infieren desde la categoría legacy con reglas conservadoras y generan un warning sugiriendo al usuario revisar.
- Un `fiscalCode` determina unívocamente: cédula, tope aplicable, artículo del ET, retención, deducibilidad.

## Catálogo completo

### 1. INGRESOS

**Laborales (LAB → Cédula General, renta de trabajo)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `LAB_SALARIO` | Salario CLT | INCRNGO 4% pensión + 4% salud (Art. 55-56), exenta 25% tope 790 UVT (Art. 206 #10), retefuente tabla Art. 383 |
| `LAB_HONORARIOS_CON_EMPLEADOS` | Honorarios con 2+ empleados ≥83% del año | SÍ aplica exenta 25%, INCRNGO 4% sobre IBC 40% |
| `LAB_HONORARIOS_SIN_EMPLEADOS` | Honorarios independiente <2 empleados o <90 días | NO aplica exenta 25%, tributa como no laboral |
| `LAB_PRESTACIONES_CESANTIAS` | Cesantías e intereses | Exención especial Art. 206 #4 |
| `LAB_PRESTACIONES_PRIMA` | Prima legal | Tratamiento Art. 206 |

**Capital (CAP → Cédula General, renta de capital)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `CAP_INTERESES_BANCARIOS` | Intereses bancarios, CDT | Componente inflacionario 50.88% Art. 38 ET |
| `CAP_FIC` | Utilidad FIC | Componente inflacionario Art. 39 ET |
| `CAP_RENDIMIENTO_GENERICO` | Rendimientos no especificados | Componente inflacionario Art. 38 ET |
| `CAP_REGALIAS_PI` | Regalías propiedad intelectual | Renta exenta Art. 235-2 (condicional) |
| `CAP_ARRIENDO_MUEBLE` | Arriendo de muebles/equipos | Cédula capital (NO no laboral) |
| `CAP_VENTA_ACTIVOS` | Venta activos <2 años | Renta ordinaria (si >2 años → ganancia ocasional) |

**No Laborales (NOL → Cédula General)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `NOL_ARRIENDO_INMUEBLE` | Arriendo inmueble | Gastos del inmueble 100% deducibles (Art. 107) |
| `NOL_HONORARIOS_INDEP` | Honorarios sin 2+ empleados | Cédula no laboral, sin exenta 25% |
| `NOL_NEGOCIO` | Actividad económica persona natural | Comerciante/negocio propio |
| `NOL_OTROS` | Otros ingresos | Tributación estándar |

**Dividendos (DIV → Cédula dividendos Art. 242)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `DIV_ART49_NO_GRAVADOS` | Dividendos nacionales parte no gravada | 0% (hasta 300 UVT), tabla sobre exceso |
| `DIV_ART49_GRAVADOS` | Dividendos nacionales parte gravada | 35% + tabla Art. 242 |
| `DIV_EXTERIOR` | Dividendos sociedades extranjeras | Tarifa diferente, tax credit Art. 254 |
| `DIV_INTERSOCIETARIOS` | Jurídica recibe de otra jurídica | No gravados Art. 48 ET |

**Pensiones (PEN)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `PEN_JUBILACION` | Pensión jubilación/vejez/invalidez | Exenta hasta 1.000 UVT mensuales Art. 206 #5 |

**Ganancias Ocasionales (GO)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `GO_VENTA_ACTIVO_MAS_2A` | Venta activo >2 años | 15% tarifa especial |
| `GO_HERENCIA` | Herencias, donaciones | 15% con exenta primera cuota |
| `GO_LOTERIA` | Loterías, rifas | 20% retención a la fuente |

### 2. GASTOS

**Natural (personales / deducibles laborales)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `GAS_NAT_SALUD_MEDICINA` | Medicina prepagada, pólizas salud | Deducible hasta 192 UVT/año Art. 387 |
| `GAS_NAT_DEPENDIENTES` | Evidencia de dependientes económicos | 10% laboral, tope 384 UVT Art. 387 |
| `GAS_NAT_PERSONAL` | Gasto personal de consumo | NO deducible (solo informativo cash flow) |
| `GAS_NAT_AHORRO` | Ahorro / inversión periódica | NO deducible |

**Gastos del inmueble arrendado (persona natural)**
| Código | Descripción | Tratamiento |
|---|---|---|
| `GAS_INMUEBLE_PREDIAL` | Predial del inmueble arrendado | 100% deducible renta no laboral Art. 107 |
| `GAS_INMUEBLE_MANTENIMIENTO` | Mantenimiento del inmueble arrendado | 100% deducible Art. 107 |
| `GAS_INMUEBLE_ADMINISTRACION` | Admón edificio | 100% deducible Art. 107 |
| `GAS_INMUEBLE_SERVICIOS` | Servicios públicos del inmueble | 100% deducible Art. 107 |
| `GAS_INMUEBLE_SEGUROS` | Pólizas del inmueble | 100% deducible Art. 107 |
| `GAS_INMUEBLE_DEPRECIACION` | Depreciación construcción | Art. 137 ET (si lleva contabilidad) |

**Jurídica**
| Código | Descripción | Tratamiento |
|---|---|---|
| `GAS_JUR_NOMINA` | Salarios + prestaciones | 100% deducible Art. 107 |
| `GAS_JUR_PARAFISCALES` | SENA, ICBF, Caja | 100% deducible |
| `GAS_JUR_HONORARIOS_PROF` | Contador, abogado, revisor | 100% deducible |
| `GAS_JUR_OPERATIVO` | Servicios, arriendo oficina, transporte | 100% deducible si cumple Art. 107 |
| `GAS_JUR_PREDIAL` | Predial inmueble productor | Deducible + descuento 50% ICA Art. 115 |
| `GAS_JUR_DEPRECIACION` | Depreciación fiscal | Art. 128-141 ET, vida útil por tipo |
| `GAS_JUR_CAPACITACION` | Capacitación empleados | 100% deducible si cumple Art. 107 |
| `GAS_JUR_NO_DEDUCIBLE` | Gasto explícitamente no deducible | Registrado para contabilidad, no afecta renta |

**Común**
| Código | Descripción | Tratamiento |
|---|---|---|
| `GAS_GMF` | 4x1000 | 50% deducible Art. 115 — calculado automático, no se registra |

### 3. DEUDAS

**Natural**
| Código | Descripción | Tratamiento |
|---|---|---|
| `DEU_NAT_VIVIENDA_HABITACIONAL` | Hipoteca / leasing habitacional de vivienda propia | Intereses deducibles hasta 1.200 UVT Art. 119 |
| `DEU_NAT_INVERSION` | Deuda para inversión (inmueble arrendado, etc.) | Intereses deducibles de renta de capital o no laboral |
| `DEU_NAT_CONSUMO` | Tarjeta crédito, libre inversión personal | Intereses NO deducibles |

**Jurídica**
| Código | Descripción | Tratamiento |
|---|---|---|
| `DEU_JUR_PRODUCTIVA` | Deuda para actividad productora renta | Intereses deducibles Art. 117 (con sub-capitalización Art. 118-1) |
| `DEU_JUR_NO_PRODUCTIVA` | Deuda sin relación con actividad | Intereses NO deducibles |

### 4. INVERSIONES

**Inmuebles**
| Código | Descripción | Tratamiento |
|---|---|---|
| `INV_INMUEBLE_HABITACIONAL` | Vivienda del contribuyente | No se deprecia, solo patrimonio |
| `INV_INMUEBLE_ARRENDADO` | Inmueble en arriendo | Deprecia construcción 2.22%/año Art. 137 |
| `INV_INMUEBLE_COMERCIAL_PROPIO` | Uso propio comercial | Deprecia construcción |
| `INV_INMUEBLE_VACANTE` | Sin uso actual | No deprecia |

*Metadata adicional por inmueble:*
- `pctTerreno` (0-100, default 30%) — Solo la construcción se deprecia.
- `añoAdquisicion` — Para cálculo ganancia ocasional si se vende.

**Activos financieros**
| Código | Descripción | Tratamiento |
|---|---|---|
| `INV_CDT` | CDT | Genera `CAP_INTERESES_BANCARIOS` |
| `INV_FIC` | Fondo inversión colectiva | Genera `CAP_FIC` |
| `INV_ACCIONES` | Acciones | Dividendos; ganancia ocasional si venta >2a |
| `INV_BONOS` | Renta fija | Genera `CAP_INTERESES_BANCARIOS` |
| `INV_CRYPTO` | Criptomonedas | Ganancia ocasional al realizar |

**Otros**
| Código | Descripción | Tratamiento |
|---|---|---|
| `INV_VEHICULO_PRODUCTIVO` | Vehículo comercial | Deprecia 20% año Art. 137 |
| `INV_VEHICULO_PERSONAL` | Vehículo personal | Solo patrimonio |
| `INV_EQUIPO_PRODUCTIVO` | Maquinaria, equipos | Deprecia según Art. 137 |

### 5. OWNERS

| Código | Descripción |
|---|---|
| `OWN_NAT_RESIDENTE_ORDINARIO` | Natural residente, régimen ordinario |
| `OWN_NAT_RESIDENTE_SIMPLE` | Natural residente, SIMPLE |
| `OWN_NAT_NO_RESIDENTE` | Natural no residente |
| `OWN_JUR_ORDINARIO` | Jurídica ordinario 35% |
| `OWN_JUR_SIMPLE` | Jurídica SIMPLE |
| `OWN_JUR_ZONA_FRANCA` | Jurídica ZF 20% |
| `OWN_JUR_CHC` | Compañía Holding Colombiana |
| `OWN_JUR_EXENTA` | Economía naranja o exenta |

*Metadata adicional por owner:*
- `aportes: {...}` (ya existe)
- `perdidasFiscalesAcumuladas` (ya existe, jurídica)
- `descuentosTributarios` (ya existe, jurídica)
- `regimenHonorarios: "con_empleados" | "sin_empleados" | null` (nuevo, natural con honorarios)
- `llevaContabilidad: boolean` (nuevo, afecta componente inflacionario y si puede depreciar)

## Reglas de inferencia (migración silenciosa)

Para items sin `fiscalCode`, el normalizador infiere desde la categoría legacy:

| Categoría legacy | fiscalCode inferido | ¿Warning? |
|---|---|---|
| `"Salario"` | `LAB_SALARIO` | No |
| `"Honorarios"` / `"Freelance"` | Depende de `owner.regimenHonorarios`: `LAB_HONORARIOS_CON_EMPLEADOS` o `NOL_HONORARIOS_INDEP` | Sí (si regimenHonorarios=null) |
| `"Arriendo"` | `NOL_ARRIENDO_INMUEBLE` (asumir inmueble) | Sí |
| `"Intereses bancarios"` / `"CDT"` | `CAP_INTERESES_BANCARIOS` | No |
| `"Utilidad FIC"` / `"FIC"` | `CAP_FIC` | No |
| `"Rendimiento"` | `CAP_RENDIMIENTO_GENERICO` | Sí |
| `"Dividendos"` | Depende owner.type: natural→`DIV_ART49_GRAVADOS`, jurídica→`DIV_INTERSOCIETARIOS` | Sí |
| `"Inversión"` | `CAP_VENTA_ACTIVOS` | Sí |
| `"Pensión"` | `PEN_JUBILACION` | No |
| Otros sin match | `NOL_OTROS` | Sí |

Para deudas legacy: matching de `tp` y `n`:
- `tp="mortgage"` o `/hipoteca|vivienda/` → Si natural: `DEU_NAT_VIVIENDA_HABITACIONAL`. Si jurídica: `DEU_JUR_PRODUCTIVA`.
- `tp="credit_card"` o `/tarjeta/` → `DEU_NAT_CONSUMO` o `DEU_JUR_NO_PRODUCTIVA`.
- Otros → `DEU_NAT_CONSUMO` (natural) o `DEU_JUR_PRODUCTIVA` (jurídica) con warning.

Para inversiones legacy `tp="Real Estate"`:
- Si owner natural + existe ingreso `NOL_ARRIENDO_INMUEBLE` del mismo owner → `INV_INMUEBLE_ARRENDADO`.
- Si owner jurídica → `INV_INMUEBLE_COMERCIAL_PROPIO` (asumir productivo).
- Si no determinable → `INV_INMUEBLE_HABITACIONAL` (conservador: no deprecia) + warning.

## Contrato del motor

```javascript
// API actual
const result = estimarImpuesto(user);

// API nueva (misma superficie, lógica normalizada adentro)
const result = estimarImpuesto(user);
// Internamente:
//   const { data, warnings } = normalizeFiscalData(user);
//   return calculateTaxes(data); // consume fiscalCode, sin regex

// Nueva API pública para UI:
const warnings = getFiscalWarnings(user);
// Array de { severity, itemType, itemId, ownerId, code, message, impactoFiscalAprox, resolverEn, accionSugerida }
```

## Estructura de warnings

```javascript
{
  severity: "error" | "warning" | "info",
  itemType: "ingreso" | "gasto" | "deuda" | "inversion" | "owner",
  itemId: "ing_123",
  ownerId: "own_1",
  code: "HONORARIOS_SIN_REGIMEN_DECLARADO",
  message: "Honorarios para 'Sosa' no indican si tiene 2+ empleados — afecta exenta 25%",
  impactoFiscalAprox: 15_000_000,  // COP
  resolverEn: "config#owner-sosa",
  accionSugerida: "Indica en el editor del owner Sosa si tienes 2+ empleados contratados ≥83% del año",
  articuloET: "Art. 206 #10",
}
```

## Plan de rollout por sprint

### Sprint 1 · Foundation (invisible para el usuario)
1. Crear `src/lib/fiscalCodes.js` con todas las enums + metadata descriptiva
2. Crear `src/lib/normalize.js` con:
   - `inferFiscalCode(item, owner)` → string
   - `normalizeFiscalData(user)` → `{ data, warnings[] }`
   - `getFiscalWarnings(user)` → `warnings[]`
3. Modificar `estimarImpuesto()` en `taxCO.js` para llamar internamente a `normalizeFiscalData` y consumir `fiscalCode` en vez de regex
4. Ampliar `verify_tax.mjs` con 10+ escenarios nuevos cubriendo todas las combinaciones de `fiscalCode`
5. CERO cambios visibles al usuario (migración invisible)

**Tamaño:** 1-2 sesiones. **Riesgo:** medio (cambio de motor, pero protegido por tests).

### Sprint 2 · UI explícita en módulos
- Ingresos: select de `fiscalCode` como campo explícito (labels amigables)
- Gastos: select granular
- Deudas: pregunta "¿Para qué usaste esta deuda?"
- Inversiones: "¿Cómo usas este inmueble?"
- Botón masivo "Migrar items pendientes" en cada módulo

**Tamaño:** 2-3 sesiones. **Riesgo:** bajo.

### Sprint 3 · Warnings inline proactivos
- Plan Tributario: barra superior agrupando warnings con link a resolver
- Cada item en los módulos muestra badge `✓ fiscalCode asignado` o `⚠ revisión recomendada`
- Tooltips con artículo del ET aplicable
- Impacto fiscal estimado de cada warning

**Tamaño:** 2 sesiones. **Riesgo:** bajo.

### Sprint 4 · Refactor final + hardening
- `OwnerPlan` consume `estimarImpuesto()` en vez de duplicar cálculo
- Eliminar TODA regex de inferencia (queda solo en `normalize.js`)
- Snapshot tests: `user.json` → resultado esperado (detección de regresiones)
- Pre-commit hook: correr tests antes de permitir push

**Tamaño:** 2 sesiones. **Riesgo:** bajo (backstopped por tests).

## Criterios de aceptación (todos los sprints)

- `node scripts/verify_tax.mjs` pasa 100% antes de cada push
- `python3 audit.py` devuelve 19/19
- No hay regresión en comportamiento visible para usuarios existentes (migración invisible)
- Cada commit es auto-contenido (se puede revertir sin romper)

## Preguntas abiertas para resolver antes de Sprint 1

1. ¿Cómo manejar ingresos "híbridos" (ej. un pago que es parte honorarios y parte servicios)? → Propuesta: un item = un fiscalCode. Si el usuario tiene mezcla, divide en dos items.
2. ¿Dónde guardamos `regimenHonorarios` y `llevaContabilidad`? → En el owner natural. Lo agregamos al editor en Sprint 2.
3. ¿`pctTerreno` para inmuebles? → Default 30% (tratamiento DIAN típico). Usuario puede ajustar en Sprint 2.
4. ¿Qué hacemos con los reportes actuales que muestran regex-inferred labels ("ingresos laborales", "capital", etc.)? → Usar el `fiscalCode` como source of truth, el label es un display derivado.

## Decisiones de diseño clave

- **Una sola fuente de verdad:** `fiscalCode` por item, el motor nunca vuelve a adivinar.
- **Migración invisible:** el usuario no necesita hacer nada manual. Los warnings lo guían cuando hay ambigüedad real.
- **Conservador en la inferencia:** cuando hay duda, asumimos el tratamiento que minimiza el beneficio fiscal (ej. inmueble → habitacional = no deprecia). Así nunca sobre-beneficiamos por error.
- **Tests primero:** todo cambio de motor va acompañado de tests nuevos en `verify_tax.mjs`.
- **Artículo del ET siempre referenciado:** cada `fiscalCode` documenta el artículo que lo justifica.
