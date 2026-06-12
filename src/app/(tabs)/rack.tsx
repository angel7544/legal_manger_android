import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  FlatList,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  useTheme,
  ActivityIndicator,
  Searchbar,
  Chip,
  Divider,
  Portal,
  Dialog,
  TextInput,
  IconButton,
  Badge,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { DraxProvider, DraxView, DraxScrollView } from 'react-native-drax';
import { searchCases, updateCase } from '../../database/db';
import { Case } from '../../types/db';
import { ScreenBackground } from '../../components/ScreenBackground';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom component for a flat-stacked horizontal file folder
interface VisualFolderProps {
  item: Case;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: () => void;
}

function VisualFolder({ item, isSelected, isHighlighted, onPress }: VisualFolderProps) {
  const theme = useTheme();
  // Animation value for horizontal slide out
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide folder right if selected
    Animated.spring(slideAnim, {
      toValue: isSelected ? 20 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 45,
    }).start();
  }, [isSelected]);

  useEffect(() => {
    if (isHighlighted) {
      // Pulsate scale to highlight search match
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isHighlighted]);

  // Determine colors based on priority
  const getPriorityColors = () => {
    switch (item.priority?.toLowerCase()) {
      case 'high':
        return { bg: '#c53030', border: '#9b2c2c', text: '#ffffff' };
      case 'medium':
        return { bg: '#dd6b20', border: '#c05621', text: '#ffffff' };
      case 'low':
        return { bg: '#2b6cb0', border: '#2b6cb0', text: '#ffffff' };
      default:
        return { bg: '#4a5568', border: '#2d3748', text: '#ffffff' };
    }
  };

  const colors = getPriorityColors();
  const isInOffice = item.file_status === 'In Office';

  // Vector status icon (no emojis)
  const getStatusIcon = () => {
    switch (item.file_status) {
      case 'In Court':
        return 'gavel';
      case 'With Junior':
        return 'account-outline';
      case 'Archived':
        return 'archive-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  // Extract last sequence of file number
  const getSequenceNumber = () => {
    const parts = item.file_number.split('-');
    return parts[parts.length - 1] || item.file_number;
  };

  return (
    <DraxView
      dragPayload={item}
      longPressDelay={250}
      draggingStyle={{ opacity: 0.2 }}
      hoverDraggingStyle={{ opacity: 0.9, elevation: 5, transform: [{ scale: 1.02 }] }}
      style={{ width: '100%', marginBottom: 8 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.folderTouchable}>
        <Animated.View
          style={[
            styles.folderContainer,
            {
              transform: [{ translateX: slideAnim }, { scale: pulseAnim }],
              shadowOpacity: isSelected ? 0.3 : 0.1,
            },
          ]}
        >
          {/* Flat Folder Spine Card */}
        <View
          style={[
            styles.folderSpine,
            {
              backgroundColor: isInOffice ? colors.bg : colors.bg + '12',
              borderColor: colors.border,
              borderWidth: 1.8,
              borderStyle: isInOffice ? 'solid' : 'dashed',
            },
            isHighlighted && {
              borderColor: '#ecc94b',
              borderWidth: 2.5,
            },
            isSelected && {
              borderColor: theme.colors.primary,
              borderWidth: 2.2,
            },
          ]}
        >
          {/* Visual lace string/tab representing typical Indian court files */}
          <View style={[styles.laceTag, { backgroundColor: colors.border }]} />

          {/* Spine Horizontal Content */}
          <View style={styles.spineTextRow}>
            <View style={styles.seqBadge}>
              <Text style={styles.seqText}>{getSequenceNumber()}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.clientText,
                { color: isInOffice ? '#ffffff' : colors.bg },
              ]}
            >
              {item.client_name.length > 10 ? `${item.client_name.substring(0, 10)}...` : item.client_name}
            </Text>
          </View>

          {/* Out of Office Text Badge inside the spine */}
          {!isInOffice && (
            <View
              style={[
                styles.spineStatusBadge,
                { backgroundColor: colors.bg + '20', borderColor: colors.bg },
              ]}
            >
              <Text style={[styles.spineStatusText, { color: colors.bg }]}>
                {item.file_status.replace('In ', '')}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
    </DraxView>
  );
}

export default function RackVisualizerScreen() {
  const theme = useTheme();
  const router = useRouter();

  // State queries
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [racks, setRacks] = useState<string[]>([]);
  const [activeRack, setActiveRack] = useState<string>('');

  // Selection states
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Case[]>([]);
  const [highlightedCaseIds, setHighlightedCaseIds] = useState<number[]>([]);

  // Dialog overlays
  const [moveDialogVisible, setMoveDialogVisible] = useState(false);
  const [assignDialogVisible, setAssignDialogVisible] = useState(false);

  // Dialog parameters
  const [editStatus, setEditStatus] = useState('In Office');
  const [editRack, setEditRack] = useState('');
  const [editShelf, setEditShelf] = useState('');
  const [editPosition, setEditPosition] = useState('0');

  // Case currently being assigned from unassigned tray
  const [assignCase, setAssignCase] = useState<Case | null>(null);

  // Layout refs to scroll horizontally to matching shelves
  const shelfScrollViewRef = useRef<any>(null);

  const loadVisualizerData = async () => {
    try {
      const data = await searchCases('');
      setAllCases(data);

      // Extract unique racks
      const uniqueRacks = Array.from(
        new Set(
          data
            .map((c) => c.rack_number?.trim() || '')
            .filter((r) => r !== '')
        )
      ).sort();

      const finalRacks = uniqueRacks.length > 0 ? uniqueRacks : ['Rack 1', 'Rack 2', 'Rack 3'];
      setRacks(finalRacks);

      if (!activeRack || (!finalRacks.includes(activeRack) && activeRack !== 'unassigned')) {
        setActiveRack(finalRacks[0] || '');
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load Visual Racks:', err);
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadVisualizerData();
    }, [activeRack])
  );

  useEffect(() => {
    if (selectedCaseId) {
      const c = allCases.find((x) => x.id === selectedCaseId);
      setSelectedCase(c || null);
    } else {
      setSelectedCase(null);
    }
  }, [selectedCaseId, allCases]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHighlightedCaseIds([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const matches = allCases.filter(
      (c) =>
        c.client_name.toLowerCase().includes(query) ||
        c.file_number.toLowerCase().includes(query) ||
        c.case_number.toLowerCase().includes(query) ||
        (c.client_phone && c.client_phone.includes(query))
    );

    setSearchResults(matches);
    setHighlightedCaseIds(matches.map((m) => m.id!));
  }, [searchQuery, allCases]);

  const handleSelectFolder = (c: Case) => {
    if (selectedCaseId === c.id) {
      setSelectedCaseId(null);
    } else {
      setSelectedCaseId(c.id!);
      setEditStatus(c.file_status);
      setEditRack(c.rack_number || '');
      setEditShelf(c.shelf_number || '');
      setEditPosition(c.position_number || '0');
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedCase) return;
    try {
      const updates: Partial<Case> = {
        file_status: editStatus,
        rack_number: editRack.trim() || null,
        shelf_number: editShelf.trim() || null,
        position_number: editPosition.trim() || '0',
      };

      await updateCase(selectedCase.id!, selectedCase, updates, 'Admin');
      setMoveDialogVisible(false);
      Alert.alert('Success', 'File details successfully updated.');
      loadVisualizerData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update coordinates.');
    }
  };

  const handleAssignLocation = async () => {
    if (!assignCase) return;
    try {
      const updates: Partial<Case> = {
        file_status: 'In Office',
        rack_number: editRack.trim() || (activeRack === 'unassigned' ? '1' : activeRack),
        shelf_number: editShelf.trim() || '1',
        position_number: editPosition.trim() || '0',
      };

      await updateCase(assignCase.id!, assignCase, updates, 'Admin');
      setAssignDialogVisible(false);
      setAssignCase(null);
      Alert.alert('Success', 'File successfully assigned to location.');
      loadVisualizerData();
    } catch (err) {
      Alert.alert('Error', 'Failed to assign shelf location.');
    }
  };

  const handleJumpToSearchMatch = (match: Case) => {
    if (match.rack_number) {
      setActiveRack(match.rack_number);
      setSelectedCaseId(match.id!);
    }
  };

  // Grouping coordinates
  const activeRackCases = allCases.filter((c) => c.rack_number === activeRack);
  
  const activeRackShelves = Array.from(
    new Set(
      activeRackCases
        .map((c) => c.shelf_number?.trim() || '')
        .filter((s) => s !== '')
    )
  ).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const displayShelves = activeRackShelves.length > 0 ? activeRackShelves : ['1', '2', '3', '4'];
  const hasNoShelfCases = activeRackCases.some(c => !c.shelf_number || c.shelf_number.trim() === '');
  if (hasNoShelfCases && !displayShelves.includes('?')) {
    displayShelves.unshift('?');
  }

  const unassignedCases = allCases.filter((c) => !c.rack_number || !c.shelf_number);

  // Statistics
  const totalInRack = activeRackCases.length;
  const outOfOfficeInRack = activeRackCases.filter((c) => c.file_status !== 'In Office').length;
  const inOfficeInRack = totalInRack - outOfOfficeInRack;

  return (
    <ScreenBackground>
      <DraxProvider>
        <View style={styles.mainContainer}>
          {/* Search Coordinates Header */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search files inside physical racks..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            elevation={1}
            style={styles.searchBar}
          />

          {/* Horizontal Search Matches Chips */}
          {searchResults.length > 0 && (
            <View style={styles.matchesWrapper}>
              <Text variant="labelSmall" style={styles.matchesTitle}>
                FOUND {searchResults.length} MATCHES (TAP TO FOCUS):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchesScroll}>
                {searchResults.map((match) => (
                  <Chip
                    key={match.id}
                    icon="map-marker-radius"
                    onPress={() => handleJumpToSearchMatch(match)}
                    style={styles.matchChip}
                    textStyle={{ fontSize: 11 }}
                  >
                    {match.client_name} (Rack {match.rack_number || '?'}-{match.shelf_number || '?'})
                  </Chip>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Aggregate Stats Dashboard Bar */}
        <View style={styles.statsBar}>
          <Card style={styles.statsCard} elevation={1}>
            <View style={styles.statsContent}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{totalInRack}</Text>
                <Text style={styles.statLabel}>Total Files</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#38a169' }]}>{inOfficeInRack}</Text>
                <Text style={styles.statLabel}>On Shelf</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#dd6b20' }]}>{outOfOfficeInRack}</Text>
                <Text style={styles.statLabel}>Checked Out</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: theme.colors.error }]}>{unassignedCases.length}</Text>
                <Text style={styles.statLabel}>Unassigned</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Horizontal Navigation Tab-bar */}
        <View style={styles.tabsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
            {racks.map((rack) => (
              <Chip
                key={rack}
                selected={activeRack === rack}
                onPress={() => {
                  setActiveRack(rack);
                  setSelectedCaseId(null);
                }}
                style={[
                  styles.tabChip,
                  activeRack === rack && { backgroundColor: theme.colors.primary },
                ]}
                selectedColor="#ffffff"
                textStyle={[
                  styles.tabChipText,
                  activeRack === rack && { color: '#ffffff', fontWeight: 'bold' },
                ]}
                showSelectedOverlay={false}
              >
                Rack {rack}
              </Chip>
            ))}

            {/* Unassigned Files Tray Tab */}
            {unassignedCases.length > 0 && (
              <Chip
                key="unassigned_tab"
                selected={activeRack === 'unassigned'}
                onPress={() => {
                  setActiveRack('unassigned');
                  setSelectedCaseId(null);
                }}
                style={[
                  styles.tabChip,
                  activeRack === 'unassigned' && { backgroundColor: theme.colors.error },
                  { borderColor: theme.colors.error },
                ]}
                selectedColor="#ffffff"
                textStyle={[
                  styles.tabChipText,
                  activeRack === 'unassigned' && { color: '#ffffff', fontWeight: 'bold' },
                ]}
                showSelectedOverlay={false}
                icon={() => (
                  <View style={styles.badgeWrapper}>
                    <MaterialCommunityIcons
                      name="tray-alert"
                      size={14}
                      color={activeRack === 'unassigned' ? '#ffffff' : theme.colors.error}
                    />
                  </View>
                )}
              >
                Unassigned ({unassignedCases.length})
              </Chip>
            )}
          </ScrollView>
        </View>

        {/* Horizontal Redesigned Workspace */}
        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : activeRack === 'unassigned' ? (
          /* UNASSIGNED VERTICAL LIST */
          <FlatList
            data={unassignedCases}
            keyExtractor={(item) => item.id!.toString()}
            contentContainerStyle={styles.unassignedList}
            ListHeaderComponent={
              <View style={styles.unassignedHeader}>
                <MaterialCommunityIcons name="tray-alert" size={32} color={theme.colors.error} />
                <Title style={{ marginLeft: 8 }}>Unassigned Legal Files</Title>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.unassignedCard} elevation={1}>
                <Card.Content style={styles.unassignedCardContent}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                      {item.client_name}
                    </Text>
                    <Text variant="bodySmall">
                      File: {item.file_number} • Case: {item.case_number}
                    </Text>
                    {item.rack_number ? (
                      <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 2, fontWeight: 'bold' }}>
                        Rack: {item.rack_number} • Shelf Missing
                      </Text>
                    ) : null}
                  </View>
                  <Button
                    mode="contained"
                    icon="map-marker-plus"
                    onPress={() => {
                      setAssignCase(item);
                      setEditRack(item.rack_number || racks[0] || '1');
                      setEditShelf('');
                      setEditPosition('1');
                      setAssignDialogVisible(true);
                    }}
                  >
                    Assign
                  </Button>
                </Card.Content>
              </Card>
            )}
          />
        ) : (
          /* SIDE-BY-SIDE HORIZONTAL CAROUSEL OF SHELVES */
          <View style={styles.horizontalShelvesWrapper}>
            <DraxScrollView
              ref={shelfScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={[
                styles.shelvesHorizontalScrollContent,
                selectedCaseId !== null && { paddingBottom: 220 }, // extra padding to clear details card
              ]}
            >
              {displayShelves.map((shelfName) => {
                const shelfCases = activeRackCases
                  .filter((c) => {
                    if (shelfName === '?') {
                      return !c.shelf_number || c.shelf_number.trim() === '';
                    }
                    return c.shelf_number === shelfName;
                  })
                  .sort((a, b) => {
                    const posA = parseInt(a.position_number || '0', 10);
                    const posB = parseInt(b.position_number || '0', 10);
                    return posA - posB;
                  });

                return (
                  <DraxView
                    key={shelfName}
                    style={styles.shelfColumnContainer}
                    receivingStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: theme.colors.primary }}
                    onReceiveDragDrop={async (event) => {
                      const droppedCase = event.dragged.payload as Case;
                      const targetShelf = shelfName === '?' ? '' : shelfName;
                      if (droppedCase.shelf_number !== targetShelf) {
                        try {
                          await updateCase(droppedCase.id!, droppedCase, { shelf_number: targetShelf }, 'Admin');
                          loadVisualizerData();
                        } catch (e) {
                          console.error(e);
                          Alert.alert('Error', 'Failed to update shelf location.');
                        }
                      }
                    }}
                  >
                    {/* Shelf Header Brass Plate */}
                    <View style={styles.brassPlateContainer}>
                      <View style={styles.brassPlate}>
                        <Text style={styles.brassPlateText}>
                          {shelfName === '?' ? 'MISSING SHELF' : `SHELF ${shelfName.toUpperCase()}`}
                        </Text>
                      </View>
                      <Badge size={20} style={styles.shelfCasesBadge}>
                        {shelfCases.length}
                      </Badge>
                    </View>

                    {/* Vertical stack of horizontal laying folders inside this shelf column */}
                    <DraxScrollView
                      style={styles.shelfColumnStackScroll}
                      contentContainerStyle={styles.shelfColumnStackContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {shelfCases.length > 0 ? (
                        shelfCases.map((c) => (
                          <VisualFolder
                            key={c.id}
                            item={c}
                            isSelected={selectedCaseId === c.id}
                            isHighlighted={highlightedCaseIds.includes(c.id!)}
                            onPress={() => handleSelectFolder(c)}
                          />
                        ))
                      ) : (
                        /* Empty Stack Outline Placeholder */
                        <View style={styles.emptyStackContainer}>
                          <MaterialCommunityIcons
                            name="folder-outline"
                            size={24}
                            color={theme.colors.outlineVariant}
                          />
                          <Text style={[styles.emptyStackText, { color: theme.colors.outline }]}>
                            No files stacked
                          </Text>
                        </View>
                      )}
                    </DraxScrollView>

                    {/* Cabinet horizontal wood bottom ledge for this column */}
                    <View style={styles.woodLedge} />
                    <View style={styles.woodLedgeShadow} />
                  </DraxView>
                );
              })}
            </DraxScrollView>
          </View>
        )}

        {/* Selected File Details Modal Dialog */}
        <Portal>
          <Dialog
            visible={selectedCase !== null}
            onDismiss={() => setSelectedCaseId(null)}
            style={styles.detailsDialog}
          >
            {selectedCase && (
              <>
                <Dialog.Title style={styles.dialogTitleText}>
                  {selectedCase.client_name}
                </Dialog.Title>
                <Dialog.Content style={styles.dialogContentContainer}>
                  {/* Location Banner (In Office vs Out of Office) */}
                  {selectedCase.file_status === 'In Office' ? (
                    <View style={styles.successBanner}>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#2f855a" style={{ marginRight: 6 }} />
                      <Text style={styles.successBannerText}>
                        IN OFFICE: Rack {selectedCase.rack_number || '?'}, Shelf {selectedCase.shelf_number || '?'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.warningBanner}>
                      <MaterialCommunityIcons name="alert-circle" size={16} color="#dd6b20" style={{ marginRight: 6 }} />
                      <Text style={styles.warningBannerText}>
                        OUT OF OFFICE: {selectedCase.file_status.toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={styles.badgeRow}>
                    <Chip
                      style={[
                        styles.dialogPriorityChip,
                        {
                          backgroundColor:
                            selectedCase.priority?.toLowerCase() === 'high'
                              ? '#fed7d7'
                              : selectedCase.priority?.toLowerCase() === 'medium'
                              ? '#feebc8'
                              : '#ebf8ff',
                        },
                      ]}
                      textStyle={{
                        color:
                          selectedCase.priority?.toLowerCase() === 'high'
                            ? '#c53030'
                            : selectedCase.priority?.toLowerCase() === 'medium'
                            ? '#c05621'
                            : '#2b6cb0',
                        fontWeight: 'bold',
                        fontSize: 10,
                      }}
                    >
                      {selectedCase.priority || 'Medium'} Priority
                    </Chip>

                    <Chip
                      icon={
                        selectedCase.file_status === 'In Office'
                          ? 'checkbox-marked-circle-outline'
                          : selectedCase.file_status === 'In Court'
                          ? 'gavel'
                          : selectedCase.file_status === 'With Junior'
                          ? 'account-outline'
                          : 'archive-outline'
                      }
                      style={[
                        styles.dialogStatusChip,
                        {
                          backgroundColor:
                            selectedCase.file_status === 'In Office'
                              ? '#e6fffa'
                              : selectedCase.file_status === 'In Court'
                              ? '#feebc8'
                              : selectedCase.file_status === 'With Junior'
                              ? '#ebf8ff'
                              : '#edf2f7',
                        },
                      ]}
                      textStyle={{
                        color:
                          selectedCase.file_status === 'In Office'
                            ? '#319795'
                            : selectedCase.file_status === 'In Court'
                            ? '#dd6b20'
                            : selectedCase.file_status === 'With Junior'
                            ? '#2b6cb0'
                            : '#4a5568',
                        fontWeight: 'bold',
                        fontSize: 10,
                      }}
                    >
                      {selectedCase.file_status}
                    </Chip>
                  </View>

                  <Divider style={styles.modalDivider} />

                  {/* File Coordinates Section */}
                  <Text variant="titleSmall" style={styles.modalSectionHeader}>
                    Physical Location Coordinates
                  </Text>
                  <View style={styles.coordinatesGrid}>
                    <View style={styles.coordinateCell}>
                      <Text style={styles.coordinateLabel}>RACK</Text>
                      <Text style={styles.coordinateVal}>{selectedCase.rack_number || 'N/A'}</Text>
                    </View>
                    <View style={styles.coordinateCell}>
                      <Text style={styles.coordinateLabel}>SHELF</Text>
                      <Text style={styles.coordinateVal}>{selectedCase.shelf_number || 'N/A'}</Text>
                    </View>
                    <View style={styles.coordinateCell}>
                      <Text style={styles.coordinateLabel}>POSITION</Text>
                      <Text style={styles.coordinateVal}>{selectedCase.position_number || '0'}</Text>
                    </View>
                  </View>

                  <Divider style={styles.modalDivider} />

                  {/* Case Specs */}
                  <View style={styles.specsList}>
                    <View style={styles.specRow}>
                      <MaterialCommunityIcons name="file-document-outline" size={16} color={theme.colors.outline} style={styles.specIcon} />
                      <Text style={styles.specText}>
                        <Text style={styles.specLabel}>File Number: </Text>{selectedCase.file_number}
                      </Text>
                    </View>

                    <View style={styles.specRow}>
                      <MaterialCommunityIcons name="gavel" size={16} color={theme.colors.outline} style={styles.specIcon} />
                      <Text style={styles.specText}>
                        <Text style={styles.specLabel}>Case Number: </Text>{selectedCase.case_number} ({selectedCase.case_type})
                      </Text>
                    </View>

                    {selectedCase.court_name ? (
                      <View style={styles.specRow}>
                        <MaterialCommunityIcons name="bank" size={16} color={theme.colors.outline} style={styles.specIcon} />
                        <Text style={styles.specText} numberOfLines={1}>
                          <Text style={styles.specLabel}>Court: </Text>{selectedCase.court_name}
                        </Text>
                      </View>
                    ) : null}

                    {selectedCase.advocate_name ? (
                      <View style={styles.specRow}>
                        <MaterialCommunityIcons name="account-tie" size={16} color={theme.colors.outline} style={styles.specIcon} />
                        <Text style={styles.specText} numberOfLines={1}>
                          <Text style={styles.specLabel}>Advocate: </Text>{selectedCase.advocate_name}
                        </Text>
                      </View>
                    ) : null}

                    {selectedCase.next_hearing_date ? (
                      <View style={styles.specRow}>
                        <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.error} style={styles.specIcon} />
                        <Text style={[styles.specText, { color: theme.colors.error, fontWeight: '600' }]}>
                          <Text style={styles.specLabel}>Next Hearing: </Text>{selectedCase.next_hearing_date}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Dialog.Content>
                <Dialog.Actions style={styles.dialogActionsRow}>
                  <Button mode="text" onPress={() => setSelectedCaseId(null)}>
                    Dismiss
                  </Button>
                  <Button
                    mode="outlined"
                    icon="map-marker-edit"
                    onPress={() => {
                      setMoveDialogVisible(true);
                    }}
                  >
                    Move
                  </Button>
                  <Button
                    mode="contained"
                    icon="open-in-new"
                    onPress={() => {
                      setSelectedCaseId(null);
                      router.push(`/case/${selectedCase.id}`);
                    }}
                  >
                    Detail Profile
                  </Button>
                </Dialog.Actions>
              </>
            )}
          </Dialog>
        </Portal>

        {/* DIALOG PORTALS */}
        <Portal>
          {/* Quick Coordinate Updates */}
          <Dialog visible={moveDialogVisible} onDismiss={() => setMoveDialogVisible(false)}>
            <Dialog.Title>Re-locate or Move File</Dialog.Title>
            <Dialog.Content>
              {selectedCase && (
                <View>
                  <Text variant="labelMedium" style={{ marginBottom: 4 }}>
                    File Location Status
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {['In Office', 'In Court', 'With Junior', 'Archived'].map((status) => (
                      <Chip
                        key={status}
                        selected={editStatus === status}
                        onPress={() => setEditStatus(status)}
                        style={{ marginRight: 6 }}
                      >
                        {status}
                      </Chip>
                    ))}
                  </ScrollView>

                  <View style={styles.dialogRow}>
                    <TextInput
                      label="Rack"
                      value={editRack}
                      onChangeText={setEditRack}
                      mode="outlined"
                      style={[styles.dialogInput, { marginRight: 8 }]}
                    />
                    <TextInput
                      label="Shelf"
                      value={editShelf}
                      onChangeText={setEditShelf}
                      mode="outlined"
                      style={[styles.dialogInput, { marginRight: 8 }]}
                    />
                    <TextInput
                      label="Position"
                      value={editPosition}
                      onChangeText={setEditPosition}
                      mode="outlined"
                      style={styles.dialogInput}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setMoveDialogVisible(false)}>Cancel</Button>
              <Button onPress={handleUpdateLocation}>Save Location</Button>
            </Dialog.Actions>
          </Dialog>

          {/* Quick Assignment dialog */}
          <Dialog visible={assignDialogVisible} onDismiss={() => setAssignDialogVisible(false)}>
            <Dialog.Title>Assign Shelf Location</Dialog.Title>
            <Dialog.Content>
              {assignCase && (
                <View>
                  <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                    Assign location coordinates for case file{' '}
                    <Text style={{ fontWeight: 'bold' }}>{assignCase.client_name}</Text>:
                  </Text>

                  <View style={styles.dialogRow}>
                    <TextInput
                      label="Rack Name"
                      value={editRack}
                      onChangeText={setEditRack}
                      mode="outlined"
                      style={[styles.dialogInput, { marginRight: 8 }]}
                    />
                    <TextInput
                      label="Shelf Level"
                      value={editShelf}
                      onChangeText={setEditShelf}
                      mode="outlined"
                      style={[styles.dialogInput, { marginRight: 8 }]}
                    />
                    <TextInput
                      label="Position Index"
                      value={editPosition}
                      onChangeText={setEditPosition}
                      mode="outlined"
                      style={styles.dialogInput}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAssignDialogVisible(false)}>Cancel</Button>
              <Button onPress={handleAssignLocation}>Place File</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
      </DraxProvider>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    paddingTop: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    borderRadius: 12,
  },
  matchesWrapper: {
    marginTop: 8,
  },
  matchesTitle: {
    fontWeight: 'bold',
    opacity: 0.6,
    fontSize: 9.5,
    marginBottom: 4,
  },
  matchesScroll: {
    flexDirection: 'row',
  },
  matchChip: {
    marginRight: 6,
    height: 30,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  statsBar: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  statsCard: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'space-evenly',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  statLabel: {
    fontSize: 10,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  tabsWrapper: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
  },
  tabChip: {
    marginRight: 8,
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
  },
  tabChipText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  badgeWrapper: {
    marginRight: -4,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unassignedList: {
    padding: 16,
  },
  unassignedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  unassignedCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  unassignedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  horizontalShelvesWrapper: {
    flex: 1,
  },
  shelvesHorizontalScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
  },
  shelfColumnContainer: {
    width: 220,
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 10,
    height: '100%',
    minHeight: 280,
    justifyContent: 'space-between',
  },
  brassPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brassPlate: {
    backgroundColor: '#ecc94b',
    borderColor: '#d69e2e',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
  },
  brassPlateText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#2c3539',
    letterSpacing: 0.5,
  },
  shelfCasesBadge: {
    backgroundColor: '#cbd5e0',
    color: '#2d3748',
    fontWeight: 'bold',
  },
  shelfColumnStackScroll: {
    flex: 1,
    marginBottom: 10,
  },
  shelfColumnStackContent: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  emptyStackContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  emptyStackText: {
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  woodLedge: {
    height: 10,
    backgroundColor: '#8c583c',
    borderRadius: 3,
    borderColor: '#704229',
    borderWidth: 1,
  },
  woodLedgeShadow: {
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  folderTouchable: {
    width: '100%',
  },
  folderContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowRadius: 2,
  },
  folderSpine: {
    height: 36,
    borderRadius: 4,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 32,
  },
  laceTag: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  spineTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  seqBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 6,
    borderWidth: 0.5,
    borderColor: '#cbd5e0',
  },
  seqText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2d3748',
  },
  clientText: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  spineStatusBadge: {
    position: 'absolute',
    right: 8,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 0.5,
  },
  spineStatusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    borderColor: '#feebc8',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warningBannerText: {
    color: '#dd6b20',
    fontWeight: 'bold',
    fontSize: 12,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    borderColor: '#c6f6d5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  successBannerText: {
    color: '#2f855a',
    fontWeight: 'bold',
    fontSize: 12,
    flex: 1,
  },
  detailsDialog: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    maxHeight: '85%',
  },
  dialogTitleText: {
    fontWeight: 'bold',
    color: '#1a202c',
    fontSize: 18,
    textAlign: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  dialogContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dialogPriorityChip: {
    height: 28,
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 6,
  },
  dialogStatusChip: {
    height: 28,
    justifyContent: 'center',
    borderRadius: 6,
  },
  modalDivider: {
    marginVertical: 12,
  },
  modalSectionHeader: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#718096',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  coordinatesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f7fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  coordinateCell: {
    flex: 1,
    alignItems: 'center',
  },
  coordinateLabel: {
    fontSize: 9,
    color: '#a0aec0',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  coordinateVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d3748',
  },
  specsList: {
    marginTop: 4,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  specIcon: {
    marginRight: 8,
  },
  specText: {
    fontSize: 12.5,
    color: '#4a5568',
    flex: 1,
  },
  specLabel: {
    fontWeight: '600',
    color: '#718096',
  },
  dialogActionsRow: {
    justifyContent: 'space-evenly',
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  actionBtn: {
    borderRadius: 8,
  },
  dialogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dialogInput: {
    flex: 1,
  },
});
