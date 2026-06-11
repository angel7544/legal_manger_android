import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInput, Button, Text, SegmentedButtons, HelperText, useTheme, Card } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { addCase } from '../../database/db';
import { ScreenBackground } from '../../components/ScreenBackground';

export default function AddCaseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    fileNumber?: string;
    caseNumber?: string;
    caseType?: string;
    clientName?: string;
    clientPhone?: string;
    oppositeParty?: string;
    advocateName?: string;
    courtName?: string;
    rackNumber?: string;
    shelfNumber?: string;
  }>();

  // Form State
  const [fileNumber, setFileNumber] = useState(params.fileNumber || '');
  const [caseNumber, setCaseNumber] = useState(params.caseNumber || '');
  const [caseType, setCaseType] = useState(params.caseType || 'CIV'); // Default to CIV
  const [clientName, setClientName] = useState(params.clientName || '');
  const [clientPhone, setClientPhone] = useState(params.clientPhone || '');
  const [oppositeParty, setOppositeParty] = useState(params.oppositeParty || '');
  const [party1, setParty1] = useState('');
  const [party2, setParty2] = useState('');
  const [respondentCategory, setRespondentCategory] = useState('');
  const [advocateName, setAdvocateName] = useState(params.advocateName || '');
  const [courtName, setCourtName] = useState(params.courtName || '');
  const [filingDate, setFilingDate] = useState('');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [rackNumber, setRackNumber] = useState(params.rackNumber || '');
  const [shelfNumber, setShelfNumber] = useState(params.shelfNumber || '');
  const [positionNumber, setPositionNumber] = useState('0');
  const [fileStatus, setFileStatus] = useState('In Office');
  const [priority, setPriority] = useState('Medium');
  const [notes, setNotes] = useState('');

  // Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);

  // Date Picker state
  const [showFilingDatePicker, setShowFilingDatePicker] = useState(false);
  const [showHearingDatePicker, setShowHearingDatePicker] = useState(false);

  const onFilingDateChange = (event: any, selectedDate?: Date) => {
    setShowFilingDatePicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setFilingDate(dateStr);
      if (errors.filingDate) setErrors({ ...errors, filingDate: '' });
    }
  };

  const onHearingDateChange = (event: any, selectedDate?: Date) => {
    setShowHearingDatePicker(false);
    if (selectedDate && event.type !== 'dismissed') {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setNextHearingDate(dateStr);
      if (errors.nextHearingDate) setErrors({ ...errors, nextHearingDate: '' });
    }
  };

  const validate = () => {
    const tempErrors: { [key: string]: string } = {};
    if (!caseNumber.trim()) tempErrors.caseNumber = 'Case number is required';
    if (!caseType.trim()) tempErrors.caseType = 'Case type (prefix) is required';
    if (!clientName.trim()) tempErrors.clientName = 'Client name is required';
    
    // Validate date format YYYY-MM-DD if entered
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (filingDate && !dateRegex.test(filingDate)) {
      tempErrors.filingDate = 'Filing Date must be in YYYY-MM-DD format';
    }
    if (nextHearingDate) {
      if (!dateRegex.test(nextHearingDate)) {
        tempErrors.nextHearingDate = 'Next Hearing Date must be in YYYY-MM-DD format';
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const hearingDateObj = new Date(nextHearingDate);
        if (hearingDateObj <= today) {
          tempErrors.nextHearingDate = 'Next Hearing Date must be in the future';
        }
      }
    }
    if (clientPhone.trim() && !/^\d{10}$/.test(clientPhone.trim())) {
      tempErrors.clientPhone = 'Client phone must be exactly 10 digits';
    }
    if (!advocateName.trim()) {
      tempErrors.advocateName = 'Advocate name is required';
    }
    if (!rackNumber.trim()) {
      tempErrors.rackNumber = 'Rack number is required';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await addCase({
        file_number: fileNumber.trim() || undefined,
        case_number: caseNumber.trim(),
        case_type: caseType.trim().toUpperCase(),
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        opposite_party: oppositeParty.trim() || null,
        party1: party1.trim() || null,
        party2: party2.trim() || null,
        respondent_category: respondentCategory.trim() || null,
        advocate_name: advocateName.trim() || null,
        court_name: courtName.trim() || null,
        filing_date: filingDate.trim() || null,
        next_hearing_date: nextHearingDate.trim() || null,
        rack_number: rackNumber.trim() || null,
        shelf_number: shelfNumber.trim() || null,
        position_number: positionNumber.trim() || '0',
        file_status: fileStatus,
        priority: priority,
        notes: notes.trim() || null,
      });

      Alert.alert('Success', 'Physical file record created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving case:', error);
      Alert.alert('Error', 'Failed to save case file. Make sure file number sequences are correct.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
      <ScrollView 
        style={[styles.container, { backgroundColor: 'transparent' }]}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
      <Card style={styles.card} elevation={1}>
        <Card.Content>
          {/* Group 1: File Identity */}
          <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
            File & Case Identity
          </Text>

          <TextInput
            label="File Number (Optional - Auto-generated if blank)"
            value={fileNumber}
            onChangeText={setFileNumber}
            mode="outlined"
            placeholder="e.g. CIV-2026-0001"
            style={styles.input}
          />
          <HelperText type="info" style={{ marginTop: -8, marginBottom: 8, opacity: 0.7 }}>
            Leave empty to automatically assign the next sequential file number.
          </HelperText>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TextInput
                label="Case Type Prefix"
                value={caseType}
                onChangeText={(val) => {
                  setCaseType(val);
                  if (errors.caseType) setErrors({ ...errors, caseType: '' });
                }}
                mode="outlined"
                placeholder="e.g. CIV, CRI, LND"
                error={!!errors.caseType}
              />
              {errors.caseType ? <HelperText type="error">{errors.caseType}</HelperText> : null}
            </View>
            <View style={{ flex: 1.5 }}>
              <TextInput
                label="Case Number"
                value={caseNumber}
                onChangeText={(val) => {
                  setCaseNumber(val);
                  if (errors.caseNumber) setErrors({ ...errors, caseNumber: '' });
                }}
                mode="outlined"
                placeholder="e.g. 238/2023"
                error={!!errors.caseNumber}
              />
              {errors.caseNumber ? <HelperText type="error">{errors.caseNumber}</HelperText> : null}
            </View>
          </View>

          <Text variant="bodySmall" style={styles.label}>Priority Level</Text>
          <SegmentedButtons
            value={priority}
            onValueChange={setPriority}
            buttons={[
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
            ]}
            style={styles.segmented}
          />

          <Text variant="bodySmall" style={styles.label}>File Status / Location</Text>
          <SegmentedButtons
            value={fileStatus}
            onValueChange={setFileStatus}
            buttons={[
              { value: 'In Office', label: 'In Office' },
              { value: 'In Court', label: 'In Court' },
              { value: 'With Junior', label: 'Junior' },
            ]}
            style={styles.segmented}
          />

          {/* Group 2: Litigants */}
          <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
            Litigants & Parties
          </Text>

          <TextInput
            label="Client Name"
            value={clientName}
            onChangeText={(val) => {
              setClientName(val);
              if (errors.clientName) setErrors({ ...errors, clientName: '' });
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.clientName}
          />
          {errors.clientName ? <HelperText type="error">{errors.clientName}</HelperText> : null}

          <TextInput
            label="Client Phone"
            value={clientPhone}
            onChangeText={(val) => {
              const numericValue = val.replace(/[^0-9]/g, '');
              if (numericValue.length <= 10) {
                setClientPhone(numericValue);
                if (errors.clientPhone && numericValue.length === 10) setErrors({ ...errors, clientPhone: '' });
              }
            }}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            error={!!errors.clientPhone}
          />
          {errors.clientPhone ? <HelperText type="error">{errors.clientPhone}</HelperText> : null}

          <TextInput
            label="Opposite Party Name"
            value={oppositeParty}
            onChangeText={setOppositeParty}
            mode="outlined"
            style={styles.input}
          />

          <View style={styles.row}>
            <TextInput
              label="Petitioner (Party 1)"
              value={party1}
              onChangeText={setParty1}
              mode="outlined"
              style={[styles.input, { flex: 1, marginRight: 8 }]}
            />
            <TextInput
              label="Respondent (Party 2)"
              value={party2}
              onChangeText={setParty2}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
            />
          </View>

          {party2.trim().length > 0 && (
            <TextInput
              label="Respondent Category"
              value={respondentCategory}
              onChangeText={setRespondentCategory}
              mode="outlined"
              placeholder="e.g. Individual, Government, Corporate, PSU"
              style={styles.input}
            />
          )}

          {/* Group 3: Legal Context */}
          <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
            Legal Context
          </Text>

          <TextInput
            label="Advocate Name *"
            value={advocateName}
            onChangeText={(val) => {
              setAdvocateName(val);
              if (errors.advocateName) setErrors({ ...errors, advocateName: '' });
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.advocateName}
          />
          {errors.advocateName ? <HelperText type="error">{errors.advocateName}</HelperText> : null}

          <TextInput
            label="Court Name"
            value={courtName}
            onChangeText={setCourtName}
            mode="outlined"
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TouchableOpacity onPress={() => setShowFilingDatePicker(true)}>
                <View pointerEvents="none">
                  <TextInput
                    label="Filing Date"
                    value={filingDate}
                    mode="outlined"
                    placeholder="YYYY-MM-DD"
                    error={!!errors.filingDate}
                    right={<TextInput.Icon icon="calendar" />}
                  />
                </View>
              </TouchableOpacity>
              {errors.filingDate ? <HelperText type="error">{errors.filingDate}</HelperText> : null}
            </View>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => setShowHearingDatePicker(true)}>
                <View pointerEvents="none">
                  <TextInput
                    label="Next Hearing Date"
                    value={nextHearingDate}
                    mode="outlined"
                    placeholder="YYYY-MM-DD"
                    error={!!errors.nextHearingDate}
                    right={<TextInput.Icon icon="calendar" />}
                  />
                </View>
              </TouchableOpacity>
              {errors.nextHearingDate ? <HelperText type="error">{errors.nextHearingDate}</HelperText> : null}
            </View>
          </View>

          {showFilingDatePicker && (
            <DateTimePicker
              value={filingDate ? new Date(filingDate) : new Date()}
              mode="date"
              display="default"
              onChange={onFilingDateChange}
            />
          )}
          {showHearingDatePicker && (
            <DateTimePicker
              value={nextHearingDate ? new Date(nextHearingDate) : new Date()}
              mode="date"
              display="default"
              onChange={onHearingDateChange}
            />
          )}

          {/* Group 4: Physical Office Location */}
          <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
            Physical Rack Location
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <TextInput
                label="Rack Number *"
                value={rackNumber}
                onChangeText={(val) => {
                  setRackNumber(val);
                  if (errors.rackNumber) setErrors({ ...errors, rackNumber: '' });
                }}
                mode="outlined"
                placeholder="e.g. A"
                style={styles.input}
                error={!!errors.rackNumber}
              />
              {errors.rackNumber ? <HelperText type="error">{errors.rackNumber}</HelperText> : null}
            </View>
            <TextInput
              label="Shelf Number"
              value={shelfNumber}
              onChangeText={setShelfNumber}
              mode="outlined"
              placeholder="e.g. 3"
              style={[styles.input, { flex: 1, marginRight: 8 }]}
            />
            <TextInput
              label="Position Number"
              value={positionNumber}
              onChangeText={setPositionNumber}
              mode="outlined"
              placeholder="e.g. 0"
              style={[styles.input, { flex: 1 }]}
            />
          </View>

          {/* Group 5: Notes */}
          <Text variant="titleMedium" style={[styles.groupTitle, { color: theme.colors.primary }]}>
            Miscellaneous
          </Text>

          <TextInput
            label="Notes / Comments"
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
            contentStyle={{ paddingVertical: 6 }}
          >
            Create Record
          </Button>
        </Card.Content>
      </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 8,
    marginBottom: 32,
  },
  groupTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    opacity: 0.8,
    fontWeight: '500',
  },
  segmented: {
    marginBottom: 16,
  },
  saveBtn: {
    marginTop: 20,
    borderRadius: 8,
  },
});
