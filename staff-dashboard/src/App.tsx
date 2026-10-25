import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { nextStep, statusNames, type Order, type OrderStatus } from './types'

type ApiResult = { success?: boolean; error?: string; orders?: Order[]; order?: Order }
type FilterKey = 'ALL' | OrderStatus

async function staffRequest(
  session: Session,
  body?: Record<string, unknown>,
  status?: string
): Promise<ApiResult> {
  const url = new URL('/api/staff/orders', window.location.origin)
  if (status && status !== 'ALL') url.searchParams.set('status', status)
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const result = (await response.json().catch(() => ({}))) as ApiResult
  if (!response.ok || !result.success) {
    const error = new Error(result.error || 'The request failed. Please try again.')
    Object.assign(error, { status: response.status })
    throw error
  }
  return result
}

function currency(value: number, code = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value)
}

function time(value: string) {
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function itemName(item: Order['items'][number]) {
  return item?.name || item?.item_name || 'Food item'
}

function parseItems(raw: unknown): Order['items'] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeOrder(raw: any): Order {
  const items = parseItems(raw?.items)
  return {
    ...raw,
    items,
    status: raw?.status || 'PLACED',
    stage: typeof raw?.stage === 'number' ? raw.stage : 0,
    total: Number(raw?.total || 0),
    subtotal: Number(raw?.subtotal || 0),
    tax: Number(raw?.tax || 0),
    packing: Number(raw?.packing || 0),
    token_number: Number(raw?.token_number || 12),
    order_number: String(raw?.order_number || 'CB-00000'),
    payment_status: raw?.payment_status || 'PENDING',
    payment: raw?.payment || 'upi',
    created_at: raw?.created_at || new Date().toISOString(),
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [checkingRole, setCheckingRole] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [search, setSearch] = useState('')
  const [busyOrder, setBusyOrder] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<{ order: Order; newStatus: OrderStatus; label: string } | null>(null)
  const [declining, setDeclining] = useState<Order | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [declineBusy, setDeclineBusy] = useState(false)
  const [realtimeState, setRealtimeState] = useState<'connecting' | 'live' | 'offline'>('connecting')

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        setSession(data.session)
        setAuthLoading(false)
      }
    }).catch(() => {
      if (alive) setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthorized(false)
      setOrders([])
      setError('')
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  const loadOrders = useCallback(async (manual = false, currentSession = session, silent = false) => {
    if (!currentSession) return
    if (manual) setRefreshing(true)
    else if (!silent) setLoading(true)
    setError('')
    try {
      const result = await staffRequest(currentSession)
      const normalized = (result.orders || []).map(normalizeOrder)
      setOrders(normalized)
      setAuthorized(true)
    } catch (requestError) {
      const status = (requestError as Error & { status?: number }).status
      if (status === 403) {
        setAuthorized(false)
        setError('Access denied: Your account does not have canteen staff permissions. An administrator must assign a staff role.')
      } else if (status === 401) {
        setAuthorized(false)
        setError('Your session expired. Please sign in again.')
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load orders.')
      }
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      setAuthorized(false)
      return
    }
    setCheckingRole(true)
    void loadOrders(false, session).finally(() => setCheckingRole(false))
  }, [session, loadOrders])

  useEffect(() => {
    const client = supabase
    if (!client || !session || !authorized) return
    setRealtimeState('connecting')
    const channel = client
      .channel(`staff-orders-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void loadOrders(false, session, true)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeState('live')
          void loadOrders(false, session, true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeState('offline')
        }
      })
    return () => {
      setRealtimeState('offline')
      void client.removeChannel(channel)
    }
  }, [session, authorized, loadOrders])

  const counts = useMemo(() => ({
    total: orders.length,
    incoming: orders.filter((order) => order.status === 'PLACED').length,
    active: orders.filter((order) => ['ACCEPTED', 'PREPARING'].includes(order.status)).length,
    ready: orders.filter((order) => order.status === 'READY_FOR_PICKUP').length,
    completed: orders.filter((order) => order.status === 'PICKED_UP').length,
    declined: orders.filter((order) => order.status === 'CANCELLED').length,
  }), [orders])

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (filter !== 'ALL' && order.status !== filter) return false
      if (!query) return true
      const customerName = order.customer?.name || ''
      const rollNo = order.customer?.roll_no || ''
      const phone = order.customer?.phone || ''
      const items = Array.isArray(order.items) ? order.items : []
      return [
        order.order_number,
        String(order.token_number),
        customerName,
        rollNo,
        phone,
        ...items.map(itemName),
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [orders, filter, search])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoginBusy(true)
    setLoginError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoginBusy(false)
    if (signInError) {
      setLoginError(signInError.message)
      return
    }
    setSession(data.session)
    setPassword('')
  }

  async function signOut() {
    await supabase?.auth.signOut()
    setSession(null)
    setAuthorized(false)
    setOrders([])
  }

  async function transition(order: Order, newStatus: OrderStatus, reason = '') {
    if (!session || busyOrder) return
    setBusyOrder(order.id)
    setError('')
    try {
      const result = await staffRequest(session, { orderId: order.id, newStatus, reason })
      if (result.order) {
        const norm = normalizeOrder(result.order)
        setOrders((current) =>
          current.map((item) => (item.id === order.id ? { ...norm, customer: item.customer } : item))
        )
      }
      setDeclining(null)
      setDeclineReason('')
      setConfirmingAction(null)
      void loadOrders(false, session, true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update this order.')
      void loadOrders(false, session, true)
    } finally {
      setBusyOrder(null)
      setDeclineBusy(false)
    }
  }

  async function submitDecline(event: FormEvent) {
    event.preventDefault()
    if (!declining || !declineReason.trim()) return
    setDeclineBusy(true)
    await transition(declining, 'CANCELLED', declineReason.trim())
  }

  if (!supabase) {
    return <ConfigMessage />
  }

  if (authLoading || checkingRole) {
    return (
      <div className="center-state">
        <div className="spinner" />
        <p>Checking staff authorization…</p>
      </div>
    )
  }

  if (!session || !authorized) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">CB</div>
          <span className="eyebrow">CAMPUSBITES OPERATIONS</span>
          <h1>Staff sign in</h1>
          <p className="muted">Authorized staff and canteen administrators only.</p>

          {session && !authorized ? (
            <div style={{ marginTop: 20 }}>
              <div className="alert error" role="alert">
                <strong>Access Restricted</strong>
                <p style={{ margin: '4px 0 0', fontSize: 11 }}>
                  Signed in as <b>{session.user.email}</b>. This account is not authorized as staff. Student accounts cannot view canteen orders.
                </p>
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                  <button className="retry-inline" type="button" onClick={() => void loadOrders(true, session)}>
                    Re-check role
                  </button>
                  <button className="retry-inline" type="button" onClick={() => void signOut()}>
                    Sign in with another account
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!session ? (
            <form onSubmit={signIn} className="login-form">
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="staff@campusbites.edu"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              {loginError ? <div className="alert error" role="alert">{loginError}</div> : null}
              <button className="primary full" type="submit" disabled={loginBusy}>
                {loginBusy ? 'Verifying…' : 'Sign in to staff portal'}
              </button>
            </form>
          ) : null}

          <p className="login-footnote">
            Enforced server-side against Supabase staff roles.
          </p>
        </section>
      </main>
    )
  }

  const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'ALL', label: 'All orders' },
    { key: 'PLACED', label: 'Incoming' },
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'READY_FOR_PICKUP', label: 'Ready' },
    { key: 'PICKED_UP', label: 'Completed' },
    { key: 'CANCELLED', label: 'Declined' },
  ]

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <a className="brand-lockup" href="/" aria-label="CampusBites staff home">
          <span className="brand-mark small">CB</span>
          <span>
            Campus<span className="brand-accent">Bites</span>
            <small>STAFF OPERATIONS</small>
          </span>
        </a>
        <div className="topbar-right">
          <span className={`live-pill ${realtimeState}`}>
            <i />
            {realtimeState === 'live' ? 'Live updates' : realtimeState === 'connecting' ? 'Connecting' : 'Realtime offline'}
          </span>
          <span className="user-email">{session.user.email}</span>
          <button className="ghost-button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="page-heading">
          <div>
            <span className="eyebrow">CANTEEN CONTROL DESK</span>
            <h1>Order management</h1>
            <p>Review incoming tickets, manage kitchen preparation, and notify students at the pickup window.</p>
          </div>
          <button className="refresh-button" onClick={() => void loadOrders(true)} disabled={refreshing}>
            {refreshing ? <span className="button-spinner" /> : <span aria-hidden="true">↻</span>} Refresh
          </button>
        </section>

        <section className="stats-grid" aria-label="Order overview">
          <Stat label="Pending decision" value={counts.incoming} detail="Requires accept/decline" accent="orange" icon="↓" />
          <Stat label="Kitchen preparing" value={counts.active} detail="Accepted or cooking" accent="blue" icon="◷" />
          <Stat label="Ready for pickup" value={counts.ready} detail="Waiting at pickup window" accent="green" icon="✓" />
          <Stat label="Completed orders" value={counts.completed} detail="Collected by student" accent="violet" icon="▣" />
          <Stat label="Declined orders" value={counts.declined} detail="Cancelled tickets" accent="red" icon="✕" />
        </section>

        <section className="orders-panel">
          <div className="panel-heading">
            <div>
              <h2>Orders</h2>
              <p>{orders.length} tickets total</p>
            </div>
            <label className="search-box">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search token, order, student, item"
              />
            </label>
          </div>

          <div className="filter-row" role="tablist" aria-label="Filter orders">
            {filters.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={filter === item.key}
                className={`filter-chip ${filter === item.key ? 'selected' : ''}`}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                {item.key === 'PLACED' && counts.incoming > 0 ? <b>{counts.incoming}</b> : null}
              </button>
            ))}
          </div>

          {error ? (
            <div className="alert error page-alert" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadOrders(true)}>Retry</button>
            </div>
          ) : null}

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
              <p>Loading kitchen tickets…</p>
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">{search ? '⌕' : '▤'}</span>
              <strong>{search ? 'No matching orders' : 'No orders in this queue'}</strong>
              <p>{search ? 'Try another token, customer name, or menu item.' : 'New student orders will automatically appear here in real time.'}</p>
            </div>
          ) : (
            <div className="order-list">
              {visibleOrders.map((order) => {
                const action = nextStep[order.status]
                const isBusy = busyOrder === order.id
                return (
                  <article className={`order-card status-${order.status.toLowerCase()}`} key={order.id}>
                    <div className="order-main">
                      <div className="order-title-row">
                        <div>
                          <span className="token">TOKEN #{String(order.token_number).padStart(2, '0')}</span>
                          <span className="order-number">{order.order_number}</span>
                        </div>
                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                          {statusNames[order.status]}
                        </span>
                      </div>

                      <div className="order-meta">
                        <span>Placed {time(order.created_at)}</span>
                        <span>Prep ETA {order.eta_minutes}m</span>
                        <span className={`payment-badge ${(order.payment_status || 'PENDING').toLowerCase()}`}>
                          {order.payment_status || 'PENDING'} · {(order.payment || 'UPI').toUpperCase()}
                        </span>
                      </div>

                      {order.customer ? (
                        <div className="order-customer">
                          <span className="customer-icon">👤</span>
                          <span className="customer-name">{order.customer.name || 'Student Customer'}</span>
                          {order.customer.roll_no ? (
                            <span className="customer-detail">Roll: {order.customer.roll_no}</span>
                          ) : null}
                          {order.customer.phone ? (
                            <span className="customer-detail">{order.customer.phone}</span>
                          ) : null}
                        </div>
                      ) : null}

                      <ul className="items-list">
                        {(order.items || []).map((item, index) => (
                          <li key={`${item.id ?? itemName(item)}-${index}`}>
                            <span>
                              <b>{item.quantity}×</b> {itemName(item)}
                              {item.customizations ? (
                                <small>
                                  {typeof item.customizations === 'string'
                                    ? item.customizations
                                    : Object.entries(item.customizations)
                                        .map(([key, value]) => `${key}: ${String(value)}`)
                                        .join(' · ')}
                                </small>
                              ) : null}
                            </span>
                            <span>
                              {currency(
                                Number(item.subtotal ?? (item.price ?? item.unit_price ?? 0) * item.quantity),
                                order.currency || 'INR'
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="order-footer">
                        <span>Total amount</span>
                        <strong>{currency(order.total, order.currency || 'INR')}</strong>
                      </div>

                      {order.status === 'CANCELLED' && order.cancellation_reason ? (
                        <p className="decline-reason">
                          <strong>Declined reason:</strong> {order.cancellation_reason}
                        </p>
                      ) : null}
                    </div>

                    {action || ['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.status) ? (
                      <div className="order-actions">
                        {action ? (
                          <button
                            className="primary action-button"
                            disabled={isBusy || !!busyOrder}
                            onClick={() => setConfirmingAction({ order, newStatus: action.status, label: action.label })}
                          >
                            {isBusy ? 'Saving…' : action.label}
                          </button>
                        ) : null}
                        {['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.status) ? (
                          <button
                            className="decline-button"
                            disabled={isBusy || !!busyOrder}
                            onClick={() => {
                              setDeclining(order)
                              setDeclineReason('')
                            }}
                          >
                            {order.status === 'PLACED' ? 'Decline' : 'Cancel order'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          CampusBites Kitchen Operations. Connected to shared PostgreSQL orders database.
        </footer>
      </main>

      {/* Confirmation Modal for Consequential Actions */}
      {confirmingAction ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-action-title"
          >
            <button className="modal-close" type="button" onClick={() => setConfirmingAction(null)} aria-label="Close">
              ×
            </button>
            <span className="eyebrow">
              ORDER {confirmingAction.order.order_number} · TOKEN #{confirmingAction.order.token_number}
            </span>
            <h2 id="confirm-action-title">{confirmingAction.label}?</h2>
            <p>
              Transition status from <b>{statusNames[confirmingAction.order.status]}</b> to{' '}
              <b>{statusNames[confirmingAction.newStatus]}</b>. This will update the student tracking view in real time.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setConfirmingAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!!busyOrder}
                onClick={() => void transition(confirmingAction.order, confirmingAction.newStatus)}
              >
                {busyOrder ? 'Updating…' : `Confirm: ${confirmingAction.label}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Decline / Cancellation Modal with Mandatory Reason */}
      {declining ? (
        <div className="modal-backdrop" role="presentation">
          <form
            className="reason-modal"
            onSubmit={submitDecline}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decline-title"
          >
            <button className="modal-close" type="button" onClick={() => setDeclining(null)} aria-label="Close">
              ×
            </button>
            <span className="eyebrow">ORDER {declining.order_number} · TOKEN #{declining.token_number}</span>
            <h2 id="decline-title">Decline this order?</h2>
            <p>
              This order will be cancelled. Please provide an explanation (e.g. ingredient out of stock) so the student knows why.
            </p>
            <label>
              Reason for declining
              <textarea
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                placeholder="e.g. Kitchen is out of eggs / item unavailable"
                maxLength={300}
                required
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setDeclining(null)}>
                Keep order
              </button>
              <button type="submit" className="danger-button" disabled={declineBusy || !declineReason.trim()}>
                {declineBusy ? 'Saving…' : 'Confirm decline'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  accent,
  icon,
}: {
  label: string
  value: number
  detail: string
  accent: string
  icon: string
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${accent}`}>{icon}</span>
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function ConfigMessage() {
  return (
    <main className="center-state">
      <div className="brand-mark">CB</div>
      <h1>Staff dashboard configuration required</h1>
      <p>
        Please configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the staff dashboard environment.
      </p>
    </main>
  )
}

export default App
