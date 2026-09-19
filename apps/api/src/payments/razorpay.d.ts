// razorpay ships no type declarations of its own — this ambient module
// keeps it usable (typed as `any`) without pulling in a hand-maintained
// third-party .d.ts for a handful of calls (orders.create, signature
// verification) that PaymentsService wraps behind its own typed methods.
declare module 'razorpay';
