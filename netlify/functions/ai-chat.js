// In-memory rate limit (resets on cold start, ~10min)
const rateLimits = {};
const LIMIT = 30;
const WINDOW = 24 * 60 * 60 * 1000;

const EXPERT_KNOWLEDGE = `
═══ CONOCIMIENTO EXPERTO DEL ASESOR FINPATHIA ═══

1. TRIBUTARIO COLOMBIA 2026:
- UVT 2026: $49,799 COP (estimado)
- Tabla renta personas naturales: 0-1090 UVT: 0% | 1090-1700: 19% | 1700-4100: 28% | 4100-8670: 33% | 8670-18970: 35% | 18970-31000: 37% | >31000: 39%
- Rentas exentas: 25% de ingresos laborales (tope 790 UVT/mes), aportes voluntarios a pensión (hasta 3800 UVT/año), AFC (hasta 3800 UVT/año)
- GMF (4x1000): aplica a movimientos financieros, exención en cuenta marcada hasta 350 UVT/mes
- Impuesto al patrimonio: aplica si patrimonio líquido > 72,000 UVT (~$3.6B COP). Tarifa 0.5% al 1.5%
- Dividendos: 0-300 UVT exentos, >300 UVT al 15%. Dividendos del exterior: tarifa plena
- Ganancia ocasional (venta activos >2 años): 15%
- ICA Bogotá: varía 4.14‰ a 13.8‰ según actividad
- Régimen simple (IEST): para ingresos <100,000 UVT/año, tarifa 1.8% a 14.5%

2. TRIBUTARIO USA (para colombianos con activos allá):
- FIRPTA: al vender propiedad en USA, retención 15% del precio bruto si >$300K
- W-8BEN: formulario para reducir withholding en dividendos de 30% a 15% (tratado tributario)
- FBAR (FinCEN 114): obligatorio reportar si cuentas en exterior >$10,000
- FATCA (Form 8938): reporte si activos >$200K (soltero) o >$400K (casado)
- Estate tax USA: aplica a non-residents con activos USA >$60,000. Tarifa hasta 40%
- Solución: LLC + Trust revocable para propiedades USA = evita probate y reduce estate tax
- Rental income USA: se reporta en Form 1040-NR, se puede deducir depreciación, intereses, property tax
- Tax treaty Colombia-USA: crédito tributario para evitar doble imposición

3. INVERSIONES Y TASAS COLOMBIA 2026:
- CDTs grandes bancos: 9-11% EA (plazos 12-24 meses)
- TES corto plazo: ~10% EA
- Fondos fiduciarios conservadores: 8-10% EA
- Fondos fiduciarios moderados: 11-14% EA
- FICs inmobiliarios: 12-18% EA (con riesgo de liquidez)
- Acciones Colombia (MSCI Colcap): retorno histórico ~12% EA (alta volatilidad)
- ETFs internacionales (VT, VTI, VXUS): 8-10% USD histórico
- S&P 500 histórico: ~10% USD anual (nominal)
- Bitcoin CAGR 4 años: 40-60% (extremadamente volátil)
- Inflación Colombia 2025: ~5.5%, meta BanRep: 3%
- Tasa BanRep: ~9.5% (bajando)

4. CAP RATES Y REAL ESTATE:
- Bogotá estrato 6: cap rate 4-6%
- Bogotá estrato 4-5: cap rate 5-7%
- Medellín El Poblado: cap rate 5-7%
- Locales comerciales Colombia: cap rate 7-10%
- Bodegas industriales: cap rate 8-12%
- Orlando FL residential: cap rate 5-7%
- Miami FL residential: cap rate 4-6%
- Orlando FL vacation rental: cap rate 8-12% (bruto)
- Regla general: si cap rate < costo de deuda → no conviene apalancar
- NOI = Ingreso bruto - vacancy (5-8%) - operating expenses (30-40%)
- Cash-on-Cash = NOI neto / capital propio invertido

5. PENSIONES COLOMBIA:
- Colpensiones (régimen de prima media): 
  - Requisitos hombres: 1,300 semanas + 62 años | mujeres: 1,300 semanas + 57 años
  - Pensión mínima: 1 SMMLV ($1,423,500 en 2025)
  - Pensión máxima: 25 SMMLV
  - Fórmula: promedio salarios últimos 10 años × tasa de reemplazo (65-80%)
  - Tasa reemplazo: 65% por 1300 semanas + 1.5% por cada 50 semanas adicionales (tope 80%)
- Fondo privado (régimen RAIS):
  - Pensión = ahorro acumulado / expectativa de vida
  - Generalmente da MENOS que Colpensiones para salarios medios-altos
  - Ventaja: herencia del saldo. Desventaja: riesgo de mercado
- Recomendación general: salarios >4 SMMLV → Colpensiones casi siempre mejor
- Traslado entre régimenes: posible hasta 10 años antes de edad de pensión

6. FIRE Y RETIRO:
- FIRE Number = gastos anuales × 25 (regla del 4% - Trinity Study)
- Lean FIRE: cubrir solo necesidades básicas
- Fat FIRE: cubrir estilo de vida completo + lujos
- Coast FIRE: ya ahorraste suficiente, solo dejas crecer sin aportar más
- Barista FIRE: semi-retiro, trabajas medio tiempo para gastos básicos
- Safe Withdrawal Rate (SWR): 3.5-4% para 30 años, 3-3.5% para retiro indefinido
- Sequence of returns risk: los primeros 5 años de retiro son críticos
- Bucket strategy: 2 años en cash, 3-5 años en bonos, resto en acciones
- En Colombia con inflación ~5%: considerar SWR de 3-3.5% para mayor seguridad

7. DIVERSIFICACIÓN Y RIESGO:
- Regla máx concentración: no más de 40% en un solo tipo de activo
- Correlación: inmuebles Colombia tienen baja correlación con S&P 500 → buena diversificación
- Moneda: >30% en USD protege contra devaluación COP (históricamente 3-5%/año)
- Regla de deuda: ratio deuda/activos <30% es saludable, >50% es riesgoso
- Cobertura de deuda: ingreso neto / cuotas totales > 2x es ideal
- Fondo emergencia: mínimo 6 meses de gastos, ideal 12-24 meses
- Concentración geográfica: ideal tener activos en 2+ países

8. SUCESIÓN PATRIMONIAL COLOMBIA:
- Herencia forzosa: 50% legítima rigurosa (partes iguales hijos), 25% mejora (distribuir entre herederos forzosos), 25% libre disposición
- Herederos forzosos: hijos, cónyuge, padres (si no hay hijos)
- Sociedad patrimonial: 50% del cónyuge no entra a herencia
- Gananciales: bienes adquiridos durante matrimonio se dividen 50/50
- Impuesto herencia Colombia: ganancia ocasional al 15% sobre lo recibido (hay exenciones primeras 7,700 UVT)
- Testamento: no es obligatorio pero MUY recomendable para libre disposición y mejora
- Seguro de vida: NO entra a masa herencial, pago directo a beneficiario → herramienta clave
- SAS familiar: puede facilitar sucesión de negocios y activos productivos
- Trust USA (para propiedades allá): Revocable Living Trust evita probate ($5K-$15K proceso), protege privacidad

9. SEGUROS COMO HERRAMIENTA PATRIMONIAL:
- Seguro de vida: cobertura mínima recomendada = deudas totales + 5 años de gastos familiares
- Key person insurance: si tu ingreso sostiene todo, es CRÍTICO
- Umbrella insurance (USA): protege patrimonio personal de demandas
- D&O si tienes empresa
- Seguro de arrendamiento: protege contra impago de inquilinos

10. BENCHMARKS COLOMBIA:
- Patrimonio neto promedio por edad (estrato 5-6):
  30 años: $200-500M | 35: $500M-1.5B | 40: $1.5-3B | 45: $3-6B | 50: $5-10B | 55+: $8-15B
- Top 1% patrimonio Colombia: >$5B COP
- Top 10%: >$1.5B COP
- Gasto familiar mensual estrato 6 Bogotá: $8-15M
- Gasto familiar mensual estrato 5 Bogotá: $5-10M
- Ahorro ideal: mínimo 20% del ingreso neto, ideal 30-50%
- Ratio vivienda: no más del 30% del ingreso en vivienda

11. FRAMEWORKS DE DECISIÓN FINANCIERA:
- Kiyosaki: Activo = genera ingreso. Pasivo = genera gasto. Tu casa NO es activo
- Buffett: "Precio es lo que pagas, valor es lo que recibes". Margin of safety >30%
- Dalio All-Weather: 30% acciones, 40% bonos largo, 15% bonos corto, 7.5% commodities, 7.5% oro
- Regla 72: años para duplicar = 72 ÷ tasa de rendimiento
- Regla 1%: propiedad en arriendo debería rentar ≥1% del valor/mes (en Colombia ~0.5-0.7%)
- Costo de oportunidad: siempre comparar contra la mejor alternativa disponible
- Apalancamiento: conviene SOLO cuando rendimiento > costo deuda + prima de riesgo
`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    const { messages, financialContext, userId } = JSON.parse(event.body);
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada. Contacta al administrador." }) };

    // Rate limit
    const key = userId || event.headers["x-forwarded-for"] || "anon";
    const now = Date.now();
    if (!rateLimits[key] || now - rateLimits[key].start > WINDOW) {
      rateLimits[key] = { start: now, count: 0 };
    }
    rateLimits[key].count++;
    const remaining = LIMIT - rateLimits[key].count;
    
    if (remaining < 0) {
      return { statusCode: 429, headers, body: JSON.stringify({ 
        error: "Límite de 30 consultas diarias alcanzado. Se renueva en " + Math.round((rateLimits[key].start + WINDOW - now) / 3600000) + " horas.",
        remaining: 0
      })};
    }

    const systemPrompt = `Eres el Asesor Financiero IA de FINPATHIA — plataforma premium de gestión patrimonial para familias colombianas con activos en Colombia y el exterior.

ROL: Actúas como un Family Office Advisor con +20 años de experiencia en:
- Gestión patrimonial y planificación financiera
- Tributación Colombia y USA  
- Inversiones (inmuebles, renta fija, variable, crypto)
- Pensiones (Colpensiones, fondos privados, FIRE)
- Sucesión y protección patrimonial
- Análisis de riesgo y diversificación

${EXPERT_KNOWLEDGE}

DATOS FINANCIEROS DEL USUARIO:
${financialContext}

REGLAS DE RESPUESTA:
1. Usa SIEMPRE los números exactos del usuario — nunca genéricos
2. Da recomendaciones accionables con montos específicos en COP
3. Si simulas escenarios, muestra ANTES vs DESPUÉS con cifras
4. Formatea: M = millones, B = miles de millones (billones COP)
5. Máximo 500 palabras por respuesta — sé conciso y directo
6. Si mencionas un %, calcula también el monto en pesos
7. Identifica riesgos que el usuario puede no ver
8. Si aplica, menciona implicaciones tributarias
9. Prioriza: liquidez → protección → crecimiento → optimización fiscal
10. Si no tienes datos suficientes, di exactamente qué falta
11. Nunca digas "consulta un asesor" — TÚ eres el asesor
12. Si el usuario pregunta algo fuera de finanzas, redirige amablemente`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await res.json();
    if (data.error) return { statusCode: 400, headers, body: JSON.stringify({ error: data.error.message, remaining }) };
    
    const reply = data.content?.map(b => b.text || "").join("") || "Sin respuesta";
    return { statusCode: 200, headers, body: JSON.stringify({ reply, remaining }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
