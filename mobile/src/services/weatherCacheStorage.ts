import AsyncStorage from '@react-native-async-storage/async-storage';
import { WeatherData } from '../types/weather';

const STORAGE_KEY = '@closiq_weather_cache';

/** Same try/catch-wrapped, always-resolves pattern every other storage
 *  service in this app uses — a cache read/write failure must never throw
 *  into the weather flow, it should just behave as "no cache available." */
export async function loadCachedWeather(): Promise<WeatherData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeatherData;
  } catch (err) {
    console.warn('Failed to load cached weather from storage:', err);
    return null;
  }
}

export async function saveCachedWeather(data: WeatherData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save weather to cache:', err);
  }
}
