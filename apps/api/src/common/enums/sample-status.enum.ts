// Mirrors the `sample_status` Postgres enum in schema.sql — the physical
// specimen's lifecycle from booking to delivered report.
export enum SampleStatus {
  BOOKED = 'BOOKED',
  COLLECTED = 'COLLECTED',
  IN_TRANSIT_TO_CENTER = 'IN_TRANSIT_TO_CENTER',
  AT_CENTER = 'AT_CENTER',
  IN_HOUSE_PROCESSING = 'IN_HOUSE_PROCESSING',
  ROUTED_TO_PARTNER_LAB = 'ROUTED_TO_PARTNER_LAB',
  RESULT_READY = 'RESULT_READY',
  DELIVERED = 'DELIVERED',
}
