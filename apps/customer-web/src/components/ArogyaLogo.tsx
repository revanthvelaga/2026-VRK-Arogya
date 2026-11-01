import { useId } from 'react';

// The Arogya logo: an outline plus with a heart, a heartbeat and a caring
// hand, in the site's teal-to-blue, on a white rounded tile.
const ART = `<defs><linearGradient id="__ID__" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10B5A6"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs><rect x=".5" y=".5" width="63" height="63" rx="15" fill="#fff" stroke="#e9edf3"/><path d="M26.5 10.5h11a2.5 2.5 0 0 1 2.5 2.5v11h11a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5H40v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 24 51V40H13a2.5 2.5 0 0 1-2.5-2.5v-11A2.5 2.5 0 0 1 13 24h11V13a2.5 2.5 0 0 1 2.5-2.5Z" fill="none" stroke="url(#__ID__)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 44.5C24.5 39.2 20.5 35.4 20.5 30.6c0-3.4 2.6-6 5.7-6 2.4 0 4.5 1.4 5.8 3.5 1.3-2.1 3.4-3.5 5.8-3.5 3.1 0 5.7 2.6 5.7 6 0 4.8-4 8.6-11.5 13.9Z" fill="#fff" stroke="#fff" stroke-width="5.5" stroke-linejoin="round"/><path d="M32 44.5C24.5 39.2 20.5 35.4 20.5 30.6c0-3.4 2.6-6 5.7-6 2.4 0 4.5 1.4 5.8 3.5 1.3-2.1 3.4-3.5 5.8-3.5 3.1 0 5.7 2.6 5.7 6 0 4.8-4 8.6-11.5 13.9Z" fill="none" stroke="url(#__ID__)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 32.4h2.8l1.4-4 1.8 7.2 1.4-3.2h1.6" fill="none" stroke="url(#__ID__)" stroke-width="1.3679999999999999" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><g transform="translate(37.6 38.6) scale(0.66) translate(-38.6 -37.6)" stroke-width="2.9"><path d="M33.2 51.5c1.6-2.4 3.4-4.2 5.6-5.8 2.4-1.8 4.3-4.6 5.4-7.8l2-6.2" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M46.2 31.7c.4-1.3-.3-2.5-1.5-2.6-.9-.1-1.6.5-1.9 1.3l-1.7 4.8" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M43.9 29.5l.8-3c.3-1.2-.4-2.3-1.5-2.4-.9 0-1.6.6-1.8 1.4l-1.5 4.9" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 27.6c.3-1.2-.4-2.2-1.5-2.2-.9 0-1.5.6-1.7 1.4l-1.9 6.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M35.9 33.3c-.4-1.2-1.6-1.9-2.8-1.4-.9.4-1.2 1.4-.9 2.3l1.3 3.4c.5 1.4-.1 3-1.4 3.7l-2.6 1.5" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M33.2 51.5c1.6-2.4 3.4-4.2 5.6-5.8 2.4-1.8 4.3-4.6 5.4-7.8l2-6.2" fill="none" stroke="url(#__ID__)" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M46.2 31.7c.4-1.3-.3-2.5-1.5-2.6-.9-.1-1.6.5-1.9 1.3l-1.7 4.8" fill="none" stroke="url(#__ID__)" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M43.9 29.5l.8-3c.3-1.2-.4-2.3-1.5-2.4-.9 0-1.6.6-1.8 1.4l-1.5 4.9" fill="none" stroke="url(#__ID__)" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 27.6c.3-1.2-.4-2.2-1.5-2.2-.9 0-1.5.6-1.7 1.4l-1.9 6.5" fill="none" stroke="url(#__ID__)" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M35.9 33.3c-.4-1.2-1.6-1.9-2.8-1.4-.9.4-1.2 1.4-.9 2.3l1.3 3.4c.5 1.4-.1 3-1.4 3.7l-2.6 1.5" fill="none" stroke="url(#__ID__)" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"/></g>`;

export function ArogyaLogo({ size = 36, className, title = 'Arogya' }: { size?: number; className?: string; title?: string }) {
  const id = `al${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: ART.split('__ID__').join(id) }}
    />
  );
}
