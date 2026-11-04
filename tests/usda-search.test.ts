import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidFoodBarcode, normalizeIndianFoodQuery } from '../src/lib/usda';

test('normalizes common Hindi and Hinglish food names for USDA search', () => {
  assert.equal(normalizeIndianFoodQuery('2 roti, 1 katori dal aur doodh'), '2 whole wheat flatbread, 1 katori lentils aur milk');
  assert.equal(normalizeIndianFoodQuery('moong dal with dahi'), 'mung beans with yogurt');
  assert.equal(normalizeIndianFoodQuery('rajma chawal'), 'kidney beans rice');
});

test('keeps unrelated search terms unchanged', () => {
  assert.equal(normalizeIndianFoodQuery('banana and apple'), 'banana and apple');
});

test('accepts supported numeric retail barcode lengths', () => {
  assert.equal(isValidFoodBarcode('96385074'), true);
  assert.equal(isValidFoodBarcode('123456789012'), true);
  assert.equal(isValidFoodBarcode('1234567890123'), true);
  assert.equal(isValidFoodBarcode('12345678901234'), true);
});

test('rejects malformed or unsupported barcodes', () => {
  assert.equal(isValidFoodBarcode('1234567'), false);
  assert.equal(isValidFoodBarcode('123456789'), false);
  assert.equal(isValidFoodBarcode('123456789012345'), false);
  assert.equal(isValidFoodBarcode('1234abcd9012'), false);
  assert.equal(isValidFoodBarcode(' 123456789012 '), false);
});
