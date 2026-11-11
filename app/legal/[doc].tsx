import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';

// NOTE: This is a starting template written for the app's features. Before publishing,
// have it reviewed by a lawyer and fill in the company details (name, address, contact e-mail).
const CONTACT = 'support@trailriders.gr';
const UPDATED = '11 November 2026';

const DOCS: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  terms: {
    title: 'Terms of Service',
    sections: [
      { h: '1. About TrailRiders', p: 'TrailRiders is a community app that helps motorcyclists and car enthusiasts organise and join rides, share seats on trips and attend events. By creating an account you agree to these terms.' },
      { h: '2. Your account', p: 'You must be at least 18 years old (or the age of majority where you live) and give accurate information. You are responsible for keeping your password safe and for everything that happens under your account.' },
      { h: '3. Riding safely and legally', p: 'Rides, ride shares and events are organised by users, not by TrailRiders. You take part at your own risk. Always follow the traffic laws, wear proper safety gear, hold a valid licence and insurance, and never ride under the influence. TrailRiders does not check routes, vehicles or participants and is not responsible for accidents, damage or injuries.' },
      { h: '4. Ride sharing', p: 'Seat offers are arrangements between private users. Any sharing of costs (e.g. fuel) must not exceed the actual cost of the trip — commercial transport is not allowed through the app.' },
      { h: '5. Community rules', p: 'Be respectful. Do not post content that is illegal, hateful, harassing, sexual, violent, misleading or spam, and do not promote street racing or dangerous riding. You can report content and block users at any time; we may remove content and suspend accounts that break these rules.' },
      { h: '6. Your content', p: 'You keep ownership of the photos and text you post. You give TrailRiders a licence to show them in the app so other users can see your rides and profile. Do not upload content you do not have the rights to.' },
      { h: '7. Premium', p: 'Premium is an optional paid subscription with extra features. Prices are shown in the app before you buy. Subscriptions renew automatically unless cancelled before the renewal date. Purchases made through the App Store or Google Play follow their refund policies.' },
      { h: '8. Changes and termination', p: 'We may update the app and these terms. If the changes are important we will notify you in the app. You can delete your account at any time from Settings → Delete account.' },
      { h: '9. Contact', p: `Questions? Write to ${CONTACT}.` },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: '1. What we collect', p: 'Account data (username, e-mail, password stored encrypted), profile data you choose to add (name, photo, bike, location, bio, social links, phone), the rides, ride shares, events, comments, ratings and messages you create, and technical data needed to run the service (e.g. login tokens).' },
      { h: '2. Why we use it', p: 'To run your account and show your rides and profile to other riders, to deliver messages and notifications, to keep the community safe (reports, blocks, abuse prevention) and to provide Premium features. We do not sell your personal data.' },
      { h: '3. Who can see what', p: 'Your public profile, rides, events and comments are visible to other users. Your e-mail and phone are not shown on your public profile. Messages are visible only to you and the other person.' },
      { h: '4. Service providers', p: 'We use hosting and e-mail providers to run the app, and Google if you choose “Continue with Google”. If you buy Premium, payments are processed by Apple, Google or our payment provider — we never see your full card details.' },
      { h: '5. How long we keep data', p: 'While your account is active. When you delete your account, your profile, rides, events, messages, comments and ratings are deleted from our database.' },
      { h: '6. Your rights (GDPR)', p: `You can access, correct, export or delete your data, and object to or restrict its processing. Most of this you can do in the app (Edit profile, Delete account). For anything else contact ${CONTACT}. You can also complain to the Hellenic Data Protection Authority (www.dpa.gr).` },
      { h: '7. Security', p: 'Passwords are stored hashed, connections should use HTTPS in production, and access to the database is restricted.' },
      { h: '8. Children', p: 'TrailRiders is not intended for people under 18.' },
    ],
  },
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = DOCS[doc] ?? DOCS.terms;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title={content.title} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.updated}>Last updated: {UPDATED}</Text>
        <View style={styles.card}>
          {content.sections.map((s) => (
            <View key={s.h} style={{ marginBottom: 16 }}>
              <Text style={styles.h}>{s.h}</Text>
              <Text style={styles.p}>{s.p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  updated: { color: Brand.muted, fontSize: 12, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 18, paddingBottom: 4, ...Shadow },
  h: { fontSize: 15, fontWeight: '800', color: Brand.text, marginBottom: 6 },
  p: { fontSize: 14, color: Brand.textSoft, lineHeight: 21 },
});
