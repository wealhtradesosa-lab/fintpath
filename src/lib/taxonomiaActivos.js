/**
 * taxonomiaActivos.js — Clasificación de activos en dos niveles.
 *
 * 14-sep-2026 (Santiago: "como experto en ontología, qué mejoraría en
 * FINPATHIA"). Segundo hallazgo de esa revisión.
 *
 * EL PROBLEMA QUE RESUELVE
 * Los 14 tipos que existen en la base mezclaban tres niveles de abstracción en
 * una sola lista plana:
 *   · clases de activo      → Real Estate, Acciones, CDT, Crypto, Renta Fija
 *   · subtipos de una clase → Local Comercial, Bodega, Vehículo
 *   · categorías vagas      → Investment, Fondo de Inversión, Negocio, Cash, Otro
 *   · un error de categoría → "Income" (dos registros donde se cargó un
 *                             ingreso como si fuera un activo)
 *
 * Al estar todo al mismo nivel, la asignación de canasta se hacía tipo por
 * tipo y derivó en contradicciones. La que lo destapó: "Real Estate" caía en
 * PROTECCIÓN mientras "Local Comercial" y "Bodega" caían en MERCADO. Son
 * inmuebles los tres. Un usuario con una bodega y una casa las veía en
 * canastas distintas sin ninguna razón que se pudiera explicar.
 *
 * CÓMO LO RESUELVE
 * Cada tipo se mapea a una CLASE, y la canasta se hereda de la clase. Agregar
 * "Oficina" o "Parqueadero" mañana es una línea en SUBTIPO_A_CLASE, no una
 * decisión nueva sobre canastas: la clase ya la tomó. Las contradicciones
 * dejan de ser posibles por construcción.
 *
 * SOBRE `valorizacionRealAnual`
 * Es el comportamiento económico propio de cada clase, en términos REALES
 * (por encima de la inflación). Existe porque hoy la proyección de patrimonio
 * aplica un único porcentaje a todo: el vehículo de Santiago, $190 millones,
 * crece 6% anual en el modelo cuando un carro se deprecia. Los valores son
 * referencias de largo plazo y deben poder ajustarse por el usuario; no
 * pretenden ser pronósticos.
 */

export const CLASES = {
  inmueble: {
    label: "Inmueble",
    canasta: "proteccion",
    // Se valoriza con la inflación más un poco; no es un activo de crecimiento.
    valorizacionRealAnual: 0.01,
    nota: "Piso patrimonial. Protege el nivel de vida, no busca multiplicar.",
  },
  liquidez: {
    label: "Liquidez",
    canasta: "proteccion",
    // El efectivo pierde contra la inflación: rendimiento real negativo.
    valorizacionRealAnual: -0.01,
    nota: "Disponible inmediato. Su función es cubrir imprevistos, no rendir.",
  },
  renta_fija: {
    label: "Renta fija",
    canasta: "proteccion",
    valorizacionRealAnual: 0.02,
    nota: "Rendimiento conocido de antemano.",
  },
  mercado_publico: {
    label: "Mercado público",
    canasta: "mercado",
    // Referencia de largo plazo de un índice amplio, ya descontada inflación.
    valorizacionRealAnual: 0.06,
    nota: "Crece al ritmo del mercado, con su volatilidad.",
  },
  alternativo: {
    label: "Alternativo",
    canasta: "aspiracion",
    // Deliberadamente NO se pone un número alto: la clase existe para señalar
    // que puede multiplicar y también perderse entera. Proyectar cripto al 30%
    // anual convertiría la herramienta en una promesa.
    valorizacionRealAnual: 0.08,
    nota: "Puede multiplicar y puede perderse. Dimensionar con cuidado.",
  },
  negocio: {
    label: "Negocio propio",
    canasta: "aspiracion",
    valorizacionRealAnual: 0.08,
    nota: "Concentrado y poco líquido; su valor depende de la operación.",
  },
  vehiculo: {
    label: "Vehículo",
    canasta: "proteccion",
    // El único con signo negativo, y el motivo por el que esta tabla existe.
    valorizacionRealAnual: -0.12,
    nota: "Se deprecia. Es patrimonio, pero pierde valor todos los años.",
  },
  otro: {
    label: "Otro",
    canasta: "proteccion",
    valorizacionRealAnual: 0,
    nota: "Sin clase asignada. Conviene precisarlo para proyectar mejor.",
  },
};

