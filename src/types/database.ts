export type ListingType = 'have' | 'need'
export type ListingStatus = 'available' | 'reserved' | 'completed' | 'expired'

export type MarketplaceListingRow = {
  id: string
  owner_id: string
  advertiser_name: string
  whatsapp_number: string | null
  listing_type: ListingType
  currency_available: string
  currency_wanted: string
  amount: number
  exchange_rate: number
  payment_methods: string[]
  location: string | null
  note: string | null
  status: ListingStatus
  reserved_by: string | null
  reserved_at: string | null
  expires_at: string | null
  expired_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      marketplace_listings: {
        Row: MarketplaceListingRow
        Insert: Omit<
          MarketplaceListingRow,
          | 'id'
          | 'created_at'
          | 'reserved_by'
          | 'reserved_at'
          | 'expires_at'
          | 'expired_at'
          | 'advertiser_name'
          | 'whatsapp_number'
          | 'status'
        > & {
          id?: string
          created_at?: string
          advertiser_name?: string
          whatsapp_number?: string | null
          status?: ListingStatus
        }
        Update: Partial<Omit<MarketplaceListingRow, 'id' | 'owner_id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      reserve_listing: {
        Args: { p_listing_id: string }
        Returns: boolean
      }
      expire_stale_listings: {
        Args: Record<string, never>
        Returns: number
      }
      complete_listing: {
        Args: { p_listing_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
