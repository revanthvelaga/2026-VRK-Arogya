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

export function SampleProgress({ sample }: { sample: Sample }) {
  const current = STATUS_TO_STEP[sample.status];
  const items = steps(sample);

  return (
    <div className="progress-stepper" role="list">
      {items.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const Icon = step.icon;
        return (
          <div className={`progress-step progress-step--${state}`} role="listitem" key={step.label + i}>
            {i > 0 && <div className="progress-connector" />}
            <div className="progress-dot">
              <Icon size={13} />
            </div>
            <div className="progress-label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}
