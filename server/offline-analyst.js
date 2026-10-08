const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const change = (now, before) => {
  now = Number(now || 0);
  before = Number(before || 0);
  if (!before) return now ? 'new activity (no sales in the previous period)' : 'no change (no sales in either period)';
  const pct = ((now - before) / before) * 100;
  return `${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% vs the previous period`;
};

export function offlineAnalysis(question, snapshot) {
  const c = snapshot.current ?? {};
  const p = snapshot.previous ?? {};
  const inventory = snapshot.inventory ?? {};
  const support = snapshot.support ?? {};
  const topProducts = snapshot.topProducts ?? [];
  const regions = snapshot.regions ?? [];
  const q = question.toLowerCase();

  const evidence = [
    `Live collections ${inr(c.liveCollectionsINR)} from ${c.livePaidOrders ?? 0} paid orders (${change(c.liveCollectionsINR, p.liveCollectionsINR)}).`,
    `Low-stock products: ${inventory.lowStockProducts ?? 0}; out of stock: ${inventory.outOfStockProducts ?? 0}.`,
    `Open support tickets: ${support.open ?? 0}.`,
  ];
  const recommendations = [];
  let answer;

  if (/stock|restock|inventory|reorder/.test(q)) {
    answer = `${inventory.lowStockProducts ?? 0} tracked product(s) are at or below reorder level and ${inventory.outOfStockProducts ?? 0} are out of stock, out of ${inventory.trackedProducts ?? 0} tracked.`;
    if (inventory.lowStockProducts) recommendations.push('Review the Inventory queue in the admin page and reorder the low-stock items first.');
    if (topProducts[0]) recommendations.push(`Keep "${topProducts[0].name}" in stock: it is your top seller this period.`);
  } else if (/state|region|where|city/.test(q)) {
    answer = regions.length
      ? `${regions[0].state} brought in the most live collections (${inr(regions[0].collectionsINR)} from ${regions[0].paidOrders} paid orders).`
      : 'No live paid orders with a delivery state in this period.';
    recommendations.push('Check delivery times and promotions for your top state to build on it.');
  } else if (/product|sell|best|top/.test(q)) {
    answer = topProducts.length
      ? `Top product this period: ${topProducts[0].name} (${topProducts[0].units} units, ${inr(topProducts[0].collectionsINR)}).`
      : 'No live paid orders in this period, so there is no top product yet.';
  } else if (/support|ticket|complain/.test(q)) {
    answer = `${support.open ?? 0} ticket(s) are open, ${support.inProgress ?? 0} in progress and ${support.waitingCustomer ?? 0} waiting on the customer.`;
    if (support.open) recommendations.push('Reply to open tickets first; oldest tickets hurt repeat purchases the most.');
  } else {
    answer = `Live collections are ${inr(c.liveCollectionsINR)} from ${c.livePaidOrders ?? 0} paid orders, ${change(c.liveCollectionsINR, p.liveCollectionsINR)}. Average live order is ${inr(c.averageLiveOrderINR)} and ${c.newCustomers ?? 0} new customer(s) joined.`;
  }

  if (Number(c.cancelledOrders) > 0) recommendations.push(`${c.cancelledOrders} order(s) were cancelled; check the reasons for a pattern.`);
  if (Number(c.simulatedUPIOrders) > 0 || Number(c.testModeCaptures) > 0) {
    recommendations.push('Some orders were simulated or test-mode and are not counted as live collections.');
  }
  if (!recommendations.length) recommendations.push('No urgent action found in these metrics.');
  return { answer, recommendations: recommendations.slice(0, 5), evidence };
}
