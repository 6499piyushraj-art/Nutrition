import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateKnownValues, scaleNutrients, validIsoDate } from '../src/lib/nutrition-calculator';

test('scales per-serving values proportionally', () => {
  assert.deepEqual(scaleNutrients({ calories: 100, protein: 4, calcium: null }, 1.5), {
    calories: 150, protein: 6, calcium: null,
  });
});

test('unknown micronutrients remain unknown', () => {
  assert.deepEqual(scaleNutrients({ vitaminB12: undefined, iron: 2 }, 2), {
    vitaminB12: null, iron: 4,
  });
});

test('rejects negative and non-finite portions', () => {
  assert.throws(() => scaleNutrients({ calories: 100 }, -1), RangeError);
  assert.throws(() => scaleNutrients({ calories: 100 }, Number.NaN), RangeError);
});

test('returns complete totals only when every food value is known', () => {
  assert.deepEqual(aggregateKnownValues([100, 50]), {
    value: 150, status: 'complete', knownFoods: 2, totalFoods: 2,
  });
});

test('marks incomplete totals without silently counting null as zero', () => {
  assert.deepEqual(aggregateKnownValues([100, null]), {
    value: null, status: 'partial', knownFoods: 1, totalFoods: 2,
  });
  assert.deepEqual(aggregateKnownValues([null, undefined]), {
    value: null, status: 'unavailable', knownFoods: 0, totalFoods: 2,
  });
  assert.deepEqual(aggregateKnownValues([]), {
    value: null, status: 'no_food', knownFoods: 0, totalFoods: 0,
  });
});

test('validates real ISO calendar dates', () => {
  assert.equal(validIsoDate('2026-11-03'), true);
  assert.equal(validIsoDate('2026-02-29'), false);
  assert.equal(validIsoDate('2026-13-01'), false);
  assert.equal(validIsoDate('03-11-2026'), false);
});
