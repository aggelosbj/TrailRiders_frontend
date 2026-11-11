import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteAccountApi } from '@/api/authApi';
import { clearTokens, errorMessage } from '@/api/client';
import { Button } from '@/components/kit/button';
import { confirmAction } from '@/components/kit/dialogs';
import { FormField } from '@/components/kit/form';
import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const CONSEQUENCES = [
  'Your profile and photos are removed',
  'Rides you organize are cancelled and riders are notified',
  'You are removed from rides you joined',
  'Your comments and notifications are deleted',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const matches = confirmName.trim() === user?.username;

  const handleDelete = async () => {
    if (!matches) {
      setError('Type your username exactly to confirm');
      return;
    }
    if (!(await confirmAction('Delete account forever?', 'This cannot be undone.', 'Delete', true))) return;

    setDeleting(true);
    try {
      await deleteAccountApi(confirmName.trim());
      await clearTokens();
      await logout();
      router.replace('/loginRegister/loginRegisterScreen');
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Delete account" />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.warn}>
          <Ionicons name="warning" size={30} color={Brand.danger} />
          <Text style={styles.warnTitle}>This is permanent</Text>
          {CONSEQUENCES.map((c) => (
            <View key={c} style={styles.row}>
              <Ionicons name="close-circle" size={16} color={Brand.danger} />
              <Text style={styles.rowText}>{c}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            Type <Text style={{ fontWeight: '900', color: Brand.text }}>{user?.username}</Text> to confirm
          </Text>
          <FormField icon="at-outline" value={confirmName} onChangeText={(v) => { setConfirmName(v); setError(null); }} autoCapitalize="none" autoCorrect={false} error={error} placeholder={user?.username} />
          <Button title="Delete my account" variant="danger" icon="trash-outline" onPress={handleDelete} loading={deleting} disabled={!matches} style={{ marginBottom: 14 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  warn: { backgroundColor: Brand.dangerSoft, borderRadius: Radius.lg, padding: 18, marginBottom: 16 },
  warnTitle: { fontSize: 18, fontWeight: '900', color: Brand.danger, marginTop: 8, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rowText: { color: Brand.textSoft, fontSize: 14, flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadow },
  label: { color: Brand.muted, fontSize: 14, marginBottom: 12 },
});
