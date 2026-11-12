import { supabase } from './supabase'
import type { Json } from '../types/database'

export type AdminUser = {
  id: string
  email: string | null
  role: 'user' | 'admin'
  created_at: string
  suspended_at: string | null
}

export type MonthlyCompletion = {
  month: string
  count: number
}

export type AdminDashboardSummary = {
  completedTransactions: number
  registeredUsers: number
  availableListings: number
  reservedListings: number
  monthlyCompletions: MonthlyCompletion[]
}

function parseMonthlyCompletions(value: Json): MonthlyCompletion[] {
  if (!Array.isArray(value)) {
    throw new Error('The admin analytics response has an invalid shape.')
  }

  return value.map((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      Array.isArray(item) ||
      typeof item.month !== 'string' ||
      typeof item.count !== 'number'
    ) {
      throw new Error('The admin analytics response has an invalid monthly entry.')
    }
    return { month: item.month, count: item.count }
  })
}

export async function loadAdminDashboard(): Promise<AdminDashboardSummary> {
  if (!supabase) {
    throw new Error('Admin tools require a connected Supabase project.')
  }

  const { data, error } = await supabase.rpc('admin_dashboard')
  if (error) {
    throw new Error(error.message)
  }
  const summary = data[0]
  if (!summary) {
    throw new Error('The admin dashboard returned no summary.')
  }

  return {
    completedTransactions: summary.completed_transactions,
    registeredUsers: summary.registered_users,
    availableListings: summary.available_listings,
    reservedListings: summary.reserved_listings,
    monthlyCompletions: parseMonthlyCompletions(summary.monthly_completions),
  }
}

export async function loadAdminUsers(offset: number, pageSize: number): Promise<{
  users: AdminUser[]
  total: number
}> {
  if (!supabase) {
    throw new Error('User management requires a connected Supabase project.')
  }

  const { data, count, error } = await supabase
    .from('user_profiles')
    .select('id, email, role, created_at, suspended_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw new Error(error.message)
  }
  if (count === null) {
    throw new Error('Could not determine the total user count.')
  }
  return { users: data, total: count }
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  if (!supabase) {
    throw new Error('User management requires a connected Supabase project.')
  }

  const { data, error } = await supabase.rpc('set_user_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
  })

  if (error) {
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('The user account could not be updated.')
  }
}
