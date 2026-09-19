import { useMemo, useState } from 'react';
import type { PickupPoint } from '../api/types';
import { IconCheckCircle, IconSearch } from './Icons';

export function PickupPointPicker({
  points,
  selectedId,
  onSelect,
}: {
  points: PickupPoint[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = points.find((p) => p.id === selectedId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.villageName ?? '').toLowerCase().includes(q),
    );
  }, [points, query]);

  return (
    <div style={{ position: 'relative' }}>
      <div className="search-bar" onClick={() => setOpen(true)}>
        <IconSearch size={16} />
        <input
          value={open ? query : (selected ? `${selected.name}${selected.villageName ? ` — ${selected.villageName}` : ''}` : '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search pickup points by name or village…"
          style={{ border: 'none', outline: 'none', flex: 1, font: 'inherit', background: 'none' }}
        />
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-card-hover)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              No pickup points match "{query}"
            </div>
          )}
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p.id);
                setQuery('');
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: p.id === selectedId ? 'var(--accent-soft)' : 'none',
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--ink)',
                cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <span>
                <strong>{p.name}</strong>
                {p.villageName && <span style={{ color: 'var(--ink-faint)' }}> — {p.villageName}</span>}
              </span>
              {p.id === selectedId && <IconCheckCircle size={14} style={{ color: 'var(--teal)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
