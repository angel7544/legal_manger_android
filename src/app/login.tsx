import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking, Image } from 'react-native';
import { TextInput, Button, Text, Checkbox, Card, HelperText, useTheme } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { StatusBar } from 'expo-status-bar';
import { getSetting } from '../database/db';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming, 
  withDelay, 
  FadeInUp, 
  FadeInDown 
} from 'react-native-reanimated';

export default function LoginScreen() {
  const { login } = useAuth();
  const theme = useTheme();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sway/Tilt animation for the scales logo icon
  const scaleTilt = useSharedValue(0);

  useEffect(() => {
    scaleTilt.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 1500 }),
          withTiming(12, { duration: 1500 })
        ),
        -1, // Infinite loops
        true // Reverse direction
      )
    );
  }, []);

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${scaleTilt.value}deg` }],
    };
  });

  // Load saved credentials on screen load
  useEffect(() => {
    async function loadSavedCredentials() {
      try {
        const rememberSetting = await getSetting('remember_login', 'false');
        setRememberMe(rememberSetting === 'true');

        const savedUser = await getSetting('remembered_user', '');
        const savedPass = await getSetting('remembered_password', '');
        if (savedUser) {
          setUsername(savedUser);
        }
        if (savedPass) {
          setPassword(savedPass);
        }
      } catch (err) {
        console.error('Failed to load saved credentials:', err);
      }
    }
    loadSavedCredentials();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }
    
    setErrorMsg('');
    setLoading(true);
    
    const result = await login(username, password, rememberMe);
    
    setLoading(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Invalid credentials.');
    }
  };

  return (
    <ScreenBackground isLogin={true}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Animated.View 
            entering={FadeInUp.duration(1000).delay(100)} 
            style={styles.headerContainer}
          >
            <Animated.View style={[styles.logoCircle, { backgroundColor: 'transparent' }, animatedScaleStyle]}>
              <Image 
                source={require('../../assets/images/legal_logo3.png')} 
                style={{ width: 90, height: 90, borderRadius: 45 }} 
              />
            </Animated.View>
            <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
              न्यायRack
            </Text>
            <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.secondary }]}>
              Legal File & Location Management System
            </Text>
          </Animated.View>

          <View>
            <Card style={[styles.card, { 
              borderColor: theme.colors.outlineVariant,
              backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.82)' : 'rgba(255, 255, 255, 0.85)'
            }]} elevation={4}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.primary }]}>
                  Law Office Login
                </Text>
                
                {errorMsg ? (
                  <HelperText type="error" visible={!!errorMsg} style={styles.errorText}>
                    {errorMsg}
                  </HelperText>
                ) : null}

                <TextInput
                  label="Username"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setErrorMsg('');
                  }}
                  mode="outlined"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  left={<TextInput.Icon icon="account" />}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMsg('');
                  }}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.input}
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon 
                      icon={showPassword ? 'eye-off' : 'eye'} 
                      onPress={() => setShowPassword(!showPassword)} 
                    />
                  }
                />

                <View style={styles.rememberRow}>
                  <Checkbox.Android
                    status={rememberMe ? 'checked' : 'unchecked'}
                    onPress={() => setRememberMe(!rememberMe)}
                    color={theme.colors.primary}
                  />
                  <Text 
                    variant="bodyMedium" 
                    style={styles.rememberText}
                    onPress={() => setRememberMe(!rememberMe)}
                  >
                    Remember Login on this device
                  </Text>
                </View>

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={loading}
                  disabled={loading}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                >
                  Sign In
                </Button>
              </Card.Content>
            </Card>
          </View>

          <Animated.View 
            entering={FadeInDown.duration(1000).delay(500)} 
            style={styles.footer}
          >
            <Text variant="bodySmall" style={{ color: theme.colors.outline, fontWeight: '600', marginBottom: 4 }}>
              Offline-First Single-User System • India
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center', lineHeight: 18 }}>
              build by{' '}
              <Text 
                style={{ color: theme.colors.primary, fontWeight: 'bold', textDecorationLine: 'underline' }} 
                onPress={() => Linking.openURL('https://linkedin.com/in/angel3002')}
              >
                Angel Mehul Singh
              </Text>{' '}
              <Text 
                style={{ color: theme.colors.primary, fontWeight: 'bold', textDecorationLine: 'underline' }} 
                onPress={() => Linking.openURL('https://br31tech.live')}
              >
                @br31technologies
              </Text>{' '}
              with love and care
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 2,
  },
  titleEnglish: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.8,
    fontSize: 13,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    paddingVertical: 12,
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  rememberText: {
    marginLeft: 8,
  },
  button: {
    borderRadius: 12,
    elevation: 2,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
});
