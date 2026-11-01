import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import type { Medicine, MedicineTiming, Patient } from '../api/types';
import { appCanReminders, inArogyaApp, nativeBridge } from '../lib/inApp';
import { IconBell2, IconMoon, IconSun, IconSunrise, IconSunset } from './Icons';

type Times = Record<MedicineTiming, string>;
interface Status {
  enabled: boolean;
  times: Times;
  scheduled?: number;
  permission?: boolean;
}

const SLOTS: Array<{ value: MedicineTiming; label: string; Icon: ComponentType<{ size?: number }> }> = [
  { value: 'MORNING', label: 'Morning', Icon: IconSunrise },
  { value: 'AFTERNOON', label: 'Afternoon', Icon: IconSun },
  { value: 'EVENING', label: 'Evening', Icon: IconSunset },
  { value: 'NIGHT', label: 'Night', Icon: IconMoon },
];
const DEFAULT_TIMES: Times = { MORNING: '08:00', AFTERNOON: '13:00', EVENING: '19:00', NIGHT: '21:30' };

const send = (msg: Record<string, unknown>) => nativeBridge?.postMessage(JSON.stringify(msg));

// Keeps the phone's reminders in step with this person's medicine list,
// whenever the list changes. Safe to call from a browser (does nothing).
export function useSyncReminders(patient: Patient | undefined, meds: Medicine[] | null) {
  useEffect(() => {
    if (!appCanReminders || !patient || !meds) return;
    send({
      type: 'medicine-reminders',
      patientId: patient.id,
      patientName: patient.fullName,
      self: patient.relationship === 'SELF' && !patient.sharedBy,
      medicines: meds.map((m) => ({ name: m.name, dosage: m.dosage, timings: m.timings, food: m.food, active: m.isActive })),
    });
  }, [patient, meds]);
}

// Reminders on this phone: on/off, the four times, and a test sound.
// Only in the Arogya app — a website can't ring at 8 am every day.
export function MedicineReminders({ hasTimed }: { hasTimed: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appCanReminders) return;
    const onStatus = (e: Event) => {
      try {
        setStatus(JSON.parse(String((e as CustomEvent<string>).detail)) as Status);
      } catch {
        // ignore
      }
      setSaving(false);
    };
    window.addEventListener('arogya-reminders-status', onStatus);
    send({ type: 'medicine-reminders-get' });
    return () => window.removeEventListener('arogya-reminders-status', onStatus);
  }, []);

  if (!inArogyaApp) {
    return <p className="reminder-hint">Get a reminder with sound and vibration at each time — open this in the Arogya app.</p>;
  }
  if (!appCanReminders) {
    return <p className="reminder-hint">Update the Arogya app to get medicine reminders with sound and vibration.</p>;
  }

  const times = { ...DEFAULT_TIMES, ...(status?.times ?? {}) };
  const enabled = !!status?.enabled;
  const update = (patch: Partial<{ enabled: boolean; times: Partial<Times> }>) => {
    setSaving(true);
    send({ type: 'medicine-reminders', ...patch });
  };

  return (
    <div className={`reminder-panel${enabled ? ' on' : ''}`}>
      <div className="reminder-head">
        <span className="reminder-bell" aria-hidden="true">
          <IconBell2 size={18} />
        </span>
        <div className="reminder-head-text">
          <b>Reminders on this phone</b>
          <small>
            {enabled
              ? status?.scheduled
                ? `On — ${status.scheduled} a day, with sound and vibration`
                : hasTimed
                  ? 'On'
                  : 'On — pick morning / night etc. on a medicine to get reminded'
              : 'A chirp and a buzz when it’s time to take them'}
          </small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`switch${enabled ? ' on' : ''}`}
          disabled={saving}
          onClick={() => update({ enabled: !enabled })}
        >
          <span />
        </button>
      </div>
      {status?.permission === false && (
        <p className="reminder-warn">Notifications are blocked for Arogya. Allow them in your phone’s Settings → Apps → Arogya → Notifications.</p>
      )}
      {enabled && (
        <>
          <div className="reminder-times">
            {SLOTS.map(({ value, label, Icon }) => (
              <label key={value} className={`reminder-time reminder-time--${value.toLowerCase()}`}>
                <span>
                  <Icon size={15} /> {label}
                </span>
                <input
                  type="time"
                  value={times[value]}
                  onChange={(e) => e.target.value && update({ times: { [value]: e.target.value } })}
                />
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-small" onClick={() => send({ type: 'medicine-reminder-test' })}>
            <IconBell2 size={13} /> Play test reminder
          </button>
        </>
      )}
    </div>
  );
}
