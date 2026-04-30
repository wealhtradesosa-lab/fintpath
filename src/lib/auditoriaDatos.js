// ═══════════════════════════════════════════════════════════════════════════
// FINPATHIA · auditoriaDatos.js
//
// PROPÓSITO:
//   Motor que actúa como un contador con +20 años de experiencia auditando
//   la calidad y completitud de los datos cargados por el user. Complementa
//   a recomendaciones.js (que busca palancas fiscales) detectando:
//
//   1. DATOS HUÉRFANOS: items sin owner asignado, sin fiscalCode, etc.
//   2. INCONSISTENCIAS: mezclas de moneda, deudas sin tasa, etc.
//   3. POSIBLES ERRORES: salario sin aportes, montos sospechosos, etc.
//   4. DATOS FALTANTES: cosas críticas que el user debería tener cargadas.
//
//   Cada hallazgo viene con:
//   - severidad: "error" | "warning" | "info"
//   - mensaje: texto humano explicando el problema
//   - sugerencia: qué hacer para resolverlo
//   - accion: { tipo, payload } — para que el UI ofrezca un botón "Resolver"
//
// FILOSOFÍA:
//   - Como un contador real: detecta lo que un humano no ve a primera vista
//   - Mensajes en lenguaje humano (no jerga técnica)
//   - Cada problema tiene UNA acción concreta para resolverlo
//   - Severidad clara: lo grave en rojo, lo recomendable en naranja
//   - No abrumar: limit razonable de hallazgos por categoría
//
// USO:
//   const hallazgos = auditarDatos(user);
//   hallazgos.errores.forEach(h => mostrarBanner(h));
// ═══════════════════════════════════════════════════════════════════════════

const UVT_2026 = 52374;
const SMMLV_2026 = 1750905;

/**
 * Audita los datos del user y devuelve hallazgos categorizados.
 *
 * @param {object} user - User completo con owners, ingresos, gas, deu, inv, trm
 * @param {object} options - { dismissed: Array<string> } IDs de hallazgos ignorados
 * @returns {object} { errores, advertencias, oportunidadesData, faltantes, ignorados, total }
 */
