// Unit tests for src/utils/planning/Formula.js (node:test).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installNodeTestEnvironment } from './helpers.js';

installNodeTestEnvironment();

const { evaluate, quantityOf, conditionHolds, compileFormula } = await import('../planning/Formula.js');

describe('Formula', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    assert.equal(evaluate('2 + 3 * 4', {}).value, 14);
    assert.equal(evaluate('(2 + 3) * 4', {}).value, 20);
    assert.equal(evaluate('-a + 10 / 4', { a: 1 }).value, 1.5);
    assert.equal(evaluate('7 % 3', {}).value, 1);
    assert.equal(evaluate('1.5e2', {}).value, 150);
  });

  it('supports comparisons, logic and nested ternaries', () => {
    const vars = { use: 3, finish: 2 };
    assert.equal(evaluate('use == 1 ? 1.3 : use == 3 ? 0.6 : 0.5', vars).value, 0.6);
    assert.equal(evaluate('finish >= 2 && use != 4', vars).value, 1);
    assert.equal(evaluate('!(finish > 2) || 0', vars).value, 1);
  });

  it('supports the whitelisted functions, Math. prefix and PI', () => {
    assert.equal(evaluate('ceil(a/500)*2.5', { a: 1200 }).value, 7.5);
    assert.equal(evaluate('Math.max(1, 4, 2) + min(3, 1)', {}).value, 5);
    assert.equal(evaluate('round(PI, 2)', {}).value, 3.14);
    assert.equal(evaluate('if(x > 1, 10, 20)', { x: 2 }).value, 10);
    assert.equal(evaluate('sqrt(16) + pow(2, 3) + abs(-1) + floor(2.7)', {}).value, 15);
  });

  it('reports syntax errors and unknown variables instead of throwing', () => {
    assert.deepEqual(evaluate('2 +', {}), { value: 0, error: 'syntax' });
    assert.deepEqual(evaluate('process.exit(1)', {}), { value: 0, error: 'syntax' });
    assert.deepEqual(evaluate('alert(1)', {}), { value: 0, error: 'syntax' });
    assert.equal(evaluate('a; b', {}).error, 'syntax');
    const r = evaluate('area * k', { area: 10 });
    assert.equal(r.error, 'unknown');
    assert.deepEqual(r.names, ['k']);
    assert.equal(r.value, 0); // unknown counts as 0
  });

  it('division by zero is 0, not Infinity', () => {
    assert.equal(evaluate('5 / 0', {}).value, 0);
  });

  it('quantityOf: non-negative, two decimals; conditionHolds: empty = true', () => {
    assert.equal(quantityOf('a*0.333', { a: 10 }), 3.33);
    assert.equal(quantityOf('a - 20', { a: 10 }), 0);
    assert.equal(quantityOf('bad +', {}), 0);
    assert.equal(conditionHolds('', {}), true);
    assert.equal(conditionHolds(undefined, {}), true);
    assert.equal(conditionHolds('basement', { basement: 0 }), false);
    assert.equal(conditionHolds('basement == 0', { basement: 0 }), true);
    assert.equal(conditionHolds('((', {}), false);
  });

  it('lists the variables a formula uses (constants excluded)', () => {
    assert.deepEqual(compileFormula('PI*d*d/2 + floors').variables.sort(), ['d', 'floors']);
  });
});
