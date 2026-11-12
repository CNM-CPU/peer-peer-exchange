import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownUp, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react'
import {
  completeListing,
  loadListings,
  reserveListing,
  type MarketplaceListing,
} from './lib/listings'
import { currencyName, foreignCurrencies } from './lib/currencies'
import { supabase, supabaseConfigurationError } from './lib/supabase'
import { ListingForm } from './components/ListingForm'
import { AdminPanel } from './components/AdminPanel'
import './App.css'

type Direction = 'rub-ecusd' | 'ecusd-rub' | 'specific'
type MainView = 'marketplace' | 'create' | 'admin'

const directionOptions: { value: Direction; label: string }[] = [
  { value: 'rub-ecusd', label: 'I have RUB → want EcoCash USD' },
  { value: 'ecusd-rub', label: 'I have EcoCash USD → want RUB' },
  { value: 'specific', label: 'I want a specific foreign currency' },
]

const reservationMinutes = 20
const refreshIntervalMs = 15_000

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)
}

function formatRate(rate: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(rate)
}

function formatWhatsAppNumber(listing: MarketplaceListing) {
  if (!listing.whatsapp_number) return null
  const phone = listing.whatsapp_number.replace(/\D/g, '')
  if (phone.length < 8 || phone.length > 15) return null
  return `+${phone}`
}

