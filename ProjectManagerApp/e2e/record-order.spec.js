// The daily path: record a quick work order on a BOQ item, then find it in
// the order log.
import { expect, test } from '@playwright/test';
import { click, createProject, startApp, watchErrors } from './helpers.js';

test('a quick work order shows in the order log', async ({ page }) => {
  await startApp(page, 'en');
  const errors = watchErrors(page);
  const task = await createProject(page, 'Order test');
  // Within the item's contract, so no "Save anyway?" warning (e2e/order-rules.spec.js has those).
  const qty = Number(task.quantity) > 0 ? String(task.quantity) : '7';

  await page.goto('/#/record');
  await click(page.getByRole('button', { name: /Quick Work Order/ }));
  await click(page.getByText('Choose a task'));
  await page.getByPlaceholder('Search by WBS or name').fill(task.wbs);
  await click(page.locator('[cmdk-item]').first());
  await page.getByLabel('Quantity').fill(qty);
  await click(page.getByRole('button', { name: 'Save', exact: true }));

  await page.goto('/#/record/log');
  const row = page.getByRole('row').filter({ hasText: 'Quick Work Order' }).filter({ hasText: task.name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(qty);
  await expect(row).toContainText('Approved');
  expect(errors).toEqual([]);
});
