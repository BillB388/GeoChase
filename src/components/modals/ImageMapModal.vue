<template>
  <v-dialog fullscreen :model-value="true" persistent>
    <v-card class="image-map-dialog">
      <v-toolbar density="comfortable">
        <v-toolbar-title>{{
          creation ? t('project.imageCreationTitle') : t('imageMap.recalibrate')
        }}</v-toolbar-title>

        <v-btn
          :aria-label="t('common.close')"
          :disabled="saving"
          icon="mdi-close"
          @click="emit('close')"
        />
      </v-toolbar>

      <div v-if="creation || !initial" class="image-map-steps">
        <v-chip :color="url ? undefined : 'primary'">{{ t('imageMap.importStep') }}</v-chip>
        <v-icon icon="mdi-chevron-right" />
        <v-chip :color="url ? 'primary' : undefined">{{ t('imageMap.calibrateStep') }}</v-chip>
      </div>

      <v-alert
        v-if="error"
        class="image-map-error mx-6 mb-3"
        closable
        density="compact"
        type="error"
        @click:close="error = ''"
        >{{ error }}</v-alert
      >

      <div v-if="!url" class="image-map-import">
        <v-icon color="primary" icon="mdi-image-plus-outline" size="64" />
        <h1>{{ t('imageMap.importTitle') }}</h1>
        <p>{{ t('imageMap.fileHint') }}</p>

        <input
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          :aria-label="t('imageMap.importTitle')"
          :disabled="loading"
          type="file"
          @change="importFile"
        />

        <v-progress-linear v-if="loading" indeterminate />
      </div>

      <div v-else class="image-map-calibration">
        <aside class="image-map-settings">
          <v-btn
            v-if="creation || !initial"
            prepend-icon="mdi-image-edit-outline"
            variant="text"
            @click="resetFile"
            >{{ t('imageMap.changeFile') }}</v-btn
          >

          <h3>{{ t('imageMap.scale') }}</h3>

          <v-btn-toggle v-model="mode" color="primary" density="compact" divided mandatory>
            <v-btn value="points">{{ t('imageMap.byPoints') }}</v-btn>
            <v-btn value="ratio">{{ t('imageMap.byRatio') }}</v-btn>
          </v-btn-toggle>

          <p>{{ t(mode === 'points' ? 'imageMap.scaleHint' : 'imageMap.ratioHint') }}</p>

          <template v-if="mode === 'points'">
            <p aria-live="polite">{{ t('imageMap.pointCount', { count: points.length }) }}</p>

            <v-btn :disabled="points.length === 0" variant="text" @click="resetPoints">
              {{ t('imageMap.resetPoints') }}
            </v-btn>

            <v-text-field
              v-model.number="distance"
              hide-details
              :label="t('imageMap.distanceKm')"
              min="0"
              step="any"
              type="number"
            />

            <v-text-field
              v-model="paperDistanceCm"
              clearable
              :hint="t('imageMap.paperDistanceHint')"
              :label="t('imageMap.paperDistanceCm')"
              min="0"
              persistent-hint
              step="any"
              type="number"
            />
          </template>

          <template v-else>
            <v-text-field
              v-model="directRatio"
              hide-details
              :label="t('imageMap.ratioLabel')"
              min="0"
              step="any"
              type="number"
            />

            <v-text-field
              v-model="paperKmPerCm"
              clearable
              :hint="t('imageMap.paperScaleHint')"
              :label="t('imageMap.paperScaleLabel')"
              min="0"
              persistent-hint
              step="any"
              type="number"
            />
          </template>

          <div v-if="mode === 'ratio'" aria-live="polite" class="image-map-summary">
            <template v-if="Number.isFinite(effectiveRatio) && effectiveRatio > 0">
              <strong>{{ t('imageMap.ratioValue', { value: effectiveRatio.toFixed(4) }) }}</strong>

              <p v-if="effectiveKmPerCm > 0">
                {{ t('imageMap.paperScaleValue', { value: effectiveKmPerCm.toFixed(4) }) }}
              </p>
            </template>
          </div>
        </aside>

        <section class="image-map-preview">
          <div class="image-map-zoom">
            <span>{{
              t(
                mode === 'ratio'
                  ? 'imageMap.ratioPreview'
                  : points.length === 2
                    ? 'imageMap.adjustHint'
                    : 'imageMap.clickScale'
              )
            }}</span>

            <v-btn
              :aria-label="t('map.zoomOut')"
              :disabled="zoom <= 1"
              icon="mdi-minus"
              size="small"
              @click="zoom = Math.max(1, zoom - 0.5)"
            />

            <v-btn
              :aria-label="t('map.zoomIn')"
              icon="mdi-plus"
              size="small"
              @click="zoom += 0.5"
            />
          </div>

          <div
            ref="preview"
            :aria-label="t('imageMap.preview')"
            class="image-map-scroll"
            tabindex="0"
            @keydown="nudgePoint"
            @pointercancel="endPan"
            @pointerdown="startPan"
            @pointermove="pan"
            @pointerup="endPan"
            @wheel.prevent="wheelZoom"
          >
            <svg
              ref="previewSvg"
              :aria-label="t('imageMap.preview')"
              role="img"
              :style="{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }"
              :viewBox="`0 0 ${width} ${height}`"
              @click="placePoint"
            >
              <image :height="height" :href="url" :width="width" />

              <line
                v-if="mode === 'points' && points.length === 2"
                stroke="#ff9800"
                stroke-width="3"
                vector-effect="non-scaling-stroke"
                :x1="points[0]![0]"
                :x2="points[1]![0]"
                :y1="points[0]![1]"
                :y2="points[1]![1]"
              />

              <g
                v-for="(point, index) in points"
                v-show="mode === 'points'"
                :key="index"
                :data-point="index"
                :style="{ cursor: mode === 'points' ? 'pointer' : 'inherit' }"
              >
                <rect
                  fill="transparent"
                  :height="markerSize * 2"
                  :width="markerSize * 2"
                  :x="point[0] - markerSize"
                  :y="point[1] - markerSize"
                />

                <path
                  :d="`M ${point[0] - markerSize} ${point[1]} h ${markerSize * 2} M ${point[0]} ${point[1] - markerSize} v ${markerSize * 2}`"
                  stroke="#111827"
                  stroke-width="4"
                  vector-effect="non-scaling-stroke"
                />

                <path
                  :d="`M ${point[0] - markerSize} ${point[1]} h ${markerSize * 2} M ${point[0]} ${point[1] - markerSize} v ${markerSize * 2}`"
                  :stroke="selectedPoint === index ? '#ffffff' : '#ff9800'"
                  stroke-width="2"
                  vector-effect="non-scaling-stroke"
                />

                <text
                  dominant-baseline="central"
                  :fill="selectedPoint === index ? '#ffffff' : '#ff9800'"
                  :font-size="markerSize * 1.4"
                  paint-order="stroke"
                  stroke="#111827"
                  stroke-width="2"
                  text-anchor="middle"
                  vector-effect="non-scaling-stroke"
                  :x="point[0] + markerSize * 1.7"
                  :y="point[1] - markerSize * 1.7"
                >
                  {{ index + 1 }}
                </text>
              </g>
            </svg>
          </div>
        </section>
      </div>

      <v-card-actions class="image-map-actions">
        <v-btn :disabled="saving" @click="emit('close')">{{
          t(creation ? 'project.backToProject' : 'common.cancel')
        }}</v-btn>

        <v-spacer />

        <v-btn
          color="primary"
          :disabled="!valid || loading"
          :loading="saving"
          variant="flat"
          @click="apply"
          >{{ t(creation ? 'workspace.createProject' : 'common.save') }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type ImageMap, imageMapExtent } from '@/services/imageMap';
