import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme, Divider } from 'react-native-paper';
import { Stack } from 'expo-router';
import { ScreenBackground } from '../components/ScreenBackground';

export default function ChangelogScreen() {
  const theme = useTheme();

  return (
    <ScreenBackground>
      <Stack.Screen 
        options={{
          title: 'Changelog',
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.dark ? theme.colors.surface : theme.colors.primary,
          },
          headerTintColor: theme.dark ? theme.colors.onSurface : '#ffffff',
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* Version 2.3.5 */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="titleLarge" style={[styles.versionTitle, { color: theme.colors.primary }]}>
                Version 2.3.5
              </Text>
              <View style={[styles.badge, { backgroundColor: theme.colors.primary + '20' }]}>
                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>Current</Text>
              </View>
            </View>
            <Text variant="bodySmall" style={styles.date}>June 2026</Text>
            
            <Divider style={styles.divider} />
            
            <Text variant="titleMedium" style={styles.sectionTitle}>✨ New Features & Improvements</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Unified Search:</Text> Moved the global search bar to the Files screen for quicker access. Removed the standalone search screen.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Smart Hearing Filters:</Text> Added a dedicated search bar in the Log Hearing screen to easily filter and find past proceedings by notes, client, or action.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Rich Case Search Info:</Text> When searching for a case to log a hearing, the dropdown now displays court name, case type, opposite party, and phone number to help identify the correct file immediately.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Security:</Text> Removed gradle.properties from version control to protect sensitive secrets.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Documentation:</Text> Added application architecture documentation (architecture.md) with mermaid diagrams.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Rack Visualizer:</Text> The app now supports drag and drop for rack management, making file organization effortless.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Git Ignore Fixes:</Text> Updated project git ignore rules for cleaner source management.</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Version 2.3.0 */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.versionTitle}>
              Version 2.3.0
            </Text>
            <Text variant="bodySmall" style={styles.date}>June 2026</Text>
            
            <Divider style={styles.divider} />
            
            <Text variant="titleMedium" style={styles.sectionTitle}>🛠 Improvements & Fixes</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Phone Validation:</Text> Added exact 10-digit validation for client phone numbers with real-time input formatting.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Hearing Dates:</Text> Next hearing date now strictly validates for future dates.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Date Pickers:</Text> Implemented date pickers for filing date and next hearing date.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>UI Fixes:</Text> Fixed keyboard overlay issues while adding or editing case files.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Data Integrity:</Text> Made Advocate Name and Physical Rack fields mandatory for better record completeness.</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Version 1.0.0 / Initial */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.versionTitle}>
              Version 1.0.0
            </Text>
            <Text variant="bodySmall" style={styles.date}>Initial Release</Text>
            
            <Divider style={styles.divider} />
            
            <Text variant="titleMedium" style={styles.sectionTitle}>🚀 Core App Launch</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Mobile Architecture:</Text> Implemented full offline-first mobile application structure.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>QR Code Scanning:</Text> Built-in support for generating and scanning file folder QR codes.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Database Management:</Text> SQLite integration with automated backup & restore capabilities.</Text>
              <Text style={styles.bulletItem}>• <Text style={styles.bold}>Rack Visualizer:</Text> Dynamic physical file tracking and visual shelf layout system.</Text>
            </View>
          </Card.Content>
        </Card>

      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionTitle: {
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  date: {
    opacity: 0.6,
    marginTop: 2,
    marginBottom: 12,
  },
  divider: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  bulletList: {
    paddingLeft: 4,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
    opacity: 0.85,
  },
  bold: {
    fontWeight: 'bold',
  },
});
