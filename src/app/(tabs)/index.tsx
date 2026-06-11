import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, Button, useTheme, ActivityIndicator, Searchbar, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDashboardStats, searchCases, getDashboardHearings, updateHearingStatus, deleteHearings } from '../../database/db';
import { Case, Hearing } from '../../types/db';
import { triggerBackup, triggerRestore } from '../../utils/backup';
import { ScreenBackground } from '../../components/ScreenBackground';

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<{ totalFiles: number; recentFiles: Case[] } | null>(null);
  const [hearings, setHearings] = useState<(Hearing & { client_name: string; file_number: string; case_number: string })[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Case[]>([]);
  const [searching, setSearching] = useState(false);

  // Real-time search from dashboard
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let isMounted = true;
    async function performSearch() {
      setSearching(true);
      try {
        const data = await searchCases(searchQuery);
        if (isMounted) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Dashboard search error:', err);
      } finally {
        if (isMounted) setSearching(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery]);

  // Reload stats and hearings whenever this screen is focused
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function loadStatsAndHearings() {
        try {
          const s = await getDashboardStats();
          const h = await getDashboardHearings();
          if (isMounted) {
            setStats(s);
            setHearings(h);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error loading dashboard data:', error);
          if (isMounted) setLoading(false);
        }
      }
      loadStatsAndHearings();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const handleToggleHearingStatus = async (hearingId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Attended' ? 'Pending' : 'Attended';
    try {
      await updateHearingStatus(hearingId, newStatus);
      const h = await getDashboardHearings();
      setHearings(h);
    } catch (err) {
      console.error('Error updating status:', err);
      Alert.alert('Error', 'Failed to update hearing status.');
    }
  };

  const handleDeleteHearing = async (hearingId: number) => {
    Alert.alert(
      'Delete Hearing Log',
      'Are you sure you want to permanently delete this hearing log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHearings([hearingId]);
              const h = await getDashboardHearings();
              setHearings(h);
            } catch (err) {
              console.error('Error deleting hearing:', err);
              Alert.alert('Error', 'Failed to delete hearing log.');
            }
          },
        },
      ]
    );
  };

  const handleBackup = async () => {
    Alert.alert('Database Backup', 'Export current SQLite database backup?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Export',
        onPress: async () => {
          const success = await triggerBackup();
          if (success) {
            Alert.alert('Success', 'Database backup file exported successfully.');
          }
        },
      },
    ]);
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
            const success = await triggerRestore();
            if (success) {
              Alert.alert('Success', 'Database restored successfully! Re-loading stats...');
              // Reload stats
              const s = await getDashboardStats();
              setStats(s);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenBackground>
    );
  }

  const quickActions = [
    {
      title: 'Add File',
      icon: 'file-plus',
      color: theme.colors.primary,
      onPress: () => router.push('/case/add'),
    },
    {
      title: 'Log Hearing',
      icon: 'calendar-plus',
      color: '#805ad5',
      onPress: () => router.push('/log-hearing' as any),
    },
    {
      title: 'QR Scanner',
      icon: 'qrcode-scan',
      color: '#319795',
      onPress: () => router.push('/scan'),
    },
    {
      title: 'Search File',
      icon: 'file-search',
      color: '#2b6cb0',
      onPress: () => router.push('/(tabs)/search'),
    },
    {
      title: 'Print Label',
      icon: 'printer',
      color: '#b7791f',
      onPress: () => router.push('/(tabs)/cases'),
    },
    {
      title: 'Backup Data',
      icon: 'database-export',
      color: '#4a5568',
      onPress: handleBackup,
    },
    // {
    //   title: 'Restore Data',
    //   icon: 'database-import',
    //   color: '#e53e3e',
    //   onPress: handleRestore,
    // },
  ];

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={[styles.container, { backgroundColor: 'transparent' }]} 
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
      {/* Dashboard Search Bar */}
      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by client, file, case, phone..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          elevation={1}
          style={styles.searchbar}
        />
      </View>

      {/* Overview Stat Card */}
      <View style={styles.section}>
        <Card style={[styles.statCard, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Card.Content style={styles.statContent}>
            <View>
              <Text style={styles.statLabel}>TOTAL PHYSICAL RECORDS</Text>
              <Text style={styles.statCount}>{stats?.totalFiles ?? 0}</Text>
            </View>
            <MaterialCommunityIcons name="folder-text-outline" size={54} color="#ffffff" style={styles.statIcon} />
          </Card.Content>
        </Card>
      </View>

      {/* Quick Action Grid */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {quickActions.map((action, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.gridItem, { backgroundColor: theme.colors.surface }]}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: action.color + '15' }]}>
              <MaterialCommunityIcons name={action.icon as any} size={28} color={action.color} />
            </View>
            <Text variant="labelLarge" style={[styles.actionText, { color: theme.colors.onSurface }]}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hearings Agenda Section (Moved below Quick Actions) */}
      {!searchQuery && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Hearings Agenda</Text>
          <View style={styles.section}>
            {hearings.length > 0 ? (
              hearings.map((item) => {
                const isAttended = item.status === 'Attended';
                const isCompleted = item.status === 'Completed';
                const isAdjourned = item.status === 'Adjourned';
                const isTicked = isAttended || isCompleted;
                const statusColor = isCompleted ? '#38a169' : isAttended ? '#3182ce' : isAdjourned ? '#dd6b20' : '#718096';
                
                return (
                  <Card key={item.id} style={styles.agendaCard} elevation={1}>
                    <Card.Content style={styles.agendaContent}>
                      <TouchableOpacity 
                        style={styles.agendaLeft}
                        onPress={() => item.id && handleToggleHearingStatus(item.id, item.status)}
                      >
                        <MaterialCommunityIcons 
                          name={isTicked ? "check-circle" : "checkbox-blank-circle-outline"} 
                          size={24} 
                          color={isTicked ? theme.colors.primary : theme.colors.outline} 
                        />
                      </TouchableOpacity>
                      <View style={styles.agendaMiddle}>
                        <View style={styles.agendaTitleRow}>
                          <Text variant="titleSmall" style={[styles.agendaClient, isTicked && styles.textStrike]} numberOfLines={1}>
                            {item.client_name}
                          </Text>
                          <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusColor + '15' }]}>
                            {item.status}
                          </Text>
                        </View>
                        <Text variant="bodySmall" style={styles.agendaMeta}>
                          File: {item.file_number} • Date: {item.hearing_date}
                        </Text>
                        {item.next_action ? (
                          <Text variant="bodySmall" style={styles.agendaAction} numberOfLines={1}>
                            Next: {item.next_action}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity 
                          onPress={() => router.push({ pathname: '/log-hearing' as any, params: { caseId: item.case_id } })}
                          style={styles.agendaRight}
                        >
                          <MaterialCommunityIcons name="calendar-edit" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => item.id && handleDeleteHearing(item.id)}
                          style={[styles.agendaRight, { marginLeft: 8 }]}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            ) : (
              <Card style={styles.emptyCard}>
                <Card.Content style={styles.emptyContent}>
                  <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.colors.outline} />
                  <Paragraph style={{ marginTop: 8, color: theme.colors.outline, fontSize: 13 }}>No hearings scheduled</Paragraph>
                </Card.Content>
              </Card>
            )}
          </View>
        </>
      )}

      {/* Recent Files or Search Results Section */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        {searchQuery ? 'Search Results' : 'Recently Added Files'}
      </Text>
      <View style={styles.section}>
        {searching ? (
          <View style={styles.searchLoading}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : searchQuery ? (
          searchResults.length > 0 ? (
            searchResults.map((item) => (
              <Card
                key={item.id}
                style={styles.recentCard}
                onPress={() => router.push(`/case/${item.id}`)}
                elevation={1}
              >
                <Card.Title
                  title={item.client_name}
                  subtitle={`${item.file_number} • Case: ${item.case_number}`}
                  left={(props) => (
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={28}
                      color={theme.colors.primary}
                      style={styles.cardLeftIcon}
                    />
                  )}
                  right={(props) => (
                    <View style={styles.locationTag}>
                      <Text variant="labelSmall" style={[styles.locationText, { backgroundColor: theme.colors.primary + '15', color: theme.colors.primary }]}>
                        Rack {item.rack_number || 'N/A'}-{item.shelf_number || 'N/A'}
                      </Text>
                    </View>
                  )}
                />
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons name="magnify-close" size={40} color={theme.colors.outline} />
                <Paragraph style={{ marginTop: 8, color: theme.colors.outline }}>No matching files found</Paragraph>
              </Card.Content>
            </Card>
          )
        ) : stats?.recentFiles && stats.recentFiles.length > 0 ? (
          stats.recentFiles.map((item) => (
            <Card
              key={item.id}
              style={styles.recentCard}
              onPress={() => router.push(`/case/${item.id}`)}
              elevation={1}
            >
              <Card.Title
                title={item.client_name}
                subtitle={`${item.file_number} • Case: ${item.case_number}`}
                left={(props) => (
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={28}
                    color={theme.colors.primary}
                    style={styles.cardLeftIcon}
                  />
                )}
                right={(props) => (
                  <View style={styles.locationTag}>
                    <Text variant="labelSmall" style={[styles.locationText, { backgroundColor: theme.colors.primary + '15', color: theme.colors.primary }]}>
                      Rack {item.rack_number || 'N/A'}-{item.shelf_number || 'N/A'}
                    </Text>
                  </View>
                )}
              />
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <MaterialCommunityIcons name="folder-open-outline" size={40} color={theme.colors.outline} />
              <Paragraph style={{ marginTop: 8, color: theme.colors.outline }}>No physical file records found</Paragraph>
              <Button mode="outlined" style={{ marginTop: 12 }} onPress={() => router.push('/case/add')}>
                Add First File
              </Button>
            </Card.Content>
          </Card>
        )}
      </View>
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
    padding: 16,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchbar: {
    borderRadius: 12,
  },
  searchLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginLeft: 4,
  },
  statCard: {
    borderRadius: 12,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statLabel: {
    color: '#ffffff',
    opacity: 0.8,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1,
  },
  statCount: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statIcon: {
    opacity: 0.9,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  gridItem: {
    width: '31.5%',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontWeight: '700',
    fontSize: 11.5,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  recentCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  cardLeftIcon: {
    marginRight: 8,
  },
  locationTag: {
    marginRight: 16,
  },
  locationText: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 12,
    paddingVertical: 16,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaCard: {
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  agendaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  agendaLeft: {
    marginRight: 10,
  },
  agendaMiddle: {
    flex: 1,
  },
  agendaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  agendaClient: {
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  statusBadge: {
    fontSize: 9.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  agendaMeta: {
    opacity: 0.6,
    fontSize: 11,
  },
  agendaAction: {
    opacity: 0.8,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  agendaRight: {
    padding: 6,
    marginLeft: 8,
  },
  textStrike: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 16,
    borderRadius: 28,
  },
});
