import { Link } from 'react-router-dom';
import { IconChevronRight, IconSmartphone } from './Icons';
import { appCanWellbeing, fmtMinutes, loadGoal, scoreTone, sumReels, useWellbeing, wellbeingScore } from '../lib/wellbeing';

// A small entry card on Insights: today's screen time when the app can
// measure it, otherwise just the way in.
export function WellbeingTeaser() {
  const { state } = useWellbeing();
  let line = 'Screen time, reels swiped and how it affects your health';
  let tone = '';
  if (appCanWellbeing && state.kind === 'ready' && state.data.usageAccess) {
    const today = state.data.days[state.data.days.length - 1];
    const score = wellbeingScore(today.total, loadGoal(), sumReels(today));
    const t = scoreTone(score);
    tone = t.tone;
    const reels = sumReels(today);
    line = `${fmtMinutes(today.total)} today${state.data.reelsAccess ? ` · ${reels} reels` : ''} · ${t.label}`;
  } else if (appCanWellbeing && state.kind === 'ready') {
    line = 'Turn on screen-time access to see your day';
  }
  return (
    <Link to="/wellbeing" className={`card wb-teaser ${tone}`}>
      <span className="wb-teaser-icon">
        <IconSmartphone size={20} />
      </span>
      <span className="wb-teaser-text">
        <b>Digital wellbeing</b>
        <small>{line}</small>
      </span>
      <IconChevronRight size={16} />
    </Link>
  );
}
