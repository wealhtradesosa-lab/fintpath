// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · ai-chat.js — Asesor IA con conocimiento experto bilingüe
//
// Sesión 4-may-2026: refactor completo. Antes el asesor solo entendía
// Colombia (Colpensiones, UVT, ICA). Ahora detecta `jurisdiction` y elige:
//   - CO → Asesor en español, conocimiento Colombia + USA-para-colombianos
//   - US → Advisor en inglés, conocimiento US (federal + state + retirement)
//
// La diferencia es ENORME: un user de Austin TX que pregunta sobre 401k
// antes recibía respuestas mezclando Colpensiones con IRS code random.
// Ahora recibe respuestas de un CFP-equivalente entrenado en US tax code.
// ════════════════════════════════════════════════════════════════════════════

// ── Rate limit (in-memory, resets on cold start) ────────────────────────
const rateLimits = {};
const LIMIT = 15;
const WINDOW = 24 * 60 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE COLOMBIA
// 2-nov-2026 (#35 rehecho): sin tasas de mercado, cap rates ni patrimonios
// «por estrato» (el asesor los citaba como datos del usuario); topes de Art.
// 206, 126-1/126-4 y 336, dividendos (Ley 2277) y herencia corregidos. La
// revisión semanal de normas mantiene esta parte al día.
// ════════════════════════════════════════════════════════════════════════════
const KNOWLEDGE_CO = `
═══ CONOCIMIENTO EXPERTO DEL ASESOR FINPATHIA — COLOMBIA ═══

1. TRIBUTARIO COLOMBIA 2026:
- UVT 2026: $52,374 COP
- Tabla renta personas naturales (UVT): 0-1090: 0% | 1090-1700: 19% | 1700-4100: 28% | 4100-8670: 33% | 8670-18970: 35% | 18970-31000: 37% | >31000: 39%
- Rentas exentas y deducciones (Art. 336, Ley 2277/2022): en conjunto no pueden pasar del 40% del ingreso neto ni de 1.340 UVT al año. Dependientes (72 UVT por dependiente, hasta 4) y el 1% de compras con factura electrónica van por fuera de ese tope.
- Renta exenta del 25% de los pagos laborales: tope 790 UVT al AÑO (Art. 206 num. 10), dentro del tope del 40%/1.340 UVT.
- Aportes voluntarios a pensión y cuenta AFC (Arts. 126-1 y 126-4): hasta el 30% del ingreso del año y máximo 3.800 UVT al año, sumados, y además dentro del tope del 40%/1.340 UVT.
- GMF (4x1000): aplica a movimientos financieros, exención en cuenta marcada hasta 350 UVT/mes
- Impuesto al patrimonio: aplica si patrimonio líquido > 72,000 UVT (~$3.7B COP). Tarifa 0.5% a 1.5%
- Dividendos de sociedades nacionales (Arts. 242 y 254-1, Ley 2277/2022): la parte no gravada se suma a la cédula general y paga con la tabla del Art. 241; se descuenta el 19% de lo que exceda 1.090 UVT. La parte gravada (Art. 49 par. 2) paga primero la tarifa de sociedades (35%). Dividendos del exterior: cédula general, con descuento por impuestos pagados afuera
- Ganancia ocasional (venta activos >2 años): 15%
- GANANCIA OCASIONAL EN VENTA DE INMUEBLES (verificado 28-oct-2026):
  · Art. 300: activo fijo poseído 2 años o más → GO al 15% (Arts. 313-314, Ley 2277/2022). Menos de 2 años → renta ordinaria (persona natural hasta 39%, sociedad 35%).
  · Costo fiscal: se elige el MAYOR entre (a) Art. 69: compra + mejoras + contribuciones por valorización (+ reajuste Art. 70: 5,81% AG 2025, Decreto 449/2026); (b) Art. 73 SOLO personas naturales: costo de compra × factor de la tabla del Decreto 449/2026 (ej. urbano comprado en 2008 ×4,16; 2010 ×3,12; 2015 ×1,68; 2020 ×1,22); (c) Art. 72: avalúo catastral o autoavalúo del AÑO ANTERIOR a la venta que figure en predial o renta (personas y sociedades). No sirve avalúo de perito ni corregir declaraciones para subir valores. Si el inmueble no está en la renta, la DIAN (Oficio 561/2021) no admite el avalúo.
  · Art. 311-1: persona natural vendiendo SU casa/apto de habitación: primeras 5.000 UVT de la utilidad exentas (2026: $261.870.000) si TODO el dinero va a cuenta AFC para vivienda o directo al crédito hipotecario de esa vivienda. Es por la operación completa, no por copropietario (Concepto DIAN 820/2024). No aplica a inmuebles de sociedades.
  · Sociedades: depreciación recuperada → renta ordinaria 35% (Arts. 195-196). La GO neta de impuesto se distribuye como dividendo no gravado (Art. 49).
  · Art. 90: se escritura por el precio real, bajo juramento; el precio no puede ser inferior al costo ni al avalúo catastral. Art. 398: retención 1% al vendedor persona natural (anticipo).
  · Partir la venta en dos años NO reduce la GO (tarifa fija 15%).
- ICA Bogotá: varía 4.14‰ a 13.8‰ según actividad
- Régimen simple (IEST): para ingresos <100,000 UVT/año, tarifa 1.8% a 14.5%

2. TRIBUTARIO USA (para colombianos con activos allá):
- FIRPTA: al vender propiedad en USA, retención 15% del precio bruto si >$300K
- W-8BEN: formulario para reducir withholding en dividendos de 30% a 15% (tratado tributario)
- FBAR (FinCEN 114): obligatorio reportar si cuentas en exterior >$10,000
- FATCA (Form 8938): reporte si activos >$200K (soltero) o >$400K (casado)
- Estate tax USA: aplica a non-residents con activos USA >$60,000. Tarifa hasta 40%
- Solución: LLC + Trust revocable para propiedades USA = evita pruébate y reduce estate tax
- Rental income USA: se reporta en Form 1040-NR
- Tax treaty Colombia-USA: crédito tributario para evitar doble imposición

3. INVERSIONES (sin tasas de mercado):
- 2-nov-2026: aquí había tasas de CDT, fondos y retornos de mercado. Se quitaron porque quedaban desactualizadas y el asesor las citaba como ciertas. Para hablar de rentabilidad usa solo las tasas que el usuario cargó en <datos>.
- Inflación y tasa de BanRep: no las cites como dato; si importan, pídelas o usa las que traiga <datos>.

4. INMUEBLES (fórmulas; sin cap rates de mercado):
- Regla general: si cap rate < costo de deuda → no conviene apalancar
- NOI = Ingreso bruto - vacancy (5-8%) - opex (30-40%)
- Cash-on-Cash = NOI neto / capital propio invertido

5. PENSIONES COLOMBIA:
- Colpensiones (RPM): hombres 1,300 sem + 62 años | mujeres 1,300 sem + 57 años
- Pensión mínima: 1 SMMLV ($1,423,500 en 2025) / máxima: 25 SMMLV
- Fórmula RPM: promedio salarios últimos 10 años × tasa de reemplazo (65-80%)
- Tasa: 65% por 1300 sem + 1.5% por cada 50 sem adicionales (tope 80%)
- Fondo privado (RAIS): pensión = ahorro acumulado / expectativa de vida
- Generalmente RAIS da MENOS que Colpensiones para salarios medios-altos
- Para salarios altos Colpensiones suele dar una pensión mayor que el RAIS, pero depende de semanas, edad y saldo: no lo afirmes sin una proyección
- Traslado entre regímenes: posible hasta 10 años antes de edad de pensión

6. FIRE Y RETIRO:
- FIRE Number = gastos anuales × 25 (regla del 4%)
- Lean FIRE / Fat FIRE / Coast FIRE / Barista FIRE
- SWR: 3.5-4% para 30 años, 3-3.5% para retiro indefinido
- Sequence of returns risk: primeros 5 años críticos
- Bucket strategy: 2 años cash, 3-5 años bonos, resto acciones

7. SUCESIÓN PATRIMONIAL COLOMBIA:
- Herencia forzosa: 50% legítima rigurosa, 25% mejora, 25% libre disposición
- Legitimarios (herederos forzosos): hijos y, a falta de ellos, padres. El cónyuge no es legitimario: tiene porción conyugal
- Sociedad patrimonial: 50% del cónyuge no entra a herencia
- Impuesto herencia: ganancia ocasional 15%, con las exenciones del Art. 307 (el monto exacto lo calcula el módulo de Impuestos)
- Seguro de vida: NO entra a masa herencial → herramienta clave
- SAS familiar: facilita sucesión de negocios

8. FRAMEWORKS DE DECISIÓN:
- Kiyosaki: Activo = genera ingreso. Pasivo = genera gasto
- Buffett: margin of safety >30%
- Dalio All-Weather: 30% acciones, 40% bonos largo, 15% bonos corto, 7.5% commodities, 7.5% oro
- Regla 72: años para duplicar = 72 / tasa
- Regla 1%: propiedad debería rentar ≥1%/mes (Colombia ~0.5-0.7%)
- Apalancamiento: SOLO cuando rendimiento > costo deuda + prima riesgo
`;

