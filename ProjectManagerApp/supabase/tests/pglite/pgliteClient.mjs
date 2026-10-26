// A stand-in for a supabase-js client, backed by PGlite with the real
// migrations — for tests only. It covers exactly what src/sync/transport.js
// uses: rpc(), a small part of the query builder (select with one embedded
// table, eq / is / in / gte / lt / order / limit / maybeSingle, update),
// storage upload / download (checked against the storage policies) and a
// no-op realtime channel. Every call runs as the signed-in test user
// (role `authenticated`, JWT claims set), so row-level security applies
// exactly as on a server.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

/** A fresh database with the Supabase shim and every migration. */
export const createTestDatabase = async () => {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(here, 'supabase-shim.sql'), 'utf8'));
  const dir = path.join(root, 'migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  return db;
};

/** Add an account (as the auth service would). */
export const addUser = (db, { id, email, name }) =>
  db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, email, JSON.stringify({ name })]);

const asUser = (db, userId, fn) =>
  db.transaction(async (tx) => {
    await tx.query('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: 'authenticated' })]);
    return fn(tx);
  });

const toError = (error) => ({ message: error.message, code: error.code || '', details: error.detail || null });

// 'user_id, role, profile:profiles!project_members_user_id_fkey(name, email)'
const selectList = (select, table) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of select) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts
    .map((part) => {
      const embed = part.match(/^(\w+):(\w+)!(\w+)\(([^)]*)\)$/);
      if (!embed) return `t.${part}`;
      const [, alias, other, fk, cols] = embed;
      const column = fk.slice(table.length + 1).replace(/_fkey$/, '');
      const fields = cols.split(',').map((c) => c.trim()).map((c) => `'${c}', e.${c}`).join(', ');
      return `(select json_build_object(${fields}) from public.${other} e where e.id = t.${column}) as ${alias}`;
    })
    .join(', ');
};

class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.params = [];
    this.orders = [];
    this.limitN = null;
    this.single = false;
    this.mode = 'select';
    this.columns = '*';
    this.values = null;
    this.returning = false;
  }
  select(columns = '*') {
    if (this.mode === 'update') this.returning = columns;
    else this.columns = columns;
    return this;
  }
  update(values) {
    this.mode = 'update';
    this.values = values;
    return this;
  }
  filter(sqlFn, value) {
    this.params.push(value);
    this.filters.push(sqlFn(`$${this.params.length}`));
    return this;
  }
  eq(column, value) {
    return this.filter((p) => `t.${column} = ${p}`, value);
  }
  lt(column, value) {
    return this.filter((p) => `t.${column} < ${p}`, value);
  }
  gte(column, value) {
    return this.filter((p) => `t.${column} >= ${p}`, value);
  }
  in(column, values) {
    return this.filter((p) => `t.${column}::text = any(${p}::text[])`, values);
  }
  is(column, value) {
    if (value !== null) throw new Error('only is(null) is supported');
    this.filters.push(`t.${column} is null`);
    return this;
  }
  order(column, { ascending = true } = {}) {
    this.orders.push(`t.${column} ${ascending ? 'asc' : 'desc'}`);
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  async run() {
    const where = this.filters.length ? ` where ${this.filters.join(' and ')}` : '';
    let sql;
    let params = this.params;
    if (this.mode === 'update') {
      const keys = Object.keys(this.values);
      const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      params = [...keys.map((k) => this.values[k]), ...this.params];
      const shifted = where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + keys.length}`);
      sql = `update public.${this.table} t set ${sets}${shifted}${this.returning ? ` returning ${selectList(this.returning, this.table)}` : ''}`;
    } else {
      sql = `select ${this.columns === '*' ? 't.*' : selectList(this.columns, this.table)} from public.${this.table} t${where}${this.orders.length ? ` order by ${this.orders.join(', ')}` : ''}${this.limitN ? ` limit ${Number(this.limitN)}` : ''}`;
    }
    try {
      const res = await asUser(this.client.db, this.client.userId, (tx) => tx.query(sql, params));
      if (this.single) return { data: res.rows[0] ?? null, error: null };
      return { data: res.rows, error: null };
    } catch (error) {
      return { data: null, error: toError(error) };
    }
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
}

/** A supabase-js–shaped client for one user. */
export const createPgliteClient = (db, userId) => {
  const blobs = (db.__blobs ||= new Map());
  const client = {
    db,
    userId,
    rpc: async (fn, args = {}) => {
      try {
        const info = await db.query('select p.proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.proname = $2', ['public', fn]);
        if (info.rows.length === 0) return { data: null, error: { message: `Could not find the function public.${fn} in the schema cache`, code: 'PGRST202' } };
        const names = Object.keys(args);
        const values = names.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
        const call = `public.${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
        const sql = info.rows[0].proretset ? `select * from ${call}` : `select ${call} as result`;
        const res = await asUser(db, userId, (tx) => tx.query(sql, values));
        return { data: info.rows[0].proretset ? res.rows : res.rows[0]?.result ?? null, error: null };
      } catch (error) {
        return { data: null, error: toError(error) };
      }
    },
    from: (table) => new Query(client, table),
    storage: {
      from: (bucket) => ({
        upload: async (name, blob) => {
          try {
            await asUser(db, userId, (tx) => tx.query('insert into storage.objects (bucket_id, name) values ($1, $2)', [bucket, name]));
            blobs.set(`${bucket}/${name}`, blob);
            return { data: { path: name }, error: null };
          } catch (error) {
            if (blobs.has(`${bucket}/${name}`)) return { data: null, error: { message: 'The resource already exists', status: 409 } };
            return { data: null, error: { ...toError(error), status: 403 } };
          }
        },
        download: async (name) => {
          const res = await asUser(db, userId, (tx) => tx.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [bucket, name]));
          if (res.rows.length === 0 || !blobs.has(`${bucket}/${name}`)) return { data: null, error: { message: 'Object not found', status: 400 } };
          return { data: blobs.get(`${bucket}/${name}`), error: null };
        },
      }),
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: () => {},
  };
  return client;
};
