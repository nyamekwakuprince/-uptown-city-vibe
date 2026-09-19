import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)

export const supabase = createClient(url, key)

export function shortCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function formatGHS(amount: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export async function callFunction(name: string, body: unknown) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export function sendConfirmationEmail(type: 'registration' | 'order' | 'membership' | 'member_confirmed' | 'team_approved', recordId: string) {
  callFunction('send-confirmation-email', { type, record_id: recordId })
    .then(() => console.log('[email] sent successfully:', type, recordId))
    .catch((err) => console.error('[email] failed:', type, recordId, err))
}
