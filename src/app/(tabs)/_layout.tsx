import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary,
        },
        headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerTitleAlign: 'center',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: theme.dark ? 0.25 : 0.06,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Nyaya Rack Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "view-dashboard" : "view-dashboard-outline"} 
              size={size + (focused ? 1 : 0)} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cases"
        options={{
          title: 'Physical Files',
          tabBarLabel: 'Files',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "folder-multiple" : "folder-multiple-outline"} 
              size={size + (focused ? 1 : 0)} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rack"
        options={{
          title: 'Rack Visualizer',
          tabBarLabel: 'Racks',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "bookshelf" : "bookshelf"} 
              size={size + (focused ? 1 : 0)} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="log-hearing"
        options={{
          title: 'Log Hearing',
          tabBarLabel: 'Log Hearing',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "calendar-clock" : "calendar-clock-outline"} 
              size={size + (focused ? 1 : 0)} 
              color={color} 
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'System Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "cog" : "cog-outline"} 
              size={size + (focused ? 1 : 0)} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