// ════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE USA — nuevo, expert-grade
// ════════════════════════════════════════════════════════════════════════════
const KNOWLEDGE_US = `
═══ FINPATHIA AI ADVISOR — US KNOWLEDGE BASE (tax year 2026; items marked 2025 not yet updated) ═══

1. FEDERAL INCOME TAX 2026 (IRS Rev. Proc. 2025-32, includes One Big Beautiful Bill Act changes):
- Standard Deduction: Single $16,100 / MFJ $32,200 / HoH $24,150
- Tax brackets Single: 10% to $12,400 | 12% to $50,400 | 22% to $105,700 | 24% to $201,775 | 32% to $256,225 | 35% to $640,600 | 37% above
- Tax brackets MFJ: 10% to $24,800 | 12% to $100,800 | 22% to $211,400 | 24% to $403,550 | 32% to $512,450 | 35% to $768,700 | 37% above
- Tax brackets HoH 2026: not loaded here — do not quote them; point to Finpathia's Taxes module
- Long-term capital gains (held >1 year): 0%/15%/20% based on income
- Short-term capital gains: ordinary income rates
- NIIT (Net Investment Income Tax): 3.8% surtax on investment income above $200K (single) / $250K (MFJ)
- QBI deduction (§199A): up to 20% deduction for qualified business income (S-corp, LLC, sole prop)
- Wash sale rule: can't claim loss if you buy substantially identical security within 30 days

2. STATE INCOME TAX (2025 figures):
- 9 states with NO income tax: AK, FL, NV, NH, SD, TN, TX, WA, WY
- 14 states with FLAT tax: AZ 2.5%, CO 4.4%, GA 5.39%, ID 5.8%, IL 4.95%, IN 3%, IA 3.8%, KY 4%, LA 3%, MI 4.25%, NC 4.25%, PA 3.07%, UT 4.55%
- Top progressive states: CA 12.3% top, NY 10.9% top, NJ 10.75% top, HI 11% top, OR 9.9% top, MA 9% (millionaire tax)
- New Hampshire: 0% wages, 3% on dividends/interest
- Washington: 0% wages, 7% on long-term cap gains >$262K
- City taxes: NYC adds 3-3.876%, Yonkers, Philadelphia 3.79%
- Strategy: high-earners often relocate to TX/FL/NV for state tax savings

3. RETIREMENT ACCOUNTS (2025 limits; 2026 limits not yet loaded here — say they are 2025 figures):
- 401(k): contribution limit $23,500 + $7,500 catch-up (50+) + $11,250 catch-up (60-63 SECURE 2.0)
- Roth 401(k): same limits, after-tax contributions, tax-free growth & withdrawals
- Traditional IRA: $7,000 + $1,000 catch-up (50+). Deductible if income <$87K single / <$143K MFJ
- Roth IRA: $7,000 + $1,000 catch-up. Income phaseout: $150K-$165K single / $236K-$246K MFJ
- Backdoor Roth: high-earners contribute to Trad IRA → convert to Roth (uses pro-rata rule!)
- Mega Backdoor Roth: after-tax 401(k) contributions → in-plan Roth conversion (up to ~$70K total)
- HSA: $4,300 single / $8,550 family. Triple tax-advantaged: deduct, grow, withdraw for medical tax-free
- 529 plan: state tax deduction in some states. Now allows $35K rollover to Roth IRA (post-15 years)
- RMDs: start at age 73 (was 72). Failure to take = 25% penalty on shortfall
- Solo 401(k): for self-employed, contribute as employee + employer up to $69K
- SEP-IRA: 25% of compensation up to $69K — easier than Solo 401(k)
- Saver's Credit: tax credit if income <$76,500 MFJ for retirement contributions

4. SOCIAL SECURITY (2025 figures; 2026 not yet loaded here):
- Wage base: $176,100 (capped, 6.2% employer + 6.2% employee)
- Medicare: 1.45% no cap + Additional Medicare Tax 0.9% above $200K single / $250K MFJ
- Self-employment: pay both halves = 15.3% (15.3% on first $176,100, 2.9% above)
- Full Retirement Age (FRA): 67 for those born 1960+
- Earliest claim age: 62 (with permanent reduction ~30%)
- Delayed retirement credit: 8% per year until age 70
- Spousal benefit: up to 50% of higher earner's benefit
- Survivor benefit: 100% of deceased spouse's benefit
- Strategy: high earner delays to 70, lower earner claims at FRA

5. INVESTMENT VEHICLES (no market returns):
- 2-nov-2026: historical returns by fund/ticker were removed; use only the rates the user entered in <data>.
- I-Bonds: inflation-protected, capped at $10K/year
- TIPS: Treasury inflation-protected securities
- Account types: Taxable, IRA, Roth IRA, HSA, 401(k)
- Tax-efficient placement: bonds in Trad IRA, growth in Roth, broad index funds in taxable

6. REAL ESTATE US (no market cap rates or mortgage rates):
- Property tax: TX 1.5-2.5% / NJ 2.5% / NH 1.9% / FL 0.9% / CA 0.7-1.1% (Prop 13)
- Depreciation: 27.5 years residential / 39 years commercial
- 1031 exchange: defer capital gains by reinvesting in like-kind property within 180 days
- Cost segregation: accelerated depreciation for high-value rentals
- House hacking: live in part of duplex/triplex, deduct rest as rental
- BRRRR: Buy, Rehab, Rent, Refinance, Repeat

7. TAX PLANNING CONSIDERATIONS (estimates, not promised savings):
- Tax-loss harvesting: realize losses to offset gains, $3K/year against ordinary income
- Asset location: tax-inefficient assets (bonds, REITs) in retirement accounts
- Roth conversion ladder: convert Trad IRA to Roth in low-income years (early retirement)
- HSA "pay later" strategy: pay medical bills out of pocket, save receipts, withdraw HSA tax-free decades later
- 0% capital gains: married couples with taxable income <$96,700 pay 0% on LTCG
- Bunching deductions: consolidate charitable giving every other year to itemize
- Donor-Advised Fund (DAF): bunch deductions, distribute to charity over time
- QCD (Qualified Charitable Distribution): >70.5 give up to $108K/year directly from IRA, satisfies RMD
- Mega Backdoor Roth: most powerful for high earners with after-tax 401(k) option

8. INSURANCE & ASSET PROTECTION:
- Term life insurance: 10-12x annual income, 20-30 year term
- Whole life: rarely makes sense unless estate planning context
- Disability insurance: 60-70% of income, OWN-occupation rider critical
- Umbrella insurance: $1M-$5M, ~$200-500/year — protects net worth from lawsuits
- Long-term care: consider at age 50-55, hybrid LTC/life products
- LLC for rentals: liability shield, doesn't reduce taxes (passthrough)
- Asset protection states: NV, DE, WY trusts; SD perpetual trusts
- Homestead exemption: protects primary residence ($550K in CA, unlimited in FL/TX)

9. ESTATE PLANNING US:
- Federal estate tax basic exclusion: $15,000,000 per person for 2026 (One Big Beautiful Bill Act made it permanent and indexed; the TCJA sunset no longer applies)
- Gift tax annual exclusion: $19,000/recipient (2026, unchanged from 2025)
- Lifetime gift exemption: unified with the estate exclusion ($15M in 2026)
- Step-up in basis: heirs receive assets at FMV at death (massive tax benefit on appreciated assets)
- State estate tax: 12 states + DC have separate estate tax (MA, OR, WA, NY, etc.)
- Revocable Living Trust: avoids pruébate, public, doesn't reduce taxes
- Irrevocable trusts (ILIT, GRAT, IDGT, SLAT): asset protection, gift/estate tax planning
- 529 plans: not in estate, 5-year forward contribution allowed ($95K/recipient single)
- Beneficiary designations OVERRIDE will (401k, IRA, life insurance) — must update after divorce
- Power of Attorney + Healthcare Directive: essential at any age

10. FIRE / RETIRE EARLY US:
- 25x rule: invested savings = 25x annual expenses → 4% withdrawal rate
- Trinity Study: 4% SWR has 95% success rate over 30 years
- Coast FIRE: enough invested that compounding alone reaches retirement number
- Lean FIRE: $25-40K/year expenses
- Fat FIRE: $100K+/year expenses
- Sequence of returns risk: bad early years can wipe out portfolio
- Bond tent: increase bond allocation 5 years before/after retirement
- Roth conversion ladder for early retirement: convert IRA → Roth, withdraw conversions tax-free after 5 years
- ACA subsidies: "manage AGI" to keep healthcare premium subsidies

11. PROFESSIONAL FRAMEWORKS:
- Bogleheads Three-Fund Portfolio: total US stock index + international stock index + bond index (simple, low-cost)
- Bill Bengen 4% rule (1994 Trinity Study)
- Ray Dalio All-Weather: 30% stocks / 40% long bonds / 15% short bonds / 7.5% gold / 7.5% commodities
- Buffett's 90/10: 90% S&P 500 + 10% short-term Treasuries
- Rule of 72: years to double = 72 / rate
- Rule of 110: stock allocation = 110 - age (rule of thumb)
- 50/30/20 budget: 50% needs / 30% wants / 20% savings & debt
- Dave Ramsey baby steps: $1K emergency → debt snowball → 3-6mo emergency → 15% retirement → kids college → mortgage → wealth/giving
`;

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// 2-nov-2026 (#35 rehecho): el prompt y las reglas viven en _asesorIA.cjs
// (puro, con pruebas). Antes pedía «montos específicos», «máximo 500 palabras»
// y «nunca digas consulta un asesor: TÚ eres el asesor»; de ahí salían los
// datos inventados, las órdenes y las respuestas cortadas que encontró QA.
// ════════════════════════════════════════════════════════════════════════════
const A = require("./_asesorIA.cjs");

