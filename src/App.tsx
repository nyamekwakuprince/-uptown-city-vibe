import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import NavBar from './components/NavBar'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import AllEvents from './pages/AllEvents'
import EventDetail from './pages/EventDetail'
import Login from './pages/Login'
import JoinOrganizer from './pages/JoinOrganizer'
import {
  DashboardAdminPage,
  DashboardAdminTeamPage,
  DashboardAdminPendingPage,
  DashboardAdminInvitesPage,
  DashboardEventPage,
  DashboardEventEditPage,
  DashboardEventsPage,
  DashboardEventsListPage,
  DashboardCheckInPage,
  DashboardCheckInEventPage,
  DashboardGalleryPage,
  DashboardGalleryEventPage,
  DashboardPhotosPage,
  DashboardMembersPage,
  DashboardNewEventPage,
  DashboardOverviewPage,
  DashboardPendingMembersPage,
  DashboardActiveMembersPage,
  DashboardAttendeesPage,
  DashboardRevenuePage,
  DashboardTrashPage,
} from './pages/Dashboard'
import Membership from './pages/Membership'
import CheckoutVerify from './pages/CheckoutVerify'
import CheckoutReview from './pages/CheckoutReview'
import TeamConfirmation from './pages/TeamConfirmation'
import Gallery from './pages/Gallery'
import Footer from './components/Footer'

type ErrorBoundaryState = { hasError: boolean }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
          <h1 className="display text-3xl text-paper">Something went wrong loading this page.</h1>
        </main>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}

function AppShell() {
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')

  return (
    <div className="min-h-screen bg-ink">
      <NavBar />
      <ErrorBoundary>
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/all-events" element={<AllEvents />} />
            <Route path="/events/:slug" element={<EventDetail />} />
            <Route path="/past-events/:eventId" element={<Gallery />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/checkout/verify" element={<CheckoutVerify />} />
            <Route path="/checkout/review" element={<CheckoutReview />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join/:token" element={<JoinOrganizer />} />
            <Route path="/team-confirmation/:token" element={<TeamConfirmation />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardOverviewPage />} />
              <Route path="events" element={<DashboardEventsPage />} />
              <Route path="events/ongoing" element={<DashboardEventsListPage category="ongoing" />} />
              <Route path="events/upcoming" element={<DashboardEventsListPage category="upcoming" />} />
              <Route path="events/past" element={<DashboardEventsListPage category="past" />} />
              <Route path="events/new" element={<DashboardNewEventPage />} />
              <Route path="events/:id" element={<DashboardEventPage />} />
              <Route path="events/:id/edit" element={<DashboardEventEditPage />} />
              <Route path="checkin" element={<DashboardCheckInPage />} />
              <Route path="checkin/:eventId" element={<DashboardCheckInEventPage />} />
              <Route path="attendees" element={<DashboardAttendeesPage />} />
              <Route path="revenue" element={<DashboardRevenuePage />} />
              <Route path="members" element={<DashboardMembersPage />} />
              <Route path="members/pending" element={<DashboardPendingMembersPage />} />
              <Route path="members/active" element={<DashboardActiveMembersPage />} />
              <Route path="past-events" element={<DashboardGalleryPage />} />
              <Route path="past-events/:eventId" element={<DashboardGalleryEventPage />} />
              <Route path="photos" element={<DashboardPhotosPage />} />
              <Route path="admin" element={<DashboardAdminPage />} />
              <Route path="admin/team" element={<DashboardAdminTeamPage />} />
              <Route path="admin/pending" element={<DashboardAdminPendingPage />} />
              <Route path="admin/invites" element={<DashboardAdminInvitesPage />} />
              <Route path="trash" element={<DashboardTrashPage />} />
            </Route>
        </Routes>
      </ErrorBoundary>
      {!isDashboardRoute && <Footer />}
    </div>
  )
}
