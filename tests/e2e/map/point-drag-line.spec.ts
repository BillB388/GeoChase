import type { MapContainer } from '../../../src/composables/useMap';
import type { Page } from '@playwright/test';
import type { LineString, Point } from 'ol/geom';
import { geodesicInverse } from '../../../src/services/geodesy';
import { expect, test } from '../fixtures';

async function framePoints(page: Page) {
  await expect(page.locator('[data-layer-id="point-1"]')).toBeAttached();
  await page.setViewportSize({ width: 1600, height: 900 });
  return page.evaluate(() => {
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
}

async function storedLines(page: Page) {
  return page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects') || '[]');
    return (
      projects.find(
        (project: { id: string }) => project.id === localStorage.getItem('geochase_activeProjectId')
      )?.data.lineSegments ?? []
    );
  });
}

test('dragging from a point snaps and creates an exact two-point line on release', async ({
  page,
  blankProject,
}) => {
  const pixels = await framePoints(page);
  const start = pixels[0]!;
  const end = pixels[1]!;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y - 30, { steps: 5 });
  await expect(page.locator('.navigation-bar')).toContainText('Drag onto another point');
  await expect(page.locator('.v-menu .v-list:visible')).toHaveCount(0);
  // Stop slightly beside the icon to exercise snapping rather than exact aiming.
  await page.mouse.move(end.x + 5, end.y + 3, { steps: 10 });
  await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
  await page.mouse.move(end.x + 70, end.y + 30, { steps: 5 });
  await expect(page.locator('.navigation-bar')).not.toContainText('Two-point line: Berlin');
  await page.mouse.move(end.x + 5, end.y + 3, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.navigation-bar')).toHaveCount(0);
  await expect.poll(() => storedLines(page)).toHaveLength(1);
  const [line] = await storedLines(page);
  expect(line).toMatchObject({
    mode: 'coordinate',
    name: 'Paris → Berlin',
    center: { lat: 48.8566, lon: 2.3522 },
    endpoint: { lat: 52.52, lon: 13.405 },
    startPointId: 'point-1',
    endPointId: 'point-3',
  });
});

test('releasing in empty space keeps drawing and Escape cancels without creating a line', async ({
  page,
  blankProject,
}) => {
  const pixels = await framePoints(page);
  const start = pixels[0]!;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 70, start.y - 50, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.navigation-bar')).toContainText('Click to confirm');
  await expect(page.locator('.navigation-bar')).not.toContainText('Two-point line');
  await page.keyboard.press('Escape');
  await expect(page.locator('.navigation-bar')).toHaveCount(0);
  expect(await storedLines(page)).toHaveLength(0);
  await page.mouse.click(start.x, start.y);
  await expect(page.locator('.v-menu .v-list:visible')).toBeVisible();
});

test('Escape while dragging cancels and preserves map click behavior', async ({
  page,
  blankProject,
}) => {
  const pixels = await framePoints(page);
  await page.mouse.move(pixels[0]!.x, pixels[0]!.y);
  await page.mouse.down();
  await page.mouse.move(pixels[1]!.x, pixels[1]!.y, { steps: 15 });
  await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.navigation-bar')).toHaveCount(0);
  expect(await storedLines(page)).toHaveLength(0);
  await page.mouse.click(pixels[1]!.x, pixels[1]!.y);
  await expect(page.locator('.v-menu .v-list:visible')).toBeVisible();
});

