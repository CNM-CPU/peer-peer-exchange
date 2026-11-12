export const foreignCurrencies = [
  'AED', 'AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'GHS', 'INR', 'JPY',
  'KES', 'NGN', 'NZD', 'RWF', 'SGD', 'TZS', 'UGX', 'USD', 'ZAR',
]

export const supportedCurrencies = ['RUB', 'ECUSD', ...foreignCurrencies]

export function currencyName(currency: string) {
  return currency === 'ECUSD' ? 'EcoCash USD' : currency
}
