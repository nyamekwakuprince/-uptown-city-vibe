import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { callFunction, formatDate, formatGHS, supabase, shortCode } from '../lib/supabase'

type CheckoutState = {
  event: { id: string; title: string; start_datetime: string; venue_name: string; venue_address: string }
  ticket: { id: string; name: string; price: number; admits_count?: number | null }
  quantity: number
  form: { name: string; email: string; phone: string; nickname: string; whatsapp_number: string; location: string }
}

export default function CheckoutReview() {
  const location = useLocation()
  const navigate = useNavigate()
  const checkoutState = location.state as CheckoutState | null
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!checkoutState?.event || !checkoutState.ticket || !checkoutState.form) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="display text-2xl text-paper">Checkout details not found</h1>
        <p className="mt-2 text-sm text-muted">Please return to the event and start checkout again.</p>
        <button type="button" onClick={() => navigate('/all-events')} className="mt-6 rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-ink">
          Browse events
        </button>
      </main>
    )
  }

  const checkout = checkoutState
  const ticketBaseAmount = checkout.ticket.price * checkout.quantity
  const serviceFee = Math.round(ticketBaseAmount * 0.07 * 100) / 100
  const paymentTotal = Math.round((ticketBaseAmount + serviceFee) * 100) / 100

  async function handleConfirm() {
    setSubmitting(true)
    setError('')
    const orderId = crypto.randomUUID()
    const { error: insertError } = await supabase.from('orders').insert({
      id: orderId,
      event_id: checkout.event.id,
      ticket_type_id: checkout.ticket.id,
      buyer_full_name: checkout.form.name,
      buyer_email: checkout.form.email,
      buyer_phone: checkout.form.phone,
      nickname: checkout.form.nickname || null,
      whatsapp_number: checkout.form.whatsapp_number || null,
      location: checkout.form.location || null,
      quantity: checkout.quantity,
      total_amount: paymentTotal,
      payment_status: 'pending',
    })

    if (insertError) {
      setSubmitting(false)
      setError(`Could not create order: ${insertError.message}`)
      return
    }

    const ticketCodes = new Set<string>()
    while (ticketCodes.size < checkout.quantity) ticketCodes.add(shortCode('TIX'))
    const ticketRows = Array.from(ticketCodes, (ticketCode) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      ticket_code: ticketCode,
      max_admits: Math.max(checkout.ticket.admits_count || 1, 1),
    }))
    const { error: ticketInsertError } = await supabase.from('tickets').insert(ticketRows)

    if (ticketInsertError) {
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

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-5">
      <button type="button" onClick={() => navigate(-1)} className="mb-6 text-sm text-muted hover:text-paper">
        ← Back to ticket details
      </button>
      <div className="rounded-2xl border border-black/10 bg-surface p-6 sm:p-8">
        <p className="text-sm text-muted">Step 2 of 2</p>
        <h1 className="display mt-1 text-3xl text-paper">Review your purchase</h1>
        <p className="mt-2 text-sm text-muted">Check your tickets and buyer details before continuing to Paystack.</p>

        <div className="mt-8 border-b border-black/10 pb-5">
          <h2 className="display text-xl text-paper">{checkout.event.title}</h2>
          <p className="mt-2 text-sm text-muted">{formatDate(checkout.event.start_datetime)}</p>
          <p className="text-sm text-muted">{checkout.event.venue_name} · {checkout.event.venue_address}</p>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4 text-muted"><span>Ticket type</span><span className="text-right text-paper">{checkout.ticket.name}</span></div>
          <div className="flex justify-between gap-4 text-muted"><span>Number of tickets</span><span className="text-paper">{checkout.quantity}</span></div>
          <div className="flex justify-between gap-4 text-muted"><span>Ticket price</span><span className="text-paper">{formatGHS(ticketBaseAmount)}</span></div>
          <div className="flex justify-between gap-4 text-muted"><span>Service charge</span><span className="text-paper">{formatGHS(serviceFee)}</span></div>
          <div className="flex justify-between gap-4 border-t border-black/10 pt-3 font-semibold text-paper"><span>Total to pay</span><span>{formatGHS(paymentTotal)}</span></div>
        </div>

        <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm">
          <h2 className="font-semibold text-paper">Buyer details</h2>
          <p className="mt-2 text-muted">{checkout.form.name}</p>
          <p className="text-muted">{checkout.form.email}</p>
          <p className="text-muted">{checkout.form.phone}</p>
          {checkout.form.nickname && <p className="text-muted">Nickname: {checkout.form.nickname}</p>}
          {checkout.form.whatsapp_number && <p className="text-muted">WhatsApp: {checkout.form.whatsapp_number}</p>}
          {checkout.form.location && <p className="text-muted">Location: {checkout.form.location}</p>}
        </div>

        {error && <p className="mt-4 text-sm text-flame">{error}</p>}
        <button type="button" onClick={handleConfirm} disabled={submitting} className="mt-6 w-full rounded-full bg-flame py-3 font-medium text-ink hover:brightness-95 disabled:opacity-60">
          {submitting ? 'Preparing payment…' : 'Confirm and continue to Paystack'}
        </button>
      </div>
    </main>
  )
}
