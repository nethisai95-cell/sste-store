const validManualEntryTypes = new Set(['expense', 'refund', 'reconciliation']);
const validIndianStates = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]);

export function calculateGstPaise(taxablePaise, gstRate) {
  if (!Number.isSafeInteger(taxablePaise) || taxablePaise < 0) {
    throw new TypeError('Taxable amount must be a non-negative whole number of paise.');
  }
  const details = validateGstDetails(gstRate);
  if (details.error) throw new TypeError(details.error);
  return Math.round((taxablePaise * Math.round(details.gstRate * 100)) / 10000);
}

export function validateGstDetails(gstRate, hsnCode = '') {
  const rate = Number(gstRate);
  const hsn = typeof hsnCode === 'string' ? hsnCode.trim() : '';
  if (
    gstRate === null || gstRate === undefined || String(gstRate).trim() === '' ||
    !Number.isFinite(rate) || rate < 0 || rate > 100 ||
    Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-8
  ) {
    return { error: 'GST rate must be between 0 and 100 with no more than 2 decimal places.' };
  }
  if (hsn.length > 8 || (hsn && !/^[a-z\d]{4,8}$/i.test(hsn))) {
    return { error: 'HSN/SAC must contain 4–8 letters or digits, or be left blank.' };
  }
  return { gstRate: rate, hsnCode: hsn.toUpperCase() };
}

export function validateManualFinanceEntry(body) {
  const entryType = body?.entryType;
  const amount = Number(body?.amount);
  const category = typeof body?.category === 'string' ? body.category.trim() : '';
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';

  if (!validManualEntryTypes.has(entryType)) {
    return { error: 'Choose an expense, refund, or reconciliation entry.' };
  }
  if (
    !Number.isFinite(amount) || amount <= 0 || amount > 100000000 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
  ) {
    return { error: 'Amount must be greater than zero, no more than ₹100,000,000, and have at most 2 decimal places.' };
  }
  if (!category || category.length > 80) return { error: 'Category must be between 1 and 80 characters.' };
  if (reference.length > 120) return { error: 'Reference must be 120 characters or fewer.' };
  if (!note || note.length > 1000) return { error: 'Note must be between 1 and 1000 characters.' };
  if ((entryType === 'refund') !== Boolean(orderId)) {
    return { error: entryType === 'refund' ? 'Refund entries must reference an order.' : 'Only refund entries can reference an order.' };
  }
  if (entryType === 'reconciliation' && !['in', 'out'].includes(body?.direction)) {
    return { error: 'Choose whether the reconciliation adjustment increases or decreases the balance.' };
  }
  if (orderId && !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(orderId)) {
    return { error: 'Enter a valid order id.' };
  }

  return {
    entryType,
    amountPaise: Math.round(amount * 100) * (entryType === 'reconciliation' && body.direction === 'in' ? 1 : -1),
    category,
    reference,
    note,
    orderId: orderId || null,
  };
}

export function validateStoreTaxProfile(body) {
  const gstRegistered = body?.gstRegistered;
  const legalName = typeof body?.legalName === 'string' ? body.legalName.trim() : '';
  const gstin = typeof body?.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
  const registeredAddress = typeof body?.registeredAddress === 'string' ? body.registeredAddress.trim() : '';
  const registeredState = typeof body?.registeredState === 'string' ? body.registeredState.trim() : '';
  const accountantReviewed = body?.accountantReviewed;

  if (typeof gstRegistered !== 'boolean' || typeof accountantReviewed !== 'boolean') {
    return { error: 'Choose whether the business is GST registered and whether its tax setup was reviewed by a tax professional.' };
  }
  if (legalName.length > 160 || registeredAddress.length > 500) {
    return { error: 'Legal name must be at most 160 characters and registered address at most 500 characters.' };
  }
  if (gstRegistered) {
    if (!legalName || !registeredAddress || !validIndianStates.has(registeredState)) {
      return { error: 'A GST-registered profile requires its legal name, registered address, and Indian state or union territory.' };
    }
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return { error: 'Enter a GSTIN in the standard 15-character format.' };
    }
  } else if (gstin || registeredState) {
    return { error: 'Clear the GSTIN and registered state when marking the business as not GST registered.' };
  }
  if (accountantReviewed && !gstRegistered) {
    return { error: 'The GST setup cannot be marked reviewed while the business is not registered.' };
  }

  return { gstRegistered, legalName, gstin, registeredAddress, registeredState, accountantReviewed };
}
