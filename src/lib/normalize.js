// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · Normalizador de data tributaria
// ─────────────────────────────────────────────────────────────────────────
// Toma un user object (puede tener items legacy sin fiscalCode) y devuelve:
//   { data, warnings }
// - data:     user con fiscalCode asignado a todos los items (por inferencia
//             si el item no lo traía).
// - warnings: array de observaciones para que el usuario las revise.
//
// PRINCIPIO: la inferencia es conservadora — cuando hay ambigüedad, se
// asume el tratamiento que minimiza el beneficio fiscal. Así nunca sobre-
// beneficiamos silenciosamente.
// ═════════════════════════════════════════════════════════════════════════

import {
  // Ingresos
  LAB_SALARIO, LAB_HONORARIOS_CON_EMPLEADOS, LAB_HONORARIOS_SIN_EMPLEADOS,
  LAB_PRESTACIONES_CESANTIAS, LAB_PRESTACIONES_PRIMA,
  CAP_INTERESES_BANCARIOS, CAP_FIC, CAP_RENDIMIENTO_GENERICO, CAP_VENTA_ACTIVOS,
  NOL_ARRIENDO_INMUEBLE, NOL_HONORARIOS_INDEP, NOL_OTROS,
  DIV_ART49_GRAVADOS, DIV_INTERSOCIETARIOS,
  PEN_JUBILACION,
  // Gastos
  GAS_NAT_SALUD_MEDICINA, GAS_NAT_PERSONAL, GAS_NAT_AHORRO,
  GAS_INMUEBLE_PREDIAL, GAS_INMUEBLE_MANTENIMIENTO, GAS_INMUEBLE_ADMINISTRACION,
  GAS_INMUEBLE_SERVICIOS, GAS_INMUEBLE_SEGUROS, GAS_INMUEBLE_DEPRECIACION,
  GAS_JUR_NOMINA, GAS_JUR_HONORARIOS_PROF, GAS_JUR_OPERATIVO, GAS_JUR_PREDIAL,
  GAS_JUR_DEPRECIACION, GAS_JUR_CAPACITACION, GAS_JUR_NO_DEDUCIBLE,
  // Deudas
  DEU_NAT_VIVIENDA_HABITACIONAL, DEU_NAT_INVERSION, DEU_NAT_CONSUMO,
  DEU_JUR_PRODUCTIVA, DEU_JUR_NO_PRODUCTIVA,
  // Inversiones
  INV_INMUEBLE_HABITACIONAL, INV_INMUEBLE_ARRENDADO, INV_INMUEBLE_COMERCIAL_PROPIO,
  INV_CDT, INV_FIC, INV_ACCIONES, INV_BONOS, INV_CRYPTO,
  INV_VEHICULO_PRODUCTIVO, INV_VEHICULO_PERSONAL, INV_EQUIPO_PRODUCTIVO,
  // Owners
  OWN_NAT_RESIDENTE_ORDINARIO, OWN_NAT_RESIDENTE_SIMPLE,
  OWN_JUR_ORDINARIO, OWN_JUR_SIMPLE, OWN_JUR_ZONA_FRANCA, OWN_JUR_CHC, OWN_JUR_EXENTA,
} from "./fiscalCodes.js";

// ─── Severity helpers ─────────────────────────────────────────────────────

const mkWarning = (opts) => ({ severity: "warning", ...opts });
const mkInfo    = (opts) => ({ severity: "info",    ...opts });
const mkError   = (opts) => ({ severity: "error",   ...opts });

// ═════════════════════════════════════════════════════════════════════════
// inferFiscalCode — infiere el fiscalCode de un item legacy
// Reglas 100% alineadas con la lógica regex actual de taxCO.js para que
// la migración sea invisible (mismos números antes y después).
// ═════════════════════════════════════════════════════════════════════════

