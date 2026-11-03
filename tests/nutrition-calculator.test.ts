import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateKnownValues, scaleNutrients, validIsoDate } from '../src/lib/nutrition-calculator';
import { getDefaultNutrientTargets, getNutrientReferenceMetadata } from '../src/lib/nutrients';

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


test('uses the ICMR-NIN 2020 16–18 reference band for girls', () => {
  const targets = getDefaultNutrientTargets({ dateOfBirth: '2009-01-01', sex: 'F' });
  assert.equal(targets.protein, 46);
  assert.equal(targets.iron, 32);
  assert.equal(targets.zinc, 14.2);
  assert.equal(targets.folate, 270);
  assert.equal(targets.vitamin_c, 70);
  assert.equal(targets.vitamin_a, 860);
});

test('uses the ICMR-NIN 2020 16–18 reference band for boys', () => {
  const { getDefaultNutrientTargets } = require('../src/lib/nutrients') as typeof import('../src/lib/nutrients');
  const targets = getDefaultNutrientTargets({ dateOfBirth: '2009-01-01', sex: 'M' });
  assert.equal(targets.protein, 55);
  assert.equal(targets.iron, 26);
  assert.equal(targets.zinc, 17.6);
  assert.equal(targets.folate, 340);
  assert.equal(targets.vitamin_c, 85);
});

test('falls back to unclassified references for invalid birth dates', () => {
  const metadata = getNutrientReferenceMetadata({ dateOfBirth: '2009-02-30', sex: 'M' });
  assert.equal(metadata.populationGroup, 'General starting values; age/sex-specific reference not selected');
});
