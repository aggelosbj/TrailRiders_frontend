import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { RideUser } from '@/api/ridesApi';
import { getBlockedApi, unblockUserApi } from '@/api/socialApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { EmptyState, Loading, ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';

export default function BlockedUsersScreen() {
  const [list, setList] = useState<RideUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setList(await getBlockedApi());
    } catch (err) {
      showMessage('Could not load', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unblock = async (u: RideUser) => {
    try {
      await unblockUserApi(u.id);
      setList((l) => l.filter((x) => x.id !== u.id));
    } catch (err) {
      showMessage('Could not unblock', errorMessage(err));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Blocked riders" />
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={<Text style={styles.hint}>Blocked riders can&apos;t message or follow you, and you won&apos;t see their rides.</Text>}
          ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No blocked riders" />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar name={item.fullName || item.username} image={item.image} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{item.fullName || item.username}</Text>
                <Text style={styles.small}>@{item.username}</Text>
              </View>
              <Button title="Unblock" variant="outline" small onPress={() => unblock(item)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hint: { color: Brand.muted, fontSize: 13, marginBottom: 12, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.lg, padding: 12, marginBottom: 10, ...Shadow },
  name: { fontSize: 15, fontWeight: '800', color: Brand.text },
  small: { fontSize: 12, color: Brand.muted, marginTop: 2 },
});
