import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import type { GeocodeResult } from '../api/types';
import { colors, radius, shadow, spacing } from '../theme';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

// Same debounced Nominatim-backed search as customer-web's
// AddressAutocomplete, re-implemented with TextInput + an absolutely
// positioned dropdown instead of a browser <input>/<div>.
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
    <View style={{ position: 'relative', zIndex: 20 }}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => {
          onChange(t);
          setOpen(true);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder ?? 'Start typing your address…'}
        placeholderTextColor={colors.inkFaint}
      />
      {open && (
        <View style={styles.dropdown}>
          {loading && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.statusText}>Searching…</Text>
            </View>
          )}
          {!loading && results.length === 0 && <Text style={styles.statusText}>No matching addresses</Text>}
          {!loading && results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[styles.row, index < results.length - 1 && styles.rowBorder]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.rowText}>{item.displayName}</Text>
                </TouchableOpacity>
              )}
            />
          )}
          <TouchableOpacity style={styles.closeRow} onPress={() => setOpen(false)}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 30,
    marginTop: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    maxHeight: 260,
    ...shadow.card,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  statusText: { fontSize: 12.5, color: colors.inkFaint, padding: spacing.md },
  row: { paddingHorizontal: spacing.md, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 13, color: colors.ink },
  closeRow: { paddingVertical: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  closeText: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
});
