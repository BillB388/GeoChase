<template>
  <div
    v-if="!uiStore.gameMode"
    :aria-label="$t('workspace.mapNavigation')"
    class="map-controls"
    :class="{ 'map-controls-with-tools': uiStore.tools.isToolbarOpen }"
    role="group"
  >
    <v-btn :aria-label="$t('map.zoomIn')" icon="mdi-plus" variant="text" @click="zoomBy(1)" />
    <span class="map-controls-separator" />
    <v-btn :aria-label="$t('map.zoomOut')" icon="mdi-minus" variant="text" @click="zoomBy(-1)" />
  </div>
</template>
<script setup lang="ts">
import { useMapContext } from '@/composables/mapContext';
import { useUIStore } from '@/stores/ui';
const mapContainer = useMapContext();
const uiStore = useUIStore();
function zoomBy(delta: number) {
  const view = mapContainer?.map.value?.getView();
  if (!view) return;
  const zoom = Math.max(
    view.getMinZoom(),
    Math.min(view.getMaxZoom(), (view.getZoom() ?? 6) + delta)
  );
  view.animate({
    zoom,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
  });
}
</script>
<style scoped>
.map-controls {
  position: fixed;
  right: 16px;
  bottom: 76px;
  z-index: 1048;
  display: flex;
  flex-direction: column;
  width: 40px;
  padding: 0;
  background: var(--bg);
  border: 1px solid var(--gc-border);
  border-radius: 13px;
  box-shadow: 0 4px 20px #2037451a;
}
.map-controls .v-btn {
  width: 100%;
  height: 40px;
}
.map-controls-separator {
  height: 1px;
  margin: 0 8px;
  background: var(--gc-border);
}
.map-controls-with-tools {
  bottom: 144px;
}
@media (pointer: coarse) {
  .map-controls {
    width: 48px;
  }
  .map-controls .v-btn {
    height: 44px;
  }
}
</style>
