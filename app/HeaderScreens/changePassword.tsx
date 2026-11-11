import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { changePasswordApi } from '@/api/authApi';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { FormField } from '@/components/kit/form';
import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ old?: string; new?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: typeof errors = {};
    if (!oldPassword) e.old = 'Enter your current password';
    if (newPassword.length < 6) e.new = 'At least 6 characters';
    else if (newPassword === oldPassword) e.new = 'Choose a different password';
    if (confirm !== newPassword) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await changePasswordApi(oldPassword, newPassword, confirm);
      showMessage('Password updated', 'Use your new password next time you log in.');
      router.back();
    } catch (err) {
      setErrors({ old: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Change password" />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.intro}>For your security, enter your current password first.</Text>
          <FormField label="Current password" icon="lock-closed-outline" password value={oldPassword} onChangeText={setOld} error={errors.old} />
          <FormField label="New password" icon="key-outline" password value={newPassword} onChangeText={setNew} error={errors.new} hint="At least 6 characters" />
          <FormField label="Confirm new password" icon="key-outline" password value={confirm} onChangeText={setConfirm} error={errors.confirm} onSubmitEditing={save} />
          <Button title="Update password" onPress={save} loading={saving} style={{ marginBottom: 14 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  intro: { color: Brand.muted, fontSize: 14, marginBottom: 16, lineHeight: 20 },
});
