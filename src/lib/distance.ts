import * as Location from 'expo-location';
import { getDistance } from 'geolib';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export async function getCurrentPosition(): Promise<GeoPoint> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in Settings to record visit distance.');
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const meters = getDistance(from, to);
  return Math.round((meters / 1000) * 10) / 10;
}
