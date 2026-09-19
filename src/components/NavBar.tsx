import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { session, signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(location.search).get('search') ?? '')
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const isDashboardRoute = location.pathname.startsWith('/dashboard')
  const isAdmin = Boolean(session && (profile?.role === 'organizer_admin' || profile?.role === 'platform_admin'))

  useEffect(() => {
    function closeProfileMenu(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeProfileMenu)
    return () => document.removeEventListener('mousedown', closeProfileMenu)
  }, [])

  useEffect(() => {
    setSearchQuery(new URLSearchParams(location.search).get('search') ?? '')
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="display text-xl font-semibold tracking-tight text-paper">
          Uptown City Vibe
        </Link>

        <div className="flex items-center gap-4">
          {!isDashboardRoute && (
            <nav className="flex items-center gap-5 text-sm text-muted">
              <Link to="/" className="transition hover:text-paper">Home</Link>
              <Link to="/membership" className="transition hover:text-paper">Membership</Link>
            </nav>
          )}

          <form onSubmit={submitSearch} className="relative hidden sm:block">
            <input
              type="search"
              aria-label="Search events"
              placeholder="Search event names..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-52 rounded-full border border-black/15 bg-surface px-4 py-2 pr-9 text-sm text-paper placeholder:text-muted focus:border-gold focus:outline-none"
            />
            <svg className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>

          {isAdmin ? (
            <nav className="flex items-center gap-5 text-sm text-muted">
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
        </div>
      </div>
    </header>
  )
}