export function inferIngresoFiscalCode(ing, owner) {
  if (ing.fiscalCode) return ing.fiscalCode;
  const cat = ing.categoria || "";
  const isJ = owner && owner.type === "juridica";

  if (cat === "Salario") return LAB_SALARIO;
  if (/Honorarios|Freelance/i.test(cat)) {
    // Conservador: sin data del régimen del honorario, NO asumimos exenta 25%.
    // El usuario puede configurar regimenHonorarios en el owner (Sprint 2).
    if (owner && owner.regimenHonorarios === "con_empleados") return LAB_HONORARIOS_CON_EMPLEADOS;
    return LAB_HONORARIOS_SIN_EMPLEADOS;
  }
  if (/Intereses bancarios|CDT/i.test(cat)) return CAP_INTERESES_BANCARIOS;
  if (/Utilidad FIC|FIC/i.test(cat)) return CAP_FIC;
  if (/Rendimiento/i.test(cat)) return CAP_RENDIMIENTO_GENERICO;
  if (/Inversión/i.test(cat)) return CAP_VENTA_ACTIVOS;
  if (/Arriendo/i.test(cat)) return NOL_ARRIENDO_INMUEBLE;
  if (/Dividendos/i.test(cat)) return isJ ? DIV_INTERSOCIETARIOS : DIV_ART49_GRAVADOS;
  if (/Pensión/i.test(cat)) return PEN_JUBILACION;
  return NOL_OTROS;
}

export function inferGastoFiscalCode(gas, owner) {
  if (gas.fiscalCode) return gas.fiscalCode;
  const cat = gas.cat || gas.categoria || "";
  const isJ = owner && owner.type === "juridica";

  // Depreciación siempre es explícita
  if (/Depreciación|Depreciacion|Depreciation/i.test(cat)) {
    return isJ ? GAS_JUR_DEPRECIACION : GAS_INMUEBLE_DEPRECIACION;
  }

  if (isJ) {
    if (/Nómina|Nomina/i.test(cat)) return GAS_JUR_NOMINA;
    if (/Honorarios/i.test(cat)) return GAS_JUR_HONORARIOS_PROF;
    if (/Predial/i.test(cat)) return GAS_JUR_PREDIAL;
    if (/Educación|Educacion|Capacitación|Capacitacion/i.test(cat)) return GAS_JUR_CAPACITACION;
    // Default jurídica: operativo (deducible)
    if (["Vivienda", "Servicios", "Mantenimiento", "Seguros", "Transporte", "Arrendamiento", "Representación", "Tecnología", "Seguridad Social"].includes(cat)) {
      return GAS_JUR_OPERATIVO;
    }
    if (["Alimentación", "Entretenimiento", "Personal", "Vestimenta", "Mascotas", "Deporte", "Ahorro"].includes(cat)) {
      return GAS_JUR_NO_DEDUCIBLE;
    }
    return GAS_JUR_OPERATIVO; // fallback conservador
  } else {
    // Natural
    if (/Salud/i.test(cat)) return GAS_NAT_SALUD_MEDICINA;
    if (/Predial/i.test(cat)) return GAS_INMUEBLE_PREDIAL;
    if (/Mantenimiento/i.test(cat)) return GAS_INMUEBLE_MANTENIMIENTO;
    if (/Vivienda|Arrendamiento/i.test(cat)) return GAS_INMUEBLE_ADMINISTRACION;
    if (/Servicios/i.test(cat)) return GAS_INMUEBLE_SERVICIOS;
    if (/Seguros/i.test(cat)) return GAS_INMUEBLE_SEGUROS;
    if (/Ahorro/i.test(cat)) return GAS_NAT_AHORRO;
    // Default natural: gasto personal no deducible
    return GAS_NAT_PERSONAL;
  }
}

