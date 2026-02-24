export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    const userId = session.metadata?.user_id;
    const tokens = parseInt(session.metadata?.tokens || '0', 10);
    const packId = session.metadata?.pack_id || 'unknown';

    if (!userId || tokens <= 0) {
      console.error('Webhook: missing user_id or tokens in session metadata', session.id);
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('credit_wallet_tokens', {
      p_user_id: userId,
      p_tokens: tokens,
      p_type: 'purchase',
      p_description: `${packId} pack (${tokens} tokens)`,
      p_stripe_session_id: session.id,
    });

    if (error) {
      console.error('Webhook: failed to credit tokens', error);
      return NextResponse.json({ error: 'Credit failed' }, { status: 500 });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (row && row.reason === 'Already credited') {
      // Idempotent — already processed
      return NextResponse.json({ received: true, deduplicated: true });
    }
  }

  return NextResponse.json({ received: true });
}
