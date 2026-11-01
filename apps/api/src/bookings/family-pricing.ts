// Family deal: the same test or package booked for more people in one
// checkout costs less per person. Kept in one place so the cart preview
// (customer-web/src/lib/familyPricing.ts mirrors it) and the server agree.
//   1 person: full price · 2: 10% off each · 3: 15% · 4 or more: 20%
export const FAMILY_TIERS: Array<{ people: number; percentOff: number }> = [
  { people: 2, percentOff: 10 },
  { people: 3, percentOff: 15 },
  { people: 4, percentOff: 20 },
];

export const MAX_FAMILY_MEMBERS = 8;

export function familyPercentOff(people: number): number {
  let pct = 0;
  for (const t of FAMILY_TIERS) if (people >= t.people) pct = t.percentOff;
  return pct;
}
