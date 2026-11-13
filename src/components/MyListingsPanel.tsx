import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  loadOwnListings,
  removeOwnListing,
  updateOwnListing,
  type ListingUpdateInput,
  type OwnedListing,
} from '../lib/listings'
import { currencyName, supportedCurrencies } from '../lib/currencies'

type ListingDraft = {
  advertiserName: string
  whatsappNumber: string
  currencyAvailable: string
  currencyWanted: string
  amount: string
  exchangeRate: string
}

function wantedCurrenciesFor(currencyAvailable: string) {
  return currencyAvailable === 'RUB'
    ? ['ECUSD']
    : currencyAvailable === 'ECUSD'
      ? ['RUB']
      : ['RUB', 'ECUSD']
}

function createDraft(listing: OwnedListing): ListingDraft {
  return {
    advertiserName: listing.advertiser_name,
    whatsappNumber: listing.whatsapp_number ?? '',
    currencyAvailable: listing.currency_available,
    currencyWanted: listing.currency_wanted,
    amount: String(listing.amount),
    exchangeRate: String(listing.exchange_rate),
  }
}

function formatRate(listing: OwnedListing) {
  return `1 ${currencyName(listing.currency_available)} = ${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(listing.exchange_rate)} ${currencyName(listing.currency_wanted)}`
}

