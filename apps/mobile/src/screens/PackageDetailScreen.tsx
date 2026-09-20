import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorBanner } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { formatCurrency } from '../lib/format';
import { audienceLabel } from '../lib/segments';
import { colors, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

function PackageTestRow({ test }: { test: Test }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!(test.description || test.preparationInstructions);

  return (
    <TouchableOpacity
      style={styles.testRow}
      disabled={!hasDetails}
      onPress={() => setOpen((v) => !v)}
      activeOpacity={hasDetails ? 0.6 : 1}
    >
      <View style={styles.testRowTop}>
        <View>
          <Text style={styles.testName}>{test.name}</Text>
          {test.sampleType && <Text style={styles.testMeta}>{test.sampleType}</Text>}
        </View>
        {hasDetails && <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>}
      </View>
      {open && (
        <View style={{ marginTop: 6 }}>
          {test.description && <Text style={styles.testDetail}>{test.description}</Text>}
          {test.preparationInstructions && (
            <Text style={styles.testDetail}>Before your test: {test.preparationInstructions}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function PackageDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: pkg, loading, error } = useApi<Package>(() => api.get(`/catalog/packages/${id}`), [id]);
  const { add, has } = useCart();

  if (loading) return <LoadingLine label="Loading package…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!pkg) return null;

  const added = has('package', pkg.id);
  const tests = pkg.tests ?? [];
  const maxTurnaround = tests.length ? Math.max(...tests.map((t) => t.turnaroundHours)) : undefined;
  const sampleTypes = Array.from(new Set(tests.map((t) => t.sampleType).filter(Boolean))) as string[];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{pkg.name}</Text>
        <Text style={styles.meta}>
          {pkg.audience === 'EVERYONE' ? 'For everyone' : `For ${audienceLabel(pkg.audience)}`} · Contains {tests.length}{' '}
          test{tests.length === 1 ? '' : 's'}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(pkg.price)}</Text>
          <Button
            title={added ? 'Added to cart' : 'Add to cart'}
            variant={added ? 'secondary' : 'primary'}
            disabled={added}
            onPress={() => add({ kind: 'package', id: pkg.id, name: pkg.name, price: Number(pkg.price) })}
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Book this package" variant="secondary" onPress={() => navigation.navigate('Booking', { packageId: pkg.id })} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Details</Text>
        {maxTurnaround != null && <Text style={styles.detailLine}>Earliest reports in {maxTurnaround} hours</Text>}
        {sampleTypes.length > 0 && <Text style={styles.detailLine}>Samples required: {sampleTypes.join(' & ')}</Text>}
      </Card>

      {pkg.description && (
        <Card>
          <Text style={styles.cardTitle}>Know more about this package</Text>
          <Text style={styles.body}>{pkg.description}</Text>
        </Card>
      )}

      {tests.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>What's included ({tests.length})</Text>
          {tests.map((t) => (
            <PackageTestRow test={t} key={t.id} />
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  price: { fontSize: 19, fontWeight: '800', color: colors.ink },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  detailLine: { fontSize: 13.5, color: colors.inkSoft, marginBottom: 4 },
  body: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20 },
  testRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  testRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  testName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  testMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  chevron: { fontSize: 13, color: colors.inkFaint },
  testDetail: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 18, marginTop: 4 },
});
