import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Picker from 'expo-image-picker';
import { Cpu, Download, X } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import {
  cancelGeneration,
  deleteModel,
  infer,
  initializeBenchmark,
  initializeModel,
  installModel,
  memoryKiB,
  model,
  modelStatus,
  retryAfterLoadFailure,
  unloadModel
} from '../local/model';
import { optimizeGarmentImage } from '../services/imageOptimizer';
import { getAiPhotoConsent } from '../services/accountService';

// Technical details (model name, GPU switch, timings, memory) are shown only
// in the demo build; customers just see "HeyHanger.ai".
const DIAGNOSTICS = process.env.EXPO_PUBLIC_HEYHANGER_AI_DEMO === '1';

/**
 * HeyHanger V2: garment scans, pairing and styling run on this phone with the
 * published SmolVLM2-500M model (LiteRT-LM). No API key and no Gemini call.
 * The model is downloaded once (363 MB) and kept in the app's private,
 * non-backed-up storage. Without it, scans fall back to manual entry and
 * outfits use HeyHanger's own wardrobe rules.
 */
type Status = Awaited<ReturnType<typeof modelStatus>>;
const STATUS_LABEL: Record<Status, string> = {
  missing: 'Off',
  installed: 'On',
  ready: 'On · ready',
  failed: "Couldn't start on this phone",
  unsupported: 'Needs the HeyHanger Android app'
};

function useLocalModelStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const refresh = useCallback(() => {
    if (Platform.OS === 'web') return;
    void modelStatus()
      .then(setStatus)
      .catch(() => setStatus('unsupported'));
  }, []);
  useEffect(refresh, [refresh]);
  return { status, refresh };
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary,
  danger
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, primary && s.buttonPrimary, danger && s.buttonDanger, disabled && s.buttonDisabled]}
    >
      <Text style={[s.buttonText, primary && s.buttonTextPrimary, danger && s.buttonTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function LocalModelSection({ onStatusChange }: { onStatusChange?: () => void }) {
  const { status, refresh } = useLocalModelStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [gpu, setGpu] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const locked = useRef(false);

  async function run(action: () => Promise<string>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      setMessage(await action());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
      abort.current = null;
      setBusy(false);
      locked.current = false;
      refresh();
      onStatusChange?.();
    }
  }

  async function download() {
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    await installModel(setProgress, controller.signal);
    return 'HeyHanger.ai is ready.';
  }

  async function testPhoto() {
    const picked = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled) return 'Photo selection cancelled.';
    const photo = await optimizeGarmentImage(picked.assets[0].uri);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const start = performance.now();
      await initializeBenchmark(gpu);
      const loaded = performance.now();
      if (controller.signal.aborted) return 'Test cancelled.';
      const answer = await infer('Identify the garment and its main colour. Say unknown if unclear.', photo.uri);
      const seconds = (performance.now() - loaded) / 1000,
        memory = await memoryKiB();
      return (
        (gpu ? 'GPU' : 'CPU') +
        ' · Load ' +
        ((loaded - start) / 1000).toFixed(2) +
        ' s · Answer ' +
        seconds.toFixed(2) +
        ' s' +
        (memory ? ' · App memory (PSS) ' + Math.round(memory / 1024) + ' MiB' : '') +
        '\n' +
        answer.trim()
      );
    } finally {
      const temp = new File(photo.uri);
      if (temp.exists && photo.uri !== picked.assets[0].uri) temp.delete();
      // Scans and styling run on the CPU; don't leave a GPU engine behind.
      if (gpu) await unloadModel().catch(() => {});
    }
  }

  const installed = status === 'installed' || status === 'ready';
  if (status === 'failed')
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <Cpu size={16} color={COLORS.primary} />
          <Text style={s.title}>HeyHanger.ai</Text>
        </View>
        <Text style={s.body}>
          HeyHanger.ai couldn't start on this phone, so it is paused. Photo scans use manual entry and outfits use
          HeyHanger's wardrobe rules. Your wardrobe is not affected.
        </Text>
        <ActionButton
          label="Try starting it again"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await retryAfterLoadFailure();
              await initializeModel();
              return 'HeyHanger.ai is ready.';
            })
          }
        />
        <ActionButton
          danger
          label="Turn off and remove"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              await deleteModel();
              return 'HeyHanger.ai turned off.';
            })
          }
        />
        {!!message && <Text selectable style={s.message}>{message}</Text>}
      </View>
    );
  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Cpu size={16} color={COLORS.primary} />
        <Text style={s.title}>HeyHanger.ai</Text>
      </View>
      <Text style={s.body}>
        HeyHanger.ai reads your garment photos, pairs pieces and styles outfits from your wardrobe. Turn it on once with a
        363 MB download.{DIAGNOSTICS ? ' Model: ' + model.name + '.' : ''}
      </Text>
      <View style={s.row}>
        <Text style={s.label}>Status</Text>
        <Text style={s.value}>{status ? STATUS_LABEL[status] : 'Checking…'}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Download</Text>
        <Text style={s.value}>
          {Math.ceil(model.bytes / 1_000_000)} MB once · {Math.floor(Paths.availableDiskSpace / 1_000_000)} MB free
        </Text>
      </View>
      {progress !== null && (
        <View style={s.progressTrack} accessibilityLabel={'Downloading ' + progress + '%'}>
          <View style={[s.progressFill, { width: `${progress}%` }]} />
          <Text style={s.progressText}>Downloading {progress}%</Text>
        </View>
      )}
      {!installed && (
        <ActionButton
          primary
          label="Turn on HeyHanger.ai"
          disabled={busy || status === 'unsupported'}
          onPress={() => void run(download)}
        />
      )}
      {installed && (
        <>
          <ActionButton
            primary
            label={status === 'ready' ? 'Ready' : 'Get ready now'}
            disabled={busy || status === 'ready'}
            onPress={() =>
              void run(async () => {
                await initializeModel();
                return 'HeyHanger.ai is ready.';
              })
            }
          />
          {DIAGNOSTICS && (
            <>
              <View style={s.switchRow}>
                <Text style={s.label}>Test on GPU</Text>
                <Switch value={gpu} disabled={busy} onValueChange={setGpu} accessibilityLabel="Test on GPU" />
              </View>
              <ActionButton label="Test with a garment photo" disabled={busy} onPress={() => void run(testPhoto)} />
            </>
          )}
          {DIAGNOSTICS && (
            <>
              <ActionButton
                label="Release memory"
                disabled={busy || status !== 'ready'}
                onPress={() =>
                  void run(async () => {
                    await unloadModel();
                    return 'Memory released.';
                  })
                }
              />
            </>
          )}
          <ActionButton
            danger
            label="Turn off and remove"
            disabled={busy}
            onPress={() =>
              Alert.alert('Turn off HeyHanger.ai?', 'This removes the 363 MB download. Your wardrobe is not affected, and you can turn it on again.', [
                { text: 'Keep' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () =>
                    void run(async () => {
                      await deleteModel();
                      return 'HeyHanger.ai turned off.';
                    })
                }
              ])
            }
          />
        </>
      )}
      {busy && (
        <View style={s.busyRow}>
          <ActivityIndicator color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <ActionButton
              label="Cancel"
              onPress={() => {
                abort.current?.abort();
                void cancelGeneration().catch((e) => setMessage(String(e)));
              }}
            />
          </View>
        </View>
      )}
      {!!message && (
        <Text selectable style={s.message} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </View>
  );
}