import { useImageMapStore } from '@/stores/imageMap';
import { useProjectsStore } from '@/stores/projects';

const props = defineProps<{ creation?: boolean; saveImage?: (image: ImageMap) => Promise<void> }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const store = useImageMapStore();
const projects = useProjectsStore();
const initial = props.creation ? null : store.image;
const url = ref(initial?.url ?? '');
const name = ref(initial?.name ?? '');
const width = ref(initial?.width ?? 0);
const height = ref(initial?.height ?? 0);
const points = ref<[number, number][]>(initial?.points.map((p) => [...p]) ?? []);
const distance = ref(
  initial
    ? (initial.metersPerPixel *
        Math.hypot(
          initial.points[0]![0] - initial.points[1]![0],
          initial.points[0]![1] - initial.points[1]![1]
        )) /
        1000
    : 0
);
const mode = ref<'points' | 'ratio'>(initial?.calibrationMode ?? 'points');
const selectedPoint = ref<number | null>(null);
const directRatio = ref<number | string>(initial?.metersPerPixel ?? '');
const paperKmPerCm = ref<number | string | null>(
  initial?.paperDistanceCm ? distance.value / initial.paperDistanceCm : ''
);
const paperDistanceCm = ref<number | string | null>(initial?.paperDistanceCm ?? '');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const zoom = ref(1);
const markerSize = computed(() => width.value / 75 / zoom.value);
const pixelDistance = computed(() =>
  points.value.length === 2
    ? Math.hypot(
        points.value[0]![0] - points.value[1]![0],
        points.value[0]![1] - points.value[1]![1]
      )
    : 0
);
const effectiveRatio = computed(() =>
  mode.value === 'ratio'
    ? Number(directRatio.value)
    : (Number(distance.value) * 1000) / pixelDistance.value
);
const effectiveKmPerCm = computed(() =>
  mode.value === 'ratio'
    ? Number(paperKmPerCm.value)
    : Number(paperDistanceCm.value) > 0
      ? Number(distance.value) / Number(paperDistanceCm.value)
      : 0
);
function optionalPositive(value: number | string | null) {
  return value === '' || value === null || (Number.isFinite(Number(value)) && Number(value) > 0);
}
const valid = computed(
  () =>
    !!url.value &&
    Number.isFinite(effectiveRatio.value) &&
    effectiveRatio.value > 0 &&
    (mode.value === 'ratio'
      ? optionalPositive(paperKmPerCm.value)
      : pixelDistance.value > 0 && optionalPositive(paperDistanceCm.value))
);
watch(mode, (next, previous) => {
  if (next === 'ratio') {
    const ratio = (Number(distance.value) * 1000) / pixelDistance.value;
    if (Number.isFinite(ratio) && ratio > 0) directRatio.value = ratio;
    paperKmPerCm.value =
      Number(paperDistanceCm.value) > 0
        ? Number(distance.value) / Number(paperDistanceCm.value)
        : '';
  } else if (previous === 'ratio') {
    if (pixelDistance.value > 0 && Number(directRatio.value) > 0)
      distance.value = (pixelDistance.value * Number(directRatio.value)) / 1000;
    paperDistanceCm.value =
      Number(paperKmPerCm.value) > 0 ? distance.value / Number(paperKmPerCm.value) : '';
    selectedPoint.value = null;
  }
});
let alive = true;
onUnmounted(() => {
  alive = false;
});
watch(
  () => projects.activeProjectId,
  () => emit('close')
);

