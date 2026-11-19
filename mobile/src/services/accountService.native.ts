import { database, put } from '../local/store';
export async function getAiPhotoConsent() {
  const row = await (
    await database()
  ).getFirstAsync<{ body: string }>(
    "SELECT body FROM records WHERE kind='settings' AND scope='device' AND id='onDeviceAnalysis'"
  );
  return row ? JSON.parse(row.body) === true : true;
}
export const setAiPhotoConsent = (on: boolean) => put('settings', 'device', 'onDeviceAnalysis', on);
