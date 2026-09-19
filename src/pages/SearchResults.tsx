import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase, formatDate } from '../lib/supabase'
import type { EventRow } from '../lib/types'

type SearchEvent = EventRow & { organizations?: { name: string } }

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('search')?.trim() ?? ''
  const [events, setEvents] = useState<SearchEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('events')
        .select('*, organizations(name)')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('start_datetime', { ascending: true })

      if (queryError) setError(queryError.message)
      setEvents((data as SearchEvent[]) ?? [])
      setLoading(false)
    }
    load()
  }, [query])

  const matches = events.filter((event) => !query || event.title.toLowerCase().includes(query.toLowerCase()))
  const now = Date.now()
  const upcoming = matches.filter((event) => new Date(event.end_datetime ?? event.start_datetime).getTime() >= now)
  const past = matches.filter((event) => new Date(event.end_datetime ?? event.start_datetime).getTime() < now)

  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <Link to="/" className="text-sm font-medium text-muted hover:text-paper">← Back to home</Link>
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-flame">Search results</p>
      <h1 className="display mt-2 text-4xl text-paper">
        {query ? `Results for “${query}”` : 'Find an event'}
      </h1>

      {loading && <p className="mt-8 text-muted">Searching events…</p>}
      {error && <p className="mt-8 text-sm text-flame">Could not load search results: {error}</p>}
      {!loading && !error && matches.length === 0 && <p className="mt-8 text-muted">No events matched your search.</p>}

      {!loading && !error && upcoming.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl text-paper">Upcoming events</h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => <SearchEventCard key={event.id} event={event} href={`/events/${event.slug}`} />)}
          </div>
        </section>
      )}

      {!loading && !error && past.length > 0 && (
        <section className="mt-12">
          <h2 className="display text-2xl text-paper">Past events</h2>
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event) => <SearchEventCard key={event.id} event={event} href={`/past-events/${event.id}`} />)}
          </div>
        </section>
      )}
    </main>
  )
}

function SearchEventCard({ event, href }: { event: SearchEvent; href: string }) {
  return (
    <Link to={href} className="group overflow-hidden rounded-xl border border-black/10 bg-surface transition hover:-translate-y-1 hover:border-black/25 hover:shadow-md">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-light">
        {event.banner_image_url
          ? <img src={event.banner_image_url} alt={`${event.title} flyer`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          : <span className="display text-5xl text-muted">{event.title[0]}</span>}
      </div>
      <div className="p-4">
        <h3 className="display text-xl text-paper">{event.title}</h3>
        <p className="mt-1 text-sm text-muted">{formatDate(event.start_datetime)}</p>
        <p className="mt-1 truncate text-sm text-muted">{event.venue_name ?? 'Venue to be announced'}</p>
      </div>
    </Link>
  )
}
