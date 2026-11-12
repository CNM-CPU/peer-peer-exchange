import { supabase, supabaseConfigurationError } from './supabase'
import type { MarketplaceListingRow } from '../types/database'

export type MarketplaceListing = Pick<
  MarketplaceListingRow,
  | 'id'
  | 'owner_id'
  | 'advertiser_name'
  | 'whatsapp_number'
  | 'listing_type'
  | 'currency_available'
  | 'currency_wanted'
  | 'amount'
  | 'exchange_rate'
  | 'created_at'
>

const demoListings: MarketplaceListing[] = [
  {
    id: 'sample-1',
    owner_id: 'sample-owner',
    advertiser_name: 'Sample advertiser',
    whatsapp_number: null,
    listing_type: 'have',
    currency_available: 'ECUSD',
    currency_wanted: 'RUB',
    amount: 350,
    exchange_rate: 90.5,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    owner_id: 'sample-owner',
    advertiser_name: 'Sample advertiser',
    whatsapp_number: null,
    listing_type: 'have',
    currency_available: 'RUB',
    currency_wanted: 'ECUSD',
    amount: 250,
    exchange_rate: 0.011,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    owner_id: 'sample-owner',
    advertiser_name: 'Sample advertiser',
    whatsapp_number: null,
    listing_type: 'have',
    currency_available: 'EUR',
    currency_wanted: 'RUB',
    amount: 500,
    exchange_rate: 98.2,
    created_at: new Date().toISOString(),
  },
]

export async function loadListings(): Promise<{
  listings: MarketplaceListing[]
  isDemo: boolean
  isSuspended: boolean
}> {
  if (supabaseConfigurationError) {
    throw new Error(supabaseConfigurationError)
  }

  if (!supabase) {
    return { listings: demoListings, isDemo: true, isSuspended: false }
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw new Error(userError.message)
  }
  if (!userResult.user) {
    throw new Error('Sign-in is required to load listings.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('suspended_at')
    .eq('id', userResult.user.id)
    .single()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (profile.suspended_at) {
    return { listings: [], isDemo: false, isSuspended: true }
  }

  const { error: expiryError } = await supabase.rpc('expire_stale_listings')
  if (expiryError) {
    throw new Error(expiryError.message)
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, owner_id, advertiser_name, whatsapp_number, listing_type, currency_available, currency_wanted, amount, exchange_rate, created_at',
    )
    .eq('status', 'available')
    .not('whatsapp_number', 'is', null)
    .neq('owner_id', userResult.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return { listings: data, isDemo: false, isSuspended: false }
}

export async function createListing(input: {
  advertiserName: string
  whatsappNumber: string
  currencyAvailable: string
  currencyWanted: string
  amount: number
  exchangeRate: number
}): Promise<void> {
  if (!supabase) {
    throw new Error('Creating listings is unavailable in preview mode.')
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser()
  if (userError) {
    throw new Error(userError.message)
  }
  if (!userResult.user) {
    throw new Error('Sign-in is required to create a listing.')
  }

  const { error } = await supabase.from('marketplace_listings').insert({
    owner_id: userResult.user.id,
    listing_type: 'have',
    advertiser_name: input.advertiserName,
    whatsapp_number: input.whatsappNumber,
    currency_available: input.currencyAvailable,
    currency_wanted: input.currencyWanted,
    amount: input.amount,
    exchange_rate: input.exchangeRate,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function reserveListing(listingId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Reservations are unavailable in preview mode.')
  }

  const { data, error } = await supabase.rpc('reserve_listing', {
    p_listing_id: listingId,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('This listing is no longer available. Refresh to see current listings.')
  }
}

export async function completeListing(listingId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Completing reservations is unavailable in preview mode.')
  }

  const { data, error } = await supabase.rpc('complete_listing', {
    p_listing_id: listingId,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('This reservation is no longer active.')
  }
}
