export const foreignCurrencies = [
  'AED', 'AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'GHS', 'INR', 'JPY',
  'KES', 'NGN', 'NZD', 'RWF', 'SGD', 'TZS', 'UGX', 'USD', 'ZAR',
]

export const supportedCurrencies = ['RUB', 'ECUSD', ...foreignCurrencies]

export function currencyName(currency: string) {
  return currency === 'ECUSD' ? 'EcoCash USD' : currency
}

export function formatExchangeRate(
  rate: number,
  currencyAvailable: string,
  currencyWanted: string,
) {
  const formattedRate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(rate)
  return `1 ${currencyName(currencyWanted)} = ${formattedRate} ${currencyName(currencyAvailable)}`
}
