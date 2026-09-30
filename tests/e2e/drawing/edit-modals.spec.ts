import type { MapContainer } from '../../../src/composables/useMap';
import type { ProjectData } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import type { Point, Polygon } from 'ol/geom';
import { expect, test } from '../fixtures';

async function seed(page: Page, grouped: boolean) {
  await page.addInitScript((grouped) => {
    if (sessionStorage.getItem('edit-init')) return;
    sessionStorage.setItem('edit-init', '1');
    const metadata = { groupId: grouped ? 'group' : undefined, listOrder: 2, color: '#e53935' };
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem('geochase_activeProjectId', 'edit');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        {
          id: 'edit',
          name: 'Editing',
          createdAt: 1,
          updatedAt: 1,
          viewData: { topPanelOpen: true, sidePanelOpen: true },
          data: {
            elementGroups: grouped ? [{ id: 'group', name: 'Investigation' }] : [],
            points: [
              {
                id: 'a',
                name: 'Alpha',
                coordinates: { lat: 48, lon: 2 },
                polygonIds: ['polygon'],
                ...metadata,
              },
              { id: 'b', name: 'Bravo', coordinates: { lat: 49, lon: 3 }, polygonIds: ['polygon'] },
              {
                id: 'c',
                name: 'Charlie',
                coordinates: { lat: 48, lon: 3 },
                polygonIds: ['polygon'],
              },
            ],
            circles: [
              {
                id: 'circle',
                name: 'Search area',
                center: { lat: 48, lon: 2 },
                radius: 7,
                ...metadata,
              },
            ],
            lineSegments: ['coordinate', 'azimuth', 'intersection', 'parallel'].map((mode) => ({
              id: mode,
              name: `Line ${mode}`,
              mode,
              center: { lat: 48, lon: 2 },
              endpoint: { lat: 49, lon: mode === 'intersection' ? 2 : 3 },
              longitude: mode === 'parallel' ? 48 : undefined,
              intersectionPoint: mode === 'intersection' ? { lat: 48.5, lon: 2 } : undefined,
              ...metadata,
            })),
            polygons: [{ id: 'polygon', name: 'Triangle', pointIds: ['a', 'b', 'c'] }],
            notes: [
              {
                id: 'note',
                title: 'Clue',
                content: 'Keep these details',
                linkedElementType: 'polygon',
                linkedElementId: 'polygon',
                ...metadata,
              },
            ],
            routes: [
              {
                id: 'route',
                name: 'Existing route',
                start: { lat: 48, lon: 2 },
                end: { lat: 49, lon: 3 },
                intermediates: [{ lat: 48, lon: 3 }],
                coordinates: [
                  [2, 48],
                  [3, 48],
                  [3, 49],
                ],
                distance: 200_000,
                duration: 10_000,
                profile: 'car',
                optimization: 'fastest',
                ...metadata,
              },
            ],
          },
        },
      ])
    );
  }, grouped);
  await page.goto('/');
  await expect(page.locator('#map')).toBeVisible();
}

