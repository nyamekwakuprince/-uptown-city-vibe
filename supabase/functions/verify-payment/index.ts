import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const reference = url.searchParams.get('reference') ?? (await req.json().catch(() => ({})))?.reference

  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!PAYSTACK_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payments are not configured yet.' }), { status: 500, headers: corsHeaders })
  }
  if (!reference) {
    return new Response(JSON.stringify({ error: 'reference is required' }), { status: 400, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order } = await supabase.from('orders').select('*').eq('id', reference).single()
  if (!order) {
    return new Response(JSON.stringify({ status: 'not_found' }), { status: 404, headers: corsHeaders })
  }

  async function successResponse() {
    const { data: tickets } = await supabase.from('tickets').select('ticket_code').eq('order_id', order.id).order('created_at', { ascending: true })
    return new Response(JSON.stringify({ status: 'success', order_id: order.id, ticket_codes: (tickets ?? []).map((ticket) => ticket.ticket_code) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (order.payment_status === 'paid') return successResponse()

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  })
  const verifyData = await verifyRes.json()

  if (!verifyRes.ok || !verifyData.status) {
    return new Response(JSON.stringify({ status: 'failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const tx = verifyData.data
  const expectedAmount = Math.round(Number(order.total_amount) * 100)

  if (tx.status !== 'success') {
    return new Response(JSON.stringify({ status: tx.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (Number(tx.amount) !== expectedAmount || String(tx.currency).toUpperCase() !== 'GHS') {
    return new Response(JSON.stringify({ status: 'mismatch' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: confirmed } = await supabase.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_provider_reference: tx.reference,
  })

  if (!confirmed) {
    return new Response(JSON.stringify({ status: 'failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return successResponse()
})
