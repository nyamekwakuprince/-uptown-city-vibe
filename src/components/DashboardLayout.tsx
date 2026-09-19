import { useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/events', label: 'Events', end: false },
  { to: '/dashboard/checkin', label: 'Check-in', end: false },
  { to: '/dashboard/attendees', label: 'Attendees', end: true },
  { to: '/dashboard/revenue', label: 'Revenue', end: true },
  { to: '/dashboard/members', label: 'Members', end: true },
  { to: '/dashboard/photos', label: 'Photos', end: true },
  { to: '/dashboard/trash', label: 'Trash', end: true },
]

export default function DashboardLayout() {
  const { session, profile, loading } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Loading dashboard…</p>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!profile?.organization_id) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">You need an organizer account to see this page.</p>
  }

  if (profile.access_status === 'pending') {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Your access is awaiting admin approval.</p>
  }

  if (profile.access_status !== 'active') {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">You need an organizer account to see this page.</p>
  }

  const items = profile.role === 'platform_admin'
    ? [...navItems, { to: '/dashboard/admin', label: 'Admin', end: true }]
    : navItems

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-sm uppercase tracking-widest text-flame">Uptown City Vibe</p>
      <h1 className="display text-3xl text-paper">Organizer Dashboard</h1>
      <p className="mt-1 text-muted">Performance overview, event operations, community roster, and past event media.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-[12rem_1fr]">
        <button
          type="button"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
          className="flex min-h-11 items-center justify-between rounded-lg border border-black/10 px-4 py-2 text-left text-sm font-medium text-paper md:hidden"
        >
          <span>{mobileNavOpen ? 'Close dashboard menu' : 'Open dashboard menu'}</span>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {mobileNavOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <nav className={`${mobileNavOpen ? 'flex' : 'hidden'} gap-2 md:flex md:flex-col`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => `whitespace-nowrap rounded-lg px-4 py-2 text-left text-sm ${
                isActive
                  ? 'border-l-2 border-flame bg-flame/10 font-medium text-flame'
                  : 'text-muted hover:bg-black/5 hover:text-paper'
              }`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
