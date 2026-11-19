import type { Row } from './store';
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
function garment(v: unknown): boolean {
  return (
    object(v) &&
    ['id', 'name', 'color', 'imageUrl', 'subcategory', 'hexColor', 'fabric', 'dateAdded'].every(
      (k) => typeof v[k] === 'string'
    ) &&
    ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'].includes(String(v.category)) &&
    ['casual', 'smart_casual', 'formal', 'evening'].includes(String(v.formality)) &&
    typeof v.wearCount === 'number' &&
    typeof v.favorite === 'boolean' &&
    strings(v.tags) &&
    strings(v.seasons) &&
    ['secondaryColors', 'collections'].every((k) => v[k] === undefined || strings(v[k]))
  );
}
function outfit(v: unknown): boolean {
  return (
    object(v) &&
    ['id', 'title', 'occasion', 'vibe', 'formalityLabel', 'dateCreated'].every(
      (k) => typeof v[k] === 'string'
    ) &&
    Array.isArray(v.items) &&
    v.items.every(garment) &&
    object(v.explanation) &&
    typeof v.explanation.summary === 'string'
  );
}
export function validateRow(row: unknown): Row {
  if (
    !object(row) ||
    typeof row.id !== 'string' ||
    !row.id.length ||
    row.id.length > 1024 ||
    typeof row.body !== 'string'
  )
    throw new Error('Invalid backup row.');
  const v: unknown = JSON.parse(row.body);
  const scopeOK =
    row.kind === 'garment' ? ['men', 'women'].includes(String(row.scope)) : row.scope === 'device';
  let ok = false;
  if (scopeOK)
    switch (row.kind) {
      case 'garment':
        ok = garment(v) && (v as Obj).id === row.id;
        break;
      case 'look':
        ok = outfit(v) && (v as Obj).id === row.id;
        break;
      case 'event':
        ok =
          object(v) &&
          v.id === row.id &&
          ['title', 'date', 'time', 'occasion', 'createdAt'].every((k) => typeof v[k] === 'string') &&
          (!v.outfit || outfit(v.outfit));
        break;
      case 'history':
        ok = object(v) && typeof v.signature === 'string' && typeof v.at === 'number';
        break;
      case 'feedback':
        ok =
          object(v) &&
          strings(v.garmentIds) &&
          typeof v.signature === 'string' &&
          ['nice', 'okay', 'dislike'].includes(String(v.rating));
        break;
      case 'settings':
        ok =
          row.id === 'onDeviceAnalysis'
            ? typeof v === 'boolean'
            : row.id === 'wardrobe' &&
              object(v) &&
              ['men', 'women'].includes(String(v.profile)) &&
              ['avoid', 'sometimes', 'usually'].includes(String(v.layeringPreference));
        break;
      case 'profile':
        ok =
          row.id === 'guest' &&
          object(v) &&
          typeof v.name === 'string' &&
          typeof v.onboardingCompleted === 'boolean' &&
          strings(v.stylePreferences);
        break;
      case 'migration':
        ok = object(v) && typeof v.localId === 'string';
        break;
    }
  if (!ok) throw new Error('Invalid ' + String(row.kind) + ' backup record.');
  return { kind: row.kind, scope: row.scope, id: row.id, body: row.body } as Row;
}
