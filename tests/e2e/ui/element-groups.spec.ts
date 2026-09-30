import type { MapContainer } from '../../../src/composables/useMap';
import type { Point } from 'ol/geom';
import { expect, test } from '../fixtures';

test('grouped notes remain searchable and map clicks reveal collapsed groups after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('groups-init')) return;
    sessionStorage.setItem('groups-init', '1');
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'groups');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'groups',
          name: 'Groups',
          createdAt: 1,
          updatedAt: 1,
          data: {
            circles: [],
            lineSegments: [],
            polygons: [],
            points: [{ id: 'paris', name: 'Paris', coordinates: { lat: 48.8566, lon: 2.3522 } }],
            notes: [{ id: 'clue', title: 'Clue', content: 'Look for the hiddenneedle' }],
          },
        },
      ])
    );
  });
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
  await page.getByTitle('Create group', { exact: true }).click();
  await page.getByLabel('Group name', { exact: true }).fill('Investigation');
  await page.getByRole('checkbox', { name: 'Paris', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Clue', exact: true }).check();
  await page.getByRole('button', { name: 'Save group', exact: true }).click();
  const group = page.locator('.element-group').filter({ hasText: 'Investigation' });
  await expect(group.locator('.layer-item-name')).toHaveText(['Paris', 'Clue']);
  await page.reload();
  await expect(group.locator('.layer-item-name')).toHaveText(['Paris', 'Clue']);

  const search = page.locator('.layers-search input');
  await search.fill('HIDDENNEEDLE');
  await expect(group).toBeVisible();
  await expect(group.locator('.layer-item-name')).toHaveText(['Clue']);
  await search.fill('');

  const row = page.locator('[data-layer-id="paris"]');
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
    const geometry = container.pointsSource.value!.getFeatureById('paris')!.getGeometry() as Point;
    const pixel = container.map.value!.getPixelFromCoordinate(geometry.getCoordinates());
    const rect = element.getBoundingClientRect();
    return { x: rect.left + pixel[0]!, y: rect.top + pixel[1]! };
  });
  await group.locator('.layers-section-title').click();
  await expect(row).toBeHidden();
  await search.fill('no match');
  await page.mouse.click(pixel.x, pixel.y);
  await expect(search).toHaveValue('');
  await expect(row).toBeInViewport();
  await expect
    .poll(() => row.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);
});
