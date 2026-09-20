import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { FullScreenLoading } from './src/components/Spinner';

function Bootstrap() {
  const { bootstrapping } = useAuth();
  if (bootstrapping) return <FullScreenLoading />;
  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <Bootstrap />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
