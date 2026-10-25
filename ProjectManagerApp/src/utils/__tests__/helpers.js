// Shared helpers for the node:test suite in src/utils/__tests__.
//
// Why a setup function + dynamic imports?
//
// 1) localStorage: several utils persist to localStorage at CALL time (never
//    at module-load time). Node has no localStorage global, so we install an
//    in-memory shim before any util that might touch it gets imported.
//
// 2) Extensionless relative imports: GanttEngine.js and TemplateEngine.js
//    import './OrderEngine' / './CriticalPath' / './RateLibrary' WITHOUT the
//    '.js' extension (Vite resolves those; plain Node ESM does not). We must
//    not edit the source files, so we register a tiny ESM resolve hook that
//    appends '.js' to extensionless RELATIVE specifiers. The hook has to be
//    registered BEFORE those modules are loaded — therefore every test file
//    calls installNodeTestEnvironment() first and then loads the module under
//    test with a top-level dynamic import().
//
// Run everything with:  node --test src/utils/__tests__/

import { register } from 'node:module';

let environmentInstalled = false;

// Resolve-hook source (loaded through a data: URL so no extra file is needed).
// Tries '<specifier>.js' first for extensionless relative imports and falls
// back to the specifier exactly as written (e.g. './styles.css').
const RESOLVE_HOOK_SOURCE = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.[A-Za-z]+$/.test(specifier)) {
    try {
      return await nextResolve(specifier + '.js', context);
    } catch {
      /* not a bare JS module — resolve the specifier as written */
    }
  }
  return nextResolve(specifier, context);
}
`;

/** Install the localStorage shim and the extensionless-import resolve hook. */
export const installNodeTestEnvironment = () => {
  if (environmentInstalled) return;
  environmentInstalled = true;

  if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key, value) => {
        store.set(String(key), String(value));
      },
      removeItem: (key) => {
        store.delete(String(key));
      },
      clear: () => {
        store.clear();
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    };
  }

  register(`data:text/javascript,${encodeURIComponent(RESOLVE_HOOK_SOURCE)}`, import.meta.url);
};

/**
 * Minimal raw-task factory matching the App.jsx task shape that
 * GanttEngine.calculate() expects. Override fields per test.
 */
export const makeTask = (overrides = {}) => ({
  id: 'task',
  wbs: '1.1',
  name: 'بند',
  isGroup: false,
  quantity: 10,
  unitPrice: 100,
  unit: 'م3',
  duration: 5,
  dependsOn: null,
  depType: '',
  lag: 0,
  manualStart: null,
  actualQuantity: 0,
  ...overrides,
});
