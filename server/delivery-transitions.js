const transitions = new Map([
  ['assigned', new Set(['picked_up'])],
  ['picked_up', new Set(['in_transit'])],
  ['in_transit', new Set(['out_for_delivery'])],
  ['out_for_delivery', new Set(['delivered', 'delivery_failed'])],
  ['delivery_failed', new Set(['in_transit'])],
]);

export const validDeliveryTransitions = new Set(
  [...transitions.values()].flatMap((statuses) => [...statuses]),
);

export function canTransitionDelivery(currentStatus, nextStatus) {
  return transitions.get(currentStatus)?.has(nextStatus) ?? false;
}
