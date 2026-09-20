import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import type { Gender, GeocodeResult, Patient, Relationship } from '../api/types';
import { AddressAutocomplete } from './AddressAutocomplete';
import { Button } from './Button';
import { ErrorBanner } from './EmptyState';
import { colors, radius, spacing } from '../theme';

const RELATIONSHIPS: Relationship[] = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

function relationshipLabel(r: Relationship): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function ChipRow<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[];
  labels: (v: T) => string;
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[styles.chip, value === o && styles.chipActive]}
          onPress={() => onChange(o)}
        >
          <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{labels(o)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AddPatientForm({ onAdded, onCancel }: { onAdded: (p: Patient) => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('SPOUSE');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [cityText, setCityText] = useState('');
  const [city, setCity] = useState<GeocodeResult | null>(null);
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectCity = (result: GeocodeResult) => {
    setCity(result);
    setCityText(result.displayName);
    setPincode(result.pincode ?? '');
  };

  const submit = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError('Enter a name.');
      return;
    }
    setSubmitting(true);
    try {
      const patient = await api.post<Patient>('/patients', {
        fullName: fullName.trim(),
        relationship,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        areaAddress: city?.displayName || undefined,
        pincode: pincode.trim() || undefined,
        fullAddress: fullAddress.trim() || undefined,
        landmark: landmark.trim() || undefined,
        latitude: city?.lat,
        longitude: city?.lng,
        phone: phone.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
      });
      onAdded(patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add family member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      {error && <ErrorBanner message={error} />}

      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Name" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Relationship</Text>
      <ChipRow options={RELATIONSHIPS} labels={relationshipLabel} value={relationship} onChange={setRelationship} />

      <Text style={styles.label}>Gender (optional)</Text>
      <ChipRow
        options={GENDERS}
        labels={(g) => g.charAt(0) + g.slice(1).toLowerCase()}
        value={gender}
        onChange={setGender}
      />

      <Text style={styles.label}>Date of birth (optional)</Text>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>Full address (optional)</Text>
      <TextInput
        style={styles.input}
        value={fullAddress}
        onChangeText={setFullAddress}
        placeholder="House/flat no., street"
        placeholderTextColor={colors.inkFaint}
      />

      <Text style={styles.label}>City / Town / Village (optional)</Text>
      <AddressAutocomplete value={cityText} onChange={setCityText} onSelect={selectCity} placeholder="Type a city, town, or village…" />

      <Text style={styles.label}>Pincode</Text>
      <TextInput
        style={styles.input}
        value={pincode}
        onChangeText={setPincode}
        placeholder="Auto-filled from city/town/village"
        placeholderTextColor={colors.inkFaint}
        maxLength={6}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Landmark (optional)</Text>
      <TextInput style={styles.input} value={landmark} onChangeText={setLandmark} placeholder="Near…" placeholderTextColor={colors.inkFaint} />

      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="10-digit number"
        placeholderTextColor={colors.inkFaint}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Alternate phone (optional)</Text>
      <TextInput
        style={styles.input}
        value={alternatePhone}
        onChangeText={setAlternatePhone}
        placeholder="10-digit number"
        placeholderTextColor={colors.inkFaint}
        keyboardType="phone-pad"
      />

      <View style={styles.formActions}>
        <Button title={submitting ? 'Adding…' : 'Add family member'} onPress={submit} disabled={submitting} />
        <Button title="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </ScrollView>
  );
}

export function PatientPicker({
  patients,
  selectedId,
  onSelect,
  onPatientAdded,
}: {
  patients: Patient[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPatientAdded: (patient: Patient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <View>
      <Text style={styles.label}>Patient</Text>
      <TouchableOpacity style={styles.selectBox} onPress={() => setOpen(true)}>
        <Text style={styles.selectText}>
          {selected
            ? `${selected.fullName}${selected.relationship !== 'SELF' ? ` · ${relationshipLabel(selected.relationship)}` : ''}`
            : 'Select a patient…'}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{adding ? 'Add family member' : 'Choose a patient'}</Text>
            <TouchableOpacity
              onPress={() => {
                setOpen(false);
                setAdding(false);
              }}
            >
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          {adding ? (
            <AddPatientForm
              onAdded={(p) => {
                onPatientAdded(p);
                setAdding(false);
                setOpen(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <ScrollView>
              {patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.patientRow, p.id === selectedId && styles.patientRowActive]}
                  onPress={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.patientName}>{p.fullName}</Text>
                  {p.relationship !== 'SELF' && <Text style={styles.patientMeta}>{relationshipLabel(p.relationship)}</Text>}
                </TouchableOpacity>
              ))}
              <View style={{ marginTop: spacing.md }}>
                <Button title="+ Add family member" variant="secondary" onPress={() => setAdding(true)} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: spacing.md, marginBottom: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  selectText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  selectChevron: { fontSize: 13, color: colors.inkFaint },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.greySoft,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.inkSoft },
  chipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xxl },
  modalWrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingTop: spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  modalClose: { fontSize: 13, fontWeight: '700', color: colors.accent },
  patientRow: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  patientRowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  patientName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  patientMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
});
