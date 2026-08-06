/**
 * norte.js — Motor de "Tu Norte": objetivo patrimonial y diagnóstico.
 *
 * 03-ago-2026 (Santiago: "existe algún modelo probado, alguna matriz que ayude
 * a definir el objetivo deseado... que la IA de un diagnóstico y quede guardado
 * como un dato, como una sección... qué bueno sería crear esa sección como
 * brújula financiera").
 *
 * METODOLOGÍA: modelo de canastas (bucket approach) de Ashvin Chhabra, "The
 * Aspirational Investor" (2015), usado por family offices reales. La idea
 * central es que el objetivo NO se define eligiendo activos sino la PROPORCIÓN
 * entre tres canastas con propósitos distintos:
 *
 *   PROTECCIÓN  — lo que garantiza no caer de nivel de vida. Efectivo, renta
 *                 fija, inmuebles sin deuda. No busca retorno, busca piso.
 *   MERCADO     — lo que crece al ritmo del mercado. Índices, ETFs, fondos
 *                 diversificados, planes de retiro.
 *   ASPIRACIÓN  — lo que puede multiplicar y también perderse. Negocios
 *                 propios, cripto, posiciones concentradas.
 *
 * Por qué este modelo y no otro: separa el riesgo por PROPÓSITO, no por
 * volatilidad. Un inmueble arrendado y un ETF pueden tener la misma
 * volatilidad y cumplir funciones opuestas en un patrimonio.
 *
 * Lo que este motor NO hace: recomendar activos concretos ni prometer
 * retornos. Calcula una brecha entre dónde estás y dónde dijiste que querés
 * estar. La decisión es del usuario y su asesor.
 */

// ─── Clasificación de activos en canastas ─────────────────────────────────
// Se mapea por tipo. Las claves cubren Colombia y US porque cada jurisdicción
// nombra los suyos distinto ("Real Estate" vs "primary_home").
const CANASTA_POR_TIPO = {
  // PROTECCIÓN
  "cdt": "proteccion", "cash": "proteccion", "cash_equiv": "proteccion",
  "efectivo": "proteccion", "cuenta": "proteccion", "ahorro": "proteccion",
  "hysa": "proteccion", "renta fija": "proteccion", "bonos": "proteccion",
  "primary_home": "proteccion", "real estate": "proteccion",
  "land": "proteccion", "other_asset": "proteccion",

  // MERCADO
  "acciones": "mercado", "stocks_etf": "mercado", "etf": "mercado",
  "fondo de inversión": "mercado", "fic": "mercado", "fondo": "mercado",
  "401k_trad": "mercado", "roth_ira": "mercado", "hsa": "mercado",
  "rental_res": "mercado", "rental_com": "mercado",
  "local comercial": "mercado", "bodega": "mercado",

  // ASPIRACIÓN
  "crypto": "aspiracion", "bitcoin": "aspiracion", "btc": "aspiracion",
  "business": "aspiracion", "negocio": "aspiracion", "qsbs": "aspiracion",
  "startup": "aspiracion", "trading": "aspiracion",
};

export function canastaDe(activo) {
  const tipo = String(activo?.tp || activo?.tipo || "").toLowerCase().trim();
  if (CANASTA_POR_TIPO[tipo]) return CANASTA_POR_TIPO[tipo];
  // Coincidencia parcial: "Real Estate Orlando", "Fondo de Inversión XYZ"
  for (const [k, v] of Object.entries(CANASTA_POR_TIPO)) {
    if (tipo.includes(k)) return v;
  }
  // Sin clasificar va a protección: es el supuesto CONSERVADOR. Contar un
  // activo desconocido como aspiración inflaría artificialmente el riesgo
  // percibido y llevaría a recomendar movimientos innecesarios.
  return "proteccion";
}

// ─── Los cuatro objetivos ─────────────────────────────────────────────────
// Las proporciones vienen del rango que Chhabra y la práctica de family office
// usan para cada mandato. No son leyes: son puntos de referencia contra los
// cuales medir una desviación.
export const OBJETIVOS = {
  renta: {
    id: "renta",
    emoji: "🏖️",
    es: { nombre: "Vivir de la renta", desc: "Que mis activos paguen mis gastos, sin depender del salario" },
    en: { nombre: "Live off income", desc: "My assets cover my expenses, no salary needed" },
    mix: { proteccion: 60, mercado: 30, aspiracion: 10 },
    // El foco: que el ingreso pasivo cubra los egresos. La volatilidad importa
    // menos que la estabilidad del flujo.
    metrica: "cobertura",
  },
  preservar: {
    id: "preservar",
    emoji: "🛡️",
    es: { nombre: "Proteger lo que tengo", desc: "Preservar el patrimonio y transmitirlo sin erosionarlo" },
    en: { nombre: "Protect what I have", desc: "Preserve wealth and pass it on intact" },
    mix: { proteccion: 50, mercado: 40, aspiracion: 10 },
    metrica: "concentracion",
  },
  equilibrio: {
    id: "equilibrio",
    emoji: "⚖️",
    es: { nombre: "Crecer con algo de renta", desc: "Multiplicar el patrimonio sin renunciar a flujo hoy" },
    en: { nombre: "Grow with some income", desc: "Build wealth without giving up cash flow today" },
    mix: { proteccion: 30, mercado: 45, aspiracion: 25 },
    metrica: "crecimiento",
  },
  multiplicar: {
    id: "multiplicar",
    emoji: "🚀",
    es: { nombre: "Multiplicar", desc: "Acepto volatilidad alta a cambio de retorno; horizonte largo" },
    en: { nombre: "Multiply", desc: "High volatility for higher return; long horizon" },
    mix: { proteccion: 15, mercado: 35, aspiracion: 50 },
    metrica: "crecimiento",
  },
};

