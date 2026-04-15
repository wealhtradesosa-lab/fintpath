// ============================================================
// RegPack Colombia — DIAN / Colpensiones / AFP
// Constantes fiscales 2026
// ============================================================

const UVT = 52374;      // COP
const SMMLV = 1750905;  // COP

// Tabla de tarifas de renta (Art. 241 ET) en UVT
const RENTA_BRACKETS = [
  { desde: 0,    hasta: 1090,  tarifa: 0,    base: 0    },
  { desde: 1090, hasta: 1700,  tarifa: 0.19, base: 0    },
  { desde: 1700, hasta: 4100,  tarifa: 0.28, base: 116  },
  { desde: 4100, hasta: 8670,  tarifa: 0.33, base: 788  },
  { desde: 8670, hasta: 18970, tarifa: 0.35, base: 2296 },
  { desde: 18970,hasta: 31000, tarifa: 0.37, base: 5901 },
  { desde: 31000,hasta: Infinity, tarifa: 0.39, base: 10352 },
];

export const CO = {
  code: 'CO',
  name: 'Colombia',
  currency: 'COP',
  currencySymbol: '$',
  taxAgency: 'DIAN',
  locale: 'es-CO',

  constants: { UVT, SMMLV },

  labels: {
    incomeTax:        'Impuesto de Renta',
    taxAgency:        'DIAN',
    pension:          'Pensión Obligatoria',
    voluntaryPension: 'Pensión Voluntaria / AFC',
    healthContrib:    'Salud',
    vatLabel:         'IVA',
    retirementAccounts: ['AFP', 'Colpensiones', 'Pensión Voluntaria', 'AFC'],
    incomeTypes: {
      salary:     'Salario',
      freelance:  'Honorarios',
      rental:     'Arrendamiento',
      dividends:  'Dividendos',
      capitalGain:'Ganancia Ocasional',
    },
  },

  // Impuesto de renta sobre renta líquida gravable (en COP)
  calculateIncomeTax(rentaLiquidaCOP) {
    const uvts = rentaLiquidaCOP / UVT;
    let bracket = RENTA_BRACKETS.findLast(b => uvts > b.desde) || RENTA_BRACKETS[0];
    if (uvts <= 1090) return { tax: 0, effectiveRate: 0, bracket: '0%' };
    const tax = (bracket.base + (uvts - bracket.desde) * bracket.tarifa) * UVT;
    return {
      tax: Math.round(tax),
      effectiveRate: tax / rentaLiquidaCOP,
      bracket: `${bracket.tarifa * 100}%`,
    };
  },

  // Retención en la fuente estimada mensual (salario)
  getWithholdingRate(monthlySalaryCOP) {
    const annual = monthlySalaryCOP * 12;
    const result = CO.calculateIncomeTax(annual * 0.75); // aprox renta líquida
    return result.tax / 12 / monthlySalaryCOP;
  },

  // Aportes pensión obligatoria
  calculateRetirementContribution(salaryCOP) {
    return {
      employee: Math.round(salaryCOP * 0.04),
      employer: Math.round(salaryCOP * 0.12),
      total:    Math.round(salaryCOP * 0.16),
      label:    'Pensión Obligatoria (AFP / Colpensiones)',
    };
  },

  // Aportes salud
  calculateHealthContribution(salaryCOP) {
    return {
      employee: Math.round(salaryCOP * 0.04),
      employer: Math.round(salaryCOP * 0.085),
      total:    Math.round(salaryCOP * 0.125),
      label:    'Salud',
    };
  },

  // Ganancia ocasional (activos poseídos > 2 años)
  calculateCapitalGains(gainCOP, holdingDays) {
    const rate = holdingDays >= 730 ? 0.15 : 0.35;
    return {
      tax: Math.round(gainCOP * rate),
      rate,
      type: holdingDays >= 730 ? 'Ganancia Ocasional' : 'Renta Ordinaria',
    };
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(amount);
  },
};
