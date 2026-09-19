import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api/client';
import type { DiagnosticCenter } from '../api/types';
import { useApi } from '../lib/useApi';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing } from '../theme';

export function CentersScreen() {
  const [nearby, setNearby] = useState<DiagnosticCenter[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const { data: allCenters, loading } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);

  const findNearby = async () => {
    setLocError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission denied — showing all centers instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const results = await api.get<DiagnosticCenter[]>(
        `/centers/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
      );
      setNearby(results);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Could not get your location');
    } finally {
      setLocating(false);
    }
  };

  const list = nearby ?? allCenters ?? [];

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>Diagnostic centers</Text>
        <Button title={locating ? 'Finding…' : 'Use my location'} onPress={findNearby} loading={locating} variant="secondary" />
        {locError && <ErrorBanner message={locError} />}
        {nearby && <Text style={styles.hint}>Sorted nearest first.</Text>}
      </View>

      {loading ? (
        <LoadingLine label="Loading centers…" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title="No centers yet" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {item.address && <Text style={styles.meta}>{item.address}</Text>}
              <Text style={styles.meta}>Service radius: {item.serviceRadiusKm} km</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkFaint },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
});
