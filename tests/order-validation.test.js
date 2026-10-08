import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomerCredentials, validateOrderRequest } from '../server/order-validation.js';

const productId = '66ce6b11-41d3-4e2c-9a4e-bef8b4f7c001';
const validAddress = {
  recipientName: '  Asha Rao  ',
  phone: '9876543210',
  addressLine1: '  12 Lake Road  ',
  addressLine2: '  Apt 4  ',
  city: ' Pune ',
  state: ' Maharashtra ',
  postalCode: '411001',
};
const validOrder = {
  items: [{ productId, quantity: 1 }],
  shippingAddress: validAddress,
};

test('customer credentials normalize email and accept supported password boundaries', () => {
  assert.deepEqual(validateCustomerCredentials({
    email: '  SHOPPER@Example.in ',
    password: 'correct horse battery staple',
  }), {
    email: 'shopper@example.in',
    password: 'correct horse battery staple',
  });
  assert.equal(validateCustomerCredentials({ email: 'a@b.in', password: 'x'.repeat(11) }).error, 'Password must be between 12 and 256 characters.');
  assert.equal(validateCustomerCredentials({ email: 'a@b.in', password: 'x'.repeat(257) }).error, 'Password must be between 12 and 256 characters.');
  assert.equal(validateCustomerCredentials({ email: 'not-an-email', password: 'long enough password' }).error, 'Enter a valid email address.');
  assert.ok(validateCustomerCredentials({ email: 'a@b.in', password: 'x'.repeat(12) }).password);
  assert.ok(validateCustomerCredentials({ email: 'a@b.in', password: 'x'.repeat(256) }).password);
});

test('order validation trims Indian delivery details and parses product quantities', () => {
  const result = validateOrderRequest(validOrder);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.shippingAddress, {
    recipientName: 'Asha Rao',
    phone: '9876543210',
    addressLine1: '12 Lake Road',
    addressLine2: 'Apt 4',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
  });
  assert.deepEqual([...result.quantities], [[productId, 1]]);
});

test('order line count and quantity limits reject malformed baskets', () => {
  assert.equal(validateOrderRequest({ ...validOrder, items: [] }).error, 'Your bag must contain between 1 and 50 products.');
  assert.equal(validateOrderRequest({ ...validOrder, items: Array(51).fill(validOrder.items[0]) }).error, 'Your bag must contain between 1 and 50 products.');
  assert.equal(validateOrderRequest({ ...validOrder, items: [{ productId, quantity: 0 }] }).error, 'Your bag contains an invalid product or quantity.');
  assert.equal(validateOrderRequest({ ...validOrder, items: [{ productId, quantity: 100 }] }).error, 'Your bag contains an invalid product or quantity.');
  assert.equal(validateOrderRequest({ ...validOrder, items: [{ productId, quantity: 1.5 }] }).error, 'Your bag contains an invalid product or quantity.');
  assert.equal(validateOrderRequest({ ...validOrder, items: [{ productId: 'not-a-uuid', quantity: 1 }] }).error, 'Your bag contains an invalid product or quantity.');
  assert.equal(validateOrderRequest({ ...validOrder, items: [{ productId, quantity: 1 }, { productId, quantity: 2 }] }).error, 'Your bag contains an invalid product or quantity.');
});

test('order limits accept the maximum supported basket and item quantity', () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    productId: `66ce6b11-41d3-4e2c-9a4e-${String(index + 1).padStart(12, '0')}`,
    quantity: index === 0 ? 99 : 1,
  }));
  const result = validateOrderRequest({ ...validOrder, items });
  assert.equal(result.error, undefined);
  assert.equal(result.quantities.size, 50);
  assert.equal(result.quantities.get(items[0].productId), 99);
});

test('shipping validation rejects invalid Indian addresses', () => {
  const cases = [
    [{ phone: '5876543210' }, 'Enter a valid 10-digit Indian mobile number.'],
    [{ postalCode: '011001' }, 'Enter a valid 6-digit Indian PIN code.'],
    [{ state: 'California' }, 'Choose a valid Indian state or union territory.'],
    [{ recipientName: ' ' }, 'Enter a recipient name (up to 120 characters).'],
    [{ recipientName: 'x'.repeat(121) }, 'Enter a recipient name (up to 120 characters).'],
    [{ addressLine1: 'x'.repeat(161) }, 'Enter an address line (up to 160 characters).'],
    [{ addressLine2: 'x'.repeat(121) }, 'Address line 2 must be 120 characters or fewer.'],
    [{ city: ' ' }, 'Enter a city or town (up to 80 characters).'],
    [{ city: 'x'.repeat(81) }, 'Enter a city or town (up to 80 characters).'],
  ];

  for (const [change, expectedError] of cases) {
    assert.equal(
      validateOrderRequest({ ...validOrder, shippingAddress: { ...validAddress, ...change } }).error,
      expectedError,
    );
  }
});
