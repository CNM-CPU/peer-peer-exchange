import { supabase, supabaseConfigurationError } from './supabase'
import type { MarketplaceListingRow } from '../types/database'

export type MarketplaceListing = Pick<
  MarketplaceListingRow,
  | 'id'
  | 'listing_type'
  | 'currency_available'
  | 'currency_wanted'
  | 'amount'
  | 'exchange_rate'
  | 'payment_methods'
  | 'location'
  | 'note'
>

const demoListings: MarketplaceListing[] = [
  {
    id: 'sample-1',
    listing_type: 'have',
    currency_available: 'USD',
    currency_wanted: 'RUB',
    amount: 350,
    exchange_rate: 90.5,
    payment_methods: ['Bank transfer'],
    location: 'Kazan, Russia',
    note: 'Example listing for the marketplace preview.',
  },
  {
    id: 'sample-2',
    listing_type: 'need',
    currency_available: 'RUB',
    currency_wanted: 'USD',
    amount: 250,
    exchange_rate: 0.011,
    payment_methods: ['Discuss with counterparty'],
    location: 'Moscow, Russia',
    note: 'Sample request — rate is illustrative, not live.',
  },
  {
    id: 'sample-3',
    listing_type: 'have',
    currency_available: 'EUR',
    currency_wanted: 'RUB',
    amount: 500,
    exchange_rate: 98.2,
    payment_methods: ['Bank transfer'],
    location: 'Saint Petersburg, Russia',
    note: null,
  },
]

export async function loadListings(): Promise<{
  listings: MarketplaceListing[]
  isDemo: boolean
}> {
  if (supabaseConfigurationError) {
    throw new Error(supabaseConfigurationError)
  }

  if (!supabase) {
    return { listings: demoListings, isDemo: true }
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, listing_type, currency_available, currency_wanted, amount, exchange_rate, payment_methods, location, note',
    )
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return { listings: data, isDemo: false }
}
