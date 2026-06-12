import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, FAB, useTheme, ActivityIndicator, Divider, Chip, Checkbox, Button, Portal, Dialog, IconButton, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { searchCases } from '../../database/db';
import { Case } from '../../types/db';
import { ScreenBackground } from '../../components/ScreenBackground';
import { printMultiFrontLabels, shareMultiFrontLabels } from '../../utils/print';

export default function CasesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const queryRef = useRef(searchQuery);
  queryRef.current = searchQuery;

  const qrRefs = useRef<{[key: number]: any}>({});
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [generating, setGenerating] = useState(false);

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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const enterSelectMode = (id: number) => {
    setIsSelectMode(true);
    setSelectedIds([id]);
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  const handleGeneratePDFSheet = async (action: 'print' | 'share') => {
    if (selectedIds.length === 0) {
      Alert.alert('No files selected', 'Please select at least one file to generate labels.');
      return;
    }

    setGenerating(true);
    
    // Give 600ms to make sure all hidden QR codes are rendered and refs populated
    setTimeout(async () => {
      try {
        const selectedCasesWithQr: { caseData: Case; qrBase64: string }[] = [];
        for (const id of selectedIds) {
          const caseData = cases.find(c => c.id === id);
          const ref = qrRefs.current[id];
          if (caseData && ref) {
            await new Promise<void>((resolve) => {
              ref.toDataURL((data: string) => {
                selectedCasesWithQr.push({
                  caseData,
                  qrBase64: `data:image/png;base64,${data}`
                });
                resolve();
              });
            });
          }
        }

        if (selectedCasesWithQr.length === 0) {
          Alert.alert('QR Code Rendering', 'Label layout is rendering, please try again.');
          setGenerating(false);
          return;
        }

        if (action === 'print') {
          await printMultiFrontLabels(selectedCasesWithQr);
        } else {
          await shareMultiFrontLabels(selectedCasesWithQr);
        }
      } catch (err: any) {
        console.error(err);
        Alert.alert('Error', err.message || 'Failed to generate labels sheet.');
      } finally {
        setGenerating(false);
      }
    }, 600);
  };

  const fetchCases = async (query: string) => {
    setLoading(true);
    try {
      const data = await searchCases(query);
      setCases(data);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCases(queryRef.current);
    }, [])
  );

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCases(searchQuery);
    }, 150);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '#e53e3e';
      case 'medium':
        return '#b7791f';
      default:
        return '#2b6cb0';
    }
  };

  const renderCaseItem = ({ item }: { item: Case }) => {
    const isSelected = selectedIds.includes(item.id!);
    return (
      <Card
        style={[
          styles.card,
          isSelectMode && isSelected && { borderColor: theme.colors.primary, borderWidth: 1.5 }
        ]}
        onPress={() => {
          if (isSelectMode) {
            toggleSelect(item.id!);
          } else {
            router.push(`/case/${item.id}`);
          }
        }}
        onLongPress={() => {
          if (!isSelectMode) {
            enterSelectMode(item.id!);
          }
        }}
        elevation={1}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isSelectMode && (
            <View style={{ paddingLeft: 12 }}>
              <Checkbox
                status={isSelected ? 'checked' : 'unchecked'}
                onPress={() => toggleSelect(item.id!)}
              />
            </View>
          )}
          <Card.Content style={[styles.cardContent, { flex: 1 }]}>
            <View style={styles.headerRow}>
              <Text variant="titleMedium" style={[styles.clientName, { color: theme.colors.primary }]}>
                {item.client_name}
              </Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                <Text style={styles.badgeText}>
                  {item.priority || 'Medium'}
                </Text>
              </View>
            </View>

            <Text variant="bodySmall" style={styles.caseDetails}>
              File: <Text style={styles.boldText}>{item.file_number}</Text> • Case No: {item.case_number}
            </Text>
            
            {item.opposite_party ? (
              <Text variant="bodyMedium" style={styles.oppositeText}>
                vs. {item.opposite_party}
              </Text>
            ) : null}

            <Divider style={styles.divider} />

            <View style={styles.footerRow}>
              <View style={styles.infoCol}>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Location</Text>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  Rack {item.rack_number || 'N/A'} • Shelf {item.shelf_number || 'N/A'}
                </Text>
              </View>
              <View style={styles.infoColRight}>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'right' }}>Next Hearing</Text>
                <Text variant="bodyMedium" style={{ fontWeight: '600', color: item.next_hearing_date ? theme.colors.error : theme.colors.onSurface }}>
                  {item.next_hearing_date || 'Not Scheduled'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </View>
      </Card>
    );
  };

  return (
    <ScreenBackground>
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      
      {/* Search Bar Container */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search files by client, file, phone..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          elevation={1}
          style={styles.searchbar}
          clearIcon={() => searchQuery ? (
            <IconButton 
              icon="close" 
              size={20} 
              style={{ margin: 0 }} 
              onPress={() => setSearchQuery('')} 
            />
          ) : null}
        />
      </View>

      {loading && cases.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={cases}
          renderItem={renderCaseItem}
          keyExtractor={(item) => item.id?.toString() || ''}
          contentContainerStyle={[
            styles.listContainer,
            isSelectMode && { paddingBottom: 110 }
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="folder-outline" size={64} color={theme.colors.outline} />
              <Text variant="titleMedium" style={{ marginTop: 12, color: theme.colors.outline }}>
                No physical file records found
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 4 }}>
                Click the + button to create a file record.
              </Text>
            </View>
          }
        />
      )}

      {/* Standard Add FAB (hidden in selection mode) */}
      {!isSelectMode && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#ffffff"
          visible={fabVisible}
          onPress={() => router.push('/case/add')}
        />
      )}

      {/* Bottom Selection Bar */}
      {isSelectMode && (
        <Card style={styles.selectionBar} elevation={4}>
          <Card.Content style={styles.selectionBarContent}>
            <View style={styles.selectionInfo}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                {selectedIds.length} Selected
              </Text>
            </View>
            <View style={styles.selectionActions}>
              <Button 
                mode="contained" 
                icon="printer" 
                onPress={() => handleGeneratePDFSheet('print')} 
                style={styles.actionButton}
                labelStyle={{ fontSize: 12 }}
              >
                Print
              </Button>
              <Button 
                mode="contained" 
                icon="share-variant" 
                onPress={() => handleGeneratePDFSheet('share')} 
                style={[styles.actionButton, { marginLeft: 8 }]}
                labelStyle={{ fontSize: 12 }}
              >
                Share
              </Button>
              <IconButton
                icon="close"
                onPress={exitSelectMode}
                style={{ marginLeft: 8, marginVertical: 0 }}
              />
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Hidden QR Codes for capture */}
      {isSelectMode && (
        <View style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden' }}>
          {selectedIds.map(id => {
            const caseItem = cases.find(c => c.id === id);
            if (!caseItem) return null;
            return (
              <QRCode
                key={id}
                value={JSON.stringify({ 
                  file_number: caseItem.file_number, 
                  id: caseItem.id,
                  client_name: caseItem.client_name,
                  case_number: caseItem.case_number,
                  case_type: caseItem.case_type,
                  rack_number: caseItem.rack_number,
                  shelf_number: caseItem.shelf_number,
                  is_nyaya_file: true
                })}
                size={120}
                getRef={(ref) => {
                  qrRefs.current[id] = ref;
                }}
              />
            );
          })}
        </View>
      )}

      {/* Loading Overlay for PDF Generation */}
      <Portal>
        <Dialog visible={generating} dismissable={false}>
          <Dialog.Title>Generating Labels Sheet</Dialog.Title>
          <Dialog.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 16 }} />
              <Text variant="bodyMedium">Rendering labels and generating PDF...</Text>
            </View>
          </Dialog.Content>
        </Dialog>
      </Portal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  searchbar: {
    borderRadius: 12,
    height: 48,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 88, // Space for FAB
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
  },
  cardContent: {
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clientName: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  caseDetails: {
    marginBottom: 4,
    opacity: 0.8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  oppositeText: {
    fontStyle: 'italic',
    marginBottom: 8,
    opacity: 0.7,
  },
  divider: {
    marginVertical: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
  selectionBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  selectionBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 8,
  },
});
