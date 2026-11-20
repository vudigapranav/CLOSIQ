import React, { useEffect, useRef, useState } from 'react';
import { Button, Text, TextInput, View, StyleSheet } from 'react-native';
import type { GarmentItem } from '../../../src/types/wardrobe';
import { isGarmentAvailable } from '../../../src/types/wardrobe';
import { cancelGeneration } from '../local/model';
import { answerWardrobeQuestion } from '../services/outfitStylist.native';
import { COLORS } from '../theme';

type Turn = { question: string; answer: string };
export function StylingChat({ items }: { items: GarmentItem[] }) {
  const [turns, setTurns] = useState<Turn[]>([]),
    [question, setQuestion] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0),
    ownRequest = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  const pieces = items.filter(isGarmentAvailable);
  async function ask() {
    if (ownRequest.current || !question.trim() || !pieces.length) return;
    const attempt = ++generation.current,
      q = question.trim();
    ownRequest.current = true;
    setPending(true);
    setError('');
    try {
      const answer = await answerWardrobeQuestion(q, pieces);
      if (!answer) throw new Error('The model returned an empty answer.');
      if (attempt === generation.current) {
        setTurns((prev) => [...prev.slice(-5), { question: q, answer }]);
        setQuestion('');
      }
    } catch (e) {
      if (attempt === generation.current) setError(String(e));
    } finally {
      ownRequest.current = false;
      if (attempt === generation.current) setPending(false);
    }
  }
  return (
    <View style={s.panel}>
      <Text style={s.title}>Ask about your wardrobe</Text>
      {turns.map((t, i) => (
        <View key={i} style={s.turn}>
          <Text style={s.question}>{t.question}</Text>
          <Text selectable>{t.answer}</Text>
        </View>
      ))}
      <TextInput
        style={s.input}
        accessibilityLabel="Styling question"
        placeholder="How could I dress this up?"
        maxLength={260}
        value={question}
        onChangeText={setQuestion}
      />
      <Button
        title={pending ? 'Thinking…' : 'Ask HeyHanger.ai'}
        disabled={pending || !question.trim()}
        onPress={() => void ask()}
      />
      {pending && (
        <Button
          title="Cancel"
          onPress={() => {
            void cancelGeneration().catch((e) => setError(String(e)));
          }}
        />
      )}
      {!!error && <Text accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  panel: { padding: 16, gap: 10, backgroundColor: COLORS.surfaceElevated, borderRadius: 14 },
  title: { fontSize: 17, fontWeight: '600' },
  turn: { gap: 5 },
  question: { fontWeight: '600', color: COLORS.primary },
  input: { padding: 12, backgroundColor: COLORS.bg, borderRadius: 10 }
});
