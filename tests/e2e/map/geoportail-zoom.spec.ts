import type { MapContainer } from '../../../src/composables/useMap';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function changeZoom(page: Page, zoom: number) {
  await page.evaluate((zoom) => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const map = provides[key]!.map.value!;
    document.documentElement.dataset.tileDraws = '';
    map.getView().setZoom(zoom);
    map.renderSync();
  }, zoom);
}

async function centerPixel(page: Page) {
  return page.locator('.base-map-layer canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    return [
      ...canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data,
    ];
  });
}

test('IGN preloads lower levels and fades new tiles over the cached background', async ({
  page,
  blankProject,
}) => {
  void blankProject;
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestedZooms = new Set<number>();
  await page.route('**/private/wmts?**', async (route) => {
    const zoom = Number(new URL(route.request().url()).searchParams.get('TILEMATRIX'));
    requestedZooms.add(zoom);
    if (zoom === 13) await blocked;
    if (zoom === 14) {
      await route.fulfill({ status: 503, body: 'Tile unavailable' });
      return;
    }
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${zoom === 12 ? '#ff0000' : zoom === 13 ? '#00ff00' : '#0000ff'}"/></svg>`,
    });
  });
  // Observe native canvas draws in the actual app, including their opacity.
  await page.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: Parameters<typeof draw>) {
      const image = args[0];
      if (image instanceof HTMLImageElement && image.src.includes('/private/wmts?')) {
        const zoom = new URL(image.src).searchParams.get('TILEMATRIX');
        // eslint-disable-next-line unicorn/no-this-outside-of-class
        document.documentElement.dataset.tileDraws += `${zoom}:${this.globalAlpha},`;
      }
      // eslint-disable-next-line unicorn/no-this-outside-of-class
      return draw.apply(this, args);
    };
  });
  await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
    for (const project of projects) {
      project.viewData = {
        topPanelOpen: true,
        sidePanelOpen: true,
        mapView: { lat: 48.8566, lon: 2.3522, zoom: 12 },
      };
    }
    localStorage.setItem('geochase_projects', JSON.stringify(projects));
  });
  await page.reload();
  await page.locator('.base-map-layer canvas').waitFor();
  await expect.poll(() => centerPixel(page)).toEqual([255, 0, 0, 255]);
  // Infinity means every lower zoom, not just the three nearest levels.
  await expect.poll(() => requestedZooms.has(0)).toBe(true);

  await changeZoom(page, 13);
  expect(await centerPixel(page)).toEqual([255, 0, 0, 255]);
  release!();
  await expect.poll(() => centerPixel(page)).toEqual([0, 255, 0, 255]);
  const draws = await page.evaluate(() =>
    (document.documentElement.dataset.tileDraws || '')
      .split(',')
      .map((item) => item.split(':').map(Number))
  );
  expect(draws.some(([zoom, alpha]) => zoom === 12 && alpha === 1)).toBe(true);
  expect(draws.some(([zoom, alpha]) => zoom === 13 && alpha! > 0 && alpha! < 1)).toBe(true);

  await changeZoom(page, 11);
  await expect.poll(() => centerPixel(page)).toEqual([0, 0, 255, 255]);

  const failure = page.waitForResponse(
    (response) => response.url().includes('TILEMATRIX=14&') && response.status() === 503
  );
  await changeZoom(page, 14);
  await failure;
  // Failed requests keep native cached fallback rather than opening holes.
  await expect.poll(async () => (await centerPixel(page))[3]).toBe(255);
  await changeZoom(page, 12);
  await expect.poll(() => centerPixel(page)).toEqual([255, 0, 0, 255]);
});

for (const [initial, next] of [
  ['Geoportail', 'OpenStreetMap'],
  ['OpenStreetMap', 'Geoportail'],
]) {
  test(`changing ${initial} to ${next} cannot reuse the previous provider during zoom`, async ({
    page,
    blankProject,
  }) => {
    void blankProject;
    let holdProvider = '';
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/data\.geopf\.fr\/private\/wmts|tile\.openstreetmap\.org/, async (route) => {
      const provider = route.request().url().includes('geopf') ? 'Geoportail' : 'OpenStreetMap';
      if (provider === holdProvider) await pending;
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${provider === 'Geoportail' ? '#ff0000' : '#0000ff'}"/></svg>`,
      });
    });
    await page.reload();
    await page.locator('.base-map-layer canvas').waitFor();
    const selectProvider = async (name: string) => {
      await page.locator('.v-select__menu-icon').first().click();
      await page.getByRole('option', { name: new RegExp(name) }).click();
    };
    if (initial === 'OpenStreetMap') await selectProvider(initial!);
    await changeZoom(page, 12);
    const initialColor = initial === 'Geoportail' ? [255, 0, 0, 255] : [0, 0, 255, 255];
    await expect.poll(() => centerPixel(page)).toEqual(initialColor);

    holdProvider = next!;
    await selectProvider(next!);
    // The new tiles are blocked: cached tiles from the old provider must not
    // fill the gaps, including after changing the zoom in either direction.
    for (const zoom of [12, 13, 11]) {
      await changeZoom(page, zoom);
      expect((await centerPixel(page))[3]).toBe(0);
    }
    release!();
    const nextColor = next === 'Geoportail' ? [255, 0, 0, 255] : [0, 0, 255, 255];
    await expect.poll(() => centerPixel(page)).toEqual(nextColor);
  });
}
