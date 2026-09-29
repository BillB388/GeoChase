<template>
  <div ref="layersPanel" class="layers-panel">
    <div class="project-heading">
      <h1>{{ projectsStore.activeProject?.name || $t('workspace.noProject') }}</h1>

      <p v-if="!projectsStore.activeProject">{{ $t('workspace.projectHint') }}</p>

      <v-btn
        v-if="!projectsStore.activeProject"
        block
        class="mt-3"
        color="primary"
        prepend-icon="mdi-plus"
        variant="flat"
        @click="uiStore.openModal('newProjectModal')"
        >{{ $t('project.newProject') }}</v-btn
      >
    </div>

    <div class="layers-heading">
      <h2 class="layers-panel-title">{{ $t('layers.title') }}</h2>

      <span class="element-count">{{ elementCount }}</span>
    </div>

    <!-- Search bar (only show when there are elements) -->
    <div v-if="!layersStore.isEmpty" class="mb-3">
      <v-text-field
        v-model="searchQuery"
        class="layers-search"
        clearable
        density="compact"
        hide-details
        :placeholder="$t('layers.filterPlaceholder')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
      />
    </div>

    <!-- Empty state -->
    <div v-if="layersStore.isEmpty" class="layers-empty">
      <svg aria-hidden="true" class="empty-map" fill="none" viewBox="0 0 280 170">
        <path
          d="M24 38 95 24 180 40 256 22V139L180 154 95 139 24 154Z"
          fill="#edf4f3"
          stroke="#cbdddd"
        />

        <path d="M95 24V139M180 40V154" stroke="#cbdddd" />

        <path
          d="M25 96C65 37 104 112 143 61S206 103 256 65M24 127C71 81 96 148 156 111S217 135 256 102"
          stroke="#d5e4dd"
          stroke-width="10"
        />

        <circle cx="158" cy="84" r="35" stroke="#7da9aa" stroke-dasharray="4 5" />

        <path
          d="m66 114 48-11 44-19 57-33"
          stroke="#176b70"
          stroke-dasharray="5 5"
          stroke-width="2"
        />

        <circle cx="66" cy="114" fill="#fff" r="5" stroke="#176b70" stroke-width="2" />

        <path
          d="M158 61a14 14 0 0 1 14 14c0 11-14 24-14 24s-14-13-14-24a14 14 0 0 1 14-14Z"
          fill="#176b70"
        />

        <circle cx="158" cy="75" fill="white" r="5" />
        <path d="m212 38 6 13-6 13-6-13Z" fill="#be892f" />
      </svg>

      <button class="empty-guide" type="button" @click="uiStore.setShowTutorial(true)">
        {{ $t('workspace.discover') }}<v-icon icon="mdi-arrow-right" size="17" />
      </button>
    </div>

    <!-- No results state -->
    <div
      v-else-if="
        filteredCircles.length === 0 &&
        filteredRoutes.length === 0 &&
        filteredLines.length === 0 &&
        filteredPoints.length === 0 &&
        filteredPolygons.length === 0 &&
        filteredNotes.length === 0
      "
      class="layers-empty"
    >
      <p>{{ $t('layers.noMatch', { query: searchQuery }) }}</p>
    </div>

    <!-- Layers list -->
    <div v-else class="layers-list">
      <!-- Circles -->
      <div v-if="filteredCircles.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="circlesExpanded"
            class="layers-section-title"
            type="button"
            @click="circlesExpanded = !circlesExpanded"
          >
            {{
              $t('layers.circlesSection', {
                count: filteredCircles.length,
                total: searchQuery ? layersStore.circleCount : null,
              })
            }}
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allCirclesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allCirclesVisible ? $t('layers.hideAllCircles') : $t('layers.showAllCircles')"
              variant="text"
              @click.stop="toggleAllElementsOfType('circle')"
            />

            <span aria-hidden="true" class="collapse-icon">{{ circlesExpanded ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-show="circlesExpanded" class="layer-items">
          <div
            v-for="circle in filteredCircles"
            :key="circle.id"
            class="layer-item"
            :class="{
              ...dropClasses('circle', circle.id),
              'layer-item-hidden': circle.id && !uiStore.isElementVisible('circle', circle.id),
            }"
            :data-layer-id="circle.id"
            data-layer-type="circle"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'circle', circle.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('circle', circle)"
              @keydown.enter="handleGoTo('circle', circle)"
              @keydown.space.prevent="handleGoTo('circle', circle)"
            >
              <div class="layer-item-name">{{ circle.name }}</div>
              <div class="layer-item-type">{{ circle.radius }}km radius</div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="circle.id"
                :element-id="circle.id"
                element-type="circle"
                @delete="handleDeleteElement"
                @edit="handleEditCircle(circle)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Line segments -->
      <div v-if="filteredLines.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="linesExpanded"
            class="layers-section-title"
            type="button"
            @click="linesExpanded = !linesExpanded"
          >
            {{ $t('layers.lines') }} ({{ filteredLines.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.lineSegmentCount}` : '' }})
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allLinesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allLinesVisible ? 'Hide all lines' : 'Show all lines'"
              variant="text"
              @click.stop="toggleAllElementsOfType('lineSegment')"
            />

            <span aria-hidden="true" class="collapse-icon">{{ linesExpanded ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-show="linesExpanded" class="layer-items">
          <div
            v-for="line in filteredLines"
            :key="line.id"
            class="layer-item"
            :class="{
              ...dropClasses('lineSegment', line.id),
              'layer-item-hidden': line.id && !uiStore.isElementVisible('lineSegment', line.id),
            }"
            :data-layer-id="line.id"
            data-layer-type="lineSegment"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'lineSegment', line.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('lineSegment', line)"
              @keydown.enter="handleGoTo('lineSegment', line)"
              @keydown.space.prevent="handleGoTo('lineSegment', line)"
            >
              <div class="layer-item-name">{{ line.name }}</div>

              <div class="layer-item-type">
                {{ $t('layers.lineSegmentType') }} • {{ getLineInfo(line) }}
              </div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="line.id"
                :element-id="line.id"
                element-type="lineSegment"
                @delete="handleDeleteElement"
                @edit="handleEditLineSegment(line)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredRoutes.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="routesExpanded"
            class="layers-section-title"
            type="button"
            @click="routesExpanded = !routesExpanded"
          >
            {{ $t('route.plural') }} ({{ filteredRoutes.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.routeCount}` : '' }})
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allRoutesVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allRoutesVisible ? $t('route.hideAll') : $t('route.showAll')"
              variant="text"
              @click.stop="toggleAllElementsOfType('route')"
            />

            <span aria-hidden="true" class="collapse-icon">{{ routesExpanded ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-show="routesExpanded" class="layer-items">
          <div
            v-for="route in filteredRoutes"
            :key="route.id"
            class="layer-item"
            :class="{
              ...dropClasses('route', route.id),
              'layer-item-hidden': route.id && !uiStore.isElementVisible('route', route.id),
            }"
            :data-layer-id="route.id"
            data-layer-type="route"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'route', route.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @click="handleGoTo('route', route)"
              @keydown.enter="handleGoTo('route', route)"
              @keydown.space.prevent="handleGoTo('route', route)"
            >
              <div class="layer-item-name">{{ route.name }}</div>

              <div class="layer-item-type">{{ $t('route.title') }} • {{ getRouteInfo(route) }}</div>
            </div>

            <div class="layer-item-actions">
              <LayerContextMenu
                v-if="route.id"
                :element-id="route.id"
                element-type="route"
                @delete="handleDeleteElement"
                @edit="handleEditRoute(route)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Points -->
      <div v-if="filteredPoints.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="pointsExpanded"
            class="layers-section-title"
            type="button"
            @click="pointsExpanded = !pointsExpanded"
          >
            {{ $t('layers.points') }} ({{ filteredPoints.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.pointCount}` : '' }})
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPointsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPointsVisible ? 'Hide all points' : 'Show all points'"
              variant="text"
              @click.stop="toggleAllElementsOfType('point')"
            />

            <span aria-hidden="true" class="collapse-icon">{{ pointsExpanded ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-show="pointsExpanded" class="layer-items">
          <div
            v-for="point in filteredPoints"
            :key="point.id"
            class="layer-item"
            :class="{
              ...dropClasses('point', point.id),
              'layer-item-hidden': point.id && !uiStore.isElementVisible('point', point.id),
            }"
            :data-layer-id="point.id"
            data-layer-type="point"
            @click="handlePointClick(point)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'point', point.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @keydown.enter="handlePointClick(point)"
              @keydown.space.prevent="handlePointClick(point)"
            >
              <div class="layer-item-name">{{ point.name }}</div>
              <div class="layer-item-type">{{ $t('layers.pointType') }}</div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="point.id"
                :element-id="point.id"
                element-type="point"
                @delete="handleDeleteElement"
                @edit="handleEditPoint(point)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Polygons -->
      <div v-if="filteredPolygons.length > 0">
        <div class="layers-section-header">
          <button
            :aria-expanded="polygonsExpanded"
            class="layers-section-title"
            type="button"
            @click="polygonsExpanded = !polygonsExpanded"
          >
            {{ $t('layers.polygons') }} ({{ filteredPolygons.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.polygonCount}` : '' }})
          </button>

          <div class="layers-section-actions">
            <v-btn
              color="primary"
              :icon="allPolygonsVisible ? 'mdi-eye-off' : 'mdi-eye'"
              size="x-small"
              :title="allPolygonsVisible ? 'Hide all polygons' : 'Show all polygons'"
              variant="text"
              @click.stop="toggleAllElementsOfType('polygon')"
            />

            <span aria-hidden="true" class="collapse-icon">{{ polygonsExpanded ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-show="polygonsExpanded" class="layer-items">
          <div
            v-for="polygon in filteredPolygons"
            :key="polygon.id"
            class="layer-item"
            :class="{
              ...dropClasses('polygon', polygon.id),
              'layer-item-hidden': polygon.id && !uiStore.isElementVisible('polygon', polygon.id),
            }"
            :data-layer-id="polygon.id"
            data-layer-type="polygon"
            @click="handlePolygonClick(polygon)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'polygon', polygon.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div
              class="layer-item-info"
              role="button"
              tabindex="0"
              @keydown.enter="handlePolygonClick(polygon)"
              @keydown.space.prevent="handlePolygonClick(polygon)"
            >
              <div class="layer-item-name">{{ polygon.name }}</div>

              <div class="layer-item-type">
                {{ $t('layers.polygonType') }} ({{ polygon.pointIds.length }}
                {{ $t('common.points') }}) •
                {{ formatDistance(calculatePolygonPerimeter(polygon)) }} •
                {{ formatPolygonArea(polygon) }}
              </div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <LayerContextMenu
                v-if="polygon.id"
                :element-id="polygon.id"
                element-type="polygon"
                @delete="handleDeleteElement"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="filteredNotes.length > 0">
        <button
          :aria-expanded="notesExpanded"
          class="layers-section-header notes-section-toggle"
          type="button"
          @click="notesExpanded = !notesExpanded"
        >
          <span class="layers-section-title"
            >{{ $t('layers.notes') }} ({{ filteredNotes.length
            }}{{ searchQuery ? ` ${$t('common.of')} ${layersStore.noteCount}` : '' }})</span
          >

          <span class="collapse-icon">{{ notesExpanded ? '▼' : '▶' }}</span>
        </button>

        <div v-show="notesExpanded" class="layer-items">
          <div
            v-for="note in filteredNotes"
            :key="note.id"
            class="layer-item"
            :class="dropClasses('note', note.id)"
            :data-layer-id="note.id"
            data-layer-type="note"
            @click="handleNoteClick(note)"
            @dragstart.prevent
            @lostpointercapture="cancelElementDrag"
            @pointercancel="cancelElementDrag"
            @pointerdown="startElementDrag($event, 'note', note.id)"
            @pointermove="moveElementDrag"
            @pointerup="finishElementDrag"
          >
            <div class="layer-item-info">
              <div class="layer-item-name">{{ note.title }}</div>

              <div class="layer-item-type">
                {{
                  note.linkedElementType
                    ? `${$t('layers.linkedTo')} ${note.linkedElementType}`
                    : $t('layers.standaloneNote')
                }}
              </div>
            </div>

            <div class="layer-item-actions" @click.stop>
              <v-menu location="bottom">
                <template #activator="{ props }">
                  <v-btn
                    data-testid="note-context-menu-btn"
                    icon="mdi-dots-vertical"
                    size="x-small"
                    variant="text"
                    v-bind="props"
                  />
                </template>

                <v-list density="compact">
                  <v-list-item @click="handleEditNote(note)">
                    <template #prepend>
                      <v-icon icon="mdi-pencil" size="small" />
                    </template>

                    <v-list-item-title>{{ $t('common.edit') }}</v-list-item-title>
                  </v-list-item>

                  <v-list-item class="text-error" @click="handleDeleteNote(note)">
                    <template #prepend>
                      <v-icon color="error" icon="mdi-delete" size="small" />
                    </template>

                    <v-list-item-title>{{ $t('common.delete') }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="dragPreview"
      aria-hidden="true"
      class="layer-drag-preview"
      data-testid="layer-drag-preview"
      :style="{
        transform: `translate3d(${dragPreview.x}px, ${dragPreview.y}px, 0)`,
        width: `${dragPreview.width}px`,
        minHeight: `${dragPreview.height}px`,
      }"
    >
      <div class="layer-item-info">
        <div class="layer-item-name">{{ dragPreview.name }}</div>
        <div class="layer-item-type">{{ dragPreview.detail }}</div>
      </div>

      <v-icon icon="mdi-drag" size="small" />
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import type {
  CircleElement,
  DrawingElement,
  LineSegmentElement,
  NoteElement,
  PointElement,
  PolygonElement,
  RouteElement,
} from '@/types/project';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import LayerContextMenu from '@/components/layers/LayerContextMenu.vue';
import { useDrawingContext, useMapContext } from '@/composables/mapContext';
import { useProjectGeometry } from '@/composables/useProjectGeometry';
import { routeBounds } from '@/services/routing';
import { useLayersStore } from '@/stores/layers';
import { useProjectsStore } from '@/stores/projects';
import { useUIStore } from '@/stores/ui';

const { t } = useI18n();
const { getDistance, calculateBearing, polygonArea } = useProjectGeometry();

const layersStore = useLayersStore();
const uiStore = useUIStore();
const projectsStore = useProjectsStore();
const elementCount = computed(
  () =>
    layersStore.circles.length +
    layersStore.routes.length +
    layersStore.lineSegments.length +
    layersStore.points.length +
    layersStore.polygons.length +
    layersStore.notes.length
);
const drawing = useDrawingContext();
const mapContainer = useMapContext();

const searchQuery = ref('');
type ListElementType = 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon' | 'note';
const draggedElement = ref<{ type: ListElementType; id: string } | null>(null);
const dropTarget = ref<{
  type: ListElementType;
  id: string;
  position: 'before' | 'after' | 'link';
} | null>(null);
const isDragging = ref(false);
const dragPreview = ref<{
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  detail: string;
} | null>(null);
let pendingDrag: {
  pointerId: number;
  x: number;
  y: number;
  type: ListElementType;
  id: string;
  handle: HTMLElement;
  bounds: DOMRect;
} | null = null;
let suppressClickUntil = 0;
let autoScrollInterval: ReturnType<typeof setInterval> | null = null;

// Filtered lists based on search query (using sorted arrays)
const filteredCircles = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedCircles;
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedCircles.filter((c) => c.name.toLowerCase().includes(query));
});

