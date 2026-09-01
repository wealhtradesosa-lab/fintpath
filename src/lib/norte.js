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
  // 01-sep-2026 (Santiago: "vehículo es un activo, un carro; creo yo por
  // defecto es protección"). De las tres canastas es la que corresponde: un
  // carro no se mueve con el mercado ni es una apuesta de multiplicación.
  // Ver la nota sobre depreciación más abajo.
  "vehiculo": "proteccion", "carro": "proteccion", "auto": "proteccion",
  "moto": "proteccion", "vehicle": "proteccion",
  // Los tipos realmente usados en la base se revisaron uno por uno
  // (01-sep-2026). Faltaban estos tres, que caian en el aviso naranja sin
  // motivo: "otro" es el default del formulario, asi que aparecia marcado como
  // adivinado en cuentas que simplemente no eligieron tipo.
  "otro": "proteccion", "income": "proteccion",

  // MERCADO
  "acciones": "mercado", "stocks_etf": "mercado", "etf": "mercado",
  "fondo de inversión": "mercado", "fic": "mercado", "fondo": "mercado",
  "401k_trad": "mercado", "roth_ira": "mercado", "hsa": "mercado",
  "rental_res": "mercado", "rental_com": "mercado",
  "local comercial": "mercado", "bodega": "mercado",
  // "Investment" es el tipo generico de inversion financiera (17 usos en la
  // base). Va a mercado: es la canasta que describe una inversion diversificada
  // corriente, y es el supuesto intermedio entre asumir seguridad o apuesta.
  "investment": "mercado",

  // ASPIRACIÓN
  "crypto": "aspiracion", "cripto": "aspiracion", "bitcoin": "aspiracion", "btc": "aspiracion",
  "business": "aspiracion", "negocio": "aspiracion", "qsbs": "aspiracion",
  "startup": "aspiracion", "trading": "aspiracion",
};

/**
 * Clasifica un activo, y explica por qué.
 * Devuelve { canasta, motivo, manual }.
 *
 * 30-ago-2026 (Santiago: "supongamos que la plataforma clasifica orlando como
 * multiplicador y es realmente protección; que uno pueda clasificar"). Tiene
 * razón, y no es un detalle: el mapa de tipos es una heurística sobre una
 * etiqueta que el usuario eligió para otra cosa. Un "Real Estate" puede ser la
 * casa donde vive (protección) o un lote especulativo en la periferia
 * (aspiración), y el sistema no tiene cómo saberlo. Cuando el usuario lo
 * corrige, su criterio manda: `canastaManual` gana sobre cualquier heurística.
 */
export function clasificarActivo(activo) {
  const manual = activo?.canastaManual;
  if (manual && ["proteccion", "mercado", "aspiracion"].includes(manual)) {
    return { canasta: manual, motivo: "Lo clasificaste vos", manual: true };
  }

  const tipoRaw = String(activo?.tp || activo?.tipo || "").trim();
  // Se quitan los acentos antes de buscar en el mapa. Esa era la causa de que
  // "Vehículo" no coincidiera con ninguna clave y cayera en el aviso naranja:
  // el mapa está escrito sin tildes y la comparación era literal. Afecta a
  // cualquier tipo acentuado, no solo a este.
  const tipo = tipoRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (CANASTA_POR_TIPO[tipo]) {
    return { canasta: CANASTA_POR_TIPO[tipo], motivo: `Por su tipo: ${tipoRaw}`, manual: false };
  }
  for (const [k, v] of Object.entries(CANASTA_POR_TIPO)) {
    if (tipo.includes(k)) {
      return { canasta: v, motivo: `Su tipo "${tipoRaw}" contiene "${k}"`, manual: false };
    }
  }
  // Sin clasificar va a protección: es el supuesto CONSERVADOR. Contar un
  // activo desconocido como aspiración inflaría artificialmente el riesgo
  // percibido y llevaría a recomendar movimientos innecesarios.
  // Pero se avisa, porque es justo el caso donde la heurística puede errar y
  // el usuario es el único que sabe la respuesta.
  return {
    canasta: "proteccion",
    motivo: tipoRaw
      ? `No reconocemos el tipo "${tipoRaw}" — asumimos protección`
      : "Sin tipo definido — asumimos protección",
    manual: false,
    inferido: true,
  };
}

export function canastaDe(activo) {
  return clasificarActivo(activo).canasta;
}

