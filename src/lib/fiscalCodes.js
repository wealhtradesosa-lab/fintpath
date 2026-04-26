// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · Catálogo de fiscalCode (Colombia · Estatuto Tributario)
// ─────────────────────────────────────────────────────────────────────────
// Cada item (ingreso, gasto, deuda, inversión, owner) lleva un fiscalCode
// que determina unívocamente su tratamiento fiscal. El motor consume este
// código en vez de inferir con regex sobre strings libres.
//
// Documento de diseño: /docs/FISCAL_CODE_DESIGN.md
// ═════════════════════════════════════════════════════════════════════════

// ─── INGRESOS ─────────────────────────────────────────────────────────────

// Laborales (LAB → Cédula General, renta de trabajo)
export const LAB_SALARIO                     = "LAB_SALARIO";
export const LAB_HONORARIOS_CON_EMPLEADOS    = "LAB_HONORARIOS_CON_EMPLEADOS";
export const LAB_HONORARIOS_SIN_EMPLEADOS    = "LAB_HONORARIOS_SIN_EMPLEADOS";
export const LAB_PRESTACIONES_CESANTIAS      = "LAB_PRESTACIONES_CESANTIAS";
export const LAB_PRESTACIONES_PRIMA          = "LAB_PRESTACIONES_PRIMA";

// Capital (CAP → Cédula General, renta de capital)
export const CAP_INTERESES_BANCARIOS         = "CAP_INTERESES_BANCARIOS";
export const CAP_FIC                         = "CAP_FIC";
export const CAP_RENDIMIENTO_GENERICO        = "CAP_RENDIMIENTO_GENERICO";
export const CAP_REGALIAS_PI                 = "CAP_REGALIAS_PI";
export const CAP_ARRIENDO_MUEBLE             = "CAP_ARRIENDO_MUEBLE";
export const CAP_VENTA_ACTIVOS               = "CAP_VENTA_ACTIVOS";

// No Laborales (NOL → Cédula General)
export const NOL_ARRIENDO_INMUEBLE           = "NOL_ARRIENDO_INMUEBLE";
export const NOL_HONORARIOS_INDEP            = "NOL_HONORARIOS_INDEP";
export const NOL_NEGOCIO                     = "NOL_NEGOCIO";
export const NOL_OTROS                       = "NOL_OTROS";

// Dividendos (DIV → Cédula dividendos Art. 242)
export const DIV_ART49_NO_GRAVADOS           = "DIV_ART49_NO_GRAVADOS";
export const DIV_ART49_GRAVADOS              = "DIV_ART49_GRAVADOS";
export const DIV_EXTERIOR                    = "DIV_EXTERIOR";
export const DIV_INTERSOCIETARIOS            = "DIV_INTERSOCIETARIOS";

// Pensiones (PEN)
export const PEN_JUBILACION                  = "PEN_JUBILACION";

// Ganancias Ocasionales (GO)
export const GO_VENTA_ACTIVO_MAS_2A          = "GO_VENTA_ACTIVO_MAS_2A";
export const GO_HERENCIA                     = "GO_HERENCIA";
export const GO_LOTERIA                      = "GO_LOTERIA";

// ─── GASTOS ───────────────────────────────────────────────────────────────

// Naturales (personales / deducibles laborales)
export const GAS_NAT_SALUD_MEDICINA          = "GAS_NAT_SALUD_MEDICINA";
export const GAS_NAT_DEPENDIENTES            = "GAS_NAT_DEPENDIENTES";
export const GAS_NAT_PERSONAL                = "GAS_NAT_PERSONAL";
export const GAS_NAT_AHORRO                  = "GAS_NAT_AHORRO";

