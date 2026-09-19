import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import confetti from 'canvas-confetti'
import { supabase, callFunction, sendConfirmationEmail } from '../lib/supabase'
import { generateAndDownloadReceiptsPdf } from '../lib/receipt'
import type { Order, EventRow } from '../lib/types'

type OrderWithEvent = Order & { events?: EventRow }

export default function CheckoutVerify() {
  const [params] = useSearchParams()
  const reference = params.get('reference') ?? params.get('trxref')
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking')
  const [ticketCodes, setTicketCodes] = useState<string[]>([])
  const [order, setOrder] = useState<OrderWithEvent | null>(null)

  useEffect(() => {
    async function verify() {
      if (!reference) { setStatus('failed'); return }
      try {
        const data = await callFunction('verify-payment', { reference })
        if (data.status === 'success') {
          setTicketCodes(Array.isArray(data.ticket_codes) ? data.ticket_codes : [])
          sendConfirmationEmail('order', data.order_id)
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
          setStatus('success')

          if (data.order_id) {
            const { data: orderData } = await supabase
              .from('orders')
              .select('*, events(*)')
              .eq('id', data.order_id)
              .maybeSingle()
            if (orderData) {
              setOrder(orderData as OrderWithEvent)
            }
          }
        } else {
          setStatus('failed')
        }
      } catch {
        setStatus('failed')
      }
    }
    verify()
  }, [reference])

  function handleDownloadReceipt() {
    if (ticketCodes.length === 0) return
    const receiptInfos = ticketCodes.map((ticketCode) => ({
        eventName: order?.events?.title || 'Event Ticket',
        eventDate: order?.events?.start_datetime,
        venueName: order?.events?.venue_name,
        venueAddress: order?.events?.venue_address,
        attendeeName: order?.buyer_full_name || 'Ticket Holder',
        code: ticketCode,
        type: 'ticket' as const,
        amount: order?.total_amount ? Number(order.total_amount) / ticketCodes.length : null,
        quantity: 1,
    }))
    const qrCanvases = ticketCodes.map((ticketCode) => document.getElementById(`qr-canvas-${ticketCode}`) as HTMLCanvasElement | null)
    generateAndDownloadReceiptsPdf(receiptInfos, qrCanvases)
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      {status === 'checking' && <p className="text-muted">Confirming your payment…</p>}

      {status === 'success' && ticketCodes.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="display mt-3 text-2xl font-semibold text-paper">Payment confirmed!</h1>
          <p className="mt-1 text-sm text-muted">
            {order?.events?.title ? `You're all set for ${order.events.title}.` : 'Show this code at the door.'}
          </p>

          {ticketCodes.length > 1 && <p className="mt-4 text-sm text-muted">Each ticket is checked in separately, so make sure everyone in your group has their own code.</p>}
          <div className="my-6 flex w-full flex-col items-center gap-4">
            {ticketCodes.map((ticketCode) => (
              <div key={ticketCode} className="flex w-full flex-col items-center justify-center rounded-2xl border border-black/10 bg-white p-5 shadow-xs">
                <QRCodeCanvas id={`qr-canvas-${ticketCode}`} value={ticketCode} size={170} />
                <p className="display mt-3 font-mono text-base font-bold tracking-wider text-flame">{ticketCode}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-flame px-6 py-2.5 text-sm font-medium text-ink shadow-xs transition hover:brightness-95 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Download receipt</span>
            </button>
            <p className="text-xs text-muted">Download one PDF containing every ticket QR code and event detail</p>
          </div>

          <div className="mt-8 border-t border-black/10 pt-5">
            <Link to="/" className="text-sm font-medium text-muted hover:text-paper">
              ← Return to Home
            </Link>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <>
          <h1 className="display text-2xl text-paper">We couldn't confirm this payment</h1>
          <p className="mt-2 text-sm text-muted">
            If money left your account, contact us with your reference — nothing was charged twice, and we can look it up.
          </p>
          <div className="mt-6">
            <Link to="/" className="rounded-full border border-black/15 px-5 py-2 text-sm font-medium text-paper hover:bg-black/5">
              Back to events
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