function buildSystemPrompt({ jurisdiction, financialContext, taxConfig }) {
  return A.construirPromptSistema({
    jurisdiction, financialContext, taxConfig,
    conocimiento: jurisdiction === "US" ? KNOWLEDGE_US : KNOWLEDGE_CO,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 11-oct-2026 — EVENTO advisor_used (una vez por persona, durante la prueba)
// La primera vez que alguien en prueba le pregunta al Asesor IA se marca
// accounts.advisor_first_used_at (solo si estaba vacío) y se emite
// "advisor_used" por el mismo camino que "activation" (GA4 MP o log).
// Nunca lleva el texto de la pregunta, montos ni user_id. Corre en paralelo
// a la llamada a Anthropic y cualquier error se traga: jamás frena ni rompe
// el chat. Antes de aplicar la migración la columna no existe: el PATCH
// falla, se loguea y el chat sigue igual.
// ════════════════════════════════════════════════════════════════════════════
async function marcarAsesorUsado(userId, cookieHeader) {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key || !userId) return;
    const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); // fecha COT
    // Solo cuentas en prueba: plan free con trial_end vigente.
    const r = await fetch(
      `${url}/rest/v1/accounts?owner_user_id=eq.${encodeURIComponent(userId)}` +
      `&advisor_first_used_at=is.null&plan=eq.free&trial_end=gte.${hoy}`,
      {
        method: "PATCH",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ advisor_first_used_at: new Date().toISOString() }),
      }
    );
    if (!r.ok) { console.warn("[ai-chat] advisor_used PATCH status", r.status); return; }
    const filas = await r.json();
    if (!Array.isArray(filas) || filas.length === 0) return; // ya marcado o no está en prueba
    const { emitirEvento, clientIdDesdeCookie } = require("../lib/ga4.cjs");
    const f = filas[0];
    await emitirEvento({
      nombre: "advisor_used",
      clientId: clientIdDesdeCookie(cookieHeader),
      utm: f.entry_utm || {},
      angulo: f.entry_angle || null,
    });
  } catch (e) {
    console.warn("[ai-chat] advisor_used falló (no afecta el chat):", e?.message || e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════════════
const MODELO = "claude-sonnet-4-5-20250929";
// Si la primera respuesta tardó más que esto no se reintenta el formato: dos
// llamadas seguidas podían pasar el límite de la función y devolver 504.
const MS_MAX_PARA_REINTENTAR = 12000;

async function llamarAnthropic({ key, system, messages }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELO, max_tokens: A.MAX_TOKENS, system, messages }),
  });
  const data = await res.json().catch(() => ({ error: { message: "respuesta no legible" } }));
  if (!res.ok || data.error) return { error: data?.error?.message || `HTTP ${res.status}` };
  return { texto: data.content?.map((b) => b.text || "").join("") || "", stop: data.stop_reason };
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method not allowed" };

  try {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Solicitud inválida." }) }; }
    const { messages, financialContext, jurisdiction, taxConfig, accion } = body;
    const idioma = jurisdiction === "US" ? "en" : "es";
    // 28-sep-2026: sin sesión no hay IA (el userId del body era texto libre).
    const { usuarioDesdeToken, sinSesion } = require("./_auth.cjs");
    const quien = await usuarioDesdeToken(event);
    if (!quien) return sinSesion(headers, "Inicia sesión para usar el Asesor IA.");
    const userId = quien.id;

    // ── CUOTA EN EL SERVIDOR ───────────────────────────────────────────────
    // 26-oct-2026: la misma cuota mensual de las otras funciones de IA (free 10,
    // básico 30, pro 150, pro familiar 400); el contador en memoria solo queda
    // de respaldo si Supabase no está configurado.
    // 2-nov-2026 (#35): la prueba de 14 días cuenta como Pro (leerPlanIA), el
    // mes se corta en hora de Colombia, y `accion: "cuota"` devuelve las
    // restantes sin consumir para que la pantalla muestre el contador real (el
    // de localStorage volvía a 15 al recargar).
    const C = require("./_cuotaIA.cjs");
    const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const conSupabase = !!(SUPA_URL && SERVICE_KEY);

    if (accion === "cuota") {
      if (!conSupabase) return { statusCode: 200, headers, body: JSON.stringify({ restantes: null, tope: null }) };
      const plan = await C.leerPlanIA({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });
      const tope = C.topeDe(plan);
      const usos = await C.consultarUsos({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });
      return { statusCode: 200, headers, body: JSON.stringify({ restantes: usos == null ? null : Math.max(0, tope - usos), tope }) };
    }

    // Historial limpio (solo user/assistant, últimos turnos, termina en el
    // usuario). Sin pregunta válida no se consume cuota.
    const mensajes = A.limpiarMensajes(messages);
    if (!mensajes.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: idioma === "en" ? "Write a question." : "Escribe una pregunta." }) };
    }

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada. Contacta al administrador." }) };
    }

    let restantes = null, tope = null;
    if (conSupabase) {
      const plan = await C.leerPlanIA({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId });
      const cuota = await C.consumirCuota({ url: SUPA_URL, serviceKey: SERVICE_KEY, userId, plan });
      const r = A.resumenCuota(cuota);
      restantes = r.restantes; tope = r.tope;
      if (!cuota.permitido) {
        return { statusCode: 429, headers, body: JSON.stringify({
          error: "cuota_ia_agotada", mensaje: A.mensajeCuotaAsesor({ tope: cuota.tope, plan: cuota.plan, idioma }),
          restantes: 0, remaining: 0, tope: cuota.tope,
        }) };
      }
    } else {
      const now = Date.now();
      if (!rateLimits[userId] || now - rateLimits[userId].start > WINDOW) rateLimits[userId] = { start: now, count: 0 };
      rateLimits[userId].count++;
      restantes = LIMIT - rateLimits[userId].count;
      tope = LIMIT;
      if (restantes < 0) {
        const horas = Math.round((rateLimits[userId].start + WINDOW - now) / 3600000);
        const errMsg = idioma === "en"
          ? `Daily limit of ${LIMIT} messages reached. Resets in ${horas} hours.`
          : `Llegaste al límite de ${LIMIT} consultas de hoy. Se renueva en ${horas} horas.`;
        return { statusCode: 429, headers, body: JSON.stringify({ error: errMsg, restantes: 0, remaining: 0, tope }) };
      }
    }

    // advisor_used: arranca en paralelo, sin await (ver marcarAsesorUsado).
    const pAsesorUsado = marcarAsesorUsado(userId, event.headers?.cookie || event.headers?.Cookie).catch(() => {});

    const systemPrompt = buildSystemPrompt({ jurisdiction, financialContext, taxConfig });
    const t0 = Date.now();
    const primera = await llamarAnthropic({ key: ANTHROPIC_KEY, system: systemPrompt, messages: mensajes });
    if (primera.error) return { statusCode: 400, headers, body: JSON.stringify({ error: primera.error, restantes, remaining: restantes, tope }) };

    // Revisión de las opciones (máximo 2, con Pro y Contra; las fijas en
    // «qué deuda primero» y «fondo de emergencia»). Si no cumple, se pide UNA
    // vez más con una instrucción correctiva; cuenta como un solo uso. Si el
    // reintento falla o sale peor, queda la primera.
    const pregunta = mensajes[mensajes.length - 1].content;
    let final = primera, reintentada = false;
    const rev1 = A.revisarOpciones(primera.texto, pregunta);
    if (!rev1.ok && primera.stop !== "max_tokens" && Date.now() - t0 < MS_MAX_PARA_REINTENTAR) {
      reintentada = true;
      const segunda = await llamarAnthropic({
        key: ANTHROPIC_KEY, system: systemPrompt,
        messages: [...mensajes, { role: "assistant", content: primera.texto }, { role: "user", content: A.instruccionCorrectiva(rev1, idioma) }],
      });
      if (!segunda.error && segunda.texto && A.revisarOpciones(segunda.texto, pregunta).problemas.length < rev1.problemas.length) final = segunda;
    }

    const { texto: reply, recortada } = A.recortarRespuesta(final.texto || (idioma === "en" ? "No answer." : "Sin respuesta."), final.stop, idioma);
    // Como mucho 300 ms extra para el evento; nunca bloquea la respuesta.
    await Promise.race([pAsesorUsado, new Promise((r) => setTimeout(r, 300))]);
    return { statusCode: 200, headers, body: JSON.stringify({ reply, recortada, reintentada, restantes, remaining: restantes, tope }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
