import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.inkFaint, textAlign: 'center', marginTop: spacing.xs },
  errorBanner: {
    backgroundColor: colors.redSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.red, fontSize: 13 },
});
