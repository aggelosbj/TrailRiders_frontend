import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Brand } from '@/constants/brand';

type IconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (active: IconName, inactive: IconName) => {
  const TabIcon = ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={23} color={color as string} />
  );
  return TabIcon;
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          borderTopWidth: 0,
          backgroundColor: '#fff',
          ...(Platform.OS === 'web'
            ? ({ boxShadow: '0 -4px 20px rgba(0,51,102,0.08)' } as object)
            : { elevation: 12, shadowColor: '#003366', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }),
        },
        sceneStyle: { backgroundColor: Brand.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="joinRide" options={{ title: 'Explore', tabBarIcon: tabIcon('compass', 'compass-outline') }} />
      <Tabs.Screen
        name="createRide"
        options={{
          title: 'Create',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.createBtn, focused && { backgroundColor: Brand.navy }]}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="myRides" options={{ title: 'My Rides', tabBarIcon: tabIcon('bicycle', 'bicycle-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 4,
    borderColor: '#fff',
  },
});
