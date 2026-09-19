import type { CSSProperties, ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Consistent 24x24, 1.8px-stroke line icons (feather-style) — one factory so
// every icon shares the same visual weight instead of mixing icon sets.
function icon(paths: ReactNode) {
  return function IconComponent({ size = 18, className, style }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const IconDashboard = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </>,
);

export const IconCalendar = icon(
  <>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>,
);

export const IconBox = icon(
  <>
    <path d="M12.9 1.9l7.6 3.8a1.9 1.9 0 011.1 1.7v9a1.9 1.9 0 01-1.1 1.7l-7.6 3.8a1.9 1.9 0 01-1.7 0l-7.6-3.8a1.9 1.9 0 01-1.1-1.7v-9a1.9 1.9 0 011.1-1.7l7.6-3.8a1.9 1.9 0 011.7 0z" />
    <polyline points="2.6 6.4 12 11 21.4 6.4" />
    <line x1="12" y1="21.9" x2="12" y2="11" />
  </>,
);

export const IconMapPin = icon(
  <>
    <path d="M20 10.2c0 6.4-8 11.8-8 11.8s-8-5.4-8-11.8a8 8 0 0116 0z" />
    <circle cx="12" cy="10.2" r="2.7" />
  </>,
);

export const IconFlask = icon(
  <>
    <path d="M9.5 2h5" />
    <path d="M10.3 2v6.6a2.3 2.3 0 01-.4 1.3l-4.4 6.6a2.7 2.7 0 002.3 4.2h8.4a2.7 2.7 0 002.3-4.2l-4.4-6.6a2.3 2.3 0 01-.4-1.3V2" />
    <line x1="7.5" y1="14.5" x2="16.5" y2="14.5" />
  </>,
);

export const IconLogout = icon(
  <>
    <path d="M9.5 21h-4a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9.5" y2="12" />
  </>,
);

export const IconPlus = icon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);

export const IconArrowLeft = icon(
  <>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </>,
);

export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9.2" />
    <polyline points="12 7 12 12.5 16 14.5" />
  </>,
);

export const IconCheckCircle = icon(
  <>
    <path d="M21 11.1V12a9.2 9.2 0 11-5.5-8.4" />
    <polyline points="21.5 4.3 12 13.8 9 10.8" />
  </>,
);

export const IconInbox = icon(
  <>
    <polyline points="21 11 15.5 11 13.5 14 10.5 14 8.5 11 3 11" />
    <path d="M6 5.2L3 11v6.2a2 2 0 002 2h14a2 2 0 002-2V11l-3-5.8a1.9 1.9 0 00-1.7-1H7.7a1.9 1.9 0 00-1.7 1z" />
  </>,
);

export const IconTruck = icon(
  <>
    <rect x="1.5" y="6.5" width="13" height="10" rx="1.2" />
    <path d="M14.5 10h3.7l3.3 3.3v3.2h-7z" />
    <circle cx="5.5" cy="18.3" r="1.8" />
    <circle cx="16.8" cy="18.3" r="1.8" />
  </>,
);

export const IconBuilding = icon(
  <>
    <rect x="4" y="2.5" width="16" height="19" rx="1.2" />
    <line x1="8" y1="7" x2="8" y2="7.01" />
    <line x1="12" y1="7" x2="12" y2="7.01" />
    <line x1="16" y1="7" x2="16" y2="7.01" />
    <line x1="8" y1="11" x2="8" y2="11.01" />
    <line x1="12" y1="11" x2="12" y2="11.01" />
    <line x1="16" y1="11" x2="16" y2="11.01" />
    <line x1="9" y1="21.5" x2="9" y2="17" />
    <line x1="15" y1="21.5" x2="15" y2="17" />
  </>,
);

export const IconHome = icon(
  <>
    <path d="M3 11.5L12 4l9 7.5" />
    <path d="M5.5 9.8V20a1 1 0 001 1h11a1 1 0 001-1V9.8" />
    <path d="M9.5 21v-6h5v6" />
  </>,
);

export const IconUser = icon(
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.2a7.5 7.5 0 0115 0" />
  </>,
);

export const IconShieldCheck = icon(
  <>
    <path d="M12 2.6l7.5 3v5.6c0 5-3.2 8.7-7.5 10.2-4.3-1.5-7.5-5.2-7.5-10.2V5.6z" />
    <polyline points="8.7 12.2 11 14.5 15.5 10" />
  </>,
);

export const IconActivity = icon(
  <polyline points="2.5 12.5 7.5 12.5 10 6.5 14 18.5 16.5 12.5 21.5 12.5" />,
);

export const IconArrowRight = icon(
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>,
);

export const IconX = icon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
);
