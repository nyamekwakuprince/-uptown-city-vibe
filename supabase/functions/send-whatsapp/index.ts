import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function toWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, '')
  return digits.startsWith('+') ? `whatsapp:${digits}` : `whatsapp:+${digits}`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const FROM = Deno.env.get('TWILIO_WHATSAPP_FROM')

  if (!SID || !TOKEN || !FROM) {
    return new Response(JSON.stringify({ error: 'WhatsApp is not configured yet.' }), { status: 500, headers: corsHeaders })
  }

  const { member_id } = await req.json()
  if (!member_id) {
    return new Response(JSON.stringify({ error: 'member_id is required' }), { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: member } = await supabase.from('members').select('*').eq('id', member_id).single()

  if (!member || !member.whatsapp_number) {
    return new Response(JSON.stringify({ error: 'No WhatsApp number on file for this member.' }), { status: 404, headers: corsHeaders })
  }

  const body = `Hi ${member.first_name}, you're confirmed as a member of Uptown City Vibez! Your membership code is ${member.membership_code}.`

  const params = new URLSearchParams({
    From: FROM,
    To: toWhatsAppNumber(member.whatsapp_number),
    Body: body,
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${SID}:${TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  if (!res.ok) {
    const errText = await res.text()
    return new Response(JSON.stringify({ error: errText }), { status: 502, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