const filteredRoutes = computed(() =>
  layersStore.sortedRoutes.filter((route) =>
    route.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);
const routesExpanded = ref(true);
const allRoutesVisible = computed(() =>
  layersStore.routes.every((route) => uiStore.isElementVisible('route', route.id))
);
function getRouteInfo(route: RouteElement) {
  return `${t(route.profile === 'car' ? 'route.car' : 'route.pedestrian')} • ${(route.distance / 1000).toFixed(2)} km • ${Math.ceil(route.duration / 60)} min • IGN`;
}
function handleEditRoute(route: RouteElement) {
  uiStore.startEditing('route', route.id);
  uiStore.openModal('routeModal');
}

const filteredLines = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedLineSegments;
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedLineSegments.filter((l) => l.name.toLowerCase().includes(query));
});

const filteredPoints = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedPoints;
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPoints.filter((p) => p.name.toLowerCase().includes(query));
});

const filteredPolygons = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedPolygons;
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedPolygons.filter((p) => p.name.toLowerCase().includes(query));
});

const filteredNotes = computed(() => {
  if (!searchQuery.value) {
    return layersStore.sortedNotes;
  }
  const query = searchQuery.value.toLowerCase();
  return layersStore.sortedNotes.filter(
    (n) => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)
  );
});

// Calculate polygon perimeter in kilometers
function calculatePolygonPerimeter(polygon: PolygonElement): number {
  if (!polygon.pointIds || polygon.pointIds.length < 3) {
    return 0;
  }

  // Resolve point IDs to coordinates
  const points = polygon.pointIds
    .map((pointId) => layersStore.points.find((p) => p.id === pointId)?.coordinates)
    .filter((p): p is { lat: number; lon: number } => p !== undefined);

  if (points.length < 3) {
    return 0;
  }

  let perimeter = 0;

  // Calculate distance between consecutive points
  for (let i = 0; i < points.length; i++) {
    const currentPoint = points[i];
    const nextPoint = points[(i + 1) % points.length]; // Wrap around to first point

    if (currentPoint && nextPoint) {
      // getDistance returns meters, so convert to km
      const distance =
        getDistance([currentPoint.lon, currentPoint.lat], [nextPoint.lon, nextPoint.lat]) / 1000;
      perimeter += distance;
    }
  }

  return perimeter;
}

