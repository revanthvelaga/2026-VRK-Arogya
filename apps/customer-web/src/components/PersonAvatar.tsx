import type { Patient } from '../api/types';

const BACKGROUNDS = ['#dff3f1', '#e4e7fd', '#fde6d8', '#fbe1ec', '#dbeefb', '#e2f4e4', '#efe4fb', '#fde2e4'];
const SHIRTS = ['#0ea5a0', '#6366f1', '#f97316', '#ec4899', '#0284c7', '#16a34a', '#a855f7', '#e11d48'];

export function ageOf(p: Pick<Patient, 'dateOfBirth'>): number | undefined {
  if (!p.dateOfBirth) return undefined;
  const dob = new Date(p.dateOfBirth);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : undefined;
}

// "Male, 30" / "Female, 63" / "Male" / "Age 45" — whatever we know.
export function genderAge(p: Pick<Patient, 'gender' | 'dateOfBirth'>): string {
  const g = p.gender === 'MALE' ? 'Male' : p.gender === 'FEMALE' ? 'Female' : p.gender === 'OTHER' ? 'Other' : '';
  const age = ageOf(p);
  if (g && age != null) return `${g}, ${age}`;
  if (g) return g;
  return age != null ? `Age ${age}` : '';
}

// A small drawn portrait: man, woman or neutral, with grey hair from 55
// up — so each family member is recognisable at a glance in a list.
export function PersonAvatar({ patient, index = 0, size = 40 }: { patient: Pick<Patient, 'gender' | 'dateOfBirth'>; index?: number; size?: number }) {
  const age = ageOf(patient);
  const senior = age != null && age >= 55;
  const child = age != null && age < 13;
  const hair = senior ? '#cfd3d8' : '#2b2220';
  const bg = BACKGROUNDS[index % BACKGROUNDS.length];
  const shirt = SHIRTS[index % SHIRTS.length];
  const female = patient.gender === 'FEMALE';
  const male = patient.gender === 'MALE';
  const headR = child ? 9 : 8.5;

  return (
    <svg className="person-avatar" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill={bg} />
      <clipPath id={`pa-clip-${index}`}>
        <circle cx="20" cy="20" r="20" />
      </clipPath>
      <g clipPath={`url(#pa-clip-${index})`}>
        {female && <path d="M10.5 18 C10.5 8 29.5 8 29.5 18 L30.5 31 L9.5 31Z" fill={hair} />}
        <path d="M6 42 C6 31 12 27 20 27 C28 27 34 31 34 42Z" fill={shirt} />
        <rect x="17.3" y="22.5" width="5.4" height="6" rx="2.4" fill="#e3a97f" />
        <circle cx="20" cy="17.5" r={headR} fill="#eab68c" />
        {male && <path d="M11.4 16.5 C11 9.5 15 7.6 20 7.6 C25.4 7.6 29 9.8 28.6 16.5 C27.2 12.6 24.4 11.6 20 11.8 C15.6 11.6 12.8 12.6 11.4 16.5Z" fill={hair} />}
        {female && (
          <>
            <path d="M11.6 17 C11.6 10.5 15.4 8.4 20 8.4 C24.6 8.4 28.4 10.5 28.4 17 C26.4 13 23.4 11.6 20 12.6 C16.6 11.6 13.6 13 11.6 17Z" fill={hair} />
            {senior && <circle cx="20" cy="7.2" r="3.4" fill={hair} />}
          </>
        )}
        {!male && !female && <path d="M11.6 16.5 C11.6 10 15.4 8.2 20 8.2 C24.6 8.2 28.4 10 28.4 16.5 C26 13.2 23 12.2 20 12.4 C17 12.2 14 13.2 11.6 16.5Z" fill={hair} />}
        <circle cx="16.8" cy="18.2" r="1" fill="#3b2a22" />
        <circle cx="23.2" cy="18.2" r="1" fill="#3b2a22" />
        <path d="M17.6 21.6 Q20 23.2 22.4 21.6" stroke="#9a5b3f" strokeWidth="1" fill="none" strokeLinecap="round" />
        {female && <circle cx="20" cy="14.6" r="0.75" fill="#d1344a" />}
        {senior && (
          <g stroke="#475569" strokeWidth="0.9" fill="none">
            <circle cx="16.8" cy="18.2" r="2.3" />
            <circle cx="23.2" cy="18.2" r="2.3" />
            <path d="M19.1 18.2 H20.9" />
          </g>
        )}
      </g>
    </svg>
  );
}
