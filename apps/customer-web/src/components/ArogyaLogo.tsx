// The Arogya logo: teal-blue plus with a beating heart and two doctors (static icon image).
export function ArogyaLogo({ size = 36, className, title = 'Arogya' }: { size?: number; className?: string; title?: string }) {
  return (
    <img
      className={className}
      src="/arogya-icon.png"
      width={size}
      height={size}
      alt={title}
      draggable={false}
      style={{ objectFit: 'contain' }}
    />
  );
}
