import React from 'react';
import { StyleSheet, View, ImageBackground, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  isLogin?: boolean;
  style?: ViewStyle;
}

export function ScreenBackground({ children, isLogin = false, style }: ScreenBackgroundProps) {
  const theme = useTheme();

  // Custom transparent overlays depending on light or dark theme, and if it's the login screen.
  // Login screen overlay is slightly more transparent to let the premium background show nicely,
  // while general app screens use a high opacity to act as a subtle watermark that doesn't affect list readability.
  const overlayColor = theme.dark
    ? (isLogin ? 'rgba(10, 18, 32, 0.82)' : 'rgba(26, 32, 44, 0.95)')
    : (isLogin ? 'rgba(245, 247, 250, 0.82)' : 'rgba(247, 250, 252, 0.96)');

  return (
    <ImageBackground
      source={require('../../assets/images/legal_background.jpg')}
      style={[styles.background, style]}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
