/**
 * Static fallback data derived from MYATT'S FIELDS COCKTAILS BUYING.xlsx
 * Used when Shopify/QuickBooks APIs are not yet connected.
 * Replace with live API calls once credentials are configured.
 */

export const STATIC_ANNUAL_REVENUE = [
  { year: '2017', dtc: 0,     wholesale: 1200,   total: 1200   },
  { year: '2018', dtc: 2100,  wholesale: 8400,   total: 10500  },
  { year: '2019', dtc: 4800,  wholesale: 22000,  total: 26800  },
  { year: '2020', dtc: 14200, wholesale: 18000,  total: 32200  }, // COVID DTC peak
  { year: '2021', dtc: 9600,  wholesale: 48000,  total: 57600  },
  { year: '2022', dtc: 8200,  wholesale: 141100, total: 149300 },
  { year: '2023', dtc: 6800,  wholesale: 102400, total: 109200 },
  { year: '2024', dtc: 4100,  wholesale: 97000,  total: 101100 }, // Amazon ~£40k on top
  { year: '2025', dtc: 2800,  wholesale: 44000,  total: 46800  }, // Partial year
]


export const STATIC_ALERTS = [
  {
    type: 'warning' as const,
    title: 'Concentration Risk',
    message: 'Cripps + F&M account for ~74% of wholesale revenue. Diversification target: <50% by 2026.',
  },
  {
    type: 'info' as const,
    title: 'DTC Trend',
    message: 'DTC revenue is down 89% from 2020 peak. New box campaign targeting £15k DTC in 2026.',
  },
]
