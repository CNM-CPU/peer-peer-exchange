import { useState, type FormEvent } from 'react'
import { createListing } from '../lib/listings'
import { currencyName, supportedCurrencies } from '../lib/currencies'

export function ListingForm({
  displayName,
  onListingCreated,
}: {
  displayName: string
  onListingCreated: (currencyAvailable: string, currencyWanted: string) => void
}) {
  const [advertiserNameOverride, setAdvertiserNameOverride] = useState<string | null>(null)
  const advertiserName = advertiserNameOverride ?? displayName
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [currencyAvailable, setCurrencyAvailable] = useState('RUB')
  const [currencyWanted, setCurrencyWanted] = useState('ECUSD')
  const [amount, setAmount] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wantedCurrencies = currencyAvailable === 'RUB'
    ? ['ECUSD']
    : currencyAvailable === 'ECUSD'
      ? ['RUB']
      : ['RUB', 'ECUSD']

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (advertiserName.trim().length === 0) {
      setError('Enter your name or handle.')
      return
    }
    if (currencyAvailable === currencyWanted) {
      setError('Choose two different currencies.')
      return
    }

    setIsSubmitting(true)
    try {
      await createListing({
        advertiserName: advertiserName.trim(),
        whatsappNumber: whatsappNumber.trim(),
        currencyAvailable,
        currencyWanted,
        amount: Number(amount),
        exchangeRate: Number(exchangeRate),
      })
      onListingCreated(currencyAvailable, currencyWanted)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish the advert.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="create-ad-title" className="form-panel">
      <div className="panel-heading">
        <h2 id="create-ad-title">Add an advert</h2>
        <p>Publish the exchange terms people will see on the marketplace.</p>
      </div>
      <form className="advert-form" onSubmit={(event) => { void handleSubmit(event) }}>
        <label>
          Your name or handle
          <input
            autoComplete="nickname"
            maxLength={80}
            onChange={(event) => setAdvertiserNameOverride(event.target.value)}
            required
            value={advertiserName}
          />
        </label>
        <label>
          WhatsApp number (include country code)
          <input
            autoComplete="tel"
            inputMode="tel"
            maxLength={16}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            pattern="\+?[1-9][0-9]{7,14}"
            placeholder="+263771234567"
            required
            type="tel"
            value={whatsappNumber}
          />
        </label>
        <div className="form-row">
          <label>
            I have
            <select
              onChange={(event) => {
                const nextCurrency = event.target.value
                const nextWantedCurrencies = nextCurrency === 'RUB'
                  ? ['ECUSD']
                  : nextCurrency === 'ECUSD'
                    ? ['RUB']
                    : ['RUB', 'ECUSD']
                const nextCurrencyWanted = nextWantedCurrencies.includes(currencyWanted)
                  ? currencyWanted
                  : nextWantedCurrencies[0]
                setCurrencyAvailable(nextCurrency)
                setCurrencyWanted(nextCurrencyWanted)
                if (nextCurrency !== currencyAvailable) setAmount('')
                if (nextCurrency !== currencyAvailable || nextCurrencyWanted !== currencyWanted) {
                  setExchangeRate('')
                }
              }}
              value={currencyAvailable}
            >
              {supportedCurrencies.map((code) => <option key={code} value={code}>{currencyName(code)}</option>)}
            </select>
          </label>
          <label>
            I want
            <select
              onChange={(event) => {
                const nextCurrency = event.target.value
                setCurrencyWanted(nextCurrency)
                if (nextCurrency !== currencyWanted) setExchangeRate('')
              }}
              value={currencyWanted}
            >
              {wantedCurrencies.map((code) => <option key={code} value={code}>{currencyName(code)}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Amount available ({currencyName(currencyAvailable)})
            <input
              min="0.00000001"
              onChange={(event) => setAmount(event.target.value)}
              required
              step="any"
              type="number"
              value={amount}
            />
          </label>
          <label>
            Rate ({currencyName(currencyAvailable)} per 1 {currencyName(currencyWanted)})
            <input
              aria-describedby="rate-help"
              min="0.00000001"
              onChange={(event) => setExchangeRate(event.target.value)}
              required
              step="any"
              type="number"
              value={exchangeRate}
            />
          </label>
        </div>
        <p className="field-help" id="rate-help">
          Enter how many {currencyName(currencyAvailable)} you offer for each 1 {currencyName(currencyWanted)}.
        </p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Publishing…' : 'Publish advert'}
        </button>
      </form>
    </section>
  )
}
