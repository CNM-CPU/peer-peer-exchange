import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowDownUp,
  Bell,
  CircleAlert,
  LoaderCircle,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { AuthPanel, type AuthMode } from './components/AuthPanel'
import {
  completeListing,
  loadListings,
  reserveListing,
  type MarketplaceListing,
} from './lib/listings'
import { currencyName, formatExchangeRate, foreignCurrencies } from './lib/currencies'
import { loadAccountProfile, type AccountProfile } from './lib/profile'
import { supabase, supabaseConfigurationError } from './lib/supabase'
import { ListingForm } from './components/ListingForm'
import { AdminPanel } from './components/AdminPanel'
import { MyListingsPanel } from './components/MyListingsPanel'
import { ProfileSettings } from './components/ProfileSettings'
import './App.css'

type Direction = 'rub-ecusd' | 'ecusd-rub' | 'specific'
type MainView = 'marketplace' | 'create' | 'my-adverts' | 'profile' | 'admin'
type NotificationAction = 'marketplace' | 'my-adverts' | 'profile' | 'admin' | 'reservation' | 'retry'

type AppNotification = {
  id: string
  title: string
  message: string
  createdAt: number
  urgent: boolean
  read: boolean
  action?: NotificationAction
}

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
          {formatExchangeRate(listing.exchange_rate, listing.currency_available, listing.currency_wanted)}
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
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [profile, setProfile] = useState<AccountProfile>({
    displayName: null,
    avatarPath: null,
    avatarUrl: null,
  })
  const [profileSyncRevision, setProfileSyncRevision] = useState(0)
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null)
  const [isSuspended, setIsSuspended] = useState(false)
  const [view, setView] = useState<MainView>('marketplace')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const appHeaderRef = useRef<HTMLElement>(null)

  function addNotification(
    title: string,
    message: string,
    urgent = false,
    action?: NotificationAction,
  ) {
    setNotifications((current) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        title,
        message,
        createdAt: Date.now(),
        urgent,
        read: false,
        action,
      },
      ...current,
    ].slice(0, 10))
  }

  useEffect(() => {
    if (!supabase) return

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setAuthReady(true)
        if (event === 'PASSWORD_RECOVERY') {
          setAuthMode('update-password')
          setView('marketplace')
        }
        if (!nextSession) {
          setReservedListingId(null)
          setIsSuspended(false)
          setView('marketplace')
          setAuthMode('sign-in')
          setIsPreviewMode(false)
          setProfile({ displayName: null, avatarPath: null, avatarUrl: null })
          setProfileLoadError(null)
        }
      }
    })

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return
        if (error) addNotification('Could not restore your session', error.message, true)
        setSession(data.session)
      })
      .catch((cause: unknown) => {
        if (active) {
          addNotification(
            'Could not restore your session',
            cause instanceof Error ? cause.message : 'Could not check sign-in status.',
            true,
          )
        }
      })
      .finally(() => {
        if (active) setAuthReady(true)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const profileUserId = session?.user.id
  const profileEmail = session?.user.email
  const metadataDisplayName = session?.user.user_metadata.display_name

  useEffect(() => {
    if (!profileUserId) return

    let active = true
    void loadAccountProfile(profileUserId)
      .then((loadedProfile) => {
        if (!active) return
        setProfile({
          ...loadedProfile,
          displayName: loadedProfile.displayName ??
            (typeof metadataDisplayName === 'string' ? metadataDisplayName : null),
        })
        setProfileLoadError(null)
        setProfileSyncRevision((current) => current + 1)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setProfile({
          displayName: typeof metadataDisplayName === 'string' ? metadataDisplayName : null,
          avatarPath: null,
          avatarUrl: null,
        })
        setProfileLoadError(cause instanceof Error ? cause.message : 'Could not load your profile.')
        setProfileSyncRevision((current) => current + 1)
      })
    return () => { active = false }
  }, [profileUserId, profileEmail, metadataDisplayName])

  useEffect(() => {
    if (!isNavigationOpen && !isNotificationsOpen && !isAccountOpen) return

    const closePopovers = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNavigationOpen(false)
        setIsNotificationsOpen(false)
        setIsAccountOpen(false)
      }
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !appHeaderRef.current?.contains(event.target)) {
        setIsNavigationOpen(false)
        setIsNotificationsOpen(false)
        setIsAccountOpen(false)
      }
    }

    window.addEventListener('keydown', closePopovers)
    window.addEventListener('pointerdown', closeOnOutsideClick)
    return () => {
      window.removeEventListener('keydown', closePopovers)
      window.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [isAccountOpen, isNavigationOpen, isNotificationsOpen])

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

    if ((supabase && !session) || (!supabase && !isPreviewMode)) {
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
  }, [session, refreshVersion, view, isPreviewMode])

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
        .sort((a, b) =>
          b.exchange_rate - a.exchange_rate ||
          b.created_at.localeCompare(a.created_at),
        ),
    [listings, selectedPair],
  )

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
      addNotification(
        'Listing reserved',
        `It is held for ${reservationMinutes} minutes. Continue on WhatsApp, then confirm completion.`,
        true,
        'reservation',
      )
    } catch (cause) {
      whatsappWindow.close()
      setFeedback(cause instanceof Error ? cause.message : 'Could not reserve this listing.')
      addNotification('Could not reserve listing', cause instanceof Error ? cause.message : 'Please try again.', true, 'retry')
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
      addNotification('Exchange completed', 'The listing was recorded as completed.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not complete this reservation.')
      addNotification('Could not complete exchange', cause instanceof Error ? cause.message : 'Please try again.', true, 'reservation')
    } finally {
      setIsCompletingReservation(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        addNotification('Could not sign out', error.message, true)
      }
    } catch (cause) {
      addNotification(
        'Could not sign out',
        cause instanceof Error ? cause.message : 'Please try again.',
        true,
      )
    }
  }

  async function handleAccountPasswordReset() {
    if (!supabase || !session?.user.email) {
      addNotification('Password reset unavailable', 'A signed-in email account is required.', true)
      setIsAccountOpen(false)
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: window.location.origin,
      })
      if (error) throw new Error(error.message)
      addNotification('Password reset email sent', 'Check your email to choose a new password.')
    } catch (cause) {
      addNotification(
        'Could not send password reset email',
        cause instanceof Error ? cause.message : 'Please try again.',
        true,
      )
    } finally {
      setIsAccountOpen(false)
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
    addNotification('Advert published', 'Your advert is now visible to matching users.', false, 'marketplace')
    setRefreshVersion((current) => current + 1)
    setView('marketplace')
  }

  function openView(nextView: MainView) {
    setView(nextView)
    setIsNavigationOpen(false)
    setIsNotificationsOpen(false)
    setIsAccountOpen(false)
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode)
    setIsNavigationOpen(false)
    setIsAccountOpen(false)
    document.getElementById('auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleAuthModeChange(mode: AuthMode) {
    setAuthMode(mode)
    if (mode === 'sign-in') setView('marketplace')
  }

  function handleProfileUpdated(nextProfile: AccountProfile) {
    setProfile(nextProfile)
    setProfileLoadError(null)
  }

  function handleNotificationAction(action?: NotificationAction, notificationId?: string) {
    if (action === 'retry') {
      setRefreshVersion((current) => current + 1)
      setView('marketplace')
    } else if (action === 'reservation' || action === 'marketplace') {
      setView('marketplace')
    } else if (action === 'my-adverts') {
      setView('my-adverts')
    } else if (action === 'profile') {
      setView('profile')
    } else if (action === 'admin' && isAdmin) {
      setView('admin')
    }
    if (notificationId) {
      setNotifications((current) =>
        current.map((item) => item.id === notificationId ? { ...item, read: true } : item),
      )
    }
    setIsNotificationsOpen(false)
  }

  const urgentNotification = notifications.find((item) => item.urgent && !item.read)
  const unreadCount =
    notifications.filter((item) => !item.read).length + (loadError ? 1 : 0) + (isSuspended ? 1 : 0)
  const profileDisplayName = profile.displayName ??
    (typeof metadataDisplayName === 'string' ? metadataDisplayName : '')
  const displayName = profileDisplayName || session?.user.email || 'Account'
  const accountSummary = session ? displayName : supabase ? 'Sign in to Peer Exchange' : 'Preview account'
  const avatarLabel = displayName
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U'

  if (supabaseConfigurationError) {
    return <main className="screen"><div className="message-panel" role="alert">{supabaseConfigurationError}</div></main>
  }

  return (
    <main className="screen">
      <header className="app-header" ref={appHeaderRef}>
        <div className="header-start">
          <div className="popover-anchor">
            <button
              aria-controls="primary-navigation"
              aria-expanded={isNavigationOpen}
              aria-label={isNavigationOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="icon-button"
              onClick={() => {
                setIsNavigationOpen((open) => !open)
                setIsNotificationsOpen(false)
                setIsAccountOpen(false)
              }}
              type="button"
            >
              {isNavigationOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
            </button>
            {isNavigationOpen && (
              <nav aria-label="Primary navigation" className="header-popover navigation-popover" id="primary-navigation">
                {(session || isPreviewMode) && (
                  <button aria-current={view === 'marketplace' ? 'page' : undefined} onClick={() => openView('marketplace')} type="button">Marketplace</button>
                )}
                {session && (
                  <button aria-current={view === 'create' ? 'page' : undefined} onClick={() => openView('create')} type="button">Add advert</button>
                )}
                {session && (
                  <button aria-current={view === 'my-adverts' ? 'page' : undefined} onClick={() => openView('my-adverts')} type="button">My adverts</button>
                )}
                {isAdmin && <button aria-current={view === 'admin' ? 'page' : undefined} onClick={() => openView('admin')} type="button">Admin dashboard</button>}
                {!session && !isPreviewMode && (
                  <>
                    <button onClick={() => openAuth('sign-in')} type="button">Sign in</button>
                    <button onClick={() => openAuth('sign-up')} type="button">Create account</button>
                  </>
                )}
              </nav>
            )}
          </div>
          <a aria-label="Peer Exchange home" className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true">↔</span>
            <span>peer<span className="brand-accent">exchange</span></span>
          </a>
        </div>
        <div className="header-actions">
            <div className="popover-anchor">
              <button
                aria-controls="notifications-panel"
                aria-expanded={isNotificationsOpen}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className="icon-button notification-button"
                onClick={() => {
                  setIsNotificationsOpen((open) => !open)
                  setIsNavigationOpen(false)
                  setIsAccountOpen(false)
                  if (!isNotificationsOpen) {
                    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
                  }
                }}
                type="button"
              >
                <Bell aria-hidden="true" size={19} />
                {unreadCount > 0 && <span aria-hidden="true" className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {isNotificationsOpen && (
                <section aria-label="Notifications" className="header-popover notifications-popover" id="notifications-panel">
                  <div className="popover-heading">
                    <h2>Notifications</h2>
                    {notifications.length > 0 && (
                      <button className="clear-notifications" onClick={() => setNotifications([])} type="button">Clear</button>
                    )}
                  </div>
                  {loadError && (
                    <article className="notification-item notification-item-urgent">
                      <strong>Marketplace needs attention</strong>
                      <p>{loadError}</p>
                      <button onClick={() => handleNotificationAction('retry')} type="button">Try again</button>
                    </article>
                  )}
                  {isSuspended && (
                    <article className="notification-item notification-item-urgent">
                      <strong>Account suspended</strong>
                      <p>Contact an administrator if you believe this is a mistake.</p>
                    </article>
                  )}
                  {notifications.length === 0 && !loadError && !isSuspended ? (
                    <p className="notifications-empty">You’re all caught up.</p>
                  ) : (
                    notifications.map((item) => (
                      <article className={item.urgent ? 'notification-item notification-item-urgent' : 'notification-item'} key={item.id}>
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                        {item.action && (
                          <button onClick={() => handleNotificationAction(item.action, item.id)} type="button">
                            {item.action === 'reservation' ? 'View reservation' : item.action === 'admin' ? 'Open admin' : item.action === 'retry' ? 'Try again' : 'View marketplace'}
                          </button>
                        )}
                        <time dateTime={new Date(item.createdAt).toISOString()}>
                          {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(item.createdAt)}
                        </time>
                      </article>
                    ))
                  )}
                </section>
              )}
            </div>
            <div className="popover-anchor">
              <button
                aria-controls="account-panel"
                aria-expanded={isAccountOpen}
                aria-label={
                  session
                    ? `Account: ${displayName}`
                    : supabase
                      ? 'Account: signed out'
                      : 'Account: preview mode'
                }
                className="avatar-button"
                onClick={() => {
                  setIsAccountOpen((open) => !open)
                  setIsNavigationOpen(false)
                  setIsNotificationsOpen(false)
                }}
                type="button"
              >
                {session
                  ? profile.avatarUrl
                    ? <img alt="" src={profile.avatarUrl} />
                    : avatarLabel
                  : <UserRound aria-hidden="true" size={18} />}
              </button>
              {isAccountOpen && (
                <section aria-label="Account" className="header-popover account-popover" id="account-panel">
                  <div className="account-summary">
                    {session
                      ? profile.avatarUrl
                        ? <img alt="" className="avatar avatar-large" src={profile.avatarUrl} />
                        : <span aria-hidden="true" className="avatar avatar-large">{avatarLabel}</span>
                      : <span aria-hidden="true" className="avatar avatar-large"><UserRound size={22} /></span>}
                    <span>{accountSummary}</span>
                    {isAdmin && <small>Administrator</small>}
                    {!session && <small>{isPreviewMode ? 'Browsing sample listings; account actions are unavailable.' : 'Sign in to publish and manage adverts.'}</small>}
                  </div>
                  {session ? (
                    <>
                      <button className="account-signout" onClick={() => openView('profile')} type="button">Account settings</button>
                      <button className="account-signout account-reset" onClick={() => { void handleAccountPasswordReset() }} type="button">Reset password</button>
                      <button className="account-signout" onClick={() => { void handleSignOut() }} type="button">Sign out</button>
                    </>
                  ) : !isPreviewMode ? (
                    <>
                      <button className="account-signout" onClick={() => openAuth('sign-in')} type="button">Sign in</button>
                      <button className="account-signout" onClick={() => openAuth('sign-up')} type="button">Create account</button>
                    </>
                  ) : null}
                </section>
              )}
            </div>
        </div>
      </header>
      {session && isSuspended ? (
        <section className="urgent-banner" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <div><strong>Account suspended</strong><span>Contact an administrator if you believe this is a mistake.</span></div>
          <button onClick={() => { void handleSignOut() }} type="button">Sign out</button>
        </section>
      ) : session && loadError ? (
        <section className="urgent-banner" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <div><strong>Marketplace needs attention</strong><span>{loadError}</span></div>
          <button onClick={() => setRefreshVersion((current) => current + 1)} type="button">Retry</button>
        </section>
      ) : session && urgentNotification ? (
        <section className="urgent-banner" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <div><strong>{urgentNotification.title}</strong><span>{urgentNotification.message}</span></div>
          <button onClick={() => handleNotificationAction(urgentNotification.action, urgentNotification.id)} type="button">
            {urgentNotification.action === 'reservation' ? 'Review reservation' : 'Review'}
          </button>
          <button
            aria-label="Dismiss urgent notification"
            className="banner-dismiss"
            onClick={() => setNotifications((current) => current.map((item) => item.id === urgentNotification.id ? { ...item, read: true } : item))}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </section>
      ) : null}

      <section
        aria-labelledby="page-title"
        className={session || isPreviewMode ? 'page-intro' : 'page-intro page-intro-auth'}
        id="top"
      >
        <p className="eyebrow">Peer Exchange</p>
        <h1 id="page-title">
          {view === 'create'
            ? 'Share an advert'
            : view === 'my-adverts'
              ? 'My adverts'
              : view === 'profile'
                ? 'Account settings'
                : view === 'admin'
                  ? 'Admin dashboard'
                  : session || isPreviewMode
                    ? 'Find an exchange'
                    : 'Welcome to Peer Exchange'}
        </h1>
        <p>
          {!session && !isPreviewMode
            ? 'Sign in to access the currency marketplace.'
            : view === 'create'
            ? 'Publish your exchange terms and let interested people contact you on WhatsApp.'
            : view === 'my-adverts'
              ? 'View and manage your published exchange listings.'
              : view === 'profile'
                ? 'Manage your personal information, profile picture, and password.'
            : view === 'admin'
              ? 'Monitor confirmed exchanges and manage account access.'
              : 'Choose what you have. We’ll show matching listings, best rate first.'}
        </p>
      </section>

      {!authReady ? (
        <div aria-label="Checking sign-in" className="loading-state"><LoaderCircle className="spinner" size={20} /></div>
      ) : authMode === 'update-password' && session ? (
        <AuthPanel mode={authMode} onModeChange={handleAuthModeChange} onPreview={() => setIsPreviewMode(true)} />
      ) : !session && !isPreviewMode ? (
        <AuthPanel
          mode={authMode}
          onModeChange={handleAuthModeChange}
          onPreview={() => { setIsPreviewMode(true); setView('marketplace') }}
        />
      ) : isSuspended ? (
        <div className="error-message account-suspended" role="alert">
          Your account is suspended. Contact an administrator if you believe this is a mistake.
        </div>
      ) : view === 'profile' && session ? (
        <>
          {profileLoadError && <p className="error-message" role="alert">{profileLoadError}</p>}
          <ProfileSettings
            key={`${session.user.id}-${session.user.email}-${profileSyncRevision}`}
            onBack={() => openView('marketplace')}
            onProfileUpdated={handleProfileUpdated}
            profile={profile}
            session={session}
          />
        </>
      ) : view === 'my-adverts' && session ? (
        <MyListingsPanel />
      ) : view === 'create' ? (
        <ListingForm displayName={profileDisplayName} onListingCreated={handleListingCreated} />
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
                  <span className="sort-note"> · best rate first</span>
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
