import type { useMap } from '@/composables/useMap';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import Interaction from 'ol/interaction/Interaction';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Icon, Stroke, Style } from 'ol/style';
import { ref, watch } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useMapCursor } from './useMapCursor';

export interface MapElementSelection {
  elementType: 'route' | 'circle' | 'lineSegment' | 'point' | 'polygon';
  elementId: string;
  position: [number, number];
}

export function useMapEventHandlers(mapContainer: ReturnType<typeof useMap>) {
  const uiStore = useUIStore();
  const contextMenu = ref<MapElementSelection | null>(null);
  const setCursor = useMapCursor(mapContainer, 0);

  const setup = () => {
    const map = mapContainer.map.value;
    if (!map) return () => {};
    const available = () => uiStore.canInteractWithLines && !uiStore.intersectionLineEdit;
    const sources = [
      ['route', mapContainer.routesSource],
      ['circle', mapContainer.circlesSource],
      ['lineSegment', mapContainer.linesSource],
      ['point', mapContainer.pointsSource],
      ['polygon', mapContainer.polygonsSource],
    ] as const;
    const hoverSource = new VectorSource<Feature>();
    const hoverLayer = new VectorLayer({ source: hoverSource, zIndex: 1900 });
    const velvetRose = '#a31332';
    const velvetPin = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 3.53 1.442 6.715 3.77 9.015L12.5 41l8.73-19.485C23.058 19.215 25 15.03 25 12.5 25 5.596 19.404 0 12.5 0zm0 19a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z" fill="${velvetRose}"/></svg>`;
    const hoverStyles = {
      point: new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(velvetPin)}`,
          anchor: [0.5, 1],
        }),
      }),
      line: new Style({ stroke: new Stroke({ color: velvetRose, width: 6 }) }),
      polygon: new Style({
        fill: new Fill({ color: 'rgba(163, 19, 50, 0.32)' }),
        stroke: new Stroke({ color: velvetRose, width: 5 }),
      }),
    };
    const canShowHoverLayer = typeof map!.addLayer === 'function';
    if (canShowHoverLayer) map!.addLayer(hoverLayer);
    let hoveredFeatureId: string | number | undefined;
    function elementAt(pixel: number[]) {
      if (!available() || typeof map!.forEachFeatureAtPixel !== 'function') return;
      return map!.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const id = feature.getId();
          if (typeof id !== 'string') return;
          for (const [elementType, source] of sources) {
            if (
              source.value?.getFeatureById(id) === feature &&
              uiStore.isElementVisible(elementType, id)
            ) {
              return { elementType, elementId: id };
            }
          }
        },
        { hitTolerance: 6 }
      );
    }
    const clearHover = () => {
      setCursor(null);
      hoveredFeatureId = undefined;
      hoverSource.clear();
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (typeof map!.getEventPixel !== 'function') return;
      const element = event.buttons === 0 ? elementAt(map!.getEventPixel(event)) : undefined;
      setCursor(element ? 'pointer' : null);

      const isVelvetTheme = document.documentElement.dataset.palette === 'goldVelvet';
      const feature = element
        ? sources.map(([, source]) => source.value?.getFeatureById(element.elementId)).find(Boolean)
        : undefined;
      const featureId = feature?.getId();
      if (!isVelvetTheme || !feature || featureId === undefined) {
        hoveredFeatureId = undefined;
        hoverSource.clear();
      } else if (hoveredFeatureId !== featureId) {
        hoveredFeatureId = featureId;
        const geometry = feature.getGeometry()?.clone();
        hoverSource.clear();
        if (geometry instanceof Point) {
          const highlight = new Feature(geometry);
          highlight.setStyle(hoverStyles.point);
          hoverSource.addFeature(highlight);
        } else if (geometry instanceof Polygon) {
          const highlight = new Feature(geometry);
          highlight.setStyle(hoverStyles.polygon);
          hoverSource.addFeature(highlight);
        } else if (geometry instanceof LineString) {
          const highlight = new Feature(geometry);
          highlight.setStyle(hoverStyles.line);
          hoverSource.addFeature(highlight);
        }
      }
    };
    const interaction = new Interaction({
      handleEvent(event) {
        if (
          event.type === 'click' &&
          'button' in event.originalEvent &&
          event.originalEvent.button === 0
        ) {
          const element = elementAt(event.pixel);
          if (element) {
            uiStore.sidebarOpen = true;
            uiStore.sidebarElementRequest = { ...element };
            const rect = map!.getViewport().getBoundingClientRect();
            contextMenu.value = {
              ...element,
              position: [rect.left + event.pixel[0]!, rect.top + event.pixel[1]!],
            };
            clearHover();
            return false;
          }
        }
        return true;
      },
    });
    map.addInteraction(interaction);
    map.getViewport().addEventListener('pointermove', handlePointerMove);
    map.getViewport().addEventListener('pointerleave', clearHover);
    map.on('movestart', clearHover);
    const stopWatch = watch(
      () => [available(), uiStore.elementVisibility],
      () => {
        clearHover();
        if (!available()) contextMenu.value = null;
      },
      {
        deep: true,
      }
    );
    const unsubscribeRightClick = mapContainer.onMapRightClick((lat, lon) => {
      if (uiStore.gameMode || uiStore.freeHandDrawing.isDrawing) return;
      uiStore.startCreating('point', { lat, lon });
      uiStore.openModal('pointModal');
    });
    return () => {
      unsubscribeRightClick();
      stopWatch();
      clearHover();
      map.removeInteraction(interaction);
      if (canShowHoverLayer && typeof map.removeLayer === 'function') map.removeLayer(hoverLayer);
      map.getViewport().removeEventListener('pointermove', handlePointerMove);
      map.getViewport().removeEventListener('pointerleave', clearHover);
      map.un('movestart', clearHover);
    };
  };

  return { setup, contextMenu };
}
