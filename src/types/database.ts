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
  completed_at: string | null
  created_at: string
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          | 'completed_at'
          | 'advertiser_name'
          | 'whatsapp_number'
          | 'status'
          | 'payment_methods'
          | 'location'
          | 'note'
        > & {
          id?: string
          created_at?: string
          advertiser_name?: string
          whatsapp_number?: string | null
          status?: ListingStatus
          payment_methods?: string[]
          location?: string | null
          note?: string | null
        }
        Update: Partial<Omit<MarketplaceListingRow, 'id' | 'owner_id' | 'created_at'>>
        Relationships: []
      },
      user_profiles: {
        Row: {
          id: string
          email: string | null
          role: 'user' | 'admin'
          created_at: string
          suspended_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          role?: 'user' | 'admin'
          created_at?: string
          suspended_at?: string | null
        }
        Update: Partial<{
          email: string | null
          role: 'user' | 'admin'
          suspended_at: string | null
        }>
        Relationships: []
      },
      listing_status_events: {
        Row: {
          id: number
          listing_id: string
          actor_id: string | null
          event_type: 'created' | 'reserved' | 'expired' | 'completed' | 'reopened'
          occurred_at: string
        }
        Insert: {
          id?: number
          listing_id: string
          actor_id?: string | null
          event_type: 'created' | 'reserved' | 'expired' | 'completed' | 'reopened'
          occurred_at?: string
        }
        Update: Partial<{
          actor_id: string | null
          event_type: 'created' | 'reserved' | 'expired' | 'completed' | 'reopened'
          occurred_at: string
        }>
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
      is_active_user: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_profile_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      set_user_suspended: {
        Args: { p_user_id: string; p_suspended: boolean }
        Returns: boolean
      }
      admin_dashboard: {
        Args: Record<string, never>
        Returns: {
          completed_transactions: number
          registered_users: number
          available_listings: number
          reserved_listings: number
          monthly_completions: Json
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
