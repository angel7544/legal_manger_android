import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Share, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Divider, IconButton, List, Chip, Portal, Dialog, TextInput, useTheme, ActivityIndicator, SegmentedButtons, Checkbox } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getCaseById, deleteCase, getFileMovements, getHearings, updateCase, deleteHearings } from '../../database/db';
import { Case, FileMovement, Hearing } from '../../types/db';
import { printFrontLabel, printSpineLabel, shareFrontLabel, shareSpineLabel } from '../../utils/print';
import { ScreenBackground } from '../../components/ScreenBackground';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function CaseDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const caseId = parseInt(id || '', 10);

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrBase64] = useState<string>('');

  // Dialog states
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [newStatus, setNewStatus] = useState('In Office');
  const [newRack, setNewRack] = useState('');
  const [newShelf, setNewShelf] = useState('');
  const [movementRemarks, setMovementRemarks] = useState('');

  // Hearing selection states
  const [isHearingSelectMode, setIsHearingSelectMode] = useState(false);
  const [selectedHearingIds, setSelectedHearingIds] = useState<number[]>([]);

  const [frontLabelDialogVisible, setFrontLabelDialogVisible] = useState(false);
  const [spineLabelDialogVisible, setSpineLabelDialogVisible] = useState(false);
  const [shareQrDialogVisible, setShareQrDialogVisible] = useState(false);

  const qrRef = useRef<any>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '#e53e3e';
      case 'medium':
        return '#dd6b20';
      case 'low':
        return '#38a169';
      default:
        return '#718096';
    }
  };

  const loadAllData = async () => {
    if (isNaN(caseId)) return;
    try {
      const c = await getCaseById(caseId);
      if (c) {
        setCaseData(c);
        setNewStatus(c.file_status);
        setNewRack(c.rack_number || '');
        setNewShelf(c.shelf_number || '');
        
        const m = await getFileMovements(caseId);
        setMovements(m);
        
        const h = await getHearings(caseId);
        setHearings(h);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading case details:', error);
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadAllData();
    }, [caseId])
  );

  // Capture QR code image as base64 on load
  const captureQrCode = () => {
    if (qrRef.current) {
      qrRef.current.toDataURL((data: string) => {
        setQrBase64(`data:image/png;base64,${data}`);
      });
    }
  };

  const handlePrintFront = async () => {
    if (!caseData) return;
    if (!qrBase64) {
      // Re-try capture if empty
      captureQrCode();
      Alert.alert('Label generation', 'Label layout is rendering, please try again.');
      return;
    }
    try {
      await printFrontLabel(caseData, qrBase64);
    } catch (e) {
      Alert.alert('Printing Error', 'Could not render printing template.');
    }
  };

  const handleShareFrontPDF = async () => {
    if (!caseData) return;
    if (!qrBase64) {
      captureQrCode();
      Alert.alert('Label generation', 'Label layout is rendering, please try again.');
      return;
    }
    try {
      await shareFrontLabel(caseData, qrBase64);
    } catch (e) {
      Alert.alert('Sharing Error', 'Could not generate and share PDF.');
    }
  };

  const handlePrintSpine = async () => {
    if (!caseData) return;
    try {
      await printSpineLabel(caseData);
    } catch (e) {
      Alert.alert('Printing Error', 'Could not render printing template.');
    }
  };

  const handleShareSpinePDF = async () => {
    if (!caseData) return;
    try {
      await shareSpineLabel(caseData);
    } catch (e) {
      Alert.alert('Sharing Error', 'Could not generate and share PDF.');
    }
  };

  const handleDelete = () => {
    if (!caseData) return;
    Alert.alert(
      'Delete Record',
      `Are you sure you want to permanently delete the physical file record for "${caseData.client_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCase(caseId, caseData.file_number, caseData.client_name);
              Alert.alert('Success', 'Physical file record deleted.');
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete physical file.');
            }
          },
        },
      ]
    );
  };

  const handleStatusSubmit = async () => {
    if (!caseData) return;
    try {
      const updates: Partial<Case> = {
        file_status: newStatus,
        rack_number: newRack.trim() || null,
        shelf_number: newShelf.trim() || null,
      };
      
      // Update case (this logs the movement automatically inside the transaction)
      await updateCase(caseId, caseData, updates, 'Admin');
      
      setStatusDialogVisible(false);
      setMovementRemarks('');
      loadAllData();
      Alert.alert('Success', 'File location details updated.');
    } catch (err) {
      Alert.alert('Error', 'Failed to update location details.');
    }
  };

  const toggleHearingSelect = (id: number) => {
    setSelectedHearingIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedHearings = async () => {
    if (selectedHearingIds.length === 0) return;
    Alert.alert(
      'Delete Hearings',
      `Are you sure you want to delete ${selectedHearingIds.length} selected hearing log(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHearings(selectedHearingIds);
              Alert.alert('Success', 'Selected hearing logs deleted.');
              setSelectedHearingIds([]);
              setIsHearingSelectMode(false);
              loadAllData();
            } catch (err) {
              console.error('Error deleting hearings:', err);
              Alert.alert('Error', 'Failed to delete selected hearings.');
            }
          }
        }
      ]
    );
  };

  const handleShareTextDetails = async () => {
    if (!caseData) return;
    try {
      const payload = {
        file_number: caseData.file_number,
        id: caseData.id,
        client_name: caseData.client_name,
        case_number: caseData.case_number,
        case_type: caseData.case_type,
        rack_number: caseData.rack_number,
        shelf_number: caseData.shelf_number,
        is_nyaya_file: true
      };

      const formattedDetails = `Nyaya File Record Summary
--------------------------
File Number: ${caseData.file_number}
Client Name: ${caseData.client_name} ${caseData.client_phone ? `(${caseData.client_phone})` : ''}
Case Number: ${caseData.case_number || 'N/A'}
Case Type: ${caseData.case_type || 'N/A'}
Court/Forum: ${caseData.court_name || 'N/A'}
Advocate: ${caseData.advocate_name || 'N/A'}
Litigants: ${caseData.party1 || caseData.client_name} vs ${caseData.party2 || caseData.opposite_party || 'N/A'}
Location: RACK ${caseData.rack_number || 'N/A'} • SHELF ${caseData.shelf_number || 'N/A'}
Priority: ${caseData.priority || 'Medium'}
Status: ${caseData.file_status}
--------------------------
Scan the QR code in the Nyaya Rack Management App to look up this file.

QR Payload Data (JSON):
${JSON.stringify(payload, null, 2)}`;
      
      await Share.share({
        message: formattedDetails,
        title: `Case File Details: ${caseData.file_number}`
      });
    } catch (e) {
      Alert.alert('Sharing Error', 'Could not share case details.');
    }
  };

  const handleShareQRImage = async () => {
    if (!caseData) return;
    if (!qrBase64) {
      captureQrCode();
      Alert.alert('QR Generation', 'QR image is generating, please try again.');
      return;
    }
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing Error', 'Sharing is not available on this device.');
        return;
      }
      
      const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
      const fileUri = `${FileSystem.cacheDirectory}QR_Code_${caseData.file_number.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: `Share QR Code for ${caseData.file_number}`,
        UTI: 'public.png',
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Sharing Error', 'Could not share the QR code image.');
    }
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

  if (!caseData) {
    return (
      <ScreenBackground>
        <View style={styles.loadingContainer}>
          <Text>Case file not found.</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* File Location Hero Header */}
      <Card style={styles.heroCard} elevation={2}>
        <Card.Content style={styles.heroContent}>
          <View style={styles.heroDetails}>
            <View style={styles.chipRow}>
              <View style={[styles.customBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.customBadgeText}>{caseData.file_status}</Text>
              </View>
              <View style={[styles.customBadge, { backgroundColor: getPriorityColor(caseData.priority) }]}>
                <Text style={styles.customBadgeText}>{caseData.priority || 'Medium'} Priority</Text>
              </View>
            </View>
            <Title style={styles.heroTitle}>{caseData.client_name}</Title>
            <Paragraph style={{ fontWeight: '600' }}>File: {caseData.file_number}</Paragraph>
          </View>
          <View style={[styles.locationBadge, { borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.locationTitle, { color: theme.colors.outline }]}>RACK LOCATION</Text>
            <Text style={[styles.locationText, { color: theme.colors.primary }]}>
              {caseData.rack_number || '?'}-{caseData.shelf_number || '?'}
            </Text>
          </View>
        </Card.Content>
        <Card.Actions>
          <Button icon="map-marker-edit" onPress={() => setStatusDialogVisible(true)}>
            Move File / Update Rack
          </Button>
        </Card.Actions>
      </Card>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <Button mode="outlined" icon="pencil" onPress={() => router.push(`/case/edit?id=${caseData.id}`)} style={styles.actionBtn}>
          Edit Details
        </Button>
        <Button mode="outlined" icon="delete" textColor={theme.colors.error} onPress={handleDelete} style={styles.actionBtn}>
          Delete
        </Button>
      </View>

      {/* QR Code and Printing Row */}
      <Card style={styles.qrCard} elevation={1}>
        <Card.Content style={styles.qrContent}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={JSON.stringify({ 
                file_number: caseData.file_number, 
                id: caseData.id,
                client_name: caseData.client_name,
                case_number: caseData.case_number,
                case_type: caseData.case_type,
                rack_number: caseData.rack_number,
                shelf_number: caseData.shelf_number,
                is_nyaya_file: true
              })}
              size={120}
              getRef={(ref) => {
                qrRef.current = ref;
                // Capture base64 shortly after render
                setTimeout(captureQrCode, 400);
              }}
            />
            <Text variant="bodySmall" style={styles.qrCaption}>{caseData.file_number}</Text>
            <Text variant="bodySmall" style={{ fontSize: 9, opacity: 0.6, marginTop: 2, textAlign: 'center' }}>Generated by NyayaRack</Text>
          </View>
          <View style={styles.printButtons}>
            <Button mode="contained" icon="printer" onPress={() => setFrontLabelDialogVisible(true)} style={styles.printBtn}>
              Print Front Label
            </Button>
            <Button mode="outlined" icon="printer" onPress={() => setSpineLabelDialogVisible(true)} style={styles.printBtn}>
              Print Spine Label
            </Button>
            <Button mode="text" icon="share-variant" onPress={() => setShareQrDialogVisible(true)}>
              Share Details / QR
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* General File Information */}
      <Card style={styles.detailsCard} elevation={1}>
        <Card.Content>
          <Title style={styles.cardSectionTitle}>Case Specifications</Title>
          <List.Item
            title="Priority Level"
            description={caseData.priority || 'Medium'}
            left={props => <List.Icon {...props} icon="alert-circle-outline" color={getPriorityColor(caseData.priority)} />}
          />
          <Divider />
          <List.Item
            title="Case Number"
            description={caseData.case_number}
            left={props => <List.Icon {...props} icon="gavel" />}
          />
          <Divider />
          <List.Item
            title="Court / Forum"
            description={caseData.court_name || 'Not Specified'}
            left={props => <List.Icon {...props} icon="bank" />}
          />
          <Divider />
          <List.Item
            title="Case Type"
            description={caseData.case_type}
            left={props => <List.Icon {...props} icon="tag" />}
          />
          <Divider />
          <List.Item
            title="Advocate Name"
            description={caseData.advocate_name || 'Not Specified'}
            left={props => <List.Icon {...props} icon="account-tie" />}
          />
          <Divider />
          <List.Item
            title="Litigants"
            description={`${caseData.party1 || caseData.client_name} vs ${caseData.party2 || caseData.opposite_party || 'N/A'}`}
            left={props => <List.Icon {...props} icon="account-multiple" />}
          />
          {caseData.respondent_category ? (
            <>
              <Divider />
              <List.Item
                title="Respondent Category"
                description={caseData.respondent_category}
                left={props => <List.Icon {...props} icon="folder-account" />}
              />
            </>
          ) : null}
          {caseData.client_phone ? (
            <>
              <Divider />
              <List.Item
                title="Client Contact Phone"
                description={caseData.client_phone}
                left={props => <List.Icon {...props} icon="phone" />}
              />
            </>
          ) : null}
          <Divider />
          <List.Item
            title="Filing Date"
            description={caseData.filing_date || 'Not Specified'}
            left={props => <List.Icon {...props} icon="calendar" />}
          />
          <Divider />
          <List.Item
            title="Next Hearing Date"
            description={caseData.next_hearing_date || 'None Scheduled'}
            left={props => <List.Icon {...props} icon="calendar-clock" />}
          />
          {caseData.notes ? (
            <>
              <Divider />
              <List.Item
                title="Notes"
                description={caseData.notes}
                left={props => <List.Icon {...props} icon="note-text" />}
                descriptionNumberOfLines={10}
              />
            </>
          ) : null}
        </Card.Content>
      </Card>

      {/* Hearing Tracking List */}
      <Card style={styles.detailsCard} elevation={1}>
        <Card.Content>
          <View style={styles.sectionHeaderRow}>
            <Title style={styles.cardSectionTitle}>Hearing Calendar</Title>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {hearings.length > 0 && (
                <Button 
                  mode="text" 
                  onPress={() => {
                    if (isHearingSelectMode) {
                      setIsHearingSelectMode(false);
                      setSelectedHearingIds([]);
                    } else {
                      setIsHearingSelectMode(true);
                    }
                  }}
                  style={{ marginRight: 4 }}
                >
                  {isHearingSelectMode ? 'Cancel' : 'Select'}
                </Button>
              )}
              {isHearingSelectMode && selectedHearingIds.length > 0 && (
                <IconButton 
                  icon="delete" 
                  iconColor={theme.colors.error}
                  size={20}
                  onPress={handleDeleteSelectedHearings}
                  style={{ margin: 0 }}
                />
              )}
              {!isHearingSelectMode && (
                <Button icon="calendar-plus" onPress={() => router.push(`/log-hearing?caseId=${caseId}` as any)}>
                  Log Hearing
                </Button>
              )}
            </View>
          </View>
          {hearings.length > 0 ? (
            hearings.map((h) => {
              const isSelected = selectedHearingIds.includes(h.id!);
              const isAttended = h.status === 'Attended';
              const isCompleted = h.status === 'Completed';
              const isAdjourned = h.status === 'Adjourned';
              const statusColor = isCompleted ? '#38a169' : isAttended ? '#3182ce' : isAdjourned ? '#dd6b20' : '#718096';

              return (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => {
                    if (isHearingSelectMode) {
                      toggleHearingSelect(h.id!);
                    }
                  }}
                  disabled={!isHearingSelectMode}
                >
                  <View style={[styles.hearingItemRow, isSelected && { backgroundColor: theme.colors.primary + '08' }]}>
                    {isHearingSelectMode && (
                      <Checkbox
                        status={isSelected ? 'checked' : 'unchecked'}
                        onPress={() => toggleHearingSelect(h.id!)}
                      />
                    )}
                    <View style={{ flex: 1, paddingVertical: 8 }}>
                      <View style={styles.hearingTitleLine}>
                        <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{h.hearing_date}</Text>
                        <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusColor + '15' }]}>
                          {h.status || 'Pending'}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={styles.hearingTextContent}>
                        Next Action: {h.next_action || 'None'}
                      </Text>
                      {h.hearing_notes ? (
                        <Text variant="bodySmall" style={styles.hearingNotesContent}>
                          Notes: {h.hearing_notes}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Divider />
                </TouchableOpacity>
              );
            })
          ) : (
            <Paragraph style={styles.emptyText}>No past hearing entries recorded.</Paragraph>
          )}
        </Card.Content>
      </Card>

      {/* Movement tracking logs */}
      <Card style={[styles.detailsCard, { marginBottom: 40 }]} elevation={1}>
        <Card.Content>
          <Title style={styles.cardSectionTitle}>Location & Movement History</Title>
          {movements.length > 0 ? (
            movements.map((m) => (
              <List.Item
                key={m.id}
                title={`Moved to: ${m.location}`}
                description={`${m.movement_date} • By: ${m.moved_by || 'Admin'}\nRemarks: ${m.remarks || 'None'}`}
                left={props => <List.Icon {...props} icon="history" />}
                descriptionNumberOfLines={2}
              />
            ))
          ) : (
            <Paragraph style={styles.emptyText}>No file movements tracked.</Paragraph>
          )}
        </Card.Content>
      </Card>

      {/* PORTALS FOR DIALOGS */}
      <Portal>
        {/* 2. File Location Update Dialog */}
        <Dialog visible={statusDialogVisible} onDismiss={() => setStatusDialogVisible(false)}>
          <Dialog.Title>Update File Location & Status</Dialog.Title>
          <Dialog.Content>
            <Text variant="labelMedium" style={{ marginBottom: 4 }}>File Status</Text>
            <SegmentedButtons
              value={newStatus}
              onValueChange={setNewStatus}
              buttons={[
                { value: 'In Office', label: 'Office' },
                { value: 'In Court', label: 'Court' },
                { value: 'With Junior', label: 'Junior' },
                { value: 'Archived', label: 'Archived' },
              ]}
              style={{ marginBottom: 16 }}
            />
            
            <View style={styles.row}>
              <TextInput
                label="Rack Number"
                value={newRack}
                onChangeText={setNewRack}
                mode="outlined"
                style={[styles.dialogInput, { flex: 1, marginRight: 8 }]}
              />
              <TextInput
                label="Shelf Number"
                value={newShelf}
                onChangeText={setNewShelf}
                mode="outlined"
                style={[styles.dialogInput, { flex: 1 }]}
              />
            </View>

            <TextInput
              label="Remarks / Comments"
              value={movementRemarks}
              onChangeText={setMovementRemarks}
              mode="outlined"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setStatusDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleStatusSubmit}>Update</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 3. Front Label Actions Dialog */}
        <Dialog visible={frontLabelDialogVisible} onDismiss={() => setFrontLabelDialogVisible(false)}>
          <Dialog.Title>Front Label Actions</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <List.Item
              title="Print Label"
              description="Send to printer / open print preview"
              left={props => <List.Icon {...props} icon="printer" color={theme.colors.primary} />}
              onPress={() => {
                setFrontLabelDialogVisible(false);
                handlePrintFront();
              }}
            />
            <Divider />
            <List.Item
              title="Share as PDF"
              description="Generate PDF and share with other apps"
              left={props => <List.Icon {...props} icon="file-pdf-box" color={theme.colors.primary} />}
              onPress={() => {
                setFrontLabelDialogVisible(false);
                handleShareFrontPDF();
              }}
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16 }}>
            <Button onPress={() => setFrontLabelDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 4. Spine Label Actions Dialog */}
        <Dialog visible={spineLabelDialogVisible} onDismiss={() => setSpineLabelDialogVisible(false)}>
          <Dialog.Title>Spine Label Actions</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <List.Item
              title="Print Label"
              description="Send to printer / open print preview"
              left={props => <List.Icon {...props} icon="printer" color={theme.colors.primary} />}
              onPress={() => {
                setSpineLabelDialogVisible(false);
                handlePrintSpine();
              }}
            />
            <Divider />
            <List.Item
              title="Share as PDF"
              description="Generate PDF and share with other apps"
              left={props => <List.Icon {...props} icon="file-pdf-box" color={theme.colors.primary} />}
              onPress={() => {
                setSpineLabelDialogVisible(false);
                handleShareSpinePDF();
              }}
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16 }}>
            <Button onPress={() => setSpineLabelDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

        {/* 5. Share QR and Details Dialog */}
        <Dialog visible={shareQrDialogVisible} onDismiss={() => setShareQrDialogVisible(false)}>
          <Dialog.Title>Share File Record</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <List.Item
              title="Share Text Details"
              description="Share case file details formatted nicely"
              left={props => <List.Icon {...props} icon="text-box-outline" color={theme.colors.primary} />}
              onPress={() => {
                setShareQrDialogVisible(false);
                handleShareTextDetails();
              }}
            />
            <Divider />
            <List.Item
              title="Share QR Image"
              description="Share the QR code as a PNG image"
              left={props => <List.Icon {...props} icon="qrcode" color={theme.colors.primary} />}
              onPress={() => {
                setShareQrDialogVisible(false);
                handleShareQRImage();
              }}
            />
            <Divider />
            <List.Item
              title="Share QR & Details PDF"
              description="Share Front Label sheet containing QR and details"
              left={props => <List.Icon {...props} icon="file-document-outline" color={theme.colors.primary} />}
              onPress={() => {
                setShareQrDialogVisible(false);
                handleShareFrontPDF();
              }}
            />
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16 }}>
            <Button onPress={() => setShareQrDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroDetails: {
    flex: 1.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  customBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customBadgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11.5,
  },
  heroTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    lineHeight: 26,
  },
  locationBadge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 8,
    borderRadius: 12,
  },
  locationTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
  },
  qrCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  qrContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  qrWrapper: {
    alignItems: 'center',
  },
  qrCaption: {
    fontWeight: 'bold',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  printButtons: {
    flex: 1.2,
    marginLeft: 16,
  },
  printBtn: {
    marginBottom: 8,
    borderRadius: 8,
  },
  detailsCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: {
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  dialogInput: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  hearingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  hearingTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 9.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  hearingTextContent: {
    opacity: 0.8,
    fontSize: 12,
  },
  hearingNotesContent: {
    opacity: 0.6,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
