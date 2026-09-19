import { Text, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { CentersScreen } from '../screens/CentersScreen';
import { MyBookingsScreen } from '../screens/MyBookingsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { BookingDetailScreen } from '../screens/BookingDetailScreen';
import { InsightsScreen } from '../screens/InsightsScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function AccountHeaderButton() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (user) {
    return (
      <TouchableOpacity onPress={logout}>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Log out</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Log in</Text>
    </TouchableOpacity>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerRight: () => <AccountHeaderButton />,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.ink },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Arogya' }} />
      <Tab.Screen name="Catalog" component={CatalogScreen} options={{ title: 'Catalog' }} />
      <Tab.Screen name="Centers" component={CentersScreen} options={{ title: 'Centers' }} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTitleStyle: { color: colors.ink } }}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
      <Stack.Screen name="Booking" component={BookingScreen} options={{ title: 'Book a test' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
      <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
    </Stack.Navigator>
  );
}
