import type { MapContainer } from '../../../src/composables/useMap';
import type { Point } from 'ol/geom';
import { expect, test } from '../fixtures';

test('hover and left click open the point menu and its edit action', async ({
  page,
  blankProject,
}) => {
  await page.locator('[data-layer-id="point-1"] .layer-item-info').click();
  await page.waitForTimeout(800);
  const pixel = await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const container = provides[key]!;
    const feature = container.pointsSource.value!.getFeatureById('point-1')!;
    const geometry = feature.getGeometry() as Point;
    const pixel = container.map.value!.getPixelFromCoordinate(geometry.getCoordinates());
    const rect = element.getBoundingClientRect();
    return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
  });
  await page.mouse.move(pixel.x, pixel.y);
  await expect(page.locator('#map')).toHaveCSS('cursor', 'pointer');
  await page.mouse.move(pixel.x + 60, pixel.y + 60);
  await expect(page.locator('#map')).not.toHaveCSS('cursor', 'pointer');
  await page.mouse.click(pixel.x, pixel.y);
  const menu = page.locator('.v-menu .v-list:visible');
  await expect(menu).toBeVisible();
  await menu.getByText('Edit', { exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').locator('input').first()).toHaveValue('Paris');
});

test('map click reveals and pulses an offscreen or filtered sidebar row', async ({
  page,
  createProject,
  cleanState,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const project = await createProject({
    data: {
      circles: [],
      lineSegments: [],
      polygons: [],
      notes: [],
      points: Array.from({ length: 35 }, (_, index) => ({
        id: `reveal-${index}`,
        name: `Point ${String(index).padStart(2, '0')}`,
        coordinates: { lat: 48.8566 + index * 0.1, lon: 2.3522 },
        createdAt: Date.now() + index,
      })),
    },
  });
  await page.evaluate((id) => localStorage.setItem('geochase_activeProjectId', id), project.id);
  await page.reload();
  const row = page.locator('[data-layer-id="reveal-34"]');
  await row.locator('.layer-item-info').click();
  await page.waitForTimeout(800);
  const pixel = await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const container = provides[key]!;
    const feature = container.pointsSource.value!.getFeatureById('reveal-34')!;
    const geometry = feature.getGeometry() as Point;
    const pixel = container.map.value!.getPixelFromCoordinate(geometry.getCoordinates());
    const rect = element.getBoundingClientRect();
    return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
  });
  await page.locator('[data-layer-id="reveal-0"]').scrollIntoViewIfNeeded();
  await expect(row).not.toBeInViewport();
  await page.mouse.click(pixel.x, pixel.y);
  await expect(row).toBeInViewport();
  await expect
    .poll(() => row.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await page.locator('.layers-section-title').click();
  await expect(row).toBeHidden();
  await page.locator('.layers-search input').fill('Point 00');
  await page.mouse.click(pixel.x, pixel.y);
  await expect(page.locator('.layers-search input')).toHaveValue('');
  await expect(row).toBeInViewport();
  await expect
    .poll(() => row.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);
});

test('one click switches an open map menu to another element', async ({ page, blankProject }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const pixels = await page.evaluate(() => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const container = provides[key]!;
    const map = container.map.value!;
    map.updateSize();
    const coordinates = ['point-1', 'point-3'].map((id) => {
      const feature = container.pointsSource.value!.getFeatureById(id)!;
      return (feature.getGeometry() as Point).getCoordinates();
    });
    map
      .getView()
      .fit([coordinates[0]![0]!, coordinates[0]![1]!, coordinates[1]![0]!, coordinates[1]![1]!], {
        padding: [180, 300, 180, 750],
      });
    map.renderSync();
    const rect = element.getBoundingClientRect();
    return coordinates.map((coordinate) => {
      const pixel = map.getPixelFromCoordinate(coordinate);
      return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
    });
  });
  const menu = page.locator('.v-menu .v-list:visible');
  await page.mouse.click(pixels[0]!.x, pixels[0]!.y);
  await expect(menu).toBeVisible();
  await page.mouse.click(pixels[1]!.x, pixels[1]!.y);
  // Allow the outside-click dismissal and menu transition to settle.
  await page.waitForTimeout(350);
  await expect(menu).toBeVisible();
  await menu.getByText('Edit', { exact: true }).click();
  await expect(page.getByRole('dialog').locator('input').first()).toHaveValue('Berlin');
});