// ─── SEGUROS (Commit B2) ──────────────────────────────────────────────────
// Distinción por tipo. Para persona natural:
//   SEG_SALUD, SEG_VIDA: deducibles Art. 387 #2 (entran al tope 16 UVT/mes
//                        compartido con medicina prepagada)
//   SEG_VEHICULO, SEG_HOGAR: NO deducibles (no cumplen Art. 107 ET salvo
//                            causalidad probada con actividad por honorarios)
//   SEG_GENERICO: default conservador para items legacy sin clasificar →
//                 NO deducible hasta que el usuario lo re-categorice
// Para seguro del inmueble arrendado se usa el ya existente GAS_INMUEBLE_SEGUROS.
export const SEG_SALUD                       = "SEG_SALUD";       // Salud individual (Art. 387 #2 — tope 16 UVT/mes con medicina prepagada)
export const SEG_VIDA                        = "SEG_VIDA";        // Vida (Art. 387 #2 — mismo tope que salud)
export const SEG_VEHICULO                    = "SEG_VEHICULO";    // Vehículo (NO deducible natural)
export const SEG_HOGAR                       = "SEG_HOGAR";       // Hogar (NO deducible natural)
export const SEG_GENERICO                    = "SEG_GENERICO";    // Default conservador (legacy, sin clasificar)
// Commit 15 Tarea 3: impuesto vehicular (rodamiento). El usuario reportó que
// no había categoría para clasificarlo. Dos variantes según uso del vehículo:
//   - Personal: NO deducible (igual que SEG_VEHICULO, no cumple Art. 107)
//   - Profesional: 50% deducible Art. 107 (uso mixto, conservador, máx 1)
// Para vehículo de jurídica: sigue cayendo en GAS_JUR_DEDUCIBLE genérico.
export const IMP_VEHICULAR_PERSONAL           = "IMP_VEHICULAR_PERSONAL";    // Rodamiento personal (NO deducible)
export const IMP_VEHICULAR_PROFESIONAL        = "IMP_VEHICULAR_PROFESIONAL"; // Rodamiento vehículo profesional (50% Art. 107)

// ─── APORTES TRIBUTARIOS (Commit 1.6) ────────────────────────────────────
// Egresos que reducen la base gravable de persona natural. Shape nuevo:
// viven en el módulo de Egresos con categoría "Aporte tributario".
// Comparten tope 25% neto laboral / 2500 UVT entre PV y AFC (Art. 126-1, 126-4 ET).
// Salud prepagada comparte tope 16 UVT/mes con gastos médicos (Art. 387 #2 ET).
export const AP_TRIB_PV                      = "AP_TRIB_PV";                   // Pensión Voluntaria (Art. 126-1)
export const AP_TRIB_AFC                     = "AP_TRIB_AFC";                  // Ahorro Fomento Construcción (Art. 126-4)
export const AP_TRIB_SALUD_PREPAGADA         = "AP_TRIB_SALUD_PREPAGADA";      // Salud prepagada (Art. 387 #2)

// Gastos del inmueble arrendado (natural, Art. 107)
export const GAS_INMUEBLE_PREDIAL            = "GAS_INMUEBLE_PREDIAL";
export const GAS_INMUEBLE_MANTENIMIENTO      = "GAS_INMUEBLE_MANTENIMIENTO";
export const GAS_INMUEBLE_ADMINISTRACION     = "GAS_INMUEBLE_ADMINISTRACION";
export const GAS_INMUEBLE_SERVICIOS          = "GAS_INMUEBLE_SERVICIOS";
export const GAS_INMUEBLE_SEGUROS            = "GAS_INMUEBLE_SEGUROS";
export const GAS_INMUEBLE_DEPRECIACION       = "GAS_INMUEBLE_DEPRECIACION";

