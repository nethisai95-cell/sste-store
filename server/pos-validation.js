const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const paymentMethods = new Set(['cash', 'upi', 'card']);

export function validatePosSale(body) {
  const paymentMethod = body?.paymentMethod;
  if (!paymentMethods.has(paymentMethod)) return { error: 'Choose cash, UPI or card.' };
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > 50) {
    return { error: 'Add between 1 and 50 products to the sale.' };
  }

  const items = new Map();
  for (const item of body.items) {
    const quantity = Number(item?.quantity);
    if (typeof item?.productId !== 'string' || !uuidPattern.test(item.productId)) {
      return { error: 'A product in the sale is not valid.' };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return { error: 'Quantities must be whole numbers from 1 to 99.' };
    }
    const unitIds = Array.isArray(item.unitIds) ? item.unitIds : [];
    if (unitIds.some((unitId) => typeof unitId !== 'string' || !uuidPattern.test(unitId))) {
      return { error: 'A scanned unit in the sale is not valid.' };
    }
    const entry = items.get(item.productId.toLowerCase()) || { quantity: 0, unitIds: new Set() };
    entry.quantity += quantity;
    unitIds.forEach((unitId) => entry.unitIds.add(unitId.toLowerCase()));
    if (entry.quantity > 99) return { error: 'Quantities must be whole numbers from 1 to 99.' };
    if (entry.unitIds.size > entry.quantity) return { error: 'More units were scanned than the quantity sold.' };
    items.set(item.productId.toLowerCase(), entry);
  }

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.replace(/\D/g, '').slice(-10) : '';
  const paymentReference = typeof body.paymentReference === 'string' ? body.paymentReference.trim() : '';
  if (customerName.length > 120) return { error: 'Customer name must be 120 characters or fewer.' };
  if (customerPhone && customerPhone.length !== 10) return { error: 'Enter a 10-digit customer mobile number or leave it blank.' };
  if (paymentReference.length > 80) return { error: 'Payment reference must be 80 characters or fewer.' };

  let amountTenderedPaise = null;
  if (paymentMethod === 'cash' && body.amountTendered !== undefined && body.amountTendered !== '') {
    const tendered = Number(body.amountTendered);
    if (!Number.isFinite(tendered) || tendered <= 0 || tendered > 10000000
      || Math.abs(tendered * 100 - Math.round(tendered * 100)) > 1e-8) {
      return { error: 'Enter the cash received as a rupee amount with at most 2 decimal places.' };
    }
    amountTenderedPaise = Math.round(tendered * 100);
  }

  return {
    items: [...items].map(([productId, entry]) => ({
      productId,
      quantity: entry.quantity,
      unitIds: [...entry.unitIds],
    })),
    paymentMethod,
    paymentReference,
    customerName,
    customerPhone,
    amountTenderedPaise,
  };
}

export function parseUnitLookup(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (uuidPattern.test(text)) return { id: text.toLowerCase() };
  if (/^[\da-f]{8}$/i.test(text)) return { prefix: text.toLowerCase() };
  return null;
}
