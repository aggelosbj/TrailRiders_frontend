import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreenExpo from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Splash from '@/components/Splash';
import { Brand } from '@/constants/brand';
import { AuthProvider, useAuth } from '@/context/AuthContext';

SplashScreenExpo.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 1800;

function RootNavigator() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    SplashScreenExpo.hideAsync().catch(() => {});
    const t = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = !initializing && minTimePassed;

  // Auth guard: logged-out users only see the login/register screens
  useEffect(() => {
    if (!ready) return;
    const inAuthArea = segments[0] === 'loginRegister';
    if (!user && !inAuthArea) {
      router.replace('/loginRegister/loginRegisterScreen');
    } else if (user && (inAuthArea || !segments[0])) {
      router.replace('/(tabs)/home');
    }
  }, [ready, user, segments, router]);

  if (!ready) return <Splash />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Brand.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="loginRegister/loginRegisterScreen" />
        <Stack.Screen name="loginRegister/login" />
        <Stack.Screen name="loginRegister/register" />
        <Stack.Screen name="loginRegister/forgotPassword" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="rideDetails/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="editRide/[id]" />
        <Stack.Screen name="passengerRide/[id]" />
        <Stack.Screen name="editPassengerRide/[id]" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="editEvent/[id]" />
        <Stack.Screen name="premium" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="HeaderScreens/notifications" />
        <Stack.Screen name="HeaderScreens/menu" />
        <Stack.Screen name="HeaderScreens/editProfile" />
        <Stack.Screen name="HeaderScreens/changePassword" />
        <Stack.Screen name="HeaderScreens/deleteAccount" />
        <Stack.Screen name="about" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
