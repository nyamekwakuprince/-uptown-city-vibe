import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TeamConfirmation() {
  const { token } = useParams()
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function respond(accept: boolean) {
    if (!token) return
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('respond_to_team_confirmation', {
      p_token: token,
      p_accept: accept,
    })
    setLoading(false)
    if (rpcError || data === false || data == null) {
      setError('This team confirmation link is invalid or has already been used.')
      return
    }
    setResult(accept ? 'accepted' : 'declined')
  }

  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center">
      {result ? (
        <>
          <h1 className="display text-3xl text-paper">{result === 'accepted' ? "You're all set" : "Invitation declined"}</h1>
          <p className="mt-3 text-muted">
            {result === 'accepted' ? 'You can now sign in to manage the organization dashboard.' : "You've declined this invitation."}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm uppercase tracking-widest text-flame">Team access</p>
          <h1 className="display mt-2 text-3xl text-paper">You’ve been added to Uptown City Vibe’s team</h1>
          <p className="mt-3 text-muted">Do you want to accept this team invitation?</p>
          {error && <p className="mt-4 text-sm text-flame">{error}</p>}
          <div className="mt-8 flex justify-center gap-3">
            <button disabled={loading} onClick={() => respond(true)} className="rounded-full bg-gold px-5 py-2.5 font-medium text-ink disabled:opacity-60">{loading ? 'Accepting…' : 'Accept'}</button>
            <button disabled={loading} onClick={() => respond(false)} className="rounded-full border border-flame/40 px-5 py-2.5 font-medium text-flame disabled:opacity-60">{loading ? 'Declining…' : 'Decline'}</button>
          </div>
        </>
      )}
    </div>
  )
}