for (const target of ['point', 'line']) {
  test(`confirming on a ${target} does not also open an element menu`, async ({
    page,
    blankProject,
  }) => {
    if (target === 'line') {
      await page.evaluate(() => {
        const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
        projects[0].data.lineSegments = [
          {
            id: 'target-line',
            name: 'Existing line',
            mode: 'coordinate',
            center: { lat: 48.8566, lon: 2.3522 },
            endpoint: { lat: 52.52, lon: 13.405 },
          },
        ];
        localStorage.setItem('geochase_projects', JSON.stringify(projects));
      });
      await page.reload();
    }
    const pixels = await framePoints(page);
    const start = pixels[0]!;
    const end =
      target === 'point'
        ? pixels[1]!
        : await page.evaluate(() => {
            const element = document.querySelector('#map') as HTMLElement & {
              __vueParentComponent: { provides: Record<symbol, MapContainer> };
            };
            const provides = element.__vueParentComponent.provides;
            const key = Object.getOwnPropertySymbols(provides).find(
              (symbol) => symbol.description === 'mapContainer'
            )!;
            const container = provides[key]!;
            const feature = container.linesSource.value!.getFeatureById('target-line')!;
            const coordinate = (feature.getGeometry() as LineString).getCoordinateAt(0.5);
            const pixel = container.map.value!.getPixelFromCoordinate(coordinate);
            const rect = element.getBoundingClientRect();
            return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
          });
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 70, start.y - 50, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.navigation-bar')).toContainText('Click to confirm');
    await page.mouse.move(end.x + 5, end.y + 3);
    if (target === 'point')
      await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
    await page.mouse.click(end.x + 5, end.y + 3);
    await expect(page.locator('.navigation-bar')).toHaveCount(0);
    await expect.poll(() => storedLines(page)).toHaveLength(target === 'point' ? 1 : 2);
    await expect(page.locator('.v-menu .v-list:visible')).toHaveCount(0);

    // A subsequent, independent click can still open the element menu.
    const currentPixels = await framePoints(page);
    await page.mouse.click(currentPixels[1]!.x, currentPixels[1]!.y);
    await expect(page.locator('.v-menu .v-list:visible')).toBeVisible();
  });
}

for (const projection of ['mercator', 'geodesic']) {
  test(`Alt locks a snapped point and saves an intersection line (${projection})`, async ({
    page,
    blankProject,
  }) => {
    await page.evaluate((projection) => {
      const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
      projects[0].projection = projection;
      localStorage.setItem('geochase_projects', JSON.stringify(projects));
    }, projection);
    await page.reload();
    const [start, through] = await framePoints(page);
    await page.mouse.move(start!.x, start!.y);
    await page.mouse.down();
    await page.mouse.move(start!.x + 50, start!.y - 30, { steps: 6 });
    await page.mouse.up();
    await page.mouse.move(through!.x, through!.y, { steps: 8 });
    await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
    await page.keyboard.down('Alt');
    // No pointer movement is required to lock the snapped point.
    await expect(page.locator('.navigation-bar')).toContainText('Intersection through Berlin');
    const end = { x: through!.x + 70, y: through!.y - 65 };
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(page.locator('.navigation-bar')).toContainText('Intersection through Berlin');
    await page.mouse.click(end.x, end.y);
    await page.keyboard.up('Alt');
    await expect(page.locator('.navigation-bar')).toHaveCount(0);
    await expect(page.locator('.v-menu .v-list:visible')).toHaveCount(0);
    await expect.poll(() => storedLines(page)).toHaveLength(1);
    const [line] = await storedLines(page);
    expect(line).toMatchObject({
      mode: 'intersection',
      center: { lat: 48.8566, lon: 2.3522 },
      intersectionPoint: { lat: 52.52, lon: 13.405 },
    });
    expect(line.intersectionExtension).toBeGreaterThan(0);
    expect(line.intersectionDistance).toBe(line.distance);
    if (projection === 'geodesic') {
      const incoming = geodesicInverse(line.center, line.intersectionPoint);
      const outgoing = geodesicInverse(line.intersectionPoint, line.endpoint);
      expect(outgoing.initialBearing).toBeCloseTo(incoming.finalBearing, 6);
    } else {
      const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
      const xRatio = (line.endpoint.lon - 13.405) / (13.405 - 2.3522);
      const yRatio =
        (mercatorY(line.endpoint.lat) - mercatorY(52.52)) / (mercatorY(52.52) - mercatorY(48.8566));
      expect(xRatio).toBeGreaterThan(0);
      expect(yRatio).toBeCloseTo(xRatio, 8);
    }
  });
}

