import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineAnalysis } from '../server/offline-analyst.js';

const snapshot = {
  current: { liveCollectionsINR: 1200, livePaidOrders: 3, averageLiveOrderINR: 400, newCustomers: 2, cancelledOrders: 1 },
  previous: { liveCollectionsINR: 1000 },
  topProducts: [{ name: 'Halo Lamp', units: 4, collectionsINR: 800 }],
  regions: [{ state: 'Karnataka', paidOrders: 2, collectionsINR: 900 }],
  inventory: { trackedProducts: 5, lowStockProducts: 2, outOfStockProducts: 1 },
  support: { open: 1, inProgress: 0, waitingCustomer: 0 },
};

test('offline analyst answers by topic from the snapshot only', () => {
  assert.match(offlineAnalysis('what should I restock', snapshot).answer, /2 tracked product/);
  assert.match(offlineAnalysis('which state is best', snapshot).answer, /Karnataka/);
  assert.match(offlineAnalysis('how are sales', snapshot).answer, /up 20\.0%/);
});

test('offline analyst handles an empty snapshot', () => {
  const result = offlineAnalysis('how are sales', {});
  assert.ok(result.answer && result.recommendations.length && result.evidence.length);
});
