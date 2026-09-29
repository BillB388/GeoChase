import type { ProjectData, ProjectProjection } from '../../../src/types/project';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { expect, test } from '../fixtures';

const data: ProjectData['data'] = {
  circles: [],
  polygons: [],
  notes: [],
  points: [
    { id: 'west', name: 'West', coordinates: { lat: 60, lon: -60 } },
    { id: 'east', name: 'East', coordinates: { lat: 60, lon: 60 } },
  ],
  lineSegments: [
    {
      id: 'route',
      name: 'Long route',
      mode: 'coordinate',
      center: { lat: 60, lon: -60 },
      endpoint: { lat: 60, lon: 60 },
    },
  ],
};

async function selectProjection(page: Page, projection: ProjectProjection) {
  await page.getByTestId('project-projection-select').locator('.v-select__menu-icon').click();
  await page
    .getByRole('option', { name: projection === 'geodesic' ? /Geodesic/ : /Mercator/ })
    .click();
}

async function openSettings(page: Page) {
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('project-settings-btn').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function savedProject(page: Page): Promise<ProjectData> {
  return page.evaluate(() => {
    const projects: ProjectData[] = JSON.parse(localStorage.getItem('geochase_projects')!);
    return projects.find(
      (project) => project.id === localStorage.getItem('geochase_activeProjectId')
    )!;
  });
}

async function importProject(page: Page, project: unknown) {
  await page.getByTestId('save-menu-btn').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('import-json-btn').click();
  await (
    await chooser
  ).setFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
}

test('chooses the projection at creation and retains it through project switching', async ({
  page,
  cleanState,
}) => {
  await page.getByTestId('project-name-input').locator('input').fill('Curved project');
  await selectProjection(page, 'geodesic');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).projection).toBe('geodesic');
  const curvedId = (await savedProject(page)).id;
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('new-project-btn').click();
  await expect(page.getByTestId('project-projection-select')).toContainText('Mercator');
  await page.getByTestId('project-name-input').locator('input').fill('Straight project');
  await page.getByTestId('create-project-btn').click();
  await expect.poll(async () => (await savedProject(page)).projection).toBe('mercator');
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  await page.getByTestId(`load-project-${curvedId}`).click();
  await page.reload();
  await openSettings(page);
  await expect(page.getByTestId('project-projection-select')).toContainText('Geodesic');
});

test('changes the whole project, exports the setting and follows the arc in GPX', async ({
  page,
  blankProject,
}) => {
  await importProject(page, { name: 'Legacy', data });
  await expect.poll(async () => (await savedProject(page)).name).toBe('Legacy');
  expect((await savedProject(page)).id).not.toBe(blankProject.id);
  const previous = await page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('geochase_projects')!).find(
        (project: ProjectData) => project.id === id
      ),
    blankProject.id
  );
  expect(previous.data.points).toEqual(blankProject.data.points);
  await expect.poll(async () => (await savedProject(page)).data.lineSegments.length).toBe(1);
  await openSettings(page);
  await selectProjection(page, 'geodesic');
  await page.getByTestId('save-project-settings-btn').click();
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
  await page.reload();
  await openSettings(page);
  await expect(page.getByTestId('project-projection-select')).toContainText('Geodesic');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByTestId('save-menu-btn').click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByTestId('export-json-btn').click();
  const exported: ProjectData = JSON.parse(
    await readFile((await (await jsonDownload).path())!, 'utf8')
  );
  expect(exported.projection).toBe('geodesic');
  expect(exported.data.lineSegments[0]?.id).toBe('route');
  expect(exported.data.points.map((point) => point.coordinates)).toEqual(
    data.points.map((point) => point.coordinates)
  );

  await page.getByTestId('save-menu-btn').click();
  const gpxDownload = page.waitForEvent('download');
  await page.getByTestId('export-gpx-btn').click();
  const gpx = await readFile((await (await gpxDownload).path())!, 'utf8');
  const latitudes = [...gpx.matchAll(/trkpt lat="([\d.-]+)"/g)].map((match) => Number(match[1]));
  expect(Math.max(...latitudes)).toBeGreaterThan(73);

  await importProject(page, data);
  await expect.poll(async () => (await savedProject(page)).projection).toBe('mercator');
  await importProject(page, exported);
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
});

test('rejects unsupported imported projections without replacing the project', async ({
  page,
  blankProject,
}) => {
  await importProject(page, { data, projection: 'geodesic' });
  await expect.poll(async () => (await savedProject(page)).projection).toBe('geodesic');
  await expect
    .poll(async () => (await savedProject(page)).data.lineSegments[0]?.startPointId)
    .toBe('west');
  const before = await savedProject(page);
  await importProject(page, { data: { ...data, points: [] }, projection: 'unsupported' });
  await expect(page.getByText('Import error', { exact: true })).toBeVisible();
  expect((await savedProject(page)).data).toEqual(before.data);
  expect((await savedProject(page)).projection).toBe('geodesic');
});

test('explains the project-wide setting in the tutorial', async ({ page, blankProject }) => {
  await page.getByRole('button', { name: 'Welcome to GeoChase', exact: true }).click();
  await page.getByRole('tab', { name: 'Projects', exact: true }).click();
  await expect(page.getByTestId('projection-tutorial')).toContainText('Project Settings');
  await expect(page.getByTestId('projection-tutorial')).toContainText('JSON');
});

