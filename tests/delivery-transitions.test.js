import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionDelivery, validDeliveryTransitions } from '../server/delivery-transitions.js';

test('delivery workflow permits only forward steps and documented retry', () => {
  const accepted = [
    ['assigned', 'picked_up'],
    ['picked_up', 'in_transit'],
    ['in_transit', 'out_for_delivery'],
    ['out_for_delivery', 'delivered'],
    ['out_for_delivery', 'delivery_failed'],
    ['delivery_failed', 'in_transit'],
  ];
  for (const [current, next] of accepted) assert.equal(canTransitionDelivery(current, next), true, `${current} -> ${next}`);
});

test('delivery workflow rejects skipped, reverse, repeated, and unknown steps', () => {
  const rejected = [
    ['assigned', 'in_transit'],
    ['assigned', 'delivered'],
    ['picked_up', 'assigned'],
    ['in_transit', 'delivered'],
    ['delivered', 'in_transit'],
    ['delivery_failed', 'delivered'],
    ['unknown', 'assigned'],
    ['assigned', 'unknown'],
  ];
  for (const [current, next] of rejected) assert.equal(canTransitionDelivery(current, next), false, `${current} -> ${next}`);
});

test('valid transition target set includes delivery completion and exception branches', () => {
  assert.deepEqual([...validDeliveryTransitions].sort(), [
    'delivered',
    'delivery_failed',
    'in_transit',
    'out_for_delivery',
    'picked_up',
  ]);
});
