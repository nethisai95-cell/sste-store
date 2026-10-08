import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGstPaise,
  validateGstDetails,
  validateManualFinanceEntry,
  validateStoreTaxProfile,
} from '../server/finance-validation.js';

test('GST rates accept zero and up to two decimal places with valid HSN/SAC', () => {
  assert.deepEqual(validateGstDetails('18', '940360'), { gstRate: 18, hsnCode: '940360' });
  assert.deepEqual(validateGstDetails('0', ''), { gstRate: 0, hsnCode: '' });
  assert.equal(validateGstDetails('5.125').error, 'GST rate must be between 0 and 100 with no more than 2 decimal places.');
  assert.ok(validateGstDetails('', '').error);
  assert.ok(validateGstDetails('101').error);
  assert.ok(validateGstDetails('18', '12').error);
});

test('GST is calculated in paise with per-line rounding', () => {
  assert.equal(calculateGstPaise(10000, 18), 1800);
  assert.equal(calculateGstPaise(1999, 18), 360);
  assert.equal(calculateGstPaise(101, 5), 5);
  assert.equal(calculateGstPaise(12345, 0), 0);
  assert.throws(() => calculateGstPaise(1.5, 18), TypeError);
});

test('manual expenses, refunds and reconciliation records receive auditable signed paise values', () => {
  const expense = validateManualFinanceEntry({
    entryType: 'expense', amount: '125.50', category: 'Packaging', note: 'Supplier invoice',
  });
  assert.equal(expense.amountPaise, -12550);

  const refund = validateManualFinanceEntry({
    entryType: 'refund', amount: 25, category: 'Customer refund', orderId: '123e4567-e89b-12d3-a456-426614174000', note: 'Provider refund completed',
  });
  assert.equal(refund.amountPaise, -2500);

  const adjustment = validateManualFinanceEntry({
    entryType: 'reconciliation', amount: 15, direction: 'in', category: 'Bank reconciliation', note: 'Verified settlement difference',
  });
  assert.equal(adjustment.amountPaise, 1500);
});

test('manual finance entries reject invalid amounts, references, and unsupported entry types', () => {
  assert.ok(validateManualFinanceEntry({ entryType: 'sale', amount: 1, category: 'x', note: 'x' }).error);
  assert.ok(validateManualFinanceEntry({ entryType: 'expense', amount: 0, category: 'x', note: 'x' }).error);
  assert.ok(validateManualFinanceEntry({ entryType: 'refund', amount: 10, category: 'x', note: 'x' }).error);
  assert.ok(validateManualFinanceEntry({ entryType: 'expense', amount: 10, category: 'x', orderId: '123e4567-e89b-12d3-a456-426614174000', note: 'x' }).error);
  assert.ok(validateManualFinanceEntry({ entryType: 'reconciliation', amount: 10, direction: 'sideways', category: 'x', note: 'x' }).error);
});

test('store tax profiles require valid business details and explicit professional review', () => {
  assert.deepEqual(validateStoreTaxProfile({
    gstRegistered: false,
    legalName: '',
    gstin: '',
    registeredAddress: '',
    registeredState: '',
    accountantReviewed: false,
  }).gstRegistered, false);

  assert.equal(validateStoreTaxProfile({
    gstRegistered: true,
    legalName: 'Example Studio',
    gstin: '27ABCDE1234F1Z5',
    registeredAddress: 'Mumbai',
    registeredState: 'Maharashtra',
    accountantReviewed: true,
  }).accountantReviewed, true);
  assert.ok(validateStoreTaxProfile({
    gstRegistered: true,
    legalName: 'Example',
    gstin: 'invalid',
    registeredAddress: 'Address',
    registeredState: 'Maharashtra',
    accountantReviewed: false,
  }).error);
  assert.ok(validateStoreTaxProfile({
    gstRegistered: false,
    legalName: '',
    gstin: '',
    registeredAddress: '',
    registeredState: '',
    accountantReviewed: true,
  }).error);
});
