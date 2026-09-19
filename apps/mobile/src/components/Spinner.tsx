import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export function LoadingLine({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function FullScreenLoading() {
  return (
    <View style={styles.full}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  label: { color: colors.inkSoft, fontSize: 14 },
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
