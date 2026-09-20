import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { DiagnosticCenter, GeocodeResult } from '../api/types';
import { useApi } from '../lib/useApi';
import { haversineDistanceKm } from '../lib/geo';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { EmptyState, ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Centers'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MAX_DISTANCE_KM = 30;

export function CentersScreen({ navigation }: Props) {
  const { data: centers, loading, error } = useApi<DiagnosticCenter[]>(() => api.get('/centers'), []);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('');

  const findNearMe = async () => {
    setGeoStatus('locating');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoStatus('denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGeoStatus('granted');
      setAddressLabel('');
    } catch {
      setGeoStatus('denied');
    }
  };

  const selectAddress = (result: GeocodeResult) => {
    setUserCoords({ lat: result.lat, lng: result.lng });
    setAddressText(result.displayName);
    setAddressLabel(result.displayName);
    setGeoStatus('idle');
  };

  const list = useMemo(() => {
    const all = centers ?? [];
    if (!userCoords) return all.map((c) => ({ center: c, distanceKm: undefined as number | undefined }));
    return all
      .map((c) => ({
        center: c,
        distanceKm: haversineDistanceKm(userCoords.lat, userCoords.lng, c.location.coordinates[1], c.location.coordinates[0]),
      }))
      .filter((c) => c.distanceKm <= MAX_DISTANCE_KM)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [centers, userCoords]);

  const selectedCenter = list.find((c) => c.center.id === selectedCenterId)?.center;

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>Diagnostic centers</Text>

        <View style={{ zIndex: 20 }}>
          {geoStatus === 'denied' && <ErrorBanner message="Couldn't get your location — search for your area below instead." />}
          <Button
            title={geoStatus === 'locating' ? 'Locating…' : geoStatus === 'granted' ? 'Refresh my location' : 'Use my location'}
            variant="secondary"
            onPress={findNearMe}
            disabled={geoStatus === 'locating'}
          />
          <Text style={styles.hint}>Or search for your area</Text>
          <AddressAutocomplete value={addressText} onChange={setAddressText} onSelect={selectAddress} placeholder="Type an area, locality, or pincode…" />
          {addressLabel && (
            <Text style={styles.hint}>
              Showing centers near <Text style={{ fontWeight: '700' }}>{addressLabel}</Text> (within {MAX_DISTANCE_KM}km)
            </Text>
          )}
        </View>

        {selectedCenter && (
          <View style={styles.selectedCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedLabel}>Selected center</Text>
              <Text style={styles.selectedName}>{selectedCenter.name}</Text>
            </View>
            <Button title="Continue to booking" onPress={() => navigation.navigate('Booking', { centerId: selectedCenter.id })} />
          </View>
        )}
      </View>

      {error && <ErrorBanner message={error} />}
      {loading ? (
        <LoadingLine label="Loading centers…" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={({ center }) => center.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title={userCoords ? `No centers within ${MAX_DISTANCE_KM}km of that location` : 'No centers cover that location yet'} />
          }
          renderItem={({ item: { center: c, distanceKm } }) => {
            const isSelected = c.id === selectedCenterId;
            return (
              <TouchableOpacity style={[styles.card, isSelected && styles.cardSelected]} onPress={() => setSelectedCenterId(c.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{c.name}</Text>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
                {c.address && <Text style={styles.meta}>{c.address}</Text>}
                <View style={styles.badgeRow}>
                  {distanceKm != null && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{distanceKm.toFixed(1)} km away</Text>
                    </View>
                  )}
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.serviceRadiusKm} km service radius</Text>
                  </View>
                </View>
                <View style={{ marginTop: spacing.sm }}>
                  <Button title="Book at this center" onPress={() => navigation.navigate('Booking', { centerId: c.id })} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkFaint, marginTop: spacing.xs, marginBottom: spacing.xs },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selectedLabel: { fontSize: 11.5, color: colors.inkSoft },
  selectedName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkMark: { fontSize: 16, color: colors.accent, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  badge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0B7A76' },
});
