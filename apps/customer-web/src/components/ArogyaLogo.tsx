// The Arogya logo: the goddess of health holding a healing pot, with a
// stethoscope, DNA and microscope, on a pearl rounded tile.
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
