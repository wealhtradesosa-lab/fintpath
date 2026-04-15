// ============================================================
// RegPack United States — IRS / Social Security / Medicare
// Tax Year 2025 — Single filer (expandable to other statuses)
// ============================================================

// Federal income tax brackets 2025 — Single filer
const FEDERAL_BRACKETS = [
  { desde: 0,       hasta: 11925,   tarifa: 0.10 },
  { desde: 11925,   hasta: 48475,   tarifa: 0.12 },
  { desde: 48475,   hasta: 103350,  tarifa: 0.22 },
  { desde: 103350,  hasta: 197300,  tarifa: 0.24 },
  { desde: 197300,  hasta: 250525,  tarifa: 0.32 },
  { desde: 250525,  hasta: 626350,  tarifa: 0.35 },
  { desde: 626350,  hasta: Infinity,tarifa: 0.37 },
];

const STANDARD_DEDUCTION_2025 = 15000; // Single filer
const SOCIAL_SECURITY_RATE     = 0.062;
const MEDICARE_RATE            = 0.0145;
const SS_WAGE_BASE_2025        = 176100;
const CONTRIB_401K_LIMIT_2025  = 23500;
const CONTRIB_IRA_LIMIT_2025   = 7000;

export const US = {
  code: 'US',
  name: 'United States',
  currency: 'USD',
  currencySymbol: '$',
  taxAgency: 'IRS',
  locale: 'en-US',

  constants: {
    standardDeduction: STANDARD_DEDUCTION_2025,
    ssWageBase:        SS_WAGE_BASE_2025,
    limit401k:         CONTRIB_401K_LIMIT_2025,
    limitIRA:          CONTRIB_IRA_LIMIT_2025,
  },

  labels: {
    incomeTax:        'Federal Income Tax',
    taxAgency:        'IRS',
    pension:          'Social Security',
    voluntaryPension: '401(k) / IRA',
    healthContrib:    'Medicare',
    vatLabel:         'Sales Tax',
    retirementAccounts: ['401(k)', 'Roth 401(k)', 'IRA', 'Roth IRA', 'HSA'],
    incomeTypes: {
      salary:     'W-2 Wages',
      freelance:  '1099 / Self-Employment',
      rental:     'Rental Income',
      dividends:  'Dividends',
      capitalGain:'Capital Gains',
    },
  },

  // Federal income tax (progressive brackets)
  calculateIncomeTax(grossIncomeUSD, filingStatus = 'single') {
    const taxableIncome = Math.max(0, grossIncomeUSD - STANDARD_DEDUCTION_2025);
    let tax = 0;
    let prev = 0;
    for (const bracket of FEDERAL_BRACKETS) {
      if (taxableIncome <= prev) break;
      const taxable = Math.min(taxableIncome, bracket.hasta) - prev;
      tax += taxable * bracket.tarifa;
      prev = bracket.hasta;
    }
    const topBracket = FEDERAL_BRACKETS.findLast(b => taxableIncome > b.desde);
    return {
      tax:           Math.round(tax),
      effectiveRate: grossIncomeUSD > 0 ? tax / grossIncomeUSD : 0,
      marginalRate:  topBracket?.tarifa ?? 0.10,
      taxableIncome: Math.round(taxableIncome),
    };
  },

  // FICA: Social Security + Medicare
  calculateRetirementContribution(annualWageUSD) {
    const ssWage  = Math.min(annualWageUSD, SS_WAGE_BASE_2025);
    const ss      = Math.round(ssWage * SOCIAL_SECURITY_RATE);
    const medicare = Math.round(annualWageUSD * MEDICARE_RATE);
    return {
      employee:  ss + medicare,
      employer:  ss + medicare, // employer matches
      total:     (ss + medicare) * 2,
      breakdown: { socialSecurity: ss, medicare },
      label:     'FICA (Social Security + Medicare)',
    };
  },

  // Capital gains tax
  calculateCapitalGains(gainUSD, holdingDays, ordinaryIncomeUSD = 0) {
    const isLongTerm = holdingDays > 365;
    if (!isLongTerm) {
      // Short-term: taxed as ordinary income
      const result = US.calculateIncomeTax(ordinaryIncomeUSD + gainUSD);
      const baseline = US.calculateIncomeTax(ordinaryIncomeUSD);
      return {
        tax:  result.tax - baseline.tax,
        rate: result.marginalRate,
        type: 'Short-Term (Ordinary Income Rate)',
      };
    }
    // Long-term rates 2025
    let rate = 0;
    if (ordinaryIncomeUSD > 518900) rate = 0.20;
    else if (ordinaryIncomeUSD > 47025) rate = 0.15;
    return {
      tax:  Math.round(gainUSD * rate),
      rate,
      type: 'Long-Term Capital Gains',
    };
  },

  // Estimated quarterly withholding
  getWithholdingRate(annualIncomeUSD) {
    const result = US.calculateIncomeTax(annualIncomeUSD);
    return result.effectiveRate;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(amount);
  },
};
