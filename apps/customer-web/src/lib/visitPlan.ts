import type { PackageTier, Test } from '../api/types';

export const TIER_LABEL: Record<PackageTier, string> = {
  BASIC: 'Basic',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
};

export interface VisitStep {
  when: string;
  title: string;
  detail: string;
}

const FASTING = /(\d+)\s*-\s*(\d+)\s*hours? fasting (required|recommended)/i;

// What the day of a checkup actually looks like for this set of tests —
// the night before, the visit itself, and when reports arrive — built from
// each test's own sample type, preparation notes and turnaround, so it
// stays right as the catalog changes.
export function buildVisitPlan(tests: Test[]): VisitStep[] {
  const steps: VisitStep[] = [];
  // The longest fast any included test asks for, as its own "9-12" range.
  const fast = tests
    .map((t) => t.preparationInstructions?.match(FASTING))
    .filter((m): m is RegExpMatchArray => m != null)
    .map((m) => ({ lo: Number(m[1]), hi: Number(m[2]) }))
    .sort((a, b) => b.hi - a.hi)[0];
  const maxFast = fast?.hi ?? 0;

  steps.push(
    maxFast
      ? {
          when: 'Night before',
          title: `Fast for ${fast!.lo}–${fast!.hi} hours`,
          detail: 'Finish dinner early, then only water. Keep taking regular medicines unless your doctor says otherwise.',
        }
      : {
          when: 'Night before',
          title: 'No fasting needed',
          detail: 'Eat and drink normally. We will send you a reminder the day before.',
        },
  );

  const types = new Set(tests.map((t) => (t.sampleType ?? '').toLowerCase()));
  const parts: string[] = [];
  let minutes = 0;
  if ([...types].some((t) => t.includes('blood'))) {
    parts.push('one blood draw for all blood tests');
    minutes += 5;
  }
  if ([...types].some((t) => t.includes('urine'))) {
    parts.push('a urine sample');
    minutes += 5;
  }
  if ([...types].some((t) => t.includes('swab'))) {
    parts.push('a quick swab');
    minutes += 5;
  }
  if ([...types].some((t) => t.includes('non-invasive'))) {
    parts.push('a painless scan at the centre');
    minutes += 20;
  }
  steps.push({
    when: 'Morning visit',
    title: `About ${Math.max(minutes, 5)} minutes`,
    detail: parts.length ? `Includes ${parts.join(', ')}.` : 'Sample collection at home or at the centre.',
  });

  if (maxFast) {
    steps.push({
      when: 'Right after',
      title: 'Have breakfast',
      detail: "You're done fasting as soon as the sample is taken.",
    });
  }

  const turnaround = tests.length ? Math.max(...tests.map((t) => t.turnaroundHours)) : 24;
  steps.push({
    when: turnaround <= 24 ? 'Same / next day' : `Within ${Math.ceil(turnaround / 24)} days`,
    title: 'Reports in the app',
    detail: `All results within ${turnaround} hours, with trends and plain-language explanations on Insights.`,
  });
  return steps;
}
