export type CurrencyCode = 'USD' | 'KRW' | 'JPY' | 'EUR' | 'GBP' | 'CNY' | 'USDT' | 'USDC';

export const currencyOptions: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'KRW', label: 'KRW (₩)', symbol: '₩' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'CNY', label: 'CNY (¥)', symbol: '¥' },
  { value: 'USDT', label: 'USDT (₮)', symbol: '₮' },
  { value: 'USDC', label: 'USDC ($)', symbol: '$' },
];

export const currencySymbols: Record<string, string> = {
  USD: '$',
  KRW: '₩',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
  USDT: '₮',
  USDC: '$',
};

export function formatCurrencyValue(value: number, currency: string = 'USD'): string {
  const symbol = currencySymbols[currency] || '$';

  // KRW and JPY typically don't use decimal places
  const noDecimalCurrencies = ['KRW', 'JPY'];
  const decimals = noDecimalCurrencies.includes(currency) ? 0 : 2;

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}
