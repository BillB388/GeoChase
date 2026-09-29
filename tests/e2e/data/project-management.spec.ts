import { expect, test } from '../fixtures';

test.describe('Project Management', () => {
  test.describe('Save Menu', () => {
    test('should display save menu button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="save-menu-btn"]')).toBeVisible();
    });

    test('should open save menu dropdown', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="save-menu-dropdown"]')).toBeVisible();
    });

    test('should show new project option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="new-project-btn"]')).toBeVisible();
    });

    test('should show load project option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="load-project-btn"]')).toBeVisible();
    });

    test('should show export JSON option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="export-json-btn"]')).toBeVisible();
    });

    test('should show import JSON option in menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="import-json-btn"]')).toBeVisible();
    });
  });

  test.describe('New Project Modal', () => {
    test('should open new project modal from menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should have project name input', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="project-name-input"]')).toBeVisible();
    });

    test('should have only a create button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('[data-testid="cancel-project-btn"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="create-project-btn"]')).toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should prevent creating a project without a nonblank name', async ({
      page,
      blankProject,
    }) => {
      await page.getByTestId('save-menu-btn').click();
      await page.getByTestId('new-project-btn').click();

      const name = page.getByTestId('project-name-input').locator('input');
      const create = page.getByTestId('create-project-btn');
      await expect(create).toBeDisabled();
      await name.fill(' '.repeat(3));
      await expect(create).toBeDisabled();

      // Keyboard submission must also reject a blank name.
      await name.press('Enter');
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(create).toBeDisabled();

      await name.fill('Valid project name');
      await expect(create).toBeEnabled();
    });

    test('should create project with valid name', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="project-name-input"] input').fill('My Test Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Modal should close and success toast should appear
      await expect(page.locator('.v-dialog')).not.toBeVisible();
      await expect(page.locator('.v-snackbar').first()).toBeVisible();
    });

    test('should submit with enter key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="project-name-input"] input').fill('Enter Key Project');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Modal should close
      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });
  });

  test.describe('Load Project Modal', () => {
    test('should open load project modal from menu', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });

    test('should display load project title', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await expect(
        page.locator('.v-card-title').filter({ hasText: /Load Project|Charger/i })
      ).toBeVisible();
    });

    test('should show project from fixture in list', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show the fixture project "Test Project"
      await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    });

    test('should close modal with close button', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-testid="close-load-modal-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should close modal with escape key', async ({ page, blankProject }) => {
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).not.toBeVisible();
    });

    test('should show projects list after creating a project', async ({ page, blankProject }) => {
      // First create a project
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="project-name-input"] input').fill('Test Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Now open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show projects list
      await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    });

    test('should display project name in list', async ({ page, blankProject }) => {
      // First create a project
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="new-project-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="project-name-input"] input').fill('My Named Project');
      await page.locator('[data-testid="create-project-btn"]').click();
      await page.waitForTimeout(500);

      // Open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      // Should show project name
      await expect(
        page.getByTestId('projects-list').getByText('My Named Project', { exact: true })
      ).toBeVisible();
    });

    test('should show load and delete buttons for project', async ({ page, blankProject }) => {
      // Open load project modal
      await page.locator('[data-testid="save-menu-btn"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="load-project-btn"]').click();
      await page.waitForTimeout(300);

      const projects = page.getByTestId('projects-list');
      await expect(
        projects.getByRole('button', { name: 'Load Project : Test Project', exact: true })
      ).toBeVisible();
      await expect(
        projects.getByRole('button', { name: 'Delete : Test Project', exact: true })
      ).toBeVisible();
    });
  });

  test.describe('Note Creation', () => {
    test('should display create note button', async ({ page, blankProject }) => {
      await expect(page.locator('[data-testid="create-note-btn"]')).toBeVisible();
    });

    test('should open note modal', async ({ page, blankProject }) => {
      await page.locator('[data-testid="create-note-btn"]').click();
      await page.waitForTimeout(300);

      await expect(page.locator('.v-dialog')).toBeVisible();
    });
  });

  test.describe('Map Provider Selector', () => {
    test('should display map provider selector', async ({ page, blankProject }) => {
      await expect(page.locator('.v-navigation-drawer .v-select')).toBeVisible();
    });

    test('should show Geoportail as default', async ({ page, blankProject }) => {
      await expect(
        page.locator('.v-navigation-drawer .v-select__selection').filter({ hasText: 'Geoportail' })
      ).toBeVisible();
    });

    test('should allow changing map provider', async ({ page, blankProject }) => {
      await page.locator('.v-navigation-drawer .v-select .v-select__menu-icon').click();
      await page.waitForTimeout(300);

      // Should show map provider options
      await expect(
        page.locator('.v-select__content .v-list-item').filter({ hasText: 'OpenStreetMap' })
      ).toBeVisible();
    });
  });

  test.describe('Top Bar Toggle', () => {
    test('should have collapse button', async ({ page, blankProject }) => {
      await expect(
        page.getByRole('button', { name: 'Collapse top bar', exact: true })
      ).toBeVisible();
    });

    test('should collapse top bar', async ({ page, blankProject }) => {
      await page.getByRole('button', { name: 'Collapse top bar', exact: true }).click();
      await page.waitForTimeout(500);

      // Top bar should be collapsed - look for expand icon
      await expect(page.getByRole('button', { name: 'Expand top bar', exact: true })).toBeVisible();
    });

    test('should expand top bar after collapse', async ({ page, blankProject }) => {
      // Collapse
      await page.getByRole('button', { name: 'Collapse top bar', exact: true }).click();
      await page.waitForTimeout(500);

      // Expand
      await page.getByRole('button', { name: 'Expand top bar', exact: true }).click();
      await page.waitForTimeout(500);

      // Should show collapse icon again
      await expect(
        page.getByRole('button', { name: 'Collapse top bar', exact: true })
      ).toBeVisible();
    });
  });
});