test('requires a project before using the workspace', async ({ page, cleanState }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('cancel-project-btn')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  // A real click outside the dialog must not reach the drawing toolbar.
  const point = await page.getByTestId('draw-point-btn').boundingBox();
  await page.mouse.click(point!.x + point!.width / 2, point!.y + point!.height / 2);
  await expect(page.getByTestId('project-name-input')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByTestId('create-project-btn')).toBeDisabled();
  await page.getByTestId('project-name-input').locator('input').fill('Required project');
  await page.getByTestId('create-project-btn').click();
  await expect(dialog).not.toBeVisible();
  expect((await savedProject(page)).name).toBe('Required project');
  await page.getByTestId('draw-point-btn').click();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('project-name-input')).not.toBeVisible();
});

test('first visit requires language selection and then a project', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  await page.locator('.language-card').first().click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('project-name-input')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('project-name-input')).toBeVisible();
});

for (const storageKey of ['geochase_projects', 'geosketch_projects']) {
  test(`recovers ${storageKey} when the active project is missing`, async ({ page }) => {
    const source = JSON.stringify([{ name: 'Old exploration', projection: 'geodesic', data }]);
    await page.addInitScript(
      ({ storageKey, source }) => {
        if (sessionStorage.getItem('recovery-fixture')) return;
        sessionStorage.setItem('recovery-fixture', '1');
        localStorage.setItem('gpxCircle_language', 'en');
        localStorage.setItem(storageKey, source);
        localStorage.setItem('geochase_activeProjectId', 'missing-project');
      },
      { storageKey, source }
    );
    await page.goto('/');
    await expect(page.getByRole('dialog')).toContainText('Save your work');
    await expect(page.getByTestId('project-name-input').locator('input')).toHaveValue(
      'Old exploration'
    );
    await page.getByTestId('project-name-input').locator('input').fill('Recovered project');
    await page.getByTestId('create-project-btn').click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect((await savedProject(page)).name).toBe('Recovered project');
    expect((await savedProject(page)).projection).toBe('geodesic');
    expect((await savedProject(page)).data.points.map((point) => point.id)).toEqual([
      'west',
      'east',
    ]);
    const retained = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey
    );
    expect(retained[0]).toEqual(JSON.parse(source)[0]);
    await page.reload();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect((await savedProject(page)).data.points.map((point) => point.id)).toEqual([
      'west',
      'east',
    ]);
  });
}

test('asks which saved work to recover when several projects have no active link', async ({
  page,
}) => {
  await page.addInitScript((data) => {
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem(
      'geochase_projects',
      JSON.stringify([
        { name: 'First exploration', data },
        { name: 'Second exploration', data: { ...data, points: [] } },
      ])
    );
  }, data);
  await page.goto('/');
  await expect(page.getByTestId('create-project-btn')).toBeDisabled();
  await page.getByTestId('recovery-source-select').locator('.v-select__menu-icon').click();
  await page.getByRole('option', { name: 'First exploration', exact: true }).click();
  await page.getByTestId('project-name-input').locator('input').fill('Regularized exploration');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).data.points).toHaveLength(2);
  const projects = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('geochase_projects')!)
  );
  expect(projects).toHaveLength(3);
  expect(projects[0].name).toBe('First exploration');
  expect(projects[1].name).toBe('Second exploration');
});

test('recovers historical standalone coordinates as project points', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gpxCircle_language', 'en');
    localStorage.setItem(
      'geosketch_savedCoordinates',
      JSON.stringify([{ id: 'old-coordinate', name: 'Old clue', lat: 48, lon: 2 }])
    );
  });
  await page.goto('/');
  await expect(page.getByRole('dialog')).toContainText('Save your work');
  await page.getByTestId('project-name-input').locator('input').fill('Recovered coordinates');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).data.points[0]).toMatchObject({
    name: 'Old clue',
    coordinates: { lat: 48, lon: 2 },
  });
  expect(
    await page.evaluate(() => localStorage.getItem('geosketch_savedCoordinates'))
  ).not.toBeNull();
});

test('keeps project management open after deleting the active project', async ({
  page,
  blankProject,
  createProject,
}) => {
  const other = await createProject({ id: 'remaining-project', name: 'Remaining project' });
  await page.reload();
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId(`delete-project-${blankProject.id}`).click();
  await expect(page.getByTestId('projects-list')).toBeVisible();
  await expect(page.getByTestId('project-name-input')).not.toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('projects-list')).toBeVisible();
  await expect(page.getByTestId('close-load-modal-btn')).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('geochase_unassigned_work'))).toBeNull();
  await page.getByTestId(`load-project-${other.id}`).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).id).toBe(other.id);
  expect((await savedProject(page)).data.points).toHaveLength(0);
});

test('opens empty project creation only after deleting the last saved project', async ({
  page,
  blankProject,
  createProject,
}) => {
  const other = await createProject({ id: 'last-project', name: 'Last project' });
  await page.reload();
  await page.getByTestId('save-menu-btn').click();
  await page.getByTestId('load-project-btn').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId(`delete-project-${blankProject.id}`).click();
  await expect(page.getByTestId('projects-list')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId(`delete-project-${other.id}`).click();
  await expect(page.getByTestId('projects-list')).not.toBeVisible();
  await expect(page.getByTestId('project-name-input')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByTestId('project-name-input').locator('input')).toHaveValue('');
  await expect(page.getByRole('dialog')).not.toContainText('Save your work');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('project-name-input')).toBeVisible();
  await page.getByTestId('project-name-input').locator('input').fill('Fresh start');
  await page.getByTestId('create-project-btn').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await savedProject(page)).data.points).toHaveLength(0);
  await page.reload();
  expect((await savedProject(page)).name).toBe('Fresh start');
  expect((await savedProject(page)).data.points).toHaveLength(0);
});
