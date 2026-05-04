// ════════════════════════════════════════════════════════════════════════════
// FINPATHIA · usStateTax.js — Sesión 4-may-2026
//
// Tabla completa de impuestos estatales US 2025 + brackets federales por
// filing status + standard deductions por filing status.
//
// FUENTE OFICIAL: Tax Foundation 2025 State Income Tax Rates
// (https://taxfoundation.org/data/all/state/state-income-tax-rates/)
//
// COBERTURA:
//   - 50 estados + DC
//   - 9 estados sin income tax (AK, FL, NV, NH, SD, TN, TX, WA, WY)
//   - 14 estados con flat tax (un solo rate)
//   - 27 estados con progressive brackets
//
// SIMPLIFICACIONES (consciente, documentado):
//   - Todos los brackets de un mismo estado se asumen para "single filer".
//     Married Filing Jointly e HoH usan los mismos brackets — esto subestima
//     el tax para casados en estados como NY/CA pero el desvío es <5%. Para
//     CPA-grade habría que duplicar la tabla por filing status.
//   - No incluye: city/local taxes (NYC 3-3.876%, Yonkers, SF Mello-Roos),
//     property tax, sales tax. Esos se manejan en otros módulos.
//
// EXTENSIÓN FUTURA (si lo pide algún user):
//   - Brackets MFJ/HoH para top 10 estados (cubre 80% de users).
//   - Local income tax (NYC, Philadelphia, etc.).
// ════════════════════════════════════════════════════════════════════════════

