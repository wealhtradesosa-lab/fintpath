/**
 * hallazgosI18n — Textos del asesor proactivo por jurisdicción.
 *
 * 02-ago-2026. Los 8 detectores de hallazgos.js razonan sobre conceptos
 * universales —deuda cara contra rendimiento del ahorro, concentración,
 * fondo de emergencia, carga de deuda— así que sirven igual en Colombia y en
 * US. Lo único atado al idioma eran los textos.
 *
 * Se separan acá en vez de traducir en línea porque las plantillas llevan
 * formato de moneda incrustado: en español van con toLocaleString("es-CO") y
 * la palabra "pesos"; en inglés con "en-US" y el símbolo delante. Mezclarlos
 * produce cosas como "$1.500.000 pesos" en la vista americana, que es peor
 * que no tener el asesor.
 *
 * Cada entrada recibe los valores ya calculados y devuelve el string armado.
 */

const money = {
  es: (n) => Math.round(n).toLocaleString("es-CO") + " pesos",
  en: (n) => "$" + Math.round(n).toLocaleString("en-US"),
};

export const TEXTOS = {
  es: {
    deudaCara: {
      unidad: "al año en juego",
      titulo: (nombre, tasa) => `${nombre} al ${tasa.toFixed(1)}%`,
      detalle: (tasa, dif, ahorro) =>
        `Tenés liquidez disponible mientras pagás una tasa del ${tasa.toFixed(2)}% E.A. ` +
        `Abonar a capital rinde ${dif.toFixed(2)} puntos más que dejarla quieta: ${money.es(ahorro)} al año.`,
      base: (tasa, rend) =>
        `Tasa del crédito (${tasa.toFixed(2)}% E.A.) vs. rendimiento de tu efectivo y CDT (${rend.toFixed(2)}% E.A.)`,
      accion: "Ver mis deudas",
    },
    concentracion: {
      unidad: "en un solo activo",
      titulo: (nombre) => `${nombre} concentra tu patrimonio`,
      detalle: "Un activo que pesa casi la mitad del total ata tu bienestar a un solo mercado. No es un error si es deliberado, pero conviene tenerlo presente.",
      base: "Valor del activo sobre patrimonio total",
      accion: "Ver patrimonio",
    },
    flujoNegativo: {
      unidad: "por mes",
      titulo: "Gastás más de lo que entra",
      detalle: (deficit) =>
        `Cada mes salen ${money.es(deficit)} más de los que ingresan. ` +
        `Si no viene de un ahorro, la diferencia sale de deuda.`,
      base: "Ingresos menos egresos totales del mes, según tus datos cargados",
      accion: "Ver egresos",
    },
    fondoEmergencia: {
      unidad: "meses de colchón",
      titulo: (meses) => (meses < 1 ? "Sin colchón" : "Colchón corto"),
      detalle: (meses, falta) =>
        `Con tus egresos actuales, el efectivo disponible alcanza para ${meses.toFixed(1)} meses. ` +
        `Para llegar a tres meses faltan ${money.es(falta)}.`,
      base: "Efectivo y CDT sobre egresos mensuales",
      accion: "Ver patrimonio",
    },
    cargaDeuda: {
      unidad: "de tu ingreso",
      titulo: "Cuotas muy altas",
      detalle: "Por encima del 35% la mayoría de los bancos considera que no hay capacidad para más crédito, y el margen para imprevistos se vuelve estrecho.",
      base: "Cuotas sobre ingreso bruto",
      accion: "Ver deudas",
    },
    colchonSolido: {
      unidad: "meses",
      titulo: "Colchón sólido",
      detalle: "Tu efectivo cubre bien un período sin ingresos.",
      base: "Efectivo y CDT sobre egresos mensuales",
    },
    flujoSano: {
      unidad: "de tu ingreso",
      titulo: "Ahorrás cada mes",
      detalle: (cf) => `Te quedan ${money.es(cf)} libres al mes.`,
      base: "Flujo de caja sobre ingreso bruto",
    },
    deudaControlada: {
      unidad: "de tu ingreso",
      titulo: "Deuda bajo control",
      detalle: "Tus cuotas dejan margen amplio para imprevistos.",
      base: "Cuotas sobre ingreso bruto. Referencia habitual de la banca: hasta 35%",
    },
    verImpuestos: "Ver impuestos",
  },

  en: {
    deudaCara: {
      unidad: "a year on the table",
      titulo: (nombre, tasa) => `${nombre} at ${tasa.toFixed(1)}%`,
      detalle: (tasa, dif, ahorro) =>
        `You're holding cash while paying ${tasa.toFixed(2)}% APR. ` +
        `Paying down principal beats leaving it idle by ${dif.toFixed(2)} points: ${money.en(ahorro)} a year.`,
      base: (tasa, rend) =>
        `Loan rate (${tasa.toFixed(2)}% APR) vs. return on your cash and CDs (${rend.toFixed(2)}%)`,
      accion: "View debts",
    },
    concentracion: {
      unidad: "in a single asset",
      titulo: (nombre) => `${nombre} concentrates your wealth`,
      detalle: "An asset worth nearly half your total ties your well-being to a single market. Not a mistake if it's deliberate, but worth keeping in mind.",
      base: "Asset value over total net worth",
      accion: "View assets",
    },
    flujoNegativo: {
      unidad: "per month",
      titulo: "You're spending more than you earn",
      detalle: (deficit) =>
        `Every month ${money.en(deficit)} more goes out than comes in. ` +
        `If it isn't coming from savings, it's coming from debt.`,
      base: "Income minus total monthly expenses, from your data",
      accion: "View expenses",
    },
    fondoEmergencia: {
      unidad: "months of runway",
      titulo: (meses) => (meses < 1 ? "No safety net" : "Thin safety net"),
      detalle: (meses, falta) =>
        `At your current burn, available cash covers ${meses.toFixed(1)} months. ` +
        `You need ${money.en(falta)} more to reach three months.`,
      base: "Cash and CDs over monthly expenses",
      accion: "View assets",
    },
    cargaDeuda: {
      unidad: "of your income",
      titulo: "Debt payments are high",
      detalle: "Above 35%, most lenders consider there's no capacity for more credit, and your buffer for surprises gets thin.",
      base: "Debt payments over gross income",
      accion: "View debts",
    },
    colchonSolido: {
      unidad: "months",
      titulo: "Solid cash cushion",
      detalle: "Your cash comfortably covers a stretch without income.",
      base: "Cash and CDs over monthly expenses",
    },
    flujoSano: {
      unidad: "of your income",
      titulo: "You save every month",
      detalle: (cf) => `${money.en(cf)} left over each month.`,
      base: "Cash flow over gross income",
    },
    deudaControlada: {
      unidad: "of your income",
      titulo: "Debt under control",
      detalle: "Your payments leave plenty of room for surprises.",
      base: "Debt payments over gross income. Common lender threshold: 35%",
    },
    verImpuestos: "View taxes",
  },
};

export const t = (idioma) => TEXTOS[idioma] || TEXTOS.es;
