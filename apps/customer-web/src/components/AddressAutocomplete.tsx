import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { GeocodeResult } from '../api/types';
import { IconSearch } from './Icons';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api
        .get<GeocodeResult[]>(`/geocode/search?q=${encodeURIComponent(value.trim())}`)
        .then((res) => {
          setResults(res);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div style={{ position: 'relative' }}>
      <div className="search-bar">
        <IconSearch size={16} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? 'Start typing your address…'}
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
          {loading && (
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-faint)' }}>Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-faint)' }}>
              No matching addresses
            </div>
          )}
          {!loading &&
            results.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                {r.displayName}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
