// Kept to a few meaningful milestones, not every possible event — nobody
// wants a push for every intermediate sample status.
export enum NotificationType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  SAMPLE_COLLECTED = 'SAMPLE_COLLECTED',
  RESULT_READY = 'RESULT_READY',
  REPORT_READY = 'REPORT_READY',
  ISSUE_UPDATED = 'ISSUE_UPDATED',
  AGENT_ON_THE_WAY = 'AGENT_ON_THE_WAY',
  PREP_REMINDER = 'PREP_REMINDER',
  RETEST_DUE = 'RETEST_DUE',
  CARE_INVITE = 'CARE_INVITE',
}
