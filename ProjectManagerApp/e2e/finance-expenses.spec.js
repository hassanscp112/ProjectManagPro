// One entry point for expenses: expense orders compute their amount from
// their details and the Finance ledgers show them; the old finance ledger
// moves into expense orders once (backup first, totals unchanged, kept).
import { expect, test } from '@playwright/test';
import { click, createProject, startApp, watchErrors } from './helpers.js';

test('a machinery expense computes its amount and shows in Finance', async ({ page }) => {
  await startApp(page, 'en');
  const errors = watchErrors(page);
  await createProject(page, 'Expense test');

  await page.goto('/#/record');
  await click(page.getByRole('button', { name: /Machinery & Equipment/ }));
  await page.getByLabel('Machine type').selectOption('شفل');
  await page.getByLabel('Driver', { exact: true }).selectOption('سائق عمر');
  await page.getByLabel('Machine hours').fill('6');
  await page.getByLabel('Rate per hour (machine)').fill('40000');
  await page.getByLabel('Fuel (liters)').fill('30');
  await page.getByLabel('Price per liter').fill('750');
  await expect(page.locator('output')).toHaveText('262,500 IQD'); // 6 × 40,000 + 30 × 750
  await click(page.getByRole('button', { name: 'Save', exact: true }));

  await page.goto('about:blank');
  await page.goto('/#/finance/machinery');
  await expect(page.getByRole('row').filter({ hasText: 'سائق عمر' })).toContainText('262,500 IQD');
  expect(errors).toEqual([]);
});

test('the old finance ledger moves into expense orders once, totals unchanged', async ({ page }) => {
  await startApp(page, 'en');
  const errors = watchErrors(page);
  await createProject(page, 'Finance move test');
  const financeKey = await page.evaluate(() => {
    const key = Object.keys(localStorage)
      .find((k) => k.endsWith(':project-manager-gantt-tasks'))
      .replace('project-manager-gantt-tasks', 'project-manager-finance-data');
    const ledger = {
      machinery: [{ id: '1790000000000', date: '2026-09-01', machineType: 'شفل', operator: 'سائق عمر', machineHours: 4, machineRate: 30000, totalPrice: 120000 }],
      materials: [],
      pettyCash: [{ id: '1790000000001', date: '2026-09-02', expenseType: 'اطعام', notes: 'lunch', totalPrice: 25000 }],
      payroll: [],
    };
    localStorage.setItem(key, JSON.stringify(ledger));
    return key;
  });

  await page.goto('about:blank'); // a full load, as the smoke test does: the page reads the seeded ledger
  await page.goto('/#/finance/machinery');
  await expect(page.getByText('The old finance ledger is not in these tables yet')).toBeVisible();
  await click(page.getByRole('button', { name: 'Review the move (2 records)' }));
  const download = page.waitForEvent('download');
  await click(page.getByRole('button', { name: 'Download backup and move 2' }));
  expect((await download).suggestedFilename()).toMatch(/^project-backup-before-finance-migration-/);
  await expect(page.getByText(/The old ledger was moved into expense orders on .* \(2 records\)/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'سائق عمر' })).toContainText('120,000 IQD');
  await expect(page.getByRole('button', { name: /Move \d+ more/ })).toHaveCount(0);

  await page.goto('/#/finance/pettyCash');
  await expect(page.getByRole('row').filter({ hasText: 'اطعام' })).toContainText('25,000 IQD');

  // The old ledger is kept as it was, with the flag beside it.
  const old = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), financeKey);
  expect([old.machinery.length, old.pettyCash.length, old.migration.count]).toEqual([1, 1, 2]);
  expect(errors).toEqual([]);
});
