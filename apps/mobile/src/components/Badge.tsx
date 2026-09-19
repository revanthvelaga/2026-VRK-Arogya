import { StyleSheet, Text, View } from 'react-native';
import type { BadgeVariant } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import { statusLabel } from '../lib/format';

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: colors.greySoft, fg: colors.inkSoft, dot: colors.inkFaint },
  accent: { bg: colors.accentSoft, fg: '#0B7A76', dot: colors.accent },
  amber: { bg: colors.amberSoft, fg: colors.amber, dot: colors.amber },
  red: { bg: colors.redSoft, fg: colors.red, dot: colors.red },
};

export function Badge({ status, variant }: { status: string; variant: BadgeVariant }) {
  const c = VARIANT_COLORS[variant];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.text, { color: c.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
