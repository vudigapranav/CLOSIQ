import { list, put } from '../local/store';
export const buildOutfitSignature = (ids: string[]) => [...ids].sort().join('|');
export async function loadRecentOutfitSignatures() {
  return (await list<{ signature: string; at: number }>('history'))
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((r) => r.signature);
}
export async function recordRecentOutfit(ids: string[]) {
  const signature = buildOutfitSignature(ids);
  if (signature) await put('history', 'device', signature, { signature, at: Date.now() });
}
