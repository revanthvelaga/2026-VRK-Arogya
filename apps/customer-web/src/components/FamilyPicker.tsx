import type { CSSProperties } from 'react';
import type { Patient } from '../api/types';
import { formatCurrency } from '../lib/format';
import { FAMILY_TIERS, familyPercentOff } from '../lib/familyPricing';
import { IconCheckCircle, IconLock } from './Icons';
import { PersonAvatar, ageOf } from './PersonAvatar';

function relationLabel(p: Patient): string {
  return p.relationship === 'SELF' ? 'You' : p.relationship.charAt(0) + p.relationship.slice(1).toLowerCase();
}

// Who is getting this test: a chip per family member. More people on the
// same test means a lower price each, shown on the ladder underneath.
export function FamilyPicker({
  patients,
  selected,
  onChange,
  price,
}: {
  patients: Patient[];
  selected: string[];
  onChange: (ids: string[]) => void;
  price: number;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return; // someone has to get the test
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="family-picker">
      <div className="family-chips" role="group" aria-label="Who is getting this test">
        {patients.map((p, i) => {
          const on = selected.includes(p.id);
          return (
            <button
              type="button"
              key={p.id}
              className={`family-chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(p.id)}
            >
              <span className="family-avatar">
                <PersonAvatar patient={p} index={i} size={32} />
                <span className="family-avatar-check" aria-hidden="true">
                  <IconCheckCircle size={14} />
                </span>
              </span>
              <span className="family-chip-text">
                <b>{p.fullName.replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(' ')[0]}</b>
                <small>
                  {relationLabel(p)}
                  {ageOf(p) != null ? ` · ${ageOf(p)}` : ''}
                </small>
              </span>
            </button>
          );
        })}
      </div>
      <FamilyLadder price={price} people={selected.length} />
    </div>
  );
}

// 1 → 2 → 3 → 4+ people, with the price each at every step. The line
// fills to how many are picked; steps not reached yet show a lock.
export function FamilyLadder({ price, people }: { price: number; people: number }) {
  const steps = [{ people: 1, percentOff: 0 }, ...FAMILY_TIERS];
  const reachedIndex = Math.min(people, 4) - 1;
  const pct = familyPercentOff(people);
  const next = FAMILY_TIERS.find((t) => t.people > people);
  const saved = Math.round(price * people * pct) / 100;

  return (
    <div className="family-ladder">
      <div className="family-ladder-head" aria-live="polite">
        {pct > 0 ? (
          // Keyed on the tier, so the badge pops each time a new tier is reached.
          <span className="family-saved" key={pct}>
            Family deal: {pct}% off each · you save {formatCurrency(saved)}
          </span>
        ) : (
          <span className="family-nudge">Add a family member and pay less each</span>
        )}
        {next && pct > 0 && (
          <span className="family-next">
            +{next.people - people} more → {next.percentOff}% off
          </span>
        )}
      </div>
      <div className="family-track" style={{ '--fill': reachedIndex / (steps.length - 1) } as CSSProperties}>
        <div className="family-track-line">
          <span className="family-track-fill" />
        </div>
        {steps.map((s, i) => {
          const state = i < reachedIndex ? 'done' : i === reachedIndex ? 'current' : 'locked';
          return (
            <div className={`family-step family-step--${state}`} key={s.people}>
              <span className="family-node">{state === 'locked' ? <IconLock size={10} /> : null}</span>
              <span className="family-step-price">{formatCurrency(Math.round(price * (100 - s.percentOff)) / 100)}</span>
              <span className="family-step-people">
                {s.people === 4 ? '4+' : s.people} {s.people === 1 ? 'person' : 'people'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
