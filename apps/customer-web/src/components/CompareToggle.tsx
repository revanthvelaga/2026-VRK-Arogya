import { useCompareList } from '../lib/compareList';
import { IconCheckCircle, IconLayers } from './Icons';

// "Compare" tick on a package card.
export function CompareToggle({ packageId }: { packageId: string }) {
  const { has, toggle } = useCompareList();
  const on = has(packageId);
  return (
    <button
      type="button"
      className={`compare-toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        toggle(packageId);
      }}
    >
      {on ? <IconCheckCircle size={13} /> : <IconLayers size={13} />}
      {on ? 'Comparing' : 'Compare'}
    </button>
  );
}
