import test from 'node:test';
import assert from 'node:assert/strict';
import { razorpayMethodOptions } from '../src/payment-methods.js';

test('all enabled hosted checkout methods are left available by default', () => {
  assert.equal(razorpayMethodOptions('all'), undefined);
});

test('choosing a payment type enables only that hosted checkout method', () => {
  for (const selected of ['upi', 'card', 'netbanking', 'wallet']) {
    const options = razorpayMethodOptions(selected);
    assert.deepEqual(Object.keys(options).sort(), ['card', 'netbanking', 'upi', 'wallet']);
    assert.equal(options[selected], true);
    for (const method of Object.keys(options).filter((method) => method !== selected)) {
      assert.equal(options[method], false);
    }
  }
});

test('unsupported payment types fail explicitly', () => {
  assert.throws(() => razorpayMethodOptions('cash_on_delivery'), {
    name: 'TypeError',
    message: 'Choose a supported Razorpay payment method.',
  });
});