export function inferDeudaFiscalCode(deu, owner) {
  if (deu.fiscalCode) return deu.fiscalCode;
  const tp = (deu.tp || "").toLowerCase();
  const nm = (deu.n || "").toLowerCase();
  const combined = tp + " " + nm;
  const isJ = owner && owner.type === "juridica";

  if (/mortgage|hipoteca|vivienda|casa|apto/i.test(combined)) {
    return isJ ? DEU_JUR_PRODUCTIVA : DEU_NAT_VIVIENDA_HABITACIONAL;
  }
  if (/credit_card|tarjeta/i.test(combined)) {
    return isJ ? DEU_JUR_NO_PRODUCTIVA : DEU_NAT_CONSUMO;
  }
  if (isJ) return DEU_JUR_PRODUCTIVA;
  // Natural sin match claro: consumo (conservador, intereses NO deducibles)
  return DEU_NAT_CONSUMO;
}

export function inferInversionFiscalCode(inv, owner, allIngresos) {
  if (inv.fiscalCode) return inv.fiscalCode;
  const tp = (inv.tp || inv.tipo || "").toLowerCase();
  const isJ = owner && owner.type === "juridica";

  if (/real estate|bodega|local|oficina/i.test(tp)) {
    // Si hay ingresos de arriendo del mismo owner → arrendado
    const tieneArriendo = (allIngresos || []).some(i =>
      i.owner === (inv.owner) && /Arriendo/i.test(i.categoria || "")
    );
    if (tieneArriendo) return INV_INMUEBLE_ARRENDADO;
    if (isJ) return INV_INMUEBLE_COMERCIAL_PROPIO;
    return INV_INMUEBLE_HABITACIONAL; // conservador: no deprecia
  }
  if (/cdt/i.test(tp)) return INV_CDT;
  if (/fic|fondo/i.test(tp)) return INV_FIC;
  if (/accion/i.test(tp)) return INV_ACCIONES;
  if (/bono/i.test(tp)) return INV_BONOS;
  if (/crypto|bitcoin/i.test(tp)) return INV_CRYPTO;
  if (/vehículo|vehiculo/i.test(tp)) {
    return isJ ? INV_VEHICULO_PRODUCTIVO : INV_VEHICULO_PERSONAL;
  }
  if (/equipo|maquinaria/i.test(tp)) return INV_EQUIPO_PRODUCTIVO;
  return INV_INMUEBLE_HABITACIONAL; // fallback más conservador (no deprecia)
}

export function inferOwnerFiscalCode(ow) {
  if (ow.fiscalCode) return ow.fiscalCode;
  const regimen = ow.regimen || "ordinario";
  if (ow.type === "juridica") {
    if (regimen === "simple") return OWN_JUR_SIMPLE;
    if (regimen === "zona_franca") return OWN_JUR_ZONA_FRANCA;
    if (regimen === "chc") return OWN_JUR_CHC;
    if (regimen === "exenta") return OWN_JUR_EXENTA;
    return OWN_JUR_ORDINARIO;
  }
  if (regimen === "simple") return OWN_NAT_RESIDENTE_SIMPLE;
  return OWN_NAT_RESIDENTE_ORDINARIO;
}

// ═════════════════════════════════════════════════════════════════════════
// normalizeFiscalData — mutación funcional: devuelve nuevo user con
// fiscalCode asignado a todos los items + array de warnings.
// ═════════════════════════════════════════════════════════════════════════

