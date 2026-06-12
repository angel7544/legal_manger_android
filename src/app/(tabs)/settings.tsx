import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking, Image } from 'react-native';
import { List, Divider, Text, Switch, Card, Button, Dialog, Portal, TextInput, HelperText, useTheme, FAB, IconButton } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { useThemeMode } from '../../hooks/useThemeMode';
import { useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { triggerBackup, triggerRestore } from '../../utils/backup';
import { getDashboardStats } from '../../database/db';
import { ScreenBackground } from '../../components/ScreenBackground';
import { useEffect } from 'react';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { user, logout, changePassword } = useAuth();
  const { themeMode, toggleTheme } = useThemeMode();

  // Help Dialog state
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="information"
          iconColor={theme.dark ? theme.colors.onSurface : '#ffffff'}
          onPress={() => setHelpVisible(true)}
        />
      ),
    });
  }, [navigation, theme]);

  // Change Password Dialog state
  const [passDialogVisible, setPassDialogVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // FAB visibility & scroll tracking
  const [fabVisible, setFabVisible] = useState(true);
  const scrollY = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    if (Math.abs(currentOffset - scrollY.current) > 10) {
      if (currentOffset > scrollY.current && currentOffset > 50) {
        setFabVisible(false);
      } else {
        setFabVisible(true);
      }
      scrollY.current = currentOffset;
    }
  };

  const handleBackup = async () => {
    const success = await triggerBackup();
    if (success) {
      Alert.alert('Success', 'Database backup file exported successfully.');
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Database',
      'WARNING: Restoring will overwrite all current local data with the backup file. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await triggerRestore();
              if (success) {
                Alert.alert('Success', 'Database restored successfully!');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to restore database.');
            }
          },
        },
      ]
    );
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setPassError('Password must be at least 4 characters long.');
      return;
    }

    setPassError('');
    setPassLoading(true);

    const result = await changePassword(oldPassword, newPassword);

    setPassLoading(false);
    if (result.success) {
      Alert.alert('Success', 'Password updated successfully!');
      setPassDialogVisible(false);
      // Reset state
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPassError(result.error || 'Failed to change password.');
    }
  };

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={[styles.container, { backgroundColor: 'transparent' }]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
      {/* Profile Card */}
      <Card style={[styles.sectionCard, { 
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'
      }]} elevation={2}>
        <Card.Content style={styles.profileContent}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <MaterialCommunityIcons name="account" size={32} color="#ffffff" />
          </View>
          <View style={styles.profileInfo}>
            <Text variant="headlineSmall" style={[styles.username, { color: theme.colors.primary }]}>
              {user?.username}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.secondary, fontWeight: '600' }}>
              Office Administrator
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
              Secure Local Session
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Preferences Section Card */}
      <Card style={[styles.sectionCard, { 
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'
      }]} elevation={2}>
        <Card.Content style={{ paddingVertical: 8 }}>
          <Text variant="titleMedium" style={[styles.sectionHeader, { color: theme.colors.primary }]}>
            App Preferences
          </Text>
          <List.Item
            title="Dark Theme"
            description="Enable dark colors for low light use"
            left={(props) => <List.Icon {...props} icon="theme-light-dark" color={theme.colors.secondary} />}
            right={() => (
              <Switch
                value={themeMode === 'dark'}
                onValueChange={toggleTheme}
                color={theme.colors.primary}
              />
            )}
            style={styles.listItem}
          />
          <Divider style={styles.itemDivider} />
          <List.Item
            title="User Guide & Features"
            description="Learn how to use NyayaRack features"
            left={(props) => <List.Icon {...props} icon="information" color={theme.colors.secondary} />}
            right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} style={{ alignSelf: 'center', marginRight: 8 }} />}
            onPress={() => setHelpVisible(true)}
            style={styles.listItem}
          />
          <Divider style={styles.itemDivider} />
          <List.Item
            title="Changelog"
            description="View recent updates and version history"
            left={(props) => <List.Icon {...props} icon="history" color={theme.colors.secondary} />}
            right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.outline} style={{ alignSelf: 'center', marginRight: 8 }} />}
            onPress={() => router.push('../changelog')}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Data & Security Section Card */}
      <Card style={[styles.sectionCard, { 
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'
      }]} elevation={2}>
        <Card.Content style={{ paddingVertical: 8 }}>
          <Text variant="titleMedium" style={[styles.sectionHeader, { color: theme.colors.primary }]}>
            Security & Backup
          </Text>
          
          <List.Item
            title="Change Password"
            description="Update your administrator password"
            left={(props) => <List.Icon {...props} icon="lock-reset" color={theme.colors.secondary} />}
            onPress={() => setPassDialogVisible(true)}
            style={styles.listItem}
          />
          <Divider style={styles.itemDivider} />
          
          <List.Item
            title="Backup Database"
            description="Share/Export SQLite database backup file"
            left={(props) => <List.Icon {...props} icon="database-export" color={theme.colors.secondary} />}
            onPress={handleBackup}
            style={styles.listItem}
          />
          <Divider style={styles.itemDivider} />
          
          <List.Item
            title="Restore Database"
            description="Import database from .db or .sql backup file"
            left={(props) => <List.Icon {...props} icon="database-import" color={theme.colors.secondary} />}
            onPress={handleRestore}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* Session Section Card */}
      <Card style={[styles.sectionCard, { 
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'
      }]} elevation={2}>
        <Card.Content style={{ paddingVertical: 8 }}>
          <List.Item
            title="Sign Out"
            titleStyle={{ color: theme.colors.error, fontWeight: 'bold' }}
            description="Exit admin session securely"
            left={(props) => <List.Icon {...props} icon="logout" color={theme.colors.error} />}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: logout },
              ]);
            }}
            style={styles.listItem}
          />
        </Card.Content>
      </Card>

      {/* About App Section */}
      <Card style={[styles.sectionCard, styles.aboutCard, { 
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.dark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)'
      }]} elevation={2}>
        <Card.Content style={styles.aboutContent}>
          <View style={styles.aboutHeader}>
            <View style={[styles.aboutIconContainer, { backgroundColor: 'transparent' }]}>
              <Image 
                source={require('../../../assets/images/legal_logo3.png')} 
                style={{ width: 44, height: 44, borderRadius: 22 }} 
              />
            </View>
          <Divider style={{ marginVertical: 14, backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />


            <View style={styles.aboutHeaderText}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>NyayaRack Android</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Version 2.3.5 • India • Offline-First</Text>
            </View>
          </View>
          
          <Divider style={{ marginVertical: 14, backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />

          <View style={[styles.developerInfo, { 
            backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
          }]}>
            <Text variant="bodyMedium" style={{ fontWeight: '700', color: theme.colors.primary }}>
              Developed by br31tech
            </Text>
            <Text variant="bodySmall" style={{ fontWeight: '600', color: theme.colors.secondary, marginTop: 2 }}>
              Angel Mehul Singh
            </Text>
            <Text variant="bodySmall" style={[styles.developerSub, { color: theme.colors.outline }]}>
              BR31 Technologies (@br31technologies)
            </Text>
            <Text variant="bodySmall" style={[styles.developerSub, { color: theme.colors.outline, marginTop: 4 }]}>
              Website: br31tech.live
            </Text>
          </View>

          <View style={styles.buttonGrid}>
            <Button 
              mode="contained-tonal" 
              icon="email" 
              onPress={() => Linking.openURL('mailto:angelsingh2199@gmail.com')}
              style={styles.aboutBtn}
              contentStyle={styles.aboutBtnContent}
              labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
            >
              Email Us
            </Button>
            <Button 
              mode="contained-tonal" 
              icon="web" 
              onPress={() => Linking.openURL('https://br31tech.live')}
              style={styles.aboutBtn}
              contentStyle={styles.aboutBtnContent}
              labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
            >
              Website
            </Button>
            <Button 
              mode="contained-tonal" 
              icon="github" 
              onPress={() => Linking.openURL('https://github.com/angel7544')}
              style={styles.aboutBtn}
              contentStyle={styles.aboutBtnContent}
              labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
            >
              GitHub
            </Button>
            <Button 
              mode="contained-tonal" 
              icon="linkedin" 
              onPress={() => Linking.openURL('https://linkedin.com/in/angel3002')}
              style={styles.aboutBtn}
              contentStyle={styles.aboutBtnContent}
              labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
            >
              LinkedIn
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Change Password Dialog Portal */}
      <Portal>
        <Dialog visible={passDialogVisible} onDismiss={() => setPassDialogVisible(false)}>
          <Dialog.Title>Change Password</Dialog.Title>
          <Dialog.Content>
            {passError ? (
              <HelperText type="error" visible={!!passError} style={styles.dialogError}>
                {passError}
              </HelperText>
            ) : null}

            <TextInput
              label="Current Password"
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              mode="outlined"
              style={styles.dialogInput}
            />

            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              mode="outlined"
              style={styles.dialogInput}
            />

            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              mode="outlined"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPassDialogVisible(false)} disabled={passLoading}>
              Cancel
            </Button>
            <Button onPress={handlePasswordChange} loading={passLoading} disabled={passLoading}>
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* 2. How to Use / App Features Dialog */}
        <Dialog visible={helpVisible} onDismiss={() => setHelpVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title style={{ fontWeight: 'bold' }}>NyayaRack Guide</Dialog.Title>
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>
                What's New in v2.3.5
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 8, paddingLeft: 18 }}>
                • Unified Search: Moved the global search bar to the Files screen.{"\n"}
                • Smart Hearing Filters: Added a search bar in the Log Hearing screen.{"\n"}
                • Rich Case Search Info: Case dropdowns now display court, type, and phone.{"\n"}
                • Rack Visualizer: Drag and drop support for easy file organization.{"\n"}
                • Security: Removed sensitive gradle properties from version control.{"\n"}
                • Documentation: Added architecture.md with mermaid diagrams.
              </Text>

              <Divider style={{ marginVertical: 12 }} />

              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>
                Key Features
              </Text>
              
              <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>
                📁 Physical File Location Tracking
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 8, paddingLeft: 18 }}>
                Assign cases to specific Rack, Shelf, and Position coordinates. Keep track of file movements (Office, Court, Junior).
              </Text>

              <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>
                ⚖️ Case Hearings Log
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 8, paddingLeft: 18 }}>
                Maintain a timeline log for each hearing, complete with notes, next action instructions, and outcome status (Pending, Adjourned, Completed).
              </Text>

              <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>
                🔍 Instant File Search
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 8, paddingLeft: 18 }}>
                Search matching records in real-time by client name, file number, case number, or phone.
              </Text>

              <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>
                🖨️ Label & QR Printing
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 8, paddingLeft: 18 }}>
                Print or share front folder sheet labels and spine labels containing auto-generated QR codes.
              </Text>

              <Text variant="bodyMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>
                💾 Offline Backup & Restore
              </Text>
              <Text variant="bodySmall" style={{ opacity: 0.8, marginBottom: 12, paddingLeft: 18 }}>
                Safeguard database files using simple export and import functions.
              </Text>

              <Divider style={{ marginVertical: 12 }} />

              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>
                How to Use
              </Text>
              <Text variant="bodySmall" style={{ lineHeight: 18, opacity: 0.8 }}>
                1. **Add File**: Tap the "+" floating button or "Add File" quick action to record a physical file folder and its rack-shelf location.{"\n"}
                2. **Print Labels**: Print the front label, stick it on the file cover, and place it in the designated shelf slot.{"\n"}
                3. **Scan QR Code**: Tap "QR Scanner" on the dashboard to scan folder QR codes for instant lookup.{"\n"}
                4. **Log Proceedings**: Open any file record, tap "Log Hearing" to schedule dates and save notes.{"\n"}
                5. **Track Agenda**: Check the dashboard agenda daily for upcoming hearings and status check-offs.
              </Text>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setHelpVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScrollView>
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#ffffff"
        visible={fabVisible}
        onPress={() => router.push('/case/add')}
      />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    opacity: 0.85,
  },
  listItem: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  itemDivider: {
    marginHorizontal: 16,
    opacity: 0.6,
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogError: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  aboutCard: {
    marginBottom: 48,
  },
  aboutContent: {
    paddingVertical: 4,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  aboutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutHeaderText: {
    marginLeft: 12,
  },
  developerInfo: {
    marginVertical: 12,
  },
  developerSub: {
    marginTop: 2,
    fontSize: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  aboutBtn: {
    width: '48%',
    marginBottom: 10,
    borderRadius: 10,
  },
  aboutBtnContent: {
    paddingVertical: 2,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 16,
    borderRadius: 28,
  },
});
