import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { Button } from './Button';
import { colors, spacing } from '../theme';

// In-screen equivalent of customer-web's <RequireAuth> route wrapper —
// React Navigation doesn't have a route-guard primitive, so protected
// screens render this instead of their real content when logged out.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (user) return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Log in to continue</Text>
      <Text style={styles.hint}>You need an account to book, track, or see your history.</Text>
      <View style={styles.actions}>
        <Button title="Log in" onPress={() => navigation.navigate('Login')} />
        <Button title="Create account" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
