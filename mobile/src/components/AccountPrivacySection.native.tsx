import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DeviceEventEmitter,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Picker from 'expo-image-picker';
import { COLORS } from '../theme';
import {
  cancelGeneration,
  deleteModel,
  infer,
  initializeModel,
  initializeBenchmark,
  installModel,
  memoryKiB,
  model,
  modelStatus,
  unloadModel
} from '../local/model';
import { restoreBackup, exportBackup } from '../local/backup';
import { getAiPhotoConsent, setAiPhotoConsent } from '../services/accountService.native';
import { fetchCurrentWeather } from '../services/weatherService';
import { optimizeGarmentImage } from '../services/imageOptimizer';

export function AccountPrivacySection() {
  const [page, setPage] = useState(false),
    [status, setStatus] = useState('Checking'),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''),
    [progress, setProgress] = useState<number | null>(null),
    [consent, setConsent] = useState(true);
  const [gpu, setGpu] = useState(false);
  const [legacy, setLegacy] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const abort = useRef<AbortController | null>(null),
    locked = useRef(false);
  useEffect(() => {
    void modelStatus()
      .then(setStatus)
      .catch((e) => setMessage(String(e)));
    void getAiPhotoConsent()
      .then(setConsent)
      .catch((e) => setMessage(String(e)));
  }, [page]);
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
      void modelStatus()
        .then(setStatus)
        .catch((e) => setMessage(String(e)));
    }
  }
  async function download() {
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    await installModel(setProgress, controller.signal);
    return 'Checksum verified. Load the model to check readiness.';
  }
  async function benchmark() {
    const picked = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled) return 'Photo selection cancelled.';
    const photo = await optimizeGarmentImage(picked.assets[0].uri);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const start = performance.now();
      await initializeBenchmark(gpu);
      const loaded = performance.now();
      if (controller.signal.aborted) return 'Benchmark cancelled.';
      const answer = await infer(
        'Identify the garment and its main colour. Say unknown if unclear.',
        photo.uri
      );
      const seconds = (performance.now() - loaded) / 1000,
        memory = await memoryKiB();
      return (
        (Platform.OS === 'android' ? (gpu ? 'GPU' : 'CPU') + ' · ' : '') +
        'Init ' +
        ((loaded - start) / 1000).toFixed(2) +
        ' s · Inference ' +
        seconds.toFixed(2) +
        ' s' +
        (memory ? ' · Process PSS after inference ' + Math.round(memory / 1024) + ' MiB' : '') +
        '\n' +
        answer
      );
    } finally {
      const temp = new File(photo.uri);
      if (temp.exists && photo.uri !== picked.assets[0].uri) temp.delete();
      // Garment scans and styling initialize on the CPU. Release a GPU engine
      // after its benchmark so later scans don't silently keep using it.
      if (gpu) await unloadModel().catch(() => {});
    }
  }
  return (
    <View style={s.panel}>
      <Text style={s.heading}>Privacy and device storage</Text>
      <Text>Analyze garment photos on this device</Text>
      <Switch
        accessibilityLabel="Analyze garment photos on this device"
        value={consent}
        onValueChange={(v) =>
          void run(async () => {
            await setAiPhotoConsent(v);
            setConsent(v);
            return 'Preference saved.';
          })
        }
      />
      <Button
        title="Refresh weather using my location"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const result = await fetchCurrentWeather(true);
            return result.status === 'success' && result.weather
              ? 'Saved the latest weather on this phone.'
              : 'Weather could not refresh. Previous readings are kept.';
          })
        }
      />
      <Button title="Manage local AI" onPress={() => setPage(true)} />
      <Button title="Export wardrobe and photos" disabled={busy} onPress={() => void run(exportBackup)} />
      <Button
        title="Restore backup folder"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const result = await restoreBackup();
            DeviceEventEmitter.emit('closiqDataImported');
            return result;
          })
        }
      />
      <Button title="Import from a V1 account" disabled={busy} onPress={() => setLegacy(!legacy)} />
      {legacy && (
        <View>
          <Text>Sign in to copy your cloud wardrobe to this device. This is a one-time download.</Text>
          <TextInput
            style={s.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Account email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={s.input}
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title="Import wardrobe"
            disabled={busy || !email || !password}
            onPress={() =>
              void run(async () => {
                const key = password;
                setPassword('');
                const { importLegacy } = await import('../local/legacyImport');
                try {
                  return await importLegacy(email.trim(), key, setMessage);
                } finally {
                  DeviceEventEmitter.emit('closiqDataImported');
                }
              })
            }
          />
        </View>
      )}
      {!page && !!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      <Modal visible={page} onRequestClose={() => setPage(false)} animationType="slide">
        <SafeAreaView style={s.screen}>
          <ScrollView contentContainerStyle={s.panel}>
            <Text style={s.heading}>{model.name}</Text>
            <Text selectable>
              Revision {model.revision.slice(0, 7)} · {status}
            </Text>
            <Text>
              One-time download · {Math.ceil(model.bytes / 1000000)} MB. Available storage{' '}
              {Math.floor(Paths.availableDiskSpace / 1000000)} MB.
            </Text>
            <Text>
              Garment photos and prompts stay on your phone. After installation you can use airplane mode.
            </Text>
            {progress !== null && <Text accessibilityLiveRegion="polite">Downloading {progress}%</Text>}
            <Button
              title={status === 'missing' ? 'Download model' : 'Download replacement'}
              disabled={busy || status === 'unsupported'}
              onPress={() => void run(download)}
            />
            <Button
              title="Load model"
              disabled={busy || !['installed', 'ready'].includes(status)}
              onPress={() =>
                void run(async () => {
                  await initializeModel();
                  return 'Model initialized on this device.';
                })
              }
            />
            {Platform.OS === 'android' && (
              <View>
                <Text>Benchmark with GPU</Text>
                <Switch
                  accessibilityLabel="Benchmark with GPU"
                  value={gpu}
                  disabled={busy}
                  onValueChange={setGpu}
                />
              </View>
            )}
            <Button
              title={'Test a garment photo on ' + (Platform.OS === 'android' ? 'Android' : 'iOS')}
              disabled={busy || !consent || !['installed', 'ready'].includes(status)}
              onPress={() => void run(benchmark)}
            />
            {busy && (
              <Button
                title="Cancel"
                onPress={() => {
                  abort.current?.abort();
                  void cancelGeneration().catch((e) => setMessage(String(e)));
                }}
              />
            )}
            <Button
              title="Unload model"
              disabled={busy || status !== 'ready'}
              onPress={() =>
                void run(async () => {
                  await unloadModel();
                  return 'Released model memory.';
                })
              }
            />
            <Button
              title="Delete model"
              disabled={busy || !['installed', 'ready'].includes(status)}
              onPress={() =>
                Alert.alert('Delete the downloaded model?', 'Your wardrobe stays on this phone.', [
                  { text: 'Keep' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      void run(async () => {
                        await deleteModel();
                        return 'Model removed.';
                      })
                  }
                ])
              }
            />
            {!!message && (
              <Text selectable accessibilityLiveRegion="polite">
                {message}
              </Text>
            )}
            <Button title="Done" onPress={() => setPage(false)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  panel: { padding: 20, gap: 14, backgroundColor: COLORS.bg },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  heading: { fontSize: 23, fontWeight: '600', color: COLORS.textPrimary },
  input: { padding: 12, backgroundColor: COLORS.surfaceElevated, borderRadius: 10 }
});
