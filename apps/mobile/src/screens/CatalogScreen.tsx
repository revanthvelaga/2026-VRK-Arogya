import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useCart } from '../context/CartContext';
import { audienceLabel } from '../lib/segments';
import { formatCurrency } from '../lib/format';
import { EmptyState } from '../components/EmptyState';
import { LoadingLine } from '../components/Spinner';
import { colors, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Catalog'>,
  NativeStackScreenProps<RootStackParamList>
>;

function matchesAudience(itemAudience: string, filter?: string) {
  return !filter || itemAudience === filter || itemAudience === 'EVERYONE';
}

export function CatalogScreen({ navigation, route }: Props) {
  const audience = route.params?.audience;
  const [tab, setTab] = useState<'tests' | 'packages'>('tests');
  const [query, setQuery] = useState('');
  const cart = useCart();

  const { data: tests, loading: testsLoading } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages, loading: packagesLoading } = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const filteredTests = useMemo(
    () =>
      (tests ?? []).filter(
        (t) => matchesAudience(t.audience, audience) && t.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [tests, audience, query],
  );
  const filteredPackages = useMemo(
    () => (packages ?? []).filter((p) => matchesAudience(p.audience, audience)),
    [packages, audience],
  );

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>Catalog</Text>
        <TextInput
          style={styles.search}
          placeholder="Search tests…"
          placeholderTextColor={colors.inkFaint}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.tabRow}>
          {(['tests', 'packages'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'tests' ? 'Tests' : 'Packages'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {audience && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Showing tests recommended for {audienceLabel(audience)}</Text>
            <TouchableOpacity onPress={() => navigation.setParams({ audience: undefined })}>
              <Text style={styles.bannerClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {tab === 'tests' ? (
        testsLoading ? (
          <LoadingLine label="Loading tests…" />
        ) : (
          <FlatList
            data={filteredTests}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                title="No tests match"
                hint={audience ? 'Try clearing the category filter.' : 'Try a different search.'}
              />
            }
            renderItem={({ item }) => {
              const added = cart.has('test', item.id);
              return (
                <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('TestDetail', { id: item.id })}>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    {item.sampleType && <Text style={styles.rowMeta}>{item.sampleType} · {item.turnaroundHours}h turnaround</Text>}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.cartBtn, added && styles.cartBtnAdded]}
                        onPress={() => cart.add({ kind: 'test', id: item.id, name: item.name, price: Number(item.price) })}
                        disabled={added}
                      >
                        <Text style={[styles.cartBtnText, added && styles.cartBtnTextAdded]}>{added ? 'Added' : '+ Cart'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`catalog-book-test-${item.id}`}
                        style={styles.bookBtn}
                        onPress={() => navigation.navigate('Booking', { testId: item.id })}
                      >
                        <Text style={styles.bookBtnText}>Book</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )
      ) : packagesLoading ? (
        <LoadingLine label="Loading packages…" />
      ) : (
        <FlatList
          data={filteredPackages}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No packages match"
              hint={audience ? 'Try clearing the category filter.' : undefined}
            />
          }
          renderItem={({ item }) => {
            const added = cart.has('package', item.id);
            return (
              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PackageDetail', { id: item.id })}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{item.tests?.length ?? 0} tests included</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowPrice}>{formatCurrency(item.price)}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.cartBtn, added && styles.cartBtnAdded]}
                      onPress={() => cart.add({ kind: 'package', id: item.id, name: item.name, price: Number(item.price) })}
                      disabled={added}
                    >
                      <Text style={[styles.cartBtnText, added && styles.cartBtnTextAdded]}>{added ? 'Added' : '+ Cart'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`catalog-book-package-${item.id}`}
                      style={styles.bookBtn}
                      onPress={() => navigation.navigate('Booking', { packageId: item.id })}
                    >
                      <Text style={styles.bookBtnText}>Book</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {cart.items.length > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => navigation.navigate('Booking', undefined)}>
          <View>
            <Text style={styles.cartBarCount}>
              {cart.items.length} item{cart.items.length > 1 ? 's' : ''} added
            </Text>
            <Text style={styles.cartBarTotal}>{formatCurrency(cart.total)}</Text>
          </View>
          <Text style={styles.cartBarAction}>Go to cart</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  tabRow: { flexDirection: 'row', gap: spacing.sm },
  tabBtn: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.greySoft },
  tabBtnActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: '#fff' },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  bannerText: { fontSize: 13, color: '#0B7A76', fontWeight: '600', flex: 1 },
  bannerClear: { fontSize: 13, color: '#0B7A76', fontWeight: '700', marginLeft: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  rowInfo: { flex: 1, paddingRight: spacing.sm },
  rowTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowPrice: { fontSize: 14, fontWeight: '700', color: colors.ink },
  cartBtn: { backgroundColor: colors.greySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  cartBtnAdded: { backgroundColor: colors.accentSoft },
  cartBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  cartBtnTextAdded: { color: '#0B7A76' },
  bookBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  cartBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: spacing.md,
    margin: spacing.lg,
    marginTop: 0,
    ...shadow.card,
  },
  cartBarCount: { fontSize: 12, color: '#E6EBF0' },
  cartBarTotal: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 2 },
  cartBarAction: { fontSize: 13, fontWeight: '700', color: colors.accent },
});