// ─── GASTOS DEDUCIBLES DE HONORARIOS (Art. 107 ET — actividad independiente) ───
// Solo aplicables a personas naturales con ingresos por LAB_HONORARIOS_*.
// El motor los descuenta del ingreso por honorarios ANTES de aplicar la cédula
// laboral. Cumplimiento: causalidad, necesidad y proporcionalidad (Art. 107 ET).
//
// Diseño profesional (no sólo lo que listó el contador):
//   - Salvaguarda fiscal: si el total deducido supera el 60% del honorario, el
//     motor sigue deduciendo (Art. 107 no impone tope %), pero la UI muestra
//     alerta amarilla. Sobre el 80%, alerta roja.
//   - Vehículo: solo UNO deducible (validación en UI). 50% conservador si no
//     se especifica uso profesional.
//   - Gastos de representación: tope 10% del ingreso bruto por honorarios.
export const GAS_HON_SEG_SOCIAL              = "GAS_HON_SEG_SOCIAL";              // Seguridad social del profesional independiente (100%)
export const GAS_HON_NOMINA_TERCEROS         = "GAS_HON_NOMINA_TERCEROS";         // Nómina/honorarios pagados a terceros (con retención)
export const GAS_HON_OFICINA                 = "GAS_HON_OFICINA";                 // Arriendo oficina/coworking
export const GAS_HON_SERVICIOS_OFICINA       = "GAS_HON_SERVICIOS_OFICINA";       // Servicios públicos del lugar de trabajo
export const GAS_HON_INTERNET_TELEFONIA      = "GAS_HON_INTERNET_TELEFONIA";      // Internet/telefonía profesional
export const GAS_HON_MATERIALES              = "GAS_HON_MATERIALES";              // Materiales y suministros profesionales
export const GAS_HON_VEHICULO                = "GAS_HON_VEHICULO";                // Vehículo (máx 1, proporcional uso profesional)
export const GAS_HON_VIAJES                  = "GAS_HON_VIAJES";                  // Viajes con relación documentada
export const GAS_HON_REPRESENTACION          = "GAS_HON_REPRESENTACION";          // Gastos representación (tope 10% honorarios brutos)
export const GAS_HON_CAPACITACION            = "GAS_HON_CAPACITACION";            // Capacitación con relación a la actividad
export const GAS_HON_OTROS                   = "GAS_HON_OTROS";                   // Otros gastos con causalidad documentada

// Jurídica
export const GAS_JUR_NOMINA                  = "GAS_JUR_NOMINA";
export const GAS_JUR_PARAFISCALES            = "GAS_JUR_PARAFISCALES";
export const GAS_JUR_HONORARIOS_PROF         = "GAS_JUR_HONORARIOS_PROF";
export const GAS_JUR_OPERATIVO               = "GAS_JUR_OPERATIVO";
export const GAS_JUR_PREDIAL                 = "GAS_JUR_PREDIAL";
export const GAS_JUR_DEPRECIACION            = "GAS_JUR_DEPRECIACION";
export const GAS_JUR_CAPACITACION            = "GAS_JUR_CAPACITACION";
export const GAS_JUR_NO_DEDUCIBLE            = "GAS_JUR_NO_DEDUCIBLE";

// Común (no se registra manualmente — calculado por el motor)
export const GAS_GMF                         = "GAS_GMF";

// ─── DEUDAS ───────────────────────────────────────────────────────────────

export const DEU_NAT_VIVIENDA_HABITACIONAL   = "DEU_NAT_VIVIENDA_HABITACIONAL";
export const DEU_NAT_INVERSION               = "DEU_NAT_INVERSION";
export const DEU_NAT_CONSUMO                 = "DEU_NAT_CONSUMO";
export const DEU_JUR_PRODUCTIVA              = "DEU_JUR_PRODUCTIVA";
export const DEU_JUR_NO_PRODUCTIVA           = "DEU_JUR_NO_PRODUCTIVA";

// ─── INVERSIONES ──────────────────────────────────────────────────────────

// Inmuebles
export const INV_INMUEBLE_HABITACIONAL       = "INV_INMUEBLE_HABITACIONAL";
export const INV_INMUEBLE_ARRENDADO          = "INV_INMUEBLE_ARRENDADO";
export const INV_INMUEBLE_COMERCIAL_PROPIO   = "INV_INMUEBLE_COMERCIAL_PROPIO";
export const INV_INMUEBLE_VACANTE            = "INV_INMUEBLE_VACANTE";

