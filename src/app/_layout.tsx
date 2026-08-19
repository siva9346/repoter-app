import { View, ActivityIndicator } from 'react-native';
import { Tabs } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import theme from '@/lib/theme';
import { useReporterStore } from '@/lib/store';

export default function RootLayout() {
  const hasHydrated = useReporterStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <Tabs
          screenOptions={{
            headerTitleStyle: { fontWeight: '700' },
            tabBarActiveTintColor: theme.colors.primary,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="view-dashboard" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="new-visit"
            options={{
              title: 'New Visit',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="map-marker-plus" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="reports"
            options={{
              title: 'Reports',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="format-list-bulleted" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="masters"
            options={{
              title: 'Masters',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="account-box-multiple" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cog" color={color} size={size} />
              ),
            }}
          />
        </Tabs>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
