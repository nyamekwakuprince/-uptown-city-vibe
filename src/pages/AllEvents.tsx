import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, formatDate } from '../lib/supabase'
import type { EventRow } from '../lib/types'

export default function AllEvents() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('start_datetime', { ascending: true })
      setEvents((data as EventRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const now = Date.now()
  const upcoming = events.filter((event) => new Date(event.end_datetime ?? event.start_datetime).getTime() >= now)
  const past = events.filter((event) => new Date(event.end_datetime ?? event.start_datetime).getTime() < now)

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <Link to="/" className="text-sm font-medium text-muted hover:text-paper">← Back to home</Link>
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-flame">Event calendar</p>
      <h1 className="display mt-2 text-4xl text-paper">All events</h1>
      <p className="mt-2 text-muted">Explore upcoming gatherings and moments from the past.</p>
      {loading && <p className="mt-8 text-muted">Loading events…</p>}
      {!loading && <>
        <EventGroup title="Upcoming events" events={upcoming} empty="No upcoming events right now." />
        <EventGroup title="Past events" events={past} empty="No past events yet." />
      </>}
    </main>
  )
}

function EventGroup({ title, events, empty }: { title: string; events: EventRow[]; empty: string }) {
  return (
    <section className="mt-10">
      <h2 className="display text-2xl text-paper">{title}</h2>
      {events.length === 0 ? <p className="mt-4 text-muted">{empty}</p> : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} to={new Date(event.end_datetime ?? event.start_datetime).getTime() >= Date.now() ? `/events/${event.slug}` : `/past-events/${event.id}`} className="group overflow-hidden rounded-xl border border-black/10 bg-surface transition hover:-translate-y-1 hover:border-black/25 hover:shadow-md">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-light">
                {event.banner_image_url ? <img src={event.banner_image_url} alt={`${event.title} flyer`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <span className="display text-5xl text-muted">{event.title[0]}</span>}
              </div>
              <div className="p-4">
                <h3 className="display text-xl text-paper">{event.title}</h3>
                <p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p>
                <p className="mt-1 truncate text-sm text-muted">{event.venue_name ?? 'Venue to be announced'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
