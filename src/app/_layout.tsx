import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, ActivityIndicator, useTheme } from 'react-native-paper';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { ThemeModeProvider, useThemeMode } from '../hooks/useThemeMode';
import { useEffect, useState } from 'react';
import { initDatabase, getSetting } from '../database/db';
import { View, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore/log errors in environments where it might fail */
});

// Custom colors to make it look premium and tailored for law offices (deep navy/slate blue primary)
const customLightColors = {
  ...MD3LightTheme.colors,
  primary: '#641d1dff', // Deep brown
  secondary: '#3fbcc3ff',
  background: '#f7fafc',
  surface: '#ffffff',
  error: '#e53e3e',
};

const customDarkColors = {
  ...MD3DarkTheme.colors,
  primary: '#90cdf4', // Light slate blue
  secondary: '#63b3ed',
  background: '#1a202c',
  surface: '#2d3748',
  error: '#feb2b2',
};

const PremiumLightTheme = {
  ...MD3LightTheme,
  colors: customLightColors,
};

const PremiumDarkTheme = {
  ...MD3DarkTheme,
  colors: customDarkColors,
};

function NavigationWrapper() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (isLoading) return;

    // Determine if user is in an authentication screen
    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login screen if not logged in
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to dashboard if logged in but trying to go to login
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' }}>
        <ActivityIndicator size="large" color="#1a365d" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, headerTitleAlign: 'center' }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="case/[id]" 
        options={{ 
          headerShown: true, 
          title: 'Case Details',
          headerStyle: { backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary },
          headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        }} 
      />
      <Stack.Screen 
        name="case/add" 
        options={{ 
          headerShown: true, 
          title: 'Add New Case',
          headerStyle: { backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary },
          headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        }} 
      />
      <Stack.Screen 
        name="case/edit" 
        options={{ 
          headerShown: true, 
          title: 'Edit Case Details',
          headerStyle: { backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary },
          headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        }} 
      />
      <Stack.Screen 
        name="scan" 
        options={{ 
          headerShown: true, 
          title: 'Scan File QR Code',
          headerStyle: { backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary },
          headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        }} 
      />
    </Stack>
  );
}

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { themeMode } = useThemeMode();
  const theme = themeMode === 'dark' ? PremiumDarkTheme : PremiumLightTheme;
  
  return (
    <PaperProvider theme={theme}>
      <StatusBar style="light" />
      {children}
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [initialTheme, setInitialTheme] = useState<'light' | 'dark'>('light');
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    async function setup() {
      try {
        // Initialize SQLite schemas
        await initDatabase();
        // Load settings
        const defaultTheme = systemColorScheme === 'dark' ? 'dark' : 'light';
        const savedTheme = await getSetting('theme_mode', defaultTheme);
        setInitialTheme(savedTheme as 'light' | 'dark');
      } catch (err) {
        console.error('Failed database setup:', err);
      } finally {
        setDbReady(true);
        // Hide the splash screen once everything is ready
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    setup();
  }, []);

  const renderContent = () => {
    if (!dbReady) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7fafc' }}>
          <ActivityIndicator size="large" color="#1a365d" />
        </View>
      );
    }

    return (
      <ThemeModeProvider initialTheme={initialTheme}>
        <AppThemeProvider>
          <AuthProvider>
            <NavigationWrapper />
          </AuthProvider>
        </AppThemeProvider>
      </ThemeModeProvider>
    );
  };

  return (
    <SafeAreaProvider>
      {renderContent()}
    </SafeAreaProvider>
  );
}
