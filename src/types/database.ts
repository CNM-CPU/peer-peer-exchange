export type ListingType = 'have' | 'need'
export type ListingStatus = 'open' | 'closed'

export type MarketplaceListingRow = {
  id: string
  owner_id: string
  listing_type: ListingType
  currency_available: string
  currency_wanted: string
  amount: number
  exchange_rate: number
  payment_methods: string[]
  location: string | null
  note: string | null
  status: ListingStatus
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      marketplace_listings: {
        Row: MarketplaceListingRow
        Insert: Omit<MarketplaceListingRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<MarketplaceListingRow, 'id' | 'owner_id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
