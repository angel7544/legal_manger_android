import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { getCaseByFileNumber, getDB } from '../database/db';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background, padding: 24 }]}>
        <MaterialCommunityIcons name="camera-off" size={64} color={theme.colors.outline} />
        <Text variant="titleMedium" style={styles.permissionText}>
          We need your permission to show the camera to scan QR codes.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permissionBtn}>
          Grant Camera Permission
        </Button>
      </View>
    );
  }

// Helper function to parse multiline barcode text format
function parseMultilineBarcode(data: string): any | null {
  const lines = data.split('\n').map(l => l.trim());
  if (lines.length > 0 && lines[0] === 'NYAYARACK') {
    const result: any = { is_nyaya_file: true };
    for (const line of lines) {
      if (line.startsWith('File Number:')) {
        result.file_number = line.replace('File Number:', '').trim();
      } else if (line.startsWith('Case Number:')) {
        result.case_number = line.replace('Case Number:', '').trim();
      } else if (line.startsWith('Client Name:')) {
        result.client_name = line.replace('Client Name:', '').trim();
      } else if (line.startsWith('Advocate Name:')) {
        result.advocate_name = line.replace('Advocate Name:', '').trim();
      }
    }
    // Deduce case type from file number if possible (e.g. CIV from CIV-2026-0001)
    if (result.file_number) {
      const parts = result.file_number.split('-');
      if (parts.length > 1) {
        result.case_type = parts[0].toUpperCase();
      }
    }
    if (result.file_number || result.client_name) {
      return result;
    }
  }
  return null;
}

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    setScanned(true);
    console.log('Barcode scanned data:', data);

    try {
      // 1. Try to parse scanned string as JSON
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        // Plain text scanned, check if it's multiline format
        parsedData = parseMultilineBarcode(data);
      }

      if (parsedData && (parsedData.is_nyaya_file || parsedData.client_name)) {
        // It's a structured case JSON or multiline format
        const fileNumber = parsedData.file_number;
        
        // Check if case already exists in DB
        const existingCase = await getCaseByFileNumber(fileNumber);
        
        if (existingCase) {
          Alert.alert(
            'File Found',
            `File ${fileNumber} is already in the database. Open it?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
              { 
                text: 'Open File', 
                onPress: () => {
                  router.replace(`/case/${existingCase.id}`);
                } 
              }
            ]
          );
        } else {
          // Case doesn't exist - Option to import/save!
          Alert.alert(
            'Import Scanned Case?',
            `Scanned QR contains a new physical file:\n\n` +
            `File No: ${fileNumber}\n` +
            `Client: ${parsedData.client_name}\n` +
            `Case No: ${parsedData.case_number || 'N/A'}\n\n` +
            `Would you like to save this case file details into your database?`,
            [
              { text: 'Discard', style: 'cancel', onPress: () => setScanned(false) },
              {
                text: 'Edit & Save',
                onPress: () => {
                  router.replace({
                    pathname: '/case/add',
                    params: {
                      fileNumber: fileNumber || '',
                      caseNumber: parsedData.case_number || '',
                      caseType: parsedData.case_type || 'CIV',
                      clientName: parsedData.client_name || '',
                      clientPhone: parsedData.client_phone || '',
                      oppositeParty: parsedData.opposite_party || '',
                      advocateName: parsedData.advocate_name || '',
                      rackNumber: parsedData.rack_number || '',
                      shelfNumber: parsedData.shelf_number || '',
                    }
                  });
                }
              },
              {
                text: 'Save Directly',
                onPress: async () => {
                  try {
                    const db = await getDB();
                    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    
                    // Insert keeping original file number
                    const res = await db.runAsync(`
                      INSERT INTO cases (
                        file_number, case_number, client_name, client_phone, opposite_party,
                        case_type, advocate_name, rack_number, shelf_number, created_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    `, [
                      fileNumber,
                      parsedData.case_number || 'Imported',
                      parsedData.client_name,
                      parsedData.client_phone || null,
                      parsedData.opposite_party || null,
                      parsedData.case_type || 'CIV',
                      parsedData.advocate_name || null,
                      parsedData.rack_number || null,
                      parsedData.shelf_number || null,
                      timestamp
                    ]);

                    const newId = res.lastInsertRowId;
                    
                    // Add initial movement log
                    await db.runAsync(`
                      INSERT INTO file_movements (case_id, location, moved_by, movement_date, remarks)
                      VALUES (?, ?, ?, ?, ?);
                    `, [newId, 'In Office', 'Import Scanner', timestamp, 'Imported from QR scan.']);

                    // Add audit log
                    await db.runAsync(`
                      INSERT INTO audit_logs (case_id, file_number, action_type, timestamp, details, remarks)
                      VALUES (?, ?, 'CREATE', ?, ?, ?);
                    `, [
                      newId,
                      fileNumber,
                      timestamp,
                      `Case file imported via QR Scan. Client: ${parsedData.client_name}`,
                      'QR Import'
                    ]);

                    Alert.alert('Import Success', 'Record saved successfully!', [
                      {
                        text: 'View Case',
                        onPress: () => {
                          router.replace(`/case/${newId}`);
                        }
                      }
                    ]);
                  } catch (err) {
                    console.error('Import failed:', err);
                    Alert.alert('Import Error', 'Failed to save scanned file details to database.');
                    setScanned(false);
                  }
                }
              }
            ]
          );
        }
      } else {
        // Plain text - search as file_number
        const fileNumberStr = data.trim();
        const existingCase = await getCaseByFileNumber(fileNumberStr);
        
        if (existingCase) {
          router.replace(`/case/${existingCase.id}`);
        } else {
          // Deduce case type from file number prefix if possible (e.g. "CIV" from "CIV-2026-0001")
          let deducedType = 'CIV';
          if (fileNumberStr.includes('-')) {
            deducedType = fileNumberStr.split('-')[0].toUpperCase();
          }

          Alert.alert(
            'Record Not Found',
            `No local file matching number "${fileNumberStr}" was found in the database. Would you like to create a new record for this file number?`,
            [
              { 
                text: 'Add New Case', 
                onPress: () => {
                  router.replace({
                    pathname: '/case/add',
                    params: {
                      fileNumber: fileNumberStr,
                      caseType: deducedType
                    }
                  });
                } 
              },
              { text: 'Scan Again', onPress: () => setScanned(false) },
              { text: 'Cancel', style: 'cancel', onPress: () => router.back() }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error handling scanned data:', error);
      Alert.alert('Scan Error', 'An error occurred while processing the scanned data.');
      setScanned(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.overlayText}>Align QR code inside the frame to scan</Text>
        {scanned && (
          <Button mode="contained" onPress={() => setScanned(false)} style={styles.rescanBtn}>
            Tap to Scan Again
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    textAlign: 'center',
    marginVertical: 16,
    opacity: 0.8,
  },
  permissionBtn: {
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 20,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  rescanBtn: {
    marginTop: 20,
    borderRadius: 8,
  },
});
