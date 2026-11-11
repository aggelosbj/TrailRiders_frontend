import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/api/client';
import { Radius } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from './dialogs';

WebBrowser.maybeCompleteAuthSession();

// OAuth client ids from Google Cloud Console (put them in a .env file of the app):
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
// The backend needs the same ids in GOOGLE_CLIENT_IDS.
const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

const configuredForPlatform = !!Platform.select({
  web: CLIENT_IDS.webClientId,
  android: CLIENT_IDS.androidClientId || CLIENT_IDS.webClientId,
  ios: CLIENT_IDS.iosClientId || CLIENT_IDS.webClientId,
  default: CLIENT_IDS.webClientId,
});

function Shell({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  return (
    <Pressable style={styles.btn} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Image source={require('@/images/google-logo.png')} style={styles.logo} />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

function ConfiguredGoogleButton() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: CLIENT_IDS.webClientId,
    androidClientId: CLIENT_IDS.androidClientId,
    iosClientId: CLIENT_IDS.iosClientId,
  });

  useEffect(() => {
    if (!response) return;
    (async () => {
      try {
        if (response.type === 'success') {
          await loginWithGoogle(response.params.id_token);
          router.replace('/(tabs)/home');
        } else if (response.type === 'error') {
          showMessage('Google sign-in failed', response.error?.message ?? 'Please try again.');
        }
      } catch (err) {
        showMessage('Google sign-in failed', errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [response, loginWithGoogle, router]);

  return (
    <Shell
      loading={loading || !request}
      onPress={() => {
        setLoading(true);
        promptAsync().catch(() => setLoading(false));
      }}
    />
  );
}

/** "Continue with Google" — works once Google client ids are configured, otherwise explains how */
export function GoogleButton() {
  if (configuredForPlatform) return <ConfiguredGoogleButton />;
  return (
    <Shell
      onPress={() =>
        showMessage(
          'Google sign-in is not set up yet',
          'An administrator needs to add Google OAuth client IDs to the app (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID) and the server (GOOGLE_CLIENT_IDS). For now, create an account with your e-mail.'
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logo: { width: 20, height: 20, marginRight: 10 },
  text: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
