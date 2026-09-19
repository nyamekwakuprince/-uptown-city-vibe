import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, formatDate } from '../lib/supabase'
import type { EventRow, GalleryImage, Organization, TicketType } from '../lib/types'

type EventWithTickets = EventRow & { ticketTypes: TicketType[] }

function eventPrice(event: EventWithTickets) {
  if (!event.is_paid) return 'FREE'
  const lowestPrice = event.ticketTypes.reduce<number | null>((lowest, ticket) => (
    lowest === null ? ticket.price : Math.min(lowest, ticket.price)
  ), null)
  return lowestPrice === null ? 'TICKETS' : `GHc ${lowestPrice.toLocaleString('en-GH')}`
}

function HeroGallery({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl border border-black/5 bg-surface-light p-8 shadow-inner">
        <span className="text-center text-muted">Add photos to show the event gallery</span>
      </div>
    )
  }

  const filledImages = Array.from({ length: 9 }, (_, index) => images[index % images.length])
  const columns = [filledImages.slice(0, 3), filledImages.slice(3, 6), filledImages.slice(6, 9)]

  return (
    <div className="grid aspect-square grid-cols-3 gap-3 overflow-hidden rounded-3xl">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="overflow-hidden">
          <div className={`hero-gallery-track hero-gallery-track-${columnIndex}`}>
            {[...column, ...column].map((image, imageIndex) => (
              <img
                key={`${image.id}-${imageIndex}`}
                src={image.image_url}
                alt=""
                className="mb-3 aspect-square w-full rounded-2xl object-cover shadow-md last:mb-0"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventCard({ event, href, photoCount, fallbackImage }: { event: EventWithTickets; href: string; photoCount?: number; fallbackImage?: string }) {
  return (
    <Link
      to={href}
      className="group cursor-pointer overflow-hidden rounded-xl border border-black/10 bg-surface transition hover:-translate-y-1 hover:border-black/20 hover:shadow-md"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-light">
        {event.banner_image_url || fallbackImage ? (
          <img src={event.banner_image_url ?? fallbackImage} alt={`${event.title} flyer`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span className="display text-4xl text-muted">{event.title[0]}</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display line-clamp-2 text-lg text-paper">{event.title}</h3>
          <span className="flex shrink-0 flex-col items-end leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{photoCount ? 'Photos' : 'Ticket'}</span>
            <span className="text-xl font-black text-flame">{photoCount ? photoCount : eventPrice(event)}</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p>
        <p className="mt-1 truncate text-sm text-muted">{event.venue_name ?? 'Venue to be announced'}</p>
      </div>
    </Link>
  )
}

export default function Home() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [events, setEvents] = useState<EventWithTickets[]>([])
  const [pastEvents, setPastEvents] = useState<EventWithTickets[]>([])
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search')?.trim() ?? ''

  useEffect(() => {
    async function load() {
      const { data: orgData } = await supabase.from('organizations').select('*').eq('slug', 'uptown-city-vibe').single()
      setOrg(orgData as Organization)
      if (orgData) {
        const { data: eventData } = await supabase
          .from('events')
          .select('*, organizations(name, slug, logo_url)')
          .eq('organization_id', orgData.id)
          .eq('status', 'published')
          .is('deleted_at', null)
          .order('start_datetime', { ascending: true })
        const loadedEvents = (eventData as EventRow[]) ?? []
        const { data: ticketData } = loadedEvents.length > 0
          ? await supabase.from('ticket_types').select('*').in('event_id', loadedEvents.map((event) => event.id))
          : { data: [] }
        const ticketsByEvent = new Map<string, TicketType[]>()
        ;((ticketData as TicketType[]) ?? []).forEach((ticket) => {
          ticketsByEvent.set(ticket.event_id, [...(ticketsByEvent.get(ticket.event_id) ?? []), ticket])
        })
        setEvents(loadedEvents.map((event) => ({ ...event, ticketTypes: ticketsByEvent.get(event.id) ?? [] })))

        const { data: pastEventData } = await supabase
          .from('events')
          .select('*')
          .eq('organization_id', orgData.id)
          .is('deleted_at', null)
          .lt('start_datetime', new Date().toISOString())
          .order('start_datetime', { ascending: false })
        const loadedPastEvents = (pastEventData as EventRow[]) ?? []
        setPastEvents(loadedPastEvents.map((event) => ({ ...event, ticketTypes: ticketsByEvent.get(event.id) ?? [] })))

        const { data: galleryData } = await supabase
          .from('gallery_images')
          .select('*')
          .eq('organization_id', orgData.id)
          .is('deleted_at', null)
          .eq('is_flyer', false)
          .order('created_at', { ascending: false })
        setGallery((galleryData as GalleryImage[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date().getTime()
  const matchesSearch = (e: EventWithTickets) => {
    if (!searchQuery) return true
    return e.title.toLowerCase().includes(searchQuery.toLowerCase())
  }

  const filtered = events.filter((e) => {
    const eventTime = e.end_datetime ? new Date(e.end_datetime).getTime() : new Date(e.start_datetime).getTime()
    if (eventTime < now) return false
    if (!matchesSearch(e)) return false

    if (filter === 'free') return !e.is_paid
    if (filter === 'paid') return e.is_paid
    return true
  })
  const eventGalleries = pastEvents
    .filter(matchesSearch)
    .map((event) => ({ event, images: gallery.filter((image) => image.event_id === event.id) }))
    .filter((group) => searchQuery || group.images.length > 0)

  return (
    <div>
      {/* Split layout hero */}
      <section className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-10 px-5 py-20 lg:flex-row lg:py-32">
        <div className="max-w-xl text-left">
          <h1 className="display text-5xl leading-tight text-paper sm:text-6xl lg:text-7xl">
            {org?.name ?? 'Uptown City Vibe'} <span className="text-flame">#1</span> Events &amp; Experiences
          </h1>
          <p className="mt-6 text-lg text-muted">
            Discover memorable events, connect with your community, and create experiences people will talk about.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/membership" className="rounded-xl bg-flame px-8 py-3.5 font-medium text-white shadow-lg transition hover:brightness-110 active:scale-95">Become a member</Link>
            <Link to="/all-events" className="rounded-xl border border-black/15 bg-surface px-8 py-3.5 font-medium text-paper shadow-sm transition hover:bg-black/5 active:scale-95">Explore events</Link>
          </div>
          <p className="mt-12 text-sm font-medium uppercase tracking-widest text-muted">Music · culture · community</p>
        </div>

        <div className="w-full lg:w-1/2"><HeroGallery images={gallery} /></div>
      </section>

      {/* Upcoming events */}
      <section id="events" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="display text-3xl text-paper">Upcoming events</h2>
        <div className="mb-6 mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(['all', 'free', 'paid'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-1.5 text-sm capitalize ${
                  filter === f ? 'border-gold bg-gold text-ink' : 'border-black/15 text-muted hover:text-paper'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-muted">Loading events…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted">No events right now — check back soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => <EventCard key={event.id} event={event} href={`/events/${event.slug}`} />)}
          </div>
        )}
      </section>

      {/* Past events */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="display text-3xl text-paper">Past Events</h2>
        <p className="mt-2 text-muted">Moments from our events.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventGalleries.map(({ event, images }) => <EventCard key={event.id} event={event} href={`/past-events/${event.id}`} photoCount={images.length} fallbackImage={images[0]?.image_url} />)}
            {eventGalleries.length === 0 && <p className="text-muted">No past event photos yet.</p>}
          </div>
      </section>

      {/* Membership CTA */}
      <section className="border-t border-black/10 bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="display text-3xl text-paper">Join the community</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Become a member of {org?.name ?? 'Uptown City Vibe'} — stay in the loop and connect with the crew.
          </p>
          <Link to="/membership" className="mt-6 inline-block rounded-full bg-gold px-6 py-2.5 font-medium text-ink hover:brightness-95">
            Register as a member
          </Link>
        </div>
      </section>
    </div>
  )
}
