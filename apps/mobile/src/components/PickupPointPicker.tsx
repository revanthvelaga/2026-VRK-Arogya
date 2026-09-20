import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { PickupPoint } from '../api/types';
import { colors, radius, shadow, spacing } from '../theme';

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
    return points.filter((p) => p.name.toLowerCase().includes(q) || (p.villageName ?? '').toLowerCase().includes(q));
  }, [points, query]);

  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <TextInput
        style={styles.input}
        value={open ? query : selected ? `${selected.name}${selected.villageName ? ` — ${selected.villageName}` : ''}` : ''}
        onChangeText={(t) => {
          setQuery(t);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        placeholder="Search pickup points by name or village…"
        placeholderTextColor={colors.inkFaint}
      />
      {open && (
        <View style={styles.dropdown}>
          {filtered.length === 0 && <Text style={styles.emptyText}>No pickup points match "{query}"</Text>}
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.row,
                  index < filtered.length - 1 && styles.rowBorder,
                  item.id === selectedId && styles.rowSelected,
                ]}
                onPress={() => {
                  onSelect(item.id);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <Text style={styles.rowName}>{item.name}</Text>
                {item.villageName && <Text style={styles.rowVillage}> — {item.villageName}</Text>}
              </TouchableOpacity>
            )}
          />
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
  emptyText: { fontSize: 12.5, color: colors.inkFaint, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowSelected: { backgroundColor: colors.accentSoft },
  rowName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  rowVillage: { fontSize: 13, color: colors.inkFaint },
  closeRow: { paddingVertical: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  closeText: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
});
