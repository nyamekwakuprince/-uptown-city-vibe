import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const dashboardNavItems = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/events', label: 'Events', end: false },
  { to: '/dashboard/checkin', label: 'Check-in', end: false },
  { to: '/dashboard/attendees', label: 'Attendees', end: true },
  { to: '/dashboard/revenue', label: 'Revenue', end: true },
  { to: '/dashboard/members', label: 'Members', end: true },
  { to: '/dashboard/photos', label: 'Photos', end: true },
  { to: '/dashboard/trash', label: 'Trash', end: true },
]

export default function NavBar() {
  const { session, signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(location.search).get('search') ?? '')
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isAdmin = Boolean(session && (profile?.role === 'organizer_admin' || profile?.role === 'platform_admin'))
  const isPlatformAdmin = profile?.role === 'platform_admin'
  const mobileDashboardItems = isPlatformAdmin
    ? [...dashboardNavItems, { to: '/dashboard/admin', label: 'Admin', end: true }]
    : dashboardNavItems

  useEffect(() => {
    function closeProfileMenu(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeProfileMenu)
    return () => document.removeEventListener('mousedown', closeProfileMenu)
  }, [])

  useEffect(() => {
    setSearchQuery(new URLSearchParams(location.search).get('search') ?? '')
    setMobileMenuOpen(false)
  }, [location.search])

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams(location.pathname === '/' ? location.search : '')
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    else params.delete('search')
    const query = params.toString()
    navigate(query ? `/search?${query}` : '/search')
  }

  const initial = profile?.full_name?.trim().charAt(0).toUpperCase() || profile?.email?.charAt(0).toUpperCase() || '?'

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        {isDashboardRoute && (
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="order-1 flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 text-paper sm:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        )}

        <Link to="/" className={`${isDashboardRoute ? 'order-2' : ''} flex min-w-0 items-center gap-2.5 text-paper`}>
          <img src="/uptown-city-vibez-logo.png" alt="Uptown Vibez City logo" className="h-9 w-9 shrink-0 object-contain" />
          <span className="display hidden truncate text-base font-semibold tracking-tight text-paper sm:inline sm:text-xl">Uptown Vibez City</span>
        </Link>

        <div className={`${isDashboardRoute ? 'order-3' : ''} flex items-center gap-3 sm:gap-4`}>
          {!isDashboardRoute && (
            <nav className={`${isDashboardRoute ? 'flex' : 'hidden'} items-center gap-5 text-sm text-muted sm:flex`}>
              <Link to="/" className="transition hover:text-paper">Home</Link>
              <Link to="/membership" className="transition hover:text-paper">Membership</Link>
            </nav>
          )}

          <form onSubmit={submitSearch} className="relative hidden w-full max-w-[210px] sm:block">
            <input
              type="search"
              aria-label="Search events"
              placeholder="Search event names..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border border-black/15 bg-surface px-4 py-2 pr-9 text-base text-paper placeholder:text-muted focus:border-gold focus:outline-none"
            />
            <svg className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>

          {isAdmin ? (
            <nav className={`${isDashboardRoute ? 'flex' : 'hidden'} items-center gap-5 text-sm text-muted sm:flex`}>
              <div ref={profileMenuRef} className="relative">
                <button type="button" aria-label="Open profile menu" onClick={() => setProfileOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-semibold text-ink hover:brightness-95">
                  {initial}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-black/10 bg-surface p-3 shadow-xl">
                    <div className="border-b border-black/10 px-3 pb-3">
                      <p className="font-medium text-paper">{profile?.full_name || 'Organizer profile'}</p>
                      <p className="mt-1 break-all text-xs text-muted">{profile?.email || 'Signed-in account'}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      <button type="button" disabled={isDashboardRoute} onClick={() => { setProfileOpen(false); navigate('/dashboard') }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-paper hover:bg-black/5 disabled:cursor-default disabled:opacity-40">Dashboard</button>
                      <Link to="/" aria-disabled={isDashboardRoute ? undefined : true} onClick={(event) => { if (!isDashboardRoute) event.preventDefault(); else setProfileOpen(false) }} className={`block rounded-lg px-3 py-2 text-sm ${isDashboardRoute ? 'text-paper hover:bg-black/5' : 'cursor-default text-muted opacity-40'}`}>View site</Link>
                      <button type="button" onClick={async () => { setProfileOpen(false); await signOut(); navigate('/') }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-flame hover:bg-flame/10">Sign out</button>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          ) : null}

          {!isDashboardRoute && <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 text-paper sm:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {mobileMenuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>}
        </div>

        {mobileMenuOpen && (
          <nav className={`${isDashboardRoute ? 'order-4' : ''} basis-full border-t border-black/10 pt-3 sm:hidden`}>
            {isDashboardRoute && (
              <div className="flex flex-col gap-1 text-sm text-muted">
                {mobileDashboardItems.map((item) => (
                  <Link key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2 hover:bg-black/5 hover:text-paper">{item.label}</Link>
                ))}
              </div>
            )}
            {!isDashboardRoute && (
              <div className="flex flex-col gap-1 text-sm text-muted">
                <Link to="/" className="rounded-lg px-3 py-2 hover:bg-black/5 hover:text-paper">Home</Link>
                <Link to="/membership" className="rounded-lg px-3 py-2 hover:bg-black/5 hover:text-paper">Membership</Link>
              </div>
            )}
            {isAdmin && !isDashboardRoute && (
              <div className={`${isDashboardRoute ? '' : 'mt-2 border-t border-black/10 pt-2'} flex flex-col gap-1 text-sm text-muted`}>
                <button type="button" onClick={() => { setMobileMenuOpen(false); navigate('/dashboard') }} className="rounded-lg px-3 py-2 text-left hover:bg-black/5 hover:text-paper">Dashboard</button>
                <Link to="/" className="rounded-lg px-3 py-2 hover:bg-black/5 hover:text-paper">View site</Link>
                <button type="button" onClick={async () => { setMobileMenuOpen(false); await signOut(); navigate('/') }} className="rounded-lg px-3 py-2 text-left text-flame hover:bg-flame/10">Sign out</button>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