// ─── Los cuatro objetivos ─────────────────────────────────────────────────
// Las proporciones vienen del rango que Chhabra y la práctica de family office
// usan para cada mandato. No son leyes: son puntos de referencia contra los
// cuales medir una desviación.
// 03-ago-2026 (Santiago: "si uno quiere por ejemplo el norte de crecer con algo
// de renta, cómo debería dividir las inversiones: X en real estate, X en
// fondos, acciones, etc.").
// Las canastas son abstractas y no dicen EN QUÉ invertir. Este mapa baja cada
// canasta a los vehículos que la componen, con su peso relativo dentro de ella.
// Son referencias de composición, no recomendaciones de compra: qué TIPO de
// activo cumple cada función, no cuál comprar.
export const VEHICULOS = {
  proteccion: [
    { es: "Inmueble propio (sin deuda)", en: "Primary residence (no debt)", peso: 45 },
    { es: "Efectivo y cuentas de ahorro", en: "Cash and savings", peso: 25 },
    { es: "CDT y renta fija", en: "CDs and fixed income", peso: 30 },
  ],
  mercado: [
    { es: "Fondos indexados y ETFs", en: "Index funds and ETFs", peso: 50 },
    { es: "Inmuebles de renta", en: "Rental property", peso: 30 },
    { es: "Acciones diversificadas", en: "Diversified stocks", peso: 20 },
  ],
  aspiracion: [
    { es: "Negocio propio", en: "Your own business", peso: 50 },
    { es: "Cripto", en: "Crypto", peso: 25 },
    { es: "Una sola apuesta grande", en: "One big bet", peso: 25 },
  ],
};

// 03-ago-2026 (Santiago: "podrían estos escenarios de norte mostrar cómo
// afectaría el crecimiento o pérdida de patrimonio en el horizonte de tiempo
// elegido").
//
// Retornos REALES (ya descontada inflación) por canasta, y su desviación
// típica. Las fuentes son las de referencia estándar:
//   · protección: renta fija e inmueble propio. Rinde poco por diseño — su
//     función es no caer, no crecer.
//   · mercado: ~7% real es el promedio largo del S&P 500 descontada inflación
//     (Siegel, "Stocks for the Long Run"). La desviación es alta: 15-20%.
//   · aspiración: no tiene retorno esperado honesto. Puede multiplicar o irse
//     a cero. Se usa 12% con desviación 40% para reflejar que la dispersión
//     es el punto, no el promedio.
//
// POR QUÉ SE MUESTRAN TRES ESCENARIOS Y NO UNO: proyectar a 10 años con un
// solo número es una promesa disfrazada de cálculo. El escenario adverso es
// el que informa una decisión; el esperado solo entusiasma.
export const RETORNOS = {
  proteccion: { esperado: 0.015, desv: 0.04 },
  mercado:    { esperado: 0.07,  desv: 0.17 },
  aspiracion: { esperado: 0.12,  desv: 0.40 },
};

/**
 * Proyecta el patrimonio a N años bajo una distribución dada.
 * Devuelve tres escenarios: adverso (−1 desviación), esperado y favorable
 * (+1 desviación), aplicados sobre el retorno ponderado de la mezcla.
 */
export function proyectar({ total, mix, anios, aporteAnual = 0 }) {
  const w = { proteccion: mix.proteccion / 100, mercado: mix.mercado / 100, aspiracion: mix.aspiracion / 100 };
  const rEsperado = Object.keys(w).reduce((s, k) => s + w[k] * RETORNOS[k].esperado, 0);
  // La desviación de la cartera no es la suma de las desviaciones: se asume
  // correlación parcial. Usar la suma simple exageraría el rango.
  const desv = Math.sqrt(Object.keys(w).reduce((s, k) => s + Math.pow(w[k] * RETORNOS[k].desv, 2), 0)) * 1.35;

  const crecer = (r) => {
    let v = total;
    const serie = [];
    for (let y = 1; y <= anios; y++) {
      v = v * (1 + r) + aporteAnual;
      serie.push({ anio: y, valor: v });
    }
    return { final: v, serie };
  };

  return {
    retornoEsperado: rEsperado,
    desviacion: desv,
    adverso:   crecer(rEsperado - desv),
    esperado:  crecer(rEsperado),
    favorable: crecer(rEsperado + desv),
  };
}

