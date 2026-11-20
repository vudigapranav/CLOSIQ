import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Picker from 'expo-image-picker';
import { getProfileSeedWardrobe } from '../../../src/data/garmentCatalog';
import type { GarmentItem } from '../../../src/types/wardrobe';
import { COLORS, RADIUS } from '../theme';
import { LocalModelSection } from '../components/LocalModelSection';
import { StylingChat } from '../components/StylingChat';
import { optimizeGarmentImage } from '../services/imageOptimizer';
import { analyzeGarmentImageMobile } from '../services/visionAnalysis';
import { generateOutfitMobile, swapGarmentMobile } from '../services/outfitStylist';
import { resolveStaticImageUrl } from '../services/garmentImages';

/**
 * Demo-only entry (EXPO_PUBLIC_HEYHANGER_AI_DEMO=1, see index.ts): the on-device
 * AI with no sign-in and no storage, so the model can be shown on an
 * emulator or phone without an account. It calls exactly the services the
 * real screens use; nothing is saved and no account data is read. Normal
 * builds never load it.
 */
const SAMPLE_WARDROBE: GarmentItem[] = getProfileSeedWardrobe('men').map((g) => ({
  ...g,
  imageUrl: resolveStaticImageUrl(g.imageUrl)
}));

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScanDemo() {
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState('');
  async function scan() {
    const picked = await Picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (picked.canceled) return;
    setBusy(true);
    setResult('');
    try {
      const optimized = await optimizeGarmentImage(picked.assets[0].uri);
      setPhoto(optimized.uri);
      const start = Date.now();
      const outcome = await analyzeGarmentImageMobile(optimized.uri);
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      setResult(
        outcome.ok
          ? `Scanned by HeyHanger.ai in ${seconds} s\nName: ${outcome.data.name}\nCategory: ${outcome.data.category} · ${outcome.data.subcategory}\nColour: ${outcome.data.color}${outcome.data.secondaryColors?.length ? ' (+ ' + outcome.data.secondaryColors.join(', ') + ')' : ''}\nPattern: ${outcome.data.pattern || '—'} · Formality: ${outcome.data.formality}\nStyle: ${outcome.data.style || '—'}\nPairing: ${outcome.data.pairingNotes || '—'}` + (outcome.raw ? `\n\nModel answers:\n${outcome.raw}` : '')
          : `Scan did not finish (${seconds} s): ${outcome.message}` + (outcome.raw ? `\nModel said: ${outcome.raw}` : '')
      );
    } catch (e) {
      setResult(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>1 · Scan a garment photo</Text>
      <Button label="Pick a photo and scan it" disabled={busy} onPress={() => void scan()} />
      {busy && <ActivityIndicator color={COLORS.primary} />}
      {photo && <Image source={{ uri: photo }} style={s.photo} resizeMode="contain" />}
      {!!result && <Text selectable style={s.result}>{result}</Text>}
    </View>
  );
}

function StyleDemo() {
  const [prompt, setPrompt] = useState('Dinner with friends on Friday');
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const pieces = useMemo(() => ids.map((id) => SAMPLE_WARDROBE.find((g) => g.id === id)!).filter(Boolean), [ids]);
  async function style() {
    setBusy(true);
    setSummary('');
    const start = Date.now();
    try {
      const res = await generateOutfitMobile(prompt, SAMPLE_WARDROBE);
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      setIds(res.data.garmentIds);
      setSummary(
        `${(res.mode as string) === 'on_device' ? 'Picked by HeyHanger.ai' : 'Picked by HeyHanger wardrobe rules'} in ${seconds} s` +
          (res.notice ? ` (${res.notice})` : '') +
          `\n${res.data.title}\nWhy it works: ${res.data.explanation.summary}`
      );
    } catch (e) {
      setSummary(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function swapTop() {
    const top = pieces.find((p) => p.category === 'tops');
    if (!top) return;
    setBusy(true);
    try {
      const res = await swapGarmentMobile(ids, top.id, 'tops', prompt, SAMPLE_WARDROBE);
      if (res.ok) {
        setIds(ids.map((id) => (id === top.id ? res.data.replacementGarmentId : id)));
        setSummary((prev) => prev + `\nSwapped ${top.name} → ${SAMPLE_WARDROBE.find((g) => g.id === res.data.replacementGarmentId)?.name}`);
      } else setSummary((prev) => prev + '\n' + res.data.whyItWorks);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.title}>2 · Style an outfit</Text>
      <Text style={s.note}>Sample wardrobe: {SAMPLE_WARDROBE.length} pieces from HeyHanger's men's catalog.</Text>
      <TextInput style={s.input} value={prompt} onChangeText={setPrompt} accessibilityLabel="Occasion" />
      <Button label="Style an outfit" disabled={busy} onPress={() => void style()} />
      {ids.length > 0 && <Button label="Swap the top" disabled={busy} onPress={() => void swapTop()} />}
      {busy && <ActivityIndicator color={COLORS.primary} />}
      <View style={s.row}>
        {pieces.map((p) => (
          <View key={p.id} style={s.piece}>
            <Image source={{ uri: p.imageUrl }} style={s.thumb} />
            <Text style={s.pieceName} numberOfLines={2}>{p.name}</Text>
          </View>
        ))}
      </View>
      {!!summary && <Text selectable style={s.result}>{summary}</Text>}
    </View>
  );
}

export function AiDemoApp() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 4 }}>
          <Text style={s.heading}>HeyHanger.ai demo</Text>
          <Text style={s.note}>
            Demo build: no sign-in and nothing is saved. HeyHanger.ai only, no Gemini and no API key.
          </Text>
          <LocalModelSection />
          <ScanDemo />
          <StyleDemo />
          <View style={s.card}>
            <Text style={s.title}>3 · Ask HeyHanger.ai about the wardrobe</Text>
            <StylingChat items={SAMPLE_WARDROBE} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  note: { fontSize: 12.5, color: COLORS.textSecondary, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    gap: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  button: { paddingVertical: 12, borderRadius: RADIUS.pill, alignItems: 'center', backgroundColor: COLORS.primary },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  input: { padding: 12, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated, color: COLORS.textPrimary },
  result: { fontSize: 13.5, lineHeight: 20, color: COLORS.textPrimary },
  photo: { width: '100%', height: 220, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  piece: { width: 92, alignItems: 'center', gap: 4 },
  thumb: { width: 92, height: 92, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceElevated },
  pieceName: { fontSize: 11.5, textAlign: 'center', color: COLORS.textPrimary }
});