async function edit(page: Page, id: string) {
  await page.locator(`[data-layer-id="${id}"]`).locator('button').last().click();
  await page.locator('.v-menu .v-list:visible').getByText('Edit', { exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function stored(page: Page): Promise<ProjectData['data']> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data);
}

for (const grouped of [false, true]) {
  for (const mode of ['coordinate', 'azimuth', 'intersection', 'parallel']) {
    test(`${grouped ? 'group' : 'category'}: ${mode} edit prefills, cancels, saves and reopens`, async ({
      page,
    }) => {
      await seed(page, grouped);
      let dialog = await edit(page, mode);
      const name = dialog.locator('input').first();
      await expect(name).toHaveValue(`Line ${mode}`);
      const selections = dialog.locator('.v-select__selection-text');
      await expect(selections.first()).not.toBeEmpty();
      if (mode === 'coordinate' || mode === 'intersection')
        await expect(selections.nth(1)).not.toBeEmpty();
      if (mode === 'azimuth' || mode === 'intersection') {
        const distance = dialog.locator('input[type="number"]').last();
        expect(Number(await distance.inputValue())).toBeGreaterThan(0);
      }
      await name.fill('Discard this');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      dialog = await edit(page, mode);
      await expect(dialog.locator('input').first()).toHaveValue(`Line ${mode}`);
      await dialog.locator('input').first().fill('Updated line');
      await dialog.getByRole('button', { name: /^(Save|Update)$/ }).click();
      await expect(dialog).toBeHidden();
      await expect
        .poll(async () => (await stored(page)).lineSegments.find((l) => l.id === mode)?.name)
        .toBe('Updated line');
      const saved = (await stored(page)).lineSegments.find((l) => l.id === mode)!;
      expect(saved.groupId).toBe(grouped ? 'group' : undefined);
      expect(saved.color).toBe('#e53935');
      expect(saved.center).toEqual(mode === 'parallel' ? { lat: 48, lon: 0 } : { lat: 48, lon: 2 });
      if (mode !== 'parallel') {
        expect(saved.endpoint!.lat).toBeCloseTo(49, 5);
        expect(saved.endpoint!.lon).toBeCloseTo(mode === 'intersection' ? 2 : 3, 5);
      }
      await page.reload();
      dialog = await edit(page, mode);
      await expect(dialog.locator('input').first()).toHaveValue('Updated line');
    });
  }

  test(`${grouped ? 'group' : 'category'}: point edit preserves identity and polygon`, async ({
    page,
  }) => {
    await seed(page, grouped);
    const dialog = await edit(page, 'a');
    await expect(dialog.getByLabel('Point Name', { exact: true })).toHaveValue('Alpha');
    await expect(dialog.getByLabel('Coordinates', { exact: true })).toHaveValue('48, 2');
    await dialog.getByLabel('Point Name', { exact: true }).fill('Updated point');
    await dialog.getByLabel('Coordinates', { exact: true }).fill('47, 1');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => (await stored(page)).points.find((p) => p.id === 'a')?.name)
      .toBe('Updated point');
    const saved = await stored(page);
    expect(saved.points).toHaveLength(3);
    expect(saved.points.find((p) => p.id === 'a')).toMatchObject({
      coordinates: { lat: 47, lon: 1 },
      polygonIds: ['polygon'],
      listOrder: 2,
    });
    expect(saved.polygons[0]?.pointIds).toEqual(['a', 'b', 'c']);
    expect(saved.points.find((point) => point.id === 'a')?.groupId).toBe(
      grouped ? 'group' : undefined
    );
    const rendered = await page.evaluate(() => {
      const element = document.querySelector('#map') as HTMLElement & {
        __vueParentComponent: { provides: Record<symbol, MapContainer> };
      };
      const provides = element.__vueParentComponent.provides;
      const key = Object.getOwnPropertySymbols(provides).find(
        (symbol) => symbol.description === 'mapContainer'
      )!;
      const container = provides[key]!;
      const point = container.pointsSource.value!.getFeatureById('a')!.getGeometry() as Point;
      const polygonFeature = container.polygonsSource.value!.getFeatureById('polygon')!;
      const polygon = polygonFeature.getGeometry() as Polygon;
      const overlays = container.map.value!.getOverlays().getArray();
      const labels = overlays.filter((overlay) => overlay.get('id') === 'label-a');
      return {
        point: point.getCoordinates(),
        vertex: polygon.getCoordinates()[0]![0],
        labels: labels.map((overlay) => overlay.getElement()?.textContent),
      };
    });
    expect(rendered.vertex).toEqual(rendered.point);
    expect(rendered.labels).toEqual(['Updated point']);
    await page.reload();
    const reopened = await edit(page, 'a');
    await expect(reopened.getByLabel('Coordinates', { exact: true })).toHaveValue('47, 1');
  });

  test(`${grouped ? 'group' : 'category'}: polygon note edit prefills its link and saves`, async ({
    page,
  }) => {
    await seed(page, grouped);
    const dialog = await edit(page, 'note');
    await expect(dialog.getByTestId('note-title-input').locator('input')).toHaveValue('Clue');
    await expect(dialog.getByTestId('note-content-input').locator('textarea')).toHaveValue(
      'Keep these details'
    );
    await expect(dialog.getByTestId('note-link-type-select')).toContainText('Polygon');
    await expect(dialog.getByTestId('note-link-element-select')).toContainText('Triangle');
    await dialog.getByTestId('note-title-input').locator('input').fill('Updated clue');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect
      .poll(async () => (await stored(page)).notes.find((n) => n.id === 'note')?.title)
      .toBe('Updated clue');
    expect((await stored(page)).notes[0]).toMatchObject({
      linkedElementType: 'polygon',
      linkedElementId: 'polygon',
      content: 'Keep these details',
    });
  });
}

