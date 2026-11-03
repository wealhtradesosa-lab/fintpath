// ============================================================
// RegPack United States — IRS / Social Security / Medicare
// 2-nov-2026: ya no tiene tabla propia. Tramos, deducción estándar, ganancia
// de capital y límites salen de usStateTax.js (año fiscal vigente, 2026), y
// respeta el estado civil (antes solo soltero, con cifras 2025).
// ============================================================

import { US_TAX_YEAR, STANDARD_DEDUCTION, LTCG_BREAKPOINTS, US_LIMITS, federalTax } from "./usStateTax.js";

const SOCIAL_SECURITY_RATE = 0.062;
const MEDICARE_RATE        = 0.0145;

export const US = {
  code: 'US',
  name: 'United States',
  currency: 'USD',
  currencySymbol: '$',
  taxAgency: 'IRS',
  locale: 'en-US',

  taxYear: US_TAX_YEAR,

  constants: {
    standardDeduction: STANDARD_DEDUCTION.single,
    ssWageBase:        US_LIMITS.ssWageBase,
    limit401k:         US_LIMITS.k401,
    limitIRA:          US_LIMITS.ira,
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
    const ded = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
    const taxableIncome = Math.max(0, (Number(grossIncomeUSD) || 0) - ded);
    const { tax, marginalRate } = federalTax(taxableIncome, filingStatus);
    return {
      tax:           Math.round(tax),
      effectiveRate: grossIncomeUSD > 0 ? tax / grossIncomeUSD : 0,
      marginalRate,
      taxableIncome: Math.round(taxableIncome),
    };
  },

  // FICA: Social Security + Medicare
  calculateRetirementContribution(annualWageUSD) {
    const ssWage  = Math.min(annualWageUSD, US_LIMITS.ssWageBase);
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
  calculateCapitalGains(gainUSD, holdingDays, ordinaryIncomeUSD = 0, filingStatus = 'single') {
    const isLongTerm = holdingDays > 365;
    if (!isLongTerm) {
      // Short-term: taxed as ordinary income
      const result = US.calculateIncomeTax(ordinaryIncomeUSD + gainUSD, filingStatus);
      const baseline = US.calculateIncomeTax(ordinaryIncomeUSD, filingStatus);
      return {
        tax:  result.tax - baseline.tax,
        rate: result.marginalRate,
        type: 'Short-Term (Ordinary Income Rate)',
      };
    }
    // Largo plazo: la ganancia se apila encima del ingreso gravable ordinario y
    // cada tramo (0 / 15 / 20 %) se cobra solo sobre la parte que cae en él.
    const bp = LTCG_BREAKPOINTS[filingStatus] || LTCG_BREAKPOINTS.single;
    const ded = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
    const piso = Math.max(0, (Number(ordinaryIncomeUSD) || 0) - ded);
    const techo = piso + Math.max(0, Number(gainUSD) || 0);
    const enTramo = (desde, hasta) => Math.max(0, Math.min(techo, hasta) - Math.max(piso, desde));
    const tax = enTramo(bp.cero, bp.quince) * 0.15 + enTramo(bp.quince, Infinity) * 0.20;
    const rate = techo > bp.quince ? 0.20 : techo > bp.cero ? 0.15 : 0;
    return {
      tax:  Math.round(tax),
      rate,
      type: 'Long-Term Capital Gains',
    };
  },

  // Estimated quarterly withholding
  getWithholdingRate(annualIncomeUSD, filingStatus = 'single') {
    const result = US.calculateIncomeTax(annualIncomeUSD, filingStatus);
    return result.effectiveRate;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(amount);
  },
};
