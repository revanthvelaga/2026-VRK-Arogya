import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Audience } from '../api/types';

export type TabParamList = {
  Home: undefined;
  Catalog: { audience?: Audience } | undefined;
  Centers: undefined;
  Bookings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Login: undefined;
  Register: undefined;
  Booking: { testId?: string; packageId?: string; centerId?: string } | undefined;
  BookingDetail: { id: string };
  Insights: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