function getWhatsAppUrl(listing: MarketplaceListing) {
  const phone = formatWhatsAppNumber(listing)
  if (!phone) return null

  const message = `Hi ${listing.advertiser_name}, I saw your listing to exchange ${currencyName(listing.currency_available)} for ${currencyName(listing.currency_wanted)}. Is it still available?`
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`
}

function ListingCard({
  listing,
  isDemo,
  isContacting,
  isBusy,
  hasReservation,
  onContact,
}: {
  listing: MarketplaceListing
  isDemo: boolean
  isContacting: boolean
  isBusy: boolean
  hasReservation: boolean
  onContact: (listing: MarketplaceListing) => void
}) {
  const whatsappUrl = getWhatsAppUrl(listing)
  const whatsappNumber = formatWhatsAppNumber(listing)
  let contactLabel = 'Contact on WhatsApp'
  if (isDemo) contactLabel = 'WhatsApp unavailable in preview'
  else if (isContacting) contactLabel = 'Reserving listing…'
  else if (isBusy) contactLabel = 'Contact in progress'
  else if (hasReservation) contactLabel = 'Complete current reservation first'

  return (
    <article className="listing-card">
      <div className="listing-heading">
        <h3>{listing.advertiser_name}</h3>
        <span className="listing-rate">
          1 {currencyName(listing.currency_available)} = {formatRate(listing.exchange_rate)}{' '}
          {currencyName(listing.currency_wanted)}
        </span>
      </div>
      <p className="listing-pair">
        {currencyName(listing.currency_available)} <ArrowDownUp aria-hidden="true" size={14} />{' '}
        {currencyName(listing.currency_wanted)}
      </p>
      <p className="listing-amount">
        Available: {formatAmount(listing.amount)} {currencyName(listing.currency_available)}
      </p>
      <button
        className="contact-button"
        disabled={isDemo || !whatsappUrl || isBusy || hasReservation}
        onClick={() => onContact(listing)}
        type="button"
      >
        {isContacting ? <LoaderCircle aria-hidden="true" className="spinner" size={16} /> : null}
        <span className="contact-copy">
          {contactLabel}
          {!isDemo && whatsappNumber && <small>{whatsappNumber}</small>}
        </span>
      </button>
      {!isDemo && !whatsappUrl && (
        <p className="contact-unavailable">This advertiser has not added a valid WhatsApp number.</p>
      )}
    </article>
  )
}

function App() {
  const [direction, setDirection] = useState<Direction>('rub-ecusd')
  const [specificCurrency, setSpecificCurrency] = useState('EUR')
  const [payWith, setPayWith] = useState('RUB')
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contactingId, setContactingId] = useState<string | null>(null)
  const [reservedListingId, setReservedListingId] = useState<string | null>(null)
  const [isCompletingReservation, setIsCompletingReservation] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [isSuspended, setIsSuspended] = useState(false)
  const [view, setView] = useState<MainView>('marketplace')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [email, setEmail] = useState('')
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [signInMessage, setSignInMessage] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setAuthReady(true)
        if (!nextSession) {
          setReservedListingId(null)
          setIsSuspended(false)
          setView('marketplace')
        }
      }
    })

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setSignInError(error.message)
        setSession(data.session)
      })
      .catch((cause: unknown) => {
        if (active) setSignInError(cause instanceof Error ? cause.message : 'Could not check sign-in status.')
      })
      .finally(() => {
        if (active) setAuthReady(true)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        const result = await loadListings()
        if (!active) return
        setListings(result.listings)
        setIsDemo(result.isDemo)
        setIsSuspended(result.isSuspended)
        setLoadError(null)
      } catch (cause) {
        if (!active) return
        setLoadError(cause instanceof Error ? cause.message : 'An unexpected error occurred.')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    if (supabase && !session) {
      return () => { active = false }
    }
    if (view !== 'marketplace') return () => { active = false }

    void refresh()
    if (!supabase) return () => { active = false }

    const intervalId = window.setInterval(() => { void refresh() }, refreshIntervalMs)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [session, refreshVersion, view])

  const isAdmin = session?.user.app_metadata.role === 'admin'

  const selectedPair = useMemo(() => {
    if (direction === 'rub-ecusd') return { have: 'RUB', want: 'ECUSD' }
    if (direction === 'ecusd-rub') return { have: 'ECUSD', want: 'RUB' }
    return { have: payWith, want: specificCurrency }
  }, [direction, payWith, specificCurrency])

  const matchingListings = useMemo(
    () =>
      listings
        .filter((listing) =>
          listing.currency_available === selectedPair.want &&
          listing.currency_wanted === selectedPair.have,
        )
        .sort((a, b) => a.exchange_rate - b.exchange_rate),
    [listings, selectedPair],
  )

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setIsSendingLink(true)
    setSignInError(null)
    setSignInMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })
      if (error) {
        setSignInError(error.message)
      } else {
        setSignInMessage('Check your email for a secure sign-in link.')
      }
    } catch (cause) {
      setSignInError(cause instanceof Error ? cause.message : 'Could not send the sign-in link.')
    } finally {
      setIsSendingLink(false)
    }
  }

  async function handleContact(listing: MarketplaceListing) {
    const url = getWhatsAppUrl(listing)
    if (!url || isDemo) return

    const whatsappWindow = window.open('about:blank', '_blank')
    if (!whatsappWindow) {
      setFeedback('Allow pop-ups to continue to WhatsApp. The listing has not been reserved.')
      return
    }
    whatsappWindow.opener = null
    setContactingId(listing.id)
    setFeedback(null)

    try {
      await reserveListing(listing.id)
      setListings((current) => current.filter((item) => item.id !== listing.id))
      whatsappWindow.location.href = url
      setReservedListingId(listing.id)
      setFeedback(`Listing reserved for ${reservationMinutes} minutes. Continue your conversation on WhatsApp.`)
    } catch (cause) {
      whatsappWindow.close()
      setFeedback(cause instanceof Error ? cause.message : 'Could not reserve this listing.')
      if (cause instanceof Error && cause.message.includes('no longer available')) {
        try {
          const result = await loadListings()
          setListings(result.listings)
        } catch (refreshCause) {
          setLoadError(refreshCause instanceof Error ? refreshCause.message : 'Could not refresh listings.')
        }
      }
    } finally {
      setContactingId(null)
    }
  }

  async function handleCompleteReservation() {
    if (!reservedListingId) return
    setIsCompletingReservation(true)
    try {
      await completeListing(reservedListingId)
      setReservedListingId(null)
      setFeedback('Exchange marked completed. Thanks for keeping the listing board up to date.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not complete this reservation.')
    } finally {
      setIsCompletingReservation(false)
    }
  }

  function handleListingCreated(currencyAvailable: string, currencyWanted: string) {
    if (currencyAvailable === 'RUB' && currencyWanted === 'ECUSD') {
      setDirection('ecusd-rub')
    } else if (currencyAvailable === 'ECUSD' && currencyWanted === 'RUB') {
      setDirection('rub-ecusd')
    } else if (currencyAvailable !== 'RUB' && currencyAvailable !== 'ECUSD' && ['RUB', 'ECUSD'].includes(currencyWanted)) {
      setDirection('specific')
      setSpecificCurrency(currencyAvailable)
      setPayWith(currencyWanted)
    }
    setFeedback('Your advert is published and available to matching users.')
    setRefreshVersion((current) => current + 1)
    setView('marketplace')
  }

  if (supabaseConfigurationError) {
    return <main className="screen"><div className="message-panel" role="alert">{supabaseConfigurationError}</div></main>
  }

  return (
    <main className="screen">
      <header className="app-header">
        <a aria-label="Peer Exchange home" className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true">↔</span>
          <span>peer<span className="brand-accent">exchange</span></span>
        </a>
        {session && (
          <nav aria-label="Main navigation" className="app-nav">
            <button
              aria-current={view === 'marketplace' ? 'page' : undefined}
              className={view === 'marketplace' ? 'app-nav-active' : ''}
              onClick={() => setView('marketplace')}
              type="button"
            >
              Marketplace
            </button>
            <button
              aria-current={view === 'create' ? 'page' : undefined}
              className={view === 'create' ? 'app-nav-active' : ''}
              onClick={() => setView('create')}
              type="button"
            >
              Add advert
            </button>
            {isAdmin && (
              <button
                aria-current={view === 'admin' ? 'page' : undefined}
                className={view === 'admin' ? 'app-nav-active' : ''}
                onClick={() => setView('admin')}
                type="button"
              >
                Admin
              </button>
            )}
          </nav>
        )}
        {session && (
          <button
            className="sign-out-button"
            onClick={() => { void supabase?.auth.signOut() }}
            type="button"
          >
            Sign out
          </button>
        )}
      </header>

      <section aria-labelledby="page-title" className="page-intro" id="top">
        <p className="eyebrow">Peer Exchange</p>
        <h1 id="page-title">
          {view === 'create' ? 'Share an advert' : view === 'admin' ? 'Admin dashboard' : 'Find an exchange'}
        </h1>
        <p>
          {view === 'create'
            ? 'Publish your exchange terms and let interested people contact you on WhatsApp.'
            : view === 'admin'
              ? 'Monitor confirmed exchanges and manage account access.'
              : 'Choose what you have. We’ll show matching listings, best rate first.'}
        </p>
      </section>

      {!authReady ? (
        <div aria-label="Checking sign-in" className="loading-state"><LoaderCircle className="spinner" size={20} /></div>
      ) : supabase && !session ? (
        <section aria-labelledby="sign-in-title" className="auth-panel">
          <h2 id="sign-in-title">Sign in to browse</h2>
          <p>We’ll email you a secure sign-in link. An existing account is required.</p>
          <form onSubmit={(event) => { void handleSignIn(event) }}>
            <label htmlFor="email">Email address</label>
            <input
              autoComplete="email"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <button className="contact-button" disabled={isSendingLink} type="submit">
              {isSendingLink ? 'Sending link…' : 'Email me a sign-in link'}
            </button>
          </form>
          {signInMessage && <p className="success-message" role="status">{signInMessage}</p>}
          {signInError && <p className="error-message" role="alert">{signInError}</p>}
        </section>
      ) : isSuspended ? (
        <div className="error-message account-suspended" role="alert">
          Your account is suspended. Contact an administrator if you believe this is a mistake.
        </div>
      ) : view === 'create' ? (
        <ListingForm onListingCreated={handleListingCreated} />
      ) : view === 'admin' && isAdmin ? (
        <AdminPanel />
      ) : view === 'admin' ? (
        <div className="error-message" role="alert">Admin access is required to open this page.</div>
      ) : (
        <>
          <section aria-labelledby="direction-title" className="direction-panel">
            <h2 id="direction-title">What do you have?</h2>
            <fieldset className="direction-options">
              <legend className="sr-only">Choose your exchange direction</legend>
              {directionOptions.map((option) => (
                <label className="direction-option" key={option.value}>
                  <input
                    checked={direction === option.value}
                    name="direction"
                    onChange={() => setDirection(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {direction === 'specific' && (
              <div className="specific-controls">
                <label>
                  Currency you want
                  <select
                    onChange={(event) => setSpecificCurrency(event.target.value)}
                    value={specificCurrency}
                  >
                    {foreignCurrencies.map((code) => <option key={code} value={code}>{currencyName(code)}</option>)}
                  </select>
                </label>
                <label>
                  Pay with
                  <select onChange={(event) => setPayWith(event.target.value)} value={payWith}>
                    <option value="RUB">RUB</option>
                    <option value="ECUSD">EcoCash USD</option>
                  </select>
                </label>
              </div>
            )}
          </section>

          <section aria-labelledby="listings-title" className="results-section">
            <div className="results-heading">
              <div>
                <h2 id="listings-title">Available listings</h2>
                <p>
                  {currencyName(selectedPair.have)} → {currencyName(selectedPair.want)}
                  <span className="sort-note"> · lowest cost first</span>
                </p>
              </div>
              {isDemo && <span className="preview-label">Preview data</span>}
            </div>

            {loadError && <div className="error-message" role="alert"><CircleAlert aria-hidden="true" size={17} />{loadError}</div>}
            {feedback && <div className="feedback-message" role="status">{feedback}</div>}
            {reservedListingId && (
              <div className="reservation-panel">
                <p>After confirming the exchange with the advertiser on WhatsApp, mark this reservation complete.</p>
                <button
                  className="complete-button"
                  disabled={isCompletingReservation}
                  onClick={() => { void handleCompleteReservation() }}
                  type="button"
                >
                  {isCompletingReservation ? 'Updating…' : 'Mark exchange completed'}
                </button>
              </div>
            )}
            {isLoading ? (
              <div aria-label="Loading listings" className="loading-state"><LoaderCircle className="spinner" size={20} /><span>Loading listings…</span></div>
            ) : !loadError && matchingListings.length === 0 ? (
              <div className="empty-state">
                <h3>No listings right now</h3>
                <p>Check back soon for a matching exchange.</p>
              </div>
            ) : !loadError ? (
              <div aria-label="Listings sorted by best rate" className="listing-list">
                {matchingListings.map((listing) => (
                  <ListingCard
                    isContacting={contactingId === listing.id}
                    isBusy={contactingId !== null}
                    isDemo={isDemo}
                    hasReservation={reservedListingId !== null}
                    key={listing.id}
                    listing={listing}
                    onContact={(selectedListing) => { void handleContact(selectedListing) }}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <aside className="safety-note">
            <ShieldCheck aria-hidden="true" size={17} />
            <p>Peer Exchange is a listing board only. All negotiation and settlement happen directly on WhatsApp. No payments are processed here.</p>
          </aside>
        </>
      )}
    </main>
  )
}

export default App
