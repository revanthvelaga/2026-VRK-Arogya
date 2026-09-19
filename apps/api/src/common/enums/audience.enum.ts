// Who a test/package is primarily aimed at — drives the "shop by category"
// suggestions on the customer site. EVERYONE is the default: most tests
// aren't gender/age specific, and still show up regardless of which
// audience tile a customer came in through.
export enum Audience {
  EVERYONE = 'EVERYONE',
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  CHILDREN = 'CHILDREN',
  SENIOR_MEN = 'SENIOR_MEN',
  SENIOR_WOMEN = 'SENIOR_WOMEN',
  FITNESS = 'FITNESS',
}
