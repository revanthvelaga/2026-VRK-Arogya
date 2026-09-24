// How often each kind of test is usually repeated for someone keeping an
// eye on it — a reminder cadence, not medical advice. Matched on the
// test's name; anything unmatched defaults to once a year, and one-off
// tests (COVID) are never reminded.
const RULES: Array<[RegExp, number | null]> = [
  [/a1c|hba1c/i, 90],
  [/fasting blood sugar|\bfbs\b|glucose/i, 90],
  [/lipid/i, 180],
  [/thyroid|\btsh\b/i, 180],
  [/vitamin/i, 180],
  [/pap/i, 1095],
  [/dexa|bone density/i, 730],
  [/covid|rt-pcr/i, null],
];

export function retestIntervalDays(testName: string): number | null {
  for (const [re, days] of RULES) if (re.test(testName)) return days;
  return 365;
}
