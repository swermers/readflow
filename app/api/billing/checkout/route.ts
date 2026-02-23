export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getTokenPack } from '@/utils/tokenPacks';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const packId = body?.packId as string | undefined;

  if (!packId) {
    return NextResponse.json({ error: 'packId is required' }, { status: 400 });
  }

  const pack = getTokenPack(packId);
  if (!pack) {
    return NextResponse.json({ error: 'Invalid token pack' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: pack.priceCents,
          product_data: {
            name: `${pack.name} Token Pack`,
            description: `${pack.tokens} AI tokens for ReadFlow`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: user.id,
      pack_id: pack.id,
      tokens: String(pack.tokens),
    },
    success_url: `${appUrl}/settings?purchase=success&tokens=${pack.tokens}`,
    cancel_url: `${appUrl}/settings?purchase=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
