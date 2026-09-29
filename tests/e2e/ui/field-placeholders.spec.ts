import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

async function expectNoOverlappingPlaceholder(page: Page) {
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.v-dialog .v-field').evaluateAll((fields) =>
        fields.flatMap((field) => {
          const input = field.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input[placeholder], textarea[placeholder]'
          );
          if (!input || !input.placeholder || input.value || !input.getBoundingClientRect().width)
            return [];
          const inactiveLabel =
            !field.classList.contains('v-field--active') &&
            !field.classList.contains('v-field--no-label');
          return inactiveLabel && getComputedStyle(input, '::placeholder').opacity !== '0'
            ? [input.placeholder]
            : [];
        })
      )
    )
    .toEqual([]);
}

for (const mode of ['light', 'dark']) {
  test(`floating labels never overlap placeholders in ${mode} theme`, async ({
    page,
    blankProject,
  }) => {
    if (mode === 'dark') {
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByTestId('theme-picker-btn').click();
      await page.getByTestId('palette-classicDark').click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Close', exact: true })
        .last()
        .click();
    }
    const search = page.getByRole('textbox', { name: 'Enter address or place name', exact: true });
    await expect
      .poll(() => search.evaluate((el) => getComputedStyle(el, '::placeholder').opacity))
      .toBe('1');
    // New-project example stays visible on focus, disappears on blur, and returns on refocus.
    await page.getByTestId('save-menu-btn').click();
    await page.getByTestId('new-project-btn').click();
    const name = page.getByTestId('project-name-input').locator('input');
    await name.focus();
    await expect
      .poll(() => name.evaluate((el) => getComputedStyle(el, '::placeholder').opacity))
      .toBe('1');
    await name.press('Tab');
    await expectNoOverlappingPlaceholder(page);
    await name.fill('Placeholder check');
    await name.fill('');
    await name.press('Tab');
    await expectNoOverlappingPlaceholder(page);
    await page.keyboard.press('Escape');
    for (const tool of ['draw-circle-btn', 'draw-point-btn', 'draw-line-btn']) {
      await page.getByTestId(tool).click();
      await expectNoOverlappingPlaceholder(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    for (const tool of [
      'Free Hand',
      'Azimuth Line',
      'Intersection',
      'Parallel Line',
      'Line at Angle',
    ]) {
      await page.getByTestId('advanced-tools-btn').click();
      await page.getByText(tool, { exact: true }).click();
      await expectNoOverlappingPlaceholder(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  });
}
