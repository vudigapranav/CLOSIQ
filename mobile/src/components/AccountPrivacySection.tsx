import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { deleteMyAccount, exportMyData, getAiPhotoConsent, setAiPhotoConsent } from '../services/accountService';

/** Privacy & data controls: AI photo consent, data export, account deletion. */
export const AccountPrivacySection: React.FC = () => {
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let alive = true;
    getAiPhotoConsent().then((v) => alive && setConsent(v));
    return () => {
      alive = false;
    };
  }, []);

  const toggleConsent = async (next: boolean) => {
    setConsent(next);
    await setAiPhotoConsent(next);
    setMessage({
      text: next ? 'AI photo analysis is on.' : 'AI photo analysis is off. You can add pieces by hand.',
      error: false
    });
  };

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    setMessage(null);
    const res = await exportMyData();
    setBusy(null);
    if (!res.ok) setMessage({ text: res.message, error: true });
  };

  const startDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and wardrobe data. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setTyped('');
            setConfirmVisible(true);
          }
        }
      ]
    );
  };

  const confirmDelete = async () => {
    if (typed.trim() !== 'DELETE' || busy) return;
    setBusy('delete');
    const res = await deleteMyAccount();
    setBusy(null);
    setConfirmVisible(false);
    // On success the auth listener returns the app to the Login screen.
    if (!res.ok) setMessage({ text: res.message, error: true });
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <ShieldCheck size={16} color={COLORS.primary} />
        <Text style={styles.title}>Privacy &amp; data</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Use AI photo analysis</Text>
            <Text style={styles.help}>
              Photos are sent to the AI provider only to scan a garment. Turn off to add pieces by hand.
            </Text>
          </View>
          <Switch
            value={consent}
            onValueChange={toggleConsent}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
            accessibilityLabel="Use AI photo analysis"
          />
        </View>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleExport}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Export my data"
        >
          <Text style={styles.actionText}>Export my data</Text>
          {busy === 'export' && <ActivityIndicator size="small" color={COLORS.primary} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={startDelete}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete account</Text>
        </TouchableOpacity>
      </View>

      {message && (
        <Text style={[styles.message, message.error && { color: COLORS.danger }]} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      )}

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Type DELETE to confirm</Text>
            <Text style={styles.help}>Your account and wardrobe data will be permanently removed.</Text>
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor={COLORS.textMuted}
              accessibilityLabel="Type DELETE to confirm account deletion"
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmVisible(false)}
                disabled={busy === 'delete'}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, (typed.trim() !== 'DELETE' || busy === 'delete') && { opacity: 0.4 }]}
                onPress={confirmDelete}
                disabled={typed.trim() !== 'DELETE' || busy === 'delete'}
                accessibilityRole="button"
                accessibilityLabel="Permanently delete my account"
              >
                {busy === 'delete' ? (
                  <ActivityIndicator size="small" color={COLORS.surfaceElevated} />
                ) : (
                  <Text style={styles.deleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { marginLeft: 8, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  rowText: { flex: 1, paddingRight: 12 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  help: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 3 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  actionText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  message: { marginTop: 10, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  backdrop: { flex: 1, backgroundColor: COLORS.primaryAlphaDark, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.lg, padding: 20 },
  dialogTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  input: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary
  },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  deleteBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 8,
    minWidth: 80,
    alignItems: 'center'
  },
  deleteText: { fontSize: 14, fontWeight: '700', color: COLORS.surfaceElevated }
});