export function auditarDatos(user, options = {}) {
  if (!user) return vacio();

  const dismissed = new Set(options.dismissed || user.auditDismissed || []);

  const errores = [];
  const advertencias = [];
  const oportunidadesData = [];
  const faltantes = [];
  const ignorados = [];

  const owners = user.owners || [];
  const ingresos = user.ingresos || [];
  const gastos = user.gas || {};
  const deudas = user.deu || [];
  const inversiones = user.inv || [];

  // ── Helper: solo items "encendidos" (sim !== false) y NO marcados como
  // excluirDeclaracion=true. Items con excluirDeclaracion son decisiones
  // conscientes del user (ej: inversiones del exterior que tributan en
  // otra jurisdicción). El auditor NO los considera huérfanos ni los
  // procesa como problemas.
  const activos = {
    ingresos: ingresos.filter(i => i.sim !== false && !i.excluirDeclaracion),
    deudas: deudas.filter(d => d.sim !== false && !d.excluirDeclaracion),
    inversiones: inversiones.filter(i => i.sim !== false && !i.excluirDeclaracion),
    gastos: Object.entries(gastos).reduce((acc, [cat, items]) => {
      acc[cat] = (items || []).filter(g => g.sim !== false && !g.excluirDeclaracion);
      return acc;
    }, {}),
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CATEGORÍA 1: DATOS HUÉRFANOS (items sin owner asignado)
  // ═══════════════════════════════════════════════════════════════════════

  if (owners.length > 0) {
    const ownerIds = new Set(owners.map(o => o.id));

    // Ingresos sin owner válido
    const ingHuerfanos = activos.ingresos.filter(i => !i.owner || !ownerIds.has(i.owner));
    if (ingHuerfanos.length > 0) {
      errores.push({
        id: "huerfano_ingresos",
        severidad: "error",
        categoria: "huerfanos",
        titulo: `${ingHuerfanos.length} ingreso${ingHuerfanos.length > 1 ? "s" : ""} sin titular fiscal`,
        mensaje: `Tenés ingresos cargados que no están asociados a ninguna persona fiscal. Esto causa que NO entren en el cálculo del impuesto.`,
        sugerencia: `Asigná cada ingreso a una persona natural o jurídica.`,
        items: ingHuerfanos.map(i => ({ id: i.id, label: i.categoria || i.fiscalCode, mensual: i.mensual })),
        accion: { tipo: "asignar_owner_ingresos", ids: ingHuerfanos.map(i => i.id) },
      });
    }

    // Deudas sin owner válido
    const deuHuerfanas = activos.deudas.filter(d => !d.owner || !ownerIds.has(d.owner));
    if (deuHuerfanas.length > 0) {
      advertencias.push({
        id: "huerfano_deudas",
        severidad: "warning",
        categoria: "huerfanos",
        titulo: `${deuHuerfanas.length} deuda${deuHuerfanas.length > 1 ? "s" : ""} sin titular fiscal`,
        mensaje: `Estas deudas no están asignadas a ninguna persona fiscal. Sus intereses NO se pueden deducir hasta que las asignes.`,
        sugerencia: `Asignalas a la persona natural o jurídica correspondiente.`,
        items: deuHuerfanas.map(d => ({ id: d.id, label: d.nombre || d.fiscalCode, monto: d.mt })),
        accion: { tipo: "asignar_owner_deudas", ids: deuHuerfanas.map(d => d.id) },
      });
    }

    // Inversiones sin owner válido
    const invHuerfanas = activos.inversiones.filter(i => !i.owner || !ownerIds.has(i.owner));
    if (invHuerfanas.length > 0) {
      advertencias.push({
        id: "huerfano_inversiones",
        severidad: "warning",
        categoria: "huerfanos",
        titulo: `${invHuerfanas.length} inversión${invHuerfanas.length > 1 ? "es" : ""} sin titular fiscal`,
        mensaje: `Estos activos no están asignados a una persona fiscal. NO suman al patrimonio bruto declarado.`,
        sugerencia: `Asignalos a quien sea el dueño legal.`,
        items: invHuerfanas.map(i => ({ id: i.id, label: i.nombre || i.tipo, valor: i.valor || i.va })),
        accion: { tipo: "asignar_owner_inversiones", ids: invHuerfanas.map(i => i.id) },
      });
    }

    // Gastos sin owner válido
    Object.entries(activos.gastos).forEach(([cat, items]) => {
      const huerfanos = (items || []).filter(g => !g.owner || !ownerIds.has(g.owner));
      if (huerfanos.length > 0) {
        advertencias.push({
          id: `huerfano_gastos_${cat}`,
          severidad: "warning",
          categoria: "huerfanos",
          titulo: `${huerfanos.length} gasto${huerfanos.length > 1 ? "s" : ""} de ${cat} sin titular`,
          mensaje: `Tenés gastos de ${cat} que no están asociados a ninguna persona. NO se aplican como deducción.`,
          sugerencia: `Asignalos a la persona que los paga.`,
          items: huerfanos.map(g => ({ id: g.id, label: cat, mensual: g.m })),
          accion: { tipo: "asignar_owner_gastos", categoria: cat, ids: huerfanos.map(g => g.id) },
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CATEGORÍA 2: DATOS FALTANTES CRÍTICOS
  // ═══════════════════════════════════════════════════════════════════════

  // Sin owners cargados
  if (owners.length === 0) {
    faltantes.push({
      id: "sin_owners",
      severidad: "error",
      categoria: "faltantes",
      titulo: "No tenés ninguna persona fiscal cargada",
      mensaje: "Para calcular impuestos necesitás al menos una persona natural o jurídica. Sin esto, no podemos hacer nada.",
      sugerencia: "Empezá con el wizard paso a paso o agregá una persona desde Configuración.",
      accion: { tipo: "abrir_wizard" },
    });
  }

  // Personas naturales sin fiscalProfile
  owners.filter(o => o.type === "natural").forEach(o => {
    const fp = o.fiscalProfile || {};
    if (fp.dependientes == null) {
      faltantes.push({
        id: `falta_dependientes_${o.id}`,
        severidad: "info",
        categoria: "faltantes",
        titulo: `${o.name}: no sé si tenés dependientes`,
        mensaje: `Esta deducción puede ahorrar entre $1M y $8M al año. No la tenés cargada.`,
        sugerencia: `En el wizard te pregunto, o agregalo en Configuración → Owners.`,
        accion: { tipo: "abrir_wizard" },
      });
    }
  });

  // Personas jurídicas sin régimen ni actividad económica
  owners.filter(o => o.type === "juridica").forEach(o => {
    if (!o.regimen) {
      advertencias.push({
        id: `falta_regimen_${o.id}`,
        severidad: "warning",
        categoria: "faltantes",
        titulo: `${o.name}: falta especificar régimen tributario`,
        mensaje: `No sabemos si está en Régimen Ordinario (35%), SIMPLE (1.2-14%) o especial. La diferencia de impuesto puede ser MASIVA.`,
        sugerencia: `Agregá el régimen en Configuración → Owners.`,
        accion: { tipo: "editar_owner", ownerId: o.id, campo: "regimen" },
      });
    }
    if (!o.actividadEconomica && !o.ciiu) {
      advertencias.push({
        id: `falta_ciiu_${o.id}`,
        severidad: "info",
        categoria: "faltantes",
        titulo: `${o.name}: sin código CIIU/actividad económica`,
        mensaje: `El código CIIU define la tarifa de ICA y la calificación para Régimen Simple.`,
        sugerencia: `Agregalo en Configuración → Owners.`,
        accion: { tipo: "editar_owner", ownerId: o.id, campo: "actividadEconomica" },
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CATEGORÍA 3: INCONSISTENCIAS Y POSIBLES ERRORES
  // ═══════════════════════════════════════════════════════════════════════

  // Salario sin aportes obligatorios visibles (raro: empleado formal típicamente tiene)
  owners.filter(o => o.type === "natural").forEach(o => {
    const tieneSalario = activos.ingresos.some(i =>
      i.owner === o.id && (i.fiscalCode === "LAB_SALARIO" || i.categoria === "Salario")
    );
    if (tieneSalario) {
      const aportes = (activos.gastos["Aporte tributario"] || []).filter(g =>
        g.owner === o.id && (g.fiscalCode === "AP_TRIB_OBLIGATORIO_PEN_SAL" || /pension|salud|obligator/i.test(g.cat || ""))
      );
      // No es un error grave, solo una nota
      if (aportes.length === 0) {
        advertencias.push({
          id: `salario_sin_aportes_${o.id}`,
          severidad: "info",
          categoria: "inconsistencias",
          titulo: `${o.name}: salario cargado pero no veo aportes obligatorios`,
          mensaje: `Como empleado formal típicamente te descuentan 4% pensión + 4% salud. Si tu empleador lo hace, deberías cargarlo (es deducible).`,
          sugerencia: `Si tu empleador descuenta automáticamente, agregalo en gastos categoría "Aporte tributario".`,
          accion: { tipo: "abrir_wizard" },
        });
      }
    }
  });

  // Honorarios sin retención registrada (clientes empresariales típicamente retienen 10-11%)
  owners.filter(o => o.type === "natural").forEach(o => {
    const honor = activos.ingresos.filter(i =>
      i.owner === o.id && (i.fiscalCode === "LAB_HONORARIOS_CON_EMPLEADOS" || i.fiscalCode === "LAB_HONORARIOS_SIN_EMPLEADOS")
    );
    const totalHonorAnual = honor.reduce((s, i) => s + (Number(i.mensual) || 0) * 12, 0);
    if (totalHonorAnual > 40_000_000 && !honor.some(i => i.retencion > 0 || i.tieneRetencion)) {
      advertencias.push({
        id: `honor_sin_reten_${o.id}`,
        severidad: "warning",
        categoria: "inconsistencias",
        titulo: `${o.name}: honorarios altos sin retención registrada`,
        mensaje: `Facturás más de $40M al año en honorarios. Si tus clientes son personas jurídicas, te retienen 10-11% directo. Si no estás registrando esa retención, vas a sobreestimar tu saldo a pagar.`,
        sugerencia: `Verificá los certificados de retención de tus clientes y registralos.`,
        accion: { tipo: "info" },
      });
    }
  });

  // Deudas sin tasa registrada (no se puede calcular intereses deducibles)
  activos.deudas.forEach(d => {
    const tasa = Number(d.ts || d.tasa);
    if (!tasa || tasa <= 0) {
      advertencias.push({
        id: `deuda_sin_tasa_${d.id}`,
        severidad: "warning",
        categoria: "inconsistencias",
        titulo: `Deuda "${d.nombre || d.fiscalCode}" sin tasa de interés`,
        mensaje: `No tiene tasa registrada. NO podemos calcular cuánto pagás de intereses ni cuánto es deducible.`,
        sugerencia: `Agregá la tasa anual desde el detalle de la deuda.`,
        accion: { tipo: "editar_deuda", id: d.id, campo: "ts" },
      });
    }
  });

  // Mezcla de monedas sin TRM (raro pero pasa)
  const tieneUSD = [...activos.ingresos, ...activos.deudas, ...activos.inversiones].some(x => x.moneda === "USD");
  if (tieneUSD && !user.trm) {
    errores.push({
      id: "sin_trm",
      severidad: "error",
      categoria: "inconsistencias",
      titulo: "Hay items en USD pero no hay TRM",
      mensaje: "Tenés ingresos, deudas o inversiones en dólares pero la TRM no está cargada. NO podemos convertir a pesos para calcular impuesto.",
      sugerencia: "La TRM se actualiza automáticamente. Si falta, tocá refrescar.",
      accion: { tipo: "info" },
    });
  }

  // Items duplicados (mismo owner + mismo fiscalCode + mismo monto exacto)
  const ingPorClave = {};
  activos.ingresos.forEach(i => {
    const k = `${i.owner}_${i.fiscalCode}_${Math.round(Number(i.mensual) || 0)}`;
    ingPorClave[k] = (ingPorClave[k] || 0) + 1;
  });
  Object.entries(ingPorClave)
    .filter(([_, count]) => count > 1)
    .forEach(([k]) => {
      const [ownerId, fc, mensual] = k.split("_");
      advertencias.push({
        id: `duplicado_ing_${k}`,
        severidad: "warning",
        categoria: "inconsistencias",
        titulo: "Posibles ingresos duplicados",
        mensaje: `Detecté 2+ ingresos con mismo titular, mismo tipo (${fc}) y mismo monto ($${Number(mensual).toLocaleString()}). Puede ser duplicación accidental.`,
        sugerencia: `Revisá la lista y eliminá duplicados si los hay.`,
        accion: { tipo: "info" },
      });
    });

  // ═══════════════════════════════════════════════════════════════════════
  // CATEGORÍA 4: OPORTUNIDADES NO APLICADAS POR FALTA DE DATA
  // ═══════════════════════════════════════════════════════════════════════

  // GMF (4x1000) deducible: ¿lo cargaste?
  const tieneGMF = Object.entries(activos.gastos).some(([cat, items]) =>
    /gmf|4x1000|gravamen movim/i.test(cat) && items.length > 0
  );
  const tienePatrimonioFinanciero = activos.inversiones.some(i =>
    /banco|cuenta|cdt|fondo/i.test(i.tipo || i.nombre || "")
  );
  if (tienePatrimonioFinanciero && !tieneGMF) {
    oportunidadesData.push({
      id: "gmf_no_cargado",
      severidad: "info",
      categoria: "oportunidades_data",
      titulo: "Probablemente pagás GMF pero no lo cargaste",
      mensaje: `El 4×1000 (GMF) que te cobra el banco es deducible al 50% en tu declaración. Si movés plata por bancos, lo pagás aunque no te des cuenta.`,
      sugerencia: `Agregá el total anual de GMF en gastos. Lo encontrás en el extracto bancario.`,
      ahorroEstimado: 200_000, // $50K x 4 cuentas típicas
      accion: { tipo: "agregar_gasto", categoria: "GMF" },
    });
  }

  // Persona natural con honorarios pero sin costos asociados
  owners.filter(o => o.type === "natural").forEach(o => {
    const honor = activos.ingresos.filter(i =>
      i.owner === o.id && (i.fiscalCode === "LAB_HONORARIOS_CON_EMPLEADOS" || i.fiscalCode === "LAB_HONORARIOS_SIN_EMPLEADOS")
    );
    const totalHonor = honor.reduce((s, i) => s + (Number(i.mensual) || 0) * 12, 0);
    const tieneCostos = ["Oficina", "Transporte", "Materiales", "Equipos"].some(cat =>
      (activos.gastos[cat] || []).some(g => g.owner === o.id)
    );
    if (totalHonor > 30_000_000 && !tieneCostos) {
      oportunidadesData.push({
        id: `honor_sin_costos_${o.id}`,
        severidad: "info",
        categoria: "oportunidades_data",
        titulo: `${o.name}: facturás como independiente pero no veo costos`,
        mensaje: `Como persona natural independiente podés deducir gastos de tu actividad: oficina, internet, transporte, materiales, etc.`,
        sugerencia: `Cargá tus gastos de la actividad. Cada $1M deducido te ahorra $200K-$390K de impuesto.`,
        accion: { tipo: "agregar_gasto", categoria: "Oficina" },
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FILTRAR HALLAZGOS IGNORADOS POR EL USUARIO
  // ═══════════════════════════════════════════════════════════════════════
  // El user puede haber marcado algunos hallazgos como "está bien así".
  // Por ejemplo: activos en el exterior que NO quiere declarar en Colombia
  // → no son errores, son decisiones conscientes. Los movemos a 'ignorados'
  // que el UI puede mostrar como "X decisiones tomadas" colapsadas.

  const filtrarYMover = (lista) => {
    const filtrados = [];
    for (const h of lista) {
      if (dismissed.has(h.id)) {
        ignorados.push(h);
      } else {
        filtrados.push(h);
      }
    }
    return filtrados;
  };

  const erroresFiltrados = filtrarYMover(errores);
  const advertenciasFiltradas = filtrarYMover(advertencias);
  const oportunidadesFiltradas = filtrarYMover(oportunidadesData);
  const faltantesFiltrados = filtrarYMover(faltantes);

  // ═══════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════

  const total = erroresFiltrados.length + advertenciasFiltradas.length + oportunidadesFiltradas.length + faltantesFiltrados.length;

  return {
    errores: erroresFiltrados,
    advertencias: advertenciasFiltradas,
    oportunidadesData: oportunidadesFiltradas,
    faltantes: faltantesFiltrados,
    ignorados,
    total,
    resumen: resumenEjecutivo(erroresFiltrados, advertenciasFiltradas, oportunidadesFiltradas, faltantesFiltrados),
  };
}

function resumenEjecutivo(errores, advertencias, oportunidadesData, faltantes) {
  if (errores.length === 0 && advertencias.length === 0 && oportunidadesData.length === 0 && faltantes.length === 0) {
    return {
      estado: "ok",
      mensaje: "Tu data está completa y consistente. Todo en orden.",
    };
  }
  if (errores.length > 0) {
    return {
      estado: "error",
      mensaje: `Detecté ${errores.length} ${errores.length === 1 ? "error crítico" : "errores críticos"} que impiden calcular bien tus impuestos.`,
    };
  }
  if (advertencias.length > 0 || faltantes.length > 0) {
    const total = advertencias.length + faltantes.length;
    return {
      estado: "warning",
      mensaje: `${total} ${total === 1 ? "punto" : "puntos"} a revisar para mejorar la calidad de tu declaración.`,
    };
  }
  return {
    estado: "info",
    mensaje: `${oportunidadesData.length} oportunidades de optimización detectadas que necesitan más datos.`,
  };
}

function vacio() {
  return {
    errores: [],
    advertencias: [],
    oportunidadesData: [],
    faltantes: [],
    ignorados: [],
    total: 0,
    resumen: { estado: "ok", mensaje: "Sin datos cargados aún." },
  };
}
