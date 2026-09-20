import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { email, password, full_name } = await req.json()
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'email and password are required' }), { status: 400, headers: corsHeaders })
  }
  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters.' }), { status: 400, headers: corsHeaders })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'

  const { data: org } = await admin.from('organizations').select('id').eq('slug', 'uptown-city-vibe').single()
  if (!org) {
    return new Response(JSON.stringify({ error: 'Organization not found.' }), { status: 500, headers: corsHeaders })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (createError || !created.user) {
    return new Response(JSON.stringify({ error: createError?.message ?? 'Could not create account.' }), { status: 400, headers: corsHeaders })
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ organization_id: org.id, role: 'organizer_admin', access_status: 'pending' })
    .eq('id', created.user.id)

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), { status: 500, headers: corsHeaders })
  }

  // Create a confirmation token and email the person so THEY can accept or decline.
  const token = crypto.randomUUID().replace(/-/g, '')
  await admin.from('team_confirmations').insert({ profile_id: created.user.id, token })

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (RESEND_API_KEY) {
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'Uptown City Vibez <onboarding@resend.dev>'
    const link = `${FRONTEND_URL}/team-confirmation/${token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: "You've been added to Uptown City Vibez's team",
        html: `<p>Hi ${full_name ?? ''},</p><p>An admin has set up a dashboard account for you at Uptown City Vibez, using this email and a password they'll share with you separately.</p><p>Please confirm whether you'd like to accept this:</p><p><a href="${link}">Review and respond</a></p>`,
      }),
    }).catch(() => {})
  }

  return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
