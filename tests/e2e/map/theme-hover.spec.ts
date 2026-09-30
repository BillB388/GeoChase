import type { MapContainer } from '../../../src/composables/useMap';
import type { Point } from 'ol/geom';
import type VectorLayer from 'ol/layer/Vector';
import type VectorSource from 'ol/source/Vector';
import type { Icon, Style } from 'ol/style';
import { palettes, themes } from '../../../src/services/themes';
import { expect, test } from '../fixtures';

test('map hover uses each palette primary color and clears when leaving the point', async ({
  page,
  blankProject,
}) => {
  test.setTimeout(90_000);
  expect(blankProject.data.points.length).toBeGreaterThan(0);
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
  const highlightIcon = () =>
    page.evaluate(() => {
      const element = document.querySelector('#map') as HTMLElement & {
        __vueParentComponent: { provides: Record<symbol, MapContainer> };
      };
      const provides = element.__vueParentComponent.provides;
      const key = Object.getOwnPropertySymbols(provides).find(
        (symbol) => symbol.description === 'mapContainer'
      )!;
      const layer = provides[key]!.map.value!.getLayers()
        .getArray()
        .find((layer) => layer.getZIndex() === 1900) as VectorLayer<VectorSource>;
      const feature = layer.getSource()!.getFeatures()[0];
      if (!feature) return null;
      const icon = (feature.getStyle() as Style).getImage() as Icon;
      return decodeURIComponent(icon.getSrc()!);
    });
  for (const palette of palettes) {
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByTestId('theme-picker-btn').click();
    await page.getByTestId(`palette-${palette.id}`).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.mouse.move(pixel.x, pixel.y);
    await expect(page.locator('#map')).toHaveCSS('cursor', 'pointer');
    await expect.poll(highlightIcon).toContain(`fill="${themes[palette.theme]!.colors.primary}"`);
    await page.mouse.move(pixel.x + 100, pixel.y + 100);
    await expect.poll(highlightIcon).toBeNull();
  }
});

test('sidebar clicks highlight for three seconds and restart the timer on repeated clicks', async ({
  page,
  blankProject,
}) => {
  expect(blankProject.data.points.length).toBeGreaterThan(0);
  const row = page.locator('[data-layer-id="point-1"] .layer-item-info');
  const highlightCount = (zIndex = 1901) =>
    page.evaluate((zIndex) => {
      const element = document.querySelector('#map') as HTMLElement & {
        __vueParentComponent: { provides: Record<symbol, MapContainer> };
      };
      const provides = element.__vueParentComponent.provides;
      const key = Object.getOwnPropertySymbols(provides).find(
        (symbol) => symbol.description === 'mapContainer'
      )!;
      const layer = provides[key]!.map.value!.getLayers()
        .getArray()
        .find((layer) => layer.getZIndex() === zIndex) as VectorLayer<VectorSource>;
      return layer.getSource()!.getFeatures().length;
    }, zIndex);
  await row.click();
  await expect.poll(highlightCount).toBe(1);
  // Remain highlighted while the map recenters and the pointer stays in the sidebar.
  await page.waitForTimeout(2000);
  await expect.poll(highlightCount).toBe(1);
  await row.click();
  await page.waitForTimeout(1500);
  await expect.poll(highlightCount).toBe(1);
  await expect.poll(highlightCount, { timeout: 2500 }).toBe(0);
  // Hover remains active after the click timer expires, until the pointer leaves.
  await expect.poll(() => highlightCount(1902)).toBe(1);
  await page.locator('.layers-panel-title').hover();
  await expect.poll(() => highlightCount(1902)).toBe(0);

  await page.getByTitle('Create group', { exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Highlighted group');
  await page.getByRole('checkbox', { name: 'Paris', exact: true }).check();
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.element-group [data-layer-id="point-1"] .layer-item-info').click();
  await expect.poll(highlightCount).toBe(1);
  await expect.poll(highlightCount, { timeout: 4000 }).toBe(0);
});

test('sidebar hover highlights the matching point without moving the map, including groups', async ({
  page,
  blankProject,
}) => {
  expect(blankProject.data.points.length).toBeGreaterThan(0);
  const state = () =>
    page.evaluate(() => {
      const element = document.querySelector('#map') as HTMLElement & {
        __vueParentComponent: { provides: Record<symbol, MapContainer> };
      };
      const provides = element.__vueParentComponent.provides;
      const key = Object.getOwnPropertySymbols(provides).find(
        (symbol) => symbol.description === 'mapContainer'
      )!;
      const container = provides[key]!;
      const map = container.map.value!;
      const layer = map
        .getLayers()
        .getArray()
        .find((layer) => layer.getZIndex() === 1902) as VectorLayer<VectorSource>;
      const highlight = layer.getSource()!.getFeatures()[0];
      const extent = highlight?.getGeometry()?.getExtent().join(',');
      const points = container.pointsSource.value!.getFeatures();
      const point = extent
        ? points.find((feature) => feature.getGeometry()?.getExtent().join(',') === extent)
        : undefined;
      return {
        highlighted: point?.getId() ?? null,
        center: map.getView().getCenter(),
        animating: map.getView().getAnimating(),
      };
    });
  await expect.poll(async () => (await state()).animating).toBe(false);
  const center = (await state()).center;
  await page.locator('[data-layer-id="point-1"] .layer-item-info').hover();
  await expect.poll(async () => (await state()).highlighted).toBe('point-1');
  expect((await state()).center).toEqual(center);
  await page.locator('[data-layer-id="point-2"] .layer-item-info').hover();
  await expect.poll(async () => (await state()).highlighted).toBe('point-2');
  await page.locator('.layers-panel-title').hover();
  await expect.poll(async () => (await state()).highlighted).toBeNull();

  await page.getByTitle('Create group', { exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Hover group');
  await page.getByRole('checkbox', { name: 'Paris', exact: true }).check();
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const group = page.locator('.element-group').filter({ hasText: 'Hover group' });
  await group.locator('[data-layer-id="point-1"] .layer-item-info').hover();
  await expect.poll(async () => (await state()).highlighted).toBe('point-1');
  await group.getByTitle('Hide all items in group', { exact: true }).click();
  await group.locator('[data-layer-id="point-1"] .layer-item-info').hover();
  await expect.poll(async () => (await state()).highlighted).toBeNull();
});
