import { computed } from 'vue';
import { imageMapExtent } from '@/services/imageMap';
import { createProjectGeometry } from '@/services/projectGeometry';
import { useImageMapStore } from '@/stores/imageMap';
import { useProjectsStore } from '@/stores/projects';

export function useProjectGeometry() {
  const projects = useProjectsStore();
  const images = useImageMapStore();
  const imageMetersPerUnit = computed(() => {
    const image = images.image;
    if (!images.active || !image) return null;
    // Keep the saved placement, but measure in the image's calibrated plane.
    // A pixel has the same length everywhere, regardless of synthetic latitude.
    const extent = imageMapExtent(image, projects.activeProjection);
    return (image.metersPerPixel * image.width) / (extent[2] - extent[0]);
  });
  return createProjectGeometry(
    () => projects.activeProjection,
    () => imageMetersPerUnit.value
  );
}
