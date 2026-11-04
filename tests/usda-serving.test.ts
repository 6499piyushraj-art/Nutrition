import test from 'node:test';
import assert from 'node:assert/strict';
import { stripFood } from '../src/lib/usda';

test('uses 100 g as the basis when analytical FDC foods have no household serving', () => {
  const food = stripFood({
    fdcId: 123,
    description: 'Rice, white, cooked',
    dataType: 'Foundation',
    foodNutrients: [],
  });
  assert.equal(food.serving_size, 100);
  assert.equal(food.serving_unit, 'g');
});

test('preserves branded label serving size and unit', () => {
  const food = stripFood({
    fdcId: 456,
    description: 'Breakfast cereal',
    dataType: 'Branded',
    servingSize: 30,
    servingSizeUnit: 'g',
    foodNutrients: [],
  });
  assert.equal(food.serving_size, 30);
  assert.equal(food.serving_unit, 'g');
});

test('does not invent a branded serving when FoodData Central omits it', () => {
  const food = stripFood({
    fdcId: 789,
    description: 'Packaged snack',
    dataType: 'Branded',
    foodNutrients: [],
  });
  assert.equal(food.serving_size, null);
  assert.equal(food.serving_unit, '');
});
