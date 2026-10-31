// ═══════════════════════════════════════════════════════════════════════════
// Clases para agrupar los listados (31-oct-2026, Santiago: "el listado es
// difícil encontrar los ítems; ¿por qué no clasificar por tipo? … haga lo mismo
// en ingresos, egresos y deudas"). Las categorías finas se agrupan en clases que
// se entienden de un vistazo; cada fila sigue mostrando su categoría.
// ═══════════════════════════════════════════════════════════════════════════
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const CLASES_INGRESO = [
  { id: "trabajo", nombre: "Trabajo", icono: "💼", re: /salario|sueldo|honorario|comision|freelance|prima|bono|bonific|cesantia|nomina|servicio/ },
  { id: "arriendos", nombre: "Arriendos", icono: "🏠", re: /arriendo|alquiler|renta inmueble|airbnb/ },
  { id: "financieras", nombre: "Rentas financieras", icono: "💰", re: /interes|rendimiento|dividendo|cdt|inversion|capital|fondo/ },
  { id: "negocios", nombre: "Negocios", icono: "🏢", re: /negocio|utilidad|empresa|venta/ },
  { id: "pensiones", nombre: "Pensiones", icono: "👴", re: /pension/ },
  { id: "otros", nombre: "Otros", icono: "📦", re: null },
];

export const CLASES_GASTO = [
  { id: "vivienda", nombre: "Vivienda y hogar", icono: "🏠", re: /vivienda|hogar|servicio|mantenimiento|nomina|empleada|administracion|alimenta|mercado/ },
  { id: "familia", nombre: "Familia y educación", icono: "🎓", re: /educacion|colegio|universidad|familia|hijo|mascota/ },
  { id: "salud", nombre: "Salud y seguros", icono: "🩺", re: /salud|medic|seguro|seguridad social|obligatorio/ },
  { id: "transporte", nombre: "Transporte", icono: "🚗", re: /transporte|vehiculo|carro|gasolina|combustible|parqueadero/ },
  { id: "impuestos", nombre: "Impuestos y aportes", icono: "🧾", re: /impuesto|aporte|predial|retencion/ },
  { id: "inmuebles", nombre: "Inmuebles que arriendas y negocio", icono: "🏢", re: /inmueble arrendado|honorario|representacion|negocio|oficina/ },
  { id: "estilo", nombre: "Estilo de vida", icono: "🎉", re: /entretenimiento|restaurante|viaje|ropa|personal|suscrip|deporte|club/ },
  { id: "deudas", nombre: "Cuotas y créditos", icono: "💳", re: /credito|cuota|tarjeta|deuda|prestamo/ },
  { id: "otros", nombre: "Otros", icono: "📦", re: null },
];

export function claseDeTexto(clases, ...textos) {
  const t = norm(textos.filter(Boolean).join(" "));
  return clases.find((c) => c.re && c.re.test(t)) || clases[clases.length - 1];
}
export const claseIngreso = (i) => claseDeTexto(CLASES_INGRESO, i?.categoria, i?.tipo) ;
export const claseGasto = (g) => claseDeTexto(CLASES_GASTO, g?.cat);

/** ¿El ítem es del titular? Sin titular, cuenta como del primero (como en el resto de la app). */
export const esDelTitular = (x, titularId, owners = []) => !titularId || (x?.owner || owners[0]?.id || "") === titularId;