// Activos financieros
export const INV_CDT                         = "INV_CDT";
export const INV_FIC                         = "INV_FIC";
export const INV_ACCIONES                    = "INV_ACCIONES";
export const INV_BONOS                       = "INV_BONOS";
export const INV_CRYPTO                      = "INV_CRYPTO";

// Otros activos
export const INV_VEHICULO_PRODUCTIVO         = "INV_VEHICULO_PRODUCTIVO";
export const INV_VEHICULO_PERSONAL           = "INV_VEHICULO_PERSONAL";
export const INV_EQUIPO_PRODUCTIVO           = "INV_EQUIPO_PRODUCTIVO";

// ─── OWNERS ───────────────────────────────────────────────────────────────

export const OWN_NAT_RESIDENTE_ORDINARIO     = "OWN_NAT_RESIDENTE_ORDINARIO";
export const OWN_NAT_RESIDENTE_SIMPLE        = "OWN_NAT_RESIDENTE_SIMPLE";
export const OWN_NAT_NO_RESIDENTE            = "OWN_NAT_NO_RESIDENTE";
export const OWN_JUR_ORDINARIO               = "OWN_JUR_ORDINARIO";
export const OWN_JUR_SIMPLE                  = "OWN_JUR_SIMPLE";
export const OWN_JUR_ZONA_FRANCA             = "OWN_JUR_ZONA_FRANCA";
export const OWN_JUR_CHC                     = "OWN_JUR_CHC";
export const OWN_JUR_EXENTA                  = "OWN_JUR_EXENTA";

// ═════════════════════════════════════════════════════════════════════════
// METADATA — descripción humana + cédula + artículo ET por cada código
// ═════════════════════════════════════════════════════════════════════════

