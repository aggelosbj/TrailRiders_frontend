import * as Font from 'expo-font';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function Splash() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [progressAnim] = useState(() => new Animated.Value(0)); // δημιουργείται μία φορά
  const [progress, setProgress] = useState(0);

  // Φόρτωση γραμματοσειράς
  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'JacquesFrancoisShadow': require('@/assets/fonts/JacquesFrancoisShadow-Regular.ttf'),
        });
      } catch (err) {
        // Αν αποτύχει η γραμματοσειρά, δείχνουμε το splash με τη default
        console.warn('Splash font failed to load', err);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  // Προσομοίωση φόρτωσης assets/API με σταδιακό progress
  useEffect(() => {
    const minTime = 1000; // minimum 1 δευτερόλεπτο
    const start = Date.now();

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 6;
      if (currentProgress > 100) currentProgress = 100;
      setProgress(currentProgress);
      Animated.timing(progressAnim, {
        toValue: currentProgress,
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      if (currentProgress >= 100) clearInterval(interval);
    }, 50);

    // Προσομοίωση φόρτωσης API/asset
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 1500)); // assets/API
      const elapsed = Date.now() - start;
      const remaining = Math.max(minTime - elapsed, 0);
      await new Promise(resolve => setTimeout(resolve, remaining));
      setProgress(100);
    })();

    return () => clearInterval(interval);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Image source={require('@/images/logo.webp')} style={styles.logo} />
      <Text style={styles.title}>Trail Riders Greece</Text>
      <View style={styles.progressBackground}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA', justifyContent: 'center', alignItems: 'center', padding: 20 },
  logo: { width: 180, height: 180, resizeMode: 'contain', marginBottom: 20 },
  title: { fontFamily: 'JacquesFrancoisShadow', fontSize: 32, color: '#003366', marginBottom: 40, textAlign: 'center' },
  progressBackground: { width: '80%', height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#1DA1FA' },
});