async function mapHas(page: Page, id: string) {
  return page.evaluate((id) => {
    const element = document.querySelector('#map') as HTMLElement & {
      __vueParentComponent: { provides: Record<symbol, MapContainer> };
    };
    const provides = element.__vueParentComponent.provides;
    const key = Object.getOwnPropertySymbols(provides).find(
      (symbol) => symbol.description === 'mapContainer'
    )!;
    const container = provides[key]!;
    return [container.pointsSource, container.linesSource, container.circlesSource].some(
      (source) => !!source.value?.getFeatureById(id)
    );
  }, id);
}

for (const id of ['a', 'circle', 'coordinate', 'azimuth', 'intersection', 'parallel']) {
  test(`editing hidden ${id} keeps it hidden`, async ({ page }) => {
    await seed(page, false);
    await expect.poll(() => mapHas(page, id)).toBe(true);
    await page.locator(`[data-layer-id="${id}"]`).locator('button').last().click();
    await page.locator('.v-menu .v-list:visible').getByText('Hide', { exact: true }).click();
    await expect.poll(() => mapHas(page, id)).toBe(false);
    const dialog = await edit(page, id);
    await dialog.locator('input').first().fill('Still hidden');
    await dialog.getByRole('button', { name: /^(Save|Update)$/ }).click();
    await expect(dialog).toBeHidden();
    expect(await mapHas(page, id)).toBe(false);
    await page.locator(`[data-layer-id="${id}"]`).locator('button').last().click();
    await page.locator('.v-menu .v-list:visible').getByText('Show', { exact: true }).click();
    await expect.poll(() => mapHas(page, id)).toBe(true);
  });
}

for (const grouped of [false, true]) {
  test(`${grouped ? 'group' : 'category'}: circle prefill and saved radius`, async ({ page }) => {
    await seed(page, grouped);
    const dialog = await edit(page, 'circle');
    await expect(dialog.getByLabel('Circle Name', { exact: true })).toHaveValue('Search area');
    await expect(dialog.locator('.v-select__selection-text')).toContainText('Alpha');
    await expect(dialog.locator('input[type="number"]')).toHaveValue('7');
    await dialog.locator('input[type="number"]').fill('9');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await stored(page)).circles[0]?.radius).toBe(9);
    await page.reload();
    const reopened = await edit(page, 'circle');
    await expect(reopened.locator('input[type="number"]')).toHaveValue('9');
  });
}

test('group editor restores name and members after cancel and save', async ({ page }) => {
  await seed(page, true);
  await page.getByTitle('Edit group', { exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Group name', { exact: true })).toHaveValue('Investigation');
  await expect(dialog.getByRole('checkbox', { name: 'Alpha', exact: true })).toBeChecked();
  await dialog.getByLabel('Group name', { exact: true }).fill('Discard');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByTitle('Edit group', { exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Group name', { exact: true })).toHaveValue('Investigation');
  await dialog.getByLabel('Group name', { exact: true }).fill('Updated group');
  await dialog.getByRole('button', { name: 'Save group', exact: true }).click();
  await page.reload();
  await page.getByTitle('Edit group', { exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Group name', { exact: true })).toHaveValue(
    'Updated group'
  );
  await expect(page.getByRole('checkbox', { name: 'Alpha', exact: true })).toBeChecked();
});

for (const grouped of [false, true]) {
  test(`${grouped ? 'group' : 'category'}: route edit retains stops and options`, async ({
    page,
  }) => {
    await seed(page, grouped);
    await page.route('https://data.geopf.fr/navigation/itineraire?**', (route) =>
      route.fulfill({
        json: {
          geometry: {
            type: 'LineString',
            coordinates: [
              [2, 48],
              [3, 48],
              [3, 49],
            ],
          },
          distance: 210_000,
          duration: 11_000,
        },
      })
    );
    let dialog = await edit(page, 'route');
    await expect(dialog.getByLabel('Route name', { exact: true })).toHaveValue('Existing route');
    await expect(dialog.getByTestId('route-step')).toContainText('Charlie');
    await dialog.getByLabel('Route name', { exact: true }).fill('Updated route');
    await dialog.getByRole('button', { name: 'Calculate and save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await stored(page)).routes?.[0]?.name).toBe('Updated route');
    expect((await stored(page)).routes?.[0]).toMatchObject({
      id: 'route',
      profile: 'car',
      optimization: 'fastest',
      intermediates: [{ lat: 48, lon: 3 }],
      color: '#e53935',
    });
    expect((await stored(page)).routes?.[0]?.groupId).toBe(grouped ? 'group' : undefined);
    await page.reload();
    dialog = await edit(page, 'route');
    await expect(dialog.getByLabel('Route name', { exact: true })).toHaveValue('Updated route');
    await expect(dialog.getByTestId('route-step')).toContainText('Charlie');
  });
}