export function normalizeFiscalData(user) {
  if (!user) return { data: null, warnings: [] };
  const warnings = [];
  const owners = user.owners || [];
  const ownerById = Object.fromEntries(owners.map(o => [o.id, o]));

  // Owners
  const normOwners = owners.map(ow => ({ ...ow, fiscalCode: inferOwnerFiscalCode(ow) }));

  // Ingresos
  const allIngresos = user.ingresos || [];
  const normIngresos = allIngresos.map(ing => {
    const owner = ownerById[ing.owner];
    const fiscalCode = inferIngresoFiscalCode(ing, owner);
    // Campos comunes para enriquecer cualquier warning de este item:
    const ctx = {
      itemType: "ingreso",
      itemId: ing.id,
      ownerId: ing.owner,
      itemConcepto: ing.concepto || ing.categoria || "Ingreso",
      itemCategoria: ing.categoria || "",
      itemMonto: ing.mensual || 0,
      itemMoneda: ing.moneda || "COP",
      itemOwnerName: owner ? owner.name : null,
      fiscalCodeSugerido: fiscalCode,
    };
    if (!ing.fiscalCode) {
      // Warnings contextuales
      if (/Honorarios|Freelance/i.test(ing.categoria || "") && owner && !owner.regimenHonorarios) {
        warnings.push(mkWarning({
          ...ctx,
          code: "HONORARIOS_SIN_REGIMEN_DECLARADO",
          message: `Honorarios de "${owner.name}" no indican si tiene 2+ empleados — afecta exenta 25% (Art. 206 #10)`,
          accionSugerida: "Editá el owner y seleccioná 'con empleados' o 'sin empleados'",
          articuloET: "Art. 206 #10",
        }));
      }
      if (/Arriendo/i.test(ing.categoria || "")) {
        warnings.push(mkInfo({
          ...ctx,
          code: "ARRIENDO_INFERIDO_INMUEBLE",
          message: "Asumí que es arriendo de inmueble. Si es arriendo de equipos/muebles, cambiá el código fiscal",
          articuloET: "—",
        }));
      }
      if (/Dividendos/i.test(ing.categoria || "")) {
        warnings.push(mkInfo({
          ...ctx,
          code: "DIVIDENDOS_INFERIDOS_GRAVADOS",
          message: owner && owner.type === "juridica"
            ? "Asumí dividendos inter-societarios (Art. 48, no gravados)"
            : "Asumí dividendos Art. 49 parte gravada. Si son de sociedad extranjera o no gravados, ajustá",
          articuloET: "Art. 48 / 49 / 242",
        }));
      }
    }
    return { ...ing, fiscalCode };
  });

  // Gastos (estructura anidada: { cat: [items...] })
  const gasRaw = user.gas || {};
  const normGas = {};
  Object.entries(gasRaw).forEach(([cat, items]) => {
    normGas[cat] = (items || []).map((g, idx) => {
      const owner = ownerById[g.owner];
      const gWithCat = { ...g, cat: g.cat || cat };
      const fiscalCode = inferGastoFiscalCode(gWithCat, owner);
      if (!g.fiscalCode && owner && owner.type === "juridica") {
        if (["Educación", "Educacion", "Vivienda", "Alimentación"].includes(cat)) {
          warnings.push(mkWarning({
            itemType: "gasto",
            itemId: g.id,
            itemGastoCat: cat,   // para identificar sin id
            itemGastoIdx: idx,   // posición dentro de la categoría
            ownerId: g.owner,
            itemConcepto: g.c || cat,
            itemCategoria: cat,
            itemMonto: g.m || 0,
            itemOwnerName: owner ? owner.name : null,
            fiscalCodeSugerido: fiscalCode,
            code: "GASTO_JURIDICA_CAUSALIDAD_AMBIGUA",
            message: `Gasto "${cat}" en persona jurídica se asumió deducible. Art. 107 ET exige causalidad con actividad productora de renta — revisá con contador`,
            accionSugerida: "Aprobá si es operativo/capacitación, o editá y marcá como no deducible si es personal",
            articuloET: "Art. 107",
          }));
        }
      }
      return { ...gWithCat, fiscalCode };
    });
  });

  // Deudas
  const normDeu = (user.deu || []).map(d => {
    const owner = ownerById[d.owner];
    return { ...d, fiscalCode: inferDeudaFiscalCode(d, owner) };
  });

  // Inversiones
  const normInv = (user.inv || []).map(i => {
    const owner = ownerById[i.owner];
    return { ...i, fiscalCode: inferInversionFiscalCode(i, owner, allIngresos) };
  });

  // Ingresos sin propietario
  const sinOwner = normIngresos.filter(i => !i.owner || i.owner === "");
  if (sinOwner.length > 0) {
    warnings.push(mkError({
      itemType: "ingreso",
      code: "INGRESO_SIN_PROPIETARIO",
      message: `${sinOwner.length} ingreso(s) sin propietario asignado — no se incluyen en el cálculo`,
      accionSugerida: "Asigná propietario en el módulo de Ingresos",
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Warning: owner jurídica que tiene descuentos tributarios declarados
  // el año anterior pero NO los capturó este año en descuentosTributarios.
  // Los descuentos CTI, empleo, exterior, donaciones son directo del
  // impuesto (no de la base), así que olvidarlos cuesta el 100% del monto.
  // ─────────────────────────────────────────────────────────────────────
  normOwners.forEach(ow => {
    if (ow.type !== "juridica") return;
    const da = ow.declaracionAnterior;
    if (!da || da.tipo !== "F110") return;
    const r = da.renglones || {};
    const tuvoDescuentos = (+r.descICA || 0) + (+r.descCree || 0) + (+r.descDonaciones || 0) + (+r.descCTI || 0);
    if (tuvoDescuentos < 1_000_000) return;
    const descActual = ow.descuentosTributarios || {};
    const totalActual = (+descActual.cti || 0) + (+descActual.empleo || 0) + (+descActual.exterior || 0) + (+descActual.donaciones || 0) + (+descActual.otros || 0);
    if (totalActual >= tuvoDescuentos * 0.3) return; // Ya capturó al menos 30% de lo del año pasado
    warnings.push({
      severity: "warning",
      itemId: ow.id,
      itemType: "owner",
      ownerName: ow.name,
      code: "DESCUENTOS_AÑO_ANTERIOR_NO_CAPTURADOS",
      message: `${ow.name} tuvo ~$${Math.round(tuvoDescuentos / 1e6)}M en descuentos tributarios en ${da.anoGravable} y este año solo $${Math.round(totalActual / 1e6)}M`,
      accionSugerida: "Si la empresa sigue teniendo las mismas actividades (ICA, donaciones, CTI), los descuentos se siguen aplicando. Capturá los valores actuales en el perfil del owner.",
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Warning: owner natural que aporta a pensión voluntaria según la
  // declaración del año anterior, pero no capturó owner.aportes este año.
  // Sin captura, el motor asume 0 aportes voluntarios y no aplica la
  // deducción correspondiente — costo típico ~$1M-$5M en impuesto anual.
  // ─────────────────────────────────────────────────────────────────────
  normOwners.forEach(ow => {
    if (ow.type !== "natural") return;
    const da = ow.declaracionAnterior;
    if (!da || da.tipo !== "F210") return;
    const r = da.renglones || {};
    const tuvoPVAFC = +r.pvAFC || 0;
    if (tuvoPVAFC < 1_000_000) return;
    const apt = ow.aportes || {};
    const tienePVCapturada = (+apt.pensionVoluntariaMensual || 0) > 0;
    if (tienePVCapturada) return;
    warnings.push({
      severity: "warning",
      itemId: ow.id,
      itemType: "owner",
      ownerName: ow.name,
      code: "APORTES_VOLUNTARIOS_NO_CAPTURADOS",
      message: `${ow.name} declaró ~$${Math.round(tuvoPVAFC / 1e6)}M en pensión voluntaria + AFC en ${da.anoGravable} pero no hay aportes capturados este año`,
      accionSugerida: "Si seguís aportando a PV/AFC, capturalos en el perfil del owner. Son deducibles dentro del tope 40%/1340 UVT — olvidarlos puede costar varios millones en impuesto.",
    });
  });

  const data = {
    ...user,
    owners: normOwners,
    ingresos: normIngresos,
    gas: normGas,
    deu: normDeu,
    inv: normInv,
  };

  return { data, warnings };
}

// ═════════════════════════════════════════════════════════════════════════
// getFiscalWarnings — API pública para que la UI consulte warnings.
// ═════════════════════════════════════════════════════════════════════════

export function getFiscalWarnings(user) {
  return normalizeFiscalData(user).warnings;
}
