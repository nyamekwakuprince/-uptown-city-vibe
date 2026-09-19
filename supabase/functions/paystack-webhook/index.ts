import { createClient } from 'jsr:@supabase/supabase-js@2'

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!PAYSTACK_SECRET_KEY) {
    return new Response('Not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')
  const expected = await hmacSha512Hex(PAYSTACK_SECRET_KEY, rawBody)

  if (!signature || signature !== expected) {
    return new Response('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'charge.success') {
    const tx = event.data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase.from('orders').select('*').eq('id', tx.reference).single()
    if (order) {
      const expectedAmount = Math.round(Number(order.total_amount) * 100)
      if (tx.amount === expectedAmount && tx.currency === 'GHS' && tx.status === 'success') {
        await supabase.rpc('mark_order_paid', { p_order_id: order.id, p_provider_reference: tx.reference })
      }
    }
  }

  return new Response('ok', { status: 200 })
})
