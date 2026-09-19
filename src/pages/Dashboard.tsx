import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import confetti from 'canvas-confetti'
import { supabase, formatDate, formatGHS, callFunction, sendConfirmationEmail } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import type { EventRow, TicketType, Registration, Order, Ticket, Member, GalleryImage } from '../lib/types'

type TicketTierDraft = {
  id: string
  name: string
  price: string
  quantity_available: string
  admits_count: string
}

function useOrganizationEvents(organizationId: string | null) {
  const [events, setEvents] = useState<EventRow[]>([])

  async function loadEvents() {
    if (!organizationId) return
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('start_datetime', { ascending: true })
    setEvents((data as EventRow[]) ?? [])
  }

  useEffect(() => { loadEvents() }, [organizationId])

  return { events, reload: loadEvents }
}

function isOngoingEvent(event: EventRow, now: number) {
  return event.status === 'published'
    && new Date(event.start_datetime).getTime() <= now
    && Boolean(event.end_datetime)
    && new Date(event.end_datetime as string).getTime() >= now
}

function isPastEvent(event: EventRow, now: number) {
  return event.status !== 'draft' && new Date(event.start_datetime).getTime() <= now && !isOngoingEvent(event, now)
}

export function DashboardOverviewPage() {
  const { profile } = useAuth()
  const { events } = useOrganizationEvents(profile?.organization_id ?? null)
  return <Overview organizationId={profile?.organization_id ?? ''} events={events} />
}

export function DashboardAttendeesPage() {
  return <AttendeesPage />
}

export function DashboardRevenuePage() {
  return <RevenuePage />
}

export function DashboardEventsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { events } = useOrganizationEvents(profile?.organization_id ?? null)
  const now = Date.now()
  const upcoming = events.filter((event) => new Date(event.start_datetime).getTime() > now).length
  const past = events.filter((event) => isPastEvent(event, now)).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="display text-2xl text-paper">Events</h2>
          <p className="text-sm text-muted">Manage ongoing, upcoming, and past events.</p>
        </div>
        <button onClick={() => navigate('/dashboard/events/new')} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95">+ New event</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <EventSummaryCard label="Upcoming events" count={upcoming} description="Scheduled events" onClick={() => navigate('/dashboard/events/upcoming')} />
        <EventSummaryCard label="Past events" count={past} description="Completed or closed events" onClick={() => navigate('/dashboard/events/past')} />
      </div>
    </div>
  )
}

export function DashboardEventsListPage({ category }: { category: 'ongoing' | 'upcoming' | 'past' }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { events, reload } = useOrganizationEvents(profile?.organization_id ?? null)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function deleteEvent() {
    if (!deletingEventId) return
    setDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', deletingEventId)
      if (error) {
        setDeleteError(error.message)
        return
      }
      setDeletingEventId(null)
      await reload()
    } finally {
      setDeleting(false)
    }
  }

  const now = Date.now()
  const ongoingEvents = events.filter((event) => isOngoingEvent(event, now))
  const upcomingEvents = events.filter((event) => new Date(event.start_datetime).getTime() > now)
  const pastEvents = events.filter((event) => isPastEvent(event, now))
  const categoryEvents = category === 'ongoing' ? ongoingEvents : category === 'upcoming' ? upcomingEvents : pastEvents
  const title = category === 'ongoing' ? 'Ongoing events' : category === 'upcoming' ? 'Upcoming events' : 'Past events'
  const pageTitle = category === 'past' ? 'Your Past Events' : category === 'upcoming' ? 'Your Upcoming Events' : 'Your Events'

  function eventCard(event: EventRow) {
    const past = isPastEvent(event, now)
    return (
      <div
        key={event.id}
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/dashboard/events/${event.id}`)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/dashboard/events/${event.id}`) }}
        className="group cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-surface focus:outline-none focus:ring-2 focus:ring-gold"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-light">
          {event.banner_image_url ? <img src={event.banner_image_url} alt={`${event.title} flyer`} className="h-full w-full object-cover" /> : <span className="display text-4xl text-muted">{event.title[0]}</span>}
          <div className="absolute inset-0 flex items-end justify-end gap-2 bg-black/30 p-3 opacity-0 transition group-hover:opacity-100">
            <button disabled={past} onClick={(e) => { e.stopPropagation(); if (!past) navigate(`/dashboard/events/${event.id}/edit`) }} className="rounded-full border border-black/15 bg-surface px-4 py-1.5 text-sm text-paper hover:bg-black/5 disabled:cursor-not-allowed disabled:border-black/10 disabled:text-muted">Edit</button>
            <button disabled={past} onClick={(e) => { e.stopPropagation(); if (!past) setDeletingEventId(event.id) }} className="rounded-full bg-flame px-4 py-1.5 text-sm text-ink hover:brightness-95 disabled:cursor-not-allowed disabled:bg-black/10 disabled:text-muted">Delete</button>
          </div>
        </div>
        <div className="p-4"><h3 className="display text-lg text-paper">{event.title}</h3><p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p></div>
      </div>
    )
  }

  function eventSection(title: string, items: EventRow[], emptyMessage: string) {
    return <section className={title ? 'mt-8' : 'mt-2'}>{title && <div className="flex items-baseline justify-between gap-3"><h3 className="display text-xl text-paper">{title}</h3><span className="text-sm text-muted">{items.length}</span></div>}<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(eventCard)}{items.length === 0 && <p className="text-sm text-muted">{emptyMessage}</p>}</div></section>
  }

  return (
    <div>
      <DashboardBackButton />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="display text-2xl text-paper">{pageTitle}</h2>
          <p className="text-sm text-muted">Manage schedules, tickets, attendees, and check-ins.</p>
        </div>
        <button
          onClick={() => navigate(category === 'past' ? '/dashboard/past-events' : '/dashboard/events/new')}
          className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95"
        >
          {category === 'past' ? '+ Add past event' : '+ New event'}
        </button>
      </div>

      {category === 'ongoing' ? eventSection(title, categoryEvents, 'No events are happening right now.') : eventSection('', categoryEvents, category === 'past' ? 'No past events yet.' : 'No upcoming events scheduled.')}
      {deleteError && <p className="mt-4 text-sm text-flame">Could not delete event: {deleteError}</p>}
      <ConfirmDialog
        open={deletingEventId !== null}
        title="Delete this event?"
        message="The event will move to Trash and be permanently deleted after 30 days."
        confirmLabel="Delete event"
        loading={deleting}
        onConfirm={deleteEvent}
        onCancel={() => { if (!deleting) setDeletingEventId(null) }}
      />
    </div>
  )
}

