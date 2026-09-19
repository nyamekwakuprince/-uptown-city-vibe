import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, shortCode, formatGHS, formatDate, callFunction } from '../lib/supabase'
import type { EventRow, TicketType } from '../lib/types'

export default function EventDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [registrationCount, setRegistrationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', phone: '', nickname: '', whatsapp_number: '', location: '' })
  const [submitting, setSubmitting] = useState(false)
  const [pendingRegistration, setPendingRegistration] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: eventData } = await supabase
        .from('events')
        .select('*, organizations(name, slug, logo_url)')
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .single()
      setEvent(eventData as EventRow)

      if (eventData) {
        const { count } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventData.id)
        setRegistrationCount(count ?? 0)
      }

      if (eventData?.is_paid) {
        const { data: tt } = await supabase
          .from('ticket_types')
          .select('*')
          .eq('event_id', eventData.id)
        setTicketTypes((tt as TicketType[]) ?? [])
        if (tt && tt.length > 0) setSelectedTicket(tt[0].id)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return
    if (!isRegistrationOpen(event, registrationCount)) {
      setError(event.capacity && registrationCount >= event.capacity ? 'This event is sold out.' : 'Registration for this event is currently closed.')
      return
    }
    setSubmitting(true)
    setError('')
    const code = shortCode('REG')
    const id = crypto.randomUUID()
    const { error: insertError } = await supabase.from('registrations').insert({
      id,
      event_id: event.id,
      attendee_full_name: form.name,
      attendee_email: form.email,
      attendee_phone: form.phone,
      nickname: form.nickname || null,
      whatsapp_number: form.whatsapp_number || null,
      location: form.location || null,
      registration_code: code,
    })
    setSubmitting(false)
    if (insertError) { setError('Something went wrong. Please try again.'); return }
    setPendingRegistration(form.name)
  }

  async function handleBuyTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!event) return
    const ticket = availableTicketTypes.find((t) => t.id === selectedTicket)
    if (!ticket) return
    if (!isTicketOpen(ticket)) {
      setError('This ticket type is not available right now.')
      return
    }
    if (ticket.quantity_sold + quantity > ticket.quantity_available) {
      setError('Not enough tickets left for this quantity.')
      return
    }
    setSubmitting(true)
    setError('')
    const orderId = crypto.randomUUID()
    const { error: insertError } = await supabase.from('orders').insert({
      id: orderId,
      event_id: event.id,
      ticket_type_id: ticket.id,
      buyer_full_name: form.name,
      buyer_email: form.email,
      buyer_phone: form.phone,
      nickname: form.nickname || null,
      whatsapp_number: form.whatsapp_number || null,
      location: form.location || null,
      quantity,
      total_amount: ticket.price * quantity,
      payment_status: 'pending',
    })

    if (insertError) {
      console.error('Could not create order:', insertError)
      setSubmitting(false)
      setError(`Could not create order: ${insertError.message}`)
      return
    }

    const ticketCodes = new Set<string>()
    while (ticketCodes.size < quantity) ticketCodes.add(shortCode('TIX'))
    const ticketRows = Array.from(ticketCodes, (ticketCode) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      ticket_code: ticketCode,
      max_admits: Math.max(ticket.admits_count || 1, 1),
    }))
    const { error: ticketInsertError } = await supabase.from('tickets').insert(ticketRows)
    if (ticketInsertError) {
      console.error('Could not create tickets:', ticketInsertError)
      setSubmitting(false)
      setError(`Could not create tickets: ${ticketInsertError.message}`)
      return
    }

    try {
      const { authorization_url } = await callFunction('initialize-payment', { order_id: orderId })
      window.location.href = authorization_url
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? `Could not start payment: ${err.message}` : 'Could not start payment. Please try again.')
    }
  }

  const availableTicketTypes = ticketTypes.filter((t) => isTicketOpen(t))

  useEffect(() => {
    if (availableTicketTypes.length > 0 && !availableTicketTypes.some((t) => t.id === selectedTicket)) {
      setSelectedTicket(availableTicketTypes[0]?.id ?? '')
    }
  }, [availableTicketTypes, selectedTicket])

  if (loading) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Loading…</p>
  if (!event) return <p className="mx-auto max-w-3xl px-5 py-16 text-muted">Event not found.</p>

  const ticket = availableTicketTypes.find((t) => t.id === selectedTicket) ?? availableTicketTypes[0] ?? null
  const registrationOpen = isRegistrationOpen(event, registrationCount)

  const now = Date.now()
  const eventEndTime = event.end_datetime ? new Date(event.end_datetime).getTime() : new Date(event.start_datetime).getTime()
  const isEventPast = eventEndTime < now

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/15 bg-surface px-4 py-2 text-sm font-medium text-paper transition hover:border-black/30 hover:bg-black/5"
        aria-label="Back to events"
      >
        <span>←</span>
        <span>Back to events</span>
      </button>

      <div className="mb-8 flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-surface">
        {event.banner_image_url ? (
          <img src={event.banner_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="display text-5xl text-muted">{event.title[0]}</span>
        )}
      </div>

      <p className="text-sm text-muted">Hosted by {event.organizations?.name}</p>
      <h1 className="display mt-1 text-4xl text-paper">{event.title}</h1>
      <p className="mt-3 text-muted">{formatDate(event.start_datetime)}</p>
      <p className="text-muted">{event.venue_name} · {event.venue_address}</p>
      <p className="mt-6 leading-relaxed text-paper/90">{event.description}</p>

      <div className="mt-10 rounded-2xl border border-black/10 bg-surface p-6">
        {pendingRegistration ? (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 text-center">
            <h3 className="display text-xl text-paper">Thanks, {pendingRegistration}!</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your registration is under review. We&apos;ll email your entry pass once it&apos;s confirmed.
            </p>
          </div>
        ) : event.is_paid ? (
          <form onSubmit={handleBuyTicket} className="space-y-4">
            <h3 className="display text-xl text-paper">Buy tickets</h3>
            {isEventPast ? (
              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-5 text-center">
                <p className="font-semibold text-paper">This event has already taken place.</p>
                <p className="mt-1 text-sm text-muted">Ticket sales are concluded for past events.</p>
              </div>
            ) : availableTicketTypes.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">Ticket sales are closed for this event.</p>
                <p className="text-sm text-flame">{event.capacity && registrationCount >= event.capacity ? 'This event is already sold out.' : 'Check back when the next ticket window opens.'}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={selectedTicket}
                    onChange={(e) => setSelectedTicket(e.target.value)}
                    className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper"
                  >
                    {availableTicketTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {formatGHS(t.price)} ({Math.max(t.quantity_available - t.quantity_sold, 0)} left)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper"
                  />
                </div>
                <Fields form={form} setForm={setForm} phoneRequired />
                {ticket && (
                  <p className="text-sm text-muted">
                    Total: <span className="text-paper">{formatGHS(ticket.price * quantity)}</span> — paid directly to {event.organizations?.name}
                  </p>
                )}
                {error && <p className="text-sm text-flame">{error}</p>}
                <button
                  disabled={submitting}
                  className="w-full rounded-full bg-flame py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-60"
                >
                  {submitting ? 'Processing…' : 'Continue to payment'}
                </button>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <h3 className="display text-xl text-paper">Register — it's free</h3>
            {isEventPast ? (
              <div className="rounded-xl border border-black/10 bg-black/[0.02] p-5 text-center">
                <p className="font-semibold text-paper">This event has already taken place.</p>
                <p className="mt-1 text-sm text-muted">Registration is closed as this event has already concluded.</p>
              </div>
            ) : !registrationOpen ? (
              <p className="text-sm text-flame">
                {event.capacity && registrationCount >= event.capacity ? 'This event is sold out.' : 'Registration is not open for this event yet.'}
              </p>
            ) : (
              <>
                <Fields form={form} setForm={setForm} />
                {error && <p className="text-sm text-flame">{error}</p>}
                <button
                  disabled={submitting}
                  className="w-full rounded-full bg-gold py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-60"
                >
                  {submitting ? 'Registering…' : 'Register'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function isTicketOpen(ticket: TicketType) {
  const now = new Date()
  if (ticket.quantity_sold >= ticket.quantity_available) return false
  if (ticket.sales_start_at && new Date(ticket.sales_start_at).getTime() > now.getTime()) return false
  if (ticket.sales_end_at && new Date(ticket.sales_end_at).getTime() < now.getTime()) return false
  return true
}

function isRegistrationOpen(event: EventRow, registrationCount: number) {
  const now = new Date()
  if (event.capacity && registrationCount >= event.capacity) return false
  if (event.registration_starts_at && new Date(event.registration_starts_at).getTime() > now.getTime()) return false
  if (event.registration_ends_at && new Date(event.registration_ends_at).getTime() < now.getTime()) return false
  return true
}

function Fields({ form, setForm, phoneRequired = false }: { form: { name: string; email: string; phone: string; nickname: string; whatsapp_number: string; location: string }; setForm: (f: any) => void; phoneRequired?: boolean }) {
  return (
    <div className="grid gap-3">
      <input
        required
        placeholder="Full name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted"
        />
        <input
          required={phoneRequired}
          type="tel"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted"
        />
      </div>
      <input placeholder="Nickname (optional)" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input placeholder="WhatsApp number (optional)" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
        <input placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded-lg border border-black/15 bg-ink px-3 py-2 text-paper placeholder:text-muted" />
      </div>
    </div>
  )
}
