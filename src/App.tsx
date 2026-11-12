import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Globe2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { loadListings, type MarketplaceListing } from './lib/listings'
import './App.css'

type ListingFilter = 'all' | 'have' | 'need'

const filters: { value: ListingFilter; label: string }[] = [
  { value: 'all', label: 'All listings' },
  { value: 'have', label: 'I have' },
  { value: 'need', label: 'I need' },
]

function formatAmount(amount: number, currency: string) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)} ${currency}`
}

function formatRate(rate: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(rate)
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const isOffer = listing.listing_type === 'have'
  const amountCurrency = isOffer ? listing.currency_available : listing.currency_wanted

  return (
    <article className="listing-card">
      <div className="listing-card-top">
        <span className={`listing-kind ${isOffer ? 'listing-kind-have' : 'listing-kind-need'}`}>
          <span className="kind-dot" />
          {isOffer ? 'I have' : 'I need'}
        </span>
        <span className="listing-category">Community listing</span>
      </div>

      <div className="listing-route">
        <span className={`currency-mark currency-mark-${listing.currency_available.toLowerCase()}`}>
          {listing.currency_available.slice(0, 1)}
        </span>
        <span className="currency-code">{listing.currency_available}</span>
        <ArrowRight aria-hidden="true" size={16} />
        <span className={`currency-mark currency-mark-${listing.currency_wanted.toLowerCase()}`}>
          {listing.currency_wanted.slice(0, 1)}
        </span>
        <span className="currency-code">{listing.currency_wanted}</span>
      </div>

      <div className="listing-amount-row">
        <div>
          <p className="listing-amount">{formatAmount(listing.amount, amountCurrency)}</p>
          <p className="listing-amount-caption">
            {isOffer ? 'Available to exchange' : 'Looking to receive'}
          </p>
        </div>
        <div className="rate-block">
          <span className="rate-label">Indicative rate</span>
          <span className="rate-value">
            1 {listing.currency_available} = {formatRate(listing.exchange_rate)} {listing.currency_wanted}
          </span>
        </div>
      </div>

      {listing.note && <p className="listing-note">{listing.note}</p>}

      <div className="listing-meta">
        <span>
          <MapPin aria-hidden="true" size={14} />
          {listing.location || 'Location not specified'}
        </span>
        <span>{listing.payment_methods.length > 0 ? listing.payment_methods.join(', ') : 'Flexible payment'}</span>
      </div>
    </article>
  )
}

function App() {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isDemo, setIsDemo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<ListingFilter>('all')
  const [currency, setCurrency] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let isMounted = true

    loadListings()
      .then(({ listings: loadedListings, isDemo: usingDemoData }) => {
        if (!isMounted) return
        setListings(loadedListings)
        setIsDemo(usingDemoData)
      })
      .catch((cause: unknown) => {
        if (!isMounted) return
        setLoadError(cause instanceof Error ? cause.message : 'An unexpected error occurred.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const currencies = useMemo(
    () =>
      [...new Set(listings.flatMap((listing) => [listing.currency_available, listing.currency_wanted]))]
        .sort(),
    [listings],
  )

  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase()

    return listings.filter((listing) => {
      const matchesType = filter === 'all' || listing.listing_type === filter
      const matchesCurrency =
        currency === 'all' ||
        listing.currency_available === currency ||
        listing.currency_wanted === currency
      const searchableText = [
        listing.currency_available,
        listing.currency_wanted,
        listing.location,
        listing.note ?? '',
        ...listing.payment_methods,
      ]
        .join(' ')
        .toLowerCase()

      return matchesType && matchesCurrency && (!query || searchableText.includes(query))
    })
  }, [currency, filter, listings, search])

  return (
    <>
      <div className="preview-banner">
        <CircleAlert aria-hidden="true" size={15} />
        <span>
          Preview only. {isDemo ? 'Sample listings and rates are fictional.' : 'Rates are user-submitted and not verified.'}
          {' '}No funds are held or exchanged on this platform.
        </span>
      </div>

      <header className="site-header">
        <a aria-label="Peer Exchange home" className="brand" href="#top">
          <span className="brand-mark"><ArrowLeftRight aria-hidden="true" size={19} /></span>
          <span>peer<span className="brand-accent">exchange</span></span>
        </a>
        <nav aria-label="Main navigation" className="main-nav">
          <a className="nav-link nav-link-active" href="#marketplace">Marketplace</a>
          <a className="nav-link" href="#how-it-works">How it works</a>
          <a className="nav-link" href="#safety">Safety</a>
        </nav>
        <a className="header-cta" href="#marketplace">
          Explore listings <ArrowRight aria-hidden="true" size={15} />
        </a>
      </header>

      <main id="top">
        <section aria-labelledby="hero-title" className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A community-first exchange marketplace</div>
            <h1 id="hero-title">Find your next exchange <span>partner.</span></h1>
            <p className="hero-description">
              A clearer way to find people with the currencies you need. Browse requests, compare
              terms, and make your next connection in one place.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#marketplace">
                Browse the marketplace <ArrowRight aria-hidden="true" size={17} />
              </a>
              <a className="button button-secondary" href="#how-it-works">How it works</a>
            </div>
            <div className="hero-footnote">
              <Globe2 aria-hidden="true" size={16} />
              Starting with Zimbabwean students in Russia
            </div>
          </div>

          <div aria-label="Illustrative exchange listing preview" className="hero-visual">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-label"><Sparkles aria-hidden="true" size={14} /> A better way to connect</div>
            <div className="exchange-preview">
              <div className="preview-card-heading">
                <span>EXAMPLE LISTING</span>
                <span className="sample-pill">SAMPLE</span>
              </div>
              <div className="preview-currency-row">
                <div className="preview-currency">
                  <span className="currency-mark currency-mark-usd">$</span>
                  <span><strong>USD</strong><small>Available</small></span>
                </div>
                <ArrowLeftRight aria-hidden="true" className="swap-icon" size={19} />
                <div className="preview-currency">
                  <span className="currency-mark currency-mark-rub">₽</span>
                  <span><strong>RUB</strong><small>Requested</small></span>
                </div>
              </div>
              <div className="preview-divider" />
              <div className="preview-rate-row">
                <span>Example rate</span>
                <strong>Set by the community</strong>
              </div>
              <div className="preview-connection">
                <span className="connection-avatar">A</span>
                <span><strong>A community member</strong><small>Example profile</small></span>
              </div>
            </div>
            <div className="floating-note"><ShieldCheck aria-hidden="true" size={17} /> Clear terms, before you connect</div>
          </div>
        </section>

        <section aria-label="Marketplace benefits" className="benefit-strip">
          <div><span className="benefit-icon"><Search aria-hidden="true" size={17} /></span><span><strong>Search in one place</strong><small>Skip the group-chat scroll</small></span></div>
          <div><span className="benefit-icon"><ArrowLeftRight aria-hidden="true" size={17} /></span><span><strong>See both sides</strong><small>Offers and requests together</small></span></div>
          <div><span className="benefit-icon"><ShieldCheck aria-hidden="true" size={17} /></span><span><strong>Know the terms</strong><small>Compare before connecting</small></span></div>
        </section>

        <section aria-labelledby="marketplace-title" className="marketplace-section" id="marketplace">
          <div className="section-heading">
            <div>
              <div className="section-kicker">THE MARKETPLACE</div>
              <h2 id="marketplace-title">Explore exchange listings</h2>
              <p>Find a currency pair that fits what you have and what you need.</p>
            </div>
            {isDemo && <span className="data-status"><span /> Sample data</span>}
          </div>

          <div className="marketplace-toolbar">
            <div className="listing-tabs" aria-label="Filter listings">
              {filters.map((item) => (
                <button
                  aria-pressed={filter === item.value}
                  className={filter === item.value ? 'listing-tab listing-tab-active' : 'listing-tab'}
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="marketplace-search">
              <label className="search-field">
                <Search aria-hidden="true" size={17} />
                <span className="sr-only">Search listings</span>
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search currency or location"
                  type="search"
                  value={search}
                />
              </label>
              <label className="currency-select">
                <span className="sr-only">Filter by currency</span>
                <select onChange={(event) => setCurrency(event.target.value)} value={currency}>
                  <option value="all">All currencies</option>
                  {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                <ChevronDown aria-hidden="true" size={15} />
              </label>
            </div>
          </div>

          {loadError && (
            <div className="load-error" role="alert">
              <CircleAlert aria-hidden="true" size={18} />
              <span>Marketplace could not be loaded: {loadError}</span>
            </div>
          )}

          {isLoading ? (
            <div aria-label="Loading listings" className="listing-grid">
              {[1, 2, 3].map((item) => <div aria-hidden="true" className="listing-skeleton" key={item} />)}
            </div>
          ) : !loadError && visibleListings.length > 0 ? (
            <div className="listing-grid">
              {visibleListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
            </div>
          ) : !loadError ? (
            <div className="empty-state">
              <span className="empty-icon"><Search aria-hidden="true" size={21} /></span>
              <h3>{listings.length === 0 ? 'No open listings yet' : 'No matching listings'}</h3>
              <p>
                {listings.length === 0
                  ? 'There are no open listings in the marketplace right now.'
                  : 'Try a different search or clear one of your filters.'}
              </p>
              {listings.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => { setSearch(''); setCurrency('all'); setFilter('all') }}
                  type="button"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : null}
          <p className="marketplace-disclaimer">
            {isDemo
              ? 'These fictional examples demonstrate the marketplace only; they are not exchange offers or live rates.'
              : 'Listings and rates are user-submitted. Verify all details independently; no transaction or settlement is supported.'}
          </p>
        </section>

        <section aria-labelledby="how-title" className="how-section" id="how-it-works">
          <div className="how-intro">
            <div className="section-kicker">A SIMPLE FLOW</div>
            <h2 id="how-title">From searching to connecting.</h2>
            <p>Exchange starts with finding the right person. The marketplace helps make that first step easier.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <span className="step-icon"><Search aria-hidden="true" size={19} /></span>
              <h3>Find a match</h3>
              <p>Browse what people have and what they are looking for.</p>
            </article>
            <article className="step-card">
              <span className="step-number">02</span>
              <span className="step-icon"><ArrowLeftRight aria-hidden="true" size={19} /></span>
              <h3>Compare terms</h3>
              <p>Review the proposed amount, rate, location, and payment method.</p>
            </article>
            <article className="step-card">
              <span className="step-number">03</span>
              <span className="step-icon"><Globe2 aria-hidden="true" size={19} /></span>
              <h3>Connect carefully</h3>
              <p>Decide whether to proceed independently and only where permitted.</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="safety-title" className="safety-section" id="safety">
          <div className="safety-icon"><ShieldCheck aria-hidden="true" size={22} /></div>
          <div>
            <div className="section-kicker">SAFETY FIRST</div>
            <h2 id="safety-title">A marketplace—not a money service.</h2>
            <p>
              This preview only demonstrates how people could discover listings. It does not process
              payments, verify identities, or arrange settlement. Any real-world exchange features
              require legal and regulatory review before launch.
            </p>
          </div>
          <a className="safety-link" href="#top">Back to top <ArrowRight aria-hidden="true" size={15} /></a>
        </section>
      </main>

      <footer className="site-footer">
        <a aria-label="Peer Exchange home" className="brand footer-brand" href="#top">
          <span className="brand-mark"><ArrowLeftRight aria-hidden="true" size={17} /></span>
          <span>peer<span className="brand-accent">exchange</span></span>
        </a>
        <p>Built for communities finding a better way to connect.</p>
        <span className="footer-note">Preview · No funds held or exchanged</span>
      </footer>
    </>
  )
}

export default App