function formatPolygonArea(polygon: PolygonElement): string {
  const points = polygon.pointIds.flatMap((id) => {
    const point = layersStore.points.find((point) => point.id === id);
    return point ? [point.coordinates] : [];
  });
  const area = polygonArea(points);
  return area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km²` : `${Math.round(area)} m²`;
}

// Format distance for display
function formatDistance(km: number): string {
  if (km >= 1) {
    return `${km.toFixed(2)} km`;
  }
  return `${(km * 1000).toFixed(0)} m`;
}

// Collapse states for each section
const circlesExpanded = ref(true);
const linesExpanded = ref(true);
const pointsExpanded = ref(true);
const polygonsExpanded = ref(true);
const notesExpanded = ref(true);
const layersPanel = ref<HTMLElement | null>(null);
let revealAnimation: Animation | undefined;

watch(
  () => uiStore.sidebarElementRequest,
  async (request, _previous, onCleanup) => {
    if (!request) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      revealAnimation?.cancel();
    });
    const sections = {
      circle: { expanded: circlesExpanded, items: filteredCircles },
      lineSegment: { expanded: linesExpanded, items: filteredLines },
      route: { expanded: routesExpanded, items: filteredRoutes },
      point: { expanded: pointsExpanded, items: filteredPoints },
      polygon: { expanded: polygonsExpanded, items: filteredPolygons },
    };
    const section = sections[request.elementType];
    if (!section.items.value.some((item) => item.id === request.elementId)) {
      searchQuery.value = '';
    }
    section.expanded.value = true;
    await nextTick();
    if (cancelled) return;
    const row = Array.from(
      layersPanel.value?.querySelectorAll<HTMLElement>('.layer-item') ?? []
    ).find(
      (item) =>
        item.dataset.layerType === request.elementType && item.dataset.layerId === request.elementId
    );
    if (!row) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
    const highlight = 'rgba(var(--v-theme-primary), 0.3)';
    revealAnimation = row.animate(
      reducedMotion
        ? [{ backgroundColor: highlight }, { backgroundColor: highlight }]
        : [
            { backgroundColor: 'transparent' },
            { backgroundColor: highlight, offset: 0.5 },
            { backgroundColor: 'transparent' },
          ],
      { duration: reducedMotion ? 1800 : 700, iterations: reducedMotion ? 1 : 3 }
    );
  }
);

// Check if all elements of a type are visible
const allCirclesVisible = computed(() => {
  return layersStore.circles.every((c) => c.id && uiStore.isElementVisible('circle', c.id));
});

const allLinesVisible = computed(() => {
  return layersStore.lineSegments.every(
    (l) => l.id && uiStore.isElementVisible('lineSegment', l.id)
  );
});

const allPointsVisible = computed(() => {
  return layersStore.points.every((p) => p.id && uiStore.isElementVisible('point', p.id));
});

const allPolygonsVisible = computed(() => {
  return layersStore.polygons.every((p) => p.id && uiStore.isElementVisible('polygon', p.id));
});

function getLineInfo(line: LineSegmentElement) {
  // Special handling for parallel mode
  if (line.mode === 'parallel') {
    return `parallel • ${line.longitude}°`;
  }

  if (!line.endpoint) {
    return `${line.mode} • (incomplete)`;
  }

  const segmentLength =
    getDistance([line.center.lon, line.center.lat], [line.endpoint.lon, line.endpoint.lat]) / 1000;
  const azimuth = calculateBearing(
    line.center.lat,
    line.center.lon,
    line.endpoint.lat,
    line.endpoint.lon
  );
  const inverseAzimuth = calculateBearing(
    line.endpoint.lat,
    line.endpoint.lon,
    line.center.lat,
    line.center.lon
  );
  const modeLabel =
    line.mode === 'coordinate'
      ? 'coordinate'
      : line.mode === 'azimuth'
        ? 'azimuth'
        : 'intersection';

  return `${modeLabel} • ${azimuth.toFixed(2)}° / ${inverseAzimuth.toFixed(2)}° • ${segmentLength.toFixed(2)} km`;
}

function handleEditCircle(circle: CircleElement) {
  if (circle.id) {
    uiStore.startEditing('circle', circle.id);
    uiStore.openModal('circleModal');
  }
}

function handleEditLineSegment(line: LineSegmentElement) {
  if (line.id) {
    uiStore.startEditing('lineSegment', line.id);
    // Open the appropriate modal based on line mode
    switch (line.mode) {
      case 'coordinate': {
        uiStore.openModal('twoPointsLineModal');
        break;
      }
      case 'azimuth': {
        uiStore.openModal('azimuthLineModal');
        break;
      }
      case 'intersection': {
        uiStore.openModal('intersectionLineModal');
        break;
      }
      case 'parallel': {
        uiStore.openModal('parallelLineModal');
        break;
      }
      default: {
        uiStore.addToast('Cannot edit this line type', 'error');
      }
    }
  }
}

function handleEditPoint(point: PointElement) {
  if (point.id) {
    uiStore.startEditing('point', point.id);
    uiStore.openModal('pointModal');
  }
}

function handleDeleteElement(elementType: string, elementId: string) {
  // Use the drawing composable to delete from both map and store
  drawing.deleteElement(elementType, elementId);
}

function handleGoTo(elementType: string, element: DrawingElement) {
  if (isDragging.value || Date.now() < suppressClickUntil) return;
  let lat: number;
  let lon: number;
  let zoom: number;

  switch (elementType) {
    case 'circle': {
      const circle = element as CircleElement;
      lat = circle.center.lat;
      lon = circle.center.lon;
      // Calculate zoom based on radius: more zoomed in formula
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(circle.radius / 1.5)));

      break;
    }
    case 'route': {
      mapContainer.flyToBoundsWithPanels(routeBounds(element as RouteElement));
      return;
    }
    case 'lineSegment': {
      const segment = element as LineSegmentElement;
      if (segment.mode === 'parallel') {
        // For parallel, center on the parallel's latitude
        lat = segment.longitude === undefined ? 0 : segment.longitude;
        lon = 0;
        zoom = 3;
      } else if (segment.endpoint) {
        // Center on segment midpoint
        lat = (segment.center.lat + segment.endpoint.lat) / 2;
        lon = (segment.center.lon + segment.endpoint.lon) / 2;

        // Calculate zoom based on line length: more zoomed in formula (getDistance returns meters, convert to km)
        const length =
          getDistance(
            [segment.center.lon, segment.center.lat],
            [segment.endpoint.lon, segment.endpoint.lat]
          ) / 1000;
        zoom = Math.max(6, Math.min(18, 15 - Math.log2(length / 1.5)));
      } else {
        // Fallback to segment start
        lat = segment.center.lat;
        lon = segment.center.lon;
        zoom = 13;
      }

      break;
    }
    case 'polygon': {
      const polygon = element as PolygonElement;
      // Calculate center of polygon by resolving point IDs to coordinates
      const points = polygon.pointIds
        .map((pointId) => layersStore.points.find((p) => p.id === pointId)?.coordinates)
        .filter((p): p is { lat: number; lon: number } => p !== undefined);

      if (points.length === 0) {
        console.warn('No valid points found for polygon');
        return;
      }

      const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
      const sumLon = points.reduce((sum, p) => sum + p.lon, 0);
      lat = sumLat / points.length;
      lon = sumLon / points.length;

      // Calculate bounds to determine zoom
      const lats = points.map((p) => p.lat);
      const lons = points.map((p) => p.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      // Calculate diagonal distance of bounding box (getDistance returns meters, convert to km)
      const diagonal = getDistance([minLon, minLat], [maxLon, maxLat]) / 1000;
      zoom = Math.max(6, Math.min(18, 15 - Math.log2(diagonal / 1.5)));

      break;
    }
    default: {
      const point = element as PointElement;
      lat = point.coordinates.lat;
      lon = point.coordinates.lon;
      zoom = 16; // Closer zoom for points
    }
  }

  mapContainer.setCenter(lat, lon, zoom);
}

function startElementDrag(event: PointerEvent, type: ListElementType, id: string) {
  if (
    event.button !== 0 ||
    pendingDrag ||
    (event.target as HTMLElement).closest('.layer-item-actions')
  )
    return;
  pendingDrag = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    type,
    id,
    handle: event.currentTarget as HTMLElement,
    bounds: (event.currentTarget as HTMLElement).getBoundingClientRect(),
  };
  document.addEventListener('keydown', cancelDragOnEscape);
  document.addEventListener('pointerup', cancelElementDrag);
  document.addEventListener('pointercancel', cancelElementDrag);
}

function moveElementDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return;
  if (!isDragging.value) {
    if (Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 5) return;
    isDragging.value = true;
    draggedElement.value = { type: pendingDrag.type, id: pendingDrag.id };
    pendingDrag.handle.setPointerCapture(event.pointerId);
    const { handle, bounds } = pendingDrag;
    dragPreview.value = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      name: handle.querySelector('.layer-item-name')?.textContent || '',
      detail: handle.querySelector('.layer-item-type')?.textContent || '',
    };
    document.documentElement.classList.add('dragging-layer');
  }
  event.preventDefault();
  if (dragPreview.value) {
    dragPreview.value.x = pendingDrag.bounds.x + event.clientX - pendingDrag.x;
    dragPreview.value.y = pendingDrag.bounds.y + event.clientY - pendingDrag.y;
  }
  updateDropTarget(event);
}

function finishElementDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return;
  if (isDragging.value) {
    updateDropTarget(event);
    applyElementDrop();
  }
  cancelElementDrag();
}

function cancelDragOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') cancelElementDrag();
}

function cancelElementDrag() {
  stopAutoScroll();
  if (isDragging.value) suppressClickUntil = Date.now() + 100;
  const pending = pendingDrag;
  pendingDrag = null;
  isDragging.value = false;
  dragPreview.value = null;
  document.documentElement.classList.remove('dragging-layer');
  draggedElement.value = null;
  dropTarget.value = null;
  document.removeEventListener('keydown', cancelDragOnEscape);
  document.removeEventListener('pointerup', cancelElementDrag);
  document.removeEventListener('pointercancel', cancelElementDrag);
  if (pending?.handle.hasPointerCapture(pending.pointerId))
    pending.handle.releasePointerCapture(pending.pointerId);
}

function dropClasses(type: ListElementType, id: string) {
  const position =
    dropTarget.value?.type === type && dropTarget.value.id === id
      ? dropTarget.value.position
      : null;
  return {
    'layer-item-dragging': draggedElement.value?.type === type && draggedElement.value.id === id,
    'drag-over': position === 'link',
    'drop-before': position === 'before',
    'drop-after': position === 'after',
  };
}

function handlePointClick(point: PointElement) {
  if (!isDragging.value && Date.now() >= suppressClickUntil) {
    handleGoTo('point', point);
  }
}

function handlePolygonClick(polygon: PolygonElement) {
  if (Date.now() < suppressClickUntil) return;
  handleGoTo('polygon', polygon);
}

function updateDropTarget(event: PointerEvent) {
  dropTarget.value = null;
  stopAutoScroll();
  const source = draggedElement.value;
  if (!source || !pendingDrag) return;
  const panel = pendingDrag.handle.closest('.v-navigation-drawer');
  const bounds = panel?.getBoundingClientRect();
  if (
    !bounds ||
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    return;
  const items = Array.from(
    pendingDrag.handle.parentElement?.querySelectorAll<HTMLElement>('.layer-item') ?? []
  );
  const hitRow = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('.layer-item');
  // Include the sidebar padding so users need not aim inside the row's border.
  const row =
    hitRow ??
    items.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY < rect.bottom;
    });
  const type = row?.dataset.layerType as ListElementType | undefined;
  const id = row?.dataset.layerId;
  if (row && type === source.type && id) {
    handleAutoScroll(event, row);
    if (source.id === id) return;
    const rect = row.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    // Give reordering broad edges while retaining a central point-link target.
    // Cap the edges so wrapped point names remain available for linking.
    const edgeSize = Math.min(20, rect.height / 3);
    const position =
      type === 'point' && hitRow && offset >= edgeSize && offset <= rect.height - edgeSize
        ? 'link'
        : offset < rect.height / 2
          ? 'before'
          : 'after';
    dropTarget.value = { type, id, position };
    return;
  }

  // Extend the category's insertion targets into the sidebar's empty space
  // and headers, while keeping drops on the map cancelled.
  const first = items?.[0];
  const last = items?.at(-1);
  if (!first || !last) return;
  handleAutoScroll(event, pendingDrag.handle);
  const edge =
    event.clientY < first.getBoundingClientRect().top
      ? { row: first, position: 'before' as const }
      : event.clientY >= last.getBoundingClientRect().bottom
        ? { row: last, position: 'after' as const }
        : null;
  const targetId = edge?.row.dataset.layerId;
  if (edge && targetId && targetId !== source.id) {
    dropTarget.value = { type: source.type, id: targetId, position: edge.position };
  }
}

function applyElementDrop() {
  const source = draggedElement.value;
  const target = dropTarget.value;
  if (source && target) {
    if (target.position === 'link') {
      const start = layersStore.points.find((point) => point.id === source.id);
      const end = layersStore.points.find((point) => point.id === target.id);
      if (start && end) createLineBetweenPoints(start, end);
    } else {
      layersStore.reorderElement(target.type, source.id, target.id, target.position);
    }
  }
}

function handleAutoScroll(event: PointerEvent, target: HTMLElement) {
  const scrollContainer = target.closest('.layers-list') as HTMLElement;

  if (!scrollContainer) {
    return;
  }

  // Get scroll container bounds
  const rect = scrollContainer.getBoundingClientRect();
  const scrollThreshold = 60; // pixels from edge to trigger scroll
  const scrollSpeed = 8; // pixels per interval

  // Calculate distance from edges
  const distanceFromTop = event.clientY - rect.top;
  const distanceFromBottom = rect.bottom - event.clientY;

  // Clear existing interval
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }

  // Scroll up if near top
  if (distanceFromTop < scrollThreshold && distanceFromTop > 0) {
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop -= scrollSpeed;
    }, 16); // ~60fps
  }
  // Scroll down if near bottom
  else if (distanceFromBottom < scrollThreshold && distanceFromBottom > 0) {
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop += scrollSpeed;
    }, 16); // ~60fps
  }
}

function createLineBetweenPoints(startPoint: PointElement, targetPoint: PointElement) {
  // getDistance returns meters, convert to km
  const distance =
    getDistance(
      [startPoint.coordinates.lon, startPoint.coordinates.lat],
      [targetPoint.coordinates.lon, targetPoint.coordinates.lat]
    ) / 1000;
  const azimuth = calculateBearing(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon
  );
  const inverseAzimuth = calculateBearing(
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon,
    startPoint.coordinates.lat,
    startPoint.coordinates.lon
  );
  const lineName = `${startPoint.name} → ${targetPoint.name}`;

  drawing.drawLineSegment(
    startPoint.coordinates.lat,
    startPoint.coordinates.lon,
    targetPoint.coordinates.lat,
    targetPoint.coordinates.lon,
    lineName,
    'coordinate',
    distance,
    undefined,
    undefined,
    undefined,
    undefined
  );

  uiStore.addToast(
    `Line created: ${lineName} (${distance.toFixed(2)}km • ${azimuth.toFixed(1)}°/${inverseAzimuth.toFixed(1)}°)`,
    'success'
  );
}

function handleNoteClick(note: NoteElement) {
  if (Date.now() < suppressClickUntil) return;
  // If note is linked to an element, navigate to it
  if (note.linkedElementType && note.linkedElementId) {
    let element;
    const elementType = note.linkedElementType;

    switch (note.linkedElementType) {
      case 'circle': {
        element = layersStore.circles.find((c) => c.id === note.linkedElementId);
        break;
      }
      case 'route': {
        element = layersStore.routes.find((route) => route.id === note.linkedElementId);
        break;
      }
      case 'lineSegment': {
        element = layersStore.lineSegments.find((l) => l.id === note.linkedElementId);
        break;
      }
      case 'point': {
        element = layersStore.points.find((p) => p.id === note.linkedElementId);
        break;
      }
    }

    if (element) {
      handleGoTo(elementType, element);
    }
  }
}

function handleEditNote(note: NoteElement) {
  if (note.id) {
    uiStore.startEditing('note', note.id);
    uiStore.openModal('noteModal');
  }
}

function handleDeleteNote(note: NoteElement) {
  if (note.id && confirm(`Are you sure you want to delete the note "${note.title}"?`)) {
    layersStore.deleteNote(note.id);
    uiStore.addToast('Note deleted successfully!', 'success');
  }
}

function toggleAllElementsOfType(
  elementType: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon'
) {
  let elements: DrawingElement[];
  let typeName: string;
  let allVisible: boolean;

  switch (elementType) {
    case 'circle': {
      elements = layersStore.circles;
      typeName = 'circles';
      allVisible = allCirclesVisible.value;
      break;
    }
    case 'route': {
      elements = layersStore.routes;
      typeName = 'routes';
      allVisible = allRoutesVisible.value;
      break;
    }
    case 'lineSegment': {
      elements = layersStore.lineSegments;
      typeName = 'lines';
      allVisible = allLinesVisible.value;
      break;
    }
    case 'point': {
      elements = layersStore.points;
      typeName = 'points';
      allVisible = allPointsVisible.value;
      break;
    }
    case 'polygon': {
      elements = layersStore.polygons;
      typeName = 'polygons';
      allVisible = allPolygonsVisible.value;
      break;
    }
  }

  // Toggle visibility: if all are visible, hide all; otherwise show all
  const newVisibility = !allVisible;

  for (const element of elements) {
    if (element.id) {
      uiStore.setElementVisibility(elementType, element.id, newVisibility);
      if (drawing) {
        drawing.updateElementVisibility(elementType, element.id, newVisibility);
      }
    }
  }

  const action = newVisibility ? 'shown' : 'hidden';
  uiStore.addToast(`All ${typeName} ${action}`, 'info');
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
}

onBeforeUnmount(cancelElementDrag);
</script>

<style scoped>
.layers-panel {
  background: rgb(var(--v-theme-surface));
  border: none;
  border-radius: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-heading {
  flex-shrink: 0;
  padding: 20px 22px;
  border-bottom: 1px solid var(--gc-border);
}
.project-heading h1 {
  font-size: 23px;
  line-height: 1.3;
  letter-spacing: -0.6px;
  margin: 0;
  overflow-wrap: anywhere;
}
.project-heading p {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 11px;
  color: var(--gc-muted);
  line-height: 1.6;
}
.layers-heading {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 15px 18px 12px 22px;
  gap: 8px;
}
.layers-panel-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.element-count {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--gc-subtle);
  color: var(--gc-muted);
}
.layers-empty {
  padding: 12px 24px 32px;
  text-align: left;
  color: var(--gc-muted);
  font-size: 13px;
  line-height: 1.7;
  overflow-y: auto;
}
.empty-map {
  width: 100%;
  max-width: 280px;
  display: block;
  margin: 8px auto 22px;
}
.layers-empty p {
  margin-bottom: 22px;
}
.empty-guide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding: 14px 8px;
  color: var(--accent);
  font-weight: 500;
}
.mb-3 {
  padding: 0 16px 8px 16px;
  flex-shrink: 0;
  background: rgb(var(--v-theme-surface));
  z-index: 1;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.layers-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--gc-subtle);
  user-select: none;
  transition: background 0.2s ease;
  border-radius: 4px;
  margin-bottom: 4px;
}

.notes-section-toggle {
  width: 100%;
  text-align: left;
}

.layers-section-header:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.layers-section-title {
  text-align: left;
  min-height: 32px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.9);
  margin: 0;
  cursor: pointer;
  flex: 1;
}

.layers-section-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapse-icon {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: transform 0.2s ease;
  cursor: pointer;
  padding: 4px;
}

.layer-items {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.layer-item {
  position: relative;
  cursor: grab;
  user-select: none;
  padding: 14px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.drop-before::before,
.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.16);
  pointer-events: none;
  z-index: 1;
}
.drop-before::before {
  top: -2px;
}
.drop-after::after {
  bottom: -2px;
}

.layer-item:last-child {
  border-bottom: none;
}

.layer-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 4px;
}

.layer-item-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.layer-item-name {
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 14px;
}

.layer-item-type {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
}

.layer-item-actions {
  display: flex;
  gap: 6px;
  margin-left: 10px;
}

.layer-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  transition: all 0.2s ease;
  white-space: nowrap;
  font-weight: 500;
}

.layer-action-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-action-btn.delete:hover {
  background-color: rgba(var(--v-theme-error), 0.15);
  color: rgb(var(--v-theme-error));
}

.layer-action-btn.add:hover {
  background-color: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
}

.layer-item-hidden {
  opacity: 0.5;
}

.layer-item-hidden .layer-item-name {
  text-decoration: line-through;
}

/* Drag and drop styles */
:global(html.dragging-layer),
:global(html.dragging-layer *) {
  cursor: grabbing !important;
}

.layer-item-dragging {
  opacity: 0.25;
}

.layer-drag-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  padding: 12px 8px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 8px 24px rgb(0 0 0 / 25%),
    0 0 0 1px rgba(var(--v-theme-primary), 0.5);
  pointer-events: none;
  user-select: none;
  will-change: transform;
}

.layer-item.drag-over {
  background: rgba(var(--v-theme-primary), 0.15) !important;
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
  border-radius: 4px;
}
</style>