export const FISCAL_CODE_META = {
  // Laborales
  [LAB_SALARIO]:                  { kind: "ingreso", cedula: "trabajo",  label: "Salario CLT",                        et: "Art. 55, 206 #10, 383" },
  [LAB_HONORARIOS_CON_EMPLEADOS]: { kind: "ingreso", cedula: "trabajo",  label: "Honorarios con 2+ empleados",        et: "Art. 206 #10 (aplica exenta 25%)" },
  [LAB_HONORARIOS_SIN_EMPLEADOS]: { kind: "ingreso", cedula: "trabajo",  label: "Honorarios sin 2+ empleados",        et: "Art. 206 #10 (NO aplica exenta 25%)" },
  [LAB_PRESTACIONES_CESANTIAS]:   { kind: "ingreso", cedula: "trabajo",  label: "Cesantías + intereses",              et: "Art. 206 #4" },
  [LAB_PRESTACIONES_PRIMA]:       { kind: "ingreso", cedula: "trabajo",  label: "Prima legal",                        et: "Art. 206" },
  // Capital
  [CAP_INTERESES_BANCARIOS]:      { kind: "ingreso", cedula: "capital",  label: "Intereses bancarios / CDT",          et: "Art. 38 (componente inflacionario)" },
  [CAP_FIC]:                      { kind: "ingreso", cedula: "capital",  label: "Utilidad FIC",                       et: "Art. 39 (componente inflacionario)" },
  [CAP_RENDIMIENTO_GENERICO]:     { kind: "ingreso", cedula: "capital",  label: "Rendimiento financiero",             et: "Art. 38" },
  [CAP_REGALIAS_PI]:              { kind: "ingreso", cedula: "capital",  label: "Regalías propiedad intelectual",     et: "Art. 235-2" },
  [CAP_ARRIENDO_MUEBLE]:          { kind: "ingreso", cedula: "capital",  label: "Arriendo de muebles/equipos",        et: "Cédula capital" },
  [CAP_VENTA_ACTIVOS]:            { kind: "ingreso", cedula: "capital",  label: "Venta activos <2 años",              et: "Renta ordinaria" },
  // No laborales
  [NOL_ARRIENDO_INMUEBLE]:        { kind: "ingreso", cedula: "no_laboral", label: "Arriendo de inmueble",             et: "Art. 107 (gastos 100% deducibles)" },
  [NOL_HONORARIOS_INDEP]:         { kind: "ingreso", cedula: "no_laboral", label: "Honorarios independiente",         et: "Cédula no laboral" },
  [NOL_NEGOCIO]:                  { kind: "ingreso", cedula: "no_laboral", label: "Actividad económica propia",       et: "Comerciante natural" },
  [NOL_OTROS]:                    { kind: "ingreso", cedula: "no_laboral", label: "Otros ingresos",                   et: "Cédula no laboral" },
  // Dividendos
  [DIV_ART49_NO_GRAVADOS]:        { kind: "ingreso", cedula: "dividendos", label: "Dividendos Art. 49 no gravados",   et: "Art. 242, 0% hasta 300 UVT" },
  [DIV_ART49_GRAVADOS]:           { kind: "ingreso", cedula: "dividendos", label: "Dividendos Art. 49 gravados",      et: "Art. 242, 35% + tabla" },
  [DIV_EXTERIOR]:                 { kind: "ingreso", cedula: "dividendos", label: "Dividendos sociedad extranjera",   et: "Art. 254 (tax credit)" },
  [DIV_INTERSOCIETARIOS]:         { kind: "ingreso", cedula: "dividendos", label: "Dividendos inter-societarios",     et: "Art. 48 (no gravados)" },
  // Pensiones
  [PEN_JUBILACION]:               { kind: "ingreso", cedula: "pensiones",  label: "Pensión jubilación/invalidez",     et: "Art. 206 #5 (exenta hasta 1000 UVT/mes)" },
  // Ganancias ocasionales
  [GO_VENTA_ACTIVO_MAS_2A]:       { kind: "ingreso", cedula: "ganancia_ocasional", label: "Venta activo >2 años",     et: "Art. 300, 15%" },
  [GO_HERENCIA]:                  { kind: "ingreso", cedula: "ganancia_ocasional", label: "Herencia/donación",        et: "Art. 302, 15%" },
  [GO_LOTERIA]:                   { kind: "ingreso", cedula: "ganancia_ocasional", label: "Loterías/rifas",           et: "Art. 317, 20% retención" },

  // Gastos naturales
  [GAS_NAT_SALUD_MEDICINA]:       { kind: "gasto", scope: "natural", label: "Medicina prepagada",          et: "Art. 387 (tope 192 UVT)" },
  [GAS_NAT_DEPENDIENTES]:         { kind: "gasto", scope: "natural", label: "Evidencia dependientes",      et: "Art. 387 (10% lab, tope 384 UVT)" },
  [GAS_NAT_PERSONAL]:             { kind: "gasto", scope: "natural", label: "Personal (no deducible)",     et: "—" },
  [GAS_NAT_AHORRO]:               { kind: "gasto", scope: "natural", label: "Ahorro (no deducible)",       et: "—" },
  // Seguros (Commit B2)
  [SEG_SALUD]:                    { kind: "gasto", scope: "natural", label: "Seguro de salud",            et: "Art. 387 #2 (tope 16 UVT/mes)" },
  [SEG_VIDA]:                     { kind: "gasto", scope: "natural", label: "Seguro de vida",             et: "Art. 387 #2 (tope 16 UVT/mes)" },
  [SEG_VEHICULO]:                 { kind: "gasto", scope: "natural", label: "Seguro de vehículo",         et: "NO deducible natural" },
  [SEG_HOGAR]:                    { kind: "gasto", scope: "natural", label: "Seguro de hogar",            et: "NO deducible natural" },
  [SEG_GENERICO]:                 { kind: "gasto", scope: "natural", label: "Seguro sin clasificar",      et: "NO deducible (especificá tipo)" },
  // Commit 15 Tarea 3: impuesto vehicular (rodamiento)
  [IMP_VEHICULAR_PERSONAL]:       { kind: "gasto", scope: "natural", label: "Impuesto vehicular (personal)", et: "NO deducible natural" },
  [IMP_VEHICULAR_PROFESIONAL]:    { kind: "gasto", scope: "honorarios", label: "Impuesto vehicular (profesional)", et: "Art. 107 (50% conservador)" },
  // Gastos inmueble arrendado
  [GAS_INMUEBLE_PREDIAL]:         { kind: "gasto", scope: "inmueble", label: "Predial inmueble arrendado", et: "Art. 107" },
  [GAS_INMUEBLE_MANTENIMIENTO]:   { kind: "gasto", scope: "inmueble", label: "Mantenimiento inmueble",     et: "Art. 107" },
  [GAS_INMUEBLE_ADMINISTRACION]:  { kind: "gasto", scope: "inmueble", label: "Admón edificio",             et: "Art. 107" },
  [GAS_INMUEBLE_SERVICIOS]:       { kind: "gasto", scope: "inmueble", label: "Servicios del inmueble",     et: "Art. 107" },
  [GAS_INMUEBLE_SEGUROS]:         { kind: "gasto", scope: "inmueble", label: "Seguros del inmueble",       et: "Art. 107" },
  [GAS_INMUEBLE_DEPRECIACION]:    { kind: "gasto", scope: "inmueble", label: "Depreciación construcción",  et: "Art. 137 (si lleva contabilidad)" },
  // Gastos deducibles de honorarios (actividad independiente, Art. 107 ET)
  [GAS_HON_SEG_SOCIAL]:           { kind: "gasto", scope: "honorarios", label: "Seguridad social independiente", et: "Art. 126-1 (100%)" },
  [GAS_HON_NOMINA_TERCEROS]:      { kind: "gasto", scope: "honorarios", label: "Nómina/honorarios a terceros",   et: "Art. 107 (con retención practicada)" },
  [GAS_HON_OFICINA]:              { kind: "gasto", scope: "honorarios", label: "Arriendo oficina/coworking",     et: "Art. 107" },
  [GAS_HON_SERVICIOS_OFICINA]:    { kind: "gasto", scope: "honorarios", label: "Servicios públicos oficina",     et: "Art. 107" },
  [GAS_HON_INTERNET_TELEFONIA]:   { kind: "gasto", scope: "honorarios", label: "Internet/telefonía profesional", et: "Art. 107" },
  [GAS_HON_MATERIALES]:           { kind: "gasto", scope: "honorarios", label: "Materiales y suministros",       et: "Art. 107" },
  [GAS_HON_VEHICULO]:             { kind: "gasto", scope: "honorarios", label: "Vehículo (1 máx, prop. uso)",    et: "Art. 107 (50% conservador)" },
  [GAS_HON_VIAJES]:               { kind: "gasto", scope: "honorarios", label: "Viajes con propósito",           et: "Art. 107 (documentados)" },
  [GAS_HON_REPRESENTACION]:       { kind: "gasto", scope: "honorarios", label: "Gastos de representación",       et: "Art. 107-1 (tope 10% honorarios)" },
  [GAS_HON_CAPACITACION]:         { kind: "gasto", scope: "honorarios", label: "Capacitación profesional",       et: "Art. 107" },
  [GAS_HON_OTROS]:                { kind: "gasto", scope: "honorarios", label: "Otros con causalidad",           et: "Art. 107 (causalidad documentada)" },
  // Gastos jurídica
  [GAS_JUR_NOMINA]:               { kind: "gasto", scope: "juridica", label: "Nómina + prestaciones",      et: "Art. 107" },
  [GAS_JUR_PARAFISCALES]:         { kind: "gasto", scope: "juridica", label: "Parafiscales",               et: "Art. 108" },
  [GAS_JUR_HONORARIOS_PROF]:      { kind: "gasto", scope: "juridica", label: "Honorarios profesionales",   et: "Art. 107" },
  [GAS_JUR_OPERATIVO]:            { kind: "gasto", scope: "juridica", label: "Gastos operativos",          et: "Art. 107" },
  [GAS_JUR_PREDIAL]:              { kind: "gasto", scope: "juridica", label: "Predial inmueble productor", et: "Art. 115 (50% descuento)" },
  [GAS_JUR_DEPRECIACION]:         { kind: "gasto", scope: "juridica", label: "Depreciación fiscal",        et: "Art. 128-141" },
  [GAS_JUR_CAPACITACION]:         { kind: "gasto", scope: "juridica", label: "Capacitación empleados",     et: "Art. 107" },
  [GAS_JUR_NO_DEDUCIBLE]:         { kind: "gasto", scope: "juridica", label: "No deducible",               et: "—" },
  [GAS_GMF]:                      { kind: "gasto", scope: "ambos",    label: "GMF 4×1000",                 et: "Art. 115 (50% deducible)" },

  // Deudas
  [DEU_NAT_VIVIENDA_HABITACIONAL]: { kind: "deuda", scope: "natural",  label: "Vivienda habitacional",     et: "Art. 119 (intereses hasta 1200 UVT)" },
  [DEU_NAT_INVERSION]:             { kind: "deuda", scope: "natural",  label: "Para inversión",             et: "Intereses deducibles renta capital/no laboral" },
  [DEU_NAT_CONSUMO]:               { kind: "deuda", scope: "natural",  label: "Consumo personal",           et: "Intereses NO deducibles" },
  [DEU_JUR_PRODUCTIVA]:            { kind: "deuda", scope: "juridica", label: "Productiva",                 et: "Art. 117, 118-1 (sub-capitalización)" },
  [DEU_JUR_NO_PRODUCTIVA]:         { kind: "deuda", scope: "juridica", label: "No productiva",              et: "Intereses NO deducibles" },

  // Inversiones
  [INV_INMUEBLE_HABITACIONAL]:     { kind: "inversion", deprecia: false, label: "Inmueble habitacional propio", et: "No depreciable" },
  [INV_INMUEBLE_ARRENDADO]:        { kind: "inversion", deprecia: true,  label: "Inmueble arrendado",           et: "Art. 137 (2.22%/año construcción)" },
  [INV_INMUEBLE_COMERCIAL_PROPIO]: { kind: "inversion", deprecia: true,  label: "Inmueble comercial propio",    et: "Art. 137" },
  [INV_INMUEBLE_VACANTE]:          { kind: "inversion", deprecia: false, label: "Inmueble vacante",             et: "Sin uso productivo" },
  [INV_CDT]:                       { kind: "inversion", deprecia: false, label: "CDT",                          et: "Genera CAP_INTERESES_BANCARIOS" },
  [INV_FIC]:                       { kind: "inversion", deprecia: false, label: "Fondo inversión colectiva",    et: "Genera CAP_FIC" },
  [INV_ACCIONES]:                  { kind: "inversion", deprecia: false, label: "Acciones",                     et: "Dividendos / GO venta >2a" },
  [INV_BONOS]:                     { kind: "inversion", deprecia: false, label: "Bonos / renta fija",           et: "Genera CAP_INTERESES_BANCARIOS" },
  [INV_CRYPTO]:                    { kind: "inversion", deprecia: false, label: "Criptomonedas",                et: "GO al realizar" },
  [INV_VEHICULO_PRODUCTIVO]:       { kind: "inversion", deprecia: true,  label: "Vehículo productivo",          et: "Art. 137 (20%/año)" },
  [INV_VEHICULO_PERSONAL]:         { kind: "inversion", deprecia: false, label: "Vehículo personal",            et: "Solo patrimonio" },
  [INV_EQUIPO_PRODUCTIVO]:         { kind: "inversion", deprecia: true,  label: "Maquinaria / equipos",         et: "Art. 137 (según tipo)" },

  // Owners
  [OWN_NAT_RESIDENTE_ORDINARIO]:   { kind: "owner", type: "natural",   regimen: "ordinario",  label: "Natural residente ordinario" },
  [OWN_NAT_RESIDENTE_SIMPLE]:      { kind: "owner", type: "natural",   regimen: "simple",     label: "Natural residente Simple" },
  [OWN_NAT_NO_RESIDENTE]:          { kind: "owner", type: "natural",   regimen: "ordinario",  label: "Natural no residente" },
  [OWN_JUR_ORDINARIO]:             { kind: "owner", type: "juridica",  regimen: "ordinario",  label: "Jurídica ordinario 35%" },
  [OWN_JUR_SIMPLE]:                { kind: "owner", type: "juridica",  regimen: "simple",     label: "Jurídica Simple (RST)" },
  [OWN_JUR_ZONA_FRANCA]:           { kind: "owner", type: "juridica",  regimen: "zona_franca",label: "Zona Franca 20%" },
  [OWN_JUR_CHC]:                   { kind: "owner", type: "juridica",  regimen: "chc",        label: "Compañía Holding Colombiana" },
  [OWN_JUR_EXENTA]:                { kind: "owner", type: "juridica",  regimen: "exenta",     label: "Economía naranja / exenta" },
};

