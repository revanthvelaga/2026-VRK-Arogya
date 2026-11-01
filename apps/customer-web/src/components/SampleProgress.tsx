import type { CSSProperties } from 'react';
import type { Sample, SampleStatus } from '../api/types';
import { IconBuilding, IconCheckCircle, IconClock, IconFlask, IconTruck } from './Icons';

// Collapses the two AT_CENTER branches (IN_HOUSE_PROCESSING /
// ROUTED_TO_PARTNER_LAB) into one visual step — same idea as a courier
// tracking screen, where "out for delivery via X" is still one stage.
const STATUS_TO_STEP: Record<SampleStatus, number> = {
  BOOKED: 0,
  COLLECTED: 1,
  IN_TRANSIT_TO_CENTER: 2,
  AT_CENTER: 3,
  IN_HOUSE_PROCESSING: 4,
  ROUTED_TO_PARTNER_LAB: 4,
  RESULT_READY: 5,
  DELIVERED: 6,
};

function branchLabel(sample: Sample): string {
  if (sample.status === 'ROUTED_TO_PARTNER_LAB') return 'Partner lab';
  if (sample.status === 'IN_HOUSE_PROCESSING') return 'In-house';
  if (sample.status === 'RESULT_READY' || sample.status === 'DELIVERED') {
    return sample.routedToPartnerLabId ? 'Partner lab' : 'In-house';
  }
  return 'Processing';
}

function steps(sample: Sample) {
  return [
    { label: 'Booked', icon: IconFlask },
    { label: 'Collected', icon: IconCheckCircle },
    { label: 'In transit', icon: IconTruck },
    { label: 'At center', icon: IconBuilding },
    { label: branchLabel(sample), icon: IconClock },
    { label: 'Result ready', icon: IconCheckCircle },
    { label: 'Delivered', icon: IconCheckCircle },
  ];
}

// On a phone the steps run top to bottom like a courier timeline; on wider
// screens, left to right. When the page opens, the line fills from
// "Booked" up to where the sample is now, so the customer sees how far it
// has come; the current step keeps a slow pulse, and while the sample is
// on the road the truck rocks gently.
export function SampleProgress({ sample }: { sample: Sample }) {
  const current = STATUS_TO_STEP[sample.status];
  const items = steps(sample);
  const finished = sample.status === 'DELIVERED';

  return (
    <div className="progress-stepper" role="list" aria-label="Sample progress">
      {items.map((step, i) => {
        const state = i < current || (finished && i === current) ? 'done' : i === current ? 'active' : 'todo';
        const Icon = step.icon;
        const moving = state === 'active' && sample.status === 'IN_TRANSIT_TO_CENTER';
        return (
          <div
            className={`progress-step progress-step--${state}${moving ? ' progress-step--moving' : ''}`}
            role="listitem"
            aria-current={state === 'active' ? 'step' : undefined}
            key={step.label + i}
            style={{ '--i': i } as CSSProperties}
          >
            {i > 0 && (
              <div className="progress-connector">
                <span className="progress-connector-fill" />
              </div>
            )}
            <div className="progress-dot">
              <Icon size={13} />
            </div>
            <div className="progress-label">
              {step.label}
              {state === 'active' && <span className="progress-now">Now</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