export function DashboardCheckInPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { events } = useOrganizationEvents(profile?.organization_id ?? null)
  const now = Date.now()
  const checkInEvents = events.filter((event) => event.status === 'published' && !isPastEvent(event, now))

  return (
    <div>
      <div className="mb-6">
        <h2 className="display text-2xl text-paper">Check-in</h2>
        <p className="text-sm text-muted">Choose an ongoing or upcoming event to scan tickets and registrations.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {checkInEvents.map((event) => (
          <div
            key={event.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/checkin/${event.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/dashboard/checkin/${event.id}`) }}
            className="group cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-surface focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-light">
              {event.banner_image_url ? <img src={event.banner_image_url} alt={`${event.title} flyer`} className="h-full w-full object-cover" /> : <span className="display text-4xl text-muted">{event.title[0]}</span>}
            </div>
            <div className="p-4"><h3 className="display text-lg text-paper">{event.title}</h3><p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p></div>
          </div>
        ))}
        {checkInEvents.length === 0 && <p className="text-sm text-muted">No ongoing or upcoming published events.</p>}
      </div>
    </div>
  )
}

export function DashboardCheckInEventPage() {
  const { profile } = useAuth()
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEvent() {
      if (!eventId || !profile?.organization_id) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('organization_id', profile.organization_id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .single()
      setEvent((data as EventRow) ?? null)
      setLoading(false)
    }
    loadEvent()
  }, [eventId, profile?.organization_id])

  if (loading) return <p className="py-8 text-muted">Loading event…</p>
  if (!event) return <p className="py-8 text-muted">Event not found.</p>

  const isPast = isPastEvent(event, Date.now())

  return (
    <div>
      <button type="button" onClick={() => navigate('/dashboard/checkin')} className="mb-6 text-sm text-muted hover:text-paper">← Back to check-in</button>
      <div className="mb-6">
        <p className="text-sm uppercase tracking-widest text-flame">Check-in</p>
        <h2 className="display mt-1 text-2xl text-paper">{event.title}</h2>
        <p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p>
      </div>
      {isPast ? (
        <p className="rounded-lg border border-flame/20 bg-flame/10 p-4 text-sm text-flame">Check-in is closed because this event has passed.</p>
      ) : (
        <CheckInPanel event={event} />
      )}
    </div>
  )
}

function EventSummaryCard({ label, count, description, onClick }: { label: string; count: number; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-black/10 bg-surface p-5 text-left transition hover:border-flame/50">
      <p className="text-sm text-muted">{label}</p>
      <p className="display mt-1 text-3xl text-paper">{count}</p>
      <p className="mt-3 text-sm text-muted">{description} →</p>
    </button>
  )
}

export function DashboardMembersPage() {
  const { profile } = useAuth()
  return <MembersSummaryPage organizationId={profile?.organization_id ?? ''} />
}

export function DashboardPendingMembersPage() {
  const { profile } = useAuth()
  return <MembersPanel organizationId={profile?.organization_id ?? ''} status="pending" />
}

export function DashboardActiveMembersPage() {
  const { profile } = useAuth()
  return <MembersPanel organizationId={profile?.organization_id ?? ''} status="active" />
}

export function DashboardGalleryPage() {
  const { profile } = useAuth()
  return <GalleryPanel organizationId={profile?.organization_id ?? ''} />
}

export function DashboardGalleryEventPage() {
  const { eventId } = useParams()
  const { profile } = useAuth()
  return <GalleryPanel organizationId={profile?.organization_id ?? ''} eventId={eventId} />
}

export function DashboardPhotosPage() {
  const { profile } = useAuth()
  return <GalleryPanel organizationId={profile?.organization_id ?? ''} photosOnly />
}

export function DashboardBackButton() {
  const navigate = useNavigate()
  return <button type="button" aria-label="Go back" onClick={() => navigate(-1)} className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-xl text-paper hover:bg-black/5">←</button>
}

export function DashboardTrashPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<TrashItem[]>([])
  const [pendingAction, setPendingAction] = useState<{ kind: 'restore' | 'delete'; item: TrashItem } | null>(null)
  const [completing, setCompleting] = useState(false)

  async function loadTrash() {
    if (!profile?.organization_id) return
    const [{ data: eventData }, { data: photoData }] = await Promise.all([
      supabase.from('events').select('*').eq('organization_id', profile.organization_id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('gallery_images').select('*').eq('organization_id', profile.organization_id).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])
    const trashItems: TrashItem[] = [
      ...((eventData as EventRow[]) ?? []).map((event) => ({ type: 'event' as const, item: event })),
      ...((photoData as GalleryImage[]) ?? []).map((photo) => ({ type: 'photo' as const, item: photo })),
    ]
    trashItems.sort((a, b) => new Date(b.item.deleted_at ?? 0).getTime() - new Date(a.item.deleted_at ?? 0).getTime())
    setItems(trashItems)
  }

  useEffect(() => { loadTrash() }, [profile?.organization_id])

  function daysLeft(deletedAt: string) {
    const expiresAt = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
  }

  async function completeAction() {
    if (!pendingAction) return
    setCompleting(true)
    try {
      const { type, item } = pendingAction.item
      if (pendingAction.kind === 'restore') {
        await supabase.from(type === 'event' ? 'events' : 'gallery_images').update({ deleted_at: null }).eq('id', item.id)
      } else if (type === 'event') {
        await supabase.from('events').delete().eq('id', item.id)
      } else {
        const photo = item as GalleryImage
        const path = photo.image_url.split('/gallery/')[1]
        if (path) await supabase.storage.from('gallery').remove([path])
        await supabase.from('gallery_images').delete().eq('id', photo.id)
      }
      setPendingAction(null)
      await loadTrash()
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div>
      <DashboardBackButton />
      <h2 className="display text-2xl text-paper">Trash</h2>
      <p className="mt-1 text-sm text-muted">Deleted items are permanently removed after 30 days.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ type, item: record }) => {
          const isEvent = type === 'event'
          const event = isEvent ? record as EventRow : null
          const photo = !isEvent ? record as GalleryImage : null
          const trashItem: TrashItem = isEvent
            ? { type: 'event', item: event as EventRow }
            : { type: 'photo', item: photo as GalleryImage }
          const thumbnail = event?.banner_image_url ?? photo?.image_url
          const label = event ? `Event: ${event.title}` : `Photo${photo?.caption ? `: ${photo.caption}` : ''}`
          return (
            <div key={`${type}-${record.id}`} className="group relative overflow-hidden rounded-2xl border border-black/10 bg-surface transition-all duration-200 hover:border-black/20 hover:shadow-md">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-light">
                {thumbnail ? (
                  <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="display text-4xl text-muted">{event?.title[0] ?? 'P'}</span>
                )}
                {/* Badges */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{record.deleted_at ? `${daysLeft(record.deleted_at)}d left` : 'Pending'}</span>
                </div>
                <span className="absolute top-3 right-3 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 shadow-sm backdrop-blur-md">
                  {type}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="display text-lg font-semibold text-paper line-clamp-1">{label}</h3>
                <p className="mt-1 text-xs text-muted">
                  {record.deleted_at
                    ? `Auto-deletes in ${daysLeft(record.deleted_at)} days if not restored`
                    : 'Scheduled for deletion'}
                </p>

                {/* Redesigned Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-black/10 pt-3.5">
                  <button
                    type="button"
                    onClick={() => setPendingAction({ kind: 'restore', item: trashItem })}
                    className="group/restore flex items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-ink py-2 px-3 text-xs font-semibold text-paper shadow-xs transition-all hover:border-black/30 hover:bg-black/5 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-black/20"
                    title="Restore item to active dashboard"
                  >
                    <svg
                      className="h-3.5 w-3.5 text-muted transition-transform duration-200 group-hover/restore:-rotate-45 group-hover/restore:text-paper"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingAction({ kind: 'delete', item: trashItem })}
                    className="group/delete flex items-center justify-center gap-1.5 rounded-xl border border-flame/25 bg-flame/10 py-2 px-3 text-xs font-semibold text-flame transition-all hover:border-flame hover:bg-flame hover:text-ink hover:shadow-xs active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-flame/30"
                    title="Delete permanently from servers"
                  >
                    <svg
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover/delete:scale-110"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {items.length === 0 && <p className="text-sm text-muted">Trash is empty.</p>}
      </div>
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === 'restore' ? 'Restore this item?' : 'Delete permanently?'}
        message={pendingAction?.kind === 'restore'
          ? "It'll reappear on your dashboard and the public site."
          : "This can't be undone. It will be gone immediately instead of waiting out the 30-day trash period."}
        confirmLabel={pendingAction?.kind === 'restore' ? 'Restore' : 'Delete permanently'}
        confirmClassName={pendingAction?.kind === 'restore' ? 'bg-paper text-ink hover:bg-black/80' : 'bg-flame text-ink hover:brightness-90'}
        loading={completing}
        onConfirm={completeAction}
        onCancel={() => { if (!completing) setPendingAction(null) }}
      />
    </div>
  )
}

type TrashItem =
  | { type: 'event'; item: EventRow }
  | { type: 'photo'; item: GalleryImage }

export function DashboardNewEventPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const organizationId = profile?.organization_id ?? ''
  const [isPaid, setIsPaid] = useState(false)
  const [status, setStatus] = useState<EventRow['status']>('published')
  const [form, setForm] = useState({
    title: '', description: '', venue_name: '', venue_address: '',
    start_datetime: '', capacity: '', registration_starts_at: '', registration_ends_at: '',
  })
  const [tiers, setTiers] = useState<TicketTierDraft[]>([
    { id: crypto.randomUUID(), name: '', price: '', quantity_available: '', admits_count: '1' },
  ])
  const [files, setFiles] = useState<FileList | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [removingTier, setRemovingTier] = useState<string | null>(null)

  function updateTier(id: string, field: keyof TicketTierDraft, value: string) {
    setTiers((current) => current.map((tier) => (tier.id === id ? { ...tier, [field]: value } : tier)))
  }

  function addTier() {
    setTiers((current) => [...current, { id: crypto.randomUUID(), name: '', price: '', quantity_available: '', admits_count: '1' }])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setLoading(true)
    setError('')

    if (isPaid) {
      const validTiers = tiers.filter((tier) => tier.name.trim() || tier.price || tier.quantity_available || tier.admits_count !== '1')
      if (!validTiers.length || validTiers.some((tier) => !tier.name.trim() || !tier.price || !tier.quantity_available)) {
        setLoading(false)
        setError('Add at least one complete ticket tier with a name, price, and quantity.')
        return
      }
    }

    const slug = `${form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`
    const { data: newEvent, error: insertError } = await supabase.from('events').insert({
      organization_id: organizationId,
      title: form.title,
      slug,
      description: form.description,
      venue_name: form.venue_name,
      venue_address: form.venue_address,
      start_datetime: form.start_datetime,
      is_paid: isPaid,
      status,
      capacity: form.capacity ? Number(form.capacity) : null,
      registration_starts_at: isPaid ? null : (form.registration_starts_at || null),
      registration_ends_at: isPaid ? null : (form.registration_ends_at || null),
    }).select().single()

    if (insertError || !newEvent) {
      setLoading(false)
      setError(insertError?.message ?? 'Could not create event.')
      return
    }

    if (bannerFile) {
      const path = `${organizationId}/${newEvent.id}/banner-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('gallery').upload(path, bannerFile)
      if (uploadError) {
        setError(`Event created, but the banner upload failed: ${uploadError.message}`)
      } else {
        const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
        const { error: bannerUpdateError } = await supabase.from('events').update({ banner_image_url: pub.publicUrl }).eq('id', newEvent.id)
        if (bannerUpdateError) setError(`Event created, but saving the banner failed: ${bannerUpdateError.message}`)
      }
    }

    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const path = `${organizationId}/${newEvent.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('gallery').upload(path, file)
        if (uploadError) {
          setError(`Event created, but ${file.name} failed to upload: ${uploadError.message}`)
          continue
        }
        const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
        const { error: imageInsertError } = await supabase.from('gallery_images').insert({ organization_id: organizationId, event_id: newEvent.id, image_url: pub.publicUrl, is_flyer: true })
        if (imageInsertError) setError(`Event created, but saving ${file.name} failed: ${imageInsertError.message}`)
      }
    }

    if (isPaid) {
      const validTiers = tiers.filter((tier) => tier.name.trim() || tier.price || tier.quantity_available || tier.admits_count !== '1')
      for (const tier of validTiers) {
        const { error: tierError } = await supabase.from('ticket_types').insert({
          event_id: newEvent.id,
          name: tier.name.trim(),
          price: Number(tier.price),
          quantity_available: Number(tier.quantity_available),
          admits_count: Math.max(Number(tier.admits_count) || 1, 1),
        })
        if (tierError) setError(`Event created, but ticket tier "${tier.name}" failed to save: ${tierError.message}`)
      }
    }

    setLoading(false)
    setSuccess('Event created')
    setTimeout(() => navigate(`/dashboard/events/${newEvent.id}`), 700)
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="rounded-2xl border border-black/10 bg-surface p-6">
        <h1 className="display text-3xl text-paper">Add a new event</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
            Paid ticketed event
          </label>
          <label className="block text-sm text-muted">
            Publish status
            <select value={status} onChange={(e) => setStatus(e.target.value as EventRow['status'])} className="mt-1 w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <input required placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" rows={3} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Venue name" value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
              className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
            <input placeholder="Venue address" value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })}
              className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
              className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
            <input placeholder="Capacity (optional)" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
          </div>

          {!isPaid ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Registration opens</label>
                <input type="datetime-local" value={form.registration_starts_at} onChange={(e) => setForm({ ...form, registration_starts_at: e.target.value })}
                  className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Registration closes</label>
                <input type="datetime-local" value={form.registration_ends_at} onChange={(e) => setForm({ ...form, registration_ends_at: e.target.value })}
                  className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="display text-xl text-paper">Ticket tiers</h2>
              {tiers.map((tier, index) => (
                <div key={tier.id} className="rounded-xl border border-black/10 bg-ink p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-muted">Tier {index + 1}</p>
                    {index > 0 && <button type="button" onClick={() => setRemovingTier(tier.id)} className="text-sm text-flame hover:underline">Remove</button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input required placeholder="Name (Early Bird)" value={tier.name} onChange={(e) => updateTier(tier.id, 'name', e.target.value)}
                      className="rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
                    <input required type="number" min="0" step="0.01" placeholder="Price (GHS)" value={tier.price} onChange={(e) => updateTier(tier.id, 'price', e.target.value)}
                      className="rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input required type="number" min="1" placeholder="Quantity available" value={tier.quantity_available} onChange={(e) => updateTier(tier.id, 'quantity_available', e.target.value)}
                      className="rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
                    <input required type="number" min="1" placeholder="Admits how many people?" value={tier.admits_count} onChange={(e) => updateTier(tier.id, 'admits_count', e.target.value)}
                      className="rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
                  </div>
                </div>
              ))}
              <button type="button" onClick={addTier} className="rounded-full border border-black/15 px-4 py-2 text-sm text-paper hover:bg-black/5">+ Add another tier</button>
            </div>
          )}

          <div>
            <label className="text-sm text-muted">Event banner</label>
            <BannerPicker onCropped={setBannerFile} disabled={loading} />
          </div>
          <div>
            <label className="text-sm text-muted">Additional event flyer(s)</label>
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)}
              className="mt-1 w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-sm text-paper" />
          </div>

          {error && <p className="text-sm text-flame">{error}</p>}
          {success && <p className="text-sm text-gold">{success}</p>}
          <button disabled={loading} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95 disabled:opacity-60">
            {loading ? 'Creating…' : 'Create event'}
          </button>
        </form>
        <ConfirmDialog
          open={removingTier !== null}
          title="Remove this ticket tier?"
          message="This unsaved ticket tier will be removed from the event form."
          confirmLabel="Remove tier"
          onConfirm={() => {
            if (removingTier) setTiers((current) => current.filter((item) => item.id !== removingTier))
            setRemovingTier(null)
          }}
          onCancel={() => setRemovingTier(null)}
        />
      </div>
    </div>
  )
}

export function DashboardEventPage() {
  return <DashboardEventScreen editing={false} />
}

export function DashboardEventEditPage() {
  return <DashboardEventScreen editing />
}

function DashboardEventScreen({ editing }: { editing: boolean }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pastImages, setPastImages] = useState<GalleryImage[]>([])

  async function loadEvent() {
    if (!id) return
    const { data } = await supabase.from('events').select('*').eq('id', id).is('deleted_at', null).single()
    const loadedEvent = (data as EventRow) ?? null
    setEvent(loadedEvent)
    if (loadedEvent && !editing && isPastEvent(loadedEvent, Date.now())) {
      const { data: imageData } = await supabase.from('gallery_images').select('*').eq('event_id', loadedEvent.id).is('deleted_at', null).order('created_at', { ascending: false })
      setPastImages(((imageData as GalleryImage[]) ?? []).filter((image) => image.image_url !== loadedEvent.banner_image_url))
    }
    setLoading(false)
  }

  useEffect(() => { loadEvent() }, [id])

  async function deleteEvent() {
    if (!event || isPastEvent(event, Date.now())) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', event.id)
      if (error) return
      setDeleteDialogOpen(false)
      navigate('/dashboard/events', { replace: true })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="py-8 text-muted">Loading event…</p>
  if (!event) return <p className="py-8 text-muted">Event not found.</p>

  const isPast = isPastEvent(event, Date.now())

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <DashboardBackButton />
      {editing ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-flame">Edit event</p>
            <h1 className="display mt-1 text-3xl text-paper">{event.title}</h1>
          </div>
          <button onClick={() => navigate(`/dashboard/events/${event.id}`)} className="rounded-full border border-black/15 px-4 py-2 text-sm text-paper hover:bg-black/5">View event</button>
        </div>
      ) : (
        <>
          <div className="mb-6 overflow-hidden rounded-2xl bg-surface">
            {event.banner_image_url ? (
              <img src={event.banner_image_url} alt={`${event.title} flyer`} className="h-64 w-full object-cover sm:h-80" />
            ) : (
              <div className="flex h-64 items-center justify-center bg-surface-light sm:h-80"><span className="display text-6xl text-muted">{event.title[0]}</span></div>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-flame">{event.status}</p>
              <h1 className="display mt-1 text-3xl text-paper">{event.title}</h1>
              <p className="mt-2 text-muted">{formatDate(event.start_datetime)}</p>
              <p className="text-muted">{event.venue_name || 'Venue to be announced'}{event.venue_address ? ` · ${event.venue_address}` : ''}</p>
            </div>
          </div>
        </>
      )}
      {!editing && event.description && <p className="mt-6 max-w-3xl leading-relaxed text-paper/90">{event.description}</p>}
      {!editing && <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface px-4 py-3"><p className="text-xs uppercase tracking-wide text-muted">Event type</p><p className="mt-1 text-paper">{event.is_paid ? 'Paid tickets' : 'Free registration'}</p></div>
        <div className="rounded-lg bg-surface px-4 py-3"><p className="text-xs uppercase tracking-wide text-muted">Capacity</p><p className="mt-1 text-paper">{event.capacity ?? 'Unlimited'}</p></div>
        <div className="rounded-lg bg-surface px-4 py-3"><p className="text-xs uppercase tracking-wide text-muted">Registration</p><p className="mt-1 text-paper">{event.is_paid ? 'Ticket sales' : event.registration_starts_at ? formatDate(event.registration_starts_at) : 'Open schedule'}</p></div>
      </div>}
      {!editing && isPastEvent(event, Date.now()) && <PastEventPhotoGrid images={pastImages} onViewMore={() => navigate(`/dashboard/past-events/${event.id}`)} />}

      <div className="mt-8">
        {editing ? (
          <EditEventPanel event={event} onChange={loadEvent} />
        ) : (
          <EventManager
            event={event}
          />
        )}
      </div>

      {!editing && (
        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-black/10 pt-6">
          <button
            type="button"
            disabled={isPast}
            onClick={() => navigate(`/dashboard/events/${event.id}/edit`)}
            className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium text-paper hover:bg-black/5 disabled:cursor-not-allowed disabled:border-black/10 disabled:text-muted disabled:hover:bg-transparent"
          >
            Edit event details
          </button>
          <button
            type="button"
            disabled={isPast}
            onClick={() => setDeleteDialogOpen(true)}
            className="rounded-full border border-flame/25 bg-flame/10 px-4 py-2 text-sm font-medium text-flame hover:bg-flame hover:text-ink disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/5 disabled:text-muted disabled:hover:bg-black/5"
          >
            Delete event
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete this event?"
        message="The event will move to Trash and be permanently deleted after 30 days."
        confirmLabel="Delete event"
        loading={deleting}
        onConfirm={deleteEvent}
        onCancel={() => { if (!deleting) setDeleteDialogOpen(false) }}
      />
    </div>
  )
}

function UploadStatus({ progress, success }: { progress: { completed: number; total: number } | null; success: string }) {
  if (progress) {
    const percentage = Math.round((progress.completed / progress.total) * 100)
    return (
      <div className="mb-3" role="status">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Uploading {progress.completed} of {progress.total}…</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full bg-flame transition-all" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    )
  }
  return success ? <p className="mb-3 text-sm text-gold">{success}</p> : null
}

function PastEventPhotoGrid({ images, onViewMore }: { images: GalleryImage[]; onViewMore: () => void }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const visibleImages = images.slice(0, 4)

  return (
    <section className="mt-8 border-t border-black/10 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-xl text-paper">Event photos</h2>
        {images.length > 0 && <button type="button" onClick={onViewMore} className="text-sm text-gold hover:underline">View more photos</button>}
      </div>
      {visibleImages.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visibleImages.map((image, index) => (
            <button key={image.id} type="button" onClick={() => setPreviewIndex(index)} className="aspect-square overflow-hidden rounded-lg bg-surface">
              <img src={image.image_url} alt="Event photo" className="h-full w-full object-cover transition hover:scale-105" />
            </button>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-muted">No photos assigned to this event yet.</p>}
      {previewIndex !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5" onClick={() => setPreviewIndex(null)}>
          <div className="flex w-full max-w-5xl items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
            {images.length > 1 && <button type="button" aria-label="Previous photo" onClick={() => setPreviewIndex((current) => current === null ? 0 : (current - 1 + images.length) % images.length)} className="z-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-paper/30 bg-ink text-3xl text-paper shadow-xl hover:bg-surface">‹</button>}
            <img src={images[previewIndex].image_url} alt="Event photo preview" className="max-h-[78vh] max-w-3xl rounded-lg object-contain" />
            {images.length > 1 && <button type="button" aria-label="Next photo" onClick={() => setPreviewIndex((current) => current === null ? 0 : (current + 1) % images.length)} className="z-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-paper/30 bg-ink text-3xl text-paper shadow-xl hover:bg-surface">›</button>}
          </div>
        </div>
      )}
    </section>
  )
}

function waitForUploadPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function BannerPicker({ initialUrl, onCropped, disabled = false }: { initialUrl?: string | null; onCropped: (file: File) => void; disabled?: boolean }) {
  const [source, setSource] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [positionX, setPositionX] = useState(50)
  const [positionY, setPositionY] = useState(50)

  useEffect(() => {
    if (!source) return
    const url = URL.createObjectURL(source)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [source])

  function chooseFile(file: File | undefined) {
    if (!file) return
    setSource(file)
    setEditing(true)
    setZoom(1)
    setPositionX(50)
    setPositionY(50)
  }

  function applyCrop() {
    const cropUrl = source ? URL.createObjectURL(source) : initialUrl
    if (!cropUrl) return
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const width = 1200
      const height = 675
      const scale = Math.max(width / image.width, height / image.height) * zoom
      const drawnWidth = image.width * scale
      const drawnHeight = image.height * scale
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(image, (width - drawnWidth) * positionX / 100, (height - drawnHeight) * positionY / 100, drawnWidth, drawnHeight)
      canvas.toBlob((blob) => {
        if (blob) onCropped(new File([blob], 'event-banner.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    }
    image.src = cropUrl
  }

  useEffect(() => {
    if (editing) applyCrop()
    // The crop output is intentionally refreshed as the user moves each control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, source, zoom, positionX, positionY, initialUrl])

  return (
    <div className="mt-2 rounded-xl border border-black/10 bg-ink p-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-light">
        {previewUrl ? (
          <img src={previewUrl} alt="Banner preview" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom})` }} />
        ) : <p className="flex h-full items-center justify-center text-sm text-muted">Choose an image to preview the banner.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full border border-black/15 px-3 py-1.5 text-sm text-paper hover:bg-black/5">
          Choose image
          <input type="file" accept="image/*" disabled={disabled} onChange={(e) => chooseFile(e.target.files?.[0])} className="sr-only" />
        </label>
        {initialUrl && !source && !editing && <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="rounded-full border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10 disabled:opacity-60">Edit banner</button>}
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
          <label>Zoom<input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" /></label>
          <label>Horizontal position<input type="range" min="0" max="100" value={positionX} onChange={(e) => setPositionX(Number(e.target.value))} className="w-full" /></label>
          <label>Vertical position<input type="range" min="0" max="100" value={positionY} onChange={(e) => setPositionY(Number(e.target.value))} className="w-full" /></label>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  subtext,
  icon,
  onClick,
}: {
  label: string
  value: string
  subtext?: string
  icon?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/10 bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-md active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-flame/30"
    >
      <div className="flex w-full items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 text-muted transition-colors group-hover:bg-flame/10 group-hover:text-flame">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="display text-3xl font-bold tracking-tight text-paper">{value}</p>
        {subtext && (
          <p className="mt-2.5 flex items-center text-xs font-medium text-muted transition-colors group-hover:text-flame">
            <span>{subtext}</span>
            <svg className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </p>
        )}
      </div>
    </button>
  )
}

function Overview({ organizationId, events }: { organizationId: string; events: EventRow[] }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ upcoming: 0, attendees: 0, revenue: 0, members: 0 })
  const [recent, setRecent] = useState<{ label: string; at: string }[]>([])

  useEffect(() => {
    async function load() {
      const eventIds = events.map((e) => e.id)
      const upcoming = events.filter((e) => e.status === 'published' && new Date(e.start_datetime) > new Date()).length

      let attendees = 0
      let revenue = 0
      const activity: { label: string; at: string }[] = []

      if (eventIds.length > 0) {
        const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true }).in('event_id', eventIds)
        const { data: orders } = await supabase.from('orders').select('quantity, total_amount, payment_status, buyer_full_name, created_at').in('event_id', eventIds)
        attendees = (regCount ?? 0) + (orders?.reduce((sum, o) => sum + o.quantity, 0) ?? 0)
        revenue = orders?.filter((o) => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0

        const { data: recentRegs } = await supabase.from('registrations').select('attendee_full_name, created_at').in('event_id', eventIds).order('created_at', { ascending: false }).limit(5)
        recentRegs?.forEach((r) => activity.push({ label: `${r.attendee_full_name} registered`, at: r.created_at }))
        orders?.slice(0, 5).forEach((o) => activity.push({ label: `${o.buyer_full_name} bought a ticket`, at: o.created_at }))
      }

      const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId)

      setStats({ upcoming, attendees, revenue, members: memberCount ?? 0 })
      setRecent(activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5))
    }
    load()
  }, [organizationId, events])

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming events"
          value={String(stats.upcoming)}
          subtext="View schedule"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          onClick={() => navigate('/dashboard/events/upcoming')}
        />
        <StatCard
          label="Attendees"
          value={String(stats.attendees)}
          subtext="View attendee roster"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
          onClick={() => navigate('/dashboard/attendees')}
        />
        <StatCard
          label="Revenue"
          value={formatGHS(stats.revenue)}
          subtext="View earnings & sales"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          onClick={() => navigate('/dashboard/revenue')}
        />
        <StatCard
          label="Members"
          value={String(stats.members)}
          subtext="Manage community"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
          onClick={() => navigate('/dashboard/members')}
        />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="display text-xl text-paper">Recent activity</h3>
          <span className="text-xs font-medium text-muted">Latest registrations & ticket orders</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {recent.map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-black/10 bg-surface px-4 py-3 text-sm text-paper transition hover:border-black/20">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-flame/10 text-flame">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
              <span className="text-xs text-muted">{formatDate(item.at)}</span>
            </div>
          ))}
          {recent.length === 0 && (
            <div className="rounded-xl border border-dashed border-black/15 bg-surface/50 p-8 text-center">
              <p className="text-sm text-muted">No activity recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type UnifiedAttendee = {
  id: string
  name: string
  email: string | null
  phone: string | null
  eventId: string
  eventTitle: string
  eventDate: string
  type: 'paid' | 'rsvp'
  amount?: number
  quantity?: number
  code: string
  status: string
  checkedInAt: string | null
  checkInCount: number
  maxAdmits: number
  createdAt: string
  rawRegistration?: Registration
}

function AttendeesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { events } = useOrganizationEvents(profile?.organization_id ?? null)
  const [attendees, setAttendees] = useState<UnifiedAttendee[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'paid' | 'rsvp' | 'checked_in'>('all')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState('')

  async function loadAttendees() {
    if (!profile?.organization_id) return
    setLoading(true)
    const eventIds = events.map((e) => e.id)
    if (eventIds.length === 0) {
      setAttendees([])
      setLoading(false)
      return
    }

    const eventMap = new Map(events.map((e) => [e.id, e]))

    const [{ data: regs }, { data: orders }] = await Promise.all([
      supabase.from('registrations').select('*').in('event_id', eventIds).order('created_at', { ascending: false }),
      supabase.from('orders').select('*, tickets(*)').in('event_id', eventIds).order('created_at', { ascending: false }),
    ])

    const list: UnifiedAttendee[] = []

    ;((regs as Registration[]) ?? []).forEach((r) => {
      const ev = eventMap.get(r.event_id)
      list.push({
        id: `reg-${r.id}`,
        name: r.attendee_full_name,
        email: r.attendee_email,
        phone: r.attendee_phone,
        eventId: r.event_id,
        eventTitle: ev?.title ?? 'Event',
        eventDate: ev?.start_datetime ?? '',
        type: 'rsvp',
        code: r.registration_code,
        status: r.status,
        checkedInAt: r.checked_in_at,
        checkInCount: r.checked_in_at ? 1 : 0,
        maxAdmits: 1,
        createdAt: r.created_at,
        rawRegistration: r,
      })
    })

    ;((orders as (Order & { tickets: Ticket[] })[]) ?? []).forEach((o) => {
      const ev = eventMap.get(o.event_id)
      o.tickets.forEach((ticket) => list.push({
          id: `ticket-${ticket.id}`,
          name: o.buyer_full_name,
          email: o.buyer_email,
          phone: o.buyer_phone,
          eventId: o.event_id,
          eventTitle: ev?.title ?? 'Event',
          eventDate: ev?.start_datetime ?? '',
          type: 'paid',
          amount: Number(o.total_amount) / Math.max(o.quantity, 1),
          quantity: 1,
          code: ticket.ticket_code,
          status: o.payment_status === 'paid' ? 'confirmed' : o.payment_status,
          checkedInAt: null,
          checkInCount: ticket.check_in_count ?? 0,
          maxAdmits: ticket.max_admits ?? 1,
          createdAt: o.created_at,
        }))
    })

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setAttendees(list)
    setLoading(false)
  }

  useEffect(() => {
    loadAttendees()
  }, [profile?.organization_id, events])

  async function confirmRegistration(reg: Registration) {
    const { error } = await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', reg.id)
    if (error) return
    sendConfirmationEmail('registration', reg.id)
    setActionSuccess(`${reg.attendee_full_name} confirmed`)
    setTimeout(() => setActionSuccess(''), 2500)
    await loadAttendees()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const filtered = attendees.filter((a) => {
    if (selectedEventId !== 'all' && a.eventId !== selectedEventId) return false
    if (filterType === 'paid' && a.type !== 'paid') return false
    if (filterType === 'rsvp' && a.type !== 'rsvp') return false
    if (filterType === 'checked_in' && a.checkInCount === 0) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = a.name?.toLowerCase().includes(q)
      const matchEmail = a.email?.toLowerCase().includes(q)
      const matchPhone = a.phone?.toLowerCase().includes(q)
      const matchCode = a.code?.toLowerCase().includes(q)
      const matchEvent = a.eventTitle?.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchPhone && !matchCode && !matchEvent) return false
    }
    return true
  })

  function exportCsv() {
    const headers = ['Name', 'Email', 'Phone', 'Event', 'Date', 'Type', 'Amount', 'Ticket/RSVP Code', 'Status', 'Admissions', 'Checked In At', 'Registered At']
    const rows = filtered.map((a) => [
      `"${a.name || ''}"`,
      `"${a.email || ''}"`,
      `"${a.phone || ''}"`,
      `"${a.eventTitle || ''}"`,
      a.eventDate ? new Date(a.eventDate).toLocaleDateString() : '',
      a.type === 'paid' ? 'Paid Ticket' : 'Free RSVP',
      a.amount !== undefined ? formatGHS(a.amount) : 'Free',
      a.code,
      a.status,
      `${a.checkInCount}/${a.maxAdmits}`,
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : 'No',
      new Date(a.createdAt).toLocaleString(),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `attendees-roster-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const totalCount = attendees.reduce((sum, a) => sum + (a.quantity ?? 1), 0)
  const checkedInCount = attendees.reduce((sum, attendee) => sum + attendee.checkInCount, 0)
  const paidCount = attendees.filter((a) => a.type === 'paid').length
  const rsvpCount = attendees.filter((a) => a.type === 'rsvp').length

  return (
    <div>
      <DashboardBackButton />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-2xl text-paper">Attendees Roster</h2>
          <p className="mt-1 text-sm text-muted">Complete overview of registered guests and ticket holders across your events.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-surface px-4 py-2 text-sm font-medium text-paper transition hover:border-black/30 hover:bg-black/5"
        >
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span>Export CSV</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700">
          ✓ {actionSuccess}
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Attendees</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Checked In</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{checkedInCount}</p>
          <p className="mt-0.5 text-xs text-muted">{totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0}% attendance rate</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Paid Ticket Holders</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{paidCount}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Free RSVPs</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{rsvpCount}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <svg className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-black/15 bg-ink py-2 pr-3 pl-9 text-xs text-paper placeholder:text-muted focus:border-flame focus:outline-none focus:ring-1 focus:ring-flame"
            />
          </div>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="rounded-xl border border-black/15 bg-ink px-3 py-2 text-xs text-paper focus:border-flame focus:outline-none"
          >
            <option value="all">All Events ({events.length})</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-black/10 bg-surface p-1">
          {(['all', 'paid', 'rsvp', 'checked_in'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === tab ? 'bg-ink text-paper shadow-xs' : 'text-muted hover:text-paper'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'paid' ? 'Paid Tickets' : tab === 'rsvp' ? 'Free RSVP' : 'Checked In'}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-surface shadow-xs">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading attendees…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-paper">No attendees match your criteria</p>
            <p className="mt-1 text-xs text-muted">Try clearing filters or search queries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-black/10 bg-black/[0.02] text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Guest</th>
                  <th className="py-3 px-4 font-semibold">Event</th>
                  <th className="py-3 px-4 font-semibold">Type / Price</th>
                  <th className="py-3 px-4 font-semibold">Ticket Code</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Check-In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-black/[0.02]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-paper">{a.name}</div>
                      <div className="text-muted">{a.email || '—'}</div>
                      {a.phone && <div className="text-[11px] text-muted">{a.phone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <button type="button" onClick={() => navigate(`/dashboard/events/${a.eventId}?tab=attendees`)} className="text-left font-medium text-paper line-clamp-1 hover:text-flame hover:underline">{a.eventTitle}</button>
                      {a.eventDate && <div className="text-muted">{formatDate(a.eventDate)}</div>}
                    </td>
                    <td className="py-3 px-4">
                      {a.type === 'paid' ? (
                        <div>
                          <span className="inline-block rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700">
                            {formatGHS(a.amount || 0)}
                          </span>
                          {a.quantity && a.quantity > 1 && (
                            <span className="ml-1 text-[11px] text-muted">({a.quantity} tickets)</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block rounded-md bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-700">
                          Free RSVP
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <code className="rounded-md bg-black/5 px-2 py-1 font-mono text-[11px] text-paper">
                          {a.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(a.code)}
                          title="Copy ticket code"
                          className="rounded p-1 text-muted hover:bg-black/5 hover:text-paper"
                        >
                          {copiedCode === a.code ? (
                            <span className="text-[11px] font-semibold text-emerald-600">✓</span>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          a.status === 'confirmed' || a.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-700'
                            : 'bg-amber-500/10 text-amber-700'
                        }`}>
                          {a.status}
                        </span>
                        {a.status === 'pending' && a.rawRegistration && (
                          <button
                            type="button"
                            onClick={() => confirmRegistration(a.rawRegistration!)}
                            className="rounded-full border border-flame/30 px-2 py-0.5 text-[10px] font-semibold text-flame hover:bg-flame/10"
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {a.type === 'paid' ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.checkInCount >= a.maxAdmits ? 'bg-emerald-500/10 text-emerald-700' : a.checkInCount > 0 ? 'bg-gold/10 text-gold' : 'text-muted'}`}>
                          {a.checkInCount}/{a.maxAdmits} admitted
                        </span>
                      ) : a.checkedInAt ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" title={`Checked in: ${formatDate(a.checkedInAt)}`}>
                          <span>✓ In</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function RevenuePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { events } = useOrganizationEvents(profile?.organization_id ?? null)
  const [orders, setOrders] = useState<(Order & { tickets: Ticket[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function loadRevenue() {
    if (!profile?.organization_id) return
    setLoading(true)
    const eventIds = events.map((e) => e.id)
    if (eventIds.length === 0) {
      setOrders([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('orders')
      .select('*, tickets(*)')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false })

    setOrders((data as (Order & { tickets: Ticket[] })[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadRevenue()
  }, [profile?.organization_id, events])

  const eventMap = new Map(events.map((e) => [e.id, e]))

  const paidOrders = orders.filter((o) => o.payment_status === 'paid')
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
  const totalTickets = paidOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0

  const eventBreakdown = events.map((ev) => {
    const evOrders = paidOrders.filter((o) => o.event_id === ev.id)
    const evRevenue = evOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
    const evTickets = evOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)
    return {
      event: ev,
      revenue: evRevenue,
      tickets: evTickets,
      ordersCount: evOrders.length,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  const filteredOrders = orders.filter((o) => {
    if (selectedEventId !== 'all' && o.event_id !== selectedEventId) return false
    if (statusFilter !== 'all' && o.payment_status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const ev = eventMap.get(o.event_id)
      const matchName = o.buyer_full_name?.toLowerCase().includes(q)
      const matchEmail = o.buyer_email?.toLowerCase().includes(q)
      const matchPhone = o.buyer_phone?.toLowerCase().includes(q)
      const matchCode = o.tickets.some((ticket) => ticket.ticket_code.toLowerCase().includes(q))
      const matchEvent = ev?.title.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchPhone && !matchCode && !matchEvent) return false
    }
    return true
  })

  function exportCsv() {
    const headers = ['Order ID', 'Buyer Name', 'Buyer Email', 'Buyer Phone', 'Event', 'Quantity', 'Amount', 'Payment Status', 'Ticket Code', 'Date']
    const rows = filteredOrders.map((o) => {
      const ev = eventMap.get(o.event_id)
      return [
        o.id,
        `"${o.buyer_full_name || ''}"`,
        `"${o.buyer_email || ''}"`,
        `"${o.buyer_phone || ''}"`,
        `"${ev?.title || ''}"`,
        o.quantity,
        formatGHS(o.total_amount),
        o.payment_status,
        o.tickets.map((ticket) => ticket.ticket_code).join('; '),
        new Date(o.created_at).toLocaleString(),
      ]
    })
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `revenue-orders-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div>
      <DashboardBackButton />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-2xl text-paper">Revenue & Financials</h2>
          <p className="mt-1 text-sm text-muted">Track ticket transactions, gross earnings, and event sales performance.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 bg-surface px-4 py-2 text-sm font-medium text-paper transition hover:border-black/30 hover:bg-black/5"
        >
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span>Export Orders CSV</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Gross Revenue</p>
          <p className="display mt-1 text-2xl font-bold text-flame">{formatGHS(totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tickets Sold</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{totalTickets}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Paid Orders</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{paidOrders.length}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Avg. Order Value</p>
          <p className="display mt-1 text-2xl font-bold text-paper">{formatGHS(avgOrderValue)}</p>
        </div>
      </div>

      {/* Breakdown by Event */}
      <div className="mt-8">
        <h3 className="display text-lg text-paper">Sales by Event</h3>
        <p className="mt-1 text-xs text-muted">Click an event to view its transactions, attendee roster, and verify tickets.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eventBreakdown.map(({ event: ev, revenue, tickets, ordersCount }) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => navigate(`/dashboard/events/${ev.id}?tab=attendees`)}
              className="group cursor-pointer rounded-2xl border border-black/10 bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:shadow-md active:translate-y-0"
            >
              <div className="flex items-start justify-between">
                <h4 className="display text-base font-semibold text-paper line-clamp-1 group-hover:text-flame">{ev.title}</h4>
                <span className="rounded-md bg-flame/10 px-2.5 py-0.5 text-xs font-bold text-flame">{formatGHS(revenue)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{formatDate(ev.start_datetime)}</p>
              <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3 text-xs text-muted">
                <span>{tickets} tickets sold · {ordersCount} orders</span>
                <span className="flex items-center font-semibold text-flame group-hover:underline">
                  <span>View orders</span>
                  <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            </button>
          ))}
          {eventBreakdown.length === 0 && (
            <p className="text-xs text-muted">No paid events created yet.</p>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="display text-lg text-paper">Recent Transactions</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search buyer, email, ticket code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-black/15 bg-ink py-1.5 px-3 text-xs text-paper placeholder:text-muted focus:border-flame focus:outline-none"
            />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="rounded-xl border border-black/15 bg-ink px-3 py-1.5 text-xs text-paper focus:border-flame focus:outline-none"
            >
              <option value="all">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-black/15 bg-ink px-3 py-1.5 text-xs text-paper focus:border-flame focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-surface shadow-xs">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted">Loading transactions…</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-paper">No transactions found</p>
              <p className="mt-1 text-xs text-muted">Transactions from ticket sales will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/10 bg-black/[0.02] text-muted uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Buyer</th>
                    <th className="py-3 px-4 font-semibold">Event</th>
                    <th className="py-3 px-4 font-semibold">Qty</th>
                    <th className="py-3 px-4 font-semibold">Amount</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Ticket Code</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredOrders.map((o) => {
                    const ev = eventMap.get(o.event_id)
                    return (
                      <tr key={o.id} className="transition-colors hover:bg-black/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-paper">{o.buyer_full_name}</div>
                          <div className="text-muted">{o.buyer_email || '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-paper line-clamp-1">{ev?.title ?? 'Event'}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-paper">{o.quantity}</td>
                        <td className="py-3 px-4 font-semibold text-paper">{formatGHS(o.total_amount)}</td>
                        <td className="py-3 px-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            o.payment_status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-amber-500/10 text-amber-700'
                          }`}>
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <code className="rounded-md bg-black/5 px-2 py-1 font-mono text-[11px] text-paper">
                              {o.tickets.map((ticket) => ticket.ticket_code).join(', ')}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyCode(o.tickets[0]?.ticket_code ?? '')}
                              title="Copy ticket code"
                              className="rounded p-1 text-muted hover:bg-black/5 hover:text-paper"
                            >
                              {copiedCode === o.tickets[0]?.ticket_code ? (
                                <span className="text-[11px] font-semibold text-emerald-600">✓</span>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted">{formatDate(o.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventManager({
  event,
}: {
  event: EventRow
}) {
  const navigate = useNavigate()

  return (
    <div className="mt-6 border-t border-black/10 pt-6">
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <TabButton active={false} onClick={() => navigate(`/dashboard/events/${event.id}/edit`)}>
          Edit details
        </TabButton>
        <TabButton active onClick={() => undefined}>
          {event.is_paid ? 'Orders & Sales' : 'Attendees'}
        </TabButton>
      </div>
      <AttendeesPanel event={event} />
    </div>
  )
}

function TabButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-full px-3 py-1 ${active ? 'bg-gold text-ink' : 'border border-black/15 text-muted hover:text-paper'} disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/5 disabled:text-muted`}>
      {children}
    </button>
  )
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function EditEventPanel({ event, onChange }: { event: EventRow; onChange: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: event.title, description: event.description ?? '', venue_name: event.venue_name ?? '',
    venue_address: event.venue_address ?? '', start_datetime: toLocalInput(event.start_datetime),
    capacity: event.capacity ? String(event.capacity) : '',
    is_paid: event.is_paid,
    status: event.status,
    registration_starts_at: event.registration_starts_at ? toLocalInput(event.registration_starts_at) : '',
    registration_ends_at: event.registration_ends_at ? toLocalInput(event.registration_ends_at) : '',
  })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pendingPaidChange, setPendingPaidChange] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  useEffect(() => {
    setForm({
      title: event.title,
      description: event.description ?? '',
      venue_name: event.venue_name ?? '',
      venue_address: event.venue_address ?? '',
      start_datetime: toLocalInput(event.start_datetime),
      capacity: event.capacity ? String(event.capacity) : '',
      is_paid: event.is_paid,
      status: event.status,
      registration_starts_at: event.registration_starts_at ? toLocalInput(event.registration_starts_at) : '',
      registration_ends_at: event.registration_ends_at ? toLocalInput(event.registration_ends_at) : '',
    })
  }, [event])

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      let bannerUrl = event.banner_image_url
      if (bannerFile) {
        const path = `${event.organization_id}/${event.id}/banner-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage.from('gallery').upload(path, bannerFile)
        if (uploadError) {
          setSaveError(uploadError.message)
          return
        }
        const { data: publicUrl } = supabase.storage.from('gallery').getPublicUrl(path)
        bannerUrl = publicUrl.publicUrl
      }
      const { data: savedEvent, error } = await supabase.from('events').update({
      title: form.title, description: form.description, venue_name: form.venue_name,
      venue_address: form.venue_address, start_datetime: form.start_datetime,
      capacity: form.capacity ? Number(form.capacity) : null,
      is_paid: form.is_paid,
      status: form.status,
      registration_starts_at: !form.is_paid ? (form.registration_starts_at || null) : null,
      registration_ends_at: !form.is_paid ? (form.registration_ends_at || null) : null,
      banner_image_url: bannerUrl,
    }).eq('id', event.id).select('*').single()
      if (error || !savedEvent) {
        setSaveError(error?.message ?? 'Could not save event details.')
        return
      }
      setForm((current) => ({
      ...current,
      is_paid: savedEvent.is_paid,
      registration_starts_at: savedEvent.registration_starts_at ? toLocalInput(savedEvent.registration_starts_at) : '',
      registration_ends_at: savedEvent.registration_ends_at ? toLocalInput(savedEvent.registration_ends_at) : '',
      }))
      setBannerFile(null)
      await onChange()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSave} className="space-y-3">
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" rows={2} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
            className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" placeholder="Venue name" />
          <input value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })}
            className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" placeholder="Venue address" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input required type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
            className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
          <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" placeholder="Capacity" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={form.is_paid}
            onChange={(e) => {
              const nextValue = e.target.checked
              if (nextValue !== event.is_paid) setPendingPaidChange(nextValue)
              else setForm({ ...form, is_paid: nextValue })
            }}
          />
          Paid ticketed event
        </label>
        <label className="block text-sm text-muted">
          Publish status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventRow['status'] })} className="mt-1 w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {!form.is_paid && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Registration opens</label>
              <input type="datetime-local" value={form.registration_starts_at} onChange={(e) => setForm({ ...form, registration_starts_at: e.target.value })}
                className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Registration closes</label>
              <input type="datetime-local" value={form.registration_ends_at} onChange={(e) => setForm({ ...form, registration_ends_at: e.target.value })}
                className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
            </div>
          </div>
        )}
      </form>

      {form.is_paid && (
        <div className="border-t border-black/10 pt-5">
          <h2 className="display mb-3 text-xl text-paper">Ticket types</h2>
          <TicketTypesPanel event={event} onChange={onChange} />
        </div>
      )}

      <div className="border-t border-black/10 pt-5">
        <h2 className="display mb-3 text-xl text-paper">Flyers</h2>
          <FlyersPanel event={event} onBannerChange={setBannerFile} />
      </div>

      <div className="border-t border-black/10 pt-5">
        <div className="flex items-center gap-3">
          {saveError && <span className="text-sm text-flame">{saveError}</span>}
          <button type="button" disabled={saving} onClick={() => handleSave()} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95 disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingPaidChange !== null}
        title={`Switch to ${pendingPaidChange ? 'ticketed' : 'free'} event?`}
        message="Switching payment mode won't remove or convert existing registrations, tickets, or orders already made for this event. Continue?"
        confirmLabel="Continue"
        confirmClassName="bg-gold text-ink"
        onConfirm={() => {
          if (pendingPaidChange !== null) setForm({ ...form, is_paid: pendingPaidChange })
          setPendingPaidChange(null)
        }}
        onCancel={() => setPendingPaidChange(null)}
      />
      <ConfirmDialog
        open={saved}
        title="Changes saved"
        message="Your event details have been updated."
        confirmLabel="OK"
        confirmClassName="bg-gold text-ink"
        onConfirm={() => setSaved(false)}
        onCancel={() => setSaved(false)}
      />
    </div>
  )
}

function TicketTypesPanel({ event, onChange }: { event: EventRow; onChange: () => void }) {
  const [types, setTypes] = useState<TicketType[]>([])
  const [form, setForm] = useState({ name: '', price: '', quantity_available: '', admits_count: '1' })
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('ticket_types').select('*').eq('event_id', event.id)
    setTypes((data as TicketType[]) ?? [])
  }
  useEffect(() => { load() }, [event.id])

  function startEditingPrice(ticket: TicketType) {
    setEditingPriceId(ticket.id)
    setEditingPrice(String(ticket.price))
    setError('')
  }

  async function savePrice(ticketId: string) {
    const price = Number(editingPrice)
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price amount.')
      return
    }
    setSavingPrice(true)
    setError('')
    try {
      const { error } = await supabase.from('ticket_types').update({ price }).eq('id', ticketId).eq('event_id', event.id)
      if (error) {
        setError(error.message)
        return
      }
      setEditingPriceId(null)
      await load()
      await onChange()
    } finally {
      setSavingPrice(false)
    }
  }

  async function deleteType() {
    if (!deletingTypeId) return
    setDeleting(true)
    setError('')
    try {
      const { error } = await supabase.from('ticket_types').delete().eq('id', deletingTypeId).eq('event_id', event.id)
      if (error) {
        setError(error.message)
        return
      }
      setDeletingTypeId(null)
      await load()
      await onChange()
    } finally {
      setDeleting(false)
    }
  }

  async function addType(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      const { error } = await supabase.from('ticket_types').insert({
      event_id: event.id, name: form.name,
      price: Number(form.price), quantity_available: Number(form.quantity_available), admits_count: Math.max(Number(form.admits_count) || 1, 1),
    })
      if (error) {
        setError(error.message)
        return
      }
      setForm({ name: '', price: '', quantity_available: '', admits_count: '1' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
      await onChange()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <div className="mb-4 space-y-2">
        {types.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink px-3 py-2 text-sm">
            <span className="text-paper">{t.name}</span>
            <div className="flex items-center gap-2 text-muted">
              {editingPriceId === t.id ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingPrice}
                    onChange={(e) => setEditingPrice(e.target.value)}
                    className="w-28 rounded-md border border-black/15 bg-surface px-2 py-1 text-paper"
                    aria-label={`Price for ${t.name}`}
                  />
                  <button type="button" disabled={savingPrice} onClick={() => savePrice(t.id)} className="rounded-md bg-gold px-2 py-1 text-xs font-medium text-ink disabled:opacity-60">{savingPrice ? 'Saving…' : 'Save'}</button>
                  <button type="button" disabled={savingPrice} onClick={() => setEditingPriceId(null)} className="text-xs text-muted hover:text-paper">Cancel</button>
                </>
              ) : (
                <>
                  <span>{formatGHS(t.price)} · admits {t.admits_count ?? 1} · {t.quantity_sold}/{t.quantity_available} sold</span>
                  <button type="button" onClick={() => startEditingPrice(t)} className="rounded-md border border-black/15 px-2 py-1 text-xs text-paper hover:bg-black/5">Edit price</button>
                  <button type="button" onClick={() => setDeletingTypeId(t.id)} className="rounded-md border border-flame/30 px-2 py-1 text-xs text-flame hover:bg-flame/10">Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
        {types.length === 0 && <p className="text-sm text-muted">No ticket types yet — add one below.</p>}
      </div>
      <form onSubmit={addType} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <input required placeholder="Name (e.g. Regular)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-black/15 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted" />
          <input required type="number" placeholder="Price (GHS)" value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-32 rounded-lg border border-black/15 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted" />
          <input required type="number" placeholder="Quantity" value={form.quantity_available}
            onChange={(e) => setForm({ ...form, quantity_available: e.target.value })}
            className="w-28 rounded-lg border border-black/15 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted" />
          <input required type="number" min="1" placeholder="Admits how many people?" value={form.admits_count}
            onChange={(e) => setForm({ ...form, admits_count: e.target.value })}
            className="w-44 rounded-lg border border-black/15 bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted" />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={adding} className="rounded-lg bg-gold px-4 py-1.5 text-sm font-medium text-ink disabled:opacity-60">{adding ? 'Adding…' : 'Add'}</button>
          {saved && <span className="text-sm text-gold">Saved</span>}
        </div>
        {error && <p className="text-sm text-flame">Could not add ticket type: {error}</p>}
      </form>
      <ConfirmDialog
        open={deletingTypeId !== null}
        title="Delete this ticket type?"
        message="This will remove the tier from future ticket sales. Existing orders may prevent deletion if tickets already use this type."
        confirmLabel="Delete ticket type"
        confirmClassName="bg-flame text-ink hover:brightness-90"
        loading={deleting}
        onConfirm={deleteType}
        onCancel={() => { if (!deleting) setDeletingTypeId(null) }}
      />
    </div>
  )
}

function FlyersPanel({ event, onBannerChange }: { event: EventRow; onBannerChange: (file: File) => void }) {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const flyerInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    let query = supabase.from('gallery_images').select('*').eq('event_id', event.id).is('deleted_at', null).order('created_at', { ascending: false })
    if (event.banner_image_url) query = query.neq('image_url', event.banner_image_url)
    const { data } = await query
    setImages((data as GalleryImage[]) ?? [])
  }
  useEffect(() => { load() }, [event.id])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const selectedFiles = Array.from(files)
    setUploadProgress({ completed: 0, total: selectedFiles.length })
    setUploadSuccess('')
    if (images.length > 0) {
      await supabase.from('gallery_images').update({ deleted_at: new Date().toISOString() }).in('id', images.map((image) => image.id))
    }
    let uploaded = 0
    let completed = 0
    for (const file of selectedFiles) {
      const path = `${event.organization_id}/${event.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('gallery').upload(path, file)
      if (!error) {
        const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
        await supabase.from('gallery_images').insert({ organization_id: event.organization_id, event_id: event.id, image_url: pub.publicUrl, is_flyer: true })
        uploaded += 1
      }
      completed += 1
      setUploadProgress({ completed, total: selectedFiles.length })
      await waitForUploadPaint()
    }
    setUploadProgress(null)
    setUploadSuccess(`${uploaded} ${uploaded === 1 ? 'photo' : 'photos'} uploaded`)
    setTimeout(() => setUploadSuccess(''), 2500)
    load()
  }

  async function deleteImage(img: GalleryImage) {
    setDeleting(true)
    try {
      const path = img.image_url.split('/gallery/')[1]
      if (path) await supabase.storage.from('gallery').remove([path])
      await supabase.from('gallery_images').update({ deleted_at: new Date().toISOString() }).eq('id', img.id)
      await load()
      setConfirmingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm text-muted">Event banner</p>
        <BannerPicker initialUrl={event.banner_image_url} onCropped={onBannerChange} disabled={uploadProgress !== null} />
      </div>
      <input ref={flyerInputRef} type="file" accept="image/*" multiple disabled={uploadProgress !== null} onChange={(e) => handleUpload(e.target.files)} className="sr-only" />
      <UploadStatus progress={uploadProgress} success={uploadSuccess} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <div key={img.id} className="overflow-hidden rounded-xl border border-black/10 bg-surface">
            <div className="group relative aspect-[4/3] overflow-hidden bg-surface-light">
              <img src={img.image_url} alt="" className="h-full w-full object-cover" />
              <div className={`absolute inset-0 flex items-end justify-end gap-2 bg-black/35 p-3 transition ${confirmingDelete === img.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button type="button" disabled={uploadProgress !== null} onClick={() => flyerInputRef.current?.click()} className="rounded-full bg-gold px-4 py-1.5 text-sm font-medium text-ink hover:brightness-95 disabled:opacity-60">New Flyer</button>
                <button onClick={() => setConfirmingDelete(img.id)} className="rounded-full bg-flame px-4 py-1.5 text-sm text-ink hover:brightness-95">Delete</button>
              </div>
            </div>
            <p className="p-3 text-sm text-muted">Flyer</p>
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-full">
            <button type="button" onClick={() => flyerInputRef.current?.click()} className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-ink hover:brightness-95">New Flyer</button>
            <p className="mt-3 text-sm text-muted">No flyers yet.</p>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmingDelete !== null}
        title="Delete this flyer?"
        message="This can't be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={async () => {
          const image = images.find((item) => item.id === confirmingDelete)
          if (image) await deleteImage(image)
        }}
        onCancel={() => { if (!deleting) setConfirmingDelete(null) }}
      />
    </div>
  )
}

function AttendeesPanel({ event }: { event: EventRow }) {
  const [regs, setRegs] = useState<Registration[]>([])
  const [orders, setOrders] = useState<(Order & { tickets: Ticket[] })[]>([])
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function load() {
      if (event.is_paid) {
        const { data } = await supabase.from('orders').select('*, tickets(*)').eq('event_id', event.id).order('created_at', { ascending: false })
        setOrders((data as (Order & { tickets: Ticket[] })[]) ?? [])
      } else {
        const { data } = await supabase.from('registrations').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
        setRegs((data as Registration[]) ?? [])
      }
    }
    load()
  }, [event])

  async function confirmRegistration(registration: Registration) {
    const { error } = await supabase.from('registrations').update({ status: 'confirmed' }).eq('id', registration.id)
    if (error) return
    sendConfirmationEmail('registration', registration.id)
    const { data } = await supabase.from('registrations').select('*').eq('event_id', event.id).order('created_at', { ascending: false })
    setRegs((data as Registration[]) ?? [])
    setSuccess(`${registration.attendee_full_name} confirmed`)
    setTimeout(() => setSuccess(''), 2500)
  }

  function exportCsv() {
    const rows = event.is_paid
      ? orders.flatMap((o) => o.tickets.map((ticket) => [o.buyer_full_name, o.buyer_email, o.buyer_phone, 1, Number(o.total_amount) / Math.max(o.quantity, 1), o.payment_status, ticket.ticket_code, `${ticket.check_in_count ?? 0}/${ticket.max_admits ?? 1}`]))
      : regs.map((r) => [r.attendee_full_name, r.attendee_email, r.attendee_phone, r.registration_code])
    const header = event.is_paid
      ? ['Name', 'Email', 'Phone', 'Qty', 'Amount', 'Status', 'Code', 'Checked in']
      : ['Name', 'Email', 'Phone', 'Code']
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${event.slug}-attendees.csv`
    link.click()
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={exportCsv} className="text-sm text-gold hover:underline">Export CSV</button>
      </div>
      {success && <p className="mb-3 text-sm text-gold">{success}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1.5 pr-4">Name</th>
              <th className="py-1.5 pr-4">Contact</th>
              {event.is_paid && <th className="py-1.5 pr-4">Amount</th>}
              <th className="py-1.5 pr-4">Code</th>
              {!event.is_paid && <th className="py-1.5 pr-4">Status</th>}
              <th className="py-1.5">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {event.is_paid
              ? orders.flatMap((o) => o.tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-black/5 text-paper">
                  <td className="py-1.5 pr-4">{o.buyer_full_name}</td>
                  <td className="py-1.5 pr-4 text-muted">{o.buyer_email}</td>
                  <td className="py-1.5 pr-4">{formatGHS(Number(o.total_amount) / Math.max(o.quantity, 1))} · {o.payment_status}</td>
                  <td className="py-1.5 pr-4">{ticket.ticket_code}</td>
                  <td className="py-1.5">{ticket.check_in_count ?? 0}/{ticket.max_admits ?? 1}</td>
                </tr>
              )))
              : regs.map((r) => (
                <tr key={r.id} className="border-t border-black/5 text-paper">
                  <td className="py-1.5 pr-4">{r.attendee_full_name}</td>
                  <td className="py-1.5 pr-4 text-muted">{r.attendee_email}</td>
                  <td className="py-1.5 pr-4">{r.registration_code}</td>
                  <td className="py-1.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'confirmed' ? 'bg-gold/10 text-gold' : 'bg-flame/10 text-flame'}`}>{r.status}</span>
                      {r.status === 'pending' && <button onClick={() => confirmRegistration(r)} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold hover:bg-gold/10">Confirm</button>}
                    </div>
                  </td>
                  <td className="py-1.5">{r.checked_in_at ? '✓' : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {(event.is_paid ? orders.flatMap((order) => order.tickets).length : regs.length) === 0 && <p className="py-4 text-sm text-muted">No one yet.</p>}
      </div>
    </div>
  )
}

function CheckInPanel({ event }: { event: EventRow }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [pendingCheckIn, setPendingCheckIn] = useState<{
    table: 'tickets' | 'registrations'
    id: string
    name: string
    phone: string | null
    maxAdmits: number
    checkInCount: number
    label: string
  } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [scannerError, setScannerError] = useState('')

  async function processCode(rawCode: string) {
    setCheckingIn(true)
    try {
      setResult(null)
      setPendingCheckIn(null)
      const normalizedCode = rawCode.trim().toUpperCase()
      const { data: row } = event.is_paid
        ? await supabase.from('tickets').select('*, orders!inner(buyer_full_name, buyer_phone, event_id, ticket_types(name))').eq('ticket_code', normalizedCode).eq('orders.event_id', event.id).maybeSingle()
        : await supabase.from('registrations').select('*').eq('event_id', event.id).eq('registration_code', normalizedCode).eq('status', 'confirmed').maybeSingle()

      if (!row) {
        if (!event.is_paid) {
          const { data: pending } = await supabase.from('registrations').select('id').eq('event_id', event.id).eq('registration_code', normalizedCode).eq('status', 'pending').maybeSingle()
          if (pending) { setResult({ ok: false, message: "This registration hasn't been confirmed yet." }); return }
        }
        setResult({ ok: false, message: 'Code not found for this event.' }); return
      }
      if (event.is_paid) {
        const maxAdmits = Math.max(row.max_admits || 1, 1)
        const checkInCount = row.check_in_count || 0
        const label = row.orders.ticket_types?.name ? `${row.orders.ticket_types.name} Ticket` : 'Ticket'
        if (checkInCount >= maxAdmits) {
          setResult({ ok: false, message: maxAdmits === 1 ? `Already checked in.` : `This ticket has already been fully used (${checkInCount}/${maxAdmits} admitted).` })
          return
        }
        const name = row.orders.buyer_full_name
        const phone = row.orders.buyer_phone
        setPendingCheckIn({ table: 'tickets', id: row.id, name, phone, maxAdmits, checkInCount, label })
        setResult({ ok: true, message: `${label} (${checkInCount}/${maxAdmits} admitted) · Name: ${name}${phone ? ` · Phone: ${phone}` : ''} · ${event.title}` })
        return
      }

      if (row.checked_in_at) { setResult({ ok: false, message: `Already checked in at ${new Date(row.checked_in_at).toLocaleTimeString()}.` }); return }
      const name = row.attendee_full_name
      const phone = row.attendee_phone
      setPendingCheckIn({ table: 'registrations', id: row.id, name, phone, maxAdmits: 1, checkInCount: 0, label: 'Registration' })
      setResult({ ok: true, message: `Name: ${name}${phone ? ` · Phone: ${phone}` : ''} · ${event.title}` })
    } finally {
      setCheckingIn(false)
    }
  }

  async function confirmCheckIn() {
    if (!pendingCheckIn) return
    setCheckingIn(true)
    if (pendingCheckIn.table === 'tickets') {
      const nextCount = pendingCheckIn.checkInCount + 1
      const { error } = await supabase.from('tickets').update({ check_in_count: nextCount }).eq('id', pendingCheckIn.id).lt('check_in_count', pendingCheckIn.maxAdmits)
      setCheckingIn(false)
      if (error) {
        setResult({ ok: false, message: `Could not complete check-in: ${error.message}` })
        return
      }
      setPendingCheckIn((current) => current ? { ...current, checkInCount: nextCount } : current)
      setResult({ ok: true, message: `${pendingCheckIn.label} (${nextCount}/${pendingCheckIn.maxAdmits} admitted) · Checked in: ${pendingCheckIn.name}` })
      setCode('')
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
      return
    }

    const { error } = await supabase.from('registrations').update({ checked_in_at: new Date().toISOString() }).eq('id', pendingCheckIn.id)
    setCheckingIn(false)
    if (error) {
      setResult({ ok: false, message: `Could not complete check-in: ${error.message}` })
      return
    }
    setResult({ ok: true, message: `Checked in: ${pendingCheckIn.name}` })
    setPendingCheckIn(null)
    setCode('')
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })
  }

  async function checkIn(e: React.FormEvent) {
    e.preventDefault()
    await processCode(code)
  }

  useEffect(() => {
    if (!scanning) return
    const scanner = new Html5Qrcode('qr-reader')
    let stopped = false
    let disposed = false
    let started = false
    let stopping = false

    async function stopScanner() {
      if (!started || stopping) return
      stopping = true
      try {
        await scanner.stop()
      } catch {
        // The scanner may already have stopped after a successful decode.
      }
    }

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        if (stopped || disposed) return
        stopped = true
        processCode(decodedText)
        void stopScanner().finally(() => setScanning(false))
      },
      () => {}
    ).then(() => {
      started = true
      if (disposed) void stopScanner()
    }).catch(() => {
      if (!disposed) {
        setScannerError('Camera access was unavailable. Check browser permissions or use manual code entry.')
        setScanning(false)
      }
    })

    return () => {
      disposed = true
      void stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  return (
    <div>
      <form onSubmit={checkIn} className="flex gap-2">
        <input
          autoFocus
          placeholder="Enter or scan code"
          value={code}
          disabled={checkingIn || scanning}
          onChange={(e) => setCode(e.target.value)}
          className="flex-1 rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted"
        />
        <button disabled={checkingIn || scanning || !code.trim()} className="rounded-lg bg-gold px-5 py-2 font-medium text-ink disabled:opacity-60">{checkingIn ? 'Looking up…' : 'Look up code'}</button>
        <button type="button" disabled={checkingIn} onClick={() => { setScannerError(''); setScanning((s) => !s) }} className="rounded-lg border border-black/15 px-4 py-2 text-sm text-paper disabled:opacity-60">
          {scanning ? 'Stop camera' : 'Scan QR'}
        </button>
      </form>
      {scannerError && <p className="mt-3 text-sm text-flame">{scannerError}</p>}
      {scanning && <div id="qr-reader" className="mt-3 max-w-xs" />}
      {result && (
        <p className={`mt-3 text-sm ${result.ok ? 'text-gold' : 'text-flame'}`}>{result.message}</p>
      )}
      {pendingCheckIn && (
        pendingCheckIn.table === 'registrations' || pendingCheckIn.checkInCount < pendingCheckIn.maxAdmits ? (
          <button type="button" onClick={confirmCheckIn} disabled={checkingIn} className="mt-4 rounded-lg bg-flame px-5 py-2 font-medium text-ink disabled:opacity-60">
            {checkingIn ? 'Confirming…' : 'Confirm check-in'}
          </button>
        ) : null
      )}
    </div>
  )
}

function MembersSummaryPage({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ pending: 0, active: 0 })

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase.from('members').select('status').eq('organization_id', organizationId)
      const rows = (data as { status: Member['status'] }[]) ?? []
      setCounts({
        pending: rows.filter((member) => member.status === 'pending' || member.status === 'inactive').length,
        active: rows.filter((member) => member.status === 'active').length,
      })
    }
    loadCounts()
  }, [organizationId])

  return (
    <div>
      <h2 className="display text-2xl text-paper">Members</h2>
      <p className="mt-1 text-sm text-muted">Review new applications or manage confirmed members.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button onClick={() => navigate('/dashboard/members/pending')} className="rounded-xl border border-flame/20 bg-flame/[0.03] p-5 text-left transition hover:border-flame/50">
          <p className="text-sm text-muted">Pending approval</p>
          <p className="display mt-1 text-3xl text-flame">{counts.pending}</p>
          <p className="mt-3 text-sm text-muted">Review members waiting for approval →</p>
        </button>
        <button onClick={() => navigate('/dashboard/members/active')} className="rounded-xl border border-black/10 bg-surface p-5 text-left transition hover:border-black/25">
          <p className="text-sm text-muted">Members</p>
          <p className="display mt-1 text-3xl text-paper">{counts.active}</p>
          <p className="mt-3 text-sm text-muted">Manage confirmed members →</p>
        </button>
      </div>
    </div>
  )
}

export function MembersPanel({ organizationId, status }: { organizationId: string; status: 'pending' | 'active' }) {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingMember, setDeletingMember] = useState<Member | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [memberAction, setMemberAction] = useState<{ kind: 'confirm' | 'decline'; member: Member } | null>(null)
  const [actionLoading, setActionLoading] = useState<'delete' | 'confirm' | 'decline' | null>(null)
  const [actionError, setActionError] = useState('')

  async function load() {
    const { data } = await supabase.from('members').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })
    setMembers((data as Member[]) ?? [])
  }
  useEffect(() => { load() }, [organizationId])

  async function confirmMember(member: Member) {
    const { error } = await supabase.from('members').update({ status: 'active' }).eq('id', member.id)
    if (error) return
    sendConfirmationEmail('member_confirmed', member.id)
    if (member.whatsapp_number) callFunction('send-whatsapp', { member_id: member.id }).catch(() => {})
    await load()
    setSuccess(`${member.first_name} ${member.last_name} confirmed`)
    setTimeout(() => setSuccess(''), 2500)
  }

  async function declineMember(member: Member) {
    const { error } = await supabase.from('members').update({ status: 'inactive' }).eq('id', member.id)
    if (error) return
    await load()
    setSuccess(`${member.first_name} ${member.last_name} declined`)
    setTimeout(() => setSuccess(''), 2500)
  }

  async function completeMemberAction() {
    if (!memberAction) return
    setActionLoading(memberAction.kind)
    try {
      if (memberAction.kind === 'confirm') await confirmMember(memberAction.member)
      else await declineMember(memberAction.member)
      setMemberAction(null)
    } finally {
      setActionLoading(null)
    }
  }

  async function deleteMember() {
    if (!deletingMember) return
    setActionLoading('delete')
    setActionError('')
    try {
      const { error } = await supabase.from('members').delete().eq('id', deletingMember.id)
      if (error) {
        setActionError(error.message)
        return
      }
      setDeletingMember(null)
      await load()
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = members.filter((m) => {
    const haystack = [m.first_name, m.last_name, m.nickname, m.email, m.whatsapp_number, m.call_number].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })
  const scopedMembers = filtered.filter((member) => status === 'pending'
    ? member.status === 'pending' || member.status === 'inactive'
    : member.status === 'active')

  function exportCsv() {
    const header = ['First name', 'Last name', 'Nickname', 'WhatsApp', 'Call number', 'Email', 'Location', 'Reason', 'Code', 'Status']
    const rows = filtered.map((m) => [m.first_name, m.last_name, m.nickname, m.whatsapp_number, m.call_number, m.email, m.location, m.reason, m.membership_code, m.status])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'members.csv'
    link.click()
  }

  function renderMemberTable(list: Member[], showConfirm: boolean) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1.5 pr-4">Name</th>
              <th className="py-1.5 pr-4">Nickname</th>
              <th className="py-1.5 pr-4">WhatsApp</th>
              <th className="py-1.5 pr-4">Email</th>
              <th className="py-1.5 pr-4">Location</th>
              <th className="py-1.5 pr-4">Code</th>
              <th className="py-1.5">Status</th>
              <th className="py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className="cursor-pointer border-t border-black/5 text-paper hover:bg-black/5"
              >
                <td className="py-1.5 pr-4">{m.first_name} {m.last_name}</td>
                <td className="py-1.5 pr-4 text-muted">{m.nickname}</td>
                <td className="py-1.5 pr-4 text-muted">{m.whatsapp_number}</td>
                <td className="py-1.5 pr-4 text-muted">{m.email}</td>
                <td className="py-1.5 pr-4 text-muted">{m.location}</td>
                <td className="py-1.5 pr-4">{m.membership_code}</td>
                <td className="py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    m.status === 'active' ? 'bg-gold/10 text-gold' : m.status === 'pending' ? 'bg-flame/10 text-flame' : 'bg-black/5 text-muted'
                  }`}>{m.status}</span>
                </td>
                <td className="py-1.5 text-right">
                  <div className="flex justify-end gap-2">
                    {showConfirm && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setMemberAction({ kind: 'confirm', member: m }) }} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold hover:bg-gold/10">Confirm</button>
                        <button onClick={(e) => { e.stopPropagation(); setMemberAction({ kind: 'decline', member: m }) }} className="rounded-full border border-flame/40 px-3 py-1 text-xs text-flame hover:bg-flame/10">Decline</button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setDeletingMember(m) }} className="rounded-full border border-flame/40 px-3 py-1 text-xs text-flame hover:bg-flame/10">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-4 text-sm text-muted">No members in this section.</p>}
      </div>
    )
  }

  return (
    <div>
      <DashboardBackButton />
      <h2 className="display mb-1 text-2xl text-paper">{status === 'pending' ? 'Pending approval' : 'Members'}</h2>
      <p className="mb-5 text-sm text-muted">{status === 'pending' ? 'Review members waiting for approval.' : 'Confirmed members in your organization.'}</p>
      <div className="mb-4 flex items-center justify-between gap-3">
        <input
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-black/15 bg-ink px-3 py-2 text-sm text-paper placeholder:text-muted"
        />
        <button onClick={exportCsv} className="whitespace-nowrap text-sm text-gold hover:underline">Export CSV</button>
      </div>
      {success && <p className="mb-3 text-sm text-gold">{success}</p>}
      {actionError && <p className="mb-3 text-sm text-flame">Could not delete member: {actionError}</p>}
      <div className={`rounded-xl border p-4 ${status === 'pending' ? 'border-flame/20 bg-flame/[0.03]' : 'border-black/10 bg-surface'}`}>
        {renderMemberTable(scopedMembers, status === 'pending')}
      </div>
      <ConfirmDialog
        open={deletingMember !== null}
        title="Delete this member?"
        message="This permanently removes them — it can't be undone."
        confirmLabel="Delete member"
        loading={actionLoading === 'delete'}
        onConfirm={deleteMember}
        onCancel={() => { if (!actionLoading) setDeletingMember(null) }}
      />
      <ConfirmDialog
        open={memberAction !== null}
        title={memberAction?.kind === 'confirm' ? 'Confirm this member?' : 'Decline this membership application?'}
        message={memberAction?.kind === 'confirm' ? "They'll be notified by email/WhatsApp." : 'This keeps their record but marks the application as inactive.'}
        confirmLabel={memberAction?.kind === 'confirm' ? 'Confirm member' : 'Decline application'}
        confirmClassName={memberAction?.kind === 'confirm' ? 'bg-gold text-ink' : 'bg-flame text-ink'}
        loading={actionLoading === 'confirm' || actionLoading === 'decline'}
        onConfirm={completeMemberAction}
        onCancel={() => { if (!actionLoading) setMemberAction(null) }}
      />
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => setSelectedMember(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-black/10 bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-flame">Member details</p>
                <h2 className="display mt-1 text-2xl text-paper">{selectedMember.first_name} {selectedMember.last_name}</h2>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-sm text-muted hover:text-paper">Close</button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <MemberDetail label="First name" value={selectedMember.first_name} />
              <MemberDetail label="Last name" value={selectedMember.last_name} />
              <MemberDetail label="Nickname" value={selectedMember.nickname} />
              <MemberDetail label="WhatsApp number" value={selectedMember.whatsapp_number} />
              <MemberDetail label="Call number" value={selectedMember.call_number} />
              <MemberDetail label="Email" value={selectedMember.email} />
              <MemberDetail label="Location" value={selectedMember.location} />
              <MemberDetail label="Membership code" value={selectedMember.membership_code} />
              <MemberDetail label="Status" value={selectedMember.status} />
              <MemberDetail label="Registered" value={new Date(selectedMember.created_at).toLocaleString('en-GH')} />
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted">Why they want to join</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-paper">{selectedMember.reason || 'Not provided'}</dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2 border-t border-black/10 pt-4">
              {status === 'pending' && selectedMember.status !== 'active' && (
                <>
                  <button onClick={() => { setMemberAction({ kind: 'confirm', member: selectedMember }); setSelectedMember(null) }} className="rounded-full border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10">Confirm</button>
                  <button onClick={() => { setMemberAction({ kind: 'decline', member: selectedMember }); setSelectedMember(null) }} className="rounded-full border border-flame/40 px-4 py-2 text-sm text-flame hover:bg-flame/10">Decline</button>
                </>
              )}
              <button onClick={() => { setDeletingMember(selectedMember); setSelectedMember(null) }} className="rounded-full border border-flame/40 px-4 py-2 text-sm text-flame hover:bg-flame/10">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-paper">{value || 'Not provided'}</dd>
    </div>
  )
}

export function GalleryPanel({ organizationId, eventId, photosOnly = false }: { organizationId: string; eventId?: string; photosOnly?: boolean }) {
  const navigate = useNavigate()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null)
  const [uploadEventId, setUploadEventId] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', date: '', description: '' })
  const [createFiles, setCreateFiles] = useState<FileList | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => { setUploadEventId(eventId && eventId !== 'unassigned' ? eventId : '') }, [eventId])

  async function load() {
    const [{ data: imageData }, { data: eventData }] = await Promise.all([
      supabase.from('gallery_images').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('start_datetime', { ascending: false }),
    ])
    const loadedEvents = (eventData as EventRow[]) ?? []
    const bannerUrls = new Set(loadedEvents.map((event) => event.banner_image_url).filter((url): url is string => Boolean(url)))
    setImages(((imageData as GalleryImage[]) ?? []).filter((image) => !bannerUrls.has(image.image_url)))
    setEvents(loadedEvents.filter((event) => isPastEvent(event, Date.now())))
  }
  useEffect(() => { load() }, [organizationId])

  async function handleUpload() {
    const files = uploadFiles
    if (!files || files.length === 0) return
    const selectedFiles = Array.from(files)
    setUploadProgress({ completed: 0, total: selectedFiles.length })
    setUploadSuccess('')
    let uploaded = 0
    let completed = 0
    for (const file of selectedFiles) {
      const path = `${organizationId}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('gallery').upload(path, file)
      if (error) {
        setUploadError(`${file.name} failed to upload: ${error.message}`)
      } else {
        const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
        const { error: imageInsertError } = await supabase.from('gallery_images').insert({ organization_id: organizationId, event_id: uploadEventId || null, image_url: pub.publicUrl })
        if (imageInsertError) setUploadError(`${file.name} uploaded but could not be saved: ${imageInsertError.message}`)
        else uploaded += 1
      }
      completed += 1
      setUploadProgress({ completed, total: selectedFiles.length })
      await waitForUploadPaint()
    }
    setUploadProgress(null)
    setUploadSuccess(`${uploaded} ${uploaded === 1 ? 'photo' : 'photos'} uploaded`)
    setTimeout(() => setUploadSuccess(''), 2500)
    await load()
    setUploadFiles(null)
    setUploadModalOpen(false)
  }

  async function deleteImage(img: GalleryImage) {
    const { error } = await supabase.from('gallery_images').update({ deleted_at: new Date().toISOString() }).eq('id', img.id)
    if (error) {
      setUploadError(`Could not delete photo: ${error.message}`)
      return
    }
    await load()
  }

  async function createPastEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.title || !createForm.date) return
    setCreateLoading(true)
    setCreateError('')
    const slug = `${createForm.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`
    const { data: newEvent, error } = await supabase.from('events').insert({
      organization_id: organizationId,
      title: createForm.title,
      slug,
      description: createForm.description || null,
      start_datetime: createForm.date,
      is_paid: false,
      status: 'completed',
      capacity: null,
      registration_starts_at: null,
      registration_ends_at: null,
    }).select().single()
    if (error || !newEvent) {
      setCreateLoading(false)
      setCreateError(error?.message ?? 'Could not create past event.')
      return
    }
    if (createFiles && createFiles.length > 0) {
      let firstUrl: string | null = null
      for (const file of Array.from(createFiles)) {
        const path = `${organizationId}/${newEvent.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('gallery').upload(path, file)
        if (uploadError) {
          setCreateError(`${file.name} failed to upload: ${uploadError.message}`)
          setUploadError(`${file.name} failed to upload: ${uploadError.message}`)
          continue
        }
        const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
        const { error: imageInsertError } = await supabase.from('gallery_images').insert({ organization_id: organizationId, event_id: newEvent.id, image_url: pub.publicUrl, is_flyer: true })
        if (imageInsertError) {
          setCreateError(`${file.name} uploaded but could not be saved: ${imageInsertError.message}`)
          setUploadError(`${file.name} uploaded but could not be saved: ${imageInsertError.message}`)
        }
        if (!firstUrl) firstUrl = pub.publicUrl
      }
      if (firstUrl) {
        const { error: bannerError } = await supabase.from('events').update({ banner_image_url: firstUrl }).eq('id', newEvent.id)
        if (bannerError) {
          setCreateError(`Past event created, but saving the flyer failed: ${bannerError.message}`)
          setUploadError(`Past event created, but saving the flyer failed: ${bannerError.message}`)
        }
      }
    }
    await load()
    setCreateLoading(false)
    setCreateModalOpen(false)
    setCreateForm({ title: '', date: '', description: '' })
    setCreateFiles(null)
    setUploadSuccess('Past event created')
    setTimeout(() => setUploadSuccess(''), 2500)
  }

  async function assignImage(image: GalleryImage, nextEventId: string) {
    const { error } = await supabase.from('gallery_images').update({ event_id: nextEventId }).eq('id', image.id)
    if (error) {
      setUploadError(`Could not move photo: ${error.message}`)
      return
    }
    await load()
  }

  return (
    <div>
      {eventId ? (
        <GalleryEventView eventId={eventId} events={events} images={images} onAddPhotos={() => setUploadModalOpen(true)} deleteImage={deleteImage} onAssign={assignImage} />
      ) : photosOnly ? (
        <PhotosLibrary images={images} events={events} onAddPhotos={() => setUploadModalOpen(true)} />
      ) : (
        <>
          <h2 className="display text-2xl text-paper">Past Events</h2>
          <p className="mt-1 text-sm text-muted">Organize event photos by the event they belong to.</p>
          <button onClick={() => setCreateModalOpen(true)} className="mt-4 rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95">+ Add past event</button>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const eventImages = images.filter((image) => image.event_id === event.id)
              if (eventImages.length === 0 && event.status !== 'completed') return null
              return <GalleryEventCard key={event.id} title={event.title} date={formatDate(event.start_datetime)} imageUrl={event.banner_image_url ?? eventImages[0]?.image_url} onClick={() => navigate(`/dashboard/past-events/${event.id}`)} />
            })}
            {events.every((event) => !images.some((image) => image.event_id === event.id)) && <p className="text-sm text-muted">No past events yet.</p>}
          </div>
        </>
      )}
      {uploadSuccess && <p className="mt-3 text-sm text-gold">{uploadSuccess}</p>}
      {uploadError && <p className="mt-3 text-sm text-flame">{uploadError}</p>}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => !createLoading && setCreateModalOpen(false)}>
          <form onSubmit={createPastEvent} className="w-full max-w-lg rounded-2xl border border-black/10 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="display text-2xl text-paper">Add past event</h3>
                <p className="mt-1 text-sm text-muted">Create an event record to organize its photos.</p>
              </div>
              <button type="button" disabled={createLoading} onClick={() => setCreateModalOpen(false)} className="text-sm text-muted hover:text-paper">Close</button>
            </div>
            <div className="mt-5 space-y-3">
              <input required placeholder="Event title" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
              <input required type="datetime-local" value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper" />
              <textarea placeholder="Description (optional)" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" rows={3} />
              <label className="block rounded-xl border border-dashed border-black/20 bg-ink p-4 text-sm text-muted">
                <span>Optional flyer</span>
                <input type="file" accept="image/*" onChange={(e) => setCreateFiles(e.target.files)} className="mt-2 block w-full text-paper" />
              </label>
            </div>
            {createError && <p className="mt-3 text-sm text-flame">{createError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={createLoading} onClick={() => setCreateModalOpen(false)} className="rounded-full border border-black/15 px-4 py-2 text-sm text-paper">Cancel</button>
              <button disabled={createLoading} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink disabled:opacity-50">{createLoading ? 'Creating…' : 'Create past event'}</button>
            </div>
          </form>
        </div>
      )}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => uploadProgress === null && setUploadModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="display text-2xl text-paper">Add New Photo(s)</h3>
                <p className="mt-1 text-sm text-muted">Choose photos and optionally attach them to an event.</p>
              </div>
              <button type="button" disabled={uploadProgress !== null} onClick={() => setUploadModalOpen(false)} className="text-sm text-muted hover:text-paper">Close</button>
            </div>
            <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-black/20 bg-ink p-5 text-center text-sm text-muted hover:border-flame">
              <span>{uploadFiles?.length ? `${uploadFiles.length} photo(s) selected` : 'Choose photo(s) to upload'}</span>
              <span className="mt-1 text-xs">JPG, PNG, or other image files</span>
              <input type="file" accept="image/*" multiple disabled={uploadProgress !== null} onChange={(e) => setUploadFiles(e.target.files)} className="sr-only" />
            </label>
            {eventId ? <p className="mt-4 rounded-lg bg-ink px-3 py-2 text-sm text-muted">Adding photos to {eventId === 'unassigned' ? 'Unsorted photos' : events.find((event) => event.id === eventId)?.title}</p> : (
              <select value={uploadEventId} onChange={(e) => setUploadEventId(e.target.value)} disabled={uploadProgress !== null} className="mt-4 w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper">
                <option value="">No specific event</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
              </select>
            )}
            <UploadStatus progress={uploadProgress} success="" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={uploadProgress !== null} onClick={() => setUploadModalOpen(false)} className="rounded-full border border-black/15 px-4 py-2 text-sm text-paper">Cancel</button>
              <button type="button" disabled={!uploadFiles || uploadProgress !== null} onClick={handleUpload} className="rounded-full bg-gold px-5 py-2 text-sm font-medium text-ink disabled:opacity-50">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotosLibrary({ images, events, onAddPhotos }: {
  images: GalleryImage[]
  events: EventRow[]
  onAddPhotos: () => void
}) {
  const navigate = useNavigate()
  const unsorted = images.filter((image) => image.event_id === null)
  const eventCards = events
    .map((event) => ({ event, images: images.filter((image) => image.event_id === event.id) }))
    .filter(({ images: eventImages }) => eventImages.length > 0)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-2xl text-paper">Photos</h2>
          <p className="mt-1 text-sm text-muted">Browse photos by event or keep unassigned photos in Unsorted.</p>
        </div>
        <button onClick={onAddPhotos} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95">Add photos</button>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {unsorted.length > 0 && <GalleryEventCard title="Unsorted" date={`${unsorted.length} photos`} imageUrl={unsorted[0].image_url} onClick={() => navigate('/dashboard/past-events/unassigned')} />}
        {eventCards.map(({ event, images: eventImages }) => <GalleryEventCard key={event.id} title={event.title} date={`${eventImages.length} ${eventImages.length === 1 ? 'photo' : 'photos'}`} imageUrl={event.banner_image_url ?? eventImages[0]?.image_url} onClick={() => navigate(`/dashboard/past-events/${event.id}`)} />)}
        {unsorted.length === 0 && eventCards.length === 0 && <p className="text-sm text-muted">No photos yet.</p>}
      </div>
    </div>
  )
}

function GalleryEventCard({ title, date, imageUrl, onClick }: { title: string; date: string; imageUrl?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group overflow-hidden rounded-xl border border-black/10 bg-surface text-left transition hover:border-black/30">
      <div className="aspect-[4/3] overflow-hidden bg-surface-light">
        {imageUrl ? <img src={imageUrl} alt={`${title} flyer`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><span className="display text-4xl text-muted">{title[0]}</span></div>}
      </div>
      <div className="p-4">
        <h3 className="display text-xl text-paper">{title}</h3>
        <p className="mt-1 text-sm text-muted">{date}</p>
      </div>
    </button>
  )
}

function GalleryEventView({ eventId, events, images, onAddPhotos, deleteImage, onAssign }: {
  eventId: string
  events: EventRow[]
  images: GalleryImage[]
  onAddPhotos: () => void
  deleteImage: (image: GalleryImage) => void
  onAssign: (image: GalleryImage, eventId: string) => void
}) {
  const event = events.find((item) => item.id === eventId)
  const eventImages = eventId === 'unassigned' ? images.filter((image) => image.event_id === null) : images.filter((image) => image.event_id === eventId)
  const title = eventId === 'unassigned' ? 'Unsorted photos' : event?.title ?? 'Event photos'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <DashboardBackButton />
          <h2 className="display text-2xl text-paper">{title}</h2>
          {event && <p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p>}
        </div>
        <button onClick={onAddPhotos} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95">Add photos</button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {eventImages.map((image, index) => <DashboardPhoto key={image.id} image={image} events={events} deleteImage={deleteImage} onAssign={onAssign} previewImages={eventImages} previewIndex={index} />)}
        {eventImages.length === 0 && <p className="col-span-full text-sm text-muted">No photos yet.</p>}
      </div>
    </div>
  )
}

function DashboardPhoto({ image, events, deleteImage, onAssign, previewImages, previewIndex }: {
  image: GalleryImage
  events: EventRow[]
  deleteImage: (image: GalleryImage) => void
  onAssign: (image: GalleryImage, eventId: string) => void
  previewImages?: GalleryImage[]
  previewIndex?: number
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(previewIndex ?? 0)
  const gallery = previewImages ?? [image]

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteImage(image)
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleAssign(nextEventId: string) {
    setAssigning(true)
    try {
      await onAssign(image, nextEventId)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-surface">
      <button type="button" onClick={() => { setActiveIndex(previewIndex ?? 0); setPreviewOpen(true) }} className="block h-full w-full cursor-zoom-in">
        <img src={image.image_url} alt="Preview photo" className="h-full w-full object-cover" />
      </button>
      <div className={`pointer-events-none absolute inset-0 flex items-end justify-end gap-2 bg-black/30 p-2 transition ${confirmingDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {image.event_id === null && (
          <select defaultValue="" disabled={assigning || deleting} onChange={(e) => e.target.value && handleAssign(e.target.value)} className="pointer-events-auto max-w-[65%] rounded-full border border-black/15 bg-surface px-2 py-1.5 text-xs text-paper disabled:opacity-60">
            <option value="">{assigning ? 'Moving…' : 'Move to event…'}</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        )}
        <button disabled={assigning || deleting} onClick={() => setConfirmingDelete(true)} className="pointer-events-auto rounded-full bg-flame px-4 py-1.5 text-sm text-ink hover:brightness-95 disabled:opacity-60">Delete</button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this photo?"
        message="This can't be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setConfirmingDelete(false) }}
      />
      {previewOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5" onClick={() => setPreviewOpen(false)}>
          <div className="flex w-full max-w-5xl items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
            {gallery.length > 1 && <button type="button" aria-label="Previous photo" onClick={() => setActiveIndex((current) => (current - 1 + gallery.length) % gallery.length)} className="z-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-paper/30 bg-ink text-3xl text-paper shadow-xl hover:bg-surface">‹</button>}
            <div className="max-w-3xl text-center">
              <img src={gallery[activeIndex].image_url} alt="Preview photo" className="max-h-[78vh] rounded-lg object-contain" />
              <p className="mt-3 text-sm text-muted">{activeIndex + 1} of {gallery.length}</p>
            </div>
            {gallery.length > 1 && <button type="button" aria-label="Next photo" onClick={() => setActiveIndex((current) => (current + 1) % gallery.length)} className="z-50 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-paper/30 bg-ink text-3xl text-paper shadow-xl hover:bg-surface">›</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminPanel({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ team: 0, pending: 0, invites: 0 })

  useEffect(() => {
    async function loadCounts() {
      const [{ count: team }, { count: pending }, { count: invites }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('access_status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('role', 'organizer_admin').eq('access_status', 'pending'),
        supabase.from('organizer_invites').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('used', false),
      ])
      setCounts({ team: team ?? 0, pending: pending ?? 0, invites: invites ?? 0 })
    }
    loadCounts()
  }, [organizationId])

  return (
    <div>
      <h2 className="display text-2xl text-paper">Platform admin</h2>
      <p className="mt-1 text-sm text-muted">Manage team access, pending requests, and invitations.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <AdminSummaryCard label="Team" count={counts.team} description="Active dashboard accounts" onClick={() => navigate('/dashboard/admin/team')} />
        <AdminSummaryCard label="Pending requests" count={counts.pending} description="Awaiting your approval" onClick={() => navigate('/dashboard/admin/pending')} />
        <AdminSummaryCard label="Unclaimed invites" count={counts.invites} description="Links ready to use" onClick={() => navigate('/dashboard/admin/invites')} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <InviteTeamMember organizationId={organizationId} onCreated={() => {}} />
        <CreateTeamAccount />
      </div>
    </div>
  )
}

export function DashboardAdminPage() {
  const { profile } = useAuth()
  return <AdminPanel organizationId={profile?.organization_id ?? ''} />
}

export function DashboardAdminTeamPage() {
  const { profile } = useAuth()
  return <AdminTeamPanel organizationId={profile?.organization_id ?? ''} />
}

export function DashboardAdminPendingPage() {
  const { profile } = useAuth()
  return <AdminPendingPanel organizationId={profile?.organization_id ?? ''} />
}

export function DashboardAdminInvitesPage() {
  const { profile } = useAuth()
  return <AdminInvitesPanel organizationId={profile?.organization_id ?? ''} />
}

function AdminSummaryCard({ label, count, description, onClick }: { label: string; count: number; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-xl border border-black/10 bg-surface p-5 text-left transition hover:border-flame/50">
      <p className="text-sm text-muted">{label}</p>
      <p className="display mt-1 text-3xl text-paper">{count}</p>
      <p className="mt-3 text-sm text-muted">{description} →</p>
    </button>
  )
}

function AdminTeamPanel({ organizationId }: { organizationId: string }) {
  const { profile: currentProfile } = useAuth()
  const [team, setTeam] = useState<TeamProfile[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamProfile | null>(null)
  const [removingMember, setRemovingMember] = useState<TeamProfile | null>(null)
  const [removing, setRemoving] = useState(false)

  async function loadTeam() {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('organization_id', organizationId).eq('access_status', 'active').in('role', ['organizer_admin', 'platform_admin']).order('created_at', { ascending: true })
    setTeam((profileData as TeamProfile[]) ?? [])
  }

  useEffect(() => { loadTeam() }, [organizationId])

  async function removeAccess() {
    if (!removingMember) return
    setRemoving(true)
    try {
      await supabase.from('profiles').update({ organization_id: null, role: 'attendee' }).eq('id', removingMember.id)
      setRemovingMember(null)
      await loadTeam()
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <DashboardBackButton />
      <h2 className="display text-2xl text-paper">Team</h2>
      <p className="mt-1 text-sm text-muted">Active accounts with accepted dashboard access.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {team.map((member) => {
          const canRemove = member.id !== currentProfile?.id && member.role === 'organizer_admin'
          return (
            <div key={member.id} className="rounded-xl border border-black/10 bg-surface p-4">
              <button onClick={() => setSelectedMember(member)} className="w-full text-left">
                <p className="display text-lg text-paper">{member.full_name || 'Unnamed team member'}</p>
                <p className="mt-1 text-sm text-muted">{member.email || 'No email on profile'}</p>
                <span className="mt-3 inline-block rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">{member.role}</span>
              </button>
              {canRemove && <button disabled={removing} onClick={() => setRemovingMember(member)} className="mt-4 rounded-full border border-flame/40 px-3 py-1.5 text-xs text-flame hover:bg-flame/10 disabled:opacity-50">Remove access</button>}
            </div>
          )
        })}
        {team.length === 0 && <p className="text-sm text-muted">No team members found.</p>}
      </div>

      <ConfirmDialog
        open={removingMember !== null}
        title="Remove this person's dashboard access?"
        message="They'll need a new invite or account to get back in."
        confirmLabel="Remove access"
        loading={removing}
        onConfirm={removeAccess}
        onCancel={() => { if (!removing) setRemovingMember(null) }}
      />
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => setSelectedMember(null)}>
          <div className="w-full max-w-md rounded-2xl border border-black/10 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm uppercase tracking-widest text-flame">Team member</p><h3 className="display mt-1 text-2xl text-paper">{selectedMember.full_name || 'Unnamed team member'}</h3></div>
              <button onClick={() => setSelectedMember(null)} className="text-sm text-muted hover:text-paper">Close</button>
            </div>
            <dl className="mt-6 space-y-4">
              <AdminDetail label="Full name" value={selectedMember.full_name} />
              <AdminDetail label="Email" value={selectedMember.email} />
              <AdminDetail label="Role" value={selectedMember.role} />
            </dl>
            <p className="mt-6 border-t border-black/10 pt-4 text-sm text-muted">This is basic profile information only; activity and audit logging are not available yet.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminPendingPanel({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState<TeamProfile[]>([])
  const [pendingAction, setPendingAction] = useState<{ kind: 'confirm' | 'decline'; member: TeamProfile } | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').eq('organization_id', organizationId).eq('role', 'organizer_admin').eq('access_status', 'pending').order('created_at', { ascending: true })
    setMembers((data as TeamProfile[]) ?? [])
  }
  useEffect(() => { load() }, [organizationId])

  async function completeAction() {
    if (!pendingAction) return
    setLoading(true)
    try {
      const update = pendingAction.kind === 'confirm' ? { access_status: 'active' } : { access_status: 'declined', organization_id: null, role: 'attendee' }
      await supabase.from('profiles').update(update).eq('id', pendingAction.member.id)
      if (pendingAction.kind === 'confirm') sendConfirmationEmail('team_approved', pendingAction.member.id)
      setPendingAction(null)
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <DashboardBackButton />
      <h2 className="display text-2xl text-paper">Pending requests</h2>
      <p className="mt-1 text-sm text-muted">People who claimed an invite and are waiting for approval.</p>
      <div className="mt-6 space-y-2">
        {members.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-flame/20 bg-flame/[0.03] px-4 py-3">
            <div><p className="text-paper">{member.full_name || 'Unnamed team member'}</p><p className="text-xs text-muted">{member.email || 'No email on profile'}</p></div>
            <div className="flex gap-2"><button disabled={loading} onClick={() => setPendingAction({ kind: 'confirm', member })} className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold disabled:opacity-50">Confirm</button><button disabled={loading} onClick={() => setPendingAction({ kind: 'decline', member })} className="rounded-full border border-flame/40 px-3 py-1 text-xs text-flame disabled:opacity-50">Decline</button></div>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-muted">No pending team requests.</p>}
      </div>
      <ConfirmDialog open={pendingAction !== null} title={pendingAction?.kind === 'confirm' ? 'Confirm this team request?' : 'Decline this team request?'} message={pendingAction?.kind === 'confirm' ? 'This person will gain access to the organization dashboard.' : 'This person will lose organization access and return to an attendee account.'} confirmLabel={pendingAction?.kind === 'confirm' ? 'Confirm' : 'Decline'} confirmClassName={pendingAction?.kind === 'confirm' ? 'bg-gold text-ink' : 'bg-flame text-ink'} loading={loading} onConfirm={completeAction} onCancel={() => { if (!loading) setPendingAction(null) }} />
    </div>
  )
}

function AdminInvitesPanel({ organizationId }: { organizationId: string }) {
  const [invites, setInvites] = useState<{ id: string; token: string; used: boolean; label: string | null }[]>([])
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  useEffect(() => { supabase.from('organizer_invites').select('*').eq('organization_id', organizationId).eq('used', false).order('created_at', { ascending: false }).then(({ data }) => setInvites((data as typeof invites) ?? [])) }, [organizationId])
  async function copyInviteLink(inviteId: string, link: string) {
    try { await navigator.clipboard.writeText(link); setCopiedInviteId(inviteId); setTimeout(() => setCopiedInviteId((current) => current === inviteId ? null : current), 1800) } catch { setCopiedInviteId(null) }
  }
  return (
    <div><DashboardBackButton /><h2 className="display text-2xl text-paper">Unclaimed invites</h2><p className="mt-1 text-sm text-muted">Invite links that have not been used yet.</p><div className="mt-6 space-y-2">{invites.map((invite) => { const link = `${window.location.origin}/join/${invite.token}`; return <div key={invite.id} className="flex items-center justify-between rounded-lg border border-black/10 bg-surface px-4 py-3"><div><p className="text-paper">{invite.label ?? 'Team member invite'}</p><p className="break-all text-xs text-muted">{link}</p></div><button onClick={() => copyInviteLink(invite.id, link)} className="rounded-full border border-black/15 px-3 py-1 text-sm text-gold hover:bg-black/5">{copiedInviteId === invite.id ? 'Copied!' : 'Copy link'}</button></div> })}{invites.length === 0 && <p className="text-sm text-muted">No unclaimed invite links.</p>}</div></div>
  )
}

type TeamProfile = { id: string; full_name: string | null; email: string | null; role: 'organizer_admin' | 'platform_admin' | 'attendee'; access_status: 'pending' | 'active' | 'declined' | null; created_at?: string }

function AdminDetail({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 text-sm text-paper">{value || 'Not provided'}</dd></div>
}

function CreateTeamAccount() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function copyCredentials() {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult('')
    try {
      await callFunction('create-team-account', form)
      setResult(`Share these credentials with them: email ${form.email}, password ${form.password}`)
      setCopied(false)
      setForm({ full_name: '', email: '', password: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-black/10 bg-surface p-5">
      <h3 className="display text-xl text-paper">Create account directly</h3>
      <p className="text-sm text-muted">Create an organizer account with a password to share manually.</p>
      <input required placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      <input required type="password" minLength={6} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      {error && <p className="text-sm text-flame">{error}</p>}
      {result && (
        <div className="rounded-lg bg-ink p-3 text-sm">
          <p className="break-words text-gold">{result}</p>
          <button type="button" onClick={copyCredentials} className="mt-2 rounded-full border border-black/15 px-3 py-1 text-sm text-gold hover:bg-black/5">
            {copied ? 'Copied!' : 'Copy credentials'}
          </button>
        </div>
      )}
      <button disabled={loading} className="rounded-full bg-gold px-5 py-2 font-medium text-ink disabled:opacity-60">{loading ? 'Creating…' : 'Create account'}</button>
    </form>
  )
}

function InviteTeamMember({ organizationId, onCreated }: { organizationId: string; onCreated: () => void }) {
  const [label, setLabel] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setLink('')

    const token = crypto.randomUUID().replace(/-/g, '')
    const { error: inviteError } = await supabase
      .from('organizer_invites')
      .insert({ organization_id: organizationId, token, label: label || null })

    setLoading(false)
    if (inviteError) { setError(inviteError.message); return }

    setLink(`${window.location.origin}/join/${token}`)
    setCopied(false)
    setLabel('')
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-black/10 bg-surface p-5">
      <h3 className="display text-xl text-paper">Invite a team member</h3>
      <p className="text-sm text-muted">Generate a one-time link for someone to set up their own login and manage the platform dashboard.</p>
      <input placeholder="Their name (for your reference)" value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      {error && <p className="text-sm text-flame">{error}</p>}
      <button disabled={loading} className="rounded-full bg-gold px-5 py-2 font-medium text-ink hover:brightness-95 disabled:opacity-60">
        {loading ? 'Creating…' : 'Generate invite link'}
      </button>
      {link && (
        <div className="rounded-lg bg-ink px-3 py-2 text-sm">
          <p className="text-muted">Send this link to them — it's their private setup link:</p>
          <p className="mt-1 break-all text-gold">{link}</p>
          <button type="button" onClick={copyInviteLink} className="mt-2 rounded-full border border-black/15 px-3 py-1 text-sm text-gold hover:bg-black/5">
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </form>
  )
}
