import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { Package, Test } from '../api/types';
import { useApi } from '../lib/useApi';
import { useAuth } from '../auth/AuthContext';
import { SEGMENTS } from '../lib/segments';
import { callSupport, whatsappSupport } from '../lib/support';
import { formatCurrency } from '../lib/format';
import { colors, gradientForId, radius, shadow, spacing } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const QUICK_ACTIONS = [
  { label: 'Full body packages', kind: 'packages' as const },
  { label: 'Book via Call', kind: 'call' as const },
  { label: 'Book via WhatsApp', kind: 'whatsapp' as const },
  { label: 'Centers near me', kind: 'centers' as const },
  { label: 'Track a sample', kind: 'bookings' as const },
  { label: 'My Insights', kind: 'insights' as const },
];

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { data: tests } = useApi<Test[]>(() => api.get('/catalog/tests'), []);
  const { data: packages } = useApi<Package[]>(() => api.get('/catalog/packages'), []);

  const onQuickAction = (kind: (typeof QUICK_ACTIONS)[number]['kind']) => {
    switch (kind) {
      case 'packages':
        navigation.navigate('Tabs', { screen: 'Catalog' });
        break;
      case 'call':
        callSupport();
        break;
      case 'whatsapp':
        whatsappSupport();
        break;
      case 'centers':
        navigation.navigate('Tabs', { screen: 'Centers' });
        break;
      case 'bookings':
        navigation.navigate('Tabs', { screen: 'Bookings' });
        break;
      case 'insights':
        navigation.navigate('Insights');
        break;
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Arogya</Text>
      <Text style={styles.sub}>Book a lab test, track it end to end{user ? `, ${user.phone}` : ''}.</Text>

      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity key={a.kind} style={styles.quickTile} onPress={() => onQuickAction(a.kind)}>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Shop by category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
        {SEGMENTS.map((s) => (
          <TouchableOpacity
            key={s.audience}
            style={styles.segmentTile}
            onPress={() => navigation.navigate('Tabs', { screen: 'Catalog', params: { audience: s.audience } })}
          >
            <Image source={{ uri: s.photo }} style={styles.segmentPhoto} />
            <Text style={styles.segmentLabel}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Recommended tests</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {(tests ?? []).slice(0, 8).map((t) => (
          <View key={t.id} style={styles.richCard}>
            <View style={[styles.richCardArt, { backgroundColor: gradientForId(t.id) }]} />
            <Text style={styles.richCardTitle} numberOfLines={2}>{t.name}</Text>
            {t.sampleType && <Text style={styles.richCardMeta}>{t.sampleType}</Text>}
            <View style={styles.richCardFooter}>
              <Text style={styles.richCardPrice}>{formatCurrency(t.price)}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('Booking', { testId: t.id })}
              >
                <Text style={styles.addBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Popular packages</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {(packages ?? []).slice(0, 8).map((p) => (
          <View key={p.id} style={styles.richCard}>
            <View style={[styles.richCardArt, { backgroundColor: gradientForId(p.id) }]} />
            <Text style={styles.richCardTitle} numberOfLines={2}>{p.name}</Text>
            <Text style={styles.richCardMeta}>{p.tests?.length ?? 0} tests included</Text>
            <View style={styles.richCardFooter}>
              <Text style={styles.richCardPrice}>{formatCurrency(p.price)}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('Booking', { packageId: p.id })}
              >
                <Text style={styles.addBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const CARD_W = 168;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSoft, marginTop: 2, marginBottom: spacing.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickTile: {
    width: '31%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minHeight: 64,
    justifyContent: 'center',
    ...shadow.card,
  },
  quickLabel: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm, marginTop: spacing.sm },
  segmentRow: { gap: spacing.md, paddingBottom: spacing.lg, paddingRight: spacing.lg },
  segmentTile: { alignItems: 'center', width: 76 },
  segmentPhoto: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.greySoft, marginBottom: 6 },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  carousel: { gap: spacing.md, paddingBottom: spacing.lg, paddingRight: spacing.lg },
  richCard: {
    width: CARD_W,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  richCardArt: { height: 64 },
  richCardTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink, paddingHorizontal: spacing.sm, marginTop: spacing.sm, minHeight: 34 },
  richCardMeta: { fontSize: 11.5, color: colors.inkFaint, paddingHorizontal: spacing.sm, marginTop: 2 },
  richCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
  },
  richCardPrice: { fontSize: 13, fontWeight: '700', color: colors.ink },
  addBtn: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#0B7A76' },
});
