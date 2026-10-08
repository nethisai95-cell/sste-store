import assert from 'node:assert/strict';
import test from 'node:test';
import { amountInWords, buildInvoice, isIntraState, splitGst } from '../src/invoice.js';

test('amountInWords uses the Indian numbering system', () => {
  assert.equal(amountInWords(0), 'Zero Rupees Only');
  assert.equal(amountInWords(100.5), 'One Hundred Rupees and Fifty Paise Only');
  assert.equal(amountInWords(123456), 'One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only');
  assert.equal(amountInWords(25000000), 'Two Crore Fifty Lakh Rupees Only');
});

test('splitGst halves intra-state tax without losing paise', () => {
  assert.deepEqual(splitGst(0.05, true), { cgst: 0.02, sgst: 0.03, igst: 0 });
  assert.deepEqual(splitGst(18, false), { cgst: 0, sgst: 0, igst: 18 });
});

test('isIntraState compares states case-insensitively', () => {
  assert.equal(isIntraState('Telangana', ' telangana '), true);
  assert.equal(isIntraState('Telangana', 'Karnataka'), false);
  assert.equal(isIntraState('', 'Karnataka'), false);
});

test('buildInvoice totals taxable value and GST components', () => {
  const invoice = buildInvoice({
    orderNumber: 'SSTE-1', total: 236, sellerGstRegistered: true, sellerGstin: '36ABCDE1234F1Z5',
    sellerRegisteredState: 'Telangana', state: 'Karnataka',
    items: [{ id: 'a', name: 'Chair', price: 100, quantity: 2, gstRate: 18, taxAmount: 36 }],
  });
  assert.equal(invoice.title, 'Tax Invoice');
  assert.equal(invoice.intraState, false);
  assert.equal(invoice.taxable, 200);
  assert.equal(invoice.igst, 36);
  assert.equal(invoice.lines[0].lineTotal, 236);
});

test('unregistered seller gets a bill of supply', () => {
  const invoice = buildInvoice({
    orderNumber: 'SSTE-2', total: 100, sellerGstRegistered: false, sellerGstin: '',
    items: [{ id: 'a', name: 'Mug', price: 100, quantity: 1, gstRate: 0, taxAmount: 0 }],
  });
  assert.equal(invoice.title, 'Bill of Supply');
});