// 03-ago-2026 (Santiago: "no entiendo estos términos protección, mercado,
// aspiración... qué son eso de posiciones concentradas, eso no es claro").
// Si el dueño del producto no entiende los nombres, un usuario menos. Los
// términos vienen del paper de Chhabra y se conservan porque son los del
// marco, pero cada uno necesita su explicación en lenguaje común y el retorno
// que se le asume — sin eso la proyección sale de una caja negra.
export const CANASTAS_EXPLICADAS = {
  proteccion: {
    es: { nombre: "Protección", corto: "Lo que te sostiene si todo sale mal",
          largo: "Tu casa sin deuda, efectivo, CDT, renta fija. No crece mucho — esa no es su función. Su función es que nunca tengas que vender algo bueno en un mal momento.",
          retorno: "1,5% anual sobre la inflación" },
    en: { nombre: "Protection", corto: "What holds you up if everything goes wrong",
          largo: "Your home with no mortgage, cash, CDs, fixed income. It doesn't grow much — that's not its job. Its job is that you never have to sell something good at a bad time.",
          retorno: "1.5% a year above inflation" },
  },
  mercado: {
    es: { nombre: "Mercado", corto: "Lo que crece parejo con la economía",
          largo: "Fondos indexados, acciones diversificadas, inmuebles que se arriendan. Sube y baja con el mercado, pero en plazos largos crece de forma razonablemente predecible.",
          retorno: "7% anual sobre la inflación" },
    en: { nombre: "Market", corto: "What grows along with the economy",
          largo: "Index funds, diversified stocks, rental property. It moves with the market, but over long horizons it grows fairly predictably.",
          retorno: "7% a year above inflation" },
  },
  aspiracion: {
    es: { nombre: "Aspiración", corto: "Lo que puede multiplicar — o irse a cero",
          largo: "Tu negocio propio, cripto, una sola apuesta grande. Acá está el potencial de multiplicar el patrimonio, y también el de perderlo. Por eso nunca debería ser la mayoría.",
          retorno: "12% anual promedio, pero con desviaciones enormes" },
    en: { nombre: "Aspiration", corto: "What can multiply — or go to zero",
          largo: "Your own business, crypto, one big bet. This is where wealth multiplies, and where it disappears. That's why it should never be the majority.",
          retorno: "12% a year on average, with enormous swings" },
  },
};

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
    const cl = clasificarActivo(i);
    const c = cl.canasta;
    const v = valor(i);
    porCanasta[c] += v;
    // Se lleva el id y el motivo: sin id no se puede reclasificar, y sin
    // motivo el usuario no tiene con qué juzgar si la clasificación está bien.
    if (v > 0) detalle[c].push({
      id: i.id, nombre: i.n || i.nombre || "Activo", valor: v,
      tipo: i.tp || i.tipo || "", motivo: cl.motivo,
      manual: cl.manual, inferido: !!cl.inferido,
    });
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

  // 03-ago-2026 (Santiago: "casi que clasificar el patrimonio según ese nuevo
  // norte e informar cuáles no cumplen").
  // Se evalúa ACTIVO POR ACTIVO contra el objetivo. La decisión de diseño
  // importante: NO se dice "vendé esto". Se dice qué canasta ocupa, si esa
  // canasta está sobre o bajo el objetivo, y si el activo concentra demasiado.
  // La diferencia entre un mapa y un chofer: recomendar operaciones concretas
  // es asesoría de inversión, y ni la plataforma ni Santiago están registrados
  // para darla.
  const brechaDe = {};
  brechas.forEach((b) => { brechaDe[b.canasta] = b.puntos; });

  const evaluados = activos
    .map((i) => {
      const cl = clasificarActivo(i);
      const canasta = cl.canasta;
      const v = valor(i);
      const peso = (v / total) * 100;
      const exceso = brechaDe[canasta];   // >0: esa canasta sobra; <0: falta

      let estado, razon;
      if (peso >= 40) {
        estado = "revisar";
        razon = `Concentra el ${peso.toFixed(0)}% de tu patrimonio. Sea cual sea el objetivo, un solo activo con ese peso es tu mayor riesgo.`;
      } else if (exceso >= 15) {
        estado = "revisar";
        razon = `Está en una canasta que tu objetivo pide reducir (${brechaDe[canasta] > 0 ? "+" : ""}${exceso.toFixed(0)} puntos sobre el objetivo).`;
      } else if (exceso <= -15) {
        estado = "aporta";
        razon = `Está en la canasta que tu objetivo pide reforzar. Faltan ${Math.abs(exceso).toFixed(0)} puntos acá.`;
      } else {
        estado = "alineado";
        razon = "Su canasta está en línea con lo que tu objetivo pide.";
      }
      return { id: i.id, motivo: cl.motivo, manual: cl.manual, inferido: !!cl.inferido, nombre: i.n || i.nombre || "Activo", tipo: i.tp || i.tipo || "—", valor: v, peso, canasta, estado, razon };
    })
    .sort((a, b) => b.valor - a.valor);

  return {
    vacio: false, objetivo: obj, total, porCanasta, pct, brechas,
    concentracion, activoMayor: mayor, cobertura, hallazgos, detalle, evaluados,
  };
}
