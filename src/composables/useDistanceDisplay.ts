import { computed } from 'vue';
import { useImageMapStore } from '@/stores/imageMap';

// Persist geometry in kilometres; paper centimetres are a presentation unit.
export function useDistanceDisplay() {
  const images = useImageMapStore();
  const cmPerKm = computed(() => {
    const image = images.image;
    if (!images.active || !image?.paperDistanceCm) return null;
    const [a, b] = image.points;
    if (!a || !b) return null;
    const km = (Math.hypot(a[0] - b[0], a[1] - b[1]) * image.metersPerPixel) / 1000;
    const ratio = image.paperDistanceCm / km;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
  });
  const formatDistance = (km: number, digits = 3) => {
    const distance = `${km.toFixed(digits)} km`;
    return cmPerKm.value === null
      ? distance
      : `${distance} (≈ ${Number((km * cmPerKm.value).toPrecision(6))} cm)`;
  };
  const distanceLabel = (label: string) => {
    const units = cmPerKm.value === null ? 'km' : 'km / cm';
    return /\(km\)/.test(label) ? label.replace('(km)', `(${units})`) : `${label} (${units})`;
  };
  return { cmPerKm, formatDistance, distanceLabel };
}
