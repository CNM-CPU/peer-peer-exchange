import { useCallback, useEffect, useState } from 'react'
import {
  loadAdminDashboard,
  loadAdminUsers,
  setUserSuspended,
  type AdminDashboardSummary,
  type AdminUser,
} from '../lib/admin'

const pageSize = 10

function formatMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
    .format(new Date(year, value - 1, 1))
}

export function AdminPanel() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [dashboard, userPage] = await Promise.all([
        loadAdminDashboard(),
        loadAdminUsers(page * pageSize, pageSize),
      ])
      setSummary(dashboard)
      setUsers(userPage.users)
      setTotalUsers(userPage.total)
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load admin data.')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void refresh() }, 0)
    const intervalId = window.setInterval(() => { void refresh() }, 30_000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(intervalId)
    }
  }, [refresh])

  async function handleSuspension(user: AdminUser) {
    const suspend = user.suspended_at === null
    setBusyUserId(user.id)
    setActionError(null)
    try {
      await setUserSuspended(user.id, suspend)
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this account.')
    } finally {
      setBusyUserId(null)
    }
  }

  const monthlyCounts = summary?.monthlyCompletions.map((item) => item.count) ?? []
  const maxMonthlyCount = Math.max(0, ...monthlyCounts)
  const pageCount = Math.max(1, Math.ceil(totalUsers / pageSize))

  return (
    <section aria-labelledby="admin-title" className="admin-panel">
      <div className="panel-heading admin-heading">
        <div>
          <h2 id="admin-title">Admin dashboard</h2>
          <p>Monitor confirmed completions and manage account access.</p>
        </div>
        <button className="secondary-button" disabled={isLoading} onClick={() => { void refresh() }} type="button">
          Refresh
        </button>
      </div>

      {loadError && <p className="error-message" role="alert">{loadError}</p>}
      {isLoading && !summary ? (
        <p className="admin-loading" role="status">Loading admin data…</p>
      ) : summary && (
        <>
          <div aria-label="Marketplace summary" className="metric-grid">
            <article className="metric-card">
              <span>Completed transactions</span>
              <strong>{summary.completedTransactions.toLocaleString()}</strong>
            </article>
            <article className="metric-card">
              <span>Registered users</span>
              <strong>{summary.registeredUsers.toLocaleString()}</strong>
            </article>
            <article className="metric-card">
              <span>Available listings</span>
              <strong>{summary.availableListings.toLocaleString()}</strong>
            </article>
            <article className="metric-card">
              <span>Reserved listings</span>
              <strong>{summary.reservedListings.toLocaleString()}</strong>
            </article>
          </div>

          <section aria-labelledby="analytics-title" className="analytics-section">
            <div className="panel-heading">
              <h3 id="analytics-title">Monthly completions</h3>
              <p>Confirmed in the app · last 12 months</p>
            </div>
            {summary.monthlyCompletions.length === 0 ? (
              <p className="empty-admin-state">No completed transactions recorded yet.</p>
            ) : (
              <ul className="monthly-chart">
                {summary.monthlyCompletions.map((item) => (
                  <li key={item.month}>
                    <span className="month-label">{formatMonth(item.month)}</span>
                    <span className="bar-track">
                      <span
                        aria-hidden="true"
                        className="bar-fill"
                        style={{ width: `${maxMonthlyCount === 0 ? 0 : (item.count / maxMonthlyCount) * 100}%` }}
                      />
                    </span>
                    <span className="month-count">{item.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="users-title" className="users-section">
            <div className="panel-heading">
              <div>
                <h3 id="users-title">User management</h3>
                <p>View accounts and suspend or restore access.</p>
              </div>
            </div>
            {actionError && <p className="error-message" role="alert">{actionError}</p>}
            <div className="user-table-wrap">
              <table className="user-table">
                <thead>
                  <tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSuspended = user.suspended_at !== null
                    return (
                      <tr key={user.id}>
                        <td>{user.email || 'Email unavailable'}</td>
                        <td>{user.role === 'admin' ? 'Admin' : 'User'}</td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td><span className={isSuspended ? 'user-status user-status-suspended' : 'user-status'}>{isSuspended ? 'Suspended' : 'Active'}</span></td>
                        <td>
                          <button
                            className="user-action"
                            disabled={busyUserId !== null || user.role === 'admin'}
                            onClick={() => { void handleSuspension(user) }}
                            type="button"
                          >
                            {user.role === 'admin' ? 'Admin' : busyUserId === user.id ? 'Updating…' : isSuspended ? 'Reactivate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr><td className="no-users" colSpan={5}>No user accounts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div aria-label="User pages" className="pagination">
              <span>{totalUsers === 0 ? '0 users' : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalUsers)} of ${totalUsers}`}</span>
              <div>
                <button className="secondary-button" disabled={page === 0 || isLoading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
                <button className="secondary-button" disabled={page + 1 >= pageCount || isLoading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  )
}
