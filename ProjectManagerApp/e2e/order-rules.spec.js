// Order rules: a draft that looks wrong asks "Save anyway?" instead of
// being refused — over the item's contract quantity, a likely duplicate.
import { expect, test } from '@playwright/test';
import { click, createProject, startApp, watchErrors } from './helpers.js';

test('warnings ask "Save anyway?" and never block', async ({ page }) => {
  await startApp(page, 'en');
  const errors = watchErrors(page);
  const task = await createProject(page, 'Rules test');
  const over = String((Number(task.quantity) || 0) + 5);

  await page.goto('/#/record');
  await click(page.getByRole('button', { name: /Quick Work Order/ }));
  await click(page.getByText('Choose a task'));
  await page.getByPlaceholder('Search by WBS or name').fill(task.wbs);
  await click(page.locator('[cmdk-item]').first());
  await page.getByLabel('Quantity').fill(over);
  await click(page.getByRole('button', { name: 'Save', exact: true }));

  // Over the contract: the dialog explains, "Save anyway" saves.
  const dialog = page.getByRole('dialog', { name: 'Save anyway?' });
  await expect(dialog).toContainText('more than what is left on this item’s contract');
  await click(dialog.getByRole('button', { name: 'Save anyway' }));
  await expect(dialog).toHaveCount(0);

  // The same order again: also a likely duplicate. "Go back" keeps the form and saves nothing.
  await click(page.getByRole('button', { name: 'Repeat last order' }));
  await page.getByLabel('Quantity').fill(over);
  await click(page.getByRole('button', { name: 'Save', exact: true }));
  await expect(dialog).toContainText('An order just like this is already recorded');
  await click(dialog.getByRole('button', { name: 'Go back' }));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Quantity')).toHaveValue(over);

  await page.goto('/#/record/log');
  const rows = page.getByRole('row').filter({ hasText: 'Quick Work Order' }).filter({ hasText: task.name });
  await expect(rows).toHaveCount(1);
  expect(errors).toEqual([]);
});
