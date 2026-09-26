// Believable targets for home measures, in the units the app records
// them in. A fasting sugar goal of "5.2" is almost certainly mmol/L typed
// into an mg/dL field — reject it with a hint instead of storing it.
export const GOAL_LIMITS: Record<string, { min: number; max: number; unit: string; hint?: string }> = {
  WEIGHT: { min: 2, max: 300, unit: 'kg' },
  SUGAR_FASTING: { min: 50, max: 400, unit: 'mg/dL', hint: 'Fasting sugar targets are usually 70–130 mg/dL. If your meter shows mmol/L, multiply by 18.' },
  SUGAR_RANDOM: { min: 50, max: 600, unit: 'mg/dL', hint: 'If your meter shows mmol/L, multiply by 18.' },
  BP: { min: 70, max: 250, unit: 'mmHg', hint: 'Use the top (systolic) number, e.g. 130.' },
  PULSE: { min: 30, max: 220, unit: 'bpm' },
};

export function goalTargetProblem(metric: string, target: number): string | null {
  const lim = GOAL_LIMITS[metric];
  if (!lim || (target >= lim.min && target <= lim.max)) return null;
  return `A target of ${target} ${lim.unit} doesn't look right — it should be between ${lim.min} and ${lim.max} ${lim.unit}.${lim.hint ? ` ${lim.hint}` : ''}`;
}
