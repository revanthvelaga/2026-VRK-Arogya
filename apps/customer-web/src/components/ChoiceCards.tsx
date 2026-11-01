import type { CSSProperties, ReactNode } from 'react';
import type { DiagnosticCenter } from '../api/types';
import { IconBuilding, IconCheckCircle } from './Icons';

// A tappable card with an icon, a title, a line or two of detail and a
// tick when picked — used for centers and collection options.
export function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  detail,
  badge,
  tone,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  detail?: ReactNode;
  badge?: string;
  tone?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`choice-card${selected ? ' on' : ''}`}
      style={tone ? ({ '--tone': tone } as CSSProperties) : undefined}
      onClick={onSelect}
    >
      <span className="choice-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="choice-text">
        <span className="choice-title">
          <b>{title}</b>
          {badge && <span className="choice-badge">{badge}</span>}
        </span>
        {subtitle && <small className="choice-sub">{subtitle}</small>}
        {detail && <span className="choice-detail">{detail}</span>}
      </span>
      <span className="choice-check" aria-hidden="true">
        <IconCheckCircle size={20} />
      </span>
    </button>
  );
}

// "Arogya Diagnostics - Narsipatnam" → "Narsipatnam" as the title, with
// the brand as a small line above it.
function splitName(name: string): { title: string; brand?: string } {
  const m = /^(.*?)\s*[-–—]\s*(.+)$/.exec(name);
  return m ? { title: m[2], brand: m[1] } : { title: name };
}

export function CenterPicker({
  centers,
  selectedId,
  onSelect,
  distances,
}: {
  centers: DiagnosticCenter[];
  selectedId: string;
  onSelect: (id: string) => void;
  distances?: Map<string, number>;
}) {
  const nearestId = distances && centers.length > 1 ? centers[0]?.id : undefined;
  return (
    <div className="choice-list" role="radiogroup" aria-label="Diagnostic center">
      {centers.map((c) => {
        const { title, brand } = splitName(c.name);
        const km = distances?.get(c.id);
        const radius = Number(c.serviceRadiusKm);
        const detail = [km != null ? `${km.toFixed(1)} km away` : null, radius ? `Home visits within ${radius} km` : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <ChoiceCard
            key={c.id}
            selected={selectedId === c.id}
            onSelect={() => onSelect(c.id)}
            icon={<IconBuilding size={20} />}
            title={title}
            subtitle={brand}
            badge={c.id === nearestId ? 'Nearest' : undefined}
            detail={
              <>
                {c.address && <span className="choice-address">{c.address}</span>}
                {detail && <span className="choice-meta">{detail}</span>}
              </>
            }
          />
        );
      })}
    </div>
  );
}