// ═════════════════════════════════════════════════════════════════════════
// Grupos (para queries rápidas)
// ═════════════════════════════════════════════════════════════════════════

export const INGRESOS_LABORALES = [LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS, LAB_PRESTACIONES_CESANTIAS, LAB_PRESTACIONES_PRIMA];
export const INGRESOS_CAPITAL   = [CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO, CAP_REGALIAS_PI, CAP_ARRIENDO_MUEBLE, CAP_VENTA_ACTIVOS];
export const INGRESOS_NO_LABORAL = [NOL_ARRIENDO_INMUEBLE, NOL_HONORARIOS_INDEP, NOL_NEGOCIO, NOL_OTROS];
export const INGRESOS_DIVIDENDOS = [DIV_ART49_NO_GRAVADOS, DIV_ART49_GRAVADOS, DIV_EXTERIOR, DIV_INTERSOCIETARIOS];
export const INGRESOS_APLICA_COMPONENTE_INFLACIONARIO = [CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO];
export const GASTOS_INMUEBLE_ARRENDADO = [GAS_INMUEBLE_PREDIAL, GAS_INMUEBLE_MANTENIMIENTO, GAS_INMUEBLE_ADMINISTRACION, GAS_INMUEBLE_SERVICIOS, GAS_INMUEBLE_SEGUROS, GAS_INMUEBLE_DEPRECIACION];
export const GASTOS_HONORARIOS = [GAS_HON_SEG_SOCIAL, GAS_HON_NOMINA_TERCEROS, GAS_HON_OFICINA, GAS_HON_SERVICIOS_OFICINA, GAS_HON_INTERNET_TELEFONIA, GAS_HON_MATERIALES, GAS_HON_VEHICULO, GAS_HON_VIAJES, GAS_HON_REPRESENTACION, GAS_HON_CAPACITACION, GAS_HON_OTROS];
// Commit B2: seguros que entran al tope 16 UVT/mes (Art. 387 #2 ET) junto con
// medicina prepagada y gastos médicos tradicionales. Para persona natural.
export const SEGUROS_DEDUCIBLES_NATURAL = [SEG_SALUD, SEG_VIDA];
// Seguros que NO son deducibles para persona natural (vehículo, hogar, sin clasificar)
export const SEGUROS_NO_DEDUCIBLES_NATURAL = [SEG_VEHICULO, SEG_HOGAR, SEG_GENERICO];
export const INVERSIONES_DEPRECIABLES = Object.entries(FISCAL_CODE_META).filter(([,m]) => m.kind === "inversion" && m.deprecia).map(([k]) => k);
