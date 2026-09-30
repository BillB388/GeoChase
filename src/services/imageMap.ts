import type { ProjectProjection } from '@/types/project';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createProjectGeometry } from './projectGeometry';

export interface ImageMap {
  name: string;
  url: string;
  width: number;
  height: number;
  points: [number, number][];
  distance: number;
  unit: string;
  metersPerPixel: number;
  calibrationMode?: 'points' | 'ratio';
  // Stable placement keeps saved points aligned when only the scale changes.
  extent?: [number, number, number, number];
  // Physical length of the calibration segment on the paper map.
  paperDistanceCm?: number;
  // Legacy placement only: retained so existing drawings stay aligned.
  anchor?: { pixel: [number, number]; lat: number; lon: number; label: string };
}

export function imageMapExtent(
  image: ImageMap,
  projection: ProjectProjection = 'mercator'
): [number, number, number, number] {
  if (image.extent) return [...image.extent];
  const { getDistance } = createProjectGeometry(() => projection);
  const anchor = image.anchor;
  const origin = fromLonLat(anchor ? [anchor.lon, anchor.lat] : [0, 0]);
  const pixel = anchor?.pixel ?? [image.width / 2, image.height / 2];
  // Solve against the same distance policy used by the project ruler, so the
  // two calibration marks measure exactly the entered distance after placement.
  const a = image.points[0]!;
  const b = image.points[1]!;
  const target = Math.hypot(a[0] - b[0], a[1] - b[1]) * image.metersPerPixel;
  const coordinate = (p: number[], scale: number) => [
    origin[0]! + (p[0]! - pixel[0]!) * scale,
    origin[1]! - (p[1]! - pixel[1]!) * scale,
  ];
  let low = 0;
  let high = (image.metersPerPixel / Math.cos(((anchor?.lat ?? 0) * Math.PI) / 180)) * 2;
  for (let i = 0; i < 60; i++) {
    const scale = (low + high) / 2;
    if (getDistance(toLonLat(coordinate(a, scale)), toLonLat(coordinate(b, scale))) < target)
      low = scale;
    else high = scale;
  }
  const scale = (low + high) / 2;
  const left = origin[0]! - pixel[0]! * scale;
  const top = origin[1]! + pixel[1]! * scale;
  return [left, top - image.height * scale, left + image.width * scale, top];
}

// This database lives exclusively in the user's browser, alongside the local projects.
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('geochase_image_maps', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.addEventListener('error', () => reject(request.error));
  });
}

export async function readImageMap(id: string): Promise<ImageMap | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('images').objectStore('images').get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.addEventListener('error', () => reject(request.error));
    });
  } finally {
    db.close();
  }
}

export async function writeImageMap(id: string, image: ImageMap): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      // JSON serialization unwraps nested Vue proxies before IndexedDB clones the value.
      // eslint-disable-next-line unicorn/prefer-structured-clone
      transaction.objectStore('images').put(JSON.parse(JSON.stringify(image)), id);
      transaction.oncomplete = () => resolve();
      transaction.addEventListener('error', () => reject(transaction.error));
      transaction.addEventListener('abort', () => reject(transaction.error));
    });
  } finally {
    db.close();
  }
}
