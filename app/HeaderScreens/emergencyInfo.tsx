import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { BLOOD_TYPES, BloodType, ICE_LIMITS, updateProfileApi } from '@/api/userApi';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { ChipSelect, FormField } from '@/components/kit/form';
import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const PHONE_RE = /^\+?[0-9 ()\-.]{3,30}$/;

/** Edit the "In Case of Emergency" info shown on the SOS screen. Private: never shown on the public profile. */
export default function EmergencyInfoScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [bloodType, setBloodType] = useState<string>(user?.bloodType ?? '');
  const [allergies, setAllergies] = useState(user?.allergies ?? '');
  const [medicalNotes, setMedicalNotes] = useState(user?.medicalNotes ?? '');
  const [emergencyName, setEmergencyName] = useState(user?.emergencyName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyPhone ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const phone = emergencyPhone.trim();
    if (phone && !PHONE_RE.test(phone)) {
      setPhoneError('Enter a valid phone number, e.g. +30 690 123 4567');
      return;
    }
    setPhoneError(null);
    setSaving(true);
    try {
      const updated = await updateProfileApi({
        bloodType: (bloodType || null) as BloodType | null,
        allergies: allergies.trim(),
        medicalNotes: medicalNotes.trim(),
        emergencyName: emergencyName.trim(),
        emergencyPhone: phone,
      });
      setUser(updated);
      showMessage('Saved', 'Your emergency info is ready on the SOS screen.');
      if (router.canGoBack()) router.back();
    } catch (err) {
      showMessage('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Emergency info" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Ionicons name="medkit" size={22} color={Brand.danger} />
            <Text style={styles.introText}>
              Shown on your SOS screen so you — or someone helping you — can find it fast. Only you can see it; it is never on your public profile.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medical</Text>
            <ChipSelect label="Blood type" options={[...BLOOD_TYPES]} value={bloodType} onChange={setBloodType} allowEmpty />
            <FormField
              label="Allergies"
              icon="alert-circle-outline"
              value={allergies}
              onChangeText={setAllergies}
              maxLength={ICE_LIMITS.allergies}
              placeholder="e.g. Penicillin, bee stings"
            />
            <FormField
              label="Medical notes"
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              multiline
              maxLength={ICE_LIMITS.medicalNotes}
              placeholder="Conditions, medication, anything first responders should know"
              hint={`${medicalNotes.length}/${ICE_LIMITS.medicalNotes}`}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Emergency contact</Text>
            <FormField
              label="Name"
              icon="person-outline"
              value={emergencyName}
              onChangeText={setEmergencyName}
              maxLength={ICE_LIMITS.emergencyName}
              placeholder="e.g. Maria (sister)"
            />
            <FormField
              label="Phone"
              icon="call-outline"
              value={emergencyPhone}
              onChangeText={(v) => {
                setEmergencyPhone(v);
                if (phoneError) setPhoneError(null);
              }}
              keyboardType="phone-pad"
              maxLength={ICE_LIMITS.emergencyPhone}
              placeholder="+30 690 123 4567"
              error={phoneError}
            />
          </View>

          <Button title="Save emergency info" icon="checkmark-circle-outline" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', gap: 12, backgroundColor: Brand.dangerSoft, borderRadius: Radius.lg, padding: 14, marginBottom: 16 },
  introText: { flex: 1, color: Brand.textSoft, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, paddingBottom: 2, marginBottom: 16, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 14 },
});
