import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <h1 className="display text-3xl text-paper">Welcome back</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-black/15 bg-surface px-3 py-2 text-paper placeholder:text-muted"
        />
        {error && <p className="text-sm text-flame">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-full bg-gold py-2.5 font-medium text-ink hover:brightness-95 disabled:opacity-60"
        >
          {loading ? 'Please wait…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