function resetFile() {
  url.value = '';
  paperDistanceCm.value = '';
  paperKmPerCm.value = '';
  directRatio.value = '';
  distance.value = 0;
  selectedPoint.value = null;
  points.value = [];
  error.value = '';
  zoom.value = 1;
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  error.value = '';
  loading.value = true;
  try {
    if (!/^image\/(?:png|jpeg|webp|gif|bmp)$/.test(file.type) || file.size > 25 * 1024 * 1024)
      throw new Error('Invalid image file');
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result)));
      reader.addEventListener('error', () => reject(reader.error));
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.src = data;
    await image.decode();
    if (!alive) return;
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 100_000_000)
      throw new Error('Invalid image file');
    width.value = image.naturalWidth;
    height.value = image.naturalHeight;
    name.value = file.name;
    url.value = data;
    points.value = [];
  } catch {
    if (alive) error.value = t('imageMap.fileError');
  } finally {
    if (alive) loading.value = false;
  }
}
const preview = ref<HTMLElement | null>(null);
const previewSvg = ref<SVGSVGElement | null>(null);
let drag: { x: number; y: number; left: number; top: number; pointerId: number } | null = null;
let dragged = false;
function startPan(event: PointerEvent) {
  if (event.button !== 0 || !preview.value) return;
  dragged = false;
  preview.value.focus({ preventScroll: true });
  drag = {
    x: event.clientX,
    y: event.clientY,
    left: preview.value.scrollLeft,
    top: preview.value.scrollTop,
    pointerId: event.pointerId,
  };
}
function pan(event: PointerEvent) {
  if (!drag || !preview.value || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!dragged && Math.hypot(dx, dy) < 4) return;
  dragged = true;
  preview.value.setPointerCapture(event.pointerId);
  preview.value.scrollLeft = drag.left - dx;
  preview.value.scrollTop = drag.top - dy;
}
function endPan(event: PointerEvent) {
  if (preview.value?.hasPointerCapture(event.pointerId))
    preview.value.releasePointerCapture(event.pointerId);
  drag = null;
}
async function wheelZoom(event: WheelEvent) {
  const element = preview.value;
  if (!element) return;
  const before = zoom.value;
  const next = Math.max(
    1,
    before * Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.04 : 0.002))
  );
  if (!Number.isFinite(next)) return;
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const x = event.clientX - bounds.left - Number.parseFloat(style.paddingLeft);
  const y = event.clientY - bounds.top - Number.parseFloat(style.paddingTop);
  const left = ((element.scrollLeft + x) * next) / before - x;
  const top = ((element.scrollTop + y) * next) / before - y;
  zoom.value = next;
  await nextTick();
  element.scrollLeft = left;
  element.scrollTop = top;
}
function imagePoint(x: number, y: number): [number, number] | null {
  const matrix = previewSvg.value?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  if (point.x < 0 || point.y < 0 || point.x > width.value || point.y > height.value) return null;
  return [point.x, point.y];
}
function resetPoints() {
  points.value = [];
  selectedPoint.value = null;
}
function placePoint(event: MouseEvent) {
  if (dragged || mode.value !== 'points') return;
  const marker = (event.target as Element).closest<SVGGElement>('[data-point]');
  selectedPoint.value = marker && points.value.length === 2 ? Number(marker.dataset.point) : null;
  if (marker || points.value.length === 2) return;
  const pixel = imagePoint(event.clientX, event.clientY);
  if (pixel) points.value.push(pixel);
}
function nudgePoint(event: KeyboardEvent) {
  const index = selectedPoint.value;
  if (
    mode.value !== 'points' ||
    points.value.length !== 2 ||
    index === null ||
    !points.value[index]
  )
    return;
  const direction: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const delta = direction[event.key];
  if (!delta) return;
  event.preventDefault();
  const step = event.shiftKey ? 1 : 0.1;
  const point = points.value[index]!;
  points.value[index] = [
    Math.max(0, Math.min(width.value, point[0] + delta[0] * step)),
    Math.max(0, Math.min(height.value, point[1] + delta[1] * step)),
  ];
}
async function apply() {
  if (!valid.value) return;
  saving.value = true;
  error.value = '';
  try {
    const calibrationPoints: [number, number][] =
      pixelDistance.value > 0
        ? points.value.map((p) => [...p])
        : [
            [0, height.value / 2],
            [width.value, height.value / 2],
          ];
    const calibrationKm =
      (Math.hypot(
        calibrationPoints[1]![0] - calibrationPoints[0]![0],
        calibrationPoints[1]![1] - calibrationPoints[0]![1]
      ) *
        effectiveRatio.value) /
      1000;
    const image: ImageMap = {
      url: url.value,
      name: name.value,
      width: width.value,
      height: height.value,
      points: calibrationPoints,
      distance: calibrationKm,
      calibrationMode: mode.value,
      unit: 'km',
      paperDistanceCm:
        effectiveKmPerCm.value > 0 ? calibrationKm / effectiveKmPerCm.value : undefined,
      metersPerPixel: effectiveRatio.value,
      extent:
        url.value === initial?.url ? imageMapExtent(initial, projects.activeProjection) : undefined,
      // Preserve existing image placement when editing an older saved calibration.
      anchor: url.value === initial?.url ? initial.anchor : undefined,
    };
    const extent = imageMapExtent(image, projects.activeProjection);
    if (!extent.every((value) => Number.isFinite(value))) {
      error.value = t('imageMap.extentError');
      return;
    }
    await (props.saveImage ? props.saveImage(image) : store.apply(image));
    emit('close');
  } catch {
    error.value = t('imageMap.saveError');
  } finally {
    saving.value = false;
  }
}
</script>
<style scoped>
.image-map-dialog {
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
.image-map-error {
  flex: none;
}
.image-map-steps {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
}
.image-map-import {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  text-align: center;
}
.image-map-calibration {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
}
.image-map-settings {
  overflow: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.image-map-summary {
  padding: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 8px;
}
.image-map-summary p {
  margin-top: 8px;
}
.image-map-settings > * {
  flex: none;
}
.image-map-settings h2,
.image-map-settings h3,
.image-map-settings p {
  margin: 0;
}
.image-map-settings h2 {
  font-size: 18px;
  overflow-wrap: anywhere;
}
.image-map-settings p {
  font-size: 14px;
}
.image-map-preview {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.image-map-zoom {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  flex-wrap: wrap;
}
.image-map-zoom > span:first-child {
  flex: 1;
}
.image-map-scroll {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
.image-map-scroll svg {
  display: block;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}
.image-map-actions {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  padding: 12px 24px;
}
@media (max-width: 760px) {
  .image-map-calibration {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  .image-map-settings {
    overflow: visible;
  }
  .image-map-preview {
    flex: none;
    min-height: 360px;
  }
  .image-map-scroll {
    max-height: 65vh;
  }
}
</style>
