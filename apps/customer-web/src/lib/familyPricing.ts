// Family deal, mirrored from the API (apps/api/src/bookings/family-pricing.ts)
// so the cart can preview it — the server recomputes every figure.
//   1 person: full price · 2: 10% off each · 3: 15% · 4 or more: 20%
export const FAMILY_TIERS = [
  { people: 2, percentOff: 10 },
  { people: 3, percentOff: 15 },
  { people: 4, percentOff: 20 },
];

export function familyPercentOff(people: number): number {
  let pct = 0;
  for (const t of FAMILY_TIERS) if (people >= t.people) pct = t.percentOff;
  return pct;
}

export const MAX_FAMILY_DISCOUNT = FAMILY_TIERS[FAMILY_TIERS.length - 1].percentOff;
