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
    priceUsd: 3,
    priceCents: 300,
    perTokenCents: 3,
  },
  {
    id: 'standard',
    name: 'Standard',
    tokens: 500,
    priceUsd: 10,
    priceCents: 1000,
    perTokenCents: 2,
    badge: 'Best Value',
  },
  {
    id: 'power',
    name: 'Power',
    tokens: 1500,
    priceUsd: 25,
    priceCents: 2500,
    perTokenCents: 1.67,
  },
];

export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find((p) => p.id === id);
}
