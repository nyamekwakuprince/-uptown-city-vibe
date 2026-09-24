import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
  const configuredFrontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:5173'
  const requestOrigin = req.headers.get('origin')
  const frontendUrl = requestOrigin && /^https?:\/\//.test(requestOrigin)
    ? requestOrigin
    : configuredFrontendUrl

  if (!PAYSTACK_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payments are not configured yet (missing PAYSTACK_SECRET_KEY).' }), { status: 500, headers: corsHeaders })
  }

  const { order_id } = await req.json()
  if (!order_id) {
    return new Response(JSON.stringify({ error: 'order_id is required' }), { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order_id)
    .single()

  if (error || !order) {
    return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404, headers: corsHeaders })
  }

  if (order.payment_status === 'paid') {
    return new Response(JSON.stringify({ error: 'This order has already been paid.' }), { status: 400, headers: corsHeaders })
  }

  if (!order.buyer_email) {
    return new Response(JSON.stringify({ error: 'An email address is required to pay.' }), { status: 400, headers: corsHeaders })
  }

  const amountInPesewas = Math.round(Number(order.total_amount) * 100)

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: order.buyer_email,
      amount: amountInPesewas,
      currency: 'GHS',
      reference: order.id,
      callback_url: `${frontendUrl.replace(/\/$/, '')}/checkout/verify`,
      metadata: { order_id: order.id, event_id: order.event_id },
    }),
  })

  const paystackData = await paystackRes.json()

  if (!paystackRes.ok || !paystackData.status) {
    return new Response(JSON.stringify({ error: paystackData.message ?? 'Could not start payment.' }), { status: 502, headers: corsHeaders })
  }

  return new Response(JSON.stringify({
    authorization_url: paystackData.data.authorization_url,
    reference: paystackData.data.reference,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
