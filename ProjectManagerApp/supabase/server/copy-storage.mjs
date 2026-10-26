// ─────────────────────────────────────────────────────────────
// Copy every uploaded file (bucket `files`) from one Supabase server to
// another — used when moving from the test laptop to hosted Supabase
// (docs/08-server-setup.md §6). Files already on the target are skipped,
// so it can run again after an interruption.
//
// It needs the SECRET (service_role) key of both servers. Put them in the
// environment for this one command — never in the repository or the app:
//   SOURCE_URL=https://laptop.example.ts.net SOURCE_SERVICE_KEY=… \
//   TARGET_URL=https://xyz.supabase.co TARGET_SERVICE_KEY=… \
//   node supabase/server/copy-storage.mjs
// (Run from ProjectManagerApp/, where @supabase/supabase-js is installed.)
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const env = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Set ${name} (see the comment at the top of this file).`);
    process.exit(1);
  }
  return value;
};

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const source = createClient(env('SOURCE_URL'), env('SOURCE_SERVICE_KEY'), options).storage.from('files');
const target = createClient(env('TARGET_URL'), env('TARGET_SERVICE_KEY'), options).storage.from('files');

const listAll = async (bucket, prefix = '') => {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
};

let copied = 0;
let skipped = 0;
const folders = (await listAll(source)).filter((entry) => !entry.id); // project folders
for (const folder of folders) {
  for (const file of await listAll(source, folder.name)) {
    const path = `${folder.name}/${file.name}`;
    const { data: blob, error: readError } = await source.download(path);
    if (readError) throw readError;
    const { error } = await target.upload(path, blob, { contentType: file.metadata?.mimetype || 'application/octet-stream', upsert: false });
    if (error && !/exists|duplicate/i.test(error.message)) throw error;
    if (error) skipped += 1;
    else copied += 1;
  }
}
console.log(`Copied ${copied} files, ${skipped} were already there.`);
