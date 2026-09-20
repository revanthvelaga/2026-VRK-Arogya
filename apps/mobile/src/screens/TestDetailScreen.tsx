import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Test } from '../api/types';
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

type Props = NativeStackScreenProps<RootStackParamList, 'TestDetail'>;

export function TestDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: test, loading, error } = useApi<Test>(() => api.get(`/catalog/tests/${id}`), [id]);
  const { add, has } = useCart();

  if (loading) return <LoadingLine label="Loading test…" />;
  if (error) return <ErrorBanner message={error} />;
  if (!test) return null;

  const added = has('test', test.id);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{test.name}</Text>
        <Text style={styles.meta}>
          {test.audience === 'EVERYONE' ? 'For everyone' : `For ${audienceLabel(test.audience)}`}
          {test.sampleType ? ` · ${test.sampleType}` : ''}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(test.price)}</Text>
          <Button
            title={added ? 'Added to cart' : 'Add to cart'}
            variant={added ? 'secondary' : 'primary'}
            disabled={added}
            onPress={() => add({ kind: 'test', id: test.id, name: test.name, price: Number(test.price) })}
          />
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Book this test" variant="secondary" onPress={() => navigation.navigate('Booking', { testId: test.id })} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Details</Text>
        <Text style={styles.detailLine}>Report in {test.turnaroundHours} hours</Text>
        {test.normalRangeLow != null && test.normalRangeHigh != null && (
          <Text style={styles.detailLine}>
            Normal range: {test.normalRangeLow}–{test.normalRangeHigh} {test.normalRangeUnit ?? ''}
          </Text>
        )}
        {!test.isInHouse && <Text style={styles.detailLine}>Processed at a partner lab</Text>}
      </Card>

      {test.description && (
        <Card>
          <Text style={styles.cardTitle}>Know more about this test</Text>
          <Text style={styles.body}>{test.description}</Text>
        </Card>
      )}

      {test.preparationInstructions && (
        <Card>
          <Text style={styles.cardTitle}>Before your test</Text>
          <Text style={styles.body}>{test.preparationInstructions}</Text>
        </Card>
      )}

      {test.reportInfo && (
        <Card>
          <Text style={styles.cardTitle}>Your report</Text>
          <Text style={styles.body}>{test.reportInfo}</Text>
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
});
