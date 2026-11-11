import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { imageSource } from '@/api/ridesApi';
import { updateProfileApi } from '@/api/userApi';
import { Avatar } from '@/components/kit/avatar';
import { Button } from '@/components/kit/button';
import { showMessage } from '@/components/kit/dialogs';
import { FormField } from '@/components/kit/form';
import { pickImage } from '@/components/kit/image-picker';
import { ScreenHeader } from '@/components/kit/layout';
import { Brand, Radius, Shadow } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [bike, setBike] = useState(user?.bike ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [tags, setTags] = useState((user?.tags ?? []).join(', '));
  const [instagram, setInstagram] = useState(user?.instagram ?? '');
  const [facebook, setFacebook] = useState(user?.facebook ?? '');
  const [tiktok, setTiktok] = useState(user?.tiktok ?? '');
  const [image, setImage] = useState<string | null>(user?.image ?? null);
  const [cover, setCover] = useState<string | null>(user?.cover ?? null);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const save = async () => {
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Please enter a valid e-mail');
      return;
    }
    setEmailError(null);
    setSaving(true);
    try {
      const updated = await updateProfileApi({
        fullName,
        email,
        phone,
        bike,
        location,
        bio,
        tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        instagram,
        facebook,
        tiktok,
        image,
        cover,
      });
      setUser(updated);
      router.back();
    } catch (err) {
      showMessage('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.background }} edges={['top']}>
      <ScreenHeader title="Edit profile" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Cover + avatar */}
          <Pressable style={styles.cover} onPress={async () => setCover((await pickImage([16, 7])) ?? cover)}>
            {cover ? (
              <Image source={imageSource(cover)} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[Brand.navy, Brand.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            <View style={styles.coverBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
              <Text style={styles.coverBadgeText}>Cover</Text>
            </View>
          </Pressable>
          <Pressable style={styles.avatar} onPress={async () => setImage((await pickImage([1, 1])) ?? image)}>
            <Avatar name={fullName || user?.username} image={image} size={96} ring />
            <View style={styles.cam}>
              <Ionicons name="camera" size={15} color="#fff" />
            </View>
          </Pressable>
          {(image || cover) && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 8 }}>
              {image && (
                <Pressable onPress={() => setImage(null)}>
                  <Text style={styles.remove}>Remove photo</Text>
                </Pressable>
              )}
              {cover && (
                <Pressable onPress={() => setCover(null)}>
                  <Text style={styles.remove}>Remove cover</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>About you</Text>
            <FormField label="Full name" icon="id-card-outline" value={fullName} onChangeText={setFullName} maxLength={100} placeholder="Your name" />
            <FormField label="Bike / car" icon="bicycle-outline" value={bike} onChangeText={setBike} maxLength={120} placeholder="e.g. Yamaha MT-07" />
            <FormField label="Location" icon="location-outline" value={location} onChangeText={setLocation} maxLength={120} placeholder="e.g. Thessaloniki" />
            <FormField label="Bio" value={bio} onChangeText={setBio} multiline placeholder="Tell other riders about yourself" />
            <FormField label="Interests" icon="pricetags-outline" value={tags} onChangeText={setTags} placeholder="touring, offroad, coffee rides" hint="Separate with commas" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact</Text>
            <FormField label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={30} error={emailError} />
            <FormField label="Phone" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="Only visible to you" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Social</Text>
            <FormField label="Instagram" icon="logo-instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" maxLength={120} placeholder="@username" />
            <FormField label="Facebook" icon="logo-facebook" value={facebook} onChangeText={setFacebook} autoCapitalize="none" maxLength={120} placeholder="username or link" />
            <FormField label="TikTok" icon="logo-tiktok" value={tiktok} onChangeText={setTiktok} autoCapitalize="none" maxLength={120} placeholder="@username" />
          </View>

          <Button title="Save profile" icon="checkmark-circle-outline" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cover: { height: 130, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Brand.navy },
  coverBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  coverBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  avatar: { alignSelf: 'center', marginTop: -48, marginBottom: 10 },
  cam: {
    position: 'absolute',
    right: 2,
    bottom: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  remove: { color: Brand.danger, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, paddingBottom: 2, marginBottom: 16, ...Shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Brand.text, marginBottom: 14 },
});
