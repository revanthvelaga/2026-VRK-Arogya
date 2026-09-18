// Shape TypeORM returns/accepts for postgres geometry/geography columns.
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}