/**
 * Mapa subtipo → clase. Las claves van en minúscula y SIN tildes: la búsqueda
 * normaliza antes de comparar. Ese detalle ya causó un bug silencioso — la
 * clave "fondo de inversión" tenía tilde y nunca hacía match exacto; funcionaba
 * de casualidad por una coincidencia parcial con "fondo".
 */
export const SUBTIPO_A_CLASE = {
  // Inmuebles — incluidos los tres que estaban repartidos en otras canastas
  "real estate": "inmueble",
  "inmueble": "inmueble",
  "casa": "inmueble",
  "apartamento": "inmueble",
  "local comercial": "inmueble",
  "local": "inmueble",
  "bodega": "inmueble",
  "oficina": "inmueble",
  "lote": "inmueble",
  "land": "inmueble",
  "terreno": "inmueble",
  "finca": "inmueble",
  "parqueadero": "inmueble",
  "primary_home": "inmueble",

  // Liquidez
  "cash": "liquidez",
  "efectivo": "liquidez",
  "cuenta": "liquidez",
  "ahorro": "liquidez",
  "hysa": "liquidez",
  "cash_equiv": "liquidez",

  // Renta fija
  "cdt": "renta_fija",
  "renta fija": "renta_fija",
  "bonos": "renta_fija",
  "bono": "renta_fija",
  "tes": "renta_fija",

  // Mercado público
  "acciones": "mercado_publico",
  "stocks_etf": "mercado_publico",
  "etf": "mercado_publico",
  "fondo de inversion": "mercado_publico",
  "fondo": "mercado_publico",
  "fic": "mercado_publico",
  "investment": "mercado_publico",
  "401k_trad": "mercado_publico",
  "roth_ira": "mercado_publico",
  "hsa": "mercado_publico",
  "brokerage": "mercado_publico",

  // Alternativos
  "crypto": "alternativo",
  "cripto": "alternativo",
  "bitcoin": "alternativo",
  "btc": "alternativo",

  // Negocio
  "negocio": "negocio",
  "empresa": "negocio",
  "participacion": "negocio",

  // Vehículos
  "vehiculo": "vehiculo",
  "vehicle": "vehiculo",
  "carro": "vehiculo",
  "auto": "vehiculo",
  "moto": "vehiculo",

  // Sin clase real. "income" es un error de captura: alguien registró un
  // ingreso como activo. Se mapea para que no caiga en el aviso de "tipo no
  // reconocido", pero conviene detectarlo y corregir el dato de origen.
  "otro": "otro",
  "other_asset": "otro",
  "income": "otro",
};

export const normalizar = (t) =>
  String(t || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Devuelve { clase, label, canasta, valorizacionRealAnual, exacto }.
 * `exacto: false` indica que se resolvió por coincidencia parcial o que se
 * cayó al default — información útil para avisarle al usuario que estamos
 * suponiendo, en vez de presentarlo como un hecho.
 */
export function claseDeActivo(tipoRaw) {
  const t = normalizar(tipoRaw);
  if (!t) return { clase: "otro", ...CLASES.otro, exacto: false };

  if (SUBTIPO_A_CLASE[t]) {
    const clase = SUBTIPO_A_CLASE[t];
    return { clase, ...CLASES[clase], exacto: true };
  }
  // Coincidencia parcial: se prueban primero las claves más largas para que
  // "local comercial" gane sobre "local" y el resultado no dependa del orden
  // en que se escribió el objeto.
  const claves = Object.keys(SUBTIPO_A_CLASE).sort((a, b) => b.length - a.length);
  for (const k of claves) {
    if (t.includes(k)) {
      const clase = SUBTIPO_A_CLASE[k];
      return { clase, ...CLASES[clase], exacto: false, coincidencia: k };
    }
  }
  return { clase: "otro", ...CLASES.otro, exacto: false };
}
