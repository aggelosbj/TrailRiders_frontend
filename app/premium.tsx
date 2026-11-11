import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { cancelSubscriptionApi, changePlanApi, getPlansApi, getSubscriptionApi, Plan, startSubscriptionApi, SubStatus } from '@/api/premiumApi';
import { formatDate } from '@/api/ridesApi';
import { Button } from '@/components/kit/button';
import { confirmAction, showMessage } from '@/components/kit/dialogs';
import { Loading } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

const GOLD = '#F5A524';

const PERKS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'star', title: 'PRO badge', text: 'Stand out on your profile, your rides, trips and events.' },
  { icon: 'heart', title: 'Support the community', text: 'Help us keep TrailRiders running and growing in Greece.' },
  { icon: 'flash', title: 'Early access', text: 'Try new features before everyone else.' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [selected, setSelected] = useState(12);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([getPlansApi(), getSubscriptionApi()]);
      setPlans(p);
      setStatus(s);
      if (s.active) setSelected(s.nextPlan ?? s.plan ?? 12);
    } catch (err) {
      showMessage('Could not load Premium', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const subscribe = async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    if (!(await confirmAction(`Start ${plan.label} plan?`, `€${plan.price.toFixed(2)} for ${plan.months} month(s).\n\nDemo mode: no payment is charged yet.`, 'Subscribe'))) return;
    setBusy(true);
    try {
      setStatus(await startSubscriptionApi(selected));
      refreshUser();
      showMessage('Welcome to Premium ⭐', 'Your PRO badge is now active.');
    } catch (err) {
      showMessage('Could not subscribe', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changePlan = async () => {
    setBusy(true);
    try {
      setStatus(await changePlanApi(selected));
      showMessage('Plan changed', 'The new plan applies from your next renewal.');
    } catch (err) {
      showMessage('Could not change plan', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!(await confirmAction('Cancel Premium?', 'You will lose your PRO badge right away.', 'Cancel Premium', true))) return;
    setBusy(true);
    try {
      await cancelSubscriptionApi();
      await load();
      refreshUser();
    } catch (err) {
      showMessage('Could not cancel', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  const active = !!status?.active;
  const currentPlan = plans.find((p) => p.id === status?.plan);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Brand.background }} contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={['#1F2937', Brand.navy]} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.crown}>
          <Ionicons name="star" size={34} color="#fff" />
        </View>
        <Text style={styles.title}>TrailRiders Premium</Text>
        <Text style={styles.subtitle}>{active ? 'Thanks for supporting the community! 🙌' : 'Ride with a PRO badge and support the app.'}</Text>
      </LinearGradient>

      <View style={{ padding: 20, marginTop: -26 }}>
        {active && (
          <View style={[styles.card, { borderWidth: 2, borderColor: GOLD }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={22} color={Brand.success} />
              <Text style={styles.cardTitle}>Premium is active</Text>
            </View>
            <Text style={styles.text}>
              Plan: {currentPlan?.label ?? '—'} · Renews on {formatDate(status?.expireDate?.slice(0, 10))}
            </Text>
            {!!status?.nextPlan && status.nextPlan !== status.plan && (
              <Text style={[styles.text, { color: Brand.primaryDark }]}>
                Switching to {plans.find((p) => p.id === status.nextPlan)?.label} at renewal
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          {PERKS.map((p) => (
            <View key={p.title} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Ionicons name={p.icon} size={18} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.text}>{p.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.section}>{active ? 'Change plan' : 'Choose a plan'}</Text>
        {plans.map((p) => {
          const isSel = p.id === selected;
          const perMonth = p.price / p.months;
          return (
            <Pressable key={p.id} onPress={() => setSelected(p.id)} style={[styles.plan, isSel && styles.planActive]}>
              <View style={[styles.radio, isSel && { borderColor: GOLD }]}>{isSel && <View style={styles.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planLabel}>
                  {p.label}
                  {p.id === 12 ? '  ' : ''}
                  {p.id === 12 && <Text style={styles.save}> BEST VALUE </Text>}
                </Text>
                <Text style={styles.text}>€{perMonth.toFixed(2)} / month</Text>
              </View>
              <Text style={styles.price}>€{p.price.toFixed(2)}</Text>
            </Pressable>
          );
        })}

        <Text style={styles.demo}>Demo mode — no payment is charged. Real payments are coming soon.</Text>

        {active ? (
          <>
            <Button title="Change plan" onPress={changePlan} loading={busy} disabled={selected === (status?.nextPlan ?? status?.plan)} />
            <Button title="Cancel Premium" variant="ghost" onPress={cancel} disabled={busy} style={{ marginTop: 6 }} />
          </>
        ) : (
          <Button title="Get Premium" icon="star" onPress={subscribe} loading={busy} style={{ backgroundColor: GOLD }} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 46 },
  back: { alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  crown: { width: 76, height: 76, borderRadius: 38, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 14 },
  subtitle: { color: '#D1D5DB', fontSize: 15, marginTop: 6, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 14, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text },
  text: { fontSize: 13, color: Brand.muted, marginTop: 3, lineHeight: 18 },
  perk: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  perkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  section: { fontSize: 18, fontWeight: '800', color: Brand.text, marginTop: 8, marginBottom: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: 'transparent', ...Shadow },
  planActive: { borderColor: GOLD, backgroundColor: '#FFFBEB' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: GOLD },
  planLabel: { fontSize: 16, fontWeight: '800', color: Brand.text },
  save: { backgroundColor: Brand.success, color: '#fff', fontSize: 10, fontWeight: '900', borderRadius: 6, overflow: 'hidden' },
  price: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  demo: { textAlign: 'center', color: Brand.muted, fontSize: 12, marginVertical: 12 },
});