// ─── Diagnóstico ──────────────────────────────────────────────────────────
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Compara la distribución actual contra la del objetivo elegido.
 * Solo cuenta activos ENCENDIDOS (sim !== false), como todo el resto del motor.
 */
export function diagnosticar({ inversiones = [], objetivo = "equilibrio", trm = 1, totales = {} }) {
  const obj = OBJETIVOS[objetivo] || OBJETIVOS.equilibrio;
  const activos = (inversiones || []).filter((i) => i && i.sim !== false);

  const valor = (i) => {
    const v = num(i.va);
    return i.moneda === "USD" ? v * (trm || 1) : v;
  };

  const porCanasta = { proteccion: 0, mercado: 0, aspiracion: 0 };
  const detalle = { proteccion: [], mercado: [], aspiracion: [] };
  activos.forEach((i) => {
    const c = canastaDe(i);
    const v = valor(i);
    porCanasta[c] += v;
    if (v > 0) detalle[c].push({ nombre: i.n || i.nombre || "Activo", valor: v });
  });

  const total = porCanasta.proteccion + porCanasta.mercado + porCanasta.aspiracion;
  if (total <= 0) return { vacio: true, objetivo: obj };

  const pct = {
    proteccion: (porCanasta.proteccion / total) * 100,
    mercado: (porCanasta.mercado / total) * 100,
    aspiracion: (porCanasta.aspiracion / total) * 100,
  };

  // Brecha: cuántos puntos porcentuales separan lo actual del objetivo, y
  // cuánto dinero representa mover esa diferencia. El monto es lo que hace la
  // brecha accionable — "te faltan 41 puntos" no dice nada, "$8.900M" sí.
  const brechas = ["proteccion", "mercado", "aspiracion"].map((c) => {
    const puntos = pct[c] - obj.mix[c];
    return { canasta: c, actual: pct[c], objetivo: obj.mix[c], puntos, monto: (puntos / 100) * total };
  });

  // Concentración: el activo más grande sobre el total. Un family office lo
  // mira antes que cualquier otra cosa — es el riesgo que hunde patrimonios.
  const todos = [...detalle.proteccion, ...detalle.mercado, ...detalle.aspiracion]
    .sort((a, b) => b.valor - a.valor);
  const mayor = todos[0];
  const concentracion = mayor ? (mayor.valor / total) * 100 : 0;

  // Cobertura: qué parte de los egresos cubre el ingreso pasivo. Es LA métrica
  // del objetivo "vivir de la renta".
  const egresos = num(totales.egresosTotales);
  const pasivo = num(totales.ingresoPasivo);
  const cobertura = egresos > 0 ? (pasivo / egresos) * 100 : null;

  const hallazgos = [];
  if (concentracion >= 40 && mayor) {
    hallazgos.push({
      tono: "riesgo",
      titulo: `${mayor.nombre} concentra el ${concentracion.toFixed(0)}% de tu patrimonio`,
      detalle: "Un solo activo que pesa tanto ata tu bienestar a un mercado específico. No es un error si es deliberado, pero conviene saberlo.",
    });
  }
  brechas
    .filter((b) => Math.abs(b.puntos) >= 15)
    .sort((a, b) => Math.abs(b.puntos) - Math.abs(a.puntos))
    .slice(0, 2)
    .forEach((b) => {
      const nombres = { proteccion: "protección", mercado: "mercado", aspiracion: "aspiración" };
      hallazgos.push({
        tono: b.puntos > 0 ? "atencion" : "oportunidad",
        titulo: b.puntos > 0
          ? `Tenés más en ${nombres[b.canasta]} de lo que tu objetivo pide`
          : `Te falta exposición a ${nombres[b.canasta]}`,
        detalle: `${b.actual.toFixed(0)}% actual contra ${b.objetivo}% objetivo — una diferencia de ${Math.abs(b.puntos).toFixed(0)} puntos.`,
      });
    });
  if (cobertura !== null && objetivo === "renta") {
    hallazgos.push({
      tono: cobertura >= 100 ? "logro" : "atencion",
      titulo: cobertura >= 100
        ? "Tu ingreso pasivo ya cubre tus egresos"
        : `Tu ingreso pasivo cubre el ${cobertura.toFixed(0)}% de tus egresos`,
      detalle: cobertura >= 100
        ? "Alcanzaste la independencia por flujo. El trabajo ahora es sostenerla."
        : "Ese porcentaje es el que define si podés dejar de depender del salario.",
    });
  }

  return {
    vacio: false, objetivo: obj, total, porCanasta, pct, brechas,
    concentracion, activoMayor: mayor, cobertura, hallazgos, detalle,
  };
}
