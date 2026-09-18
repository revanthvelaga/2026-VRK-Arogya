import { GeoPoint } from '../types/geo-point';

export function toGeoPoint(latitude: number, longitude: number): GeoPoint {
  return { type: 'Point', coordinates: [longitude, latitude] };
}
