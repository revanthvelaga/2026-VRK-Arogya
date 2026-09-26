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

export const IconSearch = icon(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <line x1="20" y1="20" x2="15.3" y2="15.3" />
  </>,
);

export const IconBag = icon(
  <>
    <path d="M5.5 8.5h13l1 12.5a1.5 1.5 0 01-1.5 1.6H6a1.5 1.5 0 01-1.5-1.6z" />
    <path d="M8.5 8.5V6a3.5 3.5 0 017 0v2.5" />
  </>,
);

export const IconPhone = icon(
  <path d="M4.5 3.5h3.4l1.6 4.4-2 1.7a13.5 13.5 0 006.9 6.9l1.7-2 4.4 1.6v3.4a1.5 1.5 0 01-1.6 1.5A17 17 0 013 5.1a1.5 1.5 0 011.5-1.6z" />,
);

export const IconMessage = icon(
  <path d="M3.5 12.5a8.5 8.5 0 1111 8.1l-4.6 1.4 1.4-4.1a8.46 8.46 0 01-7.8-5.4z" />,
);

export const IconLayers = icon(
  <>
    <polygon points="12 2.5 21.5 7.5 12 12.5 2.5 7.5 12 2.5" />
    <polyline points="2.5 13.5 12 18.5 21.5 13.5" />
    <polyline points="2.5 17.5 12 22.5 21.5 17.5" />
  </>,
);

export const IconChevronDown = icon(<polyline points="5.5 8.5 12 15 18.5 8.5" />);

export const IconChevronRight = icon(<polyline points="9 5.5 15.5 12 9 18.5" />);

export const IconBell = icon(
  <>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </>,
);

export const IconFolder = icon(
  <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7z" />,
);

export const IconWallet = icon(
  <>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h12v3" />
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="2" />
    <path d="M16 13.25h1.5" />
  </>,
);

export const IconAlertTriangle = icon(
  <>
    <path d="M12 3.5L2 20.5h20L12 3.5z" />
    <line x1="12" y1="9.5" x2="12" y2="14" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
);

export const IconFileText = icon(
  <>
    <path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <polyline points="15 3 15 8 20 8" />
    <line x1="8.5" y1="13" x2="15.5" y2="13" />
    <line x1="8.5" y1="17" x2="15.5" y2="17" />
  </>,
);

export const IconSparkle = icon(
  <>
    <path d="M12 3.2l1.9 5.4 5.4 1.9-5.4 1.9-1.9 5.4-1.9-5.4-5.4-1.9 5.4-1.9L12 3.2z" />
    <path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
  </>,
);

export const IconCreditCard = icon(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <line x1="2.5" y1="10" x2="21.5" y2="10" />
  </>,
);

export const IconUpload = icon(
  <>
    <path d="M4 15.5v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    <polyline points="7.5 8 12 3.5 16.5 8" />
    <line x1="12" y1="3.5" x2="12" y2="15" />
  </>,
);

export const IconDownload = icon(
  <>
    <path d="M4 15.5v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    <polyline points="7.5 11 12 15.5 16.5 11" />
    <line x1="12" y1="15.5" x2="12" y2="3.5" />
  </>,
);

export const IconStethoscope = icon(
  <>
    <path d="M5 3.5v5a5 5 0 0010 0v-5" />
    <path d="M10 13.5v2a4.5 4.5 0 009 0v-2" />
    <circle cx="19" cy="11.5" r="2" />
  </>,
);

export const IconTrend = icon(
  <>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </>,
);

export const IconUsers = icon(
  <>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.5 20a6.5 6.5 0 0113 0" />
    <path d="M16 4.8a3.4 3.4 0 010 6.4" />
    <path d="M18.5 14.2a6.5 6.5 0 013 5.8" />
  </>,
);

export const IconHeart = icon(
  <path d="M20.3 5.6a5 5 0 00-7.1 0L12 6.8l-1.2-1.2a5 5 0 00-7.1 7.1l1.2 1.2L12 21l7.1-7.1 1.2-1.2a5 5 0 000-7.1z" />,
);

export const IconPill = icon(
  <>
    <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
    <line x1="8.6" y1="8.6" x2="15.4" y2="15.4" />
  </>,
);

export const IconTarget = icon(
  <>
    <circle cx="12" cy="12" r="9.2" />
    <circle cx="12" cy="12" r="5.2" />
    <circle cx="12" cy="12" r="1.3" />
  </>,
);

export const IconGift = icon(
  <>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M5 12v8h14v-8" />
    <line x1="12" y1="8" x2="12" y2="20" />
    <path d="M12 8H8.5a2.3 2.3 0 010-4.5C11 3.5 12 8 12 8z" />
    <path d="M12 8h3.5a2.3 2.3 0 000-4.5C13 3.5 12 8 12 8z" />
  </>,
);

export const IconTag = icon(
  <>
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </>,
);

export const IconShare = icon(
  <>
    <circle cx="18" cy="5.5" r="2.7" />
    <circle cx="6" cy="12" r="2.7" />
    <circle cx="18" cy="18.5" r="2.7" />
    <line x1="8.4" y1="13.4" x2="15.6" y2="17.1" />
    <line x1="15.6" y1="6.9" x2="8.4" y2="10.6" />
  </>,
);

export const IconStar = icon(
  <polygon points="12 2.8 14.8 8.6 21.2 9.5 16.6 14 17.7 20.3 12 17.3 6.3 20.3 7.4 14 2.8 9.5 9.2 8.6 12 2.8" />,
);

export const IconKey = icon(
  <>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L20 3" />
    <path d="M16.5 6.5l3 3" />
    <path d="M14 9l2 2" />
  </>,
);

export const IconPrinter = icon(
  <>
    <polyline points="6 9 6 2.5 18 2.5 18 9" />
    <path d="M6 18H4.5a2 2 0 01-2-2v-5a2 2 0 012-2h15a2 2 0 012 2v5a2 2 0 01-2 2H18" />
    <rect x="6" y="14" width="12" height="7.5" />
  </>,
);