test('releasing Alt immediately unlocks the through-point and resumes two-point drawing', async ({
  page,
  blankProject,
}) => {
  const [start, through] = await framePoints(page);
  await page.mouse.move(start!.x, start!.y);
  await page.mouse.down();
  await page.mouse.move(through!.x, through!.y, { steps: 12 });
  await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
  await page.keyboard.down('Alt');
  await expect(page.locator('.navigation-bar')).toContainText('Intersection through Berlin');
  await page.keyboard.up('Alt');
  await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
  await page.mouse.up();
  await expect.poll(() => storedLines(page)).toHaveLength(1);
  const [line] = await storedLines(page);
  expect(line.mode).toBe('coordinate');
  expect(line.intersectionPoint).toBeUndefined();
});

test('releasing the mouse with Alt held creates the extended intersection line', async ({
  page,
  blankProject,
}) => {
  const [start, through] = await framePoints(page);
  await page.mouse.move(start!.x, start!.y);
  await page.mouse.down();
  await page.mouse.move(through!.x, through!.y, { steps: 12 });
  await page.keyboard.down('Alt');
  await expect(page.locator('.navigation-bar')).toContainText('Intersection through Berlin');
  await page.mouse.move(through!.x + 70, through!.y - 65, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect(page.locator('.navigation-bar')).toHaveCount(0);
  await expect.poll(() => storedLines(page)).toHaveLength(1);
  const [line] = await storedLines(page);
  expect(line.mode).toBe('intersection');
  expect(line.intersectionExtension).toBeGreaterThan(0);
});

for (const startMode of ['preset', 'map point', 'map empty']) {
  for (const finishMode of ['snapped', 'intersection']) {
    test(`toolbar freehand with ${startMode} start supports ${finishMode} endpoint`, async ({
      page,
      blankProject,
    }) => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.getByTestId('advanced-tools-btn').click();
      await page.getByText('Free Hand', { exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.locator('input').first().fill('My custom line');
      if (startMode === 'preset') {
        await dialog.locator('.v-select__menu-icon').click();
        await page.locator('.v-select__content .v-list-item').filter({ hasText: 'Paris' }).click();
      }
      await dialog.getByRole('button', { name: 'Start Drawing', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('.navigation-bar')).toBeVisible();
      const [start, through] = await framePoints(page);
      if (startMode !== 'preset') {
        const offset = startMode === 'map point' ? 4 : 70;
        await page.mouse.click(start!.x + offset, start!.y - offset);
        await expect(page.locator('.navigation-bar')).toContainText('Click to confirm');
      }
      await page.mouse.move(through!.x + 4, through!.y + 3, { steps: 8 });
      await expect(page.locator('.navigation-bar')).toContainText('Two-point line: Berlin');
      if (finishMode === 'intersection') {
        await page.keyboard.down('Alt');
        await expect(page.locator('.navigation-bar')).toContainText('Intersection through Berlin');
        await page.mouse.move(through!.x + 70, through!.y - 65, { steps: 8 });
        await page.mouse.click(through!.x + 70, through!.y - 65);
        await page.keyboard.up('Alt');
      } else {
        await page.mouse.click(through!.x + 4, through!.y + 3);
      }
      await expect(page.locator('.navigation-bar')).toHaveCount(0);
      await expect(page.locator('.v-menu .v-list:visible')).toHaveCount(0);
      await expect.poll(() => storedLines(page)).toHaveLength(1);
      const [line] = await storedLines(page);
      expect(line.name).toBe('My custom line');
      if (startMode !== 'map empty') {
        expect(line.center).toEqual({ lat: 48.8566, lon: 2.3522 });
        expect(line.startPointId).toBe('point-1');
      }
      if (finishMode === 'intersection') {
        expect(line.mode).toBe('intersection');
        expect(line.intersectionPoint).toEqual({ lat: 52.52, lon: 13.405 });
        expect(line.intersectionExtension).toBeGreaterThan(0);
      } else {
        expect(line.mode).toBe('coordinate');
        expect(line.endpoint).toEqual({ lat: 52.52, lon: 13.405 });
        expect(line.endPointId).toBe('point-3');
      }
    });
  }
}
