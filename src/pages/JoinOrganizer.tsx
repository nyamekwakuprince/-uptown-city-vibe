import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function JoinOrganizer() {
  const { token } = useParams()
  const { session, refreshProfile } = useAuth()
  const [orgName, setOrgName] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.rpc('get_invite_info', { invite_token: token })
      if (!data || data.length === 0) setInvalid(true)
      else setOrgName(data[0]?.organization_name ?? null)
      setChecking(false)
    }
    check()
  }, [token])

  async function redeem() {
    const { data, error } = await supabase.rpc('redeem_invite', { invite_token: token })
    if (error || !data) { setError('This invite link has already been used or is invalid.'); return }
    await refreshProfile()
    setSuccess(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (session) {
      // already signed in — just redeem against this account
      await redeem()
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } },
    })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    await redeem()
    setLoading(false)
  }

  if (checking) return <p className="mx-auto max-w-sm px-5 py-20 text-muted">Checking your invite…</p>
  if (invalid) return <p className="mx-auto max-w-sm px-5 py-20 text-flame">This invite link is invalid or has already been used.</p>
  if (success) return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <p className="text-sm uppercase tracking-widest text-flame">Account created</p>
      <h1 className="display mt-2 text-3xl text-paper">You&apos;re almost there</h1>
      <p className="mt-3 leading-relaxed text-muted">Your account has been created! It&apos;s awaiting admin approval — you&apos;ll be notified once it&apos;s confirmed.</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <p className="text-sm uppercase tracking-widest text-flame">Private invite</p>
      <h1 className="display mt-2 text-3xl text-paper">Set up {orgName}</h1>
      <p className="mt-2 text-muted">
        {session
          ? 'You are signed in — confirm below to link this organization to your account.'
          : "Create the login you'll use to manage your events."}
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {!session && (
          <>
            <input required placeholder="Your full name" value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
            <input required type="email" placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
            <input required type="password" placeholder="Choose a password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted" />
          </>
        )}
        {error && <p className="text-sm text-flame">{error}</p>}
        <button disabled={loading} className="w-full rounded-full bg-gold py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-60">
          {loading ? 'Setting up…' : session ? 'Link this organization to my account' : 'Create account & claim'}
        </button>
      </form>
    </div>
  )
}
