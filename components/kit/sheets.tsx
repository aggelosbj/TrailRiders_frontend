import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { REPORT_REASONS, reportApi, ReportTarget } from '@/api/socialApi';
import { Brand, Radius } from '@/constants/brand';
import { Button } from './button';
import { showMessage } from './dialogs';

type IconName = keyof typeof Ionicons.glyphMap;

export interface SheetAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
}

function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
          <View style={styles.handle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "⋯" menu with a list of actions */
export function ActionSheet({ visible, onClose, title, actions }: { visible: boolean; onClose: () => void; title?: string; actions: SheetAction[] }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {actions.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => [styles.action, pressed && { backgroundColor: Brand.input }]}
          onPress={() => {
            onClose();
            setTimeout(a.onPress, 250);
          }}
        >
          <View style={[styles.actionIcon, a.destructive && { backgroundColor: Brand.dangerSoft }]}>
            <Ionicons name={a.icon} size={19} color={a.destructive ? Brand.danger : Brand.navy} />
          </View>
          <Text style={[styles.actionText, a.destructive && { color: Brand.danger }]}>{a.label}</Text>
        </Pressable>
      ))}
      <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: 4 }} />
    </BottomSheet>
  );
}

/** Report a user or piece of content (required by the App Store / Play Store for user content) */
export function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  subject,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: number;
  subject: string;
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    setReason('');
    setDetails('');
    onClose();
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await reportApi(targetType, targetId, reason, details.trim() || undefined);
      close();
      showMessage('Report sent', res.message);
    } catch (err) {
      showMessage('Could not send report', errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <Text style={styles.title}>Report {subject}</Text>
      <Text style={styles.sub}>Reports are anonymous. Our team reviews every report.</Text>
      {REPORT_REASONS.map((r) => (
        <Pressable key={r.key} style={styles.reason} onPress={() => setReason(r.key)}>
          <Ionicons name={reason === r.key ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r.key ? Brand.primary : Brand.faint} />
          <Text style={styles.reasonText}>{r.label}</Text>
        </Pressable>
      ))}
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Add details (optional)"
        placeholderTextColor={Brand.faint}
        style={styles.input}
        multiline
        maxLength={1000}
      />
      <Button title="Send report" variant="danger" onPress={send} loading={sending} disabled={!reason} />
      <Button title="Cancel" variant="ghost" onPress={close} style={{ marginTop: 4 }} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,20,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: Radius.xl + 4,
    borderTopRightRadius: Radius.xl + 4,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '900', color: Brand.text, marginBottom: 6 },
  sub: { fontSize: 13, color: Brand.muted, marginBottom: 12 },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderRadius: Radius.md, paddingHorizontal: 6 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Brand.navySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionText: { fontSize: 16, fontWeight: '700', color: Brand.text },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  reasonText: { fontSize: 15, color: Brand.text, fontWeight: '600' },
  input: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    padding: 12,
    minHeight: 70,
    fontSize: 14,
    color: Brand.text,
    backgroundColor: Brand.input,
    marginVertical: 12,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as object,
});
