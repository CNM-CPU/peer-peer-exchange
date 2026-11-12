import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Globe2,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  X,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!isMenuOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isMenuOpen])

  return (
    <>
      <header className="site-header">
        <div className="header-start">
          <button
            aria-controls="main-menu"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="menu-toggle"
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            {isMenuOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
          </button>
          <a aria-label="Peer Exchange home" className="brand" href="#top">
            <span className="brand-mark"><ArrowLeftRight aria-hidden="true" size={18} /></span>
            <span>peer<span className="brand-accent">exchange</span></span>
          </a>
          {isMenuOpen && (
            <nav aria-label="Main navigation" className="main-menu" id="main-menu">
              <a href="#marketplace" onClick={() => setIsMenuOpen(false)}>Marketplace</a>
              <a href="#safety" onClick={() => setIsMenuOpen(false)}>Safety and preview</a>
            </nav>
          )}
        </div>
      </header>

      <main id="top">
        <section aria-labelledby="hero-title" className="hero-section">
          <div className="hero-copy">
            <h1 id="hero-title">Exchange listings for the community.</h1>
            <p className="hero-description">
              Browse what people have and need, then compare rates and terms before connecting.
            </p>
            <div className="hero-footnote">
              <Globe2 aria-hidden="true" size={16} />
              Starting with Zimbabwean students in Russia
            </div>
          </div>
        </section>

        <section aria-labelledby="marketplace-title" className="marketplace-section" id="marketplace">
          <div className="section-heading">
            <div>
              <h2 id="marketplace-title">Exchange listings</h2>
              <p>Filter offers and requests by currency or location.</p>
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
        </section>

        <aside aria-label="Safety information" className="safety-note" id="safety">
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            <strong>Preview only.</strong> {isDemo
              ? 'Sample listings and rates are fictional.'
              : 'Listings and rates are user-submitted and not verified.'}{' '}
            No payments, identity checks, or settlement are supported. Verify details independently.
          </p>
        </aside>
      </main>

    </>
  )
}

export default App
