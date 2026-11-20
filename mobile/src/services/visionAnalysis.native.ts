import type { VisionAnalysisOutcome } from './visionAnalysis';
import { infer, modelStatus } from '../local/model';
import { categoryInName, colourIn, garmentFromAnswers, shortAnswer } from '../local/validation';
export async function analyzeGarmentImageMobile(
  photo: string,
  _mime?: string,
  hint?: string
): Promise<VisionAnalysisOutcome> {
  let raw: string | undefined;
  try {
    if (!photo.startsWith('file://')) throw new Error('Choose a garment photo from this phone.');
    const status = await modelStatus();
    if (status === 'missing')
      throw new Error('Turn on HeyHanger.ai (Profile → HeyHanger.ai, a one-time 363 MB download) to scan photos. You can enter the details yourself now.');
    if (status === 'unsupported') throw new Error('Photo scanning needs the HeyHanger Android app build.');
    if (status === 'failed')
      throw new Error("HeyHanger.ai couldn't start on this phone, so photo scanning is paused. You can enter the details yourself.");
    // One short question per conversation: the 500M base model answers these
    // reliably, while a multi-field form makes it skip fields and repeat.
    const transcript: string[] = [];
    const ask = async (question: string) => {
      const answer = await infer(question, photo);
      transcript.push(question.split('?')[0] + '? → ' + answer.trim().slice(0, 160));
      raw = transcript.join('\n');
      return answer;
    };
    let name = shortAnswer(await ask('What is this garment and what colour is it? Answer in one short sentence.'));
    let category: string | undefined = hint;
    if (!categoryInName(name)) {
      const type = shortAnswer(
        await ask('What type of clothing is this? Answer with one or two words, like shirt, trousers, jacket, sneakers or bag.'),
        3
      );
      if (categoryInName(type)) name = (colourIn(name) ? colourIn(name) + ' ' : name + ' ') + type;
      else if (!category) category = await ask('Is this garment a top, bottoms, outerwear, shoes or an accessory? Answer with one word.');
    }
    const colour = colourIn(name) ? undefined : await ask('What is the main colour of this garment? Answer with one or two words.');
    const formality = await ask('Is this garment casual, smart casual, formal or evening wear? Answer with one of those.');
    return { ok: true, raw, data: garmentFromAnswers({ name, category, colour, formality }) };
  } catch (error) {
    return {
      ok: false,
      reason: 'ai_unavailable',
      message: error instanceof Error ? error.message : 'Photo analysis failed.',
      raw
    };
  }
}
