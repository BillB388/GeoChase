import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function importJSON(page: Page, data: unknown) {
  await page.getByTestId('save-menu-btn').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('import-json-btn').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
}

async function mapPointIds(page: Page): Promise<string[]> {
  // Inspect actual OpenLayers features to catch sidebar/map divergence.
  return page.evaluate(() => {
    const component = (document.querySelector('#map') as any)?.__vueParentComponent;
    if (!component) return [];
    const key = Object.getOwnPropertySymbols(component.provides).find(
      (symbol) => symbol.description === 'mapContainer'
    );
    if (!key) throw new Error('Map provider was not initialized');
    return component.provides[key].pointsSource.value
      .getFeatures()
      .map((feature: any) => feature.getId());
  });
}

test('JSON import opens a separate project and preserves the previous project', async ({
  page,
  blankProject,
}) => {
  await expect.poll(() => mapPointIds(page)).toHaveLength(blankProject.data.points.length);
  await importJSON(page, {
    points: [{ id: 'imported', name: 'Imported location', coordinates: { lat: 48.9, lon: 2.4 } }],
  });
  await expect(page.getByText('Imported location', { exact: true }).first()).toBeVisible();
  await expect.poll(() => mapPointIds(page)).toEqual(['imported']);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const projects = JSON.parse(localStorage.getItem('geochase_projects')!);
        const active = projects.find(
          (project: { id: string }) =>
            project.id === localStorage.getItem('geochase_activeProjectId')
        );
        return active.data.points.map((point: { id: string }) => point.id);
      })
    )
    .toEqual(['imported']);
  const importedId = await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'));
  expect(importedId).not.toBe(blankProject.id);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!));
  expect(saved).toHaveLength(2);
  expect(
    saved.find((project: { id: string }) => project.id === blankProject.id).data.points
  ).toEqual(blankProject.data.points);
  expect(saved.find((project: { id: string }) => project.id === importedId).name).toBe('project');
  await page.reload();
  await expect.poll(() => mapPointIds(page)).toEqual(['imported']);
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${blankProject.id}`).click();
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
  // Reimporting an export with the current ID must still create a separate project.
  await importJSON(page, {
    ...blankProject,
    name: 'Imported hunt',
    projection: 'geodesic',
    data: { points: [{ id: 'named', name: 'Named point', coordinates: { lat: 48, lon: 2 } }] },
  });
  await expect.poll(() => mapPointIds(page)).toEqual(['named']);
  const projects = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('geochase_projects')!)
  );
  expect(projects).toHaveLength(3);
  const activeId = await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'));
  expect(activeId).not.toBe(blankProject.id);
  expect(projects.find((project: { id: string }) => project.id === activeId)).toMatchObject({
    name: 'Imported hunt',
    projection: 'geodesic',
  });
  expect(
    projects.find((project: { id: string }) => project.id === blankProject.id).data.points
  ).toEqual(blankProject.data.points);
});

for (const { name, data } of [
  { name: 'an empty object', data: {} },
  {
    name: 'malformed line point references',
    data: {
      points: [{ id: 'replacement', name: 'Replacement', coordinates: { lat: 49, lon: 3 } }],
      lineSegments: [
        {
          id: 'line',
          name: 'Route',
          mode: 'coordinate',
          center: { lat: 49, lon: 3 },
          endpoint: { lat: 50, lon: 4 },
          pointsOnLine: 42,
        },
      ],
    },
  },
  {
    name: 'malformed point polygon references',
    data: {
      points: [
        {
          id: 'replacement',
          name: 'Replacement',
          coordinates: { lat: 49, lon: 3 },
          polygonIds: 42,
        },
      ],
      polygons: [{ id: 'polygon', name: 'Area', pointIds: ['replacement', 'other', 'third'] }],
    },
  },
]) {
  test(`rejects ${name} without replacing saved or rendered drawings`, async ({
    page,
    blankProject,
  }) => {
    const ids = blankProject.data.points.map((point) => point.id);
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    const original = await page.evaluate(
      () => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data
    );
    await importJSON(page, data);
    await expect(page.getByText('Import error', { exact: true })).toBeVisible();
    // Let autosave run so a partial replacement cannot hide behind the old map features.
    await page.waitForTimeout(650);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('geochase_projects')!)[0].data)
    ).toEqual({ routes: [], ...original });
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    await page.reload();
    await expect.poll(() => mapPointIds(page)).toEqual(ids);
    expect(await page.evaluate(() => localStorage.getItem('geochase_activeProjectId'))).toBe(
      blankProject.id
    );
  });
}

test('requires a name for orphaned work and preserves it after reloading', async ({
  page,
  blankProject,
}) => {
  await expect.poll(() => mapPointIds(page)).toHaveLength(blankProject.data.points.length);
  // Recreate an existing session from before projects became mandatory, using
  // the actual application's stores and its already-rendered drawings.
  await page.evaluate(() => {
    const app = (document.querySelector('#app') as any).__vue_app__;
    app.config.globalProperties.$pinia._s.get('projects').setActiveProject(null);
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Save your work');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
  // The pending recovery itself must survive a refresh before it is named.
  await page.reload();
  await expect(dialog).toContainText('Save your work');
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
  await page.getByTestId('project-name-input').locator('input').fill('Recovered exploration');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'geochase_projects') {
        Storage.prototype.setItem = original;
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return original.call(localStorage, key, value);
    };
  });
  await page.getByTestId('create-project-btn').click();
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Failed to save project', { exact: true })).toBeVisible();
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
  await page.getByTestId('create-project-btn').click();
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate(() => {
    const id = localStorage.getItem('geochase_activeProjectId');
    return JSON.parse(localStorage.getItem('geochase_projects')!).find(
      (project: { id: string }) => project.id === id
    );
  });
  expect(saved.name).toBe('Recovered exploration');
  expect(saved.data.points).toEqual(blankProject.data.points);
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
  await page.reload();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() => mapPointIds(page))
    .toEqual(blankProject.data.points.map((point) => point.id));
});
