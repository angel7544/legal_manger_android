import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import { TextInput, Button, Text, Card, HelperText, useTheme, List, Divider, FAB, SegmentedButtons, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCaseById, searchCases, addHearing, updateHearing, getDashboardHearings, updateHearingStatus, deleteHearings } from '../../database/db';
import { Case, Hearing } from '../../types/db';
import { ScreenBackground } from '../../components/ScreenBackground';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LogHearingTabScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Look up caseId from router query params (e.g. redirect from case details)
  const params = useLocalSearchParams<{ caseId?: string }>();
  const preSelectedId = params.caseId ? parseInt(params.caseId, 10) : null;

  // ScrollView Ref
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Logged Hearings state for agenda list
  const [hearings, setHearings] = useState<(Hearing & { client_name: string; file_number: string; case_number: string })[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(true);

  const loadHearings = async () => {
    try {
      setLoadingHearings(true);
      const data = await getDashboardHearings();
      setHearings(data);
    } catch (err) {
      console.error('Error loading hearings in log-hearing screen:', err);
    } finally {
      setLoadingHearings(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHearings();
    }, [])
  );

  const handleToggleHearingStatus = async (hearingId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Attended' ? 'Pending' : 'Attended';
    try {
      await updateHearingStatus(hearingId, newStatus);
      await loadHearings();
    } catch (err) {
      console.error('Error toggling status on log-hearing list:', err);
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
              await loadHearings();
            } catch (err) {
              console.error('Error deleting hearing:', err);
              Alert.alert('Error', 'Failed to delete hearing log.');
            }
          },
        },
      ]
    );
  };

  const handleEditHearing = async (hearing: any) => {
    try {
      setLoadingCase(true);
      const c = await getCaseById(hearing.case_id);
      if (c) {
        setSelectedCase(c);
        setEditingHearingId(hearing.id);
        setHearingDate(hearing.hearing_date || '');
        setNextAction(hearing.next_action || '');
        setNotes(hearing.hearing_notes || '');
        setHearingStatus(hearing.status || 'Pending');
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch (err) {
      console.error('Error loading hearing in form:', err);
      Alert.alert('Error', 'Failed to load hearing details into the form.');
    } finally {
      setLoadingCase(false);
    }
  };

  // Selected Case State
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);

  // Search State (if no case pre-selected)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Case[]>([]);
  const [searching, setSearching] = useState(false);
  const [hearingSearchQuery, setHearingSearchQuery] = useState('');

  // Form State
  const [editingHearingId, setEditingHearingId] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [hearingDate, setHearingDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [nextAction, setNextAction] = useState('');
  const [notes, setNotes] = useState('');
  const [hearingStatus, setHearingStatus] = useState('Pending'); // 'Pending', 'Adjourned', 'Completed'

  // Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setHearingDate(`${yyyy}-${mm}-${dd}`);
      if (errors.hearingDate) setErrors({ ...errors, hearingDate: '' });
    }
  };

  // Load pre-selected case if caseId is passed
  useEffect(() => {
    async function loadCase() {
      if (preSelectedId && !isNaN(preSelectedId)) {
        setLoadingCase(true);
        try {
          const c = await getCaseById(preSelectedId);
          if (c) {
            setSelectedCase(c);
          }
        } catch (err) {
          console.error('Error loading preselected case:', err);
          Alert.alert('Error', 'Failed to load case details.');
        } finally {
          setLoadingCase(false);
        }
      }
    }
    loadCase();
  }, [preSelectedId]);

  // Real-time search for cases when query changes
  useEffect(() => {
    if (preSelectedId && selectedCase) return; // Don't search if pre-selected and loaded

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
        console.error('Case search error:', err);
      } finally {
        if (isMounted) setSearching(false);
      }
    }

    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchQuery, preSelectedId, selectedCase]);

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!selectedCase) {
      tempErrors.case = 'Please search and select a case file.';
    }

    if (!hearingDate.trim()) {
      tempErrors.hearingDate = 'Hearing date is required.';
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(hearingDate.trim())) {
        tempErrors.hearingDate = 'Use YYYY-MM-DD format.';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !selectedCase) return;

    setSaving(true);
    try {
      if (editingHearingId) {
        await updateHearing(
          editingHearingId,
          selectedCase.id!,
          hearingDate.trim(),
          notes.trim(),
          nextAction.trim(),
          hearingStatus
        );
      } else {
        await addHearing(
          selectedCase.id!,
          hearingDate.trim(),
          notes.trim(),
          nextAction.trim(),
          hearingStatus
        );
      }

      Alert.alert('Success', `Hearing details ${editingHearingId ? 'updated' : 'logged'} successfully!`, [
        {
          text: 'OK',
          onPress: () => {
            // Reset form details
            setNextAction('');
            setNotes('');
            setHearingStatus('Pending');
            setEditingHearingId(null);
            loadHearings();
            // If it was redirected from case details, go back. Otherwise, clear selected case.
            if (preSelectedId) {
              router.back();
            } else {
              setSelectedCase(null);
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving hearing:', error);
      Alert.alert('Error', 'Failed to log case hearing.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusButtonColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#38a169';
      case 'Attended': return '#3182ce';
      case 'Adjourned': return '#dd6b20';
      default: return '#718096';
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.outerContainer}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Redesigned Premium Header Card */}
          <Card style={[styles.headerCard, { backgroundColor: theme.colors.primary }]} elevation={3}>
            <Card.Content>
              <View style={styles.headerInfoRow}>
                <View>
                  <Text variant="headlineSmall" style={styles.headerTitle}>LOG CASE PROCEEDING</Text>
                  <Text variant="bodySmall" style={styles.headerSubtitle}>
                    Add hearings, adjournment reasons, and next actions
                  </Text>
                </View>
                <MaterialCommunityIcons name="calendar-clock" size={40} color="#ffffff" style={styles.headerIcon} />
              </View>
            </Card.Content>
          </Card>

          {/* Case Selection Card */}
          <Card style={styles.card} elevation={1}>
            <Card.Content>
              <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
                1. Select Case File Record
              </Text>

              {loadingCase ? (
                <Text style={styles.loadingText}>Loading file details...</Text>
              ) : selectedCase ? (
                // Selected Case Detail View (Redesigned Premium Display Card)
                <View style={styles.selectedCaseContainer}>
                  <View style={styles.caseHeader}>
                    <View style={styles.caseTag}>
                      <Text style={styles.caseTagText}>ACTIVE RECORD SELECTED</Text>
                    </View>
                    {!preSelectedId && (
                      <TouchableOpacity onPress={() => {
                        setSelectedCase(null);
                        setEditingHearingId(null);
                      }} style={styles.changeBadge}>
                        <Text style={[styles.changeText, { color: theme.colors.primary }]}>Switch Case</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.caseDetailsRow}>
                    <MaterialCommunityIcons name="file-document" size={36} color={theme.colors.primary} style={styles.caseIcon} />
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={styles.clientName}>{selectedCase.client_name}</Text>
                      <Text variant="bodyMedium" style={styles.fileNumber}>File Number: {selectedCase.file_number}</Text>
                    </View>
                  </View>
                  
                  <Divider style={styles.divider} />
                  
                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="gavel" size={16} color={theme.colors.outline} />
                      <Text variant="bodySmall" style={styles.metaText}>No: {selectedCase.case_number}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="bank" size={16} color={theme.colors.outline} />
                      <Text variant="bodySmall" style={styles.metaText} numberOfLines={1}>{selectedCase.court_name || 'N/A'}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                // Search Input & Search Results
                <View>
                  <TextInput
                    label="Search by client, file #, case #, phone..."
                    value={searchQuery}
                    onChangeText={(val) => {
                      setSearchQuery(val);
                      if (errors.case) setErrors({ ...errors, case: '' });
                    }}
                    mode="outlined"
                    placeholder="Search case files..."
                    left={<TextInput.Icon icon="magnify" />}
                    error={!!errors.case}
                    style={styles.searchInput}
                  />
                  {errors.case ? <HelperText type="error" style={styles.errorText}>{errors.case}</HelperText> : null}

                  {searching && <Text style={styles.searchingText}>Searching file directory...</Text>}

                  {searchResults.length > 0 && (
                    <View style={styles.searchResultsContainer}>
                      {searchResults.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            setSelectedCase(item);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          style={[styles.resultItem, { borderBottomColor: theme.colors.outlineVariant }]}
                        >
                          <List.Item
                            title={`${item.client_name}${item.opposite_party ? ` vs ${item.opposite_party}` : ''}`}
                            titleNumberOfLines={2}
                            titleStyle={{ fontWeight: 'bold' }}
                            description={`File: ${item.file_number} • Case: ${item.case_number}\nCourt: ${item.court_name || 'N/A'} • Type: ${item.case_type || 'N/A'}\nPhone: ${item.client_phone || 'N/A'}`}
                            descriptionNumberOfLines={4}
                            left={(props) => (
                              <MaterialCommunityIcons
                                name="file-document-outline"
                                size={26}
                                color={theme.colors.primary}
                                style={styles.listIcon}
                              />
                            )}
                            right={(props) => (
                              <View style={styles.locationTag}>
                                <Text style={[styles.locationText, { backgroundColor: theme.colors.primary + '10', color: theme.colors.primary }]}>
                                  Rack {item.rack_number || 'N/A'}-{item.shelf_number || 'N/A'}
                                </Text>
                              </View>
                            )}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {searchQuery.trim().length > 0 && !searching && searchResults.length === 0 && (
                    <Text style={styles.noResultsText}>No physical file records match your query.</Text>
                  )}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Hearing Details Form (Redesigned) */}
          <Card style={styles.card} elevation={1}>
            <Card.Content>
              <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
                2. Log Hearing & Action Details
              </Text>

              {/* Hearing Status selector */}
              <Text variant="bodySmall" style={styles.label}>Hearing Outcome / Status</Text>
              <SegmentedButtons
                value={hearingStatus}
                onValueChange={setHearingStatus}
                theme={{ colors: { secondaryContainer: getStatusButtonColor(hearingStatus) + '25', onSecondaryContainer: getStatusButtonColor(hearingStatus) } }}
                buttons={[
                  { value: 'Pending', label: 'Pending', icon: 'clock-outline' },
                  { value: 'Attended', label: 'Attended', icon: 'account-check-outline' },
                  { value: 'Adjourned', label: 'Adjourned', icon: 'calendar-alert' },
                  { value: 'Completed', label: 'Completed', icon: 'check-circle-outline' },
                ]}
                style={styles.segmented}
              />
              <Text variant="bodySmall" style={[styles.statusHint, { color: getStatusButtonColor(hearingStatus) }]}>
                Status selected: <Text style={{ fontWeight: 'bold' }}>{hearingStatus}</Text>
              </Text>

              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <View pointerEvents="none">
                  <TextInput
                    label="Hearing Date"
                    value={hearingDate}
                    mode="outlined"
                    placeholder="YYYY-MM-DD"
                    error={!!errors.hearingDate}
                    style={styles.input}
                    left={<TextInput.Icon icon="calendar" />}
                    editable={false}
                  />
                </View>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(hearingDate || Date.now())}
                  mode="date"
                  display="default"
                  onChange={onChangeDate}
                />
              )}
              {errors.hearingDate ? <HelperText type="error" style={styles.errorText}>{errors.hearingDate}</HelperText> : null}

              <TextInput
                label="Next Action / Instructions"
                value={nextAction}
                onChangeText={setNextAction}
                mode="outlined"
                placeholder="e.g. Advocate to cross-examine, file replies"
                style={styles.input}
                left={<TextInput.Icon icon="clipboard-check-outline" />}
              />

              <TextInput
                label="Hearing Notes & Proceedings"
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                placeholder="Provide notes of what occurred during the hearing..."
                multiline
                numberOfLines={4}
                style={styles.input}
                left={<TextInput.Icon icon="note-text-outline" />}
              />

              <Button
                mode="contained"
                onPress={handleSave}
                loading={saving}
                disabled={saving || !selectedCase}
                style={styles.saveBtn}
                contentStyle={styles.saveBtnContent}
                icon="calendar-check"
              >
                {editingHearingId ? 'Update Hearing Log' : 'Save Hearing Log'}
              </Button>
            </Card.Content>
          </Card>

          {/* Recent Hearing Logs Section */}
          <Card style={styles.card} elevation={1}>
            <Card.Content>
              <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
                Recent Hearing Logs
              </Text>

              <TextInput
                label="Search hearing logs..."
                value={hearingSearchQuery}
                onChangeText={setHearingSearchQuery}
                mode="outlined"
                placeholder="Search by client, case, notes..."
                left={<TextInput.Icon icon="magnify" />}
                style={{ marginBottom: 16 }}
                dense
              />

              {loadingHearings && hearings.length === 0 ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
              ) : (
                (() => {
                  const filteredHearings = hearings.filter(h => {
                    const q = hearingSearchQuery.toLowerCase();
                    return (
                      h.client_name?.toLowerCase().includes(q) ||
                      h.file_number?.toLowerCase().includes(q) ||
                      h.case_number?.toLowerCase().includes(q) ||
                      h.hearing_notes?.toLowerCase().includes(q) ||
                      h.next_action?.toLowerCase().includes(q) ||
                      h.status?.toLowerCase().includes(q)
                    );
                  });

                  if (filteredHearings.length === 0) {
                    return (
                      <View style={styles.emptyLogsContainer}>
                        <MaterialCommunityIcons name="calendar-blank" size={32} color={theme.colors.outline} />
                        <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.outline, fontSize: 13, textAlign: 'center' }}>
                          {hearingSearchQuery ? 'No hearing logs match your search.' : 'No hearings have been logged yet.'}
                        </Text>
                      </View>
                    );
                  }

                  return filteredHearings.map((item) => {
                    const isAttended = item.status === 'Attended';
                  const isCompleted = item.status === 'Completed';
                  const isAdjourned = item.status === 'Adjourned';
                  const isTicked = isAttended || isCompleted;
                  const statusColor = isCompleted ? '#38a169' : isAttended ? '#3182ce' : isAdjourned ? '#dd6b20' : '#718096';

                  return (
                    <View key={item.id}>
                      <View style={styles.agendaItemRow}>
                        {/* Status Checkbox */}
                        <TouchableOpacity
                          style={styles.agendaCheckWrapper}
                          onPress={() => item.id && handleToggleHearingStatus(item.id, item.status)}
                        >
                          <MaterialCommunityIcons
                            name={isTicked ? "check-circle" : "checkbox-blank-circle-outline"}
                            size={24}
                            color={isTicked ? statusColor : theme.colors.outline}
                          />
                        </TouchableOpacity>

                        {/* Text Content */}
                        <View style={styles.agendaInfoWrapper}>
                          <View style={styles.agendaTextHeader}>
                            <Text 
                              variant="titleMedium" 
                              style={[
                                styles.agendaClientName, 
                                isTicked && styles.textStrike,
                                { color: theme.colors.onSurface }
                              ]}
                              numberOfLines={1}
                            >
                              {item.client_name}
                            </Text>
                            <View style={[styles.statusChip, { backgroundColor: statusColor + '15' }]}>
                              <Text style={[styles.statusChipText, { color: statusColor }]}>
                                {item.status}
                              </Text>
                            </View>
                          </View>

                          <Text variant="bodyMedium" style={[styles.agendaMetaText, { color: theme.colors.onSurfaceVariant }]}>
                            File No: <Text style={styles.boldText}>{item.file_number}</Text> • Case No: {item.case_number}
                          </Text>
                          
                          <Text variant="bodyMedium" style={[styles.agendaDateText, { color: theme.colors.primary }]}>
                            Hearing Date: {item.hearing_date}
                          </Text>

                          {item.next_action ? (
                            <Text variant="bodySmall" style={[styles.agendaActionText, { color: theme.colors.secondary }]} numberOfLines={2}>
                              Next: {item.next_action}
                            </Text>
                          ) : null}

                          {item.hearing_notes ? (
                            <Text variant="bodySmall" style={[styles.agendaNotesText, { color: theme.colors.outline }]} numberOfLines={2}>
                              Notes: {item.hearing_notes}
                            </Text>
                          ) : null}
                        </View>

                        {/* Actions */}
                        <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                          {/* Edit Hearing Button */}
                          <TouchableOpacity
                            style={styles.loadCaseBtn}
                            onPress={() => item.case_id && handleEditHearing(item)}
                          >
                            <MaterialCommunityIcons name="pencil-outline" size={22} color={theme.colors.primary} style={{ opacity: 0.9 }} />
                            <Text variant="labelSmall" style={{ color: theme.colors.primary, fontSize: 8, marginTop: 1, fontWeight: 'bold' }}>Edit</Text>
                          </TouchableOpacity>

                          {/* Delete Button */}
                          <TouchableOpacity
                            style={[styles.loadCaseBtn, { marginTop: 4 }]}
                            onPress={() => item.id && handleDeleteHearing(item.id)}
                          >
                            <MaterialCommunityIcons name="delete-outline" size={22} color={theme.colors.error} style={{ opacity: 0.9 }} />
                            <Text variant="labelSmall" style={{ color: theme.colors.error, fontSize: 8, marginTop: 1, fontWeight: 'bold' }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Divider style={styles.agendaDivider} />
                    </View>
                  );
                });
                })()
              )}
            </Card.Content>
          </Card>
        </ScrollView>

        {/* Global Floating Action Button (FAB) - Symbol Only */}
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
  outerContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  headerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#ffffff',
    opacity: 0.8,
    marginTop: 4,
    maxWidth: '85%',
  },
  headerIcon: {
    opacity: 0.9,
  },
  card: {
    borderRadius: 12,
    marginBottom: 16,
  },
  groupTitle: {
    fontWeight: 'bold',
    fontSize: 14.5,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedCaseContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  caseTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
  },
  caseTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: 0.5,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  caseDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  caseIcon: {
    marginRight: 12,
  },
  clientName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  fileNumber: {
    fontWeight: '500',
    opacity: 0.7,
    fontSize: 13,
  },
  divider: {
    marginVertical: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaText: {
    marginLeft: 6,
    opacity: 0.8,
  },
  searchInput: {
    marginBottom: 8,
  },
  searchingText: {
    paddingTop: 4,
    paddingLeft: 4,
    opacity: 0.6,
    fontSize: 12,
  },
  searchResultsContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  resultItem: {
    borderBottomWidth: 1,
    backgroundColor: '#ffffff',
  },
  listIcon: {
    alignSelf: 'center',
    marginRight: 4,
  },
  locationTag: {
    justifyContent: 'center',
    marginRight: 8,
  },
  locationText: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  noResultsText: {
    paddingTop: 12,
    textAlign: 'center',
    opacity: 0.5,
    fontSize: 13,
  },
  label: {
    marginBottom: 6,
    opacity: 0.8,
    fontWeight: '600',
    fontSize: 12,
  },
  segmented: {
    marginBottom: 8,
  },
  statusHint: {
    fontSize: 11,
    marginBottom: 16,
    marginLeft: 4,
  },
  input: {
    marginBottom: 12,
  },
  errorText: {
    marginTop: -4,
    marginBottom: 4,
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 8,
  },
  saveBtnContent: {
    paddingVertical: 6,
  },
  loadingText: {
    textAlign: 'center',
    paddingVertical: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
  agendaItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  agendaCheckWrapper: {
    paddingTop: 2,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agendaInfoWrapper: {
    flex: 1,
  },
  agendaTextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  agendaClientName: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  agendaMetaText: {
    fontSize: 13,
    marginBottom: 2,
  },
  agendaDateText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  agendaActionText: {
    fontSize: 12.5,
    fontStyle: 'italic',
    marginTop: 2,
  },
  agendaNotesText: {
    fontSize: 12,
    marginTop: 2,
  },
  boldText: {
    fontWeight: 'bold',
  },
  textStrike: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },
  loadCaseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    marginLeft: 8,
  },
  agendaDivider: {
    marginVertical: 4,
    opacity: 0.5,
  },
  emptyLogsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
});
