import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnitLookup, validatePosSale } from '../server/pos-validation.js';

const productId = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';
const unitId = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

test('POS sale validation normalises a valid cash sale', () => {
  const result = validatePosSale({
    paymentMethod: 'cash',
    amountTendered: '2000.50',
    customerPhone: '+91 98765 43210',
    items: [
      { productId: productId.toUpperCase(), quantity: 1, unitIds: [unitId] },
      { productId, quantity: 2 },
    ],
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.items, [{ productId, quantity: 3, unitIds: [unitId] }]);
  assert.equal(result.amountTenderedPaise, 200050);
  assert.equal(result.customerPhone, '9876543210');
});

test('POS sale validation rejects bad input', () => {
  const base = { paymentMethod: 'upi', items: [{ productId, quantity: 1 }] };
  for (const body of [
    null,
    { ...base, paymentMethod: 'cheque' },
    { ...base, items: [] },
    { ...base, items: [{ productId: 'nope', quantity: 1 }] },
    { ...base, items: [{ productId, quantity: 0 }] },
    { ...base, items: [{ productId, quantity: 1.5 }] },
    { ...base, items: [{ productId, quantity: 100 }] },
    { ...base, items: [{ productId, quantity: 1, unitIds: [unitId, 'bad'] }] },
    { ...base, items: [{ productId, quantity: 1, unitIds: [unitId, '11111111-1111-1111-1111-111111111111'] }] },
    { ...base, customerPhone: '12345' },
    { paymentMethod: 'cash', amountTendered: '-5', items: base.items },
    { paymentMethod: 'cash', amountTendered: '10.999', items: base.items },
  ]) {
    assert.ok(validatePosSale(body).error, JSON.stringify(body));
  }
});

test('POS unit lookup accepts full IDs and 8-character label codes only', () => {
  assert.deepEqual(parseUnitLookup(unitId.toUpperCase()), { id: unitId });
  assert.deepEqual(parseUnitLookup('9A1B2C3D'), { prefix: '9a1b2c3d' });
  assert.equal(parseUnitLookup("9a1b2c3d' OR 1=1"), null);
  assert.equal(parseUnitLookup(undefined), null);
});
