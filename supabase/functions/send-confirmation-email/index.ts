import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const EMAIL_FROM = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'Uptown City Vibe <onboarding@resend.dev>'

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set')
    return new Response(JSON.stringify({ error: 'Email is not configured yet.' }), { status: 500, headers: corsHeaders })
  }

  const { type, record_id } = await req.json()
  if (!type || !record_id) {
    return new Response(JSON.stringify({ error: 'type and record_id are required' }), { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let to = ''
  let subject = ''
  let html = ''

  if (type === 'registration') {
    const { data: reg } = await supabase.from('registrations').select('*, events(title, start_datetime, venue_name)').eq('id', record_id).single()
    if (!reg || !reg.attendee_email) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    to = reg.attendee_email
    subject = `You're registered: ${reg.events?.title ?? 'Your event'}`
    html = `<p>Hi ${escapeHtml(reg.attendee_full_name)},</p><p>You're registered for <strong>${escapeHtml(reg.events?.title ?? '')}</strong>.</p><p>Your entry code: <strong>${escapeHtml(reg.registration_code)}</strong></p><p>Show this code at the door.</p>`
  } else if (type === 'order') {
    const { data: order } = await supabase.from('orders').select('*, events(title, start_datetime, venue_name)').eq('id', record_id).single()
    if (!order || !order.buyer_email) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    to = order.buyer_email
    subject = `Your ticket: ${order.events?.title ?? 'Your event'}`
    html = `<p>Hi ${escapeHtml(order.buyer_full_name)},</p><p>Your ticket for <strong>${escapeHtml(order.events?.title ?? '')}</strong> is confirmed.</p><p>Your ticket code: <strong>${escapeHtml(order.ticket_code)}</strong></p><p>Show this code at the door.</p>`
  } else if (type === 'membership') {
    const { data: member } = await supabase.from('members').select('*').eq('id', record_id).single()
    if (!member || !member.email) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    to = member.email
    subject = 'Thanks for applying to Uptown City Vibe'
    html = `<p>Hi ${escapeHtml(member.first_name)},</p><p>We've received your membership application. We'll notify you once it's confirmed.</p><p>Your reference code: <strong>${escapeHtml(member.membership_code)}</strong></p>`
  } else if (type === 'member_confirmed') {
    const { data: member } = await supabase.from('members').select('*').eq('id', record_id).single()
    if (!member || !member.email) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    to = member.email
    subject = "You're confirmed! Welcome to Uptown City Vibe"
    html = `<p>Hi ${escapeHtml(member.first_name)},</p><p>Great news — your membership is confirmed!</p><p>Your membership code: <strong>${escapeHtml(member.membership_code)}</strong></p>`
  } else if (type === 'team_approved') {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', record_id).single()
    if (!profile || !profile.email) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    to = profile.email
    subject = 'Your Uptown City Vibe dashboard access is confirmed'
    html = `<p>Hi ${escapeHtml(profile.full_name ?? '')},</p><p>An admin has confirmed your access — you can now sign in and use the dashboard.</p>`
  } else {
    return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400, headers: corsHeaders })
  }

  console.log('Attempting to send email to:', to, 'from:', EMAIL_FROM)

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    console.error('Resend API error:', resendRes.status, errText)
    return new Response(JSON.stringify({ error: errText }), { status: 502, headers: corsHeaders })
  }

  console.log('Email sent successfully to:', to)
  return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
