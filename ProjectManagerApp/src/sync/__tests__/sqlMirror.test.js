// The server's role matrix and collection rules (SQL) must say the same as
// the app's (permissions.js, sync/rules.js) and cover every synced store.
// Adding an action, a role or a synced store without the matching SQL
// migration fails here. Rows come from the `-- BEGIN <table>` / `-- END
// <table>` insert blocks of every migration, so a later migration adds rows
// with the same markers.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, ROLES } from '../../utils/permissions.js';
import { SYNCED_STORES } from '../../utils/storeRegistry.js';
import { DOC_ITEM } from '../itemDiff.js';
import { COLLECTION_RULES, FILES_COLLECTION, PROJECTS_COLLECTION, scopeOf } from '../rules.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', '..', '..', 'supabase', 'migrations');
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(path.join(migrationsDir, f), 'utf8'))
  .join('\n');

// Every `-- BEGIN <name>` … `-- END <name>` insert block of every migration.
const block = (name) => {
  const matches = [...migrations.matchAll(new RegExp(`-- BEGIN ${name}\\b[^\\n]*\\n([\\s\\S]*?)-- END ${name}\\b`, 'g'))];
  assert.ok(matches.length > 0, `block ${name} in the migrations`);
  return matches.flatMap((match) =>
    [...match[1].matchAll(/\(([^()]*)\)/g)]
      .map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((v) => v[1]))
      .filter((row) => row.length > 0)
  );
};

describe('SQL mirrors the app rules', () => {
  it('has the same roles', () => {
    assert.deepEqual(block('roles').map(([role]) => role), ROLES);
  });

  it('has the same role matrix', () => {
    const sql = block('role_actions').map(([action, role]) => `${action}:${role}`).sort();
    const app = Object.entries(ACTIONS)
      .flatMap(([action, roles]) => roles.map((role) => `${action}:${role}`))
      .sort();
    assert.deepEqual(sql, app);
  });

  it('has the same collection rules', () => {
    const sql = block('collection_rules')
      .map(([collection, scope, part, field, value, action]) => [collection, scope, part, field, value, action].join(' '))
      .sort();
    const app = COLLECTION_RULES.map(([collection, part, field, value, action]) => [collection, scopeOf(collection), part, field, value, action].join(' ')).sort();
    assert.deepEqual(sql, app);
  });

  it('has a rule for every part of every synced store', () => {
    const covered = new Set(COLLECTION_RULES.map(([c, p]) => `${c}|${p}`));
    SYNCED_STORES.filter((s) => s.key !== PROJECTS_COLLECTION).forEach((store) => {
      const lists = store.lists || [];
      const parts = lists.some((l) => l.path === '') ? [''] : [DOC_ITEM, ...lists.map((l) => l.path)];
      parts.forEach((part) => assert.ok(covered.has(`${store.key}|${part}`), `${store.key} part "${part}" needs a rule in rules.js and the SQL`));
    });
    assert.ok(covered.has(`${FILES_COLLECTION}|`));
  });

  it('every action in the rules exists', () => {
    COLLECTION_RULES.forEach(([, , , , action]) => action.split('|').forEach((a) => assert.ok(ACTIONS[a], a)));
  });
});
