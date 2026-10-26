// Runs the database tests (supabase/tests/database/*.test.sql) without
// Docker: each file gets a fresh in-process Postgres (PGlite) with the
// Supabase parts the schema needs (supabase-shim.sql), every migration in
// order, and a small pgTAP stand-in (pgtap-shim.sql). On a machine with
// Docker the same files run against the real stack: `npx supabase test db`.
//
//   npm run test:db            all files
//   npm run test:db -- 02      files whose name contains "02"

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const read = (file) => readFileSync(file, 'utf8');

const migrationsDir = path.join(root, 'migrations');
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const testsDir = path.join(root, 'tests', 'database');
const filter = process.argv[2] || '';
const testFiles = readdirSync(testsDir).filter((f) => f.endsWith('.test.sql') && f.includes(filter)).sort();

const TAP_LINE = /^(not )?ok \d+/;

const runFile = async (file) => {
  const db = new PGlite();
  try {
    await db.exec(read(path.join(here, 'supabase-shim.sql')));
    for (const migration of migrations) {
      try {
        await db.exec(read(path.join(migrationsDir, migration)));
      } catch (error) {
        throw new Error(`migration ${migration}: ${error.message}`);
      }
    }
    await db.exec(read(path.join(here, 'pgtap-shim.sql')));
    // pgTAP itself is not available in PGlite; the shim stands in for it.
    const sql = read(path.join(testsDir, file)).replace(/^\s*create extension if not exists pgtap.*$/gim, '');
    const results = await db.exec(sql);
    const lines = [];
    results.forEach((result) =>
      result.rows.forEach((row) =>
        Object.values(row).forEach((value) => {
          if (typeof value === 'string' && (TAP_LINE.test(value) || value.startsWith('# tests:'))) lines.push(value);
        })
      )
    );
    return { lines, error: null };
  } catch (error) {
    return { lines: [], error };
  } finally {
    await db.close();
  }
};

let failed = 0;
let total = 0;
for (const file of testFiles) {
  const { lines, error } = await runFile(file);
  console.log(`# ${file}`);
  lines.forEach((line) => console.log(line));
  if (error) {
    failed += 1;
    console.log(`not ok - ${file} did not run: ${error.message}`);
    continue;
  }
  const done = lines.filter((l) => TAP_LINE.test(l));
  total += done.length;
  failed += done.filter((l) => l.startsWith('not ok')).length;
  if (!lines.some((l) => l.startsWith('# tests:'))) {
    failed += 1;
    console.log(`not ok - ${file} stopped before finish()`);
  }
}
console.log(`# ${testFiles.length} files, ${total} assertions, ${failed} failed`);
process.exit(failed === 0 && testFiles.length > 0 ? 0 : 1);
