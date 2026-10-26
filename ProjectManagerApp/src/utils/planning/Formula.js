// ─────────────────────────────────────────────────────────────
// Formula — template quantity formulas and conditions, safely.
//
// A tiny expression language parsed by hand (no eval / new Function):
//   numbers 1.5 · variables floors · + - * / % · comparisons
//   < <= > >= == != · && || ! · cond ? a : b · ( )
//   functions min max ceil floor round abs sqrt pow if(c, a, b)
//   (a leading "Math." is accepted, e.g. Math.ceil(x)); constant PI.
// Booleans are 1 / 0. Unknown variables and syntax errors are reported,
// never thrown. Tested in __tests__/formula.test.js.
// ─────────────────────────────────────────────────────────────

const FUNCTIONS = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  ceil: (x) => Math.ceil(x),
  floor: (x) => Math.floor(x),
  round: (x, d = 0) => {
    const f = 10 ** d;
    return Math.round(x * f) / f;
  },
  abs: (x) => Math.abs(x),
  sqrt: (x) => Math.sqrt(x),
  pow: (x, y) => x ** y,
  if: (c, a, b) => (c ? a : b),
};
const CONSTANTS = { PI: Math.PI };

const tokenize = (src) => {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
      if (!m) throw new Error('number');
      tokens.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?/);
      let name = m[0];
      if (name.startsWith('Math.')) name = name.slice(5);
      else if (name.includes('.')) throw new Error('name');
      tokens.push({ t: 'id', v: name });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/%<>!?:(),'.includes(c)) {
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }
    throw new Error('char');
  }
  return tokens;
};

// Recursive-descent parser → a small AST.
const parse = (tokens) => {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v) => tokens[p] && tokens[p].t === 'op' && tokens[p].v === v;
  const expect = (v) => {
    if (!isOp(v)) throw new Error('expected');
    p++;
  };

  const ternary = () => {
    const cond = or();
    if (isOp('?')) {
      p++;
      const a = ternary();
      expect(':');
      const b = ternary();
      return { k: 'if', cond, a, b };
    }
    return cond;
  };
  const binary = (next, ops) => () => {
    let left = next();
    while (tokens[p] && tokens[p].t === 'op' && ops.includes(tokens[p].v)) {
      const op = tokens[p++].v;
      left = { k: 'bin', op, left, right: next() };
    }
    return left;
  };
  const unary = () => {
    if (isOp('-') || isOp('+') || isOp('!')) {
      const op = tokens[p++].v;
      return { k: 'un', op, arg: unary() };
    }
    return primary();
  };
  const mul = binary(unary, ['*', '/', '%']);
  const add = binary(mul, ['+', '-']);
  const cmp = binary(add, ['<', '<=', '>', '>=', '==', '!=']);
  const and = binary(cmp, ['&&']);
  const or = binary(and, ['||']);

  function primary() {
    const tok = peek();
    if (!tok) throw new Error('end');
    if (tok.t === 'num') {
      p++;
      return { k: 'num', v: tok.v };
    }
    if (tok.t === 'id') {
      p++;
      if (isOp('(')) {
        p++;
        const args = [];
        if (!isOp(')')) {
          args.push(ternary());
          while (isOp(',')) {
            p++;
            args.push(ternary());
          }
        }
        expect(')');
        if (!FUNCTIONS[tok.v]) throw new Error('function');
        return { k: 'call', fn: tok.v, args };
      }
      return { k: 'var', name: tok.v };
    }
    if (isOp('(')) {
      p++;
      const inner = ternary();
      expect(')');
      return inner;
    }
    throw new Error('token');
  }

  const ast = ternary();
  if (p !== tokens.length) throw new Error('trailing');
  return ast;
};

const variablesOf = (ast, out = new Set()) => {
  if (!ast) return out;
  if (ast.k === 'var' && !(ast.name in CONSTANTS)) out.add(ast.name);
  ['cond', 'a', 'b', 'left', 'right', 'arg'].forEach((k) => ast[k] && variablesOf(ast[k], out));
  (ast.args || []).forEach((a) => variablesOf(a, out));
  return out;
};

const run = (ast, vars) => {
  switch (ast.k) {
    case 'num':
      return ast.v;
    case 'var':
      return ast.name in CONSTANTS ? CONSTANTS[ast.name] : Number(vars[ast.name]) || 0;
    case 'un': {
      const v = run(ast.arg, vars);
      return ast.op === '-' ? -v : ast.op === '!' ? (v ? 0 : 1) : v;
    }
    case 'if':
      return run(ast.cond, vars) ? run(ast.a, vars) : run(ast.b, vars);
    case 'call':
      return FUNCTIONS[ast.fn](...ast.args.map((a) => run(a, vars)));
    case 'bin': {
      if (ast.op === '&&') return run(ast.left, vars) && run(ast.right, vars) ? 1 : 0;
      if (ast.op === '||') return run(ast.left, vars) || run(ast.right, vars) ? 1 : 0;
      const a = run(ast.left, vars);
      const b = run(ast.right, vars);
      switch (ast.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return b === 0 ? 0 : a / b;
        case '%':
          return b === 0 ? 0 : a % b;
        case '<':
          return a < b ? 1 : 0;
        case '<=':
          return a <= b ? 1 : 0;
        case '>':
          return a > b ? 1 : 0;
        case '>=':
          return a >= b ? 1 : 0;
        case '==':
          return a === b ? 1 : 0;
        case '!=':
          return a !== b ? 1 : 0;
        default:
          return 0;
      }
    }
    default:
      return 0;
  }
};

const cache = new Map();

/**
 * Parse once (cached). → { ok, variables: [names], error?: 'syntax' }.
 * `run(vars)` evaluates the compiled formula.
 */
export const compileFormula = (src) => {
  const key = String(src ?? '');
  if (cache.has(key)) return cache.get(key);
  let compiled;
  try {
    const ast = key.trim() === '' ? { k: 'num', v: 0 } : parse(tokenize(key));
    compiled = { ok: true, variables: [...variablesOf(ast)], run: (vars = {}) => run(ast, vars) };
  } catch {
    compiled = { ok: false, variables: [], error: 'syntax', run: () => 0 };
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, compiled);
  return compiled;
};

/**
 * Evaluate a formula against variables. → { value, error }: error is
 * 'syntax', 'unknown' (with `names`) or null. Unknown variables count as 0.
 */
export const evaluate = (src, vars = {}) => {
  const c = compileFormula(src);
  if (!c.ok) return { value: 0, error: 'syntax' };
  const unknown = c.variables.filter((v) => !(v in vars));
  const value = c.run(vars);
  if (!Number.isFinite(value)) return { value: 0, error: 'syntax' };
  return unknown.length ? { value, error: 'unknown', names: unknown } : { value, error: null };
};

/** A quantity: never negative, rounded to 2 decimals (0 on error). */
export const quantityOf = (src, vars) => {
  const { value, error } = evaluate(src, vars);
  if (error === 'syntax' || !(value > 0)) return 0;
  return Math.round(value * 100) / 100;
};

/** A condition: empty = true. */
export const conditionHolds = (src, vars) => {
  if (src === undefined || src === null || String(src).trim() === '') return true;
  const { value, error } = evaluate(src, vars);
  return error !== 'syntax' && Boolean(value);
};
