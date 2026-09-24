import { useState } from 'react'
import { supabase, shortCode, sendConfirmationEmail } from '../lib/supabase'

const initialForm = {
  first_name: '', last_name: '', nickname: '', whatsapp_number: '',
  call_number: '', email: '', location: '', reason: '',
}

export default function Membership() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function field(key: keyof typeof initialForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'uptown-city-vibe').single()
    if (!org) { setError('Something went wrong. Please try again.'); setSubmitting(false); return }

    const code = shortCode('MEM')
    const id = crypto.randomUUID()
    const { error: insertError } = await supabase.from('members').insert({
      id,
      organization_id: org.id,
      first_name: form.first_name,
      last_name: form.last_name,
      nickname: form.nickname || null,
      whatsapp_number: form.whatsapp_number || null,
      call_number: form.call_number || null,
      email: form.email || null,
      location: form.location || null,
      reason: form.reason || null,
      membership_code: code,
    })

    setSubmitting(false)
    if (insertError) { setError('Something went wrong. Please try again.'); return }
    sendConfirmationEmail('membership', id)
    setSubmitted(true)
  }

  const inputClass = "w-full rounded-lg border border-black/15 bg-surface px-3 py-3 text-base text-paper placeholder:text-muted"

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="display text-3xl text-paper">Become a member</h1>
      <p className="mt-2 text-muted">Join the Uptown Vibez City community.</p>

      <div className="mt-8 rounded-2xl border border-black/10 bg-surface/50 p-6">
        {submitted ? (
          <div className="text-center">
            <h3 className="display text-xl text-paper">Thanks, {form.first_name}!</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Your membership application is under review. We'll notify you by email or WhatsApp once it's confirmed.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="First name" value={form.first_name} onChange={(e) => field('first_name', e.target.value)} className={inputClass} />
              <input required placeholder="Last name" value={form.last_name} onChange={(e) => field('last_name', e.target.value)} className={inputClass} />
            </div>
            <input placeholder="Nickname (what we should call you on WhatsApp)" value={form.nickname} onChange={(e) => field('nickname', e.target.value)} className={`w-full ${inputClass}`} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input placeholder="WhatsApp number" value={form.whatsapp_number} onChange={(e) => field('whatsapp_number', e.target.value)} className={inputClass} />
              <input placeholder="Phone number (for calls)" value={form.call_number} onChange={(e) => field('call_number', e.target.value)} className={inputClass} />
            </div>
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => field('email', e.target.value)} className={`w-full ${inputClass}`} />
            <input placeholder="Where do you stay?" value={form.location} onChange={(e) => field('location', e.target.value)} className={`w-full ${inputClass}`} />
            <textarea
              placeholder="Why do you want to become a member?"
              value={form.reason}
              onChange={(e) => field('reason', e.target.value)}
              rows={4}
              className={`w-full ${inputClass}`}
            />
            {error && <p className="text-sm text-flame">{error}</p>}
            <button disabled={submitting} className="w-full rounded-full bg-gold py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Join now'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
