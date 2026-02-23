export type TokenPack = {
  id: string;
  name: string;
  tokens: number;
  priceUsd: number;       // in dollars
  priceCents: number;     // in cents for Stripe
  perTokenCents: number;  // cost per token in cents
  badge?: string;
};

export const TOKEN_PACKS: TokenPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    tokens: 100,
    priceUsd: 4,
    priceCents: 400,
    perTokenCents: 4,
  },
  {
    id: 'standard',
    name: 'Standard',
    tokens: 500,
    priceUsd: 12,
    priceCents: 1200,
    perTokenCents: 2.4,
    badge: 'Best Value',
  },
  {
    id: 'power',
    name: 'Power',
    tokens: 1500,
    priceUsd: 29,
    priceCents: 2900,
    perTokenCents: 1.93,
  },
];

export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find((p) => p.id === id);
}
