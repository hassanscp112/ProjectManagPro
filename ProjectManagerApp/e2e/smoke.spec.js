// Every screen opens without console errors, in Arabic and English, on a
// desktop and at phone width. Each route is loaded fresh, like a shared link.
import { expect, test } from '@playwright/test';
import { createProject, startApp, watchErrors } from './helpers.js';

// The route table of app/router.jsx, with real ids where a route takes one.
const routes = (taskId) => [
  // The projects level
  '/projects',
  '/projects/new',
  '/templates',
  '/templates/new',
  '/rates',
  '/login',
  // Inside the open project
  '/',
  '/record',
  '/record/log',
  '/record/pending',
  '/schedule',
  `/schedule/task/${taskId}`,
  `/schedule/task/${taskId}/details`,
  '/schedule/lookahead',
  '/schedule/baseline',
  '/reports',
  '/reports/daily',
  '/reports/monthly',
  '/reports/activity',
  '/reports/delays',
  '/finance',
  '/finance/certificates',
  '/finance/certificates/c1',
  '/finance/machinery',
  '/finance/materials',
  '/finance/pettyCash',
  '/finance/payroll',
  '/library',
  '/library/boq',
  '/library/files',
  `/library/files/${taskId}`,
  '/library/templates',
  '/library/rates',
  '/people',
  '/people/contractors',
  '/people/teams',
  '/people/workers',
  '/settings',
  '/settings/users',
  '/settings/server',
  '/history/orders/o1',
  '/more',
];

const ERROR_TITLE = /حدث خطأ في هذه الشاشة|Something went wrong on this screen/;
const PHONE = { width: 375, height: 812 };

for (const lang of ['ar', 'en']) {
  for (const phone of [false, true]) {
    test(`every screen renders without console errors (${lang}${phone ? ', phone' : ''})`, async ({ page }) => {
      if (phone) await page.setViewportSize(PHONE);
      await startApp(page, lang);
      const errors = watchErrors(page);
      const task = await createProject(page, `Smoke ${lang}`);

      for (const path of routes(task.id)) {
        await page.goto('about:blank');
        await page.goto(`/#${path}`, { waitUntil: 'networkidle' });
        await expect(page.locator('#root > *').first(), path).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: ERROR_TITLE }), path).toHaveCount(0);
        await expect(page.locator('html'), path).toHaveAttribute('lang', lang);
        expect(errors, `console errors on ${path}`).toEqual([]);
      }
    });
  }
}
