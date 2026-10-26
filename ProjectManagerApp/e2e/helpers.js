// Shared steps for the end-to-end tests (Playwright, see playwright.config.js).

/**
 * Start the app in this language with a user already named (stored where
 * the app keeps them), so the first-run "Who is using the app?" dialog
 * stays closed.
 */
export const startApp = (page, lang) =>
  page.addInitScript((code) => {
    if (location.protocol === 'about:') return; // no storage on about:blank
    localStorage.setItem('pm-language', code);
    if (!localStorage.getItem('pm-identity')) {
      localStorage.setItem('pm-identity', JSON.stringify({ name: 'E2E', role: '' }));
    }
  }, lang);

/** Console errors and uncaught exceptions of a page, collected as they happen. */
export const watchErrors = (page) => {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
};

/**
 * Click through the DOM: Playwright's pointer clicks can time out in some
 * environments (animations, overlays), a plain element.click() does not.
 */
export const click = (locator) => locator.evaluate((el) => el.click());

/**
 * Create a project from the first template (the default start) and return
 * its first BOQ item ({ id, name, ... }), read from the stored task list.
 */
export const createProject = async (page, name) => {
  await page.goto('/#/projects/new');
  await page.locator('input[data-autofocus]').fill(name);
  await click(page.getByRole('button', { name: /Create and start planning|إنشاء وبدء التخطيط/ }));
  await page.waitForURL(/#\/schedule/);
  const task = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith(':project-manager-gantt-tasks'));
    const tasks = JSON.parse(localStorage.getItem(key) || '[]');
    return tasks.find((x) => x.isGroup === false) || null;
  });
  if (!task) throw new Error('The new project has no BOQ item');
  return task;
};