export function MyListingsPanel() {
  const [listings, setListings] = useState<OwnedListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ListingDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const nextListings = await loadOwnListings()
      setListings(nextListings)
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load your adverts.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  function startEditing(listing: OwnedListing) {
    setEditingId(listing.id)
    setDraft(createDraft(listing))
    setActionError(null)
    setFeedback(null)
    setConfirmingRemovalId(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId || !draft) return
    const input: ListingUpdateInput = {
      advertiserName: draft.advertiserName.trim(),
      whatsappNumber: draft.whatsappNumber.trim(),
      currencyAvailable: draft.currencyAvailable,
      currencyWanted: draft.currencyWanted,
      amount: Number(draft.amount),
      exchangeRate: Number(draft.exchangeRate),
    }

    if (!input.advertiserName || input.currencyAvailable === input.currencyWanted) {
      setActionError('Enter an advertiser name and choose two different currencies.')
      return
    }
    if (!/^\+?[1-9][0-9]{7,14}$/.test(input.whatsappNumber)) {
      setActionError('Enter a valid WhatsApp number with its country code.')
      return
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 ||
      !Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) {
      setActionError('Amount and rate must be greater than zero.')
      return
    }

    setSavingId(editingId)
    setActionError(null)
    try {
      await updateOwnListing(editingId, input)
      setEditingId(null)
      setDraft(null)
      setFeedback('Advert updated.')
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this advert.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    setActionError(null)
    try {
      await removeOwnListing(id)
      setConfirmingRemovalId(null)
      setFeedback('Advert removed from the marketplace.')
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not remove this advert.')
    } finally {
      setRemovingId(null)
    }
  }

  function renderEditForm(listing: OwnedListing) {
    if (!draft || editingId !== listing.id) return null
    const wantedCurrencies = wantedCurrenciesFor(draft.currencyAvailable)

    return (
      <form className="advert-form listing-edit-form" onSubmit={(event) => { void handleSave(event) }}>
        <label>
          Your name or handle
          <input
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, advertiserName: event.target.value })}
            required
            value={draft.advertiserName}
          />
        </label>
        <label>
          WhatsApp number (include country code)
          <input
            inputMode="tel"
            maxLength={16}
            onChange={(event) => setDraft({ ...draft, whatsappNumber: event.target.value })}
            pattern="\+?[1-9][0-9]{7,14}"
            required
            type="tel"
            value={draft.whatsappNumber}
          />
        </label>
        <div className="form-row">
          <label>
            I have
            <select
              onChange={(event) => {
                const currencyAvailable = event.target.value
                const wantedCurrencies = wantedCurrenciesFor(currencyAvailable)
                setDraft({
                  ...draft,
                  currencyAvailable,
                  currencyWanted: wantedCurrencies.includes(draft.currencyWanted)
                    ? draft.currencyWanted
                    : wantedCurrencies[0],
                })
              }}
              value={draft.currencyAvailable}
            >
              {supportedCurrencies.map((code) => <option key={code} value={code}>{currencyName(code)}</option>)}
            </select>
          </label>
          <label>
            I want
            <select
              onChange={(event) => setDraft({ ...draft, currencyWanted: event.target.value })}
              value={draft.currencyWanted}
            >
              {wantedCurrencies.map((code) => <option key={code} value={code}>{currencyName(code)}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Amount available ({currencyName(draft.currencyAvailable)})
            <input
              min="0.00000001"
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              required
              step="any"
              type="number"
              value={draft.amount}
            />
          </label>
          <label>
            Rate
            <input
              min="0.00000001"
              onChange={(event) => setDraft({ ...draft, exchangeRate: event.target.value })}
              required
              step="any"
              type="number"
              value={draft.exchangeRate}
            />
          </label>
        </div>
        <p className="field-help">
          Rate means {currencyName(draft.currencyWanted)} per 1 {currencyName(draft.currencyAvailable)}.
        </p>
        <div className="listing-edit-actions">
          <button className="primary-button" disabled={savingId === listing.id} type="submit">
            {savingId === listing.id ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className="secondary-button"
            disabled={savingId === listing.id}
            onClick={() => { setEditingId(null); setDraft(null); setActionError(null) }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <section aria-labelledby="my-adverts-title" className="my-listings-panel">
      <div className="panel-heading">
        <div>
          <h2 id="my-adverts-title">My adverts</h2>
          <p>Manage your available listings. Reserved and completed adverts can’t be edited or removed.</p>
        </div>
        <button className="secondary-button" disabled={isLoading} onClick={() => { void refresh() }} type="button">
          Refresh
        </button>
      </div>

      {loadError && <p className="error-message" role="alert">{loadError}</p>}
      {actionError && <p className="error-message" role="alert">{actionError}</p>}
      {feedback && <p className="success-message" role="status">{feedback}</p>}
      {isLoading ? (
        <p className="admin-loading" role="status">Loading your adverts…</p>
      ) : !loadError && listings.length === 0 ? (
        <div className="empty-admin-state">
          <p>You haven’t published any adverts yet.</p>
        </div>
      ) : !loadError ? (
        <div className="owned-listings">
          {listings.map((listing) => {
            const isAvailable = listing.status === 'available'
            const isConfirmingRemoval = confirmingRemovalId === listing.id
            return (
              <article className="owned-listing-card" key={listing.id}>
                <div className="listing-heading">
                  <h3>{listing.advertiser_name}</h3>
                  <span className={`listing-status ${isAvailable ? 'listing-status-available' : ''}`}>
                    {listing.status}
                  </span>
                </div>
                <p className="listing-rate">{formatRate(listing)}</p>
                <p className="listing-amount">
                  Available: {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(listing.amount)}{' '}
                  {currencyName(listing.currency_available)}
                </p>
                {isAvailable && editingId !== listing.id && !isConfirmingRemoval && (
                  <div className="listing-edit-actions">
                    <button className="secondary-button" onClick={() => startEditing(listing)} type="button">Edit</button>
                    <button className="user-action" onClick={() => setConfirmingRemovalId(listing.id)} type="button">Remove</button>
                  </div>
                )}
                {isAvailable && isConfirmingRemoval && (
                  <div className="listing-edit-actions">
                    <span>Remove this advert?</span>
                    <button
                      className="user-action"
                      disabled={removingId === listing.id}
                      onClick={() => { void handleRemove(listing.id) }}
                      type="button"
                    >
                      {removingId === listing.id ? 'Removing…' : 'Confirm remove'}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={removingId === listing.id}
                      onClick={() => setConfirmingRemovalId(null)}
                      type="button"
                    >
                      Keep advert
                    </button>
                  </div>
                )}
                {renderEditForm(listing)}
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