/** Home card shown until the model is downloaded; opens the same controls. */
export function LocalModelBanner() {
  const { status, refresh } = useLocalModelStatus();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(true);
  useEffect(() => {
    void getAiPhotoConsent()
      .then(setConsent)
      .catch(() => {});
  }, []);
  // Hidden for people who turned AI photo analysis off in Profile.
  if (Platform.OS === 'web' || status !== 'missing' || !consent) return null;
  return (
    <>
      <TouchableOpacity style={s.banner} activeOpacity={0.85} onPress={() => setOpen(true)}>
        <Download size={18} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>Turn on HeyHanger.ai</Text>
          <Text style={s.bannerBody}>A one-time 363 MB update for photo scans, pairing and outfit styling.</Text>
        </View>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.screen}>
          <TouchableOpacity style={s.close} onPress={() => setOpen(false)} accessibilityLabel="Close">
            <X size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <LocalModelSection onStatusChange={refresh} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  body: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flexShrink: 1, textAlign: 'right' },
  button: {
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  buttonPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  buttonDanger: { borderColor: 'rgba(168, 73, 59, 0.3)' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  buttonTextPrimary: { color: '#FFFFFF' },
  buttonTextDanger: { color: COLORS.danger },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressTrack: {
    height: 28,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSubtle,
    overflow: 'hidden',
    justifyContent: 'center'
  },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.primaryAlphaDark },
  progressText: { textAlign: 'center', fontSize: 12.5, fontWeight: '600', color: COLORS.textPrimary },
  message: { fontSize: 13, lineHeight: 19, color: COLORS.textPrimary },
  banner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMedium
  },
  bannerTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.textPrimary },
  bannerBody: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  close: { alignSelf: 'flex-end', padding: 16 }
});