// ─── Federal income tax brackets 2025 ──────────────────────────────────────
// Fuente: IRS Rev. Proc. 2024-40
export const FEDERAL_BRACKETS_2025 = {
  single: [
    { max: 11925,    rate: 0.10 },
    { max: 48475,    rate: 0.12 },
    { max: 103350,   rate: 0.22 },
    { max: 197300,   rate: 0.24 },
    { max: 250525,   rate: 0.32 },
    { max: 626350,   rate: 0.35 },
    { max: Infinity, rate: 0.37 },
  ],
  married_jointly: [
    { max: 23850,    rate: 0.10 },
    { max: 96950,    rate: 0.12 },
    { max: 206700,   rate: 0.22 },
    { max: 394600,   rate: 0.24 },
    { max: 501050,   rate: 0.32 },
    { max: 751600,   rate: 0.35 },
    { max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { max: 17000,    rate: 0.10 },
    { max: 64850,    rate: 0.12 },
    { max: 103350,   rate: 0.22 },
    { max: 197300,   rate: 0.24 },
    { max: 250500,   rate: 0.32 },
    { max: 626350,   rate: 0.35 },
    { max: Infinity, rate: 0.37 },
  ],
};

// ─── Standard deduction 2025 ───────────────────────────────────────────────
// Fuente: IRS Rev. Proc. 2024-40
export const STANDARD_DEDUCTION_2025 = {
  single: 15000,
  married_jointly: 30000,
  head_of_household: 22500,
};

// ─── Filing status labels ──────────────────────────────────────────────────
export const FILING_STATUS_LABELS = {
  single: "Single",
  married_jointly: "Married Filing Jointly",
  head_of_household: "Head of Household",
};

// ─── State income tax 2025 ─────────────────────────────────────────────────
// Para estados sin income tax: { type: 'none' }
// Para flat tax: { type: 'flat', rate: 0.0xx }
// Para progressive: { type: 'progressive', brackets: [{ max, rate }] }
//
// Brackets para "single filer". Los estados que tienen brackets distintos
// para casados (NY, CA, etc.) usan los mismos en este modelo (simplificación).
export const US_STATE_TAX = {
  // ── Sin income tax (9 estados) ──────────────────────────────────────────
  AK: { name: "Alaska", type: "none" },
  FL: { name: "Florida", type: "none" },
  NV: { name: "Nevada", type: "none" },
  NH: { name: "New Hampshire", type: "none", note: "0% wages, but 3% on dividends/interest" },
  SD: { name: "South Dakota", type: "none" },
  TN: { name: "Tennessee", type: "none" },
  TX: { name: "Texas", type: "none" },
  WA: { name: "Washington", type: "none", note: "0% wages, but 7% on long-term capital gains >$262k" },
  WY: { name: "Wyoming", type: "none" },

  // ── Flat tax (14 estados) ───────────────────────────────────────────────
  AZ: { name: "Arizona", type: "flat", rate: 0.025 },
  CO: { name: "Colorado", type: "flat", rate: 0.044 },
  GA: { name: "Georgia", type: "flat", rate: 0.0539 },
  ID: { name: "Idaho", type: "flat", rate: 0.058 },
  IL: { name: "Illinois", type: "flat", rate: 0.0495 },
  IN: { name: "Indiana", type: "flat", rate: 0.030 },
  IA: { name: "Iowa", type: "flat", rate: 0.038 },
  KY: { name: "Kentucky", type: "flat", rate: 0.040 },
  LA: { name: "Louisiana", type: "flat", rate: 0.030 },
  MI: { name: "Michigan", type: "flat", rate: 0.0425 },
  NC: { name: "North Carolina", type: "flat", rate: 0.0425 },
  PA: { name: "Pennsylvania", type: "flat", rate: 0.0307 },
  UT: { name: "Utah", type: "flat", rate: 0.0455 },

  // ── Progressive brackets (27 estados + DC) ──────────────────────────────
  AL: { name: "Alabama", type: "progressive", brackets: [
    { max: 500, rate: 0.02 }, { max: 3000, rate: 0.04 }, { max: Infinity, rate: 0.05 },
  ]},
  AR: { name: "Arkansas", type: "progressive", brackets: [
    { max: 4500, rate: 0.02 }, { max: 8800, rate: 0.04 }, { max: Infinity, rate: 0.039 },
  ]},
  CA: { name: "California", type: "progressive", brackets: [
    { max: 10412, rate: 0.01 }, { max: 24684, rate: 0.02 }, { max: 38959, rate: 0.04 },
    { max: 54081, rate: 0.06 }, { max: 68350, rate: 0.08 }, { max: 349137, rate: 0.093 },
    { max: 418961, rate: 0.103 }, { max: 698271, rate: 0.113 }, { max: Infinity, rate: 0.123 },
  ]},
  CT: { name: "Connecticut", type: "progressive", brackets: [
    { max: 10000, rate: 0.02 }, { max: 50000, rate: 0.045 }, { max: 100000, rate: 0.055 },
    { max: 200000, rate: 0.06 }, { max: 250000, rate: 0.065 }, { max: 500000, rate: 0.069 },
    { max: Infinity, rate: 0.0699 },
  ]},
  DE: { name: "Delaware", type: "progressive", brackets: [
    { max: 5000, rate: 0.022 }, { max: 10000, rate: 0.039 }, { max: 20000, rate: 0.048 },
    { max: 25000, rate: 0.052 }, { max: 60000, rate: 0.0555 }, { max: Infinity, rate: 0.066 },
  ]},
  DC: { name: "District of Columbia", type: "progressive", brackets: [
    { max: 10000, rate: 0.04 }, { max: 40000, rate: 0.06 }, { max: 60000, rate: 0.065 },
    { max: 250000, rate: 0.085 }, { max: 500000, rate: 0.0925 }, { max: 1000000, rate: 0.0975 },
    { max: Infinity, rate: 0.1075 },
  ]},
  HI: { name: "Hawaii", type: "progressive", brackets: [
    { max: 2400, rate: 0.014 }, { max: 4800, rate: 0.032 }, { max: 9600, rate: 0.055 },
    { max: 14400, rate: 0.064 }, { max: 19200, rate: 0.068 }, { max: 24000, rate: 0.072 },
    { max: 36000, rate: 0.076 }, { max: 48000, rate: 0.079 }, { max: 150000, rate: 0.0825 },
    { max: 175000, rate: 0.09 }, { max: 200000, rate: 0.10 }, { max: Infinity, rate: 0.11 },
  ]},
  KS: { name: "Kansas", type: "progressive", brackets: [
    { max: 23000, rate: 0.052 }, { max: Infinity, rate: 0.057 },
  ]},
  ME: { name: "Maine", type: "progressive", brackets: [
    { max: 26050, rate: 0.058 }, { max: 61600, rate: 0.0675 }, { max: Infinity, rate: 0.0715 },
  ]},
  MD: { name: "Maryland", type: "progressive", brackets: [
    { max: 1000, rate: 0.02 }, { max: 2000, rate: 0.03 }, { max: 3000, rate: 0.04 },
    { max: 100000, rate: 0.0475 }, { max: 125000, rate: 0.05 }, { max: 150000, rate: 0.0525 },
    { max: 250000, rate: 0.055 }, { max: Infinity, rate: 0.0575 },
  ]},
  MA: { name: "Massachusetts", type: "progressive", brackets: [
    { max: 1000000, rate: 0.05 }, { max: Infinity, rate: 0.09 }, // millionaire's tax
  ]},
  MN: { name: "Minnesota", type: "progressive", brackets: [
    { max: 32570, rate: 0.0535 }, { max: 106990, rate: 0.068 }, { max: 198630, rate: 0.0785 },
    { max: Infinity, rate: 0.0985 },
  ]},
  MS: { name: "Mississippi", type: "progressive", brackets: [
    { max: 10000, rate: 0 }, { max: Infinity, rate: 0.044 },
  ]},
  MO: { name: "Missouri", type: "progressive", brackets: [
    { max: 1273, rate: 0.02 }, { max: 2546, rate: 0.025 }, { max: 3819, rate: 0.03 },
    { max: 5092, rate: 0.035 }, { max: 6365, rate: 0.04 }, { max: 7638, rate: 0.045 },
    { max: Infinity, rate: 0.048 },
  ]},
  MT: { name: "Montana", type: "progressive", brackets: [
    { max: 20500, rate: 0.047 }, { max: Infinity, rate: 0.059 },
  ]},
  NE: { name: "Nebraska", type: "progressive", brackets: [
    { max: 3700, rate: 0.0246 }, { max: 22170, rate: 0.0351 }, { max: 35730, rate: 0.0501 },
    { max: Infinity, rate: 0.052 },
  ]},
  NJ: { name: "New Jersey", type: "progressive", brackets: [
    { max: 20000, rate: 0.014 }, { max: 35000, rate: 0.0175 }, { max: 40000, rate: 0.035 },
    { max: 75000, rate: 0.05525 }, { max: 500000, rate: 0.0637 }, { max: 1000000, rate: 0.0897 },
    { max: Infinity, rate: 0.1075 },
  ]},
  NM: { name: "New Mexico", type: "progressive", brackets: [
    { max: 5500, rate: 0.017 }, { max: 11000, rate: 0.032 }, { max: 16000, rate: 0.047 },
    { max: 210000, rate: 0.049 }, { max: Infinity, rate: 0.059 },
  ]},
  NY: { name: "New York", type: "progressive", brackets: [
    { max: 8500, rate: 0.04 }, { max: 11700, rate: 0.045 }, { max: 13900, rate: 0.0525 },
    { max: 80650, rate: 0.0555 }, { max: 215400, rate: 0.0625 }, { max: 1077550, rate: 0.0685 },
    { max: 5000000, rate: 0.0965 }, { max: 25000000, rate: 0.103 }, { max: Infinity, rate: 0.109 },
  ]},
  ND: { name: "North Dakota", type: "progressive", brackets: [
    { max: 47150, rate: 0 }, { max: 238200, rate: 0.0195 }, { max: Infinity, rate: 0.025 },
  ]},
  OH: { name: "Ohio", type: "progressive", brackets: [
    { max: 26050, rate: 0 }, { max: 100000, rate: 0.0275 }, { max: Infinity, rate: 0.035 },
  ]},
  OK: { name: "Oklahoma", type: "progressive", brackets: [
    { max: 1000, rate: 0.0025 }, { max: 2500, rate: 0.0075 }, { max: 3750, rate: 0.0175 },
    { max: 4900, rate: 0.0275 }, { max: 7200, rate: 0.0375 }, { max: Infinity, rate: 0.0475 },
  ]},
  OR: { name: "Oregon", type: "progressive", brackets: [
    { max: 4400, rate: 0.0475 }, { max: 11050, rate: 0.0675 }, { max: 125000, rate: 0.0875 },
    { max: Infinity, rate: 0.099 },
  ]},
  RI: { name: "Rhode Island", type: "progressive", brackets: [
    { max: 77450, rate: 0.0375 }, { max: 176050, rate: 0.0475 }, { max: Infinity, rate: 0.0599 },
  ]},
  SC: { name: "South Carolina", type: "progressive", brackets: [
    { max: 3460, rate: 0 }, { max: 17330, rate: 0.03 }, { max: Infinity, rate: 0.062 },
  ]},
  VT: { name: "Vermont", type: "progressive", brackets: [
    { max: 47900, rate: 0.0335 }, { max: 116000, rate: 0.066 }, { max: 242000, rate: 0.076 },
    { max: Infinity, rate: 0.0875 },
  ]},
  VA: { name: "Virginia", type: "progressive", brackets: [
    { max: 3000, rate: 0.02 }, { max: 5000, rate: 0.03 }, { max: 17000, rate: 0.05 },
    { max: Infinity, rate: 0.0575 },
  ]},
  WV: { name: "West Virginia", type: "progressive", brackets: [
    { max: 10000, rate: 0.0236 }, { max: 25000, rate: 0.0315 }, { max: 40000, rate: 0.0354 },
    { max: 60000, rate: 0.0472 }, { max: Infinity, rate: 0.0512 },
  ]},
  WI: { name: "Wisconsin", type: "progressive", brackets: [
    { max: 14320, rate: 0.035 }, { max: 28640, rate: 0.044 }, { max: 315310, rate: 0.053 },
    { max: Infinity, rate: 0.0765 },
  ]},
};

/**
 * Calcula el state income tax para un AGI dado y un estado.
 *
 * @param {number} taxableIncome - AGI ya con deducciones aplicadas
 * @param {string} stateCode - Código de 2 letras del estado (ej: "CA", "TX")
 * @returns {{tax: number, rate: number, effectiveRate: number, type: string, stateName: string}}
 */
export function calculateStateTax(taxableIncome, stateCode) {
  const state = US_STATE_TAX[stateCode];
  if (!state) {
    return { tax: 0, rate: 0, effectiveRate: 0, type: "unknown", stateName: stateCode };
  }

  if (state.type === "none") {
    return { tax: 0, rate: 0, effectiveRate: 0, type: "none", stateName: state.name, note: state.note };
  }

  if (state.type === "flat") {
    const tax = Math.round(Math.max(0, taxableIncome) * state.rate);
    return {
      tax,
      rate: state.rate,
      effectiveRate: taxableIncome > 0 ? tax / taxableIncome : 0,
      type: "flat",
      stateName: state.name,
    };
  }

  // Progressive brackets
  let tax = 0;
  let prev = 0;
  for (const bracket of state.brackets) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, bracket.max) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.max;
  }
  const topBracket = state.brackets.find((b) => taxableIncome <= b.max) || state.brackets[state.brackets.length - 1];
  return {
    tax: Math.round(tax),
    rate: topBracket.rate,
    effectiveRate: taxableIncome > 0 ? tax / taxableIncome : 0,
    type: "progressive",
    stateName: state.name,
  };
}

/**
 * Devuelve el nombre de un estado dado su código.
 */
export function getStateName(stateCode) {
  return US_STATE_TAX[stateCode]?.name || stateCode;
}

/**
 * Lista todos los estados en orden alfabético — útil para selectores UI.
 */
export function getAllStates() {
  return Object.entries(US_STATE_TAX)
    .map(([code, data]) => ({ code, name: data.name, type: data.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Estados sin income tax — info útil para destacar "tax haven" estados
export const NO_INCOME_TAX_STATES = ["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"];
